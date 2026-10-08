import { useSyncExternalStore } from "react";
import { CERT_BY_USEDIN, getLiveCerts, type Certification } from "./certifications";
import { certIndustryText } from "./industries";

/** "ID Upload" is the one Task learners upload their government ID through.
 *  It isn't authored in the Task wizard (no Create Task entry, no edits) and
 *  exists to gate exams through Access Restrictions. */
export type TaskType = "xAPI" | "Quiz" | "Hands-On Task" | "Resource" | "ID Upload";

/** One Section of a sectioned Quiz Task (EPA/NATE-style exams). Present only
 * on Quiz Tasks split into Sections; how they are graded is
 * {@link Task.quizGrading}. Editing such a Task opens the wizard pre-loaded
 * with these Sections. */
export type TaskQuizSection = {
  name: string;
  nameEs: string;
  /** Number of questions drawn for the Section each attempt. */
  questionCount: number;
  /** Passing grade for the Section, as a percentage (0–100). */
  passingPct: number;
  /** Whether the Section must be cleared for the Quiz to count as passed. */
  requiredToPass: boolean;
};

/** How a Hands-On Task is scored.
 *
 *  A reviewer grades the submission out of 10 — the one scale the Hands-On
 *  wizard offers — and `passScore` is the Task's Passing Grade (1–10, set in
 *  the wizard's Completion Criteria): the lowest score that passes.
 *
 *  `graded: false` is a Task that needs no judgement at all — a
 *  tool-inventory photo. It completes the moment it is submitted and carries no
 *  grade, so the Grade column stays empty for it. */
export type HandsOnGrading =
  | { graded: true; maxScore: number; passScore: number }
  | { graded: false };

/** A file uploaded to a Task — one Reference File of a Hands-On Task. */
export type TaskFile = {
  id: string;
  name: string;
  size: number;
  ext: string;
  /** Blob URL of the picked file, so its row can download it. */
  url?: string;
};

/** What a Hands-On Task's wizard authors beyond the shared Task fields: the
 *  reference material learners get, the submission form they fill in, and
 *  how often they may submit. Scoring is `handsOn`; audience is `tags`.
 *  Bilingual text keeps both halves; Spanish falls back to English. */
export type HandsOnSetup = {
  toolsEn: string;
  toolsEs: string;
  instructionsEn: string;
  instructionsEs: string;
  checklistEn: string;
  checklistEs: string;
  filesEn: TaskFile[];
  filesEs: TaskFile[];
  /** Character Limit for Supporting Text — 0 allows no text. */
  supportingTextLimit: number;
  /** Media Files maximum — 0 allows no media. */
  mediaMax: number;
  mediaTypes: { images: boolean; videos: boolean; audio: boolean };
  /** Maximum Attempts — null is unlimited. */
  maxAttempts: number | null;
};

export type Task = {
  id: string;
  name: string;
  type: TaskType;
  usedIn: string[];
  createdBy: string;
  discoverable?: boolean;
  hidden?: boolean;
  /** True when this Task is the certifying final exam for its certification. */
  finalExam?: boolean;
  /** True when the Task needs a paid subscription — i.e. it is NOT available
   * during the Free Trial. Defaults to true for new Tasks. */
  requiresSubscription?: boolean;
  /** True when the Task sits in an Access Restriction chain (a prerequisite gate
   * for another Task/Certification). Such Tasks can't be hidden until removed
   * from the chain. */
  accessRestricted?: boolean;
  /** Quiz only: Proctoring is "Yes: Proctoring Required" — attempts are
   *  recorded on webcam and reviewed on Exam Reviews (see
   *  `isReviewedQuiz` in data/proctoring.ts). */
  proctoring?: boolean;
  /** True when a paywall is defined on the Task. Only Quiz Tasks support a
   * paywall — see {@link canHavePaywall}. */
  paywall?: boolean;
  /** Hands-On scoring — see {@link HandsOnGrading}. Read it through
   * {@link handsOnGrading}, which fills in the default scale. */
  handsOn?: HandsOnGrading;
  /** Hands-On authoring — see {@link HandsOnSetup}. Absent on seed Tasks,
   *  which open on the wizard's defaults. */
  handsOnSetup?: HandsOnSetup;
  /** The Quiz's Sections. When set, the Quiz uses the sectioned structure;
   *  whether they are graded one by one is {@link quizGrading}. */
  quizSections?: TaskQuizSection[];
  /** How a Quiz is scored: one overall pass mark (`quiz_level`), or each
   *  Section against its own (`section_level`, sectioned Quizzes only). Read
   *  it through {@link quizGradingOf}, which fills in the default. */
  quizGrading?: { model: "quiz_level" | "section_level"; passPct: number };
  /** Maximum Attempts on a Quiz — null is unlimited. */
  maxAttempts?: number | null;
  /** A paid Quiz's pricing shape: one price for every attempt, or a price per
   *  numbered attempt (`paywallAttempts` of them) then one for all later ones. */
  paywallMode?: "common" | "per_attempt";
  paywallAttempts?: number;
  /** xAPI: the package reports a score the Task keeps. */
  scoreCapture?: boolean;
  /** Completion Criteria is "No Completion Tracking" — the Task is never
   *  marked complete, so nothing can wait on it (auto-unlock triggers). */
  noCompletionTracking?: boolean;
  /** Every field the Task wizard authored for this Task's type, as the wizard
   *  holds them — what reopening the Task loads. Opaque outside the wizard;
   *  the typed fields above are the parts the rest of the app reads. */
  wizardConfig?: Record<string, unknown>;
  /** Spanish halves of Name and Description — blank falls back to English. */
  nameEs?: string;
  description?: string;
  descriptionEs?: string;
  updated?: string;
  visibility?: string;
  tags?: string[];
  timeToComplete?: string;
  submissions?: string;
  requirements?: string;
  skills?: { icon: string; name: string }[];
  dateCreated?: string;
  dateModified?: string;
};

