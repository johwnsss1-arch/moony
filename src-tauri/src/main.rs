// Moony (Rust/Tauri edition).
//
// The React interface is the same one the Electron build used. Everything
// that touches the operating system or the network lives here in Rust:
// HTTP (with each account's Roblox cookie kept out of the web page),
// settings files, launching programs, and opening folders and links.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod boost;
mod discord;
mod flags;
mod fsx;
mod http;
mod hud;
mod media;
mod protocol;
mod rbx;
mod splash;
mod store;
mod updater;
mod vault;

use serde_json::{json, Value};
use tauri::Manager;

/// One entry point for the interface: `ipc(channel, args)`. Mirrors the
/// channel names the Electron preload used, so the UI code didn't change.
#[tauri::command]
async fn ipc(app: tauri::AppHandle, channel: String, args: Vec<Value>) -> Result<Value, String> {
    let a = |i: usize| args.get(i).cloned().unwrap_or(Value::Null);
    match channel.as_str() {
        "log" => {
            use std::io::Write;
            let p = app.path().app_data_dir().map_err(|e| e.to_string())?.join("moony.log");
            if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(p) { let _ = writeln!(f, "{}", a(0).as_str().unwrap_or_default()); }
            Ok(json!(true))
        }
        "protocol:get" => Ok(json!(protocol::is_set())),
        "protocol:set" => Ok(protocol::set(&app, a(0).as_bool().unwrap_or(false))),
        // Start the player with arguments from a roblox-player: link.
        "roblox:start-link" => {
            let o = a(0);
            let dir = std::path::PathBuf::from(o["dir"].as_str().unwrap_or_default());
            if !dir.starts_with(rbx::root()) { return Err("Unknown Roblox folder".into()); }
            let args: Vec<String> = o["args"].as_array().map(|v| v.iter().filter_map(|x| x.as_str().map(String::from)).collect()).unwrap_or_default();
            std::process::Command::new(dir.join("RobloxPlayerBeta.exe")).current_dir(&dir).args(args).spawn().map(|_| json!(true)).map_err(|e| e.to_string())
        }
        "fs:download" => fsx::download(&app, &args).await,
        c if c.starts_with("fs:") => fsx::call(&app, &c[3..], &args),
        "media:info" => Ok(tokio::task::spawn_blocking(media::info).await.unwrap_or(Value::Null)),
        "media:level" => Ok(json!(media::level())),
        "hud:enabled" => { hud::set_enabled(a(0).as_bool().unwrap_or(false)); Ok(hud::status()) }
        "hud:status" => Ok(hud::status()),
        "hud:push" => { hud::push(&app, a(0)); Ok(json!(true)) }
        "sys:usage" => Ok(hud::usage()),
        "boost:on" => Ok(tokio::task::spawn_blocking(boost::on).await.unwrap_or(Value::Null)),
        "boost:off" => Ok(tokio::task::spawn_blocking(boost::off).await.unwrap_or(Value::Null)),
        "net:ping" => Ok(json!(hud::ping().await)),
        "update:get" => Ok(updater::get(&app)),
        "update:check" => Ok(updater::check(&app).await),
        "update:apply" => Ok(json!(updater::apply(&app))),
        "app:argv" => Ok(json!(std::env::args().collect::<Vec<_>>())),
        // Feedback goes to the team's Discord webhook. The URL is baked in at
        // build time (MOONY_FEEDBACK_WEBHOOK) and isn't in the source code.
        "feedback:send" => {
            let Some(hook) = option_env!("MOONY_FEEDBACK_WEBHOOK") else { return Err("Feedback isn't set up yet. Post it in the Moony Discord instead!".into()) };
            let p = a(0);
            let kind = p["kind"].as_str().filter(|k| ["idea", "bug", "love", "source"].contains(k)).unwrap_or("idea");
            let text: String = p["text"].as_str().unwrap_or_default().replace("@everyone", "@​everyone").replace("@here", "@​here").chars().take(1500).collect();
            if text.trim().is_empty() { return Err("Empty message".into()); }
            static LAST: std::sync::Mutex<Option<std::time::Instant>> = std::sync::Mutex::new(None);
            { let mut l = LAST.lock().unwrap(); if l.map(|t| t.elapsed().as_secs() < 20).unwrap_or(false) { return Err("Please wait a few seconds before sending again.".into()); } *l = Some(std::time::Instant::now()); }
            let label = match kind { "bug" => "🐛 Bug", "love" => "💜 Love", "source" => "📍 Found Moony via", _ => "💡 Idea" };
            let body = json!({ "username": "Moony Feedback", "allowed_mentions": { "parse": [] }, "embeds": [{ "title": label, "description": text, "color": 0x8b7dff, "footer": { "text": format!("Moony {}", app.package_info().version) } }] });
            let r = reqwest::Client::new().post(hook).json(&body).send().await.map_err(|e| e.to_string())?;
            if !r.status().is_success() { return Err("Couldn't send feedback. Try again later.".into()); }
            Ok(json!(true))
        }
        "app:version" => Ok(json!(app.package_info().version.to_string())),
        "http" => http::request(&app, a(0)).await,
        "store:get" => store::get(&app, a(0).as_str().unwrap_or_default()),
        "store:set" => store::set(&app, a(0).as_str().unwrap_or_default(), a(1)),
        "open:url" => {
            let url = a(0).as_str().unwrap_or_default().to_string();
            if !url.starts_with("https://") && !url.starts_with("roblox:") && !url.starts_with("roblox-player:") {
                return Err("Only https and Roblox links can be opened".into());
            }
            open_detached("cmd", &["/C", "start", "", &url]).map(|_| json!(true))
        }
        "open:path" => {
            let p = a(0).as_str().unwrap_or_default().to_string();
            open_detached("explorer", &[&p]).map(|_| json!(true))
        }
        // Roblox install + launch. Prefs for pinned version/channel live in versions.json.
        "roblox:ensure" => {
            let prefs = store::get(&app, "versions").unwrap_or(Value::Null);
            let r = rbx::ensure(&app, prefs["pinned"].as_str().map(String::from), prefs["channel"].as_str().map(String::from)).await;
            if r.is_ok() { flags::reapply(&app); }
            r
        }
        "roblox:start" => {
            let o = a(0);
            let dir = std::path::PathBuf::from(o["dir"].as_str().unwrap_or_default());
            if !dir.starts_with(rbx::root()) { return Err("Unknown Roblox folder".into()); }
            rbx::launch(&dir, o["ticket"].as_str().unwrap_or_default(), o["launcherUrl"].as_str().unwrap_or_default(), o["tracker"].as_str().unwrap_or_default()).map(|_| json!(true))
        }
        "versions:info" => {
            let prefs = store::get(&app, "versions").unwrap_or(Value::Null);
            let ch = a(0).as_str().map(String::from).or(prefs["channel"].as_str().map(String::from));
            let (latest, error) = match rbx::latest(ch.as_deref()).await { Ok((g, v)) => (json!({ "guid": g, "version": v }), Value::Null), Err(e) => (Value::Null, json!(e)) };
            Ok(json!({ "latest": latest, "error": error, "pinned": prefs["pinned"], "channel": prefs["channel"].as_str().unwrap_or("production"), "installed": rbx::list(), "folder": rbx::root() }))
        }
        "versions:install" => {
            let guid = a(0).as_str().unwrap_or_default().trim().to_lowercase();
            let app2 = app.clone(); let g2 = guid.clone();
            let r = rbx::install(&guid, &guid, true, move |phase, done, total| { let _ = tauri::Emitter::emit(&app2, "versions:progress", json!({ "guid": g2, "phase": phase, "done": done, "total": total })); }).await;
            let _ = tauri::Emitter::emit(&app, "versions:progress", json!({ "guid": guid, "phase": if r.is_ok() { "done" } else { "error" } }));
            Ok(match r { Ok(_) => json!({ "ok": true, "list": rbx::list() }), Err(e) => json!({ "ok": false, "error": e }) })
        }
        "versions:remove" => {
            let g = a(0).as_str().unwrap_or_default().to_string();
            let mut p = store::get(&app, "versions").unwrap_or(json!({}));
            if p["pinned"] == json!(g) { p["pinned"] = Value::Null; let _ = store::set(&app, "versions", p); }
            Ok(json!({ "ok": rbx::remove(&g), "list": rbx::list() }))
        }
        "versions:pin" | "versions:channel" => {
            let mut p = store::get(&app, "versions").ok().filter(|v| v.is_object()).unwrap_or(json!({}));
            if channel == "versions:pin" {
                let g = a(0).as_str().map(|s| s.to_lowercase());
                if let Some(g) = &g { if !rbx::valid_guid(g) { return Ok(json!({ "ok": false, "error": "Not a version hash" })); } }
                p["pinned"] = json!(g);
            } else {
                let c = a(0).as_str().unwrap_or("production").trim().to_string();
                p["channel"] = json!(if c.eq_ignore_ascii_case("live") { "production".to_string() } else { c });
            }
            store::set(&app, "versions", p.clone())?;
            Ok(json!({ "ok": true, "prefs": p }))
        }
        "versions:open" => {
            let g = a(0).as_str().unwrap_or_default().to_string();
            if !rbx::valid_guid(&g) { return Ok(json!(false)); }
            let dir = rbx::root().join(&g).to_string_lossy().to_string();
            open_detached("explorer", &[&dir]).map(|_| json!(true))
        }
        "fflags:get" => Ok(flags::status(&app)),
        "fflags:set" => flags::set(&app, a(0)),
        "fflags:presets" => Ok(flags::presets().await),
        // Newest Roblox player log: returns the text added since `offset`.
        "rlog:read" => Ok(read_log(a(0).as_str(), a(1).as_i64().unwrap_or(-1))),
        "proc:running" => Ok(json!(process_running(a(0).as_str().unwrap_or("RobloxPlayerBeta.exe")))),
        "proc:kill-roblox" => { let _ = open_detached("taskkill", &["/IM", "RobloxPlayerBeta.exe", "/F"]); Ok(json!(true)) }
        "discord:configure" => {
            let p = a(0);
            let id = if p["enabled"] == json!(true) { p["clientId"].as_str().map(String::from) } else { None };
            Ok(json!(tokio::task::spawn_blocking(move || discord::configure(id)).await.unwrap_or("unavailable")))
        }
        "discord:status" => Ok(json!(discord::status())),
        "discord:set" => { let v = a(0); let _ = tokio::task::spawn_blocking(move || discord::set(&v)).await; Ok(json!(true)) }
        "splash:open" => splash::open(&app, a(0).as_str().unwrap_or("#8b7dff"), a(1).as_str().unwrap_or("")).map(|_| json!(true)),
        "splash:set" => { splash::set(&app, &a(0)); Ok(json!(true)) }
        "splash:close" => { splash::close(&app, a(0).as_u64().unwrap_or(0)); Ok(json!(true)) }
        "splash:cancel" => { splash::cancel(&app); Ok(json!(true)) }
        "splash:cancelled" => Ok(json!(splash::CANCELLED.load(std::sync::atomic::Ordering::SeqCst))),
        "ui:radius" => { let r = a(0).as_u64().unwrap_or(16).min(40) as i32; RADIUS.store(r, std::sync::atomic::Ordering::SeqCst); if let Some(w) = app.get_webview_window("main") { round(&w); } Ok(json!(true)) }
        "auth:login" => auth::login(&app).await,
        "vault:import" => Ok(json!(vault::import_electron(&app))),
        "vault:accounts" => Ok(json!(vault::accounts(&app))),
        "vault:remove" => { vault::remove(&app, a(0).as_u64().unwrap_or(0)); Ok(json!(true)) }
        _ => Err(format!("{channel} isn't available in this build yet")),
    }
}

