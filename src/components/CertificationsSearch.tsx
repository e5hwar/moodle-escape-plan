import { useMemo } from "react";
import type { Certification } from "../data/certifications";
import { NO_CAREER_STAGE, NO_TYPE } from "../data/certifications";
import { industryTagLabels, useLiveIndustries } from "../data/industries";
import { EntitySearch, type SearchScope } from "./UsersSearch";

/** The Certifications page bar: the shared commit-on-Enter `EntitySearch` with
 *  three scopes — Industry, Career Stage and Type — each feeding the matching
 *  Filters-row pill. Options are DERIVED from the rows on screen, so the bar can
 *  never offer a value that matches nothing (same rule as Users/Skills). */
export function CertificationsSearch({
  certifications,
  industries,
  onIndustriesChange,
  careerStages,
  onCareerStagesChange,
  types,
  onTypesChange,
  query,
  onCommit,
}: {
  certifications: Certification[];
  industries: string[];
  onIndustriesChange: (next: string[]) => void;
  careerStages: string[];
  onCareerStagesChange: (next: string[]) => void;
  types: string[];
  onTypesChange: (next: string[]) => void;
  query: string;
  onCommit: (q: string) => void;
}) {
  /* An Industry option is a top-level Industry or an "Industry › Sub-Industry"
     label, counted by exact tag — tagging a Sub-Industry does not tag its
     parent (mirrors `matchesIndustry`). */
  const inds = useLiveIndustries();
  const industryOpts = useMemo(() => {
    const counts = new Map<string, number>();
    certifications.forEach((c) => {
      industryTagLabels(c.industries, inds).forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1));
    });
    return { names: [...counts.keys()].sort(), counts };
  }, [certifications, inds]);

  const stageOpts = useMemo(
    () => countBy(certifications, (c) => c.careerStage ?? NO_CAREER_STAGE),
    [certifications],
  );

  const typeOpts = useMemo(
    () => countBy(certifications, (c) => c.type ?? NO_TYPE),
    [certifications],
  );

  const scopes: SearchScope[] = [
    {
      token: "Industries",
      noun: "industry",
      options: industryOpts.names,
      applied: industries,
      onAppliedChange: onIndustriesChange,
      optionsLabel: "Industries",
      example: "Industries: HVAC",
      hint: "Filter by Industries",
      describe: (name) => plural(industryOpts.counts.get(name) ?? 0),
    },
    {
      token: "Career Stage",
      options: stageOpts.names,
      applied: careerStages,
      onAppliedChange: onCareerStagesChange,
      optionsLabel: "Career Stages",
      example: "Career Stage: Apprentice",
      hint: "Filter by Career Stage",
      describe: (name) => plural(stageOpts.counts.get(name) ?? 0),
    },
    {
      token: "Type",
      options: typeOpts.names,
      applied: types,
      onAppliedChange: onTypesChange,
      optionsLabel: "Types",
      example: "Type: Credential",
      hint: "Filter by Certification Type",
      describe: (name) => plural(typeOpts.counts.get(name) ?? 0),
    },
  ];

  return (
    <EntitySearch
      scopes={scopes}
      placeholder="Search Certifications..."
      query={query}
      onCommit={onCommit}
    />
  );
}

const plural = (n: number) => `${n} certification${n === 1 ? "" : "s"}`;

function countBy(certs: Certification[], key: (c: Certification) => string) {
  const counts = new Map<string, number>();
  certs.forEach((c) => {
    const v = key(c);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  });
  return { names: [...counts.keys()].sort(), counts };
}
