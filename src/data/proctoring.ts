import { users } from "./users";

export type ProctoringKind = "proctoring" | "id-review" | "id-reupload";

export type ProctoringStatus = "pending" | "accepted" | "rejected" | "id-requested";

export type FlagReason = "Looking Away" | "Face Not Visible" | "Multiple Faces" | "No Face";

export type FrameTone = "neutral" | "side" | "dark";

export type WebcamFrame = {
  tone: FrameTone;
  flag?: FlagReason;
};

/** Exams that are live-proctored via webcam for the duration of the exam. */
export const PROCTORED_EXAMS = [
  "EPA 608 Universal Certificate",
  "EPA 608 Type 2 Certificate",
  "EPA 608 Type 3 Certificate",
] as const;

/** Exams that only require an ID review — no webcam footage is captured. */
export const ID_ONLY_EXAMS = [
  "EPA 608 Type 1 Certificate",
  "NATE Ready To Work",
  "EPA 609 Certificate",
] as const;

export const ALL_EXAMS: string[] = [...PROCTORED_EXAMS, ...ID_ONLY_EXAMS];

const EXAM_SHORT: Record<string, string> = {
  "EPA 608 Universal Certificate": "EPA 608 Universal",
  "EPA 608 Type 2 Certificate": "EPA 608 Type 2",
  "EPA 608 Type 3 Certificate": "EPA 608 Type 3",
  "EPA 608 Type 1 Certificate": "EPA 608 Type 1",
  "NATE Ready To Work": "NATE Ready To Work",
  "EPA 609 Certificate": "EPA 609",
};

export type Submission = {
  id: string;
  /** The same User record shown on the Manage Users page — the two pages share one candidate roster. */
  userId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  /** B2B candidates only — the company on their User record. */
  companyName?: string;
  exam: string;
  examShort: string;
  grade: string;
  submittedAt: string; // ISO-like display string
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
  exam: string;
  grade: string;
  submittedAt: string;
  kind: ProctoringKind;
  status: ProctoringStatus;
  idConfidence: number;
  idType: string;
  idDetectedName?: string;
  idPreviouslyVerified?: { at: string; by: string };
  webcamFlaggedCount: number;
  frames: WebcamFrame[];
  integrityNote?: string;
  rejectionReasons?: string[];
};

