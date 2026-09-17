import { type ReactNode } from "react";

/** Modal close glyph — the design's tdesign:close (20px, 2.42 square-capped). */
export const ModalCloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path
      d="M15 5L10 10M10 10L5 15M10 10L15 15M10 10L5 5"
      stroke="currentColor"
      strokeWidth="2.42424"
      strokeLinecap="square"
    />
  </svg>
);

/** The shared confirm-modal shell (Figma 483:588): gradient card, 28px title +
 *  close glyph, and a footer with a plain-text Cancel on the left and the
 *  orange Primary CTA on the right. Used by the proctoring console's confirms
 *  and the Companies page's manage-company pop-ups. */
export function PrmModal({
  title,
  description,
  confirmLabel,
  confirmDisabled,
  confirmHref,
  cancelLabel = "Cancel",
  hideCancel,
  danger,
  wide,
  pick,
  pickWide,
  pickFull,
  className,
  hideFooter,
  onCancel,
  onCancelButton,
  onConfirm,
  children,
}: {
  title: string;
  /** Optional description directly under the title (Figma 667:884 groups them
   *  at a 2px gap, tighter than the body's item spacing). */
  description?: ReactNode;
  /** Required unless `hideFooter` — a footerless modal has nothing to confirm. */
  confirmLabel?: ReactNode;
  confirmDisabled?: boolean;
  /** Renders the CTA as an external link (new tab) instead of a button. */
  confirmHref?: string;
  cancelLabel?: string;
  /** Acknowledgment-only modal — drops the footer's text button so the CTA is
   *  the single way out (besides the close glyph). */
  hideCancel?: boolean;
  /** Destructive confirm — the CTA takes the red variant of the button's own
   *  gradient recipe (Figma 495:2247). */
  danger?: boolean;
  /** A form-carrying modal runs wider than the 640px confirm shell. */
  wide?: boolean;
  /** A table picker — Figma 682:2321's fixed 884px shell, sized to its content
   *  rather than pinned to `wide`'s viewport-height card. */
  pick?: boolean;
  /** The Select Tasks picker only (Figma 682:2321, widened to 1050px on
   *  2026-09-12 for its Industry column). The other pickers stay at the 884px
   *  their own nodes still draw. */
  pickWide?: boolean;
  /** Full-screen picker: the card fills the viewport inside the scrim's 24px
   *  gutter, and its row area grows with it. For a picker whose source list is
   *  thousands of rows deep (Select Questions), where a fixed card spends most
   *  of the screen on nothing. */
  pickFull?: boolean;
  /** Per-modal shell class, for a node whose card is its own width/height
   *  (the Question Bank's bulk-upload screens). */
  className?: string;
  /** Drops the footer entirely — the Bulk Upload picker (Figma 1116:1321)
   *  draws none, because nothing is confirmed until a file has been read. */
  hideFooter?: boolean;
  /** Dismisses the modal — overlay click and the close glyph. */
  onCancel: () => void;
  /** The footer's text button, when it does something other than dismiss
   *  (e.g. "Go back" to a previous step). Defaults to onCancel. */
  onCancelButton?: () => void;
  onConfirm?: () => void;
  /** Optional: a confirm whose whole message is its `description` (Archive
   *  Question) renders no body at all — `.prm-body`'s 20px gap only applies
   *  between items that exist, so the title group is left on its own. */
  children?: ReactNode;
}) {
  return (
    <div className="pr-confirm-overlay" onClick={onCancel}>
      <div
        className={`prm ${wide ? "prm--wide" : ""}${pick ? " prm--pick" : ""}${
          pickWide ? " prm--pick-wide" : ""
        }${pickFull ? " prm--pick-full" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="prm-body">
          <div className="prm-headgroup">
            <div className="prm-head">
              <h2 className="prm-title">{title}</h2>
              <button className="prm-close" onClick={onCancel} aria-label="Close">
                <ModalCloseIcon />
              </button>
            </div>
            {description && <p className="prm-text">{description}</p>}
          </div>
          {children}
        </div>
        {!hideFooter && (
          <div className={`prm-foot${hideCancel ? " prm-foot--solo" : ""}`}>
            {!hideCancel && (
              <button className="prm-cancel" onClick={onCancelButton ?? onCancel}>
                {cancelLabel}
              </button>
            )}
            {confirmHref ? (
              <a
                className={`prm-cta${danger ? " prm-cta--danger" : ""}`}
                href={confirmHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onConfirm}
              >
                {confirmLabel}
              </a>
            ) : (
              <button
                className={`prm-cta${danger ? " prm-cta--danger" : ""}`}
                onClick={onConfirm}
                disabled={confirmDisabled}
              >
                {confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
