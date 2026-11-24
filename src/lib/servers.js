import { api } from "./bridge";

// Picks a public server for a place.
// mode "ping": the lowest-ping server with room. "hop": a random server with room
// that isn't `exclude`. Reads up to 3 pages (300 servers).
export async function pickServer(placeId, mode = "ping", exclude = null) {
  let cursor = "", all = [];
  for (let i = 0; i < 3; i++) {
    const r = await api("servers", placeId, { order: "Desc", cursor, hideFull: true });
    all = all.concat(r.servers);
    if (!r.next || (mode === "ping" && all.length >= 100)) break;
    cursor = r.next;
  }
  const open = all.filter((s) => s.id !== exclude && s.playing < s.max - 1);
  if (!open.length) return null;
  if (mode === "hop") return open[Math.floor(Math.random() * open.length)];
  // Fewer than 3 players can mean a dead server: prefer active ones.
  const live = open.filter((s) => s.playing >= 3 && s.ping != null);
  return (live.length ? live : open).sort((a, b) => (a.ping ?? 9e9) - (b.ping ?? 9e9))[0];
}
