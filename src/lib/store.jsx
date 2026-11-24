import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { themeById } from "./themes";
import { api, auth, discordApi, launchGame, notifyApi, playtimeApi, win } from "./bridge";

const read = (key, fallback) => {
  try { const v = JSON.parse(localStorage.getItem("orbit:" + key)); return v ?? fallback; } catch { return fallback; }
};
const write = (key, v) => { try { localStorage.setItem("orbit:" + key, JSON.stringify(v)); } catch { /* storage unavailable */ } };

function usePersisted(key, fallback) {
  const [v, setV] = useState(() => read(key, fallback));
  useEffect(() => write(key, v), [key, v]);
  return [v, setV];
}

export const DEFAULT_SETTINGS = {
  startPage: "home",
  rightPanel: true,
  accent: "theme", // "theme" = use the theme's accent
  theme: "midnight",
  reduceMotion: false,
  ambience: true,
  scale: 100,
  afterLaunch: "nothing", // nothing | minimize | close
  keepHistory: true,
  fpsCap: 0,
  defaultAccount: null,
  confirmLaunch: false,
  autoCloseRoblox: true,
  // In-game overlay: each widget has on/off and a position (percent of the Roblox window).
  hud: {
    enabled: true, opacity: 0.92, scale: 1,
    widgets: {
      game: { on: true, x: 3, y: 4 },
      session: { on: true, x: 3, y: 11 },
      clock: { on: true, x: 94, y: 4 },
      region: { on: false, x: 3, y: 18 },
      friends: { on: false, x: 94, y: 11 },
      system: { on: false, x: 94, y: 18 },
      visualizer: { on: true, x: 50, y: 93 },
      watermark: { on: true, x: 93, y: 96 },
      date: { on: false, x: 94, y: 25 },
      ping: { on: false, x: 3, y: 25 },
      battery: { on: false, x: 94, y: 32 },
      breaks: { on: false, x: 50, y: 6 },
      crosshair: { on: false, x: 50, y: 50 },
      text: { on: false, x: 50, y: 97, label: "" },
    },
  },
  christmas: true,
  snow: true,
  discordEnabled: false,
  discordClientId: "1133419230113566730",
  discordShowGame: true,
  alertsOnline: true,
  alertsInGame: true,
  alertsUpdates: true,
};

