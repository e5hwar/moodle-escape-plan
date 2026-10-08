/* Deep links — the app destinations a URL can open straight into.

   Two kinds: the fixed System pages (listed read-only on Product Config) and
   one per Certification, built from the Certification's slug (spec §19).
   Both use the one format, https://skillcat.app/<slug>. */

export type SystemDeepLink = { id: string; label: string; url: string; requiresLogin: boolean };

export const SYSTEM_DEEP_LINKS: SystemDeepLink[] = [
  { id: "dl-cert-list", label: "Certification List", url: "https://skillcat.app/browse", requiresLogin: false },
  { id: "dl-id-reupload", label: "ID Reupload", url: "https://skillcat.app/reupload-id", requiresLogin: true },
  { id: "dl-verify-cert", label: "Verify Certificate", url: "https://skillcat.app/verify-certificate", requiresLogin: false },
];

// The base every Deep Link is built on — a Certification's slug or a System
// page's path follows it. Shown as the read-only prefix on the Certification
// wizard's Deep Link field.
export const CERT_DEEP_LINK_BASE = "https://skillcat.app/";

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

/** A Certification's live Deep Link slug: its stored one, else its name's. */
export function certSlug(c: { slug?: string; name: string }): string {
  return c.slug || slugify(c.name);
}

/** A Certification's full Deep Link. */
export function certDeepLink(c: { slug?: string; name: string }): string {
  return `${CERT_DEEP_LINK_BASE}${certSlug(c)}`;
}
