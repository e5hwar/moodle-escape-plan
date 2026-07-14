export type ContentKind = "Course" | "Certification" | "Task";
export type Level = "Beginner" | "Intermediate" | "Advanced";
export type LinkKind = "prerequisite" | "recommended" | "related";

export type ContentNode = {
  id: string;
  name: string;
  kind: ContentKind;
  level: Level;
  tasksCount: number;
  enrolled?: number;
  industry?: string;
};

export type Link = {
  from: string;
  to: string;
  kind: LinkKind;
  strength: number;
};

export const nodes: ContentNode[] = [
  { id: "n-drb", name: "Domestic Refrigerators Basics", kind: "Course", level: "Beginner", tasksCount: 12, enrolled: 25, industry: "HVAC › Residential" },
  { id: "n-tm", name: "Temperature Measurements", kind: "Course", level: "Beginner", tasksCount: 8, enrolled: 142, industry: "HVAC" },
  { id: "n-brc", name: "Basic Refrigeration Concepts", kind: "Course", level: "Beginner", tasksCount: 10, enrolled: 318, industry: "HVAC" },
  { id: "n-rtb", name: "Refrig. Troubleshooting", kind: "Course", level: "Intermediate", tasksCount: 15, enrolled: 64, industry: "HVAC › Residential" },
  { id: "n-cr", name: "Commercial Refrigeration", kind: "Course", level: "Intermediate", tasksCount: 20, enrolled: 41, industry: "HVAC › Commercial" },
  { id: "n-dwb", name: "Dishwasher Basics", kind: "Course", level: "Beginner", tasksCount: 10, enrolled: 88, industry: "Appliances" },
  { id: "n-dyb", name: "Dryers Basics", kind: "Course", level: "Beginner", tasksCount: 9, enrolled: 73, industry: "Appliances" },

  { id: "n-epa608", name: "EPA 608 Universal", kind: "Certification", level: "Advanced", tasksCount: 13, enrolled: 1240, industry: "HVAC" },
  { id: "n-epa1", name: "EPA 608 Type I", kind: "Certification", level: "Intermediate", tasksCount: 5, enrolled: 612, industry: "HVAC › Residential" },
  { id: "n-epa2", name: "EPA 608 Type II", kind: "Certification", level: "Intermediate", tasksCount: 5, enrolled: 524, industry: "HVAC › Commercial" },
  { id: "n-nate", name: "NATE Ready-to-Work", kind: "Certification", level: "Beginner", tasksCount: 9, enrolled: 980, industry: "HVAC" },
  { id: "n-safety", name: "Refrigerant Safety Bundle", kind: "Certification", level: "Beginner", tasksCount: 7, enrolled: 410, industry: "HVAC › Residential" },
  { id: "n-osha10", name: "OSHA 10 — General Industry", kind: "Certification", level: "Beginner", tasksCount: 6, enrolled: 2230, industry: "Safety" },
  { id: "n-braze", name: "Brazing Fundamentals", kind: "Certification", level: "Beginner", tasksCount: 4, enrolled: 188, industry: "Welding" },
  { id: "n-fork", name: "Forklift Operator", kind: "Certification", level: "Beginner", tasksCount: 3, enrolled: 1605, industry: "Warehouse" },

  // The remaining catalog Certifications. Each has a node here so the Content
  // Links page can focus it (by name — see certToFocusNode in App.tsx) and so it
  // can be picked as a link target. Names must match certifications.ts exactly.
  { id: "n-epa3", name: "EPA 608 Type III", kind: "Certification", level: "Advanced", tasksCount: 5, enrolled: 372, industry: "HVAC › Commercial" },
  { id: "n-hfs", name: "HVAC Field Skills", kind: "Certification", level: "Intermediate", tasksCount: 11, enrolled: 458, industry: "HVAC" },
  { id: "n-plumb1", name: "Plumbing Apprentice Year 1", kind: "Certification", level: "Beginner", tasksCount: 18, enrolled: 214, industry: "Plumbing" },
  { id: "n-ecr", name: "Electrical Code Refresher", kind: "Certification", level: "Intermediate", tasksCount: 8, enrolled: 331, industry: "Electrical" },
  { id: "n-solar", name: "Solar PV Installer Basics", kind: "Certification", level: "Beginner", tasksCount: 12, enrolled: 276, industry: "Solar & Renewables › Solar PV" },
  { id: "n-wip", name: "Welding Inspector Prep", kind: "Certification", level: "Advanced", tasksCount: 10, enrolled: 129, industry: "Welding" },
  { id: "n-hps", name: "Heat Pump Specialist (2026)", kind: "Certification", level: "Intermediate", tasksCount: 9, enrolled: 87, industry: "HVAC › Residential" },
  { id: "n-ars", name: "ARS Onboarding Path", kind: "Certification", level: "Beginner", tasksCount: 7, enrolled: 156, industry: "HVAC" },
  { id: "n-nextech", name: "NexTech Field Readiness", kind: "Certification", level: "Intermediate", tasksCount: 6, enrolled: 98, industry: "HVAC › Commercial" },
  { id: "n-premium", name: "Premium HVAC Install Standards", kind: "Certification", level: "Intermediate", tasksCount: 5, enrolled: 64, industry: "HVAC › Residential" },
  { id: "n-hvacr", name: "HVACR Safety Refresher", kind: "Certification", level: "Beginner", tasksCount: 4, enrolled: 142, industry: "OSHA & Safety › General Industry" },
];

