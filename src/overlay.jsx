import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource/bricolage-grotesque/latin-700.css";
import "./hud.css";
import { HudWidget } from "./components/HudWidgets";
import { Crosshair } from "./components/Crosshair";
import { listen } from "@tauri-apps/api/event";

if (window.__TAURI_INTERNALS__ && !window.moonyOverlay) window.moonyOverlay = { onState: (cb) => { listen("overlay:state", (e) => cb(e.payload)); } };

function Hud() {
  const [state, setState] = useState(null);
  useEffect(() => { window.moonyOverlay?.onState(setState); }, []);
  if (!state?.prefs) return null;
  const { widgets = {}, opacity = 0.92, scale = 1, crosshair } = state.prefs;
  const xhair = crosshair?.on && <div className="hud-crosshair"><Crosshair c={crosshair} /></div>;
  if (!state.prefs.enabled) return xhair || null;
  return (
    <div className={"hud-root t-" + (state.prefs.theme || "moonlight") + " s-" + (state.prefs.style || "readout")} style={{ opacity, "--hud-scale": scale, "--hud-acc": state.prefs.accent || "#8b7dff", "--viz": state.prefs.accent || "#8b7dff" }}>
      {Object.entries(widgets).filter(([, w]) => w.on).map(([id, w]) => (
        <div key={id} className="hud-place" style={{ left: `${w.x}%`, top: `${w.y}%` }}>
          <HudWidget id={id} state={state} />
        </div>
      ))}
      {xhair}
    </div>
  );
}

createRoot(document.getElementById("hud")).render(<StrictMode><Hud /></StrictMode>);
