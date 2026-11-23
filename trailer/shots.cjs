// Takes real screenshots of Moony in every theme for the website and edits.
// Dev server must be running. Usage: npx electron trailer/shots.cjs
const { app, BrowserWindow } = require("electron");
const fs = require("fs"), path = require("path");
const THEMES = (process.env.THEMES || "midnight,kawaii,anime,halloween,christmas,ocean,forest,cyberpunk,galaxy,sunset,mono").split(",");
const PAGES = (process.env.PAGES || "home").split(",");
const W = 1440, H = 900;
const version = require("../package.json").version;
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.whenReady().then(async () => {
  const out = path.join(__dirname, "..", "website", "img", "app");
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ show: false, width: W, height: H, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL("http://localhost:5173/?settings=" + (process.env.SETTINGS || "appearance"));
  for (const page of PAGES) for (const t of THEMES) {
    await win.webContents.executeJavaScript(`(() => { let s = {}; try { s = JSON.parse(localStorage.getItem("orbit:settings")) || {}; } catch {}
      Object.assign(s, { theme: "${t}", accent: "theme", tourDone: true, foundUsAsked: true, feedbackNudged: true, lastSeenVersion: "${version}", startPage: "${page}", rightPanel: false, themeArt: true, pets: true, snow: true });
      localStorage.setItem("orbit:settings", JSON.stringify(s)); })()`);
    await win.webContents.reload();
    await new Promise((r) => win.webContents.once("did-finish-load", r));
    await win.webContents.executeJavaScript("setInterval(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')), 300)");
    await new Promise((r) => setTimeout(r, Number(process.env.WAIT || 4500)));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
    fs.writeFileSync(path.join(out, `${page}-${t}.jpg`), img.toJPEG(86));
    console.log("shot", page, t);
  }
  app.quit();
});
