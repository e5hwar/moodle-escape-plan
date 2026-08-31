import { useMemo } from "react";
import type { Certification } from "../data/certifications";
import { NO_CAREER_STAGE, NO_TYPE } from "../data/certifications";
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
  /* An Industry pill option is either a top-level Industry or an
     "Industry › Sub-Industry" path, and a certification tagged with the path
     counts for both — mirror `matchesIndustry` when counting. */
  const industryOpts = useMemo(() => {
    const counts = new Map<string, number>();
    certifications.forEach((c) => {
      const parent = c.industry.split(" › ")[0];
      counts.set(c.industry, (counts.get(c.industry) ?? 0) + 1);
      if (parent !== c.industry) counts.set(parent, (counts.get(parent) ?? 0) + 1);
    });
    return { names: [...counts.keys()].sort(), counts };
  }, [certifications]);

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
      token: "Industry",
      options: industryOpts.names,
      applied: industries,
      onAppliedChange: onIndustriesChange,
      optionsLabel: "Industries",
      example: "Industry: HVAC",
      hint: "Filter by Industry",
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
      placeholder="Search Certifications…"
      searchForScope="Certifications"
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
