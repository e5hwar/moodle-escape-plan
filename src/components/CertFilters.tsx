import { useEffect, useMemo, useState } from "react";
import { Dropdown } from "./Dropdown";
import { SearchIcon, EditColumnsIcon } from "./icons";
import { PillTrigger, summarize, SectionedMultiSelect, CheckRow } from "./Filters";
import { industries } from "../data/industries";
import { CREATED_BY_IN_HOUSE, CREATED_BY_B2B } from "../data/filters";
import {
  CAREER_STAGES,
  CERT_TYPES,
  CERT_VISIBILITIES,
  NO_CAREER_STAGE,
  NO_TYPE,
  CERT_OPTIONAL_COLUMNS,
  CERT_FIXED_COLUMNS,
  type CertColumn,
} from "../data/certifications";

export type CertFilterState = {
  industries: string[];
  careerStages: string[];
  types: string[];
  creators: string[];
  visibilities: string[];
  // Free-text filters live under "More filters".
  ceu: string;
  keyword: string;
};

export type CertColumnState = Record<CertColumn, boolean>;

type Props = {
  filters: CertFilterState;
  setFilters: (next: CertFilterState) => void;
};

export function CertFilters({ filters, setFilters }: Props) {
  const moreCount =
    (filters.ceu.trim() ? 1 : 0) + (filters.keyword.trim() ? 1 : 0);

  function clearAll() {
    setFilters({
      industries: [],
      careerStages: [],
      types: [],
      creators: [],
      visibilities: [],
      ceu: "",
      keyword: "",
    });
  }

  return (
    <div className="filters">
      <IndustryPill
        value={filters.industries}
        onApply={(v) => setFilters({ ...filters, industries: v })}
      />
      <CareerStagePill
        value={filters.careerStages}
        onApply={(v) => setFilters({ ...filters, careerStages: v })}
      />
      <TypePill
        value={filters.types}
        onApply={(v) => setFilters({ ...filters, types: v })}
      />
      <CreatedByPill
        value={filters.creators}
        onApply={(v) => setFilters({ ...filters, creators: v })}
      />
      <VisibilityPill
        value={filters.visibilities}
        onApply={(v) => setFilters({ ...filters, visibilities: v })}
      />
      <MoreFiltersPill
        ceu={filters.ceu}
        keyword={filters.keyword}
        count={moreCount}
        onApply={(v) => setFilters({ ...filters, ceu: v.ceu, keyword: v.keyword })}
      />
      <button className="filter-clear-link" onClick={clearAll}>
        Clear filters
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

// Industry options derived from the Industries page data: each Industry plus
// its Sub-Industries (stored as "Industry › Sub" paths to match cert tagging).
type IndustryOption = { value: string; label: string; sub: boolean };

const INDUSTRY_GROUPS: { industry: string; options: IndustryOption[] }[] = [
  ...industries,
]
  .sort((a, b) => a.displayPosition - b.displayPosition)
  .map((ind) => ({
    industry: ind.name,
    options: [
      { value: ind.name, label: ind.name, sub: false },
      ...[...ind.subIndustries]
        .sort((a, b) => a.displayPosition - b.displayPosition)
        .map((s) => ({
          value: `${ind.name} › ${s.name}`,
          label: s.name,
          sub: true,
        })),
    ],
  }));

const ALL_INDUSTRY_VALUES = INDUSTRY_GROUPS.flatMap((g) =>
  g.options.map((o) => o.value),
);

function IndustryPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, ALL_INDUSTRY_VALUES);
  return (
    <Dropdown
      width={300}
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
        <IndustryMultiSelect
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

function IndustryMultiSelect({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(value);
  const [query, setQuery] = useState("");

  useEffect(() => setDraft(value), [value]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDUSTRY_GROUPS;
    return INDUSTRY_GROUPS.map((g) => ({
      ...g,
      options: g.options.filter(
        (o) =>
          o.value.toLowerCase().includes(q) ||
          o.label.toLowerCase().includes(q),
      ),
    })).filter((g) => g.options.length > 0);
  }, [query]);

  function toggle(item: string) {
    setDraft((d) =>
      d.includes(item) ? d.filter((x) => x !== item) : [...d, item],
    );
  }

  return (
    <>
      <div className="dropdown-search">
        <span className="dropdown-search-icon">
          <SearchIcon />
        </span>
        <input
          placeholder="Search industries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="dropdown-list">
        {groups.map((g) => (
          <div key={g.industry} className="dropdown-section">
            {g.options.map((o) => (
              <div key={o.value} className={o.sub ? "cert-ind-suboption" : ""}>
                <CheckRow
                  label={o.label}
                  checked={draft.includes(o.value)}
                  onChange={() => toggle(o.value)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="dropdown-footer">
        <button className="btn-apply" onClick={() => onApply(draft)}>
          Apply
        </button>
      </div>
    </>
  );
}

function CareerStagePill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const all = [...CAREER_STAGES, NO_CAREER_STAGE];
  const summary = summarize(value, all);
  return (
    <Dropdown
      width={240}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Career Stage"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...CAREER_STAGES] }, { items: [NO_CAREER_STAGE] }]}
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

function TypePill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const all = [...CERT_TYPES, NO_TYPE];
  const summary = summarize(value, all);
  return (
    <Dropdown
      width={240}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Type"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...CERT_TYPES] }, { items: [NO_TYPE] }]}
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

function CreatedByPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const all = [...CREATED_BY_IN_HOUSE, ...CREATED_BY_B2B];
  const summary = summarize(value, all);
  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Created By"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[
            { label: "Made in house", items: CREATED_BY_IN_HOUSE },
            { label: "B2B customers", items: [...CREATED_BY_B2B].sort() },
          ]}
          subsectionStyle
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable
          searchPlaceholder="Search creators…"
        />
      )}
    </Dropdown>
  );
}

function VisibilityPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, CERT_VISIBILITIES);
  return (
    <Dropdown
      width={220}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Visibility"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
        />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...CERT_VISIBILITIES] }]}
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

function MoreFiltersPill({
  ceu,
  keyword,
  count,
  onApply,
}: {
  ceu: string;
  keyword: string;
  count: number;
  onApply: (v: { ceu: string; keyword: string }) => void;
}) {
  const summary = count > 0 ? `${count} active` : null;
  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More filters"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply({ ceu: "", keyword: "" })}
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          ceu={ceu}
          keyword={keyword}
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
  ceu,
  keyword,
  onApply,
}: {
  ceu: string;
  keyword: string;
  onApply: (v: { ceu: string; keyword: string }) => void;
}) {
  const [draftCeu, setDraftCeu] = useState(ceu);
  const [draftKw, setDraftKw] = useState(keyword);

  useEffect(() => setDraftCeu(ceu), [ceu]);
  useEffect(() => setDraftKw(keyword), [keyword]);

  function apply() {
    onApply({ ceu: draftCeu.trim(), keyword: draftKw.trim() });
  }

  return (
    <>
      <div className="dropdown-list cert-morefilters">
        <div className="cert-morefilter-field">
          <label className="cert-morefilter-label">CEUs</label>
          <input
            className="cert-morefilter-input"
            inputMode="decimal"
            placeholder="e.g. 1.5"
            value={draftCeu}
            // Numbers only — an open textbox that accepts a CEU threshold.
            onChange={(e) => setDraftCeu(e.target.value.replace(/[^0-9.]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && apply()}
          />
          <div className="cert-morefilter-help">
            Shows certifications with at least this many CEUs.
          </div>
        </div>
        <div className="cert-morefilter-field">
          <label className="cert-morefilter-label">Keyword</label>
          <input
            className="cert-morefilter-input"
            placeholder="Search keywords…"
            value={draftKw}
            onChange={(e) => setDraftKw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
          />
          <div className="cert-morefilter-help">
            Matches certifications tagged with this keyword.
          </div>
        </div>
      </div>
      <div className="dropdown-footer">
        <button className="btn-apply" onClick={apply}>
          Apply
        </button>
      </div>
    </>
  );
}

/* ──────────── Edit Columns ──────────── */

export function CertEditColumnsButton({
  columns,
  setColumns,
}: {
  columns: CertColumnState;
  setColumns: (c: CertColumnState) => void;
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
      {() => <CertColumnsBody value={columns} onApply={(c) => setColumns(c)} />}
    </Dropdown>
  );
}

function CertColumnsBody({
  value,
  onApply,
}: {
  value: CertColumnState;
  onApply: (v: CertColumnState) => void;
}) {
  const active = CERT_OPTIONAL_COLUMNS.filter((c) => value[c.key]);
  const available = CERT_OPTIONAL_COLUMNS.filter((c) => !value[c.key]);
  return (
    <div className="dropdown-list cols-menu">
      <div className="dropdown-section">
        <div className="dropdown-section-label">Fixed columns</div>
        {CERT_FIXED_COLUMNS.map(({ label }) => (
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
