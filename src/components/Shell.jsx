import { DiscordIcon } from "./DiscordIcon";
import { api } from "../lib/bridge";
import { DISCORD_URL } from "../lib/links";
import { useEffect, useRef, useState } from "react";
import { MessageSquareHeart, LayoutDashboard, MessageSquare, Newspaper, Shirt, Wand2, ArrowLeft, LibraryBig, ShoppingBag, ChartNoAxesColumn, Server, CheckCircle2, ChevronDown, Compass, Heart, Home, Info, Minus, PanelRight, Play, Search, Settings, Square, Copy, UserPlus, Users, UsersRound, X, AlertCircle , Layers} from "lucide-react";
import { useApp } from "../lib/store";
import { win } from "../lib/bridge";
import { cleanName } from "../lib/format";
import { Avatar, Img } from "./ui";
import { Logo } from "./Logo";
import { themeById } from "../lib/themes";
import { NowPlaying, RecentServers } from "./Playtime";
import { Robux } from "./RobuxIcon";

// Sidebar tabs, in groups separated by a divider. Settings sits at the bottom.
// `desc` is used by the first-run tour.
export const NAV = [
  { id: "home", label: "Home", icon: Home, group: 0, desc: "Featured games, your playtime and where you left off" },
  { id: "discover", label: "Discover", icon: Compass, group: 0, desc: "Search Roblox and browse by genre" },
  { id: "charts", label: "Charts", icon: ChartNoAxesColumn, group: 0, desc: "Live rankings: most played, trending, rising" },
  { id: "servers", label: "Servers", icon: Server, group: 0, desc: "Pick a server, rejoin old ones, private links" },
  { id: "market", label: "Marketplace", icon: ShoppingBag, group: 0, desc: "Browse and buy catalog items" },
  { id: "news", label: "News", icon: Newspaper, group: 0, desc: "Roblox announcements and game updates" },
  { id: "library", label: "Library", icon: LibraryBig, group: 1, desc: "Every game you've played, with hours" },
  { id: "favorites", label: "Favorites", icon: Heart, group: 1, desc: "Games you've saved" },
  { id: "friends", label: "Friends", icon: Users, group: 1, desc: "Who's online and what they're playing" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: 1, desc: "Message your Roblox friends" },
  { id: "avatar", label: "Avatar", icon: Shirt, group: 1, desc: "Change your avatar in 3D" },
  { id: "hud", label: "HUD", icon: LayoutDashboard, group: 2, desc: "The overlay you see on top of Roblox" },
  { id: "tweaks", label: "Tweaks", icon: Wand2, group: 2, desc: "Mods and engine settings (FFlags)" },
  { id: "versions", label: "Versions", icon: Layers, group: 2, desc: "Pick or download a Roblox version" },
  { id: "accounts", label: "Accounts", icon: UsersRound, group: 2, desc: "Sign in and switch accounts" },
  { id: "settings", label: "Settings", icon: Settings, group: 3, desc: "Theme, launching, notifications, Discord" },
];

