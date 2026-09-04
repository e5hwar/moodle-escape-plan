import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  users as allUsers,
  type User,
  type UserRole,
  type SubscriptionStatus,
} from "../data/users";
import { buildUserProfile, type ProfileFields } from "../data/userProfile";
import {
  buildAllQuizPurchases,
  buildGrantedAttempt,
  nextAttemptNumber,
  type QuizPurchase,
} from "../data/quizPurchases";
import { todayIso, CURRENT_ADMIN } from "../data/certPurchases";
import { tasks as allTasks, isPaid, type Task } from "../data/tasks";
import {
  UsersFilters,
  UsersEditColumns,
  MultiPill,
  type UserColumnKey,
  type UserFilterState,
} from "./UsersFilters";
import { useColumnOrder, orderedColumns } from "./Filters";
import { EntitySearch, type SearchScope } from "./UsersSearch";
import { SortIcon, ChevronLeftIcon, AddIcon, RowKebabIcon, MenuLockIcon, ChevronRightIcon } from "./icons";
import { GrantAttemptsModal } from "./GrantAttemptsModal";
import { PrmModal } from "./PrmModal";

const PAGE_SIZE = 50;

/* ─── columns: every Users column plus the five attempt columns ─── */
type QuizColumnKey =
  | UserColumnKey
  | "quizName"
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
  quizName: true,
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
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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
  /** Tooltip on the cell — where a grant's admin/date detail now lives. */
  tip?: (r: Row) => string | undefined;
  render: (r: Row) => React.ReactNode;
  sortValue: (r: Row) => string | number;
};

/* Plain-text columns, per the table convention — every cell is a string, with
   the detail a pill used to carry (who comped an attempt, why a row is muted)
   demoted to a hover tooltip. Widths fit the HEADER label, not just the data:
   header type is 16px SemiBold and never wraps, so a column narrower than its
   own label spills over the next one.

   Order here is the on-screen column order: the quiz and attempt columns sit
   right after Email / Phone, with the rest of the Users columns available
   afterwards under Edit Columns. */
