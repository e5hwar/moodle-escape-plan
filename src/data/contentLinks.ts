import { certById, getLiveCerts, isSkillCatCert, type Certification } from "./certifications";
import { certIndustryText } from "./industries";

export type Level = "Beginner" | "Intermediate" | "Advanced";
export type LinkKind = "prerequisite" | "recommended" | "related";

/* The Content Links graph is Certifications only (2026-10-08): no Course or
 * Task nodes. A node IS a Certification — its id is the Certification's id,
 * and its name, level and Industry are read from the live record, so a
 * rename shows everywhere and links survive it. */
export type ContentNode = {
  id: string;
  name: string;
  kind: "Certification";
  level: Level;
  tasksCount: number;
  industry?: string;
};

export type Link = {
  from: string;
  to: string;
  kind: LinkKind;
  /** Link Strength, a whole number from 1 to 100. While an admin is editing
   *  it can hold what they typed (0, 101, NaN for an empty field); Save is
   *  blocked until every link passes `validStrength`. */
  strength: number;
};

/** At most this many links on one Certification's Content Links page. */
export const MAX_LINKS_PER_CERT = 10;

/** A saveable Link Strength: a whole number from 1 to 100. Empty is not 0. */
export function validStrength(s: number): boolean {
  return Number.isInteger(s) && s >= 1 && s <= 100;
}

/** A Certification as a graph node. */
export function certNode(cert: Certification): ContentNode {
  const level: Level =
    cert.careerStage === "Master"
      ? "Advanced"
      : cert.careerStage === "Journeyman"
      ? "Intermediate"
      : "Beginner";
  return {
    id: cert.id,
    name: cert.name,
    kind: "Certification",
    level,
    tasksCount: cert.tasks,
    industry: certIndustryText(cert.industries) || undefined,
  };
}

/** The live node for a Certification id; undefined once it is deleted. */
export function nodeFor(id: string): ContentNode | undefined {
  const c = certById(id);
  return c ? certNode(c) : undefined;
}

/** Certifications a link may point at: SkillCat-created only (Hidden ones
 *  included); company-created Certifications are never link targets. */
export function linkableCerts(certs: Certification[] = getLiveCerts()): Certification[] {
  return certs.filter(isSkillCatCert);
}

/** Which Certification's Content Links page created (and owns) a link. The
 *  page stores a Pre-Requisite pointing AT the Certification it was added on
 *  (`from` = the prerequisite, `to` = this one); Recommended Next and Related
 *  point FROM it. */
export function linkAuthor(l: Link): string {
  return l.kind === "prerequisite" ? l.to : l.from;
}

/** The links one Certification authored — what its "Content Links" setup
 *  step counts. Links others made that merely point at it don't count. */
export function authoredLinks(certId: string, all: Link[]): Link[] {
  return all.filter((l) => linkAuthor(l) === certId);
}

/** The links listed in one Certification's three Content Links sections:
 *  Pre-Requisites point at it, Recommended Next lead on from it, Related go
 *  either way. This is what the 10-link cap counts. */
export function pageLinks(certId: string, all: Link[]): Link[] {
  return all.filter(
    (e) =>
      (e.kind === "prerequisite" && e.to === certId) ||
      (e.kind === "recommended" && e.from === certId) ||
      (e.kind === "related" && (e.from === certId || e.to === certId)),
  );
}

/** A Certification's own links, by name, strongest first — the same reading
 *  as the Content Links page. Matched by Certification id, so a rename keeps
 *  them; names come from the live records. */
export function contentLinksFor(
  certId: string,
  all: Link[],
): { prereqs: string[]; recommended: string[]; related: string[] } {
  const out = { prereqs: [] as Link[], recommended: [] as Link[], related: [] as Link[] };
  for (const e of pageLinks(certId, all)) {
    if (e.kind === "prerequisite") out.prereqs.push(e);
    else if (e.kind === "recommended") out.recommended.push(e);
    else out.related.push(e);
  }
  const names = (list: Link[]) =>
    [...list]
      .sort((a, b) => b.strength - a.strength)
      .map((e) => certById(e.from === certId ? e.to : e.from)?.name)
      .filter((n): n is string => !!n);
  return { prereqs: names(out.prereqs), recommended: names(out.recommended), related: names(out.related) };
}

