/**
 * Certification Lookup — data model + pure helpers + mutations.
 *
 * Ports the "cert-engine" status/attempt/timeline logic, but seeds everything
 * from the app's real entities instead of synthetic demo data:
 *   • Employees      → src/data/users.ts (the Users page)
 *   • Cohorts        → distinct companyName groups among B2B users
 *   • Certifications → src/data/certifications.ts
 *   • Tasks          → src/data/tasks.ts (associated by `usedIn`, then padded
 *                      deterministically to each cert's declared task count)
 *
 * Per-(employee, task) completion state has no home in the app data, so it is
 * generated deterministically (seeded by a hash of the ids) — stable across
 * renders and identical on every load. Admin actions (mark complete, grant an
 * attempt, mark a certification) overlay this baseline via React state.
 */

import { users, type User } from "./users";
import { certifications as appCerts } from "./certifications";
import { tasks as appTasks, type Task, type TaskType } from "./tasks";
import type { Attempt } from "./attempts";

/* ───────────────────────── deterministic RNG ───────────────────────── */

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* Fixed "now" so generated timelines are deterministic (app uses fixed dates). */
const NOW = Date.parse("2026-06-25T12:00:00");
const DAY = 86400000;

/* ───────────────────────────── types ───────────────────────────────── */

export type CellStatus = "complete" | "review" | "incomplete";

export type Cell = {
  status: CellStatus;
  assignedAt: number;
  startedAt: number | null;
  submittedAt: number | null;
  completedAt: number | null;
  grade: number | null;
  attempts: number;
  timeSpent: number; // minutes
  returnedAt: number | null;
  attemptGrants: { at: number; amount: number }[];
  manual: boolean;
};

export type CertTask = {
  id: string;
  name: string;
  type: TaskType;
  certId: string;
  certName: string;
  difficulty: number;
  isFinal: boolean;
  attemptLimit: number | null;
};

export type CertDef = { id: string; name: string; industry: string; taskIds: string[] };
export type Cohort = { id: string; name: string; userIds: string[] };

export type Employee = {
  id: string;
  name: string;
  initials: string;
  contact: string;
  cohort: string | null;
  isB2B: boolean;
};

export type CellMap = Record<string, Cell>;
export type CertManual = Record<string, { at: number }>;

export type CertData = {
  employees: Employee[];
  employeesById: Record<string, Employee>;
  cohorts: Cohort[];
  certifications: CertDef[];
  certsById: Record<string, CertDef>;
  tasks: CertTask[];
  tasksById: Record<string, CertTask>;
  cells: CellMap;
};

/* ──────────────────────── cert ⇄ task association ───────────────────── */

/** `usedIn` labels in tasks.ts use short aliases; map them to cert ids. */
const USEDIN_TO_CERT: Record<string, string> = {
  "EPA 608 Type I": "C-0420",
  "EPA 608 Type II": "C-0419",
  "EPA 608 Type III": "C-0418",
  "EPA 608 Universal": "C-0421",
  "NATE RTW": "C-0410",
  "Safety Bundle": "C-0405",
  "HVAC Field Skills": "C-0398",
  "OSHA 10": "C-0341",
  // "OSHA 30" has no matching certification — ignored.
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

function attemptLimitFor(t: Task): number | null {
  if (t.type !== "Quiz") return null;
  if (t.finalExam) return 2;
  return hash(t.id) % 2 === 0 ? 2 : 3;
}

/** Real tasks associated with a cert via `usedIn`, padded to the declared count. */
function tasksForCert(cert: (typeof appCerts)[number], certIndex: number): Task[] {
  const matched = appTasks.filter(
    (t) => !t.draft && t.usedIn.some((u) => USEDIN_TO_CERT[u] === cert.id),
  );
  const target = clamp(cert.tasks, 4, 12);
  const pool = appTasks.filter((t) => !t.draft && !t.finalExam);

  const list: Task[] = [];
  const seen = new Set<string>();
  for (const t of matched) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      list.push(t);
    }
  }
  // Pad with a deterministic, distinct window of the task pool.
  for (let i = 0; list.length < target && i < pool.length * 3; i++) {
    const c = pool[(certIndex * 7 + i * 3) % pool.length];
    if (!seen.has(c.id)) {
      seen.add(c.id);
      list.push(c);
    }
  }
  let result = list.length > target ? list.slice(0, target) : list;

  // Ensure the certification's real final exam (if any) sits last.
  const fin = result.find((t) => t.finalExam) ?? matched.find((t) => t.finalExam);
  if (fin) {
    result = result.filter((t) => t.id !== fin.id);
    if (result.length >= target) result.pop();
    result.push(fin);
  }
  return result;
}

