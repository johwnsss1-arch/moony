import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Brush, Check, Code2, FileUp, Globe, Pause, Play, Plus, RefreshCw, RotateCcw, Save, Search, Sliders, Trash2, Wand2, WifiOff } from "lucide-react";
import { useApp } from "../lib/store";
import { fflagsApi, modsApi } from "../lib/bridge";
import { Empty, Segmented, Toggle } from "../components/ui";

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
        {cur.group === "Cursors" && modsApi.online && <OnlineCursors kind={sel} current={cur.current?.name} onPick={(item) => run(modsApi.online(sel, item), `${item.name} applied.`)} />}
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

let cursorCache = null;
function OnlineCursors({ kind, current, onPick }) {
  const [items, setItems] = useState(cursorCache);
  useEffect(() => { if (!cursorCache) fetch("https://moonylauncher.xyz/cursors.json", { cache: "no-store" }).then((r) => r.json()).then((j) => { cursorCache = j.items || []; setItems(cursorCache); }).catch(() => setItems([])); }, []);
  const want = kind === "crosshair" ? "crosshair" : "cursor";
  const list = (items || []).filter((x) => x.kind === want);
  if (!items) return <p className="muted-text" style={{ margin: "10px 0" }}>Loading cursor presets…</p>;
  if (!list.length) return null;
  return (
    <div className="cur-presets">
      <h3 className="list-title">Cursor presets <small>· from moonylauncher.xyz</small></h3>
      <div className="cur-grid">
        {list.map((it) => (
          <button key={it.id} className={"cur-tile" + (current === it.name ? " on" : "")} onClick={() => onPick(it)} title={it.name}>
            <span className="cur-img"><img src={it.url} alt="" /></span>
            <small>{it.name}</small>
          </button>
        ))}
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

const kindOf = (k) => (/^(D|F|S)?FFlag/.test(k) ? "Flag" : /^(D|F|S)?FInt/.test(k) ? "Int" : /^(D|F|S)?FString/.test(k) ? "String" : /^(D|F|S)?FLog/.test(k) ? "Log" : "Other");
const parseVal = (s) => (s === "true" ? true : s === "false" ? false : /^-?\d+$/.test(s) ? Number(s) : s);
const same = (a, b) => String(a) === String(b);

function FFlags() {
  const { toast } = useApp();
  const [st, setSt] = useState(null);
  const [draft, setDraft] = useState({});
  const [mode, setMode] = useState("table");
  const [raw, setRaw] = useState("");
  const [rawErr, setRawErr] = useState("");
  useEffect(() => { fflagsApi.get().then((s) => { setSt(s); setDraft(s.flags); }); }, []);
  const dirty = st && JSON.stringify(draft) !== JSON.stringify(st.flags);

  const setFlag = (k, v) => setDraft((d) => { const n = { ...d }; if (v === null || v === undefined) delete n[k]; else n[k] = v; return n; });
  const switchMode = (m) => {
    if (m === "json") { setRaw(JSON.stringify(draft, null, 2)); setRawErr(""); }
    if (m === "table" && mode === "json") { try { setDraft(JSON.parse(raw || "{}")); } catch { return toast("Fix the JSON first", "error"); } }
    setMode(m);
  };
  const save = async () => {
    let flags = draft;
    if (mode === "json") { try { flags = JSON.parse(raw || "{}"); } catch { return toast("That isn't valid JSON", "error"); } }
    try { const s = await fflagsApi.set(flags); setSt(s); setDraft(s.flags); if (mode === "json") setRaw(JSON.stringify(s.flags, null, 2)); toast("Flags saved. Restart Roblox to apply them.", "success"); }
    catch (e) { toast(e.message.replace(/^.*Error: /, ""), "error"); }
  };
  if (!st) return null;
  if (!st.installed) return <Empty icon={Code2} title="Roblox isn't installed" text="Install Roblox, then come back." />;
  const count = Object.keys(draft).length;

  return (
    <>
      <PresetLibrary draft={draft} setDraft={(fn) => { setDraft(fn); if (mode === "json") setRaw((r) => { try { return JSON.stringify(fn(JSON.parse(r || "{}")), null, 2); } catch { return r; } }); }} />
      <div className="fflag-bar">
        <Segmented value={mode} onChange={switchMode} options={[{ value: "table", label: `All flags (${count})` }, { value: "json", label: "JSON" }]} />
        <span className="grow" />
        {(dirty || mode === "json") && <button className="btn ghost" onClick={() => { setDraft(st.flags); setRaw(JSON.stringify(st.flags, null, 2)); }}>Discard</button>}
        <button className="btn primary" disabled={!dirty && mode !== "json"} onClick={save}><Save size={14} /> Save to Roblox</button>
      </div>
      {mode === "table" ? <FlagTable draft={draft} setFlag={setFlag} />
        : <>
          <textarea className={"json-edit" + (rawErr ? " bad" : "")} spellCheck={false} value={raw}
            onChange={(e) => { setRaw(e.target.value); try { JSON.parse(e.target.value || "{}"); setRawErr(""); } catch (x) { setRawErr(x.message); } }} />
          <p className="settings-foot" style={{ color: rawErr ? "#ff8a96" : undefined }}>{rawErr || "Paste a JSON object of flags. Saving replaces all your flags with this."}</p>
        </>}
      <p className="settings-foot">Roblox only accepts flags on its launcher allowlist; others are ignored. Saved flags are put back after Roblox updates.</p>
    </>
  );
}

function parseFlagText(text) {
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("No flags found in that link");
  let body = text.slice(start, end + 1).replace(/\/\/[^\n]*/g, "").replace(/,\s*([}\]])/g, "$1");
  let j = JSON.parse(body);
  if (j.flags && typeof j.flags === "object") j = j.flags;
  const out = {};
  for (const [k, v] of Object.entries(j)) if (/^[A-Za-z][A-Za-z0-9_]{2,100}$/.test(k) && ["string", "number", "boolean"].includes(typeof v)) out[k] = typeof v === "string" && /^(true|false)$/i.test(v) ? v.toLowerCase() === "true" : typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v;
  if (!Object.keys(out).length) throw new Error("No flags found in that link");
  return out;
}

