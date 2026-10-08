import { tasks, type Task } from "./tasks";
import type { PickedImage } from "../components/ImageUploadField";
import { seededInt } from "../components/PreviewPanel";

// ─────────────────────────────────────────────────────────────────────────────
// Skills & Mastery Skills (spec §11)
//
// A Skill is awarded for completing one Task or a set of Tasks. A Mastery Skill
// is a rollup awarded when a user holds all of its constituent Skills. Skills
// live outside the content hierarchy — they are a parallel recognition system.
//
// V1 metadata common to both: Name + Description (EN/ES), Status (Active or
// Archived), and an Image (the system auto-generates a greyed-out "incomplete"
// variant). There is no Hidden status.
// ─────────────────────────────────────────────────────────────────────────────

export type SkillStatus = "Active" | "Archived";

/** When a Skill maps to multiple Tasks, awarding fires on ANY one or ALL. */
export type AwardRule = "any" | "all";

export type Skill = {
  id: string;
  name: string;
  nameEs?: string;
  description?: string;
  descriptionEs?: string;
  status: SkillStatus;
  /** The uploaded icon (required). Seed records carry an emoji drawn as an
   *  SVG, as if it had been uploaded through the icon field. */
  image: PickedImage;
  /** Tasks whose completion contributes to this Skill. */
  taskIds: string[];
  /** Only meaningful when taskIds.length > 1. */
  rule: AwardRule;
  createdBy: string;
  /** Users who currently hold this Skill. */
  holders: number;
  dateCreated: string;
  dateModified: string;
};

export type MasterySkill = {
  id: string;
  name: string;
  nameEs?: string;
  description?: string;
  descriptionEs?: string;
  status: SkillStatus;
  image: PickedImage;
  /** Constituent Skills — all must be held for the Mastery Skill to be awarded. */
  skillIds: string[];
  createdBy: string;
  holders: number;
  dateCreated: string;
  dateModified: string;
};

