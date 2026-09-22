import { useEffect, useState } from "react";
import { findUser, type MergeUser } from "../data/transferSubscription";
import {
  AccountPicker,
  CompareTable,
  FlowProcessing,
  FlowStrip,
  GhostCompare,
  accountCompareRows,
  useEscape,
} from "./MergeAccountsPage";
import {
  InfoCircleIcon,
  InfoTipIcon,
  KeyCommandIcon,
  SwapRolesIcon,
  WarnTriangleIcon,
} from "./icons";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import { NoteCard } from "./NoteCard";
import { PrmModal } from "./PrmModal";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { TableCard } from "./TableCard";
import { SelectUsersModal } from "./SelectUsersModal";

/**
 * Transfer Subscription — a two-step wizard for moving an active subscription
 * from one learner account to another. Step 1 picks the Source (the account
 * that currently holds the subscription) and the Destination (the account that
 * receives it); the Source must have an active subscription, and a destination
 * that already has its own active plan is flagged because it gets replaced.
 * Step 2 is a read-only review, gated behind a final confirmation modal, after
 * which the transfer "runs" and the flow hands back to Manage Users.
 *
 * Built out of the same parts as Merge Accounts, in the same arrangement — the
 * two admin flows are deliberately one screen with different words:
 *   shell     -> .wizard-nav rail + .wizard-main behind the edge-line gate
 *                (wizardGate.tsx) and the ⌘+Enter footer keycap (wizardKeys.tsx)
 *   step head -> title + one-line desc with the long explanation on its ⓘ
 *   accounts  -> AccountPicker fields opening SelectUsersModal (682:2321),
 *                with ⌘K on the empty state and S on the blocking banner
 *   empty     -> the ghost backdrop of the comparison, with what is still
 *                missing asked over it (`.mgf-empty` + GhostCompare)
 *   tables    -> TableCard-titled CompareTables, receiving account on the LEFT
 *   callouts  -> NoteCard (Figma 1121:1671), with a trailing action slot — on
 *                step 1 only: the review says everything in its table, so a
 *                run of notes restating it under the same numbers was cut
 *   gating    -> the disabled CTA explains itself on hover (aria-disabled +
 *                data-tip); the rail locks steps not yet reached
 *   confirm   -> PrmModal (danger), then FlowProcessing — and, like a merge,
 *                no result screen: the flow hands back to Manage Users, which
 *                says what happened
 * Unlike a merge, neither account is deleted — only the subscription moves.
 * All data is demo data; nothing is persisted.
 */

/* There is no "done": the run hands off to the caller and this page goes. */
type Phase = "idle" | "processing";

/* Each step's `desc` is the one line the screen needs; `tip` is the longer
   explanation behind the ⓘ beside it — what actually happens to the learner's
   billing, which is the part an admin is accountable for and the part the
   short line can't carry. */
const STEPS = [
  {
    id: "accounts",
    label: "Accounts",
    title: "Choose Accounts to Transfer",
    desc: "Choose two accounts. The subscription moves from one to the other and nothing else changes hands.",
    tip: "A transfer moves an active plan off one account and onto another. Billing, the renewal date and the remaining term move with it unchanged, and the card on file is re-pointed at the destination. Both accounts survive: the source keeps its completions, certifications, skills, awards and one-time purchases and simply drops to Free. If the destination is already paying for a plan of its own, that one is cancelled and refunded pro-rata before this one applies. Company-billed B2B accounts have no personal plan to move, so they can be neither side.",
  },
  {
    id: "review",
    label: "Review",
    title: "Review the transfer",
    desc: "A preview of everything that will happen. Nothing has changed yet — confirm on the next step to run the transfer.",
    tip: "Nothing has been written yet. The transfer runs only once you confirm in the dialog after this step. Any plan it replaces is cancelled and refunded at that point, and an audit-log entry is written naming both accounts, the plan that moved and anything that was cancelled.",
  },
];
const LAST = STEPS.length - 1;

