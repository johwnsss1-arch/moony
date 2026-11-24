const { app, BrowserWindow, ipcMain, shell, screen, session, safeStorage, Notification, nativeImage, net, dialog, desktopCapturer, protocol } = require("electron");

// Lighter on memory: a smaller JS heap that collects garbage sooner, fewer
// helper processes, and no media-key/session services Moony doesn't use.
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=320 --optimize-for-size");
app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService,SpareRendererForSitePerProcess");
app.commandLine.appendSwitch("disable-site-isolation-trials");
const path = require("path");
const { pathToFileURL } = require("url");
const { execFile, spawn } = require("child_process");
const fs = require("fs");
const roblox = require("./roblox.cjs");

const DEV_URL = process.env.ORBIT_DEV_URL; // set by `npm run desktop`

// Pin the data folder (saved sign-ins, settings) to %APPDATA%\Moony so it
// never moves when the app's name or package changes.
app.setName("Moony");
app.setAppUserModelId("Moony"); // Windows needs this for notifications

/* ---------- Stability ---------- */
// One Moony at a time: a second launch (or a Roblox link) goes to the open one.
// The installer/updater runs its own copy, so it skips this.
// Setup mode only when running from the portable setup exe, never from the installed copy.
const INSTALLED_DIR = path.join(process.env.LOCALAPPDATA || "", "Programs", "Moony").toLowerCase();
const IS_SETUP = (!!process.env.PORTABLE_EXECUTABLE_FILE && !process.execPath.toLowerCase().startsWith(INSTALLED_DIR)) || process.argv.includes("--uninstall");
if (!IS_SETUP && !app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
// The installer can start Moony with --link-account to go straight to Roblox sign-in.
let pendingLink = process.argv.includes("--link-account");
app.on("second-instance", (_e, argv) => {
  if (argv.includes("--link-account")) { pendingLink = true; if (win && !win.isDestroyed()) win.webContents.send("app:link-account"); }
  const link = argv.find((a) => /^roblox(-player)?:/i.test(a));
  if (link) return handleRobloxLink(link);
  if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
});
// Errors go to %APPDATA%\Moony\logs\moony.log instead of crashing the app.
const logFile = () => path.join(app.getPath("userData"), "logs", "moony.log");
function logError(kind, err) {
  const line = `[${new Date().toISOString()}] ${kind}: ${err?.stack || err}\n`;
  console.error(line.trim());
  try {
    fs.mkdirSync(path.dirname(logFile()), { recursive: true });
    if (fs.existsSync(logFile()) && fs.statSync(logFile()).size > 2e6) fs.renameSync(logFile(), logFile() + ".old");
    fs.appendFileSync(logFile(), line);
  } catch { /* can't log */ }
}
process.on("uncaughtException", (e) => logError("uncaught", e));
process.on("unhandledRejection", (e) => logError("unhandled promise", e));
// Serves your Roblox screenshots/recordings to the Game View tab (read-only).
protocol.registerSchemesAsPrivileged([{ scheme: "moony-shot", privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }]);
app.setPath("userData", path.join(app.getPath("appData"), "Moony"));
let win;

/* ---------- Startup bootstrapper ----------
   A small splash appears instantly while Moony gets ready in the background:
   checks Roblox, re-applies mods/flags after Roblox updates, and warms the game
   lists, then hands over to the main window. */
let winReady = false, bootDone = false, bootSplash = null;
function maybeShowMain() {
  if (!winReady || !bootDone || !win || win.isDestroyed()) return;
  win.show();
  win.focus();
  bootSplash?.set({ step: "Ready", progress: 100 });
  bootSplash?.close(150);
}
async function bootStartup() {
  bootSplash = new Splash({ width: 380, height: 300, accent: "#8b7dff", icon: path.join(__dirname, "..", "build", "icon.png") });
  const step = (s, p) => bootSplash.set({ title: "Moony", step: s, progress: p, foot: `v${app.getVersion()}` });
  try {
    step("Checking Roblox…", 15);
    const dir = findPlayerDir();
    latestVersion().catch(() => {}); // warm the fast-launch version check
    step(dir ? "Applying your mods…" : "Roblox isn't installed yet", 40);
    if (dir) { try { modsReady().reapplyIfNeeded(); reapplyFlagsIfNeeded(); } catch { /* not fatal */ } }
    step("Loading games…", 65);
    // Fresh lists if we have none saved; otherwise the saved ones show instantly.
    let saved = false;
    try { saved = fs.existsSync(cacheFile("sorts", [])); } catch { /* none */ }
    if (!saved) await Promise.race([refreshCache("sorts", []).catch(() => {}), new Promise((r) => setTimeout(r, 7000))]);
    else refreshCache("sorts", []).catch(() => {});
    step("Starting Moony…", 90);
  } finally {
    bootDone = true;
    maybeShowMain();
    // Never keep the splash up forever.
    setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) { winReady = true; maybeShowMain(); } }, 12000);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    frame: false,
    transparent: true, // lets the UI draw its own rounded corners
    backgroundColor: "#00000000",
    hasShadow: true,
    resizable: true,
    title: "Moony",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Shown by the startup bootstrapper once Moony is ready (see bootStartup).
  win.once("ready-to-show", () => { winReady = true; maybeShowMain(); });

  // Log page errors to the terminal (helps diagnose a blank window).
  win.webContents.on("console-message", (_e, level, message, line, source) => { if (level >= 3) console.error(`[page error] ${message} (${source}:${line})`); });
  // If the page crashes, log it and reload instead of leaving a dead window.
  let crashes = 0;
  win.webContents.on("render-process-gone", (_e, d) => {
    logError("page crashed", d.reason);
    if (d.reason !== "clean-exit" && ++crashes <= 3 && win && !win.isDestroyed()) setTimeout(() => win.webContents.reload(), 800);
  });
  win.webContents.on("unresponsive", () => logError("page unresponsive", "main window stopped responding"));
  win.webContents.on("did-fail-load", (_e, code, desc, url) => console.error("[page failed to load]", code, desc, url));
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Closing Moony quits it (the hidden HUD window shouldn't keep it running).
  win.on("closed", () => { win = null; app.quit(); });
  const sendState = () => win.webContents.send("win:maximized", win.isMaximized());
  win.on("maximize", sendState);
  win.on("unmaximize", sendState);
}

