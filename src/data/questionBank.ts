export type QuestionType =
  | "Multiple choice"
  | "Multiple select"
  | "True/False"
  | "Fill-in";

export type QuestionStatus = "Active" | "Archived" | "Draft";

export type Question = {
  id: string;
  type: QuestionType;
  text: string;
  status: QuestionStatus;
  categoryPath: string[]; // e.g. ["EPA 608", "Universal"]
  quizzes: string[]; // e.g. ["EPA Universal Exam", "EPA Type II"]
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

const Q = (
  id: string,
  type: QuestionType,
  text: string,
  status: QuestionStatus,
  categoryPath: string[],
  quizzes: string[],
): Question => ({ id, type, text, status, categoryPath, quizzes });

const EPA_UNI = ["EPA 608", "Universal"];

export const questions: Question[] = [
  Q("Q-10421", "Multiple choice",
    "Which refrigerant is classified as an HFC and commonly used in residential AC systems?",
    "Active", EPA_UNI, ["EPA Universal Exam", "NATE RTW"]),
  Q("Q-10422", "Multiple choice",
    "What is the EPA-mandated leak rate threshold for commercial refrigeration systems?",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10423", "True/False",
    "Recovery cylinders must be evacuated to 5 inHg before initial use.",
    "Active", EPA_UNI, ["EPA Universal Exam", "EPA Type II"]),
  Q("Q-10424", "Multiple choice",
    "Which of the following is NOT a CFC refrigerant phased out by the Montreal Protocol?",
    "Active", EPA_UNI, []),
  Q("Q-10425", "Multiple select",
    "Which devices can be used to identify refrigerant type in a sealed system? (Select all that apply)",
    "Active", EPA_UNI, ["EPA Universal Exam", "NATE RTW", "HVAC Field Skills"]),
  Q("Q-10426", "Multiple choice",
    "At what temperature does R-410A typically boil at atmospheric pressure?",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10427", "True/False",
    "A Section 608 certification is required to purchase HFC refrigerants in quantities over 2 lbs.",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10428", "Multiple choice",
    "What service practice is required when a leak exceeds 35% in a commercial refrigeration appliance?",
    "Active", EPA_UNI, ["EPA Universal Exam", "NATE RTW", "EPA Type II"]),
  Q("Q-10429", "Fill-in",
    "The maximum allowable refrigerant leak from disposal equipment is _____ psig.",
    "Archived", EPA_UNI, []),
  Q("Q-10430", "Multiple choice",
    "Which type of recovery is required when non-condensables exceed 15%?",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10431", "True/False",
    "Hydrocarbon refrigerants such as R-290 are non-flammable and safe for residential use.",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10432", "Multiple choice",
    "A small appliance technician encounters R-12 — what is the legally required action?",
    "Archived", EPA_UNI, ["EPA Type I Final (legacy)"]),
  // Beyond first page, for pagination
  Q("Q-10433", "Multiple choice",
    "Which color-coded cylinder is used for R-22 recovery?",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10434", "True/False",
    "Self-sealing service valves are required on all new HFC appliances under 5 lbs.",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10435", "Multiple choice",
    "What is the maximum allowable working pressure of a typical DOT-4BA cylinder?",
    "Active", EPA_UNI, ["EPA Universal Exam", "NATE RTW"]),
  Q("Q-10436", "Fill-in",
    "The Clean Air Act, Section _____ governs refrigerant management.",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10437", "Multiple select",
    "Select all approved refrigerant recovery methods for high-pressure appliances.",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
  Q("Q-10438", "Multiple choice",
    "Which leak detection method is most sensitive for halogenated refrigerants?",
    "Active", EPA_UNI, ["EPA Universal Exam"]),
];
