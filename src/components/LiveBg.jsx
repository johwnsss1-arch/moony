import { useEffect, useRef } from "react";

// Animated backgrounds drawn on one canvas, capped at 30 fps and paused while
// Moony is idle, hidden or minimised so they cost nothing in game.
export const LIVE_BGS = [
  { id: "off", label: "Off" },
  { id: "starfield", label: "Warp stars" },
  { id: "synthwave", label: "Synthwave" },
  { id: "aurora", label: "Aurora" },
  { id: "rain", label: "Rain" },
  { id: "matrix", label: "Matrix" },
  { id: "snow", label: "Snow" },
  { id: "orbs", label: "Floating orbs" },
];

const rnd = (a, b) => a + Math.random() * (b - a);

function setup(kind, w, h) {
  const n = { starfield: 260, rain: 220, snow: 180, orbs: 14, matrix: 0 }[kind] ?? 0;
  const items = Array.from({ length: n }, () => ({ x: rnd(-1, 1), y: rnd(-1, 1), z: rnd(0.05, 1), s: rnd(0.4, 1), a: rnd(0, 6.28), px: rnd(0, w), py: rnd(0, h) }));
  const cols = kind === "matrix" ? Array.from({ length: Math.ceil(w / 16) }, () => rnd(-40, 0)) : null;
  return { items, cols };
}

function frame(g, kind, st, w, h, t, acc) {
  if (kind === "starfield") {
    g.fillStyle = "rgba(3,3,8,.35)"; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    for (const p of st.items) {
      p.z -= 0.006; if (p.z <= 0.02) { p.x = rnd(-1, 1); p.y = rnd(-1, 1); p.z = 1; }
      const x = cx + (p.x / p.z) * cx * 0.6, y = cy + (p.y / p.z) * cy * 0.6, r = (1 - p.z) * 2.2;
      if (x < 0 || x > w || y < 0 || y > h) { p.z = 1; continue; }
      g.fillStyle = `rgba(255,255,255,${1 - p.z})`; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
    }
  } else if (kind === "synthwave") {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.55);
    sky.addColorStop(0, "#0a0418"); sky.addColorStop(1, "#2a0a3a"); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const sun = g.createLinearGradient(0, h * 0.2, 0, h * 0.55); sun.addColorStop(0, "#ffd36b"); sun.addColorStop(1, "#ff3d8b");
    g.fillStyle = sun; g.beginPath(); g.arc(w / 2, h * 0.55, h * 0.24, Math.PI, 0); g.fill();
    g.fillStyle = "#2a0a3a"; for (let i = 0; i < 6; i++) g.fillRect(0, h * 0.42 + i * i * 2.4 + i * 6, w, 2 + i);
    g.fillStyle = "#07020f"; g.fillRect(0, h * 0.55, w, h);
    g.strokeStyle = acc; g.lineWidth = 1.2; g.globalAlpha = 0.75;
    const hz = h * 0.55, off = (t / 40) % 40;
    for (let i = 0; i < 26; i++) { const y = hz + Math.pow((i * 40 + off) / 1000, 2) * (h - hz) * 1.6; if (y > h) break; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(w / 2 + i * 14, hz); g.lineTo(w / 2 + i * w * 0.12, h); g.stroke(); }
    g.globalAlpha = 1;
  } else if (kind === "aurora") {
    g.fillStyle = "#03060d"; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    for (let k = 0; k < 3; k++) {
      const hue = [150, 190, 280][k];
      g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.35 + k * 0.08) + Math.sin(x / (180 + k * 60) + t / (2200 + k * 700)) * 60 + Math.sin(x / 90 + t / 1500) * 16);
      g.lineTo(w, h); g.closePath();
      const gr = g.createLinearGradient(0, h * 0.2, 0, h); gr.addColorStop(0, `hsla(${hue},90%,62%,.7)`); gr.addColorStop(0.5, `hsla(${hue},90%,50%,.16)`); gr.addColorStop(1, "transparent");
      g.fillStyle = gr; g.fill();
    }
    g.globalCompositeOperation = "source-over";
  } else if (kind === "rain") {
    g.fillStyle = "rgba(5,8,14,.55)"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(170,200,255,.35)"; g.lineWidth = 1;
    for (const p of st.items) { p.py += 14 * p.s + 6; p.px -= 2; if (p.py > h) { p.py = -20; p.px = rnd(0, w + 100); } g.beginPath(); g.moveTo(p.px, p.py); g.lineTo(p.px + 3, p.py - 16 * p.s); g.stroke(); }
  } else if (kind === "snow") {
    g.clearRect(0, 0, w, h); g.fillStyle = "#070b14"; g.fillRect(0, 0, w, h);
    for (const p of st.items) { p.py += 0.6 + p.s; p.px += Math.sin(t / 1400 + p.a) * 0.5; if (p.py > h) { p.py = -5; p.px = rnd(0, w); } g.fillStyle = `rgba(255,255,255,${0.35 + p.s * 0.5})`; g.beginPath(); g.arc(p.px, p.py, p.s * 2.4, 0, 6.3); g.fill(); }
  } else if (kind === "matrix") {
    g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(0, 0, w, h);
    g.fillStyle = acc; g.font = "15px monospace";
    st.cols.forEach((y, i) => { g.fillText(String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96)), i * 16, y * 16); st.cols[i] = y * 16 > h && Math.random() > 0.97 ? 0 : y + 1; });
  } else if (kind === "orbs") {
    g.fillStyle = "#06060b"; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    for (const p of st.items) {
      const x = w / 2 + Math.sin(t / (6000 * p.s) + p.a) * w * 0.45, y = h / 2 + Math.cos(t / (7000 * p.s) + p.a * 2) * h * 0.45, r = 60 + p.s * 140;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, acc + "55"); gr.addColorStop(1, "transparent");
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = "source-over";
  }
}

export function LiveBg({ kind, accent = "#8b7dff", paused }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || kind === "off") return;
    const g = cv.getContext("2d");
    let w = 0, h = 0, st = null, raf = 0, last = 0;
    const size = () => { const r = cv.getBoundingClientRect(); w = cv.width = Math.max(1, Math.round(r.width)); h = cv.height = Math.max(1, Math.round(r.height)); st = setup(kind, w, h); };
    size();
    const ro = new ResizeObserver(size); ro.observe(cv);
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (paused || document.hidden || t - last < 33) return;
      last = t; frame(g, kind, st, w, h, t, accent);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [kind, accent, paused]);
  if (kind === "off") return null;
  return <div className="custom-bg live-bg" aria-hidden><canvas ref={ref} /></div>;
}
