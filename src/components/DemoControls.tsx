import { useEffect, useRef, useState, type ReactNode } from "react";
import { setDesignSystem, useDesignSystem, type DesignSystem } from "../designSystem";

/* Prototype states — a small panel for switching the prototype between demo
 * states, opened from a round icon parked at the foot of the sidebar (above
 * the account row). Not part of the product. Its one state today is the
 * Design System (see src/designSystem.ts): both options render the SAME
 * React tree — the screen the admin is on, with everything they have typed —
 * because the switch is only a `data-ds` attribute on <html> that
 * `src/skillcat-ds.css` keys its overrides off, plus the store for the few
 * markup differences. */

const DS_OPTIONS: { key: DesignSystem; label: string }[] = [
  { key: "skillcat", label: "SkillCat Design System" },
  { key: "play", label: "Eshwar's Play Area" },
];

export function DemoControlsRoot({ children }: { children: ReactNode }) {
  const ds = useDesignSystem();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside or Esc closes it, like any other popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node) && !(e.target as Element).closest(".demo-launcher")) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {children}
      <button
        type="button"
        className={`demo-launcher${open ? " is-open" : ""}`}
        aria-label="Prototype states"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <DemoIcon />
      </button>
      {open && (
        <div className="demo-panel" role="dialog" aria-label="Prototype states" ref={panelRef}>
          <div className="demo-head">
            <span className="demo-title">Prototype states</span>
            <span className="demo-sub">Not part of the product.</span>
          </div>
          <div className="demo-group">
            <div className="demo-label">Design system</div>
            <div className="seg-control demo-seg">
              {DS_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className={`seg-btn${ds === o.key ? " active" : ""}`}
                  onClick={() => setDesignSystem(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* A small cube — the "states" glyph on the launcher. */
function DemoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M8 1.75 14 5v6L8 14.25 2 11V5l6-3.25Z" />
      <path d="M2 5l6 3.25L14 5M8 8.25v6" />
    </svg>
  );
}
