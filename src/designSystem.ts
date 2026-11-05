import { useSyncExternalStore } from "react";

/* Which design system the prototype is drawn in — the Demo Controls panel's
 * "Design System" setting. "play" is the prototype as built (Eshwar's Play
 * Area); "skillcat" is the SkillCat UI library, drawn to Eric's LMS screens
 * (Figma DJoYweP5YPusfzCFDByOFp); "lab" is the experimental Lab look
 * (src/lab-ds.css, specs/lab-ds.md). The choice is a `data-ds` attribute on
 * <html> that src/skillcat-ds.css and src/lab-ds.css key off, plus this store for the few
 * places markup has to differ (the sidebar rail, the date range menu). The
 * React tree is the same either way, so switching keeps the screen, its
 * scroll and anything typed. Survives a reload via localStorage. */

export type DesignSystem = "skillcat" | "play" | "lab";

/* The key carries a version so a stored choice from before the default
 * flipped to SkillCat (2026-11-03) is ignored once, instead of pinning old
 * browsers to the Play Area. */
const KEY = "demo.designSystem.v2";

const DEFAULT: DesignSystem = "skillcat";

function read(): DesignSystem {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "skillcat" || v === "play" || v === "lab") return v;
  } catch {
    /* storage blocked — fall through to the default */
  }
  return DEFAULT;
}

let current: DesignSystem = read();
const listeners = new Set<() => void>();

function apply(ds: DesignSystem) {
  const root = document.documentElement;
  if (ds === "skillcat" || ds === "lab") root.setAttribute("data-ds", ds);
  else root.removeAttribute("data-ds");
}
apply(current);

export function getDesignSystem(): DesignSystem {
  return current;
}

export function setDesignSystem(ds: DesignSystem) {
  if (ds === current) return;
  const from = current;
  current = ds;
  /* The Lab look crossfades in and out over 160ms (src/lab-ds.css, "The
   * switch itself") through a View Transition; a switch between the other two
   * looks stays instant, as before. The attribute scopes the transition's CSS
   * so nothing else in the app picks it up. */
  const root = document.documentElement;
  const crossfade =
    (ds === "lab" || from === "lab") &&
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (crossfade) {
    root.setAttribute("data-ds-switching", "");
    const t = document.startViewTransition(() => apply(ds));
    t.finished.finally(() => root.removeAttribute("data-ds-switching"));
  } else {
    apply(ds);
  }
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

/** Trigger → menu gap for hand-placed menus (row "More" menus, context
 *  menus): the SkillCat DS opens every menu 4 from its control; the other
 *  looks keep their own gap. Read at open time, so a look switch applies on
 *  the next open. */
export function menuGap(fallback = 6): number {
  return getDesignSystem() === "skillcat" ? 4 : fallback;
}
