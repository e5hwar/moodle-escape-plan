export type FormStatus = "draft" | "active" | "archived";

export type ResponseType =
  | "single-select"
  | "multi-select"
  | "short-answer"
  | "file-upload"
  | "linear-scale";

export type QuestionOption = {
  id: string;
  textEn: string;
  textEs?: string;
  imageHint?: string;
};

export type Question = {
  id: string;
  textEn: string;
  textEs?: string;
  mediaHint?: string;
  type: ResponseType;
  required: boolean;
  // Select-type specific
  options?: QuestionOption[];
  allowOther?: boolean;
  // Short answer
  charLimit?: number;
  // File upload
  maxFiles?: number;
  maxFileSizeMb?: number;
  // Linear scale
  scaleMin?: number;
  scaleMax?: number;
  scaleLabelMin?: string;
  scaleLabelMax?: string;
};

export type TriggerKind = "task" | "certification";

export type FormTrigger = {
  id: string;
  kind: TriggerKind;
  refId: string;
  refName: string;
  mappedAt: string;
};

export type FormVersionSnapshot = {
  version: number;
  questions: Question[];
  editedBy: string;
  editedAt: string;
  changeSummary: string;
  responseCount: number;
};

export type FeedbackForm = {
  id: string;
  name: string;
  status: FormStatus;
  version: number;
  questions: Question[];
  triggers: FormTrigger[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
  history: FormVersionSnapshot[];
};

export type ResponseAnswer = {
  questionId: string;
  selectedOptionIds?: string[];
  otherText?: string;
  text?: string;
  files?: { name: string; sizeMb: number }[];
  scaleValue?: number;
};

export type FormResponse = {
  id: string;
  formId: string;
  formVersion: number;
  userId: string;
  userName: string;
  userEmail: string;
  triggerKind: TriggerKind;
  triggerName: string;
  submittedAt: string;
  answers: ResponseAnswer[];
};

// ---------------------- Seed data ----------------------

const epaQuestions: Question[] = [
  {
    id: "q-epa-1",
    textEn: "How satisfied are you with the EPA 608 certification course?",
    textEs: "¿Qué tan satisfecho estás con el curso de certificación EPA 608?",
    type: "linear-scale",
    required: true,
    scaleMin: 1,
    scaleMax: 10,
    scaleLabelMin: "Extremely disappointed",
    scaleLabelMax: "Extremely satisfied",
  },
  {
    id: "q-epa-2",
    textEn: "Which parts of the course were most useful?",
    textEs: "¿Qué partes del curso fueron más útiles?",
    type: "multi-select",
    required: false,
    allowOther: true,
    options: [
      { id: "o1", textEn: "Video lessons", textEs: "Lecciones en video" },
      { id: "o2", textEn: "Practice quizzes", textEs: "Cuestionarios de práctica" },
      { id: "o3", textEn: "Hands-on tasks", textEs: "Tareas prácticas" },
      { id: "o4", textEn: "Reference materials", textEs: "Materiales de referencia" },
      { id: "o5", textEn: "Proctored exam", textEs: "Examen supervisado" },
    ],
  },
  {
    id: "q-epa-3",
    textEn: "How likely are you to recommend SkillCat to a colleague?",
    type: "linear-scale",
    required: true,
    scaleMin: 0,
    scaleMax: 10,
    scaleLabelMin: "Not at all likely",
    scaleLabelMax: "Extremely likely",
  },
  {
    id: "q-epa-4",
    textEn: "Did you face any issues during the exam?",
    type: "single-select",
    required: true,
    options: [
      { id: "o1", textEn: "No issues" },
      { id: "o2", textEn: "Technical issues (audio, video, app)" },
      { id: "o3", textEn: "Content was unclear" },
      { id: "o4", textEn: "Proctoring felt too strict" },
    ],
    allowOther: true,
  },
  {
    id: "q-epa-5",
    textEn: "Anything else you'd like us to know?",
    type: "short-answer",
    required: false,
    charLimit: 512,
  },
];

const hvacQuestions: Question[] = [
  {
    id: "q-h-1",
    textEn: "Rate the quality of the HVAC Field Tools walkthrough.",
    type: "linear-scale",
    required: true,
    scaleMin: 1,
    scaleMax: 5,
    scaleLabelMin: "Poor",
    scaleLabelMax: "Excellent",
  },
  {
    id: "q-h-2",
    textEn: "What would you improve?",
    type: "short-answer",
    required: false,
    charLimit: 512,
  },
  {
    id: "q-h-3",
    textEn: "Upload a photo of your tool kit (optional)",
    type: "file-upload",
    required: false,
    maxFiles: 3,
    maxFileSizeMb: 10,
  },
];

const handsOnQuestions: Question[] = [
  {
    id: "q-ho-1",
    textEn: "Was the assignment clear and easy to follow?",
    type: "single-select",
    required: true,
    options: [
      { id: "o1", textEn: "Yes, very clear" },
      { id: "o2", textEn: "Mostly clear" },
      { id: "o3", textEn: "Somewhat confusing" },
      { id: "o4", textEn: "Very confusing" },
    ],
  },
  {
    id: "q-ho-2",
    textEn: "How long did it take you to complete?",
    type: "single-select",
    required: false,
    options: [
      { id: "o1", textEn: "Under 30 minutes" },
      { id: "o2", textEn: "30–60 minutes" },
      { id: "o3", textEn: "1–2 hours" },
      { id: "o4", textEn: "Over 2 hours" },
    ],
  },
  {
    id: "q-ho-3",
    textEn: "Any feedback for the instructor?",
    type: "short-answer",
    required: false,
    charLimit: 512,
  },
];

export const feedbackForms: FeedbackForm[] = [
  {
    id: "FB-0007",
    name: "EPA 608 — Post-Cert Satisfaction",
    status: "active",
    version: 4,
    questions: epaQuestions,
    triggers: [
      {
        id: "tr-1",
        kind: "certification",
        refId: "C-0421",
        refName: "EPA 608 Universal",
        mappedAt: "2026-04-12",
      },
      {
        id: "tr-2",
        kind: "certification",
        refId: "C-0420",
        refName: "EPA 608 Type I",
        mappedAt: "2026-04-12",
      },
      {
        id: "tr-3",
        kind: "certification",
        refId: "C-0419",
        refName: "EPA 608 Type II",
        mappedAt: "2026-04-12",
      },
    ],
    createdBy: "Maya Chen",
    createdAt: "2026-02-10",
    updatedAt: "2026-05-04",
    responseCount: 1284,
    history: [
      {
        version: 3,
        questions: epaQuestions.slice(0, 4),
        editedBy: "Maya Chen",
        editedAt: "2026-04-22",
        changeSummary: "Added open-ended feedback question",
        responseCount: 412,
      },
      {
        version: 2,
        questions: epaQuestions.slice(0, 3),
        editedBy: "Diego Ramos",
        editedAt: "2026-03-14",
        changeSummary: "Updated scale labels on NPS question",
        responseCount: 287,
      },
      {
        version: 1,
        questions: epaQuestions.slice(0, 2),
        editedBy: "Maya Chen",
        editedAt: "2026-02-10",
        changeSummary: "Initial version",
        responseCount: 195,
      },
    ],
  },
  {
    id: "FB-0006",
    name: "HVAC Field Tools — Quick Pulse",
    status: "active",
    version: 2,
    questions: hvacQuestions,
    triggers: [
      {
        id: "tr-4",
        kind: "task",
        refId: "T-1654",
        refName: "HVAC Field Tools Walkthrough",
        mappedAt: "2026-04-30",
      },
    ],
    createdBy: "Priya Iyer",
    createdAt: "2026-04-18",
    updatedAt: "2026-04-30",
    responseCount: 342,
    history: [
      {
        version: 1,
        questions: hvacQuestions.slice(0, 2),
        editedBy: "Priya Iyer",
        editedAt: "2026-04-18",
        changeSummary: "Initial version",
        responseCount: 124,
      },
    ],
  },
  {
    id: "FB-0005",
    name: "Hands-On Task — Field Reflection",
    status: "active",
    version: 1,
    questions: handsOnQuestions,
    triggers: [
      {
        id: "tr-5",
        kind: "task",
        refId: "T-1432",
        refName: "Field Visit – Brazing Joints",
        mappedAt: "2026-03-22",
      },
    ],
    createdBy: "Diego Ramos",
    createdAt: "2026-03-22",
    updatedAt: "2026-03-22",
    responseCount: 187,
    history: [],
  },
  {
    id: "FB-0004",
    name: "NATE Ready To Work — Exam Feedback",
    status: "draft",
    version: 1,
    questions: [
      {
        id: "q-n-1",
        textEn: "How would you rate the NATE RTW exam difficulty?",
        type: "linear-scale",
        required: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabelMin: "Very easy",
        scaleLabelMax: "Very difficult",
      },
    ],
    triggers: [],
    createdBy: "You",
    createdAt: "2026-05-12",
    updatedAt: "2026-05-12",
    responseCount: 0,
    history: [],
  },
  {
    id: "FB-0003",
    name: "Plumbing Pilot — Beta Tester Feedback",
    status: "active",
    version: 2,
    questions: [
      {
        id: "q-p-1",
        textEn: "Overall, how was the pilot experience?",
        type: "linear-scale",
        required: true,
        scaleMin: 1,
        scaleMax: 10,
        scaleLabelMin: "Terrible",
        scaleLabelMax: "Loved it",
      },
      {
        id: "q-p-2",
        textEn: "Which modules need the most work?",
        type: "multi-select",
        required: false,
        options: [
          { id: "o1", textEn: "Tools & Materials" },
          { id: "o2", textEn: "Code Compliance" },
          { id: "o3", textEn: "Pipe Fitting Basics" },
          { id: "o4", textEn: "Drainage Systems" },
        ],
        allowOther: true,
      },
    ],
    triggers: [
      {
        id: "tr-6",
        kind: "certification",
        refId: "C-0388",
        refName: "Certified Plumbing Technician",
        mappedAt: "2026-04-02",
      },
    ],
    createdBy: "Maya Chen",
    createdAt: "2026-03-30",
    updatedAt: "2026-04-15",
    responseCount: 56,
    history: [
      {
        version: 1,
        questions: [
          {
            id: "q-p-1",
            textEn: "Overall, how was the pilot experience?",
            type: "linear-scale",
            required: true,
            scaleMin: 1,
            scaleMax: 10,
          },
        ],
        editedBy: "Maya Chen",
        editedAt: "2026-03-30",
        changeSummary: "Initial version",
        responseCount: 18,
      },
    ],
  },
  {
    id: "FB-0002",
    name: "Old EPA Survey (Q1)",
    status: "archived",
    version: 3,
    questions: [
      {
        id: "q-old-1",
        textEn: "How satisfied are you with EPA 608?",
        type: "linear-scale",
        required: true,
        scaleMin: 1,
        scaleMax: 5,
      },
    ],
    triggers: [],
    createdBy: "Akash Patel",
    createdAt: "2025-11-04",
    updatedAt: "2026-02-09",
    responseCount: 891,
    history: [],
  },
  {
    id: "FB-0001",
    name: "OSHA Safety — Course Quality",
    status: "active",
    version: 1,
    questions: [
      {
        id: "q-os-1",
        textEn: "Did the OSHA course meet your expectations?",
        type: "single-select",
        required: true,
        options: [
          { id: "o1", textEn: "Exceeded expectations" },
          { id: "o2", textEn: "Met expectations" },
          { id: "o3", textEn: "Below expectations" },
        ],
      },
      {
        id: "q-os-2",
        textEn: "What would you change?",
        type: "short-answer",
        required: false,
        charLimit: 512,
      },
    ],
    triggers: [
      {
        id: "tr-7",
        kind: "certification",
        refId: "C-0301",
        refName: "OSHA 10 — Construction",
        mappedAt: "2026-01-18",
      },
    ],
    createdBy: "Priya Iyer",
    createdAt: "2026-01-15",
    updatedAt: "2026-01-18",
    responseCount: 612,
    history: [],
  },
];

// ----- Mock available triggers (Tasks + Certifications) for the trigger picker

export type TriggerOption = {
  id: string;
  kind: TriggerKind;
  refId: string;
  refName: string;
  industry?: string;
  // formId of the currently-mapped form, if any
  mappedToFormId?: string;
};

export const AVAILABLE_TRIGGERS: TriggerOption[] = [
  // Certifications
  { id: "ot-c1", kind: "certification", refId: "C-0421", refName: "EPA 608 Universal", industry: "HVAC", mappedToFormId: "FB-0007" },
  { id: "ot-c2", kind: "certification", refId: "C-0420", refName: "EPA 608 Type I", industry: "HVAC › Residential", mappedToFormId: "FB-0007" },
  { id: "ot-c3", kind: "certification", refId: "C-0419", refName: "EPA 608 Type II", industry: "HVAC › Commercial", mappedToFormId: "FB-0007" },
  { id: "ot-c4", kind: "certification", refId: "C-0418", refName: "EPA 609 Motor Vehicle A/C", industry: "Automotive" },
  { id: "ot-c5", kind: "certification", refId: "C-0388", refName: "Certified Plumbing Technician", industry: "Plumbing", mappedToFormId: "FB-0003" },
  { id: "ot-c6", kind: "certification", refId: "C-0301", refName: "OSHA 10 — Construction", industry: "Safety", mappedToFormId: "FB-0001" },
  { id: "ot-c7", kind: "certification", refId: "C-0302", refName: "OSHA 30 — Construction", industry: "Safety" },
  { id: "ot-c8", kind: "certification", refId: "C-0411", refName: "NATE Ready To Work", industry: "HVAC" },
  { id: "ot-c9", kind: "certification", refId: "C-0412", refName: "NATE Core", industry: "HVAC" },
  { id: "ot-c10", kind: "certification", refId: "C-0500", refName: "Solar Installer (Pilot)", industry: "Solar" },
  { id: "ot-c11", kind: "certification", refId: "C-0511", refName: "Welding Certification", industry: "Welding" },

  // Tasks
  { id: "ot-t1", kind: "task", refId: "T-1432", refName: "Field Visit – Brazing Joints", industry: "HVAC", mappedToFormId: "FB-0005" },
  { id: "ot-t2", kind: "task", refId: "T-1654", refName: "HVAC Field Tools Walkthrough", industry: "HVAC", mappedToFormId: "FB-0006" },
  { id: "ot-t3", kind: "task", refId: "T-1543", refName: "Refrigerant Pressure Chart", industry: "HVAC" },
  { id: "ot-t4", kind: "task", refId: "T-1876", refName: "EPA Certification Lookup", industry: "HVAC" },
  { id: "ot-t5", kind: "task", refId: "T-2104", refName: "Tool Inventory Photo", industry: "General" },
  { id: "ot-t6", kind: "task", refId: "T-1908", refName: "Pipe Threading Practical", industry: "Plumbing" },
  { id: "ot-t7", kind: "task", refId: "T-1722", refName: "Multimeter Safety Quiz", industry: "Electrical" },
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

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function mkResponses(
  formId: string,
  formVersion: number,
  questions: Question[],
  triggers: FormTrigger[],
  count: number,
  seed: number,
): FormResponse[] {
  if (triggers.length === 0) return [];
  const r = rng(seed);
  const responses: FormResponse[] = [];
  for (let i = 0; i < count; i++) {
    const name = NAMES[Math.floor(r() * NAMES.length)];
    const tr = triggers[Math.floor(r() * triggers.length)];
    const dayOffset = Math.floor(r() * 60);
    const submittedDate = new Date(2026, 4, 16);
    submittedDate.setDate(submittedDate.getDate() - dayOffset);
    const answers: ResponseAnswer[] = questions.map((q) => {
      switch (q.type) {
        case "linear-scale": {
          const min = q.scaleMin ?? 1;
          const max = q.scaleMax ?? 5;
          // Skew higher for satisfaction
          const value = Math.min(
            max,
            Math.max(min, Math.round(min + (max - min) * (0.4 + r() * 0.6))),
          );
          return { questionId: q.id, scaleValue: value };
        }
        case "single-select": {
          if (!q.options || q.options.length === 0) return { questionId: q.id };
          const idx = Math.floor(r() * q.options.length);
          // 10% chance of "Other"
          if (q.allowOther && r() < 0.1) {
            return {
              questionId: q.id,
              otherText: "Custom response from user",
            };
          }
          return {
            questionId: q.id,
            selectedOptionIds: [q.options[idx].id],
          };
        }
        case "multi-select": {
          if (!q.options || q.options.length === 0) return { questionId: q.id };
          const count = 1 + Math.floor(r() * Math.min(3, q.options.length));
          const picked = new Set<string>();
          while (picked.size < count) {
            picked.add(q.options[Math.floor(r() * q.options.length)].id);
          }
          return {
            questionId: q.id,
            selectedOptionIds: Array.from(picked),
          };
        }
        case "short-answer": {
          const samples = [
            "Great course overall, learned a lot!",
            "The videos were clear but the practice questions could be harder.",
            "Loved the hands-on portions. More of those please.",
            "Felt rushed at the end. Could use more time on refrigerant types.",
            "Honestly the proctoring made me nervous but the content was solid.",
            "",
            "Some screens were laggy on my phone.",
            "Bilingual support was helpful — gracias!",
          ];
          const text = samples[Math.floor(r() * samples.length)];
          if (!text) return { questionId: q.id };
          return { questionId: q.id, text };
        }
        case "file-upload": {
          if (r() < 0.4) return { questionId: q.id };
          return {
            questionId: q.id,
            files: [{ name: `submission-${i}.jpg`, sizeMb: Math.round(r() * 8 * 10) / 10 + 0.4 }],
          };
        }
      }
    });
    responses.push({
      id: `R-${formId}-${String(i).padStart(4, "0")}`,
      formId,
      formVersion,
      userId: `U-${1000 + i}`,
      userName: name,
      userEmail: name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
      triggerKind: tr.kind,
      triggerName: tr.refName,
      submittedAt: submittedDate.toISOString().slice(0, 10),
      answers,
    });
  }
  return responses;
}

export const formResponses: Record<string, FormResponse[]> = {
  "FB-0007": mkResponses("FB-0007", 4, epaQuestions, feedbackForms[0].triggers, 60, 17),
  "FB-0006": mkResponses("FB-0006", 2, hvacQuestions, feedbackForms[1].triggers, 30, 41),
  "FB-0005": mkResponses("FB-0005", 1, handsOnQuestions, feedbackForms[2].triggers, 25, 63),
  "FB-0003": mkResponses(
    "FB-0003",
    2,
    feedbackForms[4].questions,
    feedbackForms[4].triggers,
    20,
    99,
  ),
  "FB-0001": mkResponses(
    "FB-0001",
    1,
    feedbackForms[6].questions,
    feedbackForms[6].triggers,
    35,
    123,
  ),
};
