import { lazy, Suspense, useEffect, useState } from "react";
import { RotateCcw, WifiOff, X } from "lucide-react";
import { AppProvider, ACCENTS, useApp } from "./lib/store";
import { isDesktop } from "./lib/bridge";
import { cleanName } from "./lib/format";
import { NAV, ResizeHandles, RightPanel, Sidebar, TitleBar, Toasts, Tour, useMaximized } from "./components/Shell";
import { Lights, Particles } from "./components/Festive";
import { themeById } from "./lib/themes";
import { FrameDeco, SceneArt } from "./components/ThemeArt";
import { loadBg, onBgChange } from "./lib/custombg";
import { Img, Skeleton } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { UpdateBanner } from "./components/UpdateBanner";
import { WhatsNew, FoundUs, FeedbackModal, FeedbackNudge, useLaunchCounter } from "./components/Engage";
import Home from "./pages/Home";

// Everything except Home loads on first visit, so startup doesn't pay for
// three.js (3D avatars) and the heavier tabs.
const Discover = lazy(() => import("./pages/Discover"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Charts = lazy(() => import("./pages/Charts"));
const Servers = lazy(() => import("./pages/Servers"));
const Friends = lazy(() => import("./pages/Friends"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Settings = lazy(() => import("./pages/Settings"));
const Game = lazy(() => import("./pages/Game"));
const Profile = lazy(() => import("./pages/Profile"));
const Library = lazy(() => import("./pages/Library"));
const Market = lazy(() => import("./pages/Market"));
const News = lazy(() => import("./pages/News"));
const AvatarPage = lazy(() => import("./pages/AvatarPage"));
const Tweaks = lazy(() => import("./pages/Tweaks"));
const Versions = lazy(() => import("./pages/Versions"));
const Chat = lazy(() => import("./pages/Chat"));
const Hud = lazy(() => import("./pages/Hud"));
const PageLoading = () => <div className="page"><Skeleton w={180} h={26} /><Skeleton w="45%" h={12} style={{ marginTop: 12 }} /></div>;

export default function App() {
  return <AppProvider><Frame /></AppProvider>;
}

function Frame() {
  const { page, route, setPage, back, settings, updateSettings, toast } = useApp();
  const max = useMaximized();
  const [searchKey, setSearchKey] = useState(0);
  const [fb, setFb] = useState(false);
  useLaunchCounter();
  useEffect(() => { const h = () => setFb(true); window.addEventListener("moony:feedback", h); return () => window.removeEventListener("moony:feedback", h); }, []);
  const openSearch = () => { setPage("discover"); setSearchKey((k) => k + 1); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); back(); return; }
      if (!e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && NAV[n - 1]) { e.preventDefault(); setPage(NAV[n - 1].id); }
      else if (e.key === ",") { e.preventDefault(); setPage("settings"); }
      else if (e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
      else if (e.key.toLowerCase() === "b") { e.preventDefault(); updateSettings({ rightPanel: !settings.rightPanel }); }
    };
    // Mouse "back" button
    const onMouse = (e) => { if (e.button === 3) { e.preventDefault(); back(); } };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouse);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mouseup", onMouse); };
  });

  // Theme: palette, background effect and decorations. Accent can follow the
  // theme (default) or be picked separately in Settings.
  const theme = themeById(settings.theme);
  const [a, b] = settings.accent === "theme" || !ACCENTS[settings.accent] ? theme.accent : ACCENTS[settings.accent];
  // Interface scale: CSS zoom on <body> (see pages6.css). The main process
  // resets page zoom to 100% and grows the window's minimum size to match.
  useEffect(() => {
    const z = Math.min(1.5, Math.max(0.75, (settings.scale || 100) / 100));
    document.documentElement.style.setProperty("--ui-scale", String(z));
    window.orbit?.setZoom?.(z);
  }, [settings.scale]);
  useEffect(() => { window.orbit?.setRadius?.(settings.winRadius ?? 16); }, [settings.winRadius]);
  // When Moony isn't the window you're using (e.g. you're in a game), freeze
  // every decorative animation so it stops using CPU/GPU in the background.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t;
    const off = () => { clearTimeout(t); t = setTimeout(() => setIdle(true), 3000); };
    const on = () => { clearTimeout(t); setIdle(false); };
    window.addEventListener("blur", off); window.addEventListener("focus", on);
    document.addEventListener("visibilitychange", () => (document.hidden ? setIdle(true) : on()));
    return () => { clearTimeout(t); window.removeEventListener("blur", off); window.removeEventListener("focus", on); };
  }, []);
  // At big scales or small windows there isn't room for the side panel; hide
  // it until there is (measured in scaled CSS pixels, not screen pixels).
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth / ((settings.scale || 100) / 100) < 1180);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [settings.scale]);
  const showPanel = settings.rightPanel && !narrow;
  // Your own background picture/GIF.
  const [bgUrl, setBgUrl] = useState(null);
  const [bgKind, setBgKind] = useState("image");
  useEffect(() => {
    let url = null, alive = true;
    const load = () => loadBg().then((blob) => {
      if (!alive) return;
      if (url) URL.revokeObjectURL(url);
      url = blob ? URL.createObjectURL(blob) : null;
      setBgUrl(url);
      setBgKind(blob?.type?.startsWith("video/") ? "video" : "image");
    });
    load();
    const off = onBgChange(load);
    return () => { alive = false; off(); if (url) URL.revokeObjectURL(url); };
  }, []);
  // Parallax: the scene leans away from the mouse.
  useEffect(() => {
    if (settings.reduceMotion) return;
    let raf = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = document.querySelector(".frame");
        if (!el) return;
        el.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        el.style.setProperty("--my", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, [settings.reduceMotion]);
  const style = { "--win-r": `${settings.winRadius ?? 16}px`, ...theme.vars, "--accent": a, "--accent-2": b, "--amb-1": theme.ambient[0], "--amb-2": theme.ambient[1], "--amb-3": theme.ambient[2], "--wm-1": theme.wordmark[0], "--wm-2": theme.wordmark[1], "--wm-3": theme.wordmark[2] };
  const festive = !!theme.festive;
  const cls = ["frame", isDesktop && "desktop", max && "maximized", settings.reduceMotion && "reduce-motion", settings.ambience && "ambience", showPanel && "with-panel", festive && "festive", (settings.themeArt !== false || bgUrl) && "has-art", settings.reduceMotion && "no-anim", idle && "idle", `theme-${theme.id}`].filter(Boolean).join(" ");
  const key = page + JSON.stringify(route.param?.id ?? route.param?.universeId ?? "");

  return (
    <div className={cls} style={style}>
      <div className="ambient" aria-hidden><span /><span /><span /></div>
      {bgUrl && <div className={"custom-bg fit-" + (settings.bgFit || "cover")} aria-hidden style={{ "--bg-dim": (settings.bgDim ?? 55) / 100, "--bg-blur": `${settings.bgBlur ?? 0}px` }}>{bgKind === "video" ? <video src={bgUrl} autoPlay loop muted playsInline /> : <img src={bgUrl} alt="" />}</div>}
      {settings.themeArt !== false && !bgUrl && <SceneArt id={theme.id} />}
      {settings.themeArt !== false && <FrameDeco id={theme.id} />}
      {festive && <Lights />}
      <TitleBar onSearch={openSearch} />
      <Sidebar />
      <main className={"content" + (page === "game" ? " flush" : "")} key={key}>
        <ErrorBoundary resetKey={key}>
        <Suspense fallback={<PageLoading />}>
        {page === "home" && <Home />}
        {page === "discover" && <Discover focusKey={searchKey} />}
        {page === "charts" && <Charts />}
        {page === "servers" && <Servers />}
        {page === "market" && <Market />}
        {page === "news" && <News />}
        {page === "avatar" && <AvatarPage />}
        {page === "tweaks" && <Tweaks />}
        {page === "versions" && <Versions />}
        {page === "chat" && <Chat />}
        {page === "hud" && <Hud />}
        {page === "library" && <Library />}
        {page === "favorites" && <Favorites />}
        {page === "friends" && <Friends />}
        {page === "accounts" && <Accounts />}
        {page === "settings" && <Settings />}
        {page === "game" && route.param && <Game seed={route.param} />}
        {page === "profile" && route.param && <Profile seed={route.param} />}
        </Suspense>
        </ErrorBoundary>
      </main>
      {showPanel && <RightPanel />}
      {theme.particles && !settings.reduceMotion && settings.snow && <Particles key={theme.particles} kind={theme.particles} density={theme.particles === "stars" ? 0.6 : 1} />}
      <RejoinPrompt />
      <Tour />
      <WhatsNew />
      <div className="eng-stack"><FoundUs /><FeedbackNudge onOpen={() => setFb(true)} /></div>
      {fb && <FeedbackModal onClose={() => setFb(false)} />}
      <UpdateBanner />
      <Toasts />
      <ResizeHandles />
    </div>
  );
}

// Shown after Roblox disconnects you, to put you back in the same server.
function RejoinPrompt() {
  const { rejoinOffer, setRejoinOffer, play } = useApp();
  if (!rejoinOffer) return null;
  const o = rejoinOffer;
  return (
    <div className="rejoin">
      <Img src={o.icon} className="rejoin-art" />
      <div className="grow">
        <b><WifiOff size={13} /> Disconnected</b>
        <small>You lost connection to {cleanName(o.name)}. Rejoin the same server?</small>
      </div>
      <button className="btn primary sm" onClick={() => { setRejoinOffer(null); play({ placeId: o.placeId, universeId: o.universeId, name: o.name, icon: o.icon }, { jobId: o.jobId }); }}><RotateCcw size={13} /> Rejoin</button>
      <button className="btn ghost sm icon-only" aria-label="Dismiss" onClick={() => setRejoinOffer(null)}><X size={14} /></button>
    </div>
  );
}
