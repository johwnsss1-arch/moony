// Renders Moony's installer artwork (sidebar + header) to the 24-bit BMP files
// the Windows installer needs. Run with: electron build/make-installer-art.cjs
const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const moon = fs.readFileSync(path.join(__dirname, "..", "public", "moony.svg")).toString("base64");
const stars = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 37) % 100}%;top:${(i * 53) % 100}%;opacity:${0.25 + ((i * 7) % 10) / 14}"></i>`).join("");
const base = `html,body{margin:0;overflow:hidden;font-family:"Segoe UI",sans-serif}i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff}`;

const SIDEBAR = `<html><head><style>${base}
body{width:164px;height:314px;background:radial-gradient(120% 70% at 30% 10%,#3a2f86 0%,#17152b 55%,#0b0b12 100%);position:relative;color:#fff}
.m{position:absolute;left:22px;top:60px;width:120px;height:120px;filter:drop-shadow(0 8px 24px rgba(139,125,255,.6))}
.t{position:absolute;left:0;right:0;top:196px;text-align:center;font-size:30px;font-weight:700;letter-spacing:.02em;color:#fff6d8}
.s{position:absolute;left:0;right:0;top:238px;text-align:center;font-size:11px;color:#b9b6d6}
.h{position:absolute;left:0;right:0;bottom:0;height:60px;background:linear-gradient(0deg,rgba(139,125,255,.25),transparent)}
</style></head><body>${stars}<img class="m" src="data:image/svg+xml;base64,${moon}"><div class="t">Moony</div><div class="s">a launcher for Roblox</div><div class="h"></div></body></html>`;

const HEADER = `<html><head><style>${base}
body{width:150px;height:57px;background:#ffffff;position:relative}
.m{position:absolute;right:10px;top:6px;width:44px;height:44px}
</style></head><body><img class="m" src="data:image/svg+xml;base64,${moon}"></body></html>`;

// 24-bit bottom-up BMP from a BGRA bitmap.
function toBmp(bgra, w, h) {
  const row = Math.ceil((w * 3) / 4) * 4;
  const out = Buffer.alloc(54 + row * h);
  out.write("BM", 0); out.writeUInt32LE(out.length, 2); out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14); out.writeInt32LE(w, 18); out.writeInt32LE(h, 22); out.writeUInt16LE(1, 26); out.writeUInt16LE(24, 28);
  out.writeUInt32LE(row * h, 34);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4, d = 54 + y * row + x * 3;
      out[d] = bgra[s]; out[d + 1] = bgra[s + 1]; out[d + 2] = bgra[s + 2];
    }
  }
  return out;
}

async function render(html, w, h, file) {
  const win = new BrowserWindow({ width: w, height: h, show: false, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL("data:text/html;base64," + Buffer.from(html).toString("base64"));
  await new Promise((r) => setTimeout(r, 600));
  const img = (await win.webContents.capturePage({ x: 0, y: 0, width: w, height: h })).resize({ width: w, height: h });
  fs.writeFileSync(path.join(__dirname, file), toBmp(img.toBitmap(), w, h));
  fs.writeFileSync(path.join(__dirname, file.replace(".bmp", ".preview.png")), img.toPNG());
  win.destroy();
}

app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  await render(SIDEBAR, 164, 314, "installerSidebar.bmp");
  await render(HEADER, 150, 57, "installerHeader.bmp");
  console.log("installer art written");
  app.quit();
});
