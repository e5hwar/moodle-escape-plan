export type QuestionType =
  | "Multiple choice"
  | "Multiple select"
  | "True/False"
  | "Match the following"
  | "Short answer"
  | "File upload"
  | "Linear scale";

/* Two states, not three. A "Draft" status existed until 2026-09-16 — ~7% of the
   seeded bank carried it — but nothing in the app could put a question into it
   or take it out (the editor's Status field went 2026-09-10, the wizard and the
   CSV importer both write Active, and the row menu only toggles Archived), and
   a Draft could not be picked into a Quiz or Form. It was a dead end you could
   filter to but never leave, so the user had it removed outright. */
export type QuestionStatus = "Active" | "Archived";

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

/* Full type names, as filters and pickers show them. The table's Type column
   keeps the short form; everywhere a user reads or picks a type, use these. */
const LONG_BY_SHORT: Record<ShortQuestionType, string> = {
  MCQ: "Multiple Choice",
  "T/F": "True/False",
  Match: "Match the Following",
  Short: "Short Answer",
  Scale: "Linear Scale",
  File: "File Upload",
};

/** Full type names in the order the Question Bank filters list them. */
export const QUESTION_TYPE_OPTIONS: string[] = [
  "Multiple Choice",
  "True/False",
  "Match the Following",
  "Short Answer",
  "Linear Scale",
  "File Upload",
];

export function longQuestionType(type: QuestionType): string {
  return LONG_BY_SHORT[shortQuestionType(type)];
}

/* The Create Question menu (Figma 724:1010, the same panel Create Task uses):
   one row per authoring type with the letter that launches it while the menu
   is open. Multiple Choice covers Multiple select — the editor's Answers
   control switches between single and multiple. Letters avoid the page's own
   C (create) and A (add category), so "Match the Following" takes F for
   "Following" and "File Upload" takes U for "Upload". */
const TYPE_MENU_SHORTCUTS: [QuestionType, string][] = [
  ["Multiple choice", "M"],
  ["True/False", "T"],
  ["Match the following", "F"],
  ["Short answer", "S"],
  ["Linear scale", "L"],
  ["File upload", "U"],
];

export const QUESTION_TYPE_MENU: {
  type: QuestionType;
  label: string;
  shortcut: string;
}[] = TYPE_MENU_SHORTCUTS.map(([type, shortcut]) => ({
  type,
  label: longQuestionType(type),
  shortcut,
}));

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

/* Sentinel option labels for filtering questions that link nowhere — the same
   trick the Certifications pills use for an unset Career Stage / Type. Figma
   1201:2151 spells the row out: "None · Not used in any Quiz Task". */
export const NO_QUIZ = "None";
export const NO_FORM = "None";
/** "Not used in any …" copy for the two sentinels above. */
export const NO_QUIZ_HINT = "Not used in any Quiz Task";
export const NO_FORM_HINT = "Not used in any Feedback Form";

/** A usage filter matches a question with no links only via its "None" option. */
export function matchesUsage(used: string[], picked: string[], none: string): boolean {
  return used.length ? used.some((n) => picked.includes(n)) : picked.includes(none);
}

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

/* `tradeGroup` and the `TRADE_GROUPS` list it was picked from were removed
   2026-09-10, with the New Category modal's optional Trade Group select — a
   category is just a name and its subcategories now. */

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
  if (!cat) return "";
  if (sel.kind === "category") return cat.label;
  const sub = cat.subcategories?.find((s) => s.key === sel.subKey);
  return `${cat.label} > ${sub?.label ?? ""}`;
}

/* ─── Version history ───
   Mocked deterministically from the question id so every screen shows the same
   history for the same question. Past attempts/responses stay pinned to the
   version they answered; a version with zero pinned attempts can be deleted. */
export type QuestionVersion = {
  version: number;
  date: string; // "Jun 12, 2026"
  /* The same moment with a time on it — "Jun 12, 2026 · 2:14 PM", the stamp
     format Quiz Attempts uses. The Version History page's "Edited On" column
     shows this; `date` alone still feeds the list's Created / Last Modified
     columns, which have no room for a time. */
  stamp: string;
  author: string;
  note: string;
  attempts: number; // quiz attempts + form responses pinned to this version
  /* The two halves of `attempts`, so the Version History page can give each a
     column of its own instead of the one wordy "attempts/responses" line. A
     question answered only inside Feedback Forms has all of its pinned usage
     in `formResponses`, and vice versa. */
  quizAttempts: number;
  formResponses: number;
  /* The question stem as it read at this version — the Version History page's
     "Question" column, and what the editor loads when you View a past version.
     It only differs from the newer version's where that version's note says
     the text was edited; every other kind of edit leaves the stem alone. */
  text: string;
};

