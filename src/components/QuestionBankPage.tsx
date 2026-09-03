import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  categories as seedCategories,
  questions as allQuestions,
  flattenCategories,
  longQuestionType,
  questionDates,
  shortQuestionType,
  QUESTION_TYPE_MENU,
  QUESTION_TYPE_OPTIONS,
  TRADE_GROUPS,
  supportsGrading,
  versionHistory,
  type Category,
  type Question,
  type QuestionStatus,
  type QuestionType,
  type QuestionVersion,
  type Subcategory,
} from "../data/questionBank";
import { ChevronLeftIcon, MenuArchiveIcon, MenuHistoryIcon, RowEditIcon, RowKebabIcon, SearchIcon, SortIcon, TreeAddIcon, TreeCaretIcon, RowDeleteIcon, ChevronRightIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { CascadingMultiSelect, EditColumnsButton, PillTrigger, SectionedMultiSelect, summarize, useColumnOrder, orderedColumns } from "./Filters";
import { SectionHeading } from "./SectionHeading";
import { SelectField } from "./SelectField";
import { QuestionSearch } from "./QuestionSearch";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { useLandingMorph } from "../hooks/useLandingMorph";

const PAGE_SIZE = 50;

/* The seed set is a sample of a much larger bank, so the landing's counts are
   the mock figures the category counts add up to — not `questions.length`. */
const formatCount = (n: number) => n.toLocaleString("en-US");

/* Every filter is a multi-select, matching the Tasks row: empty = unapplied,
   values inside one filter OR together, filters AND together. */
const TYPE_OPTIONS = QUESTION_TYPE_OPTIONS;
const STATUS_OPTIONS: QuestionStatus[] = ["Active", "Archived", "Draft"];
const GRADING_OPTIONS = ["Graded", "Ungraded"];

/* The landing's RECENT row opens with these until the user has opened three
   categories of their own (mock — a real bank would remember per user). */
const SEED_RECENT = ["Commercial Refrigeration", "Plumbing Code > Water Heaters", "Solar"];
const RECENT_MAX = 3;

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

// Row-menu target — a category or a subcategory row.
type CatTarget =
  | { kind: "category"; categoryKey: string }
  | { kind: "subcategory"; categoryKey: string; subKey: string };

type CatMenuState = { target: CatTarget; x: number; y: number } | null;

/* Rename and delete run in the shared modal; CREATING is lighter — a new
   subcategory is typed inline in the tree and a new category in the rail's
   popover. */
type CatModalState =
  | { kind: "none" }
  | { kind: "edit-category"; categoryKey: string }
  | { kind: "edit-sub"; categoryKey: string; subKey: string }
  | { kind: "delete"; target: CatTarget };

/* The landing's alphabetical index — categories A→Z under letter headings.
   Sparse neighbouring letters share a heading ("G · H") so no group is a
   lone row; a heading takes the next letter while both sides are short. */
type IndexGroup = { letter: string; items: Category[] };
const INDEX_MERGE_BELOW = 3;

function buildIndex(cats: Category[]): IndexGroup[] {
  const byLetter = new Map<string, Category[]>();
  [...cats]
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((c) => {
      const letter = (c.label.match(/[a-z0-9]/i)?.[0] ?? "#").toUpperCase();
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), c]);
    });
  const groups: IndexGroup[] = [];
  for (const [letter, items] of byLetter) {
    const last = groups[groups.length - 1];
    if (last && last.items.length < INDEX_MERGE_BELOW && items.length < INDEX_MERGE_BELOW) {
      last.letter += ` · ${letter}`;
      last.items.push(...items);
    } else {
      groups.push({ letter, items: [...items] });
    }
  }
  return groups;
}

