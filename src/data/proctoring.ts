export type ProctoringKind = "proctoring" | "id-review" | "id-reupload";

export type ProctoringStatus = "pending" | "accepted" | "rejected" | "id-requested";

export type FlagReason = "Looking Away" | "Face Not Visible" | "Multiple Faces" | "No Face";

export type FrameTone = "neutral" | "side" | "dark";

export type WebcamFrame = {
  tone: FrameTone;
  flag?: FlagReason;
};

export type Submission = {
  id: string;
  candidateName: string;
  candidateEmail: string;
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
  webcamFlaggedCount: number;
  webcamTotal: number;
  frames: WebcamFrame[];
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

export const submissions: Submission[] = [
  {
    id: "PR-1042",
    candidateName: "Jessica R Tan",
    candidateEmail: "jtan@skillcatapp.com",
    exam: "EPA 608 Type 2 Certificate",
    examShort: "EPA 608 Type 2",
    grade: "9.5",
    submittedAt: "November 5th, 2025, 2:30 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 96,
    idType: "US Driver's License",
    idDetectedName: "Jessica Tan",
    webcamFlaggedCount: 1,
    webcamTotal: 180,
    frames: makeFrames(24, [{ at: 12, reason: "Looking Away" }]),
  },
  {
    id: "PR-1041",
    candidateName: "Eshwar D",
    candidateEmail: "eshwar@skillcatapp.com",
    exam: "EPA 608 Universal Certificate",
    examShort: "EPA 608 Universal",
    grade: "9.5",
    submittedAt: "November 5th, 2025, 2:30 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 99,
    idType: "US Passport",
    webcamFlaggedCount: 0,
    webcamTotal: 180,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1040",
    candidateName: "Michael Lee",
    candidateEmail: "mlee@skillcatapp.com",
    exam: "NATE Ready To Work",
    examShort: "NATE Ready To Work",
    grade: "9.2",
    submittedAt: "October 22nd, 2025, 11:15 AM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 92,
    idType: "US Driver's License",
    webcamFlaggedCount: 4,
    webcamTotal: 180,
    frames: makeFrames(24, [
      { at: 3, reason: "Looking Away" },
      { at: 9, reason: "Looking Away" },
      { at: 14, reason: "Face Not Visible" },
      { at: 21, reason: "Looking Away" },
    ]),
  },
  {
    id: "PR-1039",
    candidateName: "Amanda Rodriguez",
    candidateEmail: "arodriguez@skillcatapp.com",
    exam: "EPA 608 Universal Certificate",
    examShort: "EPA 608 Universal",
    grade: "8.9",
    submittedAt: "September 15th, 2025, 12:40 PM",
    kind: "id-review",
    status: "pending",
    idConfidence: 98,
    idType: "US Driver's License",
    webcamFlaggedCount: 2,
    webcamTotal: 180,
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
    candidateName: "James Smith",
    candidateEmail: "jsmith@skillcatapp.com",
    exam: "EPA 608 Type 2 Certificate",
    examShort: "EPA 608 Type 2",
    grade: "9.5",
    submittedAt: "November 10th, 2024, 2:30 PM",
    kind: "proctoring",
    status: "accepted",
    idConfidence: 95,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    webcamTotal: 180,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1037",
    candidateName: "Lisa Chang",
    candidateEmail: "lchang@skillcatapp.com",
    exam: "EPA 609 Certificate",
    examShort: "EPA 609",
    grade: "8.3",
    submittedAt: "January 22nd, 2024, 10:15 AM",
    kind: "id-reupload",
    status: "id-requested",
    idConfidence: 64,
    idType: "US State ID",
    webcamFlaggedCount: 1,
    webcamTotal: 180,
    frames: makeFrames(24, [{ at: 7, reason: "Looking Away" }]),
  },
  {
    id: "PR-1036",
    candidateName: "Michael Johnson",
    candidateEmail: "mjohnson@skillcatapp.com",
    exam: "Certified Plumbing Technician",
    examShort: "Plumbing Tech",
    grade: "9.0",
    submittedAt: "April 5th, 2025, 3:45 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 97,
    idType: "US Driver's License",
    webcamFlaggedCount: 1,
    webcamTotal: 180,
    frames: makeFrames(24, [{ at: 6, reason: "Looking Away" }]),
  },
  {
    id: "PR-1035",
    candidateName: "Sarah Lee",
    candidateEmail: "slee@skillcatapp.com",
    exam: "Welding Certification",
    examShort: "Welding",
    grade: "7.8",
    submittedAt: "June 30th, 2025, 1:00 PM",
    kind: "proctoring",
    status: "pending",
    idConfidence: 88,
    idType: "US Driver's License",
    webcamFlaggedCount: 6,
    webcamTotal: 180,
    frames: makeFrames(24, [
      { at: 2, reason: "Looking Away" },
      { at: 5, reason: "Looking Away" },
      { at: 9, reason: "Face Not Visible" },
      { at: 13, reason: "Looking Away" },
      { at: 17, reason: "Looking Away" },
      { at: 22, reason: "Face Not Visible" },
    ]),
  },
  {
    id: "PR-1034",
    candidateName: "David Brown",
    candidateEmail: "dbrown@skillcatapp.com",
    exam: "OSHA Safety Certification",
    examShort: "OSHA",
    grade: "9.2",
    submittedAt: "February 18th, 2026, 11:20 AM",
    kind: "id-review",
    status: "pending",
    idConfidence: 91,
    idType: "US Driver's License",
    webcamFlaggedCount: 0,
    webcamTotal: 180,
    frames: makeFrames(24, []),
  },
  {
    id: "PR-1033",
    candidateName: "Emily White",
    candidateEmail: "ewhite@skillcatapp.com",
    exam: "Project Management Professional",
    examShort: "PMP",
    grade: "8.7",
    submittedAt: "March 12th, 2024, 4:00 PM",
    kind: "proctoring",
    status: "accepted",
    idConfidence: 94,
    idType: "US Passport",
    webcamFlaggedCount: 0,
    webcamTotal: 180,
    frames: makeFrames(24, []),
  },
];

export const ALL_EXAMS: string[] = Array.from(
  new Set(submissions.map((s) => s.exam))
).sort();
