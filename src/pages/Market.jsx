import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Check, CircleCheck, Crown, Flame, Heart, RefreshCw, Search, ShoppingBag, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Scroller } from "../components/Scroller";
import { useApp } from "../lib/store";
import { api } from "../lib/bridge";
import { compact } from "../lib/format";
import { Robux } from "../components/RobuxIcon";
import { Empty, ErrorState, Img, Modal, Select, Skeleton, Toggle } from "../components/ui";

const CATS = [["all", "All"], ["accessories", "Accessories"], ["clothing", "Clothing"], ["bodyparts", "Body & heads"], ["animations", "Animations"]];
const SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "favorited", label: "Most favorited" },
  { value: "sales", label: "Best selling" },
  { value: "updated", label: "Recently updated" },
  { value: "priceLow", label: "Price: low to high" },
  { value: "priceHigh", label: "Price: high to low" },
];
const QUICK = ["hat", "hair", "face", "sunglasses", "aura", "wings", "crown", "headphones", "sword", "scarf"];

function BuyBox({ item, onDetails }) {
  const { launchAs, robux, refreshRobux, signIn, toast } = useApp();
  const market = window.orbit?.market;
  const [d, setD] = useState({ status: "loading" });
  const [step, setStep] = useState("view");
  useEffect(() => {
    setStep("view");
    if (!launchAs || !market) return setD({ status: "nosession" });
    setD({ status: "loading" });
    market.details(launchAs.id, { id: item.id, type: item.type })
      .then((x) => { setD({ status: "ready", ...x }); if (!x.resaleOnly) onDetails?.(x); })
      .catch((e) => setD({ status: "error", error: e.message.replace(/^.*Error: /, "") }));
  }, [item.id, item.type, launchAs?.id]);

  if (d.status === "nosession") return <button className="btn primary" onClick={() => signIn()}>Sign in to buy</button>;
  if (d.status === "loading") return <button className="btn primary" disabled>Checking price…</button>;
  if (d.status === "error") return <small className="form-error">{d.error}</small>;
  if (d.owned) return <span className="owned-pill"><Check size={13} /> You own this</span>;
  if (d.resaleOnly) return <small className="afford">Sold out. This Limited is only available from resellers{item.price ? `, from ${item.price.toLocaleString()} Robux` : ""}, which Moony doesn't support.</small>;
  if (d.offSale) return <small className="afford">This item is off sale.</small>;

  const free = d.price === 0;
  const after = robux != null ? robux - d.price : null;
  const short = after != null && after < 0;
  const confirm = async () => {
    setStep("buying");
    try {
      await market.buy(launchAs.id, { id: d.id, type: d.type }, d.price);
      setStep("done");
      setD((x) => ({ ...x, owned: true }));
      refreshRobux();
      toast(free ? `Got ${d.name}` : `Bought ${d.name} for ${d.price.toLocaleString()} Robux`, "success");
    } catch (e) { setStep("confirm"); toast(e.message.replace(/^.*Error: /, ""), "error"); }
  };

  if (step === "done") return <div className="buy-done"><CircleCheck size={26} /><b>{free ? "It's yours!" : "Purchase complete"}</b><small>Find it in the Avatar tab.</small></div>;
  if (step === "view") {
    return (
      <>
        <button className="btn primary lg" disabled={short} onClick={() => setStep("confirm")}><ShoppingBag size={14} /> {free ? "Get for free" : <>Buy for <Robux size={13} /> {d.price.toLocaleString()}</>}</button>
        {short && <small className="afford">You need {(-after).toLocaleString()} more Robux.</small>}
      </>
    );
  }
  return (
    <div className="buy-lines">
      <div><span>Price</span><b>{free ? "Free" : <><Robux /> {d.price.toLocaleString()}</>}</b></div>
      {robux != null && <div><span>Your Robux</span><b><Robux /> {robux.toLocaleString()}</b></div>}
      {robux != null && !free && <div className="total"><span>After purchase</span><b><Robux /> {after.toLocaleString()}</b></div>}
      <div className="buy-actions">
        <button className="btn ghost" disabled={step === "buying"} onClick={() => setStep("view")}>Cancel</button>
        <button className="btn primary" disabled={step === "buying"} onClick={confirm}>{step === "buying" ? "Buying…" : free ? "Confirm, get it" : `Confirm purchase`}</button>
      </div>
    </div>
  );
}

