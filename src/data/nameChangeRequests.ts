import { isoDaysFromToday, sharedStore } from "./sharedStore";

/** Where a request stands. "pending" waits on an admin; "awaiting-proof" waits
 *  on the user (Request ID Proof asked them for more) until they upload a new
 *  ID. The rest are final and leave the queue: approved, rejected, or "closed"
 *  — its account was merged away, so there is no one left to rename. */
export type NameChangeStatus = "pending" | "awaiting-proof" | "approved" | "rejected" | "closed";

export type NameChangeEvent = {
  status: NameChangeStatus;
  /** ISO timestamp. */
  at: string;
  /** The admin who moved it; absent on the user's own submission. */
  by?: string;
  /** On an approval: the name the account had before, and the one it got
   *  (the reviewer may have corrected the spelling). */
  from?: string;
  to?: string;
};

/* A request names its user by id only — the current name, email and phone are
   read off the Users roster wherever it is shown, and the ID it is checked
   against is the one on file (manageIds.idRecordForUser). */
export type NameChangeRequest = {
  id: string;
  userId: string;
  requestedName: string;
  /** ISO date the request was submitted. */
  submittedOn: string;
  reason: string;
  status: NameChangeStatus;
  /** Oldest first — the submission, then every status change. */
  history: NameChangeEvent[];
};

/* Only users whose ID has been reviewed and approved can file one (the page's
   subtext says so), and each holds at most one open request. */
const RAW: { userId: string; requestedName: string; daysAgo: number; reason: string }[] = [
  { userId: "U-10089", requestedName: "Priya Iyer", daysAgo: 3, reason: "Marriage" },
  { userId: "U-10291", requestedName: "Ty Booker", daysAgo: 5, reason: "Preferred name" },
  { userId: "U-10491", requestedName: "Naomi Tanaka", daysAgo: 6, reason: "Marriage" },
  { userId: "U-10618", requestedName: "Felix Beck", daysAgo: 8, reason: "Legal name change" },
  { userId: "U-10903", requestedName: "Chloe Bennett-Reyes", daysAgo: 9, reason: "Marriage" },
  { userId: "U-10655", requestedName: "Olivia Nguyen", daysAgo: 14, reason: "Marriage" },
];

const SEED: NameChangeRequest[] = RAW.map((r, i) => {
  const submittedOn = isoDaysFromToday(-r.daysAgo);
  return {
    id: `NCR-${1840 - i * 6}`,
    userId: r.userId,
    requestedName: r.requestedName,
    submittedOn,
    reason: r.reason,
    status: "pending",
    history: [{ status: "pending", at: `${submittedOn}T09:00:00` }],
  };
});

/** Every request, decided ones included (their history stays). Shared across
 *  tabs — the Users badge in a profile tab's sidebar reads it too. */
export const nameChangeStore = sharedStore<NameChangeRequest[]>("nameChanges", SEED);
export const useNameChangeRequests = nameChangeStore.use;

/** Still in the queue — waiting on an admin or on the user's proof. */
export function isOpen(r: NameChangeRequest): boolean {
  return r.status === "pending" || r.status === "awaiting-proof";
}
/** Waiting on an admin — what the Users banner, title note and sidebar badge
 *  count. One awaiting proof is waiting on the user instead. */
export function pendingCount(list: NameChangeRequest[]): number {
  return list.filter((r) => r.status === "pending").length;
}

/** Moves a request on and records who did it. */
export function setNameChangeStatus(
  id: string,
  status: Exclude<NameChangeStatus, "pending">,
  by: string,
  rename?: { from: string; to: string },
): void {
  const at = new Date().toISOString();
  nameChangeStore.set((list) =>
    list.map((r) =>
      r.id === id ? { ...r, status, history: [...r.history, { status, at, by, ...rename }] } : r,
    ),
  );
}

/** The user uploaded a new ID: anything waiting on their proof goes back to
 *  the reviewers. */
export function proofReceived(userId: string): void {
  const at = new Date().toISOString();
  if (!nameChangeStore.get().some((r) => r.userId === userId && r.status === "awaiting-proof")) return;
  nameChangeStore.set((list) =>
    list.map((r) =>
      r.userId === userId && r.status === "awaiting-proof"
        ? { ...r, status: "pending", history: [...r.history, { status: "pending", at }] }
        : r,
    ),
  );
}

/** Closes every open request of an account that no longer exists (merged
 *  into another one). */
export function closeRequestsOf(userId: string, by: string): void {
  const at = new Date().toISOString();
  nameChangeStore.set((list) =>
    list.map((r) =>
      r.userId === userId && isOpen(r)
        ? { ...r, status: "closed", history: [...r.history, { status: "closed", at, by }] }
        : r,
    ),
  );
}

/** picsum portrait URL for the ID photo. */
export function idPhotoUrl(seed: string, w = 300, h = 380): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}
