import type { ReactNode } from "react";

/* Wizard section divider — Figma 104:376 "Page Break".
   A short lead line, an uppercase monospace label, then a hairline that fills the
   remaining width. Used to split a wizard step's content into labeled sections.
   `trailing` renders after the line (e.g. the "Effective Today" pill in the
   subscription preview, Figma 107:1128). */
export function PageBreak({ label, trailing }: { label: string; trailing?: ReactNode }) {
  return (
    <div className="page-break">
      <span className="page-break-line page-break-line-lead" />
      <span className="page-break-label">{label}</span>
      <span className="page-break-line" />
      {trailing}
    </div>
  );
}
