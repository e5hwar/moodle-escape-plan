import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCompanyBilling,
  TIERS,
  SUBSCRIPTION_STATUSES,
  COMPANY_INDUSTRIES,
  COMPANY_PARTNERSHIPS,
  type Company,
} from "../data/companies";
import { KeyCommandIcon, SearchIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;

/* One facet the bar can scope by. All four behave identically — a "Name:"
 * prefix puts the panel into selection mode, picking a value appends it to the
 * filter the Filters row also writes — so they are described as data rather
 * than repeated as four parallel branches. Order here IS the order of the
 * "Suggested filters" rows and of keyboard navigation. */
type Facet = {
  /** Label on the chip, the panel heading, and the "<label>:" typed prefix. */
  label: string;
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
  | { kind: "value"; facet: Facet; name: string }
  | { kind: "search" };

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
    return {
      tier: tally((c) => c.tier ?? ""),
      status: tally((c) => getCompanyBilling(c).status),
      industry: tally((c) => c.industry),
      partnership: tally((c) => c.partnership),
    };
  }, [companies]);

  const facets: Facet[] = [
    {
      label: "Tier",
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
      label: "Industry",
      example: "HVAC",
      desc: "Filter by Industry",
      plural: "industries",
      emptyHint: "Start typing an industry name…",
      values: COMPANY_INDUSTRIES,
      applied: appliedIndustries,
      onChange: onIndustriesChange,
      counts: counts.industry,
    },
    {
      label: "Partnership",
      example: "Preferred Partner",
      desc: "Filter by Partnership",
      plural: "partnerships",
      emptyHint: "All partnerships are already applied.",
      values: COMPANY_PARTNERSHIPS,
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

  // Options available to keyboard navigation, in render order.
  const optionCount = mode ? results.length : facets.length + (hasQuery ? 1 : 0);

  function optionAt(i: number): Opt | null {
    if (mode) return results[i] ? { kind: "value", facet: mode.facet, name: results[i] } : null;
    if (i < facets.length) return { kind: "facet", facet: facets[i] };
    if (i === facets.length && hasQuery) return { kind: "search" };
    return null;
  }

  // When the user has typed free text, preselect the "Search for…" row (the last
  // option) so pressing Enter searches immediately; arrowing moves the highlight off it.
  useEffect(() => {
    setActive(!inMode && hasQuery ? facets.length : -1);
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

  function activate(opt: Opt) {
    if (opt.kind === "facet") {
      setText(`${opt.facet.label}:`);
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "value") {
      addValue(opt.facet, opt.name);
    } else {
      commitSearch(companyQuery);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(optionCount - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
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
        <span className="usearch-kbd">
          <span className="kbd-cmd"><KeyCommandIcon /></span>
          <span className="kbd-letter">K</span>
        </span>
      </div>

      {open && (
        <div className="usearch-panel">
          {!mode && (
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
                <div className="usearch-empty">
                  {mode.query.trim()
                    ? `No ${mode.facet.plural} match “${mode.query.trim()}”.`
                    : mode.facet.emptyHint}
                </div>
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

          {!mode && hasQuery ? (
            <SearchForRow
              query={companyQuery.trim()}
              scope="Companies"
              active={active === facets.length}
              onHover={() => setActive(facets.length)}
              onClick={() => commitSearch(companyQuery)}
            />
          ) : (
            <SearchHints />
          )}
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
