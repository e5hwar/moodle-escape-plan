import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/* ── List state that outlives the page (spec review 2026-10-09) ──
 * Every list page keeps its search, filters, sort, date range, visible
 * columns, column order and page number for the session: leaving by any
 * route (sidebar, browser Back, a row action, Create) and coming back puts the
 * list exactly as it was. The values live in module memory, so a plain reload
 * — and only that — falls back to the defaults.
 *
 * Drop-in for `useState`: `useListState("skills:sort", DEFAULT_SORT)`. Keys are
 * "<page>:<field>"; a page whose list is scoped to one record (a Who Paid page)
 * puts the record's id in the page part.
 *
 * `fresh`: a deep link that arrives with its own filters (View All Tasks on a
 * Certification, View Employees on a company) starts from `init` and
 * overwrites what was stored. */
const store = new Map<string, unknown>();

export function useListState<T>(
  key: string,
  init: T | (() => T),
  fresh = false,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (!fresh && store.has(key)) return store.get(key) as T;
    const v = typeof init === "function" ? (init as () => T)() : init;
    store.set(key, v);
    return v;
  });
  useEffect(() => {
    store.set(key, value);
  }, [key, value]);
  return [value, setValue];
}

/** Read a stored list value without a hook — for a page that hands its saved
 *  state to a child (or checks whether there is any). */
export function peekListState<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

/** `useEffect(() => setPage(1), deps)` that leaves the mount alone: a
 *  restored page number must survive the page coming back, and only a CHANGE
 *  to the search, filters or sort sends the list back to page 1. Compares the
 *  values rather than counting runs, so StrictMode's double mount is a no-op. */
export function useResetPageOnChange(
  setPage: (p: number) => void,
  deps: readonly unknown[],
) {
  const prev = useRef<readonly unknown[]>(deps);
  useEffect(() => {
    const changed =
      prev.current.length !== deps.length || deps.some((d, i) => !Object.is(d, prev.current[i]));
    prev.current = deps;
    if (changed) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
