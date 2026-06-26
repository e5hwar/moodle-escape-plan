import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getCompanyBilling,
  getCompanyUsers,
  CURRENCY_SYMBOL,
  CANCELLATION_REASONS,
  type Company,
  type CompanyUser,
  type Tier,
  type SubscriptionStatus,
  type SignUpChannel,
} from "../data/companies";
import { userBank, type ScholarshipUser } from "../data/scholarships";
import { SearchIcon, SortIcon, AddIcon, EnterKeyIcon, SmallXIcon, CheckBoldIcon } from "./icons";
import {
  CompanyFilters,
  CompanyEditColumnsButton,
  type CompanyFilterState,
  type CompanyColumnState,
} from "./CompanyFilters";

const PAGE_SIZE = 50;

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);

const MoreIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

type SortKey = "name" | "email" | "tier" | "status" | "signUp" | "seats" | "industry" | "partnership" | "seatsAdded" | "seatsRemoved";
type SortDir = "asc" | "desc";

const TIER_ORDER: Record<Tier, number> = {
  "Free Trial": 0,
  Essentials: 1,
  Growth: 2,
  Pro: 3,
  "Complimentary Access": 4,
};

function compare(a: Company, b: Company, key: SortKey): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "email": return a.email.localeCompare(b.email);
    case "tier": return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    case "status": return getCompanyBilling(a).status.localeCompare(getCompanyBilling(b).status);
    case "signUp": return getCompanyBilling(a).signUp.localeCompare(getCompanyBilling(b).signUp);
    case "seats": return a.seats - b.seats;
    case "industry": return a.industry.localeCompare(b.industry);
    case "partnership": return a.partnership.localeCompare(b.partnership);
    case "seatsAdded": return getCompanyBilling(a).seatsAdded - getCompanyBilling(b).seatsAdded;
    case "seatsRemoved": return getCompanyBilling(a).seatsRemoved - getCompanyBilling(b).seatsRemoved;
  }
}

type Props = {
  companies: Company[];
  initialQuery?: string;
  onNewCompany: () => void;
  onEditCompany: (company: Company) => void;
  onUpdateCompany: (company: Company) => void;
};

