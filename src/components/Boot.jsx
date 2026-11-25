import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useApp } from "../lib/store";

const BARS = [
  { id: "fonts", label: "Getting ready" },
  { id: "games", label: "Loading games" },
  { id: "friends", label: "Loading your friends" },
];

export function Boot() {
  const { sorts, friends, launchAs, settings } = useApp();
  const [fonts, setFonts] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [phase, setPhase] = useState("load");
  const [minDone, setMinDone] = useState(false);
  const word = useRef(null), lock = useRef(null);
  useLayoutEffect(() => { const set = () => word.current && lock.current?.style.setProperty("--word-w", word.current.offsetWidth + 14 + "px"); set(); document.fonts?.ready.then(set); }, []);

  useEffect(() => {
    (document.fonts?.ready || Promise.resolve()).then(() => setFonts(true));
    const a = setTimeout(() => setMinDone(true), 650);
    const b = setTimeout(() => setTimedOut(true), 7000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  const done = {
    fonts,
    games: sorts.status !== "loading",
    friends: !launchAs || (friends.status !== "idle" && friends.status !== "loading"),
  };
  const ready = (BARS.every((b) => done[b.id]) && minDone) || timedOut;
  const current = BARS.find((b) => !done[b.id]);

  useEffect(() => {
    if (!ready || phase !== "load") return;
    if (settings.reduceMotion) { setPhase("gone"); return; }
    setPhase("land");
    const t1 = setTimeout(() => setPhase("out"), 1150);
    const t2 = setTimeout(() => setPhase("gone"), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ready]);

  if (phase === "gone") return null;
  return (
    <div className={"boot " + phase} role="status" aria-live="polite" aria-label={ready ? "Moony is ready" : current?.label || "Loading"}>
      <div className="boot-lockup" ref={lock}>
        <svg className="boot-mark" viewBox="0 0 32 32" aria-hidden>
          <defs>
            <linearGradient id="boot-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f2f6ff" /><stop offset="0.45" stopColor="#a6c8ff" /><stop offset="1" stopColor="#4a78ee" />
            </linearGradient>
          </defs>
          <g transform="translate(4.5 -1) skewX(-14)">
            {BARS.map((b, i) => (
              <g key={b.id}>
                <rect className="boot-track" x={3 + i * 10} y="6" width="6" height="22" rx="3" />
                <rect className={"boot-fill" + (done[b.id] || ready ? " on" : "")} x={3 + i * 10} y="6" width="6" height="22" rx="3" fill="url(#boot-g)" style={{ transitionDelay: `${i * 60}ms` }} />
              </g>
            ))}
          </g>
        </svg>
        <span className="boot-word" ref={word}>moony</span>
      </div>
      <p className="boot-status">{ready ? "Ready" : current?.label || "Loading"}</p>
    </div>
  );
}
