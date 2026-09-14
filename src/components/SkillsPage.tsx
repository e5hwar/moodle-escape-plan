import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { CERT_BY_USEDIN, topIndustry } from "../data/certifications";
import { industries as allIndustries } from "../data/industries";
import { Dropdown } from "./Dropdown";
import { FILTER_TIPS } from "../data/filterTips";
import {
  PillTrigger,
  summarize,
  SectionedMultiSelect,
  EditColumnsButton,
  useColumnOrder,
  orderedColumns,
  type ColumnDef,
} from "./Filters";
import { EntitySearch, type SearchScope } from "./UsersSearch";
import { MultiPill } from "./UsersFilters";
import { NewSkillWizard } from "./NewSkillWizard";
import { PrmModal } from "./PrmModal";
import { SortIcon, AddIcon, RowEditIcon, RowKebabIcon, MenuArchiveOffIcon, RowDeleteIcon, ChevronLeftIcon, ChevronRightIcon, TreeCaretIcon, ExpandVerticalIcon, ShrinkVerticalIcon, InfoIcon14, AlertCircleFilledIcon } from "./icons";
import { useCreateShortcut } from "../hooks/useCreateShortcut";

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
  | { kind: "archive-skill"; skill: Skill; linked: MasterySkill[] }
  | { kind: "archive-mastery"; mastery: MasterySkill }
  | { kind: "delete-skill-blocked"; skill: Skill; linked: MasterySkill[] }
  | { kind: "delete-skill"; skill: Skill }
  | { kind: "delete-mastery"; mastery: MasterySkill };

/* The Type filter — a Filters-row pill AND a suggested filter in the search
   bar, sharing one value set. Both (or neither) = the grouped table; one alone
   flattens it to that record type, since a group without its other half is
   just a list. */
const TYPES = ["Skill", "Mastery Skill"] as const;

type ColKey = "tasks" | "certifications" | "industry" | "dateModified" | "id" | "status" | "dateCreated";

/* ─────────────── Grouping ───────────────
   One table, grouped by Mastery Skill (Figma 1117:1537). A Mastery Skill is a
   collapsible group row and its constituent Skills are the child rows under
   it. Skills that roll up into no Mastery Skill sit under a pseudo-group,
   "Unlinked Skills", which is always the last group — it has no record of
   its own, so no ID/status/dates and no row menu. A Skill that belongs to two
   Mastery Skills appears under each. */
/* What each filter pill does, shown on hover (the shared `title` tooltip)
   started here and is now the app-wide convention; the lines themselves live in
   `data/filterTips.ts` with every other page's. */
const TIPS = FILTER_TIPS.skills;

const UNLINKED_KEY = "unlinked";
const UNLINKED_LABEL = "Unlinked Skills";

type Group = {
  key: string;
  /** null = the Unlinked Skills pseudo-group. */
  mastery: MasterySkill | null;
  members: Skill[];
};

type FlatRow =
  /** `flat`: a Mastery Skill shown as a plain record row (Type = Mastery
      Skills only) — no wash, no caret, no children. */
  | { kind: "group"; group: Group; flat: boolean }
  /** `group` is null when Skills are listed on their own (Type = Skills). */
  | { kind: "skill"; group: Group | null; skill: Skill };

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
  tip?: (s: Skill) => string | undefined;
  /** SemiBold label line above that text (`data-tip-head`). */
  tipHead?: (s: Skill) => string | undefined;
  render: (s: Skill) => React.ReactNode;
  /** The same column on a Mastery Skill's group row. Omitted = blank, per
      the group-row atom (1119:1543), which leaves Tasks Required and
      Certifications empty. */
  renderGroup?: (m: MasterySkill) => React.ReactNode;
};

