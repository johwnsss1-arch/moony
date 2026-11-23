import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Check, CircleCheck, Heart, Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import { Scroller } from "../components/Scroller";
import { useApp } from "../lib/store";
import { api } from "../lib/bridge";
import { compact } from "../lib/format";
import { Robux } from "../components/RobuxIcon";
import { Empty, ErrorState, Img, Modal, Select, Skeleton } from "../components/ui";

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


// Buying inside Moony: check the real price and ownership, then a confirm step.
// Nothing is bought until "Confirm" is pressed, and Roblox rejects the purchase
// if the price changed since you saw it.
function BuyBox({ item, onDetails }) {
  const { launchAs, robux, refreshRobux, signIn, toast } = useApp();
  const market = window.orbit?.market;
  const [d, setD] = useState({ status: "loading" });
  const [step, setStep] = useState("view"); // view | confirm | buying | done
  useEffect(() => {
    setStep("view");
    if (!launchAs || !market) return setD({ status: "nosession" });
    setD({ status: "loading" });
    market.details(launchAs.id, { id: item.id, type: item.type })
      .then((x) => { setD({ status: "ready", ...x }); if (!x.resaleOnly) onDetails?.(x); })
      .catch((e) => setD({ status: "error", error: e.message.replace(/^.*Error: /, "") }));
  }, [item.id, item.type, launchAs?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

export default function Market() {
  const { robux } = useApp();
  const [q, setQ] = useState("");
  const [deb, setDeb] = useState("");
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("favorited");
  const [price, setPrice] = useState({ min: "", max: "" });
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = (cat !== "all" ? 1 : 0) + (price.min || price.max ? 1 : 0) + (QUICK.includes(deb) ? 1 : 0);
  const [st, setSt] = useState({ status: "loading", items: [], next: null, error: null });
  const [open, setOpen] = useState(null);
  useEffect(() => { const t = setTimeout(() => setDeb(q.trim()), 400); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async (cursor = "") => {
    setSt((p) => ({ ...p, status: cursor ? "more" : "loading", error: null, ...(cursor ? {} : { items: [] }) }));
    try {
      const r = await api("catalog", { keyword: deb, category: cat, sort, cursor, minPrice: price.min, maxPrice: price.max });
      setSt((p) => ({ status: "ready", items: cursor ? [...p.items, ...r.items] : r.items, next: r.next, error: null }));
    } catch (e) { setSt((p) => ({ ...p, status: "error", error: e.message })); }
  }, [deb, cat, sort, price.min, price.max]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page market">
      <div className="page-head row">
        <div><h1>Marketplace</h1><p>Browse and buy Roblox catalog items without leaving Moony.</p></div>
        {robux != null && <span className="robux-pill lg"><Robux size={15} /> {robux.toLocaleString()}</span>}
      </div>

      <div className="lib-bar">
        <label className="search-field">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items, e.g. crown, wings, hoodie…" />
          {q && <button className="clear" onClick={() => setQ("")} aria-label="Clear"><X size={14} /></button>}
        </label>
        <Select value={sort} onChange={setSort} options={SORTS} width={190} />
        <button className={"btn " + (showFilters ? "secondary" : "ghost") + " filter-btn"} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal size={14} /> Filters{activeFilters > 0 && <span className="count">{activeFilters}</span>}
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
          </div>
          <Scroller className="chips">{QUICK.map((k) => <button key={k} className={"chip" + (deb === k ? " on" : "")} onClick={() => setQ(deb === k ? "" : k)}>{k}</button>)}</Scroller>
        </div>
      )}

      {st.status === "error" && !st.items.length ? <ErrorState message={st.error} onRetry={() => load()} />
        : st.status === "loading" ? <div className="item-grid">{Array.from({ length: 12 }, (_, i) => <div className="item-card" key={i}><Skeleton h="auto" r={12} style={{ aspectRatio: "1" }} /><Skeleton w="80%" h={12} style={{ marginTop: 10 }} /><Skeleton w="40%" h={10} style={{ marginTop: 6 }} /></div>)}</div>
        : !st.items.length ? <Empty icon={ShoppingBag} title="No items found" text="Try a different search or price range." />
        : (
          <>
            <div className="item-grid">
              {st.items.map((it) => (
                <button key={it.type + it.id} className="item-card" onClick={() => setOpen(it)}>
                  <div className="item-img"><Img src={it.image} />{it.limited && <span className="item-tag">Limited</span>}</div>
                  <b title={it.name}>{it.name}</b>
                  <small className="item-creator">{it.creator}{it.creatorVerified && <BadgeCheck size={11} className="verified" />}</small>
                  <span className={"item-price" + (it.price === 0 ? " free" : "")}>{it.offSale ? "Off sale" : it.price === 0 ? "Free" : <><Robux /> {it.price?.toLocaleString()}</>}</span>
                </button>
              ))}
            </div>
            {st.next && <button className="btn ghost load-more" disabled={st.status === "more"} onClick={() => load(st.next)}>{st.status === "more" ? "Loading…" : "Load more"}</button>}
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
              <BuyBox item={open} onDetails={(x) => setOpen((o) => (o && o.id === x.id ? { ...o, price: x.price, offSale: x.offSale } : o))} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
