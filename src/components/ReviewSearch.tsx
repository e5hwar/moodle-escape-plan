import { useEffect, useMemo, useRef, useState } from "react";
import { type TaskSubmission } from "../data/reviewSubmissions";
import { KeyCommandIcon, SearchIcon, SearchClearIcon } from "./icons";
import { SearchHints, SearchForRow } from "./SearchPanelParts";

const MAX_RESULTS = 6;
/** Per scope kind (Task / Certification / Company) in "Suggested filters". */
const MAX_SUGGESTED_PER_KIND = 2;

type Opt =
  | { kind: "company-filter" }
  | { kind: "task-filter" }
  | { kind: "certification-filter" }
  | { kind: "company"; name: string }
  | { kind: "task"; name: string }
  | { kind: "certification"; name: string };

export function ReviewSearch({
  submissions,
  companies: appliedCompanies,
  onCompaniesChange,
  tasks: appliedTasks,
  onTasksChange,
  certifications: appliedCerts,
  onCertificationsChange,
  query,
  onCommit,
}: {
  submissions: TaskSubmission[];
  companies: string[];
  onCompaniesChange: (next: string[]) => void;
  tasks: string[];
  onTasksChange: (next: string[]) => void;
  /** Parent certifications — the certifications a submitted Task belongs to. */
  certifications: string[];
  onCertificationsChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
}) {
  const [text, setText] = useState(query);
  // Pending scopes selected in THIS search session (not yet applied to the table).
  const [draftCompanies, setDraftCompanies] = useState<string[]>([]);
  const [draftTasks, setDraftTasks] = useState<string[]>([]);
  const [draftCerts, setDraftCerts] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Keep the bar showing the applied query when it changes from outside
  // (Clear Filters, a preset, the ✕ on another control).
  useEffect(() => setText(query), [query]);

  const allCompanies = useMemo(() => {
    const counts = new Map<string, number>();
    submissions.forEach((s) => {
      if (s.companyName) counts.set(s.companyName, (counts.get(s.companyName) ?? 0) + 1);
    });
    return { names: [...counts.keys()].sort(), counts };
  }, [submissions]);

  const allTasks = useMemo(() => {
    const counts = new Map<string, number>();
    submissions.forEach((s) => counts.set(s.taskName, (counts.get(s.taskName) ?? 0) + 1));
    return { names: [...counts.keys()].sort(), counts };
  }, [submissions]);

  const allCerts = useMemo(() => {
    const counts = new Map<string, number>();
    submissions.forEach((s) =>
      s.certifications.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)),
    );
    return { names: [...counts.keys()].sort(), counts };
  }, [submissions]);

  const scopedCompany = draftCompanies.length > 0;
  const scopedTask = draftTasks.length > 0;
  const scopedCert = draftCerts.length > 0;

  // Prefixes (case-insensitive) switch the panel into selection mode.
  const companyMatch = text.match(/^\s*company:\s*(.*)$/i);
  const taskMatch = text.match(/^\s*task:\s*(.*)$/i);
  const certMatch = text.match(/^\s*certification:\s*(.*)$/i);
  const inCompanyMode = companyMatch != null;
  const inTaskMode = taskMatch != null;
  const inCertMode = certMatch != null;
  const inScopeMode = inCompanyMode || inTaskMode || inCertMode;
  const companyQuery = companyMatch ? companyMatch[1] : "";
  const taskQuery = taskMatch ? taskMatch[1] : "";
  const certQuery = certMatch ? certMatch[1] : "";
  const freeQuery = inScopeMode ? "" : text;

  const companyResults = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return allCompanies.names
      .filter((c) => !draftCompanies.includes(c) && !appliedCompanies.includes(c) && c.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [allCompanies, companyQuery, draftCompanies, appliedCompanies]);

  const taskResults = useMemo(() => {
    const q = taskQuery.trim().toLowerCase();
    return allTasks.names
      .filter((t) => !draftTasks.includes(t) && !appliedTasks.includes(t) && t.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [allTasks, taskQuery, draftTasks, appliedTasks]);

  const certResults = useMemo(() => {
    const q = certQuery.trim().toLowerCase();
    return allCerts.names
      .filter((c) => !draftCerts.includes(c) && !appliedCerts.includes(c) && c.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [allCerts, certQuery, draftCerts, appliedCerts]);

  /* "Suggested filters" follows what's typed: with an empty box it teaches the
     three scope prefixes, and as soon as there is text it offers the Tasks,
     Parent Certifications and Companies that actually match it — so "ds" can be
     turned into a scope without knowing the prefix syntax. */
  const suggestions = useMemo<Opt[]>(() => {
    const q = freeQuery.trim().toLowerCase();
    if (!q) {
      return [{ kind: "task-filter" }, { kind: "certification-filter" }, { kind: "company-filter" }];
    }
    const pick = (names: string[], draft: string[], applied: string[]) =>
      names
        .filter((n) => !draft.includes(n) && !applied.includes(n) && n.toLowerCase().includes(q))
        .slice(0, MAX_SUGGESTED_PER_KIND);
    return [
      ...pick(allTasks.names, draftTasks, appliedTasks).map(
        (name) => ({ kind: "task", name }) as Opt,
      ),
      ...pick(allCerts.names, draftCerts, appliedCerts).map(
        (name) => ({ kind: "certification", name }) as Opt,
      ),
      ...pick(allCompanies.names, draftCompanies, appliedCompanies).map(
        (name) => ({ kind: "company", name }) as Opt,
      ),
    ];
  }, [
    freeQuery,
    allTasks, allCerts, allCompanies,
    draftTasks, draftCerts, draftCompanies,
    appliedTasks, appliedCerts, appliedCompanies,
  ]);

  const optionCount = inCompanyMode
    ? companyResults.length
    : inTaskMode
    ? taskResults.length
    : inCertMode
    ? certResults.length
    : suggestions.length;

  function optionAt(i: number): Opt | null {
    if (inCompanyMode) return companyResults[i] ? { kind: "company", name: companyResults[i] } : null;
    if (inTaskMode) return taskResults[i] ? { kind: "task", name: taskResults[i] } : null;
    if (inCertMode) return certResults[i] ? { kind: "certification", name: certResults[i] } : null;
    return suggestions[i] ?? null;
  }

  useEffect(() => setActive(-1), [text, draftCompanies.length, draftTasks.length, draftCerts.length]);

  /* Abandon an uncommitted edit. The table only ever filters on the APPLIED
     query, so a bar left showing half-typed text would be lying about what the
     results are for — clicking away or pressing Escape puts the applied query
     (and no pending scope) back. */
  function revert() {
    setText(query);
    setDraftCompanies([]);
    setDraftTasks([]);
    setDraftCerts([]);
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
  }, [open, query, draftCompanies, draftTasks, draftCerts]);

  // Clear the applied search outright — no Enter needed.
  function clearSearch() {
    setText("");
    setDraftCompanies([]);
    setDraftTasks([]);
    setDraftCerts([]);
    setActive(-1);
    setOpen(false);
    onCommit("");
  }

  function addCompany(name: string) {
    if (!draftCompanies.includes(name)) setDraftCompanies([...draftCompanies, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }
  function addTask(name: string) {
    if (!draftTasks.includes(name)) setDraftTasks([...draftTasks, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }
  function addCert(name: string) {
    if (!draftCerts.includes(name)) setDraftCerts([...draftCerts, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function activate(opt: Opt) {
    if (opt.kind === "company-filter") {
      setText("COMPANY:");
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "task-filter") {
      setText("TASK:");
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "certification-filter") {
      setText("CERTIFICATION:");
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "company") {
      addCompany(opt.name);
    } else if (opt.kind === "task") {
      addTask(opt.name);
    } else {
      addCert(opt.name);
    }
  }

  function commit() {
    onCompaniesChange(Array.from(new Set([...appliedCompanies, ...draftCompanies])));
    onTasksChange(Array.from(new Set([...appliedTasks, ...draftTasks])));
    onCertificationsChange(Array.from(new Set([...appliedCerts, ...draftCerts])));
    onCommit(freeQuery);
    setDraftCompanies([]);
    setDraftTasks([]);
    setDraftCerts([]);
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
      if (inCompanyMode) {
        if (companyResults[0]) return addCompany(companyResults[0]);
        return;
      }
      if (inTaskMode) {
        if (taskResults[0]) return addTask(taskResults[0]);
        return;
      }
      if (inCertMode) {
        if (certResults[0]) return addCert(certResults[0]);
        return;
      }
      commit();
    } else if (e.key === "Escape") {
      revert();
    } else if (e.key === "Backspace" && text === "") {
      if (scopedCert) setDraftCerts(draftCerts.slice(0, -1));
      else if (scopedTask) setDraftTasks(draftTasks.slice(0, -1));
      else if (scopedCompany) setDraftCompanies(draftCompanies.slice(0, -1));
    }
  }

  const scopeChips = [
    ...draftCompanies.map((c) => ({ kind: "Company", name: c })),
    ...draftTasks.map((t) => ({ kind: "Task", name: t })),
    ...draftCerts.map((c) => ({ kind: "Certification", name: c })),
  ];

  const placeholder = scopeChips.length
    ? "Search within scope…"
    : "Search by User's Name, Email, Phone, Task, or Parent Certification…";

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        {scopeChips.map((chip, i) => (
          <span className="usearch-scope" key={`${chip.kind}-${chip.name}-${i}`}>
            <span className="usearch-scope-label">{chip.kind}:</span>
            <span className="usearch-scope-name">{chip.name}</span>
          </span>
        ))}
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
        {/* Figma 399:216 "Search Bar - Applied": once there is something to
            clear, the ⌘K badge gives way to a ✕ that clears on click. */}
        {text || scopedCompany || scopedTask || scopedCert || query ? (
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
          {!inScopeMode && (
            <>
              {suggestions.length > 0 && <div className="usearch-head">Suggested filters</div>}
              {suggestions.map((opt, i) => {
                const row = suggestionRow(opt, { allTasks, allCerts, allCompanies });
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

          {inCompanyMode && (
            <>
              <div className="usearch-head">Companies</div>
              {companyResults.length === 0 ? (
                <div className="usearch-empty">
                  {companyQuery.trim() ? `No companies match “${companyQuery.trim()}”.` : "Start typing a company name…"}
                </div>
              ) : (
                companyResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "company", name })}>
                    <span className="usearch-chip">Company:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{allCompanies.counts.get(name)} submissions</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {inTaskMode && (
            <>
              <div className="usearch-head">Tasks</div>
              {taskResults.length === 0 ? (
                <div className="usearch-empty">
                  {taskQuery.trim() ? `No tasks match “${taskQuery.trim()}”.` : "Start typing a task name…"}
                </div>
              ) : (
                taskResults.map((name, i) => (
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "task", name })}>
                    <span className="usearch-chip">Task:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{allTasks.counts.get(name)} submissions</span>
                  </OptionRow>
                ))
              )}
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
                  <OptionRow key={name} active={active === i} onHover={() => setActive(i)} onClick={() => activate({ kind: "certification", name })}>
                    <span className="usearch-chip">Certification:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{allCerts.counts.get(name)} submissions</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          {freeQuery.trim() ? (
            <SearchForRow query={freeQuery.trim()} scope="Submissions" onClick={commit} />
          ) : (
            <SearchHints />
          )}
        </div>
      )}
    </div>
  );
}

type NameCounts = { names: string[]; counts: Map<string, number> };

/** Chip / example / description for one "Suggested filters" row — the static
 * prefix hints when the box is empty, a real scope value once it isn't. */
function suggestionRow(
  opt: Opt,
  all: { allTasks: NameCounts; allCerts: NameCounts; allCompanies: NameCounts },
): { key: string; chip: string; example: string; desc: string } | null {
  const count = (c: NameCounts, name: string) => `${c.counts.get(name) ?? 0} submissions`;
  switch (opt.kind) {
    case "task-filter":
      return { key: "task-filter", chip: "Task:", example: "Task: HVAC Install", desc: "Filter by Task" };
    case "certification-filter":
      return {
        key: "certification-filter",
        chip: "Certification:",
        example: "Certification: EPA 608 Type I",
        desc: "Filter by Parent Certification",
      };
    case "company-filter":
      return { key: "company-filter", chip: "Company:", example: "Company: Acme Inc.", desc: "Filter by User's Company" };
    case "task":
      return { key: `task:${opt.name}`, chip: "Task:", example: opt.name, desc: count(all.allTasks, opt.name) };
    case "certification":
      return { key: `cert:${opt.name}`, chip: "Certification:", example: opt.name, desc: count(all.allCerts, opt.name) };
    case "company":
      return { key: `company:${opt.name}`, chip: "Company:", example: opt.name, desc: count(all.allCompanies, opt.name) };
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
