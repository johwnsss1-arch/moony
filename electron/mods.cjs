const fs = require("fs");
const path = require("path");

const SOUND = [".ogg", ".mp3"];
const s = (f) => path.join("content", "sounds", f);
const t = (...p) => path.join("content", "textures", ...p);

const KINDS = {
  cursor: { label: "Cursor", group: "Cursors", ext: [".png"], targets: [t("Cursors", "KeyboardMouse", "ArrowCursor.png"), t("Cursors", "KeyboardMouse", "ArrowFarCursor.png")],
    presets: { classic: { label: "Classic 2013 cursor", map: { [t("Cursors", "KeyboardMouse", "ArrowCursor.png")]: t("ArrowCursor.png"), [t("Cursors", "KeyboardMouse", "ArrowFarCursor.png")]: t("ArrowFarCursor.png") } } } },
  crosshair: { label: "Shift-lock crosshair", group: "Cursors", ext: [".png"], targets: [t("MouseLockedCursor.png")] },
  ibeam: { label: "Text cursor", group: "Cursors", ext: [".png"], targets: [t("Cursors", "KeyboardMouse", "IBeamCursor.png")] },
  death: { label: "Death sound", group: "Sounds", ext: SOUND, targets: [s("ouch.ogg")],
    presets: { classic: { label: "Classic “oof”", map: { [s("ouch.ogg")]: s("oof.ogg") } } } },
  jump: { label: "Jump sound", group: "Sounds", ext: SOUND, targets: [s("action_jump.mp3")] },
  land: { label: "Landing sound", group: "Sounds", ext: SOUND, targets: [s("action_jump_land.mp3")] },
  footsteps: { label: "Footsteps", group: "Sounds", ext: SOUND, targets: [s("action_footsteps_plastic.mp3")] },
  fall: { label: "Falling sound", group: "Sounds", ext: SOUND, targets: [s("action_falling.ogg")] },
  swim: { label: "Swimming sound", group: "Sounds", ext: SOUND, targets: [s("action_swim.mp3")] },
  getup: { label: "Get-up sound", group: "Sounds", ext: SOUND, targets: [s("action_get_up.mp3")] },
  explosion: { label: "Explosion sound", group: "Sounds", ext: SOUND, targets: [s("impact_explosion_03.mp3")] },
  splash: { label: "Water splash", group: "Sounds", ext: SOUND, targets: [s("impact_water.mp3")] },
  font: { label: "Font", group: "Text", ext: [".ttf", ".otf"], targets: [] },
};

function fitPng(srcPath, width, height) {
  const { nativeImage } = require("electron");
  const img = nativeImage.createFromPath(srcPath);
  if (img.isEmpty()) throw new Error("That image couldn't be read");
  const s0 = img.getSize();
  const k = Math.min(width / s0.width, height / s0.height);
  const w = Math.max(1, Math.round(s0.width * k)), h = Math.max(1, Math.round(s0.height * k));
  const resized = img.resize({ width: w, height: h, quality: "best" });
  if (w === width && h === height) return resized.toPNG();
  const src = resized.toBitmap();
  const out = Buffer.alloc(width * height * 4, 0);
  const ox = Math.floor((width - w) / 2), oy = Math.floor((height - h) / 2);
  for (let y = 0; y < h; y++) src.copy(out, ((oy + y) * width + ox) * 4, y * w * 4, (y + 1) * w * 4);
  return nativeImage.createFromBitmap(out, { width, height }).toPNG();
}
function pngSize(p) {
  const b = fs.readFileSync(p);
  return b.toString("ascii", 1, 4) === "PNG" ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : null;
}

const MIME = { ".png": "image/png", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".otf": "font/otf" };

