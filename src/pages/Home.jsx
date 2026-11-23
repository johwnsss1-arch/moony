import { useEffect, useMemo, useState } from "react";
import { Flame, Heart, History, Info, Play, Rocket, Sparkles, ThumbsUp, TrendingUp, Users } from "lucide-react";
import { useApp } from "../lib/store";
import { cleanName, compact } from "../lib/format";
import { Carousel } from "../components/Carousel";
import { NowPlaying, PlaytimeSection } from "../components/Playtime";
import { ErrorState, Img, Skeleton } from "../components/ui";

// Home rows show the top 30 of each chart (Discover has the full lists).
const pick = (sorts, id) => (sorts.find((s) => s.id === id)?.games ?? []).slice(0, 30);

export default function Home() {
  const { sorts, loadSorts, recent } = useApp();
  const loading = sorts.status === "loading";
  const popular = pick(sorts.data, "top-playing-now");
  const featured = useMemo(() => popular.filter((g) => g.banner).slice(0, 5), [popular]);

  return (
    <div className="page home">
      <NowPlaying />
      {sorts.status === "error" ? <ErrorState message={sorts.error} onRetry={loadSorts} /> : <Hero games={featured} loading={loading} />}

      <PlaytimeSection />
      {recent.length > 0 && <Carousel title="Jump back in" icon={History} games={recent} />}
      <Carousel title="Popular right now" icon={Flame} games={popular} loading={loading} />
      <Carousel title="Trending" icon={TrendingUp} games={pick(sorts.data, "top-trending")} loading={loading} />
      <Carousel title="Recommended for you" icon={Sparkles} games={pick(sorts.data, "top-revisited")} loading={loading} />
      <Carousel title="Up and coming" icon={Rocket} games={pick(sorts.data, "up-and-coming")} loading={loading} />
    </div>
  );
}

function Hero({ games, loading }) {
  const { play, openGame, isFavorite, toggleFavorite } = useApp();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || games.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % games.length), 7000);
    return () => clearInterval(t);
  }, [paused, games.length]);

  if (loading || !games.length) {
    return (
      <div className="hero">
        <div className="hero-content">
          <Skeleton w={90} h={20} r={20} />
          <Skeleton w={340} h={34} style={{ marginTop: 14 }} />
          <Skeleton w={260} h={12} style={{ marginTop: 14 }} />
          <Skeleton w={150} h={38} r={10} style={{ marginTop: 22 }} />
        </div>
      </div>
    );
  }
  const g = games[i % games.length];
  const fav = isFavorite(g.universeId);
  return (
    <div className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {games.map((x, k) => <Img key={x.universeId} src={x.banner} className={"hero-art" + (k === i ? " on" : "")} />)}
      <div className="hero-shade" />
      <div className="hero-content" key={g.universeId}>
        <span className="hero-badge"><Flame size={12} /> Featured · #{i + 1} most played</span>
        <h1 title={g.name}>{cleanName(g.name)}</h1>
        <div className="hero-meta">
          <span><Users size={13} /> {compact(g.playing)} playing</span>
          {g.rating != null && <span><ThumbsUp size={13} /> {g.rating}%</span>}
          {g.genre && <span>{g.genre}</span>}
          {g.creator && <span>by {g.creator}</span>}
        </div>
        <div className="hero-actions">
          <button className="btn primary lg" onClick={() => play(g)}><Play size={16} fill="currentColor" /> Play</button>
          <button className="btn glass lg" onClick={() => openGame(g)}><Info size={16} /> Details</button>
          <button className={"btn glass lg icon-only" + (fav ? " fav-on" : "")} aria-label="Favorite" onClick={() => toggleFavorite(g)}><Heart size={16} fill={fav ? "currentColor" : "none"} /></button>
        </div>
      </div>
      <div className="hero-dots">
        {games.map((x, k) => (
          <button key={x.universeId} className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`Show ${x.name}`}>
            {k === i && !paused && <span className="fill" />}
          </button>
        ))}
      </div>
    </div>
  );
}
