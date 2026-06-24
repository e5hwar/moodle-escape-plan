import { useEffect, useMemo, useRef, useState } from "react";
import {
  mergeUsers,
  recordSamples,
  conflictDefs,
  type MergeUser,
  type ConflictDef,
} from "../data/mergeAccounts";
import { SearchIcon } from "./icons";

/**
 * Merge Accounts — a four-step wizard for collapsing two learner accounts into
 * one. Step 1 picks the Primary (kept) and Secondary (deleted) accounts and
 * enforces that B2B/company accounts must be the Primary. Step 2 resolves
 * subscription and duplicate add-on billing. Step 3 merges learning records and
 * resolves per-record conflicts. Step 4 is a read-only review, gated behind a
 * final confirmation modal, after which the merge "runs" and an audit-log entry
 * is shown.
 *
 * All data is demo data (see ../data/mergeAccounts). Nothing is persisted.
 */

type Side = "primary" | "secondary";

const STEPS = [
  { n: 1, label: "Accounts" },
  { n: 2, label: "Billing" },
  { n: 3, label: "Conflicts" },
  { n: 4, label: "Review" },
];

function getUser(id: string | null): MergeUser | null {
  return mergeUsers.find((u) => u.id === id) ?? null;
}

function Avatar({ user, size = 32 }: { user: MergeUser; size?: number }) {
  return (
    <span
      className="mg-avatar"
      style={{
        width: size,
        height: size,
        background: user.color,
        fontSize: size * 0.36,
      }}
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

export function MergeAccountsPage() {
  const [step, setStep] = useState(1);
  const [qPrim, setQPrim] = useState("");
  const [qSec, setQSec] = useState("");
  const [primId, setPrimId] = useState<string | null>(null);
  const [secId, setSecId] = useState<string | null>(null);
  const [subChoice, setSubChoice] = useState<"primary" | "secondary" | "neither">("primary");
  const [addonChoices, setAddonChoices] = useState<Record<string, Side>>({});
  const [conflictChoices, setConflictChoices] = useState<Record<string, Side>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Skills: true, "Path entries": true });
  const [showModal, setShowModal] = useState(false);
  const [mergePhase, setMergePhase] = useState<"idle" | "processing" | "done">("idle");
  const [mergedAt, setMergedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const p = getUser(primId);
  const s = getUser(secId);
  const both = !!p && !!s;
  const b2bViolation = !!(s && s.company);

  function filter(q: string, excludeId: string | null) {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return mergeUsers.filter(
      (u) =>
        u.id !== excludeId &&
        (u.name.toLowerCase().includes(needle) ||
          u.email.toLowerCase().includes(needle) ||
          u.id.toLowerCase().includes(needle))
    );
  }

  const resP = filter(qPrim, secId);
  const resS = filter(qSec, primId);

  const addonConflicts = useMemo(() => {
    if (!p || !s) return [];
    const sa = s.addons;
    return p.addons.filter((a) => sa.some((b) => b.id === a.id));
  }, [p, s]);
  const dupIds = addonConflicts.map((a) => a.id);

  const activeConflicts = useMemo<ConflictDef[]>(() => {
    if (!both) return [];
    return conflictDefs;
  }, [both]);

  const allResolved = activeConflicts.every((c) => conflictChoices[c.id]);

  const preservedAddons = useMemo(() => {
    if (!p || !s) return [];
    const out: { name: string; type: string; price: string; source: string }[] = [];
    p.addons.filter((a) => !dupIds.includes(a.id)).forEach((a) => out.push({ ...a, source: "Primary" }));
    s.addons.filter((a) => !dupIds.includes(a.id)).forEach((a) => out.push({ ...a, source: "Secondary" }));
    return out;
  }, [p, s, dupIds]);

  const totalMerged = s ? Object.values(s.data).reduce((a, b) => a + b, 0) : 0;

  function subText() {
    if (subChoice === "primary") return "Keep Primary's — " + (p ? p.sub.plan : "");
    if (subChoice === "secondary") return "Transfer Secondary's — " + (s ? s.sub.plan : "");
    return "Neither — no active subscription on the merged account";
  }

  function canContinue() {
    if (step === 1) return both && !b2bViolation;
    if (step === 2) return !!subChoice;
    if (step === 3) return allResolved;
    if (step === 4) return true;
    return false;
  }

  function back() {
    if (step > 1 && step <= 4) setStep(step - 1);
  }
  function advance() {
    if (!canContinue()) return;
    if (step < 4) setStep(step + 1);
    else setShowModal(true);
  }
  function swapRoles() {
    setPrimId(secId);
    setSecId(primId);
  }
  function confirmMerge() {
    if (timer.current) clearTimeout(timer.current);
    setShowModal(false);
    setStep(5);
    setMergePhase("processing");
    setMergedAt(new Date());
    timer.current = setTimeout(() => {
      timer.current = null;
      setMergePhase("done");
    }, 1700);
  }
  function restart() {
    if (timer.current) clearTimeout(timer.current);
    setStep(1);
    setQPrim("");
    setQSec("");
    setPrimId(null);
    setSecId(null);
    setSubChoice("primary");
    setAddonChoices({});
    setConflictChoices({});
    setExpanded({ Skills: true, "Path entries": true });
    setShowModal(false);
    setMergePhase("idle");
    setMergedAt(null);
  }

  /* ── derived for steps 3 & 4 ── */
  const recordRows = both && s
    ? Object.keys(s.data).map((key) => {
        const count = s.data[key];
        const samples = recordSamples[key] || [];
        const more = Math.max(0, count - samples.length);
        const def = activeConflicts.find((d) => d.cat === key) || null;
        const resolved = def ? !!conflictChoices[def.id] : true;
        return { key, count, samples, more, def, resolved, isExpanded: !!expanded[key] };
      })
    : [];

  const reviewRows = both && p && s
    ? [
        { icon: "⇄", tone: "blue", title: `${totalMerged} learning records merged`, detail: "Tasks, quizzes, sections, hands-on submissions, skills, awards and paths move from the Secondary into the Primary." },
        { icon: "⚑", tone: "green", title: `${activeConflicts.length} record conflicts resolved`, detail: activeConflicts.map((d) => d.title.split(" — ")[0] + ": kept " + (conflictChoices[d.id] === "secondary" ? "Secondary" : "Primary") + "'s").join(" · ") },
        { icon: "$", tone: "blue", title: "Subscription", detail: subText() },
        { icon: "+", tone: "green", title: `${preservedAddons.length + addonConflicts.length} add-ons settled`, detail: addonConflicts.length ? addonConflicts.map((a) => a.name + ": keep " + ((addonChoices[a.id] || "primary") === "secondary" ? "Secondary" : "Primary") + ", refund other (" + a.price + ")").join(" · ") : "No duplicate add-ons" },
        { icon: "✕", tone: "red", title: "Secondary account deleted", detail: s ? `${s.name} · ${s.email} is permanently removed, including its login.` : "" },
      ]
    : [];

  const modalPoints = both && p && s
    ? [`${totalMerged} records merged into ${p.name}'s account`, subText(), `Secondary login (${s.login}) permanently removed`]
    : [];

  const audit = useMemo(() => {
    if (step !== 5 || !mergedAt || !p || !s) return null;
    const tstr =
      mergedAt.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC";
    const cSummary = activeConflicts.map((d) => d.id + ": kept " + (conflictChoices[d.id] === "secondary" ? "Secondary" : "Primary")).join(" · ");
    const aSummary = addonConflicts.length
      ? addonConflicts.map((a) => a.name + " → kept " + ((addonChoices[a.id] || "primary") === "secondary" ? "Secondary" : "Primary") + ", refunded " + a.price).join(" · ")
      : "none";
    return {
      id: "MERGE-" + mergedAt.getTime().toString(36).toUpperCase(),
      rows: [
        { k: "Primary (kept)", v: `${p.name}  ·  ${p.email}  ·  ${p.id}`, mono: true },
        { k: "Secondary (removed)", v: `${s.name}  ·  ${s.email}  ·  ${s.id}`, mono: true },
        { k: "Performed by", v: "Sarah Chen · sarah.chen@skillcat.com", mono: false },
        { k: "Timestamp", v: tstr, mono: false },
        { k: "Records merged", v: `${totalMerged} learning records`, mono: false },
        { k: "Subscription", v: subText(), mono: false },
        { k: "Add-on refunds", v: aSummary, mono: false },
        { k: "Conflicts resolved", v: `${activeConflicts.length} — ${cSummary}`, mono: false },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mergedAt, primId, secId, conflictChoices, addonChoices]);

  const cont = canContinue();
  const showFooter = step <= 4;
  const footerHint =
    step === 4
      ? "This opens a final confirmation"
      : step === 1
      ? b2bViolation
        ? "Resolve the B2B requirement to continue"
        : both
        ? "Roles set — continue"
        : "Select both accounts"
      : step === 2
      ? "Confirm billing to continue"
      : allResolved
      ? "All conflicts resolved"
      : `${activeConflicts.length} conflict(s) need a decision`;

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks sch-page mg-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Merge Accounts</h1>
              <div className="tasks-subtitle">
                <span>Admin</span>
                <span className="tasks-subtitle-dot" />
                <span>User management</span>
                <span className="tasks-subtitle-dot" />
                <span>Combine two learner accounts into one</span>
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
                <h2 className="mg-h1">Choose which account to keep</h2>
                <p className="mg-lead">
                  Assign each account a role. Everything from the Secondary is merged into the Primary, then the
                  Secondary is permanently deleted.
                </p>

                <div className="mg-grid2">
                  {/* PRIMARY */}
                  <div className="mg-acct-card mg-acct-card--primary">
                    <div className="mg-acct-head mg-acct-head--primary">
                      <div className="mg-acct-head-l">
                        <span className="mg-dot mg-dot--blue" />
                        <span className="mg-acct-role mg-acct-role--blue">PRIMARY · KEPT</span>
                      </div>
                      <span className="mg-acct-note mg-acct-note--blue">🔑 Login preserved</span>
                    </div>
                    <div className="mg-acct-body">
                      <div className="mg-search-wrap">
                        {!p ? (
                          <>
                            <div className="mg-search">
                              <span className="mg-search-ic"><SearchIcon /></span>
                              <input
                                className="mg-search-input"
                                value={qPrim}
                                onChange={(e) => setQPrim(e.target.value)}
                                placeholder="Search the account to keep…"
                              />
                            </div>
                            {qPrim.trim() && resP.length > 0 && (
                              <div className="mg-results">
                                {resP.map((u) => (
                                  <button key={u.id} className="mg-result" onClick={() => { setPrimId(u.id); setQPrim(""); }}>
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
                            {qPrim.trim() && resP.length === 0 && (
                              <div className="mg-noresults">No accounts match "{qPrim}"</div>
                            )}
                          </>
                        ) : (
                          <div className="mg-selected mg-selected--primary">
                            <Avatar user={p} />
                            <span className="mg-result-text">
                              <span className="mg-selected-name">{p.name}<Tag user={p} /></span>
                              <span className="mg-result-email">{p.email}</span>
                            </span>
                            <button className="mg-clear" aria-label="Clear" onClick={() => setPrimId(null)}>×</button>
                          </div>
                        )}
                      </div>
                      {p && <AccountDetails user={p} tone="primary" />}
                    </div>
                  </div>

                  {/* SECONDARY */}
                  <div className="mg-acct-card mg-acct-card--secondary">
                    <div className="mg-acct-head mg-acct-head--secondary">
                      <div className="mg-acct-head-l">
                        <span className="mg-dot mg-dot--red" />
                        <span className="mg-acct-role mg-acct-role--red">SECONDARY</span>
                      </div>
                      <span className="mg-badge-del">WILL BE DELETED</span>
                    </div>
                    <div className="mg-acct-body">
                      <div className="mg-search-wrap">
                        {!s ? (
                          <>
                            <div className="mg-search">
                              <span className="mg-search-ic"><SearchIcon /></span>
                              <input
                                className="mg-search-input"
                                value={qSec}
                                onChange={(e) => setQSec(e.target.value)}
                                placeholder="Search the account to remove…"
                              />
                            </div>
                            {qSec.trim() && resS.length > 0 && (
                              <div className="mg-results">
                                {resS.map((u) => (
                                  <button key={u.id} className="mg-result" onClick={() => { setSecId(u.id); setQSec(""); }}>
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
                            {qSec.trim() && resS.length === 0 && (
                              <div className="mg-noresults">No accounts match "{qSec}"</div>
                            )}
                          </>
                        ) : (
                          <div className="mg-selected mg-selected--secondary">
                            <Avatar user={s} />
                            <span className="mg-result-text">
                              <span className="mg-selected-name">{s.name}<Tag user={s} /></span>
                              <span className="mg-result-email">{s.email}</span>
                            </span>
                            <button className="mg-clear" aria-label="Clear" onClick={() => setSecId(null)}>×</button>
                          </div>
                        )}
                      </div>
                      {s && <AccountDetails user={s} tone="secondary" />}
                    </div>
                  </div>
                </div>

                <div className="mg-swap-row">
                  <button className="mg-swap-btn" onClick={swapRoles}>⇄ Swap roles</button>
                </div>

                {b2bViolation && s && (
                  <div className="mg-banner mg-banner--warn">
                    <span className="mg-banner-ic">⚠</span>
                    <div className="mg-banner-text">
                      <b>{s.name}</b> belongs to the B2B company <b>{s.company}</b>. Company-affiliated accounts must be
                      the Primary.
                    </div>
                    <button className="mg-banner-btn" onClick={swapRoles}>Make it Primary</button>
                  </div>
                )}
                {both && p && s && p.name === s.name && !b2bViolation && (
                  <div className="mg-banner mg-banner--info">
                    <span className="mg-banner-ic">⊙</span>
                    <span>
                      These accounts share the same name and likely belong to the same learner — a good merge
                      candidate.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ───────────── STEP 2 ───────────── */}
            {step === 2 && p && s && (
              <div className="mg-pane">
                <h2 className="mg-h1">Subscriptions &amp; add-ons</h2>
                <p className="mg-lead">
                  Decide what carries over to the merged account. Billing decisions are explicit and run before the
                  merge.
                </p>

                <div className="mg-flowbar">
                  <div className="mg-flowbar-acct is-removed">
                    <Avatar user={s} />
                    <div>
                      <div className="mg-flowbar-email">{s.email}</div>
                      <div className="mg-flowbar-sub mg-flowbar-sub--red">Removed account</div>
                    </div>
                  </div>
                  <span className="mg-flowbar-arrow">→</span>
                  <div className="mg-flowbar-acct">
                    <Avatar user={p} />
                    <div>
                      <div className="mg-flowbar-email">{p.email}</div>
                      <div className="mg-flowbar-sub mg-flowbar-sub--blue">Merged account (kept)</div>
                    </div>
                  </div>
                </div>

                <div className="mg-section-label">SUBSCRIPTION</div>
                <div className="mg-grid2 mg-sub-summary">
                  <div className="mg-sub-card mg-sub-card--primary">
                    <div className="mg-sub-tag mg-sub-tag--blue">PRIMARY</div>
                    <div className="mg-sub-plan">{p.sub.plan}</div>
                    <div className="mg-sub-detail">{p.sub.detail} · {p.sub.price}</div>
                  </div>
                  <div className="mg-sub-card mg-sub-card--removed">
                    <div className="mg-sub-tag mg-sub-tag--red">SECONDARY · REMOVED</div>
                    <div className="mg-sub-plan">{s.sub.plan}</div>
                    <div className="mg-sub-detail">{s.sub.detail} · {s.sub.price}</div>
                  </div>
                </div>

                <div className="mg-sub-options">
                  {[
                    { key: "primary" as const, title: "Keep the Primary's subscription", desc: p.sub.active ? `${p.sub.plan} stays active.` + (s.sub.active ? ` ${s.sub.plan} on the secondary is cancelled.` : "") : "Primary has no paid plan to keep." },
                    { key: "secondary" as const, title: "Transfer the Secondary's subscription", desc: s.sub.active ? `Move ${s.sub.plan} to the merged account.` + (p.sub.active ? ` ${p.sub.plan} is cancelled & refunded pro-rata.` : "") : "Secondary has nothing to transfer." },
                    { key: "neither" as const, title: "Proceed with neither", desc: "Cancel both subscriptions. The merged account keeps no active plan. Add-ons below are still preserved." },
                  ].map((o) => (
                    <button key={o.key} className={`mg-radio-card ${subChoice === o.key ? "is-selected" : ""}`} onClick={() => setSubChoice(o.key)}>
                      <span className={`mg-radio ${subChoice === o.key ? "is-selected" : ""}`} />
                      <span className="mg-radio-text">
                        <span className="mg-radio-title">{o.title}</span>
                        <span className="mg-radio-desc">{o.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mg-section-label">ADD-ONS &amp; ONE-TIME PURCHASES</div>
                <p className="mg-sublead">
                  Permanent purchases (paid certifications, quiz-attempt packs). Always kept on the merged account —
                  except where the same item was bought on both.
                </p>

                {addonConflicts.length > 0 && (
                  <div className="mg-addon-conflicts">
                    {addonConflicts.map((ac) => {
                      const ch = addonChoices[ac.id] || "primary";
                      return (
                        <div key={ac.id} className="mg-addon-conflict">
                          <div className="mg-addon-conflict-head">
                            <span className="mg-pill-warn">PURCHASED ON BOTH</span>
                            <span className="mg-addon-name">{ac.name}</span>
                          </div>
                          <div className="mg-addon-conflict-note">
                            {ac.type} · only one can exist on the merged account. Keep one; the other is refunded ({ac.price}).
                          </div>
                          <div className="mg-grid2">
                            <button className={`mg-opt-card ${ch === "primary" ? "is-selected" : ""}`} onClick={() => setAddonChoices((c) => ({ ...c, [ac.id]: "primary" }))}>
                              <div className="mg-opt-head"><span className={`mg-radio-sm ${ch === "primary" ? "is-selected" : ""}`} /><span className="mg-opt-tag">KEEP PRIMARY'S</span></div>
                              <div className="mg-opt-detail">Refund Secondary's purchase · {ac.price}</div>
                            </button>
                            <button className={`mg-opt-card ${ch === "secondary" ? "is-selected" : ""}`} onClick={() => setAddonChoices((c) => ({ ...c, [ac.id]: "secondary" }))}>
                              <div className="mg-opt-head"><span className={`mg-radio-sm ${ch === "secondary" ? "is-selected" : ""}`} /><span className="mg-opt-tag">KEEP SECONDARY'S</span></div>
                              <div className="mg-opt-detail">Refund Primary's purchase · {ac.price}</div>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mg-preserved">
                  <div className="mg-preserved-head">
                    <span>🔒</span>
                    <span>Always preserved on the merged account</span>
                  </div>
                  <div className="mg-preserved-list">
                    {preservedAddons.map((a, i) => (
                      <div key={i} className="mg-preserved-row">
                        <span className="mg-preserved-l">
                          <span className="mg-check">✓</span>
                          <span className="mg-preserved-name">{a.name}</span>
                          <span className="mg-preserved-type">{a.type}</span>
                        </span>
                        <span className="mg-preserved-src">from {a.source} · {a.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ───────────── STEP 3 ───────────── */}
            {step === 3 && both && (
              <div className="mg-pane">
                <h2 className="mg-h1">Merge learning records</h2>
                <p className="mg-lead">
                  All records from the Secondary merge into the Primary. Expand any row to see what's moving. Where only
                  one record can exist, resolve the conflict.
                </p>

                <div className={`mg-conflict-banner ${allResolved ? "is-ok" : "is-warn"}`}>
                  <span>{allResolved ? "✓" : "⚠"}</span>
                  <span>
                    {allResolved
                      ? "All conflicts resolved — records are ready to merge"
                      : `${activeConflicts.length} conflicts need a decision before continuing`}
                  </span>
                </div>

                <div className="mg-record-rows">
                  {recordRows.map((row) => (
                    <div key={row.key} className="mg-record-row">
                      <button className="mg-record-head" onClick={() => setExpanded((e) => ({ ...e, [row.key]: !e[row.key] }))}>
                        <span className="mg-record-head-l">
                          <span className={`mg-chevron ${row.isExpanded ? "is-open" : ""}`}>▸</span>
                          <span className="mg-record-label">{row.key}</span>
                          {row.def && (
                            <span className={`mg-record-badge ${row.resolved ? "is-ok" : "is-warn"}`}>
                              {row.resolved ? "Resolved" : "1 conflict"}
                            </span>
                          )}
                        </span>
                        <span className="mg-record-count">+{row.count}</span>
                      </button>
                      {row.isExpanded && (
                        <div className="mg-record-detail">
                          {row.def && (
                            <div className="mg-conflict-box">
                              <div className="mg-conflict-box-note">
                                <b>{row.def.title}</b> — {row.def.note}
                              </div>
                              <div className="mg-grid2">
                                <button className={`mg-opt-card ${conflictChoices[row.def.id] === "primary" ? "is-selected" : ""}`} onClick={() => setConflictChoices((c) => ({ ...c, [row.def!.id]: "primary" }))}>
                                  <div className="mg-opt-head"><span className={`mg-radio-sm ${conflictChoices[row.def.id] === "primary" ? "is-selected" : ""}`} /><span className="mg-opt-tag">KEEP PRIMARY'S</span></div>
                                  <div className="mg-opt-strong">{row.def.primDetail}</div>
                                  <div className="mg-opt-meta">{row.def.primMeta}</div>
                                </button>
                                <button className={`mg-opt-card ${conflictChoices[row.def.id] === "secondary" ? "is-selected" : ""}`} onClick={() => setConflictChoices((c) => ({ ...c, [row.def!.id]: "secondary" }))}>
                                  <div className="mg-opt-head"><span className={`mg-radio-sm ${conflictChoices[row.def.id] === "secondary" ? "is-selected" : ""}`} /><span className="mg-opt-tag">KEEP SECONDARY'S</span></div>
                                  <div className="mg-opt-strong">{row.def.secDetail}</div>
                                  <div className="mg-opt-meta">{row.def.secMeta}</div>
                                </button>
                              </div>
                            </div>
                          )}
                          <div className="mg-samples">
                            {row.samples.map((it, i) => (
                              <div key={i} className="mg-sample">
                                <span className="mg-sample-name">{it.name}</span>
                                <span className="mg-sample-meta">{it.meta}</span>
                              </div>
                            ))}
                            {row.more > 0 && <div className="mg-sample-more">+ {row.more} more {row.key}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ───────────── STEP 4 ───────────── */}
            {step === 4 && p && s && (
              <div className="mg-pane">
                <h2 className="mg-h1">Review the merge</h2>
                <p className="mg-lead">
                  A preview of everything that will happen. Nothing has changed yet — confirm on the next step to run the
                  merge.
                </p>

                <div className="mg-grid2 mg-review-acts">
                  <div className="mg-review-act mg-review-act--primary">
                    <div className="mg-review-act-tag mg-review-act-tag--blue">KEPT — PRIMARY</div>
                    <div className="mg-review-act-name">{p.name}</div>
                    <div className="mg-review-act-email">{p.email}</div>
                    <div className="mg-review-act-note mg-review-act-note--blue">🔑 Login &amp; credentials preserved</div>
                  </div>
                  <div className="mg-review-act mg-review-act--secondary">
                    <div className="mg-review-act-tag mg-review-act-tag--red">DELETED — SECONDARY</div>
                    <div className="mg-review-act-name">{s.name}</div>
                    <div className="mg-review-act-email">{s.email}</div>
                    <div className="mg-review-act-note mg-review-act-note--red">✕ Account permanently removed</div>
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
            {step === 5 && mergePhase === "processing" && (
              <div className="mg-processing">
                <span className="mg-spinner" />
                <div className="mg-processing-title">Merging accounts…</div>
                <div className="mg-processing-sub">Moving records, applying billing decisions, removing the secondary account.</div>
              </div>
            )}
            {step === 5 && mergePhase === "done" && p && s && audit && (
              <div className="mg-done">
                <div className="mg-done-check">✓</div>
                <h2 className="mg-h1 mg-done-title">Accounts merged successfully</h2>
                <p className="mg-done-lead">
                  <b>{totalMerged} records</b> from {s.email} were merged into {p.name}'s account. The secondary account
                  has been removed.
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
                  <button className="mg-btn-secondary" onClick={restart}>Merge another pair</button>
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
              className={`mg-btn-advance ${step === 4 ? "is-danger" : ""} ${!cont && step !== 4 ? "is-disabled" : ""}`}
              disabled={!cont}
              onClick={advance}
            >
              {step === 4 ? "Merge accounts" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* confirm modal */}
      {showModal && p && s && (
        <div className="mg-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="mg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mg-modal-icon">⚠</div>
            <h3 className="mg-modal-title">Permanently merge these accounts?</h3>
            <p className="mg-modal-text">
              This <b>cannot be undone</b>. The secondary account <b>{s.email}</b> and its login will be permanently
              deleted.
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
              <button className="mg-btn-danger" onClick={confirmMerge}>Yes, merge accounts</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountDetails({ user, tone }: { user: MergeUser; tone: "primary" | "secondary" }) {
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
      <div className="mg-acct-sublabel">COMPLETION RECORDS</div>
      <div className="mg-record-grid">
        {Object.entries(user.data).map(([k, v]) => (
          <div key={k} className="mg-record-stat">
            <span className="mg-record-stat-k">{k}</span>
            <span className="mg-record-stat-v">{v}</span>
          </div>
        ))}
      </div>
      <div className={`mg-acct-foot mg-acct-foot--${tone}`}>
        {tone === "primary" ? (
          <><span className="mg-check">✓</span> Login, password &amp; auth methods preserved</>
        ) : (
          <><span className="mg-x">✕</span> Account &amp; login permanently deleted after merge</>
        )}
      </div>
    </div>
  );
}
