import { useEffect } from "react";

/* Click-to-copy table cells (Figma 992:1015 "Content Row").

   Opt-in per cell: a `<td data-copyable>` gets the behaviour, nothing else
   does. Today that is the Email and Phone columns on Exam Reviews
   (ProctoringPage), ID Re-Uploads (PendingIdReuploadsPage), Hands-On Task
   Submissions (ReviewHandsOnPage), Quiz Attempts (AttemptsPage), Users
   (UsersPage), Scholarships, both Who Paid tables (Quiz/CertPurchasersPage) —
   the registry-driven ones via their `copyable` flag — plus the Deep Link
   modal's Link column. The tables whose values admins actually paste elsewhere. Marking more
   columns later is a one-attribute change; no other file needs to know.

   One document-level handler, like HoverTooltip. Only the VALUE is the
   target, not the whole cell: the pointer has to be on the text itself (or on
   the glyph beside it) — a cell's blank space, however wide, stays inert, and a
   click there is an ordinary row click. While the pointer is on the value the
   cell is marked `data-copy="fit" | "clip"` and the CSS paints a copy glyph (a
   `::before` pseudo-element, so React's DOM is never touched):

   - "fit"  — the text leaves room for the 12px glyph + 4px gap, so it sits
              right after the text (`--copy-x`), like the phone cell in Figma.
   - "clip" — no room: the cell's right padding grows by 16px, the ellipsis
              truncates a little more text, and the glyph sits at the right
              edge, like the email cell. Column widths never change — widths
              are border-box, so padding comes out of the content box.

   Clicking the value copies the cell's full text. For 3s afterwards the cell
   carries `data-copied` (the glyph crossfades to a check) and the tooltip
   reads "Copied". The tooltip text rides on `data-tip`, which HoverTooltip
   already renders; a cell's own tip (full name, "Used in" list…) is kept
   and "Click to Copy" is appended as a second line. */

const COPIED_MS = 3000;
const TIP_COPY = "Click to Copy";
const TIP_DONE = "Copied";
const GLYPH = 12;
const GAP = 4;

/* The opt-in marker. Only these cells copy. */
const CELL = "tbody td[data-copyable]";
const CONTROL = "a, button, input, select, textarea, label, [role='button'], [contenteditable]";

/* The part of a cell that copies — its text plus the glyph slot — in px from
   the cell's border-box corner, so it survives the table scrolling under it. */
type Zone = { left: number; right: number; top: number; bottom: number };

type Active = {
  td: HTMLTableCellElement;
  ownTip: string | null;
  zone: Zone;
};

const copied = new Map<HTMLTableCellElement, number>();
let active: Active | null = null;

/* Where the pointer actually is, so the active cell can be re-checked when the
   table re-renders under a still mouse — see `watch` / `revalidate`. */
let pointer: { x: number; y: number } | null = null;
let watcher: MutationObserver | null = null;

function cellText(td: HTMLElement): string {
  // innerText honours display:none (hidden pill dots) but not the ellipsis,
  // so a truncated cell still copies its full value.
  const text = td.innerText.replace(/\s+/g, " ").trim();
  if (!text || text === "—" || text === "-" || text === "–") return "";
  return text;
}

/* A marked cell with no value ("—", blank) has nothing to offer, so it stays
   inert rather than showing a glyph that copies an empty string. */
function isCopyable(td: HTMLTableCellElement): boolean {
  return Boolean(cellText(td));
}

function tipFor(own: string | null, done: boolean): string {
  const line = done ? TIP_DONE : TIP_COPY;
  return own ? `${own}\n${line}` : line;
}

/* `td` names the cell whose tip changed, for the case HoverTooltip has no
   anchor yet: the pointer came into the cell off the value, so its mouseover
   found no tip to show, and it only reached the value by moving within it. */
function refreshTip(td?: HTMLTableCellElement) {
  window.dispatchEvent(new CustomEvent("tip-refresh", { detail: td }));
}

type Layout = { fits: boolean; copyX: number; padR: number; zone: Zone };

/* Measure the content's laid-out extent (unclipped — ellipsis is paint-only)
   against the cell's content box: where the glyph goes, and so where the
   copy target ends. Read-only; expects the cell at rest (see `place`). */
