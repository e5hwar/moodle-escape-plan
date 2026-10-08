import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  useUsers,
  updateUserContact,
  accessMoment,
  subscriptionFilterStatus,
  canCancelSubscription,
  cancelSubscription,
  matchesUserQuery,
  type User,
  type UserType,
  type UserRole,
  type SubscriptionStatus,
} from "../data/users";
import { buildUserProfile, type ProfileFields } from "../data/userProfile";
import { pendingCount, useNameChangeRequests } from "../data/nameChangeRequests";
import { CopiedToast } from "./CopiedToast";
import { useToast } from "./useToast";
import { CancelSubscriptionModal, EditUserModal } from "./UserProfilePage";
import {
  UsersFilters,
  UsersEditColumns,
  type UserColumnKey,
  type UserColumnState,
  type UserFilterState,
} from "./UsersFilters";
import { useColumnOrder, orderedColumns } from "./Filters";
import { UsersSearch } from "./UsersSearch";
import { loginAs } from "./loginAs";
import { useCollapsingHeader } from "../hooks/useCollapsingHeader";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { NoteChevronIcon, SortIcon, RowEditIcon, RowExternalLinkIcon, RowKebabIcon, MenuEnterIcon, MenuUsersIcon, MenuProfileIcon, MenuProgressIcon, MenuBankIcon, MenuCardOffIcon, MenuMergeIcon, MenuTransferIcon, MenuScholarshipIcon, PagePrevIcon, PageNextIcon } from "./icons";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";
import { SubscriptionPill } from "./SubscriptionPill";

const PAGE_SIZE = 50;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
  // An invite nobody has accepted has never been in.
  if (!iso) return null;
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
const GOAL_ORDER: Record<string, number> = { "Looking for First Trades Job": 0, "Exploring Careers in the Skilled Trades": 1, "Focussed on Advancing Career": 2, Other: 3 };

/* A Subscriber with an upcoming cancellation files under Cancelled for the
   Subscription filter and sort — shared with the Who Paid pages. */
const filterStatus = subscriptionFilterStatus;

/* Plan rank first; inside Cancelled, by cancellation date — an upcoming
   cancellation's `cancelsOn` (future) or a lapsed plan's `cancelledOn` — so
   desc reads cancelling-soon, then most recently cancelled. The whole list
   reverses on desc, so the date part is ascending here. */
function subscriptionSortValue(u: User): string {
  const rank = SUB_ORDER[filterStatus(u)];
  return `${rank}|${u.cancelsOn ?? u.cancelledOn ?? ""}`;
}

type Row = { u: User; f: ProfileFields };

/* Last-access columns sort by day, then the moment the hover tip shows, then
   a fixed per-user tiebreak — never the bare day alone, or everyone seen that
   day ties and the tie keeps roster order (all learners, then every company's
   employees) in one block. */
