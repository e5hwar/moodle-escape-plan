import type { ReactNode } from "react";

/* Mid-page section heading — Figma 715:1575.
   A plain uppercase label: 16px Fira Sans Medium #a8a8a8, no rule line.
   Replaces the old "Page Break" divider (104:376), which was retired from the
   design system — the hairline is gone everywhere, only the label remains.
   `trailing` renders after the label (e.g. the "Effective Today" pill in the
   subscription preview). */
export function SectionHeading({ label, trailing }: { label: string; trailing?: ReactNode }) {
  return (
    <div className="section-heading">
      <span className="section-heading-label">{label}</span>
      {trailing}
    </div>
  );
}
