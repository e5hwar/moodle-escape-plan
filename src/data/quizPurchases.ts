import { users } from "./users";
import type { Task } from "./tasks";
import { isoDaysAgo, applyGrants } from "./certPurchases";

/** State of the purchased attempt. */
export type AttemptStatus = "Not Started" | "In Progress" | "Completed";

/** Passing score for a paid Quiz attempt. */
export const PASS_THRESHOLD = 70;

/**
 * A record of one user buying an extra Quiz attempt. Paid Quizzes sell
 * additional attempts beyond the free allotment; each purchase unlocks a
 * specific attempt number. Generated deterministically per Task.
 */
export type QuizPurchase = {
  userId: string;
  /** Name of the paid Quiz this attempt was bought (or comped) on. Rows now
   * span every paid Quiz, so the page's Quiz filter needs it on the row. */
  quizName: string;
  /** The attempt number this purchase unlocked (free attempts come first). */
  attemptNumber: number;
  /**
   * ISO date (yyyy-mm-dd) the attempt was *paid* for. null for admin grants —
   * comped attempts have no purchase, so this cell is left blank and the grant
   * is recorded on grantDate / grantedBy instead.
   */
  purchaseDate: string | null;
  status: AttemptStatus;
  /** Graded score 0–100, only once the attempt is Completed; null otherwise. */
  score: number | null;
  /** Pass/fail, only once Completed; null otherwise. */
  passed: boolean | null;
  /**
   * ISO date an admin revoked this attempt, if ever. Only a Not-Started attempt
   * can be revoked. Drives the "Revoked" row indicator.
   */
  revokedDate: string | null;
  /** True when an admin comped this attempt instead of the user paying. */
  granted: boolean;
  /** ISO date the admin comped the attempt. Set iff granted; null for paid. */
  grantDate: string | null;
  /** Name of the SkillCat admin who comped the attempt. Set iff granted. */
  grantedBy: string | null;
};

/** FNV-1a — deterministic, seeded by Task + user so rows are stable. */
function phash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build the seed list of attempt purchasers for a paid Quiz. Roughly 45% of
 * users bought an extra attempt, spread across attempt numbers and statuses.
 */
export function buildQuizPurchases(task: Task): QuizPurchase[] {
  const out: QuizPurchase[] = [];

  for (const u of users) {
    const h = phash(`${task.id}:${u.id}`);
    // ~45% of users bought an extra attempt on this Quiz.
    if (h % 100 >= 45) continue;

    // Free attempts come first, so purchased attempts start at #2.
    const attemptNumber = 2 + ((h >>> 3) % 3); // 2, 3, or 4
    const dateIso = isoDaysAgo(8 + ((h >>> 2) % 300));

    // Independent slice of the hash — h % 100 is already constrained to <45 by
    // the purchaser filter above, so reusing it would never yield "Completed".
    const sbucket = (h >>> 9) % 100;
    let status: AttemptStatus;
    if (sbucket < 25) status = "Not Started";
    else if (sbucket < 50) status = "In Progress";
    else status = "Completed";

    let score: number | null = null;
    let passed: boolean | null = null;
    if (status === "Completed") {
      score = 52 + ((h >>> 6) % 48); // 52–99
      passed = score >= PASS_THRESHOLD;
    }

    out.push({
      userId: u.id,
      quizName: task.name,
      attemptNumber,
      purchaseDate: dateIso,
      status,
      score,
      passed,
      revokedDate: null,
      granted: false,
      grantDate: null,
      grantedBy: null,
    });
  }

  // Comp a slice of the attempts — admins hand out free attempts often enough
  // that every paid Quiz has a few on its Who Paid page.
  return applyGrants(out, task.id);
}

/** Every paid Quiz's purchasers in one list — the page opens filtered to the
 * Task it was launched from, but its Quiz filter can widen to the rest. */
export function buildAllQuizPurchases(quizzes: Task[]): QuizPurchase[] {
  return quizzes.flatMap((t) => buildQuizPurchases(t));
}

/** The next free attempt slot for a user on one Quiz — one past their highest
 * existing attempt there, or 2 if they have none (attempt 1 being the free one). */
export function nextAttemptNumber(
  purchases: QuizPurchase[],
  userId: string,
  quizName: string,
): number {
  let max = 1;
  for (const p of purchases) {
    if (p.userId === userId && p.quizName === quizName && p.attemptNumber > max) {
      max = p.attemptNumber;
    }
  }
  return max + 1;
}

/** Build a fresh granted attempt row for the given user. */
export function buildGrantedAttempt(
  userId: string,
  quizName: string,
  attemptNumber: number,
  grantDate: string,
  grantedBy: string,
): QuizPurchase {
  return {
    userId,
    quizName,
    attemptNumber,
    purchaseDate: null,
    status: "Not Started",
    score: null,
    passed: null,
    revokedDate: null,
    granted: true,
    grantDate,
    grantedBy,
  };
}
