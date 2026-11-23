import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export function useUpdate() {
  const [s, setS] = useState(null);
  useEffect(() => {
    const u = window.orbit?.update;
    if (!u) return;
    u.get().then(setS);
    return u.onState(setS);
  }, []);
  return s;
}

export function UpdateBanner() {
  const s = useUpdate();
  const [hidden, setHidden] = useState(false);
  if (!s || s.status !== "ready" || hidden) return null;
  return (
    <div className="update-banner">
      <Download size={16} />
      <span><b>Moony {s.version}</b> is ready to install.</span>
      <button className="btn primary sm" onClick={() => window.orbit.update.apply()}>Restart to update</button>
      <button className="icon-btn" title="Later (installs when you quit)" onClick={() => setHidden(true)}><X size={15} /></button>
    </div>
  );
}
