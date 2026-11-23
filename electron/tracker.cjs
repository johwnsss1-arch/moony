// Watches Roblox's own client logs to know when you join and leave a game,
// whether it was launched from Moony or not. Only reads log files; it never
// touches the running game. Playtime is saved to %APPDATA%\Moony\playtime.json.
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { EventEmitter } = require("events");

const LOG_DIR = path.join(process.env.LOCALAPPDATA || "", "Roblox", "logs");
const JOIN = /! Joining game '([0-9a-f-]{36})' place (\d+)/i;
const UNIVERSE = /placeid:(\d+).*?universeid:(\d+)/i;
const LEAVE = /Time to disconnect replication data|Client:Disconnect|leaveUGCGameInternal|NetworkClient:Remove/i;
// Lines Roblox writes when you're kicked or lose connection (not a normal leave).
const DROPPED = /Disconnection Notification\. Reason: (\d+)|Lost connection with reason/i;
const UDMUX = /UDMUX Address = (\d{1,3}(?:\.\d{1,3}){3})/i;

class Tracker extends EventEmitter {
  constructor(dataDir) {
    super();
    this.file = path.join(dataDir, "playtime.json");
    this.data = this.load();
    this.logFile = null;
    this.offset = 0;
    this.current = null; // { placeId, universeId, jobId, startedAt, lastFlush }
    this.timer = null;
  }

  load() {
    try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { return { games: {}, days: {}, history: [] }; }
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data));
  }

  start() {
    // Skip anything already in existing logs: only sessions from now on count.
    const latest = this.latestLog();
    if (latest) { this.logFile = latest; this.offset = fs.statSync(latest).size; }
    this.timer = setInterval(() => this.poll(), 2500);
    this.procTimer = setInterval(() => this.checkProcess(), 6000);
  }
  stop() {
    clearInterval(this.timer);
    clearInterval(this.procTimer);
    this.end("app closing");
  }

  latestLog() {
    try {
      return fs.readdirSync(LOG_DIR)
        .filter((f) => f.endsWith(".log") && /_Player_/.test(f) && !/CrashHandler/i.test(f))
        .map((f) => path.join(LOG_DIR, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
    } catch { return null; }
  }

  poll() {
    const latest = this.latestLog();
    if (!latest) return;
    if (latest !== this.logFile) { this.logFile = latest; this.offset = 0; } // a new Roblox run
    let size;
    try { size = fs.statSync(latest).size; } catch { return; }
    if (size < this.offset) this.offset = 0;
    if (size > this.offset) {
      const fd = fs.openSync(latest, "r");
      const buf = Buffer.alloc(Math.min(size - this.offset, 2 * 1024 * 1024));
      fs.readSync(fd, buf, 0, buf.length, this.offset);
      fs.closeSync(fd);
      this.offset += buf.length;
      for (const line of buf.toString("utf8").split(/\r?\n/)) this.line(line);
    }
    this.flush();
  }

  line(l) {
    let m;
    if ((m = JOIN.exec(l))) {
      this.end("switched server");
      this.current = { jobId: m[1], placeId: Number(m[2]), universeId: null, startedAt: Date.now(), lastFlush: Date.now() };
      this.emit("start", { ...this.current });
    } else if ((m = UNIVERSE.exec(l)) && this.current && Number(m[1]) === this.current.placeId && !this.current.universeId) {
      this.current.universeId = Number(m[2]);
      this.remember({ jobId: this.current.jobId, placeId: this.current.placeId, universeId: this.current.universeId, at: this.current.startedAt });
      this.emit("start", { ...this.current });
    } else if ((m = UDMUX.exec(l)) && this.current && !this.current.ip) {
      this.current.ip = m[1];
      this.emit("server", { ...this.current });
    } else if ((m = DROPPED.exec(l)) && this.current) {
      // Code 0 is a normal close; anything else is a kick or a dropped connection.
      if (m[1] !== "0") this.current.dropped = m[1] ? `code ${m[1]}` : "lost connection";
    } else if (LEAVE.test(l)) {
      this.end(this.current?.dropped ? "disconnected" : "left game");
    }
  }

  // Roblox can close without writing a leave line; end the session if the
  // player process is gone.
  checkProcess() {
    if (!this.current) return;
    execFile("tasklist", ["/FI", "IMAGENAME eq RobloxPlayerBeta.exe", "/NH"], { windowsHide: true }, (err, out) => {
      if (!err && !/RobloxPlayerBeta/i.test(out)) this.end("Roblox closed");
    });
  }

  // Add time since the last flush to the totals (every poll, so a crash loses
  // at most a few seconds).
  flush() {
    const c = this.current;
    if (!c || !c.universeId) return;
    const now = Date.now();
    const secs = Math.round((now - c.lastFlush) / 1000);
    if (secs < 15) return;
    c.lastFlush = now;
    const g = (this.data.games[c.universeId] ||= { seconds: 0, sessions: 0, lastPlayed: 0, placeId: c.placeId });
    g.seconds += secs;
    g.lastPlayed = now;
    const day = new Date().toISOString().slice(0, 10);
    this.data.days[day] = (this.data.days[day] || 0) + secs;
    this.save();
    this.emit("update", this.summary());
  }

  end(reason) {
    const c = this.current;
    if (!c) return;
    if (c.dropped && reason === "Roblox closed") reason = "disconnected";
    if (c.universeId) {
      c.lastFlush -= 15000; // force the final partial chunk to be written
      this.flush();
      this.data.games[c.universeId].sessions += 1;
      // Session log for stats (most active hours, longest session).
      const s = (this.data.sessionLog ||= []);
      s.push({ u: c.universeId, start: c.startedAt, end: Date.now() });
      if (s.length > 1500) s.splice(0, s.length - 1500);
      this.save();
    }
    this.current = null;
    this.emit("end", { reason, session: { ...c } });
    this.emit("update", this.summary());
  }

  // Name/icon for a game. Creates the entry if the game hasn't been flushed yet
  // (the name usually arrives before the first minute of play is recorded).
  setMeta(universeId, meta) {
    const g = (this.data.games[universeId] ||= { seconds: 0, sessions: 0, lastPlayed: Date.now() });
    Object.assign(g, meta);
    this.save();
    this.emit("update", this.summary());
  }

  // Servers you were in, newest first, for "rejoin".
  remember(entry) {
    const h = (this.data.history ||= []);
    const i = h.findIndex((x) => x.jobId === entry.jobId);
    if (i >= 0) h.splice(i, 1);
    h.unshift(entry);
    h.length = Math.min(h.length, 30);
    this.save();
  }

  summary() {
    return { games: this.data.games, days: this.data.days, history: this.data.history || [], sessions: this.data.sessionLog || [], current: this.current ? { ...this.current } : null };
  }
}

module.exports = { Tracker };
