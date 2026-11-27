import { useMemo } from "react";
import { History, Play, Rocket, Server, Sparkles, TrendingUp, Users } from "lucide-react";
import { useApp } from "../lib/store";
import { ago, cleanName, compact, duration } from "../lib/format";
import { dayKey } from "../lib/stats";
import { Carousel } from "../components/Carousel";
import { NowPlaying, PlaytimeSection } from "../components/Playtime";
import { ErrorState, Img, Skeleton } from "../components/ui";

const pick = (sorts, id) => (sorts.find((s) => s.id === id)?.games ?? []).slice(0, 30);

export default function Home() {
  const { sorts, loadSorts, recent } = useApp();
  const loading = sorts.status === "loading";
  const popular = pick(sorts.data, "top-playing-now");
  const shelf = recent.length ? recent.slice(0, 12) : popular.slice(0, 12);

  return (
    <div className="page home nf-home">
      <Hero game={recent[0] || popular[0]} isRecent={!!recent[0]} />
      <NowPlaying />
      {sorts.status === "error" && !recent.length ? <ErrorState message={sorts.error} onRetry={loadSorts} /> : (
        <section className="covers-sec">
          <header className="section-head"><h2>{recent.length ? <><History size={16} />Jump back in</> : <><Users size={16} />Popular right now</>}</h2></header>
          <div className="covers">
            {loading && !shelf.length ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} w="100%" h={0} r={14} style={{ aspectRatio: "1" }} />)
              : shelf.map((g, i) => <Cover key={g.universeId} game={g} i={i} />)}
          </div>
        </section>
      )}
      <PlaytimeSection />
      <Ranked games={popular.slice(0, 10)} loading={loading} />
      <Carousel title="Trending" icon={TrendingUp} games={pick(sorts.data, "top-trending")} loading={loading} />
      <Carousel title="Recommended for you" icon={Sparkles} games={pick(sorts.data, "top-revisited")} loading={loading} />
      <Carousel title="Up and coming" icon={Rocket} games={pick(sorts.data, "up-and-coming")} loading={loading} />
    </div>
  );
}

function Hero({ game, isRecent }) {
  const { play, openGame, launchAs, friends, settings, playtime } = useApp();
  const online = launchAs ? friends.data.filter((f) => f.presence?.type > 0).length : null;
  let week = 0;
  for (let i = 0; i < 7; i++) week += playtime.days?.[dayKey(new Date(Date.now() - i * 86400000))] || 0;
  return (
    <header className="tw-hero">
      <h1>Roblox, <b>launched your way.</b></h1>
      <p>
        {game ? <>{isRecent ? "Pick up " : "Try "}<b>{cleanName(game.name)}</b>{isRecent ? " where you left off" : ", the most played game right now"}</> : "Loading games…"}
        {week > 0 && <>, after <b>{duration(week)}</b> of play this week</>}.
      </p>
      <div className="tw-cta">
        <button className="btn primary lg" disabled={!game} onClick={() => play(game)}><Play size={16} fill="currentColor" /> Play</button>
        <button className="btn secondary lg" disabled={!game} onClick={() => openGame(game)}><Server size={15} /> Pick a server</button>
      </div>
      <ul className="tw-stats">
        <li><i className="tw-dot" /><b>{online ?? "–"}</b> {online == null ? "sign in for friends" : "friends online"}</li>
        {game?.playing != null && <li><b>{compact(game.playing)}</b> playing {isRecent ? "it" : "now"}</li>}
        <li>Boost <b>{settings.boost ? "on" : "off"}</b></li>
      </ul>
    </header>
  );
}

function Cover({ game, i }) {
  const { play, openGame } = useApp();
  return (
    <article className="cover-card" style={{ "--i": i }}>
      <div className="cover-art">
        <Img src={game.icon} />
        <div className="cover-actions">
          <button className="btn primary sm" onClick={() => play(game)}><Play size={13} fill="currentColor" /> Play</button>
          <button className="btn secondary sm" onClick={() => openGame(game)}><Server size={13} /> Servers</button>
        </div>
      </div>
      <h3 title={game.name}>{cleanName(game.name)}</h3>
      <small>{game.playedAt ? ago(game.playedAt) : game.playing != null ? `${compact(game.playing)} playing` : ""}</small>
    </article>
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