/* Rounded corners: Windows 11 rounds Moony's window itself. Windows 10
   doesn't, so the window is clipped to a rounded rectangle (redone on resize;
   square when maximized). */
static RADIUS: std::sync::atomic::AtomicI32 = std::sync::atomic::AtomicI32::new(16);
#[cfg(windows)]
fn round(w: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{CreateRoundRectRgn, SetWindowRgn, HRGN};
    static BUILD: std::sync::OnceLock<u32> = std::sync::OnceLock::new();
    let build = *BUILD.get_or_init(|| { let mut c = std::process::Command::new("cmd"); c.args(["/c", "ver"]); { use std::os::windows::process::CommandExt; c.creation_flags(0x0800_0000); } let v = c.output().ok().map(|o| String::from_utf8_lossy(&o.stdout).to_string()).unwrap_or_default(); v.split('.').nth(2).and_then(|x| x.trim_end_matches(']').trim().parse().ok()).unwrap_or(0) });
    if build >= 22000 { return; }
    // Square corners (by request): clear any rounded region.
    if let Ok(h) = w.hwnd() { unsafe { let _ = SetWindowRgn(HWND(h.0 as _), HRGN::default(), true); } }
    return;
    #[allow(unreachable_code)]
    let Ok(h) = w.hwnd() else { return };
    let hwnd = HWND(h.0 as _);
    let max = w.is_maximized().unwrap_or(false) || w.is_fullscreen().unwrap_or(false);
    let size = w.outer_size().unwrap_or_default();
    let r = (RADIUS.load(std::sync::atomic::Ordering::SeqCst) as f64 * w.scale_factor().unwrap_or(1.0)).round() as i32;
    unsafe {
        if max || r <= 0 { let _ = SetWindowRgn(hwnd, HRGN::default(), true); return; }
        let rgn = CreateRoundRectRgn(0, 0, size.width as i32 + 1, size.height as i32 + 1, r * 2, r * 2);
        let _ = SetWindowRgn(hwnd, rgn, true);
    }
}
#[cfg(not(windows))]
fn round(_w: &tauri::WebviewWindow) {}

