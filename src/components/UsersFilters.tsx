import { useState, useMemo, useEffect, type ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { ColumnsBody } from "./Filters";
import { PlusCircleIcon, XCircleIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, CheckIcon, EditColumnsIcon, DragHandleIcon } from "./icons";
import { companies } from "../data/companies";

/* ── Columns: every profile field is an optional column. Name is fixed. ── */
export type UserColumnKey =
  | "email"
  | "phone"
  | "userType"
  | "company"
  | "role"
  | "subscription"
  | "language"
  | "goal"
  | "attribution"
  | "zipCode"
  | "industryPreference"
  | "lastAccess"
  | "dashboardLastAccess"
  | "joinedOn";

export type UserColumnState = Record<UserColumnKey, boolean>;

export const USER_FIXED_COLUMNS: { label: string }[] = [{ label: "Name" }];

export const USER_OPTIONAL_COLUMNS: { key: UserColumnKey; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "userType", label: "User Type" },
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "subscription", label: "Subscription" },
  { key: "language", label: "Language" },
  { key: "goal", label: "Goal" },
  { key: "attribution", label: "Attribution" },
  { key: "zipCode", label: "Zip Code" },
  { key: "industryPreference", label: "Industry Preference" },
  { key: "lastAccess", label: "App Last Access" },
  { key: "dashboardLastAccess", label: "Dashboard Last Access" },
  { key: "joinedOn", label: "Joined SkillCat" },
];

/* ── Filters ── */
export type UserFilterState = {
  types: string[];
  subscriptions: string[];
  companies: string[];
  roles: string[];
  goals: string[];
  industries: string[];
};

export const USER_TYPES = ["B2C", "B2B"];
export const SUBSCRIPTIONS = ["Free Trial", "Starter", "Subscriber", "Scholarship"];
export const ROLES = ["Self-Learner", "Employee", "Manager", "Admin"];
export const GOALS = ["Looking for my first trades job", "Exploring careers in the skilled trades", "Focused on advancing my career", "Other"];
export const INDUSTRIES = ["HVAC", "Electrical", "Plumbing", "Solar", "Refrigeration", "Appliance Repair"];
const COMPANY_NAMES = companies.map((c) => c.name);

export function UsersFilters({
  filters,
  setFilters,
  extra,
}: {
  filters: UserFilterState;
  setFilters: (next: UserFilterState) => void;
  /** Extra page-specific filter pills rendered alongside the shared ones. */
  extra?: ReactNode;
}) {
  const moreCount =
    filters.roles.length + filters.goals.length + filters.industries.length;

  const hasFilters =
    filters.types.length +
      filters.subscriptions.length +
      filters.companies.length +
      moreCount >
    0;

  function clearAll() {
    setFilters({
      types: [],
      subscriptions: [],
      companies: [],
      roles: [],
      goals: [],
      industries: [],
    });
  }

  return (
    <div className="filters">
      <MultiPill
        label="User Type"
        all={USER_TYPES}
        value={filters.types}
        onApply={(v) => setFilters({ ...filters, types: v })}
      />
      <MultiPill
        label="Subscription"
        all={SUBSCRIPTIONS}
        value={filters.subscriptions}
        onApply={(v) => setFilters({ ...filters, subscriptions: v })}
      />
      <MultiPill
        label="Company"
        all={COMPANY_NAMES}
        value={filters.companies}
        onApply={(v) => setFilters({ ...filters, companies: v })}
        searchable
        searchPlaceholder="Search companies…"
        width={300}
      />
      <MoreFiltersPill
        roles={filters.roles}
        goals={filters.goals}
        industries={filters.industries}
        count={moreCount}
        onApply={(v) =>
          setFilters({
            ...filters,
            roles: v.roles,
            goals: v.goals,
            industries: v.industries,
          })
        }
      />
      {extra}
      {hasFilters && (
        <button className="filter-clear-link" onClick={clearAll}>
          Clear Filters
        </button>
      )}
    </div>
  );
}

