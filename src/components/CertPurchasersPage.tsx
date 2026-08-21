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
  buildCertPurchases,
  isConsumableCert,
  consumableResetsProgress,
  todayIso,
  usersWithoutAccess,
  CURRENT_ADMIN,
  type CertPurchase,
} from "../data/certPurchases";
import type { Certification } from "../data/certifications";
import {
  UsersFilters,
  UsersEditColumns,
  MultiPill,
  type UserColumnKey,
  type UserFilterState,
} from "./UsersFilters";
import { useColumnOrder, orderedColumns } from "./Filters";
import { UsersSearch } from "./UsersSearch";
import { SortIcon, ChevronLeftIcon, AddIcon, SearchIcon, RowKebabIcon, MenuPlaceholderIcon, ChevronRightIcon } from "./icons";

const PAGE_SIZE = 50;

/* ─── columns: every Users column plus the four purchase columns ─── */
type PurchaserColumnKey =
  | UserColumnKey
  | "access"
  | "purchaseDate"
  | "grantDate"
  | "progress"
  | "completion"
  | "accessEnded";

/** Access-type filter options for paid vs. admin-comped access. */
const ACCESS_OPTIONS = ["Free", "Paid"];

type PurchaserColumnState = Record<PurchaserColumnKey, boolean>;