const COLS: Col[] = [
  {
    key: "tasks", label: "Linked Tasks", className: "col-used", width: 200, sortable: false,
    tip: (s) => listTip(s.taskIds.map((id) => taskById(id)?.name ?? id)),
    /* More than one linked Task means completing any of them awards the Skill,
       so the list needs saying so before it reads as "all of these". */
    tipHead: (s) => (s.taskIds.length > 1 ? "Any of" : undefined),
    render: (s) => <NamesCell names={s.taskIds.map((id) => taskById(id)?.name ?? id)} />,
  },
  {
    key: "certifications", label: "Certifications", className: "col-used", width: 200, sortable: false,
    tip: (s) => listTip([...new Set(skillCertifications(s))]),
    render: (s) => <NamesCell names={[...new Set(skillCertifications(s))]} />,
  },
  {
    key: "industry", label: "Industry", className: "col-used", width: 180, sortable: false,
    tip: (s) => listTip(skillIndustries(s)),
    render: (s) => <NamesCell names={skillIndustries(s)} />,
  },
  { key: "dateModified", label: "Date Modified", className: "col-date", width: 150, render: (s) => s.dateModified, renderGroup: (m) => m.dateModified },
  { key: "id", label: "ID", className: "col-id", width: 100, render: (s) => s.id, renderGroup: (m) => m.id },
  { key: "status", label: "Status", className: "col-type", width: 110, render: (s) => <StatusBadge status={s.status} />, renderGroup: (m) => <StatusBadge status={m.status} /> },
  { key: "dateCreated", label: "Date Created", className: "col-date", width: 150, render: (s) => s.dateCreated, renderGroup: (m) => m.dateCreated },
];

const FIXED = [{ label: "Name" }];

/* 340 — the row atoms draw 400; the user settled on 340 after seeing it. The
   fixed layout hands leftover width to every column, so the name cell grows
   with the viewport; `.skg-*` rows lift the shared 280px name cap so that
   growth reaches the "Also in …" flag. */
const NAME_W = 340;
const ACTIONS_W = 40;

/* A Skill carries no Certification of its own — it inherits both its Tasks and
   their Certifications from `taskIds`, so the Certification / Task filters (and
   their options) are derived from the Task graph. Deriving rather than listing
   means a filter can never offer a value that matches no row. */
function skillTaskNames(s: Skill): string[] {
  return s.taskIds.flatMap((id) => {
    const t = taskById(id);
    return t ? [t.name] : [];
  });
}

function skillCertifications(s: Skill): string[] {
  return s.taskIds.flatMap((id) => taskById(id)?.usedIn ?? []);
}

/* A Skill has no Industry of its own — it inherits the Industries of every
   Certification it reaches through its Tasks. A Skill can therefore land in
   several Industries, or in none (its Certifications carry no Industry, or it
   awards no Task at all). These are the FULL paths ("HVAC › Residential"),
   which is what the filter matches on; the column shows the top level. */
function skillIndustryPaths(s: Skill): string[] {
  return [
    ...new Set(
      skillCertifications(s).flatMap((name) => {
        const industry = CERT_BY_USEDIN.get(name)?.industry;
        return industry ? [industry] : [];
      }),
    ),
  ];
}

function skillIndustries(s: Skill): string[] {
  return [...new Set(skillIndustryPaths(s).map(topIndustry))];
}

/* Industry options are the Industries page's own list: every Industry followed
   by its Sub-Industries, each reading as its own full path — the same flat
   list the Certification filters use (see `CertFilters.tsx`). */
const INDUSTRY_OPTIONS: string[] = [...allIndustries]
  .sort((a, b) => a.displayPosition - b.displayPosition)
  .flatMap((ind) => [
    ind.name,
    ...[...ind.subIndustries]
      .sort((a, b) => a.displayPosition - b.displayPosition)
      .map((sub) => `${ind.name} › ${sub.name}`),
  ]);

/* A selected option matches its own path and everything beneath it: picking
   "HVAC" catches "HVAC › Residential", picking the sub path matches only it. */
function matchesIndustry(s: Skill, selected: string[]): boolean {
  const paths = skillIndustryPaths(s);
  return selected.some((opt) => paths.some((p) => p === opt || p.startsWith(`${opt} ›`)));
}

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

