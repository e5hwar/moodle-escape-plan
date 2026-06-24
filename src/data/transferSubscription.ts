/**
 * Demo data for the Transfer Subscription flow.
 *
 * Reuses the learner pool and account shape from the Merge Accounts flow — the
 * two flows share the same account fixtures and the same `sub` (subscription)
 * model. Transfer Subscription only ever moves the subscription from a Source
 * account to a Destination account; neither account is deleted, so no conflict
 * or record-merge fixtures are needed here.
 *
 * All data is demo data. Nothing is persisted.
 */

import { mergeUsers, type MergeUser } from "./mergeAccounts";

export type { MergeUser } from "./mergeAccounts";

// The accounts available to pick from. Shared with the Merge Accounts pool so
// the same familiar names appear in both flows.
export const transferUsers: MergeUser[] = mergeUsers;

export function findUser(id: string | null): MergeUser | null {
  return transferUsers.find((u) => u.id === id) ?? null;
}
