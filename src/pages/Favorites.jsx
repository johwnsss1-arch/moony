import { Compass, Heart, History, Trash2 } from "lucide-react";
import { useApp } from "../lib/store";
import { GameTile } from "../components/GameCard";
import { Empty } from "../components/ui";

export default function Favorites() {
  const { favorites, recent, setRecent, setPage } = useApp();
  return (
    <div className="page favorites">
      <div className="page-head">
        <h1>Favorites</h1>
        <p>Games you've saved for quick launching. Saved on this computer.</p>
      </div>

      {favorites.length === 0 ? (
        <Empty icon={Heart} title="No favorites yet" text="Tap the heart on any game to keep it here."
          action={<button className="btn primary" onClick={() => setPage("discover")}><Compass size={15} /> Browse games</button>} />
      ) : (
        <div className="tile-grid">{favorites.map((g) => <GameTile key={g.universeId} game={g} />)}</div>
      )}

      {recent.length > 0 && (
        <>
          <header className="section-head" style={{ marginTop: 34 }}>
            <h2><History size={16} />Recently played</h2>
            <button className="btn ghost sm" onClick={() => setRecent([])}><Trash2 size={13} /> Clear history</button>
          </header>
          <div className="tile-grid">{recent.map((g) => <GameTile key={g.universeId} game={g} />)}</div>
        </>
      )}
    </div>
  );
}
