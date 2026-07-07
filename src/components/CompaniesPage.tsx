import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getCompanyBilling,
  getCompanyUsers,
  getStatusPill,
  getCanceledOn,
  getTrialEndDate,
  getStripeCustomerId,
  CURRENCY_SYMBOL,
  CANCELLATION_REASONS,
  TAX_STATUSES,
  type Company,
  type CompanyBilling,
  type CompanyUser,
  type Tier,
  type SignUpChannel,
  type TaxStatus,
} from "../data/companies";
import { SortIcon, AddIcon, ChevronDownIcon } from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import {
  CompanyFilters,
  CompanyEditColumnsButton,
  type CompanyFilterState,
  type CompanyColumnState,
} from "./CompanyFilters";
import { CompaniesSearch } from "./CompaniesSearch";
import {
  MultiSelect,
  INDUSTRY_OPTIONS,
  PARTNERSHIP_OPTIONS,
  CSM_OPTIONS,
  COUNTRY_OPTIONS,
  US_STATES,
} from "./NewCompanyWizard";

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

const CardIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
  </svg>
);

type SortKey = "name" | "email" | "tier" | "status" | "signUp" | "billingCycle" | "seats" | "industry" | "partnership" | "seatsAdded" | "seatsRemoved" | "createdOn" | "canceledOn" | "trialEndDate";
type SortDir = "asc" | "desc";

const TIER_ORDER: Record<Tier, number> = {
  "Free Trial": 0,
  Essentials: 1,
  Growth: 2,
  Pro: 3,
  "Free Access": 4,
};

function compare(a: Company, b: Company, key: SortKey): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "email": return a.email.localeCompare(b.email);
    case "tier": return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    case "status": return getCompanyBilling(a).status.localeCompare(getCompanyBilling(b).status);
    case "signUp": return getCompanyBilling(a).signUp.localeCompare(getCompanyBilling(b).signUp);
    case "billingCycle": return getCompanyBilling(a).billingCycle.localeCompare(getCompanyBilling(b).billingCycle);
    case "seats": return a.seats - b.seats;
    case "industry": return a.industry.localeCompare(b.industry);
    case "partnership": return a.partnership.localeCompare(b.partnership);
    case "seatsAdded": return getCompanyBilling(a).seatsAdded - getCompanyBilling(b).seatsAdded;
    case "seatsRemoved": return getCompanyBilling(a).seatsRemoved - getCompanyBilling(b).seatsRemoved;
    case "createdOn": return (Date.parse(getCompanyBilling(a).createdOn) || 0) - (Date.parse(getCompanyBilling(b).createdOn) || 0);
    case "canceledOn": return (Date.parse(getCanceledOn(getCompanyBilling(a))) || 0) - (Date.parse(getCanceledOn(getCompanyBilling(b))) || 0);
    case "trialEndDate": return (Date.parse(getTrialEndDate(getCompanyBilling(a))) || 0) - (Date.parse(getTrialEndDate(getCompanyBilling(b))) || 0);
  }
}

type Props = {
  companies: Company[];
  initialQuery?: string;
  onNewCompany: () => void;
  onManageSubscription: (company: Company) => void;
  onUpdateCompany: (company: Company) => void;
  onViewEmployees: (company: Company) => void;
};

