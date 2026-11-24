const { BrowserWindow } = require("electron");
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const MOON_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><defs><linearGradient id='g' x1='5' y1='4' x2='24' y2='28' gradientUnits='userSpaceOnUse'><stop stop-color='#fff6d8'/><stop offset='.55' stop-color='#c9c3ff'/><stop offset='1' stop-color='#8b7dff'/></linearGradient><mask id='m'><rect width='32' height='32' fill='#fff'/><circle cx='21' cy='11.5' r='10' fill='#000'/></mask></defs><circle cx='15' cy='17' r='12' fill='url(#g)' mask='url(#m)'/><path d='M25.5 3.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z' fill='#fff6d8'/></svg>`;

const PAGE = (accent) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden;font-family:"Segoe UI Variable Text","Segoe UI",sans-serif;user-select:none}
.card{position:absolute;inset:10px;border-radius:16px;overflow:hidden;color:#f2f1f7;-webkit-app-region:drag;
  background:radial-gradient(90% 70% at 50% 0%,color-mix(in srgb,${accent} 26%,transparent),transparent 70%),linear-gradient(180deg,rgba(32,30,46,.96),rgba(18,18,26,.97));
  border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;align-items:center}
.top{align-self:stretch;display:flex;justify-content:space-between;padding:11px 14px 0;font-size:11.5px;color:rgba(255,255,255,.62);font-weight:600}
.icon{margin-top:22px;width:78px;height:78px;border-radius:18px;display:grid;place-items:center;transform:rotate(-12deg);animation:bob 2.6s ease-in-out infinite;
  background:linear-gradient(145deg,${accent},color-mix(in srgb,${accent} 55%,#1b1640));box-shadow:0 14px 34px color-mix(in srgb,${accent} 45%,transparent),inset 0 1px 0 rgba(255,255,255,.3)}
.icon img{width:52px;height:52px}
.icon.game{background:#000;padding:0;overflow:hidden}.icon.game img{width:100%;height:100%;object-fit:cover}
.title{margin-top:18px;font-size:12px;color:rgba(255,255,255,.55);max-width:86%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:15px}
.step{margin-top:4px;font-size:21px;font-weight:600;letter-spacing:-.01em;text-align:center;max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.step.err{color:#ff8a96;font-size:16px}
.bar{margin-top:16px;width:84%;height:7px;border-radius:7px;background:rgba(255,255,255,.1);overflow:hidden}
.fill{height:100%;width:6%;border-radius:7px;background:linear-gradient(90deg,${accent},#fff);transition:width .5s cubic-bezier(.2,.8,.2,1)}
.fill.indet{width:28%;animation:indet 1.2s ease-in-out infinite;background:linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)}
.foot{margin-top:7px;font-size:11px;color:rgba(255,255,255,.45);height:14px}
.cancel{margin:auto 0 16px;padding:8px 34px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);color:#fff;font:500 13.5px inherit;font-family:inherit;cursor:pointer;-webkit-app-region:no-drag}
.cancel:hover{background:rgba(255,255,255,.16)}
@keyframes bob{50%{transform:rotate(-8deg) translateY(-5px)}}
@keyframes indet{0%{transform:translateX(-110%)}100%{transform:translateX(380%)}}
</style></head><body><div class="card">
<div class="top"><span id="chan">Moony</span><span id="ver"></span></div>
<div class="icon" id="icon"><img id="logo" src="data:image/svg+xml;base64,${Buffer.from(MOON_SVG).toString("base64")}"></div>
<div class="title" id="title"></div>
<div class="step" id="step">Starting…</div>
<div class="bar"><div class="fill" id="fill"></div></div>
<div class="foot" id="foot"></div>
<button class="cancel" onclick="window.close()">Cancel</button>
</div><script>
window.setState = (s) => {
  const $ = (id) => document.getElementById(id);
  if (s.title != null) $("title").textContent = s.title;
  if (s.step != null) { $("step").textContent = s.step; $("step").className = "step" + (s.error ? " err" : ""); }
  if (s.foot != null) $("foot").textContent = s.foot;
  if (s.channel != null) $("chan").textContent = "Channel: " + s.channel;
  if (s.version != null) $("ver").textContent = s.version ? "Version: " + s.version : "";
  const f = $("fill");
  if (s.progress == null) f.className = "fill indet"; else { f.className = "fill"; f.style.width = Math.max(4, Math.min(100, s.progress)) + "%"; }
  if (s.image) { $("logo").src = s.image; $("icon").classList.add("game"); }
};
</script></body></html>`;

class Splash {
  constructor({ parent, width = 440, height = 330, accent = "#8b7dff", icon }) {
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

let latest = { version: null, at: 0 };
async function latestVersion() {
  if (latest.version && Date.now() - latest.at < 30 * 60e3) return latest.version;
  try {
    const r = await fetch("https://clientsettings.roblox.com/v2/client-version/WindowsPlayer", { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    latest = { version: j.version || null, at: Date.now() };
  } catch { }
  return latest.version;
}
const installedCache = new Map();
function installedVersion(dir) {
  if (installedCache.has(dir)) return Promise.resolve(installedCache.get(dir));
  const exe = path.join(dir, "RobloxPlayerBeta.exe");
  return new Promise((resolve) => {
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

function directLaunch(dir, { ticket, launcherUrl, trackerId }) {
  const exe = path.join(dir, "RobloxPlayerBeta.exe");
  if (!fs.existsSync(exe)) throw new Error("Roblox Player not found");
  const args = ["--app", "-t", ticket, "-j", launcherUrl, "-b", String(trackerId), `--launchtime=${Date.now()}`, "--rloc", "en_us", "--gloc", "en_us"];
  const p = spawn(exe, args, { cwd: dir, detached: true, stdio: "ignore", windowsHide: false });
  p.unref();
  return p;
}

module.exports = { Splash, canFastLaunch, directLaunch, latestVersion };
