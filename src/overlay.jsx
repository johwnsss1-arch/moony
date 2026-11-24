import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./hud.css";
import { HudWidget } from "./components/HudWidgets";
import { listen } from "@tauri-apps/api/event";

// Rust build: state arrives as a Tauri event instead of Electron IPC.
if (window.__TAURI_INTERNALS__ && !window.moonyOverlay) window.moonyOverlay = { onState: (cb) => { listen("overlay:state", (e) => cb(e.payload)); } };

// The in-game HUD window: transparent and click-through, placed over Roblox.
function Hud() {
  const [state, setState] = useState(null);
  useEffect(() => { window.moonyOverlay?.onState(setState); }, []);
  if (!state?.prefs?.enabled) return null;
  const { widgets = {}, opacity = 0.92, scale = 1 } = state.prefs;
  return (
    <div className="hud-root" style={{ opacity, "--hud-scale": scale }}>
      {Object.entries(widgets).filter(([, w]) => w.on).map(([id, w]) => (
        <div key={id} className="hud-place" style={{ left: `${w.x}%`, top: `${w.y}%` }}>
          <HudWidget id={id} state={state} />
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("hud")).render(<StrictMode><Hud /></StrictMode>);
