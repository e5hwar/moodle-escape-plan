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
  direction?: "down" | "up";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Extra class on the panel, for consumers that own its whole surface. */
  panelClass?: string;
  /**
   * Render the panel as a true overlay: portalled to the body and positioned
   * with `fixed`, so it neither grows the scroll container nor gets clipped by
   * it. It is kept inside the trigger's scrollport — flipping above the trigger
   * when there isn't room below — so it can't run over a page footer.
   */
  overlay?: boolean;
  /**
   * Overlay only: cap the panel's height to the space left in its scrollport so
   * it always fits on screen instead of forcing the page to grow or scroll.
   * The panel's own list is what scrolls.
   */
  constrainHeight?: boolean;
};

const GAP = 8;
const EDGE = 4;

/** Rect the overlay panel must stay inside.
 *
 *  Horizontally that is the trigger's nearest scrollable ancestor, clipped to
 *  the viewport, so a panel can't slide out past a scrolling column's edge.
 *  Vertically it is the whole viewport: the panel is portalled and `fixed`, so
 *  nothing actually clips it, and holding it inside the scrollport only forced
 *  a field near the bottom of a form to flip its menu upwards. Letting it run
 *  on means a menu opens downward and lies over the footer instead. */
function boundsFor(el: HTMLElement): DOMRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = 0;
  let right = vw;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
      const r = node.getBoundingClientRect();
      left = Math.max(0, r.left);
      right = Math.min(vw, r.right);
      break;
    }
    node = node.parentElement;
  }
  return new DOMRect(left, 0, right - left, vh);
}

export function Dropdown({
  trigger,
  children,
  width = 300,
  align = "left",
  direction = "down",
  open: controlledOpen,
  onOpenChange,
  panelClass,
  overlay = false,
  constrainHeight = false,
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

      // The taller side of the trigger is what a constrained panel may use, so
      // measure the natural height against that before deciding where to open.
      // The cap from the last pass has to come off first: the panel is a column
      // flex whose list scrolls, so a constrained panel measures as its own cap
      // and would otherwise ratchet itself shut.
      const capped = panel.style.maxHeight;
      if (constrainHeight) panel.style.maxHeight = "";
      const natural = panel.offsetHeight;
      if (constrainHeight) panel.style.maxHeight = capped;

      const roomBelow = b.bottom - t.bottom - GAP - EDGE;
      const roomAbove = t.top - b.top - GAP - EDGE;
      const h = constrainHeight
        ? Math.min(natural, Math.max(roomBelow, roomAbove))
        : natural;

      const below = t.bottom + GAP;
      const above = t.top - GAP - h;
      let top =
        direction === "up"
          ? above >= b.top
            ? above
            : below
          : below + h <= b.bottom || above < b.top
          ? below
          : above;
      top = Math.max(b.top + EDGE, Math.min(top, b.bottom - h - EDGE));

      let left = align === "right" ? t.right - w : t.left;
      left = Math.max(b.left + EDGE, Math.min(left, b.right - w - EDGE));

      const next = { top, left, maxHeight: constrainHeight ? h : undefined };
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
  }, [open, overlay, align, direction, constrainHeight]);

  const widthStyle = width === "auto" ? null : { width };

  const panel = (
    <div
      ref={panelRef}
      className={`dropdown ${direction === "up" && !overlay ? "up" : ""}${
        overlay ? " dropdown--overlay" : ""
      }${panelClass ? ` ${panelClass}` : ""}`}
      style={
        overlay
          ? {
              ...widthStyle,
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              ...(constrainHeight && pos?.maxHeight ? { maxHeight: pos.maxHeight } : null),
              // Hidden for the first paint, which is the pass that measures it.
              visibility: pos ? "visible" : "hidden",
            }
          : { ...widthStyle, [align === "right" ? "right" : "left"]: 0 }
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
