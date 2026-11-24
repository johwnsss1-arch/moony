import { useEffect, useState } from "react";
import { ImagePlus, Trash2, Bell, Brush, Check, Cpu, ExternalLink, Gamepad2, Keyboard, Lock, MessageCircle, Palette, SlidersHorizontal, UsersRound, Wrench } from "lucide-react";
import { ACCENTS, DEFAULT_SETTINGS, useApp } from "../lib/store";
import { THEMES, THEME_FONTS, themeById } from "../lib/themes";
import { SceneArt } from "../components/ThemeArt";
import { clearBg, emitBgChange, loadBg, onBgChange, saveBg } from "../lib/custombg";

// Custom background: picture, GIF or short video, with a live preview.
function BackgroundCard({ s, u }) {
  const [url, setUrl] = useState(null);
  const [kind, setKind] = useState("image");
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    let cur = null, alive = true;
    const load = () => loadBg().then((b) => { if (!alive) return; if (cur) URL.revokeObjectURL(cur); cur = b ? URL.createObjectURL(b) : null; setUrl(cur); setKind(b?.type?.startsWith("video/") ? "video" : "image"); });
    load();
    const off = onBgChange(load);
    return () => { alive = false; off(); if (cur) URL.revokeObjectURL(cur); };
  }, []);
  const take = (f) => {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return setErr("Use a picture, GIF, WebP or MP4/WebM video.");
    if (f.size > 60 * 1024 * 1024) return setErr("That file is over 60 MB.");
    setErr("");
    saveBg(f).then(emitBgChange);
  };
  return (
    <div className="ap-bg">
      <label className={"ap-drop" + (drag ? " drag" : "") + (url ? " has" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}>
        {url ? (kind === "video" ? <video src={url} autoPlay loop muted playsInline style={{ objectFit: s.bgFit === "contain" ? "contain" : s.bgFit === "center" ? "none" : "cover" }} /> : <img src={url} alt="" style={{ objectFit: s.bgFit === "contain" ? "contain" : s.bgFit === "center" ? "none" : "cover" }} />) : null}
        {url && <span className="ap-dim" style={{ background: `rgba(0,0,0,${(s.bgDim ?? 55) / 100})`, backdropFilter: `blur(${(s.bgBlur ?? 0) / 3}px)` }} />}
        <span className="ap-drop-txt"><ImagePlus size={20} />{url ? "Drop or click to change" : "Drop a picture, GIF or video here, or click to choose"}</span>
        <input type="file" accept="image/*,video/mp4,video/webm" hidden onChange={(e) => { take(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <div className="ap-bg-side">
        {err && <small className="ap-err">{err}</small>}
        {!url && <small className="muted-text">Your own wallpaper replaces the theme's scene. GIFs and videos play on a loop. It stays on this PC.</small>}
        {url && <>
          <div className="ap-ctl"><span>Dim</span><Slider min={0} max={90} value={s.bgDim ?? 55} onChange={(v) => u({ bgDim: v })} format={(v) => v + "%"} /></div>
          <div className="ap-ctl"><span>Blur</span><Slider min={0} max={24} value={s.bgBlur ?? 0} onChange={(v) => u({ bgBlur: v })} format={(v) => v + "px"} /></div>
          <div className="ap-ctl"><span>Fit</span><Segmented value={s.bgFit || "cover"} onChange={(v) => u({ bgFit: v })} options={[{ value: "cover", label: "Fill" }, { value: "contain", label: "Fit" }, { value: "center", label: "Center" }]} /></div>
          <button className="btn sm ghost" onClick={() => clearBg().then(emitBgChange)}><Trash2 size={13} /> Remove background</button>
        </>}
      </div>
    </div>
  );
}
import { isDesktop, notifyApi, robloxInstall, setFpsCap } from "../lib/bridge";
import { Segmented, Select, Slider, Toggle } from "../components/ui";
import { useUpdate } from "../components/UpdateBanner";

const UPD = { checking: "Checking…", downloading: "Downloading update…", latest: "You're up to date", ready: "Update ready", error: "Couldn't check", disabled: "Updates not set up in this build", idle: "" };
function UpdateRow() {
  const s = useUpdate();
  const desc = `Moony ${s?.current || "1.0.0"} · ${isDesktop ? "Desktop" : "Browser preview"}${s?.status && UPD[s.status] ? " · " + UPD[s.status] : ""}${s?.error ? ` (${s.error})` : ""}`;
  return (
    <Row title="Version" desc={desc}>
      {s?.status === "ready"
        ? <button className="btn primary sm" onClick={() => window.orbit.update.apply()}>Restart to update {s.version}</button>
        : <button className="btn sm" disabled={!window.orbit?.update || s?.status === "checking" || s?.status === "downloading"} onClick={() => window.orbit.update.check()}>Check for updates</button>}
    </Row>
  );
}

const CATS = [
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "performance", label: "Performance", icon: Cpu },
  { id: "launch", label: "Game Launch", icon: Gamepad2 },
  { id: "accounts", label: "Accounts", icon: UsersRound },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "discord", label: "Discord", icon: MessageCircle },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "advanced", label: "Advanced", icon: Wrench },
];

const Row = ({ title, desc, children }) => (
  <div className="setting"><div><b>{title}</b>{desc && <small>{desc}</small>}</div><div className="setting-ctl">{children}</div></div>
);

export default function Settings() {
  const [cat, setCat] = useState(() => new URLSearchParams(location.search).get("settings") || "general");
  return (
    <div className="page settings">
      <div className="page-head"><h1>Settings</h1><p>Changes save automatically.</p></div>
      <div className="settings-layout">
        <nav className="settings-nav">
          {CATS.map((c) => (
            <button key={c.id} className={cat === c.id ? "on" : ""} onClick={() => setCat(c.id)}><c.icon size={16} /> {c.label}</button>
          ))}
        </nav>
        <div className="settings-panel" key={cat}>
          <h2>{CATS.find((c) => c.id === cat).label}</h2>
          {cat === "general" && <General />}
          {cat === "appearance" && <Appearance />}
          {cat === "performance" && <Performance />}
          {cat === "launch" && <Launch />}
          {cat === "accounts" && <AccountsCat />}
          {cat === "notifications" && <Notifications />}
          {cat === "discord" && <Discord />}
          {cat === "privacy" && <Privacy />}
          {cat === "advanced" && <Advanced />}
        </div>
      </div>
    </div>
  );
}

function General() {
  const { settings: s, updateSettings: u } = useApp();
  return (
    <div className="settings-group">
      <Row title="Start page" desc="The page Moony opens on.">
        <Select value={s.startPage} onChange={(v) => u({ startPage: v })} options={[{ value: "home", label: "Home" }, { value: "discover", label: "Discover" }, { value: "favorites", label: "Favorites" }, { value: "friends", label: "Friends" }]} />
      </Row>
      <Row title="Side panel" desc="Accounts, players online and recent games on the right. Toggle with Ctrl+B.">
        <Toggle checked={s.rightPanel} onChange={(v) => u({ rightPanel: v })} />
      </Row>
    </div>
  );
}

const EFFECT_NAMES = { snow: "Snowfall", sakura: "Cherry blossoms", hearts: "Floating hearts", stars: "Twinkling stars", embers: "Rising embers", bubbles: "Bubbles", leaves: "Falling leaves" };

const Section = ({ title, desc, children }) => (
  <section className="ap-sec"><header><h3>{title}</h3>{desc && <small>{desc}</small>}</header>{children}</section>
);

function Appearance() {
  const { settings: s, updateSettings: u } = useApp();
  const current = themeById(s.theme);
  return (
    <div className="ap">
      <Section title="Theme" desc={`${current.name} · ${current.desc}`}>
        <div className="ap-themes">
          {THEMES.map((t) => (
            <button key={t.id} data-t={t.id} title={t.desc} className={"ap-tile" + (current.id === t.id ? " on" : "")} onClick={() => u({ theme: t.id })}
              style={{ "--t-bg": t.vars["--bg-1"], "--t-surface": t.vars["--surface-2"], "--t-a": t.accent[0], "--t-b": t.accent[1], "--t-amb1": t.ambient[0], "--t-amb2": t.ambient[1], "--t-wm1": t.wordmark[1], "--t-wm2": t.wordmark[2], "--t-font": `"${THEME_FONTS[t.id]}"` }}>
              <span className="ap-tile-art"><span className="tp-glow" /><span className="tp-glow two" /><SceneArt id={t.id} className="tp-art" /></span>
              <span className="ap-tile-ui"><i /><i /><i className="dot" /></span>
              <span className="ap-tile-name">{t.name}</span>
              {current.id === t.id && <span className="ap-check"><Check size={12} strokeWidth={3} /></span>}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Background" desc="A picture, GIF or video behind the whole app.">
        <BackgroundCard s={s} u={u} />
      </Section>

      <Section title="Color">
        <div className="settings-group">
          <Row title="Accent color" desc="Buttons and highlights. The first swatch follows the theme.">
            <div className="swatches">
              <button aria-label="Match theme" title="Match theme" className={"swatch theme-sw" + (s.accent === "theme" ? " on" : "")} style={{ background: `conic-gradient(${current.accent[0]}, ${current.accent[1]}, ${current.accent[0]})` }} onClick={() => u({ accent: "theme" })} />
              {Object.entries(ACCENTS).map(([k, [a, b]]) => (
                <button key={k} aria-label={k} className={"swatch" + (s.accent === k ? " on" : "")} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} onClick={() => u({ accent: k })} />
              ))}
            </div>
          </Row>
        </div>
      </Section>

      <Section title="Effects">
        <div className="settings-group">
          <Row title="Theme artwork" desc="The illustrated scene and frame decorations."><Toggle checked={s.themeArt !== false} onChange={(v) => u({ themeArt: v })} /></Row>
          <Row title="Pets" desc="Little animals that wander along the bottom of the window."><Toggle checked={s.pets !== false} onChange={(v) => u({ pets: v })} /></Row>
          <Row title="Background effect" desc={current.particles ? `${EFFECT_NAMES[current.particles]} for ${current.name}.` : "This theme has no background effect."}><Toggle checked={!!s.snow && !!current.particles} onChange={(v) => u({ snow: v })} /></Row>
          <Row title="Background glow" desc="Soft animated light behind the interface."><Toggle checked={s.ambience} onChange={(v) => u({ ambience: v })} /></Row>
          <Row title="Reduce motion" desc="Turns off most animations. Also saves CPU."><Toggle checked={s.reduceMotion} onChange={(v) => u({ reduceMotion: v })} /></Row>
        </div>
      </Section>

      <Section title="Layout">
        <div className="settings-group">
          <Row title="Interface scale" desc="Makes everything larger or smaller.">
            <div className="ap-scale">
              {[90, 100, 110, 125].map((v) => <button key={v} className={"chip" + (s.scale === v ? " on" : "")} onClick={() => u({ scale: v })}>{v}%</button>)}
              <Slider value={s.scale} min={75} max={150} step={5} onChange={(v) => u({ scale: v })} format={(v) => v + "%"} />
            </div>
          </Row>
          <Row title="Window corners" desc="How round the window's corners are.">
            <Slider value={s.winRadius ?? 16} min={0} max={28} step={2} onChange={(v) => u({ winRadius: v })} format={(v) => (v ? v + "px" : "Square")} />
          </Row>
        </div>
      </Section>
    </div>
  );
}

function Performance() {
  const { settings: s, updateSettings: u, toast } = useApp();
  const [install, setInstall] = useState(undefined);
  useEffect(() => { robloxInstall().then(setInstall); }, []);
  const apply = async () => {
    const r = await setFpsCap(s.fpsCap);
    toast(r.ok ? (s.fpsCap ? `Frame rate cap set to ${s.fpsCap} FPS` : "Frame rate cap removed") + " — restart Roblox to apply" : r.error, r.ok ? "success" : "error");
  };
  return (
    <>
      <div className="settings-group">
        <Row title="Roblox Player" desc={!isDesktop ? "Install detection works in the desktop app." : install === undefined ? "Checking…" : install?.installed ? `Installed · ${install.version}` : "Not found. Install Roblox from roblox.com first."}>
          <span className={"pill " + (install?.installed ? "active" : "")}>{install?.installed ? "Detected" : isDesktop ? "Not found" : "Desktop only"}</span>
        </Row>
        <Row title="Frame rate limit" desc="Written to Roblox's ClientAppSettings.json. 0 uses Roblox's default.">
          <Slider value={s.fpsCap} min={0} max={360} step={30} onChange={(v) => u({ fpsCap: v })} format={(v) => (v ? v + " FPS" : "Default")} />
        </Row>
      </div>
      <div className="settings-actions">
        <button className="btn primary" onClick={apply} disabled={!install?.installed}>Apply to Roblox</button>
        <small>Roblox only accepts a few settings from launchers. Frame rate is one of them.</small>
      </div>
    </>
  );
}

function Launch() {
  const { settings: s, updateSettings: u } = useApp();
  return (
    <div className="settings-group">
      <Row title="After a game launches" desc={isDesktop ? "What Moony does once Roblox opens." : "Minimize and close work in the desktop app."}>
        <Segmented value={s.afterLaunch} onChange={(v) => u({ afterLaunch: v })} options={[{ value: "nothing", label: "Stay open" }, { value: "minimize", label: "Minimize" }, { value: "close", label: "Close" }]} />
      </Row>
      <ProtocolRow />
      <Row title="Close Roblox when I leave a game" desc="Instead of Roblox's home screen, you come straight back to Moony. Teleports between places don't count.">
        <Toggle checked={s.autoCloseRoblox} onChange={(v) => u({ autoCloseRoblox: v })} />
      </Row>
      <Row title="Ask before launching" desc="Show a confirmation before opening Roblox.">
        <Toggle checked={s.confirmLaunch} onChange={(v) => u({ confirmLaunch: v })} />
      </Row>
      <Row title="Launch method" desc="Games open through the official Roblox app link (roblox://).">
        <span className="pill">Roblox app</span>
      </Row>
    </div>
  );
}

// Make Moony the app Windows uses for Roblox's Play links (roblox-player:).
function ProtocolRow() {
  const { toast } = useApp();
  const [on, setOn] = useState(null);
  useEffect(() => { window.orbit?.protocol?.get().then(setOn); }, []);
  if (!window.orbit?.protocol) return null;
  const change = async (v) => {
    const now = await window.orbit.protocol.set(v);
    setOn(now);
    toast(now ? "Roblox Play links now open with Moony" : "Roblox Play links are back to your previous launcher", "success");
  };
  return (
    <Row title="Open Roblox links with Moony" desc="When you press Play on roblox.com, Moony's bootstrapper starts the game instead of Roblox's launcher (or Fishstrap/Bloxstrap). Turning it off gives links back to whatever handled them before.">
      <Toggle checked={!!on} onChange={change} />
    </Row>
  );
}

function AccountsCat() {
  const { accounts, activeAccount, setActiveId, setPage } = useApp();
  return (
    <div className="settings-group">
      <Row title="Active account" desc="Shown across Moony and used for your welcome screen.">
        {accounts.length ? (
          <Select value={activeAccount?.id ?? null} onChange={(v) => setActiveId(v)} options={accounts.map((a) => ({ value: a.id, label: a.label || a.displayName }))} />
        ) : <button className="btn secondary sm" onClick={() => setPage("accounts")}>Add an account</button>}
      </Row>
      <Row title="Linked accounts" desc={`${accounts.length} account${accounts.length === 1 ? "" : "s"} linked on this computer.`}>
        <button className="btn ghost sm" onClick={() => setPage("accounts")}>Manage</button>
      </Row>
    </div>
  );
}

function Notifications() {
  const { settings: s, updateSettings: u, launchAs, toast } = useApp();
  const test = async () => {
    if (!notifyApi) return toast("Notifications work in the desktop app", "error");
    await notifyApi.friend({ title: "Moony notifications work", body: "This is what a friend alert looks like.", userId: 0, canJoin: false });
  };
  return (
    <>
      <div className="settings-group">
        <Row title="Friend joins a game" desc="A Windows notification you can click to join them.">
          <Toggle checked={s.alertsInGame} onChange={(v) => u({ alertsInGame: v })} />
        </Row>
        <Row title="Friend comes online" desc="A notification when a friend goes from offline to online.">
          <Toggle checked={s.alertsOnline} onChange={(v) => u({ alertsOnline: v })} />
        </Row>
        <Row title="Favorite game updates" desc="A notification when one of your favorite games is updated. Checked every 15 minutes.">
          <Toggle checked={s.alertsUpdates} onChange={(v) => u({ alertsUpdates: v })} />
        </Row>
        <Row title="Test" desc={launchAs ? "Friends are checked about once a minute while Moony is open." : "Alerts need a signed-in account (Accounts page)."}>
          <button className="btn ghost sm" onClick={test}>Send a test notification</button>
        </Row>
      </div>
    </>
  );
}

const DISCORD_STATE = {
  off: ["Off", ""],
  connecting: ["Connecting…", ""],
  connected: ["Connected", "active"],
  unavailable: ["Discord not found", "warn"],
};

function Discord() {
  const { settings: s, updateSettings: u, discordState, nowPlaying } = useApp();
  const [id, setId] = useState(s.discordClientId);
  const valid = /^\d{15,25}$/.test(id.trim());
  const [label, cls] = DISCORD_STATE[s.discordEnabled ? discordState : "off"] || DISCORD_STATE.off;
  return (
    <>
      <div className="settings-group">
        <Row title="Show what I'm playing on Discord" desc={isDesktop ? "Your Discord profile shows “Playing Moony” with the game name and time." : "Works in the desktop app."}>
          <Toggle checked={s.discordEnabled} onChange={(v) => u({ discordEnabled: v })} />
        </Row>
        <Row title="Status" desc={s.discordEnabled && discordState === "unavailable" ? "Open the Discord desktop app, and check the application ID below. Moony retries every 30 seconds." : nowPlaying && s.discordEnabled && discordState === "connected" ? "Showing your current game now." : "Shown on your profile while you're in a game."}>
          <span className={"pill " + cls}>{label}</span>
        </Row>
        <Row title="Show the game's name" desc="Off shows just “Playing Roblox”.">
          <Toggle checked={s.discordShowGame} onChange={(v) => u({ discordShowGame: v })} />
        </Row>
        <Row title="Discord application ID" desc="The ID of the Discord app named “Moony” (see the steps below).">
          <div className="row-gap">
            <input className="input" style={{ width: 200 }} value={id} placeholder="e.g. 1312345678901234567" onChange={(e) => setId(e.target.value.replace(/\D/g, ""))} />
            <button className="btn secondary sm" style={{ height: 34 }} disabled={!valid || id.trim() === s.discordClientId} onClick={() => u({ discordClientId: id.trim() })}>Save</button>
          </div>
        </Row>
      </div>
      <h3 className="sub-title">One-time setup</h3>
      <ol className="steps">
        <li>Open the Discord Developer Portal (discord.com/developers/applications) and sign in.</li>
        <li>Click <b>New Application</b> and name it <b>Moony</b>. Discord shows this name after “Playing”.</li>
        <li>Copy the <b>Application ID</b> from the General Information page, paste it above and click Save.</li>
        <li>Optional: under Rich Presence → Art Assets, upload the Moony icon as the app's icon.</li>
      </ol>
    </>
  );
}

function Privacy() {
  const { settings: s, updateSettings: u, setRecent, setFavorites, setTracked, recent, favorites, tracked, toast } = useApp();
  const clear = (what, fn) => { if (window.confirm(`Clear ${what}? This can't be undone.`)) { fn([]); toast(`Cleared ${what}`); } };
  return (
    <div className="settings-group">
      <Row title="Keep play history" desc="Remember games you launch for Jump back in.">
        <Toggle checked={s.keepHistory} onChange={(v) => u({ keepHistory: v })} />
      </Row>
      <Row title="Play history" desc={`${recent.length} game${recent.length === 1 ? "" : "s"}`}>
        <button className="btn ghost sm" disabled={!recent.length} onClick={() => clear("play history", setRecent)}>Clear</button>
      </Row>
      <Row title="Favorites" desc={`${favorites.length} saved`}>
        <button className="btn ghost sm" disabled={!favorites.length} onClick={() => clear("favorites", setFavorites)}>Clear</button>
      </Row>
      <Row title="Followed players" desc={`${tracked.length} followed`}>
        <button className="btn ghost sm" disabled={!tracked.length} onClick={() => clear("followed players", setTracked)}>Clear</button>
      </Row>
      <Row title="Where your data lives" desc="Everything is stored only on this computer. Moony talks directly to Roblox's public APIs." />
    </div>
  );
}

const SHORTCUTS = [["Ctrl 1 – 7", "Switch page"], ["Ctrl ,", "Settings"], ["Ctrl K", "Search games"], ["Ctrl B", "Toggle side panel"], ["Esc", "Close dialog"]];

function Advanced() {
  const { updateSettings, toast } = useApp();
  return (
    <>
      <div className="settings-group">
        <Row title="Reset settings" desc="Restore every setting to its default. Accounts and favorites are kept.">
          <button className="btn danger sm" onClick={() => { if (window.confirm("Reset all settings?")) { updateSettings(DEFAULT_SETTINGS); toast("Settings reset"); } }}>Reset</button>
        </Row>
        <UpdateRow />
      </div>
      <h3 className="sub-title"><Keyboard size={15} /> Keyboard shortcuts</h3>
      <div className="settings-group">
        {SHORTCUTS.map(([k, d]) => <Row key={k} title={d}><kbd className="key">{k}</kbd></Row>)}
      </div>
    </>
  );
}
