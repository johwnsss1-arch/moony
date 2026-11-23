import { useMemo, useState } from "react";
import { Clock, Compass, Heart, Library as LibraryIcon, Play, Search, X } from "lucide-react";
import { useApp } from "../lib/store";
import { ago, cleanName, duration, totalSeconds } from "../lib/format";
import { Empty, Img, Select } from "../components/ui";

const SORTS = [
  { value: "time", label: "Most played" },
  { value: "recent", label: "Last played" },
  { value: "name", label: "Name (A–Z)" },
];
const FILTERS = [["all", "All games"], ["played", "Played"], ["favorites", "Favorites"]];

export default function Library() {
  const { playtime, favorites, recent, isFavorite, toggleFavorite, openGame, play, setPage } = useApp();
  const [sort, setSort] = useState("time");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  // Everything you've touched: played (tracked), favorited, or launched.
  const games = useMemo(() => {
    const map = new Map();
    const add = (g, extra) => {
      if (!g?.universeId) return;
      const cur = map.get(g.universeId) || { universeId: g.universeId, seconds: 0, sessions: 0, lastPlayed: 0 };
      map.set(g.universeId, { ...cur, ...Object.fromEntries(Object.entries(g).filter(([, v]) => v != null && v !== "")), ...extra });
    };
    for (const g of favorites) add(g);
    for (const g of recent) add(g, { lastPlayed: Math.max(g.playedAt || 0, map.get(g.universeId)?.lastPlayed || 0) });
    for (const [id, g] of Object.entries(playtime.games || {})) add({ universeId: Number(id), ...g });
    return [...map.values()];
  }, [favorites, recent, playtime]);

  const list = useMemo(() => {
    let l = games;
    if (filter === "played") l = l.filter((g) => g.seconds > 0);
    if (filter === "favorites") l = l.filter((g) => isFavorite(g.universeId));
    if (q) l = l.filter((g) => (g.name || "").toLowerCase().includes(q.toLowerCase()));
    const by = { time: (a, b) => b.seconds - a.seconds || b.lastPlayed - a.lastPlayed, recent: (a, b) => b.lastPlayed - a.lastPlayed, name: (a, b) => cleanName(a.name || "").localeCompare(cleanName(b.name || "")) };
    return [...l].sort(by[sort]);
  }, [games, filter, q, sort, isFavorite]);

  const total = totalSeconds(games.map((g) => g.seconds));

  return (
    <div className="page library">
      <div className="page-head row">
        <div><h1>Library</h1><p>{games.length} games · {duration(total)} played in total</p></div>
      </div>
      <div className="lib-bar">
        <label className="search-field">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your library" />
          {q && <button className="clear" onClick={() => setQ("")} aria-label="Clear"><X size={14} /></button>}
        </label>
        <div className="segmented">{FILTERS.map(([v, l]) => <button key={v} className={filter === v ? "on" : ""} onClick={() => setFilter(v)}>{l}</button>)}</div>
        <Select value={sort} onChange={setSort} options={SORTS} width={170} />
      </div>

      {games.length === 0 ? (
        <Empty icon={LibraryIcon} title="Your library is empty" text="Games you play, launch or favorite collect here." action={<button className="btn primary" onClick={() => setPage("discover")}><Compass size={15} /> Find games</button>} />
      ) : list.length === 0 ? (
        <Empty icon={Search} title="Nothing matches" text="Try another filter or search." />
      ) : (
        <div className="lib-grid">
          {list.map((g) => {
            const fav = isFavorite(g.universeId);
            return (
              <div key={g.universeId} className="lib-card" onClick={() => openGame(g)}>
                <div className="lib-art">
                  <Img src={g.icon} />
                  <button className={"tile-fav" + (fav ? " on" : "")} onClick={(e) => { e.stopPropagation(); toggleFavorite(g); }} aria-label="Favorite"><Heart size={13} fill={fav ? "currentColor" : "none"} /></button>
                  <button className="tile-play" onClick={(e) => { e.stopPropagation(); play(g); }} aria-label="Play"><Play size={14} fill="currentColor" /></button>
                </div>
                <b title={g.name}>{cleanName(g.name || "Game")}</b>
                <div className="lib-meta">
                  <span><Clock size={11} /> {g.seconds ? duration(g.seconds) : "Not played"}</span>
                  {g.lastPlayed > 0 && <span>{ago(g.lastPlayed)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
