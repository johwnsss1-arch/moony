const { BrowserWindow, screen, session } = require("electron");
const os = require("os");
const net = require("net");

function tcpPing(host = "www.roblox.com", port = 443) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const s = net.connect({ host, port });
    const done = (ms) => { s.destroy(); resolve(ms); };
    s.setTimeout(3000, () => done(-1));
    s.once("connect", () => done(Math.max(1, Math.round(Number(process.hrtime.bigint() - t0) / 1e6))));
    s.once("error", () => done(-1));
  });
}
const path = require("path");

let win32 = null;
function loadWin32() {
  if (win32 !== null) return win32;
  try {
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");
    const RECT = koffi.struct("MOONY_RECT", { left: "long", top: "long", right: "long", bottom: "long" });
    win32 = {
      RECT,
      foreground: user32.func("void* __stdcall GetForegroundWindow()"),
      rect: user32.func("bool __stdcall GetWindowRect(void* hwnd, _Out_ MOONY_RECT* rect)"),
      text: user32.func("int __stdcall GetWindowTextW(void* hwnd, _Out_ uint16_t* buf, int max)"),
      iconic: user32.func("bool __stdcall IsIconic(void* hwnd)"),
    };
  } catch (e) {
    console.warn("[hud] native window access unavailable:", e.message);
    win32 = false;
  }
  return win32;
}
function readForeground() {
  const w = loadWin32();
  if (!w) return null;
  const h = w.foreground();
  if (!h) return null;
  const buf = Buffer.alloc(512);
  const n = w.text(h, buf, 256);
  const r = {};
  w.rect(h, r);
  return { title: buf.toString("utf16le", 0, Math.max(0, n) * 2), x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top, min: w.iconic(h) };
}

class Overlay {
  constructor({ devUrl, distDir, getNowPlaying, getMedia, onStatus }) {
    this.devUrl = devUrl;
    this.distDir = distDir;
    this.getNowPlaying = getNowPlaying;
    this.getMedia = getMedia || (() => null);
    this.lastRect = null;
    this.onStatus = onStatus;
    this.prefs = { enabled: true };
    this.win = null;
    this.proc = null;
    this.robloxFocused = false;
    this.lastCpu = os.cpus();
    this.status = { roblox: false, showing: false };
  }

  setPrefs(p) {
    if (!p) return;
    this.prefs = { ...this.prefs, ...p };
    if (!this.prefs.enabled) this.hide();
    this.push();
  }

  start() {
    this.poll = setInterval(() => { try { const f = readForeground(); if (f) this.onForeground(f); } catch { } }, 500);
    this.tick = setInterval(() => this.push(), 1000);
  }

  stop() {
    clearInterval(this.poll);
    clearInterval(this.tick);
    this.win?.destroy();
    this.win = null;
  }

  onForeground({ title, x, y, w, h, min }) {
    const isRoblox = title === "Roblox" && !min && Number(w) > 200;
    if (isRoblox !== this.robloxFocused) { this.robloxFocused = isRoblox; this.report(); }
    if (!isRoblox || !this.prefs.enabled) return this.hide();
    const rect = screen.screenToDipRect(null, { x: Number(x), y: Number(y), width: Number(w), height: Number(h) });
    if (!this.lastRect || this.lastRect.width !== rect.width || this.lastRect.height !== rect.height) { this.lastRect = rect; this.report(); }
    this.show(rect);
  }

  ensureWindow() {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const partition = "overlay";
    session.fromPartition(partition).setDisplayMediaRequestHandler((_req, cb) => {
      require("electron").desktopCapturer.getSources({ types: ["screen"] }).then((s) => cb({ video: s[0], audio: "loopback" })).catch(() => cb({}));
    });
    this.win = new BrowserWindow({
      show: false, frame: false, transparent: true, backgroundColor: "#00000000", resizable: false, movable: false,
      focusable: false, skipTaskbar: true, hasShadow: false, alwaysOnTop: true, title: "Moony HUD",
      webPreferences: { preload: path.join(__dirname, "overlay-preload.cjs"), partition, contextIsolation: true, sandbox: true, backgroundThrottling: false },
    });
    this.win.setAlwaysOnTop(true, "screen-saver");
    this.win.setIgnoreMouseEvents(true);
    if (this.devUrl) this.win.loadURL(this.devUrl.replace(/\/?$/, "/overlay.html"));
    else this.win.loadFile(path.join(this.distDir, "overlay.html"));
    this.win.webContents.on("did-finish-load", () => this.push());
    return this.win;
  }

  show(rect) {
    const w = this.ensureWindow();
    const b = w.getBounds();
    if (b.x !== rect.x || b.y !== rect.y || b.width !== rect.width || b.height !== rect.height) w.setBounds(rect);
    if (!w.isVisible()) { w.showInactive(); this.status.showing = true; this.report(); }
  }

  hide() {
    if (this.win && !this.win.isDestroyed() && this.win.isVisible()) { this.win.hide(); this.status.showing = false; this.report(); }
  }

  report() { this.onStatus?.({ roblox: this.robloxFocused, showing: !!(this.win && !this.win.isDestroyed() && this.win.isVisible()), enabled: !!this.prefs.enabled, size: this.lastRect ? { width: this.lastRect.width, height: this.lastRect.height } : null }); }

  system() {
    const now = os.cpus();
    let idle = 0, total = 0;
    now.forEach((c, i) => {
      const a = c.times, b = this.lastCpu[i]?.times || a;
      const t = (x) => x.user + x.nice + x.sys + x.idle + x.irq;
      idle += a.idle - b.idle; total += t(a) - t(b);
    });
    this.lastCpu = now;
    return { cpu: total ? Math.round(100 * (1 - idle / total)) : 0, ram: Math.round(100 * (1 - os.freemem() / os.totalmem())) };
  }

  push() {
    if (!this.win || this.win.isDestroyed()) return;
    if (this.prefs?.widgets?.ping?.on && this.status?.showing !== false && Date.now() - (this.pingAt || 0) > 5000) {
      this.pingAt = Date.now();
      tcpPing().then((ms) => { this.ping = ms; });
    }
    this.win.webContents.send("overlay:state", { prefs: this.prefs, now: this.getNowPlaying(), media: this.getMedia(), system: this.system(), ping: this.ping ?? null, time: Date.now() });
  }
}

module.exports = { Overlay };
