import { useEffect, useMemo, useRef, useState } from "react";
import type { TaskSubmission } from "../data/reviewSubmissions";
import { SearchIcon } from "./icons";

const MAX_RESULTS = 6;

function initialsOf(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

type Opt =
  | { kind: "company-filter" }
  | { kind: "task-filter" }
  | { kind: "submission"; submission: TaskSubmission }
  | { kind: "company"; name: string }
  | { kind: "task"; name: string };

export function ReviewSearch({
  submissions,
  companies: appliedCompanies,
  onCompaniesChange,
  tasks: appliedTasks,
  onTasksChange,
  query,
  onCommit,
  onOpenSubmission,
}: {
  submissions: TaskSubmission[];
  companies: string[];
  onCompaniesChange: (next: string[]) => void;
  tasks: string[];
  onTasksChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
  onOpenSubmission: (s: TaskSubmission) => void;
}) {
  const [text, setText] = useState(query);
  // Pending scopes selected in THIS search session (not yet applied to the table).
  const [draftCompanies, setDraftCompanies] = useState<string[]>([]);
  const [draftTasks, setDraftTasks] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const scopedCompany = draftCompanies.length > 0;
  const scopedTask = draftTasks.length > 0;

  // Prefixes (case-insensitive) switch the panel into selection mode.
  const companyMatch = text.match(/^\s*company:\s*(.*)$/i);
  const taskMatch = text.match(/^\s*task:\s*(.*)$/i);
  const inCompanyMode = companyMatch != null;
  const inTaskMode = taskMatch != null;
  const companyQuery = companyMatch ? companyMatch[1] : "";
  const taskQuery = taskMatch ? taskMatch[1] : "";
  const freeQuery = inCompanyMode || inTaskMode ? "" : text;

  const submissionResults = useMemo(() => {
    let base = submissions;
    if (draftCompanies.length)
      base = base.filter((s) => s.companyName && draftCompanies.includes(s.companyName));
    if (draftTasks.length) base = base.filter((s) => draftTasks.includes(s.taskName));
    const q = freeQuery.trim().toLowerCase();
    const matched = q
      ? base.filter(
          (s) =>
            s.userName.toLowerCase().includes(q) ||
            s.email.toLowerCase().includes(q) ||
            s.phone.toLowerCase().includes(q) ||
            s.taskName.toLowerCase().includes(q),
        )
      : base;
    return matched.slice(0, MAX_RESULTS);
  }, [submissions, draftCompanies, draftTasks, freeQuery]);

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

  const showDefaultResults =
    !inCompanyMode && !inTaskMode && (scopedCompany || scopedTask || freeQuery.trim().length > 0);

  const optionCount = inCompanyMode
    ? companyResults.length
    : inTaskMode
    ? taskResults.length
    : 2 + (showDefaultResults ? submissionResults.length : 0);

  function optionAt(i: number): Opt | null {
    if (inCompanyMode) return companyResults[i] ? { kind: "company", name: companyResults[i] } : null;
    if (inTaskMode) return taskResults[i] ? { kind: "task", name: taskResults[i] } : null;
    if (i === 0) return { kind: "company-filter" };
    if (i === 1) return { kind: "task-filter" };
    return submissionResults[i - 2] ? { kind: "submission", submission: submissionResults[i - 2] } : null;
  }

  useEffect(() => setActive(-1), [text, draftCompanies.length, draftTasks.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

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

  function activate(opt: Opt) {
    if (opt.kind === "company-filter") {
      setText("COMPANY:");
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "task-filter") {
      setText("TASK:");
      setActive(-1);
      inputRef.current?.focus();
    } else if (opt.kind === "company") {
      addCompany(opt.name);
    } else if (opt.kind === "task") {
      addTask(opt.name);
    } else {
      onOpenSubmission(opt.submission);
      setOpen(false);
    }
  }

  function commit() {
    onCompaniesChange(Array.from(new Set([...appliedCompanies, ...draftCompanies])));
    onTasksChange(Array.from(new Set([...appliedTasks, ...draftTasks])));
    onCommit(freeQuery);
    setDraftCompanies([]);
    setDraftTasks([]);
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
      commit();
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && text === "") {
      if (scopedTask) setDraftTasks(draftTasks.slice(0, -1));
      else if (scopedCompany) setDraftCompanies(draftCompanies.slice(0, -1));
    }
  }

  const scopeChips = [
    ...draftCompanies.map((c) => ({ kind: "Company", name: c, onClear: () => setDraftCompanies(draftCompanies.filter((x) => x !== c)) })),
    ...draftTasks.map((t) => ({ kind: "Task", name: t, onClear: () => setDraftTasks(draftTasks.filter((x) => x !== t)) })),
  ];

  const placeholder = scopeChips.length
    ? "Search within scope…"
    : "Search by name, email, phone, or task…";

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        {scopeChips.map((chip, i) => (
          <span className="usearch-scope" key={`${chip.kind}-${chip.name}-${i}`}>
            <span className="usearch-scope-label">{chip.kind}</span>
            <span className="usearch-scope-name">{chip.name}</span>
            <button className="usearch-scope-x" aria-label={`Clear ${chip.kind} filter`} onClick={chip.onClear}>
              ✕
            </button>
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
        <span className="usearch-kbd">
          <span className="kbd-cmd">⌘</span>
          <span className="kbd-letter">K</span>
        </span>
      </div>

      {open && (
        <div className="usearch-panel">
          {!inCompanyMode && !inTaskMode && (
            <>
              <div className="usearch-head">Suggested filters</div>
              <OptionRow active={active === 0} onHover={() => setActive(0)} onClick={() => activate({ kind: "company-filter" })}>
                <span className="usearch-chip">COMPANY:</span>
                <span className="usearch-row-ex">COMPANY:Acme Inc.</span>
                <span className="usearch-row-desc">Filter submissions by company</span>
              </OptionRow>
              <OptionRow active={active === 1} onHover={() => setActive(1)} onClick={() => activate({ kind: "task-filter" })}>
                <span className="usearch-chip">TASK:</span>
                <span className="usearch-row-ex">TASK:HVAC Install</span>
                <span className="usearch-row-desc">Filter submissions by task</span>
              </OptionRow>

              {showDefaultResults && <div className="usearch-head">Submissions</div>}
              {showDefaultResults && submissionResults.length === 0 && (
                <div className="usearch-empty">
                  No matching submissions{freeQuery.trim() ? ` for “${freeQuery.trim()}”` : ""}.
                </div>
              )}
              {showDefaultResults &&
                submissionResults.map((s, i) => (
                  <SubmissionOption
                    key={s.id}
                    submission={s}
                    active={active === i + 2}
                    onHover={() => setActive(i + 2)}
                    onClick={() => activate({ kind: "submission", submission: s })}
                  />
                ))}
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
                    <span className="usearch-chip">COMPANY:</span>
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
                    <span className="usearch-chip">TASK:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{allTasks.counts.get(name)} submissions</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          <div className="usearch-foot">
            <span className="usearch-kbd-inline">↵</span>
            {inCompanyMode
              ? "Select a company to filter"
              : inTaskMode
              ? "Select a task to filter"
              : "Show results in the table"}
          </div>
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

function SubmissionOption({
  submission,
  active,
  onHover,
  onClick,
}: {
  submission: TaskSubmission;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      className={`usearch-row usearch-user ${active ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <span className="usearch-avatar">{initialsOf(submission.userName)}</span>
      <span className="usearch-user-text">
        <span className="usearch-user-name">{submission.userName}</span>
        <span className="usearch-user-sub">{submission.taskName}</span>
      </span>
      <span className="usearch-row-desc">
        {submission.userType === "B2B" && submission.companyName ? submission.companyName : "B2C"}
      </span>
    </button>
  );
}