/* Seed graph, by Certification id (certifications.ts). Only SkillCat-created
 * Certifications take part. The recently created ones still being set up
 * (C-0631 Boiler Safety Basics, C-0629 Ductless Mini-Split Install, C-0624
 * Confined Space Entry) have none yet — adding them is their setup step. */
const EPA608 = "C-0421";
const EPA1 = "C-0420";
const EPA2 = "C-0419";
const EPA3 = "C-0418";
const NATE = "C-0410";
const SAFETY = "C-0405";
const JOBREADY = "C-0398";
const BRAZE = "C-0376";
const OSHA10 = "C-0341";
const PLUMB1 = "C-0322";
const ECR = "C-0298";
const FORK = "C-0265";
const SOLAR = "C-0242";
const WIP = "C-0221";
const HPS = "C-0612";

export const links: Link[] = [
  // EPA 608 Universal — prereqs and onward
  { from: SAFETY, to: EPA608, kind: "prerequisite", strength: 70 },
  { from: EPA608, to: EPA1, kind: "recommended", strength: 85 },
  { from: EPA608, to: EPA2, kind: "recommended", strength: 85 },
  { from: EPA608, to: NATE, kind: "related", strength: 55 },

  // OSHA 10 — generic safety prereq for several
  { from: OSHA10, to: NATE, kind: "prerequisite", strength: 40 },
  { from: OSHA10, to: FORK, kind: "prerequisite", strength: 75 },

  // Brazing
  { from: BRAZE, to: EPA2, kind: "recommended", strength: 65 },

  // Refrigerant Safety Bundle — entry-level safety feeding the EPA ladder.
  { from: OSHA10, to: SAFETY, kind: "prerequisite", strength: 45 },
  { from: SAFETY, to: EPA1, kind: "recommended", strength: 65 },
  { from: SAFETY, to: NATE, kind: "recommended", strength: 55 },
  { from: SAFETY, to: BRAZE, kind: "related", strength: 40 },

  // EPA 608 Type I / II / III progression.
  { from: EPA1, to: EPA2, kind: "recommended", strength: 75 },
  { from: EPA1, to: EPA3, kind: "related", strength: 55 },
  { from: SAFETY, to: EPA2, kind: "prerequisite", strength: 60 },
  { from: EPA2, to: EPA3, kind: "recommended", strength: 70 },
  { from: EPA2, to: JOBREADY, kind: "related", strength: 60 },
  { from: SAFETY, to: EPA3, kind: "prerequisite", strength: 55 },
  { from: EPA3, to: JOBREADY, kind: "recommended", strength: 50 },

  // NATE + HVAC JobReady hub.
  { from: NATE, to: JOBREADY, kind: "recommended", strength: 60 },
  { from: JOBREADY, to: EPA608, kind: "recommended", strength: 70 },

  // Brazing → Welding Inspector.
  { from: BRAZE, to: WIP, kind: "prerequisite", strength: 65 },

  // OSHA 10 as a broad safety prerequisite across trades.
  { from: OSHA10, to: SOLAR, kind: "prerequisite", strength: 45 },
  { from: OSHA10, to: PLUMB1, kind: "prerequisite", strength: 40 },
  { from: OSHA10, to: ECR, kind: "prerequisite", strength: 45 },

  // Forklift.
  { from: FORK, to: SOLAR, kind: "related", strength: 30 },

  // Plumbing.
  { from: PLUMB1, to: SOLAR, kind: "related", strength: 30 },

  // Electrical → Solar.
  { from: ECR, to: SOLAR, kind: "recommended", strength: 60 },

  // Welding Inspector.
  { from: WIP, to: ECR, kind: "related", strength: 30 },

  // Heat Pump Specialist (2026) — Hidden, still a valid target.
  { from: JOBREADY, to: HPS, kind: "prerequisite", strength: 60 },
  { from: EPA608, to: HPS, kind: "prerequisite", strength: 55 },
  { from: HPS, to: EPA1, kind: "related", strength: 40 },
];
