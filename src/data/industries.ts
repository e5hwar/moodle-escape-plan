export type CareerStage = "Apprentice" | "Journeyman" | "Master";

export type IndustryCert = {
  id: string;
  name: string;
  stage: CareerStage;
  hours: number;
};

export type SubIndustry = {
  key: string;
  name: string;
  // Spanish translation of the name, shown to Spanish-locale learners
  nameEs?: string;
  // Whether this Sub-Industry is visible to learners
  hidden?: boolean;
  displayPosition: number;
  // Ordered cert ids tagged at this sub-industry level
  certIds: string[];
};

export type Industry = {
  key: string;
  name: string;
  // Spanish translation of the name, shown to Spanish-locale learners
  nameEs?: string;
  // Whether this Industry is visible to learners
  hidden?: boolean;
  displayPosition: number;
  subIndustries: SubIndustry[];
  // Ordered cert ids tagged at the industry level only (not via sub-industries)
  certIds: string[];
};

// ─── Cert pool ──────────────────────────────────────────────────────────────
// These are the certifications referenced by the tagging structure. Names,
// stages, and hours mirror the mockups; ids are stable and used for "Also
// tagged in" inference plus the Add Certifications picker.
export const certPool: IndustryCert[] = [
  { id: "C-1001", name: "HVAC Fundamentals", stage: "Apprentice", hours: 8 },
  { id: "C-1002", name: "EPA 608 Universal", stage: "Journeyman", hours: 12 },
  { id: "C-1003", name: "NATE Core", stage: "Journeyman", hours: 16 },
  { id: "C-1004", name: "HVAC Math & Tools", stage: "Apprentice", hours: 4 },
  { id: "C-1005", name: "Refrigerant Identification", stage: "Journeyman", hours: 3 },

  { id: "C-1010", name: "Residential AC Installation", stage: "Journeyman", hours: 14 },
  { id: "C-1011", name: "Indoor Air Quality (Residential)", stage: "Apprentice", hours: 5 },
  { id: "C-1012", name: "EPA 608 Type I", stage: "Apprentice", hours: 6 },

  { id: "C-1020", name: "EPA 608 Type II", stage: "Apprentice", hours: 8 },
  { id: "C-1021", name: "Commercial Refrigeration Systems", stage: "Master", hours: 20 },

  { id: "C-1030", name: "Heat Pump Service Pro", stage: "Journeyman", hours: 12 },
  { id: "C-1031", name: "Ductwork Design Fundamentals", stage: "Journeyman", hours: 10 },
];

