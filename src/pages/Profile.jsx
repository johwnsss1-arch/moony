import { useMemo } from "react";
import { ArrowLeft, BadgeCheck, CalendarDays, ExternalLink, Flame, Gamepad2, Hourglass, LogIn, UserPlus, UserCheck, Users } from "lucide-react";
import { useApp, useAsync } from "../lib/store";
import { api, isDesktop } from "../lib/bridge";
import { cleanName, compact, duration, totalSeconds } from "../lib/format";
import { streak } from "../lib/stats";
import { Carousel } from "../components/Carousel";
import { RichStats } from "../components/Stats";
import { Avatar3D } from "../components/Avatar3D";
import { Avatar, ErrorState, Img, Skeleton } from "../components/ui";

export default function Profile({ seed }) {
  const { accounts, tracked, setTracked, friends, joinFriend, toast, playtime, openGame } = useApp();
  const st = useAsync(() => api("userProfile", seed.id), [seed.id]);
  const p = { ...seed, ...(st.data || {}) };
  const isMine = accounts.some((a) => a.id === seed.id);
  const friend = friends.data.find((f) => f.id === seed.id);
  const following = tracked.some((t) => t.id === seed.id);

  const mine = useMemo(() => {
    if (!isMine) return null;
    const games = Object.entries(playtime.games || {}).map(([id, g]) => ({ universeId: Number(id), ...g })).filter((g) => g.seconds > 0).sort((a, b) => b.seconds - a.seconds);
    return { total: totalSeconds(games.map((g) => g.seconds)), games, streak: streak(playtime.days) };
  }, [isMine, playtime]);

  const follow = () => {
    if (following) setTracked((l) => l.filter((t) => t.id !== seed.id));
    else { setTracked((l) => [...l, { id: p.id, name: p.name, displayName: p.displayName, avatar: p.headshot || p.avatar, presence: null }]); toast(`Following ${p.displayName}`, "success"); }
  };

  return (
    <div className="page profile">
      {st.status === "error" ? <ErrorState message={st.error} /> : (
        <>
          <div className="profile-hero">
            <div className="profile-avatar"><Avatar3D userId={seed.id} fallback={st.data?.avatar} height={300} /></div>
            <div className="grow profile-main">
              <h1>{p.displayName || <Skeleton w={200} h={28} />} {p.verified && <BadgeCheck size={20} className="verified" />}</h1>
              <div className="profile-handle">@{p.name}{isMine && <span className="pill active">You</span>}{friend && <span className="pill">Friend</span>}</div>
              {friend?.presence?.type > 0 && <div className={"profile-presence st" + friend.presence.type}>{friend.presence.type === 2 && friend.presence.lastLocation ? `Playing ${friend.presence.lastLocation}` : friend.presence.label}</div>}
              <div className="profile-counts">
                <span><b>{st.data ? compact(p.friends) : "—"}</b> Friends</span>
                <span><b>{st.data ? compact(p.followers) : "—"}</b> Followers</span>
                <span><b>{st.data ? compact(p.following) : "—"}</b> Following</span>
                {p.created && <span><CalendarDays size={13} /> Joined {new Date(p.created).toLocaleDateString(undefined, { year: "numeric", month: "short" })}</span>}
              </div>
              <div className="profile-actions">
                {friend?.presence?.type === 2 && <button className="btn primary" onClick={() => joinFriend(friend)}><LogIn size={14} /> Join</button>}
                {!isMine && <button className={"btn " + (following ? "ghost" : "secondary")} onClick={follow}>{following ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow in Moony</>}</button>}
              </div>
            </div>
          </div>
          {p.description && <p className="profile-about">{p.description}</p>}

          {mine && isDesktop && (
            <section className="me-section">
              <div className="me-cards">
                <div className="me-card"><Hourglass size={16} /><b>{duration(mine.total)}</b><small>Total playtime</small></div>
                <div className="me-card"><Flame size={16} /><b>{mine.streak} day{mine.streak === 1 ? "" : "s"}</b><small>Current streak</small></div>
                <div className="me-card"><Gamepad2 size={16} /><b>{mine.games.length}</b><small>Games played</small></div>
                <div className="me-card"><Users size={16} /><b>{friends.data.length || "—"}</b><small>Friends in Moony</small></div>
              </div>
              {mine.games.length > 0 && (
                <div className="top-games">
                  <h3 className="list-title">Top games</h3>
                  <div className="top-list">
                    {mine.games.slice(0, 5).map((g, i) => (
                      <button key={g.universeId} className="top-game" onClick={() => openGame(g)}>
                        <span className="rank top">{i + 1}</span>
                        <Img src={g.icon} className="pt-art" />
                        <b className="grow">{cleanName(g.name || "Game")}</b>
                        <span className="pt-time">{duration(g.seconds)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <h3 className="list-title" style={{ marginTop: 24 }}>Your stats</h3>
              <RichStats />
            </section>
          )}

          {st.data?.favoriteGames?.length > 0 && <div style={{ marginTop: 26 }}><Carousel title="Favorite games" icon={Gamepad2} games={st.data.favoriteGames} /></div>}
        </>
      )}
    </div>
  );
}
