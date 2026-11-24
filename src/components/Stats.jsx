import { useMemo } from "react";
import { BarChart3, Clock3, Flame, Timer, Trophy } from "lucide-react";
import { useApp } from "../lib/store";
import { cleanName, duration } from "../lib/format";
import { bestStreak, daily, hourly, sessionStats, streak } from "../lib/stats";

const hourLabel = (h) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

export function BarChart({ data, label, height = 110, highlight }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className={"chart-col" + (highlight === i ? " hi" : "")} title={`${d.label}: ${duration(d.value)}`}>
          <span className="chart-bar"><i style={{ height: `${(d.value / max) * 100}%` }} /></span>
          {label(d, i) && <small>{label(d, i)}</small>}
        </div>
      ))}
    </div>
  );
}

export function RichStats({ universeId }) {
  const { playtime } = useApp();
  const sessions = playtime.sessions || [];
  const st = useMemo(() => sessionStats(sessions, universeId), [sessions, universeId]);
  const hours = useMemo(() => hourly(universeId ? sessions.filter((s) => s.u === Number(universeId)) : sessions), [sessions, universeId]);
  const days = useMemo(() => daily(sessions, 14, universeId), [sessions, universeId]);
  const peak = hours.indexOf(Math.max(...hours));
  const longestName = st.longestGame ? playtime.games?.[st.longestGame]?.name : null;

  if (!st.count) return <p className="muted-text">Stats appear after your first finished session.</p>;
  return (
    <div className="rich-stats">
      <div className="kpis">
        <div className="kpi"><span><BarChart3 size={12} /> Sessions</span><b>{st.count}</b></div>
        <div className="kpi"><span><Timer size={12} /> Longest session</span><b>{duration(st.longest)}</b>{!universeId && longestName && <small>{cleanName(longestName)}</small>}</div>
        <div className="kpi"><span><Clock3 size={12} /> Average session</span><b>{duration(st.average)}</b></div>
        {!universeId && <div className="kpi"><span><Flame size={12} /> Streak</span><b>{streak(playtime.days)} day{streak(playtime.days) === 1 ? "" : "s"}</b><small>Best: {bestStreak(playtime.days)}</small></div>}
        {universeId == null ? null : <div className="kpi"><span><Trophy size={12} /> Peak hour</span><b>{hours[peak] ? hourLabel(peak) : "—"}</b></div>}
      </div>
      <div className="charts-grid">
        <div className="chart-card">
          <h4>Last 14 days</h4>
          <BarChart data={days.map((d) => ({ label: d.day, value: d.secs }))} label={(d, i) => (i % 2 === 1 ? new Date(d.label).toLocaleDateString(undefined, { day: "numeric" }) : "")} highlight={13} />
        </div>
        <div className="chart-card">
          <h4>Most active hours {hours[peak] > 0 && <span className="muted-inline">· peak around {hourLabel(peak)}</span>}</h4>
          <BarChart data={hours.map((v, h) => ({ label: hourLabel(h), value: v }))} label={(d, i) => (i % 3 === 0 ? d.label : "")} highlight={peak} />
        </div>
      </div>
    </div>
  );
}
