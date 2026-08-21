import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import type { TaskType } from "../data/tasks";
import {
  applyClearCert,
  applyGrantAttempt,
  applyMarkCert,
  applyMarkComplete,
  attemptInfo,
  buildData,
  buildDetail,
  needsGradePrompt,
  progress,
  statusVisual,
  fmtD,
  fmtDT,
  type CellMap,
  type CellStatus,
  type CertManual,
  type CertTask,
  type Employee,
  type TimelineEvent,
} from "../data/certLookup";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { PageBreak } from "./PageBreak";
import { SearchHints } from "./SearchPanelParts";
import { ArrowUpRightIcon, ChevronDownIcon, ChevronRightIcon, FileIcon, HandsOnIcon, PackageIcon, PlusCircleIcon, QuizIcon, RowArrowIcon, SearchIcon, SmallXIcon, XCircleIcon } from "./icons";

/**
 * Manage Completions — search an employee or a cohort, then a certification
 * or a single task. The combination drives the view:
 *
 *   employee + cert  → accordion of every task with grades, attempts, timeline
 *   employee + task  → single task detail
 *   cohort   + cert  → matrix of everyone × the cert's tasks
 *   cohort   + task  → roster of everyone's status on one task
 *
 * From a cohort you can open any person beside the matrix/roster (split view).
 * Admin actions — mark complete (with optional grade), grant a quiz attempt,
 * mark a certification — overlay the generated baseline via local state and are
 * committed with the footer's Save Changes.
 *
 * Chrome is assembled from the shared design system (Figma "Components" page
 * 11:15114) rather than restyled here — see the `.mc-root` comment in
 * index.css for the component-by-component mapping.
 */

/* ───────────────────────── small presentational bits ───────────────────── */

/* Shared task-type glyphs (same map TasksPage uses). */
const TYPE_ICON: Record<TaskType, () => JSX.Element> = {
  xAPI: PackageIcon,
  Quiz: QuizIcon,
  "Hands-On Task": HandsOnIcon,
  Resource: FileIcon,
};

function TaskTypeIcon({ type }: { type: TaskType }) {
  const Icon = TYPE_ICON[type] ?? FileIcon;
  return (
    <span className="mc-typeicon">
      <Icon />
    </span>
  );
}

/** Status glyph used in the matrix grid and beside task names. */
function StatusDot({
  status,
  manual,
  size = 18,
}: {
  status: CellStatus;
  manual?: boolean;
  size?: number;
}) {
  const v = statusVisual(status, !!manual);
  return (
    <span
      className={`mc-dot mc-dot--${v.dot}${v.manual ? " is-manual" : ""}`}
      style={{ width: size, height: size }}
      aria-label={v.label}
    />
  );
}

/** Table Pill (Figma 109:1237) carrying the same status. */
function StatusPill({ status, manual }: { status: CellStatus; manual?: boolean }) {
  const v = statusVisual(status, !!manual);
  return <span className={`co-status-pill co-status-pill--${v.tone}`}>{v.label}</span>;
}

function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <span className="mc-avatar" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

