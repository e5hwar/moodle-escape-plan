import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  categories as seedCategories,
  questions as allQuestions,
  flattenCategories,
  longQuestionType,
  questionDates,
  shortQuestionType,
  QUESTION_TYPE_OPTIONS,
  supportsGrading,
  versionHistory,
  type Category,
  type Question,
  type QuestionStatus,
  type QuestionVersion,
  type Subcategory,
} from "../data/questionBank";
import { ArrowRightUpIcon, ChevronLeftIcon, InfoFilledIcon, MenuArchiveIcon, MenuHistoryIcon, MenuPreviewIcon, RowEditIcon, RowKebabIcon, SearchIcon, SortIcon, TreeCaretIcon, TreeKebabIcon, UploadTrayIcon, RowDeleteIcon, ChevronRightIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { CascadingMultiSelect, EditColumnsButton, PillTrigger, SectionedMultiSelect, summarize, useColumnOrder, orderedColumns } from "./Filters";
import { PageBreak } from "./PageBreak";
import { QuestionSearch } from "./QuestionSearch";
import { QuestionPreviewPanel } from "./QuestionPreviewPanel";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

const PAGE_SIZE = 50;

/* The seed set is a sample of a much larger bank, so the rail's "All Questions"
   total is the mock figure the category counts add up to — not `questions.length`. */
const TOTAL_QUESTIONS = "1,089";

/* Every filter is a multi-select, matching the Tasks row: empty = unapplied,
   values inside one filter OR together, filters AND together. */
const TYPE_OPTIONS = QUESTION_TYPE_OPTIONS;
const STATUS_OPTIONS: QuestionStatus[] = ["Active", "Archived", "Draft"];
const GRADING_OPTIONS = ["Graded", "Ungraded"];

/* Toggleable table columns (Question is fixed). */
type QbColumn =
  | "id"
  | "type"
  | "version"
  | "status"
  | "category"
  | "grading"
  | "quizzes"
  | "forms"
  | "createdOn"
  | "lastModified";

type QbColumnState = Record<QbColumn, boolean>;

const QB_FIXED_COLUMNS = [{ label: "Question" }];

// Roomy, because the question text is allowed to run to a second line.
const QUESTION_COL_WIDTH = 420;
const ACTIONS_COL_WIDTH = 40;

function isGraded(q: Question): boolean {
  return q.gradingEnabled && supportsGrading(q.type);
}

type QSortKey =
  | "question"
  | "id"
  | "type"
  | "version"
  | "status"
  | "category"
  | "usage";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<QuestionStatus, number> = {
  Active: 0,
  Draft: 1,
  Archived: 2,
};

function compareQuestions(a: Question, b: Question, key: QSortKey): number {
  switch (key) {
    case "question":
      return a.text.localeCompare(b.text);
    case "id":
      return a.id.localeCompare(b.id);
    case "category":
      return a.categoryPath.join(" > ").localeCompare(b.categoryPath.join(" > "));
    case "type":
      return shortQuestionType(a.type).localeCompare(shortQuestionType(b.type));
    case "version":
      return a.version - b.version;
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case "usage":
      return (
        a.quizzes.length + a.forms.length - (b.quizzes.length + b.forms.length)
      );
  }
}

// 3-dot menu target — a category or a subcategory row.
type CatTarget =
  | { kind: "category"; categoryKey: string }
  | { kind: "subcategory"; categoryKey: string; subKey: string };

type CatMenuState = { target: CatTarget; x: number; y: number } | null;

type CatModalState =
  | { kind: "none" }
  | { kind: "new-category" }
  | { kind: "new-sub"; categoryKey: string }
  | { kind: "edit-category"; categoryKey: string }
  | { kind: "edit-sub"; categoryKey: string; subKey: string }
  | { kind: "delete"; target: CatTarget };

/* ─────────── Column registry ───────────
   One entry per optional column — replaced the parallel label/width lists and
   the hardcoded th/td runs. The table walks
   `orderedColumns(...)`, so dragging a row in Edit Columns moves the column. */
type QbColMeta = {
  key: QbColumn;
  label: string;
  className: string;
  width: number;
  sortable?: boolean;
  render: (q: Question, dates: { created: string; modified: string }) => React.ReactNode;
};

const QB_COLS: QbColMeta[] = [
  { key: "id", label: "ID", className: "qb-col-id", width: 100, render: (q) => q.id },
  {
    key: "type", label: "Type", className: "qb-col-type", width: 170,
    render: (q) => <span className="qb-type-tag">{longQuestionType(q.type)}</span>,
  },
  { key: "version", label: "Version", className: "qb-col-version", width: 84, render: (q) => `v${q.version}` },
  {
    key: "status", label: "Status", className: "qb-col-status", width: 108,
    render: (q) => (
      <span className={`qb-status qb-status--${q.status.toLowerCase()}`}>
        <span className="qb-status-dot" />
        {q.status}
      </span>
    ),
  },
  {
    key: "category", label: "Category", className: "qb-col-category", width: 190,
    render: (q) => (
      <span className="qb-usage-main" title={q.categoryPath.join(" > ")}>
        {q.categoryPath.join(" > ")}
      </span>
    ),
  },
  {
    key: "grading", label: "Grading", className: "qb-col-grading", width: 110, sortable: false,
    render: (q) => (isGraded(q) ? "Graded" : "Ungraded"),
  },
  {
    key: "quizzes", label: "Quizzes", className: "qb-col-quizzes", width: 190, sortable: false,
    render: (q) => <UsageNames items={q.quizzes} />,
  },
  {
    key: "forms", label: "Feedback Forms", className: "qb-col-forms", width: 190, sortable: false,
    render: (q) => <UsageNames items={q.forms} />,
  },
  { key: "createdOn", label: "Created On", className: "qb-col-date", width: 130, sortable: false, render: (_q, d) => d.created },
  { key: "lastModified", label: "Last Modified", className: "qb-col-date", width: 130, sortable: false, render: (_q, d) => d.modified },
];

export function QuestionBankPage({
  onNewQuestion,
  onEditQuestion,
  initialQuestions,
}: {
  onNewQuestion?: (categoryPath?: string[]) => void;
  onEditQuestion?: (question: Question) => void;
  initialQuestions?: Question[];
} = {}) {
  const [categories, setCategories] = useState<Category[]>(seedCategories);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions ?? allQuestions);
  const [rowMenu, setRowMenu] = useState<{ q: Question; rect: DOMRect } | null>(null);
  // Row-click preview panel + version-history modal
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [historyQ, setHistoryQ] = useState<Question | null>(null);
  // Category is a multi-select like every other filter — labels from
  // flattenCategories ("EPA 608" / "EPA 608 > Universal"). Empty = all questions.
  const [selection, setSelection] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "epa-608": true,
  });
  const [catMenu, setCatMenu] = useState<CatMenuState>(null);
  const [catModal, setCatModal] = useState<CatModalState>({ kind: "none" });

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  // Draft questions are hidden until the author asks for them.
  const [statusFilter, setStatusFilter] = useState<string[]>(["Active"]);
  const [gradingFilter, setGradingFilter] = useState<string[]>([]);
  // Quizzes/Feedback Forms are also set from the search box's Quizzes: /
  // Feedback Form: tokens.
  const [quizFilter, setQuizFilter] = useState<string[]>([]);
  const [formFilter, setFormFilter] = useState<string[]>([]);

  const [columns, setColumns] = useState<QbColumnState>({
    id: false,
    type: true,
    version: true,
    status: true,
    category: false,
    grading: false,
    quizzes: false,
    forms: false,
    createdOn: false,
    lastModified: false,
  });
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(QB_COLS);
  const visibleCols = useMemo(() => orderedColumns(QB_COLS, order, columns), [columns, order]);

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ key: QSortKey; dir: SortDir }>({
    key: "question",
    dir: "asc",
  });

  // Every category and subcategory, as "Parent" / "Parent > Sub" labels.
  const categoryLabels = useMemo(
    () => flattenCategories(categories).map((o) => o.label),
    [categories],
  );

  // Every quiz / feedback form name that appears on at least one question.
  const quizNames = useMemo(
    () => [...new Set(questions.flatMap((q) => q.quizzes))].sort((a, b) => a.localeCompare(b)),
    [questions],
  );
  const formNames = useMemo(
    () => [...new Set(questions.flatMap((q) => q.forms))].sort((a, b) => a.localeCompare(b)),
    [questions],
  );

  const appliedCount =
    typeFilter.length +
    statusFilter.length +
    gradingFilter.length +
    quizFilter.length +
    formFilter.length +
    selection.length;

  function clearFilters() {
    setSelection([]);
    setTypeFilter([]);
    setStatusFilter([]);
    setGradingFilter([]);
    setQuizFilter([]);
    setFormFilter([]);
  }

  // Natural table width so columns scroll horizontally instead of crushing on a
  // narrow page — mirrors the visible <col>s.
  const tableMin =
    QUESTION_COL_WIDTH +
    ACTIONS_COL_WIDTH +
    visibleCols.reduce((sum, c) => sum + c.width, 0);
  const visibleColCount = visibleCols.length + 2; // Question + actions

  // Filter by category selection
  const inCategory = useMemo(() => {
    if (selection.length === 0) return questions;
    return questions.filter((q) => {
      const [cat, sub] = q.categoryPath;
      return selection.some(
        (label) => label === cat || (sub != null && label === `${cat} > ${sub}`),
      );
    });
  }, [selection, questions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inCategory.filter((row) => {
      if (q && !(row.id.toLowerCase().includes(q) || row.text.toLowerCase().includes(q))) {
        return false;
      }
      if (typeFilter.length && !typeFilter.includes(longQuestionType(row.type)))
        return false;
      if (statusFilter.length && !statusFilter.includes(row.status)) return false;
      if (gradingFilter.length && !gradingFilter.includes(isGraded(row) ? "Graded" : "Ungraded"))
        return false;
      if (quizFilter.length && !row.quizzes.some((n) => quizFilter.includes(n))) return false;
      if (formFilter.length && !row.forms.some((n) => formFilter.includes(n))) return false;
      return true;
    });
  }, [inCategory, query, typeFilter, statusFilter, gradingFilter, quizFilter, formFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareQuestions(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [selection, query, typeFilter, statusFilter, gradingFilter, quizFilter, formFilter, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: QSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  // The question shown in the preview panel — read from state so archive
  // toggles and restores update the open panel live.
  const selected = selectedId
    ? questions.find((q) => q.id === selectedId) ?? null
    : null;

  // Esc closes the preview panel (unless a modal or menu is handling it).
  useEffect(() => {
    if (!selectedId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (historyQ || rowMenu || catMenu) return;
      setSelectedId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId, historyQ, rowMenu, catMenu]);

  // Restoring an old version creates a NEW version with its content.
  function restoreVersion(id: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, version: q.version + 1 } : q)),
    );
  }

  function startCreate() {
    let path: string[] | undefined;
    if (selection.length === 1) {
      path = selection[0].split(" > ");
    }
    onNewQuestion?.(path);
  }

  // "C" opens the right pane's Create Question; "A" opens the rail's Add
  // Category (both badges are shown on their buttons). Neither fires while a
  // category modal is open.
  useCreateShortcut(startCreate, catModal.kind === "none");
  useCreateShortcut(
    () => setCatModal({ kind: "new-category" }),
    catModal.kind === "none",
    "a",
  );

  // Toggle a question between Active and Archived from the row menu.
  function toggleArchive(id: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, status: q.status === "Archived" ? "Active" : "Archived" }
          : q,
      ),
    );
  }

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ─── Category mutations ───────────────────────────────────────────────────
  function addCategory(label: string) {
    // New categories append to the bottom of the list.
    setCategories((prev) => [
      ...prev,
      { key: `cat-${Date.now()}`, label, count: 0, subcategories: [] },
    ]);
  }

  function addSubcategory(categoryKey: string, label: string) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.key !== categoryKey) return c;
        const newSub: Subcategory = {
          key: `sub-${Date.now()}`,
          label,
          count: 0,
        };
        return { ...c, subcategories: [...(c.subcategories ?? []), newSub] };
      }),
    );
    // Keep the parent expanded so the new subcategory is visible.
    setOpenGroups((prev) => ({ ...prev, [categoryKey]: true }));
  }

  function renameCategory(key: string, label: string) {
    setCategories((prev) =>
      prev.map((c) => (c.key === key ? { ...c, label } : c)),
    );
  }

  function renameSubcategory(categoryKey: string, subKey: string, label: string) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.key !== categoryKey) return c;
        return {
          ...c,
          subcategories: c.subcategories?.map((s) =>
            s.key === subKey ? { ...s, label } : s,
          ),
        };
      }),
    );
  }

  function deleteCategory(key: string) {
    setCategories((prev) => prev.filter((c) => c.key !== key));
    const label = categories.find((c) => c.key === key)?.label;
    if (label) {
      setSelection((prev) =>
        prev.filter((l) => l !== label && !l.startsWith(`${label} > `)),
      );
    }
  }

  function deleteSubcategory(categoryKey: string, subKey: string) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.key !== categoryKey) return c;
        return {
          ...c,
          subcategories: c.subcategories?.filter((s) => s.key !== subKey),
        };
      }),
    );
    const cat = categories.find((c) => c.key === categoryKey);
    const sub = cat?.subcategories?.find((sc) => sc.key === subKey);
    if (cat && sub) {
      const label = `${cat.label} > ${sub.label}`;
      setSelection((prev) => prev.filter((l) => l !== label));
    }
  }

  // A category can be deleted only when it has no questions and no subcategories.
  function categoryIsEmpty(c: Category) {
    return c.count === 0 && !(c.subcategories && c.subcategories.length > 0);
  }

  function openCatMenu(e: React.MouseEvent, target: CatTarget) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCatMenu({ target, x: r.right, y: r.bottom });
  }

  // Rail totals + the search-filtered tree. A category matches on its own label
  // or on any of its subcategories', so a subcategory hit keeps its parent row.
  const totalSubcategories = useMemo(
    () => categories.reduce((n, c) => n + (c.subcategories?.length ?? 0), 0),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.subcategories ?? []).some((s) => s.label.toLowerCase().includes(q)),
    );
  }, [categories, categorySearch]);

  // CSV dropzone — purely visual + accept handler
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dropzoneActive, setDropzoneActive] = useState(false);

  // Version history opens as its own full page (replacing the list), not a modal.
  if (historyQ) {
    return (
      <QuestionHistoryPage
        question={historyQ}
        onBack={() => setHistoryQ(null)}
        onRestore={() => {
          restoreVersion(historyQ.id);
          setHistoryQ(null);
        }}
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="qb-page">
          {/* Left rail — categories. Shared design-system rail + tree chrome
              (`.rail*`/`.tree*`), the same elements the Industries page uses. */}
          <aside className="rail">
            <div className="rail-head">
              <h1 className="tasks-title">Question Bank</h1>
              <div className="rail-desc">
                Categories group the Questions used by Quizzes and Feedback Forms
                <span
                  className="rail-info"
                  tabIndex={0}
                  role="note"
                  aria-label="About the Question Bank"
                  data-tooltip={`Placeholder copy — ${categories.length} Categories and ${totalSubcategories} Subcategories organise the ${TOTAL_QUESTIONS} Questions authors pick from.`}
                >
                  <InfoFilledIcon />
                </span>
              </div>
            </div>

            <div className="rail-search">
              <span className="search-icon"><SearchIcon /></span>
              {/* Deliberately NOT `.search-input`: ⌘K belongs to the question
                  search in the right pane, and it grabs the first match in DOM
                  order. */}
              <input
                placeholder="Search Categories, Subcategories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>

            <PageBreak
              label={`${categories.length} Categories · ${totalSubcategories} Subcategories`}
            />

            <div className="tree">
              <div className={`tree-row ${selection.length === 0 ? "is-active" : ""}`}>
                {/* Caret-sized spacer keeps this label on the category column. */}
                <span className="tree-caret-btn" aria-hidden />
                <button className="tree-main" onClick={() => setSelection([])}>
                  <span className="tree-row-label">All Questions</span>
                  <span className="tree-row-count">{TOTAL_QUESTIONS}</span>
                </button>
              </div>

              {filteredCategories.map((cat) => {
                const isOpen = !!openGroups[cat.key];
                const isActiveCat = selection.includes(cat.label);
                return (
                  <div key={cat.key} className="tree-group">
                    <div className={`tree-row ${isActiveCat ? "is-active" : ""}`}>
                      {/* Every category is expandable so subcategories can be added inside it. */}
                      <button
                        className={`tree-caret-btn ${isOpen ? "is-open" : ""}`}
                        onClick={() => toggleGroup(cat.key)}
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        <TreeCaretIcon />
                      </button>
                      <button
                        className="tree-main"
                        onClick={() => setSelection([cat.label])}
                      >
                        <span className="tree-row-label">{cat.label}</span>
                        <span className="tree-row-count">{cat.count}</span>
                      </button>
                      <button
                        className="tree-menu-btn"
                        aria-label="Category options"
                        onClick={(e) => openCatMenu(e, { kind: "category", categoryKey: cat.key })}
                      >
                        <TreeKebabIcon />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="tree-sublist">
                        {!!cat.subcategories?.length && (
                          <div className="tree-sublist-rows">
                            {cat.subcategories.map((sub) => {
                              const subLabel = `${cat.label} > ${sub.label}`;
                              const isActive = selection.includes(subLabel);
                              return (
                                <div
                                  key={sub.key}
                                  className={`tree-sub-row ${isActive ? "is-active" : ""}`}
                                >
                                  <button
                                    className="tree-sub-main"
                                    onClick={() => setSelection([subLabel])}
                                  >
                                    <span className="tree-sub-row-label">{sub.label}</span>
                                    <span className="tree-sub-row-count">{sub.count}</span>
                                  </button>
                                  <button
                                    className="tree-menu-btn tree-sub-menu-btn"
                                    aria-label="Subcategory options"
                                    onClick={(e) =>
                                      openCatMenu(e, {
                                        kind: "subcategory",
                                        categoryKey: cat.key,
                                        subKey: sub.key,
                                      })
                                    }
                                  >
                                    <TreeKebabIcon />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <button
                          className="tree-add"
                          onClick={() => setCatModal({ kind: "new-sub", categoryKey: cat.key })}
                        >
                          Add Subcategory
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rail-foot">
              <button
                className="cta-primary"
                onClick={() => setCatModal({ kind: "new-category" })}
              >
                Add Category
                <span className="cta-kbd">A</span>
              </button>
              <div className="rail-hint">
                Select a Category/Subcategory to filter the Questions beside it
              </div>
            </div>
          </aside>

          {/* Right pane */}
          <section className="qb-content">
            <QuestionSearch
              questions={questions}
              categoryOptions={categoryLabels}
              selection={selection}
              onSelectionChange={setSelection}
              types={typeFilter}
              onTypesChange={setTypeFilter}
              quizzes={quizFilter}
              onQuizzesChange={setQuizFilter}
              forms={formFilter}
              onFormsChange={setFormFilter}
              query={query}
              onCommit={setQuery}
            />

            <label
              className={`drop-primary qb-bulk-upload ${dropzoneActive ? "is-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropzoneActive(true);
              }}
              onDragLeave={() => setDropzoneActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDropzoneActive(false);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                hidden
                onChange={() => {/* noop in mock */}}
              />
              <span className="drop-primary-icon"><UploadTrayIcon /></span>
              <span className="drop-primary-text">
                <span className="drop-primary-title">Bulk Upload Questions</span>
                <span className="drop-primary-sub">
                  Drag and drop, or click to upload.{" "}
                  {/* preventDefault also stops the label from opening the file picker. */}
                  <a
                    className="drop-primary-link"
                    onClick={(e) => e.preventDefault()}
                    href="#"
                  >
                    Download Template
                    <ArrowRightUpIcon />
                  </a>
                </span>
              </span>
            </label>

            <div className="qb-filters-row">
              <div className="qb-filters">
                <MultiSelectPill
                  label="Category"
                  options={categoryLabels}
                  value={selection}
                  onApply={setSelection}
                  searchPlaceholder="Search categories…"
                />
                <MultiSelectPill
                  label="Type"
                  options={TYPE_OPTIONS}
                  value={typeFilter}
                  onApply={setTypeFilter}
                />
                <MultiSelectPill
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onApply={setStatusFilter}
                />
                <MultiSelectPill
                  label="Grading"
                  options={GRADING_OPTIONS}
                  value={gradingFilter}
                  onApply={setGradingFilter}
                />
                <QbMoreFiltersPill
                  quizzes={quizFilter}
                  forms={formFilter}
                  quizNames={quizNames}
                  formNames={formNames}
                  onApply={(v) => {
                    setQuizFilter(v.quizzes);
                    setFormFilter(v.forms);
                  }}
                />
                {appliedCount > 0 && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>
              <button className="cta-primary" onClick={startCreate}>
                Create Question
                <span className="cta-kbd">C</span>
              </button>
            </div>

            <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
            <table className="table table-head qb-q-table">
              <QbColGroup cols={visibleCols} />
              <thead>
                <tr>
                  <QbHeader col="question" label="Question" sort={sort} toggle={toggleSort} />
                  {visibleCols.map((c) =>
                    c.sortable === false ? (
                      <th key={c.key} className={`${c.className} no-sort`}>
                        <span className="th-content">{c.label}</span>
                      </th>
                    ) : (
                      <QbHeader
                        key={c.key}
                        col={c.key as QSortKey}
                        label={c.label}
                        sort={sort}
                        toggle={toggleSort}
                      />
                    ),
                  )}
                  <th className="col-actions">
                    <EditColumnsButton
                      columns={columns}
                      setColumns={setColumns}
                      optional={QB_COLS}
                      fixed={QB_FIXED_COLUMNS}
                      order={order}
                      onOrderChange={setOrder}
                    />
                  </th>
                </tr>
              </thead>
            </table>

            <div className="tasks-scroll">
              <table className="table table-body qb-q-table">
                <QbColGroup cols={visibleCols} />
                <tbody>
                  {paged.map((q) => (
                    <QuestionRow
                      key={q.id}
                      q={q}
                      cols={visibleCols}
                      selected={q.id === selectedId}
                      onSelect={() =>
                        setSelectedId((cur) => (cur === q.id ? null : q.id))
                      }
                      onEdit={() => onEditQuestion?.(q)}
                      onOpenMenu={(rect) => setRowMenu({ q, rect })}
                      menuOpen={rowMenu?.q.id === q.id}
                    />
                  ))}
                  {paged.length === 0 && (
                    <tr className="qb-empty-row">
                      <td colSpan={visibleColCount}>
                        <div className="qb-empty">No questions match the current filters.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>

            <div className="pagination qb-pagination">
              <span>
                Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <div className="pagination-controls">
                <button
                  className="page-btn"
                  disabled={visiblePage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                ><ChevronLeftIcon /></button>
                <button
                  className="page-btn"
                  disabled={visiblePage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                ><ChevronRightIcon /></button>
              </div>
            </div>
          </section>

          {/* ─── Row-click preview panel ─── */}
          {selected && (
            <QuestionPreviewPanel
              q={selected}
              onClose={() => setSelectedId(null)}
              onEdit={() => onEditQuestion?.(selected)}
              onHistory={() => setHistoryQ(selected)}
              onToggleArchive={() => toggleArchive(selected.id)}
            />
          )}
        </div>
      </div>

      {/* ─── Question row actions menu (Tasks-style) ─── */}
      {rowMenu && (
        <QuestionActionsMenu
          q={rowMenu.q}
          rect={rowMenu.rect}
          onClose={() => setRowMenu(null)}
          onEdit={() => onEditQuestion?.(rowMenu.q)}
          onArchive={() => toggleArchive(rowMenu.q.id)}
          onPreview={() => setSelectedId(rowMenu.q.id)}
          onVersionHistory={() => setHistoryQ(rowMenu.q)}
        />
      )}

      {/* ─── Category 3-dot menu ─── */}
      {catMenu && (() => {
        const target = catMenu.target;
        const cat = categories.find((c) => c.key === target.categoryKey);
        if (!cat) return null;
        const canDelete =
          target.kind === "category"
            ? categoryIsEmpty(cat)
            : (cat.subcategories?.find((s) => s.key === target.subKey)?.count ?? 0) === 0;
        return (
          <>
            <div className="ind-menu-backdrop" onClick={() => setCatMenu(null)} />
            <div
              className="u-menu ind-row-menu"
              style={{ top: catMenu.y + 6, left: catMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="u-menu-item"
                onClick={() => {
                  setCatModal(
                    target.kind === "category"
                      ? { kind: "edit-category", categoryKey: target.categoryKey }
                      : {
                          kind: "edit-sub",
                          categoryKey: target.categoryKey,
                          subKey: target.subKey,
                        },
                  );
                  setCatMenu(null);
                }}
              >
                <span className="u-menu-item-icon"><RowEditIcon /></span> Edit
              </button>
              <button
                className="u-menu-item u-menu-item--danger"
                disabled={!canDelete}
                title={canDelete ? undefined : "Only empty categories can be deleted"}
                onClick={() => {
                  if (!canDelete) return;
                  setCatModal({ kind: "delete", target });
                  setCatMenu(null);
                }}
              >
                <span className="u-menu-item-icon"><RowDeleteIcon /></span> Delete
              </button>
            </div>
          </>
        );
      })()}

      {/* ─── Category add / edit / delete modals ─── */}
      {catModal.kind === "new-category" && (
        <CatNameModal
          title="New Category"
          submitLabel="Create Category"
          defaultValue=""
          existingNames={categories.map((c) => c.label.toLowerCase())}
          onSubmit={(label) => {
            addCategory(label);
            setCatModal({ kind: "none" });
          }}
          onCancel={() => setCatModal({ kind: "none" })}
        />
      )}

      {catModal.kind === "new-sub" && (() => {
        const parent = categories.find((c) => c.key === catModal.categoryKey);
        if (!parent) return null;
        return (
          <CatNameModal
            title={`New Subcategory in ${parent.label}`}
            submitLabel="Create Subcategory"
            defaultValue=""
            existingNames={(parent.subcategories ?? []).map((s) => s.label.toLowerCase())}
            onSubmit={(label) => {
              addSubcategory(catModal.categoryKey, label);
              setCatModal({ kind: "none" });
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}

      {catModal.kind === "edit-category" && (() => {
        const cat = categories.find((c) => c.key === catModal.categoryKey);
        if (!cat) return null;
        return (
          <CatNameModal
            title="Rename Category"
            submitLabel="Save"
            defaultValue={cat.label}
            existingNames={categories
              .filter((c) => c.key !== catModal.categoryKey)
              .map((c) => c.label.toLowerCase())}
            onSubmit={(label) => {
              renameCategory(catModal.categoryKey, label);
              setCatModal({ kind: "none" });
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}

      {catModal.kind === "edit-sub" && (() => {
        const parent = categories.find((c) => c.key === catModal.categoryKey);
        const sub = parent?.subcategories?.find((s) => s.key === catModal.subKey);
        if (!parent || !sub) return null;
        return (
          <CatNameModal
            title={`Rename Subcategory in ${parent.label}`}
            submitLabel="Save"
            defaultValue={sub.label}
            existingNames={(parent.subcategories ?? [])
              .filter((s) => s.key !== catModal.subKey)
              .map((s) => s.label.toLowerCase())}
            onSubmit={(label) => {
              renameSubcategory(catModal.categoryKey, catModal.subKey, label);
              setCatModal({ kind: "none" });
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}

      {catModal.kind === "delete" && (() => {
        const target = catModal.target;
        const cat = categories.find((c) => c.key === target.categoryKey);
        if (!cat) return null;
        const label =
          target.kind === "category"
            ? cat.label
            : `${cat.label} / ${cat.subcategories?.find((s) => s.key === target.subKey)?.label ?? "—"}`;
        return (
          <CatDeleteConfirm
            label={label}
            isCategory={target.kind === "category"}
            onConfirm={() => {
              if (target.kind === "category") {
                deleteCategory(target.categoryKey);
              } else {
                deleteSubcategory(target.categoryKey, target.subKey);
              }
              setCatModal({ kind: "none" });
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}
    </div>
  );
}

function CatNameModal({
  title,
  submitLabel,
  defaultValue,
  existingNames,
  onSubmit,
  onCancel,
}: {
  title: string;
  submitLabel: string;
  defaultValue: string;
  existingNames: string[];
  onSubmit: (label: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const trimmed = value.trim();
  const isDuplicate = !!trimmed && existingNames.includes(trimmed.toLowerCase());
  const isValid = !!trimmed && !isDuplicate;

  return (
    <div className="pm-overlay" onClick={onCancel}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <h3 className="pm-title">{title}</h3>
          <p className="pm-sub">Must be unique.</p>
        </div>
        <div className="pm-body">
          <div className="form-group">
            <label className="form-label">
              Name <span className="req">*</span>
            </label>
            <input
              autoFocus
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid) onSubmit(trimmed);
              }}
              placeholder="EPA 608"
            />
            {isDuplicate && (
              <div className="pm-error">A category with this name already exists.</div>
            )}
          </div>
        </div>
        <div className="pm-foot">
          <button className="btn-save-draft" onClick={onCancel}>Cancel</button>
          <button
            className="btn-publish"
            disabled={!isValid}
            onClick={() => isValid && onSubmit(trimmed)}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CatDeleteConfirm({
  label,
  isCategory,
  onConfirm,
  onCancel,
}: {
  label: string;
  isCategory: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="pm-overlay" onClick={onCancel}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <h3 className="pm-title">
            Delete {isCategory ? "Category" : "Subcategory"}?
          </h3>
          <p className="pm-sub">
            Delete <strong>{label}</strong>? This can't be undone.
          </p>
        </div>
        <div className="pm-body">
          <ul className="ind-modal-list">
            <li>
              This {isCategory ? "category" : "subcategory"} is empty — no questions
              {isCategory ? " or subcategories" : ""} will be affected.
            </li>
          </ul>
        </div>
        <div className="pm-foot">
          <button className="btn-save-draft" onClick={onCancel}>Cancel</button>
          <button className="btn-publish btn-publish--danger" onClick={onConfirm}>
            Delete {isCategory ? "Category" : "Subcategory"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QbColGroup({ cols }: { cols: QbColMeta[] }) {
  return (
    <colgroup>
      <col style={{ width: QUESTION_COL_WIDTH }} />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: ACTIONS_COL_WIDTH }} />
    </colgroup>
  );
}

function QbHeader({
  col,
  label,
  sort,
  toggle,
  sortable = true,
}: {
  col: QSortKey;
  label: string;
  sort: { key: QSortKey; dir: SortDir };
  toggle: (k: QSortKey) => void;
  sortable?: boolean;
}) {
  if (!sortable) {
    return (
      <th className={`qb-col-${col} no-sort`}>
        <span className="th-content">{label}</span>
      </th>
    );
  }
  const active = sort.key === col;
  return (
    <th className={`qb-col-${col}`} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}

/* Version history for a question — a full page (not a modal) with a table of
   every version. Restoring an old version creates a NEW version with its
   content; versions with no pinned attempts can be deleted. */
function QuestionHistoryPage({
  question,
  onBack,
  onRestore,
}: {
  question: Question;
  onBack: () => void;
  onRestore: (fromVersion: number) => void;
}) {
  const [versions, setVersions] = useState<QuestionVersion[]>(() =>
    versionHistory(question),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onBack();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks qh-page">
          <header className="qh-page-header">
            <button className="fb-back-btn" onClick={onBack}>
              <ChevronLeftIcon />
              <span>Question Bank</span>
            </button>
            <div className="qh-page-titleblock">
              <div className="fb-row-id">
                {question.id} · {shortQuestionType(question.type)} · v
                {question.version}
              </div>
              <h1 className="tasks-title">Version history</h1>
              <div className="qh-page-sub">{question.text}</div>
            </div>
          </header>

          <div className="qh-page-body">
            {versions.length === 0 ? (
              <div className="qh-empty">
                No versions yet — this question hasn't been saved.
              </div>
            ) : (
              <table className="qh-table">
                <colgroup>
                  <col style={{ width: 128 }} />
                  <col />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 280 }} />
                  <col style={{ width: 170 }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Change</th>
                    <th>Date</th>
                    <th>Author</th>
                    <th>Usage</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => {
                    const isCurrent = v.version === question.version;
                    const deletable = !isCurrent && v.attempts === 0;
                    return (
                      <tr
                        key={v.version}
                        className={`qh-trow ${isCurrent ? "is-current" : ""}`}
                      >
                        <td className="qh-td-version">
                          <span className="qh-vtag">v{v.version}</span>
                          {isCurrent && (
                            <span className="qh-current-pill">Current</span>
                          )}
                        </td>
                        <td className="qh-td-note">{v.note}</td>
                        <td className="qh-td-date">{v.date}</td>
                        <td className="qh-td-author">{v.author}</td>
                        <td className="qh-td-usage">
                          <span
                            className={`qh-usage ${
                              v.attempts === 0 ? "is-unused" : ""
                            }`}
                          >
                            {v.attempts === 0
                              ? isCurrent
                                ? "No attempts yet"
                                : "Never answered — can be deleted"
                              : `Pinned to ${v.attempts.toLocaleString()} past attempt${
                                  v.attempts === 1 ? "" : "s"
                                }/response${v.attempts === 1 ? "" : "s"}`}
                          </span>
                        </td>
                        <td className="qh-td-actions">
                          {!isCurrent && (
                            <button
                              className="qh-action-btn"
                              title={`Create a new version with v${v.version}'s content`}
                              onClick={() => onRestore(v.version)}
                            >
                              Restore
                            </button>
                          )}
                          {deletable && (
                            <button
                              className="qh-action-btn qh-action-btn--danger"
                              onClick={() =>
                                setVersions((prev) =>
                                  prev.filter((x) => x.version !== v.version),
                                )
                              }
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="qh-foot-note">
              Past quiz attempts and form responses permanently reference the
              version they answered. Versions that were never answered can be
              deleted; used versions are retained.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// One "Used in" cell — lists the quiz or form names the question is used in,
// truncated to the first name with a "+N more" tail (full list in the tooltip).
function UsageNames({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="qb-usage-empty">—</span>;
  }
  const [first, ...rest] = items;
  return (
    <span className="qb-usage-main" title={items.join(", ")}>
      {first}
      {rest.length > 0 && (
        <span className="qb-usage-extra"> +{rest.length} more</span>
      )}
    </span>
  );
}

function QuestionRow({
  q,
  cols,
  selected,
  onSelect,
  onEdit,
  onOpenMenu,
  menuOpen,
}: {
  q: Question;
  /** Visible optional columns, already in the user's order. */
  cols: QbColMeta[];
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const isArchived = q.status === "Archived";
  const dates = questionDates(q);
  return (
    <tr
      className={`qb-row ${isArchived ? "is-archived" : ""} ${selected ? "is-selected" : ""} ${menuOpen ? "menu-open" : ""}`}
      onClick={onSelect}
    >
      <td className="qb-col-question">
        <div className="qb-q-text">{q.text}</div>
      </td>
      {cols.map((c) => (
        <td key={c.key} className={c.className}>
          {c.render(q, dates)}
        </td>
      ))}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(e.currentTarget.getBoundingClientRect());
          }}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn"
            aria-label="Edit"
            title="Edit question"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <RowEditIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More actions"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMenu(e.currentTarget.getBoundingClientRect());
            }}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* Tasks-style fixed-position row actions menu for a question. */
function QuestionActionsMenu({
  q,
  rect,
  onClose,
  onEdit,
  onArchive,
  onPreview,
  onVersionHistory,
}: {
  q: Question;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onPreview: () => void;
  onVersionHistory: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    /* Right-anchored to the trigger — the kebab is the action bar's last cell,
       so the open menu's right edge lines up with the bar's. Using `right`
       rather than (rect.right - measuredWidth) keeps that exact: the first-pass
       width measurement is unreliable, because the fallback `left` shrink-to-
       fits the menu against the viewport before it has been placed. */
    setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = (
    icon: JSX.Element,
    label: string,
    onPick: () => void,
    /* `note` is the reason a row is disabled. It renders as a second line
       INSIDE the button (Figma 388:354), so the icon centres against the whole
       two-line block rather than sitting level with the label. */
    opts?: { disabled?: boolean; title?: string; note?: string },
  ) => (
    <button
      className="u-menu-item"
      disabled={opts?.disabled}
      title={opts?.title}
      onClick={(e) => {
        e.stopPropagation();
        if (opts?.disabled) return;
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      <span className="u-menu-item-text">
        <span>{label}</span>
        {opts?.note && <span className="u-menu-item-sub">{opts.note}</span>}
      </span>
    </button>
  );

  const isArchived = q.status === "Archived";
  // A question that's used in a Quiz can't be archived (but can still be unarchived).
  const inUse = q.quizzes.length > 0;
  const blockArchive = !isArchived && inUse;

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Figma 388:354 is the exact item list for this menu — four rows, no
          heading and no dividers. The open row is already identified by its
          held hover state, so the Q-id header the menu used to carry is gone. */}
      {item(<RowEditIcon />, "Edit Question", onEdit)}
      {item(<MenuPreviewIcon />, "Preview", onPreview)}
      {/* Nothing to show yet — version 1 has no prior versions. */}
      {q.version > 1 && item(<MenuHistoryIcon />, "Version History", onVersionHistory)}
      {item(
        <MenuArchiveIcon />,
        isArchived ? "Unarchive" : "Archive",
        onArchive,
        blockArchive
          ? {
              disabled: true,
              title: "In use in a quiz — remove it from all quizzes before archiving",
              note: `Currently active in ${q.quizzes.length} Quiz${q.quizzes.length === 1 ? "" : "zes"}`,
            }
          : undefined,
      )}
    </div>
  );
}

/* "More filters" — Quizzes and Feedback Forms, each searchable (Figma 24:16115
   minus its subheadings — CascadingMultiSelect's per-section search). */
function QbMoreFiltersPill({
  quizzes,
  forms,
  quizNames,
  formNames,
  onApply,
}: {
  quizzes: string[];
  forms: string[];
  quizNames: string[];
  formNames: string[];
  onApply: (v: { quizzes: string[]; forms: string[] }) => void;
}) {
  const count = quizzes.length + forms.length;
  const value = useMemo(() => ({ quizzes, forms }), [quizzes, forms]);

  return (
    <Dropdown
      width={320}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More filters"
          value={count > 0 ? `${count} active` : null}
          open={open}
          toggle={toggle}
          onClear={() => onApply({ quizzes: [], forms: [] })}
        />
      )}
    >
      {({ close }) => (
        <CascadingMultiSelect
          sections={[
            {
              key: "quizzes",
              label: "Quizzes",
              groups: [{ items: quizNames }],
              searchPlaceholder: "Search quizzes…",
            },
            {
              key: "forms",
              label: "Feedback Forms",
              groups: [{ items: formNames }],
              searchPlaceholder: "Search feedback forms…",
            },
          ]}
          value={value}
          onApply={(v) => {
            onApply({ quizzes: v.quizzes, forms: v.forms });
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

/* Multi-select filter pill — the same Dropdown + PillTrigger + checklist/Apply
   body the Tasks filter row uses. Empty selection = unapplied dashed pill. */
function MultiSelectPill({
  label,
  options,
  value,
  onApply,
  searchPlaceholder,
}: {
  label: string;
  options: string[];
  value: string[];
  onApply: (v: string[]) => void;
  searchPlaceholder?: string;
}) {
  return (
    <Dropdown
      width={searchPlaceholder ? 300 : 220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={label}
          value={summarize(value, options)}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: options }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable={!!searchPlaceholder}
          searchPlaceholder={searchPlaceholder}
        />
      )}
    </Dropdown>
  );
}

/* "More filters" — the low-traffic filters, in the shared cascading menu. */
