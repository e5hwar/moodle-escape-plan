/* ─────────────── Shared wizard step rail (Figma: Incomplete / Complete) ───────────────
   The left-panel step marker used by every wizard (Company, Task, Certification,
   Skill, Award, Design Template). A 16px status marker stacked over a 1px
   connector that runs down to the next step. */

export type WizardStepStatus = "active" | "done" | "upcoming";

// Incomplete step: a hollow 16px ring. Stroke uses currentColor so the rail can
// tint it grey for upcoming steps and accent-orange for the active step.
export function StepCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="8" cy="8" r="6.66667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square" />
    </svg>
  );
}

// Current step (Figma 46:290): a radio marker — accent-orange disc with a white
// center, both stroked accent-orange.
export function StepRadioIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z"
        fill="#F05523"
        stroke="#F05523"
        strokeWidth="1.33333"
        strokeLinecap="square"
      />
      <path
        d="M11.3333 8C11.3333 9.84095 9.84095 11.3333 8 11.3333C6.15905 11.3333 4.66667 9.84095 4.66667 8C4.66667 6.15905 6.15905 4.66667 8 4.66667C9.84095 4.66667 11.3333 6.15905 11.3333 8Z"
        fill="#fff"
        stroke="#F05523"
        strokeWidth="1.33333"
        strokeLinecap="square"
      />
    </svg>
  );
}

// Complete step: filled accent-orange disc with a white check.
export function StepCheckCircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M1.33334 8C1.33334 4.3181 4.3181 1.33333 8 1.33333C11.6819 1.33333 14.6667 4.3181 14.6667 8C14.6667 11.6819 11.6819 14.6667 8 14.6667C4.3181 14.6667 1.33333 11.6819 1.33334 8Z"
        fill="#F05523"
        stroke="#F05523"
        strokeWidth="1.33333"
        strokeLinecap="square"
      />
      <path d="M11 6L7 10L5 8" stroke="#fff" strokeWidth="1.33333" strokeLinecap="square" />
    </svg>
  );
}

export function WizardStepRail({ status, isLast }: { status: WizardStepStatus; isLast: boolean }) {
  return (
    <div className="wizard-step-rail">
      <span className="wizard-step-marker">
        {status === "done" ? (
          <StepCheckCircleIcon />
        ) : status === "active" ? (
          <StepRadioIcon />
        ) : (
          <StepCircleIcon />
        )}
      </span>
      {!isLast && <span className="wizard-step-connector" />}
    </div>
  );
}