const T = (
  id: string,
  name: string,
  type: TaskType,
  usedIn: string[],
  createdBy: string,
  tags: string[],
  dateCreated: string,
  dateModified: string,
  extra: Partial<Task> = {},
): Task => ({ id, name, type, usedIn, createdBy, tags, dateCreated, dateModified, ...extra });

export const tasks: Task[] = [
  /* The ID Upload Task: learners upload a government ID here before the exams
     it gates (see ACCESS_CHAINS). Seeded, never edited. */
  T("T-0234", "Government ID Upload", "ID Upload",
    ["EPA 608 Type I", "EPA 608 Type II", "EPA 608 Type III", "EPA 608 Universal", "NATE RTW", "EPA 609"],
    "SkillCat", [], "Sep 11, 2023", "Mar 30, 2026", { requiresSubscription: false }),
  T("T-2104", "Tool Inventory Photo", "Hands-On Task", [], "SkillCat", [], "Apr 25, 2026", "Apr 25, 2026", { hidden: true }),
  T("T-1876", "EPA Certification Lookup", "Resource", ["EPA 608 Type I"], "SkillCat", [], "Feb 21, 2024", "Apr 03, 2026", { hidden: true }),
  T("T-1654", "HVAC Field Tools Walkthrough", "xAPI",
    ["HVAC JobReady", "EPA 608 Type I", "EPA 608 Type II", "NATE RTW", "Safety Bundle"],
    "SkillCat", [], "Jan 28, 2024", "Apr 19, 2026"),
  T("T-1543", "Refrigerant Pressure Chart", "Resource", ["EPA 608 Type I", "EPA 608 Type II"], "SkillCat", [], "Dec 02, 2023", "Mar 14, 2026", { hidden: true }),
  T("T-1432", "Field Visit – Brazing Joints", "Hands-On Task", ["HVAC JobReady", "EPA 608 Type II"], "SkillCat",
    ["HVAC", "Field", "Brazing"], "Apr 09, 2024", "Apr 28, 2026", {
      description: "Practical brazing skill assessment. Technicians document at least one brazed joint completed in the field, with photos and reflection on quality control measures.",
      updated: "2 days ago by Jordan Patel",
      visibility: "Visible · published",
      timeToComplete: "~45 minutes",
      submissions: "312 attempts · 89% pass rate",
      requirements: "Project Title (required, 60 char) · Project Description (required, 500 char) · up to 5 images or videos. Reviewed manually with a 7/10 passing score.",
      skills: [{ icon: "🟨", name: "Soldering & Brazing" }],
    }),
  /* EPA 609 (MVAC) — the certification's four tasks. Its final exam is what the
     Proctoring queue's "EPA 609 Certificate" submissions are attempts at. */
  T("T-1407", "EPA 609 Final Exam", "Quiz", ["EPA 609"], "SkillCat", [], "Mar 06, 2024", "Apr 22, 2026", { finalExam: true }),
  T("T-1385", "MVAC Refrigerant Handling", "xAPI", ["EPA 609"], "SkillCat", [], "Mar 08, 2024", "Apr 10, 2026"),
  T("T-1362", "Automotive A/C Recovery", "Hands-On Task", ["EPA 609"], "SkillCat", ["HVAC", "Refrigerant"], "Mar 12, 2024", "Apr 16, 2026"),
  T("T-1344", "R-1234yf Safety Overview", "Resource", ["EPA 609"], "SkillCat", [], "Mar 15, 2024", "Mar 30, 2026", { hidden: true }),
  /* NATE Ready-to-Work: six Sections, one overall 70% pass mark — the
     Sections group the questions, they aren't passed one by one. Paid per
     attempt: the first two attempts have their own price, then one for the rest. */
  T("T-1289", "NATE RTW Final Exam", "Quiz", ["NATE RTW"], "SkillCat", [], "Mar 06, 2024", "Apr 25, 2026", {
    finalExam: true,
    paywall: true,
    paywallMode: "per_attempt",
    paywallAttempts: 2,
    maxAttempts: 3,
    quizGrading: { model: "quiz_level", passPct: 70 },
    quizSections: [
      { name: "Safety", nameEs: "Seguridad", questionCount: 10, passingPct: 70, requiredToPass: false },
      { name: "Tools", nameEs: "Herramientas", questionCount: 10, passingPct: 70, requiredToPass: false },
      { name: "Basic Construction", nameEs: "Construcción básica", questionCount: 10, passingPct: 70, requiredToPass: false },
      { name: "Basic Science", nameEs: "Ciencia básica", questionCount: 10, passingPct: 70, requiredToPass: false },
      { name: "Basic Electrical", nameEs: "Electricidad básica", questionCount: 10, passingPct: 70, requiredToPass: false },
      { name: "Heating & Cooling Fundamentals", nameEs: "Fundamentos de calefacción y refrigeración", questionCount: 10, passingPct: 70, requiredToPass: false },
    ],
  }),
  T("T-1156", "EPA 608 Type I Final Exam", "Quiz", ["EPA 608 Type I"], "SkillCat", [], "Feb 02, 2024", "Apr 18, 2026", { finalExam: true }),
  T("T-1149", "EPA 608 Type II Final Exam", "Quiz", ["EPA 608 Type II"], "SkillCat", [], "Feb 02, 2024", "Apr 18, 2026", { finalExam: true, proctoring: true }),
  T("T-1142", "EPA 608 Type III Final Exam", "Quiz", ["EPA 608 Type III"], "SkillCat", [], "Feb 02, 2024", "Apr 18, 2026", { finalExam: true, proctoring: true }),
  T("T-1135", "Building Science Principles Final Exam", "Quiz", ["Building Science Principles"], "SkillCat", [], "Jan 29, 2024", "Apr 08, 2026", { finalExam: true }),
  T("T-1198", "EPA 608 Universal Final Exam", "Quiz", ["EPA 608 Universal"], "SkillCat", [], "Feb 14, 2024", "Apr 20, 2026", {
    finalExam: true,
    proctoring: true,
    quizGrading: { model: "section_level", passPct: 70 },
    timeToComplete: "~90 minutes",
    submissions: "874 attempts · 71% pass rate",
    quizSections: [
      { name: "Core", nameEs: "Núcleo", questionCount: 25, passingPct: 70, requiredToPass: true },
      { name: "Type I", nameEs: "Tipo I", questionCount: 25, passingPct: 70, requiredToPass: true },
      { name: "Type II", nameEs: "Tipo II", questionCount: 25, passingPct: 70, requiredToPass: true },
      { name: "Type III", nameEs: "Tipo III", questionCount: 25, passingPct: 70, requiredToPass: true },
    ],
  }),
  T("T-1042", "EPA 608 Core – Refrigerant Recovery", "xAPI",
    ["EPA 608 Type I", "EPA 608 Type II", "EPA 608 Type III", "EPA 608 Universal"],
    "SkillCat", [], "Jan 14, 2024", "Apr 22, 2026"),
  T("T-0987", "OSHA 10 Safety Course", "xAPI", ["Safety Bundle", "OSHA 10", "OSHA 30"], "SkillCat", [], "Nov 18, 2023", "Apr 12, 2026"),

  T("T-2391", "Compressor Diagnostics Module", "xAPI", ["EPA 608 Type II", "HVAC JobReady"], "HVACR", [], "Jan 09, 2025", "Apr 02, 2026"),
  T("T-2350", "Refrigerant Charging Procedure", "Hands-On Task", ["EPA 608 Type I", "EPA 608 Universal"], "SkillCat", ["Residential HVAC"], "Feb 11, 2025", "Apr 15, 2026"),
  T("T-2287", "Heat Pump Troubleshooting", "xAPI", ["HVAC JobReady", "Building Science Principles"], "ARS", [], "Mar 02, 2025", "Apr 18, 2026"),
  T("T-2244", "Gas Furnace Safety Check", "Hands-On Task", ["EPA 608 Type II", "Safety Bundle"], "NexTech", [], "Mar 12, 2025", "Apr 09, 2026"),
  T("T-2199", "Ductwork Installation Guide", "Resource", ["HVAC JobReady"], "Premium HVAC Services", [], "Mar 18, 2025", "Apr 06, 2026"),
  T("T-2165", "Thermostat Wiring Lab", "Hands-On Task", ["HVAC JobReady", "EPA 608 Type I"], "SkillCat", ["Residential HVAC"], "Mar 22, 2025", "Apr 11, 2026"),
  T("T-2132", "Capacitor Replacement Walkthrough", "xAPI", ["EPA 608 Type II"], "HVACR", [], "Apr 01, 2025", "Apr 21, 2026"),
  T("T-2098", "Coil Cleaning Procedure", "Hands-On Task", ["HVAC JobReady"], "ARS", [], "Apr 04, 2025", "Apr 14, 2026"),
  T("T-2061", "Airflow Calibration Quiz", "Quiz", ["HVAC JobReady"], "SkillCat", [], "Apr 10, 2025", "Apr 24, 2026", { paywall: true }),
  T("T-2024", "Electrical Panel Lab", "Hands-On Task", ["Safety Bundle", "OSHA 30"], "NexTech", [], "Apr 12, 2025", "Apr 16, 2026"),

  T("T-1989", "Indoor Air Quality Test", "xAPI", ["HVAC JobReady"], "SkillCat", [], "May 02, 2025", "Apr 07, 2026"),
  T("T-1955", "Combustion Analysis", "Quiz", ["EPA 608 Type II"], "HVACR", [], "May 14, 2025", "Apr 02, 2026"),
  T("T-1922", "Boiler Inspection Checklist", "Resource", ["EPA 608 Universal"], "Premium HVAC Services", [], "Jun 03, 2025", "Mar 28, 2026"),
  T("T-1888", "Mini-Split Install Guide", "xAPI", ["HVAC JobReady"], "ARS", [], "Jun 12, 2025", "Apr 17, 2026"),
  T("T-1855", "Recovery Machine Setup", "Hands-On Task", ["EPA 608 Type I", "EPA 608 Universal"], "SkillCat", [], "Jun 25, 2025", "Apr 19, 2026"),
  T("T-1821", "Vacuum Pump Operation", "Hands-On Task", ["EPA 608 Type I"], "HVACR", [], "Jul 02, 2025", "Apr 03, 2026"),
  T("T-1788", "Manifold Gauge Use", "Quiz", ["EPA 608 Type I", "EPA 608 Type II"], "SkillCat", [], "Jul 14, 2025", "Apr 05, 2026", { paywall: true }),
  T("T-1755", "Pressure Test Module", "xAPI", ["EPA 608 Type II"], "NexTech", [], "Jul 22, 2025", "Apr 12, 2026"),
  T("T-1722", "Subcooling Calculation Quiz", "Quiz", ["EPA 608 Type I"], "SkillCat", [], "Aug 04, 2025", "Apr 14, 2026"),
  T("T-1689", "Superheat Reading Lab", "Hands-On Task", ["EPA 608 Type I"], "ARS", [], "Aug 12, 2025", "Apr 18, 2026"),

  T("T-1655", "VRF System Overview", "xAPI", ["HVAC JobReady"], "Premium HVAC Services", [], "Aug 25, 2025", "Apr 22, 2026"),
  T("T-1621", "Chiller Maintenance Module", "Resource", ["HVAC JobReady"], "HVACR", [], "Sep 01, 2025", "Apr 09, 2026"),
  T("T-1588", "Cooling Tower Basics", "xAPI", ["HVAC JobReady"], "Premium HVAC Services", [], "Sep 11, 2025", "Apr 06, 2026"),
  T("T-1555", "PVC Pipe Joining Lab", "Hands-On Task", [], "SkillCat", ["Residential Plumbing"], "Sep 22, 2025", "Apr 11, 2026"),
  T("T-1521", "PEX Tubing Install Walkthrough", "xAPI", [], "ARS", [], "Oct 02, 2025", "Apr 13, 2026"),
  T("T-1488", "Sweat Soldering Lab", "Hands-On Task", [], "SkillCat", ["Residential Plumbing"], "Oct 12, 2025", "Apr 17, 2026"),
  T("T-1455", "Waste Line Layout Quiz", "Quiz", [], "NexTech", [], "Oct 22, 2025", "Apr 21, 2026", { paywall: true }),
  T("T-1421", "Vent Stack Sizing", "Resource", [], "HVACR", [], "Nov 01, 2025", "Apr 04, 2026"),
  T("T-1388", "Backflow Preventer Setup", "Hands-On Task", [], "Premium HVAC Services", [], "Nov 12, 2025", "Apr 08, 2026"),
  T("T-1355", "Water Heater Service", "xAPI", [], "ARS", [], "Nov 22, 2025", "Apr 12, 2026"),

  T("T-1321", "Tankless Heater Lab", "Hands-On Task", [], "SkillCat", ["Residential Plumbing"], "Dec 01, 2025", "Apr 16, 2026"),
  T("T-1288", "Sump Pump Install", "Hands-On Task", [], "NexTech", [], "Dec 10, 2025", "Apr 20, 2026"),
  T("T-1255", "Drain Cleaning Module", "xAPI", [], "Premium HVAC Services", [], "Dec 18, 2025", "Apr 02, 2026"),
  T("T-1221", "Fixture Install Walkthrough", "xAPI", [], "ARS", [], "Jan 04, 2026", "Apr 09, 2026"),
  T("T-1188", "Hose Bibb Replacement", "Hands-On Task", [], "SkillCat", ["Residential Plumbing"], "Jan 12, 2026", "Apr 11, 2026"),
  T("T-1155", "Slab Leak Detection", "xAPI", [], "HVACR", [], "Jan 20, 2026", "Apr 15, 2026"),
  T("T-1121", "Gas Line Pressure Test", "Hands-On Task", ["Safety Bundle"], "Premium HVAC Services", [], "Feb 01, 2026", "Apr 19, 2026"),
  T("T-1088", "Flame Sensor Cleaning", "xAPI", ["HVAC JobReady"], "ARS", [], "Feb 09, 2026", "Apr 23, 2026"),
  T("T-1055", "Igniter Replacement Module", "Hands-On Task", ["HVAC JobReady"], "NexTech", [], "Feb 18, 2026", "Apr 25, 2026"),
  T("T-1021", "Hotel Maintenance Walkthrough", "xAPI", [], "Premium HVAC Services", [], "Feb 26, 2026", "Apr 27, 2026"),
  T("T-0988", "MultiFamily Service Visit", "Hands-On Task", [], "ARS", [], "Mar 06, 2026", "Apr 29, 2026"),
  T("T-0955", "NexStar Onboarding", "Resource", [], "SkillCat", [], "Mar 14, 2026", "Apr 28, 2026"),

  /* The Hands-On Tasks that the review queue draws submissions from — every
     task name in data/reviewSubmissions.ts resolves to one of these, so the
     review screen can open a submission's task in its editor. */
  T("T-2299", "HVAC Install", "Hands-On Task", ["HVAC JobReady"], "SkillCat", ["HVAC", "Field"], "Jan 14, 2026", "Apr 22, 2026"),
  T("T-2240", "Condenser Coil Cleaning", "Hands-On Task", ["HVAC JobReady"], "SkillCat", ["HVAC", "Maintenance"], "Jan 22, 2026", "Apr 18, 2026"),
  T("T-2210", "Ductwork Sealing", "Hands-On Task", ["HVAC JobReady"], "SkillCat", ["HVAC", "Field"], "Jan 29, 2026", "Apr 16, 2026"),
  T("T-2088", "Brazing Copper Lines", "Hands-On Task", ["HVAC JobReady", "EPA 608 Type II"], "SkillCat", ["HVAC", "Brazing"], "Feb 05, 2026", "Apr 20, 2026"),
  T("T-2020", "Electrical Panel Labeling", "Hands-On Task", ["HVAC JobReady"], "SkillCat", ["Electrical", "Safety"], "Feb 11, 2026", "Apr 14, 2026"),
  T("T-1930", "Compressor Replacement", "Hands-On Task", ["HVAC JobReady"], "SkillCat", ["HVAC", "Field"], "Feb 19, 2026", "Apr 21, 2026"),
  T("T-1810", "Vacuum & Evacuation", "Hands-On Task", ["EPA 608 Type I", "EPA 608 Type II"], "SkillCat", ["HVAC", "Refrigerant"], "Feb 27, 2026", "Apr 11, 2026"),
  T("T-1690", "Leak Detection Test", "Hands-On Task", ["EPA 608 Type II"], "SkillCat", ["HVAC", "Refrigerant"], "Mar 04, 2026", "Apr 09, 2026"),
  T("T-1610", "Furnace Ignition Check", "Hands-On Task", ["HVAC JobReady"], "SkillCat", ["HVAC", "Heating"], "Mar 12, 2026", "Apr 07, 2026"),
];

