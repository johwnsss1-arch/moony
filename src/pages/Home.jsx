import { useMemo } from "react";
import { ChevronRight, Heart, History, Play, Rocket, Server, Sparkles, ThumbsUp, TrendingUp, Users } from "lucide-react";
import { useApp } from "../lib/store";
import { isDesktop } from "../lib/bridge";
import { ago, cleanName, compact, duration } from "../lib/format";
import { Carousel } from "../components/Carousel";
import { NowPlaying, PlaytimeSection } from "../components/Playtime";
import { Avatar, ErrorState, Img, Skeleton, Toggle } from "../components/ui";
import { DiscordIcon } from "../components/DiscordIcon";
import { HomeHero } from "../components/HomeHero";

const pick = (sorts, id) => (sorts.find((s) => s.id === id)?.games ?? []).slice(0, 30);

export default function Home() {
  const { sorts, loadSorts, recent } = useApp();
  const loading = sorts.status === "loading";
  const popular = pick(sorts.data, "top-playing-now");

  return (
    <div className="page home nf-home">
      <HomeHero />
      <NowPlaying />
      <section className="deck">
        {sorts.status === "error" && !recent.length ? <ErrorState message={sorts.error} onRetry={loadSorts} /> : <LaunchCard game={recent[0]} fallback={popular[0]} loading={loading && !recent.length} />}
        <StatusPanel />
      </section>

      {recent.length > 1 && <Carousel title="Jump back in" icon={History} games={recent.slice(1)} />}
      <PlaytimeSection />
      <Ranked games={popular.slice(0, 10)} loading={loading} />
      <Carousel title="Trending" icon={TrendingUp} games={pick(sorts.data, "top-trending")} loading={loading} />
      <Carousel title="Recommended for you" icon={Sparkles} games={pick(sorts.data, "top-revisited")} loading={loading} />
      <Carousel title="Up and coming" icon={Rocket} games={pick(sorts.data, "up-and-coming")} loading={loading} />
    </div>
  );
}

