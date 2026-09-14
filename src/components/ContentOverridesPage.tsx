import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
} from "react";
import {
  ADMIN_ACTOR,
  ADMIN_STAMP,
  applyClearCert,
  applyGrantAttempt,
  applyMarkCert,
  applyMarkComplete,
  applyMarkIncomplete,
  attemptInfo,
  buildData,
  isExhausted,
  needsGradePrompt,
  progress,
  fmtDY,
  fmtMins,
  gradeLabel,
  gradeScale,
  formatGrade,
  passMarkLabel,
  tracksAttempts,
  tracksTime,
  TYPE_SHORT,
  type Cell,
  type CellMap,
  type CertManual,
  type CertTask,
} from "../data/certLookup";
import { PrmModal } from "./PrmModal";
import { SectionHeading } from "./SectionHeading";
import { SearchHints } from "./SearchPanelParts";
import { Stepper } from "./Stepper";
import {
  ChangeArrowIcon,
  CommandIcon,
  ChevronRightIcon,
  EnterKeyIcon,
  ErrorTriangleIcon,
  FlagIcon,
  HourglassIcon,
  MenuAttemptsIcon,
  MenuGrantAttemptsIcon,
  MenuMarkCompleteIcon,
  MenuMarkIncompleteIcon,
  RowKebabIcon,
  SearchClearIcon,
  SearchIcon,
  SmallCloseIcon,
} from "./icons";

/**
 * Manage Completions — search an employee, then a certification or a single
 * task. The pair drives the view (Claude Design "Progress Admin - Prototype",
 * 2026-09 revision — the cohort scope is gone, every lookup is one person):
 *
 *   employee + cert  → learner header with the certification action, a
 *                      progress strip, and that person's task table (Figma
 *                      960:980: time is tracked on xAPI/Quiz only, a flag marks
 *                      a manual completion, Quiz grades are a %, Hands-On out
 *                      of 10, attempts carry an hourglass while pending review
 *                      and an error triangle once exhausted)
 *   employee + task  → learner header with the task actions and a status strip
 *
 * Admin actions — mark a task or a whole certification complete OR incomplete,
 * and grant quiz attempts — are STAGED, not applied: each lands in the footer's
 * "N Changes Made" count, whose hover card lists them and can drop any one, and
 * Review & Save opens a plain confirmation listing every change before
 * anything is committed. Everything applied is logged as ADMIN_ACTOR.
 *
 * Chrome is assembled from the shared design system (Figma "Components" page
 * 11:15114) rather than restyled here — see the `.mc-root` comment in
 * index.css for the component-by-component mapping.
 */


/* Most attempts one grant can stage. */
const MAX_GRANT = 10;

/* The Task/Certification half's blank-state shortlist, in display order. A
   name that no longer resolves in the library is simply skipped, so this stays
   a suggestion list rather than a source of dead rows. */
const SUGGESTED_CERTS = [
  "HVAC JobReady",
  "EPA 608 Universal",
  "EPA 608 Type I",
  "EPA 608 Type II",
  "EPA 608 Type III",
  "NATE Ready-to-Work",
  "EPA 609",
  "Building Science Principles",
];

const SUGGESTED_TASKS = [
  "EPA 608 Universal Final Exam",
  "EPA 608 Type I Final Exam",
  "EPA 608 Type II Final Exam",
  "EPA 608 Type III Final Exam",
  "NATE RTW Final Exam",
  "Building Science Principles Final Exam",
];

/** The named entries that exist, in the order they are named. */
function suggestedIn<T extends { name: string }>(all: T[], names: string[]): T[] {
  return names.map((n) => all.find((x) => x.name === n)).filter((x): x is T => !!x);
}

/* ───────────────────────── small presentational bits ───────────────────── */

/** The Attempts value (Figma 960:980): the count, amber with an hourglass
 *  while a submission awaits review, red with an error triangle once every
 *  attempt is used. Blank on open-ended tasks.
 *
 *  Neither glyph is self-explanatory, so each carries the shared tooltip
 *  (`data-tip`) on the glyph itself rather than the whole cell — the count
 *  beside it needs no explaining. */
function AttemptsValue({ task, cell }: { task: CertTask; cell: Cell }) {
  const ai = attemptInfo(task, cell);
  const exhausted = isExhausted(task, cell);
  const pending = cell.status === "review" && !exhausted;
  const used = ai.attemptsUsed;
  const cap = ai.totalAllowed;
  return (
    <span className={`mct-att${exhausted ? " is-exhausted" : pending ? " is-pending" : ""}`}>
      {tracksAttempts(task) ? used : "-"}
      {pending && (
        <span className="mct-att-glyph" data-tip-head="Waiting on review" data-tip={PENDING_TIP}>
          <HourglassIcon />
        </span>
      )}
      {exhausted && (
        <span
          className="mct-att-glyph"
          data-tip-head="Attempts exhausted"
          data-tip={`All ${cap ?? used} ${
            (cap ?? used) === 1 ? "attempt" : "attempts"
          } have been used without a pass, so this task is blocked. Grant additional attempts to unblock it.`}
        >
          <ErrorTriangleIcon />
        </span>
      )}
    </span>
  );
}

/** The hourglass tip — the same wherever the glyph appears. */
const PENDING_TIP =
  "The latest attempt has been submitted and is sitting in the review queue. The grade lands once a reviewer scores it.";

/* ─────────────────────────────── staging model ─────────────────────────── */