// Only Hands-On Tasks can be discoverable (surfaced in search/browse); every
// other Task type is always non-discoverable. Discoverability is opt-in even for
// Hands-On Tasks — only the ones marked below are discoverable.
// A Task inside a paid Certification is never discoverable (see
// `isDiscoverable`), so none of those are listed — only Tasks in no paid
// Certification can be.
const DISCOVERABLE = new Set([
  "T-1555", // PVC Pipe Joining Lab
  "T-1488", // Sweat Soldering Lab
  "T-1321", // Tankless Heater Lab
]);
for (const t of tasks) {
  if (t.discoverable === undefined) {
    t.discoverable = t.type === "Hands-On Task" && DISCOVERABLE.has(t.id);
  }
}

// Hands-On scoring, per Task. Every graded Task is out of 10 (the wizard's
// "Maximum Grade: 10"); its Passing Grade is set by the author, so it varies —
// a quick photo check passes at 5, a safety-critical procedure at 8. Anything
// not listed uses DEFAULT_HANDS_ON (passing at 6), and the UNGRADED set is the
// other end: Tasks that are simply evidence, passed the moment they're
// submitted, with no score at all.
export const HANDS_ON_MAX_SCORE = 10;
const DEFAULT_HANDS_ON = { graded: true, maxScore: HANDS_ON_MAX_SCORE, passScore: 6 } as const;

