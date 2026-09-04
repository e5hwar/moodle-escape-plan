import { useEffect, useRef, useState } from "react";
import { transferUsers, findUser } from "../data/transferSubscription";
import {
  AccountPicker,
  CompareTable,
  FlowDone,
  FlowProcessing,
  FlowStrip,
  Notice,
  accountCompareRows,
  useEscape,
  type AuditLog,
} from "./MergeAccountsPage";
import {
  AlertTriangleIcon,
  CheckBoldIcon,
  CreditCardIcon,
  InfoCircleIcon,
  SwapIcon,
  XCircleIcon,
} from "./icons";
import { WizardStepRail, type WizardStepStatus } from "./WizardStepRail";
import { SectionHeading } from "./SectionHeading";
import { PrmModal } from "./PrmModal";

/**
 * Transfer Subscription — a two-step wizard for moving an active subscription
 * from one learner account to another. Step 1 picks the Source (the account
 * that currently holds the subscription) and the Destination (the account that
 * receives it); the Source must have an active subscription and a destination
 * that already has its own active plan is flagged because it gets replaced.
 * Step 2 is a read-only review, gated behind a final confirmation modal, after
 * which the transfer "runs" and an audit-log entry is shown.
 *
 * Built from the same shared design-system parts as Merge Accounts, and reusing
 * that flow's account primitives + fixtures (see MergeAccountsPage for the
 * inventory). Unlike a merge, neither account is deleted — only the
 * subscription moves. All data is demo data; nothing is persisted.
 */

type Phase = "idle" | "processing" | "done";

const STEPS = [
  {
    id: "accounts",
    label: "Accounts",
    title: "Choose the accounts",
    desc: "Pick the Source account that currently holds the subscription and the Destination account that should receive it. Only the subscription moves — both accounts and their records stay intact.",
  },
  {
    id: "review",
    label: "Review",
    title: "Review the transfer",
    desc: "A preview of everything that will happen. Nothing has changed yet — confirm on the next step to run the transfer.",
  },
];

