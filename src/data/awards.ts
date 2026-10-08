import { certifications, type Certification } from "./certifications";
import { buildData, liveCells, progress } from "./certLookup";
import { completionsStore } from "./completions";

// ─────────────────────────────────────────────────────────────────────────────
// Awards (spec §12)
//
// An Award is earned when a user completes the linked Certification. Each Award
// has shared metadata (Merit Tier + the per-user QR / Unique Number minted on
// issuance) and up to two visual appearances — a Card and/or a Certificate —
// each rendered from an Award Design Template.
//
// An Award Design Template is a reusable visual (background image + positioned
// dynamic fields). One template can back many Awards, as a Card or a
// Certificate. Editing a template updates every Award that uses it.
//
// This prototype models the admin data only. The dynamic-field positioning
// editor and the public verification page are out of scope here.
// ─────────────────────────────────────────────────────────────────────────────

export type MeritTier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type AwardStatus = "Active" | "Archived";

export type AwardDesignTemplate = {
  id: string;
  /** Internal name — admins only. */
  name: string;
  /** Stand-in for the uploaded background image filename. */
  background: string;
  /** CSS gradient used to render the thumbnail in this prototype. */
  swatch: string;
  createdBy: string;
  dateCreated: string;
  dateModified: string;
};

export type Award = {
  id: string;
  /** The Certification that triggers this Award. One Award per Certification. */
  certificationId: string;
  meritTier: MeritTier;
  /** Template backing the Card appearance. Every Award should have a Card. */
  cardTemplateId?: string;
  /** Template backing the Certificate appearance. Optional. */
  certificateTemplateId?: string;
  status: AwardStatus;
  createdBy: string;
  /** Users who currently hold this Award (issued instances). */
  holders: number;
  dateCreated: string;
  dateModified: string;
};

// ─── Fixed Merit Tiers (§12.3.1) — cannot be added, removed, or renamed ───────
export const MERIT_TIERS: MeritTier[] = ["Bronze", "Silver", "Gold", "Platinum"];

/** Portfolio display order — Platinum top, Bronze bottom. */
export const MERIT_ORDER: Record<MeritTier, number> = {
  Platinum: 0,
  Gold: 1,
  Silver: 2,
  Bronze: 3,
};

export const MERIT_HEX: Record<MeritTier, string> = {
  Bronze: "#cd7f32",
  Silver: "#c4c7cc",
  Gold: "#e9b949",
  Platinum: "#7fd7d2",
};

export const MERIT_INTENT: Record<MeritTier, string> = {
  Platinum: "Most significant — EPA 608 Universal, Trade School completions",
  Gold: "Substantial Certifications — NATE RTW, OSHA 10",
  Silver: "Standard Certifications — Electrical Troubleshooting",
  Bronze: "Introductory or shorter Certifications — Intro to HVAC, Trade Math",
};

export const AWARD_STATUSES: AwardStatus[] = ["Active", "Archived"];

// ─── Seed: Award Design Templates ────────────────────────────────────────────
const T = (
  id: string,
  name: string,
  background: string,
  swatch: string,
  dateCreated: string,
  dateModified: string,
): AwardDesignTemplate => ({
  id,
  name,
  background,
  swatch,
  createdBy: "SkillCat",
  dateCreated,
  dateModified,
});

export const designTemplates: AwardDesignTemplate[] = [
  T("DT-01", "EPA Card — 2026 Brand", "epa-card-2026.png", "linear-gradient(135deg, #0e3a3a 0%, #0a1f1f 100%)", "Jan 14, 2026", "Apr 26, 2026"),
  T("DT-02", "EPA Certificate — 2026 Brand", "epa-cert-2026.png", "linear-gradient(135deg, #11302f 0%, #0c1a19 60%, #1a2a14 100%)", "Jan 14, 2026", "Apr 26, 2026"),
  T("DT-03", "Standard Card — Dark", "std-card-dark.png", "linear-gradient(135deg, #2a2a2f 0%, #131315 100%)", "Mar 02, 2024", "Mar 18, 2026"),
  T("DT-04", "Trade School Diploma", "diploma-trade.png", "linear-gradient(135deg, #2e2412 0%, #161009 100%)", "Sep 09, 2024", "Apr 12, 2026"),
  T("DT-05", "NATE Certificate", "nate-cert.png", "linear-gradient(135deg, #1c2740 0%, #0c1320 100%)", "Feb 20, 2024", "Feb 02, 2026"),
  // Unused — demonstrates a template that can be deleted (no Award references it).
  T("DT-06", "Legacy Card — 2024", "legacy-card-2024.png", "linear-gradient(135deg, #3a2a2a 0%, #1a1212 100%)", "Nov 11, 2023", "Nov 11, 2023"),
];

