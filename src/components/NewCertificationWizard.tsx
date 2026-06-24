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
import { type Certification } from "../data/certifications";
import { DEFAULT_PARTNERSHIPS, DEFAULT_TRADES } from "../data/productConfig";

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

type CertTask = {
  id: string;
  name: string;
  kind: TaskKind;
  duration: string;
};

type CertLesson = {
  id: string;
  name: string;
  tasks: CertTask[];
};

type CourseChild =
  | { kind: "task"; task: CertTask }
  | { kind: "lesson"; lesson: CertLesson };

type CertCourse = {
  id: string;
  name: string;
  expanded: boolean;
  children: CourseChild[];
};

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

  conditionSets: ConditionSet[];

  visibility: Visibility;
  accessType: AccessType;
  consumableProgress: ConsumableProgress;
  price: string;
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

  conditionSets: [],

  visibility: "visible",
  accessType: "open",
  // Preserve is the safe default; Reset is opted into per the OSHA case.
  consumableProgress: "preserve",
  price: "",
  contentTags: [],

  archived: false,
  replacementCerts: [],
  replaceAlertEn: "",
  replaceAlertEs: "",
};

// When editing, prefill the fields the Certification record actually carries.
// Structural data (courses, completion) isn't stored on the list record, so
// those steps open empty just like a fresh Certification.
function buildInitialData(editing?: Certification): WizardData {
  if (!editing) return BLANK_DATA;
  const vis = editing.visibility ?? "Visible";
  return {
    ...BLANK_DATA,
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
  const [splitTask, setSplitTask] = useState<{ courseId: string; lessonId?: string } | null>(null);

  const update = (patch: Partial<WizardData>) => setData((d) => ({ ...d, ...patch }));

  if (splitTask) {
    return (
      <CertSplitTaskWizard
        cert={data}
        onClose={() => setSplitTask(null)}
        onAdd={(task) => {
          const next = data.courses.map((co) => {
            if (co.id !== splitTask.courseId) return co;
            if (splitTask.lessonId) {
              return {
                ...co,
                children: co.children.map((c) =>
                  c.kind === "lesson" && c.lesson.id === splitTask.lessonId
                    ? { kind: "lesson" as const, lesson: { ...c.lesson, tasks: [...c.lesson.tasks, task] } }
                    : c,
                ),
              };
            }
            return { ...co, children: [...co.children, { kind: "task" as const, task }] };
          });
          update({ courses: next });
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
              onAddTask={(courseId, lessonId) => setSplitTask({ courseId, lessonId })}
            />
          )}
          {step === 3 && <CompletionStep data={data} update={update} />}
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
  onAddTask,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
  onAddTask: (courseId: string, lessonId?: string) => void;
}) {
  function toggleCourse(id: string) {
    update({
      courses: data.courses.map((c) =>
        c.id === id ? { ...c, expanded: !c.expanded } : c,
      ),
    });
  }

  function addLesson(courseId: string) {
    update({
      courses: data.courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              expanded: true,
              children: [
                ...c.children,
                { kind: "lesson", lesson: { id: `le-${Date.now()}`, name: "New Lesson", tasks: [] } },
              ],
            }
          : c,
      ),
    });
  }

  function addCourse() {
    update({
      courses: [
        ...data.courses,
        { id: `co-${Date.now()}`, name: "New Course", expanded: true, children: [] },
      ],
    });
  }

  return (
    <>
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
        {data.courses.length === 0 && (
          <div className="cert-empty-hint">No Courses yet. Add a Course to start building this Certification.</div>
        )}
        {data.courses.map((course, idx) => (
          <CourseCard
            key={course.id}
            course={course}
            index={idx + 1}
            onToggle={() => toggleCourse(course.id)}
            onAddTask={() => onAddTask(course.id)}
            onAddLesson={() => addLesson(course.id)}
            onAddTaskInLesson={(lessonId) => onAddTask(course.id, lessonId)}
          />
        ))}

        <button className="cert-add-course" onClick={addCourse}>+ Add Course</button>
      </div>
    </>
  );
}

