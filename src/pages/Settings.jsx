import { useEffect, useState } from "react";
import { ImagePlus, Trash2, Bell, Check, ChevronRight, Cpu, Download, Gamepad2, Keyboard, LayoutDashboard, Lock, MessageCircle, Palette, Rocket, SlidersHorizontal, Swords, UsersRound, Wrench, Sparkles } from "lucide-react";
import { ACCENTS, DEFAULT_SETTINGS, useApp } from "../lib/store";
import { THEMES, THEME_FONTS, themeById } from "../lib/themes";
import { SceneArt } from "../components/ThemeArt";
import { LIVE_BGS } from "../components/LiveBg";
import { UI_FONTS } from "../lib/fonts";
import { clearBg, emitBgChange, loadBg, onBgChange, saveBg } from "../lib/custombg";

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
  { id: "general", label: "General", icon: SlidersHorizontal, group: "App" },
  { id: "appearance", label: "Appearance", icon: Palette, group: "App" },
  { id: "themes", label: "Themes", icon: Sparkles, group: "App" },
  { id: "updates", label: "Updates", icon: Download, group: "App" },
  { id: "roblox", label: "Roblox", icon: Swords, group: "Roblox" },
  { id: "launch", label: "Launching", icon: Gamepad2, group: "Roblox" },
  { id: "hud", label: "HUD", icon: LayoutDashboard, group: "Roblox" },
  { id: "performance", label: "Performance", icon: Rocket, group: "Roblox" },
  { id: "accounts", label: "Accounts", icon: UsersRound, group: "You" },
  { id: "discord", label: "Discord", icon: MessageCircle, group: "You" },
  { id: "notifications", label: "Notifications", icon: Bell, group: "You" },
  { id: "privacy", label: "Privacy", icon: Lock, group: "You" },
  { id: "advanced", label: "Advanced", icon: Wrench, group: "You" },
];
const CAT_DESC = {
  general: "How Moony opens and lays itself out.",
  appearance: "Backgrounds, fonts, colors and motion.",
  themes: "Each theme restyles the whole app, its artwork and its loading screen.",
  updates: "Moony updates itself in the background and asks before restarting.",
  roblox: "The Roblox Player on this PC and the engine settings Moony can change.",
  launch: "What happens when you press Play.",
  hud: "The overlay Moony shows on top of Roblox while you play.",
  performance: "Boost mode and session stats.",
  accounts: "The Roblox accounts linked on this computer.",
  discord: "Show what you're playing on your Discord profile.",
  notifications: "Windows notifications about friends and games.",
  privacy: "What Moony remembers, and how to clear it.",
  advanced: "Resets and keyboard shortcuts.",
};

const Row = ({ title, desc, children }) => (
  <div className="setting"><div><b>{title}</b>{desc && <small>{desc}</small>}</div><div className="setting-ctl">{children}</div></div>
);

