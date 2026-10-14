/* Every Certification's panel shows a thumbnail: its own, else this sample
   (Figma 1585:1620) as a placeholder until the seed carries real ones. */
import certThumbPlaceholder from "../assets/cert-thumb-sample.jpg";
import { contentLinksFor, type Link } from "../data/contentLinks";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  CERT_OPTIONAL_COLUMNS,
  CERT_FIXED_COLUMNS,
  isSkillCatCert,
  certReferences,
  type Certification,
  type CertReference,
  type CertColumn,
} from "../data/certifications";
import { type Award } from "../data/awards";
import { certIndustryText, industryTagLabels, useLiveIndustries } from "../data/industries";
import {
  CertFilters,
  certMatches,
  setupMatches,
  type CertFilterState,
  type CertColumnState,
} from "./CertFilters";
import { EditColumnsButton, orderedColumns } from "./Filters";
import { SortIcon, AddIcon, RowEditIcon, RowEyeIcon, RowEyeOffIcon, RowKebabIcon, RowDeleteIcon, MenuAllTasksIcon, MenuAwardIcon, MenuBackupIcon, SetupIndustriesIcon, SetupAwardIcon, SetupCheckIcon, MenuPaidIcon, MenuLinkIcon, MenuProgressIcon, MenuResponsesIcon, MenuArchiveReplaceIcon, PagePrevIcon, PageNextIcon, NoteChevronIcon, RowCloseIcon } from "./icons";
import { pickTag, pickTags, audienceOf, AUDIENCE_ALL_USERS, TRADE_TAGS, PARTNERSHIP_TAGS } from "../data/filters";
import { appToday } from "../data/companies";
import { PrmModal } from "./PrmModal";
import { PreviewPanel, formatCount, seededInt, type PreviewStat } from "./PreviewPanel";
import { CertificationSummary, useCertPreview } from "./NewCertificationWizard";
import { Dropdown } from "./Dropdown";
import { CertImportModal } from "./CertImportModal";
import { CertBulkUploadModal } from "./CertBulkUploadModal";
import type { CertImportReport } from "../data/certImport";
import { useCollapsingHeader } from "../hooks/useCollapsingHeader";
import { useListState, useResetPageOnChange } from "../hooks/useListState";
import { CertificationsSearch } from "./CertificationsSearch";
import { CertIndustriesModal } from "./CertIndustriesModal";
import { CopiedToast } from "./CopiedToast";
import { usePersisted } from "../hooks/usePersisted";
import { TableCols } from "./TableCols";
import { TableEmpty } from "./TableEmpty";

const PAGE_SIZE = 50;

/* ── Post-creation setup (Claude Design "Certification Post-Creation Setup",
   2026-10-01) ──
   After an admin creates a Certification, four optional follow-ups are
   expected in most cases: Industries, Content Links, an Award, a Feedback
   Form. Only Industries used to be prompted (the modal that ends the wizard);
   the other three sat in the row's ⋯ menu. The page now shows all four
   without rebuilding any of the flows: a landing banner that condenses into
   the title note, a yellow "Setup n/4" pill on each unfinished row, a Setup
   card at the top of the row panel's Details, a Setup › Incomplete filter the
   banner's "Show All N" applies, and a toast when each flow returns.

   The status is DERIVED, never stored: App.tsx reads each step off the data
   its flow writes (`setupStepsFor`). The only state of its own is
   "Mark as Done" (persisted per admin) and the session's "Set up later". */
export type SetupStepKey = "industries" | "links" | "award" | "feedback";
/** One step, as App.tsx derives it: done, with a one-line summary when so. */
export type SetupStep = {
  done: boolean;
  detail?: string;
  /** The step doesn't apply to this Certification (Industries on a
   *  company-created one): not shown, not counted, never offered. */
  na?: boolean;
};
export type SetupSteps = Record<SetupStepKey, SetupStep>;
/** The banner's session state, held in App.tsx so it survives the round trip
 *  through a flow: "Set up later" (cleared by the next create), and the
 *  Certifications seen pending this session — once they are all done, the
 *  banner says so (in its green tone) instead of vanishing. */
export type SetupBannerState = { dismissed: boolean };

/* Who gets Setup status at all (spec review 2026-10-09): a SkillCat-created,
   All Users Certification, and only for its first 30 days (Date Created).
   A B2B Companies Only or company-created one never has it, and an older one
   simply stops showing it — no pill, banner, Setup filter match or card. */
const SETUP_WINDOW_DAYS = 30;
function hasSetupStatus(cert: Certification): boolean {
  if (!isSkillCatCert(cert) || audienceOf(cert.tags) !== AUDIENCE_ALL_USERS) return false;
  const created = Date.parse(cert.dateCreated ?? "");
  if (!created) return false;
  return appToday().getTime() - created < SETUP_WINDOW_DAYS * 86_400_000;
}

type SetupStatus = {
  /** The Certification gets Setup status at all (`hasSetupStatus`). */
  eligible: boolean;
  steps: SetupSteps;
  /** The steps that apply to this Certification, keycapped 1…n in order. */
  list: SetupStepDef[];
  done: number;
  left: number;
  /** "Mark as Done" was pressed — the remaining steps don't apply. */
  closed: boolean;
  /** Eligible, steps left, not closed, not archived: counted, pilled,
   *  bannered. */
  pending: boolean;
};

type SetupStepDef = {
  key: SetupStepKey;
  short: string;
  label: string;
  body: string;
  doneTitle: string;
  kbd: string;
  icon: JSX.Element;
};
const SETUP_STEPS: SetupStepDef[] = [
  /* Labels, bodies and "Industries Added" are Figma 1592:2588's copy; the
     other three done titles follow that pattern (not drawn yet). */
  {
    key: "industries",
    short: "Industries",
    label: "Industries",
    body: "Tag the Industries and Sub-Industries learners browse it under.",
    doneTitle: "Industries Added",
    kbd: "1",
    icon: <SetupIndustriesIcon />,
  },
  {
    key: "links",
    short: "Content Links",
    label: "Content Link",
    body: "Link the prerequisite, recommended and related content.",
    doneTitle: "Content Links Added",
    kbd: "2",
    icon: <MenuLinkIcon />,
  },
  {
    key: "award",
    short: "Award",
    label: "Awards",
    body: "The card or certificate learners earn on completion.",
    doneTitle: "Award Added",
    kbd: "3",
    icon: <SetupAwardIcon />,
  },
  {
    key: "feedback",
    short: "Feedback Form",
    label: "Feedback Form",
    body: "Ask learners for feedback once they complete it.",
    doneTitle: "Feedback Form Added",
    kbd: "4",
    icon: <MenuResponsesIcon />,
  },
];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* The Create Certification menu. Each row keeps the letter of its own
   distinctive word: S(cratch), B(ackup), C(SV). "C" doing double duty is safe
   — it only picks CSV Upload while the menu is already open, and opening it is
   all "C" does while it is closed. */
type UploadPath = "backup" | "csv";

const CREATE_OPTIONS: { key: "scratch" | UploadPath; label: string; shortcut: string }[] = [
  { key: "scratch", label: "From Scratch", shortcut: "S" },
  { key: "backup", label: "Upload Backup", shortcut: "B" },
  { key: "csv", label: "CSV Upload", shortcut: "C" },
];

// Trigger a client-side file download (used for Certification backups).
function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function backupCertification(cert: Certification) {
  const payload = {
    format: "skillcat-certification-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    certification: cert,
  };
  const safeName = cert.name.replace(/[^\w.-]+/g, "_");
  downloadTextFile(`${cert.id}-${safeName}.cert.json`, JSON.stringify(payload, null, 2), "application/json");
}

