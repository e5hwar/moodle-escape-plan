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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  ),
  layers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  award: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.5 12.5L17 22l-5-3-5 3 1.5-9.5" />
    </svg>
  ),
  message: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  hand: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11V6a2 2 0 014 0v5" />
      <path d="M13 9V5a2 2 0 014 0v9" />
      <path d="M17 11V7a2 2 0 014 0v9a6 6 0 01-6 6h-2a6 6 0 01-6-6v-1l-3.5-3.5a2 2 0 012.83-2.83L9 11" />
    </svg>
  ),
  shield: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 3v6c0 5-3.5 9.3-8 11-4.5-1.7-8-6-8-11V5l8-3z" />
    </svg>
  ),
  spotlight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
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
type LinkItem = { kind: "link"; key: string; label: string; icon: IconKey; navKey?: string };
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
      { key: "content-links", label: "Content Links" },
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
  { kind: "link", key: "feedback", label: "Feedback", icon: "message" },

  { kind: "section", label: "Operations" },
  { kind: "link", key: "content-overrides", label: "Content Overrides", icon: "edit" },
  { kind: "link", key: "review-hands-on", label: "Review Hands-On Tasks", icon: "hand" },
  { kind: "link", key: "proctoring-review", label: "Proctoring Review", icon: "shield" },

  { kind: "section", label: "System" },
  { kind: "link", key: "spotlight", label: "Spotlight", icon: "spotlight" },
];

// Map external app keys ("tasks", "certs") to sidebar sub-item keys.
const ACTIVE_MAP: Record<string, string> = {
  tasks: "tasks",
  certs: "certifications",
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

  if (collapsed) {
    const iconRow = items.filter(
      (i): i is LinkItem | GroupItem => i.kind === "link" || i.kind === "group"
    );
    return (
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
          {iconRow.map((item) => {
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
    );
  }

  return (
    <aside className="sidebar sidebar--expanded">
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <HardHatLogo size={28} />
        </div>
        <button
          className="sidebar__collapse-icon"
          aria-label="Collapse sidebar"
          onClick={() => setCollapsed(true)}
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
              onClick={() => onNavigate?.(item.key)}
            >
              <span className="sidebar__link-icon">{I[item.icon]}</span>
              <span className="sidebar__link-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export type { IconProps };
