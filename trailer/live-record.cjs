// Records trailer/live.html (the real Moony UI on a virtual clock) at a locked
// 60 fps, then mixes the music and UI sound effects.
// Usage (dev server running): ORIENT=landscape|portrait npx electron trailer/live-record.cjs
const { app, BrowserWindow } = require("electron");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs"), path = require("path");
const FPS = 60, DT = 1000 / FPS;
const ORIENT = process.env.ORIENT || "landscape";
const [W, H] = ORIENT === "portrait" ? [1080, 1920] : [1920, 1080];
const OUT = path.join(__dirname, "out");
const EDIT = process.env.EDIT || "";
const AUDIO_START = Number(process.env.AUDIO_START || 0);
const NAME = EDIT ? `moony-${EDIT}-${ORIENT}` : `moony-live-${ORIENT}`;
app.commandLine.appendSwitch("force-device-scale-factor", "1");
app.commandLine.appendSwitch("disable-gpu-vsync");

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: W, height: H, useContentSize: true, webPreferences: { offscreen: true, backgroundThrottling: false } });
  win.webContents.setFrameRate(FPS);
  let lastImg = null, paints = 0;
  win.webContents.on("paint", (_e, _dirty, img) => { lastImg = img; paints++; });
  win.webContents.on("console-message", (_e, level, msg) => { if (level >= 2) console.log("[page]", msg.slice(0, 300)); });
  await win.loadURL(`http://localhost:5173/trailer/live.html${EDIT ? "?edit=" + EDIT : ""}`);
  await win.webContents.executeJavaScript("new Promise(r => { const c = () => window.__ready ? r() : setTimeout(c, 100); c(); })");
  // Warm the app's data (game lists, servers) before the clock starts.
  await new Promise((r) => setTimeout(r, 6000));
  await win.webContents.executeJavaScript("window.__start()");

  const silent = path.join(OUT, `${NAME}.video.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", silent], { stdio: ["pipe", "ignore", "ignore"] });
  const nextPaint = () => new Promise((r) => { const n = paints; const t0 = Date.now(); const c = () => (paints > n + 1 || Date.now() - t0 > 250 ? r() : setTimeout(c, 4)); c(); });
  let f = 0;
  for (;;) {
    const events = await win.webContents.executeJavaScript(`window.__step(${DT})`);
    for (const ev of events || []) {
      if (ev.type === "char") { win.webContents.sendInputEvent({ type: "char", keyCode: ev.key }); continue; }
      win.webContents.sendInputEvent({ type: ev.type, x: Math.round(ev.x), y: Math.round(ev.y), button: "left", clickCount: 1 });
    }
    const [cx, cy] = await win.webContents.executeJavaScript("window.__cursorStage()");
    win.webContents.sendInputEvent({ type: "mouseMove", x: Math.round(cx), y: Math.round(cy) });
    win.webContents.invalidate();
    await nextPaint();
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
    const sz = img.getSize();
    const buf = (sz.width === W && sz.height === H ? img : img.resize({ width: W, height: H, quality: "best" })).toBitmap();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    f++;
    if (f % 300 === 0) console.log(`${NAME}: ${(f / FPS).toFixed(0)}s`);
    if (await win.webContents.executeJavaScript("!!window.__done")) break;
    if (f > FPS * Number(process.env.MAXS || 90)) break;
  }
  const cues = await win.webContents.executeJavaScript("window.__cues");
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  win.destroy();

  // Audio: music + a sound effect at every cue.
  const dur = f / FPS;
  const inputs = ["-i", silent, "-i", path.join(OUT, "song2.wav")];
  const parts = [`[1:a]atrim=${AUDIO_START}:${AUDIO_START + dur},asetpts=PTS-STARTPTS,afade=t=out:st=${Math.max(0, dur - 2)}:d=2,volume=0.85[m]`];
  cues.forEach((c, i) => {
    inputs.push("-i", path.join(OUT, `sfx-${c.name}.wav`));
    const ms = Math.round(c.t * 1000);
    parts.push(`[${i + 2}:a]adelay=${ms}|${ms},volume=${(c.gain ?? 1) * 0.55}[s${i}]`);
  });
  const mixIn = ["[m]", ...cues.map((_, i) => `[s${i}]`)].join("");
  parts.push(`${mixIn}amix=inputs=${cues.length + 1}:normalize=0:duration=first,alimiter=limit=0.95[a]`);
  const r = spawnSync("ffmpeg", ["-y", ...inputs, "-filter_complex", parts.join(";"), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "224k", "-movflags", "+faststart", path.join(OUT, `${NAME}.mp4`)], { encoding: "utf8" });
  if (r.status !== 0) console.error("MIX FAILED", r.stderr.slice(-800));
  else { fs.unlinkSync(silent); console.log(`${NAME}: done ${dur.toFixed(1)}s, ${cues.length} sfx`); }
  app.quit();
});