const UNGRADED = new Set([
  "T-2104", // Tool Inventory Photo
  "T-2020", // Electrical Panel Labeling — a labelled-panel photo, not scored
  "T-0988", // MultiFamily Service Visit — a visit log, not an assessment
]);

const PASSING_GRADES: Record<string, number> = {
  // SkillCat's own library
  "T-2299": 7, // HVAC Install
  "T-2350": 8, // Refrigerant Charging Procedure — full rubric
  "T-2165": 6, // Thermostat Wiring Lab
  "T-1855": 8, // Recovery Machine Setup
  "T-2240": 5, // Condenser Coil Cleaning
  "T-2210": 5, // Ductwork Sealing
  "T-2088": 7, // Brazing Copper Lines
  "T-1930": 8, // Compressor Replacement
  "T-1810": 7, // Vacuum & Evacuation
  "T-1690": 6, // Leak Detection Test
  "T-1610": 6, // Furnace Ignition Check
  "T-1432": 7, // Field Visit – Brazing Joints (its own copy says 7/10)
  "T-1362": 7, // Automotive A/C Recovery — EPA 609 field eval
  "T-1555": 5, // PVC Pipe Joining Lab
  "T-1488": 6, // Sweat Soldering Lab
  "T-1321": 6, // Tankless Heater Lab
  "T-1188": 5, // Hose Bibb Replacement — quick check
  // Company-created
  "T-2098": 6, // Coil Cleaning Procedure
  "T-2244": 8, // Gas Furnace Safety Check — safety-critical
  "T-1821": 5, // Vacuum Pump Operation
  "T-1689": 6, // Superheat Reading Lab
  "T-2024": 7, // Electrical Panel Lab
  "T-1055": 6, // Igniter Replacement Module
  "T-1121": 8, // Gas Line Pressure Test — safety-critical
  "T-1388": 6, // Backflow Preventer Setup
  "T-1288": 5, // Sump Pump Install
};

