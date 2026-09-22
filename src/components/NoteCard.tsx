import type { ReactNode } from "react";

/* The shared callout (Figma 1121:1671 "Note", 1195:1690 for the green tone):
 * a leading glyph, a 16px SemiBold title over 14px muted body copy, on the
 * 20%-wash-over-75%-black card. Neutral by default; `accent` (orange) for a
 * heads-up, `ok` (green) for a confirmation, `warn` (yellow) for a decision
 * still wanted, `danger` (red) for something the
 * user has to fix before going on. An optional trailing action sits on the
 * same row, at the card's far edge.
 *
 * The Skills wizard's "Applies to Existing Users" note and the Question Bank
 * import's "All Rows Passed" card draw the same markup inline. */
export function NoteCard({
  tone = "neutral",
  icon,
  title,
  body,
  action,
  className,
}: {
  tone?: "neutral" | "accent" | "ok" | "warn" | "danger";
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`note-card${tone === "neutral" ? "" : ` note-card--${tone}`}${
        className ? ` ${className}` : ""
      }`}
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
