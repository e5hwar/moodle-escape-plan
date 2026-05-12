export const CREATED_BY_IN_HOUSE = ["SkillCat"];

export const CREATED_BY_B2B = [
  "ARS",
  "HVACR",
  "NexTech",
  "Premium HVAC Services",
];

export const CERTIFICATIONS = [
  "EPA 608 Type I",
  "EPA 608 Type II",
  "EPA 608 Type III",
  "EPA 608 Universal",
  "HVAC Field Skills",
  "NATE RTW",
  "OSHA 10",
  "OSHA 30",
  "Safety Bundle",
];

export const TASK_TYPES = [
  "xAPI",
  "Quiz",
  "Hands-On Task",
  "ID-Upload",
  "File",
  "Deep Link",
  "URL",
];

export const VISIBILITIES = ["Hidden", "Visible"];

export const TAG_GROUPS: { label: string; tags: string[] }[] = [
  { label: "USER TYPE", tags: ["All-User", "B2B-Only"] },
  { label: "PARTNERSHIP", tags: ["NexStar", "HVACR"] },
  {
    label: "TRADE",
    tags: [
      "Residential HVAC",
      "Commercial HVAC",
      "Residential Plumbing",
      "Commercial Plumbing",
      "MultiFamily Maintenance",
      "Hotel Maintenance",
    ],
  },
];

export type OptionalColumn = "tags" | "dateCreated" | "dateModified";

export const OPTIONAL_COLUMNS: { key: OptionalColumn; label: string }[] = [
  { key: "tags", label: "Tags" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];
