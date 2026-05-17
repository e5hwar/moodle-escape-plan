import { useState } from "react";
import {
  type FeedbackForm,
  type FormVersionSnapshot,
  type Question,
} from "../data/feedbackForms";
import { ChevronLeftIcon } from "./icons";

type Props = {
  form: FeedbackForm;
  onBack: () => void;
};

export function FeedbackFormVersions({ form, onBack }: Props) {
  // Combine current + history (current is implicit as version `form.version`).
  const currentSnapshot: FormVersionSnapshot = {
    version: form.version,
    questions: form.questions,
    editedBy: form.createdBy,
    editedAt: form.updatedAt,
    changeSummary: "Current version",
    responseCount:
      form.responseCount -
      form.history.reduce((acc, h) => acc + h.responseCount, 0),
  };
  const all: FormVersionSnapshot[] = [currentSnapshot, ...form.history];

  const [activeVersion, setActiveVersion] = useState<number>(form.version);
  const active = all.find((v) => v.version === activeVersion) ?? all[0];

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks fb-detail">
          <header className="fb-detail-header">
            <button className="fb-back-btn" onClick={onBack}>
              <ChevronLeftIcon />
              <span>Back to form</span>
            </button>
            <div className="fb-detail-title-row">
              <div className="fb-detail-title-left">
                <div className="fb-row-id">{form.id} · Version history</div>
                <h1 className="tasks-title">{form.name}</h1>
                <div className="tasks-subtitle">
                  <span>{all.length} versions</span>
                  <span className="tasks-subtitle-dot" />
                  <span>{form.responseCount.toLocaleString()} total responses</span>
                </div>
              </div>
            </div>
          </header>

          <div className="fb-versions-body">
            <div className="fb-versions-list">
              {all.map((v) => {
                const isCurrent = v.version === form.version;
                return (
                  <button
                    key={v.version}
                    className={`fb-version-row ${
                      activeVersion === v.version ? "is-active" : ""
                    }`}
                    onClick={() => setActiveVersion(v.version)}
                  >
                    <div className="fb-version-row-num">
                      <span className="fb-version-pill">v{v.version}</span>
                      {isCurrent && (
                        <span className="fb-version-current">CURRENT</span>
                      )}
                    </div>
                    <div className="fb-version-row-meta">
                      <div className="fb-version-row-summary">
                        {v.changeSummary}
                      </div>
                      <div className="fb-version-row-sub">
                        {v.editedAt} · by {v.editedBy} ·{" "}
                        {v.responseCount.toLocaleString()} responses
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="fb-version-detail">
              <div className="fb-version-detail-head">
                <h3 className="fb-section-title">
                  Version {active.version} snapshot
                </h3>
                <p className="fb-section-sub">
                  Read-only. Responses submitted against this version remain
                  attached to it permanently.
                </p>
              </div>
              <div className="fb-version-questions">
                {active.questions.length === 0 ? (
                  <div className="fb-empty">No questions in this version.</div>
                ) : (
                  active.questions.map((q, i) => (
                    <VersionQuestion key={q.id} index={i} question={q} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionQuestion({
  index,
  question,
}: {
  index: number;
  question: Question;
}) {
  return (
    <div className="fb-version-q">
      <div className="fb-version-q-head">
        <span className="fb-q-num">{index + 1}</span>
        <div className="fb-version-q-meta">
          <div className="fb-version-q-text">
            {question.textEn || "Untitled question"}
          </div>
          <div className="fb-version-q-sub">
            {typeLabel(question.type)}
            {question.required && " · Required"}
          </div>
        </div>
      </div>
      {(question.type === "single-select" || question.type === "multi-select") && question.options && (
        <ul className="fb-version-q-options">
          {question.options.map((o) => (
            <li key={o.id}>{o.textEn}</li>
          ))}
          {question.allowOther && <li className="fb-faint">Other (free text)</li>}
        </ul>
      )}
      {question.type === "linear-scale" && (
        <div className="fb-version-q-scale">
          Scale {question.scaleMin}–{question.scaleMax}
          {question.scaleLabelMin && ` · "${question.scaleLabelMin}" → "${question.scaleLabelMax}"`}
        </div>
      )}
      {question.type === "short-answer" && (
        <div className="fb-version-q-scale">
          Short answer · max {question.charLimit ?? 512} characters
        </div>
      )}
      {question.type === "file-upload" && (
        <div className="fb-version-q-scale">
          Up to {question.maxFiles ?? 1} file
          {(question.maxFiles ?? 1) === 1 ? "" : "s"}, max{" "}
          {question.maxFileSizeMb ?? 10} MB each
        </div>
      )}
    </div>
  );
}

function typeLabel(t: Question["type"]): string {
  switch (t) {
    case "single-select":
      return "Single select";
    case "multi-select":
      return "Multi select";
    case "short-answer":
      return "Short answer";
    case "file-upload":
      return "File upload";
    case "linear-scale":
      return "Linear scale";
  }
}
