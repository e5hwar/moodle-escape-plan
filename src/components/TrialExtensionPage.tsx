export function TrialExtensionPage() {
  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Trial Extension</h1>
              <div className="tasks-subtitle">
                Extend the SkillCat trial window for a Company beyond its
                default 14-day allotment.
              </div>
            </div>
          </header>
          <div className="trial-placeholder">
            <div className="trial-placeholder-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </div>
            <h2 className="trial-placeholder-title">Coming soon</h2>
            <p className="trial-placeholder-sub">
              The Trial Extension flow lets Sales and Customer Success pause or
              extend a Company's trial. UI for this is in the works — for now,
              please ping #ops-tools to extend a trial manually.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
