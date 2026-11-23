// Roblox public web API client. Runs in Node (Electron main process, or the
// Vite dev server for browser previews) so there are no CORS limits.
// Only unauthenticated endpoints are used here. Anything that needs a signed-in
// session (friends list, presence details, launching as a specific account)
// is an integration point for later.

const crypto = require("crypto");
const cache = new Map();
const TTL = 5 * 60 * 1000;

async function get(url, opts) {
  const key = url + (opts?.body ?? "");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.v;
  let res;
  // Roblox rate-limits bursts (429): wait and retry a few times.
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, { signal: AbortSignal.timeout(15000), ...opts, headers: { "content-type": "application/json", ...(opts?.headers || {}) } });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 1200 * 2 ** attempt));
  }
  if (!res.ok) throw new Error(`Roblox API ${res.status} for ${new URL(url).pathname}`);
  const v = await res.json();
  cache.set(key, { t: Date.now(), v });
  return v;
}

// Thumbnails: Roblox answers "Pending" (no image yet) while it renders one.
// Ask again for just those a few times, and never cache an incomplete answer.
async function thumbs(kind, ids, size) {
  const out = {};
  let todo = [...new Set(ids)].filter(Boolean);
  const param = kind === "bundles" ? "bundleIds" : "assetIds";
  const path = kind === "bundles" ? "bundles/thumbnails" : "assets";
  for (let attempt = 0; attempt < 4 && todo.length; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 900 * attempt));
    for (let i = 0; i < todo.length; i += 100) {
      const part = todo.slice(i, i + 100);
      const res = await fetch(`https://thumbnails.roblox.com/v1/${path}?${param}=${part.join(",")}&size=${size}&format=Webp`, { signal: AbortSignal.timeout(12000) }).catch(() => null);
      const j = res?.ok ? await res.json().catch(() => null) : null;
      for (const t of j?.data || []) if (t.state === "Completed" && t.imageUrl) out[t.targetId] = t.imageUrl;
    }
    todo = todo.filter((id) => !out[id]);
  }
  return out;
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function thumbnails(universeIds) {
  const out = {};
  for (const ids of chunk(universeIds, 50)) {
    const [banners, icons] = await Promise.all([
      get(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${ids.join(",")}&countPerUniverse=1&size=768x432&format=Webp`),
      get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${ids.join(",")}&size=512x512&format=Webp`),
    ]);
    for (const b of banners.data) out[b.universeId] = { banner: b.thumbnails?.[0]?.imageUrl ?? null };
    for (const i of icons.data) out[i.targetId] = { ...(out[i.targetId] || {}), icon: i.imageUrl ?? null };
  }
  return out;
}

// Descriptions + creators aren't in list endpoints; batch-fetch them.
async function info(universeIds) {
  const out = {};
  for (const ids of chunk(universeIds, 50)) {
    const r = await get(`https://games.roblox.com/v1/games?universeIds=${ids.join(",")}`);
    for (const g of r.data) out[g.id] = { description: g.description || "", creator: g.creator?.name || "", verified: !!g.creator?.hasVerifiedBadge, visits: g.visits, genre: g.genre_l1 || null };
  }
  return out;
}

async function enrich(universeIds) {
  const [thumbs, meta] = await Promise.all([thumbnails(universeIds), info(universeIds).catch(() => ({}))]);
  for (const id of universeIds) thumbs[id] = { ...(thumbs[id] || {}), ...(meta[id] || {}) };
  return thumbs;
}

function shapeGame(g, thumbs) {
  const up = g.totalUpVotes ?? 0, down = g.totalDownVotes ?? 0;
  return {
    universeId: g.universeId,
    placeId: g.rootPlaceId,
    name: g.name,
    playing: g.playerCount ?? 0,
    rating: up + down ? Math.round((up / (up + down)) * 100) : null,
    genre: g.genreL1 || thumbs[g.universeId]?.genre || null,
    maturity: g.ageRecommendationDisplayName || null,
    icon: thumbs[g.universeId]?.icon ?? null,
    banner: thumbs[g.universeId]?.banner ?? null,
    description: thumbs[g.universeId]?.description ?? "",
    creator: thumbs[g.universeId]?.creator ?? "",
    verified: thumbs[g.universeId]?.verified ?? false,
  };
}

async function sorts() {
  const r = await get("https://apis.roblox.com/explore-api/v1/get-sorts?sessionId=orbit&device=computer");
  const list = r.sorts.filter((s) => s.contentType === "Games" && s.games?.length);
  const ids = [...new Set(list.flatMap((s) => s.games.map((g) => g.universeId)))];
  const thumbs = await enrich(ids);
  return list.map((s) => ({
    id: s.sortId,
    title: s.sortDisplayName,
    games: s.games.filter((g) => !g.isSponsored).map((g) => shapeGame(g, thumbs)),
  }));
}

