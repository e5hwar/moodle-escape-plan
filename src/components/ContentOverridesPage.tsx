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
  applyClearCert,
  applyDeleteAttempt,
  applyGrantAttempt,
  applyMarkCert,
  applyMarkComplete,
  applyMarkIncomplete,
  attemptInfo,
  attemptsForTask,
  buildData,
  isExhausted,
  needsGradePrompt,
  progress,
  statusVisual,
  fmtD,
  fmtDT,
  fmtDY,
  fmtMins,
  gradeLabel,
  tracksAttempts,
  tracksTime,
  TYPE_SHORT,
  type Cell,
  type CellMap,
  type CertManual,
  type CertTask,
  type Employee,
} from "../data/certLookup";
import { questions as bankQuestions } from "../data/questionBank";
import { PrmModal } from "./PrmModal";
import { SectionHeading } from "./SectionHeading";
import { SearchHints } from "./SearchPanelParts";
import { Stepper } from "./Stepper";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronRightIcon,
  ErrorTriangleIcon,
  FileIcon,
  FlagIcon,
  HandsOnIcon,
  HourglassIcon,
  KeyCommandIcon,
  MenuAttemptsIcon,
  MenuGrantAttemptsIcon,
  MenuMarkCompleteIcon,
  MenuMarkIncompleteIcon,
  PackageIcon,
  QuizIcon,
  RowKebabIcon,
  SearchClearIcon,
  SearchIcon,
  XCircleIcon,
} from "./icons";

/**
 * Manage Completions — search an employee, then a certification or a single
 * task. The pair drives the view (Claude Design "Progress Admin - Prototype",
 * 2026-09 revision — the cohort scope is gone, every lookup is one person):
 *
 *   employee + cert  → learner header with the certification action, a
 *                      progress strip, and that person's task table (Figma
 *                      960:980: time is tracked on xAPI/Quiz only, a flag marks
 *                      a manual completion, Quiz grades are a %, Hands-On out
 *                      of 10, attempts carry an hourglass while pending review
 *                      and an error triangle once exhausted)
 *   employee + task  → learner header with the task actions and a status strip
 *
 * Admin actions — mark a task or a whole certification complete OR incomplete,
 * grant quiz attempts, delete a quiz attempt — are STAGED, not applied: each
 * toggles a "Staged" pill in place and lands in the footer, and Review & Save
 * opens a confirm dialog listing every change (with an optional reason) before
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
 *  Staged: Complete / Incomplete → Attempts Exhausted → the base vocabulary. */
function TaskStatusPill({
  task,
  cell,
  staged,
  stagedIncomplete,
}: {
  task: CertTask;
  cell: Cell;
  staged: boolean;
  stagedIncomplete: boolean;
}) {
  if (staged) return <span className="co-status-pill co-status-pill--accent">Staged: Complete</span>;
  if (stagedIncomplete)
    return <span className="co-status-pill co-status-pill--accent">Staged: Incomplete</span>;
  if (isExhausted(task, cell))
    return <span className="co-status-pill co-status-pill--red">Attempts Exhausted</span>;
  const v = statusVisual(cell.status, cell.status === "complete" && cell.manual);
  return <span className={`co-status-pill co-status-pill--${v.tone}`}>{v.label}</span>;
}

/** The Attempts value (Figma 960:980): the count, amber with an hourglass
 *  while a submission awaits review, red with an error triangle once every
 *  attempt is used — plus the staged-grant pill. Blank on open-ended tasks. */
