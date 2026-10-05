import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  skills as seedSkills,
  masterySkills as seedMastery,
  masteryUsing,
  taskById,
  fmtHolders,
  SKILL_STATUSES,
  type Skill,
  type MasterySkill,
} from "../data/skills";
import { topIndustry } from "../data/certifications";
import { skillTaskNames, skillCertifications, skillIndustryPaths, skillIndustries, INDUSTRY_OPTIONS, matchesIndustry } from "../data/skillGraph";
import { Dropdown } from "./Dropdown";
import { FILTER_TIPS } from "../data/filterTips";
import {
  PillTrigger,
  summarize,
  SectionedMultiSelect,
  CascadingMultiSelect,
  EditColumnsButton,
  useColumnOrder,
  orderedColumns,
  type ColumnDef,
} from "./Filters";
import { EntitySearch, type SearchScope } from "./UsersSearch";
import { MultiPill } from "./UsersFilters";
import { NewSkillWizard } from "./NewSkillWizard";
import { PrmModal } from "./PrmModal";
import { SortIcon, AddIcon, RowEditIcon, RowKebabIcon, MenuArchiveOffIcon, RowDeleteIcon, InfoIcon14, PagePrevIcon, PageNextIcon } from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";
import { PreviewPanel } from "./PreviewPanel";
import { ConfirmCard } from "./ConfirmCard";
import { TableCols } from "./TableCols";
import { useToast } from "./useToast";

const PAGE_SIZE = 50;

type SortDir = "asc" | "desc";

type Mode =
  | { kind: "list" }
  /* Creating is one mode for both records — `type` only says which way the
     create page's Type control starts out. */
  | { kind: "new"; type: "skill" | "mastery" }
  | { kind: "edit-skill"; skill: Skill }
  | { kind: "edit-mastery"; mastery: MasterySkill };

type Modal =
  | { kind: "none" }
  /* Archive always confirms (the user's rule: Archive and Delete both get the
     Modal); `linked` adds the unearnable-Mastery-Skills warning when set. */
  | { kind: "archive-skill"; skill: Skill }
  | { kind: "archive-mastery"; mastery: MasterySkill }
  | { kind: "delete-skill"; skill: Skill }
  | { kind: "delete-mastery"; mastery: MasterySkill };

/* The Type filter — a Filters-row pill AND a suggested filter in the search
   bar, sharing one value set. Both (or neither) = every record. */
const TYPES = ["Skill", "Mastery Skill"] as const;

type ColKey = "type" | "industry" | "linkedSkills" | "linkedMastery" | "tasks" | "certifications" | "dateModified" | "status" | "dateCreated";

/* What each filter pill does, shown on hover (the shared `title` tooltip)
   started here and is now the app-wide convention; the lines themselves live in
   `data/filterTips.ts` with every other page's. */
const TIPS = FILTER_TIPS.skills;

/* ─────────────── Records ───────────────
   One plain table, the Tasks shape: a Skill and a Mastery Skill are both
   ordinary rows, told apart by the Type column. A Mastery Skill has no Tasks
   of its own; its Certifications and Industries (and the pill filters) reach
   it through its Skills. */
type Rec =
  /** `linkedMastery`: the Mastery Skills this Skill rolls up into. */
  | { kind: "skill"; skill: Skill; members: Skill[]; linkedMastery: MasterySkill[] }
  | { kind: "mastery"; mastery: MasterySkill; members: Skill[] };

function recOf(r: Rec): Skill | MasterySkill {
  return r.kind === "skill" ? r.skill : r.mastery;
}
function recKey(r: Rec): string {
  return `${r.kind}:${recOf(r).id}`;
}
/** The Skills a record's Certifications/Industries come through — itself, or
    a Mastery Skill's constituents. */
function recCerts(r: Rec): string[] {
  return [...new Set(r.members.flatMap(skillCertifications))];
}
function recIndustries(r: Rec): string[] {
  return [...new Set(r.members.flatMap(skillIndustries))];
}

/* One entry per optional column drives the Edit Columns menu, the colgroup,
   the header and both row kinds. The menu reorders THIS list, so the table
   has to render from it rather than from a hand-written sequence of
   `cols.x && <td>`. Listed in default display order. */
type Col = ColumnDef<ColKey> & {
  className: string;
  width: number;
  /** Count/label columns with no meaningful order opt out. */
  sortable?: boolean;
  /** Hover text for the cell — the FULL list behind a truncated "+N", one per
      line, as Tasks and Certifications do. */
  tip?: (r: Rec) => string | undefined;
  /** SemiBold label line above that text (`data-tip-head`). */
  tipHead?: (r: Rec) => string | undefined;
  render: (r: Rec) => React.ReactNode;
};

const recTasks = (r: Rec) => (r.kind === "skill" ? r.skill.taskIds.map((id) => taskById(id)?.name ?? id) : []);

const recLinkedMastery = (r: Rec) => (r.kind === "skill" ? r.linkedMastery.map((m) => m.name) : []);
const recLinkedSkills = (r: Rec) => (r.kind === "mastery" ? r.members.map((s) => s.name) : []);

/* Widths follow what each default column actually holds (2026-10-01): the
   Type pill tops out ~101px, Industries is top-level only ("HVAC +1"), Linked
   Tasks carries the longest names. Slack on a wide screen spreads in the same
   proportions, so the gaps stay even. */