class Mods {
  constructor(dataDir, findPlayerDir) {
    this.dir = path.join(dataDir, "mods");
    this.stateFile = path.join(this.dir, "mods.json");
    this.findPlayerDir = findPlayerDir;
    fs.mkdirSync(this.dir, { recursive: true });
    this.state = this.load();
  }
  load() { try { return JSON.parse(fs.readFileSync(this.stateFile, "utf8")); } catch { return { files: {}, appliedVersion: null }; } }
  save() { fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2)); }

  fontTargets(player) {
    const fam = path.join(player, "content", "fonts", "families");
    const list = fs.existsSync(fam) ? fs.readdirSync(fam).filter((f) => f.endsWith(".json")).map((f) => path.join(fam, f)) : [];
    return [path.join(player, "content", "fonts", "CustomFont.ttf"), ...list];
  }
  targets(kind, player) {
    if (kind === "font") return this.fontTargets(player);
    return KINDS[kind].targets.map((rel) => path.join(player, rel)).filter((p) => fs.existsSync(p) || fs.existsSync(this.backupPath(player, p)));
  }

  status() {
    const player = this.findPlayerDir();
    const version = player ? path.basename(player) : null;
    return {
      installed: !!player,
      version,
      upToDate: !!version && this.state.appliedVersion === version,
      kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, {
        label: v.label, group: v.group, ext: v.ext,
        available: k === "font" || (!!player && this.targets(k, player).length > 0),
        presets: Object.fromEntries(Object.entries(v.presets || {}).map(([pk, pv]) => [pk, pv.label])),
        current: this.state.files[k] ? (this.state.files[k].preset ? { preset: this.state.files[k].preset, name: v.presets[this.state.files[k].preset].label } : { name: this.state.files[k].name }) : null,
      }])),
    };
  }

  set(kind, sourcePath) {
    const k = KINDS[kind];
    if (!k) throw new Error("Unknown mod");
    const ext = path.extname(sourcePath).toLowerCase();
    if (!k.ext.includes(ext)) throw new Error(`${k.label} must be ${k.ext.join(" or ")}`);
    if (fs.statSync(sourcePath).size > 20 * 1024 * 1024) throw new Error("File is too large");
    const dest = path.join(this.dir, kind + ext);
    for (const e of k.ext) if (e !== ext) fs.rmSync(path.join(this.dir, kind + e), { force: true });
    fs.copyFileSync(sourcePath, dest);
    this.state.files[kind] = { name: path.basename(sourcePath), file: dest };
    this.save();
    return this.apply();
  }

  setPreset(kind, preset) {
    const k = KINDS[kind];
    if (!k?.presets?.[preset]) throw new Error("Unknown preset");
    const player = this.findPlayerDir();
    if (player) this.restore(kind, player);
    this.state.files[kind] = { preset };
    this.save();
    return this.apply();
  }

  remove(kind) {
    const player = this.findPlayerDir();
    if (player) this.restore(kind, player);
    const f = this.state.files[kind];
    if (f?.file) fs.rmSync(f.file, { force: true });
    delete this.state.files[kind];
    this.save();
    return this.status();
  }

  backupPath(player, target) { return path.join(this.dir, "backup", path.basename(player), path.relative(player, target)); }
  backup(player, target) {
    const b = this.backupPath(player, target);
    if (fs.existsSync(target) && !fs.existsSync(b)) { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(target, b); }
  }
  original(player, target) { const b = this.backupPath(player, target); return fs.existsSync(b) ? b : target; }
  restore(kind, player) {
    for (const tgt of this.targets(kind, player)) {
      const b = this.backupPath(player, tgt);
      if (fs.existsSync(b)) fs.copyFileSync(b, tgt);
      else if (kind === "font" && tgt.endsWith("CustomFont.ttf")) fs.rmSync(tgt, { force: true });
    }
  }

  apply() {
    const player = this.findPlayerDir();
    if (!player) throw new Error("Roblox Player isn't installed");
    for (const [kind, f] of Object.entries(this.state.files)) {
      const k = KINDS[kind];
      if (!k) continue;
      if (f.preset) {
        const map = k.presets?.[f.preset]?.map || {};
        for (const [rel, srcRel] of Object.entries(map)) {
          const tgt = path.join(player, rel), src = this.original(player, path.join(player, srcRel));
          if (!fs.existsSync(src) || !fs.existsSync(path.dirname(tgt))) continue;
          this.backup(player, tgt);
          fs.copyFileSync(src, tgt);
        }
        continue;
      }
      if (!f.file || !fs.existsSync(f.file)) continue;
      if (kind === "font") {
        const [fontTarget, ...families] = this.fontTargets(player);
        fs.copyFileSync(f.file, fontTarget);
        for (const fam of families) {
          this.backup(player, fam);
          const orig = JSON.parse(fs.readFileSync(this.backupPath(player, fam), "utf8"));
          orig.faces = (orig.faces || []).map((face) => ({ ...face, assetId: "rbxasset://fonts/CustomFont.ttf" }));
          fs.writeFileSync(fam, JSON.stringify(orig, null, 2));
        }
      } else {
        for (const tgt of this.targets(kind, player)) {
          this.backup(player, tgt);
          const size = tgt.endsWith(".png") ? pngSize(this.original(player, tgt)) : null;
          if (size) fs.writeFileSync(tgt, fitPng(f.file, size.width, size.height));
          else fs.copyFileSync(f.file, tgt);
        }
      }
    }
    this.state.appliedVersion = path.basename(player);
    this.save();
    return this.status();
  }

  preview(kind) {
    const k = KINDS[kind];
    if (!k) throw new Error("Unknown mod");
    const player = this.findPlayerDir();
    const toUrl = (p) => { if (!p || !fs.existsSync(p)) return null; const ext = path.extname(p).toLowerCase(); return `data:${MIME[ext] || "application/octet-stream"};base64,${fs.readFileSync(p).toString("base64")}`; };
    let current = null, original = null;
    const f = this.state.files[kind];
    if (kind !== "font" && player) {
      const first = path.join(player, k.targets[0]);
      original = toUrl(this.original(player, first));
      if (f?.preset) current = toUrl(this.original(player, path.join(player, k.presets[f.preset].map[k.targets[0]])));
    }
    if (f?.file) {
      current = toUrl(f.file);
      if (player && f.file.endsWith(".png") && kind !== "font") {
        const tgt = path.join(player, k.targets[0]);
        const size = fs.existsSync(this.original(player, tgt)) ? pngSize(this.original(player, tgt)) : null;
        if (size) current = `data:image/png;base64,${fitPng(f.file, size.width, size.height).toString("base64")}`;
      }
    }
    let size = null;
    if (player && k.targets[0]?.endsWith(".png")) { const o = this.original(player, path.join(player, k.targets[0])); if (fs.existsSync(o)) size = pngSize(o); }
    return { current, original, size };
  }

  reapplyIfNeeded() {
    if (!Object.keys(this.state.files).length) return false;
    const player = this.findPlayerDir();
    if (!player || this.state.appliedVersion === path.basename(player)) return false;
    try { this.apply(); return true; } catch { return false; }
  }
}

module.exports = { Mods, KINDS };