const TASTE_KEY = "moony-market-taste";
const STOP = new Set(["the", "and", "for", "with", "of", "a", "an", "in", "on", "by", "to", "my", "your", "pack", "new", "set", "roblox", "ugc", "limited"]);
const loadTaste = () => { try { return JSON.parse(localStorage.getItem(TASTE_KEY)) || { kw: {}, type: {} }; } catch { return { kw: {}, type: {} }; } };
function learn(item, weight = 1) {
  const t = loadTaste();
  const decay = (o) => { for (const k in o) { o[k] *= 0.95; if (o[k] < 0.15) delete o[k]; } };
  decay(t.kw); decay(t.type);
  for (const w of String(item.name).toLowerCase().match(/[a-z]{3,}/g) || []) if (!STOP.has(w)) t.kw[w] = (t.kw[w] || 0) + weight;
  const kind = item.assetType ? `a${item.assetType}` : item.bundleType ? `b${item.bundleType}` : null;
  if (kind) t.type[kind] = (t.type[kind] || 0) + weight;
  try { localStorage.setItem(TASTE_KEY, JSON.stringify(t)); } catch { }
}
const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
const TYPE_CAT = (k) => (k?.startsWith("b") ? "bodyparts" : [2, 11, 12].includes(Number(k?.slice(1))) ? "clothing" : [61, 48, 49, 50, 51, 52, 53, 54, 55, 56].includes(Number(k?.slice(1))) ? "animations" : "accessories");

function feedStreams(mode, includeFree) {
  const base = { paidOnly: !includeFree };
  if (mode === "popular") return [{ tag: "Popular", p: { ...base, sort: "favorited", period: "all" } }, { tag: "Best seller", p: { ...base, sort: "sales", period: "all" } }];
  if (mode === "trending") return [{ tag: "Trending", p: { ...base, sort: "sales", period: "day" } }, { tag: "Hot this week", p: { ...base, sort: "sales", period: "week" } }];
  const t = loadTaste();
  const s = [
    { tag: "Trending", p: { ...base, sort: "sales", period: "week" } },
    { tag: "Popular", p: { ...base, sort: "favorited", period: "week" } },
  ];
  for (const k of top(t.kw, 3)) s.push({ tag: "For you", p: { ...base, keyword: k, sort: "favorited" } });
  const kind = top(t.type, 1)[0];
  if (kind) s.push({ tag: "For you", p: { ...base, category: TYPE_CAT(kind), sort: "sales", period: "week" } });
  if (s.length === 2) s.push({ tag: "Popular", p: { ...base, sort: "favorited", period: "all" } }, { tag: "Fresh", p: { ...base, sort: "updated" } });
  return s;
}

