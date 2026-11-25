#![windows_subsystem = "windows"]

#[path = "../../src-tauri/src/rbx.rs"]
#[allow(dead_code)]
mod rbx;

use serde_json::{json, Value};
use std::io::Read;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{Emitter, Manager};

const PAYLOAD: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/moony.zip"));
const WEBVIEW2: &[u8] = include_bytes!("../assets/MicrosoftEdgeWebview2Setup.exe");
const VERSION: &str = env!("MOONY_VERSION");
const UNINST: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Moony";
const WV2_ID: &str = "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
const NO_WINDOW: u32 = 0x0800_0000;
const DETACHED: u32 = 0x0000_0008;

fn hidden(exe: &str) -> Command { let mut c = Command::new(exe); c.creation_flags(NO_WINDOW); c }

fn reg_get(key: &str, val: Option<&str>) -> Option<String> {
    let mut c = hidden("reg");
    c.args(["query", key]);
    match val { Some(v) => { c.args(["/v", v]); } None => { c.arg("/ve"); } }
    let o = c.output().ok()?;
    if !o.status.success() { return None; }
    String::from_utf8_lossy(&o.stdout).lines().find_map(|l| l.split_once("REG_SZ").or_else(|| l.split_once("REG_EXPAND_SZ")).map(|(_, v)| v.trim().to_string()))
}
fn reg_set(key: &str, name: &str, kind: &str, data: &str) {
    let _ = hidden("reg").args(["add", key, "/v", name, "/t", kind, "/d", data, "/f"]).status();
}

fn webview2_ok() -> bool {
    [format!(r"HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{WV2_ID}"), format!(r"HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{WV2_ID}"), format!(r"HKCU\Software\Microsoft\EdgeUpdate\Clients\{WV2_ID}")]
        .iter().any(|k| reg_get(k, Some("pv")).map(|v| !v.is_empty() && v != "0.0.0.0").unwrap_or(false))
}
fn install_webview2(silent: bool) -> bool {
    if webview2_ok() { return true; }
    let f = std::env::temp_dir().join("MicrosoftEdgeWebview2Setup.exe");
    if std::fs::write(&f, WEBVIEW2).is_err() { return false; }
    let mut c = Command::new(&f);
    if silent { c.arg("/silent"); }
    let _ = c.arg("/install").status();
    let _ = std::fs::remove_file(&f);
    webview2_ok()
}

fn message(text: &str) {
    use windows::core::PCWSTR;
    use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};
    let w = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
    let (t, c) = (w(text), w("Moony Setup"));
    unsafe { MessageBoxW(None, PCWSTR(t.as_ptr()), PCWSTR(c.as_ptr()), MB_OK | MB_ICONERROR); }
}

fn unquote(s: String) -> String { s.trim_matches('"').to_string() }
fn local() -> PathBuf { dirs::data_local_dir().unwrap_or_default() }
fn existing() -> Option<(PathBuf, String)> {
    let dir = reg_get(UNINST, Some("InstallLocation")).map(unquote)?;
    let p = PathBuf::from(dir);
    p.join("moony.exe").exists().then(|| (p, reg_get(UNINST, Some("DisplayVersion")).unwrap_or_default()))
}
fn default_dir() -> PathBuf { existing().map(|e| e.0).unwrap_or_else(|| local().join("Moony")) }

fn ps(script: &str) -> bool {
    hidden("powershell").args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script]).status().map(|s| s.success()).unwrap_or(false)
}
fn ps_str(s: &str) -> String { format!("'{}'", s.replace('\'', "''")) }

fn stop_running(paths: &[PathBuf]) {
    let list = paths.iter().map(|p| ps_str(&p.to_string_lossy())).collect::<Vec<_>>().join(",");
    ps(&format!("$t=@({list}); Get-Process | Where-Object {{ $_.Path -and ($t -contains $_.Path) }} | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 600"));
}

fn desktop_lnk() -> PathBuf { dirs::desktop_dir().unwrap_or_default().join("Moony.lnk") }
fn start_lnk() -> PathBuf { dirs::data_dir().unwrap_or_default().join(r"Microsoft\Windows\Start Menu\Programs\Moony.lnk") }
fn shortcut(lnk: &Path, exe: &Path) -> bool {
    ps(&format!("$s=(New-Object -ComObject WScript.Shell).CreateShortcut({}); $s.TargetPath={}; $s.WorkingDirectory={}; $s.Description='Moony, a free Roblox launcher'; $s.Save()",
        ps_str(&lnk.to_string_lossy()), ps_str(&exe.to_string_lossy()), ps_str(&exe.parent().unwrap().to_string_lossy())))
}

struct Tasks(Option<tauri::AppHandle>);
impl Tasks {
    fn send(&self, id: &str, state: &str, detail: &str, pct: f64) {
        if let Some(a) = &self.0 { let _ = a.emit("task", json!({ "id": id, "state": state, "detail": detail, "pct": pct })); }
    }
}

