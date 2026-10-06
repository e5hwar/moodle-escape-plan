import { useCallback, useLayoutEffect, useRef } from "react";

/* Collapsing page header — Claude Design "Certifications Prototype"
 * (2026-09-24). Certifications, then (2026-09-28) Tasks, Companies and Manage
 * Users — every search-first landing. The cards / rail landings (Exam Reviews,
 * Hands-On, Question Bank) keep useLandingMorph.
 *
 * The page opens on its landing: a large title, a one-line catalog summary and
 * the Large search bar, sitting straight on top of the real table (there is no
 * separate landing list). ONE native scroller runs the whole page — the
 * table's `.table-xscroll`, which holds the header too — and its first
 * `--clh-d` px of scroll collapse that header into the standard table-page
 * header. Past that the header is pinned and rows scroll under it; scrolling
 * back to the top re-opens it. The scroll position IS the state.
 *
 * All of the motion is CSS and runs on the compositor (see the `.tasks.clh`
 * rules in index.css): the header block keeps its landing layout, pinned, and
 * every piece of it moves by one linear scroll-driven transform — rise,
 * resize, fade — on the scroller's `--clh` timeline, all in step. Nothing is
 * restyled or re-laid-out per scroll frame — an earlier version wrote the
 * progress into CSS on every scroll event, and that main-thread work (plus
 * landing a frame behind the native scroll) made the collapse judder.
 *
 * What this hook still does:
 *   --clh-stick  measures the collapsed header's height (the header's static
 *                height minus the distance) — where the table header pins,
 *                and the height of the header's opaque band
 *   --clh-vw     measures the scrollport's width — the header's own width, so
 *                it can hold still (sticky left) while a wide table scrolls
 *   data-clh     "landing" | "moving" | "collapsed" on the header — the coarse
 *                state CSS can't derive (what may take focus at either end);
 *                written only when it changes
 *   --clh-nc-*   Manage Users only: the sizes the name-change card's morph
 *                into its title note needs (the card's and the note's widths,
 *                each one's count, the card's text column) — sizes text
 *                decides and CSS can't know, measured like everything here:
 *                on a resize or a content / font change, never per scroll
 *                frame
 * and, in a browser without scroll timelines, feeds the fallback rules the
 * scroll offset (`--clh-s`, and the distance as a number, `--clh-dn`).
 */

// Fallback only: the real distance is CSS's `--clh-d` (a registered <length>,
// the sum of the header's collapsing parts), read back resolved on mount.
const DEFAULT_DISTANCE = 167.8;

// The last scripted offset that still changes anything: the table header's
// shadow finishes fading in 40px past the distance.
const SHADOW_RUN = 40;

/** `startCollapsed` opens the page already scrolled past the landing — for a
 *  deep link that arrives with its filter set (the prototype's own
 *  `startCollapsed`). Read once, on mount; scrolling up still re-opens it. */
