// "Open Roblox links with Moony": registers Moony for roblox-player: and
// roblox: links (like Bloxstrap/Fishstrap). The previous handler is saved so
// turning it off gives the links back.
use serde_json::{json, Value};
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

const PROTOS: [&str; 2] = ["roblox-player", "roblox"];

fn reg(args: &[&str]) -> Option<String> {
    let mut c = Command::new("reg");
    c.args(args);
    #[cfg(windows)]
    c.creation_flags(0x0800_0000);
    let o = c.output().ok()?;
    o.status.success().then(|| String::from_utf8_lossy(&o.stdout).to_string())
}
fn current(p: &str) -> Option<String> {
    let out = reg(&["query", &format!("HKCU\\Software\\Classes\\{p}\\shell\\open\\command"), "/ve"])?;
    out.lines().find_map(|l| l.split_once("REG_SZ").map(|(_, v)| v.trim().to_string()))
}
fn me() -> String { std::env::current_exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default() }

pub fn is_set() -> bool { PROTOS.iter().all(|p| current(p).map(|c| c.contains(&me())).unwrap_or(false)) }

pub fn set(app: &tauri::AppHandle, on: bool) -> Value {
    let mut backup = crate::store::get(app, "protocol-backup").ok().filter(|v| v.is_object()).unwrap_or(json!({}));
    let exe = me();
    for p in PROTOS {
        let key = format!("HKCU\\Software\\Classes\\{p}");
        if on {
            if let Some(c) = current(p) { if !c.to_lowercase().contains("moony") { backup[p] = json!(c); } }
            reg(&["add", &key, "/ve", "/d", &format!("URL: {p} Protocol"), "/f"]);
            reg(&["add", &key, "/v", "URL Protocol", "/d", "", "/f"]);
            reg(&["add", &format!("{key}\\shell\\open\\command"), "/ve", "/d", &format!("\"{exe}\" \"%1\""), "/f"]);
        } else if let Some(prev) = backup[p].as_str() {
            reg(&["add", &format!("{key}\\shell\\open\\command"), "/ve", "/d", prev, "/f"]);
        } else {
            reg(&["delete", &format!("{key}\\shell\\open\\command"), "/ve", "/f"]);
        }
    }
    let _ = crate::store::set(app, "protocol-backup", backup);
    json!(is_set())
}