export default function Settings() {
  const [cat, setCat] = useState(() => new URLSearchParams(location.search).get("settings") || "general");
  const groups = [...new Set(CATS.map((c) => c.group))];
  const current = CATS.find((c) => c.id === cat) || CATS[0];
  return (
    <div className="page settings nf-settings">
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          <h1 className="settings-title">Settings</h1>
          {groups.map((g) => (
            <div key={g} className="settings-nav-group">
              <span className="settings-nav-h">{g}</span>
              {CATS.filter((c) => c.group === g).map((c) => (
                <button key={c.id} className={cat === c.id ? "on" : ""} aria-current={cat === c.id ? "page" : undefined} onClick={() => setCat(c.id)}><c.icon size={15} /> {c.label}</button>
              ))}
            </div>
          ))}
        </nav>
        <div className="settings-panel" key={cat}>
          <header className="settings-head"><h2>{current.label}</h2><p>{CAT_DESC[current.id]}</p></header>
          {cat === "general" && <General />}
          {cat === "appearance" && <Appearance />}
          {cat === "themes" && <Themes />}
          {cat === "updates" && <Updates />}
          {cat === "roblox" && <Performance />}
          {cat === "launch" && <Launch />}
          {cat === "hud" && <HudCat />}
          {cat === "performance" && <BoostCat />}
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

function ThemePreview({ t }) {
  const v = t.vars;
  return (
    <span className="nftp" style={{ "--p-bg": v["--bg-0"], "--p-side": v["--bg-1"], "--p-surface": v["--surface"], "--p-surface2": v["--surface-2"], "--p-text": v["--text"], "--p-text3": v["--text-3"], "--p-a": t.accent[0], "--p-b": t.accent[1], "--p-amb": t.ambient[0], "--p-font": `"${THEME_FONTS[t.id]}"` }}>
      <span className="nftp-scene"><SceneArt id={t.id} className="nftp-art" /></span>
      <span className="nftp-side"><i className="nftp-logo" /><i /><i className="on" /><i /><i /><i /></span>
      <span className="nftp-main">
        <span className="nftp-card"><b>Aa</b><span className="nftp-line" /><span className="nftp-btn" /></span>
        <span className="nftp-row"><i /><i /><i /><i /></span>
      </span>
    </span>
  );
}

function Themes() {
  const { settings: s, updateSettings: u, toast } = useApp();
  const current = themeById(s.theme);
  const pick = (t) => {
    if (t.id === current.id) return;
    const prev = current.id;
    u({ theme: t.id, accent: "theme" });
    toast(`Switched to ${t.name}`, "success", { action: { label: "Undo", run: () => u({ theme: prev }) } });
  };
  return (
    <div className="nf-themes">
      {THEMES.map((t) => (
        <button key={t.id} className={"nf-tcard" + (current.id === t.id ? " on" : "")} onClick={() => pick(t)} aria-pressed={current.id === t.id}>
          <ThemePreview t={t} />
          <span className="nf-tmeta">
            <span className="nf-tname">{t.name}{current.id === t.id && <span className="nf-ton"><Check size={12} strokeWidth={3} /> In use</span>}</span>
            <small>{t.desc}</small>
            <span className="nf-tchips"><i style={{ background: t.accent[0] }} /><i style={{ background: t.ambient[1] }} /><i style={{ background: t.vars["--surface-2"] }} />{t.particles && <em>{EFFECT_NAMES[t.particles]}</em>}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Updates() {
  const { settings: s, updateSettings: u, setPage } = useApp();
  return (
    <div className="settings-group">
      <UpdateRow />
      <Row title="Update notifications" desc="Show a banner when a new version is ready to install.">
        <Toggle checked={s.alertsUpdates !== false} onChange={(v) => u({ alertsUpdates: v })} />
      </Row>
      <Row title="What's new" desc="The full list of changes in each version.">
        <button className="btn ghost sm" onClick={() => window.dispatchEvent(new Event("moony:whatsnew"))}>Show changelog</button>
      </Row>
    </div>
  );
}

function HudCat() {
  const { settings: s, setPage } = useApp();
  const on = !!(s.hud?.enabled);
  return (
    <div className="settings-group">
      <Row title="In-game HUD" desc={isDesktop ? (on ? "The overlay is on. Widgets show while Roblox is focused." : "The overlay is off.") : "The HUD works in the desktop app."}>
        <span className={"pill " + (on ? "active" : "")}>{on ? "On" : "Off"}</span>
      </Row>
      <Row title="Widgets, layout and crosshair" desc="Pick widgets, drag them into place and design a crosshair in the HUD editor.">
        <button className="btn secondary sm" onClick={() => setPage("hud")}>Open HUD editor <ChevronRight size={14} /></button>
      </Row>
    </div>
  );
}

function BoostCat() {
  const { settings: s, updateSettings: u, setPage } = useApp();
  return (
    <div className="settings-group">
      <Row title="Boost mode" desc="While a game runs, Roblox gets high CPU priority and Windows uses the High performance power plan. Both go back to normal when you leave.">
        <Toggle checked={!!s.boost} onChange={(v) => u({ boost: v })} label="Boost mode" />
      </Row>
      <Row title="Session stats" desc="Ping, CPU and RAM for every game you play.">
        <button className="btn secondary sm" onClick={() => setPage("performance")}>Open Performance <ChevronRight size={14} /></button>
      </Row>
      <Row title="Engine tweaks" desc="Mods and FFlags that change how Roblox runs.">
        <button className="btn ghost sm" onClick={() => setPage("tweaks")}>Open Tweaks <ChevronRight size={14} /></button>
      </Row>
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

const LOAD_STYLES = [["classic", "Classic"], ["minimal", "Minimal"], ["neon", "Neon"], ["glass", "Glass"], ["retro", "Retro"]];
function LoadingCard({ s, u }) {
  const l = { style: "classic", tagline: "", gameArt: true, fx: "stars", ...s.loading };
  const set = (p) => u({ loading: { ...l, ...p } });
  return (
    <div className="settings-group">
      <Row title="Style"><div className="ap-chips">{LOAD_STYLES.map(([id, name]) => <button key={id} className={"chip" + (l.style === id ? " on" : "")} onClick={() => set({ style: id })}>{name}</button>)}</div></Row>
      <Row title="Your text" desc="A line shown under the progress, like your name or a motto."><input className="input" style={{ width: 220 }} maxLength={60} placeholder="e.g. let's get this W" value={l.tagline} onChange={(e) => set({ tagline: e.target.value })} /></Row>
      <Row title="Game art background" desc="Blurs the game's icon behind the window."><Toggle checked={l.gameArt !== false} onChange={(v) => set({ gameArt: v })} /></Row>
      <Row title="Twinkling stars"><Toggle checked={l.fx === "stars"} onChange={(v) => set({ fx: v ? "stars" : "none" })} /></Row>
      {window.orbit?.splashPreview && <Row title="Preview" desc="Opens it for 5 seconds."><button className="btn secondary sm" onClick={() => window.orbit.splashPreview(l)}>Show preview</button></Row>}
    </div>
  );
}

function Appearance() {
  const { settings: s, updateSettings: u } = useApp();
  const current = themeById(s.theme);
  return (
    <div className="ap">
      <Section title="Background" desc="A picture, GIF or video behind the whole app.">
        <BackgroundCard s={s} u={u} />
      </Section>

      <Section title="Live background" desc="An animated scene behind the app. It pauses while you're in a game, so it doesn't cost FPS.">
        <div className="ap-chips">{LIVE_BGS.map((b) => <button key={b.id} className={"chip" + ((s.liveBg || "off") === b.id ? " on" : "")} onClick={() => u({ liveBg: b.id })}>{b.label}</button>)}</div>
        {s.liveBg && s.liveBg !== "off" && <small className="muted">Replaces the theme's artwork. A custom picture or video background still wins if you've set one.</small>}
      </Section>

      <Section title="Font" desc="The font used across Moony.">
        <div className="ap-chips">{UI_FONTS.map((f) => <button key={f.id} className={"chip" + ((s.uiFont || "inter") === f.id ? " on" : "")} onClick={() => u({ uiFont: f.id })}>{f.label}</button>)}</div>
        <small className="muted">For Roblox's in-game font, use Tweaks → Mods → Font.</small>
      </Section>

      <Section title="Loading screen" desc="The window you see while a game launches.">
        <LoadingCard s={s} u={u} />
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
      <Row title="Rejoin automatically when disconnected" desc="Puts you back in the same server a few seconds after Roblox drops you (up to 3 tries).">
        <Toggle checked={!!s.autoRejoin} onChange={(v) => u({ autoRejoin: v })} />
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
        <Row title="“Join my server” button" desc="Friends can click it on your Discord profile to join the server you're in.">
          <Toggle checked={s.discordJoinButton !== false} onChange={(v) => u({ discordJoinButton: v })} />
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
