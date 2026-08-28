/**
 * Always-visible custom scrollbars for the app's scroll containers.
 *
 * macOS/Chromium renders native scrollbars as *overlay* — they take no layout
 * space and fade out when idle — so a persistent, visible scrollbar can't be
 * achieved with `::-webkit-scrollbar` CSS alone. This module draws its own
 * track + thumb for each matching container and keeps them glued to the
 * container's edges, always visible whenever the content overflows.
 *
 * The elements live in <body> (outside React's tree) so React never reconciles
 * them. Positions are recomputed on the events that can change them — scroll,
 * resize, and DOM mutations — rather than a rAF loop (rAF is throttled in
 * background/headless tabs).
 */

const SELECTOR = ".tasks-scroll, .table-xscroll";
const THICKNESS = 6; // px — track/thumb size on the cross axis
const INSET = 2; // px — gap from the container edge
const MIN_THUMB = 28; // px — smallest thumb so it stays grabbable
// Tables no longer show a vertical scrollbar — only the horizontal one is drawn.
// (Vertical wheel/trackpad scrolling still works; just the indicator is hidden.)
const SHOW_VERTICAL = false;

type Axis = "h" | "v";

type Bars = {
  hTrack: HTMLDivElement;
  hThumb: HTMLDivElement;
  vTrack: HTMLDivElement;
  vThumb: HTMLDivElement;
  // Latest geometry, read by drag handlers.
  hTrackLen: number;
  hThumbLen: number;
  vTrackLen: number;
  vThumbLen: number;
};

const tracked = new Map<HTMLElement, Bars>();
let resizeObserver: ResizeObserver | null = null;

let drag:
  | { el: HTMLElement; bars: Bars; axis: Axis; startPointer: number; startScroll: number }
  | null = null;

function makeEl(cls: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = cls;
  document.body.appendChild(el);
  return el;
}

function register(el: HTMLElement): Bars {
  const bars: Bars = {
    hTrack: makeEl("cbar-track"),
    hThumb: makeEl("cbar-thumb"),
    vTrack: makeEl("cbar-track"),
    vThumb: makeEl("cbar-thumb"),
    hTrackLen: 0,
    hThumbLen: 0,
    vTrackLen: 0,
    vThumbLen: 0,
  };
  bars.hThumb.addEventListener("pointerdown", (e) => startDrag(e, el, bars, "h"));
  bars.vThumb.addEventListener("pointerdown", (e) => startDrag(e, el, bars, "v"));
  tracked.set(el, bars);
  resizeObserver?.observe(el);
  layout(el, bars);
  return bars;
}

function unregister(el: HTMLElement) {
  const bars = tracked.get(el);
  if (!bars) return;
  bars.hTrack.remove();
  bars.hThumb.remove();
  bars.vTrack.remove();
  bars.vThumb.remove();
  tracked.delete(el);
  resizeObserver?.unobserve(el);
  if (drag?.el === el) drag = null;
}

function startDrag(e: PointerEvent, el: HTMLElement, bars: Bars, axis: Axis) {
  e.preventDefault();
  drag = {
    el,
    bars,
    axis,
    startPointer: axis === "h" ? e.clientX : e.clientY,
    startScroll: axis === "h" ? el.scrollLeft : el.scrollTop,
  };
  (axis === "h" ? bars.hThumb : bars.vThumb).classList.add("is-dragging");
  document.body.style.userSelect = "none";
}

function onPointerMove(e: PointerEvent) {
  if (!drag) return;
  const { el, bars, axis, startPointer, startScroll } = drag;
  if (axis === "h") {
    const range = bars.hTrackLen - bars.hThumbLen;
    if (range <= 0) return;
    el.scrollLeft = startScroll + ((e.clientX - startPointer) / range) * (el.scrollWidth - el.clientWidth);
  } else {
    const range = bars.vTrackLen - bars.vThumbLen;
    if (range <= 0) return;
    el.scrollTop = startScroll + ((e.clientY - startPointer) / range) * (el.scrollHeight - el.clientHeight);
  }
  layout(el, bars); // immediate feedback even before the scroll event fires
}

function onPointerUp() {
  if (!drag) return;
  drag.bars.hThumb.classList.remove("is-dragging");
  drag.bars.vThumb.classList.remove("is-dragging");
  document.body.style.userSelect = "";
  drag = null;
}

function setOn(el: HTMLDivElement, on: boolean) {
  el.classList.toggle("is-on", on);
}

/** The element's box clamped to its horizontal-scroll ancestor and the viewport,
 *  so a bar is drawn on the visible edge — not off-screen at the content edge
 *  (Pattern B: the body's right edge is past the viewport when scrolled). */
