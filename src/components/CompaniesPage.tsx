import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  getCompanyBilling,
  getCompanyUsers,
  getStatusPill,
  getCanceledOn,
  getTrialEndDate,
  getDashboardLastAccess,
  getOutstandingBalance,
  getDashboardLastAccessDays,
  getCompanyPrice,
  getCompanyPriceValue,
  getCancelEffectiveDate,
  getStatusTip,
  getSeatEvents,
  getAssignedCsm,
  getAssignedSalesRep,
  getCompanyPhone,
  isBilledStatus,
  TIERS,
  COMPANY_DEFAULT_COLUMNS,
  COMPANY_OPTIONAL_COLUMNS,
  type CompanyColumn,
  getStripeCustomerId,
  stripePaymentLink,
  CURRENCY_SYMBOL,
  CANCELLATION_REASONS,
  type Company,
  type CompanyBilling,
  type Tier,
  type SignUpChannel,
} from "../data/companies";
import {
  CalendarIcon, SortIcon, AddIcon, RowEditIcon, RowCardIcon, RowKebabIcon, RowDeleteIcon, CopyIcon, ChevronLeftIcon, ChevronRightIcon,
  MenuUserVipIcon, MenuMailIcon, MenuUsersIcon, MenuInvoiceIcon, MenuEnterIcon, MenuCancelSubIcon,
  RunMoveUpIcon, RunMoveDownIcon,
  AlertCircleFilledIcon,
  ArrowUpRightIcon,
} from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import {
  CompanyFilters,
  CompanyEditColumnsButton,
  EMPTY_MORE_FILTERS,
  type CompanyFilterState,
  type CompanyColumnState,
} from "./CompanyFilters";
import { useColumnOrder, orderedColumns } from "./Filters";
import { CompaniesSearch } from "./CompaniesSearch";
import { defaultDateRange, dateRangeIncludes, type DateRangeState } from "./DateRangeFilter";
import { useLandingMorph } from "../hooks/useLandingMorph";
import { LandingFilterRow, LandingOverlay, type LandingCol, type LandingPill, type LandingRow } from "./LandingMorph";

/* Landing-morph columns — mirror the table's DEFAULT visible columns (key,
   label, width) so the p=1 hand-off to the real table lines up. Edit Columns
   changes are a table-state concern; the landing always shows the default set,
   which is why this list is static rather than derived from `visibleCols`.
   Last Access is the `fixed` column — the one the minimal (landing) table
   shows beside Name; Tier and the rest grow in as the list becomes the table. */
const LM_COLS: LandingCol[] = [
  { key: "status", label: "Status", width: 232 },
  { key: "accountHolder", label: "Account Holder", width: 195 },
  { key: "tier", label: "Tier", width: 130 },
  { key: "seats", label: "Seats", width: 86 },
  { key: "seatChanges", label: "Seat Changes", width: 160 },
  { key: "lastAccess", label: "Last Access", width: 150, fixed: true },
];
import { PrmModal } from "./PrmModal";
import { CopiedToast } from "./CopiedToast";
import { MultiSelect, RadioCard } from "./NewCompanyWizard";
import { SelectField } from "./SelectField";
import { UserDetailsHover } from "./UserDetailsHover";

const PAGE_SIZE = 50;

type SortKey = "name" | "email" | "tier" | "status" | "signUp" | "billingCycle" | "payment" | "seats" | "industry" | "partnership" | "seatChanges" | "createdOn" | "canceledOn" | "trialEndDate" | "dashboardLastAccess" | "price" | "salesRep" | "csm";
type SortDir = "asc" | "desc";

// Cheapest plan first, so sorting Tier reads as a ladder rather than A–Z.
const TIER_ORDER: Record<Tier, number> = {
  Essentials: 0,
  Growth: 1,
  Professional: 2,
};

/* Trials and Free Access grants are on no plan at all, so they sort after
   every tier rather than ahead of Essentials. */
const tierRank = (c: Company) => (c.tier ? TIER_ORDER[c.tier] : TIERS.length);

/* The company's net seat movement WITHIN the selected Date Range — the Seat
   Changes column's whole point. Sums only the movements that fall in the
   window, so a narrower range reports a smaller move and a window the account
   didn't move in reports nothing at all. */
/** Whether a company has a seat count at all. Only a billed subscription does
 *  — Free Trial, Trial Expired, Free Access and Free Access Ended carry no
 *  seats and no seat movements. */
function hasSeats(billing: CompanyBilling): boolean {
  return isBilledStatus(billing.status);
}

/** Sort value for Seats: -1 for companies with no seat count, so they land
 *  below a genuine zero-seat subscription instead of tying with it. */
function seatsValue(c: Company): number {
  return hasSeats(getCompanyBilling(c)) ? c.seats : -1;
}

/** Sort value for Seat Changes, on the same rule. Seat movements can be
 *  negative, so seatless companies sort below the most negative real change. */
function seatChangeValue(c: Company, range: DateRangeState): number {
  return hasSeats(getCompanyBilling(c)) ? seatChangeIn(c, range) : -Infinity;
}