function CourseCard({
  course,
  index,
  onToggle,
  onAddTask,
  onAddLesson,
  onAddTaskInLesson,
}: {
  course: CertCourse;
  index: number;
  onToggle: () => void;
  onAddTask: () => void;
  onAddLesson: () => void;
  onAddTaskInLesson: (lessonId: string) => void;
}) {
  const stats = courseStats(course);
  return (
    <div className={`cert-course ${course.expanded ? "expanded" : ""}`}>
      <div className="cert-course-header" onClick={onToggle}>
        <span className="cert-course-drag"><DragHandleIcon /></span>
        <span className="cert-course-caret">{course.expanded ? "▾" : "▸"}</span>
        <span className="cert-course-num">{index}</span>
        <div className="cert-course-titles">
          <div className="cert-course-name">{course.name}</div>
          <div className="cert-course-meta">
            {stats.tasks} Tasks
            {stats.lessons > 0 && ` · ${stats.lessons} Lesson${stats.lessons > 1 ? "s" : ""}`}
            {stats.minutes > 0 && ` · ${formatDuration(stats.minutes)}`}
          </div>
        </div>
        <button className="cert-course-eye" aria-label="Visibility" onClick={(e) => e.stopPropagation()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="2.6" />
          </svg>
        </button>
        <button className="cert-course-menu" aria-label="More" onClick={(e) => e.stopPropagation()}>⋯</button>
      </div>

      {course.expanded && (
        <div className="cert-course-body">
          {course.children.map((c) =>
            c.kind === "task" ? (
              <div key={c.task.id} className="cert-row task">
                <span className="cert-row-drag"><DragHandleIcon /></span>
                <TaskKindBadge kind={c.task.kind} />
                <span className="cert-row-name">{c.task.name}</span>
                <span className="cert-row-meta">· {KIND_LABEL[c.task.kind].label} · {c.task.duration}</span>
              </div>
            ) : (
              <div key={c.lesson.id} className="cert-lesson">
                <div className="cert-lesson-header">
                  <span className="cert-row-drag"><DragHandleIcon /></span>
                  <div className="cert-lesson-titles">
                    <div className="cert-lesson-eyebrow">LESSON · {c.lesson.name.toUpperCase()}</div>
                    <div className="cert-lesson-meta">{c.lesson.tasks.length} Tasks</div>
                  </div>
                  <button className="cert-course-menu" aria-label="More" onClick={(e) => e.stopPropagation()}>⋯</button>
                </div>
                {c.lesson.tasks.map((t) => (
                  <div key={t.id} className="cert-row task in-lesson">
                    <span className="cert-row-drag"><DragHandleIcon /></span>
                    <TaskKindBadge kind={t.kind} />
                    <span className="cert-row-name">{t.name}</span>
                    <span className="cert-row-meta">· {KIND_LABEL[t.kind].label} · {t.duration}</span>
                  </div>
                ))}
                <div className="cert-lesson-add">
                  <button className="cert-add-link" onClick={() => onAddTaskInLesson(c.lesson.id)}>+ Add Task to Lesson</button>
                </div>
              </div>
            ),
          )}

          <div className="cert-course-add-row">
            <button className="cert-add-link" onClick={onAddTask}>+ Add Task</button>
            <span className="cert-add-sep">|</span>
            <button className="cert-add-link" onClick={onAddLesson}>+ Add Lesson</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────  Step 4: Completion  ───────────────── */

// Temporary GUI cap (spec 7.3.7.1) — V1 needs at most 2 Condition Sets; more
// can be enabled later.
const MAX_CONDITION_SETS = 3;

// In the real product, "+ Add item" opens a Task / Certification picker. These
// small pools stand in for that picker so the prototype's structure is testable.
// The GUI is limited to Tasks within the Certification (per spec).
const SAMPLE_TASKS: { name: string; taskKind: TaskKind }[] = [
  { name: "EPA 608 Universal Final Exam", taskKind: "quiz" },
  { name: "Government ID Upload", taskKind: "id-upload" },
  { name: "Recovery Procedures Quiz", taskKind: "quiz" },
  { name: "Proctoring Footage Submission", taskKind: "hands-on" },
  { name: "Section 608 Overview", taskKind: "xapi" },
];
const SAMPLE_CERTS = [
  "EPA 608 Type I",
  "EPA 608 Type II",
  "EPA 608 Type III",
  "OSHA 10 — General Industry",
];

function CompletionStep({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
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

  function addItem(setId: string, kind: "task" | "cert") {
    update({
      conditionSets: sets.map((s) => {
        if (s.id !== setId) return s;
        const n = s.items.length;
        const item: CompletionItem =
          kind === "task"
            ? { kind: "task", id: `it-${Date.now()}`, ...SAMPLE_TASKS[n % SAMPLE_TASKS.length] }
            : { kind: "cert", id: `it-${Date.now()}`, name: SAMPLE_CERTS[n % SAMPLE_CERTS.length] };
        return { ...s, items: [...s.items, item] };
      }),
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
                  onAddItem={(kind) => addItem(set.id, kind)}
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

        <p className="form-help">
          Any change to completion criteria resets completion data for all enrolled users. Awards already issued are not revoked.
        </p>
      </div>
    </>
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
  onAddItem: (kind: "task" | "cert") => void;
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
          width={200}
          trigger={({ toggle }) => (
            <button className="cond-add" onClick={toggle}>+ Add item</button>
          )}
        >
          {({ close }) => (
            <div className="menu">
              <button
                className="menu-item"
                onClick={() => { onAddItem("task"); close(); }}
              >
                <span className="menu-item-icon"><span className="task-kind-badge xapi">T</span></span>
                Task
              </button>
              <button
                className="menu-item"
                onClick={() => { onAddItem("cert"); close(); }}
              >
                <span className="menu-item-icon"><span className="task-kind-badge cert">C</span></span>
                Certification
              </button>
            </div>
          )}
        </Dropdown>
        <span className="cond-qs-note">
          Quiz-Section conditions (EPA and other rare cases) are configured via the database.
        </span>
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
            <label className="form-sub-label">Price</label>
            <div className="price-input">
              <span className="price-input-prefix">$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={data.price}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) update({ price: v });
                }}
              />
            </div>
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
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
}) {
  return (
    <div className="lang-field">
      <input
        className="lang-field-input"
        value={en}
        onChange={(e) => onChangeEn(e.target.value)}
      />
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <input
          className="lang-field-input"
          value={es}
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
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  onFocus?: () => void;
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
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export type { WizardData as CertWizardData, CertCourse, CertTask, TaskKind };
