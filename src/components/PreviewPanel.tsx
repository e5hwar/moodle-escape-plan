import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Accordion, AccordionRows, AccordionScope } from "./Accordion";
import { ModalCloseIcon } from "./PrmModal";
import { RowKebabIcon } from "./icons";

/** How long the panel takes to leave — must match `.pp-overlay--closing`. */
const CLOSE_MS = 160;

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** One figure of the record's activity — a line in the Activity accordion:
 *  the title as the label, the count and its grey sub-line as the value. */
export type PreviewStat = { count: string; title: string; sub?: string };

/** The row preview panel (Figma 1582:1452 "Preview Panel - Certification"):
 *  a full-height 1266px panel over the modals' scrim, two columns side by
 *  side. The 790px record column — the record's thumbnail when it has one,
 *  title, grey subtitle and the row menu's bare kebab, then nothing but
 *  accordions (every `ConfirmCard` in `children` draws as one, and `stats`
 *  adds an Activity accordion last) — and the 476px preview column on a
 *  lighter wash: the close glyph at its top right over a fixed-size empty
 *  phone shell, where the learner frames will land. That column scrolls on
 *  its own when the window is too short for the phone; the phone never
 *  shrinks.
 *
 *  `role="dialog"` sits on the panel, not the fixed overlay: App.tsx finds the
 *  open modal for ⌘K by `offsetParent`, which is null on a fixed element. */
export function PreviewPanel({
  image,
  title,
  subtitle,
  onMore,
  stats,
  lead,
  children,
  onClose,
}: {
  /** The record's own thumbnail (a Certification's), 120px square at the
   *  head's left. Left out, the title starts at the column's edge. */
  image?: string;
  title: string;
  subtitle?: ReactNode;
  /** The kebab: hands back its rect so the page can open its own row menu. */
  onMore?: (rect: DOMRect) => void;
  stats?: PreviewStat[];
  /** A block of its own between the head and the accordions, 28px from each
   *  (the Certification Setup card, Figma 1592:2588). */
  lead?: ReactNode;
  /** The record's sections — ConfirmCards, each drawn as an accordion. */
  children: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

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

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => prev?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Escape closes an open row menu first, not the panel under it.
      if (document.querySelector(".u-menu")) return;
      requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    <div
      className={`pp-overlay${closing ? " pp-overlay--closing" : ""}`}
      onClick={requestClose}
    >
      <div
        ref={panelRef}
        className="pp"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pp-cols">
          <div className="pp-main">
            <div className="pp-head">
              {image && <img className="pp-thumb" src={image} alt="" />}
              <div className="pp-ident">
                <h2 className="pp-title">{title}</h2>
                {subtitle && <p className="prm-text">{subtitle}</p>}
              </div>
              {onMore && (
                <button
                  type="button"
                  className="pp-more"
                  aria-label="More actions"
                  data-tip="More actions"
                  onClick={(e) => onMore(e.currentTarget.getBoundingClientRect())}
                >
                  <RowKebabIcon />
                </button>
              )}
            </div>

            {lead}

            <div className="pp-body acc-stack">
              <AccordionScope.Provider value={true}>{children}</AccordionScope.Provider>
              {stats && stats.length > 0 && (
                <Accordion title="Activity">
                  <AccordionRows
                    rows={stats.map((s) => [
                      s.title,
                      <>
                        {s.count}
                        {s.sub && <span className="acc-value-sub"> · {s.sub}</span>}
                      </>,
                    ])}
                  />
                </Accordion>
              )}
            </div>
          </div>

          <div className="pp-side">
            <div className="pp-side-bar">
              <button className="prm-close" onClick={requestClose} aria-label="Close">
                <ModalCloseIcon />
              </button>
            </div>
            {/* The learner preview's place — an empty phone until its frames land. */}
            <div className="pp-stage">
              <div className="pp-phone" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Seeded numbers ─────────────── */

/** A stable pseudo-random integer in [min, max] for a record — the seed has no
 *  analytics, so the stat strip draws deterministic figures from the id. */
export function seededInt(id: string, salt: string, min: number, max: number): number {
  let h = 0x811c9dc5;
  for (const ch of `${salt}:${id}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return min + ((h >>> 0) % (max - min + 1));
}

export const formatCount = (n: number) => n.toLocaleString("en-US");

/** "3 days ago" / "5 months ago" for a parseable date, relative to now. */
export function timeAgo(date: string | undefined): string | undefined {
  const t = date ? Date.parse(date) : NaN;
  if (Number.isNaN(t)) return undefined;
  const days = Math.max(0, Math.round((Date.now() - t) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