export function CompaniesPage({ companies, initialQuery = "", onNewCompany, onEditCompany, onUpdateCompany }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<CompanyFilterState>({
    tiers: [],
    industries: [],
    partnerships: [],
    statuses: [],
  });
  const [columns, setColumns] = useState<CompanyColumnState>({
    signUp: true,
    seats: true,
    seatsAdded: false,
    seatsRemoved: false,
    industry: true,
    partnership: true,
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ company: Company; rect: DOMRect } | null>(null);
  const [holderModal, setHolderModal] = useState<Company | null>(null);
  const [billingModal, setBillingModal] = useState<Company | null>(null);
  const [cancelModal, setCancelModal] = useState<Company | null>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (q && !(
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q) ||
        c.partnership.toLowerCase().includes(q) ||
        c.tier.toLowerCase().includes(q)
      )) return false;
      if (filters.tiers.length && !filters.tiers.includes(c.tier)) return false;
      if (filters.industries.length && !filters.industries.includes(c.industry)) return false;
      if (filters.partnerships.length && !filters.partnerships.includes(c.partnership)) return false;
      if (filters.statuses.length && !filters.statuses.includes(getCompanyBilling(c).status)) return false;
      return true;
    });
  }, [companies, query, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => setPage(1), [query, sort, filters]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  const selected = selectedId ? companies.find((c) => c.id === selectedId) ?? null : null;
  const panelOpen = selected !== null;
  // Natural table width so columns scroll horizontally instead of crushing on a
  // narrow page. Mirrors the visible columns in <ColGroup>; optional columns are
  // hidden while the side panel is open (compact mode), so they don't count then.
  const tableMin =
    220 /* name */ +
    44 /* actions */ +
    (panelOpen ? 150 + 130 : 195 + 130) /* email + tier */ +
    120 /* status */ +
    (!panelOpen
      ? (columns.signUp ? 130 : 0) +
        (columns.seats ? 64 : 0) +
        (columns.seatsAdded ? 72 : 0) +
        (columns.seatsRemoved ? 82 : 0) +
        (columns.industry ? 145 : 0) +
        (columns.partnership ? 155 : 0)
      : 0);

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Manage Companies</h1>
              <div className="tasks-subtitle">{companies.length} Companies · all tiers</div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={onNewCompany}>
                <AddIcon />
                Add Company
                <span className="cta-kbd"><EnterKeyIcon /></span>
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="search-wrap">
                <span className="search-icon"><SearchIcon /></span>
                <input
                  className="search-input"
                  placeholder="Search Companies by name, email, industry, or tier…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="search-kbd"><span className="kbd-cmd">⌘</span><span className="kbd-letter">K</span></span>
              </div>

              <CompanyFilters filters={filters} setFilters={setFilters} />

              <div className="co-table-row">
                <div className="co-table-col">
                  <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
                  <table className="table table-head">
                    <ColGroup columns={columns} compact={panelOpen} />
                    <thead>
                      <tr>
                        <SortableHeader col="name" label="Company" className="col-name" sort={sort} toggle={toggleSort} />
                        <SortableHeader col="email" label="Email" className="col-email" sort={sort} toggle={toggleSort} sortable={false} />
                        <SortableHeader col="tier" label="Tier" className="col-tier" sort={sort} toggle={toggleSort} />
                        <SortableHeader col="status" label="Status" className="col-status" sort={sort} toggle={toggleSort} />
                        {columns.signUp && !panelOpen && <SortableHeader col="signUp" label="Sign-Up" className="col-signup" sort={sort} toggle={toggleSort} />}
                        {columns.seats && !panelOpen && <SortableHeader col="seats" label="Seats" className="col-seats" sort={sort} toggle={toggleSort} />}
                        {columns.seatsAdded && !panelOpen && <SortableHeader col="seatsAdded" label="Added" className="col-seats-added" sort={sort} toggle={toggleSort} />}
                        {columns.seatsRemoved && !panelOpen && <SortableHeader col="seatsRemoved" label="Removed" className="col-seats-removed" sort={sort} toggle={toggleSort} />}
                        {columns.industry && !panelOpen && <SortableHeader col="industry" label="Industry" className="col-industry" sort={sort} toggle={toggleSort} />}
                        {columns.partnership && !panelOpen && <SortableHeader col="partnership" label="Partnership" className="col-partnership" sort={sort} toggle={toggleSort} />}
                        <th className="col-actions">
                          <CompanyEditColumnsButton columns={columns} setColumns={setColumns} />
                        </th>
                      </tr>
                    </thead>
                  </table>

                  <div className="tasks-scroll">
                    <table className="table table-body">
                      <ColGroup columns={columns} compact={panelOpen} />
                      <tbody>
                        {paged.map((c) => (
                          <CompanyRow
                            key={c.id}
                            company={c}
                            selected={c.id === selectedId}
                            columns={columns}
                            compact={panelOpen}
                            onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                            onEdit={() => onEditCompany(c)}
                            onOpenMenu={(rect) => setMenu({ company: c, rect })}
                          />
                        ))}
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

                {selected && (
                  <CompanyPanel
                    company={selected}
                    onClose={() => setSelectedId(null)}
                    onUpdate={onUpdateCompany}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <CompanyActionsMenu
          company={menu.company}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEditCompany={() => onEditCompany(menu.company)}
          onEditAccountHolder={() => setHolderModal(menu.company)}
          onAddBillingEmails={() => setBillingModal(menu.company)}
          onCancelSubscription={() => setCancelModal(menu.company)}
        />
      )}

      {holderModal && (
        <EditAccountHolderModal
          company={holderModal}
          onClose={() => setHolderModal(null)}
          onSave={(patch) => {
            onUpdateCompany({ ...holderModal, ...patch });
            setHolderModal(null);
          }}
        />
      )}

      {billingModal && (
        <AddBillingEmailsModal
          company={billingModal}
          onClose={() => setBillingModal(null)}
        />
      )}

      {cancelModal && (
        <CancelSubscriptionModal
          company={cancelModal}
          onClose={() => setCancelModal(null)}
          onConfirm={(reason) => {
            onUpdateCompany({ ...cancelModal, status: "Canceled" });
            setCancelModal(null);
            window.alert(
              `${cancelModal.name}'s subscription is scheduled to cancel at the end of the current billing cycle.\n\nReason: ${reason}`,
            );
          }}
        />
      )}
    </div>
  );
}

