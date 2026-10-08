import { useSyncExternalStore } from "react";

/* ── Session state shared across this app's tabs ──
 * The Full Profile, Login As and the View All Attempts deep links open in
 * tabs of their own (`?profile=…`, `?attemptsUid=…`), so a change made there —
 * a rename, a cancelled plan, an approved ID — has to reach the Users tab that
 * opened it, and the other way round. Each store keeps its value in memory and
 * mirrors it to localStorage; the `storage` event carries a write from one tab
 * to every other one.
 *
 * A plain admin load (no query string) is a fresh session: it drops whatever an
 * earlier session left behind, so a reload starts from the seed the way every
 * other page in the prototype does. A tab with a query string was opened BY an
 * admin tab and reads that tab's state. */
const PREFIX = "moodle-escape:shared:";
const IS_CHILD_TAB = typeof window !== "undefined" && window.location.search.length > 1;

if (typeof window !== "undefined" && !IS_CHILD_TAB) {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable — every tab simply keeps its own state */
  }
}

export type SharedStore<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (l: () => void) => () => void;
  use: () => T;
};

export function sharedStore<T>(name: string, initial: T): SharedStore<T> {
  const key = PREFIX + name;
  let value: T = initial;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) value = JSON.parse(raw) as T;
  } catch {
    /* fall back to the seed */
  }
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      try {
        value = e.newValue ? (JSON.parse(e.newValue) as T) : initial;
      } catch {
        return;
      }
      emit();
    });
  }

  const get = () => value;
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  };
  return {
    get,
    subscribe,
    set(next) {
      value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* in-memory only */
      }
      emit();
    },
    use: () => useSyncExternalStore(subscribe, get),
  };
}

/** Today at local midnight — the one clock every user-facing date counts from
 *  (renewals, trial ends, scholarship expiry). Same as companies' appToday. */
export function todayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** A local date as "YYYY-MM-DD" (never toISOString — UTC can slip a day). */
export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function todayIso(): string {
  return isoOf(todayDate());
}
/** Today ± n days, ISO. */
export function isoDaysFromToday(n: number): string {
  const d = todayDate();
  d.setDate(d.getDate() + n);
  return isoOf(d);
}
/** An ISO date ± n months / years, ISO. */
export function isoAddMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const out = new Date(y, m - 1 + months, d);
  return isoOf(out);
}
