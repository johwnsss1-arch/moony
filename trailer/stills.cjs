// Theme stills for the website, taken from the trailer's theme scenes.
const { app, BrowserWindow } = require("electron");
const fs = require("fs"), path = require("path");
const ORDER = ["midnight", "kawaii", "anime", "halloween", "christmas", "ocean", "forest", "cyberpunk", "galaxy", "sunset", "mono"];
const SLOT = 16 / ORDER.length, W = 1600, H = 1000;
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.whenReady().then(async () => {
  const out = path.join(__dirname, "..", "website", "img", "themes");
  fs.mkdirSync(out, { recursive: true });
  const win = new BrowserWindow({ show: false, width: W, height: H, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL("http://localhost:5173/trailer/?render");
  await win.webContents.executeJavaScript("new Promise(r => { const c = () => window.trailerReady ? r() : setTimeout(c, 50); c(); })");
  await win.webContents.insertCSS(".tr-badge, .tr-vignette { display: none !important; }");
  for (const [k, id] of ORDER.entries()) {
    await win.webContents.executeJavaScript(`renderAt(${8 + k * SLOT + 1.3}); new Promise(r => setTimeout(r, 400))`);
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
    fs.writeFileSync(path.join(out, `${id}.jpg`), img.toJPEG(84));
  }
  app.quit();
});
