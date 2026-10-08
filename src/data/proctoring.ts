import { useMemo, useSyncExternalStore } from "react";
import { users } from "./users";
import {
  gatedByIdUpload,
  isIdUpload,
  tasks as seedTasks,
  useLiveTasks,
  type Task,
} from "./tasks";
import { useLiveCerts, type Certification } from "./certifications";

export type ProctoringKind = "proctoring" | "id-review" | "id-reupload";

export type ProctoringStatus = "pending" | "accepted" | "rejected" | "id-requested";

export type FlagReason = "Looking Away" | "Face Not Visible" | "Multiple Faces" | "No Face";

export type FrameTone = "neutral" | "side" | "dark";

export type WebcamFrame = {
  tone: FrameTone;
  flag?: FlagReason;
};

/* ── Which Quizzes are reviewed here ──
   Not a fixed list: a Quiz comes to Exam Reviews when it has Proctoring on
   (its attempts are recorded, and the footage reviewed) or when the ID Upload
   Task gates it through an Access Restriction (the learner's ID is checked
   before the attempt counts). Both are authored elsewhere — the Quiz wizard's
   Proctoring field, the seeded chains and a Certification's Add Access
   Restriction — so the list is read off the live Tasks and Certifications. */

/** The Quiz names a Certification's own Add Tasks tree gates behind the ID
 *  Upload Task. Tree Tasks link to the library by name. */
function idGatedInCerts(tasks: Task[], certs: Certification[]): Set<string> {
  const idUploads = tasks.filter(isIdUpload);
  const idUploadNames = new Set(idUploads.map((t) => t.name));
  const out = new Set<string>();
  for (const c of certs) {
    const tree = (c.courses ?? []).flatMap((co) =>
      co.children.flatMap((ch) => (ch.kind === "task" ? [ch.task] : ch.lesson.tasks)),
    );
    /* A gate is the library ID Upload Task itself (Add Access Restriction
       offers it by its library id) or a tree copy of it by name. */
    const gates = new Set([
      ...idUploads.map((t) => t.id),
      ...tree.filter((t) => idUploadNames.has(t.name)).map((t) => t.id),
    ]);
    for (const t of tree) {
      if (t.restriction?.enabled && t.restriction.taskIds.some((id) => gates.has(id))) out.add(t.name);
    }
  }
  return out;
}

/** The Quizzes whose attempts Exam Reviews reviews — see above. */
export function reviewedQuizzes(tasks: Task[], certs: Certification[]): Task[] {
  const certGated = idGatedInCerts(tasks, certs);
  return tasks.filter(
    (t) => t.type === "Quiz" && (!!t.proctoring || gatedByIdUpload(t) || certGated.has(t.name)),
  );
}

/** The reviewed Quizzes' names, A–Z — the Quiz pill's options, live. */
export function useReviewedQuizNames(): string[] {
  const tasks = useLiveTasks();
  const certs = useLiveCerts();
  return useMemo(
    () => reviewedQuizzes(tasks, certs).map((t) => t.name).sort((a, b) => a.localeCompare(b)),
    [tasks, certs],
  );
}

export type Submission = {
  id: string;
  /** The same User record shown on the Manage Users page — the two pages share one candidate roster. */
  userId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  /** B2B candidates only — the company on their User record. */
  companyName?: string;
  /** The Quiz Task this is an attempt at. */
  taskId: string;
  /** That Quiz's name — kept live by {@link useSubmissions}, so a rename in
   *  the Task wizard shows here. */
  exam: string;
  grade: string;
  submittedAt: string; // ISO-like display string
  /** When the candidate sent the new ID back. Set on `id-reupload` rows that
   *  have returned — the "New ID" flag beside their name reads this. */
  reuploadedAt?: string;
  /** When an admin asked the candidate to send a new ID. Set only on
   *  `id-requested` rows — it's the date the Pending ID-Reuploads page is
   *  chasing, and it is always AFTER `submittedAt` (the original attempt). */
  reuploadRequestedAt?: string;
  kind: ProctoringKind;
  status: ProctoringStatus;
  idConfidence: number; // 0-100
  idType: string;
  /** Name as detected on the uploaded ID. Omitted/equal to candidateName when there's no mismatch. */
  idDetectedName?: string;
  /* ── Mock ID document details, rendered on the ID card. Derived
        deterministically per candidate (see idDocOf) so every ID looks
        distinct without hand-maintaining them. ── */
  idNumber: string;
  idDob: string; // ISO date
  idExpires: string; // ISO date
  idRegion: string; // issuing state
  /** picsum seed for the ID portrait photo. */
  idPhotoSeed: string;
  webcamFlaggedCount: number;
  webcamTotal: number;
  frames: WebcamFrame[];
  /** Set when this candidate's ID was already accepted on an earlier
   *  submission, so the reviewer needn't verify the document again. Proctored
   *  exams only — an ID-only submission IS the ID check. `at` uses the same
   *  display format as `submittedAt`. */
  idPreviouslyVerified?: { at: string; by: string };
  /** Freeform note an admin has attached to this candidate's integrity record. */
  integrityNote?: string;
  /** Why this attempt was rejected — the reasons picked in the reject dialog.
   *  Only set on `status: "rejected"` rows; listed in the Integrity Note's
   *  expanded "Rejected Attempts" detail. */
  rejectionReasons?: string[];
};

