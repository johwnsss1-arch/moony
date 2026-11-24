use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Mutex;
use tauri::Emitter;

const FEED: &str = "https://github.com/johwnsss1-arch/moony/releases/latest/download/latest.json";
static STATE: Mutex<Option<Value>> = Mutex::new(None);
static FILE: Mutex<Option<std::path::PathBuf>> = Mutex::new(None);

fn newer(a: &str, b: &str) -> bool {
    let p = |s: &str| s.split('.').map(|x| x.parse::<u64>().unwrap_or(0)).collect::<Vec<_>>();
    let (x, y) = (p(a), p(b));
    for i in 0..3 { let (m, n) = (*x.get(i).unwrap_or(&0), *y.get(i).unwrap_or(&0)); if m != n { return m > n; } }
    false
}

fn set(app: &tauri::AppHandle, patch: Value) -> Value {
    let mut g = STATE.lock().unwrap();
    let mut s = g.clone().unwrap_or(json!({ "status": "idle", "current": app.package_info().version.to_string() }));
    for (k, v) in patch.as_object().unwrap() { s[k] = v.clone(); }
    *g = Some(s.clone());
    let _ = app.emit("update:state", s.clone());
    s
}
pub fn get(app: &tauri::AppHandle) -> Value { STATE.lock().unwrap().clone().unwrap_or(json!({ "status": "idle", "current": app.package_info().version.to_string() })) }

pub async fn check(app: &tauri::AppHandle) -> Value {
    if cfg!(debug_assertions) { return set(app, json!({ "status": "disabled" })); }
    let st = get(app);
    if st["status"] == "downloading" || st["status"] == "ready" { return st; }
    set(app, json!({ "status": "checking", "error": null }));
    let r: Result<Value, String> = async {
        let c = reqwest::Client::new();
        let feed: Value = c.get(format!("{FEED}?t={}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs())).send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
        let ver = feed["version"].as_str().unwrap_or_default();
        if ver.is_empty() || !newer(ver, &app.package_info().version.to_string()) { return Ok(json!({ "status": "latest" })); }
        let url = feed["url"].as_str().unwrap_or_default();
        if !url.starts_with("https://github.com/johwnsss1-arch/moony/releases/download/") { return Err("Unexpected download address".into()); }
        set(app, json!({ "status": "downloading", "version": ver, "notes": feed["notes"] }));
        let bytes = c.get(url).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
        let hash = format!("{:x}", Sha256::digest(&bytes));
        if let Some(want) = feed["sha256"].as_str() { if !want.eq_ignore_ascii_case(&hash) { return Err("Download was corrupted (checksum mismatch)".into()); } }
        let path = std::env::temp_dir().join(format!("Moony-Setup-{ver}.exe"));
        std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
        *FILE.lock().unwrap() = Some(path);
        Ok(json!({ "status": "ready", "version": ver }))
    }.await;
    match r { Ok(v) => set(app, v), Err(e) => set(app, json!({ "status": "error", "error": e })) }
}

pub fn apply(app: &tauri::AppHandle) -> bool {
    let Some(f) = FILE.lock().unwrap().clone() else { return false };
    if std::process::Command::new(f).arg("/S").spawn().is_ok() { app.exit(0); true } else { false }
}

pub fn start(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        loop { check(&app).await; tokio::time::sleep(std::time::Duration::from_secs(6 * 3600)).await; }
    });
}
