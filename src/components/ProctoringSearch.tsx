import { useEffect, useMemo, useRef, useState } from "react";
import { type Submission } from "../data/proctoring";
import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchScopeChip, stepActive, SearchNoResults, SuggestionRow, suggestFilters } from "./SearchPanelParts";

const MAX_RESULTS = 6;

type Opt = { kind: "exam-filter" } | { kind: "exam"; name: string };

/**
 * The Proctoring queue's search — the Users / Hands-On Task combobox, scoped to
 * Quiz. Quiz has a filter pill on the page, so its applied values leave the bar
 * on Enter and are shown (and cleared) there, the way ReviewSearch hands its
 * scopes to the pills.
 *
 * The panel offers filters only — no live result rows. The table filters on the
 * COMMITTED query, so a list that updated per keystroke would be showing results
 * the table below it does not have yet.
 */
export function ProctoringSearch({
  submissions,
  exams: appliedExams,
  onExamsChange,
  query,
  onCommit,
  secondary = false,
}: {
  submissions: Submission[];
  exams: string[];
  onExamsChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
  /** Figma 1397:2017 "Search Bar - Secondary": no fill, hairline only, for a
   *  search that sits under a heavier landing block (the Review Runs strip). */
  secondary?: boolean;
}) {
  const [text, setText] = useState(query);
  // Scopes picked in THIS search session — not yet applied to the table.
  const [draftExams, setDraftExams] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the bar showing the applied query when it changes from outside
  // (Clear Filters, the ✕ on a chip).
  useEffect(() => setText(query), [query]);

  const allExams = useMemo(() => {
    const counts = new Map<string, number>();
    submissions.forEach((s) => counts.set(s.exam, (counts.get(s.exam) ?? 0) + 1));
    return { names: [...counts.keys()].sort(), counts };
  }, [submissions]);

  // The `Quiz:` prefix (case-insensitive) switches the panel into selection mode.
  const examMatch = text.match(/^\s*quiz:\s*(.*)$/i);
  const inExamMode = examMatch != null;
  const examQuery = examMatch ? examMatch[1] : "";
  const freeQuery = inExamMode ? "" : text;
  const hasFree = freeQuery.trim() !== "";

  // Everything currently narrowing the bar — applied scopes plus this session's drafts.
  const scopedExams = useMemo(
    () => Array.from(new Set([...appliedExams, ...draftExams])),
    [appliedExams, draftExams],
  );
  const examResults = useMemo(() => {
    const q = examQuery.trim().toLowerCase();
    return allExams.names
      .filter((e) => !scopedExams.includes(e) && e.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [allExams, examQuery, scopedExams]);

  /* "Suggested filters" follows what's typed: with an empty box it teaches the
     scope prefix, and as soon as there is text it offers the Quizzes that
     actually match it — so "608" can be turned into a scope without knowing the
     prefix syntax. */
  const suggestions = useMemo<Opt[]>(() => {
    const q = freeQuery.trim().toLowerCase();
    if (!q) return [{ kind: "exam-filter" }];
    // The same shared matcher (and 6-row cap) as every other bar.
    return suggestFilters(q, [{ kind: "exam", values: allExams.names, exclude: scopedExams }], MAX_RESULTS).map(
      (sg) => ({ kind: "exam", name: sg.name }) as Opt,
    );
  }, [freeQuery, allExams, scopedExams]);

  const optionCount = inExamMode ? examResults.length : suggestions.length;

  function optionAt(i: number): Opt | null {
    if (inExamMode) return examResults[i] ? { kind: "exam", name: examResults[i] } : null;
    return suggestions[i] ?? null;
  }

  useEffect(() => setActive(-1), [text, draftExams.length]);

  /* Abandon an uncommitted edit. The table only ever filters on the APPLIED
     query, so a bar left showing half-typed text would be lying about what the
     results are for — clicking away or pressing Escape puts the applied query
     (and no pending scope) back. */
  function revert() {
    setText(query);
    setDraftExams([]);
    setActive(-1);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) revert();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // `query`/drafts are deps so the handler always reverts to current state.
  }, [open, query, draftExams]);

  /* Clear the applied search outright — no Enter needed. It clears what the bar
     itself is showing: the text and this session's drafts. Applied quizzes
     belong to the Quiz pill and are left alone. */
  function clearSearch() {
    setText("");
    setDraftExams([]);
    setActive(-1);
    setOpen(false);
    /* Only re-commit when there IS a committed query to drop. Pages wire
       onCommit to their landing morph, so an unconditional call would shove
       the page out of its landing view just for clearing typed text. */
    if (query) onCommit("");
  }

  function addExam(name: string) {
    if (!scopedExams.includes(name)) setDraftExams([...draftExams, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }
  /* ✕ on a chip: drop it and re-run the search. The `exam*` identifiers are the
     data's field name (Submission.exam); the user-facing label for that field on
     this page is "Quiz". */
  function removeQuiz(name: string) {
    setDraftExams((d) => d.filter((x) => x !== name));
    if (appliedExams.includes(name)) onExamsChange(appliedExams.filter((x) => x !== name));
  }

  function activate(opt: Opt) {
    if (opt.kind === "exam-filter") {
      setText("QUIZ:");
      setActive(-1);
      inputRef.current?.focus();
    } else {
      addExam(opt.name);
    }
  }

  function commit() {
    onExamsChange(scopedExams);
    onCommit(freeQuery);
    setDraftExams([]);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => stepActive(a, optionCount, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => stepActive(a, optionCount, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) {
        const opt = optionAt(active);
        if (opt) return activate(opt);
      }
      if (inExamMode) {
        if (examResults[0]) return addExam(examResults[0]);
        return;
      }
      commit();
    } else if (e.key === "Escape") {
      revert();
    } else if (e.key === "Backspace" && text === "") {
      // Only what the bar actually shows is backspace-able.
      const lastExam = draftExams[draftExams.length - 1];
      if (lastExam) removeQuiz(lastExam);
    }
  }

  // Drafts only: once applied, a Quiz is the Quiz pill's to display.
  const scopeChips = draftExams.map((name) => ({
    kind: "Quiz",
    name,
    remove: () => removeQuiz(name),
  }));

  const placeholder = scopeChips.length
    ? "Search Within Scope..."
    : "Search User's Name, Email, or Phone...";

  return (
    <div className={`usearch${secondary ? " usearch--secondary" : ""}`} ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <div className="usearch-scopes">
          {scopeChips.map((chip) => (
            <SearchScopeChip
              key={`${chip.kind}-${chip.name}`}
              label={`${chip.kind}:`}
              name={chip.name}
              onRemove={chip.remove}
            />
          ))}
        </div>
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {/* Figma 399:216 "Search Bar - Applied": once there is something to
            clear, the ⌘K badge gives way to a ✕ that clears on click. */}
        {text || scopeChips.length > 0 || query ? (
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

      {/* Typed text with nothing to suggest: no panel — Enter searches it. */}
      {open && !(hasFree && suggestions.length === 0) && (
        <div className="usearch-panel">
          {!inExamMode && (
            <>
              {suggestions.length > 0 && <div className="usearch-head">Suggested filters</div>}
              {suggestions.map((opt, i) => {
                /* Typed: the matching value + what it is (1542:2130). */
                if (hasFree && opt.kind === "exam") {
                  return (
                    <SuggestionRow
                      key={opt.name}
                      suggestion={{ name: opt.name, kind: "Quiz", chip: "Quiz:" }}
                      active={active === i}
                      onHover={() => setActive(i)}
                      onClick={() => activate(opt)}
                    />
                  );
                }
                const row = suggestionRow(opt, { allExams });
                if (!row) return null;
                return (
                  <OptionRow
                    key={row.key}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => activate(opt)}
                  >
                    <span className="usearch-chip">{row.chip}</span>
                    <span className="usearch-row-ex">{row.example}</span>
                    <span className="usearch-row-desc">{row.desc}</span>
                  </OptionRow>
                );
              })}

            </>
          )}

          {inExamMode && (
            <>
              <div className="usearch-head">Quizzes</div>
              {examResults.length === 0 ? (
                <>{examQuery.trim() ? <SearchNoResults /> : <div className="usearch-empty">{"Start typing a quiz name…"}</div>}</>
              ) : (
                examResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "exam", name })}>
                    <span className="usearch-chip">Quiz:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{allExams.counts.get(name)} submissions</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          <SearchHints />
        </div>
      )}
    </div>
  );
}

type NameCounts = { names: string[]; counts: Map<string, number> };

/** Chip / example / description for one "Suggested filters" row — the static
 * prefix hints when the box is empty, a real scope value once it isn't. */
function suggestionRow(
  opt: Opt,
  all: { allExams: NameCounts },
): { key: string; chip: string; example: string; desc: string } | null {
  const count = (c: NameCounts, name: string) => `${c.counts.get(name) ?? 0} submissions`;
  switch (opt.kind) {
    case "exam-filter":
      return { key: "exam-filter", chip: "Quiz:", example: "Quiz: EPA 608 Universal", desc: "Filter by Quiz" };
    case "exam":
      return { key: `exam:${opt.name}`, chip: "Quiz:", example: opt.name, desc: count(all.allExams, opt.name) };
    default:
      return null;
  }
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