/* ---------- window controls ---------- */
ipcMain.on("win:minimize", () => win?.minimize());
ipcMain.on("win:toggle-maximize", () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
ipcMain.on("win:close", () => win?.close());
ipcMain.handle("win:is-maximized", () => win?.isMaximized() ?? false);

// Edge resizing. Transparent windows don't get native resize borders on
// Windows, so the UI has thin edge handles that drive this.
let resize = null;
ipcMain.on("win:resize-start", (_e, edge) => {
  if (!win || win.isMaximized()) return;
  resize = { edge, start: screen.getCursorScreenPoint(), bounds: win.getBounds() };
});
ipcMain.on("win:resize-move", () => {
  if (!resize || !win) return;
  const p = screen.getCursorScreenPoint();
  const dx = p.x - resize.start.x, dy = p.y - resize.start.y;
  const [minW, minH] = win.getMinimumSize();
  let { x, y, width, height } = resize.bounds;
  const e = resize.edge;
  if (e.includes("e")) width = Math.max(minW, width + dx);
  if (e.includes("s")) height = Math.max(minH, height + dy);
  if (e.includes("w")) { const w = Math.max(minW, width - dx); x += width - w; width = w; }
  if (e.includes("n")) { const h = Math.max(minH, height - dy); y += height - h; height = h; }
  win.setBounds({ x, y, width, height });
});
ipcMain.on("win:resize-end", () => { resize = null; });

/* ---------- Roblox data ---------- */
const API = new Set(["sorts", "search", "gameDetails", "lookupUser", "searchUsers", "presence", "servers", "userProfile", "gameMedia", "badges", "catalog", "placeUniverse", "searchMany", "genreGames", "news", "avatarImage"]);
// Slow, big lists are saved to disk: a request gets the saved copy instantly
// and a fresh copy is fetched in the background for next time.
const DISK_CACHED = { sorts: 20 * 60e3, genreGames: 60 * 60e3, news: 20 * 60e3 };
const cacheDir = () => path.join(app.getPath("userData"), "moony-lists"); // not "cache": that is Electron's own folder on Windows
const cacheFile = (method, args) => path.join(cacheDir(), `${method}-${String(args.join("_")).replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "all"}.json`);
// One fetch per list at a time; anyone asking while it runs shares the result.
const refreshing = new Map();
function refreshCache(method, args) {
  const file = cacheFile(method, args);
  if (refreshing.has(file)) return refreshing.get(file);
  const p = (async () => {
    try {
      const data = await roblox[method](...args);
      fs.mkdirSync(cacheDir(), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ t: Date.now(), data }));
      return data;
    } finally { refreshing.delete(file); }
  })();
  refreshing.set(file, p);
  return p;
}
ipcMain.handle("roblox:api", async (_e, method, ...args) => {
  if (!API.has(method)) throw new Error("Unknown method");
  if (!DISK_CACHED[method]) return roblox[method](...args);
  let saved = null;
  try { saved = JSON.parse(fs.readFileSync(cacheFile(method, args), "utf8")); } catch { /* none yet */ }
  if (saved) {
    if (Date.now() - saved.t > DISK_CACHED[method]) refreshCache(method, args).catch(() => {});
    return saved.data;
  }
  return refreshCache(method, args);
});
// Warm the cache after startup so genre pages open instantly.
const GENRES = ["Action", "Adventure", "Entertainment", "Obby & Platformer", "Party & Casual", "Puzzle", "RPG", "Roleplay & Avatar Sim", "Shooter", "Shopping", "Simulation", "Social", "Sports & Racing", "Strategy", "Survival", "Education"];
async function prefetchGenres() {
  await new Promise((r) => setTimeout(r, 8000));
  for (const g of GENRES) {
    const f = cacheFile("genreGames", [g]);
    let fresh = false;
    try { fresh = Date.now() - JSON.parse(fs.readFileSync(f, "utf8")).t < DISK_CACHED.genreGames; } catch { /* missing */ }
    if (!fresh) { await refreshCache("genreGames", [g]).catch(() => {}); await new Promise((r) => setTimeout(r, 1500)); }
  }
}

/* ---------- Session vault ----------
   Signed-in sessions are encrypted with the OS keychain (Windows DPAPI via
   safeStorage) and stored in the app's user-data folder. The raw cookie never
   reaches the UI process. */
const vaultFile = () => path.join(app.getPath("userData"), "sessions.json");
function readVault() {
  try { return JSON.parse(fs.readFileSync(vaultFile(), "utf8")); } catch { return {}; }
}
function writeVault(v) {
  fs.mkdirSync(path.dirname(vaultFile()), { recursive: true });
  fs.writeFileSync(vaultFile(), JSON.stringify(v));
}
function getCookie(userId) {
  const enc = readVault()[userId];
  if (!enc) return null;
  try { return safeStorage.decryptString(Buffer.from(enc, "base64")); } catch { return null; }
}
function saveCookie(userId, cookie) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure storage isn't available on this PC");
  const v = readVault();
  v[userId] = safeStorage.encryptString(cookie).toString("base64");
  writeVault(v);
}
function dropCookie(userId) {
  const v = readVault();
  delete v[userId];
  writeVault(v);
  console.warn(`[session] Roblox ended the saved session for account ${userId}`);
  sendUI("auth:expired", Number(userId));
}

// When Roblox sends a replacement session token, save it in place of the old
// one so the account stays signed in.
roblox.onCookieRotated((oldCookie, newCookie) => {
  for (const id of Object.keys(readVault())) {
    if (getCookie(id) === oldCookie) { saveCookie(id, newCookie); console.log(`[session] Saved Roblox's refreshed session for account ${id}`); }
  }
});

