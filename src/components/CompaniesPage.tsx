import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getCompanyBilling,
  getCompanyUsers,
  getStatusPill,
  getCanceledOn,
  getTrialEndDate,
  getDashboardLastAccess,
  getDashboardLastAccessDays,
  getCompanyPrice,
  getCompanyPriceValue,
  getStripeCustomerId,
  CURRENCY_SYMBOL,
  CANCELLATION_REASONS,
  type Company,
  type CompanyBilling,
  type Tier,
  type SignUpChannel,
} from "../data/companies";
import {
  SortIcon, AddIcon, RowEditIcon, RowCardIcon, RowKebabIcon, ChevronLeftIcon, ChevronRightIcon,
  MenuUserVipIcon, MenuMailIcon, MenuUsersIcon, MenuInvoiceIcon, MenuEnterIcon, MenuCancelSubIcon,
  MenuProgressIcon,
} from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import {
  CompanyFilters,
  CompanyEditColumnsButton,
  type CompanyFilterState,
  type CompanyColumnState,
} from "./CompanyFilters";
import { CompaniesSearch } from "./CompaniesSearch";
import { defaultDateRange, dateRangeIncludes, type DateRangeState } from "./DateRangeFilter";
import { useLandingMorph } from "../hooks/useLandingMorph";
import { LandingFilterRow, LandingOverlay, BackToSearch, topValues, type LandingCol, type LandingPill, type LandingRow } from "./LandingMorph";

/* Landing-morph columns — mirror the table's default visible columns (key,
   label, width) so the p=1 hand-off to the real table lines up. */
const LM_COLS: LandingCol[] = [
  { key: "email", label: "Email", width: 195 },
  { key: "tier", label: "Tier", width: 130, fixed: true },
  { key: "status", label: "Status", width: 190 },
  { key: "signUp", label: "Sign-Up", width: 130 },
  { key: "cycle", label: "Billing Cycle", width: 140 },
  { key: "seats", label: "Seats", width: 64 },
  { key: "industry", label: "Industry", width: 145 },
  { key: "partnership", label: "Partnership", width: 155 },
];
import { PrmModal } from "./PrmModal";
import { RadioCard } from "./NewCompanyWizard";
import { SelectField } from "./SelectField";
import { UserDetailsHover } from "./UserDetailsHover";

const PAGE_SIZE = 50;

type SortKey = "name" | "email" | "tier" | "status" | "signUp" | "billingCycle" | "seats" | "industry" | "partnership" | "seatsAdded" | "seatsRemoved" | "createdOn" | "canceledOn" | "trialEndDate" | "dashboardLastAccess" | "price";
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
    case "dashboardLastAccess": return (getDashboardLastAccessDays(a) ?? Infinity) - (getDashboardLastAccessDays(b) ?? Infinity);
    case "price": return (getCompanyPriceValue(a) ?? -1) - (getCompanyPriceValue(b) ?? -1);
  }
}

type Props = {
  companies: Company[];
  initialQuery?: string;
  onNewCompany: () => void;
  // Opens the full-page Edit Company view (the create wizard's details step).
  onEditCompany: (company: Company) => void;
  onManageSubscription: (company: Company) => void;
  onUpdateCompany: (company: Company) => void;
  onViewEmployees: (company: Company) => void;
  /** Opens Manage Completions with this company's cohort pre-selected. */
  onManageProgress: (company: Company) => void;
};