export const ACCENTS = {
  holly: ["#f0475a", "#c8243a"],
  pine: ["#34c77b", "#1f9d55"],
  iris: ["#8b7dff", "#6d5ef5"],
  ocean: ["#4f9dff", "#2f7ff0"],
  mint: ["#3ddc97", "#22b87a"],
  amber: ["#ffb547", "#f09a1a"],
  rose: ["#ff6b8b", "#ef4a6e"],
};

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [settings, setSettings] = usePersisted("settings", DEFAULT_SETTINGS);
  const [accounts, setAccounts] = usePersisted("accounts", []);
  const [activeId, setActiveId] = usePersisted("activeAccount", null);
  const [favorites, setFavorites] = usePersisted("favorites", []);
  const [recent, setRecent] = usePersisted("recent", []);
  const [tracked, setTracked] = usePersisted("tracked", []);
  // Navigation: a small history stack so game and profile pages can go Back.
  const [nav, setNav] = useState(() => ({ stack: [{ page: read("settings", DEFAULT_SETTINGS).startPage || "home", param: null }] }));
  const route = nav.stack[nav.stack.length - 1];
  const page = route.page;
  const go = useCallback((pageId, param = null) => setNav((n) => {
    const top = n.stack[n.stack.length - 1];
    if (top.page === pageId && JSON.stringify(top.param) === JSON.stringify(param)) return n;
    return { stack: [...n.stack.slice(-30), { page: pageId, param }] };
  }), []);
  const setPage = useCallback((pageId) => go(pageId), [go]);
  const back = useCallback(() => setNav((n) => (n.stack.length > 1 ? { stack: n.stack.slice(0, -1) } : n)), []);
  const canGoBack = nav.stack.length > 1;
  const openGame = useCallback((g) => g?.universeId && go("game", { universeId: g.universeId, placeId: g.placeId, name: g.name, icon: g.icon, banner: g.banner, tab: g.tab || "overview" }), [go]);
  const openProfile = useCallback((u) => u?.id && go("profile", { id: u.id, name: u.name, displayName: u.displayName, avatar: u.avatar }), [go]);
  const gameOpen = null;
  const [toasts, setToasts] = useState([]);
  const [sorts, setSorts] = useState({ status: "loading", data: [], error: null });
  const toastId = useRef(0);

  const s = useMemo(() => ({ ...DEFAULT_SETTINGS, ...settings }), [settings]);
  // One-time switch to the festive red accent when the Christmas theme arrives.
  useEffect(() => { if (!settings.festiveV1) setSettings((p) => ({ ...p, festiveV1: true, christmas: true })); }, [settings.festiveV1, setSettings]);
  // Themes replaced the Christmas switch: carry it over once.
  useEffect(() => { if (!settings.theme) setSettings((p) => ({ ...p, theme: p.christmas === false ? "midnight" : "christmas", accent: "theme" })); }, [settings.theme, setSettings]);
  // One-time: use the Moony Discord app and turn the status on.
  useEffect(() => { if (!settings.discordV1) setSettings((p) => ({ ...p, discordV1: true, discordEnabled: true, discordClientId: "1133419230113566730" })); }, [settings.discordV1, setSettings]);
  const updateSettings = useCallback((patch) => setSettings((p) => ({ ...p, ...patch })), [setSettings]);

  const toast = useCallback((text, kind = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const loadSorts = useCallback(() => {
    setSorts((p) => ({ ...p, status: "loading", error: null }));
    api("sorts")
      .then((data) => setSorts(Array.isArray(data) ? { status: "ready", data, error: null } : { status: "error", data: [], error: "Roblox returned no games. Try again" }))
      .catch((e) => setSorts({ status: "error", data: [], error: e.message }));
  }, []);
  useEffect(loadSorts, [loadSorts]);

  const isFavorite = useCallback((id) => favorites.some((g) => g.universeId === id), [favorites]);
  const toggleFavorite = useCallback((game) => {
    const has = favorites.some((g) => g.universeId === game.universeId);
    setFavorites((list) => (has ? list.filter((g) => g.universeId !== game.universeId) : [slim(game), ...list]));
    toast(has ? `Removed ${game.name} from favorites` : `Added ${game.name} to favorites`);
  }, [favorites, setFavorites, toast]);

  const activeAccount = accounts.find((a) => a.id === activeId) || accounts[0] || null;

  // Which linked accounts have a saved, signed-in session (desktop only).
  const [sessions, setSessions] = useState([]);
  const refreshSessions = useCallback(() => { auth?.sessions().then(setSessions).catch(() => {}); }, []);
  useEffect(refreshSessions, [refreshSessions]);
  // Roblox ended a saved session: update the UI and say so.
  useEffect(() => auth?.onExpired?.(() => { refreshSessions(); toast("Roblox signed this account out. Sign in again on the Accounts page.", "error"); }), [refreshSessions]); // eslint-disable-line react-hooks/exhaustive-deps

  // On startup, bring back every account that still has a saved sign-in
  // (refreshing its name and avatar), and make one active if none is.
  useEffect(() => {
    if (!auth?.restore) return;
    auth.restore().then((users) => {
      if (!users.length) return;
      setAccounts((list) => {
        const next = list.map((a) => { const u = users.find((x) => x.id === a.id); return u ? { ...a, ...u } : a; });
        for (const u of users) if (!next.some((a) => a.id === u.id)) next.push(u);
        return next;
      });
      setActiveId((cur) => cur ?? users[0].id);
      refreshSessions();
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isSignedIn = useCallback((id) => sessions.includes(Number(id)), [sessions]);

  // Playtime totals and the game being played right now (desktop only; the
  // main process reads them from Roblox's own logs).
  const [playtime, setPlaytime] = useState({ games: {}, days: {} });
  const [nowPlaying, setNowPlaying] = useState(null);
  useEffect(() => {
    if (!playtimeApi) return;
    playtimeApi.get().then((p) => { setPlaytime({ games: p.games, days: p.days, history: p.history || [], sessions: p.sessions || [] }); setNowPlaying(p.now ?? null); }).catch(() => {});
    const off1 = playtimeApi.onUpdate((p) => setPlaytime({ games: p.games, days: p.days, history: p.history || [], sessions: p.sessions || [] }));
    const off2 = playtimeApi.onNow(setNowPlaying);
    return () => { off1(); off2(); };
  }, []);

  // Discord status follows the settings.
  const [discordState, setDiscordState] = useState("off");
  useEffect(() => {
    if (!discordApi) return;
    discordApi.configure({ enabled: s.discordEnabled, clientId: s.discordClientId, showGame: s.discordShowGame })
      .then(setDiscordState).catch(() => setDiscordState("unavailable"));
  }, [s.discordEnabled, s.discordClientId, s.discordShowGame]);
  useEffect(() => {
    if (!discordApi || !s.discordEnabled) return;
    const t = setInterval(() => discordApi.status().then(setDiscordState).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [s.discordEnabled]);

  const signIn = useCallback(async () => {
    if (!auth) return toast("Sign-in works in the desktop app", "error");
    const r = await auth.login();
    refreshSessions();
    if (r.cancelled) return null;
    if (!r.ok) { toast(r.error || "Sign-in failed", "error"); return null; }
    const u = r.user;
    setAccounts((list) => list.some((a) => a.id === u.id) ? list.map((a) => (a.id === u.id ? { ...a, ...u } : a)) : [...list, u]);
    setActiveId(u.id);
    toast(`Signed in as ${u.displayName}`, "success");
    return u;
  }, [refreshSessions, setAccounts, setActiveId, toast]);

  const signOut = useCallback(async (id) => {
    await auth?.logout(id);
    refreshSessions();
  }, [refreshSessions]);

  const afterLaunch = useCallback(() => {
    if (win && s.afterLaunch === "minimize") setTimeout(() => win.minimize(), 600);
    if (win && s.afterLaunch === "close") setTimeout(() => win.close(), 900);
  }, [s.afterLaunch]);

  const launchAs = activeAccount && isSignedIn(activeAccount.id) ? activeAccount : null;
  const handleLaunchError = useCallback((r) => {
    if (r?.expired) { refreshSessions(); toast("Your Roblox session expired. Sign in again on the Accounts page.", "error"); }
    else toast(r?.error || "Couldn't launch Roblox", "error");
  }, [refreshSessions, toast]);

  // Real friends list for the signed-in active account, refreshed every minute.
  const [friends, setFriends] = useState({ status: "idle", data: [], error: null });
  const launchAsId = launchAs?.id ?? null;
  const loadFriends = useCallback(async () => {
    if (!launchAsId) return setFriends({ status: "idle", data: [], error: null });
    setFriends((f) => ({ ...f, status: f.data.length ? "refreshing" : "loading" }));
    try { setFriends({ status: "ready", data: await auth.friends(launchAsId), error: null }); }
    catch (e) {
      setFriends((f) => ({ ...f, status: "error", error: e.message }));
      if (/expired/i.test(e.message)) refreshSessions();
    }
  }, [launchAsId, refreshSessions]);
  useEffect(() => {
    setFriends({ status: "idle", data: [], error: null });
    loadFriends();
    const t = setInterval(() => { if (!document.hidden) loadFriends(); }, 60000); // skip while minimized
    return () => clearInterval(t);
  }, [loadFriends]);

  const play = useCallback(async (game, opts = {}) => {
    if (!game?.placeId) return;
    if (s.confirmLaunch && !window.confirm(`Launch ${game.name}${launchAs ? ` as ${launchAs.displayName}` : ""}?`)) return;
    const r = await launchGame(game.placeId, { accountId: launchAs?.id, jobId: opts.jobId, linkCode: opts.linkCode, name: game.name, icon: game.icon });
    if (!r?.ok) return handleLaunchError(r);
    const where = opts.linkCode ? " (private server)" : opts.jobId ? " (chosen server)" : "";
    // The desktop app shows its own bootstrapper window, so no in-app pop-up.
    if (!window.orbit) toast(r.as ? `Opening ${game.name}${where} as ${launchAs.displayName}…` : `Opening ${game.name}${where} in Roblox…`, "success");
    if (s.keepHistory) setRecent((list) => [{ ...slim(game), playedAt: Date.now() }, ...list.filter((g) => g.universeId !== game.universeId)].slice(0, 20));
    afterLaunch();
  }, [s.confirmLaunch, s.keepHistory, launchAs, handleLaunchError, afterLaunch, setRecent, toast]);

  const joinFriend = useCallback(async (friend) => {
    if (!launchAs) return toast("Sign in to join friends", "error");
    const r = await launchGame(null, { accountId: launchAs.id, followUserId: friend.id, name: friend.displayName, icon: friend.avatar });
    if (!r?.ok) return handleLaunchError(r);
    if (!window.orbit) toast(`Joining ${friend.displayName}…`, "success");
    afterLaunch();
  }, [launchAs, handleLaunchError, afterLaunch, toast]);

  // Friend alerts: compare each friends refresh with the previous one and
  // show a Windows notification when someone comes online or joins a game.
  const lastPresence = useRef(null);
  useEffect(() => {
    if (friends.status !== "ready") return;
    const now = new Map(friends.data.map((f) => [f.id, f]));
    const prev = lastPresence.current;
    lastPresence.current = new Map([...now].map(([id, f]) => [id, f.presence?.type ?? 0]));
    if (!prev || !notifyApi) return; // first load: nothing to compare with
    for (const [id, f] of now) {
      const before = prev.get(id) ?? 0, after = f.presence?.type ?? 0;
      if (s.alertsInGame && after === 2 && before !== 2) {
        notifyApi.friend({ title: `${f.displayName} is playing`, body: `${f.presence.lastLocation || "a game"} · click to join`, icon: f.avatar, userId: id, canJoin: true });
      } else if (s.alertsOnline && after === 1 && before === 0) {
        notifyApi.friend({ title: `${f.displayName} is online`, body: "Click to see your friends in Moony", icon: f.avatar, userId: id, canJoin: false });
      }
    }
  }, [friends, s.alertsInGame, s.alertsOnline]);
  // Reset the comparison when the signed-in account changes.
  useEffect(() => { lastPresence.current = null; }, [launchAs?.id]);

  // Clicking an alert: join that friend, or open the Friends page.
  useEffect(() => {
    if (!notifyApi) return;
    return notifyApi.onClick(({ userId, canJoin }) => {
      const f = friends.data.find((x) => x.id === userId);
      if (canJoin && f) joinFriend(f);
      else setPage("friends");
    });
  }, [friends.data, joinFriend]);

  // Robux for the signed-in active account.
  const [robux, setRobux] = useState(null);
  const refreshRobux = useCallback(() => {
    if (!launchAs || !auth?.robux) return setRobux(null);
    auth.robux(launchAs.id).then(setRobux).catch(() => setRobux(null));
  }, [launchAs]);
  useEffect(() => { refreshRobux(); const t = setInterval(() => { if (!document.hidden) refreshRobux(); }, 120000); return () => clearInterval(t); }, [refreshRobux]);

  // Saved private (VIP) server links.
  const [privateServers, setPrivateServers] = usePersisted("privateServers", []);

  // Installer "Link Roblox account": open Roblox sign-in right away.
  useEffect(() => {
    const l = window.orbit?.linkAccount;
    if (!l) return;
    const go = () => l.take().then((v) => { if (v) signIn(); });
    go();
    return l.onRequest(go);
  }, [signIn]);

  // Disconnected from a game: offer to rejoin the same server.
  const [rejoinOffer, setRejoinOffer] = useState(null);
  useEffect(() => {
    const g = window.orbit?.game;
    if (!g) return;
    const offs = [
      g.onDisconnected((info) => setRejoinOffer(info)),
      g.onRejoin((info) => { setRejoinOffer(null); play({ placeId: info.placeId, universeId: info.universeId, name: info.name, icon: info.icon }, { jobId: info.jobId }); }),
      g.onOpen((game) => openGame(game)),
    ];
    return () => offs.forEach((off) => off());
  }, [play, openGame]);

  // Settings the main process uses (auto-close Roblox, the in-game HUD).
  const friendsOnline = friends.data.filter((f) => f.presence?.type > 0).length;
  useEffect(() => {
    const accent = s.accent === "theme" || !ACCENTS[s.accent] ? themeById(s.theme).accent[0] : ACCENTS[s.accent][0];
    window.orbit?.setPrefs?.({ autoCloseRoblox: s.autoCloseRoblox, hud: { ...s.hud, friendsOnline, theme: s.theme, accent }, activeAccountId: launchAs?.id ?? null, accent });
  }, [s.autoCloseRoblox, s.hud, friendsOnline, launchAs?.id, s.accent, s.theme]);

  // Game update alerts follow the favorites list.
  useEffect(() => {
    window.orbit?.game?.watchUpdates(favorites.map((f) => f.universeId), s.alertsUpdates);
  }, [favorites, s.alertsUpdates]);

  const value = useMemo(() => ({
    rejoinOffer, setRejoinOffer,
    settings: s, updateSettings, page, setPage, route, back, canGoBack, gameOpen, openGame, openProfile, closeGame: () => {},
    robux, refreshRobux, privateServers, setPrivateServers,
    accounts, setAccounts, activeAccount, setActiveId,
    favorites, setFavorites, isFavorite, toggleFavorite,
    recent, setRecent, tracked, setTracked,
    sorts, loadSorts, play, joinFriend, toast, toasts,
    isSignedIn, signIn, signOut, launchAs, friends, loadFriends, playtime, nowPlaying, discordState,
  }), [rejoinOffer, route, back, canGoBack, openGame, openProfile, robux, refreshRobux, privateServers, setPrivateServers, playtime, nowPlaying, discordState, friends, loadFriends, s, updateSettings, page, gameOpen, accounts, setAccounts, activeAccount, setActiveId, favorites, setFavorites, isFavorite, toggleFavorite, recent, setRecent, tracked, setTracked, sorts, loadSorts, play, joinFriend, toast, toasts, isSignedIn, signIn, signOut, launchAs]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const slim = (g) => ({
  universeId: g.universeId, placeId: g.placeId, name: g.name, icon: g.icon, banner: g.banner,
  playing: g.playing, rating: g.rating, genre: g.genre, creator: typeof g.creator === "string" ? g.creator : g.creator?.name ?? "",
});

export function useAsync(fn, deps) {
  const [st, setSt] = useState({ status: "loading", data: null, error: null });
  useEffect(() => {
    let live = true;
    setSt((p) => ({ ...p, status: "loading", error: null }));
    Promise.resolve().then(fn)
      .then((data) => live && setSt({ status: "ready", data, error: null }))
      .catch((e) => live && setSt({ status: "error", data: null, error: e.message }));
    return () => { live = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
