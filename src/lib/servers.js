import { api } from "./bridge";

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
  const live = open.filter((s) => s.playing >= 3 && s.ping != null);
  return (live.length ? live : open).sort((a, b) => (a.ping ?? 9e9) - (b.ping ?? 9e9))[0];
}
