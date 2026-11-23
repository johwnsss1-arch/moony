// Moony live showcase: drives the REAL app (in an iframe) on a virtual clock so
// every frame can be rendered perfectly at 60 fps. Camera moves, the cursor and
// captions are all functions of virtual time. trailer/live-record.cjs steps it.
(() => {
  const W = innerWidth, H = innerHeight, PORTRAIT = H > W;
  if (PORTRAIT) document.documentElement.classList.add("portrait");
  const APP_W = 1440, APP_H = 900;
  const PREVIEW = new URLSearchParams(location.search).has("preview");
  const $ = (s, r = document) => r.querySelector(s);
  const world = $("#world"), win = $("#win"), app = $("#app"), cursorEl = $("#cursor"), capEl = $("#cap"), cardEl = $("#card");
  win.style.width = APP_W + "px"; win.style.height = APP_H + "px";
  app.style.width = APP_W + "px"; app.style.height = APP_H + "px";

  // Fresh, predictable app state (same origin as the iframe).
  try {
    const s = JSON.parse(localStorage.getItem("orbit:settings") || "{}");
    Object.assign(s, { theme: "midnight", accent: "theme", tourDone: true, foundUsAsked: true, feedbackNudged: true, lastSeenVersion: "9.9.9", startPage: "home", rightPanel: false, themeArt: true, pets: true, snow: true, reduceMotion: false });
    localStorage.setItem("orbit:settings", JSON.stringify(s));
  } catch { /* ignore */ }

  // ---------------- virtual clock ----------------
  let V = 0; // ms since start
  const waiters = [];
  const wait = (ms) => new Promise((r) => waiters.push({ at: V + ms, r }));
  const tweens = [];
  const ease = {
    out: (x) => 1 - Math.pow(1 - x, 3),
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    expo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    smooth: (x) => x * x * x * (x * (x * 6 - 15) + 10),
    back: (x) => { const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
  };
  function tween(obj, to, ms, e = ease.smooth) {
    const from = {}; for (const k in to) from[k] = obj[k];
    const t = { obj, from, to, start: V, ms, e };
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj && Object.keys(tweens[i].to).some((k) => k in to)) tweens.splice(i, 1);
    tweens.push(t);
    return wait(ms);
  }

  // Virtual time inside the app: timers, rAF, clocks, CSS animations.
  let appPatched = false, rafQ = [], timers = [], tid = 1;
  const anims = new WeakMap();
  function patchApp() {
    const w = app.contentWindow; if (!w || appPatched) return;
    appPatched = true;
    const base = w.performance.now(), baseDate = Date.now();
    w.performance.now = () => base + V;
    const RealDate = w.Date;
    w.Date.now = () => baseDate + V;
    w.requestAnimationFrame = (cb) => { const id = tid++; rafQ.push({ id, cb }); return id; };
    w.cancelAnimationFrame = (id) => { rafQ = rafQ.filter((x) => x.id !== id); };
    w.setTimeout = (cb, ms = 0, ...a) => { const id = tid++; timers.push({ id, at: V + Math.max(0, ms), cb, a }); return id; };
    w.setInterval = (cb, ms = 0, ...a) => { const id = tid++; timers.push({ id, at: V + Math.max(1, ms), every: Math.max(1, ms), cb, a }); return id; };
    w.clearTimeout = w.clearInterval = (id) => { timers = timers.filter((x) => x.id !== id); };
    void RealDate;
  }
  function runApp() {
    const w = app.contentWindow; if (!w) return;
    for (let guard = 0; guard < 200; guard++) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0]; if (!t || t.at > V) break;
      if (t.every) t.at += t.every; else timers.shift();
      try { typeof t.cb === "function" && t.cb(...t.a); } catch (e) { console.warn(e); }
    }
    const q = rafQ; rafQ = [];
    for (const { cb } of q) { try { cb(w.performance.now()); } catch (e) { console.warn(e); } }
    for (const a of w.document.getAnimations()) {
      let s = anims.get(a);
      if (!s) { s = { c0: a.currentTime || 0, v0: V }; anims.set(a, s); a.pause(); }
      try { a.currentTime = s.c0 + (V - s.v0); } catch { /* finished */ }
    }
  }

  // ---------------- camera, cursor, captions ----------------
  const cam = { x: APP_W / 2, y: APP_H / 2, z: 1, o: 0, rot: 0 };
  const cur = { x: APP_W / 2, y: APP_H + 200, press: 0, o: 0 };
  const fit = PORTRAIT ? (W * 0.94) / APP_W : Math.min((W * 0.86) / APP_W, (H * 0.86) / APP_H);
  const centerY = PORTRAIT ? H * 0.58 : H / 2;
  const camS = () => fit * cam.z;
  const toStage = (x, y) => { const s = camS(); return [W / 2 + (x - cam.x) * s, centerY + (y - cam.y) * s]; };
  const toApp = (sx, sy) => { const s = camS(); return [(sx - W / 2) / s + cam.x, (sy - centerY) / s + cam.y]; };
  const ripples = [];
  const input = []; // real mouse/keyboard events for the recorder to send
  const cues = []; // sound effect cues
  const cue = (name, gain = 1) => cues.push({ t: V / 1000, name, gain });

  function render() {
    const s = camS();
    world.style.transform = `translate(${W / 2 - cam.x * s}px, ${centerY - cam.y * s}px) scale(${s})`;
    world.style.opacity = cam.o;
    const [cx, cy] = toStage(cur.x, cur.y);
    cursorEl.style.transform = `translate(${cx - 6}px, ${cy - 4}px) scale(${1 - cur.press * 0.18})`;
    cursorEl.style.opacity = cur.o;
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i], p = (V - r.t) / 450;
      if (p >= 1) { r.el.remove(); ripples.splice(i, 1); continue; }
      const [x, y] = toStage(r.x, r.y);
      r.el.style.transform = `translate(${x}px, ${y}px) scale(${1 + ease.out(p) * 2.6})`;
      r.el.style.opacity = 1 - p;
    }
    capRender(); cardRender(); renderBA();
  }

  // Captions: kicker + big title, words rise in one by one.
  let capState = null;
  function caption(k, title) { capState = { k, words: title.split(" "), t: V, out: null }; cue("swoosh-short", 0.5); }
  function captionOut() { if (capState) capState.out = V; }
  const capBg = $("#capbg"); capBg.className = PORTRAIT ? "portrait-bg" : "landscape-bg";
  function capRender() {
    if (!capState) { capEl.innerHTML = ""; capBg.style.opacity = 0; return; }
    const age = V - capState.t, outP = capState.out ? Math.min(1, (V - capState.out) / 300) : 0;
    if (outP >= 1) { capState = null; capEl.innerHTML = ""; capBg.style.opacity = 0; return; }
    capBg.style.opacity = Math.min(1, age / 300) * (1 - outP);
    const size = PORTRAIT ? 92 : 64;
    capEl.style.cssText = PORTRAIT ? `left:64px;right:64px;top:${150}px;` : `left:90px;bottom:80px;max-width:900px;`;
    const kP = ease.out(Math.min(1, age / 400));
    let html = `<span class="k" style="opacity:${kP * (1 - outP)};transform:translateY(${(1 - kP) * 12}px)">${capState.k}</span><h2 style="font-size:${size}px">`;
    capState.words.forEach((w, i) => {
      const p = ease.back(Math.max(0, Math.min(1, (age - 120 - i * 70) / 520)));
      const o = Math.max(0, Math.min(1, (age - 120 - i * 70) / 260)) * (1 - outP);
      html += `<span style="opacity:${o};transform:translateY(${(1 - p) * 40 - outP * 20}px)">${w}</span> `;
    });
    capEl.innerHTML = html + "</h2>";
  }

  // Full-screen title cards (intro / outro).
  let cardState = null;
  function card(kind) { cardState = { kind, t: V, out: null }; }
  function cardOut() { if (cardState) cardState.out = V; }
  function cardRender() {
    if (!cardState) { cardEl.innerHTML = ""; cardEl.style.opacity = 0; return; }
    const age = V - cardState.t, outP = cardState.out ? Math.min(1, (V - cardState.out) / 500) : 0;
    if (outP >= 1) { cardState = null; cardEl.innerHTML = ""; return; }
    const pop = ease.back(Math.min(1, age / 700)), t1 = ease.out(Math.max(0, Math.min(1, (age - 250) / 500))), t2 = ease.out(Math.max(0, Math.min(1, (age - 550) / 500))), t3 = ease.back(Math.max(0, Math.min(1, (age - 850) / 500)));
    cardEl.style.opacity = 1 - outP;
    cardEl.style.transform = `scale(${1 + outP * 0.15})`;
    cardEl.style.filter = `blur(${outP * 10}px)`;
    const sub = cardState.kind === "intro" ? "A better way to play Roblox." : "Free for Windows";
    cardEl.innerHTML = `<img src="/build/icon.png" style="transform:scale(${pop}) translateY(${Math.sin(V / 500) * 6}px)">
      <h1 style="opacity:${t1};transform:translateY(${(1 - t1) * 30}px)">Moony</h1>
      <p style="opacity:${t2};transform:translateY(${(1 - t2) * 20}px)">${sub}</p>
      ${cardState.kind === "outro" ? `<div class="pill" style="opacity:${t3};transform:scale(${0.8 + 0.2 * t3})">Link in bio</div>` : ""}`;
  }

  // ---------------- app helpers ----------------
  const doc = () => app.contentDocument;
  const find = (sel, text) => [...doc().querySelectorAll(sel)].find((e) => !text || e.textContent.trim().toLowerCase().includes(text.toLowerCase()));
  const centerOf = (el, dx = 0.5, dy = 0.5) => { const r = el.getBoundingClientRect(); return [r.left + r.width * dx, r.top + r.height * dy]; };
  async function waitFor(fn, ms = 4000) { const end = V + ms; while (V < end) { const v = fn(); if (v) return v; await wait(50); } return fn(); }
  async function moveTo(el, ms = 750, dx, dy) { if (!el) return; const [x, y] = centerOf(el, dx, dy); await tween(cur, { x, y }, ms, ease.inOut); }
  async function moveXY(x, y, ms = 750) { await tween(cur, { x, y }, ms, ease.inOut); }
  async function click(el) {
    if (el) await moveTo(el);
    tween(cur, { press: 1 }, 90, ease.out);
    const [sx, sy] = toStage(cur.x, cur.y);
    input.push({ type: "mouseDown", x: sx, y: sy });
    const r = document.createElement("div"); r.className = "ripple"; $("#stage").appendChild(r); ripples.push({ el: r, x: cur.x, y: cur.y, t: V });
    cue("click");
    await wait(90);
    input.push({ type: "mouseUp", x: sx, y: sy });
    if (PREVIEW) { const t = doc().elementFromPoint(cur.x, cur.y); t?.focus?.(); t?.click?.(); }
    tween(cur, { press: 0 }, 160, ease.out);
    await wait(160);
  }
  async function type(text) { for (const ch of text) { input.push({ type: "char", key: ch }); if (PREVIEW) { const el = doc().activeElement; if (el && "value" in el) { const set = Object.getOwnPropertyDescriptor(app.contentWindow.HTMLInputElement.prototype, "value").set; set.call(el, el.value + ch); el.dispatchEvent(new app.contentWindow.Event("input", { bubbles: true })); } } cue("type", 0.6); await wait(85 + (ch.charCodeAt(0) % 3) * 25); } }
  async function nav(label) { const b = [...doc().querySelectorAll(".nav-btn")].find((e) => e.textContent.trim().toLowerCase().startsWith(label.toLowerCase())); await click(b); await wait(250); }
  const focus = (x, y, z, ms = 1200, e = ease.smooth) => tween(cam, { x, y, z }, ms, e);
  const home = (ms = 1100) => focus(APP_W / 2, APP_H / 2, 1, ms);

  // ---------------- the tour ----------------
  async function tour() {
    card("intro"); cue("pop");
    await wait(2300);
    cardOut(); cue("whoosh");
    cam.z = 0.7; cam.y = APP_H / 2 + 80;
    tween(cam, { o: 1 }, 600, ease.out);
    await focus(APP_W / 2, APP_H / 2, 1, 1300, ease.expo);
    tween(cur, { o: 1 }, 300);

    // Home
    caption("Home", "Your games, front and center.");
    const hero = find(".hero, .featured, [class*=hero]");
    if (hero) { const r = hero.getBoundingClientRect(); focus(r.left + r.width / 2, Math.min(r.top + r.height / 2, 330) + 90, PORTRAIT ? 1.55 : 1.18, 1800); await moveTo(hero, 1200, 0.22, 0.7); }
    await wait(900);
    const tile = find(".tile-art") || find(".tile");
    if (tile) { const [x, y] = centerOf(tile); focus(x + 260, y, PORTRAIT ? 1.6 : 1.25, 1300); await moveTo(tile, 900); }
    await wait(700);
    captionOut(); home(900);

    // Discover + search
    await nav("Discover");
    caption("Discover", "Search all of Roblox.");
    const box = await waitFor(() => find(".search-field input") || find("input[placeholder*=Search]"));
    if (box) { const [x, y] = centerOf(box); focus(x, y + 120, PORTRAIT ? 1.7 : 1.35, 1100); await click(box); }
    await type("tycoon");
    await wait(1300);
    const res = find(".tile-art") || find(".tile");
    if (res) { await moveTo(res, 800); }
    await wait(800);
    captionOut(); home(900);

    // Servers
    await nav("Servers");
    caption("Servers", "Pick the server with the best ping.");
    const pick = await waitFor(() => find(".pick:not(:has(.skel))") || find(".pick"));
    if (pick) await click(pick);
    await wait(700);
    const row = await waitFor(() => find(".server-row, .srv-row, tbody tr, [class*=server] [class*=row]"));
    const join = find("button", "join");
    if (join) { const [x, y] = centerOf(join); focus(x - 300, y + 80, PORTRAIT ? 1.65 : 1.4, 1300); await moveTo(join, 1100); }
    else if (row) { const [x, y] = centerOf(row); focus(x, y, 1.35, 1300); await moveTo(row, 1100); }
    await wait(1100);
    captionOut(); home(900);

    // Marketplace
    await nav("Marketplace");
    caption("Marketplace", "Shop without opening a browser.");
    await wait(600);
    const items = [...doc().querySelectorAll(".tile-art, .mk-art, [class*=item] img")].slice(0, 6);
    if (items[0]) { const [x, y] = centerOf(items[0]); focus(x + 200, y + 60, PORTRAIT ? 1.6 : 1.3, 1200); }
    for (const it of items.slice(0, 4)) { await moveTo(it, 520); await wait(150); }
    await wait(500);
    captionOut(); home(900);

    // Themes
    await nav("Settings");
    const tab = await waitFor(() => find("button", "appearance"));
    await click(tab);
    caption("Themes", "Make it yours.");
    await wait(400);
    for (const name of ["Kawaii", "Cyberpunk", "Ocean", "Halloween"]) {
      const c = find(".theme-card", name);
      if (!c) continue;
      const [x, y] = centerOf(c);
      focus(x, y, PORTRAIT ? 1.35 : 1.15, 700);
      await click(c);
      cue("pop", 0.7);
      focus(APP_W / 2, APP_H / 2, PORTRAIT ? 1.05 : 0.96, 600, ease.out);
      await wait(1150);
    }
    captionOut();
    await focus(APP_W / 2, APP_H / 2 + 40, 0.82, 1400);
    tween(cur, { o: 0 }, 300);
    tween(cam, { o: 0 }, 600);
    cue("whoosh");
    card("outro"); cue("pop");
    await wait(3200);
    window.__done = true;
  }

  // ---------------- short edits ----------------
  // Before / after: a plain grey launcher, then a swipe into the real Moony on the drop.
  const before = document.createElement("div");
  before.id = "before";
  before.innerHTML = `<div class="b-win"><div class="b-bar"></div><div class="b-body"><div class="b-side">${"<i></i>".repeat(7)}</div><div class="b-main"><div class="b-hero"></div><div class="b-row">${"<i></i>".repeat(4)}</div><div class="b-btn">Play</div><div class="b-row">${"<i></i>".repeat(4)}</div></div></div></div><div class="b-tag">Before</div><div class="b-sub">the default launcher</div>`;
  before.style.display = "none";
  $("#stage").appendChild(before);
  const bState = { show: 0, wipe: 0, shake: 0 };
  const afterTag = document.createElement("div"); afterTag.id = "afterTag"; afterTag.innerHTML = "After <small>with Moony</small>"; afterTag.style.opacity = 0; $("#stage").appendChild(afterTag);
  const aState = { o: 0 };
  const renderBA = () => {
    before.style.display = bState.show ? "flex" : "none";
    before.style.clipPath = `inset(0 0 0 ${bState.wipe * 100}%)`;
    before.style.transform = `translateX(${Math.sin(V / 12) * 6 * bState.shake}px)`;
    afterTag.style.opacity = aState.o; afterTag.style.transform = `translateX(-50%) scale(${0.85 + 0.15 * aState.o})`;
  };
  async function tourBA() {
    bState.show = 1; cam.o = 1; cue("pop", 0.6);
    await wait(1200);
    tween(bState, { shake: 1 }, 800, ease.inOut);
    await wait(900);
    cue("whoosh"); tween(bState, { wipe: 1 }, 420, ease.inOut);
    tween(aState, { o: 1 }, 400, ease.back);
    cam.z = 1.25; focus(APP_W / 2, APP_H / 2, PORTRAIT ? 1.05 : 1, 900, ease.expo);
    await wait(500); bState.show = 0; tween(cur, { o: 1 }, 200);
    await wait(800);
    await nav("Servers"); await wait(900);
    await nav("Marketplace"); await wait(900);
    await nav("Settings");
    const tab = await waitFor(() => find("button", "appearance")); await click(tab);
    for (const name of ["Kawaii", "Cyberpunk", "Ocean", "Galaxy"]) {
      const c = find(".theme-card", name); if (!c) continue;
      await click(c); cue("pop", 0.6);
      tween(cam, { z: (PORTRAIT ? 1.05 : 1) * 1.04 }, 150, ease.out).then(() => tween(cam, { z: PORTRAIT ? 1.05 : 1 }, 500, ease.out));
      await wait(650);
    }
    tween(aState, { o: 0 }, 300); tween(cur, { o: 0 }, 300); tween(cam, { o: 0 }, 600); cue("whoosh");
    card("outro"); cue("pop");
    await wait(3000);
    window.__done = true;
  }
  // Themes: every theme, live, one per beat.
  async function tourThemes() {
    card("intro"); cue("pop");
    await nav("Settings");
    const tab = await waitFor(() => find("button", "appearance")); await click(tab);
    await wait(1600);
    cardOut(); cue("whoosh");
    cam.z = 0.8; tween(cam, { o: 1 }, 500, ease.out);
    await focus(APP_W / 2, APP_H / 2, PORTRAIT ? 1.0 : 0.95, 900, ease.expo);
    tween(cur, { o: 1 }, 200);
    const names = ["Christmas", "Kawaii", "Anime Night", "Halloween", "Ocean", "Autumn Forest", "Cyberpunk", "Galaxy", "Sunset", "Monochrome", "Midnight"];
    for (const [i, name] of names.entries()) {
      const c = find(".theme-card", name); if (!c) continue;
      await click(c);
      caption(`${i + 1} / ${names.length}`, name);
      // alternate the camera: wide shot, then a push towards the scene + pet
      if (i % 2) focus(APP_W * 0.62, APP_H * 0.72, PORTRAIT ? 1.55 : 1.3, 900);
      else focus(APP_W / 2, APP_H / 2, PORTRAIT ? 1.0 : 0.95, 900);
      await wait(950);
    }
    captionOut(); tween(cur, { o: 0 }, 300); tween(cam, { o: 0 }, 600); cue("whoosh");
    card("outro"); cue("pop");
    await wait(3000);
    window.__done = true;
  }
  const EDIT = new URLSearchParams(location.search).get("edit");
  const run = EDIT === "beforeafter" ? tourBA : EDIT === "themes" ? tourThemes : tour;

  // ---------------- stepping API for the recorder ----------------
  window.__input = input;
  window.__cues = cues;
  window.__ready = false;
  let started = false;
  app.addEventListener("load", () => setTimeout(() => { window.__ready = true; }, 2500));
  window.__start = () => { patchApp(); started = true; run(); };
  window.__step = async (dt) => {
    if (!started) return;
    V += dt;
    for (const t of tweens.slice()) {
      const p = Math.min(1, (V - t.start) / t.ms), k = t.e(p);
      for (const key in t.to) t.obj[key] = t.from[key] + (t.to[key] - t.from[key]) * k;
      if (p >= 1) tweens.splice(tweens.indexOf(t), 1);
    }
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].at <= V) { waiters[i].r(); waiters.splice(i, 1); }
    for (let i = 0; i < 6; i++) await Promise.resolve();
    runApp();
    render();
    const out = input.splice(0); return out;
  };
  window.__cursorStage = () => toStage(cur.x, cur.y);
  // Live preview (open the page in a browser): run in real time.
  if (new URLSearchParams(location.search).has("preview")) {
    app.addEventListener("load", () => setTimeout(() => { window.__start(); let last = performance.now(); const loop = (n) => { window.__step(n - last); last = n; requestAnimationFrame(loop); }; requestAnimationFrame(loop); }, 2000));
  }
})();
