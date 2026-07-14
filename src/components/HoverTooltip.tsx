import { useEffect, useRef, useState } from "react";

// Faster than the browser's native `title` delay (~500ms). Any element with a
// non-empty `data-tip` attribute gets this tooltip; `\n` renders as line breaks.
const DELAY = 300;

type TipState = { text: string; anchor: number; top: number; align: "left" | "right" };

export function HoverTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | null>(null);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    function clearTimer() {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    }
    function hide() {
      clearTimer();
      current.current = null;
      setTip(null);
    }
    function show(el: HTMLElement) {
      const text = el.getAttribute("data-tip");
      if (!text) return;
      const r = el.getBoundingClientRect();
      // Left-align under the cell; flip to the right edge near the viewport edge.
      const nearRight = r.left + 320 > window.innerWidth;
      setTip({
        text,
        anchor: nearRight ? window.innerWidth - r.right : r.left,
        top: r.bottom + 6,
        align: nearRight ? "right" : "left",
      });
    }
    function onOver(e: MouseEvent) {
      const el = (e.target as HTMLElement)?.closest?.("[data-tip]") as HTMLElement | null;
      if (!el || el === current.current) return;
      if (!el.getAttribute("data-tip")) return;
      current.current = el;
      clearTimer();
      timer.current = window.setTimeout(() => show(el), DELAY);
    }
    function onOut(e: MouseEvent) {
      if (!current.current) return;
      const related = e.relatedTarget as Node | null;
      if (related && current.current.contains(related)) return; // moved within the cell
      hide();
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    // Position is captured at show-time, so hide on any scroll to avoid drift.
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("scroll", hide, true);
      clearTimer();
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      className="hover-tip"
      style={{
        top: tip.top,
        [tip.align]: tip.anchor,
      }}
    >
      {tip.text}
    </div>
  );
}