type SortKey =
  | "id"
  | "name"
  | "industry"
  | "careerStage"
  | "type"
  | "payment"
  | "tasks"
  | "ceus"
  | "createdBy"
  | "tradeTag"
  | "partnershipTag"
  | "audience"
  | "visibility"
  | "dateCreated"
  | "dateModified";
type SortDir = "asc" | "desc";

const STAGE_RANK: Record<string, number> = {
  "Pre-Apprentice": 0,
  Apprentice: 1,
  Journeyman: 2,
  Master: 3,
};

/** CEUs as a number for sorting: blank / non-numeric is -1, below every real
 *  value (CEUs are never negative). */
function ceusValue(ceus: string | undefined): number {
  const n = parseFloat(ceus ?? "");
  return Number.isFinite(n) ? n : -1;
}

function compare(a: Certification, b: Certification, key: SortKey): number {
  switch (key) {
    case "id": return a.id.localeCompare(b.id);
    case "name": return a.name.localeCompare(b.name);
    case "industry": return certIndustryText(a.industries).localeCompare(certIndustryText(b.industries));
    case "careerStage":
      return (
        (a.careerStage ? STAGE_RANK[a.careerStage] : 99) -
        (b.careerStage ? STAGE_RANK[b.careerStage] : 99)
      );
    case "type": return (a.type ?? "").localeCompare(b.type ?? "");
    // Free certs sort first, then paid (Consumable / Non-consumable) alphabetically.
    case "payment": return (a.payment ?? "").localeCompare(b.payment ?? "");
    // A blank (or unreadable) CEUs value sorts as the lowest, never NaN.
    case "ceus": return ceusValue(a.ceus) - ceusValue(b.ceus);
    case "tasks": return a.tasks - b.tasks;
    case "createdBy": return a.createdBy.localeCompare(b.createdBy);
    case "tradeTag": return (pickTag(a.tags, TRADE_TAGS) ?? "").localeCompare(pickTag(b.tags, TRADE_TAGS) ?? "");
    case "partnershipTag": return (pickTag(a.tags, PARTNERSHIP_TAGS) ?? "").localeCompare(pickTag(b.tags, PARTNERSHIP_TAGS) ?? "");
    case "audience": return audienceOf(a.tags).localeCompare(audienceOf(b.tags));
    case "visibility": return (a.visibility ?? "").localeCompare(b.visibility ?? "");
    case "dateCreated": return (Date.parse(a.dateCreated ?? "") || 0) - (Date.parse(b.dateCreated ?? "") || 0);
    case "dateModified": return (Date.parse(a.dateModified ?? "") || 0) - (Date.parse(b.dateModified ?? "") || 0);
  }
}