async function search(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  const r = await get(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&sessionId=orbit&pageType=all`);
  const games = r.searchResults.filter((x) => x.contentGroupType === "Game").flatMap((x) => x.contents).slice(0, 40);
  const thumbs = await enrich(games.map((g) => g.universeId));
  return games.map((g) => shapeGame(g, thumbs));
}

// Search with paging (40 per page, up to `pages` pages).
async function searchMany(query, pages = 3) {
  const q = String(query || "").trim();
  if (!q) return [];
  let token = "", all = [];
  for (let p = 0; p < pages; p++) {
    const r = await get(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&sessionId=orbit&pageType=all${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`);
    all = all.concat(r.searchResults.filter((x) => x.contentGroupType === "Game").flatMap((x) => x.contents));
    token = r.nextPageToken;
    if (!token) break;
  }
  const seen = new Set();
  all = all.filter((g) => !seen.has(g.universeId) && seen.add(g.universeId));
  const thumbs = await enrich(all.map((g) => g.universeId));
  return all.map((g) => shapeGame(g, thumbs));
}

// Roblox has no genre filter, so a genre page combines the genre's games
// from every chart with a keyword search for that genre.
const GENRE_WORDS = {
  "Action": ["action", "fighting", "battlegrounds", "combat"], "Adventure": ["adventure", "explore", "story", "quest"],
  "Entertainment": ["entertainment", "music", "showcase", "concert"], "Obby & Platformer": ["obby", "parkour", "tower", "difficulty chart"],
  "Party & Casual": ["party games", "minigames", "casual", "trivia"], "Puzzle": ["puzzle", "escape room", "word game", "maze"],
  "RPG": ["rpg", "anime", "dungeon", "sword", "magic"], "Roleplay & Avatar Sim": ["roleplay", "rp", "life", "town", "school"],
  "Shooter": ["shooter", "fps", "gun", "sniper"], "Shopping": ["shopping", "avatar shop", "outfit", "ugc"],
  "Simulation": ["simulator", "tycoon", "clicker", "idle"], "Social": ["hangout", "chill", "vibe", "social"],
  "Sports & Racing": ["racing", "soccer", "basketball", "cars"], "Strategy": ["strategy", "tower defense", "war", "chess"],
  "Survival": ["survival", "horror", "zombie", "disaster"], "Education": ["learning", "education", "quiz", "math"], "Utility & Other": ["tools", "utility", "test"],
};
async function genreGames(genre) {
  const words = GENRE_WORDS[genre] || [genre];
  const [charts, ...found] = await Promise.all([sorts(), ...words.map((w) => searchMany(w, 2).catch(() => []))]);
  const seen = new Set();
  const fromCharts = charts.flatMap((s) => s.games).filter((g) => g.genre === genre);
  return [...fromCharts, ...found.flat().filter((g) => g.genre === genre)]
    .filter((g) => !seen.has(g.universeId) && seen.add(g.universeId))
    .sort((a, b) => b.playing - a.playing);
}

async function gameDetails(universeId) {
  const id = Number(universeId);
  const [d, thumbs] = await Promise.all([get(`https://games.roblox.com/v1/games?universeIds=${id}`), thumbnails([id])]);
  const g = d.data[0];
  if (!g) throw new Error("Game not found");
  let votes = null;
  try {
    const v = await get(`https://games.roblox.com/v1/games/votes?universeIds=${id}`);
    const x = v.data[0];
    votes = x.upVotes + x.downVotes ? Math.round((x.upVotes / (x.upVotes + x.downVotes)) * 100) : null;
  } catch { /* votes are optional */ }
  return {
    universeId: g.id,
    placeId: g.rootPlaceId,
    name: g.name,
    description: g.description || "",
    creator: { name: g.creator.name, type: g.creator.type, verified: g.creator.hasVerifiedBadge },
    playing: g.playing,
    visits: g.visits,
    favorites: g.favoritedCount,
    maxPlayers: g.maxPlayers,
    genre: g.genre_l1 || g.genre || null,
    updated: g.updated,
    created: g.created,
    rating: votes,
    icon: thumbs[id]?.icon ?? null,
    banner: thumbs[id]?.banner ?? null,
  };
}

async function headshots(userIds) {
  if (!userIds.length) return {};
  const r = await get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userIds.join(",")}&size=150x150&format=Webp`);
  return Object.fromEntries(r.data.map((x) => [x.targetId, x.imageUrl]));
}

async function lookupUser(username) {
  const r = await get("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    body: JSON.stringify({ usernames: [String(username).trim()], excludeBannedUsers: true }),
  });
  const u = r.data[0];
  if (!u) throw new Error(`No Roblox user named "${username}"`);
  const heads = await headshots([u.id]);
  return { id: u.id, name: u.name, displayName: u.displayName, verified: u.hasVerifiedBadge, avatar: heads[u.id] ?? null };
}

async function searchUsers(keyword) {
  const k = String(keyword || "").trim();
  if (k.length < 3) return [];
  const r = await get(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(k)}&limit=25`);
  const heads = await headshots(r.data.map((u) => u.id));
  return r.data.map((u) => ({ id: u.id, name: u.name, displayName: u.displayName, verified: u.hasVerifiedBadge, avatar: heads[u.id] ?? null }));
}

