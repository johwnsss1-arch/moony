import { DiscordIcon } from "./DiscordIcon";
import { api } from "../lib/bridge";
import { DISCORD_URL } from "../lib/links";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageSquareHeart, LayoutDashboard, MessageSquare, Newspaper, Shirt, Wand2, ArrowLeft, LibraryBig, ShoppingBag, ChartNoAxesColumn, Server, CheckCircle2, ChevronDown, Compass, Heart, Home, Info, Minus, PanelRight, Play, Search, Settings, Square, Copy, UserPlus, Users, UsersRound, X, AlertCircle, Layers, Gauge, PartyPopper, Sparkles, PanelLeft } from "lucide-react";
import { useApp } from "../lib/store";
import { win } from "../lib/bridge";
import { cleanName } from "../lib/format";
import { Avatar, Img } from "./ui";
import { Logo } from "./Logo";
import { themeById } from "../lib/themes";
import { NowPlaying, RecentServers } from "./Playtime";
import { Robux } from "./RobuxIcon";

export const NAV = [
  { id: "home", label: "Home", icon: Home, group: 0, desc: "Pick up where you left off and launch Roblox" },
  { id: "discover", label: "Discover", icon: Compass, group: 0, desc: "Search Roblox and browse by genre" },
  { id: "charts", label: "Charts", icon: ChartNoAxesColumn, group: 0, desc: "Live rankings: most played, trending, rising" },
  { id: "library", label: "Library", icon: LibraryBig, group: 0, desc: "Every game you've played, with hours" },
  { id: "favorites", label: "Favorites", icon: Heart, group: 0, desc: "Games you've saved" },
  { id: "friends", label: "Friends", icon: Users, group: 1, desc: "Who's online and what they're playing" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: 1, desc: "Message your Roblox friends" },
  { id: "party", label: "Party", icon: PartyPopper, group: 1, desc: "Follow a friend into every server they join" },
  { id: "servers", label: "Servers", icon: Server, group: 2, desc: "Pick a server, rejoin old ones, private links" },
  { id: "avatar", label: "Avatar", icon: Shirt, group: 2, desc: "Change your avatar in 3D" },
  { id: "market", label: "Marketplace", icon: ShoppingBag, group: 2, desc: "Browse and buy catalog items" },
  { id: "news", label: "News", icon: Newspaper, group: 2, desc: "Roblox announcements and game updates" },
  { id: "performance", label: "Performance", icon: Gauge, group: 3, desc: "Boost mode, ping, CPU and RAM per session" },
  { id: "hud", label: "HUD", icon: LayoutDashboard, group: 3, desc: "The overlay you see on top of Roblox" },
  { id: "tweaks", label: "Tweaks", icon: Wand2, group: 3, desc: "Mods and engine settings (FFlags)" },
  { id: "versions", label: "Versions", icon: Layers, group: 3, desc: "Pick or download a Roblox version" },
  { id: "wrapped", label: "Wrapped", icon: Sparkles, group: 3, desc: "Your Roblox month and year, as a card to share" },
  { id: "accounts", label: "Accounts", icon: UsersRound, group: 4, desc: "Sign in and switch accounts" },
  { id: "settings", label: "Settings", icon: Settings, group: 4, desc: "Theme, launching, notifications, Discord" },
];
export const NAV_GROUPS = ["Play", "Together", "Roblox", "Tools"];

export function Tour() {
  const { settings, updateSettings, setPage } = useApp();
  if (settings.tourDone) return null;
  const done = (to) => { updateSettings({ tourDone: true }); if (to) setPage(to); };
  return (
    <div className="tour-root" onMouseDown={(e) => e.target === e.currentTarget && done()}>
      <div className="tour">
        <h2><Logo size={26} variant={themeById(settings.theme).logo} /> Welcome to Moony</h2>
        <p>Here's what each tab in the sidebar does. Hover any icon later to see its name.</p>
        <div className="tour-grid">
          {NAV.map((n) => (
            <button key={n.id} className="tour-item" onClick={() => done(n.id)}>
              <span className="tour-ic"><n.icon size={17} /></span>
              <span><b>{n.label}</b><small>{n.desc}</small></span>
            </button>
          ))}
        </div>
        <div className="tour-actions"><button className="btn primary" onClick={() => done()}>Got it</button></div>
      </div>
    </div>
  );
}

