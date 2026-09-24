import { useEffect, useMemo, useState } from "react";
import {
  questions as QUESTION_BANK,
  categories as QB_CATEGORIES,
  flattenCategories,
  longQuestionType,
  questionDates,
  supportsGrading,
  QUESTION_TYPE_MENU,
  QUESTION_TYPE_OPTIONS,
  type Question,
} from "../data/questionBank";
import { PrmModal } from "./PrmModal";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  RowChevronIcon,
  SearchIcon,
  SortIcon,
} from "./icons";

/* Select Questions — the Quiz wizard's Question Bank twin of SelectTasksModal
 * (Figma 682:2321): search bar, two filter pills, a sortable table and
 * pagination inside the shared PrmModal shell, with Cancel / Continue in the
 * modal's own footer. All the chrome is the `.stm-*` geometry that modal
 * introduced; only the column widths here are new.
 *
 * One modal serves both Add flows on the Questions step. `static` mode picks
 * hand-picked questions — selection order is kept, and questions already on
 * the Quiz show ticked but locked. `pool` mode builds/edits a random pool —
 * order is irrelevant (the pool is a set the Quiz draws from), and the modal
 * opens pre-ticked with the pool's current members.
 *
 * Selection is staged: the modal owns `picked` and only hands it back on
 * Continue, so Cancel discards. */

const PAGE_SIZE = 50;

/* The Question Type pill lists exactly what the Question Bank page's own pill
   lists — `QUESTION_TYPE_OPTIONS`, the LONG names. This picker used to spell
   its own shorter list, which got two things wrong: the casing ("Match the
   following" vs the Bank's "Match the Following"), and it offered "Multiple
   select" as a separate option. It isn't one — `longQuestionType` folds
   Multiple choice and Multiple select into a single "Multiple Choice", which is
   why the Bank offers six options and not seven. */
const ALL_TYPES = QUESTION_TYPE_OPTIONS;

/** Quizzes only take graded questions, so the pill only offers graded types.
 *  Derived from the Bank rather than re-listed, so it can't drift again. */
const GRADED_TYPES = QUESTION_TYPE_OPTIONS.filter((label) =>
  QUESTION_TYPE_MENU.some((m) => m.label === label && supportsGrading(m.type)),
);

type SortKey = "question" | "type" | "category" | "dateModified";
type SortDir = "asc" | "desc";

/** Only Active, graded Bank questions are eligible for Quizzes — both as
 *  hand-picked statics and as random-pool members. Feedback Forms drop the
 *  grading half of the test. */
function eligible(q: Question, gradedOnly: boolean) {
  return q.status === "Active" && (!gradedOnly || q.gradingEnabled);
}

function categoryOf(q: Question) {
  return q.categoryPath.join(" > ");
}

/* questionDates derives the whole mocked version history per call, and sorting
 * asks for it O(n log n) times — cache it once per question. */
const MODIFIED = new Map<string, string>();
function modifiedOf(q: Question) {
  let d = MODIFIED.get(q.id);
  if (!d) {
    d = questionDates(q).modified;
    MODIFIED.set(q.id, d);
  }
  return d;
}

/** A "Parent > Sub" pill label matches on the sub-category; a bare category
 *  label matches every question under it. */
function matchesCategoryLabel(q: Question, label: string) {
  return label.split(" > ").every((part, i) => q.categoryPath[i] === part);
}

function compare(a: Question, b: Question, key: SortKey): number {
  switch (key) {
    case "question":
      return a.text.localeCompare(b.text);
    case "type":
      return longQuestionType(a.type).localeCompare(longQuestionType(b.type));
    case "category":
      return categoryOf(a).localeCompare(categoryOf(b));
    case "dateModified":
      return (
        (Date.parse(modifiedOf(a)) || 0) - (Date.parse(modifiedOf(b)) || 0)
      );
  }
}

