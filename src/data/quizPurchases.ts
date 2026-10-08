import { users } from "./users";
import type { Task } from "./tasks";
import { isoDaysAgo, grantingAdmin } from "./certPurchases";
import { attemptsTaken, type getAttemptStore } from "./attempts";

/** State of the purchased attempt. */
export type AttemptStatus = "Not Started" | "In Progress" | "Completed";

/** Where a purchase was paid. Company-paid attempts go through Stripe. */
export type PurchasePlatform = "Apple" | "Google" | "Stripe";
export const PURCHASE_PLATFORMS: PurchasePlatform[] = ["Apple", "Google", "Stripe"];

/**
 * One purchased (or comped) attempt on a paid Quiz. Every attempt on a paid
 * Quiz is bought, from attempt 1 on — the price matrix decides which price an
 * attempt was charged at (see {@link priceTier}). A Who Paid row is either an
 * attempt the learner has taken (In Progress / Completed — the same attempt
 * Quiz Attempts lists) or one bought or granted but not started yet.
 */
export type QuizPurchase = {
  /** Stable id — what a revoke is recorded against. */
  id: string;
  userId: string;
  taskId: string;
  /** The Quiz's live name. */
  quizName: string;
  /** The attempt number this purchase unlocked. */
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
  /** Pass/fail, only once Completed and decided; null otherwise. */
  passed: boolean | null;
  /**
   * ISO date the attempt was revoked, if ever — by an admin (only a
   * Not-Started attempt can be), or by a refund. Drives the "Revoked" marker.
   */
  revokedDate: string | null;
  /** True when an admin comped this attempt instead of the user paying. */
  granted: boolean;
  /** ISO date the admin comped the attempt. Set iff granted; null for paid. */
  grantDate: string | null;
  /** Name of the SkillCat admin who comped the attempt. Set iff granted. */
  grantedBy: string | null;
  /** Who paid: "Self" when the learner bought it, else their company's name.
   *  null on a comped attempt. */
  purchaser: string | null;
  /** The store the purchase went through. null on a comped attempt. */
  platform: PurchasePlatform | null;
  /** ISO date the purchase was refunded — a refund revokes the attempt. */
  refundedDate: string | null;
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

const userById = new Map(users.map((u) => [u.id, u]));

/** "May 3, 2026 · 9:42 AM" → "2026-05-03". */
function isoOf(label: string): string {
  const [datePart] = label.split(" · ");
  const d = new Date(`${datePart} 12:00`);
  return Number.isNaN(d.getTime()) ? isoDaysAgo(30) : d.toISOString().slice(0, 10);
}

function minusDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Who paid and where, for one purchase: B2B learners' attempts are often
 *  company-paid (through Stripe); a learner's own purchase goes through the
 *  store they subscribed on, or the app store their hash lands on. */
function payment(key: string, userId: string): { purchaser: string; platform: PurchasePlatform } {
  const u = userById.get(userId);
  const h = phash(`pay:${key}`);
  if (u?.userType === "B2B" && u.companyName && h % 100 < 60) {
    return { purchaser: u.companyName, platform: "Stripe" };
  }
  return { purchaser: "Self", platform: PURCHASE_PLATFORMS[h % 3] };
}

/** A comp, rather than a purchase — about one taken attempt in ten. */
function comped(key: string): string | null {
  const h = phash(`grant:${key}`);
  return h % 100 < 10 ? grantingAdmin(h) : null;
}

type Store = ReturnType<typeof getAttemptStore>;

/**
 * A paid Quiz's Who Paid rows, from the one attempts store: every attempt
 * taken (purchased, or now and then comped), plus attempts bought or granted
 * and not started yet — seeded ones (some since refunded), ones given back by
 * a deleted attempt, and session grants. Unused ones are numbered on from the
 * learner's taken attempts.
 */
export function buildQuizPurchases(task: Task, store: Store): QuizPurchase[] {
  const taken = store.attempts.filter((a) => a.taskId === task.id && a.userId);
  const out: QuizPurchase[] = [];
  const blank = {
    taskId: task.id,
    quizName: task.name,
    revokedDate: null,
    refundedDate: null,
  };

  for (const a of taken) {
    const id = `P-${a.id}`;
    const by = comped(id);
    const bought = minusDays(isoOf(a.startedAt), phash(id) % 4);
    const finished = a.status !== "In Progress";
    out.push({
      ...blank,
      id,
      userId: a.userId!,
      attemptNumber: a.attemptNumber,
      purchaseDate: by ? null : bought,
      status: finished ? "Completed" : "In Progress",
      score: finished ? a.grade : null,
      passed:
        a.status === "Passed" ? true : a.status === "Failed" || a.status === "Rejected" ? false : null,
      granted: !!by,
      grantDate: by ? bought : null,
      grantedBy: by,
      ...(by ? { purchaser: null, platform: null } : payment(id, a.userId!)),
    });
  }

  /* Unused attempts, per learner in date order. */
  const unused: (Omit<QuizPurchase, "attemptNumber"> & { order: string })[] = [];
  for (const userId of new Set(taken.map((a) => a.userId!))) {
    const h = phash(`${task.id}:${userId}:unused`);
    if (h % 100 >= 35) continue;
    const id = `P-${task.id}-${userId}-next`;
    const date = isoDaysAgo(3 + (h % 40));
    // A few of these were refunded — which revokes the attempt.
    const refunded = h % 100 < 9 ? isoDaysAgo(1 + (h % 3)) : null;
    unused.push({
      ...blank,
      id,
      userId,
      purchaseDate: date,
      status: "Not Started",
      score: null,
      passed: null,
      granted: false,
      grantDate: null,
      grantedBy: null,
      ...payment(id, userId),
      refundedDate: refunded,
      revokedDate: refunded,
      order: date,
    });
  }
  for (const a of store.deletedPaid.filter((d) => d.taskId === task.id && d.userId)) {
    const id = `P-${a.id}`;
    const date = minusDays(isoOf(a.startedAt), phash(id) % 4);
    unused.push({
      ...blank,
      id: `${id}-returned`,
      userId: a.userId!,
      purchaseDate: date,
      status: "Not Started",
      score: null,
      passed: null,
      granted: false,
      grantDate: null,
      grantedBy: null,
      ...payment(id, a.userId!),
      order: date,
    });
  }
  for (const g of store.grants.filter((x) => x.taskId === task.id)) {
    for (let i = 0; i < g.count; i++) {
      unused.push({
        ...blank,
        id: `${g.id}-${i}`,
        userId: g.userId,
        purchaseDate: null,
        status: "Not Started",
        score: null,
        passed: null,
        granted: true,
        grantDate: g.date,
        grantedBy: g.by,
        purchaser: null,
        platform: null,
        order: `${g.date}-${i}`,
      });
    }
  }
  unused.sort((a, b) => a.order.localeCompare(b.order));
  const next = new Map<string, number>();
  for (const { order: _order, ...p } of unused) {
    const n = next.get(p.userId) ?? attemptsTaken(store, task.id, p.userId) + 1;
    next.set(p.userId, n + 1);
    out.push({ ...p, attemptNumber: n });
  }

  // Revokes recorded on Who Paid.
  return out.map((p) =>
    store.revoked[p.id] && !p.revokedDate ? { ...p, revokedDate: store.revoked[p.id] } : p,
  );
}

/** Every paid Quiz's purchasers in one list — the page opens filtered to the
 * Task it was launched from, but its Quiz filter can widen to the rest. */
export function buildAllQuizPurchases(quizzes: Task[], store: Store): QuizPurchase[] {
  return quizzes.flatMap((t) => buildQuizPurchases(t, store));
}

/** Which price an attempt was charged at, from the Quiz's price matrix:
 *  "Attempt 2 price", or "All Subsequent Attempts price" past the numbered
 *  columns — or the one price, when every attempt costs the same. */
export function priceTier(task: Pick<Task, "paywallMode" | "paywallAttempts">, attemptNumber: number): string {
  if (task.paywallMode !== "per_attempt") return "Same price for all attempts";
  const numbered = task.paywallAttempts ?? 1;
  return attemptNumber <= numbered
    ? `Attempt ${attemptNumber} price`
    : "All Subsequent Attempts price";
}