fn read_log(prev: Option<&str>, offset: i64) -> Value {
    use std::io::{Read, Seek, SeekFrom};
    let dir = dirs::data_local_dir().unwrap_or_default().join("Roblox").join("logs");
    let Ok(rd) = std::fs::read_dir(&dir) else { return Value::Null };
    let latest = rd.flatten()
        .filter(|e| { let n = e.file_name().to_string_lossy().to_string(); n.ends_with(".log") && n.contains("_Player_") && !n.contains("CrashHandler") })
        .max_by_key(|e| e.metadata().and_then(|m| m.modified()).ok());
    let Some(f) = latest else { return Value::Null };
    let path = f.path().to_string_lossy().to_string();
    let size = f.metadata().map(|m| m.len()).unwrap_or(0) as i64;
    let mut from = if prev == Some(path.as_str()) { offset.max(0) } else if offset < 0 { size } else { 0 };
    if from > size { from = 0; }
    let mut text = String::new();
    if size > from {
        if let Ok(mut fh) = std::fs::File::open(&path) {
            let len = ((size - from) as usize).min(2 * 1024 * 1024);
            let mut buf = vec![0u8; len];
            if fh.seek(SeekFrom::Start(from as u64)).is_ok() && fh.read_exact(&mut buf).is_ok() { text = String::from_utf8_lossy(&buf).into_owned(); from += len as i64; }
        }
    }
    json!({ "file": path, "size": size, "offset": from, "text": text })
}