type Staged =
  | { kind: "complete"; uid: string; tid: string; grade: number | null }
  | { kind: "incomplete"; uid: string; tid: string }
  /* Certifying is its OWN record — it does not touch a single task. */
  | { kind: "cert"; uid: string; certId: string }
  | { kind: "certun"; uid: string; certId: string }
  | { kind: "grant"; uid: string; tid: string; n: number };

/* ─────────────────────────────── page ──────────────────────────────────── */

type What = { kind: "cert" | "task"; id: string } | null;
/** `max` is the scale the admin types in — 100 for a Quiz, the Task's own
 *  max score for a Hands-On Task (see {@link gradeScale}). */
type GradePrompt = { uid: string; tid: string; taskName: string; type: string; max: number } | null;
type TaskRef = { uid: string; tid: string } | null;
type MenuState =
  | { kind: "task"; uid: string; tid: string; rect: DOMRect }
  | { kind: "cert"; uid: string; certId: string; rect: DOMRect }
  | null;

export function ContentOverridesPage({
  onViewAttempts,
  initialUserId,
  initialCertId,
  initialTaskId,
  backLabel,
  onBack,
}: {
  /** Opens the Attempts page for this employee + task, in a new tab. */
  onViewAttempts: (uid: string, tid: string) => void;
  /* The page is never reached unscoped — every entry point is a row's
     "Manage User Progress" action, and each pre-selects one half of the
     scope. The other half is picked here, as usual. Ids that don't resolve in
     the generated model simply leave that half empty. */
  /** Pre-selects this employee (Manage Users). */
  initialUserId?: string;
  /** Pre-selects this certification (Certifications). */
  initialCertId?: string;
  /** Pre-selects this task (Tasks). */
  initialTaskId?: string;
  /** Crumb label for the page that opened this one. */
  backLabel?: string;
  onBack?: () => void;
}) {
  const data = useMemo(() => buildData(), []);

  /* Committed state — only the apply step writes these. */
  const [cells, setCells] = useState<CellMap>(() => data.cells);
  const [certManual, setCertManual] = useState<CertManual>({});

  /* Staged changes — nothing touches `cells` until Review & Save confirms. */
  const [staged, setStaged] = useState<Staged[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* Scope: one employee id, and a certification or a task. */
  const [who, setWho] = useState<string | null>(() =>
    initialUserId && data.employeesById[initialUserId] ? initialUserId : null,
  );
  const [what, setWhat] = useState<What>(() => {
    if (initialCertId && data.certsById[initialCertId]) return { kind: "cert", id: initialCertId };
    if (initialTaskId && data.tasksById[initialTaskId]) return { kind: "task", id: initialTaskId };
    return null;
  });
  const [whoQ, setWhoQ] = useState("");
  const [whatQ, setWhatQ] = useState("");

  const [gradePrompt, setGradePrompt] = useState<GradePrompt>(null);
  const [gradeInput, setGradeInput] = useState("");

  /* Modals + anchored menus. */
  const [menu, setMenu] = useState<MenuState>(null);
  const [grantFor, setGrantFor] = useState<TaskRef>(null);
  const [grantN, setGrantN] = useState("1");
  /** Whether the footer's "N Changes Made" is showing its hover card. */
  const [changesOpen, setChangesOpen] = useState(false);

  /* selection */
  function selectWho(id: string) {
    setWho(id);
    setWhoQ("");
  }
  function selectWhat(kind: "cert" | "task", id: string) {
    setWhat({ kind, id });
    setWhatQ("");
  }
  function clearWho() {
    setWho(null);
    setWhoQ("");
  }
  function clearWhat() {
    setWhat(null);
    setWhatQ("");
  }
  function setScope(w: string, x: NonNullable<What>) {
    setWho(w);
    setWhat(x);
    setWhoQ("");
    setWhatQ("");
  }
  function openGrant(uid: string, tid: string) {
    setGrantN("1");
    setGrantFor({ uid, tid });
  }

  /* ───── staged-change helpers ───── */
  const stagedComplete = (uid: string, tid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "complete" }> => s.kind === "complete" && s.uid === uid && s.tid === tid);
  const stagedIncomplete = (uid: string, tid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "incomplete" }> => s.kind === "incomplete" && s.uid === uid && s.tid === tid);
  const stagedCertOf = (uid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "cert" }> => s.kind === "cert" && s.uid === uid);
  const stagedCertUnOf = (uid: string) =>
    staged.find((s): s is Extract<Staged, { kind: "certun" }> => s.kind === "certun" && s.uid === uid);

  const isStagedComplete = (uid: string, tid: string) => !!stagedComplete(uid, tid);
  const isStagedIncomplete = (uid: string, tid: string) => !!stagedIncomplete(uid, tid);

  /** Stage / unstage one task's manual completion — or, on a task that is
   *  already complete, its reopening. Staging a gradeable completion routes
   *  through the grade prompt first. */
  function toggleComplete(uid: string, tid: string) {
    const cell = cells[uid + "_" + tid];
    if (!cell) return;
    if (cell.status === "complete") {
      const ex = stagedIncomplete(uid, tid);
      setStaged((prev) => (ex ? prev.filter((s) => s !== ex) : [...prev, { kind: "incomplete", uid, tid }]));
      return;
    }
    const ex = stagedComplete(uid, tid);
    if (ex) {
      setStaged((prev) => prev.filter((s) => s !== ex));
      return;
    }
    const t = data.tasksById[tid];
    if (t && needsGradePrompt(t)) {
      setGradePrompt({ uid, tid, taskName: t.name, type: t.type, max: gradeScale(t) });
      setGradeInput("");
    } else {
      setStaged((prev) => [...prev, { kind: "complete", uid, tid, grade: null }]);
    }
  }

  function confirmGrade() {
    if (!gradePrompt) return;
    const raw = gradeInput.trim();
    /* Typed on the task's own scale; stored as a percentage (see formatGrade). */
    const grade = raw === "" ? null : Number(raw) * (100 / gradePrompt.max);
    setStaged((prev) => [...prev, { kind: "complete", uid: gradePrompt.uid, tid: gradePrompt.tid, grade }]);
    setGradePrompt(null);
    setGradeInput("");
  }

  /** Stage / unstage "mark certification complete". The certification is its
   *  own record: awarding it says this person is certified, and says nothing
   *  about the individual tasks — they keep whatever state they earned, and a
   *  task is only ever completed by completing that task. */
  function toggleCertStage(uid: string, certId: string) {
    const ex = stagedCertOf(uid);
    setStaged((prev) => (ex ? prev.filter((s) => s !== ex) : [...prev, { kind: "cert", uid, certId }]));
  }

  /** Stage / unstage "mark certification incomplete" — the mirror image: it
   *  withdraws the certification and leaves every task alone. */
  function toggleCertUnstage(uid: string, certId: string) {
    const ex = stagedCertUnOf(uid);
    setStaged((prev) => (ex ? prev.filter((s) => s !== ex) : [...prev, { kind: "certun", uid, certId }]));
  }

  function stageGrant(uid: string, tid: string) {
    const n = Math.max(1, Math.min(MAX_GRANT, parseInt(grantN, 10) || 1));
    setStaged((prev) => {
      const ex = prev.find((s) => s.kind === "grant" && s.uid === uid && s.tid === tid);
      if (ex) return prev.map((s) => (s === ex ? { ...s, n } : s));
      return [...prev, { kind: "grant", uid, tid, n }];
    });
    setGrantFor(null);
  }

  /** One sentence per staged change, for the dialog and footer summary. */
  /** What a staged change is ABOUT — "Samuel Okafor · EPA 608 Type I Final
   *  Exam", the left half of a Changes Made row (Figma 1155:1140). */
  function changeSubject(s: Staged): string {
    const who = data.employeesById[s.uid]?.name ?? s.uid;
    const what =
      s.kind === "cert" || s.kind === "certun"
        ? data.certsById[s.certId]?.name ?? "Certification"
        : data.tasksById[s.tid]?.name ?? s.tid;
    return `${who} · ${what}`;
  }

  /** What the change DOES — the right half of the same row, phrased with the
   *  same four verbs the ⋯ menu uses. */
  function changeAction(s: Staged): string {
    if (s.kind === "complete") {
      const t = data.tasksById[s.tid];
      const g = t && s.grade != null ? formatGrade(t, Math.round(s.grade)) : "";
      return `Mark as Complete${g ? ` (${g})` : ""}`;
    }
    if (s.kind === "incomplete") return "Mark as Incomplete";
    if (s.kind === "cert") return "Mark as Complete";
    if (s.kind === "certun") return "Mark as Incomplete";
    return `Grant +${s.n} ${s.n === 1 ? "Attempt" : "Attempts"}`;
  }

  /* ⌘↵ / Ctrl+↵ opens Review & Save, the same keys the Hands-On review console
     puts on its Submit CTA — which is why this CTA carries the keycaps too.
     Held in a ref so the listener binds once and still sees current state, and
     inert while a modal is up: that dialog has its own confirm. */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
    if (dialogOpen || gradePrompt || grantFor) return;
    if (staged.length === 0) return;
    e.preventDefault();
    setDialogOpen(true);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function discardChanges() {
    setStaged([]);
    setDialogOpen(false);
  }

  function applyChanges() {
    let c = cells;
    let m = certManual;
    staged.forEach((s) => {
      if (s.kind === "grant") c = applyGrantAttempt(c, s.uid, s.tid, s.n);
      else if (s.kind === "complete") c = applyMarkComplete(c, s.uid, s.tid, s.grade, ADMIN_ACTOR);
      else if (s.kind === "incomplete") c = applyMarkIncomplete(c, s.uid, s.tid);
      /* Both certification actions write the certification record ONLY —
         `cells` is untouched, so no task gains or loses a completion. */
      else if (s.kind === "cert") m = applyMarkCert(m, s.uid, s.certId);
      else if (s.kind === "certun") m = applyClearCert(m, s.uid, s.certId);
    });
    const n = staged.length;
    setCells(c);
    setCertManual(m);
    setStaged([]);
    setDialogOpen(false);
    setToast(`${n} ${n === 1 ? "change" : "changes"} applied — logged as ${ADMIN_ACTOR}, ${ADMIN_STAMP}`);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  /* ───── derived scope ───── */
  const whoUser = who ? data.employeesById[who] ?? null : null;
  const certObj = what?.kind === "cert" ? data.certsById[what.id] : null;
  const taskObj = what?.kind === "task" ? data.tasksById[what.id] : null;

  const hasScope = !!(whoUser && what);
  const isLanding = !whoUser && !what;
  const isHalf = !!whoUser !== !!what;

  const certTasks: CertTask[] = certObj
    ? certObj.taskIds.map((id) => data.tasksById[id]).filter(Boolean)
    : [];

  const showUserCert = !!whoUser && !!certObj;
  const showUserTask = !!whoUser && !!taskObj;

  /* ───── search matches ─────
     The people half has NO suggested searches — an arbitrary slice of the
     roster suggests nothing — so it only lists once something is typed. */
  const whoQl = whoQ.trim().toLowerCase();
  const peopleMatches = (
    whoQl
      ? data.employees.filter(
          (e) => e.name.toLowerCase().includes(whoQl) || e.contact.toLowerCase().includes(whoQl),
        )
      : []
  ).slice(0, 8);

  /* The other half DOES: a fixed shortlist, in this order, whenever nothing is
     typed (SUGGESTED_CERTS / SUGGESTED_TASKS). Typing searches everything. */
  const whatQl = whatQ.trim().toLowerCase();
  const certMatches = whatQl
    ? data.certifications.filter((c) => c.name.toLowerCase().includes(whatQl))
    : suggestedIn(data.certifications, SUGGESTED_CERTS);
  const taskMatches = whatQl
    ? data.tasks.filter((t) => t.name.toLowerCase().includes(whatQl)).slice(0, 10)
    : suggestedIn(data.tasks, SUGGESTED_TASKS);

  /* ───── combobox option lists (Figma 1162:1312 / 1162:1454) ─────
     A row is its name and, on the right, what kind of thing it is. People get
     no kind — their second line identifies them instead. No avatars, chips or
     type icons: the node draws text only. */
  const whoOptions: ScopeOption[] = peopleMatches.map((e) => ({
    key: "emp_" + e.id,
    name: e.name,
    sub: `${e.contact} · ${e.phone}`,
    onSelect: () => selectWho(e.id),
  }));

  const whatOptions: ScopeOption[] = [
    ...certMatches.map((c) => ({
      key: "cert_" + c.id,
      name: c.name,
      kind: "Certification",
      onSelect: () => selectWhat("cert", c.id),
    })),
    ...taskMatches.map((t) => ({
      key: "task_" + t.id,
      name: t.name,
      kind: t.type === "Hands-On Task" ? "Hands-On Task" : `${t.type} Task`,
      onSelect: () => selectWhat("task", t.id),
    })),
  ];

  /* ───── selected-scope tokens ───── */
  const whoScope = whoUser ? whoUser.name : null;
  /* The picked value reads as plain text in the bar (Figma 1160:1286), so the
     kind is a word after the name rather than a label chip before it. */
  const whatScope = certObj
    ? `${certObj.name} Certification`
    : taskObj
    ? `${taskObj.name} Task`
    : null;

  /* examples (real entities) */
  const examples = [
    { who: "Diego Ramirez", what: "EPA 608 Type I", w: "U-10132", x: { kind: "cert", id: "C-0420" } as const },
    { who: "Ayesha Khan", what: "Refrigerant Charging", w: "U-10157", x: { kind: "task", id: "T-2350" } as const },
  ].filter((ex) => {
    // Only show examples whose entities resolve in the built model.
    const wok = !!data.employeesById[ex.w];
    const xok = ex.x.kind === "cert" ? !!data.certsById[ex.x.id] : !!data.tasksById[ex.x.id];
    return wok && xok;
  });

  /* half-state copy */
  const half =
    whoUser && !what
      ? { title: "Now pick what to check", sub: "Search a certification or a single task above.", num: "2" }
      : { title: "Now pick who to check", sub: "Search an employee above.", num: "1" };

  /* ───── shared row bits handed to the task table ───── */
  const rowCtx: RowCtx = {
    cells,
    isStagedComplete,
    isStagedIncomplete,
    toggleComplete,
    openGrant,
    openMenu: (uid, tid, rect) => setMenu({ kind: "task", uid, tid, rect }),
    menuFor: menu?.kind === "task" ? { uid: menu.uid, tid: menu.tid } : null,
  };

  /* Employee × certification derivations. */
  const certProgress =
    showUserCert ? progress(cells, certManual, whoUser!.id, certTasks, certObj!.id) : null;
  const certStaged = showUserCert && !!stagedCertOf(whoUser!.id);
  const certUnStaged = showUserCert && !!stagedCertUnOf(whoUser!.id);

  /* Employee × task derivations. */
  const taskCell = showUserTask ? cells[whoUser!.id + "_" + taskObj!.id] : null;

  /* Modal subjects. */
  const grantTask = grantFor ? data.tasksById[grantFor.tid] : null;
  const grantUser = grantFor ? data.employeesById[grantFor.uid] : null;

  /* The anchored menu's rows, by what it was opened on. */
  const menuItems: MenuItem[] = (() => {
    if (!menu) return [];
    if (menu.kind === "cert") {
      /* One action, by state: award the certification until it is certified,
         withdraw it after. Either way the Tasks are left exactly as they are.
         The row is icon + label only — this menu carries no subtext — and the
         wording is the same four labels a task row uses; what is being marked
         is already said by the card the menu hangs off. */
      if (!certProgress?.certified) {
        return [
          {
            icon: <MenuMarkCompleteIcon />,
            label: certStaged ? "Undo Mark as Complete" : "Mark as Complete",
            onPick: () => toggleCertStage(menu.uid, menu.certId),
          },
        ];
      }
      return [
        {
          icon: <MenuMarkIncompleteIcon />,
          label: certUnStaged ? "Undo Mark as Incomplete" : "Mark as Incomplete",
          danger: true,
          onPick: () => toggleCertUnstage(menu.uid, menu.certId),
        },
      ];
    }
    const t = data.tasksById[menu.tid];
    const c = cells[menu.uid + "_" + menu.tid];
    if (!t || !c) return [];
    const done = c.status === "complete";
    const stagedC = isStagedComplete(menu.uid, menu.tid);
    const stagedI = isStagedIncomplete(menu.uid, menu.tid);
    /* Row order and labels are Figma 970:991: the attempt actions read first,
       the completion override last. The node lists Mark as Complete AND Mark
       as Incomplete together because it draws every row a task can have — a
       real task is one or the other, so only the applicable one renders. */
    const items: MenuItem[] = [];
    /* Viewing attempts works wherever they're kept; granting only means
       something where they're capped — a quiz with a limit, i.e. the final
       exam. */
    if (tracksAttempts(t)) {
      items.push({
        icon: <MenuAttemptsIcon />,
        label: "View All Attempts",
        onPick: () => onViewAttempts(menu.uid, menu.tid),
      });
    }
    if (attemptInfo(t, c).hasLimit) {
      items.push({
        icon: <MenuGrantAttemptsIcon />,
        label: "Grant Additional Attempts",
        onPick: () => openGrant(menu.uid, menu.tid),
      });
    }
    /* The row has no other control, so a staged change is undone from here. */
    items.push(
      done
        ? {
            icon: <MenuMarkIncompleteIcon />,
            label: stagedI ? "Undo Mark as Incomplete" : "Mark as Incomplete",
            onPick: () => toggleComplete(menu.uid, menu.tid),
          }
        : {
            icon: <MenuMarkCompleteIcon />,
            label: stagedC ? "Undo Mark as Complete" : "Mark as Complete",
            onPick: () => toggleComplete(menu.uid, menu.tid),
          },
    );
    return items;
  })();

  return (
    <div className="main">
      <div className="workspace">
        <div className="mc-root">
          {/* ===== page header (Figma 46:314) ===== */}
          <header className="mc-header">
            {/* Reached only from another page's row menu, so that page's crumb
                is the way back — same header as Who Paid / Quiz Attempts. */}
            {onBack && backLabel && (
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <button className="rvc-crumb" onClick={onBack} title={`Back to ${backLabel}`}>
                  {backLabel}
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Manage Completions</span>
              </nav>
            )}
            <h1 className="tasks-title">Manage Completions</h1>
            <div className="tasks-subtitle">
              Look up an employee, then a certification or a single task, to review and override
              completions.
            </div>
          </header>

          {/* ===== scope pickers (Figma 1159:1249) =====
              ONE 43px bar split down the middle by a hairline, not two bars
              with a chevron between them. Each half is still its own
              combobox — the shell just owns the search chrome now. */}
          <div className="mc-scoperow">
            <div className="mc-scopebar">
              <ScopeSearch
                placeholder="Select a User..."
                scope={whoScope}
                query={whoQ}
                onQuery={setWhoQ}
                onClearScope={clearWho}
                options={whoOptions}
                emptyText="No users match."
              />
              <ScopeSearch
                placeholder="Select a Task/Certification..."
                scope={whatScope}
                query={whatQ}
                onQuery={setWhatQ}
                onClearScope={clearWhat}
                options={whatOptions}
                emptyText="No certifications or tasks match."
              />
            </div>
          </div>

          {/* ===== body ===== */}
          <main className="mc-body">
            {isLanding && (
              <div className="mc-empty">
                <div className="mc-empty-inner">
                  <span className="mc-empty-icon">
                    <SearchIcon />
                  </span>
                  <div className="mc-empty-title">Find someone, then pick what to check</div>
                  <div className="mc-empty-sub">
                    Search an <strong>employee</strong>, then a{" "}
                    <strong>certification or a single task</strong>, to review their progress and
                    override completions.
                  </div>
                  {examples.length > 0 && (
                    <>
                      <SectionHeading label="Jump to an example" />
                      <div className="mc-examples">
                        {examples.map((ex, i) => (
                          <button key={i} className="btn-save-draft mc-example" onClick={() => setScope(ex.w, ex.x)}>
                            <span>{ex.who}</span>
                            <ChevronRightIcon />
                            <span className="mc-example-what">{ex.what}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {isHalf && (
              <div className="mc-empty">
                <div className="mc-empty-inner is-narrow">
                  <span className="mc-empty-step">{half.num}</span>
                  <div className="mc-empty-title">{half.title}</div>
                  <div className="mc-empty-sub">{half.sub}</div>
                </div>
              </div>
            )}

            {hasScope && (
              <div className="mc-scroll">
                {/* ── employee × certification ── */}
                {showUserCert && certProgress && (
                  <>
                    {/* Certification card (Figma 965:1401): progress headline,
                        the task count, and the ⋯ that holds every
                        certification-level action. */}
                    <div
                      className={`mc-notice mc-certcard${
                        certProgress.certified
                          ? " is-complete"
                          : certProgress.pct > 0
                          ? " is-progress"
                          : ""
                      }`}
                      style={{ "--mc-pct": `${certProgress.pct}%` } as CSSProperties}
                    >
                      <div className="mc-notice-text">
                        <div className="mc-certcard-title">
                          {certProgress.certified ? "Certification Complete" : `${certProgress.pct}% Complete`}
                        </div>
                        {/* Certified reports the date and nothing else — the
                            award no longer implies anything about the Tasks,
                            so it stops counting them (1153:1129). A manual
                            award names the admin who made it (1157:1219). */}
                        <div className="mc-certcard-sub">
                          {certProgress.certified
                            ? `Completed on ${fmtDY(certProgress.certAt) || "—"}${
                                certProgress.certBy
                                  ? ` · Marked Complete by ${certProgress.certBy}`
                                  : ""
                              }`
                            : `${certProgress.c} out of ${certTasks.length} Tasks in the Certification are complete`}
                        </div>
                      </div>
                      <button
                        className="row-action-btn lone-dots"
                        aria-label="Certification actions"
                        onClick={(e) =>
                          setMenu({
                            kind: "cert",
                            uid: whoUser!.id,
                            certId: certObj!.id,
                            rect: e.currentTarget.getBoundingClientRect(),
                          })
                        }
                      >
                        <RowKebabIcon />
                      </button>
                    </div>

                    <TaskTable uid={whoUser!.id} tasks={certTasks} ctx={rowCtx} />
                  </>
                )}

                {/* ── employee × task ── */}
                {showUserTask && taskCell && (
                  <>
                    <TaskStateCard cell={taskCell} />
                    {/* The same table the certification view uses, holding the
                        one task in scope — so a row reads identically either
                        way, actions included. */}
                    <TaskTable uid={whoUser!.id} tasks={[taskObj!]} ctx={rowCtx} />
                  </>
                )}
              </div>
            )}
          </main>

          {/* ===== staged-changes footer (Review & Save) ===== */}
          {/* Review & Save footer — the shared `.sp-save-footer` bar the
              Spotlights queue uses for "Order Updated". The count replaces the
              old dot + ellipsised summary: the changes themselves are one
              hover away, in the 1155:1140 card, where each can also be
              dropped on its own. */}
          {staged.length > 0 && (
            <footer className="sp-save-footer">
              <div
                className="sp-save-footer-text mc-changes"
                onMouseEnter={() => setChangesOpen(true)}
                onMouseLeave={() => setChangesOpen(false)}
              >
                {staged.length} {staged.length === 1 ? "Change" : "Changes"} Made
                {changesOpen && (
                  /* The pop wrapper carries the gap as PADDING, so the pointer
                     never crosses dead space on its way into the card. */
                  <div className="mc-changes-pop">
                  <div className="mc-changes-card">
                    {staged.map((s, i) => (
                      <div className="mc-change-row" key={i}>
                        <span className="mc-change-text">
                          <span>{changeSubject(s)}</span>
                          <ChangeArrowIcon />
                          <span>{changeAction(s)}</span>
                        </span>
                        <button
                          className="mc-change-drop"
                          aria-label={`Discard: ${changeSubject(s)}`}
                          onClick={() => setStaged((prev) => prev.filter((x) => x !== s))}
                        >
                          <SmallCloseIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                  </div>
                )}
              </div>
              <div className="sp-save-footer-actions">
                <button className="btn-save-draft" onClick={discardChanges}>
                  Discard
                </button>
                <button className="btn-publish sp-submit" onClick={() => setDialogOpen(true)}>
                  Review &amp; Save
                  <span className="rvc-submit-keys">
                    <span className="rvc-qkey rvc-qkey--cmd"><CommandIcon /></span>
                    <span className="rvc-qkey"><EnterKeyIcon /></span>
                  </span>
                </button>
              </div>
            </footer>
          )}

          {/* ===== anchored 3-dot menu (task rows + the certification) ===== */}
          {menu && menuItems.length > 0 && (
            <AnchoredMenu rect={menu.rect} onClose={() => setMenu(null)} items={menuItems} />
          )}

          {/* ===== review-changes dialog ===== */}
          {/* A plain confirmation: the changes, one under another, and the two
              buttons. No reason field, no boxed rows, no audit line. */}
          {dialogOpen && (
            <PrmModal
              title={`Apply ${staged.length} ${staged.length === 1 ? "Change" : "Changes"}?`}
              confirmLabel="Apply Changes"
              onCancel={() => setDialogOpen(false)}
              onConfirm={applyChanges}
            >
              <div className="mc-review-list">
                {staged.map((s, i) => (
                  <div className="mc-review-item" key={i}>
                    {changeSubject(s)}
                    <ChangeArrowIcon />
                    {changeAction(s)}
                  </div>
                ))}
              </div>
            </PrmModal>
          )}

          {/* ===== grant-attempts modal ===== */}
          {grantFor && grantTask && grantUser && (
            <PrmModal
              title="Grant Additional Attempts"
              description={`${grantUser.name} · ${grantTask.name}`}
              confirmLabel="Continue"
              onCancel={() => setGrantFor(null)}
              onConfirm={() => stageGrant(grantFor.uid, grantFor.tid)}
            >
              <div className="prm-field">
                <span className="prm-label">Additional Attempts</span>
                <Stepper
                  value={grantN}
                  onChange={setGrantN}
                  min={1}
                  max={MAX_GRANT}
                  ariaLabel="Additional attempts"
                />
              </div>
            </PrmModal>
          )}

          {/* ===== grade prompt (staging a gradeable completion) ===== */}
          {/* Mark Complete — on the SHARED modal shell (Figma 483:588) like every
              other pop-up here. It used to be a one-off 460px `.pm-modal`. */}
          {gradePrompt && (
            <PrmModal
              title="Mark Complete"
              description={`${gradePrompt.taskName} · ${gradePrompt.type}`}
              confirmLabel="Continue"
              onCancel={() => {
                setGradePrompt(null);
                setGradeInput("");
              }}
              onConfirm={confirmGrade}
            >
              <div className="prm-field">
                <label className="prm-label" htmlFor="mc-grade">
                  Grade
                </label>
                <div className="mc-gradefield">
                  <input
                    id="mc-grade"
                    className="form-input"
                    type="number"
                    min={0}
                    max={gradePrompt.max}
                    autoFocus
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmGrade();
                    }}
                  />
                  <span className="mc-gradefield-suffix">/ {gradePrompt.max}</span>
                </div>
                <p className="prm-help">
                  Optional. Enter a score, or leave blank to mark complete without one
                </p>
              </div>
            </PrmModal>
          )}

          {/* applied-changes toast */}
          {toast && <div className="rvc-toast">{toast}</div>}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── scope search combobox (Figma "Expanded Search") ──── */

type ScopeOption = {
  key: string;
  /** Row title — 16px Medium white. */
  name: string;
  /** Second line under it, users only ("email · phone"). */
  sub?: string;
  /** Right-aligned kind — "Certification", "Quiz Task". Blank for people. */
  kind?: string;
  onSelect: () => void;
};

/**
 * The shared `.usearch` combobox (as used by Manage Users / Tasks / Review).
 * A committed selection reads as the field's own value (Figma 1160:1286) —
 * not the app's usual `.usearch-scope` token — and is cleared with the ✕ or
 * with Backspace on an empty input.
 */
function ScopeSearch({
  placeholder,
  scope,
  query,
  onQuery,
  onClearScope,
  options,
  emptyText,
}: {
  placeholder: string;
  /** The committed pick, shown as the field's value. */
  scope: string | null;
  query: string;
  onQuery: (v: string) => void;
  onClearScope: () => void;
  options: ScopeOption[];
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setActive(-1), [query, scope]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function choose(opt: ScopeOption) {
    opt.onSelect();
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[active >= 0 ? active : 0];
      if (opt) choose(opt);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && query === "" && scope) {
      onClearScope();
    }
  }

  return (
    <div className="usearch mc-search" ref={wrapRef}>
      {/* A committed pick is NOT a token chip here — it reads as the field's
          own value, white, with the ✕ at the half's right edge (1160:1286).
          The input stays live underneath: type to search again, Backspace on
          an empty field clears the pick. */}
      <div className={`usearch-bar ${open ? "open" : ""}${scope ? " is-picked" : ""}`}>
        <span className="usearch-icon">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="usearch-input"
          placeholder={scope ?? placeholder}
          title={scope ? `${scope} — press Backspace to clear` : undefined}
          value={query}
          onChange={(e) => {
            onQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {/* Once there is something to clear — typed text or a picked scope —
            the half ends in a ✕. This bar carries no ⌘K badge (1159:1249). */}
        {(query || scope) && (
          <button
            type="button"
            className="usearch-clear"
            aria-label="Clear search"
            title="Clear search"
            /* Keep the input focused — clearing should not close the panel. */
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onQuery("");
              onClearScope();
              setActive(-1);
              inputRef.current?.focus();
            }}
          >
            <SearchClearIcon />
          </button>
        )}
      </div>

      {/* With nothing typed and nothing to suggest — the people half has no
          suggestions — there is no panel to show. */}
      {open && (options.length > 0 || query.trim()) && (
        <div className="usearch-panel">
          {/* One header for the panel (1162:1312 / 1162:1385): what the list is
              — the suggestions, or the results for what has been typed. */}
          <div className="usearch-head mc-opt-head">
            {query.trim() ? (
              <>
                Showing Results for “<span className="mc-opt-q">{query.trim()}</span>”
              </>
            ) : (
              "Suggested Searches:"
            )}
          </div>
          {options.length === 0 ? (
            <div className="usearch-empty">{emptyText}</div>
          ) : (
            options.map((opt, i) => (
              <button
                key={opt.key}
                className={`usearch-row ${active === i ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(opt)}
              >
                <span className="mc-opt-text">
                  <span className="mc-opt-name">{opt.name}</span>
                  {opt.sub && <span className="mc-opt-sub">{opt.sub}</span>}
                </span>
                {opt.kind && <span className="mc-opt-kind">{opt.kind}</span>}
              </button>
            ))
          )}
          <SearchHints />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── shared row context ────────────────────────── */

type RowCtx = {
  cells: CellMap;
  isStagedComplete: (uid: string, tid: string) => boolean;
  isStagedIncomplete: (uid: string, tid: string) => boolean;
  toggleComplete: (uid: string, tid: string) => void;
  openGrant: (uid: string, tid: string) => void;
  openMenu: (uid: string, tid: string, rect: DOMRect) => void;
  /** The row whose menu is open — it holds the hover treatment open. */
  menuFor: { uid: string; tid: string } | null;
};

/* ───────────────────────────── task table ──────────────────────────────── */

/** One person's tasks on the employee × certification view — the Figma
 *  960:980 card: TASK · TIME SPENT · COMPLETED ON · GRADE · ATTEMPTS · ⋯. */
function TaskTable({ uid, tasks, ctx }: { uid: string; tasks: CertTask[]; ctx: RowCtx }) {
  return (
    <div className="mct">
      <div className="mct-hd">
        <span className="mct-c-task">Task</span>
        <span className="mct-c-time">Time Spent</span>
        <span className="mct-c-date">Completed On</span>
        <span className="mct-c-grade">Grade</span>
        <span className="mct-c-att">Attempts</span>
        <span className="mct-c-menu" />
      </div>
      {/* Only the rows scroll — the page, the card and this header stay put. */}
      <div className="mct-rows">
        {tasks.map((t) => (
          <TaskRow key={t.id} uid={uid} task={t} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ uid, task, ctx }: { uid: string; task: CertTask; ctx: RowCtx }) {
  const cell = ctx.cells[uid + "_" + task.id];
  const done = cell.status === "complete";
  const stagedC = ctx.isStagedComplete(uid, task.id);
  const stagedI = ctx.isStagedIncomplete(uid, task.id);
  const time = tracksTime(task) ? fmtMins(cell.timeSpent) : "";
  const grade = gradeLabel(task, cell);
  const menuOpen = ctx.menuFor?.uid === uid && ctx.menuFor.tid === task.id;
  /* Same gate as the menu row: granting only means something where attempts
     are capped. */
  const canGrant = attemptInfo(task, cell).hasLimit;
  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    ctx.openMenu(uid, task.id, e.currentTarget.getBoundingClientRect());
  };
  return (
    <div
      className={`mct-row${stagedC || stagedI ? " is-staged" : ""}${menuOpen ? " is-menu" : ""}`}
    >
      <span className="mct-c-task">
        <span className="mct-name">{task.name}</span>
        <span className="mct-type">· {TYPE_SHORT[task.type]}</span>
      </span>
      <span className="mct-c-time">{time || "-"}</span>
      <span className="mct-c-date">
        {!done ? (
          "-"
        ) : cell.manual ? (
          /* The flag and the date share one tooltip naming who set it. */
          <span className="mct-manual" data-tip={`Manually marked complete by ${cell.markedBy ?? ADMIN_ACTOR}`}>
            {fmtDY(cell.completedAt)}
            <FlagIcon />
          </span>
        ) : (
          fmtDY(cell.completedAt)
        )}
      </span>
      {/* Every task's grade reads on its own scale ("72%", "18/25"), so the
          bar it had to clear is named on hover rather than guessed at. */}
      <span className="mct-c-grade" data-tip={grade ? passMarkLabel(task) : undefined}>
        {grade || "-"}
      </span>
      <span className="mct-c-att">
        <AttemptsValue task={task} cell={cell} />
      </span>
      {/* Shared row-action chrome (Figma 386:269): the resting kebab gives way
          to the bar pill on hover, exactly as on Tasks and Certifications.
          Where attempts are capped — the final exam — granting more is the one
          action worth reaching without opening the menu, so the bar gains a
          second ICON cell for it, the way the node draws every cell; the
          kebab keeps the rest. Everywhere else the kebab is the whole bar. */}
      <span className="mct-c-menu">
        <button className="row-action-btn lone-dots" aria-label="Task actions" onClick={openMenu}>
          <RowKebabIcon />
        </button>
        <div className="row-action-bar">
          {canGrant && (
            <button
              className="row-action-btn"
              aria-label="Grant Additional Attempts"
              data-tip="Grant Additional Attempts"
              onClick={(e) => {
                e.stopPropagation();
                ctx.openGrant(uid, task.id);
              }}
            >
              <MenuGrantAttemptsIcon />
            </button>
          )}
          <button className="row-action-btn" aria-label="Task actions" onClick={openMenu}>
            <RowKebabIcon />
          </button>
        </div>
      </span>
    </div>
  );
}

/* ───────────────────────── employee × task view ────────────────────────── */

/** The single-task view's top card — the certification card's shell, reading
 *  one task's state instead of a percentage. The wash is SOLID here (there is
 *  no progress to ramp across): grey until the task is touched, amber while it
 *  is in flight, green once it is complete.
 *
 *  Every action lives in the table row below, so this card carries no controls
 *  of its own — the row's ⋯ is the one place they live. */
function TaskStateCard({ cell }: { cell: Cell }) {
  const done = cell.status === "complete";
  const started = cell.status === "review" || !!cell.startedAt || (cell.attempts || 0) > 0;
  const state = done ? "complete" : started ? "progress" : "idle";

  const title = done ? "Complete" : started ? "In Progress" : "Not Started";
  const sub = done
    ? `Completed on ${fmtDY(cell.completedAt) || "—"}${
        cell.markedBy ? ` · Marked Complete by ${cell.markedBy}` : ""
      }`
    : cell.status === "review"
    ? "Submitted — waiting on review"
    : started
    ? `${cell.attempts} ${cell.attempts === 1 ? "attempt" : "attempts"} so far`
    : "No attempts yet";

  return (
    <div className={`mc-notice mc-certcard mc-taskstate is-${state}`}>
      <div className="mc-notice-text">
        <div className="mc-certcard-title">{title}</div>
        <div className="mc-certcard-sub">{sub}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── anchored 3-dot menu ─────────────────────────── */

type MenuItem = {
  icon: JSX.Element;
  label: string;
  onPick: () => void;
  /** Destructive row — the design-system red (.u-menu-item--danger). */
  danger?: boolean;
};

/** Same `.u-menu` chrome + fixed positioning as the Users row menu — the
 *  table scrolls, so an in-row popover would be clipped. */
function AnchoredMenu({
  rect,
  onClose,
  items,
}: {
  rect: DOMRect;
  onClose: () => void;
  items: MenuItem[];
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
      {items.map((it) => (
        <button
          key={it.label}
          className={`u-menu-item${it.danger ? " u-menu-item--danger" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            it.onPick();
            onClose();
          }}
        >
          <span className="u-menu-item-icon">{it.icon}</span>
          <span className="u-menu-item-text">
            <span>{it.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

