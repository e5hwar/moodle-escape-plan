import { users, type User } from "./users";

export type SubmissionMedia =
  | { kind: "video"; seed: string; duration: string }
  | { kind: "image"; seed: string };

export type EvaluationCriterion = { id: string; label: string };

export type TaskSubmission = {
  id: string;
  userId: string;
  userName: string;
  email: string;
  phone: string;
  userType: "B2C" | "B2B";
  companyName?: string;
  taskName: string;
  /** ISO date the submission was sent for review. */
  submittedOn: string;
  /** Who created the task — "SkillCat" or the company. */
  createdBy: string;

  /* ── detail-view fields ── */
  durationLabel: string; // e.g. "Hands-on Task · 2 Hours"
  status: "Submitted" | "In Review" | "Completed";
  progress: number; // percent
  completion: string; // ISO date or "—"
  dueDate: string; // ISO date
  lastActivity: string; // human label, e.g. "2 days ago"
  versions: string[]; // ["V5","V4",…]
  media: SubmissionMedia[];
  description: string;
  audioLabel: string; // voice-note label
  audioDuration: string; // e.g. "0:48"
  criteria: EvaluationCriterion[];
};

const TASK_NAMES = [
  "HVAC Install",
  "Refrigerant Charging Procedure",
  "Thermostat Wiring Lab",
  "Recovery Machine Setup",
  "Condenser Coil Cleaning",
  "Ductwork Sealing",
  "Brazing Copper Lines",
  "Electrical Panel Labeling",
  "Compressor Replacement",
  "Vacuum & Evacuation",
  "Leak Detection Test",
  "Furnace Ignition Check",
];

const DESCRIPTIONS = [
  "I installed the HVAC split system by first confirming the work area was safe and isolating electrical power. I mounted the indoor air handler and outdoor condenser according to the specifications. I ran and connected the refrigerant line set, ensuring all flare fittings were tightened and properly insulated. I installed the condensate drain line with proper slope and connected the thermostat wiring. After completing all connections, I pressure tested the system for leaks, evacuated the lines using a vacuum pump, and charged the system with refrigerant to manufacturer specifications. Finally, I restored power, tested system operation in cooling mode, verified proper airflow and temperature drop, and confirmed there were no leaks or abnormal noises.",
  "Before charging, I recovered the existing refrigerant into a certified recovery cylinder and weighed it to confirm full evacuation. I connected my manifold gauges, pulled a deep vacuum to 500 microns, and held it to confirm there were no leaks. I then weighed in the correct charge per the nameplate, monitoring subcooling and superheat as I added refrigerant. I documented the final readings and verified the system reached the target temperature split.",
  "I terminated the thermostat wiring following the manufacturer's diagram, matching each conductor to the correct terminal (R, C, Y, G, W). I confirmed 24V at the transformer, checked continuity on each run, and labeled both ends of the cable. After powering up, I verified each call — cooling, heating, and fan — energized the correct relay with no cross-wiring.",
  "I set up the recovery machine with the correct hoses and a recovery cylinder rated for the refrigerant type. I verified the cylinder was not overfilled by weight, opened the appropriate valves in sequence, and started recovery while monitoring pressures. I purged the hoses at the end and recorded the recovered weight.",
];

const CRITERIA: EvaluationCriterion[] = [
  { id: "c1", label: "Evidence quality and relevance" },
  { id: "c2", label: "Safety and compliance with procedure" },
  { id: "c3", label: "Execution accuracy and completeness" },
  { id: "c4", label: "Professional communication in notes" },
];

function uhash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TODAY = new Date("2026-06-18");
function isoDaysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function isoDaysAhead(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function activityLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  return `${Math.floor(days / 7)} weeks ago`;
}

/** Build review submissions from a subset of real users. */
function buildSubmissions(): TaskSubmission[] {
  const pool: User[] = users.slice(0, 18);
  return pool.map((u, i) => {
    const k = uhash(u.id + i);
    const taskName = TASK_NAMES[k % TASK_NAMES.length];
    const submittedDaysAgo = (k % 21) + 1;
    const mediaCount = 2 + (k % 3); // 2–4 media items
    const media: SubmissionMedia[] = Array.from({ length: mediaCount }, (_, m) =>
      m === 0
        ? {
            kind: "video" as const,
            seed: `${u.id}-${m}`,
            duration: `0:${String(4 + (k % 50)).padStart(2, "0")}`,
          }
        : { kind: "image" as const, seed: `${u.id}-${m}` },
    );
    return {
      id: `RS-${2400 - i * 7}`,
      userId: u.id,
      userName: u.name,
      email: u.email,
      phone: u.phone,
      userType: u.userType,
      companyName: u.companyName,
      taskName,
      submittedOn: isoDaysAgo(submittedDaysAgo),
      createdBy: u.userType === "B2B" && u.companyName ? u.companyName : "SkillCat",
      durationLabel: "Hands-on Task · 2 Hours",
      status: "Submitted",
      progress: 100,
      completion: isoDaysAgo(submittedDaysAgo),
      dueDate: isoDaysAhead(15 + (k % 30)),
      lastActivity: activityLabel(submittedDaysAgo),
      versions: ["V5", "V4", "V3", "V2", "V1"].slice(0, 1 + (k % 5)),
      media,
      description: DESCRIPTIONS[k % DESCRIPTIONS.length],
      audioLabel: "Voice note",
      audioDuration: `0:${String(20 + (k % 40)).padStart(2, "0")}`,
      criteria: CRITERIA,
    };
  });
}

export const reviewSubmissions: TaskSubmission[] = buildSubmissions();

/** picsum.photos URL for a media seed (deterministic image per seed). */
export function mediaUrl(seed: string, w = 800, h = 600): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}
