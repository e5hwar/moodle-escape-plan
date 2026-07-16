import {
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { TaskType } from "../data/tasks";
import {
  applyClearCert,
  applyGrantAttempt,
  applyMarkCert,
  applyMarkComplete,
  attemptInfo,
  buildData,
  buildDetail,
  needsGradePrompt,
  progress,
  statusVisual,
  fmtD,
  fmtDT,
  type CellMap,
  type CellStatus,
  type CertManual,
  type CertTask,
  type Employee,
  type TimelineEvent,
} from "../data/certLookup";

/**
 * Certification Lookup — search an employee or a cohort, then a certification
 * or a single task. The combination drives the view:
 *
 *   employee + cert  → accordion of every task with grades, attempts, timeline
 *   employee + task  → single task detail
 *   cohort   + cert  → matrix of everyone × the cert's tasks
 *   cohort   + task  → roster of everyone's status on one task
 *
 * From a cohort you can open any person beside the matrix/roster (split view).
 * Admin actions — mark complete (with optional grade), grant a quiz attempt,
 * mark a certification — overlay the generated baseline via local state.
 *
 * Replaces the former Content Overrides grid; keeps the same export + route.
 */

const ACCENT = "#ec5e2c";
const AMBER = "#e8a24e";

/* ───────────────────────── small presentational bits ───────────────────── */

function TaskTypeIcon({
  type,
  size = 14,
  color = "currentColor",
}: {
  type: TaskType;
  size?: number;
  color?: string;
}) {
  const common: HTMLAttributes<SVGSVGElement> & Record<string, unknown> = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: color,
    strokeWidth: 1.4,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { display: "block" },
  };
  let body: ReactNode;
  switch (type) {
    case "Quiz":
      body = (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M6.4 6.4a1.7 1.7 0 1 1 2.4 1.55c-.55.35-.9.7-.9 1.35" />
          <circle cx="8" cy="11.4" r="0.55" fill={color} stroke="none" />
        </>
      );
      break;
    case "xAPI":
      body = <polyline points="1.8,8 4.3,8 6.2,3.8 9.8,12.2 11.7,8 14.2,8" />;
      break;
    case "Hands-On Task":
      body = <path d="M3 2.4 L3 12.2 L5.9 9.4 L8 13.4 L9.6 12.7 L7.6 8.8 L11.8 8.6 Z" />;
      break;
    case "Resource":
      body = (
        <>
          <path d="M4 1.8h5l3 3v9.4H4z" />
          <path d="M9 1.8v3h3" />
        </>
      );
      break;
    default:
      body = <circle cx="8" cy="8" r="5" />;
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <svg {...common}>{body}</svg>
    </span>
  );
}

function StatusDot({
  status,
  manual,
  size = 18,
}: {
  status: CellStatus;
  manual?: boolean;
  size?: number;
}) {
  const v = statusVisual(status, ACCENT, !!manual);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        fontSize: Math.round(size * 0.56),
        lineHeight: 1,
        flex: "none",
        background: v.bg,
        color: v.color,
        border: v.border,
        boxShadow: v.boxShadow,
      }}
    >
      {v.mark}
    </span>
  );
}