/** The floor for how many frames the footage wall samples. The console fits 8
 *  tiles a row at its widest, so 40 is the 5 rows a real recording produces —
 *  the wall should read as a wall, not as one short strip. TOTAL FRAMES on the
 *  rail is the true length of the recording; this is what gets shown. */
const FRAME_SAMPLE = 40;
/** …and the ceiling: recordings differ in length, so the walls shouldn't all
 *  be the same height. `frameSampleFor` picks a row's count in this range. */
const FRAME_SAMPLE_MAX = 64;

function makeFrames(totalCount: number, flagged: Array<{ at: number; reason: FlagReason }>): WebcamFrame[] {
  const frames: WebcamFrame[] = [];
  const flagMap = new Map<number, FlagReason>();
  flagged.forEach((f) => flagMap.set(f.at, f.reason));
  for (let i = 0; i < totalCount; i++) {
    const flag = flagMap.get(i);
    if (flag) {
      const tone: FrameTone =
        flag === "Face Not Visible" || flag === "No Face" ? "dark" : "side";
      frames.push({ tone, flag });
    } else {
      // Distribute a few side-tone neutral frames as visual variety
      const tone: FrameTone = i % 7 === 3 ? "side" : "neutral";
      frames.push({ tone });
    }
  }
  return frames;
}

/** This submission's wall length, 40…64 — deterministic (the same FNV-1a hash
 *  the ID details use) so a row is the same height on every render rather than
 *  reshuffling under the reviewer. */
function frameSampleFor(id: string): number {
  return FRAME_SAMPLE + (phash(id) % (FRAME_SAMPLE_MAX - FRAME_SAMPLE + 1));
}

/** Grows a seeded frame list to `count`, continuing the same neutral/side
 *  cadence `makeFrames` uses. Every seeded flag sits in the first frames, so
 *  they all survive — this only adds unflagged tail frames. */
function resizeFrames(frames: WebcamFrame[], count: number): WebcamFrame[] {
  if (frames.length >= count) return frames.slice(0, count);
  const out = [...frames];
  for (let i = frames.length; i < count; i++) {
    out.push({ tone: i % 7 === 3 ? "side" : "neutral" });
  }
  return out;
}

/** Looks up a real user from the Manage Users roster so submissions carry the
 *  same name/email that page shows — not a separate, @skillcatapp.com-only cast. */
function candidateOf(userId: string): {
  userId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  companyName?: string;
} {
  const u = users.find((x) => x.id === userId);
  if (!u) throw new Error(`Unknown user id ${userId}`);
  return {
    userId,
    candidateName: u.name,
    candidateEmail: u.email,
    candidatePhone: u.phone,
    companyName: u.companyName,
  };
}

/* ── Deterministic ID document details (same FNV-1a approach as data/users.ts) ── */
function phash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ID_REGIONS = [
  "California",
  "Texas",
  "Florida",
  "New York",
  "Pennsylvania",
  "Georgia",
  "Arizona",
  "Illinois",
  "Washington",
  "Ohio",
];

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

/** Builds the ID-card fields for a submission. Keyed on userId so the same
 *  candidate's ID is consistent across their submissions; the document number
 *  is formatted per ID type (licences/state IDs are hyphenated, passports aren't). */
