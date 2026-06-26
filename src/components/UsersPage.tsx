import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  users as seedUsers,
  type User,
  type UserType,
  type UserRole,
  type SubscriptionStatus,
} from "../data/users";
import { buildUserProfile, type ProfileFields } from "../data/userProfile";
import {
  UsersFilters,
  UsersEditColumns,
  type UserColumnKey,
  type UserColumnState,
  type UserFilterState,
} from "./UsersFilters";
import { UsersSearch } from "./UsersSearch";
import { SortIcon } from "./icons";

const PAGE_SIZE = 50;

const DEFAULT_COLUMNS: UserColumnState = {
  email: true,
  phone: true,
  userType: true,
  company: true,
  role: true,
  subscription: true,
  language: false,
  goal: false,
  attribution: false,
  zipCode: false,
  industryPreference: false,
  lastAccess: false,
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

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── local icons (match the Tasks/Certifications action bar) ─── */
const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
  </svg>
);
const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);
const PortfolioIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);
const KeyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="15" r="4" />
    <path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2" />
  </svg>
);
const CardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 002 2h8a2 2 0 002-2l1-13M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
  </svg>
);

const VerifiedIcon = () => (
  <svg className="u-verified-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.4 12.4l2.4 2.4 4.8-5.2" />
  </svg>
);

type SortKey = "name" | UserColumnKey;
type SortDir = "asc" | "desc";

const ROLE_ORDER: Record<UserRole, number> = {
  "Self-Learner": 0,
  Employee: 1,
  Manager: 2,
  Admin: 3,
};
const SUB_ORDER: Record<SubscriptionStatus, number> = {
  "Free Trial": 0,
  Starter: 1,
  Subscriber: 2,
  Scholarship: 3,
};
const GOAL_ORDER: Record<string, number> = { "Looking for my first trades job": 0, "Exploring careers in the skilled trades": 1, "Focused on advancing my career": 2, Other: 3 };

type Row = { u: User; f: ProfileFields };

// One config object per optional column drives the colgroup, header, cell, and sort.
type ColMeta = {
  key: UserColumnKey;
  label: string;
  className: string;
  width: number;
  render: (u: User, f: ProfileFields) => React.ReactNode;
  sortValue: (u: User, f: ProfileFields) => string | number;
};

const COLS: ColMeta[] = [
  { key: "email", label: "Email", className: "col-u-email", width: 190, render: (u) => <VerifiedCell text={u.email} verified={u.emailVerified} />, sortValue: (u) => u.email.toLowerCase() },
  { key: "phone", label: "Phone", className: "col-u-phone", width: 165, render: (u) => <VerifiedCell text={u.phone} verified={u.phoneVerified} />, sortValue: (u) => u.phone },
  { key: "userType", label: "User Type", className: "col-u-type", width: 96, render: (u) => <TypePill type={u.userType} />, sortValue: (u) => u.userType },
  { key: "company", label: "Company", className: "col-u-company", width: 175, render: (u) => (u.userType === "B2B" && u.companyName ? u.companyName : <span className="u-muted">—</span>), sortValue: (u) => (u.companyName ?? "").toLowerCase() },
  { key: "role", label: "Role", className: "col-u-role", width: 130, render: (u) => u.role, sortValue: (u) => ROLE_ORDER[u.role] },
  { key: "subscription", label: "Subscription", className: "col-u-sub", width: 195, render: (u) => <SubscriptionCell user={u} />, sortValue: (u) => SUB_ORDER[u.subscriptionStatus] },
  { key: "language", label: "Language", className: "col-u-lang", width: 100, render: (_u, f) => f.language, sortValue: (_u, f) => f.language },
  { key: "goal", label: "Goal", className: "col-u-stage", width: 200, render: (_u, f) => f.goal, sortValue: (_u, f) => GOAL_ORDER[f.goal] ?? 0 },
  { key: "attribution", label: "Attribution", className: "col-u-attr", width: 160, render: (_u, f) => f.attribution, sortValue: (_u, f) => f.attribution.toLowerCase() },
  { key: "zipCode", label: "Zip Code", className: "col-u-zip", width: 100, render: (_u, f) => f.zipCode, sortValue: (_u, f) => f.zipCode },
  { key: "industryPreference", label: "Industry Preference", className: "col-u-industry", width: 165, render: (_u, f) => f.industryPreference, sortValue: (_u, f) => f.industryPreference.toLowerCase() },
  { key: "lastAccess", label: "Last Access", className: "col-u-date", width: 130, render: (u) => formatDate(u.lastAccess), sortValue: (u) => u.lastAccess },
  { key: "joinedOn", label: "Joined SkillCat", className: "col-u-date", width: 150, render: (u) => formatDate(u.joinedOn), sortValue: (u) => u.joinedOn },
];
const COL_BY_KEY = new Map(COLS.map((c) => [c.key, c]));

