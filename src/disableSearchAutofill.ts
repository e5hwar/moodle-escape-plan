/**
 * Disable browser autofill on all "search-style" inputs in the app.
 *
 * Chrome/Safari will happily prefill any text input it can pattern-match
 * (address, name, email, phone…), including search bars. That's noise here —
 * an admin search field should never offer the user's saved address.
 *
 * We don't want to touch every page's input declaration, so this runs once
 * at startup, sweeps the DOM, and watches for new inputs via MutationObserver.
 * "Search-style" = type="search", or a text input whose placeholder starts
 * with "Search". Inputs that opt into a specific `autocomplete` attribute are
 * left alone.
 */

const AUTOFILL_BLOCKERS = {
  autocomplete: "off",
  autocorrect: "off",
  autocapitalize: "off",
  spellcheck: "false",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
} as const;

function isSearchInput(el: HTMLInputElement): boolean {
  if (el.type === "search") return true;
  if (el.type !== "text" && el.type !== "") return false;
  const placeholder = (el.placeholder || "").trim().toLowerCase();
  return placeholder.startsWith("search");
}

function harden(el: HTMLInputElement): void {
  if (!isSearchInput(el)) return;
  for (const [attr, value] of Object.entries(AUTOFILL_BLOCKERS)) {
    if (!el.hasAttribute(attr)) el.setAttribute(attr, value);
  }
}

function sweep(root: ParentNode): void {
  root.querySelectorAll?.("input").forEach((el) => harden(el as HTMLInputElement));
}

export function initDisableSearchAutofill(): void {
  sweep(document);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        const el = node as Element;
        if (el.tagName === "INPUT") harden(el as HTMLInputElement);
        sweep(el);
      });
      if (m.type === "attributes" && m.target instanceof HTMLInputElement) {
        harden(m.target);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["placeholder", "type"],
  });
}
