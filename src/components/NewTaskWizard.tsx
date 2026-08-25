import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { TaskTypeKey } from "./Footer";
import { tasks as ALL_TASKS, type Task, type TaskType } from "../data/tasks";
import { DEFAULT_PARTNERSHIPS, DEFAULT_TRADES } from "../data/productConfig";
import { PriceIdFields, newPriceIds, type PriceIds } from "./PriceIdFields";
import { UploadIcon, UploadTrayIcon, DocumentIcon, SmallXIcon, DragHandleIcon, GearIcon, LockIcon, SearchIcon, CheckIcon } from "./icons";
import { RteToolbar } from "./RteToolbar";
import { WizardStepRail } from "./WizardStepRail";
import { SelectField } from "./SelectField";
import {
  questions as QUESTION_BANK,
  categories as QB_CATEGORIES,
  flattenCategories,
  shortQuestionType,
  type CategoryOption,
  type Question,
} from "../data/questionBank";

const TYPE_LABEL: Record<TaskTypeKey, string> = {
  xapi: "xAPI",
  quiz: "Quiz",
  "hands-on": "Hands-On Task",
  file: "Resource",
};

/* Rail header when creating — the title names the Task type. */
const NEW_TITLE: Record<TaskTypeKey, string> = {
  xapi: "New xAPI Task",
  quiz: "New Quiz Task",
  "hands-on": "New Hands-On Task",
  file: "New Resource Task",
};

/** Map a stored Task's display type to the wizard's TaskTypeKey. */
export function taskTypeKey(type: TaskType): TaskTypeKey {
  switch (type) {
    case "xAPI": return "xapi";
    case "Quiz": return "quiz";
    case "Hands-On Task": return "hands-on";
    case "Resource": return "file";
  }
}

/* ─────────────────────  Types  ───────────────────── */

type CompletionMode = "none" | "on-view" | "manual" | "xapi";
type Visibility = "visible" | "hidden";
type ContentTagType = "trade" | "partnership" | "userType";
type ContentTag = { id: string; type: ContentTagType; value: string };
type TimeUnit = "minutes" | "hours" | "days" | "weeks";

/* The unit picker is the design system's single-select (Figma 101:281 trigger +
   591:1382 menu) rather than a native <select>, so it reads and behaves like
   every other dropdown on the form. The stored value stays the lowercase key. */
const TIME_UNIT_LABEL: Record<TimeUnit, string> = {
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
};
const TIME_UNIT_OPTIONS = Object.values(TIME_UNIT_LABEL);
const TIME_UNIT_BY_LABEL = Object.fromEntries(
  (Object.keys(TIME_UNIT_LABEL) as TimeUnit[]).map((u) => [TIME_UNIT_LABEL[u], u]),
) as Record<string, TimeUnit>;
type OpenIn = "external" | "in-app";
type FileOpenIn = "in-app-viewer" | "external-app";
type ResourceType = "file" | "link";
type HoCompletion = "reviewer_grade" | "submission_made";
type MediaTypes = { images: boolean; videos: boolean; audio: boolean };
type Orientation = "portrait" | "landscape";
type ScoreCaptureMode = "highest" | "recent";
type QuizStructure = "single_block" | "sectioned";
type GradingModel = "quiz_level" | "section_level";
type QuestionOrder = "fixed" | "shuffled";
type ShuffleScope = "within_section" | "all";
type CompletionCriterion = "none" | "passing_grade";
type MaxAttemptsMode = "limited" | "unlimited";
type CooldownMode = "none" | "uniform" | "variable";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  ext: string;
};

type StaticQuestion = {
  id: string;
  text: string;
  type: string;
  weight: string;
};

type RandomPool = {
  id: string;
  name: string;
  questionIds: string[];
  draw: string;
  /** Per-question weightage, shared by every question in the pool. */
  weight: string;
};

// Only Active, graded Bank questions are eligible for Quizzes — both as
// hand-picked statics and as random-pool members.
const GRADED_BANK = QUESTION_BANK.filter(
  (q) => q.status === "Active" && q.gradingEnabled,
);

// Category options for the picker's Category/Sub-Category filter, limited to
// branches that actually hold graded questions.
const matchesCategory = (q: Question, opt: CategoryOption) =>
  opt.label.split(" > ").every((part, i) => q.categoryPath[i] === part);

const QUIZ_PICKER_CATS = flattenCategories(QB_CATEGORIES).filter((opt) =>
  GRADED_BANK.some((q) => matchesCategory(q, opt)),
);

type QuizSection = {
  id: string;
  name: string;
  nameEs: string;
  // Grading attributes are configured in Step 4 (Grading & Completion) but
  // modeled on the Section object per the spec — they have no meaning until a
  // grading model is chosen.
  passingPct: string;
  requiredToPass: boolean;
  // Questions are configured in Step 3 (Questions), per Section.
  staticQuestions: StaticQuestion[];
  randomPools: RandomPool[];
};

type VariableCooldown = {
  id: string;
  fromAttempt: number;
  minutes: string;
};

type TriggerTask = { id: string; name: string };

type PaywallMode = "common" | "per_attempt";

type AttemptPrice = {
  id: string;
  attempt: string; // "1", "2", … — specific numbered attempts only
  priceIds: PriceIds;
};

// An in-quiz resource is either a file the admin uploads here, or an existing
// Resource picked from the app's catalog (PT charts).
type QuizResource = {
  id: string;
  kind: "upload" | "existing";
  name: string;
  /** Upload-only display metadata. */
  size?: number;
  ext?: string;
};

type ReviewOptions = {
  attempt: boolean;
  quizResult: boolean;
  quizScore: boolean;
  whetherCorrect: boolean;
  perQuestionFeedback: boolean;
  perSectionResults: boolean;
};

type WizardData = {
  // Common
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  timeValue: string;
  timeUnit: TimeUnit;
  visibility: Visibility | null;
  /** Paywall flag — the Task needs a paid subscription, i.e. it is NOT part of
   * the Free Trial. Distinct from the Task's `finalExam` flag. */
  requiresSubscription: boolean;
  tags: string[];

  // xAPI
  packageEn: UploadedFile[];
  packageEs: UploadedFile[];
  completion: CompletionMode | null;
  scoreCapture: boolean;
  scoreCaptureMode: ScoreCaptureMode;
  scoreDisplayMode: ScoreCaptureMode;

  // Resource — Link
  url: string;
  urlEs: string;
  openIn: OpenIn;
  allowRotation: boolean;
  lockedOrientation: Orientation;

  // Resource — File
  fileEn: UploadedFile[];
  fileEs: UploadedFile[];
  fileOpenIn: FileOpenIn;

  // Resource — which form of content this Resource is
  resourceType: ResourceType;

  // Hands-On
  hoFilesEn: UploadedFile[];
  hoFilesEs: UploadedFile[];
  hoInstrEn: string;
  hoInstrEs: string;
  hoToolsEn: string;
  hoToolsEs: string;
  hoReviewerChecklist: string;
  hoProjectDescLimit: string;
  hoMediaMax: string;
  hoMediaTypes: MediaTypes;
  hoCompletion: HoCompletion;
  hoPassingGrade: string;
  discoverable: boolean;
  contentTags: ContentTag[];

  // Quiz – Structure (Step 2)
  structure: QuizStructure;
  sections: QuizSection[];

  // Quiz – Questions (Step 3, single-block path; sectioned lives on sections)
  blockStatic: StaticQuestion[];
  blockPools: RandomPool[];
  questionOrder: QuestionOrder;
  shuffleScope: ShuffleScope;

  // Quiz – Grading & Completion (Step 4)
  gradingModel: GradingModel;
  quizPassingPct: string;
  quizCompletion: CompletionCriterion;

  // Quiz – Attempts & Timing (Step 5)
  maxAttemptsMode: MaxAttemptsMode;
  maxAttempts: string;
  cooldownMode: CooldownMode;
  cooldownMinutes: string;
  variableCooldowns: VariableCooldown[];
  autoAttempts: boolean;
  autoAttemptsCount: string;
  autoAttemptTriggers: TriggerTask[];
  timeLimitOn: boolean;
  timeLimitMinutes: string;

  // Quiz – Integrity & Resources (Step 6)
  proctoring: boolean;
  inQuizResources: QuizResource[];

  // Quiz – Post-Submission Review (Step 7)
  review: ReviewOptions;

  // Quiz – Payments & Integrations (Step 8)
  paywallOn: boolean;
  paywallMode: PaywallMode;
  commonPriceIds: PriceIds;
  attemptPrices: AttemptPrice[];
  subsequentPriceIds: PriceIds;
  nateExam: boolean;
  nateIdEn: string;
  nateIdEs: string;
};

/* ─────────────────  Constants & defaults  ───────────────── */

const DEFAULT_COMPLETION: CompletionMode = "xapi";
const DEFAULT_VISIBILITY: Visibility = "visible";

const DEFAULT_OPEN_IN: OpenIn = "external";

const DEFAULT_FILE_OPEN_IN: FileOpenIn = "in-app-viewer";

// Content Tags for Visibility — three tag types, identical to the Certification
// wizard. Trade and Partnership draw their values from the B2B Management fields
// under Product Config; User Type is either unset (blank) or "B2B Only".
const USER_TYPE_VALUES = ["B2B Only"];

const CONTENT_TAG_GROUPS: {
  type: ContentTagType;
  label: string;
  options: string[];
  placeholder: string;
  help: string;
}[] = [
  {
    type: "trade",
    label: "Trade",
    options: DEFAULT_TRADES,
    placeholder: "Select a Trade…",
    help: "Tenants in any one of these Trades can see this. Leave empty to match every Tenant's Trade.",
  },
  {
    type: "partnership",
    label: "Partnership",
    options: DEFAULT_PARTNERSHIPS,
    placeholder: "Select a Partnership…",
    help: "Only Tenants in one of these Partnerships can see this. Leave empty to match Tenants with or without a Partnership.",
  },
  {
    type: "userType",
    label: "User Type",
    options: USER_TYPE_VALUES,
    placeholder: "Add B2B Only…",
    help: 'Default is All — visible to B2C and B2B. Add "B2B Only" to hide this from B2C users.',
  },
];

const VisibilityInfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

// Compact version of the spec's "Content Visibility Scenarios" table — shown in
// the expandable help panel so admins can sanity-check a tag combination.
const VISIBILITY_EXAMPLES: { trade: string; partnership: string; userType: string; b2c: string; b2b: string }[] = [
  { trade: "—", partnership: "—", userType: "All", b2c: "Yes", b2b: "All Companies" },
  { trade: "—", partnership: "—", userType: "B2B Only", b2c: "No", b2b: "All Companies" },
  { trade: "Residential HVAC", partnership: "—", userType: "All", b2c: "No", b2b: "Companies in Residential HVAC (with or without a Partnership)" },
  { trade: "Residential HVAC", partnership: "Nexstar", userType: "All", b2c: "No", b2b: "Companies in Residential HVAC who are also in Nexstar (both conditions)" },
  { trade: "—", partnership: "Nexstar", userType: "All", b2c: "No", b2b: "Companies in Nexstar (across all Trades)" },
  { trade: "Res. + Comm. HVAC", partnership: "—", userType: "All", b2c: "No", b2b: "Companies in Residential HVAC OR Commercial HVAC" },
];

