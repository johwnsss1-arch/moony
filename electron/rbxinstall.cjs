const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { unzipSync } = require("fflate");

const CDN = "https://setup.rbxcdn.com";
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

const GUID = /^version-[0-9a-f]{16}$/i;
async function latest(channel) {
  const ch = channel && channel.toLowerCase() !== "production" && /^[a-z0-9_-]{1,40}$/i.test(channel) ? `/channel/${channel}` : "";
  const r = await fetch(`https://clientsettings.roblox.com/v2/client-version/WindowsPlayer${ch}`, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`Couldn't check Roblox's version (${r.status})`);
  const j = await r.json();
  return { guid: j.clientVersionUpload, version: j.version };
}

function installedDir(guid) {
  const d = path.join(root(), guid);
  return fs.existsSync(path.join(d, "RobloxPlayerBeta.exe")) && fs.existsSync(path.join(d, ".moony-complete")) ? d : null;
}
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
    const name = raw.replace(/\\/g, "/");
    if (name.endsWith("/") || !name) continue;
    const target = path.resolve(dest, sub + name);
    if (!target.startsWith(path.resolve(dest) + path.sep)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
}

const jobs = new Map();
function install(guid, label, onProgress = () => {}, keep = false) {
  if (!GUID.test(guid)) return Promise.reject(new Error("That isn't a Roblox version hash (version-xxxxxxxxxxxxxxxx)"));
  guid = guid.toLowerCase();
  if (installedDir(guid)) return Promise.resolve(path.join(root(), guid));
  if (jobs.has(guid)) return jobs.get(guid);
  const job = (async () => {
    onProgress({ phase: "Checking Roblox's files…" });
    const pkgs = await manifest(guid);
    const total = pkgs.reduce((n, p) => n + p.packed, 0);
    const dest = path.join(root(), guid);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    let done = 0, last = Date.now(), lastDone = 0, speed = 0;
    const tick = (n) => {
      done += n;
      const now = Date.now();
      if (now - last > 300) { speed = ((done - lastDone) / (now - last)) * 1000; last = now; lastDone = done; onProgress({ phase: "Downloading Roblox…", done, total, speed }); }
    };
    const queue = [...pkgs].sort((a, b) => b.packed - a.packed);
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const p = queue.shift();
        const buf = await download(guid, p, tick);
        extract(buf, dest, DIRS[p.name]);
      }
    }));
    onProgress({ phase: "Finishing install…", done: total, total });
    fs.writeFileSync(path.join(dest, "AppSettings.xml"), APP_SETTINGS);
    if (keep) fs.writeFileSync(path.join(dest, ".moony-keep"), "1");
    fs.writeFileSync(path.join(dest, ".moony-complete"), label || guid);
    return dest;
  })().finally(() => jobs.delete(guid));
  jobs.set(guid, job);
  return job;
}

function list() {
  if (!fs.existsSync(root())) return [];
  return fs.readdirSync(root()).filter((d) => GUID.test(d)).map((guid) => {
    const d = path.join(root(), guid), done = path.join(d, ".moony-complete");
    let version = null, at = 0;
    try { version = fs.readFileSync(done, "utf8").trim(); at = fs.statSync(done).mtimeMs; } catch { }
    return { guid, version, complete: !!version, keep: fs.existsSync(path.join(d, ".moony-keep")), at, dir: d };
  }).sort((a, b) => b.at - a.at);
}
function remove(guid) {
  if (!GUID.test(guid)) return false;
  fs.rmSync(path.join(root(), guid.toLowerCase()), { recursive: true, force: true });
  return true;
}

let busy = null;
function ensure(onProgress = () => {}, opts = {}) {
  if (busy) return busy;
  busy = (async () => {
    if (opts.pinned && GUID.test(opts.pinned)) {
      const dir = await install(opts.pinned, opts.pinned, onProgress, true);
      return { dir, updated: false, version: opts.pinned, guid: opts.pinned.toLowerCase(), pinned: true, channel: opts.channel || "production" };
    }
    let want;
    try { want = await latest(opts.channel); } catch (e) {
      const fallback = anyInstalled();
      if (fallback) return { dir: fallback, updated: false, offline: true, version: path.basename(fallback) };
      throw e;
    }
    const ready = installedDir(want.guid);
    if (ready) return { dir: ready, updated: false, version: want.version, guid: want.guid, channel: opts.channel || "production" };
    const dir = await install(want.guid, want.version, onProgress, false);
    for (const v of list()) if (v.guid !== want.guid.toLowerCase() && !v.keep) remove(v.guid);
    return { dir, updated: true, version: want.version, guid: want.guid, channel: opts.channel || "production" };
  })().finally(() => { busy = null; });
  return busy;
}

module.exports = { ensure, latest, install, list, remove, installedDir, anyInstalled, root, GUID };