export function CertificationsPage({
  certs,
  setCerts,
  setupStepsFor,
  setupBanner,
  setSetupBanner,
  flash,
  onFlashDone,
  onAddFeedbackForm,
  onNewCert,
  onImportCert,
  onRestoreCert,
  onEditCert,
  onViewPayers,
  onViewAllTasks,
  onManageContentLinks,
  onManageProgress,
  onArchiveCert,
  onDeleteCert,
  onManageAward,
  awardForCert,
  onOpenIndustries,
  onOpenFeedback,
  contentLinks = [],
}: {
  /** The list, owned by App.tsx: the wizard's Create appends to it, and the
   *  setup flows read it. Visibility / archive / delete edit it in place. */
  certs: Certification[];
  /** The Content Links graph (App.tsx), for the preview panel's accordion. */
  contentLinks?: Link[];
  setCerts: Dispatch<SetStateAction<Certification[]>>;
  /** Each Certification's four setup steps, derived from the data their
   *  flows write (App.tsx). */
  setupStepsFor: (cert: Certification) => SetupSteps;
  setupBanner: SetupBannerState;
  setSetupBanner: Dispatch<SetStateAction<SetupBannerState>>;
  /** A toast handed back by a flow that finished and navigated here —
   *  "Certification Created", "Award Added" … (`CopiedToast`). */
  flash?: string | null;
  onFlashDone?: () => void;
  /** Setup step 4: a new Feedback Form with this Certification as its
   *  trigger, opened in the editor. */
  onAddFeedbackForm: (cert: Certification) => void;
  onNewCert: () => void;
  /** A checked CSV Upload — the wizard opens with its structure built. */
  onImportCert: (report: CertImportReport) => void;
  /** Upload Backup — the wizard opens filled from the backup's record. */
  onRestoreCert: (cert: Certification) => void;
  onEditCert: (cert: Certification) => void;
  onViewPayers: (cert: Certification) => void;
  onViewAllTasks: (cert: Certification) => void;
  onManageContentLinks: (cert: Certification) => void;
  onManageProgress: (cert: Certification) => void;
  onArchiveCert: (cert: Certification) => void;
  /** Deletes the Certification and everything tied to it — its Content
   *  Links (both directions), its Award and its Feedback Form triggers
   *  (App.tsx). The page clears its own setup flag and raises the toast. */
  onDeleteCert: (cert: Certification) => void;
  /** Opens this Certification's Award — adding one, or managing the one it
   *  already has. Awards have no page of their own any more. */
  onManageAward: (cert: Certification) => void;
  /** The Certification's Award, when it has one — it decides whether the row
   *  menu reads "Add Award" or "Manage Award". */
  awardForCert: (cert: Certification) => Award | undefined;
  onOpenIndustries?: () => void;
  /** No argument: the Feedback Forms list (header button). With a
   *  Certification: the form it fires (its done Setup step). */
  onOpenFeedback?: (cert?: Certification) => void;
}) {
  // Re-render when an Industry is renamed, so the Industries column follows.
  const liveInds = useLiveIndustries();
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  // The upload path picked from the Create menu, if any — each opens its own
  // modal, and confirming it continues into the wizard.
  const [importMode, setImportMode] = useState<UploadPath | null>(null);
  // The list lives in App.tsx now (see the props); these keep the page's
  // older names so the row handlers below read as they did.
  const certList = certs;
  const setCertList = setCerts;
  const [menu, setMenu] = useState<{ cert: Certification; rect: DOMRect } | null>(null);
  const [query, setQuery] = useListState("certs:query", "");
  // Set when someone tries to edit a Certification owned by a company — company
  // certifications are managed from the B2B Dashboard, not here.
  // The Certification awaiting the delete confirm, if any.
  const [deleting, setDeleting] = useState<Certification | null>(null);
  /* A Certification other Certifications require in a Condition Set
     (certReferences) can't be deleted: its Delete menu item is disabled with
     the reason, and the confirm never opens. */
  function requestDelete(cert: Certification) {
    if (certReferences(cert.id, certList).length > 0) return;
    setDeleting(cert);
  }
  // The Certification awaiting a Hide confirmation — the Tasks page's Hide
  // modal (Figma 667:884). Unhiding is instant; only hiding routes through it.
  const [hideTarget, setHideTarget] = useState<Certification | null>(null);
  // The Certification whose row was clicked, shown in the side drawer. Held by
  // id and read back from the working copy, so it always shows the live record.
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const drawerCert = drawerId ? certList.find((c) => c.id === drawerId) : undefined;
  // Created by SkillCat is applied on launch.
  const [filters, setFilters] = useListState<CertFilterState>("certs:filters", {
    industries: [],
    careerStages: [],
    types: [],
    creators: ["SkillCat"],
    visibilities: [],
    archived: [],
    tags: [],
    setup: [],
  });

  /* ── Post-creation setup state (see SETUP_STEPS) ── */
  // "Mark as Done": per Certification, per admin — the one flag that persists.
  const [closedSetup, setClosedSetup] = usePersisted<Record<string, true>>("cert-setup-closed", {});
  /* The flag is keyed by id, so it must never outlive its Certification: a
     delete clears its entry (deleteCert), and an entry whose Certification
     isn't in the list (one created before a reload, which the prototype
     doesn't keep) is dropped here. Ids are never re-issued either (App's
     high-water mark), so a new Certification can't inherit an old "done". */
  useEffect(() => {
    setClosedSetup((prev) => {
      const ids = new Set(certs.map((c) => c.id));
      const stale = Object.keys(prev).filter((id) => !ids.has(id));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      for (const id of stale) delete next[id];
      return next;
    });
  }, [certs, setClosedSetup]);
  // The Industries modal, opened from the Setup card for an existing Cert.
  const [industriesFor, setIndustriesFor] = useState<{ cert: Certification; value: string[] } | null>(null);
  // The page's toast: a flow's `flash` on arrival, or one raised here
  // (Industries Added, Setup Marked as Done).
  // Keyed by time, so a second toast straight after the first restarts the
  // timer instead of inheriting what's left of it.
  const [toastState, setToastState] = useState<{ label: string; at: number } | null>(null);
  const toast = toastState?.label ?? null;
  const setToast = useCallback(
    (label: string | null) => setToastState(label ? { label, at: Date.now() } : null),
    [],
  );
  useEffect(() => {
    if (flash) setToast(flash);
  }, [flash, setToast]);
  const onToastDone = useCallback(() => {
    setToast(null);
    onFlashDone?.();
  }, [onFlashDone, setToast]);

  const setupFor = useCallback(
    (cert: Certification): SetupStatus => {
      const steps = setupStepsFor(cert);
      // A step that doesn't apply (Industries on a company-created
      // Certification) is left out, and the rest keycap 1…n.
      const list = SETUP_STEPS.filter((s) => !steps[s.key].na).map((s, i) => ({
        ...s,
        kbd: String(i + 1),
      }));
      const done = list.filter((s) => steps[s.key].done).length;
      const left = list.length - done;
      // The seed's long-settled Certifications arrive closed (data); a new one
      // closes when this admin presses Mark as Done.
      const closed = !!cert.setupClosed || !!closedSetup[cert.id];
      const eligible = hasSetupStatus(cert);
      return {
        eligible,
        steps,
        list,
        done,
        left,
        closed,
        pending: eligible && left > 0 && !closed && !cert.archived,
      };
    },
    [setupStepsFor, closedSetup],
  );

  // Newest first — the table's default order — so "Continue Setup" and S open
  // the Certification just created.
  const pendingCerts = useMemo(
    () =>
      certList
        .filter((c) => setupFor(c).pending)
        .sort((a, b) => compare(b, a, "dateModified")),
    [certList, setupFor],
  );

  // The banner stays while the Setup filter is on — clicking it applies the
  // filter, and it shouldn't vanish under the reader's pointer (the user,
  // 2026-10-01). Only its ✕ / Dismiss takes it away.
  // Once nothing is pending the banner (and its note) simply goes — there is
  // no "all set up" state (user, 2026-10-07).
  const showPendingBanner = !setupBanner.dismissed && pendingCerts.length > 0;
  const bannerOn = showPendingBanner;
  const dismissBanner = () => setSetupBanner((prev) => ({ ...prev, dismissed: true }));

  /* Continue Setup — the banner, its button, the title note and S all run
     this. One Certification waiting: its panel, on the Setup card. Several:
     the table filtered to them (Setup › Incomplete); the banner stays put,
     and each row's pill opens its panel. */
  function continueSetup() {
    if (pendingCerts.length > 1) {
      setFilters((prev) => ({ ...prev, setup: ["Incomplete"] }));
      return;
    }
    const cert = pendingCerts[0];
    if (cert) setDrawerId(cert.id);
  }

  /* Start a setup step — the same existing flow its Add / Manage button or
     its 1–4 key names. The panel closes first: three of the four navigate
     away, and the Industries modal would otherwise sit under its scrim. The
     flows come back to this page with a toast; nothing reopens on its own. */
  function runSetupStep(cert: Certification, key: SetupStepKey) {
    const steps = setupFor(cert).steps;
    // Industries on a company-created Certification: not a step, no modal.
    if (steps[key].na) return;
    closePanelThen(() => {
      switch (key) {
        case "industries":
          setIndustriesFor({ cert, value: cert.industries });
          break;
        case "links":
          onManageContentLinks(cert);
          break;
        case "award":
          onManageAward(cert);
          break;
        case "feedback":
          // Done: that Certification's own form, not the whole list.
          if (steps.feedback.done) onOpenFeedback?.(cert);
          else onAddFeedbackForm(cert);
          break;
      }
    });
  }

  function saveIndustries() {
    if (!industriesFor) return;
    const { cert, value } = industriesFor;
    const had = cert.industries.length > 0;
    setCertList((prev) =>
      prev.map((c) => (c.id === cert.id ? { ...c, industries: value } : c)),
    );
    setIndustriesFor(null);
    if (value.length > 0) setToast(had ? "Industries Updated" : "Industries Added");
    else if (had) setToast("Industries Removed");
  }

  function closeSetup(cert: Certification) {
    const complete = setupFor(cert).left === 0;
    setClosedSetup((prev) => ({ ...prev, [cert.id]: true }));
    setToast(complete ? "Setup Complete" : "Setup Marked as Done");
  }
  /* Default columns: Name, Industry, Career Stage, Date Modified — everything
     else is opt-in from Edit Columns. */
  const [columns, setColumns] = useListState<CertColumnState>("certs:columns", {
    id: false,
    industry: true,
    careerStage: true,
    type: false,
    payment: false,
    tasks: false,
    ceus: false,
    createdBy: false,
    tradeTag: false,
    partnershipTag: false,
    audience: false,
    visibility: false,
    dateCreated: false,
    dateModified: true,
  });
  /* Display order of the optional columns (spec review 2026-10-09: the
     Edit Columns menu reorders by drag, and a column switched back on lands
     LAST). */
  const [order, setOrder] = useListState<CertColumn[]>("certs:order", () => CERT_OPTIONAL_COLUMNS.map((c) => c.key));
  const visibleCols = useMemo(
    () => orderedColumns(CERT_OPTIONAL_COLUMNS, order, columns).map((c) => c.key),
    [order, columns],
  );
  // Most recently edited Certification first.
  const [sort, setSort] = useListState<{ key: SortKey; dir: SortDir }>("certs:sort", { key: "dateModified", dir: "desc" });
  const [page, setPage] = useListState("certs:page", 1);

  // From Scratch goes straight to the wizard; the two upload paths stop at
  // their modal first.
  const startCreate = (key: "scratch" | UploadPath) => {
    if (key === "scratch") onNewCert();
    else setImportMode(key);
  };

  // Keyboard shortcuts, mirroring the Tasks page: "C" opens the Create menu;
  // once open, each method's letter starts it. Ignored while typing in a field,
  // with a modifier held, or while a modal, a row menu or the drawer owns the
  // screen (the menu would open above the drawer's scrim).
  const overlayOpen =
    !!importMode ||
    !!drawerId ||
    !!industriesFor ||
    !!deleting ||
    !!hideTarget ||
    !!menu;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (overlayOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (!createMenuOpen) {
        if (key === "c") {
          e.preventDefault();
          setCreateMenuOpen(true);
        }
        // S = Continue Setup: the panel for the newest Certification still
        // being set up. Only while the banner offers it.
        if (key === "s" && showPendingBanner) {
          e.preventDefault();
          continueSetup();
        }
        return;
      }
      if (e.key === "Escape") {
        setCreateMenuOpen(false);
        return;
      }
      const option = CREATE_OPTIONS.find((o) => o.shortcut.toLowerCase() === key);
      if (option) {
        e.preventDefault();
        setCreateMenuOpen(false);
        startCreate(option.key);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createMenuOpen, overlayOpen, showPendingBanner, pendingCerts, onNewCert]);

  // With the panel open on a Certification mid-setup, 1–4 start that step —
  // the same as its Add / Manage button. Esc is the panel's own.
  const drawerSetup = drawerCert ? setupFor(drawerCert) : null;
  // Only while steps are left — a fully set-up Certification has no card
  // (user, 2026-10-07).
  const drawerSetupCard = !!drawerCert && !!drawerSetup && drawerSetup.pending;
  useEffect(() => {
    if (!drawerCert || !drawerSetupCard || menu || industriesFor) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      // The keycaps of the steps that apply to this Certification.
      const step = setupFor(drawerCert!).list.find((s) => s.kbd === e.key);
      if (!step) return;
      e.preventDefault();
      runSetupStep(drawerCert!, step.key);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerCert, drawerSetupCard, menu, industriesFor]);

  const filtered = useMemo(() => {
    return certList.filter(
      (c) => certMatches(c, query, filters) && setupMatches(setupFor(c), filters.setup),
    );
  }, [query, filters, certList, setupFor]);

  // Ties keep the list's own order either way (a sort then a reverse would
  // flip them): a Certification created today sits above the seed's other
  // rows from today, where Continue Setup and the banner expect it.
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      sort.dir === "desc" ? compare(b, a, sort.key) : compare(a, b, sort.key),
    );
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  useResetPageOnChange(setPage, [query, filters, sort]);

  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = sorted.slice(start, start + PAGE_SIZE);

  // The page's one scroller (Claude Design "Certifications Prototype"): the
  // landing header collapses over its first stretch of scroll, with the table
  // glued beneath it, and the rows scroll under the pinned header after that.
  const head = useCollapsingHeader();
  const { scrollToFirstRow } = head;

  // A new query, filter, sort or page starts the list at its first row. A
  // collapsed header stays collapsed; one still open is left as it is.
  useLayoutEffect(() => {
    scrollToFirstRow();
  }, [query, filters, sort, visiblePage, scrollToFirstRow]);

  // The landing's catalog summary: the whole catalog, not the filtered rows —
  // the pagination footer already counts those.
  const catalog = useMemo(
    () => ({
      certs: certList.length,
      // The Industries tagged directly (exact tags: a Sub-Industry tag doesn't
      // tag its Industry). An untagged Certification (setup pending) adds none.
      industries: new Set(
        certList.flatMap((c) => c.industries.filter((k) => liveInds.some((i) => i.key === k))),
      ).size,
    }),
    [certList, liveInds],
  );

  // Natural table width so columns scroll horizontally instead of crushing.
  const tableMin =
    240 /* name */ + 40 /* actions */ + visibleCols.reduce((sum, k) => sum + CERT_COL_META[k].width, 0);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function setVisibility(cert: Certification, visibility: Certification["visibility"]) {
    setCertList((prev) =>
      prev.map((c) => (c.id === cert.id ? { ...c, visibility } : c)),
    );
  }

  /* Hide / Show flips Visible ⇄ Hidden and nothing else. Archived is its own
     flag (set and cleared only on the Archive & Replace page), so an archived
     Certification still has the toggle and keeps its archived flag. */
  function toggleHidden(cert: Certification) {
    // Making a Certification visible again is instant — only hiding needs
    // confirming, as it does for a Task.
    if ((cert.visibility ?? "Visible") !== "Visible") {
      setVisibility(cert, "Visible");
      setToast("Certification Visible");
      return;
    }
    setHideTarget(cert);
  }

  /* A row menu opened from the preview panel's kebab (spec review
     2026-10-09): an item that NAVIGATES to another page closes the panel
     first; an item that opens a MODAL (Hide, Delete, its blocked explainer,
     Edit's company-owned explainer) leaves the panel open behind it, so the
     panel shows the result when the modal closes. */
  function closePanelThen(run: () => void) {
    setDrawerId(null);
    run();
  }

  function editCert(cert: Certification) {
    // A company-created Certification is edited only from that company's B2B
    // Dashboard: its Edit menu item is disabled and says so (the Tasks
    // pattern, Figma 735:1375), and its row has no Edit quick action.
    if (!isSkillCatCert(cert)) return;
    closePanelThen(() => onEditCert(cert));
  }

  function deleteCert(cert: Certification) {
    // Referenced since the confirm opened: App won't delete it, and the
    // menu item now says why.
    if (certReferences(cert.id, certList).length > 0) {
      setDeleting(null);
      return;
    }
    // The record and everything tied to it go in App (links, Award, form
    // triggers); the page's own "Mark as Done" flag goes here.
    onDeleteCert(cert);
    setClosedSetup((prev) => {
      if (!(cert.id in prev)) return prev;
      const next = { ...prev };
      delete next[cert.id];
      return next;
    });
    if (drawerId === cert.id) setDrawerId(null);
    setDeleting(null);
    setToast("Certification Deleted");
  }

  return (
    <div className="main">
      <div className="workspace">
        {/* Claude Design "Certifications Prototype" (Certifications only):
            the page is ONE scroller — the table's own `.table-xscroll`. It
            opens on the landing, where the large title, the catalog summary
            and the Large search bar sit straight on top of the real table.
            The first stretch of scroll collapses that header into the
            standard table header with the rows glued beneath it; after that
            the rows scroll under the pinned header. See useCollapsingHeader
            and the `.tasks.clh` rules in index.css. */}
        {/* `clh--banner` while the setup banner shows: its 72px + 16px join
            the collapse, and it condenses into the title note (the same
            morph Manage Users' name-change card runs — see the
            `.tasks.clh.clh--banner` rules). */}
        <div className={`tasks clh${bannerOn ? " clh--banner" : ""}`}>
          <div className="co-table-col">
            <div
              ref={head.scrollRef}
              className="table-xscroll clh-scroll"
              style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}
            >
              <div className="clh-canvas">
                <div ref={head.headerRef} className="clh-head">
                  {/* The header's pieces are its direct children, so each can pin
                      inside it (see the `.tasks.clh` rules). The action buttons
                      keep a `.tasks-header` of their own for their button styles. */}
                  <header className="tasks-header clh-actions">
                    {/* Figma 633:1865 — same move as the Tasks header: Industries and
                        Feedback left the sidebar's Content group and are now reached
                        from here, left of the Create Certification CTA. Awards was a
                        third button until Awards stopped being a page: an Award belongs
                        to one Certification, so it is reached from that row's menu. */}
                    <div className="tasks-header-actions">
                      <button className="cta-quiet" onClick={() => onOpenIndustries?.()}>
                        Industries
                      </button>
                      <button className="cta-quiet" onClick={() => onOpenFeedback?.()}>
                        Feedback
                      </button>
                      {/* The three creation methods used to be cards on a full-page
                          chooser between this button and the wizard. They are rows in
                          the CTA's menu now, on the Tasks page's Create Task shell
                          (Figma 724:1010): label + shortcut badge, no icons. */}
                      <Dropdown
                        align="right"
                        width="auto"
                        panelClass="ct-menu"
                        open={createMenuOpen}
                        onOpenChange={setCreateMenuOpen}
                        trigger={({ toggle }) => (
                          <button className="new-task" onClick={toggle}>
                            <AddIcon />
                            Create Certification
                            <span className="cta-kbd">C</span>
                          </button>
                        )}
                      >
                        {({ close }) => (
                          <>
                            {CREATE_OPTIONS.map(({ key, label, shortcut }) => (
                              <button
                                key={key}
                                className="ct-menu-item"
                                onClick={() => {
                                  startCreate(key);
                                  close();
                                }}
                              >
                                <span className="ct-menu-label">{label}</span>
                                <span className="cta-kbd">{shortcut}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </header>
                  <h1 className="tasks-title">Certifications</h1>
                  {/* The setup banner's collapsed form: one accent line under
                      the collapsed title. Its count and text are the twins the
                      card's pieces travel to, so the count span carries
                      whatever sits before the shared words ("3 ", "4 steps
                      left · ") and the text span holds only the words the
                      card's title shares. */}
                  {bannerOn && <SetupNote pending={pendingCerts} onClick={continueSetup} />}
                  {/* The landing's catalog summary, in the shape of the Tasks
                      line in Figma 1356:1864 ("3210 Tasks · Across 230
                      Certifications"). It fades as the header collapses. */}
                  <p className="tasks-subtitle clh-sub">
                    {`${plural(catalog.certs, "Certification", "Certifications")} · Across ${plural(
                      catalog.industries,
                      "Industry",
                      "Industries",
                    )}`}
                  </p>

                  {/* Certifications still being set up announce themselves
                      above the hero search, and condense into the title note
                      as the header collapses. The whole card is Continue
                      Setup; its own buttons stop the click. */}
                  {showPendingBanner && (
                    <div className="clh-banner">
                      <SetupBanner pending={pendingCerts} onContinue={continueSetup} onLater={dismissBanner} />
                    </div>
                  )}

                  <div className="toolbar">
                    <CertificationsSearch
                      certifications={certList}
                      industries={filters.industries}
                      onIndustriesChange={(v) => setFilters((prev) => ({ ...prev, industries: v }))}
                      careerStages={filters.careerStages}
                      onCareerStagesChange={(v) => setFilters((prev) => ({ ...prev, careerStages: v }))}
                      types={filters.types}
                      onTypesChange={(v) => setFilters((prev) => ({ ...prev, types: v }))}
                      query={query}
                      onCommit={setQuery}
                    />
                  </div>

                  <CertFilters filters={filters} setFilters={setFilters} />
                </div>

                <table ref={head.theadRef} className="table table-head">
                  <CertColGroup cols={visibleCols} />
                  <thead>
                    <tr>
                      <SortableHeader col="name" label="Name" className="col-name" sort={sort} toggle={toggleSort} />
                      {visibleCols.map((k) => (
                        <SortableHeader
                          key={k}
                          col={k}
                          label={CERT_COL_META[k].label}
                          className={CERT_COL_META[k].className}
                          sort={sort}
                          toggle={toggleSort}
                          sortable={CERT_COL_META[k].sortable !== false}
                        />
                      ))}
                      <th className="col-actions">
                        <EditColumnsButton
                          columns={columns}
                          setColumns={setColumns}
                          optional={CERT_OPTIONAL_COLUMNS}
                          fixed={CERT_FIXED_COLUMNS}
                          order={order}
                          onOrderChange={setOrder}
                        />
                      </th>
                    </tr>
                  </thead>
                </table>

                <div className="tasks-scroll">
                  <table className="table table-body">
                    <CertColGroup cols={visibleCols} />
                    <tbody>
                      {paged.map((cert) => (
                        <CertRow
                          key={cert.id}
                          cert={cert}
                          cols={visibleCols}
                          setup={(() => {
                            const st = setupFor(cert);
                            return st.pending ? { done: st.done, left: st.left, total: st.list.length } : undefined;
                          })()}
                          onOpen={() => setDrawerId(cert.id)}
                          onEdit={() => editCert(cert)}
                          onToggleVisibility={() => toggleHidden(cert)}
                          onOpenMenu={(rect) => setMenu({ cert, rect })}
                          menuOpen={menu?.cert.id === cert.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {paged.length === 0 && <TableEmpty />}
              </div>
            </div>

            <div className="pagination">
              <span>
                Showing {sorted.length === 0 ? 0 : start + 1} - {Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <div className="pagination-controls">
                <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><PagePrevIcon /></button>
                <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><PageNextIcon /></button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (
        <CertActionsMenu
          cert={menu.cert}
          rect={menu.rect}
          onClose={() => setMenu(null)}
          onEdit={() => editCert(menu.cert)}
          onToggleVisibility={() => toggleHidden(menu.cert)}
          onDelete={() => requestDelete(menu.cert)}
          deleteRefs={certReferences(menu.cert.id, certList)}
          onViewPayers={() => closePanelThen(() => onViewPayers(menu.cert))}
          onViewAllTasks={() => closePanelThen(() => onViewAllTasks(menu.cert))}
          hasAward={!!awardForCert(menu.cert)}
          onManageAward={() => closePanelThen(() => onManageAward(menu.cert))}
          onBackup={() => {
            backupCertification(menu.cert);
            setToast("Backup Downloaded");
          }}
          onManageContentLinks={() => closePanelThen(() => onManageContentLinks(menu.cert))}
          onManageProgress={() => closePanelThen(() => onManageProgress(menu.cert))}
          onArchive={() => closePanelThen(() => onArchiveCert(menu.cert))}
        />
      )}

      {importMode === "backup" && (
        <CertImportModal
          onClose={() => setImportMode(null)}
          onConfirm={(cert) => {
            setImportMode(null);
            onRestoreCert(cert);
          }}
        />
      )}

      {/* CSV Upload runs the Question Bank's bulk-upload flow: every row is
          checked before anything imports, and a clean file opens the wizard
          with its Courses, Lessons, and Tasks already built. */}
      {importMode === "csv" && (
        <CertBulkUploadModal
          onClose={() => setImportMode(null)}
          onImport={(report) => {
            setImportMode(null);
            onImportCert(report);
          }}
        />
      )}

      {deleting && (
        <PrmModal
          title="Delete Certification"
          confirmLabel="Delete Certification"
          danger
          doubleConfirm={
            <>
              <strong>{deleting.name}</strong>, its Content Links, its Award and its Feedback
              Form triggers will be permanently deleted. This can't be undone.
            </>
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteCert(deleting)}
        >
          {/* Body copy is children, not `description` — the shell's own
              convention for a confirm (Figma 483:588). */}
          <p className="prm-content">
            “{deleting.name}” ({deleting.id}) is removed from the Certifications list along
            with its Content Links, its Award and its Feedback Form triggers. This can't be
            undone.
          </p>
        </PrmModal>
      )}

      {hideTarget && (
        <HideCertModal
          cert={hideTarget}
          onCancel={() => setHideTarget(null)}
          onConfirm={() => {
            setVisibility(hideTarget, "Hidden");
            setHideTarget(null);
            setToast("Certification Hidden");
          }}
        />
      )}

      {drawerCert && (
        <CertDrawer
          key={drawerCert.id}
          cert={drawerCert}
          contentLinks={contentLinksFor(drawerCert.id, contentLinks)}
          setupCard={
            drawerSetupCard && drawerSetup ? (
              <SetupCard
                cert={drawerCert}
                status={drawerSetup}
                onRun={(key) => runSetupStep(drawerCert, key)}
                onClose={() => closeSetup(drawerCert)}
              />
            ) : undefined
          }
          onClose={() => setDrawerId(null)}
          onMore={(rect) => setMenu({ cert: drawerCert, rect })}
        />
      )}

      {/* Setup step 1 for an existing Certification: the modal that ends the
          create flow, lifted out of the wizard. */}
      {industriesFor && (
        <CertIndustriesModal
          mode="manage"
          certName={industriesFor.cert.name}
          value={industriesFor.value}
          onChange={(value) => setIndustriesFor({ ...industriesFor, value })}
          onCancel={() => setIndustriesFor(null)}
          onDone={saveIndustries}
        />
      )}

      {/* "Certification Created" on arrival (6 s — it is the landing's
          acknowledgment), 2.5 s for everything else. */}
      {toast && (
        <CopiedToast
          key={toastState?.at}
          label={toast}
          ms={toast === "Certification Created" ? 6000 : 2500}
          onDone={onToastDone}
        />
      )}
    </div>
  );
}

/* ─────────────── Post-creation setup pieces ─────────────── */

/** The banner's title (Figma 1424:1416 "Certification Setup Pending") — the
 *  words the card's title and the note's label share, so the morph can hold
 *  them. The count in front of it is the number of Certifications. */
function setupTitle(pending: Certification[]): string {
  return pending.length === 1 ? "Certification Setup Incomplete" : "Certification Setups Incomplete";
}

function stepsLeftLabel(left: number): string {
  return `${left} setup step${left === 1 ? "" : "s"} left`;
}

/* The landing banner (Figma 1424:1416 "Certification Setup Pending"): the
   count of Certifications still being set up, the title, their names on one
   line, then Continue Setup and a ✕ that puts the banner off for the session
   ("Set up later" — the next create brings it back). The whole card is
   Continue Setup (one pending: its panel; several: the filtered table — see
   `continueSetup`); its two buttons stop the click. One pending Certification
   reads the same way, in the singular. */
function SetupBanner({
  pending,
  onContinue,
  onLater,
}: {
  pending: Certification[];
  onContinue: () => void;
  onLater: () => void;
}) {
  return (
    <div
      className="note-card note-card--accent lm-banner cs-banner"
      role="button"
      tabIndex={0}
      onClick={onContinue}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onContinue();
        }
      }}
    >
      <div className="lm-banner-main">
        <div className="lm-banner-count">{pending.length}</div>
        <div className="note-card-text">
          <p className="note-card-title cs-ellipsis">
            <span className="nc-shared">{setupTitle(pending)}</span>
          </p>
          <p className="note-card-body cs-ellipsis">{pending.map((c) => c.name).join(" · ")}</p>
        </div>
      </div>
      {/* Continue Setup closes onto the note's chevron as the card condenses;
          the ✕ beside it only fades. */}
      <button
        className="cta-quiet"
        onClick={(e) => {
          e.stopPropagation();
          onContinue();
        }}
      >
        Continue Setup
        <span className="cta-kbd">S</span>
      </button>
      <button
        className="cs-close lm-banner-aside"
        aria-label="Set up later"
        data-tip="Set up later"
        onClick={(e) => {
          e.stopPropagation();
          onLater();
        }}
      >
        <RowCloseIcon />
      </button>
    </div>
  );
}

/** The banner's collapsed form under the title (see SetupBanner) — the
 *  "Page Subtext" action line, Figma 1597:2681. */
function SetupNote({
  pending,
  onClick,
}: {
  pending: Certification[];
  onClick: () => void;
}) {
  // The no-break space: a flex item drops a trailing space (the Users note
  // does the same).
  const lead = `${pending.length}\u00a0`;
  const title = setupTitle(pending);
  return (
    <button className="tasks-note" aria-label={`${lead}${title}`} onClick={onClick}>
      <span className="tasks-note-count">{lead}</span>
      <span className="tasks-note-text">
        <span className="nc-shared">{title}</span>
      </span>
      <NoteChevronIcon />
    </button>
  );
}

/** The Setup card (Figma 1592:2588), its own block between the panel's head
 *  and its accordions: title + Mark As Done, the 4-step progress bar, the
 *  intro, then the steps on a darker inset list. A step left to do offers
 *  Add with its keycap; a done one greys out and shows the orange check. */
function SetupCard({
  cert,
  status,
  onRun,
  onClose,
}: {
  cert: Certification;
  status: SetupStatus;
  onRun: (key: SetupStepKey) => void;
  onClose: () => void;
}) {
  return (
    <section className="cs-card" aria-label="Setup">
      <div className="cs-top">
        <div className="cs-head">
          <h3 className="cs-title">Setup Pending</h3>
          <button className="btn-dialog" onClick={onClose}>
            <SetupCheckIcon size={14} />
            Mark As Done
          </button>
        </div>
        <div className="cs-progress" aria-hidden="true">
          {status.list.map((s) => (
            <span key={s.key} className={`cs-seg${status.steps[s.key].done ? " cs-seg--done" : ""}`} />
          ))}
        </div>
        <p className="cs-help">
          Optional, but most Certifications need{" "}
          {status.list.length === 1
            ? "it"
            : status.list.length === 2
              ? "both"
              : `all ${status.list.length === 3 ? "three" : "four"}`}{" "}
          before learners can find and finish them.
        </p>
      </div>
      <div className="cs-list">
        <div className="cs-rows">
          {status.list.map((s) => {
            const step = status.steps[s.key];
            const detail = s.key === "industries" ? certIndustryText(cert.industries) : step.detail;
            return (
              <div
                key={s.key}
                className={`cs-row${step.done ? " is-done" : ""}`}
                {...(step.done && {
                  role: "button",
                  tabIndex: 0,
                  title: `Manage ${s.short} — press ${s.kbd}`,
                  onClick: () => onRun(s.key),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRun(s.key);
                    }
                  },
                })}
              >
                <div className="cs-row-main">
                  <span className="cs-row-icon" aria-hidden="true">{s.icon}</span>
                  <div className="cs-row-text">
                    <span className="cs-row-title">{step.done ? s.doneTitle : s.label}</span>
                    <span className="cs-row-body">{step.done ? detail || "Added" : s.body}</span>
                  </div>
                </div>
                {step.done ? (
                  /* "Icon Filled" (1046:1066). The whole done row reopens its
                     step (user, 2026-10-07) — see the row's onClick. */
                  <span className="cs-done-disc" aria-hidden="true">
                    <SetupCheckIcon />
                  </span>
                ) : (
                  <button
                    className="cta-quiet"
                    title={`Add ${s.short} — press ${s.kbd}`}
                    onClick={() => onRun(s.key)}
                  >
                    Add
                    <span className="cta-kbd">{s.kbd}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** A Certification's row preview panel (Figma 1514:2860): the Setup card
 *  while steps are left, then every review card — the Task tree among them —
 *  as accordions, and its figures as Activity. */
function CertDrawer({
  cert,
  contentLinks,
  setupCard,
  onClose,
  onMore,
}: {
  cert: Certification;
  contentLinks: ReturnType<typeof contentLinksFor>;
  /** The post-creation Setup card, first while steps are left. */
  setupCard?: ReactNode;
  onClose: () => void;
  onMore: (rect: DOMRect) => void;
}) {
  const pv = useCertPreview(cert);
  const vis = cert.visibility ?? "Visible";
  /* Live = Visible, not archived, with at least one Task in its stored tree
     (a hidden or archived one, or one whose Courses hold no Tasks yet, reads
     "Not live yet"). Only the
     seed has enrolment history; a Certification created this session starts
     at zero. */
  const live = vis === "Visible" && !cert.archived && pv.taskCount > 0;
  const enrolled = seededInt(cert.id, "enrolled", 140, 4200);
  const completed = Math.round((enrolled * seededInt(cert.id, "rate", 38, 84)) / 100);
  const stats: PreviewStat[] = live && !pv.hasHistory
    ? [
        { count: "0", title: "Enrollments", sub: "+0 / month" },
        { count: "0", title: "Completions", sub: "0% of enrolled" },
        { count: "0", title: "Active", sub: "This month" },
      ]
    : live
    ? [
        { count: formatCount(enrolled), title: "Enrollments", sub: `+${seededInt(cert.id, "month", 8, 140)} / month` },
        {
          count: formatCount(completed),
          title: "Completions",
          sub: `${Math.round((completed / enrolled) * 100)}% of enrolled`,
        },
        {
          count: formatCount(seededInt(cert.id, "active", 20, Math.max(21, Math.round(enrolled / 5)))),
          title: "Active",
          sub: "This month",
        },
      ]
    : [
        { count: "—", title: "Enrollments", sub: "Not live yet" },
        { count: "—", title: "Completions", sub: "Not live yet" },
        { count: "—", title: "Active", sub: "Not live yet" },
      ];
  return (
    <PreviewPanel image={cert.thumbnail ?? certThumbPlaceholder} title={cert.name} subtitle={cert.description} onMore={onMore} stats={stats} lead={setupCard} onClose={onClose}>
      <CertificationSummary cert={cert} contentLinks={contentLinks} />
    </PreviewPanel>
  );
}

/** Hide confirmation — the Tasks page's Hide modal (Figma 667:884 "General
 *  Modal") for a Certification. The heading names the Cert, the description
 *  states what hiding does, and the content slot names the Industry it is
 *  listed under — where the Task version lists its Certifications. */
function HideCertModal({
  cert,
  onCancel,
  onConfirm,
}: {
  cert: Certification;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // PrmModal has no key handling of its own, so the owner closes on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <PrmModal
      title={`Hide “${cert.name}”`}
      confirmLabel="Hide Certification"
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="prm-content">
        Hiding the Certification temporarily removes it for all users.
      </p>
      {cert.industries.length > 0 && (
        <div className="prm-content">
          <p>
            This Certification is currently in the following{" "}
            {cert.industries.length === 1 ? "Industry" : "Industries"}. Hiding it removes it
            temporarily from {cert.industries.length === 1 ? "there" : "them"}.
          </p>
          <ul>
            {industryTagLabels(cert.industries).map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
      )}
    </PrmModal>
  );
}

/** Renders a category's tags like the "Used in" column — first value plus a
 * "+N" overflow badge. Trade and Partnership categories allow more than one;
 * hovering the cell shows the full list via a native tooltip. */
function TagCell({ tags }: { tags: string[] }) {
  return (
    <td className="col-tags" data-tip={tags.length ? tags.join("\n") : undefined}>
      {tags.length === 0 ? (
        null
      ) : (
        <>
          {tags[0]}
          {tags.length > 1 && <>{" "}<span className="used-extra">+{tags.length - 1}</span></>}
        </>
      )}
    </td>
  );
}

/** Each optional column's header label, class and width — one table for
 *  the header, the colgroup and the scroll width, in whatever order. */
const CERT_COL_META: Record<CertColumn, { label: string; className: string; width: number; sortable?: false }> = {
  id: { label: "ID", className: "col-id", width: 100 },
  industry: { label: "Industries", className: "col-used", width: 190 },
  careerStage: { label: "Career Stage", className: "col-type", width: 140 },
  type: { label: "Type", className: "col-type", width: 130 },
  payment: { label: "Payment", className: "col-type", width: 150 },
  tasks: { label: "Tasks", className: "col-type", width: 90 },
  ceus: { label: "CEUs", className: "col-type", width: 90 },
  createdBy: { label: "Created By", className: "col-creator", width: 180, sortable: false },
  tradeTag: { label: "Trade Tag", className: "col-tags", width: 210, sortable: false },
  partnershipTag: { label: "Partnership Tag", className: "col-tags", width: 160, sortable: false },
  audience: { label: "Audience", className: "col-tags", width: 150, sortable: false },
  visibility: { label: "Visibility", className: "col-type", width: 120 },
  dateCreated: { label: "Date Created", className: "col-date", width: 130 },
  dateModified: { label: "Date Modified", className: "col-date", width: 130 },
};

function CertColGroup({ cols }: { cols: CertColumn[] }) {
  return <TableCols data={[240, ...cols.map((k) => CERT_COL_META[k].width)]} trail={[40]} />;
}

function CertRow({
  cert,
  cols,
  setup,
  onOpen,
  onEdit,
  onToggleVisibility,
  onOpenMenu,
  menuOpen,
}: {
  cert: Certification;
  /** The visible optional columns, in the admin's order. */
  cols: CertColumn[];
  /** Set while post-creation setup steps are left: the "Setup n/4" pill. */
  setup?: { done: number; left: number; total: number };
  /** A click anywhere on the row outside its action buttons. */
  onOpen: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onOpenMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const vis = cert.visibility ?? "Visible";
  const hidden = vis === "Hidden";
  const archived = !!cert.archived;
  return (
    <tr
      className={`${hidden || archived ? "task-dim" : ""} ${menuOpen ? "menu-open" : ""}`}
      onClick={onOpen}
    >
      <td className="col-name" data-tip={cert.name}>
        <span className="tsk-name">{cert.name}</span>
        {/* Hidden and Archived read exactly as a hidden Task row does
            (1126:1686): grey pill beside a muted name, every other cell
            dimmed — see `.task-dim` in the CSS. They are independent, so an
            archived Hidden Certification carries both. */}
        {archived && <span className="pr-name-flag pr-name-flag--grey">Archived</span>}
        {hidden && <span className="pr-name-flag pr-name-flag--grey">Hidden</span>}
        {/* The shared yellow name flag — the same pill as Exam Reviews' "New
            ID" (Figma 994:1081 "Table Pills - Yellow"), its hover tip in the
            shared tooltip. Clicking it is a row click: the panel opens on the
            Setup card. */}
        {setup && (
          <span className="pr-name-flag" data-tip={`${stepsLeftLabel(setup.left)}`}>
            Setup {setup.done}/{setup.total}
          </span>
        )}
      </td>
      {cols.map((k) => {
        switch (k) {
          case "id": return <td key={k} className="col-id">{cert.id}</td>;
          case "industry": return <td key={k} className="col-used" data-tip={certIndustryText(cert.industries)}>{certIndustryText(cert.industries)}</td>;
          case "careerStage": return <td key={k} className="col-type">{cert.careerStage ?? ""}</td>;
          case "type": return <td key={k} className="col-type">{cert.type ?? ""}</td>;
          case "payment":
            return (
              <td key={k} className="col-type">
                {cert.payment ? (
                  <span className={`pay-badge pay-badge--${cert.payment === "Consumable" ? "consumable" : "nonconsumable"}`}>
                    {cert.payment}
                  </span>
                ) : (
                  <span className="pay-badge pay-badge--free">Free</span>
                )}
              </td>
            );
          case "tasks": return <td key={k} className="col-type">{cert.tasks}</td>;
          case "ceus": return <td key={k} className="col-type">{cert.ceus}</td>;
          case "createdBy": return <td key={k} className="col-creator" data-tip={cert.createdBy}>{cert.createdBy}</td>;
          case "tradeTag": return <TagCell key={k} tags={pickTags(cert.tags, TRADE_TAGS)} />;
          case "partnershipTag": return <TagCell key={k} tags={pickTags(cert.tags, PARTNERSHIP_TAGS)} />;
          case "audience": return <td key={k} className="col-tags">{audienceOf(cert.tags)}</td>;
          case "visibility": return <td key={k} className="col-type">{vis}</td>;
          case "dateCreated": return <td key={k} className="col-date">{cert.dateCreated ?? ""}</td>;
          case "dateModified": return <td key={k} className="col-date">{cert.dateModified ?? ""}</td>;
        }
      })}
      <td className="col-actions">
        <button
          className="row-action-btn lone-dots"
          aria-label="More"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
        >
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          {/* No Edit quick action on a company-created Certification — its
              menu item is disabled with the reason. */}
          {isSkillCatCert(cert) && (
            <button
              className="row-action-btn"
              aria-label="Edit"
              title="Edit certification"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <RowEditIcon />
            </button>
          )}
          {/* Hide / Show only flips Visible ⇄ Hidden — archived rows too,
              since Archived is its own flag. */}
          <button
            className="row-action-btn"
            aria-label={hidden ? "Make visible" : "Hide certification"}
            title={hidden ? "Make visible" : "Hide certification"}
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          >
            {hidden ? <RowEyeOffIcon /> : <RowEyeIcon />}
          </button>
          <button
            className="row-action-btn"
            aria-label="More"
            onClick={(e) => { e.stopPropagation(); onOpenMenu(e.currentTarget.getBoundingClientRect()); }}
          >
            <RowKebabIcon />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ─────────────── Three-dot row actions menu ─────────────── */
/* Figma 735:1454 "3-Dot Menu - Certifications" — the same head-less item list
   the Tasks and Users menus already use. Fixed-positioned so it escapes the
   table's scroll container. */

function CertActionsMenu({
  cert,
  rect,
  onClose,
  onEdit,
  onToggleVisibility,
  onDelete,
  deleteRefs,
  onViewPayers,
  onViewAllTasks,
  hasAward,
  onManageAward,
  onBackup,
  onManageContentLinks,
  onManageProgress,
  onArchive,
}: {
  cert: Certification;
  rect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
  /** The Certifications that require this one in a Condition Set — Delete is
   *  disabled while there are any. */
  deleteRefs: CertReference[];
  onViewPayers: () => void;
  onViewAllTasks: () => void;
  hasAward: boolean;
  onManageAward: () => void;
  onBackup: () => void;
  onManageContentLinks: () => void;
  onManageProgress: () => void;
  onArchive: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() {
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  /* `reason` disables the row and says why on a second line — the Tasks
     menu's disabled item (Figma 735:1375). `tip` adds the shared tooltip
     on hover, for detail too long for that line. */
  const item = (
    icon: JSX.Element,
    label: string,
    onPick: () => void,
    danger = false,
    reason?: string,
    tip?: string,
  ) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      disabled={!!reason}
      data-tip={tip}
      onClick={(e) => {
        e.stopPropagation();
        if (reason) return;
        onPick();
        onClose();
      }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {reason ? (
        <span className="u-menu-item-text">
          <span>{label}</span>
          <span className="u-menu-item-sub">{reason}</span>
        </span>
      ) : (
        label
      )}
    </button>
  );

  const hidden = (cert.visibility ?? "Visible") === "Hidden";
  const archived = !!cert.archived;

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {item(
        <RowEditIcon />,
        "Edit Certification",
        onEdit,
        false,
        isSkillCatCert(cert) ? undefined : "Can only be edited from the B2B Dashboard",
      )}
      {/* Hide / Show only flips Visible ⇄ Hidden, archived or not —
          Archived is its own flag (Unarchive lives on the Archive & Replace
          page). */}
      {item(
        hidden ? <RowEyeIcon /> : <RowEyeOffIcon />,
        hidden ? "Make Visible" : "Make Hidden",
        onToggleVisibility,
      )}
      {/* Only paid certifications have payers to view. */}
      {cert.payment && item(<MenuPaidIcon />, "View Who Paid", onViewPayers)}
      {/* Content Links are SkillCat-catalog only: on a company-created Cert
          the entry stays, disabled with the reason (the 668:942 pattern). */}
      {item(
        <MenuLinkIcon />,
        "Manage Content Links",
        onManageContentLinks,
        false,
        isSkillCatCert(cert) ? undefined : "Only SkillCat-created Certifications can have Content Links",
      )}
      {item(<MenuProgressIcon />, "Manage User Progress", onManageProgress)}
      {/* Opens the Tasks page with this Certification already in the filter
          row — the Tasks a Cert is built from, without retyping the name. */}
      {item(<MenuAllTasksIcon />, "View All Tasks", onViewAllTasks)}
      {/* Figma 1226:1425 — "Add Award", between View All Tasks and Backup.
          A Certification can hold at most one Award, so the entry is the
          Award's whole life cycle: it reads "Manage Award" once there is one. */}
      {/* A company-created Certification can't have one: disabled, with
          the reason. */}
      {item(
        <MenuAwardIcon />,
        hasAward ? "Manage Award" : "Add Award",
        onManageAward,
        false,
        isSkillCatCert(cert) ? undefined : "Only SkillCat-created Certifications can have an Award",
      )}
      {item(<MenuBackupIcon />, "Backup Certification", onBackup)}
      {/* Archiving used to be an edit-only step inside the Cert wizard; it's
          now this entry, opening its own full-page Archive & Replace view.
          Every archived Cert reopens that page, prefilled with what was
          saved — it is also where Unarchive lives. */}
      {item(
        <MenuArchiveReplaceIcon />,
        archived ? "Manage Archive & Replace Settings" : "Archive & Replace",
        onArchive,
      )}
      {/* Required in another Certification's Condition Set: disabled (the
          668:942 pattern), each referencing Certification named on hover. */}
      {item(
        <RowDeleteIcon />,
        "Delete Certification",
        onDelete,
        true,
        deleteRefs.length
          ? `Currently required by ${deleteRefs.length} Certification${deleteRefs.length === 1 ? "" : "s"}. Remove it from ${deleteRefs.length === 1 ? "that Certification's" : "their"} Completion Criteria to proceed.`
          : undefined,
        deleteRefs.length
          ? `Required in the Completion Criteria of:\n${deleteRefs.map((r) => `• ${r.cert.name}`).join("\n")}`
          : undefined,
      )}
    </div>
  );
}

function SortableHeader({
  col, label, className, sort, toggle, sortable = true,
}: {
  col: SortKey;
  label: string;
  className?: string;
  sort: { key: SortKey; dir: SortDir };
  toggle: (k: SortKey) => void;
  sortable?: boolean;
}) {
  if (!sortable) {
    return (
      <th className={`${className ?? ""} no-sort`.trim()}>
        <span className="th-content">{label}</span>
      </th>
    );
  }
  const active = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)}>
      <span className="th-content">
        {label}
        <SortIcon active={active} dir={active ? sort.dir : undefined} />
      </span>
    </th>
  );
}

