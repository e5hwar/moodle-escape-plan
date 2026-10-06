import { useEffect, useMemo, useState } from "react";
import {
  questions as QUESTION_BANK,
  categories as QB_CATEGORIES,
  flattenCategories,
  longQuestionType,
  matchesUsage,
  NO_FORM,
  NO_FORM_HINT,
  NO_QUIZ,
  NO_QUIZ_HINT,
  questionDates,
  supportsGrading,
  QUESTION_TYPE_MENU,
  QUESTION_TYPE_OPTIONS,
  type Question,
} from "../data/questionBank";
import { PrmModal } from "./PrmModal";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
import {
  CheckIcon,
  CheckboxDashIcon,
  RowChevronIcon,
  SortIcon,
  PagePrevIcon,
  PageNextIcon,
} from "./icons";
import { QuestionSearch } from "./QuestionSearch";
import { QuestionAnswers } from "./QuestionAnswers";

/* Select Questions — the Quiz wizard's Question Bank twin of SelectTasksModal
 * (Figma 682:2321): search bar, filter pills, a sortable table and
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

/* The Question Bank's own Grading options and test (QuestionBankPage's
   `isGraded`): grading on AND a type that can be graded. */
const GRADING_OPTIONS = ["Graded", "Ungraded"];
function isGraded(q: Question) {
  return q.gradingEnabled && supportsGrading(q.type);
}

type SortKey = "question" | "type" | "category" | "dateModified";
type SortDir = "asc" | "desc";

/** Only Active, graded Bank questions are eligible for Quizzes — both as
 *  hand-picked statics and as random-pool members. Feedback Forms drop the
 *  grading half of the test (their Grading pill narrows instead). */