/* How a question stem read one edit earlier. Rough, deterministic, and only
   ever applied to a version whose note is "Edited question text", so the
   column and the note agree. The rules are all plain wording swaps, so
   whichever one fires the result is still a sentence. */
const EARLIER_EDITS: [string, string][] = [
  ["What should they check first?", "What should they check?"],
  ["What should they do first?", "What should they do?"],
  ["Which of the following ", "Which "],
  [" should they ", " must they "],
  [" is the correct ", " is the right "],
];

function earlierText(t: string): string {
  for (const [a, b] of EARLIER_EDITS) if (t.includes(a)) return t.replace(a, b);
  return t;
}

/** The stem as it read at `version` — falls back to today's text. */
export function versionText(q: Question, version: number): string {
  return versionHistory(q).find((v) => v.version === version)?.text ?? q.text;
}

/* Created / last-modified dates for the list's optional columns. Derived from
   versionHistory so they always agree with the version history page: v1's row
   is the creation date, the newest row is the last edit. */
export function questionDates(q: Question): { created: string; modified: string } {
  const rows = versionHistory(q);
  return { created: rows[rows.length - 1].date, modified: rows[0].date };
}

/* Every attempt ever made on the question, across all its versions — the list's
   "Attempts" column, and the fact the row menu splits Archive from Delete on.
   Form responses count: a Feedback Form question is "attempted" the same way,
   which is why the version history page labels the number
   "attempts/responses". */
export function attemptCount(q: Question): number {
  return versionHistory(q).reduce((sum, v) => sum + v.attempts, 0);
}

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

/* Share of a question's pinned usage that is Feedback-Form responses, for a
   question whose links don't already settle it. Most questions live in one
   world or the other, so the list leans on 0 and 1. */
const FORM_SHARES = [0, 0, 0.35, 1, 1, 0];

/* Working-hours clock for an edit stamp — deterministic, like everything else
   here, so the same version always reads the same time. */
