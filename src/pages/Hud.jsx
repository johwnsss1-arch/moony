import { useEffect, useRef, useState } from "react";
import { LayoutDashboard, Magnet, RotateCcw } from "lucide-react";
import { DEFAULT_SETTINGS, useApp } from "../lib/store";
import { HudWidget, WIDGETS } from "../components/HudWidgets";
import { Empty, Slider, Toggle } from "../components/ui";
import "../hud.css";

const ZOOM = 2.2;
const SNAP = 1.6; // % distance at which a widget snaps to a guide
const GUIDES = [3, 50, 97];

// HUD editor. The preview is your actual Roblox window, scaled down: same
// shape, widgets drawn at their real size, and a live picture of the game
// behind them, so what you place here is exactly where it shows in game.
export default function Hud() {
  const { settings, updateSettings, nowPlaying, friends, recent, favorites } = useApp();
  const hud = { ...DEFAULT_SETTINGS.hud, ...settings.hud, widgets: { ...DEFAULT_SETTINGS.hud.widgets, ...(settings.hud?.widgets || {}) } };
  const [sel, setSel] = useState("game");
  const [status, setStatus] = useState(null);
  const [media, setMedia] = useState(null);
  const [drag, setDrag] = useState(null); // { id, x, y, snapX, snapY }
  const [snap, setSnap] = useState(true);
  const [boxW, setBoxW] = useState(800);
  const box = useRef(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const o = window.orbit;
    if (!o) return;
    o.hud?.status().then(setStatus);
    o.media?.get().then(setMedia);
    const offs = [o.hud?.onStatus(setStatus), o.media?.onChange(setMedia)];
    return () => offs.forEach((f) => f?.());
  }, []);
  // No live game picture here: capturing Roblox while dragging made it lag.
  const [focus, setFocus] = useState(null); // zoom target { x, y } while editing
  const focusTimer = useRef(0);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  if (!window.orbit) return <div className="page"><Empty icon={LayoutDashboard} title="Desktop app only" text="The in-game HUD works in the desktop app." /></div>;

  // The real Roblox window size (or your screen, before Roblox has been seen).
  const screenSize = window.screen.width > 0 && window.screen.height > 0 ? { width: window.screen.width, height: window.screen.height } : { width: 1920, height: 1080 };
  const size = status?.size?.width > 0 ? status.size : screenSize;
  const k = boxW / size.width;
  const fallbackArt = recent[0]?.banner || favorites[0]?.banner || null;

  const save = (patch) => updateSettings({ hud: { ...hud, ...patch } });
  const setWidget = (id, patch) => save({ widgets: { ...hud.widgets, [id]: { x: 93, y: 96, on: false, ...DEFAULT_SETTINGS.hud.widgets[id], ...hud.widgets[id], ...patch } } });

  const startDrag = (id) => (e) => {
    e.preventDefault();
    setSel(id);
    clearTimeout(focusTimer.current);
    const rect = box.current.getBoundingClientRect();
    const w0 = hud.widgets[id];
    const start = { px: e.clientX, py: e.clientY, x: w0.x, y: w0.y };
    setFocus({ x: w0.x, y: w0.y });
    let last = null, raf = 0;
    const move = (ev) => {
      // The stage is zoomed in ZOOM× around where the drag started.
      let x = start.x + ((ev.clientX - start.px) / (rect.width * ZOOM)) * 100;
      let y = start.y + ((ev.clientY - start.py) / (rect.height * ZOOM)) * 100;
      x = Math.min(99, Math.max(1, x)); y = Math.min(99, Math.max(1, y));
      let snapX = null, snapY = null;
      if (snap && !ev.altKey) {
        for (const g of GUIDES) { if (Math.abs(x - g) < SNAP) { x = g; snapX = g; } if (Math.abs(y - g) < SNAP) { y = g; snapY = g; } }
      }
      x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10;
      last = { id, x, y, snapX, snapY };
      // Only redraw the preview while dragging; save once on release.
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; setDrag(last); });
    };
    const up = () => {
      cancelAnimationFrame(raf);
      if (last) setWidget(id, { x: last.x, y: last.y });
      setDrag(null);
      focusTimer.current = setTimeout(() => setFocus(null), 450);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const nudge = (e) => {
    const d = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] }[e.key];
    if (!d || !sel) return;
    e.preventDefault();
    const w = hud.widgets[sel];
    const m = e.shiftKey ? 4 : 1;
    setFocus({ x: w.x, y: w.y });
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocus(null), 1200);
    setWidget(sel, { x: Math.min(99, Math.max(1, Math.round((w.x + d[0] * m) * 10) / 10)), y: Math.min(99, Math.max(1, Math.round((w.y + d[1] * m) * 10) / 10)) });
  };

  const state = {
    now: nowPlaying || { name: null, startedAt: tick - 754000, region: null },
    media, time: tick,
    prefs: { friendsOnline: friends.data.filter((f) => f.presence?.type > 0).length },
    system: { cpu: 23, ram: 61 },
  };
  const selW = hud.widgets[sel];

  return (
    <div className="page hud-page">
      <div className="page-head row">
        <div><h1>HUD</h1><p>An overlay on top of Roblox. Drag widgets into place; it updates in game right away.</p></div>
        <Toggle checked={hud.enabled} onChange={(v) => save({ enabled: v })} label="Show HUD in game" />
      </div>

      <div className="hud-layout">
        <div>
          <div className="hud-stage" ref={box} tabIndex={0} onKeyDown={nudge} style={{ aspectRatio: `${size.width} / ${size.height}` }}>
            <div className={"hud-zoom" + (focus ? " on" : "")} style={focus ? { transform: `scale(${ZOOM})`, transformOrigin: `${focus.x}% ${focus.y}%` } : undefined}>
            {fallbackArt ? <img className="hud-bg dim" src={fallbackArt} alt="" draggable={false} /> : <div className="hud-bg scene" />}

            {/* Guides */}
            {drag?.snapX != null && <i className="hud-guide v" style={{ left: `${drag.snapX}%` }} />}
            {drag?.snapY != null && <i className="hud-guide h" style={{ top: `${drag.snapY}%` }} />}

            {/* The HUD at real size, scaled to the preview */}
            <div className="hud-real" style={{ width: size.width, height: size.height, transform: `scale(${k})`, opacity: hud.enabled ? hud.opacity : hud.opacity * 0.5 }}>
              <div className={"hud-root t-" + (settings.theme || "midnight")} style={{ position: "absolute", "--hud-scale": hud.scale, "--viz": "var(--accent)", "--hud-acc": "var(--accent)" }}>
                {Object.entries(hud.widgets).filter(([, w]) => w.on).map(([id, w0]) => { const w = drag?.id === id ? { ...w0, x: drag.x, y: drag.y } : w0; return (
                  <div key={id} className={"hud-widget-pos" + (sel === id ? " sel" : "") + (drag?.id === id ? " dragging" : "")} style={{ left: `${w.x}%`, top: `${w.y}%`, pointerEvents: "auto" }} onPointerDown={startDrag(id)}>
                    <HudWidget id={id} state={state} demo />
                  </div>
                ); })}
              </div>
            </div>
            </div>
            {drag && <span className="hud-coords">x {drag.x}% · y {drag.y}%</span>}
          </div>

          <div className="hud-toolbar">
            <span className="hud-size-note">{status?.size ? `Your Roblox window: ${Math.round(size.width)}×${Math.round(size.height)}` : `Your screen: ${size.width}×${size.height}`}</span>
            <span className="grow" />
            <label className="inline-toggle"><Toggle checked={snap} onChange={setSnap} label="Snap to guides" /><Magnet size={13} /> Snap</label>
            {selW && <span className="hud-sel-pos">{WIDGETS[sel].label}: x {selW.x}% · y {selW.y}%</span>}
          </div>
          <small className="hud-hint">Drag to move · arrow keys nudge the selected widget (Shift for bigger steps) · hold Alt to place freely.</small>

          <div className="hud-status" style={{ marginTop: 12 }}>
            <span className={"dot-live" + (status?.showing ? " on" : "")} />
            <div className="grow">
              <b>{!hud.enabled ? "HUD is off" : status?.showing ? "Showing in Roblox now" : status?.roblox ? "Roblox is in front" : "Waiting for Roblox"}</b>
              <small>{hud.enabled ? "Appears when the Roblox window is in front and hides when you switch away. Clicks go straight through it." : "Turn it on with the switch above."}</small>
            </div>
          </div>
        </div>

        <div className="hud-side">
          <div className="settings-group">
            <div className="hud-list">
              {Object.entries(WIDGETS).map(([id, w]) => (
                <div key={id} className={"hud-item" + (sel === id ? " sel" : "")} onClick={() => setSel(id)}>
                  <div className="grow"><b>{w.label}</b><small>{id === "visualizer" && media ? `${media.title}${media.app ? ` · ${media.app}` : ""}` : w.desc}</small></div>
                  <Toggle checked={!!hud.widgets[id]?.on} onChange={(v) => setWidget(id, { on: v })} label={w.label} />
                  {id === "text" && hud.widgets.text?.on && <input className="input hud-text-in" maxLength={40} placeholder="Your text" value={hud.widgets.text?.label || ""} onClick={(e) => e.stopPropagation()} onChange={(e) => setWidget("text", { label: e.target.value })} />}
                </div>
              ))}
            </div>
          </div>
          <div className="settings-group">
            <div className="setting"><div><b>Size</b></div><Slider value={Math.round(hud.scale * 100)} min={70} max={150} step={5} onChange={(v) => save({ scale: v / 100 })} format={(v) => v + "%"} /></div>
            <div className="setting"><div><b>Opacity</b></div><Slider value={Math.round(hud.opacity * 100)} min={30} max={100} step={5} onChange={(v) => save({ opacity: v / 100 })} format={(v) => v + "%"} /></div>
          </div>
          <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={() => updateSettings({ hud: DEFAULT_SETTINGS.hud })}><RotateCcw size={13} /> Reset layout</button>
        </div>
      </div>
    </div>
  );
}