function seatChangeIn(c: Company, range: DateRangeState): number {
  return getSeatEvents(c).reduce(
    (n, e) => (dateRangeIncludes(range, e.date) ? n + e.delta : n),
    0,
  );
}

/* The two fixed columns bracket every optional one, so their widths are named
   rather than repeated between the colgroup and the natural-width sum. */
const NAME_WIDTH = 220;
/* Wide enough for the longest status pill: "Free Trial Ends Sep 30, 2026"
   measures 196px, plus the cell's 12px padding either side, plus slack. The
   dated pills (652:925) run far longer than the plain ones, and the table's row
   rule clips with an ellipsis rather than wrapping — so a column sized for
   "Active" quietly eats the end of a trial date. */
const STATUS_WIDTH = 232;
const ACTIONS_WIDTH = 40;

/* How the table DRAWS each optional column. The key, the label and the default
   order live with the data (COMPANY_OPTIONAL_COLUMNS) so the Edit Columns menu
   and the table can never disagree about what exists; this map adds only what
   the table itself needs. On-screen order is the `order` state in the component
   — a column switched on joins at the end, and dragging in the menu moves it. */
/** Page state a cell may need beyond the company itself — currently just the
 *  Date Range, which the Seat Changes column reports within. */
type ColContext = { dateRange: DateRangeState };

type CompanyCol = {
  key: CompanyColumn;
  label: string;
  className: string;
  /** Body-cell classes, when they differ from the header's. */
  cellClassName?: string;
  width: number;
  sortKey: SortKey;
  sortable?: boolean;
  /** Header tooltip. */
  tip?: string;
  /** Per-ROW tooltip on the body cell, for cells that abbreviate their value
   *  (the multi-value Industry / Partnership cells list the full set). */
  cellTip?: (c: Company) => string | undefined;
  dateScoped?: boolean;
  render: (c: Company, b: CompanyBilling, ctx: ColContext) => React.ReactNode;
};

const COL_DRAW: Record<CompanyColumn, Omit<CompanyCol, "key" | "label">> = {
  accountHolder: {
    className: "col-email", width: 195, sortKey: "email", sortable: false,
    render: (c) => <AccountHolderCell company={c} />,
  },
  tier: { className: "col-tier", width: 130, sortKey: "tier", render: (c) => <TierPill tier={c.tier} /> },
  /* Seats are a property of a SUBSCRIPTION: a Free Trial (running or expired)
     or a Free Access grant (running or ended) has no seat count and no seat
     movements, so both columns read an em dash for them — the same billed /
     not-billed split the Tier, Billing Cycle and Payment Method cells use. */
  seats: {
    className: "col-seats", width: 86, sortKey: "seats",
    render: (c, b) => (hasSeats(b) ? c.seats.toLocaleString() : "—"),
  },
  signUp: {
    className: "col-signup", width: 160, sortKey: "signUp",
    render: (_c, b) => <SignUpPill signUp={b.signUp} />,
  },
  billingCycle: { className: "col-cycle", width: 140, sortKey: "billingCycle", render: (_c, b) => billingCycleLabel(b) },
  payment: {
    className: "col-payment", width: 160, sortKey: "payment",
    render: (_c, b) => paymentLabel(b),
  },
  seatChanges: {
    className: "col-seat-changes", width: 160, sortKey: "seatChanges", dateScoped: true,
    render: (c, b, ctx) => (hasSeats(b) ? <SeatChangesCell change={seatChangeIn(c, ctx.dateRange)} /> : "—"),
  },
  /* Both are multi-value. The cell shows the first value with a "+N" badge for
     the rest and lists the whole set on hover, the same atom the Tasks table's
     "Used in" column uses. A company with none on file reads an em dash. */
  industry: {
    className: "col-industry", width: 145, sortKey: "industry",
    cellTip: (c) => tagTip(c.industry),
    render: (c) => <TagCell values={c.industry} />,
  },
  partnership: {
    className: "col-partnership", width: 155, sortKey: "partnership",
    cellTip: (c) => tagTip(c.partnership),
    render: (c) => <TagCell values={c.partnership} />,
  },
  // No calendar glyph any more: Created On is a plain date the range no longer
  // narrows — Seat Changes is the one date-scoped column now.
  createdOn: { className: "col-created", width: 144, sortKey: "createdOn", render: (_c, b) => b.createdOn },
  canceledOn: { className: "col-canceled", width: 136, sortKey: "canceledOn", render: (_c, b) => getCanceledOn(b) },
  trialEndDate: { className: "col-trial-end", width: 146, sortKey: "trialEndDate", render: (_c, b) => getTrialEndDate(b) },
  price: { className: "col-price", width: 110, sortKey: "price", render: (c) => getCompanyPrice(c) },
  // Assigning an owner is optional, so an unassigned account reads an em dash.
  salesRep: { className: "col-sales-rep", width: 175, sortKey: "salesRep", render: (c) => getAssignedSalesRep(c) || "—" },
  csm: { className: "col-csm", width: 165, sortKey: "csm", render: (c) => getAssignedCsm(c) || "—" },
  dashboardLastAccess: {
    className: "col-dashboard-access", width: 150, sortKey: "dashboardLastAccess",
    tip: "Last time a Manager/Admin viewed the Dashboard",
    render: (c) => getDashboardLastAccess(c),
  },
};

