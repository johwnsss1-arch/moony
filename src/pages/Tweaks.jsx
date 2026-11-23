import { useEffect, useMemo, useRef, useState } from "react";
import { Brush, Code2, FileUp, Gauge, Pause, Play, Plus, RotateCcw, Save, Sliders, Trash2, Wand2 } from "lucide-react";
import { useApp } from "../lib/store";
import { fflagsApi, modsApi } from "../lib/bridge";
import { Empty, Segmented, Select, Slider, Toggle } from "../components/ui";

export default function Tweaks() {
  const [tab, setTab] = useState("mods");
  return (
    <div className="page tweaks">
      <div className="page-head"><h1>Tweaks</h1><p>Mods and engine settings for the Roblox player on this PC. Previews update as you change things.</p></div>
      <div className="underline-tabs">
        <button className={tab === "mods" ? "on" : ""} onClick={() => setTab("mods")}><Brush size={13} style={{ marginRight: 6, verticalAlign: -2 }} />Mods</button>
        <button className={tab === "fflags" ? "on" : ""} onClick={() => setTab("fflags")}><Sliders size={13} style={{ marginRight: 6, verticalAlign: -2 }} />FFlags</button>
      </div>
      {!modsApi ? <Empty icon={Wand2} title="Desktop app only" text="Tweaks change files in your Roblox install, so they work in the desktop app." />
        : tab === "mods" ? <Mods /> : <FFlags />}
    </div>
  );
}

