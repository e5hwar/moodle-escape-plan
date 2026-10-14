import { useEffect } from "react";
import { NoteCard } from "./NoteCard";
import { MenuEnterIcon } from "./icons";

/* A page that isn't specced yet (user, 2026-10-06 — Figma list items 81–90):
 * the standard page header only, "Placeholder for <name>" over the subtext
 * "Details of this will be added to the spec". Used by every own-tab page that
 * stands in for something outside this prototype — Public Portfolio, Stripe
 * Invoices, Stripe Billing Emails, both Login As views, Company Dashboard,
 * View Attempt, Pre-Submission Screen — and by the crash and not-found screens. In the app
 * it stands in for Create / Edit Design Template (user, 2026-10-13: not
 * designed yet), under a crumb back to Product Config. */

export function PlaceholderPage({
  name,
  viewingAs,
  crumb,
}: {
  name: string;
  /** An in-app placeholder (Create / Edit Design Template): the parent page's
   *  breadcrumb, which is the way back. */
  crumb?: { label: string; onClick: () => void };
  /** A Login As tab (spec review 2026-10-09): the user or company whose
   *  session this tab stands for. Adds a persistent top banner saying so —
   *  the admin tab that opened it is untouched, and several can be open. */
  viewingAs?: string;
}) {
  useEffect(() => {
    if (viewingAs) document.title = `Viewing as ${viewingAs}`;
  }, [viewingAs]);
  return (
    <div className="tasks placeholder-page">
      {viewingAs && (
        <div className="login-as-banner" role="status">
          <NoteCard
            tone="accent"
            icon={<MenuEnterIcon />}
            title={`Viewing as ${viewingAs} — close this tab to return`}
            singleLine
          />
        </div>
      )}
      {crumb && (
        <nav className="rvc-crumbs" aria-label="Breadcrumb">
          <button className="rvc-crumb" onClick={crumb.onClick} title={`Back to ${crumb.label}`}>
            {crumb.label}
          </button>
        </nav>
      )}
      <header className="tasks-header">
        <div className="rvc-pagehead">
          <h1 className="tasks-title">Placeholder for {name}</h1>
          <div className="tasks-subtitle">Details of this will be added to the spec</div>
        </div>
      </header>
    </div>
  );
}
