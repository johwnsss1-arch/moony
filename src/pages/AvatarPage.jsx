import { useCallback, useEffect, useState } from "react";
import { Check, LogIn, Shirt, Sparkles, UserRound } from "lucide-react";
import { useApp } from "../lib/store";
import { avatarApi } from "../lib/bridge";
import { Avatar3D } from "../components/Avatar3D";
import { Empty, ErrorState, Img, Segmented, Skeleton } from "../components/ui";

const CATS = [
  ["wearing", "Wearing"], ["outfits", "Outfits"], ["hats", "Hats"], ["hair", "Hair"], ["face", "Face accessories"], ["neck", "Neck"],
  ["shoulder", "Shoulder"], ["front", "Front"], ["back", "Back"], ["waist", "Waist"], ["shirts", "Shirts"], ["pants", "Pants"],
  ["tshirts", "T-shirts"], ["jackets", "Jackets"], ["sweaters", "Sweaters"], ["shorts", "Shorts"], ["dresses", "Dresses"],
  ["faces", "Faces"], ["heads", "Heads"], ["animations", "Animations"],
];
const SINGLE = new Set([2, 11, 12, 17, 18]);

export default function AvatarPage() {
  const { launchAs, signIn, toast } = useApp();
  const [cat, setCat] = useState("wearing");
  const [wearing, setWearing] = useState({ status: "loading", data: null, error: null });
  const [list, setList] = useState({ status: "idle", items: [], next: null });
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  const loadWearing = useCallback(() => {
    if (!launchAs) return;
    avatarApi.state(launchAs.id).then((data) => setWearing({ status: "ready", data, error: null })).catch((e) => setWearing({ status: "error", data: null, error: e.message }));
  }, [launchAs]);
  useEffect(loadWearing, [loadWearing]);

  const loadList = useCallback(async (more) => {
    if (!launchAs || cat === "wearing") return;
    setList((p) => ({ ...p, status: more ? "more" : "loading", ...(more ? {} : { items: [] }) }));
    try {
      if (cat === "outfits") setList({ status: "ready", items: await avatarApi.outfits(launchAs.id), next: null });
      else {
        const r = await avatarApi.inventory(launchAs.id, cat, more ? list.next : "");
        setList((p) => ({ status: "ready", items: more ? [...p.items, ...r.items] : r.items, next: r.next }));
      }
    } catch (e) { setList({ status: "error", items: [], next: null, error: e.message }); }
  }, [launchAs, cat, list.next]);
  useEffect(() => { loadList(false); }, [cat, launchAs?.id]);

  const change = async (fn, done) => {
    setBusy(true);
    try {
      await fn();
      toast(done, "success");
      loadWearing();
      setTimeout(() => setVersion((v) => v + 1), 1800);
    } catch (e) { toast(e.message.replace(/^.*Error: /, ""), "error"); }
    setBusy(false);
  };

  const worn = wearing.data?.assets || [];
  const isWorn = (id) => worn.some((a) => a.id === id);
  const toggle = (item) => {
    let next;
    if (isWorn(item.id)) next = worn.filter((a) => a.id !== item.id);
    else next = [...worn.filter((a) => !(SINGLE.has(item.typeId) && a.assetType?.id === item.typeId)), { id: item.id }];
    change(() => avatarApi.wear(launchAs.id, next), isWorn(item.id) ? `Took off ${item.name}` : `Wearing ${item.name}`);
  };

  if (!launchAs || !avatarApi) {
    return (
      <div className="page">
        <div className="page-head"><h1>Avatar</h1><p>Change your Roblox avatar without leaving Moony.</p></div>
        <Empty icon={UserRound} title="Sign in to edit your avatar" text="Your avatar, items and outfits load once you're signed in."
          action={avatarApi ? <button className="btn primary" onClick={() => signIn()}><LogIn size={14} /> Sign in</button> : null} />
      </div>
    );
  }

  return (
    <div className="page avatar-page">
      <div className="page-head"><h1>Avatar</h1><p>Changes are saved to your Roblox avatar straight away.</p></div>
      <div className="avatar-layout">
        <div className="avatar-stage">
          <Avatar3D userId={launchAs.id} version={version} height={560} />
          <div className="stage-bar">
            <Segmented value={wearing.data?.type || "R15"} onChange={(t) => change(() => avatarApi.setType(launchAs.id, t), `Body type set to ${t}`)} options={[{ value: "R6", label: "R6" }, { value: "R15", label: "R15" }]} />
            {busy && <small>Saving…</small>}
          </div>
        </div>

        <div className="avatar-side">
          <div className="cat-tabs">
            {CATS.map(([id, label]) => <button key={id} className={"chip" + (cat === id ? " on" : "")} onClick={() => setCat(id)}>{label}{id === "wearing" && worn.length ? <span className="count">{worn.length}</span> : null}</button>)}
          </div>

          {cat === "wearing" ? (
            wearing.status === "error" ? <ErrorState message={wearing.error} onRetry={loadWearing} />
              : wearing.status === "loading" ? <ItemSkeletons />
              : !worn.length ? <Empty icon={Shirt} title="Not wearing anything" text="Pick items from the categories above." />
              : <div className="inv-grid">{worn.map((a) => <Item key={a.id} item={{ id: a.id, name: a.name, image: a.image, typeId: a.assetType?.id, sub: a.assetType?.name }} on disabled={busy} onClick={toggle} />)}</div>
          ) : list.status === "error" ? <ErrorState message={list.error} onRetry={() => loadList(false)} />
            : list.status === "loading" ? <ItemSkeletons />
            : !list.items.length ? <Empty icon={Sparkles} title="Nothing here" text={cat === "outfits" ? "You haven't saved any outfits." : "You don't own any items in this category."} />
            : (
              <>
                <div className="inv-grid">
                  {cat === "outfits"
                    ? list.items.map((o) => <Item key={o.id} item={o} disabled={busy} onClick={() => change(() => avatarApi.wearOutfit(launchAs.id, o.id), `Wearing outfit “${o.name}”`)} />)
                    : list.items.map((it) => <Item key={it.id} item={it} on={isWorn(it.id)} disabled={busy} onClick={toggle} />)}
                </div>
                {list.next && <button className="btn ghost load-more" disabled={list.status === "more"} onClick={() => loadList(true)}>{list.status === "more" ? "Loading…" : "Load more"}</button>}
              </>
            )}
        </div>
      </div>
    </div>
  );
}

function Item({ item, on, disabled, onClick }) {
  return (
    <button className={"inv-item" + (on ? " on" : "")} disabled={disabled} onClick={() => onClick(item)} title={item.name}>
      <div className="inv-img"><Img src={item.image} />{on && <span className="inv-check"><Check size={12} /></span>}</div>
      <b>{item.name}</b>
      {item.sub && <small>{item.sub.replace(/([a-z])([A-Z])/g, "$1 $2")}</small>}
    </button>
  );
}
const ItemSkeletons = () => <div className="inv-grid">{Array.from({ length: 12 }, (_, i) => <div className="inv-item" key={i}><Skeleton h="auto" r={10} style={{ aspectRatio: "1" }} /><Skeleton w="80%" h={10} style={{ marginTop: 8 }} /></div>)}</div>;
