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
};

const GAP = 8;
const EDGE = 4;

/** Rect the overlay panel must stay inside: the trigger's nearest scrollable
 *  ancestor, clipped to the viewport. Falls back to the viewport. */
function boundsFor(el: HTMLElement): DOMRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
      const r = node.getBoundingClientRect();
      return new DOMRect(
        Math.max(0, r.left),
        Math.max(0, r.top),
        Math.min(vw, r.right) - Math.max(0, r.left),
        Math.min(vh, r.bottom) - Math.max(0, r.top),
      );
    }
    node = node.parentElement;
  }
  return new DOMRect(0, 0, vw, vh);
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

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
      const h = panel.offsetHeight;
      const w = panel.offsetWidth;

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

      setPos({ top, left });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, overlay, align, direction]);

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