function LaunchCard({ game, fallback, loading }) {
  const { play, openGame, isFavorite, toggleFavorite, playtime } = useApp();
  const g = game || fallback;
  if (loading || !g) {
    return (
      <div className="launch launch-loading">
        <div className="launch-body">
          <Skeleton w={120} h={12} />
          <Skeleton w="60%" h={40} style={{ marginTop: 16 }} />
          <Skeleton w={200} h={12} style={{ marginTop: 16 }} />
          <Skeleton w={170} h={44} r={10} style={{ marginTop: 28 }} />
        </div>
      </div>
    );
  }
  const mine = game ? playtime.games?.[g.universeId]?.seconds : 0;
  const fav = isFavorite(g.universeId);
  return (
    <article className="launch" key={g.universeId}>
      <Img src={g.banner || g.icon} className={"launch-art" + (g.banner ? "" : " from-icon")} />
      <div className="launch-shade" />
      <div className="launch-body">
        <span className="launch-kicker">{game ? <><History size={13} /> Continue playing{game.playedAt ? ` · ${ago(game.playedAt)}` : ""}</> : <><Users size={13} /> Most played on Roblox right now</>}</span>
        <h2 title={g.name}>{cleanName(g.name)}</h2>
        <div className="launch-meta">
          {g.playing != null && <span><Users size={13} /> {compact(g.playing)} playing</span>}
          {g.rating != null && <span><ThumbsUp size={13} /> {g.rating}%</span>}
          {mine > 0 && <span>You've played {duration(mine)}</span>}
          {g.creator && <span>by {g.creator}</span>}
        </div>
        <div className="launch-actions">
          <button className="btn primary lg launch-play" onClick={() => play(g)}><Play size={17} fill="currentColor" /> Play</button>
          <button className="btn secondary lg" onClick={() => openGame(g)}><Server size={15} /> Pick a server</button>
          <button className={"btn secondary lg icon-only" + (fav ? " fav-on" : "")} aria-label={fav ? "Remove from favorites" : "Add to favorites"} aria-pressed={fav} onClick={() => toggleFavorite(g)}><Heart size={16} fill={fav ? "currentColor" : "none"} /></button>
        </div>
      </div>
    </article>
  );
}

function StatusPanel() {
  const { activeAccount, launchAs, friends, settings, updateSettings, setPage, discordState } = useApp();
  const online = launchAs ? friends.data.filter((f) => f.presence?.type > 0) : [];
  const inGame = online.filter((f) => f.presence?.type === 2);
  const discordText = { on: "Showing your game", connected: "Showing your game", off: "Off", unavailable: "Discord isn't running" }[discordState] || (settings.discordEnabled ? "Waiting for Discord" : "Off");
  return (
    <aside className="status">
      <button className="status-row" onClick={() => setPage("accounts")}>
        {activeAccount ? <Avatar src={activeAccount.avatar} size={32} alt={activeAccount.name} /> : <span className="status-ic"><Users size={15} /></span>}
        <span className="grow"><small>Account</small><b>{activeAccount ? activeAccount.displayName : "Not signed in"}</b></span>
        <span className="status-go">{activeAccount ? (launchAs ? "Signed in" : "Profile only") : "Sign in"}<ChevronRight size={14} /></span>
      </button>
      <button className="status-row" onClick={() => setPage("friends")} disabled={!launchAs}>
        <span className="status-ic"><Users size={15} /></span>
        <span className="grow"><small>Friends</small><b>{!launchAs ? "Sign in to see friends" : friends.status === "loading" ? "Checking…" : `${online.length} online`}</b></span>
        {launchAs && inGame.length > 0 && (
          <span className="status-faces">{inGame.slice(0, 3).map((f) => <Avatar key={f.id} src={f.avatar} size={22} alt={f.name} />)}<em>{inGame.length} in game</em></span>
        )}
      </button>
      <div className="status-row static">
        <span className="status-ic boost"><Rocket size={15} /></span>
        <span className="grow"><small>Boost mode</small><b>{settings.boost ? "On while you play" : "Off"}</b></span>
        {isDesktop ? <Toggle checked={!!settings.boost} onChange={(v) => updateSettings({ boost: v })} label="Boost mode" /> : <span className="status-go muted">Desktop app</span>}
      </div>
      <button className="status-row" onClick={() => setPage("settings")}>
        <span className="status-ic discord"><DiscordIcon size={15} /></span>
        <span className="grow"><small>Discord status</small><b>{discordText}</b></span>
        <span className="status-go"><ChevronRight size={14} /></span>
      </button>
    </aside>
  );
}

function Ranked({ games, loading }) {
  const { play, openGame } = useApp();
  const top = games[0]?.playing || 1;
  const rows = useMemo(() => games.map((g, i) => ({ g, i, share: Math.max(0.04, (g.playing || 0) / top) })), [games, top]);
  return (
    <section className="ranked">
      <header className="section-head"><h2><TrendingUp size={16} />Most played right now</h2></header>
      <ol className="rank-list">
        {loading ? Array.from({ length: 10 }, (_, i) => <li key={i} className="rank-row"><span className="rank-n">{i + 1}</span><Skeleton w={40} h={40} r={8} /><span className="grow"><Skeleton w="50%" h={12} /><Skeleton w="30%" h={8} style={{ marginTop: 8 }} /></span></li>)
          : rows.map(({ g, i, share }) => (
            <li key={g.universeId} className="rank-row" onClick={() => openGame(g)}>
              <span className="rank-n">{i + 1}</span>
              <Img src={g.icon} className="rank-art" />
              <span className="grow rank-txt">
                <b title={g.name}>{cleanName(g.name)}</b>
                <span className="rank-bar"><i style={{ width: `${share * 100}%` }} /></span>
              </span>
              <span className="rank-count">{compact(g.playing)}</span>
              <button className="rank-play" aria-label={`Play ${g.name}`} onClick={(e) => { e.stopPropagation(); play(g); }}><Play size={13} fill="currentColor" /></button>
            </li>
          ))}
      </ol>
    </section>
  );
}
