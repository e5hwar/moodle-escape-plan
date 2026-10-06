import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "../data/users";
import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchScopeChip, stepActive, SearchNoResults, suggestFilters, SuggestionRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;

/** One "suggested filter" offered by the search bar — the `Company:` row on the
 *  Users and Who Paid pages, `Quiz:` / `Certification:` on Quiz Attempts.
 *  Picking values inside the bar builds a PENDING scope; Enter moves them into
 *  the page's matching Filters-row pill (`applied`), which is what the table
 *  actually filters on. */
export type SearchScope = {
  /** The chip text and the prefix the user types — "Company" ⇒ "company:". */
  token: string;
  /** Singular noun for the empty-state prompt when the token is plural
   *  ("Industries" ⇒ "industry"). Defaults to the lowercased token. */
  noun?: string;
  /** Everything selectable under this scope. */
  options: string[];
  /** Values the matching Filters-row pill already has applied. */
  applied: string[];
  onAppliedChange: (next: string[]) => void;
  /** Heading over the option list once in scope mode ("Companies"). */
  optionsLabel: string;
  /** The greyed example on the suggested row ("Company: Acme Inc."). */
  example: string;
  /** What the suggested row promises ("Filter by Company"). */
  hint: string;
  /** Right-hand note per option ("12 users"). */
  describe?: (name: string) => string | undefined;
};

/** What a suggested value is, as the row's right-hand label: the scope's noun
 *  in title case ("industry" ⇒ "Industry"), else its token. */
function kindOf(scope: SearchScope): string {
  return scope.noun ? scope.noun.replace(/\b\w/g, (c) => c.toUpperCase()) : scope.token;
}

/** The shared page search: a combobox bar with a suggested-filters panel, used
 *  by Users, Who Paid (quiz + certification) and Quiz Attempts. Commit-on-Enter
 *  — the table only ever filters on the applied query. */
