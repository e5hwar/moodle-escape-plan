import { useMemo } from "react";
import { Dropdown } from "./Dropdown";
import { FILTER_TIPS } from "../data/filterTips";
import {
  PillTrigger,
  summarize,
  SectionedMultiSelect,
  CascadingMultiSelect,
  CreatedByPill,
} from "./Filters";
import { industryTagLabels, industryTagOptions, useLiveIndustries } from "../data/industries";
import { TAG_GROUPS, matchesTagFilter } from "../data/filters";
import {
  CAREER_STAGES,
  CERT_TYPES,
  CERT_VISIBILITIES,
  NO_CAREER_STAGE,
  NO_TYPE,
  type CertColumn,
  type Certification,
} from "../data/certifications";

export type CertFilterState = {
  industries: string[];
  careerStages: string[];
  types: string[];
  creators: string[];
  // Everything below lives under "More Filters".
  visibilities: string[];
  tags: string[];
  /** "Incomplete" / "Complete": whether the Certification still has
   *  post-creation setup steps (Industries, Content Links, Award, Feedback
   *  Form) left. The landing banner's "Show All N" applies Incomplete. The
   *  status itself is derived in App.tsx, so `certMatches` leaves this one to
   *  the page (`setupMatches`). */
  setup: string[];
};

export const SETUP_FILTER_OPTIONS = ["Incomplete", "Complete"] as const;

/** The Setup filter's half of `certMatches`, given whether the Certification
 *  still counts as pending (steps left, not marked done). Both options
 *  selected = everything. */
export function setupMatches(pending: boolean, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return selected.includes(pending ? "Incomplete" : "Complete");
}

export type CertColumnState = Record<CertColumn, boolean>;

/* An Industry option is a top-level Industry or an "Industry › Sub-Industry"
   label, and matches only Certifications carrying exactly that tag — tagging
   a Sub-Industry does not tag its parent (the backend tagging model). */
function matchesIndustry(cert: Certification, selected: string[]): boolean {
  const labels = industryTagLabels(cert.industries);
  return selected.some((opt) => labels.includes(opt));
}

/** Whether a Certification passes the search query and every filter — the one
 *  rule behind the Certifications table and any picker that reuses its search
 *  bar and filter row (Create Spotlight's Find a Deep Link). */
export function certMatches(c: Certification, query: string, filters: CertFilterState): boolean {
  const q = query.trim().toLowerCase();
  if (q && !(
    c.id.toLowerCase().includes(q) ||
    c.name.toLowerCase().includes(q) ||
    industryTagLabels(c.industries).some((l) => l.toLowerCase().includes(q))
  )) return false;
  if (filters.industries.length && !matchesIndustry(c, filters.industries)) return false;
  if (filters.careerStages.length) {
    const match = c.careerStage
      ? filters.careerStages.includes(c.careerStage)
      : filters.careerStages.includes(NO_CAREER_STAGE);
    if (!match) return false;
  }
  if (filters.types.length) {
    const match = c.type ? filters.types.includes(c.type) : filters.types.includes(NO_TYPE);
    if (!match) return false;
  }
  if (filters.creators.length && !filters.creators.includes(c.createdBy)) return false;
  if (filters.visibilities.length && !filters.visibilities.includes(c.visibility ?? "Visible")) return false;
  if (filters.tags.length && !matchesTagFilter(c.tags, filters.tags)) return false;
  return true;
}

type Props = {
  filters: CertFilterState;
  setFilters: (next: CertFilterState) => void;
};

export function CertFilters({ filters, setFilters }: Props) {
  // Setup lives under More Filters like Visibility and Tags, so it counts there.
  const moreCount = filters.visibilities.length + filters.tags.length + filters.setup.length;

  const hasFilters =
    filters.industries.length +
      filters.careerStages.length +
      filters.types.length +
      filters.creators.length +
      filters.setup.length +
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
      setup: [],
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
        setup={filters.setup}
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

/* Industry options come from the live Industries (the Industries page edits
   them): every Industry followed by its Sub-Industries. Sub-Industries aren't
   indented — each reads as its own full path ("HVAC › Residential"), so one
   flat searchable list covers both levels (Figma 774:1243). */

/** Exported for pickers that reuse the Certifications filter row (Add
 *  Triggers / Add Requirement); `tip` swaps in the picker's own hover line. */
export function IndustryPill({
  value,
  onApply,
  tip = FILTER_TIPS.certifications.industry,
}: {
  value: string[];
  onApply: (v: string[]) => void;
  tip?: string;
}) {
  const inds = useLiveIndustries();
  const INDUSTRY_OPTIONS = useMemo(() => industryTagOptions(inds).map((o) => o.label), [inds]);
  const summary = summarize(value, INDUSTRY_OPTIONS);
  return (
    <Dropdown
      width={300}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="Industries"
          value={summary}
          open={open}
          toggle={toggle}
          onClear={() => onApply([])}
          tip={tip}
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
          searchPlaceholder="Search Industries/Sub-Industries..."
        />
      )}
    </Dropdown>
  );
}

/** Exported for pickers that reuse the Certifications filter row (Add
 *  Triggers / Add Requirement); `tip` swaps in the picker's own hover line. */
export function CareerStagePill({
  value,
  onApply,
  tip = FILTER_TIPS.certifications.careerStage,
}: {
  value: string[];
  onApply: (v: string[]) => void;
  tip?: string;
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
          tip={tip}
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

/** Exported for pickers that reuse the Certifications filter row (Add
 *  Triggers / Add Requirement); `tip` swaps in the picker's own hover line. */
export function TypePill({
  value,
  onApply,
  tip = FILTER_TIPS.certifications.type,
}: {
  value: string[];
  onApply: (v: string[]) => void;
  tip?: string;
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
          tip={tip}
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
  setup: string[];
};

function MoreFiltersPill({
  visibilities,
  tags,
  setup,
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
          onClear={() => onApply({ visibilities: [], tags: [], setup: [] })}
        />
      )}
    >
      {({ close }) => (
        <MoreFiltersBody
          visibilities={visibilities}
          tags={tags}
          setup={setup}
          onApply={(v) => {
            onApply(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

/* The Tasks page's cascading More Filters menu. The CEUs and Keyword free-text
   submenus were removed 2026-09-09 (user request) — the CEUs column and the
   wizard's keywords field are untouched, only the filters are gone. */
function MoreFiltersBody({
  visibilities,
  tags,
  setup,
  onApply,
}: MoreFilters & { onApply: (v: MoreFilters) => void }) {
  const value = useMemo(() => ({ visibilities, tags, setup }), [visibilities, tags, setup]);

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
        // Post-creation setup — the same option the landing banner's "Show
        // All N" applies, reachable without the banner.
        {
          key: "setup",
          label: "Setup",
          groups: [{ items: [...SETUP_FILTER_OPTIONS] }],
        },
      ]}
      value={value}
      onApply={(v) => onApply({ visibilities: v.visibilities, tags: v.tags, setup: v.setup ?? [] })}
    />
  );
}
