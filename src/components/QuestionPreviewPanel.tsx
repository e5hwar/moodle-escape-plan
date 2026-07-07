import {
  shortQuestionType,
  supportsGrading,
  type Question,
} from "../data/questionBank";
import { CheckIcon, SmallXIcon } from "./icons";

function fmtGrade(g: number): string {
  if (g === 0) return "None";
  const r = Math.round(g * 1000) / 1000;
  return `${g > 0 ? "+" : "−"}${Math.abs(r)}%`;
}

/* Right-hand preview panel on the Question Bank list — opens when a row is
   clicked. Read-only rendering of the question's content, grading, usage and
   translations, with the row actions surfaced as buttons. */
export function QuestionPreviewPanel({
  q,
  onClose,
  onEdit,
  onHistory,
  onToggleArchive,
}: {
  q: Question;
  onClose: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onToggleArchive: () => void;
}) {
  const isArchived = q.status === "Archived";
  const inUse = q.quizzes.length > 0;
  const blockArchive = !isArchived && inUse;
  const graded = q.gradingEnabled && supportsGrading(q.type);

  return (
    <aside className="qprev" aria-label={`Preview of ${q.id}`}>
      <div className="qprev-head">
        <div className="qprev-head-main">
          <span className="qprev-id">{q.id}</span>
          <span className="qprev-vtag">v{q.version}</span>
        </div>
        <button className="qprev-close" aria-label="Close preview" onClick={onClose}>
          <SmallXIcon />
        </button>
      </div>

      <div className="qprev-tags">
        <span className="qb-type-tag">{shortQuestionType(q.type)}</span>
        <span className={`qb-status qb-status--${q.status.toLowerCase()}`}>
          <span className="qb-status-dot" />
          {q.status}
        </span>
        <span className={`qprev-grading-tag ${graded ? "is-graded" : ""}`}>
          {graded ? "Graded" : "Ungraded"}
        </span>
      </div>

      <div className="qprev-scroll">
        <div className="qprev-sec">
          <div className="qprev-sec-label">Question</div>
          <div className="qprev-qtext">{q.text}</div>
        </div>

        <div className="qprev-sec">
          <div className="qprev-sec-label">
            {q.type === "Match the following" ? "Pairs" : "Answer"}
          </div>
          <AnswerPreview q={q} graded={graded} />
        </div>

        {graded && q.feedback && (
          <div className="qprev-sec">
            <div className="qprev-sec-label">Feedback</div>
            {q.feedback.correct && (
              <FeedbackRow tone="correct" label="Correct" text={q.feedback.correct} />
            )}
            {q.feedback.partial && (
              <FeedbackRow tone="partial" label="Partially correct" text={q.feedback.partial} />
            )}
            {q.feedback.incorrect && (
              <FeedbackRow tone="incorrect" label="Incorrect" text={q.feedback.incorrect} />
            )}
          </div>
        )}

        <div className="qprev-sec">
          <div className="qprev-sec-label">Details</div>
          <DetailRow label="Category" value={q.categoryPath.join(" / ")} />
          {(q.type === "Multiple choice" ||
            q.type === "Multiple select" ||
            q.type === "Match the following") && (
            <DetailRow label="Randomise options" value={q.randomise ? "On" : "Off"} />
          )}
          {q.type === "Match the following" && graded && (
            <DetailRow
              label="Match grading"
              value={q.matchGrading === "partial" ? "Partial credit" : "All-or-nothing"}
            />
          )}
          <DetailRow
            label="Translations"
            value={q.hasSpanish ? "EN ✓ · ES ✓" : "EN ✓ · ES missing"}
          />
        </div>

        <div className="qprev-sec">
          <div className="qprev-sec-label">Used in</div>
          {q.quizzes.length === 0 && q.forms.length === 0 ? (
            <div className="qprev-usage-empty">Not in use</div>
          ) : (
            <>
              {q.quizzes.map((name) => (
                <div key={`q-${name}`} className="qprev-usage-row">
                  <span className="qprev-usage-kind">Quiz</span>
                  {name}
                </div>
              ))}
              {q.forms.map((name) => (
                <div key={`f-${name}`} className="qprev-usage-row">
                  <span className="qprev-usage-kind qprev-usage-kind--form">Form</span>
                  {name}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="qprev-foot">
        <button className="btn-publish qprev-edit-btn" onClick={onEdit}>
          Edit question
        </button>
        <div className="qprev-foot-links">
          <button className="qprev-link" onClick={onHistory}>
            Version history
          </button>
          <button
            className="qprev-link qprev-link--danger"
            disabled={blockArchive}
            title={
              blockArchive
                ? "In use in a quiz — remove it from all quizzes before archiving"
                : undefined
            }
            onClick={onToggleArchive}
          >
            {isArchived ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function AnswerPreview({ q, graded }: { q: Question; graded: boolean }) {
  switch (q.type) {
    case "Multiple choice":
    case "Multiple select": {
      const opts = q.options ?? [];
      return (
        <div className="qprev-opts">
          {opts.map((o, i) => {
            const correct = graded && o.grade > 0;
            return (
              <div key={i} className={`qprev-opt ${correct ? "is-correct" : ""}`}>
                <span className="qprev-opt-letter">{String.fromCharCode(65 + i)}</span>
                <span className="qprev-opt-text">{o.text}</span>
                {correct && (
                  <span className="qprev-opt-check">
                    <CheckIcon />
                  </span>
                )}
                {graded && (
                  <span
                    className={`qprev-grade ${o.grade > 0 ? "is-pos" : o.grade < 0 ? "is-neg" : ""}`}
                  >
                    {fmtGrade(o.grade)}
                  </span>
                )}
              </div>
            );
          })}
          {q.otherOption && (
            <div className="qprev-opt qprev-opt--other">
              <span className="qprev-opt-letter">{String.fromCharCode(65 + opts.length)}</span>
              <span className="qprev-opt-text">Other — learner types a free-text answer</span>
            </div>
          )}
        </div>
      );
    }
    case "True/False":
      return (
        <div className="qprev-opts">
          {[true, false].map((val) => {
            const correct = graded && q.tfAnswer === val;
            return (
              <div key={String(val)} className={`qprev-opt ${correct ? "is-correct" : ""}`}>
                <span className="qprev-opt-text">{val ? "True" : "False"}</span>
                {correct && (
                  <span className="qprev-opt-check">
                    <CheckIcon />
                  </span>
                )}
                {correct && <span className="qprev-grade is-pos">+100%</span>}
              </div>
            );
          })}
        </div>
      );
    case "Match the following":
      return (
        <div className="qprev-opts">
          {(q.pairs ?? []).map((p, i) => (
            <div key={i} className="qprev-pair">
              {p.left ? (
                <>
                  <span className="qprev-pair-left">{p.left}</span>
                  <span className="qprev-pair-arrow">→</span>
                  <span className="qprev-pair-right">{p.right}</span>
                </>
              ) : (
                <>
                  <span className="qprev-pair-left qprev-pair-distractor">Distractor</span>
                  <span className="qprev-pair-arrow">→</span>
                  <span className="qprev-pair-right">{p.right}</span>
                </>
              )}
            </div>
          ))}
        </div>
      );
    case "Short answer":
      return <div className="qprev-answer-note">Free-text answer · plain text, up to 512 characters</div>;
    case "File upload": {
      const r = q.fileRules;
      return (
        <div className="qprev-answer-note">
          {r
            ? `Up to ${r.maxFiles} file${r.maxFiles === 1 ? "" : "s"} · ${r.maxSizeMb} MB each`
            : "File upload · system-wide limits"}
        </div>
      );
    }
    case "Linear scale": {
      const s = q.scale;
      if (!s) return <div className="qprev-answer-note">Numeric scale</div>;
      return (
        <div>
          <div className="qprev-scale-range">
            {s.min} – {s.max}
          </div>
          {(s.minLabel || s.maxLabel) && (
            <div className="qprev-scale-labels">
              {s.minLabel && (
                <span>
                  {s.min} = “{s.minLabel}”
                </span>
              )}
              {s.maxLabel && (
                <span>
                  {s.max} = “{s.maxLabel}”
                </span>
              )}
            </div>
          )}
        </div>
      );
    }
  }
}

function FeedbackRow({
  tone,
  label,
  text,
}: {
  tone: "correct" | "partial" | "incorrect";
  label: string;
  text: string;
}) {
  return (
    <div className="qprev-fb-row">
      <span className={`qprev-fb-label qe-fb-label qe-fb-${tone}`}>{label}</span>
      <span className="qprev-fb-text">{text}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="qprev-detail-row">
      <span className="qprev-detail-label">{label}</span>
      <span className="qprev-detail-value">{value}</span>
    </div>
  );
}
