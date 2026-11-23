import { useState } from "react";
import { KeyRound, Link2, LogIn, Pencil, Plus, Trash2 } from "lucide-react";
import { useApp } from "../lib/store";
import { api, auth } from "../lib/bridge";
import { cleanName } from "../lib/format";
import { Img } from "./ui";

// Accepts the two link formats Roblox uses for private servers:
//   https://www.roblox.com/games/123/Name?privateServerLinkCode=ABC
//   https://www.roblox.com/share?code=XYZ&type=Server
function parseLink(text) {
  let u;
  try { u = new URL(text.trim()); } catch { return null; }
  if (!/(^|\.)roblox\.com$/i.test(u.hostname)) return null;
  const code = u.searchParams.get("privateServerLinkCode");
  const place = u.pathname.match(/\/games\/(\d+)/)?.[1];
  if (code && place) return { kind: "direct", placeId: Number(place), linkCode: code };
  if (/\/share/i.test(u.pathname) && u.searchParams.get("code") && /server/i.test(u.searchParams.get("type") || "")) return { kind: "share", code: u.searchParams.get("code") };
  return null;
}

export function PrivateServers({ placeId }) {
  const { privateServers, setPrivateServers, play, launchAs, toast } = useApp();
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const list = placeId ? privateServers.filter((p) => p.placeId === Number(placeId)) : privateServers;

  const add = async (e) => {
    e.preventDefault();
    setErr("");
    const parsed = parseLink(link);
    if (!parsed) return setErr("Paste a Roblox private server link (from the game's Servers tab, or a share link).");
    setBusy(true);
    try {
      let target = parsed;
      if (parsed.kind === "share") {
        if (!launchAs || !auth?.resolveLink) throw new Error("Share links need a signed-in account to open. Sign in on the Accounts page.");
        target = await auth.resolveLink(launchAs.id, parsed.code);
      }
      // Look up the game for its name and icon.
      let game = {};
      try {
        const universeId = target.universeId || (await api("placeUniverse", target.placeId).catch(() => null));
        if (universeId) game = await api("gameDetails", universeId);
      } catch { /* name stays generic */ }
      const entry = { id: `${target.placeId}:${target.linkCode}`, placeId: Number(target.placeId), linkCode: target.linkCode, universeId: game.universeId || null, name: game.name || "Private server", icon: game.icon || null, label: "" };
      if (privateServers.some((p) => p.id === entry.id)) throw new Error("That server is already saved.");
      setPrivateServers((l) => [entry, ...l]);
      toast(`Saved private server for ${entry.name}`, "success");
      setLink(""); setAdding(false);
    } catch (e2) { setErr(e2.message.replace(/^.*Error: /, "")); }
    setBusy(false);
  };

  const rename = (p) => {
    const label = window.prompt("Name this private server", p.label || "");
    if (label != null) setPrivateServers((l) => l.map((x) => (x.id === p.id ? { ...x, label: label.slice(0, 40) } : x)));
  };

  return (
    <div className="private-servers">
      {list.length === 0 && !adding && (
        <div className="ps-empty">
          <KeyRound size={16} />
          <span className="grow">Save your VIP or friends' private server links to join them in one click.</span>
          <button className="btn secondary sm" onClick={() => setAdding(true)}><Plus size={13} /> Add a link</button>
        </div>
      )}
      {list.length > 0 && (
        <div className="recent-servers">
          {list.map((p) => (
            <div className="rs-row" key={p.id}>
              <Img src={p.icon} className="rs-art" />
              <div className="grow"><b>{p.label || cleanName(p.name)}</b><small>{p.label ? cleanName(p.name) + " · " : ""}Private server</small></div>
              <button className="btn ghost sm icon-only" title="Rename" onClick={() => rename(p)}><Pencil size={12} /></button>
              <button className="btn ghost sm icon-only" title="Remove" onClick={() => setPrivateServers((l) => l.filter((x) => x.id !== p.id))}><Trash2 size={12} /></button>
              <button className="btn primary sm" onClick={() => play({ placeId: p.placeId, universeId: p.universeId, name: p.name, icon: p.icon }, { linkCode: p.linkCode })}><LogIn size={12} /> Join</button>
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <form className="ps-add" onSubmit={add}>
          <label className="search-field"><Link2 size={15} /><input autoFocus value={link} onChange={(e) => { setLink(e.target.value); setErr(""); }} placeholder="https://www.roblox.com/share?code=…&type=Server" /></label>
          <button className="btn primary" disabled={!link.trim() || busy}>{busy ? "Checking…" : "Save"}</button>
          <button type="button" className="btn ghost" onClick={() => { setAdding(false); setErr(""); }}>Cancel</button>
          {err && <div className="form-error" style={{ flexBasis: "100%" }}>{err}</div>}
        </form>
      ) : list.length > 0 && <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setAdding(true)}><Plus size={13} /> Add a link</button>}
    </div>
  );
}