const COLS: ColMeta[] = [
  { key: "email", label: "Email", className: "col-u-email", width: 190, render: ({ u }) => u.email, sortValue: ({ u }) => u.email.toLowerCase() },
  { key: "phone", label: "Phone", className: "col-u-phone", width: 165, render: ({ u }) => u.phone, sortValue: ({ u }) => u.phone },
  { key: "quizName", label: "Quiz Name", className: "col-qp-quiz", width: 230, tip: ({ p }) => p.quizName, render: ({ p }) => p.quizName, sortValue: ({ p }) => p.quizName.toLowerCase() },
  { key: "attemptNumber", label: "Attempt Purchased", className: "col-qp-attempt", width: 190, render: ({ p }) => `#${p.attemptNumber}`, sortValue: ({ p }) => p.attemptNumber },
  { key: "access", label: "Access", className: "col-cp-access", width: 110, tip: ({ p }) => (p.granted ? `Free attempt granted by ${p.grantedBy ?? "an admin"}` : undefined), render: ({ p }) => (p.granted ? "Free" : "Paid"), sortValue: ({ p }) => (p.granted ? 0 : 1) },
  { key: "purchaseDate", label: "Purchase Date", className: "col-u-date", width: 160, render: ({ p }) => formatDate(p.purchaseDate), sortValue: ({ p }) => p.purchaseDate ?? "" },
  { key: "grantDate", label: "Grant Date", className: "col-u-date", width: 145, tip: ({ p }) => (p.grantDate && p.grantedBy ? `Granted by ${p.grantedBy}` : undefined), render: ({ p }) => formatDate(p.grantDate), sortValue: ({ p }) => p.grantDate ?? "" },
  { key: "attemptStatus", label: "Attempt Status", className: "col-qp-status", width: 170, render: ({ p }) => p.status, sortValue: ({ p }) => STATUS_ORDER[p.status] },
  { key: "score", label: "Score", className: "col-qp-score", width: 100, render: ({ p }) => (p.score == null ? "" : `${p.score}%`), sortValue: ({ p }) => (p.score ?? -1) },
  { key: "result", label: "Result", className: "col-qp-result", width: 110, render: ({ p }) => (p.passed == null ? "" : p.passed ? "Pass" : "Fail"), sortValue: ({ p }) => (p.passed == null ? -1 : p.passed ? 1 : 0) },
  { key: "userType", label: "User Type", className: "col-u-type", width: 120, render: ({ u }) => u.userType, sortValue: ({ u }) => u.userType },
  { key: "company", label: "Company", className: "col-u-company", width: 175, render: ({ u }) => (u.userType === "B2B" && u.companyName ? u.companyName : ""), sortValue: ({ u }) => (u.companyName ?? "").toLowerCase() },
  { key: "role", label: "Role", className: "col-u-role", width: 130, render: ({ u }) => u.role, sortValue: ({ u }) => ROLE_ORDER[u.role] },
  { key: "subscription", label: "Subscription", className: "col-u-sub", width: 195, render: ({ u }) => u.subscriptionStatus, sortValue: ({ u }) => SUB_ORDER[u.subscriptionStatus] },
  { key: "language", label: "Language", className: "col-u-lang", width: 120, render: ({ f }) => f.language, sortValue: ({ f }) => f.language },
  { key: "goal", label: "Goal", className: "col-u-stage", width: 200, tip: ({ f }) => f.goal, render: ({ f }) => f.goal, sortValue: ({ f }) => GOAL_ORDER[f.goal] ?? 0 },
  { key: "attribution", label: "Attribution", className: "col-u-attr", width: 160, render: ({ f }) => f.attribution, sortValue: ({ f }) => f.attribution.toLowerCase() },
  { key: "zipCode", label: "Zip Code", className: "col-u-zip", width: 115, render: ({ f }) => f.zipCode, sortValue: ({ f }) => f.zipCode },
  { key: "industryPreference", label: "Industry Preference", className: "col-u-industry", width: 210, render: ({ f }) => f.industryPreference, sortValue: ({ f }) => f.industryPreference.toLowerCase() },
  { key: "lastAccess", label: "Last Access", className: "col-u-date", width: 145, render: ({ u }) => formatDate(u.lastAccess), sortValue: ({ u }) => u.lastAccess },
  { key: "joinedOn", label: "Joined SkillCat", className: "col-u-date", width: 175, render: ({ u }) => formatDate(u.joinedOn), sortValue: ({ u }) => u.joinedOn },
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

  /* The Task this page was opened from may sit outside the seeded paid-Quiz
     set (a Quiz created in this session), so union it in — otherwise the
     pre-applied Quiz pill would offer no way back to its own value. */
  const paidQuizzes = useMemo(() => {
    const seeded = allTasks.filter(isPaid);
    return seeded.some((t) => t.id === task.id) ? seeded : [task, ...seeded];
  }, [task]);
  const quizOptions = useMemo(
    () => [...new Set(paidQuizzes.map((t) => t.name))].sort(),
    [paidQuizzes],
  );

  /* Every paid Quiz's purchasers, pre-filtered to the Task clicked on Tasks —
     same shape as Quiz Attempts, so the Quiz pill can widen to the rest. */
  const [purchases, setPurchases] = useState<QuizPurchase[]>(() =>
    buildAllQuizPurchases(paidQuizzes),
  );
  const [columns, setColumns] = useState<QuizColumnState>(DEFAULT_COLUMNS);
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(COLS);
  const [filters, setFilters] = useState<UserFilterState>(EMPTY_FILTERS);
  const [quizzes, setQuizzes] = useState<string[]>([task.name]);
  const [accessTypes, setAccessTypes] = useState<string[]>([]);
  const [committedQuery, setCommittedQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "purchaseDate", dir: "desc" });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);
  // The row awaiting the Revoke Access confirm, if any.
  const [revoking, setRevoking] = useState<Row | null>(null);
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
  const companyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    purchaserUsers.forEach((u) => {
      if (u.companyName) counts.set(u.companyName, (counts.get(u.companyName) ?? 0) + 1);
    });
    return { names: [...counts.keys()].sort(), counts };
  }, [purchaserUsers]);

  const scopes: SearchScope[] = [
    {
      token: "Quiz",
      options: quizOptions,
      applied: quizzes,
      onAppliedChange: setQuizzes,
      optionsLabel: "Quizzes",
      example: "Quiz: Airflow Calibration Quiz",
      hint: "Filter by Quiz",
    },
    {
      token: "Company",
      options: companyOptions.names,
      applied: filters.companies,
      onAppliedChange: (v) => setFilters((prev) => ({ ...prev, companies: v })),
      optionsLabel: "Companies",
      example: "Company: Acme Inc.",
      hint: "Filter by Company",
      describe: (name) => `${companyOptions.counts.get(name)} users`,
    },
  ];

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return rows.filter(({ u, f, p }) => {
      if (quizzes.length && !quizzes.includes(p.quizName)) return false;
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
        u.phone.toLowerCase().includes(q) ||
        p.quizName.toLowerCase().includes(q)
      );
    });
  }, [rows, committedQuery, filters, quizzes, accessTypes]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [committedQuery, filters, quizzes, accessTypes, sort]);

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

  /* What the picker shows in its Attempts column — live attempts this user
     already holds on the Quiz being comped, so an admin can see who is out of
     attempts before granting. Revoked rows don't count. */
  const attemptCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of purchases) {
      if (p.quizName !== task.name || p.revokedDate) continue;
      m.set(p.userId, (m.get(p.userId) ?? 0) + 1);
    }
    return m;
  }, [purchases, task.name]);
  const attemptsOf = useCallback(
    (userId: string) => attemptCounts.get(userId) ?? 0,
    [attemptCounts],
  );

  /* One grant can cover any number of users; each gets `count` fresh attempt
     rows, numbered on from whatever they already have on this Quiz. */
  function grantAttempts(picked: User[], count: number) {
    setPurchases((prev) => {
      const today = todayIso();
      const additions: QuizPurchase[] = [];
      for (const user of picked) {
        let next = nextAttemptNumber(prev, user.id, task.name);
        for (let i = 0; i < count; i++) {
          additions.push(
            buildGrantedAttempt(user.id, task.name, next, today, CURRENT_ADMIN),
          );
          next += 1;
        }
      }
      return [...additions, ...prev];
    });
    setGranting(false);
  }

  /* A purchased/comped attempt can be revoked only before it's started. The
     confirm is the app's own modal (PrmModal, danger CTA) — a browser
     window.confirm can't be styled and reads as a different product. */
  function revokeAttempt(row: Row) {
    setPurchases((prev) =>
      prev.map((p) =>
        p.userId === row.u.id &&
        p.quizName === row.p.quizName &&
        p.attemptNumber === row.p.attemptNumber
          ? { ...p, revokedDate: todayIso() }
          : p,
      ),
    );
    setRevoking(null);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          {/* Reached from a Task's "Who Paid" action, so the Tasks crumb is the
              way back — same header as Quiz Attempts. The Quiz this opened on
              is carried by the pre-applied Quiz Name pill, not a subtitle. */}
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <button className="rvc-crumb" onClick={onBack} title="Back to Tasks">
                  Tasks
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Who Paid</span>
              </nav>
              <h1 className="tasks-title">Who Paid</h1>
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
                {/* The shared page search — its scopes feed the Filters-row
                    pills below, exactly as on Quiz Attempts. */}
                <EntitySearch
                  scopes={scopes}
                  placeholder="Search Users by Name, Email, or Phone…"
                  query={committedQuery}
                  onCommit={setCommittedQuery}
                />
              </div>

              <UsersFilters
                filters={filters}
                setFilters={setFilters}
                leading={
                  <MultiPill
                    label="Quiz Name"
                    all={quizOptions}
                    value={quizzes}
                    onApply={setQuizzes}
                    searchable
                    searchPlaceholder="Search Quizzes"
                    width={300}
                  />
                }
                extra={
                  <MultiPill
                    label="Access"
                    all={ACCESS_OPTIONS}
                    value={accessTypes}
                    onApply={setAccessTypes}
                  />
                }
                extraActive={quizzes.length > 0 || accessTypes.length > 0}
                onClearExtra={() => {
                  setQuizzes([]);
                  setAccessTypes([]);
                }}
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
                          key={`${row.u.id}-${row.p.quizName}-${row.p.attemptNumber}`}
                          row={row}
                          cols={visibleCols}
                          selected={row.u.id === selectedId}
                          onClick={() => setSelectedId(row.u.id === selectedId ? null : row.u.id)}
                          onOpenMenu={(rect) => setMenu({ row, rect })}
                          menuOpen={
                            menu?.row.p.userId === row.p.userId &&
                            menu.row.p.quizName === row.p.quizName &&
                            menu.row.p.attemptNumber === row.p.attemptNumber
                          }
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

      {granting && (
        <GrantAttemptsModal
          quizName={task.name}
          candidates={allUsers}
          attemptsOf={attemptsOf}
          onGrant={grantAttempts}
          onClose={() => setGranting(false)}
        />
      )}

      {menu && (
        <AttemptActionsMenu
          row={menu.row}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onRevoke={() => setRevoking(menu.row)}
        />
      )}

      {revoking && (
        <PrmModal
          title="Revoke Access"
          confirmLabel="Revoke Access"
          danger
          onCancel={() => setRevoking(null)}
          onConfirm={() => revokeAttempt(revoking)}
        >
          {/* Body copy is children, not `description` — the shell's own
              convention for a confirm (Figma 483:588). */}
          <p className="prm-text">
            {revoking.u.name}'s {revoking.p.granted ? "free" : "purchased"} attempt #
            {revoking.p.attemptNumber} on “{revoking.p.quizName}” is removed
            immediately.{" "}
            {revoking.p.granted
              ? "You can grant another free attempt afterwards."
              : "They can purchase the attempt again."}
          </p>
        </PrmModal>
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
      {/* Plain name. "Granted" used to sit here as a badge, but the plain-text
          column convention strips it to bare text, where it read as part of
          the name — and the Access column already says Free vs Paid. Revoked
          keeps its marker: nothing else on the row carries it. */}
      <td className="col-name" data-tip={p.revokedDate ? `Attempt revoked ${formatDate(p.revokedDate)}` : u.name}>
        <span className="cp-name-wrap">
          <span className="cp-name">{u.name}</span>
          {p.revokedDate && <span className="cp-revoked-badge">Revoked</span>}
        </span>
      </td>
      {cols.map((c) => (
        <td key={c.key} className={c.className} data-tip={c.tip?.(row)}>
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

  /* Figma 786:1719 (available) / 785:1699 (disabled): the panel is the single
     Revoke Access row — no name/email head — so it hugs its content. */
  return (
    <div
      ref={ref}
      className="u-menu u-menu--hug"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
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
        <span className="u-menu-item-icon"><MenuLockIcon /></span>
        {/* The reason sits INSIDE the button as a second line, so the row can
            top-align the glyph against the label (785:1699). */}
        <span className="u-menu-item-text">
          <span>Revoke Access</span>
          {alreadyRevoked ? (
            <span className="u-menu-item-sub">Access has already been revoked for this attempt</span>
          ) : (
            !notStarted && (
              <span className="u-menu-item-sub">
                Access cannot be revoked for attempts that are underway or completed
              </span>
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
