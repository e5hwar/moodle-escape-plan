export type QuestionType =
  | "Multiple choice"
  | "Multiple select"
  | "True/False"
  | "Match the following"
  | "Short answer"
  | "File upload"
  | "Linear scale";

export type QuestionStatus = "Active" | "Archived" | "Draft";

// Backend authoring type → short label shown in the table.
// Multiple choice and Multiple select are both MCQ on the backend.
export type ShortQuestionType = "MCQ" | "T/F" | "Match" | "Short" | "File" | "Scale";

export function shortQuestionType(type: QuestionType): ShortQuestionType {
  switch (type) {
    case "True/False":
      return "T/F";
    case "Match the following":
      return "Match";
    case "Short answer":
      return "Short";
    case "File upload":
      return "File";
    case "Linear scale":
      return "Scale";
    default:
      return "MCQ";
  }
}

// Short answer, File upload and Linear scale are always ungraded in V1.
export function supportsGrading(type: QuestionType): boolean {
  return (
    type === "Multiple choice" ||
    type === "Multiple select" ||
    type === "True/False" ||
    type === "Match the following"
  );
}

// Grade is a percentage share of the question's mark, −100…100.
export type QuestionOption = { text: string; grade: number };
// A pair with a blank `left` is an extra wrong answer (distractor).
export type MatchPair = { left: string; right: string };
export type MatchGradingMode = "all-or-nothing" | "partial";

export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  status: QuestionStatus;
  categoryPath: string[]; // e.g. ["EPA 608", "Universal"]
  quizzes: string[]; // quiz tasks using it (graded usage only)
  forms: string[]; // feedback forms using it (graded or not)
  version: number; // bumped each time the question is edited
  gradingEnabled: boolean;
  randomise: boolean;
  hasSpanish: boolean; // ES translation complete
  // Type-specific answer data (drives the preview panel).
  options?: QuestionOption[]; // MCQ / Multiple select / ungraded MCQ
  otherOption?: boolean; // MCQ "Other" free-text option (grading off only)
  tfAnswer?: boolean; // True/False correct value
  pairs?: MatchPair[]; // Match the following
  matchGrading?: MatchGradingMode;
  scale?: { min: number; max: number; minLabel?: string; maxLabel?: string };
  fileRules?: { maxFiles: number; maxSizeMb: number };
  feedback?: { correct?: string; partial?: string; incorrect?: string };
};

export type Subcategory = {
  key: string;
  label: string;
  count: number;
};

export type Category = {
  key: string;
  label: string;
  count: number;
  subcategories?: Subcategory[];
};

// A category-tree selection, shared by the left rail, the "Category" filter pill,
// and the search box's CATEGORY: token. `all` means no category filter is applied.
export type CategorySelection =
  | { kind: "all" }
  | { kind: "category"; categoryKey: string }
  | { kind: "subcategory"; categoryKey: string; subKey: string };

export type CategoryOption = {
  key: string; // stable identity for lists/keys
  label: string; // "EPA 608" or "EPA 608 > Universal"
  count: number;
  sel: CategorySelection;
};

// Flatten the category tree into a single list of categories AND subcategories,
// each subcategory rendered as "Parent > Sub".
export function flattenCategories(cats: Category[]): CategoryOption[] {
  const out: CategoryOption[] = [];
  for (const cat of cats) {
    out.push({
      key: cat.key,
      label: cat.label,
      count: cat.count,
      sel: { kind: "category", categoryKey: cat.key },
    });
    for (const sub of cat.subcategories ?? []) {
      out.push({
        key: `${cat.key}/${sub.key}`,
        label: `${cat.label} > ${sub.label}`,
        count: sub.count,
        sel: { kind: "subcategory", categoryKey: cat.key, subKey: sub.key },
      });
    }
  }
  return out;
}

// Human-readable label for a selection, e.g. "EPA 608 > Universal".
export function selectionLabel(sel: CategorySelection, cats: Category[]): string {
  if (sel.kind === "all") return "All Questions";
  const cat = cats.find((c) => c.key === sel.categoryKey);
  if (!cat) return "—";
  if (sel.kind === "category") return cat.label;
  const sub = cat.subcategories?.find((s) => s.key === sel.subKey);
  return `${cat.label} > ${sub?.label ?? "—"}`;
}

