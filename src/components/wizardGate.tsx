import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";

/* ─────────────────  Edge Line Gate (Wizard 6)  ─────────────────
 * Wheel-past-the-edge step navigation. Scrolling beyond the top/bottom of a
 * step "charges" a gate: an orange edge line scales out from the centre, a
 * caption names the adjacent step, the pane nudges in the scroll direction,
 * and the matching footer button fills left-to-right. At full charge the
 * wizard changes step; releasing the wheel lets the charge decay.
 *
 * Every multi-step wizard shares this one — don't re-declare a local copy.
 * Wiring a wizard up takes four pieces (see NewTaskWizard for the reference):
 *
 *   const gate = useEdgeLineGate({ step, setStep, lastStep });
 *   <div className="wizard-main">
 *     <WizardGateEdges gate={gate} step={step} lastStep={lastStep}
 *                      labels={STEPS.map((s) => s.label)} />
 *     <div className="wizard-content" ref={gate.scrollRef}>
 *       <div className="wizard-paneout" ref={gate.paneOutRef}>
 *         <div className="wizard-pane" key={step}>…</div>
 *   …and in the footer, `.wizard-gate-btn` Back/Next buttons each holding a
 *   `<span className="wizard-gate-fill" ref={gate.backFillRef} />`.
 *
 * Step changes driven by the footer buttons or the left rail should go through
 * `gate.goStep` rather than `setStep`, so an in-flight charge is cleared and
 * the new step lands its scroll position. */

/** Wheel distance (px) that fully charges a step change. Raised 420 → 630
 * (1.5×) on 2026-08-28 — 420 tripped on a single trackpad flick, which made
 * step changes feel accidental. Raised again 630 → 960 → 1060 on 2026-09-01. */
export const GATE_DISTANCE = 1060;
/** Wheel events are swallowed for this long after a gated step change, so
 * scroll momentum doesn't immediately scroll (or re-gate) the new step. */
export const GATE_COOLDOWN_MS = 750;
/** How long the wheel must be still before the charge starts bleeding off. */
const GATE_DECAY_IDLE_MS = 420;
/** Charge drained per animation frame once decay starts (~0.33s from full). */
const GATE_DECAY_PER_FRAME = 0.05;
/** A pause in wheel events longer than this starts a new gesture. The gate
 * only charges for gestures that BEGAN with the pane already at the edge — a
 * long mid-page scroll snaps to the edge and stops there; stepping requires a
 * fresh gesture from the edge. */
const GATE_GESTURE_GAP_MS = 300;
/** A wheel delta this many times the previous one (and above the floor below)
 * also starts a new gesture. Trackpad momentum only ever decays, and its tail
 * can trickle events for over a second with sub-300ms gaps — without this, a
 * deliberate new flick during the tail would still count as the old (unarmed)
 * gesture and be swallowed at the edge. */
const GATE_SPIKE_RATIO = 3;
const GATE_SPIKE_MIN_PX = 24;

const pad2 = (n: number) => String(n).padStart(2, "0");

export type GateLand = "top" | "bottom";

type GateState = {
  charge: number;
  /** 1 = charging towards the next step, -1 = towards the previous, 0 = idle. */
  dir: 1 | -1 | 0;
  lastWheel: number;
  coolUntil: number;
  raf: number;
  /** Where the next rendered step should land its scroll position. Gating
   * backwards lands at the bottom — you re-enter the previous page where you
   * left it, at its end. */
  land: GateLand;
  /** Timestamp of the last wheel event of any kind, used to segment gestures. */
  lastAny: number;
  /** |deltaY| of the last wheel event, for momentum-tail spike detection. */
  lastMag: number;
  /** Whether the current gesture began with the pane at the top / bottom. */
  armedTop: boolean;
  armedBottom: boolean;
};

/** Derived from the hook so the ref types track whichever React typings the
 * app is on (React 18's `RefObject<T>` vs 19's `RefObject<T | null>`). */
export type EdgeLineGate = ReturnType<typeof useEdgeLineGate>;

