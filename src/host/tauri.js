// window.orbit for the Rust (Tauri) build: the same API the Electron preload
// exposed, so the interface code is unchanged. Each call is either handled
// here (Roblox web API logic, which runs in the page) or sent to Rust.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { roblox } from "./roblox-web";
import { createTracker } from "./tracker";

const rust = (channel, ...args) => invoke("ipc", { channel, args });
const appWin = getCurrentWindow();

// Events: from Rust (Tauri events) and from this file (local).
const local = new Map();
const emit = (ch, data) => (local.get(ch) || []).forEach((fn) => fn(data));
const on = (ch) => (cb) => {
  const set = local.get(ch) || new Set();
  set.add(cb); local.set(ch, set);
  let un = null, gone = false;
  listen(ch, (e) => cb(e.payload)).then((u) => (gone ? u() : (un = u)));
  return () => { set.delete(cb); gone = true; un?.(); };
};
const off = () => () => {};
const unavailable = (what) => () => Promise.reject(new Error(`${what} is coming to the new Moony soon`));

// Signed-in calls: Rust swaps this placeholder for the account's cookie.
const token = (id) => `moony:acct:${Number(id)}`;
async function withSession(id, fn) {
  const accounts = await rust("vault:accounts");
  if (!accounts.some((a) => a.id === Number(id))) throw new Error("This account isn't signed in");
  try { return await fn(token(id)); }
  catch (err) {
    if (err?.code === "EXPIRED") { await rust("vault:remove", Number(id)); emit("auth:expired", Number(id)); }
    throw err;
  }
}

const PUBLIC = new Set(["sorts", "search", "gameDetails", "lookupUser", "searchUsers", "presence", "servers", "userProfile", "gameMedia", "badges", "catalog", "placeUniverse", "searchMany", "genreGames", "news", "avatarImage"]);

// Launch a game: make sure Roblox is installed (Rust downloads it with
// progress), get a one-time sign-in ticket, then Rust starts the player.
async function launch({ placeId, accountId, followUserId, jobId, linkCode }) {
  const isId = (v) => /^d+$/.test(String(v));
  if (placeId && !isId(placeId)) return { ok: false, error: "Invalid place" };
  if (followUserId && !isId(followUserId)) return { ok: false, error: "Invalid user" };
  if (jobId && !/^[0-9a-f-]{36}$/i.test(String(jobId))) return { ok: false, error: "Invalid server" };
  if (linkCode && !/^[A-Za-z0-9_-]{4,64}$/.test(String(linkCode))) return { ok: false, error: "Invalid private server link" };
  const signedIn = accountId && (await rust("vault:accounts")).some((a) => a.id === Number(accountId));
  if (!signedIn) {
    if (!placeId) return { ok: false, error: "Sign in to join friends" };
    await rust("open:url", `roblox://placeId=${placeId}${jobId ? `&gameInstanceId=${jobId}` : ""}${linkCode ? `&linkCode=${linkCode}` : ""}`);
    return { ok: true, as: null };
  }
  try {
    const [rbx, ticket] = await Promise.all([rust("roblox:ensure"), withSession(accountId, (c) => roblox.authTicket(c))]);
    const tracker = String(Date.now() * 1000 + Math.floor(Math.random() * 1000));
    const request = followUserId ? `request=RequestFollowUser&userId=${followUserId}`
      : linkCode ? `request=RequestPrivateGame&placeId=${placeId}&linkCode=${linkCode}`
      : jobId ? `request=RequestGameJob&placeId=${placeId}&gameId=${jobId}&isPlayTogetherGame=false`
      : `request=RequestGame&placeId=${placeId}&isPlayTogetherGame=false`;
    const launcherUrl = `https://assetgame.roblox.com/game/PlaceLauncher.ashx?${request}&browserTrackerId=${tracker}`;
    await rust("roblox:start", { dir: rbx.dir, ticket, launcherUrl, tracker });
    return { ok: true, as: accountId, fast: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err).replace(/^.*Error: /, ""), expired: err?.code === "EXPIRED" };
  }
}

