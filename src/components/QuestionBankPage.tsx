import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  attemptCount,
  categories as seedCategories,
  questions as allQuestions,
  flattenCategories,
  longQuestionType,
  matchesUsage,
  NO_FORM,
  NO_FORM_HINT,
  NO_QUIZ,
  NO_QUIZ_HINT,
  questionDates,
  questionCreatedAt,
  questionModifiedAt,
  shortQuestionType,
  QUESTION_TYPE_OPTIONS,
  supportsGrading,
  type Category,
  type Question,
  type QuestionStatus,
  type QuestionType,
  type Subcategory,
  versionHistory,
} from "../data/questionBank";
import { AddCardIcon, MenuArchiveOffIcon, MenuHistoryIcon, RowEditIcon, RowKebabIcon, SortIcon, TreeAddIcon, TreeAddSubIcon, RowDeleteIcon, CrumbChevronIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { FILTER_TIPS } from "../data/filterTips";
import { CascadingMultiSelect, EditColumnsButton, PillTrigger, SectionedMultiSelect, summarize, orderedColumns } from "./Filters";
import { PrmModal } from "./PrmModal";
import { TableCols } from "./TableCols";
import { LimitError } from "./CharCount";
import { LimitedInput } from "./LimitedInput";
import { NAME_MAX, isOver } from "../data/fieldLimits";
import { BulkUploadModal } from "./BulkUploadModal";
import { useToast } from "./useToast";
import { questionsFromImport, type ImportReport } from "../data/questionImport";
import { ReviewRunsStrip, ReviewRunCard } from "./ReviewRuns";
import { QuestionSearch } from "./QuestionSearch";
import { QuestionVersionsPage } from "./QuestionVersionsPage";
import { ConfirmCard } from "./ConfirmCard";
import { PreviewPanel } from "./PreviewPanel";
import { TableEmpty } from "./TableEmpty";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { useLandingMorph } from "../hooks/useLandingMorph";

const PAGE_SIZE = 50;

/* The seed set is a sample of a much larger bank, so the landing's counts are
   the mock figures the category counts add up to — not `questions.length`. */
const formatCount = (n: number) => n.toLocaleString("en-US");
/* A Sub-Category card's second line (Figma 1494:1459) — "28 Questions". */
const questionsLine = (n: number) => `${formatCount(n)} ${n === 1 ? "Question" : "Questions"}`;

/* Category labels are paths — "EPA 608" or "EPA 608 > Universal"
   (flattenCategories). The parent of a bare category is itself. */
const parentOf = (label: string) => label.split(" > ")[0];
/* A question's own path in that form, so it can be matched against the
   Sub-Category filter's values. A question with no sub-category yields the bare
   category, which no Sub-Category value ever equals. */
const subPathOf = (q: Question) => q.categoryPath.slice(0, 2).join(" > ");

/* Every filter is a multi-select, matching the Tasks row: empty = unapplied,
   values inside one filter OR together, filters AND together. */
const TYPE_OPTIONS = QUESTION_TYPE_OPTIONS;
const STATUS_OPTIONS: QuestionStatus[] = ["Active", "Archived"];
const GRADING_OPTIONS = ["Graded", "Ungraded"];

/* The landing's RECENT row opens with these until the user has opened three
   categories of their own (mock — a real bank would remember per user). */
const SEED_RECENT = [
  "Commercial Refrigeration",
  "Plumbing Code > Water Heaters",
  "Refrigeration Basics",
  "Solar",
];
const RECENT_MAX = 4;

/* Toggleable table columns (Question is fixed). */
type QbColumn =
  | "id"
  | "type"
  | "attempts"
  | "version"
  | "status"
  | "category"
  | "grading"
  | "quizzes"
  | "forms"
  | "createdOn"
  | "lastModified";

type QbColumnState = Record<QbColumn, boolean>;

/* Everything that makes up "where you were" on the bank — handed to the
   editor by Create Question and given back on Cancel, so leaving the editor
   without saving lands on the same screen, scope, filters, sort, page and
   scroll (user, 2026-10-03). The page unmounts while the editor is open, so
   this is the only way any of it survives the trip. */
export type QbViewState = {
  atTable: boolean;
  selection: string[];
  subFilter: string[];
  query: string;
  typeFilter: string[];
  statusFilter: string[];
  gradingFilter: string[];
  quizFilter: string[];
  formFilter: string[];
  columns: QbColumnState;
  order: QbColumn[];
  page: number;
  sort: { key: QSortKey; dir: SortDir };
  recent: string[];
  scroll: { index: number; table: number };
};

const QB_FIXED_COLUMNS = [{ label: "Question" }];

// Roomy, because the question text is allowed to run to a second line
// (640 floor per the user, 2026-10-05).
const QUESTION_COL_WIDTH = 640;
const ACTIONS_COL_WIDTH = 40;

function isGraded(q: Question): boolean {
  return q.gradingEnabled && supportsGrading(q.type);
}

type QSortKey =
  | "question"
  | "id"
  | "type"
  | "attempts"
  | "version"
  | "status"
  | "category"
  | "usage"
  | "createdOn"
  | "lastModified";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<QuestionStatus, number> = {
  Active: 0,
  Archived: 1,
};

function compareQuestions(
  a: Question,
  b: Question,
  key: QSortKey,
  times: Map<string, { created: number; modified: number }>,
): number {
  switch (key) {
    case "createdOn":
      return (times.get(a.id)?.created ?? 0) - (times.get(b.id)?.created ?? 0);
    case "lastModified":
      return (times.get(a.id)?.modified ?? 0) - (times.get(b.id)?.modified ?? 0);
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
    case "attempts":
      return attemptCount(a) - attemptCount(b);
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

/* `start`: the menu hangs from its trigger's LEFT edge instead of the right —
   the title's kebab sits just after the category name, where a right-aligned
   menu would run back over the side nav on a short name. */
type CatMenuState = { target: CatTarget; x: number; y: number; start?: boolean } | null;

/* Rename and delete run in the shared modal; creating a category or a
   sub-category runs in `NewCategoryModal` (`subModal` / `catModalOpen`). */
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

/* Responsive index columns (2026-10-01 rule set). Measured on the index's
   content box (A, inside its 12px padding):
   - N = as many columns as fit at 260px + a 40px gap, held to 2…5
     (2 below A 860, 3 from 860, 4 from 1160, 5 from 1460).
   - The gap scales with the column: 40px at 260 wide → 48px at 320 wide,
     G = 40 + 0.133 × (W − 260); columns + gaps fill A exactly.
   - Past 320 the gap stops at 48. Below 5 columns the columns keep growing
     until the next one fits (widest ≈ 405 at 2 columns, ≈ 354 at 3), so the
     index always fills A; only at 5 columns (A ≥ 1792) do they stop at 320
     and the slack sits on the right.
   - Under 260 (2 columns, A < 560) the gap stays 40 and the columns shrink;
     names ellipsize, the index never scrolls sideways.
   Minimums raised from 220 / 24 / 3 columns the same day (user); the minimum
   gap went 32 → 40 on 2026-10-03 (user). */
const INDEX_COL = { minW: 260, maxW: 320, minG: 40, maxG: 48, minN: 2, maxN: 5 };
const INDEX_SLOPE = (INDEX_COL.maxG - INDEX_COL.minG) / (INDEX_COL.maxW - INDEX_COL.minW);

function indexLayout(avail: number): { n: number; w: number; g: number } {
  const { minW, maxW, minG, maxG, minN, maxN } = INDEX_COL;
  const n = Math.min(maxN, Math.max(minN, Math.floor((avail + minG) / (minW + minG))));
  // Solve avail = n·W + (n − 1)·G(W) for W.
  const w = (avail - (n - 1) * (minG - INDEX_SLOPE * minW)) / (n + INDEX_SLOPE * (n - 1));
  if (w >= maxW) {
    // The 320 cap holds only at the last column count; with fewer, the next
    // column doesn't fit yet, and capping would leave a blank strip.
    if (n === maxN) return { n, w: maxW, g: maxG };
    return { n, w: (avail - (n - 1) * maxG) / n, g: maxG };
  }
  if (w <= minW) return { n, w: Math.max(0, (avail - (n - 1) * minG) / n), g: minG };
  return { n, w, g: minG + INDEX_SLOPE * (w - minW) };
}

/* The index runs in N columns (see `indexLayout`), read down-then-across. A group is
   never split or carried over, so each column is a contiguous run of whole
   groups — which makes balancing them a linear-partition problem: split the
   A→Z run into EXACTLY this many parts, minimising the tallest one.

   Exactly, not "at most": the cheaper "at most k" packing hits the same
   optimal height while leaving trailing columns empty, which is the thing to
   avoid. Height is counted in rows — a group costs its categories plus one for
   its letter head. (CSS `column-count` can do neither: it balances by measured
   height, so it both empties the last column and, once the list outgrows the
   viewport, breaks a group across a column boundary.) */
function balanceIndex(groups: IndexGroup[], columns: number): IndexGroup[][] {
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
  /* "Question ID", not "ID" (the user, 2026-09-16) — and the 100px this column
     had was sized to the old two-letter header. A `thead th` never wraps and
     clips at its width, so the label came first and the width followed it:
     measured, the header (label + sort caret) is 103px, which with the row's
     12px insets is 127 — 130, like the two date columns, fits it and nothing
     more, the way every width in this table is set. */
  { key: "id", label: "Question ID", className: "qb-col-id", width: 130, render: (q) => q.id },
  {
    /* 170 = the longest value ("Match the Following", 145px at 16px Fira Sans)
       plus the header row's 12px insets — the column fits its content and
       nothing more, so the auto-width Question column takes the rest. */
    key: "type", label: "Question Type", className: "qb-col-type", width: 170,
    render: (q) => <span className="qb-type-tag">{longQuestionType(q.type)}</span>,
  },
  {
    /* Every attempt ever made on the question, across its versions — so a
       number here is what makes the row menu offer Archive instead of Delete. */
    /* 110 = the "Attempts" header + its sort chevron (85px) plus the 12px
       insets — same fit-the-content sizing as Question Type; the counts
       themselves are far narrower. */
    key: "attempts", label: "Attempts", className: "qb-col-attempts", width: 110,
    render: (q) => attemptCount(q).toLocaleString(),
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
  /* Both date columns sort (2026-10-03, user), opening newest first; Last
     Modified is also the list's DEFAULT sort, whether or not the column is
     shown. 150 = the longer header + its chevron, matched so the pair line up. */
  { key: "createdOn", label: "Created On", className: "qb-col-date", width: 150, render: (_q, d) => d.created },
  { key: "lastModified", label: "Last Modified", className: "qb-col-date", width: 150, render: (_q, d) => d.modified },
];

export function QuestionBankPage({
  onNewQuestion,
  onEditQuestion,
  onBackToTasks,
  initialQuestions,
  initialHistoryId,
  initialPath,
  restore,
  flash,
  onFlashDone,
}: {
  /** `from` is the bank's current view, for the editor's Cancel to restore. */
  onNewQuestion?: (categoryPath?: string[], type?: QuestionType, from?: QbViewState) => void;
  onEditQuestion?: (question: Question, from?: QbViewState) => void;
  onBackToTasks: () => void;
  initialQuestions?: Question[];
  /** Open straight on the table, scoped to this category path — [category] or
   *  [category, sub-category]. Set when the editor hands back a new question. */
  initialPath?: string[];
  /** Reopen exactly as it was — Cancel out of an editor this page opened. */
  restore?: QbViewState;
  /** A success handed back by the editor ("Question Created"), toasted on arrival. */
  flash?: string | null;
  onFlashDone?: () => void;
  /** Opens straight onto one question's Version History page (the way back
   *  from a version opened in the editor). */
  initialHistoryId?: string;
}) {
  const [categories, setCategories] = useState<Category[]>(seedCategories);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions ?? allQuestions);
  const [rowMenu, setRowMenu] = useState<{ q: Question; rect: DOMRect } | null>(null);
  // The question whose row was clicked, read back in the row preview panel —
  // held by id so the panel follows the question through an archive.
  const [panelId, setPanelId] = useState<string | null>(null);
  // A row menu opened from the panel's kebab: every item closes the panel
  // first, so the editor, page or confirm it opens isn't left under it.
  function closePanelThen(run: () => void) {
    setPanelId(null);
    run();
  }
  /* Row-menu target: the question whose Version History page is open. It is
     held by ID, not as a snapshot — restoring a version bumps the question's
     own `version`, and the page has to see that land. */
  const [historyId, setHistoryId] = useState<string | null>(initialHistoryId ?? null);
  /* Version History's open row: that version, in the row preview panel. */
  const [versionPanel, setVersionPanel] = useState<number | null>(null);
  // Row-menu target: the delete confirm.
  const [deleteQ, setDeleteQ] = useState<Question | null>(null);
  /* Row-menu target: the ARCHIVE confirm. Only the archiving direction stops to
     ask (per the user 2026-09-16) — unarchiving puts a question back in
     circulation, which is the harmless half of the same toggle. */
  const [archiveQ, setArchiveQ] = useState<Question | null>(null);
  /* The open category — or categories: the search's Category: token can add
     more. BARE category labels only; a sub-category is the Sub-Category
     filter's business (`subFilter`), never the scope's — `applyScope` splits
     any mixed list. Empty = all questions. */
  const [selection, setSelection] = useState<string[]>(() =>
    restore ? restore.selection : initialPath?.length ? [initialPath[0]] : [],
  );
  /* Sub-Category filter — "Parent > Sub" paths, so two categories' same-named
     subs ("Heat Pumps") stay distinct. Set by the Sub-Category pill and by the
     sub-category cards over the table; counted by Clear Filters. See
     `filtered` for how it narrows. */
  const [subFilter, setSubFilter] = useState<string[]>(() =>
    restore
      ? restore.subFilter
      : initialPath && initialPath.length > 1
        ? [initialPath.slice(0, 2).join(" > ")]
        : [],
  );
  // The row kebab's Edit / Delete menu and the modals it opens.
  const [catMenu, setCatMenu] = useState<CatMenuState>(null);
  const [catModal, setCatModal] = useState<CatModalState>({ kind: "none" });
  // The last few categories opened — the landing's RECENT row.
  const [recent, setRecent] = useState<string[]>(() => {
    if (restore) return restore.recent;
    // Arriving on a category counts as opening it, like `openCategory`.
    if (!initialPath?.length) return SEED_RECENT;
    const label = initialPath.slice(0, 2).join(" > ");
    return [label, ...SEED_RECENT.filter((l) => l !== label)].slice(0, RECENT_MAX);
  });
  /* Category being given a new Sub-Category (its key). The kebab's Add
     Sub-Category opens the SAME shell New Category uses (2026-09-16) — the
     inline editor that used to sit in the tree card is gone: the two halves of
     one flow were two different controls, and the one in the card lost what you
     had typed to a stray click anywhere in the rail. */
  const [subModal, setSubModal] = useState<string | null>(null);
  /* The New Category modal. Both triggers — the landing index head's plus and
     the "A" shortcut — just open it; it is the shared centred shell, so
     neither needs a ref to anchor to. */
  const [catModalOpen, setCatModalOpen] = useState(false);

  // Landing morph — the page opens as the category browser (the hero search
  // over the A→Z category index) and a category click, a committed search, or
  // the "Question Bank" crumb moves it to and from the questions table.
  // NO wheel gesture here (unlike the other landing pages): the index is a
  // long scrolling list people read, so the wheel has to stay its own — an
  // accidental morph at the foot of the A→Z would be a page they didn't ask for.
  const morph = useLandingMorph(restore ? restore.atTable : !!initialPath?.length, false);
  const atTable = morph.atTable;

  const [query, setQuery] = useState(restore?.query ?? "");
  const [typeFilter, setTypeFilter] = useState<string[]>(restore?.typeFilter ?? []);
  // Archived questions are hidden until the author asks for them.
  const [statusFilter, setStatusFilter] = useState<string[]>(restore?.statusFilter ?? ["Active"]);
  const [gradingFilter, setGradingFilter] = useState<string[]>(restore?.gradingFilter ?? []);
  // Quizzes/Feedback Forms are also set from the search box's Quizzes: /
  // Feedback Form: tokens.
  const [quizFilter, setQuizFilter] = useState<string[]>(restore?.quizFilter ?? []);
  const [formFilter, setFormFilter] = useState<string[]>(restore?.formFilter ?? []);

  // Question (fixed) + Type + Last Modified is the default row (Last Modified
  // on since 2026-10-03, user — it is the default sort, so its column shows
  // the order). Everything else, Attempts included, is opt-in.
  const [columns, setColumns] = useState<QbColumnState>(restore?.columns ?? {
    id: false,
    type: true,
    attempts: false,
    version: false,
    status: false,
    category: false,
    grading: false,
    quizzes: false,
    forms: false,
    createdOn: false,
    lastModified: true,
  });
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useState<QbColumn[]>(
    () => restore?.order ?? QB_COLS.map((d) => d.key),
  );
  const visibleCols = useMemo(() => orderedColumns(QB_COLS, order, columns), [columns, order]);

  const [page, setPage] = useState(restore?.page ?? 1);
  /* Default order: most recently modified first, even with the Last Modified
     column hidden (2026-10-03, user) — so a question just created or imported
     sits at the top of whatever scope it lands in. */
  const [sort, setSort] = useState<{ key: QSortKey; dir: SortDir }>(
    restore?.sort ?? { key: "lastModified", dir: "desc" },
  );

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
  // throw you back to All Questions); the crumb and the landing change it.
  // Its sub-categories ARE a filter (the Sub-Category pill), so they count.
  const appliedCount =
    subFilter.length +
    typeFilter.length +
    statusFilter.length +
    gradingFilter.length +
    quizFilter.length +
    formFilter.length;

  function clearFilters() {
    setSubFilter([]);
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

  // The open category's questions (every question at All Questions).
  const inCategory = useMemo(() => {
    if (selection.length === 0) return questions;
    return questions.filter((q) => selection.includes(q.categoryPath[0]));
  }, [selection, questions]);

  /* Every filter EXCEPT Sub-Category. The sub-category cards count against
     this, so a card's number is exactly the rows its click will show. */
  const preSub = useMemo(() => {
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
      // "None" is a real option in both lists — a question with no links at all
      // matches only through it, never through a named Quiz / Form.
      if (quizFilter.length && !matchesUsage(row.quizzes, quizFilter, NO_QUIZ)) return false;
      if (formFilter.length && !matchesUsage(row.forms, formFilter, NO_FORM)) return false;
      return true;
    });
  }, [inCategory, query, typeFilter, statusFilter, gradingFilter, quizFilter, formFilter]);

  /* Sub-Category narrows the category its picks belong to. A category with no
     picks shows whole when it was opened by name (two categories via the
     search, one narrowed) — but at All Questions nothing was opened, so there
     the picks ARE the scope and everything else drops out. */
  const filtered = useMemo(() => {
    if (subFilter.length === 0) return preSub;
    const picked = new Set(subFilter);
    const narrowed = new Set(subFilter.map(parentOf));
    return preSub.filter((row) =>
      narrowed.has(row.categoryPath[0]) ? picked.has(subPathOf(row)) : selection.length > 0,
    );
  }, [preSub, subFilter, selection]);

  // Created / modified times, worked out once per question rather than per
  // comparison (the seed's come from its mocked version history).
  const times = useMemo(
    () =>
      new Map(
        questions.map((q) => [
          q.id,
          { created: questionCreatedAt(q), modified: questionModifiedAt(q) },
        ]),
      ),
    [questions],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareQuestions(a, b, sort.key, times));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, times]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [selection, subFilter, query, typeFilter, statusFilter, gradingFilter, quizFilter, formFilter, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: QSortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : // A date column opens newest-first; everything else A→Z / low→high.
          { key, dir: key === "lastModified" || key === "createdOn" ? "desc" : "asc" },
    );
  }

  function startCreate(type: QuestionType) {
    // A new question lands where you are: the open category, or the one
    // sub-category its cards / pill have narrowed it to. From the landing it
    // starts with no category — the crumb back there keeps the last scope in
    // state, so only the table may hand it over.
    let path: string[] | undefined;
    if (atTable && selection.length <= 1) {
      const subs = subFilter.filter(
        (l) => selection.length === 0 || parentOf(l) === selection[0],
      );
      if (subs.length === 1) path = subs[0].split(" > ");
      else if (selection.length === 1) path = [selection[0]];
    }
    onNewQuestion?.(path, type, currentView());
  }

  // The view the editor's Cancel brings back — see `QbViewState`.
  function currentView(): QbViewState {
    return {
      atTable,
      selection,
      subFilter,
      query,
      typeFilter,
      statusFilter,
      gradingFilter,
      quizFilter,
      formFilter,
      columns,
      order,
      page,
      sort,
      recent,
      scroll: { index: indexEl?.scrollTop ?? 0, table: tableScrollRef.current?.scrollTop ?? 0 },
    };
  }

  /* "All Questions" — the landing's "Categories · n" heading: drop the scope
     (and the sub-categories that only meant something inside it) and go to the
     table. */
  function openAllQuestions() {
    setSelection([]);
    setSubFilter([]);
    morph.showTable();
  }

  /* Opening a category (from the index or the RECENT row) scopes the table to
     it and moves it to the front of RECENT. A "Parent > Sub" label — a RECENT
     pill for a sub-category — opens the PARENT with the Sub-Category filter
     set, so the title is still the category and the sub is the selected card.
     The other filters are left alone; the sub filter is not, since one
     category's sub-categories mean nothing in the next. */
  function openCategory(label: string) {
    const parent = parentOf(label);
    setSelection([parent]);
    setSubFilter(label === parent ? [] : [label]);
    setRecent((prev) => [label, ...prev.filter((l) => l !== label)].slice(0, RECENT_MAX));
    morph.showTable();
  }

  /* The search box's Category: token hands over a mixed
     list of labels. Split it: every label's parent joins the scope (a sub
     arriving alone still opens its category, so the title never reads "All
     Questions" over one category's rows) and the subs become the Sub-Category
     filter. */
  function applyScope(labels: string[]) {
    setSelection([...new Set(labels.map(parentOf))]);
    setSubFilter([...new Set(labels.filter((l) => l !== parentOf(l)))]);
  }

  /* A sub-category card: make it the only pick — or, when it already is, put
     the category back to All. A pick is recorded in RECENT like any category
     you open (the rail's sub rows did the same). */
  function pickSubCard(label: string) {
    if (subFilter.length === 1 && subFilter[0] === label) {
      setSubFilter([]);
      return;
    }
    setSubFilter([label]);
    setRecent((prev) => [label, ...prev.filter((l) => l !== label)].slice(0, RECENT_MAX));
  }

  // The New Category modal — from the landing index head's plus or "A".
  function openNewCategory() {
    setCatModalOpen(true);
  }

  // Nothing else is mid-flight: no menu, popover or modal.
  const idle =
    catModal.kind === "none" &&
    !catMenu &&
    !catModalOpen &&
    !deleteQ &&
    !archiveQ &&
    !panelId &&
    subModal == null;

  // "C" opens the editor (Multiple Choice) on every screen; "A" opens the New
  // Category modal from both — the landing's index head plus is its only
  // on-screen trigger since the rail went, so the table keeps the key.
  useCreateShortcut(() => startCreate("Multiple choice"), idle);
  useCreateShortcut(openNewCategory, idle, "a");


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

  // Delete a question outright (the row menu's destructive action).
  function deleteQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
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
  }

  /* A rename has to carry the questions with it: rows are matched to the tree by
     LABEL (`categoryPath`), not by key, so renaming the category alone used to
     orphan every question under it — the table went empty and the delete gate
     then read the category as deletable. Selection/recent are re-pointed too. */
  function renameCategory(key: string, label: string) {
    const from = categories.find((c) => c.key === key)?.label;
    setCategories((prev) => prev.map((c) => (c.key === key ? { ...c, label } : c)));
    if (!from || from === label) return;
    setQuestions((prev) =>
      prev.map((q) =>
        q.categoryPath[0] === from
          ? { ...q, categoryPath: [label, ...q.categoryPath.slice(1)] }
          : q,
      ),
    );
    const move = (l: string) =>
      l === from ? label : l.startsWith(`${from} > `) ? `${label}${l.slice(from.length)}` : l;
    setSelection((prev) => prev.map(move));
    setSubFilter((prev) => prev.map(move));
    setRecent((prev) => prev.map(move));
  }

  function renameSubcategory(categoryKey: string, subKey: string, label: string) {
    const cat = categories.find((c) => c.key === categoryKey);
    const from = cat?.subcategories?.find((s) => s.key === subKey)?.label;
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
    if (!cat || !from || from === label) return;
    // Same label-matching rule as renameCategory — move the questions with it.
    setQuestions((prev) =>
      prev.map((q) =>
        q.categoryPath[0] === cat.label && q.categoryPath[1] === from
          ? { ...q, categoryPath: [cat.label, label] }
          : q,
      ),
    );
    const move = (l: string) => (l === `${cat.label} > ${from}` ? `${cat.label} > ${label}` : l);
    setSubFilter((prev) => prev.map(move));
    setRecent((prev) => prev.map(move));
  }

  function deleteCategory(key: string) {
    setCategories((prev) => prev.filter((c) => c.key !== key));
    const label = categories.find((c) => c.key === key)?.label;
    if (label) {
      const drop = (l: string) => l !== label && !l.startsWith(`${label} > `);
      setSelection((prev) => prev.filter(drop));
      setSubFilter((prev) => prev.filter(drop));
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
      setSubFilter((prev) => prev.filter((l) => l !== label));
      setRecent((prev) => prev.filter((l) => l !== label));
    }
  }

  /* Deletion is gated on the questions that actually exist, NOT on the seeded
     `count`: those are the mock figures of a much larger bank (see formatCount),
     so a subcategory the table renders as empty could still carry a count of 31
     and refuse to delete. Counting rows keeps the gate honest with what the user
     can see — and it deliberately ignores the status/type filters, since an
     archived or drafted question still blocks the delete. */
  function questionCount(catLabel: string, subLabel?: string) {
    return questions.filter((q) => {
      const [cat, sub] = q.categoryPath;
      return cat === catLabel && (subLabel === undefined || sub === subLabel);
    }).length;
  }

  // A category can be deleted only when it has no questions and no subcategories.
  function categoryIsEmpty(c: Category) {
    return (
      questionCount(c.label) === 0 && !(c.subcategories && c.subcategories.length > 0)
    );
  }

  function openCatMenu(e: React.MouseEvent, target: CatTarget, start = false) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCatMenu({ target, x: start ? r.left : r.right, y: r.bottom, start });
  }

  // The landing's A→Z index of every category, in as many columns as its
  // own width takes (measured, not the window — the side nav counts).
  const [indexEl, setIndexEl] = useState<HTMLDivElement | null>(null);
  // The table's own scroller — read into the Cancel snapshot, put back below.
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  // Put a restored view's scroll back once both scrollers exist (first layout).
  const scrollRestored = useRef(false);
  useLayoutEffect(() => {
    if (!restore || scrollRestored.current || !indexEl) return;
    scrollRestored.current = true;
    const put = () => {
      indexEl.scrollTop = restore.scroll.index;
      if (tableScrollRef.current) tableScrollRef.current.scrollTop = restore.scroll.table;
    };
    put();
    // Again once the index has re-flowed to its measured column count, which
    // can change its height — set only now, the scroll would come back short.
    // (Not cancelled on cleanup: StrictMode's re-run returns early on the
    // guard, so cancelling here would drop the second pass.)
    requestAnimationFrame(put);
  }, [restore, indexEl]);
  const [indexWidth, setIndexWidth] = useState(1082);
  useLayoutEffect(() => {
    if (!indexEl) return;
    const measure = () => {
      const cs = getComputedStyle(indexEl);
      const w = indexEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (w > 0) setIndexWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(indexEl);
    return () => ro.disconnect();
  }, [indexEl]);
  const indexGrid = indexLayout(indexWidth);
  const indexColumns = useMemo(
    () => balanceIndex(buildIndex(categories), indexGrid.n),
    [categories, indexGrid.n],
  );

  // RECENT shows only labels that still exist (a rename drops its entry).
  const recentShown = useMemo(
    () => recent.filter((l) => categoryLabels.includes(l)),
    [recent, categoryLabels],
  );

  // ─── Working-screen header: the open category is the page title — a
  // sub-category never is (it is a filter: the selected card and the pill say
  // it) — and the landing keeps the page's own name. ───
  const scopeName = selection.length === 1 ? selection[0] : null;
  const openCat = scopeName ? categories.find((c) => c.label === scopeName) ?? null : null;
  const pageTitle = !atTable
    ? "Question Bank"
    : selection.length === 0
      ? "All Questions"
      : scopeName ?? `${selection.length} Categories`;

  /* The Sub-Category pill's options: every sub-category in scope, one section
     per category that has any — just the open category's, or all of them at
     All Questions. Values are "Parent > Sub" paths; the rows show the leaf. */
  const subSections = useMemo(() => {
    const scoped = selection.length
      ? categories.filter((c) => selection.includes(c.label))
      : categories;
    return scoped
      .filter((c) => c.subcategories?.length)
      .map((c) => ({
        label: c.label,
        items: c.subcategories!.map((sc) => `${c.label} > ${sc.label}`),
      }));
  }, [categories, selection]);
  const subOptions = useMemo(() => subSections.flatMap((sec) => sec.items), [subSections]);
  const subLeaves = useMemo(
    () => Object.fromEntries(subOptions.map((l) => [l, l.slice(parentOf(l).length + 3)])),
    [subOptions],
  );

  // Per-sub-category row counts for the cards, under every other filter.
  const subCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of preSub) m.set(subPathOf(q), (m.get(subPathOf(q)) ?? 0) + 1);
    return m;
  }, [preSub]);

  // What the search box treats as already applied: the scope and its picks.
  const scopeLabels = useMemo(() => [...selection, ...subFilter], [selection, subFilter]);

  /* Bulk import (Figma 1116:1321 / 1195:1690 / 1196:1806) — the header's Import
     CSV opens the modal empty; at the landing the whole page is also a drop
     target (the footer line says so), and a file dropped there opens the modal
     already carrying it. `BulkUploadModal` does the reading and checking; the
     page only applies a confirmed import. */
  const [dropActive, setDropActive] = useState(false);
  const [bulk, setBulk] = useState<{ file: File | null } | null>(null);
  /* The page's toast: the import's count, a row or category action landing,
     or a `flash` from the editor. The shared hook restarts the timer on every
     call, so a second action straight after the first isn't cut short. */
  const [setToast, toastNode] = useToast(flash, onFlashDone);
  const draggingFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

  /* Confirmed import: create whatever categories the file names (counts
     included, so the landing index keeps telling the truth), add the questions,
     then open the table scoped to what just arrived. */
  function applyImport(report: ImportReport) {
    const created = questionsFromImport(report.rows, new Set(questions.map((q) => q.id)));

    setCategories((prev) => {
      const next = prev.map((c) => ({
        ...c,
        subcategories: [...(c.subcategories ?? [])],
      }));
      const stamp = Date.now();
      let seq = 0;
      for (const row of report.rows) {
        const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
        let cat = next.find((c) => same(c.label, row.category));
        if (!cat) {
          cat = { key: `cat-${stamp}-${seq++}`, label: row.category, count: 0, subcategories: [] };
          next.push(cat);
        }
        cat.count += 1;
        if (!row.sub) continue;
        let sub = cat.subcategories.find((sc) => same(sc.label, row.sub));
        if (!sub) {
          sub = { key: `sub-${stamp}-${seq++}`, label: row.sub, count: 0 };
          cat.subcategories.push(sub);
        }
        sub.count += 1;
      }
      return next;
    });

    setQuestions((prev) => [...created, ...prev]);
    setBulk(null);
    /* The import always leaves the user on the landing (2026-10-03, user) —
       the index's updated counts show where the questions went. */
    setToast(`${created.length} ${created.length === 1 ? "Question" : "Questions"} Imported`);
  }

  /* Version History opens as its own full page (replacing the list), the way a
     Quiz Task's "View All Attempts" and "Who Paid" do. A question deleted or
     imported out from under it drops the page back to the list. */
  const historyQ = historyId ? questions.find((q) => q.id === historyId) : undefined;
  if (historyId && historyQ) {
    /* View opens that version in the row preview panel — read-only by nature,
       so a past version needs no locked editor or "can't edit" notice (user,
       2026-10-06). A version differs from the current question in its text. */
    const history = versionHistory(historyQ);
    const versionRow = versionPanel !== null ? history.find((v) => v.version === versionPanel) : undefined;
    const versionQ = versionRow
      ? { ...historyQ, text: versionRow.text, version: versionRow.version }
      : null;
    /* The Overview's dates read off the history itself: created = v1's row,
       last modified = when THIS version was saved. */
    const versionDates = versionRow
      ? { created: history[history.length - 1].date, modified: versionRow.date }
      : undefined;
    return (
      <>
        <QuestionVersionsPage
          question={historyQ}
          onBack={() => {
            setVersionPanel(null);
            setHistoryId(null);
          }}
          onBackToTasks={onBackToTasks}
          onView={setVersionPanel}
          panelOpen={versionQ !== null}
        />
        {versionQ && (
          <QuestionPanel
            key={`${versionQ.id}-v${versionQ.version}`}
            q={versionQ}
            dates={versionDates}
            onClose={() => setVersionPanel(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        {/* The whole page is the landing-morph root, so the table chrome can
            ride the same progress as everything else. It opens as the category browser
            — page heading + Import CSV + Create CTA, the totals eyebrow, the
            hero search, the RECENT row, then the A→Z category index — and the
            wheel (or a search, "All Questions", or a category click) morphs it
            into the questions table — full width since the category rail went
            (2026-09-30); the open category's sub-categories are cards over the
            search instead. The "Question Bank" crumb returns to the index. The shared `.tasks.lm`
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
            const file = e.dataTransfer.files?.[0];
            if (file) setBulk({ file });
          }}
        >
          <section className="qb-content">
            {/* The trail lists only the pages above this one (Figma 1356:1828).
                Question Bank has no sidebar entry — it is reached from the
                Tasks header — so "Tasks" is the way back. On the table
                "Question Bank" joins the trail and returns to the category
                index, in place of the footer's old "Back to search". */}
            <nav className="rvc-crumbs" aria-label="Breadcrumb">
              <button className="rvc-crumb" onClick={onBackToTasks} title="Back to Tasks">
                Tasks
              </button>
              {atTable && (
                <>
                  <CrumbChevronIcon />
                  <button
                    className="rvc-crumb"
                    onClick={morph.showLanding}
                    title="Back to the category index"
                  >
                    Question Bank
                  </button>
                </>
              )}
            </nav>
            <header className="tasks-header">
              <div className="rvc-pagehead">
                {/* Page Header + Button (Figma 1441:1859, 2026-10-03): the open
                    category's menu — Edit, Add Sub-Category, Delete — is a 16px
                    kebab 8px after its name (the Hands-On console's
                    open-in-new-tab slot), not a header button. Only the icon
                    hovers: #a8a8a8 → white, and white while its menu is open. */}
                <h1 className="tasks-title rvc-headtitle">
                  {pageTitle}
                  {atTable && openCat && (
                    <button
                      type="button"
                      className={`rvc-headicon ${catMenu?.target.kind === "category" && catMenu.target.categoryKey === openCat.key ? "is-open" : ""}`}
                      aria-label="Category options"
                      onClick={(e) => openCatMenu(e, { kind: "category", categoryKey: openCat.key }, true)}
                    >
                      <RowKebabIcon />
                    </button>
                  )}
                </h1>
              </div>
              <div className="tasks-header-actions">
                {/* Landing only — bulk import lives here, not on the working
                    screens (it fades with the landing chrome). */}
                <button className="cta-quiet qb-import" onClick={() => setBulk({ file: null })}>
                  Import CSV
                </button>
                {/* Straight into the editor as a Multiple Choice question —
                    no type menu (2026-09-29); the editor's Type select still
                    switches it before the first save. */}
                <button className="cta-primary" onClick={() => startCreate("Multiple choice")}>
                  Create Question
                  <span className="cta-kbd">C</span>
                </button>
              </div>
            </header>

            {/* Sub-categories — the Hands-On page's Review Runs cards (Figma
                1393:1794), one per sub-category of the open category after an
                "All Questions" card, each counting the rows its click shows
                under the other filters ("Sub-Category · 25 Questions"). A card is a toggle over the
                Sub-Category pill: it makes that sub the only pick, and clicking
                it again (or All) clears it. Table chrome — it unfolds with the
                morph. The strip ends on the Add Sub-Category card (Figma
                1512:2804). A category without sub-categories has no strip. */}
            {openCat?.subcategories?.length ? (
              <ReviewRunsStrip label={`Sub-Categories in ${openCat.label}`} className="qb-subcards rr--fill">
                  <ReviewRunCard
                    values={["All Questions"]}
                    sub={questionsLine(preSub.length)}
                    chevron={false}
                    selected={subFilter.length === 0}
                    onClick={() => setSubFilter([])}
                  />
                  {openCat.subcategories.map((sc) => {
                    const path = `${openCat.label} > ${sc.label}`;
                    const menuOpen =
                      catMenu?.target.kind === "subcategory" && catMenu.target.subKey === sc.key;
                    return (
                      /* The card is a button, so its Edit / Delete kebab is a
                         sibling laid over the chevron slot rather than nested
                         in it — shown on hover or focus, as the rail rows did. */
                      <div key={sc.key} className={`qb-subcard ${menuOpen ? "is-menu-open" : ""}`}>
                        <ReviewRunCard
                          values={[sc.label]}
                          sub={`Sub-Category · ${questionsLine(subCounts.get(path) ?? 0)}`}
                          chevron={false}
                          selected={subFilter.includes(path)}
                          onClick={() => pickSubCard(path)}
                        />
                        <button
                          type="button"
                          className="qb-subcard-menu"
                          aria-label={`${sc.label} options`}
                          onClick={(e) =>
                            openCatMenu(e, {
                              kind: "subcategory",
                              categoryKey: openCat.key,
                              subKey: sc.key,
                            })
                          }
                        >
                          <RowKebabIcon />
                        </button>
                      </div>
                    );
                  })}
                  <ReviewRunCard
                    variant="add"
                    icon={<AddCardIcon />}
                    values={["Add Sub-Category"]}
                    onClick={() => setSubModal(openCat.key)}
                  />
              </ReviewRunsStrip>
            ) : null}

            <div className="toolbar">
              <QuestionSearch
                questions={questions}
                categoryOptions={categoryLabels}
                selection={scopeLabels}
                onSelectionChange={applyScope}
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

            {/* Landing only: the last categories opened. Carried on the shared
                Quick Filters row (`.lm-quick-label` + `.lm-quick-pill`, Figma
                956:1017/956:1009) the other landings use, so the two landings
                read as one screen. No add-circle glyph on the pills: these
                OPEN a category, they don't add a filter. */}
            {recentShown.length > 0 && (
              <div className="qbl-recent">
                <span className="lm-quick-label">Recent Searches:</span>
                <span className="qbl-recent-pills">
                  {recentShown.map((label) => (
                    <button
                      key={label}
                      className="lm-quick-pill"
                      onClick={() => openCategory(label)}
                    >
                      {label.split(" > ").pop()}
                    </button>
                  ))}
                </span>
              </div>
            )}

            {/* ─── Table-only chrome: unfolds with the table ─── */}
            <div className="qb-filters-row">
              <div className="qb-filters">
                {/* No Category pill: the open category is navigation here, not
                    a filter — the title and the crumb carry it. Its
                    sub-categories ARE one (with the cards above as shortcuts);
                    no pill when nothing in scope has any. */}
                {/* Named for what it spans (2026-10-03, user): across
                    categories (All Questions) it is grouped one section per
                    category, so it reads "Category"; inside one category it
                    only holds that category's subs — "Sub-Category", like the
                    cards above it. */}
                {subOptions.length > 0 && (
                  <MultiSelectPill
                    label={subSections.length > 1 ? "Category" : "Sub-Category"}
                    options={subOptions}
                    sections={subSections.length > 1 ? subSections : undefined}
                    labels={subLeaves}
                    /* 300, not 220: sub-category names run long ("Type III
                       (Low Pressure)") and wrapped in the narrow menu. */
                    width={300}
                    value={subFilter}
                    onApply={setSubFilter}
                    searchPlaceholder={
                      subOptions.length > 8
                        ? subSections.length > 1
                          ? "Search Categories..."
                          : "Search Sub-Categories..."
                        : undefined
                    }
                    tip={
                      subSections.length > 1
                        ? FILTER_TIPS.questionBank.category
                        : FILTER_TIPS.questionBank.subCategory
                    }
                  />
                )}
                <MultiSelectPill
                  label="Question Type"
                  options={TYPE_OPTIONS}
                  value={typeFilter}
                  onApply={setTypeFilter}
                  tip={FILTER_TIPS.questionBank.type}
                />
                <MultiSelectPill
                  label="Status"
                  options={STATUS_OPTIONS}
                  value={statusFilter}
                  onApply={setStatusFilter}
                  tip={FILTER_TIPS.questionBank.status}
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
              {/* ─── Landing layer: the A→Z category index (the Bulk Upload
                  footer under it went 2026-10-01; dropping a CSV on the page
                  still opens the import) ─── */}
              <div className="lm-land qbl-land">
                {/* Index header — Figma 867:2473: "Categories · n" (the "All"
                    went 2026-09-30 — node 1397:1950) and the landing's Add
                    Category affordance over the group hairline. It sits
                    OUTSIDE `.qbl-index` (the scroller) so it holds while a
                    bank with hundreds of categories scrolls under it. */}
                <div className="qbl-index-head">
                  <div className="qbl-index-head-row">
                    {/* The heading is the way into All Questions. */}
                    <button
                      className="qbl-index-head-label"
                      onClick={openAllQuestions}
                      title="Show every question"
                    >
                      Categories · {formatCount(categories.length)}
                    </button>
                    {/* Icon-only in the re-synced node — the 20px plus alone
                        carries "add a category" beside the title. */}
                    <button
                      className={`qbl-index-add-btn ${catModalOpen && !atTable ? "is-open" : ""}`}
                      onClick={openNewCategory}
                      title="Add Category"
                      aria-label="Add Category"
                    >
                      <TreeAddIcon />
                    </button>
                  </div>
                </div>
                <div
                  className="qbl-index lm-scroll"
                  ref={setIndexEl}
                  style={
                    {
                      "--qbl-cols": indexGrid.n,
                      "--qbl-col-w": `${indexGrid.w}px`,
                      "--qbl-gap": `${indexGrid.g}px`,
                    } as React.CSSProperties
                  }
                >
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
                              /* Names ellipsize at this column width, so a
                                 CUT name carries itself as a tooltip —
                                 hovering either the name or the count shows
                                 it in full. A name that fits shows none
                                 (`data-tip-overflow`, 2026-10-01). */
                              data-tip={c.label}
                              data-tip-overflow
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
              </div>

              {/* ─── Table ─── */}
              <div className="lm-table">
              <div
                className="table-xscroll"
                ref={tableScrollRef}
                style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}
              >
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
                        onEdit={() => onEditQuestion?.(q, currentView())}
                        onOpenMenu={(rect) => setRowMenu({ q, rect })}
                        onOpen={() => setPanelId(q.id)}
                        menuOpen={rowMenu?.q.id === q.id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {paged.length === 0 && <TableEmpty />}
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
                  ><PagePrevIcon /></button>
                  <button
                    className="page-btn"
                    disabled={visiblePage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  ><PageNextIcon /></button>
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
          onEdit={() => closePanelThen(() => onEditQuestion?.(rowMenu.q, currentView()))}
          onArchive={() => {
            /* Archiving warns first; unarchiving is immediate — and stays in
               the panel, which follows the question to Archived. */
            if (rowMenu.q.status === "Archived") {
              toggleArchive(rowMenu.q.id);
              setToast("Question Unarchived");
            } else closePanelThen(() => setArchiveQ(rowMenu.q));
          }}
          onVersionHistory={() => closePanelThen(() => setHistoryId(rowMenu.q.id))}
          onDelete={() => closePanelThen(() => setDeleteQ(rowMenu.q))}
        />
      )}

      {/* ─── Row preview panel ─── */}
      {(() => {
        const pq = panelId ? questions.find((q) => q.id === panelId) : undefined;
        if (!pq) return null;
        return (
          <QuestionPanel
            key={pq.id}
            q={pq}
            onClose={() => setPanelId(null)}
            onMore={(rect) => setRowMenu({ q: pq, rect })}
          />
        );
      })()}

      {/* ─── Archive question confirm ─── */}
      {archiveQ && (
        <QuestionArchiveConfirm
          question={archiveQ}
          onConfirm={() => {
            toggleArchive(archiveQ.id);
            setArchiveQ(null);
            setToast("Question Archived");
          }}
          onCancel={() => setArchiveQ(null)}
        />
      )}

      {/* ─── Delete question confirm ─── */}
      {deleteQ && (
        <QuestionDeleteConfirm
          question={deleteQ}
          onConfirm={() => {
            deleteQuestion(deleteQ.id);
            setDeleteQ(null);
            setToast("Question Deleted");
          }}
          onCancel={() => setDeleteQ(null)}
        />
      )}

      {/* ─── Row kebab menu ─── */}
      {catMenu && (() => {
        const target = catMenu.target;
        const cat = categories.find((c) => c.key === target.categoryKey);
        if (!cat) return null;
        const sub =
          target.kind === "subcategory"
            ? cat.subcategories?.find((s) => s.key === target.subKey)
            : undefined;
        const used =
          target.kind === "category"
            ? questionCount(cat.label)
            : questionCount(cat.label, sub?.label);
        const canDelete = target.kind === "category" ? categoryIsEmpty(cat) : used === 0;
        /* Figma 1179:1129 puts the reason INSIDE the disabled row as a 14px
           second line (the same `.u-menu-item-sub` the question-row menu uses)
           rather than in a tooltip, and this is its copy, verbatim. It was
           briefly replaced (2026-09-15) with a line naming which gate was closed
           — "Has 96 questions — …" — because the generic wording was what left
           the user staring at an apparently empty category. That confusion came
           from the GATE reading a stale seeded `count`, though, not from the
           words; once `questionCount` started counting real rows the node's copy
           became accurate, so it is back. */
        const blockedWhy = "Only empty categories can be deleted";
        return (
          <>
            <div className="ind-menu-backdrop" onClick={() => setCatMenu(null)} />
            <div
              className={`u-menu ind-row-menu qb-cat-menu${catMenu.start ? " qb-cat-menu--start" : ""}`}
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
                <span className="u-menu-item-icon"><RowEditIcon /></span>
                <span className="u-menu-item-text">Edit</span>
              </button>
              {/* Category rows only — the tree is two levels deep, so a
                  sub-category has nothing to add under it. It opens the New
                  Sub-Category modal; the group no longer has to be expanded
                  first, because `addSubcategory` opens it to reveal the new row
                  once there is one to reveal. */}
              {target.kind === "category" && (
                <button
                  className="u-menu-item"
                  onClick={() => {
                    setSubModal(target.categoryKey);
                    setCatMenu(null);
                  }}
                >
                  <span className="u-menu-item-icon"><TreeAddSubIcon /></span>
                  <span className="u-menu-item-text">Add Sub-Category</span>
                </button>
              )}
              <button
                className="u-menu-item u-menu-item--danger"
                disabled={!canDelete}
                onClick={() => {
                  if (!canDelete) return;
                  setCatModal({ kind: "delete", target });
                  setCatMenu(null);
                }}
              >
                <span className="u-menu-item-icon"><RowDeleteIcon /></span>
                <span className="u-menu-item-text">
                  <span>Delete</span>
                  {!canDelete && blockedWhy && (
                    <span className="u-menu-item-sub">{blockedWhy}</span>
                  )}
                </span>
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
            description="Renaming keeps every question and Sub-Category inside it."
            submitLabel="Save Category"
            duplicateMessage="A category with this name already exists."
            defaultValue={cat.label}
            existingNames={categories
              .filter((c) => c.key !== catModal.categoryKey)
              .map((c) => c.label.toLowerCase())}
            onSubmit={(label) => {
              renameCategory(catModal.categoryKey, label);
              setCatModal({ kind: "none" });
              setToast("Category Updated");
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
            title="Rename Sub-Category"
            description={`In ${parent.label}. Renaming keeps every question inside it.`}
            submitLabel="Save Sub-Category"
            duplicateMessage="A Sub-Category with this name already exists."
            defaultValue={sub.label}
            existingNames={(parent.subcategories ?? [])
              .filter((s) => s.key !== catModal.subKey)
              .map((s) => s.label.toLowerCase())}
            onSubmit={(label) => {
              renameSubcategory(catModal.categoryKey, catModal.subKey, label);
              setCatModal({ kind: "none" });
              setToast("Sub-Category Updated");
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
              setToast(target.kind === "category" ? "Category Deleted" : "Sub-Category Deleted");
            }}
            onCancel={() => setCatModal({ kind: "none" })}
          />
        );
      })()}

      {/* ─── New Category — the shared modal (Figma 483:588) ─── */}
      {catModalOpen && (
        <NewCategoryModal
          existingNames={categories.map((c) => c.label.toLowerCase())}
          onCreate={(label) => {
            addCategory(label);
            setCatModalOpen(false);
            setToast("Category Created");
            // A new category opens straight away (2026-10-03, user), ready
            // for its first question or Sub-Category.
            openCategory(label);
          }}
          onCancel={() => setCatModalOpen(false)}
        />
      )}

      {/* ─── New Sub-Category — the same shell, scoped to one category ─── */}
      {subModal != null && (() => {
        const parent = categories.find((c) => c.key === subModal);
        if (!parent) return null;
        return (
          <NewCategoryModal
            parent={parent.label}
            existingNames={(parent.subcategories ?? []).map((s) => s.label.toLowerCase())}
            onCreate={(label) => {
              addSubcategory(parent.key, label);
              setSubModal(null);
              setToast("Sub-Category Created");
            }}
            onCancel={() => setSubModal(null)}
          />
        );
      })()}

      {/* ─── Bulk Upload — pick → check → import (Figma 1116:1321) ─── */}
      {bulk && (
        <BulkUploadModal
          categories={categories}
          initialFile={bulk.file}
          onClose={() => setBulk(null)}
          onImport={applyImport}
        />
      )}
      {toastNode}

    </div>
  );
}

/* New Category / New Sub-Category — the app's standard modal (`PrmModal`,
   Figma 483:588) rather than the anchored card design S4 drew: a Name field
   over the shell's own Cancel / Create footer (the optional Trade Group select
   the popover carried was dropped 2026-09-10, along with `Category.tradeGroup`
   and the `TRADE_GROUPS` list behind it). It replaced the popover on
   2026-09-10, which is why no trigger needs a ref — the landing index head's
   plus and the "A" shortcut just open it.
   ONE component for both halves of the flow (2026-09-16): `parent` is the
   category a Sub-Category is being added to, and it only moves the copy —
   title, footer verb, the duplicate message and the line under the title, which
   names the parent, so the modal opened from the header's category menu still
   says where the new row will land. Uniqueness is scoped by the caller: categories against the
   tree's top level, sub-categories against that one parent's children.
   Enter submits from the name field and Esc dismisses (PrmModal itself only
   closes on the overlay and the close glyph). */
function NewCategoryModal({
  parent,
  existingNames,
  onCreate,
  onCancel,
}: {
  parent?: string;
  existingNames: string[];
  onCreate: (label: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const isDuplicate = !!trimmed && existingNames.includes(trimmed.toLowerCase());
  // Soft limit (data/fieldLimits.ts): typing runs on, creating waits.
  const isValid = !!trimmed && !isDuplicate && !isOver(NAME_MAX, name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function submit() {
    if (isValid) onCreate(trimmed);
  }

  const noun = parent ? "Sub-Category" : "Category";

  return (
    <PrmModal
      title={`New ${noun}`}
      description={
        parent
          ? `A new Sub-Category under ${parent}`
          : "Categories and Sub-Categories group questions in the Question Bank"
      }
      confirmLabel={`Create ${noun}`}
      confirmDisabled={!isValid}
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            Name<span className="prm-req">*</span>
            {isDuplicate && (
              <span className="form-label-error">
                {parent
                  ? `${parent} already has a Sub-Category with this name.`
                  : "A category with this name already exists."}
              </span>
            )}
            {/* Admin-only name — learners never see it, so no "will get
                truncated" tier: red past 128 only (2026-10-03, user). */}
            <LimitError max={NAME_MAX} values={[name]} warn={false} />
          </span>
          <LimitedInput
            max={NAME_MAX}
            warn={false}
            autoFocus
            className={`form-input${isDuplicate ? " has-error" : ""}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder={parent ? "Walk-In Coolers" : "Commercial Kitchen Equipment"}
          />
        </div>
      </div>
    </PrmModal>
  );
}

/* Rename Category / Sub-Category — the same shared shell (`PrmModal`,
   Figma 483:588) the New Category modal uses. It ran on the older, narrower
   `.pm-*` card until 2026-09-15, which made the two halves of the same flow
   two different sizes; the `.pm-*` markup is gone from this page now.
   Enter submits from the name field and Esc dismisses (PrmModal itself only
   closes on the overlay and the close glyph). */
function CatNameModal({
  title,
  description,
  submitLabel,
  defaultValue,
  existingNames,
  duplicateMessage,
  onSubmit,
  onCancel,
}: {
  title: string;
  description: string;
  submitLabel: string;
  defaultValue: string;
  existingNames: string[];
  duplicateMessage: string;
  onSubmit: (label: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const trimmed = value.trim();
  const isDuplicate = !!trimmed && existingNames.includes(trimmed.toLowerCase());
  // Soft limit (data/fieldLimits.ts): typing runs on, renaming waits.
  const isValid = !!trimmed && !isDuplicate && !isOver(NAME_MAX, value);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function submit() {
    if (isValid) onSubmit(trimmed);
  }

  return (
    <PrmModal
      title={title}
      description={description}
      confirmLabel={submitLabel}
      confirmDisabled={!isValid}
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            Name<span className="prm-req">*</span>
            {isDuplicate && <span className="form-label-error">{duplicateMessage}</span>}
            {/* Admin-only name — learners never see it, so no "will get
                truncated" tier: red past 128 only (2026-10-03, user). */}
            <LimitError max={NAME_MAX} values={[value]} warn={false} />
          </span>
          <LimitedInput
            max={NAME_MAX}
            warn={false}
            autoFocus
            className={`form-input${isDuplicate ? " has-error" : ""}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="EPA 608"
          />
        </div>
      </div>
    </PrmModal>
  );
}

/* Archive Question — the shared confirm shell (`PrmModal`, Figma 483:588), the
   same one Delete Question uses below. **Not the `danger` variant**: archiving
   is reversible from the same menu, and spending the red CTA on it would leave
   nothing to distinguish the one action that cannot be undone.
   **One sentence, no body** (the user, 2026-09-16: "just a simple confirmation
   message, none of these bullet points"). It briefly carried a three-item
   consequence list and the question's full text, which made a reversible action
   look heavier than the irreversible one below it. Delete keeps its list because
   it has something to enumerate — the Forms a deletion would break — and keeps
   the quoted text because nothing undoes it. Here the ID is enough: the row you
   opened the menu on is still on screen behind the card. */
function QuestionArchiveConfirm({
  question: q,
  onConfirm,
  onCancel,
}: {
  question: Question;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <PrmModal
      title="Archive Question?"
      confirmLabel="Archive Question"
      doubleConfirm={
        <>
          <strong>{q.id}</strong> will be archived and hidden from the Question Bank
          list.
        </>
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="prm-content">
        Archive <strong>{q.id}</strong>? You can unarchive it from the same menu at
        any time.
      </p>
    </PrmModal>
  );
}

/* Delete Question — the row menu's destructive action. It is only reachable for
   a question with no Quiz history at all (see `blockDelete`), so the list here
   names Feedback Form links only; a question in a Quiz is archived, not deleted. */
function QuestionDeleteConfirm({
  question: q,
  onConfirm,
  onCancel,
}: {
  question: Question;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const links = q.forms.map((n) => ({ kind: "Feedback Form", name: n }));
  return (
    <PrmModal
      title="Delete Question?"
      danger
      confirmLabel="Delete Question"
      doubleConfirm={
        <>
          <strong>{q.id}</strong> and its version history will be permanently deleted. This
          can't be undone.
        </>
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="prm-content">
        Delete <strong>{q.id}</strong> — “{q.text}”? This can't be undone, and its
        version history goes with it.
      </p>
      <ul className="ind-modal-list">
        {links.length === 0 ? (
          <li>Not used in any Feedback Form — nothing else points at it.</li>
        ) : (
          links.map((l) => (
            <li key={`${l.kind}-${l.name}`}>
              Removed from {l.kind} <strong>{l.name}</strong>.
            </li>
          ))
        )}
      </ul>
    </PrmModal>
  );
}

/* Delete Category / Sub-Category — the shared shell's danger variant, matching
   Delete Question above (it used to run on the narrower `.pm-*` card). */
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
  const noun = isCategory ? "Category" : "Sub-Category";
  return (
    <PrmModal
      title={`Delete ${noun}?`}
      danger
      confirmLabel={`Delete ${noun}`}
      doubleConfirm={
        <>
          <strong>{label}</strong> will be permanently deleted. This can't be undone.
        </>
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="prm-content">
        Delete <strong>{label}</strong>? This can't be undone.
      </p>
      <ul className="ind-modal-list">
        <li>
          This {noun.toLowerCase()} is empty — no questions
          {isCategory ? " or sub-categories" : ""} will be affected.
        </li>
      </ul>
    </PrmModal>
  );
}

/* The shared width rule (`TableCols`): Question and every visible column keep
   their content-sized base widths (summed into --table-min) and share the
   slack in proportion; only the 3-dot gutter stays fixed. */
function QbColGroup({ cols }: { cols: QbColMeta[] }) {
  return (
    <TableCols
      data={[QUESTION_COL_WIDTH, ...cols.map((c) => c.width)]}
      trail={[ACTIONS_COL_WIDTH]}
    />
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

// One "Used in" cell — lists the quiz or form names the question is used in,
// truncated to the first name with a "+N more" tail (full list in the tooltip).
function UsageNames({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  const [first, ...rest] = items;
  return (
    <span className="qb-usage-main" title={items.join(", ")}>
      {first}
      {rest.length > 0 && (
        <>{" "}<span className="used-extra">+{rest.length}</span></>
      )}
    </span>
  );
}

function QuestionRow({
  q,
  cols,
  onEdit,
  onOpenMenu,
  onOpen,
  menuOpen,
}: {
  q: Question;
  /** Visible optional columns, already in the user's order. */
  cols: QbColMeta[];
  onEdit: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** Row click — opens the question's preview panel. Row buttons stop propagation. */
  onOpen: () => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const isArchived = q.status === "Archived";
  const dates = questionDates(q);
  return (
    <tr className={`qb-row ${isArchived ? "task-dim" : ""} ${menuOpen ? "menu-open" : ""}`} onClick={onOpen}>
      <td className="qb-col-question">
        <div className="qb-q-cell">
          <div className="qb-q-text">{q.text}</div>
          {isArchived && <span className="pr-name-flag pr-name-flag--grey">Archived</span>}
        </div>
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

/** A question's row preview panel (Figma 1514:2860, drawn from a question):
 *  Overview, Answers and the Quizzes and Feedback Forms using it, as
 *  accordions, then its attempts as Activity. The blank preview column is
 *  where the old "Preview as Learner" went. */
/** "A", "B"… for an option's position, as the editor letters them. */
const letterOf = (i: number) => "ABCDEFGHIJ"[i] ?? String(i + 1);

function QuestionPanel({
  q,
  dates: datesProp,
  onClose,
  onMore,
}: {
  q: Question;
  /** Created / Last Modified, when the caller knows better than `q` does — a
   *  past version shown from Version History. */
  dates?: { created: string; modified: string };
  onClose: () => void;
  /** The row menu. A past version (Version History) has none — Edit, Archive
   *  and Delete act on the current question. */
  onMore?: (rect: DOMRect) => void;
}) {
  const dates = datesProp ?? questionDates(q);
  const [category, ...subs] = q.categoryPath;
  const lines = (names: string[]) => names.length > 0 && names.map((n) => <div key={n}>{n}</div>);
  /* Answers (user, 2026-10-07): a Short Answer has none to show; a Linear
     Scale and a File Upload read back as label/value pairs; the option types
     keep the shared read-only list. */
  const answers =
    q.type === "Short answer" ? null : q.scale ? (
      <ConfirmCard
        title="Answers"
        fillBlanks
        rows={[
          ["Min. Value", String(q.scale.min)],
          ["Max. Value", String(q.scale.max)],
          [`Label for ${q.scale.min}`, q.scale.minLabel],
          [`Label for ${q.scale.max}`, q.scale.maxLabel],
        ]}
      />
    ) : q.fileRules ? (
      <ConfirmCard
        title="Answers"
        fillBlanks
        rows={[
          ["Max. Files Allowed", String(q.fileRules.maxFiles)],
          ["Max. File Size", `${q.fileRules.maxSizeMb} MB`],
        ]}
      />
    ) : q.options && q.options.length > 0 ? (
      /* Multiple choice / multi-select: "Option A"… one per line, then
         "Correct Answer" as the letters graded above 0 ("A, B"); an ungraded
         question has none, so "-". */
      <ConfirmCard
        title="Answers"
        fillBlanks
        rows={[
          ...q.options.map((o, i): [string, string] => [`Option ${letterOf(i)}`, o.text]),
          [
            "Correct Answer",
            q.options
              .map((o, i) => (o.grade > 0 ? letterOf(i) : ""))
              .filter(Boolean)
              .join(", "),
          ],
        ]}
      />
    ) : q.type === "True/False" ? (
      <ConfirmCard
        title="Answers"
        fillBlanks
        rows={[["Correct Answer", q.tfAnswer === undefined ? "" : q.tfAnswer ? "True" : "False"]]}
      />
    ) : q.pairs && q.pairs.length > 0 ? (
      /* Match the Following: the editor's ANSWER side is the label here and
         its QUESTION side the value — the question side is the one that can
         carry formatting and images. A spare answer with no question reads
         "-". */
      <ConfirmCard
        title="Answers"
        fillBlanks
        rows={q.pairs.map((p): [string, string] => [p.right, p.left])}
      />
    ) : null;
  /* No Activity accordion on a question (user, 2026-10-07). */
  return (
    <PreviewPanel
      title={q.text}
      subtitle={longQuestionType(q.type)}
      onMore={onMore}
      onClose={onClose}
    >
      <ConfirmCard
        title="Overview"
        fillBlanks
        rows={[
          ["Question Type", longQuestionType(q.type)],
          ["Status", q.status],
          ["Category", category],
          ["Sub-Category", subs.join(" > ")],
          ["Grading", isGraded(q) ? "Graded" : "Ungraded"],
          // Only types with an order to shuffle carry the setting at all.
          ...(q.options?.length || q.pairs?.length
            ? [["Randomize Options", q.randomise ? "On" : "Off"] as [string, string]]
            : []),
          ["Spanish Translation", q.hasSpanish ? "Complete" : "Missing"],
          ["Version", `v${q.version}`],
          ["Created On", dates.created],
          ["Last Modified", dates.modified],
        ]}
      />
      {answers}
      {/* One "Used In" accordion for both kinds of use (user, 2026-10-07). */}
      <ConfirmCard
        title="Used In"
        fillBlanks
        rows={[
          ["Quizzes", lines(q.quizzes)],
          ["Feedback Forms", lines(q.forms)],
        ]}
      />
    </PreviewPanel>
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
  onDelete,
}: {
  q: Question;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onVersionHistory: () => void;
  onDelete: () => void;
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
    opts?: { disabled?: boolean; title?: string; note?: string; danger?: boolean },
  ) => (
    <button
      className={`u-menu-item${opts?.danger ? " u-menu-item--danger" : ""}`}
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
  /* Archive and Delete are ONE SLOT again (per the user 2026-09-16): "If Delete
     is shown, don't show Archive." The two had sat side by side since the
     2026-09-15 re-sync of Figma 1085:1082, but they are not peers — Archive
     exists precisely BECAUSE a question can't be deleted ("archive it instead"
     was the blocked row's own copy), so a menu offering both was offering the
     consolation prize next to the real thing.
       · Delete is gated on QUIZ history (per the user 2026-09-15): a question
         linked to a Quiz, or that anyone has ever answered, can never be
         deleted — the attempts have to keep resolving to it. When that gate is
         closed the row is NOT DRAWN AT ALL (2026-09-16), rather than disabled
         with a reason: Archive's gate is a to-do list ("unlink it and come
         back"), Delete's is permanent for the life of the question, so a
         dead control would never become live. 1085:1082 draws no disabled
         Delete either.
       · Archive takes the slot whenever Delete has vacated it, and keeps its
         own disabled-with-a-reason state for a question still sitting in a Quiz
         or Form (the node's reason line).
     **`isArchived` is the exception, and it is not a loophole.** An archived
     question's row reads "Unarchive" — the way BACK, not an alternative to
     deleting — so it is always drawn, even beside Delete. Dropping it would
     strand a deletable archived question in Archived with deletion as its only
     exit.
     A question with only Feedback Form links and no responses is still
     deletable; the confirm names those links. */
  const links = q.quizzes.length + q.forms.length;
  const attempts = attemptCount(q);
  const blockDelete = q.quizzes.length > 0 || attempts > 0;
  const blockArchive = !isArchived && links > 0;
  const showArchive = isArchived || blockDelete;

  return (
    <div
      ref={ref}
      className="u-menu qb-row-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Figma 1085:1082 "3-Dot Menu - Question Bank" — the literal frame, which
          draws Archive twice (enabled, then disabled with its reason) to show
          both states of one row. No heading and no dividers; the open row is
          identified by its held hover state. */}
      {item(<RowEditIcon />, "Edit", onEdit)}
      {/* Nothing to show at v1 — there is no earlier version to compare to. */}
      {q.version > 1 && item(<MenuHistoryIcon />, "Version History", onVersionHistory)}
      {showArchive &&
        item(
          <MenuArchiveOffIcon />,
          isArchived ? "Unarchive" : "Archive",
          onArchive,
          blockArchive
            ? {
                disabled: true,
                note: "Must be removed from all Quizzes and Feedback Forms",
              }
            : undefined,
        )}
      {!blockDelete && item(<RowDeleteIcon />, "Delete", onDelete, { danger: true })}
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
            // "None" leads both usage lists (Figma 1201:2151) — it is the only
            // way to ask for questions that aren't linked anywhere, and the
            // muted clause says so, since the bare word doesn't.
            {
              key: "quizzes",
              label: "Quizzes",
              groups: [{ items: [NO_QUIZ, ...quizNames] }],
              hints: { [NO_QUIZ]: NO_QUIZ_HINT },
              searchPlaceholder: "Search Quizzes...",
            },
            {
              key: "forms",
              label: "Feedback Forms",
              groups: [{ items: [NO_FORM, ...formNames] }],
              hints: { [NO_FORM]: NO_FORM_HINT },
              searchPlaceholder: "Search Feedback Forms...",
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
  tip,
  sections,
  labels,
  width,
}: {
  label: string;
  options: string[];
  value: string[];
  onApply: (v: string[]) => void;
  searchPlaceholder?: string;
  /** Hover line saying what this filter does — see `PillTrigger`. */
  tip?: string;
  /** Titled groups instead of one flat list (Sub-Category at All Questions:
   *  one per category). Defaults to a single untitled section of `options`. */
  sections?: { label?: string; items: string[] }[];
  /** Row / pill text when it differs from the value (a sub-category's value is
   *  its "Parent > Sub" path; it reads as the leaf). */
  labels?: Record<string, string>;
  /** Menu width. Defaults to 220, or 300 with a search box. */
  width?: number;
}) {
  const shown =
    value.length === 1 ? labels?.[value[0]] ?? value[0] : summarize(value, options);
  return (
    <Dropdown
      width={width ?? (searchPlaceholder ? 300 : 220)}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={label}
          value={shown}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
          tip={tip}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={sections ?? [{ items: options }]}
          labels={labels}
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