export function useMaximized() {
  const [max, setMax] = useState(false);
  useEffect(() => {
    if (!win) return;
    win.isMaximized().then(setMax);
    return win.onMaximized(setMax);
  }, []);
  return max;
}

export function TitleBar({ onSearch }) {
  const { settings, updateSettings, setPage, back, canGoBack, robux, toast, page } = useApp();
  const max = useMaximized();
  const here = NAV.find((n) => n.id === page);
  const crumb = here ? here.label : page === "game" ? "Game" : page === "profile" ? "Profile" : "";
  return (
    <header className="titlebar" data-tauri-drag-region onDoubleClick={(e) => e.target === e.currentTarget && win?.toggleMaximize()}>
      <div className="tb-left" data-tauri-drag-region>
        <button className="tb-icon" onClick={back} disabled={!canGoBack} aria-label="Back" title="Back (Alt+Left)"><ArrowLeft size={16} /></button>
        <span className="tb-crumb" data-tauri-drag-region>{crumb}</span>
      </div>
      <button className="tb-search" onClick={onSearch}>
        <Search size={14} /><span>Search Roblox games</span><kbd>Ctrl K</kbd>
      </button>
      <div className="tb-right">
        {robux != null && <button className="robux-pill" title="Your Robux" onClick={() => setPage("market")}><Robux size={13} /> {robux.toLocaleString()}</button>}
        <button className="tb-icon" title="Send feedback" aria-label="Send feedback" onClick={() => window.dispatchEvent(new Event("moony:feedback"))}><MessageSquareHeart size={16} /></button>
        {DISCORD_URL ? <a className="tb-icon discord" href={DISCORD_URL} target="_blank" rel="noreferrer" title="Join the Moony Discord" aria-label="Moony Discord"><DiscordIcon size={16} /></a>
          : <button className="tb-icon discord" title="Moony Discord: coming soon" aria-label="Moony Discord" onClick={() => toast("The Moony Discord server is coming soon")}><DiscordIcon size={16} /></button>}
        <button className={"tb-icon" + (settings.rightPanel ? " on" : "")} title="Side panel (Ctrl+B)" aria-label="Toggle side panel" onClick={() => updateSettings({ rightPanel: !settings.rightPanel })}>
          <PanelRight size={16} />
        </button>
        {win && (
          <div className="winctl">
            <button onClick={() => win.minimize()} aria-label="Minimize"><Minus size={15} /></button>
            <button onClick={() => win.toggleMaximize()} aria-label={max ? "Restore" : "Maximize"}>{max ? <Copy size={12} style={{ transform: "scaleX(-1)" }} /> : <Square size={12} />}</button>
            <button className="close" onClick={() => win.close()} aria-label="Close"><X size={16} /></button>
          </div>
        )}
      </div>
    </header>
  );
}

