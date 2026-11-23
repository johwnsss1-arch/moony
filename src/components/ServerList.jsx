import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, Globe, LogIn, RefreshCw, Server, Signal, Users } from "lucide-react";
import { useApp } from "../lib/store";
import { api, auth } from "../lib/bridge";
import { Empty, ErrorState, Segmented, Skeleton, Toggle } from "./ui";

const SORTS = [
  { value: "most", label: "Most players" },
  { value: "least", label: "Fewest players" },
  { value: "ping", label: "Best ping" },
];

// Region is found by asking Roblox where the server is (needs a signed-in
// account), so it's checked on request instead of for every server.
const regionCache = new Map();
const COUNTRY = { US: "US", GB: "UK", DE: "Germany", NL: "Netherlands", FR: "France", SG: "Singapore", JP: "Japan", AU: "Australia", IN: "India", BR: "Brazil", HK: "Hong Kong", PL: "Poland" };
const regionLabel = (r) => (r.country === "US" ? `US · ${r.region}` : `${COUNTRY[r.country] || r.country}${r.city ? ` · ${r.city}` : ""}`);

function RegionTag({ game, server }) {
  const { launchAs } = useApp();
  const [st, setSt] = useState(() => regionCache.get(server.id) || null);
  if (!launchAs || !auth?.region) return null;
  if (st?.region) return <small className="region" title={`${st.region.city}, ${st.region.region}`}><Globe size={10} /> {regionLabel(st.region)}</small>;
  if (st?.loading) return <small className="region">Checking…</small>;
  if (st?.error) return <small className="region err" title={st.error}>Unavailable</small>;
  const check = async (e) => {
    e.stopPropagation();
    setSt({ loading: true });
    try {
      const region = await auth.region(launchAs.id, game.placeId, server.id);
      const v = region ? { region } : { error: "Unknown" };
      regionCache.set(server.id, v); setSt(v);
    } catch (err) { const v = { error: err.message.replace(/^.*Error: /, "") }; regionCache.set(server.id, v); setSt(v); }
  };
  return <button className="region-btn" onClick={check}><Globe size={10} /> Region</button>;
}

const pingClass = (p) => (p == null ? "" : p < 90 ? "good" : p < 180 ? "ok" : "bad");

// Public servers for one game, with sorting, paging and per-server Join.
export function ServerList({ game, compact = false }) {
  const { play } = useApp();
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

  return (
    <div className={"servers" + (compact ? " compact" : "")}>
      <div className="servers-bar">
        <Segmented value={sort} onChange={setSort} options={SORTS} />
        <label className="inline-toggle"><Toggle checked={hideFull} onChange={setHideFull} label="Hide full servers" /> Hide full</label>
        <span className="grow" />
        {st.status === "ready" && <small>{totals.servers}{st.next ? "+" : ""} servers · {totals.players.toLocaleString()} players</small>}
        <button className="btn ghost sm icon-only" title="Refresh" onClick={() => load()} disabled={st.status === "loading"}><RefreshCw size={13} className={st.status === "loading" ? "spin" : ""} /></button>
      </div>

      {st.status === "error" && !st.list.length ? <ErrorState message={st.error} onRetry={() => load()} />
        : st.status === "loading" ? (
          <div className="server-rows">{Array.from({ length: 6 }, (_, i) => <div className="server-row" key={i}><Skeleton w={110} h={12} /><Skeleton w="100%" h={6} r={6} /><Skeleton w={60} h={12} /><Skeleton w={66} h={28} r={8} /></div>)}</div>
        ) : !list.length ? (
          <Empty icon={Server} title="No open servers" text={hideFull ? "Every server is full right now. Turn off “Hide full” or try again soon." : "Nobody is playing this game right now."} />
        ) : (
          <>
            <div className="server-head"><span>Server</span><span>Players</span><span>Ping</span><span /></div>
            <div className="server-rows">
              {list.map((s, i) => {
                const pct = s.max ? Math.min(100, (s.playing / s.max) * 100) : 0;
                const full = s.playing >= s.max;
                return (
                  <div className="server-row" key={s.id} style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                    <div className="server-id" title={s.id}><Server size={13} /> <span>{s.id.slice(0, 8)}</span>{s.fps != null && <small><Gauge size={11} /> {s.fps} fps</small>}</div>
                    <div className="server-fill">
                      <div className="bar"><span style={{ width: pct + "%" }} className={full ? "full" : ""} /></div>
                      <small><Users size={11} /> {s.playing}/{s.max}</small>
                    </div>
                    <div className="server-ping-col">
                      <div className={"server-ping " + pingClass(s.ping)}><Signal size={12} /> {s.ping != null ? `${s.ping} ms` : "—"}</div>
                      <RegionTag game={game} server={s} />
                    </div>
                    <button className="btn primary sm" disabled={full} onClick={() => play(game, { jobId: s.id })}><LogIn size={13} /> {full ? "Full" : "Join"}</button>
                  </div>
                );
              })}
            </div>
            {st.next && <button className="btn ghost load-more" onClick={() => load(st.next)} disabled={st.status === "more"}>{st.status === "more" ? "Loading…" : "Load more servers"}</button>}
            {st.status === "error" && st.list.length > 0 && <ErrorState message={st.error} onRetry={() => load(st.next)} />}
          </>
        )}
      <p className="servers-note">Ping is the server's average player ping reported by Roblox, not your own connection.</p>
    </div>
  );
}
