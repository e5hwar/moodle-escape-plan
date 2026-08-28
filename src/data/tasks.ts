export type TaskType = "xAPI" | "Quiz" | "Hands-On Task" | "Resource";

/** A graded Section of a sectioned Quiz Task. Present only on Quiz Tasks that
 * use the sectioned structure with section-level grading (EPA/NATE-style exams).
 * Editing such a Task opens the wizard pre-loaded with these Sections. */
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
  /** True when a paywall is defined on the Task. Only Quiz Tasks support a
   * paywall — see {@link canHavePaywall}. */
  paywall?: boolean;
  /** Section-level Quiz configuration. When set, the Quiz uses the sectioned
   * structure with section-level grading. */
  quizSections?: TaskQuizSection[];
  description?: string;
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
  T("T-2104", "Tool Inventory Photo", "Hands-On Task", [], "SkillCat", [], "Apr 25, 2026", "Apr 25, 2026"),
  T("T-1876", "EPA Certification Lookup", "Resource", ["EPA 608 Type I"], "SkillCat", [], "Feb 21, 2024", "Apr 03, 2026"),
  T("T-1654", "HVAC Field Tools Walkthrough", "xAPI",
    ["HVAC Field Skills", "EPA 608 Type I", "EPA 608 Type II", "NATE RTW", "Safety Bundle"],
    "SkillCat", ["B2B-Only", "HVACR"], "Jan 28, 2024", "Apr 19, 2026"),
  T("T-1543", "Refrigerant Pressure Chart", "Resource", ["EPA 608 Type I", "EPA 608 Type II"], "SkillCat", ["Residential HVAC", "Commercial HVAC"], "Dec 02, 2023", "Mar 14, 2026"),
  T("T-1432", "Field Visit – Brazing Joints", "Hands-On Task", ["HVAC Field Skills", "EPA 608 Type II"], "SkillCat",
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
  T("T-1407", "EPA 609 Final Exam", "Quiz", ["EPA 609"], "SkillCat", ["HVACR"], "Mar 06, 2024", "Apr 22, 2026", { finalExam: true }),
  T("T-1385", "MVAC Refrigerant Handling", "xAPI", ["EPA 609"], "SkillCat", ["HVACR"], "Mar 08, 2024", "Apr 10, 2026"),
  T("T-1362", "Automotive A/C Recovery", "Hands-On Task", ["EPA 609"], "SkillCat", ["HVAC", "Refrigerant"], "Mar 12, 2024", "Apr 16, 2026"),
  T("T-1344", "R-1234yf Safety Overview", "Resource", ["EPA 609"], "SkillCat", [], "Mar 15, 2024", "Mar 30, 2026"),
  T("T-1289", "NATE RTW Final Exam", "Quiz", ["NATE RTW"], "SkillCat", ["B2B-Only", "NexStar", "HVACR", "Commercial HVAC", "Residential HVAC"], "Mar 06, 2024", "Apr 25, 2026", { finalExam: true, paywall: true }),
  T("T-1156", "EPA 608 Type I Final Exam", "Quiz", ["EPA 608 Type I"], "SkillCat", [], "Feb 02, 2024", "Apr 18, 2026", { finalExam: true }),
  T("T-1198", "EPA 608 Universal Final Exam", "Quiz", ["EPA 608 Universal"], "SkillCat", [], "Feb 14, 2024", "Apr 20, 2026", {
    finalExam: true,
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
    "SkillCat", ["Residential HVAC"], "Jan 14, 2024", "Apr 22, 2026"),
  T("T-0987", "OSHA 10 Safety Course", "xAPI", ["Safety Bundle", "OSHA 10", "OSHA 30"], "SkillCat", ["NexStar", "HVACR"], "Nov 18, 2023", "Apr 12, 2026"),
  T("T-0234", "Government ID Upload", "Hands-On Task",
    ["EPA 608 Type I", "EPA 608 Type II", "NATE RTW", "OSHA 10", "OSHA 30", "Safety Bundle"],
    "SkillCat", [], "Sep 11, 2023", "Mar 30, 2026"),

  T("T-2391", "Compressor Diagnostics Module", "xAPI", ["EPA 608 Type II", "HVAC Field Skills"], "HVACR", [], "Jan 09, 2025", "Apr 02, 2026"),
  T("T-2350", "Refrigerant Charging Procedure", "Hands-On Task", ["EPA 608 Type I", "EPA 608 Universal"], "SkillCat", ["Residential HVAC"], "Feb 11, 2025", "Apr 15, 2026"),
  T("T-2287", "Heat Pump Troubleshooting", "xAPI", ["HVAC Field Skills"], "ARS", [], "Mar 02, 2025", "Apr 18, 2026"),
  T("T-2244", "Gas Furnace Safety Check", "Hands-On Task", ["EPA 608 Type II", "Safety Bundle"], "NexTech", [], "Mar 12, 2025", "Apr 09, 2026"),
  T("T-2199", "Ductwork Installation Guide", "Resource", ["HVAC Field Skills"], "Premium HVAC Services", [], "Mar 18, 2025", "Apr 06, 2026"),
  T("T-2165", "Thermostat Wiring Lab", "Hands-On Task", ["HVAC Field Skills", "EPA 608 Type I"], "SkillCat", ["Residential HVAC"], "Mar 22, 2025", "Apr 11, 2026"),
  T("T-2132", "Capacitor Replacement Walkthrough", "xAPI", ["EPA 608 Type II"], "HVACR", [], "Apr 01, 2025", "Apr 21, 2026"),
  T("T-2098", "Coil Cleaning Procedure", "Hands-On Task", ["HVAC Field Skills"], "ARS", [], "Apr 04, 2025", "Apr 14, 2026"),
  T("T-2061", "Airflow Calibration Quiz", "Quiz", ["HVAC Field Skills"], "SkillCat", [], "Apr 10, 2025", "Apr 24, 2026", { paywall: true }),
  T("T-2024", "Electrical Panel Lab", "Hands-On Task", ["Safety Bundle", "OSHA 30"], "NexTech", [], "Apr 12, 2025", "Apr 16, 2026"),

  T("T-1989", "Indoor Air Quality Test", "xAPI", ["HVAC Field Skills"], "SkillCat", ["Residential HVAC"], "May 02, 2025", "Apr 07, 2026"),
  T("T-1955", "Combustion Analysis", "Quiz", ["EPA 608 Type II"], "HVACR", [], "May 14, 2025", "Apr 02, 2026"),
  T("T-1922", "Boiler Inspection Checklist", "Resource", ["EPA 608 Universal"], "Premium HVAC Services", [], "Jun 03, 2025", "Mar 28, 2026"),
  T("T-1888", "Mini-Split Install Guide", "xAPI", ["HVAC Field Skills"], "ARS", [], "Jun 12, 2025", "Apr 17, 2026"),
  T("T-1855", "Recovery Machine Setup", "Hands-On Task", ["EPA 608 Type I", "EPA 608 Universal"], "SkillCat", [], "Jun 25, 2025", "Apr 19, 2026"),
  T("T-1821", "Vacuum Pump Operation", "Hands-On Task", ["EPA 608 Type I"], "HVACR", [], "Jul 02, 2025", "Apr 03, 2026"),
  T("T-1788", "Manifold Gauge Use", "Quiz", ["EPA 608 Type I", "EPA 608 Type II"], "SkillCat", [], "Jul 14, 2025", "Apr 05, 2026", { paywall: true }),
  T("T-1755", "Pressure Test Module", "xAPI", ["EPA 608 Type II"], "NexTech", [], "Jul 22, 2025", "Apr 12, 2026"),
  T("T-1722", "Subcooling Calculation Quiz", "Quiz", ["EPA 608 Type I"], "SkillCat", [], "Aug 04, 2025", "Apr 14, 2026"),
  T("T-1689", "Superheat Reading Lab", "Hands-On Task", ["EPA 608 Type I"], "ARS", [], "Aug 12, 2025", "Apr 18, 2026"),

  T("T-1655", "VRF System Overview", "xAPI", ["HVAC Field Skills"], "Premium HVAC Services", [], "Aug 25, 2025", "Apr 22, 2026"),
  T("T-1621", "Chiller Maintenance Module", "Resource", ["HVAC Field Skills"], "HVACR", [], "Sep 01, 2025", "Apr 09, 2026"),
  T("T-1588", "Cooling Tower Basics", "xAPI", ["HVAC Field Skills"], "Premium HVAC Services", [], "Sep 11, 2025", "Apr 06, 2026"),
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
  T("T-1088", "Flame Sensor Cleaning", "xAPI", ["HVAC Field Skills"], "ARS", [], "Feb 09, 2026", "Apr 23, 2026"),
  T("T-1055", "Igniter Replacement Module", "Hands-On Task", ["HVAC Field Skills"], "NexTech", [], "Feb 18, 2026", "Apr 25, 2026"),
  T("T-1021", "Hotel Maintenance Walkthrough", "xAPI", [], "Premium HVAC Services", [], "Feb 26, 2026", "Apr 27, 2026"),
  T("T-0988", "MultiFamily Service Visit", "Hands-On Task", [], "ARS", [], "Mar 06, 2026", "Apr 29, 2026"),
  T("T-0955", "NexStar Onboarding", "Resource", [], "SkillCat", ["B2B-Only", "NexStar"], "Mar 14, 2026", "Apr 28, 2026"),

  /* The Hands-On Tasks that the review queue draws submissions from — every
     task name in data/reviewSubmissions.ts resolves to one of these, so the
     review screen can open a submission's task in its editor. */
  T("T-2299", "HVAC Install", "Hands-On Task", ["HVAC Field Skills"], "SkillCat", ["HVAC", "Field"], "Jan 14, 2026", "Apr 22, 2026"),
  T("T-2240", "Condenser Coil Cleaning", "Hands-On Task", ["HVAC Field Skills"], "SkillCat", ["HVAC", "Maintenance"], "Jan 22, 2026", "Apr 18, 2026"),
  T("T-2210", "Ductwork Sealing", "Hands-On Task", ["HVAC Field Skills"], "SkillCat", ["HVAC", "Field"], "Jan 29, 2026", "Apr 16, 2026"),
  T("T-2088", "Brazing Copper Lines", "Hands-On Task", ["HVAC Field Skills", "EPA 608 Type II"], "SkillCat", ["HVAC", "Brazing"], "Feb 05, 2026", "Apr 20, 2026"),
  T("T-2020", "Electrical Panel Labeling", "Hands-On Task", ["HVAC Field Skills"], "SkillCat", ["Electrical", "Safety"], "Feb 11, 2026", "Apr 14, 2026"),
  T("T-1930", "Compressor Replacement", "Hands-On Task", ["HVAC Field Skills"], "SkillCat", ["HVAC", "Field"], "Feb 19, 2026", "Apr 21, 2026"),
  T("T-1810", "Vacuum & Evacuation", "Hands-On Task", ["EPA 608 Type I", "EPA 608 Type II"], "SkillCat", ["HVAC", "Refrigerant"], "Feb 27, 2026", "Apr 11, 2026"),
  T("T-1690", "Leak Detection Test", "Hands-On Task", ["EPA 608 Type II"], "SkillCat", ["HVAC", "Refrigerant"], "Mar 04, 2026", "Apr 09, 2026"),
  T("T-1610", "Furnace Ignition Check", "Hands-On Task", ["HVAC Field Skills"], "SkillCat", ["HVAC", "Heating"], "Mar 12, 2026", "Apr 07, 2026"),
];

// Only Hands-On Tasks can be discoverable (surfaced in search/browse); every
// other Task type is always non-discoverable. Discoverability is opt-in even for
// Hands-On Tasks — only the ones marked below are discoverable.
const DISCOVERABLE = new Set([
  "T-2350", // Refrigerant Charging Procedure
  "T-2165", // Thermostat Wiring Lab
  "T-1855", // Recovery Machine Setup
  "T-1689", // Superheat Reading Lab
  "T-1555", // PVC Pipe Joining Lab
  "T-1488", // Sweat Soldering Lab
  "T-1432", // Field Visit – Brazing Joints
  "T-1321", // Tankless Heater Lab
  "T-1121", // Gas Line Pressure Test
]);
for (const t of tasks) {
  if (t.discoverable === undefined) {
    t.discoverable = t.type === "Hands-On Task" && DISCOVERABLE.has(t.id);
  }
}

// Tasks that act as a prerequisite gate in an Access Restriction chain. These
// can't be hidden until they're removed from the chain.
const ACCESS_RESTRICTED = new Set([
  "T-0234", // Government ID Upload — gates every certification's exam
  "T-1156", // EPA 608 Type I Final Exam — gated behind the Core module
]);
for (const t of tasks) {
  if (t.accessRestricted === undefined) t.accessRestricted = ACCESS_RESTRICTED.has(t.id);
}

/** Label used by the Discoverable filter. */
export function discoverableLabel(task: Task): string {
  return task.discoverable ? "Discoverable" : "Not discoverable";
}

/** Label used by the Final Exam filter. */
export function finalExamLabel(task: Task): string {
  return task.finalExam ? "Final Exam" : "Not Final Exam";
}

/** Only Quiz Tasks can have a paywall defined. */
export function canHavePaywall(task: Task): boolean {
  return task.type === "Quiz";
}

/** True when a paywall is actually in effect on the Task. */
export function isPaid(task: Task): boolean {
  return canHavePaywall(task) && !!task.paywall;
}