// One-time "here's what each icon does" card on first launch.
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
  const { settings, updateSettings, activeAccount, accounts, setActiveId, setPage, back, canGoBack, robux, openProfile, toast } = useApp();
  const max = useMaximized();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [menu]);

  return (
    <header className="titlebar" data-tauri-drag-region onDoubleClick={(e) => e.target === e.currentTarget && win?.toggleMaximize()}>
      <div className="tb-brand"><Logo size={22} variant={themeById(settings.theme).logo} /><span>Moony</span></div>

      <button className="tb-search" onClick={onSearch}>
        <Search size={14} /><span>Search games</span>
      </button>

      <div className="tb-right">
        {robux != null && <button className="robux-pill" title="Your Robux" onClick={() => setPage("market")}><Robux size={13} /> {robux.toLocaleString()}</button>}
        <button className="tb-icon" title="Send feedback" onClick={() => window.dispatchEvent(new Event("moony:feedback"))}><MessageSquareHeart size={16} /></button>
        {DISCORD_URL ? <a className="tb-icon discord" href={DISCORD_URL} target="_blank" rel="noreferrer" title="Join the Moony Discord"><DiscordIcon size={16} /></a>
          : <button className="tb-icon discord" title="Moony Discord: coming soon" onClick={() => toast("The Moony Discord server is coming soon")}><DiscordIcon size={16} /></button>}
        <button className={"tb-icon" + (settings.rightPanel ? " on" : "")} title="Toggle side panel" onClick={() => updateSettings({ rightPanel: !settings.rightPanel })}>
          <PanelRight size={16} />
        </button>
        <div className="tb-account" ref={menuRef}>
          <button className={"tb-acct-btn" + (menu ? " open" : "")} onClick={() => setMenu((m) => !m)}>
            {activeAccount ? <><Avatar src={activeAccount.avatar} size={22} alt={activeAccount.name} /><span>{activeAccount.label || activeAccount.displayName}</span></> : <><UserPlus size={15} /><span>Add account</span></>}
            <ChevronDown size={14} />
          </button>
          <div className={"popover" + (menu ? " open" : "")}>
            <div className="popover-label">Switch account</div>
            {accounts.filter((a) => !a.hidden).map((a) => (
              <button key={a.id} className="popover-item" onClick={() => { setActiveId(a.id); setMenu(false); }}>
                <Avatar src={a.avatar} size={26} alt={a.name} />
                <span className="grow"><b>{a.label || a.displayName}</b><small>@{a.name}</small></span>
                {activeAccount?.id === a.id && <CheckCircle2 size={15} className="accent" />}
              </button>
            ))}
            {accounts.length === 0 && <p className="popover-empty">No accounts linked yet.</p>}
            {activeAccount && <button className="popover-item muted" onClick={() => { openProfile(activeAccount); setMenu(false); }}><UsersRound size={15} /> View my profile</button>}
            <button className="popover-item muted" onClick={() => { setPage("accounts"); setMenu(false); }}><UserPlus size={15} /> Manage accounts</button>
          </div>
        </div>
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

// Red dot on News when there's a post newer than the last time you looked.
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
  const { page, setPage, activeAccount, openProfile, route } = useApp();
  const newsDot = useNewsDot(page);
  const navBtn = (n) => (
    <button key={n.id} data-page={n.id} className={"nav-btn" + (page === n.id ? " on" : "")} onClick={() => setPage(n.id)} aria-label={n.label}>
      <n.icon size={19} strokeWidth={page === n.id ? 2.2 : 1.8} />
      <span className="nav-label">{n.label}</span>
      {n.id === "news" && newsDot && <span className="nav-dot" aria-label="New posts" />}
      <span className="tip">{n.label}</span>
    </button>
  );
  return (
    <nav className="sidebar">
      <div className="nav-scroll">
        {[0, 1, 2].map((grp) => (
          <div key={grp} className="nav-group">
            {grp > 0 && <span className="nav-sep" />}
            <div className="nav-list">{NAV.filter((n) => n.group === grp).map(navBtn)}</div>
          </div>
        ))}
      </div>
      {navBtn(NAV.find((n) => n.id === "settings"))}
      <button className={"nav-profile" + (page === "profile" && route.param?.id === activeAccount?.id ? " on" : "")} onClick={() => (activeAccount ? openProfile(activeAccount) : setPage("accounts"))} aria-label="My profile">
        <Avatar src={activeAccount?.avatar} size={34} alt={activeAccount?.name || "?"} />
        <span className="tip">{activeAccount ? "My profile" : "Add an account"}</span>
      </button>
    </nav>
  );
}

export function RightPanel() {
  const { accounts, activeAccount, setActiveId, recent, play, openGame, tracked, setPage, launchAs, friends, joinFriend, isSignedIn, openProfile } = useApp();
  const source = launchAs ? friends.data : tracked;
  // Stable order (by name) so presence changes don't reshuffle the list.
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
        </div>
      ))}
    </div>
  );
}

// A rotating, looping video card under "Recently played" (Discord invite,
// giveaways, "update coming"...). The list lives on moonylauncher.xyz/promos.json
// so it can change any time without an app update.
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
