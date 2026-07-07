import { useMemo, useState } from "react";
import skillcatLogo from "../assets/SkillCat-Logo.png";

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

const I = {
  book: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 2h13a1 1 0 011 1v15H6.5a1.5 1.5 0 100 3H20v1a1 1 0 01-1 1H6.5A2.5 2.5 0 014 20.5v-16A2.5 2.5 0 016.5 2H6z" />
    </svg>
  ),
  layers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.55 2.11a1 1 0 01.9 0l9.5 4.75a.5.5 0 010 .9l-9.5 4.75a1 1 0 01-.9 0L2.05 7.76a.5.5 0 010-.9z" />
      <path d="M2.55 11.55a.5.5 0 01.67-.22l8.78 4.4 8.78-4.4a.5.5 0 11.45.9l-9 4.5a1 1 0 01-.9 0l-9-4.5a.5.5 0 01-.22-.68z" />
      <path d="M2.55 16.55a.5.5 0 01.67-.22l8.78 4.4 8.78-4.4a.5.5 0 11.45.9l-9 4.5a1 1 0 01-.9 0l-9-4.5a.5.5 0 01-.22-.68z" />
    </svg>
  ),
  award: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a6 6 0 00-3.36 10.96l-1.13 7.18a.6.6 0 00.91.6L12 18.8l3.58 1.94a.6.6 0 00.91-.6l-1.13-7.18A6 6 0 0012 2z" />
    </svg>
  ),
  message: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3h14a2 2 0 012 2v10a2 2 0 01-2 2H8.41l-4.7 4.7A.6.6 0 013 21.28V5a2 2 0 012-2z" />
    </svg>
  ),
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14.7 2.79l6.5 6.5a1 1 0 010 1.41L11.4 20.5a1 1 0 01-.5.27l-6 1.2a.6.6 0 01-.71-.7l1.2-6a1 1 0 01.27-.5L15.5 5h-4.5a1 1 0 110-2h6.7l-3 .79z" />
      <path d="M2 22l8-2H4v-6z" opacity="0" />
    </svg>
  ),
  hand: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 4.5a2 2 0 014 0v5a.5.5 0 001 0V3.5a2 2 0 014 0v6.5a.5.5 0 001 0V6.5a2 2 0 114 0V16a6 6 0 01-6 6h-2a6 6 0 01-5.66-3.93l-3.13-3.66a2 2 0 012.91-2.74L9 13.2z" />
    </svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1.6a1 1 0 00-.37.07l-8 3a1 1 0 00-.63.94v6.39c0 5.4 3.78 9.97 8.7 11.79a1 1 0 00.6 0c4.92-1.82 8.7-6.4 8.7-11.8V5.62a1 1 0 00-.63-.93l-8-3A1 1 0 0012 1.6z" />
    </svg>
  ),
  spotlight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.7 2.3a1 1 0 00-1.1-.22L2.4 9.55a1 1 0 00.06 1.86l7.4 2.46 2.46 7.4a1 1 0 001.86.06l7.47-18.2a1 1 0 00-.22-1.1.79.79 0 00-.2-.13L21.7 2.3z" />
    </svg>
  ),
  scholarship: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.55 2.6a1 1 0 01.9 0l10 5a.5.5 0 010 .9L21 9.13v6.37a.5.5 0 01-1 0V9.63l-2 1V14a1 1 0 01-.49.86C16.13 15.73 14.16 16.5 12 16.5s-4.13-.77-5.51-1.64A1 1 0 016 14v-3.37L1.55 8.5a.5.5 0 010-.9z" />
    </svg>
  ),
  trialExtension: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm.5 4a.75.75 0 011.5 0v5.69l3.16 2.1a.75.75 0 11-.83 1.25l-3.5-2.34A.75.75 0 0112 12V6z" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="7" r="4" />
      <path d="M1.5 19A4 4 0 015.5 15h7A4 4 0 0116.5 19v1.5a.5.5 0 01-.5.5h-14a.5.5 0 01-.5-.5z" />
      <path d="M16.2 4a4 4 0 010 6 4 4 0 003-3.87 4 4 0 00-3-3.87v1.74z" opacity="0.9" />
      <path d="M18 14.5a4 4 0 014 4V20a.5.5 0 01-.5.5h-3.6a5 5 0 00-.95-3 5.5 5.5 0 00-1.95-1.74A.5.5 0 0116 15.4a4 4 0 012 0z" opacity="0.9" />
    </svg>
  ),
  companies: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 21V7a1 1 0 01.55-.9l7-3.5A1 1 0 0112 3.5V9h7a2 2 0 012 2v10a1 1 0 01-1 1h-7v-4a1 1 0 00-1-1h-2a1 1 0 00-1 1v4H4a1 1 0 01-1-1zM6 9.5h1v1.5H6V9.5zm0 4h1V15H6v-1.5zm0 4h1V19H6v-1.5zm9-3.5h1.5v1.5H15V14zm0 4h1.5v1.5H15V18z" />
    </svg>
  ),
  idCard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <circle cx="8" cy="11" r="2.1" />
      <path d="M13 9.5h5.5M13 13h5.5M4.8 15.4a3.4 3.4 0 016.4 0" />
    </svg>
  ),
  merge: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.6" />
      <circle cx="6" cy="19" r="2.6" />
      <circle cx="18" cy="12" r="2.6" />
      <path d="M8.4 6.2 14 10.6M8.4 17.8 14 13.4" />
    </svg>
  ),
  transfer: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h13M13 4l4 4-4 4" />
      <path d="M20 16H7M11 12l-4 4 4 4" />
    </svg>
  ),
  chevronDown: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevronsLeft: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
    </svg>
  ),
};

