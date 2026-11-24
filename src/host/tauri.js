// window.orbit for the Rust (Tauri) build: the same API the Electron preload
// exposed, so the interface code is unchanged. Each call is either handled
// here (Roblox web API logic, which runs in the page) or sent to Rust.
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { roblox, rustFetch } from "./roblox-web";
import { createTracker } from "./tracker";
import { createMods } from "./mods";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

const rust = (channel, ...args) => invoke("ipc", { channel, args });
const appWin = window.__TAURI_INTERNALS__ ? getCurrentWindow() : null;

async function notify(title, body) {
  try {
    let ok = await isPermissionGranted();
    if (!ok) ok = (await requestPermission()) === "granted";
    if (ok) sendNotification({ title: String(title).slice(0, 120), body: String(body).slice(0, 240) });
  } catch { /* notifications off */ }
}

// Mods work on the Roblox version Moony launches (newest complete install).
const playerDir = async () => { const st = await rust("versions:info").catch(() => null); const v = st?.installed?.find((x) => x.complete); return v ? String(v.dir) : null; };
const mods = createMods(rust, playerDir);

// Game update alerts: every 15 minutes, check favourites for a newer update time.
let watchList = [];
async function checkUpdates() {
  if (!watchList.length) return;
  const seen = (await rust("store:get", "game-updates").catch(() => null)) || {};
  for (const id of watchList.slice(0, 50)) {
    try {
      const g = await roblox.gameDetails(id);
      const prev = seen[id];
      seen[id] = g.updated;
      if (prev && g.updated && new Date(g.updated) > new Date(prev)) notify(`${g.name} just updated`, "Open Moony to see what's new.");
    } catch { /* skip */ }
  }
  rust("store:set", "game-updates", seen).catch(() => {});
}
setInterval(checkUpdates, 15 * 60e3);