let discordPrefs = {};
function updateDiscord() {
  if (!discordPrefs.enabled || !nowPlaying) return rust("discord:set", null).catch(() => {});
  const named = discordPrefs.showGame !== false && nowPlaying.name;
  rust("discord:set", { details: named ? `Playing ${nowPlaying.name}`.slice(0, 128) : "Playing Roblox", state: "via Moony", startTimestamp: nowPlaying.startedAt, largeImageKey: named ? nowPlaying.icon : "", largeImageText: named ? nowPlaying.name.slice(0, 128) : "" }).catch(() => {});
}
// Game sessions: playtime, "now playing", auto-close and rejoin offers.
let prefs = {};
let nowPlaying = null;
const tracker = createTracker(rust, emit);
tracker.on("start", async (s) => {
  nowPlaying = { universeId: s.universeId, placeId: s.placeId, jobId: s.jobId, name: null, icon: null, startedAt: s.startedAt };
  if (s.universeId) {
    try { const g = await roblox.gameDetails(s.universeId); nowPlaying = { ...nowPlaying, name: g.name, icon: g.icon }; tracker.setMeta(s.universeId, { name: g.name, icon: g.icon, placeId: g.placeId }); } catch { /* no name */ }
  }
  emit("game:now", nowPlaying);
  updateDiscord();
});
tracker.on("server", async (s) => {
  const region = await roblox.ipRegion(s.ip).catch(() => null);
  if (nowPlaying && nowPlaying.jobId === s.jobId) { nowPlaying = { ...nowPlaying, region }; emit("game:now", nowPlaying); }
});
tracker.on("end", ({ reason, session }) => {
  if (reason === "left game" && prefs.autoCloseRoblox !== false) {
    setTimeout(() => { if (tracker.current) return; rust("proc:kill-roblox").then(() => appWin.unminimize().then(() => appWin.setFocus())); }, 4000);
  }
  const last = nowPlaying;
  nowPlaying = null;
  emit("game:now", null);
  updateDiscord();
  if (reason === "disconnected" && session?.jobId && session.placeId) emit("game:disconnected", { placeId: session.placeId, jobId: session.jobId, universeId: session.universeId, name: last?.name || "your game", icon: last?.icon || null });
});

