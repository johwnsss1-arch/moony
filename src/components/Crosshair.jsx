// In-game crosshair, drawn as SVG at the centre of the HUD window.
export const CROSSHAIRS = [
  { id: "plus", label: "Plus" }, { id: "gap", label: "Gap" }, { id: "dot", label: "Dot" },
  { id: "ring", label: "Ring" }, { id: "t", label: "T" }, { id: "x", label: "X" }, { id: "chevron", label: "Chevron" },
];
export const CROSSHAIR_DEFAULT = { on: false, style: "gap", color: "#00ff88", size: 22, thickness: 2, gap: 4, outline: true, dot: false, opacity: 1 };

export function Crosshair({ c: c0 }) {
  const c = { ...CROSSHAIR_DEFAULT, ...c0 };
  const s = c.size, h = s / 2, t = c.thickness, g = c.gap;
  const lines = {
    plus: [[-h, 0, h, 0], [0, -h, 0, h]],
    gap: [[-h, 0, -g, 0], [g, 0, h, 0], [0, -h, 0, -g], [0, g, 0, h]],
    t: [[-h, 0, -g, 0], [g, 0, h, 0], [0, g, 0, h]],
    x: [[-h * 0.7, -h * 0.7, -g * 0.7, -g * 0.7], [g * 0.7, g * 0.7, h * 0.7, h * 0.7], [h * 0.7, -h * 0.7, g * 0.7, -g * 0.7], [-g * 0.7, g * 0.7, -h * 0.7, h * 0.7]],
    chevron: [[-h * 0.6, h * 0.35, 0, -h * 0.25], [0, -h * 0.25, h * 0.6, h * 0.35]],
  }[c.style] || [];
  const draw = (stroke, w) => (
    <g stroke={stroke} strokeWidth={w} fill="none" strokeLinecap="square">
      {lines.map(([a, b, x, y], i) => <line key={i} x1={a} y1={b} x2={x} y2={y} />)}
      {c.style === "ring" && <circle r={h * 0.6} />}
      {(c.style === "dot" || c.dot) && <circle r={Math.max(1, t * (c.style === "dot" ? 1.4 : 0.9))} fill={stroke} />}
    </g>
  );
  const pad = s + 8;
  return (
    <svg className="crosshair" width={pad} height={pad} viewBox={`${-pad / 2} ${-pad / 2} ${pad} ${pad}`} style={{ opacity: c.opacity }}>
      {c.outline && draw("rgba(0,0,0,.85)", t + 2)}
      {draw(c.color, t)}
    </svg>
  );
}
