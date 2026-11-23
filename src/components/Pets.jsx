// Little original pets that wander along the bottom of the window, one set
// per theme. Pure SVG + CSS motion (walk cycles, hops, swims), no images.
const Cat = ({ c = "#2a2840", e = "#ffd166" }) => (
  <g>
    <path className="pet-tail" d="M6 24 q-8 -10 -2 -20" stroke={c} strokeWidth="4" fill="none" strokeLinecap="round" />
    <ellipse cx="20" cy="26" rx="14" ry="8" fill={c} />
    <circle cx="34" cy="18" r="8" fill={c} />
    <path d="M28 12 l2 -7 4 5z M36 11 l4 -6 1 7z" fill={c} />
    <circle cx="37" cy="17" r="1.4" fill={e} className="ta-blink" />
    <g className="pet-legs" stroke={c} strokeWidth="3.5" strokeLinecap="round">
      <line className="l1" x1="12" y1="30" x2="12" y2="38" /><line className="l2" x1="28" y1="30" x2="28" y2="38" />
    </g>
  </g>
);
const Bunny = ({ c = "#fff0f6" }) => (
  <g>
    <ellipse cx="20" cy="28" rx="13" ry="10" fill={c} />
    <circle cx="31" cy="20" r="8" fill={c} />
    <ellipse className="pet-ear" cx="29" cy="7" rx="2.6" ry="8" fill={c} /><ellipse className="pet-ear e2" cx="34" cy="8" rx="2.6" ry="8" fill={c} />
    <circle cx="34" cy="19" r="1.3" fill="#3a2030" className="ta-blink" /><circle cx="36" cy="23" r="1.6" fill="#ff9cc8" />
    <circle cx="8" cy="27" r="3.5" fill="#fff" />
  </g>
);
const Bat = ({ c = "#2a1530" }) => (
  <g>
    <path className="pet-wing" d="M20 20 q-12 -10 -20 0 q6 -2 8 4 q4 -4 12 -4z" fill={c} />
    <path className="pet-wing w2" d="M20 20 q12 -10 20 0 q-6 -2 -8 4 q-4 -4 -12 -4z" fill={c} />
    <circle cx="20" cy="21" r="5" fill={c} /><circle cx="18" cy="20" r="1" fill="#ffb347" /><circle cx="22" cy="20" r="1" fill="#ffb347" />
  </g>
);
const Penguin = () => (
  <g>
    <ellipse cx="20" cy="24" rx="11" ry="14" fill="#1b2230" />
    <ellipse cx="20" cy="27" rx="7" ry="10" fill="#f4f7fb" />
    <circle cx="17" cy="16" r="1.3" fill="#fff" /><circle cx="23" cy="16" r="1.3" fill="#fff" />
    <path d="M18 19 l2 3 2 -3z" fill="#ffb347" />
    <path d="M10 6 q10 -8 20 0 l-2 4 h-16z" fill="#d4263a" /><circle cx="30" cy="5" r="2.5" fill="#fff" />
    <g className="pet-legs"><ellipse className="l1" cx="15" cy="38" rx="4" ry="2" fill="#ffb347" /><ellipse className="l2" cx="25" cy="38" rx="4" ry="2" fill="#ffb347" /></g>
  </g>
);
const Fish = ({ c = "#ff9c5a" }) => (
  <g>
    <path className="pet-tail" d="M4 20 l-4 -8 v16z" fill={c} />
    <ellipse cx="18" cy="20" rx="14" ry="8" fill={c} />
    <circle cx="26" cy="18" r="1.6" fill="#08202f" />
    <path d="M14 13 q4 -6 8 0" fill={c} opacity=".8" />
  </g>
);
const Hedgehog = () => (
  <g>
    <path d="M4 32 q2 -22 22 -20 l-3 4 6 -1 -3 5 7 1 -4 4 5 3 -6 2z" fill="#6b4a2a" />
    <ellipse cx="28" cy="28" rx="9" ry="7" fill="#e6c79a" />
    <circle cx="33" cy="26" r="1.3" fill="#2a1a0a" className="ta-blink" /><circle cx="37" cy="29" r="1.5" fill="#2a1a0a" />
    <g className="pet-legs" stroke="#4a3018" strokeWidth="3" strokeLinecap="round"><line className="l1" x1="14" y1="33" x2="14" y2="38" /><line className="l2" x1="26" y1="33" x2="26" y2="38" /></g>
  </g>
);
const Drone = () => (
  <g>
    <rect x="8" y="16" width="24" height="10" rx="2" fill="#1a1a2a" stroke="#00f0ff" strokeWidth="1.2" />
    <circle cx="20" cy="21" r="3" fill="#ff2bd6" className="ta-blink" />
    <line x1="4" y1="14" x2="36" y2="14" stroke="#f5e400" strokeWidth="2" className="pet-prop" />
    <line x1="20" y1="16" x2="20" y2="14" stroke="#00f0ff" />
  </g>
);
const Alien = () => (
  <g>
    <ellipse cx="20" cy="26" rx="10" ry="11" fill="#8df0b5" />
    <ellipse cx="16" cy="22" rx="3" ry="4" fill="#120a2a" /><ellipse cx="24" cy="22" rx="3" ry="4" fill="#120a2a" />
    <line x1="20" y1="15" x2="20" y2="7" stroke="#8df0b5" strokeWidth="2" /><circle cx="20" cy="6" r="2.5" fill="#ff9ce8" className="ta-blink" />
    <g className="pet-legs" stroke="#8df0b5" strokeWidth="3" strokeLinecap="round"><line className="l1" x1="15" y1="35" x2="15" y2="39" /><line className="l2" x1="25" y1="35" x2="25" y2="39" /></g>
  </g>
);
const Crab = () => (
  <g>
    <ellipse cx="20" cy="28" rx="12" ry="7" fill="#ff6b5a" />
    <circle cx="16" cy="20" r="2" fill="#fff" /><circle cx="24" cy="20" r="2" fill="#fff" />
    <circle cx="16" cy="20" r="1" fill="#000" /><circle cx="24" cy="20" r="1" fill="#000" />
    <path className="pet-wing" d="M8 26 q-8 -6 -4 -12 l4 4z" fill="#ff6b5a" /><path className="pet-wing w2" d="M32 26 q8 -6 4 -12 l-4 4z" fill="#ff6b5a" />
    <g className="pet-legs" stroke="#d94a3a" strokeWidth="2"><line className="l1" x1="12" y1="32" x2="8" y2="38" /><line className="l2" x1="28" y1="32" x2="32" y2="38" /></g>
  </g>
);
const Blob = () => (
  <g>
    <path d="M6 38 q0 -24 14 -24 q14 0 14 24z" fill="none" stroke="#eee" strokeWidth="2" />
    <circle cx="16" cy="26" r="1.5" fill="#eee" className="ta-blink" /><circle cx="24" cy="26" r="1.5" fill="#eee" className="ta-blink" />
  </g>
);

