import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CheckBoldIcon,
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
  SmallXIcon,
  DragHandleIcon,
} from "./icons";
import { CertSplitTaskWizard } from "./CertSplitTaskWizard";
import { Dropdown } from "./Dropdown";
import { SearchIcon, AddIcon, LockIcon } from "./icons";
import { type TaskTypeKey, TASK_TYPE_OPTIONS } from "./Footer";
import { type Certification, certifications } from "../data/certifications";
import { tasks as taskLibrary, type Task, type TaskType } from "../data/tasks";
import { DEFAULT_PARTNERSHIPS, DEFAULT_TRADES } from "../data/productConfig";
import { PriceIdFields, newPriceIds, type PriceIds } from "./PriceIdFields";

type CareerStage = "apprentice" | "journeyman" | "master";
type CertType = "unit" | "credential" | "program" | "bundle";
type Visibility = "visible" | "hidden";
type AccessType = "open" | "non-consumable" | "consumable";
// Repurchase behaviour — Consumable paywalls only. Determines whether a user's
// progress is wiped or kept when they buy the Certification again.
type ConsumableProgress = "reset" | "preserve";
type TimeUnit = "minutes" | "hours" | "days" | "weeks";

type TaskKind = "xapi" | "quiz" | "hands-on" | "id-upload" | "file" | "url";

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
// satisfyingStatus): Completed for everything except ID-Upload, which also
// satisfies at In-Review.
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
};

// The status a prerequisite Task must reach to satisfy a restriction (V1).
function satisfyingStatus(kind: TaskKind): string {
  return kind === "id-upload" ? "In-Review or Completed" : "Completed";
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
  return { id: nodeId("t"), name: t.name, kind, duration: DURATION_BY_KIND[kind] };
}

// Maps a stored Task's display type onto the wizard's TaskKind (used for badges).
const TASK_TYPE_TO_KIND: Record<TaskType, TaskKind> = {
  xAPI: "xapi",
  Quiz: "quiz",
  "ID Upload": "id-upload",
  "Hands-On Task": "hands-on",
  File: "file",
  URL: "url",
};

