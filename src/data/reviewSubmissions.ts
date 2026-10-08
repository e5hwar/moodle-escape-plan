import { useSyncExternalStore } from "react";
import { users } from "./users";
import { getTasks, handsOnPassScore, useLiveTasks, type Task } from "./tasks";

export type SubmissionMedia =
  | { kind: "video"; seed: string; duration: string }
  | { kind: "image"; seed: string };

export type SubmissionStatus = "Rejected" | "Review Pending" | "Completed";

/** The verdict on an attempt: its score out of 10 and the reviewer's feedback.
 *  Passed or Rejected is never stored — it is read against the Task's Passing
 *  Grade ({@link passScoreOf}), so it can't disagree with the Task. */
export type SubmissionReview = {
  score: number;
  feedback: string;
  reviewer: string;
  reviewedOn: string;
};

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
  /** The Task's Reviewer's Checklist — the wizard's one rich-text field,
   *  shown to the grader as written. */
  checklist: string;
  /** The current attempt's verdict — set once it is Completed or Rejected
   *  (seeded, or submitted this session via {@link submitReview}). */
  review?: SubmissionReview;
};

/* The Hands-On Tasks the review queue draws submissions from, split by owner.
   SkillCat's own library is open to every learner; company-created Tasks are
   B2B content, so only a company's learners ever submit against them. */
const SKILLCAT_TASK_NAMES = [
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
  "Field Visit – Brazing Joints",
  "Automotive A/C Recovery",
  "PVC Pipe Joining Lab",
  "Sweat Soldering Lab",
  "Tankless Heater Lab",
  "Hose Bibb Replacement",
];

const COMPANY_TASK_NAMES = [
  "Coil Cleaning Procedure",
  "Gas Furnace Safety Check",
  "Vacuum Pump Operation",
  "Superheat Reading Lab",
  "Electrical Panel Lab",
  "Igniter Replacement Module",
  "Gas Line Pressure Test",
  "MultiFamily Service Visit",
  "Backflow Preventer Setup",
  "Sump Pump Install",
];

const B2B_TASK_NAMES = [...SKILLCAT_TASK_NAMES, ...COMPANY_TASK_NAMES];

/* Every name above is a real Hands-On Task in the Tasks library, so a
   submission's Task ID, Certifications and creator are read from that record
   rather than invented here — the review table shows the same values the Tasks
   page does. Read off the LIVE list (seed + this session's edits), so what the
   Task wizard saves — Passing Grade, checklist, Completion Criteria — reaches
   the review page and console. */
const taskRecordByName = (name: string) => getTasks().find((t) => t.name === name);
function taskRecordById(id: string, tasks: Task[] = getTasks()): Task | undefined {
  return id ? tasks.find((t) => t.id === id) : undefined;
}
/** The submission's Task: by id, so a renamed Task still resolves; by name for
 *  a row whose Task had no id. */
function taskOf(s: Pick<TaskSubmission, "taskId" | "taskName">): Task | undefined {
  return taskRecordById(s.taskId) ?? taskRecordByName(s.taskName);
}

const DESCRIPTIONS = [
  "I installed the HVAC split system by first confirming the work area was safe and isolating electrical power. I mounted the indoor air handler and outdoor condenser according to the specifications. I ran and connected the refrigerant line set, ensuring all flare fittings were tightened and properly insulated. I installed the condensate drain line with proper slope and connected the thermostat wiring. After completing all connections, I pressure tested the system for leaks, evacuated the lines using a vacuum pump, and charged the system with refrigerant to manufacturer specifications. Finally, I restored power, tested system operation in cooling mode, verified proper airflow and temperature drop, and confirmed there were no leaks or abnormal noises.",
  "Before charging, I recovered the existing refrigerant into a certified recovery cylinder and weighed it to confirm full evacuation. I connected my manifold gauges, pulled a deep vacuum to 500 microns, and held it to confirm there were no leaks. I then weighed in the correct charge per the nameplate, monitoring subcooling and superheat as I added refrigerant. I documented the final readings and verified the system reached the target temperature split.",
  "I terminated the thermostat wiring following the manufacturer's diagram, matching each conductor to the correct terminal (R, C, Y, G, W). I confirmed 24V at the transformer, checked continuity on each run, and labeled both ends of the cable. After powering up, I verified each call — cooling, heating, and fan — energized the correct relay with no cross-wiring.",
  "I set up the recovery machine with the correct hoses and a recovery cylinder rated for the refrigerant type. I verified the cylinder was not overfilled by weight, opened the appropriate valves in sequence, and started recovery while monitoring pressures. I purged the hoses at the end and recorded the recovered weight.",
];

/* The task author's Reviewer's Checklist (Figma 1172:2196) — written for the
   HVAC system-identification task the frame shows, and used for every seeded
   submission. One rich-text field in the wizard, so one string here. */
