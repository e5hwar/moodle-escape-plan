import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  users as allUsers,
  type User,
  type UserType,
  type UserRole,
  type SubscriptionStatus,
} from "../data/users";
import { buildUserProfile, type ProfileFields } from "../data/userProfile";
import {
  buildGrantedAttempt,
  buildQuizPurchases,
  nextAttemptNumber,
  type QuizPurchase,
} from "../data/quizPurchases";
import { todayIso, CURRENT_ADMIN } from "../data/certPurchases";
import type { Task } from "../data/tasks";
import {
  UsersFilters,
  UsersEditColumns,
  MultiPill,
  type UserColumnKey,
  type UserFilterState,
} from "./UsersFilters";
import { useColumnOrder, orderedColumns } from "./Filters";
import { UsersSearch } from "./UsersSearch";
import { SortIcon, ChevronLeftIcon, AddIcon, SearchIcon, RowKebabIcon, MenuPlaceholderIcon } from "./icons";

const PAGE_SIZE = 50;

/* ─── columns: every Users column plus the five attempt columns ─── */
type QuizColumnKey =
  | UserColumnKey
  | "attemptNumber"
  | "access"
  | "purchaseDate"
  | "grantDate"
  | "attemptStatus"
  | "score"
  | "result";

/** Access-type filter options for paid vs. admin-comped attempts. */
const ACCESS_OPTIONS = ["Free", "Paid"];

type QuizColumnState = Record<QuizColumnKey, boolean>;

// Name (fixed) + Email + Phone + the five attempt columns show by default;
// every other Users column is available under Edit Columns.
const DEFAULT_COLUMNS: QuizColumnState = {
  email: true,
  phone: true,
  attemptNumber: true,
  access: true,
  purchaseDate: true,
  grantDate: true,
  attemptStatus: true,
  score: true,
  result: true,
  userType: false,
  company: false,
  role: false,
  subscription: false,
  language: false,
  goal: false,
  attribution: false,
  zipCode: false,
  industryPreference: false,
  lastAccess: false,
  dashboardLastAccess: false,
  joinedOn: false,
};

