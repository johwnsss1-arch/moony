use base64::{engine::general_purpose::STANDARD as B64, Engine};
use once_cell::sync::Lazy;
use serde_json::{json, Value};

static CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Moony/2.0")
        .gzip(true)
        .brotli(true)
        .pool_max_idle_per_host(4)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .expect("http client")
});

const ALLOWED: &[&str] = &["roblox.com", "rbxcdn.com", "roblox.qq.com", "moonylauncher.xyz", "github.com", "githubusercontent.com", "ip-api.com", "ipinfo.io", "discord.com", "pastebin.com", "gitlab.com", "codeberg.org", "hastebin.com", "rentry.co"];

pub async fn request(app: &tauri::AppHandle, req: Value) -> Result<Value, String> {
    let url = req["url"].as_str().ok_or("missing url")?;
    let parsed = reqwest::Url::parse(url).map_err(|e| e.to_string())?;
    let host = parsed.host_str().unwrap_or_default().to_string();
    if parsed.scheme() != "https" && !host.ends_with("ip-api.com") {
        return Err("https only".into());
    }
    if !ALLOWED.iter().any(|d| host == *d || host.ends_with(&format!(".{d}"))) {
        return Err(format!("{host} isn't on Moony's list of allowed sites"));
    }
    let method = reqwest::Method::from_bytes(req["method"].as_str().unwrap_or("GET").as_bytes()).map_err(|e| e.to_string())?;
    let mut rb = CLIENT.request(method, parsed.clone());
    let mut account: Option<u64> = None;
    if let Some(h) = req["headers"].as_object() {
        for (k, v) in h {
            let mut val = v.as_str().unwrap_or_default().to_string();
            if k.eq_ignore_ascii_case("cookie") && val.contains("moony:acct:") {
                if !(host == "roblox.com" || host.ends_with(".roblox.com")) { continue; }
                let id: u64 = val.split("moony:acct:").nth(1).and_then(|s| s.split(|c: char| !c.is_ascii_digit()).next()).and_then(|s| s.parse().ok()).unwrap_or(0);
                let Some(cookie) = crate::vault::cookie(app, id) else { return Err("That account is signed out".into()) };
                val = format!(".ROBLOSECURITY={cookie}");
                account = Some(id);
            }
            rb = rb.header(k.as_str(), val);
        }
    }
    if let Some(b) = req["body"].as_str() {
        rb = rb.body(b.to_string());
    } else if let Some(b) = req["bodyB64"].as_str() {
        rb = rb.body(B64.decode(b).map_err(|e| e.to_string())?);
    }
    let res = rb.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let mut headers = serde_json::Map::new();
    for (k, v) in res.headers() {
        if k == "set-cookie" {
            if let (Some(id), Ok(s)) = (account, v.to_str()) {
                if let Some(rest) = s.strip_prefix(".ROBLOSECURITY=") {
                    let c = rest.split(';').next().unwrap_or_default();
                    if c.len() > 100 { crate::vault::rotate(app, id, c); }
                }
            }
            continue;
        }
        if let Ok(s) = v.to_str() { headers.insert(k.to_string(), json!(s)); }
    }
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    let text_like = headers.get("content-type").and_then(|v| v.as_str()).map(|t| t.contains("json") || t.starts_with("text/") || t.contains("xml")).unwrap_or(false);
    Ok(if text_like {
        json!({ "status": status, "headers": headers, "text": String::from_utf8_lossy(&bytes) })
    } else {
        json!({ "status": status, "headers": headers, "b64": B64.encode(&bytes) })
    })
}