const CHECKLIST = [
  "• Clearly shows real equipment in its installed location",
  "• Student selects one system type (Split AC/Heat Pump/Package Unit)",
  "• Explanation references specific visible evidence (labeling, form factor, installation style, line configuration)",
  "• No panel removal described or implied",
  "• Explanation is logical and consistent with the photo",
].join("\n");

function uhash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Today on the real clock (local midnight) — the seeded queue is dated
 *  back from it and submitted reviews are stamped with it, so waiting times
 *  and Reviewed On dates read true on any day. */
export const REVIEW_TODAY = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
})();
const TODAY = REVIEW_TODAY;
/** A local date as "YYYY-MM-DD" — never toISOString, which is UTC and can
 *  slip a day either side of midnight. */
function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function isoDaysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return isoLocal(d);
}
function isoDaysAhead(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

function activityLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}

/* Reviewers' feedback and names, hash-picked for seeded verdicts. */
const PAST_FEEDBACK = [
  "Missing pressure test and lockout/tagout steps. Please resubmit with the full safety procedure visible.",
  "Refrigerant manifold readings aren't shown — record the gauge readings and charge weight on the next attempt.",
  "Voice note skips torque specs and the wiring sequence verification — include those next time.",
  "Lighting on the brazed joints makes verification impossible. Use better lighting on resubmission.",
];

const PASSED_FEEDBACK = [
  "Clean, complete work — every step is visible and the readings check out.",
  "Good documentation of the safety steps. Tighten up the photo framing next time.",
  "Meets the standard. The voice note walks through the procedure clearly.",
];

const PAST_REVIEWERS = ["Aarti Sharma", "Marcus Lee", "Jenna Park", "Devon Reyes"];

/** A Hands-On Task whose Completion Criteria is "Submission Made": it
 *  completes the moment the learner submits, so nobody reviews or scores it. */
function completesOnSubmissionTask(task: Task | undefined): boolean {
  return task?.type === "Hands-On Task" && task.handsOn?.graded === false;
}

/** The verdict a seeded Completed / Rejected submission already carries —
 *  scored on the right side of its Task's Passing Grade. Pending ones have
 *  none yet. */
function seededReview(
  status: SubmissionStatus,
  k: number,
  task: Task | undefined,
  submittedOn: string,
): SubmissionReview | undefined {
  if (status === "Review Pending" || completesOnSubmissionTask(task)) return undefined;
  const pass = handsOnPassScore(task);
  const h = uhash(`${k}:review`);
  const passed = status === "Completed";
  return {
    score: passed ? pass + (h % (11 - pass)) : 1 + (h % Math.max(1, pass - 1)),
    feedback: passed
      ? PASSED_FEEDBACK[h % PASSED_FEEDBACK.length]
      : PAST_FEEDBACK[h % PAST_FEEDBACK.length],
    reviewer: PAST_REVIEWERS[h % PAST_REVIEWERS.length],
    // Two days after it came in — but never later than today.
    reviewedOn: [isoOffset(submittedOn, 2), isoLocal(TODAY)].sort()[0],
  };
}

/** Build the review queue: every learner in the user list, each with one to
 * three Hands-On Tasks in flight. A learner can have several submissions
 * waiting at once (different Tasks), which is what the real queue looks like —
 * one row per user would never fill a reviewer's day. */
function buildSubmissions(): TaskSubmission[] {
  const out: TaskSubmission[] = [];
  users.forEach((u) => {
    const base = uhash(u.id);
    // A Self-Learner only ever sees SkillCat's library; a company's learners
    // also get that company's own Tasks.
    const pool = u.userType === "B2B" ? B2B_TASK_NAMES : SKILLCAT_TASK_NAMES;
    // 1–3 Tasks per learner, deterministically.
    const attempts = base % 9 === 0 ? 3 : base % 3 === 0 ? 2 : 1;
    for (let a = 0; a < attempts; a++) {
      const k = uhash(`${u.id}:${a}`);
      // Stride 5 over a pool whose length is coprime to it, so a learner's
      // submissions are always against distinct Tasks.
      const taskName = pool[(base + a * 5) % pool.length];
      const taskRecord = taskRecordByName(taskName);
      const submittedDaysAgo = (k % 21) + 1;
      const mediaCount = 2 + (k % 3); // 2–4 media items
      const media: SubmissionMedia[] = Array.from({ length: mediaCount }, (_, m) =>
        m === 0
          ? {
              kind: "video" as const,
              seed: `${u.id}-${a}-${m}`,
              duration: `0:${String(4 + (k % 50)).padStart(2, "0")}`,
            }
          : { kind: "image" as const, seed: `${u.id}-${a}-${m}` },
      );
      // A "Submission Made" Task completes on its first submission — one
      // attempt, nothing to review.
      const onSubmit = completesOnSubmissionTask(taskRecord);
      // Newest-first version list, always anchored at V1. A user with 3 attempts
      // gets ["V3","V2","V1"] — never "V5" with no V1 underneath it.
      const versionCount = onSubmit ? 1 : 1 + (k % 5);
      const versions = Array.from({ length: versionCount }, (_, vi) => `V${versionCount - vi}`);
      const status: SubmissionStatus = onSubmit
        ? "Completed"
        : k % 9 === 0 ? "Rejected" : k % 11 === 0 ? "Completed" : "Review Pending";
      out.push({
        id: `RS-${2400 - out.length * 7}`,
        userId: u.id,
        userName: u.name,
        email: u.email,
        phone: u.phone,
        userType: u.userType,
        companyName: u.companyName,
        taskName,
        taskId: taskRecord?.id ?? "",
        certifications: taskRecord?.usedIn ?? [],
        submittedOn: isoDaysAgo(submittedDaysAgo),
        // Who created the Task, straight from the Tasks library — SkillCat for
        // its own content, or the B2B customer that authored it. A company's
        // own Task is graded by that company, so those rows land read-only.
        createdBy: taskRecord?.createdBy ?? "SkillCat",
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
        checklist: CHECKLIST,
        review: seededReview(status, k, taskRecord, isoDaysAgo(submittedDaysAgo)),
      });
    }
  });
  return out;
}

