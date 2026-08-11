import { useEffect, useState, type ReactNode } from "react";

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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  /** Receives the live transform state; the caller owns how it's applied. */
  children: (state: { rotation: number; zoom: number }) => ReactNode;
}) {
  const [rotation, setRotation] = useState(initialRotation);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="ncr-fs-overlay" onClick={onClose}>
      <button className="idfs-close" onClick={onClose} aria-label="Close">
        <CloseIcon />
      </button>

      <div className="ncr-fs-stage idfs-stage" onClick={stop}>
        {children({ rotation, zoom })}
      </div>

      <div className="idfs-toolbar" onClick={stop}>
        <button
          className="idfs-btn"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          aria-label="Rotate"
          title="Rotate"
        >
          <RotateIcon />
        </button>
        <div className="idfs-zoom">
          <button
            className="idfs-btn"
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            disabled={zoom <= ZOOM_MIN}
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
            value={zoom}
            onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
            aria-label="Zoom"
          />
          <button
            className="idfs-btn"
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            <ZoomInGlyph />
          </button>
        </div>
      </div>

      <div className="ncr-fs-hint">Press Esc or click outside to close</div>
    </div>
  );
}
