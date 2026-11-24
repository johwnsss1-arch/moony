use serde_json::{json, Map, Value};

fn player_dir() -> Option<std::path::PathBuf> {
    crate::rbx::list().into_iter().find(|v| v["complete"] == json!(true)).and_then(|v| v["dir"].as_str().map(Into::into))
}

pub fn status(app: &tauri::AppHandle) -> Value {
    let s = crate::store::get(app, "fflags").unwrap_or(Value::Null);
    let dir = player_dir();
    let ver = dir.as_ref().and_then(|d| d.file_name()).map(|n| n.to_string_lossy().to_string());
    json!({ "flags": s.get("flags").cloned().unwrap_or(json!({})), "installed": dir.is_some(), "version": ver, "upToDate": ver.is_some() && s["appliedVersion"].as_str() == ver.as_deref() })
}

pub fn set(app: &tauri::AppHandle, flags: Value) -> Result<Value, String> {
    let obj = flags.as_object().ok_or("Invalid flags")?;
    let mut clean = Map::new();
    for (k, v) in obj {
        let ok_name = k.len() >= 3 && k.len() <= 101 && k.chars().next().map(|c| c.is_ascii_alphabetic()).unwrap_or(false) && k.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
        if !ok_name { return Err(format!("Invalid flag name: {k}")); }
        if !(v.is_string() || v.is_number() || v.is_boolean()) { return Err(format!("Invalid value for {k}")); }
        clean.insert(k.clone(), v.clone());
    }
    let mut s = json!({ "flags": clean });
    write(&mut s)?;
    crate::store::set(app, "fflags", s)?;
    Ok(status(app))
}

pub fn reapply(app: &tauri::AppHandle) {
    let mut s = crate::store::get(app, "fflags").unwrap_or(Value::Null);
    if s["flags"].as_object().map(|o| o.is_empty()).unwrap_or(true) { return; }
    if write(&mut s).is_ok() { let _ = crate::store::set(app, "fflags", s); }
}

fn write(s: &mut Value) -> Result<(), String> {
    let dir = player_dir().ok_or("Roblox Player isn't installed")?;
    let folder = dir.join("ClientSettings");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    std::fs::write(folder.join("ClientAppSettings.json"), serde_json::to_vec_pretty(&s["flags"]).unwrap()).map_err(|e| e.to_string())?;
    s["appliedVersion"] = json!(dir.file_name().unwrap().to_string_lossy());
    Ok(())
}

pub async fn presets() -> Value {
    let online = async {
        let r = reqwest::Client::new().get("https://moonylauncher.xyz/fflags.json").timeout(std::time::Duration::from_secs(6)).send().await.ok()?;
        let v: Value = r.json().await.ok()?;
        v["presets"].is_array().then_some(v)
    }.await;
    match online {
        Some(mut v) => { v["online"] = json!(true); v }
        None => { let mut v: Value = serde_json::from_str(include_str!("fflag-presets.json")).unwrap_or(json!({ "presets": [] })); v["online"] = json!(false); v }
    }
}
