import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Gauge, Globe, LogIn, RefreshCw, Server, Shuffle, Users, Zap } from "lucide-react";
import { pickServer } from "../lib/servers";
import { useApp } from "../lib/store";
import { api, auth } from "../lib/bridge";
import { Empty, ErrorState, Segmented, Skeleton, Toggle } from "./ui";

const SORTS = [
  { value: "most", label: "Most players" },
  { value: "least", label: "Fewest players" },
  { value: "ping", label: "Best ping" },
];

const regionCache = new Map();
const COUNTRY = { US: "US", GB: "UK", DE: "Germany", NL: "Netherlands", FR: "France", SG: "Singapore", JP: "Japan", AU: "Australia", IN: "India", BR: "Brazil", HK: "Hong Kong", PL: "Poland" };
const regionLabel = (r) => (r.country === "US" ? `US · ${r.region}` : `${COUNTRY[r.country] || r.country}${r.city ? ` · ${r.city}` : ""}`);

function RegionTag({ game, server }) {
  const { launchAs } = useApp();
  const [st, setSt] = useState(() => regionCache.get(server.id) || null);
  if (!launchAs || !auth?.region) return <span className="sv-region muted">—</span>;
  if (st?.region) return <span className="sv-region" title={`${st.region.city}, ${st.region.region}`}><Globe size={11} /> {regionLabel(st.region)}</span>;
  if (st?.loading) return <span className="sv-region muted">Locating…</span>;
  if (st?.error) return <span className="sv-region muted" title={st.error}>Unknown</span>;
  const check = async (e) => {
    e.stopPropagation();
    setSt({ loading: true });
    try {
      const region = await auth.region(launchAs.id, game.placeId, server.id);
      const v = region ? { region } : { error: "Unknown" };
      regionCache.set(server.id, v); setSt(v);
    } catch (err) { const v = { error: err.message.replace(/^.*Error: /, "") }; regionCache.set(server.id, v); setSt(v); }
  };
  return <button className="sv-region-btn" onClick={check} title="Look up where this server is"><Globe size={11} /> Find region</button>;
}

const tier = (p) => (p == null ? 0 : p < 60 ? 4 : p < 120 ? 3 : p < 180 ? 2 : 1);
const TIER_CLASS = ["none", "bad", "ok", "good", "great"];

function Signal({ ping }) {
  const t = tier(ping);
  return (
    <span className={"sv-signal " + TIER_CLASS[t]} aria-label={ping != null ? `${ping} ms` : "Ping unknown"}>
      {[1, 2, 3, 4].map((n) => <i key={n} className={n <= t ? "on" : ""} style={{ height: 4 + n * 3 }} />)}
    </span>
  );
}

