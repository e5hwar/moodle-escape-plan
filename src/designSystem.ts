import { useSyncExternalStore } from "react";

/* Which design system the prototype is drawn in — the Demo Controls panel's
 * "Design System" setting. "play" is the prototype as built (Eshwar's Play
 * Area); "skillcat" is the SkillCat UI library, drawn to Eric's LMS screens
 * (Figma DJoYweP5YPusfzCFDByOFp). The choice is a `data-ds` attribute on
 * <html> that src/skillcat-ds.css keys off, plus this store for the few
 * places markup has to differ (the sidebar rail, the date range menu). The
 * React tree is the same either way, so switching keeps the screen, its
 * scroll and anything typed. Survives a reload via localStorage. */

export type DesignSystem = "skillcat" | "play";

/* The key carries a version so a stored choice from before the default
 * flipped to SkillCat (2026-11-03) is ignored once, instead of pinning old
 * browsers to the Play Area. */
const KEY = "demo.designSystem.v2";

const DEFAULT: DesignSystem = "skillcat";

function read(): DesignSystem {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "skillcat" || v === "play") return v;
  } catch {
    /* storage blocked — fall through to the default */
  }
  return DEFAULT;
}

let current: DesignSystem = read();
const listeners = new Set<() => void>();

function apply(ds: DesignSystem) {
  const root = document.documentElement;
  if (ds === "skillcat") root.setAttribute("data-ds", "skillcat");
  else root.removeAttribute("data-ds");
}
apply(current);

export function getDesignSystem(): DesignSystem {
  return current;
}

export function setDesignSystem(ds: DesignSystem) {
  if (ds === current) return;
  current = ds;
  apply(ds);
  try {
    localStorage.setItem(KEY, ds);
  } catch {
    /* storage blocked — the choice just won't survive a reload */
  }
  listeners.forEach((l) => l());
}

export function useDesignSystem(): DesignSystem {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getDesignSystem,
  );
}

/** The label as the active design system writes it. Copy is the same in
 * both looks — the SkillCat look restyles the UI but keeps the Play Area's
 * wording, capitals and "..." exactly (user ruling 2026-11-03). Every label
 * still passes through here, so a deliberate per-look wording change has
 * one place to go. */
export function dsText(_ds: DesignSystem, s: string): string {
  return s;
}

export function useDsText(): (s: string) => string {
  const ds = useDesignSystem();
  return (s: string) => dsText(ds, s);
}