#[derive(serde::Deserialize, Clone)]
struct Opts { dir: String, desktop: bool, start_menu: bool, roblox: bool }

fn write_files(dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("Couldn't create {}: {e}", dir.display()))?;
    let mut z = zip::ZipArchive::new(std::io::Cursor::new(PAYLOAD)).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    z.by_name("moony.exe").map_err(|e| e.to_string())?.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    let (tmp, exe) = (dir.join("moony.exe.new"), dir.join("moony.exe"));
    std::fs::write(&tmp, &buf).map_err(|e| format!("Couldn't write to {}: {e}", dir.display()))?;
    let old = dir.join("moony.exe.old");
    let _ = std::fs::remove_file(&old);
    let mut last = String::new();
    for _ in 0..20 {
        let r = if exe.exists() { std::fs::rename(&exe, &old) } else { Ok(()) };
        match r.and_then(|_| std::fs::rename(&tmp, &exe)) { Ok(()) => { last.clear(); break; } Err(e) => { last = e.to_string(); std::thread::sleep(std::time::Duration::from_millis(400)); } }
    }
    if !last.is_empty() { let _ = std::fs::remove_file(&tmp); if !exe.exists() { let _ = std::fs::rename(&old, &exe); } return Err(format!("Moony is still open and couldn't be replaced. Close it and try again. ({last})")); }
    let _ = std::fs::remove_file(&old);
    let me = std::env::current_exe().map_err(|e| e.to_string())?;
    let un = dir.join("uninstall.exe");
    if me != un { let _ = std::fs::copy(&me, &un); }
    Ok(())
}

fn register(dir: &Path) {
    let q = |p: PathBuf| format!("\"{}\"", p.display());
    for (n, k, v) in [
        ("DisplayName", "REG_SZ", "Moony".to_string()),
        ("DisplayVersion", "REG_SZ", VERSION.to_string()),
        ("Publisher", "REG_SZ", "moonylauncher".to_string()),
        ("DisplayIcon", "REG_SZ", q(dir.join("moony.exe"))),
        ("InstallLocation", "REG_SZ", q(dir.to_path_buf())),
        ("UninstallString", "REG_SZ", q(dir.join("uninstall.exe"))),
        ("QuietUninstallString", "REG_SZ", format!("{} /S", q(dir.join("uninstall.exe")))),
        ("MainBinaryName", "REG_SZ", "moony.exe".to_string()),
        ("URLInfoAbout", "REG_SZ", "https://moonylauncher.xyz".to_string()),
        ("NoModify", "REG_DWORD", "1".to_string()),
        ("NoRepair", "REG_DWORD", "1".to_string()),
    ] { reg_set(UNINST, n, k, &v); }
    let kb = std::fs::metadata(dir.join("moony.exe")).map(|m| m.len()).unwrap_or(0) / 1024 + std::fs::metadata(dir.join("uninstall.exe")).map(|m| m.len()).unwrap_or(0) / 1024;
    reg_set(UNINST, "EstimatedSize", "REG_DWORD", &kb.to_string());
}

