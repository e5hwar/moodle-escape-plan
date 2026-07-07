import { useEffect, useState } from "react";
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
  SIGN_UP_CHANNELS,
  BILLING_CYCLES,
  PAYMENT_COLLECTIONS,
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
      filters.statuses.length +
      filters.signUps.length +
      filters.billingCycles.length +
      filters.paymentMethods.length >
    0;

  function clearAll() {
    setFilters({
      tiers: [],
      industries: [],
      partnerships: [],
      statuses: [],
      signUps: [],
      billingCycles: [],
      paymentMethods: [],
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
        signUps={filters.signUps}
        billingCycles={filters.billingCycles}
        paymentMethods={filters.paymentMethods}
        onApply={(v) =>
          setFilters({
            ...filters,
            signUps: v.signUps,
            billingCycles: v.billingCycles,
            paymentMethods: v.paymentMethods,
          })
        }
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

function MoreFiltersPill({
  signUps,
  billingCycles,
  paymentMethods,
  onApply,
}: {
  signUps: string[];
  billingCycles: string[];
  paymentMethods: string[];
  onApply: (v: { signUps: string[]; billingCycles: string[]; paymentMethods: string[] }) => void;
}) {
  const count = signUps.length + billingCycles.length + paymentMethods.length;
  const summary = count > 0 ? `${count} active` : null;

  return (
    <Dropdown
      width={320}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More filters"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply({ signUps: [], billingCycles: [], paymentMethods: [] })}
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          signUps={signUps}
          billingCycles={billingCycles}
          paymentMethods={paymentMethods}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function MoreFiltersBody({
  signUps,
  billingCycles,
  paymentMethods,
  onApply,
}: {
  signUps: string[];
  billingCycles: string[];
  paymentMethods: string[];
  onApply: (v: { signUps: string[]; billingCycles: string[]; paymentMethods: string[] }) => void;
}) {
  const [draftSignUps, setDraftSignUps] = useState(signUps);
  const [draftCycles, setDraftCycles] = useState(billingCycles);
  const [draftPayments, setDraftPayments] = useState(paymentMethods);
  const [hovered, setHovered] = useState<"signUp" | "billingCycle" | "paymentMethod" | null>(null);
  const [hoveredTop, setHoveredTop] = useState(0);

  useEffect(() => setDraftSignUps(signUps), [signUps]);
  useEffect(() => setDraftCycles(billingCycles), [billingCycles]);
  useEffect(() => setDraftPayments(paymentMethods), [paymentMethods]);

  function toggleSignUp(item: string) {
    setDraftSignUps((d) => (d.includes(item) ? d.filter((x) => x !== item) : [...d, item]));
  }
  function toggleCycle(item: string) {
    setDraftCycles((d) => (d.includes(item) ? d.filter((x) => x !== item) : [...d, item]));
  }
  function togglePayment(item: string) {
    setDraftPayments((d) => (d.includes(item) ? d.filter((x) => x !== item) : [...d, item]));
  }

  return (
    <div className="cascading-menu" onMouseLeave={() => setHovered(null)}>
      <div className="cascading-root">
        <div className="dropdown-list">
          <SubmenuRow
            label="Sign-Up"
            active={hovered === "signUp"}
            onHover={(top) => { setHovered("signUp"); setHoveredTop(top); }}
          />
          <SubmenuRow
            label="Billing Cycle"
            active={hovered === "billingCycle"}
            onHover={(top) => { setHovered("billingCycle"); setHoveredTop(top); }}
          />
          <SubmenuRow
            label="Payment Method"
            active={hovered === "paymentMethod"}
            onHover={(top) => { setHovered("paymentMethod"); setHoveredTop(top); }}
          />
        </div>
        <div className="dropdown-footer">
          <button
            className="btn-apply"
            onClick={() => onApply({ signUps: draftSignUps, billingCycles: draftCycles, paymentMethods: draftPayments })}
          >
            Apply
          </button>
        </div>
      </div>

      {hovered && (
        <div
          className="cascading-sub"
          style={{ top: hoveredTop }}
          onMouseEnter={() => setHovered(hovered)}
        >
          <div className="dropdown-list">
            {hovered === "signUp" && (
              <div className="dropdown-section">
                {SIGN_UP_CHANNELS.map((s) => (
                  <CheckRow
                    key={s}
                    label={s}
                    checked={draftSignUps.includes(s)}
                    onChange={() => toggleSignUp(s)}
                  />
                ))}
              </div>
            )}
            {hovered === "billingCycle" && (
              <div className="dropdown-section">
                {BILLING_CYCLES.map((cy) => (
                  <CheckRow
                    key={cy}
                    label={cy}
                    checked={draftCycles.includes(cy)}
                    onChange={() => toggleCycle(cy)}
                  />
                ))}
              </div>
            )}
            {hovered === "paymentMethod" && (
              <div className="dropdown-section">
                {PAYMENT_COLLECTIONS.map((p) => (
                  <CheckRow
                    key={p}
                    label={p}
                    checked={draftPayments.includes(p)}
                    onChange={() => togglePayment(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SubmenuRow({
  label,
  active,
  onHover,
}: {
  label: string;
  active: boolean;
  onHover: (top: number) => void;
}) {
  function handle(e: React.MouseEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    const parent = btn.offsetParent as HTMLElement | null;
    let top = btn.offsetTop;
    let el: HTMLElement | null = btn.parentElement;
    while (el && el !== parent) {
      top += el.offsetTop;
      el = el.parentElement;
    }
    onHover(top);
  }
  return (
    <button
      className={`dropdown-submenu-row ${active ? "active" : ""}`}
      onMouseEnter={handle}
      onFocus={handle}
    >
      <span className="dropdown-submenu-label">{label}</span>
      <span className="dropdown-submenu-chevron">›</span>
    </button>
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
