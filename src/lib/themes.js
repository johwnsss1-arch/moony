// Moony themes. Each sets the colour palette, a background particle effect,
// the wordmark colours and optional decorations. Colours are CSS variables
// read by every stylesheet, so a theme restyles the whole app at once.
//
// particles: snow | sakura | hearts | stars | embers | bubbles | leaves | null
// festive: Christmas lights + snow caps on cards
// logo: hat | bow | witch | null (decoration on the moon logo)

const dark = (o = {}) => ({
  "--bg-0": "#0a0b0e", "--bg-1": "#0f1014", "--surface": "#14151a", "--surface-2": "#1a1b21", "--surface-3": "#22232b",
  "--text": "#ececf1", "--text-2": "#a4a6b3", "--text-3": "#6c6e7b", ...o,
});

export const THEMES = [
  {
    id: "midnight", name: "Midnight", desc: "Moony's clean black look, like the website",
    accent: ["#f5f5f5", "#d4d4d4"],
    vars: dark({ "--bg-0": "#050505", "--bg-1": "#0a0a0a", "--surface": "#111111", "--surface-2": "#171717", "--surface-3": "#202020", "--text": "#f5f5f5", "--text-2": "#a3a3a3", "--text-3": "#6b6b6b", "--line": "#1f1f1f", "--line-2": "#2a2a2a" }),
    ambient: ["#ffffff", "#9a9a9a", "#555555"], particles: "stars", logo: null,
    wordmark: ["#ffffff", "#ffffff", "#d4d4d4"],
  },
  {
    id: "christmas", name: "Christmas", desc: "Snow, string lights and a Santa hat",
    accent: ["#f0475a", "#c8243a"], vars: dark(), ambient: ["#d4263a", "#1f9d55", "#ffd166"], particles: "snow", festive: true, logo: "hat",
    wordmark: ["#ffffff", "#ffe1e4", "#ff9aa6"],
  },
  {
    id: "kawaii", name: "Kawaii", desc: "Pastel pink with bows and floating hearts",
    accent: ["#ff7eb6", "#e85d9f"],
    vars: dark({ "--bg-0": "#1a0f17", "--bg-1": "#21131d", "--surface": "#2a1825", "--surface-2": "#331d2d", "--surface-3": "#3e2437", "--text": "#fff0f7", "--text-2": "#e7b9cf", "--text-3": "#a87d93" }),
    ambient: ["#ff7eb6", "#c58bff", "#ffd1e6"], particles: "hearts", logo: "bow",
    wordmark: ["#ffffff", "#ffd1e6", "#ff7eb6"],
  },
  {
    id: "anime", name: "Anime Night", desc: "Neon city night with falling cherry blossoms",
    accent: ["#ff6fa8", "#7a8cff"],
    vars: dark({ "--bg-0": "#0b0a18", "--bg-1": "#100e22", "--surface": "#171431", "--surface-2": "#1e1a3d", "--surface-3": "#28224d", "--text": "#f2efff", "--text-2": "#b3acd9", "--text-3": "#776fa3" }),
    ambient: ["#ff6fa8", "#7a8cff", "#46e2ff"], particles: "sakura", logo: null,
    wordmark: ["#ffffff", "#ffc4dd", "#9aa6ff"],
  },
  {
    id: "halloween", name: "Halloween", desc: "Pumpkin orange, purple dusk and rising embers",
    accent: ["#ff8a1f", "#e0600b"],
    vars: dark({ "--bg-0": "#0d0a10", "--bg-1": "#130e17", "--surface": "#1b1420", "--surface-2": "#231a2a", "--surface-3": "#2e2236" }),
    ambient: ["#ff8a1f", "#8a3dff", "#3ddc6a"], particles: "embers", logo: "witch",
    wordmark: ["#ffe7c2", "#ffb35c", "#ff7a1a"],
  },
  {
    id: "ocean", name: "Ocean", desc: "Deep sea blues with drifting bubbles",
    accent: ["#2fb8ff", "#1386d6"],
    vars: dark({ "--bg-0": "#061018", "--bg-1": "#08151f", "--surface": "#0d1d2a", "--surface-2": "#122535", "--surface-3": "#183042", "--text": "#e9f7ff", "--text-2": "#9fc2d6", "--text-3": "#62839a" }),
    ambient: ["#2fb8ff", "#14e0c4", "#3a5cff"], particles: "bubbles", logo: null,
    wordmark: ["#ffffff", "#bdeaff", "#5cd0ff"],
  },
  {
    id: "forest", name: "Autumn Forest", desc: "Warm greens and falling leaves",
    accent: ["#7bd45a", "#4fae35"],
    vars: dark({ "--bg-0": "#0a0e09", "--bg-1": "#0e130c", "--surface": "#151c12", "--surface-2": "#1b2417", "--surface-3": "#242f1f", "--text": "#f0f5ea", "--text-2": "#b3c2a6", "--text-3": "#76866a" }),
    ambient: ["#7bd45a", "#e8a33d", "#d4572e"], particles: "leaves", logo: null,
    wordmark: ["#fffbe6", "#e7f5c8", "#9be27b"],
  },
  {
    id: "cyberpunk", name: "Cyberpunk", desc: "Electric yellow and magenta neon",
    accent: ["#f5e400", "#d1c200"],
    vars: dark({ "--bg-0": "#08070d", "--bg-1": "#0c0b13", "--surface": "#13111d", "--surface-2": "#1a1727", "--surface-3": "#241f35" }),
    ambient: ["#ff2bd6", "#00f0ff", "#f5e400"], particles: "stars", logo: null,
    wordmark: ["#fffbe0", "#f5e400", "#ff2bd6"],
  },
  {
    id: "galaxy", name: "Galaxy", desc: "Purple nebula full of stars",
    accent: ["#b07dff", "#8a4dff"],
    vars: dark({ "--bg-0": "#07051a", "--bg-1": "#0b0822", "--surface": "#120e2e", "--surface-2": "#18133a", "--surface-3": "#211a4a" }),
    ambient: ["#b07dff", "#ff5ad0", "#3f6dff"], particles: "stars", logo: null,
    wordmark: ["#ffffff", "#e3d1ff", "#b07dff"],
  },
  {
    id: "sunset", name: "Sunset", desc: "Golden hour oranges and pinks",
    accent: ["#ff8f5a", "#ff5e62"],
    vars: dark({ "--bg-0": "#120a0c", "--bg-1": "#180e10", "--surface": "#211416", "--surface-2": "#2a191c", "--surface-3": "#352024" }),
    ambient: ["#ff8f5a", "#ff5e9a", "#ffd166"], particles: null, logo: null,
    wordmark: ["#fff3e0", "#ffc89a", "#ff7a7a"],
  },
  {
    id: "mono", name: "Monochrome", desc: "Clean greys, no colour, no effects",
    accent: ["#e6e6e6", "#bdbdbd"],
    vars: dark({ "--bg-0": "#0b0b0b", "--bg-1": "#101010", "--surface": "#161616", "--surface-2": "#1d1d1d", "--surface-3": "#262626", "--text": "#f2f2f2", "--text-2": "#a8a8a8", "--text-3": "#6e6e6e" }),
    ambient: ["#ffffff", "#9a9a9a", "#5a5a5a"], particles: null, logo: null,
    wordmark: ["#ffffff", "#e0e0e0", "#a0a0a0"],
  },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES[0];

// Heading font of each theme (also set in pages5.css as --display).
export const THEME_FONTS = { midnight: "Fredoka", kawaii: "Baloo 2", anime: "M PLUS Rounded 1c", halloween: "Creepster", christmas: "Mountains of Christmas", ocean: "Baloo 2", forest: "Baloo 2", cyberpunk: "Orbitron", galaxy: "Space Grotesk", sunset: "Pacifico", mono: "Space Grotesk" };