function editTime(h: number, v: number): string {
  const hour24 = 8 + ((h + v * 5) % 10); // 8am–5pm
  const minute = (h + v * 17) % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${hour24 < 12 ? "AM" : "PM"}`;
}

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

export function versionHistory(q: Question): QuestionVersion[] {
  const h = hashId(q.id);
  /* Whether a question has EVER been answered is its own fact, not a
     restatement of where it is used today: a question can hold years of
     attempts after being pulled from every quiz, and one added to a quiz this
     morning has none yet. Keeping the two independent is what gives the row
     menu its four real cases — see `attemptCount`.
     It is not INDEPENDENT of usage, though — it leans on it. A question sitting
     in a live Quiz or Form has almost certainly been answered; one attached to
     nothing is a coin flip. The split matters because attempts are the second
     half of the Delete gate (`blockDelete` = in a Quiz OR ever answered), so
     this ratio is what decides how many questions can be deleted at all: at a
     flat 1-in-5-never-answered it was 615 of 4,793, and barely any unattached
     question offered Delete. Per the user (2026-09-16) **about half of the
     questions that are in no Quiz and no Feedback Form now do**. */
  const attached = q.quizzes.length > 0 || q.forms.length > 0;
  const everAnswered = attached ? h % 6 !== 0 : h % 2 === 1;
  /* How a version's pinned usage splits between quiz attempts and form
     responses — a per-QUESTION trait, not a per-version one, so it is settled
     once and applied to every row. Where the question's own links answer it
     they win, so the two columns can never contradict the list's Quizzes /
     Feedback Forms columns: a question used only in Forms has no quiz
     attempts, and one used only in Quizzes has no form responses. A question
     in both, or attached to nothing at all, falls back to the id. */
  const formShare =
    q.forms.length > 0 && q.quizzes.length === 0
      ? 1
      : q.quizzes.length > 0 && q.forms.length === 0
        ? 0
        : FORM_SHARES[h % FORM_SHARES.length];
  const out: QuestionVersion[] = [];
  // Walk back from the prototype's fixed "today".
  let day = new Date(2026, 5, 24 - (h % 18));
  /* The stem, walked backwards alongside the dates: it starts as today's text
     and steps back one wording every time we pass a version that edited it. */
  let text = q.text;
  for (let v = q.version; v >= 1; v--) {
    const isCurrent = v === q.version;
    // Old versions usually have pinned attempts; some (and any never-published
    // edit) have none and can be deleted.
    const attempts = !everAnswered
      ? 0
      : isCurrent
        ? (h % 90) + 8
        : (h + v * 13) % 4 === 0
          ? 0
          : ((h + v * 31) % 380) + 15;
    const formResponses = Math.round(attempts * formShare);
    const date = day.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const note = v === 1 ? "Created" : VERSION_NOTES[(h + v * 3) % VERSION_NOTES.length];
    out.push({
      version: v,
      date,
      text,
      stamp: `${date} · ${editTime(h, v)}`,
      quizAttempts: attempts - formResponses,
      formResponses,
      author: VERSION_AUTHORS[(h + v) % VERSION_AUTHORS.length],
      note,
      attempts,
    });
    if (note === "Edited question text") text = earlierText(text);
    day = new Date(day.getTime() - (4 + ((h + v * 7) % 38)) * 86400000);
  }
  return out;
}

const SEED_CATEGORIES: Category[] = [
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
  {
    key: "hvac-fundamentals",
    label: "HVAC Fundamentals",
    count: 312,
    subcategories: [
      { key: "refrigeration-cycle", label: "Refrigeration Cycle", count: 88 },
      { key: "airflow-ductwork", label: "Airflow & Ductwork", count: 71 },
      { key: "heat-pumps", label: "Heat Pumps", count: 64 },
      { key: "controls-thermostats", label: "Controls & Thermostats", count: 52 },
      { key: "troubleshooting", label: "Troubleshooting", count: 37 },
    ],
  },
  {
    key: "nate-core",
    label: "NATE Core",
    count: 184,
    subcategories: [
      { key: "nate-safety", label: "Safety", count: 41 },
      { key: "nate-tools", label: "Tools & Instruments", count: 38 },
      { key: "nate-electrical", label: "Basic Electrical", count: 57 },
      { key: "nate-science", label: "Basic Science", count: 48 },
    ],
  },
  {
    key: "osha-safety",
    label: "OSHA & Safety",
    count: 96,
    subcategories: [
      { key: "ppe", label: "PPE", count: 24 },
      { key: "ladders-fall", label: "Ladders & Fall Protection", count: 29 },
      { key: "lockout-tagout", label: "Lockout / Tagout", count: 22 },
      { key: "hazcom", label: "Hazard Communication", count: 21 },
    ],
  },
  {
    key: "plumbing-code",
    label: "Plumbing Code",
    count: 138,
    subcategories: [
      { key: "dwv", label: "Drain, Waste & Vent", count: 46 },
      { key: "water-supply", label: "Water Supply", count: 39 },
      { key: "fixtures", label: "Fixtures & Fittings", count: 31 },
      { key: "water-heaters", label: "Water Heaters", count: 22 },
    ],
  },
  {
    key: "electrical-code",
    label: "Electrical Code",
    count: 112,
    subcategories: [
      { key: "wiring-methods", label: "Wiring Methods", count: 34 },
      { key: "grounding-bonding", label: "Grounding & Bonding", count: 29 },
      { key: "overcurrent", label: "Overcurrent Protection", count: 27 },
      { key: "motors-controls", label: "Motors & Controls", count: 22 },
    ],
  },
  {
    key: "appliance-repair",
    label: "Appliance Repair",
    count: 121,
    subcategories: [
      { key: "laundry", label: "Washers & Dryers", count: 38 },
      { key: "refrigerators", label: "Refrigerators", count: 33 },
      { key: "dishwashers", label: "Dishwashers", count: 26 },
      { key: "ranges-ovens", label: "Ranges & Ovens", count: 24 },
    ],
  },
  {
    key: "solar",
    label: "Solar",
    count: 94,
    subcategories: [
      { key: "pv-basics", label: "PV Basics", count: 31 },
      { key: "inverters", label: "Inverters", count: 24 },
      { key: "mounting-racking", label: "Mounting & Racking", count: 21 },
      { key: "solar-safety", label: "Site Safety", count: 18 },
    ],
  },
  {
    key: "multifamily-maintenance",
    label: "Multifamily Maintenance",
    count: 106,
    subcategories: [
      { key: "make-ready", label: "Make-Ready", count: 34 },
      { key: "work-orders", label: "Work Orders", count: 28 },
      { key: "grounds-common", label: "Grounds & Common Areas", count: 25 },
      { key: "preventive", label: "Preventive Maintenance", count: 19 },
    ],
  },
  {
    key: "gas-combustion",
    label: "Gas & Combustion",
    count: 78,
    subcategories: [
      { key: "gas-piping", label: "Gas Piping", count: 27 },
      { key: "combustion-analysis", label: "Combustion Analysis", count: 24 },
      { key: "venting", label: "Venting", count: 16 },
      { key: "leak-detection", label: "Leak Detection", count: 11 },
    ],
  },
  {
    key: "boilers-hydronics",
    label: "Boilers & Hydronics",
    count: 83,
    subcategories: [
      { key: "boiler-types", label: "Boiler Types", count: 26 },
      { key: "hydronic-piping", label: "Hydronic Piping", count: 24 },
      { key: "pumps-zoning", label: "Pumps & Zoning", count: 19 },
      { key: "boiler-controls", label: "Boiler Controls", count: 14 },
    ],
  },
  {
    key: "commercial-refrigeration",
    label: "Commercial Refrigeration",
    count: 89,
    subcategories: [
      { key: "walk-ins", label: "Walk-Ins", count: 27 },
      { key: "reach-ins", label: "Reach-Ins", count: 22 },
      { key: "ice-machines", label: "Ice Machines", count: 23 },
      { key: "rack-systems", label: "Rack Systems", count: 17 },
    ],
  },
  {
    key: "pool-spa",
    label: "Pool & Spa",
    count: 64,
    subcategories: [
      { key: "water-chemistry", label: "Water Chemistry", count: 24 },
      { key: "pumps-filters", label: "Pumps & Filters", count: 21 },
      { key: "pool-heaters", label: "Heaters", count: 19 },
    ],
  },
  {
    key: "soft-skills",
    label: "Soft Skills & Career",
    count: 57,
    subcategories: [
      { key: "customer-service", label: "Customer Service", count: 22 },
      { key: "communication", label: "Communication", count: 19 },
      { key: "job-readiness", label: "Job Readiness", count: 16 },
    ],
  },
  { key: "learner-feedback", label: "Learner Feedback", count: 16 },
  /* ─── Course-shaped categories (2026-09-09) — the real SkillCat course
     names the bank is organised by. Flat by default: a course only earns
     subcategories once it is big enough to need them, which is why the larger
     ones below carry a handful and the rest are a single list. Names that
     already exist above as a category or one of its subcategories (the EPA 608
     type certificates, Heat Pumps, Ice Machines, Walk-In Freezers, PPE,
     Lockout/Tagout, the appliance basics) were deliberately not duplicated. ─── */
  {
    key: "air-handling-distribution",
    label: "Air Handling and Distribution",
    count: 74,
    subcategories: [
      { key: "fans-blowers", label: "Fans & Blowers", count: 24 },
      { key: "duct-design", label: "Duct Design", count: 22 },
      { key: "dampers-vav", label: "Dampers & VAV", count: 16 },
      { key: "air-balancing", label: "Balancing", count: 12 },
    ],
  },
  { key: "ahu-routine-maintenance", label: "Air Handling and Distribution: Routine Maintenance", count: 41 },
  {
    key: "advanced-electrical-troubleshooting",
    label: "Advanced Electrical Troubleshooting",
    count: 96,
    subcategories: [
      { key: "control-circuits", label: "Control Circuits", count: 31 },
      { key: "motor-faults", label: "Motor Faults", count: 26 },
      { key: "sequence-of-operation", label: "Sequence of Operation", count: 22 },
      { key: "meter-readings", label: "Meter Readings", count: 17 },
    ],
  },
  {
    key: "basic-electrical-systems-controls",
    label: "Basic Electrical Systems & Controls",
    count: 88,
    subcategories: [
      { key: "contactors-relays", label: "Contactors & Relays", count: 28 },
      { key: "transformers", label: "Transformers", count: 21 },
      { key: "capacitors", label: "Capacitors", count: 19 },
      { key: "safety-switches", label: "Safety Switches", count: 20 },
    ],
  },
  { key: "basic-science-trades", label: "Basic Science for the Trades", count: 58 },
  { key: "basic-wiring", label: "Basic Wiring", count: 63 },
  { key: "basics-drawings-blueprints", label: "Basics of Drawings & Blueprints", count: 44 },
  { key: "brazing-soldering", label: "Brazing & Soldering", count: 37 },
  { key: "chiller-routine-maintenance", label: "Chiller Systems: Routine Maintenance", count: 46 },
  { key: "chiller-startup", label: "Chiller Startup Procedures", count: 33 },
  {
    key: "complete-chiller-systems",
    label: "Complete Chiller Systems",
    count: 118,
    subcategories: [
      { key: "centrifugal", label: "Centrifugal Chillers", count: 34 },
      { key: "absorption", label: "Absorption Chillers", count: 26 },
      { key: "cooling-towers", label: "Cooling Towers", count: 31 },
      { key: "water-treatment", label: "Water Treatment", count: 27 },
    ],
  },
  {
    key: "complete-residential-systems",
    label: "Complete Residential Systems",
    count: 127,
    subcategories: [
      { key: "split-systems", label: "Split Systems", count: 36 },
      { key: "package-units", label: "Package Units", count: 28 },
      { key: "res-zoning", label: "Zoning", count: 31 },
      { key: "commissioning", label: "Commissioning", count: 32 },
    ],
  },
  { key: "computer-room-ac", label: "Computer Room Air Conditioning", count: 39 },
  { key: "confined-spaces", label: "Confined Spaces", count: 18 },
  { key: "customer-interaction", label: "Customer Interaction", count: 52 },
  { key: "domestic-refrigerators", label: "Domestic Refrigerators Basics", count: 43 },
  { key: "electrical-safety", label: "Electrical Safety", count: 36 },
  {
    key: "electricity-fundamentals",
    label: "Electricity Fundamentals",
    count: 92,
    subcategories: [
      { key: "ohms-law", label: "Ohm's Law", count: 27 },
      { key: "series-parallel", label: "Series & Parallel", count: 24 },
      { key: "ac-dc", label: "AC vs DC", count: 21 },
      { key: "circuit-symbols", label: "Circuit Symbols", count: 20 },
    ],
  },
  { key: "fire-prevention", label: "Fire Prevention", count: 21 },
  { key: "gas-boiler-basics", label: "Gas Boiler Basics", count: 49 },
  { key: "gas-furnace-basics", label: "Gas Furnace Basics", count: 67 },
  { key: "hand-power-tool-safety", label: "Hand & Power Tool Safety", count: 26 },
  { key: "heating-basics", label: "Heating Basics", count: 71 },
  {
    key: "heating-systems",
    label: "Heating Systems",
    count: 84,
    subcategories: [
      { key: "hs-furnaces", label: "Furnaces", count: 29 },
      { key: "hs-boilers", label: "Boilers", count: 24 },
      { key: "hs-heat-pumps", label: "Heat Pumps", count: 18 },
      { key: "hs-radiant", label: "Radiant", count: 13 },
    ],
  },
  {
    key: "hvac-trade-school",
    label: "HVAC Trade School Diploma",
    count: 156,
    subcategories: [
      { key: "term-1", label: "Term 1", count: 41 },
      { key: "term-2", label: "Term 2", count: 38 },
      { key: "term-3", label: "Term 3", count: 40 },
      { key: "capstone", label: "Capstone", count: 37 },
    ],
  },
  { key: "installing-chiller-systems", label: "Installing Chiller Systems", count: 31 },
  { key: "intro-electrical-troubleshooting", label: "Intro to Electrical Troubleshooting", count: 79 },
  { key: "intro-plumbing", label: "Intro to Plumbing", count: 68 },
  { key: "intro-roofing", label: "Intro to Roofing", count: 24 },
  { key: "intro-welding", label: "Intro to Welding", count: 27 },
  {
    key: "intro-commercial-systems",
    label: "Introduction to Commercial Systems",
    count: 103,
    subcategories: [
      { key: "rooftop-units", label: "Rooftop Units", count: 30 },
      { key: "built-up-systems", label: "Built-Up Systems", count: 24 },
      { key: "commercial-controls", label: "Commercial Controls", count: 26 },
      { key: "service-access", label: "Service Access", count: 23 },
    ],
  },
  { key: "intro-drain-cleaning", label: "Introduction to Drain Cleaning", count: 19 },
  { key: "intro-electrician-apprentice", label: "Introduction to being an Electrician Apprentice", count: 58 },
  { key: "intro-residential-water-heaters", label: "Introduction to Residential Water Heaters", count: 42 },
  { key: "key-hand-tools", label: "Key Hand Tools", count: 38 },
  { key: "mechanical-aptitude-soft-skills", label: "Mechanical Aptitude Soft Skills", count: 45 },
  { key: "mechanical-troubleshooting", label: "Mechanical Troubleshooting", count: 61 },
  { key: "mini-split", label: "Mini Split - Operation and Procedures", count: 47 },
  { key: "packaged-rtu-maintenance", label: "Packaged Rooftop Units: Routine Maintenance", count: 53 },
  { key: "piping", label: "Piping", count: 56 },
  { key: "ptac-basics", label: "PTAC Unit Basics", count: 28 },
  { key: "reading-electrical-blueprints", label: "Reading Electrical Drawings & Blueprints", count: 35 },
  { key: "reading-hvac-blueprints", label: "Reading HVAC Drawings and Blueprints", count: 40 },
  {
    key: "refrigeration-basics",
    label: "Refrigeration Basics",
    count: 108,
    subcategories: [
      { key: "cycle-components", label: "Cycle Components", count: 32 },
      { key: "refrigerants", label: "Refrigerants", count: 29 },
      { key: "charging", label: "Charging", count: 26 },
      { key: "recovery", label: "Recovery", count: 21 },
    ],
  },
  { key: "refrigeration-equipment", label: "Refrigeration Equipment", count: 72 },
  { key: "residential-gas-piping", label: "Residential Gas Piping", count: 33 },
  { key: "safety-basics", label: "Safety Basics", count: 64 },
  { key: "full-tune-up", label: "The Full Tune-Up Visit", count: 51 },
  {
    key: "trade-math",
    label: "Trade Math",
    count: 77,
    subcategories: [
      { key: "fractions-decimals", label: "Fractions & Decimals", count: 26 },
      { key: "conversions", label: "Conversions", count: 21 },
      { key: "areas-volumes", label: "Areas & Volumes", count: 17 },
      { key: "formulas", label: "Formulas", count: 13 },
    ],
  },
  { key: "troubleshooting-ahu", label: "Troubleshooting Air Handling Units", count: 37 },
  { key: "using-a-multimeter", label: "Using A Multimeter", count: 55 },
  { key: "wiring-diagrams", label: "Wiring Diagrams", count: 66 },
];

/* A→Z is the bank's reading order — the rail's tree walks this array as it
   stands, and with ~70 categories an authoring order nobody can predict is
   just noise. (The landing index sorts its own copy; categories created at
   runtime still append to the bottom, where the user just put them.) */
export const categories: Category[] = [...SEED_CATEGORIES].sort((a, b) =>
  a.label.localeCompare(b.label),
);

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
  randomise: type === "Multiple choice" || type === "Multiple select",
  hasSpanish: false,
  ...extra,
});

const AUTHORED: Question[] = [
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
      forms: ["EPA 608 — Post-Cert Satisfaction"],
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
    "Active", ["EPA Universal Exam", "NATE RTW", "HVAC JobReady"], {
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
      forms: ["EPA 608 — Post-Cert Satisfaction"],
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
      forms: ["EPA 608 — Post-Cert Satisfaction"],
      version: 2,
      scale: { min: 1, max: 10, minLabel: "Not confident at all", maxLabel: "Extremely confident" },
    }),
  Q("Q-10441", "Short answer",
    "In your own words, describe when a system must be repaired rather than retrofitted.",
    "Active", [], {}),
  Q("Q-10442", "File upload",
    "Upload a photo of your manifold gauge setup on the practice rig.",
    "Active", [], {
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
      forms: ["Plumbing Pilot — Beta Tester Feedback"],
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
  // Learner Feedback — ungraded survey questions linked by Feedback Forms
  FQ("Q-10450", "Linear scale",
    "How satisfied are you with this certification course?", {
      version: 2,
      hasSpanish: true,
      forms: ["EPA 608 — Post-Cert Satisfaction", "Old EPA Survey (Q1)"],
      scale: { min: 1, max: 10, minLabel: "Extremely disappointed", maxLabel: "Extremely satisfied" },
    }),
  FQ("Q-10451", "Multiple select",
    "Which parts of the course were most useful?", {
      hasSpanish: true,
      otherOption: true,
      forms: ["EPA 608 — Post-Cert Satisfaction"],
      options: [
        { text: "Video lessons", grade: 0 },
        { text: "Practice quizzes", grade: 0 },
        { text: "Hands-on tasks", grade: 0 },
        { text: "Reference materials", grade: 0 },
        { text: "Proctored exam", grade: 0 },
      ],
    }),
  FQ("Q-10452", "Linear scale",
    "How likely are you to recommend SkillCat to a friend or colleague?", {
      version: 3,
      hasSpanish: true,
      forms: ["EPA 608 — Post-Cert Satisfaction", "OSHA Safety — Course Quality"],
      scale: { min: 0, max: 10, minLabel: "Not at all likely", maxLabel: "Extremely likely" },
    }),
  FQ("Q-10453", "Multiple choice",
    "Did you face any issues during the exam?", {
      otherOption: true,
      forms: ["EPA 608 — Post-Cert Satisfaction"],
      options: [
        { text: "No issues", grade: 0 },
        { text: "Technical issues (audio, video, app)", grade: 0 },
        { text: "Content was unclear", grade: 0 },
        { text: "Proctoring felt too strict", grade: 0 },
      ],
    }),
  FQ("Q-10454", "Short answer",
    "Anything else you'd like us to know?", {
      forms: ["EPA 608 — Post-Cert Satisfaction"],
    }),
  FQ("Q-10455", "Linear scale",
    "Rate the quality of this walkthrough content.", {
      forms: ["HVAC Field Tools — Quick Pulse"],
      scale: { min: 1, max: 5, minLabel: "Poor", maxLabel: "Excellent" },
    }),
  FQ("Q-10456", "Short answer",
    "What would you improve about this Task?", {
      forms: ["HVAC Field Tools — Quick Pulse"],
    }),
  FQ("Q-10457", "File upload",
    "Upload a photo of your tool kit (optional).", {
      forms: ["HVAC Field Tools — Quick Pulse"],
      fileRules: { maxFiles: 3, maxSizeMb: 10 },
    }),
  FQ("Q-10458", "Multiple choice",
    "Was the assignment clear and easy to follow?", {
      forms: ["Hands-On Task — Field Reflection"],
      options: [
        { text: "Yes, very clear", grade: 0 },
        { text: "Mostly clear", grade: 0 },
        { text: "Somewhat confusing", grade: 0 },
        { text: "Very confusing", grade: 0 },
      ],
    }),
  FQ("Q-10459", "Multiple choice",
    "How long did it take you to complete?", {
      forms: ["Hands-On Task — Field Reflection"],
      options: [
        { text: "Under 30 minutes", grade: 0 },
        { text: "30–60 minutes", grade: 0 },
        { text: "1–2 hours", grade: 0 },
        { text: "Over 2 hours", grade: 0 },
      ],
    }),
  FQ("Q-10460", "Short answer",
    "Any feedback for the instructor?", {
      forms: ["Hands-On Task — Field Reflection"],
    }),
  FQ("Q-10461", "Linear scale",
    "How would you rate the difficulty of this exam?", {
      forms: ["NATE Ready To Work — Exam Feedback"],
      scale: { min: 1, max: 5, minLabel: "Very easy", maxLabel: "Very difficult" },
    }),
  FQ("Q-10462", "Multiple choice",
    "Did the OSHA course meet your expectations?", {
      forms: ["OSHA Safety — Course Quality"],
      options: [
        { text: "Exceeded expectations", grade: 0 },
        { text: "Met expectations", grade: 0 },
        { text: "Below expectations", grade: 0 },
      ],
    }),
  FQ("Q-10463", "Short answer",
    "What would you change about the course?", {
      forms: ["OSHA Safety — Course Quality"],
    }),
  FQ("Q-10464", "Linear scale",
    "Overall, how was the pilot experience?", {
      forms: ["Plumbing Pilot — Beta Tester Feedback"],
      scale: { min: 1, max: 10, minLabel: "Terrible", maxLabel: "Loved it" },
    }),
  FQ("Q-10465", "Multiple select",
    "Which modules need the most work?", {
      otherOption: true,
      forms: ["Plumbing Pilot — Beta Tester Feedback"],
      options: [
        { text: "Tools & Materials", grade: 0 },
        { text: "Code Compliance", grade: 0 },
        { text: "Pipe Fitting Basics", grade: 0 },
        { text: "Drainage Systems", grade: 0 },
      ],
    }),
];

// Ungraded Learner Feedback question — the shape Feedback Forms link most often.
function FQ(id: string, type: QuestionType, text: string, extra?: Partial<Question>): Question {
  return {
    id,
    type,
    text,
    status: "Active",
    categoryPath: ["Learner Feedback"],
    quizzes: [],
    forms: [],
    version: 1,
    gradingEnabled: false,
    randomise: false,
    hasSpanish: false,
    ...extra,
  };
}

/* ─── Filler questions ───────────────────────────────────────────────────────
   The 38 questions above are hand-written, and every one of them sits in
   EPA 608 > Universal or Learner Feedback — which left 65 of the 67 categories
   rendering "No questions match the current filters" even though the tree
   advertised counts in the hundreds. That gap was also what made the row menu
   lie: a category the table drew as empty still refused to delete, because the
   gate read the advertised `count`.

   So the bank is filled in from the tree itself: every subcategory gets exactly
   as many questions as its `count` claims, minus whatever is already hand-
   written there. The advertised numbers are now true, and the two hand-written
   paths keep their real questions and are simply topped up.

   Everything is derived from the id, so a given row is identical on every
   reload — the same rule versionHistory() already follows. */

/* Text is a template crossed with a rotating detail, never a template alone:
   with 14 templates and 13 details the pair repeats only after 182 questions,
   which is more than the largest subcategory holds — so no two rows inside one
   category read identically. (They did at first, and a sorted page of verbatim
   duplicates reads as a bug rather than as mock data.) */
const FILLER_DETAILS = [
  "a rooftop package unit",
  "a residential split system",
  "a walk-in cooler",
  "a gas furnace",
  "a heat pump in defrost",
  "a chilled water loop",
  "a mini-split head",
  "a commercial ice machine",
  "a condensing boiler",
  "a make-up air unit",
  "a rack refrigeration system",
  "an air-cooled condenser",
  "a variable-speed air handler",
];

const FILLER_TEMPLATES: [QuestionType, (sub: string, cat: string, on: string) => string][] = [
  ["Multiple choice", (sub, _c, on) => `Which of the following best describes ${sub} on ${on}?`],
  ["Multiple choice", (sub, cat, on) => `On ${on}, what is the primary purpose of ${sub} in a ${cat} system?`],
  ["True/False", (sub, _c, on) => `True or False: ${sub} must be verified on ${on} before it is returned to service.`],
  ["Multiple choice", (sub, _c, on) => `A technician is troubleshooting ${sub} on ${on}. What should they check first?`],
  ["Multiple select", (sub, _c, on) => `Select every tool required to work on ${sub} on ${on}.`],
  ["Short answer", (sub, _c, on) => `Explain how ${sub} affects the performance of ${on}.`],
  ["Multiple choice", (sub, _c, on) => `Which code requirement applies to ${sub} when installed on ${on}?`],
  ["Match the following", (sub, _c, on) => `Match each ${sub} term to its definition as it applies to ${on}.`],
  ["True/False", (sub, cat, on) => `True or False: ${sub} on ${on} falls under the ${cat} certification scope.`],
  ["Multiple choice", (sub, _c, on) => `What is the most common ${sub} failure mode on ${on}?`],
  ["Linear scale", (sub, _c, on) => `How confident are you servicing ${sub} on ${on} unsupervised?`],
  ["Multiple choice", (sub, _c, on) => `Which safety precaution is mandatory before servicing ${sub} on ${on}?`],
  ["File upload", (sub, _c, on) => `Upload a photo of your completed ${sub} work on ${on}.`],
  ["Multiple choice", (sub, _c, on) => `Which reading shows ${sub} is within specification on ${on}?`],
];

const FILLER_QUIZZES = [
  "EPA Universal Exam",
  "NATE RTW",
  "HVAC JobReady",
  "EPA Type II",
];

function fillerOptions(type: QuestionType, sub: string): Partial<Question> {
  switch (type) {
    case "Multiple choice":
      return {
        options: [
          { text: `The manufacturer's published ${sub} specification`, grade: 100 },
          { text: "Whatever the previous technician recorded", grade: -25 },
          { text: "The nameplate rating alone", grade: -25 },
          { text: "An estimate based on ambient conditions", grade: -25 },
        ],
      };
    case "Multiple select":
      return {
        options: [
          { text: "Manifold gauge set", grade: 50 },
          { text: "Digital multimeter", grade: 50 },
          { text: "Torque wrench", grade: -50 },
          { text: "Combustion analyser", grade: -50 },
        ],
      };
    case "True/False":
      return { tfAnswer: true };
    case "Match the following":
      return {
        pairs: [
          { left: "Superheat", right: "Temperature above saturation at the suction line" },
          { left: "Subcooling", right: "Temperature below saturation at the liquid line" },
          { left: "Delta T", right: "Temperature split across the evaporator coil" },
        ],
        matchGrading: "partial",
      };
    case "Linear scale":
      return { scale: { min: 1, max: 5, minLabel: "Not confident", maxLabel: "Very confident" } };
    case "File upload":
      return { fileRules: { maxFiles: 3, maxSizeMb: 10 } };
    default:
      return {};
  }
}

