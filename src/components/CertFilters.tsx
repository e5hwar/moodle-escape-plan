import { useMemo } from "react";
import { Dropdown } from "./Dropdown";
import { EditColumnsIcon } from "./icons";
import {
  PillTrigger,
  summarize,
  SectionedMultiSelect,
  CascadingMultiSelect,
  CreatedByPill,
  CheckRow,
} from "./Filters";
import { industries } from "../data/industries";
import { TAG_GROUPS } from "../data/filters";
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
  // Everything below lives under "More Filters".
  visibilities: string[];
  tags: string[];
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
    filters.visibilities.length +
    filters.tags.length +
    (filters.ceu.trim() ? 1 : 0) +
    (filters.keyword.trim() ? 1 : 0);

  const hasFilters =
    filters.industries.length +
      filters.careerStages.length +
      filters.types.length +
      filters.creators.length +
      moreCount >
    0;

  function clearAll() {
    setFilters({
      industries: [],
      careerStages: [],
      types: [],
      creators: [],
      visibilities: [],
      tags: [],
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
      <MoreFiltersPill
        visibilities={filters.visibilities}
        tags={filters.tags}
        ceu={filters.ceu}
        keyword={filters.keyword}
        count={moreCount}
        onApply={(v) => setFilters({ ...filters, ...v })}
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

/* Industry options come from the Industries page data: every Industry followed
   by its Sub-Industries. Sub-Industries aren't indented — each reads as its own
   full path ("HVAC › Residential HVAC"), which is also how certs store them, so
   one flat searchable list covers both levels (Figma 774:1243). */
const INDUSTRY_OPTIONS: string[] = [...industries]
  .sort((a, b) => a.displayPosition - b.displayPosition)
  .flatMap((ind) => [
    ind.name,
    ...[...ind.subIndustries]
      .sort((a, b) => a.displayPosition - b.displayPosition)
      .map((sub) => `${ind.name} › ${sub.name}`),
  ]);

function IndustryPill({
  value,
  onApply,
}: {
  value: string[];
  onApply: (v: string[]) => void;
}) {
  const summary = summarize(value, INDUSTRY_OPTIONS);
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
        <SectionedMultiSelect
          sections={[{ items: INDUSTRY_OPTIONS }]}
          value={value}
          onApply={(v) => {
            onApply(v);
            close();
          }}
          searchable
          searchPlaceholder="Search Industries/Sub-Industries…"
        />
      )}
    </Dropdown>
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
          sections={[{ items: [...CAREER_STAGES, NO_CAREER_STAGE] }]}
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
          sections={[{ items: [...CERT_TYPES, NO_TYPE] }]}
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

type MoreFilters = {
  visibilities: string[];
  tags: string[];
  ceu: string;
  keyword: string;
};

function MoreFiltersPill({
  visibilities,
  tags,
  ceu,
  keyword,
  count,
  onApply,
}: MoreFilters & {
  count: number;
  onApply: (v: MoreFilters) => void;
}) {
  const summary = count > 0 ? `${count} Active` : null;
  return (
    <Dropdown
      width={260}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() =>
            onApply({ visibilities: [], tags: [], ceu: "", keyword: "" })
          }
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          visibilities={visibilities}
          tags={tags}
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

/* The Tasks page's cascading More Filters menu, with the two free-text
   certification filters (CEUs, Keyword) as text submenus. */
function MoreFiltersBody({
  visibilities,
  tags,
  ceu,
  keyword,
  onApply,
}: MoreFilters & { onApply: (v: MoreFilters) => void }) {
  const value = useMemo(() => ({ visibilities, tags }), [visibilities, tags]);
  const texts = useMemo(() => ({ ceu, keyword }), [ceu, keyword]);

  return (
    <CascadingMultiSelect
      sections={[
        {
          key: "visibilities",
          label: "Visibility",
          groups: [{ items: [...CERT_VISIBILITIES] }],
        },
        {
          key: "tags",
          label: "Audience/B2B Tags",
          groups: TAG_GROUPS.map((g) => ({ label: g.label, items: [...g.tags] })),
        },
        {
          key: "ceu",
          label: "CEUs",
          text: {
            placeholder: "e.g. 1.5",
            help: "Shows certifications with at least this many CEUs.",
            numeric: true,
          },
        },
        {
          key: "keyword",
          label: "Keyword",
          text: {
            placeholder: "Search Keywords…",
            help: "Matches certifications tagged with this keyword.",
          },
        },
      ]}
      value={value}
      texts={texts}
      onApply={(v, t) =>
        onApply({
          visibilities: v.visibilities,
          tags: v.tags,
          ceu: t.ceu ?? "",
          keyword: t.keyword ?? "",
        })
      }
    />
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
  // Available columns read alphabetically — it is a lookup list, not an
  // ordering (see ColumnsBody in Filters.tsx).
  const active = CERT_OPTIONAL_COLUMNS.filter((c) => value[c.key]);
  const available = CERT_OPTIONAL_COLUMNS.filter((c) => !value[c.key]).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
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
