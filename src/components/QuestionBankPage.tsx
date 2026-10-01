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
  shortQuestionType,
  QUESTION_TYPE_OPTIONS,
  supportsGrading,
  type Category,
  type Question,
  type QuestionStatus,
  type QuestionType,
  type Subcategory,
} from "../data/questionBank";
import { MenuArchiveOffIcon, MenuHistoryIcon, MenuPreviewIcon, RowEditIcon, RowKebabIcon, SortIcon, TreeAddIcon, TreeAddSubIcon, RowDeleteIcon, CrumbChevronIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { FILTER_TIPS } from "../data/filterTips";
import { CascadingMultiSelect, EditColumnsButton, PillTrigger, SectionedMultiSelect, summarize, useColumnOrder, orderedColumns } from "./Filters";
import { PrmModal } from "./PrmModal";
import { BulkUploadModal } from "./BulkUploadModal";
import { CopiedToast } from "./CopiedToast";
import { questionsFromImport, type ImportReport } from "../data/questionImport";
import { ReviewRunsStrip, ReviewRunGroup, ReviewRunCard } from "./ReviewRuns";
import { QuestionSearch } from "./QuestionSearch";
import { QuestionVersionsPage } from "./QuestionVersionsPage";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { useLandingMorph } from "../hooks/useLandingMorph";

const PAGE_SIZE = 50;

/* The seed set is a sample of a much larger bank, so the landing's counts are
   the mock figures the category counts add up to — not `questions.length`. */
const formatCount = (n: number) => n.toLocaleString("en-US");

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

const QB_FIXED_COLUMNS = [{ label: "Question" }];

// Roomy, because the question text is allowed to run to a second line.
const QUESTION_COL_WIDTH = 420;
const ACTIONS_COL_WIDTH = 40;

function escapeHtml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!),
  );
}

/* "Preview as Learner" — a PLACEHOLDER tab for now (per the user 2026-09-10):
   the learner player lives outside this prototype, so the row menu opens the
   destination it will eventually be, naming the question it was asked for.
   Same `window.open` + `document.write` stand-in the Users page's "Login As"
   uses, so the two fake sessions look like siblings. */
