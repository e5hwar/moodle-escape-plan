import { buildUserProfile, type MeritTier } from "../data/userProfile";
import type { User } from "../data/users";

const TIER_HEX: Record<MeritTier, string> = {
  Bronze: "#cd7f32",
  Silver: "#c4c7cc",
  Gold: "#e9b949",
  Platinum: "#7fd7d2",
};

const TIER_ORDER: Record<MeritTier, number> = {
  Platinum: 0,
  Gold: 1,
  Silver: 2,
  Bronze: 3,
};

function initialsOf(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function PortfolioPage({ user }: { user: User }) {
  const p = buildUserProfile(user);
  const awards = [...p.awards].sort(
    (a, b) => TIER_ORDER[a.meritTier] - TIER_ORDER[b.meritTier],
  );

  return (
    <div className="pf">
      <div className="pf-inner">
        <header className="pf-hero">
          <div className="pf-avatar">{initialsOf(user.name)}</div>
          <h1 className="pf-name">{user.name}</h1>
          <p className="pf-sub">
            {p.fields.industryPreference} · {p.fields.careerStage}
          </p>
          <span className="pf-public">Public Portfolio</span>
        </header>

        <section className="pf-section">
          <h2 className="pf-section-title">Skills</h2>
          <div className="pf-badges">
            {p.skills.map((s) => (
              <span key={s.name} className={`pf-badge ${s.mastery ? "pf-badge--mastery" : ""}`}>
                {s.name}
                {s.mastery && <span className="pf-badge-tag">Mastery</span>}
              </span>
            ))}
          </div>
        </section>

        <section className="pf-section">
          <h2 className="pf-section-title">Awards</h2>
          <div className="pf-awards">
            {awards.map((a) => (
              <div key={a.id} className="pf-award" style={{ borderColor: TIER_HEX[a.meritTier] }}>
                <div className="pf-award-tier" style={{ color: TIER_HEX[a.meritTier] }}>
                  {a.meritTier}
                </div>
                <div className="pf-award-name">{a.certification}</div>
                <div className="pf-award-meta">
                  {formatDate(a.dateAwarded)} · No. {a.awardNumber}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="pf-foot">Verified by SkillCat · skillcat.app</footer>
      </div>
    </div>
  );
}
