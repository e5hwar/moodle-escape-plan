import { useState } from "react";
import skillcatLogo from "../assets/SkillCat-Logo.png";
import { submissions } from "../data/proctoring";
import { usePendingHandsOnCount } from "../data/reviewSubmissions";
import { isInReview, useLiveSpotlights } from "../data/spotlights";
import { pendingCount, useNameChangeRequests } from "../data/nameChangeRequests";
import { useDesignSystem, useDsText } from "../designSystem";

type IconProps = { className?: string };

const HardHatLogo = ({ size = 28 }: { size?: number }) => (
  <img
    src={skillcatLogo}
    alt="SkillCat"
    width={size}
    height={size}
    style={{ display: "block", objectFit: "contain" }}
  />
);

/* Nav glyphs — Figma 814:2685 / 815:1444. All eight are the same 16px stroked
   line family (1.33 stroke, square caps); each `<g transform>` re-seats the
   exported artwork inside the 16-square the way the Figma frame insets it. */
const I = {
  // "Icon Library" 7:442 — clipboard
  tasks: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
      <g transform="translate(1.667 0)">
        <path d="M4.80533 1.66776C4.93492 1.37026 5.14854 1.11706 5.41997 0.939225C5.6914 0.761394 6.00884 0.666667 6.33333 0.666667C6.65783 0.666667 6.97527 0.761394 7.2467 0.939225C7.51813 1.11706 7.73175 1.37026 7.86133 1.66776H12V14.3344H0.666667V1.66776H4.80533Z" />
        <path d="M3.66667 5.33442H9M3.66667 8.00109H9M3.66667 10.6678H7" />
      </g>
    </svg>
  ),
  // "Icon Library" 7:1179 — certificate card
  certifications: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
      <g transform="translate(0.667 2)">
        <path d="M3.33333 6H6M3.33333 8.66667H11.3333M8.66667 0.666667H11.3333V4.33333L10 3.33333L8.66667 4.33333V0.666667Z" />
        <path d="M14 0.666667V11.3333H0.666667V0.666667H14Z" />
      </g>
    </svg>
  ),
  // "Icon Library" 7:2978 — pencil
  handsOn: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
      <g transform="translate(0.724 0.391)">
        <path d="M2.27614 13.9428L0.942809 12.6095M13.9428 3.94281L10.9428 0.942809L2.60948 9.27614L2.27548 10.6095L4.27614 12.6095L5.60948 12.2761L13.9428 3.94281Z" />
      </g>
    </svg>
  ),
  // "Icon Library" 815:1297 — two people
  users: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
      <path d="M10.6667 13.3333V12.6667C10.6667 11.9594 10.3857 11.2811 9.88562 10.781C9.38552 10.281 8.70724 10 8 10H3.33333C2.62609 10 1.94781 10.281 1.44772 10.781C0.947618 11.2811 0.666667 11.9594 0.666667 12.6667V13.3333M10.3333 7.33333C11.0406 7.33333 11.7189 7.05238 12.219 6.55229C12.719 6.05219 13 5.37391 13 4.66667C13 3.95942 12.719 3.28115 12.219 2.78105C11.7189 2.28095 11.0406 2 10.3333 2M15.3333 13.3333V12.6667C15.3333 11.9594 15.0524 11.2811 14.5523 10.781C14.0522 10.281 13.3739 10 12.6667 10M8.33333 4.66667C8.33333 5.37391 8.05238 6.05219 7.55229 6.55229C7.05219 7.05238 6.37391 7.33333 5.66667 7.33333C4.95942 7.33333 4.28115 7.05238 3.78105 6.55229C3.28095 6.05219 3 5.37391 3 4.66667C3 3.95942 3.28095 3.28115 3.78105 2.78105C4.28115 2.28095 4.95942 2 5.66667 2C6.37391 2 7.05219 2.28095 7.55229 2.78105C8.05238 3.28115 8.33333 3.95942 8.33333 4.66667Z" />
    </svg>
  ),
  // "Icon Library" 7:5039 — bank
  companies: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
      <g transform="translate(1.333 0.57)">
        <path d="M12.6667 14.096H0.666667M2.66667 7.42931V11.4293M6.66667 7.42931V11.4293M10.6667 7.42931V11.4293M0.666667 4.09597V4.76264H12.6667V4.09597L6.66667 0.762639L0.666667 4.09597Z" />
      </g>
    </svg>
  ),
  // "video-camera" 815:1311
  examReviews: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
      <path d="M10.6667 6.79998L15.3333 3.99998V12L10.6667 9.19998V6.79998Z" />
      <path d="M0.666667 3.33333H10.6667V12.6667H0.666667V3.33333Z" />
    </svg>
  ),
  // "Icon Library" 7:2682 — megaphone
  spotlight: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="square">
      <g transform="translate(1.334 1.588)">
        <path d="M0.666667 6.74536V3.07869H4.66667L8.66667 1.07869V8.41202L4.66667 6.74536H0.666667ZM0.666667 6.74536V12.412H2.66667L3.33333 6.74536H0.666667ZM3.23333 9.07869H4.33333M10.8333 4.19136C11.2933 4.65136 11.2933 5.39802 10.8333 5.85802M12.2227 3.07869C13.1427 3.99869 13.1427 6.04736 12.2227 6.96802" />
      </g>
    </svg>
  ),
  // "Icon Set" 1012:14403 — wrench
  productConfig: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.36" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.65193 6.09281H6.89281V3.85193L4.27845 1.23756C5.11477 0.838144 6.05435 0.707823 6.9678 0.864548C7.88126 1.02127 8.72366 1.45733 9.37901 2.11268C10.0344 2.76803 10.4704 3.61044 10.6271 4.52389C10.7839 5.43735 10.6536 6.37693 10.2541 7.21325L14.7359 11.695C15.0331 11.9922 15.2 12.3952 15.2 12.8155C15.2 13.2357 15.0331 13.6387 14.7359 13.9359C14.4387 14.2331 14.0357 14.4 13.6155 14.4C13.1952 14.4 12.7922 14.2331 12.495 13.9359L8.01325 9.45413C7.17693 9.85355 6.23735 9.98387 5.32389 9.82715C4.41044 9.67042 3.56803 9.23436 2.91268 8.57901C2.25733 7.92366 1.82127 7.08126 1.66455 6.1678C1.50782 5.25435 1.63814 4.31477 2.03756 3.47845L4.65193 6.09281Z" />
    </svg>
  ),
  // Figma 421:1450 — the footer collapse control ("tdesign:terminal-window").
  panel: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  ),
};