function idDocOf(
  userId: string,
  idType: string,
): Pick<Submission, "idNumber" | "idDob" | "idExpires" | "idRegion" | "idPhotoSeed"> {
  const k = phash(userId);
  const isPassport = idType.toLowerCase().includes("passport");
  // Unsigned (>>>) shifts throughout: phash returns a full 32-bit value, and a
  // signed >> on anything past 2^31 goes negative, which made `% 12` negative
  // and produced dates like "1973-00--9".
  const birthYear = 1968 + (k % 32); // 1968–1999
  const birthMonth = 1 + ((k >>> 5) % 12);
  const birthDay = 1 + ((k >>> 9) % 28);
  const expYear = 2027 + ((k >>> 13) % 6); // 2027–2032
  return {
    idNumber: isPassport
      ? `P${pad(k % 100000000, 8)}`
      : `${String.fromCharCode(68 + (k % 3))}${pad(k % 10000, 4)}-${pad((k >>> 7) % 10000, 4)}-${pad((k >>> 15) % 10000, 4)}`,
    idDob: `${birthYear}-${pad(birthMonth, 2)}-${pad(birthDay, 2)}`,
    // Licences renew on the holder's birthday.
    idExpires: `${expYear}-${pad(birthMonth, 2)}-${pad(birthDay, 2)}`,
    idRegion: isPassport ? "United States" : ID_REGIONS[k % ID_REGIONS.length],
    idPhotoSeed: `pr-${userId}`,
  };
}

