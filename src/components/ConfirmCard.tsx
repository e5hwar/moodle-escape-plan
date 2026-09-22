import type { ReactNode } from "react";
import { RowEditIcon } from "./icons";

/* One review card (Figma 1046:1147, "Review Company Details"): a 20px title
 * over a hairline rule with a 16px pencil opposite it, and beneath it a tinted
 * r12 card holding label/value fields in four columns.
 *
 * Built for the New Company wizard's Review step and reused by the Full
 * Profile, where every section is one of these cards. The head takes either the
 * node's pencil (`onEdit`) or a quiet button of the section's own (`trailing`),
 * and the body is either a field grid (`rows`) or anything else — a table, a
 * row of pills — passed as children. */

/** One field on a confirm card: label over value. `wide` spans two of the
 *  card's four grid columns, for long values like an address or email. */
export type ConfirmField = [label: string, value: ReactNode, wide?: boolean];

export function ConfirmCard({
  title,
  onEdit,
  trailing,
  rows,
  fillBlanks = false,
  tableBody = false,
  children,
}: {
  title: string;
  /** The node's bare 16px pencil, right-aligned in the head. */
  onEdit?: () => void;
  /** What the head carries instead of that pencil — usually a quiet button. */
  trailing?: ReactNode;
  rows?: ConfirmField[];
  /** Keep every field, printing "—" where the form left a value blank. Without
   *  it a valueless field is dropped, which is what the Subscription card wants
   *  for fields that don't apply to the chosen plan. */
  fillBlanks?: boolean;
  /** The body is nothing but one of the card tables (Figma 1278:1571). The
   *  table is its own bordered panel there, so the head gives up its hairline
   *  and the table sits flush beneath it. */
  tableBody?: boolean;
  /** A body that isn't the field grid: a table, pills, a tab bar. */
  children?: ReactNode;
}) {
  const shown: ConfirmField[] = !rows
    ? []
    : fillBlanks
      ? rows.map(([label, value, wide]) => [label, value === "" || value == null ? "—" : value, wide])
      : rows.filter(([, value]) => value !== "" && value != null);
  return (
    <section className={`confirm-card${tableBody ? " confirm-card--table" : ""}`}>
      <header className="confirm-card-head">
        <h2 className="confirm-card-title">{title}</h2>
        {trailing ??
          (onEdit && (
            <button
              type="button"
              className="confirm-card-edit"
              aria-label={`Edit ${title}`}
              onClick={onEdit}
            >
              <RowEditIcon />
            </button>
          ))}
      </header>
      {/* Confirm Details 6B — fields sit in a four-column grid (the first column
          a little wider for the card's lead field) with the label above the
          value, rather than one label/value row per line. */}
      {rows && (
        <div className="confirm-card-body">
          {shown.map(([label, value, wide]) => (
            <div className={`confirm-card-field${wide ? " confirm-card-field--wide" : ""}`} key={label}>
              <div className="confirm-card-label">{label}</div>
              <div className="confirm-card-value">{value}</div>
            </div>
          ))}
        </div>
      )}
      {children && <div className="confirm-card-slot">{children}</div>}
    </section>
  );
}