export function nodeIdForName(name: string): string | undefined {
  return nodes.find((n) => n.name === name)?.id;
}

export const links: Link[] = [
  // Domestic Refrigerators Basics
  { from: "n-tm", to: "n-drb", kind: "prerequisite", strength: 80 },
  { from: "n-brc", to: "n-drb", kind: "prerequisite", strength: 65 },
  { from: "n-drb", to: "n-rtb", kind: "recommended", strength: 95 },
  { from: "n-drb", to: "n-cr", kind: "recommended", strength: 60 },
  { from: "n-drb", to: "n-dwb", kind: "related", strength: 75 },
  { from: "n-drb", to: "n-dyb", kind: "related", strength: 70 },

  // EPA 608 Universal — prereqs and onward
  { from: "n-brc", to: "n-epa608", kind: "prerequisite", strength: 90 },
  { from: "n-safety", to: "n-epa608", kind: "prerequisite", strength: 70 },
  { from: "n-epa608", to: "n-epa1", kind: "recommended", strength: 85 },
  { from: "n-epa608", to: "n-epa2", kind: "recommended", strength: 85 },
  { from: "n-epa608", to: "n-nate", kind: "related", strength: 55 },

  // Refrigeration Troubleshooting onward
  { from: "n-rtb", to: "n-cr", kind: "recommended", strength: 80 },
  { from: "n-rtb", to: "n-epa1", kind: "recommended", strength: 60 },

  // OSHA 10 — generic safety prereq for several
  { from: "n-osha10", to: "n-nate", kind: "prerequisite", strength: 40 },
  { from: "n-osha10", to: "n-fork", kind: "prerequisite", strength: 75 },

  // Brazing
  { from: "n-brc", to: "n-braze", kind: "prerequisite", strength: 50 },
  { from: "n-braze", to: "n-epa2", kind: "recommended", strength: 65 },

  // ─── Extended catalog links ──────────────────────────────────────────────
  // Authored so every Certification shows populated Prerequisite / Recommended /
  // Related columns when focused (not just inbound "Referenced by" chips).

  // Refrigerant Safety Bundle — entry-level safety feeding the EPA ladder.
  { from: "n-osha10", to: "n-safety", kind: "prerequisite", strength: 45 },
  { from: "n-safety", to: "n-epa1", kind: "recommended", strength: 65 },
  { from: "n-safety", to: "n-nate", kind: "recommended", strength: 55 },
  { from: "n-safety", to: "n-braze", kind: "related", strength: 40 },

  // EPA 608 Type I / II / III progression.
  { from: "n-brc", to: "n-epa1", kind: "prerequisite", strength: 60 },
  { from: "n-epa1", to: "n-epa2", kind: "recommended", strength: 75 },
  { from: "n-epa1", to: "n-epa3", kind: "related", strength: 55 },
  { from: "n-safety", to: "n-epa2", kind: "prerequisite", strength: 60 },
  { from: "n-epa2", to: "n-epa3", kind: "recommended", strength: 70 },
  { from: "n-epa2", to: "n-hfs", kind: "related", strength: 60 },
  { from: "n-safety", to: "n-epa3", kind: "prerequisite", strength: 55 },
  { from: "n-cr", to: "n-epa3", kind: "prerequisite", strength: 65 },
  { from: "n-epa3", to: "n-hfs", kind: "recommended", strength: 50 },
  { from: "n-epa3", to: "n-nextech", kind: "related", strength: 45 },

  // NATE + HVAC Field Skills hub.
  { from: "n-nate", to: "n-hfs", kind: "recommended", strength: 60 },
  { from: "n-brc", to: "n-hfs", kind: "prerequisite", strength: 55 },
  { from: "n-rtb", to: "n-hfs", kind: "prerequisite", strength: 60 },
  { from: "n-hfs", to: "n-epa608", kind: "recommended", strength: 70 },
  { from: "n-hfs", to: "n-premium", kind: "related", strength: 50 },

  // Brazing → Welding Inspector.
  { from: "n-braze", to: "n-wip", kind: "prerequisite", strength: 65 },
  { from: "n-braze", to: "n-hvacr", kind: "related", strength: 30 },

  // OSHA 10 as a broad safety prerequisite across trades.
  { from: "n-osha10", to: "n-hvacr", kind: "recommended", strength: 70 },
  { from: "n-osha10", to: "n-solar", kind: "prerequisite", strength: 45 },
  { from: "n-osha10", to: "n-plumb1", kind: "prerequisite", strength: 40 },
  { from: "n-osha10", to: "n-ecr", kind: "prerequisite", strength: 45 },
  { from: "n-osha10", to: "n-ars", kind: "prerequisite", strength: 50 },
  { from: "n-osha10", to: "n-nextech", kind: "prerequisite", strength: 45 },

  // Forklift.
  { from: "n-fork", to: "n-nextech", kind: "recommended", strength: 45 },
  { from: "n-fork", to: "n-solar", kind: "related", strength: 30 },

  // Plumbing.
  { from: "n-plumb1", to: "n-hvacr", kind: "recommended", strength: 35 },
  { from: "n-plumb1", to: "n-solar", kind: "related", strength: 30 },

  // Electrical → Solar.
  { from: "n-ecr", to: "n-solar", kind: "recommended", strength: 60 },
  { from: "n-ecr", to: "n-hvacr", kind: "related", strength: 40 },

  // Solar.
  { from: "n-solar", to: "n-nextech", kind: "recommended", strength: 30 },

  // Welding Inspector.
  { from: "n-wip", to: "n-nextech", kind: "recommended", strength: 35 },
  { from: "n-wip", to: "n-ecr", kind: "related", strength: 30 },

  // Heat Pump Specialist (2026).
  { from: "n-hfs", to: "n-hps", kind: "prerequisite", strength: 60 },
  { from: "n-epa608", to: "n-hps", kind: "prerequisite", strength: 55 },
  { from: "n-hps", to: "n-nextech", kind: "recommended", strength: 50 },
  { from: "n-hps", to: "n-premium", kind: "related", strength: 65 },
  { from: "n-hps", to: "n-epa1", kind: "related", strength: 40 },

  // ARS Onboarding Path (company).
  { from: "n-ars", to: "n-nate", kind: "recommended", strength: 60 },
  { from: "n-ars", to: "n-hfs", kind: "recommended", strength: 55 },
  { from: "n-ars", to: "n-nextech", kind: "related", strength: 45 },

  // NexTech Field Readiness (company).
  { from: "n-cr", to: "n-nextech", kind: "prerequisite", strength: 55 },
  { from: "n-nextech", to: "n-premium", kind: "recommended", strength: 50 },

  // Premium HVAC Install Standards (company).
  { from: "n-epa1", to: "n-premium", kind: "prerequisite", strength: 45 },
  { from: "n-nate", to: "n-premium", kind: "prerequisite", strength: 40 },
  { from: "n-premium", to: "n-epa2", kind: "recommended", strength: 40 },

  // HVACR Safety Refresher (company).
  { from: "n-safety", to: "n-hvacr", kind: "prerequisite", strength: 40 },
  { from: "n-nate", to: "n-hvacr", kind: "prerequisite", strength: 35 },
  { from: "n-hvacr", to: "n-hfs", kind: "recommended", strength: 45 },
];