/* ─────────────────────────── build the model ────────────────────────── */

function genCell(uid: string, task: CertTask, forceComplete: boolean): Cell {
  const rng = mulberry32(hash(uid + "|" + task.id));
  const skill = 0.4 + (hash(uid) % 1000) / 1000 * 0.55;

  const r = rng();
  const p = skill - task.difficulty * 0.4;
  let status: CellStatus;
  if (forceComplete || r < Math.max(0.06, p)) status = "complete";
  else if (r < Math.max(0.06, p) + 0.13) status = "review";
  else status = "incomplete";

  const assignedAt = NOW - (Math.floor(rng() * 30) + 40) * DAY;
  let startedAt: number | null = null;
  let submittedAt: number | null = null;
  let completedAt: number | null = null;
  let grade: number | null = null;
  let attempts = 0;
  let timeSpent = 0;

  if (status !== "incomplete") {
    startedAt = assignedAt + (1 + Math.floor(rng() * 5)) * DAY;
    submittedAt = startedAt + (1 + Math.floor(rng() * 10)) * DAY;
    attempts = 1 + Math.floor(rng() * 2);
    timeSpent = 20 + Math.floor(rng() * 130);
  }
  if (status === "complete") {
    completedAt = submittedAt! + Math.floor(rng() * 4) * DAY;
    grade = 62 + Math.floor(rng() * 38);
  }

  return {
    status,
    assignedAt,
    startedAt,
    submittedAt,
    completedAt,
    grade,
    attempts,
    timeSpent,
    returnedAt: null,
    attemptGrants: [],
    manual: false,
  };
}

