import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Faster than the browser's native `title` delay (~500ms). Any element with a
// non-empty `data-tip` attribute gets this tooltip; `\n` renders as line breaks.
const DELAY = 300;

// One tooltip in the app: a native `title` is folded into this one the first
// time it is hovered, so pages that still use `title` get the same card without
// a per-call-site edit. The attribute is *moved*, not copied, so the browser's
// own slow, unstyled bubble never fires on top of it; the text stays reachable
// for screen readers via aria-label when the element has no text of its own
// (icon-only buttons).
function adopt(el: HTMLElement) {
  const native = el.getAttribute("title");
  if (!native) return;
  el.removeAttribute("title");
  if (!el.getAttribute("data-tip")) el.setAttribute("data-tip", native);
  if (!el.getAttribute("aria-label") && !el.textContent?.trim()) {
    el.setAttribute("aria-label", native);
  }
}

// Nearest ancestor (self included) that actually has tooltip text. Elements
// carrying an empty tip are skipped rather than swallowing an outer one.
function resolve(target: EventTarget | null): HTMLElement | null {
  // A trigger that already opens a hover card doesn't also get a tooltip: the
  // card says more than the tip could, and the tip lands on top of it. Titles
  // inside the trigger are still adopted — that strips them, so the browser's
  // own bubble can't show up in the tooltip's place either.
  const card = (target as HTMLElement)?.closest?.("[data-hover-card]") as HTMLElement | null;
  if (card) {
    adopt(card);
    card.querySelectorAll<HTMLElement>("[title]").forEach(adopt);
    return null;
  }

  let el = (target as HTMLElement)?.closest?.("[data-tip],[title]") as HTMLElement | null;
  while (el) {
    adopt(el);
    if (el.getAttribute("data-tip")) return el;
    el = (el.parentElement?.closest("[data-tip],[title]") as HTMLElement | null) ?? null;
  }
  return null;
}

/** A trigger's tip, withheld while the trigger is OPEN.
 *
 *  Returned as a `data-tip` value, not a `title`: `adopt()` above MOVES a
 *  native title into `data-tip` on first hover, so a React-controlled `title`
 *  can never be taken back once it has been adopted. `data-tip` stays
 *  React's to add and remove.
 *
 *  The dispatch is what makes it act at the moment of the click rather than on
 *  the next hover: the pointer is still on the pill when its menu opens, so a
 *  card is already on screen with nothing left to re-trigger it. `tip-refresh`
 *  makes the live tooltip re-read the anchor it is showing — the same hook
 *  CopyCells uses when a cell's tip changes under the pointer — which drops the
 *  card when the tip is gone and restores it when the menu closes. */
export function useTipWhileClosed(tip: string | undefined, open: boolean) {
  useEffect(() => {
    window.dispatchEvent(new Event("tip-refresh"));
  }, [open]);
  return open ? undefined : tip;
}

/* `below`/`above` are the two candidate y positions — which one is used is
   settled after the card is measured, since a long tip near the bottom of the
   window would otherwise run off it. */
type TipState = {
  text: string;
  /** `data-tip-head` — an optional SemiBold first line above the tip text, for
      a tip that needs a label before its list ("Any of" over the Tasks a Skill
      is linked to). Plain text; the body stays plain text too. */
  head: string | null;
  anchor: number;
  below: number;
  above: number;
  align: "left" | "right";
  /** `data-tip-place="above"` — prefer the space above the anchor (a tip on a
      control that sits ON the thing it describes, e.g. the footage grid's
      per-frame checkbox, must not cover that frame). Still flips below when
      there is no room above. */
  prefer: "below" | "above";
};

export function HoverTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | null>(null);
  const current = useRef<Element | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  /* Flip above the anchor when the card doesn't fit below it. Measured rather
     than estimated — tips run from one word to a full paragraph. Runs before
     paint, so the card never shows in the wrong place first. */
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !tip) return;
    const h = el.offsetHeight;
    const fitsBelow = tip.below + h <= window.innerHeight - 8;
    const fitsAbove = tip.above - h >= 8;
    const useAbove = tip.prefer === "above" ? fitsAbove : !fitsBelow;
    const top = useAbove ? Math.max(8, tip.above - h) : tip.below;
    el.style.top = `${top}px`;
  }, [tip]);

  useEffect(() => {
    function clearTimer() {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    }
    function hide() {
      clearTimer();
      current.current = null;
      setTip(null);
    }
    function show(el: HTMLElement) {
      const text = el.getAttribute("data-tip");
      if (!text) return;
      const r = el.getBoundingClientRect();
      // Left-align under the cell; flip to the right edge near the viewport edge.
      const nearRight = r.left + 320 > window.innerWidth;
      setTip({
        text,
        head: el.getAttribute("data-tip-head"),
        anchor: nearRight ? window.innerWidth - r.right : r.left,
        below: r.bottom + 6,
        above: r.top - 6,
        align: nearRight ? "right" : "left",
        prefer: el.getAttribute("data-tip-place") === "above" ? "above" : "below",
      });
    }
    function onOver(e: MouseEvent) {
      const el = resolve(e.target);
      if (!el || el === current.current) return;
      current.current = el;
      clearTimer();
      timer.current = window.setTimeout(() => show(el), DELAY);
    }
    function onOut(e: MouseEvent) {
      if (!current.current) return;
      const related = e.relatedTarget as Node | null;
      if (related && current.current.contains(related)) return; // moved within the cell
      hide();
    }
    // The hovered element's tip changed under the pointer (a cell flipping to
    // "Copied" — see CopyCells.tsx): re-read it and show at once, no delay.
    function onRefresh() {
      const el = current.current as HTMLElement | null;
      if (!el) return;
      clearTimer();
      if (el.getAttribute("data-tip")) show(el);
      else setTip(null);
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    window.addEventListener("tip-refresh", onRefresh);
    // Position is captured at show-time, so hide on any scroll to avoid drift.
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("tip-refresh", onRefresh);
      window.removeEventListener("scroll", hide, true);
      clearTimer();
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      ref={cardRef}
      className="hover-tip"
      style={{
        top: tip.below,
        [tip.align]: tip.anchor,
      }}
    >
      {tip.head && <span className="hover-tip-head">{tip.head}</span>}
      {tip.text}
    </div>
  );
}
