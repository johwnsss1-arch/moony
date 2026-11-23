import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Gamepad2, Hourglass, Radio, RotateCcw } from "lucide-react";
import { useApp } from "../lib/store";
import { isDesktop } from "../lib/bridge";
import { ago, cleanName, duration, totalSeconds } from "../lib/format";
import { Img } from "./ui";

const dayKey = (d) => d.toISOString().slice(0, 10);

function useTicker(active) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => set((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

// Live "now playing" strip, shown while Roblox is in a game.
export function NowPlaying({ compact }) {
  const { nowPlaying, openGame } = useApp();
  useTicker(!!nowPlaying);
  if (!nowPlaying) return null;
  const secs = Math.floor((Date.now() - nowPlaying.startedAt) / 1000);
  const clock = `${Math.floor(secs / 3600) ? Math.floor(secs / 3600) + ":" : ""}${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div className={"now-playing" + (compact ? " compact" : "")} onClick={() => nowPlaying.universeId && openGame({ universeId: nowPlaying.universeId, placeId: nowPlaying.placeId, name: nowPlaying.name || "Roblox", icon: nowPlaying.icon })}>
      <Img src={nowPlaying.icon} className="np-art" />
      <div className="grow">
        <span className="np-label"><Radio size={11} /> Now playing</span>
        <b>{nowPlaying.name ? cleanName(nowPlaying.name) : "Joining a game…"}</b>
        {nowPlaying.region && <small className="np-region">Server in {nowPlaying.region.country === "US" ? `${nowPlaying.region.region}, US` : `${nowPlaying.region.city}, ${nowPlaying.region.country}`}</small>}
      </div>
      <span className="np-clock">{clock}</span>
    </div>
  );
}

// Home: totals plus your most played games.
export function PlaytimeSection() {
  const { playtime, openGame } = useApp();
  const stats = useMemo(() => {
    const days = playtime.days || {};
    const now = new Date();
    const today = days[dayKey(now)] || 0;
    let week = 0;
    for (let i = 0; i < 7; i++) week += days[dayKey(new Date(now - i * 86400000))] || 0;
    const games = Object.entries(playtime.games || {}).map(([id, g]) => ({ universeId: Number(id), ...g })).filter((g) => g.seconds > 0).sort((a, b) => b.seconds - a.seconds);
    const total = totalSeconds(games.map((g) => g.seconds));
    const week7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(now - (6 - i) * 86400000); return { label: d.toLocaleDateString(undefined, { weekday: "short" }), secs: days[dayKey(d)] || 0 }; });
    return { today, week, total, games, week7 };
  }, [playtime]);

  if (!isDesktop) return null;
  const max = Math.max(1, ...stats.week7.map((d) => d.secs));
  const top = stats.games[0]?.seconds || 1;

  return (
    <section className="playtime">
      <header className="section-head"><h2><Hourglass size={16} />Your playtime</h2></header>
      {stats.total === 0 ? (
        <p className="rp-note">Play any Roblox game and Moony will track your time here automatically, even if you didn't launch it from Moony.</p>
      ) : (
        <div className="pt-grid">
          <div className="pt-card">
            <div className="pt-stats">
              <div><span><Clock size={12} /> Today</span><b>{duration(stats.today)}</b></div>
              <div><span><CalendarDays size={12} /> This week</span><b>{duration(stats.week)}</b></div>
              <div><span><Gamepad2 size={12} /> All time</span><b>{duration(stats.total)}</b></div>
            </div>
            <div className="pt-week">
              {stats.week7.map((d, i) => (
                <div key={i} className="pt-day" title={`${d.label}: ${duration(d.secs)}`}>
                  <span className="pt-bar"><i style={{ height: `${(d.secs / max) * 100}%` }} /></span>
                  <small>{d.label}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-card pt-top">
            {stats.games.slice(0, 5).map((g) => (
              <button key={g.universeId} className="pt-game" onClick={() => openGame({ universeId: g.universeId, placeId: g.placeId, name: g.name || "Game", icon: g.icon })}>
                <Img src={g.icon} className="pt-art" />
                <span className="grow">
                  <b>{cleanName(g.name || "Unknown game")}</b>
                  <span className="pt-meter"><i style={{ width: `${(g.seconds / top) * 100}%` }} /></span>
                </span>
                <span className="pt-time">{duration(g.seconds)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Servers you were recently in, with one-click rejoin (handy after a disconnect).
export function RecentServers({ limit = 6, compact = false }) {
  const { playtime, play, nowPlaying } = useApp();
  const list = (playtime.history || []).slice(0, limit).map((h) => ({ ...h, game: playtime.games?.[h.universeId] || {} }));
  if (!isDesktop) return null;
  if (!list.length) {
    return compact ? <p className="rp-note">Servers you play in show up here so you can rejoin them.</p>
      : <p className="muted-text">Servers you play in show up here, so you can jump back into the same one after a disconnect.</p>;
  }
  return (
    <div className={"recent-servers" + (compact ? " compact" : "")}>
      {list.map((h) => {
        const here = nowPlaying && h.jobId === nowPlaying.jobId;
        const game = { universeId: h.universeId, placeId: h.placeId, name: h.game.name || "Roblox game", icon: h.game.icon };
        return (
          <div className="rs-row" key={h.jobId}>
            <Img src={h.game.icon} className="rs-art" />
            <div className="grow">
              <b>{cleanName(h.game.name || "Roblox game")}</b>
              <small>{here ? "You're in this server" : `${ago(h.at)} · server ${h.jobId.slice(0, 8)}`}</small>
            </div>
            <button className="btn secondary sm" disabled={here} onClick={() => play(game, { jobId: h.jobId })}><RotateCcw size={12} /> Rejoin</button>
          </div>
        );
      })}
    </div>
  );
}

// Game details: your time in this one game.
export function GamePlaytime({ universeId }) {
  const { playtime } = useApp();
  const g = playtime.games?.[universeId];
  if (!isDesktop) return null;
  return (
    <div className="game-pt">
      <Hourglass size={14} />
      {g?.seconds ? (
        <span>You've played <b>{duration(g.seconds)}</b> across {g.sessions || 1} session{(g.sessions || 1) === 1 ? "" : "s"} · last played {ago(g.lastPlayed)}</span>
      ) : <span>You haven't played this yet. Moony tracks your time automatically.</span>}
    </div>
  );
}