// ─── Seed: Awards (linked to Certifications in data/certifications.ts) ─────────
const A = (
  id: string,
  certificationId: string,
  meritTier: MeritTier,
  cardTemplateId: string | undefined,
  certificateTemplateId: string | undefined,
  holders: number,
  dateCreated: string,
  dateModified: string,
  extra: Partial<Award> = {},
): Award => ({
  id,
  certificationId,
  meritTier,
  cardTemplateId,
  certificateTemplateId,
  status: "Active",
  createdBy: "SkillCat",
  holders,
  dateCreated,
  dateModified,
  ...extra,
});

export const awards: Award[] = [
  A("AW-101", "C-0421", "Platinum", "DT-01", "DT-02", 4821, "Jan 16, 2026", "Apr 26, 2026"), // EPA 608 Universal
  A("AW-102", "C-0410", "Gold", "DT-03", "DT-05", 2210, "Feb 14, 2024", "Apr 14, 2026"),      // NATE Ready-to-Work
  A("AW-103", "C-0341", "Gold", "DT-03", "DT-04", 6904, "Sep 04, 2023", "Apr 02, 2026"),      // OSHA 10
  A("AW-104", "C-0420", "Silver", "DT-01", undefined, 1530, "Jan 16, 2026", "Apr 26, 2026"),  // EPA 608 Type I
  A("AW-105", "C-0419", "Silver", "DT-01", undefined, 1422, "Jan 16, 2026", "Apr 26, 2026"),  // EPA 608 Type II
  A("AW-106", "C-0418", "Silver", "DT-01", undefined, 998, "Jan 16, 2026", "Apr 26, 2026"),   // EPA 608 Type III
  A("AW-107", "C-0398", "Gold", "DT-03", "DT-04", 1187, "Jan 10, 2024", "Mar 30, 2026"),      // HVAC JobReady
  A("AW-108", "C-0376", "Bronze", "DT-03", undefined, 742, "Nov 16, 2023", "Feb 22, 2026"),   // Brazing Fundamentals
  A("AW-109", "C-0322", "Gold", "DT-03", "DT-04", 533, "Jul 22, 2023", "Dec 04, 2025"),       // Plumbing Apprentice Year 1
  A("AW-110", "C-0242", "Silver", "DT-03", "DT-04", 401, "Jan 20, 2023", "Sep 12, 2025"),     // Solar PV Installer Basics
  A("AW-111", "C-0221", "Gold", "DT-03", "DT-04", 188, "Dec 03, 2022", "Aug 21, 2025"),       // Welding Inspector Prep
  A("AW-112", "C-0405", "Bronze", "DT-03", undefined, 612, "Jan 22, 2024", "Apr 02, 2026"),   // Refrigerant Safety Bundle
  // Confined Space Entry's Award — the one setup step it has done (its
  // Certification is still mid-setup, see data/certifications.ts).
  A("AW-114", "C-0624", "Bronze", "DT-03", undefined, 0, "Sep 24, 2026", "Sep 24, 2026"),
  // Archived Award — its Certification is archived; existing holders keep it.
  A("AW-113", "C-0265", "Bronze", "DT-03", undefined, 96, "Mar 12, 2023", "Oct 08, 2025", { status: "Archived" }),
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const certById: Record<string, Certification> = Object.fromEntries(
  certifications.map((c) => [c.id, c]),
);

export function certForAward(award: Award): Certification | undefined {
  return certById[award.certificationId];
}

/** Certification name, always resolved live (names are never frozen at issuance). */
export function certName(award: Award): string {
  return certById[award.certificationId]?.name ?? "";
}

export function templateById(
  id: string | undefined,
  list: AwardDesignTemplate[] = designTemplates,
): AwardDesignTemplate | undefined {
  return id ? list.find((t) => t.id === id) : undefined;
}

/** Awards referencing a template — as a Card or a Certificate. */
export function awardsUsingTemplate(
  templateId: string,
  list: Award[] = awards,
): Award[] {
  return list.filter(
    (a) => a.cardTemplateId === templateId || a.certificateTemplateId === templateId,
  );
}

/** How many appearances reference a template (a single Award may count twice). */
export function templateUsageCount(
  templateId: string,
  list: Award[] = awards,
): number {
  let n = 0;
  for (const a of list) {
    if (a.cardTemplateId === templateId) n++;
    if (a.certificateTemplateId === templateId) n++;
  }
  return n;
}

/** Short summary of an Award's appearances, e.g. "Card + Certificate". */
export function appearanceSummary(award: Award): string {
  const hasCard = !!award.cardTemplateId;
  const hasCert = !!award.certificateTemplateId;
  if (hasCard && hasCert) return "Card + Certificate";
  if (hasCard) return "Card only";
  if (hasCert) return "Certificate only";
  return "No appearance";
}

/* Award ids are never re-issued, even after a delete — the same rule as
   Certification ids (App's issueCertId). The next id is one past the
   HIGH-WATER MARK: the largest id ever in the seed, the live list, or ever
   issued. The mark is also kept in localStorage, so a reload (which resets the
   list to the seed) can't hand a new Award an id an earlier session used. */
const AWARD_ID_HIGH_WATER_KEY = "award-id-high-water";
let awardIdHighWater = 0;
function maxAwardIdNumber(list: Award[], floor: number): number {
  return list.reduce((m, a) => {
    const n = Number(/^AW-(\d+)$/.exec(a.id)?.[1]);
    return Number.isFinite(n) && n > m ? n : m;
  }, floor);
}
function readAwardIdHighWater(): number {
  try {
    return Number(window.localStorage.getItem(AWARD_ID_HIGH_WATER_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Issue the next Award id (the seed runs AW-101…114, out of order) and move
 *  the high-water mark past it. Call once per created Award. */
export function issueAwardId(list: Award[]): string {
  const n =
    maxAwardIdNumber(list, maxAwardIdNumber(awards, Math.max(100, awardIdHighWater, readAwardIdHighWater()))) + 1;
  awardIdHighWater = n;
  try {
    window.localStorage.setItem(AWARD_ID_HIGH_WATER_KEY, String(n));
  } catch {
    /* storage unavailable — the module mark still holds for the session */
  }
  return `AW-${n}`;
}

/** How many users have already completed a Certification — what a new Award
 *  issues to retroactively. Read from the Certification Lookup model as Manage
 *  Completions last left it (seeded cells + applied changes + manual
 *  certification decisions). A Certification created this session isn't in
 *  that model, so nobody has completed it yet: 0. */
export function completedUsersCount(certId: string): number {
  const data = buildData();
  const def = data.certsById[certId];
  if (!def) return 0;
  const state = completionsStore.get();
  const cells = liveCells(data, state);
  const taskList = def.taskIds.map((id) => data.tasksById[id]).filter(Boolean);
  return data.employees.filter(
    (e) => progress(cells, state.certs, e.id, taskList, certId).certified,
  ).length;
}

export function fmtHolders(n: number): string {
  return n.toLocaleString();
}

// ─── Award Template table column config ──────────────────────────────────────────────────────
export type TemplateColKey =
  | "background"
  | "id"
  | "usage"
  | "createdBy"
  | "dateCreated"
  | "dateModified";

export const TEMPLATE_COLS: { key: TemplateColKey; label: string }[] = [
  { key: "background", label: "Background Image" },
  { key: "id", label: "ID" },
  { key: "usage", label: "Used By" },
  { key: "createdBy", label: "Created By" },
  { key: "dateCreated", label: "Date Created" },
  { key: "dateModified", label: "Date Modified" },
];
