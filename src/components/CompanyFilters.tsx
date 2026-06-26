import { Dropdown } from "./Dropdown";
import { EditColumnsIcon } from "./icons";
import { PillTrigger, summarize, SectionedMultiSelect, CheckRow } from "./Filters";
import {
  TIERS,
  SUBSCRIPTION_STATUSES,
  COMPANY_INDUSTRIES,
  COMPANY_PARTNERSHIPS,
  COMPANY_OPTIONAL_COLUMNS,
  COMPANY_FIXED_COLUMNS,
  type CompanyColumn,
} from "../data/companies";

export type CompanyFilterState = {
  tiers: string[];
  industries: string[];
  partnerships: string[];
  statuses: string[];
};

export type CompanyColumnState = Record<CompanyColumn, boolean>;

type Props = {
  filters: CompanyFilterState;
  setFilters: (next: CompanyFilterState) => void;
};

export function CompanyFilters({ filters, setFilters }: Props) {
  const hasFilters =
    filters.tiers.length +
      filters.industries.length +
      filters.partnerships.length +
      filters.statuses.length >
    0;

  function clearAll() {
    setFilters({ tiers: [], industries: [], partnerships: [], statuses: [] });
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
      {hasFilters && (
        <button className="filter-clear-link" onClick={clearAll}>
          Clear Filters
        </button>
      )}
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

/* ──────────── Edit Columns ──────────── */

export function CompanyEditColumnsButton({
  columns,
  setColumns,
}: {
  columns: CompanyColumnState;
  setColumns: (c: CompanyColumnState) => void;
}) {
  return (
    <Dropdown
      width={240}
      align="right"
      trigger={({ toggle }) => (
        <button
          className="edit-columns-btn"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-label="Edit columns"
          data-tooltip="Edit Columns"
        >
          <EditColumnsIcon />
        </button>
      )}
    >
      {() => <CompanyColumnsBody value={columns} onApply={(c) => setColumns(c)} />}
    </Dropdown>
  );
}

function CompanyColumnsBody({
  value,
  onApply,
}: {
  value: CompanyColumnState;
  onApply: (v: CompanyColumnState) => void;
}) {
  const active = COMPANY_OPTIONAL_COLUMNS.filter((c) => value[c.key]);
  const available = COMPANY_OPTIONAL_COLUMNS.filter((c) => !value[c.key]);
  return (
    <div className="dropdown-list cols-menu">
      <div className="dropdown-section">
        <div className="dropdown-section-label">Fixed columns</div>
        {COMPANY_FIXED_COLUMNS.map(({ label }) => (
          <div key={label} className="cols-fixed-row">
            {label}
          </div>
        ))}
      </div>

      <div className="dropdown-section">
        <div className="dropdown-section-label">Active columns</div>
        {active.length === 0 ? (
          <div className="cols-empty">No active columns</div>
        ) : (
          active.map(({ key, label }) => (
            <CheckRow
              key={key}
              label={label}
              checked
              draggable
              onChange={() => onApply({ ...value, [key]: false })}
            />
          ))
        )}
      </div>

      <div className="dropdown-section">
        <div className="dropdown-section-label">Available columns</div>
        {available.length === 0 ? (
          <div className="cols-empty">All columns are active</div>
        ) : (
          available.map(({ key, label }) => (
            <CheckRow
              key={key}
              label={label}
              checked={false}
              onChange={() => onApply({ ...value, [key]: true })}
            />
          ))
        )}
      </div>
    </div>
  );
}
