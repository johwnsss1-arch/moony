import { useEffect, useMemo, useState } from "react";
import { Heart, History, Info, KeyRound, RotateCcw, Search, Server, Sparkles, Users, X } from "lucide-react";
import { useApp, useAsync } from "../lib/store";
import { api } from "../lib/bridge";
import { cleanName, compact } from "../lib/format";
import { ServerList } from "../components/ServerList";
import { RecentServers } from "../components/Playtime";
import { PrivateServers } from "../components/PrivateServers";
import { isDesktop } from "../lib/bridge";
import { Empty, Img, Skeleton } from "../components/ui";

export default function Servers() {
  const { favorites, recent, sorts, openGame } = useApp();
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [picked, setPicked] = useState(null);
  useEffect(() => { const t = setTimeout(() => setDeb(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  const found = useAsync(() => (deb ? api("search", deb) : null), [deb]);

  const popular = useMemo(() => sorts.data.find((s) => s.id === "top-playing-now")?.games.slice(0, 10) ?? [], [sorts.data]);
  const groups = deb
    ? [{ title: "Results", icon: Search, games: found.data ?? [], loading: found.status === "loading" }]
    : [
      { title: "Favorites", icon: Heart, games: favorites.slice(0, 8) },
      { title: "Recently played", icon: History, games: recent.slice(0, 8) },
      { title: "Popular", icon: Sparkles, games: popular, loading: sorts.status === "loading" },
    ].filter((g) => g.games.length || g.loading);

  const game = picked ?? popular[0] ?? null;

  return (
    <div className="page servers-page">
      <div className="page-head"><h1>Servers</h1><p>Pick a game, then choose exactly which server to join.</p></div>
      {isDesktop && (
        <section className="rs-section">
          <h3 className="list-title"><RotateCcw size={12} style={{ marginRight: 6 }} /> Recent servers</h3>
          <RecentServers limit={4} />
        </section>
      )}
      <section className="rs-section">
        <h3 className="list-title"><KeyRound size={12} style={{ marginRight: 6 }} /> Private servers</h3>
        <PrivateServers />
      </section>
      <div className="servers-layout">
        <aside className="picker">
          <label className="search-field sm">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a game" />
            {q && <button className="clear" onClick={() => setQ("")} aria-label="Clear"><X size={14} /></button>}
          </label>
          <div className="picker-groups">
            {groups.map((grp) => (
              <div key={grp.title}>
                <div className="picker-title"><grp.icon size={12} /> {grp.title}</div>
                {grp.loading ? Array.from({ length: 4 }, (_, i) => <div className="pick" key={i}><Skeleton w={36} h={36} r={9} /><Skeleton w="70%" h={11} /></div>)
                  : grp.games.map((g) => (
                    <button key={g.universeId} className={"pick" + (game?.universeId === g.universeId ? " on" : "")} onClick={() => setPicked(g)}>
                      <Img src={g.icon} className="pick-art" />
                      <span className="grow"><b>{cleanName(g.name)}</b><small><Users size={10} /> {compact(g.playing)}</small></span>
                    </button>
                  ))}
                {!grp.loading && !grp.games.length && <p className="muted-text">No games match.</p>}
              </div>
            ))}
          </div>
        </aside>

        <section className="servers-main">
          {!game ? <Empty icon={Server} title="Pick a game" text="Choose a game on the left to see its servers." /> : (
            <>
              <div className="servers-game" key={game.universeId}>
                <Img src={game.banner || game.icon} className="servers-game-bg" />
                <div className="servers-game-shade" />
                <Img src={game.icon} className="servers-game-icon" />
                <div className="grow">
                  <h2>{cleanName(game.name)}</h2>
                  <small>{compact(game.playing)} playing{game.creator ? ` · by ${game.creator}` : ""}</small>
                </div>
                <button className="btn glass sm" onClick={() => openGame(game)}><Info size={13} /> Details</button>
              </div>
              <ServerList key={game.placeId} game={game} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