export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>(seedSkills);
  const [mastery, setMastery] = useState<MasterySkill[]>(seedMastery);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [modal, setModal] = useState<Modal>({ kind: "none" });
  useCreateShortcut(() => setMode({ kind: "new", type: "skill" }), mode.kind === "list");
  /* `id` names the RECORD the menu acts on; `rowKey` names the ROW it was
     opened from. They differ because a Skill in several Mastery Skills is
     rendered once per group — keying the open state by id alone lit up every
     copy of that Skill at once. */
  const [menu, setMenu] = useState<{ rect: DOMRect; kind: "skill" | "mastery"; id: string; rowKey: string } | null>(null);

  const [query, setQuery] = useState("");
  const [certFilter, setCertFilter] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  /* Date Modified is a default column, so it is also the default sort — the
     recency order the list opens in has its indicator on screen. */
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "dateModified", dir: "desc" });
  const [page, setPage] = useState(1);
  /** Group keys whose children are hidden. Archived Mastery Skills open
      folded — they're history, not the working list — everything else open. */
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(mastery.filter((m) => m.status === "Archived").map((m) => m.id)),
  );

  /* Defaults answer "what does this Skill cover, and when did it last
     change". ID, Status and Date Created are a lookup, so they stay one click
     away in the Edit Columns menu. */
  const [cols, setCols] = useState<Record<ColKey, boolean>>({
    tasks: true, certifications: true, industry: true, dateModified: true,
    id: false, status: false, dateCreated: false,
  });
  const [order, setOrder] = useColumnOrder(COLS);

  // Reset paging when the visible set changes.
  useEffect(() => setPage(1), [query, typeFilter, certFilter, taskFilter, industryFilter, statusFilter, sort]);

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
    if (s.status === "Archived") { setSkillStatus(s.id, "Active"); return; }
    setModal({ kind: "archive-skill", skill: s, linked: masteryUsing(s.id, mastery) });
  }
  function archiveMastery(m: MasterySkill) {
    if (m.status === "Archived") { setMasteryStatus(m.id, "Active"); return; }
    setModal({ kind: "archive-mastery", mastery: m });
  }
  function requestDeleteSkill(s: Skill) {
    const linked = masteryUsing(s.id, mastery);
    if (linked.length > 0) setModal({ kind: "delete-skill-blocked", skill: s, linked });
    else setModal({ kind: "delete-skill", skill: s });
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
      token: "Industry",
      options: INDUSTRY_OPTIONS,
      applied: industryFilter,
      onAppliedChange: setIndustryFilter,
      optionsLabel: "Industries",
      example: "Industry: HVAC",
      hint: "Filter by Industry",
      describe: (name) => nSkills(industryCounts.get(name)),
    },
  ];

  const filterCount =
    typeFilter.length + certFilter.length + taskFilter.length + industryFilter.length + statusFilter.length;

  function clearFilters() {
    setTypeFilter([]);
    setCertFilter([]);
    setTaskFilter([]);
    setIndustryFilter([]);
    setStatusFilter([]);
  }

  /* ─── Derived rows ─── */
  const showSkills = !typeFilter.length || typeFilter.includes("Skill");
  const showMastery = !typeFilter.length || typeFilter.includes("Mastery Skill");
  const grouped = showSkills && showMastery;

  const { groups, flat, total, groupRow } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hitsQuery = (r: { id: string; name: string }) =>
      !q || r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
    const pillsPass = (s: Skill) => {
      if (certFilter.length && !skillCertifications(s).some((c) => certFilter.includes(c))) return false;
      if (taskFilter.length && !skillTaskNames(s).some((t) => taskFilter.includes(t))) return false;
      if (industryFilter.length && !matchesIndustry(s, industryFilter)) return false;
      return true;
    };
    const skillPasses = (s: Skill, needQuery: boolean) => {
      if (needQuery && !hitsQuery(s)) return false;
      if (!pillsPass(s)) return false;
      if (statusFilter.length && !statusFilter.includes(s.status)) return false;
      return true;
    };
    const cmpSkill = (a: Skill, b: Skill) => compareSkill(a, b, sort.key);
    const cmpMastery = (a: MasterySkill, b: MasterySkill) => compareMastery(a, b, sort.key);
    const sortSkills = (arr: Skill[]) => {
      const out = [...arr].sort(cmpSkill);
      return sort.dir === "desc" ? out.reverse() : out;
    };
    const sortedMastery = [...mastery].sort(cmpMastery);
    if (sort.dir === "desc") sortedMastery.reverse();
    const masteryOwnMatch = (m: MasterySkill) =>
      hitsQuery(m) && (!statusFilter.length || statusFilter.includes(m.status));

    /* Type = Skill: every matching Skill, one flat list, no groups. */
    if (!showMastery) {
      const list = sortSkills(skills.filter((s) => skillPasses(s, true)));
      const rows: FlatRow[] = list.map((s) => ({ kind: "skill", group: null, skill: s }));
      return { groups: [] as Group[], flat: rows, total: rows.length, groupRow: new Map<string, number>() };
    }

    /* Type = Mastery Skill: the Mastery Skills as plain record rows. The
       Certification / Task pills reach them through their Skills. */
    if (!showSkills) {
      const list = sortedMastery.filter(
        (m) =>
          masteryOwnMatch(m) &&
          (!(certFilter.length || taskFilter.length) || masterySkillsOf(m, skills).some(pillsPass)),
      );
      const rows: FlatRow[] = list.map((m) => ({ kind: "group", group: { key: m.id, mastery: m, members: [] }, flat: true }));
      return { groups: [] as Group[], flat: rows, total: rows.length, groupRow: new Map<string, number>() };
    }

    /* Both: the grouped table. */
    const out: Group[] = [];

    for (const m of sortedMastery) {
      /* Searching for the Mastery Skill itself opens the whole group: its
         children skip the query and only answer to the pill filters. */
      const nameHit = hitsQuery(m);
      const members = sortSkills(masterySkillsOf(m, skills).filter((s) => skillPasses(s, !nameHit)));
      /* A Mastery Skill can stand alone on its own name/status match, but only
         while no Skill-level pill is narrowing the list — those filter through
         its members, so with one active an empty group means "no match", not
         "a group with nothing in it". */
      const skillPillsActive = certFilter.length + taskFilter.length + industryFilter.length > 0;
      const selfMatches = masteryOwnMatch(m) && !skillPillsActive;
      if (members.length > 0 || selfMatches) out.push({ key: m.id, mastery: m, members });
    }

    // Unlinked Skills last — always, whatever the sort.
    const unlinked = sortSkills(
      skills.filter((s) => masteryUsing(s.id, mastery).length === 0 && skillPasses(s, true)),
    );
    if (unlinked.length > 0) out.push({ key: UNLINKED_KEY, mastery: null, members: unlinked });

    /* The list paginates over what is on screen (group rows + expanded
       children); the counter counts Skills — all of them, folded or not — so
       it doesn't move as groups fold. */
    const rows: FlatRow[] = [];
    /** Each group's row index in `rows` — the counter attributes a group's
        Skills to the page its group row is on, folded or not. */
    const groupRow = new Map<string, number>();
    for (const g of out) {
      groupRow.set(g.key, rows.length);
      rows.push({ kind: "group", group: g, flat: false });
      if (!collapsed.has(g.key)) g.members.forEach((s) => rows.push({ kind: "skill", group: g, skill: s }));
    }
    return {
      groups: out,
      flat: rows,
      groupRow,
      // Distinct Skills only — a Mastery Skill row is a container, not a
      // record, and a Skill under two of them is still one Skill.
      total: new Set(out.flatMap((g) => g.members.map((s) => s.id))).size,
    };
  }, [skills, mastery, query, certFilter, taskFilter, industryFilter, statusFilter, sort, collapsed, showSkills, showMastery]);

  const totalPages = Math.max(1, Math.ceil(flat.length / PAGE_SIZE));
  const visiblePage = Math.min(page, totalPages);
  const start = (visiblePage - 1) * PAGE_SIZE;
  const paged = flat.slice(start, start + PAGE_SIZE);
  /* The counter counts Skills only (group rows are containers, not records),
     each Skill once — one in two Mastery Skills is listed twice but is still
     one Skill — and independently of folding: a group's Skills count on the
     page its group row sits on, whether or not its children are showing, so
     "Collapse all" can't read as "1 - 0 of 12". */
  const skillsInGroupsBefore = (rowLimit: number) =>
    new Set(groups.filter((g) => (groupRow.get(g.key) ?? Infinity) < rowLimit).flatMap((g) => g.members.map((s) => s.id))).size;
  const skillsBefore = grouped ? skillsInGroupsBefore(start) : start;
  const skillsOnPage = grouped ? skillsInGroupsBefore(start + PAGE_SIZE) - skillsBefore : paged.length;

  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.key));
  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(groups.map((g) => g.key)));
  }

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
        onSaveSkill={upsertSkill}
        onSaveMastery={upsertMastery}
      />
    );
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks">
          <header className="tasks-header">
            <div>
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
                <TypePill value={typeFilter} onApply={setTypeFilter} />
                <MultiPill
                  label="Certification"
                  all={certOptions}
                  value={certFilter}
                  onApply={setCertFilter}
                  searchable
                  searchPlaceholder="Search Certifications..."
                  width={300}
                  tip={TIPS.certification}
                />
                <MultiPill
                  label="Task"
                  all={taskOptions}
                  value={taskFilter}
                  onApply={setTaskFilter}
                  searchable
                  searchPlaceholder="Search Tasks..."
                  width={300}
                  tip={TIPS.task}
                />
                <MultiPill
                  label="Industry"
                  all={INDUSTRY_OPTIONS}
                  value={industryFilter}
                  onApply={setIndustryFilter}
                  searchable
                  searchPlaceholder="Search Industries/Sub-Industries..."
                  width={300}
                  tip={TIPS.industry}
                />
                <StatusPill value={statusFilter} onApply={setStatusFilter} />
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
                            /* The group toggle lives in the Name header
                               (1119:1577 expand-vertical / 1127:1755
                               shrink-vertical) — only while there are groups
                               to fold. */
                            lead={grouped && groups.length > 0 && (
                              <button
                                type="button"
                                className="skg-toggle-all"
                                title={allCollapsed ? "Expand All" : "Collapse All"}
                                aria-label={allCollapsed ? "Expand All" : "Collapse All"}
                                onClick={(e) => { e.stopPropagation(); toggleAll(); }}
                              >
                                {allCollapsed ? <ExpandVerticalIcon /> : <ShrinkVerticalIcon />}
                              </button>
                            )}
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
                          {paged.map((row) =>
                            row.kind === "group" ? (
                              <GroupRow
                                key={`g:${row.group.key}`}
                                group={row.group}
                                flat={row.flat}
                                cols={visibleCols}
                                open={!collapsed.has(row.group.key)}
                                onToggle={() => toggleGroup(row.group.key)}
                                onEdit={() => row.group.mastery && setMode({ kind: "edit-mastery", mastery: row.group.mastery })}
                                onMenu={(rect) => row.group.mastery && setMenu({ rect, kind: "mastery", id: row.group.mastery.id, rowKey: `g:${row.group.key}` })}
                                menuOpen={menu?.rowKey === `g:${row.group.key}`}
                              />
                            ) : (
                              <SkillRow
                                key={`${row.group?.key ?? "flat"}:${row.skill.id}`}
                                skill={row.skill}
                                indented={row.group !== null}
                                alsoIn={row.group ? masteryUsing(row.skill.id, mastery).filter((m) => m.id !== row.group?.mastery?.id).map((m) => m.name) : []}
                                cols={visibleCols}
                                onEdit={() => setMode({ kind: "edit-skill", skill: row.skill })}
                                onMenu={(rect) => setMenu({ rect, kind: "skill", id: row.skill.id, rowKey: `${row.group?.key ?? "flat"}:${row.skill.id}` })}
                                menuOpen={menu?.rowKey === `${row.group?.key ?? "flat"}:${row.skill.id}`}
                              />
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pagination">
                    <span>
                      Showing {total === 0 ? 0 : skillsBefore + 1} - {skillsBefore + skillsOnPage} of {total}
                    </span>
                    <div className="pagination-controls">
                      <button className="page-btn" disabled={visiblePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeftIcon /></button>
                      <button className="page-btn" disabled={visiblePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRightIcon /></button>
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
          return (
            <ActionsMenu
              rect={menu.rect}
              archived={s.status === "Archived"}
              noun="Skill"
              onClose={() => setMenu(null)}
              onEdit={() => setMode({ kind: "edit-skill", skill: s })}
              onArchive={() => archiveSkill(s)}
              onDelete={() => requestDeleteSkill(s)}
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
            onEdit={() => setMode({ kind: "edit-mastery", mastery: m })}
            onArchive={() => archiveMastery(m)}
            onDelete={() => setModal({ kind: "delete-mastery", mastery: m })}
          />
        );
      })()}

      {/* ─── Confirmation flows ─── */}
      {modal.kind === "archive-skill" && (
        <ConfirmModal
          title="Archive this Skill?"
          confirmLabel="Archive Skill"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { setSkillStatus(modal.skill.id, "Archived"); setModal({ kind: "none" }); }}
        >
          <p>
            Archive <strong>{modal.skill.name}</strong> ({modal.skill.id})? New users can no longer earn it and it leaves the active list. The{" "}
            <strong>{fmtHolders(modal.skill.holders)}</strong> user{modal.skill.holders === 1 ? "" : "s"} who already hold it keep it. You can unarchive it later.
          </p>
          {modal.linked.length > 0 && (
            <LinkedMasteryNote
              title={`${modal.linked.length} Mastery Skill${modal.linked.length === 1 ? "" : "s"} will become unearnable for new users`}
              linked={modal.linked}
            >
              {modal.skill.name} is one of their required Skills, and an archived Skill can’t be earned. Ideally remove it from each Mastery Skill’s criteria first.
            </LinkedMasteryNote>
          )}
        </ConfirmModal>
      )}

      {modal.kind === "archive-mastery" && (
        <ConfirmModal
          title="Archive this Mastery Skill?"
          confirmLabel="Archive Mastery Skill"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { setMasteryStatus(modal.mastery.id, "Archived"); setModal({ kind: "none" }); }}
        >
          <p>
            Archive <strong>{modal.mastery.name}</strong> ({modal.mastery.id})? New users can no longer earn it and its group folds under the archived rows. The{" "}
            <strong>{fmtHolders(modal.mastery.holders)}</strong> user{modal.mastery.holders === 1 ? "" : "s"} who already hold it keep it, and its {modal.mastery.skillIds.length} Skill{modal.mastery.skillIds.length === 1 ? "" : "s"} stay active. You can unarchive it later.
          </p>
        </ConfirmModal>
      )}

      {modal.kind === "delete-skill-blocked" && (
        <ConfirmModal
          title="Can’t delete this Skill"
          confirmLabel="Edit Mastery Skills"
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => {
            const first = modal.linked[0];
            setModal({ kind: "none" });
            setMode({ kind: "edit-mastery", mastery: first });
          }}
        >
          <p>
            <strong>{modal.skill.name}</strong> ({modal.skill.id}) is required by {modal.linked.length} Mastery Skill{modal.linked.length === 1 ? "" : "s"}, so it can’t be deleted yet.
          </p>
          <LinkedMasteryNote title="Remove it from their criteria first" linked={modal.linked}>
            Edit each Mastery Skill below and take this Skill out of its required Skills, then delete it.
          </LinkedMasteryNote>
        </ConfirmModal>
      )}

      {modal.kind === "delete-skill" && (
        <ConfirmModal
          title="Delete this Skill?"
          confirmLabel="Delete Skill"
          danger
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { deleteSkill(modal.skill.id); setModal({ kind: "none" }); }}
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
          onCancel={() => setModal({ kind: "none" })}
          onConfirm={() => { deleteMastery(modal.mastery.id); setModal({ kind: "none" }); }}
        >
          <p>
            Delete <strong>{modal.mastery.name}</strong> ({modal.mastery.id})? This removes it from the{" "}
            <strong>{fmtHolders(modal.mastery.holders)}</strong> user{modal.mastery.holders === 1 ? "" : "s"} who earned it. The constituent Skills are not affected — they move to Unlinked Skills. This can’t be undone.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

/* ─────────────── Sorting ───────────────
   The same key orders the Mastery Skill groups and the Skills inside each
   group; the Unlinked group is pinned last regardless. */

function compareSkill(a: Skill, b: Skill, key: string): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "id": return a.id.localeCompare(b.id);
    case "status": return a.status.localeCompare(b.status);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return 0;
  }
}

