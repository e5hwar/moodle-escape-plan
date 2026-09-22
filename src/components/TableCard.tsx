import type { ReactNode } from "react";

/* Table Card — Figma 960:980 "Quiz Questions", with the titled block the
 * comparison nodes wrap it in (1282:2418 / 1282:2333).
 *
 * The card is the shared `.table` inside a bordered r8 shell: a washed 36px
 * header row of 16px Medium white labels sitting over 40px rows, 16px outer
 * gutters with 40px between adjacent columns, and the card's own hairline
 * closing off the last row instead of a trailing separator.
 *
 * Given a `title` it renders the node's titled block instead: a 24px row
 * holding a 20px SemiBold heading — with room opposite it for one control —
 * and the card 8px below. That heading replaces the page's `SectionHeading`
 * above a card table; it is bigger and sits much closer to what it names.
 *
 * It is chrome only — it re-skins the table it wraps rather than replacing it,
 * so the table keeps its colgroup, per-column classes, row menus and grouped
 * (`.skg-*`) rows and changes nothing but its surface. Pass the page's
 * existing `<table className="table">` as children:
 *
 *   <TableCard title="Account Details" trailing={swapButton}>
 *     <table className="table">…</table>
 *   </TableCard>
 *
 * Note the app-wide plain-text-column rule still applies inside: a cell that
 * needs colour, an icon or a strikethrough has to say so at a specificity that
 * beats it (see `.mgf-c-*` in index.css).
 */
export function TableCard({
  title,
  trailing,
  className,
  children,
}: {
  /** The node's 20px SemiBold heading, 8px above the card. */
  title?: string;
  /** What sits opposite the heading — a quiet button, a menu. Needs `title`. */
  trailing?: ReactNode;
  /** Page-local spacing / width rules — the component itself carries none. */
  className?: string;
  children: ReactNode;
}) {
  const cls = (base: string) => `${base}${className ? ` ${className}` : ""}`;
  if (!title) return <div className={cls("tcard")}>{children}</div>;
  return (
    <section className={cls("tcard-block")}>
      <header className="tcard-head">
        <h2 className="tcard-title">{title}</h2>
        {trailing}
      </header>
      <div className="tcard">{children}</div>
    </section>
  );
}
