export type TaskType = "xAPI" | "Quiz" | "ID Upload" | "Hands-On Task" | "File" | "URL";

export type Task = {
  id: string;
  name: string;
  type: TaskType;
  usedIn: string[];
  createdBy: string;
  draft?: boolean;
  description?: string;
  updated?: string;
  visibility?: string;
  tags?: string[];
  timeToComplete?: string;
  submissions?: string;
  requirements?: string;
  skills?: { icon: string; name: string }[];
  dateCreated?: string;
  dateModified?: string;
};

const T = (
  id: string,
  name: string,
  type: TaskType,
  usedIn: string[],
  createdBy: string,
  tags: string[],
  dateCreated: string,
  dateModified: string,
  extra: Partial<Task> = {},
): Task => ({ id, name, type, usedIn, createdBy, tags, dateCreated, dateModified, ...extra });

export const tasks: Task[] = [
  T("T-2104", "Tool Inventory Photo", "Hands-On Task", [], "SkillCat", [], "Apr 25, 2026", "Apr 25, 2026", { draft: true }),
  T("T-1876", "EPA Certification Lookup", "URL", ["EPA 608 Type I"], "SkillCat", ["All-User"], "Feb 21, 2024", "Apr 03, 2026"),
  T("T-1654", "HVAC Field Tools Walkthrough", "xAPI",
    ["HVAC Field Skills", "EPA 608 Type I", "EPA 608 Type II", "NATE RTW", "Safety Bundle"],
    "SkillCat", ["B2B-Only", "HVACR"], "Jan 28, 2024", "Apr 19, 2026"),
  T("T-1543", "Refrigerant Pressure Chart", "File", ["EPA 608 Type I", "EPA 608 Type II"], "SkillCat", ["Residential HVAC"], "Dec 02, 2023", "Mar 14, 2026"),
  T("T-1432", "Field Visit – Brazing Joints", "Hands-On Task", ["HVAC Field Skills", "EPA 608 Type II"], "SkillCat",
    ["HVAC", "Field", "Brazing"], "Apr 09, 2024", "Apr 28, 2026", {
      description: "Practical brazing skill assessment. Technicians document at least one brazed joint completed in the field, with photos and reflection on quality control measures.",
      updated: "2 days ago by Jordan Patel",
      visibility: "Visible · published",
      timeToComplete: "~45 minutes",
      submissions: "312 attempts · 89% pass rate",
      requirements: "Project Title (required, 60 char) · Project Description (required, 500 char) · up to 5 images or videos. Reviewed manually with a 7/10 passing score.",
      skills: [{ icon: "🟨", name: "Soldering & Brazing" }],
    }),
  T("T-1289", "NATE RTW Final Exam", "Quiz", ["NATE RTW"], "SkillCat", ["B2B-Only", "Commercial HVAC"], "Mar 06, 2024", "Apr 25, 2026"),
  T("T-1156", "EPA 608 Type I Final Exam", "Quiz", ["EPA 608 Type I"], "SkillCat", ["All-User"], "Feb 02, 2024", "Apr 18, 2026"),
  T("T-1042", "EPA 608 Core – Refrigerant Recovery", "xAPI",
    ["EPA 608 Type I", "EPA 608 Type II", "EPA 608 Type III", "EPA 608 Universal"],
    "SkillCat", ["All-User", "Residential HVAC"], "Jan 14, 2024", "Apr 22, 2026"),
  T("T-0987", "OSHA 10 Safety Course", "xAPI", ["Safety Bundle", "OSHA 10", "OSHA 30"], "SkillCat", ["All-User", "NexStar"], "Nov 18, 2023", "Apr 12, 2026"),
  T("T-0234", "Government ID Upload", "ID Upload",
    ["EPA 608 Type I", "EPA 608 Type II", "NATE RTW", "OSHA 10", "OSHA 30", "Safety Bundle"],
    "SkillCat", ["All-User"], "Sep 11, 2023", "Mar 30, 2026"),

  T("T-2391", "Compressor Diagnostics Module", "xAPI", ["EPA 608 Type II", "HVAC Field Skills"], "HVACR", ["B2B-Only", "HVACR", "Commercial HVAC"], "Jan 09, 2025", "Apr 02, 2026"),
  T("T-2350", "Refrigerant Charging Procedure", "Hands-On Task", ["EPA 608 Type I", "EPA 608 Universal"], "SkillCat", ["All-User", "Residential HVAC"], "Feb 11, 2025", "Apr 15, 2026"),
  T("T-2287", "Heat Pump Troubleshooting", "xAPI", ["HVAC Field Skills"], "ARS", ["B2B-Only", "Residential HVAC"], "Mar 02, 2025", "Apr 18, 2026"),
  T("T-2244", "Gas Furnace Safety Check", "Hands-On Task", ["EPA 608 Type II", "Safety Bundle"], "NexTech", ["B2B-Only", "Residential HVAC"], "Mar 12, 2025", "Apr 09, 2026"),
  T("T-2199", "Ductwork Installation Guide", "File", ["HVAC Field Skills"], "Premium HVAC Services", ["B2B-Only", "Commercial HVAC"], "Mar 18, 2025", "Apr 06, 2026"),
  T("T-2165", "Thermostat Wiring Lab", "Hands-On Task", ["HVAC Field Skills", "EPA 608 Type I"], "SkillCat", ["All-User", "Residential HVAC"], "Mar 22, 2025", "Apr 11, 2026"),
  T("T-2132", "Capacitor Replacement Walkthrough", "xAPI", ["EPA 608 Type II"], "HVACR", ["B2B-Only", "Residential HVAC"], "Apr 01, 2025", "Apr 21, 2026"),
  T("T-2098", "Coil Cleaning Procedure", "Hands-On Task", ["HVAC Field Skills"], "ARS", ["B2B-Only", "Commercial HVAC"], "Apr 04, 2025", "Apr 14, 2026"),
  T("T-2061", "Airflow Calibration Quiz", "Quiz", ["HVAC Field Skills"], "SkillCat", ["All-User"], "Apr 10, 2025", "Apr 24, 2026"),
  T("T-2024", "Electrical Panel Lab", "Hands-On Task", ["Safety Bundle", "OSHA 30"], "NexTech", ["B2B-Only", "Commercial HVAC"], "Apr 12, 2025", "Apr 16, 2026"),

  T("T-1989", "Indoor Air Quality Test", "xAPI", ["HVAC Field Skills"], "SkillCat", ["All-User", "Residential HVAC"], "May 02, 2025", "Apr 07, 2026"),
  T("T-1955", "Combustion Analysis", "Quiz", ["EPA 608 Type II"], "HVACR", ["B2B-Only", "Commercial HVAC"], "May 14, 2025", "Apr 02, 2026"),
  T("T-1922", "Boiler Inspection Checklist", "File", ["EPA 608 Universal"], "Premium HVAC Services", ["B2B-Only", "Commercial HVAC"], "Jun 03, 2025", "Mar 28, 2026"),
  T("T-1888", "Mini-Split Install Guide", "xAPI", ["HVAC Field Skills"], "ARS", ["B2B-Only", "Residential HVAC"], "Jun 12, 2025", "Apr 17, 2026"),
  T("T-1855", "Recovery Machine Setup", "Hands-On Task", ["EPA 608 Type I", "EPA 608 Universal"], "SkillCat", ["All-User"], "Jun 25, 2025", "Apr 19, 2026"),
  T("T-1821", "Vacuum Pump Operation", "Hands-On Task", ["EPA 608 Type I"], "HVACR", ["B2B-Only", "Residential HVAC"], "Jul 02, 2025", "Apr 03, 2026"),
  T("T-1788", "Manifold Gauge Use", "Quiz", ["EPA 608 Type I", "EPA 608 Type II"], "SkillCat", ["All-User"], "Jul 14, 2025", "Apr 05, 2026"),
  T("T-1755", "Pressure Test Module", "xAPI", ["EPA 608 Type II"], "NexTech", ["B2B-Only", "Commercial HVAC"], "Jul 22, 2025", "Apr 12, 2026"),
  T("T-1722", "Subcooling Calculation Quiz", "Quiz", ["EPA 608 Type I"], "SkillCat", ["All-User"], "Aug 04, 2025", "Apr 14, 2026"),
  T("T-1689", "Superheat Reading Lab", "Hands-On Task", ["EPA 608 Type I"], "ARS", ["B2B-Only", "Residential HVAC"], "Aug 12, 2025", "Apr 18, 2026"),

  T("T-1655", "VRF System Overview", "xAPI", ["HVAC Field Skills"], "Premium HVAC Services", ["B2B-Only", "Commercial HVAC"], "Aug 25, 2025", "Apr 22, 2026"),
  T("T-1621", "Chiller Maintenance Module", "File", ["HVAC Field Skills"], "HVACR", ["B2B-Only", "Commercial HVAC"], "Sep 01, 2025", "Apr 09, 2026"),
  T("T-1588", "Cooling Tower Basics", "xAPI", ["HVAC Field Skills"], "Premium HVAC Services", ["B2B-Only", "Commercial HVAC"], "Sep 11, 2025", "Apr 06, 2026"),
  T("T-1555", "PVC Pipe Joining Lab", "Hands-On Task", [], "SkillCat", ["All-User", "Residential Plumbing"], "Sep 22, 2025", "Apr 11, 2026"),
  T("T-1521", "PEX Tubing Install Walkthrough", "xAPI", [], "ARS", ["B2B-Only", "Residential Plumbing"], "Oct 02, 2025", "Apr 13, 2026"),
  T("T-1488", "Sweat Soldering Lab", "Hands-On Task", [], "SkillCat", ["All-User", "Residential Plumbing"], "Oct 12, 2025", "Apr 17, 2026"),
  T("T-1455", "Waste Line Layout Quiz", "Quiz", [], "NexTech", ["B2B-Only", "Commercial Plumbing"], "Oct 22, 2025", "Apr 21, 2026"),
  T("T-1421", "Vent Stack Sizing", "File", [], "HVACR", ["B2B-Only", "Commercial Plumbing"], "Nov 01, 2025", "Apr 04, 2026"),
  T("T-1388", "Backflow Preventer Setup", "Hands-On Task", [], "Premium HVAC Services", ["B2B-Only", "Commercial Plumbing"], "Nov 12, 2025", "Apr 08, 2026"),
  T("T-1355", "Water Heater Service", "xAPI", [], "ARS", ["B2B-Only", "Residential Plumbing"], "Nov 22, 2025", "Apr 12, 2026"),

  T("T-1321", "Tankless Heater Lab", "Hands-On Task", [], "SkillCat", ["All-User", "Residential Plumbing"], "Dec 01, 2025", "Apr 16, 2026"),
  T("T-1288", "Sump Pump Install", "Hands-On Task", [], "NexTech", ["B2B-Only", "Residential Plumbing"], "Dec 10, 2025", "Apr 20, 2026"),
  T("T-1255", "Drain Cleaning Module", "xAPI", [], "Premium HVAC Services", ["B2B-Only", "MultiFamily Maintenance"], "Dec 18, 2025", "Apr 02, 2026"),
  T("T-1221", "Fixture Install Walkthrough", "xAPI", [], "ARS", ["B2B-Only", "Hotel Maintenance"], "Jan 04, 2026", "Apr 09, 2026"),
  T("T-1188", "Hose Bibb Replacement", "Hands-On Task", [], "SkillCat", ["All-User", "Residential Plumbing"], "Jan 12, 2026", "Apr 11, 2026"),
  T("T-1155", "Slab Leak Detection", "xAPI", [], "HVACR", ["B2B-Only", "Residential Plumbing"], "Jan 20, 2026", "Apr 15, 2026"),
  T("T-1121", "Gas Line Pressure Test", "Hands-On Task", ["Safety Bundle"], "Premium HVAC Services", ["B2B-Only", "Commercial HVAC"], "Feb 01, 2026", "Apr 19, 2026"),
  T("T-1088", "Flame Sensor Cleaning", "xAPI", ["HVAC Field Skills"], "ARS", ["B2B-Only", "Residential HVAC"], "Feb 09, 2026", "Apr 23, 2026"),
  T("T-1055", "Igniter Replacement Module", "Hands-On Task", ["HVAC Field Skills"], "NexTech", ["B2B-Only", "Residential HVAC"], "Feb 18, 2026", "Apr 25, 2026"),
  T("T-1021", "Hotel Maintenance Walkthrough", "xAPI", [], "Premium HVAC Services", ["B2B-Only", "Hotel Maintenance"], "Feb 26, 2026", "Apr 27, 2026"),
  T("T-0988", "MultiFamily Service Visit", "Hands-On Task", [], "ARS", ["B2B-Only", "MultiFamily Maintenance"], "Mar 06, 2026", "Apr 29, 2026"),
  T("T-0955", "NexStar Onboarding", "URL", [], "SkillCat", ["B2B-Only", "NexStar"], "Mar 14, 2026", "Apr 28, 2026"),
];
