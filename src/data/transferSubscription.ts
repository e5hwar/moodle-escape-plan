/**
 * Transfer Subscription reads the same accounts as Merge Accounts — the live
 * Users roster, in the flows' `MergeUser` shape (see mergeAccounts.ts). Only
 * the subscription moves; `transferSubscription` (users.ts) writes it back.
 */

export type { MergeUser } from "./mergeAccounts";
export { findMergeUser as findUser } from "./mergeAccounts";
