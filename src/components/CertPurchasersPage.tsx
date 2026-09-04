import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  users as allUsers,
  type User,
  type UserRole,
  type SubscriptionStatus,
} from "../data/users";
import { buildUserProfile, type ProfileFields } from "../data/userProfile";
import {
  buildAllCertPurchases,
  isConsumableCert,
  consumableResetsProgress,
  todayIso,
  usersWithoutAccess,
  CURRENT_ADMIN,
  type CertPurchase,
} from "../data/certPurchases";
import { certifications as allCerts, type Certification } from "../data/certifications";
import {
  UsersFilters,
  UsersEditColumns,
  MultiPill,
  type UserColumnKey,
  type UserFilterState,
} from "./UsersFilters";
import { useColumnOrder, orderedColumns } from "./Filters";
import { PrmModal } from "./PrmModal";
import { EntitySearch, type SearchScope } from "./UsersSearch";
import { SortIcon, ChevronLeftIcon, AddIcon, SearchIcon, RowKebabIcon, MenuLockIcon, ChevronRightIcon } from "./icons";

const PAGE_SIZE = 50;

/* ─── columns: every Users column plus the four purchase columns ─── */
type PurchaserColumnKey =
  | UserColumnKey
  | "certName"
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
  certName: true,
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
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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
  /** Tooltip on the cell — where a grant's admin detail now lives. */
  tip?: (r: Row) => string | undefined;
  render: (r: Row) => React.ReactNode;
  sortValue: (r: Row) => string | number;
};

/* Plain-text columns, per the table convention — every cell is a string, with
   the detail a pill used to carry (who comped access, why a row is muted)
   demoted to a hover tooltip. Widths fit the HEADER label, not just the data:
   header type is 16px SemiBold and never wraps, so a column narrower than its
   own label spills over the next one.

   Order here is the on-screen column order: the certification and purchase
   columns sit right after Email / Phone, with the rest of the Users columns
   available afterwards under Edit Columns. */
