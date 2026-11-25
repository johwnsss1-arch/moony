import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { ACCENTS, useApp } from "../lib/store";
import { cleanName } from "../lib/format";
import { Empty, Segmented } from "../components/ui";
import { themeById } from "../lib/themes";

const W = 1080, H = 1350;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function range(kind) {
  const n = new Date();
  if (kind === "month") return { from: new Date(n.getFullYear(), n.getMonth(), 1), to: n, label: `${MONTHS[n.getMonth()]} ${n.getFullYear()}` };
  if (kind === "last") { const a = new Date(n.getFullYear(), n.getMonth() - 1, 1); return { from: a, to: new Date(n.getFullYear(), n.getMonth(), 1), label: `${MONTHS[a.getMonth()]} ${a.getFullYear()}` }; }
  return { from: new Date(n.getFullYear(), 0, 1), to: n, label: `${n.getFullYear()}` };
}

function compute(playtime, kind) {
  const { from, to, label } = range(kind);
  const a = from.getTime(), b = to.getTime();
  const per = {}, days = {}, hours = new Array(24).fill(0);
  let total = 0, longest = null, count = 0;
  for (const s of playtime.sessions || []) {
    const st = Math.max(s.start, a), en = Math.min(s.end, b);
    if (en <= st) continue;
    const secs = (en - st) / 1000;
    total += secs; count++;
    per[s.u] = (per[s.u] || 0) + secs;
    const d = new Date(st).toISOString().slice(0, 10);
    days[d] = (days[d] || 0) + secs;
    hours[new Date(st).getHours()] += secs;
    if (!longest || secs > longest.secs) longest = { secs, u: s.u };
  }
  const name = (u) => cleanName(playtime.games?.[u]?.name || "A Roblox game");
  const top = Object.entries(per).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([u, secs]) => ({ u, secs, name: name(u), icon: playtime.games?.[u]?.icon }));
  const best = Object.entries(days).sort((x, y) => y[1] - x[1])[0];
  const keys = Object.keys(days).sort();
  let streak = 0, run = 0, prev = null;
  for (const k of keys) { const t = new Date(k).getTime(); run = prev && t - prev === 864e5 ? run + 1 : 1; streak = Math.max(streak, run); prev = t; }
  const peak = hours.indexOf(Math.max(...hours));
  const vibe = peak >= 22 || peak < 5 ? "Night owl" : peak < 12 ? "Early bird" : peak < 18 ? "Afternoon grinder" : "Evening gamer";
  return { label, total, count, top, games: Object.keys(per).length, longest: longest && { ...longest, name: name(longest.u) }, bestDay: best && { day: best[0], secs: best[1] }, streak, vibe };
}

const hrs = (s) => (s >= 3600 ? `${(s / 3600).toFixed(s >= 36000 ? 0 : 1)}h` : `${Math.round(s / 60)}m`);
const loadImg = (src) => new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

