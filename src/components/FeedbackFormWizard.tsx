import { useState } from "react";
import {
  type FeedbackForm,
  type FormQuestionLink,
  type FormStatus,
  type FormTrigger,
} from "../data/feedbackForms";
import { type Question } from "../data/questionBank";
import { FeedbackFormEditor } from "./FeedbackFormEditor";
import { FeedbackFormTriggers } from "./FeedbackFormTriggers";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";

type Props = {
  form: FeedbackForm;
  /** Opened straight from Create Form — only changes the rail's eyebrow. */
  creating?: boolean;
  allForms: FeedbackForm[];
  bank: Question[];
  onBack: () => void;
  onUpdate: (form: FeedbackForm) => void;
  onCreateQuestion: () => void;
};

const TODAY = "2026-07-10";

const STEPS = [
  {
    id: "details",
    label: "Details",
    desc: "Submitting feedback is always optional. A user is never forced to fill a Feedback Form. Within a form, individual questions can be marked as mandatory. This means: if the user chooses to submit the form, they must answer the mandatory questions. But they can always dismiss the form entirely without answering anything",
  },
  {
    id: "triggers",
    label: "Triggers",
    desc: "Map this form to the Tasks and Certifications whose completion should show it.",
  },
] as const;

export function FeedbackFormWizard({
  form,
  creating,
  allForms,
  bank,
  onBack,
  onUpdate,
  onCreateQuestion,
}: Props) {
  const [step, setStep] = useState(0);
  // Wheel-past-the-edge step navigation, shared with every other wizard.
  const lastStep = STEPS.length - 1;
  const gate = useEdgeLineGate({ step, setStep, lastStep });
  // Rail glyphs: the form name is the only mandatory field in the wizard, so
  // Details passed unnamed shows the red alert circle rather than a check.
  const stepStatuses = useWizardStepStatuses({
    step,
    count: STEPS.length,
    incomplete: (i) => i === 0 && form.name.trim().length === 0,
  });

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

  // A form is live from the moment it is created, so both steps are always
  // open — triggers can be mapped before a single question is linked.
  const isCreating = creating ?? false;

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
              const status = stepStatuses[i];
              return (
                <li
                  key={s.id}
                  className={`wizard-step ${status}`}
                  onClick={() => gate.goStep(i)}
                >
                  <WizardStepRail status={status} num={i + 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="wizard-main">
          <WizardGateEdges
            gate={gate}
            step={step}
            lastStep={lastStep}
            labels={STEPS.map((s) => s.label)}
          />
          <div className="wizard-content" ref={gate.scrollRef}>
            <div className="wizard-paneout" ref={gate.paneOutRef}>
              <div className="wizard-pane" key={step}>
              <h1 className="wizard-title">{STEPS[step].label}</h1>
              <p className="wizard-desc">{STEPS[step].desc}</p>

              {step === 0 && (
                <DetailsStep
                  form={form}
                  bank={bank}
                  onRename={rename}
                  onUpdateLinks={saveLinks}
                  onCreateQuestion={onCreateQuestion}
                />
              )}
              {step === 1 && (
                <FeedbackFormTriggers
                  form={form}
                  allForms={allForms}
                  onSave={saveTriggers}
                />
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onBack}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          {form.status === "active" ? (
            <>
              <button
                className="btn-save-draft fb-archive-btn"
                onClick={() => setStatus("disabled")}
                title="Stops showing the form to users. Trigger mappings are preserved but inactive; responses are kept indefinitely."
              >
                Disable form
              </button>
              <button className="btn-publish" onClick={onBack}>
                Done
              </button>
            </>
          ) : (
            <>
              <button className="btn-save-draft" onClick={onBack}>
                Done
              </button>
              <button
                className="btn-publish"
                onClick={() => setStatus("active")}
                title="Starts showing the form again on its mapped triggers"
              >
                Enable form
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
  bank,
  onRename,
  onUpdateLinks,
  onCreateQuestion,
}: {
  form: FeedbackForm;
  bank: Question[];
  onRename: (name: string) => void;
  onUpdateLinks: (links: FormQuestionLink[]) => void;
  onCreateQuestion: () => void;
}) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Feedback Form Name <span className="req">*</span>
        </label>
        <input
          className="form-input"
          value={form.name}
          placeholder="Feedback Form Name"
          onChange={(e) => onRename(e.target.value)}
          // Land the cursor here for a brand-new, unnamed form.
          autoFocus={form.name === ""}
        />
        <p className="form-help">
          Internal name used by admins to identify this form. Not shown to
          learners.
        </p>
      </div>

      {/* Questions moved onto page 1 and onto the Quiz wizard's ordered
          Questions table — a form is its question list, so splitting them
          across two steps only added a click. */}
      <div className="form-group">
        <label className="form-label">Questions</label>
        <FeedbackFormEditor
          form={form}
          bank={bank}
          onUpdate={onUpdateLinks}
          onCreateQuestion={onCreateQuestion}
        />
        <p className="form-help">
          Questions live in the Question Bank — this form links them, and
          editing one in the bank updates every quiz and form that uses it.
          Grading data on a linked question is ignored: responses are collected
          without scoring.
        </p>
      </div>
    </>
  );
}
