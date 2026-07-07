import { useEffect } from "react";

/**
 * Global "C" shortcut for a page's primary Create CTA (Create Task, Create
 * Company, Create Certification, …). Pressing C fires `onCreate`, mirroring the
 * badge shown on the button. Ignored while a modifier is held, focus is in a
 * form field, or `enabled` is false (e.g. the create flow is already open).
 */
export function useCreateShortcut(onCreate: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== "c") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      onCreate();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCreate, enabled]);
}