/** How long the "running…" screen is held before the result. Demo timing. */
const RUN_MS = 1700;

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
  const [step, setStep] = useState(0);
  // Furthest step reached — the rail is navigable up to here, so stepping Back
  // does not re-lock the step already answered. Follows `step` upward; only an
  // account change on step 1 pulls it back down.
  const [maxStep, setMaxStep] = useState(0);
  const [srcId, setSrcId] = useState<string | null>(null);
  const [dstId, setDstId] = useState<string | null>(null);
  // Both account fields open the same Select Users picker (Figma 682:2321).
  const [showPicker, setShowPicker] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  /* The run itself: being in "processing" is what arms the hand-off.
     Deliberately an effect keyed on the phase, NOT a timeout stashed in a ref
     at click time. A ref'd timer is cleared by the cleanup that runs on every
     hot reload and on StrictMode's second mount, and since nothing but that
     timer can leave "processing" — the screen has no buttons — losing it
     strands the flow on a spinner for good. Re-running this effect re-arms it. */
  useEffect(() => {
    if (phase !== "processing") return;
    const t = setTimeout(() => {
      onTransferred?.(
        src && dst
          ? `Subscription transferred — ${src.sub.plan} moved from ${src.email} to ${dst.email}`
          : "Subscription transferred",
      );
    }, RUN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  useEffect(() => { setMaxStep((m) => Math.max(m, step)); }, [step]);
  useEscape(showModal, () => setShowModal(false));

  /* ⌘K opens the account picker while step 1 is still missing a side — the
     shortcut the empty state's CTA advertises. Off once both are picked, and
     off behind the confirm modal and the picker itself. */
  const pickerOpen = showPicker || showModal;
  const needsAccounts = step === 0 && !(srcId && dstId);
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
  useCreateShortcut(swapRoles, step === 0 && swappable && !pickerOpen, "s");

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

  /* Step 1 is cleared once both accounts are set and the source has a plan to
     move; the review step has nothing to show before that. */
  const accountsReady = both && !noSubToMove;
  const isLast = step === LAST;
  const cont = isLast || accountsReady;
  /* The greyed-out Continue names the first unmet requirement on hover. */
  const blockedTip = cont
    ? undefined
    : !both
      ? "Select both accounts"
      : neitherHasSub
        ? "Neither account is on a paid plan — replace one of them"
        : "The source account has no active subscription — swap the direction";

  const gate = useEdgeLineGate({ step, setStep, lastStep: LAST, canGoNext: cont });
  const stepStatuses = useWizardStepStatuses({
    step,
    count: STEPS.length,
    incomplete: (i) => i === 0 && !accountsReady,
  });

  function advance() {
    if (!cont) return;
    if (step < LAST) gate.goStep(step + 1);
    else setShowModal(true);
  }
  useWizardEnterShortcut(advance);

  /* Changing either account invalidates the review downstream, so the rail's
     reach collapses back to this step. */
  function pickAccount(set: (id: string | null) => void, id: string | null) {
    set(id);
    setMaxStep(0);
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
    setMaxStep(0);
    setShowPicker(false);
  }
  function swapRoles() {
    setSrcId(dstId);
    setDstId(srcId);
    setMaxStep(0);
  }
  function confirmTransfer() {
    setShowModal(false);
    setPhase("processing");
  }

  if (phase === "processing") {
    return (
      <FlowProcessing
        title="Transferring subscription…"
        sub="Cancelling any replaced plan, moving billing and renewal to the destination account."
      />
    );
  }
  /* The card head's own button (Figma 1285:2768) — 24px, so it sits inside the
     head row rather than growing it. */
  const swapButton = (
    <button className="btn-dialog" onClick={swapRoles}>
      <SwapRolesIcon /> Swap Roles
    </button>
  );

  /* Both comparison tables name the DESTINATION first. That is the same
     reading as Merge (the account that comes out of this holding everything is
     on the left) and as the review's flow card, whose arrow points left into
     the account that receives. */
  const KEPT = "Destination Account";
  const GONE = "Source Account";

  return (
    <div className="wizard">
      <div className="wizard-body">
        {/* ── left rail (Figma 625:1459) ── */}
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">Admin</span>
            <span className="wizard-brand-name">Transfer Subscription</span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((x, i) => {
              // Steps not yet reached stay locked — jumping ahead would skip
              // the one decision the flow has.
              const locked = i > maxStep;
              return (
                <li
                  key={x.id}
                  className={`wizard-step ${stepStatuses[i]}${locked ? " is-locked" : ""}`}
                  onClick={locked ? undefined : () => gate.goStep(i)}
                >
                  <WizardStepRail status={stepStatuses[i]} num={i + 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{x.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* ── content, behind the shared edge-line gate ── */}
        <div className="wizard-main">
          <WizardGateEdges
            gate={gate}
            step={step}
            lastStep={LAST}
            labels={STEPS.map((x) => x.label)}
          />
          <div className="wizard-content" ref={gate.scrollRef}>
            <div className="wizard-paneout" ref={gate.paneOutRef}>
              <div className="wizard-pane" key={step}>
          <h1 className="wizard-title">{STEPS[step].title}</h1>
          <p className="wizard-desc">
            {STEPS[step].desc}
            {/* The step's long explanation hangs off the subtext as one ⓘ —
                the app's rule for a field's own help, applied to the page's. */}
            <span
              className="form-help-info wizard-desc-info"
              tabIndex={0}
              role="note"
              aria-label={STEPS[step].tip}
              data-tip={STEPS[step].tip}
            >
              <InfoTipIcon />
            </span>
          </p>

          {/* ───────────── STEP 1 — Accounts ───────────── */}
          {step === 0 && (
            <>
              {/* Destination first, left to right: the account that ends up
                  holding the plan leads, which is the same order the tables
                  below run in (and the review's arrow points the same way). */}
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
                      rows={accountCompareRows(dst, src, { strike: false })}
                    />
                  </TableCard>

                  <TableCard title="Current Subscription" className="mgf-tcard">
                    <CompareTable
                      keptLabel={KEPT}
                      goneLabel={GONE}
                      /* Neither side is "the kept one" here — this is what the
                         two accounts hold TODAY, before anything moves. */
                      emphasis="none"
                      rows={[
                        { k: "Plan", a: dst.sub.plan, b: src.sub.plan },
                        { k: "Status", a: dst.sub.detail, b: src.sub.detail },
                        { k: "Price", a: dst.sub.price, b: src.sub.price },
                      ]}
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
                      {/* The real row counts — six identity rows, then the
                          three subscription ones — so the backdrop is the
                          right shape, both titles included. */}
                      <span className="mc-ghost-bar mgf-ghost-heading mgf-ghost-heading--first" />
                      <GhostCompare rows={6} />
                      <span className="mc-ghost-bar mgf-ghost-heading" />
                      <GhostCompare rows={3} />
                    </div>
                    <div className="mgf-empty-inner">
                      <div className="mc-empty-title">{emptyAsk.title}</div>
                      <div className="mc-empty-sub">{emptyAsk.sub}</div>
                      {/* The node ends on the search bar's own ⌘K badge, and it
                          is honest here: step 1 binds ⌘K to this same picker. */}
                      <button
                        className="btn-save-draft mc-empty-cta"
                        onClick={() => setShowPicker(true)}
                      >
                        {emptyAsk.cta}
                        <span className="usearch-kbd">
                          <span className="kbd-cmd">
                            <KeyCommandIcon />
                          </span>
                          <span className="kbd-letter">K</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ───────────── STEP 2 — Review ───────────── */}
          {step === 1 && src && dst && (
            <>
              {/* Nothing is deleted here — the source keeps its account and
                  only loses the plan — so it is not struck through. */}
              <FlowStrip
                to={dst}
                toSub={`Gains ${src.sub.plan}`}
                from={src}
                fromSub={`Loses ${src.sub.plan}`}
              />

              {/* The plan the source gives up is struck in its column, the way
                  Merge strikes what the deleted account gives up. */}
              <TableCard title="Summary of Updates" className="mgf-tcard">
                <CompareTable
                  keptLabel={KEPT}
                  goneLabel={GONE}
                  rows={[
                    { k: "Plan", a: src.sub.plan, b: src.sub.plan, strikeB: true },
                    { k: "Status", a: src.sub.detail, b: src.sub.detail, strikeB: true },
                    { k: "Price", a: src.sub.price, b: src.sub.price, strikeB: true },
                    /* Only when there is one — a row of two dashes says
                       nothing the reader needs. */
                    ...(dstHasActive
                      ? [
                          {
                            k: "Plan Replaced",
                            a: `${dst.sub.plan} · cancelled & refunded pro-rata`,
                            b: "—",
                          },
                        ]
                      : []),
                    {
                      k: "Account After Transfer",
                      a: dstHasActive ? "Active · plan replaced" : "Active",
                      b: "Free — no active plan",
                    },
                  ]}
                />
              </TableCard>

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
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn-save-draft wizard-gate-btn" onClick={() => gate.goStep(step - 1)}>
              <span className="wizard-gate-fill" ref={gate.backFillRef} />
              <span className="wizard-gate-btn-inner">Back</span>
            </button>
          )}
          {/* `aria-disabled` rather than `disabled`: a disabled button fires no
              mouse events, so it could not show the tooltip that says what is
              still missing. On the last step the button is the transfer itself
              and opens the final confirmation. */}
          <button
            className={`btn-publish${isLast ? "" : " wizard-gate-btn"}${cont ? "" : " is-disabled"}`}
            aria-disabled={!cont}
            data-tip={blockedTip}
            onClick={advance}
          >
            {!isLast && <span className="wizard-gate-fill" ref={gate.nextFillRef} />}
            <span className="wizard-gate-btn-inner">
              {isLast ? "Transfer Subscription" : "Continue"}
              <WizardKeyHint />
            </span>
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
          /* Prose, not a summary list: the review step behind this dialog is
             where the detail lives, and repeating a digest of it here just
             asks to be read twice. */
          description={
            <>
              <strong>{src.sub.plan}</strong> moves off <strong>{src.email}</strong> — with its
              billing, renewal date and remaining term — and onto{" "}
              <strong>{dst.email}</strong>.{" "}
              {dstHasActive
                ? `${dst.name}'s ${dst.sub.plan} is cancelled and refunded pro-rata first, and `
                : ""}
              {src.name} drops to Free, keeping every record and purchase on the account.
            </>
          }
          confirmLabel="Yes, transfer subscription"
          danger
          onCancel={() => setShowModal(false)}
          onConfirm={confirmTransfer}
        />
      )}
    </div>
  );
}
