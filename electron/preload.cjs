const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orbit", {
  update: { get: () => ipcRenderer.invoke("update:get"), check: () => ipcRenderer.invoke("update:check"), apply: () => ipcRenderer.invoke("update:apply"), onState: (cb) => { const f = (_e, s) => cb(s); ipcRenderer.on("update:state", f); return () => ipcRenderer.removeListener("update:state", f); } },
  isDesktop: true,
  win: {
    minimize: () => ipcRenderer.send("win:minimize"),
    toggleMaximize: () => ipcRenderer.send("win:toggle-maximize"),
    close: () => ipcRenderer.send("win:close"),
    isMaximized: () => ipcRenderer.invoke("win:is-maximized"),
    onMaximized: (cb) => {
      const h = (_e, v) => cb(v);
      ipcRenderer.on("win:maximized", h);
      return () => ipcRenderer.removeListener("win:maximized", h);
    },
    resizeStart: (edge) => ipcRenderer.send("win:resize-start", edge),
    resizeMove: () => ipcRenderer.send("win:resize-move"),
    resizeEnd: () => ipcRenderer.send("win:resize-end"),
  },
  api: (method, ...args) => ipcRenderer.invoke("roblox:api", method, ...args),
  launch: (opts) => ipcRenderer.invoke("roblox:launch", opts),
  install: () => ipcRenderer.invoke("roblox:install"),
  setFps: (fps) => ipcRenderer.invoke("roblox:set-fps", fps),
  playtime: {
    get: () => ipcRenderer.invoke("playtime:get"),
    onUpdate: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("playtime:update", h); return () => ipcRenderer.removeListener("playtime:update", h); },
    onNow: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("game:now", h); return () => ipcRenderer.removeListener("game:now", h); },
  },
  avatar: {
    model3d: (accountId, userId) => ipcRenderer.invoke("avatar:3d", accountId, userId),
    state: (accountId) => ipcRenderer.invoke("avatar:state", accountId),
    inventory: (accountId, kind, cursor) => ipcRenderer.invoke("avatar:inventory", accountId, kind, cursor),
    outfits: (accountId) => ipcRenderer.invoke("avatar:outfits", accountId),
    wear: (accountId, assets) => ipcRenderer.invoke("avatar:wear", accountId, assets),
    setType: (accountId, type) => ipcRenderer.invoke("avatar:type", accountId, type),
    wearOutfit: (accountId, outfitId) => ipcRenderer.invoke("avatar:outfit", accountId, outfitId),
  },
  openRobloxPage: (accountId, url) => ipcRenderer.invoke("roblox:page", accountId, url),
  setPrefs: (p) => ipcRenderer.invoke("prefs:set", p),
  setZoom: (f) => ipcRenderer.invoke("ui:zoom", f),
  protocol: { get: () => ipcRenderer.invoke("protocol:get"), set: (on) => ipcRenderer.invoke("protocol:set", on) },
  media: {
    get: () => ipcRenderer.invoke("media:get"),
    onChange: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("media:change", h); return () => ipcRenderer.removeListener("media:change", h); },
  },
  hud: {
    status: () => ipcRenderer.invoke("hud:status"),
    onStatus: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("hud:status", h); return () => ipcRenderer.removeListener("hud:status", h); },
  },
  market: {
    details: (accountId, item) => ipcRenderer.invoke("market:details", accountId, item),
    buy: (accountId, item, expectedPrice) => ipcRenderer.invoke("market:buy", accountId, item, expectedPrice),
  },
  chat: {
    conversations: (accountId, cursor) => ipcRenderer.invoke("chat:conversations", accountId, cursor),
    messages: (accountId, conversationId, cursor) => ipcRenderer.invoke("chat:messages", accountId, conversationId, cursor),
    send: (accountId, conversationId, text) => ipcRenderer.invoke("chat:send", accountId, conversationId, text),
    markRead: (accountId, conversationId) => ipcRenderer.invoke("chat:read", accountId, conversationId),
    start: (accountId, userId) => ipcRenderer.invoke("chat:start", accountId, userId),
  },
  gameView: {
    frame: (width) => ipcRenderer.invoke("gameview:frame", width),
    shots: () => ipcRenderer.invoke("gameview:shots"),
    openFolder: () => ipcRenderer.invoke("gameview:folder"),
    save: (dataUrl) => ipcRenderer.invoke("gameview:save", dataUrl),
  },
  feedback: {
    send: (payload) => ipcRenderer.invoke("feedback:send", payload),
  },
  fflags: {
    get: () => ipcRenderer.invoke("fflags:get"),
    set: (flags) => ipcRenderer.invoke("fflags:set", flags),
  },
  game: {
    onDisconnected: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("game:disconnected", h); return () => ipcRenderer.removeListener("game:disconnected", h); },
    onRejoin: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("game:rejoin", h); return () => ipcRenderer.removeListener("game:rejoin", h); },
    onOpen: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("game:open", h); return () => ipcRenderer.removeListener("game:open", h); },
    watchUpdates: (ids, enabled) => ipcRenderer.invoke("updates:watch", ids, enabled),
  },
  mods: {
    status: () => ipcRenderer.invoke("mods:status"),
    pick: (kind) => ipcRenderer.invoke("mods:pick", kind),
    remove: (kind) => ipcRenderer.invoke("mods:remove", kind),
    preset: (kind, preset) => ipcRenderer.invoke("mods:preset", kind, preset),
    preview: (kind) => ipcRenderer.invoke("mods:preview", kind),
    apply: () => ipcRenderer.invoke("mods:apply"),
    onReapplied: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("mods:reapplied", h); return () => ipcRenderer.removeListener("mods:reapplied", h); },
  },
  notify: {
    friend: (n) => ipcRenderer.invoke("notify:friend", n),
    onClick: (cb) => { const h = (_e, v) => cb(v); ipcRenderer.on("notify:click", h); return () => ipcRenderer.removeListener("notify:click", h); },
  },
  discord: {
    configure: (prefs) => ipcRenderer.invoke("discord:configure", prefs),
    status: () => ipcRenderer.invoke("discord:status"),
  },
  auth: {
    login: () => ipcRenderer.invoke("auth:login"),
    logout: (userId) => ipcRenderer.invoke("auth:logout", userId),
    sessions: () => ipcRenderer.invoke("auth:sessions"),
    restore: () => ipcRenderer.invoke("auth:restore"),
    onExpired: (cb) => { const h = (_e, id) => cb(id); ipcRenderer.on("auth:expired", h); return () => ipcRenderer.removeListener("auth:expired", h); },
    friends: (userId) => ipcRenderer.invoke("auth:friends", userId),
    robux: (userId) => ipcRenderer.invoke("auth:robux", userId),
    region: (userId, placeId, jobId) => ipcRenderer.invoke("auth:region", userId, placeId, jobId),
    resolveLink: (userId, code) => ipcRenderer.invoke("auth:resolve-link", userId, code),
  },
});
