import { useMemo, useState } from "react";
import { formResponses, type FeedbackForm } from "../data/feedbackForms";
import { type Question } from "../data/questionBank";
import { ChevronRightIcon } from "./icons";
import {
  buildRows,
  exportFormCsv,
  FormOverview,
  FormResponsesSplit,
} from "./FeedbackFormResponses";

type Tab = "overview" | "responses";

type Props = {
  form: FeedbackForm;
  bank: Question[];
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
};

/* Feedback Response Viewer (design "Feedback Response Viewer v2"): one page
   header + tabbar over two views — the aggregate Overview and the per-user
   Responses browser. Questions and Triggers are managed in Edit Form, so
   their tabs are present but inert, matching the design. */
export function FeedbackFormResponsesPage({ form, bank, onBack, onEdit, onDuplicate }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const responses = formResponses[form.id] ?? [];
  const rows = useMemo(() => buildRows(form, bank), [form, bank]);

  const triggerNames = form.triggers.map((t) => t.refName);

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks fb-page">
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <button className="rvc-crumb" onClick={onBack} title="Back to Feedback Forms">
                  Feedback Forms
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">
                  {form.name || "Untitled form"}
                </span>
              </nav>
              <div className="fb-viewer-titlerow">
                <h1 className="tasks-title">{form.name || "Untitled form"}</h1>
                <span
                  className={`fb-status ${form.status === "active" ? "fb-status--active" : "fb-status--archived"}`}
                >
                  {form.status === "active" ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="tasks-subtitle">
                <span>
                  {triggerNames.length === 0
                    ? "No triggers mapped"
                    : `Triggers: ${triggerNames.join(" · ")}`}
                </span>
                <span className="tasks-subtitle-dot" />
                <span>One submission per user, ever</span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button
                className="cta-quiet"
                disabled={responses.length === 0}
                title={responses.length === 0 ? "No responses to export" : undefined}
                onClick={() => exportFormCsv(form, rows, responses)}
              >
                Export CSV
              </button>
              <button className="cta-quiet" onClick={onDuplicate}>
                Duplicate
              </button>
              <button className="new-task" onClick={onEdit}>
                Edit Form
              </button>
            </div>
          </header>

          <div className="tabbar fb-viewer-tabs">
            <button
              className={`tab ${tab === "overview" ? "is-active" : ""}`}
              onClick={() => setTab("overview")}
            >
              Overview
            </button>
            <button
              className={`tab ${tab === "responses" ? "is-active" : ""}`}
              onClick={() => setTab("responses")}
            >
              Responses
            </button>
            <span className="tab is-disabled" title="Managed in Edit Form">
              Questions
            </span>
            <span className="tab is-disabled" title="Managed in Edit Form">
              Triggers
            </span>
          </div>

          {/* Keyed by tab so switching views starts back at the top. */}
          <div className="fb-viewer-scroll" key={tab}>
            {tab === "overview" ? (
              <FormOverview form={form} bank={bank} responses={responses} />
            ) : (
              <FormResponsesSplit form={form} bank={bank} responses={responses} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