const DURATION_BY_KIND: Record<TaskKind, string> = {
  xapi: "10 min",
  quiz: "15 min",
  "hands-on": "30 min",
  "id-upload": "2 min",
  file: "5 min",
  url: "5 min",
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
  thumbnail: { name: string; size: number; w: number; h: number } | null;
  timeValue: string;
  timeUnit: TimeUnit;
  careerStage: CareerStage | "";
  type: CertType;
  ceus: string;
  industries: string[];

  // Additional Info
  announceEn: string;
  announceEs: string;
  keywordsEn: string;
  keywordsEs: string;

  forceOrder: boolean;
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
const BLANK_DATA: WizardData = {
  nameEn: "",
  nameEs: "",
  descEn: "",
  descEs: "",
  thumbnail: null,
  timeValue: "",
  timeUnit: "hours",
  careerStage: "",
  type: "unit",
  ceus: "",
  industries: [],

  announceEn: "",
  announceEs: "",
  keywordsEn: "",
  keywordsEs: "",

  forceOrder: false,
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
    type: editing.type ? (editing.type.toLowerCase() as CertType) : "unit",
    keywordsEn: (editing.keywords ?? []).join(", "),
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
  { id: "settings", label: "Other Settings", sub: "Visibility, paywall, content tags", desc: "Control who can see this Certification, how it's purchased, and which content tags gate its visibility." },
  { id: "archiving", label: "Archiving", sub: "Retire and replace", desc: "Archive this Certification and point enrolled learners to a replacement. Archiving is permanent." },
];

type Props = { onClose: () => void; editingCert?: Certification };

export function NewCertificationWizard({ onClose, editingCert }: Props) {
  const isEditing = !!editingCert;
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(() => buildInitialData(editingCert));
  const [splitTask, setSplitTask] = useState<{ courseId: string; lessonId?: string; taskType: TaskTypeKey } | null>(null);
  // Completion criteria start locked when editing an existing Certification —
  // unlocking requires acknowledging that completion data will be reset.
  const [completionUnlocked, setCompletionUnlocked] = useState(false);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

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
            <span className="wizard-brand-mark" />
            <span className="wizard-brand-name">
              {isEditing ? "Edit" : "New"} Certification
            </span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((s, i) => {
              const status = i === step ? "active" : i < step ? "done" : "upcoming";
              return (
                <li
                  key={s.id}
                  className={`wizard-step ${status}`}
                  onClick={() => setStep(i)}
                >
                  <div className="wizard-step-rail">
                    <span className="wizard-step-num">
                      {status === "done" ? <CheckBoldIcon /> : i + 1}
                    </span>
                  </div>
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                    <div className="wizard-step-sub">
                      {status === "active" ? s.desc : s.sub}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="wizard-progress">
            Step {step + 1} of {STEPS.length}
          </div>
        </aside>

        <div className="wizard-content">
          <h1 className="wizard-title">{STEPS[step].label}</h1>
          <p className="wizard-desc">{STEPS[step].desc}</p>

          {step === 0 && <DetailsStep data={data} update={update} />}
          {step === 1 && <AdditionalInfoStep data={data} update={update} />}
          {step === 2 && (
            <TasksStep
              data={data}
              update={update}
              onCreateTask={(courseId, lessonId, taskType) => setSplitTask({ courseId, lessonId, taskType })}
              onAddExisting={(courseId, lessonId, task) =>
                appendTask(courseId, lessonId, libraryTaskToCertTask(task))
              }
            />
          )}
          {step === 3 && (
            <CompletionStep
              data={data}
              update={update}
              criteriaLocked={isEditing && !completionUnlocked}
              onUnlockCriteria={() => setCompletionUnlocked(true)}
            />
          )}
          {step === 4 && <SettingsStep data={data} update={update} />}
          {step === 5 && <ArchivingStep data={data} update={update} />}
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <span className="wizard-saved">
            {isEditing ? "Last saved 2 minutes ago" : "Draft — not saved yet"}
          </span>
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          <button className="btn-save-draft" onClick={onClose}>Save as draft</button>
          <button className="btn-publish" onClick={onClose}>
            {isEditing ? "Save changes" : "Publish"}
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────  Step 1: Details  ───────────────── */

const CERT_TYPES: { value: CertType; label: string }[] = [
  { value: "unit", label: "Unit" },
  { value: "credential", label: "Credential" },
  { value: "program", label: "Program" },
  { value: "bundle", label: "Bundle" },
];

function DetailsStep({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Certification name <span className="req">*</span>
        </label>
        <LangField
          en={data.nameEn}
          es={data.nameEs}
          onChangeEn={(v) => update({ nameEn: v })}
          onChangeEs={(v) => update({ nameEs: v })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Short description</label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
        />
        <p className="form-help">
          Visible in the catalog and search results. Around 200 characters reads best — longer descriptions are accepted but truncated in compact views.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Thumbnail</label>
        {data.thumbnail ? (
          <div className="cert-thumb-row">
            <div className="cert-thumb-preview">
              <ImageIcon />
            </div>
            <div className="cert-thumb-meta">
              <div className="cert-thumb-name">{data.thumbnail.name}</div>
              <div className="cert-thumb-sub">
                {data.thumbnail.w} × {data.thumbnail.h} · {Math.round(data.thumbnail.size / 1024)} KB · uploaded just now
              </div>
            </div>
            <button className="btn-secondary">Replace</button>
            <button className="btn-secondary" onClick={() => update({ thumbnail: null })}>Remove</button>
          </div>
        ) : (
          <button className="drop-slim">+ Upload thumbnail</button>
        )}
        <p className="form-help">Displayed on the catalog card and Certification cover. Recommended 1280 × 720 px.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Time to complete</label>
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
        <p className="form-help">Helps learners plan. Set in minutes, hours, days, weeks, or months.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Career stage</label>
        <div className="seg-control">
          {(["apprentice", "journeyman", "master"] as CareerStage[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`seg-btn ${data.careerStage === s ? "active" : ""}`}
              // Clicking the active stage again clears it — a Cert can have none.
              onClick={() => update({ careerStage: data.careerStage === s ? "" : s })}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <p className="form-help">Optional. Click again to clear — Certifications can have no career stage.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Type</label>
        <div className="seg-control">
          {CERT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`seg-btn ${data.type === t.value ? "active" : ""}`}
              onClick={() => update({ type: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="form-help">
          Unit is a single Certification; Credential, Program, and Bundle group multiple Certifications. Defaults to Unit.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Industries</label>
        <div className="tag-edit-row">
          {data.industries.map((t) => (
            <span key={t} className="tag-edit">
              {t}
              <button
                className="tag-edit-x"
                onClick={() => update({ industries: data.industries.filter((x) => x !== t) })}
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </span>
          ))}
          <button className="tag-add">+ Add Industry</button>
        </div>
        <p className="form-help">Used for catalog browsing and content discovery. A Certification can belong to multiple Industries and Sub-Industries.</p>
      </div>
    </>
  );
}

/* ─────────────────  Step 2: Additional Info  ───────────────── */

function AdditionalInfoStep({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  return (
    <>
      <section className="form-section">
        <h2 className="form-section-title">Announcement</h2>
        <RichTextField
          en={data.announceEn}
          es={data.announceEs}
          onChangeEn={(v) => update({ announceEn: v })}
          onChangeEs={(v) => update({ announceEs: v })}
        />
        <p className="form-help">Shown to learners currently going through this Certification. Use for important updates.</p>
      </section>

      <div className="form-divider" />

      <section className="form-section">
        <h2 className="form-section-title">CEUs awarded</h2>
        <div className="time-row">
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
          <span className="form-suffix">CEUs upon completion</span>
        </div>
        <p className="form-help">Decimal values supported. Leave blank if no CEUs are issued.</p>
      </section>

      <div className="form-divider" />

      <section className="form-section">
        <h2 className="form-section-title">Keywords</h2>
        <p className="form-section-desc">
          Improve search and discovery. Add keywords in English and Spanish — separate each with a comma.
        </p>
        <KeywordsField
          valueEn={data.keywordsEn}
          valueEs={data.keywordsEs}
          onChangeEn={(v) => update({ keywordsEn: v })}
          onChangeEs={(v) => update({ keywordsEs: v })}
        />
      </section>
    </>
  );
}

function parseKeywords(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function KeywordsField({
  valueEn,
  valueEs,
  onChangeEn,
  onChangeEs,
}: {
  valueEn: string;
  valueEs: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
}) {
  const enKw = useMemo(() => parseKeywords(valueEn), [valueEn]);
  const esKw = useMemo(() => parseKeywords(valueEs), [valueEs]);

  const removeAt = (list: string[], idx: number, onChange: (v: string) => void) => {
    const next = list.filter((_, i) => i !== idx);
    onChange(next.join(", "));
  };

  return (
    <div className="kw-field">
      <div className="form-sub-group">
        <label className="form-sub-label">English keywords</label>
        <input
          className="form-input"
          value={valueEn}
          placeholder="e.g. epa, 608, refrigerant, certification"
          onChange={(e) => onChangeEn(e.target.value)}
        />
        {enKw.length > 0 && (
          <div className="kw-chips">
            {enKw.map((k, i) => (
              <span key={`${k}-${i}`} className="tag-edit">
                {k}
                <button
                  className="tag-edit-x"
                  onClick={() => removeAt(enKw, i, onChangeEn)}
                  aria-label={`Remove ${k}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="form-sub-group">
        <label className="form-sub-label">Spanish keywords <span className="lang-tag">ESPAÑOL</span></label>
        <input
          className="form-input"
          value={valueEs}
          placeholder="p. ej. epa, refrigerante, certificación"
          onChange={(e) => onChangeEs(e.target.value)}
        />
        {esKw.length > 0 && (
          <div className="kw-chips">
            {esKw.map((k, i) => (
              <span key={`${k}-${i}`} className="tag-edit">
                {k}
                <button
                  className="tag-edit-x"
                  onClick={() => removeAt(esKw, i, onChangeEs)}
                  aria-label={`Remove ${k}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────  Step 3: Tasks tree  ───────────────── */

const KIND_LABEL: Record<TaskKind, { letter: string; cls: string; label: string }> = {
  xapi: { letter: "X", cls: "xapi", label: "xAPI" },
  quiz: { letter: "Q", cls: "quiz", label: "Quiz" },
  "hands-on": { letter: "H", cls: "handson", label: "Hands-On Task" },
  "id-upload": { letter: "ID", cls: "idup", label: "ID Upload" },
  file: { letter: "F", cls: "file", label: "File" },
  url: { letter: "U", cls: "url", label: "URL" },
};

function TaskKindBadge({ kind }: { kind: TaskKind }) {
  const k = KIND_LABEL[kind];
  return <span className={`task-kind-badge ${k.cls}`}>{k.letter}</span>;
}

function courseStats(course: CertCourse): { tasks: number; lessons: number; minutes: number } {
  let tasks = 0;
  let lessons = 0;
  let minutes = 0;
  const parseMin = (d: string) => parseInt(d) || 0;
  for (const c of course.children) {
    if (c.kind === "task") {
      tasks += 1;
      minutes += parseMin(c.task.duration);
    } else {
      lessons += 1;
      tasks += c.lesson.tasks.length;
      for (const t of c.lesson.tasks) minutes += parseMin(t.duration);
    }
  }
  return { tasks, lessons, minutes };
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
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
  onAddExisting: (courseId: string, lessonId: string | undefined, task: Task) => void;
}) {
  const [importing, setImporting] = useState(false);

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
    update({ courses: data.courses.filter((c) => c.id !== id) });
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

  function addLesson(courseId: string) {
    update({
      courses: data.courses.map((c) =>
        c.id === courseId
          ? { ...c, expanded: true, children: [...c.children, { kind: "lesson", lesson: newLesson() }] }
          : c,
      ),
    });
  }

  function addCourse() {
    update({ courses: [...data.courses, newCourse()] });
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

      <div className="cert-force-order">
        <div className="cert-force-order-text">
          <div className="cert-force-order-title">
            <span className="cert-force-order-icon"><DragHandleIcon /></span>
            Force Order
          </div>
          <div className="cert-force-order-desc">
            Learners must complete Tasks in the order they appear. Each Task unlocks only after the previous one is complete, across all Courses and Lessons.
          </div>
        </div>
        <button
          className={`toggle ${data.forceOrder ? "on" : ""}`}
          onClick={() => update({ forceOrder: !data.forceOrder })}
          aria-pressed={data.forceOrder}
        >
          <span className="toggle-knob" />
        </button>
      </div>

      <div className="cert-courses">
        {data.courses.map((course, idx) => (
          <CourseCard
            key={course.id}
            course={course}
            index={idx + 1}
            required={data.courses.length <= 1}
            allTasks={allTasks}
            onUpdateTask={updateTaskById}
            onToggle={() => toggleCourse(course.id)}
            onUpdate={(patch) => updateCourse(course.id, patch)}
            onToggleHidden={() => updateCourse(course.id, { hidden: !course.hidden })}
            onRemove={() => removeCourse(course.id)}
            onCreateTask={(taskType) => onCreateTask(course.id, undefined, taskType)}
            onAddExistingTask={(task) => onAddExisting(course.id, undefined, task)}
            onAddLesson={() => addLesson(course.id)}
            onCreateTaskInLesson={(lessonId, taskType) => onCreateTask(course.id, lessonId, taskType)}
            onAddExistingTaskInLesson={(lessonId, task) => onAddExisting(course.id, lessonId, task)}
            onUpdateLesson={(lessonId, patch) => updateLesson(course.id, lessonId, patch)}
            onToggleLesson={(lessonId) => toggleLesson(course.id, lessonId)}
            onToggleLessonHidden={(lessonId) =>
              mapLesson(course.id, lessonId, (l) => ({ ...l, hidden: !l.hidden }))
            }
            onRemoveLesson={(lessonId) => removeLesson(course.id, lessonId)}
          />
        ))}

        <button className="cert-add-course" onClick={addCourse}>+ Add Course</button>
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

function CourseCard({
  course,
  index,
  required,
  allTasks,
  onUpdateTask,
  onToggle,
  onUpdate,
  onToggleHidden,
  onRemove,
  onCreateTask,
  onAddExistingTask,
  onAddLesson,
  onCreateTaskInLesson,
  onAddExistingTaskInLesson,
  onUpdateLesson,
  onToggleLesson,
  onToggleLessonHidden,
  onRemoveLesson,
}: {
  course: CertCourse;
  index: number;
  required: boolean;
  allTasks: CertTask[];
  onUpdateTask: (taskId: string, patch: Partial<CertTask>) => void;
  onToggle: () => void;
  onUpdate: (patch: Partial<CertCourse>) => void;
  onToggleHidden: () => void;
  onRemove: () => void;
  onCreateTask: (taskType: TaskTypeKey) => void;
  onAddExistingTask: (task: Task) => void;
  onAddLesson: () => void;
  onCreateTaskInLesson: (lessonId: string, taskType: TaskTypeKey) => void;
  onAddExistingTaskInLesson: (lessonId: string, task: Task) => void;
  onUpdateLesson: (lessonId: string, patch: Partial<CertLesson>) => void;
  onToggleLesson: (lessonId: string) => void;
  onToggleLessonHidden: (lessonId: string) => void;
  onRemoveLesson: (lessonId: string) => void;
}) {
  const stats = courseStats(course);
  return (
    <div className={`cert-course ${course.expanded ? "expanded" : ""} ${course.hidden ? "hidden" : ""}`}>
      <div className="cert-course-header" onClick={onToggle}>
        <span className="cert-course-drag"><DragHandleIcon /></span>
        <span className="cert-course-caret">{course.expanded ? "▾" : "▸"}</span>
        <span className="cert-course-num">{index}</span>
        <div className="cert-course-titles">
          <div className="cert-course-name">
            {course.nameEn || "Untitled Course"}
            {course.sourceCertName && (
              <span className="cert-source-pill">
                <LayersIcon />
                Imported
              </span>
            )}
            {required && <span className="cert-required-pill">Required</span>}
            {course.hidden && <span className="cert-hidden-pill">Hidden</span>}
          </div>
          <div className="cert-course-meta">
            {stats.tasks} Tasks
            {stats.lessons > 0 && ` · ${stats.lessons} Lesson${stats.lessons > 1 ? "s" : ""}`}
            {stats.minutes > 0 && ` · ${formatDuration(stats.minutes)}`}
          </div>
        </div>
        <button
          className={`cert-course-eye ${course.hidden ? "is-hidden" : ""}`}
          aria-label={course.hidden ? "Show Course" : "Hide Course"}
          aria-pressed={course.hidden}
          onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
        >
          {course.hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <div className="cert-node-menu" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            width={210}
            align="right"
            trigger={({ toggle }) => (
              <button className="cert-course-menu" aria-label="More" onClick={toggle}>⋯</button>
            )}
          >
            {({ close }) => (
              <div className="menu">
                <button
                  className="menu-item danger"
                  disabled={required}
                  onClick={() => { onRemove(); close(); }}
                >
                  Remove Course
                </button>
                {required && (
                  <div className="menu-note">At least one Course is required.</div>
                )}
              </div>
            )}
          </Dropdown>
        </div>
      </div>

      {course.expanded && (
        <div className="cert-course-body">
          <div className="cert-node-edit">
            <label className="cert-edit-label">Course name <span className="req">*</span></label>
            <LangField
              en={course.nameEn}
              es={course.nameEs}
              placeholderEn="Course name"
              placeholderEs="Nombre del curso"
              onChangeEn={(v) => onUpdate({ nameEn: v })}
              onChangeEs={(v) => onUpdate({ nameEs: v })}
            />
            <label className="cert-edit-label">Course description</label>
            <RichTextField
              compact
              en={course.descEn}
              es={course.descEs}
              placeholderEn="Describe this Course"
              placeholderEs="Describe este curso"
              onChangeEn={(v) => onUpdate({ descEn: v })}
              onChangeEs={(v) => onUpdate({ descEs: v })}
            />
          </div>

          {course.children.map((c) =>
            c.kind === "task" ? (
              <TaskRow
                key={c.task.id}
                task={c.task}
                allTasks={allTasks}
                onUpdate={(patch) => onUpdateTask(c.task.id, patch)}
              />
            ) : (
              <LessonCard
                key={c.lesson.id}
                lesson={c.lesson}
                allTasks={allTasks}
                onUpdateTask={onUpdateTask}
                onToggle={() => onToggleLesson(c.lesson.id)}
                onUpdate={(patch) => onUpdateLesson(c.lesson.id, patch)}
                onToggleHidden={() => onToggleLessonHidden(c.lesson.id)}
                onRemove={() => onRemoveLesson(c.lesson.id)}
                onCreateTask={(taskType) => onCreateTaskInLesson(c.lesson.id, taskType)}
                onAddExistingTask={(task) => onAddExistingTaskInLesson(c.lesson.id, task)}
              />
            ),
          )}

          <div className="cert-course-add-row">
            <AddTaskMenu label="+ Add Task" onCreateNew={onCreateTask} onAddExisting={onAddExistingTask} />
            <span className="cert-add-sep">|</span>
            <button className="cert-add-link" onClick={onAddLesson}>+ Add Lesson</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonCard({
  lesson,
  allTasks,
  onUpdateTask,
  onToggle,
  onUpdate,
  onToggleHidden,
  onRemove,
  onCreateTask,
  onAddExistingTask,
}: {
  lesson: CertLesson;
  allTasks: CertTask[];
  onUpdateTask: (taskId: string, patch: Partial<CertTask>) => void;
  onToggle: () => void;
  onUpdate: (patch: Partial<CertLesson>) => void;
  onToggleHidden: () => void;
  onRemove: () => void;
  onCreateTask: (taskType: TaskTypeKey) => void;
  onAddExistingTask: (task: Task) => void;
}) {
  return (
    <div className={`cert-lesson ${lesson.expanded ? "expanded" : ""} ${lesson.hidden ? "hidden" : ""}`}>
      <div className="cert-lesson-header" onClick={onToggle}>
        <span className="cert-row-drag"><DragHandleIcon /></span>
        <span className="cert-lesson-caret">{lesson.expanded ? "▾" : "▸"}</span>
        <div className="cert-lesson-titles">
          <div className="cert-lesson-eyebrow">
            LESSON · {(lesson.nameEn || "Untitled Lesson").toUpperCase()}
            {lesson.hidden && <span className="cert-hidden-pill">Hidden</span>}
          </div>
          <div className="cert-lesson-meta">{lesson.tasks.length} Tasks</div>
        </div>
        <button
          className={`cert-course-eye ${lesson.hidden ? "is-hidden" : ""}`}
          aria-label={lesson.hidden ? "Show Lesson" : "Hide Lesson"}
          aria-pressed={lesson.hidden}
          onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
        >
          {lesson.hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <div className="cert-node-menu" onClick={(e) => e.stopPropagation()}>
          <Dropdown
            width={190}
            align="right"
            trigger={({ toggle }) => (
              <button className="cert-course-menu" aria-label="More" onClick={toggle}>⋯</button>
            )}
          >
            {({ close }) => (
              <div className="menu">
                <button className="menu-item danger" onClick={() => { onRemove(); close(); }}>
                  Remove Lesson
                </button>
              </div>
            )}
          </Dropdown>
        </div>
      </div>

      {lesson.expanded && (
        <>
          <div className="cert-node-edit in-lesson">
            <label className="cert-edit-label">Lesson name <span className="req">*</span></label>
            <LangField
              en={lesson.nameEn}
              es={lesson.nameEs}
              placeholderEn="Lesson name"
              placeholderEs="Nombre de la lección"
              onChangeEn={(v) => onUpdate({ nameEn: v })}
              onChangeEs={(v) => onUpdate({ nameEs: v })}
            />
            <label className="cert-edit-label">Lesson description</label>
            <RichTextField
              compact
              en={lesson.descEn}
              es={lesson.descEs}
              placeholderEn="Describe this Lesson"
              placeholderEs="Describe esta lección"
              onChangeEn={(v) => onUpdate({ descEn: v })}
              onChangeEs={(v) => onUpdate({ descEs: v })}
            />
          </div>

          {lesson.tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              allTasks={allTasks}
              inLesson
              onUpdate={(patch) => onUpdateTask(t.id, patch)}
            />
          ))}
          <div className="cert-lesson-add">
            <AddTaskMenu label="+ Add Task to Lesson" onCreateNew={onCreateTask} onAddExisting={onAddExistingTask} />
          </div>
        </>
      )}
    </div>
  );
}

// A Task row in the cert tree. Shows the Task plus an Access Restriction control
// that expands an inline editor.
function TaskRow({
  task,
  allTasks,
  inLesson,
  onUpdate,
}: {
  task: CertTask;
  allTasks: CertTask[];
  inLesson?: boolean;
  onUpdate: (patch: Partial<CertTask>) => void;
}) {
  const [open, setOpen] = useState(false);
  const restricted = !!task.restriction?.enabled;
  return (
    <>
      <div className={`cert-row task ${inLesson ? "in-lesson" : ""}`}>
        <span className="cert-row-drag"><DragHandleIcon /></span>
        <TaskKindBadge kind={task.kind} />
        <span className="cert-row-name">{task.name}</span>
        <span className="cert-row-meta">· {KIND_LABEL[task.kind].label} · {task.duration}</span>
        {restricted && <span className="cert-restricted-pill">Restricted</span>}
        <button
          className={`cert-row-restrict ${restricted ? "active" : ""} ${open ? "open" : ""}`}
          aria-label="Access restrictions"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <LockIcon />
        </button>
      </div>
      {open && (
        <AccessRestrictionEditor task={task} allTasks={allTasks} inLesson={inLesson} onUpdate={onUpdate} />
      )}
    </>
  );
}

function AccessRestrictionEditor({
  task,
  allTasks,
  inLesson,
  onUpdate,
}: {
  task: CertTask;
  allTasks: CertTask[];
  inLesson?: boolean;
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
    <div className={`cert-restrict-edit ${inLesson ? "in-lesson" : ""}`}>
      <div className="cert-restrict-head">
        <div className="cert-restrict-head-text">
          <div className="cert-restrict-title">Access restriction</div>
          <div className="cert-restrict-desc">
            Block learners from starting this Task until they satisfy other Tasks in this Certification.
          </div>
        </div>
        <button
          className={`toggle ${r.enabled ? "on" : ""}`}
          onClick={() => setR({ enabled: !r.enabled })}
          aria-pressed={r.enabled}
        >
          <span className="toggle-knob" />
        </button>
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
              <strong>Completed</strong> for every Task type, except <strong>ID-Upload</strong>, which is
              also satisfied at <strong>In-Review</strong>.
            </p>
          </>
        ))}
    </div>
  );
}

// "+ Add Task" entry point. Opens a menu with two paths: add an existing Task
// from the library (searchable), or create a new Task (pick a type → opens the
// split-screen Task creation UI).
function AddTaskMenu({
  label,
  onCreateNew,
  onAddExisting,
}: {
  label: string;
  onCreateNew: (t: TaskTypeKey) => void;
  onAddExisting: (task: Task) => void;
}) {
  return (
    <Dropdown
      width={300}
      direction="up"
      trigger={({ toggle }) => (
        <button className="cert-add-link" onClick={toggle}>{label}</button>
      )}
    >
      {({ close }) => (
        <AddTaskMenuContent
          onCreateNew={(t) => { onCreateNew(t); close(); }}
          onAddExisting={(task) => { onAddExisting(task); close(); }}
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
  onAddExisting: (task: Task) => void;
}) {
  const [mode, setMode] = useState<"root" | "create" | "existing">("root");
  const [query, setQuery] = useState("");

  if (mode === "root") {
    return (
      <div className="menu">
        <button className="menu-item" onClick={() => setMode("existing")}>
          <span className="menu-item-icon"><SearchIcon /></span>
          Add Existing Task
        </button>
        <button className="menu-item" onClick={() => setMode("create")}>
          <span className="menu-item-icon"><AddIcon /></span>
          Create New Task
        </button>
      </div>
    );
  }

  if (mode === "create") {
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

  const q = query.trim().toLowerCase();
  const results = taskLibrary.filter(
    (t) => !q || t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q),
  );

  return (
    <div className="cond-picker">
      <button className="menu-back" onClick={() => setMode("root")}>‹ Add Existing Task</button>
      <div className="dropdown-search">
        <span className="dropdown-search-icon"><SearchIcon /></span>
        <input
          autoFocus
          placeholder="Search Tasks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="dropdown-list cond-picker-list">
        {results.length === 0 ? (
          <div className="cond-picker-empty">No Tasks match your search.</div>
        ) : (
          results.map((t) => (
            <button key={t.id} className="cond-picker-item" onClick={() => onAddExisting(t)}>
              <TaskKindBadge kind={TASK_TYPE_TO_KIND[t.type]} />
              <span className="cond-picker-item-name">{t.name}</span>
              <span className="cond-picker-item-meta">{t.type}</span>
            </button>
          ))
        )}
      </div>
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
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  criteriaLocked?: boolean;
  onUnlockCriteria?: () => void;
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
        <p className="form-help cond-intro">
          The Certification is complete when a learner satisfies <strong>any one</strong> Condition
          Set in full. Within a Condition Set, <strong>all</strong> items must be completed.
        </p>

        <CompletionCriteriaGate locked={criteriaLocked} onUnlock={() => onUnlockCriteria?.()}>
          {sets.length === 0 ? (
            <div className="cert-empty-hint">
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
      <section className="form-section">
        <h2 className="form-section-title">Visibility</h2>
        <div className="radio-card-group">
          <RadioCard
            selected={data.visibility === "visible"}
            onSelect={() => update({ visibility: "visible" })}
            title="Visible"
            desc="Learners can find and start this Certification."
          />
          <RadioCard
            selected={data.visibility === "hidden"}
            onSelect={() => update({ visibility: "hidden" })}
            title="Hidden"
            desc="Cert exists but is not discoverable. Already-enrolled learners lose access too."
          />
        </div>
        <p className="form-help">To retire a Certification, use the Archiving step.</p>
      </section>

      <div className="form-divider" />

      <section className="form-section">
        <h2 className="form-section-title">Paywall</h2>
        <div className="form-sub-group">
          <label className="form-sub-label">Access type</label>
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
          <div className="form-sub-group">
            <label className="form-sub-label">Price IDs</label>
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
          <div className="form-sub-group">
            <label className="form-sub-label">Progress on repurchase</label>
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
      </section>

      <div className="form-divider" />

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
    <section className="form-section">
      <div className="cv-section-head">
        <h2 className="form-section-title">Content Tags for Visibility</h2>
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
      <p className="form-section-desc">
        Tag this Certification to control which Tenants can see it. Trade and Partnership values come
        from the B2B Management fields in Product Config, and a Tenant must match every tag type you
        set (within a type, matching any one value is enough). Add as many tags of each type as you need.
      </p>

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

      <div className="cv-scope-note">
        <span className="cv-scope-dot" />
        {scopeNote}
      </div>
    </section>
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
      <section className="form-section">
        <div className="form-warning">
          <span className="form-warning-icon"><WarnIcon /></span>
          <div>
            <strong>Archiving is permanent.</strong> Once archived, this Certification is
            retired from the catalog and can't be un-archived. Enrolled learners keep their
            completion record and are pointed to the replacement Certification(s) below.
          </div>
        </div>

        <div className="toggle-row">
          <div className="toggle-text">
            <div className="toggle-label">Archive this Certification</div>
            <div className="toggle-sub">
              Retires the Certification and removes it from the catalog. This action is
              permanent and cannot be undone.
            </div>
          </div>
          <button
            className={`toggle ${data.archived ? "on" : ""}`}
            onClick={() => update({ archived: !data.archived })}
            aria-pressed={data.archived}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </section>

      <div className="form-divider" />

      <section className="form-section">
        <h2 className="form-section-title">Replacement &amp; alert</h2>
        <p className="form-section-desc">
          Configure what enrolled learners see once this Certification is archived.
        </p>

        <div className="form-sub-group">
          <label className="form-sub-label">Replacement Certifications</label>
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
            <button className="cond-add">+ Add replacement Certification</button>
          </div>
          <p className="form-help">When this Cert is archived, learners are pointed to the replacement(s) in their Path.</p>
        </div>

        <div className="form-sub-group">
          <label className="form-sub-label">Replacement alert</label>
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
      </section>
    </>
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
      <input
        className="lang-field-input"
        value={en}
        placeholder={placeholderEn}
        onChange={(e) => onChangeEn(e.target.value)}
      />
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <input
          className="lang-field-input"
          value={es}
          placeholder={placeholderEs}
          onChange={(e) => onChangeEs(e.target.value)}
        />
        <span className="lang-tag">ESPAÑOL</span>
      </div>
    </div>
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
  // Compact (inline-tree) editors only reveal a toolbar on focus; the full-size
  // editors keep the toolbar pinned to English, matching their prior behaviour.
  const [focus, setFocus] = useState<"en" | "es" | null>(compact ? null : "en");
  const blur = compact ? () => setFocus(null) : undefined;

  return (
    <div className={`rte-field ${compact ? "rte-field--compact" : ""}`}>
      {focus === "en" && <RteToolbar />}
      <AutoTextarea
        className="rte-area"
        value={en}
        placeholder={placeholderEn}
        onChange={onChangeEn}
        onFocus={() => setFocus("en")}
        onBlur={blur}
      />
      <div className="rte-field-divider" />
      {focus === "es" && <RteToolbar />}
      <div className="rte-lang-row">
        <AutoTextarea
          className="rte-area"
          value={es}
          placeholder={placeholderEs}
          onChange={onChangeEs}
          onFocus={() => setFocus("es")}
          onBlur={blur}
        />
        <span className="lang-tag floating">ESPAÑOL</span>
      </div>
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
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
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
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export type { WizardData as CertWizardData, CertCourse, CertTask, TaskKind };