export const reviewSubmissions: TaskSubmission[] = buildSubmissions();

/** One submission for a learner × Hands-On Task that the seeded queue above
 *  may not happen to contain.
 *
 *  Manage Completions works off its own certification model, where any learner
 *  can have attempts on any Task; this queue only gives each learner the 1–3
 *  Tasks its own hash picked. Deep-linking "View All Attempts" into this page
 *  would therefore usually land on an empty table, so the opening tab supplies
 *  the row it is promising — the same trick the standalone Attempts page uses
 *  for quizzes. Built from the same deterministic hash as the seed, so the
 *  synthesized row is stable across reloads and indistinguishable from a real
 *  one. `attempts` (from the Manage Completions cell) drives the version list;
 *  `reviewPending` decides the status. */
export function submissionForLearner(args: {
  userId: string;
  userName: string;
  email: string;
  phone: string;
  userType: "B2C" | "B2B";
  companyName?: string;
  taskName: string;
  taskId: string;
  certifications: string[];
  createdBy: string;
  attempts: number;
  reviewPending: boolean;
  complete: boolean;
}): TaskSubmission {
  const k = uhash(`${args.userId}:${args.taskId}:link`);
  const submittedDaysAgo = (k % 21) + 1;
  const mediaCount = 2 + (k % 3);
  const media: SubmissionMedia[] = Array.from({ length: mediaCount }, (_, m) =>
    m === 0
      ? {
          kind: "video" as const,
          seed: `${args.userId}-link-${m}`,
          duration: `0:${String(4 + (k % 50)).padStart(2, "0")}`,
        }
      : { kind: "image" as const, seed: `${args.userId}-link-${m}` },
  );
  const taskRecord = taskRecordById(args.taskId) ?? taskRecordByName(args.taskName);
  const onSubmit = completesOnSubmissionTask(taskRecord);
  const status: SubmissionStatus = onSubmit
    ? "Completed"
    : args.reviewPending ? "Review Pending" : args.complete ? "Completed" : "Rejected";
  const versionCount = onSubmit ? 1 : Math.max(1, args.attempts);
  return {
    id: `RS-L${k % 9000}`,
    userId: args.userId,
    userName: args.userName,
    email: args.email,
    phone: args.phone,
    userType: args.userType,
    companyName: args.companyName,
    taskName: args.taskName,
    taskId: args.taskId,
    certifications: args.certifications,
    submittedOn: isoDaysAgo(submittedDaysAgo),
    createdBy: args.createdBy,
    durationLabel: "Hands-on Task · 2 Hours",
    status,
    progress: 100,
    completion: isoDaysAgo(submittedDaysAgo),
    dueDate: args.userType === "B2B" ? isoDaysAhead(15 + (k % 30)) : undefined,
    lastActivity: activityLabel(submittedDaysAgo),
    versions: Array.from({ length: versionCount }, (_, vi) => `V${versionCount - vi}`),
    media,
    description: DESCRIPTIONS[k % DESCRIPTIONS.length],
    hasAudio: k % 3 !== 0,
    audioLabel: "Voice note",
    audioDuration: `0:${String(20 + (k % 40)).padStart(2, "0")}`,
    checklist: CHECKLIST,
    review: seededReview(status, k, taskRecord, isoDaysAgo(submittedDaysAgo)),
  };
}

/** The open Task's Passing Grade (1–10): scores at or above it pass, below it
 *  are rejected. */