const COLS: CompanyCol[] = COMPANY_OPTIONAL_COLUMNS.map((d) => ({ ...d, ...COL_DRAW[d.key] }));

function compare(a: Company, b: Company, key: SortKey, range: DateRangeState): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "email": return a.email.localeCompare(b.email);
    case "tier": return tierRank(a) - tierRank(b);
    case "status": return getCompanyBilling(a).status.localeCompare(getCompanyBilling(b).status);
    case "signUp": return getCompanyBilling(a).signUp.localeCompare(getCompanyBilling(b).signUp);
    case "billingCycle": return getCompanyBilling(a).billingCycle.localeCompare(getCompanyBilling(b).billingCycle);
    case "payment": return paymentLabel(getCompanyBilling(a)).localeCompare(paymentLabel(getCompanyBilling(b)));
    case "seats": return seatsValue(a) - seatsValue(b);
    // Multi-value columns sort on their FIRST value, the one the cell shows;
    // a company with none sorts to the bottom rather than ahead of "Appliance".
    case "industry": return tagSortKey(a.industry).localeCompare(tagSortKey(b.industry));
    case "partnership": return tagSortKey(a.partnership).localeCompare(tagSortKey(b.partnership));
    case "seatChanges": return seatChangeValue(a, range) - seatChangeValue(b, range);
    case "createdOn": return (Date.parse(getCompanyBilling(a).createdOn) || 0) - (Date.parse(getCompanyBilling(b).createdOn) || 0);
    case "canceledOn": return (Date.parse(getCanceledOn(getCompanyBilling(a))) || 0) - (Date.parse(getCanceledOn(getCompanyBilling(b))) || 0);
    case "trialEndDate": return (Date.parse(getTrialEndDate(getCompanyBilling(a))) || 0) - (Date.parse(getTrialEndDate(getCompanyBilling(b))) || 0);
    case "dashboardLastAccess": return (getDashboardLastAccessDays(a) ?? Infinity) - (getDashboardLastAccessDays(b) ?? Infinity);
    case "price": return (getCompanyPriceValue(a) ?? -1) - (getCompanyPriceValue(b) ?? -1);
    case "salesRep": return blankLast(getAssignedSalesRep(a)).localeCompare(blankLast(getAssignedSalesRep(b)));
    case "csm": return blankLast(getAssignedCsm(a)).localeCompare(blankLast(getAssignedCsm(b)));
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
  /** Removes the company for good — only reachable from a Pending Payment
   *  Setup row, which has never billed and so has nothing to unwind. */
  onDeleteCompany: (company: Company) => void;
  onViewEmployees: (company: Company) => void;
  /** Jump to Product Config → B2B Management, where the lists these forms
   *  pick from (cancellation reasons, industries, partnerships) are edited. */
  onNavigateToProductConfig?: () => void;
};