function compareMastery(a: MasterySkill, b: MasterySkill, key: string): number {
  switch (key) {
    case "name": return a.name.localeCompare(b.name);
    case "id": return a.id.localeCompare(b.id);
    case "status": return a.status.localeCompare(b.status);
    case "dateCreated": return (Date.parse(a.dateCreated) || 0) - (Date.parse(b.dateCreated) || 0);
    case "dateModified": return (Date.parse(a.dateModified) || 0) - (Date.parse(b.dateModified) || 0);
    default: return 0;
  }
}

/* ─────────────── Rows ─────────────── */

function ColGroup({ cols }: { cols: { key: string; width: number }[] }) {
  return (
    <colgroup>
      <col style={{ width: NAME_W }} />
      {cols.map((c) => (
        <col key={c.key} style={{ width: c.width }} />
      ))}
      <col style={{ width: ACTIONS_W }} />
    </colgroup>
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

/* Group row (Figma 1119:1543): the 10% grey wash, no separator, a 16px caret
   before the name that turns down when the group is open. Clicking anywhere on
   the row folds/unfolds it; the caret is a real button for the keyboard. The
   Unlinked pseudo-group has no record behind it, so no row menu.
   `flat` (Type = Mastery Skills) drops the wash, the caret and the toggle:
   the Mastery Skill is then an ordinary record row. */
function GroupRow({
  group, flat, cols, open, onToggle, onEdit, onMenu, menuOpen,
}: {
  group: Group;
  flat: boolean;
  cols: Col[];
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
  menuOpen: boolean;
}) {
  const m = group.mastery;
  const archived = m?.status === "Archived";
  const n = group.members.length;
  return (
    <tr
      className={`${flat ? "" : "skg-group"} ${archived ? "skg-archived" : ""} ${menuOpen ? "menu-open" : ""}`}
      onClick={flat ? undefined : onToggle}
      aria-expanded={flat ? undefined : open}
    >
      <td className="col-name">
        {!flat && (
          <button
            type="button"
            className={`skg-caret ${open ? "is-open" : ""}`}
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
          >
            <TreeCaretIcon />
          </button>
        )}
        {/* The pseudo-group's one datum — how many Skills sit under it — rides
            in the name: "Unlinked Skills · 3". Its other cells stay blank. */}
        {/* The badges never shrink, so a long name is what gives way; carry
            it on hover the way every other truncating cell does. */}
        <span className="skg-name" data-tip={m?.name}>{m ? m.name : `${UNLINKED_LABEL} · ${n}`}</span>
        {/* The atom's accent "Mastery Skill" type pill beside the name (the
            shared name flag, orange). Only a real Mastery Skill's group row
            has it — not the Unlinked pseudo-group, and not the flat rows of
            the Mastery-Skills-only view, where every row is one. */}
        {/* Archived (1126:1704) swaps the type pill for the grey "Archived" one. */}
        {archived
          ? <span className="pr-name-flag pr-name-flag--grey">Archived</span>
          : m && !flat && <span className="pr-name-flag pr-name-flag--accent">Mastery Skill</span>}
      </td>
      {cols.map((c) => (
        <td key={c.key} className={c.className}>{m ? c.renderGroup?.(m) : null}</td>
      ))}
      {m ? <RowActions onEdit={onEdit} onMenu={onMenu} editTitle="Edit Mastery Skill" /> : <td className="col-actions" />}
    </tr>
  );
}

/* Child row (Figma 1119:1561): the standard row, with the name indented past
   the group row's caret slot. `indented` is off when Skills are listed on
   their own (Type = Skills) — no groups, so nothing to sit under.
   `alsoIn`: the OTHER Mastery Skills this Skill rolls up into — the row is
   repeated under each, and the yellow "Also in …" flag (the shared Table
   Pills - Yellow name flag) says so. Only meaningful under a group. */
function SkillRow({
  skill, indented, alsoIn, cols, onEdit, onMenu, menuOpen,
}: {
  skill: Skill;
  indented: boolean;
  alsoIn: string[];
  cols: Col[];
  onEdit: () => void;
  onMenu: (rect: DOMRect) => void;
  /** This row's 3-dot menu is open — hold the hover treatment. */
  menuOpen: boolean;
}) {
  const archived = skill.status === "Archived";
  return (
    <tr className={`skg-row ${indented ? "skg-child" : ""} ${archived ? "skg-archived" : ""} ${menuOpen ? "menu-open" : ""}`}>
      <td className="col-name">
        <span className="skg-name" data-tip={skill.name}>{skill.name}</span>
        {/* Archived (1126:1686): grey pill, muted name, dimmed list columns —
            `.skg-archived`, not the shared 50%-opacity `task-hidden`. */}
        {archived && <span className="pr-name-flag pr-name-flag--grey">Archived</span>}
        {/* Same hover contract as the "+N" list cells: `data-tip`, one Mastery
            Skill per line, and none when the single name is already spelled
            out in the flag itself. */}
        {alsoIn.length > 0 && (
          <span className="pr-name-flag" data-tip={listTip(alsoIn)}>
            Also in {alsoIn[0]}{alsoIn.length > 1 ? ` +${alsoIn.length - 1}` : ""}
          </span>
        )}
      </td>
      {cols.map((c) => (
        <td key={c.key} className={c.className} data-tip={c.tip?.(skill)} data-tip-head={c.tipHead?.(skill)}>{c.render(skill)}</td>
      ))}
      <RowActions onEdit={onEdit} onMenu={onMenu} editTitle="Edit Skill" />
    </tr>
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
  col, label, className, sort, toggle, sortable = true, lead,
}: {
  col: string;
  label: string;
  className?: string;
  sort: { key: string; dir: SortDir };
  toggle: (k: string) => void;
  sortable?: boolean;
  /** Something before the label (the Name header's group toggle). */
  lead?: React.ReactNode;
}) {
  if (!sortable) {
    return (
      <th className={`${className ?? ""} no-sort`.trim()}>
        <span className="th-content">{lead}{label}</span>
      </th>
    );
  }
  const active = sort.key === col;
  return (
    <th className={className} onClick={() => toggle(col)}>
      <span className="th-content">
        {lead}
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
   aria-label. */

function ActionsMenu({
  rect, archived, noun, onClose, onArchive, onEdit, onDelete,
}: {
  rect: DOMRect;
  archived: boolean;
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

  return (
    <div
      ref={ref}
      className="u-menu"
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
      {item(<MenuArchiveOffIcon />, archived ? "Unarchive" : "Archive", onArchive)}
      {item(<RowDeleteIcon />, "Delete", onDelete, true)}
    </div>
  );
}

/* ─────────────── Confirm modal ───────────────
   The shared shell (PrmModal, Figma 667:884 "General Modal"): body copy is
   plain white 16px in the `.prm-content` slot — no page-local text class —
   and any warning is the design-system `.note-card`. */

/** The linked-Mastery-Skills callout — `.note-card` (Figma 1121:1671) with the
    affected names as its last line. */
function LinkedMasteryNote({ title, linked, children }: { title: string; linked: MasterySkill[]; children: React.ReactNode }) {
  return (
    <div className="note-card">
      <span className="note-card-icon"><AlertCircleFilledIcon /></span>
      <div className="note-card-text">
        <p className="note-card-title">{title}</p>
        <p className="note-card-body">{children}</p>
        <p className="note-card-body"><strong>{linked.map((m) => m.name).join(", ")}</strong></p>
      </div>
    </div>
  );
}


function ConfirmModal({
  title, confirmLabel, danger = false, children, onCancel, onConfirm,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  children: React.ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <PrmModal
      title={title}
      confirmLabel={confirmLabel}
      danger={danger}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <div className="prm-content skg-modal-content">{children}</div>
    </PrmModal>
  );
}

/* ─────────────── Filters ─────────────── */

function StatusPill({ value, onApply }: { value: string[]; onApply: (v: string[]) => void }) {
  const summary = summarize(value, SKILL_STATUSES);
  return (
    <Dropdown
      width={200}
      trigger={({ open, toggle }) => (
        <PillTrigger label="Status" value={summary} open={open} toggle={toggle} onClear={() => onApply([])} tip={TIPS.status} />
      )}
    >
      {({ close }) => (
        <SectionedMultiSelect
          sections={[{ items: [...SKILL_STATUSES] }]}
          value={value}
          onApply={(v) => { onApply(v); close(); }}
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