function measure(td: HTMLTableCellElement): Layout {
  const cs = getComputedStyle(td);
  const box = td.getBoundingClientRect();
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const contentRight = box.right - padR;

  const range = document.createRange();
  range.selectNodeContents(td);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  range.detach();

  let left = rects.length ? Infinity : box.left + padL;
  let right = box.left + padL;
  let top = Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!rects.length) {
    top = box.top;
    bottom = box.bottom;
  }
  const singleLine = rects.length === 0 || bottom - top <= parseFloat(cs.fontSize) * 1.8;
  const fits = singleLine && right + GAP + GLYPH <= contentRight;

  // "fit": the glyph sits GAP after the text, so the target runs to its far
  // edge. "clip": the text already runs to the content edge, and the glyph is
  // set inside the grown padding ending on that same edge (`right: 12px`).
  const end = fits ? right + GAP + GLYPH : contentRight;
  return {
    fits,
    copyX: right - box.left + GAP,
    padR,
    zone: {
      left: left - box.left,
      right: Math.min(end, box.right) - box.left,
      top: top - box.top,
      bottom: bottom - box.top,
    },
  };
}

function inside(td: HTMLTableCellElement, zone: Zone, x: number, y: number): boolean {
  const box = td.getBoundingClientRect();
  const rx = x - box.left;
  const ry = y - box.top;
  return rx >= zone.left && rx <= zone.right && ry >= zone.top && ry <= zone.bottom;
}

function apply(td: HTMLTableCellElement, l: Layout) {
  if (l.fits) {
    td.style.setProperty("--copy-x", `${l.copyX}px`);
    td.style.removeProperty("padding-right");
    td.dataset.copy = "fit";
  } else {
    td.style.removeProperty("--copy-x");
    td.style.paddingRight = `${l.padR + GAP + GLYPH}px`;
    td.dataset.copy = "clip";
  }
}

/* Re-lay an active cell out. Its grown "clip" padding comes off first, or it
   would be measured as the cell's own and grown again on every pass. */
function place(td: HTMLTableCellElement): Zone {
  td.style.removeProperty("padding-right");
  const l = measure(td);
  apply(td, l);
  return l.zone;
}

function activate(td: HTMLTableCellElement, l: Layout) {
  const ownTip = td.getAttribute("data-tip");
  active = { td, ownTip, zone: l.zone };
  apply(td, l);
  if (copied.has(td)) td.dataset.copied = "";
  td.setAttribute("data-tip", tipFor(ownTip, copied.has(td)));
  watch(td);
}

function deactivate() {
  if (!active) return;
  const { td, ownTip } = active;
  active = null;
  unwatch();
  delete td.dataset.copy;
  delete td.dataset.copied;
  td.style.removeProperty("--copy-x");
  td.style.removeProperty("padding-right");
  /* Restore the cell's own tip only if the tip still reads as the one this
     module wrote. A reused cell (see `watch`) has already been re-rendered
     with a new value by then, and stamping the old row's tip back on would be
     a lie. */
  const current = td.getAttribute("data-tip");
  if (current !== tipFor(ownTip, true) && current !== tipFor(ownTip, false)) return;
  if (ownTip) td.setAttribute("data-tip", ownTip);
  else td.removeAttribute("data-tip");
}

/* React only ever re-renders a marked cell's CONTENT — it never clears the
   attributes and inline padding this module sets imperatively. So when a table
   re-renders while a cell is hovered (navigating to another page, paging,
   sorting, filtering) the browser fires no `mouseout` for the cell React
   reused, and the copy glyph, the extra padding and the "Click to Copy" tip
   stay stuck on a row nobody is hovering — the first row, usually, since that
   is the node React reuses first.

   So while a cell is active, watch its table for mutations and re-check
   against the real pointer position: still inside the same cell → re-measure,
   because the value underneath may be a different length now (and may no
   longer reach the pointer); anywhere else → let go, and pick up whatever
   value the pointer is genuinely on. */
