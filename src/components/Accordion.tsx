import { createContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownSquareIcon } from "./icons";

/* Accordion (Figma 1517:3788 collapsed / 1517:3792 expanded, "Preview Panel"
 * 1514:2860): a 20px SemiBold title with the 16px square-cap chevron opposite,
 * over a hairline rule; open, its body sits under the title on the same rule.
 * The body opens on the 0fr → 1fr grid track, so it grows rather than pops.
 *
 * `defaultOpen` left unset opens only the first accordion of a stack (the
 * nearest `.acc-stack`) — the preview panel's "lead with the first section,
 * the rest one click away". */

/** Inside an `AccordionScope`, every `ConfirmCard` draws itself as an
 *  Accordion instead of a card — how the row preview panel turns the shared
 *  review summaries into accordions without each summary knowing. */
export const AccordionScope = createContext(false);

export function Accordion({
  title,
  trailing,
  defaultOpen,
  children,
}: {
  title: ReactNode;
  /** Sits beside the chevron — a section's own quiet button or pencil. */
  trailing?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(defaultOpen ?? false);
  const bodyId = useId();

  useLayoutEffect(() => {
    if (defaultOpen !== undefined || !ref.current) return;
    const first = ref.current.closest(".acc-stack")?.querySelector(".acc");
    if (first === ref.current) setOpen(true);
    // Mount-only: after that the open state is the viewer's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section ref={ref} className={`acc${open ? " is-open" : ""}`}>
      <div className="acc-head">
        <button
          type="button"
          className="acc-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <h2 className="acc-title">{title}</h2>
          <span className="acc-chevron" aria-hidden="true">
            <ChevronDownSquareIcon />
          </span>
        </button>
        {trailing && <div className="acc-trailing">{trailing}</div>}
      </div>
      {/* Shut, the body is `visibility: hidden` once it has folded away, so
          nothing in it takes focus or reads out. */}
      <div className="acc-body" id={bodyId} role="region">
        <div className="acc-inner">
          <div className="acc-content">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** The label/value lines an open accordion lists (1517:3797): a 180px grey
 *  label, 20px, then the value — one field per line, 16px apart. */
export function AccordionRows({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="acc-rows">
      {rows.map(([label, value]) => (
        <div className="acc-row" key={label}>
          <dt className="acc-label">{label}</dt>
          <dd className="acc-value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
