// Moony trailer. Every frame is a pure function of time t (seconds), so it can
// be previewed live or rendered frame-by-frame at a locked 60 fps by
// trailer/render.cjs. Layout adapts to landscape (16:9) and portrait (9:16).
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useEffect, useState } from "react";
import { Globe2, Clock3, LayoutDashboard, Wand2, Users, RefreshCw } from "lucide-react";
import "@fontsource-variable/inter";
import "@fontsource/fredoka/latin-600.css";
import "@fontsource/creepster/latin-400.css";
import "@fontsource/orbitron/latin-700.css";
import "@fontsource/mountains-of-christmas/latin-700.css";
import "@fontsource/m-plus-rounded-1c/latin-800.css";
import "@fontsource/pacifico/latin-400.css";
import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/space-grotesk/latin-700.css";
import "../src/index.css";
import "../src/pages5.css";
import "../src/pages6.css";
import "./trailer.css";
import { THEMES, THEME_FONTS } from "../src/lib/themes";
import { SceneArt, FrameDeco } from "../src/components/ThemeArt";
import { Pets } from "../src/components/Pets";

export const DURATION = 34;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const fade = (t, a, b, c, d) => Math.min(prog(t, a, b), 1 - prog(t, c, d));

const ORDER = ["midnight", "kawaii", "anime", "halloween", "christmas", "ocean", "forest", "cyberpunk", "galaxy", "sunset", "mono"];
const M0 = 8, M1 = 24, SLOT = (M1 - M0) / ORDER.length;

function Stars({ t }) {
  const s = [];
  for (let i = 0; i < 90; i++) {
    const x = (i * 97.3) % 100, y = (i * 61.7) % 100, tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.8 + (i % 5) * 0.3) + i));
    s.push(<i key={i} style={{ left: `${x}%`, top: `${(y + t * (0.3 + (i % 3) * 0.2)) % 100}%`, opacity: tw, transform: `scale(${0.5 + (i % 4) * 0.35})` }} />);
  }
  return <div className="tr-stars">{s}</div>;
}

function Intro({ t }) {
  const p = easeOut(prog(t, 0.2, 1.6));
  const word = "Moony";
  const out = 1 - prog(t, 3.6, 4.1);
  return (
    <div className="tr-center" style={{ opacity: out, transform: `scale(${1 + prog(t, 3.6, 4.1) * 0.3})` }}>
      <div className="tr-glow" style={{ opacity: p * (0.7 + 0.3 * Math.sin(t * 3)) }} />
      <img src="/build/icon.png" className="tr-logo" style={{ transform: `scale(${0.4 + 0.6 * back(prog(t, 0.2, 1.3))}) rotate(${(1 - p) * -40}deg)`, opacity: p }} />
      <h1 className="tr-word">
        {word.split("").map((ch, i) => {
          const q = prog(t, 1.1 + i * 0.12, 1.6 + i * 0.12);
          return <span key={i} style={{ opacity: q, transform: `translateY(${(1 - back(q)) * 60}px)`, display: "inline-block" }}>{ch}</span>;
        })}
      </h1>
      <p className="tr-tag" style={{ opacity: prog(t, 2.4, 3), transform: `translateY(${(1 - easeOut(prog(t, 2.4, 3))) * 20}px)` }}>a Roblox launcher</p>
    </div>
  );
}

function Slams({ t }) {
  const lines = [["Your games.", 4], ["Your style.", 5.3], ["Your launcher.", 6.6]];
  return (
    <div className="tr-center">
      {lines.map(([txt, a], i) => {
        const v = fade(t, a, a + 0.25, a + 1.15, a + 1.3);
        if (v <= 0) return null;
        const k = easeOut(prog(t, a, a + 0.35));
        return <h2 key={i} className="tr-slam" style={{ opacity: v, transform: `scale(${1.6 - 0.6 * k})`, filter: `blur(${(1 - k) * 8}px)` }}>{txt}</h2>;
      })}
    </div>
  );
}

