import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../data/tasks";
import { CERTIFICATIONS, TASK_TYPES } from "../data/filters";
import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;
const CERT_PREFIX = "Certification:";
const TYPE_PREFIX = "Type:";

type Opt =
  | { kind: "cert-filter" }
  | { kind: "type-filter" }
  | { kind: "search" }
  | { kind: "cert"; name: string }
  | { kind: "type"; name: string };

export function TasksSearch({
  tasks,
  certifications: applied,
  onCertificationsChange,
  types: appliedTypes,
  onTypesChange,
  query,
  onCommit,
}: {
  tasks: Task[];
  /** Certification filter currently applied to the table (shared with the Filters row). */
  certifications: string[];
  onCertificationsChange: (next: string[]) => void;
  /** Task-type filter currently applied to the table (shared with the Filters row). */
  types: string[];
  onTypesChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
}) {
  const [text, setText] = useState(query);
  // Certifications picked in THIS search session (not yet applied). On Enter they
  // move into the applied filter (the Filters row pill) and clear from the bar.
  const [draft, setDraft] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the bar showing the applied query when it changes from outside
  // (Clear Filters, a preset, the ✕ on another control).
  useEffect(() => setText(query), [query]);

  const certCounts = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => t.usedIn.forEach((c) => m.set(c, (m.get(c) ?? 0) + 1)));
    return m;
  }, [tasks]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => m.set(t.type, (m.get(t.type) ?? 0) + 1));
    return m;
  }, [tasks]);

  const scoped = draft.length > 0;
  const scopeName = draft.length === 1 ? draft[0] : `${draft.length} selected`;
  const scopeLabel = draft.length === 1 ? "Certification:" : "Certifications:";

  // Prefix detection (case-insensitive) puts the box into a filter-selection mode.
  const certMatch = text.match(/^\s*certifications?:\s*(.*)$/i);
  const typeMatch = text.match(/^\s*type:\s*(.*)$/i);
  const inCertMode = certMatch != null;
  const inTypeMode = !inCertMode && typeMatch != null;
  const inMode = inCertMode || inTypeMode;
  const certQuery = certMatch ? certMatch[1] : "";
  const typeQuery = typeMatch ? typeMatch[1] : "";
  const taskQuery = inMode ? "" : text;
  const hasQuery = taskQuery.trim().length > 0;

  const certResults = useMemo(() => {
    const q = certQuery.trim().toLowerCase();
    return CERTIFICATIONS.filter(
      (c) => !draft.includes(c) && !applied.includes(c) && c.toLowerCase().includes(q),
    ).slice(0, MAX_RESULTS);
  }, [certQuery, draft, applied]);

  const typeResults = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    return TASK_TYPES.filter(
      (t) => !appliedTypes.includes(t) && t.toLowerCase().includes(q),
    ).slice(0, MAX_RESULTS);
  }, [typeQuery, appliedTypes]);

  // Options available to keyboard navigation, in render order.
  const optionCount = inCertMode
    ? certResults.length
    : inTypeMode
      ? typeResults.length
      : 2 + (hasQuery ? 1 : 0);

  function optionAt(i: number): Opt | null {
    if (inCertMode) return certResults[i] ? { kind: "cert", name: certResults[i] } : null;
    if (inTypeMode) return typeResults[i] ? { kind: "type", name: typeResults[i] } : null;
    if (i === 0) return { kind: "cert-filter" };
    if (i === 1) return { kind: "type-filter" };
    if (i === 2 && hasQuery) return { kind: "search" };
    return null;
  }

  // When the user has typed free text, preselect the "Search for…" row (the last
  // option) so pressing Enter searches immediately; arrowing moves the highlight off it.
  useEffect(() => {
    setActive(!inMode && hasQuery ? 2 : -1);
  }, [text, draft.length, inMode, hasQuery]);

  /* Abandon an uncommitted edit. The table only ever filters on the APPLIED
     query, so a bar left showing half-typed text would be lying about what the
     results are for — clicking away or pressing Escape puts the applied query
     (and no pending scope) back. */
  function revert() {
    setText(query);
    setDraft([]);
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
    setDraft([]);
    setActive(-1);
    setOpen(false);
    onCommit("");
  }

  function addCert(name: string) {
    if (!draft.includes(name)) setDraft([...draft, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function addType(name: string) {
    onTypesChange(Array.from(new Set([...appliedTypes, name])));
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  // Run a free-text search against the table: pending certs move into the applied
  // filter (the Filters row pill) and clear from the bar.
  function commitSearch(q: string) {
    onCertificationsChange(Array.from(new Set([...applied, ...draft])));
    onCommit(q);
    setDraft([]);
    setOpen(false);
  }

  function activate(opt: Opt) {
    if (opt.kind === "cert-filter") {
      setText(CERT_PREFIX);
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "type-filter") {
      setText(TYPE_PREFIX);
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "cert") {
      addCert(opt.name);
    } else if (opt.kind === "type") {
      addType(opt.name);
    } else {
      commitSearch(taskQuery);
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
      if (inCertMode) {
        if (certResults[0]) return addCert(certResults[0]);
        return;
      }
      if (inTypeMode) {
        if (typeResults[0]) return addType(typeResults[0]);
        return;
      }
      commitSearch(taskQuery);
    } else if (e.key === "Escape") {
      revert();
    } else if (e.key === "Backspace" && text === "" && scoped) {
      setDraft(draft.slice(0, -1));
    }
  }

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        {scoped && (
          <span className="usearch-scope">
            <span className="usearch-scope-label">{scopeLabel}</span>
            <span className="usearch-scope-name">{scopeName}</span>
          </span>
        )}
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder="Search Tasks"
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

      {open && (
        <div className="usearch-panel">
          {!inMode && (
            <>
              <div className="usearch-head">Suggested filters</div>
              <OptionRow active={active === 0} onHover={() => setActive(0)} onClick={() => activate({ kind: "cert-filter" })}>
                <span className="usearch-chip">Certification:</span>
                <span className="usearch-row-ex">Certification: EPA 608 Universal</span>
                <span className="usearch-row-desc">Filter Tasks by Certification</span>
              </OptionRow>
              <OptionRow active={active === 1} onHover={() => setActive(1)} onClick={() => activate({ kind: "type-filter" })}>
                <span className="usearch-chip">Type:</span>
                <span className="usearch-row-ex">Type: Quiz</span>
                <span className="usearch-row-desc">Filter by Task Type</span>
              </OptionRow>
            </>
          )}

          {inCertMode && (
            <>
              <div className="usearch-head">Certifications</div>
              {certResults.length === 0 ? (
                <div className="usearch-empty">
                  {certQuery.trim() ? `No certifications match “${certQuery.trim()}”.` : "Start typing a certification name…"}
                </div>
              ) : (
                certResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "cert", name })}>
                    <span className="usearch-chip">Certification:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{certCounts.get(name) ?? 0} tasks</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {inTypeMode && (
            <>
              <div className="usearch-head">Task type</div>
              {typeResults.length === 0 ? (
                <div className="usearch-empty">
                  {typeQuery.trim() ? `No types match “${typeQuery.trim()}”.` : "All task types are already applied."}
                </div>
              ) : (
                typeResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "type", name })}>
                    <span className="usearch-chip">Type:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{typeCounts.get(name) ?? 0} tasks</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {!inMode && hasQuery ? (
            <SearchForRow
              query={taskQuery.trim()}
              scope="Tasks"
              active={active === 2}
              onHover={() => setActive(2)}
              onClick={() => commitSearch(taskQuery)}
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
