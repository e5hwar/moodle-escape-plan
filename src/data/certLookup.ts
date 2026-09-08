/**
 * Certification Lookup — data model + pure helpers + mutations.
 *
 * Ports the "cert-engine" status/attempt/timeline logic, but seeds everything
 * from the app's real entities instead of synthetic demo data:
 *   • Employees      → src/data/users.ts (the Users page) plus every company's
 *                      own generated roster (src/data/companies.ts), so a
 *                      cohort exists for every company on the Companies page
 *   • Cohorts        → one per company, holding both rosters' employees
 *   • Certifications → src/data/certifications.ts
 *   • Tasks          → src/data/tasks.ts (associated by `usedIn`, then filled
 *                      from the pool so every cert follows the same PLAN of
 *                      task types × states — see "demo scenario plan")
 *
 * Per-(employee, task) completion state has no home in the app data, so it is
 * generated deterministically: each task's slot in its certification's PLAN
 * fixes the state (complete, pending review, out of attempts…) and a hash of
 * the ids seeds the numbers — stable across renders and identical on every
 * load. Admin actions (mark complete / incomplete, grant an attempt, mark a
 * certification) overlay this baseline via React state.
 */

import { users, type User } from "./users";
import { companies as appCompanies, getCompanyUsers } from "./companies";
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
  /** Who marked the task complete — an instructor for reviewed Hands-On work,
   *  the admin for manual overrides, null when it was earned in-product. */
  markedBy: string | null;
  /** Attempt numbers an admin has deleted (each frees one attempt slot). */
  deletedAttempts: number[];
  /** The reason typed into the apply-changes dialog, when one was given. */
  note: string | null;
};

export type CertTask = {
  id: string;
  name: string;
  type: TaskType;
  certId: string;
  certName: string;
  isFinal: boolean;
  /** Sat under a proctor — its submissions wait in the Proctoring queue, so
   *  the task can be pending review the way a Hands-On task can. */
  proctored: boolean;
  /** Quizzes and Hands-On tasks are attempt-limited; the rest are open. */
  attemptLimit: number | null;
};

export type CertDef = {
  id: string;
  name: string;
  industry: string;
  taskIds: string[];
};
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
  "EPA 609": "C-0417",
  "NATE RTW": "C-0410",
  "Safety Bundle": "C-0405",
  "HVAC Field Skills": "C-0398",
  "OSHA 10": "C-0341",
  // "OSHA 30" has no matching certification — ignored.
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

/** Only a quiz can cap attempts, and in this data set only the certification's
 *  final exam does — every other quiz and every Hands-On task retries freely.
 *  A capped quiz is the one place "Grant Attempts" means anything. */
function attemptLimitFor(t: Task): number | null {
  return t.type === "Quiz" && t.finalExam ? (hash(t.id) % 2 === 0 ? 2 : 3) : null;
}

/* ───────────────────────── demo scenario plan ─────────────────────────
   Every certification carries every task type in every state the task table
   can show, so any employee × certification is a complete demonstration:
   xAPI / Resource complete and open, an admin's manual completion (flag), a
   Quiz passed / still failing, Hands-On instructor-graded / pending review
   (hourglass) / still failing / marked by hand, and the final exam out of
   attempts (error) — the one capped task, so the one that can be exhausted
   and the one "Grant Attempts" is offered on. The order reads like a learner
   working through the certification. Only the numbers vary per employee. */
export type Scenario =
  | "complete" // earned in-product (xAPI, Resource)
  | "manual" // an admin marked it complete — flagged in the table
  | "inprogress" // started, time logged, not finished (xAPI)
  | "notstarted"
  | "passed" // Quiz complete on a passing grade
  | "graded" // Hands-On complete, instructor-graded
  | "failing" // attempted, best grade under the bar, free to retry
  | "exhausted" // every attempt of a capped quiz used without a pass
  | "pending"; // submitted, awaiting review (Hands-On / proctored Quiz)

