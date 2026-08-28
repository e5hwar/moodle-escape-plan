import { useEffect, useMemo, useRef, useState } from "react";
import { type IdRecord } from "../data/manageIds";
import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;
/** Status suggestions offered in "Suggested filters". */
const MAX_SUGGESTED_PER_KIND = 2;

type Opt = { kind: "status-filter" } | { kind: "status"; name: string };

/**
 * Manage IDs' search — the same combobox the Proctoring queue uses, with this
 * page's one scope (ID Status). The page has no filter-pill row: the bar's
 * chips are the applied-filter UI, so an applied scope stays in the bar after
 * Enter and is removed from there.
 *
 * The panel offers filters only — no live result rows. The table filters on the
 * COMMITTED query, so a list that updated per keystroke would be showing results
 * the table below it does not have yet.
 */
export function ManageIdsSearch({
  records,
  statuses: appliedStatuses,
  onStatusesChange,
  query,
  onCommit,
}: {
  records: IdRecord[];
  statuses: string[];
  onStatusesChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
}) {
  const [text, setText] = useState(query);
  // Scopes picked in THIS search session — not yet applied to the table.
  const [draftStatuses, setDraftStatuses] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setText(query), [query]);

  const allStatuses = useMemo(() => {
    const counts = new Map<string, number>();
    records.forEach((r) => counts.set(STATUS_LABEL[r.status], (counts.get(STATUS_LABEL[r.status]) ?? 0) + 1));
    return { names: [...counts.keys()].sort(), counts };
  }, [records]);

  // The prefix (case-insensitive) switches the panel into selection mode.
  const statusMatch = text.match(/^\s*status:\s*(.*)$/i);
  const inStatusMode = statusMatch != null;
  const statusQuery = statusMatch ? statusMatch[1] : "";
  const freeQuery = inStatusMode ? "" : text;

  const scopedStatuses = useMemo(
    () => Array.from(new Set([...appliedStatuses, ...draftStatuses])),
    [appliedStatuses, draftStatuses],
  );
  const statusResults = useMemo(() => {
    const q = statusQuery.trim().toLowerCase();
    return allStatuses.names
      .filter((s) => !scopedStatuses.includes(s) && s.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [allStatuses, statusQuery, scopedStatuses]);

  const suggestions = useMemo<Opt[]>(() => {
    const q = freeQuery.trim().toLowerCase();
    if (!q) return [{ kind: "status-filter" }];
    return allStatuses.names
      .filter((n) => !scopedStatuses.includes(n) && n.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTED_PER_KIND)
      .map((name) => ({ kind: "status", name }) as Opt);
  }, [freeQuery, allStatuses, scopedStatuses]);

  const optionCount = inStatusMode ? statusResults.length : suggestions.length;

  function optionAt(i: number): Opt | null {
    if (inStatusMode) return statusResults[i] ? { kind: "status", name: statusResults[i] } : null;
    return suggestions[i] ?? null;
  }

  useEffect(() => setActive(-1), [text, draftStatuses.length]);

  /* Abandon an uncommitted edit — the table only filters on the APPLIED query. */
  function revert() {
    setText(query);
    setDraftStatuses([]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, draftStatuses]);

  function clearSearch() {
    setText("");
    setDraftStatuses([]);
    setActive(-1);
    setOpen(false);
    onStatusesChange([]);
    onCommit("");
  }

  function addStatus(name: string) {
    if (!scopedStatuses.includes(name)) setDraftStatuses([...draftStatuses, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }
  function removeStatus(name: string) {
    setDraftStatuses((d) => d.filter((x) => x !== name));
    if (appliedStatuses.includes(name))
      onStatusesChange(appliedStatuses.filter((x) => x !== name));
  }
  function activate(opt: Opt) {
    if (opt.kind === "status-filter") {
      setText("STATUS:");
      setActive(-1);
      inputRef.current?.focus();
    } else {
      addStatus(opt.name);
    }
  }

  function commit() {
    onStatusesChange(scopedStatuses);
    onCommit(freeQuery);
    setDraftStatuses([]);
    setOpen(false);
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
      if (inStatusMode) {
        if (statusResults[0]) return addStatus(statusResults[0]);
        return;
      }
      commit();
    } else if (e.key === "Escape") {
      revert();
    } else if (e.key === "Backspace" && text === "") {
      const lastStatus = scopedStatuses[scopedStatuses.length - 1];
      if (lastStatus) removeStatus(lastStatus);
    }
  }

  const scopeChips = scopedStatuses.map((name) => ({
    kind: "Status",
    name,
    remove: () => removeStatus(name),
  }));

  const placeholder = scopeChips.length
    ? "Search within scope…"
    : "Search User's Name, Email, or Phone";

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <div className="usearch-scopes">
          {scopeChips.map((chip) => (
            <span className="usearch-scope" key={`${chip.kind}-${chip.name}`}>
              <span className="usearch-scope-label">{chip.kind}:</span>
              <span className="usearch-scope-name">{chip.name}</span>
              <button
                type="button"
                className="usearch-scope-x"
                aria-label={`Remove ${chip.kind} filter ${chip.name}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={chip.remove}
              >
                <SearchClearIcon />
              </button>
            </span>
          ))}
        </div>
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {text || scopeChips.length > 0 || query ? (
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

      {open && (
        <div className="usearch-panel">
          {!inStatusMode && (
            <>
              {suggestions.length > 0 && <div className="usearch-head">Suggested filters</div>}
              {suggestions.map((opt, i) => {
                const row = suggestionRow(opt, allStatuses);
                if (!row) return null;
                return (
                  <OptionRow
                    key={row.key}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => activate(opt)}
                  >
                    <span className="usearch-chip">{row.chip}</span>
                    <span className="usearch-row-ex">{row.example}</span>
                    <span className="usearch-row-desc">{row.desc}</span>
                  </OptionRow>
                );
              })}

            </>
          )}

          {inStatusMode && (
            <>
              <div className="usearch-head">ID Statuses</div>
              {statusResults.length === 0 ? (
                <div className="usearch-empty">
                  {statusQuery.trim()
                    ? `No statuses match “${statusQuery.trim()}”.`
                    : "Start typing a status…"}
                </div>
              ) : (
                statusResults.map((name, i) => (
                  <OptionRow
                    key={name}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => activate({ kind: "status", name })}
                  >
                    <span className="usearch-chip">Status:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{userCount(allStatuses.counts.get(name))}</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {freeQuery.trim() ? (
            <SearchForRow query={freeQuery.trim()} scope="IDs" onClick={commit} />
          ) : (
            <SearchHints />
          )}
        </div>
      )}
    </div>
  );
}

/** Table + search share one set of status words. */
export const STATUS_LABEL: Record<IdRecord["status"], string> = {
  approved: "Approved",
  "in-review": "Review Pending",
  "reupload-requested": "Reupload Requested",
};

type NameCounts = { names: string[]; counts: Map<string, number> };

/** "1 user" / "4 users" — used by both the scope lists and the suggestions. */
function userCount(n = 0): string {
  return `${n} user${n === 1 ? "" : "s"}`;
}

/** Chip / example / description for one "Suggested filters" row. */
function suggestionRow(
  opt: Opt,
  allStatuses: NameCounts,
): { key: string; chip: string; example: string; desc: string } | null {
  switch (opt.kind) {
    case "status-filter":
      return {
        key: "status-filter",
        chip: "Status:",
        example: "Status: Review Pending",
        desc: "Filter by ID Status",
      };
    case "status":
      return {
        key: `status:${opt.name}`,
        chip: "Status:",
        example: opt.name,
        desc: userCount(allStatuses.counts.get(opt.name)),
      };
    default:
      return null;
  }
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