function accessSortValue(userId: string, iso: string | undefined, salt: string): string {
  if (!iso) return "";
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) h = Math.imul(h ^ userId.charCodeAt(i), 16777619);
  const ms = String(accessMoment(userId, iso, salt).getTime()).padStart(15, "0");
  return `${iso}|${ms}|${String(h >>> 0).padStart(10, "0")}`;
}

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
  { key: "email", label: "Email", copyable: true, className: "col-u-email", width: 190, render: (u) => u.email || "—", sortValue: (u) => u.email.toLowerCase() },
  { key: "phone", label: "Phone", copyable: true, className: "col-u-phone", width: 165, render: (u) => u.phone || "—", sortValue: (u) => u.phone },
  { key: "userType", label: "User Type", className: "col-u-type", width: 114, render: (u) => <TypePill type={u.userType} />, sortValue: (u) => u.userType },
  { key: "company", label: "Company", className: "col-u-company", width: 175, render: (u) => (u.userType === "B2B" && u.companyName ? u.companyName : null), sortValue: (u) => (u.companyName ?? "").toLowerCase() },
  { key: "role", label: "Role", className: "col-u-role", width: 130, render: (u) => u.role, sortValue: (u) => ROLE_ORDER[u.role] },
  { key: "subscription", label: "Subscription", className: "col-u-sub col-status", width: 240, render: (u) => <SubscriptionPill user={u} />, sortValue: subscriptionSortValue },
  { key: "language", label: "Language", className: "col-u-lang", width: 114, render: (_u, f) => f.language, sortValue: (_u, f) => f.language },
  { key: "goal", label: "Goal", className: "col-u-stage", width: 200, render: (_u, f) => f.goal, sortValue: (_u, f) => GOAL_ORDER[f.goal] ?? 0 },
  { key: "attribution", label: "Attribution", className: "col-u-attr", width: 160, render: (_u, f) => f.attribution, sortValue: (_u, f) => f.attribution.toLowerCase() },
  { key: "zipCode", label: "Zip Code", className: "col-u-zip", width: 100, render: (_u, f) => f.zipCode, sortValue: (_u, f) => f.zipCode },
  { key: "industryPreference", label: "Industry Preference", className: "col-u-industry", width: 188, render: (_u, f) => f.industryPreference, sortValue: (_u, f) => f.industryPreference.toLowerCase() },
  { key: "lastAccess", label: "App Last Access", className: "col-u-date", width: 160, render: (u) => <LastAccessCell userId={u.id} iso={u.lastAccess} salt="app" />, sortValue: (u) => accessSortValue(u.id, u.lastAccess, "app") },
  { key: "dashboardLastAccess", label: "Dashboard Last Access", className: "col-u-date", width: 210, render: (u) => (u.dashboardLastAccess ? <LastAccessCell userId={u.id} iso={u.dashboardLastAccess} salt="dashboard" /> : null), sortValue: (u) => accessSortValue(u.id, u.dashboardLastAccess, "dashboard") },
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

/** What the list was showing — App hands it back when the page is returned
 *  to from Scholarships, Name Changes, Manage Completions, Merge or Transfer. */
export type UsersListState = {
  filters: UserFilterState;
  columns: UserColumnState;
  order: UserColumnKey[];
  sort: { key: SortKey; dir: SortDir };
  query: string;
  page: number;
};

/** Runs `fn` when any of `deps` changes AFTER the first render — never on
 *  mount (StrictMode's second run included), so a restored list keeps its
 *  page and scroll. Same helper as the Companies list. */
