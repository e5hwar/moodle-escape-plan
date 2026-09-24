import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ModalCloseIcon } from "./PrmModal";

/** How long the drawer takes to leave — must match `.drawer-overlay--closing`. */
const CLOSE_MS = 160;

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** The side drawer (Figma 1316:1846 "Dialog"): a full-height panel that slides
 *  over the dimmed page from the right edge. Its head is the dialog's own — a
 *  28px title over a 16px description, the shared close glyph opposite — and
 *  whatever it is given stacks 28px beneath. The glyph, a click on the dimmed
 *  page and Escape all close it.
 *
 *  `role="dialog"` sits on the panel, not the fixed overlay: App.tsx finds the
 *  open modal for ⌘K by `offsetParent`, which is null on a fixed element. */
export function Drawer({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** The exit slide is running; `onClose` fires when it ends. */
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  /* Every way out runs the exit slide first and hands over to `onClose` when
     it ends. A second request while it's running is ignored. */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  // Take focus on open, so the keyboard lands in the drawer rather than on the
  // page behind it, and hand it back to whatever held it on close.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => prev?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div
      className={`drawer-overlay${closing ? " drawer-overlay--closing" : ""}`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="prm-headgroup">
          <div className="prm-head">
            <h2 className="prm-title">{title}</h2>
            <button className="prm-close" onClick={requestClose} aria-label="Close">
              <ModalCloseIcon />
            </button>
          </div>
          {description && <p className="prm-text">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
