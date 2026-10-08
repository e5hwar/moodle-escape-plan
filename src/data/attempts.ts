import { useSyncExternalStore } from "react";
import {
  tasks as seedTasks,
  isPaid,
  quizAttemptPasses,
  quizGradingOf,
  taskById,
  taskCertifications,
  type Task,
} from "./tasks";
import { users } from "./users";

// A finished attempt is Passed or Failed — the grade decides, so the status
// never has to be stored independently of the score (see `gradeStatus`).
// "In Review" and "Rejected" only occur on a REVIEWED Quiz (see `AttemptReview`):
// a passing attempt enters In Review until the Exam Reviews team signs off, and
// is Rejected (with a reason) if that review fails.
export type AttemptStatus =
  | "In Progress"
  | "Passed"
  | "Failed"
  | "In Review"
  | "Rejected";

/** How a Quiz's attempts are checked before they count — the same two kinds
 *  the Exam Reviews console handles (PROCTORED_EXAMS / ID_ONLY_EXAMS in
 *  data/proctoring.ts):
 *  - "proctored" — live webcam footage plus the ID document.
 *  - "id-only"   — the ID document alone; no footage is captured.
 *  Absent on an ordinary Quiz, whose attempts nobody reviews. */
export type AttemptReview = "proctored" | "id-only";

/** The pass mark for an attempt whose Quiz isn't in the library (a deep-link
 *  row built from Manage User Progress data). Library Quizzes use their own
 *  mark and grading model — see `quizAttemptPasses`. */
export const ATTEMPT_PASS_MARK = 70;

/** Whether a finished, un-reviewed attempt reads as Passed or Failed, by the
 *  Quiz's own pass mark and grading model when the Quiz is known. The one
 *  place the grade → status rule lives; every builder goes through it. */
export function gradeStatus(
  grade: number,
  quiz?: Pick<Task, "quizGrading" | "quizSections">,
  sectionGrades?: number[],
): AttemptStatus {
  const passed = quiz ? quizAttemptPasses(quiz, grade, sectionGrades) : grade >= ATTEMPT_PASS_MARK;
  return passed ? "Passed" : "Failed";
}

export type Attempt = {
  id: string;
  /** The Task this attempt belongs to — what the page filters on, so a
   *  renamed Quiz keeps its attempts. */
  taskId: string;
  /** The learner, when they are an app user (Who Paid joins on it). */
  userId?: string;
  name: string;
  email: string;
  phone: string;
  /** The Task's name when the attempt was made — shown only when the Task is
   *  no longer in the library; otherwise the live name is (see `attemptQuizName`). */
  quizName: string;
  attemptNumber: number;
  status: AttemptStatus;
  /** ISO timestamp the attempt was started. */
  startedAt: string;
  /** ISO timestamp the attempt was completed, or null while In Progress. */
  completedAt: string | null;
  /** Whole-number percentage out of 100, or null while In Progress. */
  grade: number | null;
  /** A sectioned Quiz's per-Section grades, in Section order — what decides
   *  pass/fail under section-level grading. */
  sectionGrades?: number[];
  /** Set when this attempt's Quiz is reviewed — the only place the In Review /
   *  Rejected statuses, and a Reviewed On date, can appear. */
  review?: AttemptReview;
  /** When the review was decided. Set only once it HAS been — a Passed or
   *  Rejected attempt on a reviewed Quiz — so an In Review row reads empty
   *  rather than claiming a date it hasn't earned. */
  reviewedAt?: string;
  /** Why the review rejected the attempt. Set only when the status is
   *  "Rejected". */
  rejectionReason?: string;
};

/* The two reviewed exams, one of each kind — the Exam Reviews console's own
   lists: EPA 608 Universal is live-proctored, NATE Ready To Work an ID check
   only. Their attempts carry a coherent review state. */
const REVIEWED: Record<string, AttemptReview> = {
  "T-1198": "proctored", // EPA 608 Universal Final Exam
  "T-1289": "id-only", // NATE RTW Final Exam
};

/** Reasons the Proctoring Team gives when rejecting an attempt's footage. */
const REJECTION_REASONS = [
  "A second person was visible in frame during the session.",
  "The candidate left the camera view for an extended period.",
  "Unauthorized reference material was visible on the desk.",
  "Tab-switching away from the exam window was detected mid-attempt.",
  "The webcam was covered before the attempt was submitted.",
  "ID verification photo did not match the candidate on camera.",
];

/** …and the reasons an ID-only review gives, where the document IS the review
 *  and there is no footage to fault. */
