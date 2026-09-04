import { useEffect, useMemo, useRef, useState } from "react";
import { type Submission } from "../data/proctoring";
import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;
/** Per scope kind (Quiz / Company) in "Suggested filters". */
const MAX_SUGGESTED_PER_KIND = 2;

type Opt =
  | { kind: "exam-filter" }
  | { kind: "company-filter" }
  | { kind: "exam"; name: string }
  | { kind: "company"; name: string };

/**
 * The Proctoring queue's search — the Users / Hands-On Task combobox, with the
 * two scopes this page filters on (Quiz, Company). Quiz has a filter pill on the
 * page, so its applied values leave the bar on Enter and are shown (and cleared)
 * there, the way ReviewSearch hands its scopes to the pills. Company has no pill,
 * so its applied chips stay in the bar — that is where they are removed from.
 *
 * The panel offers filters only — no live result rows. The table filters on the
 * COMMITTED query, so a list that updated per keystroke would be showing results
 * the table below it does not have yet.
 */
export function ProctoringSearch({
  submissions,
  exams: appliedExams,
  onExamsChange,
  companies: appliedCompanies,
  onCompaniesChange,
  query,
  onCommit,
}: {
  submissions: Submission[];
  exams: string[];
  onExamsChange: (next: string[]) => void;
  companies: string[];
  onCompaniesChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
}) {
  const [text, setText] = useState(query);
  // Scopes picked in THIS search session — not yet applied to the table.
  const [draftExams, setDraftExams] = useState<string[]>([]);
  const [draftCompanies, setDraftCompanies] = useState<string[]>([]);
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

  const allCompanies = useMemo(() => {
    const counts = new Map<string, number>();
    submissions.forEach((s) => {
      if (s.companyName) counts.set(s.companyName, (counts.get(s.companyName) ?? 0) + 1);
    });
    return { names: [...counts.keys()].sort(), counts };
  }, [submissions]);

  // Prefixes (case-insensitive) switch the panel into selection mode.
  const examMatch = text.match(/^\s*quiz:\s*(.*)$/i);
  const companyMatch = text.match(/^\s*company:\s*(.*)$/i);
  const inExamMode = examMatch != null;
  const inCompanyMode = companyMatch != null;
  const inScopeMode = inExamMode || inCompanyMode;
  const examQuery = examMatch ? examMatch[1] : "";
  const companyQuery = companyMatch ? companyMatch[1] : "";
  const freeQuery = inScopeMode ? "" : text;

  // Everything currently narrowing the bar — applied scopes plus this session's drafts.
  const scopedExams = useMemo(
    () => Array.from(new Set([...appliedExams, ...draftExams])),
    [appliedExams, draftExams],
  );
  const scopedCompanies = useMemo(
    () => Array.from(new Set([...appliedCompanies, ...draftCompanies])),
    [appliedCompanies, draftCompanies],
  );

  const examResults = useMemo(() => {
    const q = examQuery.trim().toLowerCase();
    return allExams.names
      .filter((e) => !scopedExams.includes(e) && e.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [allExams, examQuery, scopedExams]);

  const companyResults = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return allCompanies.names
      .filter((c) => !scopedCompanies.includes(c) && c.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [allCompanies, companyQuery, scopedCompanies]);

  /* "Suggested filters" follows what's typed: with an empty box it teaches the
     two scope prefixes, and as soon as there is text it offers the Quizzes and
     Companies that actually match it — so "delta" can be turned into a scope
     without knowing the prefix syntax. */
  const suggestions = useMemo<Opt[]>(() => {
    const q = freeQuery.trim().toLowerCase();
    if (!q) return [{ kind: "exam-filter" }, { kind: "company-filter" }];
    const pick = (names: string[], scoped: string[]) =>
      names.filter((n) => !scoped.includes(n) && n.toLowerCase().includes(q)).slice(0, MAX_SUGGESTED_PER_KIND);
    return [
      ...pick(allExams.names, scopedExams).map((name) => ({ kind: "exam", name }) as Opt),
      ...pick(allCompanies.names, scopedCompanies).map((name) => ({ kind: "company", name }) as Opt),
    ];
  }, [freeQuery, allExams, allCompanies, scopedExams, scopedCompanies]);

  const optionCount = inExamMode
    ? examResults.length
    : inCompanyMode
    ? companyResults.length
    : suggestions.length;

  function optionAt(i: number): Opt | null {
    if (inExamMode) return examResults[i] ? { kind: "exam", name: examResults[i] } : null;
    if (inCompanyMode) return companyResults[i] ? { kind: "company", name: companyResults[i] } : null;
    return suggestions[i] ?? null;
  }

  useEffect(() => setActive(-1), [text, draftExams.length, draftCompanies.length]);

  /* Abandon an uncommitted edit. The table only ever filters on the APPLIED
     query, so a bar left showing half-typed text would be lying about what the
     results are for — clicking away or pressing Escape puts the applied query
     (and no pending scope) back. */
  function revert() {
    setText(query);
    setDraftExams([]);
    setDraftCompanies([]);
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
  }, [open, query, draftExams, draftCompanies]);

  /* Clear the applied search outright — no Enter needed. It clears what the bar
     itself is showing: the text, this session's drafts, and the applied Company
     chips. Applied quizzes belong to the Quiz pill and are left alone. */
  function clearSearch() {
    setText("");
    setDraftExams([]);
    setDraftCompanies([]);
    setActive(-1);
    setOpen(false);
    onCompaniesChange([]);
    onCommit("");
  }

  function addExam(name: string) {
    if (!scopedExams.includes(name)) setDraftExams([...draftExams, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }
  function addCompany(name: string) {
    if (!scopedCompanies.includes(name)) setDraftCompanies([...draftCompanies, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  /* ✕ on a chip: drop it from whichever list it lives in and re-run the search.
     The `exam*` identifiers are the data's field name (Submission.exam); the
     user-facing label for that field on this page is "Quiz". */
  function removeQuiz(name: string) {
    setDraftExams((d) => d.filter((x) => x !== name));
    if (appliedExams.includes(name)) onExamsChange(appliedExams.filter((x) => x !== name));
  }
  function removeCompany(name: string) {
    setDraftCompanies((d) => d.filter((x) => x !== name));
    if (appliedCompanies.includes(name)) onCompaniesChange(appliedCompanies.filter((x) => x !== name));
  }

  function activate(opt: Opt) {
    if (opt.kind === "exam-filter") {
      setText("QUIZ:");
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "company-filter") {
      setText("COMPANY:");
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "exam") {
      addExam(opt.name);
    } else {
      addCompany(opt.name);
    }
  }

  function commit() {
    onExamsChange(scopedExams);
    onCompaniesChange(scopedCompanies);
    onCommit(freeQuery);
    setDraftExams([]);
    setDraftCompanies([]);
    setOpen(false);
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
      if (inExamMode) {
        if (examResults[0]) return addExam(examResults[0]);
        return;
      }
      if (inCompanyMode) {
        if (companyResults[0]) return addCompany(companyResults[0]);
        return;
      }
      commit();
    } else if (e.key === "Escape") {
      revert();
    } else if (e.key === "Backspace" && text === "") {
      // Only what the bar actually shows is backspace-able.
      const lastCompany = scopedCompanies[scopedCompanies.length - 1];
      const lastExam = draftExams[draftExams.length - 1];
      if (lastCompany) removeCompany(lastCompany);
      else if (lastExam) removeQuiz(lastExam);
    }
  }

  const scopeChips = [
    // Drafts only for Quiz: once applied it is the Quiz pill's to display.
    ...draftExams.map((name) => ({ kind: "Quiz", name, remove: () => removeQuiz(name) })),
    ...scopedCompanies.map((name) => ({ kind: "Company", name, remove: () => removeCompany(name) })),
  ];

  const placeholder = scopeChips.length
    ? "Search within scope…"
    : "Search User's Name, Email, or Phone";

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <div className="usearch-scopes">
          {scopeChips.map((chip) => (
            <span className="usearch-scope" key={`${chip.kind}-${chip.name}`}>
              <span className="usearch-scope-label">{chip.kind}:</span>
              <span className="usearch-scope-name">{chip.name}</span>
              <button
                type="button"
                className="usearch-scope-x"
                aria-label={`Remove ${chip.kind} filter ${chip.name}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={chip.remove}
              >
                <SearchClearIcon />
              </button>
            </span>
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

      {open && (
        <div className="usearch-panel">
          {!inScopeMode && (
            <>
              {suggestions.length > 0 && <div className="usearch-head">Suggested filters</div>}
              {suggestions.map((opt, i) => {
                const row = suggestionRow(opt, { allExams, allCompanies });
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
                <div className="usearch-empty">
                  {examQuery.trim() ? `No quizzes match “${examQuery.trim()}”.` : "Start typing a quiz name…"}
                </div>
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

          {inCompanyMode && (
            <>
              <div className="usearch-head">Companies</div>
              {companyResults.length === 0 ? (
                <div className="usearch-empty">
                  {companyQuery.trim() ? `No companies match “${companyQuery.trim()}”.` : "Start typing a company name…"}
                </div>
              ) : (
                companyResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "company", name })}>
                    <span className="usearch-chip">Company:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{allCompanies.counts.get(name)} submissions</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {freeQuery.trim() ? (
            <SearchForRow query={freeQuery.trim()} scope="Submissions" onClick={commit} />
          ) : (
            <SearchHints />
          )}
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
  all: { allExams: NameCounts; allCompanies: NameCounts },
): { key: string; chip: string; example: string; desc: string } | null {
  const count = (c: NameCounts, name: string) => `${c.counts.get(name) ?? 0} submissions`;
  switch (opt.kind) {
    case "exam-filter":
      return { key: "exam-filter", chip: "Quiz:", example: "Quiz: EPA 608 Universal", desc: "Filter by Quiz" };
    case "company-filter":
      return { key: "company-filter", chip: "Company:", example: "Company: Acme Inc.", desc: "Filter by User's Company" };
    case "exam":
      return { key: `exam:${opt.name}`, chip: "Quiz:", example: opt.name, desc: count(all.allExams, opt.name) };
    case "company":
      return { key: `company:${opt.name}`, chip: "Company:", example: opt.name, desc: count(all.allCompanies, opt.name) };
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
