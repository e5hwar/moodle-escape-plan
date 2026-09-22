import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  mergeUsers,
  categoryRecords,
  conflictDefs,
  type MergeUser,
  type ConflictDef,
} from "../data/mergeAccounts";
import {
  ArrowLeftLongIcon,
  ExpandVerticalIcon,
  InfoCircleIcon,
  InfoTipIcon,
  KeyCommandIcon,
  ClearXIcon,
  SearchIcon,
  ShrinkVerticalIcon,
  SwapRolesIcon,
  TreeCaretIcon,
  TrendUpIcon,
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
 * Merge Accounts — a four-step wizard for collapsing two learner accounts into
 * one. Step 1 picks the Primary (kept) and Secondary (deleted) accounts and
 * enforces that B2B/company accounts must be the Primary. Step 2 resolves
 * subscription and duplicate add-on billing. Step 3 merges learning records and
 * resolves per-record conflicts. Step 4 is a read-only review, gated behind a
 * final confirmation modal, after which the merge "runs" and an audit-log entry
 * is shown.
 *
 * Everything here is assembled from the parts every other wizard uses — the
 * page owns no visual language of its own (re-synced 2026-09-22, the same
 * pass Transfer Subscription had):
 *   shell        -> .wizard-nav rail + .wizard-main behind the edge-line gate
 *                   (wizardGate.tsx) and the ⌘+Enter footer keycap (wizardKeys.tsx)
 *   comparisons  -> the shared .table (Figma 79:443/79:445) + .co-status-pill
 *   callouts     -> NoteCard (Figma 1121:1671), with a trailing action slot
 *   disclosure   -> the Skills page's grouped table (1117:1537): collapsible
 *                   `.skg-group` category rows over `.skg-child` sample rows
 *   choices      -> .radio-card (Figma 134:1790) and .seg-control (359:2373)
 *   accounts     -> AccountPicker fields opening SelectUsersModal (682:2321)
 *   gating       -> the disabled CTA explains itself on hover (aria-disabled +
 *                   data-tip); the rail locks steps not yet reached
 *   confirmation -> PrmModal (Figma 483:588) with the destructive CTA (495:2247)
 *   result       -> .wizard-body--success / .success-summary
 * The page-local .mgf-* rules are layout-only (see the block in index.css).
 *
 * All data is demo data (see ../data/mergeAccounts). Nothing is persisted.
 */

type Side = "primary" | "secondary";
/* There is no "done": the run hands off to the caller and this page goes. */
type Phase = "idle" | "processing";

/* Each step's `desc` is the one line the screen needs; `tip` is the longer
   explanation behind the ⓘ beside it — what actually happens to a learner's
   data, which is the part an admin is accountable for and the part the short
   line can't carry. */
const STEPS = [
  {
    id: "accounts",
    label: "Accounts",
    title: "Choose Accounts to Merge",
    desc: "Choose two accounts. One account remains and the other is permanently deleted at the end of this process.",
    tip: "A merge moves everything off one account and onto the other, then deletes it. The account you keep holds on to its own login, password and auth methods — nothing about how that person signs in changes. Everything on the account you delete moves across: completions, certifications, skills, awards, one-time purchases and, if you choose it, the subscription. A company-affiliated account can never be the one deleted, so a B2B account always has to be the one you keep.",
  },
  {
    id: "conflicts",
    label: "Conflicts",
    title: "Merge learning records",
    desc: "All records from the Secondary merge into the Primary. Expand any row to see what's moving. Where only one record can exist, resolve the conflict.",
    tip: "Records simply move across unless the merged account can only hold one of them — one proficiency per skill, one entry per certification path. Those are the conflicts listed here, and the record you do not keep is discarded rather than archived, so the choice is final.",
  },
  {
    id: "review",
    label: "Review",
    title: "Review the merge",
    desc: "A preview of everything that will happen. Nothing has changed yet — confirm on the next step to run the merge.",
    tip: "Nothing has been written yet. The merge runs only once you confirm in the dialog after this step, and it cannot be undone — the deleted account and its login are gone for good, and an audit-log entry is written naming both accounts and every decision made here.",
  },
];

/** How long the "running…" screen is held before the result. Demo timing. */
const RUN_MS = 1700;

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

/** The account-details rows, at the node's labels (1282:2418). Subscription
 *  joined them when Billing stopped being a step of its own: it is a fact
 *  about each account now, compared like every other, not a decision. */
export function detailRows(u: MergeUser) {
  return [
    { k: "Email", v: u.email },
    { k: "Phone Number", v: u.phone },
    { k: "Login Method", v: u.login },
    { k: "Account Created", v: u.created },
    { k: "Subscription", v: u.sub.active ? u.sub.plan : "" },
    { k: "Company Details", v: u.company ?? "" },
  ];
}

/**
 * One row of a comparison table (Figma 1282:2418 / 1282:2333). Both nodes
 * carry the same three columns — a muted label, the kept account's value, the
 * deleted account's — and the same three treatments on top of them, each of
 * which belongs to one side, so they ride on the row rather than the cell.
 */
export type CompareRow = {
  k: string;
  /** Account Kept — white, Medium. */
  a: ReactNode;
  /** Account Deleted — muted. */
  b: ReactNode;
  /** The deleted value goes with the account, so it reads struck through. */
  strikeB?: boolean;
  /** The deleted value is what blocks the merge: red, with the node's flag. */
  flagB?: boolean;
  /** What the deleted account adds to the kept one — the green "+N ↑". */
  delta?: number;
};

/** Empty cell, at the app's table convention — the node draws a hyphen. */
const DASH = "—";

/**
 * The identity rows, with either side allowed to be empty.
 *
 * The right-hand values are struck through by default, because in a merge that
 * column belongs to the account being deleted and every one of those values
 * goes with it. Transfer Subscription compares the same two accounts without
 * deleting either, so it passes `strike: false` — striking an address that
 * survives the operation would say something untrue.
 */
export function accountCompareRows(
  a: MergeUser | null,
  b: MergeUser | null,
  { strike = true }: { strike?: boolean } = {},
): CompareRow[] {
  const keys = detailRows((a ?? b)!).map((d) => d.k);
  const av = a ? detailRows(a) : null;
  const bv = b ? detailRows(b) : null;
  return keys.map((k, i) => {
    const left = av ? av[i].v : "";
    const right = bv ? bv[i].v : "";
    // A company on the account being DELETED is what blocks the merge, so that
    // is the one value here the table flags rather than strikes.
    const flagB = strike && k === "Company Details" && !!right;
    return {
      k,
      a: left || DASH,
      b: right || DASH,
      strikeB: strike && !!right && !flagB,
      flagB,
    };
  });
}

/* Training Progress (1282:2333) reports four totals, not the seven record
   categories step 3 moves — the labels are the node's, the counts come from
   the same `data` those categories are keyed by. */
const PROGRESS_ROWS: [label: string, key: string][] = [
  ["Tasks Completed", "Task completions"],
  ["Certifications Completed", "Certifications"],
  ["Awards Received", "Awards"],
  ["Skills Earned", "Skills"],
];

/** The four progress totals, with either side allowed to be empty. */
export function recordCompareRows(a: MergeUser | null, b: MergeUser | null): CompareRow[] {
  return PROGRESS_ROWS.map(([label, key]) => {
    const av = a ? a.data[key] ?? 0 : 0;
    const bv = b ? b.data[key] ?? 0 : 0;
    return {
      k: label,
      // Zero reads as empty — unless something is moving in, where the count
      // it is moving into is the point.
      a: av || bv ? av : DASH,
      b: bv || DASH,
      strikeB: bv > 0,
      delta: bv || undefined,
    };
  });
}

/**
 * Two accounts side by side, on the shared `.table` inside a `TableCard`.
 *
 * The Merge nodes (1282:2418 / 1282:2333) name the COLUMNS rather than the
 * accounts, so the role pills the header used to carry are gone — which is
 * also what lets the header hold its 36px instead of wrapping — and the kept
 * column is the emphasised one.
 *
 * Transfer Subscription shares the table and the reading: its columns are the
 * destination and the source, named the same way, with the account that comes
 * out of the operation holding the plan on the emphasised left. Where neither
 * side is the outcome — its step-1 "what these two hold today" — it passes
 * `emphasis="none"` rather than implying one of them is the kept one.
 */
export function CompareTable({
  keptLabel = "Account Kept",
  goneLabel = "Account Deleted",
  leftLabel,
  leftPill,
  leftTone,
  rightLabel,
  rightPill,
  rightTone,
  emphasis = "kept",
  rows,
}: {
  keptLabel?: string;
  goneLabel?: string;
  /** Names the accounts in the header instead, with a pill each. */
  leftLabel?: string;
  leftPill?: string;
  leftTone?: string;
  rightLabel?: string;
  rightPill?: string;
  rightTone?: string;
  /** "none" leaves both value columns muted — neither side is the kept one. */
  emphasis?: "kept" | "none";
  rows: CompareRow[];
}) {
  const named = !!leftLabel || !!rightLabel;
  const head = (label?: string, pill?: string, tone?: string) => (
    <span className="mgf-th">
      {label}
      {pill && <span className={`co-status-pill co-status-pill--${tone}`}>{pill}</span>}
    </span>
  );
  return (
    <table className="table mgf-table mgf-compare">
      <colgroup>
        <col style={{ width: 216 }} />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th />
          <th>{named ? head(leftLabel, leftPill, leftTone) : keptLabel}</th>
          <th>{named ? head(rightLabel, rightPill, rightTone) : goneLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.k}>
            <td className="mgf-c-label">{r.k}</td>
            {/* `col-name` IS this table's emphasised column — white and Medium,
                and already excluded from the muted-cell rule. */}
            <td className={emphasis === "kept" ? "col-name" : undefined}>
              {r.a}
              {r.delta ? (
                <span className="mgf-delta">
                  +{r.delta}
                  <TrendUpIcon />
                </span>
              ) : null}
            </td>
            <td className={r.strikeB ? "mgf-c-gone" : undefined}>
              {r.flagB ? (
                <span className="mgf-flag">
                  {r.b}
                  <WarnTriangleIcon />
                </span>
              ) : (
                r.b
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The step-1 empty state's backdrop: the two comparisons this step is about to
 * load — Account details over Completion records — drawn on the REAL shells
 * (`TableCard` + the page's own `.mgf-table`) with every value replaced by a
 * bar. Nothing here introduces a border, a radius or a colour of its own, so
 * the outline sits exactly where the content will; the bars are the same
 * `.mc-ghost-bar` atom, at the same 0.08, that Manage Completions' empty state
 * uses.
 *
 * Decoration only: aria-hidden, no pointer events, and held right down at the
 * bottom of the page's contrast — enough of an outline to say the comparison
 * lands here, never enough to compete with the question in front of it.
 */
function MergeGhost() {
  return (
    <div className="mgf-ghost" aria-hidden="true">
      {/* The real row counts — five identity rows, then four progress totals —
          so the backdrop is the right shape, both titles included. */}
      <span className="mc-ghost-bar mgf-ghost-heading mgf-ghost-heading--first" />
      <GhostCompare rows={5} />
      <span className="mc-ghost-bar mgf-ghost-heading" />
      <GhostCompare rows={4} />
    </div>
  );
}

/** One ghost comparison card — shared with the Transfer Subscription flow,
 *  whose step 1 draws the same backdrop over its own two tables. */
export function GhostCompare({ rows }: { rows: number }) {
  return (
    <TableCard className="mgf-tcard">
      <table className="table mgf-table mgf-compare">
        <colgroup>
          <col style={{ width: 216 }} />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th />
            <th>
              <span className="mc-ghost-bar mgf-ghost-th" />
            </th>
            <th>
              <span className="mc-ghost-bar mgf-ghost-th" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td className="col-name">
                <span className="mc-ghost-bar" />
              </td>
              <td>
                <span className="mc-ghost-bar" />
              </td>
              <td>
                <span className="mc-ghost-bar" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}

/**
 * The flow card (Figma 1289:2883): where things end up, an arrow pointing into
 * it, and where they came from. No avatars — the two accounts are named, and
 * the direction is the arrow's job.
 *
 * The surviving account is on the LEFT, which is the same reading as the
 * comparison tables (Account Kept then Account Deleted) and why the arrow
 * points left. The right-hand account is muted, and `fromStruck` strikes it
 * through for the case where it does not survive the operation at all.
 */
export function FlowStrip({
  to,
  toSub,
  from,
  fromSub,
  fromStruck = false,
}: {
  /** Left: what receives. */
  to: MergeUser;
  /** Its second line — the account's email unless the flow needs to say more. */
  toSub?: ReactNode;
  /** Right: what it comes from. */
  from: MergeUser;
  fromSub?: ReactNode;
  /** The right-hand account is deleted by this operation, not just emptied. */
  fromStruck?: boolean;
}) {
  return (
    <div className="note-card mgf-flow">
      <span className="mgf-flow-side">
        <span className="mgf-flow-name">{to.name}</span>
        <span className="mgf-flow-sub">{toSub ?? to.email}</span>
      </span>
      <span className="mgf-flow-arrow">
        <ArrowLeftLongIcon />
      </span>
      <span className={`mgf-flow-side mgf-flow-side--from${fromStruck ? " is-struck" : ""}`}>
        <span className="mgf-flow-name">{from.name}</span>
        <span className="mgf-flow-sub">{fromSub ?? from.email}</span>
      </span>
    </div>
  );
}

/**
 * Account picker (Figma 1284:2532 empty / 1284:2662 picked) — the shared 43px
 * search bar standing in for the Select Users table picker (682:2321) it
 * opens. Picking an account does NOT swap the field for a card: the bar keeps
 * its chrome and its search icon, and the value reads inline as the name
 * followed by a muted "· email", with a ✕ at the far end.
 *
 * That is why both states measure the same 43px — a filled field beside an
 * empty one leaves the row level. Both admin flows use this, so the two fields
 * read as one control.
 */
export function AccountPicker({
  user,
  placeholder,
  onPick,
  onClear,
}: {
  user: MergeUser | null;
  placeholder: string;
  /** Opens the table picker — a filled field is a second way back into it,
   *  opening pre-ticked. */
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="usearch mgf-usearch">
      {/* The bar is the shell, not the control: it has to hold the ✕ as well
          as the trigger, and a button cannot nest inside a button. */}
      <div className="usearch-bar mgf-usearch-bar">
        <button className="mgf-usearch-trigger" onClick={onPick}>
          <span className="usearch-icon">
            <SearchIcon />
          </span>
          {user ? (
            <span className="mgf-usearch-value">
              <span className="mgf-usearch-name">{user.name}</span>
              {/* No whitespace between the spans — the 4px is a margin, so a
                  stray text node would add a space on top of it. */}
              <span className="mgf-usearch-sub">· {user.email}</span>
            </span>
          ) : (
            <span className="mgf-usearch-placeholder">{placeholder}</span>
          )}
        </button>
        {/* Clears just this side, without re-opening the picker. */}
        {user && (
          <button className="mgf-usearch-clear" aria-label="Clear" onClick={onClear}>
            <ClearXIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/** The "running…" screen.
 *  Both use the same 720px column and the same footer band, so handing over
 *  from one to the other moves nothing but the words. */
export function FlowProcessing({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="wizard">
      <div className="wizard-body wizard-body--success">
        <div className="wizard-content wizard-success-content mgf-done">
          <span className="mgf-spinner" />
          <h1 className="wizard-title">{title}</h1>
          {/* The "don't navigate away" note lives up here with the copy it
              belongs to, not as footer status text. */}
          <p className="wizard-desc">{sub} This takes a moment — don't navigate away.</p>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left" />
        <div className="wizard-actions" />
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

export function MergeAccountsPage({
  onClose,
  onMerged,
}: {
  onClose?: () => void;
  /** A finished merge leaves the wizard: the caller navigates back to Manage
   *  Users and raises this as its success toast. There is no done screen. */
  onMerged?: (message: string) => void;
}) {
  const [step, setStep] = useState(0);
  // Furthest step reached — the rail is navigable up to here, so stepping Back
  // does not re-lock the steps already answered. Follows `step` upward; only
  // an account change on step 1 pulls it back down.
  const [maxStep, setMaxStep] = useState(0);
  const [primId, setPrimId] = useState<string | null>(null);
  const [secId, setSecId] = useState<string | null>(null);
  const [conflictChoices, setConflictChoices] = useState<Record<string, Side>>({});
  /* Every category starts collapsed — the table opens as the list of what is
     moving, and a category is expanded to read it. */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showModal, setShowModal] = useState(false);
  // Both account fields open the same Select Users picker (Figma 682:2321).
  const [showPicker, setShowPicker] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  /* The run itself: being in "processing" is what arms the hand-off back to
     Manage Users. Deliberately an effect keyed on the phase, NOT a timeout
     stashed in a ref at click time. A ref'd timer is cleared by the cleanup
     that runs on every hot reload and on StrictMode's second mount, and since
     nothing but that timer can leave "processing" — the screen has no buttons
     and this flow has no result screen of its own — losing it strands the
     merge on a spinner for good. Re-running this effect re-arms it.
     Deps are the phase alone on purpose: `onMerged` is an inline arrow from
     App, so listing it would restart the timer on every render up there. */
  useEffect(() => {
    if (phase !== "processing") return;
    const t = setTimeout(() => {
      onMerged?.(
        p && s
          ? `Accounts merged — ${totalMerged} records from ${s.email} moved into ${p.email}`
          : "Accounts merged",
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
  const needsAccounts = step === 0 && !(primId && secId);
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

  const p = getUser(primId);
  const s = getUser(secId);
  const both = !!p && !!s;
  /* Two different B2B problems, and only one of them has a way out. A company
     account can never be the one deleted — so if just the DELETE side is
     company-affiliated, swapping the roles fixes it. If BOTH are, there is no
     arrangement of these two accounts that works and the merge is off.
     Both wait for BOTH sides to be picked: with one account chosen there is no
     arrangement to judge yet, so the screen stays quiet rather than raising an
     alarm about a pairing that does not exist. */
  const bothB2B = !!(p?.company && s?.company);
  const b2bViolation = both && !!s?.company && !bothB2B;

  /* S swaps the roles, the shortcut the B2B banner's button advertises — so it
     is live on exactly the terms that button is, and never in the dead-end
     case, where there is no button. `swapRoles` is hoisted, so it is in scope
     here. */
  useCreateShortcut(swapRoles, step === 0 && b2bViolation && !pickerOpen, "s");

  /* What the empty state asks for depends on which side is still missing —
     one picker serves both, so only the words change. */
  const emptyAsk = !p && !s
    ? {
        title: "Pick the account to keep, then the one to delete",
        sub: "The account you keep holds onto its login, password and auth methods. Everything on the other one — completions, skills, awards and purchases — moves across before it is deleted.",
        cta: "Search Accounts",
      }
    : !s
    ? {
        title: "Now pick the account to delete",
        sub: "Its completions, skills, awards and purchases move into the account you are keeping, and the account itself is permanently deleted at the end.",
        cta: "Search Accounts",
      }
    : {
        title: "Now pick the account to keep",
        sub: "Everything merges into the account you keep, and it is the login, password and auth methods that survive the merge.",
        cta: "Search Accounts",
      };


  const activeConflicts = useMemo<ConflictDef[]>(() => {
    if (!both) return [];
    return conflictDefs;
  }, [both]);

  const openConflicts = activeConflicts.filter((c) => !conflictChoices[c.id]).length;
  const allResolved = openConflicts === 0;

  const totalMerged = s ? Object.values(s.data).reduce((a, b) => a + b, 0) : 0;

  /* Whether step `i` has what it needs to be left going forwards. */
  function cleared(i: number) {
    if (i === 0) return both && !b2bViolation && !bothB2B;
    if (i === 1) return allResolved;
    return true;
  }
  const lastStep = STEPS.length - 1;
  const isLast = step === lastStep;
  const cont = cleared(step);
  /* The greyed-out Continue names the first unmet requirement on hover. */
  const blockedTip = cont
    ? undefined
    : step === 0
      ? !both
        ? "Select both accounts"
        : "A company account must be the Account to Keep — swap the roles"
      : `${openConflicts} ${openConflicts === 1 ? "conflict" : "conflicts"} still ${
          openConflicts === 1 ? "needs" : "need"
        } a decision`;

  const gate = useEdgeLineGate({ step, setStep, lastStep, canGoNext: cont });
  const stepStatuses = useWizardStepStatuses({
    step,
    count: STEPS.length,
    incomplete: (i) => !cleared(i),
  });

  function advance() {
    if (!cont) return;
    if (step < lastStep) gate.goStep(step + 1);
    else setShowModal(true);
  }
  useWizardEnterShortcut(advance);

  /* Changing who is Primary invalidates the billing and conflict decisions
     downstream, so the rail's reach collapses back to this step. */
  function pickAccount(set: (id: string | null) => void, id: string | null) {
    set(id);
    setMaxStep(0);
  }
  /* The picker hands back up to two ids in tick order. An account that already
     held a role keeps it, so re-opening from one field to change the other
     never silently swaps which one is kept. */
  function applyPicked(ids: string[]) {
    const keepP = primId && ids.includes(primId) ? primId : null;
    const keepS = secId && ids.includes(secId) ? secId : null;
    const fresh = ids.filter((id) => id !== keepP && id !== keepS);
    setPrimId(keepP ?? fresh.shift() ?? null);
    setSecId(keepS ?? fresh.shift() ?? null);
    setMaxStep(0);
    setShowPicker(false);
  }
  function swapRoles() {
    setPrimId(secId);
    setSecId(primId);
    setMaxStep(0);
  }
  function confirmMerge() {
    setShowModal(false);
    setPhase("processing");
  }
  /* ── derived for steps 3 & 4 ── */
  const recordRows = both && s
    ? Object.keys(s.data).map((key) => {
        const count = s.data[key];
        // Every record the category moves — expanding it lists all of them.
        const samples = categoryRecords(key, count);
        const def = activeConflicts.find((d) => d.cat === key) || null;
        const resolved = def ? !!conflictChoices[def.id] : true;
        return { key, count, samples, def, resolved, isExpanded: !!expanded[key] };
      })
    : [];
  const allCollapsed = recordRows.every((r) => !r.isExpanded);
  function toggleAll() {
    const open = allCollapsed;
    setExpanded(Object.fromEntries(recordRows.map((r) => [r.key, open])));
  }

  if (phase === "processing") {
    return (
      <FlowProcessing
        title="Merging accounts…"
        sub="Moving records, applying billing decisions, removing the secondary account."
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

  return (
    <div className="wizard">
      <div className="wizard-body">
        {/* ── left rail (Figma 625:1459) ── */}
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">Admin</span>
            <span className="wizard-brand-name">Merge Accounts</span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((x, i) => {
              // Steps not yet reached stay locked — jumping ahead would skip a
              // required decision.
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
            lastStep={lastStep}
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
              <div className="form-row-2 mgf-pickers">
                <div className="form-group">
                  <label className="form-label">
                    Account to Keep<span className="req">*</span>
                  </label>
                  <AccountPicker
                    user={p}
                    placeholder="Search Account to Keep..."
                    onPick={() => setShowPicker(true)}
                    onClear={() => pickAccount(setPrimId, null)}
                  />
                  <p className="form-help">The user continues to have access to this account</p>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Account to Delete<span className="req">*</span>
                  </label>
                  <AccountPicker
                    user={s}
                    placeholder="Search Account to Delete..."
                    onPick={() => setShowPicker(true)}
                    onClear={() => pickAccount(setSecId, null)}
                  />
                  <p className="form-help">The user loses access to this account</p>
                </div>
              </div>

              {b2bViolation && s && (
                <NoteCard
                  tone="danger"
                  icon={<WarnTriangleIcon />}
                  className="mgf-note"
                  /* One SemiBold run, company in parentheses — the node draws
                     no emphasis inside the line. */
                  title={`${s.name} belongs to a B2B Company (${s.company})`}
                  body="Company-affiliated accounts cannot be removed as they are linked to their dashboard."
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
              {bothB2B && p && s && (
                <NoteCard
                  tone="danger"
                  icon={<WarnTriangleIcon />}
                  className="mgf-note"
                  title="Both accounts belong to a B2B Company"
                  body={
                    p.company === s.company
                      ? `${p.name} and ${s.name} are both linked to ${p.company}'s dashboard, so neither one can be removed. Replace one of them with an account that isn't company-affiliated.`
                      : `${p.name} is linked to ${p.company}'s dashboard and ${s.name} to ${s.company}'s, so neither one can be removed. Replace one of them with an account that isn't company-affiliated.`
                  }
                />
              )}

              {both && p && s && p.name === s.name && !b2bViolation && !bothB2B && (
                <NoteCard
                  tone="accent"
                  icon={<InfoCircleIcon />}
                  className="mgf-note"
                  title="These accounts share the same name"
                  body="They likely belong to the same learner — a good merge candidate."
                />
              )}

              {/* The comparison only means anything once both sides are picked —
                  until then the section holds the shared empty state rather
                  than a table of em-dashes. */}
              {both && p && s ? (
                <>
                  {/* No swap in the dead end either — rearranging two company
                      accounts changes nothing about why they can't merge. */}
                  <TableCard
                    title="Account Details"
                    trailing={bothB2B ? undefined : swapButton}
                    className="mgf-tcard"
                  >
                    <CompareTable rows={accountCompareRows(p, s)} />
                  </TableCard>

                  <TableCard title="Training Progress" className="mgf-tcard">
                    <CompareTable rows={recordCompareRows(p, s)} />
                  </TableCard>
                </>
              ) : (
                <>
                  {/* Nothing above the backdrop in this state: no heading (it
                      would sit over a ghost of itself) and no Swap Roles, which
                      only means something once BOTH accounts are picked and so
                      lives on the Account Details card. That also keeps the
                      question below fixed — there is nothing here that can
                      appear and push it down. */}
                  {/* One empty state, the way Manage Completions does it: the
                      comparison this step is about to load drawn as a backdrop,
                      with whatever is still missing asked over the top of it. */}
                  <div className="mgf-empty">
                    <MergeGhost />
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

          {/* ───────────── STEP 2 — Conflicts ───────────── */}
          {step === 1 && both && (
            <>
              {/* Figma 1291:2998. A standing statement of what this step is,
                  not a progress counter: it says the same thing after a
                  decision is made as before, and stays red throughout, because
                  the decisions do not stop being consequential once they are
                  answered. The count is the number of decisions on the screen
                  (always 2 in this data, which is what the body's "These two"
                  is written against). */}
              <NoteCard
                tone="danger"
                icon={<WarnTriangleIcon />}
                className="mgf-note"
                title={`${activeConflicts.length} Decisions Required`}
                body="These two require a confirmation on how to proceed. Please check with the Product or Engineering Teams in case of any questions"
              />

              {/* Each conflict is a flat field: the record as its label, the two
                  candidates as radio cards, the rule as its subtext. */}
              {recordRows.filter((row) => row.def).map((row) => {
                const def = row.def!;
                return (
                  <div className="form-group" key={def.id}>
                    <label className="form-label">
                      {row.key} · {def.title}
                    </label>
                    <div className="radio-card-group">
                      {(["primary", "secondary"] as const).map((side) => (
                        <button
                          key={side}
                          className={`radio-card ${conflictChoices[def.id] === side ? "selected" : ""}`}
                          onClick={() => setConflictChoices((c) => ({ ...c, [def.id]: side }))}
                        >
                          <span className="radio-dot" />
                          <span className="radio-card-text">
                            <span className="radio-card-title">
                              Keep {side === "primary" ? "Primary's" : "Secondary's"}
                            </span>
                            {/* One subtext line, not two: the component
                                (134:1790) carries a single 14px line under its
                                title, so the detail and its metadata are joined
                                with the app's middle dot. */}
                            <span className="radio-card-desc">
                              {side === "primary"
                                ? [def.primDetail, def.primMeta].filter(Boolean).join(" · ")
                                : [def.secDetail, def.secMeta].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="form-help">
                      {def.note.charAt(0).toUpperCase() + def.note.slice(1)}
                    </p>
                  </div>
                );
              })}

            </>
          )}

          {/* ───────────── STEP 3 — Review ───────────── */}
          {step === 2 && p && s && (
            <>
              {/* The Learning-records row says what moves in the delta column
                  rather than in the prose, the way Training Progress does. */}
              <TableCard title="Summary of Updates" className="mgf-tcard">
                <CompareTable
                  rows={[
                    { k: "Email", a: p.email, b: s.email, strikeB: true },
                    {
                      k: "Login Method",
                      a: `${p.login} · preserved`,
                      b: s.login,
                      strikeB: true,
                    },
                    {
                      k: "Learning Records",
                      a: Object.values(p.data).reduce((x, y) => x + y, 0),
                      b: totalMerged || "—",
                      delta: totalMerged || undefined,
                      strikeB: totalMerged > 0,
                    },
                    { k: "Account After Merge", a: "Active", b: "Permanently deleted" },
                  ]}
                />
              </TableCard>

              {/* What moves, per category — the Skills page's grouped table:
                  a collapsible category row over its sample records. Titled by
                  the card, like every other card table on the page. */}
              <TableCard title="Complete List of Changes" className="mgf-tcard">
                <table className="table mgf-table mgf-records">
                  <colgroup>
                    <col />
                    <col style={{ width: "38%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>
                        <span className="th-content">
                          <button
                            type="button"
                            className="skg-toggle-all"
                            title={allCollapsed ? "Expand All" : "Collapse All"}
                            aria-label={allCollapsed ? "Expand All" : "Collapse All"}
                            onClick={toggleAll}
                          >
                            {allCollapsed ? <ExpandVerticalIcon /> : <ShrinkVerticalIcon />}
                          </button>
                          Record
                        </span>
                      </th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordRows.map((row) => (
                      <Fragment key={row.key}>
                        <tr
                          className="skg-group"
                          aria-expanded={row.isExpanded}
                          onClick={() => setExpanded((e) => ({ ...e, [row.key]: !e[row.key] }))}
                        >
                          <td className="col-name">
                            <button
                              type="button"
                              className={`skg-caret ${row.isExpanded ? "is-open" : ""}`}
                              aria-label={row.isExpanded ? "Collapse" : "Expand"}
                              aria-expanded={row.isExpanded}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpanded((x) => ({ ...x, [row.key]: !x[row.key] }));
                              }}
                            >
                              <TreeCaretIcon />
                            </button>
                            <span className="skg-name">{row.key}</span>
                          </td>
                          <td>+{row.count} moving from the Secondary</td>
                        </tr>
                        {row.isExpanded &&
                          row.samples.map((it, i) => (
                            <tr className="skg-row skg-child" key={i}>
                              <td className="col-name">{it.name}</td>
                              <td>{it.meta}</td>
                            </tr>
                          ))}

                      </Fragment>
                    ))}
                  </tbody>
                </table>
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
              still missing. On the last step the button is the merge itself
              and opens the final confirmation. */}
          <button
            className={`btn-publish${isLast ? "" : " wizard-gate-btn"}${cont ? "" : " is-disabled"}`}
            aria-disabled={!cont}
            data-tip={blockedTip}
            onClick={advance}
          >
            {!isLast && <span className="wizard-gate-fill" ref={gate.nextFillRef} />}
            <span className="wizard-gate-btn-inner">
              {isLast ? "Merge Accounts" : "Continue"}
              <WizardKeyHint />
            </span>
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
          /* Prose, not a summary list: the review step behind this dialog is
             where the detail lives, and repeating a digest of it here just
             asks to be read twice. */
          description={
            <>
              Everything on <strong>{s.email}</strong> — {totalMerged} learning records, its
              certifications, skills, awards and purchases — moves into{" "}
              <strong>{p.email}</strong>, which keeps its own login. {s.name}'s account and
              login are then permanently deleted. This cannot be undone.
            </>
          }
          confirmLabel="Yes, merge accounts"
          danger
          onCancel={() => setShowModal(false)}
          onConfirm={confirmMerge}
        />
      )}
    </div>
  );
}
