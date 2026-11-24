import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Info, LogIn, Plus, RefreshCw, Search, UserMinus, Users, X } from "lucide-react";
import { useApp, useAsync } from "../lib/store";
import { api, auth } from "../lib/bridge";
import { Avatar, Empty, ErrorState, Segmented, Skeleton } from "../components/ui";

const byStatus = (a, b) => (b.presence?.type ?? 0) - (a.presence?.type ?? 0) || a.displayName.localeCompare(b.displayName);

export default function Friends() {
  const { launchAs, friends, loadFriends, signIn, setPage, accounts } = useApp();
  const [tab, setTab] = useState(launchAs ? "friends" : "following");
  useEffect(() => { if (!launchAs) setTab("following"); }, [launchAs]);

  return (
    <div className="page friends">
      <div className="page-head row">
        <div>
          <h1>Friends</h1>
          <p>{launchAs ? <>Signed in as <b className="hl">{launchAs.displayName}</b>. Join friends straight from here.</> : "See who's online and jump into their games."}</p>
        </div>
        {launchAs && tab === "friends" && (
          <button className="btn ghost" onClick={loadFriends} disabled={friends.status === "loading" || friends.status === "refreshing"}>
            <RefreshCw size={14} className={friends.status === "refreshing" || friends.status === "loading" ? "spin" : ""} /> Refresh
          </button>
        )}
      </div>

      {!launchAs && (
        <div className="notice action">
          <Info size={16} />
          <div className="grow"><b>Sign in to see your Roblox friends.</b> {accounts.length ? "Your active account is linked by profile only." : "Add a Roblox account to get started."} Until then you can follow any player by name.</div>
          {auth ? <button className="btn primary sm" onClick={() => signIn()}><LogIn size={13} /> Sign in</button>
            : <button className="btn ghost sm" onClick={() => setPage("accounts")}>Accounts</button>}
        </div>
      )}

      {launchAs && (
        <div className="tabs-row">
          <Segmented value={tab} onChange={setTab} options={[{ value: "friends", label: `Friends${friends.data.length ? ` · ${friends.data.length}` : ""}` }, { value: "following", label: "Following" }]} />
        </div>
      )}

      {launchAs && tab === "friends" ? <FriendsList /> : <Following />}
    </div>
  );
}

function FriendsList() {
  const { friends, loadFriends, joinFriend } = useApp();
  const [q, setQ] = useState("");
  if (friends.status === "loading") {
    return <div className="people">{Array.from({ length: 8 }, (_, i) => <div className="person-row" key={i}><Skeleton w={40} h={40} r={20} /><div className="grow"><Skeleton w="50%" h={12} /><Skeleton w="30%" h={10} style={{ marginTop: 6 }} /></div></div>)}</div>;
  }
  if (friends.status === "error" && !friends.data.length) return <ErrorState message={friends.error} onRetry={loadFriends} />;
  if (!friends.data.length) return <Empty icon={Users} title="No friends yet" text="Friends you add on Roblox show up here." />;

  const list = friends.data.filter((f) => !q || (f.displayName + " " + f.name).toLowerCase().includes(q.toLowerCase())).sort(byStatus);
  const online = list.filter((f) => f.presence?.type > 0);
  const offline = list.filter((f) => !(f.presence?.type > 0));
  return (
    <>
      <label className="search-field">
        <Search size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter friends" />
        {q && <button className="clear" onClick={() => setQ("")} aria-label="Clear"><X size={14} /></button>}
      </label>
      {list.length === 0 ? <p className="muted-text">No friends match “{q}”.</p> : (
        <div className="people-lists">
          <PeopleList title="Online" people={online} onJoin={joinFriend} />
          <PeopleList title="Offline" people={offline} />
        </div>
      )}
    </>
  );
}

