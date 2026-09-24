import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import requiresSubscriptionIcon from "../assets/requires-subscription.svg";
import { InfoTipIcon, SmallXIcon } from "./icons";
import { ImageUploadField, type PickedImage } from "./ImageUploadField";
import { RichTextField } from "./RichTextField";
import { CertSplitTaskWizard } from "./CertSplitTaskWizard";
import { Dropdown } from "./Dropdown";
import { useTipWhileClosed } from "./HoverTooltip";
import { SearchIcon, AddCircleIcon, ChevronRightIcon, LockIcon, DragHandleIcon, RowKebabIcon, PlusThinIcon, MinusThinIcon, PencilIcon } from "./icons";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import { SelectField } from "./SelectField";
import { type TaskTypeKey, TASK_TYPE_OPTIONS } from "./Footer";
import { PrmModal } from "./PrmModal";
import { SelectRequirementModal, type RequirementPick } from "./SelectRequirementModal";
import { SelectCertificationsModal } from "./SelectCertificationsModal";
import { MultiSelect } from "./NewCompanyWizard";
import { ConfirmCard, type ConfirmField } from "./ConfirmCard";
import { CopiedToast } from "./CopiedToast";
import {
  type Certification,
  certifications,
  CERT_BY_USEDIN,
  formatTimeToComplete,
} from "../data/certifications";
import type { CertImportReport, ImportedCertCourse, ImportedCertTask } from "../data/certImport";
import { nodes as contentNodes, type ContentNode } from "../data/contentLinks";
import { industries } from "../data/industries";
import { tasks as taskLibrary, formatTaskDuration, type Task, type TaskType } from "../data/tasks";
import { DEFAULT_PARTNERSHIPS, DEFAULT_TRADES } from "../data/productConfig";
import { AUDIENCE_B2B_ONLY, PARTNERSHIP_TAGS, TRADE_TAGS, pickTags } from "../data/filters";
import { PriceIdFields, PRICE_CHANNELS, newPriceIds, type PriceIds } from "./PriceIdFields";

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
// selected prerequisite Tasks; a prerequisite counts once it is Completed.
type AccessRestriction = {
  enabled: boolean;
  mode: "all" | "any";
  taskIds: string[];
};

type CertTask = {
  id: string;
  name: string;
  kind: TaskKind;
  /** The Task's length as its row shows it ("12 mins"). Absent when the Task
   *  has none, and then the row names only its type. */
  duration?: string;
  restriction?: AccessRestriction;
  /** True when the Task needs a paid subscription — it can't be taken on the
   *  Free Trial. Surfaced as the row's "Requires Subscription" tag. Copied from
   *  the library Task, or answered in the Task wizard for one created here. */
  requiresSubscription?: boolean;
  /** The Certifications the underlying library Task already belongs to. A Task
   *  reused from the library can't be deleted outright (1246:2666) — only
   *  removed from this Course. Absent on a Task created here, which nothing
   *  else owns yet. */
  usedIn?: string[];
};

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

// Drag context: which sibling list ("scope") the in-flight item belongs to, its
// id, and where its grip sat when the drag began — a target below that lands
// the item AFTER itself, one above lands it before (see reorderList). Drops are
// only honoured within the same scope.
type DragCtx = { scope: string; id: string; top: number };

// Props for a draggable handle + its droppable row, wired to a shared drag state.
// `handle` goes on the DragDots grip; `target` goes on the row that can receive a
// drop. Only same-scope drags are accepted.
type DndProps = {
  handle: React.HTMLAttributes<HTMLElement> & { draggable: boolean };
  /** `data-drop` marks the block being dragged over — the side the item will
      land on — so CSS can draw the orange drop line there. */
  target: React.HTMLAttributes<HTMLElement> & { "data-drop"?: "before" | "after" };
};

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 2.92M6.6 6.6A13.3 13.3 0 0 0 2 12s3.5 7 10 7a9.3 9.3 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a2.6 2.6 0 0 0 3.7 3.7" />
    <path d="M2 2l20 20" />
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
  hidden: boolean;
  tasks: CertTask[];
};

/** The four bilingual fields the Course/Lesson modal edits — everything else
    about a node (its children, hidden) is set from the tree, not the
    modal. Courses and Lessons carry the same four. */
type NodeDraft = Pick<CertLesson, "nameEn" | "nameEs" | "descEn" | "descEs">;

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
  return { id: nodeId("le"), nameEn: "", nameEs: "", descEn: "", descEs: "", hidden: false, tasks: [] };
}

// Convert a Task from the library into the lightweight CertTask the tree stores.
function libraryTaskToCertTask(t: Task): CertTask {
  const kind = TASK_TYPE_TO_KIND[t.type];
  // Only a couple of seeded library Tasks carry a Time to Complete, so the
  // rest fall back to their type's sample length — the same fallback the
  // Certifications drawer (data/certPreview) uses.
  const duration = formatTaskDuration(t.timeToComplete) || DURATION_BY_KIND[kind];
  return { id: nodeId("t"), name: t.name, kind, duration, requiresSubscription: t.requiresSubscription, usedIn: t.usedIn };
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

// The library Tasks a Certification is built from. `usedIn` names a
// Certification by its full name or by a short alias ("NATE RTW"), so match
// through the shared resolver, not on the name alone. One with none falls back
// to the first few library Tasks, so a sample structure is never empty. A final
// exam goes last — after the Lesson, where a learner would meet it — rather
// than wherever the library happens to list it.
function associatedTasks(cert: Certification): Task[] {
  const matched = taskLibrary.filter((t) =>
    t.usedIn.some((u) => CERT_BY_USEDIN.get(u)?.id === cert.id),
  );
  const list = matched.length > 0 ? matched : taskLibrary.slice(0, 4);
  return [...list.filter((t) => !t.finalExam), ...list.filter((t) => t.finalExam)];
}

// Existing Certifications don't persist their structure, so when editing we
// populate plausible sample data: Tasks already associated with the Cert (by
// name or alias) become a Course with a Lesson, and the final-exam-like Task
// seeds one Completion Condition Set.
function buildSampleStructure(editing: Certification): {
  courses: CertCourse[];
  conditionSets: ConditionSet[];
} {
  const associated = associatedTasks(editing);

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

// Build the Course(s) a single imported Certification contributes to a Learning
// Plan. Source Certs don't persist their real Course breakdown, so we synthesize
// one Course carrying the Cert's name and description (the same sample approach
// buildSampleStructure uses), tagged with its origin. Tasks are pulled from the
// library and REUSED — no new Tasks are created (spec 2.3.2 Reusability).
function buildImportedCourses(cert: Certification): CertCourse[] {
  const associated = associatedTasks(cert);

  const certTasks = associated.map(libraryTaskToCertTask);
  const lessonTasks = certTasks.slice(0, Math.min(3, certTasks.length));
  const looseTasks = certTasks.slice(lessonTasks.length);

  const course: CertCourse = {
    id: nodeId("co"),
    nameEn: cert.name,
    nameEs: "",
    descEn: cert.description ?? "",
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
          hidden: false,
          tasks: lessonTasks,
        },
      },
      ...looseTasks.map((task) => ({ kind: "task" as const, task })),
    ],
  };

  return [course];
}