for (const t of tasks) {
  if (t.type !== "Hands-On Task" || t.handsOn !== undefined) continue;
  t.handsOn = UNGRADED.has(t.id)
    ? { graded: false }
    : { ...DEFAULT_HANDS_ON, passScore: PASSING_GRADES[t.id] ?? DEFAULT_HANDS_ON.passScore };
}

/** A Hands-On Task's scoring, with the default scale filled in. `null` for
 *  every other Task type — nothing else is reviewer-graded. */
export function handsOnGrading(t: Pick<Task, "type" | "handsOn">): HandsOnGrading | null {
  if (t.type !== "Hands-On Task") return null;
  return t.handsOn ?? { ...DEFAULT_HANDS_ON };
}

/** The Passing Grade a reviewer's score is held to (1–10). An ungraded or
 *  unknown Task falls back to the default, so a stray submission against one
 *  still has a threshold. */
export function handsOnPassScore(t: Pick<Task, "type" | "handsOn"> | undefined): number {
  const g = t ? handsOnGrading(t) : null;
  return g?.graded ? g.passScore : DEFAULT_HANDS_ON.passScore;
}

// Tasks available during the Free Trial. Everything else needs a paid
// subscription, so `requiresSubscription` defaults to true.
const FREE_TRIAL = new Set([
  "T-2350", // Refrigerant Charging Procedure
  "T-2165", // Thermostat Wiring Lab
  "T-1855", // Recovery Machine Setup
  "T-1689", // Superheat Reading Lab
  "T-1555", // PVC Pipe Joining Lab
  "T-1488", // Sweat Soldering Lab
]);
for (const t of tasks) {
  if (t.requiresSubscription === undefined) t.requiresSubscription = !FREE_TRIAL.has(t.id);
}

