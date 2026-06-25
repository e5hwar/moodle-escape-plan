import { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "../data/tasks";
import { CERTIFICATIONS } from "../data/filters";
import { SearchIcon } from "./icons";

const MAX_RESULTS = 6;
const CERT_PREFIX = "CERTIFICATIONS:";

type Opt =
  | { kind: "cert-filter" }
  | { kind: "task"; task: Task }
  | { kind: "cert"; name: string };

export function TasksSearch({
  tasks,
  certifications: applied,
  onCertificationsChange,
  query,
  onCommit,
  onSelectTask,
}: {
  tasks: Task[];
  /** Certification filter currently applied to the table (shared with the Filters row). */
  certifications: string[];
  onCertificationsChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
  onSelectTask: (id: string) => void;
}) {
  const [text, setText] = useState(query);
  // Certifications picked in THIS search session (not yet applied). On Enter they
  // move into the applied filter (the Filters row pill) and clear from the bar.
  const [draft, setDraft] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const certCounts = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => t.usedIn.forEach((c) => m.set(c, (m.get(c) ?? 0) + 1)));
    return m;
  }, [tasks]);

  const scoped = draft.length > 0;
  const scopeLabel = draft.length === 1 ? draft[0] : `${draft.length} certifications`;

  // "CERTIFICATIONS:" prefix puts us in certification-selection mode (case-insensitive).
  const certMatch = text.match(/^\s*certifications?:\s*(.*)$/i);
  const inCertMode = certMatch != null;
  const certQuery = certMatch ? certMatch[1] : "";
  const taskQuery = inCertMode ? "" : text;

  const taskResults = useMemo(() => {
    const base = scoped ? tasks.filter((t) => t.usedIn.some((c) => draft.includes(c))) : tasks;
    const q = taskQuery.trim().toLowerCase();
    const matched = q
      ? base.filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.type.toLowerCase().includes(q),
        )
      : base;
    return matched.slice(0, MAX_RESULTS);
  }, [tasks, scoped, draft, taskQuery]);

  const certResults = useMemo(() => {
    const q = certQuery.trim().toLowerCase();
    return CERTIFICATIONS.filter(
      (c) => !draft.includes(c) && !applied.includes(c) && c.toLowerCase().includes(q),
    ).slice(0, MAX_RESULTS);
  }, [certQuery, draft, applied]);

  const showDefaultTasks = !inCertMode && (scoped || taskQuery.trim().length > 0);

  const optionCount = inCertMode
    ? certResults.length
    : 1 + (showDefaultTasks ? taskResults.length : 0);

  function optionAt(i: number): Opt | null {
    if (inCertMode) return certResults[i] ? { kind: "cert", name: certResults[i] } : null;
    if (i === 0) return { kind: "cert-filter" };
    return taskResults[i - 1] ? { kind: "task", task: taskResults[i - 1] } : null;
  }

  useEffect(() => setActive(-1), [text, draft.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function addCert(name: string) {
    if (!draft.includes(name)) setDraft([...draft, name]);
    setText("");
    setActive(-1);
    setOpen(true);
    inputRef.current?.focus();
  }

  function clearCerts() {
    setDraft([]);
    inputRef.current?.focus();
  }

  // Run a search against the table: pending certs move into the applied filter
  // (the Filters row pill) and clear from the bar.
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
    } else if (opt.kind === "cert") {
      addCert(opt.name);
    } else {
      onSelectTask(opt.task.id);
      setText(opt.task.name);
      commitSearch(opt.task.name);
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
      commitSearch(taskQuery);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && text === "" && scoped) {
      setDraft(draft.slice(0, -1));
    }
  }

  const placeholder = scoped
    ? `Search within ${scopeLabel}…`
    : "Search Tasks";

  return (
    <div className="usearch" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        {scoped && (
          <span className="usearch-scope">
            <span className="usearch-scope-label">Certification</span>
            <span className="usearch-scope-name">{scopeLabel}</span>
            <button className="usearch-scope-x" aria-label="Clear certification filter" onClick={clearCerts}>
              ✕
            </button>
          </span>
        )}
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
          {!inCertMode && (
            <>
              <div className="usearch-head">Suggested filters</div>
              <OptionRow active={active === 0} onHover={() => setActive(0)} onClick={() => activate({ kind: "cert-filter" })}>
                <span className="usearch-chip">CERTIFICATIONS:</span>
                <span className="usearch-row-ex">CERTIFICATIONS:EPA 608</span>
                <span className="usearch-row-desc">Filter tasks by certification</span>
              </OptionRow>

              {showDefaultTasks && (
                <div className="usearch-head">{scoped ? `Tasks in ${scopeLabel}` : "Tasks"}</div>
              )}
              {showDefaultTasks && taskResults.length === 0 && (
                <div className="usearch-empty">
                  No matching tasks{scoped ? ` in ${scopeLabel}` : ""}
                  {taskQuery.trim() ? ` for “${taskQuery.trim()}”` : ""}.
                </div>
              )}
              {showDefaultTasks &&
                taskResults.map((t, i) => (
                  <TaskOption
                    key={t.id}
                    task={t}
                    active={active === i + 1}
                    onHover={() => setActive(i + 1)}
                    onClick={() => activate({ kind: "task", task: t })}
                  />
                ))}
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
                    <span className="usearch-chip">CERTIFICATIONS:</span>
                    <span className="usearch-row-ex">{name}</span>
                    <span className="usearch-row-desc">{certCounts.get(name) ?? 0} tasks</span>
                  </OptionRow>
                ))
              )}
            </>
          )}

          <div className="usearch-foot">
            <span className="usearch-kbd-inline">↵</span>
            {inCertMode ? "Select a certification to filter" : "Show results in the table"}
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

function TaskOption({
  task,
  active,
  onHover,
  onClick,
}: {
  task: Task;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  const usedIn =
    task.usedIn.length === 0
      ? "Not in any certification"
      : `Used in ${task.usedIn[0]}${task.usedIn.length > 1 ? ` +${task.usedIn.length - 1}` : ""}`;
  return (
    <button
      className={`usearch-row usearch-task ${active ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <span className="usearch-task-id">{task.id}</span>
      <span className="usearch-user-text">
        <span className="usearch-user-name">{task.name}</span>
        <span className="usearch-user-sub">{usedIn}</span>
      </span>
      <span className="usearch-row-desc">{task.type}</span>
    </button>
  );
}