export function CompaniesPage({ companies, initialQuery = "", onNewCompany, onEditCompany, onManageSubscription, onUpdateCompany, onDeleteCompany, onViewEmployees, onNavigateToProductConfig }: Props) {
  useCreateShortcut(onNewCompany);
  const [query, setQuery] = useState(initialQuery);
  /* Opens UNFILTERED — every company is listed until the user narrows it. The
     table used to default to Status: Active, which quietly hid trials, grants
     and cancelled accounts from the first screen. This matches what Clear
     Filters resets to, so the opening view and the cleared view agree. */
  const [filters, setFilters] = useState<CompanyFilterState>({
    tiers: [],
    industries: [],
    partnerships: [],
    statuses: [],
    ...EMPTY_MORE_FILTERS,
  });
  /* The Date Range does NOT narrow the row set — every company is always
     listed. It scopes the Seat Changes column: that cell sums only the seat
     movements inside this window. The range always has a value (default Last
     30 Days), so the column always has a window to report on. */
  const [dateRange, setDateRange] = useState<DateRangeState>(() => defaultDateRange());
  const [columns, setColumns] = useState<CompanyColumnState>(COMPANY_DEFAULT_COLUMNS);
  /* Display order of the optional columns, independent of which are switched
     on. It starts at the data module's order, which is what puts Last Access
     last in the default view. */
  const [order, setOrder] = useColumnOrder(COLS);
  const visibleCols = useMemo(() => orderedColumns(COLS, order, columns), [order, columns]);

  /* Switching a column ON moves it to the END of the row — that is where you
     expect a column you just added to appear. Dragging it in the Edit Columns
     menu afterwards overrides that, and switching one off leaves the order
     alone, so toggling it back on returns it to where you put it. */
  function applyColumns(next: CompanyColumnState) {
    const added = COLS.filter((c) => next[c.key] && !columns[c.key]).map((c) => c.key);
    if (added.length) setOrder((o) => [...o.filter((k) => !added.includes(k)), ...added]);
    setColumns(next);
  }

  // Most recently active first — ascending days-since-access; companies that
  // have never opened the dashboard fall to the bottom.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "dashboardLastAccess",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ company: Company; rect: DOMRect } | null>(null);
  const [holderModal, setHolderModal] = useState<Company | null>(null);
  const [billingModal, setBillingModal] = useState<Company | null>(null);
  const [invoicesModal, setInvoicesModal] = useState<Company | null>(null);
  const [cancelModal, setCancelModal] = useState<Company | null>(null);
  const [deleteModal, setDeleteModal] = useState<Company | null>(null);
  /* Bumped on every copy so a second click restarts the toast rather than
     being swallowed while the first one is still up. */
  const [copiedAt, setCopiedAt] = useState(0);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      if (q && !(
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.industry.some((v) => v.toLowerCase().includes(q)) ||
        c.partnership.some((v) => v.toLowerCase().includes(q)) ||
        (c.tier?.toLowerCase().includes(q) ?? false)
      )) return false;
      if (filters.tiers.length && !(c.tier && filters.tiers.includes(c.tier))) return false;
      // Multi-value: a company matches when ANY of its values is picked.
      if (filters.industries.length && !c.industry.some((v) => filters.industries.includes(v))) return false;
      if (filters.partnerships.length && !c.partnership.some((v) => filters.partnerships.includes(v))) return false;
      if (filters.statuses.length && !filters.statuses.includes(getCompanyBilling(c).status)) return false;
      if (filters.signUps.length && !filters.signUps.includes(getCompanyBilling(c).signUp)) return false;
      if (filters.billingCycles.length) {
        // Match on the displayed cycle; a company that isn't billed reads "—"
        // in the column, so it never matches Monthly/Annual.
        const billing = getCompanyBilling(c);
        if (!isBilledStatus(billing.status)) return false;
        if (!filters.billingCycles.includes(billing.billingCycle)) return false;
      }
      if (filters.paymentMethods.length) {
        // Match on the displayed method, so a company whose Payment Method cell
        // reads "—" never matches Automatic/Invoice.
        const shown = paymentLabel(getCompanyBilling(c));
        if (!filters.paymentMethods.includes(shown)) return false;
      }
      if (filters.csms.length && !filters.csms.includes(getAssignedCsm(c))) return false;
      if (filters.salesReps.length && !filters.salesReps.includes(getAssignedSalesRep(c))) {
        return false;
      }
      return true;
    });
    // NOTE: Date Range is deliberately absent here. It scopes the Seat Changes
    // COLUMN, not the row set — every company stays listed whatever window is
    // selected, and only that column's figure narrows with it.
  }, [companies, query, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered].sort((a, b) => compare(a, b, sort.key, dateRange));
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [filtered, sort, dateRange]);

  const colContext = useMemo<ColContext>(() => ({ dateRange }), [dateRange]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useEffect(() => setPage(1), [query, sort, filters, dateRange]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // Landing morph — the page opens as the search-first landing and the wheel
  // (or any search / pill / row interaction) morphs it into the table view.
  const morph = useLandingMorph(Boolean(initialQuery));

  /* Two fixed quick filters (Figma 956:1009) — the questions this page is
     usually opened to answer, rather than a sample of whichever tiers and
     industries happen to be most common. Each SETS the whole filter state it
     stands for instead of adding to what is already applied, so the result is
     exactly the named slice however the page was left. */
  const suggested = useMemo<LandingPill[]>(
    () => [
      {
        key: "past-due",
        label: "Past Due Invoices",
        onPick: () => {
          setFilters((prev) => ({ ...prev, statuses: ["Past Due"], tiers: [] }));
          morph.showTable();
        },
      },
      {
        key: "professional",
        label: "Professional Tier",
        onPick: () => {
          setFilters((prev) => ({ ...prev, statuses: ["Active"], tiers: ["Professional"] }));
          morph.showTable();
        },
      },
    ],
    [morph.showTable],
  );

  const landingRows: LandingRow[] = sorted.slice(0, 24).map((c) => {
    const billing = getCompanyBilling(c);
    const status = getStatusPill(billing);
    return {
      key: c.id,
      name: c.name,
      dim: billing.status === "Canceled",
      cells: {
        status: <span className={`co-status-pill co-status-pill--${status.tone}`}>{status.label}</span>,
        accountHolder: c.email,
        tier: c.tier ?? "—",
        seats: hasSeats(billing) ? c.seats.toLocaleString() : "—",
        seatChanges: hasSeats(billing) ? (
          <SeatChangesCell change={seatChangeIn(c, dateRange)} />
        ) : (
          "—"
        ),
        lastAccess: getDashboardLastAccess(c),
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
    NAME_WIDTH +
    STATUS_WIDTH +
    ACTIONS_WIDTH +
    visibleCols.reduce((sum, c) => sum + c.width, 0);

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
                  partnerships={filters.partnerships}
                  onPartnershipsChange={(v) => setFilters((prev) => ({ ...prev, partnerships: v }))}
                  query={query}
                  onCommit={(q) => {
                    setQuery(q);
                    morph.showTable();
                  }}
                />
              </div>

              <LandingFilterRow pills={suggested} onShowAll={morph.showTable}>
                  <CompanyFilters
                    filters={filters}
                    setFilters={setFilters}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                  />
                </LandingFilterRow>

              <div className="lm-stage">
              <LandingOverlay
                caption="Recently Active Companies"
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
                <ColGroup cols={visibleCols} />
                <thead>
                  <tr>
                    {/* The fixed columns lead the table: Company, then Status. */}
                    <SortableHeader col="name" label="Company" className="col-name" sort={sort} toggle={toggleSort} />
                    <SortableHeader col="status" label="Status" className="col-status" sort={sort} toggle={toggleSort} />
                    {visibleCols.map((c) => (
                      <SortableHeader
                        key={c.key}
                        col={c.sortKey}
                        label={c.label}
                        className={c.className}
                        sort={sort}
                        toggle={toggleSort}
                        sortable={c.sortable !== false}
                        tip={c.tip}
                        dateScoped={c.dateScoped}
                      />
                    ))}
                    <th className="col-actions">
                      <CompanyEditColumnsButton
                        columns={columns}
                        setColumns={applyColumns}
                        order={order}
                        onOrderChange={setOrder}
                      />
                    </th>
                  </tr>
                </thead>
              </table>

              <div className="tasks-scroll">
                <table className="table table-body">
                  <ColGroup cols={visibleCols} />
                  <tbody>
                    {paged.map((c) => (
                      <CompanyRow
                        key={c.id}
                        company={c}
                        cols={visibleCols}
                        ctx={colContext}
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
          onViewInvoices={() => setInvoicesModal(menu.company)}
          onCopyPaymentLink={() => {
            navigator.clipboard?.writeText(
              stripePaymentLink(menu.company.email, menu.company.name),
            ).catch(() => {});
            // Raised on the click, not on the promise: a browser that refuses
            // the write would otherwise give no sign the item did anything.
            setCopiedAt(Date.now());
          }}
          onDeleteCompany={() => setDeleteModal(menu.company)}
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

      {copiedAt > 0 && (
        <CopiedToast key={copiedAt} onDone={() => setCopiedAt(0)} />
      )}

      {deleteModal && (
        <PrmModal
          title="Delete Company?"
          confirmLabel="Delete Company"
          cancelLabel="Cancel"
          danger
          onCancel={() => setDeleteModal(null)}
          onConfirm={() => {
            onDeleteCompany(deleteModal);
            setDeleteModal(null);
          }}
        >
          {/* Both paragraphs are CONTENT, so both are white (Figma 667:884 —
              only the optional description under the title is grey). The first
              used to be passed as that description, which greyed out the very
              sentence explaining why deleting is safe here. */}
          <div className="prm-stack">
            <p className="prm-content">
              <strong>{deleteModal.name}</strong> has not added a payment method, so nothing
              has been billed. Deleting removes the company and its account holder invitation
              for good.
            </p>
            <p className="prm-content">
              This cannot be undone. The payment link already shared with them stops working.
            </p>
          </div>
        </PrmModal>
      )}

      {cancelModal && (
        <CancelSubscriptionModal
          company={cancelModal}
          onClose={() => setCancelModal(null)}
          onNavigateToProductConfig={onNavigateToProductConfig}
          onConfirm={(reason) => {
            onUpdateCompany({
              ...cancelModal,
              status: "Canceled",
              cancelsOn: getCancelEffectiveDate(getCompanyBilling(cancelModal)),
              cancellationReason: reason || undefined,
            });
            setCancelModal(null);
            window.alert(
              `${cancelModal.name}'s subscription is scheduled to cancel at the end of the current billing cycle.` +
                (reason ? `\n\nReason: ${reason}` : ""),
            );
          }}
        />
      )}
    </div>
  );
}

function ColGroup({ cols }: { cols: CompanyCol[] }) {
  return (
    <colgroup>
      {/* The fixed columns lead the table: Company, then Status. */}
      <col style={{ width: NAME_WIDTH }} />
      <col style={{ width: STATUS_WIDTH }} />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: ACTIONS_WIDTH }} />
    </colgroup>
  );
}

function SortableHeader({
  col, label, className, sort, toggle, sortable = true, tip, dateScoped = false,
}: {
  col: SortKey; label: string; className?: string; sort: { key: SortKey; dir: SortDir }; toggle: (k: SortKey) => void; sortable?: boolean; tip?: string;
  /* Marks the column the Date Range filter narrows the table by — it renders
     the calendar glyph ahead of the label, same treatment as Feedback Forms. */
  dateScoped?: boolean;
}) {
  const thTip = tip ?? (dateScoped ? "Counted within the selected date range" : undefined);
  const mark = dateScoped ? (
    <span className="th-date-icon"><CalendarIcon /></span>
  ) : null;
  if (!sortable) {
    return (
      <th className={`${className ?? ""} no-sort`.trim()} data-tip={thTip}>
        <span className="th-content">{mark}{label}</span>
      </th>
    );
  }
  const active = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)} data-tip={thTip}>
      <span className="th-content">
        {mark}
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}

/* Multi-value cell (Industry, Partnership) — Figma reuses the Tasks table's
 * "Used in" atom: the first value in full, then a muted "+N" standing for the
 * rest, with the complete list on the cell's hover tooltip. A company with
 * nothing on file gets the same em dash every other empty cell uses. */
function TagCell({ values }: { values: string[] }) {
  if (values.length === 0) return <>—</>;
  return (
    <>
      {values[0]}
      {values.length > 1 && <span className="used-extra">+{values.length - 1}</span>}
    </>
  );
}

/** The hover for a multi-value cell: every value, one per line, so the "+N"
 *  badge is always resolvable. Nothing to add when there is 0 or 1 value. */
function tagTip(values: string[]): string | undefined {
  return values.length > 1 ? values.join("\n") : undefined;
}

/** Sort key for a multi-value column: the first value, which is the one the
 *  cell actually shows. Empty sorts last in ascending order. */
function tagSortKey(values: string[]): string {
  return values[0] ?? "\uffff";
}

/** Same idea for the optional single-value columns (Assigned CSM / Sales Rep):
 *  unassigned accounts collect at the end rather than at the top. */
function blankLast(value: string): string {
  return value || "\uffff";
}

function TierPill({ tier }: { tier?: Tier }) {
  // A trial or a Free Access grant is on no plan at all — a dash, not a chip.
  if (!tier) return null;
  const slug = tier.toLowerCase().replace(/\s+/g, "-");
  return <span className={`co-tier co-tier--${slug}`}>{tier}</span>;
}

/* Account Holder cell — the column prints the holder's email, and hovering it
 * peeks at who that is (Figma 436:572: name, email, phone, with the header's
 * external-link opening their full profile). No `onEditName`, so the name row
 * carries no pencil: renaming an account holder is the row menu's "Change
 * Account Holder" flow, not an inline edit. */
function AccountHolderCell({ company }: { company: Company }) {
  const holder = currentHolder(company);
  const holderUser = getCompanyUsers(company).find((u) => u.email === company.email);
  return (
    <UserDetailsHover
      user={{
        userId: holderUser?.id,
        userName: holder.name,
        email: holder.email,
        phone: holder.phone,
      }}
      onOpenProfile={(id) =>
        window.open(
          `${window.location.origin}${window.location.pathname}?profile=${encodeURIComponent(id)}`,
          "_blank",
          "noopener",
        )
      }
    >
      <span className="co-holder-cell">{company.email}</span>
    </UserDetailsHover>
  );
}

/* Seat Changes cell (Figma 927:950) — how the company's seat count moved over
 * the period: "+3 ↑" in green when it grew, "−3 ↓" in red when it shrank, the
 * number hugging its arrow. The Figma frame shows both chips at once to
 * document the two states; a real account only ever moves one way, so only one
 * renders. No movement reads "—", like every other empty cell. */
function SeatChangesCell({ change }: { change: number }) {
  if (change === 0) return <>—</>;
  const up = change > 0;
  return (
    <span className={`co-seat-delta ${up ? "co-seat-delta--up" : "co-seat-delta--down"}`}>
      {up ? `+${change}` : `−${Math.abs(change)}`}
      {up ? <RunMoveUpIcon /> : <RunMoveDownIcon />}
    </span>
  );
}

function StatusPill({ billing }: { billing: CompanyBilling }) {
  const { tone, label } = getStatusPill(billing);
  // Why it was cancelled / how long until access is cut — the shared `data-tip`
  // tooltip picks this up; statuses with nothing to add render a bare pill.
  const tip = getStatusTip(billing);
  return (
    <span className={`co-status-pill co-status-pill--${tone}`} data-tip={tip ?? undefined}>
      {label}
    </span>
  );
}

// Billing cycle only applies while the subscription bills; a trial or a
// complimentary grant is on no plan and pays nothing, so it reads "—".
function billingCycleLabel(billing: CompanyBilling): string {
  return isBilledStatus(billing.status) ? billing.billingCycle : "—";
}

/* Payment Method shows only where money is actually being collected: an Active
 * subscription, or a cancelled one (scheduled or already in effect — it still
 * settles a final invoice). Deliberately NOT Past Due: that account is defined
 * by the payment that did NOT go through, so naming a method there would read
 * as if collection were working. Every other status is unbilled entirely. */
/* Every BILLED company has a payment method on file — Past Due especially, as
 * that status exists precisely because a charge against that method failed;
 * showing it a dash hid the thing you open the row to check. Trials and Free
 * Access grants collect nothing, so they keep the dash. */
function paymentLabel(billing: CompanyBilling): string {
  return isBilledStatus(billing.status) ? billing.payment : "—";
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
  company, cols, ctx, onEdit, onManageSubscription, onOpenMenu, menuOpen,
}: {
  company: Company;
  /** Page state the date-scoped cells report within. */
  ctx: ColContext;
  /** The visible optional columns, in the user's order. */
  cols: CompanyCol[];
  onEdit: () => void; onManageSubscription: () => void; onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const billing = getCompanyBilling(company);
  /* A company waiting on its payment method has no subscription to manage yet,
     so its hover bar drops the card glyph and offers only Edit. The kebab stays
     — it is the bar's last cell, aligned to sit exactly on the resting lone
     kebab, and without it the menu would be unreachable while hovering. */
  const pendingSetup = billing.status === "Pending Payment Setup";
  return (
    <tr className={menuOpen ? "menu-open" : ""}>
      <td className="col-name">{company.name}</td>
      <td className="col-status"><StatusPill billing={billing} /></td>
      {cols.map((c) => (
        <td
          key={c.key}
          className={c.cellClassName ?? c.className}
          data-tip={c.cellTip?.(company)}
        >
          {c.render(company, billing, ctx)}
        </td>
      ))}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => onOpenMenu(e.currentTarget.getBoundingClientRect())}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Edit" title="Edit company details" onClick={onEdit}>
            <RowEditIcon />
          </button>
          {!pendingSetup && (
            <button className="row-action-btn" aria-label="Manage subscription" title="Manage subscription" onClick={onManageSubscription}>
              <RowCardIcon />
            </button>
          )}
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
  company, rect, onClose, onEditCompany, onManageSubscription, onEditAccountHolder, onAddBillingEmails, onCancelSubscription, onViewEmployees, onViewInvoices, onCopyPaymentLink, onDeleteCompany,
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
  onCopyPaymentLink: () => void;
  onDeleteCompany: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const status = getCompanyBilling(company).status;
  const pendingSetup = status === "Pending Payment Setup";
  /* A paid subscription can be cancelled whether or not its last invoice was
     paid. Past Due is the case that most often ends in cancellation, and the
     unpaid invoice does not go away with it — the modal's Outstanding Balance
     card says so. Trials, grants and already-cancelled accounts have no
     subscription to end. */
  const canCancel = status === "Active" || status === "Past Due";
  // Billing emails address invoices, so an account that is not — and will not
  // again be — invoiced has nothing to manage them for.
  const showBillingEmails = !(
    status === "Free Trial" ||
    status === "Trial Expired" ||
    status === "Free Access" ||
    status === "Free Access Ended" ||
    status === "Canceled"
  );
  // A trial never raised an invoice, so there is nothing to look at. Free
  // Access and cancelled accounts keep the item: their past invoices stand.
  const showInvoices = !(status === "Free Trial" || status === "Trial Expired");

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
      {/* An account waiting on its payment method has no subscription, no
          invoices and no employees yet, so the full list would be a page of
          dead ends. It gets the three things that do apply: fix the details,
          re-send the link, or drop the record. */}
      {pendingSetup ? (
        <>
          {item(<RowEditIcon />, "Edit Company Details", onEditCompany)}
          {item(<CopyIcon />, "Copy Payment Link", onCopyPaymentLink)}
          {item(<RowDeleteIcon />, "Delete Company", onDeleteCompany, true)}
        </>
      ) : (
      <>
      {/* Figma 670:1323 — items only, no company header. Cancel Subscription
          is the design-system danger red (#ff1f31, text and icon). */}
      {item(<RowEditIcon />, "Edit Company Details", onEditCompany)}
      {item(<RowCardIcon />, "Manage Subscription", onManageSubscription)}
      {item(<MenuUserVipIcon />, "Change Account Holder", onEditAccountHolder)}
      {showBillingEmails && item(<MenuMailIcon />, "Manage Billing Emails", onAddBillingEmails)}
      {item(<MenuUsersIcon />, "View All Employees", onViewEmployees)}
      {showInvoices && item(<MenuInvoiceIcon />, "View Invoices", onViewInvoices)}
      {item(<MenuEnterIcon />, "View Company Dashboard", () => viewDashboard(company))}
      {canCancel && item(<MenuCancelSubIcon />, "Cancel Subscription", onCancelSubscription, true)}
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

/* ─────────────── Change Account Holder modal ─────────────── */

type Holder = { name: string; email: string; phone: string };

function currentHolder(company: Company): Holder {
  const derivedName = company.contactName || getCompanyUsers(company)[0]?.name || company.name;
  return {
    name: derivedName,
    email: company.email,
    phone: getCompanyPhone(company),
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
            placeholder="Select an Employee..."
            searchPlaceholder="Search Employees..."
            popupMenu
            /* Five rows then scroll, like the country/state pickers — a company
               with a long roster otherwise opens a menu taller than the modal. */
            maxVisibleOptions={5}
            optionSecondary={(label) => {
              const email = candidates[optionLabels.indexOf(label)]?.email;
              return email ? `· ${email}` : null;
            }}
            optionSearchText={(label) => candidates[optionLabels.indexOf(label)]?.email ?? ""}
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

function AddBillingEmailsModal({ company, onClose }: { company: Company; onClose: () => void }) {
  // Deep-links to the customer's page in the Stripe dashboard, searched by the
  // account holder's billing email.
  const stripeUrl = `https://dashboard.stripe.com/search?query=${encodeURIComponent(company.email)}`;

  const steps = [
    "Click on the “Open Stripe” button",
    "On the Stripe Customer Page, click on the 3-dot menu and select “Edit Information”",
    "Navigate to the “Billing Email” option.",
    "Here, you can choose the “Add More Recipients” option where you can add more emails",
  ];

  return (
    <PrmModal
      title="Manage Billing Emails"
      description="Add/Remove emails that receive invoices"
      confirmLabel="Open Stripe"
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
      confirmLabel="Open Stripe"
      confirmHref={stripeUrl}
      onCancel={onClose}
    >
      <p className="prm-content">
        Invoices for <strong>{company.name}</strong> are managed in Stripe. This needs to be
        opened on Stripe to view or download them.
      </p>
    </PrmModal>
  );
}

/* ─────────────── Cancel Subscription modal ─────────────── */

/* Outstanding Balance card — Figma 1031:1036.
 * One line: the glyph, the amount inline in the heading, and a note that the
 * charge still lands at the end of the period. Cancelling ends the
 * subscription, not the debt, and this is where the flow says so.
 *
 * Renders NOTHING when there is no balance — an empty-state card would be a
 * row of reassurance nobody asked for, so the modal simply loses it. */
function OutstandingBalanceCard({ company }: { company: Company }) {
  const bal = getOutstandingBalance(company);
  if (bal.total === 0) return null;

  const amount = `${CURRENCY_SYMBOL[bal.currency]}${bal.total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="co-balance">
      <span className="co-balance-icon"><AlertCircleFilledIcon /></span>
      <div className="co-balance-text">
        <p className="co-balance-title">Outstanding Balance: {amount}</p>
        <p className="co-balance-sub">
          The customer will be billed at the end of the period.
        </p>
      </div>
    </div>
  );
}
function CancelSubscriptionModal({
  company, onClose, onConfirm, onNavigateToProductConfig,
}: {
  company: Company;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  onNavigateToProductConfig?: () => void;
}) {
  const billing = getCompanyBilling(company);
  const sym = CURRENCY_SYMBOL[billing.currency];
  /* More than one reason can apply, so this is the shared MultiSelect rather
     than a single-choice dropdown. The record keeps them as one display
     string (the status pill's hover reads "Reason: …"), joined in the order
     they were picked. */
  const [reasons, setReasons] = useState<string[]>([]);
  const reasonText = reasons.join(", ");
  const [step, setStep] = useState<"form" | "confirm">("form");

  // Seats ADDED this cycle still bill (prorated) on the upcoming invoice; a
  // company that shed seats has nothing pending. Same source as the card on
  // step one, so the two screens cannot disagree about what is owed.
  const balance = getOutstandingBalance(company);
  /* The date this modal PRINTS is the date it stores on confirm. The raw
     nextBillingDate carries no year ("Feb 1"), which read as ambiguous beside
     the fully-qualified access-cutoff date in the Past Due copy. */
  const effectiveDate = getCancelEffectiveDate(billing);
  const pendingSeats = balance.pendingSeats;
  const pendingCharge = balance.pendingSeatCharge;

  return step === "form" ? (
    <PrmModal
      title="Cancel Subscription"
      cancelLabel="Keep subscription"
      confirmLabel="Continue"
      onCancel={onClose}
      onConfirm={() => setStep("confirm")}
    >
      <div className="prm-stack">
        {/* An Active account keeps working to the cycle end; a Past Due one is
            already inside its grace period and can lose access sooner, so it must
            not be told it keeps "full access" until then. */}
        {billing.status === "Past Due" ? (
          <p className="prm-content">
            <strong>{company.name}</strong> is {billing.daysPastDue}{" "}
            {billing.daysPastDue === 1 ? "day" : "days"} past due. Cancelling schedules the
            subscription to end with the current billing cycle ({effectiveDate}).
            Access is cut off on {billing.accessEndsOn} if the outstanding invoice goes unpaid.
          </p>
        ) : (
          <p className="prm-content">
            <strong>{company.name}</strong> keeps full access until the end of the current
            billing cycle ({effectiveDate}), then the subscription cancels.
          </p>
        )}

        <div className="prm-field">
          <span className="prm-label">Cancellation Reason</span>
          {/* `popupMenu` puts the panel on the popup-context surface, the way
              the Change Account Holder picker does inside the same shell. */}
          <MultiSelect
            options={CANCELLATION_REASONS}
            value={reasons}
            onChange={setReasons}
            placeholder="Select a reason…"
            popupMenu
          />
          <p className="form-help co-w-manage-link">
            Manage Cancellation Reasons on{" "}
            <a
              href="#"
              className="text-link"
              onClick={(e) => {
                e.preventDefault();
                onNavigateToProductConfig?.();
              }}
            >
              Product Config <ArrowUpRightIcon />
            </a>
          </p>
        </div>

        <OutstandingBalanceCard company={company} />
      </div>
    </PrmModal>
  ) : (
    <PrmModal
      title={`Cancel ${company.name}'s subscription?`}
      cancelLabel="Go back"
      onCancelButton={() => setStep("form")}
      confirmLabel="Cancel subscription"
      onCancel={onClose}
      onConfirm={() => onConfirm(reasonText)}
    >
      <div className="prm-stack">
        <p className="prm-content">
          This schedules cancellation for the end of the current billing cycle
          ({effectiveDate}). The status changes to Canceled and the company is not
          billed again after that date.
        </p>

        <div className="co-cancel-summary">
          <div className="co-cancel-summary-row">
            <span className="co-cancel-summary-label">Reason</span>
            {/* The reason is optional, so this row can be empty — it takes the
                same em dash every other blank value in the app uses. */}
            <span>{reasonText || "—"}</span>
          </div>
          <div className="co-cancel-summary-row">
            <span className="co-cancel-summary-label">Effective</span>
            <span>End of cycle · {effectiveDate}</span>
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
