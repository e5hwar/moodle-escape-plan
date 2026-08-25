import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import { CheckBoldIcon, InfoTipIcon, SmallXIcon } from "./icons";
import { ImageUploadField, type PickedImage } from "./ImageUploadField";
import { RteToolbar } from "./RteToolbar";
import { AutoTextarea } from "./AutoTextarea";
import { CertSplitTaskWizard } from "./CertSplitTaskWizard";
import { AddExistingTasksModal } from "./AddExistingTasksModal";
import { Dropdown } from "./Dropdown";
import { SearchIcon, AddIcon, LockIcon, DragHandleIcon, TreeKebabIcon, PlusThinIcon, PencilIcon } from "./icons";
import { WizardStepRail } from "./WizardStepRail";
import { SelectField } from "./SelectField";
import { type TaskTypeKey, TASK_TYPE_OPTIONS } from "./Footer";
import { PrmModal } from "./PrmModal";
import { MultiSelect } from "./NewCompanyWizard";
import { type Certification, certifications } from "../data/certifications";
import { industries } from "../data/industries";
import { tasks as taskLibrary, type Task, type TaskType } from "../data/tasks";
import { DEFAULT_PARTNERSHIPS, DEFAULT_TRADES } from "../data/productConfig";
import { PriceIdFields, newPriceIds, type PriceIds } from "./PriceIdFields";

type CareerStage = "pre-apprentice" | "apprentice" | "journeyman" | "master";
type CertType = "unit" | "credential" | "program" | "bundle";
type Visibility = "visible" | "hidden";
type AccessType = "open" | "non-consumable" | "consumable";
// Repurchase behaviour — Consumable paywalls only. Determines whether a user's
// progress is wiped or kept when they buy the Certification again.
type ConsumableProgress = "reset" | "preserve";
type TimeUnit = "minutes" | "hours" | "days" | "weeks";

/* Same design-system single-select as the Task wizard's unit picker
   (Figma 101:281 trigger + 591:1382 menu). */
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

type TaskKind = "xapi" | "quiz" | "hands-on" | "file";

// Content Tags for Visibility — three tag types. Trade and Partnership draw
// their values from the B2B Management fields under Product Config; User Type is
// either unset (blank) or "B2B Only". Multiple tags of each type are allowed.
type ContentTagType = "trade" | "partnership" | "userType";

type ContentTag = {
  id: string;
  type: ContentTagType;
  value: string;
};

const USER_TYPE_VALUES = ["B2B Only"];

// Access Restriction (spec V1) — a Task can be gated behind other Tasks within
// the same Certification. The user must complete `all` or `any` one of the
// selected prerequisite Tasks. Satisfying status is derived per Task type (see
// satisfyingStatus): Completed for every Task type.
type AccessRestriction = {
  enabled: boolean;
  mode: "all" | "any";
  taskIds: string[];
};

type CertTask = {
  id: string;
  name: string;
  kind: TaskKind;
  duration: string;
  restriction?: AccessRestriction;
  // Marks this Task as a Final Exam within the Certification. Surfaced as a flag
  // on the Add Tasks tree; a Cert can have more than one flagged Task.
  finalExam?: boolean;
};

// The status a prerequisite Task must reach to satisfy a restriction (V1).
function satisfyingStatus(_kind: TaskKind): string {
  return "Completed";
}

// Every Task in the Certification, flattened (direct Course tasks + Lesson
// tasks). Used to populate the prerequisite picker — only same-Cert Tasks are
// eligible, which is exactly this list minus the Task being edited.
function flattenTasks(courses: CertCourse[]): CertTask[] {
  const out: CertTask[] = [];
  for (const co of courses) {
    for (const ch of co.children) {
      if (ch.kind === "task") out.push(ch.task);
      else out.push(...ch.lesson.tasks);
    }
  }
  return out;
}

// Reorder a sibling list by moving the item with `fromId` to sit where `toId`
// currently is. `toIdx` is captured from the ORIGINAL list: dragging down lands
// the item just after the target, dragging up lands it just before — and, unlike
// an after-removal index, dropping onto the adjacent row is never a silent no-op.
function reorderList<T>(list: T[], fromId: string, toId: string, idOf: (t: T) => string): T[] {
  if (fromId === toId) return list;
  const fromIdx = list.findIndex((t) => idOf(t) === fromId);
  const toIdx = list.findIndex((t) => idOf(t) === toId);
  if (fromIdx < 0 || toIdx < 0) return list;
  const next = [...list];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

// Stable key for a Course child, whichever kind it is.
const childKey = (ch: CourseChild): string =>
  ch.kind === "task" ? ch.task.id : ch.lesson.id;

// Drag context: which sibling list ("scope") the in-flight item belongs to, and
// its id. Drops are only honoured within the same scope.
type DragCtx = { scope: string; id: string };

// Props for a draggable handle + its droppable row, wired to a shared drag state.
// `handle` goes on the DragDots grip; `target` goes on the row that can receive a
// drop. Only same-scope drags are accepted.
type DndProps = {
  handle: React.HTMLAttributes<HTMLElement> & { draggable: boolean };
  target: React.HTMLAttributes<HTMLElement>;
};

// Courses and Lessons carry their name and description in both English and
// Spanish — the same bilingual pattern the Certification itself uses.
type CertLesson = {
  id: string;
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  expanded: boolean;
  hidden: boolean;
  tasks: CertTask[];
};

type CourseChild =
  | { kind: "task"; task: CertTask }
  | { kind: "lesson"; lesson: CertLesson };

type CertCourse = {
  id: string;
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  expanded: boolean;
  hidden: boolean;
  children: CourseChild[];
  // Set when this Course was copied in from an imported Certification (the
  // "Create as Learning Plan" flow). New Course/Lesson entities are created, but
  // the Tasks inside are reused — see buildImportedCourses.
  sourceCertId?: string;
  sourceCertName?: string;
};

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 2.92M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.3 9.3 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a2.6 2.6 0 0 0 3.7 3.7" />
    <path d="M2 2l20 20" />
  </svg>
);

// Stacked layers — marks the "Create as Learning Plan" flow, which merges
// several Certifications into one.
const LayersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2 2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5" />
    <path d="M2 12l10 5 10-5" />
  </svg>
);

// Pencil (Figma I340:1516;7:3612) — opens a node's inline name/description
// editor. Now shared: see PencilIcon in icons.tsx.
/* Task glyphs — one per Task type, each a stroked 1.333 path offset into a 16px
   slot. Replaced the single play-in-circle: the tree now names the type twice,
   once by glyph and once in the mono suffix. */
// xAPI (Figma I354:249;7:648) — open book with lines on the right leaf.
const XapiTaskIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333">
    <g transform="translate(0.667 1.333)">
      <path d="M7.33333 12.6667V2.66667M7.33333 12.6667H6.66667C6.66667 12.6667 4.66667 12 0.666667 12V0.666667H5.33333C5.86377 0.666667 6.37247 0.87738 6.74755 1.25245C7.12262 1.62753 7.33333 2.13623 7.33333 2.66667M7.33333 12.6667H8C8 12.6667 10 12 14 12V0.666667H9.33333C8.8029 0.666667 8.29419 0.87738 7.91912 1.25245C7.54405 1.62753 7.33333 2.13623 7.33333 2.66667" />
      <path d="M11.3333 4.66667H10M11.3333 6.66667H10" strokeLinecap="square" />
    </g>
  </svg>
);
// Quiz (Figma I354:255;7:3217) — speech bubble carrying a question mark.
const QuizTaskIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <g transform="translate(1 1.333)">
      <path d="M0.666667 0.666667H13.3333V10H3.33333L0.666667 12.3333V0.666667Z" />
      <path d="M5.66667 4.33333C5.66667 3.97971 5.80714 3.64057 6.05719 3.39052C6.30724 3.14048 6.64638 3 7 3C7.35362 3 7.69276 3.14048 7.94281 3.39052C8.19286 3.64057 8.33333 3.97971 8.33333 4.33333C8.33333 5.66667 7.002 5.68533 7.002 5.83333M7 7.66667H7.00267V7.66933H7V7.66667Z" />
    </g>
  </svg>
);
// Resource (Figma I354:261;7:3796) — document with a folded corner.
const ResourceTaskIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333">
    <g transform="translate(2 0.667)">
      <path d="M7.33333 0.666667V4.66667H11.3333M7.33333 0.666667H8L11.3333 4V4.66667M7.33333 0.666667H0.666667V14H11.3333V4.66667" />
      <path d="M8.66667 8H3.33333M8.66667 10.6667H3.33333" strokeLinecap="square" />
    </g>
  </svg>
);
// Hands-On Task (Figma 354:267 "upload") — arrow rising out of a tray.
const HandsOnTaskIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <path d="M11 5.66667L8 2.66667L5 5.66667M8 3.5V10" />
    <path d="M13.6667 10V13.3333H2.33333V10" />
  </svg>
);
// Plus, 20px slot (Figma I513:2738;7:30) — the "Add Course" / "Add Lesson" /
// "Add Task" cards. Same glyph as PlusThinIcon, scaled 14 → 20.
const PlusLgIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.667" strokeLinecap="square">
    <path d="M10 4.167V15.833M15.833 10H4.167" />
  </svg>
);
// Padlock (Figma I356:1945;7:2434) — a filled 7.08×8.75 lock centred in a 10px
// slot. Leads the gate banner on a Task with an Access Restriction applied.
const RestrictionLockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
    <g transform="translate(1.458 0.417)">
      <path d="M1.04167 3.75H0V8.75H7.08333V3.75H6.04167V2.5C6.04167 1.83696 5.77828 1.20107 5.30943 0.732233C4.84059 0.263392 4.20471 0 3.54167 0C2.87863 0 2.24274 0.263392 1.7739 0.732233C1.30506 1.20107 1.04167 1.83696 1.04167 2.5V3.75ZM1.875 2.5C1.875 2.05797 2.05059 1.63405 2.36316 1.32149C2.67572 1.00893 3.09964 0.833333 3.54167 0.833333C3.98369 0.833333 4.40762 1.00893 4.72018 1.32149C5.03274 1.63405 5.20833 2.05797 5.20833 2.5V3.75H1.875V2.5ZM2.29167 6.66667V5.83333H4.79167V6.66667H2.29167Z" />
    </g>
  </svg>
);
// Trash — removes a Course, Lesson, or Task from the tree.
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
// Right chevron — the Collapse / Expand item in a Course or Lesson kebab menu.
// (The tree itself has no caret: the header row is the collapse affordance.)
const CaretIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 6 15 12 9 18" />
  </svg>
);
// Flag — toggles a Task's Final Exam marker on the Add Tasks tree.
const FlagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);
// Draggable dot-grid handle (Figma "move" 340:1502 — the shared 2×4 glyph at
// 14px). Grab it to reorder siblings within the same list (Courses among
// Courses, a Course's Tasks/Lessons among themselves, a Lesson's Tasks among
// themselves). Handle props are supplied by the owning list. Course headers
// carry it inline; Lesson and Task rows park it in the card's left gutter,
// where it fades in on hover — the Figma rows have no grip at rest.
function DragDots({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean }) {
  return (
    <span className={`cert-grip ${className}`} title="Drag to reorder" {...props}>
      <DragHandleIcon />
    </span>
  );
}

