import { useEffect, useMemo, useState } from "react";
import {
  reviewSubmissions as seed,
  matchesQuery,
  displayStatus,
  NO_ACTION_STATUS,
  REVIEW_TODAY,
  type TaskSubmission,
} from "../data/reviewSubmissions";
import { SectionHeading } from "./SectionHeading";
import { ReviewSearch } from "./ReviewSearch";
import { ReviewConsole } from "./ReviewConsole";
import type { QueueFilter } from "./ReviewQueueFilters";
import { MultiPill, UsersEditColumns } from "./UsersFilters";
import { CREATED_BY_IN_HOUSE, CREATED_BY_B2B } from "../data/filters";
import {
  useColumnOrder,
  orderedColumns,
  CreatedByPill,
  CascadingMultiSelect,
  PillTrigger,
} from "./Filters";
import { Dropdown } from "./Dropdown";
import { SortIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const PAGE_SIZE = 50;

/* The statuses as the table shows them — company-created submissions read as
   "No Action Required" rather than their underlying review state. */
const STATUS_OPTIONS: string[] = ["Rejected", "Review Pending", "Completed", NO_ACTION_STATUS];

// Same creator options as the Tasks/Certifications pages: SkillCat (in-house)
// plus the B2B customers.
const CREATOR_OPTIONS = [...CREATED_BY_IN_HOUSE, ...CREATED_BY_B2B];

/* ── Columns: User's Name and Task are fixed (always on, never in the menu).
   Certifications / Status / Submitted On are the toggleable columns shown by
   default; everything else is off until switched on from Edit Columns. ── */
type ColKey =
  | "certifications"
  | "status"
  | "submittedOn"
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

/** Whole days a submission has been waiting, against the dataset's fixed today. */
const waitDays = (iso: string) =>
  Math.max(1, Math.round((REVIEW_TODAY.getTime() - new Date(iso).getTime()) / 86_400_000));

/** Pending-submission counts per key (certification / task name), largest first. */
function rankedCounts(
  pending: TaskSubmission[],
  keysOf: (s: TaskSubmission) => string[],
): [string, number][] {
  const map = new Map<string, number>();
  pending.forEach((s) => keysOf(s).forEach((k) => map.set(k, (map.get(k) ?? 0) + 1)));
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type ColMeta = {
  key: ColKey;
  label: string;
  className: string;
  width: number;
  sortable?: boolean;
  /** Native-title tooltip, for cells that truncate (e.g. Certifications). */
  tip?: (s: TaskSubmission) => string | undefined;
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
        "—"
      ) : (
        <>
          {s.certifications[0]}
          {s.certifications.length > 1 && (
            <span className="used-extra">+{s.certifications.length - 1}</span>
          )}
        </>
      ),
    sortValue: (s) => (s.certifications[0] ?? "").toLowerCase(),
  },
  { key: "status", label: "Status", className: "col-rh-status", width: 200, render: (s) => <StatusPill status={displayStatus(s)} />, sortValue: (s) => displayStatus(s) },
  { key: "submittedOn", label: "Submitted On", className: "col-rh-date", width: 150, render: (s) => formatDate(s.submittedOn), sortValue: (s) => s.submittedOn },
  { key: "taskId", label: "Task ID", className: "col-rh-taskid", width: 120, sortable: false, render: (s) => s.taskId, sortValue: (s) => s.taskId },
  { key: "email", label: "User's Email", className: "col-rh-email", width: 220, sortable: false, render: (s) => s.email, sortValue: (s) => s.email.toLowerCase() },
  { key: "phone", label: "User's Phone", className: "col-rh-phone", width: 170, sortable: false, render: (s) => s.phone, sortValue: (s) => s.phone },
  { key: "userType", label: "User Type", className: "col-rh-usertype", width: 120, sortable: false, render: (s) => s.userType, sortValue: (s) => s.userType },
  { key: "company", label: "User's Company", className: "col-rh-company", width: 200, sortable: false, render: (s) => s.companyName ?? "—", sortValue: (s) => (s.companyName ?? "").toLowerCase() },
  { key: "attempt", label: "Attempt #", className: "col-rh-attempt", width: 110, render: (s) => attemptNumber(s), sortValue: (s) => attemptNumber(s) },
  { key: "dueDate", label: "Due Date", className: "col-rh-date", width: 150, render: (s) => (s.dueDate ? formatDate(s.dueDate) : "—"), sortValue: (s) => s.dueDate ?? "" },
];
const COL_BY_KEY = new Map(COLS.map((c) => [c.key, c]));