async fn run_install(t: Tasks, o: Opts) -> Result<PathBuf, String> {
    let dir = PathBuf::from(&o.dir);
    if !dir.is_absolute() { return Err("Pick a full folder path, like C:\\Users\\you\\AppData\\Local\\Moony".into()); }

    t.send("deps", "run", "Checking for the WebView2 runtime", 0.0);
    let ok = tokio::task::spawn_blocking(|| install_webview2(true)).await.unwrap_or(false);
    if !ok { t.send("deps", "error", "", 0.0); return Err("Couldn't install the Microsoft WebView2 runtime, which Moony needs to show its window. Check your internet connection and try again.".into()); }
    t.send("deps", "done", "WebView2 runtime is ready", 1.0);

    t.send("close", "run", "Closing Moony if it's open", 0.0);
    let old = local().join(r"Programs\Moony");
    let (d2, o2) = (dir.clone(), old.clone());
    tokio::task::spawn_blocking(move || stop_running(&[d2.join("moony.exe"), o2.join("Moony.exe")])).await.ok();
    if old.join("Moony.exe").exists() && old != dir { let _ = std::fs::remove_dir_all(&old); }
    t.send("close", "done", "Nothing is in the way", 1.0);

    t.send("files", "run", &format!("Copying Moony {VERSION}"), 0.3);
    let d = dir.clone();
    tokio::task::spawn_blocking(move || write_files(&d)).await.map_err(|e| e.to_string())?.map_err(|e| { t.send("files", "error", "", 0.0); e })?;
    t.send("files", "done", &dir.display().to_string(), 1.0);

    t.send("shortcuts", "run", "Adding shortcuts", 0.0);
    let (exe, desk, start) = (dir.join("moony.exe"), o.desktop, o.start_menu);
    let made = tokio::task::spawn_blocking(move || {
        let mut v = vec![];
        if start && shortcut(&start_lnk(), &exe) { v.push("Start menu"); } else if !start { let _ = std::fs::remove_file(start_lnk()); }
        if desk && shortcut(&desktop_lnk(), &exe) { v.push("desktop"); } else if !desk { let _ = std::fs::remove_file(desktop_lnk()); }
        v
    }).await.unwrap_or_default();
    t.send("shortcuts", "done", &if made.is_empty() { "No shortcuts".to_string() } else { format!("Added to {}", made.join(" and ")) }, 1.0);

    t.send("register", "run", "Adding Moony to Apps & features", 0.0);
    let d = dir.clone();
    tokio::task::spawn_blocking(move || register(&d)).await.ok();
    t.send("register", "done", "You can uninstall it from Settings any time", 1.0);

    if o.roblox {
        t.send("roblox", "run", "Finding the latest Roblox version", 0.0);
        let r = async {
            let (guid, version) = rbx::latest(None).await?;
            if rbx::installed(&guid).is_some() { return Ok::<String, String>(format!("Roblox {version} was already downloaded")); }
            let app = t.0.clone();
            rbx::install(&guid, &version, false, move |phase: &str, done: u64, total: u64| {
                if let Some(a) = &app {
                    let pct = if total > 0 { done as f64 / total as f64 } else { 0.0 };
                    let detail = if total > 0 { format!("{phase} {:.0} of {:.0} MB", done as f64 / 1e6, total as f64 / 1e6) } else { phase.to_string() };
                    let _ = a.emit("task", json!({ "id": "roblox", "state": "run", "detail": detail, "pct": pct }));
                }
            }).await?;
            Ok(format!("Roblox {version} is ready to play"))
        }.await;
        match r {
            Ok(m) => t.send("roblox", "done", &m, 1.0),
            Err(e) => t.send("roblox", "warn", &format!("Skipped: {e}. Moony will download it when you first play."), 1.0),
        }
    }
    Ok(dir)
}

#[tauri::command]
fn info() -> Value {
    let ex = existing();
    let me = std::env::current_exe().ok();
    let uninstall = std::env::args().any(|a| a == "--uninstall") || me.as_ref().and_then(|p| p.file_name()).map(|n| n.eq_ignore_ascii_case("uninstall.exe")).unwrap_or(false);
    json!({
        "version": VERSION,
        "mode": if uninstall { "uninstall" } else { "install" },
        "dir": default_dir(),
        "existing": ex.as_ref().map(|e| e.1.clone()),
        "desktop": ex.is_none() || desktop_lnk().exists(),
        "robloxReady": rbx::list().iter().any(|v| v["complete"] == json!(true)),
    })
}

#[tauri::command]
async fn pick_dir(app: tauri::AppHandle, current: String) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    let start = PathBuf::from(&current);
    let mut d = app.dialog().file().set_title("Choose where to install Moony");
    if let Some(p) = start.parent().filter(|p| p.exists()) { d = d.set_directory(p); }
    d.pick_folder(move |f| { let _ = tx.send(f); });
    let p = rx.await.ok()??.into_path().ok()?;
    let p = if p.file_name().map(|n| n.eq_ignore_ascii_case("moony")).unwrap_or(false) { p } else { p.join("Moony") };
    Some(p.display().to_string())
}

#[tauri::command]
async fn install(app: tauri::AppHandle, opts: Opts) -> Result<String, String> {
    run_install(Tasks(Some(app)), opts).await.map(|d| d.display().to_string())
}

#[tauri::command]
fn launch(app: tauri::AppHandle, dir: String) {
    let exe = PathBuf::from(&dir).join("moony.exe");
    let _ = Command::new(&exe).current_dir(&dir).creation_flags(DETACHED).spawn();
    app.exit(0);
}

fn restore_protocols() {
    let backup: Value = dirs::data_dir().and_then(|d| std::fs::read_to_string(d.join(r"xyz.moonylauncher.moony\protocol-backup.json")).ok()).and_then(|s| serde_json::from_str(&s).ok()).unwrap_or(json!({}));
    for p in ["roblox-player", "roblox"] {
        let key = format!(r"HKCU\Software\Classes\{p}\shell\open\command");
        if !reg_get(&key, None).map(|c| c.to_lowercase().contains("moony.exe")).unwrap_or(false) { continue; }
        match backup[p].as_str() {
            Some(prev) => { let _ = hidden("reg").args(["add", &key, "/ve", "/d", prev, "/f"]).status(); }
            None => { let _ = hidden("reg").args(["delete", &key, "/ve", "/f"]).status(); }
        }
    }
}