export function CompaniesPage({ companies, initialQuery = "", onNewCompany, onManageSubscription, onUpdateCompany, onViewEmployees }: Props) {
  useCreateShortcut(onNewCompany);
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<CompanyFilterState>({
    tiers: [],
    industries: [],
    partnerships: [],
    statuses: ["Active"],
    signUps: [],
    billingCycles: [],
    paymentMethods: [],
  });
  const [columns, setColumns] = useState<CompanyColumnState>({
    signUp: true,
    billingCycle: true,
    seats: true,
    seatsAdded: false,
    seatsRemoved: false,
    industry: true,
    partnership: true,
    createdOn: false,
    canceledOn: false,
    trialEndDate: false,
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ company: Company; rect: DOMRect } | null>(null);
  const [editModal, setEditModal] = useState<Company | null>(null);
  const [holderModal, setHolderModal] = useState<Company | null>(null);
  const [billingModal, setBillingModal] = useState<Company | null>(null);
  const [invoicesModal, setInvoicesModal] = useState<Company | null>(null);
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
      if (filters.signUps.length && !filters.signUps.includes(getCompanyBilling(c).signUp)) return false;
      if (filters.billingCycles.length) {
        // Match on the displayed cycle; non-billed tiers (Free Trial / Free Access
        // Access) read "—" in the column, so they never match Monthly/Annual.
        const cycle =
          c.tier === "Free Trial" || c.tier === "Free Access"
            ? null
            : getCompanyBilling(c).billingCycle;
        if (!cycle || !filters.billingCycles.includes(cycle)) return false;
      }
      if (filters.paymentMethods.length) {
        // Free Trial / Free Access companies never collect payment, so they never
        // match an Automatic/Manual filter.
        const payment =
          c.tier === "Free Trial" || c.tier === "Free Access"
            ? null
            : getCompanyBilling(c).payment;
        if (!payment || !filters.paymentMethods.includes(payment)) return false;
      }
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

  // Natural table width so columns scroll horizontally instead of crushing on a
  // narrow page. Mirrors the visible columns in <ColGroup>.
  const tableMin =
    220 /* name */ +
    40 /* actions */ +
    195 + 130 /* email + tier */ +
    190 /* status */ +
    (columns.signUp ? 130 : 0) +
    (columns.billingCycle ? 140 : 0) +
    (columns.seats ? 64 : 0) +
    (columns.seatsAdded ? 72 : 0) +
    (columns.seatsRemoved ? 82 : 0) +
    (columns.industry ? 145 : 0) +
    (columns.partnership ? 155 : 0) +
    (columns.createdOn ? 130 : 0) +
    (columns.canceledOn ? 130 : 0) +
    (columns.trialEndDate ? 140 : 0);

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Companies</h1>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={onNewCompany}>
                <AddIcon />
                Create Company
                <span className="cta-kbd">C</span>
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                <CompaniesSearch
                  companies={companies}
                  tiers={filters.tiers}
                  onTiersChange={(v) => setFilters((prev) => ({ ...prev, tiers: v }))}
                  statuses={filters.statuses}
                  onStatusesChange={(v) => setFilters((prev) => ({ ...prev, statuses: v }))}
                  industries={filters.industries}
                  onIndustriesChange={(v) => setFilters((prev) => ({ ...prev, industries: v }))}
                  query={query}
                  onCommit={setQuery}
                />
              </div>

              <CompanyFilters filters={filters} setFilters={setFilters} />

              <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
              <table className="table table-head">
                <ColGroup columns={columns} />
                <thead>
                  <tr>
                    <SortableHeader col="name" label="Company" className="col-name" sort={sort} toggle={toggleSort} />
                    <SortableHeader col="email" label="Email" className="col-email" sort={sort} toggle={toggleSort} sortable={false} />
                    <SortableHeader col="tier" label="Tier" className="col-tier" sort={sort} toggle={toggleSort} />
                    <SortableHeader col="status" label="Status" className="col-status" sort={sort} toggle={toggleSort} />
                    {columns.signUp && <SortableHeader col="signUp" label="Sign-Up" className="col-signup" sort={sort} toggle={toggleSort} />}
                    {columns.billingCycle && <SortableHeader col="billingCycle" label="Billing Cycle" className="col-cycle" sort={sort} toggle={toggleSort} />}
                    {columns.seats && <SortableHeader col="seats" label="Seats" className="col-seats" sort={sort} toggle={toggleSort} />}
                    {columns.seatsAdded && <SortableHeader col="seatsAdded" label="Added" className="col-seats-added" sort={sort} toggle={toggleSort} />}
                    {columns.seatsRemoved && <SortableHeader col="seatsRemoved" label="Removed" className="col-seats-removed" sort={sort} toggle={toggleSort} />}
                    {columns.industry && <SortableHeader col="industry" label="Industry" className="col-industry" sort={sort} toggle={toggleSort} />}
                    {columns.partnership && <SortableHeader col="partnership" label="Partnership" className="col-partnership" sort={sort} toggle={toggleSort} />}
                    {columns.createdOn && <SortableHeader col="createdOn" label="Created On" className="col-created" sort={sort} toggle={toggleSort} />}
                    {columns.canceledOn && <SortableHeader col="canceledOn" label="Canceled On" className="col-canceled" sort={sort} toggle={toggleSort} />}
                    {columns.trialEndDate && <SortableHeader col="trialEndDate" label="Trial End Date" className="col-trial-end" sort={sort} toggle={toggleSort} />}
                    <th className="col-actions">
                      <CompanyEditColumnsButton columns={columns} setColumns={setColumns} />
                    </th>
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup columns={columns} />
                  <tbody>
                    {paged.map((c) => (
                      <CompanyRow
                        key={c.id}
                        company={c}
                        columns={columns}
                        onEdit={() => setEditModal(c)}
                        onManageSubscription={() => onManageSubscription(c)}
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
                  <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                  <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
                </div>
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
          onEditCompany={() => setEditModal(menu.company)}
          onManageSubscription={() => onManageSubscription(menu.company)}
          onEditAccountHolder={() => setHolderModal(menu.company)}
          onAddBillingEmails={() => setBillingModal(menu.company)}
          onCancelSubscription={() => setCancelModal(menu.company)}
          onViewEmployees={() => onViewEmployees(menu.company)}
          onViewInvoices={() => setInvoicesModal(menu.company)}
        />
      )}

      {editModal && (
        <EditCompanyModal
          company={editModal}
          onClose={() => setEditModal(null)}
          onSave={(patch) => {
            onUpdateCompany({ ...editModal, ...patch });
            setEditModal(null);
          }}
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

      {invoicesModal && (
        <ViewInvoicesModal
          company={invoicesModal}
          onClose={() => setInvoicesModal(null)}
        />
      )}

      {cancelModal && (
        <CancelSubscriptionModal
          company={cancelModal}
          onClose={() => setCancelModal(null)}
          onConfirm={(reason) => {
            onUpdateCompany({
              ...cancelModal,
              status: "Canceled",
              cancelsOn: getCompanyBilling(cancelModal).nextBillingDate,
            });
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

function ColGroup({ columns }: { columns: CompanyColumnState }) {
  return (
    <colgroup>
      <col style={{ width: 220 }} />
      <col style={{ width: 195 }} />
      <col style={{ width: 130 }} />
      <col style={{ width: 190 }} />
      {columns.signUp && <col style={{ width: 130 }} />}
      {columns.billingCycle && <col style={{ width: 140 }} />}
      {columns.seats && <col style={{ width: 64 }} />}
      {columns.seatsAdded && <col style={{ width: 72 }} />}
      {columns.seatsRemoved && <col style={{ width: 82 }} />}
      {columns.industry && <col style={{ width: 145 }} />}
      {columns.partnership && <col style={{ width: 155 }} />}
      {columns.createdOn && <col style={{ width: 130 }} />}
      {columns.canceledOn && <col style={{ width: 130 }} />}
      {columns.trialEndDate && <col style={{ width: 140 }} />}
      <col style={{ width: 40 }} />
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

function StatusPill({ billing }: { billing: CompanyBilling }) {
  const { tone, label } = getStatusPill(billing);
  return <span className={`co-status-pill co-status-pill--${tone}`}>{label}</span>;
}

// Billing cycle only applies to paid subscriptions; Free Trial and
// Free Access tiers aren't billed, so they read "—".
function billingCycleLabel(company: Company, billing: CompanyBilling): string {
  if (company.tier === "Free Trial" || company.tier === "Free Access") return "—";
  return billing.billingCycle;
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
  company, columns, onEdit, onManageSubscription, onOpenMenu,
}: {
  company: Company; columns: CompanyColumnState; onEdit: () => void; onManageSubscription: () => void; onOpenMenu: (rect: DOMRect) => void;
}) {
  const billing = getCompanyBilling(company);
  return (
    <tr>
      <td className="col-name">{company.name}</td>
      <td className="col-email">{company.email}</td>
      <td className="col-tier"><TierPill tier={company.tier} /></td>
      <td className="col-status"><StatusPill billing={billing} /></td>
      {columns.signUp && <td className="col-signup"><SignUpPill signUp={billing.signUp} /></td>}
      {columns.billingCycle && <td className="col-cycle">{billingCycleLabel(company, billing)}</td>}
      {columns.seats && <td className="col-seats">{company.seats.toLocaleString()}</td>}
      {columns.seatsAdded && <td className="col-seats-added co-seats-added">+{billing.seatsAdded}</td>}
      {columns.seatsRemoved && <td className="col-seats-removed co-seats-removed">−{billing.seatsRemoved}</td>}
      {columns.industry && <td className="col-industry">{company.industry || "—"}</td>}
      {columns.partnership && <td className="col-partnership">{company.partnership || "—"}</td>}
      {columns.createdOn && <td className="col-created">{billing.createdOn}</td>}
      {columns.canceledOn && <td className="col-canceled">{getCanceledOn(billing)}</td>}
      {columns.trialEndDate && <td className="col-trial-end">{getTrialEndDate(billing)}</td>}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
        >
          <MoreIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit" title="Edit company" onClick={onEdit}>
            <PencilIcon />
          </button>
          <button className="row-action-btn" aria-label="Manage subscription" title="Manage subscription" onClick={onManageSubscription}>
            <CardIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
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

const PeopleIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const InvoiceIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h12a1 1 0 0 1 1 1v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V3a1 1 0 0 1 1-1z" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
);

const DashboardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="5" rx="1.5" />
    <rect x="13" y="10" width="8" height="11" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
  </svg>
);

const PencilMenuIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);

const CardMenuIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <path d="M2 10h20" />
  </svg>
);

const CancelIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </svg>
);

function CompanyActionsMenu({
  company, rect, onClose, onEditCompany, onManageSubscription, onEditAccountHolder, onAddBillingEmails, onCancelSubscription, onViewEmployees, onViewInvoices,
}: {
  company: Company;
  rect: DOMRect;
  onClose: () => void;
  onEditCompany: () => void;
  onManageSubscription: () => void;
  onEditAccountHolder: () => void;
  onAddBillingEmails: () => void;
  onCancelSubscription: () => void;
  onViewEmployees: () => void;
  onViewInvoices: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Only paid, running subscriptions can be cancelled.
  const canCancel = getCompanyBilling(company).status === "Active";

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
      {item(<CardMenuIcon />, "Manage Subscription", onManageSubscription)}
      {item(<HolderIcon />, "Account Holder", onEditAccountHolder)}
      {item(<MailIcon />, "Add Billing Emails", onAddBillingEmails)}
      {item(<PeopleIcon />, "View Employees", onViewEmployees)}
      {item(<InvoiceIcon />, "View Invoices", onViewInvoices)}
      {item(<DashboardIcon />, "View Dashboard", () => viewDashboard(company))}
      {canCancel && (
        <>
          <div className="u-menu-divider" />
          {item(<CancelIcon />, "Cancel Subscription", onCancelSubscription, true)}
        </>
      )}
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!),
  );
}

// Opens the company's dashboard in a simulated impersonation session — same
// "Login As" mechanism used for B2C users, but logged in as the company's
// Account Holder and framed as the B2B dashboard rather than the learner app.
function viewDashboard(company: Company) {
  const holder = currentHolder(company);
  const win = window.open("", "_blank", "noopener");
  if (!win) return;
  win.document.title = `Dashboard — ${company.name}`;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
<title>${escapeXml(company.name)} Dashboard</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0b0b0c;color:#e7e7e8;font-family:"Fira Sans",-apple-system,system-ui,sans-serif}
.bar{background:#7a3a18;color:#ffd9c2;padding:10px 20px;font-size:14px;font-weight:600;display:flex;gap:10px;align-items:center}
.wrap{max-width:640px;margin:0 auto;padding:60px 24px;text-align:center}
.av{width:80px;height:80px;border-radius:50%;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;background:radial-gradient(70% 70% at 50% 40%,#e97237,#8a3114)}
h1{font-size:24px;margin:0 0 6px}p{color:#9a9aa0}
.tag{display:inline-block;margin-top:20px;padding:6px 14px;border-radius:999px;background:#1c1c1f;border:1px solid #2e2e31;font-size:12px;color:#a8a8a8}</style></head>
<body><div class="bar">⚠ Admin impersonation session — you are viewing the B2B dashboard as this Account Holder. Your own session is unaffected.</div>
<div class="wrap"><div class="av">${escapeXml(initials(holder.name))}</div>
<h1>${escapeXml(holder.name)}</h1><p>${escapeXml(holder.email)} · Account Holder for ${escapeXml(company.name)}</p>
<p style="margin-top:24px">The company dashboard will be displayed here.</p>
<span class="tag">${escapeXml(company.name)} — B2B Dashboard placeholder</span></div></body></html>`);
  win.document.close();
}

const ROLE_SLUG: Record<CompanyUser["role"], string> = {
  "Account Holder": "account-holder",
  Admin: "admin",
  Member: "member",
};

/* ─────────────── Edit Company modal ─────────────── */

// Mid-size modal that edits only the company's identity & segmentation fields
// (name, address, tax status, industry, partnership). Plan/billing changes live
// in "Manage Subscription"; the account holder has its own modal.
function EditCompanyModal({
  company, onClose, onSave,
}: {
  company: Company;
  onClose: () => void;
  onSave: (patch: Partial<Company>) => void;
}) {
  const [name, setName] = useState(company.name);
  const [taxStatus, setTaxStatus] = useState<TaxStatus>(company.taxStatus ?? "Taxable");
  const [assignedCsm, setAssignedCsm] = useState(company.assignedCsm ?? "");
  const [country, setCountry] = useState(company.addressParts?.country ?? "United States");
  const [addrLine1, setAddrLine1] = useState(company.addressParts?.line1 ?? "");
  const [addrLine2, setAddrLine2] = useState(company.addressParts?.line2 ?? "");
  const [addrCity, setAddrCity] = useState(company.addressParts?.city ?? "");
  const [addrPin, setAddrPin] = useState(company.addressParts?.pin ?? "");
  const [addrState, setAddrState] = useState(company.addressParts?.state ?? "");
  const [industries, setIndustries] = useState<string[]>(
    company.industry ? company.industry.split(",").map((s) => s.trim()).filter(Boolean) : [],
  );
  const [partnerships, setPartnerships] = useState<string[]>(
    company.partnership ? company.partnership.split(",").map((s) => s.trim()).filter(Boolean) : [],
  );

  const valid = name.trim().length > 0;

  function save() {
    if (!valid) return;
    const address =
      [addrLine1, addrLine2, addrCity, addrState, addrPin, country].map((s) => s.trim()).filter(Boolean).join(", ") || undefined;
    const addressParts =
      [country, addrLine1, addrLine2, addrCity, addrPin, addrState].some((s) => s.trim())
        ? {
            country: country.trim() || undefined,
            line1: addrLine1.trim() || undefined,
            line2: addrLine2.trim() || undefined,
            city: addrCity.trim() || undefined,
            pin: addrPin.trim() || undefined,
            state: addrState.trim() || undefined,
          }
        : undefined;
    onSave({
      name: name.trim(),
      taxStatus,
      assignedCsm: assignedCsm || undefined,
      industry: industries.join(", "),
      partnership: partnerships.join(", "),
      address,
      addressParts,
    });
  }

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal sch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Edit Company</h3>
          <p className="cl-modal-sub">
            Update {company.name}'s details. Plan, billing, and seats are managed under Manage Subscription.
          </p>
        </div>

        <div className="sch-modal-body co-edit-body">
          <div className="form-group">
            <label className="form-label">Company Name <span className="req">*</span></label>
            <input
              autoFocus
              className="form-input"
              placeholder="e.g. Apex HVAC Solutions"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <div className="address-field">
              <div className="address-row">
                <select className="address-select" value={country} onChange={(e) => setCountry(e.target.value)}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span className="address-chevron"><ChevronDownIcon /></span>
              </div>
              <input className="address-input" placeholder="Address Line 1 (Optional)" value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} />
              <input className="address-input" placeholder="Address Line 2 (Optional)" value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} />
              <div className="address-split">
                <input className="address-input address-cell" placeholder="City (Optional)" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
                <input className="address-input address-cell" placeholder="PIN" value={addrPin} onChange={(e) => setAddrPin(e.target.value)} />
              </div>
              <div className="address-row">
                <select className={`address-select ${addrState ? "" : "is-placeholder"}`} value={addrState} onChange={(e) => setAddrState(e.target.value)}>
                  <option value="">State</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="address-chevron"><ChevronDownIcon /></span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tax Status</label>
            <select className="form-select" value={taxStatus} onChange={(e) => setTaxStatus(e.target.value as TaxStatus)}>
              {TAX_STATUSES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Assigned CSM</label>
            <select
              className={`form-select ${assignedCsm ? "" : "is-placeholder"}`}
              value={assignedCsm}
              onChange={(e) => setAssignedCsm(e.target.value)}
            >
              <option value="">Unassigned</option>
              {CSM_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Industry</label>
            <MultiSelect options={INDUSTRY_OPTIONS} value={industries} onChange={setIndustries} placeholder="Select industries…" />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Partnership <span className="co-w-note">(optional)</span></label>
            <MultiSelect options={PARTNERSHIP_OPTIONS} value={partnerships} onChange={setPartnerships} placeholder="Select partnerships…" />
          </div>
        </div>

        <div className="cl-modal-foot sch-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>Cancel</button>
          <button className="btn-publish sch-submit" disabled={!valid} onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
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

const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

type HolderMode = "change" | "replace";

function EditAccountHolderModal({
  company, onClose, onSave,
}: {
  company: Company;
  onClose: () => void;
  onSave: (patch: { contactName: string; email: string; phone?: string }) => void;
}) {
  const original = useMemo(() => currentHolder(company), [company]);
  // The company's employees — the pool the new account holder is chosen from.
  // A holder must already belong to the cohort (see the note below).
  const employees = useMemo(() => getCompanyUsers(company), [company]);
  // Candidates exclude whoever currently holds the account.
  const candidates = useMemo(
    () => employees.filter((u) => u.email !== original.email),
    [employees, original.email],
  );

  const [mode, setMode] = useState<HolderMode>("change");
  const [selectedEmail, setSelectedEmail] = useState<string>("");
  const [open, setOpen] = useState(false);
  const ddRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ddRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = candidates.find((u) => u.email === selectedEmail) ?? null;

  function save() {
    if (!selected) return;
    onSave({ contactName: selected.name, email: selected.email });
  }

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal sch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">Account Holder</h3>
          <p className="cl-modal-sub">
            The account holder owns {company.name}'s billing and admin access. Reassign it to another
            employee in the cohort.
          </p>
        </div>

        <div className="sch-modal-body co-edit-body">
          <div className="form-group">
            <label className="form-label">Current Account Holder</label>
            <HolderCard holder={original} />
          </div>

          <div className="form-group">
            <label className="form-label">What would you like to do?</label>
            <div className="co-holder-modes">
              <button
                type="button"
                className={`co-holder-mode${mode === "change" ? " is-active" : ""}`}
                onClick={() => setMode("change")}
              >
                <span className="co-holder-mode-dot" />
                <span className="co-holder-mode-text">
                  <span className="co-holder-mode-title">Change the Account Holder</span>
                  <span className="co-holder-mode-desc">
                    Hand ownership to another employee. {original.name} stays in the cohort as an Admin.
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={`co-holder-mode${mode === "replace" ? " is-active" : ""}`}
                onClick={() => setMode("replace")}
              >
                <span className="co-holder-mode-dot" />
                <span className="co-holder-mode-text">
                  <span className="co-holder-mode-title">Remove from cohort &amp; replace</span>
                  <span className="co-holder-mode-desc">
                    Remove {original.name} from the cohort entirely and assign a new account holder.
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">New Account Holder</label>
            <div className="co-holder-picker" ref={ddRef}>
              <button
                type="button"
                className={`co-holder-select${open ? " is-open" : ""}`}
                onClick={() => setOpen((o) => !o)}
              >
                {selected ? (
                  <span className="co-holder-select-val">
                    <span className="co-holder-select-name">{selected.name}</span>
                    <span className="co-holder-select-email">{selected.email}</span>
                  </span>
                ) : (
                  <span className="co-holder-select-placeholder">Choose an employee…</span>
                )}
                <span className="co-holder-select-caret"><ChevronDownIcon /></span>
              </button>
              {open && (
                <div className="co-holder-dropdown">
                  {candidates.length === 0 ? (
                    <div className="sch-user-empty">No other employees in this cohort yet.</div>
                  ) : (
                    candidates.map((u) => (
                      <button
                        key={u.email}
                        type="button"
                        className={`co-holder-opt${u.email === selectedEmail ? " is-selected" : ""}`}
                        onClick={() => { setSelectedEmail(u.email); setOpen(false); }}
                      >
                        <span className="co-userrow-avatar">{initials(u.name)}</span>
                        <span className="co-holder-opt-text">
                          <span className="co-holder-opt-name">{u.name}</span>
                          <span className="co-holder-opt-email">{u.email}</span>
                        </span>
                        <span className={`co-role co-role--${ROLE_SLUG[u.role]}`}>{u.role}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="co-holder-note">
            <span className="co-holder-note-icon"><InfoIcon /></span>
            <span>
              If the new Account Holder isn't in the cohort yet, they need to be added in before they
              can be set as the Account Holder.
            </span>
          </div>
        </div>

        <div className="cl-modal-foot sch-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>Cancel</button>
          <button
            className={`btn-publish sch-submit${mode === "replace" ? " co-cancel-danger" : ""}`}
            disabled={!selected}
            onClick={save}
          >
            {mode === "replace" ? "Remove & replace" : "Save changes"}
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

/* ─────────────── View Invoices modal ─────────────── */

function ViewInvoicesModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const customerId = getStripeCustomerId(company);
  // Placeholder for the real Stripe dashboard invoices view — carries the
  // Stripe customer id as a URL parameter, same shape a real redirect would use.
  const stripeUrl = `${window.location.origin}${window.location.pathname}?stripeInvoices=${encodeURIComponent(customerId)}`;

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <h3 className="cl-modal-title">View Invoices</h3>
          <p className="cl-modal-sub">
            Invoices for <strong>{company.name}</strong> are managed in Stripe. This needs to be
            opened on Stripe to view or download them.
          </p>
        </div>

        <div style={{ padding: "4px 24px 8px" }}>
          <div className="co-billing-step" style={{ alignItems: "center" }}>
            <span className="co-billing-step-num">i</span>
            <span>Opening this will redirect to Stripe with the customer's Stripe ID.</span>
          </div>
        </div>

        <div className="cl-modal-foot">
          <button className="btn-save-draft" onClick={onClose}>Close</button>
          <a
            className="btn-publish co-billing-cta"
            href={stripeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open invoices in Stripe
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
