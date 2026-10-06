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
//
// A React-controlled `title` that CHANGES is set again on the element, and is
// adopted again on the next hover — so a `data-tip` (or aria-label) that this
// function wrote is overwritten with the new text, never kept from the first
// adoption. `data-tip-adopted` marks the value as ours; a `data-tip` the
// page set itself is left alone.
function adopt(el: HTMLElement) {
  const native = el.getAttribute("title");
  if (!native) return;
  el.removeAttribute("title");
  const prev = el.getAttribute("data-tip");
  if (!prev || prev === el.dataset.tipAdopted) {
    el.setAttribute("data-tip", native);
    el.dataset.tipAdopted = native;
  }
  const label = el.getAttribute("aria-label");
  if ((!label && !el.textContent?.trim()) || (label && label === el.dataset.ariaAdopted)) {
    el.setAttribute("aria-label", native);
    el.dataset.ariaAdopted = native;
  }
}

// `data-tip-overflow` makes a tip conditional: it shows only while the anchor
// (or text inside it) is ellipsized — on one line or a line-clamp's last —
// a name that fits says everything the tip
// would. Measured on hover, so it follows the column width as the page resizes.
function truncated(el: HTMLElement): boolean {
  return [el, ...el.querySelectorAll<HTMLElement>("*")].some(
    (n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1,
  );
}

const norm = (t: string) => t.replace(/\s+/g, " ").trim();

// The text an anchor's tooltip should show right now, or null for none.
//
// A tip inside a table body cell only earns its place when it says something
// the cell doesn't: the cell's text is cut off, or the tip holds lines the
// cell can't show (the rest of a "+1" list, an explanation). One that only
// repeats what is fully visible is dropped — for every table in the app,
// modals included, without each call site opting in. A live copy cell
// (CopyCells, `data-copy`) keeps its "Click to Copy"/"Copied" line; only the
// lines above it are judged.
function tipText(el: HTMLElement): string | null {
  const tip = el.getAttribute("data-tip");
  if (!tip) return null;
  if (el.hasAttribute("data-tip-overflow")) return truncated(el) ? tip : null;
  const td = el.closest<HTMLElement>("tbody td");
  if (!td || truncated(td)) return tip;
  const lines = tip.split("\n");
  const action = el.hasAttribute("data-copy") ? lines.pop()! : null;
  const visible = norm(el.innerText);
  const redundant = lines.every((l) => !norm(l) || visible.includes(norm(l)));
  if (!redundant) return tip;
  return action;
}

// Nearest ancestor (self included) that actually has tooltip text. Elements
// carrying an empty tip are skipped rather than swallowing an outer one, and so
// is a conditional tip (see `tipText`) that currently has nothing to add.
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
    if (tipText(el)) return el;
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
  /** `data-tip-head` — an optional Medium first line above the tip text, for
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
    /* Hug the text. A box that wraps stays at its max-width (320) even when
       every line it broke into is narrower, leaving a dead strip on the right
       ("Introduction to being an Electrician / Apprentice"). CSS has no
       shrink-to-widest-line, so measure the laid-out line boxes and set the
       width to the widest one. Rounded up, so no line can re-wrap. The card
       is reused across tips, so clear the last width first. */
    el.style.width = "";
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()];
    if (rects.length > 1) {
      const cs = getComputedStyle(el);
      const line = Math.max(...rects.map((r) => r.right)) - Math.min(...rects.map((r) => r.left));
      const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const border = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      const box = cs.boxSizing === "border-box" ? pad + border : 0;
      if (Math.ceil(line) + box < el.offsetWidth) el.style.width = `${Math.ceil(line) + box}px`;
    }
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
      const text = tipText(el);
      if (!text) return setTip(null);
      const r = el.getBoundingClientRect();
      // Left-align under the cell; flip to the right edge near the viewport edge.
      const nearRight = r.left + 320 > window.innerWidth;
      setTip({
        text,
        // The head labels the tip's list — gone when only a copy line is left.
        head: text === el.getAttribute("data-tip") ? el.getAttribute("data-tip-head") : null,
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
    function onRefresh(e: Event) {
      // A tip APPEARED on an element the pointer was already inside, so no
      // mouseover announced it — a copy cell entered off its value, whose
      // "Click to Copy" is only written once the pointer reaches the text.
      // The event names that element; treat it as a fresh hover.
      const hint = (e as CustomEvent<HTMLElement | undefined>).detail;
      if (hint instanceof HTMLElement && hint !== current.current) {
        if (!tipText(hint)) return;
        current.current = hint;
        clearTimer();
        timer.current = window.setTimeout(() => show(hint), DELAY);
        return;
      }
      const el = current.current as HTMLElement | null;
      if (!el) return;
      clearTimer();
      show(el);
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
      <TipBody head={tip.head} text={tip.text} />
    </div>
  );
}

/* Figma 1567:3206 "Heading + Subtext": an optional Medium head, then the body.
   A body written as a lead line then "• " items — the disabled CTAs'
   missing-fields tips ("Fill in every required field to publish:" + one
   "• Name — Task Details" per gap) — renders the lead as the head and the
   items as a real bulleted list, so every such tip reads the same without
   each caller building markup. */
function TipBody({ head, text }: { head: string | null; text: string }) {
  const lines = text.split("\n");
  const first = lines.findIndex((l) => l.startsWith("• "));
  if (first >= 0 && lines.slice(first).every((l) => l.startsWith("• "))) {
    const lead = [head, lines.slice(0, first).join("\n")].filter(Boolean).join("\n");
    return (
      <>
        {lead && <span className="hover-tip-head">{lead}</span>}
        <ul className="hover-tip-list">
          {lines.slice(first).map((l, i) => (
            <li key={i}>{l.slice(2)}</li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <>
      {head && <span className="hover-tip-head">{head}</span>}
      {text}
    </>
  );
}