function AttemptsValue({ task, cell, grant }: { task: CertTask; cell: Cell; grant?: { n: number } }) {
  const ai = attemptInfo(task, cell);
  const exhausted = isExhausted(task, cell);
  const pending = cell.status === "review" && !exhausted;
  return (
    <span className={`mct-att${exhausted ? " is-exhausted" : pending ? " is-pending" : ""}`}>
      {tracksAttempts(task) ? ai.attemptsUsed : "-"}
      {pending && <HourglassIcon />}
      {exhausted && <ErrorTriangleIcon />}
      {grant && <span className="co-status-pill co-status-pill--accent">+{grant.n}</span>}
    </span>
  );
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
  | { kind: "incomplete"; uid: string; tid: string }
  | { kind: "cert"; uid: string; certId: string; tids: string[] }
  | { kind: "certun"; uid: string; certId: string }
  | { kind: "grant"; uid: string; tid: string; n: number }
  | { kind: "del"; uid: string; tid: string; attemptNumber: number };

/* ─────────────────────────────── page ──────────────────────────────────── */

type What = { kind: "cert" | "task"; id: string } | null;
/** `max` is the scale the admin types in — 100 for a Quiz, 10 for Hands-On. */
type GradePrompt = { uid: string; tid: string; taskName: string; type: string; max: 10 | 100 } | null;
type TaskRef = { uid: string; tid: string } | null;
type MenuState =
  | { kind: "task"; uid: string; tid: string; rect: DOMRect }
  | { kind: "cert"; uid: string; certId: string; rect: DOMRect }
  | null;

export function ContentOverridesPage({
  onViewAttempts,
  initialUserId,
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

  /* Scope: one employee id, and a certification or a task. */
  const [who, setWho] = useState<string | null>(() =>
    initialUserId && data.employeesById[initialUserId] ? initialUserId : null,
  );
  const [what, setWhat] = useState<What>(() => {
    if (initialCertId && data.certsById[initialCertId]) return { kind: "cert", id: initialCertId };
    if (initialTaskId && data.tasksById[initialTaskId]) return { kind: "task", id: initialTaskId };
    return null;
  });
  const [whoQ, setWhoQ] = useState("");
  const [whatQ, setWhatQ] = useState("");

  const [gradePrompt, setGradePrompt] = useState<GradePrompt>(null);
  const [gradeInput, setGradeInput] = useState("");

  /* Modals + anchored menus. */
  const [menu, setMenu] = useState<MenuState>(null);
  const [grantFor, setGrantFor] = useState<TaskRef>(null);
  const [grantN, setGrantN] = useState("2");
  const [attListFor, setAttListFor] = useState<TaskRef>(null);
  const [viewAttempt, setViewAttempt] = useState<{ uid: string; tid: string; attemptNumber: number } | null>(null);

  /* selection */
  function selectWho(id: string) {
    setWho(id);
    setWhoQ("");
  }
  function selectWhat(kind: "cert" | "task", id: string) {
    setWhat({ kind, id });
    setWhatQ("");
  }
  function clearWho() {
    setWho(null);
    setWhoQ("");
  }
  function clearWhat() {
    setWhat(null);
    setWhatQ("");
  }
  function setScope(w: string, x: NonNullable<What>) {
    setWho(w);
    setWhat(x);
    setWhoQ("");
    setWhatQ("");
  }
  function openGrant(uid: string, tid: string) {
    setGrantN("2");
    setGrantFor({ uid, tid });
  }

  /* ───── staged-change helpers ───── */
  const stagedComplete = (uid: string, tid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "complete" }> => s.kind === "complete" && s.uid === uid && s.tid === tid);
  const stagedIncomplete = (uid: string, tid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "incomplete" }> => s.kind === "incomplete" && s.uid === uid && s.tid === tid);
  const stagedCertOf = (uid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "cert" }> => s.kind === "cert" && s.uid === uid);
  const stagedCertUnOf = (uid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "certun" }> => s.kind === "certun" && s.uid === uid);
  const stagedGrant = (uid: string, tid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "grant" }> => s.kind === "grant" && s.uid === uid && s.tid === tid);
  const stagedDel = (uid: string, tid: string, n: number) =>
    staged.find((s) => s.kind === "del" && s.uid === uid && s.tid === tid && s.attemptNumber === n);

  const isStagedComplete = (uid: string, tid: string) =>
    !!stagedComplete(uid, tid) || !!staged.find((s) => s.kind === "cert" && s.uid === uid && s.tids.includes(tid));
  const isStagedIncomplete = (uid: string, tid: string) => !!stagedIncomplete(uid, tid);

  /** Stage / unstage one task's manual completion — or, on a task that is
   *  already complete, its reopening. Staging a gradeable completion routes
   *  through the grade prompt first. */
  function toggleComplete(uid: string, tid: string) {
    const cell = cells[uid + "_" + tid];
    if (!cell) return;
    if (cell.status === "complete") {
      const ex = stagedIncomplete(uid, tid);
      setStaged((prev) => (ex ? prev.filter((s) => s !== ex) : [...prev, { kind: "incomplete", uid, tid }]));
      return;
    }
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
      setGradePrompt({ uid, tid, taskName: t.name, type: t.type, max: t.type === "Hands-On Task" ? 10 : 100 });
      setGradeInput("");
    } else {
      setStaged((prev) => [...prev, { kind: "complete", uid, tid, grade: null }]);
    }
  }

  function confirmGrade() {
    if (!gradePrompt) return;
    const raw = gradeInput.trim();
    /* Hands-On is typed out of 10 and stored as tens on the shared scale. */
    const grade = raw === "" ? null : Number(raw) * (100 / gradePrompt.max);
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

  /** Stage / unstage "mark certification incomplete" — reopens every task. */
  function toggleCertUnstage(uid: string, certId: string) {
    const ex = stagedCertUnOf(uid);
    setStaged((prev) => (ex ? prev.filter((s) => s !== ex) : [...prev, { kind: "certun", uid, certId }]));
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
    if (s.kind === "incomplete") {
      const t = data.tasksById[s.tid];
      return `mark “${t?.name ?? s.tid}” Incomplete`;
    }
    if (s.kind === "cert") {
      const c = data.certsById[s.certId];
      return `mark ${c?.name ?? "certification"} complete (${s.tids.length} remaining ${
        s.tids.length === 1 ? "task" : "tasks"
      })`;
    }
    if (s.kind === "certun") {
      const c = data.certsById[s.certId];
      return `mark ${c?.name ?? "certification"} incomplete (reopens completed tasks)`;
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
    /* Deletes first so grant math sees the freed slots, then everything else
       in staging order — the prototype's sequence. */
    staged.forEach((s) => {
      if (s.kind === "del") c = applyDeleteAttempt(c, s.uid, s.tid, s.attemptNumber);
    });
    staged.forEach((s) => {
      if (s.kind === "grant") c = applyGrantAttempt(c, s.uid, s.tid, s.n);
      else if (s.kind === "complete") c = applyMarkComplete(c, s.uid, s.tid, s.grade, ADMIN_ACTOR, note);
      else if (s.kind === "incomplete") c = applyMarkIncomplete(c, s.uid, s.tid);
      else if (s.kind === "cert") {
        s.tids.forEach((tid) => {
          c = applyMarkComplete(c, s.uid, tid, null, ADMIN_ACTOR, note);
        });
        m = applyMarkCert(m, s.uid, s.certId);
      } else if (s.kind === "certun") {
        (data.certsById[s.certId]?.taskIds ?? []).forEach((tid) => {
          c = applyMarkIncomplete(c, s.uid, tid);
        });
        m = applyClearCert(m, s.uid, s.certId);
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
  const whoUser = who ? data.employeesById[who] ?? null : null;
  const certObj = what?.kind === "cert" ? data.certsById[what.id] : null;
  const taskObj = what?.kind === "task" ? data.tasksById[what.id] : null;

  const hasScope = !!(whoUser && what);
  const isLanding = !whoUser && !what;
  const isHalf = !!whoUser !== !!what;

  const certTasks: CertTask[] = certObj
    ? certObj.taskIds.map((id) => data.tasksById[id]).filter(Boolean)
    : [];

  const showUserCert = !!whoUser && !!certObj;
  const showUserTask = !!whoUser && !!taskObj;

  /* ───── search matches ───── */
  const whoQl = whoQ.trim().toLowerCase();
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
  /* With a certification already picked, each candidate shows their progress
     on it (the prototype's "4 of 12"); otherwise their cohort. */
  const whoOptions: ScopeOption[] = peopleMatches.map((e) => ({
    key: "emp_" + e.id,
    section: "Employees",
    onSelect: () => selectWho(e.id),
    node: (
      <>
        <Avatar initials={e.initials} size={30} />
        <span className="usearch-user-text">
          <span className="usearch-user-name">{e.name}</span>
          <span className="usearch-user-sub">{e.contact}</span>
        </span>
        <span className="usearch-row-desc">
          {certObj
            ? (() => {
                const p = progress(cells, certManual, e.id, certTasks, certObj.id);
                return `${p.c} of ${certTasks.length}`;
              })()
            : e.cohort ?? "B2C"}
        </span>
      </>
    ),
  }));

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
  const whoScope = whoUser ? { label: "Employee", name: whoUser.name } : null;
  const whatScope = certObj
    ? { label: "Certification", name: certObj.name }
    : taskObj
    ? { label: "Task", name: taskObj.name }
    : null;

  /* examples (real entities) */
  const examples = [
    { who: "Diego Ramirez", what: "EPA 608 Type I", w: "U-10132", x: { kind: "cert", id: "C-0420" } as const },
    { who: "Ayesha Khan", what: "Refrigerant Charging", w: "U-10157", x: { kind: "task", id: "T-2350" } as const },
  ].filter((ex) => {
    // Only show examples whose entities resolve in the built model.
    const wok = !!data.employeesById[ex.w];
    const xok = ex.x.kind === "cert" ? !!data.certsById[ex.x.id] : !!data.tasksById[ex.x.id];
    return wok && xok;
  });

  /* half-state copy */
  const half =
    whoUser && !what
      ? { title: "Now pick what to check", sub: "Search a certification or a single task above.", num: "2" }
      : { title: "Now pick who to check", sub: "Search an employee above.", num: "1" };

  /* ───── shared row bits handed to the task table ───── */
  const rowCtx: RowCtx = {
    cells,
    isStagedComplete,
    isStagedIncomplete,
    stagedGrant,
    toggleComplete,
    openGrant,
    openMenu: (uid, tid, rect) => setMenu({ kind: "task", uid, tid, rect }),
    menuFor: menu?.kind === "task" ? { uid: menu.uid, tid: menu.tid } : null,
  };

  /* Employee × certification derivations. */
  const certProgress =
    showUserCert ? progress(cells, certManual, whoUser!.id, certTasks, certObj!.id) : null;
  const certStaged = showUserCert && !!stagedCertOf(whoUser!.id);
  const certUnStaged = showUserCert && !!stagedCertUnOf(whoUser!.id);

  /* Employee × task derivations. */
  const taskCell = showUserTask ? cells[whoUser!.id + "_" + taskObj!.id] : null;

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

  /* The anchored menu's rows, by what it was opened on. */
  const menuItems: MenuItem[] = (() => {
    if (!menu) return [];
    if (menu.kind === "cert") {
      /* One action, by state: complete the certification (every open task at
         once) until it is certified, reopen it after. A staged one undoes. */
      if (!certProgress?.certified) {
        const open = certTasks.filter((t) => cells[menu.uid + "_" + t.id]?.status !== "complete").length;
        return [
          {
            icon: <MenuMarkCompleteIcon />,
            label: certStaged
              ? "Undo Mark Certification as Completed"
              : "Mark Certification as Completed",
            note: certStaged
              ? "Staged — applies on Review & Save."
              : `Marks the ${open} open ${open === 1 ? "task" : "tasks"} complete. Applies on Review & Save.`,
            onPick: () => toggleCertStage(menu.uid, menu.certId, certTasks),
          },
        ];
      }
      return [
        {
          icon: <MenuMarkIncompleteIcon />,
          label: certUnStaged
            ? "Undo Mark Certification as Incomplete"
            : "Mark Certification as Incomplete",
          note: certUnStaged ? "Staged — applies on Review & Save." : "Reopens all tasks. Applies on Review & Save.",
          danger: true,
          onPick: () => toggleCertUnstage(menu.uid, menu.certId),
        },
      ];
    }
    const t = data.tasksById[menu.tid];
    const c = cells[menu.uid + "_" + menu.tid];
    if (!t || !c) return [];
    const done = c.status === "complete";
    /* The row has no other control (Figma 960:980), so a staged change is
       undone from here too. */
    const stagedC = isStagedComplete(menu.uid, menu.tid);
    const stagedI = isStagedIncomplete(menu.uid, menu.tid);
    const items: MenuItem[] = [
      done
        ? {
            icon: <MenuMarkIncompleteIcon />,
            label: stagedI ? "Undo Mark as Incomplete" : "Mark as Incomplete",
            note: stagedI ? "Staged — applies on Review & Save." : undefined,
            onPick: () => toggleComplete(menu.uid, menu.tid),
          }
        : {
            icon: <MenuMarkCompleteIcon />,
            label: stagedC ? "Undo Mark as Completed" : "Mark as Completed",
            note: stagedC ? "Staged — applies on Review & Save." : undefined,
            onPick: () => toggleComplete(menu.uid, menu.tid),
          },
    ];
    /* Granting only means something where attempts are capped — a quiz with a
       limit, i.e. the final exam. Viewing them works wherever they're kept. */
    if (attemptInfo(t, c).hasLimit) {
      items.push({
        icon: <MenuGrantAttemptsIcon />,
        label: "Grant Additional Attempts",
        onPick: () => openGrant(menu.uid, menu.tid),
      });
    }
    if (tracksAttempts(t)) {
      items.push({
        icon: <MenuAttemptsIcon />,
        label: "View All Attempts",
        onPick: () => setAttListFor({ uid: menu.uid, tid: menu.tid }),
      });
    }
    return items;
  })();

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
              Look up an employee, then a certification or a single task, to review and override
              completions.
            </div>
          </header>

          {/* ===== scope pickers ===== */}
          <div className="mc-scoperow">
            <ScopeSearch
              placeholder="Search Users..."
              scope={whoScope}
              query={whoQ}
              onQuery={setWhoQ}
              onClearScope={clearWho}
              options={whoOptions}
              emptyText="No users match."
              showKbd
            />
            <span className="mc-scope-sep">
              <ChevronRightIcon />
            </span>
            <ScopeSearch
              placeholder="Search Tasks or Certifications..."
              scope={whatScope}
              query={whatQ}
              onQuery={setWhatQ}
              onClearScope={clearWhat}
              options={whatOptions}
              emptyText="No certifications or tasks match."
            />
          </div>

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
                    Search an <strong>employee</strong>, then a{" "}
                    <strong>certification or a single task</strong>, to review their progress and
                    override completions.
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
              <div className="mc-scroll">
                {/* ── employee × certification ── */}
                {showUserCert && certProgress && (
                  <>
                    {/* Certification card (Figma 965:1401): progress headline,
                        the task count, and the ⋯ that holds every
                        certification-level action. */}
                    <div className="mc-notice mc-certcard">
                      <div className="mc-notice-text">
                        <div className="mc-certcard-title">
                          {certProgress.certified ? "Certification Complete" : `${certProgress.pct}% Complete`}
                          {certStaged && <span className="co-status-pill co-status-pill--accent">Staged: Complete</span>}
                          {certUnStaged && (
                            <span className="co-status-pill co-status-pill--accent">Staged: Incomplete</span>
                          )}
                        </div>
                        <div className="mc-certcard-sub">
                          {certProgress.certified
                            ? `All ${certTasks.length} Tasks in the Certification are complete · Certified ${
                                fmtD(certProgress.certAt) || "—"
                              }${certProgress.certManual ? " (marked manually)" : ""}`
                            : `${certProgress.c} out of ${certTasks.length} Tasks in the Certification are complete`}
                        </div>
                      </div>
                      <button
                        className="row-action-btn lone-dots"
                        aria-label="Certification actions"
                        onClick={(e) =>
                          setMenu({
                            kind: "cert",
                            uid: whoUser!.id,
                            certId: certObj!.id,
                            rect: e.currentTarget.getBoundingClientRect(),
                          })
                        }
                      >
                        <RowKebabIcon />
                      </button>
                    </div>

                    <TaskTable uid={whoUser!.id} tasks={certTasks} ctx={rowCtx} />
                  </>
                )}

                {/* ── employee × task ── */}
                {showUserTask && taskCell && (
                  <UserTaskView
                    user={whoUser!}
                    task={taskObj!}
                    cell={taskCell}
                    ctx={rowCtx}
                    onViewAttempts={() => setAttListFor({ uid: whoUser!.id, tid: taskObj!.id })}
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

          {/* ===== anchored 3-dot menu (task rows + the certification) ===== */}
          {menu && menuItems.length > 0 && (
            <AnchoredMenu rect={menu.rect} onClose={() => setMenu(null)} items={menuItems} />
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
                  const task = s.kind === "cert" || s.kind === "certun" ? null : data.tasksById[s.tid];
                  return (
                    <div className="mc-review-item" key={i}>
                      {task ? (
                        <TaskTypeIcon type={task.type} />
                      ) : (
                        <span className="mc-typeicon">
                          {s.kind === "certun" ? <XCircleIcon /> : <CheckIcon />}
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
                        max={gradePrompt.max}
                        autoFocus
                        value={gradeInput}
                        onChange={(e) => setGradeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmGrade();
                        }}
                        placeholder="Optional"
                      />
                      <span className="mc-gradefield-suffix">/ {gradePrompt.max}</span>
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

/** One cell of the metrics strip under a view header. */
function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mc-metric">
      <div className="mc-metric-label">{label}</div>
      <div className="mc-metric-value">{value}</div>
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
        {/* Figma 902:3585 "Text Entered": once there is something to clear —
            typed text or a picked scope — the ⌘K badge gives way to a ✕. */}
        {query || scope ? (
          <button
            type="button"
            className="usearch-clear"
            aria-label="Clear search"
            title="Clear search"
            /* Keep the input focused — clearing should not close the panel. */
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onQuery("");
              onClearScope();
              setActive(-1);
              inputRef.current?.focus();
            }}
          >
            <SearchClearIcon />
          </button>
        ) : (
          showKbd && (
            <span className="usearch-kbd">
              <span className="kbd-cmd"><KeyCommandIcon /></span>
              <span className="kbd-letter">K</span>
            </span>
          )
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
  cells: CellMap;
  isStagedComplete: (uid: string, tid: string) => boolean;
  isStagedIncomplete: (uid: string, tid: string) => boolean;
  stagedGrant: (uid: string, tid: string) => { n: number } | undefined;
  toggleComplete: (uid: string, tid: string) => void;
  openGrant: (uid: string, tid: string) => void;
  openMenu: (uid: string, tid: string, rect: DOMRect) => void;
  /** The row whose menu is open — it holds the hover treatment open. */
  menuFor: { uid: string; tid: string } | null;
};

/* ───────────────────────────── task table ──────────────────────────────── */

/** One person's tasks on the employee × certification view — the Figma
 *  960:980 card: TASK · TIME SPENT · COMPLETED ON · GRADE · ATTEMPTS · ⋯. */
function TaskTable({ uid, tasks, ctx }: { uid: string; tasks: CertTask[]; ctx: RowCtx }) {
  return (
    <div className="mct">
      <div className="mct-hd">
        <span className="mct-c-task">Task</span>
        <span className="mct-c-time">Time Spent</span>
        <span className="mct-c-date">Completed On</span>
        <span className="mct-c-grade">Grade</span>
        <span className="mct-c-att">Attempts</span>
        <span className="mct-c-menu" />
      </div>
      {/* Only the rows scroll — the page, the card and this header stay put. */}
      <div className="mct-rows">
        {tasks.map((t) => (
          <TaskRow key={t.id} uid={uid} task={t} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ uid, task, ctx }: { uid: string; task: CertTask; ctx: RowCtx }) {
  const cell = ctx.cells[uid + "_" + task.id];
  const done = cell.status === "complete";
  const stagedC = ctx.isStagedComplete(uid, task.id);
  const stagedI = ctx.isStagedIncomplete(uid, task.id);
  const time = tracksTime(task) ? fmtMins(cell.timeSpent) : "";
  const grade = gradeLabel(task, cell);
  const menuOpen = ctx.menuFor?.uid === uid && ctx.menuFor.tid === task.id;
  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    ctx.openMenu(uid, task.id, e.currentTarget.getBoundingClientRect());
  };
  return (
    <div
      className={`mct-row${stagedC || stagedI ? " is-staged" : ""}${menuOpen ? " is-menu" : ""}`}
    >
      <span className="mct-c-task">
        <span className="mct-name">{task.name}</span>
        <span className="mct-type">· {TYPE_SHORT[task.type]}</span>
        {stagedC && <span className="co-status-pill co-status-pill--accent">Staged: Complete</span>}
        {stagedI && <span className="co-status-pill co-status-pill--accent">Staged: Incomplete</span>}
      </span>
      <span className="mct-c-time">{time || "-"}</span>
      <span className="mct-c-date">
        {!done ? (
          "-"
        ) : cell.manual ? (
          /* The flag and the date share one tooltip naming who set it. */
          <span className="mct-manual" data-tip={`Manually marked complete by ${cell.markedBy ?? ADMIN_ACTOR}`}>
            {fmtDY(cell.completedAt)}
            <FlagIcon />
          </span>
        ) : (
          fmtDY(cell.completedAt)
        )}
      </span>
      <span className="mct-c-grade">{grade || "-"}</span>
      <span className="mct-c-att">
        <AttemptsValue task={task} cell={cell} grant={ctx.stagedGrant(uid, task.id)} />
      </span>
      {/* Shared row-action chrome (Figma 386:269): the resting kebab gives way
          to the bar pill on hover, exactly as on Tasks and Certifications. The
          bar holds one cell here — the menu is this row's only action. */}
      <span className="mct-c-menu">
        <button className="row-action-btn lone-dots" aria-label="Task actions" onClick={openMenu}>
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          <button className="row-action-btn" aria-label="Task actions" onClick={openMenu}>
            <RowKebabIcon />
          </button>
        </div>
      </span>
    </div>
  );
}

/* ───────────────────────── employee × task view ────────────────────────── */

function UserTaskView({
  user,
  task,
  cell,
  ctx,
  onViewAttempts,
}: {
  user: Employee;
  task: CertTask;
  cell: Cell;
  ctx: RowCtx;
  onViewAttempts: () => void;
}) {
  const ai = attemptInfo(task, cell);
  const stagedC = ctx.isStagedComplete(user.id, task.id);
  const stagedI = ctx.isStagedIncomplete(user.id, task.id);
  const done = cell.status === "complete";

  return (
    <>
      <div className="mc-viewhead">
        <div className="mc-viewhead-text">
          <div className="mc-viewhead-name">{user.name}</div>
          <div className="mc-viewhead-sub">
            <span className="mc-viewhead-task">
              <TaskTypeIcon type={task.type} />
              {task.name}
            </span>
            {" · "}
            {task.certName}
          </div>
        </div>
        <div className="mc-viewhead-actions">
          {done ? (
            <span className="co-status-pill co-status-pill--green">
              {cell.manual ? "Complete · Marked Manually" : "Complete"}
            </span>
          ) : stagedC ? (
            <PillButton tone="accent" label="Staged: Complete · Undo" onClick={() => ctx.toggleComplete(user.id, task.id)} />
          ) : (
            <button className="btn-publish" onClick={() => ctx.toggleComplete(user.id, task.id)}>
              Mark as Completed
            </button>
          )}
          {done &&
            (stagedI ? (
              <PillButton tone="accent" label="Staged: Incomplete · Undo" onClick={() => ctx.toggleComplete(user.id, task.id)} />
            ) : (
              <button className="btn-save-draft" onClick={() => ctx.toggleComplete(user.id, task.id)}>
                Mark as Incomplete
              </button>
            ))}
          {tracksAttempts(task) && (
            <button className="btn-save-draft" onClick={onViewAttempts}>
              View All Attempts
            </button>
          )}
          {/* Only a capped quiz — the final exam — can be granted more. */}
          {ai.hasLimit && (
            <button className="btn-save-draft" onClick={() => ctx.openGrant(user.id, task.id)}>
              Grant Additional Attempts
            </button>
          )}
        </div>
      </div>

      <div className="mc-metrics mc-metrics--5">
        <Metric
          label="Status"
          value={<TaskStatusPill task={task} cell={cell} staged={stagedC} stagedIncomplete={stagedI} />}
        />
        <Metric
          label="Completed On"
          value={
            done ? (
              cell.manual ? (
                <span className="mct-manual" data-tip={`Manually marked complete by ${cell.markedBy ?? ADMIN_ACTOR}`}>
                  {fmtDT(cell.completedAt)}
                  <FlagIcon />
                </span>
              ) : (
                fmtDT(cell.completedAt)
              )
            ) : (
              ""
            )
          }
        />
        <Metric label="Marked By" value={cell.markedBy ?? ""} />
        <Metric label="Highest Grade" value={gradeLabel(task, cell)} />
        <Metric
          label={ai.hasLimit ? `Attempts (Max. ${ai.totalAllowed})` : "Attempts"}
          value={<AttemptsValue task={task} cell={cell} grant={ctx.stagedGrant(user.id, task.id)} />}
        />
      </div>
    </>
  );
}

/* ───────────────────────── anchored 3-dot menu ─────────────────────────── */

type MenuItem = {
  icon: JSX.Element;
  label: string;
  onPick: () => void;
  /** Destructive row — the design-system red (.u-menu-item--danger). */
  danger?: boolean;
  /** Second line under the label. */
  note?: string;
};

/** Same `.u-menu` chrome + fixed positioning as the Users row menu — the
 *  table scrolls, so an in-row popover would be clipped. */
function AnchoredMenu({
  rect,
  onClose,
  items,
}: {
  rect: DOMRect;
  onClose: () => void;
  items: MenuItem[];
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
      {items.map((it) => (
        <button
          key={it.label}
          className={`u-menu-item${it.danger ? " u-menu-item--danger" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            it.onPick();
            onClose();
          }}
        >
          <span className="u-menu-item-icon">{it.icon}</span>
          <span className="u-menu-item-text">
            <span>{it.label}</span>
            {it.note && <span className="u-menu-item-sub mc-menu-note">{it.note}</span>}
          </span>
        </button>
      ))}
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