const COLS: Col[] = [
  /* Type wears the status-pill chrome (109:1237): secondary grey for a Skill,
     yellow for a Mastery Skill. `col-status` is what re-enables pill chrome
     past the plain-text strip rule. */
  {
    key: "type", label: "Type", className: "col-type col-status", width: 130,
    /* An archived record of either kind drops to Table Pills - Grey (83:512). */
    render: (r) => {
      const tone = recOf(r).status === "Archived" ? "grey" : r.kind === "skill" ? "secondary" : "yellow";
      return <span className={`co-status-pill co-status-pill--${tone}`}>{r.kind === "skill" ? "Skill" : "Mastery Skill"}</span>;
    },
  },
  {
    key: "industry", label: "Industries", className: "col-used", width: 140, sortable: false,
    tip: (r) => listTip(recIndustries(r)),
    render: (r) => <NamesCell names={recIndustries(r)} />,
  },
  {
    key: "tasks", label: "Linked Tasks", className: "col-used", width: 280, sortable: false,
    tip: (r) => listTip(recTasks(r)),
    /* More than one linked Task means completing any of them awards the Skill,
       so the list needs saying so before it reads as "all of these". */
    tipHead: (r) => (recTasks(r).length > 1 ? "Any of" : undefined),
    render: (r) => <NamesCell names={recTasks(r)} />,
  },
  {
    key: "certifications", label: "Linked Certifications", className: "col-used", width: 200, sortable: false,
    tip: (r) => listTip(recCerts(r)),
    render: (r) => <NamesCell names={recCerts(r)} />,
  },
  /* Optional — off by default, switched on from Edit Columns. */
  /* The two relationship columns each belong to one record type — a Skill
     rolls up into Mastery Skills, a Mastery Skill is made of Skills — so the
     other type's row reads "—". */
  {
    key: "linkedSkills", label: "Linked Skills", className: "col-used", width: 200, sortable: false,
    tip: (r) => listTip(recLinkedSkills(r)),
    render: (r) => <NamesCell names={recLinkedSkills(r)} />,
  },
  {
    key: "linkedMastery", label: "Linked Mastery Skills", className: "col-used", width: 200, sortable: false,
    tip: (r) => listTip(recLinkedMastery(r)),
    render: (r) => <NamesCell names={recLinkedMastery(r)} />,
  },
  { key: "dateModified", label: "Date Modified", className: "col-date", width: 150, render: (r) => recOf(r).dateModified },
  { key: "status", label: "Status", className: "col-type", width: 110, render: (r) => <StatusBadge status={recOf(r).status} /> },
  { key: "dateCreated", label: "Date Created", className: "col-date", width: 150, render: (r) => recOf(r).dateCreated },
];

const FIXED = [{ label: "Name" }];

/* 340 — the row atoms draw 400; the user settled on 340 after seeing it. */
const NAME_W = 340;
const ACTIONS_W = 40;

/** A Mastery Skill's constituent Skills, in its own declared order. */
function masterySkillsOf(m: MasterySkill, all: Skill[]): Skill[] {
  return m.skillIds.flatMap((id) => {
    const s = all.find((x) => x.id === id);
    return s ? [s] : [];
  });
}

function countBy(skills: Skill[], values: (s: Skill) => string[]): Map<string, number> {
  const m = new Map<string, number>();
  skills.forEach((s) => new Set(values(s)).forEach((v) => m.set(v, (m.get(v) ?? 0) + 1)));
  return m;
}

