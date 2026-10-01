import { taskById, type Skill } from "./skills";
import { CERT_BY_USEDIN, topIndustry } from "./certifications";
import { industries as allIndustries } from "./industries";

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
   awards no Task at all). These are the FULL paths ("HVAC › Residential"),
   which is what the filter matches on; the column shows the top level. */
export function skillIndustryPaths(s: Skill): string[] {
  return [
    ...new Set(
      skillCertifications(s).flatMap((name) => {
        const industry = CERT_BY_USEDIN.get(name)?.industry;
        return industry ? [industry] : [];
      }),
    ),
  ];
}

export function skillIndustries(s: Skill): string[] {
  return [...new Set(skillIndustryPaths(s).map(topIndustry))];
}

/* Industry options are the Industries page's own list: every Industry followed
   by its Sub-Industries, each reading as its own full path — the same flat
   list the Certification filters use (see `CertFilters.tsx`). */
export const INDUSTRY_OPTIONS: string[] = [...allIndustries]
  .sort((a, b) => a.displayPosition - b.displayPosition)
  .flatMap((ind) => [
    ind.name,
    ...[...ind.subIndustries]
      .sort((a, b) => a.displayPosition - b.displayPosition)
      .map((sub) => `${ind.name} › ${sub.name}`),
  ]);

/* A selected option matches its own path and everything beneath it: picking
   "HVAC" catches "HVAC › Residential", picking the sub path matches only it. */
export function matchesIndustry(s: Skill, selected: string[]): boolean {
  const paths = skillIndustryPaths(s);
  return selected.some((opt) => paths.some((p) => p === opt || p.startsWith(`${opt} ›`)));
}

