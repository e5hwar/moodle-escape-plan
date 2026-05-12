import { useLayoutEffect, useRef, useState } from "react";
import {
  CheckBoldIcon,
  ChevronLeftIcon,
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

type CareerStage = "apprentice" | "journeyman" | "master";
type Visibility = "visible" | "hidden" | "archived";
type AccessType = "open" | "non-consumable" | "consumable";
type TimeUnit = "minutes" | "hours" | "days" | "weeks";
type AnyAll = "any" | "all";

type TaskKind = "xapi" | "quiz" | "hands-on" | "id-upload" | "file" | "url";

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

type CompletionCondition =
  | {
      kind: "tasks";
      id: string;
      mode: AnyAll;
      tasks: { id: string; name: string; kind: TaskKind; rule: string }[];
    }
  | {
      kind: "certs";
      id: string;
      mode: AnyAll;
      certs: { id: string; name: string }[];
    };

type WizardData = {
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  thumbnail: { name: string; size: number; w: number; h: number } | null;
  timeValue: string;
  timeUnit: TimeUnit;
  careerStage: CareerStage;
  ceus: string;
  industries: string[];

  forceOrder: boolean;
  courses: CertCourse[];

  completionMode: AnyAll;
  completionConditions: CompletionCondition[];
  allowPerUserDueDates: boolean;

  visibility: Visibility;
  accessType: AccessType;
  price: string;
  announceEn: string;
  announceEs: string;
  replacementCerts: { id: string; name: string }[];
  replaceAlertEn: string;
  replaceAlertEs: string;
};

const SAMPLE_COURSES: CertCourse[] = [
  {
    id: "co1",
    name: "Foundations",
    expanded: true,
    children: [
      { kind: "task", task: { id: "t-w608", name: "Welcome to EPA 608", kind: "xapi", duration: "8 min" } },
      { kind: "task", task: { id: "t-id", name: "Government ID Upload", kind: "id-upload", duration: "2 min" } },
      {
        kind: "lesson",
        lesson: {
          id: "le-rb",
          name: "Refrigerant Basics",
          tasks: [
            { id: "t-rid", name: "Refrigerant identification", kind: "xapi", duration: "12 min" },
            { id: "t-pt", name: "Pressure-temperature charts", kind: "xapi", duration: "9 min" },
            { id: "t-ridq", name: "Refrigerant identification quiz", kind: "quiz", duration: "10 min" },
          ],
        },
      },
    ],
  },
  {
    id: "co2",
    name: "Refrigerant Recovery",
    expanded: true,
    children: [
      { kind: "task", task: { id: "t-rec", name: "Recovery procedures overview", kind: "xapi", duration: "15 min" } },
      { kind: "task", task: { id: "t-cyl", name: "Recovery cylinder requirements", kind: "xapi", duration: "8 min" } },
      { kind: "task", task: { id: "t-recq", name: "Recovery procedures quiz", kind: "quiz", duration: "12 min" } },
      { kind: "task", task: { id: "t-rho", name: "Field exercise: simulated recovery", kind: "hands-on", duration: "30 min" } },
    ],
  },
  {
    id: "co3",
    name: "Federal Regulations",
    expanded: false,
    children: [
      { kind: "task", task: { id: "t-fr1", name: "Section 608 overview", kind: "xapi", duration: "20 min" } },
      { kind: "task", task: { id: "t-fr2", name: "Federal regulations quiz", kind: "quiz", duration: "25 min" } },
    ],
  },
  {
    id: "co4",
    name: "Certification Exam",
    expanded: false,
    children: [
      { kind: "task", task: { id: "t-final", name: "EPA 608 Universal Final Exam", kind: "quiz", duration: "45 min" } },
      { kind: "task", task: { id: "t-proc", name: "Proctoring footage submission", kind: "hands-on", duration: "15 min" } },
    ],
  },
];

const SAMPLE_COMPLETION: CompletionCondition[] = [
  {
    kind: "tasks",
    id: "cc1",
    mode: "all",
    tasks: [
      { id: "t-id", name: "Government ID Upload", kind: "id-upload", rule: "must be approved by Proctoring" },
      { id: "t-final", name: "EPA 608 Universal Final Exam", kind: "quiz", rule: "must pass" },
      { id: "t-proc", name: "Proctoring footage submission", kind: "hands-on", rule: "must be approved" },
    ],
  },
  {
    kind: "certs",
    id: "cc2",
    mode: "all",
    certs: [
      { id: "C-0420", name: "EPA 608 Type I" },
      { id: "C-0419", name: "EPA 608 Type II" },
      { id: "C-0418", name: "EPA 608 Type III" },
    ],
  },
];

const INITIAL_DATA: WizardData = {
  nameEn: "EPA 608 Universal",
  nameEs: "EPA 608 Universal",
  descEn:
    "Comprehensive EPA Section 608 certification covering Type I (small appliances), Type II (high pressure), and Type III (low pressure). Required for any technician handling refrigerants in stationary HVAC/R systems.",
  descEs:
    "Certificación EPA Sección 608 integral que cubre Tipo I (electrodomésticos pequeños), Tipo II (alta presión) y Tipo III (baja presión).",
  thumbnail: { name: "epa-608-cover.jpg", size: 218 * 1024, w: 1280, h: 720 },
  timeValue: "12",
  timeUnit: "hours",
  careerStage: "journeyman",
  ceus: "2.4",
  industries: ["HVAC", "HVAC › Residential", "HVAC › Commercial"],

  forceOrder: false,
  courses: SAMPLE_COURSES,

  completionMode: "any",
  completionConditions: SAMPLE_COMPLETION,
  allowPerUserDueDates: false,

  visibility: "visible",
  accessType: "non-consumable",
  price: "149.00",
  announceEn:
    "⚠️ Federal regulations updated Jan 2026. Refrigerant identification module has been revised — review the updated Refrigerant Identification Lesson before attempting the Final Exam.",
  announceEs:
    "⚠️ Las regulaciones federales se actualizaron en enero de 2026. Revise el módulo de identificación de refrigerantes actualizado.",
  replacementCerts: [{ id: "C-0612", name: "EPA 608 Universal (2026 Edition)" }],
  replaceAlertEn:
    "This Certification has been retired. Please complete the EPA 608 Universal (2026 Edition), which reflects the latest federal regulations and replaces this version.",
  replaceAlertEs:
    "Esta Certificación ha sido retirada. Complete la EPA 608 Universal (Edición 2026) que reemplaza esta versión.",
};

const STEPS = [
  { id: "details", label: "Details", sub: "Name, description, metadata", desc: "Name, describe, and tag this Certification." },
  { id: "tasks", label: "Add Tasks", sub: "Courses, lessons, and tasks", desc: "Build this Certification's structure: Courses contain Lessons (optional) and Tasks. Tasks can be pulled from the Task library or created fresh — newly created Tasks are added to the library too." },
  { id: "completion", label: "Completion", sub: "How completion is determined", desc: "Define what marks this Certification as complete. Combine multiple conditions with Any/All logic." },
  { id: "settings", label: "Other Settings", sub: "Visibility, paywall, archiving", desc: "Visibility, paywall, announcements, and archival behavior." },
];

type Props = { onClose: () => void };

export function NewCertificationWizard({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
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
          <div className="wizard-breadcrumb">
            <button className="wizard-back-btn" onClick={onClose}>
              <ChevronLeftIcon />
              BACK
            </button>
            <span className="sep">/</span>
            <span className="wizard-current">NEW CERTIFICATION</span>
          </div>

          <div className="wizard-type-badge cert">Certification</div>

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
        </aside>

        <div className="wizard-content">
          <h1 className="wizard-title">{STEPS[step].label}</h1>
          <p className="wizard-desc">{STEPS[step].desc}</p>

          {step === 0 && <DetailsStep data={data} update={update} />}
          {step === 1 && (
            <TasksStep
              data={data}
              update={update}
              onAddTask={(courseId, lessonId) => setSplitTask({ courseId, lessonId })}
            />
          )}
          {step === 2 && <CompletionStep data={data} update={update} />}
          {step === 3 && <SettingsStep data={data} update={update} />}
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <span className="wizard-saved">Last saved 2 minutes ago</span>
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          <button className="btn-save-draft" onClick={onClose}>Save as draft</button>
          <button className="btn-publish" onClick={onClose}>Publish</button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────  Step 1: Details  ───────────────── */

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
              onClick={() => update({ careerStage: s })}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">CEUs awarded</label>
        <div className="time-row">
          <input
            className="form-input no-spinner small"
            type="text"
            inputMode="decimal"
            value={data.ceus}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*\.?\d*$/.test(v)) update({ ceus: v });
            }}
          />
          <span className="form-suffix">CEUs upon completion</span>
        </div>
        <p className="form-help">Decimal values supported. Leave blank if no CEUs are issued.</p>
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