type IconKey = keyof typeof I;

/* Every badge counts the real queue rather than a hardcoded number, so they
   can't drift from each page's own "Pending:" figure when seed data changes.
   Figma draws them as "99+", so anything past 99 caps the same way. */
const cap = (n: number) => (n > 99 ? "99+" : n);
const pendingExamReviews = cap(submissions.filter((s) => s.status === "pending").length);
/* Hands-On Tasks is the one live badge: reviews are submitted inside this
   session, so it reads the shared review store (`usePendingHandsOnCount`) and
   drops the moment a verdict goes out — see `Sidebar` below. */
/* Spotlights waiting on a decision — the rows the Spotlight page pills
   "In-Review". It reads the live Spotlight list (`useLiveSpotlights`), so an
   approval or rejection drops it at once — see `Sidebar` below. */
/* Name Change Requests are reached from the Users page, so the count of those
   waiting on an admin badges Users — the same figure as that page's banner. It
   reads the live request store (`useNameChangeRequests`), so a decision drops
   it at once — see `Sidebar` below. */

type LinkItem = { key: string; label: string; icon: IconKey; navKey?: string; badge?: number | string };
// Figma 421:1419 — every destination is a top-level entry; sections are plain
// labels, not collapsible groups.
type NavSection = { label?: string; items: LinkItem[] };

