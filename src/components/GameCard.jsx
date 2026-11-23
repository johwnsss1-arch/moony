import { Heart, Play, ThumbsUp, Users } from "lucide-react";
import { useApp } from "../lib/store";
import { cleanName, compact } from "../lib/format";
import { Img, Skeleton } from "./ui";

export function GameTile({ game }) {
  const { openGame, play, isFavorite, toggleFavorite } = useApp();
  const fav = isFavorite(game.universeId);
  return (
    <div className="tile" onClick={() => openGame(game)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openGame(game)}>
      <div className="tile-art">
        <Img src={game.icon} alt={game.name} />
        <div className="tile-actions">
          <button className={"tile-fav" + (fav ? " on" : "")} aria-label="Favorite" onClick={(e) => { e.stopPropagation(); toggleFavorite(game); }}>
            <Heart size={14} fill={fav ? "currentColor" : "none"} />
          </button>
          <button className="tile-play" aria-label={`Play ${game.name}`} onClick={(e) => { e.stopPropagation(); play(game); }}>
            <Play size={15} fill="currentColor" />
          </button>
        </div>
      </div>
      <div className="tile-name" title={game.name}>{cleanName(game.name)}</div>
      <div className="tile-meta">
        {game.playing != null && <span><Users size={12} /> {compact(game.playing)}</span>}
        {game.rating != null && <span><ThumbsUp size={12} /> {game.rating}%</span>}
      </div>
    </div>
  );
}

export function GameTileSkeleton() {
  return (
    <div className="tile">
      <Skeleton h="auto" r={12} style={{ aspectRatio: "1" }} />
      <Skeleton w="80%" h={12} style={{ marginTop: 10 }} />
      <Skeleton w="45%" h={10} style={{ marginTop: 7 }} />
    </div>
  );
}

export function GameWide({ game }) {
  const { openGame, play } = useApp();
  return (
    <div className="wide" onClick={() => openGame(game)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openGame(game)}>
      <div className="wide-art">
        <Img src={game.banner || game.icon} alt={game.name} />
        {game.genre && <span className="wide-genre">{game.genre}</span>}
      </div>
      <div className="wide-body">
        <div className="wide-top">
          <div className="wide-name" title={game.name}>{cleanName(game.name)}</div>
          <button className="btn primary sm icon-only" aria-label={`Play ${game.name}`} onClick={(e) => { e.stopPropagation(); play(game); }}><Play size={13} fill="currentColor" /></button>
        </div>
        {game.creator && <div className="wide-creator">by {game.creator}</div>}
        <p className="wide-desc">{game.description || "No description provided."}</p>
        <div className="tile-meta">
          <span><Users size={12} /> {compact(game.playing)} playing</span>
          {game.rating != null && <span><ThumbsUp size={12} /> {game.rating}%</span>}
        </div>
      </div>
    </div>
  );
}

export function GameWideSkeleton() {
  return (
    <div className="wide">
      <Skeleton h="auto" r={0} style={{ aspectRatio: "16/9" }} />
      <div className="wide-body">
        <Skeleton w="70%" h={13} />
        <Skeleton w="40%" h={10} style={{ marginTop: 8 }} />
        <Skeleton w="100%" h={10} style={{ marginTop: 14 }} />
        <Skeleton w="85%" h={10} style={{ marginTop: 6 }} />
      </div>
    </div>
  );
}