const seedRows: SeedRow[] = [
  /* ── 2026-08-25: 20 more pending submissions so the queue, the run cards and
     the By Quiz "+ N more" row all have realistic volume. Every one draws a
     distinct candidate from the Manage Users roster; `kind` follows the exam's
     category (PROCTORED_EXAMS → proctoring, ID_ONLY_EXAMS → id-review) except
     the two re-uploads at the end. ── */
  {
    id: "PR-1064",
    userId: "U-10044", // Marcus Holloway
    exam: "EPA 608 Universal Certificate",
    grade: "9.1",
    submittedAt: "July 18th, 2026, 9:20 AM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 98,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1063",
    userId: "U-10157", // Ayesha Khan
    exam: "EPA 608 Type 2 Certificate",
    grade: "8.7",
    submittedAt: "July 9th, 2026, 3:05 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 94,
    idType: "US Passport",
    webcamFlaggedCount: 2,
    frames: makeFrames(24, [
      { at: 6, reason: "Looking Away" },
      { at: 17, reason: "Looking Away" },
    ]),
  },
  {
    id: "PR-1062",
    userId: "U-10291", // Tyrese Booker
    exam: "NATE Ready To Work",
    grade: "9.4",
    submittedAt: "June 28th, 2026, 11:45 AM",
    kind: "id-review",
    status: "pending",
    idConfidence: 91,
    idType: "US State ID",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1061",
    userId: "U-10330", // Lena Petrov
    exam: "EPA 608 Type 3 Certificate",
    grade: "7.9",
    submittedAt: "June 15th, 2026, 8:30 AM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 88,
    idType: "US Driver's License",
    idDetectedName: "Yelena Petrova",
    webcamFlaggedCount: 3,
    frames: makeFrames(24, [
      { at: 4, reason: "Face Not Visible" },
      { at: 11, reason: "Looking Away" },
      { at: 19, reason: "Looking Away" },
    ]),
  },
  {
    id: "PR-1060",
    userId: "U-10376", // Carlos Mendoza
    exam: "EPA 609 Certificate",
    grade: "9.0",
    submittedAt: "June 2nd, 2026, 4:15 PM",
    kind: "id-review",
    status: "pending",
    idConfidence: 97,
    idType: "US Passport",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1059",
    userId: "U-10458", // Brandon O'Connor
    exam: "EPA 608 Universal Certificate",
    grade: "8.4",
    submittedAt: "May 21st, 2026, 1:50 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 93,
    idType: "US Driver's License",
    webcamFlaggedCount: 1,
    frames: makeFrames(24, [{ at: 8, reason: "Multiple Faces" }]),
  },
  {
    id: "PR-1058",
    userId: "U-10491", // Naomi Sato
    exam: "EPA 608 Type 1 Certificate",
    grade: "9.6",
    submittedAt: "May 8th, 2026, 10:10 AM",
    kind: "id-review",
    status: "pending",
    idConfidence: 99,
    idType: "US Passport",
    idPreviouslyVerified: { at: "March 2nd, 2026, 9:00 AM", by: "Maxwell Wesonga" },
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1057",
    userId: "U-10655", // Olivia Tran
    exam: "EPA 608 Type 2 Certificate",
    grade: "8.9",
    submittedAt: "April 30th, 2026, 2:40 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 95,
    idType: "US State ID",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1056",
    userId: "U-10778", // Kwame Mensah
    exam: "NATE Ready To Work",
    grade: "9.3",
    submittedAt: "April 17th, 2026, 12:05 PM",
    kind: "id-review",
    status: "pending",
    idConfidence: 90,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1055",
    userId: "U-10859", // Mateo Garcia
    exam: "EPA 608 Universal Certificate",
    grade: "7.6",
    submittedAt: "April 3rd, 2026, 9:55 AM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 86,
    idType: "US Driver's License",
    webcamFlaggedCount: 4,
    frames: makeFrames(24, [
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
    exam: "EPA 608 Type 3 Certificate",
    grade: "9.2",
    submittedAt: "March 24th, 2026, 3:30 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 96,
    idType: "US Passport",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1053",
    userId: "U-10987", // Emma Schneider
    exam: "EPA 609 Certificate",
    grade: "8.8",
    submittedAt: "March 11th, 2026, 8:05 AM",
    kind: "id-review",
    status: "pending",
    idConfidence: 92,
    idType: "US State ID",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1052",
    userId: "U-11021", // Andre Dubois
    exam: "EPA 608 Type 2 Certificate",
    grade: "9.7",
    submittedAt: "February 26th, 2026, 1:20 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 99,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1051",
    userId: "U-11066", // Zoe Campbell
    exam: "EPA 608 Type 1 Certificate",
    grade: "8.1",
    submittedAt: "February 12th, 2026, 10:45 AM",
    kind: "id-review",
    status: "pending",
    idConfidence: 89,
    idType: "US Driver's License",
    idDetectedName: "Zoey Campbell",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1050",
    userId: "U-11103", // Yusuf Demir
    exam: "EPA 608 Universal Certificate",
    grade: "9.0",
    submittedAt: "January 29th, 2026, 4:00 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 94,
    idType: "US Passport",
    webcamFlaggedCount: 1,
    frames: makeFrames(24, [{ at: 15, reason: "Looking Away" }]),
  },
  {
    id: "PR-1049",
    userId: "U-11147", // Harper Wright
    exam: "NATE Ready To Work",
    grade: "9.5",
    submittedAt: "January 14th, 2026, 11:30 AM",
    kind: "id-review",
    status: "pending",
    idConfidence: 98,
    idType: "US Passport",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1048",
    userId: "U-11189", // Nina Kowalski
    exam: "EPA 608 Type 3 Certificate",
    grade: "8.3",
    submittedAt: "December 18th, 2025, 9:15 AM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 91,
    idType: "US State ID",
    webcamFlaggedCount: 2,
    frames: makeFrames(24, [
      { at: 5, reason: "Looking Away" },
      { at: 18, reason: "Multiple Faces" },
    ]),
  },
  {
    id: "PR-1047",
    userId: "U-11224", // Theo Martin
    exam: "EPA 608 Type 1 Certificate",
    grade: "9.1",
    submittedAt: "December 4th, 2025, 2:55 PM",
    kind: "id-review",
    status: "pending",
    idConfidence: 95,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  /* Two more re-uploads so that tab has both of its states beyond the originals. */
  {
    id: "PR-1046",
    userId: "U-10044", // Marcus Holloway — second attempt, ID sent back
    exam: "EPA 608 Type 2 Certificate",
    grade: "8.6",
    submittedAt: "November 20th, 2025, 10:25 AM",
    kind: "id-reupload",
    status: "pending",
    idConfidence: 78,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1045",
    userId: "U-10491", // Naomi Sato — waiting on the candidate
    exam: "NATE Ready To Work",
    grade: "9.0",
    submittedAt: "November 6th, 2025, 3:40 PM",
    kind: "id-reupload",
    status: "id-requested",
    idConfidence: 74,
    idType: "US State ID",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1042",
    userId: "U-10089", // Priya Venkatesan — priya.v@outlook.com
    exam: "EPA 608 Type 2 Certificate",
    grade: "9.5",
    submittedAt: "November 5th, 2025, 2:30 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 96,
    idType: "US Driver's License",
    idDetectedName: "Priya V",
    webcamFlaggedCount: 1,
    frames: makeFrames(24, [{ at: 12, reason: "Looking Away" }]),
  },
  {
    id: "PR-1041",
    userId: "U-10203", // Jordan Whitfield — j.whitfield@gmail.com
    exam: "EPA 608 Universal Certificate",
    grade: "9.5",
    submittedAt: "November 5th, 2025, 2:30 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 99,
    idType: "US Passport",
    idPreviouslyVerified: { at: "June 23rd, 2026, 10:15 AM", by: "Maxwell Wesonga" },
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1040",
    userId: "U-10412", // Hana Yamamoto — hana.y@gmail.com
    exam: "NATE Ready To Work",
    grade: "9.2",
    submittedAt: "October 22nd, 2025, 11:15 AM",
    kind: "id-review",
    status: "pending",
    idConfidence: 92,
    idType: "US Driver's License",
    webcamFlaggedCount: 4,
    frames: makeFrames(24, [
      { at: 3, reason: "Looking Away" },
      { at: 9, reason: "Looking Away" },
      { at: 14, reason: "Face Not Visible" },
      { at: 21, reason: "Looking Away" },
    ]),
    integrityNote:
      "Copying answers from their phone and not complying with the exam rules",
  },
  /* Hana Yamamoto's two prior rejected attempts — these drive the Integrity
     Note's expanded "Rejected Attempts" list on her pending submission above. */
  {
    id: "PR-0977",
    userId: "U-10412",
    exam: "EPA 608 Universal Certificate",
    grade: "6.1",
    submittedAt: "June 23rd, 2026, 9:05 AM",
    kind: "proctoring",
    status: "rejected",
    idConfidence: 71,
    idType: "US Driver's License",
    webcamFlaggedCount: 5,
    frames: makeFrames(24, [
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
    exam: "EPA 608 Type 2 Certificate",
    grade: "5.4",
    submittedAt: "May 1st, 2026, 4:20 PM",
    kind: "proctoring",
    status: "rejected",
    idConfidence: 68,
    idType: "US Driver's License",
    webcamFlaggedCount: 7,
    frames: makeFrames(24, [
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
    exam: "EPA 608 Type 1 Certificate",
    grade: "8.9",
    submittedAt: "September 15th, 2025, 12:40 PM",
    kind: "id-review",
    status: "pending",
    idConfidence: 98,
    idType: "US Driver's License",
    webcamFlaggedCount: 2,
    frames: makeFrames(24, [
      { at: 1, reason: "Looking Away" },
      { at: 4, reason: "Looking Away" },
      { at: 11, reason: "Face Not Visible" },
      { at: 16, reason: "Looking Away" },
      { at: 23, reason: "Face Not Visible" },
    ]),
  },
  {
    id: "PR-1038",
    userId: "U-10132", // Diego Ramirez — diego.ramirez@arscooling.com
    exam: "EPA 608 Type 2 Certificate",
    grade: "9.5",
    submittedAt: "November 10th, 2024, 2:30 PM",
    kind: "proctoring",
    status: "accepted",
    idConfidence: 95,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1037",
    userId: "U-10618", // Felix Becker — felix.becker@harborcitymech.com
    exam: "EPA 609 Certificate",
    grade: "8.3",
    submittedAt: "January 22nd, 2024, 10:15 AM",
    kind: "id-reupload",
    status: "id-requested",
    idConfidence: 64,
    idType: "US State ID",
    webcamFlaggedCount: 1,
    frames: makeFrames(24, [{ at: 7, reason: "Looking Away" }]),
  },
  {
    /* A re-upload still waiting on the candidate ("Requested") whose exam WAS
       proctored — so the review page shows its footage alongside the ID. Pairs
       with PR-1043 below, the same case in the "To Review" state. */
    id: "PR-1044",
    userId: "U-10537", // Ezekiel Adeoye — z.adeoye@deltaelectrical.com
    exam: "EPA 608 Universal Certificate",
    grade: "8.6",
    submittedAt: "February 2nd, 2026, 4:20 PM",
    kind: "id-reupload",
    status: "id-requested",
    idConfidence: 58,
    idType: "US State ID",
    webcamFlaggedCount: 2,
    frames: makeFrames(24, [
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
    exam: "EPA 608 Type 2 Certificate",
    grade: "8.8",
    submittedAt: "March 3rd, 2026, 9:05 AM",
    kind: "id-reupload",
    status: "pending",
    idConfidence: 88,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1036",
    userId: "U-10692", // Samuel Okafor — sam.okafor@greenshieldsolar.com
    exam: "EPA 608 Type 3 Certificate",
    grade: "9.0",
    submittedAt: "April 5th, 2025, 3:45 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 97,
    idType: "US Driver's License",
    idPreviouslyVerified: { at: "January 14th, 2025, 4:40 PM", by: "Priyanka Rao" },
    webcamFlaggedCount: 1,
    frames: makeFrames(24, [{ at: 6, reason: "Looking Away" }]),
  },
  {
    id: "PR-1035",
    userId: "U-10584", // Mira Singh — mira.singh@yahoo.com
    exam: "EPA 608 Universal Certificate",
    grade: "7.8",
    submittedAt: "June 30th, 2025, 1:00 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 88,
    idType: "US Driver's License",
    webcamFlaggedCount: 6,
    frames: makeFrames(24, [
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
    exam: "NATE Ready To Work",
    grade: "9.2",
    submittedAt: "February 18th, 2026, 11:20 AM",
    kind: "id-review",
    status: "pending",
    idConfidence: 91,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1033",
    userId: "U-10814", // Grace Liu — grace.liu@gmail.com
    exam: "EPA 608 Type 3 Certificate",
    grade: "8.7",
    submittedAt: "March 12th, 2024, 4:00 PM",
    kind: "proctoring",
    status: "accepted",
    idConfidence: 94,
    idType: "US Passport",
    webcamFlaggedCount: 0,
    frames: makeFrames(24, []),
  },
];

export const submissions: Submission[] = seedRows.map((r) => ({
  ...candidateOf(r.userId),
  ...idDocOf(r.userId, r.idType),
  id: r.id,
  exam: r.exam,
  examShort: EXAM_SHORT[r.exam] ?? r.exam,
  grade: r.grade,
  submittedAt: r.submittedAt,
  kind: r.kind,
  status: r.status,
  idConfidence: r.idConfidence,
  idType: r.idType,
  idDetectedName: r.idDetectedName,
  idPreviouslyVerified: r.idPreviouslyVerified,
  webcamFlaggedCount: r.webcamFlaggedCount,
  webcamTotal: 180,
  frames: r.frames,
  integrityNote: r.integrityNote,
  rejectionReasons: r.rejectionReasons,
}));

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

/** Where an ID re-upload sits, derived from the row's own state rather than a
 *  separate field: `id-requested` means an admin asked and the candidate hasn't
 *  sent it back yet; a `pending` re-upload has been sent back and is waiting on
 *  an admin. Only the ID Re-uploads tab surfaces this. */
export type ReuploadStatus = "Requested" | "To Review";

export function reuploadStatusOf(s: Submission): ReuploadStatus {
  return s.status === "id-requested" ? "Requested" : "To Review";
}

/** Whether webcam footage was captured for a submission.
 *
 *  Keyed on the EXAM, not on `kind`: the camera runs during a proctored exam,
 *  so the footage exists for the whole life of that submission — including
 *  after it moves to the ID Re-uploads queue because the ID needed re-sending.
 *  Only exams in ID_ONLY_EXAMS never have any. */
export function hasProctoringFootage(s: Submission): boolean {
  return (PROCTORED_EXAMS as readonly string[]).includes(s.exam);
}
