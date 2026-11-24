// Sign in: Roblox's own login page in a separate, private window. You type
// your password into Roblox, never into Moony. When Roblox sets its session
// cookie, Rust reads it, checks who it belongs to, stores it encrypted (see
// vault.rs) and closes the window.
use serde_json::{json, Value};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

pub async fn login(app: &tauri::AppHandle) -> Result<Value, String> {
    if let Some(w) = app.get_webview_window("login") {
        let _ = w.set_focus();
        return Ok(json!({ "ok": false, "error": "A sign-in window is already open" }));
    }
    let url: tauri::Url = "https://www.roblox.com/login".parse().unwrap();
    let win = WebviewWindowBuilder::new(app, "login", WebviewUrl::External(url))
        .title("Sign in to Roblox")
        .inner_size(480.0, 720.0)
        .center()
        .incognito(true)
        // Keep the window on Roblox's own sites.
        .on_navigation(|u| u.scheme() == "https" && u.host_str().map(|h| h == "roblox.com" || h.ends_with(".roblox.com")).unwrap_or(false))
        .build()
        .map_err(|e| e.to_string())?;

    let target: tauri::Url = "https://www.roblox.com/".parse().unwrap();
    for _ in 0..900 {
        tokio::time::sleep(std::time::Duration::from_millis(800)).await;
        // Closed by the user?
        if app.get_webview_window("login").is_none() {
            return Ok(json!({ "ok": false, "cancelled": true }));
        }
        let cookies = match win.cookies_for_url(target.clone()) { Ok(c) => c, Err(_) => continue };
        let Some(c) = cookies.iter().find(|c| c.name() == ".ROBLOSECURITY" && !c.value().is_empty()) else { continue };
        let cookie = c.value().to_string();
        let _ = win.close();
        return match whoami(&cookie).await {
            Ok((id, name, display)) => {
                if !crate::vault::add(app, id, &name, &display, &cookie, None) {
                    return Ok(json!({ "ok": false, "error": "Couldn't store the session securely on this PC" }));
                }
                Ok(json!({ "ok": true, "id": id }))
            }
            Err(e) => Ok(json!({ "ok": false, "error": e })),
        };
    }
    let _ = win.close();
    Ok(json!({ "ok": false, "error": "Sign-in timed out" }))
}

async fn whoami(cookie: &str) -> Result<(u64, String, String), String> {
    let res = reqwest::Client::new()
        .get("https://users.roblox.com/v1/users/authenticated")
        .header("cookie", format!(".ROBLOSECURITY={cookie}"))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() { return Err(format!("Couldn't verify the account ({})", res.status())); }
    let v: Value = res.json().await.map_err(|e| e.to_string())?;
    Ok((v["id"].as_u64().unwrap_or(0), v["name"].as_str().unwrap_or_default().into(), v["displayName"].as_str().unwrap_or_default().into()))
}
