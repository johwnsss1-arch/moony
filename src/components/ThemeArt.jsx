import { useId } from "react";

const Stars = ({ n = 18, w = 640, h = 260, seed = 1, fill = "#fff" }) => (
  <g fill={fill} className="ta-far">
    {Array.from({ length: n }, (_, i) => {
      const x = (i * 97 * seed + 31) % w, y = (i * 53 * seed + 17) % h, r = ((i * 7) % 3) * 0.6 + 0.7;
      return <circle key={i} cx={x} cy={y} r={r} opacity={0.35 + ((i * 13) % 10) / 16} className="ta-twinkle" style={{ animationDelay: `${(i % 6) * 0.5}s` }} />;
    })}
  </g>
);

const Shooting = ({ n = 2, color = "#fff" }) => (
  <g>
    {Array.from({ length: n }, (_, i) => (
      <g key={i} className="ta-shoot" style={{ animationDelay: `${2 + i * 5.5}s`, "--sx": `${120 + i * 210}px`, "--sy": `${10 + i * 30}px` }}>
        <path d="M0 0l-70-26" stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
        <circle r="2.4" fill={color} />
      </g>
    ))}
  </g>
);

function Midnight({ u }) {
  return (
    <g>
      <defs>
        <radialGradient id={u + "mg"} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#c9c3ff" stopOpacity=".55" /><stop offset="1" stopColor="#8b7dff" stopOpacity="0" /></radialGradient>
        <linearGradient id={u + "mm"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff6d8" /><stop offset=".6" stopColor="#d9d3ff" /><stop offset="1" stopColor="#9d90ff" /></linearGradient>
        <mask id={u + "mk"}><rect width="640" height="420" fill="#fff" /><circle cx="470" cy="130" r="92" fill="#000" /></mask>
      </defs>
      <Stars n={30} seed={3} />
      <Shooting n={3} color="#e3ddff" />
      <circle cx="420" cy="170" r="190" fill={`url(#${u}mg)`} />
      <circle cx="420" cy="175" r="110" fill={`url(#${u}mm)`} mask={`url(#${u}mk)`} />

      <g fill="#1a1838" opacity=".9">
        <path d="M0 420V360c60-20 120-24 180-10s110 10 170-6 130-30 200-14 90 30 90 30v60z" />
      </g>
      <g fill="#262250" opacity=".8"><ellipse cx="200" cy="300" rx="90" ry="18" /><ellipse cx="250" cy="290" rx="60" ry="16" /></g>
    </g>
  );
}

function Kawaii({ u }) {
  return (
    <g>
      <defs>
        <linearGradient id={u + "kb"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#ffe3ef" /></linearGradient>
        <linearGradient id={u + "kh"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9cc8" /><stop offset="1" stopColor="#ff5fa2" /></linearGradient>
      </defs>
      <g fill="none" strokeWidth="14" opacity=".55" strokeLinecap="round">
        <path d="M150 330a220 220 0 0 1 440 0" stroke="#ffb3d1" />
        <path d="M164 330a206 206 0 0 1 412 0" stroke="#ffe0a3" />
        <path d="M178 330a192 192 0 0 1 384 0" stroke="#bff0d4" />
        <path d="M192 330a178 178 0 0 1 356 0" stroke="#c9d6ff" />
        <path d="M206 330a164 164 0 0 1 328 0" stroke="#e3c9ff" />
      </g>
      <g fill="#fff" opacity=".9">
        <path className="ta-drift" style={{ animationDuration: "48s" }} d="M120 330c-20 0-30-24-10-32 0-22 30-28 40-12 14-16 40-6 36 14 22 2 22 30 0 30z" />
        <path className="ta-drift" style={{ animationDuration: "64s", animationDelay: "-30s" }} d="M520 320c-18 0-26-20-8-28 2-18 26-22 34-10 12-12 34-4 30 12 20 2 18 26 0 26z" />
      </g>
      <path d="M0 420V368c80-30 160-30 240-6s170 20 250-4 150-10 150-10v72z" fill="#ffc2dc" />
      <path d="M0 420v-30c100-18 220-16 320 0s220 10 320-8v38z" fill="#ff9cc8" opacity=".75" />
      {[[120, 380], [560, 372]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 -14c14 0 20 8 18 18-3 14-12 22-18 22S-15 18-18 4c-2-10 4-18 18-18z" fill="#ff4f7d" />
          <path d="M-10 -14l6 4 4-8 4 8 6-4-2 8h-16z" fill="#5fce7c" />
          <g fill="#ffe08a"><circle cx="-6" cy="2" r="1.4" /><circle cx="5" cy="0" r="1.4" /><circle cx="0" cy="10" r="1.4" /><circle cx="-9" cy="12" r="1.2" /><circle cx="8" cy="12" r="1.2" /></g>
        </g>
      ))}

      <g fill="#fff">
        {[[210, 130], [470, 110], [520, 200], [170, 220]].map(([x, y], i) => (
          <path key={i} className="ta-sparkle" style={{ animationDelay: `${i * 0.6}s`, transformOrigin: `${x}px ${y}px` }} transform={`translate(${x} ${y})`} d="M0-10l2.4 7.6L10 0l-7.6 2.4L0 10l-2.4-7.6L-10 0l7.6-2.4z" />
        ))}
      </g>
    </g>
  );
}

function Anime({ u }) {
  const windows = [];
  for (let b = 0; b < 9; b++) for (let r = 0; r < 7; r++) if ((b * 7 + r * 3) % 5 < 2) windows.push(<rect key={`${b}-${r}`} x={20 + b * 68 + (r % 2) * 14} y={250 + r * 18 - (b % 3) * 30} width="6" height="8" fill={(b + r) % 3 ? "#ffd27a" : "#7af0ff"} opacity=".8" />);
  return (
    <g>
      <defs>
        <radialGradient id={u + "am"} cx=".5" cy=".5" r=".5"><stop offset=".6" stopColor="#ffe8f1" /><stop offset="1" stopColor="#ffb3d1" /></radialGradient>
        <radialGradient id={u + "ag"} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ff6fa8" stopOpacity=".5" /><stop offset="1" stopColor="#ff6fa8" stopOpacity="0" /></radialGradient>
      </defs>
      <Stars n={24} seed={5} h={200} />
      <Shooting n={2} color="#ffc4dd" />
      <circle cx="440" cy="150" r="170" fill={`url(#${u}ag)`} />
      <circle cx="440" cy="150" r="96" fill={`url(#${u}am)`} />
      <path d="M0 420V260h40v-40h30v30h26v-70h44v80h20v-40h40v60h30v-90h50v100h24v-50h40v40h30v-80h46v90h24v-30h40v50h36v-60h40v60h40v160z" fill="#16123a" />
      {windows}
      <rect x="150" y="196" width="30" height="8" rx="3" fill="#ff6fa8" className="ta-flicker" />
      <rect x="436" y="210" width="8" height="34" rx="3" fill="#46e2ff" className="ta-flicker" style={{ animationDelay: "1.3s" }} />
      <path d="M200 420v-74h440v74z" fill="#0d0b22" />
      <g stroke="#2a2458" strokeWidth="3"><path d="M200 346h440" />{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${210 + i * 38} 346v-30`} />)}<path d="M200 316h440" /></g>
      <g transform="translate(420 236)" fill="#0d0b22">
        <g className="ta-hair">
          <path d="M-8 -12c-20 6-30 36-24 62 4 18 0 40-14 56 22-4 40-20 46-44 6 20 30 30 52 30-14-14-18-34-16-56 4-30-18-52-44-48z" />
          <path d="M34 34c14 10 34 12 52 4-12-2-24-12-30-26z" />
        </g>
        <circle cx="12" cy="-4" r="26" />
        <path d="M-14-10a26 26 0 0 1 52 0" stroke="#ff6fa8" strokeWidth="5" fill="none" />
        <rect x="-20" y="-10" width="10" height="18" rx="4" fill="#ff6fa8" /><rect x="34" y="-10" width="10" height="18" rx="4" fill="#ff6fa8" />
        <path d="M-6 22c-12 10-16 40-12 66h70c4-30-2-56-16-66z" />
        <path d="M-10 86h66l12 26-16 52h-14l10-46h-26l-8 54h-14l2-56z" />
        <path d="M52 40c18 10 30 24 34 42l-10 4c-6-14-16-24-28-30z" />
      </g>
      <g transform="translate(640 0)">
        <path d="M0 30c-60 10-110 40-150 80M-90 60c-10 20-6 40 4 54M-130 92c-20 0-36 8-46 20" stroke="#3a2340" strokeWidth="6" fill="none" strokeLinecap="round" />
        {[[-150, 110], [-86, 114], [-176, 112], [-60, 50], [-110, 74], [-30, 40]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>{[0, 72, 144, 216, 288].map((r) => <ellipse key={r} rx="5" ry="9" cy="-8" fill="#ffc4dd" transform={`rotate(${r})`} />)}<circle r="3" fill="#ff6fa8" /></g>
        ))}
      </g>
    </g>
  );
}

function Halloween({ u }) {
  const Pumpkin = ({ x, y, s = 1 }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="40" ry="32" fill="#ff8a1f" />
      <ellipse cx="-18" cy="0" rx="18" ry="31" fill="#f07410" /><ellipse cx="18" cy="0" rx="18" ry="31" fill="#f07410" />
      <ellipse cx="0" cy="0" rx="14" ry="32" fill="#ff9d3d" />
      <path d="M-4-30c0-10 4-16 10-18" stroke="#3d7a2a" strokeWidth="6" fill="none" strokeLinecap="round" />
      <g fill="#ffe27a" className="ta-flicker"><path d="M-22-6l10-10 6 10zM6-6l10-10 6 10z" /><path d="M-24 8q24 22 48 0l-6 4-6-4-6 6-6-6-6 6-6-6-6 4z" /></g>
    </g>
  );
  return (
    <g>
      <defs><radialGradient id={u + "hm"} cx=".5" cy=".5" r=".5"><stop offset=".55" stopColor="#ffd08a" /><stop offset="1" stopColor="#ff8a1f" stopOpacity="0" /></radialGradient></defs>
      <Stars n={16} seed={7} h={180} />
      <circle cx="440" cy="140" r="130" fill={`url(#${u}hm)`} />
      <circle cx="440" cy="140" r="76" fill="#ffd08a" />

      <path d="M0 420V350c120-50 260-60 380-40s200 30 260 20v90z" fill="#1a1020" />
      <path d="M160 340c4-50-6-90-30-120M132 250c-24-10-40-30-44-50M140 230c20-20 50-24 70-16M146 280c-20 0-34-10-44-22" stroke="#1a1020" strokeWidth="9" fill="none" strokeLinecap="round" />
      <Pumpkin x={300} y={354} /><Pumpkin x={372} y={368} s={0.7} /><Pumpkin x={560} y={368} s={0.85} />

    </g>
  );
}

function Christmas() {
  const Tree = ({ x, y, s = 1 }) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0-120l40 50h-18l32 40h-20l36 44h-140l36-44h-20l32-40h-18z" fill="#1b6b3f" />
      <path d="M0-120l40 50h-18l4 5-26-10-26 10 4-5h-18zM-22-30l-10 0 20-6 22 8 22-8 18 6h-10" fill="#fff" opacity=".9" />
      <rect x="-8" y="14" width="16" height="16" fill="#5a3520" />
      <path d="M0-134l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#ffd166" className="ta-twinkle" />
    </g>
  );
  return (
    <g>
      <Stars n={20} seed={2} h={200} />
      <path d="M0 420V350c140-40 280-44 420-20s180 16 220 10v80z" fill="#eef4ff" />
      <path d="M0 420v-40c160-20 320-20 640 0v40z" fill="#d6e2f7" />
      <Tree x={150} y={340} /><Tree x={560} y={330} s={0.8} /><Tree x={230} y={350} s={0.6} />

      {[[290, 366, "#d4263a", "#ffd166"], [324, 374, "#1f9d55", "#fff"]].map(([x, y, c, r], i) => (
        <g key={i} transform={`translate(${x} ${y})`}><rect x="-18" y="-18" width="36" height="30" rx="3" fill={c} /><rect x="-3" y="-18" width="6" height="30" fill={r} /><rect x="-18" y="-8" width="36" height="6" fill={r} /><path d="M0-18c-10-12-18-4-10 0zM0-18c10-12 18-4 10 0z" fill={r} /></g>
      ))}
    </g>
  );
}

function Ocean({ u }) {
  return (
    <g>
      <defs><linearGradient id={u + "or"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#bdeaff" stopOpacity=".35" /><stop offset="1" stopColor="#bdeaff" stopOpacity="0" /></linearGradient></defs>
      {[[300, 40], [400, 60], [520, 50]].map(([x, w], i) => <path key={i} d={`M${x} 0h${w}l${w * 1.5} 360h-${w * 2}z`} fill={`url(#${u}or)`} />)}

      <path d="M0 420v-50c120-20 250-26 380-10s200 10 260 4v56z" fill="#0b2a3a" />
      <g stroke="#14e0c4" strokeWidth="7" fill="none" strokeLinecap="round" opacity=".8" className="ta-sway">
        <path d="M90 380c-10-30 10-50 0-80s10-40 4-60" /><path d="M120 384c10-30-8-46 2-72" /><path d="M590 376c-10-24 8-40-2-66s8-30 2-50" />
      </g>
      <g fill="#ff6f8a">
        <path d="M430 380c-4-20-20-30-16-46 8 6 12 16 14 24 2-16 8-30 18-36 0 16-4 30-8 40 8-8 18-12 26-10-8 10-18 18-24 28z" />
      </g>
      {[[300, 300], [312, 270], [304, 244], [470, 180], [478, 156]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3 + (i % 3) * 2} fill="none" stroke="#bdeaff" strokeWidth="1.5" opacity=".6" className="ta-rise" style={{ animationDelay: `${i * 0.9}s` }} />)}
    </g>
  );
}

function Forest() {
  return (
    <g>
      <Stars n={10} seed={4} h={150} fill="#fffbe6" />
      <circle cx="470" cy="110" r="48" fill="#ffe7b0" opacity=".8" />
      {[[0, "#1e2d1a", 0.9], [30, "#16210f", 1]].map(([dy, c, o], l) => (
        <g key={l} fill={c} opacity={o}>
          {Array.from({ length: 9 }, (_, i) => { const x = i * 80 + (l ? 40 : 0), h = 120 + ((i * 37 + l * 20) % 70); return <path key={i} d={`M${x} ${340 + dy}l30-${h}l30 ${h}z`} />; })}
        </g>
      ))}
      <path d="M0 420v-70c160-16 320-18 640 0v70z" fill="#121a0e" />

      {[[250, 380], [280, 386]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${i ? 0.7 : 1})`}><rect x="-5" y="-6" width="10" height="16" rx="3" fill="#fff3e0" /><path d="M-18-4c0-14 8-20 18-20s18 6 18 20z" fill="#d4572e" /><circle cx="-6" cy="-14" r="2.6" fill="#fff" /><circle cx="6" cy="-10" r="2" fill="#fff" /></g>
      ))}
      {[[200, 250], [320, 220], [540, 260], [500, 200], [150, 300]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#e7f57a" className="ta-wander" style={{ animationDelay: `${i * -1.7}s` }} />)}
    </g>
  );
}

function Cyberpunk() {
  return (
    <g>
      <g stroke="#00f0ff" strokeWidth="1.2" opacity=".35">{Array.from({ length: 26 }, (_, i) => <path key={i} className="ta-rain" style={{ animationDelay: `${(i * 0.37) % 1.6}s` }} d={`M${(i * 53) % 640} 0l-6 26`} />)}</g>
      <g stroke="#ff2bd6" strokeWidth="1.2" opacity=".5" className="ta-grid">
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M0 ${330 + i * i * 2.4}h640`} />)}
        {Array.from({ length: 17 }, (_, i) => <path key={"v" + i} d={`M320 330L${-320 + i * 80} 420`} />)}
      </g>
      <g fill="#100d1c">
        <path d="M60 330V160h50v-30h20v30h30v170zM180 330V200h60v130zM260 330V100h40l10-30 10 30h40v230zM380 330V180h70v150zM470 330V130h50v200zM540 330V210h70v120z" />
      </g>
      <g className="ta-flicker">
        <rect x="70" y="180" width="30" height="4" fill="#00f0ff" /><rect x="70" y="196" width="22" height="4" fill="#00f0ff" />
        <rect x="270" y="120" width="70" height="20" rx="3" fill="none" stroke="#ff2bd6" strokeWidth="3" />
        <text x="305" y="135" fill="#ff2bd6" fontSize="13" fontWeight="800" textAnchor="middle" fontFamily="monospace">MOONY</text>
        <rect x="480" y="150" width="6" height="120" fill="#f5e400" />
      </g>
      <g fill="#f5e400" opacity=".7">{Array.from({ length: 30 }, (_, i) => <rect key={i} x={190 + (i % 6) * 8 + Math.floor(i / 6) * 60 * (i % 2)} y={210 + Math.floor(i / 6) * 18} width="4" height="6" />)}</g>
      <g transform="translate(430 236)">
        <path d="M-34 100c0-40 4-70 14-84 6-8 14-12 20-12s14 4 20 12c10 14 14 44 14 84z" fill="#0a0812" />
        <path d="M-22 10c-4-28 4-46 22-50s28 22 22 50c-10 8-34 8-44 0z" fill="#0a0812" />
        <path d="M-14-8h28l-3 8h-22z" fill="#00f0ff" className="ta-flicker" />
        <path d="M-14-8h28" stroke="#00f0ff" strokeWidth="6" opacity=".35" />
        <path d="M-30 40l-10 50M30 40l12 46" stroke="#ff2bd6" strokeWidth="2" opacity=".8" />
      </g>
    </g>
  );
}

function Galaxy({ u }) {
  return (
    <g>
      <defs>
        <radialGradient id={u + "gp"} cx=".35" cy=".35" r=".7"><stop offset="0" stopColor="#ffb3f0" /><stop offset=".6" stopColor="#b07dff" /><stop offset="1" stopColor="#3f2a8a" /></radialGradient>
        <radialGradient id={u + "gn"} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ff5ad0" stopOpacity=".35" /><stop offset="1" stopColor="#3f6dff" stopOpacity="0" /></radialGradient>
        <linearGradient id={u + "gv"} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3fd0ff" /><stop offset="1" stopColor="#8a4dff" /></linearGradient>
      </defs>
      <ellipse cx="380" cy="200" rx="300" ry="160" fill={`url(#${u}gn)`} />
      <Stars n={40} seed={9} h={420} />
      <Shooting n={3} color="#e3d1ff" />
      <g transform="translate(470 290)">
        <ellipse rx="130" ry="26" fill="none" stroke="#e3d1ff" strokeWidth="8" opacity=".55" transform="rotate(-14)" />
        <circle r="80" fill={`url(#${u}gp)`} />
        <path d="M-126 30a130 26-14 0 0 252-62" fill="none" stroke="#e3d1ff" strokeWidth="8" opacity=".8" transform="rotate(0)" />
        <circle cx="-26" cy="-20" r="14" fill="#fff" opacity=".12" /><circle cx="20" cy="22" r="10" fill="#3f2a8a" opacity=".3" />
      </g>
      <g transform="translate(250 180)"><g className="ta-tumble">
        <path d="M40 30c20 0 30 10 30 20" stroke="#e8e6f5" strokeWidth="3" fill="none" strokeDasharray="4 4" />
        <rect x="-30" y="10" width="60" height="62" rx="22" fill="#f4f2ff" />
        <rect x="-38" y="16" width="16" height="40" rx="8" fill="#d8d4ef" />
        <path d="M-30 30c-20 4-30 16-30 28M30 30c18-10 30-26 30-38" stroke="#f4f2ff" strokeWidth="16" strokeLinecap="round" fill="none" />
        <path d="M-16 70v30M16 70v26" stroke="#f4f2ff" strokeWidth="18" strokeLinecap="round" />
        <circle cy="-14" r="34" fill="#f4f2ff" />
        <rect x="-24" y="-30" width="48" height="32" rx="16" fill={`url(#${u}gv)`} />
        <path d="M-14-24q8-4 14-2" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".7" />
        <rect x="-10" y="30" width="20" height="12" rx="3" fill="#b07dff" />
      </g></g>
      <circle cx="130" cy="120" r="16" fill="#ffd27a" opacity=".85" /><circle cx="124" cy="114" r="4" fill="#fff" opacity=".4" />
    </g>
  );
}

function Sunset({ u }) {
  return (
    <g>
      <defs>
        <linearGradient id={u + "ss"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd166" /><stop offset=".55" stopColor="#ff8f5a" /><stop offset="1" stopColor="#ff5e9a" /></linearGradient>
        <mask id={u + "sm"}><rect width="640" height="420" fill="#fff" />{[0, 1, 2, 3, 4].map((i) => <rect key={i} x="0" y={226 + i * 16} width="640" height={3 + i * 1.6} fill="#000" />)}</mask>
      </defs>
      <circle className="ta-glow" cx="380" cy="230" r="130" fill={`url(#${u}ss)`} mask={`url(#${u}sm)`} />
      <path d="M0 330l90-90 60 50 90-110 100 120 60-50 110 80 130-60v70z" fill="#3a1c2c" />
      <path d="M0 330l130-50 90 30 100-60 100 70 90-40 130 50z" fill="#2a1420" />
      <rect y="330" width="640" height="90" fill="#1d0e17" />
      <g stroke="#ff8f5a" strokeWidth="2.4" opacity=".45">{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${300 - i * 20} ${344 + i * 14}h${160 + i * 40}`} />)}</g>
      {[[120, 340, 1], [560, 336, 0.85]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`} fill="#1a0b13" className="ta-sway">
          <path d="M-4 0c4-60 10-110 24-160l6 2c-12 50-16 100-18 158z" />
          <path d="M22-160c-30-20-60-14-80 4 26-8 50-4 80-4zM22-160c-10-30-40-40-60-34 26 6 44 18 60 34zM22-160c20-28 52-30 72-16-26 0-50 6-72 16zM22-160c30-10 60 4 74 26-26-14-50-20-74-26zM22-160c-4 30-26 50-48 56 20-18 34-36 48-56z" />
        </g>
      ))}
      {[[200, 120], [230, 100], [256, 126]].map(([x, y], i) => <path key={i} d={`M${x} ${y}q8-8 14 0q6-8 14 0`} stroke="#3a1c2c" strokeWidth="2.6" fill="none" className="ta-fly" style={{ animationDelay: `${i * -0.6}s`, animationDuration: "22s" }} />)}
    </g>
  );
}