// A checked CSV Upload (data/certImport.ts) as the tree's own nodes. A row whose
// name is already in the Task library reuses that Task, exactly as "Add
// Existing Task" would; any other row is a new Task of its type, as "Create
// New" makes one — no length until one is set, nothing else owns it yet.
function coursesFromImport(imported: ImportedCertCourse[]): CertCourse[] {
  const toTask = (t: ImportedCertTask): CertTask => {
    if (t.libraryTask) return libraryTaskToCertTask(t.libraryTask);
    const kind = TASK_TYPE_TO_KIND[t.type];
    return { id: nodeId("t"), name: t.name, kind };
  };
  return imported.map((co) => ({
    ...newCourse(),
    nameEn: co.nameEn,
    nameEs: co.nameEs,
    descEn: co.descEn,
    descEs: co.descEs,
    children: co.children.map((ch): CourseChild =>
      ch.kind === "task"
        ? { kind: "task", task: toTask(ch.task) }
        : {
            kind: "lesson",
            lesson: {
              ...newLesson(),
              nameEn: ch.lesson.nameEn,
              nameEs: ch.lesson.nameEs,
              descEn: ch.lesson.descEn,
              descEs: ch.lesson.descEs,
              tasks: ch.lesson.tasks.map(toTask),
            },
          },
    ),
  }));
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

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// A Stripe-shaped Price ID ("price_" + 24 characters), stable for its seed:
// FNV-1a seeds an xorshift stream, so each Certification keeps its own ID.
function samplePriceId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let id = "price_1";
  while (id.length < 30) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    id += BASE62[(h >>> 0) % 62];
  }
  return id;
}

// The list record doesn't store a paid Certification's store Product IDs
// either, so like its structure they're plausible sample values: bundle-style
// IDs for the two stores, Stripe-shaped ones for the two Stripe prices.
function samplePriceIds(cert: Certification): PriceIds {
  const slug = slugify(cert.name).toLowerCase();
  return {
    appleB2c: `com.skillcat.cert.${slug}`,
    googleB2c: `cert_${slug}`,
    stripeB2c: samplePriceId(`${cert.id}-b2c`),
    stripeB2b: samplePriceId(`${cert.id}-b2b`),
  };
}

// The record's tags as the Audience step's three fields: its "B2B Companies
// Only" tag is the User Type value, and the rest split into Trades and
// Partnerships.
function recordContentTags(tags: string[] | undefined): ContentTag[] {
  const out: ContentTag[] = [];
  if (tags?.includes(AUDIENCE_B2B_ONLY)) {
    out.push({ id: "ct-userType-0", type: "userType", value: USER_TYPE_VALUES[0] });
  }
  pickTags(tags, TRADE_TAGS).forEach((value, i) =>
    out.push({ id: `ct-trade-${i}`, type: "trade", value }),
  );
  pickTags(tags, PARTNERSHIP_TAGS).forEach((value, i) =>
    out.push({ id: `ct-partnership-${i}`, type: "partnership", value }),
  );
  return out;
}

