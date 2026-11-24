// The bootstrapper window shown while a game launches (channel, version,
// progress, Cancel). A small transparent window running public/splash.html;
// state is pushed in with eval so the page needs no permissions.
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

pub static CANCELLED: AtomicBool = AtomicBool::new(false);

pub fn open(app: &tauri::AppHandle, accent: &str, opts: &str) -> Result<(), String> {
    // Extra look options from the page, already URL-encoded; anything else is dropped.
    let opts: String = opts.chars().filter(|c| c.is_ascii_alphanumeric() || "-_.~%=&".contains(*c)).take(600).collect();
    CANCELLED.store(false, Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("splash") { let _ = w.close(); }
    let accent = if accent.len() == 7 && accent.starts_with('#') && accent[1..].chars().all(|c| c.is_ascii_hexdigit()) { accent.to_string() } else { "#8b7dff".into() };
    WebviewWindowBuilder::new(app, "splash", WebviewUrl::App(format!("splash.html?accent={}&{}", accent.replace('#', "%23"), opts).into()))
        .title("Moony")
        .inner_size(440.0, 330.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .center()
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

pub fn set(app: &tauri::AppHandle, state: &Value) {
    if let Some(w) = app.get_webview_window("splash") {
        let js = format!("window.setState && setState({})", serde_json::to_string(state).unwrap_or_default());
        // The page may still be loading: try again shortly.
        let _ = w.eval(&js);
        let w2 = w.clone();
        tauri::async_runtime::spawn(async move { tokio::time::sleep(std::time::Duration::from_millis(400)).await; let _ = w2.eval(&js); });
    }
}

pub fn close(app: &tauri::AppHandle, delay_ms: u64) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
        if let Some(w) = app.get_webview_window("splash") { let _ = w.close(); }
    });
}

pub fn cancel(app: &tauri::AppHandle) {
    CANCELLED.store(true, Ordering::SeqCst);
    close(app, 0);
}
