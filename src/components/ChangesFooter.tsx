import { useEffect, useRef, useState } from "react";
import { ChangeArrowIcon, SmallCloseIcon } from "./icons";
import { WizardKeyHint } from "./wizardKeys";

/* The staged-changes save bar, shared by every page that holds edits until a
   confirm: Manage User Progress (its origin — Figma 1155:1140) and the
   Industries reorders. Left: "N Changes Made", which opens a card on hover
   listing each change as `subject → action`, every row droppable on its own.
   Right: Discard + Review & Save, the latter also on ⌘↵ / Ctrl+↵. The page
   owns the confirm dialog (`ChangesReviewList` is its body) and the apply.

   The bar is the Spotlights `.sp-save-footer`; the card keeps its `.mc-*`
   class names from the page it was first drawn for. */

export type StagedChange = {
  key: string;
  /** What the change is about — "Samuel Okafor · EPA 608 Type I", "Electrical". */
  subject: string;
  /** What happens to it — "Mark as Complete", "Moved from 3 to 1". */
  action: string;
  /** Drops this one change, leaving the rest staged. */
  onDrop: () => void;
};

export function ChangesFooter({
  changes,
  onDiscard,
  onReview,
  shortcutEnabled = true,
}: {
  changes: StagedChange[];
  onDiscard: () => void;
  onReview: () => void;
  /** Off while the page has a modal up — that dialog has its own confirm. */
  shortcutEnabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const count = changes.length;

  /* ⌘↵ opens Review & Save, the keys the Hands-On review console puts on its
     Submit — which is why the CTA wears the keycaps. Held in a ref so the
     listener binds once and still sees current props. */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
    if (!shortcutEnabled || count === 0) return;
    e.preventDefault();
    onReview();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (count === 0) return null;

  return (
    <footer className="sp-save-footer">
      <div
        className="sp-save-footer-text mc-changes"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {count} {count === 1 ? "Change" : "Changes"} Made
        {open && (
          /* The pop wrapper carries the gap as PADDING, so the pointer never
             crosses dead space on its way into the card. */
          <div className="mc-changes-pop">
            <div className="mc-changes-card">
              {changes.map((c) => (
                <div className="mc-change-row" key={c.key}>
                  <span className="mc-change-text">
                    <span>{c.subject}</span>
                    <ChangeArrowIcon />
                    <span>{c.action}</span>
                  </span>
                  <button
                    className="mc-change-drop"
                    aria-label={`Discard: ${c.subject}`}
                    onClick={c.onDrop}
                  >
                    <SmallCloseIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="sp-save-footer-actions">
        <button className="btn-save-draft" onClick={onDiscard}>
          Discard
        </button>
        <button className="btn-publish" onClick={onReview}>
          Review &amp; Save
          <WizardKeyHint />
        </button>
      </div>
    </footer>
  );
}

/** The confirm dialog's body: the same `subject → action` lines, stacked. */
export function ChangesReviewList({ changes }: { changes: StagedChange[] }) {
  return (
    <div className="mc-review-list">
      {changes.map((c) => (
        <div className="mc-review-item" key={c.key}>
          {c.subject}
          <ChangeArrowIcon />
          {c.action}
        </div>
      ))}
    </div>
  );
}
