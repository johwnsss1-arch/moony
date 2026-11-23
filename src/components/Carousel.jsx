import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GameTile, GameTileSkeleton } from "./GameCard";

export function Carousel({ title, icon: Icon, games, loading, action }) {
  const track = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const el = track.current;
    const ro = new ResizeObserver(update);
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [update, games, loading]);

  const scroll = (dir) => {
    const el = track.current;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="carousel">
      <header className="section-head">
        <h2>{Icon && <Icon size={16} />}{title}</h2>
        <div className="section-tools">
          {action}
          <button className="arrow" disabled={edge.start} onClick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={16} /></button>
          <button className="arrow" disabled={edge.end} onClick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={16} /></button>
        </div>
      </header>
      <div className={"track-wrap" + (edge.start ? "" : " fade-l") + (edge.end ? "" : " fade-r")}>
        <div className="track" ref={track} onScroll={update}>
          {loading ? Array.from({ length: 8 }, (_, i) => <GameTileSkeleton key={i} />) : games.map((g) => <GameTile key={g.universeId} game={g} />)}
        </div>
      </div>
    </section>
  );
}