const EMPTY_FILTERS: UserFilterState = {
  types: [],
  subscriptions: [],
  companies: [],
  roles: [],
  goals: [],
  industries: [],
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const VerifiedIcon = () => (
  <svg className="u-verified-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.4 12.4l2.4 2.4 4.8-5.2" />
  </svg>
);

type SortKey = "name" | QuizColumnKey;
type SortDir = "asc" | "desc";

const ROLE_ORDER: Record<UserRole, number> = { "Self-Learner": 0, Employee: 1, Manager: 2, Admin: 3 };
const SUB_ORDER: Record<SubscriptionStatus, number> = { "Free Trial": 0, Starter: 1, Subscriber: 2, Scholarship: 3 };
const GOAL_ORDER: Record<string, number> = { "Looking for my first trades job": 0, "Exploring careers in the skilled trades": 1, "Focused on advancing my career": 2, Other: 3 };
const STATUS_ORDER: Record<string, number> = { "Not Started": 0, "In Progress": 1, Completed: 2 };

type Row = { u: User; f: ProfileFields; p: QuizPurchase };

type ColMeta = {
  key: QuizColumnKey;
  label: string;
  className: string;
  width: number;
  render: (r: Row) => React.ReactNode;
  sortValue: (r: Row) => string | number;
};

// Order here is the on-screen column order: attempt columns sit right after
// Email / Phone, with the rest of the Users columns available afterwards.
const COLS: ColMeta[] = [
  { key: "email", label: "Email", className: "col-u-email", width: 190, render: ({ u }) => <VerifiedCell text={u.email} verified={u.emailVerified} />, sortValue: ({ u }) => u.email.toLowerCase() },
  { key: "phone", label: "Phone", className: "col-u-phone", width: 165, render: ({ u }) => <VerifiedCell text={u.phone} verified={u.phoneVerified} />, sortValue: ({ u }) => u.phone },
  { key: "attemptNumber", label: "Attempt Purchased", className: "col-qp-attempt", width: 150, render: ({ p }) => <span className="qp-attempt">#{p.attemptNumber}</span>, sortValue: ({ p }) => p.attemptNumber },
  { key: "access", label: "Access", className: "col-cp-access", width: 110, render: ({ p }) => <AccessCell purchase={p} />, sortValue: ({ p }) => (p.granted ? 0 : 1) },
  { key: "purchaseDate", label: "Purchase Date", className: "col-u-date", width: 140, render: ({ p }) => formatDate(p.purchaseDate), sortValue: ({ p }) => p.purchaseDate ?? "" },
  { key: "grantDate", label: "Grant Date", className: "col-u-date", width: 140, render: ({ p }) => <GrantDateCell purchase={p} />, sortValue: ({ p }) => p.grantDate ?? "" },
  { key: "attemptStatus", label: "Attempt Status", className: "col-qp-status", width: 140, render: ({ p }) => <StatusCell status={p.status} />, sortValue: ({ p }) => STATUS_ORDER[p.status] },
  { key: "score", label: "Score", className: "col-qp-score", width: 100, render: ({ p }) => <ScoreCell purchase={p} />, sortValue: ({ p }) => (p.score ?? -1) },
  { key: "result", label: "Result", className: "col-qp-result", width: 110, render: ({ p }) => <ResultCell purchase={p} />, sortValue: ({ p }) => (p.passed == null ? -1 : p.passed ? 1 : 0) },
  { key: "userType", label: "User Type", className: "col-u-type", width: 96, render: ({ u }) => <TypePill type={u.userType} />, sortValue: ({ u }) => u.userType },
  { key: "company", label: "Company", className: "col-u-company", width: 175, render: ({ u }) => (u.userType === "B2B" && u.companyName ? u.companyName : <span className="u-muted">—</span>), sortValue: ({ u }) => (u.companyName ?? "").toLowerCase() },
  { key: "role", label: "Role", className: "col-u-role", width: 130, render: ({ u }) => u.role, sortValue: ({ u }) => ROLE_ORDER[u.role] },
  { key: "subscription", label: "Subscription", className: "col-u-sub", width: 195, render: ({ u }) => <SubscriptionCell user={u} />, sortValue: ({ u }) => SUB_ORDER[u.subscriptionStatus] },
  { key: "language", label: "Language", className: "col-u-lang", width: 100, render: ({ f }) => f.language, sortValue: ({ f }) => f.language },
  { key: "goal", label: "Goal", className: "col-u-stage", width: 200, render: ({ f }) => f.goal, sortValue: ({ f }) => GOAL_ORDER[f.goal] ?? 0 },
  { key: "attribution", label: "Attribution", className: "col-u-attr", width: 160, render: ({ f }) => f.attribution, sortValue: ({ f }) => f.attribution.toLowerCase() },
  { key: "zipCode", label: "Zip Code", className: "col-u-zip", width: 100, render: ({ f }) => f.zipCode, sortValue: ({ f }) => f.zipCode },
  { key: "industryPreference", label: "Industry Preference", className: "col-u-industry", width: 165, render: ({ f }) => f.industryPreference, sortValue: ({ f }) => f.industryPreference.toLowerCase() },
  { key: "lastAccess", label: "Last Access", className: "col-u-date", width: 130, render: ({ u }) => formatDate(u.lastAccess), sortValue: ({ u }) => u.lastAccess },
  { key: "joinedOn", label: "Joined SkillCat", className: "col-u-date", width: 150, render: ({ u }) => formatDate(u.joinedOn), sortValue: ({ u }) => u.joinedOn },
];
const COL_BY_KEY = new Map(COLS.map((c) => [c.key, c]));

// Columns where sorting is not meaningful (free-text, contact info, tags)
const NON_SORTABLE_KEYS = new Set<QuizColumnKey>(["email", "phone", "company", "attribution", "zipCode"]);

const FIXED_COLUMNS = [{ label: "Name" }];
const OPTIONAL_COLUMNS = COLS.map((c) => ({ key: c.key as string, label: c.label }));

function compareRows(a: Row, b: Row, key: SortKey): number {
  if (key === "name") return a.u.name.localeCompare(b.u.name);
  const col = COL_BY_KEY.get(key)!;
  const va = col.sortValue(a);
  const vb = col.sortValue(b);
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb));
}