// When editing, prefill the fields the Certification record actually carries.
// Structural data (courses, completion) isn't stored on the list record, so for
// existing Certifications we populate plausible sample data instead.
function buildInitialData(editing?: Certification): WizardData {
  // A new Certification opens on zero Courses — the Add Tasks step greets it
  // with "Create your first Course" rather than a pre-made "Untitled Course".
  // The Condition Set is still seeded, empty: the Admin fills it from
  // "+ Add Requirement".
  if (!editing) return { ...BLANK_DATA, conditionSets: [newConditionSet()] };
  const vis = editing.visibility ?? "Visible";
  const sample = buildSampleStructure(editing);
  return {
    ...BLANK_DATA,
    courses: sample.courses,
    conditionSets: sample.conditionSets,
    nameEn: editing.name,
    descEn: editing.description ?? "",
    timeValue: editing.timeToComplete ? String(editing.timeToComplete.value) : "",
    timeUnit: editing.timeToComplete?.unit ?? BLANK_DATA.timeUnit,
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
    // The paywall and the audience tags the record carries — without these a
    // paid or B2B-only Certification opened as free and open to everyone.
    accessType:
      editing.payment === "Consumable"
        ? "consumable"
        : editing.payment === "Non-consumable"
          ? "non-consumable"
          : "open",
    consumableProgress: editing.resetsProgress ? "reset" : "preserve",
    priceIds: editing.payment ? samplePriceIds(editing) : newPriceIds(),
    contentTags: recordContentTags(editing.tags),
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

type Props = {
  onClose: () => void;
  editingCert?: Certification;
  /** A checked CSV Upload — the new Certification opens with its Courses,
   *  Lessons, and Tasks already built. */
  imported?: CertImportReport;
};

export function NewCertificationWizard({ onClose, editingCert, imported }: Props) {
  const isEditing = !!editingCert;
  const steps = STEPS;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => {
    const initial = buildInitialData(editingCert);
    return imported ? { ...initial, courses: coursesFromImport(imported.courses) } : initial;
  });
  // The CSV Upload's acknowledgment — the Question Bank raises the same toast
  // when its bulk upload lands. Stable `onDone`, so typing into the Details
  // step (a re-render per keystroke) doesn't keep restarting its timer.
  const [toast, setToast] = useState<string | null>(() =>
    imported
      ? `${imported.rows.length} ${imported.rows.length === 1 ? "Task" : "Tasks"} Imported`
      : null,
  );
  const clearToast = useCallback(() => setToast(null), []);
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
     closes straight away rather than nagging about nothing. An imported
     structure is work already done, so it counts against the empty wizard —
     Cancel asks before throwing a CSV's Courses away. */
  const pristine = useRef(imported ? { ...data, courses: [] } : data);
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
        taskType={splitTask.taskType}
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
          {/* Inside `.wizard-main`, so it lands above the footer, not on the
              Create button. */}
          {toast && <CopiedToast label={toast} onDone={clearToast} />}
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
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

      {/* "Add Existing Task" runs on the shared table picker, Tasks only — the
          modal Completion Criteria's Add Requirement and Feedback Forms' Add
          Tasks already use — at full screen, like Import Courses, this step's
          other picker. It lists every library Task, company-created ones
          included (`allCreators`). Tasks already in the Certification open
          ticked and locked: a library Task is reused, never added twice. Portalled like
          the step's other modals. */}
      {existingPicker &&
        createPortal(
          <SelectRequirementModal
            only="task"
            full
            allCreators
            title="Add Existing Tasks"
            description={`Adding to ${destinationLabel(data.courses, existingPicker)}. Library Tasks are reused, not duplicated.`}
            confirmNoun="Task"
            existingNames={flattenTasks(data.courses).map((t) => t.name)}
            lockedTip="Already in this Certification"
            onPreviewTask={previewTaskInNewTab}
            onCancel={() => setExistingPicker(null)}
            onConfirm={(picks) => {
              picks.forEach((p) => {
                if (p.kind === "task") {
                  appendTask(existingPicker.courseId, existingPicker.lessonId, libraryTaskToCertTask(p.task));
                }
              });
              setExistingPicker(null);
            }}
          />,
          document.body,
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
/** The picker's row-end Preview: its own tab, so the builder behind the picker
 *  keeps its place — for now the `?taskPreview=` placeholder page (App.tsx). */
function previewTaskInNewTab(task: Task) {
  window.open(
    `${window.location.origin}${window.location.pathname}?taskPreview=${encodeURIComponent(task.id)}`,
    "_blank",
    "noopener",
  );
}

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

// The mono suffix that trails a Task's name on the tree ("·xAPI"), and the
// glyph that leads it. Replaced the old type-coloured gutter column — the row
// names its type twice, once as an icon and once as this label.
const KIND_MONO: Record<TaskKind, string> = {
  xapi: "xAPI",
  quiz: "Quiz",
  "hands-on": "Hands-On Task",
  file: "Resource",
};


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
// The length is only ever a DURATION — a Quiz shows its minutes like any other
// Task, never a question count. A Task with no length reads as its type alone.
function taskMeta(t: CertTask): string {
  const kind = KIND_MONO[t.kind];
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
  // The open Course modal, or null. `course: null` = adding a new Course; a
  // Course = editing that one. Same model as the Lesson modal below.
  const [courseModal, setCourseModal] = useState<{ course: CertCourse | null } | null>(null);
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
  // The block under an in-flight drag, and which of its edges the item lands on.
  const [dropAt, setDropAt] = useState<{ id: string; pos: "before" | "after" } | null>(null);

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
        dragRef.current = { scope, id, top: e.currentTarget.getBoundingClientRect().top };
        e.dataTransfer.effectAllowed = "move";
        // Firefox requires data to be set for a drag to begin.
        e.dataTransfer.setData("text/plain", id);
      },
      onDragEnd: () => {
        dragRef.current = null;
        setDropAt(null);
      },
    },
    target: {
      "data-drop": dropAt?.id === id ? dropAt.pos : undefined,
      onDragOver: (e) => {
        const d = dragRef.current;
        if (d && d.scope === scope && d.id !== id) {
          e.preventDefault();
          // Claimed here, so an enclosing block of another list (a Lesson
          // around its own Tasks) doesn't also light up.
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          const pos = e.currentTarget.getBoundingClientRect().top > d.top ? "after" : "before";
          if (dropAt?.id !== id || dropAt.pos !== pos) setDropAt({ id, pos });
        }
      },
      onDragLeave: (e) => {
        if (dropAt?.id === id && !e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDropAt(null);
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
        setDropAt(null);
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
      // Hand-added Courses stay, after the imported ones.
      courses: [...importedCourses, ...manual],
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
    const idx = data.courses.findIndex((c) => c.id === id);
    const rest = data.courses.filter((c) => c.id !== id);
    update({ courses: rest });
    // Land on the neighbour that took the deleted Course's slot — or on nothing,
    // once the last Course is gone.
    if (id === course?.id) {
      setSelectedId(rest.length > 0 ? rest[Math.min(idx, rest.length - 1)].id : null);
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
  function saveLesson(vals: NodeDraft) {
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

  // Save from the Course modal — like `saveLesson`, a new Course only reaches
  // the tree on Save (and becomes the selected one); otherwise the Course being
  // edited is patched.
  function saveCourse(vals: NodeDraft) {
    if (!courseModal) return;
    const { course: editing } = courseModal;
    if (editing) {
      updateCourse(editing.id, vals);
    } else {
      const c = { ...newCourse(), ...vals };
      update({ courses: [...data.courses, c] });
      setSelectedId(c.id);
    }
    setCourseModal(null);
  }

  const addCourse = () => setCourseModal({ course: null });

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
      {/* Zero Courses — where every new Certification starts. The two panels
          merge into one centred pane with the two ways in: make a Course, or
          copy Courses over from another Certification. Built from existing
          parts only: the wizard's eyebrow/title/description, and the shared
          `.note-card` callout (accent tone for the primary) as the two cards. */}
      {data.courses.length === 0 ? (
        <div className="ctb ctb--empty">
          <div className="ctb-start">
            <span className="wizard-brand-eyebrow">Add Tasks</span>
            <h1 className="wizard-title">Build the Certification</h1>
            <p className="wizard-desc">
              A Certification is made of Courses. Each Course holds Lessons and Tasks. Start with
              one Course, or bring Courses over from a Certification you have already built.
            </p>
            <div className="ctb-start-cards">
              <button
                type="button"
                className="note-card note-card--accent ctb-start-card"
                onClick={addCourse}
              >
                <span className="note-card-icon"><PlusThinIcon /></span>
                <span className="note-card-text">
                  <span className="note-card-title">Create a Course</span>
                  <span className="note-card-body">Name it now; add Lessons and Tasks next.</span>
                </span>
              </button>
              <button
                type="button"
                className="note-card ctb-start-card"
                onClick={() => setImporting(true)}
              >
                <span className="note-card-icon"><ImportCoursesIcon /></span>
                <span className="note-card-text">
                  <span className="note-card-title">Import Courses</span>
                  <span className="note-card-body">
                    Copy Courses from another Certification. Tasks are reused, not copied.
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : (
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
          {course && (
            <CoursePane
              key={course.id}
              course={course}
              index={courseIdx + 1}
              allTasks={allTasks}
              dnd={dnd}
              onUpdateTask={updateTaskById}
              onRemoveTask={removeTaskById}
              onToggleHidden={() => updateCourse(course.id, { hidden: !course.hidden })}
              onOpenEditor={() => setCourseModal({ course })}
              onRemove={() => removeCourse(course.id)}
              onCreateTask={(taskType) => onCreateTask(course.id, undefined, taskType)}
              onAddExistingTask={() => onAddExisting(course.id, undefined)}
              onAddLesson={() => setLessonModal({ courseId: course.id, lesson: null })}
              onCreateTaskInLesson={(lessonId, taskType) => onCreateTask(course.id, lessonId, taskType)}
              onAddExistingTaskInLesson={(lessonId) => onAddExisting(course.id, lessonId)}
              onToggleLessonHidden={(lessonId) =>
                mapLesson(course.id, lessonId, (l) => ({ ...l, hidden: !l.hidden }))
              }
              onOpenLessonEditor={(lesson) => setLessonModal({ courseId: course.id, lesson })}
              onRemoveLesson={(lessonId) => removeLesson(course.id, lessonId)}
            />
          )}
        </section>
      </div>
      )}

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

      {courseModal &&
        createPortal(
        <NodeModal
          kind="Course"
          node={courseModal.course}
          // The first Course usually shares the Certification's name, so it's
          // offered as the placeholder and Tab takes it.
          suggestion={
            !courseModal.course && data.courses.length === 0 && data.nameEn.trim()
              ? { en: data.nameEn, es: data.nameEs }
              : undefined
          }
          onCancel={() => setCourseModal(null)}
          onSave={saveCourse}
        />,
        document.body,
      )}

      {lessonModal &&
        createPortal(
        <NodeModal
          kind="Lesson"
          node={lessonModal.lesson}
          onCancel={() => setLessonModal(null)}
          onSave={saveLesson}
        />,
        document.body,
      )}
    </>
  );
}

/* Course or Lesson name + description — one standard modal on the shared
   `PrmModal` shell (Figma 483:588). A Course opens it from "Create Course" /
   "Add Course" in the Courses panel and "Edit" in its More menu; a Lesson from
   "Add Lesson" in the Course footer and "Edit" in its kebab.

   Both fields are the app's bilingual controls — the `LangField` EN/ES pair for
   the name, the shared `RichTextField` for the description, which is rich text.

   The draft lives here and only reaches the tree on Save, so cancelling an add
   leaves nothing behind. The English name is required: it's what the Courses
   panel and the Lesson row print. */
const NODE_MODAL_COPY = {
  Course: "Courses are the sections of a Certification. Each holds Lessons and Tasks.",
  Lesson: "Lessons group the Tasks that follow them inside a Course.",
} as const;

function NodeModal({
  kind,
  node,
  suggestion,
  onCancel,
  onSave,
}: {
  kind: "Course" | "Lesson";
  /** The Course/Lesson being edited, or null when adding one. */
  node: NodeDraft | null;
  /** A name to offer in the Name field (see `LangField`'s `suggestion`). */
  suggestion?: { en: string; es: string };
  onCancel: () => void;
  onSave: (vals: NodeDraft) => void;
}) {
  const [draft, setDraft] = useState<NodeDraft>({
    nameEn: node?.nameEn ?? "",
    nameEs: node?.nameEs ?? "",
    descEn: node?.descEn ?? "",
    descEs: node?.descEs ?? "",
  });
  const patch = (p: Partial<NodeDraft>) => setDraft((d) => ({ ...d, ...p }));
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
      title={node ? `Edit ${kind}` : `New ${kind}`}
      description={NODE_MODAL_COPY[kind]}
      confirmLabel={node ? `Save ${kind}` : `Add ${kind}`}
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
            placeholderEn={`${kind} name`}
            placeholderEs="Nombre"
            suggestion={suggestion}
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

// A Course's children in render order, one block each: a Lesson (numbered
// among the Lessons), or a loose Task — one pinned straight to the Course
// rather than to a Lesson — which is a block of its own (Figma 1259:1622).
// Consecutive loose Tasks never share one.
type CourseGroup =
  | { kind: "task"; key: string; task: CertTask }
  | { kind: "lesson"; key: string; lesson: CertLesson; num: number };

function groupChildren(children: CourseChild[]): CourseGroup[] {
  let lessonNum = 0;
  return children.map((ch): CourseGroup =>
    ch.kind === "task"
      ? { kind: "task", key: ch.task.id, task: ch.task }
      : { kind: "lesson", key: ch.lesson.id, lesson: ch.lesson, num: ++lessonNum },
  );
}

// The right pane: the selected Course's header (eyebrow · name · description ·
// kebab), then one block per child — a Lesson with its Tasks, closed by an
// "Add Tasks" row, or a loose Task as a block of its own — and the Add Lesson /
// Add Task footer.
function CoursePane({
  course,
  index,
  allTasks,
  dnd,
  onUpdateTask,
  onRemoveTask,
  onToggleHidden,
  onOpenEditor,
  onRemove,
  onCreateTask,
  onAddExistingTask,
  onAddLesson,
  onCreateTaskInLesson,
  onAddExistingTaskInLesson,
  onToggleLessonHidden,
  onOpenLessonEditor,
  onRemoveLesson,
}: {
  course: CertCourse;
  index: number;
  allTasks: CertTask[];
  dnd: (scope: string, id: string) => DndProps;
  onUpdateTask: (taskId: string, patch: Partial<CertTask>) => void;
  onRemoveTask: (taskId: string) => void;
  onToggleHidden: () => void;
  /** Opens the Course modal on this Course ("Edit" in its More menu). */
  onOpenEditor: () => void;
  onRemove: () => void;
  onCreateTask: (taskType: TaskTypeKey) => void;
  onAddExistingTask: () => void;
  onAddLesson: () => void;
  onCreateTaskInLesson: (lessonId: string, taskType: TaskTypeKey) => void;
  onAddExistingTaskInLesson: (lessonId: string) => void;
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

      {/* `is-single`: one child means nothing to drag against — see .ctb-list. */}
      <div className={`ctb-groups${course.children.length === 1 ? " is-single" : ""}`}>
        {course.children.length === 0 && (
          <div className="ctb-empty">No Tasks yet — add a Task or a Lesson to get started.</div>
        )}

        {groups.map((g) =>
          g.kind === "task" ? (
            // A loose Task is a block of its own (Figma 1259:1622). More are
            // added from the footer's "Add Task Directly to Lesson".
            <TaskRow
              key={g.key}
              inCourse
              task={g.task}
              allTasks={allTasks}
              dndRow={dnd(childScope, g.task.id)}
              onUpdate={(patch) => onUpdateTask(g.task.id, patch)}
              onRemove={() => onRemoveTask(g.task.id)}
            />
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
// that adds into this Lesson. A Lesson is always expanded — it doesn't fold.
function LessonCard({
  lesson,
  num,
  allTasks,
  dnd,
  dndRow,
  onUpdateTask,
  onRemoveTask,
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
  onToggleHidden: () => void;
  onOpenEditor: () => void;
  onRemove: () => void;
  onCreateTask: (taskType: TaskTypeKey) => void;
  onAddExistingTask: () => void;
}) {
  const taskScope = `lesson:${lesson.id}`;
  return (
    // The whole block takes a drop (not just its header), so a Lesson with a
    // long Task list is an easy target for a sibling being dragged.
    <div
      className={`ctb-lesson${lesson.hidden ? " hidden" : ""}`}
      {...dndRow.target}
    >
      <div className="ctb-lesson-head">
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
        <span className="ctb-lesson-acts">
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

      {/* 1245:2473 — the Tasks sit in their OWN card, inset 24px inside the
          Lesson block rather than sharing its frame. */}
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
    </div>
  );
}

// The 16px horizontal kebab on Lesson and Task rows (Figma "Kebab Menu -
// Horizontal"), wrapping the shared Dropdown.
function RowMenu({
  label,
  tile,
  children,
}: {
  label: string;
  /** Trigger on the 32px "More Button" tile (the Course header's) instead of
   *  the bare 16px kebab — a Task directly in a Course (1259:1629). */
  tile?: boolean;
  children: (args: { close: () => void }) => React.ReactNode;
}) {
  return (
    <Dropdown
      // 1244:1831 hugs its widest item (108px for the Lesson menu, 224 for the
      // Task one) rather than sitting at a fixed width.
      width="auto"
      align="right"
      panelClass="ctb-menu"
      trigger={({ open, toggle }) =>
        tile ? (
          <CourseMoreButton label={label} open={open} toggle={toggle} />
        ) : (
          <RowKebab label={label} open={open} toggle={toggle} />
        )
      }
    >
      {children}
    </Dropdown>
  );
}

/* The Course header's 32px "More" tile and the Courses-panel row kebab. Like
   RowKebab below, each is a component so `useTipWhileClosed` can run. */
function CourseMoreButton({
  label = "Course actions",
  open,
  toggle,
}: {
  label?: string;
  open: boolean;
  toggle: () => void;
}) {
  const hint = useTipWhileClosed(label, open);
  return (
    <button
      className="ctb-more"
      aria-label={label}
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

// The "Add Tasks" row that closes a Lesson's Task card (Figma 894:3500). Opens
// the shared picker: pull from the library, or create a new Task of a chosen
// type.
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

// The prerequisites a Task's Access Restriction names, resolved to live Task
// names — a prerequisite that was since deleted simply drops out.
function gatePrereqs(task: CertTask, allTasks: CertTask[]): string[] {
  if (!task.restriction?.enabled) return [];
  return task.restriction.taskIds
    .map((id) => allTasks.find((t) => t.id === id)?.name)
    .filter((n): n is string => !!n);
}

// The restriction banner under a gated Task (Figma 1246:2615), naming its
// prerequisites. Nothing at all while there are none to name.
function TaskGate({ names, mode }: { names: string[]; mode: AccessRestriction["mode"] }) {
  if (names.length === 0) return null;
  // "A and B are completed" vs. the single-prerequisite / any-of "is completed".
  const verb = mode === "all" && names.length > 1 ? "are completed" : "is completed";
  return (
    <div className="ctb-task-gate">
      <span className="ctb-task-gate-icon"><RestrictionLockIcon /></span>
      <p className="ctb-task-gate-text">
        Not Available Unless:{" "}
        {names.map((name, i) => (
          <Fragment key={i}>
            {i > 0 && (mode === "all" ? ", " : " or ")}
            <strong>{name}</strong>
          </Fragment>
        ))}{" "}
        {verb}
      </p>
    </div>
  );
}

/* Figma 1334:2145 / 1334:2157 — a Task that needs a paid subscription carries
   this mark right after its name: the node's amber wallet glyph (12px, exported
   verbatim to src/assets) on an 18px amber-wash disc. It replaced the
   "Requires Subscription" text pill. Hover or focus explains it through the
   shared tooltip. */
const SUBSCRIPTION_TIP = "Requires a Subscription — not available on the Free Trial";

function SubscriptionMark() {
  return (
    <span
      className="cert-sub-mark"
      role="img"
      tabIndex={0}
      aria-label={SUBSCRIPTION_TIP}
      data-tip={SUBSCRIPTION_TIP}
    >
      <span className="cert-sub-mark-glyph">
        <img src={requiresSubscriptionIcon} alt="" />
      </span>
    </span>
  );
}

// A Task row (Figma 1244:2354): grip · name · state pills · meta · kebab. The
// type is named by the meta, not by a leading glyph. The Access Restriction
// editor lives in the kebab. A Task whose restriction is configured carries the
// gate pill under the row (Figma 894:3496 "Secondary Button"), naming its
// prerequisites.
function TaskRow({
  task,
  inCourse,
  allTasks,
  dndRow,
  onUpdate,
  onRemove,
}: {
  task: CertTask;
  /** Pinned straight to the Course, not to a Lesson (Figma 1259:1622 "Task in
   *  Course"): the row is a tinted block of its own, drawn like a Lesson header
   *  — a TASK eyebrow over the name, and the 32px More tile. */
  inCourse?: boolean;
  allTasks: CertTask[];
  dndRow: DndProps;
  onUpdate: (patch: Partial<CertTask>) => void;
  onRemove: () => void;
}) {
  // The Access Restriction modal.
  const [restricting, setRestricting] = useState(false);
  // The "Edit" placeholder and the Delete confirm.
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const restricted = !!task.restriction?.enabled;
  // A Task pulled from the library is owned by the Certifications it already
  // belongs to (this one is still unsaved, so it never appears in the list).
  const sharedWith = task.usedIn ?? [];
  const prereqs = gatePrereqs(task, allTasks);
  const pills = (
    <>
      {task.requiresSubscription && <SubscriptionMark />}
      {/* Restriction switched on but no prerequisite picked yet — the gate has
          nothing to name, so flag the half-configured state instead. */}
      {restricted && prereqs.length === 0 && (
        <span className="cert-restricted-pill">Restricted</span>
      )}
    </>
  );

  return (
    <div
      className={`ctb-task-wrap${prereqs.length > 0 ? " has-gate" : ""}${
        inCourse ? " ctb-course-task" : ""
      }`}
      {...dndRow.target}
    >
      <div className="ctb-task">
        <DragDots className="ctb-grip" {...dndRow.handle} />
        {inCourse ? (
          <div className="ctb-task-titles">
            <div className="ctb-lesson-eyebrow">Task</div>
            <div className="ctb-task-name-row">
              <span className="ctb-task-name">{task.name}</span>
              {pills}
            </div>
          </div>
        ) : (
          <div className="ctb-task-name-row">
            <span className="ctb-task-name">{task.name}</span>
            {pills}
          </div>
        )}
        <span className="ctb-row-meta">{taskMeta(task)}</span>
        <span className="ctb-row-acts">
          <RowMenu label="Task actions" tile={inCourse}>
            {({ close }) => (
              // 1246:2642 — Edit · Add Access Restriction · Remove Task ·
              // Delete Task. Delete is disabled, with its reason on a second
              // line, whenever the Task is reused from the library.
              <div className="menu">
                <button className="menu-item" onClick={() => { setEditing(true); close(); }}>
                  <span className="menu-item-icon"><MenuEditIcon /></span>
                  Edit
                </button>
                <button className="menu-item" onClick={() => { setRestricting(true); close(); }}>
                  <span className={`menu-item-icon ${restricted ? "is-on" : ""}`}><AccessRestrictionIcon /></span>
                  {restricted ? "Edit Access Restriction" : "Add Access Restriction"}
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
      <TaskGate names={prereqs} mode={task.restriction?.mode ?? "all"} />
      {restricting &&
        createPortal(
          <AccessRestrictionModal
            task={task}
            allTasks={allTasks}
            onCancel={() => setRestricting(false)}
            onSave={(restriction) => {
              onUpdate({ restriction });
              setRestricting(false);
            }}
          />,
          document.body,
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

/* Add / Edit Access Restriction — a modal off the Task's 3-dot menu. Two
   fields: the prerequisite Tasks (a searchable multi-select of every OTHER Task
   in the Certification, in tree order across all Courses, open as the modal
   opens), then whether ALL of them or ANY ONE must be completed. Saving with a
   restriction in place offers "Remove Restriction" beside the CTA. */
function AccessRestrictionModal({
  task,
  allTasks,
  onCancel,
  onSave,
}: {
  task: CertTask;
  allTasks: CertTask[];
  onCancel: () => void;
  /** `undefined` removes the restriction. */
  onSave: (restriction: AccessRestriction | undefined) => void;
}) {
  const existing = task.restriction?.enabled ? task.restriction : undefined;
  const options = allTasks.filter((t) => t.id !== task.id);
  const [ids, setIds] = useState<string[]>(
    (existing?.taskIds ?? []).filter((id) => options.some((o) => o.id === id)),
  );
  const [mode, setMode] = useState<AccessRestriction["mode"]>(existing?.mode ?? "all");

  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // The shared MultiSelect speaks labels, so Tasks travel by name and are
  // mapped back to ids (the first Task of that name, in tree order).
  const names = options.map((o) => o.name);
  const picked = ids.map((id) => options.find((o) => o.id === id)?.name).filter((n): n is string => !!n);
  const setPicked = (next: string[]) =>
    setIds(
      next
        .map((name) => options.find((o) => o.name === name)?.id)
        .filter((id): id is string => !!id),
    );

  return (
    <PrmModal
      title={existing ? "Edit Access Restriction" : "Add Access Restriction"}
      description={`Learners can't start "${task.name}" until the Tasks below are completed.`}
      confirmLabel={existing ? "Save Restriction" : "Add Restriction"}
      confirmDisabled={ids.length === 0}
      footerExtra={
        existing ? (
          <button className="prm-quiet" onClick={() => onSave(undefined)}>
            Remove Restriction
          </button>
        ) : undefined
      }
      onCancel={onCancel}
      onConfirm={() => onSave({ enabled: true, mode, taskIds: ids })}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <label className="prm-label">Tasks</label>
          <MultiSelect
            options={names}
            value={picked}
            onChange={setPicked}
            placeholder="Select Tasks"
            searchPlaceholder="Search Tasks..."
            popupMenu
            defaultOpen
          />
        </div>
        {/* Both answers are real choices, so the chosen one takes the
            Single-Select's accent state (639:895) — the neutral fill is the
            modal card's own 20% wash and would vanish into it. */}
        <div className="prm-field">
          <label className="prm-label">Unlocks When</label>
          <div className="seg-control">
            <button
              type="button"
              className={`seg-btn${mode === "all" ? " active accent" : ""}`}
              aria-pressed={mode === "all"}
              onClick={() => setMode("all")}
            >
              All Tasks are Completed
            </button>
            <button
              type="button"
              className={`seg-btn${mode === "any" ? " active accent" : ""}`}
              aria-pressed={mode === "any"}
              onClick={() => setMode("any")}
            >
              Any One Task is Completed
            </button>
          </div>
        </div>
      </div>
    </PrmModal>
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
   singular Add Existing Task. It cascades the way More Filters does: hovering
   (or clicking) Create New Task opens the Task types in a second panel BESIDE
   this one, level with the row, instead of swapping this list out for a
   "Choose a Task type" view. The panel opens to the right, or to the left when
   the right side would run off the window. */
function AddTaskMenuContent({
  onCreateNew,
  onAddExisting,
}: {
  onCreateNew: (t: TaskTypeKey) => void;
  onAddExisting: () => void;
}) {
  // Offset of the Create New Task row inside the panel, while the types are open.
  const [typesTop, setTypesTop] = useState<number | null>(null);
  const [flip, setFlip] = useState(false);
  const subRef = useRef<HTMLDivElement | null>(null);

  function openTypes(e: React.SyntheticEvent<HTMLButtonElement>) {
    // The row's offsetParent is the dropdown panel itself (it is positioned),
    // which is also what the types panel is placed against.
    setTypesTop(e.currentTarget.offsetTop);
  }

  // Measured before paint, so the types never flash on the wrong side.
  useLayoutEffect(() => {
    const sub = subRef.current;
    const panel = sub?.parentElement?.closest(".dropdown");
    if (!sub || !panel) return;
    const { left, right } = panel.getBoundingClientRect();
    const needed = sub.offsetWidth + 6 + 8;
    setFlip(right + needed > window.innerWidth && left - needed >= 0);
  }, [typesTop]);

  return (
    <>
      <div className="menu">
        <button
          className={`menu-item${typesTop !== null ? " is-open" : ""}`}
          aria-haspopup="menu"
          aria-expanded={typesTop !== null}
          onMouseEnter={openTypes}
          onFocus={openTypes}
          onClick={openTypes}
        >
          <span className="menu-item-icon"><AddCircleIcon /></span>
          Create New Task
          <span className="ctb-menu-chevron"><ChevronRightIcon /></span>
        </button>
        <button
          className="menu-item"
          onMouseEnter={() => setTypesTop(null)}
          onFocus={() => setTypesTop(null)}
          onClick={onAddExisting}
        >
          <span className="menu-item-icon"><SearchIcon /></span>
          Add Existing Task
        </button>
      </div>

      {typesTop !== null && (
        <div
          ref={subRef}
          className={`ctb-menu-sub${flip ? " is-left" : ""}`}
          role="menu"
          /* −8.5: the panel's own 8px padding + its 0.5px hairline, so the
             first type sits level with the row that opened it. */
          style={{ top: typesTop - 8.5 }}
        >
          <div className="menu">
            {TASK_TYPE_OPTIONS.map(({ key, label: optLabel, icon: Icon }) => (
              <button key={key} className="menu-item" role="menuitem" onClick={() => onCreateNew(key)}>
                <span className="menu-item-icon"><Icon /></span>
                {optLabel}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
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
// Each control appears only when its handler is passed, so the Certifications
// drawer reads a set back through this same card with none of them.
function ConditionSetCard({
  set,
  index,
  onRemove,
  onAddItems,
  onRemoveItem,
}: {
  set: ConditionSet;
  index: number;
  onRemove?: () => void;
  onAddItems?: (items: CompletionItem[]) => void;
  onRemoveItem?: (itemId: string) => void;
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
        {onRemove && (
          <button
            className="cc-head-x"
            onClick={onRemove}
            title="Remove Condition Set"
            aria-label={`Remove Condition Set ${index}`}
          >
            <MinusThinIcon />
          </button>
        )}
      </div>

      {set.items.map((item) => (
        <div key={item.id} className="cc-row">
          <div className="cc-row-main">
            <span className="cc-row-name">{item.name}</span>
            <span className="cc-row-meta">· {itemMeta(item)}</span>
          </div>
          {onRemoveItem && (
            <button
              className="cc-row-x"
              onClick={() => onRemoveItem(item.id)}
              aria-label={`Remove ${item.name}`}
            >
              <SmallXIcon />
            </button>
          )}
        </div>
      ))}

      {onAddItems && (
        <div className="cc-row cc-row-foot">
          <button className="cc-add-req" onClick={() => setPicking(true)}>
            <span className="cc-add-icon">
              <PlusThinIcon />
            </span>
            Add Requirement
          </button>
        </div>
      )}
    </div>

    {/* Portalled to <body>: the panel clips to its 12px radius, and the
        wizard's step container is transformed, which would otherwise turn the
        overlay's position:fixed into a local box (the same gotcha the Task
        wizard's Select Questions hits). */}
    {picking && onAddItems &&
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

// The step's radio titles, also what the Certifications drawer prints.
const ACCESS_TYPE_LABEL: Record<AccessType, string> = {
  open: "Open-To-All (free)",
  "non-consumable": "Non-Consumable",
  consumable: "Consumable",
};
const PROGRESS_LABEL: Record<ConsumableProgress, string> = {
  reset: "Reset Progress",
  preserve: "Preserve Progress",
};

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
            title={ACCESS_TYPE_LABEL.open}
            desc="Free for any user who can see the Certification. Access depends on B2C tier."
          />
          <RadioCard
            selected={data.accessType === "non-consumable"}
            onSelect={() => update({ accessType: "non-consumable" })}
            title={ACCESS_TYPE_LABEL["non-consumable"]}
            desc="One-time purchase. Access persists as long as the user is a Subscriber."
          />
          <RadioCard
            selected={data.accessType === "consumable"}
            onSelect={() => update({ accessType: "consumable" })}
            title={ACCESS_TYPE_LABEL.consumable}
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
              title={PROGRESS_LABEL.reset}
              desc="All Task completions, Quiz attempts, and Quiz-Section completions for Tasks within the Certification are cleared for that user. On repurchase, the user starts fresh."
            />
            <RadioCard
              selected={data.consumableProgress === "preserve"}
              onSelect={() => update({ consumableProgress: "preserve" })}
              title={PROGRESS_LABEL.preserve}
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

/* ─────────────────  Read-only summary (Certifications drawer)  ───────────────── */

/* Every field this wizard edits, read back as review cards (Figma 1046:1147) in
   the Certifications row drawer (1316:1846): one card per step, in step order.
   It reads `buildInitialData` — the same data the wizard opens this
   Certification with — so the drawer and the editor can't disagree. The first
   card keeps the drawer node's "Overview" title; the rest take their step's
   name. The bilingual fields show their English half only. */
export function CertificationSummary({ cert }: { cert: Certification }) {
  // Once per Certification: the sample structure mints fresh node ids.
  const data = useMemo(() => buildInitialData(cert), [cert]);
  const allTasks = flattenTasks(data.courses);
  const slug = data.slugCustom ? data.slug : slugify(data.nameEn);
  const deepLink = slug ? `${DEEP_LINK_BASE}${slug}` : "";
  const tagsOf = (type: ContentTagType) =>
    data.contentTags
      .filter((t) => t.type === type)
      .map((t) => t.value)
      .join(", ");
  const paid = data.accessType !== "open";

  return (
    <div className="confirm-cards">
      <ConfirmCard
        title="Overview"
        fillBlanks
        rows={[
          [
            "Time to Complete",
            data.timeValue &&
              formatTimeToComplete({ value: Number(data.timeValue), unit: data.timeUnit }),
          ],
          // The record's own state — the wizard folds Archived into Hidden.
          ["Visibility", cert.visibility ?? "Visible"],
          ["Industry", data.industries.join(", ")],
          ["Career Stage", CAREER_STAGES.find((s) => s.value === data.careerStage)?.label],
          ["Type", CERT_TYPES.find((t) => t.value === data.type)?.label],
          ["Thumbnail", data.thumbnail?.name],
        ]}
      />

      <ConfirmCard
        title="Additional Info"
        fillBlanks
        rows={[
          ["Announcement", data.announceEn, true],
          ["CEUs Awarded", data.ceus],
          ["Keywords", data.keywordsEn, true],
          [
            "Deep Link",
            deepLink && (
              <a
                className="rvc-headlink"
                href={`https://${deepLink}`}
                target="_blank"
                rel="noreferrer"
              >
                {deepLink}
              </a>
            ),
            true,
          ],
        ]}
      />

      <ConfirmCard title={`Tasks · ${allTasks.length}`}>
        <CourseTreeSummary courses={data.courses} allTasks={allTasks} />
      </ConfirmCard>

      <ConfirmCard title="Completion Criteria">
        <div className="cc-sets">
          {data.conditionSets.map((set, idx) => (
            <Fragment key={set.id}>
              {idx > 0 && (
                <div className="cc-or">
                  <div className="cc-or-lead">
                    <span>OR</span>
                  </div>
                </div>
              )}
              <ConditionSetCard set={set} index={idx + 1} />
            </Fragment>
          ))}
        </div>
      </ConfirmCard>

      {/* Product IDs and repurchase behaviour only exist for the paywalls
          they apply to, as on the step, so no blanks are filled here. */}
      <ConfirmCard
        title="Paywall"
        rows={[
          ["Access Type", ACCESS_TYPE_LABEL[data.accessType]],
          [
            "Progress on Repurchase",
            data.accessType === "consumable" ? PROGRESS_LABEL[data.consumableProgress] : undefined,
          ],
          ...PRICE_CHANNELS.map(
            (ch): ConfirmField => [ch.name, paid ? data.priceIds[ch.key] || "—" : undefined, true],
          ),
        ]}
      />

      <ConfirmCard
        title="Audience"
        fillBlanks
        rows={[
          ["Audience", tagsOf("userType") ? AUDIENCE_B2B : AUDIENCE_ALL],
          ["Trade", tagsOf("trade"), true],
          ["Partnership", tagsOf("partnership"), true],
        ]}
      />
    </div>
  );
}

/* The Add Tasks tree, read back without its controls: each Course's eyebrow,
   name and description, then its Lessons (the builder's tinted block around an
   inset Task table) and loose Tasks (each a tinted block of its own, as in the
   builder), in tree order. */
function CourseTreeSummary({
  courses,
  allTasks,
}: {
  courses: CertCourse[];
  allTasks: CertTask[];
}) {
  return (
    <div className="cdr-courses">
      {courses.map((course, i) => (
        <section key={course.id} className={`cdr-course${course.hidden ? " hidden" : ""}`}>
          <div className="cdr-course-head">
            <span className="ctb-eyebrow">Course {i + 1}</span>
            <div className="cdr-course-name-row">
              <span className="cdr-course-name">{course.nameEn || "Untitled Course"}</span>
              {course.hidden && <span className="cert-hidden-pill">Hidden</span>}
            </div>
            {course.descEn && <p className="cdr-course-desc">{course.descEn}</p>}
          </div>

          {groupChildren(course.children).map((g) =>
            g.kind === "task" ? (
              <div key={g.key} className="ctb-course-task">
                <TaskSummaryRow task={g.task} allTasks={allTasks} inCourse />
              </div>
            ) : (
              <div key={g.key} className={`ctb-lesson${g.lesson.hidden ? " hidden" : ""}`}>
                <div className="ctb-lesson-titles cdr-lesson-head">
                  <div className="ctb-lesson-eyebrow">Lesson {g.num}</div>
                  <div className="ctb-lesson-name-row">
                    <span className="ctb-lesson-name">{g.lesson.nameEn || "Untitled Lesson"}</span>
                    {g.lesson.hidden && <span className="cert-hidden-pill">Hidden</span>}
                  </div>
                  {g.lesson.descEn && <div className="ctb-lesson-desc">{g.lesson.descEn}</div>}
                </div>
                <div className="cdr-lesson-body">
                  <div className="ctb-tasktable">
                    {g.lesson.tasks.map((t) => (
                      <TaskSummaryRow key={t.id} task={t} allTasks={allTasks} />
                    ))}
                  </div>
                </div>
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

/* A Task in the read-only tree: its name and state pills over the builder's
   meta ("Quiz · 15 mins"), then the restriction banner if it has one.
   Stacked rather than side by side, so a long name isn't cut short in the
   drawer's narrow column. */
function TaskSummaryRow({
  task,
  allTasks,
  inCourse,
}: {
  task: CertTask;
  allTasks: CertTask[];
  /** A Task directly in a Course carries the builder's TASK eyebrow. */
  inCourse?: boolean;
}) {
  const prereqs = gatePrereqs(task, allTasks);
  return (
    <div className="cdr-task">
      {inCourse && <span className="ctb-lesson-eyebrow">Task</span>}
      <div className="cdr-task-name-row">
        <span className="cdr-task-name">{task.name}</span>
        {task.requiresSubscription && <SubscriptionMark />}
        {task.restriction?.enabled && prereqs.length === 0 && (
          <span className="cert-restricted-pill">Restricted</span>
        )}
      </div>
      <span className="ctb-row-meta">{taskMeta(task)}</span>
      <TaskGate names={prereqs} mode={task.restriction?.mode ?? "all"} />
    </div>
  );
}

/* ─────────────────  Archive & Replace (full page)  ───────────────── */

const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

/* The Archive & Replace page's long explanation — the ⓘ on its description. */
const ARCHIVE_CERT_TIP =
  "Archiving removes this Certification from the catalog, so no one new can enroll in it. It can't be un-archived.\n\n" +
  "Learners already enrolled keep their completion record. The Replacement Certifications you pick appear in their Path, and the Replacement Alert tells them why.";

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
  // Landing here already means "archive this Cert", so the CTA is live from the
  // start; the permanence is acknowledged in a confirm modal instead of an
  // on-page "Archive this Certification" toggle (removed 2026-09-24).
  const [confirming, setConfirming] = useState(false);
  const replacementLine =
    replacementCerts.length === 0
      ? "No replacement is selected, so enrolled learners won't be pointed to another Certification."
      : replacementCerts.length === 1
        ? `Enrolled learners will be pointed to “${replacementCerts[0]}”.`
        : `Enrolled learners will be pointed to the ${replacementCerts.length} replacement Certifications you picked.`;

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
                <span
                  className="form-help-info wizard-desc-info"
                  tabIndex={0}
                  role="note"
                  aria-label={ARCHIVE_CERT_TIP}
                  data-tip={ARCHIVE_CERT_TIP}
                >
                  <InfoTipIcon />
                </span>
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
          <button className="btn-publish" onClick={() => setConfirming(true)}>
            Archive Certification
          </button>
        </div>
      </footer>

      {confirming &&
        createPortal(
          <PrmModal
            title="Archive this Certification?"
            description={
              <>
                Archive <strong>{cert.name}</strong> ({cert.id})? It leaves the catalog and
                can't be un-archived. {replacementLine}
              </>
            }
            confirmLabel="Archive Certification"
            danger
            onCancel={() => setConfirming(false)}
            onConfirm={() => { setConfirming(false); onArchive(); }}
          />,
          document.body,
        )}
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
  suggestion,
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
  /** A value worth offering (the first Course takes the Certification's
   *  name): it replaces the placeholders, and Tab in an empty row fills every
   *  empty row with it — the Spanish row with `es`, falling back to `en`. */
  suggestion?: { en: string; es: string };
}) {
  // Focus AND select, so the field is ready to type into — an edit replaces
  // the current name rather than appending to it. Mount only.
  const enRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    enRef.current?.focus();
    enRef.current?.select();
  }, [autoFocus]);

  const suggestEn = suggestion?.en.trim() ?? "";
  const suggestEs = suggestion?.es.trim() || suggestEn;
  const keyDown = (rowValue: string) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
    } else if (
      e.key === "Tab" &&
      suggestEn &&
      !rowValue &&
      !(e.shiftKey || e.metaKey || e.ctrlKey || e.altKey)
    ) {
      // Accept the suggestion; the caret stays put, so a second Tab moves on.
      e.preventDefault();
      if (!en) onChangeEn(suggestEn);
      if (!es) onChangeEs(suggestEs);
    }
  };
  return (
    <>
      <div className={`lang-field ${error ? "has-error" : ""}`}>
        <div className="lang-field-row">
          <span className="lang-tag">EN</span>
          <input
            ref={enRef}
            className="lang-field-input"
            value={en}
            placeholder={suggestEn || placeholderEn}
            aria-invalid={error || undefined}
            onChange={(e) => onChangeEn(e.target.value)}
            onKeyDown={keyDown(en)}
          />
          {/* The search bar's keycap (⌘K badge), naming the key that takes
              the suggestion. Gone once the row has a value. */}
          {suggestEn && !en && (
            <span className="search-kbd lang-field-kbd" aria-hidden="true">
              <span className="kbd-letter">Tab</span>
            </span>
          )}
        </div>
        <div className="lang-field-divider" />
        <div className="lang-field-row">
          <span className="lang-tag">ES</span>
          <input
            className="lang-field-input"
            value={es}
            placeholder={suggestion ? suggestEs : placeholderEs}
            onChange={(e) => onChangeEs(e.target.value)}
            onKeyDown={keyDown(es)}
          />
        </div>
      </div>
      {error && errorMessage && <p className="form-error-text">{errorMessage}</p>}
    </>
  );
}

export type { WizardData as CertWizardData, CertCourse, CertTask, TaskKind };
