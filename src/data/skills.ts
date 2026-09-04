import { tasks, type Task } from "./tasks";

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
  /** Emoji glyph used as the badge artwork in this prototype. */
  image: string;
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
  image: string;
  /** Constituent Skills — all must be held for the Mastery Skill to be awarded. */
  skillIds: string[];
  createdBy: string;
  holders: number;
  dateCreated: string;
  dateModified: string;
};

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
  image,
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
  S("SK-105", "Vacuum & Evacuation", "🫧", ["T-1821"], "all", 651, "Jul 02, 2025", "Apr 03, 2026", {
    nameEs: "Vacío y evacuación",
  }),
  S("SK-106", "Superheat & Subcooling", "📈", ["T-1689", "T-1722"], "all", 498, "Aug 04, 2025", "Apr 18, 2026", {
    nameEs: "Sobrecalentamiento y subenfriamiento",
    description: "Reads and interprets superheat and subcooling to verify a correct charge.",
  }),
  S("SK-107", "Electrical Safety Basics", "⚡", ["T-2024", "T-0987"], "any", 1455, "Apr 12, 2025", "Apr 16, 2026", {
    nameEs: "Conceptos básicos de seguridad eléctrica",
    description: "Understands lockout/tagout and safe work practices around live circuits.",
  }),
  S("SK-108", "Capacitor Replacement", "🔋", ["T-2132"], "all", 372, "Apr 01, 2025", "Apr 21, 2026", {
    nameEs: "Reemplazo de capacitor",
  }),
  S("SK-109", "Combustion Analysis", "🔬", ["T-1955"], "all", 207, "May 14, 2025", "Apr 02, 2026", {
    nameEs: "Análisis de combustión",
    description: "Performs combustion analysis on gas-fired equipment and interprets readings.",
  }),
  S("SK-110", "Furnace Ignition Repair", "🔧", ["T-1088", "T-1055"], "all", 289, "Feb 09, 2026", "Apr 25, 2026", {
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
  image,
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
  M("MS-02", "HVAC Field Readiness", "🎖️", ["SK-101", "SK-106", "SK-112"], 268, "Apr 02, 2024", "Apr 28, 2026", {
    nameEs: "Preparación para el campo HVAC",
    description: "Recognizes hands-on readiness across brazing, charge verification, and airflow.",
  }),
  M("MS-03", "Electrical Competency", "⚙️", ["SK-107", "SK-108"], 531, "Apr 12, 2025", "Apr 21, 2026", {
    nameEs: "Competencia eléctrica",
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

/** Number rendered with thousands separators. */
export function fmtHolders(n: number): string {
  return n.toLocaleString();
}