const PLAN: { type: TaskType; scenario: Scenario; final?: boolean }[] = [
  { type: "Resource", scenario: "complete" },
  { type: "xAPI", scenario: "complete" },
  { type: "Quiz", scenario: "passed" },
  { type: "Hands-On Task", scenario: "graded" },
  { type: "xAPI", scenario: "manual" },
  { type: "Hands-On Task", scenario: "manual" },
  { type: "xAPI", scenario: "inprogress" },
  { type: "Quiz", scenario: "failing" },
  { type: "Hands-On Task", scenario: "pending" },
  { type: "Hands-On Task", scenario: "failing" },
  { type: "Resource", scenario: "notstarted" },
  { type: "xAPI", scenario: "notstarted" },
  { type: "Quiz", scenario: "notstarted" },
  { type: "Hands-On Task", scenario: "notstarted" },
  { type: "Quiz", scenario: "exhausted", final: true },
];

/** One task per PLAN slot: the cert's own `usedIn` tasks first, then any task
 *  of that type nobody has taken, and once the pool runs dry a copy of one
 *  under a cert-suffixed id — cells are keyed by task, so two certs can never
 *  share a task or they would share its state. `taken` runs across certs. */
function tasksForCert(
  cert: (typeof appCerts)[number],
  certIndex: number,
  taken: Set<string>,
): { task: Task; scenario: Scenario }[] {
  const matched = appTasks.filter((t) =>
    t.usedIn.some((u) => USEDIN_TO_CERT[u] === cert.id),
  );
  /* Names already on this cert's list. A certification never shows the same
     task name twice — including once the pool is down to clones, which carry
     their source's name. Every type's pool holds more distinct names than the
     PLAN asks slots of it, so a fresh one is always there to find. */
  const names = new Set<string>();
  const pick = (slot: (typeof PLAN)[number]): Task => {
    const fits = (t: Task) =>
      t.type === slot.type && !!t.finalExam === !!slot.final;
    const fresh = (t: Task) => fits(t) && !names.has(t.name);
    const free =
      matched.find((t) => fresh(t) && !taken.has(t.id)) ??
      appTasks.find((t) => fresh(t) && !taken.has(t.id));
    if (free) return free;
    const pool = appTasks.filter(fresh);
    if (pool.length) {
      const src = pool[(certIndex * 7 + taken.size) % pool.length];
      return { ...src, id: `${src.id}~${cert.id}` };
    }
    /* Only reachable if a PLAN ever asks for more slots of a type than the
       pool holds names: number the repeat so the rows stay tellable apart. */
    const all = appTasks.filter(fits);
    const src = all[(certIndex * 7 + taken.size) % all.length];
    let n = 2;
    while (names.has(`${src.name} ${n}`)) n++;
    return { ...src, id: `${src.id}~${cert.id}~${n}`, name: `${src.name} ${n}` };
  };
  return PLAN.map((slot) => {
    const task = pick(slot);
    taken.add(task.id);
    names.add(task.name);
    return { task, scenario: slot.scenario };
  });
}

/* ─────────────────────────── build the model ────────────────────────── */

/** Instructors credited on reviewed Hands-On completions (hash-picked). */
const INSTRUCTORS = [
  "J. Cole (Instructor)",
  "M. Ferris (Instructor)",
  "S. Bhatt (Instructor)",
];

/** The cell for one employee on one task, in the state its PLAN slot names.
 *  Time is only tracked on xAPI and Quiz tasks. Hands-On is scored out of 10
 *  and kept as tens on the shared 0–100 scale, so `/10` reads back exactly. */
