import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, Megaphone, Newspaper, RefreshCw } from "lucide-react";
import { useApp, useAsync } from "../lib/store";
import { api } from "../lib/bridge";
import { ago, cleanName } from "../lib/format";
import { Empty, ErrorState, Img, Skeleton } from "../components/ui";

const SOURCES = [["all", "All news"], ["announcements", "Announcements"], ["releases", "Release notes"], ["community", "Community"], ["games", "Your games"]];

const ALLOWED = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "CODE", "PRE", "HR", "IMG", "A", "SPAN", "DIV", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "FIGURE", "FIGCAPTION", "DETAILS", "SUMMARY"]);
function sanitize(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node) => {
    for (const el of [...node.children]) {
      if (!ALLOWED.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
      for (const attr of [...el.attributes]) {
        const keep = (el.tagName === "IMG" && attr.name === "src" && /^https:\/\//.test(attr.value)) || (el.tagName === "A" && attr.name === "href");
        if (!keep) el.removeAttribute(attr.name);
      }
      if (el.tagName === "A") { el.setAttribute("title", el.getAttribute("href") || ""); el.removeAttribute("href"); el.className = "news-link"; }
      if (el.tagName === "IMG") el.setAttribute("loading", "lazy");
      walk(el);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
const excerpt = (html) => new DOMParser().parseFromString(html, "text/html").body.textContent.replace(/\s+/g, " ").trim().slice(0, 220);

export default function News() {
  const [source, setSource] = useState("all");
  const [open, setOpen] = useState(null);
  const [reload, setReload] = useState(0);
  const st = useAsync(() => api("news"), [reload]);
  const list = (st.data || []).filter((n) => source === "all" || n.source === source);

  if (open) return <Article item={open} onBack={() => setOpen(null)} />;

  return (
    <div className="page news">
      <div className="page-head row">
        <div><h1>News</h1><p>What's new on Roblox, from announcements to release notes.</p></div>
        <button className="btn ghost" onClick={() => setReload((r) => r + 1)}><RefreshCw size={14} className={st.status === "loading" ? "spin" : ""} /> Refresh</button>
      </div>
      <div className="underline-tabs">{SOURCES.map(([id, l]) => <button key={id} className={source === id ? "on" : ""} onClick={() => setSource(id)}>{l}</button>)}</div>

      {source === "games" ? <GameUpdates /> : st.status === "error" ? <ErrorState message={st.error} onRetry={() => setReload((r) => r + 1)} />
        : st.status === "loading" ? <div className="news-list">{Array.from({ length: 6 }, (_, i) => <div className="news-card" key={i}><Skeleton w="30%" h={10} /><Skeleton w="80%" h={16} style={{ marginTop: 10 }} /><Skeleton w="100%" h={10} style={{ marginTop: 10 }} /><Skeleton w="70%" h={10} style={{ marginTop: 6 }} /></div>)}</div>
        : !list.length ? <Empty icon={Newspaper} title="No news" text="Nothing here right now." />
        : (
          <div className="news-list">
            {list.map((n, i) => (
              <button key={n.id} className={"news-card" + (i === 0 && source === "all" ? " lead" : "")} onClick={() => setOpen(n)}>
                {n.image && <Img src={n.image} className="news-img" />}
                <div className="news-body">
                  <span className={"news-src " + n.source}><Megaphone size={11} /> {n.sourceLabel}</span>
                  <h3>{n.title}</h3>
                  <p>{excerpt(n.html)}…</p>
                  <small>{n.author && `${n.author} · `}{ago(n.date)}</small>
                </div>
              </button>
            ))}
          </div>
        )}
    </div>
  );
}

function Article({ item, onBack }) {
  const html = useMemo(() => sanitize(item.html), [item.html]);
  return (
    <div className="page news-article">
      <button className="back-btn" onClick={onBack}><ArrowLeft size={15} /> All news</button>
      <span className={"news-src " + item.source}><Megaphone size={11} /> {item.sourceLabel}</span>
      <h1>{item.title}</h1>
      <small className="article-meta">{item.author && `${item.author} · `}{new Date(item.date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</small>
      <article className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function GameUpdates() {
  const { favorites, openGame } = useApp();
  const ids = favorites.slice(0, 24).map((f) => f.universeId).join(",");
  const st = useAsync(async () => {
    const out = await Promise.all(favorites.slice(0, 24).map((f) => api("gameDetails", f.universeId).catch(() => null)));
    return out.filter(Boolean).sort((a, b) => new Date(b.updated) - new Date(a.updated));
  }, [ids]);
  if (!favorites.length) return <Empty icon={CalendarClock} title="No favorite games yet" text="Favorite games to see when they last updated here." />;
  if (st.status === "loading") return <div className="news-list">{Array.from({ length: 4 }, (_, i) => <div className="news-card" key={i}><Skeleton w="60%" h={14} /></div>)}</div>;
  return (
    <div className="update-list">
      {(st.data || []).map((g) => (
        <button key={g.universeId} className="update-row" onClick={() => openGame(g)}>
          <Img src={g.icon} className="pt-art" />
          <div className="grow"><b>{cleanName(g.name)}</b><small>Updated {ago(g.updated)}</small></div>
          {Date.now() - new Date(g.updated) < 86400000 * 2 && <span className="pill active">New update</span>}
        </button>
      ))}
    </div>
  );
}
