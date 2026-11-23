import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SearchX, X } from "lucide-react";
import { useApp, useAsync } from "../lib/store";
import { api } from "../lib/bridge";
import { GameWide, GameWideSkeleton } from "../components/GameCard";
import { Empty, ErrorState, Select } from "../components/ui";
import { Scroller } from "../components/Scroller";

const SORT_OPTIONS = [
  { value: "all", label: "All games" },
  { value: "top-playing-now", label: "Most playing" },
  { value: "top-trending", label: "Trending" },
  { value: "up-and-coming", label: "Up and coming" },
  { value: "top-revisited", label: "Top revisited" },
  { value: "fun-with-friends", label: "Fun with friends" },
];

// Roblox's genres. Picking one loads that genre's games from every chart
// plus a keyword search, so each has dozens to 100+ games.
const GENRES = ["Action", "Adventure", "Entertainment", "Obby & Platformer", "Party & Casual", "Puzzle", "RPG", "Roleplay & Avatar Sim", "Shooter", "Shopping", "Simulation", "Social", "Sports & Racing", "Strategy", "Survival", "Education"];
const PAGE = 60;

export default function Discover({ focusKey }) {
  const { sorts, loadSorts } = useApp();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sortId, setSortId] = useState("all");
  const [genre, setGenre] = useState("All");
  const [shown, setShown] = useState(PAGE);
  const input = useRef(null);

  useEffect(() => { input.current?.focus(); }, [focusKey]);
  useEffect(() => { const t = setTimeout(() => setDebounced(query.trim()), 350); return () => clearTimeout(t); }, [query]);
  useEffect(() => setShown(PAGE), [debounced, sortId, genre]);

  const searching = !!debounced;
  const results = useAsync(() => (debounced ? api("searchMany", debounced, 3) : null), [debounced]);
  const genreList = useAsync(() => (!searching && genre !== "All" ? api("genreGames", genre) : null), [genre, searching]);

  const allGames = useMemo(() => {
    const seen = new Set();
    return sorts.data.flatMap((s) => s.games).filter((g) => !seen.has(g.universeId) && seen.add(g.universeId)).sort((a, b) => b.playing - a.playing);
  }, [sorts.data]);

  let list, loading, error, title;
  if (searching) {
    list = genre === "All" ? results.data ?? [] : (results.data ?? []).filter((g) => g.genre === genre);
    loading = results.status === "loading"; error = results.status === "error" && results.error;
    title = <span>Results for <b>“{debounced}”</b>{genre !== "All" && <> in {genre}</>}</span>;
  } else if (genre !== "All") {
    list = genreList.data ?? []; loading = genreList.status === "loading"; error = genreList.status === "error" && genreList.error;
    title = <span>{genre}</span>;
  } else {
    list = sortId === "all" ? allGames : sorts.data.find((s) => s.id === sortId)?.games ?? [];
    loading = sorts.status === "loading"; error = sorts.status === "error" && sorts.error;
    title = <span>{SORT_OPTIONS.find((o) => o.value === sortId)?.label}</span>;
  }

  return (
    <div className="page discover">
      <div className="page-head">
        <h1>Discover</h1>
        <p>Search every experience on Roblox, or browse by chart and genre.</p>
      </div>

      <div className="discover-bar">
        <label className="search-field">
          <Search size={16} />
          <input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games, e.g. tycoon, obby, horror…" />
          {query && <button className="clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
        </label>
        {!searching && genre === "All" && <Select value={sortId} onChange={setSortId} options={SORT_OPTIONS} width={190} />}
      </div>

      <Scroller className="chips">
        {["All", ...GENRES].map((g) => (
          <button key={g} className={"chip" + (genre === g ? " on" : "")} onClick={() => setGenre(g)}>{g}</button>
        ))}
      </Scroller>

      <div className="results-head">
        {title}
        {!loading && !error && <small>{list.length} games</small>}
        {loading && genre !== "All" && !searching && <small>Gathering {genre} games from across Roblox…</small>}
      </div>

      {error ? <ErrorState message={error} onRetry={searching ? () => setDebounced((d) => d + " ") : loadSorts} />
        : loading ? <div className="wide-grid">{Array.from({ length: 9 }, (_, i) => <GameWideSkeleton key={i} />)}</div>
        : list.length === 0 ? <Empty icon={SearchX} title="No games found" text={genre !== "All" ? `No ${genre} games matched. Try another category or search.` : "Try a different search."} />
        : (
          <>
            <div className="wide-grid">{list.slice(0, shown).map((g) => <GameWide key={g.universeId} game={g} />)}</div>
            {shown < list.length && <button className="btn ghost load-more" onClick={() => setShown((n) => n + PAGE)}>Show more ({list.length - shown} left)</button>}
          </>
        )}
    </div>
  );
}
