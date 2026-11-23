export function compact(n) {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
  return String(n);
}

// 0 → "0m", 4500 → "1h 15m", 200000 → "55h 33m"
export function duration(seconds = 0) {
  const m = Math.floor(seconds / 60);
  if (seconds > 0 && m === 0) return "<1m"; // played, just under a minute
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 ? ` ${m % 60}m` : ""}`;
}

// Total of several durations that matches the per-item numbers shown
// (each item is shown in whole minutes, so add whole minutes).
export const totalSeconds = (list) => list.reduce((n, s) => n + Math.floor((s || 0) / 60) * 60, 0);

export function ago(date) {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return "just now";
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [u, n] of units) if (s >= n) { const v = Math.floor(s / n); return `${v} ${u}${v > 1 ? "s" : ""} ago`; }
  return "just now";
}

// Roblox names often carry update tags like "[🌸 UPDATE]"; strip them for compact UI.
export const cleanName = (name = "") => name.replace(/\[[^\]]*\]|【[^】]*】|\([^)]*update[^)]*\)/gi, "").replace(/\s{2,}/g, " ").trim() || name;
