import { users } from "./users";
import type { Task } from "./tasks";
import { isoDaysAgo } from "./certPurchases";

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
  /** The attempt number this purchase unlocked (free attempts come first). */
  attemptNumber: number;
  /** ISO date (yyyy-mm-dd) the attempt was purchased. */
  purchaseDate: string;
  status: AttemptStatus;
  /** Graded score 0–100, only once the attempt is Completed; null otherwise. */
  score: number | null;
  /** Pass/fail, only once Completed; null otherwise. */
  passed: boolean | null;
  /** True when an admin comped this attempt instead of the user paying. */
  granted: boolean;
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
    const purchaseDate = isoDaysAgo(8 + ((h >>> 2) % 300));

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

    // A small deterministic slice were comped rather than paid.
    const granted = h % 19 === 0;

    out.push({ userId: u.id, attemptNumber, purchaseDate, status, score, passed, granted });
  }

  return out;
}

/** The next free attempt slot for a user — one past the highest existing attempt
 * number, or 2 if the user has no purchases yet (attempt 1 being the free one). */
export function nextAttemptNumber(purchases: QuizPurchase[], userId: string): number {
  let max = 1;
  for (const p of purchases) {
    if (p.userId === userId && p.attemptNumber > max) max = p.attemptNumber;
  }
  return max + 1;
}

/** Build a fresh granted attempt row for the given user. */
export function buildGrantedAttempt(
  userId: string,
  attemptNumber: number,
  purchaseDate: string,
): QuizPurchase {
  return {
    userId,
    attemptNumber,
    purchaseDate,
    status: "Not Started",
    score: null,
    passed: null,
    granted: true,
  };
}
