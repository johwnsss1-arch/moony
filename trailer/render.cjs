// Renders the trailer (or a short edit) at a locked 60 fps by stepping time
// frame-by-frame in an offscreen Electron window and piping frames into ffmpeg.
// Usage (dev server running):
//   npx electron trailer/render.cjs                         full trailer, both orientations
//   EDIT=beforeafter AUDIO_START=6 ONLY=portrait npx electron trailer/render.cjs
const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const FPS = 60;
const EDIT = process.env.EDIT || "trailer";
const AUDIO_START = Number(process.env.AUDIO_START || 0);
const NAME = EDIT === "trailer" ? "moony-trailer" : `moony-${EDIT}`;
const OUT = path.join(__dirname, "out");
const ALL = [["landscape", 1920, 1080], ["portrait", 1080, 1920]];
const JOBS = process.env.ONLY ? ALL.filter((j) => j[0] === process.env.ONLY) : ALL;

app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.disableHardwareAcceleration();

async function render(name, w, h) {
  const win = new BrowserWindow({ show: false, width: w, height: h, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(FPS);
  await win.loadURL(`http://localhost:5173/trailer/?render&edit=${EDIT}`);
  await win.webContents.executeJavaScript("new Promise(r => { const c = () => window.trailerReady ? r() : setTimeout(c, 50); c(); })");
  const DURATION = await win.webContents.executeJavaScript("window.trailerDuration");
  const ff = spawn("ffmpeg", ["-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-ss", String(AUDIO_START), "-i", path.join(OUT, "song.wav"), "-af", `afade=t=out:st=${Math.max(0, DURATION - 1.2)}:d=1.2`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", path.join(OUT, `${NAME}-${name}.mp4`)], { stdio: ["pipe", "ignore", "ignore"] });
  const total = Math.round(FPS * DURATION);
  for (let f = 0; f < total; f++) {
    await win.webContents.executeJavaScript(`renderAt(${f / FPS}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h });
    const png = img.resize({ width: w, height: h }).toPNG();
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 300 === 0) console.log(`${NAME} ${name}: ${Math.round((f / total) * 100)}%`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  win.destroy();
  console.log(`${NAME} ${name}: done`);
}

app.whenReady().then(async () => {
  try { for (const j of JOBS) await render(...j); } catch (e) { console.error("RENDER FAILED:", e.message); }
  app.quit();
});