function ImportLink({ setDraft }) {
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  if (!fflagsApi.fromUrl) return null;
  const go = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const flags = parseFlagText(await fflagsApi.fromUrl(url));
      setDraft((d) => ({ ...d, ...flags }));
      toast(`Added ${Object.keys(flags).length} flags. Review them, then Save to Roblox.`, "success");
      setOpen(false); setUrl("");
    } catch (err) { toast(err.message.replace(/^.*Error: /, ""), "error"); }
    setBusy(false);
  };
  return open ? (
    <form className="flag-import" onSubmit={go}>
      <input className="input" autoFocus placeholder="Paste a link: raw GitHub, Gist, Pastebin…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button className="btn primary" disabled={busy || !url.trim()}>{busy ? "Loading…" : "Import"}</button>
      <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  ) : <button className="btn sm secondary" onClick={() => setOpen(true)}><Link2 size={13} /> Import from link</button>;
}

function PresetLibrary({ draft, setDraft }) {
  const [lib, setLib] = useState(null);
  const [tag, setTag] = useState("All");
  useEffect(() => { fflagsApi.presets?.().then(setLib).catch(() => setLib({ presets: [] })); }, []);
  if (!lib) return <div className="preset-lib loading"><RefreshCw size={14} className="spin" /> Loading presets…</div>;
  const tags = ["All", ...new Set(lib.presets.map((p) => p.tag).filter(Boolean))];
  const list = lib.presets.filter((p) => tag === "All" || p.tag === tag);
  const applied = (p) => Object.entries(p.flags).every(([k, v]) => k in draft && same(draft[k], v));
  const toggle = (p) => setDraft((d) => {
    const n = { ...d };
    if (applied(p)) for (const k of Object.keys(p.flags)) delete n[k];
    else {
      if (Object.keys(p.flags).some((k) => /^FFlagDebugGraphicsPrefer/.test(k))) for (const k of Object.keys(n)) if (/^FFlagDebugGraphicsPrefer/.test(k)) delete n[k];
      Object.assign(n, p.flags);
    }
    return n;
  });
  return (
    <div className="preset-lib">
      <div className="preset-head">
        <b>Preset library</b>
        <span className={"preset-src" + (lib.online ? " on" : "")}>{lib.online ? <><Globe size={12} /> Live from moonylauncher.xyz</> : <><WifiOff size={12} /> Offline copy</>}</span>
        <span className="grow" />
        <div className="preset-tags">{tags.map((t) => <button key={t} className={"chip" + (tag === t ? " on" : "")} onClick={() => setTag(t)}>{t}</button>)}</div>
        <ImportLink setDraft={setDraft} />
      </div>
      <div className="preset-grid">
        {list.map((p) => {
          const on = applied(p);
          return (
            <button key={p.id || p.name} className={"preset-card" + (on ? " on" : "")} onClick={() => toggle(p)} title={Object.entries(p.flags).map(([k, v]) => `${k} = ${v}`).join("\n")}>
              <span className="preset-top"><span className="preset-tag">{p.tag || "Preset"}</span><span className="preset-n">{Object.keys(p.flags).length} flag{Object.keys(p.flags).length === 1 ? "" : "s"}</span></span>
              <b>{p.name}</b>
              <small>{p.desc}</small>
              <span className="preset-act">{on ? <><Check size={13} /> Added · click to remove</> : <><Plus size={13} /> Add</>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FlagTable({ draft, setFlag }) {
  const [q, setQ] = useState("");
  const [k, setK] = useState("");
  const [v, setV] = useState("");
  const rows = useMemo(() => Object.entries(draft).filter(([key]) => key.toLowerCase().includes(q.toLowerCase())).sort(([a], [b]) => a.localeCompare(b)), [draft, q]);
  const add = (e) => {
    e.preventDefault();
    if (!/^[A-Za-z][A-Za-z0-9_]{2,100}$/.test(k.trim()) || !v.trim()) return;
    setFlag(k.trim(), parseVal(v.trim())); setK(""); setV("");
  };
  return (
    <div className="flag-table">
      <form className="flag-add" onSubmit={add}>
        <input className="input" placeholder="FlagName, e.g. FFlagDebugSkyGray" value={k} onChange={(e) => setK(e.target.value)} />
        <input className="input" placeholder="Value: true, 0, text…" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="btn secondary"><Plus size={14} /> Add flag</button>
      </form>
      {Object.keys(draft).length > 6 && <div className="flag-search"><Search size={14} /><input placeholder="Search your flags" value={q} onChange={(e) => setQ(e.target.value)} /></div>}
      {rows.length === 0 && <p className="muted-text" style={{ padding: "18px 4px" }}>{q ? "No flags match." : "No flags yet. Add one above or pick a preset."}</p>}
      {rows.map(([key, val]) => {
        const kind = kindOf(key);
        return (
          <div className="flag-row" key={key}>
            <span className={"flag-kind k-" + kind.toLowerCase()}>{kind}</span>
            <code title={key}>{key}</code>
            {typeof val === "boolean"
              ? <div className="flag-val"><Toggle checked={val} onChange={(x) => setFlag(key, x)} /><small>{String(val)}</small></div>
              : <input className="input flag-val" value={String(val)} onChange={(e) => setFlag(key, parseVal(e.target.value))} />}
            <button className="btn ghost sm icon-only" title="Remove" onClick={() => setFlag(key, null)}><Trash2 size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}