function AccountMenu({ collapsed }) {
  const { activeAccount, accounts, setActiveId, setPage, openProfile, isSignedIn } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close); window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const go = (fn) => { fn(); setOpen(false); };
  return (
    <div className="side-acct" ref={ref}>
      <button className={"side-acct-btn" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title={collapsed ? (activeAccount ? activeAccount.displayName : "Add account") : undefined}>
        {activeAccount ? <Avatar src={activeAccount.avatar} size={30} alt={activeAccount.name} /> : <span className="side-acct-empty"><UserPlus size={15} /></span>}
        <span className="side-acct-txt">
          <b>{activeAccount ? activeAccount.label || activeAccount.displayName : "Add an account"}</b>
          <small>{activeAccount ? (isSignedIn(activeAccount.id) ? "@" + activeAccount.name : "Profile only") : "Sign in to Roblox"}</small>
        </span>
        <ChevronDown size={14} className="side-acct-chev" />
      </button>
      <div className={"popover side-pop" + (open ? " open" : "")} role="menu">
        <div className="popover-label">Switch account</div>
        {accounts.filter((a) => !a.hidden).map((a) => (
          <button key={a.id} className="popover-item" role="menuitem" onClick={() => go(() => setActiveId(a.id))}>
            <Avatar src={a.avatar} size={26} alt={a.name} />
            <span className="grow"><b>{a.label || a.displayName}</b><small>@{a.name}</small></span>
            {activeAccount?.id === a.id && <CheckCircle2 size={15} className="accent" />}
          </button>
        ))}
        {accounts.length === 0 && <p className="popover-empty">No accounts linked yet.</p>}
        {activeAccount && <button className="popover-item muted" role="menuitem" onClick={() => go(() => openProfile(activeAccount))}><UsersRound size={15} /> View my profile</button>}
        <button className="popover-item muted" role="menuitem" onClick={() => go(() => setPage("accounts"))}><UserPlus size={15} /> Manage accounts</button>
      </div>
    </div>
  );
}

