import { useEffect, useMemo, useState } from "react";
import {
  reviewSubmissions as seed,
  matchesQuery,
  displayStatus,
  isPendingReview,
  NO_ACTION_STATUS,
  useSubmittedReviews,
  withLiveTask,
  withSubmittedReview,
  type TaskSubmission,
} from "../data/reviewSubmissions";
import { useLiveTasks } from "../data/tasks";
import { ReviewSearch } from "./ReviewSearch";
import { ReviewRunsStrip, ReviewRunCard } from "./ReviewRuns";
import { ReviewConsole } from "./ReviewConsole";
import { MultiPill, UsersEditColumns } from "./UsersFilters";
import {
  useColumnOrder,
  orderedColumns,
  CreatedByPill,
  CascadingMultiSelect,
  PillTrigger,
} from "./Filters";
import { Dropdown } from "./Dropdown";
import { FILTER_TIPS } from "../data/filterTips";
import { SortIcon, RowChevronIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";
import { useToast } from "./useToast";

const PAGE_SIZE = 50;

/* The statuses as the table shows them — company-created submissions read as
   "No Action Required" rather than their underlying review state. Listed in
   the reviewer's own order (user, 2026-09-11): what still needs work first,
   then the two outcomes, then the rows that were never theirs to action. */
const STATUS_OPTIONS: string[] = ["Review Pending", "Completed", "Rejected", NO_ACTION_STATUS];


/* ── Columns: Task is fixed (always first, never in the menu). Certifications /
   Status / Submitted On / User's Name are the toggleable columns shown by
   default, in that order; everything else is off until switched on from Edit
   Columns. ── */
type ColKey =
  | "certifications"
  | "status"
  | "submittedOn"
  | "name"
  | "taskId"
  | "email"
  | "phone"
  | "userType"
  | "company"
  | "attempt"
  | "dueDate";
type ColState = Record<ColKey, boolean>;

const DEFAULT_COLUMNS: ColState = {
  certifications: true,
  status: true,
  submittedOn: true,
  name: true,
  taskId: false,
  email: false,
  phone: false,
  userType: false,
  company: false,
  attempt: false,
  dueDate: false,
};

/** The learner's current attempt number = how many submissions they've made. */
const attemptNumber = (s: TaskSubmission) => s.versions.length;

/** Pending-submission counts per key (certification / task name), largest first. */
function rankedCounts(
  pending: TaskSubmission[],
  keysOf: (s: TaskSubmission) => string[],
): [string, number][] {
  const map = new Map<string, number>();
  pending.forEach((s) => keysOf(s).forEach((k) => map.set(k, (map.get(k) ?? 0) + 1)));
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/* ── Review Runs (Figma 1394:1947 row / 1392:1793 cards) ──
   A run is ONE filter the reviewer clears in a sitting: everything pending,
   one Certification, one Task, or one Company's employees. Status and Created
   By are never part of a run — every run is the reviewable queue (Review
   Pending, made by SkillCat) narrowed by the run's own filter, oldest first.
   A card is that filter preset; its number is how many are still pending in
   it. Suggested cards come from the pending counts; Recent cards are the
   filters that were in force each time a review was opened. */
type RunKind = "all" | "cert" | "task" | "company";
type RunKey = { kind: RunKind; values: string[] };

const ALL_RUN: RunKey = { kind: "all", values: [] };

/** Identity: the same filter (whatever the value order) is the same card. */
const runId = (k: RunKey) => `${k.kind}:${[...k.values].sort().join("\u0000")}`;

/** Does a submission fall inside the run? */
function inRun(s: TaskSubmission, k: RunKey): boolean {
  switch (k.kind) {
    case "all":
      return true;
    case "cert":
      return s.certifications.some((c) => k.values.includes(c));
    case "task":
      return k.values.includes(s.taskName);
    case "company":
      return !!s.companyName && k.values.includes(s.companyName);
  }
}

/* The card's second line names the KIND of filter (1392:1793 — "Certification",
   "Hands-On Task", "B2B Company Employees"); All Tasks has no second line. */
const RUN_SUBTITLE: Record<RunKind, string | null> = {
  all: null,
  cert: "Certification",
  task: "Hands-On Task",
  company: "B2B Company Employees",
};

/* Recents keep up to 5, suggested up to 5, and the strip never holds more than
   7 — recents take their slots first and the suggested list backfills what is
   left (user, 2026-09-30). */
const MAX_RECENT = 5;
const MAX_SUGGESTED = 5;
const MAX_RUNS = 7;

/* Recents outlive the page: App unmounts it on every navigation, and this
   prototype has no storage layer, so they live at module scope for the
   session. */
let recentRunsStore: RunKey[] = [];

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* Every empty data cell reads as an em dash, the app's standing empty-cell
   convention (Companies has used it since the DS pass). Covers the columns
   that can genuinely be blank here — Certifications, User's Company, Due Date
   — whose renders return null / "". CopyCells treats "—" as no value, so a
   dashed Email/Phone cell stays inert instead of copying a dash. */
function orDash(node: React.ReactNode): React.ReactNode {
  return node === null || node === undefined || node === "" ? "—" : node;
}

type ColMeta = {
  key: ColKey;
  label: string;
  className: string;
  width: number;
  sortable?: boolean;
  /** Native-title tooltip, for cells that truncate (e.g. Certifications). */
  tip?: (s: TaskSubmission) => string | undefined;
  /** Click-to-copy cell (CopyCells.tsx) — the Email/Phone opt-in Exam Reviews
   * and ID Re-Uploads already carry. */
  copyable?: boolean;
  render: (s: TaskSubmission) => React.ReactNode;
  sortValue: (s: TaskSubmission) => string | number;
};

/* Declared in Edit-Columns order: the default-on columns first, then the
   optional ones. A user's drag reorders them from here. */
const COLS: ColMeta[] = [
  {
    key: "certifications", label: "Certifications", className: "col-rh-certs", width: 220, sortable: false,
    tip: (s) => (s.certifications.length ? s.certifications.join("\n") : undefined),
    render: (s) =>
      s.certifications.length === 0 ? (
        null
      ) : (
        <>
          {s.certifications[0]}
          {s.certifications.length > 1 && (
            <>{" "}<span className="used-extra">+{s.certifications.length - 1}</span></>
          )}
        </>
      ),
    sortValue: (s) => (s.certifications[0] ?? "").toLowerCase(),
  },
  // Plain text like every other data column — the old amber dot-pill was not a
  // design-system component and was removed 2026-08-26.
  { key: "status", label: "Status", className: "col-rh-status", width: 200, render: (s) => displayStatus(s), sortValue: (s) => displayStatus(s) },
  { key: "submittedOn", label: "Submitted On", className: "col-rh-date", width: 150, render: (s) => formatDate(s.submittedOn), sortValue: (s) => s.submittedOn },
  /* `col-rh-user`, not the shared `col-name`: on this table the TASK is the
     primary column, so the submitter reads as a plain data cell (the shared
     muted rule covers it). */
  { key: "name", label: "User's Name", className: "col-rh-user", width: 190, render: (s) => s.userName, sortValue: (s) => s.userName.toLowerCase() },
  { key: "taskId", label: "Task ID", className: "col-rh-taskid", width: 120, sortable: false, render: (s) => s.taskId, sortValue: (s) => s.taskId },
  { key: "email", label: "User's Email", className: "col-rh-email", width: 220, sortable: false, copyable: true, render: (s) => s.email, sortValue: (s) => s.email.toLowerCase() },
  { key: "phone", label: "User's Phone", className: "col-rh-phone", width: 170, sortable: false, copyable: true, render: (s) => s.phone, sortValue: (s) => s.phone },
  { key: "userType", label: "User Type", className: "col-rh-usertype", width: 120, sortable: false, render: (s) => s.userType, sortValue: (s) => s.userType },
  { key: "company", label: "User's Company", className: "col-rh-company", width: 200, sortable: false, render: (s) => s.companyName ?? "", sortValue: (s) => (s.companyName ?? "").toLowerCase() },
  { key: "attempt", label: "Attempt #", className: "col-rh-attempt", width: 110, render: (s) => attemptNumber(s), sortValue: (s) => attemptNumber(s) },
  { key: "dueDate", label: "Due Date", className: "col-rh-date", width: 150, render: (s) => (s.dueDate ? formatDate(s.dueDate) : ""), sortValue: (s) => s.dueDate ?? "" },
];
const COL_BY_KEY = new Map(COLS.map((c) => [c.key, c]));

const TASK_WIDTH = 260;

// Adapter so the existing Edit-Columns dropdown (built for the Users page) can
// drive this page's column set. Only the keys present here are shown.
const EDIT_COLUMN_DEFS = COLS.map((c) => ({ key: c.key, label: c.label }));

/** The column that is always rendered first (Edit Columns lists it as a
 * "Fixed column" — it can't be switched off or reordered). */
const FIXED_COLUMNS = [{ label: "Task" }];

type SortKey = "name" | "task" | ColKey;
type SortDir = "asc" | "desc";

export function ReviewHandsOnPage({ initialTaskFilter, initialQuery, extraSubmissions }: {
  /* Deep link from a Hands-On Task's "View All Attempts" in the Tasks table:
     the page opens with just that Task selected. The defaults that scope the
     reviewer's own queue — Review Pending, Created By SkillCat — are cleared
     in that case, since the ask is every attempt on this Task, whoever made
     it and wherever it stands. */
  initialTaskFilter?: string;
  /** Seeds the search bar — Manage Completions deep-links one LEARNER's
   *  attempts on the Task, and the search already matches the submitter. */
  initialQuery?: string;
  /** Rows the opening tab supplies because this page's own queue may not hold
   *  them — see `submissionForLearner`. Prepended, so the deep-linked row is
   *  the first thing under the filters. */
  extraSubmissions?: TaskSubmission[];
} = {}) {
  const [rows, setList] = useState<TaskSubmission[]>(() =>
    extraSubmissions?.length ? [...extraSubmissions, ...seed] : seed,
  );
  /* Reviews submitted in the console land in the shared store, not here: a
     reviewed row stays in the table under its new status (and reopens
     read-only), and every pending count reads the same store. */
  const reviews = useSubmittedReviews();
  /* Read through the live Task list too, so a wizard edit — a new Passing
     Grade, a Task switched to "Submission Made", a rename — reaches the
     table, its filters and the console. */
  const liveTasks = useLiveTasks();
  const list = useMemo(
    () => rows.map((s) => withSubmittedReview(withLiveTask(s, liveTasks), reviews)),
    [rows, reviews, liveTasks],
  );
  const [columns, setColumns] = useState<ColState>(DEFAULT_COLUMNS);
  const [toast, toastNode] = useToast();
  const [statuses, setStatuses] = useState<string[]>(initialTaskFilter ? [] : ["Review Pending"]);
  const [types, setTypes] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [tasks, setTasks] = useState<string[]>(initialTaskFilter ? [initialTaskFilter] : []);
  const [certs, setCerts] = useState<string[]>([]);
  // Created By defaults to SkillCat on load, matching the Tasks/Certifications pages.
  const [creators, setCreators] = useState<string[]>(initialTaskFilter ? [] : ["SkillCat"]);
  const [committedQuery, setCommittedQuery] = useState(initialQuery ?? "");
  // Longest waiting first — the default review-run order, so the table reads
  // in the same order as the console's queue.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedOn", dir: "asc" });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  // Recent runs, newest first — seeded from, and mirrored to, the module store.
  const [recents, setRecents] = useState<RunKey[]>(() => recentRunsStore);

  const companyNames = useMemo(() => {
    const set = new Set<string>();
    list.forEach((s) => s.companyName && set.add(s.companyName));
    return [...set].sort();
  }, [list]);

  const taskNames = useMemo(() => {
    const set = new Set<string>();
    list.forEach((s) => set.add(s.taskName));
    return [...set].sort();
  }, [list]);

  // Only the certifications that actually contain one of the submitted Tasks —
  // filtering by anything else would always come back empty.
  const certNames = useMemo(() => {
    const set = new Set<string>();
    list.forEach((s) => s.certifications.forEach((c) => set.add(c)));
    return [...set].sort();
  }, [list]);

  /* ── Review Runs: computed from the full list, not the filtered one — the
     cards describe the whole pending queue whatever the filter row is set
     to. ── */
  const pending = useMemo(
    () => list.filter(isPendingReview),
    [list],
  );
  const certRanked = useMemo(() => rankedCounts(pending, (s) => s.certifications), [pending]);
  const taskRanked = useMemo(() => rankedCounts(pending, (s) => [s.taskName]), [pending]);

  // A recent whose queue has been cleared has nothing left to open — it drops
  // out of the strip (and frees its slot) rather than showing a 0.
  const liveRecents = useMemo(
    () => recents.filter((r) => pending.some((s) => inRun(s, r))),
    [recents, pending],
  );

  /* Suggested = the ranked sequence All Tasks → the 2 Certifications with the
     most pending → the 2 Tasks with the most pending → the next Certification
     → the next Task → …, skipping anything already in Recent, cut to what the
     7 slots leave after the recents (never more than 5). By default that is
     exactly All + 2 + 2; as suggested cards are clicked they move to Recent
     and the sequence backfills behind them. */
  const suggested = useMemo(() => {
    const certs = certRanked.map(([name]): RunKey => ({ kind: "cert", values: [name] }));
    const tasks = taskRanked.map(([name]): RunKey => ({ kind: "task", values: [name] }));
    const seq: RunKey[] = [ALL_RUN, ...certs.slice(0, 2), ...tasks.slice(0, 2)];
    for (let i = 2; i < Math.max(certs.length, tasks.length); i++) {
      if (certs[i]) seq.push(certs[i]);
      if (tasks[i]) seq.push(tasks[i]);
    }
    const taken = new Set(liveRecents.map(runId));
    const room = Math.max(0, Math.min(MAX_SUGGESTED, MAX_RUNS - liveRecents.length));
    return seq.filter((k) => !taken.has(runId(k))).slice(0, room);
  }, [certRanked, taskRanked, liveRecents]);

  /** Push a run to the front of Recent (a repeat just moves it up); cleared
   *  runs fall away so they never hold a slot. */
  function recordRecent(key: RunKey) {
    const id = runId(key);
    const next = [
      key,
      ...recents.filter((r) => runId(r) !== id && pending.some((s) => inRun(s, r))),
    ].slice(0, MAX_RECENT);
    recentRunsStore = next;
    setRecents(next);
  }

  /* The run the table's filters describe, by precedence Company > Task >
     Certification (user, 2026-09-30): Task + Certification records the Task.
     Status, Created By, User Type and the search text never count — they
     scope what the reviewer is looking at, not what they are clearing. With
     none of the three applied the run is All Tasks. */
  function runFromFilters(): RunKey {
    if (companies.length) return { kind: "company", values: companies };
    if (tasks.length) return { kind: "task", values: tasks };
    if (certs.length) return { kind: "cert", values: certs };
    return ALL_RUN;
  }

  /** Open the console from a table row: the filters in force become the
   *  newest recent run. */
  function openReview(id: string) {
    recordRecent(runFromFilters());
    setOpenId(id);
  }

  /** A card click: reset the filter row to the reviewable queue narrowed by
   * the run, oldest first, and open the console on its longest-waiting
   * submission. The console's queue IS the table's filtered+sorted list, so
   * setting the filters is all a run has to do. The card becomes (or moves to
   * the front of) Recent. */
  function startRun(key: RunKey) {
    const first = pending
      .filter((s) => inRun(s, key))
      .sort((a, b) => a.submittedOn.localeCompare(b.submittedOn))[0];
    if (!first) return;
    setStatuses(["Review Pending"]);
    setCreators(["SkillCat"]);
    setTypes([]);
    setCompanies(key.kind === "company" ? key.values : []);
    setTasks(key.kind === "task" ? key.values : []);
    setCerts(key.kind === "cert" ? key.values : []);
    setCommittedQuery("");
    setSort({ key: "submittedOn", dir: "asc" });
    recordRecent(key);
    setOpenId(first.id);
  }

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return list.filter((s) => {
      if (statuses.length && !statuses.includes(displayStatus(s))) return false;
      if (types.length && !types.includes(s.userType)) return false;
      if (creators.length && !creators.includes(s.createdBy)) return false;
      if (companies.length && !(s.companyName && companies.includes(s.companyName))) return false;
      if (tasks.length && !tasks.includes(s.taskName)) return false;
      if (certs.length && !s.certifications.some((c) => certs.includes(c))) return false;
      if (!q) return true;
      return matchesQuery(s, q);
    });
  }, [list, committedQuery, statuses, types, creators, companies, tasks, certs]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sort.key === "task") return a.taskName.localeCompare(b.taskName);
      const col = COL_BY_KEY.get(sort.key)!;
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [committedQuery, statuses, types, creators, companies, tasks, certs, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(COLS);
  const visibleCols = useMemo(() => orderedColumns(COLS, order, columns), [columns, order]);
  // Natural table width (task col + optional cols + actions) so the table
  // scrolls horizontally rather than crushing columns on a narrow page.
  const tableMin = TASK_WIDTH + visibleCols.reduce((s, c) => s + c.width, 0) + 40;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function clearFilters() {
    setStatuses([]);
    setTypes([]);
    setCreators([]);
    setCompanies([]);
    setTasks([]);
    setCerts([]);
  }


  // Clicking a row opens the review console with the table's current
  // filtered+sorted list as the queue. A submitted review updates the shared
  // store at once, so a reviewed row leaves the Review Pending queue (and the
  // run cards' counts) while the console is still open.
  if (openId) {
    return (
      <ReviewConsole
        queue={sorted}
        initialId={openId}
        onExit={(verdict) => {
          setOpenId(null);
          if (verdict) toast(verdict);
        }}
        onRenameUser={(userId, userName) =>
          setList((prev) => prev.map((s) => (s.userId === userId ? { ...s, userName } : s)))
        }
      />
    );
  }

  const hasFilters =
    statuses.length + types.length + creators.length + companies.length + tasks.length + certs.length > 0;

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Hands-On Task Submissions</h1>
            </div>
          </header>

          {/* Review Runs — Figma 1392:1793 (re-synced 2026-10-02: one row, no
              Recent / Suggested headings; a recent card reads "· Recent" in
              its subtext). Recent = the filters in force each time a review
              was opened, newest first, ahead of the suggestions; Suggested
              = All Tasks, then the Certifications and Tasks with the most
              pending. A card is a filter preset: clicking it narrows the
              queue to that run and opens the console on its longest-waiting
              submission. Nothing pending → no strip. */}
          {pending.length > 0 && (
            <ReviewRunsStrip>
              <RunCards recents={liveRecents} suggested={suggested} pending={pending} onPick={startRun} />
            </ReviewRunsStrip>
          )}

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <ReviewSearch
                  submissions={list}
                  companies={companies}
                  onCompaniesChange={setCompanies}
                  tasks={tasks}
                  onTasksChange={setTasks}
                  certifications={certs}
                  onCertificationsChange={setCerts}
                  query={committedQuery}
                  onCommit={setCommittedQuery}
                  secondary
                />
              </div>

              <div className="filters">
                <MultiPill label="Status" all={STATUS_OPTIONS} value={statuses} onApply={setStatuses} tip={FILTER_TIPS.handsOn.status} />
                <CreatedByPill value={creators} onApply={setCreators} />
                <MultiPill
                  label="Task"
                  all={taskNames}
                  value={tasks}
                  onApply={setTasks}
                  searchable
                  searchPlaceholder="Search Tasks..."
                  width={300}
                  tip={FILTER_TIPS.handsOn.task}
                />
                <MultiPill
                  label="Parent Certification"
                  all={certNames}
                  value={certs}
                  onApply={setCerts}
                  searchable
                  searchPlaceholder="Search Certifications..."
                  width={300}
                  tip={FILTER_TIPS.handsOn.parentCertification}
                />
                {/* The lower-traffic filters, same cascading menu the Tasks page
                    uses for its "More filters" pill. */}
                <MoreFiltersPill
                  types={types}
                  onTypesChange={setTypes}
                  companies={companies}
                  onCompaniesChange={setCompanies}
                  companyNames={companyNames}
                />
                {hasFilters && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
              <table className="table table-head">
                <ColGroup cols={visibleCols} />
                <thead>
                  <tr>
                    <SortableHeader col="task" label="Task" className="col-rh-task" sort={sort} toggle={toggleSort} />
                    {visibleCols.map((c) => (
                      <SortableHeader key={c.key} col={c.key} label={c.label} className={c.className} sort={sort} toggle={toggleSort} sortable={c.sortable} />
                    ))}
                    <th className="col-actions">
                      <UsersEditColumns
                        columns={columns}
                        setColumns={setColumns}
                        fixed={FIXED_COLUMNS}
                        optional={EDIT_COLUMN_DEFS as unknown as { key: string; label: string }[]}
                        order={order}
                        onOrderChange={(o) => setOrder(o as typeof order)}
                      />
                    </th>
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup cols={visibleCols} />
                  <tbody>
                    {paged.map((s) => (
                      <tr key={s.id} onClick={() => openReview(s.id)}>
                        <td className="col-rh-task">{s.taskName}</td>
                        {visibleCols.map((c) => (
                          <td
                            key={c.key}
                            className={c.className}
                            data-tip={c.tip?.(s)}
                            data-copyable={c.copyable ? "" : undefined}
                          >
                            {orDash(c.render(s))}
                          </td>
                        ))}
                        {/* Row-end affordance (Figma 761:4653 resting /
                            762:4663 hovered), built on the same two-layer
                            machinery as every other table's 3-dot cell: a
                            centred glyph that hides on row hover, and an
                            absolutely-positioned bar that takes its place.
                            The bar's anchor puts its LAST cell's glyph on the
                            cell centre, so the two chevrons land on exactly the
                            same pixel — the design's requirement. */}
                        <td className="col-actions">
                          <button
                            className="row-action-btn lone-dots row-chevron"
                            aria-label="Review Task"
                            onClick={(e) => { e.stopPropagation(); openReview(s.id); }}
                          >
                            <RowChevronIcon />
                          </button>
                          <div className="row-action-bar">
                            <button
                              className="row-action-btn row-action-btn--label"
                              onClick={(e) => { e.stopPropagation(); openReview(s.id); }}
                            >
                              Review Task
                              <RowChevronIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {paged.length === 0 && <TableEmpty />}
              </div>

              <div className="pagination">
                <span>
                  Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><PagePrevIcon /></button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><PageNextIcon /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}

/** The strip's cards built from this page's runs — recents first (each
 *  marked "· Recent"), then the suggestions, in one unlabelled row. */
function RunCards({
  recents,
  suggested,
  pending,
  onPick,
}: {
  recents: RunKey[];
  suggested: RunKey[];
  pending: TaskSubmission[];
  onPick: (k: RunKey) => void;
}) {
  const runs = [
    ...recents.map((k) => ({ k, recent: true })),
    ...suggested.map((k) => ({ k, recent: false })),
  ];
  return (
    <>
      {runs.map(({ k, recent }) => (
        <ReviewRunCard
          key={runId(k)}
          count={pending.filter((s) => inRun(s, k)).length}
          values={k.kind === "all" ? ["All Tasks"] : k.values}
          sub={RUN_SUBTITLE[k.kind]}
          recent={recent}
          onClick={() => onPick(k)}
        />
      ))}
    </>
  );
}

function ColGroup({ cols }: { cols: ColMeta[] }) {
  return (
    <TableCols data={[TASK_WIDTH, ...cols.map((c) => c.width)]} trail={[40]} />
  );
}

/** The secondary filters, behind one pill — the cascading menu the Tasks and
 * Question Bank pages use, with a row per filter over a single Apply. */
function MoreFiltersPill({
  types,
  onTypesChange,
  companies,
  onCompaniesChange,
  companyNames,
}: {
  types: string[];
  onTypesChange: (v: string[]) => void;
  companies: string[];
  onCompaniesChange: (v: string[]) => void;
  companyNames: string[];
}) {
  const count = types.length + companies.length;
  const value = useMemo(
    () => ({ types, companies }),
    [types, companies],
  );

  return (
    <Dropdown
      width={260}
      // Right-aligned: this pill sits at the end of the row, and the cascading
      // submenu opens to its right — anchoring left would push it off-page.
      align="right"
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={count > 0 ? `${count} Active` : null}
          open={open}
          toggle={toggle}
          onClear={() => {
            onTypesChange([]);
            onCompaniesChange([]);
          }}
        />
      )}
    >
      {({ close }) => (
        <CascadingMultiSelect
          sections={[
            { key: "types", label: "User Type", groups: [{ items: ["B2C", "B2B"] }] },
            {
              key: "companies",
              label: "User's Company",
              groups: [{ items: companyNames }],
              searchPlaceholder: "Search Companies...",
            },
          ]}
          value={value}
          onApply={(v) => {
            onTypesChange(v.types ?? []);
            onCompaniesChange(v.companies ?? []);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function SortableHeader({
  col,
  label,
  className,
  sort,
  toggle,
  sortable = true,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
}) {
  if (!sortable) {
    return (
      <th className={`${className ?? ""} no-sort`.trim()}>
        <span className="th-content">{label}</span>
      </th>
    );
  }
  const active = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}