// Columns that have no meaningful sort order (free-text, contact info, codes)
const NON_SORTABLE_COLS = new Set<UserColumnKey>(["email", "phone", "company", "attribution", "zipCode"]);

function compareRows(a: Row, b: Row, key: SortKey): number {
  if (key === "name") return a.u.name.localeCompare(b.u.name);
  const col = COL_BY_KEY.get(key)!;
  const va = col.sortValue(a.u, a.f);
  const vb = col.sortValue(b.u, b.f);
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb));
}

export function UsersPage({ onViewCompany }: { onViewCompany?: (companyName: string) => void }) {
  const [list] = useState<User[]>(seedUsers);
  const profiles = useMemo(
    () => new Map(list.map((u) => [u.id, buildUserProfile(u).fields] as const)),
    [list],
  );
  const [columns, setColumns] = useState<UserColumnState>(DEFAULT_COLUMNS);
  const [filters, setFilters] = useState<UserFilterState>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Search bar: committedQuery only changes on Enter. The company filter is shared
  // with the Filters row (filters.companies) and applies immediately.
  const [committedQuery, setCommittedQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ user: User; rect: DOMRect } | null>(null);

  const counts = useMemo(() => {
    let b2c = 0;
    let b2b = 0;
    list.forEach((u) => (u.userType === "B2C" ? b2c++ : b2b++));
    return { b2c, b2b };
  }, [list]);

  const rows = useMemo<Row[]>(
    () => list.map((u) => ({ u, f: profiles.get(u.id)! })),
    [list, profiles],
  );

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return rows.filter(({ u, f }) => {
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
  }, [rows, committedQuery, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [committedQuery, filters, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const visibleCols = useMemo(() => COLS.filter((c) => columns[c.key]), [columns]);
  const colSpan = visibleCols.length + 2; // name + cols + actions
  // Natural table width (name col + optional cols + actions) so the table
  // scrolls horizontally rather than crushing columns on a narrow page.
  const tableMin = 200 + visibleCols.reduce((s, c) => s + c.width, 0) + 48;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Manage Users</h1>
              <div className="tasks-subtitle">
                <span>{list.length} users</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.b2c} B2C</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.b2b} B2B</span>
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <UsersSearch
                  users={list}
                  companies={filters.companies}
                  onCompaniesChange={(c) => setFilters((prev) => ({ ...prev, companies: c }))}
                  query={committedQuery}
                  onCommit={setCommittedQuery}
                  onOpenProfile={openProfile}
                />
              </div>

              <UsersFilters filters={filters} setFilters={setFilters} />

              <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
              <table className="table table-head">
                <ColGroup cols={visibleCols} />
                <thead>
                  <tr>
                    <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                    {visibleCols.map((c) => (
                      <SortableHeader key={c.key} col={c.key} label={c.label} className={c.className} sort={sort} toggle={toggleSort} sortable={!NON_SORTABLE_COLS.has(c.key)} />
                    ))}
                    <th className="col-actions">
                      <UsersEditColumns columns={columns} setColumns={setColumns} />
                    </th>
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup cols={visibleCols} />
                  <tbody>
                    {paged.map((row) => (
                      <UserRow
                        key={row.u.id}
                        row={row}
                        cols={visibleCols}
                        selected={row.u.id === selectedId}
                        onClick={() => setSelectedId(row.u.id)}
                        onOpenMenu={(el) => setMenu({ user: row.u, rect: el.getBoundingClientRect() })}
                      />
                    ))}
                    {paged.length === 0 && (
                      <tr>
                        <td colSpan={colSpan} className="u-empty">
                          {committedQuery.trim()
                            ? `No users match "${committedQuery.trim()}".`
                            : "No users match these filters."}
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
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Prev</button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next ›</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <UserActionsMenu
          user={menu.user}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onViewPortfolio={() => openPortfolio(menu.user)}
          onOpenProfile={() => openProfile(menu.user)}
          onViewCompany={
            menu.user.userType === "B2B" && menu.user.companyName && onViewCompany
              ? () => onViewCompany(menu.user.companyName!)
              : undefined
          }
        />
      )}
    </div>
  );
}