const BUCKETS = [[0, 60, "Under 60"], [60, 120, "60–120"], [120, 180, "120–180"], [180, 250, "180–250"], [250, Infinity, "250+"]];
function PingSpread({ list }) {
  const pings = list.map((s) => s.ping).filter((p) => p != null);
  if (pings.length < 4) return null;
  const counts = BUCKETS.map(([a, b]) => pings.filter((p) => p >= a && p < b).length);
  const max = Math.max(...counts);
  const best = Math.min(...pings);
  return (
    <div className="sv-spread" aria-label="How ping is spread across these servers">
      <div className="sv-spread-head"><b>Ping across {pings.length} servers</b><small>Best {best} ms</small></div>
      <div className="sv-spread-bars">
        {BUCKETS.map(([, , label], i) => (
          <div key={label} className={"sv-bucket t" + (4 - i)}>
            <span className="sv-bucket-bar"><i style={{ height: `${max ? (counts[i] / max) * 100 : 0}%` }} /></span>
            <small>{label}</small>
            <em>{counts[i]}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServerList({ game, compact = false }) {
  const { play, toast, nowPlaying } = useApp();
  const [busy, setBusy] = useState(null);
  const [sel, setSel] = useState(null);
  const [joining, setJoining] = useState(null);
  const [copied, setCopied] = useState(null);
  const join = (id) => {
    setJoining(id);
    play(game, { jobId: id });
    setTimeout(() => setJoining((j) => (j === id ? null : j)), 5000);
  };
  const quick = async (mode) => {
    setBusy(mode);
    try {
      const s = await pickServer(game.placeId, mode, nowPlaying?.jobId);
      if (!s) toast?.("No open server found right now");
      else { setSel(s.id); join(s.id); }
    } catch (e) { toast?.(e.message); }
    setBusy(null);
  };
  const [sort, setSort] = useState("most");
  const [hideFull, setHideFull] = useState(true);
  const [st, setSt] = useState({ status: "loading", list: [], next: null, error: null });

  const order = sort === "least" ? "Asc" : "Desc";
  const load = useCallback(async (cursor = "") => {
    setSt((p) => ({ ...p, status: cursor ? "more" : "loading", error: null, ...(cursor ? {} : { list: [] }) }));
    try {
      const r = await api("servers", game.placeId, { order, cursor, hideFull });
      setSt((p) => ({ status: "ready", list: cursor ? [...p.list, ...r.servers] : r.servers, next: r.next, error: null }));
    } catch (e) {
      setSt((p) => ({ ...p, status: "error", error: e.message }));
    }
  }, [game.placeId, order, hideFull]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => (sort === "ping" ? [...st.list].sort((a, b) => (a.ping ?? 9e9) - (b.ping ?? 9e9)) : st.list), [st.list, sort]);
  const totals = useMemo(() => ({ servers: st.list.length, players: st.list.reduce((n, s) => n + s.playing, 0) }), [st.list]);
  const copy = (id) => { navigator.clipboard?.writeText(id); setCopied(id); setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500); };

  return (
    <div className={"servers nf-servers" + (compact ? " compact" : "")}>
      <div className="sv-quick">
        <button className="sv-quick-btn primary" disabled={!!busy} onClick={() => quick("ping")}>
          <Zap size={18} /><span><b>{busy === "ping" ? "Finding the best server…" : "Fast join"}</b><small>The lowest-ping server with room</small></span>
        </button>
        <button className="sv-quick-btn" disabled={!!busy} onClick={() => quick("hop")}>
          <Shuffle size={18} /><span><b>{busy === "hop" ? "Finding a server…" : "Server hop"}</b><small>{nowPlaying?.jobId ? "Any server except the one you're in" : "A random open server"}</small></span>
        </button>
        {st.status === "ready" && <PingSpread list={st.list} />}
      </div>

      <div className="servers-bar">
        <Segmented value={sort} onChange={setSort} options={SORTS} />
        <label className="inline-toggle"><Toggle checked={hideFull} onChange={setHideFull} label="Hide full servers" /> Hide full</label>
        <span className="grow" />
        {st.status === "ready" && <small className="sv-totals">{totals.servers}{st.next ? "+" : ""} servers · {totals.players.toLocaleString()} players</small>}
        <button className="btn ghost sm icon-only" title="Refresh" aria-label="Refresh servers" onClick={() => load()} disabled={st.status === "loading"}><RefreshCw size={13} className={st.status === "loading" ? "spin" : ""} /></button>
      </div>

      {st.status === "error" && !st.list.length ? <ErrorState message={st.error} onRetry={() => load()} />
        : st.status === "loading" ? (
          <div className="sv-rows">{Array.from({ length: 6 }, (_, i) => <div className="sv-row" key={i}><Skeleton w={54} h={16} /><Skeleton w={110} h={12} /><Skeleton w="100%" h={6} r={6} /><Skeleton w={70} h={12} /><Skeleton w={72} h={30} r={8} /></div>)}</div>
        ) : !list.length ? (
          <Empty icon={Server} title="No open servers" text={hideFull ? "Every server is full right now. Turn off “Hide full” or try again soon." : "Nobody is playing this game right now."} />
        ) : (
          <>
            <div className="sv-head"><span>Ping</span><span>Server</span><span>Players</span><span>Region</span><span /></div>
            <div className="sv-rows" role="listbox" aria-label="Servers">
              {list.map((s, i) => {
                const pct = s.max ? Math.min(100, (s.playing / s.max) * 100) : 0;
                const full = s.playing >= s.max;
                const here = nowPlaying?.jobId === s.id;
                return (
                  <div key={s.id} role="option" aria-selected={sel === s.id} tabIndex={0}
                    className={"sv-row" + (sel === s.id ? " sel" : "") + (here ? " here" : "") + (full ? " full" : "")}
                    style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
                    onClick={() => setSel(s.id)} onDoubleClick={() => !full && join(s.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !full) join(s.id); }}>
                    <span className="sv-ping"><Signal ping={s.ping} /><b>{s.ping != null ? s.ping : "—"}</b><small>ms</small></span>
                    <span className="sv-id" title={s.id}>
                      <code>{s.id.slice(0, 8)}</code>
                      {s.fps != null && <small><Gauge size={11} /> {Math.round(s.fps)} fps</small>}
                      {here && <em className="sv-here">You're here</em>}
                      <button className="sv-copy" onClick={(e) => { e.stopPropagation(); copy(s.id); }} aria-label="Copy server ID" title="Copy server ID">{copied === s.id ? <Check size={12} /> : <Copy size={12} />}</button>
                    </span>
                    <span className="sv-fill">
                      <span className="sv-bar"><i style={{ width: pct + "%" }} className={full ? "full" : pct > 80 ? "busy" : ""} /></span>
                      <small><Users size={11} /> {s.playing}/{s.max}</small>
                    </span>
                    <RegionTag game={game} server={s} />
                    <button className={"btn sm sv-join" + (sel === s.id ? " primary" : " secondary")} disabled={full || here} onClick={(e) => { e.stopPropagation(); join(s.id); }}>
                      {joining === s.id ? "Launching…" : full ? "Full" : here ? "Joined" : <><LogIn size={13} /> Join</>}
                    </button>
                  </div>
                );
              })}
            </div>
            {st.next && <button className="btn ghost load-more" onClick={() => load(st.next)} disabled={st.status === "more"}>{st.status === "more" ? "Loading…" : "Load more servers"}</button>}
            {st.status === "error" && st.list.length > 0 && <ErrorState message={st.error} onRetry={() => load(st.next)} />}
          </>
        )}
      <p className="servers-note">Ping is the average ping of players already in that server, as reported by Roblox, not your own connection. Double-click a server to join it.</p>
    </div>
  );
}