async function draw(cv, d, user, accent) {
  const g = cv.getContext("2d");
  const font = (w, s) => `${w} ${s}px "Inter Variable", Inter, "Segoe UI", sans-serif`;
  g.fillStyle = "#08080b"; g.fillRect(0, 0, W, H);
  let gr = g.createRadialGradient(W * 0.85, 80, 0, W * 0.85, 80, 900); gr.addColorStop(0, accent + "cc"); gr.addColorStop(1, "transparent");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createRadialGradient(0, H, 0, 0, H, 800); gr.addColorStop(0, accent + "55"); gr.addColorStop(1, "transparent");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,.035)"; for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 1);

  const P = 84;
  g.fillStyle = "rgba(255,255,255,.7)"; g.font = font(700, 30); g.fillText("MOONY WRAPPED", P, 120);
  g.fillStyle = "#fff"; g.font = font(800, 78); g.fillText(d.label, P, 205);
  if (user) { g.fillStyle = "rgba(255,255,255,.6)"; g.font = font(500, 32); g.fillText(`@${user}`, P, 255); }

  g.fillStyle = "#fff"; g.font = font(900, 220); g.fillText(hrs(d.total), P - 8, 480);
  g.fillStyle = "rgba(255,255,255,.65)"; g.font = font(600, 36); g.fillText(`played across ${d.games} game${d.games === 1 ? "" : "s"} · ${d.count} sessions`, P, 540);

  g.fillStyle = accent; g.font = font(800, 28); g.fillText("TOP GAMES", P, 625);
  const icons = await Promise.all(d.top.map((t) => loadImg(t.icon)));
  const max = d.top[0]?.secs || 1;
  d.top.forEach((t, i) => {
    const y = 655 + i * 92;
    g.save(); g.beginPath(); g.roundRect(P, y, 70, 70, 16); g.clip();
    if (icons[i]) g.drawImage(icons[i], P, y, 70, 70); else { g.fillStyle = "rgba(255,255,255,.1)"; g.fillRect(P, y, 70, 70); }
    g.restore();
    g.fillStyle = "rgba(255,255,255,.45)"; g.font = font(800, 30); g.fillText(`${i + 1}`, P + 92, y + 46);
    g.fillStyle = "#fff"; g.font = font(700, 32);
    let n = t.name; while (g.measureText(n).width > 560 && n.length > 4) n = n.slice(0, -2); if (n !== t.name) n += "…";
    g.fillText(n, P + 132, y + 34);
    g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.roundRect(P + 132, y + 50, 600, 10, 5); g.fill();
    g.fillStyle = accent; g.beginPath(); g.roundRect(P + 132, y + 50, Math.max(14, 600 * (t.secs / max)), 10, 5); g.fill();
    g.fillStyle = "rgba(255,255,255,.8)"; g.font = font(700, 30); g.textAlign = "right"; g.fillText(hrs(t.secs), W - P, y + 46); g.textAlign = "left";
  });

  const tiles = [
    ["Longest session", d.longest ? hrs(d.longest.secs) : "—"],
    ["Best streak", `${d.streak} day${d.streak === 1 ? "" : "s"}`],
    ["You're a", d.vibe],
  ];
  const tw = (W - P * 2 - 32) / 3, ty = 1135;
  tiles.forEach(([k, v], i) => {
    const x = P + i * (tw + 16);
    g.fillStyle = "rgba(255,255,255,.06)"; g.beginPath(); g.roundRect(x, ty, tw, 120, 22); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)"; g.font = font(600, 24); g.fillText(k, x + 24, ty + 42);
    g.fillStyle = "#fff"; g.font = font(800, v.length > 12 ? 30 : 40); g.fillText(v, x + 24, ty + 92);
  });
  g.fillStyle = "rgba(255,255,255,.5)"; g.font = font(600, 26); g.fillText("moonylauncher.xyz", P, H - 36);
  g.textAlign = "right"; g.fillText("made with Moony", W - P, H - 36); g.textAlign = "left";
}

export default function Wrapped() {
  const { playtime, launchAs, settings, toast } = useApp();
  const [kind, setKind] = useState("month");
  const cv = useRef(null);
  const d = useMemo(() => compute(playtime, kind), [playtime, kind]);
  const accent = themeById("moonlight").accent[0];
  useEffect(() => { if (cv.current && d.total) document.fonts.ready.then(() => draw(cv.current, d, launchAs?.name, accent)); }, [d, launchAs?.name, accent]);

  const save = async () => {
    let url;
    try { url = cv.current.toDataURL("image/png"); }
    catch { await draw(cv.current, { ...d, top: d.top.map((t) => ({ ...t, icon: null })) }, launchAs?.name, accent); url = cv.current.toDataURL("image/png"); }
    const name = `moony-wrapped-${d.label.replace(/\s+/g, "-").toLowerCase()}`;
    if (window.orbit?.savePicture) {
      try { await window.orbit.savePicture(name, url.split(",")[1]); toast("Saved to Pictures\\Moony", "success"); } catch (e) { toast(e.message || String(e), "error"); }
    } else { const a = document.createElement("a"); a.href = url; a.download = name + ".png"; a.click(); }
  };

  return (
    <div className="page wrapped-page">
      <div className="page-head row">
        <div><h1>Wrapped</h1><p>Your Roblox in one card. Save it and post it.</p></div>
        <Segmented value={kind} onChange={setKind} options={[{ value: "month", label: "This month" }, { value: "last", label: "Last month" }, { value: "year", label: "This year" }]} />
      </div>
      {!d.total ? (
        <Empty icon={Sparkles} title="Nothing played yet" text={`Play some games through Moony and your ${kind === "year" ? "year" : "month"} shows up here.`} />
      ) : (
        <div className="wrapped-layout">
          <canvas ref={cv} width={W} height={H} className="wrapped-card" />
          <div className="wrapped-side">
            <button className="btn primary lg" onClick={save}><Download size={15} /> Save image</button>
            <small>Saved as a PNG (1080×1350), the right size for TikTok, Instagram and Discord.</small>
            <div className="wrapped-facts">
              {d.bestDay && <div><small>Best day</small><b>{new Date(d.bestDay.day).toLocaleDateString([], { month: "short", day: "numeric" })} · {hrs(d.bestDay.secs)}</b></div>}
              {d.longest && <div><small>Longest session</small><b>{d.longest.name} · {hrs(d.longest.secs)}</b></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
