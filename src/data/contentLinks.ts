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
];

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
];
