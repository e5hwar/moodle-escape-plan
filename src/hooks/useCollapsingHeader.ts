import { useCallback, useLayoutEffect, useRef } from "react";

/* Collapsing page header — Claude Design "Certifications Prototype"
 * (2026-09-24). Certifications only; every other list page keeps
 * useLandingMorph.
 *
 * The page opens on its landing: a large title, a one-line catalog summary and
 * the Large search bar, sitting straight on top of the real table (there is no
 * separate landing list). ONE native scroller runs the whole page — the
 * table's `.table-xscroll`, which now holds the header too — and its first
 * `--clh-d` px of scroll collapse that header into the standard table-page
 * header. The distance is exactly the height the header loses, and the header
 * keeps a constant flow footprint (it hands the lost height back as a bottom
 * margin), so the table rides up glued to the header's bottom edge: a row
 * never slides under the header, or away from it, mid-collapse. Past the
 * distance the header is fully collapsed and pinned, and rows scroll under it.
 * Scrolling back to the top re-opens it. Nothing snaps or animates on its
 * own — the scroll position IS the state.
 *
 * Progress is written as `--clh` (0 = landing … 1 = collapsed) on the header
 * block and the table's header row only — setting it on the scroller would
 * restyle every row on every scroll frame. The `.tasks.clh` rules in
 * index.css do the rest. Two lengths CSS can't know are measured here:
 *   --clh-stick  the COLLAPSED header's height, where the table header pins
 *   --clh-vw     the scrollport's width — the header's own width, so it can
 *                hold still (sticky left) while a wide table scrolls sideways
 */

// Fallback only: the real distance is CSS's `--clh-d` (a registered <length>,
// the sum of the header's shrinking parts), read back resolved on mount.
const DEFAULT_DISTANCE = 156.8;

export function useCollapsingHeader() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const theadRef = useRef<HTMLTableElement | null>(null);
  const distance = useRef(DEFAULT_DISTANCE);

  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const header = headerRef.current;
    const thead = theadRef.current;
    if (!sc || !header || !thead) return;

    distance.current =
      parseFloat(getComputedStyle(sc).getPropertyValue("--clh-d")) || DEFAULT_DISTANCE;

    let progress = -1;
    let stick = -1;
    let width = -1;

    // Paint the progress the scroll position says, before the browser does.
    function apply() {
      const p = Math.min(1, Math.max(0, sc!.scrollTop / distance.current));
      if (p === progress) return;
      progress = p;
      const v = p.toFixed(4);
      header!.style.setProperty("--clh", v);
      thead!.style.setProperty("--clh", v);
    }

    // The header's height at ANY progress is its collapsed height plus the
    // part of the distance not yet scrolled, so the collapsed height reads back
    // exactly from wherever the page is. Writes are skipped unless something
    // really moved: this runs on every collapse frame (the header's own size
    // is what changes) and must not restyle anything then.
    function measure() {
      const p = Math.max(0, progress);
      const h = header!.getBoundingClientRect().height - distance.current * (1 - p);
      if (Math.abs(h - stick) > 0.5) {
        stick = h;
        thead!.style.setProperty("--clh-stick", `${h.toFixed(2)}px`);
      }
      const w = sc!.clientWidth;
      if (w !== width) {
        width = w;
        header!.style.setProperty("--clh-vw", `${w}px`);
      }
    }

    apply();
    measure();
    sc.addEventListener("scroll", apply, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    ro.observe(header);
    return () => {
      sc.removeEventListener("scroll", apply);
      ro.disconnect();
    };
  }, []);

  /** Bring the first row back under the header — for a new query, filter, sort
   *  or page — without re-opening a header the reader already collapsed. */
  const scrollToFirstRow = useCallback(() => {
    const sc = scrollRef.current;
    if (sc && sc.scrollTop > distance.current) sc.scrollTop = distance.current;
  }, []);

  return { scrollRef, headerRef, theadRef, scrollToFirstRow };
}