export function buildData(): CertData {
  // Employees from the Users list.
  const employees: Employee[] = (users as User[]).map((u) => ({
    id: u.id,
    name: u.name,
    initials: initialsOf(u.name),
    contact: u.email,
    cohort: u.companyName ?? null,
    isB2B: u.userType === "B2B",
  }));
  const employeesById: Record<string, Employee> = {};
  employees.forEach((e) => (employeesById[e.id] = e));

  // Cohorts = distinct companyName groups (B2B only), ordered by name.
  const cohortMap = new Map<string, string[]>();
  employees.forEach((e) => {
    if (!e.cohort) return;
    if (!cohortMap.has(e.cohort)) cohortMap.set(e.cohort, []);
    cohortMap.get(e.cohort)!.push(e.id);
  });
  const cohorts: Cohort[] = [...cohortMap.entries()]
    .map(([name, userIds]) => ({ id: name, name, userIds }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Certifications (non-draft) with real, padded task lists.
  const certifications: CertDef[] = [];
  const tasksById: Record<string, CertTask> = {};
  const tasks: CertTask[] = [];

  appCerts
    .filter((c) => !c.draft)
    .forEach((c, ci) => {
      const realTasks = tasksForCert(c, ci);
      const taskIds = realTasks.map((t) => t.id);
      certifications.push({ id: c.id, name: c.name, industry: c.industry, taskIds });
      realTasks.forEach((t) => {
        if (tasksById[t.id]) return; // first cert that references a task owns its display context
        const ct: CertTask = {
          id: t.id,
          name: t.name,
          type: t.type,
          certId: c.id,
          certName: c.name,
          difficulty: (hash(t.id) % 1000) / 1000,
          isFinal: !!t.finalExam,
          attemptLimit: attemptLimitFor(t),
        };
        tasksById[t.id] = ct;
        tasks.push(ct);
      });
    });
  const certsById: Record<string, CertDef> = {};
  certifications.forEach((c) => (certsById[c.id] = c));

  // Top-skill employees get fully-complete records (mirrors the original seed).
  const topIds = new Set(
    employees
      .slice()
      .sort((a, b) => (hash(b.id) % 1000) - (hash(a.id) % 1000))
      .slice(0, 3)
      .map((e) => e.id),
  );

  // Generate baseline cells for every (employee, task) pair in play.
  const cells: CellMap = {};
  employees.forEach((e) => {
    tasks.forEach((t) => {
      cells[e.id + "_" + t.id] = genCell(e.id, t, topIds.has(e.id));
    });
  });

  return {
    employees,
    employeesById,
    cohorts,
    certifications,
    certsById,
    tasks,
    tasksById,
    cells,
  };
}

/* ─────────────────────────── pure helpers ───────────────────────────── */

export function cellOf(cells: CellMap, uid: string, tid: string): Cell | undefined {
  return cells[uid + "_" + tid];
}

export type Progress = {
  c: number;
  rv: number;
  inc: number;
  total: number;
  pct: number;
  avg: number | null;
  last: number;
  certified: boolean;
  certManual: boolean;
  certAt: number | null;
};

export function progress(
  cells: CellMap,
  certManual: CertManual,
  uid: string,
  taskList: CertTask[],
  certId: string,
): Progress {
  let c = 0,
    rv = 0,
    inc = 0,
    gs = 0,
    gn = 0,
    last = 0;
  for (const t of taskList) {
    const cl = cells[uid + "_" + t.id];
    if (!cl) continue;
    if (cl.status === "complete") {
      c++;
      if (cl.grade) {
        gs += cl.grade;
        gn++;
      }
      if ((cl.completedAt ?? 0) > last) last = cl.completedAt ?? 0;
    } else if (cl.status === "review") rv++;
    else inc++;
  }
  const total = taskList.length || 1;
  let certified = inc === 0 && rv === 0 && taskList.length > 0;
  let certAt: number | null = certified ? last : null;
  let manual = false;
  const ov = certManual[uid + "_" + certId];
  if (ov) {
    certified = true;
    manual = true;
    certAt = ov.at;
  }
  return {
    c,
    rv,
    inc,
    total,
    pct: Math.round((c / total) * 100),
    avg: gn ? Math.round(gs / gn) : null,
    last,
    certified,
    certManual: manual,
    certAt,
  };
}

export type StatusVisual = {
  /** Table Pill tone (Figma 109:1237) — drives `.co-status-pill--{tone}`. */
  tone: "green" | "accent" | "grey";
  /** Status-dot modifier — drives `.mc-dot--{dot}` in the matrix. */
  dot: "done" | "review" | "todo";
  /** True when the completion was applied by an admin rather than earned. */
  manual: boolean;
  label: string;
};

/** Maps a cell status onto the design system's status vocabulary. */
export function statusVisual(st: CellStatus, manual: boolean): StatusVisual {
  if (st === "complete")
    return {
      tone: "green",
      dot: "done",
      manual,
      label: manual ? "Complete · Marked Manually" : "Complete",
    };
  if (st === "review")
    return { tone: "accent", dot: "review", manual: false, label: "In Review" };
  return { tone: "grey", dot: "todo", manual: false, label: "Incomplete" };
}

export type AttemptInfo = {
  isQuiz: boolean;
  hasLimit: boolean;
  attemptLimit: number | null;
  grantedTotal: number;
  attemptsUsed: number;
  totalAllowed: number | null;
  remaining: number | null;
  grants: { at: number; amount: number }[];
};

export function attemptInfo(t: CertTask, c: Cell): AttemptInfo {
  const isQuiz = t.type === "Quiz";
  const attemptLimit = t.attemptLimit ?? null;
  const grants = c.attemptGrants || [];
  const grantedTotal = grants.reduce((s, g) => s + g.amount, 0);
  const attemptsUsed = c.attempts || 0;
  const hasLimit = isQuiz && attemptLimit != null;
  const totalAllowed = hasLimit ? attemptLimit! + grantedTotal : null;
  const remaining = hasLimit ? Math.max(0, (totalAllowed ?? 0) - attemptsUsed) : null;
  return { isQuiz, hasLimit, attemptLimit, grantedTotal, attemptsUsed, totalAllowed, remaining, grants };
}

/* ───────────────────── attempt history (for the Attempts page) ──────────────────── */

const PHONE_AREA = ["415", "510", "408", "650", "213", "312", "713", "305", "602", "206"];

function synthPhone(uid: string): string {
  const h = hash(uid + "|phone");
  const area = PHONE_AREA[h % PHONE_AREA.length];
  const mid = 200 + (h % 700);
  const last4 = 1000 + (Math.floor(h / 7) % 9000);
  return `(${area}) ${mid}-${String(last4).slice(-4)}`;
}

/** Reconstruct a plausible per-attempt history from a Cell's aggregate
 *  attempt count, so "View attempts" (opened from Manage Completions) always
 *  has real rows to show whenever the employee has actually attempted the
 *  quiz — instead of relying on an unrelated mock dataset. Deterministic, so
 *  it's identical whether generated inline or independently in a new tab. */
export function attemptsForTask(
  uid: string,
  employeeName: string,
  employeeEmail: string,
  task: CertTask,
  cell: Cell,
): Attempt[] {
  const n = cell.attempts;
  if (!n) return [];
  const rng = mulberry32(hash(uid + "|" + task.id + "|hist"));
  const phone = synthPhone(uid);
  const startBase = cell.startedAt ?? cell.assignedAt;
  const endBase = cell.completedAt ?? cell.submittedAt ?? startBase + DAY;
  const span = Math.max(endBase - startBase, DAY);

  const out: Attempt[] = [];
  for (let i = 1; i <= n; i++) {
    const isLast = i === n;
    const slot = startBase + Math.floor(((i - 1) / n) * span);
    const durMin = 8 + Math.floor(rng() * 90);
    const startedAtTs = slot + Math.floor(rng() * 3) * 3600000;
    const completedAtTs = startedAtTs + durMin * 60000;
    const grade =
      isLast && cell.grade != null
        ? cell.grade
        : Math.max(35, Math.min(100, Math.round(30 + rng() * 55)));
    out.push({
      id: uid + "_" + task.id + "_" + i,
      name: employeeName,
      email: employeeEmail,
      phone,
      quizName: task.name,
      attemptNumber: i,
      status: "Completed",
      startedAt: fmtDT(startedAtTs),
      completedAt: fmtDT(completedAtTs),
      grade,
    });
  }
  return out;
}

/* ──────────────────────────── formatting ───────────────────────────── */

export function fmtD(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export function fmtDT(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}
export function rel(ts: number | null): string {
  if (!ts) return "—";
  const diff = NOW - ts;
  const d = Math.floor(diff / DAY);
  if (d <= 0) return "today";
  if (d === 1) return "1 day";
  if (d < 30) return d + " days";
  const m = Math.floor(d / 30);
  return m + (m === 1 ? " month" : " months");
}
export function fmtDur(min: number): string {
  if (!min) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? h + "h " + m + "m" : m + "m";
}

/* ───────────────────── detail (timeline + metrics) ──────────────────── */

export type TimelineEvent = { label: string; tsStr: string; tone: "done" | "accent" | "future" };

export type TaskDetail = {
  gradeStr: string;
  grade: number | null;
  completedStr: string;
  durStr: string;
  attemptsStr: string;
  timeline: TimelineEvent[];
  isQuizLimited: boolean;
  attemptsRemainingStr: string;
  hasGrants: boolean;
  grantLog: { amountStr: string; atStr: string }[];
  footerNote: string;
};

export function buildDetail(cells: CellMap, uid: string, task: CertTask): TaskDetail {
  const c = cells[uid + "_" + task.id]!;
  const tl: TimelineEvent[] = [];
  tl.push({ label: "Assigned", tsStr: fmtDT(c.assignedAt), tone: "done" });
  if (c.startedAt) tl.push({ label: "Started", tsStr: fmtDT(c.startedAt), tone: "done" });
  if (c.submittedAt)
    tl.push({
      label: "Submitted" + (c.attempts > 1 ? " · attempt " + c.attempts : ""),
      tsStr: fmtDT(c.submittedAt),
      tone: "done",
    });
  if (c.returnedAt) tl.push({ label: "Returned for revision", tsStr: fmtDT(c.returnedAt), tone: "done" });
  if (c.status === "review")
    tl.push({ label: "Awaiting your review", tsStr: "Pending · waiting " + rel(c.submittedAt), tone: "accent" });
  else if (c.status === "complete") {
    if (c.manual)
      tl.push({
        label: "Marked complete by admin" + (c.grade ? " · " + c.grade + "/100" : ""),
        tsStr: fmtDT(c.completedAt),
        tone: "done",
      });
    else
      tl.push({
        label: "Approved" + (c.grade ? " · " + c.grade + "/100" : ""),
        tsStr: fmtDT(c.completedAt),
        tone: "done",
      });
  } else {
    if (c.returnedAt) tl.push({ label: "Awaiting resubmission", tsStr: "No new submission yet", tone: "future" });
    else tl.push({ label: "Not started", tsStr: "No submission yet", tone: "future" });
  }

  const ai = attemptInfo(task, c);
  let attemptsRemainingStr = "";
  if (ai.hasLimit)
    attemptsRemainingStr =
      ai.attemptsUsed +
      " of " +
      ai.totalAllowed +
      " attempt" +
      (ai.totalAllowed === 1 ? "" : "s") +
      " used · " +
      ai.remaining +
      " remaining";
  const grantLog = ai.grants.map((g) => ({
    amountStr: "+" + g.amount + " attempt" + (g.amount === 1 ? "" : "s"),
    atStr: fmtDT(g.at),
  }));

  let footerNote = "";
  if (c.status === "complete")
    footerNote = c.manual
      ? "Marked complete by admin" + (c.grade ? " · grade " + c.grade + "/100" : " — no grade recorded") + "."
      : "Read-only — approved & complete.";
  else if (c.status === "incomplete" && c.returnedAt)
    footerNote = "Returned to employee — or mark it complete manually.";
  else footerNote = "Not yet submitted — you can mark it complete manually for this employee.";

  return {
    gradeStr: c.grade ? c.grade + "/100" : "—",
    grade: c.grade,
    completedStr: c.completedAt ? fmtD(c.completedAt) : "—",
    durStr: fmtDur(c.timeSpent),
    attemptsStr: ai.hasLimit ? ai.attemptsUsed + " / " + ai.totalAllowed : c.attempts ? String(c.attempts) : "0",
    timeline: tl,
    isQuizLimited: ai.hasLimit,
    attemptsRemainingStr,
    hasGrants: ai.grantedTotal > 0,
    grantLog,
    footerNote,
  };
}

export function needsGradePrompt(task: CertTask): boolean {
  return task.type === "Quiz" || task.type === "xAPI";
}

/* ──────────────────── mutations (return new state) ───────────────────── */

export function applyMarkComplete(cells: CellMap, uid: string, tid: string, grade: number | null): CellMap {
  const key = uid + "_" + tid;
  const c = cells[key];
  if (!c) return cells;
  const next: Cell = {
    ...c,
    status: "complete",
    startedAt: c.startedAt ?? c.assignedAt + DAY,
    submittedAt: c.submittedAt ?? NOW - 3600000,
    completedAt: NOW,
    manual: true,
    attempts: c.attempts || 1,
    timeSpent: c.timeSpent || 30,
    grade:
      grade != null && !Number.isNaN(grade) ? Math.max(0, Math.min(100, Math.round(grade))) : null,
  };
  return { ...cells, [key]: next };
}

export function applyGrantAttempt(cells: CellMap, uid: string, tid: string, amount = 1): CellMap {
  const key = uid + "_" + tid;
  const c = cells[key];
  if (!c) return cells;
  return { ...cells, [key]: { ...c, attemptGrants: [...c.attemptGrants, { at: NOW, amount }] } };
}

export function applyMarkCert(certManual: CertManual, uid: string, certId: string): CertManual {
  return { ...certManual, [uid + "_" + certId]: { at: NOW } };
}

export function applyClearCert(certManual: CertManual, uid: string, certId: string): CertManual {
  const next = { ...certManual };
  delete next[uid + "_" + certId];
  return next;
}

/* ──────────────── Proctoring exam ⇄ quiz attempt ────────────────
   The Proctoring queue names an exam ("EPA 608 Type 2 Certificate"); the
   attempt viewer is addressed by a TASK id. These are explicit rather than
   fuzzy-matched: the two data sets spell the same certification differently
   (roman numerals vs digits, a "Certificate" suffix), so a normalising match
   would be guesswork. EPA 609 has no certification here and stays unmapped. */
const PROCTORED_EXAM_TO_CERT: Record<string, string> = {
  "EPA 608 Universal Certificate": "C-0421",
  "EPA 608 Type 1 Certificate": "C-0420",
  "EPA 608 Type 2 Certificate": "C-0419",
  "EPA 608 Type 3 Certificate": "C-0418",
  "NATE Ready To Work": "C-0410",
};

/** buildData() rebuilds the whole seeded data set; this only needs to read it. */
let cachedData: CertData | null = null;

/** The task whose attempt a proctored submission refers to.
 *
 *  Resolved from the TASK data (`usedIn`), not from `certsById[...].taskIds`:
 *  a certification's task list is padded and then sliced to its declared task
 *  count, so the real exam is often not in it — EPA 608 Type II's list keeps
 *  five tasks and drops "Combustion Analysis", the quiz that is actually
 *  proctored. Preference: the certification's final exam, then its first Quiz,
 *  then anything it uses.
 *
 *  The id is checked against `tasksById` before being returned, because the
 *  attempt viewer renders "not found" for a task the seeded data set doesn't
 *  know. Returns null when nothing usable resolves — the caller then offers no
 *  attempt link at all rather than a dead one. */
export function attemptTaskIdForExam(examName: string): string | null {
  const certId = PROCTORED_EXAM_TO_CERT[examName];
  if (!certId) return null;
  cachedData ??= buildData();

  const used = (appTasks as Task[]).filter(
    (t) => !t.draft && t.usedIn.some((u) => USEDIN_TO_CERT[u] === certId),
  );
  const candidates = [
    ...used.filter((t) => t.finalExam),
    ...used.filter((t) => !t.finalExam && t.type === "Quiz"),
    ...used,
    // Last resort: whatever the certification's own (sliced) list holds.
    ...(cachedData.certsById[certId]?.taskIds ?? []).map((id) => ({ id })),
  ];
  return candidates.find((t) => cachedData!.tasksById[t.id])?.id ?? null;
}
