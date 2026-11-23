import { useEffect, useState } from "react";
import { Bell, Brush, Check, Cpu, ExternalLink, Gamepad2, Keyboard, Lock, MessageCircle, Palette, SlidersHorizontal, UsersRound, Wrench } from "lucide-react";
import { ACCENTS, DEFAULT_SETTINGS, useApp } from "../lib/store";
import { THEMES, THEME_FONTS, themeById } from "../lib/themes";
import { SceneArt } from "../components/ThemeArt";
import { clearBg, emitBgChange, loadBg, saveBg } from "../lib/custombg";

function CustomBgRow({ s, u }) {
  const [has, setHas] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { loadBg().then((b) => setHas(!!b)); }, []);
  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("Pick an image or GIF.");
    if (f.size > 40 * 1024 * 1024) return setErr("That file is over 40 MB.");
    setErr("");
    saveBg(f).then(() => { setHas(true); emitBgChange(); });
  };
  return (
    <>
      <Row title="Custom background" desc={err || "Use your own picture or GIF behind Moony (any wallpaper you like). It stays on this PC and replaces the theme's scene."}>
        <div style={{ display: "flex", gap: 8 }}>
          <label className="btn sm primary" style={{ cursor: "pointer" }}>{has ? "Change" : "Choose image"}<input type="file" accept="image/*" hidden onChange={pick} /></label>
          {has && <button className="btn sm" onClick={() => clearBg().then(() => { setHas(false); emitBgChange(); })}>Remove</button>}
        </div>
      </Row>
      {has && <>
        <Row title="Background dimming" desc="Darken the picture so text stays easy to read."><Slider min={0} max={90} value={s.bgDim ?? 55} onChange={(v) => u({ bgDim: v })} /></Row>
        <Row title="Background blur"><Slider min={0} max={24} value={s.bgBlur ?? 0} onChange={(v) => u({ bgBlur: v })} /></Row>
      </>}
    </>
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

function Appearance() {
  const { settings: s, updateSettings: u } = useApp();
  const current = themeById(s.theme);
  return (
    <>
      <div className="theme-grid">
        {THEMES.map((t) => (
          <button key={t.id} className={"theme-card" + (current.id === t.id ? " on" : "")} onClick={() => u({ theme: t.id })}
            style={{ "--t-bg": t.vars["--bg-1"], "--t-surface": t.vars["--surface-2"], "--t-a": t.accent[0], "--t-b": t.accent[1], "--t-amb1": t.ambient[0], "--t-amb2": t.ambient[1], "--t-wm1": t.wordmark[1], "--t-wm2": t.wordmark[2], "--t-font": `"${THEME_FONTS[t.id]}"` }}>
            <div className="theme-prev">
              <span className="tp-glow" /><span className="tp-glow two" />
              <SceneArt id={t.id} className="tp-art" />
              <span className="tp-side" /><span className="tp-card" /><span className="tp-card b" />
              <span className="tp-btn" />
              <span className="tp-name">Moony</span>
            </div>
            <div className="theme-info">
              <b>{t.name}{current.id === t.id && <Check size={13} />}</b>
              <small>{t.desc}</small>
              {t.particles && <span className="tag">{EFFECT_NAMES[t.particles]}</span>}
            </div>
          </button>
        ))}
      </div>
      <div className="settings-group" style={{ marginTop: 16 }}>
      <Row title="Theme artwork" desc="The illustrated scene and frame decorations for each theme.">
        <Toggle checked={s.themeArt !== false} onChange={(v) => u({ themeArt: v })} />
      </Row>
      <Row title="Pets" desc="Little animals that wander along the bottom of the window. Each theme has its own.">
        <Toggle checked={s.pets !== false} onChange={(v) => u({ pets: v })} />
      </Row>
      <CustomBgRow s={s} u={u} />
      <Row title="Background effect" desc={current.particles ? `${EFFECT_NAMES[current.particles]} for the ${current.name} theme. Off when Reduce motion is on.` : "This theme has no background effect."}>
        <Toggle checked={!!s.snow && !!current.particles} onChange={(v) => u({ snow: v })} />
      </Row>
      <Row title="Accent color" desc="Buttons and highlights. “Match theme” uses the theme's own colour.">
        <div className="swatches">
          <button aria-label="Match theme" title="Match theme" className={"swatch theme-sw" + (s.accent === "theme" ? " on" : "")} style={{ background: `conic-gradient(${current.accent[0]}, ${current.accent[1]}, ${current.accent[0]})` }} onClick={() => u({ accent: "theme" })} />
          {Object.entries(ACCENTS).map(([k, [a, b]]) => (
            <button key={k} aria-label={k} className={"swatch" + (s.accent === k ? " on" : "")} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} onClick={() => u({ accent: k })} />
          ))}
        </div>
      </Row>
      <Row title="Interface scale" desc="Makes everything larger or smaller.">
        <Slider value={s.scale} min={85} max={120} step={5} onChange={(v) => u({ scale: v })} format={(v) => v + "%"} />
      </Row>
      <Row title="Background ambience" desc="Soft animated glow behind the interface.">
        <Toggle checked={s.ambience} onChange={(v) => u({ ambience: v })} />
      </Row>
      <Row title="Reduce motion" desc="Turns off most animations and transitions.">
        <Toggle checked={s.reduceMotion} onChange={(v) => u({ reduceMotion: v })} />
      </Row>
    </div>
    </>
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