export function useEdgeLineGate({
  step,
  setStep,
  lastStep,
  /** Set false to leave the wheel alone (e.g. a wizard in a one-page mode). */
  enabled = true,
  /** False while the current step may not be left going forwards — mirror
   * whatever disables the footer's Next button, so the wheel can't walk past a
   * guard the button enforces. Backwards is always allowed. */
  canGoNext = true,
}: {
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  lastStep: number;
  enabled?: boolean;
  canGoNext?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const paneOutRef = useRef<HTMLDivElement>(null);
  const prevLineRef = useRef<HTMLSpanElement>(null);
  const prevCapRef = useRef<HTMLSpanElement>(null);
  const nextLineRef = useRef<HTMLSpanElement>(null);
  const nextCapRef = useRef<HTMLSpanElement>(null);
  const backFillRef = useRef<HTMLSpanElement>(null);
  const nextFillRef = useRef<HTMLSpanElement>(null);
  const gate = useRef<GateState>({
    charge: 0,
    dir: 0,
    lastWheel: 0,
    coolUntil: 0,
    raf: 0,
    land: "top",
    lastAny: 0,
    lastMag: 0,
    armedTop: false,
    armedBottom: false,
  });

  // Charge is painted straight onto the DOM every wheel tick — routing it
  // through state would re-render the whole step per tick.
  const paintCharge = useCallback(() => {
    const g = gate.current;
    const f = g.dir === 1 ? g.charge : 0;
    const b = g.dir === -1 ? g.charge : 0;
    if (nextLineRef.current) nextLineRef.current.style.transform = `scaleX(${f.toFixed(3)})`;
    if (nextCapRef.current) nextCapRef.current.style.opacity = Math.min(1, f * 1.8).toFixed(3);
    if (prevLineRef.current) prevLineRef.current.style.transform = `scaleX(${b.toFixed(3)})`;
    if (prevCapRef.current) prevCapRef.current.style.opacity = Math.min(1, b * 1.8).toFixed(3);
    if (nextFillRef.current) nextFillRef.current.style.width = `${(f * 100).toFixed(1)}%`;
    if (backFillRef.current) backFillRef.current.style.width = `${(b * 100).toFixed(1)}%`;
    const pane = paneOutRef.current;
    if (pane) {
      pane.style.transition = g.charge > 0 ? "transform 0.09s linear" : "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)";
      pane.style.transform = g.charge > 0 ? `translateY(${(-g.dir * g.charge * 10).toFixed(1)}px)` : "";
    }
  }, []);

  const goStep = useCallback(
    (i: number, land: GateLand = "top") => {
      const j = Math.min(lastStep, Math.max(0, i));
      setStep((cur) => {
        if (j === cur) return cur;
        const g = gate.current;
        g.charge = 0;
        g.dir = 0;
        g.land = land;
        paintCharge();
        return j;
      });
    },
    [lastStep, paintCharge, setStep],
  );

  // Land the freshly rendered step before paint — at the top when moving
  // forward, at the bottom when the back-gate pulled us up a step.
  useLayoutEffect(() => {
    const sc = scrollRef.current;
    if (sc) sc.scrollTop = gate.current.land === "bottom" ? sc.scrollHeight : 0;
    gate.current.land = "top";
  }, [step]);

  const stepRef = useRef(step);
  stepRef.current = step;
  // Read through a ref so a changing guard doesn't re-bind the wheel listener.
  const canGoNextRef = useRef(canGoNext);
  canGoNextRef.current = canGoNext;

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || !enabled) return;
    const g = gate.current;

    const startDecay = () => {
      if (g.raf) return;
      const tick = () => {
        g.raf = 0;
        if (g.charge <= 0) {
          g.dir = 0;
          paintCharge();
          return;
        }
        if (performance.now() - g.lastWheel > GATE_DECAY_IDLE_MS) {
          g.charge = Math.max(0, g.charge - GATE_DECAY_PER_FRAME);
          paintCharge();
        }
        g.raf = requestAnimationFrame(tick);
      };
      g.raf = requestAnimationFrame(tick);
    };

    const addCharge = (dir: 1 | -1, amt: number, now: number) => {
      if (g.dir !== dir) {
        g.charge = 0;
        g.dir = dir;
      }
      g.lastWheel = now;
      g.charge = Math.min(1, g.charge + amt / GATE_DISTANCE);
      if (g.charge >= 1) {
        g.charge = 0;
        g.dir = 0;
        paintCharge();
        g.coolUntil = now + GATE_COOLDOWN_MS;
        goStep(stepRef.current + dir, dir === 1 ? "top" : "bottom");
      } else {
        paintCharge();
        startDecay();
      }
    };

    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1);
      const mag = Math.abs(dy);
      // A gesture ends on a pause OR on a delta spike — a deliberate flick
      // thrown while the previous gesture's momentum tail is still trickling.
      const newGesture =
        now - g.lastAny > GATE_GESTURE_GAP_MS ||
        (mag >= GATE_SPIKE_MIN_PX && mag > g.lastMag * GATE_SPIKE_RATIO);
      g.lastAny = now;
      g.lastMag = mag;
      if (now < g.coolUntil) {
        e.preventDefault();
        return;
      }
      const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
      const atTop = sc.scrollTop <= 1;
      // The gate arms per gesture: only a gesture that STARTS at an edge may
      // charge it. A long scroll from mid-page snaps at the edge and its
      // remaining momentum is swallowed — a fresh gesture is needed to step.
      if (newGesture) {
        g.armedTop = atTop;
        g.armedBottom = atBottom;
      }
      // A nested scroller (question picker, dropdown list) that can still
      // consume the wheel owns it — never charge the gate over its content.
      for (let el = e.target as HTMLElement | null; el && el !== sc; el = el.parentElement) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const oy = getComputedStyle(el).overflowY;
          if (
            (oy === "auto" || oy === "scroll") &&
            (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0)
          )
            return;
        }
      }
      if (dy > 0 && atBottom && stepRef.current < lastStep && canGoNextRef.current) {
        e.preventDefault();
        if (g.armedBottom) addCharge(1, dy, now);
      } else if (dy < 0 && atTop && stepRef.current > 0) {
        e.preventDefault();
        if (g.armedTop) addCharge(-1, -dy, now);
      } else if (g.charge > 0) {
        g.charge = 0;
        g.dir = 0;
        paintCharge();
      }
    };

    sc.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      sc.removeEventListener("wheel", onWheel);
      if (g.raf) cancelAnimationFrame(g.raf);
      g.raf = 0;
    };
  }, [enabled, goStep, lastStep, paintCharge]);

  return {
    scrollRef,
    paneOutRef,
    prevLineRef,
    prevCapRef,
    nextLineRef,
    nextCapRef,
    backFillRef,
    nextFillRef,
    goStep,
  };
}

/** The two edge overlays — a 2px orange line per edge plus the mono caption
 * naming the adjacent step. Drop this as the first child of `.wizard-main`. */
export function WizardGateEdges({
  gate,
  step,
  lastStep,
  labels,
}: {
  gate: EdgeLineGate;
  step: number;
  lastStep: number;
  labels: string[];
}) {
  return (
    <>
      {step > 0 && (
        <>
          <span className="wizard-gate-line is-top" ref={gate.prevLineRef} />
          <span className="wizard-gate-cap is-top" ref={gate.prevCapRef}>
            ↑ BACK TO STEP {pad2(step)} · {labels[step - 1]?.toUpperCase()}
          </span>
        </>
      )}
      {step < lastStep && (
        <>
          <span className="wizard-gate-line is-bottom" ref={gate.nextLineRef} />
          <span className="wizard-gate-cap is-bottom" ref={gate.nextCapRef}>
            ↓ NEXT · STEP {pad2(step + 2)} · {labels[step + 1]?.toUpperCase()}
          </span>
        </>
      )}
    </>
  );
}
