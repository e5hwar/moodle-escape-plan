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
 * certification) overlay this baseline, and are kept in completions.ts so they
 * outlast a visit (see `liveCells`).
 */

import { getUsers } from "./users";
import { getLiveCompanies } from "./companies";
import { completionsStore, type CertOverride, type CompletionsState } from "./completions";
import { certifications as appCerts } from "./certifications";
import {
  handsOnGrading,
  quizGradingOf,
  quizPassPct,
  taskById,
  tasks as appTasks,
  type HandsOnGrading,
  type Task,
  type TaskType,
} from "./tasks";
import { gradeStatus, type Attempt } from "./attempts";
import { certIndustryText } from "./industries";

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

/* The model's "now" — the real clock, the one the Users roster's dates count
   from, taken to the minute when the module loads. Generated timelines are
   offsets from it, so they keep their shape. */
const NOW = Math.floor(Date.now() / 60000) * 60000;
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
  /** What a manual completion replaced, so Mark as Incomplete can put it back
   *  exactly — the earned best grade, never the one typed for the override. */
  beforeManual?: { grade: number | null; sectionGrades?: number[] };
  /** A section-level Quiz's per-Section grades, in Section order, when an
   *  admin marked it complete with them. `grade` is then their average. */
  sectionGrades?: number[];
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
  /** Hands-On scoring — the scale a reviewer grades on and the score that
   *  passes, or `{ graded: false }` for a Task that passes on submission.
   *  `null` on every other task type. */
  handsOn: HandsOnGrading | null;
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
  /** Second identifier on a search row — the scope picker shows
   *  "email · phone" (Figma 1162:1454). */
  phone: string;
  cohort: string | null;
  isB2B: boolean;
  /** Epoch ms of this person's most recent access to the app — `lastAccess`
   *  from the Manage Users roster, and the company roster's own "12d ago"
   *  label for generated employees. 0 when they have never been in (an invite
   *  nobody has accepted). Orders the scope picker's blank-state shortlist. */
  lastActiveAt: number;
};

export type CellMap = Record<string, Cell>;
/** Manual certification decisions, keyed `uid_certId` (see completions.ts).
 *  `by` is the admin the card credits — a manual award always names who made it. */
export type CertManual = Record<string, CertOverride>;

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
  "Building Science Principles": "C-0406",
  "Safety Bundle": "C-0405",
  "HVAC JobReady": "C-0398",
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

/** Has this learner finished this certification outright? A deterministic
 *  coin-flip per (employee, certification) pair — about half land true. */
function certFinished(uid: string, certId: string): boolean {
  return hash(uid + "|" + certId + "|finished") % 2 === 0;
}

/** Has this learner not touched this certification at all? Drawn only from
 *  the pairs `certFinished` leaves unfinished — about a third of those, so
 *  roughly one pair in six. Every task lands on "notstarted" and the
 *  certification card reads Not Started (Figma 1504:1483) instead of 0%.
 *  A separate salt, so the finished half is exactly what it was. */
function certUntouched(uid: string, certId: string): boolean {
  return !certFinished(uid, certId) && hash(uid + "|" + certId + "|untouched") % 3 === 0;
}

/** The slot's scenario, promoted so the task reads as done. A manual
 *  completion stays manual (it IS complete, and the flag is worth keeping in
 *  the demo); everything else lands on the finished state its type earns —
 *  a graded pass for Quizzes and scored Hands-On work, a plain completion for
 *  xAPI, Resources and the Hands-On Tasks nobody grades. */