fn process_running(name: &str) -> bool {
    use std::process::Command;
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;
    let mut c = Command::new("tasklist");
    c.args(["/FI", &format!("IMAGENAME eq {name}"), "/NH"]);
    #[cfg(windows)]
    c.creation_flags(0x0800_0000);
    c.output().map(|o| String::from_utf8_lossy(&o.stdout).to_lowercase().contains(&name.to_lowercase())).unwrap_or(false)
}

fn open_detached(cmd: &str, args: &[&str]) -> Result<(), String> {
    use std::process::Command;
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;
    let mut c = Command::new(cmd);
    c.args(args);
    #[cfg(windows)]
    c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    c.spawn().map(|_| ()).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        // Only one Moony: a second start (e.g. a Roblox link opened with Moony)
        // hands its arguments to the running one.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") { let _ = w.unminimize(); let _ = w.show(); let _ = w.set_focus(); }
            let _ = tauri::Emitter::emit(app, "app:argv", argv);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            hud::start(app.handle().clone());
            if let Some(w) = app.get_webview_window("main") {
                round(&w);
                let w2 = w.clone();
                w.on_window_event(move |e| if matches!(e, tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. }) { round(&w2); });
            }
            updater::start(app.handle().clone());
            #[cfg(debug_assertions)]
            if std::env::var("MOONY_DEVTOOLS").is_ok() { if let Some(w) = app.get_webview_window("main") { w.open_devtools(); } }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ipc])
        .build(tauri::generate_context!())
        .expect("Moony failed to start")
        .run(|_, e| if let tauri::RunEvent::Exit = e { boost::off(); });
}
