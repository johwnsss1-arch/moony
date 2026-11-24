const SOUND = [".ogg", ".mp3"];
const s = (f) => `content\\sounds\\${f}`;
const t = (...p) => ["content", "textures", ...p].join("\\");
export const KINDS = {
  cursor: { label: "Cursor", group: "Cursors", ext: [".png"], targets: [t("Cursors", "KeyboardMouse", "ArrowCursor.png"), t("Cursors", "KeyboardMouse", "ArrowFarCursor.png")],
    presets: { classic: { label: "Classic 2013 cursor", map: { [t("Cursors", "KeyboardMouse", "ArrowCursor.png")]: t("ArrowCursor.png"), [t("Cursors", "KeyboardMouse", "ArrowFarCursor.png")]: t("ArrowFarCursor.png") } } } },
  crosshair: { label: "Shift-lock crosshair", group: "Cursors", ext: [".png"], targets: [t("MouseLockedCursor.png")] },
  ibeam: { label: "Text cursor", group: "Cursors", ext: [".png"], targets: [t("Cursors", "KeyboardMouse", "IBeamCursor.png")] },
  death: { label: "Death sound", group: "Sounds", ext: SOUND, targets: [s("ouch.ogg")], presets: { classic: { label: "Classic “oof”", map: { [s("ouch.ogg")]: s("oof.ogg") } } } },
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
const MIME = { ".png": "image/png", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".ttf": "font/ttf", ".otf": "font/otf" };
const ext = (p) => (/\.[a-z0-9]+$/i.exec(p)?.[0] || "").toLowerCase();
const base = (p) => p.split(/[\\/]/).pop();
const dirOf = (p) => p.replace(/[\\/][^\\/]*$/, "");
const join = (...p) => p.join("\\");

export function createMods(rust, playerDir) {
  const fs = (op, ...a) => rust("fs:" + op, ...a);
  let roots = null, state = null;
  const init = async () => {
    roots ||= await fs("roots");
    state ||= (await rust("store:get", "mods").catch(() => null)) || { files: {}, appliedVersion: null };
  };
  const save = () => rust("store:set", "mods", state);
  const modsDir = () => roots.mods;
  const backupPath = (player, target) => join(modsDir(), "backup", base(player), target.slice(player.length + 1));
  const original = async (player, target) => ((await fs("exists", backupPath(player, target))) ? backupPath(player, target) : target);
  const backup = async (player, target) => { const b = backupPath(player, target); if ((await fs("exists", target)) && !(await fs("exists", b))) await fs("copy", target, b); };
  async function fontTargets(player) {
    const fam = join(player, "content", "fonts", "families");
    const list = (await fs("readdir", fam).catch(() => [])).filter((f) => f.endsWith(".json")).map((f) => join(fam, f));
    return [join(player, "content", "fonts", "CustomFont.ttf"), ...list];
  }
  async function targets(kind, player) {
    if (kind === "font") return fontTargets(player);
    const out = [];
    for (const rel of KINDS[kind].targets) { const p = join(player, rel); if ((await fs("exists", p)) || (await fs("exists", backupPath(player, p)))) out.push(p); }
    return out;
  }
  async function pngSize(p) {
    const b = atob((await fs("read", p)).slice(0, 64));
    if (b.slice(1, 4) !== "PNG") return null;
    const u32 = (o) => ((b.charCodeAt(o) << 24) | (b.charCodeAt(o + 1) << 16) | (b.charCodeAt(o + 2) << 8) | b.charCodeAt(o + 3)) >>> 0;
    return { width: u32(16), height: u32(20) };
  }
  async function fitPng(file, width, height) {
    const img = new Image();
    img.src = `data:image/png;base64,${await fs("read", file)}`;
    await img.decode();
    const k = Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = Object.assign(document.createElement("canvas"), { width, height });
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high";
    g.drawImage(img, Math.floor((width - w) / 2), Math.floor((height - h) / 2), w, h);
    return c.toDataURL("image/png").split(",")[1];
  }
  async function restore(kind, player) {
    for (const tgt of await targets(kind, player)) {
      const b = backupPath(player, tgt);
      if (await fs("exists", b)) await fs("copy", b, tgt);
      else if (kind === "font" && tgt.endsWith("CustomFont.ttf")) await fs("rm", tgt);
    }
  }
  async function status() {
    await init();
    const player = await playerDir();
    const version = player ? base(player) : null;
    const kinds = {};
    for (const [k, v] of Object.entries(KINDS)) {
      const f = state.files[k];
      kinds[k] = {
        label: v.label, group: v.group, ext: v.ext,
        available: k === "font" || (!!player && (await targets(k, player)).length > 0),
        presets: Object.fromEntries(Object.entries(v.presets || {}).map(([pk, pv]) => [pk, pv.label])),
        current: f ? (f.preset ? { preset: f.preset, name: v.presets[f.preset].label } : { name: f.name }) : null,
      };
    }
    return { installed: !!player, version, upToDate: !!version && state.appliedVersion === version, kinds };
  }
  async function apply() {
    await init();
    const player = await playerDir();
    if (!player) throw new Error("Roblox Player isn't installed");
    for (const [kind, f] of Object.entries(state.files)) {
      const k = KINDS[kind];
      if (!k) continue;
      if (f.preset) {
        for (const [rel, srcRel] of Object.entries(k.presets?.[f.preset]?.map || {})) {
          const tgt = join(player, rel), src = await original(player, join(player, srcRel));
          if (!(await fs("exists", src))) continue;
          await backup(player, tgt); await fs("copy", src, tgt);
        }
        continue;
      }
      if (!f.file || !(await fs("exists", f.file))) continue;
      if (kind === "font") {
        const [fontTarget, ...families] = await fontTargets(player);
        await fs("copy", f.file, fontTarget);
        for (const fam of families) {
          await backup(player, fam);
          const orig = JSON.parse(await fs("readText", backupPath(player, fam)));
          orig.faces = (orig.faces || []).map((face) => ({ ...face, assetId: "rbxasset://fonts/CustomFont.ttf" }));
          await fs("writeText", fam, JSON.stringify(orig, null, 2));
        }
      } else {
        for (const tgt of await targets(kind, player)) {
          await backup(player, tgt);
          const size = tgt.endsWith(".png") ? await pngSize(await original(player, tgt)) : null;
          if (size) await fs("write", tgt, await fitPng(f.file, size.width, size.height));
          else await fs("copy", f.file, tgt);
        }
      }
    }
    state.appliedVersion = base(player);
    await save();
    return status();
  }
  return {
    status,
    apply,
    async pick(kind) {
      await init();
      const k = KINDS[kind];
      if (!k) return { ok: false, error: "Unknown mod" };
      const { open } = await import("@tauri-apps/plugin-dialog");
      const file = await open({ multiple: false, filters: [{ name: k.label, extensions: k.ext.map((e) => e.slice(1)) }] });
      if (!file) return { cancelled: true };
      const e = ext(file);
      if (!k.ext.includes(e)) return { ok: false, error: `${k.label} must be ${k.ext.join(" or ")}` };
      const dest = join(modsDir(), kind + e);
      for (const x of k.ext) if (x !== e) await fs("rm", join(modsDir(), kind + x)).catch(() => {});
      const name = await fs("import", file, dest);
      state.files[kind] = { name, file: dest };
      await save();
      return { ok: true, status: await apply() };
    },
    async online(kind, item) {
      await init();
      const k = KINDS[kind];
      if (!k || !k.ext.includes(".png")) return { ok: false, error: "This mod doesn't use images" };
      const dest = join(modsDir(), kind + ".png");
      await fs("download", item.url, dest);
      state.files[kind] = { name: item.name, file: dest };
      await save();
      return { ok: true, status: await apply() };
    },
    async preset(kind, preset) {
      await init();
      if (!KINDS[kind]?.presets?.[preset]) return { ok: false, error: "Unknown preset" };
      const player = await playerDir();
      if (player) await restore(kind, player);
      state.files[kind] = { preset }; await save();
      return { ok: true, status: await apply() };
    },
    async remove(kind) {
      await init();
      const player = await playerDir();
      if (player) await restore(kind, player);
      const f = state.files[kind];
      if (f?.file) await fs("rm", f.file).catch(() => {});
      delete state.files[kind]; await save();
      return { ok: true, status: await status() };
    },
    async preview(kind) {
      await init();
      const k = KINDS[kind];
      const player = await playerDir();
      const toUrl = async (p) => (p && (await fs("exists", p)) ? `data:${MIME[ext(p)] || "application/octet-stream"};base64,${await fs("read", p)}` : null);
      let current = null, originalUrl = null, size = null;
      const f = state.files[kind];
      if (kind !== "font" && player) {
        const first = join(player, k.targets[0]);
        originalUrl = await toUrl(await original(player, first));
        if (f?.preset) current = await toUrl(await original(player, join(player, k.presets[f.preset].map[k.targets[0]])));
        if (k.targets[0].endsWith(".png")) { const o = await original(player, first); if (await fs("exists", o)) size = await pngSize(o); }
      }
      if (f?.file) {
        current = await toUrl(f.file);
        if (size && f.file.endsWith(".png")) current = `data:image/png;base64,${await fitPng(f.file, size.width, size.height)}`;
      }
      return { current, original: originalUrl, size };
    },
    async reapplyIfNeeded() {
      await init();
      if (!Object.keys(state.files).length) return false;
      const player = await playerDir();
      if (!player || state.appliedVersion === base(player)) return false;
      try { await apply(); return true; } catch { return false; }
    },
  };
}
export { dirOf };
