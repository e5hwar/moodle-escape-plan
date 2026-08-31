/* Roles & access for SkillCat Admins — rendered as the "Permissions" tab of
   the Product Config page (it has no sidebar entry of its own). */
export function PermissionsSection() {
  return (
    <div className="pc-section">
      <div className="pc-section-head">
        <h2 className="pc-section-title">Permissions</h2>
        <p className="pc-section-desc">Roles &amp; access for SkillCat Admins.</p>
      </div>
      <div className="co-empty-state">
        <span className="co-empty-glyph">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1.6a1 1 0 00-.37.07l-8 3a1 1 0 00-.63.94v6.39c0 5.4 3.78 9.97 8.7 11.79a1 1 0 00.6 0c4.92-1.82 8.7-6.4 8.7-11.8V5.62a1 1 0 00-.63-.93l-8-3A1 1 0 0012 1.6z" />
            <path d="M9.2 12l1.9 1.9 3.9-3.9" />
          </svg>
        </span>
        <div className="co-empty-title">Permissions are coming soon</div>
        <div className="co-empty-sub">
          This tab lets you create roles for SkillCat Admins and configure the
          permissions granted to each one.
        </div>
      </div>
    </div>
  );
}
