import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  attempts as seed,
  attemptDuration,
  attemptCertifications,
  ATTEMPT_QUIZ_NAMES,
  ATTEMPT_CERTIFICATION_NAMES,
  ATTEMPT_STATUSES,
  type Attempt,
  type AttemptStatus,
} from "../data/attempts";
import { MultiPill } from "./UsersFilters";
import { PrmModal } from "./PrmModal";
import { EntitySearch, type SearchScope } from "./UsersSearch";
import { SortIcon, RowKebabIcon, RowExternalLinkIcon, RowDeleteIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

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
  | "duration"
  | "grade";
type SortDir = "asc" | "desc";

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
  /** Tooltip text for the cell — the one place a rejection reason is shown. */
  tip?: (a: Attempt) => string | undefined;
  render: (a: Attempt) => React.ReactNode;
};

/* Plain-text columns, per the table convention — Status included: it is one of
   the four lifecycle values and nothing else, with the proctoring rejection
   reason demoted to a hover tooltip. */
const COLS: ColMeta[] = [
  { key: "name", label: "Name", className: "col-name", width: 190, render: (a) => a.name },
  { key: "email", label: "Email", className: "att-col-email", width: 220, sortable: false, render: (a) => a.email },
  { key: "phone", label: "Phone Number", className: "att-col-phone", width: 170, sortable: false, render: (a) => a.phone },
  { key: "quizName", label: "Quiz Name", className: "att-col-quiz", width: 230, render: (a) => a.quizName },
  { key: "attemptNumber", label: "Attempt", className: "att-col-attempt", width: 110, render: (a) => `#${a.attemptNumber}` },
  {
    key: "status", label: "Status", className: "att-col-status", width: 160,
    tip: (a) => a.rejectionReason,
    render: (a) => a.status,
  },
  { key: "startedAt", label: "Started", className: "att-col-date", width: 200, render: (a) => a.startedAt },
  { key: "completedAt", label: "Completed", className: "att-col-date", width: 200, render: (a) => a.completedAt ?? "" },
  { key: "duration", label: "Duration", className: "att-col-duration", width: 110, render: (a) => attemptDuration(a) },
  /* Sized to the header, not the data: a grade is at most "100%". The mini
     progress bar this cell used to draw was inert anyway — the plain-text
     column convention flattens any span inside a data cell. */
  {
    key: "grade", label: "Grade", className: "att-col-grade", width: 90,
    render: (a) => (a.grade === null ? "" : `${a.grade}%`),
  },
];

/* Natural table width — the actions cell included — so the table scrolls
   horizontally rather than crushing columns on a narrow page. */
const TABLE_MIN = COLS.reduce((s, c) => s + c.width, 0) + 40;

type Filters = {
  quizzes: string[];
  certifications: string[];
  statuses: AttemptStatus[];
};

