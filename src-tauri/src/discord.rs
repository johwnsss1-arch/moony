use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde_json::Value;
use std::sync::Mutex;

static CLIENT: Mutex<Option<(String, DiscordIpcClient)>> = Mutex::new(None);

pub fn configure(id: Option<String>) -> &'static str {
    let mut g = CLIENT.lock().unwrap();
    let id = id.filter(|s| s.len() >= 15 && s.len() <= 25 && s.chars().all(|c| c.is_ascii_digit()));
    if let (Some(new), Some((cur, _))) = (&id, g.as_ref()) { if new == cur { return "connected"; } }
    if let Some((_, mut c)) = g.take() { let _ = c.close(); }
    let Some(id) = id else { return "off" };
    let Ok(mut c) = DiscordIpcClient::new(&id) else { return "unavailable" };
    if c.connect().is_err() { return "unavailable"; }
    *g = Some((id, c));
    "connected"
}

pub fn status() -> &'static str { if CLIENT.lock().unwrap().is_some() { "connected" } else { "off" } }

pub fn set(a: &Value) {
    let mut g = CLIENT.lock().unwrap();
    let Some((_, c)) = g.as_mut() else { return };
    if a.is_null() { let _ = c.clear_activity(); return; }
    let s = |k: &str| a[k].as_str().unwrap_or_default().to_string();
    let (details, state, large, large_t) = (s("details"), s("state"), s("largeImageKey"), s("largeImageText"));
    let mut act = activity::Activity::new().details(&details).state(&state);
    if let Some(t) = a["startTimestamp"].as_i64() { act = act.timestamps(activity::Timestamps::new().start(t / 1000)); }
    let mut assets = activity::Assets::new().small_image("https://moonylauncher.xyz/img/icon.png").small_text("Moony · moonylauncher.xyz");
    if !large.is_empty() { assets = assets.large_image(&large).large_text(&large_t); }
    let join = s("joinUrl");
    let second = if join.starts_with("https://www.roblox.com/games/start?") { activity::Button::new("Join my server", &join) } else { activity::Button::new("Join the Discord", "https://discord.gg/moonylauncher") };
    act = act.assets(assets).buttons(vec![activity::Button::new("Get Moony", "https://moonylauncher.xyz"), second]);
    if c.set_activity(act).is_err() { let _ = c.reconnect(); }
}