/* ─────────────────  Step 2: Tasks tree  ───────────────── */

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

/* ─────────────────  Step 3: Completion  ───────────────── */

function CompletionStep({
  data,
  update,
}: {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
}) {
  function removeCondition(id: string) {
    update({
      completionConditions: data.completionConditions.filter((c) => c.id !== id),
    });
  }

  function setMode(id: string, mode: AnyAll) {
    update({
      completionConditions: data.completionConditions.map((c) =>
        c.id === id ? { ...c, mode } : c,
      ),
    });
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Completion criteria <span className="req">*</span>
        </label>
        <div className="completion-wrap">
          <div className="completion-top">
            <span>Mark this Certification complete when</span>
            <select
              className="form-select pill-select"
              value={data.completionMode}
              onChange={(e) => update({ completionMode: e.target.value as AnyAll })}
            >
              <option value="any">Any</option>
              <option value="all">All</option>
            </select>
            <span>of the conditions below is met</span>
          </div>

          {data.completionConditions.map((cond, idx) => (
            <div key={cond.id} className="cond-card">
              <div className="cond-header">
                <span className="cond-num">{idx + 1}</span>
                <span className="cond-title">
                  {cond.kind === "tasks" ? "Completion of Selected Tasks" : "Completion of Other Certifications"}
                </span>
                <button className="cond-remove" onClick={() => removeCondition(cond.id)}>
                  <SmallXIcon />
                </button>
              </div>
              <div className="cond-mode-row">
                <span>Cert completes when</span>
                <select
                  className="form-select pill-select small-pill"
                  value={cond.mode}
                  onChange={(e) => setMode(cond.id, e.target.value as AnyAll)}
                >
                  <option value="all">All</option>
                  <option value="any">Any</option>
                </select>
                <span>
                  of these {cond.kind === "tasks" ? "Tasks" : "Certifications"} are completed:
                </span>
              </div>
              <div className="cond-list">
                {cond.kind === "tasks"
                  ? cond.tasks.map((t) => (
                      <div key={t.id} className="cond-row">
                        <TaskKindBadge kind={t.kind} />
                        <span className="cond-row-name">{t.name}</span>
                        <span className="cond-row-rule">· {t.rule}</span>
                        <button className="cond-row-x"><SmallXIcon /></button>
                      </div>
                    ))
                  : cond.certs.map((c) => (
                      <div key={c.id} className="cond-row">
                        <span className="task-kind-badge cert">C</span>
                        <span className="cond-row-name">{c.name}</span>
                        <button className="cond-row-x"><SmallXIcon /></button>
                      </div>
                    ))}
                <button className="cond-add">+ Add {cond.kind === "tasks" ? "Task" : "Certification"}</button>
              </div>
            </div>
          ))}

          <button
            className="cert-add-course inline"
            onClick={() =>
              update({
                completionConditions: [
                  ...data.completionConditions,
                  {
                    kind: "tasks",
                    id: `cc-${Date.now()}`,
                    mode: "all",
                    tasks: [],
                  },
                ],
              })
            }
          >
            + Add another condition
          </button>
        </div>
        <p className="form-help">
          Any change to completion criteria resets completion data for all enrolled users. Awards already issued are not revoked.
        </p>
      </div>

      <div className="form-divider" />

      <section className="form-section">
        <h2 className="form-section-title">Due dates</h2>
        <div className="toggle-row">
          <div className="toggle-text">
            <div className="toggle-label">Allow per-user due dates</div>
            <div className="toggle-sub">
              B2B managers and SkillCat Admins can assign individual due dates per learner. Due dates are reminders only — they don't block access after the date passes.
            </div>
          </div>
          <button
            className={`toggle ${data.allowPerUserDueDates ? "on" : ""}`}
            onClick={() => update({ allowPerUserDueDates: !data.allowPerUserDueDates })}
            aria-pressed={data.allowPerUserDueDates}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </section>
    </>
  );
}

/* ─────────────────  Step 4: Other Settings  ───────────────── */

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
          <RadioCard
            selected={data.visibility === "archived"}
            onSelect={() => update({ visibility: "archived" })}
            title="Archived"
            desc="Cert is retired. Replacement Certifications below are surfaced to enrolled learners."
          />
        </div>
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
                value={data.price}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) update({ price: v });
                }}
              />
            </div>
          </div>
        )}
      </section>

      <div className="form-divider" />

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
        <h2 className="form-section-title">Archival &amp; replacement</h2>
        <p className="form-section-desc">Configure what happens when this Certification is archived.</p>

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
