import { users, type User } from "./users";
import type { Certification } from "./certifications";

/**
 * A record of one user's paid (or comped) access to a Certification. Generated
 * deterministically per Certification so the "Who Paid" page is stable across
 * renders, then mutated locally in-session by revoke / grant actions.
 */
export type CertPurchase = {
  userId: string;
  /** Name of the Certification this access was bought (or comped) on. Rows now
   * span every paid Certification, so the page's filter needs it on the row. */
  certName: string;
  /**
   * ISO date (yyyy-mm-dd) the user *paid* for access. null for admin grants —
   * comped users have no purchase, so this cell is left blank and the grant is
   * recorded on grantDate / grantedBy instead.
   */
  purchaseDate: string | null;
  /** Completion progress through the Certification, 0–100. */
  progress: number;
  /** True once the Certification is fully completed (progress === 100). */
  completed: boolean;
  /**
   * Consumables only: the ISO date access ended (consumed, expired, or revoked
   * by an admin). null while access is still active, and always null for
   * non-consumable Certifications.
   */
  accessEndedDate: string | null;
  /**
   * ISO date an admin revoked access, if ever. null while access is live. Drives
   * the "Revoked" row indicator and greys out the Revoke Access menu action.
   */
  revokedDate: string | null;
  /** True when an admin comped access instead of the user paying. */
  granted: boolean;
  /** ISO date the admin comped access. Set iff granted; null for paid users. */
  grantDate: string | null;
  /** Name of the SkillCat admin who comped access. Set iff granted. */
  grantedBy: string | null;
};

/**
 * SkillCat admins who can comp access. Seed grants pick one deterministically;
 * live in-session grants are attributed to the signed-in admin (CURRENT_ADMIN).
 */
export const SKILLCAT_ADMINS = [
  "Priya Nair",
  "Marcus Webb",
  "Elena Ortiz",
  "Darnell King",
  "Sofia Rossi",
  "Andre Coleman",
];

/** The signed-in admin — recorded as the granter for live grants. */
export const CURRENT_ADMIN = "You";

/** FNV-1a — deterministic, seeded by Certification + user so rows are stable. */
function phash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TODAY = new Date("2026-06-24");

export function isoDaysAgo(n: number, from: Date = TODAY): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return TODAY.toISOString().slice(0, 10);
}

export function isConsumableCert(cert: Pick<Certification, "payment">): boolean {
  return cert.payment === "Consumable";
}

/** Whether revoking a consumable Certification resets the user's progress. */
export function consumableResetsProgress(
  cert: Pick<Certification, "payment" | "resetsProgress">,
): boolean {
  return isConsumableCert(cert) && !!cert.resetsProgress;
}

/** Deterministically pick a granting admin from a stable hash. */
export function grantingAdmin(hash: number): string {
  return SKILLCAT_ADMINS[hash % SKILLCAT_ADMINS.length];
}

/** Any purchase row that can be comped — Certification access or a Quiz attempt. */
type Grantable = {
  userId: string;
  purchaseDate: string | null;
  granted: boolean;
  grantDate: string | null;
  grantedBy: string | null;
};

/**
 * Flip a deterministic slice of paid rows into admin grants — roughly a quarter
 * of the list, always at least two and at most five, so every "Who Paid" page
 * shows a few comped users instead of leaving it to a hash bucket that often
 * lands on none. The paid date becomes the grant date, since a comped user
 * never paid.
 */
export function applyGrants<T extends Grantable>(rows: T[], seed: string): T[] {
  const want = Math.min(5, Math.max(2, Math.round(rows.length * 0.25)));
  // Never comp the whole page — there has to be someone who actually paid.
  const n = Math.min(want, Math.max(0, rows.length - 1));
  if (n === 0) return rows;

  // Rank by a grant-specific hash so the chosen users don't correlate with the
  // slices that drive progress, status, or dates.
  const chosen = new Set(
    rows
      .map((r, i) => ({ i, k: phash(`grant:${seed}:${r.userId}`) }))
      .sort((a, b) => a.k - b.k || a.i - b.i)
      .slice(0, n)
      .map((r) => r.i),
  );

  return rows.map((r, i) =>
    chosen.has(i)
      ? {
          ...r,
          purchaseDate: null,
          granted: true,
          grantDate: r.grantDate ?? r.purchaseDate,
          grantedBy: grantingAdmin(phash(`grantedBy:${seed}:${r.userId}`)),
        }
      : r,
  );
}

/**
 * Build the seed list of purchasers for a Certification. Roughly half the user
 * base "bought" it, with a spread of progress, completion, and (for
 * consumables) ended-access states.
 */
export function buildCertPurchases(cert: Certification): CertPurchase[] {
  const consumable = isConsumableCert(cert);
  const out: CertPurchase[] = [];

  for (const u of users) {
    const h = phash(`${cert.id}:${u.id}`);
    // ~55% of users purchased this Certification.
    if (h % 100 >= 55) continue;

    // Note: >>> (unsigned) — a signed >> goes negative for hashes above 2^31.
    const purchasedDaysAgo = 15 + ((h >>> 2) % 320);

    const bucket = h % 100;
    // A third are fully complete; the rest are spread across partial progress.
    const progress = bucket < 32 ? 100 : 5 + ((h >>> 5) % 94);
    const completed = progress === 100;

    // Consumables can have a finished access window once consumed: completed
    // runs, or a deterministic slice that expired.
    let accessEndedDate: string | null = null;
    if (consumable && (completed || h % 5 === 0)) {
      const endedDaysAgo = Math.max(1, purchasedDaysAgo - 10 - (h % 8));
      accessEndedDate = isoDaysAgo(endedDaysAgo);
    }

    out.push({
      userId: u.id,
      certName: cert.name,
      purchaseDate: isoDaysAgo(purchasedDaysAgo),
      progress,
      completed,
      accessEndedDate,
      revokedDate: null,
      granted: false,
      grantDate: null,
      grantedBy: null,
    });
  }

  // Comp a slice of them — grants are common enough that every page has some.
  return applyGrants(out, cert.id);
}

/** Every paid Certification's purchasers in one list — the page opens filtered
 * to the Certification it was launched from, but its filter can widen. */
export function buildAllCertPurchases(certs: Certification[]): CertPurchase[] {
  return certs.flatMap((c) => buildCertPurchases(c));
}

/** Users who don't yet have access to ONE Certification — candidates for its
 * Grant Access flow. Rows now span certs, so the caller passes its cert name. */
export function usersWithoutAccess(
  purchases: CertPurchase[],
  certName: string,
  all: User[] = users,
): User[] {
  const have = new Set(
    purchases.filter((p) => p.certName === certName).map((p) => p.userId),
  );
  return all.filter((u) => !have.has(u.id));
}