function VisibilityHelpPanel() {
  return (
    <div className="cv-help-panel">
      <p className="cv-help-lead">
        This Task is <strong>All-User Content</strong> (SkillCat-owned). The tags below
        scope <strong>which Tenants can see it</strong> — they're computed at query time against each
        Tenant's profile, with no manual assignment. Once a Tenant can see it, the Paywall applies
        equally to everyone.
      </p>

      <ul className="cv-rule-list">
        <li>
          <strong>Unset = everyone.</strong> No Trade, no Partnership, and User Type left at All makes
          this visible to all Tenants — B2C and B2B alike.
        </li>
        <li>
          <strong>Within a filter, OR.</strong> A Tenant matches if it shares at least one value with
          the content. Two Trades → any Tenant holding either one sees it.
        </li>
        <li>
          <strong>Across filters, AND.</strong> A Tenant must satisfy every filter set — Trade
          <em> and</em> Partnership <em>and</em> User Type.
        </li>
        <li>
          <strong>B2C has no Trade or Partnership.</strong> Adding <em>any</em> Trade or Partnership tag
          removes this content from B2C — content can't be both Trade/Partnership-scoped and B2C-visible.
        </li>
        <li>
          <strong>Trade ≠ Industry.</strong> Trade is an access filter and is invisible to learners.
          Industries are the browse/discovery taxonomy learners actually see.
        </li>
      </ul>

      <div className="cv-examples-wrap">
        <table className="cv-examples">
          <thead>
            <tr>
              <th>Trade</th>
              <th>Partnership</th>
              <th>User Type</th>
              <th>B2C</th>
              <th>B2B sees it?</th>
            </tr>
          </thead>
          <tbody>
            {VISIBILITY_EXAMPLES.map((r, i) => (
              <tr key={i}>
                <td>{r.trade}</td>
                <td>{r.partnership}</td>
                <td>{r.userType}</td>
                <td>{r.b2c}</td>
                <td>{r.b2b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Per-attempt pricing starts with just the first attempt; "all subsequent
// attempts" is tracked separately (subsequentPrice) and always sits at the
// bottom. Admins add Attempt 2, 3, … in between as needed.
const DEFAULT_ATTEMPT_PRICES: AttemptPrice[] = [
  { id: "ap1", attempt: "1", priceIds: newPriceIds() },
];

const INITIAL_DATA: WizardData = {
  nameEn: "",
  nameEs: "",
  descEn: "",
  descEs: "",
  timeValue: "",
  timeUnit: "minutes",
  visibility: DEFAULT_VISIBILITY,
  /* Defaults off for every Task type — the toggle's copy still recommends
     turning it on for Tasks that complete a Certification, but that's a
     per-Task call, not the default. */
  requiresSubscription: false,
  tags: [],

  packageEn: [],
  packageEs: [],
  completion: DEFAULT_COMPLETION,
  scoreCapture: false,
  scoreCaptureMode: "highest",
  scoreDisplayMode: "highest",

  url: "",
  urlEs: "",
  openIn: DEFAULT_OPEN_IN,
  allowRotation: true,
  lockedOrientation: "portrait",

  fileEn: [],
  fileEs: [],
  fileOpenIn: DEFAULT_FILE_OPEN_IN,

  resourceType: "file",

  hoFilesEn: [],
  hoFilesEs: [],
  hoInstrEn: "",
  hoInstrEs: "",
  hoToolsEn: "",
  hoToolsEs: "",
  hoReviewerChecklist: "",
  hoProjectDescLimit: "500",
  hoMediaMax: "3",
  hoMediaTypes: { images: true, videos: true, audio: false },
  hoCompletion: "reviewer_grade",
  hoPassingGrade: "5",
  discoverable: true,
  contentTags: [],

  // A new Quiz starts empty — no prefilled Sections, questions, or pools;
  // everything is authored by the admin.
  structure: "single_block",
  sections: [],
  blockStatic: [],
  blockPools: [],
  questionOrder: "fixed",
  shuffleScope: "within_section",

  gradingModel: "quiz_level",
  quizPassingPct: "70",
  quizCompletion: "passing_grade",

  maxAttemptsMode: "limited",
  maxAttempts: "3",
  cooldownMode: "none",
  cooldownMinutes: "",
  variableCooldowns: [],
  autoAttempts: false,
  autoAttemptsCount: "4",
  autoAttemptTriggers: [],
  timeLimitOn: false,
  timeLimitMinutes: "60",

  proctoring: false,
  inQuizResources: [],

  review: {
    attempt: true,
    quizResult: true,
    quizScore: true,
    whetherCorrect: false,
    perQuestionFeedback: false,
    perSectionResults: false,
  },

  paywallOn: false,
  paywallMode: "common",
  commonPriceIds: newPriceIds(),
  attemptPrices: DEFAULT_ATTEMPT_PRICES,
  subsequentPriceIds: newPriceIds(),
  nateExam: false,
  nateIdEn: "",
  nateIdEs: "",
};

type StepDef = { id: string; label: string; sub: string; desc: string };

const XAPI_STEPS: StepDef[] = [
  { id: "details", label: "Task Details", sub: "Name, file, time, visibility", desc: "Name and describe the Task, upload the xAPI package per language, estimate the duration, and set its visibility." },
  { id: "launch", label: "Launch Behaviour", sub: "Orientation", desc: "How the package handles screen rotation when a learner opens it on a mobile phone." },
  { id: "completion", label: "Completion & Scoring", sub: "Completion and score capture", desc: "Decide what marks this Task complete, and whether to capture a score reported by the package." },
];

const QUIZ_STEPS: StepDef[] = [
  { id: "basics", label: "Task Basics", sub: "Name, visibility, time", desc: "Name the Quiz, set its visibility, and add an optional description and duration." },
  { id: "structure", label: "Structure", sub: "Single block or sections", desc: "Choose whether this Quiz is one block of questions or split into independently graded Sections. Most Quizzes use a single block; Sections are for EPA/NATE-style exams." },
  { id: "questions", label: "Questions", sub: "Static, pools, order", desc: "Pick questions from the Question Bank — hand-picked statics and/or random pools — set per-Quiz weightage, and choose the order learners see them in." },
  { id: "grading", label: "Grading & Completion", sub: "Pass marks and completion", desc: "Choose the grading model, set passing thresholds, and decide what marks the Quiz complete." },
  { id: "attempts", label: "Attempts & Timing", sub: "Attempts, cooldown, time limit", desc: "How many times a learner can attempt the Quiz, the gap between attempts, auto-unlocked attempts, and the per-attempt time limit." },
  { id: "integrity", label: "Integrity & Resources", sub: "Proctoring and resources", desc: "Turn on proctoring and attach resources learners can open during the attempt (PT charts, PDFs, etc.)." },
  { id: "review", label: "Post-Submission Review", sub: "What learners see after", desc: "Select what a learner sees after submitting an attempt." },
  { id: "payments", label: "Payments & Integrations", sub: "Paywall and NATE", desc: "Per-attempt pricing and NATE exam integration." },
];

const RESOURCE_STEPS: StepDef[] = [
  { id: "basics", label: "Basic Info", sub: "Type, content, time, visibility", desc: "Name the Task, choose whether it points at a file or a link, add the content, estimate how long it takes to complete, and set its visibility." },
  { id: "launch", label: "Launch Behaviour", sub: "How it opens", desc: "Choose how the Task opens for the learner" },
  { id: "completion", label: "Completion", sub: "How completion is determined", desc: "Decide what marks this Task as complete for a learner." },
];

const HANDSON_STEPS: StepDef[] = [
  { id: "basics", label: "Basic Info", sub: "Name, description, time, visibility", desc: "Name the Task, describe it, estimate how long it takes to complete, and set its visibility." },
  { id: "reference", label: "Reference Files", sub: "Files, instructions, checklist", desc: "Give learners the files, instructions, and materials they need, and write the checklist reviewers grade against." },
  { id: "submission", label: "Submission Fields", sub: "Description and media limits", desc: "Define what a learner submits — the project description limit and how many media files of which types they can attach." },
  { id: "completion", label: "Completion", sub: "Attempts and passing rule", desc: "How many times a learner can submit, and what marks the Task complete." },
  { id: "discovery", label: "Discovery & Tags", sub: "Discovery, tags", desc: "Whether this Task surfaces in search and browse, and how it's tagged for Tenant targeting." },
];

function stepsForType(type: TaskTypeKey): StepDef[] {
  if (type === "quiz") return QUIZ_STEPS;
  if (type === "file") return RESOURCE_STEPS;
  if (type === "hands-on") return HANDSON_STEPS;
  return XAPI_STEPS;
}

/* ─────────────────  Edge Line Gate (Wizard 6)  ─────────────────
 * Wheel-past-the-edge step navigation. Scrolling beyond the top/bottom of a
 * step "charges" a gate: an orange edge line scales out from the centre, a
 * caption names the adjacent step, the pane nudges in the scroll direction,
 * and the matching footer button fills left-to-right. At full charge the
 * wizard changes step; releasing the wheel lets the charge decay. */

/** Wheel distance (px) that fully charges a step change. */
const GATE_DISTANCE = 420;
/** Wheel events are swallowed for this long after a gated step change, so
 * scroll momentum doesn't immediately scroll (or re-gate) the new step. */
const GATE_COOLDOWN_MS = 750;

const pad2 = (n: number) => String(n).padStart(2, "0");

type GateLand = "top" | "bottom";

type GateState = {
  charge: number;
  /** 1 = charging towards the next step, -1 = towards the previous, 0 = idle. */
  dir: 1 | -1 | 0;
  lastWheel: number;
  coolUntil: number;
  raf: number;
  /** Where the next rendered step should land its scroll position. Gating
   * backwards lands at the bottom — you re-enter the previous page where you
   * left it, at its end. */
  land: GateLand;
};

/* ─────────────────────  Wizard shell  ───────────────────── */

type Props = {
  taskType: TaskTypeKey;
  onClose: () => void;
  /** When set, the wizard opens in editing mode with this Task's details
   * prefilled instead of starting blank. */
  editingTask?: Task;
  /** Embedding hooks — used when the Task creation UI is shown inside the
   * Certification split-screen editor. When `onPrimary` is provided, the footer's
   * primary action calls it (with the Task's current name) instead of `onClose`,
   * and shows `primaryLabel`. `savedLabel` adds the "Last saved…" note on the left. */
  primaryLabel?: string;
  onPrimary?: (taskName: string) => void;
  savedLabel?: string;
  /** Publishing hook for a brand-new Task. Called with the finished Task (the
   * caller assigns the id, the way `addCompany` does) once every mandatory
   * field on every step is filled. Without it, publishing just closes — the
   * embedded and edit flows keep their own behaviour. */
  onCreate?: (task: Omit<Task, "id">) => void;
};

/** Pull the leading number out of a "~45 minutes" / "2 hours" style string. */
function parseTimeToComplete(value: string | undefined): { timeValue: string; timeUnit: TimeUnit } | null {
  if (!value) return null;
  const m = value.match(/(\d+)\s*(minute|hour|day|week)/i);
  if (!m) return null;
  const unit = (m[2].toLowerCase() + "s") as TimeUnit;
  return { timeValue: m[1], timeUnit: unit };
}

/** Build the wizard's starting state, prefilling from an existing Task in edit mode. */
function buildInitialData(taskType: TaskTypeKey, editingTask?: Task): WizardData {
  let base: WizardData;
  // Resource Tasks have no default completion mode in the spec — the admin
  // picks one.
  if (taskType === "file")
    base = { ...INITIAL_DATA, completion: null };
  // xAPI Tasks default to rotation off, locked to landscape.
  else if (taskType === "xapi")
    base = { ...INITIAL_DATA, allowRotation: false, lockedOrientation: "landscape" };
  // Quizzes default to unlimited attempts.
  else if (taskType === "quiz")
    base = { ...INITIAL_DATA, maxAttemptsMode: "unlimited" };
  // Hands-On Tasks default to unlimited attempts and are not discoverable.
  else if (taskType === "hands-on")
    base = { ...INITIAL_DATA, maxAttemptsMode: "unlimited", discoverable: false };
  else base = INITIAL_DATA;

  if (!editingTask) return base;

  const time = parseTimeToComplete(editingTask.timeToComplete);
  return {
    ...base,
    nameEn: editingTask.name,
    descEn: editingTask.description ?? base.descEn,
    tags: editingTask.tags ?? base.tags,
    visibility: editingTask.hidden ? "hidden" : "visible",
    requiresSubscription: editingTask.requiresSubscription ?? base.requiresSubscription,
    discoverable: editingTask.discoverable ?? base.discoverable,
    ...(time ? { timeValue: time.timeValue, timeUnit: time.timeUnit } : {}),
    // A Quiz Task carrying section config opens in the sectioned structure with
    // section-level grading; each Section draws its questions from a Bank pool.
    ...(editingTask.quizSections
      ? {
          structure: "sectioned" as const,
          gradingModel: "section_level" as const,
          quizCompletion: "passing_grade" as const,
          sections: editingTask.quizSections.map((s, i) => ({
            id: `sec${i + 1}`,
            name: s.name,
            nameEs: s.nameEs,
            passingPct: String(s.passingPct),
            requiredToPass: s.requiredToPass,
            staticQuestions: [],
            randomPools: [
              {
                id: `pool${i + 1}`,
                name: `${s.name} question bank`,
                questionIds: GRADED_BANK.map((q) => q.id),
                draw: String(Math.min(s.questionCount, GRADED_BANK.length)),
                weight: "1",
              },
            ],
          })),
        }
      : {}),
  };
}

export function NewTaskWizard({ taskType, onClose, editingTask, primaryLabel, onPrimary, savedLabel, onCreate }: Props) {
  const isEditing = !!editingTask;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => buildInitialData(taskType, editingTask));
  // Completion criteria (passing grades, completion criterion) start locked when
  // editing — unlocking requires acknowledging that existing completions will be
  // deleted and recomputed. Persisted at the wizard level so it survives step nav.
  const [criteriaUnlocked, setCriteriaUnlocked] = useState(false);

  const update = (patch: Partial<WizardData>) =>
    setData((d) => ({ ...d, ...patch }));

  const isXapi = taskType === "xapi";
  const isQuiz = taskType === "quiz";
  const isFile = taskType === "file";
  const isHandsOn = taskType === "hands-on";
  const steps = stepsForType(taskType);
  const lastStep = steps.length - 1;

  /* ── Edge Line Gate wiring ── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const paneOutRef = useRef<HTMLDivElement>(null);
  const prevLineRef = useRef<HTMLSpanElement>(null);
  const prevCapRef = useRef<HTMLSpanElement>(null);
  const nextLineRef = useRef<HTMLSpanElement>(null);
  const nextCapRef = useRef<HTMLSpanElement>(null);
  const backFillRef = useRef<HTMLSpanElement>(null);
  const nextFillRef = useRef<HTMLSpanElement>(null);
  const gate = useRef<GateState>({ charge: 0, dir: 0, lastWheel: 0, coolUntil: 0, raf: 0, land: "top" });

  // Charge is painted straight onto the DOM every wheel tick — routing it
  // through state would re-render the whole step per tick.
  const paintCharge = useCallback(() => {
    const g = gate.current;
    const f = g.dir === 1 ? g.charge : 0;
    const b = g.dir === -1 ? g.charge : 0;
    if (nextLineRef.current) nextLineRef.current.style.transform = `scaleX(${f.toFixed(3)})`;
    if (nextCapRef.current) nextCapRef.current.style.opacity = Math.min(1, f * 1.8).toFixed(3);
    if (prevLineRef.current) prevLineRef.current.style.transform = `scaleX(${b.toFixed(3)})`;
    if (prevCapRef.current) prevCapRef.current.style.opacity = Math.min(1, b * 1.8).toFixed(3);
    if (nextFillRef.current) nextFillRef.current.style.width = `${(f * 100).toFixed(1)}%`;
    if (backFillRef.current) backFillRef.current.style.width = `${(b * 100).toFixed(1)}%`;
    const pane = paneOutRef.current;
    if (pane) {
      pane.style.transition = g.charge > 0 ? "transform 0.09s linear" : "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)";
      pane.style.transform = g.charge > 0 ? `translateY(${(-g.dir * g.charge * 10).toFixed(1)}px)` : "";
    }
  }, []);

  const goStep = useCallback(
    (i: number, land: GateLand = "top") => {
      const j = Math.min(lastStep, Math.max(0, i));
      setStep((cur) => {
        if (j === cur) return cur;
        const g = gate.current;
        g.charge = 0;
        g.dir = 0;
        g.land = land;
        paintCharge();
        return j;
      });
    },
    [lastStep, paintCharge],
  );

  // Land the freshly rendered step before paint — at the top when moving
  // forward, at the bottom when the back-gate pulled us up a step.
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    if (sc) sc.scrollTop = gate.current.land === "bottom" ? sc.scrollHeight : 0;
    gate.current.land = "top";
  }, [step]);

  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const g = gate.current;

    const startDecay = () => {
      if (g.raf) return;
      const tick = () => {
        g.raf = 0;
        if (g.charge <= 0) {
          g.dir = 0;
          paintCharge();
          return;
        }
        if (performance.now() - g.lastWheel > 420) {
          g.charge = Math.max(0, g.charge - 0.05);
          paintCharge();
        }
        g.raf = requestAnimationFrame(tick);
      };
      g.raf = requestAnimationFrame(tick);
    };

    const addCharge = (dir: 1 | -1, amt: number, now: number) => {
      if (g.dir !== dir) {
        g.charge = 0;
        g.dir = dir;
      }
      g.lastWheel = now;
      g.charge = Math.min(1, g.charge + amt / GATE_DISTANCE);
      if (g.charge >= 1) {
        g.charge = 0;
        g.dir = 0;
        paintCharge();
        g.coolUntil = now + GATE_COOLDOWN_MS;
        goStep(stepRef.current + dir, dir === 1 ? "top" : "bottom");
      } else {
        paintCharge();
        startDecay();
      }
    };

    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now < g.coolUntil) {
        e.preventDefault();
        return;
      }
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1);
      // A nested scroller (question picker, dropdown list) that can still
      // consume the wheel owns it — never charge the gate over its content.
      for (let el = e.target as HTMLElement | null; el && el !== sc; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const oy = getComputedStyle(el).overflowY;
          if (
            (oy === "auto" || oy === "scroll") &&
            (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0)
          )
            return;
        }
      }
      const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
      const atTop = sc.scrollTop <= 1;
      if (dy > 0 && atBottom && stepRef.current < lastStep) {
        e.preventDefault();
        addCharge(1, dy, now);
      } else if (dy < 0 && atTop && stepRef.current > 0) {
        e.preventDefault();
        addCharge(-1, -dy, now);
      } else if (g.charge > 0) {
        g.charge = 0;
        g.dir = 0;
        paintCharge();
      }
    };

    sc.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      sc.removeEventListener("wheel", onWheel);
      if (g.raf) cancelAnimationFrame(g.raf);
      g.raf = 0;
    };
  }, [goStep, lastStep, paintCharge]);

  // Name is required to publish. Step 01 is the "basics"
  // step that holds the name for every Task type. Quiet-rail behaviour: step 01
  // flags "needs input" once you've moved past it with an empty name, or after a
  // publish attempt — never while you're still filling it in for the first time.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const nameMissing = !data.nameEn.trim();
  const showNameError = nameMissing && (step > 0 || attemptedSubmit);
  // Set on a failed publish attempt: the mandatory fields, on any step, that
  // are still empty. Cleared field-by-field as they're filled in.
  const [missingKeys, setMissingKeys] = useState<ReadonlySet<string>>(new Set());

  const stepIndex = useCallback(
    (id: string) => Math.max(0, steps.findIndex((s) => s.id === id)),
    [steps],
  );

  /* Every mandatory field in the wizard — the ones drawn with a red asterisk —
     paired with the step that owns it, so a failed publish can jump to the
     first one. Publishing is available from step 01, so this has to look at
     steps the admin may never have opened. */
  const collectMissing = useCallback((d: WizardData) => {
    const gaps: { step: number; key: string }[] = [];
    const K = REQUIRED_FIELD_KEYS;
    const basics = 0;
    if (!d.nameEn.trim()) gaps.push({ step: basics, key: K.name });
    if (isXapi) {
      // The Spanish package is optional — Spanish learners fall back to English.
      if (d.packageEn.length === 0) gaps.push({ step: basics, key: K.package });
      if (!d.completion) gaps.push({ step: stepIndex("completion"), key: K.completion });
    }
    if (isFile) {
      if (d.resourceType === "file") {
        if (d.fileEn.length === 0) gaps.push({ step: basics, key: K.file });
      } else if (!d.url.trim()) {
        gaps.push({ step: basics, key: K.link });
      }
      // Resource Tasks start with no completion mode — the admin must pick one.
      if (!d.completion) gaps.push({ step: stepIndex("completion"), key: K.completion });
    }
    if (isQuiz && d.nateExam && (!d.nateIdEn.trim() || !d.nateIdEs.trim())) {
      gaps.push({ step: stepIndex("payments"), key: K.nateId });
    }
    return gaps.sort((a, b) => a.step - b.step);
  }, [isXapi, isFile, isQuiz, stepIndex]);

  // Live view of the flagged fields: once a field is filled its error clears
  // without waiting for another publish attempt.
  const missing = useMemo(() => {
    if (missingKeys.size === 0) return EMPTY_KEYS;
    const still = new Set(collectMissing(data).map((g) => g.key));
    return new Set([...missingKeys].filter((k) => still.has(k)));
  }, [missingKeys, collectMissing, data]);

  /** Steps that still hold a flagged empty field — drives the quiet rail. */
  const errorSteps = useMemo(() => {
    const out = new Set<number>();
    if (showNameError) out.add(0);
    if (missingKeys.size === 0) return out;
    for (const g of collectMissing(data)) if (missingKeys.has(g.key)) out.add(g.step);
    return out;
  }, [showNameError, missingKeys, collectMissing, data]);

  /* "Save & Publish" and the last step's "Publish" are the same action: check
     every mandatory field on every step, then create the Task with whatever
     visibility the Basic Info step's control is set to. A gap sends you to the
     step that owns the first missing field with it flagged. */
  function handlePublish() {
    const gaps = collectMissing(data);
    setAttemptedSubmit(true);
    setMissingKeys(new Set(gaps.map((g) => g.key)));
    if (gaps.length > 0) {
      goStep(gaps[0].step);
      return;
    }
    if (onPrimary) {
      onPrimary(data.nameEn);
      return;
    }
    if (onCreate && !isEditing) {
      onCreate(buildTask(data, taskType));
      return;
    }
    onClose();
  }

  const isLast = step === lastStep;
  const publishLabel = primaryLabel ?? (isEditing ? "Save changes" : "Publish");

  return (
    <div className="wizard">
      <div className="wizard-body">
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">
              {isEditing ? "Editing" : "Creating"}
            </span>
            <span className="wizard-brand-name">
              {editingTask ? editingTask.name : NEW_TITLE[taskType]}
            </span>
          </div>

          <ol className="wizard-steps">
            {steps.map((s, i) => {
              const status =
                errorSteps.has(i)
                  ? "error"
                  : i === step
                  ? "active"
                  : i < step
                  ? "done"
                  : "upcoming";
              return (
                <li
                  key={s.id}
                  className={`wizard-step ${status}`}
                  onClick={() => goStep(i)}
                >
                  <WizardStepRail status={status} num={i + 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="wizard-main">
          {step > 0 && (
            <>
              <span className="wizard-gate-line is-top" ref={prevLineRef} />
              <span className="wizard-gate-cap is-top" ref={prevCapRef}>
                ↑ BACK TO STEP {pad2(step)} · {steps[step - 1].label.toUpperCase()}
              </span>
            </>
          )}
          {step < lastStep && (
            <>
              <span className="wizard-gate-line is-bottom" ref={nextLineRef} />
              <span className="wizard-gate-cap is-bottom" ref={nextCapRef}>
                ↓ NEXT · STEP {pad2(step + 2)} · {steps[step + 1].label.toUpperCase()}
              </span>
            </>
          )}
          <div className="wizard-content" ref={scrollRef}>
            <div className="wizard-paneout" ref={paneOutRef}>
              <div className="wizard-pane" key={step}>
          <h1 className="wizard-title">{steps[step].label}</h1>
          <p className="wizard-desc">{steps[step].desc}</p>

          {(() => {
            const criteriaLocked = isEditing && !criteriaUnlocked;
            const onUnlockCriteria = () => setCriteriaUnlocked(true);
            const gateProps = { criteriaLocked, onUnlockCriteria };
            return (
          isXapi ? (
            step === 0 ? <XapiDetailsStep data={data} update={update} nameError={showNameError} missing={missing} /> :
            step === 1 ? <XapiLaunchStep data={data} update={update} /> :
            <XapiCompletionStep data={data} update={update} missing={missing} {...gateProps} />
          ) : isQuiz ? (
            step === 0 ? <QuizBasicsStep data={data} update={update} nameError={showNameError} /> :
            step === 1 ? <QuizStructureStep data={data} update={update} locked={isEditing} /> :
            step === 2 ? <QuizQuestionsStep data={data} update={update} /> :
            step === 3 ? <QuizGradingStep data={data} update={update} locked={isEditing} {...gateProps} /> :
            step === 4 ? <QuizAttemptsStep data={data} update={update} /> :
            step === 5 ? <QuizIntegrityStep data={data} update={update} /> :
            step === 6 ? <QuizReviewStep data={data} update={update} /> :
            <QuizPaymentsStep data={data} update={update} missing={missing} />
          ) : isFile ? (
            step === 0 ? <ResourceBasicInfoStep data={data} update={update} nameError={showNameError} missing={missing} /> :
            step === 1 ? <ResourceLaunchStep data={data} update={update} /> :
            <UrlCompletionStep data={data} update={update} missing={missing} {...gateProps} />
          ) : isHandsOn ? (
            step === 0 ? <HandsOnBasicStep data={data} update={update} nameError={showNameError} /> :
            step === 1 ? <HandsOnReferenceStep data={data} update={update} /> :
            step === 2 ? <HandsOnSubmissionStep data={data} update={update} /> :
            step === 3 ? <HandsOnCompletionStep data={data} update={update} {...gateProps} /> :
            <HandsOnDiscoveryStep data={data} update={update} />
          ) : (
            <PlaceholderStep type={TYPE_LABEL[taskType]} />
          ));
          })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          {savedLabel && <span className="wizard-saved">{savedLabel}</span>}
          <button className="wizard-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn-save-draft wizard-gate-btn" onClick={() => goStep(step - 1)}>
              <span className="wizard-gate-fill" ref={backFillRef} />
              <span className="wizard-gate-btn-inner">Back</span>
            </button>
          )}
          {/* Publishes from any step (validating every step), rather than
              stashing a draft. `.btn-save-draft` is just the footer's neutral
              button — the same class Back uses. */}
          <button className="btn-save-draft" onClick={handlePublish}>
            Save &amp; Publish
          </button>
          <button
            className="btn-publish wizard-gate-btn"
            onClick={isLast ? handlePublish : () => goStep(step + 1)}
          >
            <span className="wizard-gate-fill" ref={nextFillRef} />
            <span className="wizard-gate-btn-inner">{isLast ? publishLabel : `Next: ${steps[step + 1].label}`}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────  xAPI step components  ───────────────── */

function PlaceholderStep({ type }: { type: string }) {
  return (
    <p className="wizard-desc">
      The {type} wizard isn't built out yet. The xAPI and Quiz wizards are
      the references — the same shell will host the {type} steps next.
    </p>
  );
}

type StepProps = {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  /** When editing an existing Quiz, the structure is frozen — see
   * {@link QuizStructureStep}. Structural changes (adding/removing Sections,
   * single-block↔sectioned, or which Sections are Required-to-Pass) can't be
   * re-evaluated against past attempts, so they're disallowed in place. */
  locked?: boolean;
  /** When editing, completion criteria (passing grades, completion criterion)
   * start locked behind a warning. True while still locked. */
  criteriaLocked?: boolean;
  /** Acknowledge the warning and unlock completion criteria for editing. */
  onUnlockCriteria?: () => void;
  /** True after a publish attempt with an empty required Name — surfaces the
   * missing-field state on the name input. */
  nameError?: boolean;
  /** Keys of the mandatory fields a publish attempt found empty — see
   * {@link REQUIRED_FIELD_KEYS}. Steps read it to flag their own fields. */
  missing?: ReadonlySet<string>;
};

/** Mandatory-field keys, shared by the collector and the steps that flag them. */
const REQUIRED_FIELD_KEYS = {
  name: "name",
  package: "package",
  file: "file",
  link: "link",
  completion: "completion",
  nateId: "nateId",
} as const;

/** Stable empty set, so the "nothing missing" memo doesn't churn its consumers. */
const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();

const TASK_TYPE_OF: Record<TaskTypeKey, TaskType> = {
  xapi: "xAPI",
  quiz: "Quiz",
  "hands-on": "Hands-On Task",
  file: "Resource",
};

const today = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

/** Turn the finished wizard state into a Task row. The caller assigns the id. */
function buildTask(d: WizardData, taskType: TaskTypeKey): Omit<Task, "id"> {
  const hidden = d.visibility === "hidden";
  const stamp = today();
  return {
    name: d.nameEn.trim(),
    type: TASK_TYPE_OF[taskType],
    usedIn: [],
    createdBy: "SkillCat",
    tags: d.tags,
    dateCreated: stamp,
    dateModified: stamp,
    // Published, not a draft — the Task goes live with whatever the Visibility
    // step was left on.
    draft: false,
    hidden,
    visibility: hidden ? "Hidden" : "Visible · published",
    discoverable: d.discoverable,
    requiresSubscription: d.requiresSubscription,
    ...(d.descEn.trim() ? { description: d.descEn.trim() } : {}),
    ...(d.timeValue.trim() ? { timeToComplete: `~${d.timeValue} ${d.timeUnit}` } : {}),
    ...(taskType === "quiz" && d.paywallOn ? { paywall: true } : {}),
  };
}

/* Figma 366:6266 — the assembled first step: one evenly spaced stack of fields,
   no section dividers. Name is dual-language like everything else on the form
   (Figma 49:348 "Plain Text Input - Dual Language", EN Name / ES Nombre) — it
   was the last single-language name left in the wizard. */
function XapiDetailsStep({ data, update, nameError, missing }: StepProps) {
  return (
    <>
      <div className="wizard-fields">
        <div className="form-group">
          <label className="form-label">
            Name <span className="req">*</span>
          </label>
          <LangField
            en={data.nameEn}
            es={data.nameEs}
            onChangeEn={(v) => update({ nameEn: v })}
            onChangeEs={(v) => update({ nameEs: v })}
            placeholderEn="Name"
            placeholderEs="Nombre"
            error={nameError}
            errorMessage="Enter a name to publish."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <RichTextField
            en={data.descEn}
            es={data.descEs}
            onChangeEn={(v) => update({ descEn: v })}
            onChangeEs={(v) => update({ descEs: v })}
          />
        </div>

        <TimeToCompleteField data={data} update={update} />

        <VisibilityField data={data} update={update} />

        <div className="form-group">
          <label className="form-label">
            xAPI Package <span className="req">*</span>
          </label>
          <PackageField
            enFiles={data.packageEn}
            esFiles={data.packageEs}
            setEnFiles={(files) => update({ packageEn: files })}
            setEsFiles={(files) => update({ packageEs: files })}
            error={missing?.has("package")}
          />
          {missing?.has("package") && (
            <p className="form-error-text">Upload the English xAPI package to publish.</p>
          )}
          <p className="form-help">
            If the Spanish file is left empty, Spanish learners will also see the
            English version
          </p>
        </div>

        <SubscriptionAccessField data={data} update={update} />
      </div>
    </>
  );
}

/* Flat field stack like the Task Details step — no Section heading; the page
   header + description above carry the only framing. */
function XapiLaunchStep({ data, update }: StepProps) {
  return (
    <div className="wizard-fields">
      <OrientationField data={data} update={update} />
    </div>
  );
}

function XapiCompletionStep({ data, update, criteriaLocked, onUnlockCriteria, missing }: StepProps) {
  const options: { key: CompletionMode; title: string; desc: string }[] = [
    { key: "none", title: "No completion tracking", desc: "Task is reference content only — never marked complete." },
    { key: "on-view", title: "Completion upon viewing", desc: "Marks complete as soon as the learner opens the package." },
    { key: "manual", title: "User manually marks completion", desc: "Learner clicks \"Mark complete\" after finishing the content." },
    { key: "xapi", title: "xAPI completion statement", desc: "The package fires a completion statement to the LRS. Recommended for xAPI content." },
  ];

  return (
    <>
      <CompletionCriteriaGate locked={!!criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
        <div className="form-group">
          <label className="form-label">
            How completion is determined <span className="req">*</span>
          </label>
          <div className={`radio-card-group${missing?.has("completion") ? " has-error" : ""}`}>
            {options.map((o) => (
              <RadioCard
                key={o.key}
                selected={data.completion === o.key}
                onSelect={() => update({ completion: o.key })}
                title={o.title}
                desc={o.desc}
              />
            ))}
          </div>
          {missing?.has("completion") && (
            <p className="form-error-text">Choose how this Task is completed to publish.</p>
          )}
        </div>
      </CompletionCriteriaGate>

      <div className="form-group">
        <Toggle
          checked={data.scoreCapture}
          onChange={(v) => update({ scoreCapture: v })}
          label="Score Capture"
          sub="Completion only records whether the Task was finished. When on, SkillCat also stores the score the xAPI/SCORM content sends. Off by default — only completion is tracked."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Score displayed</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.scoreDisplayMode === "highest"}
            onSelect={() => update({ scoreDisplayMode: "highest" })}
            disabled={!data.scoreCapture}
            title="Highest"
            desc="Show the learner their best score across all attempts."
          />
          <RadioCard
            selected={data.scoreDisplayMode === "recent"}
            onSelect={() => update({ scoreDisplayMode: "recent" })}
            disabled={!data.scoreCapture}
            title="Most recent"
            desc="Show the score from the learner's latest attempt."
          />
        </div>
        {!data.scoreCapture && (
          <p className="form-help">
            Turn on score capture to choose which score learners see.
          </p>
        )}
      </div>
    </>
  );
}

/* One tri-state Orientation field — replaces the old Allow Rotation toggle +
   Locked Orientation card pair. Still writes the same two data fields:
   "Allow Rotation" is allowRotation=true, the two locks clear it and pick the
   orientation. */
function OrientationField({
  data,
  update,
  sub = "Applies to mobile phones only. On iPad and tablets orientation is never locked, and on Web the layout adapts to the window — these settings have no effect there.",
}: StepProps & { sub?: string }) {
  const value = data.allowRotation ? "rotate" : data.lockedOrientation;
  return (
    <div className="form-group">
      <label className="form-label">Orientation</label>
      <div className="radio-card-group">
        <RadioCard
          selected={value === "rotate"}
          onSelect={() => update({ allowRotation: true })}
          title="Allow Rotation"
          desc="Learner can switch between portrait and landscape"
        />
        <RadioCard
          selected={value === "portrait"}
          onSelect={() => update({ allowRotation: false, lockedOrientation: "portrait" })}
          title="Lock to Portrait"
          desc="Content stays locked to portrait"
        />
        <RadioCard
          selected={value === "landscape"}
          onSelect={() => update({ allowRotation: false, lockedOrientation: "landscape" })}
          title="Locked to Landscape"
          desc="Content stays locked to landscape"
        />
      </div>
      <p className="form-help">{sub}</p>
    </div>
  );
}

function UrlCompletionStep({ data, update, criteriaLocked, onUnlockCriteria, missing }: StepProps) {
  const options: { key: CompletionMode; title: string; desc: string }[] = [
    { key: "none", title: "No completion tracking", desc: "Reference content only — the Task is never marked complete." },
    { key: "on-view", title: "Completion upon viewing", desc: "Marks complete as soon as the learner opens the Resource. When it opens outside the app (External Browser or External Application) the Task completes on launch, since the app can't observe it once it opens elsewhere." },
    { key: "manual", title: "User manually marks completion", desc: "The learner taps \"Mark complete\" from the UI after they finish." },
  ];

  return (
    <CompletionCriteriaGate locked={!!criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
      <div className="form-group">
        <label className="form-label">
          How completion is determined <span className="req">*</span>
        </label>
        <div className={`radio-card-group${missing?.has("completion") ? " has-error" : ""}`}>
          {options.map((o) => (
            <RadioCard
              key={o.key}
              selected={data.completion === o.key}
              onSelect={() => update({ completion: o.key })}
              title={o.title}
              desc={o.desc}
            />
          ))}
        </div>
        {missing?.has("completion") && (
          <p className="form-error-text">Choose how this Task is completed to publish.</p>
        )}
      </div>
    </CompletionCriteriaGate>
  );
}

/* ─────────────────  Resource step components  ───────────────── */

/* Flat field stack, same assembly as {@link XapiDetailsStep} — Resource type is
   a mandatory field like Name/Description (label + subtext + control), not a
   titled Section. */
function ResourceBasicInfoStep({ data, update, nameError, missing }: StepProps) {
  const isFileType = data.resourceType === "file";
  return (
    <div className="wizard-fields">
      <NameAndDescription data={data} update={update} nameError={nameError} />

      <TimeToCompleteField data={data} update={update} />

      <VisibilityField data={data} update={update} />

      <div className="form-group">
        <label className="form-label">
          Resource Type <span className="req">*</span>
        </label>
        <div className="radio-card-group">
          <RadioCard
            selected={isFileType}
            onSelect={() => update({ resourceType: "file" })}
            title="File"
            desc="Upload a file (PDF, DOCX, PPTX, images, etc.). SkillCat hosts it and serves it to learners."
          />
          <RadioCard
            selected={!isFileType}
            onSelect={() => update({ resourceType: "link" })}
            title="Link"
            desc="Point at an external URL, or a SkillCat Deep Link to a page within the app."
          />
        </div>
        <p className="form-help">
          Choose whether this Resource is a file learners open, or a link to an
          external site or somewhere within the app.
        </p>
      </div>

      {isFileType ? (
        <div className="form-group">
          <label className="form-label">
            File <span className="req">*</span>
          </label>
          <PackageField
            enFiles={data.fileEn}
            esFiles={data.fileEs}
            setEnFiles={(files) => update({ fileEn: files })}
            setEsFiles={(files) => update({ fileEs: files })}
            accept="PDF, DOCX, PPTX, images"
            error={missing?.has("file")}
          />
          {missing?.has("file") && (
            <p className="form-error-text">Upload the English file to publish.</p>
          )}
          <p className="form-help">
            Optional: Configure how the file appears in Step 2: Launch Behaviour
          </p>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label">
            Link <span className="req">*</span>
          </label>
          <LangField
            en={data.url}
            es={data.urlEs}
            onChangeEn={(v) => update({ url: v })}
            onChangeEs={(v) => update({ urlEs: v })}
            placeholderEn="https://example.com/resource or skillcat://course/123"
            placeholderEs="https://ejemplo.com/recurso o skillcat://course/123"
            type="url"
            inputMode="url"
            error={missing?.has("link")}
            errorMessage="Enter a link to publish."
          />
          <p className="form-help">
            An external web address (including https://) or a SkillCat Deep Link
            to a Certification, Task, or app page. If no Spanish link is added,
            Spanish learners open the English link.
          </p>
        </div>
      )}

      <SubscriptionAccessField data={data} update={update} />
    </div>
  );
}

/* Flat field stack like {@link ResourceBasicInfoStep} — "Open In" and the
   rotation fields are peers, with no section headings or divider between them.
   The step heading carries the only description. */
function ResourceLaunchStep({ data, update }: StepProps) {
  if (data.resourceType === "file") {
    return (
      <div className="wizard-fields">
        <div className="form-group">
          <label className="form-label">Open In</label>
          <div className="radio-card-group">
            <RadioCard
              selected={data.fileOpenIn === "in-app-viewer"}
              onSelect={() => update({ fileOpenIn: "in-app-viewer" })}
              title="In-App Viewer"
              desc="Opens in the SkillCat app's built-in file viewer. Keeps learners in the app."
            />
            <RadioCard
              selected={data.fileOpenIn === "external-app"}
              onSelect={() => update({ fileOpenIn: "external-app" })}
              title="External Application"
              desc="Hands the file to the device's default app for that file type (e.g. a PDF reader)."
            />
          </div>
          <p className="form-help">
            Where the file opens when a learner starts the Task. In-App Viewer is
            the default. If a file type only supports one of these, only that
            option is shown.
          </p>
        </div>
      </div>
    );
  }

  const inApp = data.openIn === "in-app";
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Open In</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.openIn === "external"}
            onSelect={() => update({ openIn: "external" })}
            title="External Browser"
            desc="Opens in the device's default browser, or a new tab on Web."
          />
          <RadioCard
            selected={inApp}
            onSelect={() => update({ openIn: "in-app" })}
            title="In-App Browser"
            desc="Opens in a webview inside the SkillCat app. Keeps learners in the app and unlocks the orientation control below."
          />
        </div>
        <p className="form-help">
          Where the link opens when a learner starts the Task. External Browser
          is the default. A SkillCat Deep Link always opens the respective page
          within the app.
        </p>
      </div>

      {inApp && (
        <OrientationField
          data={data}
          update={update}
          sub="Rotation settings only applicable for the In-App Browser. Applies to mobile phones only. On iPads, orientation is never locked. On Web the layout adapts to the window size — these settings have no effect there."
        />
      )}
    </div>
  );
}


/* ─────────────────  Hands-On step components  ───────────────── */

function HandsOnBasicStep({ data, update, nameError }: StepProps) {
  return (
    <>
      <NameAndDescription data={data} update={update} nameError={nameError} />
      <TimeToCompleteField data={data} update={update} />
      <VisibilityField data={data} update={update} />
      <SubscriptionAccessField data={data} update={update} />
    </>
  );
}

function HandsOnReferenceStep({ data, update }: StepProps) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Reference Files</label>
        <PackageField
          enFiles={data.hoFilesEn}
          esFiles={data.hoFilesEs}
          setEnFiles={(files) => update({ hoFilesEn: files })}
          setEsFiles={(files) => update({ hoFilesEs: files })}
          accept="PDF, images, video"
        />
        <p className="form-help">
          Files learners download before they start — separate uploads per
          language, multiple files allowed. If no Spanish file is added, Spanish
          learners get the English files.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Instructions</label>
        <RichTextField
          en={data.hoInstrEn}
          es={data.hoInstrEs}
          onChangeEn={(v) => update({ hoInstrEn: v })}
          onChangeEs={(v) => update({ hoInstrEs: v })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Tools / Materials Required</label>
        <RichTextField
          en={data.hoToolsEn}
          es={data.hoToolsEs}
          onChangeEn={(v) => update({ hoToolsEn: v })}
          onChangeEs={(v) => update({ hoToolsEs: v })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Reviewer Checklist</label>
        <SingleRichText
          value={data.hoReviewerChecklist}
          onChange={(v) => update({ hoReviewerChecklist: v })}
        />
        <p className="form-help">
          Only the reviewer sees this while grading a submission — learners
          never see it.
        </p>
      </div>
    </>
  );
}

function HandsOnSubmissionStep({ data, update }: StepProps) {
  const types = data.hoMediaTypes;
  const setType = (k: keyof MediaTypes, v: boolean) =>
    update({ hoMediaTypes: { ...types, [k]: v } });
  const noneSelected = !types.images && !types.videos && !types.audio;

  return (
    <>
      <div className="form-group">
        <label className="form-label">Project Description</label>
        <div className="time-row">
          <input
            className="form-input no-spinner small"
            inputMode="numeric"
            value={data.hoProjectDescLimit}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d+$/.test(v)) update({ hoProjectDescLimit: v });
            }}
          />
          <span className="form-suffix">character limit</span>
        </div>
        <p className="form-help">
          The free-text write-up a learner submits with their work.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Media Files</label>
        <div className="time-row">
          <input
            className="form-input no-spinner small"
            inputMode="numeric"
            value={data.hoMediaMax}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || (/^\d+$/.test(v) && +v >= 0 && +v <= 10))
                update({ hoMediaMax: v });
            }}
          />
          <span className="form-suffix">files maximum (0–10)</span>
        </div>
        <p className="form-help">
          How many media files a learner can attach to a submission.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Media File Types Allowed</label>
        <div className="review-list">
          <Toggle
            checked={types.images}
            onChange={(v) => setType("images", v)}
            label="Images"
          />
          <Toggle
            checked={types.videos}
            onChange={(v) => setType("videos", v)}
            label="Videos"
          />
          <Toggle
            checked={types.audio}
            onChange={(v) => setType("audio", v)}
            label="Audio"
          />
        </div>
        {noneSelected && (
          <p className="form-help error">Select at least one media type.</p>
        )}
        <p className="form-help">
          Pick one or more. At least one type must be allowed.
        </p>
      </div>
    </>
  );
}

function HandsOnCompletionStep({ data, update, criteriaLocked, onUnlockCriteria }: StepProps) {
  const limited = data.maxAttemptsMode === "limited";
  const reviewerGrade = data.hoCompletion === "reviewer_grade";

  return (
    <CompletionCriteriaGate locked={!!criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
      <div className="form-group">
        <label className="form-label">Maximum Attempts</label>
        <div className="radio-card-group">
          <button
            type="button"
            className={`radio-card ${limited ? "selected" : ""}`}
            onClick={() => update({ maxAttemptsMode: "limited" })}
          >
            <span className="radio-dot" />
            <div className="radio-card-text">
              <div className="radio-card-title">
                Limit to{" "}
                <input
                  type="text"
                  inputMode="numeric"
                  className="inline-num"
                  value={data.maxAttempts}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || (/^\d+$/.test(v) && +v >= 1 && +v <= 10))
                      update({ maxAttempts: v });
                  }}
                />{" "}
                attempts
              </div>
              <div className="radio-card-desc">1–10 attempts. Admins can grant more later.</div>
            </div>
          </button>
          <RadioCard
            selected={!limited}
            onSelect={() => update({ maxAttemptsMode: "unlimited" })}
            title="Unlimited attempts"
          />
        </div>
        <p className="form-help">How many times a learner can submit this Task.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Completion</label>
        <div className="radio-card-group">
          <RadioCard
            selected={reviewerGrade}
            onSelect={() => update({ hoCompletion: "reviewer_grade" })}
            title="Passing grade from reviewer"
            desc="Completes when the learner receives a score equal to or greater than the passing grade from the reviewer."
          />
          <RadioCard
            selected={!reviewerGrade}
            onSelect={() => update({ hoCompletion: "submission_made" })}
            title="Submission made"
            desc="The Task is completed as soon as the learner makes a submission. No review or scoring is required."
          />
        </div>
        <p className="form-help">What marks this Task complete for a learner.</p>
      </div>

      {reviewerGrade && (
        <div className="form-group">
          <label className="form-label">Passing Grade</label>
          <div className="time-row">
            <input
              className="form-input no-spinner small"
              inputMode="numeric"
              value={data.hoPassingGrade}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || (/^\d+$/.test(v) && +v >= 1 && +v <= 10))
                  update({ hoPassingGrade: v });
              }}
            />
            <span className="form-suffix">out of 10 (default 5)</span>
          </div>
        </div>
      )}
    </CompletionCriteriaGate>
  );
}