function useOnChange(deps: unknown[], fn: () => void, useEff = useEffect) {
  const prev = useRef<unknown[] | null>(null);
  useEff(() => {
    const p = prev.current;
    prev.current = deps;
    if (p && p.some((d, i) => !Object.is(d, deps[i]))) fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function UsersPage({
  onViewCompany,
  onManageCompletions,
  onOpenScholarships,
  onOpenNameChanges,
  onOpenMergeAccounts,
  onOpenTransferSubscription,
  initialCompanyFilter,
  restore,
  onSaveState,
  flash,
  onFlashDone,
}: {
  onViewCompany?: (companyName: string) => void;
  onManageCompletions: (userId: string) => void;
  onOpenScholarships?: () => void;
  onOpenNameChanges?: () => void;
  onOpenMergeAccounts?: () => void;
  onOpenTransferSubscription?: () => void;
  initialCompanyFilter?: string;
  /** The list as it was left, when coming back to it. */
  restore?: UsersListState | null;
  onSaveState?: (state: UsersListState) => void;
  /** A one-line success raised by something that finished and came back here
   *  (a merge, a transfer) — shown as the shared toast. */
  flash?: string | null;
  onFlashDone?: () => void;
}) {
  // The live roster (users.ts): every learner and every company's employees,
  // with this session's edits — the Full Profile tab writes to the same one.
  const list = useUsers();
  const profiles = useMemo(
    () => new Map(list.map((u) => [u.id, buildUserProfile(u).fields] as const)),
    [list],
  );
  /* Coming back from a page this one opened restores the list as it was left;
     a company deep link (View Employees) starts from that company instead. */
  const restored = initialCompanyFilter ? null : restore ?? null;
  const [columns, setColumns] = useState<UserColumnState>(restored?.columns ?? DEFAULT_COLUMNS);
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [defaultOrder, setOrder] = useColumnOrder(COLS);
  const [orderTouched, setOrderTouched] = useState(false);
  const order = !orderTouched && restored ? restored.order : defaultOrder;
  const [filters, setFilters] = useState<UserFilterState>(
    restored?.filters ??
      (initialCompanyFilter ? { ...EMPTY_FILTERS, companies: [initialCompanyFilter] } : EMPTY_FILTERS),
  );
  // Search bar: committedQuery only changes on Enter. The company filter is shared
  // with the Filters row (filters.companies) and applies immediately.
  const [committedQuery, setCommittedQuery] = useState(restored?.query ?? "");
  /* A company's roster opens grouped by seniority (Admin, Manager, then
     Employee); any header still re-sorts it. */
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(
    restored?.sort ?? (initialCompanyFilter ? { key: "role", dir: "desc" } : { key: "lastAccess", dir: "desc" }),
  );
  const [page, setPage] = useState(restored?.page ?? 1);
  const [menu, setMenu] = useState<{ user: User; rect: DOMRect } | null>(null);
  // Page-level 3-dot menu (Figma 677:1956), anchored to the header kebab.
  const [pageMenu, setPageMenu] = useState<DOMRect | null>(null);
  // Cancel Subscription confirm — the Full Profile's own modal. Confirming
  // writes `cancelsOn` to the user, so the pill reads "Cancels …" here and on
  // the profile, and neither offers Cancel again.
  const [cancelSub, setCancelSub] = useState<User | null>(null);
  // Edit User — the Full Profile's own modal, from the row pencil or the menu.
  const [editing, setEditing] = useState<User | null>(null);
  /** The page's own success toast — "Profile Updated" after an Edit User
   *  save (the user, 2026-10-04), "Subscription Canceled" after a cancel. */
  const [toast, toastNode] = useToast();
  /* S opens Scholarships (page 3-dot menu), N the name-change queue (the
     banner's Review Names) — never through an open dialog or menu, and N only
     while something is waiting. */
  const nameChanges = useNameChangeRequests();
  const pendingNames = pendingCount(nameChanges);
  const overlayUp = !!(menu || pageMenu || cancelSub || editing);
  useCreateShortcut(() => onOpenScholarships?.(), !!onOpenScholarships && !overlayUp, "s");
  useCreateShortcut(() => onOpenNameChanges?.(), !!onOpenNameChanges && pendingNames > 0 && !overlayUp, "n");

  // Hand the list's state back to App, for the return trip.
  useEffect(() => {
    onSaveState?.({ filters, columns, order, sort, query: committedQuery, page });
  }, [filters, columns, order, sort, committedQuery, page, onSaveState]);

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
      return matchesUserQuery(q, u);
    });
  }, [rows, committedQuery, filters]);

  // Picking a company groups its roster by seniority (Admin, Manager, then
  // Employee) — a starting order, not a lock: any header re-sorts it.
  const companyFilterActive = filters.companies.length > 0;
  useOnChange([companyFilterActive], () => {
    if (companyFilterActive) setSort({ key: "role", dir: "desc" });
  });
  const effectiveSort = sort;

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, effectiveSort.key));
    return effectiveSort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, effectiveSort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useOnChange([committedQuery, filters, sort], () => setPage(1));

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  const visibleCols = useMemo(() => orderedColumns(COLS, order, columns), [columns, order]);
  // Natural table width (name col + optional cols + actions) so the table
  // scrolls horizontally rather than crushing columns on a narrow page.
  const tableMin = 200 + visibleCols.reduce((s, c) => s + c.width, 0) + 40;

  // The page's one scroller — the Tasks / Certifications collapsing header:
  // the landing header folds away over the first stretch of scroll with the
  // table glued beneath it, and the rows scroll under the pinned header after
  // that. A company deep link (View Employees) opens collapsed, on the table.
  const head = useCollapsingHeader(Boolean(initialCompanyFilter));
  const { scrollToFirstRow } = head;

  // A new query, filter, sort or page starts the list at its first row. A
  // collapsed header stays collapsed; one still open is left as it is.
  useOnChange([committedQuery, filters, sort, visiblePage], scrollToFirstRow, useLayoutEffect);

  // The landing's summary line — every user on the roster, not the filtered
  // rows (the pagination footer counts those), and how many of them hold an
  // ongoing subscription. A Subscriber with an upcoming cancellation isn't
  // ongoing — they read as Cancelled everywhere else on the page too.
  const catalog = useMemo(
    () => ({
      users: list.length,
      subscribers: list.filter((u) => filterStatus(u) === "Subscriber").length,
    }),
    [list],
  );

  // Pending name changes: the banner at the landing, the note under the title
  // once collapsed — ONE callout at two sizes. The collapse condenses the card
  // into the note (its box shrinks onto the note's line, its count, title and
  // CTA travel onto the note's count, label and chevron), so it reads as the
  // same thing changing shape, never one leaving and another arriving.
  const hasNameChanges = pendingNames > 0 && !!onOpenNameChanges;

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        {/* The Tasks / Certifications collapsing header: the page is ONE
            scroller — the table's own `.table-xscroll` — opening on the
            landing (the Enlarged Header, the name-change banner, the Large
            search bar) sitting straight on top of the real table. See
            useCollapsingHeader and the `.tasks.clh` rules in index.css; the
            banner's parts join the collapse only when it shows. */}
        <div className={`tasks clh${hasNameChanges ? " clh--banner" : ""}`}>
          <div className="co-table-col">
            <div
              ref={head.scrollRef}
              className="table-xscroll clh-scroll"
              style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}
            >
              <div className="clh-canvas">
                <div ref={head.headerRef} className="clh-head">
                  {/* The header's pieces are its direct children, so each can pin
                      inside it (see the `.tasks.clh` rules). The action button
                      keeps a `.tasks-header` of its own for its button style. */}
                  {/* Name Changes used to be a labelled header button here; the
                      pending count is the banner / title note now (1268:1714 →
                      1268:1736), so the header keeps only the 3-dot menu. Scholarships
                      sits in that menu beside Merge / Transfer, keeping its S
                      shortcut. */}
                  <header className="tasks-header clh-actions">
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
                  <h1 className="tasks-title">Users</h1>
                  {/* The landing banner's collapsed form (Figma 1268:1736): one
                      accent line under the title that opens the queue. Its count,
                      label and chevron are separate pieces so each can arrive from
                      its twin in the card (the count's no-break space stands in
                      for the space a flex item would drop), so the button
                      carries its sentence as a label. */}
                  {hasNameChanges && (
                    <button
                      className="tasks-note"
                      aria-label={`${pendingNames} Name Changes Pending Review`}
                      onClick={() => onOpenNameChanges?.()}
                    >
                      <span className="tasks-note-count">{pendingNames}{" "}</span>
                      <span className="tasks-note-text">
                        <span className="nc-shared">Name Change</span>
                        <span className="nc-rest">s Pending Review</span>
                      </span>
                      <NoteChevronIcon />
                    </button>
                  )}
                  {/* The landing's summary line, in the shape of Figma
                      1356:1864 ("3210 Tasks · Across 230 Certifications"). It
                      fades as the header collapses. */}
                  <p className="tasks-subtitle clh-sub">
                    {`${plural(catalog.users, "User", "Users")} · ${plural(
                      catalog.subscribers,
                      "Subscriber",
                      "Subscribers",
                    )}`}
                  </p>

                  {/* Pending name changes announce themselves above the hero
                      search, and condense into the title note as the header
                      collapses. The whole card opens the queue — the CTA is the
                      affordance, not the only target. Figma 1268:1714. */}
                  {hasNameChanges && (
                    <div className="clh-banner">
                      <div
                        className="note-card note-card--accent lm-banner"
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpenNameChanges?.()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenNameChanges?.();
                          }
                        }}
                      >
                        <div className="lm-banner-main">
                          <div className="lm-banner-count">{pendingNames}</div>
                          <div className="note-card-text">
                            {/* "Name Change" is the words the title shares with
                                the note's label, so the morph can hold it while
                                only the rest swaps. */}
                            <p className="note-card-title">
                              <span className="nc-shared">Name Change</span>
                              <span className="nc-rest"> Requests Pending</span>
                            </p>
                            <p className="note-card-body">Check against their ID saved on SkillCat</p>
                          </div>
                        </div>
                        <button
                          className="cta-quiet"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenNameChanges?.();
                          }}
                        >
                          Review Names
                          <span className="cta-kbd">N</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="toolbar">
                    <UsersSearch
                      users={list}
                      companies={filters.companies}
                      onCompaniesChange={(c) => setFilters((prev) => ({ ...prev, companies: c }))}
                      query={committedQuery}
                      onCommit={setCommittedQuery}
                    />
                  </div>

                  <UsersFilters filters={filters} setFilters={setFilters} />
                </div>

                <table ref={head.theadRef} className="table table-head">
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
                          onOrderChange={(o) => {
                            setOrderTouched(true);
                            setOrder(o as typeof order);
                          }}
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
                    </tbody>
                  </table>
                </div>
                {paged.length === 0 && <TableEmpty />}
              </div>
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
            /* Only a personal plan billed through a platform we can cancel
               from here, not already cancelling (users.canCancelSubscription). */
            canCancelSubscription(menu.user) ? () => setCancelSub(menu.user) : undefined
          }
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
        <CancelSubscriptionModal
          user={cancelSub}
          onClose={() => setCancelSub(null)}
          onConfirm={() => {
            cancelSubscription(cancelSub.id);
            setCancelSub(null);
            toast("Subscription Canceled");
          }}
        />
      )}
      {editing && (
        <EditUserDialog
          user={editing}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            updateUserContact(editing.id, v);
            setEditing(null);
            toast("Profile Updated");
          }}
        />
      )}

      {/* What a finished merge or transfer comes back to — the shared toast,
          the same one a copied payment link raises. */}
      {flash && <CopiedToast label={flash} ms={4000} onDone={() => onFlashDone?.()} />}
      {!flash && toastNode}
    </div>
  );
}

