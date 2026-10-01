import { useCallback, useState } from "react";

/* A piece of state that survives a reload: `useState` backed by localStorage.
 * For an admin's own preferences — the first is the Certifications page's
 * "Mark as Done" flags (which Certifications' setup reminders they closed).
 * Storage can be missing or full (private windows, quota), so every read and
 * write is guarded and the hook degrades to plain state. */
export function usePersisted<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* storage unavailable — the value still lives for the session */
        }
        return resolved;
      });
    },
    [key],
  );
  return [value, set];
}
