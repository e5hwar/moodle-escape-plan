import { questionById, type Question } from "./questionBank";

/* A form is live the moment it is created — there is no draft/activation
   step. Disabled stops it firing (mappings and responses are preserved);
   Deleted is a tombstone: the record stays for its responses, but the form is
   gone from the list. */
export type FormStatus = "active" | "disabled" | "deleted";

export type LinkStatus = "active" | "inactive";

/* A form doesn't own questions — it links them from the Question Bank.
   Order is the array order; mandatory + status live on the link, so the
   same question can be mandatory in one form and optional in another. */
export type FormQuestionLink = {
  questionId: string;
  mandatory: boolean;
  status: LinkStatus;
  linkedAt: string;
  deactivatedAt?: string;
};

export type TriggerKind = "task" | "certification";

export type FormTrigger = {
  id: string;
  kind: TriggerKind;
  refId: string;
  refName: string;
  mappedAt: string;
};

export type FeedbackForm = {
  id: string;
  name: string;
  status: FormStatus;
  questions: FormQuestionLink[];
  triggers: FormTrigger[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
};

export function activeLinks(form: FeedbackForm): FormQuestionLink[] {
  return form.questions.filter((l) => l.status === "active");
}

export function nextFormId(taken: FeedbackForm[]): string {
  let id: string;
  do {
    const n = Math.floor(Math.random() * 9000) + 1000;
    id = `FB-${String(n).padStart(4, "0")}`;
  } while (taken.some((f) => f.id === id));
  return id;
}

/* Duplicate links the SAME Question Bank questions, same order, same mandatory
   flags. The two forms' lists are fully independent after this copy; triggers
   do NOT carry over per spec. */
export function makeDuplicateForm(all: FeedbackForm[], src: FeedbackForm): FeedbackForm {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: nextFormId(all),
    name: `${src.name || "Untitled form"} (copy)`,
    status: "active",
    questions: activeLinks(src).map((l) => ({
      questionId: l.questionId,
      mandatory: l.mandatory,
      status: "active" as const,
      linkedAt: today,
    })),
    triggers: [],
    createdBy: "You",
    createdAt: today,
    updatedAt: today,
    responseCount: 0,
  };
}

export function inactiveLinks(form: FeedbackForm): FormQuestionLink[] {
  return form.questions.filter((l) => l.status === "inactive");
}

/* An answer is a fixed record of what the user was shown: it pins the
   Question Bank version they answered (questions keep evolving after). */
export type ResponseAnswer = {
  questionId: string;
  questionVersion: number;
  optionIndexes?: number[]; // MCQ single/multi — indexes into question.options
  otherText?: string;
  tfValue?: boolean;
  matches?: { left: string; right: string }[];
  text?: string;
  files?: { name: string; sizeMb: number }[];
  scaleValue?: number;
};

export type FormResponse = {
  id: string;
  formId: string;
  userId: string;
  userName: string;
  userEmail: string;
  anonymized?: boolean; // account deleted — response kept, identity stripped
  triggerKind: TriggerKind;
  triggerName: string;
  submittedAt: string;
  answers: ResponseAnswer[];
};

// ---------------------- Seed data ----------------------

const link = (
  questionId: string,
  mandatory: boolean,
  linkedAt: string,
  status: LinkStatus = "active",
  deactivatedAt?: string,
): FormQuestionLink => ({ questionId, mandatory, status, linkedAt, deactivatedAt });

