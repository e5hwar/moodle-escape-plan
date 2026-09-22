import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckBoldIcon, InfoTipIcon, SmallXIcon } from "./icons";
import { ImageUploadField, type PickedImage } from "./ImageUploadField";
import { RichTextField } from "./RichTextField";
import { CertSplitTaskWizard } from "./CertSplitTaskWizard";
import { AddExistingTasksModal } from "./AddExistingTasksModal";
import { Dropdown } from "./Dropdown";
import { useTipWhileClosed } from "./HoverTooltip";
import { SearchIcon, AddCircleIcon, LockIcon, DragHandleIcon, RowKebabIcon, PlusThinIcon, MinusThinIcon, PencilIcon } from "./icons";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import { SelectField } from "./SelectField";
import { type TaskTypeKey, TASK_TYPE_OPTIONS } from "./Footer";
import { PrmModal } from "./PrmModal";
import { SelectRequirementModal, type RequirementPick } from "./SelectRequirementModal";
import { SelectCertificationsModal } from "./SelectCertificationsModal";
import { MultiSelect } from "./NewCompanyWizard";
import { type Certification, certifications } from "../data/certifications";
import { nodes as contentNodes, type ContentNode } from "../data/contentLinks";
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
  // Question count, for Quizzes pulled from the library (drives the row meta).
  questions?: number;
  restriction?: AccessRestriction;
  // Marks this Task as a Final Exam within the Certification. Surfaced as a flag
  // on the Add Tasks tree; a Cert can have more than one flagged Task.
  finalExam?: boolean;
  /** The Certifications the underlying library Task already belongs to. A Task
   *  reused from the library can't be deleted outright (1246:2666) — only
   *  removed from this Course. Absent on a Task created here, which nothing
   *  else owns yet. */
  usedIn?: string[];
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

/** The four bilingual fields the Lesson modal edits — everything else about a
    Lesson (its Tasks, expanded/hidden) is set from the tree, not the modal. */
type LessonDraft = Pick<CertLesson, "nameEn" | "nameEs" | "descEn" | "descEs">;

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

/* ── Row-menu glyphs (Figma 1244:1831 / 1246:2642) ──
   Traced from the node's own exports, not swapped for lookalikes from the
   shared icon set: the app's TrashIcon has no ✕, its LockIcon is a stroked
   outline, and its EyeIcon isn't the slashed one the node uses for "Hide".
   Each is 16px with the node's 1.333 stroke; the transforms place the path
   where Figma insets it inside the 16px slot. ── */

// Edit (I1244:1833;7:3617) — pencil over its stroke.
const MenuEditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333">
    <g transform="translate(1.333 0.724)">
      <path d="M7.33333 3.60948L0.666667 10.2761V13.2761H3.66667L10.3333 6.60948M7.33333 3.60948L10.3333 6.60948M7.33333 3.60948L10 0.942809L13 3.94281L10.3333 6.60948" />
    </g>
  </svg>
);
// Hide (I1244:1907) — a SLASHED eye. The node draws this one against "Hide";
// the plain eye belongs to "Show".
const MenuHideIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <path d="M8.78994 5.45067C9.20582 5.57903 9.58408 5.807 9.89184 6.11476C10.1996 6.42253 10.4276 6.80078 10.5559 7.21667M14.1959 10.19C14.6833 9.52477 15.0601 8.78527 15.3119 8C14.3246 4.90667 11.4259 2.66667 8.00594 2.66667C7.58549 2.66667 7.17394 2.69956 6.77127 2.76533M14.0059 14L2.00594 2M3.87794 3.872C2.37039 4.83613 1.24647 6.29603 0.699938 8C1.6866 11.0933 4.5846 13.3333 8.00527 13.3333C9.52527 13.3333 10.9413 12.8913 12.1333 12.128L3.87794 3.872ZM5.33927 8C5.33927 7.264 5.63794 6.59733 6.1206 6.11467L9.89127 9.886C9.51829 10.2589 9.04313 10.5128 8.52586 10.6156C8.00859 10.7184 7.47244 10.6655 6.98522 10.4637C6.49799 10.2618 6.08156 9.92 5.78859 9.48147C5.49562 9.04294 5.33925 8.52739 5.33927 8Z" />
  </svg>
);
// Show — the same eye without the slash, for a hidden node.
const MenuShowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <path d="M0.699938 8C1.6866 4.90667 4.5846 2.66667 8.00527 2.66667C11.4259 2.66667 14.3246 4.90667 15.3119 8C14.3246 11.0933 11.4259 13.3333 8.00527 13.3333C4.5846 13.3333 1.6866 11.0933 0.699938 8Z" />
    <path d="M10.6719 8C10.6719 9.47276 9.47803 10.6667 8.00527 10.6667C6.53251 10.6667 5.33861 9.47276 5.33861 8C5.33861 6.52724 6.53251 5.33333 8.00527 5.33333C9.47803 5.33333 10.6719 6.52724 10.6719 8Z" />
  </svg>
);
// Delete (I1244:1857;7:3404 / I1246:2667;7:3404) — a trash can with an ✕ across
// its body. The shared TrashIcon has no ✕, which is the difference.
const MenuDeleteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <g transform="translate(1.333 0.667)">
      <path d="M2 2.66667H11.3333M2 2.66667L2.33333 14H11L11.3333 2.66667M2 2.66667H0.666667M11.3333 2.66667H12.6667M8.55267 6.448L6.66667 8.33333M6.66667 8.33333L4.78133 10.2187M6.66667 8.33333L4.78133 6.448M6.66667 8.33333L8.55267 10.2187M4.33333 0.666667H9V2.66667H4.33333V0.666667Z" />
    </g>
  </svg>
);
// Access Restriction (Figma I1246:2660;7:3243) — a FILLED padlock with a slot
// across its body, traced from the node's own export. Not the app's stroked
// outline `LockIcon`, which is a different glyph.
const AccessRestrictionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 6.66667H2.33333V14.6667H13.6667V6.66667H12V4.66667C12 3.6058 11.5786 2.58839 10.8284 1.83824C10.0783 1.08809 9.06087 0.666667 8 0.666667C6.93913 0.666667 5.92172 1.08809 5.17157 1.83824C4.42143 2.58839 4 3.6058 4 4.66667V6.66667ZM5.33333 4.66667C5.33333 3.95942 5.61429 3.28115 6.11438 2.78105C6.61448 2.28095 7.29276 2 8 2C8.70724 2 9.38552 2.28095 9.88562 2.78105C10.3857 3.28115 10.6667 3.95942 10.6667 4.66667V6.66667H5.33333V4.66667ZM6 11.3333V10H10V11.3333H6Z" />
  </svg>
);
// Remove (Figma I1246:2672;7:1804) — an X inside a ring. "Remove Task" takes
// the Task out of this Course; it does not delete the Task itself.
const RemoveCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <g transform="translate(0.667 0.667)">
      <path d="M9.454 5.212L7.33333 7.33333M7.33333 7.33333L5.21133 9.45467M7.33333 7.33333L9.454 9.45467M7.33333 7.33333L5.21133 5.212M0.666667 7.33333C0.666667 3.65133 3.65133 0.666667 7.33333 0.666667C11.0153 0.666667 14 3.65133 14 7.33333C14 11.0153 11.0153 14 7.33333 14C3.65133 14 0.666667 11.0153 0.666667 7.33333Z" />
    </g>
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

function newConditionSet(): ConditionSet {
  return { id: nodeId("cs"), items: [] };
}

function newLesson(): CertLesson {
  return { id: nodeId("le"), nameEn: "", nameEs: "", descEn: "", descEs: "", expanded: true, hidden: false, tasks: [] };
}