// kind: walk (ground), hop, fly, swim. dur in seconds for one crossing.
const PETS = {
  midnight: [{ P: Cat, kind: "walk", dur: 46 }, { P: () => <Cat c="#3d3a60" e="#9ad8ff" />, kind: "walk", dur: 62, delay: -30, small: true }],
  kawaii: [{ P: Bunny, kind: "hop", dur: 40 }, { P: () => <Bunny c="#ffd6e8" />, kind: "hop", dur: 55, delay: -25, small: true }],
  anime: [{ P: () => <Cat c="#fff" e="#ff6fa8" />, kind: "walk", dur: 50 }],
  halloween: [{ P: Bat, kind: "fly", dur: 30 }, { P: Bat, kind: "fly", dur: 44, delay: -20, small: true }],
  christmas: [{ P: Penguin, kind: "waddle", dur: 58 }],
  ocean: [{ P: Fish, kind: "swim", dur: 34 }, { P: () => <Fish c="#5ad1ff" />, kind: "swim", dur: 48, delay: -18, small: true }, { P: Crab, kind: "scuttle", dur: 70, delay: -40 }],
  forest: [{ P: Hedgehog, kind: "walk", dur: 66 }],
  cyberpunk: [{ P: Drone, kind: "fly", dur: 28 }],
  galaxy: [{ P: Alien, kind: "hop", dur: 52 }],
  sunset: [{ P: Crab, kind: "scuttle", dur: 54 }],
  mono: [{ P: Blob, kind: "hop", dur: 60 }],
};

export function Pets({ id }) {
  const list = PETS[id];
  if (!list) return null;
  return (
    <div className="pets" aria-hidden>
      {list.map(({ P, kind, dur, delay = 0, small }, i) => (
        <div key={i} className={`pet pet-${kind}${small ? " small" : ""}`} style={{ "--dur": `${dur}s`, "--delay": `${delay}s` }}>
          <div className="pet-bob"><svg viewBox="0 0 40 40" width="40" height="40"><P /></svg></div>
        </div>
      ))}
    </div>
  );
}
