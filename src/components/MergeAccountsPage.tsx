import { useEffect, useMemo, useRef, useState } from "react";
import {
  mergeUsers,
  recordSamples,
  conflictDefs,
  type MergeUser,
  type ConflictDef,
} from "../data/mergeAccounts";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckBoldIcon,
  ChevronDownIcon,
  CreditCardIcon,
  InfoCircleIcon,
  LockIcon,
  PlusCircleIcon,
  SearchIcon,
  SmallXIcon,
  SwapIcon,
  XCircleIcon,
} from "./icons";
import { WizardStepRail, type WizardStepStatus } from "./WizardStepRail";

/**
 * Merge Accounts — a four-step wizard for collapsing two learner accounts into
 * one. Step 1 picks the Primary (kept) and Secondary (deleted) accounts and
 * enforces that B2B/company accounts must be the Primary. Step 2 resolves
 * subscription and duplicate add-on billing. Step 3 merges learning records and
 * resolves per-record conflicts. Step 4 is a read-only review, gated behind a
 * final confirmation modal, after which the merge "runs" and an audit-log entry
 * is shown.
 *
 * Chrome comes from the shared design system: the page header (.tasks-header),
 * the quiet step rail (WizardStepRail), the Manage-Users search combobox
 * (.usearch-*), radio cards (.radio-card), the wizard footer and the shared
 * .pm-* modal. The page-local .mg-* rules only add layout and the two role
 * accents — accent orange for the kept account, danger red for the removed one.
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

/* The account primitives below are shared with the Transfer Subscription flow,
   which runs on the same fixtures and the same .mg-* chrome. */

export function Avatar({ user, small }: { user: MergeUser; small?: boolean }) {
  return <span className={`mg-avatar ${small ? "mg-avatar--sm" : ""}`}>{user.initials}</span>;
}

export function TypePill({ user }: { user: MergeUser }) {
  return (
    <span className={`u-pill ${user.company ? "u-type--b2b" : "u-type--b2c"}`}>
      {user.company ? "B2B" : "B2C"}
    </span>
  );
}

export function detailRows(u: MergeUser) {
  return [
    { k: "Email", v: u.email, company: false },
    { k: "Phone", v: u.phone, company: false },
    { k: "Account created", v: u.created, company: false },
    { k: "Login method", v: u.login, company: false },
    { k: "Company", v: u.company || "None (individual)", company: !!u.company },
  ];
}

