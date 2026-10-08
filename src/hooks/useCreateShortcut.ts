import { useEffect } from "react";

/* Anything open on top of the page — a modal, a confirm, a row's 3-dot menu —
 * owns the keyboard. The page's Create shortcut must not fire through it. */
const OVERLAY_SELECTOR = [
  '[role="dialog"][aria-modal="true"]',
  ".pr-confirm-overlay",
  ".pr-modal-overlay",
  ".ncr-fs-overlay",
  ".u-menu",
].join(", ");

function overlayOpen(): boolean {
  return document.querySelector(OVERLAY_SELECTOR) !== null;
}

/** A modal or confirm is up (row menus aside) — for key handlers that run
 *  while their own menu is open, so they stand down under a dialog. */
export function modalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"], .pr-confirm-overlay, .pr-modal-overlay') !== null;
}

/**
 * Global "C" shortcut for a page's primary Create CTA (Create Task, Create
 * Company, Create Certification, …). Pressing C fires `onCreate`, mirroring the
 * badge shown on the button. Ignored while a modifier is held, focus is in a
 * form field, a modal / confirm / row menu is open, or `enabled` is false
 * (e.g. the create flow is already open).
 *
 * `key` overrides the letter for pages whose badge isn't a C — the quiet
 * header buttons (e.g. Scholarships "S").
 */
export function useCreateShortcut(onCreate: () => void, enabled = true, key = "c") {
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
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
      if (overlayOpen()) return;
      e.preventDefault();
      onCreate();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCreate, enabled, key]);
}
