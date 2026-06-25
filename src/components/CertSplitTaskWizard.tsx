import { NewTaskWizard } from "./NewTaskWizard";
import type { TaskTypeKey } from "./Footer";
import type { CertWizardData, CertCourse, CertTask, TaskKind } from "./NewCertificationWizard";

const KIND_LETTER: Record<TaskKind, { letter: string; cls: string; full: string }> = {
  xapi: { letter: "X", cls: "xapi", full: "xAPI" },
  quiz: { letter: "Q", cls: "quiz", full: "Quiz" },
  "hands-on": { letter: "H", cls: "handson", full: "Hands-On" },
  "id-upload": { letter: "ID", cls: "idup", full: "ID Upload" },
  file: { letter: "F", cls: "file", full: "File" },
  url: { letter: "U", cls: "url", full: "URL" },
};

// The cert tree's CertTask.kind is a TaskKind; Footer's TaskTypeKey additionally
// has "deep-link", which is represented as a URL Task within the cert structure.
const TYPE_KEY_TO_KIND: Record<TaskTypeKey, TaskKind> = {
  xapi: "xapi",
  quiz: "quiz",
  "hands-on": "hands-on",
  "id-upload": "id-upload",
  file: "file",
  "deep-link": "url",
  url: "url",
};

const TYPE_KEY_DURATION: Record<TaskTypeKey, string> = {
  xapi: "10 min",
  quiz: "15 min",
  "hands-on": "30 min",
  "id-upload": "2 min",
  file: "5 min",
  "deep-link": "5 min",
  url: "5 min",
};

type Props = {
  cert: CertWizardData;
  taskType: TaskTypeKey;
  targetCourseId: string;
  targetLessonId?: string;
  onClose: () => void;
  onAdd: (task: CertTask) => void;
};

export function CertSplitTaskWizard({
  cert,
  taskType,
  targetCourseId,
  targetLessonId,
  onClose,
  onAdd,
}: Props) {
  const kind = TYPE_KEY_TO_KIND[taskType];

  return (
    // Three columns: the leftmost cert structure tree, then the real Task
    // creation UI (its nav + content) embedded as the middle and right columns.
    <div className="cert-split">
      <aside className="cert-split-tree">
        <button className="cert-split-back" onClick={onClose}>‹ {cert.nameEn || "Untitled Certification"}</button>
        <div className="cert-split-tree-body">
          {cert.courses.map((co, idx) => (
            <CourseBlock
              key={co.id}
              course={co}
              index={idx + 1}
              newKind={kind}
              showNewIn={co.id === targetCourseId ? targetLessonId ?? "course" : null}
            />
          ))}
          <button className="cert-split-add">+ Add Course</button>
        </div>
      </aside>

      <NewTaskWizard
        taskType={taskType}
        onClose={onClose}
        savedLabel="Last saved 1 minute ago"
        primaryLabel="Add to Certification"
        onPrimary={(taskName) =>
          onAdd({ id: `t-${Date.now()}`, name: taskName, kind, duration: TYPE_KEY_DURATION[taskType] })
        }
      />
    </div>
  );
}

function CourseBlock({
  course,
  index,
  newKind,
  showNewIn,
}: {
  course: CertCourse;
  index: number;
  newKind: TaskKind;
  // null → don't show the in-progress row here; "course" → directly under the
  // course; otherwise the lesson id the new Task is being added to.
  showNewIn: string | null;
}) {
  return (
    <div className="cert-split-course">
      <div className="cert-split-course-header">
        <span className="cert-split-course-caret">▾</span>
        <span className="cert-split-course-num">{index}</span>
        <span className="cert-split-course-name">{course.nameEn || "Untitled Course"}</span>
      </div>
      <div className="cert-split-course-body">
        {course.children.map((c) =>
          c.kind === "task" ? (
            <div key={c.task.id} className="cert-split-row">
              <span className={`task-kind-badge ${KIND_LETTER[c.task.kind].cls}`}>{KIND_LETTER[c.task.kind].letter}</span>
              <span className="cert-split-row-name">{c.task.name}</span>
            </div>
          ) : (
            <div key={c.lesson.id} className="cert-split-lesson">
              <div className="cert-split-lesson-name">L {(c.lesson.nameEn || "Untitled Lesson").toUpperCase()}</div>
              {c.lesson.tasks.map((t) => (
                <div key={t.id} className="cert-split-row in-lesson">
                  <span className={`task-kind-badge ${KIND_LETTER[t.kind].cls}`}>{KIND_LETTER[t.kind].letter}</span>
                  <span className="cert-split-row-name">{t.name}</span>
                </div>
              ))}
              {showNewIn === c.lesson.id && <NewTaskRow kind={newKind} inLesson />}
            </div>
          ),
        )}
        {showNewIn === "course" && <NewTaskRow kind={newKind} />}
      </div>
    </div>
  );
}

// The in-progress Task being created, highlighted in the tree at its target.
function NewTaskRow({ kind, inLesson }: { kind: TaskKind; inLesson?: boolean }) {
  return (
    <div className={`cert-split-row ${inLesson ? "in-lesson " : ""}active`}>
      <span className={`task-kind-badge ${KIND_LETTER[kind].cls}`}>{KIND_LETTER[kind].letter}</span>
      <span className="cert-split-row-name">New {KIND_LETTER[kind].full} Task</span>
      <span className="cert-split-row-dot" />
    </div>
  );
}
