import { useEffect } from "react";

/* Click-to-copy table cells (Figma 992:1015 "Content Row").

   Opt-in per cell: a `<td data-copyable>` gets the behaviour, nothing else
   does. Today that is the Email and Phone columns on Exam Reviews
   (ProctoringPage), ID Re-Uploads (PendingIdReuploadsPage), Hands-On Task
   Submissions (ReviewHandsOnPage), Quiz Attempts (AttemptsPage) and both Who
   Paid tables (Quiz/CertPurchasersPage) — the last four via their column
   registry's `copyable` flag. The tables whose values admins actually paste elsewhere. Marking more
   columns later is a one-attribute change; no other file needs to know.

   One document-level handler, like HoverTooltip. Hovering a marked cell
   marks it `data-copy="fit" | "clip"` and the CSS paints a copy glyph (a
   `::before` pseudo-element, so React's DOM is never touched):

   - "fit"  — the text leaves room for the 12px glyph + 4px gap, so it sits
              right after the text (`--copy-x`), like the phone cell in Figma.
   - "clip" — no room: the cell's right padding grows by 16px, the ellipsis
              truncates a little more text, and the glyph sits at the right
              edge, like the email cell. Column widths never change — widths
              are border-box, so padding comes out of the content box.

   Clicking anywhere on the cell copies its text. For 3s afterwards the cell
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

type Active = {
  td: HTMLTableCellElement;
  ownTip: string | null;
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

function refreshTip() {
  window.dispatchEvent(new Event("tip-refresh"));
}

/* Measure the content's laid-out extent (unclipped — ellipsis is paint-only)
   against the cell's content box and decide where the glyph goes. */
function place(td: HTMLTableCellElement) {
  const cs = getComputedStyle(td);
  const box = td.getBoundingClientRect();
  const padL = parseFloat(cs.paddingLeft) || 0;
  const padR = parseFloat(cs.paddingRight) || 0;
  const contentRight = box.right - padR;

  const range = document.createRange();
  range.selectNodeContents(td);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  range.detach();

  let right = box.left + padL;
  let top = Infinity;
  let bottom = -Infinity;
  for (const r of rects) {
    right = Math.max(right, r.right);
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  }
  const singleLine = rects.length === 0 || bottom - top <= parseFloat(cs.fontSize) * 1.8;
  const fits = singleLine && right + GAP + GLYPH <= contentRight;

  if (fits) {
    td.style.setProperty("--copy-x", `${right - box.left + GAP}px`);
    td.style.removeProperty("padding-right");
    td.dataset.copy = "fit";
  } else {
    td.style.removeProperty("--copy-x");
    td.style.paddingRight = `${padR + GAP + GLYPH}px`;
    td.dataset.copy = "clip";
  }
}

function activate(td: HTMLTableCellElement) {
  const ownTip = td.getAttribute("data-tip");
  active = { td, ownTip };
  place(td);
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
   because the value underneath may be a different length now; anywhere else →
   let go, and pick up whatever cell the pointer is genuinely over. */
function revalidate() {
  if (!active) return;
  const el = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null;
  if (el && active.td.contains(el)) {
    place(active.td);
    return;
  }
  const td = el ? cellOf(el) : null;
  deactivate();
  if (td) activate(td);
  refreshTip();
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
    function onMove(e: MouseEvent) {
      pointer = { x: e.clientX, y: e.clientY };
    }

    // Capture phase: runs before HoverTooltip's bubble listener, so the tip
    // text is on the cell by the time the tooltip resolves it.
    function onOver(e: MouseEvent) {
      pointer = { x: e.clientX, y: e.clientY };
      const td = cellOf(e.target);
      if (td === active?.td) return;
      deactivate();
      if (td) activate(td);
    }
    function onOut(e: MouseEvent) {
      if (!active) return;
      const related = e.relatedTarget as Node | null;
      if (related && active.td.contains(related)) return;
      deactivate();
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
      if (active?.td !== td) {
        deactivate();
        activate(td);
      }
      // Both tables carrying these cells open a detail view when their row is
      // clicked. A copy that also navigated away would be useless, so a marked
      // cell is a copy target only — the row's own click stops here.
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
    return () => {
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("mouseout", onOut, true);
      document.removeEventListener("click", onClick, true);
      deactivate();
      copied.forEach((t) => window.clearTimeout(t));
      copied.clear();
    };
  }, []);

  return null;
}
