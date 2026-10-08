import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  attemptDuration,
  attemptReviewedOn,
  attemptCertifications,
  attemptQuizName,
  attemptsTaken,
  deleteAttempt as deleteStoredAttempt,
  grantAttempts,
  useAttemptStore,
  ATTEMPT_STATUSES,
  type Attempt,
  type AttemptStatus,
} from "../data/attempts";
import { taskById, useLiveTasks } from "../data/tasks";
import { users as allUsers, type User } from "../data/users";
import { todayIso, CURRENT_ADMIN } from "../data/certPurchases";
import { GrantAttemptsModal } from "./GrantAttemptsModal";
import { MultiPill } from "./UsersFilters";
import { Dropdown } from "./Dropdown";
import { PillTrigger, CascadingMultiSelect } from "./Filters";
import { dateRangeIncludes, type DateRangeState } from "./DateRangeFilter";
import { FILTER_TIPS } from "../data/filterTips";
import { PrmModal } from "./PrmModal";
import { EntitySearch, type SearchScope } from "./UsersSearch";
import { AddIcon, SortIcon, RowKebabIcon, RowExternalLinkIcon, RowDeleteIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";
import { useToast } from "./useToast";

const PAGE_SIZE = 50;

type SortKey =
  | "name"
  | "email"
  | "phone"
  | "quizName"
  | "attemptNumber"
  | "status"
  | "startedAt"
  | "completedAt"
  | "reviewedAt"
  | "duration"
  | "grade";
type SortDir = "asc" | "desc";

/** Whether a row's stamp falls inside a More Filters range. The stamps are the
 *  page's own "Mon DD, YYYY · h:mm AM" labels, which `Date.parse` can't read —
 *  `stampTime` already knows how, so hand the range an ISO date instead. */
function inRange(range: DateRangeState, stamp: string | null): boolean {
  if (!stamp) return false;
  const t = stampTime(stamp);
  if (!t) return false;
  return dateRangeIncludes(range, new Date(t).toISOString());
}

/** Parse the "Mon DD, YYYY · h:mm AM" stamp to a sortable epoch. */
function stampTime(s: string | null): number {
  if (!s) return 0;
  const [datePart, timePart] = s.split(" · ");
  const t = new Date(`${datePart} ${timePart}`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function durationMinutes(a: Attempt): number {
  if (!a.completedAt) return -1;
  return Math.round((stampTime(a.completedAt) - stampTime(a.startedAt)) / 60000);
}

type ColMeta = {
  key: SortKey;
  label: string;
  className: string;
  width: number;
  sortable?: boolean;
  /** Click-to-copy cell (CopyCells.tsx) — the Email/Phone opt-in Exam Reviews
   *  and both Who Paid tables already carry. */
  copyable?: boolean;
  /** Tooltip text for the cell — the one place a rejection reason is shown. */
  tip?: (a: Attempt) => string | undefined;
  render: (a: Attempt) => React.ReactNode;
};

/* Every empty data cell reads as an em dash, the app's standing empty-cell
   convention (see ReviewHandsOnPage). Here that is the In Progress row: an
   attempt still running has no Completed stamp, no Duration and no Grade.
   CopyCells treats "—" as no value, so a dashed cell stays inert instead of
   copying a dash. */
function orDash(node: React.ReactNode): React.ReactNode {
  return node === null || node === undefined || node === "" ? "—" : node;
}

/* Status is the shared "Table Pills" set (Figma 652:925 — `.co-status-pill`,
   the same pills Manage Companies and Manage IDs use): a 10% wash behind the
   colour at full strength. Green reads as cleared, red as thrown out, yellow as
   still running, and Failed takes the neutral #737373 pill — a finished attempt
   that simply didn't make the mark is not an alarm. The two undecided states
   split the greys and the warm tone between them: In Review is yellow (someone
   still has to look at it), In Progress the lighter #a8a8a8 secondary (nothing
   to look at yet). The Rejected pill keeps the cell's rejection-reason
   tooltip. */
const STATUS_TONE: Record<AttemptStatus, string> = {
  "In Progress": "secondary",
  Passed: "green",
  Failed: "grey",
  "In Review": "yellow",
  Rejected: "red",
};

/* Plain-text columns otherwise, per the table convention. */
const COLS: ColMeta[] = [
  { key: "name", label: "Name", className: "col-name", width: 190, render: (a) => a.name },
  { key: "email", label: "Email", className: "att-col-email", width: 220, sortable: false, copyable: true, render: (a) => a.email },
  { key: "phone", label: "Phone Number", className: "att-col-phone", width: 170, sortable: false, copyable: true, render: (a) => a.phone },
  { key: "quizName", label: "Quiz Name", className: "att-col-quiz", width: 230, render: (a) => attemptQuizName(a) },
  { key: "attemptNumber", label: "Attempt", className: "att-col-attempt", width: 110, render: (a) => `#${a.attemptNumber}` },
  {
    /* `col-status` is what re-enables the pill chrome past the table's
       strip-all-spans rule — see the `.co-status-pill` block in index.css. */
    key: "status", label: "Status", className: "col-status att-col-status", width: 160,
    tip: (a) => a.rejectionReason,
    render: (a) => (
      <span className={`co-status-pill co-status-pill--${STATUS_TONE[a.status]}`}>{a.status}</span>
    ),
  },
  { key: "startedAt", label: "Started", className: "att-col-date", width: 200, render: (a) => a.startedAt },
  { key: "completedAt", label: "Completed", className: "att-col-date", width: 200, render: (a) => orDash(a.completedAt) },
  /* Only a reviewed Quiz's decided attempts have one — every other row dashes
     (see `attemptReviewedOn`), which is most of them on an ordinary Quiz. */
  { key: "reviewedAt", label: "Reviewed On", className: "att-col-date", width: 200, render: (a) => orDash(attemptReviewedOn(a)) },
  { key: "duration", label: "Duration", className: "att-col-duration", width: 110, render: (a) => orDash(attemptDuration(a)) },
  /* Sized to the header, not the data: a grade is at most "100%". The mini
     progress bar this cell used to draw was inert anyway — the plain-text
     column convention flattens any span inside a data cell. */
  {
    key: "grade", label: "Grade", className: "att-col-grade", width: 90,
    render: (a) => orDash(a.grade === null ? "" : `${a.grade}%`),
  },
];

/* Natural table width — the actions cell included — so the table scrolls
   horizontally rather than crushing columns on a narrow page. */
const TABLE_MIN = COLS.reduce((s, c) => s + c.width, 0) + 40;

type Filters = {
  quizzes: string[];
  certifications: string[];
  statuses: AttemptStatus[];
  /* Behind "More Filters". Attempt is a checklist of the numbers present in the
     data; the two dates are ranges, null until one is picked. */
  attemptNumbers: string[];
  startedRange: DateRangeState | null;
  completedRange: DateRangeState | null;
};

export function AttemptsPage({
  taskId,
  onBack,
  initialNameFilter,
  extraAttempts,
  initialStatusFilter,
}: {
  /** The Quiz selected on the Tasks page — pre-fills the Quiz filter, and is
   *  the Quiz Additional Attempts grants on. Keyed by id, so a renamed Quiz
   *  keeps its attempts. */
  taskId: string;
  /** Omit when opened as a standalone tab (e.g. from Manage Completions) — the
   *  Tasks crumb then stops being a link. */
  onBack?: () => void;
  /** Pre-fills the search box — used to land on a single employee's attempts. */
  initialNameFilter?: string;
  /** Real attempt rows for the pre-filled employee/quiz — shown ahead of the mock seed data. */
  extraAttempts?: Attempt[];
  /** Pre-fills the Status filter — used to land straight on rejected attempts. */
  initialStatusFilter?: AttemptStatus;
}) {
  const [toast, toastNode] = useToast();
  /* The one attempts store Who Paid reads too, so a delete here shows there.
     A deep link's own rows (built from Manage User Progress data) ride on
     top; deleting one of those only drops it from this page. */
  const store = useAttemptStore();
  const library = useLiveTasks();
  const [droppedExtra, setDroppedExtra] = useState<ReadonlySet<string>>(() => new Set());
  const list = useMemo(
    () => [...(extraAttempts ?? []).filter((a) => !droppedExtra.has(a.id)), ...store.attempts],
    [extraAttempts, droppedExtra, store.attempts],
  );
  const quizName = taskById(taskId)?.name ?? extraAttempts?.[0]?.quizName ?? "";
  const [granting, setGranting] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    quizzes: [quizName],
    certifications: [],
    statuses: initialStatusFilter ? [initialStatusFilter] : [],
    attemptNumbers: [],
    startedRange: null,
    completedRange: null,
  });
  // Commit-on-Enter, like every other page on this bar: `search` is what the
  // table filters on, never the half-typed draft inside the component.
  const [search, setSearch] = useState(initialNameFilter ?? "");
  /* Newest attempt first — an admin opens this page to see what just came in,
     and Started is the one stamp EVERY row has (an In Progress attempt has no
     completion to sort by, so sorting on that buried them all at one end). */
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "startedAt",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ attempt: Attempt; rect: DOMRect } | null>(null);
  // The attempt awaiting the delete confirm, if any.
  const [deleting, setDeleting] = useState<Attempt | null>(null);

  /* The attempt screen is out of scope here: an admin opening an attempt will
     land on the very page the learner saw, so there is nothing separate to
     build. Until that page is wired up, View Attempt opens the new tab it
     eventually will — carrying the note instead of a half-built viewer, so the
     entry point already behaves like the real one (a tab of its own, this page
     left exactly as it was) rather than a modal alert that blocks it. */
  function viewAttempt() {
    openAttemptPlaceholder();
  }

  /* The Task this page was opened from may be outside the mock attempt set, so
     union it (and its certifications) into the filter options — otherwise the
     applied pill offers no way back to its own value. */
  const quizOptions = useMemo(
    () =>
      [...new Set([quizName, ...library.filter((t) => t.type === "Quiz").map((t) => t.name)])]
        .filter(Boolean)
        .sort(),
    [quizName, library],
  );
  /* Every attempt number the selected Quiz(zes) actually reach, so the
     checklist never offers a "#4" nobody has on them. */
  const attemptOptions = useMemo(
    () =>
      [
        ...new Set(
          list
            .filter((a) => !filters.quizzes.length || filters.quizzes.includes(attemptQuizName(a)))
            .map((a) => a.attemptNumber),
        ),
      ]
        .sort((a, b) => a - b)
        .map((n) => `#${n}`),
    [list, filters.quizzes],
  );
  const certOptions = useMemo(
    () =>
      [
        ...new Set([
          ...attemptCertifications(taskId),
          ...list.flatMap((a) => attemptCertifications(a.taskId)),
        ]),
      ].sort(),
    [taskId, list],
  );

  const scopes: SearchScope[] = [
    {
      token: "Quiz",
      options: quizOptions,
      applied: filters.quizzes,
      onAppliedChange: (v) => setFilters((f) => ({ ...f, quizzes: v })),
      optionsLabel: "Quizzes",
      example: "Quiz: EPA 608 Type I Final Exam",
      hint: "Filter by Quiz",
    },
    {
      token: "Certification",
      options: certOptions,
      applied: filters.certifications,
      onAppliedChange: (v) => setFilters((f) => ({ ...f, certifications: v })),
      optionsLabel: "Certifications",
      example: "Certification: EPA 608 Universal",
      hint: "Filter by Certification",
    },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Digits only — and only when the query HAS digits: every phone number
    // "includes" the empty string, so a name query would match every row.
    const qDigits = q.replace(/\D/g, "");
    return list.filter((a) => {
      if (filters.quizzes.length && !filters.quizzes.includes(attemptQuizName(a))) return false;
      if (filters.statuses.length && !filters.statuses.includes(a.status)) return false;
      if (filters.certifications.length) {
        const certs = attemptCertifications(a.taskId);
        if (!filters.certifications.some((c) => certs.includes(c))) return false;
      }
      if (filters.attemptNumbers.length && !filters.attemptNumbers.includes(`#${a.attemptNumber}`))
        return false;
      if (filters.startedRange && !inRange(filters.startedRange, a.startedAt)) return false;
      /* A running attempt has no completion, so a Completion Date range
         excludes it rather than treating "no date" as a match. */
      if (filters.completedRange && !inRange(filters.completedRange, a.completedAt)) return false;
      if (q && !(
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (!!qDigits && a.phone.replace(/\D/g, "").includes(qDigits)) ||
        attemptQuizName(a).toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [list, filters, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "name": return a.name.localeCompare(b.name);
        case "email": return a.email.localeCompare(b.email);
        case "phone": return a.phone.localeCompare(b.phone);
        case "quizName": return attemptQuizName(a).localeCompare(attemptQuizName(b));
        case "attemptNumber": return a.attemptNumber - b.attemptNumber;
        case "status": return a.status.localeCompare(b.status);
        case "startedAt": return stampTime(a.startedAt) - stampTime(b.startedAt);
        case "completedAt": return stampTime(a.completedAt) - stampTime(b.completedAt);
        case "reviewedAt": return stampTime(attemptReviewedOn(a)) - stampTime(attemptReviewedOn(b));
        case "duration": return durationMinutes(a) - durationMinutes(b);
        case "grade": return (a.grade ?? -1) - (b.grade ?? -1);
      }
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => setPage(1), [filters, search, sort]);
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function deleteAttempt(a: Attempt) {
    if (extraAttempts?.some((x) => x.id === a.id)) {
      setDroppedExtra((prev) => new Set(prev).add(a.id));
    } else {
      deleteStoredAttempt(a);
    }
    setDeleting(null);
    toast("Attempt Deleted");
  }

  /* Additional Attempts: the same two-stage flow as Who Paid's — pick users,
     then how many — on the Quiz this page opened on. */
  function grantAdditional(picked: User[], count: number) {
    grantAttempts(taskId, picked.map((u) => u.id), count, todayIso(), CURRENT_ADMIN);
    setGranting(false);
    toast("Additional Attempts Granted");
  }

  const moreCount =
    (filters.attemptNumbers.length > 0 ? 1 : 0) +
    (filters.startedRange ? 1 : 0) +
    (filters.completedRange ? 1 : 0);

  const hasFilters =
    filters.quizzes.length > 0 ||
    filters.certifications.length > 0 ||
    filters.statuses.length > 0 ||
    moreCount > 0;

  function clearFilters() {
    setFilters({
      quizzes: [],
      certifications: [],
      statuses: [],
      attemptNumbers: [],
      startedRange: null,
      completedRange: null,
    });
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          {/* Reached from a Task's "View Attempts" action, so the Tasks crumb
              is the way back. Opened as a standalone tab there is nowhere to
              go back to, and the trail never names the page itself (Figma
              1356:1828), so there is no crumb row at all. */}
          {onBack && (
            <nav className="rvc-crumbs" aria-label="Breadcrumb">
              <button className="rvc-crumb" onClick={onBack} title="Back to Tasks">
                Tasks
              </button>
            </nav>
          )}
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <h1 className="tasks-title">Quiz Attempts</h1>
            </div>
            {taskById(taskId) && (
              <div className="tasks-header-actions">
                <button className="new-task" onClick={() => setGranting(true)}>
                  <AddIcon />
                  Additional Attempts
                </button>
              </div>
            )}
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                {/* The shared page search — same component (and suggested-filter
                    panel) as Users and Who Paid; its scopes feed the two pills
                    below, exactly as Company: feeds the Users company pill. */}
                <EntitySearch
                  scopes={scopes}
                  placeholder="Search Users by Name, Email, or Phone..."
                  query={search}
                  onCommit={setSearch}
                />
              </div>

              <div className="filters">
                <MultiPill
                  label="Quiz Name"
                  all={quizOptions}
                  value={filters.quizzes}
                  onApply={(v) => setFilters((f) => ({ ...f, quizzes: v }))}
                  searchable
                  searchPlaceholder="Search Quizzes..."
                  width={300}
                  tip={FILTER_TIPS.quizAttempts.quiz}
                />
                <MultiPill
                  label="Certification"
                  all={certOptions}
                  value={filters.certifications}
                  onApply={(v) => setFilters((f) => ({ ...f, certifications: v }))}
                  searchable
                  searchPlaceholder="Search Certifications..."
                  width={300}
                  tip={FILTER_TIPS.quizAttempts.certification}
                />
                <MultiPill
                  label="Status"
                  all={[...ATTEMPT_STATUSES]}
                  value={filters.statuses}
                  onApply={(v) => setFilters((f) => ({ ...f, statuses: v as AttemptStatus[] }))}
                  width={220}
                  tip={FILTER_TIPS.quizAttempts.status}
                />
                <MoreFiltersPill
                  attemptOptions={attemptOptions}
                  value={filters}
                  count={moreCount}
                  onApply={(v) => setFilters((f) => ({ ...f, ...v }))}
                />
                {hasFilters && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Same split head/body table as the Hands-On review queue: one
                  scroll container, a sticky header table, and the row-end
                  chevron that swaps for the labelled action bar on hover. */}
              <div className="table-xscroll" style={{ "--table-min": `${TABLE_MIN}px` } as React.CSSProperties}>
                <table className="table table-head">
                  <ColGroup />
                  <thead>
                    <tr>
                      {COLS.map((c) => (
                        <SortableHeader
                          key={c.key}
                          col={c.key}
                          label={c.label}
                          className={c.className}
                          sort={sort}
                          toggle={toggleSort}
                          sortable={c.sortable}
                        />
                      ))}
                      <th className="col-actions" />
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className="table table-body">
                    <ColGroup />
                    <tbody>
                      {paged.map((a) => (
                        <AttemptRow
                          key={a.id}
                          attempt={a}
                          onView={viewAttempt}
                          onOpenMenu={(rect) => setMenu({ attempt: a, rect })}
                          menuOpen={menu?.attempt.id === a.id}
                        />
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

      {menu && (
        <AttemptActionsMenu
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onView={viewAttempt}
          onDelete={() => setDeleting(menu.attempt)}
        />
      )}

      {granting && (
        <GrantAttemptsModal
          quizName={quizName}
          candidates={allUsers}
          attemptsOf={(userId) => attemptsTaken(store, taskId, userId)}
          onGrant={grantAdditional}
          onClose={() => setGranting(false)}
        />
      )}

      {deleting && (
        <PrmModal
          title="Delete Attempt"
          confirmLabel="Delete Attempt"
          danger
          doubleConfirm={
            <>
              {deleting.name}'s attempt #{deleting.attemptNumber}, with its answers and grade,
              will be permanently deleted and their cooldown reset. This can't be undone.
            </>
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteAttempt(deleting)}
        >
          {/* Body copy is children, not `description` — the shell's own
              convention for a confirm (Figma 483:588). */}
          <p className="prm-content">
            {deleting.name}'s attempt #{deleting.attemptNumber} on “{attemptQuizName(deleting)}”
            is removed, along with its answers and grade, and their cooldown resets so they
            can start the next attempt straight away. Any later attempts move up a number.
            This can't be undone.
          </p>
        </PrmModal>
      )}

      {toastNode}
    </div>
  );
}

/* What lives behind "More Filters" — the three that didn't earn a pill of their
   own. Attempt is a plain checklist; the two dates mount the shared
   dual-calendar range panel as their submenu (`date` sections, see
   CascadingMultiSelect), so a range is picked here exactly as it is on the Date
   Range pill. */
type MoreFilters = Pick<Filters, "attemptNumbers" | "startedRange" | "completedRange">;

const EMPTY_MORE: MoreFilters = {
  attemptNumbers: [],
  startedRange: null,
  completedRange: null,
};

function MoreFiltersPill({
  attemptOptions,
  value,
  count,
  onApply,
}: {
  attemptOptions: string[];
  value: MoreFilters;
  count: number;
  onApply: (v: MoreFilters) => void;
}) {
  return (
    <Dropdown
      width={260}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={count > 0 ? `${count} Active` : null}
          open={open}
          toggle={toggle}
          onClear={() => onApply(EMPTY_MORE)}
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          attemptOptions={attemptOptions}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function MoreFiltersBody({
  attemptOptions,
  value,
  onApply,
}: {
  attemptOptions: string[];
  value: MoreFilters;
  onApply: (v: MoreFilters) => void;
}) {
  const selection = useMemo(
    () => ({ attemptNumbers: value.attemptNumbers }),
    [value.attemptNumbers],
  );
  const dates = useMemo(
    () => ({ startedRange: value.startedRange, completedRange: value.completedRange }),
    [value.startedRange, value.completedRange],
  );

  return (
    <CascadingMultiSelect
      sections={[
        { key: "attemptNumbers", label: "Attempt", groups: [{ items: attemptOptions }] },
        { key: "startedRange", label: "Start Date", date: true },
        { key: "completedRange", label: "Completion Date", date: true },
      ]}
      value={selection}
      dates={dates}
      onApply={(v, _texts, d) =>
        onApply({
          attemptNumbers: v.attemptNumbers ?? [],
          startedRange: d.startedRange ?? null,
          completedRange: d.completedRange ?? null,
        })
      }
    />
  );
}

/* View Attempt opens the learner-facing attempt page in its own tab — a
   placeholder page until it is specced (Figma list item 86; App.tsx
   `?viewAttempt=`). */
function openAttemptPlaceholder() {
  window.open(`${window.location.origin}${window.location.pathname}?viewAttempt=1`, "_blank", "noopener");
}

function ColGroup() {
  return (
    <TableCols data={COLS.map((c) => c.width)} trail={[40]} />
  );
}

function AttemptRow({
  attempt: a,
  onView,
  onOpenMenu,
  menuOpen,
}: {
  attempt: Attempt;
  onView: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  return (
    <tr className={menuOpen ? "menu-open" : ""} onClick={onView}>
      {COLS.map((c) => (
        <td key={c.key} className={c.className} data-tip={c.tip?.(a)} data-copyable={c.copyable ? "" : undefined}>
          {c.render(a)}
        </td>
      ))}
      {/* Row-end affordance: a centred kebab at rest, swapped on row hover for
          the two-cell bar of Figma 781:1490 — "View Attempt ↗" then the kebab.
          The bar's kebab is its LAST cell, and `.row-action-bar` is anchored so
          that cell's glyph lands on the actions-cell centre — i.e. exactly on
          the resting kebab, so the swap doesn't move the glyph. It also puts
          the shared `.menu-open :last-child` outline on the right cell. Per
          782:1647 only the hovered cell turns orange. */}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button
            className="row-action-btn row-action-btn--label"
            onClick={(e) => { e.stopPropagation(); onView(); }}
          >
            View Attempt
            <RowExternalLinkIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ────────── Three-dot row actions menu (Figma 782:1656) ────────── */

function AttemptActionsMenu({
  rect,
  onClose,
  onView,
  onDelete,
}: {
  rect: DOMRect;
  onClose: () => void;
  onView: () => void;
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
    function onScroll() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {/* Two items and no head block — 782:1656 is just the actions. */}
      <button
        className="u-menu-item"
        onClick={(e) => { e.stopPropagation(); onView(); onClose(); }}
      >
        <span className="u-menu-item-icon"><RowExternalLinkIcon /></span>
        View Attempt
      </button>
      {/* Any attempt can be deleted — running, passed or failed. */}
      <button
        className="u-menu-item u-menu-item--danger"
        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
      >
        <span className="u-menu-item-icon"><RowDeleteIcon /></span>
        Delete Attempt
      </button>
    </div>
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
  className: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
}) {
  if (!sortable) {
    return (
      <th className={`${className} no-sort`}>
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