export function TransferSubscriptionPage({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState(0);
  // Furthest step cleared — the rail is navigable up to here, so stepping Back
  // does not re-lock the step already answered.
  const [maxStep, setMaxStep] = useState(0);
  const [qSrc, setQSrc] = useState("");
  const [qDst, setQDst] = useState("");
  const [srcId, setSrcId] = useState<string | null>(null);
  const [dstId, setDstId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transferredAt, setTransferredAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Each step starts at its own top, not wherever the previous one was scrolled.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [step]);
  useEscape(showModal, () => setShowModal(false));

  const src = findUser(srcId);
  const dst = findUser(dstId);
  const both = !!src && !!dst;

  // The Source must hold something worth moving.
  const noSubToMove = !!(src && !src.sub.active);
  // The Destination already paying for its own plan — it will be replaced.
  const dstHasActive = !!(dst && dst.sub.active);

  function filter(q: string, excludeId: string | null) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return transferUsers.filter(
      (u) =>
        u.id !== excludeId &&
        !u.company &&
        (u.name.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle) ||
          u.id.toLowerCase().includes(needle))
    );
  }

  function matchesOnlyB2B(q: string, excludeId: string | null) {
    const needle = q.trim().toLowerCase();
    if (!needle) return false;
    return transferUsers.some(
      (u) =>
        u.id !== excludeId &&
        !!u.company &&
        (u.name.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle) ||
          u.id.toLowerCase().includes(needle))
    );
  }

  const resSrc = filter(qSrc, dstId);
  const resDst = filter(qDst, srcId);
  const srcOnlyB2B = resSrc.length === 0 && matchesOnlyB2B(qSrc, dstId);
  const dstOnlyB2B = resDst.length === 0 && matchesOnlyB2B(qDst, srcId);
  const b2bEmpty = (q: string) =>
    `"${q}" only matches B2B accounts — B2B accounts aren't eligible for subscription transfer`;

  function canContinue() {
    if (step === 0) return both && !noSubToMove;
    return true;
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }
  function advance() {
    if (!canContinue()) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      setMaxStep((m) => Math.max(m, step + 1));
    } else setShowModal(true);
  }
  /* Changing either account invalidates the review downstream, so the rail's
     reach collapses back to this step. */
  function pickAccount(set: (id: string | null) => void, id: string | null) {
    set(id);
    setMaxStep(0);
  }
  function swapRoles() {
    setSrcId(dstId);
    setDstId(srcId);
    setMaxStep(0);
  }
  function confirmTransfer() {
    if (timer.current) clearTimeout(timer.current);
    setShowModal(false);
    setPhase("processing");
    setTransferredAt(new Date());
    timer.current = setTimeout(() => {
      timer.current = null;
      setPhase("done");
    }, 1700);
  }
  function restart() {
    if (timer.current) clearTimeout(timer.current);
    setStep(0);
    setMaxStep(0);
    setQSrc("");
    setQDst("");
    setSrcId(null);
    setDstId(null);
    setShowModal(false);
    setPhase("idle");
    setTransferredAt(null);
  }

  const reviewRows =
    both && src && dst
      ? [
          {
            icon: <CreditCardIcon />,
            tone: "info" as const,
            title: `${src.sub.plan} moves to ${dst.name}`,
            detail: `${src.sub.detail} · ${src.sub.price}. Billing, renewal date and remaining term transfer unchanged to ${dst.email}.`,
          },
          {
            icon: <XCircleIcon />,
            tone: "danger" as const,
            title: dstHasActive ? `${dst.name}'s current plan is cancelled` : "No plan replaced",
            detail: dstHasActive
              ? `${dst.sub.plan} (${dst.sub.price}) on the destination is cancelled & refunded pro-rata before the transfer applies.`
              : `${dst.name} has no active subscription, so nothing is cancelled.`,
          },
          {
            icon: <CheckBoldIcon />,
            tone: "ok" as const,
            title: `${src.name} drops to Free`,
            detail: `The source account keeps its learning records, add-ons and login — it simply no longer holds the subscription.`,
          },
        ]
      : [];

  const modalPoints =
    both && src && dst
      ? [
          `${src.sub.plan} moves from ${src.email} to ${dst.email}`,
          dstHasActive
            ? `${dst.name}'s ${dst.sub.plan} is cancelled & refunded pro-rata`
            : `${dst.name} gains an active subscription`,
          `${src.name} drops to Free (records & add-ons untouched)`,
        ]
      : [];

  const audit: AuditLog | null =
    phase === "done" && transferredAt && src && dst
      ? {
          id: "XFER-" + transferredAt.getTime().toString(36).toUpperCase(),
          rows: [
            { k: "Subscription", v: `${src.sub.plan} · ${src.sub.detail} · ${src.sub.price}`, mono: false },
            { k: "From (source)", v: `${src.name}  ·  ${src.email}  ·  ${src.id}`, mono: true },
            { k: "To (destination)", v: `${dst.name}  ·  ${dst.email}  ·  ${dst.id}`, mono: true },
            { k: "Plan replaced", v: dstHasActive ? `${dst.sub.plan} cancelled & refunded pro-rata` : "none", mono: false },
            { k: "Performed by", v: "Sarah Chen · sarah.chen@skillcat.com", mono: false },
            {
              k: "Timestamp",
              v:
                transferredAt.toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }) + " UTC",
              mono: false,
            },
          ],
        }
      : null;

  const cont = canContinue();
  const isLast = step === STEPS.length - 1;
  const footerHint = isLast
    ? "This opens a final confirmation"
    : noSubToMove
    ? "The source has no active subscription to move"
    : both
    ? "Accounts set — continue"
    : "Select both accounts";

  if (phase === "processing") {
    return (
      <FlowProcessing
        title="Transferring subscription…"
        sub="Cancelling any replaced plan, moving billing and renewal to the destination account."
      />
    );
  }
  if (phase === "done" && src && dst && audit) {
    return (
      <FlowDone
        title="Subscription transferred successfully"
        lead={
          <>
            <strong>{src.sub.plan}</strong> moved from {src.email} to {dst.name}'s account. {src.name} is now on
            the Free plan.
          </>
        }
        audit={audit}
        primaryLabel="Transfer another"
        onPrimary={restart}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="wizard mc-root">
      <div className="wizard-body">
        {/* ── left rail (Figma 625:1459) ── */}
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">Admin</span>
            <span className="wizard-brand-name">Transfer Subscription</span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((x, i) => {
              // A step already cleared keeps its check when you step back to an
              // earlier one — otherwise it reads identical to a locked step.
              const status: WizardStepStatus =
                i === step ? "active" : i < step || i <= maxStep ? "done" : "upcoming";
              const locked = i > maxStep;
              return (
                <li
                  key={x.id}
                  className={`wizard-step ${status}${locked ? " is-locked" : ""}`}
                  onClick={locked ? undefined : () => setStep(i)}
                >
                  <WizardStepRail status={status} num={i + 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{x.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="wizard-progress">Step {step + 1} of {STEPS.length}</div>
        </aside>

        {/* ── content ── */}
        <div className="wizard-content" ref={scroller}>
          <h1 className="wizard-title">{STEPS[step].title}</h1>
          <p className="wizard-desc">{STEPS[step].desc}</p>

          {/* ───────────── STEP 1 — Accounts ───────────── */}
          {step === 0 && (
            <>
              <div className="form-row-2">
                <div className="form-group">
                  <div className="form-label-row">
                    <label className="form-label">Source account</label>
                    <span className="co-status-pill co-status-pill--red">Loses plan</span>
                  </div>
                  <AccountPicker
                    user={src}
                    query={qSrc}
                    results={resSrc}
                    placeholder="Search the account to move from…"
                    emptyText={srcOnlyB2B ? b2bEmpty(qSrc) : undefined}
                    onQuery={setQSrc}
                    onPick={(id) => { pickAccount(setSrcId, id); setQSrc(""); }}
                    onClear={() => pickAccount(setSrcId, null)}
                  />
                  <p className="form-help">
                    Holds the subscription today. Its records, add-ons and login are untouched.
                  </p>
                </div>

                <div className="form-group">
                  <div className="form-label-row">
                    <label className="form-label">Destination account</label>
                    <span className="co-status-pill co-status-pill--accent">Gains plan</span>
                  </div>
                  <AccountPicker
                    user={dst}
                    query={qDst}
                    results={resDst}
                    placeholder="Search the account to move to…"
                    emptyText={dstOnlyB2B ? b2bEmpty(qDst) : undefined}
                    onQuery={setQDst}
                    onPick={(id) => { pickAccount(setDstId, id); setQDst(""); }}
                    onClear={() => pickAccount(setDstId, null)}
                  />
                  <p className="form-help">
                    Receives the plan with its billing, renewal date and remaining term unchanged.
                  </p>
                </div>
              </div>

              {noSubToMove && src && (
                <Notice
                  tone="danger"
                  icon={<AlertTriangleIcon />}
                  pill="Action required"
                  pillTone="red"
                  title={
                    <>
                      <strong>{src.name}</strong> has no active subscription
                    </>
                  }
                  sub="There is nothing to transfer. Pick a source on a paid plan, or swap the direction."
                  action={
                    <button className="btn-save-draft mc-btn-sm" onClick={swapRoles}>
                      Swap direction
                    </button>
                  }
                />
              )}

              {both && !noSubToMove && dstHasActive && dst && (
                <Notice
                  tone="info"
                  icon={<InfoCircleIcon />}
                  pill="Plan replaced"
                  pillTone="accent"
                  title={
                    <>
                      <strong>{dst.name}</strong> already has an active plan ({dst.sub.plan})
                    </>
                  }
                  sub="It will be cancelled and refunded pro-rata when the transferred subscription is applied."
                />
              )}

              {(src || dst) && (
                <>
                  <SectionHeading
                    label="Account details"
                    trailing={
                      <button className="btn-save-draft mc-btn-sm" onClick={swapRoles}>
                        <SwapIcon /> Swap direction
                      </button>
                    }
                  />
                  <CompareTable
                    leftLabel={src ? src.name : "Source"}
                    leftPill={src ? "Source · loses plan" : "Not selected"}
                    leftTone={src ? "red" : "grey"}
                    rightLabel={dst ? dst.name : "Destination"}
                    rightPill={dst ? "Destination · gains plan" : "Not selected"}
                    rightTone={dst ? "accent" : "grey"}
                    rows={accountCompareRows(src, dst)}
                  />

                  <SectionHeading label="Current subscription" />
                  <CompareTable
                    leftLabel={src ? src.name : "Source"}
                    leftPill={
                      src ? (src.sub.active ? "Eligible to transfer out" : "No active plan") : "Not selected"
                    }
                    leftTone={src ? (src.sub.active ? "green" : "red") : "grey"}
                    rightLabel={dst ? dst.name : "Destination"}
                    rightPill={
                      dst ? (dst.sub.active ? "Existing plan cancelled" : "Ready to receive") : "Not selected"
                    }
                    rightTone={dst ? (dst.sub.active ? "yellow" : "green") : "grey"}
                    rows={[
                      { k: "Plan", a: src ? src.sub.plan : "", b: dst ? dst.sub.plan : "" },
                      { k: "Status", a: src ? src.sub.detail : "", b: dst ? dst.sub.detail : "" },
                      { k: "Price", a: src ? src.sub.price : "", b: dst ? dst.sub.price : "" },
                    ]}
                  />
                </>
              )}
            </>
          )}

          {/* ───────────── STEP 2 — Review ───────────── */}
          {step === 1 && src && dst && (
            <>
              <FlowStrip
                from={src}
                fromNote={`Source · loses ${src.sub.plan}`}
                to={dst}
                toNote={`Destination · gains ${src.sub.plan}`}
              />

              <SectionHeading label="Subscription being moved" />
              <CompareTable
                leftLabel={src.name}
                leftPill="Source — before"
                leftTone="red"
                rightLabel={dst.name}
                rightPill="Destination — after"
                rightTone="accent"
                rows={[
                  { k: "Plan", a: src.sub.plan, b: src.sub.plan },
                  { k: "Status", a: src.sub.detail, b: src.sub.detail },
                  { k: "Price", a: src.sub.price, b: src.sub.price },
                  {
                    k: "After transfer",
                    a: "Free — no active plan",
                    b: dstHasActive ? `Replaces ${dst.sub.plan}` : "First active plan",
                  },
                ]}
              />

              <SectionHeading label="What will happen" />
              {reviewRows.map((r, i) => (
                <Notice key={i} tone={r.tone} icon={r.icon} title={r.title} sub={r.detail} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── footer (Figma 73:515) ── */}
      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
          <span className="wizard-saved">{footerHint}</span>
        </div>
        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn-save-draft" onClick={back}>Back</button>
          )}
          <button
            className={`btn-publish${isLast ? " btn-publish--danger" : ""}`}
            disabled={!cont}
            onClick={advance}
          >
            {isLast ? "Transfer subscription" : "Continue"}
          </button>
        </div>
      </footer>

      {/* ── confirm (Figma 483:588 + the destructive CTA 495:2247) ── */}
      {showModal && src && dst && (
        <PrmModal
          title="Transfer this subscription?"
          description={
            <>
              The <strong>{src.sub.plan}</strong> subscription will move from <strong>{src.email}</strong> to{" "}
              <strong>{dst.email}</strong>.
              {dstHasActive ? " The destination's current plan is cancelled and refunded pro-rata." : ""}
            </>
          }
          confirmLabel="Yes, transfer subscription"
          danger
          onCancel={() => setShowModal(false)}
          onConfirm={confirmTransfer}
        >
          <div className="co-cancel-summary">
            {modalPoints.map((m, i) => (
              <div className="co-cancel-summary-row" key={i}>
                <span>{m}</span>
              </div>
            ))}
          </div>
        </PrmModal>
      )}
    </div>
  );
}
