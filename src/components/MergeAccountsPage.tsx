import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  mergeUsers,
  recordSamples,
  conflictDefs,
  type MergeUser,
  type ConflictDef,
} from "../data/mergeAccounts";
import {
  AlertTriangleIcon,
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
import { SectionHeading } from "./SectionHeading";
import { PrmModal } from "./PrmModal";
import { SelectUsersModal } from "./SelectUsersModal";

/**
 * Merge Accounts — a four-step wizard for collapsing two learner accounts into
 * one. Step 1 picks the Primary (kept) and Secondary (deleted) accounts and
 * enforces that B2B/company accounts must be the Primary. Step 2 resolves
 * subscription and duplicate add-on billing. Step 3 merges learning records and
 * resolves per-record conflicts. Step 4 is a read-only review, gated behind a
 * final confirmation modal, after which the merge "runs" and an audit-log entry
 * is shown.
 *
 * Everything here is assembled from shared design-system parts — the page owns
 * no visual language of its own:
 *   shell        -> .wizard / .wizard-nav / .wizard-content / .wizard-footer
 *                   (Figma 625:1459 rail, 73:515 footer), WizardStepRail
 *   sections     -> SectionHeading (Figma 104:376)
 *   comparisons  -> the shared .table (Figma 79:443/79:445) + .co-status-pill
 *   callouts     -> .mc-notice (neutral notice with a trailing action slot)
 *   disclosure   -> the .mc-acc accordion
 *   choices      -> .radio-card (Figma 134:1790) and .seg-control (359:2373)
 *   account search -> the Manage-Users combobox (.usearch-*)
 *   confirmation -> PrmModal (Figma 483:588) with the destructive CTA (495:2247)
 *   result       -> .wizard-body--success / .success-summary
 * The page root is `.wizard .mc-root` — .mc-root only carries the --mc-* tokens
 * that .mc-notice / .mc-acc read, and otherwise restates .wizard exactly.
 * The page-local .mgf-* rules are layout-only (see the block in index.css).
 *
 * All data is demo data (see ../data/mergeAccounts). Nothing is persisted.
 */

type Side = "primary" | "secondary";
type Phase = "idle" | "processing" | "done";

const STEPS = [
  {
    id: "accounts",
    label: "Accounts",
    title: "Choose Accounts to Merge",
    desc: "Choose two accounts. One account remains and the other is permanently deleted at the end of this process.",
  },
  {
    id: "billing",
    label: "Billing",
    title: "Subscriptions & add-ons",
    desc: "Decide what carries over to the merged account. Billing decisions are explicit and run before the merge.",
  },
  {
    id: "conflicts",
    label: "Conflicts",
    title: "Merge learning records",
    desc: "All records from the Secondary merge into the Primary. Expand any row to see what's moving. Where only one record can exist, resolve the conflict.",
  },
  {
    id: "review",
    label: "Review",
    title: "Review the merge",
    desc: "A preview of everything that will happen. Nothing has changed yet — confirm on the next step to run the merge.",
  },
];

function getUser(id: string | null): MergeUser | null {
  return mergeUsers.find((u) => u.id === id) ?? null;
}

/* ─────────────── Shared primitives ───────────────
   These are shared with the Transfer Subscription flow, which runs on the same
   fixtures and the same design-system parts. */

/** The app's avatar (.mc-avatar), sized by prop. */
export function Avatar({ user, size = 32 }: { user: MergeUser; size?: number }) {
  return (
    <span
      className="mc-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {user.initials}
    </span>
  );
}

/** B2B / B2C account type, as a shared status pill (Figma 109:1237). */
export function TypePill({ user }: { user: MergeUser }) {
  return (
    <span className={`co-status-pill co-status-pill--${user.company ? "purple" : "secondary"}`}>
      {user.company ? "B2B" : "B2C"}
    </span>
  );
}

export function detailRows(u: MergeUser) {
  return [
    { k: "Email", v: u.email },
    { k: "Phone", v: u.phone },
    { k: "Account created", v: u.created },
    { k: "Login method", v: u.login },
    { k: "Company", v: u.company ? `${u.company} · B2B` : "None (individual)" },
  ];
}

/** Neutral notice with an optional leading glyph, status pill and trailing
 *  action — the design system's .mc-notice. */
export function Notice({
  tone = "info",
  icon,
  pill,
  pillTone = "secondary",
  title,
  sub,
  action,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  icon?: ReactNode;
  pill?: string;
  pillTone?: "accent" | "red" | "yellow" | "green" | "secondary" | "purple" | "grey";
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mc-notice">
      {icon && <span className={`mgf-lead mgf-lead--${tone}`}>{icon}</span>}
      <div className="mc-notice-text">
        <div className="mc-notice-title">{title}</div>
        {sub && <div className="mc-notice-sub">{sub}</div>}
      </div>
      {pill && <span className={`co-status-pill co-status-pill--${pillTone}`}>{pill}</span>}
      {action}
    </div>
  );
}

export type CompareRow = { k: string; a: ReactNode; b: ReactNode };

/** Placeholder for a side that has not been picked yet. */
const EMPTY = "—";

/** The five identity rows, with either side allowed to be empty. */
export function accountCompareRows(a: MergeUser | null, b: MergeUser | null): CompareRow[] {
  const av = a ? detailRows(a) : null;
  const bv = b ? detailRows(b) : null;
  const keys = detailRows((a ?? b)!).map((d) => d.k);
  return keys.map((k, i) => ({ k, a: av ? av[i].v : EMPTY, b: bv ? bv[i].v : EMPTY }));
}

/** Completion-record counts plus a total, with either side allowed to be empty. */
export function recordCompareRows(a: MergeUser | null, b: MergeUser | null): CompareRow[] {
  const keys = Object.keys((a ?? b)!.data);
  const total = (u: MergeUser) => Object.values(u.data).reduce((x, y) => x + y, 0);
  return [
    ...keys.map((k) => ({ k, a: a ? a.data[k] : EMPTY, b: b ? b.data[k] : EMPTY })),
    { k: "Total", a: a ? total(a) : EMPTY, b: b ? total(b) : EMPTY },
  ];
}

/** Two accounts side by side on the shared .table. The role pills live in the
 *  header row — the plain-text-column rule strips pill chrome inside <td>. */
export function CompareTable({
  leftLabel,
  leftPill,
  leftTone,
  rightLabel,
  rightPill,
  rightTone,
  rows,
}: {
  leftLabel: string;
  leftPill?: string;
  leftTone?: string;
  rightLabel: string;
  rightPill?: string;
  rightTone?: string;
  rows: CompareRow[];
}) {
  return (
    <table className="table sch-table mgf-table">
      <colgroup>
        <col style={{ width: "34%" }} />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th />
          <th>
            <span className="mgf-th">
              {leftLabel}
              {leftPill && <span className={`co-status-pill co-status-pill--${leftTone}`}>{leftPill}</span>}
            </span>
          </th>
          <th>
            <span className="mgf-th">
              {rightLabel}
              {rightPill && <span className={`co-status-pill co-status-pill--${rightTone}`}>{rightPill}</span>}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.k}>
            <td className="col-name">{r.k}</td>
            <td>{r.a}</td>
            <td>{r.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** From → to strip, built from the table's user cell (.mc-cell-user). */
export function FlowStrip({
  from,
  fromNote,
  to,
  toNote,
}: {
  from: MergeUser;
  fromNote: string;
  to: MergeUser;
  toNote: string;
}) {
  return (
    <div className="mc-notice mgf-flow">
      <span className="mc-cell-user">
        <Avatar user={from} size={28} />
        <span className="mc-cell-user-text">
          <span className="mc-cell-user-name">{from.email}</span>
          <span className="mc-cell-user-sub">{fromNote}</span>
        </span>
      </span>
      <span className="mgf-flow-arrow">
        <ArrowGlyph />
      </span>
      <span className="mc-cell-user">
        <Avatar user={to} size={28} />
        <span className="mc-cell-user-text">
          <span className="mc-cell-user-name">{to.email}</span>
          <span className="mc-cell-user-sub">{toNote}</span>
        </span>
      </span>
    </div>
  );
}

const ArrowGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Account picker — the shared search combobox, then the picked-account row. */
export function AccountPicker({
  user,
  query,
  results,
  placeholder,
  emptyText,
  onQuery,
  onPick,
  onClear,
  onOpenPicker,
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
  /** When set, the empty field is a trigger for a table picker instead of an
   *  inline combobox — Merge Accounts opens SelectUsersModal this way, Transfer
   *  keeps the combobox. The bar keeps its search chrome either way, so the two
   *  flows still read as the same control. */
  onOpenPicker?: () => void;
}) {
  if (user) {
    // With a table picker the filled row is a second way back into it, opening
    // pre-ticked; the ✕ still clears just this side.
    return (
      <div
        className={`mgf-picked${onOpenPicker ? " mgf-picked--clickable" : ""}`}
        onClick={onOpenPicker}
      >
        <span className="mc-cell-user">
          <Avatar user={user} />
          <span className="mc-cell-user-text">
            <span className="mc-cell-user-name">{user.name}</span>
            <span className="mc-cell-user-sub">{user.email}</span>
          </span>
        </span>
        <TypePill user={user} />
        <button
          className="mc-iconbtn"
          aria-label="Clear"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          <SmallXIcon />
        </button>
      </div>
    );
  }

  if (onOpenPicker) {
    return (
      <div className="usearch mgf-usearch">
        <button className="usearch-bar mgf-usearch-trigger" onClick={onOpenPicker}>
          <span className="usearch-icon">
            <SearchIcon />
          </span>
          <span className="mgf-usearch-placeholder">{placeholder}</span>
        </button>
      </div>
    );
  }

  const open = query.trim().length > 0;
  return (
    <div className="usearch mgf-usearch">
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
                <span className="mgf-row-pill">
                  <TypePill user={u} />
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Shared wizard chrome for the "running…" and "done" screens.
 *  Both use the same 720px column and the same footer band, so handing over
 *  from one to the other moves nothing but the words. */
export function FlowProcessing({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="wizard mc-root">
      <div className="wizard-body wizard-body--success">
        <div className="wizard-content wizard-success-content mgf-done">
          <span className="mgf-spinner" />
          <h1 className="wizard-title">{title}</h1>
          <p className="wizard-desc">{sub}</p>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <span className="wizard-saved">This takes a moment — don't navigate away.</span>
        </div>
        <div className="wizard-actions" />
      </footer>
    </div>
  );
}

export type AuditLog = { id: string; rows: { k: string; v: string; mono: boolean }[] };

export function FlowDone({
  title,
  lead,
  audit,
  primaryLabel,
  onPrimary,
  onClose,
}: {
  title: string;
  lead: ReactNode;
  audit: AuditLog;
  primaryLabel: string;
  onPrimary: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="wizard mc-root">
      <div className="wizard-body wizard-body--success">
        <div className="wizard-content wizard-success-content mgf-done">
          <div className="wizard-success-icon">
            <CheckBoldIcon />
          </div>
          <h1 className="wizard-title">{title}</h1>
          <p className="wizard-desc">{lead}</p>

          <SectionHeading
            label="Audit log entry"
            trailing={<span className="co-status-pill co-status-pill--secondary">{audit.id}</span>}
          />
          <div className="success-summary">
            {audit.rows.map((r) => (
              <div className="success-detail-row" key={r.k}>
                <span className="success-detail-label">{r.k}</span>
                <span className={`success-detail-value${r.mono ? " is-mono" : ""}`}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>
            Back to Manage Users
          </button>
        </div>
        <div className="wizard-actions">
          <button className="btn-save-draft">View full audit log</button>
          <button className="btn-publish" onClick={onPrimary}>
            {primaryLabel}
          </button>
        </div>
      </footer>
    </div>
  );
}

/** Escape closes the topmost confirm dialog. */
export function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

/* ─────────────── The page ─────────────── */

export function MergeAccountsPage({ onClose }: { onClose?: () => void }) {
  const [step, setStep] = useState(0);
  // Furthest step cleared — the rail is navigable up to here, so stepping Back
  // does not re-lock the steps already answered.
  const [maxStep, setMaxStep] = useState(0);
  const [qPrim, setQPrim] = useState("");
  const [qSec, setQSec] = useState("");
  const [primId, setPrimId] = useState<string | null>(null);
  const [secId, setSecId] = useState<string | null>(null);
  const [subChoice, setSubChoice] = useState<"primary" | "secondary" | "neither">("primary");
  const [addonChoices, setAddonChoices] = useState<Record<string, Side>>({});
  const [conflictChoices, setConflictChoices] = useState<Record<string, Side>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Skills: true, "Path entries": true });
  const [showModal, setShowModal] = useState(false);
  // Both account fields open the same Select Users picker (Figma 682:2321).
  const [showPicker, setShowPicker] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [mergedAt, setMergedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Each step starts at its own top, not wherever the previous one was scrolled.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [step]);
  useEscape(showModal, () => setShowModal(false));

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

  const openConflicts = activeConflicts.filter((c) => !conflictChoices[c.id]).length;
  const allResolved = openConflicts === 0;

  const preservedAddons = useMemo(() => {
    if (!p || !s) return [];
    const out: { name: string; type: string; price: string; source: string }[] = [];
    p.addons.filter((a) => !dupIds.includes(a.id)).forEach((a) => out.push({ ...a, source: "Primary" }));
    s.addons.filter((a) => !dupIds.includes(a.id)).forEach((a) => out.push({ ...a, source: "Secondary" }));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, s, dupIds.join()]);

  const totalMerged = s ? Object.values(s.data).reduce((a, b) => a + b, 0) : 0;

  function subText() {
    if (subChoice === "primary") return "Keep Primary's — " + (p ? p.sub.plan : "");
    if (subChoice === "secondary") return "Transfer Secondary's — " + (s ? s.sub.plan : "");
    return "Neither — no active subscription on the merged account";
  }

  function canContinue() {
    if (step === 0) return both && !b2bViolation;
    if (step === 1) return !!subChoice;
    if (step === 2) return allResolved;
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
  /* Changing who is Primary invalidates the billing and conflict decisions
     downstream, so the rail's reach collapses back to this step. */
  function pickAccount(set: (id: string | null) => void, id: string | null) {
    set(id);
    setMaxStep(0);
  }
  /* The picker returns the ticked accounts in tick order: first is kept,
     second is deleted. One tick fills the kept side and leaves the other empty,
     which is exactly the half-picked state the step already handles. */
  function applyPicked(ids: string[]) {
    setPrimId(ids[0] ?? null);
    setSecId(ids[1] ?? null);
    setMaxStep(0);
    setShowPicker(false);
  }
  function swapRoles() {
    setPrimId(secId);
    setSecId(primId);
    setMaxStep(0);
  }
  function confirmMerge() {
    if (timer.current) clearTimeout(timer.current);
    setShowModal(false);
    setPhase("processing");
    setMergedAt(new Date());
    timer.current = setTimeout(() => {
      timer.current = null;
      setPhase("done");
    }, 1700);
  }
  function restart() {
    if (timer.current) clearTimeout(timer.current);
    setStep(0);
    setMaxStep(0);
    setQPrim("");
    setQSec("");
    setPrimId(null);
    setSecId(null);
    setSubChoice("primary");
    setAddonChoices({});
    setConflictChoices({});
    setExpanded({ Skills: true, "Path entries": true });
    setShowModal(false);
    setPhase("idle");
    setMergedAt(null);
  }

  /* ── derived for steps 3 & 4 ── */
  const recordRows = both && s
    ? Object.keys(s.data).map((key) => {
        const count = s.data[key];
        // Never list more samples than the category actually moves.
        const samples = (recordSamples[key] || []).slice(0, count);
        const more = Math.max(0, count - samples.length);
        const def = activeConflicts.find((d) => d.cat === key) || null;
        const resolved = def ? !!conflictChoices[def.id] : true;
        return { key, count, samples, more, def, resolved, isExpanded: !!expanded[key] };
      })
    : [];

  const reviewRows = both && p && s
    ? [
        { icon: <SwapIcon />, tone: "info" as const, title: `${totalMerged} learning records merged`, detail: "Tasks, quizzes, sections, hands-on submissions, skills, awards and paths move from the Secondary into the Primary." },
        { icon: <CheckBoldIcon />, tone: "ok" as const, title: `${activeConflicts.length} record conflicts resolved`, detail: activeConflicts.map((d) => d.title.split(" — ")[0] + ": kept " + (conflictChoices[d.id] === "secondary" ? "Secondary" : "Primary") + "'s").join(" · ") },
        { icon: <CreditCardIcon />, tone: "info" as const, title: "Subscription", detail: subText() },
        { icon: <PlusCircleIcon />, tone: "ok" as const, title: `${preservedAddons.length + addonConflicts.length} add-ons settled`, detail: addonConflicts.length ? addonConflicts.map((a) => a.name + ": keep " + ((addonChoices[a.id] || "primary") === "secondary" ? "Secondary" : "Primary") + ", refund other (" + a.price + ")").join(" · ") : "No duplicate add-ons" },
        { icon: <XCircleIcon />, tone: "danger" as const, title: "Secondary account deleted", detail: s ? `${s.name} · ${s.email} is permanently removed, including its login.` : "" },
      ]
    : [];

  const modalPoints = both && p && s
    ? [`${totalMerged} records merged into ${p.name}'s account`, subText(), `Secondary login (${s.login}) permanently removed`]
    : [];

  const audit = useMemo<AuditLog | null>(() => {
    if (phase !== "done" || !mergedAt || !p || !s) return null;
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
  }, [phase, mergedAt, primId, secId, conflictChoices, addonChoices]);

  const cont = canContinue();
  const isLast = step === STEPS.length - 1;

  if (phase === "processing") {
    return (
      <FlowProcessing
        title="Merging accounts…"
        sub="Moving records, applying billing decisions, removing the secondary account."
      />
    );
  }
  if (phase === "done" && p && s && audit) {
    return (
      <FlowDone
        title="Accounts merged successfully"
        lead={
          <>
            <strong>{totalMerged} records</strong> from {s.email} were merged into {p.name}'s account. The
            secondary account has been removed.
          </>
        }
        audit={audit}
        primaryLabel="Merge another pair"
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
            <span className="wizard-brand-name">Merge Accounts</span>
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
                    <label className="form-label">Account to Keep</label>
                    <span className="co-status-pill co-status-pill--accent">Kept</span>
                  </div>
                  <AccountPicker
                    user={p}
                    query={qPrim}
                    results={resP}
                    placeholder="Search the account to keep…"
                    onQuery={setQPrim}
                    onPick={(id) => { pickAccount(setPrimId, id); setQPrim(""); }}
                    onClear={() => pickAccount(setPrimId, null)}
                    onOpenPicker={() => setShowPicker(true)}
                  />
                  <p className="form-help">
                    Everything merges into this account. Its login, password and auth methods are preserved.
                  </p>
                </div>

                <div className="form-group">
                  <div className="form-label-row">
                    <label className="form-label">Account to Delete</label>
                    <span className="co-status-pill co-status-pill--red">Deleted</span>
                  </div>
                  <AccountPicker
                    user={s}
                    query={qSec}
                    results={resS}
                    placeholder="Search the account to remove…"
                    onQuery={setQSec}
                    onPick={(id) => { pickAccount(setSecId, id); setQSec(""); }}
                    onClear={() => pickAccount(setSecId, null)}
                    onOpenPicker={() => setShowPicker(true)}
                  />
                  <p className="form-help">
                    All data from this account is transferred and the account is permanently deleted.
                  </p>
                </div>
              </div>

              {b2bViolation && s && (
                <Notice
                  tone="danger"
                  icon={<AlertTriangleIcon />}
                  pill="Action required"
                  pillTone="red"
                  title={
                    <>
                      <strong>{s.name}</strong> belongs to the B2B company <strong>{s.company}</strong>
                    </>
                  }
                  sub="Company-affiliated accounts must be the Primary. Swap the roles to continue."
                  action={
                    <button className="btn-save-draft mc-btn-sm" onClick={swapRoles}>
                      Make it Primary
                    </button>
                  }
                />
              )}

              {both && p && s && p.name === s.name && !b2bViolation && (
                <Notice
                  tone="info"
                  icon={<InfoCircleIcon />}
                  pill="Likely duplicate"
                  pillTone="accent"
                  title="These accounts share the same name"
                  sub="They likely belong to the same learner — a good merge candidate."
                />
              )}

              {/* The comparison only means anything once both sides are picked —
                  until then the section holds the shared empty state rather
                  than a table of em-dashes. */}
              {both && p && s ? (
                <>
                  <SectionHeading
                    label="Account details"
                    trailing={
                      <button className="btn-save-draft mc-btn-sm" onClick={swapRoles}>
                        <SwapIcon /> Swap roles
                      </button>
                    }
                  />
                  <CompareTable
                    leftLabel={p.name}
                    leftPill="Account to keep"
                    leftTone="accent"
                    rightLabel={s.name}
                    rightPill="Account to delete"
                    rightTone="red"
                    rows={accountCompareRows(p, s)}
                  />

                  <SectionHeading label="Completion records" />
                  <CompareTable
                    leftLabel={p.name}
                    leftPill="Kept"
                    leftTone="accent"
                    rightLabel={s.name}
                    rightPill="Moves into the kept account"
                    rightTone="secondary"
                    rows={recordCompareRows(p, s)}
                  />

                  <Notice
                    tone="ok"
                    icon={<LockIcon />}
                    title={`${p.name}'s login is preserved`}
                    sub={`${s.name}'s login (${s.login}) is deleted with the account to delete.`}
                  />
                </>
              ) : (
                <>
                  <SectionHeading label="Account details" />
                  <div className="co-empty-state mgf-empty">
                    <span className="co-empty-glyph">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 8h13M14 5l3 3-3 3" />
                        <path d="M20 16H7M10 13l-3 3 3 3" />
                      </svg>
                    </span>
                    <div className="co-empty-title">Nothing to compare yet</div>
                    <div className="co-empty-sub">
                      Select both accounts to see their details and completion records side by side.
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ───────────── STEP 2 — Billing ───────────── */}
          {step === 1 && p && s && (
            <>
              <FlowStrip
                from={s}
                fromNote="Removed account"
                to={p}
                toNote="Merged account (kept)"
              />

              <SectionHeading label="Subscription" />
              <CompareTable
                leftLabel={p.name}
                leftPill="Primary"
                leftTone="accent"
                rightLabel={s.name}
                rightPill="Secondary · removed"
                rightTone="red"
                rows={[
                  { k: "Plan", a: p.sub.plan, b: s.sub.plan },
                  { k: "Status", a: p.sub.detail, b: s.sub.detail },
                  { k: "Price", a: p.sub.price, b: s.sub.price },
                ]}
              />

              <div className="radio-card-group mgf-choices">
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

              <SectionHeading label="Add-ons & one-time purchases" />
              <p className="form-help mgf-lede">
                Permanent purchases (paid certifications, quiz-attempt packs). Always kept on the merged account —
                except where the same item was bought on both.
              </p>

              {addonConflicts.map((ac) => {
                const ch = addonChoices[ac.id] || "primary";
                return (
                  <div className="mc-notice" key={ac.id}>
                    <span className="mgf-lead mgf-lead--warn">
                      <AlertTriangleIcon />
                    </span>
                    <div className="mc-notice-text">
                      <div className="mc-notice-title">{ac.name}</div>
                      <div className="mc-notice-sub">
                        Purchased on both · {ac.type}. Only one can exist on the merged account; the other is
                        refunded ({ac.price}).
                      </div>
                    </div>
                    <div className="seg-control">
                      {(["primary", "secondary"] as const).map((side) => (
                        <button
                          key={side}
                          className={`seg-btn ${ch === side ? "active" : ""}`}
                          onClick={() => setAddonChoices((c) => ({ ...c, [ac.id]: side }))}
                        >
                          Keep {side === "primary" ? "Primary's" : "Secondary's"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              <SectionHeading label="Always preserved on the merged account" />
              {preservedAddons.length === 0 ? (
                <p className="form-help mgf-lede">No one-time purchases on either account.</p>
              ) : (
                <table className="table sch-table mgf-table">
                  <colgroup>
                    <col />
                    <col style={{ width: 170 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 90 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Type</th>
                      <th>From</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preservedAddons.map((a, i) => (
                      <tr key={i}>
                        <td className="col-name">{a.name}</td>
                        <td>{a.type}</td>
                        <td>{a.source}</td>
                        <td>{a.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ───────────── STEP 3 — Conflicts ───────────── */}
          {step === 2 && both && (
            <>
              <Notice
                tone={allResolved ? "ok" : "warn"}
                icon={allResolved ? <CheckBoldIcon /> : <AlertTriangleIcon />}
                pill={allResolved ? "Ready" : `${openConflicts} to resolve`}
                pillTone={allResolved ? "green" : "yellow"}
                title={
                  allResolved
                    ? "All conflicts resolved — records are ready to merge"
                    : `${openConflicts} of ${activeConflicts.length} conflicts still need a decision`
                }
                sub="Expand a category to see what is moving and, where only one record can exist, pick which one survives."
              />

              <div className="mc-acc-list">
                {recordRows.map((row) => (
                  <div className={`mc-acc${row.isExpanded ? " is-open" : ""}`} key={row.key}>
                    <div
                      className="mc-acc-head"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpanded((e) => ({ ...e, [row.key]: !e[row.key] }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpanded((x) => ({ ...x, [row.key]: !x[row.key] }));
                        }
                      }}
                    >
                      <div className="mc-acc-text">
                        <div className="mc-acc-titlerow">
                          <span className="mc-acc-name">{row.key}</span>
                          {row.def && (
                            <span className={`co-status-pill co-status-pill--${row.resolved ? "green" : "yellow"}`}>
                              {row.resolved ? "Resolved" : "1 conflict"}
                            </span>
                          )}
                        </div>
                        <div className="mc-acc-meta">
                          <span className="mc-acc-metatext">+{row.count} moving from the Secondary</span>
                        </div>
                      </div>
                      <span className="mc-acc-caret">
                        <ChevronDownIcon />
                      </span>
                    </div>

                    {row.isExpanded && (
                      <div className="mc-acc-body">
                        {row.def && (
                          <>
                            <SectionHeading label="Resolve conflict" />
                            <p className="form-help mgf-lede">
                              <strong>{row.def.title}</strong> — {row.def.note}
                            </p>
                            <div className="radio-card-group">
                              {(["primary", "secondary"] as const).map((side) => (
                                <button
                                  key={side}
                                  className={`radio-card ${conflictChoices[row.def!.id] === side ? "selected" : ""}`}
                                  onClick={() => setConflictChoices((c) => ({ ...c, [row.def!.id]: side }))}
                                >
                                  <span className="radio-dot" />
                                  <span className="radio-card-text">
                                    <span className="radio-card-title">
                                      Keep {side === "primary" ? "Primary's" : "Secondary's"}
                                    </span>
                                    <span className="radio-card-desc">
                                      {side === "primary" ? row.def!.primDetail : row.def!.secDetail}
                                    </span>
                                    <span className="mgf-meta">
                                      {side === "primary" ? row.def!.primMeta : row.def!.secMeta}
                                    </span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        <SectionHeading label="Sample records" />
                        <table className="table sch-table mgf-table">
                          <colgroup>
                            <col />
                            <col style={{ width: "38%" }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>Record</th>
                              <th>Detail</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.samples.map((it, i) => (
                              <tr key={i}>
                                <td className="col-name">{it.name}</td>
                                <td>{it.meta}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {row.more > 0 && (
                          <p className="form-help">+ {row.more} more not shown</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ───────────── STEP 4 — Review ───────────── */}
          {step === 3 && p && s && (
            <>
              <CompareTable
                leftLabel={p.name}
                leftPill="Kept — primary"
                leftTone="accent"
                rightLabel={s.name}
                rightPill="Deleted — secondary"
                rightTone="red"
                rows={[
                  { k: "Email", a: p.email, b: s.email },
                  { k: "Login method", a: `${p.login} · preserved`, b: `${s.login} · removed` },
                  {
                    k: "Learning records",
                    a: `${Object.values(p.data).reduce((x, y) => x + y, 0)} + ${totalMerged} merged in`,
                    b: `${totalMerged} moved out`,
                  },
                  { k: "Account after merge", a: "Active", b: "Permanently deleted" },
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
            {isLast ? "Merge accounts" : "Continue"}
          </button>
        </div>
      </footer>

      {showPicker && (
        <SelectUsersModal
          value={[primId, secId].filter((id): id is string => !!id)}
          onCancel={() => setShowPicker(false)}
          onConfirm={applyPicked}
        />
      )}

      {/* ── confirm (Figma 483:588 + the destructive CTA 495:2247) ── */}
      {showModal && p && s && (
        <PrmModal
          title="Permanently merge these accounts?"
          description={
            <>
              This cannot be undone. The secondary account <strong>{s.email}</strong> and its login will be
              permanently deleted.
            </>
          }
          confirmLabel="Yes, merge accounts"
          danger
          onCancel={() => setShowModal(false)}
          onConfirm={confirmMerge}
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
