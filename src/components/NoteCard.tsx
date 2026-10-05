import type { CSSProperties, ReactNode } from "react";

/* The shared callout (Figma 1121:1671 "Note", 1195:1690 for the green tone):
 * a leading glyph, a 16px SemiBold title over 14px muted body copy, on the
 * card — a lone translucent 20% wash over whatever holds it (page or modal). Neutral by default; `accent` (orange) for a
 * heads-up, `ok` (green) for a confirmation, `warn` (yellow) for a decision
 * still wanted, `danger` (red) for something the
 * user has to fix before going on. An optional trailing action sits on the
 * same row, at the card's far edge, at least 40px from the text — ANY button
 * (user, 2026-10-02): a labelled one (Edit Criteria, Swap) or a bare 16px icon
 * button (`.note-card-icon-btn`, e.g. an open-in-new-tab glyph).
 *
 * `onClick` makes the WHOLE card a click target (pointer, brightens on hover)
 * for a card that is itself a link — Exam Reviews' "Caught Cheating in Past
 * Quizzes" (Figma 457:577). The card stays a div: the keyboard/screen-reader
 * control is the trailing button, which should run the same thing (a button
 * can't hold another button). `singleLine` keeps title and body to one line
 * each, ellipsing free text instead of wrapping.
 *
 * One component for every node that draws this card: the Skills "Applies to
 * Existing Users" note, the Locked Field banner (Figma 1360:1883 — criteria
 * locks, Quiz Structure), the review rail's Read-Only card (1448:2554), and
 * the Merge / Transfer callouts, the green "All Rows Passed" card on the
 * Question Bank and Certification CSV imports, and Exam Reviews' Past Attempts
 * Flagged card (457:577). */
export function NoteCard({
  tone = "neutral",
  icon,
  title,
  body,
  action,
  mutedIcon,
  role,
  className,
  style,
  onClick,
  clickTip,
  singleLine,
}: {
  tone?: "neutral" | "accent" | "ok" | "warn" | "danger";
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  /** Grey (#a8a8a8) glyph instead of white — the status cards (Locked,
   *  Read-Only) draw their outline icon in the muted text colour. */
  mutedIcon?: boolean;
  role?: string;
  className?: string;
  /** Inline custom properties — e.g. Manage Completions' `--mc-pct`. */
  style?: CSSProperties;
  /** The whole card opens/does this — see the header comment. */
  onClick?: () => void;
  /** Hover tip for a clickable card: what the click opens. */
  clickTip?: string;
  /** One line each for title and body, ellipsed. */
  singleLine?: boolean;
}) {
  return (
    <div
      className={`note-card${tone === "neutral" ? "" : ` note-card--${tone}`}${
        mutedIcon ? " note-card--muted-icon" : ""
      }${onClick ? " note-card--link" : ""}${singleLine ? " note-card--single" : ""}${
        className ? ` ${className}` : ""
      }`}
      role={role}
      style={style}
      onClick={onClick}
      data-tip={onClick ? clickTip : undefined}
    >
      {icon && <span className="note-card-icon">{icon}</span>}
      <div className="note-card-text">
        <p className="note-card-title">{title}</p>
        {body && <p className="note-card-body">{body}</p>}
      </div>
      {action && <span className="note-card-action">{action}</span>}
    </div>
  );
}
