// Original synthwave/pop track for the trailer, synthesised from scratch.
// 120 BPM, 34 s, A minor (Am F C G). Writes trailer/out/song.wav.
const fs = require("fs");
const path = require("path");
const SR = 44100, BPM = 120, BEAT = 60 / BPM, BAR = BEAT * 4, LEN = 34;
const N = Math.ceil(SR * LEN);
const L = new Float32Array(N), R = new Float32Array(N);
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const chord = (bar) => CH[((bar % 4) + 4) % 4];
const add = (i, l, r) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; } };

// Section gains by time
const sec = (t) => ({
  pad: t < 30 ? 1 : 1,
  drums: t >= 8 && t < 30 ? 1 : 0,
  bass: t >= 8 && t < 30 ? 1 : t >= 4 && t < 8 ? 0.5 : 0,
  arp: t < 30 ? (t < 4 ? 0.5 : 1) : 0.5,
  lead: t >= 8 && t < 24 ? 1 : 0,
});

function note(t0, dur, f, gain, kind, pan = 0, env = { a: 0.005, d: 0.2, s: 0.5, r: 0.1 }) {
  const s0 = Math.floor(t0 * SR), n = Math.floor((dur + env.r) * SR);
  let lp = 0, ph = [0, 0, 0];
  const det = [1, 1.006, 0.994];
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    let e = t < env.a ? t / env.a : t < env.a + env.d ? 1 - (1 - env.s) * ((t - env.a) / env.d) : env.s;
    if (t > dur) e *= Math.max(0, 1 - (t - dur) / env.r);
    let v = 0;
    if (kind === "saw") { for (let j = 0; j < 3; j++) { ph[j] = (ph[j] + f * det[j] / SR) % 1; v += (ph[j] * 2 - 1) / 3; } lp += (v - lp) * 0.08; v = lp; }
    else if (kind === "bass") { ph[0] = (ph[0] + f / SR) % 1; v = ph[0] * 2 - 1; lp += (v - lp) * (0.05 + 0.25 * Math.exp(-t * 18)); v = lp + Math.sin(2 * Math.PI * f / 2 * t) * 0.6; }
    else if (kind === "pluck") { ph[0] = (ph[0] + f / SR) % 1; v = ph[0] < 0.5 ? 1 : -1; lp += (v - lp) * (0.02 + 0.4 * Math.exp(-t * 30)); v = lp; }
    else if (kind === "lead") { const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t * 3); ph[0] = (ph[0] + f * vib / SR) % 1; ph[1] = (ph[1] + f * 2.003 * vib / SR) % 1; v = (1 - 4 * Math.abs(ph[0] - 0.5)) * 0.8 + Math.sin(2 * Math.PI * ph[1]) * 0.25; }
    else if (kind === "bell") { v = Math.sin(2 * Math.PI * f * t + 1.5 * Math.sin(2 * Math.PI * f * 3.5 * t) * Math.exp(-t * 4)); }
    v *= e * gain;
    add(s0 + k, v * (1 - pan) , v * (1 + pan));
  }
}
function kick(t0, g = 1) { const s0 = Math.floor(t0 * SR); let ph = 0; for (let k = 0; k < SR * 0.4; k++) { const t = k / SR; const f = 45 + 110 * Math.exp(-t * 28); ph += f / SR; const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 7) * g * 0.9; add(s0 + k, v, v); } }
function clap(t0, g = 1) { const s0 = Math.floor(t0 * SR); let a = 0, b = 0; for (let k = 0; k < SR * 0.25; k++) { const t = k / SR; const n = rnd(); a += (n - a) * 0.5; b = n - a; const env = (t < 0.01 ? 1 : t < 0.02 ? 0.6 : 1) * Math.exp(-t * 18); const v = b * env * g * 0.45; add(s0 + k, v * 0.9, v * 1.1); } }
function hat(t0, g = 1, open = false) { const s0 = Math.floor(t0 * SR); let p = 0; for (let k = 0; k < SR * (open ? 0.2 : 0.05); k++) { const t = k / SR; const n = rnd(); const hp = n - p; p = n; const v = hp * Math.exp(-t * (open ? 18 : 70)) * g * 0.18; add(s0 + k, v * 1.2, v * 0.8); } }
function riser(t0, t1, g = 1) { const s0 = Math.floor(t0 * SR), n = Math.floor((t1 - t0) * SR); let lp = 0; for (let k = 0; k < n; k++) { const x = k / n; const nz = rnd(); lp += (nz - lp) * (0.02 + 0.5 * x * x); const v = lp * x * x * g * 0.35; add(s0 + k, v, v); } }