/* Access Restriction chains: a gating Task a learner must complete before the
   Tasks it gates unlock. Both ends of a chain refuse Hide and Delete — hiding
   the gate strands the exams behind it, and hiding a gated exam breaks the
   chain's promise — until the Task is taken out of the chain. */
export type AccessChain = { gateId: string; gatedIds: string[] };
/** The seeded Government ID Upload Task. */
export const ID_UPLOAD_TASK_ID = "T-0234";

/** The reason an Access Restriction Task can't be hidden or deleted — shown
 *  under the disabled menu rows. */
export const ACCESS_CHAIN_REASON =
  "This Task is part of an Access Restriction chain. Remove it from the chain first.";

/** An ID Upload Task: not editable, never hidden or deleted. */
export function isIdUpload(t: Pick<Task, "type">): boolean {
  return t.type === "ID Upload";
}
export const ACCESS_CHAINS: AccessChain[] = [
  // The ID Upload Task gates every certifying exam.
  { gateId: ID_UPLOAD_TASK_ID, gatedIds: ["T-1156", "T-1149", "T-1142", "T-1198", "T-1289", "T-1407"] },
  // EPA 608 Core unlocks every EPA 608 final exam.
  { gateId: "T-1042", gatedIds: ["T-1156", "T-1149", "T-1142", "T-1198"] },
];
const IN_CHAIN = new Set(ACCESS_CHAINS.flatMap((c) => [c.gateId, ...c.gatedIds]));
for (const t of tasks) {
  if (t.accessRestricted === undefined) t.accessRestricted = IN_CHAIN.has(t.id);
}

