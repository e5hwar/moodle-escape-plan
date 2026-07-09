import { useState } from "react";
import {
  activeLinks,
  formResponses,
  type FeedbackForm,
  type FormQuestionLink,
  type FormStatus,
  type FormTrigger,
} from "../data/feedbackForms";
import { type Question } from "../data/questionBank";
import { FeedbackFormEditor } from "./FeedbackFormEditor";
import { FeedbackFormTriggers } from "./FeedbackFormTriggers";
import { FeedbackFormResponses } from "./FeedbackFormResponses";
import { ChevronLeftIcon } from "./icons";

type Tab = "editor" | "triggers" | "responses";

type Props = {
  form: FeedbackForm;
  allForms: FeedbackForm[];
  bank: Question[];
  onBack: () => void;
  onUpdate: (form: FeedbackForm) => void;
  onCreateQuestion: () => void;
};

const STATUS_LABEL: Record<FormStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

const TODAY = "2026-07-09";

export function FeedbackFormDetail({
  form,
  allForms,
  bank,
  onBack,
  onUpdate,
  onCreateQuestion,
}: Props) {
  const [tab, setTab] = useState<Tab>("editor");

  // Question edits apply immediately to future prompts — no form versioning.
  function saveLinks(questions: FormQuestionLink[]) {
    onUpdate({ ...form, questions, updatedAt: TODAY });
  }

  function saveTriggers(triggers: FormTrigger[]) {
    onUpdate({ ...form, triggers, updatedAt: TODAY });
  }

  function setStatus(status: FormStatus) {
    onUpdate({ ...form, status, updatedAt: TODAY });
  }

  const responses = formResponses[form.id] ?? [];
  const actives = activeLinks(form);

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
                <div className="fb-row-id">{form.id}</div>
                <h1 className="tasks-title">{form.name}</h1>
                <div className="tasks-subtitle">
                  <span className={`fb-status fb-status--${form.status}`}>
                    {STATUS_LABEL[form.status]}
                  </span>
                  <span className="tasks-subtitle-dot" />
                  <span>
                    {actives.length} active question{actives.length === 1 ? "" : "s"}
                  </span>
                  <span className="tasks-subtitle-dot" />
                  <span>{form.triggers.length} triggers</span>
                  <span className="tasks-subtitle-dot" />
                  <span>{form.responseCount.toLocaleString()} responses</span>
                </div>
              </div>
              <div className="fb-detail-actions">
                {form.status === "draft" && (
                  <button
                    className="btn-publish"
                    disabled={actives.length === 0}
                    onClick={() => setStatus("active")}
                    title={
                      actives.length === 0
                        ? "Link at least one question before activating"
                        : "Activate this form — triggers can be added once Active"
                    }
                  >
                    Activate form
                  </button>
                )}
                {form.status === "active" && (
                  <button
                    className="btn-save-draft fb-archive-btn"
                    onClick={() => setStatus("archived")}
                    title="Stops showing the form to users. Trigger mappings are preserved but inactive; responses are kept indefinitely."
                  >
                    Archive
                  </button>
                )}
                {form.status === "archived" && (
                  <button
                    className="btn-publish"
                    onClick={() => setStatus("active")}
                    title="Reactivates the form and its trigger mappings"
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
                Questions
                <span className="fb-tab-count">{actives.length}</span>
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
                bank={bank}
                onUpdate={saveLinks}
                onCreateQuestion={onCreateQuestion}
              />
            )}
            {tab === "triggers" && (
              <FeedbackFormTriggers
                form={form}
                allForms={allForms}
                onSave={saveTriggers}
              />
            )}
            {tab === "responses" && (
              <FeedbackFormResponses
                form={form}
                bank={bank}
                responses={responses}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