const ID_REJECTION_REASONS = [
  "The name on the ID did not match the name on the account.",
  "The ID document had expired at the time of the attempt.",
  "The uploaded ID was too blurred to read.",
];

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function rng(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build a "Mon DD, YYYY · h:mm AM" label from day/minute offsets. */
function stamp(dayOffset: number, minutes: number): string {
  // Anchor on a fixed window in 2026 so the data is stable across renders.
  const base = new Date(Date.UTC(2026, 3, 1, 9, 0, 0)); // Apr 1, 2026 09:00
  const d = new Date(base.getTime() + dayOffset * 86_400_000 + minutes * 60_000);
  const month = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${month} ${day}, ${year} · ${h}:${pad(m)} ${ampm}`;
}

function durationLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${pad(m)}m`;
}

/** A grade (and per-Section grades, on a sectioned Quiz) that lands on the
 *  wanted side of the Quiz's own rule. */
function gradesFor(
  t: Task,
  pass: boolean,
  seed: number,
): { grade: number; sectionGrades?: number[] } {
  const g = quizGradingOf(t);
  const secs = t.quizSections ?? [];
  if (!secs.length) {
    const mark = g.passPct;
    const grade = pass
      ? Math.min(100, mark + Math.floor(rng(seed) * (101 - mark)))
      : Math.max(20, mark - 1 - Math.floor(rng(seed) * 30));
    return { grade };
  }
  /* Sectioned: each Section near its own mark. A failing attempt misses the
     mark that decides it — a Must Pass Section under section-level grading,
     else the overall one — so the rule really is what fails it. */
  const sectionGrades = secs.map((s, i) => {
    const r = rng(seed + i * 17);
    return pass
      ? Math.min(100, s.passingPct + Math.floor(r * (101 - s.passingPct)))
      : Math.max(20, s.passingPct - 12 + Math.floor(r * 30));
  });
  if (!pass) {
    if (g.model === "section_level") {
      const i = Math.max(0, secs.findIndex((s) => s.requiredToPass));
      sectionGrades[i] = Math.max(20, secs[i].passingPct - 8 - Math.floor(rng(seed + 99) * 20));
    } else {
      const cut = g.passPct - 5;
      for (let i = 0; i < sectionGrades.length; i++) sectionGrades[i] = Math.min(sectionGrades[i], cut);
    }
  }
  const grade = Math.round(sectionGrades.reduce((a, b) => a + b, 0) / sectionGrades.length);
  return { grade, sectionGrades };
}

/** Every library Quiz's attempts, taken by real app users, each learner's in
 *  time order and numbered in that order. A learner keeps trying until they
 *  pass (or run out): earlier attempts fail, and the last one may still be
 *  running. The reviewed exams add their review states on top. */
function buildSeed(): Attempt[] {
  const out: Attempt[] = [];
  seedTasks
    .filter((t) => t.type === "Quiz")
    .forEach((t, qi) => {
      const review = REVIEWED[t.id];
      const learners = 6 + Math.floor(rng(qi * 7 + 1) * 5); // 6–10
      const first = Math.floor(rng(qi * 13 + 2) * users.length);
      const limit = t.maxAttempts ?? 3;
      for (let k = 0; k < learners; k++) {
        const u = users[(first + k * 7) % users.length];
        const seed = qi * 1000 + k * 10;
        const count = 1 + Math.floor(rng(seed + 3) * Math.min(3, limit));
        let day = Math.floor(rng(seed + 5) * 120);
        for (let n = 1; n <= count; n++) {
          const last = n === count;
          const startMinute = Math.floor(rng(seed + n * 31) * 600);
          const startedAt = stamp(day, startMinute);
          const row = {
            id: `A-${t.id}-${u.id}-${n}`,
            taskId: t.id,
            userId: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            quizName: t.name,
            attemptNumber: n,
            startedAt,
            ...(review ? { review } : {}),
          };
          const running = last && rng(seed + 11) < 0.2;
          if (running) {
            out.push({ ...row, status: "In Progress", completedAt: null, grade: null });
            break;
          }
          const pass = last && rng(seed + 13) < 0.65;
          const { grade, sectionGrades } = gradesFor(t, pass, seed + n);
          const dur = (review ? 42 : 8) + Math.floor(rng(seed + n * 9) * 70);
          const completedAt = stamp(day, startMinute + dur);
          const status = gradeStatus(grade, t, sectionGrades);
          const base: Attempt = { ...row, status, completedAt, grade, ...(sectionGrades ? { sectionGrades } : {}) };
          if (review && status === "Passed") {
            /* A passing attempt on a reviewed exam waits on the review, which
               can still reject it — the hold is on the review, not the score. */
            const r = rng(seed + 17);
            const reviewedAt = stamp(day, startMinute + dur + 60 * (1 + Math.floor(r * (review === "proctored" ? 30 : 6))));
            if (r < 0.3) out.push({ ...base, status: "In Review" });
            else if (r < 0.55) {
              const reasons = review === "proctored" ? REJECTION_REASONS : ID_REJECTION_REASONS;
              out.push({ ...base, status: "Rejected", reviewedAt, rejectionReason: reasons[k % reasons.length] });
            } else out.push({ ...base, reviewedAt });
          } else {
            out.push(base);
          }
          day += 1 + Math.floor(rng(seed + n * 5) * 6);
        }
      }
    });
  return out;
}

/** The seed set, as the app opened. */
export const attempts: Attempt[] = buildSeed();

/* ── The working attempts store ──
   Deleting an attempt, and granting extra ones, outlast the page that did it:
   Quiz Attempts and Who Paid both read this one store, so the two always
   describe the same data. */
export type AttemptGrant = {
  id: string;
  taskId: string;
  userId: string;
  count: number;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  by: string;
};

type Store = {
  attempts: Attempt[];
  /** Paid attempts that were deleted — the purchase is given back unused. */
  deletedPaid: Attempt[];
  grants: AttemptGrant[];
  /** Purchases revoked on Who Paid, by purchase id → ISO date. */
  revoked: Record<string, string>;
};

let store: Store = { attempts, deletedPaid: [], grants: [], revoked: {} };
const listeners = new Set<() => void>();
function setStore(next: Store) {
  store = next;
  listeners.forEach((l) => l());
}

export function getAttemptStore(): Store {
  return store;
}

export function useAttemptStore(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getAttemptStore,
  );
}