function SideNowPlaying() {
  const { nowPlaying, openGame } = useApp();
  const [, tick] = useState(0);
  useEffect(() => { if (!nowPlaying) return; const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, [nowPlaying]);
  if (!nowPlaying) return null;
  const secs = Math.max(0, Math.floor((Date.now() - nowPlaying.startedAt) / 1000));
  const clock = `${Math.floor(secs / 3600) ? Math.floor(secs / 3600) + ":" : ""}${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <button className="side-now" onClick={() => nowPlaying.universeId && openGame({ universeId: nowPlaying.universeId, placeId: nowPlaying.placeId, name: nowPlaying.name || "Roblox", icon: nowPlaying.icon })} title="Now playing">
      <Img src={nowPlaying.icon} className="side-now-art" />
      <span className="side-now-txt"><small><i className="live-dot" /> Playing</small><b>{nowPlaying.name ? cleanName(nowPlaying.name) : "Joining…"}</b></span>
      <span className="side-now-clock">{clock}</span>
    </button>
  );
}

function useNewsDot(page) {
  const { settings, updateSettings } = useApp();
  const [newest, setNewest] = useState(0);
  useEffect(() => {
    let alive = true;
    const check = () => api("news").then((list) => { if (!alive || !Array.isArray(list)) return; setNewest(Math.max(0, ...list.map((n) => Date.parse(n.date) || 0))); }).catch(() => {});
    check();
    const t = setInterval(check, 15 * 60e3);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const seen = settings.newsSeenAt;
  useEffect(() => {
    if (!newest) return;
    if (seen == null || page === "news") { if (seen !== newest) updateSettings({ newsSeenAt: newest }); }
  }, [newest, page, seen, updateSettings]);
  return newest > 0 && seen != null && newest > seen && page !== "news";
}

export function Sidebar() {
  const { page, setPage, settings, updateSettings } = useApp();
  const newsDot = useNewsDot(page);
  const collapsed = !!settings.navCollapsed;
  const listRef = useRef(null);
  const [mark, setMark] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = listRef.current?.querySelector(`[data-page="${page}"]`);
      setMark(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [page, collapsed]);
  const navBtn = (n) => (
    <button key={n.id} data-page={n.id} className={"nav-btn" + (page === n.id ? " on" : "")} onClick={() => setPage(n.id)} aria-label={n.label} aria-current={page === n.id ? "page" : undefined}>
      <n.icon size={17} strokeWidth={page === n.id ? 2.1 : 1.75} />
      <span className="nav-label">{n.label}</span>
      {n.id === "news" && newsDot && <span className="nav-dot" aria-label="New posts" />}
      {collapsed && <span className="tip">{n.label}</span>}
    </button>
  );
  return (
    <nav className={"sidebar" + (collapsed ? " collapsed" : "")} aria-label="Main">
      <div className="side-brand" data-tauri-drag-region>
        <Logo size={24} variant={themeById(settings.theme).logo} />
        <span className="side-word" data-tauri-drag-region>Moony</span>
        <button className="side-collapse" onClick={() => updateSettings({ navCollapsed: !collapsed })} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}><PanelLeft size={15} /></button>
      </div>
      <div className="nav-scroll" ref={listRef}>
        {mark && <span className="nav-mark" style={{ transform: `translateY(${mark.y}px)`, height: mark.h }} aria-hidden />}
        {NAV_GROUPS.map((label, grp) => (
          <div key={grp} className="nav-group">
            <span className="nav-h">{label}</span>
            {NAV.filter((n) => n.group === grp).map(navBtn)}
          </div>
        ))}
      </div>
      <SideNowPlaying />
      <div className="side-foot">
        <AccountMenu collapsed={collapsed} />
        <button data-page="settings" className={"nav-btn side-settings" + (page === "settings" ? " on" : "")} onClick={() => setPage("settings")} aria-label="Settings" title="Settings (Ctrl+,)"><Settings size={17} /></button>
      </div>
    </nav>
  );
}

export function RightPanel() {
  const { accounts, activeAccount, setActiveId, recent, play, openGame, tracked, setPage, launchAs, friends, joinFriend, isSignedIn, openProfile } = useApp();
  const source = launchAs ? friends.data : tracked;
  const online = source.filter((t) => t.presence && t.presence.type > 0).sort((a, b) => (a.displayName || a.name || "").localeCompare(b.displayName || b.name || "", undefined, { sensitivity: "base" }) || a.id - b.id);
  return (
    <aside className="rpanel">
      <NowPlaying compact />
      <section className="rp-section">
        <div className="rp-head"><h3>Accounts</h3><button className="link" onClick={() => setPage("accounts")}>Manage</button></div>
        {accounts.length === 0 ? (
          <button className="rp-empty-btn" onClick={() => setPage("accounts")}><UserPlus size={15} /> Link a Roblox account</button>
        ) : (
          <div className="rp-accounts">
            {accounts.filter((a) => !a.hidden).slice(0, 4).map((a) => (
              <button key={a.id} className={"rp-acct" + (activeAccount?.id === a.id ? " on" : "")} onClick={() => setActiveId(a.id)} title={`Switch to ${a.displayName}`}>
                <Avatar src={a.avatar} size={30} alt={a.name} />
                <span className="grow"><b>{a.label || a.displayName}</b><small className={isSignedIn(a.id) ? "signed" : ""}>{isSignedIn(a.id) ? "Signed in" : "Profile only"}</small></span>
                {activeAccount?.id === a.id && <span className="active-dot" />}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rp-section">
        <div className="rp-head"><h3>{launchAs ? "Friends online" : "Players online"} <span className="count">{online.length}</span></h3><button className="link" onClick={() => setPage("friends")}>View all</button></div>
        {launchAs && friends.status === "loading" ? (
          <p className="rp-note">Loading friends…</p>
        ) : source.length === 0 ? (
          <p className="rp-note">{launchAs ? "Your friends show up here when they're online." : "Sign in, or follow players on the Friends page, to see who's online."}</p>
        ) : online.length === 0 ? (
          <p className="rp-note">{launchAs ? "None of your friends are online right now." : tracked.length === 1 ? "The player you follow isn't online." : `None of the ${tracked.length} players you follow are online.`}</p>
        ) : online.slice(0, 6).map((t) => (
          <div className="rp-person clickable" key={t.id} onClick={() => openProfile(t)}>
            <Avatar src={t.avatar} size={30} alt={t.name} status={t.presence.type} />
            <span className="grow"><b>{t.displayName}</b><small className={"st" + t.presence.type}>{t.presence.type === 2 && t.presence.lastLocation ? t.presence.lastLocation : t.presence.label}</small></span>
            {launchAs && t.presence.type === 2 && <button className="rp-play show" aria-label={`Join ${t.displayName}`} title="Join" onClick={(e) => { e.stopPropagation(); joinFriend(t); }}><Play size={12} fill="currentColor" /></button>}
          </div>
        ))}
      </section>

      <section className="rp-section">
        <div className="rp-head"><h3>Recent servers</h3><button className="link" onClick={() => setPage("servers")}>View all</button></div>
        <RecentServers limit={2} compact />
      </section>

      <section className="rp-section">
        <div className="rp-head"><h3>Recently played</h3></div>
        {recent.length === 0 ? <p className="rp-note">Games you launch from Moony show up here.</p> : recent.slice(0, 5).map((g) => (
          <div className="rp-game" key={g.universeId} onClick={() => openGame(g)}>
            <Img src={g.icon} className="rp-game-art" />
            <span className="grow"><b title={g.name}>{cleanName(g.name)}</b><small>{g.creator || g.genre || "Roblox"}</small></span>
            <button className="rp-play" aria-label={`Play ${g.name}`} onClick={(e) => { e.stopPropagation(); play(g); }}><Play size={12} fill="currentColor" /></button>
          </div>
        ))}
      </section>
      <PromoFrame />
    </aside>
  );
}

const EDGES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
export function ResizeHandles() {
  const max = useMaximized();
  if (!win || max) return null;
  const start = (edge) => (e) => {
    e.preventDefault();
    win.resizeStart(edge);
    const move = () => win.resizeMove();
    const up = () => { win.resizeEnd(); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return EDGES.map((e) => <div key={e} className={"rz rz-" + e} onPointerDown={start(e)} />);
}

export function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={"toast " + t.kind}>
          {t.kind === "error" ? <AlertCircle size={16} /> : t.kind === "success" ? <CheckCircle2 size={16} /> : <Info size={16} />}
          <span>{t.text}</span>
          {t.action && <button className="toast-action" onClick={t.action.run}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

const PROMO_FEED = "https://moonylauncher.xyz/promos.json";
function PromoFrame() {
  const [items, setItems] = useState([]);
  const [i, setI] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(PROMO_FEED + "?t=" + Math.floor(Date.now() / 6e5), { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!alive) return; const now = Date.now(); setItems((j.items || []).filter((x) => /^https:\/\//.test(x.video || "") && (!x.until || Date.parse(x.until) > now))); })
      .catch(() => {});
    load();
    const t = setInterval(load, 30 * 60e3);
    return () => { alive = false; clearInterval(t); };
  }, []);
  useEffect(() => {
    if (items.length < 2) return;
    const it = items[i % items.length];
    const t = setTimeout(() => setI((n) => (n + 1) % items.length), (it.seconds || 12) * 1000);
    return () => clearTimeout(t);
  }, [i, items]);
  if (!items.length) return null;
  const it = items[i % items.length];
  const open = () => { if (/^https:\/\//.test(it.link || "")) window.open(it.link, "_blank"); };
  return (
    <section className="rp-section rp-promo-wrap">
      {it.label && <div className="rp-head"><h3>{it.label}</h3></div>}
      <button className={"rp-promo" + (it.link ? " link" : "")} onClick={open} title={it.title || ""} style={{ aspectRatio: it.ratio || "1 / 1" }}>
        <video key={it.video} src={it.video} poster={it.poster} autoPlay loop muted playsInline />
      </button>
      {items.length > 1 && <div className="rp-promo-dots">{items.map((_, k) => <i key={k} className={k === i % items.length ? "on" : ""} onClick={() => setI(k)} />)}</div>}
    </section>
  );
}
