// Boost mode: while a game runs, Roblox gets high CPU priority and Windows
// switches to the High performance power plan. Both are put back afterwards.
use serde_json::{json, Value};
use std::sync::Mutex;

static PREV_PLAN: Mutex<Option<String>> = Mutex::new(None);
const HIGH_PERF: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";

fn run(cmd: &str, args: &[&str]) -> String {
    use std::process::Command;
    #[cfg(windows)]
    use std::os::windows::process::CommandExt;
    let mut c = Command::new(cmd);
    c.args(args);
    #[cfg(windows)]
    c.creation_flags(0x0800_0000);
    c.output().map(|o| String::from_utf8_lossy(&o.stdout).into_owned()).unwrap_or_default()
}

fn active_plan() -> Option<String> {
    let out = run("powercfg", &["/getactivescheme"]);
    out.split_whitespace().find(|w| w.len() == 36 && w.matches('-').count() == 4).map(|s| s.to_string())
}

fn set_priority(class: &str) {
    run("powershell", &["-NoProfile", "-NonInteractive", "-Command", &format!("Get-Process RobloxPlayerBeta -ErrorAction SilentlyContinue | ForEach-Object {{ $_.PriorityClass = '{class}' }}")]);
}

pub fn on() -> Value {
    set_priority("High");
    let mut prev = PREV_PLAN.lock().unwrap();
    let mut plan = false;
    if prev.is_none() {
        if let Some(cur) = active_plan() {
            if cur != HIGH_PERF {
                run("powercfg", &["/setactive", HIGH_PERF]);
                plan = active_plan().as_deref() == Some(HIGH_PERF);
                if plan { *prev = Some(cur); }
            }
        }
    }
    json!({ "priority": true, "powerPlan": plan || prev.is_some() })
}

pub fn off() -> Value {
    if let Some(p) = PREV_PLAN.lock().unwrap().take() { run("powercfg", &["/setactive", &p]); }
    json!(true)
}
