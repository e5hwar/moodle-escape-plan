import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCompanyBilling,
  TIERS,
  SUBSCRIPTION_STATUSES,
  COMPANY_INDUSTRIES,
  type Company,
} from "../data/companies";
import { SearchIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;
const TIER_PREFIX = "Tier:";
const STATUS_PREFIX = "Status:";
const INDUSTRY_PREFIX = "Industry:";

type Opt =
  | { kind: "tier-filter" }
  | { kind: "status-filter" }
  | { kind: "industry-filter" }
  | { kind: "search" }
  | { kind: "tier"; name: string }
  | { kind: "status"; name: string }
  | { kind: "industry"; name: string };

export function CompaniesSearch({
  companies,
  tiers: appliedTiers,
  onTiersChange,
  statuses: appliedStatuses,
  onStatusesChange,
  industries: appliedIndustries,
  onIndustriesChange,
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
  query: string;
  onCommit: (q: string) => void;
}) {
  const [text, setText] = useState(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setText(query), [query]);

  const tierCounts = useMemo(() => {
    const m = new Map<string, number>();
    companies.forEach((c) => m.set(c.tier, (m.get(c.tier) ?? 0) + 1));
    return m;
  }, [companies]);

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    companies.forEach((c) => {
      const s = getCompanyBilling(c).status;
      m.set(s, (m.get(s) ?? 0) + 1);
    });
    return m;
  }, [companies]);

  const industryCounts = useMemo(() => {
    const m = new Map<string, number>();
    companies.forEach((c) => {
      if (c.industry) m.set(c.industry, (m.get(c.industry) ?? 0) + 1);
    });
    return m;
  }, [companies]);

  // Prefix detection (case-insensitive) puts the box into a filter-selection mode.
  const tierMatch = text.match(/^\s*tier:\s*(.*)$/i);
  const statusMatch = text.match(/^\s*status:\s*(.*)$/i);
  const industryMatch = text.match(/^\s*industry:\s*(.*)$/i);
  const inTierMode = tierMatch != null;
  const inStatusMode = !inTierMode && statusMatch != null;
  const inIndustryMode = !inTierMode && !inStatusMode && industryMatch != null;
  const inMode = inTierMode || inStatusMode || inIndustryMode;
  const tierQuery = tierMatch ? tierMatch[1] : "";
  const statusQuery = statusMatch ? statusMatch[1] : "";
  const industryQuery = industryMatch ? industryMatch[1] : "";
  const companyQuery = inMode ? "" : text;
  const hasQuery = companyQuery.trim().length > 0;

  const tierResults = useMemo(() => {
    const q = tierQuery.trim().toLowerCase();
    return TIERS.filter(
      (t) => !appliedTiers.includes(t) && t.toLowerCase().includes(q),
    ).slice(0, MAX_RESULTS);
  }, [tierQuery, appliedTiers]);

  const statusResults = useMemo(() => {
    const q = statusQuery.trim().toLowerCase();
    return SUBSCRIPTION_STATUSES.filter(
      (s) => !appliedStatuses.includes(s) && s.toLowerCase().includes(q),
    ).slice(0, MAX_RESULTS);
  }, [statusQuery, appliedStatuses]);

  const industryResults = useMemo(() => {
    const q = industryQuery.trim().toLowerCase();
    return COMPANY_INDUSTRIES.filter(
      (i) => !appliedIndustries.includes(i) && i.toLowerCase().includes(q),
    ).slice(0, MAX_RESULTS);
  }, [industryQuery, appliedIndustries]);

  // Options available to keyboard navigation, in render order.
  const optionCount = inTierMode
    ? tierResults.length
    : inStatusMode
      ? statusResults.length
      : inIndustryMode
        ? industryResults.length
        : 3 + (hasQuery ? 1 : 0);

  function optionAt(i: number): Opt | null {
    if (inTierMode) return tierResults[i] ? { kind: "tier", name: tierResults[i] } : null;
    if (inStatusMode) return statusResults[i] ? { kind: "status", name: statusResults[i] } : null;
    if (inIndustryMode) return industryResults[i] ? { kind: "industry", name: industryResults[i] } : null;
    if (i === 0) return { kind: "tier-filter" };
    if (i === 1) return { kind: "status-filter" };
    if (i === 2) return { kind: "industry-filter" };
    if (i === 3 && hasQuery) return { kind: "search" };
    return null;
  }

  // When the user has typed free text, preselect the "Search for…" row (the last
  // option) so pressing Enter searches immediately; arrowing moves the highlight off it.
  useEffect(() => {
    setActive(!inMode && hasQuery ? 3 : -1);
  }, [text, inMode, hasQuery]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function addTier(name: string) {
    onTiersChange(Array.from(new Set([...appliedTiers, name])));
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function addStatus(name: string) {
    onStatusesChange(Array.from(new Set([...appliedStatuses, name])));
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function addIndustry(name: string) {
    onIndustriesChange(Array.from(new Set([...appliedIndustries, name])));
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
    if (opt.kind === "tier-filter") {
      setText(TIER_PREFIX);
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "status-filter") {
      setText(STATUS_PREFIX);
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "industry-filter") {
      setText(INDUSTRY_PREFIX);
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "tier") {
      addTier(opt.name);
    } else if (opt.kind === "status") {
      addStatus(opt.name);
    } else if (opt.kind === "industry") {
      addIndustry(opt.name);
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
      if (inTierMode) {
        if (tierResults[0]) return addTier(tierResults[0]);
        return;
      }
      if (inStatusMode) {
        if (statusResults[0]) return addStatus(statusResults[0]);
        return;
      }
      if (inIndustryMode) {
        if (industryResults[0]) return addIndustry(industryResults[0]);
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
          placeholder="Search Companies"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <span className="usearch-kbd">
          <span className="kbd-cmd">⌘</span>
          <span className="kbd-letter">K</span>
        </span>
      </div>

      {open && (
        <div className="usearch-panel">
          {!inMode && (
            <>
              <div className="usearch-head">Suggested filters</div>
              <OptionRow active={active === 0} onHover={() => setActive(0)} onClick={() => activate({ kind: "tier-filter" })}>
                <span className="usearch-chip">Tier:</span>
                <span className="usearch-row-ex">Tier: Growth</span>
                <span className="usearch-row-desc">Filter Companies by Tier</span>
              </OptionRow>
              <OptionRow active={active === 1} onHover={() => setActive(1)} onClick={() => activate({ kind: "status-filter" })}>
                <span className="usearch-chip">Status:</span>
                <span className="usearch-row-ex">Status: Active</span>
                <span className="usearch-row-desc">Filter by Subscription Status</span>
              </OptionRow>
              <OptionRow active={active === 2} onHover={() => setActive(2)} onClick={() => activate({ kind: "industry-filter" })}>
                <span className="usearch-chip">Industry:</span>
                <span className="usearch-row-ex">Industry: HVAC</span>
                <span className="usearch-row-desc">Filter by Industry</span>
              </OptionRow>
            </>
          )}

          {inTierMode && (
            <>
              <div className="usearch-head">Tier</div>
              {tierResults.length === 0 ? (
                <div className="usearch-empty">
                  {tierQuery.trim() ? `No tiers match “${tierQuery.trim()}”.` : "All tiers are already applied."}
                </div>
              ) : (
                tierResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "tier", name })}>
                    <span className="usearch-chip">Tier:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{tierCounts.get(name) ?? 0} companies</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {inStatusMode && (
            <>
              <div className="usearch-head">Status</div>
              {statusResults.length === 0 ? (
                <div className="usearch-empty">
                  {statusQuery.trim() ? `No statuses match “${statusQuery.trim()}”.` : "All statuses are already applied."}
                </div>
              ) : (
                statusResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "status", name })}>
                    <span className="usearch-chip">Status:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{statusCounts.get(name) ?? 0} companies</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {inIndustryMode && (
            <>
              <div className="usearch-head">Industry</div>
              {industryResults.length === 0 ? (
                <div className="usearch-empty">
                  {industryQuery.trim() ? `No industries match “${industryQuery.trim()}”.` : "Start typing an industry name…"}
                </div>
              ) : (
                industryResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "industry", name })}>
                    <span className="usearch-chip">Industry:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{industryCounts.get(name) ?? 0} companies</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {!inMode && hasQuery ? (
            <SearchForRow
              query={companyQuery.trim()}
              scope="Companies"
              active={active === 3}
              onHover={() => setActive(3)}
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
