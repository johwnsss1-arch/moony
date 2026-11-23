// Auto-updates. Every Moony checks a small JSON feed (published with each
// GitHub release) at startup and every 6 hours:
//   { "version": "1.0.1", "url": "https://.../Moony-Setup-1.0.1.exe", "sha256": "...", "notes": "..." }
// If it's newer, the setup exe is downloaded in the background and verified.
// The user clicks "Restart to update" (or it applies the next time Moony quits),
// which runs the new setup with --update: it replaces the files and reopens Moony.
const { app, ipcMain, net } = require("electron");
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");

const FEED = (pkg.moony && pkg.moony.updateUrl) || "";
const dir = () => path.join(app.getPath("userData"), "updates");
let state = { status: "idle", current: pkg.version, version: null, notes: "", error: null };
let file = null, getWin = () => null, timer = null, applying = false;

const newer = (a, b) => {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
const set = (s) => { state = { ...state, ...s }; getWin()?.webContents.send("update:state", state); };

async function fetchBuf(url) {
  const r = await net.fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function check() {
  if (!FEED || !app.isPackaged) { set({ status: "disabled" }); return state; }
  if (state.status === "downloading" || state.status === "ready") return state;
  try {
    set({ status: "checking", error: null });
    const feed = JSON.parse((await fetchBuf(FEED + "?t=" + Date.now())).toString("utf8"));
    if (!feed.version || !newer(feed.version, pkg.version)) { set({ status: "latest" }); return state; }
    set({ status: "downloading", version: feed.version, notes: feed.notes || "" });
    fs.mkdirSync(dir(), { recursive: true });
    const target = path.join(dir(), `Moony-Setup-${feed.version}.exe`);
    let buf = fs.existsSync(target) ? fs.readFileSync(target) : null;
    const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
    if (!buf || (feed.sha256 && hash(buf) !== feed.sha256.toLowerCase())) {
      buf = await fetchBuf(feed.url);
      if (feed.sha256 && hash(buf) !== feed.sha256.toLowerCase()) throw new Error("Download was corrupted (checksum mismatch)");
      fs.writeFileSync(target, buf);
    }
    file = target;
    set({ status: "ready" });
  } catch (e) {
    set({ status: "error", error: e.message });
  }
  return state;
}

function apply() {
  if (!file || applying) return false;
  applying = true;
  spawn(file, ["--update"], { detached: true, stdio: "ignore" }).unref();
  app.exit(0);
  return true;
}

function startUpdater(winGetter) {
  getWin = winGetter;
  ipcMain.handle("update:get", () => state);
  ipcMain.handle("update:check", () => check());
  ipcMain.handle("update:apply", () => apply());
  // Clear out old downloads.
  try { fs.rmSync(dir(), { recursive: true, force: true }); } catch { /* none */ }
  setTimeout(check, 15000);
  timer = setInterval(check, 6 * 3600 * 1000);
  // A downloaded update installs itself when Moony quits normally.
  app.on("will-quit", () => { if (file && !applying) { applying = true; spawn(file, ["--update", "--quiet"], { detached: true, stdio: "ignore" }).unref(); } });
}

module.exports = { startUpdater };