/* ─── Version history ───
   Mocked deterministically from the question id so every screen shows the same
   history for the same question. Past attempts/responses stay pinned to the
   version they answered; a version with zero pinned attempts can be deleted. */
export type QuestionVersion = {
  version: number;
  date: string; // "Jun 12, 2026"
  author: string;
  note: string;
  attempts: number; // quiz attempts + form responses pinned to this version
};

const VERSION_AUTHORS = ["Priya N.", "Marcus L.", "Dana R.", "Eshwar V."];
const VERSION_NOTES = [
  "Edited question text",
  "Updated option grades",
  "Fixed a typo in the options",
  "Added Spanish translation",
  "Toggled grading",
  "Reworded distractors",
  "Replaced an option",
];

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

export function versionHistory(q: Question): QuestionVersion[] {
  const h = hashId(q.id);
  const inUse = q.quizzes.length + q.forms.length > 0;
  const out: QuestionVersion[] = [];
  // Walk back from the prototype's fixed "today".
  let day = new Date(2026, 5, 24 - (h % 18));
  for (let v = q.version; v >= 1; v--) {
    const isCurrent = v === q.version;
    // Old versions of an in-use question usually have pinned attempts; some
    // (and any never-published edit) have none and can be deleted.
    const attempts = !inUse
      ? 0
      : isCurrent
        ? (h % 90) + 8
        : (h + v * 13) % 4 === 0
          ? 0
          : ((h + v * 31) % 380) + 15;
    out.push({
      version: v,
      date: day.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      author: VERSION_AUTHORS[(h + v) % VERSION_AUTHORS.length],
      note: v === 1 ? "Created" : VERSION_NOTES[(h + v * 3) % VERSION_NOTES.length],
      attempts,
    });
    day = new Date(day.getTime() - (4 + ((h + v * 7) % 38)) * 86400000);
  }
  return out;
}

export const categories: Category[] = [
  {
    key: "epa-608",
    label: "EPA 608",
    count: 247,
    subcategories: [
      { key: "type-1", label: "Type I (Small Appliances)", count: 58 },
      { key: "type-2", label: "Type II (High Pressure)", count: 64 },
      { key: "type-3", label: "Type III (Low Pressure)", count: 51 },
      { key: "universal", label: "Universal", count: 74 },
    ],
  },
  { key: "hvac-fundamentals", label: "HVAC Fundamentals", count: 312 },
  { key: "nate-core", label: "NATE Core", count: 184 },
  { key: "osha-safety", label: "OSHA & Safety", count: 96 },
  { key: "plumbing-code", label: "Plumbing Code", count: 138 },
  { key: "electrical-code", label: "Electrical Code", count: 112 },
];

const EPA_UNI = ["EPA 608", "Universal"];

const Q = (
  id: string,
  type: QuestionType,
  text: string,
  status: QuestionStatus,
  quizzes: string[],
  extra?: Partial<Question>,
): Question => ({
  id,
  type,
  text,
  status,
  categoryPath: EPA_UNI,
  quizzes,
  forms: [],
  version: 1,
  gradingEnabled: supportsGrading(type),
  randomise: type === "Multiple choice" || type === "Multiple select" || type === "Match the following",
  hasSpanish: false,
  ...extra,
});

