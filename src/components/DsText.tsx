import { useDsText } from "../designSystem";

/* A label written the way the active design system writes it (sentence case
 * under the SkillCat look) — for render functions that live outside a
 * component, like a table column's `render`, where the `useDsText` hook
 * can't be called directly. */
export function DsText({ s }: { s: string }) {
  const t = useDsText();
  return <>{t(s)}</>;
}