export function SkillsPage({ onBackToTasks }: { onBackToTasks: () => void }) {
  const [skills, setSkills] = useState<Skill[]>(seedSkills);
  const [mastery, setMastery] = useState<MasterySkill[]>(seedMastery);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  /* Raised here, not in the wizard: a save closes the wizard back onto this
     list, which is where the toast has to be standing. */
  const [toast, toastNode] = useToast();
  const [menu, setMenu] = useState<{ rect: DOMRect; kind: "skill" | "mastery"; id: string } | null>(null);
  // The record whose row was clicked, read back in the row preview panel. Held
  // by kind + id so the panel follows the record through an edit or archive.
  const [panel, setPanel] = useState<{ kind: "skill" | "mastery"; id: string } | null>(null);
  // A row menu opened from the panel's kebab: every item closes the panel
  // first, so the wizard or confirm it opens isn't left under the panel.
  function closePanelThen(run: () => void) {
    setPanel(null);
    run();
  }
  // "C" stands down while the panel is open — the wizard would open behind it.
  useCreateShortcut(() => setMode({ kind: "new", type: "skill" }), mode.kind === "list" && !panel);

  const [query, setQuery] = useState("");
  const [certFilter, setCertFilter] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [linkedMasteryFilter, setLinkedMasteryFilter] = useState<string[]>([]);
  const [linkedSkillFilter, setLinkedSkillFilter] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  /* Opens most-recently-modified first even though Date Modified is now an
     optional column (archived records still pin last). */
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "dateModified", dir: "desc" });
  const [page, setPage] = useState(1);

  /* Defaults (user, 2026-10-01): Name · Type · Industries · Linked Tasks ·
     Linked Certifications. Everything else is one click away in Edit Columns;
     there is no ID column. */
  const [cols, setCols] = useState<Record<ColKey, boolean>>({
    type: true, industry: true, tasks: true, certifications: true,
    linkedSkills: false, linkedMastery: false, dateModified: false, status: false, dateCreated: false,
  });
  const [order, setOrder] = useColumnOrder(COLS);

  // Reset paging when the visible set changes.
  useEffect(() => setPage(1), [query, typeFilter, linkedMasteryFilter, linkedSkillFilter, certFilter, taskFilter, industryFilter, statusFilter, sort]);

  /* ─── Mutations ─── */
  function upsertSkill(s: Skill) {
    setSkills((prev) => {
      const i = prev.findIndex((x) => x.id === s.id);
      if (i < 0) return [s, ...prev];
      const next = [...prev]; next[i] = s; return next;
    });
  }
  function upsertMastery(m: MasterySkill) {
    setMastery((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i < 0) return [m, ...prev];
      const next = [...prev]; next[i] = m; return next;
    });
  }
  function setSkillStatus(id: string, status: Skill["status"]) {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }
  function setMasteryStatus(id: string, status: MasterySkill["status"]) {
    setMastery((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  }
  function deleteSkill(id: string) {
    setSkills((prev) => prev.filter((s) => s.id !== id));
  }
  function deleteMastery(id: string) {
    setMastery((prev) => prev.filter((m) => m.id !== id));
  }

  /* ─── Menu actions ─── */
  function archiveSkill(s: Skill) {
    if (s.status === "Archived") { setSkillStatus(s.id, "Active"); toast("Skill Unarchived"); return; }
    /* A Skill still linked to a Mastery Skill can't be archived — the menu
       disables the row (1403:2071), so this guard only backs that up. */
    if (masteryUsing(s.id, mastery).length > 0) return;
    setModal({ kind: "archive-skill", skill: s });
  }
  function archiveMastery(m: MasterySkill) {
    if (m.status === "Archived") { setMasteryStatus(m.id, "Active"); toast("Mastery Skill Unarchived"); return; }
    setModal({ kind: "archive-mastery", mastery: m });
  }
  /* ─── Certification / Task filters ─── */
  const certOptions = useMemo(
    () => [...new Set(skills.flatMap(skillCertifications))].sort(),
    [skills],
  );
  const taskOptions = useMemo(
    () => [...new Set(skills.flatMap(skillTaskNames))].sort(),
    [skills],
  );
  const certCounts = useMemo(() => countBy(skills, skillCertifications), [skills]);
  /* A parent Industry counts the Skills of its Sub-Industries too, so the
     option's count matches what picking it actually shows. */
  const industryCounts = useMemo(
    () => countBy(skills, (s) => skillIndustryPaths(s).flatMap((p) => [p, topIndustry(p)])),
    [skills],
  );
  const taskCounts = useMemo(() => countBy(skills, skillTaskNames), [skills]);
  /* The Linked filters mirror the Linked columns: options are the other
     record type's names, each counted by the rows it would show. */
  const masteryOptions = useMemo(() => [...new Set(mastery.map((m) => m.name))].sort(), [mastery]);
  const skillOptions = useMemo(() => [...new Set(skills.map((s) => s.name))].sort(), [skills]);
  const linkedMasteryCounts = useMemo(
    () => new Map(mastery.map((m) => [m.name, m.skillIds.length])),
    [mastery],
  );
  const linkedSkillCounts = useMemo(
    () => new Map(skills.map((s) => [s.name, masteryUsing(s.id, mastery).length])),
    [skills, mastery],
  );
  const nMastery = (n: number | undefined) => `${n ?? 0} mastery ${n === 1 ? "skill" : "skills"}`;
  const nSkills = (n: number | undefined) => `${n ?? 0} ${n === 1 ? "skill" : "skills"}`;

  /* The two suggested filters inside the search bar. Picking values there is a
     pending draft; Enter moves them into the matching Filters-row pill, which is
     what the table actually filters on (the shared EntitySearch contract). */
  const scopes: SearchScope[] = [
    {
      token: "Type",
      options: [...TYPES],
      applied: typeFilter,
      onAppliedChange: setTypeFilter,
      optionsLabel: "Types",
      example: "Type: Mastery Skill",
      hint: "Filter by Type",
      describe: (name) =>
        name === "Skill"
          ? nSkills(skills.length)
          : `${mastery.length} mastery skill${mastery.length === 1 ? "" : "s"}`,
    },
    {
      token: "Linked Mastery Skill",
      options: masteryOptions,
      applied: linkedMasteryFilter,
      onAppliedChange: setLinkedMasteryFilter,
      optionsLabel: "Mastery Skills",
      example: "Linked Mastery Skill: HVAC Field Readiness",
      hint: "Filter by Linked Mastery Skill",
      describe: (name) => nSkills(linkedMasteryCounts.get(name)),
    },
    {
      token: "Linked Skill",
      options: skillOptions,
      applied: linkedSkillFilter,
      onAppliedChange: setLinkedSkillFilter,
      optionsLabel: "Skills",
      example: "Linked Skill: Brazing & Soldering",
      hint: "Filter by Linked Skill",
      describe: (name) => nMastery(linkedSkillCounts.get(name)),
    },
    {
      token: "Certification",
      options: certOptions,
      applied: certFilter,
      onAppliedChange: setCertFilter,
      optionsLabel: "Certifications",
      example: "Certification: EPA 608 Universal",
      hint: "Filter by Certification",
      describe: (name) => nSkills(certCounts.get(name)),
    },
    {
      token: "Task",
      options: taskOptions,
      applied: taskFilter,
      onAppliedChange: setTaskFilter,
      optionsLabel: "Tasks",
      example: "Task: Manifold Gauge Use",
      hint: "Filter by Task",
      describe: (name) => nSkills(taskCounts.get(name)),
    },
    {
      token: "Industries",
      noun: "industry",
      options: INDUSTRY_OPTIONS,
      applied: industryFilter,
      onAppliedChange: setIndustryFilter,
      optionsLabel: "Industries",
      example: "Industries: HVAC",
      hint: "Filter by Industries",
      describe: (name) => nSkills(industryCounts.get(name)),
    },
  ];

  const filterCount =
    typeFilter.length + linkedMasteryFilter.length + linkedSkillFilter.length + certFilter.length + taskFilter.length + industryFilter.length + statusFilter.length;

  function clearFilters() {
    setTypeFilter([]);
    setLinkedMasteryFilter([]);
    setLinkedSkillFilter([]);
    setCertFilter([]);
    setTaskFilter([]);
    setIndustryFilter([]);
    setStatusFilter([]);
  }

  /* ─── Derived rows ───
     Every Skill and Mastery Skill, one row each. Archived records always sit
     at the bottom, whatever the sort; the sort orders within each band. */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const skillPillsActive = certFilter.length + taskFilter.length + industryFilter.length > 0;
    const pillsPass = (s: Skill) => {
      if (certFilter.length && !skillCertifications(s).some((c) => certFilter.includes(c))) return false;
      if (taskFilter.length && !skillTaskNames(s).some((t) => taskFilter.includes(t))) return false;
      if (industryFilter.length && !matchesIndustry(s, industryFilter)) return false;
      return true;
    };
    const all: Rec[] = [
      ...(!typeFilter.length || typeFilter.includes("Skill")
        ? skills.map((s): Rec => ({ kind: "skill", skill: s, members: [s], linkedMastery: masteryUsing(s.id, mastery) }))
        : []),
      ...(!typeFilter.length || typeFilter.includes("Mastery Skill")
        ? mastery.map((m): Rec => ({ kind: "mastery", mastery: m, members: masterySkillsOf(m, skills) }))
        : []),
    ];
    const out = all.filter((r) => {
      const rec = recOf(r);
      if (q && !rec.id.toLowerCase().includes(q) && !rec.name.toLowerCase().includes(q)) return false;
      if (statusFilter.length && !statusFilter.includes(rec.status)) return false;
      /* The Certification / Task / Industry pills reach a Mastery Skill
         through its Skills. */
      if (skillPillsActive && !r.members.some(pillsPass)) return false;
      /* Each Linked filter belongs to one record type, as its column does:
         while only one is set, the other type has nothing to match and drops
         out; with both set, each type answers to its own. */
      if (linkedMasteryFilter.length || linkedSkillFilter.length) {
        const own = r.kind === "skill" ? linkedMasteryFilter : linkedSkillFilter;
        if (!own.length) return false;
        const names = r.kind === "skill" ? r.linkedMastery.map((m) => m.name) : r.members.map((s) => s.name);
        if (!names.some((n) => own.includes(n))) return false;
      }
      return true;
    });
    const dir = sort.dir === "desc" ? -1 : 1;
    return out.sort((a, b) => {
      const archA = recOf(a).status === "Archived" ? 1 : 0;
      const archB = recOf(b).status === "Archived" ? 1 : 0;
      if (archA !== archB) return archA - archB;
      return compareRec(a, b, sort.key) * dir;
    });
  }, [skills, mastery, query, typeFilter, linkedMasteryFilter, linkedSkillFilter, certFilter, taskFilter, industryFilter, statusFilter, sort]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  function toggleSort(key: string) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const visibleCols = orderedColumns(COLS, order, cols);
  const tableMin = NAME_W + ACTIONS_W + visibleCols.reduce((n, c) => n + c.width, 0);

  /* ─── Wizard routing (after all hooks) ─── */
  /* One wizard for both records: the mode tells it which kind it is making
     (there is no Type field — the two Create buttons decide), and a save lands
     in whichever group the record belongs to. */
  if (mode.kind !== "list") {
    return (
      <NewSkillWizard
        kind={mode.kind === "new" ? mode.type : mode.kind === "edit-mastery" ? "mastery" : "skill"}
        editingSkill={mode.kind === "edit-skill" ? mode.skill : undefined}
        editingMastery={mode.kind === "edit-mastery" ? mode.mastery : undefined}
        allSkills={skills}
        allMastery={mastery}
        onClose={() => setMode({ kind: "list" })}
        onBackToTasks={onBackToTasks}
        onSaveSkill={(s) => {
          upsertSkill(s);
          toast(mode.kind === "new" ? "Skill Created" : "Skill Updated");
        }}
        onSaveMastery={(m) => {
          upsertMastery(m);
          toast(mode.kind === "new" ? "Mastery Skill Created" : "Mastery Skill Updated");
        }}
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          {/* Skills has no sidebar entry — it is reached from the Tasks
              header — so the crumb's "Tasks" is the way back. */}
          <nav className="rvc-crumbs" aria-label="Breadcrumb">
            <button className="rvc-crumb" onClick={onBackToTasks} title="Back to Tasks">
              Tasks
            </button>
          </nav>
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <h1 className="tasks-title">Skills</h1>
              {/* Page subtext (Figma 742:1061): the counts, then the 14px
                  info glyph 4px after, carrying the page's explainer as the
                  shared tooltip (a plain `title`, auto-adopted — see
                  [[tooltip-and-hover-convention]]). Same shape as Awards'
                  "13 Awards · 12 Active" and Spotlight's subtext + glyph. */}
              <div className="tasks-subtitle">
                {skills.length} Skill{skills.length === 1 ? "" : "s"} · {mastery.length} Mastery Skill{mastery.length === 1 ? "" : "s"}
                <span
                  className="tasks-subtitle-info"
                  tabIndex={0}
                  aria-label="About Skills"
                  title={
                    "Skill: A practical task a user has been trained to do on the job, like \"Braze a Copper Joint\". It's earned by completing its linked Tasks, whichever Certification they're in.\n\n" +
                    "Mastery Skill: A bigger job made up of smaller Skills, like \"Install a Mini-Split System.\" It's earned by holding all of its Skills."
                  }
                >
                  <InfoIcon14 />
                </span>
              </div>
            </div>
            <div className="tasks-header-actions">
              {/* Both CTAs open the same create page — the button decides
                  which kind it makes (the page has no Type field). Create Skill
                  is the primary (and the C shortcut); Create Mastery Skill is
                  the quiet sibling. */}
              <button className="cta-quiet" onClick={() => setMode({ kind: "new", type: "mastery" })}>
                Create Mastery Skill
              </button>
              <button className="new-task" onClick={() => setMode({ kind: "new", type: "skill" })}>
                <AddIcon />
                Create Skill
                <span className="cta-kbd">C</span>
              </button>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="toolbar">
                {/* The shared page search — same component (and suggested-filter
                    panel) as Users and Quiz Attempts; its Certification / Task
                    scopes feed the two pills below. Commit-on-Enter, so the
                    table only ever filters on the applied query. */}
                <EntitySearch
                  scopes={scopes}
                  placeholder="Search Skills and Mastery Skills..."
                  searchForScope="Skills"
                  query={query}
                  onCommit={setQuery}
                />
              </div>

              <div className="filters">
                {/* Type and the two link pills stay on the row (user's order,
                    2026-10-01); everything else lives behind More Filters. */}
                <TypePill value={typeFilter} onApply={setTypeFilter} />
                <MultiPill
                  label="Linked Skill"
                  all={skillOptions}
                  value={linkedSkillFilter}
                  onApply={setLinkedSkillFilter}
                  searchable
                  searchPlaceholder="Search Skills..."
                  width={300}
                  tip={TIPS.linkedSkill}
                />
                <MultiPill
                  label="Linked Mastery Skill"
                  all={masteryOptions}
                  value={linkedMasteryFilter}
                  onApply={setLinkedMasteryFilter}
                  searchable
                  searchPlaceholder="Search Mastery Skills..."
                  width={300}
                  tip={TIPS.linkedMastery}
                />
                <MoreFiltersPill
                  options={{ industries: INDUSTRY_OPTIONS, tasks: taskOptions, certifications: certOptions }}
                  value={{ industries: industryFilter, tasks: taskFilter, certifications: certFilter, status: statusFilter }}
                  onApply={(v) => {
                    setIndustryFilter(v.industries);
                    setTaskFilter(v.tasks);
                    setCertFilter(v.certifications);
                    setStatusFilter(v.status);
                  }}
                />
                {filterCount > 0 && (
                  <button className="filter-clear-link" onClick={clearFilters}>
                    Clear Filters
                  </button>
                )}
              </div>

              <div className="co-table-row">
                <div className="co-table-col">
                  <div className="table-xscroll" style={{ "--table-min": `${tableMin}px` } as React.CSSProperties}>
                    <table className="table table-head">
                      <ColGroup cols={visibleCols} />
                      <thead>
                        <tr>
                          <SortableHeader
                            col="name"
                            label="Name"
                            className="col-name"
                            sort={sort}
                            toggle={toggleSort}
                          />
                          {visibleCols.map((c) => (
                            <SortableHeader key={c.key} col={c.key} label={c.label} className={c.className} sort={sort} toggle={toggleSort} sortable={c.sortable !== false} />
                          ))}
                          <th className="col-actions">
                            <EditColumnsButton
                              columns={cols}
                              setColumns={setCols}
                              optional={COLS}
                              fixed={FIXED}
                              order={order}
                              onOrderChange={setOrder}
                            />
                          </th>
                        </tr>
                      </thead>
                    </table>

                    <div className="tasks-scroll">
                      <table className="table table-body">
                        <ColGroup cols={visibleCols} />
                        <tbody>
                          {paged.map((r) => {
                            const rec = recOf(r);
                            return (
                              <RecRow
                                key={recKey(r)}
                                rec={r}
                                cols={visibleCols}
                                onEdit={() => setMode(r.kind === "skill" ? { kind: "edit-skill", skill: r.skill } : { kind: "edit-mastery", mastery: r.mastery })}
                                onMenu={(rect) => setMenu({ rect, kind: r.kind, id: rec.id })}
                                onOpen={() => setPanel({ kind: r.kind, id: rec.id })}
                                menuOpen={menu?.kind === r.kind && menu.id === rec.id}
                              />
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pagination">
                    <span>
                      Showing {total === 0 ? 0 : start + 1} - {start + paged.length} of {total}
                    </span>
                    <div className="pagination-controls">
                      <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><PagePrevIcon /></button>
                      <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><PageNextIcon /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {menu && (() => {
        if (menu.kind === "skill") {
          const s = skills.find((x) => x.id === menu.id);
          if (!s) return null;
          /* Linked to any Mastery Skill = can't be archived OR deleted
             (1403:2071): both rows disable with the same reason. */
          const linkedCount = masteryUsing(s.id, mastery).length;
          const linkedWhy = linkedCount > 0
            ? `Currently linked to ${linkedCount} Mastery Skill${linkedCount === 1 ? "" : "s"}. Remove ${linkedCount === 1 ? "it" : "them"} to proceed.`
            : undefined;
          return (
            <ActionsMenu
              rect={menu.rect}
              archived={s.status === "Archived"}
              archiveBlocked={s.status !== "Archived" ? linkedWhy : undefined}
              deleteBlocked={linkedWhy}
              noun="Skill"
              onClose={() => setMenu(null)}
              onEdit={() => closePanelThen(() => setMode({ kind: "edit-skill", skill: s }))}
              onArchive={() => closePanelThen(() => archiveSkill(s))}
              onDelete={() => closePanelThen(() => setModal({ kind: "delete-skill", skill: s }))}
            />
          );
        }
        const m = mastery.find((x) => x.id === menu.id);
        if (!m) return null;
        return (
          <ActionsMenu
            rect={menu.rect}
            archived={m.status === "Archived"}
            noun="Mastery Skill"
            onClose={() => setMenu(null)}
            onEdit={() => closePanelThen(() => setMode({ kind: "edit-mastery", mastery: m }))}
            onArchive={() => closePanelThen(() => archiveMastery(m))}
            onDelete={() => closePanelThen(() => setModal({ kind: "delete-mastery", mastery: m }))}
          />
        );
      })()}

      {panel && (() => {
        const rec: Rec | undefined =
          panel.kind === "skill"
            ? (() => {
                const sk = skills.find((x) => x.id === panel.id);
                return sk && { kind: "skill", skill: sk, members: [sk], linkedMastery: masteryUsing(sk.id, mastery) };
              })()
            : (() => {
                const ms = mastery.find((x) => x.id === panel.id);
                return ms && { kind: "mastery", mastery: ms, members: masterySkillsOf(ms, skills) };
              })();
        if (!rec) return null;
        return (
          <SkillPanel
            key={recKey(rec)}
            rec={rec}
            onClose={() => setPanel(null)}
            onMore={(rect) => setMenu({ rect, kind: rec.kind, id: recOf(rec).id })}
          />
        );
      })()}

      {/* ─── Confirmation flows ─── */}
      {modal.kind === "archive-skill" && (
        <ConfirmModal
          title="Archive this Skill?"
          confirmLabel="Archive Skill"
          danger
          doubleConfirm={
            <>
              <strong>{modal.skill.name}</strong> will be archived and new users can no longer
              earn it.
            </>
          }
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { setSkillStatus(modal.skill.id, "Archived"); setModal({ kind: "none" }); toast("Skill Archived"); }}
        >
          <p>
            Archive <strong>{modal.skill.name}</strong> ({modal.skill.id})? New users can no longer earn it and it leaves the active list. The{" "}
            <strong>{fmtHolders(modal.skill.holders)}</strong> user{modal.skill.holders === 1 ? "" : "s"} who already hold it keep it. You can unarchive it later.
          </p>
        </ConfirmModal>
      )}

      {modal.kind === "archive-mastery" && (
        <ConfirmModal
          title="Archive this Mastery Skill?"
          confirmLabel="Archive Mastery Skill"
          danger
          doubleConfirm={
            <>
              <strong>{modal.mastery.name}</strong> will be archived and new users can no longer
              earn it.
            </>
          }
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { setMasteryStatus(modal.mastery.id, "Archived"); setModal({ kind: "none" }); toast("Mastery Skill Archived"); }}
        >
          <p>
            Archive <strong>{modal.mastery.name}</strong> ({modal.mastery.id})? New users can no longer earn it and it moves to the bottom of the list. The{" "}
            <strong>{fmtHolders(modal.mastery.holders)}</strong> user{modal.mastery.holders === 1 ? "" : "s"} who already hold it keep it, and its {modal.mastery.skillIds.length} Skill{modal.mastery.skillIds.length === 1 ? "" : "s"} stay active. You can unarchive it later.
          </p>
        </ConfirmModal>
      )}

      {modal.kind === "delete-skill" && (
        <ConfirmModal
          title="Delete this Skill?"
          confirmLabel="Delete Skill"
          danger
          doubleConfirm={
            <>
              <strong>{modal.skill.name}</strong> will be permanently deleted and taken from{" "}
              {fmtHolders(modal.skill.holders)} user{modal.skill.holders === 1 ? "" : "s"}. This
              can’t be undone.
            </>
          }
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { deleteSkill(modal.skill.id); setModal({ kind: "none" }); toast("Skill Deleted"); }}
        >
          <p>
            Delete <strong>{modal.skill.name}</strong> ({modal.skill.id})? This permanently removes it from the{" "}
            <strong>{fmtHolders(modal.skill.holders)}</strong> user{modal.skill.holders === 1 ? "" : "s"} who earned it — they will no longer hold this Skill. This can’t be undone.
          </p>
        </ConfirmModal>
      )}

      {modal.kind === "delete-mastery" && (
        <ConfirmModal
          title="Delete this Mastery Skill?"
          confirmLabel="Delete Mastery Skill"
          danger
          doubleConfirm={
            <>
              <strong>{modal.mastery.name}</strong> will be permanently deleted and taken from{" "}
              {fmtHolders(modal.mastery.holders)} user{modal.mastery.holders === 1 ? "" : "s"}. This
              can’t be undone.
            </>
          }
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { deleteMastery(modal.mastery.id); setModal({ kind: "none" }); toast("Mastery Skill Deleted"); }}
        >
          <p>
            Delete <strong>{modal.mastery.name}</strong> ({modal.mastery.id})? This removes it from the{" "}
            <strong>{fmtHolders(modal.mastery.holders)}</strong> user{modal.mastery.holders === 1 ? "" : "s"} who earned it. The constituent Skills are not affected. This can’t be undone.
          </p>
        </ConfirmModal>
      )}

      {toastNode}
    </div>
  );
}

/* ─────────────── Sorting ─────────────── */

function compareRec(a: Rec, b: Rec, key: string): number {
  const x = recOf(a), y = recOf(b);
  switch (key) {
    case "name": return x.name.localeCompare(y.name);
    case "type": return a.kind.localeCompare(b.kind);
    case "status": return x.status.localeCompare(y.status);
    case "dateCreated": return (Date.parse(x.dateCreated) || 0) - (Date.parse(y.dateCreated) || 0);
    case "dateModified": return (Date.parse(x.dateModified) || 0) - (Date.parse(y.dateModified) || 0);
    default: return 0;
  }
}

/* ─────────────── Rows ─────────────── */

function ColGroup({ cols }: { cols: { key: string; width: number }[] }) {
  return (
    <TableCols data={[NAME_W, ...cols.map((c) => c.width)]} trail={[ACTIONS_W]} />
  );
}

function StatusBadge({ status }: { status: Skill["status"] }) {
  return <span className={`sk-status sk-status--${status.toLowerCase()}`}>{status}</span>;
}

/** The cell's hover text: every value on its own line, or nothing when there
    is only one (the cell already shows it) or none. Matches Tasks/Certs. */
function listTip(names: string[]): string | undefined {
  return names.length > 1 ? names.join("\n") : undefined;
}

/** First name in a list, plus a muted "+N" when there are more — the shared
    `used-extra` treatment from the Tasks/Certifications "Used in" columns, so
    hovering the cell reveals the rest. An empty list reads as an em dash, the
    app-wide empty-cell treatment; a Skill can reach no Certification, and so
    no Industry, at all. */
function NamesCell({ names }: { names: string[] }) {
  if (names.length === 0) return "—";
  return (
    <>
      {names[0]}
      {names.length > 1 && <span className="used-extra">+{names.length - 1}</span>}
    </>
  );
}

/* One row per record, the Tasks row shape. Rows don't open anything on click
   — only the row-action buttons respond. Archived (1126:1686): grey pill,
   muted name, dimmed data cells — `.skg-archived`. */
function RecRow({
  rec, cols, onEdit, onMenu, onOpen, menuOpen,
}: {
  rec: Rec;
  cols: Col[];
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
  /** Row click — opens the record's preview panel. Row buttons stop propagation. */
  onOpen: () => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const r = recOf(rec);
  const archived = r.status === "Archived";
  return (
    <tr className={`skg-row ${archived ? "skg-archived" : ""} ${menuOpen ? "menu-open" : ""}`} onClick={onOpen}>
      <td className="col-name">
        <span className="skg-name" data-tip={r.name}>{r.name}</span>
        {archived && <span className="pr-name-flag pr-name-flag--grey">Archived</span>}
      </td>
      {cols.map((c) => (
        <td key={c.key} className={c.className} data-tip={c.tip?.(rec)} data-tip-head={c.tipHead?.(rec)}>{c.render(rec)}</td>
      ))}
      <RowActions onEdit={onEdit} onMenu={onMenu} editTitle={rec.kind === "skill" ? "Edit Skill" : "Edit Mastery Skill"} />
    </tr>
  );
}

/** A Skill's or Mastery Skill's row preview panel (Figma 1514:2860): an
 *  Overview and the records it links to, as accordions, then its holders as
 *  Activity. */
function SkillPanel({
  rec,
  onClose,
  onMore,
}: {
  rec: Rec;
  onClose: () => void;
  onMore: (rect: DOMRect) => void;
}) {
  const r = recOf(rec);
  const isSkill = rec.kind === "skill";
  const certs = recCerts(rec);
  const tasks = isSkill ? rec.skill.taskIds.map((id) => ({ id, task: taskById(id) })) : [];
  const row = (key: string, name: string, meta?: string) => (
    <div key={key} className="cdr-task">
      <div className="cdr-task-name-row">
        <span className="cdr-task-name">{name}</span>
      </div>
      {meta && <span className="ctb-row-meta">{meta}</span>}
    </div>
  );
  const listCard = (title: string, rows: ReactNode[], empty: string) => (
    <ConfirmCard title={`${title} · ${rows.length}`} tableBody={rows.length > 0}>
      {rows.length > 0 ? <div className="ctb-tasktable">{rows}</div> : <p className="form-help">{empty}</p>}
    </ConfirmCard>
  );

  return (
    <PreviewPanel
      kind={isSkill ? "Skill" : "Mastery Skill"}
      title={r.name}
      subtitle={r.description}
      onMore={onMore}
      stats={[{ count: fmtHolders(r.holders), title: "Holders", sub: "Have earned it" }]}
      onClose={onClose}
    >
      <ConfirmCard
        title="Overview"
        fillBlanks
        rows={[
          ["Type", isSkill ? "Skill" : "Mastery Skill"],
          ["Status", r.status],
          [
            "Award Rule",
            isSkill
              ? rec.skill.rule === "any"
                ? "Any One Task is Complete"
                : "All Selected Tasks are Complete"
              : "All Linked Skills are Held",
          ],
          ["Created By", r.createdBy],
          ["Date Created", r.dateCreated],
          ["Date Modified", r.dateModified],
          ["Certifications", certs.join(", "), true],
          ["Industry", recIndustries(rec).join(", "), true],
        ]}
      />
      {isSkill ? (
        <>
          {listCard(
            "Linked Tasks",
            tasks.map(({ id, task }) => row(id, task?.name ?? id, task?.type)),
            "No Tasks award this Skill yet.",
          )}
          {listCard(
            "Linked Mastery Skills",
            rec.linkedMastery.map((m) => row(m.id, m.name, m.status === "Archived" ? "Archived" : undefined)),
            "Not part of any Mastery Skill.",
          )}
        </>
      ) : (
        listCard(
          "Linked Skills",
          rec.members.map((sk) =>
            row(sk.id, sk.name, `${sk.taskIds.length} ${sk.taskIds.length === 1 ? "Task" : "Tasks"}`),
          ),
          "No Skills linked yet.",
        )
      )}
    </PreviewPanel>
  );
}

function RowActions({
  onEdit, onMenu, editTitle,
}: {
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
  editTitle: string;
}) {
  /* A mouse click must not focus these. When the table overflows sideways,
     Chrome scrolls a newly focused button in the sticky actions column to its
     UNSTUCK position (off the right edge), and that scroll event closes the
     menu the click just opened. Keyboard focus (Tab) is unaffected. */
  const noFocus = (e: React.MouseEvent) => e.preventDefault();
  return (
    <td className="col-actions">
      <button
        className="row-action-btn lone-dots"
        aria-label="More"
        onMouseDown={noFocus}
        onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget.getBoundingClientRect()); }}
      >
        <RowKebabIcon />
      </button>
      <div className="row-action-bar">
        <button className="row-action-btn" aria-label="Edit" title={editTitle} onMouseDown={noFocus} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <RowEditIcon />
        </button>
        <button className="row-action-btn" aria-label="More" onMouseDown={noFocus} onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget.getBoundingClientRect()); }}>
          <RowKebabIcon />
        </button>
      </div>
    </td>
  );
}

