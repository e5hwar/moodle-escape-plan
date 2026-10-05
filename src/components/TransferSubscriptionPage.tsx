import { useEffect, useState, type ReactNode } from "react";
import { findUser, type MergeUser } from "../data/transferSubscription";
import { loginId, renewalLabel, subLabel } from "../data/mergeAccounts";
import {
  AccountPicker,
  CompareTable,
  GhostCompare,
  accountCompareRows,
  useEscape,
} from "./MergeAccountsPage";
import {
  InfoCircleIcon,
  InfoTipIcon,
  SwapRolesIcon,
  WarnTriangleIcon,
} from "./icons";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import { NoteCard } from "./NoteCard";
import { PrmModal } from "./PrmModal";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { TableCard } from "./TableCard";
import { SelectUsersModal } from "./SelectUsersModal";
import { SkeletonOverlay } from "./SkeletonOverlay";
import { useLeaveGuard } from "./LeaveGuard";

/**
 * Transfer Subscription — a one-page wizard for moving an active subscription
 * from one learner account to another. It picks the Source (the account that
 * currently holds the subscription) and the Destination (the account that
 * receives it); the Source must have an active subscription, and a destination
 * that already has its own active plan is flagged because it gets replaced.
 * The comparison table shows what moves, so there is no separate review step:
 * the footer CTA goes straight to a confirmation modal, then back to Manage
 * Users with a toast.
 *
 * Built out of the same parts as Merge Accounts, in the same arrangement — the
 * two admin flows are deliberately one screen with different words:
 *   shell     -> one-page .wizard (no rail, like the Skill / Award forms),
 *                Users breadcrumb, and the ⌘+Enter footer keycap (wizardKeys.tsx)
 *   head      -> title + one-line desc with the long explanation on its ⓘ
 *   accounts  -> AccountPicker fields opening SelectUsersModal (682:2321),
 *                with ⌘K on the empty state and S on the blocking banner
 *   empty     -> the ghost backdrop of the comparison, with what is still
 *                missing asked over it (`.mgf-empty` + GhostCompare)
 *   tables    -> TableCard-titled CompareTables, receiving account on the LEFT
 *   callouts  -> NoteCard (Figma 1121:1671), with a trailing action slot
 *   gating    -> the disabled CTA explains itself on hover (aria-disabled +
 *                data-tip)
 *   confirm   -> PrmModal (danger), then — like a merge — straight back to
 *                Manage Users with a "Subscription Transferred" toast
 * Unlike a merge, neither account is deleted — only the subscription moves.
 * All data is demo data; nothing is persisted.
 */

/* `desc` is the one line the screen needs; `tip` is the longer explanation
   behind the ⓘ beside it — what actually happens to the learner's billing,
   which is the part an admin is accountable for and the part the short line
   can't carry. */
const PAGE = {
  title: "Transfer Subscription",
  desc: "Choose two accounts. The subscription moves from one to the other and nothing else changes hands.",
  tip: "A transfer moves an active plan off one account and onto another. Billing, the renewal date and the remaining term move with it unchanged, and the card on file is re-pointed at the destination. Both accounts survive: the source keeps its completions, certifications, skills, awards and one-time purchases and simply drops to Free. If the destination is already paying for a plan of its own, that one is cancelled and refunded pro-rata before this one applies. Company-billed B2B accounts have no personal plan to move, so they can be neither side.",
};

/** Why a row in the picker can't be chosen here. Company-affiliated accounts
 *  are billed through their company, so there is no personal plan to move. */
function ineligible(u: MergeUser) {
  return u.company ? "B2B accounts aren't eligible for subscription transfer" : undefined;
}

