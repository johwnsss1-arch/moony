// Moony's own Roblox install (port of electron/rbxinstall.cjs): reads the
// latest version from Roblox, downloads its packages from setup.rbxcdn.com,
// checks each MD5, unpacks them into %LOCALAPPDATA%\Moony\Roblox\<version>,
// then starts RobloxPlayerBeta.exe directly.
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::Emitter;

const CDN: &str = "https://setup.rbxcdn.com";
const DIRS: &[(&str, &str)] = &[
    ("RobloxApp.zip", ""), ("redist.zip", ""), ("shaders.zip", "shaders/"), ("ssl.zip", "ssl/"), ("WebView2.zip", ""),
    ("WebView2RuntimeInstaller.zip", "WebView2RuntimeInstaller/"),
    ("content-avatar.zip", "content/avatar/"), ("content-configs.zip", "content/configs/"), ("content-fonts.zip", "content/fonts/"),
    ("content-sky.zip", "content/sky/"), ("content-sounds.zip", "content/sounds/"), ("content-textures2.zip", "content/textures/"),
    ("content-models.zip", "content/models/"), ("content-platform-fonts.zip", "PlatformContent/pc/fonts/"),
    ("content-platform-dictionaries.zip", "PlatformContent/pc/shared_compression_dictionaries/"),
    ("content-terrain.zip", "PlatformContent/pc/terrain/"), ("content-textures3.zip", "PlatformContent/pc/textures/"),
    ("extracontent-luapackages.zip", "ExtraContent/LuaPackages/"), ("extracontent-translations.zip", "ExtraContent/translations/"),
    ("extracontent-models.zip", "ExtraContent/models/"), ("extracontent-textures.zip", "ExtraContent/textures/"),
    ("extracontent-places.zip", "ExtraContent/places/"),
];
const APP_SETTINGS: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n<Settings>\r\n\t<ContentFolder>content</ContentFolder>\r\n\t<BaseUrl>http://www.roblox.com</BaseUrl>\r\n</Settings>\r\n";

// Roblox lives in Moony's data folder, not next to the app, so reinstalling
// or uninstalling Moony never touches it. Moony 1.x kept it in
// %LOCALAPPDATA%MoonyRoblox; that copy is moved over once (no re-download).
pub fn root() -> PathBuf {
    let local = dirs::data_local_dir().unwrap_or_default();
    let new = local.join("xyz.moonylauncher.moony").join("Roblox");
    static MOVED: std::sync::Once = std::sync::Once::new();
    MOVED.call_once(|| {
        let old = local.join("Moony").join("Roblox");
        if !new.exists() && old.exists() {
            if let Some(p) = new.parent() { let _ = std::fs::create_dir_all(p); }
            let _ = std::fs::rename(&old, &new);
        }
    });
    new
}
pub fn valid_guid(g: &str) -> bool { g.len() == 24 && g.starts_with("version-") && g[8..].chars().all(|c| c.is_ascii_hexdigit()) }

pub async fn latest(channel: Option<&str>) -> Result<(String, String), String> {
    let ch = match channel { Some(c) if !c.is_empty() && c != "production" && c.chars().all(|x| x.is_ascii_alphanumeric() || x == '_' || x == '-') => format!("/channel/{c}"), _ => String::new() };
    let v: Value = reqwest::get(format!("https://clientsettings.roblox.com/v2/client-version/WindowsPlayer{ch}")).await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    Ok((v["clientVersionUpload"].as_str().unwrap_or_default().to_lowercase(), v["version"].as_str().unwrap_or_default().to_string()))
}

pub fn installed(guid: &str) -> Option<PathBuf> {
    let d = root().join(guid);
    (d.join("RobloxPlayerBeta.exe").exists() && d.join(".moony-complete").exists()).then_some(d)
}