type IconKey = keyof typeof I;

type SubItem = { key: string; label: string; navKey?: string };
type LinkItem = { kind: "link"; key: string; label: string; icon: IconKey; navKey?: string; badge?: number | string };
type GroupItem = { kind: "group"; key: string; label: string; icon: IconKey; children: SubItem[] };
type SectionItem = { kind: "section"; label: string };
type NavItem = LinkItem | GroupItem | SectionItem;

const items: NavItem[] = [
  { kind: "section", label: "Content" },
  {
    kind: "group",
    key: "training",
    label: "Training",
    icon: "book",
    children: [
      { key: "tasks", label: "Tasks", navKey: "tasks" },
      { key: "question-bank", label: "Question Bank", navKey: "question-bank" },
      { key: "certifications", label: "Certifications", navKey: "certs" },
    ],
  },
  {
    kind: "group",
    key: "organise",
    label: "Organise",
    icon: "layers",
    children: [
      { key: "industries", label: "Industries" },
    ],
  },
  {
    kind: "group",
    key: "achievements",
    label: "Achievements",
    icon: "award",
    children: [
      { key: "skills", label: "Skills" },
      { key: "awards", label: "Awards" },
    ],
  },
  { kind: "link", key: "feedback", label: "Feedback", icon: "message", navKey: "feedback" },

  { kind: "section", label: "Operations" },
  { kind: "link", key: "content-overrides", label: "Certification Lookup", icon: "edit", navKey: "content-overrides" },
  { kind: "link", key: "review-hands-on", label: "Review Hands-On Tasks", icon: "hand", navKey: "review-hands-on" },
  { kind: "link", key: "proctoring-review", label: "Proctoring Review", icon: "shield", navKey: "proctoring-review", badge: 8 },
  { kind: "link", key: "name-change-requests", label: "Name Change Requests", icon: "idCard", navKey: "name-change-requests" },
  { kind: "link", key: "merge-accounts", label: "Merge Accounts", icon: "merge", navKey: "merge-accounts" },
  { kind: "link", key: "transfer-subscription", label: "Transfer Subscription", icon: "transfer", navKey: "transfer-subscription" },

  { kind: "section", label: "Users" },
  {
    kind: "group",
    key: "users",
    label: "Users",
    icon: "users",
    children: [
      { key: "manage-users", label: "Manage Users", navKey: "manage-users" },
      { key: "scholarship", label: "Scholarship", navKey: "scholarship" },
      { key: "offer-codes", label: "Offer Codes", navKey: "offer-codes" },
    ],
  },
  { kind: "link", key: "manage-companies", label: "Companies", icon: "companies", navKey: "manage-companies" },

  { kind: "section", label: "System" },
  { kind: "link", key: "spotlight", label: "Spotlight", icon: "spotlight" },
  { kind: "link", key: "product-config", label: "Product Config", icon: "edit", navKey: "product-config" },
];

// Map external app keys ("tasks", "certs") to sidebar sub-item keys.
const ACTIVE_MAP: Record<string, string> = {
  tasks: "tasks",
  certs: "certifications",
  "content-links": "content-links",
  "question-bank": "question-bank",
  spotlight: "spotlight",
  scholarship: "scholarship",
  "offer-codes": "offer-codes",
  feedback: "feedback",
  industries: "industries",
};