export function EntitySearch({
  scopes,
  placeholder,
  query,
  onCommit,
}: {
  scopes: SearchScope[];
  placeholder: string;
  query: string;
  onCommit: (q: string) => void;
}) {
  const [text, setText] = useState(query);
  // The search bar builds a *pending* search; nothing hits the table until Enter.
  // `draft` holds only values picked in THIS search session (not yet applied),
  // keyed by scope token. On Enter they move into that scope's applied filter.
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the bar showing the applied query when it changes from outside
  // (Clear Filters, a preset, the ✕ on another control).
  useEffect(() => setText(query), [query]);

  const drafted = useMemo(
    () => scopes.map((s) => ({ scope: s, values: draft[s.token] ?? [] })).filter((d) => d.values.length > 0),
    [scopes, draft],
  );
  const scoped = drafted.length > 0;
  const scopeLabel = (() => {
    const all = drafted.flatMap((d) => d.values);
    if (all.length === 1) return all[0];
    const noun = drafted.length === 1 ? drafted[0].scope.optionsLabel.toLowerCase() : "filters";
    return `${all.length} ${noun}`;
  })();

  // A "<token>:" prefix puts us in that scope's selection mode (case-insensitive).
  const mode = useMemo(() => {
    for (const s of scopes) {
      const m = text.match(new RegExp(`^\\s*${s.token}:\\s*(.*)$`, "i"));
      if (m) return { scope: s, query: m[1] };
    }
    return null;
  }, [scopes, text]);
  const userQuery = mode ? "" : text;

  const scopeResults = useMemo(() => {
    if (!mode) return [];
    const q = mode.query.trim().toLowerCase();
    const picked = draft[mode.scope.token] ?? [];
    return mode.scope.options
      .filter((o) => !picked.includes(o) && !mode.scope.applied.includes(o) && o.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [mode, draft]);

  /* Free text: every scope's values it matches, in scope order (1542:2130).
     None → no panel; Enter searches the text as typed. */
  const hasQuery = !mode && userQuery.trim() !== "";
  const suggestions = useMemo(
    () =>
      hasQuery
        ? suggestFilters(
            userQuery,
            scopes.map((sc) => ({
              kind: kindOf(sc),
              chip: `${sc.token}:`,
              values: sc.options,
              exclude: [...sc.applied, ...(draft[sc.token] ?? [])],
            })),
            MAX_RESULTS,
          )
        : [],
    [hasQuery, userQuery, scopes, draft],
  );
  const scopeOfKind = (kind: string) => scopes.find((sc) => kindOf(sc) === kind)!;
  const showPanel = open && !(hasQuery && suggestions.length === 0);

  const optionCount = mode ? scopeResults.length : hasQuery ? suggestions.length : scopes.length;

  useEffect(() => setActive(-1), [text, drafted.length]);

  /* Abandon an uncommitted edit. The table only ever filters on the APPLIED
     query, so a bar left showing half-typed text would be lying about what the
     results are for — clicking away or pressing Escape puts the applied query
     (and no pending scope) back. */
  function revert() {
    setText(query);
    setDraft({});
    setActive(-1);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) revert();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // `query`/drafts are deps so the handler always reverts to current state.
  }, [open, query, draft]);

  // Clear the applied search outright — no Enter needed.
  function clearSearch() {
    setText("");
    setDraft({});
    setActive(-1);
    setOpen(false);
    /* Only re-commit when there IS a committed query to drop. Pages wire
       onCommit to their landing morph, so an unconditional call would shove
       the page out of its landing view just for clearing typed text. */
    if (query) onCommit("");
  }

  // Add a value to the pending scope (does NOT touch the table yet).
  function addValue(scope: SearchScope, name: string) {
    setDraft((d) => {
      const cur = d[scope.token] ?? [];
      return cur.includes(name) ? d : { ...d, [scope.token]: [...cur, name] };
    });
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function enterScope(scope: SearchScope) {
    setText(`${scope.token}:`);
    setActive(-1);
    inputRef.current?.focus();
  }

  // Enter — run the pending search against the table. Pending scope values move
  // into their applied filters (the Filters row pills) and clear from the bar.
  function commit() {
    drafted.forEach(({ scope, values }) =>
      scope.onAppliedChange(Array.from(new Set([...scope.applied, ...values]))),
    );
    onCommit(userQuery);
    setDraft({});
    setOpen(false);
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
        if (mode) {
          const name = scopeResults[active];
          if (name) return addValue(mode.scope, name);
        } else if (hasQuery) {
          const sg = suggestions[active];
          if (sg) return addValue(scopeOfKind(sg.kind), sg.name);
        } else if (scopes[active]) {
          return enterScope(scopes[active]);
        }
      }
      if (mode) {
        if (scopeResults[0]) return addValue(mode.scope, scopeResults[0]);
        return;
      }
      commit();
    } else if (e.key === "Escape") {
      revert();
    } else if (e.key === "Backspace" && text === "" && scoped) {
      // Drop the most recently added value, whichever scope it belongs to.
      const last = drafted[drafted.length - 1];
      setDraft((d) => ({ ...d, [last.scope.token]: last.values.slice(0, -1) }));
    }
  }

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        {drafted.map(({ scope, values }) => (
          <SearchScopeChip
            key={scope.token}
            label={`${scope.token}:`}
            name={values.length === 1 ? values[0] : `${values.length} ${scope.optionsLabel.toLowerCase()}`}
            onRemove={() => setDraft((d) => ({ ...d, [scope.token]: [] }))}
          />
        ))}
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder={scoped ? `Search within ${scopeLabel}…` : placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {/* Figma 399:216 "Search Bar - Applied": once there is something to
            clear, the ⌘K badge gives way to a ✕ that clears on click. */}
        {text || scoped || query ? (
          <button
            type="button"
            className="usearch-clear"
            aria-label="Clear search"
            title="Clear search"
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
          {hasQuery && (
            <>
              <div className="usearch-head">Suggested filters</div>
              {suggestions.map((sg, i) => (
                <SuggestionRow
                  key={sg.kind + sg.name}
                  suggestion={sg}
                  active={active === i}
                  onHover={() => setActive(i)}
                  onClick={() => addValue(scopeOfKind(sg.kind), sg.name)}
                />
              ))}
            </>
          )}

          {!mode && !hasQuery && (
            <>
              <div className="usearch-head">Suggested filters</div>
              {scopes.map((s, i) => (
                <OptionRow
                  key={s.token}
                  active={active === i}
                  onHover={() => setActive(i)}
                  onClick={() => enterScope(s)}
                >
                  <span className="usearch-chip">{s.token}:</span>
                  <span className="usearch-row-ex">{s.example}</span>
                  <span className="usearch-row-desc">{s.hint}</span>
                </OptionRow>
              ))}
            </>
          )}

          {mode && (
            <>
              <div className="usearch-head">{mode.scope.optionsLabel}</div>
              {scopeResults.length === 0 ? (
                <>{mode.query.trim() ? <SearchNoResults /> : <div className="usearch-empty">{`Start typing ${/^[aeiou]/i.test(mode.scope.noun ?? mode.scope.token) ? "an" : "a"} ${mode.scope.noun ?? mode.scope.token.toLowerCase()} name…`}</div>}</>
              ) : (
                scopeResults.map((name, i) => (
                  <OptionRow
                    key={name}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => addValue(mode.scope, name)}
                  >
                    <span className="usearch-chip">{mode.scope.token}:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{mode.scope.describe?.(name)}</span>
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

/** The Users / Who Paid bar: one `Company:` scope built from the rows on screen. */
export function UsersSearch({
  users,
  companies: applied,
  onCompaniesChange,
  query,
  onCommit,
}: {
  users: User[];
  /** Company filter currently applied to the table (shared with the Filters row). */
  companies: string[];
  onCompaniesChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
}) {
  const companies = useMemo(() => {
    const counts = new Map<string, number>();
    users.forEach((u) => {
      if (u.companyName) counts.set(u.companyName, (counts.get(u.companyName) ?? 0) + 1);
    });
    return { names: [...counts.keys()].sort(), counts };
  }, [users]);

  const scope: SearchScope = {
    token: "Company",
    options: companies.names,
    applied,
    onAppliedChange: onCompaniesChange,
    optionsLabel: "Companies",
    example: "Company: Acme Inc.",
    hint: "Filter by Company",
    describe: (name) => `${companies.counts.get(name)} users`,
  };

  return (
    <EntitySearch
      scopes={[scope]}
      placeholder="Search Users by Name, Email, or Phone..."
      query={query}
      onCommit={onCommit}
    />
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