pub fn list() -> Vec<Value> {
    let Ok(rd) = std::fs::read_dir(root()) else { return vec![] };
    let mut out: Vec<(f64, Value)> = rd.flatten().filter_map(|e| {
        let guid = e.file_name().to_string_lossy().to_string();
        if !valid_guid(&guid) { return None; }
        let done = e.path().join(".moony-complete");
        let version = std::fs::read_to_string(&done).ok().map(|s| s.trim().to_string());
        let at = std::fs::metadata(&done).and_then(|m| m.modified()).ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis() as f64).unwrap_or(0.0);
        Some((at, json!({ "guid": guid, "version": version, "complete": version.is_some(), "keep": e.path().join(".moony-keep").exists(), "at": at, "dir": e.path() })))
    }).collect();
    out.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    out.into_iter().map(|x| x.1).collect()
}

pub fn remove(guid: &str) -> bool { valid_guid(guid) && std::fs::remove_dir_all(root().join(guid)).is_ok() }

struct Pkg { name: String, md5: String, packed: u64 }

async fn manifest(guid: &str) -> Result<Vec<Pkg>, String> {
    let t = reqwest::get(format!("{CDN}/{guid}-rbxPkgManifest.txt")).await.map_err(|e| e.to_string())?.text().await.map_err(|e| e.to_string())?;
    let lines: Vec<&str> = t.lines().collect();
    let mut out = vec![];
    let mut i = 1;
    while i + 3 < lines.len() {
        let name = lines[i].trim();
        if DIRS.iter().any(|(n, _)| *n == name) {
            out.push(Pkg { name: name.into(), md5: lines[i + 1].trim().to_lowercase(), packed: lines[i + 2].trim().parse().unwrap_or(0) });
        }
        i += 4;
    }
    if !out.iter().any(|p| p.name == "RobloxApp.zip") { return Err("Roblox's package list looks incomplete".into()); }
    Ok(out)
}