// FPS cap goes through the FFlags store so the editor stays in sync.
async function setFps(fps) {
  const n = Number(fps);
  if (!Number.isInteger(n) || n < 0 || n > 1000) return { ok: false, error: "Invalid FPS value" };
  const st = await rust("fflags:get");
  if (!st.installed) return { ok: false, error: "Roblox Player isn't installed" };
  const flags = { ...st.flags };
  if (n === 0) delete flags.DFIntTaskSchedulerTargetFps; else flags.DFIntTaskSchedulerTargetFps = n;
  const r = await rust("fflags:set", flags);
  return { ok: true, version: r.version };
}


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
const mb = (n) => (n / 1e6).toFixed(n > 1e8 ? 0 : 1);
let splashTimer = null, splashOff = null;
const splash = (s) => rust("splash:set", s).catch(() => {});
async function launch({ placeId, accountId, followUserId, jobId, linkCode, name, icon }) {
  const title = (followUserId ? `Joining ${name || "your friend"}` : name || "Roblox").slice(0, 80);
  await rust("splash:open", prefs.accent || "#8b7dff").catch(() => {});
  splash({ title, step: "Getting ready…", progress: 10, image: /^https:\/\/[a-z0-9.-]*rbxcdn\.com\//i.test(icon || "") ? icon : null, foot: "Moony" });
  clearTimeout(splashTimer); splashTimer = setTimeout(() => rust("splash:close", 0), 45000);
  splashOff?.(); splashOff = on("launch:progress")((p) => splash(p.total ? { step: `${p.phase} ${mb(p.done)} / ${mb(p.total)} MB`, progress: 8 + (p.done / p.total) * 45, foot: "Updating Roblox" } : { step: p.phase, progress: null }));
  const r = await launchInner({ placeId, accountId, followUserId, jobId, linkCode });
  splashOff?.(); splashOff = null;
  if (!r.ok) { if (!r.cancelled) { splash({ step: r.error, error: true, progress: 100 }); rust("splash:close", 3500); } }
  else splash({ step: r.as ? "Loading the game…" : "Opening Roblox…", progress: 85, foot: "Moony bootstrapper" });
  if (r.ok && !r.as) rust("splash:close", 3000);
  return r;
}
async function launchInner({ placeId, accountId, followUserId, jobId, linkCode }) {
  const isId = (v) => /^\d+$/.test(String(v));
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
    splash({ step: "Checking for Roblox updates…", progress: 8 });
    const [rbx, ticket] = await Promise.all([rust("roblox:ensure"), withSession(accountId, (c) => roblox.authTicket(c))]);
    splash({ channel: rbx.channel || "production", version: rbx.version || "", step: "Starting Roblox…", progress: 60, foot: "Moony" });
    if (await mods.reapplyIfNeeded().catch(() => false)) emit("mods:reapplied", await mods.status());
    if (await rust("splash:cancelled")) return { ok: false, cancelled: true };
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
  clearTimeout(splashTimer);
  splash({ step: "You're in!", progress: 100 }); rust("splash:close", 700).catch(() => {});
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
  if (reason === "disconnected" && session?.jobId && session.placeId) notify("Disconnected from Roblox", `Open Moony to rejoin the same ${last?.name || "game"} server.`);
  if (reason === "disconnected" && session?.jobId && session.placeId) emit("game:disconnected", { placeId: session.placeId, jobId: session.jobId, universeId: session.universeId, name: last?.name || "your game", icon: last?.icon || null });
});

// A Roblox link opened with Moony (at start-up or while running).
async function handleLink(uri) {
  if (!/^roblox(-player)?:/i.test(String(uri))) return;
  if (/^roblox-player:/i.test(uri)) {
    const parts = Object.fromEntries(uri.replace(/^roblox-player:/i, "").split("+").map((kv) => { const i = kv.indexOf(":"); return [kv.slice(0, i), kv.slice(i + 1)]; }));
    await rust("splash:open", prefs.accent || "#8b7dff").catch(() => {});
    splash({ title: parts.launchmode === "app" ? "Roblox" : "Joining game", step: "Checking for Roblox updates…", progress: 8, foot: "Moony bootstrapper" });
    splashOff?.(); splashOff = on("launch:progress")((p) => splash(p.total ? { step: `${p.phase} ${mb(p.done)} / ${mb(p.total)} MB`, progress: 8 + (p.done / p.total) * 50 } : { step: p.phase, progress: null }));
    try {
      const rbx = await rust("roblox:ensure");
      splash({ channel: rbx.channel || "production", version: rbx.version || "", step: "Starting Roblox…", progress: 70 });
      if (await rust("splash:cancelled")) return;
      const args = ["--app"];
      if (parts.gameinfo) args.push("-t", parts.gameinfo);
      if (parts.placelauncherurl) args.push("-j", decodeURIComponent(parts.placelauncherurl));
      if (parts.browsertrackerid) args.push("-b", parts.browsertrackerid);
      args.push(`--launchtime=${parts.launchtime || Date.now()}`, "--rloc", parts.robloxLocale || "en_us", "--gloc", parts.gameLocale || "en_us");
      await rust("roblox:start-link", { dir: rbx.dir, args });
      splash({ step: parts.placelauncherurl ? "Loading the game…" : "Opening Roblox…", progress: 85 });
      if (!parts.placelauncherurl) rust("splash:close", 2500);
      else { clearTimeout(splashTimer); splashTimer = setTimeout(() => rust("splash:close", 0), 45000); }
    } catch (e) { splash({ step: String(e?.message || e), error: true, progress: 100 }); rust("splash:close", 4000); }
    finally { splashOff?.(); splashOff = null; }
  } else {
    const q = new URLSearchParams(uri.replace(/^roblox:\/*/i, "").replace(/^\?/, ""));
    const placeId = q.get("placeId") || q.get("placeid");
    if (placeId) launch({ placeId, accountId: prefs.activeAccountId, jobId: q.get("gameInstanceId") || undefined, linkCode: q.get("linkCode") || undefined, name: "Roblox" });
  }
}

// What's playing (Spotify, a browser tab, Media Player...): checked every
// 2 s; the UI hears about changes.
let media = null;
setInterval(async () => {
  const m = await rust("media:info").catch(() => null);
  if (JSON.stringify(m) !== JSON.stringify(media)) { media = m; emit("media:change", m); }
}, 2000);
// Feed the HUD once a second while it's showing.
let hudPing = null, hudPingAt = 0;
async function hudTick() {
  const st = await rust("hud:status").catch(() => null);
  if (!st?.showing) return;
  const hp = prefs.hud || {};
  if (hp.widgets?.ping?.on && Date.now() - hudPingAt > 5000) { hudPingAt = Date.now(); rust("net:ping").then((ms) => { hudPing = ms; }).catch(() => {}); }
  const system = hp.widgets?.system?.on ? await rust("sys:usage").catch(() => null) : null;
  rust("hud:push", { prefs: hp, now: nowPlaying, media, system, ping: hudPing, time: Date.now() }).catch(() => {});
}

if (window.__TAURI_INTERNALS__ && !window.orbit) {
  // Links (Discord, website, promos) open in your normal browser.
  window.open = (url) => { if (/^https:\/\//.test(String(url))) rust("open:url", String(url)).catch(() => {}); return null; };
  document.addEventListener("click", (e) => { const a = e.target.closest?.("a[href^='https://']"); if (a) { e.preventDefault(); rust("open:url", a.href).catch(() => {}); } }, true);
  tracker.start();
  setInterval(hudTick, 1000);
  rust("app:argv").then((argv) => argv.slice(1).forEach(handleLink)).catch(() => {});
  listen("app:argv", (e) => (e.payload || []).slice(1).forEach(handleLink));
  window.orbit = {
    isDesktop: true,
    runtime: "tauri",
    update: { get: () => rust("update:get"), check: () => rust("update:check"), apply: () => rust("update:apply"), onState: on("update:state") },
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
    setFps: (fps) => setFps(fps),
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
    setPrefs: (p) => { prefs = p || {}; rust("hud:enabled", !!prefs.hud?.enabled).catch(() => {}); return rust("store:set", "prefs", p).catch(() => {}); },
    setZoom: () => Promise.resolve(true),
    setRadius: (r) => rust("ui:radius", Number(r) || 0),
    protocol: { get: () => rust("protocol:get"), set: (v) => rust("protocol:set", !!v) },
    media: { get: () => rust("media:info"), onChange: on("media:change") },
    hud: { status: () => rust("hud:status"), onStatus: on("hud:status") },
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
    feedback: { send: (p) => rust("feedback:send", p) },
    versions: {
      info: (ch) => rust("versions:info", ch ?? null),
      install: (g) => rust("versions:install", g),
      pin: (g) => rust("versions:pin", g ?? null),
      channel: (c) => rust("versions:channel", c),
      remove: (g) => rust("versions:remove", g),
      open: (g) => rust("versions:open", g),
      onProgress: on("versions:progress"),
    },
    fflags: {
      get: () => rust("fflags:get"), set: (f) => rust("fflags:set", f), presets: () => rust("fflags:presets"),
      // Read a flag list from a link (raw GitHub/Gist, Pastebin...). Returns the text.
      fromUrl: async (url) => {
        let u = String(url).trim();
        if (!/^https:\/\//.test(u)) throw new Error("Use an https:// link");
        u = u.replace(/^https:\/\/pastebin\.com\/(?!raw\/)([A-Za-z0-9]+)$/, "https://pastebin.com/raw/$1")
             .replace(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/, "https://raw.githubusercontent.com/$1/$2/$3");
        const r = await rustFetch(u);
        if (!r.ok) throw new Error(`That link returned ${r.status}`);
        return r.text();
      },
    },
    game: { onDisconnected: on("game:disconnected"), onRejoin: on("game:rejoin"), onOpen: on("game:open"), watchUpdates: (ids, enabled) => { watchList = enabled ? (ids || []).filter((x) => /^\d+$/.test(String(x))).map(Number) : []; checkUpdates(); return Promise.resolve(true); } },
    mods: {
      status: () => mods.status(),
      pick: (k) => mods.pick(k).catch((e) => ({ ok: false, error: e.message })),
      remove: (k) => mods.remove(k).catch((e) => ({ ok: false, error: e.message })),
      preset: (k, p) => mods.preset(k, p).catch((e) => ({ ok: false, error: e.message })),
      preview: (k) => mods.preview(k),
      online: (k, item) => mods.online(k, item).catch((e) => ({ ok: false, error: e.message })),
      apply: () => mods.apply().then((st) => ({ ok: true, status: st })).catch((e) => ({ ok: false, error: e.message })),
      onReapplied: on("mods:reapplied"),
    },
    notify: { friend: (n) => notify(n?.title || "Moony", n?.body || "").then(() => true), onClick: on("notify:click") },
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
        // First run of the Rust build: bring over accounts from the old Moony.
        if (!localStorage.getItem("moony-imported")) { await rust("vault:import").catch(() => 0); localStorage.setItem("moony-imported", "1"); }
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
