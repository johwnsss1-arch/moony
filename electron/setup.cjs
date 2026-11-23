// Moony's own installer, uninstaller and update-applier.
//
// Moony-Setup.exe is a single self-extracting file (electron-builder
// "portable"). When it runs, Moony starts in setup mode and shows its own
// installer window. Installing copies the app into
// %LOCALAPPDATA%\Programs\Moony (no admin rights needed), creates shortcuts,
// and registers Moony in Windows' "Installed apps" list with an uninstaller.
//
// Modes:
//   (default)      interactive installer window
//   --update       silent: wait for the running Moony to close, replace its
//                  files, start it again (used by the auto-updater)
//   --uninstall    run from the installed Moony.exe by Windows' Apps list
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { execFile, spawn } = require("child_process");
const ofs = require("original-fs"); // copies app.asar as a file, not a folder
const path = require("path");

const pkg = require("../package.json");
const VERSION = pkg.version;
const installDir = () => path.join(process.env.LOCALAPPDATA || app.getPath("appData"), "Programs", "Moony");
const exePath = () => path.join(installDir(), "Moony.exe");
const UNINSTALL_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Moony";
const startMenuLink = () => path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", "Moony.lnk");
const desktopLink = () => path.join(app.getPath("desktop"), "Moony.lnk");

const run = (cmd, args) => new Promise((resolve) => execFile(cmd, args, { windowsHide: true }, (err, out) => resolve({ err, out: String(out || "") })));

