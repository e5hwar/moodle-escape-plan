import { useEffect, useMemo, useRef, useState } from "react";
import {
  flattenCategories,
  type Category,
  type CategorySelection,
} from "../data/questionBank";

import { SearchIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

const MAX_RESULTS = 8;
const CATEGORY_PREFIX = "Category:";

type Opt =
  | { kind: "category-filter" }
  | { kind: "search" }
  | { kind: "category"; index: number };

export function QuestionSearch({
  categories,
  onSelectionChange,
  query,
  onQueryChange,
}: {
  categories: Category[];
  onSelectionChange: (next: CategorySelection) => void;
  query: string;
  onQueryChange: (next: string) => void;
}) {
  const [text, setText] = useState(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setText(query), [query]);

  const allOptions = useMemo(() => flattenCategories(categories), [categories]);

  // Prefix detection puts the box into category-selection mode.
  const categoryMatch = text.match(/^\s*category:\s*(.*)$/i);
  const inCategoryMode = categoryMatch != null;
  const categoryQuery = categoryMatch ? categoryMatch[1] : "";
  const freeQuery = inCategoryMode ? "" : text;
  const hasQuery = freeQuery.trim().length > 0;

  const categoryResults = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    return allOptions
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [categoryQuery, allOptions]);

  const optionCount = inCategoryMode
    ? categoryResults.length
    : 1 + (hasQuery ? 1 : 0);

  function optionAt(i: number): Opt | null {
    if (inCategoryMode) return categoryResults[i] ? { kind: "category", index: i } : null;
    if (i === 0) return { kind: "category-filter" };
    if (i === 1 && hasQuery) return { kind: "search" };
    return null;
  }

  // Preselect the "Search for…" row when free text is entered so Enter searches.
  useEffect(() => {
    setActive(!inCategoryMode && hasQuery ? 1 : -1);
  }, [text, inCategoryMode, hasQuery]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function updateText(next: string) {
    setText(next);
    setOpen(true);
    // Keep the table query in sync live, except while picking a category.
    const m = next.match(/^\s*category:\s*(.*)$/i);
    onQueryChange(m ? "" : next);
  }

  function pickCategory(sel: CategorySelection) {
    onSelectionChange(sel);
    setText("");
    onQueryChange("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function commitSearch(q: string) {
    onQueryChange(q);
    setOpen(false);
  }

  function activate(opt: Opt) {
    if (opt.kind === "category-filter") {
      setText(CATEGORY_PREFIX);
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "category") {
      pickCategory(categoryResults[opt.index].sel);
    } else {
      commitSearch(freeQuery);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(optionCount - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) {
        const opt = optionAt(active);
        if (opt) return activate(opt);
      }
      if (inCategoryMode) {
        if (categoryResults[0]) return pickCategory(categoryResults[0].sel);
        return;
      }
      commitSearch(freeQuery);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="usearch qb-search" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder="Search questions by text or ID…"
          value={text}
          onChange={(e) => updateText(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <span className="usearch-kbd">
          <span className="kbd-cmd">⌘</span>
          <span className="kbd-letter">K</span>
        </span>
      </div>

      {open && (
        <div className="usearch-panel">
          {!inCategoryMode && (
            <>
              <div className="usearch-head">Suggested filters</div>
              <OptionRow
                active={active === 0}
                onHover={() => setActive(0)}
                onClick={() => activate({ kind: "category-filter" })}
              >
                <span className="usearch-chip">Category:</span>
                <span className="usearch-row-ex">Category: EPA 608 &gt; Universal</span>
                <span className="usearch-row-desc">Filter by Category or Subcategory</span>
              </OptionRow>
            </>
          )}

          {inCategoryMode && (
            <>
              <div className="usearch-head">Category</div>
              {categoryResults.length === 0 ? (
                <div className="usearch-empty">
                  {categoryQuery.trim()
                    ? `No categories match “${categoryQuery.trim()}”.`
                    : "Start typing a category name…"}
                </div>
              ) : (
                categoryResults.map((opt, i) => (
                  <OptionRow
                    key={opt.key}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => pickCategory(opt.sel)}
                  >
                    <span className="usearch-chip">Category:</span>
                    <span className="usearch-row-ex">{opt.label}</span>
                    <span className="usearch-row-desc">{opt.count} questions</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {!inCategoryMode && hasQuery ? (
            <SearchForRow
              query={freeQuery.trim()}
              scope="Question Bank"
              active={active === 1}
              onHover={() => setActive(1)}
              onClick={() => commitSearch(freeQuery)}
            />
          ) : (
            <SearchHints />
          )}
        </div>
      )}
    </div>
  );
}

function OptionRow({
  active,
  onHover,
  onClick,
  children,
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`usearch-row ${active ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
