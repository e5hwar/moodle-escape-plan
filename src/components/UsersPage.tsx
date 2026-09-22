import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  users as seedUsers,
  removedUserIds,
  removeUser,
  updateUserContact,
  accessMoment,
  type User,
  type UserType,
  type UserRole,
  type SubscriptionStatus,
} from "../data/users";
import { buildUserProfile, type ProfileFields } from "../data/userProfile";
import { nameChangeRequests } from "../data/nameChangeRequests";
import { PrmModal } from "./PrmModal";
import { CopiedToast } from "./CopiedToast";
import { EditUserModal } from "./UserProfilePage";
import {
  UsersFilters,
  UsersEditColumns,
  GOALS,
  type UserColumnKey,
  type UserColumnState,
  type UserFilterState,
} from "./UsersFilters";
import { useColumnOrder, orderedColumns } from "./Filters";
import { UsersSearch } from "./UsersSearch";
import { loginAs } from "./loginAs";
import { useLandingMorph } from "../hooks/useLandingMorph";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { LandingFilterRow, LandingOverlay, type LandingCol, type LandingPill, type LandingRow } from "./LandingMorph";

/* Landing-morph columns — mirror the table's default visible columns (key,
   label, width) so the p=1 hand-off to the real table lines up. */
const LM_COLS: LandingCol[] = [
  { key: "email", label: "Email", width: 190 },
  { key: "phone", label: "Phone", width: 165 },
  { key: "company", label: "Company", width: 175 },
  // Hidden on the landing, grows in with the morph — the table's default
  // columns must all be here, in table order, or one pops in at the hand-off.
  { key: "subscription", label: "Subscription", width: 240 },
  { key: "lastAccess", label: "App Last Access", width: 160, fixed: true },
];
import { NoteChevronIcon, SortIcon, RowEditIcon, RowExternalLinkIcon, RowKebabIcon, RowDeleteIcon, MenuEnterIcon, MenuUsersIcon, MenuProfileIcon, MenuProgressIcon, MenuBankIcon, MenuCardOffIcon, MenuMergeIcon, MenuTransferIcon, MenuAwardIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const PAGE_SIZE = 50;

const DEFAULT_COLUMNS: UserColumnState = {
  email: true,
  phone: true,
  userType: false,
  company: true,
  role: false,
  subscription: true,
  language: false,
  goal: false,
  attribution: false,
  zipCode: false,
  industryPreference: false,
  lastAccess: true,
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

/* Last-access stamps read relative ("Today", "2 days ago") — the same wording
   Companies' Last Access column uses (getDashboardLastAccess). */
function formatDaysAgo(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.round((today.getTime() - d.getTime()) / 86400000));
  if (days === 0) return "Today";
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

/* Hover tip on a relative stamp: the exact date and time behind it, always
   in Eastern Time whatever the viewer's own zone. */
function LastAccessCell({ userId, iso, salt }: { userId: string; iso: string; salt: string }) {
  const at = accessMoment(userId, iso, salt);
  const tz = "America/New_York";
  const tip = `${at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz })} · ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })} ET`;
  return <span title={tip}>{formatDaysAgo(iso)}</span>;
}

type SortKey = "name" | UserColumnKey;
type SortDir = "asc" | "desc";

const ROLE_ORDER: Record<UserRole, number> = {
  "Self-Learner": 0,
  Employee: 1,
  Manager: 2,
  Admin: 3,
};
/* Sort runs most-engaged plan first, lapsed/none last — the order the pills
   read down the column. */
const SUB_ORDER: Record<SubscriptionStatus, number> = {
  Subscriber: 0,
  "Company Plan": 1,
  Scholarship: 2,
  "Free Trial": 3,
  Cancelled: 4,
  Starter: 5,
};
const FIRST_JOB_GOAL = GOALS[0];
const GOAL_ORDER: Record<string, number> = { "Looking for First Trades Job": 0, "Exploring Careers in the Skilled Trades": 1, "Focussed on Advancing Career": 2, Other: 3 };

/* A Subscriber with an upcoming cancellation ("Stripe · Cancels Jul 9, 2026")
   files under Cancelled for the Subscription filter and sort, not Subscriber.
   The raw status stays "Subscriber" — they keep access until `cancelsOn`. */
function filterStatus(u: User): SubscriptionStatus {
  return u.subscriptionStatus === "Subscriber" && u.cancelsOn ? "Cancelled" : u.subscriptionStatus;
}

/* Plan rank first; inside Cancelled, by cancellation date — an upcoming
   cancellation's `cancelsOn` (future) or a lapsed plan's `cancelledOn` — so
   desc reads cancelling-soon, then most recently cancelled. The whole list
   reverses on desc, so the date part is ascending here. */
function subscriptionSortValue(u: User): string {
  const rank = SUB_ORDER[filterStatus(u)];
  return `${rank}|${u.cancelsOn ?? u.cancelledOn ?? ""}`;
}

type Row = { u: User; f: ProfileFields };

// One config object per optional column drives the colgroup, header, cell, and sort.
type ColMeta = {
  key: UserColumnKey;
  label: string;
  className: string;
  width: number;
  /** Click-to-copy cell (CopyCells.tsx) — the Email/Phone opt-in, the same
      two columns every other admin table marks. */
  copyable?: boolean;
  render: (u: User, f: ProfileFields) => React.ReactNode;
  sortValue: (u: User, f: ProfileFields) => string | number;
};

const COLS: ColMeta[] = [
  { key: "email", label: "Email", copyable: true, className: "col-u-email", width: 190, render: (u) => u.email, sortValue: (u) => u.email.toLowerCase() },
  { key: "phone", label: "Phone", copyable: true, className: "col-u-phone", width: 165, render: (u) => u.phone, sortValue: (u) => u.phone },
  { key: "userType", label: "User Type", className: "col-u-type", width: 114, render: (u) => <TypePill type={u.userType} />, sortValue: (u) => u.userType },
  { key: "company", label: "Company", className: "col-u-company", width: 175, render: (u) => (u.userType === "B2B" && u.companyName ? u.companyName : null), sortValue: (u) => (u.companyName ?? "").toLowerCase() },
  { key: "role", label: "Role", className: "col-u-role", width: 130, render: (u) => u.role, sortValue: (u) => ROLE_ORDER[u.role] },
  { key: "subscription", label: "Subscription", className: "col-u-sub", width: 240, render: (u) => subscriptionLabel(u), sortValue: subscriptionSortValue },
  { key: "language", label: "Language", className: "col-u-lang", width: 114, render: (_u, f) => f.language, sortValue: (_u, f) => f.language },
  { key: "goal", label: "Goal", className: "col-u-stage", width: 200, render: (_u, f) => f.goal, sortValue: (_u, f) => GOAL_ORDER[f.goal] ?? 0 },
  { key: "attribution", label: "Attribution", className: "col-u-attr", width: 160, render: (_u, f) => f.attribution, sortValue: (_u, f) => f.attribution.toLowerCase() },
  { key: "zipCode", label: "Zip Code", className: "col-u-zip", width: 100, render: (_u, f) => f.zipCode, sortValue: (_u, f) => f.zipCode },
  { key: "industryPreference", label: "Industry Preference", className: "col-u-industry", width: 188, render: (_u, f) => f.industryPreference, sortValue: (_u, f) => f.industryPreference.toLowerCase() },
  { key: "lastAccess", label: "App Last Access", className: "col-u-date", width: 160, render: (u) => <LastAccessCell userId={u.id} iso={u.lastAccess} salt="app" />, sortValue: (u) => u.lastAccess },
  { key: "dashboardLastAccess", label: "Dashboard Last Access", className: "col-u-date", width: 210, render: (u) => (u.dashboardLastAccess ? <LastAccessCell userId={u.id} iso={u.dashboardLastAccess} salt="dashboard" /> : null), sortValue: (u) => u.dashboardLastAccess ?? "" },
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
  /* Offer Codes is hidden from the header — App still passes the handler so
     the page can bring the button back without rewiring. */
  onOpenScholarships,
  onOpenNameChanges,
  onOpenMergeAccounts,
  onOpenTransferSubscription,
  initialCompanyFilter,
  flash,
  onFlashDone,
}: {
  onViewCompany?: (companyName: string) => void;
  onManageCompletions: (userId: string) => void;
  onOpenOfferCodes?: () => void;
  onOpenScholarships?: () => void;
  onOpenNameChanges?: () => void;
  onOpenMergeAccounts?: () => void;
  onOpenTransferSubscription?: () => void;
  initialCompanyFilter?: string;
  /** A one-line success raised by something that finished and came back here
   *  (a merge, a transfer) — shown as the shared toast. */
  flash?: string | null;
  onFlashDone?: () => void;
}) {
  const [list, setList] = useState<User[]>(() => seedUsers.filter((u) => !removedUserIds.has(u.id)));
  // "S" opens Scholarships from the page 3-dot menu. Offer Codes is hidden
  // from the header for now, so it keeps no shortcut of its own.
  useCreateShortcut(() => onOpenScholarships?.(), !!onOpenScholarships, "s");
  // "N" is the landing banner's Review Names badge.
  useCreateShortcut(() => onOpenNameChanges?.(), !!onOpenNameChanges, "n");
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
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "lastAccess", dir: "desc" });
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
  // Remove User: row menu → danger confirm → the user leaves the list and a
  // success toast (the shared CopiedToast chrome) acknowledges it.
  const [removing, setRemoving] = useState<User | null>(null);
  // Edit User — the Full Profile's own modal, from the row pencil or the menu.
  const [editing, setEditing] = useState<User | null>(null);
  const [removedToast, setRemovedToast] = useState(0);

  const rows = useMemo<Row[]>(
    () => list.map((u) => ({ u, f: profiles.get(u.id)! })),
    [list, profiles],
  );

  const filtered = useMemo(() => {
    const q = committedQuery.trim().toLowerCase();
    return rows.filter(({ u, f }) => {
      if (filters.companies.length && !(u.companyName && filters.companies.includes(u.companyName))) return false;
      if (filters.types.length && !filters.types.includes(u.userType)) return false;
      if (filters.subscriptions.length && !filters.subscriptions.includes(filterStatus(u))) return false;
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
        key: "recently-cancelled",
        label: "Recently Cancelled",
        onPick: () => {
          setFilters((prev) => ({ ...prev, subscriptions: Array.from(new Set([...prev.subscriptions, "Cancelled" as SubscriptionStatus])) }));
          setSort({ key: "subscription", dir: "desc" });
          morph.showTable();
        },
      },
      {
        key: "first-job",
        label: FIRST_JOB_GOAL,
        onPick: () => {
          setFilters((prev) => ({ ...prev, goals: Array.from(new Set([...prev.goals, FIRST_JOB_GOAL])) }));
          morph.showTable();
        },
      },
    ];
    return pills;
  }, [morph.showTable]);

  const landingRows: LandingRow[] = sorted.slice(0, 24).map(({ u }) => ({
    key: u.id,
    name: u.name,
    cells: {
      email: u.email,
      phone: u.phone,
      company: u.userType === "B2B" && u.companyName ? u.companyName : "",
      // Same wording the real table carries, so the hand-off is seamless.
      subscription: subscriptionLabel(u),
      lastAccess: formatDaysAgo(u.lastAccess),
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
              {/* The landing banner's collapsed form (Figma 1268:1736): once the
                  page morphs into the table, the pending count lives under the
                  title as one accent line that opens the queue. */}
              {nameChangeRequests.length > 0 && onOpenNameChanges && (
                <button className="tasks-note" onClick={() => onOpenNameChanges()}>
                  {nameChangeRequests.length} Name Changes Pending Review
                  <NoteChevronIcon />
                </button>
              )}
            </div>
            {/* Name Changes used to be a labelled header button here; the
                pending count is the banner / title note now (1268:1714 →
                1268:1736), so the header keeps only the 3-dot menu. Offer Codes
                is hidden for now; Scholarships sits in that menu beside Merge /
                Transfer, keeping its S shortcut. */}
            <div className="tasks-header-actions">
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
              {/* Pending name changes announce themselves above the hero
                  search. The whole card opens the queue — the CTA is the
                  affordance, not the only target. Figma 1268:1714. */}
              {nameChangeRequests.length > 0 && onOpenNameChanges && (
                <div
                  className="note-card note-card--accent lm-banner"
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenNameChanges()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenNameChanges();
                    }
                  }}
                >
                  <div className="lm-banner-main">
                    <div className="lm-banner-count">{nameChangeRequests.length}</div>
                    <div className="note-card-text">
                      <p className="note-card-title">Name Change Requests Pending</p>
                      <p className="note-card-body">Check against their ID saved on SkillCat</p>
                    </div>
                  </div>
                  <button
                    className="cta-quiet"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenNameChanges();
                    }}
                  >
                    Review Names
                    <span className="cta-kbd">N</span>
                  </button>
                </div>
              )}

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

              <LandingFilterRow pills={suggested} onShowAll={morph.showTable}>
                  <UsersFilters filters={filters} setFilters={setFilters} />
                </LandingFilterRow>

              <div className="lm-stage">
              <LandingOverlay
                caption="Recently Active Users"
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
                        onEdit={() => setEditing(row.u)}
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
          onLoginAs={() => loginAs(menu.user)}
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
          onRemove={() => setRemoving(menu.user)}
          onEdit={() => setEditing(menu.user)}
        />
      )}
      {pageMenu && (
        <PageActionsMenu
          rect={pageMenu}
          onClose={() => setPageMenu(null)}
          onMergeAccounts={onOpenMergeAccounts}
          onTransferSubscription={onOpenTransferSubscription}
          onOpenScholarships={onOpenScholarships}
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
      {editing && (
        <EditUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            updateUserContact(editing.id, v);
            // The roster object was updated in place; copy it so the row re-renders.
            setList((prev) => prev.map((u) => (u.id === editing.id ? { ...u } : u)));
            setEditing(null);
          }}
        />
      )}
      {removing && (
        <RemoveUserConfirm
          user={removing}
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            removeUser(removing.id);
            setList((prev) => prev.filter((u) => u.id !== removing.id));
            setRemoving(null);
            setRemovedToast(Date.now());
          }}
        />
      )}
      {removedToast > 0 && (
        <CopiedToast key={removedToast} label="User Removed" onDone={() => setRemovedToast(0)} />
      )}

      {/* What a finished merge or transfer comes back to — the shared toast,
          the same one a copied payment link raises. */}
      {flash && <CopiedToast label={flash} ms={4000} onDone={() => onFlashDone?.()} />}
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