export function CompaniesPage({ companies, initialQuery = "", onNewCompany, onEditCompany, onManageSubscription, onUpdateCompany, onViewEmployees, onManageProgress }: Props) {
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
  // Companies are filtered on Created On; the range always has a value
  // (default Last 30 Days), so this is a standing filter, not an optional one.
  const [dateRange, setDateRange] = useState<DateRangeState>(() => defaultDateRange());
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
    dashboardLastAccess: false,
    price: false,
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ company: Company; rect: DOMRect } | null>(null);
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
      if (!dateRangeIncludes(dateRange, getCompanyBilling(c).createdOn)) return false;
      return true;
    });
  }, [companies, query, filters, dateRange]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => setPage(1), [query, sort, filters, dateRange]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // Landing morph — the page opens as the search-first landing and the wheel
  // (or any search / pill / row interaction) morphs it into the table view.
  const morph = useLandingMorph(Boolean(initialQuery));

  const suggested = useMemo(() => {
    const pills: LandingPill[] = [];
    topValues(companies, (c) => c.tier, 2).forEach((tier) =>
      pills.push({
        key: `tier-${tier}`,
        label: tier,
        onPick: () => {
          setFilters((prev) => ({ ...prev, tiers: Array.from(new Set([...prev.tiers, tier as Tier])) }));
          morph.showTable();
        },
      }),
    );
    topValues(companies, (c) => c.industry, 2).forEach((ind) =>
      pills.push({
        key: `ind-${ind}`,
        label: ind,
        onPick: () => {
          setFilters((prev) => ({ ...prev, industries: Array.from(new Set([...prev.industries, ind])) }));
          morph.showTable();
        },
      }),
    );
    return pills;
  }, [companies, morph.showTable]);

  const landingRows: LandingRow[] = sorted.slice(0, 24).map((c) => {
    const billing = getCompanyBilling(c);
    const status = getStatusPill(billing);
    return {
      key: c.id,
      name: c.name,
      dim: billing.status === "Canceled",
      cells: {
        email: c.email,
        tier: c.tier,
        status: <span className={`co-status-pill co-status-pill--${status.tone}`}>{status.label}</span>,
        signUp: billing.signUp === "Self Sign-Up" ? "Self" : "Internal",
        cycle: billingCycleLabel(c, billing),
        seats: c.seats.toLocaleString(),
        industry: c.industry || "—",
        partnership: c.partnership || "—",
      },
    };
  });

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
    (columns.trialEndDate ? 140 : 0) +
    (columns.dashboardLastAccess ? 170 : 0) +
    (columns.price ? 110 : 0);

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks lm" ref={morph.rootRef}>
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
                  onCommit={(q) => {
                    setQuery(q);
                    morph.showTable();
                  }}
                />
              </div>

              <LandingFilterRow pills={suggested}>
                  <CompanyFilters
                    filters={filters}
                    setFilters={setFilters}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                  />
                </LandingFilterRow>

              <div className="lm-stage">
              <LandingOverlay
                caption="Companies A–Z"
                total={sorted.length}
                columns={LM_COLS}
                nameLabel="Company"
                nameWidth={220}
                rows={landingRows}
                onShowAll={morph.showTable}
                onRowClick={() => morph.showTable()}
              />
              <div className="lm-table">
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
                    {columns.dashboardLastAccess && (
                      <SortableHeader
                        col="dashboardLastAccess"
                        label="Dashboard Last Access"
                        className="col-dashboard-access"
                        sort={sort}
                        toggle={toggleSort}
                        tip="Last time a Manager/Admin viewed the Dashboard"
                      />
                    )}
                    {columns.price && <SortableHeader col="price" label="Price" className="col-price" sort={sort} toggle={toggleSort} />}
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
                        onEdit={() => onEditCompany(c)}
                        onManageSubscription={() => onManageSubscription(c)}
                        onOpenMenu={(rect) => setMenu({ company: c, rect })}
                        menuOpen={menu?.company.id === c.id}
                      />
                    ))}
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
        <CompanyActionsMenu
          company={menu.company}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEditCompany={() => onEditCompany(menu.company)}
          onManageSubscription={() => onManageSubscription(menu.company)}
          onEditAccountHolder={() => setHolderModal(menu.company)}
          onAddBillingEmails={() => setBillingModal(menu.company)}
          onCancelSubscription={() => setCancelModal(menu.company)}
          onViewEmployees={() => onViewEmployees(menu.company)}
          onManageProgress={() => onManageProgress(menu.company)}
          onViewInvoices={() => setInvoicesModal(menu.company)}
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
      {columns.dashboardLastAccess && <col style={{ width: 170 }} />}
      {columns.price && <col style={{ width: 110 }} />}
      <col style={{ width: 40 }} />
    </colgroup>
  );
}

