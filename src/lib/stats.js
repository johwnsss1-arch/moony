// Numbers derived from the playtime data the main process records.
const DAY = 86400000;
export const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// Consecutive days with any play, ending today (or yesterday, so an evening
// streak doesn't read 0 in the morning).
export function streak(days = {}) {
  let n = 0;
  let d = Date.now();
  if (!days[dayKey(d)]) d -= DAY;
  while (days[dayKey(d)] > 0) { n++; d -= DAY; }
  return n;
}

export function bestStreak(days = {}) {
  const keys = Object.keys(days).filter((k) => days[k] > 0).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) {
    run = prev && new Date(k) - new Date(prev) === DAY ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

// Seconds played per hour of the day (0-23), from the session log.
export function hourly(sessions = []) {
  const h = Array(24).fill(0);
  for (const s of sessions) {
    let t = s.start;
    while (t < s.end) {
      const next = Math.min(s.end, new Date(t).setMinutes(60, 0, 0));
      h[new Date(t).getHours()] += (next - t) / 1000;
      t = next;
    }
  }
  return h;
}

export function sessionStats(sessions = [], universeId) {
  const list = universeId ? sessions.filter((s) => s.u === Number(universeId)) : sessions;
  const lens = list.map((s) => (s.end - s.start) / 1000);
  const longest = list.reduce((b, s) => ((s.end - s.start) > (b ? b.end - b.start : -1) ? s : b), null);
  return {
    count: list.length,
    longest: longest ? (longest.end - longest.start) / 1000 : 0,
    longestGame: longest?.u ?? null,
    average: lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0,
  };
}

// Seconds per day for the last N days, optionally for one game.
export function daily(sessions = [], nDays = 14, universeId) {
  const out = Array.from({ length: nDays }, (_, i) => ({ day: dayKey(Date.now() - (nDays - 1 - i) * DAY), secs: 0 }));
  const idx = Object.fromEntries(out.map((d, i) => [d.day, i]));
  for (const s of sessions) {
    if (universeId && s.u !== Number(universeId)) continue;
    const i = idx[dayKey(s.start)];
    if (i != null) out[i].secs += (s.end - s.start) / 1000;
  }
  return out;
}
