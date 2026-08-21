import { useEffect, useRef, useState } from "react";
import { transferUsers, findUser, type MergeUser } from "../data/transferSubscription";
import { AccountPicker, Avatar, detailRows } from "./MergeAccountsPage";
import { AlertTriangleIcon, ArrowRightIcon, CheckBoldIcon, CreditCardIcon, InfoCircleIcon, SwapIcon, XCircleIcon } from "./icons";
import { WizardStepRail, type WizardStepStatus } from "./WizardStepRail";

/**
 * Transfer Subscription — a two-step wizard for moving an active subscription
 * from one learner account to another. Step 1 picks the Source (the account
 * that currently holds the subscription) and the Destination (the account that
 * receives it); the Source must have an active subscription and a destination
 * that already has its own active plan is flagged because it gets replaced.
 * Step 2 is a read-only review, gated behind a final confirmation modal, after
 * which the transfer "runs" and an audit-log entry is shown.
 *
 * Reuses the Merge Accounts chrome (.mg-* over the shared design system) and its
 * account primitives + fixtures. Unlike a merge, neither account is deleted —
 * only the subscription moves. All data is demo data; nothing is persisted.
 */

const STEPS = [
  { n: 1, label: "Accounts" },
  { n: 2, label: "Review" },
];

export function TransferSubscriptionPage() {
  const [step, setStep] = useState(1);
  const [qSrc, setQSrc] = useState("");
  const [qDst, setQDst] = useState("");
  const [srcId, setSrcId] = useState<string | null>(null);
  const [dstId, setDstId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  const [transferredAt, setTransferredAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Each step starts at its own top, not wherever the previous one was scrolled.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [step]);

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
    `"${q}" is a B2B account — B2B accounts aren't eligible for subscription transfer`;

  function canContinue() {
    if (step === 1) return both && !noSubToMove;
    if (step === 2) return true;
    return false;
  }

  function back() {
    if (step > 1 && step <= 2) setStep(step - 1);
  }
  function advance() {
    if (!canContinue()) return;
    if (step < 2) setStep(step + 1);
    else setShowModal(true);
  }
  function swapRoles() {
    setSrcId(dstId);
    setDstId(srcId);
  }
  function confirmTransfer() {
    if (timer.current) clearTimeout(timer.current);
    setShowModal(false);
    setStep(3);
    setPhase("processing");
    setTransferredAt(new Date());
    timer.current = setTimeout(() => {
      timer.current = null;
      setPhase("done");
    }, 1700);
  }
  function restart() {
    if (timer.current) clearTimeout(timer.current);
    setStep(1);
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
            tone: "accent",
            title: `${src.sub.plan} moves to ${dst.name}`,
            detail: `${src.sub.detail} · ${src.sub.price}. Billing, renewal date and remaining term transfer unchanged to ${dst.email}.`,
          },
          {
            icon: <XCircleIcon />,
            tone: "drop",
            title: dstHasActive ? `${dst.name}'s current plan is cancelled` : "No plan replaced",
            detail: dstHasActive
              ? `${dst.sub.plan} (${dst.sub.price}) on the destination is cancelled & refunded pro-rata before the transfer applies.`
              : `${dst.name} has no active subscription, so nothing is cancelled.`,
          },
          {
            icon: <CheckBoldIcon />,
            tone: "ok",
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

  const audit =
    step === 3 && transferredAt && src && dst
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
  const showFooter = step <= 2;
  const footerHint =
    step === 2
      ? "This opens a final confirmation"
      : noSubToMove
      ? "The source has no active subscription to move"
      : both
      ? "Accounts set — continue"
      : "Select both accounts";

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks mg-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Transfer Subscription</h1>
              <div className="tasks-subtitle">
                <span>Admin</span>
                <span className="tasks-subtitle-dot" />
                <span>Operations</span>
                <span className="tasks-subtitle-dot" />
                <span>Move a subscription from one account to another</span>
              </div>
            </div>
          </header>

          {/* step rail */}
          <div className="mg-steps">
            {STEPS.map((x) => {
              const status: WizardStepStatus = step === x.n ? "active" : step > x.n ? "done" : "upcoming";
              return (
                <div className={`wizard-step ${status}`} key={x.n}>
                  <WizardStepRail status={status} num={x.n} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{x.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mg-scroll" ref={scroller}>
            {/* ───────────── STEP 1 ───────────── */}
            {step === 1 && (
              <div className="mg-pane">
                <h2 className="form-section-title">Choose the accounts</h2>
                <p className="form-section-desc">
                  Pick the Source account that currently holds the subscription and the Destination account that should
                  receive it. Only the subscription moves — both accounts and their records stay intact.
                </p>

                <div className="mg-grid2">
                  {/* SOURCE */}
                  <div className="mg-acct mg-acct--drop">
                    <div className="mg-acct-head">
                      <span className="mg-role mg-role--drop">Source · loses plan</span>
                      <span className="mg-acct-note">Subscription moves out</span>
                    </div>
                    <div className="mg-acct-body">
                      <AccountPicker
                        user={src}
                        query={qSrc}
                        results={resSrc}
                        placeholder="Search the account to move from…"
                        emptyText={srcOnlyB2B ? b2bEmpty(qSrc) : undefined}
                        onQuery={setQSrc}
                        onPick={(id) => { setSrcId(id); setQSrc(""); }}
                        onClear={() => setSrcId(null)}
                      />
                      {src && <AccountSub user={src} tone="source" />}
                    </div>
                  </div>

                  {/* DESTINATION */}
                  <div className="mg-acct mg-acct--keep">
                    <div className="mg-acct-head">
                      <span className="mg-role mg-role--keep">Destination · gains plan</span>
                      <span className="mg-acct-note">Subscription moves in</span>
                    </div>
                    <div className="mg-acct-body">
                      <AccountPicker
                        user={dst}
                        query={qDst}
                        results={resDst}
                        placeholder="Search the account to move to…"
                        emptyText={dstOnlyB2B ? b2bEmpty(qDst) : undefined}
                        onQuery={setQDst}
                        onPick={(id) => { setDstId(id); setQDst(""); }}
                        onClear={() => setDstId(null)}
                      />
                      {dst && <AccountSub user={dst} tone="destination" />}
                    </div>
                  </div>
                </div>

                <div className="mg-swap-row">
                  <button className="btn-save-draft" onClick={swapRoles}>
                    <SwapIcon /> Swap direction
                  </button>
                </div>

                {noSubToMove && src && (
                  <div className="mg-note mg-note--warn">
                    <span className="mg-note-icon"><AlertTriangleIcon /></span>
                    <div className="mg-note-text">
                      <strong>{src.name}</strong> has no active subscription, so there is nothing to transfer. Pick a
                      source on a paid plan, or swap the direction.
                    </div>
                    <button className="btn-save-draft" onClick={swapRoles}>Swap direction</button>
                  </div>
                )}
                {both && !noSubToMove && dstHasActive && dst && (
                  <div className="mg-note mg-note--info">
                    <span className="mg-note-icon"><InfoCircleIcon /></span>
                    <div className="mg-note-text">
                      <strong>{dst.name}</strong> already has an active plan (<strong>{dst.sub.plan}</strong>). It will
                      be cancelled and refunded pro-rata when the transferred subscription is applied.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ───────────── STEP 2 ───────────── */}
            {step === 2 && src && dst && (
              <div className="mg-pane">
                <h2 className="form-section-title">Review the transfer</h2>
                <p className="form-section-desc">
                  A preview of everything that will happen. Nothing has changed yet — confirm on the next step to run the
                  transfer.
                </p>

                <div className="mg-flow">
                  <div className="mg-flow-acct is-out">
                    <Avatar user={src} small />
                    <div>
                      <div className="mg-flow-email">{src.email}</div>
                      <div className="mg-flow-sub mg-flow-sub--drop">Source · loses {src.sub.plan}</div>
                    </div>
                  </div>
                  <span className="mg-flow-arrow"><ArrowRightIcon /></span>
                  <div className="mg-flow-acct">
                    <Avatar user={dst} small />
                    <div>
                      <div className="mg-flow-email">{dst.email}</div>
                      <div className="mg-flow-sub mg-flow-sub--keep">Destination · gains {src.sub.plan}</div>
                    </div>
                  </div>
                </div>

                <div className="mg-section-label">Subscription being moved</div>
                <div className="mg-grid2 mg-plans">
                  <div className="mg-plan mg-plan--drop">
                    <div className="mg-plan-tag mg-plan-tag--drop">Source — before</div>
                    <div className="mg-plan-name">{src.sub.plan}</div>
                    <div className="mg-plan-detail">{src.sub.detail} · {src.sub.price}</div>
                  </div>
                  <div className="mg-plan mg-plan--keep">
                    <div className="mg-plan-tag mg-plan-tag--keep">Destination — after</div>
                    <div className="mg-plan-name">{src.sub.plan}</div>
                    <div className="mg-plan-detail">{src.sub.detail} · {src.sub.price}</div>
                  </div>
                </div>

                <div className="mg-review">
                  {reviewRows.map((r, i) => (
                    <div key={i} className="mg-review-row">
                      <span className={`mg-review-icon mg-review-icon--${r.tone}`}>{r.icon}</span>
                      <div>
                        <div className="mg-review-title">{r.title}</div>
                        <div className="mg-review-detail">{r.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ───────────── DONE ───────────── */}
            {step === 3 && phase === "processing" && (
              <div className="mg-processing">
                <span className="mg-spinner" />
                <div className="mg-processing-title">Transferring subscription…</div>
                <div className="mg-processing-sub">Cancelling any replaced plan, moving billing and renewal to the destination account.</div>
              </div>
            )}
            {step === 3 && phase === "done" && src && dst && audit && (
              <div className="mg-pane mg-done">
                <div className="mg-done-check"><CheckBoldIcon /></div>
                <h2 className="mg-done-title">Subscription transferred successfully</h2>
                <p className="mg-done-lead">
                  <strong>{src.sub.plan}</strong> moved from {src.email} to {dst.name}'s account. {src.name} is now on
                  the Free plan.
                </p>
                <div className="mg-audit">
                  <div className="mg-audit-head">
                    <span>Audit log entry</span>
                    <span className="mg-audit-id">{audit.id}</span>
                  </div>
                  {audit.rows.map((r, i) => (
                    <div key={i} className="mg-audit-row">
                      <span className="mg-audit-k">{r.k}</span>
                      <span className={`mg-audit-v ${r.mono ? "is-mono" : ""}`}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <div className="mg-done-actions">
                  <button className="btn-publish" onClick={restart}>Transfer another</button>
                  <button className="btn-save-draft">View full audit log</button>
                </div>
              </div>
            )}
          </div>

          {/* footer */}
          {showFooter && (
            <footer className="wizard-footer mg-footer">
              <div className="wizard-footer-left">
                {step > 1 && (
                  <button className="btn-save-draft" onClick={back}>Back</button>
                )}
              </div>
              <div className="wizard-actions">
                <span className="mg-footer-hint">{footerHint}</span>
                <button
                  className={`btn-publish ${step === 2 ? "mg-btn-danger" : ""}`}
                  disabled={!cont}
                  onClick={advance}
                >
                  {step === 2 ? "Transfer subscription" : "Continue"}
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>

      {/* confirm modal */}
      {showModal && src && dst && (
        <div className="pm-overlay" onClick={() => setShowModal(false)}>
          <div
            className="pm-modal mg-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm transfer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pm-head">
              <div className="mg-modal-icon"><AlertTriangleIcon /></div>
              <h3 className="pm-title">Transfer this subscription?</h3>
              <p className="pm-sub">
                The <strong>{src.sub.plan}</strong> subscription will move from <strong>{src.email}</strong> to{" "}
                <strong>{dst.email}</strong>.
                {dstHasActive ? " The destination's current plan is cancelled and refunded pro-rata." : ""}
              </p>
            </div>
            <div className="pm-body">
              <div className="mg-modal-points">
                {modalPoints.map((m, i) => (
                  <div key={i} className="mg-modal-point">
                    <ArrowRightIcon />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pm-foot">
              <button className="btn-save-draft" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-publish mg-btn-danger" onClick={confirmTransfer}>Yes, transfer subscription</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountSub({ user, tone }: { user: MergeUser; tone: "source" | "destination" }) {
  return (
    <div className="mg-details">
      <div className="mg-sublabel">User details</div>
      <div className="mg-kv">
        {detailRows(user).map((d) => (
          <div key={d.k} className="mg-kv-row">
            <span className="mg-kv-k">{d.k}</span>
            <span className={`mg-kv-v ${d.company ? "is-company" : ""}`}>{d.v}</span>
          </div>
        ))}
      </div>
      <div className="mg-sublabel">Current subscription</div>
      <div className="mg-kv">
        <div className="mg-kv-row">
          <span className="mg-kv-k">Plan</span>
          <span className="mg-kv-v">{user.sub.plan}</span>
        </div>
        <div className="mg-kv-row">
          <span className="mg-kv-k">Status</span>
          <span className="mg-kv-v">{user.sub.detail}</span>
        </div>
        <div className="mg-kv-row">
          <span className="mg-kv-k">Price</span>
          <span className="mg-kv-v">{user.sub.price}</span>
        </div>
      </div>
      {/* The tick/cross reflects the outcome for this account, not its role. */}
      <div className={`mg-acct-foot ${(tone === "source") === user.sub.active ? "is-ok" : "is-bad"}`}>
        {tone === "source" ? (
          user.sub.active ? (
            <><CheckBoldIcon /> Active plan — eligible to transfer out</>
          ) : (
            <><XCircleIcon /> No active plan to transfer</>
          )
        ) : user.sub.active ? (
          <><XCircleIcon /> Existing plan will be cancelled &amp; refunded</>
        ) : (
          <><CheckBoldIcon /> No plan — ready to receive the subscription</>
        )}
      </div>
    </div>
  );
}
