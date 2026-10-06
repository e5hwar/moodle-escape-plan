import { useEffect, useMemo, useRef, useState } from "react";
import {
  QUESTION_TYPE_OPTIONS,
  longQuestionType,
  type Question,
} from "../data/questionBank";

import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchScopeChip, stepActive, SearchNoResults, suggestFilters, SuggestionRow } from "./SearchPanelParts";

const MAX_RESULTS = 8;
const CATEGORY_PREFIX = "Category:";
const TYPE_PREFIX = "Type:";
const QUIZ_PREFIX = "Quizzes:";
const FORM_PREFIX = "Feedback Form:";

/* A filter picked in THIS search session. Like the Users search's company token,
   it sits inside the search bar until Enter moves it onto the Filters row. */
type Token = { kind: "category" | "type" | "quiz" | "form"; name: string };

const TOKEN_LABELS: Record<Token["kind"], string> = {
  category: CATEGORY_PREFIX,
  type: TYPE_PREFIX,
  quiz: QUIZ_PREFIX,
  form: FORM_PREFIX,
};

const SUGGEST_ROW: Record<SuggestKind, React.ReactNode> = {
  category: (
    <>
      <span className="usearch-chip">Category:</span>
      <span className="usearch-row-ex">Category: EPA 608 &gt; Universal</span>
      <span className="usearch-row-desc">Filter by Category or Subcategory</span>
    </>
  ),
  type: (
    <>
      <span className="usearch-chip">Type:</span>
      <span className="usearch-row-ex">Type: Multiple Choice</span>
      <span className="usearch-row-desc">Filter by Question Type</span>
    </>
  ),
  quiz: (
    <>
      <span className="usearch-chip">Quizzes:</span>
      <span className="usearch-row-ex">Quizzes: EPA Universal Exam</span>
      <span className="usearch-row-desc">Filter by the Quiz using the Question</span>
    </>
  ),
  form: (
    <>
      <span className="usearch-chip">Feedback Form:</span>
      <span className="usearch-row-ex">Feedback Form: Post-Cert Satisfaction</span>
      <span className="usearch-row-desc">Filter by the Feedback Form using the Question</span>
    </>
  ),
};

type Opt =
  | { kind: "category-filter" }
  | { kind: "type-filter" }
  | { kind: "quiz-filter" }
  | { kind: "form-filter" }
  | { kind: "pick"; token: Token };

/* The "Suggested filters" rows, in render order. Category and Type are always
   offered; Quizzes / Feedback Form only when the caller wires that filter (a
   picker that has no such pill must not apply one it can't show). */
type SuggestKind = "category" | "type" | "quiz" | "form";

/** A typed suggestion's label → the pending token it becomes. */
const SUGGESTION_TOKEN: Record<string, Token["kind"]> = {
  Category: "category",
  "Question Type": "type",
  Quiz: "quiz",
  "Feedback Form": "form",
};

