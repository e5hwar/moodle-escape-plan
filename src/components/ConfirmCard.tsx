import { useContext, type CSSProperties, type ReactNode } from "react";
import { Accordion, AccordionRows, AccordionScope } from "./Accordion";
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
 *  card's four grid columns, for long values like an address or email;
 *  `"row"` takes the whole row, for a long value alone on its line (the Full
 *  Profile's Portfolio Link) so a narrow card never cuts it short. */
export type ConfirmField = [label: string, value: ReactNode, wide?: boolean | "row"];

export function ConfirmCard({
  title,
  onEdit,
  trailing,
  rows,
  fillBlanks = false,
  tableBody = false,
  columns,
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
  /** Lock the field grid to this many columns, sharing the card's width
   *  evenly (the Create Company Review step is 4 — Figma 1046:1147). Without
   *  it the card fits as many 200px columns as its width allows. */
  columns?: number;
  /** A body that isn't the field grid: a table, pills, a tab bar. */
  children?: ReactNode;
}) {
  const asAccordion = useContext(AccordionScope);
  const blank = (value: ReactNode) => value === "" || value == null || value === false;
  const shown: ConfirmField[] = !rows
    ? []
    : fillBlanks
      ? rows.map(([label, value, wide]) => [label, blank(value) ? "—" : value, wide])
      : rows.filter(([, value]) => !blank(value));
  const edit = trailing ??
    (onEdit && (
      <button type="button" className="confirm-card-edit" aria-label={`Edit ${title}`} onClick={onEdit}>
        <RowEditIcon />
      </button>
    ));

  // In the row preview panel every card is an Accordion — the same title,
  // its fields as label/value lines, anything else as the open body.
  if (asAccordion) {
    return (
      <Accordion title={title} trailing={edit || undefined}>
        {rows && <AccordionRows rows={shown.map(([label, value]) => [label, value])} />}
        {children}
      </Accordion>
    );
  }

  return (
    <section className={`confirm-card${tableBody ? " confirm-card--table" : ""}`}>
      <header className="confirm-card-head">
        <h2 className="confirm-card-title">{title}</h2>
        {edit}
      </header>
      {/* Confirm Details 6B — fields sit in a four-column grid (the first column
          a little wider for the card's lead field) with the label above the
          value, rather than one label/value row per line. */}
      {rows && (
        <div
          className={`confirm-card-body${columns ? " confirm-card-body--fixed" : ""}`}
          style={columns ? ({ "--cc-cols": columns } as CSSProperties) : undefined}
        >
          {shown.map(([label, value, wide]) => (
            <div
              className={`confirm-card-field${
                wide === "row" ? " confirm-card-field--row" : wide ? " confirm-card-field--wide" : ""
              }`}
              key={label}
            >
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