export const feedbackForms: FeedbackForm[] = [
  {
    id: "FB-0007",
    name: "EPA 608 — Post-Cert Satisfaction",
    status: "active",
    questions: [
      link("Q-10450", true, "2026-02-10"),
      link("Q-10451", false, "2026-02-10"),
      link("Q-10452", true, "2026-02-10"),
      link("Q-10453", true, "2026-03-14"),
      link("Q-10439", false, "2026-03-14"),
      link("Q-10423", false, "2026-04-22"),
      link("Q-10454", false, "2026-04-22"),
      link("Q-10440", false, "2026-02-10", "inactive", "2026-05-04"),
    ],
    triggers: [
      { id: "tr-1", kind: "certification", refId: "C-0421", refName: "EPA 608 Universal", mappedAt: "2026-04-12" },
      { id: "tr-2", kind: "certification", refId: "C-0420", refName: "EPA 608 Type I", mappedAt: "2026-04-12" },
      { id: "tr-3", kind: "certification", refId: "C-0419", refName: "EPA 608 Type II", mappedAt: "2026-04-12" },
    ],
    createdBy: "Maya Chen",
    createdAt: "2026-02-10",
    updatedAt: "2026-05-04",
    responseCount: 1284,
  },
  {
    id: "FB-0006",
    name: "HVAC Field Tools — Quick Pulse",
    status: "active",
    questions: [
      link("Q-10455", true, "2026-04-18"),
      link("Q-10456", false, "2026-04-18"),
      link("Q-10457", false, "2026-04-30"),
    ],
    triggers: [
      { id: "tr-4", kind: "task", refId: "T-1654", refName: "HVAC Field Tools Walkthrough", mappedAt: "2026-04-30" },
    ],
    createdBy: "Priya Iyer",
    createdAt: "2026-04-18",
    updatedAt: "2026-04-30",
    responseCount: 342,
  },
  {
    id: "FB-0005",
    name: "Hands-On Task — Field Reflection",
    status: "active",
    questions: [
      link("Q-10458", true, "2026-03-22"),
      link("Q-10459", false, "2026-03-22"),
      link("Q-10460", false, "2026-03-22"),
    ],
    triggers: [
      { id: "tr-5", kind: "task", refId: "T-1432", refName: "Field Visit – Brazing Joints", mappedAt: "2026-03-22" },
    ],
    createdBy: "Diego Ramos",
    createdAt: "2026-03-22",
    updatedAt: "2026-03-22",
    responseCount: 187,
  },
  {
    id: "FB-0004",
    name: "NATE Ready To Work — Exam Feedback",
    status: "active",
    questions: [link("Q-10461", true, "2026-05-12")],
    triggers: [],
    createdBy: "You",
    createdAt: "2026-05-12",
    updatedAt: "2026-05-12",
    responseCount: 0,
  },
  {
    id: "FB-0003",
    name: "Plumbing Pilot — Beta Tester Feedback",
    status: "active",
    questions: [
      link("Q-10464", true, "2026-03-30"),
      link("Q-10465", false, "2026-03-30"),
      link("Q-10436", false, "2026-04-15"),
    ],
    triggers: [
      { id: "tr-6", kind: "certification", refId: "C-0388", refName: "Certified Plumbing Technician", mappedAt: "2026-04-02" },
    ],
    createdBy: "Maya Chen",
    createdAt: "2026-03-30",
    updatedAt: "2026-04-15",
    responseCount: 56,
  },
  {
    id: "FB-0002",
    name: "Old EPA Survey (Q1)",
    status: "disabled",
    questions: [link("Q-10450", false, "2025-11-04")],
    // Preserved but inactive while the form is disabled.
    triggers: [
      { id: "tr-8", kind: "certification", refId: "C-0299", refName: "EPA 608 Practice Path (legacy)", mappedAt: "2025-11-06" },
    ],
    createdBy: "Akash Patel",
    createdAt: "2025-11-04",
    updatedAt: "2026-02-09",
    responseCount: 891,
  },
  {
    id: "FB-0001",
    name: "OSHA Safety — Course Quality",
    status: "active",
    questions: [
      link("Q-10462", true, "2026-01-15"),
      link("Q-10463", false, "2026-01-15"),
      link("Q-10452", false, "2026-01-18"),
    ],
    triggers: [
      { id: "tr-7", kind: "certification", refId: "C-0301", refName: "OSHA 10 — Construction", mappedAt: "2026-01-18" },
    ],
    createdBy: "Priya Iyer",
    createdAt: "2026-01-15",
    updatedAt: "2026-01-18",
    responseCount: 612,
  },
];

/* The seeds carry fixed calendar stamps, but the page reads against a real
   clock — its Date Range defaults to Last 30 Days, and nothing seeded in early
   2026 would land in it. Rescale the whole seeded span (form stamps, question
   links and trigger mappings alike) onto the 120 days before today, keeping
   the order and relative spacing intact so every date stays coherent with the
   responses generated below. */
const DAY_MS = 24 * 60 * 60 * 1000;

export const TODAY_MS = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
})();

