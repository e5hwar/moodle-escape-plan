import { tasks } from "./tasks";

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

/** The app-wide pass mark, the same 70% the attempt viewer and the paid-attempt
 *  records use (PASS_THRESHOLD in quizPurchases). */
export const ATTEMPT_PASS_MARK = 70;

/** Whether a finished, un-proctored attempt reads as Passed or Failed. The one
 *  place the grade → status rule lives; every builder goes through it. */
export function gradeStatus(grade: number): AttemptStatus {
  return grade >= ATTEMPT_PASS_MARK ? "Passed" : "Failed";
}

export type Attempt = {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** The Task (quiz / hands-on / xAPI) this attempt belongs to. */
  quizName: string;
  attemptNumber: number;
  status: AttemptStatus;
  /** ISO timestamp the attempt was started. */
  startedAt: string;
  /** ISO timestamp the attempt was completed, or null while In Progress. */
  completedAt: string | null;
  /** Whole-number percentage out of 100, or null while In Progress. */
  grade: number | null;
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

/* Tasks that surface a "View Attempts" entry. Attempts are generated against
   these so the default Quiz filter (the task clicked on the Tasks page) always
   resolves to a populated set. Keep in sync with ATTEMPTS_TYPES in TasksPage. */
const QUIZ_NAMES = [
  "EPA 608 Type I Final Exam",
  "Airflow Calibration Quiz",
  "Combustion Analysis",
  "Manifold Gauge Use",
  "Subcooling Calculation Quiz",
  "Field Visit – Brazing Joints",
  "HVAC Field Tools Walkthrough",
  "OSHA 10 Safety Course",
];

/* The two reviewed exams, one of each kind — kept OUT of QUIZ_NAMES so their
   attempts come only from `buildReviewedAttempts`, and every row on them
   carries a coherent review state. The exams match the Exam Reviews console's
   own lists: EPA 608 Universal is live-proctored, NATE Ready To Work is an ID
   check only. */
const PROCTORED_EXAM = "EPA 608 Universal Final Exam";
const ID_ONLY_EXAM = "NATE RTW Final Exam";

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

const FIRST = [
  "James", "Maria", "Robert", "Linda", "Michael", "Patricia", "David", "Jennifer",
  "Carlos", "Ashley", "Daniel", "Jessica", "Anthony", "Sarah", "Marcus", "Emily",
  "Kevin", "Nicole", "Brian", "Amanda", "Jose", "Megan", "Tyler", "Rachel",
  "Derek", "Brittany", "Andre", "Crystal", "Victor", "Tiffany",
];
const LAST = [
  "Anderson", "Martinez", "Johnson", "Nguyen", "Williams", "Garcia", "Brown",
  "Davis", "Rodriguez", "Wilson", "Thompson", "Lee", "Hernandez", "Clark",
  "Lewis", "Walker", "Hall", "Allen", "Young", "King", "Wright", "Scott",
  "Green", "Adams", "Baker", "Nelson", "Carter", "Mitchell", "Perez", "Roberts",
];

const AREA = ["415", "510", "408", "650", "213", "312", "713", "305", "602", "206"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/** Deterministic pseudo-random in [0,1) from an integer seed. */
function rng(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build an ISO-ish "Mon DD, YYYY · h:mm AM" label from day/minute offsets. */
function stamp(dayOffset: number, minutes: number): string {
  // Anchor on a fixed window in 2026 so the data is stable across renders.
  const base = new Date(Date.UTC(2026, 4, 1, 9, 0, 0)); // May 1, 2026 09:00
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

/** Track an attempt counter per (user, quiz) pair so Attempt Number is coherent. */
function buildAttempts(): Attempt[] {
  const out: Attempt[] = [];
  const attemptCounts = new Map<string, number>();

  // 64 rows of varied users / quizzes.
  for (let i = 0; i < 64; i++) {
    const first = pick(FIRST, i * 3 + 1);
    const last = pick(LAST, i * 5 + 2);
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@${
      ["gmail.com", "outlook.com", "yahoo.com", "fieldpro.io", "acmehvac.com"][i % 5]
    }`;
    const area = pick(AREA, i * 7);
    const phone = `(${area}) ${pad(200 + ((i * 37) % 700))}-${pad(1000 + ((i * 53) % 9000)).slice(-4)}`;

    // Spread evenly across every quiz (a modular step that's coprime with the
    // list length, nudged by a pseudo-random offset so it isn't a strict cycle).
    const quizIdx = (i * 4 + Math.floor(rng(i + 1) * 3)) % QUIZ_NAMES.length;
    const quizName = QUIZ_NAMES[quizIdx];

    const key = `${name}::${quizName}`;
    const attemptNumber = (attemptCounts.get(key) ?? 0) + 1;
    attemptCounts.set(key, attemptNumber);

    const inProgress = rng(i + 11) < 0.22;
    const dayOffset = Math.floor(rng(i + 3) * 50); // spread across ~7 weeks
    const startMinute = Math.floor(rng(i + 5) * 600);
    const startedAt = stamp(dayOffset, startMinute);

    if (inProgress) {
      out.push({
        id: `A-${5000 + i}`,
        name,
        email,
        phone,
        quizName,
        attemptNumber,
        status: "In Progress",
        startedAt,
        completedAt: null,
        grade: null,
      });
      continue;
    }

    const durMinutes = 8 + Math.floor(rng(i + 9) * 95); // 8–103 min
    const completedAt = stamp(dayOffset, startMinute + durMinutes);
    // Grades skew toward passing, with a tail of lower scores.
    const grade = Math.min(100, 38 + Math.floor(rng(i + 13) * 62));

    out.push({
      id: `A-${5000 + i}`,
      name,
      email,
      phone,
      quizName,
      attemptNumber,
      status: gradeStatus(grade),
      startedAt,
      completedAt,
      grade,
    });
  }
  return out;
}

/** Attempts for one reviewed exam. Every review state is represented, and each
 *  attempt is graded on submission; the status reflects where the review stands
 *  rather than the score alone. Called once per review kind — the two differ
 *  only in their rejection reasons and in how long the review takes. */
function buildReviewedAttempts(
  exam: string,
  review: AttemptReview,
  /** Offsets the id / name / phone seeds so each exam reads as its own roster. */
  base: number,
): Attempt[] {
  /* Status mix, in row order: two whose review signed off (the grade then
     decides Passed / Failed — `graded` below), two still awaiting review, two
     Rejected with a reason, one still running. */
  const plan: { status: AttemptStatus | "graded"; reasonIdx?: number }[] = [
    { status: "graded" },
    { status: "In Review" },
    { status: "Rejected", reasonIdx: 0 },
    { status: "In Review" },
    { status: "graded" },
    { status: "Rejected", reasonIdx: 1 },
    { status: "Rejected", reasonIdx: 2 },
    { status: "In Progress" },
  ];
  const reasons = review === "proctored" ? REJECTION_REASONS : ID_REJECTION_REASONS;
  /* Footage takes longer to sit through than a single ID photo, so the two
     kinds turn their reviews around at different speeds. */
  const reviewHours = review === "proctored" ? 30 : 6;

  const out: Attempt[] = [];
  const attemptCounts = new Map<string, number>();

  plan.forEach((p, i) => {
    const seed = i + base;
    const first = pick(FIRST, seed * 3 + 2);
    const last = pick(LAST, seed * 5 + 1);
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@${
      ["gmail.com", "outlook.com", "yahoo.com", "fieldpro.io", "acmehvac.com"][i % 5]
    }`;
    const area = pick(AREA, seed * 7);
    const phone = `(${area}) ${pad(200 + ((seed * 37) % 700))}-${pad(1000 + ((seed * 53) % 9000)).slice(-4)}`;

    const key = `${name}::${exam}`;
    const attemptNumber = (attemptCounts.get(key) ?? 0) + 1;
    attemptCounts.set(key, attemptNumber);

    const dayOffset = Math.floor(rng(seed + 3) * 50);
    const startMinute = Math.floor(rng(seed + 5) * 600);
    const startedAt = stamp(dayOffset, startMinute);

    const row = {
      id: `A-${5000 + base + i}`,
      name,
      email,
      phone,
      quizName: exam,
      attemptNumber,
      startedAt,
      review,
    };

    if (p.status === "In Progress") {
      out.push({ ...row, status: "In Progress", completedAt: null, grade: null });
      return;
    }

    const durMinutes = 42 + Math.floor(rng(seed + 9) * 70); // 42–111 min
    const endMinute = startMinute + durMinutes;
    const completedAt = stamp(dayOffset, endMinute);
    // Rejected/In Review attempts still passed the quiz — the hold is on the
    // review, not the score — so grades skew high.
    const grade = Math.min(100, 72 + Math.floor(rng(seed + 13) * 26));
    /* The review lands some hours after the attempt was submitted, spread so
       the column doesn't read as one fixed turnaround. */
    const reviewedAt = stamp(
      dayOffset,
      endMinute + 60 * (1 + Math.floor(rng(seed + 17) * reviewHours)),
    );

    if (p.status === "Rejected") {
      out.push({
        ...row,
        status: "Rejected",
        completedAt,
        grade,
        reviewedAt,
        rejectionReason: reasons[(p.reasonIdx ?? 0) % reasons.length],
      });
      return;
    }

    /* An In Review row is exactly the one that has NO decision yet, so it is
       the one case that leaves `reviewedAt` off. */
    if (p.status === "In Review") {
      out.push({ ...row, status: "In Review", completedAt, grade });
      return;
    }

    out.push({ ...row, status: gradeStatus(grade), completedAt, grade, reviewedAt });
  });

  return out;
}

export const attempts: Attempt[] = [
  ...buildAttempts(),
  ...buildReviewedAttempts(PROCTORED_EXAM, "proctored", 100),
  ...buildReviewedAttempts(ID_ONLY_EXAM, "id-only", 200),
];

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

/** Distinct quiz names present in the attempt set, for the Quiz filter. */
export const ATTEMPT_QUIZ_NAMES: string[] = [...new Set(attempts.map((a) => a.quizName))].sort();

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
const CERTS_BY_TASK = new Map<string, string[]>(tasks.map((t) => [t.name, t.usedIn]));

/** Certifications the attempt's Task is used in. Empty for a Task outside the
 *  library (nothing to filter on, so it never matches a Certification pill). */
export function attemptCertifications(quizName: string): string[] {
  return CERTS_BY_TASK.get(quizName) ?? [];
}

/** Distinct certifications reachable from the attempt set, for the pill. */
export const ATTEMPT_CERTIFICATION_NAMES: string[] = [
  ...new Set(attempts.flatMap((a) => attemptCertifications(a.quizName))),
].sort();
