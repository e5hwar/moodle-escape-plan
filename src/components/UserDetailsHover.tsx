import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RowExternalLinkIcon, CopyIcon } from "./icons";
import { useHoverCard, type HoverPos } from "../hooks/useHoverCard";

/* ── User details hover card (Figma 436:572) ──────────────────────────────────
   Hovering the learner's name in the review console peeks at who they are —
   name, email, phone — without leaving the submission. The header's
   external-link opens their full profile in a new tab; email and phone copy.

   The card is portalled to <body> and measured off the trigger's rect — see
   [useHoverCard] for why it can't live next to the trigger. ── */

const CARD_WIDTH = 260;

export type HoverUser = {
  userId: string;
  userName: string;
  email: string;
  phone: string;
};

/** Wraps whatever renders the user's name (text, a link button) as the hover
 *  trigger — the card is the same wherever it's used. */
export function UserDetailsHover({
  user,
  onOpenProfile,
  children,
}: {
  user: HoverUser;
  onOpenProfile: (userId: string) => void;
  children: React.ReactNode;
}) {
  const { anchorRef, pos, open, close, hold } = useHoverCard({ width: CARD_WIDTH });

  return (
    <>
      <span
        ref={anchorRef}
        className="udh-anchor"
        onMouseEnter={open}
        onMouseLeave={close}
      >
        {children}
      </span>
      {pos && createPortal(
        <UserDetailsCard
          user={user}
          pos={pos}
          onOpenProfile={onOpenProfile}
          onMouseEnter={hold}
          onMouseLeave={close}
        />,
        document.body,
      )}
    </>
  );
}

function UserDetailsCard({
  user,
  pos,
  onOpenProfile,
  onMouseEnter,
  onMouseLeave,
}: {
  user: HoverUser;
  pos: HoverPos;
  onOpenProfile: (userId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <div
      className="udh-card"
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
        <button
          className="udh-icon-btn"
          title="Open full profile in a new tab"
          aria-label="Open full profile in a new tab"
          onClick={() => onOpenProfile(user.userId)}
        >
          <RowExternalLinkIcon />
        </button>
      </div>
      <div className="udh-row">
        <span className="udh-label">Name:</span>
        <span className="udh-value">{user.userName}</span>
      </div>
      <CopyRow label="Email:" value={user.email} />
      <CopyRow label="Phone:" value={user.phone} last />
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