const COLS: ColMeta[] = [
  { key: "email", label: "Email", className: "col-u-email", width: 190, render: ({ u }) => u.email, sortValue: ({ u }) => u.email.toLowerCase() },
  { key: "phone", label: "Phone", className: "col-u-phone", width: 165, render: ({ u }) => u.phone, sortValue: ({ u }) => u.phone },
  { key: "certName", label: "Certification", className: "col-cp-cert", width: 250, tip: ({ p }) => p.certName, render: ({ p }) => p.certName, sortValue: ({ p }) => p.certName.toLowerCase() },
  { key: "access", label: "Access", className: "col-cp-access", width: 110, tip: ({ p }) => (p.granted ? `Access granted by ${p.grantedBy ?? "an admin"}` : undefined), render: ({ p }) => (p.granted ? "Free" : "Paid"), sortValue: ({ p }) => (p.granted ? 0 : 1) },
  { key: "purchaseDate", label: "Purchase Date", className: "col-u-date", width: 160, render: ({ p }) => formatDate(p.purchaseDate), sortValue: ({ p }) => p.purchaseDate ?? "" },
  { key: "grantDate", label: "Grant Date", className: "col-u-date", width: 145, tip: ({ p }) => (p.grantDate && p.grantedBy ? `Granted by ${p.grantedBy}` : undefined), render: ({ p }) => formatDate(p.grantDate), sortValue: ({ p }) => p.grantDate ?? "" },
  { key: "progress", label: "Progress", className: "col-cp-progress", width: 125, render: ({ p }) => `${p.progress}%`, sortValue: ({ p }) => p.progress },
  { key: "completion", label: "Completion", className: "col-cp-completion", width: 145, render: ({ p }) => (p.completed ? "Complete" : "In Progress"), sortValue: ({ p }) => (p.completed ? 1 : 0) },
  { key: "accessEnded", label: "Access Ended", className: "col-u-date", width: 160, render: ({ p }) => formatDate(p.accessEndedDate), sortValue: ({ p }) => p.accessEndedDate ?? "" },
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
  const profiles = useMemo(
    () => new Map(allUsers.map((u) => [u.id, buildUserProfile(u).fields] as const)),
    [],
  );
  const userById = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), []);

  /* The Certification this page was opened from may sit outside the seeded paid
     set (one created in this session), so union it in — otherwise the
     pre-applied pill would offer no way back to its own value. */
  const paidCerts = useMemo(() => {
    const seeded = allCerts.filter((c) => !!c.payment);
    return seeded.some((c) => c.id === cert.id) ? seeded : [cert, ...seeded];
  }, [cert]);
  const certOptions = useMemo(
    () => [...new Set(paidCerts.map((c) => c.name))].sort(),
    [paidCerts],
  );
  /* Rows span certs now, so revoke has to read the consumable rules off the ROW's
     Certification rather than the page's. */
  const certByName = useMemo(
    () => new Map(paidCerts.map((c) => [c.name, c] as const)),
    [paidCerts],
  );

  /* Every paid Certification's purchasers, pre-filtered to the one clicked on
     the Certifications page — same shape as the quiz Who Paid page. */
  // Local working copy so revoke / grant persist in-session.
  const [purchases, setPurchases] = useState<CertPurchase[]>(() =>
    buildAllCertPurchases(paidCerts),
  );
  const [columns, setColumns] = useState<PurchaserColumnState>(DEFAULT_COLUMNS);
  // Column display order — reordered by dragging in the Edit Columns menu.
  const [order, setOrder] = useColumnOrder(COLS);
  const [filters, setFilters] = useState<UserFilterState>(EMPTY_FILTERS);
  const [certNames, setCertNames] = useState<string[]>([cert.name]);
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

  // Users represented in this list — used by the search bar's suggestions.
  const purchaserUsers = useMemo(() => rows.map((r) => r.u), [rows]);

  const companyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    purchaserUsers.forEach((u) => {
      if (u.companyName) counts.set(u.companyName, (counts.get(u.companyName) ?? 0) + 1);
    });
    return { names: [...counts.keys()].sort(), counts };
  }, [purchaserUsers]);

  const scopes: SearchScope[] = [
    {
      token: "Certification",
      options: certOptions,
      applied: certNames,
      onAppliedChange: setCertNames,
      optionsLabel: "Certifications",
      example: "Certification: EPA 608 Universal",
      hint: "Filter by Certification",
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
      if (certNames.length && !certNames.includes(p.certName)) return false;
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
        p.certName.toLowerCase().includes(q)
      );
    });
  }, [rows, committedQuery, filters, certNames, accessTypes]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compareRows(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [committedQuery, filters, certNames, accessTypes, sort]);

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

  /* What revoking this row actually costs the user — the confirm and the
     mutation read the same three facts off the row's own Certification, not
     the page's, because the list spans all of them. */
  function revokeTerms(row: Row) {
    const rowCert = certByName.get(row.p.certName) ?? cert;
    const consumable = isConsumableCert(rowCert);
    return { consumable, resets: consumableResetsProgress(rowCert) };
  }

  function revokeAccess(row: Row) {
    const { consumable, resets } = revokeTerms(row);
    const today = todayIso();
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.userId !== row.u.id || p.certName !== row.p.certName) return p;
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
    setRevoking(null);
  }

  function grantAccess(user: User) {
    setPurchases((prev) => {
      // already has access to THIS Certification
      if (prev.some((p) => p.userId === user.id && p.certName === cert.name)) return prev;
      return [
        {
          userId: user.id,
          certName: cert.name,
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
          {/* Reached from a Certification's "View who paid" action, so the
              Certifications crumb is the way back — same header as the quiz
              Who Paid page. The Certification this opened on is carried by the
              pre-applied Certification pill, not a subtitle. */}
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <button className="rvc-crumb" onClick={onBack} title="Back to Certifications">
                  Certifications
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Who Paid</span>
              </nav>
              <h1 className="tasks-title">Who Paid</h1>
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
                {/* The shared page search — its scopes feed the Filters-row
                    pills below, exactly as on the quiz Who Paid page. */}
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
                    label="Certification"
                    all={certOptions}
                    value={certNames}
                    onApply={setCertNames}
                    searchable
                    searchPlaceholder="Search Certifications"
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
                extraActive={certNames.length > 0 || accessTypes.length > 0}
                onClearExtra={() => {
                  setCertNames([]);
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
                          key={`${row.u.id}-${row.p.certName}`}
                          row={row}
                          cols={visibleCols}
                          selected={row.u.id === selectedId}
                          onClick={() => setSelectedId(row.u.id === selectedId ? null : row.u.id)}
                          onOpenMenu={(rect) => setMenu({ row, rect })}
                          menuOpen={
                            menu?.row.p.userId === row.p.userId &&
                            menu.row.p.certName === row.p.certName
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
        <GrantAccessModal
          cert={cert}
          candidates={usersWithoutAccess(purchases, cert.name, allUsers)}
          onGrant={grantAccess}
          onClose={() => setGranting(false)}
        />
      )}

      {menu && (
        <PurchaserActionsMenu
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
          onConfirm={() => revokeAccess(revoking)}
        >
          {/* Body copy is children, not `description` — the shell's own
              convention for a confirm (Figma 483:588). */}
          <p className="prm-text">
            {revoking.u.name}'s access to “{revoking.p.certName}” ends immediately.{" "}
            {revokeTerms(revoking).consumable
              ? `${revokeTerms(revoking).resets ? "Their progress on this Certification is reset, and they" : "They"} can purchase the Certification again to regain access.`
              : "They keep their completion record. This can't be undone."}
          </p>
        </PrmModal>
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
      <td className="col-name" data-tip={p.revokedDate ? `Access revoked ${formatDate(p.revokedDate)}` : u.name}>
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
    /* Reason the row is disabled — a second line INSIDE the button, so the row
       can top-align the glyph against the label (Figma 785:1699). */
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
      /* Figma 786:1719 / 785:1699: the panel is the single Revoke Access row —
         no name/email head — so it hugs its content. */
      className="u-menu u-menu--hug"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {item(
        <MenuLockIcon />,
        "Revoke Access",
        onRevoke,
        true,
        alreadyRevoked,
        alreadyRevoked ? "Access has already been revoked for this purchase" : undefined,
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