/** The Quiz name to show for an attempt — the live Task's, so a rename
 *  carries through. */
export function attemptQuizName(a: Pick<Attempt, "taskId" | "quizName">): string {
  return taskById(a.taskId)?.name ?? a.quizName;
}

/** Delete an attempt: the learner's later attempts on the Quiz move up a
 *  number, and — on a paid Quiz — the attempt they paid for comes back unused. */
export function deleteAttempt(a: Attempt) {
  const task = taskById(a.taskId);
  const rest = store.attempts
    .filter((x) => x.id !== a.id)
    .map((x) =>
      x.taskId === a.taskId &&
      x.name === a.name &&
      x.userId === a.userId &&
      x.attemptNumber > a.attemptNumber
        ? { ...x, attemptNumber: x.attemptNumber - 1 }
        : x,
    );
  setStore({
    ...store,
    attempts: rest,
    deletedPaid: task && isPaid(task) && a.userId ? [...store.deletedPaid, a] : store.deletedPaid,
  });
}

/** Give each user `count` extra attempts on one Quiz — the Grant Additional
 *  Attempts flow on Quiz Attempts and Who Paid alike. */
export function grantAttempts(taskId: string, userIds: string[], count: number, date: string, by: string) {
  const stampId = Date.now();
  setStore({
    ...store,
    grants: [
      ...userIds.map((userId, i) => ({ id: `G-${stampId}-${i}`, taskId, userId, count, date, by })),
      ...store.grants,
    ],
  });
}

/** Revoke an unused purchased (or granted) attempt on Who Paid. */
export function revokePurchase(purchaseId: string, date: string) {
  setStore({ ...store, revoked: { ...store.revoked, [purchaseId]: date } });
}

/** Attempts a user has taken on one Quiz — the grant picker's Attempts column. */
export function attemptsTaken(s: Store, taskId: string, userId: string): number {
  return s.attempts.filter((a) => a.taskId === taskId && a.userId === userId).length;
}

/** Minutes elapsed for an attempt, derived from its start/complete stamps.
 *  Stored alongside so the table can show Duration without re-parsing labels. */
export function attemptDuration(a: Attempt): string {
  if (a.status === "In Progress" || !a.completedAt) return "";
  const parse = (s: string) => {
    // "May 3, 2026 · 9:42 AM"
    const [datePart, timePart] = s.split(" · ");
    return new Date(`${datePart} ${timePart}`).getTime();
  };
  const ms = parse(a.completedAt) - parse(a.startedAt);
  if (Number.isNaN(ms) || ms < 0) return "";
  return durationLabel(Math.round(ms / 60000));
}

/** The Reviewed On date to show for an attempt, if any. The rule in one place:
 *  only a REVIEWED Quiz has a review at all, and only a decided attempt — one
 *  that Passed or was Rejected — has a date to show for it. An In Review row is
 *  still waiting, a Failed one never reached the review, and an ordinary Quiz
 *  has none. */
export function attemptReviewedOn(a: Attempt): string | null {
  if (!a.review) return null;
  if (a.status !== "Passed" && a.status !== "Rejected") return null;
  return a.reviewedAt ?? null;
}

/** Filter options for the Status pill — the full union, in lifecycle order
 *  rather than alphabetical, so the list reads as a progression. */
export const ATTEMPT_STATUSES: AttemptStatus[] = [
  "In Progress",
  "Passed",
  "Failed",
  "In Review",
  "Rejected",
];

/* ── Certifications ──
   An attempt carries only its Task's name, so the Certification filter resolves
   through the Tasks library's `usedIn` — the same source the Hands-On review
   queue uses for its Certifications column. */
/** Certifications the attempt's Task is used in, by canonical name. Empty
 *  for a Task outside the library (nothing to filter on, so it never matches
 *  a Certification pill). */
export function attemptCertifications(taskId: string): string[] {
  const t = taskById(taskId);
  return t ? taskCertifications(t).map((c) => c.name) : [];
}
