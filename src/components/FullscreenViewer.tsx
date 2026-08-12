import { useEffect, useRef, useState, type ReactNode } from "react";
import { ShortcutHint } from "./ShortcutHint";

/* ── Fullscreen viewer shell ──────────────────────────────────────────────
   The chrome behind both fullscreen views in the Proctoring console — the ID
   card and the webcam frames. No title bar (the content speaks for itself), a
   bare close button top-right, and a bottom toolbar carrying Rotate plus a zoom
   slider. Callers render the content and decide how to apply `rotation`/`zoom`,
   since the ID card also has to fit itself to the stage first.

   It reuses `.ncr-fs-overlay/-stage/-hint` for the shell but NOT the
   `.ncr-fs-bar/-title/-close` set — those belong to the older titled layout. ── */

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
/** Step for the − / + buttons; the slider itself is continuous. */
const ZOOM_STEP = 0.25;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

const RotateIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const CloseIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const ZoomOutGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 7h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const ZoomInGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2.5 7h9M7 2.5v9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export function FullscreenViewer({
  initialRotation = 0,
  onClose,
  children,
}: {
  initialRotation?: number;
  onClose: () => void;
  /** Receives the live rotation. Zoom and pan are applied by the viewer itself,
   *  on a wrapper around whatever this returns — the caller only has to place
   *  its own content (the ID card additionally fits itself to the stage). */
  children: (state: { rotation: number }) => ReactNode;
}) {
  const [rotation, setRotation] = useState(initialRotation);
  /* One object, not three states: a wheel-zoom has to move the pan in the same
     commit that changes the zoom (it zooms toward the pointer), and splitting
     them would mean calling one setter inside another's updater. */
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /** Active drag: pointer origin + the pan it started from. */
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  /** Distinguishes a click (closes) from the end of a drag (must not). */
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const rotate = () => setRotation((r) => (r + 90) % 360);

  /* The overlay owns the keyboard while it's open — the console's own handler
     early-returns for as long as it is — so R is free here for Rotate. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "r" || e.key === "R") rotate();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /** Re-anchors the pan so the point under (cx, cy) — measured from the stage
   *  centre — stays put as the zoom changes. cx/cy of 0 zooms about the centre,
   *  which is what the buttons and the slider want. */
  function zoomTo(next: number, cx = 0, cy = 0) {
    setView((v) => {
      const z = clampZoom(next);
      const k = z / v.zoom;
      return { zoom: z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }

  /* Ctrl/⌘ + wheel zooms toward the pointer and a plain wheel pans, the way
     Figma behaves — a trackpad pinch arrives as a ctrlKey wheel event, so the
     same branch covers the gesture. The listener has to be registered manually
     with `passive: false`: React's onWheel is passive, so preventDefault there
     is ignored and the browser zooms the whole page instead. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const cx = e.clientX - r.left - r.width / 2;
        const cy = e.clientY - r.top - r.height / 2;
        setView((v) => {
          // Exponential so each notch is a constant ratio, not a constant step.
          const z = clampZoom(v.zoom * Math.exp(-e.deltaY / 300));
          const k = z / v.zoom;
          return { zoom: z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: view.x, py: view.y };
    movedRef.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    // A few pixels of slop so a click with a shaky hand still counts as a click.
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    setView((v) => ({ ...v, x: d.px + dx, y: d.py + dy }));
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }

  /* The stage covers the whole overlay (the zoomed content is deliberately not
     boxed in), so it — not a backdrop behind it — has to decide what "click
     outside" means, and it can't just ask whether the carrier contains the
     target: the carrier is stage-sized, so that answer is always yes. What
     counts as empty space is a click that landed on the stage or the carrier
     ITSELF rather than on anything rendered inside them. A drag never closes. */
  function onStageClick(e: React.MouseEvent) {
    if (movedRef.current) return;
    if (e.target !== stageRef.current && e.target !== contentRef.current) return;
    onClose();
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="ncr-fs-overlay idfs-overlay">
      <button className="idfs-close" onClick={onClose} aria-label="Close">
        <CloseIcon />
      </button>

      <div
        ref={stageRef}
        className={`idfs-stage ${dragging ? "is-dragging" : ""}`}
        onClick={onStageClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          ref={contentRef}
          className="idfs-content"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
        >
          {children({ rotation })}
        </div>
      </div>

      <div className="idfs-toolbar" onClick={stop}>
        {/* The shared shortcut hint rather than a native title: it names the key
            as well as the action, and it flips above the control — a tooltip
            under a button this close to the bottom edge was being cropped. */}
        <ShortcutHint label="Rotate" keyLabel="R">
          <button className="idfs-btn" onClick={rotate} aria-label="Rotate">
            <RotateIcon />
          </button>
        </ShortcutHint>
        <div className="idfs-zoom">
          <button
            className="idfs-btn"
            onClick={() => zoomTo(view.zoom - ZOOM_STEP)}
            disabled={view.zoom <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            <ZoomOutGlyph />
          </button>
          <input
            className="idfs-slider"
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={view.zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            aria-label="Zoom"
          />
          <button
            className="idfs-btn"
            onClick={() => zoomTo(view.zoom + ZOOM_STEP)}
            disabled={view.zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            <ZoomInGlyph />
          </button>
        </div>
      </div>

      <div className="ncr-fs-hint idfs-hint">
        Ctrl + Scroll to Zoom · Drag to Move · Esc or Click Outside to Close
      </div>
    </div>
  );
}
