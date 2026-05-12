export type Certification = {
  id: string;
  name: string;
  industry: string;
  ceus: string;
  tasks: number;
  createdBy: string;
  draft?: boolean;
  dateCreated?: string;
  dateModified?: string;
  visibility?: "Visible" | "Hidden" | "Archived";
};

const C = (
  id: string,
  name: string,
  industry: string,
  ceus: string,
  tasks: number,
  createdBy: string,
  dateCreated: string,
  dateModified: string,
  extra: Partial<Certification> = {},
): Certification => ({
  id,
  name,
  industry,
  ceus,
  tasks,
  createdBy,
  dateCreated,
  dateModified,
  visibility: "Visible",
  ...extra,
});

export const certifications: Certification[] = [
  C("C-0421", "EPA 608 Universal", "HVAC", "2.4", 13, "SkillCat", "Mar 04, 2024", "Apr 28, 2026"),
  C("C-0420", "EPA 608 Type I", "HVAC › Residential", "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026"),
  C("C-0419", "EPA 608 Type II", "HVAC › Commercial", "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026"),
  C("C-0418", "EPA 608 Type III", "HVAC › Commercial", "0.8", 5, "SkillCat", "Mar 04, 2024", "Mar 18, 2026"),
  C("C-0410", "NATE Ready-to-Work", "HVAC", "1.6", 9, "SkillCat", "Feb 12, 2024", "Apr 14, 2026"),
  C("C-0405", "Refrigerant Safety Bundle", "HVAC › Residential", "1.2", 7, "SkillCat", "Jan 20, 2024", "Apr 02, 2026"),
  C("C-0398", "HVAC Field Skills", "HVAC", "2.0", 11, "SkillCat", "Jan 08, 2024", "Mar 30, 2026"),
  C("C-0376", "Brazing Fundamentals", "Welding", "0.6", 4, "SkillCat", "Nov 14, 2023", "Feb 22, 2026"),
  C("C-0341", "OSHA 10 — General Industry", "Safety", "1.0", 6, "SkillCat", "Sep 02, 2023", "Jan 11, 2026"),
  C("C-0322", "Plumbing Apprentice Year 1", "Plumbing", "3.2", 18, "SkillCat", "Jul 21, 2023", "Dec 04, 2025"),
  C("C-0298", "Electrical Code Refresher", "Electrical", "1.4", 8, "SkillCat", "May 30, 2023", "Nov 18, 2025"),
  C("C-0265", "Forklift Operator", "Warehouse", "0.5", 3, "SkillCat", "Mar 12, 2023", "Oct 08, 2025"),
  C("C-0242", "Solar PV Installer Basics", "Renewables", "2.2", 12, "SkillCat", "Jan 18, 2023", "Sep 12, 2025"),
  C("C-0221", "Welding Inspector Prep", "Welding", "1.8", 10, "SkillCat", "Dec 02, 2022", "Aug 21, 2025"),
  C("C-0612", "Heat Pump Specialist (2026)", "HVAC › Residential", "1.6", 9, "SkillCat", "Apr 02, 2026", "Apr 28, 2026", { draft: true }),
];
