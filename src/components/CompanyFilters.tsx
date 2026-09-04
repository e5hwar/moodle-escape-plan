import { Dropdown } from "./Dropdown";
import { PillTrigger, summarize, SectionedMultiSelect, CascadingMultiSelect, EditColumnsButton } from "./Filters";
import { DateRangePill, type DateRangeState } from "./DateRangeFilter";
import {
  TIERS,
  SUBSCRIPTION_STATUSES,
  COMPANY_INDUSTRIES,
  COMPANY_PARTNERSHIPS,
  COMPANY_OPTIONAL_COLUMNS,
  COMPANY_FIXED_COLUMNS,
  SIGN_UP_CHANNELS,
  BILLING_CYCLES,
  PAYMENT_COLLECTIONS,
  CSM_OPTIONS,
  SALES_REP_OPTIONS,
  type CompanyColumn,
} from "../data/companies";

export type CompanyFilterState = {
  tiers: string[];
  industries: string[];
  partnerships: string[];
  statuses: string[];
  signUps: string[];
  billingCycles: string[];
  paymentMethods: string[];
  csms: string[];
  salesReps: string[];
};

/* The filters that live behind "More Filters" rather than on their own pill —
 * a slice of the state above, passed around as one object so adding a section
 * is a one-line change here instead of another prop threaded three deep. */
export const MORE_FILTER_KEYS = [
  "signUps",
  "billingCycles",
  "paymentMethods",
  "csms",
  "salesReps",
] as const;

export type CompanyMoreFilters = Pick<CompanyFilterState, (typeof MORE_FILTER_KEYS)[number]>;

export const EMPTY_MORE_FILTERS: CompanyMoreFilters = {
  signUps: [],
  billingCycles: [],
  paymentMethods: [],
  csms: [],
  salesReps: [],
};

export type CompanyColumnState = Record<CompanyColumn, boolean>;

type Props = {
  filters: CompanyFilterState;
  setFilters: (next: CompanyFilterState) => void;
  dateRange: DateRangeState;
  setDateRange: (next: DateRangeState) => void;
};

export function CompanyFilters({ filters, setFilters, dateRange, setDateRange }: Props) {
  const hasFilters = Object.values(filters).some((v) => v.length > 0);

  function clearAll() {
    setFilters({
      tiers: [],
      industries: [],
      partnerships: [],
      statuses: [],
      ...EMPTY_MORE_FILTERS,
    });
  }

  return (
    <div className="filters">
      <TierPill
        value={filters.tiers}
        onApply={(v) => setFilters({ ...filters, tiers: v })}
      />
      <StatusPill
        value={filters.statuses}
        onApply={(v) => setFilters({ ...filters, statuses: v })}
      />
      <IndustryPill
        value={filters.industries}
        onApply={(v) => setFilters({ ...filters, industries: v })}
      />
      <PartnershipPill
        value={filters.partnerships}
        onApply={(v) => setFilters({ ...filters, partnerships: v })}
      />
      <MoreFiltersPill
        value={filters}
        onApply={(v) => setFilters({ ...filters, ...v })}
      />
      {hasFilters && (
        <button className="filter-clear-link" onClick={clearAll}>
          Clear Filters
        </button>
      )}
      {/* Date Range holds the row's right edge (Figma 673:1409). It always has
          a value and cannot be removed — Clear Filters leaves it alone. */}
      <span className="filters-end">
        <DateRangePill value={dateRange} onChange={setDateRange} />
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function TierPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, TIERS);
  return (
    <Dropdown
      width={240}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Tier"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...TIERS] }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function StatusPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, SUBSCRIPTION_STATUSES);
  return (
    <Dropdown
      width={220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Status"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...SUBSCRIPTION_STATUSES] }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function IndustryPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, COMPANY_INDUSTRIES);
  return (
    <Dropdown
      width={260}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Industry"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: COMPANY_INDUSTRIES }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable
          searchPlaceholder="Search industries…"
        />
      )}
    </Dropdown>
  );
}

function PartnershipPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, COMPANY_PARTNERSHIPS);
  return (
    <Dropdown
      width={260}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Partnership"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: COMPANY_PARTNERSHIPS }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable
          searchPlaceholder="Search partnerships…"
        />
      )}
    </Dropdown>
  );
}

function MoreFiltersPill({
  value,
  onApply,
}: {
  value: CompanyMoreFilters;
  onApply: (v: CompanyMoreFilters) => void;
}) {
  const count = MORE_FILTER_KEYS.reduce((n, k) => n + value[k].length, 0);
  const summary = count > 0 ? `${count} Active` : null;

  return (
    <Dropdown
      width={320}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply(EMPTY_MORE_FILTERS)}
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

/* "More Filters" is a MENU, not a filter panel of its own: each row opens the
   respective filter's dropdown, and Apply lives in THAT submenu — Figma 772:1108
   shows the root list (28:16530) with no footer, while the submenu states
   (774:1243 / 774:1298) each carry the Apply CTA. Shared with the Tasks and
   Certifications rows so all three behave identically. */
function MoreFiltersBody({
  value,
  onApply,
}: {
  value: CompanyMoreFilters;
  onApply: (v: CompanyMoreFilters) => void;
}) {
  return (
    <CascadingMultiSelect
      sections={[
        { key: "signUps", label: "Sign-Up Method", groups: [{ items: [...SIGN_UP_CHANNELS] }] },
        { key: "billingCycles", label: "Billing Cycle", groups: [{ items: [...BILLING_CYCLES] }] },
        { key: "paymentMethods", label: "Payment Method", groups: [{ items: [...PAYMENT_COLLECTIONS] }] },
        { key: "csms", label: "Assigned CSM", groups: [{ items: [...CSM_OPTIONS] }] },
        { key: "salesReps", label: "Assigned Sales Rep", groups: [{ items: [...SALES_REP_OPTIONS] }] },
      ]}
      value={value}
      onApply={(v) =>
        onApply(
          Object.fromEntries(MORE_FILTER_KEYS.map((k) => [k, v[k]])) as CompanyMoreFilters,
        )
      }
    />
  );
}


/* Edit Columns — the shared control (Filters.tsx), which already carries the
 * ALL / NONE bulk toggles every other table’s menu has. Companies used to
 * carry its own copy of the body without them. */
export function CompanyEditColumnsButton({
  columns,
  setColumns,
  order,
  onOrderChange,
}: {
  columns: CompanyColumnState;
  setColumns: (c: CompanyColumnState) => void;
  /** Pass both to enable drag-to-reorder in the menu. */
  order?: CompanyColumn[];
  onOrderChange?: (next: CompanyColumn[]) => void;
}) {
  return (
    <EditColumnsButton
      columns={columns}
      setColumns={setColumns}
      optional={COMPANY_OPTIONAL_COLUMNS}
      fixed={COMPANY_FIXED_COLUMNS}
      order={order}
      onOrderChange={onOrderChange}
    />
  );
}
