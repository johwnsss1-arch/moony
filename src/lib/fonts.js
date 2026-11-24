// App font picker. Each font is bundled (works offline) and only loaded when picked.
export const UI_FONTS = [
  { id: "inter", label: "Inter", family: '"Inter Variable", Inter, "Segoe UI", sans-serif', load: null },
  { id: "space-grotesk", label: "Space Grotesk", family: '"Space Grotesk Variable", sans-serif', load: () => import("@fontsource-variable/space-grotesk") },
  { id: "outfit", label: "Outfit", family: '"Outfit Variable", sans-serif', load: () => import("@fontsource-variable/outfit") },
  { id: "sora", label: "Sora", family: '"Sora Variable", sans-serif', load: () => import("@fontsource-variable/sora") },
  { id: "nunito", label: "Nunito (rounded)", family: '"Nunito Variable", sans-serif', load: () => import("@fontsource-variable/nunito") },
  { id: "jetbrains", label: "JetBrains Mono", family: '"JetBrains Mono Variable", monospace', load: () => import("@fontsource-variable/jetbrains-mono") },
  { id: "pixel", label: "Pixel (Press Start)", family: '"Press Start 2P", monospace', load: () => import("@fontsource/press-start-2p"), small: true },
  { id: "system", label: "Windows (Segoe UI)", family: '"Segoe UI Variable Text", "Segoe UI", sans-serif', load: null },
];

export async function applyUiFont(id) {
  const f = UI_FONTS.find((x) => x.id === id) || UI_FONTS[0];
  try { await f.load?.(); } catch { /* keep the old font */ }
  const r = document.documentElement;
  if (f.id === "inter") { r.style.removeProperty("--ui-font"); r.classList.remove("font-small"); }
  else { r.style.setProperty("--ui-font", f.family); r.classList.toggle("font-small", !!f.small); }
}
