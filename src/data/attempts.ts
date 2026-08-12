// "In Review" and "Rejected" only occur on proctored exams: a passing attempt
// enters In Review until the Proctoring Team approves the footage, and is
// Rejected (with a reason) if the footage fails review.
export type AttemptStatus =
  | "In Progress"
  | "Completed"
  | "In Review"
  | "Rejected";

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
  /** True when this attempt belongs to a proctored exam — the only place the
   *  In Review / Rejected statuses can appear. */
  proctored?: boolean;
  /** Why the proctoring review rejected the attempt. Set only when the status
   *  is "Rejected". */
  rejectionReason?: string;
};

/* Tasks that surface a "View Attempts" entry. Attempts are generated against
   these so the default Quiz filter (the task clicked on the Tasks page) always
   resolves to a populated set. Keep in sync with ATTEMPTS_TYPES in TasksPage. */
const QUIZ_NAMES = [
  "EPA 608 Type I Final Exam",
  "NATE RTW Final Exam",
  "Airflow Calibration Quiz",
  "Combustion Analysis",
  "Manifold Gauge Use",
  "Subcooling Calculation Quiz",
  "Field Visit – Brazing Joints",
  "HVAC Field Tools Walkthrough",
  "OSHA 10 Safety Course",
];

/** A proctored certification exam. Its attempts carry the extra In Review /
 *  Rejected statuses that only proctored exams can reach. */
const PROCTORED_EXAM = "EPA 608 Universal Final Exam";

/** Reasons the Proctoring Team gives when rejecting an attempt's footage. */
const REJECTION_REASONS = [
  "A second person was visible in frame during the session.",
  "The candidate left the camera view for an extended period.",
  "Unauthorized reference material was visible on the desk.",
  "Tab-switching away from the exam window was detected mid-attempt.",
  "The webcam was covered before the attempt was submitted.",
  "ID verification photo did not match the candidate on camera.",
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
      status: "Completed",
      startedAt,
      completedAt,
      grade,
    });
  }
  return out;
}

/** Attempts for the proctored EPA 608 Universal Final Exam. Every proctoring
 *  status is represented, and each attempt is graded on submission; the status
 *  reflects where the footage review stands rather than the score alone. */
function buildProctoredAttempts(): Attempt[] {
  // Status mix, in row order: two approved (Completed), two awaiting the
  // Proctoring Team (In Review), two Rejected with a reason, one still running.
  const plan: { status: AttemptStatus; reasonIdx?: number }[] = [
    { status: "Completed" },
    { status: "In Review" },
    { status: "Rejected", reasonIdx: 0 },
    { status: "In Review" },
    { status: "Completed" },
    { status: "Rejected", reasonIdx: 3 },
    { status: "Rejected", reasonIdx: 5 },
    { status: "In Progress" },
  ];

  const out: Attempt[] = [];
  const attemptCounts = new Map<string, number>();

  plan.forEach((p, i) => {
    // Offset the name/phone seeds away from buildAttempts() so the roster reads
    // as different people.
    const seed = i + 100;
    const first = pick(FIRST, seed * 3 + 2);
    const last = pick(LAST, seed * 5 + 1);
    const name = `${first} ${last}`;
    const email = `${first.toLowerCase()}.${last.toLowerCase()}@${
      ["gmail.com", "outlook.com", "yahoo.com", "fieldpro.io", "acmehvac.com"][i % 5]
    }`;
    const area = pick(AREA, seed * 7);
    const phone = `(${area}) ${pad(200 + ((seed * 37) % 700))}-${pad(1000 + ((seed * 53) % 9000)).slice(-4)}`;

    const key = `${name}::${PROCTORED_EXAM}`;
    const attemptNumber = (attemptCounts.get(key) ?? 0) + 1;
    attemptCounts.set(key, attemptNumber);

    const dayOffset = Math.floor(rng(seed + 3) * 50);
    const startMinute = Math.floor(rng(seed + 5) * 600);
    const startedAt = stamp(dayOffset, startMinute);

    const base = {
      id: `A-${5100 + i}`,
      name,
      email,
      phone,
      quizName: PROCTORED_EXAM,
      attemptNumber,
      startedAt,
      proctored: true,
    };

    if (p.status === "In Progress") {
      out.push({ ...base, status: "In Progress", completedAt: null, grade: null });
      return;
    }

    const durMinutes = 42 + Math.floor(rng(seed + 9) * 70); // 42–111 min
    const completedAt = stamp(dayOffset, startMinute + durMinutes);
    // Rejected/In Review attempts still passed the quiz — the hold is on the
    // footage, not the score — so grades skew high.
    const grade = Math.min(100, 72 + Math.floor(rng(seed + 13) * 26));

    if (p.status === "Rejected") {
      out.push({
        ...base,
        status: "Rejected",
        completedAt,
        grade,
        rejectionReason: REJECTION_REASONS[p.reasonIdx ?? 0],
      });
      return;
    }

    out.push({ ...base, status: p.status, completedAt, grade });
  });

  return out;
}

export const attempts: Attempt[] = [...buildAttempts(), ...buildProctoredAttempts()];

/** Minutes elapsed for an attempt, derived from its start/complete stamps.
 *  Stored alongside so the table can show Duration without re-parsing labels. */
export function attemptDuration(a: Attempt): string {
  if (a.status === "In Progress" || !a.completedAt) return "—";
  const parse = (s: string) => {
    // "May 3, 2026 · 9:42 AM"
    const [datePart, timePart] = s.split(" · ");
    return new Date(`${datePart} ${timePart}`).getTime();
  };
  const ms = parse(a.completedAt) - parse(a.startedAt);
  if (Number.isNaN(ms) || ms < 0) return "—";
  return durationLabel(Math.round(ms / 60000));
}

/** Distinct quiz names present in the attempt set, for the Quiz filter. */
export const ATTEMPT_QUIZ_NAMES: string[] = [...new Set(attempts.map((a) => a.quizName))].sort();

/** Filter options for the Status pill — the full union, in lifecycle order
 *  rather than alphabetical, so the list reads as a progression. */
export const ATTEMPT_STATUSES: AttemptStatus[] = [
  "In Progress",
  "Completed",
  "In Review",
  "Rejected",
];
