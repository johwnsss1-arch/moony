// Limited file access for the page: only inside Moony's Roblox install and
// Moony's own data folder (used by Mods). Paths outside those are refused.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tauri::Manager;

fn roots(app: &tauri::AppHandle) -> Vec<PathBuf> {
    vec![crate::rbx::root(), app.path().app_data_dir().unwrap_or_default().join("mods")]
}
fn check(app: &tauri::AppHandle, p: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(p);
    if p.contains("..") || !roots(app).iter().any(|r| path.starts_with(r)) { return Err("That file is outside Moony's folders".into()); }
    Ok(path)
}

pub fn call(app: &tauri::AppHandle, op: &str, a: &[Value]) -> Result<Value, String> {
    let s = |i: usize| a.get(i).and_then(|v| v.as_str()).unwrap_or_default().to_string();
    match op {
        "roots" => Ok(json!({ "roblox": crate::rbx::root(), "mods": roots(app)[1] })),
        "exists" => Ok(json!(check(app, &s(0))?.exists())),
        "readdir" => Ok(json!(std::fs::read_dir(check(app, &s(0))?).map(|r| r.flatten().map(|e| e.file_name().to_string_lossy().to_string()).collect::<Vec<_>>()).unwrap_or_default())),
        "read" => Ok(json!(B64.encode(std::fs::read(check(app, &s(0))?).map_err(|e| e.to_string())?))),
        "readText" => Ok(json!(std::fs::read_to_string(check(app, &s(0))?).map_err(|e| e.to_string())?)),
        "write" => { let p = check(app, &s(0))?; mk(&p)?; std::fs::write(p, B64.decode(s(1)).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?; Ok(json!(true)) }
        "writeText" => { let p = check(app, &s(0))?; mk(&p)?; std::fs::write(p, s(1)).map_err(|e| e.to_string())?; Ok(json!(true)) }
        "copy" => { let (f, t) = (check(app, &s(0))?, check(app, &s(1))?); mk(&t)?; std::fs::copy(f, t).map_err(|e| e.to_string())?; Ok(json!(true)) }
        "rm" => { let _ = std::fs::remove_file(check(app, &s(0))?); Ok(json!(true)) }
        // Copy a file the user picked (any location) into the mods folder.
        "import" => {
            let src = PathBuf::from(s(0));
            let dest = check(app, &s(1))?;
            let len = std::fs::metadata(&src).map_err(|e| e.to_string())?.len();
            if len > 20 * 1024 * 1024 { return Err("File is too large".into()); }
            mk(&dest)?; std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
            Ok(json!(src.file_name().map(|n| n.to_string_lossy().to_string())))
        }
        _ => Err("unknown file operation".into()),
    }
}
fn mk(p: &Path) -> Result<(), String> { if let Some(d) = p.parent() { std::fs::create_dir_all(d).map_err(|e| e.to_string())?; } Ok(()) }

/// Download a preset from Moony's website into the mods folder.
pub async fn download(app: &tauri::AppHandle, a: &[Value]) -> Result<Value, String> {
    let s = |i: usize| a.get(i).and_then(|v| v.as_str()).unwrap_or_default().to_string();
    let url = s(0);
    if !url.starts_with("https://moonylauncher.xyz/") { return Err("Only Moony's own presets can be downloaded".into()); }
    let dest = check(app, &s(1))?;
    let bytes = reqwest::get(&url).await.map_err(|e| e.to_string())?.error_for_status().map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() > 5 * 1024 * 1024 { return Err("File is too large".into()); }
    mk(&dest)?; std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    Ok(json!(true))
}