export function UsersEditColumns<T extends Record<string, boolean>>({
  columns,
  setColumns,
  fixed = USER_FIXED_COLUMNS,
  optional = USER_OPTIONAL_COLUMNS as { key: string; label: string }[],
  order,
  onOrderChange,
}: {
  columns: T;
  setColumns: (c: T) => void;
  /** Override the column definitions to reuse this control on other tables. */
  fixed?: { label: string }[];
  optional?: { key: string; label: string }[];
  /** Pass both to enable drag-to-reorder. */
  order?: string[];
  onOrderChange?: (next: string[]) => void;
}) {
  return (
    <Dropdown
      width={300}
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
      {() => (
        <ColumnsBody
          value={columns}
          onApply={(c) => setColumns(c as T)}
          fixed={fixed}
          optional={optional}
          order={order}
          onOrderChange={onOrderChange as ((n: string[]) => void) | undefined}
        />
      )}
    </Dropdown>
  );
}

/* ─────────────────────────────────────────────────────────────── */

function PillTrigger({
  label,
  value,
  open,
  toggle,
  onClear,
}: {
  label: string;
  value: string | null;
  open: boolean;
  toggle: () => void;
  onClear?: () => void;
}) {
  if (value && onClear) {
    return (
      <span className={`filter-applied ${open ? "open" : ""}`}>
        <button className="filter-applied-clear" onClick={onClear} aria-label={`Clear ${label}`}>
          <XCircleIcon />
        </button>
        <button className="filter-applied-main" onClick={toggle}>
          <span className="label">{label}</span>
          <span className="sep" />
          <span className="value">{value}</span>
          <span className="caret">
            <ChevronDownIcon />
          </span>
        </button>
      </span>
    );
  }
  return (
    <button className={`filter-pill-dashed ${open ? "open" : ""}`} onClick={toggle}>
      <span className="icon">
        <PlusCircleIcon />
      </span>
      {label}
    </button>
  );
}

function summarize(values: string[], all: string[]): string | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  if (values.length === all.length) return "All";
  return `${values.length} selected`;
}

export function MultiPill({
  label,
  all,
  value,
  onApply,
  searchable = false,
  searchPlaceholder,
  width = 260,
}: {
  label: string;
  all: string[];
  value: string[];
  onApply: (v: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  width?: number;
}) {
  return (
    <Dropdown
      width={width}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label={label}
          value={summarize(value, all)}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SimpleMultiSelect
          items={all}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder}
        />
      )}
    </Dropdown>
  );
}

