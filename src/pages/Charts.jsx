import { useState } from "react";
import { Heart, Play, Server, ThumbsUp, Users } from "lucide-react";
import { useApp } from "../lib/store";
import { cleanName, compact } from "../lib/format";
import { ErrorState, Img, Skeleton } from "../components/ui";

const CHARTS = [
  { id: "top-playing-now", label: "Most playing" },
  { id: "top-trending", label: "Trending" },
  { id: "up-and-coming", label: "Up and coming" },
  { id: "top-revisited", label: "Top revisited" },
  { id: "fun-with-friends", label: "With friends" },
];

export default function Charts() {
  const { sorts, loadSorts, play, openGame, isFavorite, toggleFavorite } = useApp();
  const [chart, setChart] = useState(CHARTS[0].id);
  const games = sorts.data.find((s) => s.id === chart)?.games ?? [];

  return (
    <div className="page charts">
      <div className="page-head"><h1>Charts</h1><p>Live rankings from Roblox, updated every time you open Moony.</p></div>
      <div className="underline-tabs">
        {CHARTS.map((c) => <button key={c.id} className={chart === c.id ? "on" : ""} onClick={() => setChart(c.id)}>{c.label}</button>)}
      </div>

      {sorts.status === "error" ? <ErrorState message={sorts.error} onRetry={loadSorts} /> : (
        <div className="chart-list" key={chart}>
          {sorts.status === "loading"
            ? Array.from({ length: 10 }, (_, i) => <div className="chart-row" key={i}><Skeleton w={20} h={14} /><Skeleton w={52} h={52} r={11} /><div className="grow"><Skeleton w="40%" h={12} /><Skeleton w="25%" h={10} style={{ marginTop: 7 }} /></div></div>)
            : games.map((g, i) => {
              const fav = isFavorite(g.universeId);
              return (
                <div className="chart-row" key={g.universeId} style={{ animationDelay: `${Math.min(i, 15) * 22}ms` }} onClick={() => openGame(g)}>
                  <span className={"rank" + (i < 3 ? " top" : "")}>{i + 1}</span>
                  <Img src={g.icon} className="chart-art" />
                  <div className="grow chart-info">
                    <b title={g.name}>{cleanName(g.name)}</b>
                    <small>{[g.creator && `by ${g.creator}`, g.genre].filter(Boolean).join(" · ")}</small>
                  </div>
                  <span className="chart-stat"><Users size={13} /> {compact(g.playing)}</span>
                  <span className="chart-stat"><ThumbsUp size={13} /> {g.rating != null ? g.rating + "%" : "—"}</span>
                  <div className="chart-actions" onClick={(e) => e.stopPropagation()}>
                    <button className={"btn ghost sm icon-only" + (fav ? " fav-on" : "")} aria-label="Favorite" onClick={() => toggleFavorite(g)}><Heart size={14} fill={fav ? "currentColor" : "none"} /></button>
                    <button className="btn ghost sm icon-only" aria-label="Servers" title="Servers" onClick={() => openGame({ ...g, tab: "servers" })}><Server size={14} /></button>
                    <button className="btn primary sm" onClick={() => play(g)}><Play size={12} fill="currentColor" /> Play</button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
