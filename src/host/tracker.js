const JOIN = /! Joining game '([0-9a-f-]{36})' place (\d+)/i;
const UNIVERSE = /placeid:(\d+).*?universeid:(\d+)/i;
const LEAVE = /Time to disconnect replication data|Client:Disconnect|leaveUGCGameInternal|NetworkClient:Remove/i;
const DROPPED = /Disconnection Notification\. Reason: (\d+)|Lost connection with reason/i;
const UDMUX = /UDMUX Address = (\d{1,3}(?:\.\d{1,3}){3})/i;

export function createTracker(rust, emit) {
  let data = { games: {}, days: {}, history: [] };
  let file = null, offset = -1, current = null;
  const save = () => rust("store:set", "playtime", data).catch(() => {});
  const summary = () => ({ games: data.games, days: data.days, history: data.history || [], sessions: data.sessionLog || [], current: current ? { ...current } : null });
  const handlers = { start: [], end: [], server: [] };
  const fire = (k, v) => handlers[k].forEach((f) => f(v));

  function flush(force) {
    const c = current;
    if (!c || !c.universeId) return;
    const now = Date.now(), secs = Math.round((now - c.lastFlush) / 1000);
    if (secs < 15 && !force) return;
    c.lastFlush = now;
    const g = (data.games[c.universeId] ||= { seconds: 0, sessions: 0, lastPlayed: 0, placeId: c.placeId });
    g.seconds += secs; g.lastPlayed = now;
    const day = new Date().toISOString().slice(0, 10);
    data.days[day] = (data.days[day] || 0) + secs;
    save(); emit("playtime:update", summary());
  }
  function end(reason) {
    const c = current;
    if (!c) return;
    if (c.dropped && reason === "Roblox closed") reason = "disconnected";
    if (c.universeId) {
      flush(true);
      data.games[c.universeId].sessions += 1;
      const s = (data.sessionLog ||= []);
      s.push({ u: c.universeId, start: c.startedAt, end: Date.now() });
      if (s.length > 1500) s.splice(0, s.length - 1500);
      save();
    }
    current = null;
    fire("end", { reason, session: { ...c } });
    emit("playtime:update", summary());
  }
  function remember(entry) {
    const h = (data.history ||= []);
    const i = h.findIndex((x) => x.jobId === entry.jobId);
    if (i >= 0) h.splice(i, 1);
    h.unshift(entry); h.length = Math.min(h.length, 30);
    save();
  }
  function line(l) {
    let m;
    if ((m = JOIN.exec(l))) {
      end("switched server");
      current = { jobId: m[1], placeId: Number(m[2]), universeId: null, startedAt: Date.now(), lastFlush: Date.now() };
      fire("start", { ...current });
    } else if ((m = UNIVERSE.exec(l)) && current && Number(m[1]) === current.placeId && !current.universeId) {
      current.universeId = Number(m[2]);
      remember({ jobId: current.jobId, placeId: current.placeId, universeId: current.universeId, at: current.startedAt });
      fire("start", { ...current });
    } else if ((m = UDMUX.exec(l)) && current && !current.ip) {
      current.ip = m[1]; fire("server", { ...current });
    } else if ((m = DROPPED.exec(l)) && current) {
      if (m[1] !== "0") current.dropped = m[1] ? `code ${m[1]}` : "lost connection";
    } else if (LEAVE.test(l)) end(current?.dropped ? "disconnected" : "left game");
  }
  async function poll() {
    try {
      const r = await rust("rlog:read", file, offset);
      if (!r) return;
      if (offset < 0) { file = r.file; offset = r.size; return; }
      if (r.file !== file) { file = r.file; }
      offset = r.offset;
      if (r.text) for (const l of r.text.split(/\r?\n/)) line(l);
      flush(false);
    } catch { }
  }
  async function checkProcess() {
    if (!current) return;
    if (!(await rust("proc:running", "RobloxPlayerBeta.exe").catch(() => true))) end("Roblox closed");
  }
  return {
    async start() {
      data = (await rust("store:get", "playtime").catch(() => null)) || data;
      poll(); setInterval(poll, 2500); setInterval(checkProcess, 6000);
    },
    on: (k, f) => handlers[k].push(f),
    summary,
    setMeta(universeId, meta) { Object.assign((data.games[universeId] ||= { seconds: 0, sessions: 0, lastPlayed: Date.now() }), meta); save(); emit("playtime:update", summary()); },
    get current() { return current; },
  };
}
