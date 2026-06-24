import { useEffect, useRef, useState } from "react";
import { transferUsers, findUser, type MergeUser } from "../data/transferSubscription";
import { SearchIcon } from "./icons";

/**
 * Transfer Subscription — a two-step wizard for moving an active subscription
 * from one learner account to another. Step 1 picks the Source (the account
 * that currently holds the subscription) and the Destination (the account that
 * receives it); the Source must have an active subscription and a destination
 * that already has its own active plan is flagged because it gets replaced.
 * Step 2 is a read-only review, gated behind a final confirmation modal, after
 * which the transfer "runs" and an audit-log entry is shown.
 *
 * Reuses the design system (mg-*) and account fixtures of the Merge Accounts
 * flow. Unlike a merge, neither account is deleted — only the subscription
 * moves. All data is demo data; nothing is persisted.
 */

const STEPS = [
  { n: 1, label: "Accounts" },
  { n: 2, label: "Review" },
];

function Avatar({ user, size = 32 }: { user: MergeUser; size?: number }) {
  return (
    <span
      className="mg-avatar"
      style={{ width: size, height: size, background: user.color, fontSize: size * 0.36 }}
    >
      {user.initials}
    </span>
  );
}

function Tag({ user }: { user: MergeUser }) {
  return (
    <span className={`mg-tag ${user.company ? "mg-tag--b2b" : "mg-tag--b2c"}`}>
      {user.company ? "B2B" : "B2C"}
    </span>
  );
}

