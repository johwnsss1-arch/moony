// What's playing on the PC (any app that shows in Windows' media controls:
// Spotify, YouTube in a browser, Media Player...) and the live output level,
// for the HUD music visualiser. Read-only.
use serde_json::{json, Value};

fn pretty_app(id: &str) -> String {
    let base = id.split('!').next().unwrap_or(id);
    let base = base.trim_end_matches(".exe");
    let known = [("spotify", "Spotify"), ("chrome", "Chrome"), ("msedge", "Edge"), ("firefox", "Firefox"), ("zunemusic", "Media Player"), ("opera", "Opera"), ("brave", "Brave"), ("discord", "Discord"), ("vlc", "VLC"), ("applemusic", "Apple Music"), ("itunes", "iTunes"), ("tidal", "TIDAL"), ("deezer", "Deezer"), ("youtube", "YouTube")];
    let low = base.to_lowercase();
    for (k, v) in known { if low.contains(k) { return v.into(); } }
    let last = base.rsplit(|c: char| c == '.' || c == '/' || c == '\x5c').next().unwrap_or(base);
    let mut c = last.chars();
    c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
}

#[cfg(windows)]
pub fn info() -> Value {
    use windows::Media::Control::{GlobalSystemMediaTransportControlsSessionManager as Mgr, GlobalSystemMediaTransportControlsSessionPlaybackStatus as St};
    let r = (|| -> windows::core::Result<Value> {
        let m = Mgr::RequestAsync()?.get()?;
        let s = m.GetCurrentSession()?;
        let p = s.TryGetMediaPropertiesAsync()?.get()?;
        let playing = s.GetPlaybackInfo()?.PlaybackStatus()? == St::Playing;
        let title = p.Title()?.to_string();
        if title.is_empty() { return Ok(Value::Null); }
        Ok(json!({ "title": title, "artist": p.Artist()?.to_string(), "app": pretty_app(&s.SourceAppUserModelId()?.to_string()), "playing": playing }))
    })();
    r.unwrap_or(Value::Null)
}
#[cfg(not(windows))]
pub fn info() -> Value { Value::Null }

/// Peak output level of the default speakers, 0..1.
#[cfg(windows)]
pub fn level() -> f32 {
    use windows::Win32::Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
    use windows::Win32::Media::Audio::Endpoints::IAudioMeterInformation;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};
    thread_local! { static METER: std::cell::RefCell<Option<IAudioMeterInformation>> = const { std::cell::RefCell::new(None) }; }
    METER.with(|m| unsafe {
        if m.borrow().is_none() {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let made = (|| -> windows::core::Result<IAudioMeterInformation> {
                let e: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
                let d = e.GetDefaultAudioEndpoint(eRender, eConsole)?;
                d.Activate(CLSCTX_ALL, None)
            })();
            *m.borrow_mut() = made.ok();
        }
        m.borrow().as_ref().and_then(|x| x.GetPeakValue().ok()).unwrap_or(0.0)
    })
}
#[cfg(not(windows))]
pub fn level() -> f32 { 0.0 }
