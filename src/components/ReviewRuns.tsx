import { useEffect, useRef, type ReactNode } from "react";
import { RowChevronIcon } from "./icons";

/* The Review Runs strip (Figma 1398:2031 row / 1392:1793 cards) — shared by
   Hands-On Submissions and Exam Reviews, and borrowed by the Question Bank for
   a category's sub-category cards. Each page owns its own model (what a card
   filters, its recents, its suggestions); these are only the markup. Styles:
   `.rr*` in index.css. */

/** The strip itself: Recent and Suggested groups side by side in a 98px row. */
export function ReviewRunsStrip({
  children,
  label = "Review Runs",
  className,
}: {
  children: ReactNode;
  /** Accessible name for the strip — the review pages keep "Review Runs". */
  label?: string;
  /** Page-scoped modifier (e.g. the Question Bank's morph-driven height). */
  className?: string;
}) {
  const groupsRef = useRef<HTMLDivElement>(null);

  /* Cards never shrink below 320px, so the row scrolls sideways once they
     don't fit, with its scrollbar hidden (see `.rr-groups`). A plain mouse
     wheel only moves vertically, so turn it sideways while the row can still
     move that way — at either end the wheel falls through to the page.
     Non-passive, or preventDefault is ignored. */
  useEffect(() => {
    const el = groupsRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!el || e.shiftKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const room = e.deltaY > 0 ? el.scrollLeft < max - 1 : el.scrollLeft > 0;
      if (!room) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <section className={className ? `rr ${className}` : "rr"} aria-label={label}>
      <div className="rr-groups" ref={groupsRef}>
        {children}
      </div>
    </section>
  );
}

/** One group — an optional "RECENT REVIEW RUNS" / "SUGGESTED" label over its
 *  cards. Without a label the cards centre in the strip's 98px row, which
 *  stays 98px so nothing below moves when the first recent (and with it the
 *  labels) appears. */
export function ReviewRunGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="rr-group">
      {label && <span className="rr-label">{label}</span>}
      <div className="rr-cards">{children}</div>
    </div>
  );
}

/* Figma 1393:1794 "Card - Unselected" (320×70): the pending count in its own
   hairlined cell — capped at "99+" (1393:1875) — the run's name over its
   kind, a chevron at the end. A run over several values titles itself after
   the first with the table's "+N" chip and lists them all on hover. */
export function ReviewRunCard({
  count,
  values,
  sub,
  selected,
  onClick,
}: {
  count: number;
  /** The run's name(s): one for a single-value run, several for a multi-pick. */
  values: string[];
  /** The second line — what kind of filter this is. Omitted for "All". */
  sub?: string | null;
  /** Set only where a card is a TOGGLE that filters in place (the Question
   *  Bank's sub-category cards) rather than a preset that opens the console —
   *  it draws the selected state and announces `aria-pressed`. Omitted, the
   *  card is a plain button, as on the review pages. */
  selected?: boolean;
  onClick: () => void;
}) {
  const extra = values.length - 1;
  return (
    <button
      type="button"
      className={selected ? "rr-card is-selected" : "rr-card"}
      aria-pressed={selected}
      onClick={onClick}
      data-tip={extra > 0 ? values.join("\n") : undefined}
    >
      <span className="rr-count">{count > 99 ? "99+" : count}</span>
      <span className="rr-text">
        <span className="rr-title">
          {values[0]}
          {extra > 0 && <span className="used-extra">+{extra}</span>}
        </span>
        {sub && <span className="rr-sub">{sub}</span>}
      </span>
      <span className="rr-chevron">
        <RowChevronIcon />
      </span>
    </button>
  );
}