export function TransferSubscriptionPage({
  onClose,
  onTransferred,
}: {
  onClose?: () => void;
  /** A finished transfer leaves the wizard: the caller navigates back to
   *  Manage Users and raises this as its success toast. There is no done
   *  screen — the same hand-off a finished merge makes. */
  onTransferred?: (message: string) => void;
}) {
  const [srcId, setSrcId] = useState<string | null>(null);
  const [dstId, setDstId] = useState<string | null>(null);
  // Both account fields open the same Select Users picker (Figma 682:2321).
  const [showPicker, setShowPicker] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Any account picked asks before Cancel throws the setup away. A confirmed
  // transfer leaves through `onTransferred`, which doesn't consult the guard.
  const guard = useLeaveGuard(!!(srcId || dstId));

  useEscape(showModal, () => setShowModal(false));

  /* ⌘K opens the account picker while the page is still missing a side — the
     shortcut the empty state's CTA advertises. Off once both are picked, and
     off behind the confirm modal and the picker itself. */
  const pickerOpen = showPicker || showModal;
  const needsAccounts = !(srcId && dstId);
  useEffect(() => {
    if (!needsAccounts || pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowPicker(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [needsAccounts, pickerOpen]);

  const src = findUser(srcId);
  const dst = findUser(dstId);
  const both = !!src && !!dst;

  // The Source must hold something worth moving. Only judged once BOTH sides
  // are picked: with one account chosen there is no direction to be wrong yet,
  // so the screen stays quiet rather than raising an alarm about a pairing
  // that does not exist. The same rule Merge's B2B banners follow.
  const noSubToMove = both && !src!.sub.active;
  // Neither account holds a plan — swapping just moves the same problem to the
  // other side, so that case gets no Swap button and no shortcut.
  const neitherHasSub = both && !src!.sub.active && !dst!.sub.active;
  const swappable = noSubToMove && !neitherHasSub;
  // The Destination already paying for its own plan — it will be replaced.
  const dstHasActive = !!(dst && dst.sub.active);

  /* S swaps the direction, the shortcut the blocking banner's button
     advertises — so it is live on exactly the terms that button is, and never
     in the dead-end case, where there is no button. `swapRoles` is hoisted, so
     it is in scope here. */
  useCreateShortcut(swapRoles, swappable && !pickerOpen, "s");

  /* What the empty state asks for depends on which side is still missing —
     one picker serves both, so only the words change. */
  const emptyAsk = !src && !dst
    ? {
        title: "Pick the account to move the plan from, then the one to move it to",
        sub: "The source account holds the subscription today and drops to Free. Its completions, certifications, awards and purchases stay exactly where they are — only the billing moves.",
        cta: "Search Accounts",
      }
    : !dst
    ? {
        title: "Now pick the account to move the plan to",
        sub: "It receives the subscription with its billing, renewal date and remaining term unchanged. Any plan it is already paying for is cancelled and refunded pro-rata first.",
        cta: "Search Accounts",
      }
    : {
        title: "Now pick the account to move the plan from",
        sub: "It has to be on a paid plan today — that plan is what moves. The account itself is untouched and simply drops to Free.",
        cta: "Search Accounts",
      };

  /* Ready once both accounts are set and the source has a plan to move. */
  const accountsReady = both && !noSubToMove;
  /* The greyed-out CTA names the first unmet requirement on hover. */
  const blockedTip = accountsReady
    ? undefined
    : !both
      ? "Select both accounts"
      : neitherHasSub
        ? "Neither account is on a paid plan — replace one of them"
        : "The source account has no active subscription — swap the direction";

  /* The CTA (and ⌘+Enter) is the transfer itself: it opens the confirmation. */
  function advance() {
    if (accountsReady) setShowModal(true);
  }
  useWizardEnterShortcut(advance);

  function pickAccount(set: (id: string | null) => void, id: string | null) {
    set(id);
  }
  /* The picker hands back up to two ids in tick order. An account that already
     held a role keeps it, so re-opening from one field to change the other
     never silently swaps the direction. */
  function applyPicked(ids: string[]) {
    const keepSrc = srcId && ids.includes(srcId) ? srcId : null;
    const keepDst = dstId && ids.includes(dstId) ? dstId : null;
    const fresh = ids.filter((id) => id !== keepSrc && id !== keepDst);
    setSrcId(keepSrc ?? fresh.shift() ?? null);
    setDstId(keepDst ?? fresh.shift() ?? null);
    setShowPicker(false);
  }
  function swapRoles() {
    setSrcId(dstId);
    setDstId(srcId);
  }
  /* No running screen: a confirmed transfer lands straight back on Manage
     Users with its toast. */
  function confirmTransfer() {
    setShowModal(false);
    onTransferred?.("Subscription Transferred");
  }

  /* The card head's own button (Figma 1285:2768) — 24px, so it sits inside the
     head row rather than growing it. */
  const swapButton = (
    <button className="btn-dialog" onClick={swapRoles}>
      <SwapRolesIcon /> Swap Roles
    </button>
  );

  /* The comparison names the DESTINATION first — the same reading as Merge:
     the account that comes out of this holding the plan is on the left. */
  const KEPT = "Destination Account";
  const GONE = "Source Account";

  return (
    <div className="wizard">
      <div className="wizard-body">
        {/* One page, so no step rail — the Skill / Award form shell. */}
        <div className="wizard-main">
          <div className="wizard-content">
            <div className="wizard-paneout">
              <div className="wizard-pane">
          {/* Ancestors only (1415:1354): the page this was opened from. */}
          <nav className="rvc-crumbs" aria-label="Breadcrumb">
            <button className="rvc-crumb" onClick={() => onClose && guard(onClose)} title="Back to Users">
              Users
            </button>
          </nav>
          <div className="rvc-pagehead">
            <h1 className="tasks-title">{PAGE.title}</h1>
          </div>
          <p className="tasks-subtitle wizard-desc">
            {PAGE.desc}
            {/* The long explanation hangs off the subtext as one ⓘ — the app's
                rule for a field's own help, applied to the page's. */}
            <span
              className="form-help-info wizard-desc-info"
              tabIndex={0}
              role="note"
              aria-label={PAGE.tip}
              data-tip={PAGE.tip}
            >
              <InfoTipIcon />
            </span>
          </p>

              {/* Destination first, left to right: the account that ends up
                  holding the plan leads, which is the same order the table
                  below runs in. */}
              <div className="form-row-2 mgf-pickers">
                <div className="form-group">
                  <label className="form-label">
                    Destination Account<span className="req">*</span>
                  </label>
                  <AccountPicker
                    user={dst}
                    placeholder="Search Account to Move To..."
                    onPick={() => setShowPicker(true)}
                    onClear={() => pickAccount(setDstId, null)}
                  />
                  <p className="form-help">The subscription moves onto this account</p>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Source Account<span className="req">*</span>
                  </label>
                  <AccountPicker
                    user={src}
                    placeholder="Search Account to Move From..."
                    onPick={() => setShowPicker(true)}
                    onClear={() => pickAccount(setSrcId, null)}
                  />
                  <p className="form-help">The subscription moves off this account</p>
                </div>
              </div>

              {swappable && src && (
                <NoteCard
                  tone="danger"
                  icon={<WarnTriangleIcon />}
                  className="mgf-note"
                  /* One SemiBold run — the node draws no emphasis inside the
                     line. */
                  title={`${src.name} is not on a paid plan`}
                  body="There is nothing on the source account to transfer. The other account is the one holding a subscription, so the roles are the wrong way round."
                  action={
                    <button className="cta-quiet" onClick={swapRoles}>
                      Swap Roles
                      <span className="cta-kbd">S</span>
                    </button>
                  }
                />
              )}

              {/* The dead end: swapping just moves the same problem to the
                  other side, so this one carries no action — the way out is to
                  change an account, not to rearrange these two. */}
              {neitherHasSub && src && dst && (
                <NoteCard
                  tone="danger"
                  icon={<WarnTriangleIcon />}
                  className="mgf-note"
                  title="Neither account is on a paid plan"
                  body={`${src.name} and ${dst.name} are both on Free, so there is no subscription to move in either direction. Replace one of them with an account that holds a paid plan.`}
                />
              )}

              {accountsReady && dstHasActive && dst && (
                <NoteCard
                  tone="accent"
                  icon={<InfoCircleIcon />}
                  className="mgf-note"
                  title={`${dst.name} already has an active plan (${dst.sub.plan})`}
                  body="It will be cancelled and refunded pro-rata when the transferred subscription is applied."
                />
              )}

              {/* The comparison only means anything once both sides are picked —
                  until then the section holds the backdrop of the tables it is
                  about to load. */}
              {both && src && dst ? (
                <>
                  {/* No swap in the dead end either — rearranging two Free
                      accounts changes nothing about why the transfer can't
                      run. */}
                  <TableCard
                    title="Account Details"
                    trailing={neitherHasSub ? undefined : swapButton}
                    className="mgf-tcard"
                  >
                    <CompareTable
                      keptLabel={KEPT}
                      goneLabel={GONE}
                      /* Nothing is deleted by a transfer, so the source's own
                         details are not struck through the way the deleted
                         account's are in a merge. */
                      rows={accountCompareRows(dst, src, { strike: false })
                        /* The picker refuses B2B accounts, so Company
                           Details could only ever read "—" here. */
                        .filter((r) => r.k !== "Company Details")
                        .flatMap((r) => {
                          if (r.k !== "Subscription") return [r];
                          /* The rows the transfer changes: the source's plan
                             and its renewal arrive on the destination (green
                             ↑, like a merge's "+N") and leave the source,
                             struck. Whatever the destination already holds is
                             replaced, so it reads struck ahead of the new one. */
                          const moving = src.sub.active;
                          const dstRenewal = renewalLabel(dst.sub);
                          const srcRenewal = renewalLabel(src.sub);
                          const was = (v: ReactNode) => <s className="mgf-was">{v}</s>;
                          return [
                            moving
                              ? {
                                  ...r,
                                  a: dst.sub.active ? was(r.a) : null,
                                  gain: subLabel(src.sub),
                                  strikeB: true,
                                }
                              : r,
                            {
                              k: "Renewal Date",
                              a:
                                moving && dstRenewal
                                  ? was(dstRenewal)
                                  : moving && srcRenewal
                                  ? null
                                  : dstRenewal || "—",
                              gain: moving && srcRenewal ? srcRenewal : undefined,
                              b: srcRenewal || "—",
                              strikeB: moving && !!srcRenewal,
                            },
                          ];
                        })}
                    />
                  </TableCard>
                </>
              ) : (
                <>
                  {/* Nothing above the backdrop in this state: no heading (it
                      would sit over a ghost of itself) and no Swap Roles,
                      which only means something once BOTH accounts are picked
                      and so lives on the Account Details card. That also keeps
                      the question below fixed — there is nothing here that can
                      appear and push it down. */}
                  <div className="mgf-empty">
                    <div className="mgf-ghost" aria-hidden="true">
                      {/* The real row count — the five identity rows — so the
                          backdrop is the right shape, title included. */}
                      <span className="mc-ghost-bar mgf-ghost-heading mgf-ghost-heading--first" />
                      <GhostCompare rows={5} />
                    </div>
                    {/* The ⌘K on its button is honest: the page binds ⌘K to
                        this same picker. */}
                    <SkeletonOverlay
                      title={emptyAsk.title}
                      sub={emptyAsk.sub}
                      cta={emptyAsk.cta}
                      onCta={() => setShowPicker(true)}
                    />
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── footer (Figma 73:515, keycap 756:3772) ── */}
      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={() => onClose && guard(onClose)}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {/* `aria-disabled` rather than `disabled`: a disabled button fires no
              mouse events, so it could not show the tooltip that says what is
              still missing. The button is the transfer itself and opens the
              final confirmation. */}
          <button
            className={`btn-publish${accountsReady ? "" : " is-disabled"}`}
            aria-disabled={!accountsReady}
            data-tip={blockedTip}
            onClick={advance}
          >
            Transfer Subscription
            <WizardKeyHint />
          </button>
        </div>
      </footer>

      {showPicker && (
        <SelectUsersModal
          value={[srcId, dstId].filter((id): id is string => !!id)}
          description="You can select both accounts here. The first is the source and the second the destination — the direction can be swapped later."
          ineligible={ineligible}
          onCancel={() => setShowPicker(false)}
          onConfirm={applyPicked}
        />
      )}

      {/* ── confirm (Figma 483:588 + the destructive CTA 495:2247) ── */}
      {showModal && src && dst && (
        <PrmModal
          title="Transfer this subscription?"
          /* Prose, not a summary list: the comparison table behind this
             dialog is where the detail lives. */
          confirmLabel="Yes, transfer subscription"
          danger
          onCancel={() => setShowModal(false)}
          onConfirm={confirmTransfer}
        >
          <p className="prm-content">
            <strong>{src.sub.plan}</strong> moves off <strong>{loginId(src)}</strong> — with its
            billing, renewal date and remaining term — and onto{" "}
            <strong>{loginId(dst)}</strong>.{" "}
            {dstHasActive
              ? `${dst.name}'s ${dst.sub.plan} is cancelled and refunded pro-rata first, and `
              : ""}
            {src.name} drops to Free, keeping every record and purchase on the account.
          </p>
        </PrmModal>
      )}
    </div>
  );
}