type SeedRow = {
  id: string;
  userId: string;
  taskId: string;
  grade: string;
  submittedAt: string;
  reuploadRequestedAt?: string;
  reuploadedAt?: string;
  kind: ProctoringKind;
  status: ProctoringStatus;
  idConfidence: number;
  idType: string;
  idDetectedName?: string;
  idPreviouslyVerified?: { at: string; by: string };
  /** Proctored Quizzes only — an ID-only one captures no footage, so its rows
   *  carry `[]`. The flagged count and total are read off these. */
  frames: WebcamFrame[];
  integrityNote?: string;
  rejectionReasons?: string[];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const ordinal = (n: number) =>
  n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");

/** A moment in the seed rows' display form — "October 8th, 2026, 3:15 PM" —
 *  for dates the session writes (a re-upload request). */
export function displayDateTime(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}, ${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/** Today at local midnight. Seed moments are offsets from it (as the Hands-On
 *  queue's are), so waiting times and date filters read true on any day. */
const SEED_TODAY = (() => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
})();
/** `ago(-79, "9:20 AM")` — three days before today, at that time. */
function ago(days: number, time: string): string {
  const d = new Date(SEED_TODAY);
  d.setDate(d.getDate() - days);
  const m = /^(\d+):(\d+) (AM|PM)$/.exec(time);
  if (m) {
    let h = Number(m[1]) % 12;
    if (m[3] === "PM") h += 12;
    d.setHours(h, Number(m[2]), 0, 0);
  }
  return displayDateTime(d);
}

const seedRows: SeedRow[] = [
  /* ── 2026-08-25: 20 more pending submissions so the queue, the run cards and
     the By Quiz "+ N more" row all have realistic volume. Every one draws a
     distinct candidate from the Manage Users roster; `kind` follows the exam's
     category (a Quiz with Proctoring on → proctoring, ID check only → id-review) except
     the two re-uploads at the end. ── */
  {
    id: "PR-1064",
    userId: "U-10044", // Marcus Holloway
    taskId: "T-1198", // EPA 608 Universal Final Exam
    grade: "9.1",
    submittedAt: ago(1, "9:20 AM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 98,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, []),
  },
  {
    id: "PR-1063",
    userId: "U-10157", // Ayesha Khan
    taskId: "T-1149", // EPA 608 Type II Final Exam
    grade: "8.7",
    submittedAt: ago(10, "3:05 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 94,
    idType: "US Passport",
    frames: makeFrames(FRAME_SAMPLE, [
      { at: 6, reason: "Looking Away" },
      { at: 17, reason: "Looking Away" },
    ]),
  },
  {
    id: "PR-1062",
    userId: "U-10291", // Tyrese Booker
    taskId: "T-1289", // NATE RTW Final Exam
    grade: "9.4",
    submittedAt: ago(21, "11:45 AM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 91,
    idType: "US State ID",
    frames: [],
  },
  {
    id: "PR-1061",
    userId: "U-10330", // Lena Petrov
    taskId: "T-1142", // EPA 608 Type III Final Exam
    grade: "7.9",
    submittedAt: ago(34, "8:30 AM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 88,
    idType: "US Driver's License",
    idDetectedName: "Yelena Petrova",
    frames: makeFrames(FRAME_SAMPLE, [
      { at: 4, reason: "Face Not Visible" },
      { at: 11, reason: "Looking Away" },
      { at: 19, reason: "Looking Away" },
    ]),
  },
  {
    id: "PR-1060",
    userId: "U-10376", // Carlos Mendoza
    taskId: "T-1407", // EPA 609 Final Exam
    grade: "9.0",
    submittedAt: ago(47, "4:15 PM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 97,
    idType: "US Passport",
    frames: [],
  },
  {
    id: "PR-1059",
    userId: "U-10458", // Brandon O'Connor
    taskId: "T-1198", // EPA 608 Universal Final Exam
    grade: "8.4",
    submittedAt: ago(59, "1:50 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 93,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, [{ at: 8, reason: "Multiple Faces" }]),
  },
  {
    id: "PR-1058",
    userId: "U-10491", // Naomi Sato
    taskId: "T-1156", // EPA 608 Type I Final Exam
    grade: "9.6",
    submittedAt: ago(72, "10:10 AM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 99,
    idType: "US Passport",
    frames: [],
  },
  {
    id: "PR-1057",
    userId: "U-10655", // Olivia Tran
    taskId: "T-1149", // EPA 608 Type II Final Exam
    grade: "8.9",
    submittedAt: ago(80, "2:40 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 95,
    idType: "US State ID",
    frames: makeFrames(FRAME_SAMPLE, []),
  },
  {
    id: "PR-1056",
    userId: "U-10778", // Kwame Mensah
    taskId: "T-1289", // NATE RTW Final Exam
    grade: "9.3",
    submittedAt: ago(93, "12:05 PM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 90,
    idType: "US Driver's License",
    frames: [],
  },
  {
    id: "PR-1055",
    userId: "U-10859", // Mateo Garcia
    taskId: "T-1198", // EPA 608 Universal Final Exam
    grade: "7.6",
    submittedAt: ago(107, "9:55 AM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 86,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, [
      { at: 2, reason: "Looking Away" },
      { at: 7, reason: "No Face" },
      { at: 13, reason: "Looking Away" },
      { at: 21, reason: "Face Not Visible" },
    ]),
    integrityNote: "Flagged by the proctor for repeated off-screen glances.",
  },
  {
    id: "PR-1054",
    userId: "U-10903", // Chloe Bennett
    taskId: "T-1142", // EPA 608 Type III Final Exam
    grade: "9.2",
    submittedAt: ago(117, "3:30 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 96,
    idType: "US Passport",
    frames: makeFrames(FRAME_SAMPLE, []),
  },
  {
    id: "PR-1053",
    userId: "U-10987", // Emma Schneider
    taskId: "T-1407", // EPA 609 Final Exam
    grade: "8.8",
    submittedAt: ago(130, "8:05 AM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 92,
    idType: "US State ID",
    frames: [],
  },
  {
    id: "PR-1052",
    userId: "U-11021", // Andre Dubois
    taskId: "T-1149", // EPA 608 Type II Final Exam
    grade: "9.7",
    submittedAt: ago(143, "1:20 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 99,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, []),
  },
  {
    id: "PR-1051",
    userId: "U-11066", // Zoe Campbell
    taskId: "T-1156", // EPA 608 Type I Final Exam
    grade: "8.1",
    submittedAt: ago(157, "10:45 AM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 89,
    idType: "US Driver's License",
    idDetectedName: "Zoey Campbell",
    frames: [],
  },
  {
    id: "PR-1050",
    userId: "U-11103", // Yusuf Demir
    taskId: "T-1198", // EPA 608 Universal Final Exam
    grade: "9.0",
    submittedAt: ago(171, "4:00 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 94,
    idType: "US Passport",
    frames: makeFrames(FRAME_SAMPLE, [{ at: 15, reason: "Looking Away" }]),
  },
  {
    id: "PR-1049",
    userId: "U-11147", // Harper Wright
    taskId: "T-1289", // NATE RTW Final Exam
    grade: "9.5",
    submittedAt: ago(186, "11:30 AM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 98,
    idType: "US Passport",
    frames: [],
  },
  {
    id: "PR-1048",
    userId: "U-11189", // Nina Kowalski
    taskId: "T-1142", // EPA 608 Type III Final Exam
    grade: "8.3",
    submittedAt: ago(213, "9:15 AM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 91,
    idType: "US State ID",
    frames: makeFrames(FRAME_SAMPLE, [
      { at: 5, reason: "Looking Away" },
      { at: 18, reason: "Multiple Faces" },
    ]),
  },
  {
    id: "PR-1047",
    userId: "U-11224", // Theo Martin
    taskId: "T-1156", // EPA 608 Type I Final Exam
    grade: "9.1",
    submittedAt: ago(227, "2:55 PM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 95,
    idType: "US Driver's License",
    frames: [],
  },
  /* Two more re-uploads so that tab has both of its states beyond the originals. */
  {
    id: "PR-1046",
    userId: "U-10044", // Marcus Holloway — second attempt, ID sent back
    taskId: "T-1149", // EPA 608 Type II Final Exam
    grade: "8.6",
    submittedAt: ago(241, "10:25 AM"),
    reuploadedAt: ago(233, "2:15 PM"),
    kind: "id-reupload",
    status: "pending",
    idConfidence: 78,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, []),
  },
  {
    id: "PR-1045",
    userId: "U-10491", // Naomi Sato — waiting on the candidate
    taskId: "T-1289", // NATE RTW Final Exam
    grade: "9.0",
    submittedAt: ago(255, "3:40 PM"),
    reuploadRequestedAt: ago(250, "9:05 AM"),
    kind: "id-reupload",
    status: "id-requested",
    idConfidence: 74,
    idType: "US State ID",
    frames: [],
  },
  {
    id: "PR-1042",
    userId: "U-10089", // Priya Venkatesan — priya.v@outlook.com
    taskId: "T-1149", // EPA 608 Type II Final Exam
    grade: "9.5",
    submittedAt: ago(256, "2:30 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 96,
    idType: "US Driver's License",
    idDetectedName: "Priya V",
    frames: makeFrames(FRAME_SAMPLE, [{ at: 12, reason: "Looking Away" }]),
  },
  {
    id: "PR-1041",
    userId: "U-10203", // Jordan Whitfield — j.whitfield@gmail.com
    taskId: "T-1198", // EPA 608 Universal Final Exam
    grade: "9.5",
    submittedAt: ago(256, "2:30 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 99,
    idType: "US Passport",
    idPreviouslyVerified: { at: ago(339, "10:15 AM"), by: "Maxwell Wesonga" },
    frames: makeFrames(FRAME_SAMPLE, []),
  },
  {
    id: "PR-1040",
    userId: "U-10412", // Hana Yamamoto — hana.y@gmail.com
    taskId: "T-1289", // NATE RTW Final Exam
    grade: "9.2",
    submittedAt: ago(270, "11:15 AM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 92,
    idType: "US Driver's License",
    frames: [],
    integrityNote:
      "Copying answers from their phone and not complying with the exam rules",
  },
  /* Hana Yamamoto's two prior rejected attempts — these put the "Caught
     Cheating in Past Quizzes" card on her pending submission above, and its
     link opens the Quiz of the latest one. Both passed on grade: a failed
     attempt never reaches review, so it never creates an entry here. */
  {
    id: "PR-0977",
    userId: "U-10412",
    taskId: "T-1198", // EPA 608 Universal Final Exam
    grade: "8.2",
    submittedAt: ago(26, "9:05 AM"),
    kind: "proctoring",
    status: "rejected",
    idConfidence: 71,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, [
      { at: 2, reason: "Face Not Visible" },
      { at: 8, reason: "Multiple Faces" },
      { at: 13, reason: "Looking Away" },
      { at: 18, reason: "Multiple Faces" },
      { at: 22, reason: "Face Not Visible" },
    ]),
    rejectionReasons: ["Eyes were not focused on camera"],
  },
  {
    id: "PR-0954",
    userId: "U-10412",
    taskId: "T-1149", // EPA 608 Type II Final Exam
    grade: "7.9",
    submittedAt: ago(79, "4:20 PM"),
    kind: "proctoring",
    status: "rejected",
    idConfidence: 68,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, [
      { at: 1, reason: "No Face" },
      { at: 6, reason: "Face Not Visible" },
      { at: 11, reason: "Looking Away" },
      { at: 19, reason: "No Face" },
    ]),
    rejectionReasons: ["Camera wasn't recording"],
  },
  {
    id: "PR-1039",
    userId: "U-10731", // Isabella Rossi — bella.rossi@gmail.com
    taskId: "T-1156", // EPA 608 Type I Final Exam
    grade: "8.9",
    submittedAt: ago(307, "12:40 PM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 98,
    idType: "US Driver's License",
    frames: [],
  },
  {
    id: "PR-1038",
    userId: "U-10132", // Diego Ramirez — diego.ramirez@arscooling.com
    taskId: "T-1149", // EPA 608 Type II Final Exam
    grade: "9.5",
    submittedAt: ago(616, "2:30 PM"),
    kind: "proctoring",
    status: "accepted",
    idConfidence: 95,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, []),
  },
  {
    id: "PR-1037",
    userId: "U-10618", // Felix Becker — felix.becker@harborcitymech.com
    taskId: "T-1407", // EPA 609 Final Exam
    grade: "8.3",
    submittedAt: ago(909, "10:15 AM"),
    reuploadRequestedAt: ago(907, "11:40 AM"),
    kind: "id-reupload",
    status: "id-requested",
    idConfidence: 64,
    idType: "US State ID",
    frames: [],
  },
  {
    /* A re-upload still waiting on the candidate ("Requested") whose exam WAS
       proctored — so the review page shows its footage alongside the ID. Pairs
       with PR-1043 below, the same case in the "To Review" state. */
    id: "PR-1044",
    userId: "U-10537", // Ezekiel Adeoye — z.adeoye@deltaelectrical.com
    taskId: "T-1198", // EPA 608 Universal Final Exam
    grade: "8.6",
    submittedAt: ago(167, "4:20 PM"),
    reuploadRequestedAt: ago(164, "2:15 PM"),
    kind: "id-reupload",
    status: "id-requested",
    idConfidence: 58,
    idType: "US State ID",
    frames: makeFrames(FRAME_SAMPLE, [
      { at: 5, reason: "Looking Away" },
      { at: 17, reason: "Face Not Visible" },
    ]),
  },
  {
    /* An ID re-upload the candidate has already sent back — it's waiting on an
       admin, so it's `pending` (counts in the tiles, shows under All) and the
       ID Re-uploads tab renders it as "To Review". Contrast PR-1037 above, which
       is still `id-requested`: waiting on the candidate, ID Re-uploads tab only. */
    id: "PR-1043",
    userId: "U-10248", // Sophia Andersson — sophia.a@brennanhvac.com
    taskId: "T-1149", // EPA 608 Type II Final Exam
    grade: "8.8",
    submittedAt: ago(138, "9:05 AM"),
    reuploadedAt: ago(132, "11:20 AM"),
    kind: "id-reupload",
    status: "pending",
    idConfidence: 88,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, []),
  },
  {
    id: "PR-1036",
    userId: "U-10692", // Samuel Okafor — sam.okafor@greenshieldsolar.com
    taskId: "T-1142", // EPA 608 Type III Final Exam
    grade: "9.0",
    submittedAt: ago(470, "3:45 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 97,
    idType: "US Driver's License",
    idPreviouslyVerified: { at: ago(551, "4:40 PM"), by: "Priyanka Rao" },
    frames: makeFrames(FRAME_SAMPLE, [{ at: 6, reason: "Looking Away" }]),
  },
  {
    id: "PR-1035",
    userId: "U-10584", // Mira Singh — mira.singh@yahoo.com
    taskId: "T-1198", // EPA 608 Universal Final Exam
    grade: "7.8",
    submittedAt: ago(384, "1:00 PM"),
    kind: "proctoring",
    status: "pending",
    idConfidence: 88,
    idType: "US Driver's License",
    frames: makeFrames(FRAME_SAMPLE, [
      { at: 2, reason: "Looking Away" },
      { at: 5, reason: "Looking Away" },
      { at: 9, reason: "Face Not Visible" },
      { at: 13, reason: "Looking Away" },
      { at: 17, reason: "Looking Away" },
      { at: 22, reason: "Face Not Visible" },
    ]),
    integrityNote:
      "Support flagged this candidate for coordinating answers with another user in the course chat during a prior attempt.",
  },
  {
    id: "PR-1034",
    userId: "U-10948", // Raj Patel — raj.patel@northstarrefrig.com
    taskId: "T-1289", // NATE RTW Final Exam
    grade: "9.2",
    submittedAt: ago(151, "11:20 AM"),
    kind: "id-review",
    status: "pending",
    idConfidence: 91,
    idType: "US Driver's License",
    frames: [],
  },
  {
    id: "PR-1033",
    userId: "U-10814", // Grace Liu — grace.liu@gmail.com
    taskId: "T-1142", // EPA 608 Type III Final Exam
    grade: "8.7",
    submittedAt: ago(859, "4:00 PM"),
    kind: "proctoring",
    status: "accepted",
    idConfidence: 94,
    idType: "US Passport",
    frames: makeFrames(FRAME_SAMPLE, []),
  },
];

export const submissions: Submission[] = seedRows.map((r) => {
  const quiz = seedTasks.find((t) => t.id === r.taskId);
  if (!quiz) throw new Error(`Unknown Quiz ${r.taskId}`);
  /* The wall is sampled to this row's length; a Quiz without Proctoring
     records nothing, so it has no wall. */
  const frames = quiz.proctoring ? resizeFrames(r.frames, frameSampleFor(r.id)) : [];
  return {
    ...candidateOf(r.userId),
    ...idDocOf(r.userId, r.idType),
    id: r.id,
    taskId: r.taskId,
    exam: quiz.name,
    grade: r.grade,
    submittedAt: r.submittedAt,
    reuploadRequestedAt: r.reuploadRequestedAt,
    reuploadedAt: r.reuploadedAt,
    kind: r.kind,
    status: r.status,
    idConfidence: r.idConfidence,
    idType: r.idType,
    idDetectedName: r.idDetectedName,
    idPreviouslyVerified: r.idPreviouslyVerified,
    webcamFlaggedCount: frames.filter((f) => !!f.flag).length,
    webcamTotal: frames.length,
    frames,
    integrityNote: r.integrityNote,
    rejectionReasons: r.rejectionReasons,
  };
});

/** Free-text match for the Proctoring search — the fields the placeholder
 *  promises ("User's Name, Email, or Phone") plus the exam, so typing an exam
 *  name still narrows the list without reaching for the `Exam:` scope. */
export function matchesQuery(s: Submission, q: string): boolean {
  return (
    s.candidateName.toLowerCase().includes(q) ||
    s.candidateEmail.toLowerCase().includes(q) ||
    s.candidatePhone.toLowerCase().includes(q) ||
    s.exam.toLowerCase().includes(q)
  );
}

/* The two states an ID re-upload can be in are now two separate pages rather
   than a Status column: `id-requested` (asked for, not sent back) is the whole
   of Pending ID Re-Uploads — see `isPendingIdReupload` — and a `pending`
   re-upload sits in the Exam Reviews queue like any other submission. */

/** Whether webcam footage was captured for a submission.
 *
 *  Read off the recording, not `kind` or the Quiz's Proctoring field today:
 *  the camera ran during a proctored attempt, so the footage exists for the
 *  whole life of that submission — including after it moves to the ID
 *  Re-uploads queue, and even if Proctoring is later switched off. A Quiz
 *  without Proctoring never records any. */
export function hasProctoringFootage(s: Submission): boolean {
  return s.frames.length > 0;
}

/** The re-uploads an admin has asked for that the candidate hasn't sent back
 *  yet. Nothing here is reviewable — the row is waiting on the CANDIDATE, not
 *  on an admin — which is why it gets its own page off the Exam Reviews header
 *  rather than a place in the review queue. */
export function isPendingIdReupload(s: Submission): boolean {
  return s.status === "id-requested";
}

/* ── The working submissions store ──
   Decisions, re-upload requests and renames outlast the page that made them:
   App remounts Exam Reviews on every navigation, and Pending ID Re-Uploads
   reads the same list, so both live here for the session (this prototype has
   no storage layer). */
let store: Submission[] = submissions;
const listeners = new Set<() => void>();

export function getSubmissions(): Submission[] {
  return store;
}

export function updateSubmissions(fn: (prev: Submission[]) => Submission[]): void {
  store = fn(store);
  listeners.forEach((l) => l());
}

/** The store with each row's Quiz name read off the live Task list, so a
 *  rename in the Task wizard reaches the table, filters and console. */
export function useSubmissions(): Submission[] {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSubmissions,
  );
  const tasks = useLiveTasks();
  return useMemo(() => {
    const names = new Map(tasks.map((t) => [t.id, t.name] as const));
    return list.map((s) => {
      const name = names.get(s.taskId);
      return name && name !== s.exam ? { ...s, exam: name } : s;
    });
  }, [list, tasks]);
}
