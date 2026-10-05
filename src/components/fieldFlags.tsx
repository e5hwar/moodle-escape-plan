import { useCallback, useRef, useState, type FocusEvent } from "react";

/* ─────────────── When a required field says "cannot be left empty" ───────────────
   The rule (2026-09-30): a field flags once the user has clicked INTO it and
   OUT again while it is still empty — never while it is first being filled in.
   In a multi-step wizard every required field on a step the user has moved
   past (a later step was opened, by wheel, rail or footer) flags as well, the
   way the rail's red glyph does. A blocked publish still flags every gap at
   once (the rail's `flagAll`). So per field:

     flagged = empty && (touched(key) || movedPast(stepOf(key)) || attempted)

   `useTouchedKeys` keeps the touched set, `leave` turns a field group's
   `onBlur` into a "focus left this whole group" signal (React's onBlur bubbles,
   and `relatedTarget` says where focus went), and `useMovedPast` says whether
   a step is behind the furthest one opened or was opened and then left. */

const EMPTY: ReadonlySet<string> = new Set();

/** The keys of every field the user has clicked into and out of. */
export function useTouchedKeys() {
  const [touched, setTouched] = useState<ReadonlySet<string>>(EMPTY);
  const touch = useCallback((key: string) => {
    setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);
  /** Forget every touch — a modal moving on to its next record. */
  const reset = useCallback(() => setTouched(EMPTY), []);
  return { touched, touch, reset };
}

/** `onBlur` for a field's wrapper: fires `cb` only when focus leaves the
 *  wrapper altogether — moving between the EN and ES rows, or onto the
 *  field's own buttons, doesn't count as leaving. Focus landing in a portalled
 *  menu counts (it is outside the group), which is what makes "opened the
 *  picker and closed it without choosing" a touch. */
export function leave(cb: () => void) {
  return (e: FocusEvent<HTMLElement>) => {
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) cb();
  };
}

/** The highest step index the wizard has shown so far. A field on step `i`
 *  counts as "moved past" once this is greater than `i`. A ref mutated during
 *  render, like the rail's own visited set — it only ever grows, and it grows
 *  on the step change that is already re-rendering. */
export function useMaxVisited(step: number): number {
  const ref = useRef(step);
  if (step > ref.current) ref.current = step;
  return ref.current;
}

/** Whether step `i` has been "moved past" — the rail's own rule
 *  (`useWizardStepStatuses`): a later step was opened, OR the step was opened
 *  and then left by any route, back included. `useMaxVisited` alone misses the
 *  second: a wizard's LAST step can never have a later one, so its gaps went
 *  red on the rail once left but never on the fields when you came back.
 *  The returned predicate changes identity whenever either input grows. */
export function useMovedPast(step: number): (i: number) => boolean {
  const max = useMaxVisited(step);
  const prev = useRef(step);
  const left = useRef<Set<number>>(new Set());
  if (prev.current !== step) {
    left.current.add(prev.current);
    prev.current = step;
  }
  const size = left.current.size;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((i: number) => i < max || left.current.has(i), [max, size]);
}
