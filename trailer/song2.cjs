// Moony theme v2: original future-bass / synth-pop track plus UI sound effects,
// synthesised from scratch (no samples, no licensing issues).
// 124 BPM, A minor, 48 s. Sections (seconds):
//   0-7.7 intro · 7.7-15.5 build · 15.5-31 drop · 31-34.8 break · 34.8-46.5 drop 2 · 46.5-48 tail
// Writes trailer/out/song2.wav and trailer/out/sfx-*.wav
const fs = require("fs"), path = require("path");
const SR = 44100, BPM = 124, BEAT = 60 / BPM, BAR = BEAT * 4, LEN = 48;
const N = Math.ceil(SR * LEN);
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
let seed = 11; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const drums = bus(), music = bus(), lead = bus(), fx = bus();
const put = (b, i, l, r) => { if (i >= 0 && i < N) { b.L[i] += l; b.R[i] += r; } };

const B = (n) => n * BAR; // bar -> seconds
const SEC = { intro: [0, B(4)], build: [B(4), B(8)], drop: [B(8), B(16)], brk: [B(16), B(18)], drop2: [B(18), B(24)] };
const inS = (t, s) => t >= SEC[s][0] && t < SEC[s][1];
// Am - F - C - G, with a lift to Dm in the second half of drops
const PROG = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]];
const PROG2 = [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [52, 56, 59, 62]];
const chordAt = (bar) => ((bar >> 2) % 2 ? PROG2 : PROG)[bar % 4];

