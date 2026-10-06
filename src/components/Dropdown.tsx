import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type TriggerArgs = { open: boolean; toggle: () => void };

type Props = {
  trigger: (args: TriggerArgs) => ReactNode;
  children: (args: { close: () => void }) => ReactNode;
  /** Fixed panel width, or "auto" to let the panel size to its content. */
  width?: number | "auto";
  align?: "left" | "right";
  /** Nudge the overlay panel horizontally from that alignment, in px. For a
   *  menu whose rows should line up with the trigger's TEXT rather than its
   *  box — the panel's own row inset is the offset (negative moves it left).
   *  Clamping to the scrollport still applies afterwards. */
  offsetX?: number;
  direction?: "down" | "up";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Extra class on the panel, for consumers that own its whole surface. */
  panelClass?: string;
  /**
   * Render the panel as a true overlay: portalled to the body and positioned
   * with `fixed`, so it neither grows the scroll container nor gets clipped by
   * it. Either way the panel is kept inside its page's bounds (`boundsFor`).
   */
  overlay?: boolean;
  /**
   * No longer needed: EVERY panel is now capped to the room inside its page's
   * bounds (its list scrolls). Kept so existing callers still compile.
   */
  constrainHeight?: boolean;
};

const GAP = 8;
const EDGE = 4;
/** Room below that's enough to open downward with a scrolling list rather
 *  than flip up: an in-place panel flipped up can land under the page header's
 *  stacked pieces (Edit Columns under the Users banner and search bar), so
 *  down wins whenever a few rows fit. */
const MIN_DOWN = 120;

/* The bars a panel must never cover: a table's pagination row, a wizard's
   footer, a save footer. */
const FOOTERS = ".pagination, .wizard-footer, .sp-save-footer";
/* A modal's full-screen layer. Its panels may use the whole viewport — a
   small form modal's menus and date pickers hang past the card on purpose —
   and only the modal's own bars (a picker's pagination) are off-limits, not
   the page's underneath it. */
const MODAL = ".pr-confirm-overlay, .pm-overlay, .pr-modal-overlay, .ncr-fs-overlay";

/** Rect every panel must stay inside (the user, 2026-10-04: Edit Columns and
 *  the filter panels ran over the side nav and the pagination footer).
 *
 *  On a page it is `.main` — the area right of the sidebar — clipped to the
 *  viewport and stopped at the top of any footer bar below the trigger, so a
 *  panel opens over the page's content and nowhere else. In a modal it is
 *  the viewport, stopped only at the modal's own footer bars. Horizontally it
 *  also stays inside the trigger's nearest scrolling column, so it can't
 *  slide out past that column's edge. */
function boundsFor(el: HTMLElement): DOMRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const modal = el.closest<HTMLElement>(MODAL);
  const layer = modal ?? el.closest<HTMLElement>(".main");
  const a = modal ? null : layer?.getBoundingClientRect();
  let left = Math.max(0, a?.left ?? 0);
  let right = Math.min(vw, a?.right ?? vw);
  const top = Math.max(0, a?.top ?? 0);
  let bottom = Math.min(vh, a?.bottom ?? vh);

  let node: HTMLElement | null = el.parentElement;
  while (node && node !== layer) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
      const r = node.getBoundingClientRect();
      left = Math.max(left, r.left);
      right = Math.min(right, r.right);
      break;
    }
    node = node.parentElement;
  }

  const t = el.getBoundingClientRect();
  layer?.querySelectorAll<HTMLElement>(FOOTERS).forEach((f) => {
    // A page's bars under an open modal belong to the page, not this layer.
    if (!modal && f.closest(MODAL)) return;
    const r = f.getBoundingClientRect();
    if (r.height > 0 && r.top >= t.bottom) bottom = Math.min(bottom, r.top);
  });
  return new DOMRect(left, top, right - left, bottom - top);
}

/** Whether a panel can be capped: it holds a list that scrolls. */
function shrinks(panel: HTMLElement): boolean {
  return [...panel.querySelectorAll<HTMLElement>("*")].some((n) => {
    const oy = getComputedStyle(n).overflowY;
    return oy === "auto" || oy === "scroll";
  });
}

/** Where a panel of natural height `natural` opens against trigger rect `t`:
 *  below while it fits there, or while there's MIN_DOWN of room to scroll in;
 *  above only when below is cramped and above has more (an `up` panel the
 *  reverse). Capped to the room on the side it takes — its list scrolls. */
function fit(t: DOMRect, b: DOMRect, natural: number, up: boolean, shrinks: boolean) {
  const roomBelow = b.bottom - t.bottom - GAP - EDGE;
  const roomAbove = t.top - b.top - GAP - EDGE;
  // A panel with nothing to scroll (a calendar) is never capped — it opens on
  // the side it fits, or the roomier one.
  if (!shrinks) {
    const goUp = up
      ? natural <= roomAbove || (natural > roomBelow && roomAbove > roomBelow)
      : natural > roomBelow && (natural <= roomAbove || roomAbove > roomBelow);
    return { goUp, h: natural };
  }
  const enough = (room: number) => room >= Math.min(natural, MIN_DOWN);
  const goUp = up
    ? enough(roomAbove) || roomAbove > roomBelow
    : !enough(roomBelow) && roomAbove > roomBelow;
  const h = Math.max(0, Math.min(natural, goUp ? roomAbove : roomBelow));
  return { goUp, h };
}

