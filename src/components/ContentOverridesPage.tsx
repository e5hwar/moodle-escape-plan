import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import type { TaskType } from "../data/tasks";
import {
  ADMIN_ACTOR,
  ADMIN_STAMP,
  applyDeleteAttempt,
  applyGrantAttempt,
  applyMarkCert,
  applyMarkComplete,
  attemptInfo,
  attemptsForTask,
  buildData,
  isExhausted,
  needsGradePrompt,
  progress,
  statusVisual,
  fmtD,
  fmtDT,
  type Cell,
  type CellMap,
  type CertManual,
  type CertTask,
  type Employee,
} from "../data/certLookup";
import { questions as bankQuestions } from "../data/questionBank";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { PrmModal } from "./PrmModal";
import { SectionHeading } from "./SectionHeading";
import { SearchHints } from "./SearchPanelParts";
import { Stepper } from "./Stepper";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  HandsOnIcon,
  KeyCommandIcon,
  PackageIcon,
  PlusCircleIcon,
  QuizIcon,
  RowExternalLinkIcon,
  RowKebabIcon,
  SearchIcon,
  XCircleIcon,
} from "./icons";

/**
 * Manage Completions — search an employee or a cohort, then a certification
 * or a single task. The combination drives the view (Claude Design "Progress
 * Admin - Prototype"):
 *
 *   cohort   + cert  → roster of everyone with progress; a row expands inline
 *                      into that person's task table
 *   cohort   + task  → roster of everyone's status on one task (grade,
 *                      attempts, marked-by)
 *   employee + cert  → cert summary notice + that person's task table
 *   employee + task  → single task card with metrics + attempt history
 *
 * Admin actions — mark a task or a whole certification complete, grant quiz
 * attempts, delete a quiz attempt — are STAGED, not applied: each toggles a
 * "Staged" pill in place and lands in the footer, and Review & Save opens a
 * confirm dialog listing every change (with an optional reason) before
 * anything is committed. Everything applied is logged as ADMIN_ACTOR.
 *
 * Chrome is assembled from the shared design system (Figma "Components" page
 * 11:15114) rather than restyled here — see the `.mc-root` comment in
 * index.css for the component-by-component mapping.
 */

/* Pass mark for a quiz attempt's Pass / Fail pill. */
const PASS_PCT = 70;

/* Most attempts one grant can stage. */
const MAX_GRANT = 10;

/* Questions shown in the attempt-detail answers list. */
const ANSWER_COUNT = 8;

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

