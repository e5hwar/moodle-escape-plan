import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCompanyBilling,
  TIERS,
  SUBSCRIPTION_STATUSES,
  INDUSTRY_FILTER_OPTIONS,
  PARTNERSHIP_FILTER_OPTIONS,
  NO_INDUSTRY,
  NO_PARTNERSHIP,
  type Company,
} from "../data/companies";
import { KeyCommandIcon, SearchClearIcon, SearchIcon } from "./icons";
import { SearchHints, stepActive, SearchNoResults, suggestFilters, SuggestionRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;

/* One facet the bar can scope by. All four behave identically — a "Name:"
 * prefix puts the panel into selection mode, picking a value appends it to the
 * filter the Filters row also writes — so they are described as data rather
 * than repeated as four parallel branches. Order here IS the order of the
 * "Suggested filters" rows and of keyboard navigation. */
type Facet = {
  /** Label on the chip, the panel heading, and the "<label>:" typed prefix. */
  label: string;
  /** What one value is, on a typed suggestion's right ("Industry"). */
  kind: string;
  /** Sample value shown on the suggested-filter row ("Tier: Growth"). */
  example: string;
  desc: string;
  /** Plural noun for the "No <plural> match …" empty state. */
  plural: string;
  /** Empty state when the query is blank — long lists ask the user to type. */
  emptyHint: string;
  values: readonly string[];
  applied: string[];
  onChange: (next: string[]) => void;
  counts: Map<string, number>;
};

type Opt =
  | { kind: "facet"; facet: Facet }
  | { kind: "value"; facet: Facet; name: string };

export function CompaniesSearch({
  companies,
  tiers: appliedTiers,
  onTiersChange,
  statuses: appliedStatuses,
  onStatusesChange,
  industries: appliedIndustries,
  onIndustriesChange,
  partnerships: appliedPartnerships,
  onPartnershipsChange,
  query,
  onCommit,
}: {
  companies: Company[];
  /** Filters currently applied to the table (shared with the Filters row). */
  tiers: string[];
  onTiersChange: (next: string[]) => void;
  statuses: string[];
  onStatusesChange: (next: string[]) => void;
  industries: string[];
  onIndustriesChange: (next: string[]) => void;
  partnerships: string[];
  onPartnershipsChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
}) {
  const [text, setText] = useState(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setText(query), [query]);

  // "N companies" per value, on the rows. Status comes from derived billing, so
  // it is counted the same way the table renders it.
  const counts = useMemo(() => {
    const tally = (pick: (c: Company) => string) => {
      const m = new Map<string, number>();
      companies.forEach((c) => {
        const v = pick(c);
        if (v) m.set(v, (m.get(v) ?? 0) + 1);
      });
      return m;
    };
    /* Multi-value fields (Industry, Partnership) count a company under EVERY
       value it carries, which is what the facet filter matches on — so the
       counts can total more than the company count, and a company with none
       is counted under the "None" option. */
    const tallyAll = (pick: (c: Company) => string[], none: string) => {
      const m = new Map<string, number>();
      companies.forEach((c) => {
        const vs = pick(c).filter(Boolean);
        (vs.length ? vs : [none]).forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
      });
      return m;
    };
    return {
      tier: tally((c) => c.tier ?? ""),
      status: tally((c) => getCompanyBilling(c).status),
      industry: tallyAll((c) => c.industry, NO_INDUSTRY),
      partnership: tallyAll((c) => c.partnership, NO_PARTNERSHIP),
    };
  }, [companies]);

  const facets: Facet[] = [
    {
      label: "Tier",
      kind: "Tier",
      example: "Growth",
      desc: "Filter Companies by Tier",
      plural: "tiers",
      emptyHint: "All tiers are already applied.",
      values: TIERS,
      applied: appliedTiers,
      onChange: onTiersChange,
      counts: counts.tier,
    },
    {
      label: "Status",
      kind: "Status",
      example: "Active",
      desc: "Filter by Subscription Status",
      plural: "statuses",
      emptyHint: "All statuses are already applied.",
      values: SUBSCRIPTION_STATUSES,
      applied: appliedStatuses,
      onChange: onStatusesChange,
      counts: counts.status,
    },
    {
      label: "Industries",
      kind: "Industry",
      example: "HVAC",
      desc: "Filter by Industries",
      plural: "industries",
      emptyHint: "Start typing an industry name…",
      values: INDUSTRY_FILTER_OPTIONS,
      applied: appliedIndustries,
      onChange: onIndustriesChange,
      counts: counts.industry,
    },
    {
      label: "Partnership",
      kind: "Partnership",
      example: "Preferred Partner",
      desc: "Filter by Partnership",
      plural: "partnerships",
      emptyHint: "All partnerships are already applied.",
      values: PARTNERSHIP_FILTER_OPTIONS,
      applied: appliedPartnerships,
      onChange: onPartnershipsChange,
      counts: counts.partnership,
    },
  ];

  // A leading "<Label>:" (case-insensitive) puts the box into that facet's
  // selection mode; anything else is free text for the table.
  const prefix = /^\s*([A-Za-z]+):\s*(.*)$/.exec(text);
  const prefixed = prefix
    ? facets.find((f) => f.label.toLowerCase() === prefix[1].toLowerCase())
    : undefined;
  const mode = prefixed && prefix ? { facet: prefixed, query: prefix[2] } : null;
  const inMode = mode != null;

  const companyQuery = inMode ? "" : text;
  const hasQuery = companyQuery.trim().length > 0;

  const results = mode
    ? mode.facet.values
        .filter(
          (v) =>
            !mode.facet.applied.includes(v) &&
            v.toLowerCase().includes(mode.query.trim().toLowerCase()),
        )
        .slice(0, MAX_RESULTS)
    : [];

  /* Free text: every facet's values it matches, in facet order (1542:2130).
     None → no panel; Enter searches the text as typed. */
  const suggestions = mode
    ? []
    : suggestFilters(
        companyQuery,
        facets.map((f) => ({ kind: f.kind, chip: `${f.label}:`, values: f.values, exclude: f.applied })),
        MAX_RESULTS,
      );
  const facetOfKind = (kind: string) => facets.find((f) => f.kind === kind)!;
  const showPanel = open && !(!mode && hasQuery && suggestions.length === 0);

  // Options available to keyboard navigation, in render order.
  const optionCount = mode ? results.length : hasQuery ? suggestions.length : facets.length;

  function optionAt(i: number): Opt | null {
    if (mode) return results[i] ? { kind: "value", facet: mode.facet, name: results[i] } : null;
    if (hasQuery) {
      const sg = suggestions[i];
      return sg ? { kind: "value", facet: facetOfKind(sg.kind), name: sg.name } : null;
    }
    if (i < facets.length) return { kind: "facet", facet: facets[i] };
    return null;
  }

  // Typing puts the caret back in the bar — Enter there searches the text.
  useEffect(() => {
    setActive(-1);
  }, [text, inMode, hasQuery, facets.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function addValue(facet: Facet, name: string) {
    facet.onChange(Array.from(new Set([...facet.applied, name])));
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function commitSearch(q: string) {
    onCommit(q);
    setOpen(false);
  }

  /* The ✕ that takes the ⌘K badge's place once there is something to clear:
     drops the typed text AND the committed query, so the table goes back to
     unsearched in one hit. Applied filter pills stay the Filters row's to
     clear — the bar only owns the query. */
  function clearSearch() {
    setText("");
    setActive(-1);
    setOpen(false);
    /* Only re-commit when there IS a committed query to drop. Pages wire
       onCommit to their landing morph, so an unconditional call would shove
       the page out of its landing view just for clearing typed text. */
    if (query) onCommit("");
  }

  function activate(opt: Opt) {
    if (opt.kind === "facet") {
      setText(`${opt.facet.label}:`);
      setActive(-1);
      inputRef.current?.focus();
    } else {
      addValue(opt.facet, opt.name);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => stepActive(a, optionCount, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => stepActive(a, optionCount, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) {
        const opt = optionAt(active);
        if (opt) return activate(opt);
      }
      if (mode) {
        if (results[0]) return addValue(mode.facet, results[0]);
        return;
      }
      commitSearch(companyQuery);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder="Search Companies..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {/* Figma 902:3585 "Text Entered": the moment there is something to
            clear, the ⌘K badge gives way to a ✕ that clears on click. */}
        {text || query ? (
          <button
            type="button"
            className="usearch-clear"
            aria-label="Clear search"
            title="Clear search"
            /* Keep the input focused — clearing should not close the panel. */
            onMouseDown={(e) => e.preventDefault()}
            onClick={clearSearch}
          >
            <SearchClearIcon />
          </button>
        ) : (
          <span className="usearch-kbd">
            <span className="kbd-cmd"><KeyCommandIcon /></span>
            <span className="kbd-letter">K</span>
          </span>
        )}
      </div>

      {showPanel && (
        <div className="usearch-panel">
          {!mode && hasQuery && (
            <>
              <div className="usearch-head">Suggested filters</div>
              {suggestions.map((sg, i) => (
                <SuggestionRow
                  key={sg.kind + sg.name}
                  suggestion={sg}
                  active={active === i}
                  onHover={() => setActive(i)}
                  onClick={() => addValue(facetOfKind(sg.kind), sg.name)}
                />
              ))}
            </>
          )}

          {!mode && !hasQuery && (
            <>
              <div className="usearch-head">Suggested filters</div>
              {facets.map((facet, i) => (
                <OptionRow
                  key={facet.label}
                  active={active === i}
                  onHover={() => setActive(i)}
                  onClick={() => activate({ kind: "facet", facet })}
                >
                  <span className="usearch-chip">{facet.label}:</span>
                  <span className="usearch-row-ex">{facet.label}: {facet.example}</span>
                  <span className="usearch-row-desc">{facet.desc}</span>
                </OptionRow>
              ))}
            </>
          )}

          {mode && (
            <>
              <div className="usearch-head">{mode.facet.label}</div>
              {results.length === 0 ? (
                <>{mode.query.trim() ? <SearchNoResults /> : <div className="usearch-empty">{mode.facet.emptyHint}</div>}</>
              ) : (
                results.map((name, i) => (
                  <OptionRow
                    key={name}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => activate({ kind: "value", facet: mode.facet, name })}
                  >
                    <span className="usearch-chip">{mode.facet.label}:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">
                      {mode.facet.counts.get(name) ?? 0} companies
                    </span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          <SearchHints />
        </div>
      )}
    </div>
  );
}

function OptionRow({
  active,
  onHover,
  onClick,
  children,
}: {
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`usearch-row ${active ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
