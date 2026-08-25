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

/* `below`/`above` are the two candidate y positions — which one is used is
   settled after the card is measured, since a long tip near the bottom of the
   window would otherwise run off it. */
type TipState = {
  text: string;
  anchor: number;
  below: number;
  above: number;
  align: "left" | "right";
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
    const top =
      tip.below + h <= window.innerHeight - 8
        ? tip.below
        : Math.max(8, tip.above - h);
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
        anchor: nearRight ? window.innerWidth - r.right : r.left,
        below: r.bottom + 6,
        above: r.top - 6,
        align: nearRight ? "right" : "left",
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
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    // Position is captured at show-time, so hide on any scroll to avoid drift.
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
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
      {tip.text}
    </div>
  );
}