async function presence(userIds) {
  if (!userIds.length) return {};
  const r = await get("https://presence.roblox.com/v1/presence/users", { method: "POST", body: JSON.stringify({ userIds: userIds.map(Number) }) });
  const label = ["Offline", "Online", "In game", "In Studio", "Invisible"];
  return Object.fromEntries(r.userPresences.map((p) => [p.userId, { type: p.userPresenceType, label: label[p.userPresenceType] ?? "Offline", lastLocation: p.lastLocation, placeId: p.rootPlaceId || p.placeId || null }]));
}

// Public servers for a place. `ping` and `fps` are what Roblox reports for the
// server itself (average player ping, server frame rate), not ping from this PC.
async function servers(placeId, { order = "Desc", cursor = "", hideFull = true } = {}) {
  const id = Number(placeId);
  const q = new URLSearchParams({ limit: "100", sortOrder: order === "Asc" ? "Asc" : "Desc", excludeFullGames: String(!!hideFull) });
  if (cursor) q.set("cursor", cursor);
  const url = `https://games.roblox.com/v1/games/${id}/servers/Public?${q}`;
  // Server lists change quickly, so cache briefly; Roblox rate-limits this
  // endpoint hard, so back off and retry before giving up.
  const hit = serverCache.get(url);
  if (hit && Date.now() - hit.t < 20000) return hit.v;
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url);
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
  }
  if (res.status === 429) throw new Error("Roblox is rate-limiting server lists. Wait a few seconds and try again");
  if (!res.ok) throw new Error(`Roblox API ${res.status} for servers`);
  const j = await res.json();
  const v = {
    next: j.nextPageCursor || null,
    servers: j.data.map((s) => ({ id: s.id, playing: s.playing ?? 0, max: s.maxPlayers, ping: s.ping ?? null, fps: s.fps != null ? Math.round(s.fps) : null })),
  };
  serverCache.set(url, { t: Date.now(), v });
  return v;
}
const serverCache = new Map();

async function placeUniverse(placeId) {
  const r = await get(`https://apis.roblox.com/universes/v1/places/${Number(placeId)}/universe`);
  return r.universeId ?? null;
}

// Full-body 2D avatar picture (public).
async function avatarImage(userId) {
  const r = await get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${Number(userId)}&size=420x420&format=Webp`);
  return r.data?.[0]?.state === "Completed" ? r.data[0].imageUrl : null;
}

/* ---------- Profiles ---------- */
async function userProfile(userId) {
  const id = Number(userId);
  const [u, avatar, head, friendsN, followersN, followingN, favs] = await Promise.all([
    get(`https://users.roblox.com/v1/users/${id}`),
    get(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${id}&size=420x420&format=Webp`).catch(() => null),
    headshots([id]).catch(() => ({})),
    get(`https://friends.roblox.com/v1/users/${id}/friends/count`).catch(() => null),
    get(`https://friends.roblox.com/v1/users/${id}/followers/count`).catch(() => null),
    get(`https://friends.roblox.com/v1/users/${id}/followings/count`).catch(() => null),
    get(`https://games.roblox.com/v2/users/${id}/favorite/games?limit=10`).catch(() => ({ data: [] })),
  ]);
  const favIds = favs.data.map((g) => g.id);
  const thumbs = favIds.length ? await thumbnails(favIds).catch(() => ({})) : {};
  return {
    id: u.id, name: u.name, displayName: u.displayName, verified: u.hasVerifiedBadge, banned: u.isBanned,
    description: u.description || "", created: u.created,
    avatar: avatar?.data?.[0]?.imageUrl ?? null, headshot: head[id] ?? null,
    friends: friendsN?.count ?? null, followers: followersN?.count ?? null, following: followingN?.count ?? null,
    favoriteGames: favs.data.map((g) => ({ universeId: g.id, placeId: g.rootPlace?.id, name: g.name, icon: thumbs[g.id]?.icon ?? null, banner: thumbs[g.id]?.banner ?? null, playing: null, rating: null })),
  };
}

