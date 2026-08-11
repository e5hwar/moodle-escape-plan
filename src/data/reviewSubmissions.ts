import { users, type User } from "./users";
import { CREATED_BY_B2B } from "./filters";
import { tasks } from "./tasks";

export type SubmissionMedia =
  | { kind: "video"; seed: string; duration: string }
  | { kind: "image"; seed: string };

export type EvaluationCriterion = { id: string; label: string };

export type SubmissionStatus = "Rejected" | "Review Pending" | "Completed";

export type TaskSubmission = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  phone: string;
  userType: "B2C" | "B2B";
  companyName?: string;
  taskName: string;
  /** The Task's library id (e.g. "T-2299"), from the Tasks page dataset. */
  taskId: string;
  /** Certifications the Task is used in — a Task can sit in several. */
  certifications: string[];
  /** ISO date the submission was sent for review. */
  submittedOn: string;
  /** Who created the task — "SkillCat" or the company. */
  createdBy: string;

  /* ── detail-view fields ── */
  durationLabel: string; // e.g. "Hands-on Task · 2 Hours"
  status: SubmissionStatus;
  progress: number; // percent
  completion: string; // ISO date or "—"
  dueDate?: string; // ISO date — B2B only (company-assigned deadline)
  lastActivity: string; // human label, e.g. "2 days ago"
  versions: string[]; // newest first: ["V3","V2","V1"] (always rooted at V1)
  media: SubmissionMedia[];
  description: string;
  /** Not every learner records one — the console only shows the player when
   * this is true. */
  hasAudio: boolean;
  audioLabel: string; // voice-note label
  audioDuration: string; // e.g. "0:48"
  criteria: EvaluationCriterion[];
  /** "Fail if:" conditions the task author lists under the pass criteria
   * (reviewer's checklist, Figma 263:1045). */
  failCriteria: EvaluationCriterion[];
};

const TASK_NAMES = [
  "HVAC Install",
  "Refrigerant Charging Procedure",
  "Thermostat Wiring Lab",
  "Recovery Machine Setup",
  "Condenser Coil Cleaning",
  "Ductwork Sealing",
  "Brazing Copper Lines",
  "Electrical Panel Labeling",
  "Compressor Replacement",
  "Vacuum & Evacuation",
  "Leak Detection Test",
  "Furnace Ignition Check",
];

/* Every name above is a real Hands-On Task in the Tasks library, so a
   submission's Task ID and Certifications are read from that record rather than
   invented here — the review table shows the same values the Tasks page does. */
const taskRecordByName = new Map(tasks.map((t) => [t.name, t] as const));

const DESCRIPTIONS = [
  "I installed the HVAC split system by first confirming the work area was safe and isolating electrical power. I mounted the indoor air handler and outdoor condenser according to the specifications. I ran and connected the refrigerant line set, ensuring all flare fittings were tightened and properly insulated. I installed the condensate drain line with proper slope and connected the thermostat wiring. After completing all connections, I pressure tested the system for leaks, evacuated the lines using a vacuum pump, and charged the system with refrigerant to manufacturer specifications. Finally, I restored power, tested system operation in cooling mode, verified proper airflow and temperature drop, and confirmed there were no leaks or abnormal noises.",
  "Before charging, I recovered the existing refrigerant into a certified recovery cylinder and weighed it to confirm full evacuation. I connected my manifold gauges, pulled a deep vacuum to 500 microns, and held it to confirm there were no leaks. I then weighed in the correct charge per the nameplate, monitoring subcooling and superheat as I added refrigerant. I documented the final readings and verified the system reached the target temperature split.",
  "I terminated the thermostat wiring following the manufacturer's diagram, matching each conductor to the correct terminal (R, C, Y, G, W). I confirmed 24V at the transformer, checked continuity on each run, and labeled both ends of the cable. After powering up, I verified each call — cooling, heating, and fan — energized the correct relay with no cross-wiring.",
  "I set up the recovery machine with the correct hoses and a recovery cylinder rated for the refrigerant type. I verified the cylinder was not overfilled by weight, opened the appropriate valves in sequence, and started recovery while monitoring pressures. I purged the hoses at the end and recorded the recovered weight.",
];

