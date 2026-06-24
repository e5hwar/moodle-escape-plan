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

export const DISCOVERABLE_OPTIONS = ["Discoverable", "Not discoverable"];

export const FINAL_EXAM_OPTIONS = ["Final Exam", "Not Final Exam"];

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

export type OptionalColumn =
  | "id"
  | "type"
  | "paid"
  | "usedIn"
  | "createdBy"
  | "tags"
  | "dateCreated"
  | "dateModified";

export const OPTIONAL_COLUMNS: { key: OptionalColumn; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "type", label: "Type" },
  { key: "paid", label: "Paid" },
  { key: "usedIn", label: "Used in" },
  { key: "createdBy", label: "Created By" },
  { key: "tags", label: "Tags" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];

/** Columns that always render (no toggle). */
export const FIXED_COLUMNS: { label: string }[] = [{ label: "Name" }];
