import { useEffect, useRef, useState } from "react";

// The in-game HUD widgets. Shared by the overlay window and the HUD editor
// preview, so the editor shows exactly what you'll see in game.
export const WIDGETS = {
  game: { label: "Current game", desc: "Game icon and name" },
  session: { label: "Session timer", desc: "How long you've been in this server" },
  clock: { label: "Clock", desc: "Current time" },
  region: { label: "Server region", desc: "Where your server is" },
  friends: { label: "Friends online", desc: "How many friends are online" },
  system: { label: "PC usage", desc: "CPU and memory use" },
  visualizer: { label: "Music visualiser", desc: "Bars that move to the audio your PC is playing" },
  watermark: { label: "Made with Moony", desc: "A small Moony tag that shows up in your recordings and screenshots" },
  date: { label: "Date", desc: "Today's day and date" },
  ping: { label: "Internet ping", desc: "Your connection's response time to Roblox" },
  battery: { label: "Battery", desc: "Laptop battery level and charging" },
  breaks: { label: "Break reminder", desc: "A nudge to rest your eyes every hour" },
  crosshair: { label: "Crosshair", desc: "A clean dot crosshair in the middle of the screen" },
  text: { label: "Custom text", desc: "Your own label, like your name or stream tag" },
};

const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); return `${h ? h + ":" : ""}${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

export function HudWidget({ id, state, demo }) {
  const now = state?.now;
  switch (id) {
    case "game":
      return <div className="hw hw-game">{now?.icon ? <img src={now.icon} alt="" /> : <span className="hw-dot" />}<div><small>Playing</small><b>{now?.name || (demo ? "Your game" : "Roblox")}</b></div></div>;
    case "session":
      return <div className="hw"><small>Session</small><b>{fmt((state?.time || Date.now()) - (now?.startedAt || state?.time || Date.now()))}</b></div>;
    case "clock":
      return <div className="hw"><b>{new Date(state?.time || Date.now()).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</b></div>;
    case "region": {
      const r = now?.region;
      return <div className="hw"><small>Server</small><b>{r ? (r.country === "US" ? `${r.region}, US` : `${r.city || r.region}, ${r.country}`) : demo ? "Singapore, SG" : "Unknown"}</b></div>;
    }
    case "friends":
      return <div className="hw"><small>Friends online</small><b>{state?.prefs?.friendsOnline ?? 0}</b></div>;
    case "system":
      return <div className="hw hw-sys"><span><small>CPU</small><b>{state?.system?.cpu ?? 0}%</b></span><span><small>RAM</small><b>{state?.system?.ram ?? 0}%</b></span></div>;
    case "watermark":
      return <div className="hw hw-mark"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M15 3a9 9 0 1 0 6 15.7A7.5 7.5 0 0 1 15 3z" fill="url(#mg)"/><defs><linearGradient id="mg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e9e5ff"/><stop offset="1" stopColor="#8b7dff"/></linearGradient></defs></svg><span>Made with <b>Moony</b></span></div>;
    case "date":
      return <div className="hw"><small>{new Date(state?.time || Date.now()).toLocaleDateString(undefined, { weekday: "long" })}</small><b>{new Date(state?.time || Date.now()).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</b></div>;
    case "ping":
      return <PingWidget ms={demo ? 42 : state?.ping} />;
    case "battery":
      return <BatteryWidget demo={demo} />;
    case "breaks": {
      const mins = Math.floor(((state?.time || Date.now()) - (now?.startedAt || state?.time || Date.now())) / 60000);
      const due = mins > 0 && mins % 60 >= 58;
      if (!due && !demo) return mins >= 60 ? <div className="hw hw-soft"><small>Played</small><b>{Math.floor(mins / 60)}h {mins % 60}m</b></div> : null;
      return <div className="hw hw-break"><b>Time for a short break</b><small>Look away from the screen for 20 seconds</small></div>;
    }
    case "crosshair":
      return <div className="hw-cross" aria-hidden><i /></div>;
    case "text":
      return <div className="hw hw-text"><b>{state?.prefs?.widgets?.text?.label || (demo ? "Your text here" : "")}</b></div>;
    case "visualizer":
      return <Visualizer media={state?.media} demo={demo} />;
    default:
      return null;
  }
}

// Bars driven by system audio (loopback). Falls back to a gentle idle wave
// if audio capture isn't available.
export function Visualizer({ bars = 36, media, demo }) {
  const canvas = useRef(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let stream, ctx, analyser, raf, stopped = false, tauriLevel = null, smooth = 0;
    const data = new Uint8Array(256);
    (async () => {
      // The Rust build can't capture sound silently (Windows would ask you to
      // pick a screen to share), so the bars use their idle animation there.
      if (window.__TAURI_INTERNALS__) {
        // Rust build: the live output level of your speakers drives the bars.
        const poll = async () => { if (stopped) return; try { tauriLevel = await window.__TAURI_INTERNALS__.invoke("ipc", { channel: "media:level", args: [] }); } catch { /* ignore */ } setTimeout(poll, 50); };
        poll();
        if (!stopped) setLive(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: { width: 1, height: 1, frameRate: 1 } });
        stream.getVideoTracks().forEach((t) => t.stop());
        if (!stream.getAudioTracks().length) throw new Error("no audio");
        ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.78;
        ctx.createMediaStreamSource(stream).connect(analyser);
        if (!stopped) setLive(true);
      } catch { /* idle animation */ }
    })();
    const draw = (t) => {
      const c = canvas.current;
      if (c) {
        const g = c.getContext("2d");
        const W = (c.width = c.clientWidth * devicePixelRatio), H = (c.height = c.clientHeight * devicePixelRatio);
        g.clearRect(0, 0, W, H);
        if (analyser) analyser.getByteFrequencyData(data);
        const bw = W / bars;
        for (let i = 0; i < bars; i++) {
          // Log-ish frequency mapping so bass and treble both show.
          const idx = Math.min(200, Math.floor(Math.pow(i / bars, 1.7) * 180) + 2);
          let v;
          if (analyser) v = data[idx] / 255;
          else if (tauriLevel != null) {
            if (i === 0) smooth += (Math.min(1, tauriLevel * 1.6) - smooth) * 0.35;
            // One level, spread into a lively spectrum: louder in the lows, moving bars.
            const shape = 0.55 + 0.45 * Math.cos((i / bars) * Math.PI * 0.9);
            const wob = 0.65 + 0.35 * Math.sin(t / 90 + i * 1.7) * Math.sin(t / 230 + i * 0.6);
            v = Math.max(0.04, smooth * shape * wob);
          } else v = 0.12 + 0.1 * Math.sin(t / 600 + i * 0.5);
          const h = Math.max(2 * devicePixelRatio, v * H);
          const grad = g.createLinearGradient(0, H, 0, H - h);
          grad.addColorStop(0, "rgba(255,255,255,0.55)");
          grad.addColorStop(1, getComputedStyle(c).getPropertyValue("--viz") || "#8b7dff");
          g.fillStyle = grad;
          const r = Math.min(bw * 0.3, 4 * devicePixelRatio);
          g.beginPath();
          g.roundRect(i * bw + bw * 0.18, H - h, bw * 0.64, h, [r, r, 0, 0]);
          g.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); ctx?.close(); };
  }, [bars]);
  const m = media || (demo ? { title: "Nothing playing", artist: "Play some music to see it here", app: "", playing: false } : null);
  return (
    <div className={"hw hw-viz" + (live ? " live" : "") + (m ? " with-track" : "")}>
      {m && (
        <div className="viz-track">
          <span className={"viz-eq" + (m.playing ? " on" : "")}><i /><i /><i /></span>
          <div className="viz-text"><b>{m.title}</b><small>{[m.artist, m.app && `on ${m.app}`].filter(Boolean).join(" · ")}{m.playing === false && media ? " · paused" : ""}</small></div>
        </div>
      )}
      <canvas ref={canvas} />
    </div>
  );
}

function useEvery(ms, fn, deps = []) {
  useEffect(() => { fn(); const t = setInterval(fn, ms); return () => clearInterval(t); }, deps); // eslint-disable-line
}
// Ping comes from the main process (a TCP connect to Roblox every 5 s).
function PingWidget({ ms }) {
  const c = ms == null || ms < 0 ? "" : ms < 80 ? "good" : ms < 160 ? "ok" : "bad";
  return <div className={"hw hw-ping " + c}><small>Ping</small><b>{ms == null ? "…" : ms < 0 ? "No connection" : ms + " ms"}</b></div>;
}
function BatteryWidget({ demo }) {
  const [b, setB] = useState(demo ? { level: 0.82, charging: false } : null);
  useEffect(() => {
    let bat, upd = () => bat && setB({ level: bat.level, charging: bat.charging });
    navigator.getBattery?.().then((x) => { bat = x; upd(); x.addEventListener("levelchange", upd); x.addEventListener("chargingchange", upd); }).catch(() => {});
    return () => { bat?.removeEventListener("levelchange", upd); bat?.removeEventListener("chargingchange", upd); };
  }, []);
  if (!b) return demo ? null : <div className="hw"><small>Battery</small><b>—</b></div>;
  const pct = Math.round(b.level * 100);
  return (
    <div className={"hw hw-bat" + (pct <= 20 && !b.charging ? " low" : "")}>
      <span className="bat-ico"><i style={{ width: pct + "%" }} /></span>
      <b>{pct}%</b>{b.charging && <small>charging</small>}
    </div>
  );
}
