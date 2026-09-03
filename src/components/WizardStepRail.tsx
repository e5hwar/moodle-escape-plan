/* ─────────────── Shared wizard step rail ───────────────
   The left-panel step marker used by every wizard (Company, Task, Certification,
   Skill, Award, Design Template). Figma 625:1459 "Wizard Left Panel": each row
   is a 16px glyph column (mono number, grey check, or red error circle) + a
   16px SemiBold title. The active step is white; done steps recede to #7a7a7a;
   an error step goes red — glyph AND title. */

import { useRef } from "react";

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

/* ─────────────── Shared rail statuses ───────────────
   Every wizard rail derives its glyphs from this hook rather than the old
   `i === step ? "active" : i < step ? "done" : "upcoming"` line, which handed a
   check to any step you had walked past — including one you left with a
   mandatory field empty, or skipped outright by clicking further down the rail.

   A step reads `error` (the red alert circle) once you have *passed* it — opened
   it and moved on, or jumped over it — while a required field on it is still
   blank. The check is reserved for steps that are genuinely complete. Steps you
   have never reached stay numbered, so the rail never accuses you of skipping
   something you haven't seen yet.

   `flagAll` is the failed-publish case: a submit attempt flags every incomplete
   step, the one in view and the untouched ones included. */
export function useWizardStepStatuses({
  step,
  count,
  incomplete,
  flagAll = false,
}: {
  step: number;
  count: number;
  /** True when step `i` still has a mandatory field empty. */
  incomplete: (i: number) => boolean;
  flagAll?: boolean;
}): WizardStepStatus[] {
  // Which steps have actually been opened. A ref, not state — it only ever
  // grows, and every change to it rides along with the step change that caused
  // it, so it never needs a render of its own.
  const visited = useRef<Set<number>>(new Set());
  visited.current.add(step);
  const out: WizardStepStatus[] = [];
  for (let i = 0; i < count; i++) {
    // Passed = behind the cursor, or opened at some point and left behind.
    const passed = i < step || visited.current.has(i);
    out.push(
      incomplete(i) && (flagAll || (passed && i !== step))
        ? "error"
        : i === step
          ? "active"
          : passed
            ? "done"
            : "upcoming",
    );
  }
  return out;
}