/** A Task the ID Upload Task gates through a seeded Access Restriction chain. */
export function gatedByIdUpload(t: Pick<Task, "id">): boolean {
  return ACCESS_CHAINS.some((c) => c.gateId === ID_UPLOAD_TASK_ID && c.gatedIds.includes(t.id));
}

/** The chains a Task sits in, as lines a blocked modal can name —
 *  "EPA 608 Core – Refrigerant Recovery → EPA 608 Type I Final Exam, …". */
export function accessChainLines(task: Pick<Task, "id">): string[] {
  const name = (id: string) => getTasks().find((t) => t.id === id)?.name ?? id;
  return ACCESS_CHAINS.filter((c) => c.gateId === task.id || c.gatedIds.includes(task.id)).map(
    (c) => `${name(c.gateId)} → ${c.gatedIds.map(name).join(", ")}`,
  );
}

/** A Time to Complete ("~45 minutes", "2 hours") as a Task row's short length
 *  — "45 mins", "2 hrs", "1 day". Empty when there is none, or it can't be read,
 *  so the caller can leave the length off entirely. */
export function formatTaskDuration(timeToComplete: string | undefined): string {
  const m = timeToComplete?.match(/(\d+)\s*(minute|hour|day|week|month)/i);
  if (!m) return "";
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const short = unit === "minute" ? "min" : unit === "hour" ? "hr" : unit === "month" ? "mo" : unit;
  return `${n} ${short}${n === 1 ? "" : "s"}`;
}

/** True when the Task sits in a Certification that is paid for. */
export function inPaidCertification(task: Pick<Task, "usedIn">): boolean {
  return task.usedIn.some((u) => !!CERT_BY_USEDIN.get(u)?.payment);
}

/** Whether learners can actually find the Task: only Hands-On Tasks can be
 *  discoverable, and never one inside a paid Certification, whatever its flag. */
export function isDiscoverable(task: Task): boolean {
  return task.type === "Hands-On Task" && !!task.discoverable && !inPaidCertification(task);
}

/** Label used by the Discoverable filter. */
export function discoverableLabel(task: Task): string {
  return isDiscoverable(task) ? "Discoverable" : "Not discoverable";
}

/** Label used by the "Requires Subscription?" filter. */
export function subscriptionLabel(task: Task): string {
  return task.requiresSubscription
    ? "Yes: Requires Subscription"
    : "No: Can Access on Free Trial";
}

/** Only Quiz Tasks can have a paywall defined. */
export function canHavePaywall(task: Task): boolean {
  return task.type === "Quiz";
}

/** True when a paywall is actually in effect on the Task. */
export function isPaid(task: Task): boolean {
  return canHavePaywall(task) && !!task.paywall;
}

