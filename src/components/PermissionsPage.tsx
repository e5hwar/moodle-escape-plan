export function PermissionsPage() {
  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Permissions</h1>
              <div className="tasks-subtitle">
                Roles &amp; access for SkillCat Admins
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="co-empty-state" style={{ marginTop: 16 }}>
                <span className="co-empty-glyph">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1.6a1 1 0 00-.37.07l-8 3a1 1 0 00-.63.94v6.39c0 5.4 3.78 9.97 8.7 11.79a1 1 0 00.6 0c4.92-1.82 8.7-6.4 8.7-11.8V5.62a1 1 0 00-.63-.93l-8-3A1 1 0 0012 1.6z" />
                    <path d="M9.2 12l1.9 1.9 3.9-3.9" />
                  </svg>
                </span>
                <div className="co-empty-title">Permissions are coming soon</div>
                <div className="co-empty-sub">
                  This page lets you create roles for SkillCat Admins and
                  configure the permissions granted to each one.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
