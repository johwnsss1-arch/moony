// Signed-in Roblox accounts. Each cookie is encrypted with Windows DPAPI
// (only your Windows user on this PC can decrypt it) and never leaves Rust.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Serialize, Deserialize, Clone)]
struct Entry { id: u64, name: String, #[serde(rename = "displayName")] display_name: String, enc: String, #[serde(default)] avatar: Option<String> }

static LOCK: Mutex<()> = Mutex::new(());

fn file(app: &tauri::AppHandle) -> std::path::PathBuf { app.path().app_data_dir().unwrap_or_default().join("vault.json") }
fn load(app: &tauri::AppHandle) -> Vec<Entry> { std::fs::read(file(app)).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default() }
fn save(app: &tauri::AppHandle, v: &[Entry]) { let _ = std::fs::write(file(app), serde_json::to_vec_pretty(v).unwrap_or_default()); }

#[cfg(windows)]
fn protect(data: &[u8], encrypt: bool) -> Option<Vec<u8>> {
    use windows::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB};
    use windows::Win32::Foundation::{LocalFree, HLOCAL};
    unsafe {
        let input = CRYPT_INTEGER_BLOB { cbData: data.len() as u32, pbData: data.as_ptr() as *mut u8 };
        let mut out = CRYPT_INTEGER_BLOB::default();
        let ok = if encrypt { CryptProtectData(&input, None, None, None, None, 0, &mut out) } else { CryptUnprotectData(&input, None, None, None, None, 0, &mut out) };
        if ok.is_err() { return None; }
        let v = std::slice::from_raw_parts(out.pbData, out.cbData as usize).to_vec();
        let _ = LocalFree(HLOCAL(out.pbData as _));
        Some(v)
    }
}
#[cfg(not(windows))]
fn protect(data: &[u8], _e: bool) -> Option<Vec<u8>> { Some(data.to_vec()) }

pub fn cookie(app: &tauri::AppHandle, id: u64) -> Option<String> {
    let e = load(app).into_iter().find(|e| e.id == id)?;
    String::from_utf8(protect(&B64.decode(e.enc).ok()?, false)?).ok()
}
pub fn add(app: &tauri::AppHandle, id: u64, name: &str, display_name: &str, cookie: &str, avatar: Option<String>) -> bool {
    let _g = LOCK.lock().unwrap();
    let Some(enc) = protect(cookie.as_bytes(), true) else { return false };
    let mut all = load(app);
    all.retain(|e| e.id != id);
    all.push(Entry { id, name: name.into(), display_name: display_name.into(), enc: B64.encode(enc), avatar });
    save(app, &all);
    true
}
pub fn rotate(app: &tauri::AppHandle, id: u64, cookie: &str) {
    let _g = LOCK.lock().unwrap();
    let mut all = load(app);
    if let (Some(e), Some(enc)) = (all.iter_mut().find(|e| e.id == id), protect(cookie.as_bytes(), true)) { e.enc = B64.encode(enc); save(app, &all); }
}
pub fn remove(app: &tauri::AppHandle, id: u64) {
    let _g = LOCK.lock().unwrap();
    let mut all = load(app);
    all.retain(|e| e.id != id);
    save(app, &all);
}
/// Accounts without their cookies, for the interface.
pub fn accounts(app: &tauri::AppHandle) -> Vec<Value> {
    load(app).into_iter().map(|e| json!({ "id": e.id, "name": e.name, "displayName": e.display_name, "avatar": e.avatar })).collect()
}

/// One-time move from the Electron build: its sessions.json holds cookies
/// encrypted by Chromium (AES-256-GCM with a key protected by DPAPI in
/// "Local State"). Decrypt them on this PC and store them in our own vault.
/// Returns how many accounts were imported.
pub fn import_electron(app: &tauri::AppHandle) -> usize {
    use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
    let Some(roaming) = dirs::config_dir() else { return 0 };
    let old = roaming.join("Moony");
    let (Ok(state), Ok(sessions)) = (std::fs::read(old.join("Local State")), std::fs::read(old.join("sessions.json"))) else { return 0 };
    let (Ok(state), Ok(sessions)) = (serde_json::from_slice::<Value>(&state), serde_json::from_slice::<Value>(&sessions)) else { return 0 };
    let Some(enc_key) = state["os_crypt"]["encrypted_key"].as_str().and_then(|k| B64.decode(k).ok()) else { return 0 };
    if !enc_key.starts_with(b"DPAPI") { return 0; }
    let Some(key) = protect(&enc_key[5..], false) else { return 0 };
    let Ok(cipher) = Aes256Gcm::new_from_slice(&key) else { return 0 };
    let mut n = 0;
    let have: Vec<u64> = load(app).iter().map(|e| e.id).collect();
    for (id, v) in sessions.as_object().into_iter().flatten() {
        let Ok(id) = id.parse::<u64>() else { continue };
        if have.contains(&id) { continue; }
        let Some(raw) = v.as_str().and_then(|s| B64.decode(s).ok()) else { continue };
        if raw.len() < 3 + 12 + 16 || &raw[..3] != b"v10" { continue; }
        let Ok(plain) = cipher.decrypt(Nonce::from_slice(&raw[3..15]), &raw[15..]) else { continue };
        let Ok(cookie) = String::from_utf8(plain) else { continue };
        if add(app, id, "", "", &cookie, None) { n += 1; }
    }
    n
}
