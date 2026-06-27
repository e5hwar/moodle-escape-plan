import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import type { TaskTypeKey } from "./Footer";
import type { Task, TaskType } from "../data/tasks";
import { DEFAULT_PARTNERSHIPS, DEFAULT_TRADES } from "../data/productConfig";
import { PriceIdFields, newPriceIds, type PriceIds } from "./PriceIdFields";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  BulletListIcon,
  NumberListIcon,
  IndentRightIcon,
  IndentLeftIcon,
  LinkSmallIcon,
  ImageIcon,
  VideoIcon,
  AudioIcon,
  UploadIcon,
  DocumentIcon,
  SmallXIcon,
  DragHandleIcon,
  GearIcon,
  LockIcon,
} from "./icons";
import { WizardStepRail } from "./WizardStepRail";

const TYPE_LABEL: Record<TaskTypeKey, string> = {
  xapi: "xAPI",
  quiz: "Quiz",
  "hands-on": "Hands-On Task",
  "id-upload": "ID Upload",
  file: "File",
  "deep-link": "Deep Link",
  url: "URL",
};

/** Map a stored Task's display type to the wizard's TaskTypeKey. */
export function taskTypeKey(type: TaskType): TaskTypeKey {
  switch (type) {
    case "xAPI": return "xapi";
    case "Quiz": return "quiz";
    case "Hands-On Task": return "hands-on";
    case "ID Upload": return "id-upload";
    case "File": return "file";
    case "URL": return "url";
  }
}

/* ─────────────────────  Types  ───────────────────── */

type CompletionMode = "none" | "on-view" | "manual" | "xapi";
type Visibility = "visible" | "hidden";
type ContentTagType = "trade" | "partnership" | "userType";
type ContentTag = { id: string; type: ContentTagType; value: string };
type TimeUnit = "minutes" | "hours" | "days" | "weeks";
type OpenIn = "external" | "in-app";
type FileOpenIn = "in-app-viewer" | "external-app";
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
type CooldownMode = "uniform" | "variable";
type QuizResourceType = "image" | "video" | "pdf" | "webview" | "custom";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  ext: string;
};

type StaticQuestion = {
  id: string;
  text: string;
  type: "Multiple choice" | "True/False";
  weight: string;
};

type RandomPool = {
  id: string;
  name: string;
  poolSize: number;
  draw: string;
};

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