export function isoDaysAgo(days: number): string {
  const d = new Date(TODAY_MS - days * DAY_MS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

(function rescaleSeedDates(forms: FeedbackForm[]) {
  const stamps = forms.flatMap((f) => [
    Date.parse(f.createdAt),
    Date.parse(f.updatedAt),
    ...f.questions.flatMap((l) =>
      [Date.parse(l.linkedAt), l.deactivatedAt ? Date.parse(l.deactivatedAt) : NaN],
    ),
    ...f.triggers.map((t) => Date.parse(t.mappedAt)),
  ]).filter((t) => !Number.isNaN(t));
  const oldest = Math.min(...stamps);
  const newest = Math.max(...stamps);
  const span = Math.max(1, newest - oldest);
  // newest stamp → 2 days ago, oldest → 120 days ago.
  const shift = (iso: string) =>
    isoDaysAgo(Math.round(2 + ((newest - Date.parse(iso)) / span) * 118));
  forms.forEach((f) => {
    f.createdAt = shift(f.createdAt);
    f.updatedAt = shift(f.updatedAt);
    f.questions.forEach((l) => {
      l.linkedAt = shift(l.linkedAt);
      if (l.deactivatedAt) l.deactivatedAt = shift(l.deactivatedAt);
    });
    f.triggers.forEach((t) => {
      t.mappedAt = shift(t.mappedAt);
    });
  });
})(feedbackForms);

// ----- Mock available triggers (Tasks + Certifications) for the trigger picker

export type TriggerOption = {
  id: string;
  kind: TriggerKind;
  refId: string;
  refName: string;
  industry?: string;
  // Quiz Task that requires proctoring review — feedback fires on pass,
  // even while the attempt is still In-Review.
  proctored?: boolean;
};

// Catalog only — which form (if any) occupies a trigger is derived from
// live form state, so the at-most-one-form rule tracks runtime changes.
export const AVAILABLE_TRIGGERS: TriggerOption[] = [
  // Certifications
  { id: "ot-c1", kind: "certification", refId: "C-0421", refName: "EPA 608 Universal", industry: "HVAC", proctored: true },
  { id: "ot-c2", kind: "certification", refId: "C-0420", refName: "EPA 608 Type I", industry: "HVAC › Residential", proctored: true },
  { id: "ot-c3", kind: "certification", refId: "C-0419", refName: "EPA 608 Type II", industry: "HVAC › Commercial", proctored: true },
  { id: "ot-c4", kind: "certification", refId: "C-0418", refName: "EPA 609 Motor Vehicle A/C", industry: "Automotive", proctored: true },
  { id: "ot-c5", kind: "certification", refId: "C-0388", refName: "Certified Plumbing Technician", industry: "Plumbing" },
  { id: "ot-c6", kind: "certification", refId: "C-0301", refName: "OSHA 10 — Construction", industry: "Safety" },
  { id: "ot-c7", kind: "certification", refId: "C-0302", refName: "OSHA 30 — Construction", industry: "Safety" },
  { id: "ot-c8", kind: "certification", refId: "C-0411", refName: "NATE Ready To Work", industry: "HVAC" },
  { id: "ot-c9", kind: "certification", refId: "C-0412", refName: "NATE Core", industry: "HVAC" },
  { id: "ot-c10", kind: "certification", refId: "C-0500", refName: "Solar Installer (Pilot)", industry: "Solar" },
  { id: "ot-c11", kind: "certification", refId: "C-0511", refName: "Welding Certification", industry: "Welding" },

  // Tasks
  { id: "ot-t1", kind: "task", refId: "T-1432", refName: "Field Visit – Brazing Joints", industry: "HVAC" },
  { id: "ot-t2", kind: "task", refId: "T-1654", refName: "HVAC Field Tools Walkthrough", industry: "HVAC" },
  { id: "ot-t3", kind: "task", refId: "T-1543", refName: "Refrigerant Pressure Chart", industry: "HVAC" },
  { id: "ot-t4", kind: "task", refId: "T-1876", refName: "EPA Certification Lookup", industry: "HVAC" },
  { id: "ot-t5", kind: "task", refId: "T-2104", refName: "Tool Inventory Photo", industry: "General" },
  { id: "ot-t6", kind: "task", refId: "T-1908", refName: "Pipe Threading Practical", industry: "Plumbing" },
  { id: "ot-t7", kind: "task", refId: "T-1722", refName: "Multimeter Safety Quiz", industry: "Electrical", proctored: true },
];

// ----- Mock responses ----------

const NAMES = [
  "Carlos Mendez",
  "Jessica Tan",
  "Marcus Johnson",
  "Aisha Patel",
  "Tyler Williams",
  "Maria Gonzalez",
  "Brandon Lee",
  "Sofia Rodriguez",
  "Kevin O'Brien",
  "Linda Park",
  "Devon Walker",
  "Hiro Tanaka",
  "Amelia Foster",
  "Sam Garcia",
  "Riley Thompson",
  "Priya Sharma",
  "Jordan Reed",
  "Naomi Adams",
  "Ethan Nguyen",
  "Olivia Brown",
];

const SHORT_SAMPLES = [
  "Great course overall, learned a lot!",
  "The videos were clear but the practice questions could be harder.",
  "Loved the hands-on portions. More of those please.",
  "Felt rushed at the end. Could use more time on refrigerant types.",
  "Honestly the proctoring made me nervous but the content was solid.",
  "Some screens were laggy on my phone.",
  "Bilingual support was helpful — gracias!",
  "Nothing to add, it was solid.",
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function answerFor(
  q: Question,
  qVersion: number,
  r: () => number,
  i: number,
): ResponseAnswer {
  const base = { questionId: q.id, questionVersion: qVersion };
  switch (q.type) {
    case "Linear scale": {
      const min = q.scale?.min ?? 1;
      const max = q.scale?.max ?? 5;
      // Skew higher for satisfaction
      const value = Math.min(max, Math.max(min, Math.round(min + (max - min) * (0.4 + r() * 0.6))));
      return { ...base, scaleValue: value };
    }
    case "Multiple choice": {
      const opts = q.options ?? [];
      if (opts.length === 0) return base;
      if (q.otherOption && r() < 0.1) {
        return { ...base, otherText: "Custom response from user" };
      }
      return { ...base, optionIndexes: [Math.floor(r() * opts.length)] };
    }
    case "Multiple select": {
      const opts = q.options ?? [];
      if (opts.length === 0) return base;
      const count = 1 + Math.floor(r() * Math.min(3, opts.length));
      const picked = new Set<number>();
      while (picked.size < count) picked.add(Math.floor(r() * opts.length));
      return { ...base, optionIndexes: Array.from(picked).sort((a, b) => a - b) };
    }
    case "True/False":
      return { ...base, tfValue: r() < 0.7 };
    case "Match the following": {
      const pairs = (q.pairs ?? []).filter((p) => p.left);
      const rights = (q.pairs ?? []).map((p) => p.right);
      // Users mostly match correctly; sometimes swap a right-hand answer.
      return {
        ...base,
        matches: pairs.map((p) => ({
          left: p.left,
          right: r() < 0.75 ? p.right : rights[Math.floor(r() * rights.length)],
        })),
      };
    }
    case "Short answer":
      return { ...base, text: SHORT_SAMPLES[Math.floor(r() * SHORT_SAMPLES.length)] };
    case "File upload":
      return {
        ...base,
        files: [{ name: `submission-${i}.jpg`, sizeMb: Math.round((r() * 8 + 0.4) * 10) / 10 }],
      };
  }
}

function mkResponses(
  form: FeedbackForm,
  count: number,
  seed: number,
  // Responses spread backwards from `endDaysAgo` — disabled forms date theirs
  // before they were disabled; a wide span lets some predate link deactivations.
  opts: { endDaysAgo?: number; spanDays?: number } = {},
): FormResponse[] {
  if (form.triggers.length === 0) return [];
  const { endDaysAgo = 1, spanDays = 60 } = opts;
  const r = rng(seed);
  const responses: FormResponse[] = [];
  for (let i = 0; i < count; i++) {
    const name = NAMES[Math.floor(r() * NAMES.length)];
    const tr = form.triggers[Math.floor(r() * form.triggers.length)];
    const dayOffset = Math.floor(r() * spanDays);
    const submittedAt = isoDaysAgo(endDaysAgo + dayOffset);
    // Roughly 1 in 12 respondents has since deleted their account —
    // the response is kept, de-identified.
    const anonymized = r() < 0.08;

    const answers: ResponseAnswer[] = [];
    for (const l of form.questions) {
      const q = questionById(l.questionId);
      if (!q) continue;
      // Inactive links: only responses submitted while the link was still
      // active can carry an answer to it. Mandatory questions are always
      // answered on submit; optional ones are sometimes skipped.
      if (l.status === "inactive" && l.deactivatedAt && submittedAt >= l.deactivatedAt) continue;
      if (!l.mandatory && r() < 0.25) continue;
      // Questions get edited after responses land — some answers stay
      // pinned to the previous Question Bank version.
      const qVersion = q.version > 1 && r() < 0.4 ? q.version - 1 : q.version;
      answers.push(answerFor(q, qVersion, r, i));
    }

    responses.push({
      id: `R-${form.id}-${String(i).padStart(4, "0")}`,
      formId: form.id,
      userId: anonymized ? `ANON-${String(7000 + i)}` : `U-${1000 + i}`,
      userName: anonymized ? "Deleted account" : name,
      userEmail: anonymized ? "" : name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
      anonymized: anonymized || undefined,
      triggerKind: tr.kind,
      triggerName: tr.refName,
      submittedAt,
      answers,
    });
  }
  return responses;
}

export const formResponses: Record<string, FormResponse[]> = {
  // 120-day span so a share of responses predate Q-10440's 2026-05-04
  // deactivation and legitimately carry answers to it.
  "FB-0007": mkResponses(feedbackForms[0], 60, 17, { spanDays: 110 }),
  "FB-0006": mkResponses(feedbackForms[1], 30, 41),
  "FB-0005": mkResponses(feedbackForms[2], 25, 63),
  "FB-0003": mkResponses(feedbackForms[4], 20, 99),
  // Disabled a while back — all its responses predate that.
  "FB-0002": mkResponses(feedbackForms[5], 25, 77, { endDaysAgo: 60, spanDays: 60 }),
  "FB-0001": mkResponses(feedbackForms[6], 35, 123),
};