export function QuizPurchasersPage({
  task,
  onBack,
}: {
  task: Task;
  onBack: () => void;
}) {
  const profiles = useMemo(
    () => new Map(allUsers.map((u) => [u.id, buildUserProfile(u).fields] as const)),
    [],
  );
  const userById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), []);

  const [purchases, setPurchases] = useState<QuizPurchase[]>(() => buildQuizPurchases(task));
  const [columns, setColumns] = useState<QuizColumnState>(DEFAULT_COLUMNS);
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(COLS);
  const [filters, setFilters] = useState<UserFilterState>(EMPTY_FILTERS);
  const [accessTypes, setAccessTypes] = useState<string[]>([]);
  const [committedQuery, setCommittedQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "purchaseDate", dir: "desc" });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);
  const [menu, setMenu] = useState<{ row: Row; rect: DOMRect } | null>(null);

  const rows = useMemo<Row[]>(
    () =>
      purchases
        .map((p) => {
          const u = userById.get(p.userId);
          return u ? { u, f: profiles.get(u.id)!, p } : null;
        })
        .filter((r): r is Row => r !== null),
    [purchases, userById, profiles],
  );

  const purchaserUsers = useMemo(() => {
    const seen = new Set<string>();
    const out: User[] = [];
    for (const r of rows) {
      if (seen.has(r.u.id)) continue;
      seen.add(r.u.id);
      out.push(r.u);
    }
    return out;
  }, [rows]);
  const passedCount = useMemo(() => rows.filter((r) => r.p.passed === true).length, [rows]);

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return rows.filter(({ u, f, p }) => {
      if (accessTypes.length && !accessTypes.includes(p.granted ? "Free" : "Paid")) return false;
      if (filters.companies.length && !(u.companyName && filters.companies.includes(u.companyName))) return false;
      if (filters.types.length && !filters.types.includes(u.userType)) return false;
      if (filters.subscriptions.length && !filters.subscriptions.includes(u.subscriptionStatus)) return false;
      if (filters.roles.length && !filters.roles.includes(u.role)) return false;
      if (filters.goals.length && !filters.goals.includes(f.goal)) return false;
      if (filters.industries.length && !filters.industries.includes(f.industryPreference)) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q)
      );
    });
  }, [rows, committedQuery, filters, accessTypes]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [committedQuery, filters, accessTypes, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const visibleCols = useMemo(() => orderedColumns(COLS, order, columns), [columns, order]);
  const colSpan = visibleCols.length + 2; // name + cols + actions
  const tableMin = 200 + visibleCols.reduce((s, c) => s + c.width, 0) + 40;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function grantAttempts(user: User, count: number) {
    setPurchases((prev) => {
      const today = todayIso();
      let next = nextAttemptNumber(prev, user.id);
      const additions: QuizPurchase[] = [];
      for (let i = 0; i < count; i++) {
        additions.push(buildGrantedAttempt(user.id, next, today, CURRENT_ADMIN));
        next += 1;
      }
      return [...additions, ...prev];
    });
    setGranting(false);
  }

  // A purchased/comped attempt can be revoked only before it's started.
  function revokeAttempt(row: Row) {
    const kind = row.p.granted ? "free" : "purchased";
    const ok = window.confirm(
      `Revoke ${row.u.name}'s ${kind} attempt #${row.p.attemptNumber} on “${task.name}”?\n\n` +
        `The attempt is removed immediately. They can purchase the attempt again.`,
    );
    if (!ok) return;
    setPurchases((prev) =>
      prev.map((p) =>
        p.userId === row.u.id && p.attemptNumber === row.p.attemptNumber
          ? { ...p, revokedDate: todayIso() }
          : p,
      ),
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <button className="attempts-back" onClick={onBack}>
                <ChevronLeftIcon />
                Tasks
              </button>
              <h1 className="tasks-title">Who Paid</h1>
              <div className="tasks-subtitle">
                <span>{task.name}</span>
                <span className="tasks-subtitle-dot" />
                <span>{rows.length} {rows.length === 1 ? "purchaser" : "purchasers"}</span>
                <span className="tasks-subtitle-dot" />
                <span>{passedCount} passed</span>
                <span className="tasks-subtitle-dot" />
                <span className="pay-badge pay-badge--paid">Paid Quiz</span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => setGranting(true)}>
                <AddIcon />
                Grant Free Attempts
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <UsersSearch
                  users={purchaserUsers}
                  companies={filters.companies}
                  onCompaniesChange={(c) => setFilters((prev) => ({ ...prev, companies: c }))}
                  query={committedQuery}
                  onCommit={setCommittedQuery}
                />
              </div>

              <UsersFilters
                filters={filters}
                setFilters={setFilters}
                extra={
                  <MultiPill
                    label="Access"
                    all={ACCESS_OPTIONS}
                    value={accessTypes}
                    onApply={setAccessTypes}
                  />
                }
              />

              <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
                <table className="table table-head">
                  <ColGroup cols={visibleCols} />
                  <thead>
                    <tr>
                      <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                      {visibleCols.map((c) => (
                        <SortableHeader key={c.key} col={c.key} label={c.label} className={c.className} sort={sort} toggle={toggleSort} sortable={!NON_SORTABLE_KEYS.has(c.key)} />
                      ))}
                      <th className="col-actions">
                        <UsersEditColumns
                          columns={columns}
                          setColumns={setColumns}
                          fixed={FIXED_COLUMNS}
                          optional={OPTIONAL_COLUMNS}
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
                      {paged.map((row) => (
                        <PurchaserRow
                          key={`${row.u.id}-${row.p.attemptNumber}`}
                          row={row}
                          cols={visibleCols}
                          selected={row.u.id === selectedId}
                          onClick={() => setSelectedId(row.u.id === selectedId ? null : row.u.id)}
                          onOpenMenu={(rect) => setMenu({ row, rect })}
                          menuOpen={menu?.row.p.userId === row.p.userId && menu.row.p.attemptNumber === row.p.attemptNumber}
                        />
                      ))}
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan={colSpan} className="u-empty">
                            {committedQuery.trim()
                              ? `No purchasers match "${committedQuery.trim()}".`
                              : "No purchasers match these filters."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pagination">
                <span>
                  Showing {sorted.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
                </span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {granting && (
        <GrantAttemptsModal
          task={task}
          candidates={allUsers}
          onGrant={grantAttempts}
          onClose={() => setGranting(false)}
        />
      )}

      {menu && (
        <AttemptActionsMenu
          row={menu.row}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onRevoke={() => revokeAttempt(menu.row)}
        />
      )}
    </div>
  );
}

function PurchaserRow({
  row,
  cols,
  selected,
  onClick,
  onOpenMenu,
  menuOpen,
}: {
  row: Row;
  cols: ColMeta[];
  selected: boolean;
  onClick: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const { u, p } = row;
  return (
    <tr className={`${selected ? "selected" : ""} ${p.revokedDate ? "is-revoked" : ""} ${menuOpen ? "menu-open" : ""}`.trim()} onClick={onClick}>
      <td className="col-name">
        <span className="cp-name-wrap">
          <span className="cp-name">{u.name}</span>
          {p.granted && (
            <span className="cp-granted-badge" title="Free attempt granted by an admin">Granted</span>
          )}
          {p.revokedDate && (
            <span className="cp-revoked-badge" title={`Attempt revoked ${formatDate(p.revokedDate)}`}>Revoked</span>
          )}
        </span>
      </td>
      {cols.map((c) => (
        <td key={c.key} className={c.className}>
          {c.render(row)}
        </td>
      ))}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
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
            aria-label="More"
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

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Fixed-positioned so it escapes the table's scroll container. Revoke is only
   enabled while the attempt has not been started (or already revoked). */

function AttemptActionsMenu({
  row,
  rect,
  onClose,
  onRevoke,
}: {
  row: Row;
  rect: DOMRect;
  onClose: () => void;
  onRevoke: () => void;
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

  const alreadyRevoked = !!row.p.revokedDate;
  const notStarted = row.p.status === "Not Started";
  const canRevoke = notStarted && !alreadyRevoked;

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
      <div className="u-menu-head">
        <div className="u-menu-head-name">{row.u.name}</div>
        <div className="u-menu-head-id">{row.u.email}</div>
      </div>
      <button
        className="u-menu-item u-menu-item--danger"
        disabled={!canRevoke}
        onClick={(e) => {
          e.stopPropagation();
          if (!canRevoke) return;
          onRevoke();
          onClose();
        }}
      >
        <span className="u-menu-item-icon"><MenuPlaceholderIcon /></span>
        {/* The reason sits INSIDE the button as a second line (Figma 388:354)
            so the icon centres against the whole block, not just the label. */}
        <span className="u-menu-item-text">
          <span>Revoke access</span>
          {alreadyRevoked ? (
            <span className="u-menu-item-sub">Attempt already revoked</span>
          ) : (
            !notStarted && (
              <span className="u-menu-item-sub">Only a not-started attempt can be revoked</span>
            )
          )}
        </span>
      </button>
    </div>
  );
}

function ColGroup({ cols }: { cols: ColMeta[] }) {
  return (
    <colgroup>
      <col style={{ width: 200 }} />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: 40 }} />
    </colgroup>
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

function TypePill({ type }: { type: UserType }) {
  return <span className={`u-pill u-type--${type.toLowerCase()}`}>{type}</span>;
}

function SubscriptionCell({ user }: { user: User }) {
  const slug = user.subscriptionStatus.toLowerCase().replace(/\s+/g, "-");
  return (
    <span className="u-sub">
      <span className={`u-sub-pill u-sub--${slug}`}>{user.subscriptionStatus}</span>
      {user.subscriptionStatus === "Subscriber" && user.platform && (
        <span className="u-platform">{user.platform}</span>
      )}
    </span>
  );
}

function VerifiedCell({ text, verified }: { text: string; verified: boolean }) {
  return (
    <span className="u-vcell">
      <span className="u-vcell-text">{text}</span>
      {verified && (
        <span className="u-verified" title="Verified">
          <VerifiedIcon />
        </span>
      )}
    </span>
  );
}

function AccessCell({ purchase }: { purchase: QuizPurchase }) {
  if (purchase.granted) {
    return (
      <span
        className="cp-access cp-access--free"
        title={purchase.grantedBy ? `Free attempt granted by ${purchase.grantedBy}` : "Free attempt granted by an admin"}
      >
        Free
      </span>
    );
  }
  return <span className="cp-access cp-access--paid">Paid</span>;
}

function GrantDateCell({ purchase }: { purchase: QuizPurchase }) {
  if (!purchase.grantDate) return <span className="u-muted">—</span>;
  return (
    <span
      className="cp-grant-date"
      title={purchase.grantedBy ? `Granted by ${purchase.grantedBy}` : undefined}
    >
      {formatDate(purchase.grantDate)}
    </span>
  );
}

function StatusCell({ status }: { status: QuizPurchase["status"] }) {
  const slug =
    status === "Completed" ? "completed" : status === "In Progress" ? "inprogress" : "notstarted";
  return <span className={`qp-status qp-status--${slug}`}>{status}</span>;
}

function ScoreCell({ purchase }: { purchase: QuizPurchase }) {
  if (purchase.score == null) return <span className="u-muted">—</span>;
  return <span className="qp-score">{purchase.score}%</span>;
}

function ResultCell({ purchase }: { purchase: QuizPurchase }) {
  if (purchase.passed == null) return <span className="u-muted">—</span>;
  return (
    <span className={`qp-result qp-result--${purchase.passed ? "pass" : "fail"}`}>
      {purchase.passed ? "Pass" : "Fail"}
    </span>
  );
}

/* ─────────── Grant Free Attempts flow (search → quantity) ─────────── */

const MAX_GRANT = 10;

function GrantAttemptsModal({
  task,
  candidates,
  onGrant,
  onClose,
}: {
  task: Task;
  candidates: User[];
  onGrant: (u: User, count: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<User | null>(null);
  const [count, setCount] = useState(1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? candidates.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.phone.toLowerCase().includes(q) ||
            (u.companyName ?? "").toLowerCase().includes(q),
        )
      : candidates;
    return base.slice(0, 40);
  }, [candidates, query]);

  const clamped = Math.min(MAX_GRANT, Math.max(1, count));

  return (
    <div className="cl-modal-overlay" onMouseDown={onClose}>
      <div className="cl-modal" onMouseDown={(e) => e.stopPropagation()}>
        {!picked ? (
          <>
            <div className="cl-modal-head">
              <div className="cl-modal-eyebrow">Grant attempts · no payment</div>
              <h2 className="cl-modal-title">Grant free attempts on “{task.name}”</h2>
              <p className="cl-modal-sub">
                Give a user extra Quiz attempts without a purchase. Choose who to comp.
              </p>
            </div>
            <div className="cl-modal-search">
              <span className="search-icon"><SearchIcon /></span>
              <input
                ref={inputRef}
                className="cl-modal-input"
                placeholder="Search users by name, email, phone, or company…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="cl-modal-list">
              {results.length === 0 ? (
                <div className="cl-modal-empty">
                  {query.trim()
                    ? `No users match “${query.trim()}”.`
                    : "No users found."}
                </div>
              ) : (
                results.map((u) => (
                  <button key={u.id} className="cl-modal-item" onClick={() => setPicked(u)}>
                    <span className="cp-modal-avatar">{u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                    <span className="cl-modal-item-text">
                      <span className="cl-modal-item-name">{u.name}</span>
                      <span className="cl-modal-item-meta">
                        {u.email} · {u.userType === "B2B" && u.companyName ? u.companyName : "B2C"}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <div className="cl-modal-head">
              <button className="cl-modal-back" onClick={() => setPicked(null)}>‹ Back</button>
              <h2 className="cl-modal-title">Confirm grant</h2>
            </div>
            <div className="cp-confirm-body">
              <div className="cp-confirm-user">
                <span className="cp-modal-avatar lg">{picked.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                <div>
                  <div className="cl-modal-item-name">{picked.name}</div>
                  <div className="cl-modal-item-meta">{picked.email} · {picked.id}</div>
                </div>
              </div>

              <label className="qp-grant-field">
                <span className="qp-grant-label">Free attempts to grant</span>
                <div className="qp-grant-stepper">
                  <button
                    type="button"
                    className="qp-grant-step"
                    aria-label="Decrease"
                    onClick={() => setCount((c) => Math.max(1, c - 1))}
                    disabled={clamped <= 1}
                  >
                    –
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={MAX_GRANT}
                    className="qp-grant-input"
                    value={count}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setCount(Number.isFinite(n) ? n : 1);
                    }}
                  />
                  <button
                    type="button"
                    className="qp-grant-step"
                    aria-label="Increase"
                    onClick={() => setCount((c) => Math.min(MAX_GRANT, c + 1))}
                    disabled={clamped >= MAX_GRANT}
                  >
                    +
                  </button>
                </div>
                <span className="qp-grant-hint">Up to {MAX_GRANT} per grant.</span>
              </label>

              <p className="cp-confirm-text">
                <strong>{picked.name}</strong> will receive{" "}
                <strong>{clamped}</strong> free {clamped === 1 ? "attempt" : "attempts"} on{" "}
                <strong>{task.name}</strong> at no charge. The{" "}
                {clamped === 1 ? "attempt is logged as an admin grant" : "attempts are logged as admin grants"} and
                {clamped === 1 ? " starts" : " start"} in <em>Not Started</em>.
              </p>
            </div>
            <div className="cl-modal-foot cp-confirm-foot">
              <button className="btn-secondary" onClick={() => setPicked(null)}>Cancel</button>
              <button className="btn-publish" onClick={() => onGrant(picked, clamped)}>
                Grant {clamped} {clamped === 1 ? "attempt" : "attempts"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