type QuizResource = {
  id: string;
  type: QuizResourceType;
  name: string;
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
  finalExam: boolean;
  tags: string[];

  // xAPI
  packageEn: UploadedFile[];
  packageEs: UploadedFile[];
  completion: CompletionMode | null;
  scoreCapture: boolean;
  scoreCaptureMode: ScoreCaptureMode;
  scoreDisplayMode: ScoreCaptureMode;

  // URL
  url: string;
  urlEs: string;
  openIn: OpenIn;
  allowRotation: boolean;
  lockedOrientation: Orientation;

  // File
  fileEn: UploadedFile[];
  fileEs: UploadedFile[];
  fileOpenIn: FileOpenIn;

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

const SAMPLE_BLOCK_STATIC: StaticQuestion[] = [
  { id: "q1", text: "What is the boiling point of R-134a at standard atmospheric pressure?", type: "Multiple choice", weight: "1" },
  { id: "q2", text: "R-22 is being phased out under EPA Section 608 regulations.", type: "True/False", weight: "1" },
  { id: "q3", text: "Which of the following is classified as a hydrofluoroolefin (HFO) refrigerant?", type: "Multiple choice", weight: "1" },
  { id: "q4", text: "R-410A is a blend of which two component refrigerants?", type: "Multiple choice", weight: "1" },
  { id: "q5", text: "ASHRAE classifies refrigerants by safety based on toxicity and flammability.", type: "True/False", weight: "1" },
];

const SAMPLE_QUIZ_SECTIONS: QuizSection[] = [
  {
    id: "s1",
    name: "Core",
    nameEs: "Núcleo",
    passingPct: "70",
    requiredToPass: true,
    staticQuestions: [
      { id: "c1", text: "Section 608 of the Clean Air Act prohibits which of the following actions?", type: "Multiple choice", weight: "1" },
      { id: "c2", text: "Technicians servicing regulated refrigerants must be EPA-certified.", type: "True/False", weight: "1" },
      { id: "c3", text: "What is the maximum allowable leak rate for commercial refrigeration equipment?", type: "Multiple choice", weight: "1" },
    ],
    randomPools: [],
  },
  {
    id: "s2",
    name: "Type I",
    nameEs: "Tipo I",
    passingPct: "70",
    requiredToPass: false,
    staticQuestions: [
      { id: "t1", text: "What must be done before disconnecting refrigerant lines from a small appliance?", type: "Multiple choice", weight: "1" },
      { id: "t2", text: "Recovery cylinders must be evacuated before initial use.", type: "True/False", weight: "1" },
    ],
    randomPools: [{ id: "p1", name: "Type I recovery bank", poolSize: 24, draw: "8" }],
  },
];

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
  finalExam: false,
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

  structure: "single_block",
  sections: SAMPLE_QUIZ_SECTIONS,
  blockStatic: SAMPLE_BLOCK_STATIC,
  blockPools: [],
  questionOrder: "fixed",
  shuffleScope: "within_section",

  gradingModel: "quiz_level",
  quizPassingPct: "70",
  quizCompletion: "passing_grade",

  maxAttemptsMode: "limited",
  maxAttempts: "3",
  cooldownMode: "uniform",
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
  { id: "details", label: "Details", sub: "Name, file, time", desc: "Name and describe the Task, upload the xAPI/SCORM package per language, and estimate the duration." },
  { id: "launch", label: "Launch Behaviour", sub: "Rotation & orientation", desc: "How the package handles screen rotation when a learner opens it on a mobile phone." },
  { id: "completion", label: "Completion & Scoring", sub: "Completion and score capture", desc: "Decide what marks this Task complete, and whether to capture a score reported by the package." },
  { id: "visibility", label: "Visibility", sub: "Visibility", desc: "Whether learners can find and start this Task." },
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

const URL_STEPS: StepDef[] = [
  { id: "basics", label: "Basic Info", sub: "Name, URL, time", desc: "Name the Task, point it at a destination URL, and estimate how long it takes to complete." },
  { id: "launch", label: "Launch Behaviour", sub: "How the URL opens", desc: "Choose how the URL opens on the learner's device. The rotation controls only apply to the In-App Browser on mobile." },
  { id: "completion", label: "Completion", sub: "How completion is determined", desc: "Decide what marks this Task as complete for a learner." },
  { id: "visibility", label: "Visibility", sub: "Visibility", desc: "Whether learners can find and start this Task." },
];

const FILE_STEPS: StepDef[] = [
  { id: "basics", label: "Basic Info", sub: "Name, file, time", desc: "Name the Task, upload the file learners open per language, and estimate how long it takes to complete." },
  { id: "launch", label: "Launch Behaviour", sub: "How the file opens", desc: "Choose how the file opens on the learner's device." },
  { id: "completion", label: "Completion", sub: "How completion is determined", desc: "Decide what marks this Task as complete for a learner." },
  { id: "visibility", label: "Visibility", sub: "Visibility", desc: "Whether learners can find and start this Task." },
];

const DEEPLINK_STEPS: StepDef[] = [
  { id: "basics", label: "Basic Info", sub: "Name, deep link, time", desc: "Name the Task, point it at a deep link, and estimate how long it takes to complete." },
  { id: "completion", label: "Completion", sub: "How completion is determined", desc: "Decide what marks this Task as complete for a learner." },
  { id: "visibility", label: "Visibility", sub: "Visibility", desc: "Whether learners can find and start this Task." },
];

const HANDSON_STEPS: StepDef[] = [
  { id: "basics", label: "Basic Info", sub: "Name, description, time", desc: "Name the Task, describe it, and estimate how long it takes to complete." },
  { id: "reference", label: "Reference Files", sub: "Files, instructions, checklist", desc: "Give learners the files, instructions, and materials they need, and write the checklist reviewers grade against." },
  { id: "submission", label: "Submission Fields", sub: "Description and media limits", desc: "Define what a learner submits — the project description limit and how many media files of which types they can attach." },
  { id: "completion", label: "Completion", sub: "Attempts and passing rule", desc: "How many times a learner can submit, and what marks the Task complete." },
  { id: "visibility", label: "Visibility", sub: "Visibility, discovery, tags", desc: "Whether learners can find and start this Task, and how it's tagged for targeting." },
];

function stepsForType(type: TaskTypeKey): StepDef[] {
  if (type === "quiz") return QUIZ_STEPS;
  if (type === "url") return URL_STEPS;
  if (type === "file") return FILE_STEPS;
  if (type === "deep-link") return DEEPLINK_STEPS;
  if (type === "hands-on") return HANDSON_STEPS;
  return XAPI_STEPS;
}

// Whether a given step renders at least one required field, so the header only
// shows the "* Required Fields" note where it applies. "basics"/"details" always
// have a required Name (or Quiz name); "completion" requires a rule except for
// Hands-On; the quiz "payments" step has a required external ID.
function stepHasRequiredFields(type: TaskTypeKey, stepId: string): boolean {
  if (stepId === "basics" || stepId === "details") return true;
  if (stepId === "completion") return type !== "hands-on";
  if (stepId === "payments") return true;
  return false;
}

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
  // URL, File and Deep Link Tasks have no default completion mode in the
  // spec — the admin picks one.
  if (taskType === "url" || taskType === "file" || taskType === "deep-link")
    base = { ...INITIAL_DATA, completion: null };
  // xAPI Tasks default to rotation off, locked to landscape.
  else if (taskType === "xapi")
    base = { ...INITIAL_DATA, allowRotation: false, lockedOrientation: "landscape" };
  else base = INITIAL_DATA;

  if (!editingTask) return base;

  const time = parseTimeToComplete(editingTask.timeToComplete);
  return {
    ...base,
    nameEn: editingTask.name,
    descEn: editingTask.description ?? base.descEn,
    tags: editingTask.tags ?? base.tags,
    visibility: editingTask.hidden ? "hidden" : "visible",
    finalExam: editingTask.finalExam ?? base.finalExam,
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
                poolSize: s.questionCount * 2,
                draw: String(s.questionCount),
              },
            ],
          })),
        }
      : {}),
  };
}

