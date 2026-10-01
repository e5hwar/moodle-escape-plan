import type { ReactNode } from "react";
import { KeyCommandIcon } from "./icons";

/* Skeleton State Overlay — Figma 1418:1402. What a page asks while it still has
 * nothing to show, centred over a ghost of the record it is about to load. The
 * ghost backdrop is each page's own; this is only the question in front of it:
 * a 20px Medium white title, 8px to a 16px #a8a8a8 line, 20px to the Secondary
 * Button (`.btn-save-draft`) ending on a white ⌘K pair (`.cta-kbd`). Every page
 * that uses it binds ⌘K to the same picker the button opens.
 *
 * Centres itself in the nearest positioned ancestor, so the region holding the
 * backdrop must be `position: relative`. `dull` sinks it while the search it
 * prompted is open, so the two don't compete. */
export function SkeletonOverlay({
  title,
  sub,
  cta,
  onCta,
  dull = false,
}: {
  title: ReactNode;
  sub: ReactNode;
  cta: string;
  onCta: () => void;
  dull?: boolean;
}) {
  return (
    <div className={`skel-overlay${dull ? " is-dull" : ""}`}>
      <div className="skel-overlay-title">{title}</div>
      <div className="skel-overlay-sub">{sub}</div>
      <button className="btn-save-draft skel-overlay-cta" onClick={onCta}>
        {cta}
        <span className="skel-overlay-keys">
          <span className="cta-kbd">
            <KeyCommandIcon />
          </span>
          <span className="cta-kbd">K</span>
        </span>
      </button>
    </div>
  );
}