/** Whether the Task sits in any of these Certifications, named canonically
 *  (see {@link taskCertifications}) — what the Certifications filters match on. */
export function taskInCertifications(task: TaskCertRef, names: string[]): boolean {
  return taskCertifications(task).some((c) => names.includes(c.name));
}

type TaskCertRef = Pick<Task, "usedIn"> & { id?: string };

/** The Certifications a Task sits in, by their CURRENT name. `usedIn` holds
 *  seed names and aliases such as "NATE RTW" (resolved to the live record, so
 *  a rename shows through), and a Certification built this session counts
 *  when its stored tree holds the Task by id. A deleted Certification drops
 *  out. */
export function taskCertifications(task: TaskCertRef): { name: string; industry?: string }[] {
  const live = getLiveCerts();
  const byId = new Map(live.map((c) => [c.id, c]));
  const out = new Map<string, { name: string; industry?: string }>();
  const add = (c: Certification) =>
    out.set(c.id, { name: c.name, industry: certIndustryText(c.industries) || undefined });
  for (const u of task.usedIn) {
    const seed = CERT_BY_USEDIN.get(u);
    if (seed) {
      const c = byId.get(seed.id);
      if (c) add(c);
      continue;
    }
    const c = live.find((x) => x.name === u);
    if (c) add(c);
    else if (!out.has(u)) out.set(u, { name: u });
  }
  if (task.id) {
    for (const c of live) {
      if (out.has(c.id) || !c.courses) continue;
      const inTree = c.courses.some((co) =>
        co.children.some((ch) =>
          ch.kind === "task" ? ch.task.id === task.id : ch.lesson.tasks.some((t) => t.id === task.id),
        ),
      );
      if (inTree) add(c);
    }
  }
  return [...out.values()];
}

/* ── Quiz grading ── */

/** A Quiz's grading model and overall pass mark. A sectioned seed with no
 *  explicit model grades its Sections one by one; everything else is one
 *  70% mark. */
export function quizGradingOf(
  t: Pick<Task, "quizGrading" | "quizSections">,
): { model: "quiz_level" | "section_level"; passPct: number } {
  if (t.quizGrading) return t.quizGrading;
  return { model: t.quizSections?.length ? "section_level" : "quiz_level", passPct: 70 };
}

/** The single percentage an overall grade has to reach on this Quiz. Under
 *  section-level grading there is no Quiz mark, so an overall grade passes
 *  when it reaches every Must Pass Section's mark (every Section's, when none
 *  is marked Must Pass). */
export function quizPassPct(t: Pick<Task, "quizGrading" | "quizSections">): number {
  const g = quizGradingOf(t);
  if (g.model === "quiz_level" || !t.quizSections?.length) return g.passPct;
  const must = t.quizSections.filter((s) => s.requiredToPass);
  return Math.max(...(must.length ? must : t.quizSections).map((s) => s.passingPct));
}

/** Whether a finished attempt passes this Quiz. `sectionGrades` (one per
 *  Section, in order) decides a section-level Quiz: every Must Pass Section —
 *  or every Section, when none is marked — has to clear its own mark. */
export function quizAttemptPasses(
  t: Pick<Task, "quizGrading" | "quizSections">,
  grade: number,
  sectionGrades?: number[],
): boolean {
  const g = quizGradingOf(t);
  if (g.model === "section_level" && t.quizSections?.length && sectionGrades?.length) {
    const must = t.quizSections.some((s) => s.requiredToPass);
    return t.quizSections.every(
      (s, i) => (must && !s.requiredToPass) || (sectionGrades[i] ?? 0) >= s.passingPct,
    );
  }
  return grade >= quizPassPct(t);
}

/* ── The live Task list ──
   `tasks` above is the seed. The app's working list — seed Tasks with their
   saved edits, Tasks created this session, minus deleted ones — is kept here
   by App, so pages and data builders that aren't handed the list (Quiz
   Attempts, Who Paid, Manage User Progress, the wizard's pickers) read the
   same Tasks the Tasks page shows. */
let live: Task[] = tasks;
const liveListeners = new Set<() => void>();

export function getTasks(): Task[] {
  return live;
}

export function setLiveTasks(next: Task[]) {
  if (next === live) return;
  live = next;
  liveListeners.forEach((l) => l());
}

export function useLiveTasks(): Task[] {
  return useSyncExternalStore(
    (l) => {
      liveListeners.add(l);
      return () => liveListeners.delete(l);
    },
    getTasks,
  );
}

/** The live Task with this id — the seed one when the list doesn't have it. */
export function taskById(id: string): Task | undefined {
  return live.find((t) => t.id === id) ?? tasks.find((t) => t.id === id);
}