/* One filler question. `n` is its index within the whole generated run, so the
   type rotation, status mix and quiz links vary from row to row without any
   randomness. */
function fillerQuestion(n: number, cat: string, sub: string): Question {
  const id = `Q-2${String(10000 + n).slice(-5)}`;
  const [type, text] = FILLER_TEMPLATES[n % FILLER_TEMPLATES.length];
  const detail = FILLER_DETAILS[n % FILLER_DETAILS.length];
  // ~8% archived — enough for the Status filter to have something to do on
  // every page, without burying the Active rows. (The ~7% Draft slice that sat
  // beside it went with the status itself, 2026-09-16.)
  const status: QuestionStatus = n % 13 === 5 ? "Archived" : "Active";
  // Roughly a third of the bank is live in a Quiz, which is also what gates
  // Delete in the row menu — so both states show up while clicking around.
  const quizzes = n % 3 === 0 ? [FILLER_QUIZZES[n % FILLER_QUIZZES.length]] : [];
  return {
    id,
    type,
    text: text(sub, cat, detail),
    status,
    categoryPath: [cat, sub],
    quizzes,
    forms: [],
    version: (n % 4) + 1,
    gradingEnabled: supportsGrading(type),
    randomise:
      type === "Multiple choice" || type === "Multiple select" || type === "Match the following",
    hasSpanish: n % 5 === 0,
    ...fillerOptions(type, sub),
  };
}

function buildFiller(): Question[] {
  // What the hand-written set already contributes to each "Cat > Sub" path.
  const already = new Map<string, number>();
  for (const q of AUTHORED) {
    const key = q.categoryPath.join(" > ");
    already.set(key, (already.get(key) ?? 0) + 1);
  }
  const out: Question[] = [];
  let n = 0;
  for (const cat of SEED_CATEGORIES) {
    for (const sub of cat.subcategories ?? []) {
      const key = `${cat.label} > ${sub.label}`;
      const need = sub.count - (already.get(key) ?? 0);
      for (let i = 0; i < need; i++) out.push(fillerQuestion(n++, cat.label, sub.label));
    }
    // A category with no subcategories carries its questions directly.
    if (!cat.subcategories?.length) {
      const need = cat.count - (already.get(cat.label) ?? 0);
      for (let i = 0; i < need; i++) {
        const q = fillerQuestion(n++, cat.label, cat.label);
        out.push({ ...q, categoryPath: [cat.label] });
      }
    }
  }
  return out;
}

export const questions: Question[] = [...AUTHORED, ...buildFiller()];

export function questionById(id: string): Question | undefined {
  return questions.find((q) => q.id === id);
}