function Avatar({ initials, size = 28 }: { initials: string; size?: number }) {
  return (
    <span className="mc-avatar" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

/** Table Pill (Figma 109:1237) carrying a task's status, staged state first:
 *  Staged: Complete → Attempts Exhausted → the base status vocabulary. */
function TaskStatusPill({
  task,
  cell,
  staged,
}: {
  task: CertTask;
  cell: Cell;
  staged: boolean;
}) {
  if (staged) return <span className="co-status-pill co-status-pill--accent">Staged: Complete</span>;
  if (isExhausted(task, cell))
    return <span className="co-status-pill co-status-pill--red">Attempts Exhausted</span>;
  const v = statusVisual(cell.status, cell.status === "complete" && cell.manual);
  return <span className={`co-status-pill co-status-pill--${v.tone}`}>{v.label}</span>;
}

/** A clickable pill — staged states double as their own undo. */
function PillButton({
  tone,
  label,
  onClick,
  title,
}: {
  tone: "accent" | "red";
  label: string;
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}) {
  return (
    <button className="mc-unbtn" onClick={onClick} title={title}>
      <span className={`co-status-pill co-status-pill--${tone}`}>{label}</span>
    </button>
  );
}

/* ─────────────────────────────── staging model ─────────────────────────── */

type Staged =
  | { kind: "complete"; uid: string; tid: string; grade: number | null }
  | { kind: "cert"; uid: string; certId: string; tids: string[] }
  | { kind: "grant"; uid: string; tid: string; n: number }
  | { kind: "del"; uid: string; tid: string; attemptNumber: number };

/* ─────────────────────────────── page ──────────────────────────────────── */

type Who = { kind: "employee" | "cohort"; id: string } | null;
type What = { kind: "cert" | "task"; id: string } | null;
type GradePrompt = { uid: string; tid: string; taskName: string; type: string } | null;
type TaskRef = { uid: string; tid: string } | null;
type MenuState = { uid: string; tid: string; rect: DOMRect } | null;

export function ContentOverridesPage({
  onViewAttempts,
  initialUserId,
  initialCohort,
  initialCertId,
  initialTaskId,
  backLabel,
  onBack,
}: {
  /** Opens the Attempts page for this employee + task, in a new tab. */
  onViewAttempts: (uid: string, tid: string) => void;
  /* The page is never reached unscoped — every entry point is a row's
     "Manage User Progress" action, and each pre-selects one half of the
     scope. The other half is picked here, as usual. Ids that don't resolve in
     the generated model simply leave that half empty. */
  /** Pre-selects this employee (Manage Users). */
  initialUserId?: string;
  /** Pre-selects this cohort, by company name (Companies). */
  initialCohort?: string;
  /** Pre-selects this certification (Certifications). */
  initialCertId?: string;
  /** Pre-selects this task (Tasks). */
  initialTaskId?: string;
  /** Crumb label for the page that opened this one. */
  backLabel?: string;
  onBack?: () => void;
}) {
  const data = useMemo(() => buildData(), []);

  /* Committed state — only the apply step writes these. */
  const [cells, setCells] = useState<CellMap>(() => data.cells);
  const [certManual, setCertManual] = useState<CertManual>({});

  /* Staged changes — nothing touches `cells` until Review & Save confirms. */
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const [who, setWho] = useState<Who>(() => {
    if (initialUserId && data.employeesById[initialUserId]) return { kind: "employee", id: initialUserId };
    if (initialCohort && data.cohorts.some((c) => c.id === initialCohort))
      return { kind: "cohort", id: initialCohort };
    return null;
  });
  const [what, setWhat] = useState<What>(() => {
    if (initialCertId && data.certsById[initialCertId]) return { kind: "cert", id: initialCertId };
    if (initialTaskId && data.tasksById[initialTaskId]) return { kind: "task", id: initialTaskId };
    return null;
  });
  const [whoQ, setWhoQ] = useState("");
  const [whatQ, setWhatQ] = useState("");

  /* The one cohort-roster row whose task table is open inline. */
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);

  const [ftypes, setFtypes] = useState<string[]>([]);
  const [finalOnly, setFinalOnly] = useState(false);

  const [gradePrompt, setGradePrompt] = useState<GradePrompt>(null);
  const [gradeInput, setGradeInput] = useState("");

  /* Modals + row menu. */
  const [menu, setMenu] = useState<MenuState>(null);
  const [grantFor, setGrantFor] = useState<TaskRef>(null);
  const [grantN, setGrantN] = useState("2");
  const [attListFor, setAttListFor] = useState<TaskRef>(null);
  const [viewAttempt, setViewAttempt] = useState<{ uid: string; tid: string; attemptNumber: number } | null>(null);

  /* selection */
  function selectWho(kind: "employee" | "cohort", id: string) {
    setWho({ kind, id });
    setWhoQ("");
    setExpandedEmp(null);
  }
  function selectWhat(kind: "cert" | "task", id: string) {
    setWhat({ kind, id });
    setWhatQ("");
    setExpandedEmp(null);
  }
  function clearWho() {
    setWho(null);
    setWhoQ("");
    setExpandedEmp(null);
  }
  function clearWhat() {
    setWhat(null);
    setWhatQ("");
    setExpandedEmp(null);
  }
  function setScope(w: NonNullable<Who>, x: NonNullable<What>) {
    setWho(w);
    setWhat(x);
    setWhoQ("");
    setWhatQ("");
    setExpandedEmp(null);
    setFtypes([]);
    setFinalOnly(false);
  }

  /* ───── staged-change helpers ───── */
  const stagedComplete = (uid: string, tid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "complete" }> => s.kind === "complete" && s.uid === uid && s.tid === tid);
  const stagedCertOf = (uid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "cert" }> => s.kind === "cert" && s.uid === uid);
  const stagedGrant = (uid: string, tid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "grant" }> => s.kind === "grant" && s.uid === uid && s.tid === tid);
  const stagedDel = (uid: string, tid: string, n: number) =>
    staged.find((s) => s.kind === "del" && s.uid === uid && s.tid === tid && s.attemptNumber === n);

  const isStagedComplete = (uid: string, tid: string) =>
    !!stagedComplete(uid, tid) || !!staged.find((s) => s.kind === "cert" && s.uid === uid && s.tids.includes(tid));

  /** Stage / unstage one task's manual completion. Staging a gradeable task
   *  routes through the grade prompt first. */
  function toggleComplete(uid: string, tid: string) {
    const cell = cells[uid + "_" + tid];
    if (!cell || cell.status === "complete") return;
    /* Inside a staged cert? Pull the task back out of it. */
    const certEntry = staged.find(
      (s): s is Extract<Staged, { kind: "cert" }> => s.kind === "cert" && s.uid === uid && s.tids.includes(tid),
    );
    if (certEntry) {
      setStaged((prev) =>
        prev
          .map((s) => (s === certEntry ? { ...certEntry, tids: certEntry.tids.filter((t) => t !== tid) } : s))
          .filter((s) => s.kind !== "cert" || s.tids.length > 0),
      );
      return;
    }
    const ex = stagedComplete(uid, tid);
    if (ex) {
      setStaged((prev) => prev.filter((s) => s !== ex));
      return;
    }
    const t = data.tasksById[tid];
    if (t && needsGradePrompt(t)) {
      setGradePrompt({ uid, tid, taskName: t.name, type: t.type });
      setGradeInput("");
    } else {
      setStaged((prev) => [...prev, { kind: "complete", uid, tid, grade: null }]);
    }
  }

  function confirmGrade() {
    if (!gradePrompt) return;
    const raw = gradeInput.trim();
    const grade = raw === "" ? null : Number(raw);
    setStaged((prev) => [...prev, { kind: "complete", uid: gradePrompt.uid, tid: gradePrompt.tid, grade }]);
    setGradePrompt(null);
    setGradeInput("");
  }

  /** Stage / unstage "mark certification complete" — everything still open. */
  function toggleCertStage(uid: string, certId: string, certTasks: CertTask[]) {
    const ex = stagedCertOf(uid);
    if (ex) {
      setStaged((prev) => prev.filter((s) => s !== ex));
      return;
    }
    const tids = certTasks
      .filter((t) => cells[uid + "_" + t.id]?.status !== "complete" && !stagedComplete(uid, t.id))
      .map((t) => t.id);
    if (!tids.length) return;
    setStaged((prev) => [...prev, { kind: "cert", uid, certId, tids }]);
  }

  function stageGrant(uid: string, tid: string) {
    const n = Math.max(1, Math.min(MAX_GRANT, parseInt(grantN, 10) || 1));
    setStaged((prev) => {
      const ex = prev.find((s) => s.kind === "grant" && s.uid === uid && s.tid === tid);
      if (ex) return prev.map((s) => (s === ex ? { ...s, n } : s));
      return [...prev, { kind: "grant", uid, tid, n }];
    });
    setGrantFor(null);
  }

  function toggleDelAttempt(uid: string, tid: string, attemptNumber: number) {
    const ex = stagedDel(uid, tid, attemptNumber);
    setStaged((prev) => (ex ? prev.filter((s) => s !== ex) : [...prev, { kind: "del", uid, tid, attemptNumber }]));
  }

  /** One sentence per staged change, for the dialog and footer summary. */
  function changeText(s: Staged): string {
    if (s.kind === "complete") {
      const t = data.tasksById[s.tid];
      return `mark “${t?.name ?? s.tid}” Complete${s.grade != null ? ` · Grade ${s.grade}/100` : ""}`;
    }
    if (s.kind === "cert") {
      const c = data.certsById[s.certId];
      return `mark ${c?.name ?? "certification"} complete (${s.tids.length} remaining ${
        s.tids.length === 1 ? "task" : "tasks"
      })`;
    }
    if (s.kind === "grant") {
      const t = data.tasksById[s.tid];
      const ai = t ? attemptInfo(t, cells[s.uid + "_" + s.tid]) : null;
      const after = ai?.totalAllowed != null ? ` (will have ${ai.totalAllowed + s.n - ai.attemptsUsed} of ${ai.totalAllowed + s.n} remaining)` : "";
      return `grant +${s.n} ${s.n === 1 ? "attempt" : "attempts"} on “${t?.name ?? s.tid}”${after}`;
    }
    const t = data.tasksById[s.tid];
    return `delete attempt #${s.attemptNumber} on “${t?.name ?? s.tid}” — frees one slot`;
  }

  function discardChanges() {
    setStaged([]);
    setDialogOpen(false);
    setReason("");
  }

  function applyChanges() {
    const note = reason.trim() || null;
    let c = cells;
    let m = certManual;
    /* Deletes first so grant math sees the freed slots, then grants, then
       completes — the prototype's order. */
    staged.forEach((s) => {
      if (s.kind === "del") c = applyDeleteAttempt(c, s.uid, s.tid, s.attemptNumber);
    });
    staged.forEach((s) => {
      if (s.kind === "grant") c = applyGrantAttempt(c, s.uid, s.tid, s.n);
      else if (s.kind === "complete") c = applyMarkComplete(c, s.uid, s.tid, s.grade, ADMIN_ACTOR, note);
      else if (s.kind === "cert") {
        s.tids.forEach((tid) => {
          c = applyMarkComplete(c, s.uid, tid, null, ADMIN_ACTOR, note);
        });
        m = applyMarkCert(m, s.uid, s.certId);
      }
    });
    const n = staged.length;
    setCells(c);
    setCertManual(m);
    setStaged([]);
    setDialogOpen(false);
    setReason("");
    setToast(`${n} ${n === 1 ? "change" : "changes"} applied — logged as ${ADMIN_ACTOR}, ${ADMIN_STAMP}`);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  /* ───── derived scope ───── */
  const whoUser = who?.kind === "employee" ? data.employeesById[who.id] : null;
  const cohortId = who?.kind === "cohort" ? who.id : null;
  const certObj = what?.kind === "cert" ? data.certsById[what.id] : null;
  const taskObj = what?.kind === "task" ? data.tasksById[what.id] : null;

  const hasScope = !!(who && what);
  const isLanding = !who && !what;
  const isHalf = !!who !== !!what;

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

  const showCohortCert = !!cohortId && !!certObj;
  const showCohortTask = !!cohortId && !!taskObj;
  const showUserCert = !!whoUser && !!certObj;
  const showUserTask = !!whoUser && !!taskObj;

  const cohortMembers: Employee[] =
    cohortId != null
      ? (data.cohorts.find((c) => c.id === cohortId)?.userIds ?? []).map((id) => data.employeesById[id])
      : [];

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

  /* ───── shared row bits handed to the tables ───── */
  const rowCtx: RowCtx = {
    data,
    cells,
    isStagedComplete,
    stagedGrant,
    toggleComplete,
    openMenu: (uid, tid, rect) => setMenu({ uid, tid, rect }),
  };

  /* Modal subjects. */
  const grantTask = grantFor ? data.tasksById[grantFor.tid] : null;
  const grantUser = grantFor ? data.employeesById[grantFor.uid] : null;
  const attTask = attListFor ? data.tasksById[attListFor.tid] : null;
  const attUser = attListFor ? data.employeesById[attListFor.uid] : null;
  const attHistory =
    attListFor && attTask && attUser
      ? attemptsForTask(attUser.id, attUser.name, attUser.contact, attTask, cells[attUser.id + "_" + attTask.id])
      : [];
  const detailAttempt = viewAttempt
    ? attHistory.find((a) => a.attemptNumber === viewAttempt.attemptNumber) ?? null
    : null;

  /* Footer summary: first two changes by first name, then "+N more". */
  const summary =
    staged
      .slice(0, 2)
      .map((s) => `${(data.employeesById[s.uid]?.name ?? "").split(" ")[0]}: ${changeText(s)}`)
      .join(" · ") + (staged.length > 2 ? ` · +${staged.length - 2} more` : "");

  const dialogNames = [...new Set(staged.map((s) => data.employeesById[s.uid]?.name).filter(Boolean))].join(", ");

  return (
    <div className="main">
      <div className="workspace">
        <div className="mc-root">
          {/* ===== page header (Figma 46:314) ===== */}
          <header className="mc-header">
            {/* Reached only from another page's row menu, so that page's crumb
                is the way back — same header as Who Paid / Quiz Attempts. */}
            {onBack && backLabel && (
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <button className="rvc-crumb" onClick={onBack} title={`Back to ${backLabel}`}>
                  {backLabel}
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Manage Completions</span>
              </nav>
            )}
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

              <span className="filters-end mc-filters-end">
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
                    <strong>certification or a single task</strong>. Pick a cohort to see everyone, and
                    open any person inline.
                  </div>
                  {examples.length > 0 && (
                    <>
                      <SectionHeading label="Jump to an example" />
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
              <div className="mc-roster-scroll">
                {/* cohort × certification — expandable roster */}
                {showCohortCert && (
                  <CohortCertTable
                    members={cohortMembers}
                    certId={certObj!.id}
                    allTasks={ctAll}
                    filteredTasks={ctF}
                    certManual={certManual}
                    expandedEmp={expandedEmp}
                    onToggleExpand={(uid) => setExpandedEmp((e) => (e === uid ? null : uid))}
                    stagedCertOf={stagedCertOf}
                    onToggleCert={(uid) => toggleCertStage(uid, certObj!.id, ctAll)}
                    ctx={rowCtx}
                  />
                )}

                {/* cohort × task — roster on one task */}
                {showCohortTask && (
                  <CohortTaskTable members={cohortMembers} task={taskObj!} ctx={rowCtx} />
                )}

                {/* employee × certification — summary notice + task table */}
                {showUserCert && (
                  <>
                    <CertNotice
                      uid={whoUser!.id}
                      certId={certObj!.id}
                      allTasks={ctAll}
                      cells={cells}
                      certManual={certManual}
                      stagedCert={!!stagedCertOf(whoUser!.id)}
                      onToggleCert={() => toggleCertStage(whoUser!.id, certObj!.id, ctAll)}
                    />
                    <TaskTable uid={whoUser!.id} tasks={ctF} ctx={rowCtx} />
                  </>
                )}

                {/* employee × task — single task card */}
                {showUserTask && (
                  <UserTaskCard
                    uid={whoUser!.id}
                    task={taskObj!}
                    ctx={rowCtx}
                    onViewAttempts={() => setAttListFor({ uid: whoUser!.id, tid: taskObj!.id })}
                    onGrant={() => {
                      setGrantN("2");
                      setGrantFor({ uid: whoUser!.id, tid: taskObj!.id });
                    }}
                  />
                )}
              </div>
            )}
          </main>

          {/* ===== staged-changes footer (Review & Save) ===== */}
          {staged.length > 0 && (
            <footer className="wizard-footer mc-footer">
              <span className="mc-dirty">
                <span className="mc-dirty-dot" />
                <strong>
                  {staged.length} staged {staged.length === 1 ? "change" : "changes"}
                </strong>
                <span className="mc-dirty-sub mc-dirty-summary">{summary}</span>
              </span>
              <div className="wizard-actions">
                <button className="btn-save-draft" onClick={discardChanges}>
                  Discard
                </button>
                <button className="btn-publish" onClick={() => setDialogOpen(true)}>
                  Review &amp; Save
                </button>
              </div>
            </footer>
          )}

          {/* ===== row 3-dot menu (quiz rows) ===== */}
          {menu && (
            <RowMenu
              rect={menu.rect}
              onClose={() => setMenu(null)}
              onGrant={() => {
                setGrantN("2");
                setGrantFor({ uid: menu.uid, tid: menu.tid });
              }}
              onViewAttempts={() => setAttListFor({ uid: menu.uid, tid: menu.tid })}
            />
          )}

          {/* ===== review-changes dialog ===== */}
          {dialogOpen && (
            <PrmModal
              title={`Apply ${staged.length} ${staged.length === 1 ? "Change" : "Changes"}?`}
              description={
                dialogNames + (certObj ? ` · ${certObj.name}` : taskObj ? ` · ${taskObj.name}` : "")
              }
              confirmLabel="Apply Changes"
              onCancel={() => setDialogOpen(false)}
              onConfirm={applyChanges}
            >
              <div className="mc-review-list">
                {staged.map((s, i) => {
                  const task = s.kind === "cert" ? null : data.tasksById[s.tid];
                  return (
                    <div className="mc-review-item" key={i}>
                      {task ? (
                        <TaskTypeIcon type={task.type} />
                      ) : (
                        <span className="mc-typeicon">
                          <CheckIcon />
                        </span>
                      )}
                      <span className="mc-review-text">
                        <b>{data.employeesById[s.uid]?.name}</b> — {changeText(s)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="prm-field">
                <span className="prm-label">Reason (Optional)</span>
                <input
                  className="form-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Proctored paper retake passed on-site"
                />
                <p className="form-help">
                  Logged as {ADMIN_ACTOR} · {ADMIN_STAMP} — each task will show Marked Manually.
                </p>
              </div>
            </PrmModal>
          )}

          {/* ===== grant-attempts modal ===== */}
          {grantFor && grantTask && grantUser && (
            <PrmModal
              title="Grant Additional Attempts"
              description={`${grantUser.name} · ${grantTask.name}`}
              confirmLabel="Stage Change"
              onCancel={() => setGrantFor(null)}
              onConfirm={() => stageGrant(grantFor.uid, grantFor.tid)}
            >
              <div className="prm-field">
                <span className="prm-label">Additional Attempts</span>
                <Stepper
                  value={grantN}
                  onChange={setGrantN}
                  min={1}
                  max={MAX_GRANT}
                  ariaLabel="Additional attempts"
                />
                <p className="form-help">{grantHint(grantUser, grantTask, cells, grantN)}</p>
              </div>
            </PrmModal>
          )}

          {/* ===== view-attempts modal ===== */}
          {attListFor && attTask && attUser && (
            <PrmModal
              pick
              title={`Attempts — ${attTask.name}`}
              description={`${attUser.name} · ${attTask.certName}`}
              confirmLabel="Done"
              hideCancel
              onCancel={() => {
                setAttListFor(null);
                setViewAttempt(null);
              }}
              onConfirm={() => {
                setAttListFor(null);
                setViewAttempt(null);
              }}
            >
              {attHistory.length === 0 ? (
                <p className="form-help">No attempts yet.</p>
              ) : (
                <table className="mc-table mc-table--flat mc-att-table">
                  <thead>
                    <tr>
                      <th className="mc-col-attnum">Attempt</th>
                      <th className="mc-col-grade">Grade</th>
                      <th>Submitted</th>
                      <th className="mc-col-result">Result</th>
                      <th className="mc-col-act2" />
                    </tr>
                  </thead>
                  <tbody>
                    {attHistory.map((a) => {
                      const del = !!stagedDel(attUser.id, attTask.id, a.attemptNumber);
                      const pass = (a.grade ?? 0) >= PASS_PCT;
                      return (
                        <tr key={a.attemptNumber}>
                          <td className="mc-col-attnum">#{a.attemptNumber}</td>
                          <td className="mc-col-grade">{a.grade != null ? `${a.grade}%` : ""}</td>
                          <td>{a.completedAt ?? ""}</td>
                          <td className="mc-col-result">
                            <span className={`co-status-pill co-status-pill--${pass ? "green" : "red"}`}>
                              {pass ? "Pass" : "Fail"}
                            </span>
                          </td>
                          <td className="mc-col-act2">
                            <div className="mc-rowactions">
                              <button
                                className="btn-save-draft mc-btn-sm"
                                onClick={() =>
                                  setViewAttempt({ uid: attUser.id, tid: attTask.id, attemptNumber: a.attemptNumber })
                                }
                              >
                                View
                              </button>
                              {del ? (
                                <PillButton
                                  tone="accent"
                                  label="Staged: Delete · Undo"
                                  onClick={() => toggleDelAttempt(attUser.id, attTask.id, a.attemptNumber)}
                                />
                              ) : (
                                <PillButton
                                  tone="red"
                                  label="Delete"
                                  onClick={() => toggleDelAttempt(attUser.id, attTask.id, a.attemptNumber)}
                                  title="Stage this attempt for deletion"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="mc-att-foot">
                <p className="form-help">
                  Deleting an attempt frees one slot. All manual changes are logged with actor and
                  timestamp.
                </p>
                <button
                  className="btn-save-draft mc-btn-sm"
                  onClick={() => onViewAttempts(attUser.id, attTask.id)}
                  title="Open the full Attempts page in a new tab"
                >
                  Open Attempts Page
                  <ArrowUpRightIcon />
                </button>
              </div>
            </PrmModal>
          )}

          {/* ===== attempt-detail modal ===== */}
          {viewAttempt && detailAttempt && attTask && attUser && (
            <PrmModal
              title={`Attempt #${detailAttempt.attemptNumber} · ${
                detailAttempt.grade != null ? `${detailAttempt.grade}%` : ""
              }`}
              description={`${attTask.name} · ${attUser.name} · Submitted ${detailAttempt.completedAt ?? "—"}`}
              confirmLabel="Close"
              hideCancel
              onCancel={() => setViewAttempt(null)}
              onConfirm={() => setViewAttempt(null)}
            >
              <AttemptAnswers task={attTask} grade={detailAttempt.grade ?? 0} attemptNumber={detailAttempt.attemptNumber} />
            </PrmModal>
          )}

          {/* ===== grade prompt (staging a gradeable completion) ===== */}
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
                      Enter a grade, or leave blank to mark complete without one. Applies on Review
                      &amp; Save.
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
                    Stage Change
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* applied-changes toast */}
          {toast && <div className="rvc-toast">{toast}</div>}
        </div>
      </div>
    </div>
  );
}

/** The grant modal's live hint — recomputed as the stepper moves. */
function grantHint(user: Employee, task: CertTask, cells: CellMap, grantN: string): string {
  const cell = cells[user.id + "_" + task.id];
  const ai = attemptInfo(task, cell);
  const n = Math.max(1, Math.min(MAX_GRANT, parseInt(grantN, 10) || 1));
  if (ai.totalAllowed == null) return "Applies on Review & Save.";
  const first = user.name.split(" ")[0];
  return `${first} will have ${ai.totalAllowed + n - ai.attemptsUsed} of ${ai.totalAllowed + n} remaining. Applies on Review & Save.`;
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
            <span className="kbd-cmd"><KeyCommandIcon /></span>
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

/* ─────────────────────────── shared row context ────────────────────────── */

type RowCtx = {
  data: ReturnType<typeof buildData>;
  cells: CellMap;
  isStagedComplete: (uid: string, tid: string) => boolean;
  stagedGrant: (uid: string, tid: string) => { n: number } | undefined;
  toggleComplete: (uid: string, tid: string) => void;
  openMenu: (uid: string, tid: string, rect: DOMRect) => void;
};

/** Attempts cell contents: "x of y" for limited quizzes, with the staged-grant
 *  pill beside it, "—" otherwise. */
function AttemptsCell({ uid, task, ctx }: { uid: string; task: CertTask; ctx: RowCtx }) {
  const cell = ctx.cells[uid + "_" + task.id];
  const ai = attemptInfo(task, cell);
  const grant = ctx.stagedGrant(uid, task.id);
  return (
    <span className="mc-attcell">
      {ai.hasLimit ? `${ai.attemptsUsed} of ${ai.totalAllowed}` : ""}
      {grant && <span className="co-status-pill co-status-pill--accent">+{grant.n} Staged</span>}
    </span>
  );
}

/** The actions cell shared by every task row: the mark-complete checkbox
 *  (hidden once complete) and, on attempt-limited quizzes, the 3-dot menu. */
function TaskRowActions({ uid, task, ctx }: { uid: string; task: CertTask; ctx: RowCtx }) {
  const cell = ctx.cells[uid + "_" + task.id];
  const ai = attemptInfo(task, cell);
  const staged = ctx.isStagedComplete(uid, task.id);
  return (
    <div className="mc-rowactions">
      {cell.status !== "complete" && (
        <button
          className={`checkbox mc-check${staged ? " checked" : ""}`}
          aria-label={staged ? "Unstage mark complete" : "Stage mark complete"}
          title={staged ? "Staged: Complete — click to undo" : "Mark Complete"}
          onClick={(e) => {
            e.stopPropagation();
            ctx.toggleComplete(uid, task.id);
          }}
        >
          {staged && <CheckIcon />}
        </button>
      )}
      {ai.hasLimit && (
        <button
          className="mc-iconbtn"
          aria-label="Attempt actions"
          onClick={(e) => {
            e.stopPropagation();
            ctx.openMenu(uid, task.id, e.currentTarget.getBoundingClientRect());
          }}
        >
          <RowKebabIcon />
        </button>
      )}
    </div>
  );
}

/* ───────────────────────────── task table ──────────────────────────────── */

/** One person's tasks — used full-width on employee × cert and nested inside
 *  an expanded cohort-roster row. */
function TaskTable({ uid, tasks, ctx }: { uid: string; tasks: CertTask[]; ctx: RowCtx }) {
  return (
    <table className="mc-table mc-table--flat">
      <thead>
        <tr>
          <th>Task</th>
          <th className="mc-col-status">Status</th>
          <th className="mc-col-date">Completed</th>
          <th className="mc-col-grade">Grade</th>
          <th className="mc-col-tries">Attempts</th>
          <th className="mc-col-act2" />
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => {
          const cell = ctx.cells[uid + "_" + t.id];
          const staged = ctx.isStagedComplete(uid, t.id);
          return (
            <tr key={t.id} className={staged ? "is-staged" : ""}>
              <td>
                <span className="mc-taskname">
                  <TaskTypeIcon type={t.type} />
                  <span className="mc-taskname-text">{t.name}</span>
                  {t.isFinal && <span className="co-status-pill co-status-pill--accent">Final</span>}
                </span>
              </td>
              <td className="mc-col-status">
                <TaskStatusPill task={t} cell={cell} staged={staged} />
              </td>
              <td className="mc-col-date">{cell.status === "complete" ? fmtDT(cell.completedAt) : ""}</td>
              <td className="mc-col-grade">{cell.grade != null ? `${cell.grade}%` : ""}</td>
              <td className="mc-col-tries">
                <AttemptsCell uid={uid} task={t} ctx={ctx} />
              </td>
              <td className="mc-col-act2">
                <TaskRowActions uid={uid} task={t} ctx={ctx} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─────────────────── cohort × certification (expandable) ────────────────── */

function CohortCertTable({
  members,
  certId,
  allTasks,
  filteredTasks,
  certManual,
  expandedEmp,
  onToggleExpand,
  stagedCertOf,
  onToggleCert,
  ctx,
}: {
  members: Employee[];
  certId: string;
  allTasks: CertTask[];
  filteredTasks: CertTask[];
  certManual: CertManual;
  expandedEmp: string | null;
  onToggleExpand: (uid: string) => void;
  stagedCertOf: (uid: string) => Staged | undefined;
  onToggleCert: (uid: string) => void;
  ctx: RowCtx;
}) {
  return (
    <table className="mc-table">
      <thead>
        <tr>
          <th>Employee · {members.length}</th>
          <th className="mc-col-progress">Progress</th>
          <th className="mc-col-date">Completed</th>
          <th className="mc-col-certact" />
          <th className="mc-col-caret" />
        </tr>
      </thead>
      <tbody>
        {members.map((u) => {
          const ps = progress(ctx.cells, certManual, u.id, allTasks, certId);
          const open = expandedEmp === u.id;
          const stagedCert = !!stagedCertOf(u.id);
          return (
            <FragmentRows key={u.id}>
              <tr className={open ? "is-focus" : ""} onClick={() => onToggleExpand(u.id)}>
                <td>
                  <div className="mc-cell-user">
                    <Avatar initials={u.initials} size={32} />
                    <span className="mc-cell-user-text">
                      <span className="mc-cell-user-name">{u.name}</span>
                      <span className="mc-cell-user-sub">{u.contact}</span>
                    </span>
                  </div>
                </td>
                <td className="mc-col-progress">
                  {ps.certified ? (
                    <span className={`co-status-pill co-status-pill--${ps.certManual ? "accent" : "green"}`}>
                      {ps.certManual ? "Certified · Manual" : "Certified"}
                    </span>
                  ) : (
                    <span className="mc-pct">{ps.pct}%</span>
                  )}
                </td>
                <td className="mc-col-date">{ps.certified ? fmtD(ps.certAt) : ""}</td>
                <td className="mc-col-certact">
                  {!ps.certified &&
                    (stagedCert ? (
                      <PillButton
                        tone="accent"
                        label="Staged: Complete · Undo"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCert(u.id);
                        }}
                      />
                    ) : (
                      <button
                        className="btn-save-draft mc-btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCert(u.id);
                        }}
                      >
                        Mark Cert
                      </button>
                    ))}
                </td>
                <td className="mc-col-caret">
                  <span className={`mc-caret${open ? " is-open" : ""}`}>
                    <ChevronDownIcon />
                  </span>
                </td>
              </tr>
              {open && (
                <tr className="mc-exp-row">
                  <td colSpan={5}>
                    <div className="mc-subtable">
                      <TaskTable uid={u.id} tasks={filteredTasks} ctx={ctx} />
                    </div>
                  </td>
                </tr>
              )}
            </FragmentRows>
          );
        })}
      </tbody>
    </table>
  );
}

/** <>…</> that can carry a key inside a <tbody> map. */
function FragmentRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ───────────────────────── cohort × one task ───────────────────────────── */

function CohortTaskTable({
  members,
  task,
  ctx,
}: {
  members: Employee[];
  task: CertTask;
  ctx: RowCtx;
}) {
  return (
    <table className="mc-table mc-table--flat">
      <thead>
        <tr>
          <th>Employee · {members.length}</th>
          <th className="mc-col-status">Status</th>
          <th className="mc-col-grade">Grade</th>
          <th className="mc-col-tries">Attempts</th>
          <th className="mc-col-date">Completed</th>
          <th className="mc-col-marked">Marked By</th>
          <th className="mc-col-act2" />
        </tr>
      </thead>
      <tbody>
        {members.map((u) => {
          const cell = ctx.cells[u.id + "_" + task.id];
          const staged = ctx.isStagedComplete(u.id, task.id);
          return (
            <tr key={u.id} className={staged ? "is-staged" : ""}>
              <td>
                <div className="mc-cell-user">
                  <Avatar initials={u.initials} size={32} />
                  <span className="mc-cell-user-text">
                    <span className="mc-cell-user-name">{u.name}</span>
                    <span className="mc-cell-user-sub">{u.contact}</span>
                  </span>
                </div>
              </td>
              <td className="mc-col-status">
                <TaskStatusPill task={task} cell={cell} staged={staged} />
              </td>
              <td className="mc-col-grade">{cell.grade != null ? `${cell.grade}%` : ""}</td>
              <td className="mc-col-tries">
                <AttemptsCell uid={u.id} task={task} ctx={ctx} />
              </td>
              <td className="mc-col-date">{cell.status === "complete" ? fmtD(cell.completedAt) : ""}</td>
              <td className="mc-col-marked">{cell.markedBy ?? ""}</td>
              <td className="mc-col-act2">
                <TaskRowActions uid={u.id} task={task} ctx={ctx} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ─────────────── employee × certification summary notice ───────────────── */

function CertNotice({
  uid,
  certId,
  allTasks,
  cells,
  certManual,
  stagedCert,
  onToggleCert,
}: {
  uid: string;
  certId: string;
  allTasks: CertTask[];
  cells: CellMap;
  certManual: CertManual;
  stagedCert: boolean;
  onToggleCert: () => void;
}) {
  const ps = progress(cells, certManual, uid, allTasks, certId);
  const remain = ps.rv + ps.inc;
  return (
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
      {!ps.certified &&
        (stagedCert ? (
          <PillButton tone="accent" label="Staged: Certification Complete · Undo" onClick={onToggleCert} />
        ) : (
          <button className="btn-publish" onClick={onToggleCert}>
            Mark Certification Complete
          </button>
        ))}
    </div>
  );
}

/* ───────────────────────── employee × task card ────────────────────────── */

function UserTaskCard({
  uid,
  task,
  ctx,
  onViewAttempts,
  onGrant,
}: {
  uid: string;
  task: CertTask;
  ctx: RowCtx;
  onViewAttempts: () => void;
  onGrant: () => void;
}) {
  const cell = ctx.cells[uid + "_" + task.id];
  const ai = attemptInfo(task, cell);
  const staged = ctx.isStagedComplete(uid, task.id);
  const grant = ctx.stagedGrant(uid, task.id);
  const exhausted = isExhausted(task, cell);
  const done = cell.status === "complete";

  const metric = (label: string, value: ReactNode) => (
    <div className="mc-metric">
      <div className="mc-metric-label">{label}</div>
      <div className="mc-metric-value">{value}</div>
    </div>
  );

  return (
    <div className="mc-taskcard">
      <div className="mc-taskcard-head">
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
        <TaskStatusPill task={task} cell={cell} staged={staged} />
      </div>

      <div className="mc-taskcard-body">
        <div className="mc-metrics">
          {metric("Completed On", done ? fmtDT(cell.completedAt) : "")}
          {metric("Marked Complete By", cell.markedBy ?? "")}
          {metric("Highest Grade", cell.grade != null ? `${cell.grade}%` : "")}
          {metric(
            ai.hasLimit ? `Attempts (Max. ${ai.totalAllowed})` : "Attempts",
            <span className="mc-attcell">
              {ai.hasLimit ? String(ai.attemptsUsed) : ""}
              {exhausted && <span className="co-status-pill co-status-pill--red">Exhausted</span>}
              {grant && <span className="co-status-pill co-status-pill--accent">+{grant.n} Staged</span>}
            </span>,
          )}
        </div>
      </div>

      <div className="mc-taskcard-foot">
        {done ? (
          <span className="co-status-pill co-status-pill--green">
            {cell.manual ? "Complete · Marked Manually" : "Complete"}
          </span>
        ) : staged ? (
          <PillButton tone="accent" label="Staged: Complete · Undo" onClick={() => ctx.toggleComplete(uid, task.id)} />
        ) : (
          <button className="btn-publish" onClick={() => ctx.toggleComplete(uid, task.id)}>
            Mark Complete
          </button>
        )}
        {ai.hasLimit && (
          <>
            <button className="btn-save-draft" onClick={onViewAttempts}>
              View Attempts
            </button>
            <button className="btn-save-draft" onClick={onGrant}>
              Grant Attempts
            </button>
          </>
        )}
        <span className="mc-taskcard-note">
          All manual changes are logged with actor and timestamp.
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────── row 3-dot menu (quiz rows) ────────────────────── */

/** Same `.u-menu` chrome + fixed positioning as the Users row menu — the
 *  table scrolls, so an in-row popover would be clipped. */
function RowMenu({
  rect,
  onClose,
  onGrant,
  onViewAttempts,
}: {
  rect: DOMRect;
  onClose: () => void;
  onGrant: () => void;
  onViewAttempts: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = (icon: JSX.Element, label: string, onPick: () => void) => (
    <button
      className="u-menu-item"
      onClick={(e) => {
        e.stopPropagation();
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      ref={ref}
      className="u-menu u-menu--hug"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {item(<PlusCircleIcon />, "Grant Attempts", onGrant)}
      {item(<RowExternalLinkIcon />, "View Attempts", onViewAttempts)}
    </div>
  );
}

/* ───────────────────── attempt-detail answers list ─────────────────────── */

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic per-question results for one attempt: stems come from the
 *  seeded question bank, the wrong set is sized so the count always agrees
 *  with the attempt's grade. */
function AttemptAnswers({
  task,
  grade,
  attemptNumber,
}: {
  task: CertTask;
  grade: number;
  attemptNumber: number;
}) {
  const pool = bankQuestions.filter((q) => q.gradingEnabled);
  const total = Math.min(ANSWER_COUNT, pool.length);
  const offset = hash32(task.id) % Math.max(1, pool.length - total);
  const stems = pool.slice(offset, offset + total).map((q) => q.text);
  const correct = Math.max(0, Math.min(total, Math.round((grade / 100) * total)));
  const seed = hash32(task.id + "|" + attemptNumber) % 97;
  const order = stems
    .map((_, i) => i)
    .sort((a, b) => ((a * 31 + seed) % 17) - ((b * 31 + seed) % 17));
  const wrong = new Set(order.slice(0, total - correct));

  return (
    <div className="mc-answers">
      <SectionHeading label={`Answers · ${correct} of ${total} correct`} />
      {stems.map((text, i) => (
        <div className="mc-ans" key={i}>
          <span className={`mc-ans-mark${wrong.has(i) ? " is-wrong" : ""}`}>
            {wrong.has(i) ? "✕" : "✓"}
          </span>
          <span className="mc-ans-num">Q{i + 1}</span>
          <span className="mc-ans-text">{text}</span>
        </div>
      ))}
    </div>
  );
}