export function SelectQuestionsModal({
  mode,
  editingPool,
  excludeIds,
  value,
  gradedOnly = true,
  onCancel,
  onConfirm,
}: {
  mode: "static" | "pool";
  /** Pool mode only: editing an existing pool rather than building a new one. */
  editingPool?: boolean;
  /** Static mode only: questions already on the Quiz — shown ticked but locked. */
  excludeIds?: string[];
  /** Question ids already chosen — the modal opens pre-ticked. */
  value: string[];
  /** Quizzes only take graded questions; Feedback Forms take any Active one. */
  gradedOnly?: boolean;
  onCancel: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>(value);
  const [page, setPage] = useState(1);
  /** The row whose "Preview" was clicked — a read-only look at the question,
   *  stacked over this picker. */
  const [preview, setPreview] = useState<Question | null>(null);
  // Default sort is by last edited — newest first.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "dateModified",
    dir: "desc",
  });

  const isPool = mode === "pool";
  const typeOptions = gradedOnly ? GRADED_TYPES : ALL_TYPES;
  const locked = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  // The preview stacks on top, so it gets the key first — otherwise one Escape
  // would close both.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (preview) setPreview(null);
      else onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, preview]);

  const pool = useMemo(() => QUESTION_BANK.filter((q) => eligible(q, gradedOnly)), [gradedOnly]);

  // Category options limited to branches that actually hold graded questions.
  const allCats = useMemo(
    () =>
      flattenCategories(QB_CATEGORIES)
        .map((opt) => opt.label)
        .filter((label) => pool.some((q) => matchesCategoryLabel(q, label))),
    [pool],
  );

  /* Figma 1215:1354 — a category row leads with its own name and carries its
     parent as the muted "· …" clause, instead of repeating the whole
     "Parent > Child" path. Five sub-categories of one parent used to read as
     five near-identical three-line rows. The VALUE stays the full path, so
     filtering and search are unchanged — typing a parent still finds its
     children. */
  const catLabels = useMemo(
    () => Object.fromEntries(allCats.map((c) => [c, c.split(" > ").pop() ?? c])),
    [allCats],
  );
  const catHints = useMemo(
    () =>
      Object.fromEntries(
        allCats
          .filter((c) => c.includes(" > "))
          .map((c) => [c, c.split(" > ").slice(0, -1).join(" > ")]),
      ),
    [allCats],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((question) => {
      if (
        q &&
        !(
          question.text.toLowerCase().includes(q) ||
          question.id.toLowerCase().includes(q) ||
          categoryOf(question).toLowerCase().includes(q)
        )
      )
        return false;
      if (types.length && !types.includes(longQuestionType(question.type)))
        return false;
      if (cats.length && !cats.some((c) => matchesCategoryLabel(question, c)))
        return false;
      return true;
    });
  }, [pool, query, types, cats]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);

  function toggle(id: string) {
    if (locked.has(id)) return;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  /* Select-all covers every row the current search and filters match, not just
     the visible page — the same scope the Grant Attempts picker uses. Rows
     already on the Quiz are locked, so they sit out of both the count and the
     toggle. */
  const selectable = useMemo(() => sorted.filter((q) => !locked.has(q.id)), [sorted, locked]);
  const pickedHere = useMemo(
    () => selectable.filter((q) => picked.includes(q.id)).length,
    [selectable, picked],
  );
  const allOn = selectable.length > 0 && pickedHere === selectable.length;
  const someOn = pickedHere > 0 && !allOn;

  function toggleAll() {
    const ids = new Set(selectable.map((q) => q.id));
    setPicked((p) =>
      allOn
        ? p.filter((id) => !ids.has(id))
        : [...p, ...selectable.filter((q) => !p.includes(q.id)).map((q) => q.id)],
    );
  }

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  /** Any filter change can shrink the list under the current page. */
  function resetPage<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setPage(1);
    };
  }

  return (
    <PrmModal
      title={
        isPool
          ? editingPool
            ? "Edit Random Pool"
            : "Build a Random Pool"
          : "Select Questions"
      }
      description={
        isPool
          ? "Pick the questions this pool draws from. Each attempt draws a random subset, so selection order doesn't matter"
          : gradedOnly
            ? "Only Active questions with grading enabled are shown here. Questions join the Quiz in the order you pick them"
            : "Every Active question in the Bank is shown here. Questions join the form in the order you pick them"
      }
      confirmLabel="Add Questions"
      confirmDisabled={picked.length === 0}
      pick
      pickFull
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
    >
      <div className="stm">
        <div className="stm-toolbar">
          <div className="search-wrap stm-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input stm-search-input"
              placeholder="Search Questions..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filters stm-filters">
            <Dropdown
              width={220}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Question Type"
                  tip={FILTER_TIPS.questionPicker.type}
                  value={summarize(types, typeOptions)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setTypes)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: typeOptions }]}
                  value={types}
                  onApply={(v) => {
                    resetPage(setTypes)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>

            <Dropdown
              /* The 384px a hints clause needs (same as `.cascading-sub--wide`)
                 — at 280 every row wrapped to three lines. */
              width={384}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Category"
                  tip={FILTER_TIPS.questionPicker.category}
                  value={summarize(cats, allCats)}
                  open={open}
                  toggle={t}
                  onClear={() => resetPage(setCats)([])}
                />
              )}
            >
              {({ close }) => (
                <SectionedMultiSelect
                  sections={[{ items: allCats }]}
                  value={cats}
                  /* The Bank has hundreds of categories and sub-categories —
                     unusable as a plain scroll list. */
                  searchable
                  searchPlaceholder="Search Categories..."
                  labels={catLabels}
                  hints={catHints}
                  onApply={(v) => {
                    resetPage(setCats)(v);
                    close();
                  }}
                />
              )}
            </Dropdown>
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Column-width floor, per the shared table convention — below it the
              table scrolls sideways instead of crushing the cells. 44 check +
              260 question + 150 type + 190 category + 126 edited + 104
              actions. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": "874px" } as React.CSSProperties}
          >
            <table className="table table-head stm-table stm-table--preview sqm-table">
              <ColGroup />
              <thead>
                <tr>
                  <th className="stm-col-check no-sort">
                    <button
                      className={`checkbox ${allOn ? "checked" : someOn ? "partial" : ""}`}
                      aria-label={allOn ? "Deselect all" : "Select all"}
                      aria-pressed={allOn}
                      disabled={selectable.length === 0}
                      onClick={toggleAll}
                    >
                      {allOn ? <CheckIcon /> : someOn ? <span className="checkbox-dash" /> : null}
                    </button>
                  </th>
                  <Th col="question" label="Question" cls="sqm-col-question" sort={sort} toggle={toggleSort} />
                  <Th col="type" label="Question Type" cls="sqm-col-type" sort={sort} toggle={toggleSort} />
                  <Th col="category" label="Category" cls="sqm-col-cat" sort={sort} toggle={toggleSort} />
                  <Th col="dateModified" label="Edited On" cls="sqm-col-edited" sort={sort} toggle={toggleSort} />
                  <th className="col-actions no-sort" />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table stm-table--preview sqm-table">
                <ColGroup />
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="stm-empty-row">
                      <td colSpan={6}>
                        No graded questions match your search and filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((question) => {
                      const inQuiz = locked.has(question.id);
                      const on = inQuiz || picked.includes(question.id);
                      return (
                        <tr
                          key={question.id}
                          className={`${on ? "selected" : ""}${inQuiz ? " is-locked" : ""}`}
                          onClick={() => toggle(question.id)}
                        >
                          <td className="stm-col-check">
                            {/* A <button>, not a <span> — the shared table reset
                                strips chrome from span/div in data cells, which
                                would leave a bare tick with no box. */}
                            <button
                              className={`checkbox ${on ? "checked" : ""}`}
                              aria-label={
                                inQuiz
                                  ? "Already on the Quiz"
                                  : on
                                    ? "Deselect"
                                    : "Select"
                              }
                              aria-pressed={on}
                              disabled={inQuiz}
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(question.id);
                              }}
                            >
                              {on && <CheckIcon />}
                            </button>
                          </td>
                          {/* `col-name` carries the #FFFFFF emphasis and is one
                              of the classes the app-wide "mute every non-Name
                              cell" rule excludes — a local colour would lose to
                              it on specificity. */}
                          <td className="sqm-col-question col-name" title={question.text}>
                            {question.text}
                          </td>
                          {/* The Bank's long name, so the column reads the same
                              as the filter that narrows it. */}
                          <td className="sqm-col-type">{longQuestionType(question.type)}</td>
                          <td className="sqm-col-cat" title={categoryOf(question)}>
                            {categoryOf(question)}
                          </td>
                          <td className="sqm-col-edited">{modifiedOf(question)}</td>
                          {/* Row-end affordance, the same two-layer machinery as
                              Hands-On's "Review Task ›": a resting chevron that
                              hides on hover, and a labelled bar that takes its
                              place. `stopPropagation` matters here — the row
                              itself ticks the checkbox. */}
                          <td className="col-actions">
                            <button
                              className="row-action-btn lone-dots row-chevron"
                              aria-label={`Preview ${question.text}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreview(question);
                              }}
                            >
                              <RowChevronIcon />
                            </button>
                            <div className="row-action-bar">
                              <button
                                className="row-action-btn row-action-btn--label"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreview(question);
                                }}
                              >
                                Preview
                                <RowChevronIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pagination stm-pagination">
            <span className="sqm-picked">
              {isPool
                ? `${picked.length} in Pool`
                : `${picked.length} Selected`}
            </span>
            <span>
              Showing {sorted.length === 0 ? 0 : start + 1} -{" "}
              {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
            </span>
            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={visiblePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <ChevronLeftIcon />
              </button>
              <button
                className="page-btn"
                disabled={visiblePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </div>
      </div>

      {preview && (
        <QuestionPreviewModal question={preview} onClose={() => setPreview(null)} />
      )}
    </PrmModal>
  );
}

/* Placeholder read-only look at a question, stacked over the picker. It draws
   what the Bank already holds — the prompt, where it lives, and whatever answer
   data its type carries — rather than the learner-facing player, which doesn't
   exist yet. */
function QuestionPreviewModal({
  question,
  onClose,
}: {
  question: Question;
  onClose: () => void;
}) {
  return (
    <PrmModal
      title="Question Preview"
      description={`${question.type} · ${categoryOf(question)}`}
      confirmLabel="Close"
      hideCancel
      onCancel={onClose}
      onConfirm={onClose}
    >
      <div className="qpv">
        <p className="qpv-text">{question.text}</p>
        {question.options && question.options.length > 0 && (
          <ul className="qpv-list">
            {question.options.map((o, i) => (
              <li key={i} className={`qpv-opt${o.grade > 0 ? " is-correct" : ""}`}>
                <span className="qpv-opt-mark">{o.grade > 0 ? <CheckIcon /> : null}</span>
                <span>{o.text}</span>
              </li>
            ))}
          </ul>
        )}
        {question.type === "True/False" && (
          <ul className="qpv-list">
            {[true, false].map((v) => (
              <li
                key={String(v)}
                className={`qpv-opt${question.tfAnswer === v ? " is-correct" : ""}`}
              >
                <span className="qpv-opt-mark">
                  {question.tfAnswer === v ? <CheckIcon /> : null}
                </span>
                <span>{v ? "True" : "False"}</span>
              </li>
            ))}
          </ul>
        )}
        {question.pairs && question.pairs.length > 0 && (
          <ul className="qpv-list">
            {question.pairs.map((p, i) => (
              <li key={i} className="qpv-pair">
                <span className="qpv-pair-left">{p.left || "—"}</span>
                <span className="qpv-pair-right">{p.right}</span>
              </li>
            ))}
          </ul>
        )}
        {question.scale && (
          <p className="qpv-note">
            Scale {question.scale.min}–{question.scale.max}
            {question.scale.minLabel || question.scale.maxLabel
              ? ` (${question.scale.minLabel ?? ""} … ${question.scale.maxLabel ?? ""})`
              : ""}
          </p>
        )}
        {question.fileRules && (
          <p className="qpv-note">
            Up to {question.fileRules.maxFiles} file
            {question.fileRules.maxFiles === 1 ? "" : "s"}, {question.fileRules.maxSizeMb} MB each
          </p>
        )}
        {question.type === "Short answer" && (
          <p className="qpv-note">Free-text answer — graded by a reviewer.</p>
        )}
      </div>
    </PrmModal>
  );
}

function ColGroup() {
  return (
    <colgroup>
      <col style={{ width: 44 }} />
      <col />
      <col style={{ width: 150 }} />
      <col style={{ width: 190 }} />
      <col style={{ width: 126 }} />
      {/* Wide enough to seat the whole "Preview ›" bar. The shared 40px
          `col-actions` lets the bar float over the previous column, which here
          is a date it would cut in half. */}
      <col style={{ width: 104 }} />
    </colgroup>
  );
}

function Th({
  col,
  label,
  cls,
  sort,
  toggle,
}: {
  col: SortKey;
  label: string;
  cls: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
}) {
  const active = sort.key === col;
  return (
    <th className={cls} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
