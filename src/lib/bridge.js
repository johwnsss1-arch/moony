// One entry point for everything that talks outside the UI.
// Desktop: Electron IPC (window.orbit). Browser preview: Vite dev middleware.
const desktop = typeof window !== "undefined" ? window.orbit : undefined;
export const isDesktop = !!desktop?.isDesktop;

export async function api(method, ...args) {
  if (isDesktop) return desktop.api(method, ...args);
  const res = await fetch(`/__orbit/${method}`, { method: "POST", body: JSON.stringify(args) });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

// Sign-in only exists in the desktop app (it needs Electron's isolated login
// window and the OS keychain).
export const auth = desktop?.auth ?? null;
export const playtimeApi = desktop?.playtime ?? null;
export const discordApi = desktop?.discord ?? null;
export const notifyApi = desktop?.notify ?? null;
export const modsApi = desktop?.mods ?? null;

export async function launchGame(placeId, opts = {}) {
  if (isDesktop) return desktop.launch({ placeId, ...opts });
  if (!placeId) return { ok: false, error: "Joining friends works in the desktop app" };
  // Browser preview: the roblox:// link still hands off to the installed app.
  window.location.href = `roblox://placeId=${placeId}${opts.jobId ? `&gameInstanceId=${opts.jobId}` : ""}${opts.linkCode ? `&linkCode=${opts.linkCode}` : ""}`;
  return { ok: true };
}

export const robloxInstall = () => (isDesktop ? desktop.install() : Promise.resolve(null));
export const setFpsCap = (fps) => (isDesktop ? desktop.setFps(fps) : Promise.resolve({ ok: false, error: "Only available in the desktop app" }));
export const win = desktop?.win ?? null;
export const avatarApi = desktop?.avatar ?? null;
export const gameViewApi = desktop?.gameView ?? null;
export const fflagsApi = desktop?.fflags ?? null;
// Open a roblox.com page inside a Moony window (signed in as the account).
export const openRobloxPage = (accountId, url) => (desktop?.openRobloxPage ? desktop.openRobloxPage(accountId, url) : Promise.reject(new Error("Works in the desktop app")));