export function useCollapsingHeader(startCollapsed = false) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const theadRef = useRef<HTMLTableElement | null>(null);
  const distance = useRef(DEFAULT_DISTANCE);
  const startCollapsedRef = useRef(startCollapsed);

  useLayoutEffect(() => {
    const sc = scrollRef.current;
    const header = headerRef.current;
    const thead = theadRef.current;
    if (!sc || !header || !thead) return;

    distance.current =
      parseFloat(getComputedStyle(sc).getPropertyValue("--clh-d")) || DEFAULT_DISTANCE;
    // Before the first paint, so a deep link never flashes the landing. The
    // canvas is always at least one distance taller than the scrollport, so
    // this lands fully collapsed however short the list is.
    if (startCollapsedRef.current) sc.scrollTop = Math.ceil(distance.current);

    // Browsers that can't run animations on a scroll timeline get the same
    // transforms from the `@supports not` rules, driven from here.
    const scripted = !(typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: --clh"));
    if (scripted) {
      const dn = String(distance.current);
      header.style.setProperty("--clh-dn", dn);
      thead.style.setProperty("--clh-dn", dn);
    }

    let state = "";
    let offset = -1;
    let stick = -1;
    let width = -1;

    function apply() {
      const s = Math.max(0, sc!.scrollTop);
      const next = s <= 0 ? "landing" : s >= distance.current ? "collapsed" : "moving";
      if (next !== state) {
        state = next;
        header!.dataset.clh = next;
      }
      if (scripted) {
        const v = Math.min(s, distance.current + SHADOW_RUN);
        if (v !== offset) {
          offset = v;
          header!.style.setProperty("--clh-s", String(v));
          thead!.style.setProperty("--clh-s", String(v));
        }
      }
    }

    // The header's layout never changes while scrolling now — only on a
    // resize or a content change (a filter row that wraps) — so this runs
    // rarely, and writes only when something really moved.
    function measure() {
      const h = header!.getBoundingClientRect().height - distance.current;
      if (Math.abs(h - stick) > 0.5) {
        stick = h;
        // Where the table header pins, and the height of the header's opaque
        // band — the collapsed header, exactly.
        const v = `${h.toFixed(2)}px`;
        thead!.style.setProperty("--clh-stick", v);
        header!.style.setProperty("--clh-stick", v);
      }
      const w = sc!.clientWidth;
      if (w !== width) {
        width = w;
        header!.style.setProperty("--clh-vw", `${w}px`);
        // The table's empty state (`.table-empty`) holds still the same way.
        sc!.style.setProperty("--clh-vw", `${w}px`);
      }
      measureMorph();
    }

    // Manage Users' name-change card condenses into the note under the title
    // (the `.tasks.clh.clh--banner` rules): every piece of the card travels to
    // its twin in the note, so the CSS needs the two widths, the two counts'
    // widths and the card's text-column height (it wraps on a narrow card,
    // which moves its first line up). Layout sizes — computed style, never the
    // bounding box, which carries the running transforms. The boxes are
    // observed too: a count that changes, a font that loads or a line that
    // wraps resizes them, not the header.
    const observed = new Set<Element>();
    let morph = "";
    function measureMorph() {
      const card = header!.querySelector<HTMLElement>(":scope > .clh-banner > .lm-banner");
      const note = header!.querySelector<HTMLElement>(":scope > .tasks-note");
      const cardCount = card?.querySelector<HTMLElement>(".lm-banner-count");
      const cardText = card?.querySelector<HTMLElement>(".note-card-text");
      const noteCount = note?.querySelector<HTMLElement>(".tasks-note-count");
      if (!card || !note || !cardCount || !cardText || !noteCount) return;
      for (const el of [card, note, cardCount, cardText, noteCount]) {
        // Observe each once — observing again re-fires the callback.
        if (!observed.has(el)) {
          observed.add(el);
          ro.observe(el);
        }
      }
      const [cardW, noteW, cardCountW, noteCountW] = [card, note, cardCount, noteCount].map((el) =>
        parseFloat(getComputedStyle(el).width),
      );
      const cardTextH = parseFloat(getComputedStyle(cardText).height);
      if (!(cardW > 0 && noteW > 0 && cardCountW > 0 && noteCountW > 0 && cardTextH > 0)) return;
      const key = `${cardW}|${noteW}|${cardCountW}|${noteCountW}|${cardTextH}`;
      if (key === morph) return;
      morph = key;
      const st = header!.style;
      st.setProperty("--clh-nc-card-w", `${cardW}px`);
      st.setProperty("--clh-nc-note-w", `${noteW}px`);
      st.setProperty("--clh-nc-card-count-w", `${cardCountW}px`);
      st.setProperty("--clh-nc-note-count-w", `${noteCountW}px`);
      st.setProperty("--clh-nc-card-text-h", `${cardTextH}px`);
      st.setProperty("--clh-nc-sx", (noteW / cardW).toFixed(5));
    }

    const ro = new ResizeObserver(measure);
    apply();
    measure();
    sc.addEventListener("scroll", apply, { passive: true });
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
    // A whole pixel, rounded up: a fractional target can snap just short of
    // the distance on a high-DPI screen and leave the header a hair open.
    const collapsed = Math.ceil(distance.current);
    if (sc && sc.scrollTop > collapsed) sc.scrollTop = collapsed;
  }, []);

  return { scrollRef, headerRef, theadRef, scrollToFirstRow };
}
