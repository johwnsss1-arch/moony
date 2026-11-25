export function Logo({ size = 26, variant = null, festive = false }) {
  const v = variant || (festive ? "hat" : null);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="moony-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f2f6ff" />
          <stop offset="0.45" stopColor={v ? "#d9dcf2" : "var(--accent)"} />
          <stop offset="1" stopColor={v ? "#9aa0c4" : "var(--accent-2)"} />
        </linearGradient>
      </defs>
      <g fill="url(#moony-g)" transform="translate(4.5 -1) skewX(-14)">
        <rect x="3" y="6" width="6" height="22" rx="3" />
        <rect x="13" y="6" width="6" height="22" rx="3" />
        <rect x="23" y="6" width="6" height="22" rx="3" />
      </g>
      {v === "hat" && (
        <g transform="rotate(-28 9 7)">
          <path d="M2.5 9.5 C4 3 9 0.5 15 3.5 L12.5 6 C10 5 7 6.5 6 9.5 Z" fill="#e5384a" />
          <rect x="1.5" y="8.6" width="6.6" height="2.6" rx="1.3" fill="#f4f8ff" />
          <circle cx="15.2" cy="3.4" r="1.7" fill="#f4f8ff" />
        </g>
      )}
      {v === "bow" && (
        <g transform="translate(5 5) rotate(-18)">
          <path d="M0 0 C-4 -4 -7 -1 -6 2 C-5 5 -2 3 0 0 Z" fill="#ff7eb6" />
          <path d="M0 0 C4 -4 7 -1 6 2 C5 5 2 3 0 0 Z" fill="#ff7eb6" />
          <circle cx="0" cy="0.4" r="1.6" fill="#ffd1e6" />
        </g>
      )}
      {v === "witch" && (
        <g transform="rotate(-22 8 8)">
          <path d="M2 10 L9 -2 L13 9 Z" fill="#3b1f5c" />
          <rect x="-0.5" y="8.6" width="16" height="2.4" rx="1.2" fill="#2a1542" />
          <rect x="6" y="6.4" width="5" height="1.6" fill="#ff8a1f" />
        </g>
      )}
    </svg>
  );
}