export function QuestionSearch({
  categoryOptions,
  questions,
  selection,
  onSelectionChange,
  types,
  onTypesChange,
  quizzes,
  onQuizzesChange,
  forms,
  onFormsChange,
  typeOptions,
  query,
  onCommit,
  placeholder,
}: {
  categoryOptions: string[];
  questions: Question[];
  /** Empty-bar prompt — the landing asks for "a Question or Category". */
  placeholder?: string;
  /** Filters currently applied to the table — all four are shared with the Filters row. */
  selection: string[];
  onSelectionChange: (next: string[]) => void;
  types: string[];
  onTypesChange: (next: string[]) => void;
  /** Optional pair: without `onQuizzesChange` there is no Quizzes: filter. */
  quizzes?: string[];
  onQuizzesChange?: (next: string[]) => void;
  /** Optional pair: without `onFormsChange` there is no Feedback Form: filter. */
  forms?: string[];
  onFormsChange?: (next: string[]) => void;
  /** The Type: list — defaults to every Bank type (a Quiz picker passes the
   *  graded ones only). */
  typeOptions?: readonly string[];
  query: string;
  /** Applied only on Enter — the table never filters as you type. */
  onCommit: (q: string) => void;
}) {
  const quizList = quizzes ?? [];
  const formList = forms ?? [];
  const suggest: SuggestKind[] = [
    "category",
    "type",
    ...(onQuizzesChange ? (["quiz"] as const) : []),
    ...(onFormsChange ? (["form"] as const) : []),
  ];
  const FILTER_ROWS = suggest.length;
  const [text, setText] = useState(query);
  // Pending tokens — one per kind, in the order they were picked. Nothing here
  // reaches the table until Enter.
  const [draft, setDraft] = useState<Token[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setText(query), [query]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    questions.forEach((q) => {
      const t = longQuestionType(q.type);
      m.set(t, (m.get(t) ?? 0) + 1);
    });
    return m;
  }, [questions]);

  const quizCounts = useMemo(() => {
    const m = new Map<string, number>();
    questions.forEach((q) => q.quizzes.forEach((name) => m.set(name, (m.get(name) ?? 0) + 1)));
    return m;
  }, [questions]);

  const formCounts = useMemo(() => {
    const m = new Map<string, number>();
    questions.forEach((q) => q.forms.forEach((name) => m.set(name, (m.get(name) ?? 0) + 1)));
    return m;
  }, [questions]);

  const drafted = (kind: Token["kind"]) => draft.find((t) => t.kind === kind)?.name ?? null;
  const scoped = draft.length > 0;

  // Prefix detection (case-insensitive) puts the box into a filter-selection mode.
  const categoryMatch = text.match(/^\s*categor(?:y|ies):\s*(.*)$/i);
  const typeMatch = text.match(/^\s*type:\s*(.*)$/i);
  const quizMatch = onQuizzesChange ? text.match(/^\s*quiz(?:zes)?:\s*(.*)$/i) : null;
  const formMatch = onFormsChange ? text.match(/^\s*(?:feedback\s*)?forms?:\s*(.*)$/i) : null;

  const inCategoryMode = categoryMatch != null;
  const inTypeMode = !inCategoryMode && typeMatch != null;
  const inQuizMode = !inCategoryMode && !inTypeMode && quizMatch != null;
  const inFormMode = !inCategoryMode && !inTypeMode && !inQuizMode && formMatch != null;
  const inMode = inCategoryMode || inTypeMode || inQuizMode || inFormMode;

  const categoryQuery = categoryMatch ? categoryMatch[1] : "";
  const typeQuery = typeMatch ? typeMatch[1] : "";
  const quizQuery = quizMatch ? quizMatch[1] : "";
  const formQuery = formMatch ? formMatch[1] : "";
  const freeQuery = inMode ? "" : text;
  const hasQuery = freeQuery.trim().length > 0;

  // Each list hides what is already pending in the bar or applied to the table.
  const categoryResults = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    const taken = drafted("category");
    return categoryOptions
      .filter((l) => l !== taken && !selection.includes(l) && l.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryQuery, categoryOptions, draft, selection]);

  const typeResults = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    const taken = drafted("type");
    return (typeOptions ?? QUESTION_TYPE_OPTIONS).filter(
      (t) =>
        t !== taken &&
        !types.includes(t) &&
        t.toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeQuery, draft, types]);

  const quizResults = useMemo(() => {
    const q = quizQuery.trim().toLowerCase();
    const taken = drafted("quiz");
    return [...quizCounts.keys()]
      .filter((name) => name !== taken && !quizList.includes(name) && name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizQuery, quizCounts, draft, quizzes]);

  const formResults = useMemo(() => {
    const q = formQuery.trim().toLowerCase();
    const taken = drafted("form");
    return [...formCounts.keys()]
      .filter((name) => name !== taken && !formList.includes(name) && name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formQuery, formCounts, draft, forms]);

  /* Free text: every filter value it matches — Categories, Types, then
     Quizzes / Feedback Forms where wired (1542:2130). None → no panel; Enter
     searches the text as typed. A pick becomes that kind's pending token. */
  const suggestions = useMemo(() => {
    if (!hasQuery) return [];
    const not = (kind: Token["kind"], applied: readonly string[]) =>
      [...applied, ...(drafted(kind) ? [drafted(kind)!] : [])];
    return suggestFilters(
      freeQuery,
      [
        { kind: "Category", chip: CATEGORY_PREFIX, values: categoryOptions, exclude: not("category", selection) },
        { kind: "Question Type", chip: TYPE_PREFIX, values: typeOptions ?? QUESTION_TYPE_OPTIONS, exclude: not("type", types) },
        ...(onQuizzesChange
          ? [{ kind: "Quiz", chip: QUIZ_PREFIX, values: [...quizCounts.keys()].sort((a, b) => a.localeCompare(b)), exclude: not("quiz", quizList) }]
          : []),
        ...(onFormsChange
          ? [{ kind: "Feedback Form", chip: FORM_PREFIX, values: [...formCounts.keys()].sort((a, b) => a.localeCompare(b)), exclude: not("form", formList) }]
          : []),
      ],
      MAX_RESULTS,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQuery, freeQuery, categoryOptions, typeOptions, quizCounts, formCounts, selection, types, quizzes, forms, draft]);
  const showPanel = open && !(!inMode && hasQuery && suggestions.length === 0);

  // Options available to keyboard navigation, in render order.
  const optionCount = inCategoryMode
    ? categoryResults.length
    : inTypeMode
      ? typeResults.length
      : inQuizMode
        ? quizResults.length
        : inFormMode
          ? formResults.length
          : hasQuery
            ? suggestions.length
            : FILTER_ROWS;

  function optionAt(i: number): Opt | null {
    if (inCategoryMode) {
      const o = categoryResults[i];
      return o ? { kind: "pick", token: { kind: "category", name: o } } : null;
    }
    if (inTypeMode) {
      const t = typeResults[i];
      return t ? { kind: "pick", token: { kind: "type", name: t } } : null;
    }
    if (inQuizMode) {
      const n = quizResults[i];
      return n ? { kind: "pick", token: { kind: "quiz", name: n } } : null;
    }
    if (inFormMode) {
      const n = formResults[i];
      return n ? { kind: "pick", token: { kind: "form", name: n } } : null;
    }
    if (hasQuery) {
      const sg = suggestions[i];
      return sg ? { kind: "pick", token: { kind: SUGGESTION_TOKEN[sg.kind], name: sg.name } } : null;
    }
    if (i < FILTER_ROWS) return { kind: `${suggest[i]}-filter` } as Opt;
    return null;
  }

  // Typing puts the caret back in the bar — Enter there searches the text.
  useEffect(() => {
    setActive(-1);
  }, [text, draft.length, inMode, hasQuery]);

  /* Abandon an uncommitted edit. The table only ever filters on the APPLIED
     query, so a bar left showing half-typed text would be lying about what the
     results are for — clicking away or pressing Escape puts the applied query
     (and no pending scope) back. */
  function revert() {
    setText(query);
    setDraft([]);
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
    // `query`/`draft` are deps so the handler always reverts to current state.
  }, [open, query, draft]);

  // Clear the applied search outright — no Enter needed.
  function clearSearch() {
    setText("");
    setDraft([]);
    setActive(-1);
    setOpen(false);
    /* Only re-commit when there IS a committed query to drop. Pages wire
       onCommit to their landing morph, so an unconditional call would shove
       the page out of its landing view just for clearing typed text. */
    if (query) onCommit("");
  }

  // Add a token to the pending scope — one per kind, re-picking replaces it.
  function addToken(token: Token) {
    setDraft((prev) => [...prev.filter((t) => t.kind !== token.kind), token]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function startMode(prefix: string) {
    setText(`${prefix} `);
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  // Enter — run the pending search. Tokens move onto the Filters row pills and
  // clear from the bar; free text becomes the applied query.
  function commit() {
    const picked = (kind: Token["kind"]) =>
      draft.filter((t) => t.kind === kind).map((t) => t.name);
    const newCats = picked("category");
    if (newCats.length) onSelectionChange([...new Set([...selection, ...newCats])]);
    const newTypes = picked("type");
    if (newTypes.length) onTypesChange([...new Set([...types, ...newTypes])]);
    const newQuizzes = picked("quiz");
    if (newQuizzes.length) onQuizzesChange?.([...new Set([...quizList, ...newQuizzes])]);
    const newForms = picked("form");
    if (newForms.length) onFormsChange?.([...new Set([...formList, ...newForms])]);
    onCommit(freeQuery.trim());
    setDraft([]);
    setOpen(false);
  }

  function activate(opt: Opt) {
    switch (opt.kind) {
      case "category-filter":
        return startMode(CATEGORY_PREFIX);
      case "type-filter":
        return startMode(TYPE_PREFIX);
      case "quiz-filter":
        return startMode(QUIZ_PREFIX);
      case "form-filter":
        return startMode(FORM_PREFIX);
      case "pick":
        return addToken(opt.token);
    }
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
      // Enter inside a token mode takes the first match; otherwise it searches.
      if (inMode) {
        const first = optionAt(0);
        if (first) activate(first);
        return;
      }
      commit();
    } else if (e.key === "Escape") {
      revert();
    } else if (e.key === "Backspace" && text === "" && scoped) {
      setDraft(draft.slice(0, -1));
    }
  }

  const barPlaceholder = !scoped
    ? placeholder ?? "Search Questions by Text or ID..."
    : draft.length === 1
      ? `Search within ${draft[0].name}…`
      : `Search within ${draft.length} filters…`;

  return (
    <div className="usearch qb-search" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        {scoped && (
          <span className="usearch-scopes">
            {draft.map((t) => (
              <SearchScopeChip
                key={t.kind}
                label={TOKEN_LABELS[t.kind]}
                name={t.name}
                onRemove={() => setDraft((prev) => prev.filter((x) => x.kind !== t.kind))}
              />
            ))}
          </span>
        )}
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder={barPlaceholder}
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
        {text || scoped || query ? (
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

      {showPanel && (
        <div className="usearch-panel">
          {!inMode && hasQuery && (
            <>
              <div className="usearch-head">Suggested filters</div>
              {suggestions.map((sg, i) => (
                <SuggestionRow
                  key={sg.kind + sg.name}
                  suggestion={sg}
                  active={active === i}
                  onHover={() => setActive(i)}
                  onClick={() => activate(optionAt(i)!)}
                />
              ))}
            </>
          )}

          {!inMode && !hasQuery && (
            <>
              <div className="usearch-head">Suggested filters</div>
              {suggest.map((kind, i) => (
                <OptionRow
                  key={kind}
                  active={active === i}
                  onHover={() => setActive(i)}
                  onClick={() => activate({ kind: `${kind}-filter` } as Opt)}
                >
                  {SUGGEST_ROW[kind]}
                </OptionRow>
              ))}
            </>
          )}

          {inCategoryMode && (
            <>
              <div className="usearch-head">Category</div>
              {categoryResults.length === 0 ? (
                <>{categoryQuery.trim() ? <SearchNoResults /> : <div className="usearch-empty">{"Start typing a category name…"}</div>}</>
              ) : (
                categoryResults.map((label, i) => (
                  <OptionRow
                    key={label}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => addToken({ kind: "category", name: label })}
                  >
                    <span className="usearch-chip">Category:</span>
                    <span className="usearch-row-ex">{label}</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {inTypeMode && (
            <>
              <div className="usearch-head">Question type</div>
              {typeResults.length === 0 ? (
                <>{typeQuery.trim() ? <SearchNoResults /> : <div className="usearch-empty">{"Start typing a question type…"}</div>}</>
              ) : (
                typeResults.map((name, i) => (
                  <OptionRow
                    key={name}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => addToken({ kind: "type", name })}
                  >
                    <span className="usearch-chip">Type:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{typeCounts.get(name) ?? 0} questions</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {inQuizMode && (
            <>
              <div className="usearch-head">Quizzes</div>
              {quizResults.length === 0 ? (
                <>{quizQuery.trim() ? <SearchNoResults /> : <div className="usearch-empty">{"Start typing a quiz name…"}</div>}</>
              ) : (
                quizResults.map((name, i) => (
                  <OptionRow
                    key={name}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => addToken({ kind: "quiz", name })}
                  >
                    <span className="usearch-chip">Quizzes:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{quizCounts.get(name) ?? 0} questions</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {inFormMode && (
            <>
              <div className="usearch-head">Feedback Forms</div>
              {formResults.length === 0 ? (
                <>{formQuery.trim() ? <SearchNoResults /> : <div className="usearch-empty">{"Start typing a feedback form name…"}</div>}</>
              ) : (
                formResults.map((name, i) => (
                  <OptionRow
                    key={name}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => addToken({ kind: "form", name })}
                  >
                    <span className="usearch-chip">Feedback Form:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{formCounts.get(name) ?? 0} questions</span>
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