export function NewTaskWizard({ taskType, onClose, editingTask, primaryLabel, onPrimary, savedLabel }: Props) {
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
  const isUrl = taskType === "url";
  const isFile = taskType === "file";
  const isDeepLink = taskType === "deep-link";
  const isHandsOn = taskType === "hands-on";
  const steps = stepsForType(taskType);

  return (
    <div className="wizard">
      <div className="wizard-body">
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">
              {isEditing ? "Editing" : "Creating"}
            </span>
            <span className="wizard-brand-name">
              {editingTask ? editingTask.name : "New Task"}
            </span>
          </div>

          <ol className="wizard-steps">
            {steps.map((s, i) => {
              const status =
                i === step ? "active" : i < step ? "done" : "upcoming";
              return (
                <li
                  key={s.id}
                  className={`wizard-step ${status}`}
                  onClick={() => setStep(i)}
                >
                  <WizardStepRail status={status} isLast={i === steps.length - 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                    <div className="wizard-step-sub">{s.sub}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="wizard-content">
          <h1 className="wizard-title">{steps[step].label}</h1>
          <p className="wizard-desc">{steps[step].desc}</p>
          {stepHasRequiredFields(taskType, steps[step].id) && (
            <div className="required-fields-note">* Required Fields</div>
          )}

          {(() => {
            const criteriaLocked = isEditing && !criteriaUnlocked;
            const onUnlockCriteria = () => setCriteriaUnlocked(true);
            const gateProps = { criteriaLocked, onUnlockCriteria };
            return (
          isXapi ? (
            step === 0 ? <XapiDetailsStep data={data} update={update} /> :
            step === 1 ? <XapiLaunchStep data={data} update={update} /> :
            step === 2 ? <XapiCompletionStep data={data} update={update} {...gateProps} /> :
            <XapiVisibilityStep data={data} update={update} />
          ) : isQuiz ? (
            step === 0 ? <QuizBasicsStep data={data} update={update} /> :
            step === 1 ? <QuizStructureStep data={data} update={update} locked={isEditing} /> :
            step === 2 ? <QuizQuestionsStep data={data} update={update} /> :
            step === 3 ? <QuizGradingStep data={data} update={update} locked={isEditing} {...gateProps} /> :
            step === 4 ? <QuizAttemptsStep data={data} update={update} /> :
            step === 5 ? <QuizIntegrityStep data={data} update={update} /> :
            step === 6 ? <QuizReviewStep data={data} update={update} /> :
            <QuizPaymentsStep data={data} update={update} />
          ) : isUrl ? (
            step === 0 ? <UrlBasicInfoStep data={data} update={update} /> :
            step === 1 ? <UrlLaunchStep data={data} update={update} /> :
            step === 2 ? <UrlCompletionStep data={data} update={update} {...gateProps} /> :
            <UrlVisibilityStep data={data} update={update} />
          ) : isFile ? (
            step === 0 ? <FileBasicInfoStep data={data} update={update} /> :
            step === 1 ? <FileLaunchStep data={data} update={update} /> :
            step === 2 ? <UrlCompletionStep data={data} update={update} {...gateProps} /> :
            <UrlVisibilityStep data={data} update={update} />
          ) : isDeepLink ? (
            step === 0 ? <DeepLinkBasicInfoStep data={data} update={update} /> :
            step === 1 ? <UrlCompletionStep data={data} update={update} {...gateProps} /> :
            <UrlVisibilityStep data={data} update={update} />
          ) : isHandsOn ? (
            step === 0 ? <HandsOnBasicStep data={data} update={update} /> :
            step === 1 ? <HandsOnReferenceStep data={data} update={update} /> :
            step === 2 ? <HandsOnSubmissionStep data={data} update={update} /> :
            step === 3 ? <HandsOnCompletionStep data={data} update={update} {...gateProps} /> :
            <HandsOnVisibilityStep data={data} update={update} />
          ) : (
            <PlaceholderStep type={TYPE_LABEL[taskType]} />
          ));
          })()}
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
          <button className="btn-save-draft" onClick={onClose}>
            Save as draft
          </button>
          <button
            className="btn-publish"
            onClick={() => (onPrimary ? onPrimary(data.nameEn || `New ${TYPE_LABEL[taskType]}`) : onClose())}
          >
            {primaryLabel ?? (isEditing ? "Save changes" : "Publish")}
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
};

function XapiDetailsStep({ data, update }: StepProps) {
  return (
    <>
      <NameAndDescription data={data} update={update} />

      <div className="form-group">
        <label className="form-label">
          xAPI Package <span className="req">*</span>
        </label>
        <PackageField
          enFiles={data.packageEn}
          esFiles={data.packageEs}
          setEnFiles={(files) => update({ packageEn: files })}
          setEsFiles={(files) => update({ packageEs: files })}
        />
      </div>

      <TimeToCompleteField data={data} update={update} />
      <FinalExamField data={data} update={update} />
    </>
  );
}

function XapiLaunchStep({ data, update }: StepProps) {
  return (
    <Section
      title="Rotation & orientation"
      desc="Mobile phones only. On iPad and tablets orientation is never locked, and on Web the layout adapts to the window — these settings have no effect there."
    >
      <RotationOrientationFields data={data} update={update} />
    </Section>
  );
}

function XapiCompletionStep({ data, update, criteriaLocked, onUnlockCriteria }: StepProps) {
  const options: { key: CompletionMode; title: string; desc: string }[] = [
    { key: "none", title: "No completion tracking", desc: "Task is reference content only — never marked complete." },
    { key: "on-view", title: "Completion upon viewing", desc: "Marks complete as soon as the learner opens the package." },
    { key: "manual", title: "User manually marks completion", desc: "Learner clicks \"Mark complete\" after finishing the content." },
    { key: "xapi", title: "xAPI completion statement", desc: "The package fires a completion statement to the LRS. Recommended for xAPI content." },
  ];

  return (
    <CompletionCriteriaGate locked={!!criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
      <div className="form-group">
        <label className="form-label">
          How completion is determined <span className="req">*</span>
        </label>
        <div className="radio-card-group">
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
      </div>

      <div className="form-divider" />

      <Section
        title="Score capture"
        desc="Completion only records whether the Task was finished. Turn this on to also keep a numeric score reported by the package."
      >
        <Toggle
          checked={data.scoreCapture}
          onChange={(v) => update({ scoreCapture: v })}
          label="Capture a score from the package"
          sub="When on, SkillCat stores the score the xAPI/SCORM content sends. Off by default — only completion is tracked."
        />

        {data.scoreCapture && (
          <div className="form-sub-group" style={{ marginTop: 16 }}>
            <label className="form-sub-label">Which score to keep</label>
            <div className="radio-card-group">
              <RadioCard
                selected={data.scoreCaptureMode === "highest"}
                onSelect={() => update({ scoreCaptureMode: "highest" })}
                title="Highest grade"
                desc="Keep the learner's best score across all attempts."
              />
              <RadioCard
                selected={data.scoreCaptureMode === "recent"}
                onSelect={() => update({ scoreCaptureMode: "recent" })}
                title="Most recent"
                desc="Keep the score from the learner's latest attempt, even if it's lower."
              />
            </div>
          </div>
        )}

        <div className="form-sub-group" style={{ marginTop: 16 }}>
          <label className="form-sub-label">Score displayed</label>
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
      </Section>
    </CompletionCriteriaGate>
  );
}

function XapiVisibilityStep({ data, update }: StepProps) {
  return <VisibilitySection data={data} update={update} heading={false} />;
}

/* ─────────────────  URL step components  ───────────────── */

function UrlBasicInfoStep({ data, update }: StepProps) {
  return (
    <>
      <NameAndDescription data={data} update={update} />

      <div className="form-group">
        <label className="form-label">
          URL <span className="req">*</span>
        </label>
        <LangField
          en={data.url}
          es={data.urlEs}
          onChangeEn={(v) => update({ url: v })}
          onChangeEs={(v) => update({ urlEs: v })}
          placeholderEn="https://example.com/resource"
          placeholderEs="https://example.com/es/recurso"
        />
        <p className="form-help">
          The page learners open for this Task. Enter the full address, including
          https://. If no Spanish URL is added, Spanish learners open the English
          URL.
        </p>
      </div>

      <TimeToCompleteField data={data} update={update} />
      <FinalExamField data={data} update={update} />
    </>
  );
}

function UrlLaunchStep({ data, update }: StepProps) {
  const inApp = data.openIn === "in-app";

  return (
    <>
      <Section
        title="Open in"
        desc="Where the URL opens when a learner starts the Task. External Browser is the default."
      >
        <div className="radio-card-group">
          <RadioCard
            selected={data.openIn === "external"}
            onSelect={() => update({ openIn: "external" })}
            title="External Browser"
            desc="Opens in the device's default browser, or a new tab on Web. The app hands the URL off and can't track activity afterward."
          />
          <RadioCard
            selected={inApp}
            onSelect={() => update({ openIn: "in-app" })}
            title="In-App Browser"
            desc="Opens in a webview inside the SkillCat app, or an iframe on Web. Keeps learners in the app and unlocks the rotation controls below."
          />
        </div>
      </Section>

      {inApp && (
        <>
          <div className="form-divider" />

          <Section
            title="Rotation & orientation"
            desc="Mobile phones only. On iPad and tablets orientation is never locked, and on Web the layout adapts to the window — these settings have no effect there."
          >
            <RotationOrientationFields data={data} update={update} />
          </Section>
        </>
      )}
    </>
  );
}

function RotationOrientationFields({ data, update }: StepProps) {
  return (
    <>
      <div className="form-sub-group">
        <Toggle
          checked={data.allowRotation}
          onChange={(v) => update({ allowRotation: v })}
          label="Allow rotation"
          sub="When on, the learner can rotate freely between portrait and landscape. When off, the orientation is locked to your choice below."
        />
      </div>

      <div className="form-sub-group">
        <label className="form-sub-label">Locked orientation</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.lockedOrientation === "portrait"}
            onSelect={() => update({ lockedOrientation: "portrait" })}
            disabled={data.allowRotation}
            title="Portrait"
            desc="Lock the content to a vertical orientation on launch."
          />
          <RadioCard
            selected={data.lockedOrientation === "landscape"}
            onSelect={() => update({ lockedOrientation: "landscape" })}
            disabled={data.allowRotation}
            title="Landscape"
            desc="Lock the content to a horizontal orientation on launch."
          />
        </div>
        {data.allowRotation && (
          <p className="form-help">
            Turn off Allow rotation to lock the orientation.
          </p>
        )}
      </div>
    </>
  );
}

function UrlCompletionStep({ data, update, criteriaLocked, onUnlockCriteria }: StepProps) {
  const options: { key: CompletionMode; title: string; desc: string }[] = [
    { key: "none", title: "No completion tracking", desc: "Reference content only — the Task is never marked complete." },
    { key: "on-view", title: "Completion upon viewing", desc: "Marks complete as soon as the learner opens the URL. With the External Browser the Task completes on launch, since the app can't observe the page once it opens elsewhere." },
    { key: "manual", title: "User manually marks completion", desc: "The learner taps \"Mark complete\" from the UI after they finish." },
  ];

  return (
    <CompletionCriteriaGate locked={!!criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
      <div className="form-group">
        <label className="form-label">
          How completion is determined <span className="req">*</span>
        </label>
        <div className="radio-card-group">
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
      </div>
    </CompletionCriteriaGate>
  );
}

function UrlVisibilityStep({ data, update }: StepProps) {
  return <VisibilitySection data={data} update={update} heading={false} />;
}

/* ─────────────────  File step components  ───────────────── */

function FileBasicInfoStep({ data, update }: StepProps) {
  return (
    <>
      <NameAndDescription data={data} update={update} />

      <div className="form-group">
        <label className="form-label">
          File <span className="req">*</span>
        </label>
        <PackageField
          enFiles={data.fileEn}
          esFiles={data.fileEs}
          setEnFiles={(files) => update({ fileEn: files })}
          setEsFiles={(files) => update({ fileEs: files })}
          hint="PDF, DOCX, PPTX, images · 250 MB MAX"
        />
        <p className="form-help">
          The file learners open for this Task. If no Spanish file is added,
          Spanish learners open the English file.
        </p>
      </div>

      <TimeToCompleteField data={data} update={update} />
      <FinalExamField data={data} update={update} />
    </>
  );
}

function FileLaunchStep({ data, update }: StepProps) {
  return (
    <Section
      title="Open in"
      desc="Where the file opens when a learner starts the Task. In-App Viewer is the default."
    >
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
          desc="Hands the file to the device's default app for that file type (e.g. a PDF reader). The app can't track activity once the file opens elsewhere."
        />
      </div>
    </Section>
  );
}

/* ─────────────────  Deep Link step components  ───────────────── */

function isValidUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    // Accepts standard web URLs as well as custom deep-link schemes
    // (e.g. skillcat://course/123) — both parse via the URL constructor.
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

function DeepLinkBasicInfoStep({ data, update }: StepProps) {
  const [error, setError] = useState<string | null>(null);
  const valid = isValidUrl(data.url);

  const handlePreview = () => {
    if (!valid) {
      setError(
        "That doesn't look like a valid URL. Include the scheme, e.g. https:// or skillcat://.",
      );
      return;
    }
    setError(null);
    window.open(data.url.trim(), "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <NameAndDescription data={data} update={update} />

      <div className="form-group">
        <label className="form-label">
          Deep Link URL <span className="req">*</span>
        </label>
        <div className="deeplink-row">
          <input
            className="form-input"
            type="url"
            inputMode="url"
            placeholder="https://example.com/path or skillcat://course/123"
            value={data.url}
            onChange={(e) => {
              update({ url: e.target.value });
              if (error) setError(null);
            }}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handlePreview}
            disabled={!data.url.trim()}
          >
            Preview
          </button>
        </div>
        {error ? (
          <p className="form-help error">{error}</p>
        ) : (
          <p className="form-help">
            Only one URL is allowed. Preview verifies the link is valid, then
            opens the deep link in a new tab.
          </p>
        )}
      </div>

      <TimeToCompleteField data={data} update={update} />
      <FinalExamField data={data} update={update} />
    </>
  );
}

/* ─────────────────  Hands-On step components  ───────────────── */

function HandsOnBasicStep({ data, update }: StepProps) {
  return (
    <>
      <NameAndDescription data={data} update={update} />
      <TimeToCompleteField data={data} update={update} />
      <FinalExamField data={data} update={update} />
    </>
  );
}

function HandsOnReferenceStep({ data, update }: StepProps) {
  return (
    <>
      <Section desc="Files learners download before they start — separate uploads per language, multiple files allowed. If no Spanish file is added, Spanish learners get the English files.">
        <PackageField
          enFiles={data.hoFilesEn}
          esFiles={data.hoFilesEs}
          setEnFiles={(files) => update({ hoFilesEn: files })}
          setEsFiles={(files) => update({ hoFilesEs: files })}
          hint="PDF, images, video · 250 MB MAX"
        />
      </Section>

      <div className="form-divider" />

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

      <div className="form-divider" />

      <Section
        title="Reviewer checklist"
        desc="Only the reviewer sees this while grading a submission — learners never see it."
      >
        <SingleRichText
          value={data.hoReviewerChecklist}
          onChange={(v) => update({ hoReviewerChecklist: v })}
        />
      </Section>
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
      <Section
        title="Project description"
        desc="The free-text write-up a learner submits with their work."
      >
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
      </Section>

      <div className="form-divider" />

      <Section
        title="Media files"
        desc="How many media files a learner can attach to a submission."
      >
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
      </Section>

      <div className="form-divider" />

      <Section
        title="Media file types allowed"
        desc="Pick one or more. At least one type must be allowed."
      >
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
      </Section>
    </>
  );
}

function HandsOnCompletionStep({ data, update, criteriaLocked, onUnlockCriteria }: StepProps) {
  const limited = data.maxAttemptsMode === "limited";
  const reviewerGrade = data.hoCompletion === "reviewer_grade";

  return (
    <CompletionCriteriaGate locked={!!criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
      <Section
        title="Maximum attempts"
        desc="How many times a learner can submit this Task."
      >
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
      </Section>

      <div className="form-divider" />

      <Section title="Completion" desc="What marks this Task complete for a learner.">
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

        {reviewerGrade && (
          <div className="form-sub-group" style={{ marginTop: 16 }}>
            <label className="form-sub-label">Passing grade</label>
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
      </Section>
    </CompletionCriteriaGate>
  );
}

function HandsOnVisibilityStep({ data, update }: StepProps) {
  return (
    <>
      <VisibilitySection data={data} update={update} heading={false} />

      <div className="form-divider" />

      <Section
        title="Discoverable"
        desc="Whether this Task surfaces in search and browse, separate from its visibility."
      >
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
      </Section>

      <div className="form-divider" />

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
    <section className="form-section">
      <div className="cv-section-head">
        <h2 className="form-section-title">Content Tags for Visibility</h2>
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
      <p className="form-section-desc">
        Tag this Task to control which Tenants can see it. Trade and Partnership values come
        from the B2B Management fields in Product Config, and a Tenant must match every tag type you
        set (within a type, matching any one value is enough). Add as many tags of each type as you need.
      </p>

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

      <div className="cv-scope-note">
        <span className="cv-scope-dot" />
        {scopeNote}
      </div>
    </section>
  );
}

/* ─────────────────  Quiz step components  ───────────────── */

function QuizBasicsStep({ data, update }: StepProps) {
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
        />
      </div>

      <VisibilitySection data={data} update={update} forType="Quiz" />

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
      <FinalExamField data={data} update={update} />
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
        <Section desc="A single block is one flat question list with one overall score. Sectioned splits the Quiz into named groups that can be graded independently.">
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
        </Section>

        {sectioned && (
          <>
            <div className="form-divider" />
            <Section
              title="Sections"
              desc="Drag to reorder. Each Section needs a name; its questions are set in the next step and its passing rules in Grading & Completion."
            >
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
            </Section>
          </>
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
            <Section
              key={s.id}
              title={`Section ${i + 1}: ${s.name || "Untitled"}`}
              desc={s.nameEs || undefined}
            >
              <QuestionGroupEditor
                staticQuestions={s.staticQuestions}
                pools={s.randomPools}
                onChange={(patch) => updateSection(s.id, patch)}
              />
            </Section>
          ))
        )
      ) : (
        <Section desc="The full list every learner draws from. Static questions appear for everyone; random pools draw a fresh set each attempt.">
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
        </Section>
      )}

      <div className="form-divider" />

      <Section
        title="Question order"
        desc="Controls how Static questions are ordered. Random pool questions are always drawn in an unpredictable order."
      >
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

        {sectioned && data.questionOrder === "shuffled" && (
          <div className="form-sub-group" style={{ marginTop: 16 }}>
            <label className="form-sub-label">Shuffle scope</label>
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
      </Section>
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

  const addStatic = () =>
    onChange({
      staticQuestions: [
        ...staticQuestions,
        { id: `q${Date.now()}`, text: "New question (pick from Question Bank)", type: "Multiple choice", weight: "1" },
      ],
    });
  const setWeight = (id: string, weight: string) =>
    onChange({
      staticQuestions: staticQuestions.map((q) => (q.id === id ? { ...q, weight } : q)),
    });
  const removeStatic = (id: string) =>
    onChange({ staticQuestions: staticQuestions.filter((q) => q.id !== id) });

  const addPool = () =>
    onChange({
      randomPools: [
        ...pools,
        { id: `p${Date.now()}`, name: "New random pool", poolSize: 20, draw: "5" },
      ],
    });
  const setDraw = (id: string, draw: string) =>
    onChange({ randomPools: pools.map((p) => (p.id === id ? { ...p, draw } : p)) });
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
      <button className="resource-add" onClick={addStatic}>
        + Add questions from Bank
      </button>

      <div className="qsub-head">RANDOM POOLS</div>
      {pools.map((p) => {
        const drawNum = parseInt(p.draw, 10) || 0;
        const over = drawNum > p.poolSize;
        return (
          <div key={p.id} className="pool-row">
            <div className="pool-name">
              <div className="qbag-q-text">{p.name}</div>
              <div className="qbag-q-type">Pool of {p.poolSize} from the Question Bank</div>
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
              <span className="form-suffix">/ {p.poolSize}</span>
            </div>
            <button className="q-remove" aria-label="Remove pool" onClick={() => removePool(p.id)}>
              <SmallXIcon />
            </button>
            {over && (
              <div className="pool-warn">Draw can't exceed the pool size ({p.poolSize}).</div>
            )}
          </div>
        );
      })}
      <button className="resource-add" onClick={addPool}>
        + Add random pool
      </button>
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
      <Section
        title="Grading model"
        desc={
          locked
            ? "The grading model is part of the Quiz structure and is locked after creation. Passing grades below can still be adjusted."
            : sectioned
            ? "Quiz-level uses one overall threshold across all Sections (NATE-style — Sections exist for display only). Section-level grades each Section independently (EPA-style)."
            : "Single-block Quizzes are always graded at the Quiz level."
        }
      >
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
      </Section>

      <div className="form-divider" />

      <CompletionCriteriaGate locked={!!criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
      {sectionLevel ? (
        <Section
          title="Section passing grades"
          desc={
            locked
              ? "Passing grades can be edited — completion is recomputed from existing attempts. Whether a Section is Required to pass is structural and is locked after creation."
              : "Each Section is graded independently and may differ. Required-to-Pass Sections must be cleared in the same attempt for any Section pass to count."
          }
        >
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
        </Section>
      ) : (
        <Section title="Quiz passing grade" desc="The overall score a learner must reach to pass.">
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
        </Section>
      )}

      <div className="form-divider" />

      <Section title="Score calculation" desc="Locked in Version 1.">
        <select className="form-select wide" value="highest" disabled>
          <option value="highest">Highest grade across attempts</option>
        </select>
        <p className="form-help">
          Highest grade is the only method in V1 — it keeps the completion status stable across attempts.
        </p>
      </Section>

      <div className="form-divider" />

      <Section title="Completion criterion" desc="What marks this Quiz Task complete for a learner.">
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
      </Section>
      </CompletionCriteriaGate>
    </>
  );
}

function QuizAttemptsStep({ data, update }: StepProps) {
  const limited = data.maxAttemptsMode === "limited";

  return (
    <>
      <Section title="Maximum attempts" desc="How many times a learner can attempt this Quiz. Quiz-level.">
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
      </Section>

      <div className="form-divider" />

      <Section
        title="Cooldown between attempts"
        desc="Optional wait before a learner can start the next attempt. Begins when an attempt is submitted, or when the timer runs out — whichever is first."
      >
        <div className="radio-card-group">
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

        {data.cooldownMode === "uniform" ? (
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
              <span className="form-suffix">minutes (leave blank for no cooldown)</span>
            </div>
          </div>
        ) : (
          <VariableCooldownEditor data={data} update={update} />
        )}
      </Section>

      <div className="form-divider" />

      <Section
        title="Auto-unlock additional attempts"
        desc="Automatically grant extra attempts once the learner completes specific Tasks. All trigger Tasks must complete to unlock; the extras stack with remaining and manually granted attempts."
      >
        <Toggle
          checked={data.autoAttempts}
          onChange={(v) => update({ autoAttempts: v })}
          label="Grant additional attempts automatically"
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
      </Section>

      <div className="form-divider" />

      <Section
        title="Time limit"
        desc="Optional. The timer starts when questions first appear and can't be paused — the attempt auto-submits at zero."
      >
        <Toggle
          checked={data.timeLimitOn}
          onChange={(v) => update({ timeLimitOn: v })}
          label="Enforce a time limit"
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
      </Section>
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

  const add = () =>
    update({
      autoAttemptTriggers: [...rows, { id: `tt${Date.now()}`, name: "Select a Task…" }],
    });
  const remove = (id: string) =>
    update({ autoAttemptTriggers: rows.filter((t) => t.id !== id) });

  return (
    <div className="trigger-list">
      {rows.map((t) => (
        <div key={t.id} className="trigger-row">
          <span className="trigger-name">{t.name}</span>
          <button className="section-remove" aria-label="Remove trigger" onClick={() => remove(t.id)}>
            <SmallXIcon />
          </button>
        </div>
      ))}
      <button className="resource-add" onClick={add}>
        + Add trigger Task
      </button>
    </div>
  );
}

function QuizIntegrityStep({ data, update }: StepProps) {
  return (
    <>
      <Section
        title="Proctoring"
        desc="Quiz-level. Capture frequency is a system-level setting and isn't configured here."
      >
        <Toggle
          checked={data.proctoring}
          onChange={(v) => update({ proctoring: v })}
          label="Require proctoring"
          sub="Passing attempts enter In-Review until the Proctoring Team approves the footage — completion isn't recorded until then."
        />
      </Section>

      <div className="form-divider" />

      <Section
        title="In-quiz resources"
        desc="Materials a learner can open throughout the attempt — e.g. EPA PT charts. Multiple allowed."
      >
        <ResourceEditor data={data} update={update} />
      </Section>
    </>
  );
}

const RESOURCE_TYPE_LABELS: Record<QuizResourceType, string> = {
  image: "Image",
  video: "Video",
  pdf: "PDF",
  webview: "Webview URL",
  custom: "Custom UI",
};

function ResourceEditor({ data, update }: StepProps) {
  const rows = data.inQuizResources;

  const add = () =>
    update({ inQuizResources: [...rows, { id: `r${Date.now()}`, type: "pdf", name: "" }] });
  const setRow = (id: string, patch: Partial<QuizResource>) =>
    update({ inQuizResources: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  const remove = (id: string) =>
    update({ inQuizResources: rows.filter((r) => r.id !== id) });

  return (
    <div className="resource-edit-list">
      {rows.map((r) => (
        <div key={r.id} className="resource-edit-row">
          <select
            className="form-select"
            value={r.type}
            onChange={(e) => setRow(r.id, { type: e.target.value as QuizResourceType })}
          >
            {Object.entries(RESOURCE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input
            className="form-input"
            placeholder={r.type === "webview" ? "https://…" : "File name or label"}
            value={r.name}
            onChange={(e) => setRow(r.id, { name: e.target.value })}
          />
          <button className="section-remove" aria-label="Remove resource" onClick={() => remove(r.id)}>
            <SmallXIcon />
          </button>
        </div>
      ))}
      <button className="resource-add" onClick={add}>
        + Add resource
      </button>
    </div>
  );
}

function QuizReviewStep({ data, update }: StepProps) {
  const sectioned = data.structure === "sectioned";
  const quizLevel = data.gradingModel === "quiz_level";
  const r = data.review;
  const setR = (patch: Partial<ReviewOptions>) => update({ review: { ...r, ...patch } });

  return (
    <Section
      title="What the learner sees after submitting"
      desc="Select everything that should appear on the results screen after an attempt is submitted."
    >
      <div className="review-list">
        <Toggle
          checked={r.attempt}
          onChange={(v) => setR({ attempt: v })}
          label="Attempt"
          sub="The questions in the attempt and the learner's own answers."
        />
        <Toggle
          checked={quizLevel && r.quizResult}
          onChange={(v) => setR({ quizResult: v })}
          disabled={!quizLevel}
          label="Quiz Result"
          sub={
            quizLevel
              ? "Overall pass/fail for the Quiz."
              : "Only available under Quiz-level grading — Section-level Quizzes show pass/fail per Section instead."
          }
        />
        <Toggle
          checked={r.quizScore}
          onChange={(v) => setR({ quizScore: v })}
          label="Quiz Score"
          sub="The overall score achieved."
        />
        <Toggle
          checked={r.whetherCorrect}
          onChange={(v) => setR({ whetherCorrect: v })}
          label="Whether Correct"
          sub="Per question: correct, incorrect, or partially correct."
        />
        <Toggle
          checked={r.perQuestionFeedback}
          onChange={(v) => setR({ perQuestionFeedback: v })}
          label="Per-Question Feedback"
          sub="The feedback authored on each question."
        />
        <Toggle
          checked={sectioned && r.perSectionResults}
          onChange={(v) => setR({ perSectionResults: v })}
          disabled={!sectioned}
          label="Per-Section Results"
          sub={
            sectioned
              ? "Each Section's score (and pass/fail under Section-level grading), plus the cumulative Section completion record."
              : "Only available when the Quiz is sectioned."
          }
        />
      </div>
    </Section>
  );
}

function QuizPaymentsStep({ data, update }: StepProps) {
  return (
    <>
      <Section
        title="Paywall"
        desc="Charge for attempts. By default one price applies to every attempt; pricing can also differ by attempt number — e.g. NATE RTW is $60 for the first attempt and $45 thereafter."
      >
        <Toggle
          checked={data.paywallOn}
          onChange={(v) => update({ paywallOn: v })}
          label="Charge for attempts"
        />
        {data.paywallOn && <PaywallPricing data={data} update={update} />}
      </Section>

      <div className="form-divider" />

      <Section
        title="NATE Exam"
        desc="Flag this Quiz as a NATE exam to trigger NATE-specific behaviour. The External IDs are sent when communicating with NATE's API."
      >
        <Toggle
          checked={data.nateExam}
          onChange={(v) => update({ nateExam: v })}
          label="This is a NATE Exam"
        />
        {data.nateExam && (
          <div className="form-sub-group" style={{ marginTop: 16 }}>
            <label className="form-sub-label">
              External ID (English) <span className="req">*</span>
            </label>
            <input
              className="form-input"
              value={data.nateIdEn}
              placeholder="NATE-assigned exam ID (EN)"
              onChange={(e) => update({ nateIdEn: e.target.value })}
            />
            <label className="form-sub-label" style={{ marginTop: 18 }}>
              External ID (Spanish) <span className="req">*</span>
            </label>
            <input
              className="form-input"
              value={data.nateIdEs}
              placeholder="NATE-assigned exam ID (ES)"
              onChange={(e) => update({ nateIdEs: e.target.value })}
            />
            <p className="form-help">Both IDs are required when NATE Exam is enabled.</p>
          </div>
        )}
      </Section>
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

function NameAndDescription({ data, update }: StepProps) {
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
        <select
          className="form-select"
          value={data.timeUnit}
          onChange={(e) => update({ timeUnit: e.target.value as TimeUnit })}
        >
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
          <option value="weeks">weeks</option>
        </select>
      </div>
    </div>
  );
}

function FinalExamField({ data, update }: StepProps) {
  return (
    <div className="form-group">
      <label className="form-label">Final Exam</label>
      <Toggle
        checked={data.finalExam}
        onChange={(v) => update({ finalExam: v })}
        label="Mark this Task as a final exam"
        sub="Flags the Task as the certifying final exam. Used for reporting and filterable from the Task list."
      />
    </div>
  );
}

function VisibilitySection({
  data,
  update,
  forType = "Task",
  heading = true,
}: StepProps & { forType?: string; heading?: boolean }) {
  return (
    <Section title={heading ? "Visibility" : undefined}>
      <div className="radio-card-group">
        <RadioCard
          selected={data.visibility === "visible"}
          onSelect={() => update({ visibility: "visible" })}
          title="Visible"
          desc={`Learners can find and start this ${forType}.`}
        />
        <RadioCard
          selected={data.visibility === "hidden"}
          onSelect={() => update({ visibility: "hidden" })}
          title="Hidden"
          desc={`${forType} exists but is not discoverable to learners. Saving as draft always sets to Hidden.`}
        />
      </div>
    </Section>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title?: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section">
      {title && <h2 className="form-section-title">{title}</h2>}
      {desc && <p className="form-section-desc">{desc}</p>}
      {children}
    </section>
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

function Toggle({
  checked,
  onChange,
  label,
  sub,
  inline,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
  inline?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`toggle-row ${inline ? "inline" : ""} ${disabled ? "disabled" : ""}`}>
      {inline && <span className="toggle-inline-label">{label}</span>}
      {!inline && (
        <div className="toggle-text">
          <div className="toggle-label">{label}</div>
          {sub && <div className="toggle-sub">{sub}</div>}
        </div>
      )}
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        aria-pressed={checked}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

/* ─────────────────  Field components  ───────────────── */

function PackageField({
  enFiles,
  esFiles,
  setEnFiles,
  setEsFiles,
  hint,
}: {
  enFiles: UploadedFile[];
  esFiles: UploadedFile[];
  setEnFiles: (f: UploadedFile[]) => void;
  setEsFiles: (f: UploadedFile[]) => void;
  hint?: string;
}) {
  return (
    <div className="upload-container">
      {enFiles.length === 0 ? (
        <BigDropZone onAdd={(files) => setEnFiles(files)} hint={hint} />
      ) : (
        <>
          <FileList
            files={enFiles}
            onRemove={(idx) =>
              setEnFiles(enFiles.filter((_, i) => i !== idx))
            }
          />
          <SlimDrop
            onAdd={(files) => setEnFiles([...enFiles, ...files])}
          />
        </>
      )}

      <div className="upload-lang-divider">
        <span className="lang-tag">ESPAÑOL</span>
      </div>

      {esFiles.length > 0 && (
        <FileList
          files={esFiles}
          onRemove={(idx) =>
            setEsFiles(esFiles.filter((_, i) => i !== idx))
          }
        />
      )}
      <SlimDrop onAdd={(files) => setEsFiles([...esFiles, ...files])} />
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
  hint = "ZIP · 250 MB MAX",
}: {
  onAdd: (files: UploadedFile[]) => void;
  hint?: string;
}) {
  return (
    <FilePicker onPick={onAdd}>
      {(open) => (
        <button className="drop-big" onClick={open} type="button">
          <span className="drop-big-icon">
            <UploadIcon />
          </span>
          <div className="drop-big-title">Drop files or click to upload</div>
          <div className="drop-big-hint">{hint}</div>
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
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
}) {
  return (
    <div className="lang-field">
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input
          className="lang-field-input"
          value={en}
          onChange={(e) => onChangeEn(e.target.value)}
          placeholder={placeholderEn}
        />
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input
          className="lang-field-input"
          value={es}
          onChange={(e) => onChangeEs(e.target.value)}
          placeholder={placeholderEs}
        />
      </div>
    </div>
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
  const [focus, setFocus] = useState<"en" | "es">("en");

  return (
    <div className="rte-field">
      {focus === "en" && <RteToolbar />}
      <AutoTextarea
        className="rte-area"
        value={en}
        onChange={onChangeEn}
        onFocus={() => setFocus("en")}
      />
      <div className="rte-field-divider" />
      {focus === "es" && <RteToolbar />}
      <div className="rte-lang-row">
        <AutoTextarea
          className="rte-area"
          value={es}
          onChange={onChangeEs}
          onFocus={() => setFocus("es")}
        />
        <span className="lang-tag floating">ESPAÑOL</span>
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

function RteToolbar() {
  return (
    <div className="rte-toolbar">
      <button className="rte-btn"><BoldIcon /></button>
      <button className="rte-btn"><ItalicIcon /></button>
      <button className="rte-btn"><UnderlineIcon /></button>
      <span className="rte-sep" />
      <button className="rte-btn"><BulletListIcon /></button>
      <button className="rte-btn"><NumberListIcon /></button>
      <button className="rte-btn"><IndentRightIcon /></button>
      <button className="rte-btn"><IndentLeftIcon /></button>
      <span className="rte-sep" />
      <button className="rte-btn"><LinkSmallIcon /></button>
      <button className="rte-btn"><ImageIcon /></button>
      <button className="rte-btn"><VideoIcon /></button>
      <button className="rte-btn"><AudioIcon /></button>
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
