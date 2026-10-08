import { taskById, type Skill } from "./skills";
import { useMemo } from "react";
import { CERT_BY_USEDIN, certById } from "./certifications";
import { industryTagLabels, industryTagOptions, useLiveIndustries } from "./industries";

/* How a Skill reaches the rest of the content graph — through its Tasks.
   Shared by the Skills page and the Select Skills picker so both derive
   Certifications and Industries the same way. */

/* A Skill carries no Certification of its own — it inherits both its Tasks and
   their Certifications from `taskIds`, so the Certification / Task filters (and
   their options) are derived from the Task graph. Deriving rather than listing
   means a filter can never offer a value that matches no row. */
export function skillTaskNames(s: Skill): string[] {
  return s.taskIds.flatMap((id) => {
    const t = taskById(id);
    return t ? [t.name] : [];
  });
}

export function skillCertifications(s: Skill): string[] {
  return s.taskIds.flatMap((id) => taskById(id)?.usedIn ?? []);
}

/* A Skill has no Industry of its own — it inherits the Industries of every
   Certification it reaches through its Tasks. A Skill can therefore land in
   several Industries, or in none (its Certifications carry no Industry, or it
   awards no Task at all). These are the exact tag labels ("HVAC",
   "HVAC › Residential"): a Sub-Industry tag doesn't put it in the Industry. */
export function skillIndustryPaths(s: Skill): string[] {
  return [
    ...new Set(
      skillCertifications(s).flatMap((name) => {
        const seed = CERT_BY_USEDIN.get(name);
        // The live record, so tags set this session show here too.
        const c = seed && (certById(seed.id) ?? seed);
        return c ? industryTagLabels(c.industries) : [];
      }),
    ),
  ];
}

export function skillIndustries(s: Skill): string[] {
  return skillIndustryPaths(s);
}

/* Industry options are the live Industries page list: every Industry followed
   by its Sub-Industries, each reading as its own full path — the same flat
   list the Certification filters use (see `CertFilters.tsx`). */
export function useIndustryOptions(): string[] {
  const inds = useLiveIndustries();
  return useMemo(() => industryTagOptions(inds).map((o) => o.label), [inds]);
}

/* Exact tags only: picking "HVAC" matches a Skill reaching a Certification
   tagged "HVAC" itself, not one tagged only "HVAC › Residential". */
export function matchesIndustry(s: Skill, selected: string[]): boolean {
  const paths = skillIndustryPaths(s);
  return selected.some((opt) => paths.includes(opt));
}