const bars = Math.ceil(LEN / BAR);
// Lead melody (MIDI, beats) for 8 bars of the drop, played over Am F C G x2
const MEL = [
  [[76, 0, 1], [74, 1, 0.5], [72, 1.5, 0.5], [74, 2, 1.5], [76, 3.5, 0.5]],
  [[77, 0, 1], [76, 1, 0.5], [74, 1.5, 0.5], [72, 2, 2]],
  [[72, 0, 0.5], [74, 0.5, 0.5], [76, 1, 1], [79, 2, 1], [76, 3, 1]],
  [[74, 0, 1.5], [71, 1.5, 0.5], [74, 2, 1], [79, 3, 1]],
  [[81, 0, 1], [79, 1, 0.5], [76, 1.5, 0.5], [79, 2, 1.5], [81, 3.5, 0.5]],
  [[84, 0, 1], [81, 1, 0.5], [77, 1.5, 0.5], [81, 2, 2]],
  [[79, 0, 0.5], [77, 0.5, 0.5], [76, 1, 1], [72, 2, 1], [76, 3, 1]],
  [[74, 0, 1], [76, 1, 1], [79, 2, 1], [83, 3, 1]],
];
for (let b = 0; b < bars; b++) {
  const t0 = b * BAR, c = chord(b), S = sec(t0);
  // Pad
  const padG = t0 >= 30 ? 0.09 : t0 >= 24 ? 0.07 : 0.06;
  for (const m of c) note(t0, BAR, midi(m), padG * S.pad, "saw", (m % 3 - 1) * 0.3, { a: 0.4, d: 0.5, s: 0.8, r: 0.6 });
  // Bass: offbeat eighths in the drop, whole notes in build
  if (S.bass) {
    const root = midi(c[0] - 24);
    if (S.drums) for (let e = 0; e < 8; e++) note(t0 + e * BEAT / 2, BEAT / 2 * 0.8, root, (e % 2 ? 0.32 : 0.22), "bass", 0, { a: 0.003, d: 0.1, s: 0.7, r: 0.04 });
    else note(t0, BAR, root, 0.2 * S.bass, "bass", 0, { a: 0.05, d: 0.2, s: 0.8, r: 0.2 });
  }
  // Arp: 16ths up/down the chord
  if (S.arp) {
    const seq = [0, 1, 2, 3, 2, 1, 0, 1];
    for (let s = 0; s < 16; s++) {
      const i = seq[s % 8], m = i === 3 ? c[0] + 12 : c[i];
      note(t0 + s * BEAT / 4, BEAT / 4, midi(m + 12), 0.07 * S.arp, "pluck", Math.sin(s) * 0.5, { a: 0.002, d: 0.12, s: 0.0, r: 0.05 });
    }
  }
  // Drums
  if (S.drums) {
    for (let q = 0; q < 4; q++) { kick(t0 + q * BEAT); hat(t0 + q * BEAT + BEAT / 2, 1, q === 3); }
    clap(t0 + BEAT); clap(t0 + 3 * BEAT);
    for (let s = 0; s < 16; s += 2) hat(t0 + s * BEAT / 4, 0.5);
  }
  // Lead
  if (S.lead) for (const [m, at, d] of MEL[(b - 4) % 8]) note(t0 + at * BEAT, d * BEAT * 0.95, midi(m), 0.13, "lead", 0.1, { a: 0.01, d: 0.2, s: 0.7, r: 0.15 });
}
// Build section: kicks on the slams, snare roll, risers
[4, 5.3, 6.6].forEach((t) => { kick(t, 1.1); clap(t, 0.8); });
for (let i = 0; i < 16; i++) clap(7 + i * (1 / 16), 0.2 + i * 0.04);
riser(5, 8, 1.2); riser(22, 24, 0.8); riser(28, 30, 0.9);
kick(8, 1.3); hat(8, 1.5, true);
// Intro / outro bells (logo hits)
[[0.3, 81], [0.8, 84], [1.3, 88]].forEach(([t, m]) => note(t, 1.5, midi(m), 0.08, "bell", 0, { a: 0.002, d: 1.2, s: 0, r: 0.5 }));
[[30.2, 81], [30.5, 84], [30.8, 88], [31.1, 93]].forEach(([t, m]) => note(t, 2, midi(m), 0.08, "bell", 0, { a: 0.002, d: 1.8, s: 0, r: 0.8 }));
kick(30, 1.2);

// Stereo delay + small reverb
const dl = Math.floor(BEAT * 0.75 * SR);
for (let i = dl; i < N; i++) { L[i] += R[i - dl] * 0.22; R[i] += L[i - dl] * 0.22; }
const taps = [1557, 1617, 1491, 1422].map((x) => x * 2);
const L2 = Float32Array.from(L), R2 = Float32Array.from(R);
for (const d of taps) for (let i = d; i < N; i++) { L2[i] += L2[i - d] * 0.18; R2[i] += R2[i - d + 7 > 0 ? i - d + 7 : 0] * 0.18; }
for (let i = 0; i < N; i++) { L[i] = L[i] * 0.8 + L2[i] * 0.2; R[i] = R[i] * 0.8 + R2[i] * 0.2; }

// Master: fade out, normalise, soft clip
let peak = 0;
for (let i = 0; i < N; i++) { const t = i / SR; const f = t > 32.5 ? Math.max(0, 1 - (t - 32.5) / 1.5) : 1; L[i] *= f; R[i] *= f; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
const g = 1.4 / peak;
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(Math.tanh(L[i] * g) * 0.89 * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(Math.tanh(R[i] * g) * 0.89 * 32767), 46 + i * 4); }
fs.mkdirSync(path.join(__dirname, "out"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "out", "song.wav"), buf);
console.log("song.wav written", (N / SR).toFixed(1) + "s");
