import { useCallback, useEffect, useState } from "react";
import { Check, Download, FolderOpen, Layers, Pin, PinOff, RefreshCw, Trash2 } from "lucide-react";
import { useApp } from "../lib/store";
import { Empty } from "../components/ui";

const api = window.orbit?.versions;
const GUID = /^version-[0-9a-f]{16}$/i;
const mb = (n) => (n / 1e6).toFixed(n > 1e8 ? 0 : 1);

export default function Versions() {
  const { toast } = useApp();
  const [info, setInfo] = useState(null);
  const [hash, setHash] = useState("");
  const [chan, setChan] = useState("");
  const [prog, setProg] = useState({});
  const load = useCallback(() => api?.info().then((i) => { setInfo(i); setChan(i.channel); }), []);
  useEffect(() => { load(); return api?.onProgress((p) => setProg((o) => ({ ...o, [p.guid]: p }))); }, [load]);
  if (!api) return <div className="page"><div className="page-head"><h1>Versions</h1><p>Choose which Roblox build Moony launches, or download any version by its hash.</p></div><Empty icon={Layers} title="Desktop app only" text="Versions are managed by the desktop app." /></div>;

  const download = async (g) => {
    const guid = g.trim();
    if (!GUID.test(guid)) return toast("Paste a version hash like version-1a2b3c4d5e6f7a8b", "error");
    const r = await api.install(guid);
    if (!r.ok) return toast(r.error, "error");
    toast(`${guid} downloaded`, "success"); setHash(""); load();
  };
  const pin = async (guid) => { const r = await api.pin(guid); if (!r.ok) return toast(r.error, "error"); toast(guid ? `Moony will launch ${guid}` : "Moony will launch the latest Roblox", "success"); load(); };
  const setChannel = async () => { const r = await api.channel(chan || "production"); if (!r.ok) return toast(r.error, "error"); toast(`Channel set to ${r.prefs.channel}`, "success"); load(); };
  const remove = async (guid) => { await api.remove(guid); load(); };
  const active = info?.pinned || info?.latest?.guid;

  return (
    <div className="page versions">
      <div className="page-head"><h1>Versions</h1><p>Choose which Roblox build Moony launches, or download any version by its hash.</p></div>
      {!info ? <div className="muted-text"><RefreshCw size={14} className="spin" /> Checking Roblox…</div> : <>
        <div className="ver-hero">
          <div className={"ver-mode" + (!info.pinned ? " on" : "")} onClick={() => info.pinned && pin(null)}>
            <span className="ver-radio">{!info.pinned && <Check size={12} strokeWidth={3} />}</span>
            <div><b>Always latest</b><small>{info.latest ? `${info.latest.version} · ${info.latest.guid}` : info.error || "Offline"}</small></div>
            <span className="tag">Recommended</span>
          </div>
          <div className={"ver-mode" + (info.pinned ? " on" : "")}>
            <span className="ver-radio">{info.pinned && <Check size={12} strokeWidth={3} />}</span>
            <div><b>Pinned version</b><small>{info.pinned || "Pin one below to stay on it. Roblox may refuse very old versions."}</small></div>
          </div>
        </div>

        <h3 className="list-title">Download a version</h3>
        <form className="ver-add" onSubmit={(e) => { e.preventDefault(); download(hash); }}>
          <input className="input mono" placeholder="version-xxxxxxxxxxxxxxxx" value={hash} onChange={(e) => setHash(e.target.value)} spellCheck={false} />
          <button className="btn primary" disabled={!GUID.test(hash.trim()) || prog[hash.trim()]?.phase?.startsWith("Down")}><Download size={14} /> Download</button>
        </form>
        {Object.values(prog).filter((p) => p.phase && p.phase !== "done" && p.phase !== "error").map((p) => (
          <div key={p.guid} className="ver-prog">
            <span className="mono">{p.guid}</span>
            <div className="bar"><i style={{ width: p.total ? `${(p.done / p.total) * 100}%` : "15%" }} /></div>
            <small>{p.total ? `${mb(p.done)} / ${mb(p.total)} MB${p.speed ? ` · ${mb(p.speed)} MB/s` : ""}` : p.phase}</small>
          </div>
        ))}

        <h3 className="list-title">On this PC</h3>
        <div className="ver-list">
          {info.installed.length === 0 && <p className="muted-text">Nothing yet. Moony downloads Roblox the first time you play.</p>}
          {info.installed.map((v) => (
            <div key={v.guid} className={"ver-row" + (v.guid === active ? " on" : "")}>
              <div className="ver-main">
                <b className="mono">{v.guid}</b>
                <small>
                  {v.version && v.version !== v.guid ? v.version : v.complete ? "Custom download" : "Incomplete"}
                  {v.guid === info.latest?.guid && " · latest"}
                  {v.guid === info.pinned && " · pinned"}
                </small>
              </div>
              {v.guid === active && <span className="tag on">In use</span>}
              {v.complete && v.guid !== info.pinned && <button className="btn sm secondary" onClick={() => pin(v.guid)}><Pin size={13} /> Pin</button>}
              {v.guid === info.pinned && <button className="btn sm secondary" onClick={() => pin(null)}><PinOff size={13} /> Unpin</button>}
              <button className="btn sm ghost icon-only" title="Open folder" onClick={() => api.open(v.guid)}><FolderOpen size={14} /></button>
              <button className="btn sm ghost icon-only" title="Delete" onClick={() => remove(v.guid)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        <h3 className="list-title">Channel</h3>
        <div className="ver-add">
          <input className="input mono" value={chan} onChange={(e) => setChan(e.target.value)} placeholder="production" spellCheck={false} />
          <button className="btn secondary" onClick={setChannel}>Use channel</button>
        </div>
        <p className="settings-foot">Most players should stay on <b>production</b>. Roblox only lets staff and testers into other channels; if one doesn't work, Moony falls back to what's installed.</p>
      </>}
    </div>
  );
}