function ColGroup({ cols }: { cols: ColMeta[] }) {
  return (
    <TableCols data={[200, ...cols.map((c) => c.width)]} trail={[40]} />
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
    /* No preview panel for Users (user, 2026-10-07): the row itself opens
       nothing — its hover actions and ⋯ menu do the work. */
    <tr className={`is-static${menuOpen ? " menu-open" : ""}`}>
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
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget); }}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit User Details" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <RowEditIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="Open profile in new tab"
            title="Open full profile in a new tab"
            onClick={(e) => { e.stopPropagation(); openProfile(u); }}
          >
            <RowExternalLinkIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More actions"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget); }}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─── Three-dot actions menu — Figma 673:1437 "3-Dot Menu - B2C User", in that
   node's order. (View User IDs dropped 2026-09-22 — IDs are reached from the
   Full Profile's View ID button and the Manage IDs table. Remove User dropped
   2026-10-04, user — users are not removed from here.) Fixed-positioned so it escapes the table scroll. The name/ID header this used to
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
  onEdit,
}: {
  rect: DOMRect;
  onClose: () => void;
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
      {item(<MenuScholarshipIcon />, "Scholarships", onOpenScholarships)}
      {item(<MenuMergeIcon />, "Merge Accounts", onMergeAccounts)}
      {item(<MenuTransferIcon />, "Transfer Subscription", onTransferSubscription)}
    </div>
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

/* ─── Open the full profile in a new browser tab ─── */
/* Opens a real in-app page via URL params, rendered standalone by App. */

function openProfile(user: User) {
  window.open(
    `${window.location.origin}${window.location.pathname}?profile=${user.id}`,
    "_blank",
    "noopener",
  );
}

