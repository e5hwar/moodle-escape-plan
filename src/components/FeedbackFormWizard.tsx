import { useCallback, useEffect, useRef, useState } from "react";
import { CopiedToast } from "./CopiedToast";
import {
  type FeedbackForm,
  type FormQuestionLink,
  type FormTrigger,
} from "../data/feedbackForms";
import { type Question } from "../data/questionBank";
import { FeedbackFormEditor, FeedbackInactiveQuestions } from "./FeedbackFormEditor";
// `leave` is aliased: this file's own `leave()` is leaving the PAGE.
import { leave as leaveField, useTouchedKeys } from "./fieldFlags";
import { FeedbackFormTriggers } from "./FeedbackFormTriggers";
import { draftKey, useLeaveGuard } from "./LeaveGuard";
import { CrumbChevronIcon, InfoIcon12 } from "./icons";
import { LimitError } from "./CharCount";
import { LimitedInput } from "./LimitedInput";
import { NAME_MAX, isOver } from "../data/fieldLimits";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";

type Props = {
  form: FeedbackForm;
  /** Opened straight from Create Feedback Form — only changes the head's wording. */
  creating?: boolean;
  allForms: FeedbackForm[];
  bank: Question[];
  /** `finished` = left through Create Feedback Form / Save Changes (the page
   *  then toasts); Cancel and the crumbs leave without it. */
  onBack: (finished?: boolean) => void;
  /** The trail's first step — Feedback Forms hangs off Certifications. */
  onBackToCerts: () => void;
  /** Throw the record away — only ever called on a form this page CREATED that
   *  never became valid. See `leave()`. */
  onDiscard: () => void;
  onUpdate: (form: FeedbackForm) => void;
  onCreateQuestion: () => void;
  /** A success handed back by the question editor ("Question Created"). */
  flash?: string | null;
  onFlashDone?: () => void;
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
/** Each form-being-created's snapshot as it first opened, by form id — see
 *  `pristine` below. Tiny strings; a few per session at most. */
const OPENED_AS = new Map<string, string>();

export function FeedbackFormWizard({
  form,
  creating,
  allForms,
  bank,
  onBack,
  onBackToCerts,
  onDiscard,
  onUpdate,
  onCreateQuestion,
  flash,
  onFlashDone,
}: Props) {
  const [toast, setToast] = useState<string | null>(flash ?? null);
  useEffect(() => {
    if (flash) setToast(flash);
  }, [flash]);
  const onToastDone = useCallback(() => {
    setToast(null);
    onFlashDone?.();
  }, [onFlashDone]);
  // Everything saves live (the prototype holds forms in App state), so the
  // footer buttons only handle status transitions and navigation.
  function saveLinks(questions: FormQuestionLink[]) {
    onUpdate({ ...form, questions, updatedAt: TODAY });
  }
  /* Removing the last trigger flags the field at once with why (Figma list
     item 36) — not "cannot be left empty", which is for one never filled. */
  const [droppedLast, setDroppedLast] = useState(false);
  function saveTriggers(triggers: FormTrigger[]) {
    if (triggers.length === 0 && form.triggers.length > 0) {
      setDroppedLast(true);
      touch("triggers");
    } else if (triggers.length > 0) {
      setDroppedLast(false);
    }
    onUpdate({ ...form, triggers, updatedAt: TODAY });
  }
  function rename(name: string) {
    onUpdate({ ...form, name, updatedAt: TODAY });
  }

  const isCreating = creating ?? false;
  const title = isCreating ? "New Feedback Form" : "Edit Feedback Form";

  /* Three required fields: a name, at least one question (the user,
     2026-10-02), and at least one trigger — **a form with no trigger can never
     be shown to anyone** (the user, 2026-09-18), so it is not a form yet. The rail used to report a missing field with a red alert
     circle; on one page the footer button carries it, listing whatever is still
     missing ([[task-publish-flow]]'s gate pattern). */
  const named = form.name.trim().length > 0;
  const asks = form.questions.length > 0;
  const mapped = form.triggers.length > 0;
  // Soft limit (data/fieldLimits.ts): a name past it blocks like an empty one.
  const nameOver = isOver(NAME_MAX, form.name);
  const missing = [
    named ? null : "give the form a name",
    nameOver ? `shorten the name to ${NAME_MAX} characters or fewer` : null,
    asks ? null : "add at least one question",
    mapped ? null : "map at least one trigger",
  ].filter(Boolean) as string[];
  const ready = missing.length === 0;
  // Each field says so once clicked into and out of while empty, or after a
  // blocked Done (fieldFlags.tsx).
  const { touched, touch } = useTouchedKeys();
  const [attempted, setAttempted] = useState(false);
  const nameMissing = !named && (attempted || touched.has("name"));
  const questionsMissing = !asks && (attempted || touched.has("questions"));
  const triggersMissing = !mapped && (attempted || touched.has("triggers"));
  /* The form as it opened (also the LeaveGuard's snapshot below). Editing an
     existing form with nothing changed leaves Save Changes dimmed. */
  const pristine = useRef(
    (isCreating && OPENED_AS.get(form.id)) ||
      draftKey({ name: form.name, questions: form.questions, triggers: form.triggers }),
  );
  /* A new form survives a detour to Create New Question (this page unmounts
     and comes back), so its snapshot must too — otherwise the half-made form
     reads as untouched on return, and leaving would discard it, question and
     all, without the confirm. */
  if (isCreating && !OPENED_AS.has(form.id)) OPENED_AS.set(form.id, pristine.current);
  const currentKey = draftKey({ name: form.name, questions: form.questions, triggers: form.triggers });
  const unchanged = !isCreating && currentKey === pristine.current;
  const canFinish = ready && !unchanged;
  const blockedTip = canFinish
    ? undefined
    : ready
    ? "No changes to save"
    : `To finish, ${missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}` : missing[0]}.${mapped ? "" : " A form with no trigger is never shown to anyone."}`;

  function done() {
    if (canFinish) onBack(true);
    else if (!ready) setAttempted(true);
  }

  /* The only exit that loses anything is that discard, so it is the only one
     that asks (the shared LeaveGuard): a new form, still not valid, that the
     admin has put something into since it opened — a name, a question, a
     trigger. The snapshot is the form as it opened, so a form started from a
     Certification (its trigger pre-mapped) is not dirty for that alone, and
     an untouched new form still leaves without asking. Edits save live, so an
     existing or already-valid form has nothing to lose. */
  const dirty =
    isCreating &&
    !ready &&
    currentKey !== pristine.current;
  // The sidebar and browser Back purge it too, once the discard is confirmed.
  const guard = useLeaveGuard(dirty, { noun: "Feedback Form", creating: true, onDiscard });

  /* Leaving without finishing. Everything here saves live, so a brand-new form
     abandoned half-made would otherwise sit in the list as an untitled row with
     no trigger — exactly the state the gate above exists to prevent. So a form
     this page created that never became valid is DISCARDED on the way out
     (Cancel and every crumb). A form that is already valid is kept —
     leaving is then just navigation — and an existing form is never touched.
     `go` is where the exit lands: Feedback Forms, or a step further up the
     trail (a discard lands on Feedback Forms first; `go` then overrides it). */
  function leave(go?: () => void) {
    // An existing form's edits are already saved, so leaving one that changed
    // says so ("Feedback Form Updated") rather than reading like a cancel.
    const edited = !isCreating && currentKey !== pristine.current;
    guard(() => {
      if (isCreating && !ready) onDiscard();
      (go ?? (() => onBack(edited)))();
    });
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
                    Certifications header — so the full trail is Certifications
                    › Feedback Forms, every step a way back out. The trail
                    never names the page itself. */}
                <nav className="rvc-crumbs" aria-label="Breadcrumb">
                  <button
                    className="rvc-crumb"
                    onClick={() => leave(onBackToCerts)}
                    title="Back to Certifications"
                  >
                    Certifications
                  </button>
                  <CrumbChevronIcon />
                  <button
                    className="rvc-crumb"
                    onClick={() => leave()}
                    title="Back to Feedback Forms"
                  >
                    Feedback Forms
                  </button>
                </nav>
                <div className="rvc-pagehead">
                  <h1 className="tasks-title">{title}</h1>
                </div>
                <p className="tasks-subtitle wizard-desc">
                  Link the Question Bank questions this form asks, then map it to
                  the Tasks and Certifications whose completion should show it.
                </p>

                <div className="form-group" onBlur={leaveField(() => touch("name"))}>
                  <label className="form-label">
                    Feedback Form Name<span className="req">*</span>
                    {nameMissing && (
                      <span className="form-label-error">Feedback Form Name cannot be left empty</span>
                    )}
                    <LimitError max={NAME_MAX} values={[form.name]} warn={false} />
                  </label>
                  <LimitedInput
                    max={NAME_MAX}
                    warn={false}
                    className={`form-input${nameMissing ? " has-error" : ""}`}
                    aria-invalid={nameMissing || undefined}
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
                <div className="form-group" onBlur={leaveField(() => touch("questions"))}>
                  <label className="form-label">
                    Questions<span className="req">*</span>
                    {questionsMissing && (
                      <span className="form-label-error">Questions cannot be left empty</span>
                    )}
                  </label>
                  <FeedbackFormEditor
                    flagged={questionsMissing}
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
                      <InfoIcon12 />
                    </span>
                  </p>
                </div>

                {/* Inactive links get a field of their own, on the Questions
                    table's card (Figma 1478:3391) — present only while there
                    is something to bring back. */}
                {form.questions.some((l) => l.status === "inactive") && (
                  <div className="form-group">
                    <label className="form-label">Inactive Questions</label>
                    <FeedbackInactiveQuestions form={form} bank={bank} onUpdate={saveLinks} />
                    <p className="form-help">
                      No longer shown to users. The questions and all responses
                      already collected against them remain attached to this form.
                    </p>
                  </div>
                )}

                <div className="form-group" onBlur={leaveField(() => touch("triggers"))}>
                  {/* Required, like the name: a form with no trigger never
                      fires, so the footer's Done waits on this field too. */}
                  <label className="form-label">
                    Triggers<span className="req">*</span>
                    {triggersMissing && (
                      <span className="form-label-error">
                        {droppedLast ? "A form needs at least one trigger" : "Triggers cannot be left empty"}
                      </span>
                    )}
                  </label>
                  <FeedbackFormTriggers
                    form={form}
                    allForms={allForms}
                    onSave={saveTriggers}
                    invalid={triggersMissing}
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
                      <InfoIcon12 />
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* Back from the question editor with a new question linked in —
              40px above the footer (`.wizard-main > .pl-copied-toast`). */}
          {toast && <CopiedToast label={toast} onDone={onToastDone} />}
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={() => leave()}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          {/* One primary button, named for what it does — the Task wizards'
              last-step shape ([[wizard-footer-shortcuts]]). Disable / Enable
              form left this page: status is the list row's menu's job, and a
              form being edited is not the place to switch it off. */}
          <button
            className={`btn-publish${canFinish ? "" : " is-disabled"}`}
            aria-disabled={!canFinish}
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
