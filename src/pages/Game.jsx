import { useEffect, useState } from "react";
import { ArrowLeft, Award, BadgeCheck, CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Eye, Heart, Lock, LogIn, Play, RotateCcw, Star, ThumbsUp, UserRound, Users, X } from "lucide-react";
import { useApp, useAsync } from "../lib/store";
import { api, isDesktop } from "../lib/bridge";
import { ago, cleanName, compact } from "../lib/format";
import { ServerList } from "../components/ServerList";
import { GamePlaytime } from "../components/Playtime";
import { RichStats } from "../components/Stats";
import { Avatar, Empty, ErrorState, Img, Skeleton } from "../components/ui";

const TABS = [["overview", "Overview"], ["servers", "Servers"], ["badges", "Badges"], ["friends", "Friends"], ["stats", "Your stats"]];

export default function Game({ seed }) {
  const { play, isFavorite, toggleFavorite, playtime } = useApp();
  const [tab, setTab] = useState(seed.tab || "overview");
  const st = useAsync(() => api("gameDetails", seed.universeId), [seed.universeId]);
  const media = useAsync(() => api("gameMedia", seed.universeId), [seed.universeId]);
  const g = { ...seed, ...(st.data || {}) };
  const fav = isFavorite(g.universeId);
  const mine = playtime.games?.[g.universeId];
  useEffect(() => setTab(seed.tab || "overview"), [seed.universeId, seed.tab]);

  return (
    <div className="game-page">
      <div className="gp-hero">
        <Img src={(media.data && media.data[0]) || g.banner || g.icon} className="gp-hero-art" />
        <div className="gp-hero-shade" />
        <div className="gp-hero-content">
          <Img src={g.icon} className="gp-icon" />
          <div className="grow">
            <h1 title={g.name}>{cleanName(g.name || "")}</h1>
            <div className="gp-meta">
              {g.creator?.name && <span><UserRound size={13} /> {g.creator.name} {g.creator.verified && <BadgeCheck size={13} className="verified" />}</span>}
              {g.playing != null && <span><Users size={13} /> {compact(g.playing)} playing</span>}
              {g.rating != null && <span><ThumbsUp size={13} /> {g.rating}%</span>}
              {g.genre && <span>{g.genre}</span>}
            </div>
          </div>
          <div className="gp-actions">
            <button className={"btn glass lg icon-only" + (fav ? " fav-on" : "")} onClick={() => toggleFavorite(g)} aria-label="Favorite"><Heart size={17} fill={fav ? "currentColor" : "none"} /></button>
            <button className="btn primary lg" onClick={() => play(g)}><Play size={16} fill="currentColor" /> Play</button>
          </div>
        </div>
      </div>

      <div className="page gp-body">
        <div className="underline-tabs">
          {TABS.filter(([id]) => isDesktop || id !== "stats").map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}{id === "stats" && mine?.seconds ? <span className="count">{Math.round(mine.seconds / 3600)}h</span> : null}</button>
          ))}
        </div>

        <div key={tab} className="tab-body">
          {tab === "overview" && <Overview g={g} st={st} media={media} />}
          {tab === "servers" && <ServerList game={g} />}
          {tab === "badges" && <Badges universeId={g.universeId} />}
          {tab === "friends" && <GameFriends game={g} />}
          {tab === "stats" && <><GamePlaytime universeId={g.universeId} /><RichStats universeId={g.universeId} /><GameHistory universeId={g.universeId} /></>}
        </div>
      </div>
    </div>
  );
}

function Overview({ g, st, media }) {
  const [more, setMore] = useState(false);
  const [view, setView] = useState(null);
  const shots = media.data || [];
  const desc = g.description || "";
  return (
    <>
      {media.status === "loading" ? <div className="shots"><Skeleton h={150} r={12} /><Skeleton h={150} r={12} /><Skeleton h={150} r={12} /></div>
        : shots.length > 0 && (
          <div className="shots">
            {shots.map((s, i) => <button key={s} className="shot" onClick={() => setView(i)}><Img src={s} /></button>)}
          </div>
        )}
      <div className="stats">
        <Stat icon={Users} label="Playing" value={st.data ? compact(g.playing) : null} />
        <Stat icon={ThumbsUp} label="Rating" value={st.data ? (g.rating != null ? g.rating + "%" : "—") : null} />
        <Stat icon={Eye} label="Visits" value={st.data ? compact(g.visits) : null} />
        <Stat icon={Star} label="Favorites" value={st.data ? compact(g.favorites) : null} />
        <Stat icon={CalendarClock} label="Updated" value={st.data ? ago(g.updated) : null} />
      </div>
      <div className="gp-about">
        <GamePlaytime universeId={g.universeId} />
        <h4>About</h4>
        {st.status === "error" ? <ErrorState message={st.error} /> : !st.data ? <><Skeleton w="100%" h={11} /><Skeleton w="80%" h={11} style={{ marginTop: 7 }} /></> : (
          <>
            <p className={"desc" + (more ? " open" : "")}>{desc || "This experience has no description."}</p>
            {desc.length > 280 && <button className="link" onClick={() => setMore((m) => !m)}>{more ? "Show less" : "Show more"}</button>}
          </>
        )}
        <div className="details-foot">
          {st.data?.maxPlayers && <span className="tag">{st.data.maxPlayers} max per server</span>}
          {st.data?.created && <span className="tag">Created {new Date(st.data.created).toLocaleDateString(undefined, { year: "numeric", month: "short" })}</span>}
        </div>
      </div>
      {view != null && (
        <div className="lightbox" onClick={() => setView(null)}>
          <button className="lb-close" aria-label="Close"><X size={18} /></button>
          {shots.length > 1 && <button className="lb-nav l" onClick={(e) => { e.stopPropagation(); setView((v) => (v + shots.length - 1) % shots.length); }}><ChevronLeft size={22} /></button>}
          <img src={shots[view]} alt="" onClick={(e) => e.stopPropagation()} />
          {shots.length > 1 && <button className="lb-nav r" onClick={(e) => { e.stopPropagation(); setView((v) => (v + 1) % shots.length); }}><ChevronRight size={22} /></button>}
        </div>
      )}
    </>
  );
}

