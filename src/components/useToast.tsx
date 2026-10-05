import { useCallback, useEffect, useRef, useState } from "react";
import { CopiedToast } from "./CopiedToast";

/* The page-level success toast (Figma 1046:1141) for pages that raise their
 * own: `const [toast, toastNode] = useToast(flash, onFlashDone)`, call
 * `toast("Task Hidden")` after the action lands, and render `{toastNode}`.
 * Each call restarts the timer (keyed by time), so a second action straight
 * after the first isn't cut short. `flash` is the App-level hand-back from a
 * flow that finished and navigated here ("Task Created"); it shows on
 * arrival and `onFlashDone` clears it upstream. */
export function useToast(flash?: string | null, onFlashDone?: () => void, ms?: number) {
  const [toast, setToast] = useState<{ label: string; at: number } | null>(null);
  useEffect(() => {
    if (flash) setToast({ label: flash, at: Date.now() });
  }, [flash]);
  // Held in a ref: App passes an inline arrow, and a new `onDone` every
  // render would restart CopiedToast's timer.
  const doneRef = useRef(onFlashDone);
  doneRef.current = onFlashDone;
  const show = useCallback((label: string) => setToast({ label, at: Date.now() }), []);
  const clear = useCallback(() => {
    setToast(null);
    doneRef.current?.();
  }, []);
  const node = toast ? (
    <CopiedToast key={toast.at} label={toast.label} ms={ms} onDone={clear} />
  ) : null;
  return [show, node] as const;
}