// ─── Tagging ────────────────────────────────────────────────────────────────
export const industries: Industry[] = [
  {
    key: "hvac",
    name: "HVAC",
    nameEs: "Climatización (HVAC)",
    displayPosition: 1,
    certIds: ["C-1001", "C-1002", "C-1003", "C-1004", "C-1005"],
    subIndustries: [
      {
        key: "hvac-residential",
        name: "Residential",
        displayPosition: 1,
        certIds: [
          "C-1010", "C-1011", "C-1012",
          "P-2001", "P-2002", "P-2003", "P-2004", "P-2005",
          "P-2006", "P-2007", "P-2008", "P-2009",
        ],
      },
      {
        key: "hvac-commercial",
        name: "Commercial",
        displayPosition: 2,
        certIds: ["C-1020", "C-1021", "P-2010", "P-2011", "P-2012", "P-2013", "P-2014", "P-2015"],
      },
      {
        key: "hvac-industrial",
        name: "Industrial",
        displayPosition: 3,
        certIds: ["P-2016", "P-2017", "P-2018", "P-2019"],
      },
    ],
  },
  {
    key: "plumbing",
    name: "Plumbing",
    nameEs: "Plomería",
    displayPosition: 2,
    certIds: ["P-3001", "P-3002", "P-3003"],
    subIndustries: [
      {
        key: "plumbing-residential",
        name: "Residential",
        displayPosition: 1,
        certIds: ["P-3010", "P-3011", "P-3012", "P-3013", "P-3014"],
      },
      {
        key: "plumbing-commercial",
        name: "Commercial",
        displayPosition: 2,
        certIds: ["P-3020", "P-3021", "P-3022"],
      },
      {
        key: "plumbing-service",
        name: "Service & Repair",
        displayPosition: 3,
        certIds: ["P-3030", "P-3031", "P-3032", "P-3033"],
      },
      {
        key: "plumbing-pipefitting",
        name: "Pipefitting",
        displayPosition: 4,
        certIds: ["P-3040", "P-3041"],
      },
    ],
  },
  {
    key: "electrical",
    name: "Electrical",
    nameEs: "Electricidad",
    displayPosition: 3,
    certIds: ["P-4001", "P-4002"],
    subIndustries: [
      {
        key: "electrical-residential",
        name: "Residential",
        displayPosition: 1,
        certIds: ["P-4010", "P-4011", "P-4012", "P-4013"],
      },
      {
        key: "electrical-commercial",
        name: "Commercial",
        displayPosition: 2,
        certIds: ["P-4020", "P-4021", "P-4022", "P-4023"],
      },
      {
        key: "electrical-industrial",
        name: "Industrial",
        displayPosition: 3,
        certIds: ["P-4030", "P-4031", "P-4032"],
      },
    ],
  },
  {
    key: "solar",
    name: "Solar & Renewables",
    displayPosition: 4,
    certIds: ["P-5001", "P-5002"],
    subIndustries: [
      {
        key: "solar-pv",
        name: "Solar PV",
        displayPosition: 1,
        certIds: ["P-5010", "P-5011", "P-5012"],
      },
      {
        key: "solar-wind",
        name: "Wind",
        displayPosition: 2,
        certIds: ["P-5020"],
      },
      {
        key: "solar-storage",
        name: "Storage & Batteries",
        displayPosition: 3,
        certIds: ["P-5030", "P-5031"],
      },
    ],
  },
  {
    key: "welding",
    name: "Welding",
    displayPosition: 5,
    certIds: ["P-6001", "P-6002", "P-6003", "P-6004"],
    subIndustries: [],
  },
  {
    key: "osha",
    name: "OSHA & Safety",
    displayPosition: 6,
    certIds: ["P-7001"],
    subIndustries: [
      {
        key: "osha-general",
        name: "General Industry",
        displayPosition: 1,
        certIds: ["P-7010", "P-7011", "P-7012", "P-7013"],
      },
      {
        key: "osha-construction",
        name: "Construction",
        displayPosition: 2,
        certIds: ["P-7020", "P-7021", "P-7022"],
      },
      {
        key: "osha-programs",
        name: "Safety Programs",
        displayPosition: 3,
        certIds: ["P-7030", "P-7031"],
      },
    ],
  },
  {
    key: "refrigeration",
    name: "Refrigeration",
    displayPosition: 7,
    // Note: shares certs with HVAC (EPA 608 Universal, Refrigerant Identification,
    // Commercial Refrigeration Systems) so the "Also tagged in" lines render.
    certIds: ["C-1002", "C-1005", "C-1021"],
    subIndustries: [],
  },
];

// Placeholder pool — fills out the picker so filters and pagination feel real.
export const placeholderPool: IndustryCert[] = (() => {
  const out: IndustryCert[] = [];
  const stages: CareerStage[] = ["Apprentice", "Journeyman", "Master"];
  let n = 2001;
  const families = ["P-2", "P-3", "P-4", "P-5", "P-6", "P-7"];
  for (const fam of families) {
    for (let i = 0; i < 50; i++) {
      const id = `${fam}${String(n).padStart(3, "0").slice(-3)}`;
      out.push({
        id,
        name: `Placeholder Cert ${id}`,
        stage: stages[i % 3],
        hours: 2 + (i % 10),
      });
      n++;
    }
  }
  return out;
})();

export const allCertsById: Record<string, IndustryCert> = (() => {
  const m: Record<string, IndustryCert> = {};
  for (const c of certPool) m[c.id] = c;
  for (const c of placeholderPool) if (!m[c.id]) m[c.id] = c;
  return m;
})();