function Following() {
  const { tracked, setTracked, toast, openProfile } = useApp();
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDeb(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  const found = useAsync(() => (deb.length >= 3 ? api("searchUsers", deb) : null), [deb]);

  const refresh = useCallback(async () => {
    if (!tracked.length) return;
    setRefreshing(true);
    try {
      const p = await api("presence", tracked.map((t) => t.id));
      setTracked((list) => list.map((t) => ({ ...t, presence: p[t.id] ?? t.presence })));
    } catch (e) { toast("Couldn't refresh status: " + e.message, "error"); }
    setRefreshing(false);
  }, [tracked.length]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 60000); return () => clearInterval(t); }, [refresh]);

  const follow = (u) => {
    if (tracked.some((t) => t.id === u.id)) return;
    setTracked((l) => [...l, { ...u, presence: null }]);
    toast(`Following ${u.displayName}`, "success");
  };
  const unfollow = (id) => setTracked((l) => l.filter((t) => t.id !== id));
  const sorted = [...tracked].sort(byStatus);

  return (
    <>
      <div className="row-gap" style={{ marginBottom: 16 }}>
        <label className="search-field grow" style={{ marginBottom: 0 }}>
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find any player by username (3+ characters)" />
          {q && <button className="clear" onClick={() => setQ("")} aria-label="Clear"><X size={14} /></button>}
        </label>
        {tracked.length > 0 && <button className="btn ghost" style={{ height: 40 }} onClick={refresh} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "spin" : ""} /> Refresh</button>}
      </div>

      {deb.length >= 3 && (
        <div className="user-results">
          {found.status === "loading" ? Array.from({ length: 5 }, (_, i) => <div className="user-card" key={i}><Skeleton w={56} h={56} r={28} /><Skeleton w="70%" h={12} style={{ marginTop: 10 }} /><Skeleton w="50%" h={10} style={{ marginTop: 6 }} /></div>)
            : found.status === "error" ? <ErrorState message={found.error} />
            : found.data?.length === 0 ? <p className="muted-text">No players match “{deb}”.</p>
            : found.data?.map((u) => {
              const has = tracked.some((t) => t.id === u.id);
              return (
                <div className="user-card clickable" key={u.id} onClick={() => openProfile(u)}>
                  <Avatar src={u.avatar} size={56} alt={u.name} />
                  <b className="ellipsis">{u.displayName} {u.verified && <BadgeCheck size={13} className="verified" />}</b>
                  <small>@{u.name}</small>
                  <button className={"btn sm " + (has ? "ghost" : "secondary")} disabled={has} onClick={(e) => { e.stopPropagation(); follow(u); }}>{has ? "Following" : <><Plus size={13} /> Follow</>}</button>
                </div>
              );
            })}
        </div>
      )}

      {tracked.length === 0 ? (
        deb.length < 3 && <Empty icon={Users} title="You're not following anyone" text="Search for a player above to follow them. Roblox shows limited status for players who aren't your friends." />
      ) : (
        <PeopleList title="Following" people={sorted} onUnfollow={unfollow} />
      )}
    </>
  );
}

function PeopleList({ title, people, onJoin, onUnfollow }) {
  const { openProfile } = useApp();
  if (!people.length) return null;
  return (
    <section>
      <h3 className="list-title">{title} <span className="count">{people.length}</span></h3>
      <div className="people">
        {people.map((p) => {
          const st = p.presence?.type ?? 0;
          return (
            <div className="person-row clickable" key={p.id} onClick={() => openProfile(p)}>
              <Avatar src={p.avatar} size={40} alt={p.name} status={st} />
              <div className="grow">
                <b className="ellipsis">{p.displayName}</b>
                <small className={"st" + st + " ellipsis"}>{p.presence ? (st === 2 && p.presence.lastLocation ? `Playing ${p.presence.lastLocation}` : p.presence.label) : "Checking…"}</small>
              </div>
              {onJoin && st === 2 && <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); onJoin(p); }}><LogIn size={13} /> Join</button>}
              {onUnfollow && <button className="btn ghost sm icon-only" title="Unfollow" onClick={(e) => { e.stopPropagation(); onUnfollow(p.id); }}><UserMinus size={14} /></button>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
