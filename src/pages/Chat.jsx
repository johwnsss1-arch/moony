import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogIn, MessageSquare, Search, Send, X } from "lucide-react";
import { useApp } from "../lib/store";
import { ago } from "../lib/format";
import { Avatar, Empty, ErrorState, Skeleton } from "../components/ui";

const chatApi = () => window.orbit?.chat;
const dayLabel = (d) => new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

export default function Chat() {
  const { launchAs, signIn } = useApp();
  if (!launchAs || !chatApi()) {
    return (
      <div className="page">
        <div className="page-head"><h1>Chat</h1><p>Message your Roblox friends from Moony.</p></div>
        <Empty icon={MessageSquare} title="Sign in to chat" text="Your Roblox conversations load once you're signed in." action={chatApi() ? <button className="btn primary" onClick={() => signIn()}><LogIn size={14} /> Sign in</button> : null} />
      </div>
    );
  }
  return <ChatInner me={launchAs} />;
}

function ChatInner({ me }) {
  const { toast, openProfile } = useApp();
  const [list, setList] = useState({ status: "loading", items: [] });
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    chatApi().conversations(me.id).then((r) => setList({ status: "ready", items: r.conversations })).catch((e) => setList({ status: "error", items: [], error: e.message }));
  }, [me.id]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const titleOf = (c) => {
    const others = c.participants.filter((p) => p.id !== me.id);
    return c.type === "group" && c.name ? c.name : others.map((p) => p.displayName || p.name).join(", ") || c.name || "Chat";
  };
  const shown = useMemo(() => list.items.filter((c) => !q || titleOf(c).toLowerCase().includes(q.toLowerCase())), [list.items, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const convs = shown.filter((c) => c.id);
  const starters = shown.filter((c) => !c.id && c.startWith);

  const open = async (c) => {
    if (c.id) { setSel(c); return; }
    try {
      const id = await chatApi().start(me.id, c.startWith);
      const next = { ...c, id };
      setSel(next);
      load();
    } catch (e) { toast(e.message.replace(/^.*Error: /, ""), "error"); }
  };

  return (
    <div className="page chat-page">
      <div className="page-head"><h1>Chat</h1><p>Your Roblox conversations. Messages go through Roblox's normal chat filter.</p></div>
      <div className="chat-layout">
        <div className="chat-list">
          <label className="search-field"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" />{q && <button className="clear" onClick={() => setQ("")}><X size={13} /></button>}</label>
          <div className="chat-convs">
            {list.status === "loading" ? Array.from({ length: 8 }, (_, i) => <div className="conv" key={i}><Skeleton w={36} h={36} r={18} /><div className="grow"><Skeleton w="60%" h={11} /><Skeleton w="80%" h={9} style={{ marginTop: 6 }} /></div></div>)
              : list.status === "error" ? <div style={{ padding: 12 }}><ErrorState message={list.error} onRetry={load} /></div>
              : (
                <>
                  {convs.map((c) => {
                    const other = c.participants.find((p) => p.id !== me.id) || c.participants[0];
                    return (
                      <button key={c.id} className={"conv" + (sel?.id === c.id ? " on" : "")} onClick={() => open(c)}>
                        <Avatar src={other?.avatar} size={36} alt={titleOf(c)} />
                        <div className="grow"><b>{titleOf(c)}</b><small>{c.last ? `${c.last.sender === me.id ? "You: " : ""}${c.last.text}` : "No messages yet"}</small></div>
                        {c.unread > 0 && <span className="unread">{c.unread}</span>}
                      </button>
                    );
                  })}
                  {starters.length > 0 && <div className="list-title" style={{ padding: "12px 12px 4px" }}>Start a chat</div>}
                  {starters.map((c) => {
                    const other = c.participants.find((p) => p.id !== me.id) || c.participants[0];
                    return (
                      <button key={"s" + c.startWith} className="conv" onClick={() => open(c)}>
                        <Avatar src={other?.avatar} size={36} alt={titleOf(c)} />
                        <div className="grow"><b>{titleOf(c)}</b><small>Friend · say hi</small></div>
                      </button>
                    );
                  })}
                  {!convs.length && !starters.length && <p className="muted-text" style={{ padding: 12 }}>No chats match.</p>}
                </>
              )}
          </div>
        </div>
        {sel ? <Conversation key={sel.id} conv={sel} me={me} title={titleOf(sel)} onProfile={(p) => openProfile(p)} onSent={load} /> : <div className="chat-empty"><span>Pick a chat to start messaging.</span></div>}
      </div>
    </div>
  );
}

function Conversation({ conv, me, title, onProfile, onSent }) {
  const { toast } = useApp();
  const [msgs, setMsgs] = useState({ status: "loading", items: [] });
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const box = useRef(null);
  const people = Object.fromEntries(conv.participants.map((p) => [p.id, p]));
  const other = conv.participants.find((p) => p.id !== me.id);

  const load = useCallback(() => {
    chatApi().messages(me.id, conv.id).then((r) => setMsgs({ status: "ready", items: [...r.messages].sort((a, b) => new Date(a.at) - new Date(b.at)) })).catch((e) => setMsgs((m) => ({ ...m, status: m.items.length ? "ready" : "error", error: e.message })));
  }, [me.id, conv.id]);
  useEffect(() => { load(); chatApi().markRead(me.id, conv.id); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs.items.length]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const m = await chatApi().send(me.id, conv.id, t);
      setMsgs((x) => ({ ...x, items: [...x.items, { ...m, sender: me.id }] }));
      setText("");
      onSent();
    } catch (e) { toast(e.message.replace(/^.*Error: /, ""), "error"); }
    setSending(false);
  };

  let lastDay = "";
  return (
    <div className="chat-main">
      <div className="chat-top">
        <Avatar src={other?.avatar} size={30} alt={title} />
        <b className="grow">{title}</b>
        {other && <button className="btn ghost sm" onClick={() => onProfile(other)}>Profile</button>}
      </div>
      <div className="chat-msgs" ref={box}>
        {msgs.status === "loading" ? <Skeleton w="40%" h={30} r={14} /> : msgs.status === "error" ? <ErrorState message={msgs.error} onRetry={load} />
          : !msgs.items.length ? <div className="chat-empty"><span>No messages yet. Say hi!</span></div>
          : msgs.items.map((m) => {
            const day = dayLabel(m.at);
            const sep = day !== lastDay ? (lastDay = day) : null;
            const mine = m.sender === me.id;
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {sep && <div className="day-sep">{sep}</div>}
                <div className={"msg" + (mine ? " me" : "")} title={ago(m.at)}>
                  {!mine && <Avatar src={people[m.sender]?.avatar} size={24} alt={people[m.sender]?.name || "?"} />}
                  <div className="bubble">{m.text}</div>
                  <span className="msg-time">{new Date(m.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              </div>
            );
          })}
      </div>
      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea value={text} maxLength={500} placeholder={`Message ${title}`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn primary" disabled={!text.trim() || sending}><Send size={14} /> Send</button>
      </form>
    </div>
  );
}