// Tree-node IDs created during a session. The counter guards against collisions
// when several nodes are created within the same millisecond.
let nodeSeq = 0;
const nodeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${nodeSeq++}`;

function newCourse(): CertCourse {
  return { id: nodeId("co"), nameEn: "", nameEs: "", descEn: "", descEs: "", expanded: true, hidden: false, children: [] };
}

function newLesson(): CertLesson {
  return { id: nodeId("le"), nameEn: "", nameEs: "", descEn: "", descEs: "", expanded: true, hidden: false, tasks: [] };
}

// Convert a Task from the library into the lightweight CertTask the tree stores.
function libraryTaskToCertTask(t: Task): CertTask {
  const kind = TASK_TYPE_TO_KIND[t.type];
  return { id: nodeId("t"), name: t.name, kind, duration: DURATION_BY_KIND[kind], finalExam: t.finalExam };
}

// Maps a stored Task's display type onto the wizard's TaskKind (used for badges).
const TASK_TYPE_TO_KIND: Record<TaskType, TaskKind> = {
  xAPI: "xapi",
  Quiz: "quiz",
  "Hands-On Task": "hands-on",
  Resource: "file",
};

const DURATION_BY_KIND: Record<TaskKind, string> = {
  xapi: "10 min",
  quiz: "15 min",
  "hands-on": "30 min",
  file: "5 min",
};

// Existing Certifications don't persist their structure, so when editing we
// populate plausible sample data: Tasks already associated with the Cert (by
// name) become a Course with a Lesson, and the final-exam-like Task seeds one
// Completion Condition Set.
function buildSampleStructure(editing: Certification): {
  courses: CertCourse[];
  conditionSets: ConditionSet[];
} {
  let associated = taskLibrary.filter((t) => t.usedIn.includes(editing.name));
  if (associated.length === 0) associated = taskLibrary.slice(0, 4);

  const certTasks = associated.map(libraryTaskToCertTask);
  const lessonTasks = certTasks.slice(0, Math.min(3, certTasks.length));
  const looseTasks = certTasks.slice(lessonTasks.length);

  const course: CertCourse = {
    id: nodeId("co"),
    nameEn: `${editing.name} Coursework`,
    nameEs: "",
    descEn: `Core lessons and tasks for ${editing.name}.`,
    descEs: "",
    expanded: true,
    hidden: false,
    children: [
      {
        kind: "lesson",
        lesson: {
          id: nodeId("le"),
          nameEn: "Core Concepts",
          nameEs: "",
          descEn: "",
          descEs: "",
          expanded: false,
          hidden: false,
          tasks: lessonTasks,
        },
      },
      ...looseTasks.map((task) => ({ kind: "task" as const, task })),
    ],
  };

  // Prefer a Task flagged as the final exam, else a Quiz, else the first Task.
  const finalTask =
    associated.find((t) => t.finalExam) ??
    associated.find((t) => t.type === "Quiz") ??
    associated[0];

  const conditionSets: ConditionSet[] = finalTask
    ? [
        {
          id: nodeId("cs"),
          items: [
            { kind: "task", id: nodeId("it"), name: finalTask.name, taskKind: TASK_TYPE_TO_KIND[finalTask.type] },
          ],
        },
      ]
    : [];

  return { courses: [course], conditionSets };
}

// A Course is "empty" when it has no name in either language and holds nothing.
// Used to drop the seeded placeholder Course when a Learning Plan is imported.
function isEmptyCourse(c: CertCourse): boolean {
  return !c.nameEn.trim() && !c.nameEs.trim() && c.children.length === 0;
}

// Build the Course(s) a single imported Certification contributes to a Learning
// Plan. Source Certs don't persist their real Course breakdown, so we synthesize
// one Course carrying the Cert's name (the same sample approach buildSampleStructure
// uses), tagged with its origin. Tasks are pulled from the library and REUSED —
// no new Tasks are created (spec 2.3.2 Reusability).
function buildImportedCourses(cert: Certification): CertCourse[] {
  let associated = taskLibrary.filter((t) => t.usedIn.includes(cert.name));
  if (associated.length === 0) associated = taskLibrary.slice(0, 4);

  const certTasks = associated.map(libraryTaskToCertTask);
  const lessonTasks = certTasks.slice(0, Math.min(3, certTasks.length));
  const looseTasks = certTasks.slice(lessonTasks.length);

  const course: CertCourse = {
    id: nodeId("co"),
    nameEn: cert.name,
    nameEs: "",
    descEn: `Imported from ${cert.name} (${cert.id}).`,
    descEs: "",
    expanded: false,
    hidden: false,
    sourceCertId: cert.id,
    sourceCertName: cert.name,
    children: [
      {
        kind: "lesson",
        lesson: {
          id: nodeId("le"),
          nameEn: "Core Concepts",
          nameEs: "",
          descEn: "",
          descEs: "",
          expanded: false,
          hidden: false,
          tasks: lessonTasks,
        },
      },
      ...looseTasks.map((task) => ({ kind: "task" as const, task })),
    ],
  };

  return [course];
}

// Completion model — spec 7.3.7.1. A Certification completes when ANY one
// Condition Set is satisfied in full (Condition Sets are OR'd). Within a
// Condition Set, ALL items must be completed (items are AND'd — there is no
// any/all toggle). A Condition Set can hold any mix of item types.
type CompletionItem =
  | { kind: "task"; id: string; name: string; taskKind: TaskKind }
  | { kind: "quiz-section"; id: string; name: string; quizName: string }
  | { kind: "cert"; id: string; name: string };

type ConditionSet = {
  id: string;
  items: CompletionItem[];
};

type WizardData = {
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  thumbnail: PickedImage | null;
  timeValue: string;
  timeUnit: TimeUnit;
  careerStage: CareerStage | "";
  // Type is optional — "None" is a real value, not a placeholder.
  type: CertType | "";
  ceus: string;
  industries: string[];

  // Additional Info
  announceEn: string;
  announceEs: string;
  keywordsEn: string;
  keywordsEs: string;

  // Deep Link (spec §19). Every Certification has exactly one Deep Link, keyed by
  // a URL slug. `slugCustom` tracks whether the Admin overrode the auto-generated
  // slug; while false the slug follows the Certification name.
  slug: string;
  slugCustom: boolean;

  courses: CertCourse[];

  // Certifications merged into this one via "Create as Learning Plan", in the
  // order learners progress through them. Drives the imported Courses and the
  // single completion Condition Set.
  importedCerts: { id: string; name: string }[];

  conditionSets: ConditionSet[];

  visibility: Visibility;
  accessType: AccessType;
  consumableProgress: ConsumableProgress;
  priceIds: PriceIds;
  contentTags: ContentTag[];

  // Archiving
  archived: boolean;
  replacementCerts: { id: string; name: string }[];
  replaceAlertEn: string;
  replaceAlertEs: string;
};

// Everything starts blank when creating a new Certification. Type defaults to
// "unit"; career stage starts unset (a Cert may have no career stage).
/* ─────────────────  Deep Link slugs (spec §19)  ───────────────── */

// The host every Deep Link resolves to. Shown as a read-only prefix; the string
// is the one on Figma 699:1071 (the spec's §19.1 draft said "skillcat.app/").
const DEEP_LINK_BASE = "www.skillcatapp.com/";

/** Stable empty set — keeps `missing` referentially stable before any publish. */
const EMPTY_KEYS: ReadonlySet<string> = new Set();

// Reserved paths that can't be used as a Certification slug — App Page Deep Links
// (§19.3.4) plus platform keywords (§19.3.5). Matched case-insensitively.
const RESERVED_SLUGS = new Set(
  [
    "reupload-id",
    "login",
    "home",
    "portfolio",
    "signup",
    "register",
    "settings",
    "admin",
    "dashboard",
    "certifications",
    "certification",
    "path",
    "profile",
    "logout",
  ].map((s) => s.toLowerCase()),
);

// Auto-generate a URL-safe slug from a Certification name (§19.3.5) — keep
// alphanumeric runs, drop everything else, and CamelCase-join the words
// (e.g. "Heat Pump Specialist (2026)" → "HeatPumpSpecialist2026").
function slugify(name: string): string {
  return name
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .join("");
}

// Slugs already taken by other Certifications (case-insensitive), excluding the
// one being edited so re-saving its own slug isn't flagged as a duplicate.
function takenSlugs(excludeName?: string): Set<string> {
  const taken = new Set<string>();
  for (const c of certifications) {
    if (excludeName && c.name === excludeName) continue;
    taken.add(slugify(c.name).toLowerCase());
  }
  return taken;
}

// Validate a slug (§19.3.5). Returns an error message, or null when valid.
function validateSlug(slug: string, excludeName?: string): string | null {
  if (!slug.trim()) return "Enter a slug or leave it to auto-generate.";
  if (!/^[A-Za-z0-9_-]+$/.test(slug))
    return "Only letters, numbers, dashes, and underscores are allowed.";
  if (RESERVED_SLUGS.has(slug.toLowerCase()))
    return `"${slug}" is a reserved keyword and can't be used.`;
  if (takenSlugs(excludeName).has(slug.toLowerCase()))
    return "Another Certification already uses this slug.";
  return null;
}

const BLANK_DATA: WizardData = {
  nameEn: "",
  nameEs: "",
  descEn: "",
  descEs: "",
  thumbnail: null,
  timeValue: "",
  timeUnit: "hours",
  careerStage: "",
  type: "",
  ceus: "",
  industries: [],

  announceEn: "",
  announceEs: "",
  keywordsEn: "",
  keywordsEs: "",

  slug: "",
  slugCustom: false,

  courses: [],

  importedCerts: [],

  conditionSets: [],

  visibility: "visible",
  accessType: "open",
  // Preserve is the safe default; Reset is opted into per the OSHA case.
  consumableProgress: "preserve",
  priceIds: newPriceIds(),
  contentTags: [],

  archived: false,
  replacementCerts: [],
  replaceAlertEn: "",
  replaceAlertEs: "",
};

// When editing, prefill the fields the Certification record actually carries.
// Structural data (courses, completion) isn't stored on the list record, so for
// existing Certifications we populate plausible sample data instead.
function buildInitialData(editing?: Certification): WizardData {
  // Every Certification must contain at least one Course, so seed one by default.
  if (!editing) return { ...BLANK_DATA, courses: [newCourse()] };
  const vis = editing.visibility ?? "Visible";
  const sample = buildSampleStructure(editing);
  return {
    ...BLANK_DATA,
    courses: sample.courses,
    conditionSets: sample.conditionSets,
    nameEn: editing.name,
    industries: editing.industry ? [editing.industry] : [],
    ceus: editing.ceus ?? "",
    careerStage: editing.careerStage
      ? (editing.careerStage.toLowerCase() as CareerStage)
      : "",
    type: editing.type ? (editing.type.toLowerCase() as CertType) : "",
    keywordsEn: (editing.keywords ?? []).join(", "),
    // An existing Certification already has a live, persisted Deep Link slug.
    slug: slugify(editing.name),
    slugCustom: true,
    // An archived Cert isn't publicly visible, so it maps to "hidden" on the
    // Visibility step — its retired state is reflected by the archived toggle.
    visibility: vis === "Visible" ? "visible" : "hidden",
    archived: vis === "Archived",
  };
}

const STEPS = [
  { id: "details", label: "Details", sub: "Name, description, metadata", desc: "Name, describe, and tag this Certification." },
  { id: "additional", label: "Additional Info", sub: "Announcement, CEUs, keywords", desc: "Add an announcement, CEUs awarded on completion, and search keywords." },
  { id: "tasks", label: "Add Tasks", sub: "Courses, lessons, and tasks", desc: "Build this Certification's structure: Courses contain Lessons (optional) and Tasks. Tasks can be pulled from the Task library or created fresh — newly created Tasks are added to the library too." },
  { id: "completion", label: "Completion", sub: "How completion is determined", desc: "Define how this Certification is completed. Add Condition Sets — satisfying any one completes the Cert; every item within a set is required." },
  { id: "settings", label: "Other Settings", sub: "Paywall and content tags", desc: "Control how this Certification is purchased and which content tags gate its visibility." },
  { id: "archiving", label: "Archiving", sub: "Retire and replace", desc: "Archive this Certification and point enrolled learners to a replacement. Archiving is permanent." },
];

type Props = { onClose: () => void; editingCert?: Certification };

