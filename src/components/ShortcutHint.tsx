import { createPortal } from "react-dom";
import { useHoverCard } from "../hooks/useHoverCard";

/* ── Keyboard-shortcut hover hint (Figma 437:638) ─────────────────────────────
   For controls whose shortcut isn't printed on them (unlike View Queue, which
   carries its "Q" keycap): hovering names the action and shows the key. ── */

const CARD_WIDTH = 200;

export function ShortcutHint({
  label,
  keyLabel,
  keyIcon,
  children,
}: {
  /** What the key does, e.g. "Skip & Proceed". */
  label: string;
  /** The key itself, as printed on the cap — "N", "ESC". */
  keyLabel?: string;
  /** For keys drawn as a glyph (the arrows) — a square cap instead of text. */
  keyIcon?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Flips above anything in the lower third of the window — these hints hang
  // off footer controls, where there's never room below.
  const { anchorRef, pos, open, close, hold } = useHoverCard({
    width: CARD_WIDTH,
    flipBelow: 120,
  });

  return (
    <>
      <span
        ref={anchorRef}
        className="udh-anchor"
        data-hover-card
        onMouseEnter={open}
        onMouseLeave={close}
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <div
            className="ksh-card"
            role="tooltip"
            style={{
              top: pos.top,
              left: pos.left,
              transform: pos.flip ? "translateY(-100%)" : undefined,
            }}
            onMouseEnter={hold}
            onMouseLeave={close}
          >
            <span className="ksh-label">{label}</span>
            <span className={`ksh-key ${keyIcon ? "ksh-key--icon" : ""}`}>
              {keyIcon ?? keyLabel}
            </span>
          </div>,
          document.body,
        )}
    </>
  );
}
