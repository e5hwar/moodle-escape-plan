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
};

/* Feedback Response Viewer (design "Feedback Response Viewer v2"): one page
   header + tabbar over two views — the aggregate Overview and the per-user
   Responses browser.

   Shelved for now: nothing routes to this page — the Feedback Forms row menu
   exports the CSV directly — but it is kept intact so the viewer can be wired
   back up later. */
export function FeedbackFormResponsesPage({ form, bank, onBack }: Props) {
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
              <h1 className="tasks-title">{form.name || "Untitled form"}</h1>
              <div className="tasks-subtitle">
                <span>
                  {triggerNames.length === 0
                    ? "No triggers mapped"
                    : `Triggers: ${triggerNames.join(" · ")}`}
                </span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button
                className="cta-quiet"
                disabled={responses.length === 0}
                title={responses.length === 0 ? "No responses to export" : undefined}
                onClick={() => exportFormCsv(form, rows, responses)}
              >
                Export Responses
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