const CRITERIA: EvaluationCriterion[] = [
  { id: "c1", label: "Evidence quality and relevance" },
  { id: "c2", label: "Safety and compliance with procedure" },
  { id: "c3", label: "Execution accuracy and completeness" },
  { id: "c4", label: "Professional communication in notes" },
];

const FAIL_CRITERIA: EvaluationCriterion[] = [
  { id: "f1", label: "Media does not clearly show the work being described" },
  { id: "f2", label: "Unsafe practice shown or described (live circuits, removed guards)" },
  { id: "f3", label: "Required steps skipped or performed out of sequence" },
  { id: "f4", label: "Notes contradict the submitted evidence" },
];

function uhash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fixed "today" the demo dataset is generated against — exported so views can
 * compute waiting-time labels consistent with the seeded dates. */
export const REVIEW_TODAY = new Date("2026-06-18");
const TODAY = REVIEW_TODAY;
function isoDaysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoDaysAhead(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function activityLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}

/** Build review submissions from a subset of real users. */
function buildSubmissions(): TaskSubmission[] {
  const pool: User[] = users.slice(0, 18);
  return pool.map((u, i) => {
    const k = uhash(u.id + i);
    const taskName = TASK_NAMES[k % TASK_NAMES.length];
    const taskRecord = taskRecordByName.get(taskName);
    const submittedDaysAgo = (k % 21) + 1;
    const mediaCount = 2 + (k % 3); // 2–4 media items
    const media: SubmissionMedia[] = Array.from({ length: mediaCount }, (_, m) =>
      m === 0
        ? {
            kind: "video" as const,
            seed: `${u.id}-${m}`,
            duration: `0:${String(4 + (k % 50)).padStart(2, "0")}`,
          }
        : { kind: "image" as const, seed: `${u.id}-${m}` },
    );
    // Newest-first version list, always anchored at V1. A user with 3 attempts
    // gets ["V3","V2","V1"] — never "V5" with no V1 underneath it.
    const versionCount = 1 + (k % 5);
    const versions = Array.from({ length: versionCount }, (_, vi) => `V${versionCount - vi}`);
    const status: SubmissionStatus =
      k % 9 === 0 ? "Rejected" : k % 11 === 0 ? "Completed" : "Review Pending";
    return {
      id: `RS-${2400 - i * 7}`,
      userId: u.id,
      userName: u.name,
      email: u.email,
      phone: u.phone,
      userType: u.userType,
      companyName: u.companyName,
      taskName,
      taskId: taskRecord?.id ?? "—",
      certifications: taskRecord?.usedIn ?? [],
      submittedOn: isoDaysAgo(submittedDaysAgo),
      // Who created the Task — SkillCat for B2C content, or a B2B customer for
      // company-owned Tasks. Uses the same shorthand creator list as the
      // Tasks/Certifications pages so the "Created By" filter options match.
      createdBy:
        u.userType === "B2B"
          ? CREATED_BY_B2B[k % CREATED_BY_B2B.length]
          : "SkillCat",
      durationLabel: "Hands-on Task · 2 Hours",
      status,
      progress: 100,
      completion: isoDaysAgo(submittedDaysAgo),
      // Only B2B (company) learners have a company-assigned deadline.
      dueDate: u.userType === "B2B" ? isoDaysAhead(15 + (k % 30)) : undefined,
      lastActivity: activityLabel(submittedDaysAgo),
      versions,
      media,
      description: DESCRIPTIONS[k % DESCRIPTIONS.length],
      // Two in three submissions come with a voice note.
      hasAudio: k % 3 !== 0,
      audioLabel: "Voice note",
      audioDuration: `0:${String(20 + (k % 40)).padStart(2, "0")}`,
      criteria: CRITERIA,
      failCriteria: FAIL_CRITERIA,
    };
  });
}

