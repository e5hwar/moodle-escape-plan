import type { Cell } from "./certLookup";
import { sharedStore } from "./sharedStore";

/* ── Manage Completions' applied changes ──
 * The page rebuilds its seeded model (certLookup.buildData) on every visit, so
 * what an admin applies is kept here, over that model: the task cells they
 * changed, and the certification overrides. Shared across tabs — the Full
 * Profile (its own tab) lists a manually awarded Certification's Award. */

/** A manual decision on one person's Certification, keyed `uid_certId`.
 *  "complete" awards it whatever the tasks say. "incomplete" withdraws an
 *  earned one, and holds until the person meets the criteria again — a task
 *  completed after `at` (see certLookup.progress). */
export type CertOverride = {
  state: "complete" | "incomplete";
  at: number;
  by: string;
  /** For the profile's Awards card, which doesn't load the model. */
  certName: string;
  /** ISO day it was decided — the Award's Date Awarded. */
  on: string;
};

export type CompletionsState = {
  /** Changed task cells, keyed `uid_taskId`. */
  cells: Record<string, Cell>;
  certs: Record<string, CertOverride>;
};

export const completionsStore = sharedStore<CompletionsState>("completions", { cells: {}, certs: {} });
export const useCompletions = completionsStore.use;

/** This person's manual certification decisions. */
export function certOverridesOf(uid: string, state = completionsStore.get()): CertOverride[] {
  return Object.entries(state.certs)
    .filter(([k]) => k.startsWith(uid + "_"))
    .map(([, v]) => v);
}