export function passScoreOf(s: TaskSubmission): number {
  return handsOnPassScore(taskOf(s));
}

/** The submission's Task completes on submission ("Submission Made") — it
 *  is listed for reference but has nothing to grade. */
export function completesOnSubmission(s: TaskSubmission): boolean {
  return completesOnSubmissionTask(taskOf(s));
}

/** The submission's live Task record — the console reads its checklist (and
 *  links its name to the Task editor) through this. */
export function taskRecordOf(s: TaskSubmission, tasks: Task[] = getTasks()): Task | undefined {
  return taskRecordById(s.taskId, tasks) ?? tasks.find((t) => t.name === s.taskName);
}

/** The row as the live Task now reads: its name, Certifications and creator
 *  follow wizard edits. The Task's own fields (Passing Grade, completion) are
 *  read on demand by {@link passScoreOf} / {@link completesOnSubmission}. */
export function withLiveTask(s: TaskSubmission, tasks: Task[]): TaskSubmission {
  const t = taskRecordById(s.taskId, tasks);
  if (!t) return s;
  if (t.name === s.taskName && t.usedIn === s.certifications && t.createdBy === s.createdBy) return s;
  return { ...s, taskName: t.name, certifications: t.usedIn, createdBy: t.createdBy };
}

/** Nothing for a SkillCat reviewer to grade, so the review console opens it
 * read-only: a company-created Task is graded by that company, and a
 * "Submission Made" Task isn't graded at all. */
export function isReadOnly(s: TaskSubmission): boolean {
  return s.createdBy !== "SkillCat" || completesOnSubmission(s);
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
  return isoLocal(d);
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


/** Read-only past review for an older attempt. An older attempt is older
 *  because it was rejected, so it scores below its Task's Passing Grade. */
export function pastReviewOf(s: TaskSubmission, idx: number): SubmissionReview {
  const h = uhash(s.id + ":r" + idx);
  const submitted = isoOffset(s.submittedOn, -idx * 18);
  return {
    score: 1 + (h % Math.max(1, passScoreOf(s) - 1)),
    feedback: PAST_FEEDBACK[h % PAST_FEEDBACK.length],
    reviewer: PAST_REVIEWERS[h % PAST_REVIEWERS.length],
    reviewedOn: isoOffset(submitted, 2),
  };
}

/* ── Reviews submitted this session ─────────────────────────────────────────
   One store for every view of the queue — the sidebar badge, the run cards,
   the table and the console all read pending-ness through it, so a submitted
   review leaves all of them at once. Keyed by submission id; applied on read
   with {@link withSubmittedReview}. ── */

/** The signed-in reviewer — the prototype has no auth, so one stand-in name. */
const CURRENT_REVIEWER = "You";

let submittedReviews = new Map<string, SubmissionReview>();
const reviewListeners = new Set<() => void>();

function subscribeReviews(l: () => void) {
  reviewListeners.add(l);
  return () => reviewListeners.delete(l);
}

/** Record a reviewer's verdict on the current attempt. Its status follows
 *  from the score against the Task's Passing Grade. */
export function submitReview(id: string, score: number, feedback: string) {
  submittedReviews = new Map(submittedReviews).set(id, {
    score,
    feedback,
    reviewer: CURRENT_REVIEWER,
    // Stamped when it is submitted, not when the page loaded.
    reviewedOn: isoLocal(new Date()),
  });
  reviewListeners.forEach((l) => l());
}

/** Re-renders on every submitted review; pass the map to {@link withSubmittedReview}. */
export function useSubmittedReviews(): ReadonlyMap<string, SubmissionReview> {
  return useSyncExternalStore(subscribeReviews, () => submittedReviews);
}

/** The submission as it stands after this session's reviews. */
export function withSubmittedReview(
  s: TaskSubmission,
  reviews: ReadonlyMap<string, SubmissionReview> = submittedReviews,
): TaskSubmission {
  const review = reviews.get(s.id);
  if (!review) return s;
  return { ...s, review, status: review.score >= passScoreOf(s) ? "Completed" : "Rejected" };
}

/** Still waiting on a SkillCat reviewer — the one test behind every pending
 *  count (sidebar badge, run cards, the console's Skip count). */
export function isPendingReview(s: TaskSubmission): boolean {
  return displayStatus(s) === "Review Pending";
}

/** The sidebar's Hands-On Tasks badge: the seeded queue, live — re-read when
 *  a review lands or a Task changes (a Task switched to "Submission Made"
 *  leaves the queue). */
export function usePendingHandsOnCount(): number {
  const reviews = useSubmittedReviews();
  const tasks = useLiveTasks();
  return reviewSubmissions.filter((s) =>
    isPendingReview(withSubmittedReview(withLiveTask(s, tasks), reviews)),
  ).length;
}
