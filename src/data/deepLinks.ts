/* Deep links — the app destinations a URL can open straight into.

   Two kinds: the fixed System pages (listed read-only on Product Config) and
   one per Certification, built from the Certification's slug (spec §19). */

export type SystemDeepLink = { id: string; label: string; url: string; requiresLogin: boolean };

export const SYSTEM_DEEP_LINKS: SystemDeepLink[] = [
  { id: "dl-cert-list", label: "Certification List", url: "skillcat.app/browse", requiresLogin: false },
  { id: "dl-id-reupload", label: "ID Reupload", url: "skillcat.app/reupload-id", requiresLogin: true },
  { id: "dl-verify-cert", label: "Verify Certificate", url: "skillcat.app/verify-certificate", requiresLogin: false },
];

// The host every Certification Deep Link resolves to. Shown as a read-only
// prefix; the string is the one on Figma 699:1071 (the spec's §19.1 draft said
// "skillcat.app/").
export const CERT_DEEP_LINK_BASE = "www.skillcatapp.com/";

// Auto-generate a URL-safe slug from a Certification name (§19.3.5) — keep
// alphanumeric runs, drop everything else, and CamelCase-join the words
// (e.g. "Heat Pump Specialist (2026)" → "HeatPumpSpecialist2026").
export function slugify(name: string): string {
  return name
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .join("");
}