function genCell(uid: string, task: CertTask, scenario: Scenario): Cell {
  const rng = mulberry32(hash(uid + "|" + task.id));
  const r = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  /* Uncapped tasks still log attempts — 3 is just the ceiling for the
     generated counts, not a limit the UI enforces. */
  const limit = task.attemptLimit ?? 3;
  const handsOn = task.type === "Hands-On Task";
  const assignedAt = NOW - r(40, 70) * DAY;
  const startedAt = assignedAt + r(1, 5) * DAY;
  const submittedAt = startedAt + r(1, 10) * DAY;
  const completedAt = submittedAt + r(0, 3) * DAY;
  const timeSpent = tracksTime(task) ? r(8, 95) : 0;
  const pass = () => (handsOn ? r(6, 10) * 10 : r(70, 100));
  const fail = () => (handsOn ? r(1, 5) * 10 : r(15, 65));

  const base: Cell = {
    status: "incomplete",
    assignedAt,
    startedAt: null,
    submittedAt: null,
    completedAt: null,
    grade: null,
    attempts: 0,
    timeSpent: 0,
    returnedAt: null,
    attemptGrants: [],
    manual: false,
    markedBy: null,
    deletedAttempts: [],
    note: null,
  };
  const done = {
    status: "complete" as const,
    startedAt,
    submittedAt,
    completedAt,
    attempts: 1,
    timeSpent,
  };
  switch (scenario) {
    case "notstarted":
      return base;
    case "inprogress":
      return { ...base, startedAt, attempts: 1, timeSpent };
    case "complete":
      return { ...base, ...done };
    case "manual":
      return { ...base, ...done, manual: true, markedBy: ADMIN_ACTOR };
    case "passed":
      return { ...base, ...done, attempts: r(1, limit), grade: pass() };
    case "graded":
      return {
        ...base,
        ...done,
        attempts: r(1, 2),
        grade: pass(),
        markedBy:
          INSTRUCTORS[
            hash(uid + "|" + task.id + "|marker") % INSTRUCTORS.length
          ],
      };
    case "failing":
      return {
        ...base,
        startedAt,
        submittedAt,
        attempts: r(1, Math.max(1, limit - 1)),
        timeSpent,
        grade: fail(),
      };
    case "exhausted":
      return {
        ...base,
        startedAt,
        submittedAt,
        attempts: limit,
        timeSpent,
        grade: fail(),
      };
    case "pending": {
      /* A Hands-On resubmission still shows the grade the last attempt got;
         a proctored quiz has no grade until the proctor signs off. */
      const attempts = r(1, limit);
      return {
        ...base,
        status: "review",
        startedAt,
        submittedAt,
        attempts,
        timeSpent,
        grade: handsOn && attempts > 1 ? fail() : null,
      };
    }
  }
}