// Opens Roblox's real login page in its own isolated window. The user signs in
// there themselves (Moony never sees the password). Once Roblox sets the
// session cookie, Moony stores it encrypted and closes the window.
let loginWin = null;
ipcMain.handle("auth:login", () => new Promise((resolve) => {
  if (loginWin) { loginWin.focus(); return resolve({ ok: false, error: "A sign-in window is already open" }); }
  const partition = `orbit-login-${Date.now()}`; // fresh, in-memory, nothing shared
  const ses = session.fromPartition(partition);
  let done = false;
  loginWin = new BrowserWindow({
    width: 480, height: 720, parent: win, modal: false, title: "Sign in to Roblox",
    autoHideMenuBar: true, backgroundColor: "#ffffff",
    webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  // Keep the login window on Roblox's own sites.
  loginWin.webContents.on("will-navigate", (e, url) => {
    if (!/^https:\/\/([a-z0-9-]+\.)*roblox\.com\//i.test(url)) e.preventDefault();
  });
  loginWin.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  const finish = (result) => {
    if (done) return;
    done = true;
    resolve(result);
    if (loginWin && !loginWin.isDestroyed()) loginWin.close();
    ses.clearStorageData().catch(() => {});
  };

  ses.cookies.on("changed", async (_e, cookie, _cause, removed) => {
    if (removed || cookie.name !== ".ROBLOSECURITY" || !cookie.value) return;
    try {
      const user = await roblox.me(cookie.value);
      saveCookie(user.id, cookie.value);
      finish({ ok: true, user });
    } catch (err) {
      finish({ ok: false, error: err.message });
    }
  });
  loginWin.on("closed", () => { loginWin = null; finish({ ok: false, cancelled: true }); });
  loginWin.loadURL("https://www.roblox.com/login");
}));

ipcMain.handle("app:take-link", () => { const v = pendingLink; pendingLink = false; return v; });
ipcMain.handle("auth:logout", async (_e, userId) => {
  const cookie = getCookie(userId);
  if (cookie) await roblox.logout(cookie); // ends the session on Roblox's side too
  dropCookie(userId);
  return { ok: true };
});

// Which accounts have a working saved session.
ipcMain.handle("auth:sessions", () => Object.keys(readVault()).map(Number));

// Profiles for every saved session, so signed-in accounts come back on
// startup even if the UI's own storage was cleared. Sessions Roblox has
// expired are dropped.
ipcMain.handle("auth:restore", async () => {
  const out = [];
  for (const id of Object.keys(readVault())) {
    const cookie = getCookie(id);
    if (!cookie) { dropCookie(id); continue; }
    try { out.push(await roblox.me(cookie)); }
    catch (err) { if (err.code === "EXPIRED") dropCookie(id); }
  }
  return out;
});

const withSession = async (userId, fn) => {
  const cookie = getCookie(userId);
  if (!cookie) throw new Error("This account isn't signed in");
  try { return await fn(cookie); }
  catch (err) { if (err.code === "EXPIRED") dropCookie(userId); throw err; }
};
ipcMain.handle("auth:friends", (_e, userId) => withSession(userId, (c) => roblox.friends(c, userId)));
/* ---------- Avatar (signed-in) ---------- */
ipcMain.handle("avatar:3d", (_e, accountId, userId) => withSession(accountId, (c) => roblox.avatar3d(c, userId)));
ipcMain.handle("avatar:state", (_e, accountId) => withSession(accountId, (c) => roblox.avatarState(c)));
ipcMain.handle("avatar:inventory", (_e, accountId, kind, cursor) => withSession(accountId, (c) => roblox.inventory(c, accountId, kind, cursor)));
ipcMain.handle("avatar:outfits", (_e, accountId) => withSession(accountId, (c) => roblox.outfits(c, accountId)));
ipcMain.handle("avatar:wear", async (_e, accountId, assets) => {
  if (!Array.isArray(assets) || assets.some((a) => !/^\d+$/.test(String(a?.id)))) throw new Error("Invalid items");
  await withSession(accountId, (c) => roblox.setWearing(c, assets));
  await withSession(accountId, (c) => roblox.redraw(c));
  return true;
});
ipcMain.handle("avatar:type", async (_e, accountId, type) => { await withSession(accountId, (c) => roblox.setAvatarType(c, type)); await withSession(accountId, (c) => roblox.redraw(c)); return true; });
ipcMain.handle("avatar:outfit", async (_e, accountId, outfitId) => { await withSession(accountId, (c) => roblox.wearOutfit(c, outfitId)); await withSession(accountId, (c) => roblox.redraw(c)); return true; });

// Opens a roblox.com page (e.g. an item to buy) in a Moony window, signed in
// as the account. Roblox's own page handles purchases; Moony never does.
ipcMain.handle("roblox:page", async (_e, accountId, url) => {
  if (!/^https:\/\/www\.roblox\.com\/(catalog|bundles|games|users|my\/avatar|upgrades|redeem)[/?]/i.test(String(url))) throw new Error("Only roblox.com pages can be opened");
  const partition = `persist:roblox-${accountId || "guest"}`;
  const ses = session.fromPartition(partition);
  const cookie = accountId ? getCookie(accountId) : null;
  if (cookie) await ses.cookies.set({ url: "https://www.roblox.com", domain: ".roblox.com", name: ".ROBLOSECURITY", value: cookie, secure: true, httpOnly: true, expirationDate: Date.now() / 1000 + 86400 * 30 });
  const w = new BrowserWindow({ width: 1180, height: 800, parent: win, title: "Moony · Roblox", icon: path.join(__dirname, "..", "build", "icon.png"), autoHideMenuBar: true, backgroundColor: "#0e0f13", webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  w.webContents.on("will-navigate", (e, u) => { if (!/^https:\/\/([a-z0-9-]+\.)*roblox\.com\//i.test(u)) e.preventDefault(); });
  w.webContents.setWindowOpenHandler(({ url: u }) => { if (/^https:\/\/([a-z0-9-]+\.)*roblox\.com\//i.test(u)) w.loadURL(u); return { action: "deny" }; });
  w.loadURL(url);
  return true;
});

/* ---------- Game View: live Roblox window + screenshots ---------- */
ipcMain.handle("gameview:frame", async (_e, width = 1280) => {
  const sources = await desktopCapturer.getSources({ types: ["window"], thumbnailSize: { width: Math.min(1920, Number(width) || 1280), height: Math.round(Math.min(1920, Number(width) || 1280) * 9 / 16) } });
  const s = sources.find((x) => /^Roblox$/i.test(x.name)) || sources.find((x) => /^Roblox\b/i.test(x.name) && !/Moony/i.test(x.name));
  if (!s || s.thumbnail.isEmpty()) return null;
  return { name: s.name, image: s.thumbnail.toDataURL() };
});
const shotDirs = () => [path.join(app.getPath("pictures"), "Roblox"), path.join(app.getPath("videos"), "Roblox")];
const SHOT_KINDS = ["pictures", "videos"];
ipcMain.handle("gameview:shots", () => {
  const out = [];
  for (const [i, dir] of shotDirs().entries()) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(png|jpe?g|mp4|webm)$/i.test(f)) continue;
      const st = fs.statSync(path.join(dir, f));
      out.push({ name: f, url: `moony-shot://${SHOT_KINDS[i]}/${encodeURIComponent(f)}`, video: /\.(mp4|webm)$/i.test(f), time: st.mtimeMs, size: st.size });
    }
  }
  return out.sort((a, b) => b.time - a.time).slice(0, 200);
});
// Saves a Game View snapshot into Pictures\Roblox next to Roblox's own screenshots.
ipcMain.handle("gameview:save", (_e, dataUrl) => {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
  if (!m) throw new Error("Invalid image");
  const dir = shotDirs()[0];
  fs.mkdirSync(dir, { recursive: true });
  const name = `Moony_${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(m[1], "base64"));
  return name;
});
/* ---------- Feedback & "how did you find Moony" ---------- */
// Posts to the Moony team's Discord webhook (package.json moony.feedbackWebhook).
// Only the typed message / picked answer, its type and the app version are sent.
let lastFeedback = 0;
ipcMain.handle("feedback:send", async (_e, p) => {
  const hook = require("../package.json").moony?.feedbackWebhook;
  if (!hook || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(hook)) throw new Error("Feedback isn't set up yet. Post it in the Moony Discord instead!");
  const kind = ["idea", "bug", "love", "source"].includes(p?.kind) ? p.kind : "idea";
  const text = String(p?.text || "").replace(/@(everyone|here)/g, "@​$1").slice(0, 1500).trim();
  if (!text) throw new Error("Empty message");
  if (Date.now() - lastFeedback < 20000) throw new Error("Please wait a few seconds before sending again.");
  lastFeedback = Date.now();
  const label = { idea: "💡 Idea", bug: "🐛 Bug", love: "💜 Love", source: "📍 Found Moony via" }[kind];
  const res = await net.fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "Moony Feedback", allowed_mentions: { parse: [] }, embeds: [{ title: label, description: text, color: 0x8b7dff, footer: { text: `Moony ${String(p?.version || app.getVersion()).slice(0, 20)}` } }] }) });
  if (!res.ok) throw new Error("Couldn't send feedback. Try again later.");
  return true;
});

ipcMain.handle("gameview:folder",() => { const d = shotDirs()[0]; fs.mkdirSync(d, { recursive: true }); shell.openPath(d); return true; });

/* ---------- Marketplace buying (signed-in) ---------- */
const validItem = (item) => item && /^\d+$/.test(String(item.id)) && ["Asset", "Bundle"].includes(item.type);
ipcMain.handle("market:details", (_e, accountId, item) => {
  if (!validItem(item)) throw new Error("Invalid item");
  return withSession(accountId, (c) => roblox.itemDetails(c, accountId, item));
});
ipcMain.handle("market:buy", (_e, accountId, item, expectedPrice) => {
  if (!validItem(item) || !Number.isInteger(Number(expectedPrice)) || Number(expectedPrice) < 0) throw new Error("Invalid purchase");
  return withSession(accountId, (c) => roblox.buyItem(c, accountId, item, Number(expectedPrice)));
});

/* ---------- Chat (signed-in) ---------- */
const validConv = (id) => /^[A-Za-z0-9:_-]{1,128}$/.test(String(id));
ipcMain.handle("chat:conversations", (_e, accountId, cursor) => withSession(accountId, (c) => roblox.chatConversations(c, cursor)));
ipcMain.handle("chat:messages", (_e, accountId, convId, cursor) => { if (!validConv(convId)) throw new Error("Invalid chat"); return withSession(accountId, (c) => roblox.chatMessages(c, convId, cursor)); });
ipcMain.handle("chat:send", (_e, accountId, convId, text) => { if (!validConv(convId)) throw new Error("Invalid chat"); return withSession(accountId, (c) => roblox.chatSend(c, convId, text)); });
ipcMain.handle("chat:start", (_e, accountId, userId) => { if (!/^\d+$/.test(String(userId))) throw new Error("Invalid user"); return withSession(accountId, (c) => roblox.chatStart(c, userId)); });
ipcMain.handle("chat:read", (_e, accountId, convId) => { if (!validConv(convId)) return; return withSession(accountId, (c) => roblox.chatRead(c, convId)); });

ipcMain.handle("auth:robux", (_e, userId) => withSession(userId, (c) => roblox.robux(c, userId)));
ipcMain.handle("auth:region", (_e, userId, placeId, jobId) => {
  if (!/^\d+$/.test(String(placeId)) || !/^[0-9a-f-]{36}$/i.test(String(jobId))) throw new Error("Invalid server");
  return withSession(userId, (c) => roblox.serverRegion(c, placeId, jobId));
});
ipcMain.handle("auth:resolve-link", (_e, userId, code) => {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(String(code))) throw new Error("Invalid link");
  return withSession(userId, (c) => roblox.resolveShareLink(c, code));
});

/* ---------- launching ---------- */
// Without an account: the official roblox:// link (uses whoever is signed in
// to the Roblox app). With a signed-in account: a one-time auth ticket, the
// same way roblox.com's Play button starts the player.
ipcMain.handle("roblox:launch", (e, opts) => launchHandler(e, opts));
async function launchHandler(_e, opts) {
  const { placeId, accountId, followUserId, jobId, linkCode } = typeof opts === "object" ? opts : { placeId: opts };
  const isId = (v) => /^\d+$/.test(String(v));
  if (placeId && !isId(placeId)) return { ok: false, error: "Invalid place" };
  if (followUserId && !isId(followUserId)) return { ok: false, error: "Invalid user" };
  if (jobId && !/^[0-9a-f-]{36}$/i.test(String(jobId))) return { ok: false, error: "Invalid server" };
  if (linkCode && !/^[A-Za-z0-9_-]{4,64}$/.test(String(linkCode))) return { ok: false, error: "Invalid private server link" };
  if (!placeId && !followUserId) return { ok: false, error: "Nothing to launch" };

  // Bootstrapper window: shows progress until you're in the game.
  const name = typeof opts?.name === "string" ? opts.name.slice(0, 80) : "Roblox";
  const icon = typeof opts?.icon === "string" && /^https:\/\/[a-z0-9.-]*rbxcdn\.com\//i.test(opts.icon) ? opts.icon : null;
  launchSplash?.close();
  const splash = (launchSplash = new Splash({ parent: null, accent: appPrefs.accent || "#8b7dff", icon: path.join(__dirname, "..", "build", "icon.png") }));
  splash.set({ title: followUserId ? `Joining ${name}` : name, step: "Getting ready…", progress: 12, image: icon, foot: "Moony" });
  clearTimeout(launchSplashTimer);
  launchSplashTimer = setTimeout(() => splash.close(), 45000); // safety net
  const fail = (error, extra = {}) => { splash.set({ step: error, error: true, progress: 100 }); splash.close(3500); return { ok: false, error, ...extra }; };

  if (!accountId || !getCookie(accountId)) {
    if (!placeId) return fail("Sign in to join friends");
    splash.set({ step: "Opening Roblox…", progress: 55 });
    shell.openExternal(`roblox://placeId=${placeId}${jobId ? `&gameInstanceId=${jobId}` : ""}${linkCode ? `&linkCode=${linkCode}` : ""}`);
    splash.set({ step: "Starting Roblox…", progress: 75 });
    return { ok: true, as: null };
  }
  try {
    // Make sure Moony's own copy of Roblox is installed and current (downloads
    // updates here, with progress), then launch it directly.
    splash.set({ step: "Checking for Roblox updates…", progress: 8 });
    const mb = (n) => (n / 1e6).toFixed(n > 1e8 ? 0 : 1);
    let rbx = null;
    try {
      rbx = await rbxinstall.ensure((p) => {
        if (p.total) splash.set({ step: `${p.phase} ${mb(p.done)} / ${mb(p.total)} MB${p.speed ? ` · ${mb(p.speed)} MB/s` : ""}`, progress: 8 + (p.done / p.total) * 40, foot: "Updating Roblox" });
        else splash.set({ step: p.phase, progress: null });
      }, versionPrefs());
      if (rbx) splash.set({ channel: rbx.channel || "production", version: rbx.version || "" });
    } catch (e) { console.warn("[launch] Moony's Roblox install failed:", e.message); }
    splash.set({ step: "Signing you in…", progress: 55, foot: "Moony" });
    const [ticket, fastDir] = await Promise.all([withSession(accountId, roblox.authTicket), rbx?.dir ? Promise.resolve(rbx.dir) : canFastLaunch(findPlayerDir).catch(() => null)]);
    const tracker = Date.now() * 1000 + Math.floor(Math.random() * 1000);
    const request = followUserId
      ? `request=RequestFollowUser&userId=${followUserId}`
      : linkCode
        ? `request=RequestPrivateGame&placeId=${placeId}&linkCode=${linkCode}`
      : jobId
        ? `request=RequestGameJob&placeId=${placeId}&gameId=${jobId}&isPlayTogetherGame=false`
        : `request=RequestGame&placeId=${placeId}&isPlayTogetherGame=false`;
    const launcherUrl = `https://assetgame.roblox.com/game/PlaceLauncher.ashx?${request}&browserTrackerId=${tracker}`;
    if (splash.closed) return { ok: false, cancelled: true };
    splash.set({ step: "Starting Roblox…", progress: 60 });
    let fast = false;
    if (fastDir) {
      // Roblox is up to date: start the player directly (skips the update check).
      try { directLaunch(fastDir, { ticket, launcherUrl, trackerId: tracker }); fast = true; } catch { /* fall back below */ }
    }
    if (!fast) {
      // Roblox's own launcher: it updates Roblox first if needed.
      shell.openExternal(`roblox-player:1+launchmode:play+gameinfo:${ticket}+launchtime:${Date.now()}+placelauncherurl:${encodeURIComponent(launcherUrl)}+browsertrackerid:${tracker}+robloxLocale:en_us+gameLocale:en_us`);
    }
    splash.set({ step: fast ? "Loading the game…" : "Roblox is checking for updates…", progress: fast ? 85 : 70, foot: fast ? "Moony bootstrapper" : "Moony" });
    return { ok: true, as: accountId, fast };
  } catch (err) {
    return fail(err.message.replace(/^.*Error: /, ""), { expired: err.code === "EXPIRED" });
  }
}
let launchSplash = null;
let launchSplashTimer = null;

/* ---------- Roblox links (roblox-player: / roblox:) ----------
   Optional: Moony can be the app Windows uses for Roblox's Play links (like
   Fishstrap/Bloxstrap). The previous handler is saved so turning it off puts
   it back. */
const PROTOCOLS = ["roblox-player", "roblox"];
const protoBackup = () => path.join(app.getPath("userData"), "protocol-backup.json");
function regQuery(proto) {
  return new Promise((resolve) => execFile("reg", ["query", `HKCU\\Software\\Classes\\${proto}\\shell\\open\\command`, "/ve"], { windowsHide: true }, (err, out) => {
    const m = /REG_SZ\s+(.+)\s*$/m.exec(String(out || ""));
    resolve(err ? null : m ? m[1].trim() : null);
  }));
}
function regSet(proto, command) {
  return new Promise((resolve) => execFile("reg", ["add", `HKCU\\Software\\Classes\\${proto}\\shell\\open\\command`, "/ve", "/d", command, "/f"], { windowsHide: true }, () => resolve()));
}
const protoArgs = () => (process.defaultApp ? [path.resolve(process.argv[1])] : []);
async function setProtocolHandler(on) {
  if (on) {
    let backup = {};
    try { backup = JSON.parse(fs.readFileSync(protoBackup(), "utf8")); } catch { /* first time */ }
    for (const p of PROTOCOLS) {
      const cur = await regQuery(p);
      if (cur && !/moony|electron\.exe/i.test(cur)) backup[p] = cur; // remember Fishstrap/Roblox's handler
      app.setAsDefaultProtocolClient(p, process.execPath, protoArgs());
    }
    fs.writeFileSync(protoBackup(), JSON.stringify(backup, null, 2));
  } else {
    let backup = {};
    try { backup = JSON.parse(fs.readFileSync(protoBackup(), "utf8")); } catch { /* nothing saved */ }
    for (const p of PROTOCOLS) {
      app.removeAsDefaultProtocolClient(p, process.execPath, protoArgs());
      if (backup[p]) await regSet(p, backup[p]); // give it back to the previous app
    }
  }
  return isProtocolHandler();
}
const isProtocolHandler = () => PROTOCOLS.every((p) => app.isDefaultProtocolClient(p, process.execPath, protoArgs()));
ipcMain.handle("protocol:get", () => isProtocolHandler());
ipcMain.handle("protocol:set", (_e, on) => setProtocolHandler(!!on));

// A Roblox link was opened with Moony: launch it through Moony's bootstrapper.
async function handleRobloxLink(uri) {
  if (!/^roblox(-player)?:/i.test(String(uri))) return;
  if (/^roblox-player:/i.test(uri)) {
    const parts = Object.fromEntries(uri.replace(/^roblox-player:/i, "").split("+").map((kv) => { const i = kv.indexOf(":"); return [kv.slice(0, i), kv.slice(i + 1)]; }));
    const splash = new Splash({ parent: null, accent: appPrefs.accent || "#8b7dff", icon: path.join(__dirname, "..", "build", "icon.png") });
    launchSplash?.close();
    launchSplash = splash;
    clearTimeout(launchSplashTimer);
    launchSplashTimer = setTimeout(() => splash.close(), 45000);
    splash.set({ title: parts.launchmode === "app" ? "Roblox" : "Joining game", step: "Checking for Roblox updates…", progress: 8, foot: "Moony bootstrapper" });
    try {
      const mb = (n) => (n / 1e6).toFixed(n > 1e8 ? 0 : 1);
      const rbx = await rbxinstall.ensure((p) => p.total ? splash.set({ step: `${p.phase} ${mb(p.done)} / ${mb(p.total)} MB`, progress: 8 + (p.done / p.total) * 50 }) : splash.set({ step: p.phase, progress: null }), versionPrefs());
      splash.set({ channel: rbx.channel || "production", version: rbx.version || "" });
      if (splash.closed) return;
      splash.set({ step: "Starting Roblox…", progress: 70 });
      const exe = path.join(rbx.dir, "RobloxPlayerBeta.exe");
      const args = ["--app"];
      if (parts.gameinfo) args.push("-t", parts.gameinfo);
      if (parts.placelauncherurl) args.push("-j", decodeURIComponent(parts.placelauncherurl));
      if (parts.browsertrackerid) args.push("-b", parts.browsertrackerid);
      args.push(`--launchtime=${parts.launchtime || Date.now()}`, "--rloc", parts.robloxLocale || "en_us", "--gloc", parts.gameLocale || "en_us");
      spawn(exe, args, { cwd: rbx.dir, detached: true, stdio: "ignore" }).unref();
      splash.set({ step: parts.placelauncherurl ? "Loading the game…" : "Opening Roblox…", progress: 85 });
      if (!parts.placelauncherurl) splash.close(2500);
    } catch (e) {
      splash.set({ step: e.message, error: true, progress: 100 });
      splash.close(4000);
    }
  } else {
    // roblox://placeId=… deep link: launch as the active signed-in account.
    const q = new URLSearchParams(uri.replace(/^roblox:\/*/i, "").replace(/^\?/, ""));
    const placeId = q.get("placeId") || q.get("placeid");
    if (!placeId) return;
    launchHandler(null, { placeId, accountId: appPrefs.activeAccountId, jobId: q.get("gameInstanceId") || undefined, linkCode: q.get("linkCode") || undefined, name: "Roblox" });
  }
}
// Close the launch window once you're actually in the game.
function launchJoined() {
  if (!launchSplash || launchSplash.closed) return;
  launchSplash.set({ step: "You're in!", progress: 100 });
  launchSplash.close(700);
  clearTimeout(launchSplashTimer);
}

/* ---------- Roblox install + FastFlags ---------- */
function findPlayerDir() {
  // Moony's own Roblox install first (it's the one Moony launches).
  try { const own = require("./rbxinstall.cjs").anyInstalled(); if (own) return own; } catch { /* fall back */ }
  const root = path.join(process.env.LOCALAPPDATA || "", "Roblox", "Versions");
  if (!fs.existsSync(root)) return null;
  const dirs = fs.readdirSync(root)
    .map((d) => path.join(root, d))
    .filter((d) => fs.existsSync(path.join(d, "RobloxPlayerBeta.exe")))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] || null;
}

ipcMain.handle("roblox:install", () => {
  const dir = findPlayerDir();
  return dir ? { installed: true, version: path.basename(dir) } : { installed: false };
});

// Writes the frame-rate flag Roblox allows into ClientAppSettings.json.
// fps = 0 removes the override (Roblox default).
ipcMain.handle("roblox:set-fps", (_e, fps) => {
  const dir = findPlayerDir();
  if (!dir) return { ok: false, error: "Roblox Player isn't installed" };
  const n = Number(fps);
  if (!Number.isInteger(n) || n < 0 || n > 1000) return { ok: false, error: "Invalid FPS value" };
  // Goes through the FFlags store so the editor and this stay in sync.
  const store = readFlagStore();
  if (n === 0) delete store.flags.DFIntTaskSchedulerTargetFps;
  else store.flags.DFIntTaskSchedulerTargetFps = n;
  writeFlagsToRoblox(store);
  return { ok: true, version: path.basename(dir) };
});

ipcMain.handle("app:version", () => app.getVersion());

/* ---------- Play sessions, playtime and Discord status ---------- */
const { Tracker } = require("./tracker.cjs");
const { DiscordStatus } = require("./discord.cjs");
let tracker = null;
const discord = new DiscordStatus();
let discordPrefs = { enabled: false, clientId: "", showGame: true };
let nowPlaying = null; // { universeId, placeId, name, icon, startedAt }

const sendUI = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };

function updateDiscord() {
  if (!discordPrefs.enabled || !nowPlaying) return discord.set(null);
  const named = discordPrefs.showGame && nowPlaying.name;
  discord.set({
    details: named ? `Playing ${nowPlaying.name}`.slice(0, 128) : "Playing Roblox",
    state: "via Moony",
    startTimestamp: nowPlaying.startedAt,
    largeImageKey: named && nowPlaying.icon ? nowPlaying.icon : undefined,
    largeImageText: named ? nowPlaying.name.slice(0, 128) : undefined,
    buttons: named && nowPlaying.placeId ? [{ label: "View game", url: `https://www.roblox.com/games/${nowPlaying.placeId}` }] : undefined,
    instance: false,
  });
}

function startTracking() {
  tracker = new Tracker(app.getPath("userData"));
  tracker.on("start", async (s) => {
    launchJoined();
    nowPlaying = { universeId: s.universeId, placeId: s.placeId, jobId: s.jobId, name: null, icon: null, startedAt: s.startedAt };
    if (s.universeId) {
      try {
        const g = await roblox.gameDetails(s.universeId);
        nowPlaying = { ...nowPlaying, name: g.name, icon: g.icon };
        tracker.setMeta(s.universeId, { name: g.name, icon: g.icon, placeId: g.placeId });
      } catch { /* show without a name */ }
    }
    sendUI("game:now", nowPlaying);
    updateDiscord();
  });
  // Region of the server you're in, from the address in Roblox's log.
  tracker.on("server", async (s) => {
    const region = await roblox.ipRegion(s.ip).catch(() => null);
    if (nowPlaying && nowPlaying.jobId === s.jobId) { nowPlaying = { ...nowPlaying, region }; sendUI("game:now", nowPlaying); }
  });
  tracker.on("end", ({ reason, session }) => {
    // Left a game normally: close the Roblox app (instead of dropping you on
    // its home screen) and bring Moony back. Waits a few seconds so teleports
    // between places, which also "leave", don't close anything.
    if (reason === "left game" && appPrefs.autoCloseRoblox) {
      setTimeout(() => {
        if (tracker.current) return; // joined another place/server
        execFile("taskkill", ["/IM", "RobloxPlayerBeta.exe", "/F"], { windowsHide: true }, () => {
          if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
        });
      }, 4000);
    }
    const last = nowPlaying;
    nowPlaying = null;
    sendUI("game:now", null);
    updateDiscord();
    // Kicked or lost connection: offer to put you back in the same server.
    if (reason === "disconnected" && session?.jobId && session.placeId) {
      const info = { placeId: session.placeId, jobId: session.jobId, universeId: session.universeId, name: last?.name || "your game", icon: last?.icon || null };
      sendUI("game:disconnected", info);
      if (Notification.isSupported()) {
        const n = new Notification({ title: "Disconnected from Roblox", body: `Click to rejoin the same ${info.name} server.` });
        n.on("click", () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } sendUI("game:rejoin", info); });
        n.show();
      }
    }
  });
  tracker.on("update", (sum) => sendUI("playtime:update", sum));
  tracker.start();

  // Fill in names/icons for games recorded without them.
  (async () => {
    for (const [id, g] of Object.entries(tracker.data.games)) {
      if (g.name) continue;
      try { const d = await roblox.gameDetails(id); tracker.setMeta(id, { name: d.name, icon: d.icon, placeId: d.placeId }); } catch { /* try next launch */ }
    }
  })();
}

/* ---------- FFlags ---------- */
// Moony keeps your flags in %APPDATA%\Moony\fflags.json and writes them to
// Roblox's ClientAppSettings.json, again after every Roblox update.
const flagsFile = () => path.join(app.getPath("userData"), "fflags.json");
function readFlagStore() { try { return JSON.parse(fs.readFileSync(flagsFile(), "utf8")); } catch { return { flags: {}, appliedVersion: null }; } }
function writeFlagsToRoblox(store) {
  const dir = findPlayerDir();
  if (!dir) throw new Error("Roblox Player isn't installed");
  const folder = path.join(dir, "ClientSettings");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "ClientAppSettings.json"), JSON.stringify(store.flags, null, 2));
  store.appliedVersion = path.basename(dir);
  fs.writeFileSync(flagsFile(), JSON.stringify(store, null, 2));
  return store;
}
function flagStatus() {
  const store = readFlagStore();
  const dir = findPlayerDir();
  return { flags: store.flags, installed: !!dir, version: dir ? path.basename(dir) : null, upToDate: !!dir && store.appliedVersion === path.basename(dir) };
}
ipcMain.handle("fflags:get", () => flagStatus());
// Community FFlag presets, published on Moony's website so they can be updated
// without an app release. Falls back to the copy shipped with the app.
let presetCache = null;
ipcMain.handle("fflags:presets", async () => {
  if (presetCache && Date.now() - presetCache.at < 30 * 60e3) return presetCache.data;
  let data = null, online = false;
  try {
    const r = await fetch("https://moonylauncher.xyz/fflags.json", { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (r.ok) { const j = await r.json(); if (Array.isArray(j.presets)) { data = j; online = true; } }
  } catch { /* offline */ }
  if (!data) data = JSON.parse(fs.readFileSync(path.join(__dirname, "fflag-presets.json"), "utf8"));
  // Only plain flag names and simple values are accepted.
  data.presets = data.presets.filter((x) => x && typeof x.name === "string" && x.flags && typeof x.flags === "object")
    .map((x) => ({ ...x, flags: Object.fromEntries(Object.entries(x.flags).filter(([k, v]) => /^[A-Za-z][A-Za-z0-9_]{2,100}$/.test(k) && ["string", "number", "boolean"].includes(typeof v))) }));
  presetCache = { at: Date.now(), data: { ...data, online } };
  return presetCache.data;
});
ipcMain.handle("fflags:set", (_e, flags) => {
  if (!flags || typeof flags !== "object" || Array.isArray(flags)) throw new Error("Invalid flags");
  const clean = {};
  for (const [k, v] of Object.entries(flags)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{2,100}$/.test(k)) throw new Error(`Invalid flag name: ${k}`);
    if (!["string", "number", "boolean"].includes(typeof v)) throw new Error(`Invalid value for ${k}`);
    clean[k] = v;
  }
  const store = readFlagStore();
  store.flags = clean;
  fs.writeFileSync(flagsFile(), JSON.stringify(store, null, 2));
  writeFlagsToRoblox(store);
  return flagStatus();
});
function reapplyFlagsIfNeeded() {
  const store = readFlagStore();
  const dir = findPlayerDir();
  if (!dir || !Object.keys(store.flags).length || store.appliedVersion === path.basename(dir)) return false;
  try { writeFlagsToRoblox(store); return true; } catch { return false; }
}

/* ---------- Cosmetic mods ---------- */
const { Mods, KINDS } = require("./mods.cjs");
let mods = null;
const modsReady = () => (mods ||= new Mods(app.getPath("userData"), findPlayerDir));
ipcMain.handle("mods:status", () => modsReady().status());
ipcMain.handle("mods:pick", async (_e, kind) => {
  const k = KINDS[kind];
  if (!k) return { ok: false, error: "Unknown mod" };
  const r = await dialog.showOpenDialog(win, { title: `Choose a ${k.label.toLowerCase()} file`, properties: ["openFile"], filters: [{ name: k.label, extensions: k.ext.map((e) => e.slice(1)) }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false, cancelled: true };
  try { return { ok: true, status: modsReady().set(kind, r.filePaths[0]) }; }
  catch (err) { return { ok: false, error: err.message }; }
});
ipcMain.handle("mods:preset", (_e, kind, preset) => { try { return { ok: true, status: modsReady().setPreset(kind, preset) }; } catch (err) { return { ok: false, error: err.message }; } });
ipcMain.handle("mods:preview", (_e, kind) => modsReady().preview(kind));
ipcMain.handle("mods:remove", (_e, kind) => { try { return { ok: true, status: modsReady().remove(kind) }; } catch (err) { return { ok: false, error: err.message }; } });
ipcMain.handle("mods:apply", () => { try { return { ok: true, status: modsReady().apply() }; } catch (err) { return { ok: false, error: err.message }; } });
function watchMods() {
  const check = () => {
    if (modsReady().reapplyIfNeeded()) sendUI("mods:reapplied", modsReady().status());
    reapplyFlagsIfNeeded();
  };
  check();
  setInterval(check, 5 * 60 * 1000);
}

/* ---------- In-game HUD overlay ---------- */
const { Overlay } = require("./overlay.cjs");
const { Splash, canFastLaunch, directLaunch, latestVersion } = require("./bootstrapper.cjs");
const rbxinstall = require("./rbxinstall.cjs");
const { runSetup } = require("./setup.cjs");
const { startUpdater } = require("./updater.cjs");
const { Media } = require("./media.cjs");
const media = new Media();
media.on("change", (x) => { sendUI("media:change", x); overlay?.push(); });
ipcMain.handle("media:get", () => media.current);
let overlay = null;
let hudStatus = { roblox: false, showing: false, enabled: true };
function startOverlay() {
  overlay = new Overlay({
    devUrl: DEV_URL, distDir: path.join(__dirname, "..", "dist"),
    getNowPlaying: () => nowPlaying,
    getMedia: () => media.current,
    onStatus: (s) => { hudStatus = s; sendUI("hud:status", s); },
  });
  overlay.start();
}
ipcMain.handle("hud:status", () => hudStatus);
// The HUD editor's live visualiser preview listens to system audio too.
function allowLoopbackForMainWindow() {
  // Only Moony's own window uses the default session (the in-app Roblox page
  // windows use their own partitions), so this only ever serves Moony.
  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => {
    desktopCapturer.getSources({ types: ["screen"] }).then((s) => cb({ video: s[0], audio: "loopback" })).catch(() => cb({}));
  });
}

/* ---------- Roblox versions (Versions tab) ---------- */
const versionsFile = () => path.join(app.getPath("userData"), "versions.json");
function versionPrefs() { try { return JSON.parse(fs.readFileSync(versionsFile(), "utf8")); } catch { return {}; } }
function saveVersionPrefs(p) { fs.writeFileSync(versionsFile(), JSON.stringify({ ...versionPrefs(), ...p }, null, 2)); return versionPrefs(); }
ipcMain.handle("versions:info", async (_e, channel) => {
  const prefs = versionPrefs();
  let latest = null, error = null;
  try { latest = await rbxinstall.latest(channel ?? prefs.channel); } catch (e) { error = e.message; }
  return { latest, error, pinned: prefs.pinned || null, channel: prefs.channel || "production", installed: rbxinstall.list(), folder: rbxinstall.root() };
});
ipcMain.handle("versions:install", async (e, guid) => {
  const send = (p) => { if (!e.sender.isDestroyed()) e.sender.send("versions:progress", { guid, ...p }); };
  try { await rbxinstall.install(String(guid).trim(), String(guid).trim(), send, true); send({ phase: "done" }); return { ok: true, list: rbxinstall.list() }; }
  catch (err) { send({ phase: "error", error: err.message }); return { ok: false, error: err.message }; }
});
ipcMain.handle("versions:pin", (_e, guid) => {
  if (guid && !rbxinstall.GUID.test(guid)) return { ok: false, error: "Not a version hash" };
  return { ok: true, prefs: saveVersionPrefs({ pinned: guid ? guid.toLowerCase() : null }) };
});
ipcMain.handle("versions:channel", (_e, ch) => {
  const c = String(ch || "production").trim();
  if (!/^[a-z0-9_-]{1,40}$/i.test(c)) return { ok: false, error: "Invalid channel name" };
  return { ok: true, prefs: saveVersionPrefs({ channel: c.toLowerCase() === "live" ? "production" : c }) };
});
ipcMain.handle("versions:remove", (_e, guid) => {
  if (versionPrefs().pinned === guid) saveVersionPrefs({ pinned: null });
  return { ok: rbxinstall.remove(guid), list: rbxinstall.list() };
});
ipcMain.handle("versions:open", (_e, guid) => { const v = rbxinstall.list().find((x) => x.guid === guid); if (v) shell.openPath(v.dir); return !!v; });

/* ---------- Preferences the main process needs ---------- */
let appPrefs = { autoCloseRoblox: true };
// Scale is done with CSS in the page; keep Chromium's own zoom at 100% (it's
// shared by every page from the same origin) and grow the minimum window size
// so a larger scale never squeezes the layout.
ipcMain.handle("ui:zoom", (_e, f) => {
  const z = Number(f);
  if (!win || win.isDestroyed() || !(z >= 0.5 && z <= 2)) return false;
  win.webContents.setZoomFactor(1);
  const [mw, mh] = [Math.round(1000 * Math.max(1, z)), Math.round(640 * Math.max(1, z))];
  win.setMinimumSize(mw, mh);
  const [w, h] = win.getSize();
  if (!win.isMaximized() && (w < mw || h < mh)) win.setSize(Math.max(w, mw), Math.max(h, mh));
  return true;
});
ipcMain.handle("prefs:set", (_e, p) => {
  appPrefs = { ...appPrefs, accent: /^#[0-9a-f]{6}$/i.test(p?.accent || "") ? p.accent : appPrefs.accent, autoCloseRoblox: !!p?.autoCloseRoblox, activeAccountId: /^d+$/.test(String(p?.activeAccountId)) ? Number(p.activeAccountId) : null };
  overlay?.setPrefs?.(p?.hud);
  // The music reader only runs while the visualiser widget is switched on.
  if (p?.hud?.enabled && p.hud.widgets?.visualizer?.on) media.start(); else media.stop();
  return true;
});

/* ---------- Game update alerts ---------- */
// The UI sends the favorite games to watch; every 15 minutes Moony checks
// whether any was updated since last time and shows a notification.
let watchList = [];
const updatesFile = () => path.join(app.getPath("userData"), "game-updates.json");
async function checkUpdates() {
  if (!watchList.length) return;
  let seen = {};
  try { seen = JSON.parse(fs.readFileSync(updatesFile(), "utf8")); } catch { /* first run */ }
  for (const id of watchList.slice(0, 50)) {
    try {
      const g = await roblox.gameDetails(id);
      const prev = seen[id];
      seen[id] = g.updated;
      if (prev && g.updated && new Date(g.updated) > new Date(prev) && Notification.isSupported()) {
        const n = new Notification({ title: `${g.name} just updated`, body: "Click to see what's new." });
        n.on("click", () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } sendUI("game:open", { universeId: g.universeId, placeId: g.placeId, name: g.name, icon: g.icon }); });
        n.show();
      }
    } catch { /* skip this one */ }
  }
  fs.writeFileSync(updatesFile(), JSON.stringify(seen));
}
ipcMain.handle("updates:watch", (_e, ids, enabled) => {
  watchList = enabled ? (ids || []).filter((x) => /^\d+$/.test(String(x))).map(Number) : [];
  checkUpdates();
  return true;
});
setInterval(() => checkUpdates(), 15 * 60 * 1000);

/* ---------- Friend alerts (Windows notifications) ---------- */
ipcMain.handle("notify:friend", async (_e, n) => {
  if (!Notification.isSupported()) return false;
  let icon;
  try {
    if (/^https:\/\/[a-z0-9.-]*rbxcdn\.com\//i.test(n.icon || "")) {
      const res = await net.fetch(n.icon);
      icon = nativeImage.createFromBuffer(Buffer.from(await res.arrayBuffer()));
    }
  } catch { /* no avatar */ }
  const note = new Notification({ title: String(n.title).slice(0, 120), body: String(n.body).slice(0, 240), icon, silent: false });
  note.on("click", () => {
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
    sendUI("notify:click", { userId: n.userId, canJoin: !!n.canJoin });
  });
  note.show();
  return true;
});

ipcMain.handle("playtime:get", () => ({ ...(tracker?.summary() ?? { games: {}, days: {} }), now: nowPlaying }));
ipcMain.handle("discord:configure", async (_e, prefs) => {
  discordPrefs = { enabled: !!prefs?.enabled, clientId: String(prefs?.clientId || "").trim(), showGame: prefs?.showGame !== false };
  const state = await discord.configure(discordPrefs.enabled ? discordPrefs.clientId : null);
  updateDiscord();
  return state;
});
ipcMain.handle("discord:status", () => discord.state);

app.whenReady().then(() => {
  protocol.handle("moony-shot", (req) => {
    const u = new URL(req.url);
    const dir = shotDirs()[SHOT_KINDS.indexOf(u.hostname)];
    const name = path.basename(decodeURIComponent(u.pathname));
    if (!dir || !/.(png|jpe?g|mp4|webm)$/i.test(name)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(path.join(dir, name)).toString());
  });
  if (IS_SETUP) return runSetup(); // the installer / uninstaller (see setup.cjs)
  bootStartup(); createWindow(); startTracking(); watchMods(); prefetchGenres(); startOverlay(); allowLoopbackForMainWindow();
  startUpdater(() => win);
  // Opened by a Roblox link?
  const link = process.argv.find((a) => /^roblox(-player)?:/i.test(a));
  if (link) setTimeout(() => handleRobloxLink(link), 500);
});
app.on("before-quit", () => { tracker?.stop(); discord.disconnect(); overlay?.stop(); media.stop(); });
app.on("window-all-closed", () => app.quit());
