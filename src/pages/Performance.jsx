import { useEffect, useMemo, useState } from "react";
import { Activity, Cpu, Gauge, MemoryStick, Rocket, Signal, Trash2, Wand2 } from "lucide-react";
import { useApp } from "../lib/store";
import { cleanName, duration } from "../lib/format";
import { Empty, Toggle } from "../components/ui";

const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
const col = (samples, i) => samples.map((s) => s[i]).filter((v) => v != null && v >= 0);
const stats = (samples) => {
  const p = col(samples, 1), c = col(samples, 2), r = col(samples, 3);
  return { ping: avg(p), pingMax: p.length ? Math.max(...p) : null, spikes: p.filter((v) => v > 250).length, cpu: avg(c), ram: avg(r) };
};

function Spark({ samples, i, max, color, h = 70 }) {
  const pts = samples.map((s, k) => [k, s[i]]).filter(([, v]) => v != null && v >= 0);
  if (pts.length < 2) return <div className="spark empty" style={{ height: h }}>Collecting…</div>;
  const top = max || Math.max(...pts.map(([, v]) => v)) * 1.2 || 1;
  const n = samples.length - 1 || 1;
  const d = pts.map(([k, v], j) => `${j ? "L" : "M"}${((k / n) * 100).toFixed(2)},${(h - (Math.min(v, top) / top) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ height: h }}>
      <path d={`${d} L100,${h} L0,${h} Z`} fill={color} opacity=".14" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const pingClass = (p) => (p == null ? "" : p < 90 ? "good" : p < 180 ? "ok" : "bad");

export default function Performance() {
  const { settings, updateSettings, nowPlaying, setPage, toast } = useApp();
  const [log, setLog] = useState({ sessions: [] });
  const [live, setLive] = useState(null);
  const [open, setOpen] = useState(0);
  useEffect(() => {
    const p = window.orbit?.perf;
    if (!p) return;
    p.get().then((l) => l && setLog(l));
    p.live().then(setLive);
    const offs = [p.onLive((v) => setLive({ ...v, samples: [...v.samples] })), p.onUpdate(setLog)];
    return () => offs.forEach((f) => f?.());
  }, []);
  useEffect(() => { if (!nowPlaying) setLive(null); }, [nowPlaying]);
  const last = live?.samples.at(-1);
  const compare = useMemo(() => {
    const b = log.sessions.filter((s) => s.boost).map((s) => stats(s.samples).ping).filter((v) => v != null);
    const n = log.sessions.filter((s) => !s.boost).map((s) => stats(s.samples).ping).filter((v) => v != null);
    return b.length && n.length ? { on: avg(b), off: avg(n) } : null;
  }, [log]);
  const sel = log.sessions[open];
  const st = sel ? stats(sel.samples) : null;

  return (
    <div className="page perf-page">
      <div className="page-head"><h1>Performance</h1><p>Boost Roblox while you play, and see how your ping, CPU and RAM held up in each game.</p></div>

      <div className="perf-boost settings-group">
        <div className="perf-boost-icon"><Rocket size={22} /></div>
        <div className="grow">
          <b>Boost mode</b>
          <small>While a game runs, Roblox gets high CPU priority and Windows switches to the High performance power plan. Everything goes back to normal when you leave.</small>
        </div>
        <Toggle checked={!!settings.boost} onChange={(v) => { updateSettings({ boost: v }); if (v && nowPlaying) window.orbit?.perf?.boostNow(); }} label="Boost mode" />
      </div>

      <div className="perf-tiles">
        <div className="perf-tile"><Signal size={15} /><small>Ping now</small><b className={pingClass(last?.[1] > 0 ? last[1] : null)}>{last?.[1] > 0 ? `${last[1]} ms` : "—"}</b></div>
        <div className="perf-tile"><Cpu size={15} /><small>CPU</small><b>{last?.[2] != null ? `${last[2]}%` : "—"}</b></div>
        <div className="perf-tile"><MemoryStick size={15} /><small>RAM</small><b>{last?.[3] != null ? `${last[3]}%` : "—"}</b></div>
        <div className="perf-tile"><Gauge size={15} /><small>Boost effect</small><b>{compare ? `${compare.off - compare.on >= 0 ? "−" : "+"}${Math.abs(compare.off - compare.on)} ms` : "—"}</b><small>{compare ? `avg ping ${compare.on} vs ${compare.off} ms` : "Play with and without Boost"}</small></div>
      </div>

      {live && (
        <div className="settings-group perf-live">
          <div className="perf-sec-head"><Activity size={14} /> <b>Live: {nowPlaying?.name ? cleanName(nowPlaying.name) : "this game"}</b>{live.boost && <span className="pill good">Boosted</span>}</div>
          <div className="perf-charts">
            <div><small>Ping</small><Spark samples={live.samples} i={1} color="#3ff0ff" /></div>
            <div><small>CPU %</small><Spark samples={live.samples} i={2} max={100} color="#ffb84d" /></div>
            <div><small>RAM %</small><Spark samples={live.samples} i={3} max={100} color="#b18cff" /></div>
          </div>
        </div>
      )}

      <div className="perf-sec-head" style={{ marginTop: 22 }}>
        <b>Recent sessions</b><span className="grow" />
        <button className="btn ghost sm" onClick={() => setPage("tweaks")}><Wand2 size={13} /> FPS tweaks</button>
        {log.sessions.length > 0 && <button className="btn ghost sm" onClick={() => window.orbit?.perf?.clear().then(() => { setLog({ sessions: [] }); toast?.("Cleared"); })}><Trash2 size={13} /> Clear</button>}
      </div>
      {!log.sessions.length ? (
        <Empty icon={Activity} title="No sessions yet" text="Play a game and Moony records your ping, CPU and RAM every 5 seconds." />
      ) : (
        <div className="perf-layout">
          <div className="perf-list">
            {log.sessions.map((s, i) => (
              <button key={s.start} className={"perf-row" + (open === i ? " sel" : "")} onClick={() => setOpen(i)}>
                <div className="grow"><b>{s.name ? cleanName(s.name) : "Roblox"}</b><small>{new Date(s.start).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} · {duration((s.end - s.start) / 1000)}{s.boost ? " · Boosted" : ""}</small></div>
                <span className={"server-ping " + pingClass(stats(s.samples).ping)}>{stats(s.samples).ping ?? "—"} ms</span>
              </button>
            ))}
          </div>
          {sel && (
            <div className="settings-group perf-detail">
              <div className="perf-nums">
                <div><small>Avg ping</small><b className={pingClass(st.ping)}>{st.ping ?? "—"} ms</b></div>
                <div><small>Worst ping</small><b>{st.pingMax ?? "—"} ms</b></div>
                <div><small>Lag spikes</small><b>{st.spikes}</b></div>
                <div><small>Avg CPU</small><b>{st.cpu ?? "—"}%</b></div>
                <div><small>Avg RAM</small><b>{st.ram ?? "—"}%</b></div>
              </div>
              <small>Ping</small><Spark samples={sel.samples} i={1} color="#3ff0ff" h={90} />
              <small>CPU %</small><Spark samples={sel.samples} i={2} max={100} color="#ffb84d" />
              <small>RAM %</small><Spark samples={sel.samples} i={3} max={100} color="#b18cff" />
              {st.spikes > 3 && <p className="perf-tip">Lots of lag spikes. Try Fast join in the server list for a closer server, and pause downloads or streams while you play.</p>}
              {st.cpu > 85 && <p className="perf-tip">Your CPU was almost maxed out. Lower Roblox's graphics quality or cap your FPS in Tweaks.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
