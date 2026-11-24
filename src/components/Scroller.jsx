import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Scroller({ children, className = "" }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: true });
  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [update, children]);
  const by = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: "smooth" });
  return (
    <div className={"scroller" + (edge.start ? "" : " can-l") + (edge.end ? "" : " can-r")}>
      {!edge.start && <button className="scroller-btn l" aria-label="Scroll left" onClick={() => by(-1)}><ChevronLeft size={15} /></button>}
      <div className={"scroller-track " + className} ref={ref} onScroll={update}>{children}</div>
      {!edge.end && <button className="scroller-btn r" aria-label="Scroll right" onClick={() => by(1)}><ChevronRight size={15} /></button>}
    </div>
  );
}