function ColGroup({ cols }: { cols: ColMeta[] }) {
  return (
    <colgroup>
      <col />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: 48 }} />
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

function UserRow({
  row,
  cols,
  selected,
  onClick,
  onOpenMenu,
}: {
  row: Row;
  cols: ColMeta[];
  selected: boolean;
  onClick: () => void;
  onOpenMenu: (anchor: HTMLElement) => void;
}) {
  const { u, f } = row;
  return (
    <tr className={selected ? "selected" : ""} onClick={onClick}>
      <td className="col-name">{u.name}</td>
      {cols.map((c) => (
        <td key={c.key} className={c.className}>
          {c.render(u, f)}
        </td>
      ))}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="Actions"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget); }}
        >
          <MoreIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit" onClick={(e) => e.stopPropagation()}>
            <PencilIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="Open profile in new tab"
            title="Open full profile in a new tab"
            onClick={(e) => { e.stopPropagation(); openProfile(u); }}
          >
            <ExternalLinkIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More actions"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget); }}
          >
            <MoreIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Three-dot actions menu (fixed-positioned so it escapes the table scroll) ─── */

function UserActionsMenu({
  user,
  rect,
  onClose,
  onViewPortfolio,
  onOpenProfile,
  onViewCompany,
}: {
  user: User;
  rect: DOMRect;
  onClose: () => void;
  onViewPortfolio: () => void;
  onOpenProfile: () => void;
  onViewCompany?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    let left = rect.right - w;
    if (left < 8) left = 8;
    if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w;
    setPos({ top, left });
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
    danger = false,
  ) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        left: pos ? pos.left : rect.right - 210,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{user.name}</div>
        <div className="u-menu-head-id">{user.id}</div>
      </div>
      <div className="u-menu-divider" />
      {item(<LoginAsIcon />, "Login As", () => {})}
      {item(<PortfolioIcon />, "View Portfolio", onViewPortfolio)}
      {item(<ExternalLinkIcon />, "Open Full Profile", onOpenProfile)}
      {onViewCompany && item(<CompanyIcon />, "View Company", onViewCompany)}
      {item(<KeyIcon />, "Reset Password", () => {})}
      {item(<CardIcon />, "Manage Subscription", () => {})}
      <div className="u-menu-divider" />
      {item(<TrashIcon />, "Remove User", () => {}, true)}
    </div>
  );
}

/* ─── Open the full profile / public portfolio in a new browser tab ─── */
/* These open real in-app pages via URL params, rendered standalone by App. */

function openProfile(user: User) {
  window.open(
    `${window.location.origin}${window.location.pathname}?profile=${user.id}`,
    "_blank",
    "noopener",
  );
}

function openPortfolio(user: User) {
  window.open(
    `${window.location.origin}${window.location.pathname}?portfolio=${user.id}`,
    "_blank",
    "noopener",
  );
}

const CompanyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9v.01M9 13v.01M9 17v.01" />
  </svg>
);

const LoginAsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
  </svg>
);