function detailRows(u: MergeUser) {
  return [
    { k: "Email", v: u.email, company: false },
    { k: "Phone", v: u.phone, company: false },
    { k: "Account created", v: u.created, company: false },
    { k: "Login method", v: u.login, company: false },
    { k: "Company", v: u.company || "None (individual)", company: !!u.company },
  ];
}

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

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
        (u.name.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle) ||
          u.id.toLowerCase().includes(needle))
    );
  }

  const resSrc = filter(qSrc, dstId);
  const resDst = filter(qDst, srcId);

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
            icon: "$",
            tone: "blue",
            title: `${src.sub.plan} moves to ${dst.name}`,
            detail: `${src.sub.detail} · ${src.sub.price}. Billing, renewal date and remaining term transfer unchanged to ${dst.email}.`,
          },
          {
            icon: "✕",
            tone: "red",
            title: dstHasActive ? `${dst.name}'s current plan is cancelled` : "No plan replaced",
            detail: dstHasActive
              ? `${dst.sub.plan} (${dst.sub.price}) on the destination is cancelled & refunded pro-rata before the transfer applies.`
              : `${dst.name} has no active subscription, so nothing is cancelled.`,
          },
          {
            icon: "⊙",
            tone: "green",
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
        <div className="tasks sch-page mg-page">
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

          {/* stepper */}
          <div className="mg-stepper">
            {STEPS.map((x, i) => {
              const cur = step === x.n;
              const done = step > x.n;
              return (
                <div className="mg-stepper-item" key={x.n}>
                  <div className="mg-stepper-cell">
                    <span className={`mg-step-circle ${done ? "is-done" : cur ? "is-cur" : ""}`}>
                      {done ? "✓" : x.n}
                    </span>
                    <span className={`mg-step-label ${cur ? "is-cur" : done ? "is-done" : ""}`}>{x.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <span className={`mg-step-conn ${done ? "is-done" : ""}`} />}
                </div>
              );
            })}
          </div>

          <div className="mg-body">
            {/* ───────────── STEP 1 ───────────── */}
            {step === 1 && (
              <div className="mg-pane">
                <h2 className="mg-h1">Choose the accounts</h2>
                <p className="mg-lead">
                  Pick the Source account that currently holds the subscription and the Destination account that should
                  receive it. Only the subscription moves — both accounts and their records stay intact.
                </p>

                <div className="mg-grid2">
                  {/* SOURCE */}
                  <div className="mg-acct-card mg-acct-card--secondary">
                    <div className="mg-acct-head mg-acct-head--secondary">
                      <div className="mg-acct-head-l">
                        <span className="mg-dot mg-dot--red" />
                        <span className="mg-acct-role mg-acct-role--red">SOURCE · LOSES PLAN</span>
                      </div>
                      <span className="mg-acct-note mg-acct-note--blue">Subscription moves out</span>
                    </div>
                    <div className="mg-acct-body">
                      <div className="mg-search-wrap">
                        {!src ? (
                          <>
                            <div className="mg-search">
                              <span className="mg-search-ic"><SearchIcon /></span>
                              <input
                                className="mg-search-input"
                                value={qSrc}
                                onChange={(e) => setQSrc(e.target.value)}
                                placeholder="Search the account to move from…"
                              />
                            </div>
                            {qSrc.trim() && resSrc.length > 0 && (
                              <div className="mg-results">
                                {resSrc.map((u) => (
                                  <button key={u.id} className="mg-result" onClick={() => { setSrcId(u.id); setQSrc(""); }}>
                                    <Avatar user={u} />
                                    <span className="mg-result-text">
                                      <span className="mg-result-name">{u.name}</span>
                                      <span className="mg-result-email">{u.email}</span>
                                    </span>
                                    <Tag user={u} />
                                  </button>
                                ))}
                              </div>
                            )}
                            {qSrc.trim() && resSrc.length === 0 && (
                              <div className="mg-noresults">No accounts match "{qSrc}"</div>
                            )}
                          </>
                        ) : (
                          <div className="mg-selected mg-selected--secondary">
                            <Avatar user={src} />
                            <span className="mg-result-text">
                              <span className="mg-selected-name">{src.name}<Tag user={src} /></span>
                              <span className="mg-result-email">{src.email}</span>
                            </span>
                            <button className="mg-clear" aria-label="Clear" onClick={() => setSrcId(null)}>×</button>
                          </div>
                        )}
                      </div>
                      {src && <AccountSub user={src} tone="source" />}
                    </div>
                  </div>

                  {/* DESTINATION */}
                  <div className="mg-acct-card mg-acct-card--primary">
                    <div className="mg-acct-head mg-acct-head--primary">
                      <div className="mg-acct-head-l">
                        <span className="mg-dot mg-dot--blue" />
                        <span className="mg-acct-role mg-acct-role--blue">DESTINATION · GAINS PLAN</span>
                      </div>
                      <span className="mg-acct-note mg-acct-note--blue">Subscription moves in</span>
                    </div>
                    <div className="mg-acct-body">
                      <div className="mg-search-wrap">
                        {!dst ? (
                          <>
                            <div className="mg-search">
                              <span className="mg-search-ic"><SearchIcon /></span>
                              <input
                                className="mg-search-input"
                                value={qDst}
                                onChange={(e) => setQDst(e.target.value)}
                                placeholder="Search the account to move to…"
                              />
                            </div>
                            {qDst.trim() && resDst.length > 0 && (
                              <div className="mg-results">
                                {resDst.map((u) => (
                                  <button key={u.id} className="mg-result" onClick={() => { setDstId(u.id); setQDst(""); }}>
                                    <Avatar user={u} />
                                    <span className="mg-result-text">
                                      <span className="mg-result-name">{u.name}</span>
                                      <span className="mg-result-email">{u.email}</span>
                                    </span>
                                    <Tag user={u} />
                                  </button>
                                ))}
                              </div>
                            )}
                            {qDst.trim() && resDst.length === 0 && (
                              <div className="mg-noresults">No accounts match "{qDst}"</div>
                            )}
                          </>
                        ) : (
                          <div className="mg-selected mg-selected--primary">
                            <Avatar user={dst} />
                            <span className="mg-result-text">
                              <span className="mg-selected-name">{dst.name}<Tag user={dst} /></span>
                              <span className="mg-result-email">{dst.email}</span>
                            </span>
                            <button className="mg-clear" aria-label="Clear" onClick={() => setDstId(null)}>×</button>
                          </div>
                        )}
                      </div>
                      {dst && <AccountSub user={dst} tone="destination" />}
                    </div>
                  </div>
                </div>

                <div className="mg-swap-row">
                  <button className="mg-swap-btn" onClick={swapRoles}>⇄ Swap direction</button>
                </div>

                {noSubToMove && src && (
                  <div className="mg-banner mg-banner--warn">
                    <span className="mg-banner-ic">⚠</span>
                    <div className="mg-banner-text">
                      <b>{src.name}</b> has no active subscription, so there is nothing to transfer. Pick a source on a
                      paid plan, or swap the direction.
                    </div>
                    <button className="mg-banner-btn" onClick={swapRoles}>Swap direction</button>
                  </div>
                )}
                {both && !noSubToMove && dstHasActive && dst && (
                  <div className="mg-banner mg-banner--info">
                    <span className="mg-banner-ic">⊙</span>
                    <span>
                      <b>{dst.name}</b> already has an active plan (<b>{dst.sub.plan}</b>). It will be cancelled and
                      refunded pro-rata when the transferred subscription is applied.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ───────────── STEP 2 ───────────── */}
            {step === 2 && src && dst && (
              <div className="mg-pane">
                <h2 className="mg-h1">Review the transfer</h2>
                <p className="mg-lead">
                  A preview of everything that will happen. Nothing has changed yet — confirm on the next step to run the
                  transfer.
                </p>

                <div className="mg-flowbar">
                  <div className="mg-flowbar-acct is-removed">
                    <Avatar user={src} />
                    <div>
                      <div className="mg-flowbar-email">{src.email}</div>
                      <div className="mg-flowbar-sub mg-flowbar-sub--red">Source · loses {src.sub.plan}</div>
                    </div>
                  </div>
                  <span className="mg-flowbar-arrow">→</span>
                  <div className="mg-flowbar-acct">
                    <Avatar user={dst} />
                    <div>
                      <div className="mg-flowbar-email">{dst.email}</div>
                      <div className="mg-flowbar-sub mg-flowbar-sub--blue">Destination · gains {src.sub.plan}</div>
                    </div>
                  </div>
                </div>

                <div className="mg-section-label">SUBSCRIPTION BEING MOVED</div>
                <div className="mg-grid2 mg-sub-summary">
                  <div className="mg-sub-card mg-sub-card--removed">
                    <div className="mg-sub-tag mg-sub-tag--red">SOURCE — BEFORE</div>
                    <div className="mg-sub-plan">{src.sub.plan}</div>
                    <div className="mg-sub-detail">{src.sub.detail} · {src.sub.price}</div>
                  </div>
                  <div className="mg-sub-card mg-sub-card--primary">
                    <div className="mg-sub-tag mg-sub-tag--blue">DESTINATION — AFTER</div>
                    <div className="mg-sub-plan">{src.sub.plan}</div>
                    <div className="mg-sub-detail">{src.sub.detail} · {src.sub.price}</div>
                  </div>
                </div>

                <div className="mg-review-list">
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
              <div className="mg-done">
                <div className="mg-done-check">✓</div>
                <h2 className="mg-h1 mg-done-title">Subscription transferred successfully</h2>
                <p className="mg-done-lead">
                  <b>{src.sub.plan}</b> moved from {src.email} to {dst.name}'s account. {src.name} is now on the Free
                  plan.
                </p>
                <div className="mg-audit">
                  <div className="mg-audit-head">
                    <span>AUDIT LOG ENTRY</span>
                    <span className="mg-audit-id">{audit.id}</span>
                  </div>
                  <div className="mg-audit-body">
                    {audit.rows.map((r, i) => (
                      <div key={i} className="mg-audit-row">
                        <span className="mg-audit-k">{r.k}</span>
                        <span className={`mg-audit-v ${r.mono ? "is-mono" : ""}`}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mg-done-actions">
                  <button className="mg-btn-secondary" onClick={restart}>Transfer another</button>
                  <button className="mg-btn-ghost">View full audit log</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* footer */}
      {showFooter && (
        <div className="mg-footer">
          <button className="mg-btn-back" style={{ visibility: step > 1 ? "visible" : "hidden" }} onClick={back}>‹ Back</button>
          <div className="mg-footer-r">
            <span className="mg-footer-hint">{footerHint}</span>
            <button
              className={`mg-btn-advance ${step === 2 ? "is-danger" : ""} ${!cont && step !== 2 ? "is-disabled" : ""}`}
              disabled={!cont}
              onClick={advance}
            >
              {step === 2 ? "Transfer subscription" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* confirm modal */}
      {showModal && src && dst && (
        <div className="mg-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="mg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mg-modal-icon">⚠</div>
            <h3 className="mg-modal-title">Transfer this subscription?</h3>
            <p className="mg-modal-text">
              The <b>{src.sub.plan}</b> subscription will move from <b>{src.email}</b> to <b>{dst.email}</b>.
              {dstHasActive ? " The destination's current plan is cancelled and refunded pro-rata." : ""}
            </p>
            <div className="mg-modal-points">
              {modalPoints.map((m, i) => (
                <div key={i} className="mg-modal-point">
                  <span className="mg-modal-arrow">→</span>
                  <span>{m}</span>
                </div>
              ))}
            </div>
            <div className="mg-modal-actions">
              <button className="mg-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="mg-btn-danger" onClick={confirmTransfer}>Yes, transfer subscription</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountSub({ user, tone }: { user: MergeUser; tone: "source" | "destination" }) {
  return (
    <div className="mg-acct-details">
      <div className="mg-acct-sublabel">USER DETAILS</div>
      <div className="mg-detail-rows">
        {detailRows(user).map((d) => (
          <div key={d.k} className="mg-detail-row">
            <span className="mg-detail-k">{d.k}</span>
            <span className={`mg-detail-v ${d.company ? "is-company" : ""}`}>{d.v}</span>
          </div>
        ))}
      </div>
      <div className="mg-acct-sublabel">CURRENT SUBSCRIPTION</div>
      <div className="mg-detail-rows">
        <div className="mg-detail-row">
          <span className="mg-detail-k">Plan</span>
          <span className="mg-detail-v">{user.sub.plan}</span>
        </div>
        <div className="mg-detail-row">
          <span className="mg-detail-k">Status</span>
          <span className="mg-detail-v">{user.sub.detail}</span>
        </div>
        <div className="mg-detail-row">
          <span className="mg-detail-k">Price</span>
          <span className="mg-detail-v">{user.sub.price}</span>
        </div>
      </div>
      <div className={`mg-acct-foot mg-acct-foot--${tone === "source" ? "secondary" : "primary"}`}>
        {tone === "source" ? (
          user.sub.active ? (
            <><span className="mg-check">✓</span> Active plan — eligible to transfer out</>
          ) : (
            <><span className="mg-x">✕</span> No active plan to transfer</>
          )
        ) : user.sub.active ? (
          <><span className="mg-x">✕</span> Existing plan will be cancelled &amp; refunded</>
        ) : (
          <><span className="mg-check">✓</span> No plan — ready to receive the subscription</>
        )}
      </div>
    </div>
  );
}
