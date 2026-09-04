import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  users as seedUsers,
  type User,
  type UserType,
  type UserRole,
  type SubscriptionStatus,
} from "../data/users";
import { buildUserProfile, type ProfileFields } from "../data/userProfile";
import { idRecordForUser, nowIdStamp, type IdRecord, type IdStatus } from "../data/manageIds";
import { IdModal } from "./IdModal";
import { PrmModal } from "./PrmModal";
import {
  UsersFilters,
  UsersEditColumns,
  type UserColumnKey,
  type UserColumnState,
  type UserFilterState,
} from "./UsersFilters";
import { useColumnOrder, orderedColumns } from "./Filters";
import { UsersSearch } from "./UsersSearch";
import { useLandingMorph } from "../hooks/useLandingMorph";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { LandingFilterRow, LandingOverlay, BackToSearch, topValues, type LandingCol, type LandingPill, type LandingRow } from "./LandingMorph";

/* Landing-morph columns — mirror the table's default visible columns (key,
   label, width) so the p=1 hand-off to the real table lines up. */
const LM_COLS: LandingCol[] = [
  { key: "email", label: "Email", width: 190 },
  { key: "phone", label: "Phone", width: 165 },
  { key: "userType", label: "User Type", width: 114 },
  { key: "company", label: "Company", width: 175 },
  { key: "role", label: "Role", width: 130 },
  { key: "subscription", label: "Subscription", width: 195, fixed: true },
];
import { SortIcon, RowEditIcon, RowExternalLinkIcon, RowKebabIcon, RowDeleteIcon, MenuEnterIcon, MenuUsersIcon, MenuProfileIcon, MenuProgressIcon, MenuBankIcon, MenuCardOffIcon, MenuIdDocIcon, MenuMergeIcon, MenuTransferIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

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

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ─── local icons (match the Tasks/Certifications action bar) ─── */

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
  { key: "userType", label: "User Type", className: "col-u-type", width: 114, render: (u) => <TypePill type={u.userType} />, sortValue: (u) => u.userType },
  { key: "company", label: "Company", className: "col-u-company", width: 175, render: (u) => (u.userType === "B2B" && u.companyName ? u.companyName : null), sortValue: (u) => (u.companyName ?? "").toLowerCase() },
  { key: "role", label: "Role", className: "col-u-role", width: 130, render: (u) => u.role, sortValue: (u) => ROLE_ORDER[u.role] },
  { key: "subscription", label: "Subscription", className: "col-u-sub", width: 195, render: (u) => <SubscriptionCell user={u} />, sortValue: (u) => SUB_ORDER[u.subscriptionStatus] },
  { key: "language", label: "Language", className: "col-u-lang", width: 114, render: (_u, f) => f.language, sortValue: (_u, f) => f.language },
  { key: "goal", label: "Goal", className: "col-u-stage", width: 200, render: (_u, f) => f.goal, sortValue: (_u, f) => GOAL_ORDER[f.goal] ?? 0 },
  { key: "attribution", label: "Attribution", className: "col-u-attr", width: 160, render: (_u, f) => f.attribution, sortValue: (_u, f) => f.attribution.toLowerCase() },
  { key: "zipCode", label: "Zip Code", className: "col-u-zip", width: 100, render: (_u, f) => f.zipCode, sortValue: (_u, f) => f.zipCode },
  { key: "industryPreference", label: "Industry Preference", className: "col-u-industry", width: 188, render: (_u, f) => f.industryPreference, sortValue: (_u, f) => f.industryPreference.toLowerCase() },
  { key: "lastAccess", label: "App Last Access", className: "col-u-date", width: 160, render: (u) => formatDate(u.lastAccess), sortValue: (u) => u.lastAccess },
  { key: "dashboardLastAccess", label: "Dashboard Last Access", className: "col-u-date", width: 210, render: (u) => (u.dashboardLastAccess ? formatDate(u.dashboardLastAccess) : null), sortValue: (u) => u.dashboardLastAccess ?? "" },
  { key: "joinedOn", label: "Joined SkillCat", className: "col-u-date", width: 150, render: (u) => formatDate(u.joinedOn), sortValue: (u) => u.joinedOn },
];
const COL_BY_KEY = new Map(COLS.map((c) => [c.key, c]));

