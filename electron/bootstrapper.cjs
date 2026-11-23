// Moony's bootstrapper: the small loading windows you see while Moony starts
// and while Roblox launches, plus the fast-launch logic.
//
// Fast launch: when your Roblox install is already the latest version, Moony
// starts RobloxPlayerBeta.exe directly with a one-time sign-in ticket. That
// skips Roblox's own launcher, which otherwise checks for updates first. If
// Roblox is out of date (or anything goes wrong) it falls back to the normal
// roblox-player: link, so Roblox updates itself as usual.
const { BrowserWindow } = require("electron");
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const MOON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='5' y1='4' x2='24' y2='28' gradientUnits='userSpaceOnUse'><stop stop-color='#fff6d8'/><stop offset='.55' stop-color='#c9c3ff'/><stop offset='1' stop-color='#8b7dff'/></linearGradient><mask id='m'><rect width='32' height='32' fill='#fff'/><circle cx='21' cy='11.5' r='10' fill='#000'/></mask></defs><circle cx='15' cy='17' r='12' fill='url(#g)' mask='url(#m)'/><path d='M25.5 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z' fill='#fff6d8'/></svg>`;

const PAGE = (accent) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden;font-family:"Segoe UI Variable Text","Segoe UI",sans-serif;user-select:none}
.card{position:absolute;inset:8px;border-radius:18px;background:radial-gradient(120% 90% at 50% 0%,#232136 0%,#121318 60%);border:1px solid rgba(255,255,255,.1);box-shadow:0 18px 50px rgba(0,0,0,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#ececf1;-webkit-app-region:drag;overflow:hidden}
.logo{width:64px;height:64px;animation:float 2.4s ease-in-out infinite;filter:drop-shadow(0 6px 18px rgba(139,125,255,.45))}
.game{width:64px;height:64px;border-radius:16px;object-fit:cover;box-shadow:0 8px 24px rgba(0,0,0,.5);display:none}
.title{font-size:17px;font-weight:600;letter-spacing:.01em;text-align:center;max-width:86%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.step{font-size:12.5px;color:#a4a6b3;height:16px}
.bar{width:72%;height:5px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden}
.fill{height:100%;width:6%;border-radius:5px;background:linear-gradient(90deg,${accent},#c9c3ff);transition:width .5s cubic-bezier(.2,.8,.2,1)}
.fill.indet{width:35%;animation:indet 1.1s ease-in-out infinite}
.foot{position:absolute;bottom:12px;font-size:11px;color:#6c6e7b}
.err{color:#ff8a96}
.x{position:absolute;top:10px;right:12px;width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:#8b8d98;font-size:17px;line-height:1;cursor:pointer;-webkit-app-region:no-drag}.x:hover{background:rgba(255,255,255,.08);color:#fff}
@keyframes float{50%{transform:translateY(-5px)}}
@keyframes indet{0%{transform:translateX(-110%)}100%{transform:translateX(300%)}}
</style></head><body><div class="card">
<button class="x" title="Close" onclick="window.close()">&times;</button>
<img class="logo" id="logo" src="data:image/svg+xml;base64,${Buffer.from(MOON_SVG).toString("base64")}">
<img class="game" id="game">
<div class="title" id="title">Moony</div>
<div class="bar"><div class="fill" id="fill"></div></div>
<div class="step" id="step">Starting…</div>
<div class="foot" id="foot"></div>
</div><script>
window.setState = (s) => {
  if (s.title != null) document.getElementById("title").textContent = s.title;
  if (s.step != null) { const e = document.getElementById("step"); e.textContent = s.step; e.className = "step" + (s.error ? " err" : ""); }
  if (s.foot != null) document.getElementById("foot").textContent = s.foot;
  const f = document.getElementById("fill");
  if (s.progress == null) f.className = "fill indet"; else { f.className = "fill"; f.style.width = Math.max(4, Math.min(100, s.progress)) + "%"; }
  if (s.image) { const g = document.getElementById("game"); g.src = s.image; g.style.display = "block"; document.getElementById("logo").style.display = "none"; }
};
</script></body></html>`;

class Splash {
  constructor({ parent, width = 360, height = 260, accent = "#8b7dff", icon }) {
    this.win = new BrowserWindow({
      width, height, frame: false, transparent: true, resizable: false, movable: true, show: false, skipTaskbar: !!parent,
      alwaysOnTop: true, backgroundColor: "#00000000", title: "Moony", icon, parent: parent || undefined,
      webPreferences: { sandbox: true, contextIsolation: true },
    });
    this.ready = this.win.loadURL("data:text/html;base64," + Buffer.from(PAGE(accent)).toString("base64")).then(() => this.win.show()).catch(() => {});
    this.closed = false;
    this.win.on("closed", () => { this.closed = true; });
  }
  async set(state) {
    await this.ready;
    if (this.closed) return;
    this.win.webContents.executeJavaScript(`setState(${JSON.stringify(state)})`).catch(() => {});
  }
  close(delay = 0) { setTimeout(() => { if (!this.closed) this.win.destroy(); }, delay); }
}

/* ---------- Version check (for fast launch) ---------- */
let latest = { version: null, at: 0 };
async function latestVersion() {
  if (latest.version && Date.now() - latest.at < 30 * 60e3) return latest.version;
  try {
    const r = await fetch("https://clientsettings.roblox.com/v2/client-version/WindowsPlayer", { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    latest = { version: j.version || null, at: Date.now() };
  } catch { /* offline: can't confirm, so no fast launch */ }
  return latest.version;
}
const installedCache = new Map();
function installedVersion(dir) {
  if (installedCache.has(dir)) return Promise.resolve(installedCache.get(dir));
  const exe = path.join(dir, "RobloxPlayerBeta.exe");
  return new Promise((resolve) => {
    // One quick read of the exe's version number, cached per Roblox folder.
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `(Get-Item -LiteralPath '${exe.replace(/'/g, "''")}').VersionInfo.FileVersion`], { windowsHide: true, timeout: 8000 }, (err, out) => {
      const v = err ? null : String(out).trim().replace(/,\s*/g, ".");
      installedCache.set(dir, v);
      resolve(v);
    });
  });
}
async function canFastLaunch(findPlayerDir) {
  const dir = findPlayerDir();
  if (!dir) return null;
  const [want, have] = await Promise.all([latestVersion(), installedVersion(dir)]);
  return want && have && want === have ? dir : null;
}

// Start RobloxPlayerBeta.exe directly with the same values the roblox-player:
// link would pass to Roblox's launcher.
function directLaunch(dir, { ticket, launcherUrl, trackerId }) {
  const exe = path.join(dir, "RobloxPlayerBeta.exe");
  if (!fs.existsSync(exe)) throw new Error("Roblox Player not found");
  const args = ["--app", "-t", ticket, "-j", launcherUrl, "-b", String(trackerId), `--launchtime=${Date.now()}`, "--rloc", "en_us", "--gloc", "en_us"];
  const p = spawn(exe, args, { cwd: dir, detached: true, stdio: "ignore", windowsHide: false });
  p.unref();
  return p;
}

module.exports = { Splash, canFastLaunch, directLaunch, latestVersion };