/* ===================== Mods ===================== */
function Mods() {
  const { toast } = useApp();
  const [st, setSt] = useState(null);
  const [sel, setSel] = useState("cursor");
  const [rev, setRev] = useState(0);
  useEffect(() => { modsApi.status().then(setSt); return modsApi.onReapplied((s) => { setSt(s); toast("Roblox updated, so Moony re-applied your mods", "success"); }); }, [toast]);
  const run = async (p, msg) => {
    const r = await p;
    if (r?.cancelled) return;
    if (!r?.ok) return toast(r?.error || "Something went wrong", "error");
    setSt(r.status); setRev((x) => x + 1);
    toast(msg + " Restart Roblox to see it in game.", "success");
  };
  if (!st) return null;
  if (!st.installed) return <Empty icon={Wand2} title="Roblox isn't installed" text="Install Roblox, then come back to mod it." />;
  const groups = {};
  for (const [k, v] of Object.entries(st.kinds)) if (v.available) (groups[v.group] ||= []).push([k, v]);
  const cur = st.kinds[sel];

  return (
    <div className="mods-layout">
      <div className="mods-list">
        {Object.entries(groups).map(([g, items]) => (
          <div key={g}>
            <h3 className="list-title">{g}</h3>
            {items.map(([k, v]) => (
              <button key={k} className={"mod-row" + (sel === k ? " on" : "")} onClick={() => setSel(k)}>
                <b>{v.label}</b>
                <small className={v.current ? "signed" : ""}>{v.current ? v.current.name : "Default"}</small>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="mod-detail" key={sel}>
        <h2>{cur.label}</h2>
        <ModPreview kind={sel} group={cur.group} rev={rev} />
        <div className="mod-actions">
          {Object.entries(cur.presets).map(([pk, label]) => (
            <button key={pk} className={"btn " + (cur.current?.preset === pk ? "primary" : "secondary")} onClick={() => run(modsApi.preset(sel, pk), `${label} applied.`)}><Wand2 size={13} /> {label}</button>
          ))}
          <button className="btn secondary" onClick={() => run(modsApi.pick(sel), `${cur.label} applied.`)}><FileUp size={13} /> Choose a file ({cur.ext.join(", ")})</button>
          {cur.current && <button className="btn ghost" onClick={() => run(modsApi.remove(sel), `${cur.label} reset to Roblox's default.`)}><RotateCcw size={13} /> Reset to default</button>}
        </div>
        <p className="settings-foot">Moony keeps Roblox's original files and puts your mods back automatically after Roblox updates ({st.version}{st.upToDate ? ", mods applied" : ""}). Only you see them.</p>
      </div>
    </div>
  );
}

function ModPreview({ kind, group, rev }) {
  const [p, setP] = useState(null);
  const [compare, setCompare] = useState(false);
  useEffect(() => { modsApi.preview(kind).then(setP).catch(() => setP({})); }, [kind, rev]);
  if (!p) return <div className="mod-preview" />;
  const shown = compare || !p.current ? p.original : p.current;

  if (group === "Cursors") {
    return (
      <div className="mod-preview cursor-stage" style={{ cursor: shown ? `url(${shown}) 32 32, auto` : "auto" }}>
        <div className="stage-sky" /><div className="stage-ground" />
        <span className="stage-hint">Move your mouse here: this is your {compare ? "original" : "current"} cursor{p.current ? "" : " (default)"}{p.size ? ` · any image is auto-resized to ${p.size.width}×${p.size.height} for Roblox` : ""}</span>
        {p.current && <button className="btn glass sm compare" onMouseDown={() => setCompare(true)} onMouseUp={() => setCompare(false)} onMouseLeave={() => setCompare(false)}>Hold to compare with original</button>}
        {shown && <img src={shown} alt="" className="cursor-big" />}
      </div>
    );
  }
  if (group === "Sounds") return <div className="mod-preview sound-stage"><SoundButton src={p.current || p.original} label={p.current ? "Your sound" : "Default sound"} />{p.current && <SoundButton src={p.original} label="Original" ghost />}</div>;
  return <FontPreview src={p.current} />;
}

function SoundButton({ src, label, ghost }) {
  const a = useRef(null);
  const [playing, setPlaying] = useState(false);
  if (!src) return null;
  return (
    <button className={"btn " + (ghost ? "ghost" : "primary") + " lg"} onClick={() => {
      if (playing) { a.current?.pause(); setPlaying(false); return; }
      a.current = new Audio(src); a.current.onended = () => setPlaying(false); a.current.play(); setPlaying(true);
    }}>{playing ? <Pause size={15} /> : <Play size={15} />} {label}</button>
  );
}

function FontPreview({ src }) {
  const [family, setFamily] = useState(null);
  useEffect(() => {
    if (!src) return setFamily(null);
    const f = new FontFace("MoonyModFont", `url(${src})`);
    f.load().then((ff) => { document.fonts.add(ff); setFamily("MoonyModFont"); }).catch(() => setFamily(null));
  }, [src]);
  return (
    <div className="mod-preview font-stage" style={{ fontFamily: family ? `${family}, sans-serif` : "'Builder Sans', 'Inter Variable', sans-serif" }}>
      <div className="font-big">The quick brown fox</div>
      <div className="font-ui"><span>PLAY</span><span>Settings</span><span>Leaderboard</span></div>
      <div className="font-chat"><b>Player123:</b> gg everyone, that obby was hard!</div>
      <small className="font-note">{family ? "Preview using your font" : "Roblox's default font"}</small>
    </div>
  );
}

/* ===================== FFlags ===================== */
// Flags Roblox accepts from launchers (other flags are ignored by Roblox).
const PRESETS = [
  { key: "DFIntTaskSchedulerTargetFps", label: "Frame rate limit", desc: "Cap or uncap the frame rate.", type: "slider", min: 30, max: 360, step: 30, off: null, preview: "fps" },
  { key: "FIntDebugForceMSAASamples", label: "Anti-aliasing (MSAA)", desc: "Smoother edges. Higher costs more GPU.", type: "select", options: [[null, "Automatic"], [0, "Off"], [1, "1×"], [2, "2×"], [4, "4×"], [8, "8×"]], preview: "msaa" },
  { key: "DFIntTextureQualityOverride", label: "Texture quality", desc: "Force texture detail. Also sets DFFlagTextureQualityOverrideEnabled.", type: "select", options: [[null, "Automatic"], [0, "Lowest"], [1, "Low"], [2, "Medium"], [3, "High"]], pair: "DFFlagTextureQualityOverrideEnabled", preview: "texture" },
  { key: "FFlagDebugGraphicsPreferD3D11", label: "Graphics API", desc: "Which rendering backend Roblox prefers.", type: "renderer", preview: null },
  { key: "FFlagDebugSkyGray", label: "Gray sky", desc: "Replaces the skybox with flat gray (can raise FPS).", type: "toggle", preview: "sky" },
  { key: "FIntFRMMaxGrassDistance", label: "Hide grass", desc: "Removes terrain grass.", type: "toggle", on: 0, also: { FIntFRMMinGrassDistance: 0 }, preview: "grass" },
  { key: "DFFlagDisableDPIScale", label: "Disable DPI scaling", desc: "Sharper UI on high-DPI screens; UI may look smaller.", type: "toggle" },
  { key: "FFlagHandleAltEnterFullscreenManually", label: "Exclusive fullscreen (Alt+Enter)", desc: "Alt+Enter uses real fullscreen instead of a borderless window.", type: "toggle", on: false },
  { key: "DFIntCSGLevelOfDetailSwitchingDistance", label: "Low detail models", desc: "Switches meshes to low detail sooner (can raise FPS).", type: "toggle", on: 0, also: { DFIntCSGLevelOfDetailSwitchingDistanceL12: 0, DFIntCSGLevelOfDetailSwitchingDistanceL23: 0, DFIntCSGLevelOfDetailSwitchingDistanceL34: 0 } },
  { key: "DFFlagDebugPauseVoxelizer", label: "Pause lighting updates", desc: "Stops voxel lighting recalculation (can raise FPS, lighting may look stuck).", type: "toggle" },
];
const RENDERERS = [["auto", "Automatic"], ["FFlagDebugGraphicsPreferD3D11", "DirectX 11"], ["FFlagDebugGraphicsPreferVulkan", "Vulkan"], ["FFlagDebugGraphicsPreferOpenGL", "OpenGL"]];

function FFlags() {
  const { toast } = useApp();
  const [st, setSt] = useState(null);
  const [draft, setDraft] = useState({});
  const [mode, setMode] = useState("easy");
  const [raw, setRaw] = useState("");
  useEffect(() => { fflagsApi.get().then((s) => { setSt(s); setDraft(s.flags); }); }, []);
  const dirty = st && JSON.stringify(draft) !== JSON.stringify(st.flags);

  const setFlag = (k, v) => setDraft((d) => { const n = { ...d }; if (v === null || v === undefined) delete n[k]; else n[k] = v; return n; });
  const save = async (flags = draft) => {
    try { const s = await fflagsApi.set(flags); setSt(s); setDraft(s.flags); toast("Flags saved. Restart Roblox to apply them.", "success"); }
    catch (e) { toast(e.message.replace(/^.*Error: /, ""), "error"); }
  };
  if (!st) return null;
  if (!st.installed) return <Empty icon={Code2} title="Roblox isn't installed" text="Install Roblox, then come back." />;

  return (
    <>
      <div className="fflag-bar">
        <Segmented value={mode} onChange={(m) => { setMode(m); if (m === "json") setRaw(JSON.stringify(draft, null, 2)); }} options={[{ value: "easy", label: "Presets" }, { value: "table", label: "All flags" }, { value: "json", label: "JSON" }]} />
        <span className="grow" />
        {dirty && <button className="btn ghost" onClick={() => setDraft(st.flags)}>Discard</button>}
        <button className="btn primary" disabled={!dirty && mode !== "json"} onClick={() => (mode === "json" ? (() => { try { save(JSON.parse(raw || "{}")); } catch { toast("That isn't valid JSON", "error"); } })() : save())}><Save size={14} /> Save to Roblox</button>
      </div>
      <p className="settings-foot" style={{ marginTop: 0, marginBottom: 14 }}>Roblox only accepts a limited set of flags from launchers; others are ignored. Saved flags are re-applied after Roblox updates.</p>

      {mode === "easy" && (
        <div className="fflag-grid">
          {PRESETS.map((p) => <PresetCard key={p.key} p={p} draft={draft} setFlag={setFlag} />)}
        </div>
      )}
      {mode === "table" && <FlagTable draft={draft} setFlag={setFlag} />}
      {mode === "json" && <textarea className="json-edit" spellCheck={false} value={raw} onChange={(e) => setRaw(e.target.value)} />}
    </>
  );
}

function PresetCard({ p, draft, setFlag }) {
  const v = draft[p.key];
  let control, live;
  if (p.type === "slider") {
    const on = v != null;
    control = (
      <div className="row-gap" style={{ alignItems: "center" }}>
        <Toggle checked={on} onChange={(x) => setFlag(p.key, x ? 144 : null)} />
        {on && <Slider value={Number(v)} min={p.min} max={p.max} step={p.step} onChange={(n) => setFlag(p.key, n)} format={(n) => `${n} FPS`} />}
      </div>
    );
    live = <FpsPreview fps={on ? Number(v) : 60} />;
  } else if (p.type === "select") {
    const opts = p.options.map(([val, label]) => ({ value: val === null ? "auto" : String(val), label }));
    control = <Select value={v == null ? "auto" : String(v)} width={170} options={opts} onChange={(x) => { const n = x === "auto" ? null : Number(x); setFlag(p.key, n); if (p.pair) setFlag(p.pair, n === null ? null : true); }} />;
    if (p.preview === "texture") live = <TexturePreview level={v == null ? 3 : Number(v)} />;
    if (p.preview === "msaa") live = <MsaaPreview samples={v == null ? 4 : Number(v)} />;
  } else if (p.type === "renderer") {
    const current = RENDERERS.find(([k]) => k !== "auto" && draft[k] === true)?.[0] || "auto";
    control = <Select value={current} width={170} options={RENDERERS.map(([k, l]) => ({ value: k, label: l }))} onChange={(x) => { for (const [k] of RENDERERS) if (k !== "auto") setFlag(k, k === x ? true : null); }} />;
  } else {
    const onVal = p.on ?? true;
    const on = v === onVal;
    control = <Toggle checked={on} onChange={(x) => { setFlag(p.key, x ? onVal : null); for (const [k, val] of Object.entries(p.also || {})) setFlag(k, x ? val : null); }} />;
    if (p.preview === "sky") live = <div className={"sky-preview" + (on ? " gray" : "")}><span /></div>;
    if (p.preview === "grass") live = <div className={"grass-preview" + (on ? " none" : "")}><span /></div>;
  }
  return (
    <div className="fflag-card">
      <div className="fflag-head"><div><b>{p.label}</b><small>{p.desc}</small></div>{control}</div>
      {live && <div className="fflag-live">{live}</div>}
      <code className="fflag-key">{p.key}</code>
    </div>
  );
}

// Live previews: what the setting does, shown with a small animation/image.
function FpsPreview({ fps }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf, last = 0, x = 0;
    const step = (t) => {
      if (t - last >= 1000 / fps) { x = (x + 240 / fps) % 100; if (ref.current) ref.current.style.left = x + "%"; last = t; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return <div className="fps-preview"><span ref={ref} /><small><Gauge size={11} /> Moving at {fps} FPS</small></div>;
}
function TexturePreview({ level }) {
  const size = [16, 40, 90, 400][level] ?? 400;
  return <div className="texture-preview"><canvas ref={(c) => { if (!c) return; const g = c.getContext("2d"); c.width = size; c.height = size; for (let y = 0; y < 8; y++) for (let xx = 0; xx < 8; xx++) { g.fillStyle = (x0 => x0 ? "#b8643a" : "#8c4a2b")((xx + y) % 2); g.fillRect((xx * size) / 8, (y * size) / 8, size / 8, size / 8); } g.fillStyle = "rgba(255,255,255,0.15)"; for (let i = 0; i < 8; i++) g.fillRect(0, (i * size) / 8, size, Math.max(1, size / 80)); }} /><small>{["Lowest", "Low", "Medium", "High"][level]} detail</small></div>;
}
function MsaaPreview({ samples }) {
  return <div className={"msaa-preview s" + samples}><svg viewBox="0 0 120 60" shapeRendering={samples === 0 ? "crispEdges" : "geometricPrecision"}><polygon points="10,52 60,6 110,52" fill="var(--accent)" /></svg><small>{samples === 0 ? "Jagged edges" : `${samples}× smoothing`}</small></div>;
}

function FlagTable({ draft, setFlag }) {
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const rows = useMemo(() => Object.entries(draft).sort(([a], [b]) => a.localeCompare(b)), [draft]);
  const parse = (s) => (s === "true" ? true : s === "false" ? false : /^-?\d+$/.test(s) ? Number(s) : s);
  return (
    <div className="flag-table">
      {rows.length === 0 && <p className="muted-text">No flags set. Add one below or use the presets.</p>}
      {rows.map(([key, val]) => (
        <div className="flag-row" key={key}>
          <code>{key}</code>
          <input className="input" value={String(val)} onChange={(e) => setFlag(key, parse(e.target.value))} />
          <button className="btn ghost sm icon-only" title="Remove" onClick={() => setFlag(key, null)}><Trash2 size={13} /></button>
        </div>
      ))}
      <form className="flag-row add" onSubmit={(e) => { e.preventDefault(); if (/^[A-Za-z][A-Za-z0-9_]{2,100}$/.test(k.trim()) && v.trim()) { setFlag(k.trim(), parse(v.trim())); setK(""); setV(""); } }}>
        <input className="input" placeholder="FlagName (e.g. FFlagDebugSkyGray)" value={k} onChange={(e) => setK(e.target.value)} />
        <input className="input" placeholder="Value (true, 0, text…)" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn secondary sm"><Plus size={13} /> Add</button>
      </form>
    </div>
  );
}
