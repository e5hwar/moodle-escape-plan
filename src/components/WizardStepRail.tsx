/* ─────────────── Shared wizard step rail ("Quiet Rail") ───────────────
   The left-panel step marker used by every wizard (Company, Task, Certification,
   Skill, Award, Design Template). The rail is monochrome: completed steps recede
   to a quiet grey check, and the only colour is the orange number on the active
   step. Each row shows just a glyph column + title — no per-step subtext. */

export type WizardStepStatus = "active" | "done" | "upcoming";

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

export function WizardStepRail({ status, num }: { status: WizardStepStatus; num: number }) {
  return (
    <span className="wizard-step-rail">
      {status === "done" ? (
        <StepCheckIcon />
      ) : (
        <span className="wizard-step-num">{("0" + num).slice(-2)}</span>
      )}
    </span>
  );
}
