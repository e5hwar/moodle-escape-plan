/* ─────────────── Shared wizard step rail ───────────────
   The left-panel step marker used by every wizard (Company, Task, Certification,
   Skill, Award, Design Template). Figma 625:1459 "Wizard Left Panel": each row
   is a 16px glyph column (mono number, grey check, or red error circle) + a
   16px SemiBold title. The active step is white; done steps recede to #7a7a7a;
   an error step goes red — glyph AND title. */

export type WizardStepStatus = "active" | "done" | "upcoming" | "error";

// Complete step: the 16px grey check (Figma 625:1557). The glyph sits in the
// 16-unit box per the Figma insets via the offset viewBox; colour comes from
// the rail's currentColor.
export function StepCheckIcon() {
  return (
    <svg width="16" height="16" viewBox="-3.62 -4.92 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M10.3701 0.942809L4.24281 7.07148L0.942809 3.77148"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="square"
      />
    </svg>
  );
}

// Error step ("needs input"): the 16px error-circle (Figma 625:1551) — an
// exclamation in a circle, coloured via currentColor.
function StepAlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M14.6667 8C14.6667 11.6819 11.6819 14.6667 8 14.6667C4.3181 14.6667 1.33333 11.6819 1.33333 8C1.33333 4.3181 4.3181 1.33333 8 1.33333C11.6819 1.33333 14.6667 4.3181 14.6667 8Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="square"
      />
      <path
        d="M8 5V8.66667M8 11H8.0026V11.0026H8V11Z"
        stroke="currentColor"
        strokeWidth="1.33333"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function WizardStepRail({ status, num }: { status: WizardStepStatus; num: number }) {
  return (
    <span className="wizard-step-rail">
      {status === "error" ? (
        <StepAlertIcon />
      ) : status === "done" ? (
        <StepCheckIcon />
      ) : (
        <span className="wizard-step-num">{("0" + num).slice(-2)}</span>
      )}
    </span>
  );
}