function eligible(q: Question, gradedOnly: boolean) {
  return q.status === "Active" && (!gradedOnly || isGraded(q));
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
  /** Static mode only: questions already on the Quiz — shown as locked rows. */
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
  /* The filter row differs by who opened the picker (the Question Bank's own
     pills and names): a Quiz takes graded questions only — automatically, so
     there is no Grading pill — and filters by Quizzes; a Feedback Form gets a
     Grading pill that starts on Ungraded (what forms are made of) and filters
     by Feedback Forms. */
  const [grading, setGrading] = useState<string[]>(gradedOnly ? [] : ["Ungraded"]);
  const [usage, setUsage] = useState<string[]>([]);
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
      /* An open search-suggestion panel takes the first Escape (the page
         search closes it itself); only the next one closes the modal. */
      if (document.querySelector(".usearch-panel")) return;
      if (preview) setPreview(null);
      else onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, preview]);

  const pool = useMemo(() => QUESTION_BANK.filter((q) => eligible(q, gradedOnly)), [gradedOnly]);

  /* Quizzes (Quiz picker) or Feedback Forms (form picker) — named on at least
     one eligible question, "None" first, exactly as the Bank's menu lists them. */
  const usageOf = (q: Question) => (gradedOnly ? q.quizzes : q.forms);
  const NONE = gradedOnly ? NO_QUIZ : NO_FORM;
  const usageNames = useMemo(
    () => [...new Set(pool.flatMap(usageOf))].sort((a, b) => a.localeCompare(b)),
    // usageOf only varies with gradedOnly, which `pool` already follows.
    [pool],
  );

  // Category options limited to branches that actually hold graded questions.
  const allCats = useMemo(
    () =>
      flattenCategories(QB_CATEGORIES)
        .map((opt) => opt.label)
        .filter((label) => pool.some((q) => matchesCategoryLabel(q, label))),
    [pool],
  );

  /* The Question Bank's Category pill (All Questions): one titled section per
     category, its Sub-Categories as rows showing just the leaf, ALL / NONE in
     the title. A category with no Sub-Categories has nothing to section, so
     those sit as their own rows in one untitled section first — the Bank
     leaves them out, but here they're the only way to pick their questions
     (a category with subs never holds a question directly). Values stay full
     paths, so the search still finds a parent's subs. */
  const catSections = useMemo((): { label?: string; items: string[] }[] => {
    const has = (label: string) => pool.some((q) => matchesCategoryLabel(q, label));
    const bare: string[] = [];
    const titled: { label: string; items: string[] }[] = [];
    for (const c of QB_CATEGORIES) {
      if (!c.subcategories?.length) {
        if (has(c.label)) bare.push(c.label);
        continue;
      }
      const items = c.subcategories
        .map((sc) => `${c.label} > ${sc.label}`)
        .filter(has);
      if (items.length) titled.push({ label: c.label, items });
    }
    return bare.length ? [{ items: bare }, ...titled] : titled;
  }, [pool]);
  const catOptions = useMemo(() => catSections.flatMap((sec) => sec.items), [catSections]);
  const catLabels = useMemo(
    () => Object.fromEntries(catOptions.map((c) => [c, c.split(" > ").pop() ?? c])),
    [catOptions],
  );
  /* The search's Category: token can hand over a bare category that has subs;
     the pill only lists its subs, so it becomes them (as the Bank does). */
  const setCatsFromSearch = (next: string[]) => {
    const subsOf = new Map(catSections.filter((sec) => sec.label).map((sec) => [sec.label!, sec.items]));
    resetPage(setCats)([...new Set(next.flatMap((c) => subsOf.get(c) ?? [c]))]);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter((question) => {
      // The Bank's own rule: question text or ID (categories are a filter).
      if (q && !(question.text.toLowerCase().includes(q) || question.id.toLowerCase().includes(q)))
        return false;
      if (types.length && !types.includes(longQuestionType(question.type)))
        return false;
      if (cats.length && !cats.some((c) => matchesCategoryLabel(question, c)))
        return false;
      if (grading.length && !grading.includes(isGraded(question) ? "Graded" : "Ungraded"))
        return false;
      if (usage.length && !matchesUsage(usageOf(question), usage, NONE)) return false;
      return true;
    });
  }, [pool, query, types, cats, grading, usage, gradedOnly]);

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
      pickFull
      onCancel={onCancel}
      onConfirm={() => onConfirm(picked)}
    >
      <div className="stm">
        <div className="stm-toolbar">
          {/* The Question Bank page's own search bar: Enter applies the query
              (text or ID, the Bank's rule), and a picked Category / Type /
              Quizzes / Feedback Form suggestion lands on the matching pill.
              Only the usage filter this picker has is offered. */}
          <div className="toolbar">
            <QuestionSearch
              questions={pool}
              categoryOptions={allCats}
              selection={cats}
              onSelectionChange={setCatsFromSearch}
              types={types}
              onTypesChange={resetPage(setTypes)}
              typeOptions={typeOptions}
              {...(gradedOnly
                ? { quizzes: usage, onQuizzesChange: resetPage(setUsage) }
                : { forms: usage, onFormsChange: resetPage(setUsage) })}
              query={query}
              onCommit={(v) => {
                setQuery(v);
                setPage(1);
              }}
            />
          </div>

          <div className="filters stm-filters">
            {/* Category leads in both pickers (the user's order). */}
            <FilterPill
              label="Category"
              tip={FILTER_TIPS.questionPicker.category}
              options={catOptions}
              sections={catSections}
              value={cats}
              onApply={resetPage(setCats)}
              /* The Bank's 300px: leaf names only, no "· parent" clause. */
              width={300}
              searchPlaceholder="Search Categories..."
              labels={catLabels}
            />
            <FilterPill
              label="Question Type"
              tip={FILTER_TIPS.questionPicker.type}
              options={typeOptions}
              value={types}
              onApply={resetPage(setTypes)}
            />
            {!gradedOnly && (
              <FilterPill
                label="Grading"
                tip={FILTER_TIPS.questionPicker.grading}
                options={GRADING_OPTIONS}
                value={grading}
                onApply={resetPage(setGrading)}
              />
            )}
            <FilterPill
              label={gradedOnly ? "Quizzes" : "Feedback Forms"}
              tip={gradedOnly ? FILTER_TIPS.questionPicker.quizzes : FILTER_TIPS.questionPicker.forms}
              options={[NONE, ...usageNames]}
              value={usage}
              onApply={resetPage(setUsage)}
              width={384}
              searchPlaceholder={gradedOnly ? "Search Quizzes..." : "Search Feedback Forms..."}
              hints={{ [NONE]: gradedOnly ? NO_QUIZ_HINT : NO_FORM_HINT }}
            />
          </div>
        </div>

        <div className="stm-table-wrap">
          {/* Column-width floor, per the shared table convention — below it the
              table scrolls sideways instead of crushing the cells. */}
          <div
            className="table-xscroll"
            style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}
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
                      {allOn ? <CheckIcon /> : someOn ? <CheckboxDashIcon /> : null}
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
                  {rows.map((question) => {
                    const inQuiz = locked.has(question.id);
                    const on = picked.includes(question.id);
                    return (
                      <tr
                        key={question.id}
                        className={inQuiz ? "task-dim is-locked" : on ? "selected" : ""}
                        onClick={() => toggle(question.id)}
                      >
                        {/* A locked row (Figma 682:2593) has no checkbox at
                            all. */}
                        <td className="stm-col-check">
                          {!inQuiz && (
                            /* A <button>, not a <span> — the shared table reset
                               strips chrome from span/div in data cells, which
                               would leave a bare tick with no box. */
                            <button
                              className={`checkbox ${on ? "checked" : ""}`}
                              aria-label={on ? "Deselect" : "Select"}
                              aria-pressed={on}
                              tabIndex={-1}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(question.id);
                              }}
                            >
                              {on && <CheckIcon />}
                            </button>
                          )}
                        </td>
                        {/* `col-name` carries the #FFFFFF emphasis and is one
                            of the classes the app-wide "mute every non-Name
                            cell" rule excludes — a local colour would lose to
                            it on specificity. */}
                        <td className="sqm-col-question col-name" title={question.text}>
                          {inQuiz ? <span className="tsk-name">{question.text}</span> : question.text}
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
                  })}
                </tbody>
              </table>
            </div>
            {rows.length === 0 && <TableEmpty />}
          </div>

          <div className="pagination stm-pagination">
            <span className="stm-picked">{picked.length} Selected</span>
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
                <PagePrevIcon />
              </button>
              <button
                className="page-btn"
                disabled={visiblePage === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                <PageNextIcon />
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
      <QuestionAnswers question={question} />
    </PrmModal>
  );
}