if (window.__TAURI_INTERNALS__ && !window.orbit) {
  tracker.start();
  window.orbit = {
    isDesktop: true,
    runtime: "tauri",
    update: { get: () => Promise.resolve({ status: "idle" }), check: () => Promise.resolve({ status: "latest" }), apply: () => Promise.resolve(), onState: off },
    win: {
      minimize: () => appWin.minimize(),
      toggleMaximize: () => appWin.toggleMaximize(),
      close: () => appWin.close(),
      isMaximized: () => appWin.isMaximized(),
      onMaximized: (cb) => { let un; appWin.onResized(async () => cb(await appWin.isMaximized())).then((u) => (un = u)); return () => un?.(); },
      resizeStart: (edge) => appWin.startResizeDragging({ n: "North", s: "South", e: "East", w: "West", ne: "NorthEast", nw: "NorthWest", se: "SouthEast", sw: "SouthWest" }[edge] || "SouthEast"),
      resizeMove: () => {},
      resizeEnd: () => {},
      startDrag: () => appWin.startDragging(),
    },
    api: (method, ...args) => {
      if (!PUBLIC.has(method)) return Promise.reject(new Error("Unknown request"));
      return roblox[method](...args);
    },
    launch: (opts) => launch(typeof opts === "object" ? opts : { placeId: opts }),
    install: () => Promise.resolve(null),
    setFps: unavailable("The FPS cap"),
    playtime: { get: () => Promise.resolve(tracker.summary()), onUpdate: on("playtime:update"), onNow: on("game:now") },
    avatar: {
      model3d: (acc, uid) => withSession(acc, (c) => roblox.avatar3d(c, uid)),
      state: (acc) => withSession(acc, (c) => roblox.avatarState(c)),
      inventory: (acc, kind, cursor) => withSession(acc, (c) => roblox.inventory(c, acc, kind, cursor)),
      outfits: (acc) => withSession(acc, (c) => roblox.outfits(c, acc)),
      wear: async (acc, assets) => { await withSession(acc, (c) => roblox.setWearing(c, assets)); await withSession(acc, (c) => roblox.redraw(c)); return true; },
      setType: async (acc, type) => { await withSession(acc, (c) => roblox.setAvatarType(c, type)); await withSession(acc, (c) => roblox.redraw(c)); return true; },
      wearOutfit: async (acc, id) => { await withSession(acc, (c) => roblox.wearOutfit(c, id)); await withSession(acc, (c) => roblox.redraw(c)); return true; },
    },
    openRobloxPage: (_acc, url) => rust("open:url", url),
    setPrefs: (p) => { prefs = p || {}; return rust("store:set", "prefs", p).catch(() => {}); },
    setZoom: () => Promise.resolve(true),
    setRadius: () => Promise.resolve(true),
    protocol: { get: () => Promise.resolve(false), set: unavailable("Opening Roblox links with Moony") },
    media: { get: () => Promise.resolve(null), onChange: off },
    hud: { status: () => Promise.resolve({ roblox: false, showing: false, enabled: false }), onStatus: off },
    market: {
      details: (acc, item) => withSession(acc, (c) => roblox.itemDetails(c, acc, item)),
      buy: (acc, item, price) => withSession(acc, (c) => roblox.buyItem(c, acc, item, Number(price))),
    },
    chat: {
      conversations: (acc, cursor) => withSession(acc, (c) => roblox.chatConversations(c, cursor)),
      messages: (acc, id, cursor) => withSession(acc, (c) => roblox.chatMessages(c, id, cursor)),
      send: (acc, id, text) => withSession(acc, (c) => roblox.chatSend(c, id, text)),
      markRead: (acc, id) => withSession(acc, (c) => roblox.chatRead(c, id)),
      start: (acc, uid) => withSession(acc, (c) => roblox.chatStart(c, uid)),
    },
    gameView: { frame: () => Promise.resolve(null), shots: () => Promise.resolve([]), openFolder: () => Promise.resolve(true), save: unavailable("Saving snapshots") },
    linkAccount: { take: () => Promise.resolve(false), onRequest: off },
    feedback: { send: unavailable("Feedback") },
    clips: { now: unavailable("Clips"), folder: () => Promise.resolve(true), onSaved: off },
    versions: {
      info: (ch) => rust("versions:info", ch ?? null),
      install: (g) => rust("versions:install", g),
      pin: (g) => rust("versions:pin", g ?? null),
      channel: (c) => rust("versions:channel", c),
      remove: (g) => rust("versions:remove", g),
      open: (g) => rust("versions:open", g),
      onProgress: on("versions:progress"),
    },
    fflags: { get: () => rust("fflags:get"), set: (f) => rust("fflags:set", f), presets: () => rust("fflags:presets") },
    game: { onDisconnected: on("game:disconnected"), onRejoin: on("game:rejoin"), onOpen: on("game:open"), watchUpdates: () => Promise.resolve(true) },
    mods: { status: () => Promise.resolve({ installed: false, kinds: {} }), pick: unavailable("Mods"), remove: unavailable("Mods"), preset: unavailable("Mods"), preview: unavailable("Mods"), apply: unavailable("Mods"), onReapplied: off },
    notify: { friend: () => Promise.resolve(true), onClick: on("notify:click") },
    discord: { configure: (p) => { discordPrefs = p || {}; updateDiscord(); return rust("discord:configure", p); }, status: () => rust("discord:status") },
    auth: {
      // Roblox's own login page opens in a separate window; Rust keeps the cookie.
      login: async () => {
        const r = await rust("auth:login");
        if (!r?.ok) return r;
        try { return { ok: true, user: await roblox.me(token(r.id)) }; } catch (e) { return { ok: false, error: e.message }; }
      },
      logout: async (id) => { await withSession(id, (c) => roblox.logout(c)).catch(() => {}); await rust("vault:remove", Number(id)); return { ok: true }; },
      sessions: () => rust("vault:accounts").then((a) => a.map((x) => x.id)),
      restore: async () => {
        const out = [];
        for (const a of await rust("vault:accounts")) {
          try { out.push(await roblox.me(token(a.id))); }
          catch (err) { if (err?.code === "EXPIRED") await rust("vault:remove", a.id); }
        }
        return out;
      },
      onExpired: on("auth:expired"),
      friends: (id) => withSession(id, (c) => roblox.friends(c, id)),
      robux: (id) => withSession(id, (c) => roblox.robux(c, id)),
      region: (id, placeId, jobId) => withSession(id, (c) => roblox.serverRegion(c, placeId, jobId)),
      resolveLink: (id, code) => withSession(id, (c) => roblox.resolveShareLink(c, code)),
    },
  };
}