export function NewCertificationWizard({ onClose, editingCert }: Props) {
  const isEditing = !!editingCert;
  // Archiving retires an existing Certification and reroutes learners — it only
  // makes sense once the Cert exists, so the step is hidden while creating.
  const steps = isEditing ? STEPS : STEPS.filter((s) => s.id !== "archiving");
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => buildInitialData(editingCert));
  const [splitTask, setSplitTask] = useState<{ courseId: string; lessonId?: string; taskType: TaskTypeKey } | null>(null);
  // Where the "Add Existing Task" library picker will drop its Tasks, or null
  // while the picker is closed.
  const [existingPicker, setExistingPicker] = useState<{ courseId: string; lessonId?: string } | null>(null);
  // Completion criteria start locked when editing an existing Certification —
  // unlocking requires acknowledging that completion data will be reset.
  const [completionUnlocked, setCompletionUnlocked] = useState(false);
  // Set once a publish has been attempted, so the rail and the fields only start
  // flagging gaps after the admin has said they're done.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  // Open once the Certification exists — Industries are tagged after creation,
  // not as a Details field.
  const [showIndustries, setShowIndustries] = useState(false);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  // The step pane scrolls, so jumping to a flagged field has to take the view
  // back to the top — otherwise a same-step jump looks like nothing happened.
  const contentRef = useRef<HTMLDivElement>(null);
  function goStep(i: number) {
    setStep(i);
    contentRef.current?.scrollTo({ top: 0 });
  }

  const stepIndex = useCallback(
    (id: string) => Math.max(0, steps.findIndex((s) => s.id === id)),
    [steps],
  );

  /* Every mandatory field in the wizard — the ones drawn with a red asterisk —
     paired with the step that owns it, so a failed publish can jump to the
     first one. */
  const collectMissing = useCallback(
    (d: WizardData) => {
      const gaps: { step: number; key: string }[] = [];
      if (!d.nameEn.trim()) gaps.push({ step: stepIndex("details"), key: "name" });
      // A Condition Set with no items completes nothing, so an empty-handed
      // Completion step counts as missing either way.
      if (!d.conditionSets.some((cs) => cs.items.length > 0)) {
        gaps.push({ step: stepIndex("completion"), key: "completion" });
      }
      return gaps.sort((a, b) => a.step - b.step);
    },
    [stepIndex],
  );

  // Live view of the gaps: a field stops flagging the moment it's filled, without
  // waiting for another publish attempt.
  const missing = useMemo(
    () => (attemptedSubmit ? new Set(collectMissing(data).map((g) => g.key)) : EMPTY_KEYS),
    [attemptedSubmit, collectMissing, data],
  );

  /** Steps that still hold a flagged empty field — drives the rail's error state. */
  const errorSteps = useMemo(() => {
    const out = new Set<number>();
    if (!attemptedSubmit) return out;
    for (const g of collectMissing(data)) out.add(g.step);
    return out;
  }, [attemptedSubmit, collectMissing, data]);

  /* Publish / Save changes: check every mandatory field on every step first. A
     gap sends you to the step that owns the first one with it flagged. A clean
     create hands off to the Industries modal, which is what actually closes the
     wizard. */
  function handlePublish() {
    setAttemptedSubmit(true);
    const gaps = collectMissing(data);
    if (gaps.length > 0) {
      goStep(gaps[0].step);
      return;
    }
    if (isEditing) {
      onClose();
      return;
    }
    setShowIndustries(true);
  }

  // Append a built CertTask to a Course (or a Lesson within it). Shared by both
  // the "Create New" split-screen flow and the "Add Existing" picker.
  function appendTask(courseId: string, lessonId: string | undefined, task: CertTask) {
    setData((d) => ({
      ...d,
      courses: d.courses.map((co) => {
        if (co.id !== courseId) return co;
        if (lessonId) {
          return {
            ...co,
            children: co.children.map((c) =>
              c.kind === "lesson" && c.lesson.id === lessonId
                ? { kind: "lesson" as const, lesson: { ...c.lesson, tasks: [...c.lesson.tasks, task] } }
                : c,
            ),
          };
        }
        return { ...co, children: [...co.children, { kind: "task" as const, task }] };
      }),
    }));
  }

  if (splitTask) {
    return (
      <CertSplitTaskWizard
        cert={data}
        taskType={splitTask.taskType}
        targetCourseId={splitTask.courseId}
        targetLessonId={splitTask.lessonId}
        onClose={() => setSplitTask(null)}
        onAdd={(task) => {
          appendTask(splitTask.courseId, splitTask.lessonId, task);
          setSplitTask(null);
        }}
      />
    );
  }

  return (
    <div className="wizard">
      <div className="wizard-body">
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">
              {isEditing ? "Editing" : "Creating"}
            </span>
            <span className="wizard-brand-name">
              {editingCert ? editingCert.name : "New Certification"}
            </span>
          </div>

          <ol className="wizard-steps">
            {steps.map((s, i) => {
              const status = errorSteps.has(i)
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

        <div className="wizard-content" ref={contentRef}>
          <h1 className="wizard-title">{steps[step].label}</h1>
          <p className="wizard-desc">{steps[step].desc}</p>

          {step === 0 && (
            <DetailsStep data={data} update={update} nameError={missing.has("name")} />
          )}
          {step === 1 && (
            <AdditionalInfoStep
              data={data}
              update={update}
              editingName={editingCert?.name}
            />
          )}
          {step === 2 && (
            <TasksStep
              data={data}
              update={update}
              onCreateTask={(courseId, lessonId, taskType) => setSplitTask({ courseId, lessonId, taskType })}
              onAddExisting={(courseId, lessonId) => setExistingPicker({ courseId, lessonId })}
            />
          )}
          {step === 3 && (
            <CompletionStep
              data={data}
              update={update}
              criteriaLocked={isEditing && !completionUnlocked}
              onUnlockCriteria={() => setCompletionUnlocked(true)}
              missing={missing.has("completion")}
            />
          )}
          {step === 4 && <SettingsStep data={data} update={update} />}
          {step === 5 && <ArchivingStep data={data} update={update} />}
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          {isEditing && <span className="wizard-saved">Last saved 2 minutes ago</span>}
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          <button className="btn-save-draft" onClick={onClose}>Save as draft</button>
          <button className="btn-publish" onClick={handlePublish}>
            {isEditing ? "Save changes" : "Publish"}
          </button>
        </div>
      </footer>

      {showIndustries && (
        <CertIndustriesModal
          certName={data.nameEn.trim() || "this Certification"}
          value={data.industries}
          onChange={(v) => update({ industries: v })}
          onDone={onClose}
        />
      )}

      {existingPicker && (
        <AddExistingTasksModal
          certIndustries={data.industries}
          destination={destinationLabel(data.courses, existingPicker)}
          existingNames={flattenTasks(data.courses).map((t) => t.name)}
          onCancel={() => setExistingPicker(null)}
          onConfirm={(picked) => {
            picked.forEach((t) =>
              appendTask(existingPicker.courseId, existingPicker.lessonId, libraryTaskToCertTask(t)),
            );
            setExistingPicker(null);
          }}
        />
      )}
    </div>
  );
}

/* Industries are tagged once the Certification exists, not while it's being
   built — so the last thing a create flow does is hand the new Cert to this
   modal. Options are the same "Industry › Sub-Industry" paths the cert records
   and the Certifications filters use. */
const INDUSTRY_OPTIONS: string[] = [...industries]
  .sort((a, b) => a.displayPosition - b.displayPosition)
  .flatMap((ind) => [
    ind.name,
    ...[...ind.subIndustries]
      .sort((a, b) => a.displayPosition - b.displayPosition)
      .map((sub) => `${ind.name} › ${sub.name}`),
  ]);

function CertIndustriesModal({
  certName,
  value,
  onChange,
  onDone,
}: {
  certName: string;
  value: string[];
  onChange: (v: string[]) => void;
  onDone: () => void;
}) {
  return (
    <PrmModal
      title="Add Industries"
      description={
        <>
          <strong>{certName}</strong> has been created. Tag it with the Industries and
          Sub-Industries learners browse it under.
        </>
      }
      confirmLabel={value.length > 0 ? "Add Industries" : "Done"}
      cancelLabel="Skip for now"
      onCancel={onDone}
      onConfirm={onDone}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">Industries</span>
          <MultiSelect
            popupMenu
            options={INDUSTRY_OPTIONS}
            value={value}
            onChange={onChange}
            placeholder="Select Industries"
            searchPlaceholder="Search Industries…"
          />
          <p className="form-help">
            Used for catalog browsing and content discovery. A Certification can belong to multiple
            Industries and Sub-Industries, and can be re-tagged any time from the Industries page.
          </p>
        </div>
      </div>
    </PrmModal>
  );
}

/** Human-readable "Course › Lesson" label for the Task-library picker header. */
function destinationLabel(
  courses: CertCourse[],
  target: { courseId: string; lessonId?: string },
): string {
  const idx = courses.findIndex((c) => c.id === target.courseId);
  const course = courses[idx];
  if (!course) return "this Certification";
  const courseName = course.nameEn.trim() || `Course ${idx + 1}`;
  if (!target.lessonId) return courseName;
  const child = course.children.find(
    (c) => c.kind === "lesson" && c.lesson.id === target.lessonId,
  );
  const lesson = child && child.kind === "lesson" ? child.lesson : null;
  if (!lesson) return courseName;
  return `${courseName} › ${lesson.nameEn.trim() || "Untitled Lesson"}`;
}

/* ─────────────────  Step 1: Details  ───────────────── */

/* Career Stage and Type are both optional single-selects that lead with an
   explicit "None" (Figma 359:2373). None takes the neutral active segment; every
   real value takes the accent one (639:895), so an unset field never reads as a
   deliberate choice. */
const CAREER_STAGES: { value: CareerStage | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "pre-apprentice", label: "Pre-Apprentice" },
  { value: "apprentice", label: "Apprentice" },
  { value: "journeyman", label: "Journeyman" },
  { value: "master", label: "Master" },
];

const CERT_TYPES: { value: CertType | ""; label: string }[] = [
  { value: "", label: "None" },
  { value: "unit", label: "Unit" },
  { value: "credential", label: "Credential" },
  { value: "program", label: "Program" },
  { value: "bundle", label: "Bundle" },
];

/* What each Type means. Too long for a subtext, so it hangs off the info glyph
   in the shared hover tooltip (Figma 451:545) instead. */
const CERT_TYPE_TIP =
  "Units are short and focussed (Intro to HVAC, Using a Multimeter, etc.). " +
  "Credentials are industry-recognised certifications (EPA, NATE, OSHA, etc.), " +
  "Programs are structured learning tracks spanning multiple weeks (JobReady, " +
  "Trade Schools, etc.), and Bundles are B2B-specific groupings of training " +
  "tailored for a company's workforce.";

function DetailsStep({
  data,
  update,
  nameError,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  nameError?: boolean;
}) {
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
          errorMessage="Enter a name to publish this Certification."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
          placeholderEn="Description"
          placeholderEs="Descripción"
        />
        <p className="form-help">
          Around 200 characters reads best. Longer descriptions are accepted but truncated in compact views.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Time to Complete</label>
        <div className="time-row">
          <input
            className="form-input no-spinner small"
            type="text"
            inputMode="numeric"
            placeholder="0"
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

      {/* Same control as the Task wizard's visibility (359:2373 / 639:895):
          Hidden takes the neutral active segment, Visible the accent one.
          Archiving — the permanent retirement — keeps its own step. */}
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
          Hiding a Certification prevents any user from seeing it anywhere in the app (including in
          their own Path). If the Certification is later made visible again, it reappears in the Path
          for users
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Thumbnail</label>
        <ImageUploadField
          value={data.thumbnail}
          onChange={(v) => update({ thumbnail: v })}
        />
        <p className="form-help">Recommended aspect ratio is 4:3 or 1:1</p>
      </div>

      <div className="form-group">
        <label className="form-label">Career Stage</label>
        <div className="seg-control">
          {CAREER_STAGES.map((s) => (
            <button
              key={s.value || "none"}
              type="button"
              className={`seg-btn${
                data.careerStage === s.value ? (s.value ? " active accent" : " active") : ""
              }`}
              aria-pressed={data.careerStage === s.value}
              onClick={() => update({ careerStage: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Type</label>
        <div className="seg-control">
          {CERT_TYPES.map((t) => (
            <button
              key={t.value || "none"}
              type="button"
              className={`seg-btn${
                data.type === t.value ? (t.value ? " active accent" : " active") : ""
              }`}
              aria-pressed={data.type === t.value}
              onClick={() => update({ type: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Subtext + tooltip glyph (Figma 696:1224): one centred row, 4px gap. */}
        <p className="form-help form-help--tip">
          Only used for internal reference
          <span
            className="form-help-info"
            tabIndex={0}
            role="note"
            aria-label={CERT_TYPE_TIP}
            data-tip={CERT_TYPE_TIP}
          >
            <InfoTipIcon />
          </span>
        </p>
      </div>
    </>
  );
}

/* ─────────────────  Step 2: Additional Info  ───────────────── */

function AdditionalInfoStep({
  data,
  update,
  editingName,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  editingName?: string;
}) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Announcement</label>
        <RichTextField
          en={data.announceEn}
          es={data.announceEs}
          onChangeEn={(v) => update({ announceEn: v })}
          onChangeEs={(v) => update({ announceEs: v })}
        />
        <p className="form-help">Shown to learners currently going through this Certification. Use for important updates.</p>
      </div>

      <div className="form-group">
        <label className="form-label">CEUs Awarded</label>
        <input
          className="form-input no-spinner small"
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={data.ceus}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d*\.?\d*$/.test(v)) update({ ceus: v });
          }}
        />
        <p className="form-help">Decimal values supported. Leave blank if no CEUs are issued.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Keywords</label>
        <LangField
          en={data.keywordsEn}
          es={data.keywordsEs}
          onChangeEn={(v) => update({ keywordsEn: v })}
          onChangeEs={(v) => update({ keywordsEs: v })}
          placeholderEn="Keywords"
          placeholderEs="Palabras clave"
        />
        <p className="form-help">
          Improves search and discoverability. Separate keywords with a comma
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Deep Link</label>
        <DeepLinkField data={data} update={update} editingName={editingName} />
        <p className="form-help">
          URL-safe characters only (letters, numbers, dashes, underscores). Must be unique across
          all Certifications.
        </p>
      </div>
    </>
  );
}

/* Deep Link editor — Figma 699:1071 "Prefix + Plain Text - DeepLink": one 45px
   bordered shell split by a hairline into a read-only host prefix and the slug
   input, with an underlined orange "Copy" link inside the input cell. The slug
   follows the Certification name until the Admin customises it; validation
   (spec §19) still covers URL-safety, reserved keywords, and global uniqueness,
   and surfaces as the standard field error rather than the old status footer. */
function DeepLinkField({
  data,
  update,
  editingName,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  editingName?: string;
}) {
  const autoSlug = slugify(data.nameEn);
  const effectiveSlug = data.slugCustom ? data.slug : autoSlug;
  const error = effectiveSlug ? validateSlug(effectiveSlug, editingName) : null;
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(`https://${DEEP_LINK_BASE}${effectiveSlug}`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

  return (
    <>
      <div className={`deeplink-input ${error ? "invalid" : ""}`}>
        <span className="deeplink-base">{DEEP_LINK_BASE}</span>
        <div className="deeplink-cell">
          <input
            className="deeplink-slug"
            value={effectiveSlug}
            placeholder="Enter the DeepLink Slug..."
            spellCheck={false}
            autoCapitalize="none"
            aria-invalid={!!error || undefined}
            onChange={(e) => update({ slug: e.target.value, slugCustom: true })}
          />
          <button
            type="button"
            className="deeplink-copy"
            disabled={!effectiveSlug || !!error}
            onClick={copy}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      {error && <p className="form-error-text">{error}</p>}
    </>
  );
}

/* ─────────────────  Step 3: Tasks tree  ───────────────── */

const KIND_LABEL: Record<TaskKind, { letter: string; cls: string; label: string }> = {
  xapi: { letter: "X", cls: "xapi", label: "xAPI" },
  quiz: { letter: "Q", cls: "quiz", label: "Quiz" },
  "hands-on": { letter: "H", cls: "handson", label: "Hands-On Task" },
  file: { letter: "R", cls: "file", label: "Resource" },
};

function TaskKindBadge({ kind }: { kind: TaskKind }) {
  const k = KIND_LABEL[kind];
  return <span className={`task-kind-badge ${k.cls}`}>{k.letter}</span>;
}

// The mono suffix that trails a Task's name on the tree ("·xAPI"), and the
// glyph that leads it. Replaced the old type-coloured gutter column — the row
// names its type twice, once as an icon and once as this label.
const KIND_MONO: Record<TaskKind, string> = {
  xapi: "xAPI",
  quiz: "Quiz",
  "hands-on": "Hands-On Task",
  file: "Resource",
};

const KIND_GLYPH: Record<TaskKind, () => React.JSX.Element> = {
  xapi: XapiTaskIcon,
  quiz: QuizTaskIcon,
  "hands-on": HandsOnTaskIcon,
  file: ResourceTaskIcon,
};

function TasksStep({
  data,
  update,
  onCreateTask,
  onAddExisting,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  onCreateTask: (courseId: string, lessonId: string | undefined, taskType: TaskTypeKey) => void;
  onAddExisting: (courseId: string, lessonId: string | undefined) => void;
}) {
  const [importing, setImporting] = useState(false);
  // Which Course/Lesson node currently has its name/description editor open.
  // Adding a Course or Lesson opens its editor immediately; only one is open at
  // a time, matching the prototype's focused inline-editing model.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The item currently being dragged for reorder, or null. Held in a ref so the
  // drop handler reads the live value regardless of when its closure was created
  // (dragstart's state update wouldn't reach a same-tick drop otherwise).
  const dragRef = useRef<DragCtx | null>(null);

  // Move an item within its sibling list. `scope` identifies the list:
  //   "courses"           — the top-level Course order
  //   "course:<courseId>" — that Course's Tasks + Lessons
  //   "lesson:<lessonId>" — that Lesson's Tasks
  function handleReorder(scope: string, fromId: string, toId: string) {
    if (scope === "courses") {
      update({ courses: reorderList(data.courses, fromId, toId, (c) => c.id) });
    } else if (scope.startsWith("course:")) {
      const courseId = scope.slice("course:".length);
      update({
        courses: data.courses.map((co) =>
          co.id === courseId
            ? { ...co, children: reorderList(co.children, fromId, toId, childKey) }
            : co,
        ),
      });
    } else if (scope.startsWith("lesson:")) {
      const lessonId = scope.slice("lesson:".length);
      update({
        courses: data.courses.map((co) => ({
          ...co,
          children: co.children.map((ch) =>
            ch.kind === "lesson" && ch.lesson.id === lessonId
              ? {
                  kind: "lesson" as const,
                  lesson: {
                    ...ch.lesson,
                    tasks: reorderList(ch.lesson.tasks, fromId, toId, (t) => t.id),
                  },
                }
              : ch,
          ),
        })),
      });
    }
  }

  // Build the handle + drop-target prop pairs for one row in a sibling list.
  const dnd = (scope: string, id: string): DndProps => ({
    handle: {
      draggable: true,
      onDragStart: (e) => {
        e.stopPropagation();
        dragRef.current = { scope, id };
        e.dataTransfer.effectAllowed = "move";
        // Firefox requires data to be set for a drag to begin.
        e.dataTransfer.setData("text/plain", id);
      },
      onDragEnd: () => {
        dragRef.current = null;
      },
    },
    target: {
      onDragOver: (e) => {
        const d = dragRef.current;
        if (d && d.scope === scope && d.id !== id) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      },
      onDrop: (e) => {
        const d = dragRef.current;
        if (d && d.scope === scope) {
          e.preventDefault();
          e.stopPropagation();
          handleReorder(scope, d.id, id);
        }
        dragRef.current = null;
      },
    },
  });

  // Reconcile the Learning Plan with the Certifications chosen in the importer.
  // Imported Courses come first (in the chosen order), then any Courses the admin
  // added by hand. Completion is regenerated as a single Condition Set that AND's
  // every imported Certification together (spec 7.3.7.1).
  function applyImport(selected: Certification[]) {
    setImporting(false);
    const manual = data.courses.filter((c) => !c.sourceCertId);

    if (selected.length === 0) {
      // Plan cleared — drop imported Courses and the auto-generated completion.
      update({
        courses: manual.length > 0 ? manual : [newCourse()],
        importedCerts: [],
        conditionSets: [],
      });
      return;
    }

    const importedCourses = selected.flatMap(buildImportedCourses);
    update({
      // Keep hand-added Courses, but discard a lone empty placeholder.
      courses: [...importedCourses, ...manual.filter((c) => !isEmptyCourse(c))],
      importedCerts: selected.map((c) => ({ id: c.id, name: c.name })),
      conditionSets: [
        {
          id: nodeId("cs"),
          items: selected.map((c) => ({
            kind: "cert" as const,
            id: nodeId("it"),
            name: c.name,
          })),
        },
      ],
    });
  }

  function toggleCourse(id: string) {
    update({
      courses: data.courses.map((c) =>
        c.id === id ? { ...c, expanded: !c.expanded } : c,
      ),
    });
  }

  function updateCourse(id: string, patch: Partial<CertCourse>) {
    update({
      courses: data.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function removeCourse(id: string) {
    // At least one Course is mandatory — never remove the last one.
    if (data.courses.length <= 1) return;
    if (editingId === id) setEditingId(null);
    update({ courses: data.courses.filter((c) => c.id !== id) });
  }

  // Closing a Course editor. A freshly-added Course left completely empty is
  // dropped on cancel (unless it's the only Course); otherwise the editor closes.
  function cancelCourseEditor(course: CertCourse) {
    setEditingId(null);
    if (data.courses.length > 1 && isEmptyCourse(course)) {
      update({ courses: data.courses.filter((c) => c.id !== course.id) });
    }
  }

  // Apply a transform to one Lesson nested inside a Course.
  function mapLesson(courseId: string, lessonId: string, fn: (l: CertLesson) => CertLesson) {
    update({
      courses: data.courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              children: c.children.map((ch) =>
                ch.kind === "lesson" && ch.lesson.id === lessonId
                  ? { kind: "lesson" as const, lesson: fn(ch.lesson) }
                  : ch,
              ),
            }
          : c,
      ),
    });
  }

  function updateLesson(courseId: string, lessonId: string, patch: Partial<CertLesson>) {
    mapLesson(courseId, lessonId, (l) => ({ ...l, ...patch }));
  }

  function toggleLesson(courseId: string, lessonId: string) {
    mapLesson(courseId, lessonId, (l) => ({ ...l, expanded: !l.expanded }));
  }

  function removeLesson(courseId: string, lessonId: string) {
    update({
      courses: data.courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              children: c.children.filter(
                (ch) => !(ch.kind === "lesson" && ch.lesson.id === lessonId),
              ),
            }
          : c,
      ),
    });
  }

  // Closing a Lesson editor. A freshly-added Lesson left empty (no name, no
  // tasks) is dropped on cancel; otherwise the editor just closes.
  function cancelLessonEditor(courseId: string, lesson: CertLesson) {
    setEditingId(null);
    if (!lesson.nameEn.trim() && !lesson.nameEs.trim() && lesson.tasks.length === 0) {
      removeLesson(courseId, lesson.id);
    }
  }

  function addLesson(courseId: string) {
    const lesson = newLesson();
    update({
      courses: data.courses.map((c) =>
        c.id === courseId
          ? { ...c, expanded: true, children: [...c.children, { kind: "lesson", lesson }] }
          : c,
      ),
    });
    setEditingId(lesson.id);
  }

  function addCourse() {
    const course = newCourse();
    update({ courses: [...data.courses, course] });
    setEditingId(course.id);
  }

  // Remove a Task wherever it lives — directly under a Course or inside a Lesson.
  function removeTaskById(taskId: string) {
    update({
      courses: data.courses.map((co) => ({
        ...co,
        children: co.children
          .filter((ch) => !(ch.kind === "task" && ch.task.id === taskId))
          .map((ch) =>
            ch.kind === "lesson"
              ? {
                  kind: "lesson" as const,
                  lesson: { ...ch.lesson, tasks: ch.lesson.tasks.filter((t) => t.id !== taskId) },
                }
              : ch,
          ),
      })),
    });
  }

  // Patch a single Task wherever it lives in the tree (directly under a Course
  // or inside a Lesson). Used to edit a Task's Access Restriction.
  function updateTaskById(taskId: string, patch: Partial<CertTask>) {
    update({
      courses: data.courses.map((co) => ({
        ...co,
        children: co.children.map((ch) => {
          if (ch.kind === "task") {
            return ch.task.id === taskId
              ? { kind: "task" as const, task: { ...ch.task, ...patch } }
              : ch;
          }
          return {
            kind: "lesson" as const,
            lesson: {
              ...ch.lesson,
              tasks: ch.lesson.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
            },
          };
        }),
      })),
    });
  }

  const allTasks = flattenTasks(data.courses);
  const plan = data.importedCerts;

  return (
    <>
      {plan.length === 0 ? (
        <div className="cert-lp-callout">
          <span className="cert-lp-callout-icon"><LayersIcon /></span>
          <div className="cert-lp-callout-text">
            <div className="cert-lp-callout-title">Create as Learning Plan</div>
            <div className="cert-lp-callout-desc">
              Merge existing Certifications to form what is typically a Learning Plan.
              Each one's Courses, Lessons, and Tasks are imported — Tasks are reused,
              not duplicated — and completion requires all of them.
            </div>
          </div>
          <button className="cert-lp-import-btn" onClick={() => setImporting(true)}>
            Import Other Certifications
          </button>
        </div>
      ) : (
        <div className="cert-lp-banner">
          <span className="cert-lp-banner-icon"><LayersIcon /></span>
          <div className="cert-lp-banner-main">
            <div className="cert-lp-banner-title">
              Learning Plan
              <span className="cert-lp-count">
                {plan.length} Certification{plan.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="cert-lp-chips">
              {plan.map((c, i) => (
                <span key={c.id} className="cert-lp-chip">
                  <span className="cert-lp-chip-num">{i + 1}</span>
                  {c.name}
                </span>
              ))}
            </div>
            <div className="cert-lp-banner-sub">
              Completion requires every imported Certification. Manage them to add,
              remove, or reorder.
            </div>
          </div>
          <button className="cert-lp-manage-btn" onClick={() => setImporting(true)}>
            Manage
          </button>
        </div>
      )}

      <div className="cert-tasks-topline">
        <span className="cert-tasks-topline-hint">
          Courses hold Tasks — group with Lessons where it helps.
        </span>
      </div>

      <div className="cert-courses">
        {data.courses.map((course, idx) => (
          <CourseCard
            key={course.id}
            course={course}
            index={idx + 1}
            required={data.courses.length <= 1}
            editing={editingId === course.id}
            editingId={editingId}
            allTasks={allTasks}
            dnd={dnd}
            onUpdateTask={updateTaskById}
            onRemoveTask={removeTaskById}
            onToggle={() => toggleCourse(course.id)}
            onUpdate={(patch) => updateCourse(course.id, patch)}
            onToggleHidden={() => updateCourse(course.id, { hidden: !course.hidden })}
            onOpenEditor={() => setEditingId(course.id)}
            onCancelEditor={() => cancelCourseEditor(course)}
            onSaveEditor={() => setEditingId(null)}
            onRemove={() => removeCourse(course.id)}
            onCreateTask={(taskType) => onCreateTask(course.id, undefined, taskType)}
            onAddExistingTask={() => onAddExisting(course.id, undefined)}
            onAddLesson={() => addLesson(course.id)}
            onCreateTaskInLesson={(lessonId, taskType) => onCreateTask(course.id, lessonId, taskType)}
            onAddExistingTaskInLesson={(lessonId) => onAddExisting(course.id, lessonId)}
            onUpdateLesson={(lessonId, patch) => updateLesson(course.id, lessonId, patch)}
            onToggleLesson={(lessonId) => toggleLesson(course.id, lessonId)}
            onToggleLessonHidden={(lessonId) =>
              mapLesson(course.id, lessonId, (l) => ({ ...l, hidden: !l.hidden }))
            }
            onOpenLessonEditor={(lessonId) => setEditingId(lessonId)}
            onCancelLessonEditor={(lesson) => cancelLessonEditor(course.id, lesson)}
            onSaveLessonEditor={() => setEditingId(null)}
            onRemoveLesson={(lessonId) => removeLesson(course.id, lessonId)}
          />
        ))}

        <button className="cert-add-course" onClick={addCourse}>
          <span className="add-card-icon"><PlusLgIcon /></span>
          <span className="add-card-label">Add Course</span>
        </button>
      </div>

      {importing && (
        <ImportCertsModal
          initial={plan}
          onCancel={() => setImporting(false)}
          onConfirm={applyImport}
        />
      )}
    </>
  );
}

// Shared inline name + description editor for a Course or Lesson. Opened by the
// pencil (or on creating a node); bilingual EN/ES, name required to save.
function NodeEditor({
  title,
  hint,
  nameEn,
  nameEs,
  descEn,
  descEs,
  namePlaceholder,
  onChange,
  onCancel,
  onSave,
}: {
  title: string;
  hint: string;
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  namePlaceholder: string;
  onChange: (patch: { nameEn?: string; nameEs?: string; descEn?: string; descEs?: string }) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const canSave = nameEn.trim().length > 0;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault();
      if (canSave) onSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };
  return (
    <div className="cert-editor" onClick={(e) => e.stopPropagation()}>
      <div className="cert-editor-head">
        <span className="cert-editor-eyebrow">{title}</span>
        <span className="cert-editor-hint">{hint}</span>
      </div>
      <div className="cert-editor-grid">
        <div className="cert-editor-col">
          <span className="cert-editor-lang">ENGLISH</span>
          <input
            className="cert-editor-input"
            autoFocus
            value={nameEn}
            placeholder={namePlaceholder}
            onChange={(e) => onChange({ nameEn: e.target.value })}
            onKeyDown={onKey}
          />
          <textarea
            className="cert-editor-text"
            rows={3}
            value={descEn}
            placeholder="Description — rich text"
            onChange={(e) => onChange({ descEn: e.target.value })}
            onKeyDown={onKey}
          />
        </div>
        <div className="cert-editor-col">
          <span className="cert-editor-lang">ESPAÑOL</span>
          <input
            className="cert-editor-input"
            value={nameEs}
            placeholder="Nombre"
            onChange={(e) => onChange({ nameEs: e.target.value })}
            onKeyDown={onKey}
          />
          <textarea
            className="cert-editor-text"
            rows={3}
            value={descEs}
            placeholder="Descripción"
            onChange={(e) => onChange({ descEs: e.target.value })}
            onKeyDown={onKey}
          />
        </div>
      </div>
      <div className="cert-editor-foot">
        <span className="cert-editor-kbd">↵ saves · esc cancels</span>
        <span className="cert-editor-spacer" />
        <button className="cert-editor-cancel" onClick={onCancel}>Cancel</button>
        <button className="cert-editor-save" disabled={!canSave} onClick={onSave}>Save</button>
      </div>
    </div>
  );
}

// The ⋮ kebab shared by Course, Lesson and Task rows. Everything the Figma
// header dropped — hide/show, collapse, delete, and the per-Task Final Exam and
// Access Restriction toggles — lives behind it.
function NodeMenu({
  label,
  direction = "down",
  children,
}: {
  label: string;
  direction?: "up" | "down";
  children: (args: { close: () => void }) => React.ReactNode;
}) {
  return (
    <Dropdown
      width={232}
      align="right"
      direction={direction}
      trigger={({ toggle }) => (
        <button
          className="cert-hdr-btn"
          aria-label={label}
          title={label}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          <TreeKebabIcon />
        </button>
      )}
    >
      {children}
    </Dropdown>
  );
}

// A Course's children in render order, with runs of consecutive loose Tasks
// (Tasks pinned straight to the Course rather than to a Lesson) collected into
// one 6px-gap list so they don't inherit the 20px gap between Lesson blocks.
type CourseGroup =
  | { kind: "tasks"; key: string; tasks: CertTask[] }
  | { kind: "lesson"; key: string; lesson: CertLesson; num: number };

function groupChildren(children: CourseChild[]): CourseGroup[] {
  const out: CourseGroup[] = [];
  let lessonNum = 0;
  for (const ch of children) {
    if (ch.kind === "task") {
      const last = out[out.length - 1];
      if (last && last.kind === "tasks") last.tasks.push(ch.task);
      else out.push({ kind: "tasks", key: `t-${ch.task.id}`, tasks: [ch.task] });
    } else {
      lessonNum += 1;
      out.push({ kind: "lesson", key: ch.lesson.id, lesson: ch.lesson, num: lessonNum });
    }
  }
  return out;
}

function CourseCard({
  course,
  index,
  required,
  editing,
  editingId,
  allTasks,
  dnd,
  onUpdateTask,
  onRemoveTask,
  onToggle,
  onUpdate,
  onToggleHidden,
  onOpenEditor,
  onCancelEditor,
  onSaveEditor,
  onRemove,
  onCreateTask,
  onAddExistingTask,
  onAddLesson,
  onCreateTaskInLesson,
  onAddExistingTaskInLesson,
  onUpdateLesson,
  onToggleLesson,
  onToggleLessonHidden,
  onOpenLessonEditor,
  onCancelLessonEditor,
  onSaveLessonEditor,
  onRemoveLesson,
}: {
  course: CertCourse;
  index: number;
  required: boolean;
  editing: boolean;
  editingId: string | null;
  allTasks: CertTask[];
  dnd: (scope: string, id: string) => DndProps;
  onUpdateTask: (taskId: string, patch: Partial<CertTask>) => void;
  onRemoveTask: (taskId: string) => void;
  onToggle: () => void;
  onUpdate: (patch: Partial<CertCourse>) => void;
  onToggleHidden: () => void;
  onOpenEditor: () => void;
  onCancelEditor: () => void;
  onSaveEditor: () => void;
  onRemove: () => void;
  onCreateTask: (taskType: TaskTypeKey) => void;
  onAddExistingTask: () => void;
  onAddLesson: () => void;
  onCreateTaskInLesson: (lessonId: string, taskType: TaskTypeKey) => void;
  onAddExistingTaskInLesson: (lessonId: string) => void;
  onUpdateLesson: (lessonId: string, patch: Partial<CertLesson>) => void;
  onToggleLesson: (lessonId: string) => void;
  onToggleLessonHidden: (lessonId: string) => void;
  onOpenLessonEditor: (lessonId: string) => void;
  onCancelLessonEditor: (lesson: CertLesson) => void;
  onSaveLessonEditor: () => void;
  onRemoveLesson: (lessonId: string) => void;
}) {
  const esMiss = !course.nameEs.trim();
  const selfDnd = dnd("courses", course.id);
  const childScope = `course:${course.id}`;
  const groups = groupChildren(course.children);
  return (
    <div className={`cert-course ${course.expanded ? "expanded" : ""} ${course.hidden ? "hidden" : ""}`}>
      <div className="cert-course-header" onClick={onToggle} {...selfDnd.target}>
        <DragDots {...selfDnd.handle} />
        <div className="cert-course-titles">
          <div className="cert-course-eyebrow">Course {index}</div>
          <div className="cert-course-name-row">
            <span className="cert-course-name">{course.nameEn || "Untitled Course"}</span>
            {esMiss && <span className="cert-es-chip" title="Spanish name missing">ES</span>}
            {course.sourceCertName && (
              <span className="cert-source-pill"><LayersIcon />Imported</span>
            )}
            {course.hidden && <span className="cert-hidden-pill">Hidden</span>}
          </div>
          {course.descEn && <div className="cert-course-desc">{course.descEn}</div>}
        </div>
        <div className="cert-hdr-acts" onClick={(e) => e.stopPropagation()}>
          <NodeMenu label="Course actions">
            {({ close }) => (
              <div className="menu">
                <button className="menu-item" onClick={() => { onOpenEditor(); close(); }}>
                  <span className="menu-item-icon"><PencilIcon /></span>
                  Edit Course
                </button>
                <button className="menu-item" onClick={() => { onToggle(); close(); }}>
                  <span className={`menu-item-icon ${course.expanded ? "is-open" : ""}`}><CaretIcon /></span>
                  {course.expanded ? "Collapse Course" : "Expand Course"}
                </button>
                <button className="menu-item" onClick={() => { onToggleHidden(); close(); }}>
                  <span className="menu-item-icon">{course.hidden ? <EyeOffIcon /> : <EyeIcon />}</span>
                  {course.hidden ? "Show Course" : "Hide Course"}
                </button>
                <div className="menu-divider" />
                <button
                  className="menu-item danger"
                  disabled={required}
                  title={required ? "At least one Course is required" : undefined}
                  onClick={() => { onRemove(); close(); }}
                >
                  <span className="menu-item-icon"><TrashIcon /></span>
                  Delete Course
                </button>
                {required && (
                  <div className="menu-note">Every Certification needs at least one Course.</div>
                )}
              </div>
            )}
          </NodeMenu>
        </div>
      </div>

      {editing && (
        <NodeEditor
          title={course.nameEn.trim() ? "Edit course" : "New course"}
          hint="every certification needs at least one course · name + description, EN/ES"
          nameEn={course.nameEn}
          nameEs={course.nameEs}
          descEn={course.descEn}
          descEs={course.descEs}
          namePlaceholder="Course name (required)"
          onChange={onUpdate}
          onCancel={onCancelEditor}
          onSave={onSaveEditor}
        />
      )}

      {course.expanded && (
        <div className="cert-course-body">
          {course.children.length === 0 && !editing && (
            <div className="cert-course-empty">No Tasks yet — add a Task or a Lesson to get started.</div>
          )}

          {groups.map((g) =>
            g.kind === "tasks" ? (
              <div className="cert-task-list" key={g.key}>
                {g.tasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    allTasks={allTasks}
                    dndRow={dnd(childScope, t.id)}
                    onUpdate={(patch) => onUpdateTask(t.id, patch)}
                    onRemove={() => onRemoveTask(t.id)}
                  />
                ))}
              </div>
            ) : (
              <LessonCard
                key={g.key}
                lesson={g.lesson}
                courseIndex={index}
                num={g.num}
                editing={editingId === g.lesson.id}
                allTasks={allTasks}
                dnd={dnd}
                dndRow={dnd(childScope, g.lesson.id)}
                onUpdateTask={onUpdateTask}
                onRemoveTask={onRemoveTask}
                onToggle={() => onToggleLesson(g.lesson.id)}
                onUpdate={(patch) => onUpdateLesson(g.lesson.id, patch)}
                onToggleHidden={() => onToggleLessonHidden(g.lesson.id)}
                onOpenEditor={() => onOpenLessonEditor(g.lesson.id)}
                onCancelEditor={() => onCancelLessonEditor(g.lesson)}
                onSaveEditor={onSaveLessonEditor}
                onRemove={() => onRemoveLesson(g.lesson.id)}
                onCreateTask={(taskType) => onCreateTaskInLesson(g.lesson.id, taskType)}
                onAddExistingTask={() => onAddExistingTaskInLesson(g.lesson.id)}
              />
            ),
          )}

          <div className="cert-course-foot">
            <button className="add-card add-card--tree" onClick={onAddLesson}>
              <span className="add-card-icon"><PlusLgIcon /></span>
              <span className="add-card-label">Add Lesson</span>
            </button>
            <AddTaskMenu
              label="Add Task"
              onCreateNew={onCreateTask}
              onAddExisting={onAddExistingTask}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// A Lesson inside a Course. Its header is the Figma "Page Break": a stub rule,
// the name + description, a mono "· LESSON 1.1 · 3 TASKS" tag, then a hairline
// running to the card edge. Edit / hide / delete fade in at the far right.
function LessonCard({
  lesson,
  courseIndex,
  num,
  editing,
  allTasks,
  dnd,
  dndRow,
  onUpdateTask,
  onRemoveTask,
  onToggle,
  onUpdate,
  onToggleHidden,
  onOpenEditor,
  onCancelEditor,
  onSaveEditor,
  onRemove,
  onCreateTask,
  onAddExistingTask,
}: {
  lesson: CertLesson;
  courseIndex: number;
  num: number;
  editing: boolean;
  allTasks: CertTask[];
  dnd: (scope: string, id: string) => DndProps;
  dndRow: DndProps;
  onUpdateTask: (taskId: string, patch: Partial<CertTask>) => void;
  onRemoveTask: (taskId: string) => void;
  onToggle: () => void;
  onUpdate: (patch: Partial<CertLesson>) => void;
  onToggleHidden: () => void;
  onOpenEditor: () => void;
  onCancelEditor: () => void;
  onSaveEditor: () => void;
  onRemove: () => void;
  onCreateTask: (taskType: TaskTypeKey) => void;
  onAddExistingTask: () => void;
}) {
  const esMiss = !lesson.nameEs.trim();
  const taskScope = `lesson:${lesson.id}`;
  return (
    <div className={`cert-lesson ${lesson.expanded ? "expanded" : ""} ${lesson.hidden ? "hidden" : ""}`}>
      <div className="cert-lesson-head" onClick={onToggle} {...dndRow.target}>
        <DragDots className="cert-grip--gutter" {...dndRow.handle} />
        <span className="cert-lesson-stub" />
        <div className="cert-lesson-title">
          <div className="cert-lesson-titles">
            <div className="cert-lesson-name-row">
              <span className="cert-lesson-name">{lesson.nameEn || "Untitled Lesson"}</span>
              {esMiss && <span className="cert-es-chip" title="Spanish name missing">ES</span>}
              {lesson.hidden && <span className="cert-hidden-pill">Hidden</span>}
            </div>
            {lesson.descEn && <div className="cert-lesson-desc">{lesson.descEn}</div>}
          </div>
          <span className="cert-lesson-eyebrow">{`· Lesson ${courseIndex}.${num}`}</span>
        </div>
        <span className="cert-lesson-rule" />
        <div className="cert-lesson-acts" onClick={(e) => e.stopPropagation()}>
          <NodeMenu label="Lesson actions">
            {({ close }) => (
              <div className="menu">
                <button className="menu-item" onClick={() => { onOpenEditor(); close(); }}>
                  <span className="menu-item-icon"><PencilIcon /></span>
                  Edit Lesson
                </button>
                <button className="menu-item" onClick={() => { onToggle(); close(); }}>
                  <span className={`menu-item-icon ${lesson.expanded ? "is-open" : ""}`}><CaretIcon /></span>
                  {lesson.expanded ? "Collapse Lesson" : "Expand Lesson"}
                </button>
                <button className="menu-item" onClick={() => { onToggleHidden(); close(); }}>
                  <span className="menu-item-icon">{lesson.hidden ? <EyeOffIcon /> : <EyeIcon />}</span>
                  {lesson.hidden ? "Show Lesson" : "Hide Lesson"}
                </button>
                <div className="menu-divider" />
                <button className="menu-item danger" onClick={() => { onRemove(); close(); }}>
                  <span className="menu-item-icon"><TrashIcon /></span>
                  Delete Lesson
                </button>
              </div>
            )}
          </NodeMenu>
        </div>
      </div>

      {editing && (
        <NodeEditor
          title={lesson.nameEn.trim() ? "Edit lesson" : "New lesson"}
          hint="groups the tasks that follow · name + description, EN/ES"
          nameEn={lesson.nameEn}
          nameEs={lesson.nameEs}
          descEn={lesson.descEn}
          descEs={lesson.descEs}
          namePlaceholder="Lesson name (required)"
          onChange={onUpdate}
          onCancel={onCancelEditor}
          onSave={onSaveEditor}
        />
      )}

      {lesson.expanded && (
        <div className="cert-lesson-tasks">
          {lesson.tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              allTasks={allTasks}
              dndRow={dnd(taskScope, t.id)}
              onUpdate={(patch) => onUpdateTask(t.id, patch)}
              onRemove={() => onRemoveTask(t.id)}
            />
          ))}
          <LessonAddRow
            tag={`Add to Lesson ${courseIndex}.${num}`}
            onCreateNew={onCreateTask}
            onAddExisting={onAddExistingTask}
          />
        </div>
      )}
    </div>
  );
}

// The add row that closes a Lesson's task list (Figma "Course Card" 513:2586).
// A page break split by two accent actions — "New Task" opens the type picker,
// "Existing Task" opens the library — with the destination Lesson named in mono
// at the far right, so the row says where the Task will land.
function LessonAddRow({
  tag,
  onCreateNew,
  onAddExisting,
}: {
  tag: string;
  onCreateNew: (t: TaskTypeKey) => void;
  onAddExisting: () => void;
}) {
  return (
    <div className="cert-addrow">
      <span className="cert-addrow-rule" />
      <div className="cert-addrow-acts">
        <Dropdown
          width={260}
          direction="up"
          trigger={({ toggle }) => (
            <button className="cert-addrow-btn" onClick={toggle}>
              <span className="cert-addrow-icon"><PlusThinIcon /></span>
              New Task
            </button>
          )}
        >
          {({ close }) => (
            <div className="menu">
              {TASK_TYPE_OPTIONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  className="menu-item"
                  onClick={() => { onCreateNew(key); close(); }}
                >
                  <span className="menu-item-icon"><Icon /></span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </Dropdown>
        <span className="cert-addrow-sep" />
        <button className="cert-addrow-btn" onClick={onAddExisting}>
          <span className="cert-addrow-icon"><SearchIcon /></span>
          Existing Task
        </button>
      </div>
      <span className="cert-addrow-rule" />
      <span className="cert-addrow-tag">{tag}</span>
    </div>
  );
}

// A Task card on the cert tree: type glyph, name, and the mono "·xAPI" suffix.
// The Final Exam flag and the Access Restriction editor live in the row's kebab.
// A Task whose restriction is configured wears the gate banner above the card
// (Figma "Access Restriction Task" 356:1934), which names its prerequisites.
function TaskRow({
  task,
  allTasks,
  dndRow,
  onUpdate,
  onRemove,
}: {
  task: CertTask;
  allTasks: CertTask[];
  dndRow: DndProps;
  onUpdate: (patch: Partial<CertTask>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const restricted = !!task.restriction?.enabled;
  const finalExam = !!task.finalExam;
  const Glyph = KIND_GLYPH[task.kind];

  // The prerequisites the gate names, resolved to live Task names — a
  // prerequisite that was since deleted simply drops out of the sentence.
  const prereqs = restricted
    ? (task.restriction?.taskIds ?? [])
        .map((id) => allTasks.find((t) => t.id === id)?.name)
        .filter((n): n is string => !!n)
    : [];
  const mode = task.restriction?.mode ?? "all";
  // "A and B are completed" vs. the single-prerequisite / any-of "is completed".
  const verb = mode === "all" && prereqs.length > 1 ? "are completed" : "is completed";

  return (
    <>
      <div className={`cert-task-wrap ${prereqs.length > 0 ? "has-gate" : ""}`}>
      {prereqs.length > 0 && (
        <div className="cert-task-gate">
          <span className="cert-task-gate-icon"><RestrictionLockIcon /></span>
          <p className="cert-task-gate-text">
            Not Available Unless:{" "}
            {prereqs.map((name, i) => (
              <Fragment key={i}>
                {i > 0 && (mode === "all" ? ", " : " or ")}
                <strong>{name}</strong>
              </Fragment>
            ))}{" "}
            {verb}
          </p>
        </div>
      )}
      <div className="cert-task" {...dndRow.target}>
        <DragDots className="cert-grip--gutter" {...dndRow.handle} />
        <span className="cert-task-icon" title={KIND_MONO[task.kind]}><Glyph /></span>
        <span className="cert-task-name">{task.name}</span>
        {finalExam &&<span className="cert-final-pill"><FlagIcon />Final Exam</span>}
        {/* Restriction switched on but no prerequisite picked yet — the gate has
            nothing to name, so flag the half-configured state instead. */}
        {restricted && prereqs.length === 0 && (
          <span className="cert-restricted-pill">Restricted</span>
        )}
        <span className="cert-task-spacer" />
        <NodeMenu label="Task actions">
          {({ close }) => (
            <div className="menu">
              <button className="menu-item" onClick={() => { onUpdate({ finalExam: !finalExam }); close(); }}>
                <span className={`menu-item-icon ${finalExam ? "is-on" : ""}`}><FlagIcon /></span>
                {finalExam ? "Unmark as Final Exam" : "Mark as Final Exam"}
              </button>
              <button className="menu-item" onClick={() => { setOpen((o) => !o); close(); }}>
                <span className={`menu-item-icon ${restricted ? "is-on" : ""}`}><LockIcon /></span>
                {open ? "Hide access restrictions" : "Access restrictions"}
              </button>
              <div className="menu-divider" />
              <button className="menu-item danger" onClick={() => { onRemove(); close(); }}>
                <span className="menu-item-icon"><TrashIcon /></span>
                Remove from Course
              </button>
            </div>
          )}
        </NodeMenu>
      </div>
      </div>
      {open && (
        <AccessRestrictionEditor task={task} allTasks={allTasks} onUpdate={onUpdate} />
      )}
    </>
  );
}

function AccessRestrictionEditor({
  task,
  allTasks,
  onUpdate,
}: {
  task: CertTask;
  allTasks: CertTask[];
  onUpdate: (patch: Partial<CertTask>) => void;
}) {
  const r = task.restriction ?? { enabled: false, mode: "all" as const, taskIds: [] };
  // Eligible prerequisites: every other Task in the same Certification.
  const options = allTasks.filter((t) => t.id !== task.id);
  const selectedCount = r.taskIds.filter((id) => options.some((o) => o.id === id)).length;

  const setR = (patch: Partial<AccessRestriction>) => onUpdate({ restriction: { ...r, ...patch } });
  const togglePrereq = (id: string) =>
    setR({ taskIds: r.taskIds.includes(id) ? r.taskIds.filter((x) => x !== id) : [...r.taskIds, id] });

  return (
    <div className="cert-restrict-edit">
      <div className="cert-restrict-head">
        <button
          className={`toggle ${r.enabled ? "on" : ""}`}
          onClick={() => setR({ enabled: !r.enabled })}
          aria-pressed={r.enabled}
        >
          <span className="toggle-knob" />
        </button>
        <div className="cert-restrict-head-text">
          <div className="cert-restrict-title">Access restriction</div>
          <div className="cert-restrict-desc">
            Block learners from starting this Task until they satisfy other Tasks in this Certification.
          </div>
        </div>
      </div>

      {r.enabled &&
        (options.length === 0 ? (
          <div className="cert-restrict-empty">
            No other Tasks in this Certification yet. Add more Tasks to set prerequisites.
          </div>
        ) : (
          <>
            <div className="cert-restrict-mode">
              <span className="cert-restrict-mode-label">Learner must complete</span>
              <div className="seg-control">
                <button
                  type="button"
                  className={`seg-btn ${r.mode === "all" ? "active" : ""}`}
                  onClick={() => setR({ mode: "all" })}
                >
                  All of
                </button>
                <button
                  type="button"
                  className={`seg-btn ${r.mode === "any" ? "active" : ""}`}
                  onClick={() => setR({ mode: "any" })}
                >
                  Any one of
                </button>
              </div>
              <span className="cert-restrict-mode-label">the selected Tasks</span>
            </div>

            <div className="cert-restrict-pick">
              {options.map((o) => {
                const checked = r.taskIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`cert-restrict-option ${checked ? "checked" : ""}`}
                    onClick={() => togglePrereq(o.id)}
                  >
                    <span className="cert-restrict-check">{checked && <CheckBoldIcon />}</span>
                    <TaskKindBadge kind={o.kind} />
                    <span className="cert-restrict-option-name">{o.name}</span>
                    <span className="cert-restrict-status">{satisfyingStatus(o.kind)}</span>
                  </button>
                );
              })}
            </div>

            {selectedCount === 0 && (
              <div className="cert-restrict-warn">Select at least one prerequisite Task.</div>
            )}

            <p className="cert-restrict-note">
              A prerequisite is satisfied when it reaches the status shown beside it —{" "}
              <strong>Completed</strong> for every Task type.
            </p>
          </>
        ))}
    </div>
  );
}

// "+ Add Task" entry point. Opens a menu with two paths: add existing Tasks from
// the library (opens the full-table picker — search, filters, preview, multi-
// select), or create a new Task (pick a type → opens the split-screen Task
// creation UI).
function AddTaskMenu({
  label,
  onCreateNew,
  onAddExisting,
}: {
  label: string;
  onCreateNew: (t: TaskTypeKey) => void;
  onAddExisting: () => void;
}) {
  return (
    <Dropdown
      width={300}
      direction="up"
      trigger={({ toggle }) => (
        <button className="add-card add-card--tree" onClick={toggle}>
          <span className="add-card-icon"><PlusLgIcon /></span>
          <span className="add-card-label">{label}</span>
        </button>
      )}
    >
      {({ close }) => (
        <AddTaskMenuContent
          onCreateNew={(t) => { onCreateNew(t); close(); }}
          onAddExisting={() => { onAddExisting(); close(); }}
        />
      )}
    </Dropdown>
  );
}

function AddTaskMenuContent({
  onCreateNew,
  onAddExisting,
}: {
  onCreateNew: (t: TaskTypeKey) => void;
  onAddExisting: () => void;
}) {
  const [mode, setMode] = useState<"root" | "create">("root");

  if (mode === "root") {
    return (
      <div className="menu">
        <button className="menu-item" onClick={onAddExisting}>
          <span className="menu-item-icon"><SearchIcon /></span>
          Add Existing Tasks
        </button>
        <button className="menu-item" onClick={() => setMode("create")}>
          <span className="menu-item-icon"><AddIcon /></span>
          Create New Task
        </button>
      </div>
    );
  }

  return (
    <div className="menu">
      <button className="menu-back" onClick={() => setMode("root")}>‹ Choose a Task type</button>
      {TASK_TYPE_OPTIONS.map(({ key, label: optLabel, icon: Icon }) => (
        <button key={key} className="menu-item" onClick={() => onCreateNew(key)}>
          <span className="menu-item-icon"><Icon /></span>
          {optLabel}
        </button>
      ))}
    </div>
  );
}

// "Import Other Certifications" — the Learning Plan picker. Left column searches
// the Certification library; the right column holds the chosen Certifications in
// the order learners progress through them, with reorder + remove controls. On
// confirm, the parent copies each one's structure in and builds the completion set.
function ImportCertsModal({
  initial,
  onCancel,
  onConfirm,
}: {
  initial: { id: string; name: string }[];
  onCancel: () => void;
  onConfirm: (certs: Certification[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Certification[]>(() =>
    initial
      .map((s) => certifications.find((c) => c.id === s.id))
      .filter((c): c is Certification => !!c),
  );

  const selectedIds = new Set(selected.map((c) => c.id));
  const q = query.trim().toLowerCase();
  const results = certifications.filter(
    (c) =>
      !selectedIds.has(c.id) &&
      (!q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q)),
  );

  const add = (c: Certification) => setSelected((s) => [...s, c]);
  const remove = (id: string) => setSelected((s) => s.filter((c) => c.id !== id));
  const move = (idx: number, dir: -1 | 1) =>
    setSelected((s) => {
      const j = idx + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  return (
    <div className="cl-modal-overlay" onClick={onCancel}>
      <div className="cl-modal lp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cl-modal-head">
          <div className="cl-modal-eyebrow lp-eyebrow"><LayersIcon /> Learning Plan</div>
          <h3 className="cl-modal-title">Import Other Certifications</h3>
          <p className="cl-modal-sub">
            Pick the Certifications to merge in. Their Courses, Lessons, and Tasks are copied
            in (Tasks are reused, not duplicated), and completion will require every one you add.
            Order sets how they appear to learners.
          </p>
        </div>

        <div className="lp-modal-body">
          <div className="lp-col">
            <div className="lp-col-head">Add a Certification</div>
            <div className="cl-modal-search lp-search">
              <span className="search-icon"><SearchIcon /></span>
              <input
                autoFocus
                className="cl-modal-input"
                placeholder="Search Certifications…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="lp-pick-list">
              {results.length === 0 ? (
                <div className="cl-modal-empty">
                  {selected.length > 0 && !q
                    ? "Every Certification is already in the plan."
                    : "No Certifications match."}
                </div>
              ) : (
                results.map((c) => (
                  <button key={c.id} className="lp-pick-item" onClick={() => add(c)}>
                    <span className="task-kind-badge cert">C</span>
                    <span className="lp-pick-text">
                      <span className="lp-pick-name">{c.name}</span>
                      <span className="lp-pick-meta">{c.id} · {c.industry} · {c.tasks} Tasks</span>
                    </span>
                    <span className="lp-pick-add"><AddIcon /></span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lp-col">
            <div className="lp-col-head">
              In this plan
              <span className="lp-col-count">{selected.length}</span>
            </div>
            {selected.length === 0 ? (
              <div className="lp-sel-empty">
                No Certifications yet. Add them from the left — they'll stack here in the
                order learners move through them.
              </div>
            ) : (
              <div className="lp-sel-list">
                {selected.map((c, idx) => (
                  <div key={c.id} className="lp-sel-item">
                    <span className="lp-sel-order">{idx + 1}</span>
                    <span className="lp-sel-text">
                      <span className="lp-pick-name">{c.name}</span>
                      <span className="lp-pick-meta">{c.id} · {c.tasks} Tasks</span>
                    </span>
                    <div className="lp-sel-btns">
                      <button
                        className="lp-sel-move"
                        disabled={idx === 0}
                        onClick={() => move(idx, -1)}
                        aria-label={`Move ${c.name} up`}
                      >
                        ↑
                      </button>
                      <button
                        className="lp-sel-move"
                        disabled={idx === selected.length - 1}
                        onClick={() => move(idx, 1)}
                        aria-label={`Move ${c.name} down`}
                      >
                        ↓
                      </button>
                      <button
                        className="lp-sel-remove"
                        onClick={() => remove(c.id)}
                        aria-label={`Remove ${c.name}`}
                      >
                        <SmallXIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="cl-modal-foot lp-foot">
          <span className="lp-foot-note">
            {selected.length === 0
              ? "Add at least one Certification to build the Learning Plan."
              : `Completion will require all ${selected.length} Certification${selected.length > 1 ? "s" : ""}.`}
          </span>
          <div className="lp-foot-actions">
            <button className="btn-save-draft" onClick={onCancel}>Cancel</button>
            <button
              className="btn-publish"
              disabled={selected.length === 0 && initial.length === 0}
              onClick={() => onConfirm(selected)}
            >
              {initial.length > 0
                ? "Update Learning Plan"
                : `Import ${selected.length} Certification${selected.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────  Step 4: Completion  ───────────────── */

// Temporary GUI cap (spec 7.3.7.1) — V1 needs at most 2 Condition Sets; more
// can be enabled later.
const MAX_CONDITION_SETS = 3;

function CompletionStep({
  data,
  update,
  criteriaLocked = false,
  onUnlockCriteria,
  missing = false,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  criteriaLocked?: boolean;
  onUnlockCriteria?: () => void;
  /** Flagged by a publish attempt with no completable Condition Set. */
  missing?: boolean;
}) {
  const sets = data.conditionSets;
  const atCap = sets.length >= MAX_CONDITION_SETS;

  function addConditionSet() {
    if (atCap) return;
    update({ conditionSets: [...sets, { id: `cs-${Date.now()}`, items: [] }] });
  }

  function removeConditionSet(id: string) {
    update({ conditionSets: sets.filter((s) => s.id !== id) });
  }

  function addItem(setId: string, item: CompletionItem) {
    update({
      conditionSets: sets.map((s) =>
        s.id === setId ? { ...s, items: [...s.items, item] } : s,
      ),
    });
  }

  function removeItem(setId: string, itemId: string) {
    update({
      conditionSets: sets.map((s) =>
        s.id === setId ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s,
      ),
    });
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Completion criteria <span className="req">*</span>
        </label>
        <CompletionCriteriaGate locked={criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
          {sets.length === 0 ? (
            <div className={`cert-empty-hint${missing ? " has-error" : ""}`}>
              No Condition Sets yet. Add one to define how this Certification is completed — most
              Certifications have a single set with one item (the final exam).
            </div>
          ) : (
            <div className="cond-sets">
              {sets.map((set, idx) => (
                <div key={set.id}>
                  {idx > 0 && (
                    <div className="cond-or-divider"><span>OR</span></div>
                  )}
                  <ConditionSetCard
                    set={set}
                    index={idx + 1}
                    onRemove={() => removeConditionSet(set.id)}
                    onAddItem={(item) => addItem(set.id, item)}
                    onRemoveItem={(itemId) => removeItem(set.id, itemId)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="cond-add-set-row">
            <button className="cert-add-course inline" onClick={addConditionSet} disabled={atCap}>
              + Add Condition Set
            </button>
            {atCap && (
              <span className="cond-cap-note">
                Up to {MAX_CONDITION_SETS} Condition Sets (temporary limit).
              </span>
            )}
          </div>
        </CompletionCriteriaGate>

        {missing && (
          <p className="form-error-text">
            Add at least one Condition Set with an item to publish.
          </p>
        )}

        <p className="form-help cond-intro">
          The Certification is complete when a learner satisfies <strong>any one</strong> Condition
          Set in full. Within a Condition Set, <strong>all</strong> items must be completed.
        </p>
        <p className="form-help">
          Any change to completion criteria resets completion data for all enrolled users. Awards already issued are not revoked.
        </p>
      </div>
    </>
  );
}

// Completion criteria gate — mirrors the Task wizard's behaviour and design.
// When editing an existing Certification the criteria start locked; unlocking
// requires acknowledging that completion data is reset for enrolled learners.
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
                  Completion settings are locked to protect enrolled learners' progress. Editing
                  them resets completion for this Certification.
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
                <div className="step-lock-title">This will reset completion for enrolled learners</div>
                <p className="step-lock-text">
                  Editing the completion criteria <strong>resets completion data for every learner</strong>{" "}
                  enrolled in this Certification, then recomputes it under the new criteria. Awards
                  already issued are not revoked. This can't be undone.
                </p>
                <div className="step-lock-actions">
                  <button className="step-lock-btn" onClick={() => setShowWarning(false)}>
                    Cancel
                  </button>
                  <button className="step-lock-btn danger" onClick={onUnlock}>
                    Reset completions &amp; edit
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

function CompletionItemBadge({ item }: { item: CompletionItem }) {
  if (item.kind === "task") return <TaskKindBadge kind={item.taskKind} />;
  if (item.kind === "quiz-section") return <span className="task-kind-badge quiz">QS</span>;
  return <span className="task-kind-badge cert">C</span>;
}

function ConditionSetCard({
  set,
  index,
  onRemove,
  onAddItem,
  onRemoveItem,
}: {
  set: ConditionSet;
  index: number;
  onRemove: () => void;
  onAddItem: (item: CompletionItem) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  return (
    <div className="cond-card">
      <div className="cond-header">
        <span className="cond-num">{index}</span>
        <span className="cond-title">Condition Set {index}</span>
        <button className="cond-remove" onClick={onRemove} aria-label="Remove Condition Set">
          <SmallXIcon />
        </button>
      </div>

      <div className="cond-and-note">
        Learner must complete <strong>all</strong> of these items:
      </div>

      <div className="cond-list">
        {set.items.length === 0 ? (
          <div className="cond-empty">No items yet — add a Task or Certification below.</div>
        ) : (
          set.items.map((item) => (
            <div key={item.id} className="cond-row">
              <CompletionItemBadge item={item} />
              <span className="cond-row-name">{item.name}</span>
              {item.kind === "quiz-section" && (
                <span className="cond-row-rule">· Quiz-Section in {item.quizName}</span>
              )}
              {item.kind === "cert" && <span className="cond-row-rule">· Certification</span>}
              <button
                className="cond-row-x"
                onClick={() => onRemoveItem(item.id)}
                aria-label={`Remove ${item.name}`}
              >
                <SmallXIcon />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="cond-set-foot">
        <Dropdown
          width={340}
          trigger={({ toggle }) => (
            <button className="cond-add" onClick={toggle}>+ Add item</button>
          )}
        >
          {({ close }) => (
            <ConditionItemPicker
              onPick={(item) => { onAddItem(item); close(); }}
            />
          )}
        </Dropdown>
        <span className="cond-qs-note">
          Quiz-Section conditions (EPA and other rare cases) are configured via the database.
        </span>
      </div>
    </div>
  );
}

// Searchable picker for "+ Add item": switch between Tasks and Certifications,
// search the full library, and click a result to add it to the Condition Set.
function ConditionItemPicker({ onPick }: { onPick: (item: CompletionItem) => void }) {
  const [tab, setTab] = useState<"task" | "cert">("task");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const taskResults = useMemo(
    () =>
      taskLibrary.filter(
        (t) => !q || t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q),
      ),
    [q],
  );
  const certResults = useMemo(
    () =>
      certifications.filter(
        (c) => !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
      ),
    [q],
  );

  return (
    <div className="cond-picker">
      <div className="cond-picker-tabs">
        <button
          className={`cond-picker-tab ${tab === "task" ? "active" : ""}`}
          onClick={() => setTab("task")}
        >
          Tasks
        </button>
        <button
          className={`cond-picker-tab ${tab === "cert" ? "active" : ""}`}
          onClick={() => setTab("cert")}
        >
          Certifications
        </button>
      </div>

      <div className="dropdown-search">
        <span className="dropdown-search-icon"><SearchIcon /></span>
        <input
          autoFocus
          placeholder={tab === "task" ? "Search Tasks…" : "Search Certifications…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="dropdown-list cond-picker-list">
        {tab === "task" ? (
          taskResults.length === 0 ? (
            <div className="cond-picker-empty">No Tasks match your search.</div>
          ) : (
            taskResults.map((t) => (
              <button
                key={t.id}
                className="cond-picker-item"
                onClick={() =>
                  onPick({ kind: "task", id: nodeId("it"), name: t.name, taskKind: TASK_TYPE_TO_KIND[t.type] })
                }
              >
                <TaskKindBadge kind={TASK_TYPE_TO_KIND[t.type]} />
                <span className="cond-picker-item-name">{t.name}</span>
                <span className="cond-picker-item-meta">{t.type}</span>
              </button>
            ))
          )
        ) : certResults.length === 0 ? (
          <div className="cond-picker-empty">No Certifications match your search.</div>
        ) : (
          certResults.map((c) => (
            <button
              key={c.id}
              className="cond-picker-item"
              onClick={() => onPick({ kind: "cert", id: nodeId("it"), name: c.name })}
            >
              <span className="task-kind-badge cert">C</span>
              <span className="cond-picker-item-name">{c.name}</span>
              <span className="cond-picker-item-meta">{c.id}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────  Step 5: Other Settings  ───────────────── */

function SettingsStep({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">Access Type</label>
        <div className="radio-card-group">
            <RadioCard
              selected={data.accessType === "open"}
              onSelect={() => update({ accessType: "open" })}
              title="Open-To-All (free)"
              desc="Free for any user who can see the Certification. Access depends on B2C tier."
            />
            <RadioCard
              selected={data.accessType === "non-consumable"}
              onSelect={() => update({ accessType: "non-consumable" })}
              title="Non-Consumable"
              desc="One-time purchase. Access persists as long as the user is a Subscriber."
            />
            <RadioCard
              selected={data.accessType === "consumable"}
              onSelect={() => update({ accessType: "consumable" })}
              title="Consumable"
              desc="Time-bounded access window. Used for finite-duration enrollments."
            />
          </div>
        </div>

      {data.accessType !== "open" && (
        <div className="form-group">
          <label className="form-label">Price IDs</label>
          <PriceIdFields
            value={data.priceIds}
            onChange={(ids) => update({ priceIds: ids })}
          />
          <p className="form-help">
            Enter the Price ID for each — Google, Apple, Stripe (B2C), and Stripe (B2B).
          </p>
        </div>
      )}

      {/* Repurchase behaviour applies only to Consumable paywalls. */}
      {data.accessType === "consumable" && (
        <div className="form-group">
          <label className="form-label">Progress on Repurchase</label>
          <div className="radio-card-group">
            <RadioCard
              selected={data.consumableProgress === "reset"}
              onSelect={() => update({ consumableProgress: "reset" })}
              title="Reset Progress"
              desc="All Task completions, Quiz attempts, and Quiz-Section completions for Tasks within the Certification are cleared for that user. On repurchase, the user starts fresh."
            />
            <RadioCard
              selected={data.consumableProgress === "preserve"}
              onSelect={() => update({ consumableProgress: "preserve" })}
              title="Preserve Progress"
              desc="Completions and attempts are preserved. On repurchase, the user picks up where they left off."
            />
          </div>
          <p className="form-help">
            Only applies to Consumable Certifications. Reset will be required if and when we are allowed to offer OSHA ourselves.
          </p>
        </div>
      )}

      <ContentTagsSection data={data} update={update} />
    </>
  );
}

/* ─── Content Tags for Visibility ─── */

const TAG_GROUPS: {
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

const InfoIcon = () => (
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
        This Certification is <strong>All-User Content</strong> (SkillCat-owned). The tags below
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
          Industries (on the Details step) are the browse/discovery taxonomy learners actually see.
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

function ContentTagsSection({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  const [showHelp, setShowHelp] = useState(false);

  function addTag(type: ContentTagType, value: string) {
    if (!value) return;
    // Don't add a duplicate of the same type + value.
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
          <InfoIcon />
          {showHelp ? "Hide details" : "How visibility works"}
        </button>
      </div>

      {showHelp && <VisibilityHelpPanel />}

      {TAG_GROUPS.map((group) => {
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
        Tag this Certification to control which Tenants can see it. Trade and
        Partnership values come from the B2B Management fields in Product
        Config, and a Tenant must match every tag type you set (within a type,
        matching any one value is enough). Add as many tags of each type as you
        need.
      </p>

      <div className="cv-scope-note">
        <span className="cv-scope-dot" />
        {scopeNote}
      </div>
    </div>
  );
}

/* ─────────────────  Step 6: Archiving  ───────────────── */

const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

function ArchivingStep({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  return (
    <>
      <div className="form-group">
        <div className="form-warning">
          <span className="form-warning-icon"><WarnIcon /></span>
          <div>
            <strong>Archiving is permanent.</strong> Once archived, this Certification is
            retired from the catalog and can't be un-archived. Enrolled learners keep their
            completion record and are pointed to the replacement Certification(s) below.
          </div>
        </div>
      </div>

      <div className="form-group">
        <div className="toggle-field">
          <span className="form-label">Archive this Certification</span>
          <div className="toggle-switch-row">
            <button
              className={`toggle ${data.archived ? "on" : ""}`}
              onClick={() => update({ archived: !data.archived })}
              aria-pressed={data.archived}
            >
              <span className="toggle-knob" />
            </button>
            <span className="toggle-state">{data.archived ? "Yes" : "No"}</span>
          </div>
          <p className="toggle-sub">
            Retires the Certification and removes it from the catalog. This action is
            permanent and cannot be undone.
          </p>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Replacement Certifications</label>
        <div className="replace-list">
            {data.replacementCerts.map((c) => (
              <div key={c.id} className="replace-row">
                <span className="task-kind-badge cert">C</span>
                <span className="cond-row-name">{c.name}</span>
                <button
                  className="cond-row-x"
                  onClick={() =>
                    update({
                      replacementCerts: data.replacementCerts.filter((x) => x.id !== c.id),
                    })
                  }
                >
                  <SmallXIcon />
                </button>
              </div>
            ))}
            <Dropdown
              width={340}
              trigger={({ toggle }) => (
                <button className="cond-add" onClick={toggle}>+ Add replacement Certification</button>
              )}
            >
              {({ close }) => (
                <ReplacementCertPicker
                  exclude={data.replacementCerts.map((c) => c.id)}
                  onPick={(cert) => {
                    update({
                      replacementCerts: [
                        ...data.replacementCerts,
                        { id: cert.id, name: cert.name },
                      ],
                    });
                    close();
                  }}
                />
              )}
            </Dropdown>
          </div>
        <p className="form-help">When this Cert is archived, learners are pointed to the replacement(s) in their Path.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Replacement Alert</label>
        <RichTextField
          en={data.replaceAlertEn}
          es={data.replaceAlertEs}
          onChangeEn={(v) => update({ replaceAlertEn: v })}
          onChangeEs={(v) => update({ replaceAlertEs: v })}
        />
        <p className="form-help">
          Shown to enrolled learners only when this Cert is archived. Different from the general Announcement.
        </p>
      </div>
    </>
  );
}

// Searchable Certification picker for the Archiving step's replacement list.
// Certifications already chosen as replacements are filtered out.
function ReplacementCertPicker({
  exclude,
  onPick,
}: {
  exclude: string[];
  onPick: (cert: Certification) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const excluded = new Set(exclude);
  const results = useMemo(
    () =>
      certifications.filter(
        (c) =>
          !excluded.has(c.id) &&
          (!q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)),
      ),
    [q, exclude],
  );

  return (
    <div className="cond-picker">
      <div className="dropdown-search">
        <span className="dropdown-search-icon"><SearchIcon /></span>
        <input
          autoFocus
          placeholder="Search Certifications…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="dropdown-list cond-picker-list">
        {results.length === 0 ? (
          <div className="cond-picker-empty">
            {exclude.length > 0 && !q
              ? "Every Certification is already a replacement."
              : "No Certifications match your search."}
          </div>
        ) : (
          results.map((c) => (
            <button key={c.id} className="cond-picker-item" onClick={() => onPick(c)}>
              <span className="task-kind-badge cert">C</span>
              <span className="cond-picker-item-name">{c.name}</span>
              <span className="cond-picker-item-meta">{c.id}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────  Shared field components  ───────────────── */

function RadioCard({
  selected,
  onSelect,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  desc?: string;
}) {
  return (
    <button
      type="button"
      className={`radio-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <span className="radio-dot" />
      <div className="radio-card-text">
        <div className="radio-card-title">{title}</div>
        {desc && <div className="radio-card-desc">{desc}</div>}
      </div>
    </button>
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
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
  /** Flags the field as a missing mandatory value (red shell + message). */
  error?: boolean;
  errorMessage?: string;
}) {
  return (
    <>
      <div className={`lang-field ${error ? "has-error" : ""}`}>
        <div className="lang-field-row">
          <span className="lang-tag">EN</span>
          <input
            className="lang-field-input"
            value={en}
            placeholder={placeholderEn}
            aria-invalid={error || undefined}
            onChange={(e) => onChangeEn(e.target.value)}
          />
        </div>
        <div className="lang-field-divider" />
        <div className="lang-field-row">
          <span className="lang-tag">ES</span>
          <input
            className="lang-field-input"
            value={es}
            placeholder={placeholderEs}
            onChange={(e) => onChangeEs(e.target.value)}
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
  compact,
  placeholderEn,
  placeholderEs,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  compact?: boolean;
  placeholderEn?: string;
  placeholderEs?: string;
}) {
  // Compact (inline-tree) editors keep the toolbar hidden until the field is
  // focused — a tree row can't spare 30px of permanent chrome. Full-size
  // editors show it always, per the Figma component.
  const [focused, setFocused] = useState(false);
  const showToolbar = !compact || focused;
  const focus = compact ? () => setFocused(true) : undefined;
  const blur = compact ? () => setFocused(false) : undefined;

  return (
    <div className={`rte-field ${compact ? "rte-field--compact" : ""}`}>
      {showToolbar && <RteToolbar />}
      <div className="rte-lang-row">
        <span className="lang-tag">EN</span>
        <AutoTextarea
          className="rte-area"
          value={en}
          placeholder={placeholderEn}
          onChange={onChangeEn}
          onFocus={focus}
          onBlur={blur}
        />
      </div>
      <div className="rte-field-divider" />
      <div className="rte-lang-row">
        <span className="lang-tag">ES</span>
        <AutoTextarea
          className="rte-area"
          value={es}
          placeholder={placeholderEs}
          onChange={onChangeEs}
          onFocus={focus}
          onBlur={blur}
        />
      </div>
    </div>
  );
}

export type { WizardData as CertWizardData, CertCourse, CertTask, TaskKind };
