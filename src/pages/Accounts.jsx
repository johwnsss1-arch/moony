import { useState } from "react";
import { BadgeCheck, CheckCircle2, ExternalLink, KeyRound, LogIn, LogOut, Plus, ShieldCheck, Trash2, UserPlus, UserSearch } from "lucide-react";
import { useApp } from "../lib/store";
import { api, auth } from "../lib/bridge";
import { Avatar, Empty, Modal, Toggle } from "../components/ui";

export default function Accounts() {
  const { accounts, setAccounts, activeAccount, setActiveId, toast, isSignedIn, signIn, signOut, openProfile } = useApp();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const sel = accounts.find((a) => a.id === (selected ?? activeAccount?.id)) || null;

  const update = (id, patch) => setAccounts((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = async (a) => {
    if (!window.confirm(`Remove ${a.displayName} from Moony?${isSignedIn(a.id) ? " This also signs it out." : ""}`)) return;
    if (isSignedIn(a.id)) await signOut(a.id);
    setAccounts((l) => l.filter((x) => x.id !== a.id));
    if (activeAccount?.id === a.id) setActiveId(null);
    setSelected(null);
    toast(`Removed ${a.displayName}`);
  };
  const doSignIn = async () => {
    setBusy(true);
    const u = await signIn();
    setBusy(false);
    if (u) { setSelected(u.id); setAdding(false); }
  };
  const doSignOut = async (a) => {
    if (!window.confirm(`Sign out of ${a.displayName}? It stays linked as a profile.`)) return;
    await signOut(a.id);
    toast(`Signed out of ${a.displayName}`);
  };

  return (
    <div className="page accounts">
      <div className="page-head row">
        <div><h1>Accounts</h1><p>Keep all your Roblox accounts in one place and switch between them.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}><Plus size={15} /> Add account</button>
      </div>

      {accounts.length === 0 ? (
        <Empty icon={UserPlus} title="No accounts yet" text="Sign in with Roblox to play as your account and see your friends."
          action={<button className="btn primary" onClick={() => setAdding(true)}><Plus size={15} /> Add account</button>} />
      ) : (
        <div className="acct-layout">
          <div className="acct-list">
            {accounts.map((a) => (
              <button key={a.id} className={"acct-row" + (sel?.id === a.id ? " sel" : "")} onClick={() => setSelected(a.id)}>
                <Avatar src={a.avatar} size={42} alt={a.name} />
                <span className="grow">
                  <b>{a.label || a.displayName} {a.verified && <BadgeCheck size={13} className="verified" />}</b>
                  <small className={isSignedIn(a.id) ? "signed" : ""}>{isSignedIn(a.id) ? "Signed in" : "Profile only"} · @{a.name}</small>
                </span>
                {activeAccount?.id === a.id ? <span className="pill active"><CheckCircle2 size={12} /> Active</span> : null}
              </button>
            ))}
          </div>

          {sel && (
            <div className="acct-detail" key={sel.id}>
              <div className="acct-hero">
                <Avatar src={sel.avatar} size={84} alt={sel.name} />
                <div className="grow">
                  <h2>{sel.displayName}</h2>
                  <small>@{sel.name} · ID {sel.id}</small>
                </div>
                {activeAccount?.id === sel.id
                  ? <span className="pill active lg"><CheckCircle2 size={14} /> Active account</span>
                  : <button className="btn primary" onClick={() => { setActiveId(sel.id); toast(`Switched to ${sel.displayName}`, "success"); }}>Switch to this account</button>}
              </div>

              <div className={"session-card" + (isSignedIn(sel.id) ? " on" : "")}>
                {isSignedIn(sel.id) ? <ShieldCheck size={18} /> : <KeyRound size={18} />}
                <div className="grow">
                  <b>{isSignedIn(sel.id) ? "Signed in" : "Not signed in"}</b>
                  <small>{isSignedIn(sel.id)
                    ? "Games launch as this account when it's active, and you can see and join its friends."
                    : "Linked by public profile only. Sign in to launch games as this account and see its friends."}</small>
                </div>
                {isSignedIn(sel.id)
                  ? <button className="btn ghost sm" onClick={() => doSignOut(sel)}><LogOut size={13} /> Sign out</button>
                  : <button className="btn primary sm" disabled={!auth || busy} title={!auth ? "Works in the desktop app" : undefined} onClick={doSignIn}><LogIn size={13} /> {busy ? "Waiting…" : "Sign in"}</button>}
              </div>

              <div className="settings-group">
                <div className="setting">
                  <div><b>Nickname</b><small>Shown in Moony instead of the display name.</small></div>
                  <input className="input" value={sel.label || ""} placeholder={sel.displayName} maxLength={24} onChange={(e) => update(sel.id, { label: e.target.value })} />
                </div>
                <div className="setting">
                  <div><b>Show in quick switcher</b><small>List this account in the title bar and side panel.</small></div>
                  <Toggle checked={!sel.hidden} onChange={(v) => update(sel.id, { hidden: !v })} />
                </div>
                <div className="setting">
                  <div><b>Profile</b><small>This account's profile, stats and 3D avatar.</small></div>
                  <button className="btn ghost sm" onClick={() => openProfile(sel)}>View profile</button>
                </div>
                <div className="setting">
                  <div><b>Remove account</b><small>Unlinks it from Moony and signs it out. Nothing changes on Roblox.</small></div>
                  <button className="btn danger sm" onClick={() => remove(sel)}><Trash2 size={13} /> Remove</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <AddAccount open={adding} busy={busy} onClose={() => setAdding(false)} onSignIn={doSignIn} onAdd={(u) => {
        if (accounts.some((a) => a.id === u.id)) return toast(`${u.displayName} is already linked`, "error");
        setAccounts((l) => [...l, u]);
        if (!activeAccount) setActiveId(u.id);
        setSelected(u.id);
        toast(`Linked ${u.displayName}`, "success");
        setAdding(false);
      }} />
    </div>
  );
}

function AddAccount({ open, busy, onClose, onAdd, onSignIn }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [state, setState] = useState({ status: "idle" });
  const lookup = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setState({ status: "loading" });
    try { setState({ status: "found", user: await api("lookupUser", name) }); }
    catch (err) { setState({ status: "error", error: err.message }); }
  };
  const close = () => { onClose(); setTimeout(() => { setName(""); setMode("signin"); setState({ status: "idle" }); }, 200); };
  return (
    <Modal open={open} onClose={close} width={460} label="Add account">
      <div className="add-acct">
        <h2>Add a Roblox account</h2>
        {mode === "signin" ? (
          <>
            <p>Sign in on Roblox's own login page. Moony never sees your password. It keeps only the session Roblox gives it, encrypted on this PC.</p>
            <button className="btn primary lg wide-btn" disabled={!auth || busy} onClick={onSignIn}><LogIn size={16} /> {busy ? "Finish signing in the Roblox window…" : "Sign in with Roblox"}</button>
            {!auth && <div className="form-error">Sign-in works in the desktop app, not the browser preview.</div>}
            <ul className="fine-print">
              <li>Lets you launch games as this account and switch accounts in one click.</li>
              <li>Shows your real friends list, what they're playing, and a Join button.</li>
              <li>Sign out any time. That also ends the session on Roblox.</li>
            </ul>
            <button className="link center" onClick={() => setMode("lookup")}><UserSearch size={13} /> Add by username instead (profile only)</button>
          </>
        ) : (
          <form onSubmit={lookup}>
            <p>Links the account's public profile only. You can sign in to it later.</p>
            <div className="row-gap">
              <input className="input grow" autoFocus value={name} onChange={(e) => { setName(e.target.value); setState({ status: "idle" }); }} placeholder="Username" />
              <button className="btn secondary" type="submit" disabled={!name.trim() || state.status === "loading"}>{state.status === "loading" ? "Looking up…" : "Find"}</button>
            </div>
            {state.status === "error" && <div className="form-error">{state.error}</div>}
            {state.status === "found" && (
              <div className="found">
                <Avatar src={state.user.avatar} size={48} alt={state.user.name} />
                <div className="grow"><b>{state.user.displayName}</b><small>@{state.user.name}</small></div>
                <button type="button" className="btn primary" onClick={() => onAdd(state.user)}>Add</button>
              </div>
            )}
            <button type="button" className="link center" onClick={() => setMode("signin")}><LogIn size={13} /> Sign in with Roblox instead</button>
          </form>
        )}
      </div>
    </Modal>
  );
}
