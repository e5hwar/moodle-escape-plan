import { useSyncExternalStore } from "react";
import type { PickedImage } from "../components/ImageUploadField";
import type { Certification } from "./certifications";
import hvacIcon from "../assets/industry-hvac.svg";
import plumbingIcon from "../assets/industry-plumbing.svg";
import electricalIcon from "../assets/industry-electrical.svg";

/* The seed industries' icons (Figma 1306:1545 "Industry Certification"), as
   if uploaded through the Industry modal's image field. */
const seedIcon = (name: string, size: number, url: string): PickedImage => ({
  name,
  size,
  ext: "svg",
  url,
});

/* Stand-in icons until every Industry / Sub-Industry has its own (the user,
   2026-10-07: "Just use these for now everywhere so it isn't blank anywhere").
   A row with no uploaded icon borrows one of the three seed glyphs, picked
   from its key so it stays put across renders and reorders. */
const PLACEHOLDER_ICONS: PickedImage[] = [
  seedIcon("hvac.svg", 3295, hvacIcon),
  seedIcon("plumbing.svg", 961, plumbingIcon),
  seedIcon("electrical.svg", 553, electricalIcon),
];
export function rowIcon(item: { key: string; icon?: PickedImage }): PickedImage {
  if (item.icon?.url) return item.icon;
  let h = 0;
  for (const ch of item.key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_ICONS[h % PLACEHOLDER_ICONS.length];
}

export type SubIndustry = {
  key: string;
  name: string;
  // Spanish translation of the name, shown to Spanish-locale learners
  nameEs?: string;
  // Icon learners see beside the name when browsing
  icon?: PickedImage;
  // Whether this Sub-Industry is visible to learners
  hidden?: boolean;
  displayPosition: number;
  /* The display ORDER of the Certifications tagged with this Sub-Industry.
     Membership is the tag on the Certification (`Certification.industries`);
     see `syncIndustryOrder`. */
  certIds: string[];
};

export type Industry = {
  key: string;
  name: string;
  // Spanish translation of the name, shown to Spanish-locale learners
  nameEs?: string;
  // Icon learners see beside the name when browsing
  icon?: PickedImage;
  // Whether this Industry is visible to learners
  hidden?: boolean;
  displayPosition: number;
  subIndustries: SubIndustry[];
  /* The display ORDER of the Certifications tagged with this Industry itself
     (a Sub-Industry tag doesn't count). Membership is the tag on the
     Certification; see `syncIndustryOrder`. */
  certIds: string[];
};

// ─── Tagging ────────────────────────────────────────────────────────────────
/* Each `certIds` is the display order of the seed Certifications carrying
   that exact tag (data/certifications), so the seed starts in sync. */
export const industries: Industry[] = [
  {
    key: "hvac",
    name: "HVAC",
    nameEs: "Climatización (HVAC)",
    icon: seedIcon("hvac.svg", 3295, hvacIcon),
    displayPosition: 1,
    certIds: ["C-0421", "C-0410", "C-0417", "C-0406", "C-0398", "C-0376"],
    subIndustries: [
      {
        key: "hvac-residential",
        name: "Residential",
        displayPosition: 1,
        certIds: ["C-0421", "C-0420", "C-0410", "C-0405", "C-0612", "C-0629"],
      },
      {
        key: "hvac-commercial",
        name: "Commercial",
        displayPosition: 2,
        certIds: ["C-0421", "C-0419", "C-0418"],
      },
      {
        key: "hvac-industrial",
        name: "Industrial",
        displayPosition: 3,
        certIds: ["C-0265"],
      },
    ],
  },
  {
    key: "plumbing",
    name: "Plumbing",
    nameEs: "Plomería",
    icon: seedIcon("plumbing.svg", 961, plumbingIcon),
    displayPosition: 2,
    certIds: ["C-0322"],
    subIndustries: [
      {
        key: "plumbing-residential",
        name: "Residential",
        displayPosition: 1,
        certIds: [],
      },
      {
        key: "plumbing-commercial",
        name: "Commercial",
        displayPosition: 2,
        certIds: [],
      },
      {
        key: "plumbing-service",
        name: "Service & Repair",
        displayPosition: 3,
        certIds: ["C-0624"],
      },
      {
        key: "plumbing-pipefitting",
        name: "Pipefitting",
        displayPosition: 4,
        certIds: ["C-0221"],
      },
    ],
  },
  {
    key: "electrical",
    name: "Electrical",
    nameEs: "Electricidad",
    icon: seedIcon("electrical.svg", 553, electricalIcon),
    displayPosition: 3,
    certIds: ["C-0298"],
    subIndustries: [
      {
        key: "electrical-residential",
        name: "Residential",
        displayPosition: 1,
        certIds: ["C-0242"],
      },
      {
        key: "electrical-commercial",
        name: "Commercial",
        displayPosition: 2,
        certIds: [],
      },
      {
        key: "electrical-industrial",
        name: "Industrial",
        displayPosition: 3,
        certIds: ["C-0341"],
      },
    ],
  },
];

/* ── The live Industry list ──
 * App owns the Industries (the Industries page edits them) and mirrors them
 * here, so the Certifications page's Industries modal, filters and columns
 * read the current names and order rather than the seed. Membership lives on
 * the Certification (`Certification.industries`, tag keys); an Industry's or
 * Sub-Industry's `certIds` is only its display ORDER for the tagged ones. */
let liveIndustries: Industry[] = industries;
const liveIndustryListeners = new Set<() => void>();
export function setLiveIndustries(list: Industry[]) {
  if (list === liveIndustries) return;
  liveIndustries = list;
  liveIndustryListeners.forEach((l) => l());
}
export function getLiveIndustries(): Industry[] {
  return liveIndustries;
}
export function useLiveIndustries(): Industry[] {
  return useSyncExternalStore(
    (l) => {
      liveIndustryListeners.add(l);
      return () => liveIndustryListeners.delete(l);
    },
    getLiveIndustries,
  );
}

export type IndustryTagOption = { key: string; label: string };

/** Every taggable Industry and Sub-Industry, in browse order: each Industry
 *  ("HVAC") followed by its Sub-Industries ("HVAC › Residential"). */
export function industryTagOptions(inds: Industry[] = liveIndustries): IndustryTagOption[] {
  return [...inds]
    .sort((a, b) => a.displayPosition - b.displayPosition)
    .flatMap((ind) => [
      { key: ind.key, label: ind.name },
      ...[...ind.subIndustries]
        .sort((a, b) => a.displayPosition - b.displayPosition)
        .map((sub) => ({ key: sub.key, label: `${ind.name} › ${sub.name}` })),
    ]);
}

/** "HVAC" or "HVAC › Residential" for a tag key; "" when the key no longer
 *  names an Industry (it was deleted). */
export function industryTagLabel(key: string, inds: Industry[] = liveIndustries): string {
  for (const ind of inds) {
    if (ind.key === key) return ind.name;
    const sub = ind.subIndustries.find((s) => s.key === key);
    if (sub) return `${ind.name} › ${sub.name}`;
  }
  return "";
}

/** A Certification's tags as labels, in browse order; unknown keys dropped. */
export function industryTagLabels(tags: readonly string[], inds: Industry[] = liveIndustries): string[] {
  const opts = industryTagOptions(inds);
  return opts.filter((o) => tags.includes(o.key)).map((o) => o.label);
}

/** A Certification's tags as one display string ("HVAC, HVAC › Residential"),
 *  "" when untagged. */
export function certIndustryText(tags: readonly string[], inds: Industry[] = liveIndustries): string {
  return industryTagLabels(tags, inds).join(", ");
}

/* ── Membership vs. display order ──
 * A scope's Certifications are the ones whose `industries` hold its key.
 * `certIds` only orders them: tagged ids in their saved order, then any newly
 * tagged ones appended (in catalog order); ids no longer tagged drop out. */
function orderTagged(order: string[], tagged: string[]): string[] {
  const set = new Set(tagged);
  const kept = order.filter((id) => set.has(id));
  const known = new Set(kept);
  return [...kept, ...tagged.filter((id) => !known.has(id))];
}
const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/** The Industries with every `certIds` matched to the Certifications' tags.
 *  Returns `inds` itself when nothing changed, so it is safe in a state
 *  updater or an effect. */
export function syncIndustryOrder(inds: Industry[], certs: readonly Certification[]): Industry[] {
  const byTag = new Map<string, string[]>();
  for (const c of certs) {
    for (const k of c.industries) {
      const list = byTag.get(k);
      if (list) list.push(c.id);
      else byTag.set(k, [c.id]);
    }
  }
  let changed = false;
  const next = inds.map((ind) => {
    const certIds = orderTagged(ind.certIds, byTag.get(ind.key) ?? []);
    let subChanged = false;
    const subIndustries = ind.subIndustries.map((sub) => {
      const ids = orderTagged(sub.certIds, byTag.get(sub.key) ?? []);
      if (sameIds(ids, sub.certIds)) return sub;
      subChanged = true;
      return { ...sub, certIds: ids };
    });
    const idsChanged = !sameIds(certIds, ind.certIds);
    if (!idsChanged && !subChanged) return ind;
    changed = true;
    return { ...ind, certIds: idsChanged ? certIds : ind.certIds, subIndustries };
  });
  return changed ? next : inds;
}
