/* ─────────────── Shared wizard step rail ("Quiet Rail") ───────────────
   The left-panel step marker used by every wizard (Company, Task, Certification,
   Skill, Award, Design Template). The rail is monochrome: completed steps recede
   to a quiet grey check, and the only colour is the orange number on the active
   step. Each row shows just a glyph column + title — no per-step subtext. */

export type WizardStepStatus = "active" | "done" | "upcoming" | "error";

// Complete step: a quiet grey check — it recedes so the active orange number is
// the only thing on the rail that carries colour.
export function StepCheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M2.2 6.4L4.8 9L9.8 3.6"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Error step ("needs input"): the quiet-rail warning glyph — an exclamation in a
// circle. Only the glyph carries colour (via currentColor); the step title stays
// neutral. Matches the "Quiz Wizard Quiet Rail" reference exactly.
function StepAlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="7" cy="7" r="5.9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 3.9V7.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="7" cy="10.2" r="0.95" fill="currentColor" />
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