/** Account picker — the shared search combobox plus the picked-account row. */
export function AccountPicker({
  user,
  query,
  results,
  placeholder,
  emptyText,
  onQuery,
  onPick,
  onClear,
}: {
  user: MergeUser | null;
  query: string;
  results: MergeUser[];
  placeholder: string;
  /** Overrides the default "no accounts match" copy (Transfer flags B2B accounts). */
  emptyText?: string;
  onQuery: (q: string) => void;
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  if (user) {
    return (
      <div className="mg-selected">
        <Avatar user={user} />
        <span className="mg-selected-text">
          <span className="mg-selected-name">
            {user.name}
            <TypePill user={user} />
          </span>
          <span className="mg-selected-email">{user.email}</span>
        </span>
        <button className="mg-clear" aria-label="Clear" onClick={onClear}>
          <SmallXIcon />
        </button>
      </div>
    );
  }

  const open = query.trim().length > 0;
  return (
    <div className="usearch mg-usearch">
      <div className={`usearch-bar ${open ? "open" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <input
          className="usearch-input"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      {open && (
        <div className="usearch-panel">
          <div className="usearch-head">Accounts</div>
          {results.length === 0 ? (
            <div className="usearch-empty">{emptyText ?? `No accounts match "${query}"`}</div>
          ) : (
            results.map((u) => (
              <button key={u.id} className="usearch-row" onClick={() => onPick(u.id)}>
                <span className="usearch-avatar">{u.initials}</span>
                <span className="usearch-user-text">
                  <span className="usearch-user-name">{u.name}</span>
                  <span className="usearch-user-sub">{u.email}</span>
                </span>
                <TypePill user={u} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
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
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Each step starts at its own top, not wherever the previous one was scrolled.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [step]);

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
        { icon: <SwapIcon />, tone: "accent", title: `${totalMerged} learning records merged`, detail: "Tasks, quizzes, sections, hands-on submissions, skills, awards and paths move from the Secondary into the Primary." },
        { icon: <CheckBoldIcon />, tone: "ok", title: `${activeConflicts.length} record conflicts resolved`, detail: activeConflicts.map((d) => d.title.split(" — ")[0] + ": kept " + (conflictChoices[d.id] === "secondary" ? "Secondary" : "Primary") + "'s").join(" · ") },
        { icon: <CreditCardIcon />, tone: "accent", title: "Subscription", detail: subText() },
        { icon: <PlusCircleIcon />, tone: "ok", title: `${preservedAddons.length + addonConflicts.length} add-ons settled`, detail: addonConflicts.length ? addonConflicts.map((a) => a.name + ": keep " + ((addonChoices[a.id] || "primary") === "secondary" ? "Secondary" : "Primary") + ", refund other (" + a.price + ")").join(" · ") : "No duplicate add-ons" },
        { icon: <XCircleIcon />, tone: "drop", title: "Secondary account deleted", detail: s ? `${s.name} · ${s.email} is permanently removed, including its login.` : "" },
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
        <div className="tasks mg-page">
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
                <h2 className="form-section-title">Choose which account to keep</h2>
                <p className="form-section-desc">
                  Assign each account a role. Everything from the Secondary is merged into the Primary, then the
                  Secondary is permanently deleted.
                </p>

                <div className="mg-grid2">
                  {/* PRIMARY */}
                  <div className="mg-acct mg-acct--keep">
                    <div className="mg-acct-head">
                      <span className="mg-role mg-role--keep">Primary · kept</span>
                      <span className="mg-acct-note">
                        <LockIcon /> Login preserved
                      </span>
                    </div>
                    <div className="mg-acct-body">
                      <AccountPicker
                        user={p}
                        query={qPrim}
                        results={resP}
                        placeholder="Search the account to keep…"
                        onQuery={setQPrim}
                        onPick={(id) => { setPrimId(id); setQPrim(""); }}
                        onClear={() => setPrimId(null)}
                      />
                      {p && <AccountDetails user={p} tone="keep" />}
                    </div>
                  </div>

                  {/* SECONDARY */}
                  <div className="mg-acct mg-acct--drop">
                    <div className="mg-acct-head">
                      <span className="mg-role mg-role--drop">Secondary</span>
                      <span className="mg-tag mg-tag--drop">Will be deleted</span>
                    </div>
                    <div className="mg-acct-body">
                      <AccountPicker
                        user={s}
                        query={qSec}
                        results={resS}
                        placeholder="Search the account to remove…"
                        onQuery={setQSec}
                        onPick={(id) => { setSecId(id); setQSec(""); }}
                        onClear={() => setSecId(null)}
                      />
                      {s && <AccountDetails user={s} tone="drop" />}
                    </div>
                  </div>
                </div>

                <div className="mg-swap-row">
                  <button className="btn-save-draft" onClick={swapRoles}>
                    <SwapIcon /> Swap roles
                  </button>
                </div>

                {b2bViolation && s && (
                  <div className="mg-note mg-note--warn">
                    <span className="mg-note-icon"><AlertTriangleIcon /></span>
                    <div className="mg-note-text">
                      <strong>{s.name}</strong> belongs to the B2B company <strong>{s.company}</strong>.
                      Company-affiliated accounts must be the Primary.
                    </div>
                    <button className="btn-save-draft" onClick={swapRoles}>Make it Primary</button>
                  </div>
                )}
                {both && p && s && p.name === s.name && !b2bViolation && (
                  <div className="mg-note mg-note--info">
                    <span className="mg-note-icon"><InfoCircleIcon /></span>
                    <div className="mg-note-text">
                      These accounts share the same name and likely belong to the same learner — a good merge
                      candidate.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ───────────── STEP 2 ───────────── */}
            {step === 2 && p && s && (
              <div className="mg-pane">
                <h2 className="form-section-title">Subscriptions &amp; add-ons</h2>
                <p className="form-section-desc">
                  Decide what carries over to the merged account. Billing decisions are explicit and run before the
                  merge.
                </p>

                <div className="mg-flow">
                  <div className="mg-flow-acct is-out">
                    <Avatar user={s} small />
                    <div>
                      <div className="mg-flow-email">{s.email}</div>
                      <div className="mg-flow-sub mg-flow-sub--drop">Removed account</div>
                    </div>
                  </div>
                  <span className="mg-flow-arrow"><ArrowRightIcon /></span>
                  <div className="mg-flow-acct">
                    <Avatar user={p} small />
                    <div>
                      <div className="mg-flow-email">{p.email}</div>
                      <div className="mg-flow-sub mg-flow-sub--keep">Merged account (kept)</div>
                    </div>
                  </div>
                </div>

                <div className="mg-section-label">Subscription</div>
                <div className="mg-grid2 mg-plans">
                  <div className="mg-plan mg-plan--keep">
                    <div className="mg-plan-tag mg-plan-tag--keep">Primary</div>
                    <div className="mg-plan-name">{p.sub.plan}</div>
                    <div className="mg-plan-detail">{p.sub.detail} · {p.sub.price}</div>
                  </div>
                  <div className="mg-plan mg-plan--drop">
                    <div className="mg-plan-tag mg-plan-tag--drop">Secondary · removed</div>
                    <div className="mg-plan-name">{s.sub.plan}</div>
                    <div className="mg-plan-detail">{s.sub.detail} · {s.sub.price}</div>
                  </div>
                </div>

                <div className="radio-card-group" style={{ marginBottom: 30 }}>
                  {[
                    { key: "primary" as const, title: "Keep the Primary's subscription", desc: p.sub.active ? `${p.sub.plan} stays active.` + (s.sub.active ? ` ${s.sub.plan} on the secondary is cancelled.` : "") : "Primary has no paid plan to keep." },
                    { key: "secondary" as const, title: "Transfer the Secondary's subscription", desc: s.sub.active ? `Move ${s.sub.plan} to the merged account.` + (p.sub.active ? ` ${p.sub.plan} is cancelled & refunded pro-rata.` : "") : "Secondary has nothing to transfer." },
                    { key: "neither" as const, title: "Proceed with neither", desc: "Cancel both subscriptions. The merged account keeps no active plan. Add-ons below are still preserved." },
                  ].map((o) => (
                    <button
                      key={o.key}
                      className={`radio-card ${subChoice === o.key ? "selected" : ""}`}
                      onClick={() => setSubChoice(o.key)}
                    >
                      <span className="radio-dot" />
                      <span className="radio-card-text">
                        <span className="radio-card-title">{o.title}</span>
                        <span className="radio-card-desc">{o.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="mg-section-label">Add-ons &amp; one-time purchases</div>
                <p className="mg-sublead">
                  Permanent purchases (paid certifications, quiz-attempt packs). Always kept on the merged account —
                  except where the same item was bought on both.
                </p>

                {addonConflicts.length > 0 && (
                  <div className="mg-dups">
                    {addonConflicts.map((ac) => {
                      const ch = addonChoices[ac.id] || "primary";
                      return (
                        <div key={ac.id} className="mg-dup">
                          <div className="mg-dup-head">
                            <span className="mg-tag mg-tag--warn">Purchased on both</span>
                            <span className="mg-dup-name">{ac.name}</span>
                          </div>
                          <div className="mg-dup-note">
                            {ac.type} · only one can exist on the merged account. Keep one; the other is refunded ({ac.price}).
                          </div>
                          <div className="mg-opts">
                            {(["primary", "secondary"] as const).map((side) => (
                              <button
                                key={side}
                                className={`radio-card mg-opt ${ch === side ? "selected" : ""}`}
                                onClick={() => setAddonChoices((c) => ({ ...c, [ac.id]: side }))}
                              >
                                <span className="radio-dot" />
                                <span className="mg-opt-body">
                                  <span className="mg-opt-tag">Keep {side === "primary" ? "Primary's" : "Secondary's"}</span>
                                  <span className="mg-opt-detail">
                                    Refund {side === "primary" ? "Secondary's" : "Primary's"} purchase · {ac.price}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mg-keeplist">
                  <div className="mg-keeplist-head">
                    <LockIcon />
                    <span>Always preserved on the merged account</span>
                  </div>
                  {preservedAddons.length === 0 ? (
                    <div className="mg-keeplist-empty">No one-time purchases on either account.</div>
                  ) : (
                    preservedAddons.map((a, i) => (
                      <div key={i} className="mg-keeprow">
                        <span className="mg-keeprow-l">
                          <CheckBoldIcon />
                          <span className="mg-keeprow-name">{a.name}</span>
                          <span className="mg-keeprow-type">{a.type}</span>
                        </span>
                        <span className="mg-keeprow-src">from {a.source} · {a.price}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ───────────── STEP 3 ───────────── */}
            {step === 3 && both && (
              <div className="mg-pane">
                <h2 className="form-section-title">Merge learning records</h2>
                <p className="form-section-desc">
                  All records from the Secondary merge into the Primary. Expand any row to see what's moving. Where only
                  one record can exist, resolve the conflict.
                </p>

                <div className={`mg-note ${allResolved ? "mg-note--ok" : "mg-note--warn"}`} style={{ marginTop: 0 }}>
                  <span className="mg-note-icon">{allResolved ? <CheckBoldIcon /> : <AlertTriangleIcon />}</span>
                  <div className="mg-note-text">
                    {allResolved
                      ? "All conflicts resolved — records are ready to merge"
                      : `${activeConflicts.length} conflicts need a decision before continuing`}
                  </div>
                </div>

                <div className="mg-rows">
                  {recordRows.map((row) => (
                    <div key={row.key} className="mg-row">
                      <button className="mg-row-head" onClick={() => setExpanded((e) => ({ ...e, [row.key]: !e[row.key] }))}>
                        <span className="mg-row-l">
                          <span className={`mg-chevron ${row.isExpanded ? "is-open" : ""}`}><ChevronDownIcon /></span>
                          <span className="mg-row-label">{row.key}</span>
                          {row.def && (
                            <span className={`mg-tag ${row.resolved ? "mg-tag--ok" : "mg-tag--warn"}`}>
                              {row.resolved ? "Resolved" : "1 conflict"}
                            </span>
                          )}
                        </span>
                        <span className="mg-row-count">+{row.count}</span>
                      </button>
                      {row.isExpanded && (
                        <div className="mg-row-detail">
                          {row.def && (
                            <div className="mg-conflict-box">
                              <div className="mg-conflict-note">
                                <strong>{row.def.title}</strong> — {row.def.note}
                              </div>
                              <div className="mg-opts">
                                {(["primary", "secondary"] as const).map((side) => (
                                  <button
                                    key={side}
                                    className={`radio-card mg-opt ${conflictChoices[row.def!.id] === side ? "selected" : ""}`}
                                    onClick={() => setConflictChoices((c) => ({ ...c, [row.def!.id]: side }))}
                                  >
                                    <span className="radio-dot" />
                                    <span className="mg-opt-body">
                                      <span className="mg-opt-tag">Keep {side === "primary" ? "Primary's" : "Secondary's"}</span>
                                      <span className="mg-opt-strong">
                                        {side === "primary" ? row.def!.primDetail : row.def!.secDetail}
                                      </span>
                                      <span className="mg-opt-meta">
                                        {side === "primary" ? row.def!.primMeta : row.def!.secMeta}
                                      </span>
                                    </span>
                                  </button>
                                ))}
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
                <h2 className="form-section-title">Review the merge</h2>
                <p className="form-section-desc">
                  A preview of everything that will happen. Nothing has changed yet — confirm on the next step to run the
                  merge.
                </p>

                <div className="mg-grid2 mg-outcomes">
                  <div className="mg-outcome mg-outcome--keep">
                    <div className="mg-outcome-tag mg-outcome-tag--keep">Kept — primary</div>
                    <div className="mg-outcome-name">{p.name}</div>
                    <div className="mg-outcome-email">{p.email}</div>
                    <div className="mg-outcome-note"><LockIcon /> Login &amp; credentials preserved</div>
                  </div>
                  <div className="mg-outcome mg-outcome--drop">
                    <div className="mg-outcome-tag mg-outcome-tag--drop">Deleted — secondary</div>
                    <div className="mg-outcome-name">{s.name}</div>
                    <div className="mg-outcome-email">{s.email}</div>
                    <div className="mg-outcome-note"><XCircleIcon /> Account permanently removed</div>
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
            {step === 5 && mergePhase === "processing" && (
              <div className="mg-processing">
                <span className="mg-spinner" />
                <div className="mg-processing-title">Merging accounts…</div>
                <div className="mg-processing-sub">Moving records, applying billing decisions, removing the secondary account.</div>
              </div>
            )}
            {step === 5 && mergePhase === "done" && p && s && audit && (
              <div className="mg-pane mg-done">
                <div className="mg-done-check"><CheckBoldIcon /></div>
                <h2 className="mg-done-title">Accounts merged successfully</h2>
                <p className="mg-done-lead">
                  <strong>{totalMerged} records</strong> from {s.email} were merged into {p.name}'s account. The
                  secondary account has been removed.
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
                  <button className="btn-publish" onClick={restart}>Merge another pair</button>
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
                  className={`btn-publish ${step === 4 ? "mg-btn-danger" : ""}`}
                  disabled={!cont}
                  onClick={advance}
                >
                  {step === 4 ? "Merge accounts" : "Continue"}
                </button>
              </div>
            </footer>
          )}
        </div>
      </div>

      {/* confirm modal */}
      {showModal && p && s && (
        <div className="pm-overlay" onClick={() => setShowModal(false)}>
          <div
            className="pm-modal mg-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm merge"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pm-head">
              <div className="mg-modal-icon"><AlertTriangleIcon /></div>
              <h3 className="pm-title">Permanently merge these accounts?</h3>
              <p className="pm-sub">
                This cannot be undone. The secondary account <strong>{s.email}</strong> and its login will be
                permanently deleted.
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
              <button className="btn-publish mg-btn-danger" onClick={confirmMerge}>Yes, merge accounts</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountDetails({ user, tone }: { user: MergeUser; tone: "keep" | "drop" }) {
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
      <div className="mg-sublabel">Completion records</div>
      <div className="mg-stats">
        {Object.entries(user.data).map(([k, v]) => (
          <div key={k} className="mg-stat">
            <span className="mg-stat-k">{k}</span>
            <span className="mg-stat-v">{v}</span>
          </div>
        ))}
      </div>
      <div className={`mg-acct-foot ${tone === "keep" ? "is-ok" : "is-bad"}`}>
        {tone === "keep" ? (
          <><CheckBoldIcon /> Login, password &amp; auth methods preserved</>
        ) : (
          <><XCircleIcon /> Account &amp; login permanently deleted after merge</>
        )}
      </div>
    </div>
  );
}