function ThemeShot({ id, t, local }) {
  const theme = THEMES.find((x) => x.id === id);
  const [a, b] = theme.accent;
  const style = { ...theme.vars, "--accent": a, "--accent-2": b, "--wm-1": theme.wordmark[0], "--wm-2": theme.wordmark[1], "--wm-3": theme.wordmark[2] };
  const wipe = easeInOut(prog(local, 0, 0.35));
  const card = back(prog(local, 0.08, 0.5));
  const zoom = 1.06 - 0.06 * easeOut(prog(local, 0, SLOT));
  const on = local > 0.55;
  return (
    <div className={`frame tr-stage has-art theme-${id}`} style={{ ...style, clipPath: `circle(${wipe * 150}% at 50% 50%)` }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }}>
        <SceneArt id={id} />
        <FrameDeco id={id} />
      </div>
      <Pets id={id} />
      <div className="tr-mock" style={{ transform: `translateY(${(1 - card) * 80}px) scale(${0.9 + 0.1 * card})`, opacity: prog(local, 0.08, 0.3) }}>
        <div className="tr-mock-title" style={{ fontFamily: THEME_FONTS[id] }}>{theme.name}</div>
        <div className="settings-group tr-mock-body">
          <div className="tr-row"><span>Launch</span><button className="btn primary lg">▶ Play</button></div>
          <div className="tr-row"><span>Server region</span><div style={{ display: "flex", gap: 6 }}><span className="chip on">EU West</span><span className="chip">US East</span></div></div>
          <div className="tr-row"><span>Theme artwork</span><span className={"toggle" + (on ? " on" : "")}><span className="knob" /></span></div>
          <div className="tr-row"><span>Account</span><button className="btn secondary">Switch</button></div>
        </div>
      </div>
    </div>
  );
}

function Montage({ t }) {
  const i = Math.floor((t - M0) / SLOT);
  const shots = [];
  for (const k of [i - 1, i]) {
    if (k < 0 || k >= ORDER.length) continue;
    shots.push(<ThemeShot key={ORDER[k]} id={ORDER[k]} t={t} local={t - (M0 + k * SLOT)} />);
  }
  const label = fade(t, M0, M0 + 0.4, M1 - 0.4, M1);
  return (
    <>
      {shots}
      <div className="tr-badge" style={{ opacity: label }}>{ORDER.length} themes · {i + 1 > ORDER.length ? ORDER.length : i + 1}/{ORDER.length}</div>
    </>
  );
}