export function buildData(): CertData {
  // Employees from the Users list…
  const employees: Employee[] = (users as User[]).map((u) => ({
    id: u.id,
    name: u.name,
    initials: initialsOf(u.name),
    contact: u.email,
    cohort: u.companyName ?? null,
    isB2B: u.userType === "B2B",
  }));

  /* …plus each company's own roster. Company employees are generated and live
     outside the Manage Users list (see getCompanyUsers), but a company opened
     from the Companies page must resolve to a cohort with people in it —
     only 11 of the 28 companies have anyone in the Manage Users roster. Their
     "U-9…" ids are outside the users.ts range, so the two never collide. */
  appCompanies.forEach((c) => {
    getCompanyUsers(c).forEach((u) => {
      employees.push({
        id: u.id,
        name: u.name,
        initials: initialsOf(u.name),
        contact: u.email,
        cohort: c.name,
        isB2B: true,
      });
    });
  });

  const employeesById: Record<string, Employee> = {};
  employees.forEach((e) => (employeesById[e.id] = e));

  // Cohorts = one per company, ordered by name. Every company on the
  // Companies page gets an entry, even when only one roster feeds it.
  const cohortMap = new Map<string, string[]>();
  appCompanies.forEach((c) => cohortMap.set(c.name, []));
  employees.forEach((e) => {
    if (!e.cohort) return;
    if (!cohortMap.has(e.cohort)) cohortMap.set(e.cohort, []);
    cohortMap.get(e.cohort)!.push(e.id);
  });
  const cohorts: Cohort[] = [...cohortMap.entries()]
    .map(([name, userIds]) => ({ id: name, name, userIds }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Certifications (non-draft), each with a full PLAN of tasks of its own.
  const certifications: CertDef[] = [];
  const tasksById: Record<string, CertTask> = {};
  const tasks: CertTask[] = [];
  const scenarioOf: Record<string, Scenario> = {};
  const taken = new Set<string>();

  /* Every certification, drafts included — the Certifications row menu offers
     "Manage User Progress" on all of them, so each must resolve here or the
     page opens with an empty scope. */
  appCerts.forEach((c, ci) => {
    const planned = tasksForCert(c, ci, taken);
    certifications.push({
      id: c.id,
      name: c.name,
      industry: c.industry,
      taskIds: planned.map((p) => p.task.id),
    });
    planned.forEach(({ task: t, scenario }) => {
      const ct: CertTask = {
        id: t.id,
        name: t.name,
        type: t.type,
        certId: c.id,
        certName: c.name,
        isFinal: !!t.finalExam,
        proctored: t.type === "Quiz" && !!t.finalExam,
        attemptLimit: attemptLimitFor(t),
      };
      tasksById[t.id] = ct;
      tasks.push(ct);
      scenarioOf[t.id] = scenario;
    });
  });
  const certsById: Record<string, CertDef> = {};
  certifications.forEach((c) => (certsById[c.id] = c));

  // Baseline cells for every (employee, task) pair, in the slot's state.
  const cells: CellMap = {};
  employees.forEach((e) => {
    tasks.forEach((t) => {
      cells[e.id + "_" + t.id] = genCell(e.id, t, scenarioOf[t.id]);
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

export function cellOf(
  cells: CellMap,
  uid: string,
  tid: string,
): Cell | undefined {
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
    return {
      tone: "accent",
      dot: "review",
      manual: false,
      label: "Pending Review",
    };
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
  /* A deleted attempt frees its slot. */
  const attemptsUsed = Math.max(
    0,
    (c.attempts || 0) - (c.deletedAttempts?.length ?? 0),
  );
  /* Capped at all — only a final-exam quiz is, so this also gates the
     exhausted state and the Grant Attempts action. */
  const hasLimit = attemptLimit != null;
  const totalAllowed = hasLimit ? attemptLimit! + grantedTotal : null;
  const remaining = hasLimit
    ? Math.max(0, (totalAllowed ?? 0) - attemptsUsed)
    : null;
  return {
    isQuiz,
    hasLimit,
    attemptLimit,
    grantedTotal,
    attemptsUsed,
    totalAllowed,
    remaining,
    grants,
  };
}

/** True when an attempt-limited quiz is out of attempts without a pass —
 *  the red "Attempts Exhausted" state. Granting attempts clears it. */
export function isExhausted(t: CertTask, c: Cell): boolean {
  if (c.status === "complete") return false;
  const ai = attemptInfo(t, c);
  return ai.hasLimit && ai.remaining === 0;
}

/* ───────────────────── attempt history (for the Attempts page) ──────────────────── */

const PHONE_AREA = [
  "415",
  "510",
  "408",
  "650",
  "213",
  "312",
  "713",
  "305",
  "602",
  "206",
];

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

  const deleted = new Set(cell.deletedAttempts ?? []);
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
  /* Admin-deleted attempts drop out of the history but keep their numbering,
     so "#3" still names the same attempt after "#2" is deleted. */
  return out.filter((a) => !deleted.has(a.attemptNumber));
}

/* ──────────────────────────── formatting ───────────────────────────── */

export function fmtD(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
/** "Aug 28, 2027" — the task table's Completed On cell. */
export function fmtDY(ts: number | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
/** "12 mins" — the task table's Time Spent cell. */
export function fmtMins(min: number): string {
  if (!min) return "";
  return min === 1 ? "1 min" : `${min} mins`;
}

/* ───────────────────── task-table display rules ───────────────────── */

/** Time is only tracked on xAPI and Quiz tasks. */
export function tracksTime(t: CertTask): boolean {
  return t.type === "xAPI" || t.type === "Quiz";
}

/** Attempts are counted on Quizzes and Hands-On tasks — whether or not the
 *  task caps them (only a final exam does; see `attemptLimitFor`). */
export function tracksAttempts(t: CertTask): boolean {
  return t.type === "Quiz" || t.type === "Hands-On Task";
}

/** A grade as the table shows it: Quizzes as a percentage, Hands-On out of 10
 *  (stored as tens on the shared scale). Other task types carry no grade. */
export function gradeLabel(t: CertTask, c: Cell): string {
  if (c.grade == null) return "";
  if (t.type === "Quiz") return `${c.grade}%`;
  if (t.type === "Hands-On Task") return String(Math.round(c.grade / 10));
  return "";
}

/** Row subtitle labels — "Hands-On", not the entity's full "Hands-On Task". */
export const TYPE_SHORT: Record<TaskType, string> = {
  xAPI: "xAPI",
  Quiz: "Quiz",
  "Hands-On Task": "Hands-On",
  Resource: "Resource",
};
export function fmtDT(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}
export function rel(ts: number | null): string {
  if (!ts) return "";
  const diff = NOW - ts;
  const d = Math.floor(diff / DAY);
  if (d <= 0) return "today";
  if (d === 1) return "1 day";
  if (d < 30) return d + " days";
  const m = Math.floor(d / 30);
  return m + (m === 1 ? " month" : " months");
}
export function fmtDur(min: number): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? h + "h " + m + "m" : m + "m";
}

/* ───────────────────── detail (timeline + metrics) ──────────────────── */

export type TimelineEvent = {
  label: string;
  tsStr: string;
  tone: "done" | "accent" | "future";
};

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

export function buildDetail(
  cells: CellMap,
  uid: string,
  task: CertTask,
): TaskDetail {
  const c = cells[uid + "_" + task.id]!;
  const tl: TimelineEvent[] = [];
  tl.push({ label: "Assigned", tsStr: fmtDT(c.assignedAt), tone: "done" });
  if (c.startedAt)
    tl.push({ label: "Started", tsStr: fmtDT(c.startedAt), tone: "done" });
  if (c.submittedAt)
    tl.push({
      label: "Submitted" + (c.attempts > 1 ? " · attempt " + c.attempts : ""),
      tsStr: fmtDT(c.submittedAt),
      tone: "done",
    });
  if (c.returnedAt)
    tl.push({
      label: "Returned for revision",
      tsStr: fmtDT(c.returnedAt),
      tone: "done",
    });
  if (c.status === "review")
    tl.push({
      label: "Awaiting your review",
      tsStr: "Pending · waiting " + rel(c.submittedAt),
      tone: "accent",
    });
  else if (c.status === "complete") {
    if (c.manual)
      tl.push({
        label:
          "Marked complete by admin" +
          (c.grade ? " · " + c.grade + "/100" : ""),
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
    if (c.returnedAt)
      tl.push({
        label: "Awaiting resubmission",
        tsStr: "No new submission yet",
        tone: "future",
      });
    else
      tl.push({
        label: "Not started",
        tsStr: "No submission yet",
        tone: "future",
      });
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
      ? "Marked complete by admin" +
        (c.grade ? " · grade " + c.grade + "/100" : " — no grade recorded") +
        "."
      : "Read-only — approved & complete.";
  else if (c.status === "incomplete" && c.returnedAt)
    footerNote = "Returned to employee — or mark it complete manually.";
  else
    footerNote =
      "Not yet submitted — you can mark it complete manually for this employee.";

  return {
    gradeStr: c.grade ? c.grade + "/100" : "",
    grade: c.grade,
    completedStr: c.completedAt ? fmtD(c.completedAt) : "",
    durStr: fmtDur(c.timeSpent),
    attemptsStr: ai.hasLimit
      ? ai.attemptsUsed + " / " + ai.totalAllowed
      : c.attempts
        ? String(c.attempts)
        : "0",
    timeline: tl,
    isQuizLimited: ai.hasLimit,
    attemptsRemainingStr,
    hasGrants: ai.grantedTotal > 0,
    grantLog,
    footerNote,
  };
}

/** Only Quizzes and Hands-On tasks carry a grade, so only they ask for one
 *  when marked complete by hand. */
export function needsGradePrompt(task: CertTask): boolean {
  return task.type === "Quiz" || task.type === "Hands-On Task";
}

/* ──────────────────── mutations (return new state) ───────────────────── */

/** The admin every manual change is logged as, and the fixed-clock stamp the
 *  audit line shows (the app runs on the deterministic NOW above). */
export const ADMIN_ACTOR = "A. Rivera (CS)";
export const ADMIN_STAMP = fmtDT(NOW);

export function applyMarkComplete(
  cells: CellMap,
  uid: string,
  tid: string,
  grade: number | null,
  markedBy: string | null = null,
  note: string | null = null,
): CellMap {
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
    markedBy: markedBy ?? c.markedBy,
    note: note ?? c.note,
    attempts: c.attempts || 1,
    timeSpent: c.timeSpent || 30,
    grade:
      grade != null && !Number.isNaN(grade)
        ? Math.max(0, Math.min(100, Math.round(grade)))
        : null,
  };
  return { ...cells, [key]: next };
}

/** Reopens a completed task — the reverse of applyMarkComplete. The earned
 *  record (attempts, time, quiz grade) stays; only the completion goes, so a
 *  quiz's attempt history still reads the same afterwards. */
export function applyMarkIncomplete(
  cells: CellMap,
  uid: string,
  tid: string,
): CellMap {
  const key = uid + "_" + tid;
  const c = cells[key];
  if (!c || c.status !== "complete") return cells;
  const next: Cell = {
    ...c,
    status: "incomplete",
    completedAt: null,
    manual: false,
    markedBy: null,
    note: null,
    grade: c.attempts > 0 ? c.grade : null,
  };
  return { ...cells, [key]: next };
}

/** Deletes one attempt from a quiz's history — the attempt number disappears
 *  from `attemptsForTask` and `attemptInfo` counts one more remaining slot. */
export function applyDeleteAttempt(
  cells: CellMap,
  uid: string,
  tid: string,
  attemptNumber: number,
): CellMap {
  const key = uid + "_" + tid;
  const c = cells[key];
  if (!c || c.deletedAttempts.includes(attemptNumber)) return cells;
  return {
    ...cells,
    [key]: { ...c, deletedAttempts: [...c.deletedAttempts, attemptNumber] },
  };
}

export function applyGrantAttempt(
  cells: CellMap,
  uid: string,
  tid: string,
  amount = 1,
): CellMap {
  const key = uid + "_" + tid;
  const c = cells[key];
  if (!c) return cells;
  return {
    ...cells,
    [key]: { ...c, attemptGrants: [...c.attemptGrants, { at: NOW, amount }] },
  };
}

export function applyMarkCert(
  certManual: CertManual,
  uid: string,
  certId: string,
): CertManual {
  return { ...certManual, [uid + "_" + certId]: { at: NOW } };
}

export function applyClearCert(
  certManual: CertManual,
  uid: string,
  certId: string,
): CertManual {
  const next = { ...certManual };
  delete next[uid + "_" + certId];
  return next;
}

/* ──────────────── Proctoring exam ⇄ quiz attempt ────────────────
   The Proctoring queue names an exam ("EPA 608 Type 2 Certificate"); the
   attempt viewer is addressed by a TASK id. These are explicit rather than
   fuzzy-matched: the two data sets spell the same certification differently
   (roman numerals vs digits, a "Certificate" suffix), so a normalising match
   would be guesswork. All six proctored exams map; an unmapped one would simply
   get no attempt link. */
const PROCTORED_EXAM_TO_CERT: Record<string, string> = {
  "EPA 608 Universal Certificate": "C-0421",
  "EPA 608 Type 1 Certificate": "C-0420",
  "EPA 608 Type 2 Certificate": "C-0419",
  "EPA 608 Type 3 Certificate": "C-0418",
  "NATE Ready To Work": "C-0410",
  "EPA 609 Certificate": "C-0417",
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

  const used = (appTasks as Task[]).filter((t) =>
    t.usedIn.some((u) => USEDIN_TO_CERT[u] === certId),
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