/** Inline-style element with a hover override (the design's `style-hover`). */
function HoverDiv({
  style,
  hoverStyle,
  children,
  ...rest
}: {
  style: CSSProperties;
  hoverStyle?: CSSProperties;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "style">) {
  const [h, setH] = useState(false);
  return (
    <div
      {...rest}
      style={{ ...style, ...(h && hoverStyle ? hoverStyle : null) }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {children}
    </div>
  );
}

function HoverButton({
  style,
  hoverStyle,
  children,
  ...rest
}: {
  style: CSSProperties;
  hoverStyle?: CSSProperties;
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLButtonElement>, "style">) {
  const [h, setH] = useState(false);
  return (
    <button
      {...rest}
      style={{ ...style, ...(h && hoverStyle ? hoverStyle : null) }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {children}
    </button>
  );
}

function Timeline({ events }: { events: TimelineEvent[] }) {
  const dotFor = (tone: TimelineEvent["tone"]): CSSProperties => {
    if (tone === "done")
      return { background: "#d8d6cd", border: "2px solid #d8d6cd" };
    if (tone === "accent")
      return { background: "#16171a", border: `3px solid ${ACCENT}` };
    return { background: "#16171a", border: "2px solid #45474c" };
  };
  const colorFor = (tone: TimelineEvent["tone"]) =>
    tone === "done" ? "#ece9e2" : tone === "accent" ? ACCENT : "#85878c";
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 6,
          top: 5,
          bottom: 10,
          width: 2,
          background: "#2c2e33",
        }}
      />
      {events.map((ev, i) => (
        <div
          key={i}
          style={{ display: "flex", gap: 12, position: "relative", paddingBottom: 12 }}
        >
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: "50%",
              flex: "none",
              position: "relative",
              zIndex: 1,
              ...dotFor(ev.tone),
            }}
          />
          <div style={{ marginTop: -2 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: colorFor(ev.tone) }}>
              {ev.label}
            </div>
            <div style={{ fontSize: 10.5, color: "#9a9ca1" }}>{ev.tsStr}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* metrics 4-up grid used in both detail views */
function MetricsGrid({ d }: { d: ReturnType<typeof buildDetail> }) {
  const cell = (label: string, value: ReactNode, big?: boolean) => (
    <div style={{ background: "#1a1b1e", padding: "11px 13px" }}>
      <div
        style={{
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          color: "#9a9ca1",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: big ? 16 : 13, fontWeight: 600 }}>{value}</div>
    </div>
  );
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gap: 1,
        background: "#24262b",
        border: "1px solid #24262b",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      {cell("Grade", d.gradeStr, true)}
      {cell("Done", d.completedStr)}
      {cell("Time", d.durStr)}
      {cell("Tries", d.attemptsStr)}
    </div>
  );
}

function QuizAttemptBox({
  d,
  onGrant,
  onViewAttempts,
}: {
  d: ReturnType<typeof buildDetail>;
  onGrant: () => void;
  onViewAttempts: () => void;
}) {
  return (
    <div
      style={{
        border: "1.5px solid #4a3a1f",
        background: "#1f1a12",
        borderRadius: 11,
        padding: "13px 15px",
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: AMBER,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Quiz attempts
          </div>
          <div style={{ fontSize: 12, color: "#bdbfc4" }}>{d.attemptsRemainingStr}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <HoverButton
            onClick={onViewAttempts}
            style={{
              flex: "none",
              padding: "10px 14px",
              border: "1.5px solid #3b3e44",
              borderRadius: 9,
              background: "#1a1b1e",
              color: "#bdbfc4",
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
            hoverStyle={{ background: "#26282d" }}
          >
            View attempts ↗
          </HoverButton>
          <HoverButton
            onClick={onGrant}
            style={{
              flex: "none",
              padding: "10px 14px",
              border: `1.5px solid ${ACCENT}`,
              borderRadius: 9,
              background: "#1a1b1e",
              color: AMBER,
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
            hoverStyle={{ background: "#2f2516" }}
          >
            + Grant another attempt
          </HoverButton>
        </div>
      </div>
      {d.hasGrants && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {d.grantLog.map((g, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ fontWeight: 600, color: AMBER }}>{g.amountStr}</span>
              <span style={{ color: "#83858b" }}>{g.atStr}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── page ──────────────────────────────────── */

type Who = { kind: "employee" | "cohort"; id: string } | null;
type What = { kind: "cert" | "task"; id: string } | null;
type GradePrompt = { uid: string; tid: string; taskName: string; type: string } | null;

export function ContentOverridesPage({
  onViewAttempts,
}: {
  /** Opens the Attempts page for this employee + task, in a new tab. */
  onViewAttempts: (uid: string, tid: string) => void;
}) {
  const data = useMemo(() => buildData(), []);

  const [cells, setCells] = useState<CellMap>(() => data.cells);
  const [certManual, setCertManual] = useState<CertManual>({});

  /* Deferred save: `cells`/`certManual` are the working (live-preview) state;
     the *saved* baseline is committed only when the admin clicks Save Changes.
     Unchanged entries keep their exact object reference through the apply*
     helpers, so a reference diff against the baseline is an exact dirty check. */
  const [savedCells, setSavedCells] = useState<CellMap>(() => data.cells);
  const [savedCerts, setSavedCerts] = useState<CertManual>({});

  const [who, setWho] = useState<Who>(null);
  const [what, setWhat] = useState<What>(null);
  const [whoQ, setWhoQ] = useState("");
  const [whatQ, setWhatQ] = useState("");
  const [whoOpen, setWhoOpen] = useState(false);
  const [whatOpen, setWhatOpen] = useState(false);

  const [focusEmp, setFocusEmp] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [ftypes, setFtypes] = useState<Record<string, boolean>>({});
  const [finalOnly, setFinalOnly] = useState(false);

  const [gradePrompt, setGradePrompt] = useState<GradePrompt>(null);
  const [gradeInput, setGradeInput] = useState("");

  /* selection */
  function selectWho(kind: "employee" | "cohort", id: string) {
    setWho({ kind, id });
    setWhoQ("");
    setWhoOpen(false);
    setFocusEmp(null);
    setExpanded({});
  }
  function selectWhat(kind: "cert" | "task", id: string) {
    setWhat({ kind, id });
    setWhatQ("");
    setWhatOpen(false);
    setFocusEmp(null);
    setExpanded({});
  }
  function clearWho() {
    setWho(null);
    setWhoQ("");
    setFocusEmp(null);
    setExpanded({});
  }
  function clearWhat() {
    setWhat(null);
    setWhatQ("");
    setFocusEmp(null);
    setExpanded({});
  }
  function setScope(w: NonNullable<Who>, x: NonNullable<What>) {
    setWho(w);
    setWhat(x);
    setWhoQ("");
    setWhatQ("");
    setWhoOpen(false);
    setWhatOpen(false);
    setFocusEmp(null);
    setExpanded({});
    setFtypes({});
    setFinalOnly(false);
  }

  /* focus / accordion */
  const focusName = (uid: string) => setFocusEmp(uid);
  const focusCell = (uid: string, tid: string) => {
    setFocusEmp(uid);
    setExpanded((e) => ({ ...e, [tid]: true }));
  };
  const clearFocus = () => setFocusEmp(null);
  const toggleExpand = (tid: string) =>
    setExpanded((e) => {
      const n = { ...e };
      if (n[tid]) delete n[tid];
      else n[tid] = true;
      return n;
    });

  /* mutations */
  const doGrant = (uid: string, tid: string) => setCells((c) => applyGrantAttempt(c, uid, tid));
  function requestMark(uid: string, tid: string) {
    const t = data.tasksById[tid];
    if (t && needsGradePrompt(t)) {
      setGradePrompt({ uid, tid, taskName: t.name, type: t.type });
      setGradeInput("");
    } else {
      setCells((c) => applyMarkComplete(c, uid, tid, null));
    }
  }
  function confirmGrade() {
    if (!gradePrompt) return;
    const raw = gradeInput.trim();
    const grade = raw === "" ? null : Number(raw);
    setCells((c) => applyMarkComplete(c, gradePrompt.uid, gradePrompt.tid, grade));
    setGradePrompt(null);
    setGradeInput("");
  }
  const markCert = (uid: string, cid: string) => setCertManual((m) => applyMarkCert(m, uid, cid));
  const undoCert = (uid: string, cid: string) => setCertManual((m) => applyClearCert(m, uid, cid));

  /* ───── unsaved-changes tracking (deferred save) ───── */
  const pendingCount = useMemo(() => {
    let n = 0;
    const cellKeys = new Set([...Object.keys(cells), ...Object.keys(savedCells)]);
    cellKeys.forEach((k) => {
      if (cells[k] !== savedCells[k]) n++;
    });
    const certKeys = new Set([...Object.keys(certManual), ...Object.keys(savedCerts)]);
    certKeys.forEach((k) => {
      if (certManual[k] !== savedCerts[k]) n++;
    });
    return n;
  }, [cells, certManual, savedCells, savedCerts]);
  const dirty = pendingCount > 0;

  const saveChanges = () => {
    setSavedCells(cells);
    setSavedCerts(certManual);
    setGradePrompt(null);
    setGradeInput("");
  };
  const discardChanges = () => {
    setCells(savedCells);
    setCertManual(savedCerts);
    setGradePrompt(null);
    setGradeInput("");
  };

  /* ───── derived scope ───── */
  const whoUser = who?.kind === "employee" ? data.employeesById[who.id] : null;
  const cohortId = who?.kind === "cohort" ? who.id : null;
  const certObj = what?.kind === "cert" ? data.certsById[what.id] : null;
  const taskObj = what?.kind === "task" ? data.tasksById[what.id] : null;

  const empScope = !!whoUser;
  const cohortScope = !!cohortId;
  const whatCert = !!certObj;
  const whatTask = !!taskObj;

  const hasScope = !!(who && what);
  const isLanding = !who && !what;
  const isHalf = !!who !== !!what;

  const activeEmpId = empScope ? who!.id : focusEmp;
  const split = cohortScope && !!focusEmp;

  /* cert task lists + filters */
  const ctAll: CertTask[] = certObj
    ? certObj.taskIds.map((id) => data.tasksById[id]).filter(Boolean)
    : [];
  const types: string[] = [];
  ctAll.forEach((t) => {
    if (!types.includes(t.type)) types.push(t.type);
  });
  const anyType = Object.keys(ftypes).some((k) => ftypes[k]);
  const ctF = ctAll.filter((t) => (!anyType || ftypes[t.type]) && (!finalOnly || t.isFinal));
  const filtersActive = anyType || finalOnly;

  const showMatrix = cohortScope && whatCert;
  const showRoster = cohortScope && whatTask;
  const showCertDetail = whatCert && !!activeEmpId;
  const showTaskDetail = whatTask && !!activeEmpId;
  const showPickHint = cohortScope && !focusEmp;

  const cohortMembers: Employee[] =
    cohortId != null
      ? (data.cohorts.find((c) => c.id === cohortId)?.userIds ?? []).map((id) => data.employeesById[id])
      : [];

  const detailWrapStyle: CSSProperties = split
    ? {
        width: 560,
        flex: "none",
        borderLeft: "1px solid #2c2e33",
        background: "#202125",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }
    : { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 };
  const detailContentStyle: CSSProperties = split
    ? { padding: "16px 18px" }
    : { padding: "20px 24px", maxWidth: 860, margin: "0 auto", width: "100%" };

  const focusUser = focusEmp ? data.employeesById[focusEmp] : null;

  /* ───── search matches ───── */
  const whoQl = whoQ.trim().toLowerCase();
  const cohortMatches = data.cohorts.filter((c) => !whoQl || c.name.toLowerCase().includes(whoQl));
  const peopleMatches = (
    whoQl
      ? data.employees.filter(
          (e) => e.name.toLowerCase().includes(whoQl) || e.contact.toLowerCase().includes(whoQl),
        )
      : data.employees
  ).slice(0, 8);

  const whatQl = whatQ.trim().toLowerCase();
  const certMatches = data.certifications.filter((c) => !whatQl || c.name.toLowerCase().includes(whatQl));
  const taskMatches = (whatQl ? data.tasks.filter((t) => t.name.toLowerCase().includes(whatQl)) : []).slice(0, 10);

  /* who/what chips */
  const whoChip = whoUser
    ? { badge: whoUser.initials, label: whoUser.name, radius: "50%" }
    : cohortId
    ? { badge: "⊞", label: cohortId, radius: "8px" }
    : null;

  /* examples (real entities) */
  const examples = [
    { who: "Diego Ramirez", what: "EPA 608 Type I", w: { kind: "employee", id: "U-10132" } as const, x: { kind: "cert", id: "C-0420" } as const },
    { who: "ARS Cooling & Heating", what: "HVAC Field Skills", w: { kind: "cohort", id: "ARS Cooling & Heating" } as const, x: { kind: "cert", id: "C-0398" } as const },
    { who: "Ayesha Khan", what: "Refrigerant Charging", w: { kind: "employee", id: "U-10157" } as const, x: { kind: "task", id: "T-2350" } as const },
  ].filter((ex) => {
    // Only show examples whose entities resolve in the built model.
    const wok = ex.w.kind === "cohort" ? data.cohorts.some((c) => c.id === ex.w.id) : !!data.employeesById[ex.w.id];
    const xok = ex.x.kind === "cert" ? !!data.certsById[ex.x.id] : !!data.tasksById[ex.x.id];
    return wok && xok;
  });

  /* half-state copy */
  const half =
    who && !what
      ? { title: "Now pick what to check", sub: "Search a certification or a single task above.", num: "2", bg: "#2f2516", color: AMBER }
      : { title: "Now pick who to check", sub: "Search an employee or a cohort above.", num: "1", bg: "#2a2b30", color: "#fff" };

  return (
    <div
      className="main"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "#0e0f11",
        color: "#f1f1ec",
        overflow: "hidden",
        fontFamily: "'Helvetica Neue', Helvetica, system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <style>{`@keyframes clAcc{from{opacity:.3;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}@keyframes clPane{from{opacity:.35;transform:translateX(14px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {/* ===== top search header ===== */}
      <header
        style={{
          flex: "none",
          background: "#1a1b1e",
          borderBottom: "1px solid #2c2e33",
          padding: "13px 24px",
          display: "flex",
          alignItems: "center",
          gap: 13,
        }}
      >
        <div style={{ flex: "none", marginRight: 4 }}>
          <div
            style={{
              fontSize: 9,
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: "#83858b",
            }}
          >
            SkillCat · Admin
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-.01em" }}>
            Certification Lookup
          </div>
        </div>

        {/* WHO */}
        <SearchField
          accent={whoUser || cohortId ? ACCENT : "#3b3e44"}
          chip={whoChip}
          chipColor="#fff"
          query={whoQ}
          placeholder="Search employee or cohort…"
          open={whoOpen}
          onInput={(v) => {
            setWhoQ(v);
            setWhoOpen(true);
          }}
          onFocus={() => setWhoOpen(true)}
          onBlur={() => setWhoOpen(false)}
          onClear={clearWho}
        >
          {(cohortMatches.length > 0 || peopleMatches.length > 0) ? (
            <>
              {cohortMatches.length > 0 && (
                <>
                  <DropLabel>Cohorts</DropLabel>
                  {cohortMatches.map((c) => (
                    <DropRow key={c.id} onSelect={() => selectWho("cohort", c.id)}>
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: "#2a2b30",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          flex: "none",
                        }}
                      >
                        ⊞
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                        <span style={{ display: "block", fontSize: 11, color: "#83858b" }}>
                          Cohort · {c.userIds.length} {c.userIds.length === 1 ? "employee" : "employees"}
                        </span>
                      </span>
                    </DropRow>
                  ))}
                </>
              )}
              {peopleMatches.length > 0 && (
                <>
                  <DropLabel>Employees</DropLabel>
                  {peopleMatches.map((e) => (
                    <DropRow key={e.id} onSelect={() => selectWho("employee", e.id)}>
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "#2c2e33",
                          color: "#bdbfc4",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 600,
                          flex: "none",
                        }}
                      >
                        {e.initials}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={ellipsis(13, 600)}>{e.name}</span>
                        <span style={ellipsis(11, 400, "#83858b")}>
                          {e.cohort ? `${e.cohort} · ${e.contact}` : e.contact}
                        </span>
                      </span>
                    </DropRow>
                  ))}
                </>
              )}
            </>
          ) : (
            <DropEmpty>No employees or cohorts match.</DropEmpty>
          )}
        </SearchField>

        <span style={{ color: "#54565c", flex: "none", fontSize: 15 }}>›</span>

        {/* WHAT */}
        <SearchField
          accent={certObj || taskObj ? ACCENT : "#3b3e44"}
          chip={
            certObj
              ? { node: <span style={{ fontSize: 12 }}>◆</span>, label: certObj.name }
              : taskObj
              ? { node: <TaskTypeIcon type={taskObj.type} size={14} />, label: taskObj.name }
              : null
          }
          chipColor={AMBER}
          query={whatQ}
          placeholder="Search certification or task…"
          open={whatOpen}
          onInput={(v) => {
            setWhatQ(v);
            setWhatOpen(true);
          }}
          onFocus={() => setWhatOpen(true)}
          onBlur={() => setWhatOpen(false)}
          onClear={clearWhat}
        >
          {certMatches.length > 0 || taskMatches.length > 0 ? (
            <>
              {certMatches.length > 0 && (
                <>
                  <DropLabel>Certifications</DropLabel>
                  {certMatches.map((c) => (
                    <DropRow key={c.id} onSelect={() => selectWhat("cert", c.id)} spread>
                      <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 7,
                            background: "#2f2516",
                            color: AMBER,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            flex: "none",
                          }}
                        >
                          ◆
                        </span>
                        <span style={ellipsis(13, 600)}>{c.name}</span>
                      </span>
                      <span style={{ fontSize: 11, color: "#83858b", flex: "none" }}>
                        {c.taskIds.length} tasks
                      </span>
                    </DropRow>
                  ))}
                </>
              )}
              {taskMatches.length > 0 && (
                <>
                  <DropLabel border>Tasks</DropLabel>
                  {taskMatches.map((t) => (
                    <DropRow key={t.id} onSelect={() => selectWhat("task", t.id)}>
                      <span style={{ display: "inline-flex", color: "#9a9ca1", flex: "none" }}>
                        <TaskTypeIcon type={t.type} size={14} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={ellipsis(13, 600)}>{t.name}</span>
                        <span style={ellipsis(11, 400, "#83858b")}>
                          {t.certName} · {t.type}
                        </span>
                      </span>
                    </DropRow>
                  ))}
                </>
              )}
            </>
          ) : (
            <DropEmpty>No certifications or tasks match.</DropEmpty>
          )}
        </SearchField>

        {/* legend */}
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 11,
            alignItems: "center",
            fontSize: 11.5,
            color: "#bdbfc4",
            flex: "none",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <LegendItem>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#1a1b1e", border: "1px solid #3b3e44" }} />
            Incomplete
          </LegendItem>
          <LegendItem>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#1a1b1e",
                border: `2px solid ${ACCENT}`,
                color: ACCENT,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 7,
              }}
            >
              •
            </span>
            In review
          </LegendItem>
          <LegendItem>
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#d8d6cd",
                color: "#15161a",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 7,
              }}
            >
              ✓
            </span>
            Complete
          </LegendItem>
        </div>
      </header>

      {/* ===== body ===== */}
      <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {isLanding && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <div style={{ textAlign: "center", maxWidth: 460 }}>
              <div
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 20,
                  border: "2px dashed #3b3e44",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: 27,
                  color: "#6b6d72",
                }}
              >
                ⌕
              </div>
              <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.015em", color: "#e7e6e2" }}>
                Find someone, then pick what to check
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#9a9ca1", marginTop: 9 }}>
                Search an <strong style={{ color: "#bdbfc4" }}>employee or a cohort</strong>, then a{" "}
                <strong style={{ color: "#bdbfc4" }}>certification or a single task</strong>. Pick a cohort to see
                everyone in a matrix and open any person beside it.
              </div>
              {examples.length > 0 && (
                <>
                  <div
                    style={{
                      marginTop: 22,
                      fontSize: 10.5,
                      textTransform: "uppercase",
                      letterSpacing: ".1em",
                      color: "#6b6d72",
                    }}
                  >
                    Jump to an example
                  </div>
                  <div style={{ marginTop: 11, display: "flex", gap: 9, justifyContent: "center", flexWrap: "wrap" }}>
                    {examples.map((ex, i) => (
                      <HoverButton
                        key={i}
                        onClick={() => setScope(ex.w, ex.x)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          border: "1px solid #3b3e44",
                          background: "#1a1b1e",
                          borderRadius: 10,
                          padding: "10px 13px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                        hoverStyle={{ borderColor: ACCENT, background: "#1f1a12" }}
                      >
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#f1f1ec" }}>{ex.who}</span>
                        <span style={{ color: "#54565c" }}>›</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: AMBER }}>{ex.what}</span>
                      </HoverButton>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {isHalf && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: half.bg,
                  color: half.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 19,
                  fontWeight: 700,
                  margin: "0 auto 14px",
                }}
              >
                {half.num}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#bdbfc4" }}>{half.title}</div>
              <div style={{ fontSize: 13, color: "#9a9ca1", marginTop: 6, lineHeight: 1.5 }}>{half.sub}</div>
            </div>
          </div>
        )}

        {hasScope && (
          <>
            {/* cert filter bar */}
            {certObj && (
              <div
                style={{
                  flex: "none",
                  background: "#141517",
                  borderBottom: "1px solid #23242a",
                  padding: "8px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    color: "#6b6d72",
                    flex: "none",
                    marginRight: 2,
                  }}
                >
                  Filter tasks
                </span>
                <span style={{ fontSize: 11, color: "#83858b", flex: "none" }}>Type</span>
                {types.map((ty) => {
                  const on = !!ftypes[ty];
                  return (
                    <button
                      key={ty}
                      onClick={() => setFtypes((f) => ({ ...f, [ty]: !f[ty] }))}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 11px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        border: `1px solid ${on ? ACCENT : "#2f3137"}`,
                        background: on ? "#271f12" : "#1a1b1e",
                        color: on ? AMBER : "#bdbfc4",
                      }}
                    >
                      {ty}
                    </button>
                  );
                })}
                <span style={{ width: 1, height: 18, background: "#2c2e33", flex: "none", margin: "0 3px" }} />
                <button
                  onClick={() => setFinalOnly((v) => !v)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                    color: finalOnly ? AMBER : "#bdbfc4",
                  }}
                >
                  <span
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: 34,
                      height: 18,
                      borderRadius: 20,
                      flex: "none",
                      transition: "background .15s",
                      background: finalOnly ? ACCENT : "#3b3e44",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: finalOnly ? 18 : 2,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left .15s",
                      }}
                    />
                  </span>
                  Final exam only
                </button>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#9a9ca1", flex: "none" }}>
                  {ctF.length === ctAll.length ? `${ctAll.length} tasks` : `${ctF.length} of ${ctAll.length} tasks`}
                </span>
                {filtersActive && (
                  <button
                    onClick={() => {
                      setFtypes({});
                      setFinalOnly(false);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#5b9cff",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      flex: "none",
                    }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
              {/* LEFT: matrix */}
              {showMatrix && (
                <Matrix
                  members={cohortMembers}
                  columns={ctF}
                  certId={certObj!.id}
                  allTasks={ctAll}
                  cells={cells}
                  certManual={certManual}
                  focusEmp={focusEmp}
                  expanded={expanded}
                  onOpenEmp={focusName}
                  onCell={focusCell}
                  onMarkCert={markCert}
                />
              )}

              {/* LEFT: roster */}
              {showRoster && (
                <Roster
                  members={cohortMembers}
                  task={taskObj!}
                  cells={cells}
                  compact={split}
                  focusEmp={focusEmp}
                  onOpen={focusName}
                  onGrant={doGrant}
                  onMark={requestMark}
                  onViewAttempts={onViewAttempts}
                />
              )}

              {/* pick hint */}
              {showPickHint && (
                <div
                  style={{
                    width: 300,
                    flex: "none",
                    borderLeft: "1px solid #2c2e33",
                    background: "#202125",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 26,
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 13,
                        border: "1.5px dashed #3b3e44",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 13px",
                        color: "#6b6d72",
                        fontSize: 20,
                      }}
                    >
                      ›
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#bdbfc4" }}>Open someone</div>
                    <div style={{ fontSize: 12, color: "#9a9ca1", marginTop: 5, lineHeight: 1.5 }}>
                      Click a name or a cell to see {showRoster ? "their task detail" : "their tasks"} on this side —
                      the {showRoster ? "list" : "matrix"} stays put.
                    </div>
                  </div>
                </div>
              )}

              {/* RIGHT: employee + cert (accordion) */}
              {showCertDetail && (
                <div style={detailWrapStyle}>
                  {split && focusUser && (
                    <FocusHeader user={focusUser} onClose={clearFocus} />
                  )}
                  <div style={{ flex: 1, overflow: "auto", minHeight: 0, animation: "clPane .18s ease" }}>
                    <div style={detailContentStyle}>
                      <CertDetail
                        uid={activeEmpId!}
                        certId={certObj!.id}
                        allTasks={ctAll}
                        filteredTasks={ctF}
                        cells={cells}
                        certManual={certManual}
                        expanded={expanded}
                        onToggle={toggleExpand}
                        onMark={requestMark}
                        onGrant={doGrant}
                        onMarkCert={markCert}
                        onUndoCert={undoCert}
                        onViewAttempts={onViewAttempts}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* RIGHT: employee + task */}
              {showTaskDetail && (
                <div style={detailWrapStyle}>
                  {split && focusUser && <FocusHeader user={focusUser} onClose={clearFocus} />}
                  <div style={{ flex: 1, overflow: "auto", minHeight: 0, animation: "clPane .18s ease" }}>
                    <div style={detailContentStyle}>
                      <TaskDetail
                        uid={activeEmpId!}
                        task={taskObj!}
                        cells={cells}
                        onGrant={doGrant}
                        onMark={requestMark}
                        onViewAttempts={onViewAttempts}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ===== unsaved-changes footer (deferred save, like the wizards) ===== */}
      {dirty && (
        <footer
          style={{
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 18,
            minHeight: 64,
            padding: "12px 24px",
            background: "#1a1b1e",
            borderTop: "1px solid #2c2e33",
            boxShadow: "0 -8px 24px rgba(0,0,0,.28)",
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <span
              style={{
                flex: "none",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: AMBER,
                boxShadow: `0 0 0 3px ${AMBER}22`,
              }}
            />
            <span style={{ fontSize: 13, color: "#f1f1ec" }}>
              <strong style={{ fontWeight: 700 }}>
                {pendingCount} unsaved {pendingCount === 1 ? "change" : "changes"}
              </strong>
              <span style={{ color: "#9a9ca1" }}> — not applied yet</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
            <button
              onClick={discardChanges}
              style={{
                padding: "9px 16px",
                border: "1px solid #3b3e44",
                borderRadius: 8,
                background: "transparent",
                color: "#bdbfc4",
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Discard
            </button>
            <button
              onClick={saveChanges}
              style={{
                padding: "9px 20px",
                border: "none",
                borderRadius: 8,
                background: ACCENT,
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Save changes
            </button>
          </div>
        </footer>
      )}

      {/* grade prompt */}
      {gradePrompt && (
        <div
          onClick={() => {
            setGradePrompt(null);
            setGradeInput("");
          }}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(28,28,25,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 360,
              maxWidth: "100%",
              background: "#1a1b1e",
              borderRadius: 12,
              boxShadow: "0 24px 60px rgba(0,0,0,.32)",
              padding: 24,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#83858b" }}>
              Mark complete · {gradePrompt.type}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{gradePrompt.taskName}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "#9a9ca1", marginTop: 9 }}>
              Enter a grade, or leave blank to mark complete without one.
            </div>
            <div
              style={{
                marginTop: 15,
                display: "flex",
                alignItems: "center",
                gap: 9,
                border: "1px solid #3b3e44",
                borderRadius: 8,
                padding: "10px 13px",
              }}
            >
              <input
                type="number"
                min={0}
                max={100}
                autoFocus
                value={gradeInput}
                onChange={(e) => setGradeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmGrade();
                }}
                placeholder="Optional"
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  fontSize: 14,
                  fontFamily: "inherit",
                  width: "100%",
                  color: "#f1f1ec",
                }}
              />
              <span style={{ fontSize: 12, color: "#83858b", flex: "none" }}>/ 100</span>
            </div>
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => {
                  setGradePrompt(null);
                  setGradeInput("");
                }}
                style={{
                  padding: "9px 16px",
                  border: "1px solid #3b3e44",
                  borderRadius: 7,
                  background: "#1a1b1e",
                  color: "#bdbfc4",
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmGrade}
                style={{
                  padding: "9px 18px",
                  border: "none",
                  borderRadius: 7,
                  background: ACCENT,
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Mark complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── header search field ─────────────────────────── */

function SearchField({
  accent,
  chip,
  chipColor,
  query,
  placeholder,
  open,
  onInput,
  onFocus,
  onBlur,
  onClear,
  children,
}: {
  accent: string;
  chip: { badge?: string; node?: ReactNode; label: string; radius?: string } | null;
  chipColor: string;
  query: string;
  placeholder: string;
  open: boolean;
  onInput: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: 360 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          border: `1.5px solid ${accent}`,
          borderRadius: 10,
          padding: "9px 12px",
          background: "#202125",
        }}
      >
        <span style={{ color: "#83858b", fontSize: 14, flex: "none" }}>⌕</span>
        {chip ? (
          <>
            {chip.badge !== undefined ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: chip.radius ?? "50%",
                  background: "#2a2b30",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  flex: "none",
                }}
              >
                {chip.badge}
              </span>
            ) : (
              <span style={{ display: "inline-flex", color: chipColor, flex: "none" }}>{chip.node}</span>
            )}
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13.5,
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: chip.node ? chipColor : "#f1f1ec",
              }}
            >
              {chip.label}
            </span>
            <button
              onClick={onClear}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#83858b",
                fontSize: 13,
                fontFamily: "inherit",
                flex: "none",
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <input
            value={query}
            onChange={(e) => onInput(e.target.value)}
            onFocus={onFocus}
            onBlur={() => window.setTimeout(onBlur, 160)}
            placeholder={placeholder}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: 13.5,
              fontFamily: "inherit",
              width: "100%",
              color: "#f1f1ec",
            }}
          />
        )}
      </div>
      {open && !chip && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#1a1b1e",
            border: "1px solid #3b3e44",
            borderRadius: 11,
            boxShadow: "0 16px 38px rgba(0,0,0,.16)",
            zIndex: 40,
            padding: 6,
            maxHeight: 380,
            overflow: "auto",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropLabel({ children, border }: { children: ReactNode; border?: boolean }) {
  return (
    <div
      style={{
        padding: "7px 10px 4px",
        fontSize: 9.5,
        textTransform: "uppercase",
        letterSpacing: ".1em",
        color: "#6b6d72",
        borderTop: border ? "1px solid #24262b" : undefined,
        marginTop: border ? 3 : undefined,
      }}
    >
      {children}
    </div>
  );
}

function DropRow({
  children,
  onSelect,
  spread,
}: {
  children: ReactNode;
  onSelect: () => void;
  spread?: boolean;
}) {
  return (
    <HoverButton
      onMouseDown={onSelect}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        justifyContent: spread ? "space-between" : undefined,
        gap: spread ? 10 : 11,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        padding: spread ? 10 : "9px 10px",
        borderRadius: 8,
      }}
      hoverStyle={{ background: "#26282d" }}
    >
      {children}
    </HoverButton>
  );
}

function DropEmpty({ children }: { children: ReactNode }) {
  return <div style={{ padding: 14, fontSize: 12, color: "#83858b", textAlign: "center" }}>{children}</div>;
}

function LegendItem({ children }: { children: ReactNode }) {
  return <span style={{ display: "flex", gap: 6, alignItems: "center" }}>{children}</span>;
}

function FocusHeader({ user, onClose }: { user: Employee; onClose: () => void }) {
  return (
    <div
      style={{
        flex: "none",
        padding: "13px 18px",
        borderBottom: "1px solid #2c2e33",
        background: "#1a1b1e",
        display: "flex",
        alignItems: "center",
        gap: 11,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#2c2e33",
          color: "#bdbfc4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 600,
          flex: "none",
        }}
      >
        {user.initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={ellipsis(14, 700)}>{user.name}</div>
        <div style={{ fontSize: 11.5, color: "#9a9ca1" }}>
          {(user.cohort ? user.cohort + " · " : "") + user.contact}
        </div>
      </div>
      <button
        onClick={onClose}
        title="Back to cohort"
        style={{
          border: "none",
          background: "#26282d",
          borderRadius: "50%",
          width: 28,
          height: 28,
          cursor: "pointer",
          color: "#bdbfc4",
          fontSize: 13,
          flex: "none",
        }}
      >
        ✕
      </button>
    </div>
  );
}

/* ─────────────────────────────── matrix ────────────────────────────────── */

function Matrix({
  members,
  columns,
  certId,
  allTasks,
  cells,
  certManual,
  focusEmp,
  expanded,
  onOpenEmp,
  onCell,
  onMarkCert,
}: {
  members: Employee[];
  columns: CertTask[];
  certId: string;
  allTasks: CertTask[];
  cells: CellMap;
  certManual: CertManual;
  focusEmp: string | null;
  expanded: Record<string, boolean>;
  onOpenEmp: (uid: string) => void;
  onCell: (uid: string, tid: string) => void;
  onMarkCert: (uid: string, cid: string) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, overflow: "auto", minHeight: 0, background: "#1a1b1e" }}>
      <div style={{ width: "max-content", minWidth: "100%" }}>
        {/* header */}
        <div
          style={{
            display: "flex",
            position: "sticky",
            top: 0,
            zIndex: 5,
            background: "#1a1b1e",
            borderBottom: "1px solid #3b3e44",
          }}
        >
          <div
            style={{
              width: 206,
              flex: "none",
              position: "sticky",
              left: 0,
              zIndex: 6,
              background: "#202125",
              borderRight: "1px solid #3b3e44",
              padding: "10px 13px",
              display: "flex",
              alignItems: "flex-end",
              height: 128,
            }}
          >
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "#9a9ca1" }}>
              Employee · {members.length}
            </span>
          </div>
          {columns.map((t) => (
            <div
              key={t.id}
              title={t.name}
              style={{
                width: 44,
                flex: "none",
                borderRight: "1px solid #23242a",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "9px 0",
                height: 128,
                background: t.isFinal ? "#202125" : undefined,
                borderTop: `3px solid ${t.isFinal ? ACCENT : "#2c2e33"}`,
              }}
            >
              <span style={{ marginBottom: 7, display: "inline-flex" }}>
                <TaskTypeIcon type={t.type} size={13} />
              </span>
              <div
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  fontWeight: t.isFinal ? 700 : 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxHeight: 86,
                  color: t.isFinal ? AMBER : "#e7e6e2",
                }}
              >
                {t.name}
              </div>
            </div>
          ))}
          <div
            style={{
              width: 138,
              flex: "none",
              background: "#202125",
              borderLeft: "1px solid #3b3e44",
              padding: "10px 12px",
              display: "flex",
              alignItems: "flex-end",
              height: 128,
            }}
          >
            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "#9a9ca1" }}>
              Certification
            </span>
          </div>
        </div>

        {/* rows */}
        {members.map((u) => {
          const ps = progress(cells, certManual, u.id, allTasks, certId);
          const isFocus = focusEmp === u.id;
          return (
            <div
              key={u.id}
              style={{
                display: "flex",
                borderBottom: "1px solid #23242a",
                background: isFocus ? "rgba(236,94,44,0.10)" : undefined,
              }}
            >
              <HoverDiv
                onClick={() => onOpenEmp(u.id)}
                title={`Open all tasks for ${u.name}`}
                style={{
                  width: 206,
                  flex: "none",
                  position: "sticky",
                  left: 0,
                  zIndex: 2,
                  background: isFocus ? "#2c1d10" : "#1a1b1e",
                  borderRight: "1px solid #3b3e44",
                  padding: "8px 13px",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  cursor: "pointer",
                  boxShadow: isFocus ? `inset 4px 0 0 ${ACCENT}` : undefined,
                }}
                hoverStyle={{ background: "#26282d" }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#2c2e33",
                    color: "#bdbfc4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10.5,
                    fontWeight: 600,
                    flex: "none",
                  }}
                >
                  {u.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={ellipsis(12, 600)}>{u.name}</div>
                  <div style={{ fontSize: 10, color: "#83858b" }}>{ps.pct}%</div>
                </div>
              </HoverDiv>
              {columns.map((t) => {
                const cl = cells[u.id + "_" + t.id];
                const cellFocus = isFocus && expanded[t.id];
                return (
                  <HoverDiv
                    key={t.id}
                    title={`${u.name} · ${t.name} — ${statusVisual(cl.status, ACCENT, cl.manual).label}${
                      cl.grade ? " · " + cl.grade + "/100" : ""
                    }`}
                    onClick={() => onCell(u.id, t.id)}
                    style={{
                      width: 44,
                      height: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRight: "1px solid #23242a",
                      cursor: "pointer",
                      background: cellFocus
                        ? "rgba(236,94,44,0.22)"
                        : t.isFinal
                        ? "#202125"
                        : undefined,
                    }}
                    hoverStyle={{ boxShadow: "inset 0 0 0 2px #54565c" }}
                  >
                    <StatusDot status={cl.status} manual={cl.manual} size={18} />
                  </HoverDiv>
                );
              })}
              <div
                style={{
                  width: 138,
                  flex: "none",
                  borderLeft: "1px solid #23242a",
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                {ps.certified ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: "#d8d6cd",
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, flex: "none" }} />
                    {ps.certManual ? "Manual" : "Certified"}
                  </span>
                ) : (
                  <HoverButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkCert(u.id, certId);
                    }}
                    style={{
                      padding: "6px 9px",
                      border: "1px solid #3b3e44",
                      borderRadius: 7,
                      background: "#1a1b1e",
                      color: "#bdbfc4",
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                    hoverStyle={{ borderColor: "#d8d6cd", color: "#f1f1ec" }}
                  >
                    Mark cert
                  </HoverButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────── roster ────────────────────────────────── */

function Roster({
  members,
  task,
  cells,
  compact,
  focusEmp,
  onOpen,
  onGrant,
  onMark,
  onViewAttempts,
}: {
  members: Employee[];
  task: CertTask;
  cells: CellMap;
  compact: boolean;
  focusEmp: string | null;
  onOpen: (uid: string) => void;
  onGrant: (uid: string, tid: string) => void;
  onMark: (uid: string, tid: string) => void;
  onViewAttempts: (uid: string, tid: string) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, overflow: "auto", minHeight: 0, padding: "18px 22px" }}>
      <div style={{ background: "#1a1b1e", border: "1px solid #2f3137", borderRadius: 13, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            padding: "10px 16px",
            borderBottom: "1px solid #2c2e33",
            background: "#1d1e22",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            color: "#83858b",
          }}
        >
          <span style={{ flex: 1 }}>Employee · {members.length}</span>
          <span style={compact ? { flex: "none" } : { width: 150, flex: "none" }}>Task status</span>
          {!compact && <span style={{ width: 317, flex: "none", textAlign: "right" }}>Attempts left · Action</span>}
        </div>
        {members.map((u) => {
          const cl = cells[u.id + "_" + task.id];
          const v = statusVisual(cl.status, ACCENT, cl.manual);
          const ai = attemptInfo(task, cl);
          const isFocus = focusEmp === u.id;
          return (
            <HoverDiv
              key={u.id}
              onClick={() => onOpen(u.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 13,
                padding: "11px 16px",
                borderBottom: "1px solid #23242a",
                cursor: "pointer",
                background: isFocus ? "#241a0e" : undefined,
                boxShadow: isFocus ? `inset 3px 0 0 ${ACCENT}` : undefined,
              }}
              hoverStyle={{ background: "#202125" }}
            >
              <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 11 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#2c2e33",
                    color: "#bdbfc4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                    flex: "none",
                  }}
                >
                  {u.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={ellipsis(13, 600)}>{u.name}</div>
                  {!compact && <div style={ellipsis(10.5, 400, "#83858b")}>{u.contact}</div>}
                </div>
              </div>
              <div
                style={
                  compact
                    ? { flex: "none", display: "flex", alignItems: "center" }
                    : { width: 150, flex: "none", display: "flex", alignItems: "center", gap: 8 }
                }
              >
                <StatusDot status={cl.status} manual={cl.manual} size={16} />
                {!compact && (
                  <span style={ellipsis(11.5, 400, "#bdbfc4")}>
                    {v.label}
                    {cl.grade ? " · " + cl.grade : ""}
                  </span>
                )}
              </div>
              {!compact ? (
                <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 9 }}>
                  <span
                    style={{
                      width: 84,
                      flex: "none",
                      textAlign: "right",
                      fontSize: 10.5,
                      color: "#9a9ca1",
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1.2,
                    }}
                  >
                    {ai.hasLimit ? `${ai.remaining} of ${ai.totalAllowed} left` : ""}
                  </span>
                  <div style={{ width: 30, flex: "none", display: "flex", justifyContent: "flex-start" }}>
                    {ai.hasLimit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewAttempts(u.id, task.id);
                        }}
                        title="View attempts"
                        style={{
                          width: 30,
                          height: 30,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "1px solid #3b3e44",
                          borderRadius: 8,
                          background: "#1a1b1e",
                          color: "#bdbfc4",
                          fontSize: 13,
                          fontFamily: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        ↗
                      </button>
                    )}
                  </div>
                  <div style={{ width: 90, flex: "none", display: "flex", justifyContent: "flex-start" }}>
                    {ai.hasLimit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGrant(u.id, task.id);
                        }}
                        title="Grant another attempt"
                        style={{
                          padding: "7px 11px",
                          border: `1.5px solid ${ACCENT}`,
                          borderRadius: 8,
                          background: "#271f12",
                          color: AMBER,
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        + Grant
                      </button>
                    )}
                  </div>
                  <div style={{ width: 76, flex: "none", display: "flex", justifyContent: "flex-start" }}>
                    {cl.status !== "complete" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMark(u.id, task.id);
                        }}
                        style={{
                          padding: "7px 12px",
                          border: `1px solid ${ACCENT}`,
                          borderRadius: 8,
                          background: "#1a1b1e",
                          color: "#f1f1ec",
                          fontSize: 11,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ✓ Mark
                      </button>
                    )}
                  </div>
                  <span style={{ color: "#54565c", fontSize: 15, flex: "none" }}>›</span>
                </div>
              ) : (
                <span style={{ color: "#54565c", fontSize: 15, flex: "none" }}>›</span>
              )}
            </HoverDiv>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────── employee + cert (accordion) ──────────────────────── */

function CertDetail({
  uid,
  certId,
  allTasks,
  filteredTasks,
  cells,
  certManual,
  expanded,
  onToggle,
  onMark,
  onGrant,
  onMarkCert,
  onUndoCert,
  onViewAttempts,
}: {
  uid: string;
  certId: string;
  allTasks: CertTask[];
  filteredTasks: CertTask[];
  cells: CellMap;
  certManual: CertManual;
  expanded: Record<string, boolean>;
  onToggle: (tid: string) => void;
  onMark: (uid: string, tid: string) => void;
  onGrant: (uid: string, tid: string) => void;
  onMarkCert: (uid: string, cid: string) => void;
  onUndoCert: (uid: string, cid: string) => void;
  onViewAttempts: (uid: string, tid: string) => void;
}) {
  const ps = progress(cells, certManual, uid, allTasks, certId);
  const remain = ps.rv + ps.inc;
  return (
    <>
      {ps.certified ? (
        <div
          style={{
            background: "#2a2b30",
            color: "#fff",
            borderRadius: 12,
            padding: "13px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 13,
          }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#1a1b1e",
              color: "#f1f1ec",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              flex: "none",
            }}
          >
            ✓
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>
              {ps.certManual ? "Certification marked complete by admin" : "Certification complete"}
            </div>
            <div style={{ fontSize: 11.5, color: "#9a9ca1" }}>
              {(ps.certManual ? "Manually certified " : "Certified ") + (ps.certAt ? fmtDT(ps.certAt) : "—")}
            </div>
          </div>
          {ps.certManual && (
            <button
              onClick={() => onUndoCert(uid, certId)}
              style={{
                flex: "none",
                padding: "8px 12px",
                border: "1px solid #55534a",
                borderRadius: 8,
                background: "transparent",
                color: "#e6e4da",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Undo
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            background: "#1a1b1e",
            border: "1px solid #2c2e33",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 13,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: "#bdbfc4" }}>
            {remain} task{remain === 1 ? "" : "s"} still open before certified.
          </span>
          <button
            onClick={() => onMarkCert(uid, certId)}
            style={{
              marginLeft: "auto",
              flex: "none",
              padding: "9px 14px",
              border: "none",
              borderRadius: 9,
              background: ACCENT,
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            ✓ Mark certification complete
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {filteredTasks.map((t) => (
          <AccordionCard
            key={t.id}
            uid={uid}
            task={t}
            cells={cells}
            expanded={!!expanded[t.id]}
            onToggle={() => onToggle(t.id)}
            onMark={() => onMark(uid, t.id)}
            onGrant={() => onGrant(uid, t.id)}
            onViewAttempts={() => onViewAttempts(uid, t.id)}
          />
        ))}
      </div>
    </>
  );
}

function AccordionCard({
  uid,
  task,
  cells,
  expanded,
  onToggle,
  onMark,
  onGrant,
  onViewAttempts,
}: {
  uid: string;
  task: CertTask;
  cells: CellMap;
  expanded: boolean;
  onToggle: () => void;
  onMark: () => void;
  onGrant: () => void;
  onViewAttempts: () => void;
}) {
  const cl = cells[uid + "_" + task.id];
  const manual = cl.status === "complete" && cl.manual;
  const v = statusVisual(cl.status, ACCENT, manual);
  const detail = expanded ? buildDetail(cells, uid, task) : null;

  const metaBits: string[] = [v.label];
  if (cl.status === "complete" && cl.grade) metaBits.push("grade " + cl.grade + "/100");
  if (cl.completedAt) metaBits.push(fmtD(cl.completedAt));

  return (
    <div
      style={{
        background: "#1a1b1e",
        border: `1px solid ${expanded ? "#54565c" : task.isFinal ? "#4a3a1f" : "#2f3137"}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: expanded ? "0 4px 14px rgba(0,0,0,.06)" : undefined,
      }}
    >
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 15px", cursor: "pointer" }}>
        <StatusDot status={cl.status} manual={manual} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", color: "#83858b", flex: "none" }}>
              <TaskTypeIcon type={task.type} size={14} />
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: task.isFinal ? 700 : 600,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: task.isFinal ? AMBER : undefined,
              }}
            >
              {task.name}
            </span>
            {task.isFinal && <Pill>Final</Pill>}
            {manual && <Pill>Manual</Pill>}
          </div>
          <div style={{ fontSize: 12, color: "#9a9ca1", marginTop: 3 }}>{metaBits.join(" · ")}</div>
        </div>
        <span style={{ color: "#6b6d72", fontSize: 13, flex: "none" }}>{expanded ? "⌃" : "⌄"}</span>
      </div>
      {expanded && detail && (
        <div style={{ borderTop: "1px solid #24262b", padding: 15, animation: "clAcc .16s ease" }}>
          <MetricsGrid d={detail} />
          {detail.isQuizLimited && (
            <QuizAttemptBox d={detail} onGrant={onGrant} onViewAttempts={onViewAttempts} />
          )}
          <div
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: ".12em",
              color: "#9a9ca1",
              marginBottom: 12,
            }}
          >
            Status timeline
          </div>
          <Timeline events={detail.timeline} />
          {cl.status !== "complete" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMark();
              }}
              style={{
                marginTop: 8,
                width: "100%",
                padding: 12,
                border: "none",
                borderRadius: 9,
                background: ACCENT,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              ✓ Mark complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── employee + task ─────────────────────────────── */

function TaskDetail({
  uid,
  task,
  cells,
  onGrant,
  onMark,
  onViewAttempts,
}: {
  uid: string;
  task: CertTask;
  cells: CellMap;
  onGrant: (uid: string, tid: string) => void;
  onMark: (uid: string, tid: string) => void;
  onViewAttempts: (uid: string, tid: string) => void;
}) {
  const cl = cells[uid + "_" + task.id];
  const manual = cl.status === "complete" && cl.manual;
  const v = statusVisual(cl.status, ACCENT, manual);
  const detail = buildDetail(cells, uid, task);

  return (
    <div style={{ background: "#1a1b1e", border: "1px solid #2f3137", borderRadius: 15, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #24262b" }}>
        <StatusDot status={cl.status} manual={manual} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ display: "inline-flex", color: "#83858b", flex: "none" }}>
              <TaskTypeIcon type={task.type} size={16} />
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-.01em" }}>{task.name}</span>
            {task.isFinal && <Pill big>Final</Pill>}
          </div>
          <div style={{ fontSize: 12.5, color: "#9a9ca1", marginTop: 3 }}>
            {task.certName} · {task.type}
          </div>
        </div>
        <span
          style={{
            flex: "none",
            fontSize: 11.5,
            fontWeight: 600,
            padding: "6px 13px",
            borderRadius: 20,
            background: v.badgeBg,
            color: v.badgeColor,
          }}
        >
          {v.label}
        </span>
      </div>
      <div style={{ padding: "18px 20px" }}>
        <MetricsGrid d={detail} />
        {detail.isQuizLimited && (
          <QuizAttemptBox
            d={detail}
            onGrant={() => onGrant(uid, task.id)}
            onViewAttempts={() => onViewAttempts(uid, task.id)}
          />
        )}
        <div
          style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".12em", color: "#9a9ca1", marginBottom: 13 }}
        >
          Status timeline
        </div>
        <Timeline events={detail.timeline} />
      </div>
      {cl.status !== "complete" ? (
        <div
          style={{
            padding: "15px 20px",
            borderTop: "1px solid #2c2e33",
            background: "#202125",
            display: "flex",
            alignItems: "center",
            gap: 11,
          }}
        >
          <button
            onClick={() => onMark(uid, task.id)}
            style={{
              padding: "12px 18px",
              border: "none",
              borderRadius: 9,
              background: ACCENT,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            ✓ Mark complete
          </button>
          <span style={{ fontSize: 12, color: "#9a9ca1", lineHeight: 1.4 }}>{detail.footerNote}</span>
        </div>
      ) : (
        <div style={{ padding: "14px 20px", borderTop: "1px solid #2c2e33", background: "#202125", fontSize: 12, color: "#9a9ca1" }}>
          {detail.footerNote}
        </div>
      )}
    </div>
  );
}

function Pill({ children, big }: { children: ReactNode; big?: boolean }) {
  return (
    <span
      style={{
        flex: "none",
        fontSize: big ? 9 : 8.5,
        fontWeight: 700,
        letterSpacing: ".05em",
        textTransform: "uppercase",
        color: AMBER,
        background: "#2f2516",
        border: "1px solid #4a3a1f",
        borderRadius: 20,
        padding: big ? "1px 7px" : "1px 6px",
      }}
    >
      {children}
    </span>
  );
}

/* helper: ellipsis text block */
function ellipsis(size: number, weight: number, color?: string): CSSProperties {
  return {
    display: "block",
    fontSize: size,
    fontWeight: weight,
    color,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}