// Name (fixed) + Email + Phone + the four purchase columns show by default;
// every other Users column is available under Edit Columns.
const DEFAULT_COLUMNS: PurchaserColumnState = {
  email: true,
  phone: true,
  access: true,
  purchaseDate: true,
  grantDate: true,
  progress: true,
  completion: true,
  accessEnded: true,
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

type SortKey = "name" | PurchaserColumnKey;
type SortDir = "asc" | "desc";

const ROLE_ORDER: Record<UserRole, number> = { "Self-Learner": 0, Employee: 1, Manager: 2, Admin: 3 };
const SUB_ORDER: Record<SubscriptionStatus, number> = { "Free Trial": 0, Starter: 1, Subscriber: 2, Scholarship: 3 };
const GOAL_ORDER: Record<string, number> = { "Looking for my first trades job": 0, "Exploring careers in the skilled trades": 1, "Focused on advancing my career": 2, Other: 3 };

type Row = { u: User; f: ProfileFields; p: CertPurchase };

type ColMeta = {
  key: PurchaserColumnKey;
  label: string;
  className: string;
  width: number;
  render: (r: Row) => React.ReactNode;
  sortValue: (r: Row) => string | number;
};

// Order here is the on-screen column order: purchase columns sit right after
// Email / Phone, with the rest of the Users columns available afterwards.
const COLS: ColMeta[] = [
  { key: "email", label: "Email", className: "col-u-email", width: 190, render: ({ u }) => <VerifiedCell text={u.email} verified={u.emailVerified} />, sortValue: ({ u }) => u.email.toLowerCase() },
  { key: "phone", label: "Phone", className: "col-u-phone", width: 165, render: ({ u }) => <VerifiedCell text={u.phone} verified={u.phoneVerified} />, sortValue: ({ u }) => u.phone },
  { key: "access", label: "Access", className: "col-cp-access", width: 110, render: ({ p }) => <AccessCell purchase={p} />, sortValue: ({ p }) => (p.granted ? 0 : 1) },
  { key: "purchaseDate", label: "Purchase Date", className: "col-u-date", width: 140, render: ({ p }) => formatDate(p.purchaseDate), sortValue: ({ p }) => p.purchaseDate ?? "" },
  { key: "grantDate", label: "Grant Date", className: "col-u-date", width: 140, render: ({ p }) => <GrantDateCell purchase={p} />, sortValue: ({ p }) => p.grantDate ?? "" },
  { key: "progress", label: "Progress", className: "col-cp-progress", width: 150, render: ({ p }) => <ProgressCell value={p.progress} />, sortValue: ({ p }) => p.progress },
  { key: "completion", label: "Completion", className: "col-cp-completion", width: 130, render: ({ p }) => <CompletionCell completed={p.completed} />, sortValue: ({ p }) => (p.completed ? 1 : 0) },
  { key: "accessEnded", label: "Access Ended", className: "col-u-date", width: 140, render: ({ p }) => <AccessEndedCell purchase={p} />, sortValue: ({ p }) => p.accessEndedDate ?? "" },
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

// Edit-Columns control config — Name is fixed; everything in COLS is optional.
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

export function CertPurchasersPage({
  cert,
  onBack,
}: {
  cert: Certification;
  onBack: () => void;
}) {
  const consumable = isConsumableCert(cert);
  const profiles = useMemo(
    () => new Map(allUsers.map((u) => [u.id, buildUserProfile(u).fields] as const)),
    [],
  );
  const userById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), []);

  // Local working copy so revoke / grant persist in-session.
  const [purchases, setPurchases] = useState<CertPurchase[]>(() => buildCertPurchases(cert));
  const [columns, setColumns] = useState<PurchaserColumnState>(DEFAULT_COLUMNS);
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

  // Users represented in this list — used by the search bar's suggestions.
  const purchaserUsers = useMemo(() => rows.map((r) => r.u), [rows]);

  const completedCount = useMemo(() => rows.filter((r) => r.p.completed).length, [rows]);

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

  function revokeAccess(row: Row) {
    const consumable = isConsumableCert(cert);
    const resets = consumableResetsProgress(cert);

    const lines = [`Revoke ${row.u.name}'s access to “${cert.name}”?`, "", "Their access ends immediately."];
    if (consumable) {
      if (resets) lines.push("Their progress on this Certification will be reset.");
      lines.push("They can purchase the Certification again to regain access.");
    } else {
      lines.push("They keep their completion record. This can't be undone.");
    }

    const ok = window.confirm(lines.join("\n"));
    if (!ok) return;

    const today = todayIso();
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.userId !== row.u.id) return p;
        const next: CertPurchase = { ...p, revokedDate: today };
        // Consumables end their access window on revoke; some also reset progress.
        if (consumable) next.accessEndedDate = today;
        if (resets) {
          next.progress = 0;
          next.completed = false;
        }
        return next;
      }),
    );
  }

  function grantAccess(user: User) {
    setPurchases((prev) => {
      if (prev.some((p) => p.userId === user.id)) return prev; // already has access
      return [
        {
          userId: user.id,
          purchaseDate: null,
          progress: 0,
          completed: false,
          accessEndedDate: null,
          revokedDate: null,
          granted: true,
          grantDate: todayIso(),
          grantedBy: CURRENT_ADMIN,
        },
        ...prev,
      ];
    });
    setGranting(false);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <button className="attempts-back" onClick={onBack}>
                <ChevronLeftIcon />
                Certifications
              </button>
              <h1 className="tasks-title">Who Paid</h1>
              <div className="tasks-subtitle">
                <span>{cert.name}</span>
                <span className="tasks-subtitle-dot" />
                <span>{rows.length} {rows.length === 1 ? "purchaser" : "purchasers"}</span>
                <span className="tasks-subtitle-dot" />
                <span>{completedCount} completed</span>
                <span className="tasks-subtitle-dot" />
                <span className={`pay-badge pay-badge--${consumable ? "consumable" : "nonconsumable"}`}>
                  {consumable ? "Consumable" : "Non-consumable"}
                </span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => setGranting(true)}>
                <AddIcon />
                Grant Access
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
                        <SortableHeader
                          key={c.key}
                          col={c.key}
                          label={c.label}
                          className={c.className}
                          sort={sort}
                          toggle={toggleSort}
                          sortable={!(["email", "phone", "company", "attribution", "zipCode"] as PurchaserColumnKey[]).includes(c.key)}
                        />
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
                          key={row.u.id}
                          row={row}
                          cols={visibleCols}
                          selected={row.u.id === selectedId}
                          onClick={() => setSelectedId(row.u.id === selectedId ? null : row.u.id)}
                          onOpenMenu={(rect) => setMenu({ row, rect })}
                          menuOpen={menu?.row.p.userId === row.p.userId}
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
        <GrantAccessModal
          cert={cert}
          candidates={usersWithoutAccess(purchases, allUsers)}
          onGrant={grantAccess}
          onClose={() => setGranting(false)}
        />
      )}

      {menu && (
        <PurchaserActionsMenu
          row={menu.row}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onRevoke={() => revokeAccess(menu.row)}
        />
      )}
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

