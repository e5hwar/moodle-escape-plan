import { useState } from "react";
import {
  activeLinks,
  inactiveLinks,
  type FeedbackForm,
  type FormQuestionLink,
  type FormStatus,
  type FormTrigger,
} from "../data/feedbackForms";
import { type Question } from "../data/questionBank";
import { FeedbackFormEditor } from "./FeedbackFormEditor";
import { FeedbackFormTriggers } from "./FeedbackFormTriggers";
import { WizardStepRail } from "./WizardStepRail";

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

const TODAY = "2026-07-10";

const STEPS = [
  {
    id: "details",
    label: "Details",
    desc: "Name this form and review its status. The name is internal — learners never see it.",
  },
  {
    id: "questions",
    label: "Questions",
    desc: "Link questions from the Question Bank, order them, and mark the ones a user must answer if they choose to submit.",
  },
  {
    id: "triggers",
    label: "Triggers",
    desc: "Map this form to the Tasks and Certifications whose completion should show it. A form must be Active before triggers can be added.",
  },
] as const;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FeedbackFormWizard({
  form,
  allForms,
  bank,
  onBack,
  onUpdate,
  onCreateQuestion,
}: Props) {
  const [step, setStep] = useState(0);

  // Everything saves live (the prototype holds forms in App state), so the
  // footer buttons only handle status transitions and navigation.
  function saveLinks(questions: FormQuestionLink[]) {
    onUpdate({ ...form, questions, updatedAt: TODAY });
  }
  function saveTriggers(triggers: FormTrigger[]) {
    onUpdate({ ...form, triggers, updatedAt: TODAY });
  }
  function setStatus(status: FormStatus) {
    onUpdate({ ...form, status, updatedAt: TODAY });
  }
  function rename(name: string) {
    onUpdate({ ...form, name, updatedAt: TODAY });
  }

  const actives = activeLinks(form);
  const isCreating = form.status === "draft";
  // Triggers require Active status (spec §13.3.6) — gate the step until then.
  const triggersLocked = form.status === "draft";

  const savedLabel = isCreating
    ? "Draft — changes saved automatically"
    : `Last updated ${formatDate(form.updatedAt)}`;

  return (
    <div className="wizard">
      <div className="wizard-body">
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">
              {isCreating ? "Creating" : "Editing"}
            </span>
            <span className="wizard-brand-name">
              {form.name || "New Feedback Form"}
            </span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((s, i) => {
              const status =
                i === step ? "active" : i < step ? "done" : "upcoming";
              const disabled = s.id === "triggers" && triggersLocked;
              return (
                <li
                  key={s.id}
                  className={`wizard-step ${status} ${disabled ? "is-disabled" : ""}`}
                  onClick={() => !disabled && setStep(i)}
                  title={
                    disabled ? "Activate the form before adding triggers" : undefined
                  }
                >
                  <WizardStepRail status={status} num={i + 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="wizard-progress">
            {form.id}
            <span className={`fb-status fb-status--${form.status} wizard-fb-status`}>
              {STATUS_LABEL[form.status]}
            </span>
          </div>
        </aside>

        <div className="wizard-content">
          <h1 className="wizard-title">{STEPS[step].label}</h1>
          <p className="wizard-desc">{STEPS[step].desc}</p>

          {step === 0 && (
            <DetailsStep form={form} actives={actives.length} onRename={rename} />
          )}
          {step === 1 && (
            <FeedbackFormEditor
              form={form}
              bank={bank}
              onUpdate={saveLinks}
              onCreateQuestion={onCreateQuestion}
            />
          )}
          {step === 2 && (
            <FeedbackFormTriggers
              form={form}
              allForms={allForms}
              onSave={saveTriggers}
            />
          )}
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <span className="wizard-saved">{savedLabel}</span>
          <button className="wizard-cancel" onClick={onBack}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          {form.status === "draft" && (
            <>
              <button className="btn-save-draft" onClick={onBack}>
                Save as draft
              </button>
              <button
                className="btn-publish"
                disabled={actives.length === 0}
                title={
                  actives.length === 0
                    ? "Link at least one question before activating"
                    : "Activate this form and start mapping triggers"
                }
                onClick={() => {
                  setStatus("active");
                  setStep(2); // jump to Triggers, now unlocked
                }}
              >
                Activate form
              </button>
            </>
          )}
          {form.status === "active" && (
            <>
              <button
                className="btn-save-draft fb-archive-btn"
                onClick={() => setStatus("archived")}
                title="Stops showing the form to users. Trigger mappings are preserved but inactive; responses are kept indefinitely."
              >
                Archive
              </button>
              <button className="btn-publish" onClick={onBack}>
                Done
              </button>
            </>
          )}
          {form.status === "archived" && (
            <>
              <button className="btn-save-draft" onClick={onBack}>
                Done
              </button>
              <button
                className="btn-publish"
                onClick={() => setStatus("active")}
                title="Reactivates the form and its trigger mappings"
              >
                Reactivate
              </button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function DetailsStep({
  form,
  actives,
  onRename,
}: {
  form: FeedbackForm;
  actives: number;
  onRename: (name: string) => void;
}) {
  const inactives = inactiveLinks(form).length;
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Form name <span className="req">*</span>
        </label>
        <input
          className="form-input"
          value={form.name}
          placeholder="e.g. EPA 608 — Post-Cert Satisfaction"
          onChange={(e) => onRename(e.target.value)}
          // Land the cursor here for a brand-new, unnamed draft.
          autoFocus={form.name === ""}
        />
        <p className="form-help">
          Internal name used by admins to identify this form. Not shown to
          learners.
        </p>
      </div>

      <div className="form-divider" />

      <div className="form-group">
        <label className="form-label">Status</label>
        <div className="fb-details-status">
          <span className={`fb-status fb-status--${form.status}`}>
            {STATUS_LABEL[form.status]}
          </span>
          <p className="fb-details-status-desc">
            {form.status === "draft"
              ? "This form is being built and isn't shown to users. Link at least one question, then Activate it to start mapping triggers."
              : form.status === "active"
                ? "This form is live — it's shown to users when a mapped Task or Certification is completed."
                : "This form is archived. Trigger mappings are preserved but inactive, and all responses are kept. Reactivate to resume firing it."}
          </p>
        </div>
      </div>

      <div className="form-divider" />

      <dl className="fb-details-meta">
        <div className="fb-details-meta-row">
          <dt>Form ID</dt>
          <dd>{form.id}</dd>
        </div>
        <div className="fb-details-meta-row">
          <dt>Questions</dt>
          <dd>
            {actives} active
            {inactives > 0 && ` · ${inactives} inactive`}
          </dd>
        </div>
        <div className="fb-details-meta-row">
          <dt>Triggers</dt>
          <dd>{form.triggers.length}</dd>
        </div>
        <div className="fb-details-meta-row">
          <dt>Responses</dt>
          <dd>{form.responseCount.toLocaleString()}</dd>
        </div>
        <div className="fb-details-meta-row">
          <dt>Created by</dt>
          <dd>{form.createdBy}</dd>
        </div>
        <div className="fb-details-meta-row">
          <dt>Created</dt>
          <dd>{formatDate(form.createdAt)}</dd>
        </div>
        <div className="fb-details-meta-row">
          <dt>Last updated</dt>
          <dd>{formatDate(form.updatedAt)}</dd>
        </div>
      </dl>
    </>
  );
}