// ---- instruments ----
function supersaw(b, t0, dur, f, g, env = { a: 0.02, r: 0.3 }, cutoff = 0.12, width = 0.6) {
  const s0 = Math.floor(t0 * SR), n = Math.floor((dur + env.r) * SR);
  const det = [-0.11, -0.06, -0.02, 0, 0.02, 0.06, 0.11];
  const ph = det.map(() => Math.random()); let lpL = 0, lpR = 0, lp2L = 0, lp2R = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let e = Math.min(1, t / env.a); if (t > dur) e *= Math.max(0, 1 - (t - dur) / env.r);
    let l = 0, r = 0;
    for (let j = 0; j < 7; j++) { ph[j] = (ph[j] + f * (1 + det[j] * 0.06) / SR) % 1; const v = ph[j] * 2 - 1; const p = (j - 3) / 3 * width; l += v * (1 - p); r += v * (1 + p); }
    lpL += (l / 7 - lpL) * cutoff; lpR += (r / 7 - lpR) * cutoff; lp2L += (lpL - lp2L) * cutoff; lp2R += (lpR - lp2R) * cutoff;
    put(b, s0 + k, lp2L * e * g, lp2R * e * g);
  }
}
function pluck(b, t0, f, g, pan = 0, bright = 0.5) {
  const s0 = Math.floor(t0 * SR), n = Math.floor(0.35 * SR); let lp = 0, ph = 0, ph2 = 0.3;
  for (let k = 0; k < n; k++) {
    const t = k / SR; ph = (ph + f / SR) % 1; ph2 = (ph2 + f * 1.004 / SR) % 1;
    const v = (ph * 2 - 1) * 0.5 + (ph2 < 0.5 ? 0.5 : -0.5);
    lp += (v - lp) * (0.03 + bright * Math.exp(-t * 28)); const e = Math.exp(-t * 9) * g;
    put(b, s0 + k, lp * e * (1 - pan), lp * e * (1 + pan));
  }
}
function bassNote(b, t0, dur, f, g) {
  const s0 = Math.floor(t0 * SR), n = Math.floor((dur + 0.03) * SR); let lp = 0, ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR; ph = (ph + f / SR) % 1;
    const sub = Math.sin(2 * Math.PI * ph); const saw = ph * 2 - 1;
    lp += (saw - lp) * (0.04 + 0.18 * Math.exp(-t * 14));
    const e = Math.min(1, t / 0.004) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.03) : 1);
    const v = (sub * 0.75 + lp * 0.45) * e * g; put(b, s0 + k, v, v);
  }
}
function leadNote(b, t0, dur, f, g, glideFrom) {
  const s0 = Math.floor(t0 * SR), n = Math.floor((dur + 0.25) * SR); let ph = [0, 0.33, 0.66], lp = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const gl = glideFrom ? glideFrom + (f - glideFrom) * Math.min(1, t / 0.06) : f;
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, Math.max(0, t - 0.15) * 3);
    let v = 0; const d = [1, 1.005, 0.995];
    for (let j = 0; j < 3; j++) { ph[j] = (ph[j] + gl * vib * d[j] / SR) % 1; v += (ph[j] < 0.5 ? 1 : -1) * 0.25 + Math.sin(2 * Math.PI * ph[j]) * 0.12; }
    lp += (v - lp) * 0.2;
    let e = Math.min(1, t / 0.01); if (t > dur) e *= Math.max(0, 1 - (t - dur) / 0.25);
    put(b, s0 + k, lp * e * g * 0.9, lp * e * g * 1.1);
  }
}
function bell(b, t0, f, g) {
  const s0 = Math.floor(t0 * SR), n = Math.floor(2.5 * SR);
  for (let k = 0; k < n; k++) { const t = k / SR; const v = Math.sin(2 * Math.PI * f * t + 2 * Math.exp(-t * 3) * Math.sin(2 * Math.PI * f * 3.01 * t)) * Math.exp(-t * 2.2) * g; put(b, s0 + k, v, v); }
}
function kick(t0, g = 1) {
  const s0 = Math.floor(t0 * SR); let ph = 0;
  for (let k = 0; k < SR * 0.45; k++) {
    const t = k / SR; const f = 48 + 140 * Math.exp(-t * 32); ph += f / SR;
    let v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 6.5) * 1.0;
    if (t < 0.004) v += rnd() * 0.5 * (1 - t / 0.004); // click
    v = Math.tanh(v * 1.6) * g * 0.85; put(drums, s0 + k, v, v);
  }
}
function clap(t0, g = 1) {
  const s0 = Math.floor(t0 * SR); let a = 0, b2 = 0;
  for (let k = 0; k < SR * 0.4; k++) {
    const t = k / SR; const n = rnd(); a += (n - a) * 0.35; b2 += ((n - a) - b2) * 0.6;
    const bursts = (t < 0.008 ? 1 : 0) + (t > 0.01 && t < 0.018 ? 0.8 : 0) + (t > 0.02 ? Math.exp(-(t - 0.02) * 14) : 0);
    const v = b2 * bursts * g * 0.55; put(drums, s0 + k, v * 0.95, v * 1.05);
  }
}
function hat(t0, g = 1, open = false, pan = 0.2) {
  const s0 = Math.floor(t0 * SR); let p = 0, p2 = 0;
  for (let k = 0; k < SR * (open ? 0.28 : 0.06); k++) {
    const t = k / SR; const n = rnd(); const hp = n - p; p = n; const hp2 = hp - p2; p2 = hp;
    const v = hp2 * Math.exp(-t * (open ? 12 : 60)) * g * 0.12; put(drums, s0 + k, v * (1 - pan), v * (1 + pan));
  }
}
function noiseSweep(b, t0, t1, g, up = true) {
  const s0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR); let lp = 0, bp = 0;
  for (let k = 0; k < n; k++) {
    const x = k / n, c = up ? 0.01 + 0.6 * x * x : 0.6 - 0.59 * x;
    lp += (rnd() - lp) * c; bp += (lp - bp) * c;
    const e = up ? x * x : (1 - x) * (1 - x); const v = (lp - bp) * e * g;
    put(b, s0 + k, v * (0.8 + 0.4 * Math.sin(x * 20)), v * (1.2 - 0.4 * Math.sin(x * 20)));
  }
}
function impact(b, t0, g = 1) {
  const s0 = Math.floor(t0 * SR); let ph = 0, lp = 0;
  for (let k = 0; k < SR * 1.8; k++) { const t = k / SR; ph += (35 + 60 * Math.exp(-t * 8)) / SR; lp += (rnd() - lp) * 0.05; const v = (Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.2) + lp * Math.exp(-t * 3) * 0.6) * g; put(b, s0 + k, v, v); }
}

