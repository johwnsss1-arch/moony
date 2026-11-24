// Moony Clips: an instant-replay buffer for the Roblox window.
// While a game is running, a hidden window records the Roblox window and your
// PC's sound in short segments, keeping only the last minute or so in memory.
// Press the clip hotkey and the last N seconds are saved as a video, with a
// short Moony outro (logo, website, Discord) at the end.
const { BrowserWindow, desktopCapturer, globalShortcut, ipcMain, Notification, session, shell, app } = require("electron");
const fs = require("fs");
const path = require("path");

const DEFAULTS = { enabled: false, hotkey: "Alt+C", seconds: 30, fps: 60, quality: "1080", outro: true, sound: true };

class Clips {
  constructor({ icon, onSaved }) {
    this.icon = icon;
    this.onSaved = onSaved;
    this.prefs = { ...DEFAULTS };
    this.win = null;
    this.active = false;
    this.hotkey = null;
    this.saving = false;
    // Allow screen capture only for Moony's own recorder page.
    session.fromPartition("moony-clipper").setPermissionRequestHandler((_wc, perm, cb) => cb(perm === "media"));
    ipcMain.handle("clipper:save", (e, { bytes, ext }) => {
      if (!this.win || e.sender !== this.win.webContents) return null;
      return this.write(Buffer.from(bytes), ext);
    });
    ipcMain.on("clipper:status", (e, s) => { if (this.win && e.sender === this.win.webContents) this.status = s; });
  }

  folder() {
    const dir = path.join(app.getPath("videos"), "Moony Clips");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  write(buf, ext) {
    const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
    const name = `Moony ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}.${p2(d.getMinutes())}.${p2(d.getSeconds())}.${ext === "mp4" ? "mp4" : "webm"}`;
    const file = path.join(this.folder(), name);
    fs.writeFileSync(file, buf);
    const n = new Notification({ title: "Clip saved", body: `${name} · click to open the folder`, icon: this.icon, silent: true });
    n.on("click", () => shell.showItemInFolder(file));
    n.show();
    this.onSaved?.(file);
    return file;
  }

  setPrefs(p = {}) {
    const next = { ...DEFAULTS, ...this.prefs, ...p };
    next.seconds = [15, 30, 45, 60, 90].includes(Number(next.seconds)) ? Number(next.seconds) : 30;
    next.fps = Number(next.fps) === 30 ? 30 : 60;
    next.quality = ["720", "1080", "1440"].includes(String(next.quality)) ? String(next.quality) : "1080";
    const changed = JSON.stringify(next) !== JSON.stringify(this.prefs);
    this.prefs = next;
    if (!changed) return;
    if (!next.enabled) return this.stop();
    if (this.active) { this.stop(); this.start(); }
  }

  // Called when a Roblox game starts.
  start() {
    if (!this.prefs.enabled || this.active) return;
    this.active = true;
    this.win = new BrowserWindow({
      show: false, width: 320, height: 200, skipTaskbar: true,
      webPreferences: { partition: "moony-clipper", preload: path.join(__dirname, "clipper-preload.cjs"), backgroundThrottling: false, contextIsolation: true, sandbox: true },
    });
    // Wait for the Roblox window to exist, then point the recorder at it.
    const load = async (tries = 0) => {
      if (!this.win || this.win.isDestroyed()) return;
      const list = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: 0, height: 0 } }).catch(() => []);
      const rbx = list.find((s) => s.name === "Roblox");
      if (!rbx) { if (tries < 30) setTimeout(() => load(tries + 1), 2000); return; }
      const q = new URLSearchParams({ src: rbx.id, seconds: this.prefs.seconds, fps: this.prefs.fps, h: this.prefs.quality, outro: this.prefs.outro ? 1 : 0, sound: this.prefs.sound ? 1 : 0, icon: this.iconData() });
      this.win.loadFile(path.join(__dirname, "clipper.html"), { search: q.toString() });
    };
    setTimeout(load, 3000);
    this.bindKey();
  }

  stop() {
    this.active = false;
    this.unbindKey();
    if (this.win && !this.win.isDestroyed()) {
      // Let a clip that's being saved finish first.
      const w = this.win;
      this.win = null;
      if (this.saving) setTimeout(() => !w.isDestroyed() && w.destroy(), 120000); else w.destroy();
    }
  }

  bindKey() {
    this.unbindKey();
    try {
      if (globalShortcut.register(this.prefs.hotkey, () => this.clip())) this.hotkey = this.prefs.hotkey;
    } catch { /* invalid accelerator */ }
  }
  unbindKey() { if (this.hotkey) { try { globalShortcut.unregister(this.hotkey); } catch {} this.hotkey = null; } }

  async clip() {
    if (!this.win || this.win.isDestroyed()) return { ok: false, error: "Clips start when a game is running" };
    this.saving = true;
    try {
      const n = new Notification({ title: "Saving clip…", body: `The last ${this.prefs.seconds} seconds. It's ready in a moment.`, icon: this.icon, silent: true });
      n.show();
      const r = await this.win.webContents.executeJavaScript("window.saveClip()");
      return r;
    } catch (e) {
      return { ok: false, error: e.message };
    } finally { this.saving = false; }
  }

  iconData() {
    try { return "data:image/png;base64," + fs.readFileSync(this.icon).toString("base64"); } catch { return ""; }
  }
}

module.exports = { Clips, CLIP_DEFAULTS: DEFAULTS };
