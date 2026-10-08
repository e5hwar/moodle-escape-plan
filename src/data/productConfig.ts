import { useSyncExternalStore } from "react";

// B2B Management fields configured under Product Config. These are the source
// of truth for the Trade and Partnership options surfaced elsewhere in the
// admin — e.g. the "Content Tags for Visibility" picker on a Certification.
export const DEFAULT_PARTNERSHIPS = [
  "Preferred Partner", "Elite Partner", "NGO Partner",
  "NexStar", "National Account", "Channel Partner",
];

export const DEFAULT_TRADES = [
  "Residential HVAC", "Commercial HVAC",
  "Residential Plumbing", "Commercial Plumbing",
  "MultiFamily Maintenance", "Hotel Maintenance",
];

// Reasons an admin can pick when cancelling a B2B subscription.
export const DEFAULT_CANCELLATION_REASONS = [
  "Too expensive",
  "Not enough content for our industry",
  "Switching to a competitor",
  "Company restructuring / budget cut",
  "Low user adoption",
  "Missing features we need",
];

export const DEFAULT_B2B_TRIAL_DAYS = 14;

/* The SAVED B2B Management lists, live. Product Config writes here on Save
   Changes; the Company wizard (Industries = the Trade list, Partnership, Free
   Trial length), the Cancel Subscription dialog and the Companies filters read
   it through useB2BConfig, so a value added there shows up everywhere without
   a reload. Module state, like the rest of the prototype's session data. */
export type B2BConfig = {
  trades: string[];
  partnerships: string[];
  cancelReasons: string[];
  trialDays: number;
};

let b2bConfig: B2BConfig = {
  trades: DEFAULT_TRADES,
  partnerships: DEFAULT_PARTNERSHIPS,
  cancelReasons: DEFAULT_CANCELLATION_REASONS,
  trialDays: DEFAULT_B2B_TRIAL_DAYS,
};
const listeners = new Set<() => void>();

export function getB2BConfig(): B2BConfig {
  return b2bConfig;
}

export function setB2BConfig(patch: Partial<B2BConfig>) {
  b2bConfig = { ...b2bConfig, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeB2BConfig(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useB2BConfig(): B2BConfig {
  return useSyncExternalStore(subscribeB2BConfig, getB2BConfig);
}