// Question Bank and Skills are deliberately absent — Figma 633:1865 moved them
// into the Tasks page header (same move Scholarships made).
// Industries, Awards, and Feedback made the same move onto the Certifications
// page header; the crumb on each page is the way back.
// Manage Completions is absent too: it is only ever reached scoped, from a
// row's "Manage User Progress" action on Tasks, Certifications, Manage Users,
// or Companies — see ContentOverridesPage.
const sections: NavSection[] = [
  {
    label: "Content",
    items: [
      { key: "tasks", label: "Tasks", icon: "tasks", navKey: "tasks" },
      { key: "certifications", label: "Certifications", icon: "certifications", navKey: "certs" },
      // Hands-On Tasks joined Content 2026-08-31 (Figma 814:2685) — the
      // Operations group it used to share with Exam Reviews is gone.
      { key: "review-hands-on", label: "Hands-On Tasks", icon: "handsOn", navKey: "review-hands-on" },
    ],
  },
  {
    label: "Customers",
    items: [
      { key: "manage-users", label: "Users", icon: "users", navKey: "manage-users" },
      { key: "manage-companies", label: "Companies", icon: "companies", navKey: "manage-companies" },
      // Name Change Requests left the rail 2026-08-25 — it's reached from the
      // Manage Users header's "Name Changes" button now (the route stays), and
      // its open count rides on Users above.
      { key: "proctoring-review", label: "Exam Reviews", icon: "examReviews", navKey: "proctoring-review", badge: pendingExamReviews },
    ],
  },
  {
    label: "System",
    items: [
      { key: "spotlight", label: "Spotlight", icon: "spotlight", navKey: "spotlight" },
      { key: "product-config", label: "Product Config", icon: "productConfig", navKey: "product-config" },
    ],
  },
];

// Map external app keys ("certs") to sidebar item keys.
const ACTIVE_MAP: Record<string, string> = {
  tasks: "tasks",
  certs: "certifications",
  "content-links": "content-links",
  "question-bank": "question-bank",
  spotlight: "spotlight",
  feedback: "feedback",
  industries: "industries",
};

type Props = {
  active?: string;
  onNavigate?: (key: string) => void;
};