/* The index runs in INDEX_COLUMNS columns, read down-then-across. A group is
   never split or carried over, so each column is a contiguous run of whole
   groups — which makes balancing them a linear-partition problem: split the
   A→Z run into EXACTLY this many parts, minimising the tallest one.

   Exactly, not "at most": the cheaper "at most k" packing hits the same
   optimal height while leaving trailing columns empty, which is the thing to
   avoid. Height is counted in rows — a group costs its categories plus one for
   its letter head. (CSS `column-count` can do neither: it balances by measured
   height, so it both empties the last column and, once the list outgrows the
   viewport, breaks a group across a column boundary.) */
const INDEX_COLUMNS = 4;

function balanceIndex(groups: IndexGroup[], columns = INDEX_COLUMNS): IndexGroup[][] {
  const n = groups.length;
  // Fewer groups than columns — one each, and the remainder stay empty.
  if (n <= columns) {
    return Array.from({ length: columns }, (_, i) => (i < n ? [groups[i]] : []));
  }

  const cost = groups.map((g) => g.items.length + 1);
  const prefix = [0];
  cost.forEach((c) => prefix.push(prefix[prefix.length - 1] + c));

  // best[j][i] — the smallest achievable tallest column when the first i
  // groups fill exactly j columns; cut[j][i] is the split that got there.
  const best = Array.from({ length: columns + 1 }, () => new Array(n + 1).fill(Infinity));
  const cut = Array.from({ length: columns + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= n; i++) best[1][i] = prefix[i];
  for (let j = 2; j <= columns; j++) {
    for (let i = j; i <= n; i++) {
      for (let m = j - 1; m < i; m++) {
        const height = Math.max(best[j - 1][m], prefix[i] - prefix[m]);
        // `<=` keeps the LAST equally-good cut, which fills earlier columns
        // first — a full first column tapering off reads better than the
        // reverse, and every tie here is the same tallest column either way.
        if (height <= best[j][i]) {
          best[j][i] = height;
          cut[j][i] = m;
        }
      }
    }
  }

  const cols: IndexGroup[][] = [];
  let end = n;
  for (let j = columns; j >= 1; j--) {
    const start = j === 1 ? 0 : cut[j][end];
    cols.unshift(groups.slice(start, end));
    end = start;
  }
  return cols;
}

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
  onBackToTasks,
  initialQuestions,
}: {
  onNewQuestion?: (categoryPath?: string[], type?: QuestionType) => void;
  onEditQuestion?: (question: Question) => void;
  onBackToTasks?: () => void;
  initialQuestions?: Question[];
} = {}) {
  const [categories, setCategories] = useState<Category[]>(seedCategories);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions ?? allQuestions);
  const [rowMenu, setRowMenu] = useState<{ q: Question; rect: DOMRect } | null>(null);
  // Row-click preview panel + version-history modal
  const [historyQ, setHistoryQ] = useState<Question | null>(null);
  // Category is a multi-select like every other filter — labels from
  // flattenCategories ("EPA 608" / "EPA 608 > Universal"). Empty = all questions.
  const [selection, setSelection] = useState<string[]>([]);
  // Every category opens collapsed in the rail's tree.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // The rail's own tree filter (table state only) — the landing finds
  // categories through the main search or its A→Z index instead.
  const [categorySearch, setCategorySearch] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  // The row kebab's Edit / Delete menu and the modals it opens.
  const [catMenu, setCatMenu] = useState<CatMenuState>(null);
  const [catModal, setCatModal] = useState<CatModalState>({ kind: "none" });
  // The last few categories opened — the landing's RECENT row.
  const [recent, setRecent] = useState<string[]>(SEED_RECENT);
  // Category being given a new subcategory inline in the tree (its key).
  const [inlineSub, setInlineSub] = useState<string | null>(null);
  // The New Category popover, anchored to the rail's "+ New category" row.
  const [catPop, setCatPop] = useState<DOMRect | null>(null);
  const newCatBtnRef = useRef<HTMLButtonElement | null>(null);
  // …and the landing's own "+ Add category", in the index header.
  const landingCatBtnRef = useRef<HTMLButtonElement | null>(null);

  // Landing morph — the page opens as the category browser (the hero search
  // over the A→Z category index) and a category click, a committed search, or
  // the "Question Bank" crumb moves it to and from the questions table.
  // NO wheel gesture here (unlike the other landing pages): the index is a
  // long scrolling list people read, so the wheel has to stay its own — an
  // accidental morph at the foot of the A→Z would be a page they didn't ask for.
  const morph = useLandingMorph(false, false);
  const atTable = morph.atTable;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  // Draft questions are hidden until the author asks for them.
  const [statusFilter, setStatusFilter] = useState<string[]>(["Active"]);
  const [gradingFilter, setGradingFilter] = useState<string[]>([]);
  // Quizzes/Feedback Forms are also set from the search box's Quizzes: /
  // Feedback Form: tokens.
  const [quizFilter, setQuizFilter] = useState<string[]>([]);
  const [formFilter, setFormFilter] = useState<string[]>([]);

  // Question (fixed) + Type is the whole default row — everything else is
  // opt-in from Edit Columns.
  const [columns, setColumns] = useState<QbColumnState>({
    id: false,
    type: true,
    version: false,
    status: false,
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

  // The open category is navigation, not a filter — it has no pill, so it is
  // neither counted here nor dropped by Clear Filters (that would silently
  // throw you back to All Questions). Leaving a category is the rail's job.
  const appliedCount =
    typeFilter.length +
    statusFilter.length +
    gradingFilter.length +
    quizFilter.length +
    formFilter.length;

  function clearFilters() {
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

  // Restoring an old version creates a NEW version with its content.
  function restoreVersion(id: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, version: q.version + 1 } : q)),
    );
  }

  function startCreate(type: QuestionType) {
    let path: string[] | undefined;
    if (selection.length === 1) {
      path = selection[0].split(" > ");
    }
    onNewQuestion?.(path, type);
  }

  // Opening a category (from the index, the RECENT row, or the rail's tree)
  // scopes the table to it and moves it to the front of RECENT.
  function openCategory(label: string) {
    setSelection([label]);
    setRecent((prev) => [label, ...prev.filter((l) => l !== label)].slice(0, RECENT_MAX));
    morph.showTable();
  }

  // The New Category popover hangs off whichever add-category affordance is on
  // screen: the rail's "Add Category" foot row at the table, the index header's
  // "+ Add category" at the landing.
  function openNewCategory() {
    const btn = (atTable ? newCatBtnRef : landingCatBtnRef).current;
    if (btn) setCatPop(btn.getBoundingClientRect());
  }

  // Nothing else is mid-flight: no menu, popover, inline editor or modal.
  const idle =
    catModal.kind === "none" && !catMenu && !createMenuOpen && catPop == null && inlineSub == null;

  // "C" opens the Create Question menu on every screen; "A" opens the New
  // Category popover on both — the landing's index header carries the same
  // affordance the rail does.
  useCreateShortcut(() => setCreateMenuOpen(true), idle);
  useCreateShortcut(openNewCategory, idle, "a");

  // With the menu open, each question type's letter (M, T, F, …) launches that
  // editor — the same pattern as the Tasks page's Create Task menu.
  useEffect(() => {
    if (!createMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        setCreateMenuOpen(false);
        return;
      }
      const option = QUESTION_TYPE_MENU.find(
        (o) => o.shortcut.toLowerCase() === e.key.toLowerCase(),
      );
      if (option) {
        e.preventDefault();
        setCreateMenuOpen(false);
        startCreate(option.type);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [createMenuOpen, selection, onNewQuestion]);

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
  function addCategory(label: string, tradeGroup?: string) {
    // New categories append to the bottom of the list.
    setCategories((prev) => [
      ...prev,
      { key: `cat-${Date.now()}`, label, count: 0, subcategories: [], tradeGroup },
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
      const drop = (l: string) => l !== label && !l.startsWith(`${label} > `);
      setSelection((prev) => prev.filter(drop));
      setRecent((prev) => prev.filter(drop));
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
      setRecent((prev) => prev.filter((l) => l !== label));
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

  // Rows are role="button" divs (the kebab inside them is the real button),
  // so Enter / Space act like the click.
  const rowKeys = (act: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      act();
    }
  };

  // Landing totals — the eyebrow over the hero search.
  const totalSubcategories = useMemo(
    () => categories.reduce((n, c) => n + (c.subcategories?.length ?? 0), 0),
    [categories],
  );
  const totalQuestions = useMemo(
    () => categories.reduce((n, c) => n + c.count, 0),
    [categories],
  );

  // The landing's A→Z index of every category.
  const indexColumns = useMemo(() => balanceIndex(buildIndex(categories)), [categories]);

  // RECENT shows only labels that still exist (a rename drops its entry).
  const recentShown = useMemo(
    () => recent.filter((l) => categoryLabels.includes(l)),
    [recent, categoryLabels],
  );

  // The rail's search-filtered tree. A category matches on its own label or on
  // any of its subcategories', so a subcategory hit keeps its parent row.
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.subcategories ?? []).some((s) => s.label.toLowerCase().includes(q)),
    );
  }, [categories, categorySearch]);

  // ─── Working-screen header: the open category (or subcategory) is the page
  // title — the landing keeps the page's own name and the eyebrow carries the
  // totals. The status breakdown that used to sit under the title is gone; the
  // pagination row already carries the count. ───
  const single = selection.length === 1 ? selection[0] : null;
  const scopeName = single ? single.split(" > ").pop()! : null;
  const pageTitle = !atTable
    ? "Question Bank"
    : selection.length === 0
      ? "All Questions"
      : scopeName ?? `${selection.length} Categories`;

  // The rail's category tree (table state only) — Figma 862:2372: "All
  // Questions" (the caret-less row, 862:2391) then every category, each
  // expandable and, when open, ending in an inline "Add Sub-Category" row.
  // Picking a row is a table interaction.
  function renderTree(cats: Category[]) {
    const showAll = () => {
      setSelection([]);
      morph.showTable();
    };
    const pickCategory = (cat: Category, isActive: boolean) => {
      if (isActive) {
        toggleGroup(cat.key);
      } else {
        openCategory(cat.label);
        setOpenGroups((prev) => ({ ...prev, [cat.key]: true }));
      }
    };
    return (
      <div className="tree lm-scroll">
        <div
          className={`tree-row tree-row--all ${selection.length === 0 ? "is-active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={showAll}
          onKeyDown={rowKeys(showAll)}
        >
          <span className="tree-main">
            <span className="tree-row-label">All Questions</span>
          </span>
        </div>

        {cats.map((cat) => {
          const isOpen = !!openGroups[cat.key];
          const isActiveCat = selection.includes(cat.label);
          return (
            <div key={cat.key} className="tree-group">
              {/* The whole row is the control: a click selects the category and
                  opens its sublist; once it is the selection, further clicks
                  toggle the sublist. The kebab (Figma 865:2443, hover only)
                  is the row's one real button, so the row is a role=button. */}
              <div
                className={`tree-row ${isActiveCat ? "is-active" : ""}`}
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                onClick={() => pickCategory(cat, isActiveCat)}
                onKeyDown={rowKeys(() => pickCategory(cat, isActiveCat))}
              >
                <span className={`tree-caret-btn ${isOpen ? "is-open" : ""}`} aria-hidden>
                  <TreeCaretIcon />
                </span>
                <span className="tree-main">
                  <span className="tree-row-label">{cat.label}</span>
                </span>
                <button
                  className={`tree-menu-btn ${catMenu?.target.kind === "category" && catMenu.target.categoryKey === cat.key ? "is-open" : ""}`}
                  aria-label="Category options"
                  onClick={(e) => openCatMenu(e, { kind: "category", categoryKey: cat.key })}
                >
                  <RowKebabIcon />
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
                            role="button"
                            tabIndex={0}
                            onClick={() => openCategory(subLabel)}
                            onKeyDown={rowKeys(() => openCategory(subLabel))}
                          >
                            <span className="tree-sub-row-label">{sub.label}</span>
                            <button
                              className={`tree-menu-btn ${catMenu?.target.kind === "subcategory" && catMenu.target.subKey === sub.key ? "is-open" : ""}`}
                              aria-label="Subcategory options"
                              onClick={(e) =>
                                openCatMenu(e, {
                                  kind: "subcategory",
                                  categoryKey: cat.key,
                                  subKey: sub.key,
                                })
                              }
                            >
                              <RowKebabIcon />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {inlineSub === cat.key ? (
                    <TreeInlineAdd
                      existingNames={(cat.subcategories ?? []).map((s) => s.label.toLowerCase())}
                      onSave={(label) => {
                        addSubcategory(cat.key, label);
                        setInlineSub(null);
                      }}
                      onCancel={() => setInlineSub(null)}
                    />
                  ) : (
                    <button className="tree-add-link" onClick={() => setInlineSub(cat.key)}>
                      <span className="tree-add-icon"><TreeAddIcon /></span>
                      Add Sub-Category
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Bulk import — the header's Import CSV opens the picker; at the landing the
  // whole page is also a drop target (the footer line says so). Visual only.
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const draggingFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

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
        {/* The whole page is the landing-morph root, so the rail can ride the
            same progress as everything else. It opens as the category browser
            — page heading + Import CSV + Create CTA, the totals eyebrow, the
            hero search, the RECENT row, then the A→Z category index — and the
            wheel (or a search, "All Questions", or a category click) morphs it
            into the questions table with the category rail sliding in beside
            it; "↑ Back to search" returns to the index. The shared `.tasks.lm`
            chrome does the motion, `.qb-lm` holds this page's overrides. */}
        <div
          className={`qb-page tasks lm qb-lm ${dropActive ? "is-drop-active" : ""}`}
          ref={morph.rootRef}
          onDragOver={(e) => {
            if (atTable || !draggingFiles(e)) return;
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={(e) => {
            // Only when the drag actually leaves the page, not a child element.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropActive(false);
          }}
          onDrop={(e) => {
            if (atTable) return;
            e.preventDefault();
            setDropActive(false);
          }}
        >
          {/* ─── Rail (table state) — Figma 859:1867 "Left Panel": the shared
              `.rail` + `.tree` chrome with no header — search, the count
              heading, the tree, and the Add Category row pinned at the foot
              behind a hairline. ─── */}
          <aside className="rail qb-rail">
            <div className="rail-search">
              <span className="search-icon"><SearchIcon /></span>
              {/* Deliberately NOT `.search-input`: ⌘K belongs to the main
                  question search, and it grabs the first match in DOM order. */}
              <input
                placeholder="Search Categories..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>
            <SectionHeading label={`Categories · ${categories.length}`} />
            {/* `.lm-scroll`: the wheel scrolls the rail while it has room, and
                only falls through to the morph (back to the landing) at its top. */}
            {renderTree(filteredCategories)}
            {/* 862:2425 — the New Category popover anchors here. */}
            <button
              ref={newCatBtnRef}
              className={`tree-add-link qb-rail-add ${catPop ? "is-open" : ""}`}
              onClick={openNewCategory}
            >
              <span className="tree-add-icon"><TreeAddIcon /></span>
              Add Category
            </button>
          </aside>

          <section className="qb-content">
            <header className="tasks-header">
              {/* Table-state crumb only — the landing IS the Question Bank, so
                  it keeps its bare title and the trail unfolds with the table
                  chrome (the `.qbl-meta` collapse recipe). Question Bank has no
                  sidebar entry — it is reached from the Tasks header — so
                  "Tasks" is the way back, and "Question Bank" returns to the
                  category index in place of the footer's old "Back to search". */}
              <div className="rvc-pagehead">
                <nav className="rvc-crumbs qb-crumbs" aria-label="Breadcrumb">
                  <button className="rvc-crumb" onClick={onBackToTasks} title="Back to Tasks">
                    Tasks
                  </button>
                  <ChevronRightIcon />
                  <button
                    className="rvc-crumb"
                    onClick={morph.showLanding}
                    title="Back to the category index"
                  >
                    Question Bank
                  </button>
                </nav>
                <h1 className="tasks-title">{pageTitle}</h1>
              </div>
              <div className="tasks-header-actions">
                {/* Landing only — bulk import lives here, not on the working
                    screens (it fades with the landing chrome). */}
                <button className="cta-quiet qb-import" onClick={() => fileRef.current?.click()}>
                  Import CSV
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={() => {/* noop in mock */}}
                />
                {/* Figma 724:1010 menu, one row per question type. */}
                <Dropdown
                  align="right"
                  width="auto"
                  panelClass="ct-menu"
                  open={createMenuOpen}
                  onOpenChange={setCreateMenuOpen}
                  trigger={({ toggle }) => (
                    <button className="cta-primary" onClick={toggle}>
                      Create Question
                      <span className="cta-kbd">C</span>
                    </button>
                  )}
                >
                  {({ close }) => (
                    <>
                      {QUESTION_TYPE_MENU.map(({ type, label, shortcut }) => (
                        <button
                          key={type}
                          className="ct-menu-item"
                          onClick={() => {
                            startCreate(type);
                            close();
                          }}
                        >
                          <span className="ct-menu-label">{label}</span>
                          <span className="ct-menu-kbd">{shortcut}</span>
                        </button>
                      ))}
                    </>
                  )}
                </Dropdown>
              </div>
            </header>

            {/* Landing eyebrow over the hero search. */}
            <div className="qbl-meta">
              {formatCount(totalQuestions)} Questions · {categories.length} Categories ·{" "}
              {totalSubcategories} Subcategories
            </div>

            <div className="toolbar">
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
                onCommit={(q) => {
                  setQuery(q);
                  morph.showTable();
                }}
                placeholder={
                  atTable && scopeName
                    ? `Search in ${scopeName}…`
                    : "Search Question, Categories..."
                }
              />
            </div>

            {/* Landing only: the last categories opened. */}
            {recentShown.length > 0 && (
              <div className="qbl-recent">
                <span className="qbl-recent-label">Recent</span>
                {recentShown.map((label, i) => (
                  <span key={label} className="qbl-recent-item">
                    {i > 0 && <span className="qbl-recent-dot">·</span>}
                    <button className="qbl-recent-link" onClick={() => openCategory(label)}>
                      {label.split(" > ").pop()}
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* ─── Table-only chrome: unfolds with the table ─── */}
            <div className="qb-filters-row">
              <div className="qb-filters">
                {/* No Category pill: the open category is navigation here, not
                    a filter — the rail, the title and the crumb carry it. */}
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
                <QbMoreFiltersPill
                  grading={gradingFilter}
                  quizzes={quizFilter}
                  forms={formFilter}
                  quizNames={quizNames}
                  formNames={formNames}
                  onApply={(v) => {
                    setGradingFilter(v.grading);
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
            </div>

            <div className="lm-stage">
              {/* ─── Landing layer: the A→Z category index, and the drop-a-CSV
                  line pinned under it ─── */}
              <div className="lm-land qbl-land">
                {/* Index header — Figma 867:2473: "ALL CATEGORIES · n" and the
                    landing's Add Category affordance over the group hairline.
                    It sits OUTSIDE `.qbl-index` (the scroller) so it holds
                    while a bank with hundreds of categories scrolls under it. */}
                <div className="qbl-index-head">
                  <div className="qbl-index-head-row">
                    <span className="qbl-index-head-label">
                      All Categories · {formatCount(categories.length)}
                    </span>
                    <button
                      ref={landingCatBtnRef}
                      className={`qbl-index-add ${catPop && !atTable ? "is-open" : ""}`}
                      onClick={openNewCategory}
                    >
                      <span className="tree-add-icon"><TreeAddIcon /></span>
                      Add Category
                    </button>
                  </div>
                </div>
                <div className="qbl-index lm-scroll">
                  {indexColumns.map((col, i) => (
                    <div key={i} className="qbl-index-col">
                      {col.map((g) => (
                        <div key={g.letter} className="qbl-index-group">
                          <div className="qbl-index-letter">{g.letter}</div>
                          {g.items.map((c) => (
                            <button
                              key={c.key}
                              className="qbl-index-row"
                              onClick={() => openCategory(c.label)}
                            >
                              <span className="qbl-index-name">{c.label}</span>
                              <span className="qbl-index-count">{formatCount(c.count)}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="qbl-drop-hint">
                  {dropActive
                    ? "Drop the CSV to import questions"
                    : "Bulk upload: drop a CSV anywhere on this page, or use Import CSV"}
                </div>
              </div>

              {/* ─── Table ─── */}
              <div className="lm-table">
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
              </div>
            </div>
          </section>
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
          onVersionHistory={() => setHistoryQ(rowMenu.q)}
        />
      )}

      {/* ─── Row kebab menu ─── */}
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

      {/* ─── Category rename / delete modals ─── */}
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

      {/* ─── New Category popover (design S4) ─── */}
      {catPop && (
        <NewCategoryPopover
          anchor={catPop}
          existingNames={categories.map((c) => c.label.toLowerCase())}
          onCreate={(label, tradeGroup) => {
            addCategory(label, tradeGroup);
            setCatPop(null);
          }}
          onCancel={() => setCatPop(null)}
        />
      )}

    </div>
  );
}

/* Inline subcategory editor (design S4): a bordered input in the sub-list's
   place, ⏎ saves and Esc (or clicking away) cancels. Names must be unique
   within the parent. */
function TreeInlineAdd({
  existingNames,
  onSave,
  onCancel,
}: {
  existingNames: string[];
  onSave: (label: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const isDuplicate = !!trimmed && existingNames.includes(trimmed.toLowerCase());

  return (
    <div className={`tree-inline ${isDuplicate ? "is-invalid" : ""}`}>
      <input
        autoFocus
        className="tree-inline-input"
        placeholder="Subcategory name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && trimmed && !isDuplicate) onSave(trimmed);
          else if (e.key === "Escape") onCancel();
        }}
        onBlur={onCancel}
      />
      <span className="tree-inline-hint">
        {isDuplicate ? "A subcategory with this name already exists" : "⏎ save · esc cancel"}
      </span>
    </div>
  );
}

/* New Category popover (design S4): a small card hanging off the rail's
   "+ New category" row — Name, an optional trade group, Cancel / Create. Esc
   or a click outside dismisses it; the card is kept on screen when the row
   sits near the bottom of the rail. */
function NewCategoryPopover({
  anchor,
  existingNames,
  onCreate,
  onCancel,
}: {
  anchor: DOMRect;
  existingNames: string[];
  onCreate: (label: string, tradeGroup?: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [name, setName] = useState("");
  const [group, setGroup] = useState<string>("");
  const trimmed = name.trim();
  const isDuplicate = !!trimmed && existingNames.includes(trimmed.toLowerCase());
  const isValid = !!trimmed && !isDuplicate;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    // Bottom edge level with the trigger row, hanging off the rail's right
    // edge (the row spans the rail) so it opens over the content pane like
    // the design. A trigger in the TOP half of the page — the landing index
    // header's "+ Add category" — drops below instead and right-aligns to the
    // trigger rather than hanging past it, so the card opens into the empty
    // index rather than back over the page header. Both are clamped so the
    // card never leaves the viewport.
    const openDown = anchor.top < window.innerHeight / 2;
    const top = openDown ? anchor.bottom + 8 : anchor.bottom - h;
    const rightAligned = anchor.left > window.innerWidth / 2;
    const left = rightAligned ? anchor.right - w : anchor.right - 20;
    setPos({
      top: Math.max(8, Math.min(top, window.innerHeight - h - 8)),
      left: Math.max(8, Math.min(left, window.innerWidth - w - 8)),
    });
  }, [anchor]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Element | null;
      // The trade-group menu is portalled to the body — a click in it stays "inside".
      if (ref.current?.contains(t) || t?.closest(".dropdown")) return;
      onCancel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onCancel]);

  function submit() {
    if (isValid) onCreate(trimmed, group || undefined);
  }

  return (
    <div
      ref={ref}
      className="qb-catpop"
      style={{
        top: pos ? pos.top : anchor.top,
        left: pos ? pos.left : anchor.left,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="qb-catpop-title">New category</div>
      <div className="qb-catpop-field">
        <label className="qb-catpop-label">Name</label>
        <input
          autoFocus
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Commercial Kitchen Equipment"
        />
        {isDuplicate && (
          <div className="pm-error">A category with this name already exists.</div>
        )}
      </div>
      <div className="qb-catpop-field">
        <label className="qb-catpop-label">
          Trade group <span className="qb-catpop-optional">(optional)</span>
        </label>
        <SelectField
          value={group}
          options={TRADE_GROUPS}
          onChange={setGroup}
          placeholder="Select a trade group"
          popupMenu
        />
      </div>
      <div className="qb-catpop-foot">
        <button className="btn-save-draft" onClick={onCancel}>Cancel</button>
        <button className="btn-publish" disabled={!isValid} onClick={submit}>
          Create
        </button>
      </div>
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
  onEdit,
  onOpenMenu,
  menuOpen,
}: {
  q: Question;
  /** Visible optional columns, already in the user's order. */
  cols: QbColMeta[];
  onEdit: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const isArchived = q.status === "Archived";
  const dates = questionDates(q);
  return (
    <tr className={`qb-row ${isArchived ? "is-archived" : ""} ${menuOpen ? "menu-open" : ""}`}>
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
  onVersionHistory,
}: {
  q: Question;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
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
      {/* Based on Figma 388:354, minus the Preview row — questions no longer
          have a preview panel. No heading and no dividers; the open row is
          identified by its held hover state. */}
      {item(<RowEditIcon />, "Edit Question", onEdit)}
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
  grading,
  quizzes,
  forms,
  quizNames,
  formNames,
  onApply,
}: {
  grading: string[];
  quizzes: string[];
  forms: string[];
  quizNames: string[];
  formNames: string[];
  onApply: (v: { grading: string[]; quizzes: string[]; forms: string[] }) => void;
}) {
  const count = grading.length + quizzes.length + forms.length;
  const value = useMemo(() => ({ grading, quizzes, forms }), [grading, quizzes, forms]);

  return (
    <Dropdown
      width={320}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={count > 0 ? `${count} Active` : null}
          open={open}
          toggle={toggle}
          onClear={() => onApply({ grading: [], quizzes: [], forms: [] })}
        />
      )}
    >
      {({ close }) => (
        <CascadingMultiSelect
          sections={[
            // Grading leads — it kept its slot from the pill row, and its two
            // fixed options need no search box.
            { key: "grading", label: "Grading", groups: [{ items: GRADING_OPTIONS }] },
            {
              key: "quizzes",
              label: "Quizzes",
              groups: [{ items: quizNames }],
              searchPlaceholder: "Search Quizzes…",
            },
            {
              key: "forms",
              label: "Feedback Forms",
              groups: [{ items: formNames }],
              searchPlaceholder: "Search Feedback Forms…",
            },
          ]}
          value={value}
          onApply={(v) => {
            onApply({ grading: v.grading, quizzes: v.quizzes, forms: v.forms });
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