const Stat = ({ icon: Icon, label, value }) => (
  <div className="stat"><span className="stat-label"><Icon size={12} /> {label}</span>{value == null ? <Skeleton w={54} h={16} style={{ marginTop: 6 }} /> : <b>{value}</b>}</div>
);

function Badges({ universeId }) {
  const { activeAccount } = useApp();
  const st = useAsync(() => api("badges", universeId, activeAccount?.id), [universeId, activeAccount?.id]);
  const [filter, setFilter] = useState("all");
  if (st.status === "loading") return <div className="badge-grid">{Array.from({ length: 8 }, (_, i) => <div className="badge" key={i}><Skeleton w={56} h={56} r={14} /><div className="grow"><Skeleton w="60%" h={12} /><Skeleton w="90%" h={10} style={{ marginTop: 6 }} /></div></div>)}</div>;
  if (st.status === "error") return <ErrorState message={st.error} />;
  const all = st.data || [];
  if (!all.length) return <Empty icon={Award} title="No badges" text="This game doesn't award any badges." />;
  const owned = all.filter((b) => b.owned).length;
  const list = filter === "owned" ? all.filter((b) => b.owned) : filter === "missing" ? all.filter((b) => !b.owned) : all;
  return (
    <>
      <div className="badges-head">
        {activeAccount ? <span><b>{owned}</b> of {all.length} earned by {activeAccount.displayName}</span> : <span>{all.length} badges · add an account to see which you have</span>}
        {activeAccount && <div className="segmented">{[["all", "All"], ["owned", "Earned"], ["missing", "Not yet"]].map(([v, l]) => <button key={v} className={filter === v ? "on" : ""} onClick={() => setFilter(v)}>{l}</button>)}</div>}
      </div>
      {activeAccount && <div className="badge-progress"><i style={{ width: `${(owned / all.length) * 100}%` }} /></div>}
      <div className="badge-grid">
        {list.map((b) => (
          <div key={b.id} className={"badge" + (activeAccount && !b.owned ? " locked" : "")}>
            <div className="badge-icon"><Img src={b.icon} />{activeAccount && !b.owned && <Lock size={14} className="badge-lock" />}</div>
            <div className="grow">
              <b>{b.name}</b>
              <small className="badge-desc">{b.description}</small>
              <small>{b.owned ? `Earned ${new Date(b.owned).toLocaleDateString()}` : `${compact(b.awarded)} players have it`}{b.winRate ? ` · ${(b.winRate * 100).toFixed(b.winRate < 0.01 ? 2 : 1)}% win rate` : ""}</small>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function GameFriends({ game }) {
  const { launchAs, friends, joinFriend, openProfile, signIn } = useApp();
  if (!launchAs) return <Empty icon={Users} title="Sign in to see friends here" text="See which of your friends are playing this game right now." action={<button className="btn primary" onClick={() => signIn()}><LogIn size={14} /> Sign in</button>} />;
  const here = friends.data.filter((f) => f.presence?.type === 2 && (Number(f.presence.placeId) === Number(game.placeId) || (game.name && f.presence.lastLocation && cleanName(f.presence.lastLocation) === cleanName(game.name))));
  if (!here.length) return <Empty icon={Users} title="No friends playing right now" text="Friends who are in this game show up here with a Join button." />;
  return (
    <div className="people">
      {here.map((f) => (
        <div className="person-row clickable" key={f.id} onClick={() => openProfile(f)}>
          <Avatar src={f.avatar} size={40} alt={f.name} status={2} />
          <div className="grow"><b>{f.displayName}</b><small className="st2">Playing now</small></div>
          <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); joinFriend(f); }}><LogIn size={13} /> Join</button>
        </div>
      ))}
    </div>
  );
}

function GameHistory({ universeId }) {
  const { playtime, play } = useApp();
  const list = (playtime.history || []).filter((h) => h.universeId === Number(universeId)).slice(0, 6);
  if (!list.length) return null;
  const g = playtime.games?.[universeId] || {};
  return (
    <>
      <h3 className="list-title" style={{ marginTop: 24 }}>Your recent servers</h3>
      <div className="recent-servers">
        {list.map((h) => (
          <div className="rs-row" key={h.jobId}>
            <div className="grow"><b>Server {h.jobId.slice(0, 8)}</b><small>{ago(h.at)}</small></div>
            <button className="btn secondary sm" onClick={() => play({ universeId: h.universeId, placeId: h.placeId, name: g.name || "game", icon: g.icon }, { jobId: h.jobId })}><RotateCcw size={12} /> Rejoin</button>
          </div>
        ))}
      </div>
    </>
  );
}