function ProgressCell({ value }: { value: number }) {
  return (
    <span className="cp-progress">
      <span className="cp-progress-bar">
        <span className="cp-progress-fill" style={{ width: `${value}%` }} />
      </span>
      <span className="cp-progress-pct">{value}%</span>
    </span>
  );
}

function CompletionCell({ completed }: { completed: boolean }) {
  return (
    <span className={`cp-status cp-status--${completed ? "complete" : "progress"}`}>
      {completed ? "Complete" : "In progress"}
    </span>
  );
}

function AccessCell({ purchase }: { purchase: CertPurchase }) {
  if (purchase.granted) {
    return (
      <span
        className="cp-access cp-access--free"
        title={purchase.grantedBy ? `Free access granted by ${purchase.grantedBy}` : "Free access granted by an admin"}
      >
        Free
      </span>
    );
  }
  return <span className="cp-access cp-access--paid">Paid</span>;
}

function GrantDateCell({ purchase }: { purchase: CertPurchase }) {
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

function AccessEndedCell({ purchase }: { purchase: CertPurchase }) {
  if (!purchase.accessEndedDate) return <span className="u-muted">—</span>;
  return <span className="cp-ended">{formatDate(purchase.accessEndedDate)}</span>;
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
          {p.granted && <span className="cp-granted-badge" title="Access granted by an admin">Granted</span>}
          {p.revokedDate && (
            <span className="cp-revoked-badge" title={`Access revoked ${formatDate(p.revokedDate)}`}>Revoked</span>
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
/* Fixed-positioned so it escapes the table's scroll container. */

function PurchaserActionsMenu({
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

  // Revoke Access is always shown for Certifications; it greys out once access
  // has already been revoked.
  const alreadyRevoked = !!row.p.revokedDate;

  const item = (
    icon: JSX.Element,
    label: string,
    onPick: () => void,
    danger = false,
    disabled = false,
    /* Reason the row is disabled — a second line INSIDE the button (Figma
       388:354) so the icon centres against the whole block. */
    note?: string,
  ) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      <span className="u-menu-item-text">
        <span>{label}</span>
        {note && <span className="u-menu-item-sub">{note}</span>}
      </span>
    </button>
  );

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
      {item(
        <MenuPlaceholderIcon />,
        "Revoke access",
        onRevoke,
        true,
        alreadyRevoked,
        alreadyRevoked ? "Access already revoked" : undefined,
      )}
    </div>
  );
}

/* ─────────────── Grant Access flow (search → confirm) ─────────────── */

function GrantAccessModal({
  cert,
  candidates,
  onGrant,
  onClose,
}: {
  cert: Certification;
  candidates: User[];
  onGrant: (u: User) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<User | null>(null);
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

  return (
    <div className="cl-modal-overlay" onMouseDown={onClose}>
      <div className="cl-modal" onMouseDown={(e) => e.stopPropagation()}>
        {!picked ? (
          <>
            <div className="cl-modal-head">
              <div className="cl-modal-eyebrow">Grant access · no payment</div>
              <h2 className="cl-modal-title">Grant access to “{cert.name}”</h2>
              <p className="cl-modal-sub">
                Give a user access to this Certification without a purchase. Choose who to comp.
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
                    ? `No users without access match “${query.trim()}”.`
                    : "Every user already has access to this Certification."}
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
              <p className="cp-confirm-text">
                <strong>{picked.name}</strong> will get full access to <strong>{cert.name}</strong> at
                no charge. They start at 0% progress and the purchase is recorded as an
                admin grant{isConsumableCert(cert) ? " (a consumable access window opens immediately)" : ""}.
              </p>
            </div>
            <div className="cl-modal-foot cp-confirm-foot">
              <button className="btn-secondary" onClick={() => setPicked(null)}>Cancel</button>
              <button className="btn-publish" onClick={() => onGrant(picked)}>Grant access</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