export const questions: Question[] = [
  Q("Q-10421", "Multiple choice",
    "Which refrigerant is classified as an HFC and commonly used in residential AC systems?",
    "Active", ["EPA Universal Exam", "NATE RTW"], {
      version: 3,
      hasSpanish: true,
      options: [
        { text: "R-410A", grade: 100 },
        { text: "R-22", grade: -25 },
        { text: "R-12", grade: -25 },
        { text: "R-290", grade: -25 },
      ],
      feedback: {
        correct: "Correct — R-410A is an HFC blend.",
        incorrect: "Not quite — revisit the refrigerant classes.",
      },
    }),
  Q("Q-10422", "Multiple choice",
    "What is the EPA-mandated leak rate threshold for commercial refrigeration systems?",
    "Active", ["EPA Universal Exam"], {
      options: [
        { text: "20%", grade: -25 },
        { text: "30%", grade: 100 },
        { text: "35%", grade: -25 },
        { text: "50%", grade: -25 },
      ],
    }),
  Q("Q-10423", "True/False",
    "Recovery cylinders must be evacuated to 5 inHg before initial use.",
    "Active", ["EPA Universal Exam", "EPA Type II"], {
      version: 2,
      hasSpanish: true,
      tfAnswer: true,
      feedback: {
        correct: "Right — cylinders are evacuated before first use.",
        incorrect: "False is incorrect — check the cylinder prep rules.",
      },
    }),
  Q("Q-10424", "Multiple choice",
    "Which of the following is NOT a CFC refrigerant phased out by the Montreal Protocol?",
    "Active", [], {
      options: [
        { text: "R-134a", grade: 100 },
        { text: "R-11", grade: -25 },
        { text: "R-12", grade: -25 },
        { text: "R-115", grade: -25 },
      ],
    }),
  Q("Q-10425", "Multiple select",
    "Which devices can be used to identify refrigerant type in a sealed system? (Select all that apply)",
    "Active", ["EPA Universal Exam", "NATE RTW", "HVAC Field Skills"], {
      version: 4,
      hasSpanish: true,
      options: [
        { text: "Refrigerant identifier", grade: 50 },
        { text: "Pressure–temperature chart", grade: 50 },
        { text: "Halide torch", grade: -50 },
        { text: "Megohmmeter", grade: -50 },
      ],
      feedback: {
        correct: "Correct on both counts.",
        partial: "You found some of the right tools — review the rest.",
        incorrect: "Neither of those identifies a refrigerant.",
      },
    }),
  Q("Q-10426", "Multiple choice",
    "At what temperature does R-410A typically boil at atmospheric pressure?",
    "Active", ["EPA Universal Exam"], {
      options: [
        { text: "−55°F", grade: 100 },
        { text: "−22°F", grade: -25 },
        { text: "0°F", grade: -25 },
        { text: "32°F", grade: -25 },
      ],
    }),
  Q("Q-10427", "True/False",
    "A Section 608 certification is required to purchase HFC refrigerants in quantities over 2 lbs.",
    "Active", ["EPA Universal Exam"], { tfAnswer: true }),
  Q("Q-10428", "Multiple choice",
    "What service practice is required when a leak exceeds 35% in a commercial refrigeration appliance?",
    "Active", ["EPA Universal Exam", "NATE RTW", "EPA Type II"], {
      options: [
        { text: "Repair within 30 days", grade: 100 },
        { text: "Retrofit immediately", grade: -25 },
        { text: "Retire the appliance", grade: -25 },
        { text: "No action required", grade: -100 },
      ],
    }),
  Q("Q-10429", "Match the following",
    "Match each refrigerant to its ASHRAE safety classification, then pair the recovery cylinder color to the correct refrigerant family used in residential and light-commercial service.",
    "Archived", [], {
      version: 2,
      pairs: [
        { left: "R-410A", right: "A1" },
        { left: "R-290", right: "A3" },
        { left: "R-32", right: "A2L" },
        { left: "", right: "B2" },
      ],
      matchGrading: "all-or-nothing",
    }),
  Q("Q-10430", "Multiple choice",
    "Which type of recovery is required when non-condensables exceed 15%?",
    "Active", ["EPA Universal Exam"], {
      options: [
        { text: "Liquid recovery", grade: -25 },
        { text: "Vapor recovery", grade: -25 },
        { text: "Recovery and recycling", grade: 100 },
        { text: "Venting", grade: -100 },
      ],
    }),
  Q("Q-10431", "True/False",
    "Hydrocarbon refrigerants such as R-290 are non-flammable and safe for residential use.",
    "Active", ["EPA Universal Exam"], { tfAnswer: false }),
  Q("Q-10432", "Multiple choice",
    "A small appliance technician encounters R-12 — what is the legally required action?",
    "Archived", ["EPA Type I Final (legacy)"], {
      options: [
        { text: "Recover it with certified equipment", grade: 100 },
        { text: "Vent it — R-12 is exempt", grade: -100 },
        { text: "Dilute it with nitrogen", grade: -25 },
      ],
    }),
  // Ungraded questions used by Feedback Forms
  Q("Q-10439", "Multiple choice",
    "Which topic did you find most difficult?",
    "Active", [], {
      gradingEnabled: false,
      otherOption: true,
      forms: ["Post-Quiz Survey", "Course Feedback — HVAC"],
      hasSpanish: true,
      options: [
        { text: "Refrigerant classes", grade: 0 },
        { text: "Leak rates and thresholds", grade: 0 },
        { text: "Recovery procedures", grade: 0 },
        { text: "Safety classifications", grade: 0 },
      ],
    }),
  Q("Q-10440", "Linear scale",
    "How confident are you in refrigerant recovery procedures after this course?",
    "Active", [], {
      forms: ["Course Feedback — HVAC"],
      version: 2,
      scale: { min: 1, max: 10, minLabel: "Not confident at all", maxLabel: "Extremely confident" },
    }),
  Q("Q-10441", "Short answer",
    "In your own words, describe when a system must be repaired rather than retrofitted.",
    "Active", [], {
      forms: ["Post-Quiz Survey"],
    }),
  Q("Q-10442", "File upload",
    "Upload a photo of your manifold gauge setup on the practice rig.",
    "Draft", [], {
      forms: [],
      fileRules: { maxFiles: 3, maxSizeMb: 25 },
    }),
  // Beyond first page, for pagination
  Q("Q-10433", "Multiple choice",
    "Which color-coded cylinder is used for R-22 recovery?",
    "Active", ["EPA Universal Exam"], {
      options: [
        { text: "Grey body, yellow top", grade: 100 },
        { text: "Green body", grade: -25 },
        { text: "Blue body, orange top", grade: -25 },
      ],
    }),
  Q("Q-10434", "True/False",
    "Self-sealing service valves are required on all new HFC appliances under 5 lbs.",
    "Active", ["EPA Universal Exam"], { tfAnswer: true }),
  Q("Q-10435", "Multiple choice",
    "What is the maximum allowable working pressure of a typical DOT-4BA cylinder?",
    "Active", ["EPA Universal Exam", "NATE RTW"], {
      options: [
        { text: "240 psi", grade: -25 },
        { text: "300 psi", grade: 100 },
        { text: "400 psi", grade: -25 },
      ],
    }),
  Q("Q-10436", "Match the following",
    "Match each Clean Air Act section to the activity it governs.",
    "Active", ["EPA Universal Exam"], {
      version: 5,
      hasSpanish: true,
      pairs: [
        { left: "Section 608", right: "Stationary refrigeration" },
        { left: "Section 609", right: "Motor vehicle A/C" },
        { left: "Section 611", right: "Labeling requirements" },
      ],
      matchGrading: "partial",
      feedback: {
        correct: "All sections matched correctly.",
        partial: "Some sections are right — review the Clean Air Act overview.",
        incorrect: "None matched — revisit Sections 608–611.",
      },
    }),
  Q("Q-10437", "Multiple select",
    "Select all approved refrigerant recovery methods for high-pressure appliances.",
    "Active", ["EPA Universal Exam"], {
      options: [
        { text: "System-dependent recovery", grade: 50 },
        { text: "Self-contained recovery", grade: 50 },
        { text: "Passive venting", grade: -50 },
      ],
    }),
  Q("Q-10438", "Multiple choice",
    "Which leak detection method is most sensitive for halogenated refrigerants?",
    "Active", ["EPA Universal Exam"], {
      options: [
        { text: "Electronic leak detector", grade: 100 },
        { text: "Soap bubbles", grade: -25 },
        { text: "Ultrasonic detector", grade: -25 },
      ],
    }),
];
