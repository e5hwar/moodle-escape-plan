import { useEffect, useRef, useState } from "react";
import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

/** The Industries launcher bar — the same `.usearch` combobox shell Tasks,
 *  Certifications, Companies and Users run, and commit-on-Enter like them: the
 *  list below only ever shows results for the APPLIED query, never the draft.
 *
 *  One difference: this page has no Filters row, so there are no scope tokens
 *  and nothing to suggest on an empty bar. The panel therefore opens only while
 *  an edit is pending (typed text ≠ applied query), and while it is closed
 *  ↑ ↓ ↵ Esc fall through to the launcher's own list navigation — the handlers
 *  here `preventDefault()` whatever they consume, and the launcher's document
 *  listener skips anything already handled. */
export function IndustriesSearch({
  query,
  onCommit,
  inputRef,
}: {
  query: string;
  onCommit: (q: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const [text, setText] = useState(query);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Keep the bar showing the applied query when it changes from outside
  // (opening a row resets it, Esc on the list clears it).
  useEffect(() => setText(query), [query]);

  const pending = open && text !== query;

  // Abandon an uncommitted edit — the bar must never claim a search the list
  // isn't showing.
  function revert() {
    setText(query);
    setOpen(false);
  }

  useEffect(() => {
    if (!pending) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) revert();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // `query` is a dep so the handler always reverts to the current search.
  }, [pending, query]);

  function commit() {
    const q = text.trim();
    setText(q);
    setOpen(false);
    if (q !== query) onCommit(q);
  }

  function clearSearch() {
    setText("");
    setOpen(false);
    if (query) onCommit("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!pending) return;
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      revert();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // The panel's one row is always the ↵ target — nothing to walk, and the
      // list it covers shouldn't move underneath it.
      e.preventDefault();
    }
  }

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${pending ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder="Search Industries, Certifications..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {text || query ? (
          <button
            type="button"
            className="usearch-clear"
            aria-label="Clear search"
            title="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearSearch}
          >
            <SearchClearIcon />
          </button>
        ) : (
          <span className="usearch-kbd">
            <span className="kbd-cmd"><KeyCommandIcon /></span>
            <span className="kbd-letter">K</span>
          </span>
        )}
      </div>

      {pending && (
        <div className="usearch-panel">
          {text.trim() ? (
            <SearchForRow query={text.trim()} scope="Industries" onClick={commit} />
          ) : (
            // Erasing an applied search: ↵ commits the empty bar.
            <SearchHints />
          )}
        </div>
      )}
    </div>
  );
}