export function Dropdown({
  trigger,
  children,
  width = 300,
  align = "left",
  offsetX = 0,
  direction = "down",
  open: controlledOpen,
  onOpenChange,
  panelClass,
  overlay = false,
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight?: number } | null>(null);
  // In-place (non-overlay) panels: which side they open on, the height cap and
  // the sideways nudge that keeps them inside the page's bounds.
  const [fitted, setFitted] = useState<{ up: boolean; maxHeight?: number; shift: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      // The portalled panel lives outside the wrapper, so it needs its own hit
      // test or every click inside the panel would dismiss it.
      if (!wrapRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Place the overlay panel against the trigger, and keep it there while the
  // page scrolls or resizes.
  useLayoutEffect(() => {
    if (!open || !overlay) {
      setPos(null);
      return;
    }
    function place() {
      const trig = wrapRef.current;
      const panel = panelRef.current;
      if (!trig || !panel) return;
      const t = trig.getBoundingClientRect();
      const b = boundsFor(trig);
      const w = panel.offsetWidth;

      // Measure the natural height with the last pass's cap off: the panel is
      // a column flex whose list scrolls, so a capped panel measures as its
      // own cap and would otherwise ratchet itself shut.
      const capped = panel.style.maxHeight;
      panel.style.maxHeight = "";
      const natural = panel.offsetHeight;
      panel.style.maxHeight = capped;

      const { goUp, h } = fit(t, b, natural, direction === "up", shrinks(panel));
      let top = goUp ? t.top - GAP - h : t.bottom + GAP;
      top = Math.max(b.top + EDGE, Math.min(top, b.bottom - h - EDGE));

      let left = (align === "right" ? t.right - w : t.left) + offsetX;
      left = Math.max(b.left + EDGE, Math.min(left, b.right - w - EDGE));

      const next = { top, left, maxHeight: h < natural ? h : undefined };
      // Skipping no-op writes keeps the resize observer below from ping-ponging.
      setPos((prev) =>
        prev && prev.top === next.top && prev.left === next.left && prev.maxHeight === next.maxHeight
          ? prev
          : next,
      );
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    // A panel whose content changes size (a filtered list, say) has to be
    // re-anchored to its trigger, or an upward-opening one drifts away from it.
    const ro = new ResizeObserver(place);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, overlay, align, offsetX, direction]);

  // The same bounds for an in-place panel: it stays in the DOM beside its
  // trigger (absolute), so only its side, height cap and nudge are set here.
  useLayoutEffect(() => {
    if (!open || overlay) {
      setFitted(null);
      return;
    }
    function place() {
      const trig = wrapRef.current;
      const panel = panelRef.current;
      if (!trig || !panel) return;
      const t = trig.getBoundingClientRect();
      const b = boundsFor(trig);
      const capped = panel.style.maxHeight;
      panel.style.maxHeight = "";
      const natural = panel.offsetHeight;
      panel.style.maxHeight = capped;
      const { goUp, h } = fit(t, b, natural, direction === "up", shrinks(panel));

      // Its unshifted box, from the alignment the style applies.
      const w = panel.offsetWidth;
      const left = align === "right" ? t.right - w : t.left;
      const shift =
        left < b.left + EDGE
          ? b.left + EDGE - left
          : left + w > b.right - EDGE
          ? Math.max(b.left + EDGE - left, b.right - EDGE - w - left)
          : 0;

      const next = { up: goUp, maxHeight: h < natural ? h : undefined, shift: Math.round(shift) };
      setFitted((prev) =>
        prev && prev.up === next.up && prev.maxHeight === next.maxHeight && prev.shift === next.shift
          ? prev
          : next,
      );
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const ro = new ResizeObserver(place);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, overlay, align, direction]);

  const widthStyle = width === "auto" ? null : { width };

  const panel = (
    <div
      ref={panelRef}
      className={`dropdown ${!overlay && (fitted ? fitted.up : direction === "up") ? "up" : ""}${
        overlay ? " dropdown--overlay" : ""
      }${panelClass ? ` ${panelClass}` : ""}`}
      style={
        overlay
          ? {
              ...widthStyle,
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              ...(pos?.maxHeight ? { maxHeight: pos.maxHeight } : null),
              // Hidden for the first paint, which is the pass that measures it.
              visibility: pos ? "visible" : "hidden",
            }
          : {
              ...widthStyle,
              [align === "right" ? "right" : "left"]: align === "right" ? -(fitted?.shift ?? 0) : fitted?.shift ?? 0,
              ...(fitted?.maxHeight !== undefined ? { maxHeight: fitted.maxHeight } : null),
            }
      }
    >
      {children({ close: () => setOpen(false) })}
    </div>
  );

  return (
    <div className="dropdown-wrap" ref={wrapRef}>
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (overlay ? createPortal(panel, document.body) : panel)}
    </div>
  );
}
