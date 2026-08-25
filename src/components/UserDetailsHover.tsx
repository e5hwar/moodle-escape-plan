import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RowExternalLinkIcon, CopyIcon, PencilIcon } from "./icons";
import { useHoverCard, type HoverPos } from "../hooks/useHoverCard";

/* ── User details hover card (Figma 436:572) ──────────────────────────────────
   Hovering the learner's name in the review console peeks at who they are —
   name, email, phone — without leaving the submission. The header's
   external-link opens their full profile in a new tab; the name's pencil
   renames them, and email and phone copy.

   The card is portalled to <body> and measured off the trigger's rect — see
   [useHoverCard] for why it can't live next to the trigger.

   Both the trigger and the card carry `data-hover-card`, which suppresses the
   plain hover tooltip inside them (see HoverTooltip.tsx): the card already says
   what a tip would, and a tip would land on top of it. The icon buttons keep
   their aria-labels. ── */

const CARD_WIDTH = 260;
/* The ID card hugs its rows (Figma 679:2039 is 241px around short dates), but
   our stamps carry a time too — this is only the right-edge clamp. */
const ID_CARD_WIDTH = 340;

export type HoverUser = {
  /** Omitted for people who have no Manage Users record (e.g. a company's
   *  account holder, who lives only in the company's data). */
  userId?: string;
  userName: string;
  email: string;
  /** Empty when unknown — the Phone row is dropped, not dashed (Figma 436:572). */
  phone: string;
};

/** When an ID document was uploaded and what has happened to it since. Only
 *  the stamps that exist are shown, so the rows differ per ID status. */
export type IdTimeline = {
  uploadedAt: string;
  reuploadRequestedAt?: string;
  approvedAt?: string;
};

/** ID timeline rows (Figma 679:2039) — the same `.udh-row` label/value pairs
 *  the user-details card is built from, so this is that card with different
 *  contents rather than a second popover component. */
function IdTimelineRows({ timeline }: { timeline: IdTimeline }) {
  const rows: { label: string; value: string }[] = [
    { label: "Uploaded:", value: timeline.uploadedAt },
  ];
  if (timeline.reuploadRequestedAt) {
    rows.push({ label: "Reupload Requested:", value: timeline.reuploadRequestedAt });
  }
  if (timeline.approvedAt) rows.push({ label: "Approved:", value: timeline.approvedAt });

  return (
    <>
      {rows.map((r, i) => (
        <div
          key={r.label}
          className={`udh-row ${i === rows.length - 1 ? "udh-row--last" : ""}`}
        >
          <span className="udh-label">{r.label}</span>
          <span className="udh-value">{r.value}</span>
        </div>
      ))}
    </>
  );
}

/** Hovering an ID's status peeks at its timeline (Figma 679:2039). Same shell,
 *  positioning and portal rules as [UserDetailsHover]; it just carries the
 *  stamp rows on their own. */
export function IdDetailsHover({
  timeline,
  popup = false,
  children,
}: {
  timeline: IdTimeline;
  popup?: boolean;
  children: React.ReactNode;
}) {
  const { anchorRef, pos, open, close, hold } = useHoverCard({ width: ID_CARD_WIDTH });

  return (
    <>
      <span
        ref={anchorRef}
        className="udh-anchor"
        data-hover-card
        onMouseEnter={open}
        onMouseLeave={close}
      >
        {children}
      </span>
      {pos && createPortal(
        <div
          className={`udh-card udh-card--auto${popup ? " udh-card--popup" : ""}`}
          data-hover-card
          role="tooltip"
          style={{
            top: pos.top,
            left: pos.left,
            transform: pos.flip ? "translateY(-100%)" : undefined,
          }}
          onMouseEnter={hold}
          onMouseLeave={close}
          onClick={(e) => e.stopPropagation()}
        >
          <IdTimelineRows timeline={timeline} />
        </div>,
        document.body,
      )}
    </>
  );
}

/** Wraps whatever renders the user's name (text, a link button) as the hover
 *  trigger — the card is the same wherever it's used. */
