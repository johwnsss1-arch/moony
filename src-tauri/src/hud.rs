use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

static ENABLED: AtomicBool = AtomicBool::new(false);
static STATE: Mutex<(bool, bool)> = Mutex::new((false, false));

pub fn set_enabled(on: bool) { ENABLED.store(on, Ordering::SeqCst); }
pub fn status() -> Value { let s = STATE.lock().unwrap(); json!({ "roblox": s.0, "showing": s.1, "enabled": ENABLED.load(Ordering::SeqCst) }) }

#[cfg(windows)]
fn foreground() -> Option<(String, i32, i32, i32, i32, bool)> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, GetWindowTextW, IsIconic};
    unsafe {
        let h = GetForegroundWindow();
        if h.0.is_null() { return None; }
        let mut buf = [0u16; 256];
        let n = GetWindowTextW(h, &mut buf);
        let mut r = RECT::default();
        GetWindowRect(h, &mut r).ok()?;
        Some((String::from_utf16_lossy(&buf[..n.max(0) as usize]), r.left, r.top, r.right - r.left, r.bottom - r.top, IsIconic(h).as_bool()))
    }
}
#[cfg(not(windows))]
fn foreground() -> Option<(String, i32, i32, i32, i32, bool)> { None }

fn window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    if let Some(w) = app.get_webview_window("hud") { return Some(w); }
    let w = WebviewWindowBuilder::new(app, "hud", WebviewUrl::App("overlay.html".into()))
        .title("Moony HUD")
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .resizable(false)
        .focused(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .visible(false)
        .build()
        .ok()?;
    let _ = w.set_ignore_cursor_events(true);
    Some(w)
}

pub fn start(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(500));
        let fg = foreground();
        let roblox = fg.as_ref().map(|(t, _, _, w, _, min)| t == "Roblox" && !min && *w > 200).unwrap_or(false);
        let want = roblox && ENABLED.load(Ordering::SeqCst);
        let changed = { let mut s = STATE.lock().unwrap(); let c = s.0 != roblox || s.1 != want; *s = (roblox, want); c };
        if want {
            if let (Some(w), Some((_, x, y, ww, hh, _))) = (window(&app), fg) {
                let _ = w.set_position(tauri::PhysicalPosition::new(x, y));
                let _ = w.set_size(tauri::PhysicalSize::new(ww as u32, hh as u32));
                if !w.is_visible().unwrap_or(false) { let _ = w.show(); let _ = w.set_ignore_cursor_events(true); }
            }
        } else if let Some(w) = app.get_webview_window("hud") {
            if w.is_visible().unwrap_or(false) { let _ = w.hide(); }
        }
        if changed { let _ = app.emit("hud:status", status()); }
    });
}

#[cfg(windows)]
pub fn usage() -> Value {
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    use windows::Win32::System::Threading::GetSystemTimes;
    use windows::Win32::Foundation::FILETIME;
    static LAST: Mutex<Option<(u64, u64)>> = Mutex::new(None);
    unsafe {
        let mut m = MEMORYSTATUSEX { dwLength: std::mem::size_of::<MEMORYSTATUSEX>() as u32, ..Default::default() };
        let ram = if GlobalMemoryStatusEx(&mut m).is_ok() { m.dwMemoryLoad } else { 0 };
        let (mut i, mut k, mut u) = (FILETIME::default(), FILETIME::default(), FILETIME::default());
        let ft = |f: FILETIME| ((f.dwHighDateTime as u64) << 32) | f.dwLowDateTime as u64;
        let mut cpu = 0u64;
        if GetSystemTimes(Some(&mut i), Some(&mut k), Some(&mut u)).is_ok() {
            let (idle, total) = (ft(i), ft(k) + ft(u));
            let mut l = LAST.lock().unwrap();
            if let Some((pi, pt)) = *l { let (di, dt) = (idle - pi, total - pt); if dt > 0 { cpu = 100 - (di * 100 / dt); } }
            *l = Some((idle, total));
        }
        json!({ "cpu": cpu, "ram": ram })
    }
}
#[cfg(not(windows))]
pub fn usage() -> Value { json!({ "cpu": 0, "ram": 0 }) }

pub async fn ping() -> i64 {
    let t = std::time::Instant::now();
    match tokio::time::timeout(std::time::Duration::from_secs(3), tokio::net::TcpStream::connect("www.roblox.com:443")).await {
        Ok(Ok(_)) => t.elapsed().as_millis().max(1) as i64,
        _ => -1,
    }
}

pub fn push(app: &tauri::AppHandle, state: Value) {
    if app.get_webview_window("hud").map(|w| w.is_visible().unwrap_or(false)).unwrap_or(false) {
        let _ = app.emit_to("hud", "overlay:state", state);
    }
}