function revalidate() {
  if (!active) return;
  if (!pointer) {
    deactivate();
    refreshTip();
    return;
  }
  const el = document.elementFromPoint(pointer.x, pointer.y);
  if (el && active.td.contains(el) && isCopyable(active.td)) {
    active.zone = place(active.td);
    if (inside(active.td, active.zone, pointer.x, pointer.y)) return;
  }
  track(el, pointer.x, pointer.y);
}

function watch(td: HTMLTableCellElement) {
  const table = td.closest("table") ?? td.closest("tbody");
  if (!table) return;
  watcher = new MutationObserver(() => revalidate());
  watcher.observe(table, { childList: true, subtree: true, characterData: true });
}

function unwatch() {
  watcher?.disconnect();
  watcher = null;
}

/* The marked cell an element sits in, if it has something to copy. */
function cellOf(target: EventTarget | null): HTMLTableCellElement | null {
  const td = (target as HTMLElement)?.closest?.(CELL) as HTMLTableCellElement | null;
  return td && isCopyable(td) ? td : null;
}

/* Settle which cell (if any) is active for a pointer at (x, y) over `target`:
   the cell it is in, and only while it is on that cell's value. */
function track(target: EventTarget | null, x: number, y: number) {
  pointer = { x, y };
  const td = cellOf(target);
  if (active && td === active.td) {
    if (inside(td, active.zone, x, y)) return;
    deactivate();
    refreshTip();
    return;
  }
  if (td) {
    const l = measure(td);
    if (inside(td, l.zone, x, y)) {
      deactivate();
      activate(td, l);
      refreshTip(td);
      return;
    }
  }
  if (active) {
    deactivate();
    refreshTip();
  }
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function markCopied(td: HTMLTableCellElement) {
  const prev = copied.get(td);
  if (prev !== undefined) window.clearTimeout(prev);
  copied.set(
    td,
    window.setTimeout(() => {
      copied.delete(td);
      if (active?.td === td) {
        delete td.dataset.copied;
        td.setAttribute("data-tip", tipFor(active.ownTip, false));
        refreshTip();
      }
    }, COPIED_MS),
  );
  if (active?.td === td) {
    td.dataset.copied = "";
    td.setAttribute("data-tip", tipFor(active.ownTip, true));
    refreshTip();
  }
}

export function CopyCells() {
  useEffect(() => {
    // The value is a region inside the cell, not an element, so crossing onto
    // it fires no mouseover — every move is checked.
    function onMove(e: MouseEvent) {
      track(e.target, e.clientX, e.clientY);
    }

    // Capture phase: runs before HoverTooltip's bubble listener, so when the
    // pointer enters a cell straight onto its value the tip text is already
    // on the cell by the time the tooltip resolves it.
    function onOver(e: MouseEvent) {
      track(e.target, e.clientX, e.clientY);
    }
    function onOut(e: MouseEvent) {
      if (!active) return;
      const related = e.relatedTarget as Node | null;
      if (related && active.td.contains(related)) return;
      deactivate();
    }
    // The table scrolling under a still pointer moves the value off it (or
    // onto it) with no mouse event at all.
    function onScroll() {
      if (!pointer) return;
      track(document.elementFromPoint(pointer.x, pointer.y), pointer.x, pointer.y);
    }
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return;
      const td = cellOf(e.target);
      if (!td) return;
      const target = e.target as HTMLElement;
      // Controls inside the cell keep their own click; so does a drag-select.
      if (target.closest(CONTROL)) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && td.contains(sel.anchorNode)) return;
      const text = cellText(td);
      if (!text) return;
      // Off the value, the cell is like any other: the row's click goes ahead.
      track(e.target, e.clientX, e.clientY);
      if (active?.td !== td) return;
      // Most tables carrying these cells open a detail view when their row is
      // clicked. A copy that also navigated away would be useless, so the
      // value is a copy target only — the row's own click stops here.
      e.preventDefault();
      e.stopPropagation();
      void writeClipboard(text).then((ok) => {
        if (ok) markCopied(td);
      });
    }

    document.addEventListener("mousemove", onMove, { capture: true, passive: true });
    document.addEventListener("mouseover", onOver, true);
    document.addEventListener("mouseout", onOut, true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll, true);
      deactivate();
      copied.forEach((t) => window.clearTimeout(t));
      copied.clear();
    };
  }, []);

  return null;
}