// Close any Moony running from the install folder (not this installer).
async function closeInstalledMoony() {
  const dir = installDir().replace(/'/g, "''");
  await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Get-Process Moony -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '${dir}\\*' } | Stop-Process -Force`]);
  await new Promise((r) => setTimeout(r, 700));
}

function copyDir(src, dest, onFile) {
  ofs.mkdirSync(dest, { recursive: true });
  for (const entry of ofs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d, onFile);
    else { ofs.copyFileSync(s, d); onFile?.(entry.name); }
  }
}
function countFiles(dir) {
  let n = 0;
  for (const e of ofs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  return n;
}
function dirSizeKB(dir) {
  let n = 0;
  for (const e of ofs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); n += e.isDirectory() ? dirSizeKB(p) * 1024 : ofs.statSync(p).size; }
  return Math.round(n / 1024);
}

async function install({ desktop = true, startup = false } = {}, progress = () => {}) {
  const src = path.dirname(process.execPath); // the unpacked app this setup runs from
  progress({ step: "Closing Moony if it's open…", pct: 4 });
  await closeInstalledMoony();
  const total = countFiles(src);
  let done = 0;
  progress({ step: "Copying files…", pct: 8 });
  // Replace the old version cleanly (keeps your settings: they live in %APPDATA%\Moony).
  try { ofs.rmSync(installDir(), { recursive: true, force: true }); } catch { /* locked file: copy over it */ }
  copyDir(src, installDir(), () => { done++; if (done % 15 === 0) progress({ step: "Copying files…", pct: 8 + (done / total) * 80 }); });

  progress({ step: "Creating shortcuts…", pct: 90 });
  const link = { target: exePath(), cwd: installDir(), description: "Moony, a launcher for Roblox", icon: exePath(), iconIndex: 0, appUserModelId: "Moony" };
  ofs.mkdirSync(path.dirname(startMenuLink()), { recursive: true });
  shell.writeShortcutLink(startMenuLink(), "create", link);
  if (desktop) shell.writeShortcutLink(desktopLink(), "create", link);
  else try { ofs.rmSync(desktopLink(), { force: true }); } catch { /* none */ }
  app.setLoginItemSettings({ openAtLogin: !!startup, path: exePath(), args: ["--hidden"] });

  progress({ step: "Registering Moony with Windows…", pct: 95 });
  const reg = (name, type, data) => run("reg", ["add", UNINSTALL_KEY, "/v", name, "/t", type, "/d", String(data), "/f"]);
  await reg("DisplayName", "REG_SZ", "Moony");
  await reg("DisplayVersion", "REG_SZ", VERSION);
  await reg("Publisher", "REG_SZ", "Moony");
  await reg("DisplayIcon", "REG_SZ", `${exePath()},0`);
  await reg("InstallLocation", "REG_SZ", installDir());
  await reg("UninstallString", "REG_SZ", `"${exePath()}" --uninstall`);
  await reg("EstimatedSize", "REG_DWORD", dirSizeKB(installDir()));
  await reg("NoModify", "REG_DWORD", 1);
  await reg("NoRepair", "REG_DWORD", 1);
  progress({ step: "Done", pct: 100 });
}

// The portable wrapper sets PORTABLE_EXECUTABLE_* for its child. If the
// installed Moony inherited them it would think it was the installer again.
function cleanEnv() {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("PORTABLE_EXECUTABLE")) delete env[k];
  return env;
}
function launchInstalled() {
  spawn(exePath(), [], { cwd: installDir(), detached: true, stdio: "ignore", env: cleanEnv() }).unref();
}

/* ---------- Interactive installer window ---------- */
function installerWindow() {
  const win = new BrowserWindow({
    width: 620, height: 420, frame: false, transparent: true, resizable: false, show: false, backgroundColor: "#00000000",
    title: "Install Moony", icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "setup-preload.cjs"), contextIsolation: true, sandbox: true },
  });
  win.loadFile(path.join(__dirname, "setup.html"), { query: { version: VERSION, dir: installDir(), update: ofs.existsSync(exePath()) ? "1" : "" } });
  win.once("ready-to-show", () => win.show());
  ipcMain.handle("setup:install", async (_e, opts) => {
    try { await install(opts, (p) => win.webContents.send("setup:progress", p)); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; }
  });
  ipcMain.on("setup:launch", () => { launchInstalled(); setTimeout(() => app.quit(), 300); });
  ipcMain.on("setup:close", () => app.quit());
  ipcMain.on("setup:minimize", () => win.minimize());
}

/* ---------- Silent update ---------- */
async function silentUpdate() {
  // Show a small progress window so the user knows what's happening.
  const win = new BrowserWindow({ width: 360, height: 150, frame: false, transparent: true, resizable: false, alwaysOnTop: true, backgroundColor: "#00000000", webPreferences: { sandbox: true } });
  const html = `<html><body style="margin:0;font-family:Segoe UI,sans-serif;background:transparent"><div style="position:absolute;inset:6px;border-radius:14px;background:#14151b;border:1px solid rgba(255,255,255,.1);color:#ececf1;display:flex;flex-direction:column;justify-content:center;padding:0 22px;gap:10px"><b style="font-size:15px">Updating Moony to ${VERSION}…</b><div style="height:5px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden"><div id="f" style="height:100%;width:5%;background:linear-gradient(90deg,#8b7dff,#c9c3ff);transition:width .3s"></div></div><small id="s" style="color:#a4a6b3">Waiting for Moony to close…</small></div><script>window.p=(s,v)=>{document.getElementById("s").textContent=s;document.getElementById("f").style.width=v+"%"}</script></body></html>`;
  await win.loadURL("data:text/html;base64," + Buffer.from(html).toString("base64"));
  const show = (s, v) => win.webContents.executeJavaScript(`p(${JSON.stringify(s)},${v})`).catch(() => {});
  try {
    await install({ desktop: ofs.existsSync(desktopLink()), startup: app.getLoginItemSettings({ path: exePath() }).openAtLogin }, (p) => show(p.step, p.pct));
    show("Done", 100);
    if (!process.argv.includes("--quiet")) launchInstalled();
  } catch (e) {
    show(`Update failed: ${e.message}`, 100);
    await new Promise((r) => setTimeout(r, 4000));
  }
  setTimeout(() => app.quit(), 600);
}

/* ---------- Uninstall ---------- */
async function uninstall() {
  const r = await dialog.showMessageBox({
    type: "question", buttons: ["Uninstall", "Cancel"], defaultId: 1, cancelId: 1, title: "Uninstall Moony",
    message: "Uninstall Moony?", detail: "Moony will be removed from this PC. Your settings stay in %APPDATA%\\Moony in case you reinstall. Roblox itself isn't touched.",
    icon: path.join(__dirname, "..", "build", "icon.png"),
  });
  if (r.response !== 0) return app.quit();
  for (const f of [desktopLink(), startMenuLink()]) try { ofs.rmSync(f, { force: true }); } catch { /* gone */ }
  app.setLoginItemSettings({ openAtLogin: false, path: exePath() });
  await run("reg", ["delete", UNINSTALL_KEY, "/f"]);
  // Give Roblox's Play links back if Moony had them.
  try {
    const backup = JSON.parse(ofs.readFileSync(path.join(app.getPath("userData"), "protocol-backup.json"), "utf8"));
    for (const [proto, cmd] of Object.entries(backup)) await run("reg", ["add", `HKCU\\Software\\Classes\\${proto}\\shell\\open\\command`, "/ve", "/d", cmd, "/f"]);
  } catch { /* none saved */ }
  // The app folder can't delete itself while running: remove it right after we exit.
  spawn("cmd.exe", ["/c", `ping 127.0.0.1 -n 3 > nul & rmdir /s /q "${installDir()}"`], { detached: true, stdio: "ignore", windowsHide: true }).unref();
  app.quit();
}

function runSetup() {
  if (process.argv.includes("--uninstall")) return uninstall();
  if (process.argv.includes("--update")) return silentUpdate();
  return installerWindow();
}

module.exports = { runSetup, installDir, exePath };
