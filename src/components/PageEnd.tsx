import { useEffect } from "react";

/* The page's 32px bottom when the page ends in a scroll (user, 2026-10-02:
   "Bottom of the page 32px. This doesn't apply if the page scrolls … The 32px
   comes at the end of the scrolling part, like how the top of the page scrolls
   even with the 32px header." — one general rule, not page by page).

   Every page shell pads 32px on all sides (`.tasks`, `.qb-content`). When the
   last thing on the page is pinned — a pagination bar, a table column, a save
   bar — that padding is right: it stops 32px above the window. When the last
   thing SCROLLS (Spotlight's table, Product Config's body, the Industries
   list, the Question Bank index, a profile), the padding left a dead 32px band
   under it: the scroll ended above the window and rows vanished early.
   Instead the scroll runs to the window edge and the 32px is the END of its
   scroll — the way the top 32px scrolls away with the content.

   CSS can't tell a scroller from a wrapper, so this does it once for every
   page. From each shell it walks down what sits on the page's bottom edge —
   the last in-flow child, or a visible full-bleed layer stacked over it (the
   Question Bank's landing over its table) — through the vertical stack,
   stopping at a row (a side panel scrolling beside a table is not the page's
   end), to the first element that actually scrolls vertically. Everything on
   that path sits flush on the shell's content floor, and none of it is a
   framed box (a bordered card keeps its 32px, like a pagination bar). Then:
   - `data-page-end` on the path's top — the shell's child, or the layer when
     the path runs through one (so the table under it never moves): it reaches
     through the shell's bottom padding, and the path below fills it;
   - `data-page-scroll` on the scroller: its content ends in the 32px.
   See the `[data-page-end]` rules in index.css. A shell that scrolls itself
   already ends that way; a shell whose child is another shell (the Question
   Bank's outer `.tasks`) defers to it.

   One document-level observer, like HoverTooltip and CopyCells: the marks
   follow every page, tab and state change (a class or data attribute — the
   landing/table switch) and window resizes, re-synced before the browser
   paints, so nothing jumps. */

const SHELLS = ".tasks, .qb-content";
const END = "data-page-end";
const SCROLL = "data-page-scroll";
/* The app-wide page padding (`.tasks`). Only a shell padding exactly this much
   hands it on — the CSS moves this amount. */
const PAD = 32;

const near = (a: number, b: number) => Math.abs(a - b) <= 1;

/* Scrolls vertically right now. Checking the overflow too keeps out a
   horizontal-only scroller (`overflow-x: auto` computes overflow-y to auto). */
function scrollsY(el: HTMLElement, cs: CSSStyleDeclaration) {
  return (cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight;
}

/* A visible box — a bottom border or a fill (a table card, a panel). Its frame
   is pinned like a pagination bar, so it keeps the 32px under it; only an
   unframed region can run off the window edge. */
function framed(cs: CSSStyleDeclaration) {
  return (
    (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none") ||
    cs.backgroundImage !== "none" ||
    !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor)
  );
}

/* On the page's bottom edge: flush on the floor — or, while already marked,
   on the padding floor it now reaches. */
function onFloor(el: HTMLElement, floor: number) {
  const b = el.getBoundingClientRect().bottom;
  return near(b, floor) || (el.closest(`[${END}]`) !== null && near(b, floor + PAD));
}

/* What sits on `el`'s bottom edge, topmost first: visible full-bleed layers
   (absolutely positioned over the whole box — they paint above the flow),
   then the last in-flow child. */
function bottomCandidates(el: HTMLElement, floor: number): HTMLElement[] {
  const box = el.getBoundingClientRect();
  const layers: HTMLElement[] = [];
  let inFlow: HTMLElement | null = null;
  for (let c = el.lastElementChild as HTMLElement | null; c; c = c.previousElementSibling as HTMLElement | null) {
    const cs = getComputedStyle(c);
    if (cs.display === "none") continue;
    if (cs.position === "absolute") {
      const r = c.getBoundingClientRect();
      if (
        cs.visibility === "visible" &&
        parseFloat(cs.opacity) > 0 &&
        near(r.top, box.top) &&
        onFloor(c, floor)
      )
        layers.push(c);
      continue;
    }
    if (cs.position === "fixed") continue;
    if (!inFlow) inFlow = c;
  }
  return inFlow && onFloor(inFlow, floor) ? [...layers, inFlow] : layers;
}

/** From `el` down to the page-end scroller, or null. */
function pathFrom(el: HTMLElement, floor: number, depth = 0): HTMLElement[] | null {
  if (depth > 10) return null;
  for (const c of bottomCandidates(el, floor)) {
    if (c.matches(SHELLS)) return null;
    const cs = getComputedStyle(c);
    if (framed(cs)) continue;
    if (scrollsY(c, cs)) return [c];
    if (cs.display.includes("grid")) continue;
    if (cs.display.includes("flex") && cs.flexDirection.startsWith("row")) continue;
    const rest = pathFrom(c, floor, depth + 1);
    if (rest) return [c, ...rest];
  }
  return null;
}

function sync() {
  const ends = new Set<HTMLElement>();
  const scrollers = new Set<HTMLElement>();
  document.querySelectorAll<HTMLElement>(SHELLS).forEach((shell) => {
    const cs = getComputedStyle(shell);
    if (scrollsY(shell, cs) || parseFloat(cs.paddingBottom) !== PAD) return;
    const floor = shell.getBoundingClientRect().bottom - parseFloat(cs.borderBottomWidth) - PAD;
    const path = pathFrom(shell, floor);
    if (!path) return;
    /* The top that reaches down: the deepest layer on the path, else the
       shell's own child. A layer only can if nothing between it and the
       shell clips it. */
    let top = path[0];
    for (const el of path) if (getComputedStyle(el).position === "absolute") top = el;
    for (let a = top.parentElement; a && a !== shell; a = a.parentElement) {
      if (getComputedStyle(a).overflowY !== "visible") return;
    }
    ends.add(top);
    scrollers.add(path[path.length - 1]);
  });
  document.querySelectorAll<HTMLElement>(`[${END}]`).forEach((el) => {
    if (!ends.has(el)) el.removeAttribute(END);
  });
  document.querySelectorAll<HTMLElement>(`[${SCROLL}]`).forEach((el) => {
    if (!scrollers.has(el)) el.removeAttribute(SCROLL);
  });
  ends.forEach((el) => el.setAttribute(END, ""));
  scrollers.forEach((el) => el.setAttribute(SCROLL, ""));
}

export function PageEnd() {
  useEffect(() => {
    sync();
    /* A MutationObserver already batches a task's changes into one callback,
       run before the paint. Our own marks, and the per-frame `style` writes of
       the scroll-driven headers, never need a re-sync. */
    const mo = new MutationObserver((records) => {
      if (
        records.some(
          (r) =>
            r.type === "childList" ||
            (r.attributeName !== "style" && !r.attributeName?.startsWith("data-page-")),
        )
      )
        sync();
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", sync);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);
  return null;
}
