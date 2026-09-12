import { useEffect } from "react";
import { KeyCommandIcon, KeyShiftIcon, KeyEnterIcon } from "./icons";

/* The wizard footer's keycap hint (Figma 756:3772 primary CTA / 1113:1109
   secondary button): ⌘+Enter on the button that moves the wizard forward,
   ⌘+Shift+Enter on a create button that sits beside it. */
export function WizardKeyHint({ shift = false }: { shift?: boolean }) {
  return (
    <span className="wz-kbd">
      <span className="wz-key">
        <KeyCommandIcon />
      </span>
      {shift && (
        <span className="wz-key">
          <KeyShiftIcon />
        </span>
      )}
      <span className="wz-key">
        <KeyEnterIcon />
      </span>
    </span>
  );
}

/**
 * Wires the two footer shortcuts to the handlers behind those buttons.
 *
 * `onPrimary` runs on ⌘/Ctrl+Enter, `onShift` (when a wizard has a second,
 * create-from-any-step button) on ⌘/Ctrl+Shift+Enter. Pass the same guards the
 * buttons use — a shortcut must never do what a click on the button wouldn't.
 *
 * Held back while a modal or a portalled sub-wizard owns the screen: the
 * listener is on `document`, so without this ⌘+Enter inside a picker would
 * advance the wizard behind it. `enabled` covers the other direction — a wizard
 * that hands the screen to another wizard (Certification → its split Task
 * wizard) passes false, so only the visible one answers.
 *
 * No dependency array: the handler closes over this render's state, so it is
 * re-registered each render rather than going stale.
 */
export function useWizardEnterShortcut(
  onPrimary: () => void,
  onShift?: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.shiftKey && !onShift) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], .qz-qwiz'))
        return;
      e.preventDefault();
      if (e.shiftKey) onShift?.();
      else onPrimary();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
}
