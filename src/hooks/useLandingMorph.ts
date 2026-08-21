import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/* Landing → table scroll-morph (Claude Design "Tasks Landing 6B").
 *
 * List pages open as a search-first landing — oversized centered search bar,
 * suggested filter pills, and a short name-only list — and the mouse wheel
 * drives a 0→1 progress that morphs that hero into the page's normal table
 * view.
 *
 * Motion model: the wheel moves a TARGET; an exponential-smoothing rAF loop
 * eases the visible progress toward it (so discrete wheel notches never jump
 * the UI), and the last stretch of a gesture auto-completes. Once the table is
 * fully formed it is locked against wheel-up *over the table*; scrolling up
 * anywhere outside the table region (header, search, footer) — or ArrowUp /
 * PageUp / Home with the table at its top — returns to the landing.
 *
 * Progress is written as CSS custom properties on the page root (no React
 * re-render per tick); the `.tasks.lm` rules in index.css do the rest:
 *   --lm   raw progress 0…1
 *   --lmf  smoothstep(ramp .33…1) — filter row / growing columns fade-in
 *   --lmt  smoothstep(ramp .55…1) — table chrome fade-in
 * plus a coarse data attribute for the on/off bits CSS can't interpolate:
 *   data-lm="landing" | "morph" | "table"
 */

const MORPH_DISTANCE = 180; // wheel px for the full landing→table gesture
const TAU = 90; // ms — smoothing time constant for the easing loop

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
// Smoothstep removes the velocity kink where a phase's linear ramp begins/ends.
const smooth = (t: number) => t * t * (3 - 2 * t);

export function useLandingMorph(startAtTable = false) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Deep-linked entries (a preset filter/query passed in) skip the landing.
  const current = useRef(startAtTable ? 1 : 0);
  const target = useRef(startAtTable ? 1 : 0);
  const raf = useRef<number | null>(null);
  const lastT = useRef(0);
  // Coarse "table reached" flag for the rare React-side need (e.g. autofocus).
  const [atTable, setAtTable] = useState(startAtTable);
  const atTableRef = useRef(startAtTable);

  const apply = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const p = current.current;
    el.style.setProperty("--lm", String(p));
    el.style.setProperty("--lmf", String(smooth(ramp(p, 0.33, 1))));
    const pt = smooth(ramp(p, 0.55, 1));
    el.style.setProperty("--lmt", String(pt));
    const state = p >= 0.999 ? "table" : p < 0.55 ? "landing" : "morph";
    if (el.dataset.lm !== state) el.dataset.lm = state;
    const t = p >= 0.999;
    if (t !== atTableRef.current) {
      atTableRef.current = t;
      setAtTable(t);
    }
  }, []);

  const tick = useCallback(
    (now: number) => {
      const dt = Math.min(64, now - lastT.current);
      lastT.current = now;
      // Frame-rate-independent exponential ease toward the target.
      current.current += (target.current - current.current) * (1 - Math.exp(-dt / TAU));
      if (Math.abs(target.current - current.current) < 0.001) {
        current.current = target.current;
        apply();
        raf.current = null;
        return;
      }
      apply();
      raf.current = requestAnimationFrame(tick);
    },
    [apply],
  );

  const kick = useCallback(() => {
    if (raf.current == null) {
      lastT.current = performance.now();
      raf.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const snapTo = useCallback(
    (to: 0 | 1) => {
      target.current = to;
      kick();
    },
    [kick],
  );

  // Paint the landing state before first paint so the table never flashes.
  useLayoutEffect(() => {
    apply();
  }, [apply]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const scroller = () => el!.querySelector<HTMLElement>(".table-xscroll, .tasks-scroll");

    function onWheel(e: WheelEvent) {
      const dy = e.deltaY;
      if (dy === 0) return;
      const p = current.current;
      const sc = scroller();
      const atTop = !sc || sc.scrollTop <= 0;
      const overTable = !!(e.target as Element | null)?.closest?.(".table-xscroll");
      // Locked = the gesture committed to the table (target 1) and it is
      // visually there — from here, wheel-up over the table never collapses;
      // only regions outside the table hand the wheel back to the morph.
      const locked = target.current === 1 && p >= 0.85;
      const forward = dy > 0 && p < 0.999;
      // Reversing mid-gesture needs the table's scroller back at its top.
      const reverse = dy < 0 && p > 0.001 && (locked ? !overTable : atTop);
      if (!forward && !reverse) return;
      // Re-anchor when the wheel turns against the easing target, so a
      // direction change responds from what's on screen, not the old target.
      const anchored = dy > 0 === target.current >= p ? target.current : p;
      let t = clamp(anchored + dy / MORPH_DISTANCE);
      // The tail of the gesture completes on its own — no dead ticks near the ends.
      if (dy > 0 && t >= 0.85) t = 1;
      else if (dy < 0 && t <= 0.15) t = 0;
      if (dy < 0 && locked) sc?.scrollTo({ top: 0, behavior: "smooth" });
      target.current = t;
      kick();
      e.preventDefault();
    }

    // ArrowUp / PageUp / Home from the full table (scrolled to its top)
    // returns to the landing — the keyboard twin of wheel-up outside the table.
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "ArrowUp" && e.key !== "PageUp" && e.key !== "Home") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      // Same "committed to the table" notion as the wheel lock.
      if (!(target.current === 1 && current.current >= 0.85)) return;
      const sc = scroller();
      if (sc && sc.scrollTop > 0) return;
      e.preventDefault();
      target.current = 0;
      kick();
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKey);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [apply, kick]);

  const showTable = useCallback(() => snapTo(1), [snapTo]);
  const showLanding = useCallback(() => {
    rootRef.current
      ?.querySelector<HTMLElement>(".table-xscroll, .tasks-scroll")
      ?.scrollTo({ top: 0, behavior: "smooth" });
    snapTo(0);
  }, [snapTo]);

  return { rootRef, atTable, showTable, showLanding };
}