export default function Market() {
  const { robux } = useApp();
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [mode, setMode] = useState("foryou");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("favorited");
  const [includeFree, setIncludeFree] = useState(false);
  const [price, setPrice] = useState({ min: "", max: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [st, setSt] = useState({ status: "loading", items: [], error: null, more: true });
  const [open, setOpen] = useState(null);
  const streams = useRef([]);
  const seen = useRef(new Set());
  const sentinel = useRef(null);
  const gen = useRef(0);
  const searching = !!deb || cat !== "all" || !!price.min || !!price.max;
  useEffect(() => { const t = setTimeout(() => setDeb(q.trim()), 400); return () => clearTimeout(t); }, [q]);

  const loadMore = useCallback(async (reset) => {
    if (reset) {
      gen.current++;
      seen.current = new Set();
      streams.current = searching
        ? [{ tag: null, p: { keyword: deb, category: cat, sort, minPrice: price.min, maxPrice: price.max, paidOnly: !includeFree } }]
        : feedStreams(mode, includeFree);
      streams.current.forEach((s) => { s.cursor = ""; s.done = false; });
    }
    setSt((p) => ({ ...p, status: reset ? "loading" : "more", error: null, ...(reset ? { items: [] } : {}) }));
    const my = gen.current;
    try {
      const live = streams.current.filter((s) => !s.done);
      const pages = await Promise.all(live.map((s) => api("catalog", { ...s.p, cursor: s.cursor }).then((r) => { s.cursor = r.next || ""; s.done = !r.next; return r.items.map((it) => ({ ...it, why: s.tag })); }).catch(() => [])));
      if (my !== gen.current) return;
      const mixed = [];
      for (let i = 0; pages.some((p) => i < p.length); i++) for (const p of pages) if (p[i]) mixed.push(p[i]);
      const fresh = mixed.filter((it) => {
        const k = it.type + it.id;
        if (seen.current.has(k)) return false;
        if (!includeFree && (it.price === 0 || it.offSale)) return false;
        seen.current.add(k); return true;
      });
      setSt((p) => ({ status: "ready", items: reset ? fresh : [...p.items, ...fresh], error: null, more: streams.current.some((s) => !s.done) }));
    } catch (e) { setSt((p) => ({ ...p, status: "error", error: e.message })); }
  }, [mode, includeFree, searching, deb, cat, sort, price.min, price.max]);
  useEffect(() => { loadMore(true); }, [loadMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && st.status === "ready" && st.more) loadMore(false); }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [st.status, st.more, loadMore]);

  const openItem = (it) => { learn(it, 1); setOpen(it); };

  return (
    <div className="page market">
      <div className="page-head row">
        <div><h1>Marketplace</h1><p>{searching ? "Search results" : mode === "foryou" ? "Picked for you from what's popular and what you look at." : mode === "trending" ? "Selling fastest right now." : "The most loved items on Roblox."}</p></div>
        {robux != null && <span className="robux-pill lg"><Robux size={15} /> {robux.toLocaleString()}</span>}
      </div>

      <div className="lib-bar">
        <label className="search-field">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items, e.g. crown, wings, hoodie…" />
          {q && <button className="clear" onClick={() => setQ("")} aria-label="Clear"><X size={14} /></button>}
        </label>
        {searching
          ? <Select value={sort} onChange={setSort} options={SORTS} width={190} />
          : <div className="segmented mk-modes">{[["foryou", "For you", Sparkles], ["trending", "Trending", Flame], ["popular", "Popular", Crown]].map(([v, l, I]) => <button key={v} className={mode === v ? "on" : ""} onClick={() => setMode(v)}><I size={13} /> {l}</button>)}</div>}
        <button className={"btn " + (showFilters ? "secondary" : "ghost") + " filter-btn"} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={14} /> Filters{(cat !== "all" || price.min || price.max || includeFree) && <span className="count">•</span>}
        </button>
      </div>
      {showFilters && (
        <div className="filter-panel">
          <div className="market-filters">
            <div className="segmented">{CATS.map(([v, l]) => <button key={v} className={cat === v ? "on" : ""} onClick={() => setCat(v)}>{l}</button>)}</div>
            <div className="price-range">
              <Robux /> <input className="input" inputMode="numeric" placeholder="Min" value={price.min} onChange={(e) => setPrice((p) => ({ ...p, min: e.target.value.replace(/\D/g, "") }))} />
              <span>–</span>
              <input className="input" inputMode="numeric" placeholder="Max" value={price.max} onChange={(e) => setPrice((p) => ({ ...p, max: e.target.value.replace(/\D/g, "") }))} />
            </div>
            <label className="mk-free"><Toggle checked={includeFree} onChange={setIncludeFree} /> Show free items</label>
          </div>
          <Scroller className="chips">{QUICK.map((k) => <button key={k} className={"chip" + (deb === k ? " on" : "")} onClick={() => setQ(deb === k ? "" : k)}>{k}</button>)}</Scroller>
        </div>
      )}

      {st.status === "error" && !st.items.length ? <ErrorState message={st.error} onRetry={() => loadMore(true)} />
        : st.status === "loading" ? <div className="item-grid">{Array.from({ length: 12 }, (_, i) => <div className="item-card" key={i}><Skeleton h="auto" r={12} style={{ aspectRatio: "1" }} /><Skeleton w="80%" h={12} style={{ marginTop: 10 }} /><Skeleton w="40%" h={10} style={{ marginTop: 6 }} /></div>)}</div>
        : !st.items.length ? <Empty icon={ShoppingBag} title="No items found" text="Try a different search or price range." />
        : (
          <>
            <div className="item-grid">
              {st.items.map((it) => (
                <button key={it.type + it.id} className="item-card" onClick={() => openItem(it)}>
                  <div className="item-img"><Img src={it.image} />{it.limited ? <span className="item-tag">Limited</span> : it.why && it.why !== "Popular" && <span className={"item-tag why" + (it.why === "For you" ? " fy" : "")}>{it.why}</span>}</div>
                  <b title={it.name}>{it.name}</b>
                  <small className="item-creator">{it.creator}{it.creatorVerified && <BadgeCheck size={11} className="verified" />}</small>
                  <span className="item-meta">
                    <span className={"item-price" + (it.price === 0 ? " free" : "")}>{it.offSale ? "Off sale" : it.price === 0 ? "Free" : <><Robux /> {it.price?.toLocaleString()}</>}</span>
                    {it.favorites > 0 && <small className="item-fav"><Heart size={10} /> {compact(it.favorites)}</small>}
                  </span>
                </button>
              ))}
            </div>
            <div ref={sentinel} className="feed-sentinel">{st.status === "more" && <><RefreshCw size={14} className="spin" /> Loading more…</>}{!st.more && st.status === "ready" && "You've reached the end."}</div>
          </>
        )}

      <Modal open={!!open} onClose={() => setOpen(null)} width={640} label="Item">
        {open && (
          <div className="item-detail">
            <div className="item-detail-img"><Img src={open.image} /></div>
            <div className="item-detail-body">
              <h2>{open.name}</h2>
              <div className="item-creator">by {open.creator}{open.creatorVerified && <BadgeCheck size={12} className="verified" />}</div>
              <div className="item-detail-price">{open.offSale ? "Off sale" : open.price === 0 ? "Free" : <><Robux size={18} /> {open.price?.toLocaleString()}</>}</div>
              <div className="item-detail-stats"><span><Heart size={12} /> {compact(open.favorites)} favorites</span>{open.limited && <span className="item-tag static">Limited</span>}</div>
              {open.description && <p className="desc open">{open.description}</p>}
              <BuyBox item={open} onDetails={(x) => { learn(open, 0.5); setOpen((o) => (o && o.id === x.id ? { ...o, price: x.price, offSale: x.offSale } : o)); }} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
