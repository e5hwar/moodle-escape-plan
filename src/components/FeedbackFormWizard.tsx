import {
  type FeedbackForm,
  type FormQuestionLink,
  type FormTrigger,
} from "../data/feedbackForms";
import { type Question } from "../data/questionBank";
import { FeedbackFormEditor } from "./FeedbackFormEditor";
import { FeedbackFormTriggers } from "./FeedbackFormTriggers";
import { ChevronRightIcon, InfoIcon14 } from "./icons";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";

type Props = {
  form: FeedbackForm;
  /** Opened straight from Create Form — only changes the head's wording. */
  creating?: boolean;
  allForms: FeedbackForm[];
  bank: Question[];
  onBack: () => void;
  /** Throw the record away — only ever called on a form this page CREATED that
   *  never became valid. See `leave()`. */
  onDiscard: () => void;
  onUpdate: (form: FeedbackForm) => void;
  onCreateQuestion: () => void;
};

const TODAY = "2026-07-10";

/* Was step 1's description: the one rule about a form that an admin has to
   know, but far too long to sit under the page title. It hangs off the
   Questions subtext as a single ⓘ instead ([[tooltip-and-hover-convention]]). */
const OPTIONAL_RULE =
  "Submitting feedback is always optional. A user is never forced to fill a Feedback Form. Within a form, individual questions can be marked as mandatory. This means: if the user chooses to submit the form, they must answer the mandatory questions. But they can always dismiss the form entirely without answering anything.";

/* Was the "How triggers behave" card at the foot of the Triggers step. The
   four rules are reference, not something to read every visit, so they hang off
   the field's subtext as one ⓘ and the card is gone. */
const TRIGGER_RULES = [
  "A user can submit this form once. After submitting, it never appears again — across all triggers.",
  "Dismissing without submitting keeps the user eligible: the form is shown again the next time any of its triggers fires.",
  "Completing several mapped items in quick succession queues distinct forms one at a time; the same form is only shown once.",
  "For proctored Quiz Tasks (e.g. EPA), the form fires as soon as the user passes the quiz — even while the attempt is In-Review. If the attempt is later rejected, the response is kept.",
].join("\n\n");

/**
 * Create / edit a Feedback Form — ONE page.
 *
 * A form carries three decisions (a name, the questions it links, the Tasks and
 * Certifications that fire it) and no authored content, so the two-step wizard
 * was a click between halves of one short form. The step rail, the edge-line
 * gate and the step panes are gone; what is left is the flat field stack of
 * [[wizard-flat-layout]] under the Award page's shell — breadcrumb head, then
 * Name, Questions and Triggers in the order the two steps used to run.
 */