function Mono() {
  return (
    <g fill="none" stroke="#fff" strokeWidth="1.6" opacity=".55">
      <circle cx="430" cy="160" r="80" /><circle cx="430" cy="160" r="110" opacity=".4" />
      <path d="M40 360l140-150 90 90 110-140 150 170 110-70" />
      <path d="M0 380h640M0 396h640" opacity=".4" />
      {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${220 + i * 18} 120l120 220`} opacity=".15" />)}
    </g>
  );
}

const SCENES = { midnight: Midnight, kawaii: Kawaii, anime: Anime, halloween: Halloween, christmas: Christmas, ocean: Ocean, forest: Forest, cyberpunk: Cyberpunk, galaxy: Galaxy, sunset: Sunset, mono: Mono };

export function SceneArt({ id, className = "theme-scene" }) {
  const u = useId().replace(/:/g, "");
  const S = SCENES[id];
  if (!S) return null;
  return (
    <svg className={className} viewBox="0 0 640 420" preserveAspectRatio="xMaxYMax meet" aria-hidden>
      <S u={u} />
    </svg>
  );
}

const Bow = ({ c = "#ff7eb6" }) => (
  <g><path d="M0 0c-26-22-46-8-42 8 4 18 24 14 42-8zM0 0c26-22 46-8 42 8-4 18-24 14-42-8z" fill={c} /><path d="M-4 4l-14 30 10-2 6 10 4-36zM4 4l14 30-10-2-6 10-4-36z" fill={c} opacity=".85" /><circle r="8" fill="#ffd1e6" /></g>
);
const Heart = ({ x, y, s = 1, c = "#ff7eb6" }) => <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 10C-16 0-16-12-8-13-4-13.5 0-10 0-8 0-10 4-13.5 8-13 16-12 16 0 0 10z" fill={c} />;
const Blossom = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>{[0, 72, 144, 216, 288].map((r) => <ellipse key={r} rx="5" ry="9" cy="-8" fill="#ffc4dd" transform={`rotate(${r})`} />)}<circle r="3" fill="#ff6fa8" /></g>
);
const Leaf = ({ x, y, r = 0, c = "#7bd45a" }) => <path transform={`translate(${x} ${y}) rotate(${r})`} d="M0 0c10-14 26-14 34 0-8 14-24 14-34 0z" fill={c} />;

const DECOS = {
  kawaii: {
    tr: <g transform="translate(150 34) rotate(12)"><Bow /></g>,
    bl: <g><Heart x={30} y={120} s={1.8} /><Heart x={64} y={140} s={1.1} c="#c58bff" /><Heart x={18} y={86} s={0.9} c="#ffd1e6" /></g>,
  },
  anime: {
    tr: <g><path d="M200 0c-30 20-70 30-110 34M130 30c-6 14-4 28 4 38" stroke="#3a2340" strokeWidth="5" fill="none" strokeLinecap="round" /><Blossom x={96} y={36} /><Blossom x={136} y={68} s={0.8} /><Blossom x={160} y={22} s={0.9} /><Blossom x={60} y={30} s={0.6} /></g>,
  },
  halloween: {
    tr: <g stroke="#cfc6e0" strokeWidth="1.2" fill="none" opacity=".6"><path d="M200 0L110 90M200 0L140 110M200 0L90 50M200 0L170 120" /><path d="M176 24q-22 10-34-12M160 40q-34 14-50-18M190 56q-10 26-40 22M180 82q-16 30-40 22" /><path d="M150 0v70" opacity=".9" /><g fill="#1a1020" stroke="none"><circle cx="150" cy="76" r="7" /><path d="M143 72l-8-6M143 78l-8 2M157 72l8-6M157 78l8 2" stroke="#1a1020" strokeWidth="1.6" /></g></g>,
  },
  christmas: {
    bl: <g><Leaf x={20} y={120} r={-30} c="#1f9d55" /><Leaf x={22} y={120} r={-80} c="#1b6b3f" /><Leaf x={24} y={122} r={10} c="#1f9d55" /><circle cx="26" cy="118" r="6" fill="#d4263a" /><circle cx="36" cy="124" r="5" fill="#f0475a" /><circle cx="22" cy="128" r="5" fill="#d4263a" /></g>,
  },
  ocean: {
    bl: <g stroke="#14e0c4" strokeWidth="6" fill="none" strokeLinecap="round" opacity=".7" className="ta-sway"><path d="M20 160c-10-30 10-46 0-80s8-40 2-60" /><path d="M44 160c8-26-6-40 4-66" /><path d="M64 160c-6-16 4-26-2-40" stroke="#2fb8ff" /></g>,
  },
  forest: {
    tr: <g><path d="M200 0c-20 30-60 40-90 70" stroke="#4fae35" strokeWidth="3" fill="none" /><Leaf x={170} y={20} r={150} c="#7bd45a" /><Leaf x={140} y={44} r={200} c="#e8a33d" /><Leaf x={116} y={64} r={170} c="#d4572e" /><Leaf x={150} y={34} r={60} c="#4fae35" /></g>,
  },
  cyberpunk: {
    tr: <g stroke="#00f0ff" strokeWidth="3" fill="none"><path d="M196 4v40M196 4h-40" /><path d="M186 14h-14M186 14v14" stroke="#ff2bd6" /></g>,
    bl: <g stroke="#ff2bd6" strokeWidth="3" fill="none"><path d="M4 156v-40M4 156h40" /><path d="M14 146h14M14 146v-14" stroke="#00f0ff" /></g>,
  },
  galaxy: {
    tr: <g><circle cx="160" cy="44" r="16" fill="#b07dff" /><ellipse cx="160" cy="44" rx="28" ry="6" fill="none" stroke="#e3d1ff" strokeWidth="2.4" transform="rotate(-18 160 44)" /><Stars n={8} w={200} h={100} seed={11} /></g>,
  },
  midnight: { tr: <g><Stars n={10} w={200} h={90} seed={13} /></g> },
  sunset: { tr: <g stroke="#ffc89a" strokeWidth="2.4" fill="none" opacity=".7">{[[120, 40], [146, 28], [170, 50]].map(([x, y], i) => <path key={i} d={`M${x} ${y}q7-7 12 0q5-7 12 0`} />)}</g> },
};

export function FrameDeco({ id }) {
  const d = DECOS[id];
  if (!d) return null;
  return (
    <>
      {d.tr && <svg className="frame-deco tr" viewBox="0 0 200 160" aria-hidden>{d.tr}</svg>}
      {d.bl && <svg className="frame-deco bl" viewBox="0 0 200 160" aria-hidden>{d.bl}</svg>}
    </>
  );
}