export function UserDetailsHover({
  user,
  onOpenProfile,
  onRenameUser,
  popup = false,
  children,
}: {
  user: HoverUser;
  /** Opens the full profile from the card's external-link. Omit (or omit
   *  user.userId) and the button isn't shown — same convention as the pencil. */
  onOpenProfile?: (userId: string) => void;
  /** Renames the user from the card's pencil. Omit and the pencil isn't shown —
   *  a screen with nowhere to put the new name shouldn't offer the edit. */
  onRenameUser?: (userId: string, name: string) => void;
  /** Set when the trigger sits on a modal/popup — the card takes the
   *  popup-context surface wash (Figma 668:972) so it still separates. */
  popup?: boolean;
  children: React.ReactNode;
}) {
  const { anchorRef, pos, open, close, hold } = useHoverCard({ width: CARD_WIDTH });
  const [editing, setEditing] = useState(false);

  // The modal is a sibling of the card, not a child: the card unmounts as soon
  // as the pointer leaves it, which is exactly what happens on the way to the
  // modal.
  return (
    <>
      <span
        ref={anchorRef}
        className="udh-anchor"
        data-hover-card
        onMouseEnter={open}
        onMouseLeave={close}
      >
        {children}
      </span>
      {pos && createPortal(
        <UserDetailsCard
          user={user}
          pos={pos}
          popup={popup}
          onOpenProfile={onOpenProfile}
          onEditName={onRenameUser && (() => { setEditing(true); close(); })}
          onMouseEnter={hold}
          onMouseLeave={close}
        />,
        document.body,
      )}
      {editing && createPortal(
        <EditNameModal
          initial={user.userName}
          onCancel={() => setEditing(false)}
          onSave={(name) => {
            if (user.userId != null) onRenameUser?.(user.userId, name);
            setEditing(false);
          }}
        />,
        document.body,
      )}
    </>
  );
}

function UserDetailsCard({
  user,
  pos,
  popup,
  onOpenProfile,
  onEditName,
  onMouseEnter,
  onMouseLeave,
}: {
  user: HoverUser;
  pos: HoverPos;
  popup?: boolean;
  onOpenProfile?: (userId: string) => void;
  onEditName?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className={`udh-card${popup ? " udh-card--popup" : ""}`}
      data-hover-card
      role="tooltip"
      style={{
        top: pos.top,
        left: pos.left,
        transform: pos.flip ? "translateY(-100%)" : undefined,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // The card sits inside a clickable row; a click in it must not open the
      // submission behind it.
      onClick={(e) => e.stopPropagation()}
    >
      <div className="udh-row udh-row--head">
        <span className="udh-label">User Details</span>
        {onOpenProfile && user.userId != null && (
          <button
            className="udh-icon-btn"
            title="Open full profile in a new tab"
            aria-label="Open full profile in a new tab"
            onClick={() => onOpenProfile(user.userId!)}
          >
            <RowExternalLinkIcon />
          </button>
        )}
      </div>
      <div className="udh-row">
        <span className="udh-label">Name:</span>
        <span className="udh-value">{user.userName}</span>
        {onEditName && (
          <button className="udh-icon-btn" aria-label="Edit name" onClick={onEditName}>
            <PencilIcon />
          </button>
        )}
      </div>
      <CopyRow label="Email:" value={user.email} last={!user.phone} />
      {user.phone && <CopyRow label="Phone:" value={user.phone} last />}
    </div>
  );
}

/** The pencil's modal — the app's standard single-field name modal (same shell
 *  as the Question Bank's category rename). */
function EditNameModal({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  const isValid = !!trimmed;

  // Esc closes the modal and stops there. Captured, because everything this
  // card sits in already handles Esc on document/window — the review console
  // exits, the Manage IDs popup closes — and the topmost dialog owns the key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onCancel();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="pm-overlay" onClick={onCancel}>
      <div
        className="pm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit Name"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pm-head">
          <h3 className="pm-title">Edit Name</h3>
          <p className="pm-sub">The name shown on this user&apos;s profile and submissions.</p>
        </div>
        <div className="pm-body">
          <div className="form-group">
            <label className="form-label" htmlFor="udh-edit-name">
              Name <span className="req">*</span>
            </label>
            <input
              id="udh-edit-name"
              autoFocus
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid) onSave(trimmed);
              }}
            />
          </div>
        </div>
        <div className="pm-foot">
          <button className="btn-save-draft" onClick={onCancel}>Cancel</button>
          <button
            className="btn-publish"
            disabled={!isValid}
            onClick={() => isValid && onSave(trimmed)}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/** A value the reviewer usually wants on the clipboard — the icon confirms in
 * place rather than opening a toast over the queue. */
function CopyRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function copy() {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`udh-row ${last ? "udh-row--last" : ""}`}>
      <span className="udh-label">{label}</span>
      <span className="udh-value">{value}</span>
      <button
        className={`udh-icon-btn ${copied ? "is-copied" : ""}`}
        title={copied ? "Copied" : `Copy ${label.replace(":", "").toLowerCase()}`}
        aria-label={`Copy ${label.replace(":", "").toLowerCase()}`}
        onClick={copy}
      >
        <CopyIcon />
      </button>
    </div>
  );
}