export function FeedbackFormWizard({
  form,
  creating,
  allForms,
  bank,
  onBack,
  onDiscard,
  onUpdate,
  onCreateQuestion,
}: Props) {
  // Everything saves live (the prototype holds forms in App state), so the
  // footer buttons only handle status transitions and navigation.
  function saveLinks(questions: FormQuestionLink[]) {
    onUpdate({ ...form, questions, updatedAt: TODAY });
  }
  function saveTriggers(triggers: FormTrigger[]) {
    onUpdate({ ...form, triggers, updatedAt: TODAY });
  }
  function rename(name: string) {
    onUpdate({ ...form, name, updatedAt: TODAY });
  }

  const isCreating = creating ?? false;
  const title = isCreating ? "New Feedback Form" : "Edit Feedback Form";

  /* Two required fields: a name, and at least one trigger — **a form with no
     trigger can never be shown to anyone** (the user, 2026-09-18), so it is not
     a form yet. The rail used to report a missing field with a red alert
     circle; on one page the footer button carries it, listing whatever is still
     missing ([[task-publish-flow]]'s gate pattern). */
  const named = form.name.trim().length > 0;
  const mapped = form.triggers.length > 0;
  const missing = [
    named ? null : "give the form a name",
    mapped ? null : "map at least one trigger",
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;
  const blockedTip = ready
    ? undefined
    : `To finish, ${missing.join(" and ")}. A form with no trigger is never shown to anyone.`;

  function done() {
    if (ready) onBack();
  }

  /* Leaving without finishing. Everything here saves live, so a brand-new form
     abandoned half-made would otherwise sit in the list as an untitled row with
     no trigger — exactly the state the gate above exists to prevent. So a form
     this page created that never became valid is DISCARDED on the way out
     (Cancel and the breadcrumb both). A form that is already valid is kept —
     leaving is then just navigation — and an existing form is never touched. */
  function leave() {
    if (isCreating && !ready) onDiscard();
    else onBack();
  }

  /* The create button's shortcut is ⌘/Ctrl+Shift+Enter, as on the Task
     wizards. There is no step to continue to here, so plain ⌘+Enter — their
     Continue — has nothing to do. */
  useWizardEnterShortcut(() => {}, done);

  return (
    <div className="wizard">
      <div className="wizard-body">
        <div className="wizard-main">
          <div className="wizard-content">
            <div className="wizard-paneout">
              <div className="wizard-pane">
                {/* Feedback Forms has no sidebar entry — it is reached from the
                    Certifications header — so the crumbs repeat that page's
                    own trail and the last one is the way back out. */}
                <div className="rvc-pagehead">
                  <nav className="rvc-crumbs" aria-label="Breadcrumb">
                    <span className="rvc-crumb">Content</span>
                    <ChevronRightIcon />
                    <button
                      className="rvc-crumb"
                      onClick={leave}
                      title="Back to Feedback Forms"
                    >
                      Feedback Forms
                    </button>
                    <ChevronRightIcon />
                    <span className="rvc-crumb rvc-crumb--current">
                      {form.name || title}
                    </span>
                  </nav>
                  <h1 className="wizard-title">{title}</h1>
                </div>
                <p className="wizard-desc">
                  Link the Question Bank questions this form asks, then map it to
                  the Tasks and Certifications whose completion should show it.
                </p>

                <div className="form-group">
                  <label className="form-label">
                    Feedback Form Name <span className="req">*</span>
                  </label>
                  <input
                    className="form-input"
                    value={form.name}
                    placeholder="Feedback Form Name"
                    onChange={(e) => rename(e.target.value)}
                    // Land the cursor here for a brand-new, unnamed form.
                    autoFocus={form.name === ""}
                  />
                  <p className="form-help">
                    Internal name used by admins to identify this form. Not shown
                    to learners.
                  </p>
                </div>

                {/* Questions and Triggers are both tables with their own
                    chrome, but they stay plain labelled fields — one form
                    type, 32px apart ([[form-spacing-rhythm]]). */}
                <div className="form-group">
                  <label className="form-label">Questions</label>
                  <FeedbackFormEditor
                    form={form}
                    bank={bank}
                    onUpdate={saveLinks}
                    onCreateQuestion={onCreateQuestion}
                  />
                  <p className="form-help">
                    Questions live in the Question Bank — this form links them,
                    and editing one in the bank updates every quiz and form that
                    uses it. Grading data on a linked question is ignored:
                    responses are collected without scoring.
                    <span
                      className="form-help-info"
                      tabIndex={0}
                      aria-label="When a user has to answer"
                      title={OPTIONAL_RULE}
                    >
                      <InfoIcon14 />
                    </span>
                  </p>
                </div>

                <div className="form-group">
                  {/* Required, like the name: a form with no trigger never
                      fires, so the footer's Done waits on this field too. */}
                  <label className="form-label">
                    Triggers <span className="req">*</span>
                  </label>
                  <FeedbackFormTriggers
                    form={form}
                    allForms={allForms}
                    onSave={saveTriggers}
                  />
                  {/* Subtext always sits BELOW the control
                      ([[form-subtext-pattern]]), and the "How triggers behave"
                      card that used to close the step is now the ⓘ on it. */}
                  <p className="form-help">
                    This form is shown when a user completes any of these Tasks
                    or Certifications. A Task or Certification can be mapped to
                    at most one form.
                    <span
                      className="form-help-info"
                      tabIndex={0}
                      aria-label="How triggers behave"
                      title={TRIGGER_RULES}
                    >
                      <InfoIcon14 />
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={leave}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          {/* One primary button, named for what it does — the Task wizards'
              last-step shape ([[wizard-footer-shortcuts]]). Disable / Enable
              form left this page: status is the list row's menu's job, and a
              form being edited is not the place to switch it off. */}
          <button
            className={`btn-publish${ready ? "" : " is-disabled"}`}
            aria-disabled={!ready}
            data-tip={blockedTip}
            onClick={done}
          >
            {isCreating ? "Create Feedback Form" : "Save Changes"}
            <WizardKeyHint shift />
          </button>
        </div>
      </footer>
    </div>
  );
}
