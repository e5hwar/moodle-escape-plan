import { useEffect, useMemo, useRef, useState } from "react";
import {
  QUESTION_TYPE_OPTIONS,
  longQuestionType,
  type Question,
} from "../data/questionBank";

import { SearchIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

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

type Opt =
  | { kind: "category-filter" }
  | { kind: "type-filter" }
  | { kind: "quiz-filter" }
  | { kind: "form-filter" }
  | { kind: "search" }
  | { kind: "pick"; token: Token };

// The four "Suggested filters" rows, in render order.
const FILTER_ROWS = 4;

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
  query,
  onCommit,
}: {
  categoryOptions: string[];
  questions: Question[];
  /** Filters currently applied to the table — all four are shared with the Filters row. */
  selection: string[];
  onSelectionChange: (next: string[]) => void;
  types: string[];
  onTypesChange: (next: string[]) => void;
  quizzes: string[];
  onQuizzesChange: (next: string[]) => void;
  forms: string[];
  onFormsChange: (next: string[]) => void;
  query: string;
  /** Applied only on Enter — the table never filters as you type. */
  onCommit: (q: string) => void;
}) {
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
  const quizMatch = text.match(/^\s*quiz(?:zes)?:\s*(.*)$/i);
  const formMatch = text.match(/^\s*(?:feedback\s*)?forms?:\s*(.*)$/i);

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
    return QUESTION_TYPE_OPTIONS.filter(
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
      .filter((name) => name !== taken && !quizzes.includes(name) && name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizQuery, quizCounts, draft, quizzes]);

  const formResults = useMemo(() => {
    const q = formQuery.trim().toLowerCase();
    const taken = drafted("form");
    return [...formCounts.keys()]
      .filter((name) => name !== taken && !forms.includes(name) && name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formQuery, formCounts, draft, forms]);

  // Options available to keyboard navigation, in render order.
  const optionCount = inCategoryMode
    ? categoryResults.length
    : inTypeMode
      ? typeResults.length
      : inQuizMode
        ? quizResults.length
        : inFormMode
          ? formResults.length
          : FILTER_ROWS + (hasQuery ? 1 : 0);

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
    if (i === 0) return { kind: "category-filter" };
    if (i === 1) return { kind: "type-filter" };
    if (i === 2) return { kind: "quiz-filter" };
    if (i === 3) return { kind: "form-filter" };
    if (i === FILTER_ROWS && hasQuery) return { kind: "search" };
    return null;
  }

  // Preselect the "Search for…" row when free text is entered so Enter searches.
  useEffect(() => {
    setActive(!inMode && hasQuery ? FILTER_ROWS : -1);
  }, [text, draft.length, inMode, hasQuery]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

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
    if (newQuizzes.length) onQuizzesChange([...new Set([...quizzes, ...newQuizzes])]);
    const newForms = picked("form");
    if (newForms.length) onFormsChange([...new Set([...forms, ...newForms])]);
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
      case "search":
        return commit();
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
      // Enter inside a token mode takes the first match; otherwise it searches.
      if (inMode) {
        const first = optionAt(0);
        if (first) activate(first);
        return;
      }
      commit();
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && text === "" && scoped) {
      setDraft(draft.slice(0, -1));
    }
  }

  const placeholder = !scoped
    ? "Search Questions by Text or ID"
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
              <span className="usearch-scope" key={t.kind}>
                <span className="usearch-scope-label">{TOKEN_LABELS[t.kind]}</span>
                <span className="usearch-scope-name">{t.name}</span>
              </span>
            ))}
          </span>
        )}
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
        <span className="usearch-kbd">
          <span className="kbd-cmd">⌘</span>
          <span className="kbd-letter">K</span>
        </span>
      </div>

      {open && (
        <div className="usearch-panel">
          {!inMode && (
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
              <OptionRow
                active={active === 1}
                onHover={() => setActive(1)}
                onClick={() => activate({ kind: "type-filter" })}
              >
                <span className="usearch-chip">Type:</span>
                <span className="usearch-row-ex">Type: Multiple Choice</span>
                <span className="usearch-row-desc">Filter by Question Type</span>
              </OptionRow>
              <OptionRow
                active={active === 2}
                onHover={() => setActive(2)}
                onClick={() => activate({ kind: "quiz-filter" })}
              >
                <span className="usearch-chip">Quizzes:</span>
                <span className="usearch-row-ex">Quizzes: EPA Universal Exam</span>
                <span className="usearch-row-desc">Filter by the Quiz using the Question</span>
              </OptionRow>
              <OptionRow
                active={active === 3}
                onHover={() => setActive(3)}
                onClick={() => activate({ kind: "form-filter" })}
              >
                <span className="usearch-chip">Feedback Form:</span>
                <span className="usearch-row-ex">Feedback Form: Post-Cert Satisfaction</span>
                <span className="usearch-row-desc">
                  Filter by the Feedback Form using the Question
                </span>
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
                <div className="usearch-empty">
                  {typeQuery.trim()
                    ? `No question types match “${typeQuery.trim()}”.`
                    : "Start typing a question type…"}
                </div>
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
                <div className="usearch-empty">
                  {quizQuery.trim()
                    ? `No quizzes match “${quizQuery.trim()}”.`
                    : "Start typing a quiz name…"}
                </div>
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
                <div className="usearch-empty">
                  {formQuery.trim()
                    ? `No feedback forms match “${formQuery.trim()}”.`
                    : "Start typing a feedback form name…"}
                </div>
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

          {!inMode && hasQuery ? (
            <SearchForRow
              query={freeQuery.trim()}
              scope="Question Bank"
              active={active === FILTER_ROWS}
              onHover={() => setActive(FILTER_ROWS)}
              onClick={commit}
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
