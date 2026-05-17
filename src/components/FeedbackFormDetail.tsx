import { useState } from "react";
import {
  type FeedbackForm,
  type FormStatus,
  type FormTrigger,
  type Question,
  type FormVersionSnapshot,
  formResponses,
} from "../data/feedbackForms";
import { FeedbackFormEditor } from "./FeedbackFormEditor";
import { FeedbackFormTriggers } from "./FeedbackFormTriggers";
import { FeedbackFormResponses } from "./FeedbackFormResponses";
import { ChevronLeftIcon } from "./icons";

type Tab = "editor" | "triggers" | "responses";

type Props = {
  form: FeedbackForm;
  onBack: () => void;
  onUpdate: (form: FeedbackForm) => void;
  onOpenVersions: () => void;
};

const STATUS_LABEL: Record<FormStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

export function FeedbackFormDetail({
  form,
  onBack,
  onUpdate,
  onOpenVersions,
}: Props) {
  const [tab, setTab] = useState<Tab>("editor");

  function saveQuestions(questions: Question[]) {
    const isNewVersion =
      form.status === "active" &&
      JSON.stringify(questions) !== JSON.stringify(form.questions);
    let updated: FeedbackForm = {
      ...form,
      questions,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    if (isNewVersion) {
      const snapshot: FormVersionSnapshot = {
        version: form.version,
        questions: form.questions,
        editedBy: form.createdBy,
        editedAt: form.updatedAt,
        changeSummary: "Edits to questions",
        responseCount: form.responseCount,
      };
      updated = {
        ...updated,
        version: form.version + 1,
        history: [snapshot, ...form.history],
      };
    }
    onUpdate(updated);
  }

  function saveTriggers(triggers: FormTrigger[]) {
    onUpdate({
      ...form,
      triggers,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  function setStatus(status: FormStatus) {
    onUpdate({
      ...form,
      status,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  const responses = formResponses[form.id] ?? [];

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks fb-detail">
          <header className="fb-detail-header">
            <button className="fb-back-btn" onClick={onBack}>
              <ChevronLeftIcon />
              <span>All Feedback Forms</span>
            </button>
            <div className="fb-detail-title-row">
              <div className="fb-detail-title-left">
                <div className="fb-row-id">{form.id} · v{form.version}</div>
                <h1 className="tasks-title">{form.name}</h1>
                <div className="tasks-subtitle">
                  <span className={`fb-status fb-status--${form.status}`}>
                    {STATUS_LABEL[form.status]}
                  </span>
                  <span className="tasks-subtitle-dot" />
                  <span>{form.questions.length} questions</span>
                  <span className="tasks-subtitle-dot" />
                  <span>{form.triggers.length} triggers</span>
                  <span className="tasks-subtitle-dot" />
                  <span>{form.responseCount.toLocaleString()} responses</span>
                </div>
              </div>
              <div className="fb-detail-actions">
                <button className="btn-save-draft" onClick={onOpenVersions}>
                  Version history ({form.history.length + 1})
                </button>
                {form.status === "draft" && (
                  <button
                    className="btn-publish"
                    disabled={form.questions.length === 0}
                    onClick={() => setStatus("active")}
                    title={
                      form.questions.length === 0
                        ? "Add at least one question before activating"
                        : "Activate this form"
                    }
                  >
                    Activate form
                  </button>
                )}
                {form.status === "active" && (
                  <button
                    className="btn-save-draft fb-archive-btn"
                    onClick={() => setStatus("archived")}
                  >
                    Archive
                  </button>
                )}
                {form.status === "archived" && (
                  <button
                    className="btn-publish"
                    onClick={() => setStatus("active")}
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
            <div className="fb-tabs">
              <button
                className={`fb-tab ${tab === "editor" ? "is-active" : ""}`}
                onClick={() => setTab("editor")}
              >
                Editor
              </button>
              <button
                className={`fb-tab ${tab === "triggers" ? "is-active" : ""}`}
                onClick={() => setTab("triggers")}
                disabled={form.status === "draft"}
                title={
                  form.status === "draft"
                    ? "Activate the form before adding triggers"
                    : undefined
                }
              >
                Triggers
                <span className="fb-tab-count">{form.triggers.length}</span>
              </button>
              <button
                className={`fb-tab ${tab === "responses" ? "is-active" : ""}`}
                onClick={() => setTab("responses")}
              >
                Responses
                <span className="fb-tab-count">
                  {form.responseCount.toLocaleString()}
                </span>
              </button>
            </div>
          </header>

          <div className="fb-detail-body">
            {tab === "editor" && (
              <FeedbackFormEditor
                form={form}
                onSave={saveQuestions}
              />
            )}
            {tab === "triggers" && (
              <FeedbackFormTriggers
                form={form}
                onSave={saveTriggers}
              />
            )}
            {tab === "responses" && (
              <FeedbackFormResponses
                form={form}
                responses={responses}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