function MoreFiltersPill({
  roles,
  goals,
  industries,
  count,
  onApply,
}: {
  roles: string[];
  goals: string[];
  industries: string[];
  count: number;
  onApply: (v: { roles: string[]; goals: string[]; industries: string[] }) => void;
}) {
  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More filters"
          value={count > 0 ? `${count} active` : null}
          open={open}
          toggle={toggle}
          onClear={() => onApply({ roles: [], goals: [], industries: [] })}
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          roles={roles}
          goals={goals}
          industries={industries}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

/* ────────────  Multi-select bodies ──────────── */

function SimpleMultiSelect({
  items,
  value,
  onApply,
  searchable = false,
  searchPlaceholder,
}: {
  items: string[];
  value: string[];
  onApply: (v: string[]) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [draft, setDraft] = useState<string[]>(value);
  const [query, setQuery] = useState("");

  useEffect(() => setDraft(value), [value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.toLowerCase().includes(q));
  }, [items, query]);

  function toggle(item: string) {
    setDraft((d) => (d.includes(item) ? d.filter((x) => x !== item) : [...d, item]));
  }

  return (
    <>
      {searchable && (
        <div className="dropdown-search">
          <span className="dropdown-search-icon">
            <SearchIcon />
          </span>
          <input
            autoFocus
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <div className="dropdown-list">
        <div className="dropdown-section">
          {filtered.map((item) => (
            <CheckRow key={item} label={item} checked={draft.includes(item)} onChange={() => toggle(item)} />
          ))}
        </div>
      </div>
      <div className="dropdown-footer">
        <button className="btn-apply" onClick={() => onApply(draft)}>
          Apply
        </button>
      </div>
    </>
  );
}

function MoreFiltersBody({
  roles,
  goals,
  industries,
  onApply,
}: {
  roles: string[];
  goals: string[];
  industries: string[];
  onApply: (v: { roles: string[]; goals: string[]; industries: string[] }) => void;
}) {
  const [draftRoles, setDraftRoles] = useState(roles);
  const [draftGoals, setDraftGoals] = useState(goals);
  const [draftIndustries, setDraftIndustries] = useState(industries);
  const [hovered, setHovered] = useState<"role" | "goal" | "industry" | null>(null);
  const [hoveredTop, setHoveredTop] = useState(0);

  useEffect(() => setDraftRoles(roles), [roles]);
  useEffect(() => setDraftGoals(goals), [goals]);
  useEffect(() => setDraftIndustries(industries), [industries]);

  function toggleIn(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  }

  return (
    <div className="cascading-menu" onMouseLeave={() => setHovered(null)}>
      <div className="cascading-root">
        <div className="dropdown-list">
          <SubmenuRow label="Role" count={draftRoles.length} active={hovered === "role"} onHover={(top) => { setHovered("role"); setHoveredTop(top); }} />
          <SubmenuRow label="Goal" count={draftGoals.length} active={hovered === "goal"} onHover={(top) => { setHovered("goal"); setHoveredTop(top); }} />
          <SubmenuRow label="Industry Preference" count={draftIndustries.length} active={hovered === "industry"} onHover={(top) => { setHovered("industry"); setHoveredTop(top); }} />
        </div>
        <div className="dropdown-footer">
          <button className="btn-apply" onClick={() => onApply({ roles: draftRoles, goals: draftGoals, industries: draftIndustries })}>
            Apply
          </button>
        </div>
      </div>

      {hovered && (
        <div className="cascading-sub" style={{ top: hoveredTop }} onMouseEnter={() => setHovered(hovered)}>
          <div className="dropdown-list">
            {hovered === "role" && (
              <div className="dropdown-section">
                {ROLES.map((r) => (
                  <CheckRow key={r} label={r} checked={draftRoles.includes(r)} onChange={() => toggleIn(draftRoles, setDraftRoles, r)} />
                ))}
              </div>
            )}
            {hovered === "goal" && (
              <div className="dropdown-section">
                {GOALS.map((g) => (
                  <CheckRow key={g} label={g} checked={draftGoals.includes(g)} onChange={() => toggleIn(draftGoals, setDraftGoals, g)} />
                ))}
              </div>
            )}
            {hovered === "industry" && (
              <div className="dropdown-section">
                {INDUSTRIES.map((i) => (
                  <CheckRow key={i} label={i} checked={draftIndustries.includes(i)} onChange={() => toggleIn(draftIndustries, setDraftIndustries, i)} />
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
  count,
  active,
  onHover,
}: {
  label: string;
  count: number;
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
    <button className={`dropdown-submenu-row ${active ? "active" : ""}`} onMouseEnter={handle} onFocus={handle}>
      <span className="dropdown-submenu-label">{label}</span>
      {count > 0 && <span className="dropdown-submenu-count">{count}</span>}
      <span className="dropdown-submenu-chevron"><ChevronRightIcon /></span>
    </button>
  );
}


function CheckRow({
  label,
  checked,
  onChange,
  draggable = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  draggable?: boolean;
}) {
  return (
    <button className="dropdown-item cols-row" onClick={onChange}>
      <span className={`checkbox ${checked ? "checked" : ""}`}>{checked && <CheckIcon />}</span>
      <span className="cols-row-label">{label}</span>
      {draggable && (
        <span className="cols-drag-handle" aria-hidden="true">
          <DragHandleIcon />
        </span>
      )}
    </button>
  );
}