// Convert a Task from the library into the lightweight CertTask the tree stores.
function libraryTaskToCertTask(t: Task): CertTask {
  const kind = TASK_TYPE_TO_KIND[t.type];
  const questions = t.quizSections?.reduce((n, s) => n + s.questionCount, 0) || undefined;
  return { id: nodeId("t"), name: t.name, kind, duration: DURATION_BY_KIND[kind], questions, finalExam: t.finalExam, usedIn: t.usedIn };
}

// Maps a stored Task's display type onto the wizard's TaskKind (used for badges).
const TASK_TYPE_TO_KIND: Record<TaskType, TaskKind> = {
  xAPI: "xapi",
  Quiz: "quiz",
  "Hands-On Task": "hands-on",
  Resource: "file",
};

const DURATION_BY_KIND: Record<TaskKind, string> = {
  xapi: "10 mins",
  quiz: "15 mins",
  "hands-on": "30 mins",
  file: "5 mins",
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
          expanded: true,
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
    expanded: true,
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
          expanded: true,
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
};

// When editing, prefill the fields the Certification record actually carries.
// Structural data (courses, completion) isn't stored on the list record, so for
// existing Certifications we populate plausible sample data instead.
function buildInitialData(editing?: Certification): WizardData {
  // Every Certification must contain at least one Course and one Condition Set,
  // so seed one of each by default. The Condition Set opens empty — the Admin
  // fills it from "+ Add Requirement".
  if (!editing) return { ...BLANK_DATA, courses: [newCourse()], conditionSets: [newConditionSet()] };
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
    // Visibility step. Retiring one is its own full-page flow off the row menu
    // (ArchiveCertificationPage), not a step in here.
    visibility: vis === "Visible" ? "visible" : "hidden",
  };
}

const STEPS: { id: string; label: string; sub: string; desc: string; tip?: string }[] = [
  { id: "details", label: "Details", sub: "Name, description, metadata", desc: "Name, describe, and tag this Certification." },
  { id: "additional", label: "Additional Info", sub: "Announcement, CEUs, keywords", desc: "Add an announcement, CEUs awarded on completion, and search keywords." },
  { id: "tasks", label: "Add Tasks", sub: "Courses, lessons, and tasks", desc: "Build this Certification's structure: Courses contain Lessons (optional) and Tasks. Tasks can be pulled from the Task library or created fresh — newly created Tasks are added to the library too." },
  { id: "completion", label: "Completion", sub: "How completion is determined", desc: "Define how this Certification is completed. Add Condition Sets — satisfying any one completes the Cert; every item within a set is required." },
  { id: "paywall", label: "Paywall", sub: "Access type and Product IDs", desc: "Control how this Certification is purchased — the access type, its store Product IDs, and what happens to progress on repurchase." },
  {
    id: "scope",
    label: "Audience",
    sub: "Who can see this Certification",
    desc: "Restricts this Certification to specific B2B companies. Leave this step untouched for public content — anything you set here hides the Certification from B2C users.",
    tip: "Every filter you set narrows the audience. A company must match all the filters you set (Audience, Trade and Partnership). Within a single filter, matching one value is enough — content tagged Residential HVAC and Commercial HVAC is visible to a company in either.",
  },
];

/* What each mandatory field is called in the tooltip on the disabled Create
   Certification button — the gap keys `collectMissing` returns are internal. */
const REQUIRED_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  courses: "Courses",
  completion: "Completion Criteria",
};

type Props = { onClose: () => void; editingCert?: Certification };