/* Subscription reads as plain text like every other column on this table (per
   the user 2026-09-21 — the pills came off, the wording stayed). A paying
   Subscriber is named by the platform that bills them ("Stripe"), and a
   cancellation still inside the paid period adds the end date. A Starter-tier
   user — no plan of any kind — reads as the app's em dash. */
function subscriptionLabel(user: User): string {
  switch (user.subscriptionStatus) {
    case "Subscriber": {
      const platform = user.platform ?? "Stripe";
      return user.cancelsOn ? `${platform} · Cancels ${formatDate(user.cancelsOn)}` : platform;
    }
    case "Free Trial":
    case "Scholarship":
    case "Company Plan":
    case "Cancelled":
      return user.subscriptionStatus;
    case "Starter":
      return "—";
  }
}

function UserRow({
  row,
  cols,
  onOpenMenu,
  onEdit,
  menuOpen,
}: {
  row: Row;
  cols: ColMeta[];
  onOpenMenu: (anchor: HTMLElement) => void;
  onEdit: () => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const { u, f } = row;
  return (
    <tr className={menuOpen ? "menu-open" : ""}>
      <td className="col-name">{u.name}</td>
      {cols.map((c) => (
        <td key={c.key} className={c.className} data-copyable={c.copyable ? "" : undefined}>
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
          <button className="row-action-btn" aria-label="Edit User Details" onClick={onEdit}>
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
   node's order. (View User IDs sat last, after the destructive Remove User;
   dropped 2026-09-22 — IDs are reached from the Full Profile's View ID button
   and the Manage IDs table.) Fixed-positioned so it escapes the table scroll. The name/ID header this used to
   carry isn't in the component — the row the menu opened from already names
   the user. Items that don't apply to the row drop out; the rest close up. ─── */

function UserActionsMenu({
  rect,
  onClose,
  onLoginAs,
  onOpenProfile,
  onViewCompany,
  onViewAllEmployees,
  onManageCompletions,
  onCancelSubscription,
  onRemove,
  onEdit,
}: {
  rect: DOMRect;
  onClose: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onLoginAs: () => void;
  onOpenProfile: () => void;
  onViewCompany?: () => void;
  onViewAllEmployees?: () => void;
  onManageCompletions: () => void;
  /** Omitted when the user can't be cancelled from here — the item is hidden. */
  onCancelSubscription?: () => void;
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
      {item(<RowEditIcon />, "Edit User Details", onEdit)}
      {item(<MenuEnterIcon />, "Login As", onLoginAs)}
      {item(<MenuProfileIcon />, "View Profile", onOpenProfile)}
      {item(<MenuProgressIcon />, "Manage Training Progress", onManageCompletions)}
      {onViewCompany && item(<MenuBankIcon />, "View User's Company", onViewCompany)}
      {onViewAllEmployees && item(<MenuUsersIcon />, "View All Company Employees", onViewAllEmployees)}
      {onCancelSubscription && item(<MenuCardOffIcon />, "Cancel Subscription", onCancelSubscription)}
      {item(<RowDeleteIcon />, "Remove User", onRemove, true)}
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
  onOpenScholarships,
}: {
  rect: DOMRect;
  onClose: () => void;
  onMergeAccounts?: () => void;
  onTransferSubscription?: () => void;
  onOpenScholarships?: () => void;
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
      {item(<MenuAwardIcon />, "Scholarships", onOpenScholarships)}
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

/* ─── Edit User — the Full Profile's EditUserModal as is. It leaves Escape to
   its owner (the profile page closes it with useEscape), so this adds that. ─── */

function EditUserDialog({
  user,
  onClose,
  onSave,
}: {
  user: User;
  onClose: () => void;
  onSave: (v: { name: string; email: string; phone: string }) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <EditUserModal
      initial={{ name: user.name, email: user.email, phone: user.phone }}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

/* ─── Remove User confirm — the danger PrmModal every Delete X? uses. ─── */

function RemoveUserConfirm({
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

  return (
    <PrmModal
      title="Remove User?"
      confirmLabel="Remove User"
      cancelLabel="Cancel"
      danger
      onCancel={onClose}
      onConfirm={onConfirm}
    >
      <div className="prm-stack">
        <p className="prm-content">
          <strong>{user.name}</strong> ({user.email}) loses access to SkillCat and is removed
          from Manage Users{user.userType === "B2B" && user.companyName ? <> and from the <strong>{user.companyName}</strong> roster</> : null}.
        </p>
        <p className="prm-content">This cannot be undone.</p>
      </div>
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