const FEATS = [
  [Globe2, "Pick your server region"],
  [Clock3, "Playtime tracking"],
  [LayoutDashboard, "In-game HUD editor"],
  [Wand2, "Mods & FPS tweaks"],
  [Users, "Friends & multi-account"],
  [RefreshCw, "Updates itself"],
];
function Features({ t }) {
  const out = 1 - prog(t, 29.6, 30);
  return (
    <div className="tr-center" style={{ opacity: Math.min(prog(t, 24, 24.3), out) }}>
      <h2 className="tr-h2" style={{ transform: `translateY(${(1 - easeOut(prog(t, 24, 24.6))) * 30}px)` }}>Everything in one place</h2>
      <div className="tr-feats">
        {FEATS.map(([Icon, txt], i) => {
          const q = back(prog(t, 24.4 + i * 0.3, 24.9 + i * 0.3));
          return (
            <div key={i} className="tr-feat" style={{ opacity: prog(t, 24.4 + i * 0.3, 24.7 + i * 0.3), transform: `translateY(${(1 - q) * 40}px) scale(${0.8 + 0.2 * q})` }}>
              <Icon size={34} strokeWidth={2.2} style={{ transform: `rotate(${Math.sin(t * 2 + i) * 6}deg)` }} /><span>{txt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Outro({ t }) {
  const p = back(prog(t, 30, 30.8));
  const end = 1 - prog(t, 33.2, 34);
  return (
    <div className="tr-center" style={{ opacity: Math.min(prog(t, 30, 30.3), end) }}>
      <div className="tr-glow" style={{ opacity: 0.8 }} />
      <img src="/build/icon.png" className="tr-logo" style={{ transform: `scale(${p}) translateY(${Math.sin(t * 2) * 6}px)` }} />
      <h1 className="tr-word" style={{ opacity: prog(t, 30.4, 30.9) }}>Moony</h1>
      <p className="tr-tag" style={{ opacity: prog(t, 31, 31.5) }}>Free for Windows</p>
      <p className="tr-cta" style={{ opacity: prog(t, 31.5, 32), transform: `scale(${0.9 + 0.1 * back(prog(t, 31.5, 32))})` }}>discord.gg/wsphtTzsP</p>
    </div>
  );
}

function Trailer({ t }) {
  return (
    <div className="tr-root">
      <Stars t={t} />
      {t < 4.2 && <Intro t={t} />}
      {t >= 4 && t < 8 && <Slams t={t} />}
      {t >= M0 && t < M1 && <Montage t={t} />}
      {t >= 24 && t < 30 && <Features t={t} />}
      {t >= 30 && <Outro t={t} />}
      <div className="tr-vignette" />
    </div>
  );
}

// ---- Short edits for TikTok (portrait) ----
// Before / after: a plain grey launcher, then a swipe into Moony on the drop.
function Plain() {
  return (
    <div className="ba-plain">
      <div className="ba-bar"><span /><span /><span /></div>
      <div className="ba-body">
        <div className="ba-side">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div>
        <div className="ba-main">
          <div className="ba-hero" />
          <div className="ba-row">{Array.from({ length: 3 }, (_, i) => <i key={i} />)}</div>
          <div className="ba-btn">Play</div>
          <div className="ba-row">{Array.from({ length: 3 }, (_, i) => <i key={i} />)}</div>
        </div>
      </div>
    </div>
  );
}
const BA_THEMES = ["kawaii", "cyberpunk", "halloween", "ocean", "galaxy", "christmas"];
function BeforeAfter({ t }) {
  const cut = 2, per = 1.5;
  const swipe = easeInOut(prog(t, cut - 0.15, cut + 0.25));
  const shake = t > cut - 0.9 && t < cut ? Math.sin(t * 90) * 5 * prog(t, cut - 0.9, cut) : 0;
  const k = Math.min(BA_THEMES.length - 1, Math.max(0, Math.floor((t - cut) / per)));
  const endAt = cut + BA_THEMES.length * per;
  return (
    <div className="tr-root">
      <Stars t={t} />
      {t < cut + 0.3 && (
        <div className="ba-before" style={{ transform: `translateX(${shake}px)`, clipPath: `inset(0 0 0 ${swipe * 100}%)` }}>
          <Plain />
          <div className="ba-label" style={{ opacity: prog(t, 0.1, 0.4) }}>BEFORE</div>
          <div className="ba-cap" style={{ opacity: prog(t, 0.3, 0.6) }}>the default launcher</div>
        </div>
      )}
      {t >= cut - 0.15 && t < endAt + 0.5 && (
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${(1 - swipe) * 100}% 0 0)` }}>
          {[k - 1, k].filter((x) => x >= 0).map((x) => <ThemeShot key={BA_THEMES[x]} id={BA_THEMES[x]} t={t} local={t - (cut + x * per) + (x === 0 ? 0.36 : 0)} />)}
          <div className="ba-label after">AFTER <small>with Moony</small></div>
        </div>
      )}
      {t >= cut - 0.1 && t < cut + 0.5 && <div className="ba-flash" style={{ opacity: 0.85 * (1 - prog(t, cut, cut + 0.5)) }} />}
      {t >= endAt && <EndCard t={t - endAt} />}
      <div className="tr-vignette" />
    </div>
  );
}
function Showcase({ t }) {
  const per = 1.2, k = Math.min(ORDER.length - 1, Math.floor(t / per));
  const endAt = ORDER.length * per;
  return (
    <div className="tr-root">
      <Stars t={t} />
      {t < endAt + 0.5 && [k - 1, k].filter((x) => x >= 0).map((x) => <ThemeShot key={ORDER[x]} id={ORDER[x]} t={t} local={t - x * per + (x === 0 ? 0.36 : 0)} />)}
      {t < endAt && <div className="tr-badge">Moony themes · {k + 1}/{ORDER.length}</div>}
      {t >= endAt && <EndCard t={t - endAt} />}
      <div className="tr-vignette" />
    </div>
  );
}
function EndCard({ t }) {
  const p = back(prog(t, 0, 0.6));
  return (
    <div className="tr-center" style={{ opacity: prog(t, 0, 0.25), zIndex: 60, background: "radial-gradient(90% 70% at 50% 100%, #1d1850, #08070f 70%)" }}>
      <div className="tr-glow" style={{ opacity: 0.8 }} />
      <img src="/build/icon.png" className="tr-logo" style={{ transform: `scale(${p}) translateY(${Math.sin(t * 2) * 6}px)` }} />
      <h1 className="tr-word" style={{ opacity: prog(t, 0.3, 0.7) }}>Moony</h1>
      <p className="tr-tag" style={{ opacity: prog(t, 0.6, 1) }}>Free Roblox launcher for Windows</p>
      <p className="tr-cta" style={{ opacity: prog(t, 0.9, 1.3), background: "#fff", color: "#0b0b10" }}>Link in bio</p>
    </div>
  );
}
const EDITS = { trailer: [Trailer, DURATION], beforeafter: [BeforeAfter, 2 + 6 * 1.5 + 3.5], showcase: [Showcase, 11 * 1.2 + 3.5] };

// Live preview: plays in real time. Render mode (?render): render.cjs calls
// window.renderAt(t) for each frame and screenshots it. ?edit= picks the cut.
const params = new URLSearchParams(location.search);
const [Comp, LEN] = EDITS[params.get("edit")] || EDITS.trailer;
window.trailerDuration = LEN;
const root = createRoot(document.getElementById("root"));
const syncCss = (t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t * 1000; });
if (params.has("render")) {
  window.renderAt = (t) => { flushSync(() => root.render(<Comp t={t} />)); syncCss(t); };
  window.renderAt(0);
  document.fonts.ready.then(() => { window.trailerReady = true; });
} else {
  function Live() {
    const [t, setT] = useState(0);
    useEffect(() => { let raf, s = performance.now(); const f = (n) => { setT(((n - s) / 1000) % LEN); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, []);
    return <Comp t={t} />;
  }
  root.render(<Live />);
}