function finishedScenario(task: CertTask, scenario: Scenario): Scenario {
  if (scenario === "manual") return "manual";
  if (task.type === "Quiz") return "passed";
  if (task.type === "Hands-On Task") return task.handsOn?.graded ? "graded" : "complete";
  return "complete";
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
  /* The task's own scale, when a reviewer grades it at all. */
  const hoScale = task.handsOn?.graded ? task.handsOn : null;
  /* A Hands-On task nobody grades can't be graded, failing or pending review —
     it is done the moment it is submitted. Fold those scenarios onto the plain
     completion so the row never claims a review that will never happen. */
  if (handsOn && !hoScale) {
    if (scenario === "graded" || scenario === "failing" || scenario === "pending") {
      scenario = "complete";
    }
  }
  const assignedAt = NOW - r(40, 70) * DAY;
  const startedAt = assignedAt + r(1, 5) * DAY;
  const submittedAt = startedAt + r(1, 10) * DAY;
  const completedAt = submittedAt + r(0, 3) * DAY;
  const timeSpent = tracksTime(task) ? r(8, 95) : 0;
  /* Grades are stored as a percentage whatever the task; a Hands-On score is
     drawn on the task's own scale and converted, so it round-trips back to a
     whole score through `formatGrade`. */
  const onScale = (score: number) => Math.round((score / hoScale!.maxScore) * 100);
  const pass = () =>
    hoScale ? onScale(r(hoScale.passScore, hoScale.maxScore)) : r(quizPassFor(task), 100);
  const fail = () =>
    hoScale ? onScale(r(1, hoScale.passScore - 1)) : r(15, quizPassFor(task) - 5);

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

/** Midnight at the start of that day, on the model's fixed clock. */
function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Both rosters record only the DAY someone was last in, and a shortlist of
 *  the most recent people is mostly ties at that granularity — ordered, with
 *  nothing to order them by, in whatever sequence the roster was built. So
 *  each person gets a deterministic working hour inside their day
 *  (07:00–19:59) to break them. Never later than "now". */
function lastActiveTs(dayTs: number, seed: string): number {
  const h = hash(seed + "|lastactive");
  const at = dayStart(dayTs) + (7 + (h % 13)) * 3600000 + (h % 60) * 60000;
  return Math.min(at, NOW - 5 * 60000);
}

/* Building the model generates a cell for every person × task (~165k with the
   whole roster), so it is built once per roster and company list and shared by
   every caller — Manage Completions, the deep links, Award counts. Callers
   only read it; applied changes live in completions.ts (`liveCells`). */
let built: { users: unknown; companies: unknown; data: CertData } | null = null;
export function buildData(): CertData {
  const users = getUsers();
  const companies = getLiveCompanies();
  if (built && built.users === users && built.companies === companies) return built.data;
  built = { users, companies, data: computeData() };
  return built.data;
}

function computeData(): CertData {
  /* Employees: the live Users roster, which lists every company's own
     roster beside the hand-authored learners — so a company opened from the
     Companies page resolves to a cohort with people in it. */
  const employees: Employee[] = getUsers().map((u) => ({
    id: u.id,
    name: u.name,
    initials: initialsOf(u.name),
    contact: u.email,
    phone: u.phone || synthPhone(u.id),
    cohort: u.companyName ?? null,
    isB2B: u.userType === "B2B",
    lastActiveAt: u.lastAccess ? lastActiveTs(Date.parse(`${u.lastAccess}T00:00:00`), u.id) : 0,
  }));

  const employeesById: Record<string, Employee> = {};
  employees.forEach((e) => (employeesById[e.id] = e));

  // Cohorts = one per company, ordered by name. Every company on the
  // Companies page gets an entry, even when only one roster feeds it.
  const cohortMap = new Map<string, string[]>();
  getLiveCompanies().forEach((c) => cohortMap.set(c.name, []));
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
      industry: certIndustryText(c.industries),
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
        handsOn: handsOnGrading(t),
      };
      tasksById[t.id] = ct;
      tasks.push(ct);
      scenarioOf[t.id] = scenario;
    });
  });
  const certsById: Record<string, CertDef> = {};
  certifications.forEach((c) => (certsById[c.id] = c));

  /* Baseline cells for every (employee, task) pair, in the slot's state —
     except that roughly HALF of the (employee, certification) pairs are
     finished outright. The PLAN alone gave every learner the same part-done
     certification, so every combination read ~40% and a completed one could
     only be reached by marking it by hand. `certFinished` flips a coin per
     pair (deterministic, like everything else here) and the slot's scenario
     is promoted to its finished equivalent. About a sixth more are untouched
     (`certUntouched`): every task not started, so the 0% Not Started card has
     real records to show. */
  const cells: CellMap = {};
  employees.forEach((e) => {
    tasks.forEach((t) => {
      const scenario = certFinished(e.id, t.certId)
        ? finishedScenario(t, scenarioOf[t.id])
        : certUntouched(e.id, t.certId)
        ? "notstarted"
        : scenarioOf[t.id];
      cells[e.id + "_" + t.id] = genCell(e.id, t, scenario);
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
  /** Who awarded it by hand — null when it was earned in-product. */
  certBy: string | null;
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
  let certBy: string | null = null;
  const ov = certManual[uid + "_" + certId];
  if (ov?.state === "complete") {
    certified = true;
    manual = true;
    certAt = ov.at;
    certBy = ov.by;
  } else if (ov?.state === "incomplete" && last <= ov.at) {
    /* Withdrawn by an admin: it stays Incomplete until the person meets the
       criteria again — every task complete, at least one of them AFTER the
       withdrawal. */
    certified = false;
    certAt = null;
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
    certBy,
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
  const attemptsUsed = Math.max(0, c.attempts || 0);
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
      taskId: task.id,
      name: employeeName,
      email: employeeEmail,
      phone,
      quizName: task.name,
      attemptNumber: i,
      status: gradeStatus(grade, taskById(task.id)),
      startedAt: fmtDT(startedAtTs),
      completedAt: fmtDT(completedAtTs),
      grade,
    });
  }
  return out;
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

/** The pass mark for a Quiz outside the library. Library Quizzes carry their
 *  own mark and grading model — see {@link quizPassFor}. */
export const QUIZ_PASS_PCT = 70;

/** A Quiz's own pass mark, as one overall percentage: its Quiz-level mark, or
 *  — graded Section by Section — the mark that clears every Section that
 *  decides it (data/tasks `quizPassPct`). Read from the live library, so an
 *  edited pass mark applies here at once. */
export function quizPassFor(t: Pick<CertTask, "id">): number {
  const lib = taskById(t.id);
  return lib ? quizPassPct(lib) : QUIZ_PASS_PCT;
}

/** A Quiz graded Section by Section: each Section's name and pass mark, and
 *  whether it decides the pass — the Must Pass ones, or every Section when
 *  none is marked. null for any other task, which takes one overall grade. */
export function sectionMarks(
  t: Pick<CertTask, "id" | "type">,
): { name: string; pass: number; decides: boolean }[] | null {
  if (t.type !== "Quiz") return null;
  const lib = taskById(t.id);
  if (!lib?.quizSections?.length || quizGradingOf(lib).model !== "section_level") return null;
  const anyMust = lib.quizSections.some((s) => s.requiredToPass);
  return lib.quizSections.map((s) => ({
    name: s.name,
    pass: s.passingPct,
    decides: !anyMust || s.requiredToPass,
  }));
}

/** xAPI Tasks whose package reports a score the Task keeps. */
function capturesScore(t: Pick<CertTask, "id" | "type">): boolean {
  return t.type === "xAPI" && !!taskById(t.id)?.scoreCapture;
}

/** Grades are STORED as a 0–100 percentage whatever the task type, so one
 *  field serves a quiz's 72% and a Hands-On task's 18-out-of-25. These two
 *  functions are the only places that translation happens.
 *
 *  A Quiz reads as the percentage itself; a Hands-On task reads on the scale
 *  its author set — "6/10", "18/25". A Hands-On task that isn't graded at all
 *  (it passes on submission) has nothing to show, and neither does an xAPI or
 *  Resource task. */
export function formatGrade(t: CertTask, grade: number | null): string {
  if (grade == null) return "";
  if (t.type === "Quiz" || capturesScore(t)) return `${grade}%`;
  if (t.type === "Hands-On Task") {
    const g = t.handsOn;
    if (!g?.graded) return "";
    return `${Math.round((grade / 100) * g.maxScore)}/${g.maxScore}`;
  }
  return "";
}

export function gradeLabel(t: CertTask, c: Cell): string {
  return formatGrade(t, c.grade);
}

/** Whether a stored 0–100 grade clears the task's own pass mark. */
export function gradePasses(t: CertTask, grade: number | null): boolean {
  if (grade == null) return false;
  const g = t.handsOn;
  if (g?.graded) return Math.round((grade / 100) * g.maxScore) >= g.passScore;
  return grade >= quizPassFor(t);
}

/** The pass mark, phrased for a tooltip — "Passes at 7 out of 10". Empty when
 *  the task has no mark to name (ungraded Hands-On, xAPI, Resource). */
export function passMarkLabel(t: CertTask): string {
  const g = t.handsOn;
  if (g) return g.graded ? `Passes at ${g.passScore} out of ${g.maxScore}.` : "";
  if (t.type === "Quiz") return `Passes at ${quizPassFor(t)}%.`;
  return "";
}

/** Row subtitle labels — "Hands-On", not the entity's full "Hands-On Task". */
export const TYPE_SHORT: Record<TaskType, string> = {
  xAPI: "xAPI",
  Quiz: "Quiz",
  "Hands-On Task": "Hands-On",
  Resource: "Resource",
  "ID Upload": "ID Upload",
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

/** Only graded tasks ask for a grade when marked complete by hand — every
 *  Quiz, the Hands-On tasks a reviewer actually scores, and xAPI tasks with
 *  Score Capture on. One overall grade either way: a sectioned Quiz is never
 *  completed Section by Section here. */
export function needsGradePrompt(task: CertTask): boolean {
  if (task.type === "Quiz") return true;
  if (capturesScore(task)) return true;
  return !!task.handsOn?.graded;
}

/** The scale an admin types a grade on for this task: the Hands-On task's own
 *  max, or a percentage for everything else. */
export function gradeScale(task: CertTask): number {
  return task.handsOn?.graded ? task.handsOn.maxScore : 100;
}

/** The lowest grade, on {@link gradeScale}, that passes this task: the
 *  Hands-On task's own pass score, the Quiz's own pass mark — or, for an xAPI
 *  score, nothing: any reported score completes it. */
export function passMark(task: CertTask): number {
  if (task.handsOn?.graded) return task.handsOn.passScore;
  if (task.type === "xAPI") return 0;
  return quizPassFor(task);
}

/* ──────────────────── mutations (return new state) ───────────────────── */

/** The admin every manual change is logged as, and the fixed-clock stamp the
 *  audit line shows (the app runs on the deterministic NOW above). */
export const ADMIN_ACTOR = "A. Rivera (CS)";
export function adminStamp(): string {
  return fmtDT(Date.now());
}

/** Marks a task complete by hand. Only the completion is recorded — no
 *  attempt, time or submission is invented, so nothing counts against an
 *  attempt limit. A typed grade (optional) is recorded on the task's
 *  percentage scale; left blank, the user's existing best grade stands. */
export function applyMarkComplete(
  cells: CellMap,
  uid: string,
  tid: string,
  grade: number | null,
  markedBy: string | null = null,
  sectionGrades?: number[],
): CellMap {
  const key = uid + "_" + tid;
  const c = cells[key];
  if (!c) return cells;
  const next: Cell = {
    ...c,
    status: "complete",
    completedAt: stampNow(),
    manual: true,
    markedBy: markedBy ?? c.markedBy,
    grade:
      grade != null && !Number.isNaN(grade)
        ? Math.max(0, Math.min(100, Math.round(grade)))
        : c.grade,
    beforeManual: { grade: c.grade, sectionGrades: c.sectionGrades },
    sectionGrades,
  };
  return { ...cells, [key]: next };
}

/** Reopens a completed task — the reverse of applyMarkComplete. What the
 *  learner earned (attempts, time, their own best grade) stays; a manual
 *  completion leaves nothing behind, its typed grade included. */
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
    grade: c.beforeManual ? c.beforeManual.grade : c.attempts > 0 ? c.grade : null,
    sectionGrades: c.beforeManual?.sectionGrades,
  };
  delete next.beforeManual;
  return { ...cells, [key]: next };
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

/** A stamp for a change applied now — the real time, and strictly after the
 *  previous one, so a withdrawal and a completion in the same minute still
 *  order (see `progress`). */
let lastStamp = 0;
function stampNow(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

export function applyMarkCert(
  certManual: CertManual,
  uid: string,
  certId: string,
  certName: string,
  by: string = ADMIN_ACTOR,
): CertManual {
  return { ...certManual, [uid + "_" + certId]: { state: "complete", at: stampNow(), by, certName, on: todayIsoLocal() } };
}

/** Withdraws a Certification: recorded as its own override, so an earned one
 *  stays Incomplete until the criteria are met again (see `progress`). */
export function applyClearCert(
  certManual: CertManual,
  uid: string,
  certId: string,
  certName: string,
  by: string = ADMIN_ACTOR,
): CertManual {
  return { ...certManual, [uid + "_" + certId]: { state: "incomplete", at: stampNow(), by, certName, on: todayIsoLocal() } };
}

function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The task cells as an admin last left them: the seeded model with every
 *  applied change laid over it. */
export function liveCells(data: CertData, state: CompletionsState = completionsStore.get()): CellMap {
  return Object.keys(state.cells).length ? { ...data.cells, ...state.cells } : data.cells;
}

/** Saves applied changes: the cells that differ from the seed, and the
 *  certification overrides. */
export function saveCompletions(data: CertData, cells: CellMap, certs: CertManual): void {
  const changed: CellMap = {};
  for (const [k, c] of Object.entries(cells)) if (c !== data.cells[k]) changed[k] = c;
  completionsStore.set({ cells: changed, certs });
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