/* The shared width rule (`TableCols`): content-sized base widths — question,
   type, category, edited — slack shared in proportion; the check gutter and
   the Preview gutter fixed. The Preview gutter is wide enough to seat the
   whole "Preview ›" bar: the shared 40px `col-actions` lets the bar float over
   the previous column, which here is a date it would cut in half. */
const CHECK_W = 44;
const PREVIEW_W = 104;
const COL_WIDTHS = [400, 150, 190, 126];
const TABLE_MIN = CHECK_W + COL_WIDTHS.reduce((n, w) => n + w, 0) + PREVIEW_W;

function ColGroup() {
  return <TableCols lead={[CHECK_W]} data={COL_WIDTHS} trail={[PREVIEW_W]} />;
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

/* One filter pill: the shared Dropdown + PillTrigger + checklist/Apply body,
   the same build as the Question Bank's own pills. An empty value is the
   dashed, unapplied pill. */
function FilterPill({
  label,
  tip,
  options,
  value,
  onApply,
  width,
  searchPlaceholder,
  labels,
  hints,
  sections,
}: {
  label: string;
  tip: string;
  options: string[];
  /** Titled groups instead of one flat list (Category: one per category). */
  sections?: { label?: string; items: string[] }[];
  value: string[];
  onApply: (v: string[]) => void;
  /** Defaults to 220 — the hint-carrying lists pass 384. */
  width?: number;
  /** A search box for the long lists. */
  searchPlaceholder?: string;
  labels?: Record<string, string>;
  hints?: Record<string, string>;
}) {
  return (
    <Dropdown
      width={width ?? 220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={label}
          tip={tip}
          value={value.length === 1 ? labels?.[value[0]] ?? value[0] : summarize(value, options)}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={sections ?? [{ items: options }]}
          value={value}
          searchable={!!searchPlaceholder}
          searchPlaceholder={searchPlaceholder}
          labels={labels}
          hints={hints}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}