/* ---------- Game page extras ---------- */
async function gameMedia(universeId) {
  const r = await get(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${Number(universeId)}&countPerUniverse=10&size=768x432&format=Webp`);
  return (r.data[0]?.thumbnails || []).filter((t) => t.state === "Completed").map((t) => t.imageUrl);
}

async function badges(universeId, userId) {
  const r = await get(`https://badges.roblox.com/v1/universes/${Number(universeId)}/badges?limit=100&sortOrder=Asc`);
  const list = r.data.filter((b) => b.enabled);
  if (!list.length) return [];
  const icons = {};
  for (const part of chunk(list.map((b) => b.id), 100)) {
    const t = await get(`https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${part.join(",")}&size=150x150&format=Webp`).catch(() => ({ data: [] }));
    for (const x of t.data) icons[x.targetId] = x.imageUrl;
  }
  const owned = {};
  if (userId) {
    for (const part of chunk(list.map((b) => b.id), 100)) {
      const o = await get(`https://badges.roblox.com/v1/users/${Number(userId)}/badges/awarded-dates?badgeIds=${part.join(",")}`).catch(() => ({ data: [] }));
      for (const x of o.data) owned[x.badgeId] = x.awardedDate;
    }
  }
  return list.map((b) => ({
    id: b.id, name: b.displayName || b.name, description: b.displayDescription || b.description || "",
    icon: icons[b.id] ?? null, awarded: b.statistics?.awardedCount ?? 0, winRate: b.statistics?.winRatePercentage ?? 0,
    owned: owned[b.id] ?? null,
  }));
}

/* ---------- Marketplace ---------- */
const CATALOG_CATS = { all: 1, accessories: 11, clothing: 3, bodyparts: 4, animations: 12, heads: 4 };
async function catalog({ keyword = "", category = "all", sort = "relevance", cursor = "", minPrice, maxPrice } = {}) {
  const q = new URLSearchParams({ Category: String(CATALOG_CATS[category] ?? 1), Limit: "30" });
  const sorts = { relevance: 0, favorited: 1, sales: 2, updated: 3, priceLow: 4, priceHigh: 5 };
  q.set("SortType", String(sorts[sort] ?? 0));
  if (sort === "priceLow") q.set("SortAggregation", "5");
  if (keyword) q.set("Keyword", String(keyword).slice(0, 100));
  if (cursor) q.set("Cursor", cursor);
  if (minPrice != null && minPrice !== "") q.set("MinPrice", String(Number(minPrice)));
  if (maxPrice != null && maxPrice !== "") q.set("MaxPrice", String(Number(maxPrice)));
  const r = await get(`https://catalog.roblox.com/v1/search/items/details?${q}`);
  const assets = r.data.filter((x) => x.itemType === "Asset").map((x) => x.id);
  const bundles = r.data.filter((x) => x.itemType === "Bundle").map((x) => x.id);
  const img = {};
  const [ai, bi] = await Promise.all([assets.length ? thumbs("assets", assets, "420x420") : {}, bundles.length ? thumbs("bundles", bundles, "420x420") : {}]);
  for (const [id, u] of Object.entries(ai)) img["Asset" + id] = u;
  for (const [id, u] of Object.entries(bi)) img["Bundle" + id] = u;
  return {
    next: r.nextPageCursor || null,
    items: r.data.map((x) => ({
      id: x.id, type: x.itemType, name: x.name, description: x.description || "", creator: x.creatorName, creatorVerified: x.creatorHasVerifiedBadge,
      price: x.lowestPrice ?? x.price ?? null, offSale: x.price == null && !x.lowestPrice, limited: (x.itemRestrictions || []).some((r) => /Limited/i.test(r)),
      favorites: x.favoriteCount ?? 0, image: img[x.itemType + x.id] ?? null,
    })),
  };
}

/* ---------- Server region ---------- */
const regionCache = new Map();
async function ipRegion(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  if (regionCache.has(ip)) return regionCache.get(ip);
  const r = await fetch(`http://ip-api.com/json/${ip}?fields=status,countryCode,regionName,city`).then((x) => x.json()).catch(() => null);
  const v = r?.status === "success" ? { country: r.countryCode, region: r.regionName, city: r.city } : null;
  regionCache.set(ip, v);
  return v;
}

/* ---------- Signed-in calls ----------
   `cookie` is the account's .ROBLOSECURITY value. It only ever lives in the
   Electron main process and is sent only to roblox.com hosts. */

async function authed(cookie, url, opts = {}) {
  const send = (csrf) => fetch(url, {
    signal: AbortSignal.timeout(20000),
    ...opts,
    headers: {
      "content-type": "application/json",
      cookie: `.ROBLOSECURITY=${cookie}`,
      referer: "https://www.roblox.com/",
      origin: "https://www.roblox.com",
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      ...(opts.headers || {}),
    },
  });
  let res = await send();
  // Roblox asks for a CSRF token on POSTs: retry once with the one it gives back.
  if (res.status === 403 && res.headers.get("x-csrf-token")) res = await send(res.headers.get("x-csrf-token"));
  noticeRotation(cookie, res);
  if (res.status === 401) throw Object.assign(new Error("Session expired, sign in again"), { code: "EXPIRED" });
  return res;
}

// Roblox periodically replaces the session token and sends the new one in a
// Set-Cookie header; the old one stops working later. Hand any new token to
// the main process so it's saved, otherwise you get signed out.
let rotationHandler = null;
function onCookieRotated(fn) { rotationHandler = fn; }
function noticeRotation(oldCookie, res) {
  const headers = res.headers.getSetCookie?.() || [];
  for (const h of headers) {
    const m = /^\.ROBLOSECURITY=([^;]+)/.exec(h);
    if (m && m[1] && m[1] !== oldCookie && !/expires=Thu, 01 Jan 1970/i.test(h)) rotationHandler?.(oldCookie, m[1]);
  }
}

async function me(cookie) {
  const res = await authed(cookie, "https://users.roblox.com/v1/users/authenticated");
  if (!res.ok) throw new Error(`Couldn't verify account (${res.status})`);
  const u = await res.json();
  const heads = await headshots([u.id]);
  return { id: u.id, name: u.name, displayName: u.displayName, avatar: heads[u.id] ?? null };
}

async function friends(cookie, userId) {
  const res = await authed(cookie, `https://friends.roblox.com/v1/users/${Number(userId)}/friends`);
  if (!res.ok) throw new Error(`Couldn't load friends (${res.status})`);
  const ids = (await res.json()).data.map((f) => f.id);
  if (!ids.length) return [];
  const users = {};
  for (const part of chunk(ids, 100)) {
    const r = await fetch("https://users.roblox.com/v1/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userIds: part, excludeBannedUsers: true }) });
    if (r.ok) for (const u of (await r.json()).data) users[u.id] = u;
  }
  const heads = {};
  for (const part of chunk(ids, 100)) Object.assign(heads, await headshots(part).catch(() => ({})));
  const pres = {};
  const label = ["Offline", "Online", "In game", "In Studio", "Invisible"];
  for (const part of chunk(ids, 50)) {
    const r = await authed(cookie, "https://presence.roblox.com/v1/presence/users", { method: "POST", body: JSON.stringify({ userIds: part }) });
    if (r.ok) for (const p of (await r.json()).userPresences) pres[p.userId] = { type: p.userPresenceType, label: label[p.userPresenceType] ?? "Offline", lastLocation: p.lastLocation, placeId: p.rootPlaceId || p.placeId || null, gameId: p.gameId || null };
  }
  return ids.filter((id) => users[id]).map((id) => ({
    id, name: users[id].name, displayName: users[id].displayName, verified: users[id].hasVerifiedBadge,
    avatar: heads[id] ?? null, presence: pres[id] ?? { type: 0, label: "Offline" },
  }));
}

// One-time ticket the Roblox player exchanges for a session, the same flow
// roblox.com's own Play button uses.
async function authTicket(cookie) {
  const res = await authed(cookie, "https://auth.roblox.com/v1/authentication-ticket/", { method: "POST", body: "{}" });
  const ticket = res.headers.get("rbx-authentication-ticket");
  if (!ticket) throw new Error(`Couldn't get a launch ticket (${res.status})`);
  return ticket;
}

async function robux(cookie, userId) {
  const res = await authed(cookie, `https://economy.roblox.com/v1/users/${Number(userId)}/currency`);
  if (!res.ok) throw new Error(`Couldn't load Robux (${res.status})`);
  return (await res.json()).robux ?? 0;
}

// Asks Roblox where a specific server is, the same request the player makes
// before connecting, then looks up the region of the server's address.
async function serverRegion(cookie, placeId, jobId) {
  // Roblox answers "queued" (status 22) for a few seconds before it returns
  // the server's address (status 2), so keep asking for a little while.
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await authed(cookie, "https://gamejoin.roblox.com/v1/join-game-instance", {
      method: "POST",
      headers: { "user-agent": "Roblox/WinInet", referer: `https://www.roblox.com/games/${Number(placeId)}/` },
      body: JSON.stringify({ placeId: Number(placeId), gameId: String(jobId), gameJoinAttemptId: crypto.randomUUID(), isTeleport: false }),
    });
    if (!res.ok) throw new Error(`Couldn't check region (${res.status})`);
    const j = await res.json();
    const js = j.joinScript;
    const ip = js?.UdmuxEndpoints?.[0]?.Address || js?.MachineAddress;
    if (ip) return ipRegion(ip);
    if (![0, 1, 22].includes(j.status)) throw new Error(j.message || (j.status === 6 ? "Server is full" : "Server isn't available"));
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Roblox didn't answer in time");
}

// Turns a roblox.com share link (…/share?code=X&type=Server) into a place and
// private-server link code.
async function resolveShareLink(cookie, code) {
  const res = await authed(cookie, "https://apis.roblox.com/sharelinks/v1/resolve-link", {
    method: "POST", body: JSON.stringify({ linkId: String(code), linkType: "Server" }),
  });
  if (!res.ok) throw new Error(`Couldn't open that link (${res.status})`);
  const j = await res.json();
  const d = j.privateServerInviteData;
  if (!d?.placeId || !d?.linkCode) throw new Error("That link isn't a private server invite, or it expired");
  return { placeId: d.placeId, linkCode: d.linkCode, universeId: d.universeId ?? null };
}

/* ---------- Avatar ---------- */
// Roblox's CDN picks a server from the file hash.
const cdnUrl = (hash) => { let i = 31; for (const ch of hash) i ^= ch.charCodeAt(0); return `https://t${i % 8}.rbxcdn.com/${hash}`; };

// 3D avatar: OBJ model + MTL materials + textures (as data URLs so WebGL can use them).
async function avatar3d(cookie, userId) {
  let r;
  for (let k = 0; k < 10; k++) {
    const res = await authed(cookie, `https://thumbnails.roblox.com/v1/users/avatar-3d?userId=${Number(userId)}`);
    r = await res.json();
    if (r.state === "Completed" && r.imageUrl) break;
    if (r.state === "Blocked" || r.state === "Error") throw new Error("Roblox couldn't render this avatar in 3D");
    await new Promise((x) => setTimeout(x, 1500));
  }
  if (r?.state !== "Completed") throw new Error("The 3D avatar is still being generated. Try again in a moment");
  const meta = await (await fetch(r.imageUrl, { signal: AbortSignal.timeout(15000) })).json();
  const [obj, mtl] = await Promise.all([fetch(cdnUrl(meta.obj), { signal: AbortSignal.timeout(20000) }).then((x) => x.text()), fetch(cdnUrl(meta.mtl), { signal: AbortSignal.timeout(20000) }).then((x) => x.text())]);
  const textures = {};
  await Promise.all(meta.textures.map(async (h) => {
    const buf = Buffer.from(await (await fetch(cdnUrl(h), { signal: AbortSignal.timeout(20000) })).arrayBuffer());
    textures[h] = `data:image/png;base64,${buf.toString("base64")}`;
  }));
  return { obj, mtl, textures, aabb: meta.aabb, camera: meta.camera };
}

async function avatarState(cookie) {
  const res = await authed(cookie, "https://avatar.roblox.com/v2/avatar/avatar");
  if (!res.ok) throw new Error(`Couldn't load your avatar (${res.status})`);
  const a = await res.json();
  const ids = a.assets.map((x) => x.id);
  const img = ids.length ? await thumbs("assets", ids, "150x150") : {};
  return { type: a.playerAvatarType, bodyColors: a.bodyColor3s || a.bodyColors, scales: a.scales, assets: a.assets.map((x) => ({ ...x, image: img[x.id] ?? null })) };
}

// Asset type ids for the inventory tabs.
const INVENTORY_TYPES = { hats: 8, hair: 41, face: 42, neck: 43, shoulder: 44, front: 45, back: 46, waist: 47, shirts: 11, pants: 12, tshirts: 2, faces: 18, gear: 19, emotes: 61, jackets: 64, sweaters: 65, shorts: 66, shoesL: 70, shoesR: 71, dresses: 67, heads: 17, animations: 48 };
async function inventory(cookie, userId, kind, cursor = "") {
  const typeId = INVENTORY_TYPES[kind];
  if (!typeId) throw new Error("Unknown category");
  const res = await authed(cookie, `https://inventory.roblox.com/v2/users/${Number(userId)}/inventory/${typeId}?limit=50&sortOrder=Desc${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
  if (!res.ok) throw new Error(`Couldn't load inventory (${res.status})`);
  const j = await res.json();
  const ids = [...new Set(j.data.map((x) => x.assetId))];
  const img = {};
  if (ids.length) Object.assign(img, await thumbs("assets", ids, "150x150"));
  const seen = new Set();
  return { next: j.nextPageCursor || null, items: j.data.filter((x) => !seen.has(x.assetId) && seen.add(x.assetId)).map((x) => ({ id: x.assetId, name: x.assetName, typeId, image: img[x.assetId] ?? null })) };
}

async function outfits(cookie, userId) {
  const res = await authed(cookie, `https://avatar.roblox.com/v1/users/${Number(userId)}/outfits?itemsPerPage=50&isEditable=true`);
  if (!res.ok) throw new Error(`Couldn't load outfits (${res.status})`);
  const list = (await res.json()).data;
  const img = {};
  if (list.length) {
    const t = await get(`https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${list.map((o) => o.id).join(",")}&size=150x150&format=Webp`).catch(() => ({ data: [] }));
    for (const x of t.data) img[x.targetId] = x.imageUrl;
  }
  return list.map((o) => ({ id: o.id, name: o.name, image: img[o.id] ?? null }));
}

async function setWearing(cookie, assets) {
  const res = await authed(cookie, "https://avatar.roblox.com/v2/avatar/set-wearing-assets", { method: "POST", body: JSON.stringify({ assets: assets.map((a) => (a.meta ? { id: a.id, meta: a.meta } : { id: a.id })) }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) throw new Error(j.errors?.[0]?.message || `Roblox refused the change (${res.status})`);
  return j;
}
async function setAvatarType(cookie, type) {
  if (!["R6", "R15"].includes(type)) throw new Error("Invalid body type");
  const res = await authed(cookie, "https://avatar.roblox.com/v1/avatar/set-player-avatar-type", { method: "POST", body: JSON.stringify({ playerAvatarType: type }) });
  if (!res.ok) throw new Error(`Couldn't change body type (${res.status})`);
}
async function wearOutfit(cookie, outfitId) {
  const res = await authed(cookie, `https://avatar.roblox.com/v3/outfits/${Number(outfitId)}/details`);
  if (!res.ok) throw new Error(`Couldn't load that outfit (${res.status})`);
  const o = await res.json();
  await setWearing(cookie, o.assets || []);
  if (o.playerAvatarType) await setAvatarType(cookie, o.playerAvatarType).catch(() => {});
  if (o.bodyColor3s) await authed(cookie, "https://avatar.roblox.com/v2/avatar/set-body-colors", { method: "POST", body: JSON.stringify(o.bodyColor3s) }).catch(() => {});
}
async function redraw(cookie) {
  await authed(cookie, "https://avatar.roblox.com/v1/avatar/redraw-thumbnail", { method: "POST", body: "{}" }).catch(() => {});
}

/* ---------- Buying catalog items ----------
   Purchases use the same endpoints as roblox.com's Buy button and always send
   the exact price the user confirmed (expectedPrice), so Roblox rejects the
   purchase if the price changed. */
async function itemDetails(cookie, userId, item) {
  const type = item.type === "Bundle" ? "Bundle" : "Asset";
  const res = await authed(cookie, "https://catalog.roblox.com/v1/catalog/items/details", { method: "POST", body: JSON.stringify({ items: [{ itemType: type, id: Number(item.id) }] }) });
  if (!res.ok) throw new Error(`Couldn't load the item (${res.status})`);
  const d = (await res.json()).data?.[0];
  if (!d) throw new Error("Item not found");
  const owned = await authed(cookie, `https://inventory.roblox.com/v1/users/${Number(userId)}/items/${type}/${Number(item.id)}/is-owned`).then((r) => r.json()).catch(() => false);
  let collectibleProductId = null, collectiblePrice = null;
  if (d.collectibleItemId) {
    const m = await authed(cookie, "https://apis.roblox.com/marketplace-items/v1/items/details", { method: "POST", body: JSON.stringify({ itemIds: [d.collectibleItemId] }) }).then((r) => r.json()).catch(() => null);
    collectibleProductId = m?.[0]?.collectibleProductId ?? null;
    collectiblePrice = m?.[0]?.price ?? null;
  }
  const price = collectiblePrice ?? d.price ?? d.lowestPrice ?? null;
  const offSale = d.priceStatus === "Off Sale" || (price == null && !d.lowestPrice);
  const resaleOnly = (d.itemRestrictions || []).some((r) => /Limited/i.test(r)) && (d.unitsAvailableForConsumption === 0 || d.priceStatus === "No Resellers");
  return {
    id: d.id, type, name: d.name, price: price ?? 0, offSale, resaleOnly, owned: owned === true,
    productId: d.productId ?? null, collectibleItemId: d.collectibleItemId ?? null, collectibleProductId,
    sellerId: d.creatorTargetId, sellerType: d.creatorType,
  };
}

async function buyItem(cookie, userId, item, expectedPrice) {
  const d = await itemDetails(cookie, userId, item);
  if (d.owned) throw new Error("You already own this item");
  if (d.offSale) throw new Error("This item is off sale");
  if (d.resaleOnly) throw new Error("This item is only sold by resellers");
  if (Number(expectedPrice) !== Number(d.price)) throw new Error(`The price changed to ${d.price} Robux. Check it and try again`);
  let res, j;
  if (d.collectibleItemId && d.collectibleProductId) {
    res = await authed(cookie, `https://apis.roblox.com/marketplace-sales/v1/item/${d.collectibleItemId}/purchase-item`, {
      method: "POST",
      body: JSON.stringify({ collectibleItemId: d.collectibleItemId, collectibleProductId: d.collectibleProductId, expectedCurrency: 1, expectedPrice: d.price, expectedPurchaserId: String(userId), expectedPurchaserType: "User", expectedSellerId: d.sellerId, expectedSellerType: d.sellerType, idempotencyKey: crypto.randomUUID() }),
    });
    j = await res.json().catch(() => ({}));
    if (!res.ok || j.purchased === false) throw new Error(j.errorMessage || j.purchaseResult || `Roblox didn't complete the purchase (${res.status})`);
  } else if (d.productId) {
    res = await authed(cookie, `https://economy.roblox.com/v1/purchases/products/${d.productId}`, {
      method: "POST", body: JSON.stringify({ expectedCurrency: 1, expectedPrice: d.price, expectedSellerId: d.sellerId }),
    });
    j = await res.json().catch(() => ({}));
    if (!res.ok || j.purchased === false) throw new Error(j.errorMsg || j.reason || `Roblox didn't complete the purchase (${res.status})`);
  } else throw new Error("This item can't be bought here");
  return { ok: true, name: d.name, price: d.price };
}

/* ---------- Chat ---------- */
const CHAT = "https://apis.roblox.com/platform-chat-api/v1";
async function chatConversations(cookie, cursor = "") {
  const res = await authed(cookie, `${CHAT}/get-user-conversations?pageSize=30&include_user_data=true${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
  if (!res.ok) throw new Error(`Couldn't load chats (${res.status})`);
  const j = await res.json();
  const ids = [...new Set(j.conversations.flatMap((c) => c.participant_user_ids || []))];
  const heads = {};
  for (const part of chunk(ids, 100)) Object.assign(heads, await headshots(part).catch(() => ({})));
  return {
    next: j.next_cursor || null,
    conversations: j.conversations.map((c) => {
      const users = c.user_data || {};
      return {
        // Friends you have never messaged come back without an id; starting a
        // chat with them creates the conversation first.
        id: c.id || null, startWith: c.id ? null : (c.participant_user_ids || [])[0] ?? null,
        type: c.type, name: c.name, unread: c.unread_message_count || 0, updated: c.updated_at,
        participants: (c.participant_user_ids || []).map((id) => ({ id, name: users[id]?.name || users[id]?.username || "", displayName: users[id]?.display_name || users[id]?.name || "", avatar: heads[id] ?? null })),
        last: c.messages?.[0] ? { text: c.messages[0].content, sender: c.messages[0].sender_user_id, at: c.messages[0].created_at } : null,
      };
    }),
  };
}
async function chatMessages(cookie, conversationId, cursor = "") {
  const res = await authed(cookie, `${CHAT}/get-conversation-messages?conversation_id=${encodeURIComponent(conversationId)}&pageSize=40${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
  if (!res.ok) throw new Error(`Couldn't load messages (${res.status})`);
  const j = await res.json();
  return { next: j.next_cursor || null, messages: (j.messages || []).map((m) => ({ id: m.id, text: m.content, sender: m.sender_user_id, at: m.created_at, type: m.type })) };
}
async function chatSend(cookie, conversationId, text) {
  const t = String(text || "").trim().slice(0, 500);
  if (!t) throw new Error("Message is empty");
  const res = await authed(cookie, `${CHAT}/send-messages`, { method: "POST", body: JSON.stringify({ conversation_id: conversationId, messages: [{ content: t }] }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.errors?.[0]?.message || `Couldn't send (${res.status})`);
  const sent = j.messages?.[0];
  if (sent?.moderation_type === "Moderated" || sent?.status === "moderated") throw new Error("Roblox's chat filter blocked that message");
  return { id: sent?.id || crypto.randomUUID(), text: sent?.content ?? t, at: sent?.created_at || new Date().toISOString() };
}
async function chatStart(cookie, userId) {
  const res = await authed(cookie, `${CHAT}/create-conversations`, { method: "POST", body: JSON.stringify({ conversations: [{ type: "one_to_one", participant_user_ids: [Number(userId)] }], include_user_data: true }) });
  const j = await res.json().catch(() => ({}));
  const id = j.conversations?.[0]?.id;
  if (!res.ok || !id) throw new Error(j.errors?.[0]?.message || `Couldn't start a chat (${res.status})`);
  return id;
}
async function chatRead(cookie, conversationId) {
  await authed(cookie, `${CHAT}/mark-conversations`, { method: "POST", body: JSON.stringify({ conversation_ids: [conversationId] }) }).catch(() => {});
}

/* ---------- News ---------- */
const NEWS_FEEDS = [
  { id: "announcements", label: "Roblox announcements", url: "https://devforum.roblox.com/c/updates/announcements/36.rss" },
  { id: "releases", label: "Release notes", url: "https://devforum.roblox.com/c/updates/release-notes/62.rss" },
  { id: "community", label: "Community news", url: "https://devforum.roblox.com/c/updates/news-alerts/193.rss" },
];
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return m ? decode(m[1]).trim() : ""; };
async function news() {
  const out = [];
  await Promise.all(NEWS_FEEDS.map(async (f) => {
    const key = "news:" + f.url;
    const hit = cache.get(key);
    let xml = hit && Date.now() - hit.t < 10 * 60 * 1000 ? hit.v : null;
    if (!xml) {
      const res = await fetch(f.url).catch(() => null);
      if (!res?.ok) return;
      xml = await res.text();
      cache.set(key, { t: Date.now(), v: xml });
    }
    for (const item of xml.split(/<item>/i).slice(1)) {
      const html = tag(item, "description");
      // First real picture in the post (skip emoji and avatar images).
      const img = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]).find((u) => !/emoji|user_avatar|letter_avatar/i.test(u)) || null;
      out.push({ id: tag(item, "guid") || tag(item, "link"), source: f.id, sourceLabel: f.label, title: tag(item, "title"), author: tag(item, "dc:creator"), date: tag(item, "pubDate"), html, image: img && /^https:\/\//.test(img) ? img : null });
    }
  }));
  return out.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function logout(cookie) {
  await authed(cookie, "https://auth.roblox.com/v2/logout", { method: "POST", body: "{}" }).catch(() => {});
}

module.exports = { avatarImage, onCookieRotated, itemDetails, buyItem, chatConversations, chatMessages, chatSend, chatRead, chatStart, searchMany, genreGames, news, avatar3d, avatarState, inventory, outfits, setWearing, setAvatarType, wearOutfit, redraw, placeUniverse, sorts, search, gameDetails, lookupUser, searchUsers, presence, servers, userProfile, gameMedia, badges, catalog, ipRegion, me, friends, authTicket, logout, robux, serverRegion, resolveShareLink };