function SortableHeader({
  col, label, className, sort, toggle, sortable = true,
}: {
  col: string;
  label: string;
  className?: string;
  sort: { key: string; dir: SortDir };
  toggle: (k: string) => void;
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

/* ─────────────── Actions menu (fixed-positioned) ───────────────
   The shared row menu (`.u-menu`, the Question Bank shape, 1085:1082): no
   header, three bare verbs — Edit, Archive (Unarchive when archived),
   Delete. Identical for a Skill and a Mastery Skill; `noun` only feeds the
   aria-label. A Skill linked to a Mastery Skill gets disabled Archive AND
   Delete rows with the reason underneath (1403:2071) instead of live ones. */

function ActionsMenu({
  rect, archived, archiveBlocked, deleteBlocked, noun, onClose, onArchive, onEdit, onDelete,
}: {
  rect: DOMRect;
  archived: boolean;
  /** Why Archive is unavailable; set, the row renders disabled with this note. */
  archiveBlocked?: string;
  /** Why Delete is unavailable — same treatment. */
  deleteBlocked?: string;
  /** "Skill" or "Mastery Skill" — names the menu for assistive tech. */
  noun: string;
  onClose: () => void;
  onArchive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* The reason line wraps in 1403:2071's 203px box, but a wrapped box keeps
       that width even when its lines come up short ("1 Mastery Skill. Remove
       it to proceed." is ~181px at most), leaving a wide right gutter. Fit
       the box to its longest line so the panel hugs the copy. */
    el.querySelectorAll<HTMLElement>(".u-menu-item-sub").forEach((sub) => {
      sub.style.width = "";
      const range = document.createRange();
      range.selectNodeContents(sub);
      const widest = Math.max(...Array.from(range.getClientRects(), (r) => r.width));
      if (widest > 0) sub.style.width = `${Math.ceil(widest)}px`;
    });
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    /* Right-anchored to the trigger — the kebab is the action bar's last cell,
       so the open menu's right edge lines up with the bar's. Using `right`
       rather than (rect.right - measuredWidth) keeps that exact: the first-pass
       width measurement is unreliable, because the fallback `left` shrink-to-
       fits the menu against the viewport before it has been placed. */
    setPos({ top, right: Math.max(8, window.innerWidth - rect.right) });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) onClose(); }
    function onScroll() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const item = (icon: JSX.Element, label: string, onPick: () => void, danger = false) => (
    <button
      className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`}
      onClick={(e) => { e.stopPropagation(); onPick(); onClose(); }}
    >
      <span className="u-menu-item-icon">{icon}</span>
      {label}
    </button>
  );

  const blockedItem = (icon: JSX.Element, label: string, why: string, danger = false) => (
    <button className={`u-menu-item ${danger ? "u-menu-item--danger" : ""}`} disabled>
      <span className="u-menu-item-icon">{icon}</span>
      <span className="u-menu-item-text">
        {label}
        <span className="u-menu-item-sub">{why}</span>
      </span>
    </button>
  );

  return (
    <div
      ref={ref}
      className="u-menu sk-row-menu"
      role="menu"
      aria-label={`${noun} actions`}
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {item(<RowEditIcon />, "Edit", onEdit)}
      {/* 1085:1082's archive glyph, for both directions — as Question Bank does. */}
      {archiveBlocked
        ? blockedItem(<MenuArchiveOffIcon />, "Archive", archiveBlocked)
        : item(<MenuArchiveOffIcon />, archived ? "Unarchive" : "Archive", onArchive)}
      {/* A blocked Delete is grey, not red — `.u-menu-item--danger:disabled`. */}
      {deleteBlocked
        ? blockedItem(<RowDeleteIcon />, "Delete", deleteBlocked, true)
        : item(<RowDeleteIcon />, "Delete", onDelete, true)}
    </div>
  );
}

/* ─────────────── Confirm modal ───────────────
   The shared shell (PrmModal, Figma 667:884 "General Modal"): body copy is
   plain white 16px in the `.prm-content` slot — no page-local text class. */

function ConfirmModal({
  title, confirmLabel, danger = false, doubleConfirm, children, onCancel, onConfirm,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  /** See PrmModal — every deletion asks twice. */
  doubleConfirm?: React.ReactNode;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <PrmModal
      title={title}
      confirmLabel={confirmLabel}
      danger={danger}
      doubleConfirm={doubleConfirm}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div className="prm-content skg-modal-content">{children}</div>
    </PrmModal>
  );
}

/* ─────────────── Filters ─────────────── */

/* More Filters — the shared cascading menu (as Companies/Tasks use it): each
   row opens its own checklist with its own Apply. Order is the user's:
   Industries, Tasks, Certifications, Status. */
const MORE_KEYS = ["industries", "tasks", "certifications", "status"] as const;
type MoreFilters = Record<(typeof MORE_KEYS)[number], string[]>;
const EMPTY_MORE: MoreFilters = { industries: [], tasks: [], certifications: [], status: [] };

function MoreFiltersPill({
  options, value, onApply,
}: {
  options: { industries: string[]; tasks: string[]; certifications: string[] };
  value: MoreFilters;
  onApply: (v: MoreFilters) => void;
}) {
  const count = MORE_KEYS.reduce((n, k) => n + value[k].length, 0);
  return (
    <Dropdown
      width={320}
      trigger={({ open, toggle }) => (
        <PillTrigger
          label="More Filters"
          value={count > 0 ? `${count} Active` : null}
          open={open}
          toggle={toggle}
          onClear={() => onApply(EMPTY_MORE)}
        />
      )}
    >
      {({ close }) => (
        <CascadingMultiSelect
          sections={[
            { key: "industries", label: "Industries", groups: [{ items: options.industries }], searchPlaceholder: "Search Industries/Sub-Industries..." },
            { key: "tasks", label: "Tasks", groups: [{ items: options.tasks }], searchPlaceholder: "Search Tasks..." },
            { key: "certifications", label: "Linked Certifications", groups: [{ items: options.certifications }], searchPlaceholder: "Search Certifications..." },
            { key: "status", label: "Status", groups: [{ items: [...SKILL_STATUSES] }] },
          ]}
          value={value}
          onApply={(v) => {
            onApply(Object.fromEntries(MORE_KEYS.map((k) => [k, v[k] ?? []])) as MoreFilters);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function TypePill({ value, onApply }: { value: string[]; onApply: (v: string[]) => void }) {
  const summary = summarize(value, [...TYPES]);
  return (
    <Dropdown
      width={220}
      trigger={({ open, toggle }) => (
        <PillTrigger label="Type" value={summary} open={open} toggle={toggle} onClear={() => onApply([])} tip={TIPS.type} />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...TYPES] }]}
          value={value}
          onApply={(v) => { onApply(v); close(); }}
        />
      )}
    </Dropdown>
  );
}