fn run_uninstall(t: &Tasks, keep_data: bool) -> PathBuf {
    let dir = existing().map(|e| e.0).or_else(|| std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf()))).unwrap_or_else(|| local().join("Moony"));
    t.send("close", "run", "Closing Moony", 0.0);
    stop_running(&[dir.join("moony.exe")]);
    t.send("close", "done", "Moony is closed", 1.0);

    t.send("files", "run", "Removing Moony's files", 0.0);
    for _ in 0..10 { if std::fs::remove_file(dir.join("moony.exe")).is_ok() || !dir.join("moony.exe").exists() { break; } std::thread::sleep(std::time::Duration::from_millis(400)); }
    let _ = std::fs::remove_file(dir.join("moony.exe.new"));
    let _ = std::fs::remove_file(dir.join("moony.exe.old"));
    t.send("files", "done", &dir.display().to_string(), 1.0);

    t.send("shortcuts", "run", "Removing shortcuts", 0.0);
    let _ = std::fs::remove_file(desktop_lnk());
    let _ = std::fs::remove_file(start_lnk());
    t.send("shortcuts", "done", "Desktop and Start menu are clean", 1.0);

    t.send("register", "run", "Removing Moony from Windows", 0.0);
    restore_protocols();
    let _ = hidden("reg").args(["delete", UNINST, "/f"]).status();
    t.send("register", "done", "Roblox links open the normal way again", 1.0);

    if !keep_data {
        t.send("data", "run", "Deleting accounts, settings and Roblox files", 0.0);
        for d in [dirs::data_dir().map(|d| d.join("xyz.moonylauncher.moony")), Some(local().join("xyz.moonylauncher.moony")), Some(dir.join("Roblox"))].into_iter().flatten() {
            let _ = std::fs::remove_dir_all(d);
        }
        t.send("data", "done", "Everything Moony saved is gone", 1.0);
    }
    dir
}

fn self_destruct(dir: &Path) {
    let un = dir.join("uninstall.exe");
    let cmd = format!("ping -n 3 127.0.0.1 >nul & del /f /q \"{}\" & rmdir \"{}\" & rmdir /s /q \"{}\"", un.display(), dir.display(), std::env::temp_dir().join("moony-setup-webview").display());
    let _ = Command::new("cmd").raw_arg(format!("/c {cmd}")).creation_flags(NO_WINDOW | DETACHED).spawn();
}

#[tauri::command]
async fn uninstall(app: tauri::AppHandle, keep_data: bool) -> String {
    let a = app.clone();
    let dir = tokio::task::spawn_blocking(move || run_uninstall(&Tasks(Some(a)), keep_data)).await.unwrap_or_default();
    dir.display().to_string()
}

#[tauri::command]
fn finish(app: tauri::AppHandle, dir: Option<String>) {
    if let Some(d) = dir { self_destruct(Path::new(&d)); }
    app.exit(0);
}

#[tauri::command]
fn win(window: tauri::WebviewWindow, a: String) {
    if a == "min" { let _ = window.minimize(); } else { window.app_handle().exit(0); }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let silent = args.iter().any(|a| a.eq_ignore_ascii_case("/S"));
    let is_uninstaller = args.iter().any(|a| a == "--uninstall") || std::env::current_exe().ok().and_then(|p| p.file_name().map(|n| n.eq_ignore_ascii_case("uninstall.exe"))).unwrap_or(false);

    if silent {
        if is_uninstaller {
            let dir = run_uninstall(&Tasks(None), true);
            self_destruct(&dir);
            return;
        }
        let rt = tokio::runtime::Runtime::new().unwrap();
        let opts = Opts { dir: default_dir().display().to_string(), desktop: existing().is_none() || desktop_lnk().exists(), start_menu: true, roblox: false };
        if let Ok(dir) = rt.block_on(run_install(Tasks(None), opts)) {
            let _ = Command::new(dir.join("moony.exe")).current_dir(&dir).creation_flags(DETACHED).spawn();
        }
        return;
    }

    if !install_webview2(false) {
        message("Moony needs the Microsoft WebView2 runtime, and it couldn't be installed.\n\nCheck your internet connection and run Moony Setup again.");
        return;
    }
    std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", std::env::temp_dir().join("moony-setup-webview"));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![info, pick_dir, install, launch, uninstall, finish, win])
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title(if std::env::current_exe().ok().and_then(|p| p.file_name().map(|n| n.eq_ignore_ascii_case("uninstall.exe"))).unwrap_or(false) { "Uninstall Moony" } else { "Moony Setup" })
                .inner_size(880.0, 560.0)
                .resizable(false)
                .maximizable(false)
                .decorations(false)
                .shadow(false)
                .center()
                .background_color(tauri::webview::Color(10, 14, 21, 255))
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Moony Setup failed to start");
}