export function NewCertificationWizard({ onClose, editingCert }: Props) {
  const isEditing = !!editingCert;
  const steps = STEPS;
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
  // Cancel's confirm. There is no draft to fall back on — leaving throws the
  // work away — so an edited wizard asks first.
  const [confirmCancel, setConfirmCancel] = useState(false);

  /* The wizard as it opened. Anything the admin touches makes `dirty` true,
     which is what decides whether Cancel stops to ask: an untouched wizard
     closes straight away rather than nagging about nothing. */
  const pristine = useRef(data);
  const dirty = JSON.stringify(data) !== JSON.stringify(pristine.current);
  function requestClose() {
    if (dirty) setConfirmCancel(true);
    else onClose();
  }

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  // Wheel-past-the-edge step navigation, shared with every other wizard.
  const lastStep = steps.length - 1;
  const gate = useEdgeLineGate({ step, setStep, lastStep });
  // The step pane scrolls, so jumping to a flagged field has to take the view
  // back to the top — otherwise a same-step jump looks like nothing happened
  // (gate.goStep no-ops when the step doesn't actually change).
  function goStep(i: number) {
    gate.goStep(i);
    gate.scrollRef.current?.scrollTo({ top: 0 });
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
      // The builder tolerates an empty Certification — you can delete your way
      // down to no Courses at all — but creating one needs at least a Course.
      if (d.courses.length === 0) gaps.push({ step: stepIndex("tasks"), key: "courses" });
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

  /* Every mandatory field still empty, right now — the gate on the footer's
     create button. Re-derived each render, so filling the last one enables the
     button on the keystroke rather than on the next attempt. */
  const gaps = useMemo(() => collectMissing(data), [collectMissing, data]);
  const canPublish = gaps.length === 0;

  /* What the unavailable Create Certification button says on hover: the fields
     holding it back, each with the step that owns it. Without this the button
     is just dim — the admin has no way to tell what is left. */
  const blockedTip = canPublish
    ? undefined
    : [
        "Fill in every required field to create this Certification:",
        ...gaps.map(
          (g) => `• ${REQUIRED_FIELD_LABELS[g.key] ?? g.key} — ${steps[g.step].label}`,
        ),
      ].join("\n");

  /** Steps that still hold an empty mandatory field. */
  const gapSteps = useMemo(() => new Set(gaps.map((g) => g.step)), [gaps]);

  /* The rail's error state. A step flags "needs input" once you've moved past
     it — or skipped it from the rail — with a mandatory field still empty; a
     publish attempt flags every gap, steps you never opened included. */
  const stepStatuses = useWizardStepStatuses({
    step,
    count: steps.length,
    incomplete: (i) => gapSteps.has(i),
    flagAll: attemptedSubmit,
  });

  /* Publish / Save changes: check every mandatory field on every step first. A
     gap sends you to the step that owns the first one with it flagged. A clean
     create hands off to the Industries modal, which is what actually closes the
     wizard. */
  function handlePublish() {
    setAttemptedSubmit(true);
    if (!canPublish) {
      goStep(gaps[0].step);
      return;
    }
    if (isEditing) {
      onClose();
      return;
    }
    setShowIndustries(true);
  }

  /* ⌘/Ctrl+Enter is the footer's primary button. Off while the split Task
     wizard has taken over the screen — that wizard answers the shortcut with
     its own footer instead. */
  useWizardEnterShortcut(handlePublish, undefined, !splitTask);

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

  // The step's title + description. Every step but Add Tasks paints it at the
  // top of the pane — that step runs as a third full-height panel beside the
  // nav and opens straight on the selected Course (Figma 886:1148).
  const stepHead = (
    <>
      <h1 className="wizard-title">{steps[step].label}</h1>
      <p className="wizard-desc">
        {steps[step].desc}
        {steps[step].tip && (
          <span
            className="form-help-info wizard-desc-info"
            tabIndex={0}
            role="note"
            aria-label={steps[step].tip}
            data-tip={steps[step].tip}
          >
            <InfoTipIcon />
          </span>
        )}
      </p>
    </>
  );

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
              const status = stepStatuses[i];
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
          <WizardGateEdges
            gate={gate}
            step={step}
            lastStep={lastStep}
            labels={steps.map((s) => s.label)}
          />
          <div className={`wizard-content ${step === 2 ? "wizard-content--flush" : ""}`} ref={gate.scrollRef}>
            <div className="wizard-paneout" ref={gate.paneOutRef}>
              <div className="wizard-pane" key={step}>
              {step !== 2 && stepHead}

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
              {step === 4 && <PaywallStep data={data} update={update} />}
              {step === 5 && <AudienceStep data={data} update={update} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          {isEditing && <span className="wizard-saved">Last saved 2 minutes ago</span>}
          <button className="wizard-cancel" onClick={requestClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {/* Unavailable until every mandatory field on every step is filled.
              `aria-disabled` rather than `disabled`: a disabled button fires no
              mouse events, so it could neither show the tooltip that says what
              is missing nor answer a click by jumping to the first gap. */}
          <button
            className={`btn-publish${canPublish ? "" : " is-disabled"}`}
            aria-disabled={!canPublish}
            data-tip={blockedTip}
            onClick={handlePublish}
          >
            {isEditing ? "Save Changes" : "Create Certification"}
            <WizardKeyHint />
          </button>
        </div>
      </footer>

      {/* Cancel's confirm. Portalled past `.wizard-pane`, whose transform would
          otherwise trap a fixed-position overlay inside the pane. */}
      {confirmCancel &&
        createPortal(
          <PrmModal
            title={isEditing ? "Discard changes?" : "Discard this Certification?"}
            description={
              isEditing
                ? "Your changes to this Certification will be lost. This can't be undone."
                : "This Certification hasn't been created yet — everything you've filled in will be lost."
            }
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            danger
            onCancel={() => setConfirmCancel(false)}
            onConfirm={() => { setConfirmCancel(false); onClose(); }}
          />,
          document.body,
        )}

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
            searchPlaceholder="Search Industries..."
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
          Archiving — the permanent retirement — is its own page off the row
          menu, not a visibility state. */}
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
          placeholderEn="Announcement..."
          placeholderEs="Anuncio..."
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* The Import Courses picker is the shared Certification selector (`.stm-*`
 * table chrome), so its catalog has to arrive in the content graph's shape.
 * Level and Enrolled come from the graph node of the same name where there is
 * one; the handful of Certifications the graph doesn't carry fall back to their
 * career stage for Level and show no enrollment. */
const LEVEL_BY_STAGE: Record<string, ContentNode["level"]> = {
  "Pre-Apprentice": "Beginner",
  Apprentice: "Beginner",
  Journeyman: "Intermediate",
  Master: "Advanced",
};

const IMPORT_POOL: ContentNode[] = certifications.map((c) => {
  const node = contentNodes.find((n) => n.kind === "Certification" && n.name === c.name);
  return {
    id: c.id,
    name: c.name,
    kind: "Certification",
    level: node?.level ?? LEVEL_BY_STAGE[c.careerStage ?? ""] ?? "Beginner",
    tasksCount: c.tasks,
    enrolled: node?.enrolled,
    industry: c.industry,
  };
});

// Nothing is ever un-pickable here — every Certification can join the plan, and
// the ones already in it arrive ticked (but still clickable) via `preselected`.
const EMPTY_LOCKED = new Set<string>();

// The trailing meta on a Task row (Figma 1244:2356 — "xAPI · 12 mins"): the
// Task's type, then its length. The type used to ride a leading glyph; the
// 1244:1778 component set drops the glyph and names the type here instead.
// Quizzes pulled from the library count questions rather than minutes, and a
// Resource has no length at all, so it reads as its type alone.
function taskMeta(t: CertTask): string {
  const kind = KIND_MONO[t.kind];
  if (t.kind === "file") return kind;
  if (t.kind === "quiz" && t.questions) return `${kind} · ${plural(t.questions, "question")}`;
  return t.duration ? `${kind} · ${t.duration}` : kind;
}

// Import (Figma Icon Library 7:4992) — a box with an arrow dropping into it.
// Leads the "Import Courses" card that closes the Courses panel.
const ImportCoursesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.333" strokeLinecap="square">
    <g transform="translate(1.333 1.333)">
      <path d="M4.66667 0.666667H0.666667V12.6667H12.6667V5.33333" />
      <path d="M12.6667 1.33333H10C9.11595 1.33333 8.2681 1.68452 7.64298 2.30964C7.01786 2.93477 6.66667 3.78261 6.66667 4.66667V8M9 6.66667L6.66667 9L4.33333 6.66667" />
    </g>
  </svg>
);

// The Course kebab's items — shared by the Courses panel row and the Course
// pane header, so both open the same Edit / Hide / Delete set.
/* One menu for both a Course and a Lesson — the node draws them identically
 * (Figma 1244:1831): Edit · Hide · Delete, bare verbs, no divider. Delete is
 * blocked with its reason on a second line (the 1246:2666 pattern) when the
 * node can't go — a Certification has to keep at least one Course. */
function NodeMenuItems({
  hidden,
  blockedReason,
  close,
  onEdit,
  onToggleHidden,
  onRemove,
}: {
  hidden: boolean;
  /** Why Delete is unavailable, or undefined when it is. */
  blockedReason?: string;
  close: () => void;
  onEdit: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="menu">
      <button className="menu-item" onClick={() => { onEdit(); close(); }}>
        <span className="menu-item-icon"><MenuEditIcon /></span>
        Edit
      </button>
      <button className="menu-item" onClick={() => { onToggleHidden(); close(); }}>
        <span className="menu-item-icon">{hidden ? <MenuShowIcon /> : <MenuHideIcon />}</span>
        {hidden ? "Show" : "Hide"}
      </button>
      {blockedReason ? (
        <button className="menu-item" disabled>
          <span className="menu-item-icon"><MenuDeleteIcon /></span>
          <span className="menu-item-stack">
            Delete
            <span className="menu-item-sub">{blockedReason}</span>
          </span>
        </button>
      ) : (
        <button className="menu-item danger" onClick={() => { onRemove(); close(); }}>
          <span className="menu-item-icon"><MenuDeleteIcon /></span>
          Delete
        </button>
      )}
    </div>
  );
}

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
  // Which Course has its inline name/description editor open. Adding a Course
  // opens its editor immediately; only one is open at a time, matching the
  // prototype's focused inline-editing model. Lessons no longer use it — their
  // name/description is edited in a modal instead (see `lessonModal`).
  const [editingId, setEditingId] = useState<string | null>(null);
  // The open Lesson modal, or null. `lesson: null` = adding a new one to that
  // Course; a Lesson = editing that one.
  const [lessonModal, setLessonModal] = useState<{
    courseId: string;
    lesson: CertLesson | null;
  } | null>(null);
  // The Course shown in the right pane. Falls back to the first Course whenever
  // the selection goes stale (deleted, or replaced by an import).
  const [selectedId, setSelectedId] = useState<string | null>(data.courses[0]?.id ?? null);
  const course = data.courses.find((c) => c.id === selectedId) ?? data.courses[0];
  const courseIdx = course ? data.courses.indexOf(course) : -1;
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
  function applyImport(ids: string[]) {
    setImporting(false);
    // Certifications already in the plan keep their slot; newly ticked ones
    // land after them, in the order the picker handed them back.
    const inPlan = plan.map((c) => c.id).filter((id) => ids.includes(id));
    const ordered = [...inPlan, ...ids.filter((id) => !inPlan.includes(id))];
    const selected = ordered
      .map((id) => certifications.find((c) => c.id === id))
      .filter((c): c is Certification => !!c);
    const manual = data.courses.filter((c) => !c.sourceCertId);

    if (selected.length === 0) {
      // Plan cleared — drop imported Courses and the auto-generated completion.
      // Whatever was added by hand stays; nothing is seeded to replace it.
      update({ courses: manual, importedCerts: [], conditionSets: [] });
      setSelectedId(manual[0]?.id ?? null);
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
    setSelectedId(importedCourses[0]?.id ?? null);
  }

  function updateCourse(id: string, patch: Partial<CertCourse>) {
    update({
      courses: data.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function removeCourse(id: string) {
    if (editingId === id) setEditingId(null);
    const idx = data.courses.findIndex((c) => c.id === id);
    const rest = data.courses.filter((c) => c.id !== id);
    update({ courses: rest });
    // Land on the neighbour that took the deleted Course's slot — or on nothing,
    // once the last Course is gone.
    if (id === course?.id) {
      setSelectedId(rest.length > 0 ? rest[Math.min(idx, rest.length - 1)].id : null);
    }
  }

  // Closing a Course editor. A freshly-added Course left completely empty is
  // dropped on cancel (unless it's the only Course); otherwise the editor closes.
  function cancelCourseEditor(c: CertCourse) {
    setEditingId(null);
    if (isEmptyCourse(c)) removeCourse(c.id);
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

  // Save from the Lesson modal — appends a new Lesson when it was opened from
  // "Add Lesson", otherwise patches the one being edited. Nothing reaches the
  // tree until Save, so a cancelled add leaves no half-made card behind (the
  // reason the inline editor needed a cancel-cleanup pass).
  function saveLesson(vals: LessonDraft) {
    if (!lessonModal) return;
    const { courseId, lesson } = lessonModal;
    if (lesson) {
      updateLesson(courseId, lesson.id, vals);
    } else {
      update({
        courses: data.courses.map((c) =>
          c.id === courseId
            ? {
                ...c,
                children: [
                  ...c.children,
                  { kind: "lesson" as const, lesson: { ...newLesson(), ...vals } },
                ],
              }
            : c,
        ),
      });
    }
    setLessonModal(null);
  }

  function addCourse() {
    const c = newCourse();
    update({ courses: [...data.courses, c] });
    setSelectedId(c.id);
    setEditingId(c.id);
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
      <div className="ctb">
        {/* ── Courses panel (Figma 886:999) ── */}
        <aside className="ctb-side">
          {/* 1245:2588 — the title alone over a hairline. Adding a Course is
              the footer's job, so the header's "+" is gone. */}
          <div className="ctb-side-head">
            <span className="ctb-side-title">Courses · {data.courses.length}</span>
          </div>

          {/* A list of one has nothing to reorder, so its grips never paint. */}
          <ul className={`ctb-list${data.courses.length === 1 ? " is-single" : ""}`}>
            {data.courses.map((c) => {
              const d = dnd("courses", c.id);
              return (
                <li
                  key={c.id}
                  className={`ctb-item ${c.id === course?.id ? "selected" : ""} ${c.hidden ? "hidden" : ""}`}
                  onClick={() => setSelectedId(c.id)}
                  {...d.target}
                >
                  <DragDots className="ctb-item-grip" {...d.handle} />
                  <span className="ctb-item-name">{c.nameEn || "Untitled Course"}</span>
                  {c.sourceCertName && (
                    <span className="ctb-item-flag" title={`Imported from ${c.sourceCertName}`}>
                      <LayersIcon />
                    </span>
                  )}
                  {c.hidden && (
                    <span className="ctb-item-flag" title="Hidden from learners"><EyeOffIcon /></span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* The panel's adds (Figma 1258:1251 "Add Actions"): a new Course is
              the primary, and the Learning Plan import — which copies Courses
              out of other Certifications — is the quiet link under it. The
              picker itself reports what's already imported, so the link reads
              the same whether or not a plan exists. */}
          <div className="ctb-side-foot">
            <button className="ctb-add-primary" onClick={addCourse}>
              <PlusThinIcon />
              Add Course
            </button>
            <button className="ctb-add-sub" onClick={() => setImporting(true)}>
              <ImportCoursesIcon />
              Import from Other Certifications
            </button>
          </div>
        </aside>

        {/* ── Selected Course ── */}
        <section className="ctb-main">
          {/* A Certification is allowed to sit at zero Courses while it's being
              built — it just can't be created that way (see collectMissing). */}
          {!course && (
            <div className="ctb-empty ctb-empty--courses">
              No Courses yet — every Certification needs at least one to be created.
              <button className="ctb-empty-add" onClick={addCourse}>
                <PlusThinIcon />
                Add Course
              </button>
            </div>
          )}
          {course && (
            <CoursePane
              key={course.id}
              course={course}
              index={courseIdx + 1}
              editing={editingId === course.id}
              allTasks={allTasks}
              dnd={dnd}
              onUpdateTask={updateTaskById}
              onRemoveTask={removeTaskById}
              onUpdate={(patch) => updateCourse(course.id, patch)}
              onToggleHidden={() => updateCourse(course.id, { hidden: !course.hidden })}
              onOpenEditor={() => setEditingId(course.id)}
              onCancelEditor={() => cancelCourseEditor(course)}
              onSaveEditor={() => setEditingId(null)}
              onRemove={() => removeCourse(course.id)}
              onCreateTask={(taskType) => onCreateTask(course.id, undefined, taskType)}
              onAddExistingTask={() => onAddExisting(course.id, undefined)}
              onAddLesson={() => setLessonModal({ courseId: course.id, lesson: null })}
              onCreateTaskInLesson={(lessonId, taskType) => onCreateTask(course.id, lessonId, taskType)}
              onAddExistingTaskInLesson={(lessonId) => onAddExisting(course.id, lessonId)}
              onToggleLesson={(lessonId) => toggleLesson(course.id, lessonId)}
              onToggleLessonHidden={(lessonId) =>
                mapLesson(course.id, lessonId, (l) => ({ ...l, hidden: !l.hidden }))
              }
              onOpenLessonEditor={(lesson) => setLessonModal({ courseId: course.id, lesson })}
              onRemoveLesson={(lessonId) => removeLesson(course.id, lessonId)}
            />
          )}
        </section>
      </div>

      {/* Portalled to <body>, like the Completion step's picker: `.wizard-pane`
          carries a transform, which would otherwise turn these overlays'
          position:fixed into a local box — they'd scrim only the right panel
          instead of the page, and a full-height card would overflow it. */}
      {importing &&
        createPortal(
        <SelectCertificationsModal
          title="Import Courses"
          description="Pick the Certifications to merge in. Their Courses, Lessons, and Tasks are copied in (Tasks are reused, not duplicated), and completion will require every one you add."
          confirmLabel={plan.length > 0 ? "Update Learning Plan" : "Import Courses"}
          pool={IMPORT_POOL}
          preselected={plan.map((c) => c.id)}
          locked={EMPTY_LOCKED}
          full
          allowEmpty
          onCancel={() => setImporting(false)}
          onConfirm={applyImport}
        />,
        document.body,
      )}

      {lessonModal &&
        createPortal(
        <LessonModal
          lesson={lessonModal.lesson}
          onCancel={() => setLessonModal(null)}
          onSave={saveLesson}
        />,
        document.body,
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

/* Lesson name + description — a standard modal on the shared `PrmModal` shell
   (Figma 483:588), not the inline editor a Course still uses. Opened by
   "Add Lesson" in the Course footer and by "Edit Lesson" in a Lesson's kebab.

   Both fields are the app's bilingual controls — the `LangField` EN/ES pair for
   the name, the shared `RichTextField` for the description, which is rich text.

   The draft lives here and only reaches the tree on Save, so cancelling an
   "Add Lesson" leaves nothing behind. The English name is required: it's what
   the Lesson row prints. */
function LessonModal({
  lesson,
  onCancel,
  onSave,
}: {
  /** The Lesson being edited, or null when adding one. */
  lesson: CertLesson | null;
  onCancel: () => void;
  onSave: (vals: LessonDraft) => void;
}) {
  const [draft, setDraft] = useState<LessonDraft>({
    nameEn: lesson?.nameEn ?? "",
    nameEs: lesson?.nameEs ?? "",
    descEn: lesson?.descEn ?? "",
    descEs: lesson?.descEs ?? "",
  });
  const patch = (p: Partial<LessonDraft>) => setDraft((d) => ({ ...d, ...p }));
  const canSave = draft.nameEn.trim().length > 0;

  function submit() {
    if (!canSave) return;
    onSave({
      ...draft,
      nameEn: draft.nameEn.trim(),
      nameEs: draft.nameEs.trim(),
    });
  }

  // PrmModal closes on the overlay and the close glyph only — Esc is the
  // modal's own, as on the Question Bank's category modals.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <PrmModal
      title={lesson ? "Edit Lesson" : "New Lesson"}
      description="Lessons group the Tasks that follow them inside a Course."
      confirmLabel={lesson ? "Save Lesson" : "Add Lesson"}
      confirmDisabled={!canSave}
      onCancel={onCancel}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">
            Name<span className="prm-req">*</span>
          </span>
          <LangField
            autoFocus
            en={draft.nameEn}
            es={draft.nameEs}
            onChangeEn={(v) => patch({ nameEn: v })}
            onChangeEs={(v) => patch({ nameEs: v })}
            placeholderEn="Lesson name"
            placeholderEs="Nombre"
            onEnter={submit}
          />
        </div>

        <div className="prm-field">
          <span className="prm-label">Description</span>
          <RichTextField
            en={draft.descEn}
            es={draft.descEs}
            onChangeEn={(v) => patch({ descEn: v })}
            onChangeEs={(v) => patch({ descEs: v })}
            placeholderEn="Description"
            placeholderEs="Descripción"
            minRows={2}
          />
        </div>
      </div>
    </PrmModal>
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

// The right pane: the selected Course's header (eyebrow · name · description ·
// counts · kebab), its inline editor when open, then one card per group — a
// Lesson with its Tasks, or a run of loose Tasks — each closed by a "+ Task"
// row, and the "+ Task / + Lesson" footer.
function CoursePane({
  course,
  index,
  editing,
  allTasks,
  dnd,
  onUpdateTask,
  onRemoveTask,
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
  onToggleLesson,
  onToggleLessonHidden,
  onOpenLessonEditor,
  onRemoveLesson,
}: {
  course: CertCourse;
  index: number;
  editing: boolean;
  allTasks: CertTask[];
  dnd: (scope: string, id: string) => DndProps;
  onUpdateTask: (taskId: string, patch: Partial<CertTask>) => void;
  onRemoveTask: (taskId: string) => void;
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
  onToggleLesson: (lessonId: string) => void;
  onToggleLessonHidden: (lessonId: string) => void;
  /** Opens the Lesson modal on that Lesson (the pencil in its kebab). */
  onOpenLessonEditor: (lesson: CertLesson) => void;
  onRemoveLesson: (lessonId: string) => void;
}) {
  const childScope = `course:${course.id}`;
  const groups = groupChildren(course.children);
  return (
    <div className={`ctb-course ${course.hidden ? "hidden" : ""}`}>
      {/* Header (Figma 890:3176): COURSE n · name · description, with the
          32px "More" button at the far right. */}
      <div className="ctb-course-head">
        <div className="ctb-course-titles">
          <div className="ctb-eyebrow">Course {index}</div>
          <div className="ctb-course-name-row">
            <h2 className="ctb-course-name">{course.nameEn || "Untitled Course"}</h2>
            {course.sourceCertName && (
              <span className="cert-source-pill"><LayersIcon />Imported</span>
            )}
            {course.hidden && <span className="cert-hidden-pill">Hidden</span>}
          </div>
          {course.descEn && <p className="ctb-course-desc">{course.descEn}</p>}
        </div>
        <Dropdown
          width="auto"
          align="right"
          panelClass="ctb-menu"
          trigger={({ open, toggle }) => (
            <CourseMoreButton open={open} toggle={toggle} />
          )}
        >
          {({ close }) => (
            <NodeMenuItems
              hidden={!!course.hidden}
              close={close}
              onEdit={onOpenEditor}
              onToggleHidden={onToggleHidden}
              onRemove={onRemove}
            />
          )}
        </Dropdown>
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

      {/* `is-single`: one child means nothing to drag against — see .ctb-list. */}
      <div className={`ctb-groups${course.children.length === 1 ? " is-single" : ""}`}>
        {course.children.length === 0 && !editing && (
          <div className="ctb-empty">No Tasks yet — add a Task or a Lesson to get started.</div>
        )}

        {groups.map((g) =>
          g.kind === "tasks" ? (
            <div className="ctb-card" key={g.key}>
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
              <AddTaskRow onCreateNew={onCreateTask} onAddExisting={onAddExistingTask} />
            </div>
          ) : (
            <LessonCard
              key={g.key}
              lesson={g.lesson}
              num={g.num}
              allTasks={allTasks}
              dnd={dnd}
              dndRow={dnd(childScope, g.lesson.id)}
              onUpdateTask={onUpdateTask}
              onRemoveTask={onRemoveTask}
              onToggle={() => onToggleLesson(g.lesson.id)}
              onToggleHidden={() => onToggleLessonHidden(g.lesson.id)}
              onOpenEditor={() => onOpenLessonEditor(g.lesson)}
              onRemove={() => onRemoveLesson(g.lesson.id)}
              onCreateTask={(taskType) => onCreateTaskInLesson(g.lesson.id, taskType)}
              onAddExistingTask={() => onAddExistingTaskInLesson(g.lesson.id)}
            />
          ),
        )}
      </div>

      {/* Course-level adds (Figma 1256:1250 "Add Actions"): Add Lesson is the
          primary — a full-width dashed card — and adding a loose Task is the
          quiet link under it, since a Task normally belongs to a Lesson. */}
      <div className="ctb-foot">
        <button className="ctb-add-primary" onClick={onAddLesson}>
          <PlusThinIcon />
          Add Lesson
        </button>
        <AddTaskMenu
          label="Add Task Directly to Lesson"
          onCreateNew={onCreateTask}
          onAddExisting={onAddExistingTask}
        />
      </div>
    </div>
  );
}

// A Lesson block (Figma 1244:2344 "Lesson - Default"): a tinted 12px-radius
// block holding a header row — grip · LESSON n eyebrow, name, description ·
// kebab — above an inset card of its Task rows, closed by an "Add Tasks" row
// that adds into this Lesson. Collapsing hides everything under the header.
function LessonCard({
  lesson,
  num,
  allTasks,
  dnd,
  dndRow,
  onUpdateTask,
  onRemoveTask,
  onToggle,
  onToggleHidden,
  onOpenEditor,
  onRemove,
  onCreateTask,
  onAddExistingTask,
}: {
  lesson: CertLesson;
  num: number;
  allTasks: CertTask[];
  dnd: (scope: string, id: string) => DndProps;
  dndRow: DndProps;
  onUpdateTask: (taskId: string, patch: Partial<CertTask>) => void;
  onRemoveTask: (taskId: string) => void;
  onToggle: () => void;
  onToggleHidden: () => void;
  onOpenEditor: () => void;
  onRemove: () => void;
  onCreateTask: (taskType: TaskTypeKey) => void;
  onAddExistingTask: () => void;
}) {
  const taskScope = `lesson:${lesson.id}`;
  return (
    <div className={`ctb-lesson ${lesson.expanded ? "expanded" : ""} ${lesson.hidden ? "hidden" : ""}`}>
      <div className="ctb-lesson-head" onClick={onToggle} {...dndRow.target}>
        <DragDots className="ctb-grip" {...dndRow.handle} />
        <div className="ctb-lesson-titles">
          <div className="ctb-lesson-eyebrow">Lesson {num}</div>
          <div className="ctb-lesson-name-row">
            <span className="ctb-lesson-name">{lesson.nameEn || "Untitled Lesson"}</span>
            {lesson.hidden && <span className="cert-hidden-pill">Hidden</span>}
          </div>
          {lesson.descEn && <div className="ctb-lesson-desc">{lesson.descEn}</div>}
        </div>
        {/* 1244:1779 — on hover the lone kebab becomes a two-tile pill:
            Edit, then the kebab. */}
        <span className="ctb-lesson-acts" onClick={(e) => e.stopPropagation()}>
          <button
            className="ctb-lesson-edit"
            aria-label="Edit Lesson"
            title="Edit Lesson"
            onClick={onOpenEditor}
          >
            <PencilIcon />
          </button>
          <RowMenu label="Lesson actions">
            {({ close }) => (
              <NodeMenuItems
                hidden={!!lesson.hidden}
                close={close}
                onEdit={onOpenEditor}
                onToggleHidden={onToggleHidden}
                onRemove={onRemove}
              />
            )}
          </RowMenu>
        </span>
      </div>

      {lesson.expanded && (
        // 1245:2473 — the Tasks sit in their OWN card, inset 24px inside the
        // Lesson block rather than sharing its frame.
        <div className="ctb-lesson-body">
          <div className={`ctb-tasktable${lesson.tasks.length === 1 ? " is-single" : ""}`}>
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
            <AddTaskRow onCreateNew={onCreateTask} onAddExisting={onAddExistingTask} />
          </div>
        </div>
      )}
    </div>
  );
}

// The 16px horizontal kebab on Lesson and Task rows (Figma "Kebab Menu -
// Horizontal"), wrapping the shared Dropdown.
function RowMenu({
  label,
  children,
}: {
  label: string;
  children: (args: { close: () => void }) => React.ReactNode;
}) {
  return (
    <Dropdown
      // 1244:1831 hugs its widest item (108px for the Lesson menu, 224 for the
      // Task one) rather than sitting at a fixed width.
      width="auto"
      align="right"
      panelClass="ctb-menu"
      trigger={({ open, toggle }) => (
        <RowKebab label={label} open={open} toggle={toggle} />
      )}
    >
      {children}
    </Dropdown>
  );
}

/* The Course header's 32px "More" tile and the Courses-panel row kebab. Like
   RowKebab below, each is a component so `useTipWhileClosed` can run. */
function CourseMoreButton({ open, toggle }: { open: boolean; toggle: () => void }) {
  const hint = useTipWhileClosed("Course actions", open);
  return (
    <button
      className="ctb-more"
      aria-label="Course actions"
      data-tip={hint}
      onClick={(e) => { e.stopPropagation(); toggle(); }}
    >
      <RowKebabIcon />
    </button>
  );
}

/* Its own component so the tip hook can run: the trigger above is a render
   prop, and the label must not hang over the panel while the menu is open. */
function RowKebab({
  label,
  open,
  toggle,
}: {
  label: string;
  open: boolean;
  toggle: () => void;
}) {
  const hint = useTipWhileClosed(label, open);
  return (
    <button
      className={`ctb-row-kebab${open ? " is-open" : ""}`}
      aria-label={label}
      data-tip={hint}
      onClick={(e) => { e.stopPropagation(); toggle(); }}
    >
      <RowKebabIcon />
    </button>
  );
}

// The "Add Task" row that closes every card (Figma 894:3500). Opens the shared
// picker: pull from the library, or create a new Task of a chosen type.
function AddTaskRow({
  onCreateNew,
  onAddExisting,
}: {
  onCreateNew: (t: TaskTypeKey) => void;
  onAddExisting: () => void;
}) {
  return (
    <Dropdown
      width="auto"
      panelClass="ctb-menu"
      trigger={({ toggle }) => (
        <button className="ctb-add-row" onClick={toggle}>
          <PlusThinIcon />
          Add Tasks
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

// A Task row (Figma 1244:2354): grip · name · state pills · meta · kebab. The
// type is named by the meta, not by a leading glyph. The Final Exam flag and the Access Restriction editor live in the
// kebab. A Task whose restriction is configured carries the gate pill under
// the row (Figma 894:3496 "Secondary Button"), naming its prerequisites.
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
  // The "Edit" placeholder and the Delete confirm.
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const restricted = !!task.restriction?.enabled;
  const finalExam = !!task.finalExam;
  // A Task pulled from the library is owned by the Certifications it already
  // belongs to (this one is still unsaved, so it never appears in the list).
  const sharedWith = task.usedIn ?? [];

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
    <div className={`ctb-task-wrap ${prereqs.length > 0 ? "has-gate" : ""}`}>
      <div className="ctb-task" {...dndRow.target}>
        <DragDots className="ctb-grip" {...dndRow.handle} />
        <span className="ctb-task-name">{task.name}</span>
        {finalExam && <span className="cert-final-pill"><FlagIcon />Final Exam</span>}
        {/* Restriction switched on but no prerequisite picked yet — the gate has
            nothing to name, so flag the half-configured state instead. */}
        {restricted && prereqs.length === 0 && (
          <span className="cert-restricted-pill">Restricted</span>
        )}
        <span className="ctb-row-meta">{taskMeta(task)}</span>
        <span className="ctb-row-acts">
          <RowMenu label="Task actions">
            {({ close }) => (
              // 1246:2642 — Edit · Add Access Restriction · Remove Task ·
              // Delete Task. Delete is disabled, with its reason on a second
              // line, whenever the Task is reused from the library.
              <div className="menu">
                <button className="menu-item" onClick={() => { setEditing(true); close(); }}>
                  <span className="menu-item-icon"><MenuEditIcon /></span>
                  Edit
                </button>
                <button className="menu-item" onClick={() => { setOpen((o) => !o); close(); }}>
                  <span className={`menu-item-icon ${restricted ? "is-on" : ""}`}><AccessRestrictionIcon /></span>
                  {restricted || open ? "Edit Access Restriction" : "Add Access Restriction"}
                </button>
                <button className="menu-item" onClick={() => { onRemove(); close(); }}>
                  <span className="menu-item-icon"><RemoveCircleIcon /></span>
                  Remove Task
                </button>
                {sharedWith.length > 0 ? (
                  <button className="menu-item" disabled>
                    <span className="menu-item-icon"><MenuDeleteIcon /></span>
                    <span className="menu-item-stack">
                      Delete Task
                      <span className="menu-item-sub">This Task is a part of other Certifications</span>
                    </span>
                  </button>
                ) : (
                  <button className="menu-item danger" onClick={() => { setDeleting(true); close(); }}>
                    <span className="menu-item-icon"><MenuDeleteIcon /></span>
                    Delete Task
                  </button>
                )}
              </div>
            )}
          </RowMenu>
        </span>
      </div>
      {prereqs.length > 0 && (
        <div className="ctb-task-gate">
          <span className="ctb-task-gate-icon"><RestrictionLockIcon /></span>
          <p className="ctb-task-gate-text">
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
      {open && (
        <div className="ctb-task-restrict">
          <AccessRestrictionEditor task={task} allTasks={allTasks} onUpdate={onUpdate} />
        </div>
      )}

      {/* Placeholder — the Task editor itself is a separate flow, and this
          wizard only knows how to CREATE Tasks (CertSplitTaskWizard). */}
      {editing &&
        createPortal(
        <PrmModal
          title="Edit Task"
          description={`Editing "${task.name}" opens the Task editor, which isn't wired up from the Certification builder yet.`}
          confirmLabel="Got it"
          hideCancel
          onCancel={() => setEditing(false)}
          onConfirm={() => setEditing(false)}
        />,
        document.body,
      )}

      {deleting &&
        createPortal(
        <PrmModal
          title="Delete Task?"
          description={`"${task.name}" will be deleted, not just removed from this Course. This can't be undone.`}
          confirmLabel="Delete Task"
          danger
          onCancel={() => setDeleting(false)}
          onConfirm={() => { setDeleting(false); onRemove(); }}
        />,
        document.body,
      )}
    </div>
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
      width="auto"
      panelClass="ctb-menu"
      direction="up"
      trigger={({ toggle }) => (
        <button className="ctb-add-sub" onClick={toggle}>
          <PlusThinIcon />
          {label}
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

/* The Add Task menu (Figma 1259:1673 "3-Dot Menu - Add Task to Certification"):
   Create New Task first — with the circle-plus, not a bare one — then the
   singular Add Existing Task. Picking "create" swaps the panel for the Task
   type list. */
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
        <button className="menu-item" onClick={() => setMode("create")}>
          <span className="menu-item-icon"><AddCircleIcon /></span>
          Create New Task
        </button>
        <button className="menu-item" onClick={onAddExisting}>
          <span className="menu-item-icon"><SearchIcon /></span>
          Add Existing Task
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
/* ─────────────────  Step 4: Completion  ───────────────── */

// Temporary GUI cap (spec 7.3.7.1) — V1 needs at most 2 Condition Sets; more
// can be enabled later. Raised to 4 with the 2026-09-17 re-sync: 853:1553 now
// draws a fourth set (856:1824), so three is no longer the ceiling.
const MAX_CONDITION_SETS = 4;

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
    update({ conditionSets: [...sets, newConditionSet()] });
  }

  // Added as a batch: the picker is a modal that can return several
  // requirements at once, and one update has to carry all of them.
  function addItems(setId: string, items: CompletionItem[]) {
    if (items.length === 0) return;
    update({
      conditionSets: sets.map((s) =>
        s.id === setId ? { ...s, items: [...s.items, ...items] } : s,
      ),
    });
  }

  function removeConditionSet(id: string) {
    update({ conditionSets: sets.filter((s) => s.id !== id) });
  }

  // Clearing out a Condition Set's last requirement drops the set too, the same
  // as its header minus. A set added but never filled in stays put, so there is
  // somewhere to add the first requirement.
  function removeItem(setId: string, itemId: string) {
    update({
      conditionSets: sets.flatMap((s) => {
        if (s.id !== setId) return [s];
        const items = s.items.filter((i) => i.id !== itemId);
        return items.length > 0 ? [{ ...s, items }] : [];
      }),
    });
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label cc-label">
          Completion Criteria <span className="req">*</span>
        </label>
        <CompletionCriteriaGate locked={criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
          <div className="cc-stack">
            {sets.length > 0 && (
              <div className="cc-sets">
                {sets.map((set, idx) => (
                  <Fragment key={set.id}>
                    {idx > 0 && (
                      <div className="cc-or">
                        <div className="cc-or-lead">
                          <span>OR</span>
                        </div>
                      </div>
                    )}
                    <ConditionSetCard
                      set={set}
                      index={idx + 1}
                      onRemove={() => removeConditionSet(set.id)}
                      onAddItems={(items) => addItems(set.id, items)}
                      onRemoveItem={(itemId) => removeItem(set.id, itemId)}
                    />
                  </Fragment>
                ))}
              </div>
            )}

            <button
              type="button"
              className={`cc-add-set${missing && sets.length === 0 ? " has-error" : ""}`}
              onClick={addConditionSet}
              disabled={atCap}
            >
              <span className="cc-add-icon">
                <PlusThinIcon />
              </span>
              Add Condition Set
            </button>
          </div>
        </CompletionCriteriaGate>

        {missing && (
          <p className="form-error-text">
            Add at least one Condition Set with a requirement to publish.
          </p>
        )}

        <p className="form-help">
          Learner must satisfy any one Condition Set in full. Within the Condition Set, all items
          must be completed.
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

// The muted suffix that trails a requirement's name on its row ("· Quiz Task"),
// per Figma 853:1553. Every requirement names its own type, so the old coloured
// letter badge is gone.
const ITEM_TASK_META: Record<TaskKind, string> = {
  xapi: "xAPI Task",
  quiz: "Quiz Task",
  "hands-on": "Hands-On Task",
  file: "Resource Task",
};

function itemMeta(item: CompletionItem): string {
  if (item.kind === "task") return ITEM_TASK_META[item.taskKind];
  if (item.kind === "quiz-section") return "Quiz Section";
  return "Certification";
}

// One Condition Set = one panel. The header names the set (and, once it holds
// more than one requirement, spells out that ALL of them are required), the
// body lists the requirements, and the last row is the "+ Add Requirement"
// action — every one of them a row of the same clipped surface. The header's
// 12px minus drops the whole set; the 16px ✕ on a row drops that requirement.
function ConditionSetCard({
  set,
  index,
  onRemove,
  onAddItems,
  onRemoveItem,
}: {
  set: ConditionSet;
  index: number;
  onRemove: () => void;
  onAddItems: (items: CompletionItem[]) => void;
  onRemoveItem: (itemId: string) => void;
}) {
  // "+ Add Requirement" opens the shared table picker (Select Tasks / Select
  // Questions chrome) rather than the 340px dropdown it used to open.
  const [picking, setPicking] = useState(false);

  return (
    <>
    <div className="cc-panel">
      <div className="cc-row cc-row-head">
        <div className="cc-head-text">
          <span>CONDITION SET {index}</span>
          {set.items.length > 1 && (
            <span>
              · COMPLETE <strong>ALL</strong> OF THESE:
            </span>
          )}
        </div>
        <button
          className="cc-head-x"
          onClick={onRemove}
          title="Remove Condition Set"
          aria-label={`Remove Condition Set ${index}`}
        >
          <MinusThinIcon />
        </button>
      </div>

      {set.items.map((item) => (
        <div key={item.id} className="cc-row">
          <div className="cc-row-main">
            <span className="cc-row-name">{item.name}</span>
            <span className="cc-row-meta">· {itemMeta(item)}</span>
          </div>
          <button
            className="cc-row-x"
            onClick={() => onRemoveItem(item.id)}
            aria-label={`Remove ${item.name}`}
          >
            <SmallXIcon />
          </button>
        </div>
      ))}

      <div className="cc-row cc-row-foot">
        <button className="cc-add-req" onClick={() => setPicking(true)}>
          <span className="cc-add-icon">
            <PlusThinIcon />
          </span>
          Add Requirement
        </button>
      </div>
    </div>

    {/* Portalled to <body>: the panel clips to its 12px radius, and the
        wizard's step container is transformed, which would otherwise turn the
        overlay's position:fixed into a local box (the same gotcha the Task
        wizard's Select Questions hits). */}
    {picking &&
      createPortal(
        <SelectRequirementModal
          existingNames={set.items.map((i) => i.name)}
          onCancel={() => setPicking(false)}
          onConfirm={(picks) => {
            onAddItems(picks.map(pickToItem));
            setPicking(false);
          }}
        />,
        document.body,
      )}
    </>
  );
}

/** The picker hands back source rows; the Condition Set stores its own items. */
function pickToItem(pick: RequirementPick): CompletionItem {
  return pick.kind === "task"
    ? {
        kind: "task",
        id: nodeId("it"),
        name: pick.task.name,
        taskKind: TASK_TYPE_TO_KIND[pick.task.type],
      }
    : { kind: "cert", id: nodeId("it"), name: pick.cert.name };
}

/* ─────────────────  Step 5: Paywall  ───────────────── */

function PaywallStep({
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
          <label className="form-label">Product IDs</label>
          <PriceIdFields
            value={data.priceIds}
            onChange={(ids) => update({ priceIds: ids })}
          />
          <p className="form-help">Enter the Product IDs from the respective stores.</p>
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
    </>
  );
}

/* ─────────────────  Step 6: Audience  ───────────────── */

/* The step edits `contentTags` through three flat wizard fields. Audience is the
   All / B2B-only switch, which is one `userType` tag or none; Trade and
   Partnership take any number of values (MultiSelect). */
const AUDIENCE_ALL = "All Users";
const AUDIENCE_B2B = "B2B Companies Only";
const AUDIENCE_OPTIONS = [AUDIENCE_ALL, AUDIENCE_B2B] as const;

function AudienceStep({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  const valuesOf = (type: ContentTagType) =>
    data.contentTags.filter((t) => t.type === type).map((t) => t.value);

  /** Replace every tag of one type, keeping the ids of the values that stay. */
  function setValues(type: ContentTagType, values: string[]) {
    const kept = new Map(
      data.contentTags.filter((t) => t.type === type).map((t) => [t.value, t.id]),
    );
    update({
      contentTags: [
        ...data.contentTags.filter((t) => t.type !== type),
        ...values.map((value, i) => ({
          id: kept.get(value) ?? `ct-${type}-${Date.now()}-${i}`,
          type,
          value,
        })),
      ],
    });
  }

  // The stored tag value stays "B2B Only" — the label is the display name.
  const audience = valuesOf("userType").length > 0 ? AUDIENCE_B2B : AUDIENCE_ALL;

  return (
    <>
      <div className="form-group">
        <label className="form-label">Audience</label>
        <SelectField
          className="select-field--full"
          value={audience}
          options={AUDIENCE_OPTIONS}
          onChange={(v) =>
            setValues("userType", v === AUDIENCE_B2B ? [USER_TYPE_VALUES[0]] : [])
          }
        />
        <p className="form-help">
          Choose "B2B Companies Only" to hide this Certification from B2C users. "All
          Users" means no audience restriction. B2C is still excluded if you set a Trade
          or Partnership below.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Trade</label>
        <MultiSelect
          options={DEFAULT_TRADES}
          value={valuesOf("trade")}
          onChange={(v) => setValues("trade", v)}
          placeholder="Select Trades"
          searchPlaceholder="Search Trades..."
        />
        <p className="form-help">
          Only companies tagged with a Trade you pick will see this Certification. Picking
          more than one Trade widens the audience — a company needs to match just one.
          Leave blank so every company can see it.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Partnership</label>
        <MultiSelect
          options={DEFAULT_PARTNERSHIPS}
          value={valuesOf("partnership")}
          onChange={(v) => setValues("partnership", v)}
          placeholder="Select Partnerships"
          searchPlaceholder="Search Partnerships..."
        />
        <p className="form-help">
          Only companies in a Partnership you pick will see this Certification. Picking
          more than one widens the audience — a company needs to match just one. Leave
          blank so every company can see it, partnered or not.
        </p>
      </div>
    </>
  );
}

/* ─────────────────  Archive & Replace (full page)  ───────────────── */

const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

/* Archiving used to be the Cert wizard's 7th step, shown only while editing.
   It's now reached from the Certifications row menu's "Archive & Replace"
   (Figma 735:1454) and renders as its own full-page view: the shared wizard
   shell minus the step rail, so there are no two panels — just the form and
   the footer. */
export function ArchiveCertificationPage({
  cert,
  onClose,
  onArchive,
}: {
  cert: Certification;
  onClose: () => void;
  /** Commits the archive — the caller flips the Cert's visibility to Archived. */
  onArchive: () => void;
}) {
  // Replacements are a plain multi-select over Certification names — the field
  // is the shared MultiSelect (Figma 591:1322), so the chosen Certs live as its
  // pills rather than in a separate list. Names are unique in the catalog, so
  // the value can stay the display string the component works in.
  const [replacementCerts, setReplacementCerts] = useState<string[]>([]);
  const replacementOptions = useMemo(
    () => certifications.filter((c) => c.id !== cert.id).map((c) => c.name),
    [cert.id],
  );
  const [alertEn, setAlertEn] = useState("");
  const [alertEs, setAlertEs] = useState("");
  // Archiving is permanent, so the destructive CTA stays disabled until the
  // admin has explicitly acknowledged it — the same gate the step's toggle was.
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="wizard">
      <div className="wizard-body">
        <div className="wizard-main">
          <div className="wizard-content">
            <div className="wizard-pane">
              <h1 className="wizard-title">Archive &amp; Replace</h1>
              <p className="wizard-desc">
                Retire “{cert.name}” ({cert.id}) and point enrolled learners to a
                replacement. Archiving is permanent.
              </p>

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
                      className={`toggle ${confirmed ? "on" : ""}`}
                      onClick={() => setConfirmed((v) => !v)}
                      aria-pressed={confirmed}
                    >
                      <span className="toggle-knob" />
                    </button>
                    <span className="toggle-state">{confirmed ? "Yes" : "No"}</span>
                  </div>
                  <p className="toggle-sub">
                    Retires the Certification and removes it from the catalog. This action is
                    permanent and cannot be undone.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Replacement Certifications</label>
                <MultiSelect
                  options={replacementOptions}
                  value={replacementCerts}
                  onChange={setReplacementCerts}
                  placeholder="Select Certifications"
                  searchPlaceholder="Search Certifications..."
                />
                <p className="form-help">When this Cert is archived, learners are pointed to the replacement(s) in their Path.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Replacement Alert</label>
                <RichTextField
                  en={alertEn}
                  es={alertEs}
                  onChangeEn={setAlertEn}
                  onChangeEs={setAlertEs}
                />
                <p className="form-help">
                  Shown to enrolled learners only when this Cert is archived. Different from the general Announcement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          <button className="btn-publish" disabled={!confirmed} onClick={onArchive}>
            Archive Certification
          </button>
        </div>
      </footer>
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
  autoFocus,
  onEnter,
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
  /** Takes the caret on mount — the first field of a modal form. */
  autoFocus?: boolean;
  /** Enter from either language row submits (modal forms only; on a wizard
   *  step Enter belongs to the footer's own shortcut). */
  onEnter?: () => void;
}) {
  const onKeyDown = onEnter
    ? (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        }
      }
    : undefined;
  return (
    <>
      <div className={`lang-field ${error ? "has-error" : ""}`}>
        <div className="lang-field-row">
          <span className="lang-tag">EN</span>
          <input
            className="lang-field-input"
            autoFocus={autoFocus}
            value={en}
            placeholder={placeholderEn}
            aria-invalid={error || undefined}
            onChange={(e) => onChangeEn(e.target.value)}
            onKeyDown={onKeyDown}
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
            onKeyDown={onKeyDown}
          />
        </div>
      </div>
      {error && errorMessage && <p className="form-error-text">{errorMessage}</p>}
    </>
  );
}

export type { WizardData as CertWizardData, CertCourse, CertTask, TaskKind };