fn extract(buf: &[u8], dest: &Path, sub: &str) -> Result<(), String> {
    let mut z = zip::ZipArchive::new(std::io::Cursor::new(buf)).map_err(|e| e.to_string())?;
    let base = dest.canonicalize().map_err(|e| e.to_string())?;
    for i in 0..z.len() {
        let mut f = z.by_index(i).map_err(|e| e.to_string())?;
        let name = f.name().replace('\\', "/");
        if name.ends_with('/') || name.is_empty() || name.contains("..") { continue; }
        let target = dest.join(format!("{sub}{name}"));
        if !target.starts_with(dest) && !target.starts_with(&base) { continue; }
        if let Some(p) = target.parent() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
        let mut data = Vec::with_capacity(f.size() as usize);
        f.read_to_end(&mut data).map_err(|e| e.to_string())?;
        std::fs::write(&target, data).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Download + unpack one version. `progress` gets (phase, done, total).
pub async fn install<F: Fn(&str, u64, u64) + Send + Sync + 'static>(guid: &str, label: &str, keep: bool, progress: F) -> Result<PathBuf, String> {
    if !valid_guid(guid) { return Err("That isn't a Roblox version hash (version-xxxxxxxxxxxxxxxx)".into()); }
    if let Some(d) = installed(guid) { return Ok(d); }
    progress("Checking Roblox's files…", 0, 0);
    let pkgs = manifest(guid).await?;
    let total: u64 = pkgs.iter().map(|p| p.packed).sum();
    let dest = root().join(guid);
    let _ = std::fs::remove_dir_all(&dest);
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    let done = Arc::new(AtomicU64::new(0));
    let progress = Arc::new(progress);
    let client = reqwest::Client::new();
    // Six downloads at a time; each package is unpacked as soon as it lands.
    let results = futures_util::stream::iter(pkgs.into_iter().map(|p| {
        let (client, done, progress, dest, guid) = (client.clone(), done.clone(), progress.clone(), dest.clone(), guid.to_string());
        async move {
            let sub = DIRS.iter().find(|(n, _)| *n == p.name).map(|(_, s)| *s).unwrap_or("");
            let mut last_err = String::new();
            for attempt in 0..3u64 {
                let r = async {
                    let res = client.get(format!("{CDN}/{guid}-{}", p.name)).send().await.map_err(|e| e.to_string())?;
                    if !res.status().is_success() { return Err(format!("HTTP {}", res.status())); }
                    let mut buf = Vec::with_capacity(p.packed as usize);
                    let mut s = res.bytes_stream();
                    while let Some(chunk) = s.next().await {
                        let c = chunk.map_err(|e| e.to_string())?;
                        let d = done.fetch_add(c.len() as u64, Ordering::Relaxed) + c.len() as u64;
                        progress("Downloading Roblox…", d, total);
                        buf.extend_from_slice(&c);
                    }
                    if format!("{:x}", md5::compute(&buf)) != p.md5 { return Err("checksum mismatch".to_string()); }
                    let (dest, sub) = (dest.clone(), sub.to_string());
                    tokio::task::spawn_blocking(move || extract(&buf, &dest, &sub)).await.map_err(|e| e.to_string())?
                }.await;
                match r { Ok(()) => return Ok(()), Err(e) => { last_err = e; tokio::time::sleep(std::time::Duration::from_millis(1500 * (attempt + 1))).await; } }
            }
            Err(format!("Couldn't download {}: {last_err}", p.name))
        }
    })).buffer_unordered(6).collect::<Vec<_>>().await;
    if let Some(Err(e)) = results.into_iter().find(|r| r.is_err()) { return Err(e); }
    progress("Finishing install…", total, total);
    std::fs::write(dest.join("AppSettings.xml"), APP_SETTINGS).map_err(|e| e.to_string())?;
    if keep { let _ = std::fs::write(dest.join(".moony-keep"), "1"); }
    std::fs::write(dest.join(".moony-complete"), label).map_err(|e| e.to_string())?;
    Ok(dest)
}

/// The version Moony should launch (pinned, or the latest), installed.
pub async fn ensure(app: &tauri::AppHandle, pinned: Option<String>, channel: Option<String>) -> Result<Value, String> {
    let emit = { let app = app.clone(); move |phase: &str, done: u64, total: u64| { let _ = app.emit("launch:progress", json!({ "phase": phase, "done": done, "total": total })); } };
    if let Some(p) = pinned.filter(|p| valid_guid(p)) {
        let dir = install(&p, &p, true, emit).await?;
        return Ok(json!({ "dir": dir, "version": p, "guid": p, "pinned": true, "channel": channel.unwrap_or("production".into()) }));
    }
    let (guid, version) = match latest(channel.as_deref()).await {
        Ok(v) => v,
        Err(e) => {
            // Offline: use whatever is installed.
            let any = list().into_iter().find(|v| v["complete"].as_bool() == Some(true));
            return any.map(|v| json!({ "dir": v["dir"], "version": v["version"], "offline": true })).ok_or(e);
        }
    };
    let fresh = installed(&guid).is_none();
    let dir = install(&guid, &version, false, emit).await?;
    if fresh { for v in list() { if v["guid"] != json!(guid) && v["keep"] != json!(true) { remove(v["guid"].as_str().unwrap_or_default()); } } }
    Ok(json!({ "dir": dir, "version": version, "guid": guid, "updated": fresh, "channel": channel.unwrap_or("production".into()) }))
}

/// Start the player with a one-time sign-in ticket (what roblox.com's Play button does).
pub fn launch(dir: &Path, ticket: &str, launcher_url: &str, tracker: &str) -> Result<(), String> {
    let exe = dir.join("RobloxPlayerBeta.exe");
    if !exe.exists() { return Err("Roblox Player not found".into()); }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    std::process::Command::new(exe).current_dir(dir)
        .args(["--app", "-t", ticket, "-j", launcher_url, "-b", tracker, &format!("--launchtime={now}"), "--rloc", "en_us", "--gloc", "en_us"])
        .spawn().map(|_| ()).map_err(|e| e.to_string())
}
