// Small JSON files in %APPDATA%\xyz.moonylauncher.moony (settings, playtime,
// versions...). Names are restricted so the page can't touch other files.
use serde_json::Value;
use std::path::PathBuf;
use tauri::Manager;

fn path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    if name.is_empty() || name.len() > 64 || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("bad store name".into());
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(format!("{name}.json")))
}

pub fn get(app: &tauri::AppHandle, name: &str) -> Result<Value, String> {
    let p = path(app, name)?;
    match std::fs::read_to_string(&p) {
        Ok(s) => Ok(serde_json::from_str(&s).unwrap_or(Value::Null)),
        Err(_) => Ok(Value::Null),
    }
}

pub fn set(app: &tauri::AppHandle, name: &str, v: Value) -> Result<Value, String> {
    let p = path(app, name)?;
    let tmp = p.with_extension("tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(&v).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &p).map_err(|e| e.to_string())?;
    Ok(Value::Bool(true))
}