function findGroupForSubKey(subKey: string): string | undefined {
  for (const item of items) {
    if (item.kind === "group" && item.children.some((c) => c.key === subKey)) {
      return item.key;
    }
  }
  return undefined;
}

type Props = {
  active?: string;
  onNavigate?: (key: string) => void;
};

export function Sidebar({ active = "tasks", onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const activeSubKey = ACTIVE_MAP[active] ?? active;
  const activeGroupKey = useMemo(() => findGroupForSubKey(activeSubKey), [activeSubKey]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroupKey ? { [activeGroupKey]: true } : {}
  );

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubClick(sub: SubItem) {
    if (sub.navKey) onNavigate?.(sub.navKey);
    else onNavigate?.(sub.key);
  }

  const showExpanded = !collapsed || hovered;
  const isOverlay = collapsed && hovered;
  const hostClass = `sidebar-host ${collapsed ? "sidebar-host--narrow" : "sidebar-host--wide"}`;
  const onEnter = () => setHovered(true);
  const onLeave = () => setHovered(false);

  if (!showExpanded) {
    let seenFirstSection = false;
    return (
      <div className={hostClass} onMouseEnter={onEnter} onMouseLeave={onLeave}>
        <aside className="sidebar sidebar--collapsed">
          <div className="sidebar__top-collapsed">
            <button
              className="sidebar__logo-btn"
              aria-label="Expand sidebar"
              onClick={() => setCollapsed(false)}
            >
              <HardHatLogo size={28} />
            </button>
          </div>
          <nav className="sidebar__nav-collapsed">
            {items.map((item, idx) => {
              if (item.kind === "section") {
                if (!seenFirstSection) {
                  seenFirstSection = true;
                  return null;
                }
                return (
                  <div
                    key={`div-${idx}`}
                    className="sidebar__divider-collapsed"
                    aria-hidden="true"
                  />
                );
              }
              const isActive =
                item.kind === "group"
                  ? item.key === activeGroupKey
                  : item.key === activeSubKey;
              return (
                <button
                  key={item.key}
                  className={`sidebar__icon-btn ${isActive ? "is-active" : ""}`}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => {
                    if (item.kind === "group") {
                      setOpenGroups((prev) => ({ ...prev, [item.key]: true }));
                      setCollapsed(false);
                    } else {
                      onNavigate?.(item.key);
                    }
                  }}
                >
                  {I[item.icon]}
                </button>
              );
            })}
          </nav>
        </aside>
      </div>
    );
  }

  return (
    <div className={hostClass} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <aside className={`sidebar sidebar--expanded ${isOverlay ? "sidebar--overlay" : ""}`}>
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <HardHatLogo size={28} />
          </div>
          <button
            className="sidebar__collapse-icon"
            aria-label={collapsed ? "Pin sidebar open" : "Collapse sidebar"}
            onClick={() => {
              if (isOverlay) {
                setCollapsed(false);
              } else {
                setCollapsed(true);
              }
            }}
          >
            {I.chevronsLeft}
          </button>
        </div>
        <nav className="sidebar__nav">
          {items.map((item, idx) => {
            if (item.kind === "section") {
              return (
                <div key={`s-${idx}`} className="sidebar__section">
                  {item.label}
                </div>
              );
            }
            if (item.kind === "group") {
              const isOpen = !!openGroups[item.key];
              const containsActive = item.key === activeGroupKey;
              return (
                <div key={item.key} className="sidebar__group">
                  <button
                    className={`sidebar__link ${containsActive && !isOpen ? "is-active" : ""}`}
                    onClick={() => toggleGroup(item.key)}
                    aria-expanded={isOpen}
                  >
                    <span className="sidebar__link-icon">{I[item.icon]}</span>
                    <span className="sidebar__link-label">{item.label}</span>
                    <span className={`sidebar__link-caret ${isOpen ? "is-open" : ""}`}>
                      {I.chevronDown}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="sidebar__sublist">
                      {item.children.map((sub) => {
                        const isSubActive = sub.key === activeSubKey;
                        return (
                          <button
                            key={sub.key}
                            className={`sidebar__sublink ${isSubActive ? "is-active" : ""}`}
                            onClick={() => handleSubClick(sub)}
                          >
                            <span className="sidebar__sublink-label">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            const isActive = item.key === activeSubKey;
            return (
              <button
                key={item.key}
                className={`sidebar__link ${isActive ? "is-active" : ""}`}
                onClick={() => onNavigate?.(item.navKey ?? item.key)}
              >
                <span className="sidebar__link-icon">{I[item.icon]}</span>
                <span className="sidebar__link-label">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="sidebar__link-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}

export type { IconProps };