/** A seed emoji as an uploaded SVG icon, named after its record. */
function seedIcon(name: string, emoji: string): PickedImage {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">` +
    `<text x="24" y="26" font-size="34" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  const file = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { name: `${file}.svg`, size: 0, ext: "SVG", url: `data:image/svg+xml,${encodeURIComponent(svg)}` };
}

const S = (
  id: string,
  name: string,
  image: string,
  taskIds: string[],
  rule: AwardRule,
  holders: number,
  dateCreated: string,
  dateModified: string,
  extra: Partial<Skill> = {},
): Skill => ({
  id,
  name,
  image: seedIcon(name, image),
  taskIds,
  rule,
  holders,
  createdBy: "SkillCat",
  status: "Active",
  dateCreated,
  dateModified,
  ...extra,
});

export const skills: Skill[] = [
  S("SK-101", "Brazing & Soldering", "🔥", ["T-1432"], "all", 312, "Mar 04, 2024", "Apr 28, 2026", {
    nameEs: "Soldadura fuerte y blanda",
    description: "Demonstrated ability to braze and solder joints to field-quality standards.",
  }),
  S("SK-102", "Refrigerant Recovery", "♻️", ["T-1042", "T-1855"], "all", 1289, "Mar 04, 2024", "Apr 22, 2026", {
    nameEs: "Recuperación de refrigerante",
    description: "Safely recovers refrigerant using a recovery machine per EPA 608 procedures.",
  }),
  S("SK-103", "Refrigerant Charging", "🌡️", ["T-2350"], "all", 884, "Feb 11, 2025", "Apr 15, 2026", {
    nameEs: "Carga de refrigerante",
  }),
  S("SK-104", "Manifold Gauge Use", "📊", ["T-1788"], "all", 1042, "Jul 14, 2025", "Apr 05, 2026", {
    nameEs: "Uso del manómetro de colector",
  }),
  S("SK-105", "Vacuum & Evacuation", "🫧", ["T-1810"], "all", 651, "Jul 02, 2025", "Apr 03, 2026", {
    nameEs: "Vacío y evacuación",
  }),
  S("SK-106", "Superheat & Subcooling", "📈", ["T-1722", "T-2350"], "all", 498, "Aug 04, 2025", "Apr 18, 2026", {
    nameEs: "Sobrecalentamiento y subenfriamiento",
    description: "Reads and interprets superheat and subcooling to verify a correct charge.",
  }),
  S("SK-107", "Electrical Safety Basics", "⚡", ["T-2020", "T-0987"], "any", 1455, "Apr 12, 2025", "Apr 16, 2026", {
    nameEs: "Conceptos básicos de seguridad eléctrica",
    description: "Understands lockout/tagout and safe work practices around live circuits.",
  }),
  S("SK-108", "Compressor Replacement", "🛠️", ["T-1930"], "all", 372, "Apr 01, 2025", "Apr 21, 2026", {
    nameEs: "Reemplazo de compresor",
  }),
  S("SK-109", "Indoor Air Quality Testing", "🔬", ["T-1989"], "all", 207, "May 14, 2025", "Apr 02, 2026", {
    nameEs: "Pruebas de calidad del aire interior",
    description: "Tests indoor air quality around gas-fired equipment and interprets the readings.",
  }),
  S("SK-110", "Furnace Ignition Repair", "🔧", ["T-1610"], "all", 289, "Feb 09, 2026", "Apr 25, 2026", {
    nameEs: "Reparación de encendido de horno",
  }),
  S("SK-111", "OSHA 10 Safety", "🦺", ["T-0987"], "all", 1876, "Nov 18, 2023", "Jan 11, 2026", {
    nameEs: "Seguridad OSHA 10",
    status: "Archived",
    description: "Completed the OSHA 10 general-industry safety course.",
  }),
  S("SK-112", "Airflow Balancing", "💨", ["T-2061"], "all", 433, "Apr 10, 2025", "Apr 24, 2026", {
    nameEs: "Equilibrio de flujo de aire",
  }),
  // SK-113 – SK-116 belong to no Mastery Skill: they populate "Unlinked Skills".
  S("SK-113", "Thermostat Wiring", "🔌", ["T-2165"], "all", 618, "Mar 22, 2025", "Apr 11, 2026", {
    nameEs: "Cableado de termostato",
    description: "Wires a low-voltage thermostat and verifies call-for-heat and call-for-cool.",
  }),
  S("SK-114", "Leak Detection", "🔍", ["T-1690", "T-1788"], "any", 254, "Mar 02, 2025", "Apr 18, 2026", {
    nameEs: "Detección de fugas",
  }),
  S("SK-115", "Pipe Joining", "🔩", ["T-1555", "T-1488"], "all", 391, "Oct 02, 2025", "Apr 17, 2026", {
    nameEs: "Unión de tuberías",
    description: "Joins PVC and soldered copper supply lines to code with leak-free connections.",
  }),
  S("SK-116", "Tankless Heater Install", "🚿", ["T-1321"], "all", 176, "Feb 01, 2026", "Apr 19, 2026", {
    nameEs: "Instalación de calentador sin tanque",
  }),
];

const M = (
  id: string,
  name: string,
  image: string,
  skillIds: string[],
  holders: number,
  dateCreated: string,
  dateModified: string,
  extra: Partial<MasterySkill> = {},
): MasterySkill => ({
  id,
  name,
  image: seedIcon(name, image),
  skillIds,
  holders,
  createdBy: "SkillCat",
  status: "Active",
  dateCreated,
  dateModified,
  ...extra,
});

export const masterySkills: MasterySkill[] = [
  M("MS-01", "EPA 608 Mastery", "🏅", ["SK-102", "SK-103", "SK-104", "SK-105"], 412, "Mar 10, 2024", "Apr 22, 2026", {
    nameEs: "Maestría EPA 608",
    description: "Awarded when a technician holds every core refrigerant-handling Skill.",
  }),
  // SK-104 is also in MS-01 — the one seed Skill shared by two Mastery Skills,
  // which exercises the Skills table's "Also in …" flag.
  // SK-107 Electrical Safety Basics sits in THREE Mastery Skills (MS-02, MS-03,
  // MS-04) — safety fundamentals every trade requires, and the one seed Skill
  // that exercises the "+N" on the Skills table's "Also in …" flag.
  M("MS-02", "HVAC Field Readiness", "🎖️", ["SK-101", "SK-106", "SK-112", "SK-104", "SK-107"], 268, "Apr 02, 2024", "Apr 28, 2026", {
    nameEs: "Preparación para el campo HVAC",
    description: "Recognizes hands-on readiness across brazing, charge verification, and airflow.",
  }),
  M("MS-03", "Electrical Competency", "⚙️", ["SK-107", "SK-108"], 298, "Apr 12, 2025", "Apr 21, 2026", {
    nameEs: "Competencia eléctrica",
  }),
  // The one archived Mastery Skill — exercises the archived group row.
  M("MS-04", "Gas Furnace Service", "🔥", ["SK-109", "SK-110", "SK-107"], 143, "Sep 03, 2024", "Feb 14, 2026", {
    nameEs: "Servicio de hornos de gas",
    status: "Archived",
    description: "Retired rollup for furnace diagnostics; superseded by the HVAC Field Readiness track.",
  }),
];

// ─── Filter option constants ──────────────────────────────────────────────────
export const SKILL_STATUSES: SkillStatus[] = ["Active", "Archived"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tasksById: Record<string, Task> = Object.fromEntries(
  tasks.map((t) => [t.id, t]),
);

export function taskById(id: string): Task | undefined {
  return tasksById[id];
}

const skillsById: Record<string, Skill> = Object.fromEntries(
  skills.map((s) => [s.id, s]),
);

export function skillById(id: string): Skill | undefined {
  return skillsById[id];
}

/** Mastery Skills that include the given Skill in their criteria. */
export function masteryUsing(
  skillId: string,
  list: MasterySkill[] = masterySkills,
): MasterySkill[] {
  return list.filter((m) => m.skillIds.includes(skillId));
}

/** The Mastery Skills that stop this Skill being archived or deleted — every
 *  Mastery Skill that lists it, archived or not. An archived Mastery Skill can
 *  be unarchived later, so the admin removes the Skill from its criteria first. */
export function blockingMastery(
  skillId: string,
  list: MasterySkill[] = masterySkills,
): MasterySkill[] {
  return masteryUsing(skillId, list);
}

/** Short, human-readable summary of a Skill's awarding criteria. */
export function criteriaSummary(skill: Skill): string {
  const n = skill.taskIds.length;
  if (n === 0) return "No Tasks";
  if (n === 1) return "1 Task";
  return `${n} Tasks · ${skill.rule === "all" ? "All" : "Any"}`;
}

/** All/Any rule for a Skill's awarding criteria — only meaningful with 2+ Tasks. */
export function criteriaRule(skill: Skill): string {
  if (skill.taskIds.length <= 1) return "";
  return skill.rule === "all" ? "All" : "Any";
}

/* ─── Holders on save ───
   The prototype keeps no per-user completion records, so a Task's completers
   are the figure its preview panel shows (attempts × pass rate for a graded
   Task, completions otherwise — the same seeded numbers as TasksPage), and the
   users who finish more are taken to be the same users. The sets nest: "any"
   reaches the largest Task's completers, "all" the smallest, and a Mastery
   Skill the fewest holders among its Skills. */
function taskCompleters(id: string): number {
  const t = taskById(id);
  if (!t) return 0;
  const graded = t.type === "Quiz" || t.type === "Hands-On Task";
  const attempts = seededInt(t.id, "attempts", 90, 5200);
  const rate = seededInt(t.id, "rate", graded ? 58 : 70, graded ? 92 : 97);
  return graded ? Math.round((attempts * rate) / 100) : attempts;
}

/** Users who already satisfy a Skill's rule — awarded the moment it's saved. */
export function qualifyingSkillHolders(taskIds: string[], rule: AwardRule): number {
  const counts = taskIds.map(taskCompleters);
  if (counts.length === 0) return 0;
  return rule === "any" ? Math.max(...counts) : Math.min(...counts);
}

/** Users who already hold every one of a Mastery Skill's Skills. */
export function qualifyingMasteryHolders(skillIds: string[], all: Skill[]): number {
  const counts = skillIds.map((id) => all.find((s) => s.id === id)?.holders ?? 0);
  return counts.length ? Math.min(...counts) : 0;
}

/** The next free id after the highest in use ("SK-116" → "SK-117"), so a
    create after a delete never reuses — and overwrites — a live record. */
export function nextRecordId(prefix: "SK" | "MS", ids: string[], pad: number): string {
  const max = ids.reduce((n, id) => {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Today in the seed's "Apr 05, 2026" shape — stamped on create, edit, archive
    and unarchive. */
export function skillDateToday(): string {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`;
}

/** Number rendered with thousands separators. */
export function fmtHolders(n: number): string {
  return n.toLocaleString();
}
