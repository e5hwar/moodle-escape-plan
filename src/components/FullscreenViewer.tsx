import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ShortcutHint } from "./ShortcutHint";
import { ModalCloseIcon } from "./PrmModal";

/* ── Fullscreen viewer shell ──────────────────────────────────────────────
   The chrome behind every fullscreen view in the app — the Proctoring console's
   ID card and webcam frames, and the Spotlight card. No title bar (the content
   speaks for itself), a bare close button top-right, and a bottom toolbar
   carrying Rotate plus a zoom slider. Callers render the content and decide how
   to apply `rotation`/`zoom`, since the ID card also has to fit itself to the
   stage first.

   `controls={false}` drops the whole zoom/rotate/pan apparatus — toolbar, R key,
   wheel-zoom and drag — leaving the plain lightbox the Spotlight preview wants:
   its card is already sized to the stage, and it carries a live button that a
   drag gesture would only get in the way of.

   It reuses `.ncr-fs-overlay/-stage/-hint` for the shell but NOT the
   `.ncr-fs-bar/-title/-close` set — those belong to the older titled layout.

   ── Motion ──
   The view (zoom + pan) lives in two places: a TARGET the gestures write to and
   a CURRENT that is what's actually painted. A requestAnimationFrame loop eases
   current toward target every frame and writes the transform straight to the
   DOM, so a wheel notch, a +/− press or a double-click glides to its new zoom
   instead of stepping there, and a burst of wheel events piles up into one
   smooth ramp rather than a stutter. Direct-manipulation gestures — a drag, the
   slider — bypass the easing: the content has to sit under the pointer exactly.
   React state is only refreshed for the toolbar (slider thumb, button
   enablement), never per-frame for the content. ── */

const ZOOM_MAX = 3;
/** Ratio for the − / + buttons; multiplicative so each press feels the same
 *  size whether the view is near the fit or near the max. */
const ZOOM_STEP = 1.25;
/** Double-click toggles between the fit and this multiple of it. */
const DBLCLICK_ZOOM = 2;

/* The floor is not a constant: it's whatever scale makes the content fill the
   stage on its tighter axis, so "fully zoomed out" always means "the whole
   thing, as large as it will go" rather than an arbitrary 0.5×. */
const clampZoom = (z: number, min: number) => Math.min(ZOOM_MAX, Math.max(min, z));

/* How much of the stage the opening view leaves free, so the image doesn't
   start underneath the chrome that floats over it: 64px top and bottom clears
   the close button (12 + its 40px box) and the toolbar (18 + 32), 24px at the
   sides. Applied symmetrically because the content is centred.

   This sizes the DEFAULT zoom only. It is not padding — the stage is
   full-bleed, so zooming in fills the window edge to edge and the controls sit
   over the image, which is the point of them being an overlay. */
const FIT_INSET_X = 24;
const FIT_INSET_Y = 64;

/* Easing time constants, in ms. The loop moves current toward target by
   `1 - exp(-dt / tau)` each frame — a critically-damped approach with no
   overshoot, which is how Maps-style viewers get a zoom that starts briskly and
   settles softly. Wheel is quick because the pointer is still driving; the
   buttons and double-click are a discrete, slightly longer glide. */
const TAU_WHEEL = 70;
const TAU_GLIDE = 110;
/** Below these the loop snaps to the target and stops. */
const EPS_ZOOM = 0.0005;
const EPS_PAN = 0.05;

/** How long the shell takes to leave — must match `.idfs-overlay--closing`. */
const CLOSE_MS = 160;

type View = { zoom: number; x: number; y: number };

/* The three toolbar glyphs, transcribed from the design's own assets (Figma
   1018:1598 rotate, 1021:1637 minus, 1021:1634 plus). All 16px on a 16 grid at
   a 1.33333 SQUARE-capped stroke — deliberately not the project's round-capped
   set, which is what these used to be drawn with. */
const RotateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M14.112 10.6667C13.593 11.8558 12.7383 12.8677 11.6526 13.5783C10.5669 14.2888 9.2975 14.667 8 14.6667C4.318 14.6667 1.33333 11.682 1.33333 8C1.33333 4.318 4.318 1.33333 8 1.33333C11.682 1.33333 14.6667 4.318 14.6667 8L13.3333 7"
      stroke="currentColor"
      strokeWidth="1.33333"
      strokeLinecap="square"
    />
  </svg>
);

const ZoomOutGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M12.6667 8H3.33333" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square" />
  </svg>
);

const ZoomInGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 3.33333V12.6667M12.6667 8H3.33333"
      stroke="currentColor"
      strokeWidth="1.33333"
      strokeLinecap="square"
    />
  </svg>
);

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function FullscreenViewer({
  initialRotation = 0,
  controls = true,
  hint,
  onClose,
  children,
}: {
  initialRotation?: number;
  /** Zoom, rotate and pan. Off leaves a plain lightbox — see the note above. */
  controls?: boolean;
  /** Replaces the default hint line, for a viewer whose gestures differ. */
  hint?: ReactNode;
  onClose: () => void;
  /** Receives the live rotation and the stage's own (untransformed) size, so a
   *  caller can fit its content to the stage. Zoom and pan are applied by the
   *  viewer itself, on a wrapper around whatever this returns. */
  children: (state: { rotation: number; stage: { w: number; h: number } }) => ReactNode;
}) {
  /* Unbounded rather than mod 360: a CSS transition from 270 back to 0 would
     spin the content the long way round. Callers apply it as `rotate(Ndeg)`,
     which is happy with 450, and reduce it themselves where they need to. */
  const [rotation, setRotation] = useState(initialRotation);
  const stageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  /** The content's size at zoom 1 — the basis for how far it may be panned. */
  const baseRef = useRef({ w: 0, h: 0 });

  /* Motion state — see the header. `current` is the painted view, `target` is
     where it's heading. Neither is React state: the loop writes the transform
     to the DOM directly and only mirrors the zoom into `uiZoom` for the
     toolbar, which is the one thing that has to re-render as it moves. */
  const currentRef = useRef<View>({ zoom: 1, x: 0, y: 0 });
  const targetRef = useRef<View>({ zoom: 1, x: 0, y: 0 });
  const tauRef = useRef(TAU_GLIDE);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const [uiZoom, setUiZoom] = useState(1);

  /* The zoom at which the content exactly fills the stage on its tighter axis.
     It is both the slider's floor and the zoom the viewer opens at. A ref
     shadows the state so gesture handlers registered once can read the live
     value without re-subscribing. */
  const [fitZoom, setFitZoom] = useState(1);
  const fitRef = useRef(1);
  /** The opening fit is applied once; after that the zoom is the reviewer's. */
  const fittedRef = useRef(false);
  /** Active drag: pointer origin + the pan it started from. */
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  /** Distinguishes a click (closes) from the end of a drag (must not). */
  const movedRef = useRef(false);
  /** Whether the last pointerdown landed on empty stage rather than on the
   *  content. Recorded at pointerdown because the click that follows is
   *  retargeted: once the stage has captured the pointer, Chrome dispatches
   *  the click at the stage itself whatever was under the pointer, so the
   *  click's own target can't tell the card from the space around it. */
  const downOnEmptyRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  /** The stage's own layout size — what a caller fits its content to. Read off
   *  offsetWidth/Height, so the content's zoom transform never feeds back in. */
  const [stageBox, setStageBox] = useState({ w: 0, h: 0 });
  /** The exit animation is running; `onClose` fires when it ends. */
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  const rotate = () => setRotation((r) => r + 90);

  /* ── Painting ── */

  const paint = useCallback((v: View) => {
    const el = contentRef.current;
    if (el) el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.zoom})`;
  }, []);

  /** Keeps the content anchored to the stage: it can be dragged until an edge
   *  meets the matching stage edge and no further, whichever of the two is the
   *  larger. Without this a zoomed-in card could be flung off screen entirely. */
  const clampPan = useCallback((x: number, y: number, zoom: number) => {
    const stage = stageRef.current;
    const base = baseRef.current;
    if (!stage || !base.w || !base.h) return { x, y };
    const limitX = Math.abs(base.w * zoom - stage.clientWidth) / 2;
    const limitY = Math.abs(base.h * zoom - stage.clientHeight) / 2;
    return {
      x: Math.min(limitX, Math.max(-limitX, x)),
      y: Math.min(limitY, Math.max(-limitY, y)),
    };
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = 0;
  }, []);

  /** Puts the view somewhere immediately — no easing. Used by the gestures
   *  that are tracking the pointer, and to settle the loop. */
  const jumpTo = useCallback(
    (v: View) => {
      stopLoop();
      currentRef.current = v;
      targetRef.current = v;
      paint(v);
      setUiZoom(v.zoom);
    },
    [paint, stopLoop],
  );

  const tick = useCallback(
    (ts: number) => {
      rafRef.current = null;
      const cur = currentRef.current;
      const tgt = targetRef.current;
      /* A first frame after idle has no previous timestamp — treat it as one
         nominal frame rather than a huge dt that would snap straight to target. */
      const dt = lastTsRef.current ? Math.min(64, ts - lastTsRef.current) : 16;
      lastTsRef.current = ts;
      const a = 1 - Math.exp(-dt / tauRef.current);
      let next: View = {
        zoom: cur.zoom + (tgt.zoom - cur.zoom) * a,
        x: cur.x + (tgt.x - cur.x) * a,
        y: cur.y + (tgt.y - cur.y) * a,
      };
      const done =
        Math.abs(tgt.zoom - next.zoom) < EPS_ZOOM &&
        Math.abs(tgt.x - next.x) < EPS_PAN &&
        Math.abs(tgt.y - next.y) < EPS_PAN;
      if (done) next = tgt;
      /* The pan limit shrinks as the zoom comes down, so an in-flight frame can
         momentarily sit outside it — clamp what's painted, not just the target. */
      next = { zoom: next.zoom, ...clampPan(next.x, next.y, next.zoom) };
      currentRef.current = next;
      paint(next);
      setUiZoom(next.zoom);
      if (done) lastTsRef.current = 0;
      else rafRef.current = requestAnimationFrame(tick);
    },
    [clampPan, paint],
  );

  /** Eases the view toward `v`. With reduced motion on, it just goes there. */
  const glideTo = useCallback(
    (v: View, tau: number) => {
      if (prefersReducedMotion()) return jumpTo(v);
      targetRef.current = v;
      tauRef.current = tau;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
    },
    [jumpTo, tick],
  );

  useEffect(() => stopLoop, [stopLoop]);

  /** Re-anchors the pan so the point under (cx, cy) — measured from the stage
   *  centre — stays put as the zoom changes. cx/cy of 0 zooms about the centre,
   *  which is what the buttons and the slider want. Computed against the
   *  TARGET, so successive wheel notches compound onto where the view is going,
   *  not where it happens to be mid-glide.
   *
   *  Zooming OUT also steers the content home: the pan is scaled by how far
   *  the zoom still is from the fit, so it reaches dead centre exactly as the
   *  zoom reaches the fit, and a view left in a corner drifts back as it
   *  shrinks rather than arriving at the fit lopsided. The factor multiplies
   *  across steps to (final − fit) / (start − fit) whatever the path, so a
   *  burst of wheel notches and one button press land in the same place. */
  const zoomTo = useCallback(
    (next: number, cx = 0, cy = 0, mode: "glide" | "wheel" | "jump" = "glide") => {
      const from = targetRef.current;
      const fit = fitRef.current;
      const z = clampZoom(next, fit);
      const k = z / from.zoom;
      let x = cx - (cx - from.x) * k;
      let y = cy - (cy - from.y) * k;
      if (z < from.zoom) {
        const span = from.zoom - fit;
        const home = span > 1e-6 ? Math.min(1, Math.max(0, (z - fit) / span)) : 0;
        x *= home;
        y *= home;
      }
      const v: View = { zoom: z, ...clampPan(x, y, z) };
      if (mode === "jump") jumpTo(v);
      else glideTo(v, mode === "wheel" ? TAU_WHEEL : TAU_GLIDE);
    },
    [clampPan, glideTo, jumpTo],
  );

  /* ── Measurement ── */

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageBox({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* The carrier is stage-sized, so the thing actually on screen is the caller's
     own root inside it — that is what the pan has to keep in view. Its rect
     comes back scaled by everything applied above it, so dividing that back out
     leaves a zoom-independent base size. */
  useLayoutEffect(() => {
    const carrier = contentRef.current;
    const el = carrier?.firstElementChild as HTMLElement | null;
    if (!carrier || !el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      /* The scale actually in effect is not just our zoom: on the opening frame
         the entrance animation still has the carrier at 94%, and dividing by
         the zoom alone made the base ~6% small and the fit ~6% large — the
         card opened bigger than it should. The carrier is never rotated, so
         its painted width over its layout width IS the total scale. */
      const cw = carrier.getBoundingClientRect().width;
      const eff = carrier.offsetWidth && cw ? cw / carrier.offsetWidth : currentRef.current.zoom;
      const base = { w: r.width / eff, h: r.height / eff };
      baseRef.current = base;
      if (!controls) return; // a plain lightbox sizes its own content

      const stage = stageRef.current;
      if (!stage) return;
      /* Whichever axis runs out first — that's what "fully zoomed out" means.
         Rounded because `base` is derived from a rect that was itself scaled by
         the current zoom: without it the floor drifts in the last decimal on
         every zoom, which is enough to leave the − button live at the floor and
         let the reviewer nudge below the fit. */
      const availW = Math.max(1, stage.clientWidth - FIT_INSET_X * 2);
      const availH = Math.max(1, stage.clientHeight - FIT_INSET_Y * 2);
      const raw = Math.min(availW / base.w, availH / base.h);
      if (!Number.isFinite(raw) || raw <= 0) return;
      const fit = Math.round(raw * 1000) / 1000;
      fitRef.current = fit;
      setFitZoom(fit);
      if (!fittedRef.current) {
        fittedRef.current = true;
        jumpTo({ zoom: fit, x: 0, y: 0 });
      } else if (targetRef.current.zoom < fit) {
        /* The stage grew tighter (rotation, resize) and the view is now under
           the new floor — bring it up rather than leave the slider stranded. */
        zoomTo(fit);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rotation, controls, jumpTo, zoomTo]);

  /* A narrower window shrinks the stage, which can leave an existing pan past
     the new limit — pull it back in. */
  useEffect(() => {
    const onResize = () => {
      const t = targetRef.current;
      glideTo({ zoom: t.zoom, ...clampPan(t.x, t.y, t.zoom) }, TAU_GLIDE);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampPan, glideTo]);

  /* ── Leaving ── */

  /* Every way out — Escape, the ×, a click on empty stage — runs the exit
     animation first and hands over to `onClose` when it ends. A second request
     while it's already running is ignored rather than closing twice. */
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

  /* The overlay owns the keyboard while it's open — the console's own handler
     early-returns for as long as it is — so R is free here for Rotate. */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
      else if (controls && (e.key === "r" || e.key === "R")) rotate();
      else if (controls && (e.key === "+" || e.key === "=")) zoomTo(targetRef.current.zoom * ZOOM_STEP);
      else if (controls && (e.key === "-" || e.key === "_")) zoomTo(targetRef.current.zoom / ZOOM_STEP);
      else if (controls && e.key === "0") zoomTo(fitRef.current);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [requestClose, controls, zoomTo]);

  /* ── Gestures ── */

  /* Ctrl/⌘ + wheel zooms toward the pointer and a plain wheel pans, the way
     Figma behaves — a trackpad pinch arrives as a ctrlKey wheel event, so the
     same branch covers the gesture. The listener has to be registered manually
     with `passive: false`: React's onWheel is passive, so preventDefault there
     is ignored and the browser zooms the whole page instead.

     Both paths go through the smoother: a mouse wheel delivers its ±100 in one
     event, and painting that as a single 1.3× step is exactly the jolt this
     viewer used to have. A pinch delivers many small deltas per frame; those
     ride the same short time constant and stay glued to the fingers. */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !controls) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      /* Line/page-mode wheels (Firefox with a mouse) report tiny deltas in
         other units; normalise so a notch means the same everywhere. */
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1;
      const dy = e.deltaY * unit;
      const dx = e.deltaX * unit;
      if (e.ctrlKey || e.metaKey) {
        const cx = e.clientX - r.left - r.width / 2;
        const cy = e.clientY - r.top - r.height / 2;
        // Exponential so each notch is a constant ratio, not a constant step.
        zoomTo(targetRef.current.zoom * Math.exp(-dy / 320), cx, cy, "wheel");
      } else {
        const t = targetRef.current;
        glideTo({ zoom: t.zoom, ...clampPan(t.x - dx, t.y - dy, t.zoom) }, TAU_WHEEL);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [controls, clampPan, glideTo, zoomTo]);

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || !controls) return;
    /* Never start a drag on something the content wants clicked — capturing the
       pointer would retarget the click off the button and swallow it. */
    downOnEmptyRef.current = false;
    if ((e.target as HTMLElement).closest("a, button, input, select, textarea")) return;
    downOnEmptyRef.current = e.target === stageRef.current || e.target === contentRef.current;
    /* Grabbing mid-glide takes over from wherever the content IS, not where it
       was heading — the hand wins over the animation. */
    const cur = currentRef.current;
    jumpTo(cur);
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: cur.x, py: cur.y };
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
    const z = currentRef.current.zoom;
    jumpTo({ zoom: z, ...clampPan(d.px + dx, d.py + dy, z) });
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
     counts as empty space is a press that landed on the stage or the carrier
     ITSELF rather than on anything rendered inside them — judged at pointerdown,
     see `downOnEmptyRef`. A drag never closes. */
  function onStageClick(e: React.MouseEvent) {
    if (movedRef.current) return;
    const onEmpty = controls
      ? downOnEmptyRef.current
      : e.target === stageRef.current || e.target === contentRef.current;
    if (!onEmpty) return;
    requestClose();
  }

  /* Double-click on the content toggles between the fit and a 2× look at the
     spot under the pointer — the gesture every photo viewer teaches. On empty
     stage it does nothing (the first click of the pair already closed). */
  function onStageDoubleClick(e: React.MouseEvent) {
    if (!controls || movedRef.current || downOnEmptyRef.current) return;
    if ((e.target as HTMLElement).closest("a, button, input, select, textarea")) return;
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const cx = e.clientX - r.left - r.width / 2;
    const cy = e.clientY - r.top - r.height / 2;
    const fit = fitRef.current;
    const zoomedIn = targetRef.current.zoom > fit * 1.05;
    if (zoomedIn) glideTo({ zoom: fit, x: 0, y: 0 }, TAU_GLIDE);
    else zoomTo(Math.min(ZOOM_MAX, fit * DBLCLICK_ZOOM), cx, cy);
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const pannable = controls && uiZoom > fitZoom + 0.001;
  const stageClass = [
    "idfs-stage",
    dragging ? "is-dragging" : "",
    pannable ? "is-pannable" : "",
    controls ? "" : "idfs-stage--static",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`ncr-fs-overlay idfs-overlay ${closing ? "idfs-overlay--closing" : ""}`}>
      <button className="idfs-close" onClick={requestClose} aria-label="Close">
        <ModalCloseIcon />
      </button>

      <div
        ref={stageRef}
        className={stageClass}
        onClick={onStageClick}
        onDoubleClick={onStageDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* The transform is written imperatively by `paint`; the initial value
            here just matches what the first frame will be. */}
        <div ref={contentRef} className="idfs-content" style={{ transform: "translate3d(0, 0, 0) scale(1)" }}>
          {children({ rotation, stage: stageBox })}
        </div>
      </div>

      {controls && (
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
            onClick={() => zoomTo(targetRef.current.zoom / ZOOM_STEP)}
            disabled={uiZoom <= fitZoom + 0.001}
            aria-label="Zoom out"
          >
            <ZoomOutGlyph />
          </button>
          {/* The slider is a direct control, so it jumps rather than glides:
              the thumb has to stay under the pointer as it's dragged. */}
          <input
            className="idfs-slider"
            type="range"
            min={fitZoom}
            max={ZOOM_MAX}
            step={0.01}
            value={Math.min(ZOOM_MAX, Math.max(fitZoom, uiZoom))}
            onChange={(e) => zoomTo(Number(e.target.value), 0, 0, "jump")}
            aria-label="Zoom"
          />
          <button
            className="idfs-btn"
            onClick={() => zoomTo(targetRef.current.zoom * ZOOM_STEP)}
            disabled={uiZoom >= ZOOM_MAX - 0.001}
            aria-label="Zoom in"
          >
            <ZoomInGlyph />
          </button>
        </div>
      </div>
      )}

      {/* No default line any more: the zoom viewers' controls speak for
          themselves. Only a caller that has something to say gets one — the
          Spotlight lightbox, whose gestures aren't otherwise visible. */}
      {hint && <div className="ncr-fs-hint idfs-hint">{hint}</div>}
    </div>
  );
}

