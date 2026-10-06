import { useEffect, useRef, type ReactNode } from "react";
import { RowChevronIcon } from "./icons";

/* The Review Runs strip (Figma 1392:1793) — shared by
   Hands-On Submissions and Exam Reviews, and borrowed by the Question Bank for
   a category's sub-category cards. Each page owns its own model (what a card
   filters, its recents, its suggestions); these are only the markup. Styles:
   `.rr*` in index.css. */

/** The strip itself: ONE row of cards, recents first then suggestions, with
 *  no group headings (Figma 1392:1793, 2026-10-02) — a recent card says so in
 *  its own subtext. */
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
     don't fit, with its scrollbar hidden (see `.rr-row`). A plain mouse
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
      <div className="rr-row" ref={groupsRef}>
        {children}
      </div>
    </section>
  );
}

/* Figma 1393:1794 (320×70) — the Setup / Name Change banner's card in grey:
   the pending count in its own hairlined cell — capped at "99+" (1393:1875) —
   the run's name over its kind, a chevron at the end. A recent run adds
   "· Recent" to the kind (1437:1513). A run over several values titles itself
   after the first with the table's "+N" chip and lists them all on hover.
   The Question Bank's Sub-Category card (Figma 1494:1459) is the same card
   with no count cell and no chevron: name over "28 Questions", and a kebab the
   page lays over the end slot on hover — `count` omitted, `chevron={false}`.
   Its strip ends on the Add Sub-Category card (Figma 1512:2804), the "add"
   variant: no fill (just a hairline edge), a leading 20px glyph in
   place of the count cell — no divider — and a title with no end slot. */
export function ReviewRunCard({
  count,
  values,
  sub,
  recent,
  selected,
  chevron = true,
  variant,
  icon,
  onClick,
}: {
  /** The big number in its own cell. Omitted, the card has no count cell. */
  count?: number;
  /** The run's name(s): one for a single-value run, several for a multi-pick. */
  values: string[];
  /** The second line — what kind of filter this is. Omitted for "All". */
  sub?: string | null;
  /** A recent run — "· Recent" after the kind (just "Recent" when it has none). */
  recent?: boolean;
  /** Set only where a card is a TOGGLE that filters in place (the Question
   *  Bank's sub-category cards) rather than a preset that opens the console —
   *  it draws the selected state and announces `aria-pressed`. Omitted, the
   *  card is a plain button, as on the review pages. */
  selected?: boolean;
  /** false: no chevron, but its 16px slot stays — the page's own trailing
   *  control (the Question Bank's hover kebab) is laid over it, so the text
   *  never runs under it. */
  chevron?: boolean;
  /** "add" — the fill-less card that ends a strip with an action (Figma
   *  1512:2804): `icon` leads it, and it has no end slot. */
  variant?: "add";
  /** The add variant's leading 20px glyph. */
  icon?: ReactNode;
  onClick: () => void;
}) {
  const extra = values.length - 1;
  const subLine = recent ? (sub ? `${sub} · Recent` : "Recent") : sub;
  return (
    <button
      type="button"
      className={`rr-card${variant === "add" ? " rr-card--add" : ""}${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
      /* A multi-value run lists its values; a single name shows only when the
         card has cut it short. */
      data-tip={extra > 0 ? values.join("\n") : values[0]}
      data-tip-overflow={extra > 0 ? undefined : ""}
    >
      {icon}
      {count !== undefined && <span className="rr-count">{count > 99 ? "99+" : count}</span>}
      <span className="rr-text">
        <span className="rr-title">
          {values[0]}
          {extra > 0 && <>{" "}<span className="used-extra">+{extra}</span></>}
        </span>
        {subLine && <span className="rr-sub">{subLine}</span>}
      </span>
      {variant !== "add" && (
        <span className="rr-chevron" aria-hidden={chevron ? undefined : true}>
          {chevron && <RowChevronIcon />}
        </span>
      )}
    </button>
  );
}
