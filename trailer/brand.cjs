// Renders trailer/brand.html into PNGs (dev server must be running).
const { app, BrowserWindow } = require("electron");
const fs = require("fs"), path = require("path");
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1500, height: 1600, webPreferences: { offscreen: true } });
  await win.loadURL("http://localhost:5173/trailer/brand.html");
  await win.webContents.executeJavaScript("new Promise(r => { const c = () => window.brandReady ? setTimeout(r, 300) : setTimeout(c, 50); c(); })");
  const out = path.join(__dirname, "out");
  for (const [id, w, h, name] of [["pfp", 1000, 1000, "moony-pfp.png"], ["banner", 1500, 500, "moony-banner.png"]]) {
    await win.webContents.executeJavaScript(`document.querySelectorAll(".c").forEach(e => e.style.display = e.id === "${id}" ? "flex" : "none"); new Promise(r => setTimeout(r, 200))`); const r = { x: 0, y: 0 };
    const img = await win.webContents.capturePage({ x: Math.round(r.x), y: Math.round(r.y), width: w, height: h });
    fs.writeFileSync(path.join(out, name), img.toPNG());
  }
  app.quit();
});
