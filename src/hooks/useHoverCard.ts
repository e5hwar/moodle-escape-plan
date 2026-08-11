import { useEffect, useRef, useState } from "react";

/* Shared plumbing for the hover cards that hang off a control (user details,
   keyboard-shortcut hint). Both are portalled to <body> and positioned off the
   trigger's rect: the surfaces they sit in scroll and clip, and the app's
   plain-text table rule strips styling from anything inside a data cell. */

export type HoverPos = { top: number; left: number; flip: boolean };

export function useHoverCard({
  width,
  openDelay = 120,
  /** Grace period so the pointer can travel from the trigger into the card. */
  closeDelay = 140,
  gap = 6,
  /** Flip above the trigger when the space below it is tighter than this. */
  flipBelow = 160,
}: {
  width: number;
  openDelay?: number;
  closeDelay?: number;
  gap?: number;
  flipBelow?: number;
}) {
  const [pos, setPos] = useState<HoverPos | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function open() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = anchorRef.current;
      if (!el) return;
      /* The wrapper collapses to 0×0 when its trigger is absolutely positioned
         (e.g. the media stage's overlay arrows) — measure the trigger then. */
      let r = el.getBoundingClientRect();
      if (!r.width && !r.height && el.firstElementChild) {
        r = el.firstElementChild.getBoundingClientRect();
      }
      const flip = window.innerHeight - r.bottom < flipBelow;
      setPos({
        top: flip ? r.top - gap : r.bottom + gap,
        left: Math.min(r.left, window.innerWidth - width - 12),
        flip,
      });
    }, openDelay);
  }

  function close() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPos(null), closeDelay);
  }

  /** Keep the card open — for the card's own onMouseEnter. */
  function hold() {
    window.clearTimeout(timer.current);
  }

  return { anchorRef, pos, open, close, hold };
}
