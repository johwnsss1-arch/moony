import { useMemo, useState } from "react";
import { Copy, Crown, LogOut, PartyPopper, Search, Users } from "lucide-react";
import { useApp } from "../lib/store";
import { Avatar, Empty } from "../components/ui";

const STATE = {
  playing: "In a game: you'll follow them in",
  joining: "Joining their server…",
  hidden: "In a game, but their joins are private",
  online: "Online, waiting for them to join a game",
  offline: "Offline, waiting for them to come online",
};

// Party mode: pick a friend as leader and Moony follows them into every
// server they join, using Roblox presence. Each friend in the party picks
// the same leader in their own Moony.
export default function Party() {
  const { friends, party, setParty, launchAs, toast, setPage } = useApp();
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const f = friends.data.filter((x) => !q || `${x.displayName} ${x.name}`.toLowerCase().includes(q.toLowerCase()));
    return [...f].sort((a, b) => (b.presence?.type || 0) - (a.presence?.type || 0));
  }, [friends.data, q]);

  if (!launchAs) return (
    <div className="page"><div className="page-head"><h1>Party</h1></div>
      <Empty icon={PartyPopper} title="Sign in to start a party" text="Party mode follows a friend into their servers, so it needs your Roblox account." action={<button className="btn primary" onClick={() => setPage("accounts")}>Sign in</button>} />
    </div>
  );

  const invite = () => {
    const leader = party?.leader || launchAs;
    navigator.clipboard?.writeText(`Join my Moony party! Open Moony → Party and follow ${leader.displayName} (@${leader.name}). Get Moony: https://moonylauncher.xyz`);
    toast("Invite copied: paste it to your friends", "success");
  };

  return (
    <div className="page party-page">
      <div className="page-head row">
        <div><h1>Party</h1><p>Pick a leader. Whenever they join a server, Moony puts you in the same one, automatically.</p></div>
        <button className="btn secondary" onClick={invite}><Copy size={14} /> Copy invite</button>
      </div>

      {party?.leader ? (
        <div className="party-card settings-group">
          <Avatar src={party.leader.avatar} size={56} />
          <div className="grow">
            <span className="np-label"><Crown size={11} /> Party leader</span>
            <b>{party.leader.displayName}</b>
            <small>{party.where && party.state !== "offline" ? `${party.where} · ` : ""}{STATE[party.state] || "Checking…"}</small>
          </div>
          <button className="btn ghost" onClick={() => { setParty(null); toast("Left the party"); }}><LogOut size={14} /> Leave</button>
        </div>
      ) : (
        <div className="party-how settings-group">
          <div><b>1.</b> Everyone opens Moony → Party.</div>
          <div><b>2.</b> Everyone follows the same friend: the leader.</div>
          <div><b>3.</b> The leader plays normally. When they join or hop servers, the whole party follows.</div>
          <small>To lead, send the invite and just play: friends follow you from their Moony. The leader's Roblox privacy must let friends join them.</small>
        </div>
      )}

      <div className="perf-sec-head" style={{ marginTop: 20 }}><Users size={14} /><b>Follow a friend</b><span className="grow" />
        <div className="search-input sm"><Search size={13} /><input className="input" placeholder="Search friends" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {friends.status === "loading" ? <p className="muted">Loading friends…</p> : !list.length ? (
        <Empty icon={Users} title="No friends found" text={q ? "Try a different name." : "Your Roblox friends show up here."} />
      ) : (
        <div className="party-grid">
          {list.map((f) => {
            const lead = party?.leader?.id === f.id;
            return (
              <div key={f.id} className={"party-friend" + (lead ? " lead" : "")}>
                <Avatar src={f.avatar} size={38} status={f.presence?.type} />
                <div className="grow"><b>{f.displayName}</b><small>{f.presence?.type === 2 ? f.presence.lastLocation || "In game" : f.presence?.label || "Offline"}</small></div>
                <button className={"btn sm " + (lead ? "ghost" : "primary")} disabled={lead} onClick={() => { setParty({ leader: { id: f.id, displayName: f.displayName, name: f.name, avatar: f.avatar }, since: Date.now(), state: null, lastJob: null }); toast(`Following ${f.displayName}`, "success"); }}>
                  {lead ? "Leader" : "Follow"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