function ColGroup({ columns, compact }: { columns: CompanyColumnState; compact: boolean }) {
  return (
    <colgroup>
      <col />
      <col style={{ width: compact ? 150 : 195 }} />
      <col style={{ width: 130 }} />
      <col style={{ width: 120 }} />
      {columns.signUp && !compact && <col style={{ width: 130 }} />}
      {columns.seats && !compact && <col style={{ width: 64 }} />}
      {columns.seatsAdded && !compact && <col style={{ width: 72 }} />}
      {columns.seatsRemoved && !compact && <col style={{ width: 82 }} />}
      {columns.industry && !compact && <col style={{ width: 145 }} />}
      {columns.partnership && !compact && <col style={{ width: 155 }} />}
      <col style={{ width: 44 }} />
    </colgroup>
  );
}

function SortableHeader({
  col, label, className, sort, toggle, sortable = true,
}: {
  col: SortKey; label: string; className?: string; sort: { key: SortKey; dir: SortDir }; toggle: (k: SortKey) => void; sortable?: boolean;
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

function TierPill({ tier }: { tier: Tier }) {
  const slug = tier.toLowerCase().replace(/\s+/g, "-");
  return <span className={`co-tier co-tier--${slug}`}>{tier}</span>;
}

function StatusPill({ status }: { status: SubscriptionStatus }) {
  const slug = status.toLowerCase().replace(/\s+/g, "-");
  return <span className={`co-status co-status--${slug}`}>{status}</span>;
}

function SignUpPill({ signUp }: { signUp: SignUpChannel }) {
  const self = signUp === "Self Sign-Up";
  return (
    <span className={`co-signup co-signup--${self ? "self" : "internal"}`}>
      {self ? "Self" : "Internal"}
    </span>
  );
}

function CompanyRow({
  company, selected, columns, compact, onClick, onEdit, onOpenMenu,
}: {
  company: Company; selected: boolean; columns: CompanyColumnState; compact: boolean; onClick: () => void; onEdit: () => void; onOpenMenu: (rect: DOMRect) => void;
}) {
  const billing = getCompanyBilling(company);
  return (
    <tr className={selected ? "selected" : ""} onClick={onClick}>
      <td className="col-name">{company.name}</td>
      <td className="col-email">{company.email}</td>
      <td className="col-tier"><TierPill tier={company.tier} /></td>
      <td className="col-status"><StatusPill status={billing.status} /></td>
      {columns.signUp && !compact && <td className="col-signup"><SignUpPill signUp={billing.signUp} /></td>}
      {columns.seats && !compact && <td className="col-seats">{company.seats.toLocaleString()}</td>}
      {columns.seatsAdded && !compact && <td className="col-seats-added co-seats-added">+{billing.seatsAdded}</td>}
      {columns.seatsRemoved && !compact && <td className="col-seats-removed co-seats-removed">−{billing.seatsRemoved}</td>}
      {columns.industry && !compact && <td className="col-industry">{company.industry || "—"}</td>}
      {columns.partnership && !compact && <td className="col-partnership">{company.partnership || "—"}</td>}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <MoreIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit" title="Edit company" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <PencilIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
          >
            <MoreIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────── Row actions menu (fixed-positioned) ─────────────── */

const HolderIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const PencilMenuIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);

const CancelIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </svg>
);

function CompanyActionsMenu({
  company, rect, onClose, onEditCompany, onEditAccountHolder, onAddBillingEmails, onCancelSubscription,
}: {
  company: Company;
  rect: DOMRect;
  onClose: () => void;
  onEditCompany: () => void;
  onEditAccountHolder: () => void;
  onAddBillingEmails: () => void;
  onCancelSubscription: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Only paid, running subscriptions can be cancelled.
  const canCancel = getCompanyBilling(company).status === "Active" || getCompanyBilling(company).status === "Paused";

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

  const item = (icon: JSX.Element, label: string, onPick: () => void, danger = false) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      onClick={(e) => { e.stopPropagation(); onPick(); onClose(); }}
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
        left: pos ? pos.left : rect.right - 220,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="u-menu-head">
        <div className="u-menu-head-name">{company.name}</div>
        <div className="u-menu-head-id">{company.id} · {company.tier}</div>
      </div>
      <div className="u-menu-divider" />
      {item(<PencilMenuIcon />, "Edit company details", onEditCompany)}
      {item(<HolderIcon />, "Edit Account Holder", onEditAccountHolder)}
      {item(<MailIcon />, "Add Billing Emails", onAddBillingEmails)}
      {canCancel && (
        <>
          <div className="u-menu-divider" />
          {item(<CancelIcon />, "Cancel Subscription", onCancelSubscription, true)}
        </>
      )}
    </div>
  );
}

/* ─────────────── Company side panel ─────────────── */

type PanelTab = "details" | "seats" | "users" | "actions";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const ROLE_SLUG: Record<CompanyUser["role"], string> = {
  "Account Holder": "account-holder",
  Admin: "admin",
  Member: "member",
};

function CompanyPanel({
  company, onClose, onUpdate,
}: {
  company: Company; onClose: () => void; onUpdate: (c: Company) => void;
}) {
  const [tab, setTab] = useState<PanelTab>("details");
  const billing = getCompanyBilling(company);
  const users = getCompanyUsers(company);
  const sym = CURRENCY_SYMBOL[billing.currency];

  const isActive = billing.status === "Active";
  const isPaused = billing.status === "Paused";
  const compEligible = billing.status !== "Active" && billing.status !== "Paused";

  const detail = (label: string, value: React.ReactNode) => (
    <div className="co-dt-item">
      <div className="co-dt-label">{label}</div>
      <div className="co-dt-value">{value}</div>
    </div>
  );

  const TABS: { key: PanelTab; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "seats", label: "Seats" },
    { key: "users", label: `Users (${users.length})` },
    { key: "actions", label: "Actions" },
  ];

  return (
    <aside className="co-panel">
      <div className="co-panel-head">
        <div className="co-drawer-title-row">
          <div className="co-drawer-avatar">{initials(company.name)}</div>
          <div className="co-drawer-titles">
            <div className="co-drawer-name">{company.name}</div>
            <div className="co-drawer-id">{company.id} · {company.email}</div>
          </div>
        </div>
        <button className="co-drawer-close" aria-label="Close" onClick={onClose}>
          <SmallXIcon />
        </button>
      </div>

      <div className="co-panel-pills">
        <TierPill tier={company.tier} />
        <StatusPill status={billing.status} />
        <span className="co-pill-muted">{billing.signUp}</span>
      </div>

      <div className="co-panel-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`co-panel-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="co-panel-body">
        {tab === "details" && (
          <div className="co-detail-grid">
            {detail("Account holder", company.email)}
            {detail("Industry", company.industry || "—")}
            {detail("Partner affiliation", company.partnership || "—")}
            {detail("Sign-up channel", billing.signUp)}
            {detail("Payment collection", billing.payment)}
            {detail("Currency", billing.currency)}
            {detail("Billing cycle", company.tier === "Free Trial" || company.tier === "Complimentary Access" ? "—" : billing.billingCycle)}
            {detail("Per-seat rate", isActive ? `${sym}${billing.ratePerSeat} / mo` : "—")}
            {detail("Next invoice", billing.nextBillingDate)}
            {detail("Est. monthly", isActive ? `${sym}${billing.monthlyTotal.toLocaleString()}` : "—")}
          </div>
        )}

        {tab === "seats" && (
          <>
            <div className="co-section-title" style={{ marginBottom: 14 }}>
              Seats
              <span className="co-section-meta">{billing.seatsUsed} of {billing.seatsTotal} assigned</span>
            </div>
            <div className="co-seat-bar">
              <div
                className="co-seat-bar-fill"
                style={{ width: `${billing.seatsTotal ? (billing.seatsUsed / billing.seatsTotal) * 100 : 0}%` }}
              />
            </div>
            <div className="co-seats-change-row">
              <div className="co-seats-change co-seats-change--added">
                <span className="co-seats-change-label">Added</span>
                <span className="co-seats-change-val">+{billing.seatsAdded}</span>
              </div>
              <div className="co-seats-change co-seats-change--removed">
                <span className="co-seats-change-label">Removed</span>
                <span className="co-seats-change-val">−{billing.seatsRemoved}</span>
              </div>
            </div>
            <div className="co-region-list" style={{ marginTop: 16 }}>
              {billing.regions.map((r) => (
                <div className="co-region-row" key={r.name}>
                  <span className="co-region-name">{r.name}</span>
                  <span className="co-region-seats">{r.seats} seats</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "users" && (
          <div className="co-user-list">
            {users.map((u) => (
              <div className="co-userrow" key={u.email}>
                <div className="co-userrow-avatar">{initials(u.name)}</div>
                <div className="co-userrow-main">
                  <div className="co-userrow-name">
                    {u.name}
                    {u.status !== "Active" && <span className="co-userrow-status">{u.status}</span>}
                  </div>
                  <div className="co-userrow-email">{u.email}</div>
                </div>
                <div className="co-userrow-meta">
                  <span className={`co-role co-role--${ROLE_SLUG[u.role]}`}>{u.role}</span>
                  <span className="co-userrow-region">{u.region}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "actions" && (
          <>
            <div className="co-action-grid">
              <button className="co-action">Manage seats</button>
              <button className="co-action">Change tier</button>
              <button className="co-action">Change billing cycle</button>
              <button className="co-action">Adjust per-seat rate</button>
              <button className="co-action">Change payment method</button>
              <button className="co-action">Change account holder</button>
            </div>

            <div className="co-action-lifecycle">
              {(isActive || isPaused) && (
                <button
                  className="co-action co-action--wide"
                  onClick={() => onUpdate({ ...company, status: isPaused ? "Active" : "Paused" })}
                >
                  {isPaused ? "Resume subscription" : "Pause subscription"}
                </button>
              )}
              {compEligible && (
                <button
                  className="co-action co-action--wide co-action--good"
                  onClick={() => onUpdate({ ...company, tier: "Complimentary Access", status: "Complimentary" })}
                >
                  <CheckBoldIcon />
                  Grant complimentary access
                </button>
              )}
              {billing.status !== "Canceled" && (
                <button
                  className="co-action co-action--wide co-action--danger"
                  onClick={() => onUpdate({ ...company, status: "Canceled" })}
                >
                  Cancel subscription
                </button>
              )}
            </div>
            <p className="co-action-note">
              Cancellations take effect at the end of the current billing cycle. Finance operations
              (refunds, credit notes, voiding invoices) are handled directly in Stripe.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}

/* ─────────────── Edit Account Holder modal ─────────────── */

type Holder = { name: string; email: string; phone: string };

function currentHolder(company: Company): Holder {
  const derivedName = company.contactName || getCompanyUsers(company)[0]?.name || company.name;
  return {
    name: derivedName,
    email: company.email,
    phone: company.phone ?? "",
  };
}

function HolderCard({ holder, locked }: { holder: Holder; locked?: boolean }) {
  const contact = [holder.email, holder.phone].filter(Boolean).join("  ·  ");
  return (
    <div className="co-holder-card">
      <div className="co-drawer-avatar">{initials(holder.name)}</div>
      <div className="co-holder-card-text">
        <div className="co-holder-card-name">{holder.name}</div>
        <div className="co-holder-card-contact">{contact || "—"}</div>
      </div>
      {locked && <span className="co-holder-lock" aria-hidden="true">🔒</span>}
    </div>
  );
}

function EditAccountHolderModal({
  company, onClose, onSave,
}: {
  company: Company;
  onClose: () => void;
  onSave: (patch: { contactName: string; email: string; phone?: string }) => void;
}) {
  const original = useMemo(() => currentHolder(company), [company]);
  const [holder, setHolder] = useState<Holder>(original);
  const [mode, setMode] = useState<"view" | "search" | "create">("view");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Holder>({ name: "", email: "", phone: "" });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return userBank.slice(0, 8);
    return userBank
      .filter((u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.phone ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query]);

  function pick(u: ScholarshipUser) {
    setHolder({ name: u.name, email: u.email ?? "", phone: u.phone ?? "" });
    setMode("view");
    setQuery("");
  }

  const changed =
    holder.name !== original.name || holder.email !== original.email || holder.phone !== original.phone;
  const createValid = draft.name.trim() && draft.email.trim();

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal sch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Edit Account Holder</h3>
          <p className="cl-modal-sub">
            The account holder owns {company.name}'s billing and admin access. Change it by finding an
            existing user or creating a new account holder.
          </p>
        </div>

        <div className="sch-modal-body">
          <div className="form-group" style={{ marginBottom: mode === "view" ? 0 : 20 }}>
            <label className="form-label">Account Holder</label>
            <HolderCard holder={holder} locked={mode === "view"} />
            {mode === "view" && (
              <button className="co-holder-change-btn" onClick={() => setMode("search")}>
                Change Account Holder
              </button>
            )}
          </div>

          {mode === "search" && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Find a user</label>
              <div className="search-wrap" style={{ marginBottom: 10 }}>
                <span className="search-icon"><SearchIcon /></span>
                <input
                  autoFocus
                  className="search-input"
                  placeholder="Search by name, email, or phone…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="sch-user-dropdown co-holder-results">
                {results.length === 0 ? (
                  <div className="sch-user-empty">
                    No users match “{query.trim()}”.
                  </div>
                ) : (
                  results.map((u) => (
                    <button key={u.id} className="sch-user-option" onClick={() => pick(u)}>
                      <div className="user-cell">
                        <div className="user-cell-text">
                          <div className="user-cell-name">{u.name}</div>
                          <div className="user-cell-contact">{u.email ?? u.phone ?? "—"}</div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="co-holder-create-prompt">
                Can’t find them?
                <button className="co-holder-create-link" onClick={() => { setDraft({ name: query.trim(), email: "", phone: "" }); setMode("create"); }}>
                  Create a new account holder
                </button>
              </div>
            </div>
          )}

          {mode === "create" && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">New account holder</label>
              <input
                autoFocus
                className="form-input"
                placeholder="Full name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                style={{ marginBottom: 10 }}
              />
              <input
                className="form-input"
                type="email"
                placeholder="Email address"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                style={{ marginBottom: 10 }}
              />
              <input
                className="form-input"
                type="tel"
                placeholder="Phone number (optional)"
                value={draft.phone}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              />
              <div className="co-holder-create-actions">
                <button className="co-holder-change-btn" onClick={() => setMode("search")}>← Back to search</button>
                <button
                  className="btn-publish"
                  disabled={!createValid}
                  onClick={() => {
                    setHolder({ name: draft.name.trim(), email: draft.email.trim(), phone: draft.phone.trim() });
                    setMode("view");
                  }}
                >
                  Use this account holder
                </button>
              </div>
              <p className="form-help">A new account holder account is created and invited when you save.</p>
            </div>
          )}
        </div>

        <div className="cl-modal-foot sch-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>Cancel</button>
          <button
            className="btn-publish sch-submit"
            disabled={!changed}
            onClick={() => onSave({ contactName: holder.name, email: holder.email, phone: holder.phone || undefined })}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Add Billing Emails modal ─────────────── */

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6M10 14L21 3" />
  </svg>
);

function AddBillingEmailsModal({ company, onClose }: { company: Company; onClose: () => void }) {
  // Deep-links to the customer's page in the Stripe dashboard, searched by the
  // account holder's billing email.
  const stripeUrl = `https://dashboard.stripe.com/search?query=${encodeURIComponent(company.email)}`;

  const steps = [
    "Open the customer in Stripe using the button below.",
    "On the customer page, click the “⋯” (overflow) menu and choose Edit.",
    "Under Invoice settings, find Additional emails.",
    "Add each billing email address, separated by commas, then Save.",
  ];

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Add Billing Emails</h3>
          <p className="cl-modal-sub">
            Billing emails are managed in Stripe. Add the addresses that should receive invoices and
            receipts for <strong>{company.name}</strong>.
          </p>
        </div>

        <div style={{ padding: "4px 24px 8px" }}>
          <ol className="co-billing-steps">
            {steps.map((s, i) => (
              <li key={i} className="co-billing-step">
                <span className="co-billing-step-num">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="cl-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>Close</button>
          <a
            className="btn-publish co-billing-cta"
            href={stripeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open customer in Stripe
            <ExternalLinkIcon />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Cancel Subscription modal ─────────────── */

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

function CancelSubscriptionModal({
  company, onClose, onConfirm,
}: {
  company: Company;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const billing = getCompanyBilling(company);
  const sym = CURRENCY_SYMBOL[billing.currency];
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");

  // Net seats added this cycle still bill (prorated) on the upcoming invoice.
  const pendingSeats = billing.seatsAdded;
  const pendingCharge = pendingSeats * billing.ratePerSeat;

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        {step === "form" ? (
          <>
            <div className="cl-modal-head">
              <h3 className="cl-modal-title">Cancel Subscription</h3>
              <p className="cl-modal-sub">
                <strong>{company.name}</strong> keeps full access until the end of the current
                billing cycle ({billing.nextBillingDate}), then the subscription cancels.
              </p>
              <div className="required-fields-note">* Required Fields</div>
            </div>

            <div style={{ padding: "4px 24px 8px" }}>
              <div className="form-group">
                <label className="form-label">Cancellation reason <span className="req">*</span></label>
                <select
                  className="form-input co-select"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="" disabled>Select a reason…</option>
                  {CANCELLATION_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="form-help">Reasons are managed under Product Config → B2B Management.</p>
              </div>

              {pendingSeats > 0 && (
                <div className="co-cancel-alert">
                  <span className="co-cancel-alert-icon"><WarningIcon /></span>
                  <div>
                    <strong>Pending seat charges.</strong> {pendingSeats} seat{pendingSeats === 1 ? "" : "s"} added
                    this cycle will be billed (~{sym}{pendingCharge.toLocaleString()}) on the upcoming
                    invoice before cancellation takes effect.
                  </div>
                </div>
              )}
            </div>

            <div className="cl-modal-foot">
              <button className="btn-save-draft" onClick={onClose}>Keep subscription</button>
              <button
                className="btn-publish co-cancel-danger"
                disabled={!reason}
                onClick={() => setStep("confirm")}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="cl-modal-head">
              <h3 className="cl-modal-title">Cancel {company.name}'s subscription?</h3>
              <p className="cl-modal-sub">
                This schedules cancellation for the end of the current billing cycle
                ({billing.nextBillingDate}). The status changes to Canceled and the company is not
                billed again after that date.
              </p>
            </div>

            <div style={{ padding: "4px 24px 8px" }}>
              <div className="co-cancel-summary">
                <div className="co-cancel-summary-row">
                  <span className="co-cancel-summary-label">Reason</span>
                  <span>{reason}</span>
                </div>
                <div className="co-cancel-summary-row">
                  <span className="co-cancel-summary-label">Effective</span>
                  <span>End of cycle · {billing.nextBillingDate}</span>
                </div>
                {pendingSeats > 0 && (
                  <div className="co-cancel-summary-row">
                    <span className="co-cancel-summary-label">Final invoice</span>
                    <span>Includes ~{sym}{pendingCharge.toLocaleString()} in pending seat charges</span>
                  </div>
                )}
              </div>
            </div>

            <div className="cl-modal-foot">
              <button className="btn-save-draft" onClick={() => setStep("form")}>Go back</button>
              <button className="btn-publish co-cancel-danger" onClick={() => onConfirm(reason)}>
                Cancel subscription
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
