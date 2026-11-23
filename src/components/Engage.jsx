// What's new popup, "How did you find Moony?" question and feedback.
// Feedback and the answer go to the Moony team through the main process
// (see feedback:send in electron/main.cjs). Nothing identifying is sent:
// no account names, IDs or cookies, only what the person types or picks.
import { useEffect, useState } from "react";
import { MessageSquareHeart, Sparkles, X, Send, Bug, Lightbulb, Heart } from "lucide-react";
import { useApp } from "../lib/store";
import { CHANGELOG } from "../lib/changelog";
import pkg from "../../package.json";

const VERSION = pkg.version;
const send = (payload) => window.orbit?.feedback?.send({ ...payload, version: VERSION }) ?? Promise.reject(new Error("Desktop app only"));

function Modal({ onClose, children, className = "" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOpen(true)); return () => cancelAnimationFrame(r); }, []);
  return (
    <div className={"modal-root" + (open ? " open" : "")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"modal eng-modal " + className}>
        <button className="modal-close" aria-label="Close" onClick={onClose}><X size={16} /></button>
        {children}
      </div>
    </div>
  );
}

export function WhatsNew() {
  const { settings, updateSettings } = useApp();
  // People updating from before this popup existed count as having seen 1.0.6.
  const seen = settings.lastSeenVersion ?? (settings.tourDone ? "1.0.6" : null);
  // First install: don't show it, just remember the version.
  useEffect(() => { if (!seen && settings.tourDone === undefined) updateSettings({ lastSeenVersion: VERSION }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!settings.tourDone || !seen || seen === VERSION) return null;
  const entries = CHANGELOG.filter((c) => cmp(c.version, seen) > 0);
  const close = () => updateSettings({ lastSeenVersion: VERSION });
  if (!entries.length) { close(); return null; }
  return (
    <Modal onClose={close} className="eng-new">
      <div className="eng-hero"><Sparkles size={22} /><div><small>What's new</small><h2>Moony {VERSION}</h2></div></div>
      {entries.map((c) => (
        <section key={c.version} className="eng-sec">
          <h3>{c.title} <span>v{c.version}</span></h3>
          <ul>{c.items.map((t, i) => <li key={i} style={{ animationDelay: `${i * 60}ms` }}>{t}</li>)}</ul>
        </section>
      ))}
      <div className="eng-actions"><button className="btn primary" onClick={close}>Nice!</button></div>
    </Modal>
  );
}

const SOURCES = ["TikTok", "YouTube", "Discord", "A friend", "Reddit", "Google / search", "Other"];
export function FoundUs() {
  const { settings, updateSettings } = useApp();
  const [other, setOther] = useState("");
  const [pick, setPick] = useState(null);
  // Ask once, a little after the welcome tour, and never on the very first screen.
  if (!settings.tourDone || settings.foundUsAsked || (settings.launches ?? 0) < 2) return null;
  const done = (answer) => {
    updateSettings({ foundUsAsked: true });
    if (answer) send({ kind: "source", text: answer }).catch(() => {});
  };
  return (
    <div className="eng-card">
      <button className="icon-btn eng-x" aria-label="Dismiss" onClick={() => done(null)}><X size={14} /></button>
      <b>Quick question: how did you find Moony?</b>
      <div className="eng-chips">
        {SOURCES.map((s) => <button key={s} className={"chip" + (pick === s ? " on" : "")} onClick={() => (s === "Other" ? setPick(s) : done(s))}>{s}</button>)}
      </div>
      {pick === "Other" && (
        <form className="eng-other" onSubmit={(e) => { e.preventDefault(); done(other.trim() ? `Other: ${other.trim().slice(0, 80)}` : "Other"); }}>
          <input className="input" autoFocus maxLength={80} placeholder="Where?" value={other} onChange={(e) => setOther(e.target.value)} />
          <button className="btn primary sm">Send</button>
        </form>
      )}
    </div>
  );
}

const KINDS = [["idea", Lightbulb, "Idea"], ["bug", Bug, "Bug"], ["love", Heart, "Love it"]];
export function FeedbackModal({ onClose }) {
  const { toast } = useApp();
  const [kind, setKind] = useState("idea");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (text.trim().length < 3) return;
    setBusy(true);
    try { await send({ kind, text: text.trim().slice(0, 1500) }); toast("Thanks! Your feedback was sent 💜", "success"); onClose(); }
    catch (err) { toast(err.message || "Couldn't send feedback. Try again later.", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal onClose={onClose} className="eng-fb">
      <div className="eng-hero"><MessageSquareHeart size={22} /><div><small>Feedback</small><h2>Tell us what you think</h2></div></div>
      <form onSubmit={submit}>
        <div className="eng-kinds">{KINDS.map(([k, Icon, label]) => <button type="button" key={k} className={"eng-kind" + (kind === k ? " on" : "")} onClick={() => setKind(k)}><Icon size={16} />{label}</button>)}</div>
        <textarea className="input eng-text" autoFocus maxLength={1500} placeholder={kind === "bug" ? "What happened, and what did you expect?" : kind === "idea" ? "What should Moony add or change?" : "What do you like about Moony?"} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="eng-note">Don't include passwords or personal info. Only your message, the type and your Moony version are sent.</p>
        <div className="eng-actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || text.trim().length < 3}><Send size={14} /> {busy ? "Sending…" : "Send"}</button></div>
      </form>
    </Modal>
  );
}

// A gentle nudge after a few sessions, shown once.
export function FeedbackNudge({ onOpen }) {
  const { settings, updateSettings } = useApp();
  if (!settings.tourDone || !settings.foundUsAsked || settings.feedbackNudged || (settings.launches ?? 0) < 4) return null;
  const close = () => updateSettings({ feedbackNudged: true });
  return (
    <div className="eng-card eng-nudge">
      <button className="icon-btn eng-x" aria-label="Dismiss" onClick={close}><X size={14} /></button>
      <MessageSquareHeart size={20} />
      <div><b>Enjoying Moony?</b><small>Tell us what to add next. It takes 10 seconds.</small></div>
      <button className="btn primary sm" onClick={() => { close(); onOpen(); }}>Give feedback</button>
    </div>
  );
}

// Counts app opens (used to time the question and the nudge).
export function useLaunchCounter() {
  const { settings, updateSettings } = useApp();
  useEffect(() => { updateSettings({ launches: (settings.launches ?? 0) + 1 }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

function cmp(a, b) {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  return 0;
}
