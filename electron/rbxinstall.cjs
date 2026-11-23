// Moony's own Roblox install, kept up to date the way Roblox's launcher does:
// read the latest version from Roblox, download its packages from Roblox's
// CDN (setup.rbxcdn.com), check each file's MD5, and unpack them into
// %LOCALAPPDATA%\Moony\Roblox\<version>. Then Moony starts the player directly,
// so no other launcher (Roblox's, Fishstrap, Bloxstrap) gets involved.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { unzipSync } = require("fflate");

const CDN = "https://setup.rbxcdn.com";
// Where each package unpacks inside the version folder (same layout Roblox uses).
const DIRS = {
  "RobloxApp.zip": "", "redist.zip": "", "shaders.zip": "shaders/", "ssl.zip": "ssl/", "WebView2.zip": "",
  "WebView2RuntimeInstaller.zip": "WebView2RuntimeInstaller/",
  "content-avatar.zip": "content/avatar/", "content-configs.zip": "content/configs/", "content-fonts.zip": "content/fonts/",
  "content-sky.zip": "content/sky/", "content-sounds.zip": "content/sounds/", "content-textures2.zip": "content/textures/",
  "content-models.zip": "content/models/", "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
  "content-platform-dictionaries.zip": "PlatformContent/pc/shared_compression_dictionaries/",
  "content-terrain.zip": "PlatformContent/pc/terrain/", "content-textures3.zip": "PlatformContent/pc/textures/",
  "extracontent-luapackages.zip": "ExtraContent/LuaPackages/", "extracontent-translations.zip": "ExtraContent/translations/",
  "extracontent-models.zip": "ExtraContent/models/", "extracontent-textures.zip": "ExtraContent/textures/",
  "extracontent-places.zip": "ExtraContent/places/",
};
const APP_SETTINGS = `<?xml version="1.0" encoding="UTF-8"?>\r\n<Settings>\r\n\t<ContentFolder>content</ContentFolder>\r\n\t<BaseUrl>http://www.roblox.com</BaseUrl>\r\n</Settings>\r\n`;

const root = () => path.join(process.env.LOCALAPPDATA || "", "Moony", "Roblox");

async function latest() {
  const r = await fetch("https://clientsettings.roblox.com/v2/client-version/WindowsPlayer", { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Couldn't check Roblox's version (${r.status})`);
  const j = await r.json();
  return { guid: j.clientVersionUpload, version: j.version };
}

function installedDir(guid) {
  const d = path.join(root(), guid);
  return fs.existsSync(path.join(d, "RobloxPlayerBeta.exe")) && fs.existsSync(path.join(d, ".moony-complete")) ? d : null;
}
// Newest complete Moony-managed install (used when offline).
function anyInstalled() {
  if (!fs.existsSync(root())) return null;
  return fs.readdirSync(root()).map((d) => path.join(root(), d))
    .filter((d) => fs.existsSync(path.join(d, ".moony-complete")))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
}

async function manifest(guid) {
  const r = await fetch(`${CDN}/${guid}-rbxPkgManifest.txt`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Couldn't read Roblox's package list (${r.status})`);
  const lines = (await r.text()).split(/\r?\n/);
  const out = [];
  for (let i = 1; i + 3 < lines.length; i += 4) {
    const name = lines[i].trim();
    if (name in DIRS) out.push({ name, md5: lines[i + 1].trim().toLowerCase(), packed: Number(lines[i + 2]), size: Number(lines[i + 3]) });
  }
  if (!out.some((p) => p.name === "RobloxApp.zip")) throw new Error("Roblox's package list looks incomplete");
  return out;
}

// Download one package with progress, retrying twice; verifies the MD5.
async function download(guid, pkg, onBytes) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${CDN}/${guid}-${pkg.name}`, { signal: AbortSignal.timeout(180000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const chunks = [];
      let got = 0;
      for await (const c of res.body) { chunks.push(c); got += c.length; onBytes(c.length); }
      const buf = Buffer.concat(chunks);
      const md5 = crypto.createHash("md5").update(buf).digest("hex");
      if (md5 !== pkg.md5) throw new Error("checksum mismatch");
      return buf;
    } catch (e) {
      if (attempt === 2) throw new Error(`Couldn't download ${pkg.name}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

function extract(buf, dest, sub) {
  const files = unzipSync(new Uint8Array(buf));
  for (const [raw, data] of Object.entries(files)) {
    // Roblox's zips use backslashes, including for folder entries.
    const name = raw.replace(/\\/g, "/");
    if (name.endsWith("/") || !name) continue;
    const target = path.resolve(dest, sub + name);
    if (!target.startsWith(path.resolve(dest) + path.sep)) continue; // never write outside the install folder
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
}

let busy = null;
// Make sure the latest Roblox is installed; returns its folder.
// onProgress({ phase, done, total, speed }) for the bootstrapper window.
function ensure(onProgress = () => {}) {
  if (busy) return busy;
  busy = (async () => {
    let want;
    try { want = await latest(); } catch (e) {
      const fallback = anyInstalled();
      if (fallback) return { dir: fallback, updated: false, offline: true };
      throw e;
    }
    const ready = installedDir(want.guid);
    if (ready) return { dir: ready, updated: false, version: want.version };

    onProgress({ phase: "Checking Roblox's files…" });
    const pkgs = await manifest(want.guid);
    const total = pkgs.reduce((n, p) => n + p.packed, 0);
    const dest = path.join(root(), want.guid);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    let done = 0, last = Date.now(), lastDone = 0, speed = 0;
    const tick = (n) => {
      done += n;
      const now = Date.now();
      if (now - last > 400) { speed = ((done - lastDone) / (now - last)) * 1000; last = now; lastDone = done; onProgress({ phase: "Downloading Roblox…", done, total, speed }); }
    };
    // Four packages at a time; unpack each as it arrives.
    const queue = [...pkgs].sort((a, b) => b.packed - a.packed);
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const p = queue.shift();
        const buf = await download(want.guid, p, tick);
        extract(buf, dest, DIRS[p.name]);
      }
    }));
    onProgress({ phase: "Finishing install…", done: total, total });
    fs.writeFileSync(path.join(dest, "AppSettings.xml"), APP_SETTINGS);
    fs.writeFileSync(path.join(dest, ".moony-complete"), want.version || want.guid);
    // Remove older Moony-managed versions.
    for (const d of fs.readdirSync(root())) if (d !== want.guid) fs.rmSync(path.join(root(), d), { recursive: true, force: true });
    return { dir: dest, updated: true, version: want.version };
  })().finally(() => { busy = null; });
  return busy;
}

module.exports = { ensure, latest, installedDir, anyInstalled, root };
