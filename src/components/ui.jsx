import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, UserRound, X } from "lucide-react";

export function Toggle({ checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} className={"toggle" + (checked ? " on" : "")} onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  );
}

export function Select({ value, options, onChange, width = 180 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", esc); };
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div className="select" ref={ref} style={{ width }}>
      <button className={"select-btn" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)}>
        <span>{current?.label ?? "Select"}</span><ChevronDown size={15} />
      </button>
      <div className={"select-menu" + (open ? " open" : "")} role="listbox">
        {options.map((o) => (
          <button key={String(o.value)} role="option" aria-selected={o.value === value} className={o.value === value ? "on" : ""} onClick={() => { onChange(o.value); setOpen(false); }}>
            <span>{o.label}</span>{o.value === value && <Check size={14} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Slider({ value, min, max, step = 1, onChange, format = (v) => v }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ "--p": pct + "%" }} />
      <span className="slider-val">{format(value)}</span>
    </div>
  );
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export const Skeleton = ({ w = "100%", h = 14, r = 6, style }) => <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;

export function Img({ src, alt = "", className = "", ...rest }) {
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setLoaded(false); setAttempt(0); setFailed(false); }, [src]);
  const url = src && attempt ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}` : src;
  return (
    <div className={"img " + className + (loaded ? " loaded" : failed ? " failed" : " pending")} {...rest}>
      {src && !failed && (
        <img key={url} src={url} alt={alt} loading="lazy" decoding="async" draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => { if (attempt < 2) setTimeout(() => setAttempt((a) => a + 1), 800 * (attempt + 1)); else setFailed(true); }} />
      )}
    </div>
  );
}

export function Avatar({ src, size = 32, status, alt = "" }) {
  return (
    <span className="avatar-img" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={alt} draggable={false} /> : <span className="avatar-fallback">{/^[a-z0-9]/i.test(alt) ? alt[0].toUpperCase() : <UserRound size={size * 0.5} />}</span>}
      {status != null && <i className={"presence p" + status} />}
    </span>
  );
}

export function Modal({ open, onClose, children, width = 760, label }) {
  const [render, setRender] = useState(open);
  useEffect(() => {
    if (open) setRender(true);
    else { const t = setTimeout(() => setRender(false), 220); return () => clearTimeout(t); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!render) return null;
  return createPortal(
    <div className={"modal-root" + (open ? " open" : "")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-label={label}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        {children}
      </div>
    </div>,
    document.querySelector(".frame") || document.body,
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="empty-state">
      {Icon && <div className="empty-icon"><Icon size={22} /></div>}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <span>Couldn't reach Roblox: {message}</span>
      {onRetry && <button className="btn ghost sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
