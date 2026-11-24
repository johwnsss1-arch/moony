import { useEffect, useRef } from "react";

const KINDS = {
  snow: {
    per: 9000,
    make: (w, h, y) => { const r = Math.random() ** 2 * 2.4 + 0.6; return { x: Math.random() * w, y: y ?? Math.random() * h, r, vy: 18 + r * 16, sway: Math.random() * 6.3, ss: 0.4 + Math.random() * 0.8, a: 0.35 + Math.random() * 0.55 }; },
    move: (p, dt) => { p.sway += p.ss * dt; p.y += p.vy * dt; p.x += Math.sin(p.sway) * 12 * dt + 4 * dt; },
    draw: (g, p) => { g.globalAlpha = p.a; g.fillStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); },
  },
  sakura: {
    per: 26000,
    make: (w, h, y) => ({ x: Math.random() * w, y: y ?? Math.random() * h, s: 4 + Math.random() * 5, vy: 22 + Math.random() * 22, vx: 10 + Math.random() * 18, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 2.4, sway: Math.random() * 6.3, a: 0.55 + Math.random() * 0.4 }),
    move: (p, dt) => { p.sway += dt; p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.sway) * 14) * dt; p.rot += p.vr * dt; },
    draw: (g, p) => {
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = p.a;
      const grad = g.createLinearGradient(-p.s, 0, p.s, 0); grad.addColorStop(0, "#ffd3e6"); grad.addColorStop(1, "#ff8fbf");
      g.fillStyle = grad; g.beginPath(); g.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, 6.283); g.fill(); g.restore();
    },
  },
  hearts: {
    per: 30000,
    make: (w, h, y) => ({ x: Math.random() * w, y: y ?? Math.random() * h, s: 5 + Math.random() * 7, vy: 14 + Math.random() * 16, sway: Math.random() * 6.3, a: 0.35 + Math.random() * 0.45, c: ["#ff7eb6", "#ffc1dc", "#c58bff", "#ffffff"][Math.floor(Math.random() * 4)] }),
    move: (p, dt) => { p.sway += dt * 1.3; p.y += p.vy * dt; p.x += Math.sin(p.sway) * 10 * dt; },
    draw: (g, p) => {
      g.save(); g.translate(p.x, p.y); g.globalAlpha = p.a; g.fillStyle = p.c; const s = p.s / 10;
      g.beginPath(); g.moveTo(0, 3 * s); g.bezierCurveTo(-10 * s, -4 * s, -5 * s, -11 * s, 0, -5 * s); g.bezierCurveTo(5 * s, -11 * s, 10 * s, -4 * s, 0, 3 * s); g.fill(); g.restore();
    },
  },
  stars: {
    per: 7000,
    make: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() ** 3 * 1.6 + 0.4, tw: Math.random() * 6.3, ts: 0.6 + Math.random() * 1.6, vy: 1 + Math.random() * 3 }),
    move: (p, dt) => { p.tw += p.ts * dt; p.y += p.vy * dt; },
    draw: (g, p) => { g.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(p.tw)); g.fillStyle = "#fff"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); },
  },
  embers: {
    per: 22000, rise: true,
    make: (w, h, y) => ({ x: Math.random() * w, y: y ?? Math.random() * h, r: 1 + Math.random() * 2.2, vy: -(14 + Math.random() * 26), sway: Math.random() * 6.3, life: Math.random(), c: Math.random() < 0.8 ? "255,138,31" : "170,90,255" }),
    move: (p, dt) => { p.sway += dt * 2; p.y += p.vy * dt; p.x += Math.sin(p.sway) * 8 * dt; p.life += dt * 0.25; },
    draw: (g, p) => { const a = Math.max(0, Math.sin(p.life * 3.14)) * 0.85; g.globalAlpha = 1; g.fillStyle = `rgba(${p.c},${a})`; g.shadowColor = `rgba(${p.c},${a})`; g.shadowBlur = 8; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); g.shadowBlur = 0; },
  },
  bubbles: {
    per: 26000, rise: true,
    make: (w, h, y) => ({ x: Math.random() * w, y: y ?? Math.random() * h, r: 2 + Math.random() ** 2 * 9, vy: -(12 + Math.random() * 22), sway: Math.random() * 6.3, a: 0.25 + Math.random() * 0.35 }),
    move: (p, dt) => { p.sway += dt * 1.5; p.y += p.vy * dt; p.x += Math.sin(p.sway) * 9 * dt; },
    draw: (g, p) => { g.globalAlpha = p.a; g.strokeStyle = "#bdeaff"; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.stroke(); g.globalAlpha = p.a * 0.8; g.fillStyle = "#ffffff"; g.beginPath(); g.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, 6.283); g.fill(); },
  },
  leaves: {
    per: 34000,
    make: (w, h, y) => ({ x: Math.random() * w, y: y ?? Math.random() * h, s: 5 + Math.random() * 6, vy: 20 + Math.random() * 20, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 2, sway: Math.random() * 6.3, a: 0.5 + Math.random() * 0.4, c: ["#e8a33d", "#d4572e", "#9be27b", "#c9852a"][Math.floor(Math.random() * 4)] }),
    move: (p, dt) => { p.sway += dt * 1.2; p.y += p.vy * dt; p.x += Math.sin(p.sway) * 22 * dt; p.rot += p.vr * dt; },
    draw: (g, p) => { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = p.a; g.fillStyle = p.c; g.beginPath(); g.moveTo(0, -p.s); g.quadraticCurveTo(p.s * 0.8, 0, 0, p.s); g.quadraticCurveTo(-p.s * 0.8, 0, 0, -p.s); g.fill(); g.restore(); },
  },
};

export function Particles({ kind = "snow", density = 1 }) {
  const ref = useRef(null);
  useEffect(() => {
    const K = KINDS[kind];
    if (!K) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, raf = 0, last = performance.now();
    let items = [];
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(((w * h) / K.per) * density);
      items = items.slice(0, target);
      while (items.length < target) items.push(K.make(w, h));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const tick = (now) => {
      const minGap = document.hasFocus() ? 32 : 100;
      if (now - last < minGap) { raf = requestAnimationFrame(tick); return; }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of items) {
        K.move(p, dt);
        if (K.rise ? p.y < -12 : p.y > h + 12) Object.assign(p, K.make(w, h, K.rise ? h + 10 : -10));
        if (p.x > w + 12) p.x = -12; else if (p.x < -12) p.x = w + 12;
        K.draw(ctx, p);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } };
    document.addEventListener("visibilitychange", vis);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, [kind, density]);
  return <canvas ref={ref} className="snow" aria-hidden />;
}
export const Snow = (props) => <Particles kind="snow" {...props} />;

const COLORS = ["#ff4d5e", "#ffd166", "#3ddc97", "#4fb3ff"];
export function Lights({ count = 60 }) {
  return (
    <div className="lights" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="light">
          <svg viewBox="0 0 48 10" preserveAspectRatio="none"><path d="M0 1 Q24 15 48 1" /></svg>
          <i className="bulb" style={{ "--c": COLORS[i % COLORS.length], animationDelay: `${(i * 0.37) % 2.4}s` }} />
        </span>
      ))}
    </div>
  );
}