function clipRect(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  let { left, top, right, bottom } = r;
  const anc = el.parentElement?.closest<HTMLElement>(".table-xscroll");
  if (anc) {
    const a = anc.getBoundingClientRect();
    left = Math.max(left, a.left);
    top = Math.max(top, a.top);
    right = Math.min(right, a.right);
    bottom = Math.min(bottom, a.bottom);
  }
  left = Math.max(left, 0);
  top = Math.max(top, 0);
  right = Math.min(right, window.innerWidth);
  bottom = Math.min(bottom, window.innerHeight);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function layout(el: HTMLElement, bars: Bars) {
  const c = clipRect(el);
  const visible = c.width > 0 && c.height > 0;
  const cs = getComputedStyle(el);
  const scrollableX = cs.overflowX === "auto" || cs.overflowX === "scroll";
  const scrollableY = cs.overflowY === "auto" || cs.overflowY === "scroll";
  const hOverflow = scrollableX && el.scrollWidth - el.clientWidth > 1;
  const vOverflow = scrollableY && el.scrollHeight - el.clientHeight > 1;

  // Leave a corner when both bars show so they don't overlap.
  // Reserve the sticky 48px actions column on the right so the H scrollbar ends at
  // the data columns, not under the fixed 3-dot/gear column (Figma 79:443).
  const actionsReserve = el.classList.contains("table-xscroll") ? 48 : 0;
  const hLen = c.width - INSET * 2 - Math.max(actionsReserve, SHOW_VERTICAL && vOverflow ? THICKNESS : 0);
  const vLen = c.height - INSET * 2 - (hOverflow ? THICKNESS : 0);

  // Horizontal bar — along the bottom edge.
  const showH = visible && hOverflow && hLen > MIN_THUMB;
  // Reserve a strip below the scrollport (transparent border-bottom via CSS) only
  // while the bar is shown, so it never overlaps the last row.
  el.classList.toggle("has-cbar-h", showH);
  setOn(bars.hTrack, showH);
  setOn(bars.hThumb, showH);
  if (showH) {
    const top = `${c.bottom - THICKNESS - INSET}px`;
    const left = c.left + INSET;
    const thumbLen = Math.max(MIN_THUMB, (hLen * el.clientWidth) / el.scrollWidth);
    const maxScroll = el.scrollWidth - el.clientWidth;
    const pos = maxScroll > 0 ? (el.scrollLeft / maxScroll) * (hLen - thumbLen) : 0;
    bars.hTrackLen = hLen;
    bars.hThumbLen = thumbLen;
    Object.assign(bars.hTrack.style, { top, left: `${left}px`, width: `${hLen}px`, height: `${THICKNESS}px` });
    Object.assign(bars.hThumb.style, { top, left: `${left + pos}px`, width: `${thumbLen}px`, height: `${THICKNESS}px` });
  }

  // Vertical bar — along the right edge.
  const showV = SHOW_VERTICAL && visible && vOverflow && vLen > MIN_THUMB;
  setOn(bars.vTrack, showV);
  setOn(bars.vThumb, showV);
  if (showV) {
    const left = `${c.right - THICKNESS - INSET}px`;
    const top = c.top + INSET;
    const thumbLen = Math.max(MIN_THUMB, (vLen * el.clientHeight) / el.scrollHeight);
    const maxScroll = el.scrollHeight - el.clientHeight;
    const pos = maxScroll > 0 ? (el.scrollTop / maxScroll) * (vLen - thumbLen) : 0;
    bars.vTrackLen = vLen;
    bars.vThumbLen = thumbLen;
    Object.assign(bars.vTrack.style, { left, top: `${top}px`, width: `${THICKNESS}px`, height: `${vLen}px` });
    Object.assign(bars.vThumb.style, { left, top: `${top + pos}px`, width: `${THICKNESS}px`, height: `${thumbLen}px` });
  }
}

function layoutAll() {
  for (const [el, bars] of tracked) {
    if (!el.isConnected) unregister(el);
    else layout(el, bars);
  }
}

function scan() {
  const found = new Set<HTMLElement>(Array.from(document.querySelectorAll<HTMLElement>(SELECTOR)));
  for (const el of found) if (!tracked.has(el)) register(el);
  for (const el of Array.from(tracked.keys())) if (!found.has(el)) unregister(el);
  layoutAll();
}

export function initCustomScrollbars() {
  if (typeof window === "undefined") return;
  const start = () => {
    resizeObserver = new ResizeObserver(layoutAll);
    scan();
    // DOM changes (page swap, column toggle, row load) can add/remove containers
    // or change a table's width — rescan and reposition.
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    // Any scroll (capture catches scrolls on inner containers), or a viewport
    // resize, repositions the bars.
    window.addEventListener("scroll", layoutAll, true);
    window.addEventListener("resize", layoutAll);
    // Thumb dragging.
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };
  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start, { once: true });
}
