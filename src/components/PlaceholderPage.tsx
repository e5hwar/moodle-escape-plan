/* A page that isn't specced yet (user, 2026-10-06 — Figma list items 81–90):
 * the standard page header only, "Placeholder for <name>" over the subtext
 * "Details of this will be added to the spec". Used by every own-tab page that
 * stands in for something outside this prototype — Public Portfolio, Stripe
 * Invoices, both Login As views, Company Dashboard, View Attempt, Task Preview,
 * Task Brief — and by the crash and not-found screens. */
export function PlaceholderPage({ name }: { name: string }) {
  return (
    <div className="tasks placeholder-page">
      <header className="tasks-header">
        <div className="rvc-pagehead">
          <h1 className="tasks-title">Placeholder for {name}</h1>
          <div className="tasks-subtitle">Details of this will be added to the spec</div>
        </div>
      </header>
    </div>
  );
}