// ---- arrangement ----
const kickTimes = [];
const bars = Math.round(LEN / BAR);
const MEL = [ // [midi, beat, len] per bar, 8-bar phrase
  [[76, 0, 0.75], [79, 0.75, 0.75], [81, 1.5, 1], [79, 2.5, 0.5], [76, 3, 1]],
  [[77, 0, 0.75], [76, 0.75, 0.75], [74, 1.5, 0.5], [72, 2, 2]],
  [[72, 0, 0.5], [74, 0.5, 0.5], [76, 1, 0.75], [79, 1.75, 1.25], [84, 3, 1]],
  [[83, 0, 1.5], [79, 1.5, 0.5], [78, 2, 1], [74, 3, 1]],
  [[76, 0, 0.75], [79, 0.75, 0.75], [81, 1.5, 1], [84, 2.5, 0.5], [83, 3, 1]],
  [[81, 0, 0.75], [77, 0.75, 0.75], [76, 1.5, 0.5], [72, 2, 2]],
  [[74, 0, 0.5], [77, 0.5, 0.5], [81, 1, 1], [79, 2, 1], [77, 3, 1]],
  [[76, 0, 1], [74, 1, 0.5], [76, 1.5, 0.5], [80, 2, 2]],
];
for (let b = 0; b < bars; b++) {
  const t0 = b * BAR, c = chordAt(b);
  const drop = inS(t0, "drop") || inS(t0, "drop2"), intro = inS(t0, "intro"), build = inS(t0, "build"), brk = inS(t0, "brk");
  // pads
  const padG = drop ? 0.22 : brk ? 0.2 : intro ? 0.14 : 0.17;
  const cut = intro ? 0.03 + 0.06 * (b / 4) : build ? 0.08 + 0.1 * ((b - 4) / 4) : drop ? 0.2 : 0.1;
  for (const m of c) supersaw(music, t0, BAR - 0.02, midi(m), padG / 4, { a: intro ? 0.6 : 0.02, r: 0.4 }, cut);
  if (drop) supersaw(music, t0, BAR - 0.02, midi(c[0] + 12), 0.04, { a: 0.02, r: 0.3 }, 0.25);
  // bass
  if (drop) for (let e = 0; e < 8; e++) { const r = c[0] - 24 + (e === 7 ? 12 : 0); bassNote(music, t0 + e * BEAT / 2, BEAT / 2 * 0.85, midi(r), e % 2 ? 0.5 : 0.36); }
  else if (build || brk) bassNote(music, t0, BAR * 0.95, midi(c[0] - 24), 0.3);
  // plucks: 16ths arpeggio
  if (!brk) {
    const seq = [0, 2, 1, 3, 2, 1, 3, 2]; const g = intro ? 0.05 + 0.03 * (b / 4) : 0.08;
    for (let s = 0; s < 16; s++) { const m = c[seq[s % 8]] + 12 + (s % 8 === 7 ? 12 : 0); pluck(music, t0 + s * BEAT / 4, midi(m), g, Math.sin(s * 1.3) * 0.6, drop ? 0.6 : 0.35); }
  }
  // drums
  if (drop) {
    for (let q = 0; q < 4; q++) { kick(t0 + q * BEAT); kickTimes.push(t0 + q * BEAT); hat(t0 + q * BEAT + BEAT / 2, 1, q === 3); }
    clap(t0 + BEAT); clap(t0 + 3 * BEAT);
    for (let s = 0; s < 16; s++) if (s % 2) hat(t0 + s * BEAT / 4 + (s % 4 === 3 ? 0.012 : 0), 0.45, false, -0.3);
  } else if (build) {
    const k = b - 4; for (let q = 0; q < 4; q++) { kick(t0 + q * BEAT, 0.7); kickTimes.push(t0 + q * BEAT); }
    const div = k < 2 ? 4 : k < 3 ? 8 : 16; for (let s = 0; s < div; s++) clap(t0 + s * BAR / div, 0.15 + 0.5 * ((k * div + s) / (4 * div)));
  } else if (intro && b >= 2) { for (let q = 0; q < 4; q++) hat(t0 + q * BEAT + BEAT / 2, 0.6); }
  // lead
  if (drop) { const ph = MEL[(b - (inS(t0, "drop") ? 8 : 18)) % 8]; let prev = null; for (const [m, at, d] of ph) { leadNote(lead, t0 + at * BEAT, d * BEAT * 0.92, midi(m), 0.16, prev && Math.abs(prev - midi(m)) < 200 ? prev : null); prev = midi(m); } }
}
// transitions
noiseSweep(fx, SEC.build[0], SEC.drop[0], 0.5); impact(fx, SEC.drop[0], 0.6);
noiseSweep(fx, SEC.drop[1] - 0.1, SEC.drop[1] + 1.5, 0.35, false);
noiseSweep(fx, SEC.brk[0] + 1, SEC.drop2[0], 0.5); impact(fx, SEC.drop2[0], 0.6);
[[0.2, 81], [0.7, 84], [1.2, 88]].forEach(([t, m]) => bell(fx, t, midi(m), 0.1));
[[46.5, 81], [46.8, 84], [47.1, 88]].forEach(([t, m]) => bell(fx, t, midi(m), 0.09));

