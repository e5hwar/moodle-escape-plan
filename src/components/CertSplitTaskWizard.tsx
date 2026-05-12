import { useState } from "react";
import { CheckBoldIcon } from "./icons";
import type { CertWizardData, CertCourse, CertTask, TaskKind } from "./NewCertificationWizard";

const KIND_LETTER: Record<TaskKind, { letter: string; cls: string }> = {
  xapi: { letter: "X", cls: "xapi" },
  quiz: { letter: "Q", cls: "quiz" },
  "hands-on": { letter: "H", cls: "handson" },
  "id-upload": { letter: "ID", cls: "idup" },
  file: { letter: "F", cls: "file" },
  url: { letter: "U", cls: "url" },
};

type Tab = "details" | "questions" | "behavior" | "access";

type Props = {
  cert: CertWizardData;
  onClose: () => void;
  onAdd: (task: CertTask) => void;
};

export function CertSplitTaskWizard({ cert, onClose, onAdd }: Props) {
  const [tab, setTab] = useState<Tab>("behavior");
  const [done, setDone] = useState<Record<Tab, boolean>>({
    details: true,
    questions: true,
    behavior: false,
    access: false,
  });
  const [name] = useState("New Quiz Task");
  const [scoreMethod, setScoreMethod] = useState("highest");
  const [passMark, setPassMark] = useState("70");
  const [maxScoreMode, setMaxScoreMode] = useState<"auto" | "manual">("auto");
  const [attemptsMode, setAttemptsMode] = useState<"unlimited" | "limit">("limit");
  const [attemptLimit, setAttemptLimit] = useState("3");

  const tabs: { id: Tab; n: number; label: string }[] = [
    { id: "details", n: 1, label: "Details" },
    { id: "questions", n: 2, label: "Questions" },
    { id: "behavior", n: 3, label: "Behavior" },
    { id: "access", n: 4, label: "Access" },
  ];

  return (
    <div className="cert-split">
      <aside className="cert-split-tree">
        <button className="cert-split-back" onClick={onClose}>‹ {cert.nameEn || "Untitled Certification"}</button>
        <div className="cert-split-tree-body">
          {cert.courses.map((co, idx) => (
            <CourseBlock key={co.id} course={co} index={idx + 1} highlightId="new" />
          ))}
          <button className="cert-split-add">+ Add Course</button>
        </div>
      </aside>

      <div className="cert-split-main">
        <div className="cert-split-header">
          <h1 className="cert-split-task-title">
            <span className="cert-split-task-icon">Q</span>
            {name}
            <span className="cert-split-quiz-badge">QUIZ</span>
          </h1>

          <div className="cert-split-tabs">
            {tabs.map((t, i) => (
              <button
                key={t.id}
                className={`cert-split-tab ${t.id === tab ? "active" : ""} ${done[t.id] ? "done" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className="cert-split-tab-num">
                  {done[t.id] ? <CheckBoldIcon /> : t.n}
                </span>
                {t.label}
                {i < tabs.length - 1 && <span className="cert-split-tab-sep" />}
              </button>
            ))}
          </div>
        </div>

        <div className="cert-split-body">
          {tab === "behavior" ? (
            <BehaviorTab
              scoreMethod={scoreMethod}
              setScoreMethod={setScoreMethod}
              passMark={passMark}
              setPassMark={setPassMark}
              maxScoreMode={maxScoreMode}
              setMaxScoreMode={setMaxScoreMode}
              attemptsMode={attemptsMode}
              setAttemptsMode={setAttemptsMode}
              attemptLimit={attemptLimit}
              setAttemptLimit={setAttemptLimit}
            />
          ) : (
            <PlaceholderTab tab={tab} />
          )}
        </div>

        <footer className="cert-split-footer">
          <div className="cert-split-footer-left">
            <span className="wizard-saved">Last saved 1 minute ago</span>
            <button className="wizard-cancel" onClick={onClose}>Cancel</button>
          </div>
          <div className="wizard-actions">
            <button className="btn-save-draft" onClick={onClose}>Save as draft</button>
            <button
              className="btn-publish"
              onClick={() => {
                setDone((d) => ({ ...d, [tab]: true }));
                onAdd({
                  id: `t-${Date.now()}`,
                  name,
                  kind: "quiz",
                  duration: "10 min",
                });
              }}
            >
              Add to Certification
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function CourseBlock({ course, index, highlightId }: { course: CertCourse; index: number; highlightId: string }) {
  return (
    <div className="cert-split-course">
      <div className="cert-split-course-header">
        <span className="cert-split-course-caret">▾</span>
        <span className="cert-split-course-num">{index}</span>
        <span className="cert-split-course-name">{course.name}</span>
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
              <div className="cert-split-lesson-name">L {c.lesson.name.toUpperCase()}</div>
              {c.lesson.tasks.map((t) => (
                <div key={t.id} className="cert-split-row in-lesson">
                  <span className={`task-kind-badge ${KIND_LETTER[t.kind].cls}`}>{KIND_LETTER[t.kind].letter}</span>
                  <span className="cert-split-row-name">{t.name}</span>
                </div>
              ))}
            </div>
          ),
        )}
        {/* New (in-progress) task entry */}
        {course.id === course.id && index === 1 && (
          <div className="cert-split-row in-lesson active">
            <span className="task-kind-badge quiz">Q</span>
            <span className="cert-split-row-name">New Quiz Task</span>
            <span className="cert-split-row-dot" />
          </div>
        )}
      </div>
    </div>
  );
  // highlightId param reserved for future use — keeps prop signature stable
  void highlightId;
}

function PlaceholderTab({ tab }: { tab: Tab }) {
  const labels: Record<Tab, string> = {
    details: "Details",
    questions: "Questions",
    behavior: "Behavior",
    access: "Access",
  };
  return (
    <>
      <h2 className="form-section-title">{labels[tab]}</h2>
      <p className="form-section-desc">
        This tab uses the standard Task Creation UI, embedded in the split-screen Certification editor.
      </p>
    </>
  );
}

function BehaviorTab({
  scoreMethod,
  setScoreMethod,
  passMark,
  setPassMark,
  maxScoreMode,
  setMaxScoreMode,
  attemptsMode,
  setAttemptsMode,
  attemptLimit,
  setAttemptLimit,
}: {
  scoreMethod: string;
  setScoreMethod: (v: string) => void;
  passMark: string;
  setPassMark: (v: string) => void;
  maxScoreMode: "auto" | "manual";
  setMaxScoreMode: (v: "auto" | "manual") => void;
  attemptsMode: "unlimited" | "limit";
  setAttemptsMode: (v: "unlimited" | "limit") => void;
  attemptLimit: string;
  setAttemptLimit: (v: string) => void;
}) {
  return (
    <>
      <section className="form-section">
        <h2 className="form-section-title">Behavior</h2>
        <p className="form-section-desc">Scoring, attempts, and integrity controls.</p>

        <h3 className="form-subsection-title">Scoring</h3>
        <div className="form-sub-group">
          <label className="form-sub-label">Score calculation</label>
          <select className="form-select wide" value={scoreMethod} onChange={(e) => setScoreMethod(e.target.value)}>
            <option value="highest">Highest grade</option>
            <option value="latest">Latest attempt</option>
            <option value="average">Average of attempts</option>
            <option value="first">First attempt only</option>
          </select>
        </div>

        <div className="form-sub-group">
          <label className="form-sub-label">Pass mark</label>
          <div className="time-row">
            <input
              type="text"
              inputMode="numeric"
              className="form-input no-spinner small"
              value={passMark}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) setPassMark(v);
              }}
            />
            <span className="form-suffix">%</span>
          </div>
        </div>

        <div className="form-sub-group">
          <label className="form-sub-label">Maximum score</label>
          <div className="radio-card-group">
            <button
              type="button"
              className={`radio-card ${maxScoreMode === "auto" ? "selected" : ""}`}
              onClick={() => setMaxScoreMode("auto")}
            >
              <span className="radio-dot" />
              <div className="radio-card-text">
                <div className="radio-card-title">Auto · 10.00</div>
                <div className="radio-card-desc">Sum of all question points.</div>
              </div>
            </button>
            <button
              type="button"
              className={`radio-card ${maxScoreMode === "manual" ? "selected" : ""}`}
              onClick={() => setMaxScoreMode("manual")}
            >
              <span className="radio-dot" />
              <div className="radio-card-text">
                <div className="radio-card-title">Set manually</div>
                <div className="radio-card-desc">Override the calculated maximum.</div>
              </div>
            </button>
          </div>
        </div>
      </section>

      <div className="form-divider" />

      <section className="form-section">
        <h3 className="form-subsection-title">Attempts</h3>
        <div className="form-sub-group">
          <label className="form-sub-label">Attempts allowed</label>
          <div className="radio-card-group">
            <button
              type="button"
              className={`radio-card ${attemptsMode === "unlimited" ? "selected" : ""}`}
              onClick={() => setAttemptsMode("unlimited")}
            >
              <span className="radio-dot" />
              <div className="radio-card-text">
                <div className="radio-card-title">Unlimited attempts</div>
              </div>
            </button>
            <button
              type="button"
              className={`radio-card ${attemptsMode === "limit" ? "selected" : ""}`}
              onClick={() => setAttemptsMode("limit")}
            >
              <span className="radio-dot" />
              <div className="radio-card-text">
                <div className="radio-card-title">
                  Limit to{" "}
                  <input
                    type="text"
                    inputMode="numeric"
                    className="inline-num"
                    value={attemptLimit}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v)) setAttemptLimit(v);
                    }}
                  />{" "}
                  attempts
                </div>
              </div>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