export function AttemptsPage({
  quizName,
  onBack,
  initialNameFilter,
  extraAttempts,
  initialStatusFilter,
}: {
  /** The Task selected on the Tasks page — pre-fills the Quiz filter. */
  quizName: string;
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
  const [list, setList] = useState<Attempt[]>(() => [...(extraAttempts ?? []), ...seed]);
  const [filters, setFilters] = useState<Filters>({
    quizzes: [quizName],
    certifications: [],
    statuses: initialStatusFilter ? [initialStatusFilter] : [],
  });
  // Commit-on-Enter, like every other page on this bar: `search` is what the
  // table filters on, never the half-typed draft inside the component.
  const [search, setSearch] = useState(initialNameFilter ?? "");
  // Newest completion first — an admin opens this page to see what just came in.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "completedAt",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ attempt: Attempt; rect: DOMRect } | null>(null);
  // The attempt awaiting the delete confirm, if any.
  const [deleting, setDeleting] = useState<Attempt | null>(null);

  /* The attempt screen is out of scope here: an admin opening an attempt will
     land on the very page the learner saw, so there is nothing separate to
     build. Until that page is wired up, every View Attempt entry point says so
     rather than opening a half-built viewer. */
  function viewAttempt() {
    window.alert(
      "View Attempt will open the same attempt page that users see. That page isn’t wired up in this prototype yet.",
    );
  }

  /* The Task this page was opened from may be outside the mock attempt set, so
     union it (and its certifications) into the filter options — otherwise the
     applied pill offers no way back to its own value. */
  const quizOptions = useMemo(
    () => [...new Set([quizName, ...ATTEMPT_QUIZ_NAMES])].sort(),
    [quizName],
  );
  const certOptions = useMemo(
    () => [...new Set([...attemptCertifications(quizName), ...ATTEMPT_CERTIFICATION_NAMES])].sort(),
    [quizName],
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
      if (filters.quizzes.length && !filters.quizzes.includes(a.quizName)) return false;
      if (filters.statuses.length && !filters.statuses.includes(a.status)) return false;
      if (filters.certifications.length) {
        const certs = attemptCertifications(a.quizName);
        if (!filters.certifications.some((c) => certs.includes(c))) return false;
      }
      if (q && !(
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (!!qDigits && a.phone.replace(/\D/g, "").includes(qDigits)) ||
        a.quizName.toLowerCase().includes(q)
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
        case "quizName": return a.quizName.localeCompare(b.quizName);
        case "attemptNumber": return a.attemptNumber - b.attemptNumber;
        case "status": return a.status.localeCompare(b.status);
        case "startedAt": return stampTime(a.startedAt) - stampTime(b.startedAt);
        case "completedAt": return stampTime(a.completedAt) - stampTime(b.completedAt);
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
    setList((prev) => prev.filter((x) => x.id !== a.id));
    setDeleting(null);
  }

  const hasFilters =
    filters.quizzes.length > 0 || filters.certifications.length > 0 || filters.statuses.length > 0;

  function clearFilters() {
    setFilters({ quizzes: [], certifications: [], statuses: [] });
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            {/* Reached from a Task's "View Attempts" action, so the Tasks crumb
                is the way back. Opened as a standalone tab there is nowhere to
                go back to, and it stays a plain label. */}
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                {onBack ? (
                  <button className="rvc-crumb" onClick={onBack} title="Back to Tasks">
                    Tasks
                  </button>
                ) : (
                  <span className="rvc-crumb">Tasks</span>
                )}
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Quiz Attempts</span>
              </nav>
              <h1 className="tasks-title">Quiz Attempts</h1>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                {/* The shared page search — same component (and suggested-filter
                    panel) as Users and Who Paid; its scopes feed the two pills
                    below, exactly as Company: feeds the Users company pill. */}
                <EntitySearch
                  scopes={scopes}
                  placeholder="Search Users by Name, Email, or Phone…"
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
                  searchPlaceholder="Search Quizzes"
                  width={300}
                />
                <MultiPill
                  label="Certification"
                  all={certOptions}
                  value={filters.certifications}
                  onApply={(v) => setFilters((f) => ({ ...f, certifications: v }))}
                  searchable
                  searchPlaceholder="Search Certifications"
                  width={300}
                />
                <MultiPill
                  label="Status"
                  all={[...ATTEMPT_STATUSES]}
                  value={filters.statuses}
                  onApply={(v) => setFilters((f) => ({ ...f, statuses: v as AttemptStatus[] }))}
                  width={220}
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
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan={COLS.length + 1} className="u-empty">
                            {hasFilters || search.trim()
                              ? "No attempts match these filters."
                              : "No attempts yet."}
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

      {menu && (
        <AttemptActionsMenu
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onView={viewAttempt}
          onDelete={() => setDeleting(menu.attempt)}
        />
      )}

      {deleting && (
        <PrmModal
          title="Delete Attempt"
          confirmLabel="Delete Attempt"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteAttempt(deleting)}
        >
          {/* Body copy is children, not `description` — the shell's own
              convention for a confirm (Figma 483:588). */}
          <p className="prm-text">
            {deleting.name}'s attempt #{deleting.attemptNumber} on “{deleting.quizName}”
            is removed, along with its answers and grade. This can't be undone.
          </p>
        </PrmModal>
      )}
    </div>
  );
}

function ColGroup() {
  return (
    <colgroup>
      {COLS.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: 40 }} />
    </colgroup>
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
        <td key={c.key} className={c.className} data-tip={c.tip?.(a)}>
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
      className="u-menu u-menu--hug"
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