// Columns that have no meaningful sort order (free-text, contact info, codes)
const NON_SORTABLE_COLS = new Set<UserColumnKey>(["email", "phone", "attribution", "zipCode"]);

function compareRows(a: Row, b: Row, key: SortKey): number {
  if (key === "name") return a.u.name.localeCompare(b.u.name);
  const col = COL_BY_KEY.get(key)!;
  const va = col.sortValue(a.u, a.f);
  const vb = col.sortValue(b.u, b.f);
  if (typeof va === "number" && typeof vb === "number") return va - vb;
  return String(va).localeCompare(String(vb));
}

export function UsersPage({
  onViewCompany,
  onManageCompletions,
  onOpenOfferCodes,
  onOpenScholarships,
  onOpenMergeAccounts,
  onOpenTransferSubscription,
  initialCompanyFilter,
}: {
  onViewCompany?: (companyName: string) => void;
  onManageCompletions: (userId: string) => void;
  onOpenOfferCodes?: () => void;
  onOpenScholarships?: () => void;
  onOpenMergeAccounts?: () => void;
  onOpenTransferSubscription?: () => void;
  initialCompanyFilter?: string;
}) {
  const [list] = useState<User[]>(seedUsers);
  // "O" / "S" open Offer Codes / Scholarships (badges shown on the buttons).
  useCreateShortcut(() => onOpenOfferCodes?.(), !!onOpenOfferCodes, "o");
  useCreateShortcut(() => onOpenScholarships?.(), !!onOpenScholarships, "s");
  const profiles = useMemo(
    () => new Map(list.map((u) => [u.id, buildUserProfile(u).fields] as const)),
    [list],
  );
  const [columns, setColumns] = useState<UserColumnState>(DEFAULT_COLUMNS);
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(COLS);
  const [filters, setFilters] = useState<UserFilterState>(
    initialCompanyFilter ? { ...EMPTY_FILTERS, companies: [initialCompanyFilter] } : EMPTY_FILTERS,
  );
  // Search bar: committedQuery only changes on Enter. The company filter is shared
  // with the Filters row (filters.companies) and applies immediately.
  const [committedQuery, setCommittedQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ user: User; rect: DOMRect } | null>(null);
  // Page-level 3-dot menu (Figma 677:1956), anchored to the header kebab.
  const [pageMenu, setPageMenu] = useState<DOMRect | null>(null);
  // Cancel Subscription confirm — the Full Profile page's PrmModal, mirrored.
  // Confirmed cancellations are session-local, like the profile's — the menu
  // just stops offering Cancel for that user; the row's pill keeps its seeded
  // status since access runs to the end of the billing period anyway.
  const [cancelSub, setCancelSub] = useState<User | null>(null);
  const [canceledSubs, setCanceledSubs] = useState<ReadonlySet<string>>(new Set());
  // "View User IDs" opens the shared ID popup on that user's document. Replace
  // and Approve edit the open record only — like the cancellations above, the
  // decision is session-local, and the table has no ID column to reflect it.
  const [idRecord, setIdRecord] = useState<IdRecord | null>(null);

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

  // Viewing a single company's roster reads best grouped by seniority
  // (Admin, Manager, then Employee) — enforced regardless of the chosen
  // column sort while a company filter is active.
  const companyFilterActive = filters.companies.length > 0;
  const effectiveSort: { key: SortKey; dir: SortDir } = companyFilterActive
    ? { key: "role", dir: "desc" }
    : sort;

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, effectiveSort.key));
    return effectiveSort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, effectiveSort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [committedQuery, filters, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const visibleCols = useMemo(() => orderedColumns(COLS, order, columns), [columns, order]);
  const colSpan = visibleCols.length + 2; // name + cols + actions
  // Natural table width (name col + optional cols + actions) so the table
  // scrolls horizontally rather than crushing columns on a narrow page.
  const tableMin = 200 + visibleCols.reduce((s, c) => s + c.width, 0) + 40;

  // Landing morph — the page opens as the search-first landing and the wheel
  // (or any search / pill / row interaction) morphs it into the table view.
  // A company deep-link (View Employees) skips straight to the table.
  const morph = useLandingMorph(Boolean(initialCompanyFilter));

  const suggested = useMemo(() => {
    const pills: LandingPill[] = [
      {
        key: "b2c",
        label: "B2C",
        onPick: () => {
          setFilters((prev) => ({ ...prev, types: Array.from(new Set([...prev.types, "B2C" as UserType])) }));
          morph.showTable();
        },
      },
      {
        key: "b2b",
        label: "B2B",
        onPick: () => {
          setFilters((prev) => ({ ...prev, types: Array.from(new Set([...prev.types, "B2B" as UserType])) }));
          morph.showTable();
        },
      },
      {
        key: "subscriber",
        label: "Subscriber",
        onPick: () => {
          setFilters((prev) => ({ ...prev, subscriptions: Array.from(new Set([...prev.subscriptions, "Subscriber" as SubscriptionStatus])) }));
          morph.showTable();
        },
      },
    ];
    const company = topValues(list, (u) => u.companyName)[0];
    if (company)
      pills.push({
        key: "company",
        label: company,
        onPick: () => {
          setFilters((prev) => ({ ...prev, companies: Array.from(new Set([...prev.companies, company])) }));
          morph.showTable();
        },
      });
    return pills;
  }, [list, morph.showTable]);

  const landingRows: LandingRow[] = sorted.slice(0, 24).map(({ u }) => ({
    key: u.id,
    name: u.name,
    cells: {
      email: u.email,
      phone: u.phone,
      userType: u.userType,
      company: u.userType === "B2B" && u.companyName ? u.companyName : "",
      role: u.role,
      subscription: u.subscriptionStatus,
    },
  }));

  function toggleSort(key: SortKey) {
    // Sort is locked to role (Admin, Manager, Employee) while a company
    // filter is active — see effectiveSort above.
    if (companyFilterActive) return;
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks lm" ref={morph.rootRef}>
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
            {/* Offer Codes and Scholarships used to live in the sidebar's Users
                group; they are now reached from here, with O / S shortcuts. */}
            <div className="tasks-header-actions">
              <button className="cta-quiet" onClick={() => onOpenOfferCodes?.()}>
                Offer Codes
                <span className="cta-kbd">O</span>
              </button>
              <button className="cta-quiet" onClick={() => onOpenScholarships?.()}>
                Scholarships
                <span className="cta-kbd">S</span>
              </button>
              <button
                className="cta-quiet cta-quiet--icon"
                aria-label="More actions"
                onClick={(e) => setPageMenu(e.currentTarget.getBoundingClientRect())}
              >
                <RowKebabIcon />
              </button>
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
                  onCommit={(q) => {
                    setCommittedQuery(q);
                    morph.showTable();
                  }}
                />
              </div>

              <LandingFilterRow pills={suggested}>
                  <UsersFilters filters={filters} setFilters={setFilters} />
                </LandingFilterRow>

              <div className="lm-stage">
              <LandingOverlay
                caption="Users A–Z"
                columns={LM_COLS}
                nameWidth={200}
                rows={landingRows}
                onShowAll={morph.showTable}
                onRowClick={() => morph.showTable()}
              />
              <div className="lm-table">
              <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
              <table className="table table-head">
                <ColGroup cols={visibleCols} />
                <thead>
                  <tr>
                    <SortableHeader col="name" label="Name" className="col-name" sort={effectiveSort} toggle={toggleSort} />
                    {visibleCols.map((c) => (
                      <SortableHeader key={c.key} col={c.key} label={c.label} className={c.className} sort={effectiveSort} toggle={toggleSort} sortable={!NON_SORTABLE_COLS.has(c.key)} />
                    ))}
                    <th className="col-actions">
                      <UsersEditColumns
                        columns={columns}
                        setColumns={setColumns}
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
                      <UserRow
                        key={row.u.id}
                        row={row}
                        cols={visibleCols}
                        onOpenMenu={(el) => setMenu({ user: row.u, rect: el.getBoundingClientRect() })}
                        menuOpen={menu?.user.id === row.u.id}
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
                <BackToSearch onClick={morph.showLanding} />
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
      </div>

      {menu && (
        <UserActionsMenu
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onOpenProfile={() => openProfile(menu.user)}
          onViewCompany={
            menu.user.userType === "B2B" && menu.user.companyName && onViewCompany
              ? () => onViewCompany(menu.user.companyName!)
              : undefined
          }
          onViewAllEmployees={
            menu.user.userType === "B2B" && menu.user.companyName
              ? () => setFilters((prev) => ({ ...prev, companies: [menu.user.companyName!] }))
              : undefined
          }
          onManageCompletions={() => onManageCompletions(menu.user.id)}
          onCancelSubscription={
            /* Only subscribers billed through a platform we can cancel from
               here — Apple subs are managed by Apple, and company-seat users
               are billed through their company. */
            menu.user.subscriptionStatus === "Subscriber" &&
            !menu.user.companyName &&
            (menu.user.platform === "Stripe" || menu.user.platform === "Google") &&
            !canceledSubs.has(menu.user.id)
              ? () => setCancelSub(menu.user)
              : undefined
          }
          onViewIds={() => setIdRecord(idRecordForUser(menu.user))}
        />
      )}
      {pageMenu && (
        <PageActionsMenu
          rect={pageMenu}
          onClose={() => setPageMenu(null)}
          onMergeAccounts={onOpenMergeAccounts}
          onTransferSubscription={onOpenTransferSubscription}
        />
      )}
      {idRecord && (
        <IdModal
          record={idRecord}
          onClose={() => setIdRecord(null)}
          /* Same two transitions the Manage IDs table applies: a replacement
             re-takes the upload stamp and either takes or drops the approval;
             an approval only records the decision. */
          onReplace={(status: IdStatus) => {
            const now = nowIdStamp();
            setIdRecord((r) =>
              r ? { ...r, status, uploadedAt: now, approvedAt: status === "approved" ? now : undefined } : r,
            );
          }}
          onApprove={() =>
            setIdRecord((r) => (r ? { ...r, status: "approved", approvedAt: nowIdStamp() } : r))
          }
        />
      )}
      {cancelSub && (
        <CancelSubscriptionConfirm
          user={cancelSub}
          onClose={() => setCancelSub(null)}
          onConfirm={() => {
            setCanceledSubs((prev) => new Set(prev).add(cancelSub.id));
            setCancelSub(null);
          }}
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

function UserRow({
  row,
  cols,
  onOpenMenu,
  menuOpen,
}: {
  row: Row;
  cols: ColMeta[];
  onOpenMenu: (anchor: HTMLElement) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const { u, f } = row;
  return (
    <tr className={menuOpen ? "menu-open" : ""}>
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
          onClick={(e) => onOpenMenu(e.currentTarget)}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit">
            <RowEditIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="Open profile in new tab"
            title="Open full profile in a new tab"
            onClick={() => openProfile(u)}
          >
            <RowExternalLinkIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More actions"
            onClick={(e) => onOpenMenu(e.currentTarget)}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Three-dot actions menu — Figma 673:1437 "3-Dot Menu - B2C User", in that
   node's order (View User IDs sits after the destructive Remove User). Fixed-
   positioned so it escapes the table scroll. The name/ID header this used to
   carry isn't in the component — the row the menu opened from already names
   the user. Items that don't apply to the row drop out; the rest close up. ─── */

function UserActionsMenu({
  rect,
  onClose,
  onOpenProfile,
  onViewCompany,
  onViewAllEmployees,
  onManageCompletions,
  onCancelSubscription,
  onViewIds,
}: {
  rect: DOMRect;
  onClose: () => void;
  onOpenProfile: () => void;
  onViewCompany?: () => void;
  onViewAllEmployees?: () => void;
  onManageCompletions: () => void;
  /** Omitted when the user can't be cancelled from here — the item is hidden. */
  onCancelSubscription?: () => void;
  onViewIds: () => void;
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
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {item(<RowEditIcon />, "Edit User Details", () => {})}
      {item(<MenuEnterIcon />, "Login As", () => {})}
      {item(<MenuProfileIcon />, "View Profile", onOpenProfile)}
      {item(<MenuProgressIcon />, "Manage Training Progress", onManageCompletions)}
      {onViewCompany && item(<MenuBankIcon />, "View User's Company", onViewCompany)}
      {onViewAllEmployees && item(<MenuUsersIcon />, "View All Company Employees", onViewAllEmployees)}
      {onCancelSubscription && item(<MenuCardOffIcon />, "Cancel Subscription", onCancelSubscription)}
      {item(<RowDeleteIcon />, "Remove User", () => {}, true)}
      {item(<MenuIdDocIcon />, "View User IDs", onViewIds)}
    </div>
  );
}

/* ─── Page-level 3-dot menu — Figma 677:1956 "3-Dot Menu - Manage Users
   Page". Same .u-menu chrome and close/positioning behavior as the row menu,
   anchored under the header kebab. ─── */

function PageActionsMenu({
  rect,
  onClose,
  onMergeAccounts,
  onTransferSubscription,
}: {
  rect: DOMRect;
  onClose: () => void;
  onMergeAccounts?: () => void;
  onTransferSubscription?: () => void;
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

  const item = (icon: JSX.Element, label: string, onPick?: () => void) => (
    <button
      className="u-menu-item"
      onClick={(e) => {
        e.stopPropagation();
        onPick?.();
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
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {item(<MenuMergeIcon />, "Merge Accounts", onMergeAccounts)}
      {item(<MenuTransferIcon />, "Transfer Subscription", onTransferSubscription)}
    </div>
  );
}

/* ─── Cancel Subscription confirm — the Full Profile page's PrmModal, with
   identical copy, so canceling from the row menu reads the same as canceling
   from the profile's Subscription card. ─── */

function CancelSubscriptionConfirm({
  user,
  onClose,
  onConfirm,
}: {
  user: User;
  onClose: () => void;
  onConfirm: () => void;
}) {
  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Same deterministic subscription record the Full Profile shows.
  const sub = buildUserProfile(user).subscription;
  return (
    <PrmModal
      title="Cancel Subscription?"
      cancelLabel="Keep Subscription"
      confirmLabel="Cancel Subscription"
      onCancel={onClose}
      onConfirm={onConfirm}
    >
      <p className="prm-text">
        This cancels <strong>{user.name}</strong>&rsquo;s {sub.platform} subscription at the end of
        the current billing period. No further charges will be made.
      </p>
      {sub.renewsOn && (
        <p className="prm-text">
          They keep full access until <strong>{formatDate(sub.renewsOn)}</strong>. No refund is
          issued for the current period.
        </p>
      )}
    </PrmModal>
  );
}

/* ─── Open the full profile in a new browser tab ─── */
/* Opens a real in-app page via URL params, rendered standalone by App. */

function openProfile(user: User) {
  window.open(
    `${window.location.origin}${window.location.pathname}?profile=${user.id}`,
    "_blank",
    "noopener",
  );
}

