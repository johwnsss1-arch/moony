import { useEffect, useState } from "react";
import { DISCORD_URL } from "../lib/links";
import { useApp } from "../lib/store";

const LINES = [
  { text: "Join the Moony Discord", url: DISCORD_URL },
  { text: "Send us feedback", run: () => window.dispatchEvent(new Event("moony:feedback")) },
  { text: "Get support from the team", url: DISCORD_URL },
  { text: "Got questions? Read the FAQ", url: "https://moonylauncher.xyz/faq.html" },
  { text: "Found a bug? Tell us", run: () => window.dispatchEvent(new Event("moony:feedback")) },
  { text: "See what's new in Moony", run: () => window.dispatchEvent(new Event("moony:whatsnew")) },
];

export function HomeHero() {
  const { settings } = useApp();
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold || settings.reduceMotion) return;
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 2600);
    return () => clearInterval(t);
  }, [hold, settings.reduceMotion]);
  const prev = (i - 1 + LINES.length) % LINES.length;
  return (
    <section className="hh" aria-label="Moony">
      <svg className="hh-mark" viewBox="0 0 32 32" aria-hidden>
        <defs><linearGradient id="hh-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse"><stop stopColor="#f2f6ff" /><stop offset="0.45" stopColor="#a6c8ff" /><stop offset="1" stopColor="#4a78ee" /></linearGradient></defs>
        <g fill="url(#hh-g)" transform="translate(4.5 -1) skewX(-14)">
          {[0, 1, 2].map((n) => <rect key={n} className="hh-bar" style={{ animationDelay: `${n * 140}ms` }} x={3 + n * 10} y="6" width="6" height="22" rx="3" />)}
        </g>
      </svg>
      <h1 className="hh-word">moony</h1>
      <div className="hh-rot" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
        {LINES.map((l, n) => (
          l.url
            ? <a key={l.text} className={"hh-line" + (n === i ? " on" : n === prev ? " out" : "")} tabIndex={n === i ? 0 : -1} aria-hidden={n !== i} href={l.url} target="_blank" rel="noreferrer">{l.text}</a>
            : <button key={l.text} className={"hh-line" + (n === i ? " on" : n === prev ? " out" : "")} tabIndex={n === i ? 0 : -1} aria-hidden={n !== i} onClick={l.run}>{l.text}</button>
        ))}
      </div>
      <div className="hh-dots" aria-hidden>{LINES.map((_, n) => <i key={n} className={n === i ? "on" : ""} />)}</div>
    </section>
  );
}
