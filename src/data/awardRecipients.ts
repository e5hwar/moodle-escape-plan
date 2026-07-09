import { users, type User } from "./users";
import { appearanceSummary, type Award } from "./awards";

/**
 * One user's issued instance of an Award. An Award is minted when the user
 * completes the linked Certification (§12), so each recipient carries a
 * per-user Unique Number + QR code and the date it was issued.
 *
 * Generated deterministically per Award so the recipients page is stable
 * across renders.
 */
export type AwardRecipient = {
  userId: string;
  /** Per-user Unique Number minted at issuance — the public verification id. */
  uniqueNumber: string;
  /** Short verification code shown in place of the QR image in this prototype. */
  qrCode: string;
  /** ISO date (yyyy-mm-dd) the Award was issued to this user. */
  issuedDate: string;
  /** Which appearances this user holds — mirrors the Award's own appearances. */
  appearance: string;
};

/** FNV-1a — deterministic, seeded by Award + user so rows are stable. */
function phash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TODAY = new Date("2026-06-24");

function isoDaysAgo(n: number, from: Date = TODAY): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Build the recipients for an Award — the users who earned it. Popular Awards
 * (higher `holders`) are held by more of the sample user base. The full issued
 * count lives on `award.holders`; this returns the representative sample the
 * prototype can render from its ~30 seed users.
 */
export function buildAwardRecipients(award: Award): AwardRecipient[] {
  const appearance = appearanceSummary(award);
  // Scale how much of the sample base holds this Award to its popularity, so a
  // Platinum EPA Award (thousands of holders) fills the list while a niche one
  // shows only a handful. Clamped to a sensible 25–95% band.
  const share = Math.min(95, Math.max(25, Math.round((award.holders / 5000) * 95)));

  const out: AwardRecipient[] = [];
  for (const u of users) {
    const h = phash(`${award.id}:${u.id}`);
    if (h % 100 >= share) continue;

    // Issued within the last ~14 months, never before the Award was created.
    const issuedDaysAgo = 5 + ((h >>> 3) % 420);
    const serial = String(1000 + ((h >>> 6) % 8999)).padStart(4, "0");

    out.push({
      userId: u.id,
      uniqueNumber: `${award.id}-${serial}`,
      qrCode: `SC-${(h % 0xffffff).toString(16).toUpperCase().padStart(6, "0")}`,
      issuedDate: isoDaysAgo(issuedDaysAgo),
      appearance,
    });
  }

  // Newest issuance first.
  return out.sort((a, b) => (a.issuedDate < b.issuedDate ? 1 : a.issuedDate > b.issuedDate ? -1 : 0));
}

export function recipientUser(r: AwardRecipient, all: User[] = users): User | undefined {
  return all.find((u) => u.id === r.userId);
}