function previewAsLearner(q: Question) {
  /* No "noopener": with that feature set, window.open returns NULL in Chrome
     and Safari, and there would be no handle left to write the page into. The
     usual reason for it doesn't apply here — the tab loads no external
     document, only the markup below. */
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
<title>Preview — ${escapeHtml(q.id)}</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0b0b0c;color:#e7e7e8;font-family:"Fira Sans",-apple-system,system-ui,sans-serif}
.bar{background:#7a3a18;color:#ffd9c2;padding:10px 20px;font-size:14px;font-weight:600}
.wrap{max-width:640px;margin:0 auto;padding:60px 24px}
.meta{font-size:14px;color:#7a7a7a;margin:0 0 10px}
h1{font-size:22px;line-height:1.45;margin:0 0 24px;font-weight:500}
p{color:#9a9aa0;line-height:1.6}</style></head>
<body><div class="bar">Learner preview — placeholder</div>
<div class="wrap"><p class="meta">${escapeHtml(q.id)} · ${escapeHtml(longQuestionType(q.type))} · v${q.version}</p>
<h1>${escapeHtml(q.text)}</h1>
<p>This is where the question renders the way a learner meets it inside a Quiz or a Feedback Form. The learner player isn't wired into this prototype yet.</p></div></body></html>`);
  win.document.close();
}

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
  | "usage";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<QuestionStatus, number> = {
  Active: 0,
  Archived: 1,
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

type CatMenuState = { target: CatTarget; x: number; y: number } | null;

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
  { key: "createdOn", label: "Created On", className: "qb-col-date", width: 130, sortable: false, render: (_q, d) => d.created },
  { key: "lastModified", label: "Last Modified", className: "qb-col-date", width: 130, sortable: false, render: (_q, d) => d.modified },
];

export function QuestionBankPage({
  onNewQuestion,
  onEditQuestion,
  onBackToTasks,
  initialQuestions,
  initialHistoryId,
}: {
  onNewQuestion?: (categoryPath?: string[], type?: QuestionType) => void;
  /* `atVersion` is set when the editor is opened from the Version History
     page. The question's own current version opens as a normal edit; any
     older one opens loaded with that version's content and locked. Either
     way the editor's way back out is the history page. */
  onEditQuestion?: (question: Question, atVersion?: number) => void;
  onBackToTasks: () => void;
  initialQuestions?: Question[];
  /** Opens straight onto one question's Version History page (the way back
   *  from a version opened in the editor). */
  initialHistoryId?: string;
}) {
  const [categories, setCategories] = useState<Category[]>(seedCategories);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions ?? allQuestions);
  const [rowMenu, setRowMenu] = useState<{ q: Question; rect: DOMRect } | null>(null);
  /* Row-menu target: the question whose Version History page is open. It is
     held by ID, not as a snapshot — restoring a version bumps the question's
     own `version`, and the page has to see that land. */
  const [historyId, setHistoryId] = useState<string | null>(initialHistoryId ?? null);
  // Row-menu target: the delete confirm. (Preview opens its own tab.)
  const [deleteQ, setDeleteQ] = useState<Question | null>(null);
  /* Row-menu target: the ARCHIVE confirm. Only the archiving direction stops to
     ask (per the user 2026-09-16) — unarchiving puts a question back in
     circulation, which is the harmless half of the same toggle. */
  const [archiveQ, setArchiveQ] = useState<Question | null>(null);
  /* The open category — or categories: the search's Category: token can add
     more. BARE category labels only; a sub-category is the Sub-Category
     filter's business (`subFilter`), never the scope's — `applyScope` splits
     any mixed list. Empty = all questions. */
  const [selection, setSelection] = useState<string[]>([]);
  /* Sub-Category filter — "Parent > Sub" paths, so two categories' same-named
     subs ("Heat Pumps") stay distinct. Set by the Sub-Category pill and by the
     sub-category cards over the table; counted by Clear Filters. See
     `filtered` for how it narrows. */
  const [subFilter, setSubFilter] = useState<string[]>([]);
  // The row kebab's Edit / Delete menu and the modals it opens.
  const [catMenu, setCatMenu] = useState<CatMenuState>(null);
  const [catModal, setCatModal] = useState<CatModalState>({ kind: "none" });
  // The last few categories opened — the landing's RECENT row.
  const [recent, setRecent] = useState<string[]>(SEED_RECENT);
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
  const morph = useLandingMorph(false, false);
  const atTable = morph.atTable;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  // Archived questions are hidden until the author asks for them.
  const [statusFilter, setStatusFilter] = useState<string[]>(["Active"]);
  const [gradingFilter, setGradingFilter] = useState<string[]>([]);
  // Quizzes/Feedback Forms are also set from the search box's Quizzes: /
  // Feedback Form: tokens.
  const [quizFilter, setQuizFilter] = useState<string[]>([]);
  const [formFilter, setFormFilter] = useState<string[]>([]);

  // Question (fixed) + Type is the whole default row — everything else,
  // Attempts included, is opt-in from Edit Columns.
  const [columns, setColumns] = useState<QbColumnState>({
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
  const visibleColCount = visibleCols.length + 2; // Question + actions

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

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareQuestions(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

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
        : { key, dir: "asc" },
    );
  }

  function startCreate(type: QuestionType) {
    // A new question lands where you are: the open category, or the one
    // sub-category its cards / pill have narrowed it to.
    let path: string[] | undefined;
    if (selection.length === 1) {
      const subs = subFilter.filter((l) => parentOf(l) === selection[0]);
      path = subs.length === 1 ? subs[0].split(" > ") : [selection[0]];
    }
    onNewQuestion?.(path, type);
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

  /* The search box's Category: token and the bulk import hand over a mixed
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

  function openCatMenu(e: React.MouseEvent, target: CatTarget) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCatMenu({ target, x: r.right, y: r.bottom });
  }

  // The landing's A→Z index of every category.
  const indexColumns = useMemo(() => balanceIndex(buildIndex(categories)), [categories]);

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
  const [toast, setToast] = useState<string | null>(null);
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
    applyScope(report.rows.map((r) => r.category));
    setPage(1);
    setBulk(null);
    morph.showTable();
    setToast(`${created.length} ${created.length === 1 ? "Question" : "Questions"} Imported`);
  }

  /* Version History opens as its own full page (replacing the list), the way a
     Quiz Task's "View All Attempts" and "Who Paid" do. A question deleted or
     imported out from under it drops the page back to the list. */
  const historyQ = historyId ? questions.find((q) => q.id === historyId) : undefined;
  if (historyId && historyQ) {
    return (
      <QuestionVersionsPage
        question={historyQ}
        onBack={() => setHistoryId(null)}
        onBackToTasks={onBackToTasks}
        onView={(version) => onEditQuestion?.(historyQ, version)}
      />
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
                <h1 className="tasks-title">{pageTitle}</h1>
              </div>
              <div className="tasks-header-actions">
                {/* Landing only — bulk import lives here, not on the working
                    screens (it fades with the landing chrome). */}
                <button className="cta-quiet qb-import" onClick={() => setBulk({ file: null })}>
                  Import CSV
                </button>
                {/* The open category's own menu — Edit, Add Sub-Category, Delete
                    — which lived on its rail row until the rail went. The same
                    quiet icon button the Industries hub puts its menu on. */}
                {atTable && openCat && (
                  <button
                    className={`cta-quiet cta-quiet--icon ${catMenu?.target.kind === "category" && catMenu.target.categoryKey === openCat.key ? "is-open" : ""}`}
                    aria-label="Category options"
                    onClick={(e) => openCatMenu(e, { kind: "category", categoryKey: openCat.key })}
                  >
                    <RowKebabIcon />
                  </button>
                )}
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
                "All Sub-Categories" card, each counting the rows its click
                shows under the other filters. A card is a toggle over the
                Sub-Category pill: it makes that sub the only pick, and clicking
                it again (or All) clears it. Table chrome — it unfolds with the
                morph. A category without sub-categories has no strip. */}
            {openCat?.subcategories?.length ? (
              <ReviewRunsStrip label={`Sub-Categories in ${openCat.label}`} className="qb-subcards">
                <ReviewRunGroup>
                  <ReviewRunCard
                    count={preSub.length}
                    values={["All Sub-Categories"]}
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
                          count={subCounts.get(path) ?? 0}
                          values={[sc.label]}
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
                </ReviewRunGroup>
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
                {subOptions.length > 0 && (
                  <MultiSelectPill
                    label="Sub-Category"
                    options={subOptions}
                    sections={subSections.length > 1 ? subSections : undefined}
                    labels={subLeaves}
                    /* 300, not 220: sub-category names run long ("Type III
                       (Low Pressure)") and wrapped in the narrow menu. */
                    width={300}
                    value={subFilter}
                    onApply={setSubFilter}
                    searchPlaceholder={
                      subOptions.length > 8 ? "Search Sub-Categories..." : undefined
                    }
                    tip={FILTER_TIPS.questionBank.subCategory}
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
              {/* ─── Landing layer: the A→Z category index, and the drop-a-CSV
                  line pinned under it ─── */}
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
                    {/* Icon-only in the re-synced node — the 16px plus alone
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
                              /* Names ellipsize at this column width, so the
                                 row carries its own name as a tooltip (the app
                                 adopts native `title` into the shared tip) —
                                 hovering either the name or the count shows
                                 the category in full. */
                              title={c.label}
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
          onEdit={() => onEditQuestion?.(rowMenu.q)}
          onPreview={() => previewAsLearner(rowMenu.q)}
          onArchive={() => {
            /* Archiving warns first; unarchiving is immediate. */
            if (rowMenu.q.status === "Archived") toggleArchive(rowMenu.q.id);
            else setArchiveQ(rowMenu.q);
          }}
          onVersionHistory={() => setHistoryId(rowMenu.q.id)}
          onDelete={() => setDeleteQ(rowMenu.q)}
        />
      )}

      {/* ─── Archive question confirm ─── */}
      {archiveQ && (
        <QuestionArchiveConfirm
          question={archiveQ}
          onConfirm={() => {
            toggleArchive(archiveQ.id);
            setArchiveQ(null);
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
              className="u-menu ind-row-menu qb-cat-menu"
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
            description="Renaming keeps every question and sub-category inside it."
            submitLabel="Save Category"
            duplicateMessage="A category with this name already exists."
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
            title="Rename Sub-Category"
            description={`In ${parent.label}. Renaming keeps every question inside it.`}
            submitLabel="Save Sub-Category"
            duplicateMessage="A sub-category with this name already exists."
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

      {/* ─── New Category — the shared modal (Figma 483:588) ─── */}
      {catModalOpen && (
        <NewCategoryModal
          existingNames={categories.map((c) => c.label.toLowerCase())}
          onCreate={(label) => {
            addCategory(label);
            setCatModalOpen(false);
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
      {toast && <CopiedToast label={toast} onDone={() => setToast(null)} />}

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
  const isValid = !!trimmed && !isDuplicate;

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
          </span>
          <input
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
  const isValid = !!trimmed && !isDuplicate;

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
          </span>
          <input
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

function QbColGroup({ cols }: { cols: QbColMeta[] }) {
  return (
    <colgroup>
      {/* Auto, not a fixed width: in a fixed-layout table the auto column
          soaks up ALL the slack, so Question stretches on a wide page instead
          of every column growing proportionally (which used to leave Type far
          wider than its longest value). QUESTION_COL_WIDTH still floors it
          through --table-min. */}
      <col style={{ width: "auto" }} />
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
  onPreview,
  onArchive,
  onVersionHistory,
  onDelete,
}: {
  q: Question;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onPreview: () => void;
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
      {item(<MenuPreviewIcon />, "Preview as Learner", onPreview)}
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
