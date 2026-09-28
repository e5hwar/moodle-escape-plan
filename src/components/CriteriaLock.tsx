import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FieldLockIcon } from "./icons";
import { PrmModal } from "./PrmModal";

/* Locked completion criteria while editing an existing Task or Certification
   (Figma 1360:1883 "Atomic Component - Locked Field").

   The field keeps its label and its controls in place; between them sits a
   Locked banner — padlock, "Locked", a line saying how many learners have
   completed it, and an Edit Criteria Secondary Button. The controls under it
   stay drawn as they are (the node doesn't grey them) but can't be changed.

   Edit Criteria opens a two-step confirm on the default modal (PrmModal): the
   first says what editing does, and confirming it stacks "Are you sure?" on top
   of it. Dismissing the top one returns to the first; confirming it unlocks. */

export type CriteriaSubject = "Task" | "Certification";

/** A plausible, stable completion count for a record the seed data doesn't
 *  track completions for — FNV-1a over its id, spread across 40–3,999. */
export function sampleCompletionCount(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return 40 + ((h >>> 0) % 3960);
}

function learnersLine(count: number, subject: CriteriaSubject): string {
  if (count === 0) return `No learners have completed this ${subject} yet.`;
  const n = count.toLocaleString();
  return count === 1
    ? `1 learner has completed this ${subject}.`
    : `${n} learners have completed this ${subject}.`;
}

/** Wraps the criteria controls. `banner` false = a second gated stretch of the
 *  same step (e.g. a Quiz's pass marks): locked the same way, no banner of its
 *  own — the step's one banner unlocks both, since the lock state is the
 *  wizard's. */
export function CompletionCriteriaGate({
  locked,
  onUnlock,
  subject,
  completions,
  banner = true,
  children,
}: {
  locked: boolean;
  onUnlock: () => void;
  subject: CriteriaSubject;
  /** Learners who have completed the record — the banner's and modals' count. */
  completions: number;
  banner?: boolean;
  children: ReactNode;
}) {
  /** 0 = no modal, 1 = the explanation, 2 = "Are you sure?" stacked on it. */
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Escape backs out one modal at a time, top first. Capture phase, so the
  // wizard's own Escape handling doesn't also fire underneath.
  useEffect(() => {
    if (step === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setStep((s) => (s === 2 ? 1 : 0));
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [step]);

  const learners = learnersLine(completions, subject);
  const noun = subject.toLowerCase();

  return (
    <>
      {banner ? (
        /* Banner and controls space themselves (8px, the node's gap), so the
           field reads the same inside a flex form-group or a block one. The
           wrapper stays after unlocking, keeping the controls' tree stable. */
        <div className="crit-lock-wrap">
          {locked && (
            <div className="crit-lock-banner" role="note">
              <div className="crit-lock-lead">
                <span className="crit-lock-icon">
                  <FieldLockIcon />
                </span>
                <div className="crit-lock-text">
                  <span className="crit-lock-title">Locked</span>
                  <span className="crit-lock-sub">
                    {learners} Editing the criteria recomputes their completion
                    status and time of completion when you save.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="prm-quiet"
                onClick={() => setStep(1)}
              >
                Edit Criteria
              </button>
            </div>
          )}
          <fieldset className="crit-lock" disabled={locked}>
            {children}
          </fieldset>
        </div>
      ) : (
        <fieldset className="crit-lock" disabled={locked}>
          {children}
        </fieldset>
      )}

      {/* Portalled to <body>: the wizard's step container is transformed, which
          would turn the overlays' position:fixed into a box inside the pane. */}
      {step >= 1 &&
        createPortal(
          <PrmModal
            title="Edit Completion Criteria?"
            description={learners}
            confirmLabel="Edit Criteria"
            onCancel={() => setStep(0)}
            onConfirm={() => setStep(2)}
          >
            <p className="prm-text">
              When you save, every learner's completion status and time of
              completion for this {noun} is recomputed under the new criteria,
              and learners who no longer meet them lose their completion.{" "}
              {subject === "Task"
                ? "Attempts, scores and time data are never deleted."
                : "Awards already issued are not revoked."}
            </p>
          </PrmModal>,
          document.body,
        )}

      {step === 2 &&
        createPortal(
          <PrmModal
            title="Are you sure?"
            description={`Completion for this ${noun} will be recomputed under the new criteria when you save. This can't be undone.`}
            confirmLabel="Yes, Edit Criteria"
            cancelLabel="Go Back"
            danger
            onCancel={() => setStep(1)}
            onConfirm={() => {
              setStep(0);
              onUnlock();
            }}
          />,
          document.body,
        )}
    </>
  );
}