// ---- mix: sidechain, reverb, master ----
const duck = new Float32Array(N).fill(1);
for (const kt of kickTimes) { const s0 = Math.floor(kt * SR); for (let k = 0; k < SR * 0.3; k++) { const i = s0 + k; if (i < N) duck[i] = Math.min(duck[i], 0.25 + 0.75 * Math.min(1, k / (SR * 0.22))); } }
function reverb(b, wet, size = 1) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => Math.floor(d * size * 1.6));
  const outL = new Float32Array(N), outR = new Float32Array(N);
  for (const [ci, d] of combs.entries()) { const buf = new Float32Array(d); let idx = 0, lp = 0; const src = ci % 2 ? b.R : b.L; const dst = ci % 2 ? outR : outL; for (let i = 0; i < N; i++) { const y = buf[idx]; lp += (y - lp) * 0.3; buf[idx] = src[i] + lp * 0.82; dst[i] += y / combs.length; idx = (idx + 1) % d; } }
  for (let i = 0; i < N; i++) { b.L[i] += outL[i] * wet; b.R[i] += outR[i] * wet; }
}
function delay(b, time, fb, wet) { const d = Math.floor(time * SR); for (let i = d; i < N; i++) { b.L[i] += b.R[i - d] * fb * wet; b.R[i] += b.L[i - d] * fb * wet; } }
delay(lead, BEAT * 0.75, 0.45, 0.6); reverb(lead, 0.35); reverb(music, 0.25); reverb(fx, 0.3, 1.3);
const cl = new Float32Array(N); for (let i = 0; i < N; i++) { /* drums get a short room */ }
reverb(drums, 0.08, 0.6);
const L = new Float32Array(N), R = new Float32Array(N);
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = t > LEN - 1.5 ? Math.max(0, (LEN - t) / 1.5) : 1;
  L[i] = (drums.L[i] + music.L[i] * duck[i] + lead.L[i] * (0.6 + 0.4 * duck[i]) + fx.L[i]) * fade;
  R[i] = (drums.R[i] + music.R[i] * duck[i] + lead.R[i] * (0.6 + 0.4 * duck[i]) + fx.R[i]) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
function wav(file, L, R, gain) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(Math.round(Math.tanh(L[i] * gain) * 0.92 * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.tanh(R[i] * gain) * 0.92 * 32767), 46 + i * 4); }
  fs.writeFileSync(path.join(OUT, file), buf);
}
wav("song2.wav", L, R, 1.5 / peak);
console.log("song2.wav", LEN + "s", "sections:", JSON.stringify(SEC));

// ---- UI sound effects ----
function sfx(name, len, fn) { const n = Math.floor(len * SR), l = new Float32Array(n), r = new Float32Array(n); fn(l, r, n); let p = 0; for (let i = 0; i < n; i++) p = Math.max(p, Math.abs(l[i]), Math.abs(r[i])); wav(`sfx-${name}.wav`, l, r, 0.9 / (p || 1)); }
sfx("click", 0.08, (l, r, n) => { let ph = 0; for (let k = 0; k < n; k++) { const t = k / SR; ph += (2200 - 1400 * Math.min(1, t * 40)) / SR; const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 70) + rnd() * Math.exp(-t * 400) * 0.4; l[k] = v; r[k] = v; } });
sfx("pop", 0.18, (l, r, n) => { let ph = 0; for (let k = 0; k < n; k++) { const t = k / SR; ph += (400 + 900 * Math.exp(-t * 30)) / SR; const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 22); l[k] = v; r[k] = v; } });
sfx("whoosh", 0.7, (l, r, n) => { let lp = 0, bp = 0; for (let k = 0; k < n; k++) { const x = k / n; const c = 0.02 + 0.35 * Math.sin(Math.PI * x); lp += (rnd() - lp) * c; bp += (lp - bp) * c; const e = Math.sin(Math.PI * x) ** 2; const v = (lp - bp) * e; l[k] = v * (1 - x); r[k] = v * x; } });
sfx("swoosh-short", 0.35, (l, r, n) => { let lp = 0, bp = 0; for (let k = 0; k < n; k++) { const x = k / n; const c = 0.05 + 0.5 * x; lp += (rnd() - lp) * c; bp += (lp - bp) * c; const e = Math.sin(Math.PI * x) ** 3; const v = (lp - bp) * e; l[k] = v; r[k] = v; } });
sfx("type", 0.05, (l, r, n) => { for (let k = 0; k < n; k++) { const t = k / SR; const v = rnd() * Math.exp(-t * 180) + Math.sin(2 * Math.PI * 3000 * t) * Math.exp(-t * 250) * 0.3; l[k] = v; r[k] = v; } });
console.log("sfx written");