function SortableHeader({
  col, label, className, sort, toggle, sortable = true, tip,
}: {
  col: SortKey; label: string; className?: string; sort: { key: SortKey; dir: SortDir }; toggle: (k: SortKey) => void; sortable?: boolean; tip?: string;
}) {
  if (!sortable) {
    return (
      <th className={`${className ?? ""} no-sort`.trim()} data-tip={tip}>
        <span className="th-content">{label}</span>
      </th>
    );
  }
  const active = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)} data-tip={tip}>
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
  company, columns, onEdit, onManageSubscription, onOpenMenu, menuOpen,
}: {
  company: Company; columns: CompanyColumnState; onEdit: () => void; onManageSubscription: () => void; onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const billing = getCompanyBilling(company);
  return (
    <tr className={menuOpen ? "menu-open" : ""}>
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
      {columns.dashboardLastAccess && <td className="col-dashboard-access">{getDashboardLastAccess(company)}</td>}
      {columns.price && <td className="col-price">{getCompanyPrice(company)}</td>}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit" title="Edit company" onClick={onEdit}>
            <RowEditIcon />
          </button>
          <button className="row-action-btn" aria-label="Manage subscription" title="Manage subscription" onClick={onManageSubscription}>
            <RowCardIcon />
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────── Row actions menu (fixed-positioned) ─────────────── */

function CompanyActionsMenu({
  company, rect, onClose, onEditCompany, onManageSubscription, onEditAccountHolder, onAddBillingEmails, onCancelSubscription, onViewEmployees, onManageProgress, onViewInvoices,
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
  onManageProgress: () => void;
  onViewInvoices: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  // Only paid, running subscriptions can be cancelled.
  const canCancel = getCompanyBilling(company).status === "Active";

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
      className={`u-menu-item${danger ? " u-menu-item--danger" : ""}`}
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
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Figma 670:1323 — items only, no company header. Cancel Subscription
          is the design-system danger red (#ff1f31, text and icon). */}
      {item(<RowEditIcon />, "Edit Company Details", onEditCompany)}
      {item(<RowCardIcon />, "Manage Subscription", onManageSubscription)}
      {item(<MenuUserVipIcon />, "Change Account Holder", onEditAccountHolder)}
      {item(<MenuMailIcon />, "Manage Billing Emails", onAddBillingEmails)}
      {item(<MenuUsersIcon />, "View All Employees", onViewEmployees)}
      {/* Sits with the other roster action — opens Manage Completions on this
          company's cohort (that page left the sidebar; every way in is scoped). */}
      {item(<MenuProgressIcon />, "Manage User Progress", onManageProgress)}
      {item(<MenuInvoiceIcon />, "View Invoices", onViewInvoices)}
      {item(<MenuEnterIcon />, "View Company Dashboard", () => viewDashboard(company))}
      {canCancel && item(<MenuCancelSubIcon />, "Cancel Subscription", onCancelSubscription, true)}
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

/* ─────────────── Change Account Holder modal ─────────────── */

type Holder = { name: string; email: string; phone: string };

function currentHolder(company: Company): Holder {
  const derivedName = company.contactName || getCompanyUsers(company)[0]?.name || company.name;
  return {
    name: derivedName,
    email: company.email,
    phone: company.phone ?? "",
  };
}

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
  // A holder must already belong to the company (see the field subtext).
  const employees = useMemo(() => getCompanyUsers(company), [company]);
  // Candidates exclude whoever currently holds the account.
  const candidates = useMemo(
    () => employees.filter((u) => u.email !== original.email),
    [employees, original.email],
  );
  // SelectField options are plain strings; fall back to "name (email)" only if
  // two employees share a name.
  const optionLabels = useMemo(() => {
    const names = candidates.map((u) => u.name);
    const hasDup = new Set(names).size !== names.length;
    return candidates.map((u) => (hasDup ? `${u.name} (${u.email})` : u.name));
  }, [candidates]);

  const [mode, setMode] = useState<HolderMode>("change");
  const [selectedLabel, setSelectedLabel] = useState("");
  const selected = candidates[optionLabels.indexOf(selectedLabel)] ?? null;

  // The holder's roster record — carries the id the hover card's profile
  // link opens (company employees resolve via findCompanyUserProfile).
  const holderUser = employees.find((u) => u.email === original.email);

  function save() {
    if (!selected) return;
    onSave({ contactName: selected.name, email: selected.email });
  }

  return (
    <PrmModal
      title="Change Account Holder"
      description={
        <>
          Current:{" "}
          <UserDetailsHover
            popup
            user={{
              userId: holderUser?.id,
              userName: original.name,
              email: original.email,
              phone: original.phone,
            }}
            onOpenProfile={(id) =>
              window.open(
                `${window.location.origin}${window.location.pathname}?profile=${encodeURIComponent(id)}`,
                "_blank",
                "noopener",
              )
            }
          >
            <span className="co-holder-current">{original.name}</span>
          </UserDetailsHover>
        </>
      }
      confirmLabel="Save Changes"
      confirmDisabled={!selected}
      onCancel={onClose}
      onConfirm={save}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">What would you like to do?</span>
          <div className="radio-card-group">
            <RadioCard
              selected={mode === "change"}
              onSelect={() => setMode("change")}
              title="Change the Account Holder"
              desc={`Hand ownership to another employee. ${original.name} stays in the cohort as an Admin.`}
            />
            <RadioCard
              selected={mode === "replace"}
              onSelect={() => setMode("replace")}
              title="Remove from Company & Replace"
              desc={`Remove ${original.name} from the company entirely and assign a new account holder.`}
            />
          </div>
        </div>

        <div className="prm-field">
          <span className="prm-label">New Account Holder<span className="prm-req">*</span></span>
          <SelectField
            value={selectedLabel}
            options={optionLabels}
            onChange={setSelectedLabel}
            placeholder="Choose an employee…"
            searchPlaceholder="Search Employees..."
            popupMenu
            optionDetail={(label) => {
              const role = candidates[optionLabels.indexOf(label)]?.role;
              // Only Admins and Managers carry a role tag (Figma 668:943);
              // plain employees show none.
              return role === "Admin" || role === "Manager" ? role : null;
            }}
          />
          <p className="form-help">
            If the employee isn't in the company yet, they need to be added in before they can be
            set as the Account Holder.
          </p>
        </div>
      </div>
    </PrmModal>
  );
}

/* ─────────────── Manage Billing Emails modal ─────────────── */

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
    "Click on the “Go to Stripe” button",
    "On the Stripe Customer Page, click on the 3-dot menu and select “Edit Information”",
    "Navigate to the “Billing Email” option.",
    "Here, you can choose the “Add More Recipients” option where you can add more emails",
  ];

  return (
    <PrmModal
      title="Manage Billing Emails"
      description="Add/Remove emails that receive invoices"
      confirmLabel={<>Go to Stripe <ExternalLinkIcon /></>}
      confirmHref={stripeUrl}
      onCancel={onClose}
    >
      <div className="prm-content">
        <p>Configure the emails on Stripe. Here are the steps -</p>
        <ol>
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
    </PrmModal>
  );
}

/* ─────────────── View Invoices modal ─────────────── */

function ViewInvoicesModal({ company, onClose }: { company: Company; onClose: () => void }) {
  const customerId = getStripeCustomerId(company);
  // Placeholder for the real Stripe dashboard invoices view — carries the
  // Stripe customer id as a URL parameter, same shape a real redirect would use.
  const stripeUrl = `${window.location.origin}${window.location.pathname}?stripeInvoices=${encodeURIComponent(customerId)}`;

  return (
    <PrmModal
      title="View Invoices"
      cancelLabel="Close"
      confirmLabel={<>Open invoices in Stripe <ExternalLinkIcon /></>}
      confirmHref={stripeUrl}
      onCancel={onClose}
    >
      <p className="prm-text">
        Invoices for <strong>{company.name}</strong> are managed in Stripe. This needs to be
        opened on Stripe to view or download them.
      </p>
      <div className="co-billing-step" style={{ alignItems: "center" }}>
        <span className="co-billing-step-num">i</span>
        <span>Opening this will redirect to Stripe with the customer's Stripe ID.</span>
      </div>
    </PrmModal>
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

  return step === "form" ? (
    <PrmModal
      title="Cancel Subscription"
      cancelLabel="Keep subscription"
      confirmLabel="Continue"
      confirmDisabled={!reason}
      onCancel={onClose}
      onConfirm={() => setStep("confirm")}
    >
      <div className="prm-stack">
        <p className="prm-text">
          <strong>{company.name}</strong> keeps full access until the end of the current
          billing cycle ({billing.nextBillingDate}), then the subscription cancels.
        </p>

        <div className="prm-field">
          <span className="prm-label">Cancellation reason<span className="prm-req">*</span></span>
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
    </PrmModal>
  ) : (
    <PrmModal
      title={`Cancel ${company.name}'s subscription?`}
      cancelLabel="Go back"
      onCancelButton={() => setStep("form")}
      confirmLabel="Cancel subscription"
      onCancel={onClose}
      onConfirm={() => onConfirm(reason)}
    >
      <div className="prm-stack">
        <p className="prm-text">
          This schedules cancellation for the end of the current billing cycle
          ({billing.nextBillingDate}). The status changes to Canceled and the company is not
          billed again after that date.
        </p>

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
    </PrmModal>
  );
}