// Adapter so the existing Edit-Columns dropdown (built for the Users page) can
// drive this page's column set. Only the keys present here are shown.
const EDIT_COLUMN_DEFS = COLS.map((c) => ({ key: c.key, label: c.label }));

/** The two columns that are always rendered, in order (Edit Columns lists these
 * as "Fixed columns" — they can't be switched off or reordered). */
const FIXED_COLUMNS = [{ label: "User's Name" }, { label: "Task" }];

type SortKey = "name" | "task" | ColKey;
type SortDir = "asc" | "desc";

export function ReviewHandsOnPage() {
  const [list, setList] = useState<TaskSubmission[]>(seed);
  const [columns, setColumns] = useState<ColState>(DEFAULT_COLUMNS);
  const [statuses, setStatuses] = useState<string[]>(["Review Pending"]);
  const [types, setTypes] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [tasks, setTasks] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);
  // Created By defaults to SkillCat on load, matching the Tasks/Certifications pages.
  const [creators, setCreators] = useState<string[]>(["SkillCat"]);
  const [committedQuery, setCommittedQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "submittedOn", dir: "desc" });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

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

  /* ── "Start a review run" cards: the landing overview of everything a
     SkillCat reviewer can act on. Computed from the full list, not the
     filtered one — the cards describe the whole pending queue whatever the
     filter row below is set to. ── */
  const pending = useMemo(
    () => list.filter((s) => displayStatus(s) === "Review Pending"),
    [list],
  );
  const oldestPending = useMemo(
    () => [...pending].sort((a, b) => a.submittedOn.localeCompare(b.submittedOn))[0],
    [pending],
  );
  const certRanked = useMemo(() => rankedCounts(pending, (s) => s.certifications), [pending]);
  const taskRanked = useMemo(() => rankedCounts(pending, (s) => [s.taskName]), [pending]);

  /** Point the page at a run's scope and open the console on its oldest
   * submission. The console's queue IS the table's filtered+sorted list, so a
   * run is just: filters = the scope, sort = longest wait first. */
  function startRun(scope: { certs?: string[]; tasks?: string[] }) {
    const inScope = pending.filter(
      (s) =>
        (!scope.certs || s.certifications.some((c) => scope.certs!.includes(c))) &&
        (!scope.tasks || scope.tasks.includes(s.taskName)),
    );
    const first = [...inScope].sort((a, b) => a.submittedOn.localeCompare(b.submittedOn))[0];
    if (!first) return;
    setStatuses(["Review Pending"]);
    setCreators(["SkillCat"]);
    setTypes([]);
    setCompanies([]);
    setCerts(scope.certs ?? []);
    setTasks(scope.tasks ?? []);
    setCommittedQuery("");
    setSort({ key: "submittedOn", dir: "asc" });
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
    const arr = [...filtered].sort((a, b) => {
      if (sort.key === "name") return a.userName.localeCompare(b.userName);
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
  const colSpan = visibleCols.length + 2; // name + task + cols
  // Natural table width (name col + optional cols + actions) so the table
  // scrolls horizontally rather than crushing columns on a narrow page.
  const tableMin =
    NAME_WIDTH + TASK_WIDTH + visibleCols.reduce((s, c) => s + c.width, 0) + 40;

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

  // The table's filters, handed to the review console so its queue popover can
  // edit them in place — they drive this page's state, so the queue re-filters
  // live. The popover's row is one line: `primary` marks the two pills shown
  // when nothing is applied (Status, Created By); applied filters take
  // precedence and the rest fall into its "More Filters".
  const queueFilters: QueueFilter[] = [
    { label: "Status", all: STATUS_OPTIONS, value: statuses, onApply: setStatuses, primary: true },
    {
      label: "Created By",
      all: CREATOR_OPTIONS,
      // Same two subsections as the Created By pill everywhere else.
      sections: [
        { label: "Made in house", items: [...CREATED_BY_IN_HOUSE] },
        { label: "B2B customers", items: [...CREATED_BY_B2B].sort() },
      ],
      value: creators,
      onApply: setCreators,
      searchable: true,
      searchPlaceholder: "Search creators…",
      primary: true,
    },
    {
      label: "Task",
      all: taskNames,
      value: tasks,
      onApply: setTasks,
      searchable: true,
      searchPlaceholder: "Search tasks…",
    },
    {
      label: "Parent Certification",
      all: certNames,
      value: certs,
      onApply: setCerts,
      searchable: true,
      searchPlaceholder: "Search certifications…",
    },
    { label: "User Type", all: ["B2C", "B2B"], value: types, onApply: setTypes },
    { label: "User's Company", all: companyNames, value: companies, onApply: setCompanies },
  ];

  // Clicking a row opens the review console with the table's current
  // filtered+sorted list as the queue. Reviews submitted in the console come
  // back on exit, and reviewed submissions leave the pending list.
  // The console stays mounted for as long as a row is open — even when a filter
  // edited from its queue popover drops that submission out of `sorted`. It keeps
  // showing what's being reviewed and moves the queue highlight instead of
  // bouncing the reviewer back to the table.
  if (openId) {
    return (
      <ReviewConsole
        queue={sorted}
        initialId={openId}
        queueFilters={queueFilters}
        sort={sort}
        onSort={(key) => toggleSort(key as SortKey)}
        onExit={(reviewed) => {
          const ids = Object.keys(reviewed);
          if (ids.length) setList((prev) => prev.filter((s) => !ids.includes(s.id)));
          setOpenId(null);
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
                />
              </div>

              {pending.length > 0 && oldestPending && (
                <section className="rh-runs">
                  <SectionHeading label={`Start a Review Run · ${pending.length} Pending`} />
                  <div className="rh-run-cards">
                    <div className="rh-run-card is-default">
                      <div className="rh-run-head">
                        <span className="rh-run-title">Oldest first</span>
                        <span className="co-status-pill co-status-pill--accent">Default</span>
                      </div>
                      <p className="rh-run-desc">The whole queue, longest wait first.</p>
                      <p className="rh-run-meta">
                        Up first: <strong>{oldestPending.userName}</strong> · waited{" "}
                        {waitDays(oldestPending.submittedOn)}d
                      </p>
                      <button className="btn-publish rh-run-cta" onClick={() => startRun({})}>
                        <span className="rh-run-cta-label">Start Reviewing</span>
                      </button>
                    </div>

                    <div className="rh-run-card">
                      <div className="rh-run-head">
                        <span className="rh-run-title">By certification</span>
                      </div>
                      <p className="rh-run-desc">Clear one certification at a time.</p>
                      <div className="rh-run-list">
                        {certRanked.slice(0, 2).map(([name, n]) => (
                          <div key={name} className="rh-run-row">
                            <span>{name}</span>
                            <span className="rh-run-count">{n}</span>
                          </div>
                        ))}
                      </div>
                      {certRanked.length > 2 && (
                        <p className="rh-run-more">+ {certRanked.length - 2} more certifications</p>
                      )}
                      {certRanked.length > 0 && (
                        <button
                          className="btn-save-draft rh-run-cta"
                          onClick={() => startRun({ certs: [certRanked[0][0]] })}
                        >
                          <span className="rh-run-cta-label">Start with {certRanked[0][0]}</span>
                        </button>
                      )}
                    </div>

                    <div className="rh-run-card">
                      <div className="rh-run-head">
                        <span className="rh-run-title">By task</span>
                      </div>
                      <p className="rh-run-desc">Same task back-to-back, for consistent grading.</p>
                      <div className="rh-run-list">
                        {taskRanked.slice(0, 2).map(([name, n]) => (
                          <div key={name} className="rh-run-row">
                            <span>{name}</span>
                            <span className="rh-run-count">{n}</span>
                          </div>
                        ))}
                      </div>
                      {taskRanked.length > 2 && (
                        <p className="rh-run-more">+ {taskRanked.length - 2} more tasks</p>
                      )}
                      <button
                        className="btn-save-draft rh-run-cta"
                        onClick={() => startRun({ tasks: [taskRanked[0][0]] })}
                      >
                        <span className="rh-run-cta-label">Start with {taskRanked[0][0]}</span>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              <div className="filters">
                <MultiPill label="Status" all={STATUS_OPTIONS} value={statuses} onApply={setStatuses} />
                <CreatedByPill value={creators} onApply={setCreators} />
                <MultiPill
                  label="Task"
                  all={taskNames}
                  value={tasks}
                  onApply={setTasks}
                  searchable
                  searchPlaceholder="Search tasks…"
                  width={300}
                />
                <MultiPill
                  label="Parent Certification"
                  all={certNames}
                  value={certs}
                  onApply={setCerts}
                  searchable
                  searchPlaceholder="Search certifications…"
                  width={300}
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
                    <SortableHeader col="name" label="User's Name" className="col-name" sort={sort} toggle={toggleSort} />
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
                      <tr key={s.id} onClick={() => setOpenId(s.id)}>
                        <td className="col-name">{s.userName}</td>
                        <td className="col-rh-task">{s.taskName}</td>
                        {visibleCols.map((c) => (
                          <td key={c.key} className={c.className} data-tip={c.tip?.(s)}>
                            {c.render(s)}
                          </td>
                        ))}
                        {/* Empty counterpart to the header's Edit Columns cell.
                            Without it the sticky 40px strip has no cell in the
                            row, so the hover highlight stops short of it. */}
                        <td className="col-actions" />
                      </tr>
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={colSpan} className="u-empty">
                          {committedQuery.trim()
                            ? `No submissions match "${committedQuery.trim()}".`
                            : "No submissions match these filters."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </div>

              <div className="pagination">
                <span>
                  Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeftIcon /></button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRightIcon /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAME_WIDTH = 190;
const TASK_WIDTH = 260;

function ColGroup({ cols }: { cols: ColMeta[] }) {
  return (
    <colgroup>
      {/* Explicit width so the fixed-layout name column never collapses to 0
         when many optional columns are enabled. */}
      <col style={{ width: NAME_WIDTH }} />
      {/* Task is left auto so it, and not the 40px actions column, soaks up any
         space left over when few columns are on — the Edit Columns cell must
         stay the same width whatever the column set is. `--table-min` reserves
         TASK_WIDTH for it, so it can only ever grow past that, never shrink. */}
      <col />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: 40 }} />
    </colgroup>
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
          value={count > 0 ? `${count} active` : null}
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
            // No search box here: the list is only the companies that actually
            // have submissions, and the autofocused input scrolls the submenu
            // (which sits at the right edge of the page) into view with a jump.
            { key: "companies", label: "User's Company", groups: [{ items: companyNames }] },
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

function StatusPill({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/\s+/g, "-");
  return (
    <span className={`rh-status rh-status--${key}`}>
      <span className="rh-status-dot" />
      {status}
    </span>
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