/** Vertical event rail — same construction as the billing `.sub-timeline`. */
function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="mc-timeline">
      {events.map((ev, i) => (
        <div className="mc-tl-item" key={i}>
          <div className="mc-tl-rail">
            <span className={`mc-tl-dot mc-tl-dot--${ev.tone}`} />
            {i < events.length - 1 && <span className="mc-tl-divider" />}
          </div>
          <div className="mc-tl-body">
            <p className={`mc-tl-label${ev.tone === "future" ? " is-muted" : ""}`}>{ev.label}</p>
            <p className="mc-tl-ts">{ev.tsStr}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* metrics 4-up grid used in both detail views */
function MetricsGrid({ d }: { d: ReturnType<typeof buildDetail> }) {
  const cell = (label: string, value: ReactNode, big?: boolean) => (
    <div className="mc-metric">
      <div className="mc-metric-label">{label}</div>
      <div className={`mc-metric-value${big ? " is-big" : ""}`}>{value}</div>
    </div>
  );
  return (
    <div className="mc-metrics">
      {cell("Grade", d.gradeStr, true)}
      {cell("Done", d.completedStr)}
      {cell("Time", d.durStr)}
      {cell("Tries", d.attemptsStr)}
    </div>
  );
}

function QuizAttemptBox({
  d,
  onGrant,
  onViewAttempts,
}: {
  d: ReturnType<typeof buildDetail>;
  onGrant: () => void;
  onViewAttempts: () => void;
}) {
  return (
    <div className="mc-quizbox">
      <PageBreak label="Quiz attempts" />
      <div className="mc-quizbox-row">
        <span className="mc-quizbox-text">{d.attemptsRemainingStr}</span>
        <div className="mc-quizbox-actions">
          <button className="btn-save-draft" onClick={onViewAttempts}>
            View attempts
            <ArrowUpRightIcon />
          </button>
          <button className="btn-publish" onClick={onGrant}>
            Grant another attempt
          </button>
        </div>
      </div>
      {d.hasGrants && (
        <div className="mc-grantlog">
          {d.grantLog.map((g, i) => (
            <div className="mc-grantlog-row" key={i}>
              <span className="mc-grantlog-amount">{g.amountStr}</span>
              <span className="mc-grantlog-at">{g.atStr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── page ──────────────────────────────────── */

type Who = { kind: "employee" | "cohort"; id: string } | null;
type What = { kind: "cert" | "task"; id: string } | null;
type GradePrompt = { uid: string; tid: string; taskName: string; type: string } | null;

export function ContentOverridesPage({
  onViewAttempts,
  initialUserId,
}: {
  /** Opens the Attempts page for this employee + task, in a new tab. */
  onViewAttempts: (uid: string, tid: string) => void;
  /** Pre-selects this employee (e.g. arriving via "Manage Completions" from a user's row menu). */
  initialUserId?: string;
}) {
  const data = useMemo(() => buildData(), []);

  const [cells, setCells] = useState<CellMap>(() => data.cells);
  const [certManual, setCertManual] = useState<CertManual>({});

  /* Deferred save: `cells`/`certManual` are the working (live-preview) state;
     the *saved* baseline is committed only when the admin clicks Save Changes.
     Unchanged entries keep their exact object reference through the apply*
     helpers, so a reference diff against the baseline is an exact dirty check. */
  const [savedCells, setSavedCells] = useState<CellMap>(() => data.cells);
  const [savedCerts, setSavedCerts] = useState<CertManual>({});

  const [who, setWho] = useState<Who>(() =>
    initialUserId && data.employeesById[initialUserId] ? { kind: "employee", id: initialUserId } : null,
  );
  const [what, setWhat] = useState<What>(null);
  const [whoQ, setWhoQ] = useState("");
  const [whatQ, setWhatQ] = useState("");

  const [focusEmp, setFocusEmp] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [ftypes, setFtypes] = useState<string[]>([]);
  const [finalOnly, setFinalOnly] = useState(false);

  const [gradePrompt, setGradePrompt] = useState<GradePrompt>(null);
  const [gradeInput, setGradeInput] = useState("");

  /* selection */
  function selectWho(kind: "employee" | "cohort", id: string) {
    setWho({ kind, id });
    setWhoQ("");
    setFocusEmp(null);
    setExpanded({});
  }
  function selectWhat(kind: "cert" | "task", id: string) {
    setWhat({ kind, id });
    setWhatQ("");
    setFocusEmp(null);
    setExpanded({});
  }
  function clearWho() {
    setWho(null);
    setWhoQ("");
    setFocusEmp(null);
    setExpanded({});
  }
  function clearWhat() {
    setWhat(null);
    setWhatQ("");
    setFocusEmp(null);
    setExpanded({});
  }
  function setScope(w: NonNullable<Who>, x: NonNullable<What>) {
    setWho(w);
    setWhat(x);
    setWhoQ("");
    setWhatQ("");
    setFocusEmp(null);
    setExpanded({});
    setFtypes([]);
    setFinalOnly(false);
  }

  /* focus / accordion */
  const focusName = (uid: string) => setFocusEmp(uid);
  const focusCell = (uid: string, tid: string) => {
    setFocusEmp(uid);
    setExpanded((e) => ({ ...e, [tid]: true }));
  };
  const clearFocus = () => setFocusEmp(null);
  const toggleExpand = (tid: string) =>
    setExpanded((e) => {
      const n = { ...e };
      if (n[tid]) delete n[tid];
      else n[tid] = true;
      return n;
    });

  /* mutations */
  const doGrant = (uid: string, tid: string) => setCells((c) => applyGrantAttempt(c, uid, tid));
  function requestMark(uid: string, tid: string) {
    const t = data.tasksById[tid];
    if (t && needsGradePrompt(t)) {
      setGradePrompt({ uid, tid, taskName: t.name, type: t.type });
      setGradeInput("");
    } else {
      setCells((c) => applyMarkComplete(c, uid, tid, null));
    }
  }
  function confirmGrade() {
    if (!gradePrompt) return;
    const raw = gradeInput.trim();
    const grade = raw === "" ? null : Number(raw);
    setCells((c) => applyMarkComplete(c, gradePrompt.uid, gradePrompt.tid, grade));
    setGradePrompt(null);
    setGradeInput("");
  }
  const markCert = (uid: string, cid: string) => setCertManual((m) => applyMarkCert(m, uid, cid));
  const undoCert = (uid: string, cid: string) => setCertManual((m) => applyClearCert(m, uid, cid));

  /* ───── unsaved-changes tracking (deferred save) ───── */
  const pendingCount = useMemo(() => {
    let n = 0;
    const cellKeys = new Set([...Object.keys(cells), ...Object.keys(savedCells)]);
    cellKeys.forEach((k) => {
      if (cells[k] !== savedCells[k]) n++;
    });
    const certKeys = new Set([...Object.keys(certManual), ...Object.keys(savedCerts)]);
    certKeys.forEach((k) => {
      if (certManual[k] !== savedCerts[k]) n++;
    });
    return n;
  }, [cells, certManual, savedCells, savedCerts]);
  const dirty = pendingCount > 0;

  const saveChanges = () => {
    setSavedCells(cells);
    setSavedCerts(certManual);
    setGradePrompt(null);
    setGradeInput("");
  };
  const discardChanges = () => {
    setCells(savedCells);
    setCertManual(savedCerts);
    setGradePrompt(null);
    setGradeInput("");
  };

  /* ───── derived scope ───── */
  const whoUser = who?.kind === "employee" ? data.employeesById[who.id] : null;
  const cohortId = who?.kind === "cohort" ? who.id : null;
  const certObj = what?.kind === "cert" ? data.certsById[what.id] : null;
  const taskObj = what?.kind === "task" ? data.tasksById[what.id] : null;

  const empScope = !!whoUser;
  const cohortScope = !!cohortId;
  const whatCert = !!certObj;
  const whatTask = !!taskObj;

  const hasScope = !!(who && what);
  const isLanding = !who && !what;
  const isHalf = !!who !== !!what;

  const activeEmpId = empScope ? who!.id : focusEmp;
  const split = cohortScope && !!focusEmp;

  /* cert task lists + filters */
  const ctAll: CertTask[] = certObj
    ? certObj.taskIds.map((id) => data.tasksById[id]).filter(Boolean)
    : [];
  const types: string[] = [];
  ctAll.forEach((t) => {
    if (!types.includes(t.type)) types.push(t.type);
  });
  const anyType = ftypes.length > 0;
  const ctF = ctAll.filter((t) => (!anyType || ftypes.includes(t.type)) && (!finalOnly || t.isFinal));
  const filtersActive = anyType || finalOnly;

  const showMatrix = cohortScope && whatCert;
  const showRoster = cohortScope && whatTask;
  const showCertDetail = whatCert && !!activeEmpId;
  const showTaskDetail = whatTask && !!activeEmpId;
  const showPickHint = cohortScope && !focusEmp;

  const cohortMembers: Employee[] =
    cohortId != null
      ? (data.cohorts.find((c) => c.id === cohortId)?.userIds ?? []).map((id) => data.employeesById[id])
      : [];

  const focusUser = focusEmp ? data.employeesById[focusEmp] : null;

  /* ───── search matches ───── */
  const whoQl = whoQ.trim().toLowerCase();
  const cohortMatches = data.cohorts.filter((c) => !whoQl || c.name.toLowerCase().includes(whoQl));
  const peopleMatches = (
    whoQl
      ? data.employees.filter(
          (e) => e.name.toLowerCase().includes(whoQl) || e.contact.toLowerCase().includes(whoQl),
        )
      : data.employees
  ).slice(0, 8);

  const whatQl = whatQ.trim().toLowerCase();
  const certMatches = data.certifications.filter((c) => !whatQl || c.name.toLowerCase().includes(whatQl));
  const taskMatches = (whatQl ? data.tasks.filter((t) => t.name.toLowerCase().includes(whatQl)) : []).slice(0, 10);

  /* ───── combobox option lists ───── */
  const whoOptions: ScopeOption[] = [
    ...cohortMatches.map((c) => ({
      key: "cohort_" + c.id,
      section: "Cohorts",
      onSelect: () => selectWho("cohort", c.id),
      node: (
        <>
          <span className="usearch-chip">Cohort</span>
          <span className="usearch-user-text">
            <span className="usearch-user-name">{c.name}</span>
          </span>
          <span className="usearch-row-desc">
            {c.userIds.length} {c.userIds.length === 1 ? "employee" : "employees"}
          </span>
        </>
      ),
    })),
    ...peopleMatches.map((e) => ({
      key: "emp_" + e.id,
      section: "Employees",
      onSelect: () => selectWho("employee", e.id),
      node: (
        <>
          <Avatar initials={e.initials} size={30} />
          <span className="usearch-user-text">
            <span className="usearch-user-name">{e.name}</span>
            <span className="usearch-user-sub">{e.contact}</span>
          </span>
          <span className="usearch-row-desc">{e.cohort ?? "B2C"}</span>
        </>
      ),
    })),
  ];

  const whatOptions: ScopeOption[] = [
    ...certMatches.map((c) => ({
      key: "cert_" + c.id,
      section: "Certifications",
      onSelect: () => selectWhat("cert", c.id),
      node: (
        <>
          <span className="usearch-chip">Cert</span>
          <span className="usearch-user-text">
            <span className="usearch-user-name">{c.name}</span>
            <span className="usearch-user-sub">{c.industry}</span>
          </span>
          <span className="usearch-row-desc">{c.taskIds.length} tasks</span>
        </>
      ),
    })),
    ...taskMatches.map((t) => ({
      key: "task_" + t.id,
      section: "Tasks",
      onSelect: () => selectWhat("task", t.id),
      node: (
        <>
          <TaskTypeIcon type={t.type} />
          <span className="usearch-user-text">
            <span className="usearch-user-name">{t.name}</span>
            <span className="usearch-user-sub">{t.certName}</span>
          </span>
          <span className="usearch-row-desc">{t.type}</span>
        </>
      ),
    })),
  ];

  /* ───── selected-scope tokens ───── */
  const whoScope = whoUser
    ? { label: "Employee", name: whoUser.name }
    : cohortId
    ? { label: "Cohort", name: cohortId }
    : null;
  const whatScope = certObj
    ? { label: "Certification", name: certObj.name }
    : taskObj
    ? { label: "Task", name: taskObj.name }
    : null;

  /* examples (real entities) */
  const examples = [
    { who: "Diego Ramirez", what: "EPA 608 Type I", w: { kind: "employee", id: "U-10132" } as const, x: { kind: "cert", id: "C-0420" } as const },
    { who: "ARS Cooling & Heating", what: "HVAC Field Skills", w: { kind: "cohort", id: "ARS Cooling & Heating" } as const, x: { kind: "cert", id: "C-0398" } as const },
    { who: "Ayesha Khan", what: "Refrigerant Charging", w: { kind: "employee", id: "U-10157" } as const, x: { kind: "task", id: "T-2350" } as const },
  ].filter((ex) => {
    // Only show examples whose entities resolve in the built model.
    const wok = ex.w.kind === "cohort" ? data.cohorts.some((c) => c.id === ex.w.id) : !!data.employeesById[ex.w.id];
    const xok = ex.x.kind === "cert" ? !!data.certsById[ex.x.id] : !!data.tasksById[ex.x.id];
    return wok && xok;
  });

  /* half-state copy */
  const half =
    who && !what
      ? { title: "Now pick what to check", sub: "Search a certification or a single task above.", num: "2" }
      : { title: "Now pick who to check", sub: "Search an employee or a cohort above.", num: "1" };

  return (
    <div className="main">
      <div className="workspace">
        <div className="mc-root">
          {/* ===== page header (Figma 46:314) ===== */}
          <header className="mc-header">
            <h1 className="tasks-title">Manage Completions</h1>
            <div className="tasks-subtitle">
              Look up an employee or a cohort, then a certification or a single task, to review and
              override completions.
            </div>
          </header>

          {/* ===== scope pickers ===== */}
          <div className="mc-scoperow">
            <ScopeSearch
              placeholder="Search employee or cohort…"
              scope={whoScope}
              query={whoQ}
              onQuery={setWhoQ}
              onClearScope={clearWho}
              options={whoOptions}
              emptyText="No employees or cohorts match."
              showKbd
            />
            <span className="mc-scope-sep">
              <ChevronRightIcon />
            </span>
            <ScopeSearch
              placeholder="Search certification or task…"
              scope={whatScope}
              query={whatQ}
              onQuery={setWhatQ}
              onClearScope={clearWhat}
              options={whatOptions}
              emptyText="No certifications or tasks match."
            />
          </div>

          {/* ===== task filters (certification scope only) ===== */}
          {hasScope && certObj && (
            <div className="filters mc-filters">
              <Dropdown
                width={260}
                trigger={({ open, toggle }) => (
                  <PillTrigger
                    label="Task Type"
                    value={summarize(ftypes, types)}
                    open={open}
                    toggle={toggle}
                    onClear={() => setFtypes([])}
                  />
                )}
              >
                {({ close }) => (
                  <SectionedMultiSelect
                    sections={[{ items: types }]}
                    value={ftypes}
                    onApply={(v) => {
                      setFtypes(v);
                      close();
                    }}
                  />
                )}
              </Dropdown>

              {finalOnly ? (
                <span className="filter-applied">
                  <button
                    className="filter-applied-clear"
                    onClick={() => setFinalOnly(false)}
                    aria-label="Clear Final Exam filter"
                  >
                    <XCircleIcon />
                  </button>
                  <button className="filter-applied-main" onClick={() => setFinalOnly(false)}>
                    <span className="label">Final Exam</span>
                    <span className="sep" />
                    <span className="value">Only</span>
                  </button>
                </span>
              ) : (
                <button className="filter-pill-dashed" onClick={() => setFinalOnly(true)}>
                  <span className="icon">
                    <PlusCircleIcon />
                  </span>
                  Final Exam
                </button>
              )}

              {filtersActive && (
                <button
                  className="filter-clear-link"
                  onClick={() => {
                    setFtypes([]);
                    setFinalOnly(false);
                  }}
                >
                  Clear Filters
                </button>
              )}

              {/* Legend for the status glyphs used by the matrix + accordion. */}
              <span className="filters-end mc-filters-end">
                <span className="mc-legend">
                  <span className="mc-legend-item">
                    <StatusDot status="incomplete" size={14} />
                    Incomplete
                  </span>
                  <span className="mc-legend-item">
                    <StatusDot status="review" size={14} />
                    In Review
                  </span>
                  <span className="mc-legend-item">
                    <StatusDot status="complete" size={14} />
                    Complete
                  </span>
                </span>
                <span className="mc-filter-count">
                  {ctF.length === ctAll.length
                    ? `${ctAll.length} tasks`
                    : `${ctF.length} of ${ctAll.length} tasks`}
                </span>
              </span>
            </div>
          )}

          {/* ===== body ===== */}
          <main className="mc-body">
            {isLanding && (
              <div className="mc-empty">
                <div className="mc-empty-inner">
                  <span className="mc-empty-icon">
                    <SearchIcon />
                  </span>
                  <div className="mc-empty-title">Find someone, then pick what to check</div>
                  <div className="mc-empty-sub">
                    Search an <strong>employee or a cohort</strong>, then a{" "}
                    <strong>certification or a single task</strong>. Pick a cohort to see everyone in a
                    matrix and open any person beside it.
                  </div>
                  {examples.length > 0 && (
                    <>
                      <PageBreak label="Jump to an example" />
                      <div className="mc-examples">
                        {examples.map((ex, i) => (
                          <button key={i} className="btn-save-draft mc-example" onClick={() => setScope(ex.w, ex.x)}>
                            <span>{ex.who}</span>
                            <ChevronRightIcon />
                            <span className="mc-example-what">{ex.what}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {isHalf && (
              <div className="mc-empty">
                <div className="mc-empty-inner is-narrow">
                  <span className="mc-empty-step">{half.num}</span>
                  <div className="mc-empty-title">{half.title}</div>
                  <div className="mc-empty-sub">{half.sub}</div>
                </div>
              </div>
            )}

            {hasScope && (
              <div className="mc-split">
                {/* LEFT: matrix */}
                {showMatrix && (
                  <Matrix
                    members={cohortMembers}
                    columns={ctF}
                    certId={certObj!.id}
                    allTasks={ctAll}
                    cells={cells}
                    certManual={certManual}
                    focusEmp={focusEmp}
                    expanded={expanded}
                    onOpenEmp={focusName}
                    onCell={focusCell}
                    onMarkCert={markCert}
                  />
                )}

                {/* LEFT: roster */}
                {showRoster && (
                  <Roster
                    members={cohortMembers}
                    task={taskObj!}
                    cells={cells}
                    compact={split}
                    focusEmp={focusEmp}
                    onOpen={focusName}
                    onGrant={doGrant}
                    onMark={requestMark}
                    onViewAttempts={onViewAttempts}
                  />
                )}

                {/* pick hint */}
                {showPickHint && (
                  <div className="mc-detail mc-detail--split mc-pickhint">
                    <div className="mc-empty-inner is-narrow">
                      <span className="mc-empty-icon">
                        <RowArrowIcon />
                      </span>
                      <div className="mc-empty-title">Open someone</div>
                      <div className="mc-empty-sub">
                        Click a name or a cell to see {showRoster ? "their task detail" : "their tasks"} on
                        this side — the {showRoster ? "list" : "matrix"} stays put.
                      </div>
                    </div>
                  </div>
                )}

                {/* RIGHT: employee + cert (accordion) */}
                {showCertDetail && (
                  <div className={`mc-detail${split ? " mc-detail--split" : ""}`}>
                    {split && focusUser && <FocusHeader user={focusUser} onClose={clearFocus} />}
                    <div className="mc-detail-scroll">
                      <div className={`mc-detail-inner${split ? " is-split" : ""}`}>
                        <CertDetail
                          uid={activeEmpId!}
                          certId={certObj!.id}
                          allTasks={ctAll}
                          filteredTasks={ctF}
                          cells={cells}
                          certManual={certManual}
                          expanded={expanded}
                          onToggle={toggleExpand}
                          onMark={requestMark}
                          onGrant={doGrant}
                          onMarkCert={markCert}
                          onUndoCert={undoCert}
                          onViewAttempts={onViewAttempts}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* RIGHT: employee + task */}
                {showTaskDetail && (
                  <div className={`mc-detail${split ? " mc-detail--split" : ""}`}>
                    {split && focusUser && <FocusHeader user={focusUser} onClose={clearFocus} />}
                    <div className="mc-detail-scroll">
                      <div className={`mc-detail-inner${split ? " is-split" : ""}`}>
                        <TaskDetailPanel
                          uid={activeEmpId!}
                          task={taskObj!}
                          cells={cells}
                          onGrant={doGrant}
                          onMark={requestMark}
                          onViewAttempts={onViewAttempts}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ===== unsaved-changes footer (deferred save, like the wizards) ===== */}
          {dirty && (
            <footer className="wizard-footer mc-footer">
              <span className="mc-dirty">
                <span className="mc-dirty-dot" />
                <strong>
                  {pendingCount} unsaved {pendingCount === 1 ? "change" : "changes"}
                </strong>
                <span className="mc-dirty-sub"> — not applied yet</span>
              </span>
              <div className="wizard-actions">
                <button className="btn-save-draft" onClick={discardChanges}>
                  Discard
                </button>
                <button className="btn-publish" onClick={saveChanges}>
                  Save Changes
                </button>
              </div>
            </footer>
          )}

          {/* grade prompt */}
          {gradePrompt && (
            <div
              className="pm-overlay"
              onClick={() => {
                setGradePrompt(null);
                setGradeInput("");
              }}
            >
              <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pm-head">
                  <h2 className="pm-title">Mark Complete</h2>
                  <div className="pm-sub">
                    {gradePrompt.taskName} · {gradePrompt.type}
                  </div>
                </div>
                <div className="pm-body">
                  <div className="pm-field">
                    <label className="form-label" htmlFor="mc-grade">
                      Grade
                    </label>
                    <div className="mc-gradefield">
                      <input
                        id="mc-grade"
                        className="form-input"
                        type="number"
                        min={0}
                        max={100}
                        autoFocus
                        value={gradeInput}
                        onChange={(e) => setGradeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmGrade();
                        }}
                        placeholder="Optional"
                      />
                      <span className="mc-gradefield-suffix">/ 100</span>
                    </div>
                    <p className="form-help">
                      Enter a grade, or leave blank to mark complete without one.
                    </p>
                  </div>
                </div>
                <div className="pm-foot">
                  <button
                    className="btn-save-draft"
                    onClick={() => {
                      setGradePrompt(null);
                      setGradeInput("");
                    }}
                  >
                    Cancel
                  </button>
                  <button className="btn-publish" onClick={confirmGrade}>
                    Mark Complete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── scope search combobox (Figma "Expanded Search") ──── */

type ScopeOption = {
  key: string;
  /** Section heading this row belongs under (`.usearch-head`). */
  section: string;
  node: ReactNode;
  onSelect: () => void;
};

/**
 * The shared `.usearch` combobox (as used by Manage Users / Tasks / Review).
 * A committed selection shows as a `.usearch-scope` token inside the bar and
 * is cleared with Backspace on an empty input — the app-wide scope-token rule.
 */
function ScopeSearch({
  placeholder,
  scope,
  query,
  onQuery,
  onClearScope,
  options,
  emptyText,
  showKbd,
}: {
  placeholder: string;
  scope: { label: string; name: string } | null;
  query: string;
  onQuery: (v: string) => void;
  onClearScope: () => void;
  options: ScopeOption[];
  emptyText: string;
  showKbd?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setActive(-1), [query, scope?.name]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(opt: ScopeOption) {
    opt.onSelect();
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[active >= 0 ? active : 0];
      if (opt) choose(opt);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && scope) {
      onClearScope();
    }
  }

  /* Group consecutive options by section so each gets one `.usearch-head`. */
  let lastSection = "";

  return (
    <div className="usearch mc-search" ref={wrapRef}>
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        {scope && (
          <span className="usearch-scope" title={`${scope.label}: ${scope.name} — press Backspace to clear`}>
            <span className="usearch-scope-label">{scope.label}:</span>
            <span className="usearch-scope-name">{scope.name}</span>
          </span>
        )}
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder={scope ? "Change…" : placeholder}
          value={query}
          onChange={(e) => {
            onQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {showKbd && (
          <span className="usearch-kbd">
            <span className="kbd-cmd">⌘</span>
            <span className="kbd-letter">K</span>
          </span>
        )}
      </div>

      {open && (
        <div className="usearch-panel">
          {options.length === 0 ? (
            <div className="usearch-empty">{emptyText}</div>
          ) : (
            options.map((opt, i) => {
              const head = opt.section !== lastSection ? opt.section : null;
              lastSection = opt.section;
              return (
                <div key={opt.key}>
                  {head && <div className="usearch-head">{head}</div>}
                  <button
                    className={`usearch-row ${active === i ? "active" : ""}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(opt)}
                  >
                    {opt.node}
                  </button>
                </div>
              );
            })
          )}
          <SearchHints />
        </div>
      )}
    </div>
  );
}

function FocusHeader({ user, onClose }: { user: Employee; onClose: () => void }) {
  return (
    <div className="mc-focushead">
      <Avatar initials={user.initials} size={32} />
      <div className="mc-focushead-text">
        <div className="mc-focushead-name">{user.name}</div>
        <div className="mc-focushead-sub">
          {(user.cohort ? user.cohort + " · " : "") + user.contact}
        </div>
      </div>
      <button className="mc-iconbtn" onClick={onClose} title="Back to cohort" aria-label="Back to cohort">
        <SmallXIcon />
      </button>
    </div>
  );
}

/* ─────────────────────────────── matrix ────────────────────────────────── */

function Matrix({
  members,
  columns,
  certId,
  allTasks,
  cells,
  certManual,
  focusEmp,
  expanded,
  onOpenEmp,
  onCell,
  onMarkCert,
}: {
  members: Employee[];
  columns: CertTask[];
  certId: string;
  allTasks: CertTask[];
  cells: CellMap;
  certManual: CertManual;
  focusEmp: string | null;
  expanded: Record<string, boolean>;
  onOpenEmp: (uid: string) => void;
  onCell: (uid: string, tid: string) => void;
  onMarkCert: (uid: string, cid: string) => void;
}) {
  return (
    <div className="mc-matrix-scroll">
      <div className="mc-matrix">
        {/* header */}
        <div className="mc-matrix-head">
          <div className="mc-matrix-namecell mc-matrix-headcell">
            <span className="page-break-label">Employee · {members.length}</span>
          </div>
          {columns.map((t) => (
            <div
              key={t.id}
              title={t.name}
              className={`mc-matrix-colhead${t.isFinal ? " is-final" : ""}`}
            >
              <TaskTypeIcon type={t.type} />
              <span className="mc-matrix-colname">{t.name}</span>
            </div>
          ))}
          <div className="mc-matrix-certcell mc-matrix-headcell">
            <span className="page-break-label">Certification</span>
          </div>
        </div>

        {/* rows */}
        {members.map((u) => {
          const ps = progress(cells, certManual, u.id, allTasks, certId);
          const isFocus = focusEmp === u.id;
          return (
            <div className={`mc-matrix-row${isFocus ? " is-focus" : ""}`} key={u.id}>
              <div
                className="mc-matrix-namecell mc-matrix-name"
                role="button"
                tabIndex={0}
                onClick={() => onOpenEmp(u.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onOpenEmp(u.id);
                }}
                title={`Open all tasks for ${u.name}`}
              >
                <Avatar initials={u.initials} size={28} />
                <span className="mc-matrix-nametext">
                  <span className="mc-matrix-nameline">{u.name}</span>
                  <span className="mc-matrix-pct">{ps.pct}%</span>
                </span>
              </div>
              {columns.map((t) => {
                const cl = cells[u.id + "_" + t.id];
                const cellFocus = isFocus && expanded[t.id];
                return (
                  <div
                    key={t.id}
                    className={`mc-matrix-cell${t.isFinal ? " is-final" : ""}${cellFocus ? " is-open" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onCell(u.id, t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onCell(u.id, t.id);
                    }}
                    title={`${u.name} · ${t.name} — ${statusVisual(cl.status, cl.manual).label}${
                      cl.grade ? " · " + cl.grade + "/100" : ""
                    }`}
                  >
                    <StatusDot status={cl.status} manual={cl.manual} size={18} />
                  </div>
                );
              })}
              <div className="mc-matrix-certcell">
                {ps.certified ? (
                  <span
                    className={`co-status-pill co-status-pill--${ps.certManual ? "accent" : "green"}`}
                  >
                    {ps.certManual ? "Manual" : "Certified"}
                  </span>
                ) : (
                  <button
                    className="btn-save-draft mc-btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkCert(u.id, certId);
                    }}
                  >
                    Mark Cert
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────── roster ────────────────────────────────── */

function Roster({
  members,
  task,
  cells,
  compact,
  focusEmp,
  onOpen,
  onGrant,
  onMark,
  onViewAttempts,
}: {
  members: Employee[];
  task: CertTask;
  cells: CellMap;
  compact: boolean;
  focusEmp: string | null;
  onOpen: (uid: string) => void;
  onGrant: (uid: string, tid: string) => void;
  onMark: (uid: string, tid: string) => void;
  onViewAttempts: (uid: string, tid: string) => void;
}) {
  return (
    <div className="mc-roster-scroll">
      <table className="mc-table">
        <thead>
          <tr>
            <th>Employee · {members.length}</th>
            <th className="mc-col-status">Task Status</th>
            {!compact && <th className="mc-col-attempts">Attempts Left</th>}
            {!compact && <th className="mc-col-actions" />}
            <th className="mc-col-open" />
          </tr>
        </thead>
        <tbody>
          {members.map((u) => {
            const cl = cells[u.id + "_" + task.id];
            const ai = attemptInfo(task, cl);
            const isFocus = focusEmp === u.id;
            return (
              <tr key={u.id} className={isFocus ? "is-focus" : ""} onClick={() => onOpen(u.id)}>
                <td>
                  <div className="mc-cell-user">
                    <Avatar initials={u.initials} size={32} />
                    <span className="mc-cell-user-text">
                      <span className="mc-cell-user-name">{u.name}</span>
                      {!compact && <span className="mc-cell-user-sub">{u.contact}</span>}
                    </span>
                  </div>
                </td>
                <td className="mc-col-status">
                  <StatusPill status={cl.status} manual={cl.manual} />
                  {!compact && cl.grade ? <span className="mc-grade">{cl.grade}/100</span> : null}
                </td>
                {!compact && (
                  <td className="mc-col-attempts">
                    {ai.hasLimit ? `${ai.remaining} of ${ai.totalAllowed}` : "—"}
                  </td>
                )}
                {!compact && (
                  <td className="mc-col-actions">
                    <div className="mc-rowactions">
                      {ai.hasLimit && (
                        <button
                          className="mc-iconbtn"
                          title="View attempts"
                          aria-label="View attempts"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewAttempts(u.id, task.id);
                          }}
                        >
                          <ArrowUpRightIcon />
                        </button>
                      )}
                      {ai.hasLimit && (
                        <button
                          className="btn-save-draft mc-btn-sm"
                          title="Grant another attempt"
                          onClick={(e) => {
                            e.stopPropagation();
                            onGrant(u.id, task.id);
                          }}
                        >
                          Grant
                        </button>
                      )}
                      {cl.status !== "complete" && (
                        <button
                          className="btn-publish mc-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onMark(u.id, task.id);
                          }}
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </td>
                )}
                <td className="mc-col-open">
                  <span className="row-arrow">
                    <RowArrowIcon />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────── employee + cert (accordion) ──────────────────────── */

function CertDetail({
  uid,
  certId,
  allTasks,
  filteredTasks,
  cells,
  certManual,
  expanded,
  onToggle,
  onMark,
  onGrant,
  onMarkCert,
  onUndoCert,
  onViewAttempts,
}: {
  uid: string;
  certId: string;
  allTasks: CertTask[];
  filteredTasks: CertTask[];
  cells: CellMap;
  certManual: CertManual;
  expanded: Record<string, boolean>;
  onToggle: (tid: string) => void;
  onMark: (uid: string, tid: string) => void;
  onGrant: (uid: string, tid: string) => void;
  onMarkCert: (uid: string, cid: string) => void;
  onUndoCert: (uid: string, cid: string) => void;
  onViewAttempts: (uid: string, tid: string) => void;
}) {
  const ps = progress(cells, certManual, uid, allTasks, certId);
  const remain = ps.rv + ps.inc;
  return (
    <>
      <div className="mc-notice">
        <div className="mc-notice-text">
          <div className="mc-notice-title">
            {ps.certified
              ? ps.certManual
                ? "Certification marked complete by admin"
                : "Certification complete"
              : `${remain} task${remain === 1 ? "" : "s"} still open before certified`}
          </div>
          <div className="mc-notice-sub">
            {ps.certified
              ? (ps.certManual ? "Manually certified " : "Certified ") + (ps.certAt ? fmtDT(ps.certAt) : "—")
              : `${ps.pct}% of this certification complete`}
          </div>
        </div>
        {ps.certified ? (
          ps.certManual && (
            <button className="btn-save-draft" onClick={() => onUndoCert(uid, certId)}>
              Undo
            </button>
          )
        ) : (
          <button className="btn-publish" onClick={() => onMarkCert(uid, certId)}>
            Mark Certification Complete
          </button>
        )}
      </div>

      <div className="mc-acc-list">
        {filteredTasks.map((t) => (
          <AccordionCard
            key={t.id}
            uid={uid}
            task={t}
            cells={cells}
            expanded={!!expanded[t.id]}
            onToggle={() => onToggle(t.id)}
            onMark={() => onMark(uid, t.id)}
            onGrant={() => onGrant(uid, t.id)}
            onViewAttempts={() => onViewAttempts(uid, t.id)}
          />
        ))}
      </div>
    </>
  );
}

function AccordionCard({
  uid,
  task,
  cells,
  expanded,
  onToggle,
  onMark,
  onGrant,
  onViewAttempts,
}: {
  uid: string;
  task: CertTask;
  cells: CellMap;
  expanded: boolean;
  onToggle: () => void;
  onMark: () => void;
  onGrant: () => void;
  onViewAttempts: () => void;
}) {
  const cl = cells[uid + "_" + task.id];
  const manual = cl.status === "complete" && cl.manual;
  const detail = expanded ? buildDetail(cells, uid, task) : null;

  const metaBits: string[] = [];
  if (cl.status === "complete" && cl.grade) metaBits.push("Grade " + cl.grade + "/100");
  if (cl.completedAt) metaBits.push(fmtD(cl.completedAt));

  return (
    <div className={`mc-acc${expanded ? " is-open" : ""}`}>
      <div className="mc-acc-head" role="button" tabIndex={0} onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
      >
        <StatusDot status={cl.status} manual={manual} size={24} />
        <div className="mc-acc-text">
          <div className="mc-acc-titlerow">
            <TaskTypeIcon type={task.type} />
            <span className="mc-acc-name">{task.name}</span>
            {task.isFinal && <span className="co-status-pill co-status-pill--accent">Final</span>}
            {manual && <span className="co-status-pill co-status-pill--accent">Manual</span>}
          </div>
          <div className="mc-acc-meta">
            <StatusPill status={cl.status} manual={manual} />
            {metaBits.length > 0 && <span className="mc-acc-metatext">{metaBits.join(" · ")}</span>}
          </div>
        </div>
        <span className="mc-acc-caret">
          <ChevronDownIcon />
        </span>
      </div>
      {expanded && detail && (
        <div className="mc-acc-body">
          <MetricsGrid d={detail} />
          {detail.isQuizLimited && (
            <QuizAttemptBox d={detail} onGrant={onGrant} onViewAttempts={onViewAttempts} />
          )}
          <PageBreak label="Status timeline" />
          <Timeline events={detail.timeline} />
          {cl.status !== "complete" && (
            <button
              className="btn-publish mc-acc-cta"
              onClick={(e) => {
                e.stopPropagation();
                onMark();
              }}
            >
              Mark Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── employee + task ─────────────────────────────── */

function TaskDetailPanel({
  uid,
  task,
  cells,
  onGrant,
  onMark,
  onViewAttempts,
}: {
  uid: string;
  task: CertTask;
  cells: CellMap;
  onGrant: (uid: string, tid: string) => void;
  onMark: (uid: string, tid: string) => void;
  onViewAttempts: (uid: string, tid: string) => void;
}) {
  const cl = cells[uid + "_" + task.id];
  const manual = cl.status === "complete" && cl.manual;
  const detail = buildDetail(cells, uid, task);

  return (
    <div className="mc-taskcard">
      <div className="mc-taskcard-head">
        <StatusDot status={cl.status} manual={manual} size={24} />
        <div className="mc-taskcard-text">
          <div className="mc-acc-titlerow">
            <TaskTypeIcon type={task.type} />
            <span className="mc-acc-name">{task.name}</span>
            {task.isFinal && <span className="co-status-pill co-status-pill--accent">Final</span>}
          </div>
          <div className="mc-acc-metatext">
            {task.certName} · {task.type}
          </div>
        </div>
        <StatusPill status={cl.status} manual={manual} />
      </div>

      <div className="mc-taskcard-body">
        <MetricsGrid d={detail} />
        {detail.isQuizLimited && (
          <QuizAttemptBox
            d={detail}
            onGrant={() => onGrant(uid, task.id)}
            onViewAttempts={() => onViewAttempts(uid, task.id)}
          />
        )}
        <PageBreak label="Status timeline" />
        <Timeline events={detail.timeline} />
      </div>

      <div className="mc-taskcard-foot">
        {cl.status !== "complete" && (
          <button className="btn-publish" onClick={() => onMark(uid, task.id)}>
            Mark Complete
          </button>
        )}
        <span className="mc-taskcard-note">{detail.footerNote}</span>
      </div>
    </div>
  );
}