export function Sidebar({ active = "tasks", onNavigate }: Props) {
  const t = useDsText();
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);
  const dsRail = useDesignSystem() === "skillcat";
  const activeKey = ACTIVE_MAP[active] ?? active;
  const pendingHandsOn = cap(usePendingHandsOnCount());
  // No badge at all once nothing is waiting.
  const pendingNames = pendingCount(useNameChangeRequests());
  const openNameChanges = pendingNames > 0 ? cap(pendingNames) : undefined;
  const inReview = useLiveSpotlights().filter(isInReview).length;
  const spotlightsInReview = inReview > 0 ? cap(inReview) : undefined;
  const badgeOf = (item: LinkItem) =>
    item.key === "review-hands-on"
      ? pendingHandsOn
      : item.key === "manage-users"
      ? openNameChanges
      : item.key === "spotlight"
      ? spotlightsInReview
      : item.badge;

  /* SkillCat DS Sidebar (18945:4167) is its own component: no hover peek —
     only the top-row toggle opens or closes it — and the Figma rows / icon
     buttons, workspace row and Account row. */
  if (dsRail) {
    return (
      <DsSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        activeKey={activeKey}
        badgeOf={badgeOf}
        onNavigate={onNavigate}
        t={t}
      />
    );
  }

  const showExpanded = !collapsed || hovered;
  const isOverlay = collapsed && hovered;
  const hostClass = `sidebar-host ${collapsed ? "sidebar-host--narrow" : "sidebar-host--wide"}`;
  const onEnter = () => setHovered(true);
  const onLeave = () => setHovered(false);

  if (!showExpanded) {
    return (
      <div className={hostClass} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <aside className="sidebar sidebar--collapsed">
          <div className="sidebar__top-collapsed">
            <button
              className="sidebar__logo-btn"
              aria-label="Expand sidebar"
              onClick={() => setCollapsed(false)}
            >
              <HardHatLogo size={33} />
            </button>
          </div>
          <nav className="sidebar__nav-collapsed">
            {sections.map((section, idx) => (
              // Figma 815:1444 draws no divider between collapsed groups — the
              // 58px gap (the expanded label's height plus its gap) is the
              // separator, and it keeps icons aligned across both states.
              <div key={section.label ?? idx} className="sidebar__group-collapsed">
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    className={`sidebar__icon-btn ${item.key === activeKey ? "is-active" : ""}`}
                    aria-label={item.label}
                    title={item.label}
                    onClick={() => onNavigate?.(item.navKey ?? item.key)}
                  >
                    {I[item.icon]}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className="sidebar__footer">
            <button
              className="sidebar__collapse-icon"
              aria-label="Expand sidebar"
              onClick={() => setCollapsed(false)}
            >
              {I.panel}
            </button>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className={hostClass} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <aside className={`sidebar sidebar--expanded ${isOverlay ? "sidebar--overlay" : ""}`}>
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <HardHatLogo size={33} />
          </div>
        </div>
        <nav className="sidebar__nav">
          {sections.map((section, idx) => (
            <div key={section.label ?? idx} className="sidebar__group">
              {section.label && <div className="sidebar__section">{section.label}</div>}
              <div className="sidebar__group-items">
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    className={`sidebar__link ${item.key === activeKey ? "is-active" : ""}`}
                    onClick={() => onNavigate?.(item.navKey ?? item.key)}
                  >
                    <span className="sidebar__link-icon">{I[item.icon]}</span>
                    <span className="sidebar__link-label">{t(item.label)}</span>
                    {badgeOf(item) !== undefined && (
                      <span className="sidebar__link-badge">{badgeOf(item)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar__footer">
          <button
            className="sidebar__collapse-icon"
            aria-label={isOverlay ? "Pin sidebar open" : "Collapse sidebar"}
            onClick={() => setCollapsed(!isOverlay)}
          >
            {I.panel}
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ===== SkillCat DS Sidebar — Figma 18945:4167 (Expanded 18945:3842, Collapsed
   18945:4057). Glyphs below are the DS exports, re-seated in a 16 frame. */
const DsGlyph = {
  // Icon/collapse 17020:1374
  collapse: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="square">
      <path transform="translate(0.668 2.002)" d="M3.33167 0.665H0.665V3.99833V11.3317H3.33167M3.33167 0.665H13.9983V3.99833V11.3317H3.33167M3.33167 0.665V11.3317" />
    </svg>
  ),
  // Icon/user-1-filled outline (Account) — a 1.33 inside stroke via mask
  account: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <mask id="ds-account-mask" fill="white">
        <path d="M4.66659 4.66732C4.66659 3.78326 5.01777 2.93542 5.6429 2.3103C6.26802 1.68517 7.11586 1.33398 7.99992 1.33398C8.88397 1.33398 9.73182 1.68517 10.3569 2.3103C10.9821 2.93542 11.3333 3.78326 11.3333 4.66732C11.3333 5.55137 10.9821 6.39922 10.3569 7.02434C9.73182 7.64946 8.88397 8.00065 7.99992 8.00065C7.11586 8.00065 6.26802 7.64946 5.6429 7.02434C5.01777 6.39922 4.66659 5.55137 4.66659 4.66732ZM2.33325 12.6673C2.33325 11.7833 2.68444 10.9354 3.30956 10.3103C3.93468 9.68517 4.78253 9.33398 5.66658 9.33398H10.3333C10.771 9.33398 11.2044 9.4202 11.6089 9.58772C12.0133 9.75523 12.3807 10.0008 12.6903 10.3103C12.9998 10.6198 13.2453 10.9873 13.4129 11.3917C13.5804 11.7961 13.6666 12.2296 13.6666 12.6673V14.0007H2.33325V12.6673Z" />
      </mask>
      <path stroke="currentColor" strokeWidth="2.66" mask="url(#ds-account-mask)" d="M4.66659 4.66732C4.66659 3.78326 5.01777 2.93542 5.6429 2.3103C6.26802 1.68517 7.11586 1.33398 7.99992 1.33398C8.88397 1.33398 9.73182 1.68517 10.3569 2.3103C10.9821 2.93542 11.3333 3.78326 11.3333 4.66732C11.3333 5.55137 10.9821 6.39922 10.3569 7.02434C9.73182 7.64946 8.88397 8.00065 7.99992 8.00065C7.11586 8.00065 6.26802 7.64946 5.6429 7.02434C5.01777 6.39922 4.66659 5.55137 4.66659 4.66732ZM2.33325 12.6673C2.33325 11.7833 2.68444 10.9354 3.30956 10.3103C3.93468 9.68517 4.78253 9.33398 5.66659 9.33398H10.3333C10.771 9.33398 11.2044 9.4202 11.6089 9.58772C12.0133 9.75523 12.3807 10.0008 12.6903 10.3103C12.9998 10.6198 13.2453 10.9873 13.4129 11.3917C13.5804 11.7961 13.6666 12.2296 13.6666 12.6673V14.0007H2.33325V12.6673Z" />
    </svg>
  ),
  // Icon/chevron-right 17020:65 (Submenu chevron)
  chevron: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M11.668 8.66656L6.33459 14L5.00146 12.6669L9.66834 8L5.00146 3.33312L6.33459 2L11.668 7.33344C11.8448 7.51024 11.9441 7.75 11.9441 8C11.9441 8.25 11.8448 8.48976 11.668 8.66656Z" />
    </svg>
  ),
};

/* Workspace name in the top row and the signed-in admin in the Account row. */
const DS_WORKSPACE = "SkillCat";
const DS_ACCOUNT = "Admin";

type DsProps = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  activeKey: string;
  badgeOf: (item: LinkItem) => number | string | undefined;
  onNavigate?: (key: string) => void;
  t: (s: string) => string;
};

function DsSidebar({ collapsed, setCollapsed, activeKey, badgeOf, onNavigate, t }: DsProps) {
  const go = (item: LinkItem) => onNavigate?.(item.navKey ?? item.key);

  if (collapsed) {
    return (
      <div className="sidebar-host sidebar-host--narrow">
        <aside className="dsb dsb--collapsed">
          <div className="dsb__logo-row">
            <HardHatLogo size={24} />
          </div>
          <div className="dsb__toggle-row">
            <button className="dsb__toggle" aria-label="Expand sidebar" title="Expand sidebar" onClick={() => setCollapsed(false)}>
              {DsGlyph.collapse}
            </button>
          </div>
          <nav className="dsb__icons">
            {sections.map((section, idx) => (
              <div key={section.label ?? idx} className="dsb__icon-group">
                {section.items.map((item) => {
                  const badge = badgeOf(item);
                  const hasBadge = badge !== undefined && badge !== 0;
                  return (
                    <button
                      key={item.key}
                      className={`dsb__icon-btn ${item.key === activeKey ? "is-active" : ""}`}
                      aria-label={hasBadge ? `${item.label} (${badge})` : item.label}
                      title={item.label}
                      onClick={() => go(item)}
                    >
                      {I[item.icon]}
                      {hasBadge && <span className="dsb__dot" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <button className="dsb__icon-btn dsb__account-btn" aria-label={`Account: ${DS_ACCOUNT}`} title={DS_ACCOUNT}>
            {DsGlyph.account}
          </button>
        </aside>
      </div>
    );
  }

  return (
    <div className="sidebar-host sidebar-host--wide">
      <aside className="dsb dsb--expanded">
        <div className="dsb__workspace">
          <HardHatLogo size={24} />
          <span className="dsb__workspace-name">{DS_WORKSPACE}</span>
          <button className="dsb__toggle" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={() => setCollapsed(true)}>
            {DsGlyph.collapse}
          </button>
        </div>
        <nav className="dsb__items">
          {sections.map((section, idx) => (
            <div key={section.label ?? idx} className="dsb__group">
              {section.label && <div className="dsb__section">{t(section.label)}</div>}
              {section.items.map((item) => {
                const badge = badgeOf(item);
                return (
                  <button
                    key={item.key}
                    className={`dsb__row ${item.key === activeKey ? "is-active" : ""}`}
                    onClick={() => go(item)}
                  >
                    <span className="dsb__row-icon">{I[item.icon]}</span>
                    <span className="dsb__row-label">{t(item.label)}</span>
                    {badge !== undefined && badge !== 0 && <span className="dsb__row-count">{badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <button className="dsb__row dsb__account">
          <span className="dsb__row-icon">{DsGlyph.account}</span>
          <span className="dsb__row-label">{DS_ACCOUNT}</span>
          <span className="dsb__row-icon dsb__row-chevron">{DsGlyph.chevron}</span>
        </button>
      </aside>
    </div>
  );
}

export type { IconProps };
