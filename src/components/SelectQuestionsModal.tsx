import { useEffect, useMemo, useState } from "react";
import {
  questions as QUESTION_BANK,
  categories as QB_CATEGORIES,
  flattenCategories,
  questionDates,
  type Question,
} from "../data/questionBank";
import { PrmModal } from "./PrmModal";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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

/** Menu order for the Question Type pill — the Bank's graded types. */
const GRADED_TYPES = [
  "Multiple choice",
  "Multiple select",
  "True/False",
  "Match the following",
];

/** Feedback Forms take any Active question, graded or not — grading data on a
 *  linked question is simply ignored, so the ungraded types come along. */
const ALL_TYPES = [
  ...GRADED_TYPES,
  "Short answer",
  "File upload",
  "Linear scale",
];

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
      return a.type.localeCompare(b.type);
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
  // Default sort is by last edited — newest first.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "dateModified",
    dir: "desc",
  });

  const isPool = mode === "pool";
  const typeOptions = gradedOnly ? GRADED_TYPES : ALL_TYPES;
  const locked = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const pool = useMemo(() => QUESTION_BANK.filter((q) => eligible(q, gradedOnly)), [gradedOnly]);

  // Category options limited to branches that actually hold graded questions.
  const allCats = useMemo(
    () =>
      flattenCategories(QB_CATEGORIES)
        .map((opt) => opt.label)
        .filter((label) => pool.some((q) => matchesCategoryLabel(q, label))),
    [pool],
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
      if (types.length && !types.includes(question.type)) return false;
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
      confirmLabel="Continue"
      confirmDisabled={picked.length === 0}
      pick
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
              placeholder="Search Questions"
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
              width={280}
              trigger={({ open, toggle: t }) => (
                <PillTrigger
                  label="Category"
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
              260 question + 150 type + 190 category + 126 edited. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": "770px" } as React.CSSProperties}
          >
            <table className="table table-head stm-table sqm-table">
              <ColGroup />
              <thead>
                <tr>
                  {/* Spacer only — the node's header carries a Radial Button
                      with a transparent border to hold the column, not a
                      select-all control. */}
                  <th className="stm-col-check no-sort" />
                  <Th col="question" label="Question" cls="sqm-col-question" sort={sort} toggle={toggleSort} />
                  <Th col="type" label="Question Type" cls="sqm-col-type" sort={sort} toggle={toggleSort} />
                  <Th col="category" label="Category" cls="sqm-col-cat" sort={sort} toggle={toggleSort} />
                  <Th col="dateModified" label="Edited On" cls="sqm-col-edited" sort={sort} toggle={toggleSort} />
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body stm-table sqm-table">
                <ColGroup />
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="stm-empty-row">
                      <td colSpan={5}>
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
                          <td className="sqm-col-type">{question.type}</td>
                          <td className="sqm-col-cat" title={categoryOf(question)}>
                            {categoryOf(question)}
                          </td>
                          <td className="sqm-col-edited">{modifiedOf(question)}</td>
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
                ? `${picked.length} in pool`
                : `${picked.length} selected`}
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