export const reviewSubmissions: TaskSubmission[] = buildSubmissions();

/** A company-created Task is graded by that company, so SkillCat reviewers can
 * only look at it — the review console opens it read-only. */
export function isReadOnly(s: TaskSubmission): boolean {
  return s.createdBy !== "SkillCat";
}

/** What the submissions table shows in Status: read-only submissions aren't
 * waiting on anyone here, whatever their underlying review state. */
export const NO_ACTION_STATUS = "No Action Required";
export function displayStatus(s: TaskSubmission): string {
  return isReadOnly(s) ? NO_ACTION_STATUS : s.status;
}

/** Free-text search over a submission — the fields the review search bar's
 * placeholder promises: user's name, email, phone, task and parent
 * certification. `q` must already be lower-cased and trimmed. */
export function matchesQuery(s: TaskSubmission, q: string): boolean {
  return (
    s.userName.toLowerCase().includes(q) ||
    s.email.toLowerCase().includes(q) ||
    s.phone.toLowerCase().includes(q) ||
    s.taskName.toLowerCase().includes(q) ||
    s.certifications.some((c) => c.toLowerCase().includes(q))
  );
}

/** picsum.photos URL for a media seed (deterministic image per seed). */
export function mediaUrl(seed: string, w = 800, h = 600): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

/* ── Previous-version views ───────────────────────────────────────────────
   The latest submission lives at version index 0. Older versions (V4, V3…)
   are derived deterministically from the same seed so the demo can navigate
   between attempts of the same task by the same user. ── */

function isoOffset(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Derived submission for an older attempt (idx 0 returns the latest as-is). */
export function pastVersionOf(s: TaskSubmission, idx: number): TaskSubmission {
  if (idx <= 0) return s;
  const offsetDays = idx * 18;
  const submitted = isoOffset(s.submittedOn, -offsetDays);
  const h = uhash(s.id + ":v" + idx);
  return {
    ...s,
    submittedOn: submitted,
    completion: submitted,
    lastActivity: activityLabel(offsetDays + 1),
    status: "Rejected", // an older attempt is older precisely because it was rejected
    media: s.media.map((m) => ({ ...m, seed: `${m.seed}-v${idx}` })),
    description: DESCRIPTIONS[h % DESCRIPTIONS.length],
    audioLabel: "Voice note · resubmission requested",
  };
}

export type PastReview = {
  score: number;
  feedback: string;
  reviewer: string;
  reviewedOn: string;
  passedCriteria: string[];
};

const PAST_FEEDBACK = [
  "Missing pressure test and lockout/tagout steps. Please resubmit with the full safety procedure visible.",
  "Refrigerant manifold readings aren't shown — record the gauge readings and charge weight on the next attempt.",
  "Voice note skips torque specs and the wiring sequence verification — include those next time.",
  "Lighting on the brazed joints makes verification impossible. Use better lighting on resubmission.",
];

const PAST_REVIEWERS = ["Aarti Sharma", "Marcus Lee", "Jenna Park", "Devon Reyes"];

/** Read-only past review for an older attempt. */
export function pastReviewOf(s: TaskSubmission, idx: number): PastReview {
  const h = uhash(s.id + ":r" + idx);
  const submitted = isoOffset(s.submittedOn, -idx * 18);
  return {
    score: 1 + (h % 4), // older attempts sit in the 1–4 "rejected" band
    feedback: PAST_FEEDBACK[h % PAST_FEEDBACK.length],
    reviewer: PAST_REVIEWERS[h % PAST_REVIEWERS.length],
    reviewedOn: isoOffset(submitted, 2),
    passedCriteria: s.criteria.filter((_, ci) => ((h + ci) % 3) > 0).map((c) => c.id),
  };
}