/* Visible/Hidden itself moved to Basic Info; this step keeps what's left of the
   old Visibility page — search/browse discoverability and Content Tags. */
function HandsOnDiscoveryStep({ data, update }: StepProps) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Discoverable</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.discoverable}
            onSelect={() => update({ discoverable: true })}
            title="Yes"
            desc="Learners can find this Task by searching and browsing."
          />
          <RadioCard
            selected={!data.discoverable}
            onSelect={() => update({ discoverable: false })}
            title="No"
            desc="Hidden from search and browse — reachable only via direct assignment or a link."
          />
        </div>
        <p className="form-help">
          Whether this Task surfaces in search and browse, separate from its
          visibility.
        </p>
      </div>

      <ContentTagsSection data={data} update={update} />
    </>
  );
}

/* ─── Content Tags for Visibility (identical to the Certification wizard) ─── */
function ContentTagsSection({ data, update }: StepProps) {
  const [showHelp, setShowHelp] = useState(false);

  function addTag(type: ContentTagType, value: string) {
    if (!value) return;
    if (data.contentTags.some((t) => t.type === type && t.value === value)) return;
    update({
      contentTags: [
        ...data.contentTags,
        { id: `ct-${type}-${Date.now()}`, type, value },
      ],
    });
  }

  function removeTag(id: string) {
    update({ contentTags: data.contentTags.filter((t) => t.id !== id) });
  }

  // Live read-out of the current scope, so the admin sees the effect of the tags
  // they've set without opening the full help panel.
  const hasTradeOrPartner = data.contentTags.some(
    (t) => t.type === "trade" || t.type === "partnership",
  );
  const isB2BOnly = data.contentTags.some((t) => t.type === "userType");
  const scopeNote = !hasTradeOrPartner && !isB2BOnly
    ? "No tags set — visible to all Tenants, including B2C."
    : isB2BOnly && hasTradeOrPartner
      ? "Hidden from B2C. Visible only to B2B Tenants matching the Trade/Partnership filters below."
      : isB2BOnly
        ? "Hidden from B2C. Visible to all B2B Tenants."
        : "Hidden from B2C (Trade/Partnership scoped). Visible to B2B Tenants matching the filters below.";

  return (
    <div className="form-group">
      <div className="cv-section-head">
        <label className="form-label">Content Tags for Visibility</label>
        <button
          type="button"
          className="cv-help-toggle"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
        >
          <VisibilityInfoIcon />
          {showHelp ? "Hide details" : "How visibility works"}
        </button>
      </div>

      {showHelp && <VisibilityHelpPanel />}

      {CONTENT_TAG_GROUPS.map((group) => {
        const tags = data.contentTags.filter((t) => t.type === group.type);
        const remaining = group.options.filter(
          (o) => !tags.some((t) => t.value === o),
        );
        return (
          <div key={group.type} className="form-sub-group">
            <label className="form-sub-label">{group.label}</label>
            <div className="tag-edit-row">
              {tags.map((t) => (
                <span key={t.id} className="tag-edit">
                  {t.value}
                  <button
                    className="tag-edit-x"
                    onClick={() => removeTag(t.id)}
                    aria-label={`Remove ${group.label} tag ${t.value}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <select
                className="form-select content-tag-select"
                value=""
                disabled={remaining.length === 0}
                onChange={(e) => {
                  addTag(group.type, e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  {remaining.length === 0
                    ? group.type === "userType" ? "B2B Only added" : "All added"
                    : group.placeholder}
                </option>
                {remaining.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <p className="form-help">{group.help}</p>
          </div>
        );
      })}

      <p className="form-help">
        Tag this Task to control which Tenants can see it. Trade and Partnership
        values come from the B2B Management fields in Product Config, and a
        Tenant must match every tag type you set (within a type, matching any
        one value is enough). Add as many tags of each type as you need.
      </p>

      <div className="cv-scope-note">
        <span className="cv-scope-dot" />
        {scopeNote}
      </div>
    </div>
  );
}

/* ─────────────────  Quiz step components  ───────────────── */

function QuizBasicsStep({ data, update, nameError }: StepProps) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Quiz name <span className="req">*</span>
        </label>
        <LangField
          en={data.nameEn}
          es={data.nameEs}
          onChangeEn={(v) => update({ nameEn: v })}
          onChangeEs={(v) => update({ nameEs: v })}
          placeholderEn="Quiz name"
          placeholderEs="Nombre del cuestionario"
          error={nameError}
          errorMessage="Enter a Quiz name to publish."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
        />
      </div>

      <TimeToCompleteField data={data} update={update} />
      <VisibilityField data={data} update={update} />
      <SubscriptionAccessField data={data} update={update} />
    </>
  );
}

function QuizStructureStep({ data, update, locked }: StepProps) {
  const sectioned = data.structure === "sectioned";

  const updateSection = (id: string, patch: Partial<QuizSection>) =>
    update({
      sections: data.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const addSection = () =>
    update({
      sections: [
        ...data.sections,
        {
          id: `sec${Date.now()}`,
          name: "",
          nameEs: "",
          passingPct: "70",
          requiredToPass: false,
          staticQuestions: [],
          randomPools: [],
        },
      ],
    });

  const removeSection = (id: string) =>
    update({ sections: data.sections.filter((s) => s.id !== id) });

  return (
    <div className={`step-lockable ${locked ? "locked" : ""}`}>
      {locked && (
        <div className="step-lock-overlay" role="note">
          <div className="step-lock-card">
            <div className="step-lock-icon">
              <LockIcon />
            </div>
            <div className="step-lock-title">Structure can't be changed after a Quiz is created</div>
            <p className="step-lock-text">
              Adding or removing Sections, or switching between a single block and Sections, is a
              structural change. Past attempts don't carry the data to re-evaluate completion under
              the new structure, so it can't be changed in place.
            </p>
            <p className="step-lock-text">
              You can still adjust recomputable settings like passing grades in{" "}
              <strong>Grading &amp; Completion</strong>. To change the structure itself, create a new
              Quiz Task instead.
            </p>
          </div>
        </div>
      )}

      <fieldset className="step-lock-content" disabled={locked}>
        <div className="form-group">
          <label className="form-label">Structure</label>
          <div className="radio-card-group">
            <RadioCard
              selected={!sectioned}
              onSelect={() => update({ structure: "single_block", gradingModel: "quiz_level" })}
              title="Single block of questions"
              desc="One question list, one overall score. The default — best for mid-course assessments and simple final exams."
              disabled={locked}
            />
            <RadioCard
              selected={sectioned}
              onSelect={() => update({ structure: "sectioned" })}
              title="One or more Quiz Sections"
              desc="Each Section has its own questions and can be graded independently. Used for EPA/NATE-style exams. Grading rules are set in the Grading & Completion step."
              disabled={locked}
            />
          </div>
          <p className="form-help">
            A single block is one flat question list with one overall score.
            Sectioned splits the Quiz into named groups that can be graded
            independently.
          </p>
        </div>

        {sectioned && (
          <div className="form-group">
            <label className="form-label">Sections</label>
            <div className="section-list">
                {data.sections.map((s, i) => (
                  <div key={s.id} className="section-row">
                    <button className="section-drag" aria-label="Drag to reorder">
                      <DragHandleIcon />
                    </button>
                    <span className="section-order">{i + 1}</span>
                    <div className="section-fields">
                      <input
                        className="form-input"
                        placeholder="Section name (English)"
                        value={s.name}
                        onChange={(e) => updateSection(s.id, { name: e.target.value })}
                      />
                      <input
                        className="form-input"
                        placeholder="Nombre de la sección (Español)"
                        value={s.nameEs}
                        onChange={(e) => updateSection(s.id, { nameEs: e.target.value })}
                      />
                    </div>
                    <button
                      className="section-remove"
                      aria-label="Remove section"
                      onClick={() => removeSection(s.id)}
                    >
                      <SmallXIcon />
                    </button>
                  </div>
                ))}
              </div>
              <button className="resource-add" onClick={addSection}>
                + Add Section
              </button>
            <p className="form-help">
              Drag to reorder. Each Section needs a name; its questions are set
              in the next step and its passing rules in Grading &amp;
              Completion.
            </p>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function QuizQuestionsStep({ data, update }: StepProps) {
  const sectioned = data.structure === "sectioned";

  const updateSection = (
    id: string,
    patch: { staticQuestions?: StaticQuestion[]; randomPools?: RandomPool[] },
  ) =>
    update({
      sections: data.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  return (
    <>
      {sectioned ? (
        data.sections.length === 0 ? (
          <p className="form-help">
            Add at least one Section in the Structure step to configure questions.
          </p>
        ) : (
          data.sections.map((s, i) => (
            <div key={s.id} className="form-group">
              <label className="form-label">{`Section ${i + 1}: ${s.name || "Untitled"}`}</label>
              <QuestionGroupEditor
                staticQuestions={s.staticQuestions}
                pools={s.randomPools}
                onChange={(patch) => updateSection(s.id, patch)}
              />
              {s.nameEs && <p className="form-help">{s.nameEs}</p>}
            </div>
          ))
        )
      ) : (
        <div className="form-group">
          <label className="form-label">Questions</label>
          <QuestionGroupEditor
            staticQuestions={data.blockStatic}
            pools={data.blockPools}
            onChange={(patch) =>
              update({
                ...(patch.staticQuestions ? { blockStatic: patch.staticQuestions } : {}),
                ...(patch.randomPools ? { blockPools: patch.randomPools } : {}),
              })
            }
          />
          <p className="form-help">
            The full list every learner draws from. Static questions appear for
            everyone; random pools draw a fresh set each attempt.
          </p>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Question Order</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.questionOrder === "fixed"}
            onSelect={() => update({ questionOrder: "fixed" })}
            title="Fixed order"
            desc="Questions appear in the order they were added."
          />
          <RadioCard
            selected={data.questionOrder === "shuffled"}
            onSelect={() => update({ questionOrder: "shuffled" })}
            title="Shuffled"
            desc="Questions are randomised on each attempt — the same learner sees a different order each time."
          />
        </div>
        <p className="form-help">
          Controls how Static questions are ordered. Random pool questions are
          always drawn in an unpredictable order.
        </p>
      </div>

      {sectioned && data.questionOrder === "shuffled" && (
        <div className="form-group">
          <label className="form-label">Shuffle Scope</label>
          <div className="radio-card-group">
            <RadioCard
              selected={data.shuffleScope === "within_section"}
              onSelect={() => update({ shuffleScope: "within_section" })}
              title="Within each Section"
              desc="Questions shuffle inside their Section; Sections keep their configured order."
            />
            <RadioCard
              selected={data.shuffleScope === "all"}
              onSelect={() => update({ shuffleScope: "all" })}
              title="Across all Sections"
              desc="All questions shuffle together. Sections lose their visual grouping for the learner."
            />
          </div>
        </div>
      )}
    </>
  );
}

function QuestionGroupEditor({
  staticQuestions,
  pools,
  onChange,
}: {
  staticQuestions: StaticQuestion[];
  pools: RandomPool[];
  onChange: (patch: {
    staticQuestions?: StaticQuestion[];
    randomPools?: RandomPool[];
  }) => void;
}) {
  const drawn = pools.reduce((n, p) => n + (parseInt(p.draw, 10) || 0), 0);

  // Which picker is open: adding statics, building a new pool, or editing an
  // existing pool's member questions.
  const [picker, setPicker] = useState<
    null | { mode: "static" } | { mode: "pool"; poolId?: string }
  >(null);

  // Selected Bank questions arrive in selection order and are appended to the
  // Quiz in that order.
  const addStaticFromBank = (ids: string[]) =>
    onChange({
      staticQuestions: [
        ...staticQuestions,
        ...ids
          .map((id) => GRADED_BANK.find((q) => q.id === id))
          .filter((q): q is Question => !!q)
          .map((q) => ({ id: q.id, text: q.text, type: q.type, weight: "1" })),
      ],
    });
  const setWeight = (id: string, weight: string) =>
    onChange({
      staticQuestions: staticQuestions.map((q) => (q.id === id ? { ...q, weight } : q)),
    });
  const removeStatic = (id: string) =>
    onChange({ staticQuestions: staticQuestions.filter((q) => q.id !== id) });

  const savePool = (ids: string[], poolId?: string) => {
    if (poolId) {
      onChange({
        randomPools: pools.map((p) => (p.id === poolId ? { ...p, questionIds: ids } : p)),
      });
    } else {
      onChange({
        randomPools: [
          ...pools,
          {
            id: `p${Date.now()}`,
            name: `Random pool ${pools.length + 1}`,
            questionIds: ids,
            draw: String(Math.min(5, ids.length)),
            weight: "1",
          },
        ],
      });
    }
  };
  const setDraw = (id: string, draw: string) =>
    onChange({ randomPools: pools.map((p) => (p.id === id ? { ...p, draw } : p)) });
  const setPoolWeight = (id: string, weight: string) =>
    onChange({ randomPools: pools.map((p) => (p.id === id ? { ...p, weight } : p)) });
  const removePool = (id: string) =>
    onChange({ randomPools: pools.filter((p) => p.id !== id) });

  return (
    <div className="qbag">
      <div className="qbag-summary">
        <div className="qbag-summary-title">
          Per attempt{" "}
          <span className="muted">({staticQuestions.length + drawn} questions)</span>
        </div>
        <div className="qbag-summary-sub">
          {staticQuestions.length} static · {drawn} drawn from {pools.length} pool
          {pools.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="qsub-head">STATIC QUESTIONS</div>
      {staticQuestions.length === 0 && (
        <div className="qbag-empty">
          No static questions yet — add graded questions from the Question Bank.
        </div>
      )}
      {staticQuestions.map((q) => (
        <div key={q.id} className="q-row">
          <button className="qbag-drag" aria-label="Drag">
            <DragHandleIcon />
          </button>
          <button className="qbag-gear" aria-label="Question settings">
            <GearIcon />
          </button>
          <div className="qbag-q-text">
            {q.text}
            <span className="qbag-q-type"> · {q.type}</span>
          </div>
          <span className="form-suffix">weight</span>
          <input
            className="q-weight"
            value={q.weight}
            aria-label="Weightage"
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setWeight(q.id, v);
            }}
          />
          <button className="q-remove" aria-label="Remove question" onClick={() => removeStatic(q.id)}>
            <SmallXIcon />
          </button>
        </div>
      ))}
      <button className="resource-add" onClick={() => setPicker({ mode: "static" })}>
        + Add questions from Bank
      </button>

      <div className="qsub-head">RANDOM POOLS</div>
      {pools.map((p) => {
        const drawNum = parseInt(p.draw, 10) || 0;
        const size = p.questionIds.length;
        const over = drawNum > size;
        return (
          <div key={p.id} className="pool-row">
            <div className="pool-name">
              <div className="qbag-q-text">{p.name}</div>
              <div className="qbag-q-type">
                Pool of {size} from the Question Bank ·{" "}
                <button
                  className="qbag-pool-edit"
                  onClick={() => setPicker({ mode: "pool", poolId: p.id })}
                >
                  Edit pool
                </button>
              </div>
            </div>
            <div className="pool-draw">
              <span className="form-suffix">draw</span>
              <input
                className={`q-weight ${over ? "invalid" : ""}`}
                value={p.draw}
                aria-label="Number drawn per attempt"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d+$/.test(v)) setDraw(p.id, v);
                }}
              />
              <span className="form-suffix">/ {size}</span>
            </div>
            <div className="pool-draw">
              <span className="form-suffix">weight</span>
              <input
                className="q-weight"
                value={p.weight}
                aria-label="Weightage applied to every question in the pool"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setPoolWeight(p.id, v);
                }}
              />
              <span className="form-suffix">each</span>
            </div>
            <button className="q-remove" aria-label="Remove pool" onClick={() => removePool(p.id)}>
              <SmallXIcon />
            </button>
            {over && (
              <div className="pool-warn">Draw can't exceed the pool size ({size}).</div>
            )}
          </div>
        );
      })}
      <button className="resource-add" onClick={() => setPicker({ mode: "pool" })}>
        + Add random pool
      </button>

      {picker && (
        <QuizQuestionPickerModal
          mode={picker.mode}
          editingPool={picker.mode === "pool" && !!picker.poolId}
          excludeIds={picker.mode === "static" ? staticQuestions.map((q) => q.id) : []}
          initialSelected={
            picker.mode === "pool" && picker.poolId
              ? pools.find((p) => p.id === picker.poolId)?.questionIds ?? []
              : []
          }
          onConfirm={(ids) => {
            if (picker.mode === "static") addStaticFromBank(ids);
            else savePool(ids, picker.poolId);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

/* ----- Question Bank picker (Create Quiz → Questions) ----- */

type QuizPickerTypeFilter = "all" | Question["type"];

const QUIZ_PICKER_TYPES: { key: QuizPickerTypeFilter; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "Multiple choice", label: "Multiple choice" },
  { key: "Multiple select", label: "Multiple select" },
  { key: "True/False", label: "True/False" },
  { key: "Match the following", label: "Match the following" },
];

/** Multi-select picker over the Question Bank, limited to Active questions
 * with grading enabled. In `static` mode the selection order is tracked and
 * questions join the Quiz in that order; in `pool` mode order is irrelevant —
 * the pool is just a set the Quiz draws from at random. */
function QuizQuestionPickerModal({
  mode,
  editingPool,
  excludeIds,
  initialSelected,
  onConfirm,
  onClose,
}: {
  mode: "static" | "pool";
  editingPool: boolean;
  excludeIds: string[];
  initialSelected: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<QuizPickerTypeFilter>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const excluded = new Set(excludeIds);
  const q = query.trim().toLowerCase();
  const isPool = mode === "pool";
  const catOption = QUIZ_PICKER_CATS.find((o) => o.key === catFilter);

  const candidates = GRADED_BANK.filter((question) => {
    if (typeFilter !== "all" && question.type !== typeFilter) return false;
    if (catOption && !matchesCategory(question, catOption)) return false;
    if (
      q &&
      !(
        question.text.toLowerCase().includes(q) ||
        question.id.toLowerCase().includes(q) ||
        question.categoryPath.join(" > ").toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  const toggle = (id: string) =>
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id],
    );

  return (
    <div className="fb-modal-scrim" onClick={onClose}>
      <div
        className="fb-modal fb-modal--picker"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fb-modal-head">
          <div>
            <div className="sp-panel-eyebrow">QUESTION BANK</div>
            <h2 className="sp-panel-title">
              {isPool
                ? editingPool
                  ? "Edit random pool"
                  : "Build a random pool"
                : "Add questions"}
            </h2>
            <p className="sp-panel-sub">
              {isPool
                ? "Pick the questions this pool draws from. Each attempt draws a random subset, so selection order doesn't matter."
                : "Only Active questions with grading enabled can be added to a Quiz. Select multiple — they're added in the order you pick them."}
            </p>
          </div>
          <button className="sp-panel-close" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>

        <div className="fb-picker-controls">
          <div className="search-wrap fb-picker-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              placeholder="Search by text, ID, or category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <select
            className="fb-q-scale-select"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            aria-label="Filter by Category or Sub-Category"
          >
            <option value="all">All categories</option>
            {QUIZ_PICKER_CATS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            className="fb-q-scale-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as QuizPickerTypeFilter)}
          >
            {QUIZ_PICKER_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="fb-picker-list">
          {candidates.length === 0 ? (
            <div className="fb-empty">No matching graded questions.</div>
          ) : (
            candidates.map((question) => {
              const inQuiz = excluded.has(question.id);
              const order = selected.indexOf(question.id);
              const isSelected = order !== -1;
              return (
                <button
                  key={question.id}
                  className={`fb-picker-row ${isSelected ? "is-selected" : ""} ${inQuiz ? "is-linked" : ""}`}
                  disabled={inQuiz}
                  onClick={() => toggle(question.id)}
                >
                  <div className="fb-link-main">
                    <div className="fb-link-text">{question.text}</div>
                    <div className="fb-link-meta">
                      <span className="fb-link-id">{question.id}</span>
                      <span className="fb-link-chip">
                        {shortQuestionType(question.type)}
                      </span>
                      <span className="fb-link-chip">
                        {question.categoryPath.join(" > ")}
                      </span>
                      {question.quizzes.length > 0 && (
                        <span
                          className="fb-link-id"
                          title={question.quizzes.join(", ")}
                        >
                          used in {question.quizzes.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="fb-trigger-pick-cta">
                    {inQuiz ? (
                      <>
                        <CheckIcon /> In quiz
                      </>
                    ) : isSelected ? (
                      isPool ? (
                        <>
                          <CheckIcon /> Selected
                        </>
                      ) : (
                        <span className="qpick-order">{order + 1}</span>
                      )
                    ) : (
                      "+ Select"
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="fb-modal-footer">
          <div className="qpick-hint">
            {isPool
              ? `${selected.length} in pool`
              : selected.length === 0
                ? "Nothing selected yet."
                : `${selected.length} selected — added in this order.`}
          </div>
          <div className="fb-modal-footer-right">
            <button className="btn-save-draft" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-publish"
              disabled={selected.length === 0}
              onClick={() => onConfirm(selected)}
            >
              {isPool
                ? editingPool
                  ? `Update pool (${selected.length})`
                  : `Create pool (${selected.length})`
                : `Add ${selected.length} question${selected.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two-stage gate that protects completion-criteria fields while editing an
 * existing Task: a lock notice, then a delete-and-recompute warning the admin
 * must accept. Children render normally; when `locked` they sit inside a
 * disabled <fieldset> covered by the gate overlay. */
function CompletionCriteriaGate({
  locked,
  onUnlock,
  children,
}: {
  locked: boolean;
  onUnlock: () => void;
  children: React.ReactNode;
}) {
  const [showWarning, setShowWarning] = useState(false);
  return (
    <div className={`step-lockable ${locked ? "locked" : ""}`}>
      {locked && (
        <div className="step-lock-overlay interactive" role="note">
          <div className="step-lock-card">
            {!showWarning ? (
              <>
                <div className="step-lock-icon">
                  <LockIcon />
                </div>
                <div className="step-lock-title">Completion criteria are locked</div>
                <p className="step-lock-text">
                  Completion settings are locked to protect learners' existing completions. Editing
                  them recomputes completion for every learner.
                </p>
                <div className="step-lock-actions">
                  <button className="step-lock-btn primary" onClick={() => setShowWarning(true)}>
                    Edit completion criteria
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="step-lock-icon warning">
                  <LockIcon />
                </div>
                <div className="step-lock-title">This will delete and recompute completions</div>
                <p className="step-lock-text">
                  Editing the completion criteria <strong>deletes every existing completion</strong>{" "}
                  for this Task, then recomputes it from learners' existing attempts under the new
                  criteria. Underlying attempts, scores, and time data are never deleted. This can't
                  be undone.
                </p>
                <div className="step-lock-actions">
                  <button className="step-lock-btn" onClick={() => setShowWarning(false)}>
                    Cancel
                  </button>
                  <button className="step-lock-btn danger" onClick={onUnlock}>
                    Delete completions &amp; edit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <fieldset className="step-lock-content" disabled={locked}>
        {children}
      </fieldset>
    </div>
  );
}

function QuizGradingStep({ data, update, locked, criteriaLocked, onUnlockCriteria }: StepProps) {
  const sectioned = data.structure === "sectioned";
  const sectionLevel = data.gradingModel === "section_level";

  const updateSection = (id: string, patch: Partial<QuizSection>) =>
    update({
      sections: data.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  return (
    <>
      <div className="form-group">
        <label className="form-label">Grading Model</label>
        <div className="radio-card-group">
          <RadioCard
            selected={!sectionLevel}
            onSelect={() => update({ gradingModel: "quiz_level" })}
            title="Quiz-level"
            desc="One overall passing threshold for the whole Quiz."
            disabled={locked}
          />
          <RadioCard
            selected={sectionLevel}
            onSelect={() => update({ gradingModel: "section_level" })}
            disabled={locked || !sectioned}
            title="Section-level"
            desc={
              sectioned
                ? "Each Section has its own passing grade and is completed independently."
                : "Add Sections in the Structure step to enable section-level grading."
            }
          />
        </div>
        <p className="form-help">
          {locked
            ? "The grading model is part of the Quiz structure and is locked after creation. Passing grades below can still be adjusted."
            : sectioned
            ? "Quiz-level uses one overall threshold across all Sections (NATE-style — Sections exist for display only). Section-level grades each Section independently (EPA-style)."
            : "Single-block Quizzes are always graded at the Quiz level."}
        </p>
      </div>

      <CompletionCriteriaGate locked={!!criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
      {sectionLevel ? (
        <div className="form-group">
          <label className="form-label">Section Passing Grades</label>
          <div className="grade-rows">
            {data.sections.map((s, i) => (
              <div key={s.id} className="grade-row">
                <div className="grade-row-name">
                  Section {i + 1}: <strong>{s.name || "Untitled"}</strong>
                </div>
                <div className="grade-row-pct">
                  <input
                    className="form-input no-spinner small"
                    inputMode="numeric"
                    value={s.passingPct}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d{0,3}$/.test(v)) updateSection(s.id, { passingPct: v });
                    }}
                  />
                  <span className="form-suffix">% to pass</span>
                </div>
                <Toggle
                  inline
                  checked={s.requiredToPass}
                  onChange={(v) => updateSection(s.id, { requiredToPass: v })}
                  label="Required to pass"
                  disabled={locked}
                />
              </div>
            ))}
          </div>
          <p className="form-help">
            {locked
              ? "Passing grades can be edited — completion is recomputed from existing attempts. Whether a Section is Required to pass is structural and is locked after creation."
              : "Each Section is graded independently and may differ. Required-to-Pass Sections must be cleared in the same attempt for any Section pass to count."}
          </p>
        </div>
      ) : (
        <div className="form-group">
          <label className="form-label">Quiz Passing Grade</label>
          <div className="time-row">
            <input
              className="form-input no-spinner small"
              inputMode="numeric"
              value={data.quizPassingPct}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d{0,3}$/.test(v)) update({ quizPassingPct: v });
              }}
            />
            <span className="form-suffix">% to pass</span>
          </div>
          <p className="form-help">
            The overall score a learner must reach to pass.
          </p>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Score Calculation</label>
        <select className="form-select wide" value="highest" disabled>
          <option value="highest">Highest grade across attempts</option>
        </select>
        <p className="form-help">
          Locked in Version 1. Highest grade is the only method — it keeps the
          completion status stable across attempts.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Completion Criterion</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.quizCompletion === "passing_grade"}
            onSelect={() => update({ quizCompletion: "passing_grade" })}
            title="Passing grade"
            desc={
              sectionLevel
                ? "Completes when the learner has Section completion for every Section in the Quiz."
                : "Completes when the learner reaches the Quiz passing grade in a single attempt."
            }
          />
          <RadioCard
            selected={data.quizCompletion === "none"}
            onSelect={() => update({ quizCompletion: "none" })}
            title="No completion tracking"
            desc="The Quiz is never marked complete — useful for practice or ungraded checks."
          />
        </div>
        <p className="form-help">What marks this Quiz Task complete for a learner.</p>
      </div>
      </CompletionCriteriaGate>
    </>
  );
}

function QuizAttemptsStep({ data, update }: StepProps) {
  const limited = data.maxAttemptsMode === "limited";

  return (
    <>
      <div className="form-group">
        <label className="form-label">Maximum Attempts</label>
        <div className="radio-card-group">
          <button
            type="button"
            className={`radio-card ${limited ? "selected" : ""}`}
            onClick={() => update({ maxAttemptsMode: "limited" })}
          >
            <span className="radio-dot" />
            <div className="radio-card-text">
              <div className="radio-card-title">
                Limit to{" "}
                <input
                  type="text"
                  inputMode="numeric"
                  className="inline-num"
                  value={data.maxAttempts}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || (/^\d+$/.test(v) && +v >= 1 && +v <= 10))
                      update({ maxAttempts: v });
                  }}
                />{" "}
                attempts
              </div>
              <div className="radio-card-desc">1–10 attempts. Admins can grant more later.</div>
            </div>
          </button>
          <RadioCard
            selected={!limited}
            onSelect={() => update({ maxAttemptsMode: "unlimited" })}
            title="Unlimited attempts"
          />
        </div>
        <p className="form-help">
          How many times a learner can attempt this Quiz. Quiz-level.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Cooldown Between Attempts</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.cooldownMode === "none"}
            onSelect={() => update({ cooldownMode: "none" })}
            title="No cooldown"
            desc="Learners can start the next attempt immediately."
          />
          <RadioCard
            selected={data.cooldownMode === "uniform"}
            onSelect={() => update({ cooldownMode: "uniform" })}
            title="Same cooldown between all attempts"
          />
          <RadioCard
            selected={data.cooldownMode === "variable"}
            onSelect={() => update({ cooldownMode: "variable" })}
            title="Different cooldown between specific attempts"
            desc="Set a custom gap before specific attempts; unset pairs fall back to the uniform cooldown."
          />
        </div>

        {data.cooldownMode === "uniform" && (
          <div className="form-sub-group" style={{ marginTop: 16 }}>
            <div className="time-row">
              <input
                className="form-input no-spinner small"
                inputMode="numeric"
                value={data.cooldownMinutes}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d+$/.test(v)) update({ cooldownMinutes: v });
                }}
              />
              <span className="form-suffix">minutes</span>
            </div>
          </div>
        )}
        {data.cooldownMode === "variable" && (
          <VariableCooldownEditor data={data} update={update} />
        )}
        <p className="form-help">
          Optional wait before a learner can start the next attempt. Begins when
          an attempt is submitted, or when the timer runs out — whichever is
          first.
        </p>
      </div>

      <div className="form-group">
        <Toggle
          checked={data.autoAttempts}
          onChange={(v) => update({ autoAttempts: v })}
          label="Auto-Unlock Additional Attempts"
          sub="Automatically grant extra attempts once the learner completes specific Tasks. All trigger Tasks must complete to unlock; the extras stack with remaining and manually granted attempts."
        />
        {data.autoAttempts && (
          <div className="form-sub-group" style={{ marginTop: 16 }}>
            <label className="form-sub-label">Attempts to unlock</label>
            <input
              className="form-input no-spinner small"
              inputMode="numeric"
              value={data.autoAttemptsCount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) update({ autoAttemptsCount: v });
              }}
            />
            <label className="form-sub-label" style={{ marginTop: 18 }}>
              Unlock after completing all of
            </label>
            <TriggerTaskEditor data={data} update={update} />
          </div>
        )}
      </div>

      <div className="form-group">
        <Toggle
          checked={data.timeLimitOn}
          onChange={(v) => update({ timeLimitOn: v })}
          label="Time Limit"
          sub="Optional. The timer starts when questions first appear and can't be paused — the attempt auto-submits at zero."
        />
        {data.timeLimitOn && (
          <div className="form-sub-group" style={{ marginTop: 16 }}>
            <div className="time-row">
              <input
                className="form-input no-spinner small"
                inputMode="numeric"
                value={data.timeLimitMinutes}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d+$/.test(v)) update({ timeLimitMinutes: v });
                }}
              />
              <span className="form-suffix">minutes</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function VariableCooldownEditor({ data, update }: StepProps) {
  const rows = data.variableCooldowns;

  const add = () => {
    const nextFrom = rows.length
      ? Math.max(...rows.map((r) => r.fromAttempt)) + 1
      : 1;
    update({
      variableCooldowns: [...rows, { id: `vc${Date.now()}`, fromAttempt: nextFrom, minutes: "" }],
    });
  };
  const set = (id: string, minutes: string) =>
    update({ variableCooldowns: rows.map((r) => (r.id === id ? { ...r, minutes } : r)) });
  const remove = (id: string) =>
    update({ variableCooldowns: rows.filter((r) => r.id !== id) });

  return (
    <div className="form-sub-group" style={{ marginTop: 16 }}>
      <div className="price-rows">
        {rows.map((r) => (
          <div key={r.id} className="price-row">
            <div className="price-row-text">
              <div className="price-row-title">
                Between attempts {r.fromAttempt} and {r.fromAttempt + 1}
              </div>
            </div>
            <div className="time-row">
              <input
                className="form-input no-spinner small"
                inputMode="numeric"
                value={r.minutes}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d+$/.test(v)) set(r.id, v);
                }}
              />
              <span className="form-suffix">min</span>
            </div>
            <button className="price-row-x" aria-label="Remove cooldown" onClick={() => remove(r.id)}>
              <SmallXIcon />
            </button>
          </div>
        ))}
        <button className="price-add" onClick={add}>
          + Add a cooldown pair
        </button>
      </div>
    </div>
  );
}

function TriggerTaskEditor({ data, update }: StepProps) {
  const rows = data.autoAttemptTriggers;
  const [pickerOpen, setPickerOpen] = useState(false);

  const remove = (id: string) =>
    update({ autoAttemptTriggers: rows.filter((t) => t.id !== id) });

  return (
    <div className="trigger-list">
      {rows.length === 0 && (
        <div className="qbag-empty">No trigger Tasks yet — add the Tasks that unlock the extra attempts.</div>
      )}
      {rows.map((t) => (
        <div key={t.id} className="trigger-row">
          <span className="trigger-name">{t.name}</span>
          <span className="trigger-id">{t.id}</span>
          <button className="section-remove" aria-label="Remove trigger" onClick={() => remove(t.id)}>
            <SmallXIcon />
          </button>
        </div>
      ))}
      <button className="resource-add" onClick={() => setPickerOpen(true)}>
        + Add trigger Tasks
      </button>

      {pickerOpen && (
        <TriggerTaskPickerModal
          selected={rows}
          onConfirm={(sel) => {
            update({ autoAttemptTriggers: sel });
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/** Simple table picker over the Tasks list for auto-unlock triggers. Selection
 * is applied on confirm, so the modal handles both adding and removing. */
function TriggerTaskPickerModal({
  selected,
  onConfirm,
  onClose,
}: {
  selected: TriggerTask[];
  onConfirm: (sel: TriggerTask[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<TriggerTask[]>(selected);

  const q = query.trim().toLowerCase();
  const candidates = ALL_TASKS.filter(
    (t) =>
      !t.draft &&
      (!q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)),
  );

  const isSelected = (id: string) => sel.some((t) => t.id === id);
  const toggle = (t: Task) =>
    setSel((s) =>
      isSelected(t.id) ? s.filter((x) => x.id !== t.id) : [...s, { id: t.id, name: t.name }],
    );

  return (
    <div className="fb-modal-scrim" onClick={onClose}>
      <div
        className="fb-modal fb-modal--picker"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fb-modal-head">
          <div>
            <div className="sp-panel-eyebrow">TASKS</div>
            <h2 className="sp-panel-title">Select trigger Tasks</h2>
            <p className="sp-panel-sub">
              The learner must complete every selected Task to unlock the additional attempts.
            </p>
          </div>
          <button className="sp-panel-close" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>

        <div className="fb-picker-controls">
          <div className="search-wrap fb-picker-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              placeholder="Search Tasks by name or ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="fb-picker-list">
          {candidates.length === 0 ? (
            <div className="fb-empty">No matching Tasks.</div>
          ) : (
            <table className="tt-table">
              <thead>
                <tr>
                  <th />
                  <th>ID</th>
                  <th>Name</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((t) => {
                  const on = isSelected(t.id);
                  return (
                    <tr
                      key={t.id}
                      className={on ? "is-selected" : ""}
                      onClick={() => toggle(t)}
                    >
                      <td>
                        <span className={`checkbox ${on ? "checked" : ""}`}>
                          {on && <CheckIcon />}
                        </span>
                      </td>
                      <td className="tt-id">{t.id}</td>
                      <td>{t.name}</td>
                      <td className="tt-type">{t.type}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="fb-modal-footer">
          <div className="qpick-hint">
            {sel.length === 0 ? "No Tasks selected." : `${sel.length} Task${sel.length === 1 ? "" : "s"} selected.`}
          </div>
          <div className="fb-modal-footer-right">
            <button className="btn-save-draft" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-publish" onClick={() => onConfirm(sel)}>
              Save selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizIntegrityStep({ data, update }: StepProps) {
  return (
    <>
      <div className="form-group">
        <Toggle
          checked={data.proctoring}
          onChange={(v) => update({ proctoring: v })}
          label="Proctoring"
          stateOn="Yes: Proctoring Required"
          stateOff="No: Proctoring Not Required"
          sub="Quiz-level — capture frequency is a system-level setting and isn't configured here. Passing attempts enter In-Review until the Proctoring Team approves the footage; completion isn't recorded until then."
        />
      </div>

      <div className="form-group">
        <label className="form-label">In-Quiz Resources</label>
        <ResourceEditor data={data} update={update} />
        <p className="form-help">
          Materials a learner can open throughout the attempt — e.g. EPA PT
          charts. Multiple allowed.
        </p>
      </div>
    </>
  );
}

// Existing Resources learners can open in-quiz, selectable alongside uploads.
const EXISTING_QUIZ_RESOURCES = ["PT Chart (Old)", "PT Chart (New)"];

function ResourceEditor({ data, update }: StepProps) {
  const rows = data.inQuizResources;
  const uploads = rows.filter((r) => r.kind === "upload");

  const addUploads = (files: UploadedFile[]) =>
    update({
      inQuizResources: [
        ...rows,
        ...files.map((f) => ({
          id: `r-${f.id}`,
          kind: "upload" as const,
          name: f.name,
          size: f.size,
          ext: f.ext,
        })),
      ],
    });
  const remove = (id: string) =>
    update({ inQuizResources: rows.filter((r) => r.id !== id) });

  const hasExisting = (name: string) =>
    rows.some((r) => r.kind === "existing" && r.name === name);
  const toggleExisting = (name: string) =>
    update({
      inQuizResources: hasExisting(name)
        ? rows.filter((r) => !(r.kind === "existing" && r.name === name))
        : [...rows, { id: `r-${name}`, kind: "existing" as const, name }],
    });

  return (
    <div className="resource-edit-list">
      <label className="form-sub-label">Upload files</label>
      {uploads.length > 0 && (
        <div className="file-list">
          {uploads.map((r) => (
            <div key={r.id} className="file-row">
              <span className="file-icon">
                <DocumentIcon />
              </span>
              <div className="file-meta">
                <div className="file-name">{r.name}</div>
                {r.size != null && (
                  <div className="file-sub">
                    {formatSize(r.size)} · {r.ext}
                  </div>
                )}
              </div>
              <button
                className="file-remove"
                aria-label="Remove file"
                onClick={() => remove(r.id)}
              >
                <SmallXIcon />
              </button>
            </div>
          ))}
        </div>
      )}
      <FilePicker onPick={addUploads}>
        {(open) => (
          <button className="resource-add" onClick={open} type="button">
            + Upload a file
          </button>
        )}
      </FilePicker>

      <label className="form-sub-label" style={{ marginTop: 18 }}>
        Existing Resources
      </label>
      {EXISTING_QUIZ_RESOURCES.map((name) => {
        const on = hasExisting(name);
        return (
          <button
            key={name}
            type="button"
            className={`qres-existing ${on ? "is-on" : ""}`}
            onClick={() => toggleExisting(name)}
          >
            <span className={`checkbox ${on ? "checked" : ""}`}>
              {on && <CheckIcon />}
            </span>
            {name}
          </button>
        );
      })}
    </div>
  );
}

function QuizReviewStep({ data, update }: StepProps) {
  const sectioned = data.structure === "sectioned";
  const quizLevel = data.gradingModel === "quiz_level";
  const r = data.review;
  const setR = (patch: Partial<ReviewOptions>) => update({ review: { ...r, ...patch } });

  return (
    <div className="form-group">
      <label className="form-label">What the Learner Sees After Submitting</label>
      <div className="review-list">
        <Toggle
          checked={r.attempt}
          onChange={(v) => setR({ attempt: v })}
          label="Attempt"
          sub="The questions in the attempt and the learner's own answers. Everything else builds on this."
        />
        <Toggle
          checked={r.attempt && quizLevel && r.quizResult}
          onChange={(v) => setR({ quizResult: v })}
          disabled={!r.attempt || !quizLevel}
          label="Quiz Result"
          sub={
            !r.attempt
              ? "Requires Attempt review."
              : quizLevel
                ? "Overall pass/fail for the Quiz."
                : "Only available under Quiz-level grading — Section-level Quizzes show pass/fail per Section instead."
          }
        />
        <Toggle
          checked={r.attempt && r.quizScore}
          onChange={(v) => setR({ quizScore: v })}
          disabled={!r.attempt}
          label="Quiz Score"
          sub={!r.attempt ? "Requires Attempt review." : "The overall score achieved."}
        />
        <Toggle
          checked={r.attempt && r.whetherCorrect}
          onChange={(v) => setR({ whetherCorrect: v })}
          disabled={!r.attempt}
          label="Whether Correct"
          sub={
            !r.attempt
              ? "Requires Attempt review."
              : "Per question: correct, incorrect, or partially correct."
          }
        />
        <Toggle
          checked={r.attempt && r.whetherCorrect && r.perQuestionFeedback}
          onChange={(v) => setR({ perQuestionFeedback: v })}
          disabled={!r.attempt || !r.whetherCorrect}
          label="Per-Question Feedback"
          sub={
            !r.attempt
              ? "Requires Attempt review."
              : !r.whetherCorrect
                ? "Only available when Whether Correct is on — feedback is shown against each judged question."
                : "The feedback authored on each question."
          }
        />
        <Toggle
          checked={r.attempt && sectioned && r.perSectionResults}
          onChange={(v) => setR({ perSectionResults: v })}
          disabled={!r.attempt || !sectioned}
          label="Per-Section Results"
          sub={
            !r.attempt
              ? "Requires Attempt review."
              : sectioned
                ? "Each Section's score (and pass/fail under Section-level grading), plus the cumulative Section completion record."
                : "Only available when the Quiz is sectioned."
          }
        />
      </div>
      <p className="form-help">
        Select everything that should appear on the results screen after an
        attempt is submitted.
      </p>
    </div>
  );
}

function QuizPaymentsStep({ data, update, missing }: StepProps) {
  return (
    <>
      <div className="form-group">
        <Toggle
          checked={data.paywallOn}
          onChange={(v) => update({ paywallOn: v })}
          label="Paywall"
          stateOn="Yes: Attempts Are Charged"
          stateOff="No: Attempts Are Free"
          sub="Charge for attempts. By default one price applies to every attempt; pricing can also differ by attempt number — e.g. NATE RTW is $60 for the first attempt and $45 thereafter."
        />
        {data.paywallOn && <PaywallPricing data={data} update={update} />}
      </div>

      <div className="form-group">
        <Toggle
          checked={data.nateExam}
          onChange={(v) => update({ nateExam: v })}
          label="NATE Exam"
          stateOn="Yes: This is a NATE Exam"
          stateOff="No: Not a NATE Exam"
          sub="Flag this Quiz as a NATE exam to trigger NATE-specific behaviour. The External IDs are sent when communicating with NATE's API."
        />
        {data.nateExam && (
          <div className="form-sub-group" style={{ marginTop: 16 }}>
            <label className="form-sub-label">
              External ID (English) <span className="req">*</span>
            </label>
            <input
              className={`form-input${missing?.has("nateId") && !data.nateIdEn.trim() ? " has-error" : ""}`}
              value={data.nateIdEn}
              placeholder="NATE-assigned exam ID (EN)"
              onChange={(e) => update({ nateIdEn: e.target.value })}
            />
            <label className="form-sub-label" style={{ marginTop: 18 }}>
              External ID (Spanish) <span className="req">*</span>
            </label>
            <input
              className={`form-input${missing?.has("nateId") && !data.nateIdEs.trim() ? " has-error" : ""}`}
              value={data.nateIdEs}
              placeholder="NATE-assigned exam ID (ES)"
              onChange={(e) => update({ nateIdEs: e.target.value })}
            />
            {missing?.has("nateId") ? (
              <p className="form-error-text">Both IDs are required when NATE Exam is enabled.</p>
            ) : (
              <p className="form-help">Both IDs are required when NATE Exam is enabled.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function PaywallPricing({ data, update }: StepProps) {
  const perAttempt = data.paywallMode === "per_attempt";

  return (
    <div className="form-sub-group" style={{ marginTop: 16 }}>
      <div className="radio-card-group">
        <RadioCard
          selected={!perAttempt}
          onSelect={() => update({ paywallMode: "common" })}
          title="Same price for all attempts"
          desc="One price is charged for every attempt."
        />
        <RadioCard
          selected={perAttempt}
          onSelect={() => update({ paywallMode: "per_attempt" })}
          title="Different price per attempt"
          desc="Set the first attempt and all subsequent attempts, and optionally specific attempts in between."
        />
      </div>

      {perAttempt ? (
        <PerAttemptPrices data={data} update={update} />
      ) : (
        <div className="form-sub-group" style={{ marginTop: 16 }}>
          <label className="form-sub-label">Price IDs for every attempt</label>
          <PriceIdFields
            value={data.commonPriceIds}
            onChange={(ids) => update({ commonPriceIds: ids })}
          />
        </div>
      )}

      <p className="form-help">
        Each price point maps to four products — Google, Apple, Stripe (B2C), and Stripe (B2B). Enter the Price ID for each.
      </p>
    </div>
  );
}

function PerAttemptPrices({ data, update }: StepProps) {
  const rows = data.attemptPrices;
  const nextNum = rows.length + 1;

  const setRow = (id: string, priceIds: PriceIds) =>
    update({ attemptPrices: rows.map((r) => (r.id === id ? { ...r, priceIds } : r)) });
  const addNext = () =>
    update({
      attemptPrices: [
        ...rows,
        { id: `ap${Date.now()}`, attempt: String(nextNum), priceIds: newPriceIds() },
      ],
    });
  // Removing the last numbered attempt keeps the list contiguous (1, 2, 3 …).
  const removeLast = () => update({ attemptPrices: rows.slice(0, -1) });

  return (
    <div className="form-sub-group" style={{ marginTop: 16 }}>
      <div className="price-rows">
        {rows.map((row, i) => {
          const removable = i === rows.length - 1 && rows.length > 1;
          return (
            <div key={row.id} className="price-id-block">
              <div className="price-id-block-head">
                <div className="price-id-block-title">Attempt {row.attempt}</div>
                {removable && (
                  <button
                    className="price-row-x"
                    aria-label={`Remove attempt ${row.attempt} price`}
                    onClick={removeLast}
                  >
                    <SmallXIcon />
                  </button>
                )}
              </div>
              <PriceIdFields value={row.priceIds} onChange={(ids) => setRow(row.id, ids)} />
            </div>
          );
        })}

        {/* All subsequent attempts — always present, always at the bottom. */}
        <div className="price-id-block">
          <div className="price-id-block-head">
            <div className="price-id-block-title">All subsequent attempts</div>
          </div>
          <PriceIdFields
            value={data.subsequentPriceIds}
            onChange={(ids) => update({ subsequentPriceIds: ids })}
          />
        </div>
      </div>

      <button className="price-add" onClick={addNext}>
        + Add Price IDs for attempt {nextNum}
      </button>
    </div>
  );
}

/* ─────────────────  Shared sub-blocks  ───────────────── */

function NameAndDescription({ data, update, nameError }: StepProps) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Name <span className="req">*</span>
        </label>
        <LangField
          en={data.nameEn}
          es={data.nameEs}
          onChangeEn={(v) => update({ nameEn: v })}
          onChangeEs={(v) => update({ nameEs: v })}
          placeholderEn="Name"
          placeholderEs="Nombre"
          error={nameError}
          errorMessage="Enter a name to publish."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
        />
      </div>
    </>
  );
}

function TimeToCompleteField({ data, update }: StepProps) {
  return (
    <div className="form-group">
      <label className="form-label">Time to Complete</label>
      <div className="time-row">
        <input
          className="form-input no-spinner small"
          type="text"
          inputMode="numeric"
          value={data.timeValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d+$/.test(v)) update({ timeValue: v });
          }}
        />
        <SelectField
          value={TIME_UNIT_LABEL[data.timeUnit]}
          options={TIME_UNIT_OPTIONS}
          onChange={(v) => update({ timeUnit: TIME_UNIT_BY_LABEL[v] })}
        />
      </div>
      <p className="form-help">
        Estimated time required for the user to complete the Task
      </p>
    </div>
  );
}

/* Paywall flag (Figma 367:6411). Note this is NOT `finalExam` — the field used
   to write to the Certification's Final Exam flag, which drives the Tasks-list
   filter and the cert tree's pill. It has its own field now. A segmented
   control like Visibility: No = neutral active, Yes = the accent pill. */
function SubscriptionAccessField({ data, update }: StepProps) {
  const requires = data.requiresSubscription;
  return (
    <div className="form-group">
      <label className="form-label">Requires a Subscription to Access this Task?</label>
      <div className="seg-control">
        <button
          type="button"
          className={`seg-btn${!requires ? " active" : ""}`}
          aria-pressed={!requires}
          onClick={() => update({ requiresSubscription: false })}
        >
          No: Can Access on Free Trial
        </button>
        <button
          type="button"
          className={`seg-btn${requires ? " active accent" : ""}`}
          aria-pressed={requires}
          onClick={() => update({ requiresSubscription: true })}
        >
          Yes: Requires Subscription
        </button>
      </div>
      <p className="form-help">
        Recommendation: Tasks that complete a Certification should have this
        setting enabled. This is to prevent users from completing Certifications
        without subscribing.
      </p>
    </div>
  );
}

/* Visibility lives on every type's first step, under Time to Complete — a
   single-select rather than its own wizard page. Hidden takes the neutral
   active pill (Figma 359:2373); Visible takes the accent one (639:895). */
function VisibilityField({ data, update }: StepProps) {
  return (
    <div className="form-group">
      <label className="form-label">Visibility</label>
      <div className="seg-control">
        <button
          type="button"
          className={`seg-btn${data.visibility === "hidden" ? " active" : ""}`}
          aria-pressed={data.visibility === "hidden"}
          onClick={() => update({ visibility: "hidden" })}
        >
          Hidden
        </button>
        <button
          type="button"
          className={`seg-btn${data.visibility === "visible" ? " active accent" : ""}`}
          aria-pressed={data.visibility === "visible"}
          onClick={() => update({ visibility: "visible" })}
        >
          Visible
        </button>
      </div>
      <p className="form-help">
        Hiding a Task temporarily removes it from Certifications
      </p>
    </div>
  );
}

function RadioCard({
  selected,
  onSelect,
  title,
  desc,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`radio-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
      disabled={disabled}
    >
      <span className="radio-dot" />
      <div className="radio-card-text">
        <div className="radio-card-title">{title}</div>
        {desc && <div className="radio-card-desc">{desc}</div>}
      </div>
    </button>
  );
}

/* Toggle — Figma 373:233 (off) / 362:2440 (on). Reads as a normal labelled
   field: title, then the switch beside a line naming the state it's in, then the
   recommendation. `stateOn`/`stateOff` carry that line; they default to Yes/No
   for settings whose design doesn't author richer copy. */
function Toggle({
  checked,
  onChange,
  label,
  sub,
  inline,
  disabled,
  stateOn = "Yes",
  stateOff = "No",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
  inline?: boolean;
  disabled?: boolean;
  stateOn?: string;
  stateOff?: string;
}) {
  const control = (
    <button
      type="button"
      className={`toggle ${checked ? "on" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="toggle-knob" />
    </button>
  );

  // The compact variant is a single line, so it keeps its label-then-switch read.
  if (inline) {
    return (
      <div className={`toggle-row inline ${disabled ? "disabled" : ""}`}>
        <span className="toggle-inline-label">{label}</span>
        {control}
      </div>
    );
  }

  return (
    <div className={`toggle-field ${disabled ? "disabled" : ""}`}>
      <span className="form-label">{label}</span>
      <div className="toggle-switch-row">
        {control}
        <span className="toggle-state">{checked ? stateOn : stateOff}</span>
      </div>
      {sub && <p className="toggle-sub">{sub}</p>}
    </div>
  );
}

/* ─────────────────  Field components  ───────────────── */

/* Dual-language upload — Figma 365:2608 "File Upload - 2 Languages": one
   bordered shell holding two equal columns, each a language tag over its own
   drop zone. A column that already has files swaps the zone for the file list
   plus a slim "add more" strip (a state the Figma component doesn't cover). */
function PackageField({
  enFiles,
  esFiles,
  setEnFiles,
  setEsFiles,
  accept = "ZIP",
  maxSize = "250 MB",
  error = false,
}: {
  enFiles: UploadedFile[];
  esFiles: UploadedFile[];
  setEnFiles: (f: UploadedFile[]) => void;
  setEsFiles: (f: UploadedFile[]) => void;
  accept?: string;
  maxSize?: string;
  /** Publish attempt found the (mandatory) English side empty. */
  error?: boolean;
}) {
  return (
    <div className={`upload-2lang${error ? " has-error" : ""}`}>
      <UploadLangColumn
        tag="English"
        files={enFiles}
        setFiles={setEnFiles}
        accept={accept}
        maxSize={maxSize}
      />
      <UploadLangColumn
        tag="Español"
        files={esFiles}
        setFiles={setEsFiles}
        accept={accept}
        maxSize={maxSize}
      />
    </div>
  );
}

function UploadLangColumn({
  tag,
  files,
  setFiles,
  accept,
  maxSize,
}: {
  tag: string;
  files: UploadedFile[];
  setFiles: (f: UploadedFile[]) => void;
  accept: string;
  maxSize: string;
}) {
  return (
    <div className="upload-lang-col">
      <span className="upload-lang-tag">{tag}</span>
      {files.length === 0 ? (
        <BigDropZone
          onAdd={(picked) => setFiles(picked)}
          accept={accept}
          maxSize={maxSize}
        />
      ) : (
        <>
          <FileList
            files={files}
            onRemove={(idx) => setFiles(files.filter((_, i) => i !== idx))}
          />
          <SlimDrop onAdd={(picked) => setFiles([...files, ...picked])} />
        </>
      )}
    </div>
  );
}

function FileList({
  files,
  onRemove,
}: {
  files: UploadedFile[];
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="file-list">
      {files.map((f, i) => (
        <div key={f.id} className="file-row">
          <span className="file-icon">
            <DocumentIcon />
          </span>
          <div className="file-meta">
            <div className="file-name">{f.name}</div>
            <div className="file-sub">
              {formatSize(f.size)} · {f.ext}
            </div>
          </div>
          <button
            className="file-remove"
            onClick={() => onRemove(i)}
            aria-label="Remove file"
          >
            <SmallXIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

function BigDropZone({
  onAdd,
  accept = "ZIP",
  maxSize = "250 MB",
}: {
  onAdd: (files: UploadedFile[]) => void;
  accept?: string;
  maxSize?: string;
}) {
  return (
    <FilePicker onPick={onAdd}>
      {(open) => (
        <button className="drop-big" onClick={open} type="button">
          <span className="drop-big-icon">
            <UploadTrayIcon />
          </span>
          <div className="drop-big-title">Drag and drop, or click to upload</div>
          <div className="drop-big-hint">
            <div>Accepted File Types: {accept}</div>
            <div>Maximum File Size: {maxSize}</div>
          </div>
        </button>
      )}
    </FilePicker>
  );
}

function SlimDrop({ onAdd }: { onAdd: (files: UploadedFile[]) => void }) {
  return (
    <FilePicker onPick={onAdd}>
      {(open) => (
        <button className="drop-slim" onClick={open} type="button">
          <UploadIcon />
          DROP MORE OR CLICK TO ADD
        </button>
      )}
    </FilePicker>
  );
}

function FilePicker({
  onPick,
  children,
}: {
  onPick: (files: UploadedFile[]) => void;
  children: (open: () => void) => JSX.Element;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const list = Array.from(e.target.files ?? []);
          if (list.length === 0) return;
          onPick(
            list.map((f) => ({
              id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
              name: f.name,
              size: f.size,
              ext: f.name.split(".").pop()?.toUpperCase() ?? "FILE",
            })),
          );
          e.target.value = "";
        }}
      />
      {children(() => ref.current?.click())}
    </>
  );
}

function LangField({
  en,
  es,
  onChangeEn,
  onChangeEs,
  placeholderEn,
  placeholderEs,
  error = false,
  errorMessage,
  type,
  inputMode,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
  error?: boolean;
  errorMessage?: string;
  type?: React.ComponentProps<"input">["type"];
  inputMode?: React.ComponentProps<"input">["inputMode"];
}) {
  return (
    <>
    <div className={`lang-field ${error ? "has-error" : ""}`}>
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input
          className="lang-field-input"
          type={type}
          inputMode={inputMode}
          value={en}
          onChange={(e) => onChangeEn(e.target.value)}
          placeholder={placeholderEn}
          aria-invalid={error || undefined}
        />
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input
          className="lang-field-input"
          type={type}
          inputMode={inputMode}
          value={es}
          onChange={(e) => onChangeEs(e.target.value)}
          placeholder={placeholderEs}
        />
      </div>
    </div>
    {error && errorMessage && <p className="form-error-text">{errorMessage}</p>}
    </>
  );
}

function RichTextField({
  en,
  es,
  onChangeEn,
  onChangeEs,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
}) {
  return (
    <div className="rte-field">
      <RteToolbar />
      <div className="rte-lang-row">
        <span className="lang-tag">EN</span>
        <AutoTextarea className="rte-area" value={en} onChange={onChangeEn} />
      </div>
      <div className="rte-field-divider" />
      <div className="rte-lang-row">
        <span className="lang-tag">ES</span>
        <AutoTextarea className="rte-area" value={es} onChange={onChangeEs} />
      </div>
    </div>
  );
}

function SingleRichText({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="rte-field">
      {focused && <RteToolbar />}
      <AutoTextarea
        className="rte-area"
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      rows={1}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
