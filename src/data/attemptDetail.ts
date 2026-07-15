/* ────────────────────────────────────────────────────────────────────────────
   Attempt Viewer model.

   Ports the deterministic grading model behind the "View Attempt" page. Two
   shapes of quiz are supported:

   • Sectioned  — a certification-style exam split into sections (Core + Type
     bands). One section is "required to pass"; failing it nullifies every
     other section's pass for that attempt.
   • Flat       — a single graded quiz; the highest grade across attempts wins.

   Everything below is pure: every percentage, point total, banner, and status
   is derived from the seeded question bank + a fixed per-attempt outcome plan,
   so the header summary can never contradict the per-question detail.
   ──────────────────────────────────────────────────────────────────────── */

export const PALETTE = {
  pass: "#5fd0a3",
  fail: "#e98a76",
  amber: "#e6a03c",
  nullified: "#9f93c2",
  accent: "#e97237",
  dim: "#5a5a5e",
  muted: "#8b8b8f",
};

export const MONO = "'IBM Plex Mono', monospace";

export type AttemptUser = { name: string; email: string; initials: string };

/* ─────────────────────────── formatting helpers ─────────────────────────── */

/** "+50%", "−25%", "0%" — signed percentage with a real minus glyph. */
export function signPct(g: number): string {
  return (g > 0 ? "+" : g < 0 ? "−" : "") + Math.abs(g) + "%";
}

export function fmtPct(n: number): string {
  return Math.round(n) + "%";
}

/** "+2 pt", "−1.5 pt" — signed points, trimmed to 2 decimals. */
export function signPts(n: number): string {
  const v = Math.round(n * 100) / 100;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  const a = Number.isInteger(Math.abs(v))
    ? String(Math.abs(v))
    : String(Math.round(Math.abs(v) * 100) / 100);
  return s + a + " pt";
}

/* ──────────────────────────── question bank ─────────────────────────────── */

export type QType = "tf" | "mcq" | "match";

export type BankQuestion = {
  type: QType;
  weight: number;
  text: string;
  feedback: { correct: string; partial?: string; incorrect: string };
  /** tf */
  correctValue?: boolean;
  /** mcq */
  multi?: boolean;
  options?: { k: string; text: string; grade: number }[];
  /** match */
  pairs?: { prompt: string; answer: string }[];
  mode?: "partial" | "allornothing";
  /** populated when expanded into an attempt */
  n?: number;
};

type Outcome = "correct" | "partial" | "wrong" | "blank";
type Response = {
  blank?: boolean;
  value?: boolean;
  selected?: string[];
  matches?: Record<string, string>;
};

/* ───────────────────────── computed view-models ─────────────────────────── */

export type OptionVM = {
  text: string;
  selected: boolean;
  correct: boolean;
  penalty: boolean;
  multi: boolean;
  gradeText: string;
  gradeColor: string;
  tag: string | null;
  tagColor: string | null;
};

export type MatchRowVM = {
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  showCorrect: boolean;
  color: string;
  markLabel: string;
};

export type QuestionVM = {
  n: number;
  nLabel: string;
  blank: boolean;
  percent: number;
  points: number;
  weight: number;
  cat: "pass" | "partial" | "wrong" | "blank";
  resultColor: string;
  typeMeta: string;
  text: string;
  kind: "choice" | "match";
  options: OptionVM[];
  matchRows: MatchRowVM[];
  awardText: string;
  awardColor: string;
  mathLine: string;
  feedbackLabel: string;
  feedbackColor: string;
  feedbackText: string;
  anchorId: string;
};

export type SectionVM = {
  id: string;
  name: string;
  required: boolean;
  pass: number;
  pct: number;
  passed: boolean;
  answered: number;
  total: number;
  questions: QuestionVM[];
  anchorId: string;
};

export type AttemptStatus = "Passed" | "Failed" | "Nullified" | "Auto-submitted";

export type AttemptMeta = {
  id: string;
  label: string;
  date: string;
  duration: string;
  via: string;
  isAuto: boolean;
};

/** Sectioned (certification-style) attempt. */
export type SectionedAttempt = AttemptMeta & {
  sections: SectionVM[];
  qualifying: boolean;
  status: AttemptStatus;
  overall: number;
};

/** Flat (single-quiz) attempt. */
export type FlatAttempt = AttemptMeta & {
  questions: QuestionVM[];
  overall: number;
  passed: boolean;
  status: AttemptStatus;
  answered: number;
  total: number;
  pts: number;
  w: number;
};

export type SectionedModel = {
  kind: "sectioned";
  user: AttemptUser;
  quizName: string;
  built: Record<string, SectionedAttempt>;
  attMeta: AttemptMeta[];
  secMeta: { id: string; name: string; pass: number; required: boolean }[];
  highest: Record<string, number>;
  totalQ: number;
  defaultSel: string;
};

export type FlatModel = {
  kind: "flat";
  user: AttemptUser;
  quizName: string;
  built: Record<string, FlatAttempt>;
  attMeta: AttemptMeta[];
  pass: number;
  highest: number;
  complete: boolean;
  totalQ: number;
  defaultSel: string;
};

export type AttemptDetailModel = SectionedModel | FlatModel;

/* ─────────────────────────── grading primitives ─────────────────────────── */

const P = PALETTE;

function typeLabel(q: BankQuestion): string {
  return q.type === "tf"
    ? "True / False"
    : q.type === "match"
    ? "Match the following"
    : "Multiple choice";
}

type GradeOption = { k: string; text: string; grade: number };

function gradeChoice(
  options: GradeOption[],
  sel: string[],
): { raw: number; percent: number } {
  let raw = 0;
  sel.forEach((k) => {
    const o = options.find((x) => x.k === k);
    if (o) raw += o.grade;
  });
  return { raw, percent: Math.min(raw, 100) };
}

function optsMin(options: GradeOption[], sel: string[], multi: boolean): OptionVM[] {
  return options.map((o) => {
    const selected = sel.includes(o.k);
    const correct = o.grade > 0;
    const penalty = o.grade < 0;
    const gradeColor = selected
      ? o.grade > 0
        ? P.pass
        : o.grade < 0
        ? P.fail
        : P.muted
      : P.dim;
    let tag: string | null = null;
    let tagColor: string | null = null;
    if (correct && !selected) {
      tag = "correct answer";
      tagColor = P.pass;
    } else if (penalty && selected) {
      tag = "penalty";
      tagColor = P.fail;
    }
    return {
      text: o.text,
      selected,
      correct,
      penalty,
      multi,
      gradeText: signPct(o.grade),
      gradeColor,
      tag,
      tagColor,
    };
  });
}

function mathMin(
  options: GradeOption[],
  sel: string[],
  percent: number,
  weight: number,
  points: number,
  raw: number | null,
): string {
  if (!sel.length) return "No answer submitted · 0 pt";
  const parts = sel.map((k) => {
    const o = options.find((x) => x.k === k);
    return o ? `${k} ${signPct(o.grade)}` : k;
  });
  const cap = raw != null && raw > 100 ? ` (capped from ${raw}%)` : "";
  let l =
    parts.join("  +  ") +
    " = " +
    fmtPct(percent) +
    cap +
    " × " +
    weight +
    " pt = " +
    signPts(points);
  if (points < 0) l += "   · negative — Quiz total floored at 0";
  return l;
}

function buildQ(q: BankQuestion, resp: Response): QuestionVM {
  resp = resp || {};
  const blank = !!resp.blank;
  let percent = 0;
  let points = 0;
  let raw = 0;
  let opts: OptionVM[] = [];
  let matchRows: MatchRowVM[] = [];
  let mathLine = "";

  if (q.type === "tf") {
    const options: GradeOption[] = [
      { k: "T", text: "True", grade: q.correctValue ? 100 : 0 },
      { k: "F", text: "False", grade: q.correctValue ? 0 : 100 },
    ];
    const sel = blank ? [] : [resp.value ? "T" : "F"];
    const g = gradeChoice(options, sel);
    raw = g.raw;
    percent = g.percent;
    points = (percent / 100) * q.weight;
    opts = optsMin(options, sel, false);
    mathLine = mathMin(options, sel, percent, q.weight, points, raw);
  } else if (q.type === "mcq") {
    const options = q.options!;
    const sel = blank ? [] : resp.selected || [];
    const g = gradeChoice(options, sel);
    raw = g.raw;
    percent = g.percent;
    points = (percent / 100) * q.weight;
    opts = optsMin(options, sel, !!q.multi);
    mathLine = mathMin(options, sel, percent, q.weight, points, raw);
  } else {
    const total = q.pairs!.length;
    let correct = 0;
    matchRows = q.pairs!.map((p) => {
      const ua = blank ? null : resp.matches ? resp.matches[p.prompt] : null;
      const ok = ua === p.answer;
      if (ok) correct++;
      const color = ua == null ? P.dim : ok ? P.pass : P.fail;
      return {
        prompt: p.prompt,
        userAnswer: ua || "— no match —",
        correctAnswer: p.answer,
        showCorrect: !ok && ua != null,
        color,
        markLabel: ua == null ? "Blank" : ok ? "Correct" : "Incorrect",
      };
    });
    percent =
      q.mode === "allornothing"
        ? correct === total
          ? 100
          : 0
        : (correct / total) * 100;
    points = (percent / 100) * q.weight;
    mathLine = blank
      ? "No answer submitted · 0 pt"
      : `${correct}/${total} pairs correct = ${fmtPct(percent)} × ${q.weight} pt = ${signPts(points)}${
          q.mode === "allornothing" ? "  · All-or-nothing" : ""
        }`;
  }

  const cat: QuestionVM["cat"] = blank
    ? "blank"
    : percent >= 100
    ? "pass"
    : percent > 0
    ? "partial"
    : "wrong";
  const resultColor = blank
    ? P.dim
    : percent >= 100
    ? P.pass
    : percent > 0
    ? P.amber
    : P.fail;
  const fk = blank
    ? "incorrect"
    : percent >= 100
    ? "correct"
    : percent > 0
    ? "partial"
    : "incorrect";
  const feedbackColor =
    fk === "correct" ? P.pass : fk === "partial" ? P.amber : P.fail;

  return {
    n: q.n!,
    nLabel: "Q" + q.n,
    blank,
    percent,
    points,
    weight: q.weight,
    cat,
    resultColor,
    typeMeta: `${typeLabel(q)} · ${q.weight} pt${q.weight > 1 ? "s" : ""}`,
    text: q.text,
    kind: q.type !== "match" ? "choice" : "match",
    options: opts,
    matchRows,
    awardText: `${signPts(points)} · ${fmtPct(percent)}`,
    awardColor: resultColor,
    mathLine,
    feedbackLabel:
      (blank ? "Incorrect" : fk.charAt(0).toUpperCase() + fk.slice(1)) + " —",
    feedbackColor,
    feedbackText: q.feedback[fk as keyof typeof q.feedback] || q.feedback.incorrect,
    anchorId: "",
  };
}

/** Synthesise a learner response that produces the intended outcome. */
function makeResp(q: BankQuestion, outcome: Outcome): Response {
  if (outcome === "blank") return { blank: true };
  if (q.type === "tf")
    return { value: outcome === "wrong" ? !q.correctValue : q.correctValue };
  if (q.type === "mcq") {
    const pos = q.options!.filter((o) => o.grade > 0).map((o) => o.k);
    const neg = q.options!.filter((o) => o.grade < 0).map((o) => o.k);
    const zero = q.options!.filter((o) => o.grade === 0).map((o) => o.k);
    if (outcome === "correct")
      return { selected: q.multi ? pos.slice() : [pos[0]] };
    if (outcome === "partial") {
      if (q.multi)
        return { selected: pos.slice(0, Math.max(1, Math.floor(pos.length / 2))) };
      return { selected: [pos[0]] };
    }
    // wrong
    if (q.multi)
      return {
        selected: neg.length ? [pos[0], neg[0]].filter(Boolean) : [zero[0] || pos[0]],
      };
    return { selected: [zero[0] || neg[0] || q.options![q.options!.length - 1].k] };
  }
  // match
  const ans = q.pairs!.map((p) => p.answer);
  const matches: Record<string, string> = {};
  q.pairs!.forEach((p, i) => {
    if (outcome === "correct") matches[p.prompt] = p.answer;
    else if (outcome === "partial")
      matches[p.prompt] = i % 2 === 0 ? p.answer : ans[(i + 1) % ans.length];
    else
      matches[p.prompt] =
        ans[(i + 1) % ans.length] === p.answer
          ? ans[(i + 2) % ans.length]
          : ans[(i + 1) % ans.length];
  });
  return { matches };
}

/** Stable hash used to scatter correct answers across an attempt. */
function hash(n: number): number {
  let x = ((n + 1) * 2654435761) >>> 0;
  x ^= x >>> 13;
  x = (x * 1274126177) >>> 0;
  x ^= x >>> 16;
  return x % 1000;
}

/* ──────────────────────────── sectioned bank ────────────────────────────── */

function sectionedBank(): Record<string, BankQuestion[]> {
  return {
    core: [
      { type: "tf", weight: 1, correctValue: true, text: "Intentionally venting CFC, HCFC, and most HFC refrigerants to the atmosphere during service, maintenance, or disposal is prohibited under Section 608.", feedback: { correct: "Correct. Section 608 prohibits the knowing release of these refrigerants.", incorrect: "Venting these refrigerants is prohibited under Section 608." } },
      { type: "mcq", multi: false, weight: 2, text: "A technician recovers refrigerant from a small appliance (≤ 5 lbs) using post-1993 self-contained equipment. What recovery level must be reached?", options: [{ k: "A", text: "80% of the refrigerant", grade: 0 }, { k: "B", text: "90%, or 4 inches of mercury vacuum", grade: 100 }, { k: "C", text: "100% of the refrigerant", grade: 0 }, { k: "D", text: "Recovery is not required", grade: 0 }], feedback: { correct: "Correct. Post-1993 self-contained equipment must reach 90% (or 4\" Hg).", incorrect: "The required level is 90% of the charge, or 4 inches of mercury vacuum." } },
      { type: "mcq", multi: true, weight: 2, text: "Select all refrigerants classified as ozone-depleting substances (ODS).", options: [{ k: "A", text: "R-12 (CFC-12)", grade: 50 }, { k: "B", text: "R-410A (HFC blend)", grade: -25 }, { k: "C", text: "R-22 (HCFC-22)", grade: 50 }, { k: "D", text: "R-134a (HFC-134a)", grade: -25 }], feedback: { correct: "Correct — R-12 and R-22 deplete ozone; R-410A and R-134a are HFCs.", partial: "R-12 and R-22 are the ozone-depleting refrigerants; the HFCs should not be selected.", incorrect: "R-12 (CFC) and R-22 (HCFC) are the ozone-depleting refrigerants." } },
      { type: "mcq", multi: true, weight: 1, text: "Which are permitted when disposing of a household refrigerator?", options: [{ k: "A", text: "Recover all refrigerant before disposal", grade: 100 }, { k: "B", text: "Release remaining refrigerant when scrapping", grade: -50 }, { k: "C", text: "Recycle compressor oil per local rules", grade: 0 }, { k: "D", text: "Vent system to depressurize before crushing", grade: -50 }], feedback: { correct: "Correct. Refrigerant must be recovered before disposal.", partial: "Recovery is correct, but venting to depressurize is never permitted.", incorrect: "Refrigerant must always be recovered before disposal." } },
      { type: "match", weight: 2, mode: "partial", text: "Match each refrigerant to its classification.", pairs: [{ prompt: "R-12", answer: "CFC" }, { prompt: "R-22", answer: "HCFC" }, { prompt: "R-410A", answer: "HFC" }, { prompt: "R-717", answer: "Natural" }], feedback: { correct: "Correct. R-12 = CFC, R-22 = HCFC, R-410A = HFC, R-717 = natural.", partial: "Some matches are wrong — the prefix indicates the family.", incorrect: "Review the classifications: CFC, HCFC, HFC, or natural." } },
    ],
    t1: [
      { type: "tf", weight: 1, correctValue: true, text: "Type I certification covers small appliances — factory-sealed units charged with 5 lbs or less of refrigerant.", feedback: { correct: "Correct. Type I is for small, factory-charged appliances ≤ 5 lbs.", incorrect: "Type I covers small appliances factory-sealed with 5 lbs or less." } },
      { type: "mcq", multi: false, weight: 2, text: "Using post-1993 recovery equipment on a small appliance with an operating compressor, how much must be recovered?", options: [{ k: "A", text: "80% of the refrigerant", grade: 0 }, { k: "B", text: "90%, or 4 inches of mercury vacuum", grade: 100 }, { k: "C", text: "No recovery is required", grade: 0 }], feedback: { correct: "Correct — 90% (or 4\" Hg) with a working compressor.", incorrect: "With an operating compressor, recover 90% (or 4\" Hg)." } },
      { type: "mcq", multi: true, weight: 1, text: "Select all units that qualify as small appliances under Type I.", options: [{ k: "A", text: "Window air conditioner", grade: 50 }, { k: "B", text: "Household refrigerator", grade: 50 }, { k: "C", text: "Supermarket parallel rack system", grade: -50 }, { k: "D", text: "15-lb packaged rooftop unit", grade: -50 }], feedback: { correct: "Correct — window ACs and household refrigerators are small appliances.", partial: "Window ACs and household fridges qualify; the larger systems do not.", incorrect: "Small appliances are factory-sealed units ≤ 5 lbs." } },
    ],
    t2: [
      { type: "tf", weight: 1, correctValue: true, text: "Type II certification is required to service or dispose of high-pressure appliances such as R-22 split systems.", feedback: { correct: "Correct. Type II covers high-pressure appliances.", incorrect: "High-pressure appliances require Type II certification." } },
      { type: "mcq", multi: false, weight: 2, text: "Recovering from a high-pressure appliance (>200 lbs) for disposal with post-1993 equipment requires what vacuum level?", options: [{ k: "A", text: "0 inches of mercury vacuum", grade: 0 }, { k: "B", text: "10 inches of mercury vacuum", grade: 100 }, { k: "C", text: "No recovery is required", grade: 0 }], feedback: { correct: "Correct — 10\" Hg for disposal of a >200 lb high-pressure appliance.", incorrect: "Disposal of a >200 lb high-pressure appliance requires 10\" Hg." } },
      { type: "match", weight: 2, mode: "partial", text: "Match each refrigerant to its pressure class.", pairs: [{ prompt: "R-22", answer: "High-pressure" }, { prompt: "R-410A", answer: "High-pressure" }, { prompt: "R-123", answer: "Low-pressure" }, { prompt: "R-11", answer: "Low-pressure" }], feedback: { correct: "Correct. R-22/R-410A are high-pressure; R-123/R-11 are low-pressure.", partial: "Some matches are wrong — R-123 and R-11 are low-pressure refrigerants.", incorrect: "R-22 and R-410A are high-pressure; R-123 and R-11 are low-pressure." } },
    ],
    t3: [
      { type: "tf", weight: 1, correctValue: true, text: "Type III certification covers low-pressure appliances using refrigerants such as R-11, R-123, and R-113.", feedback: { correct: "Correct. Type III is for low-pressure appliances.", incorrect: "Low-pressure appliances (R-11, R-123, R-113) require Type III." } },
      { type: "mcq", multi: false, weight: 2, text: "Evacuating a low-pressure appliance for disposal requires reaching what absolute pressure?", options: [{ k: "A", text: "25 mm Hg absolute", grade: 100 }, { k: "B", text: "25 inches of mercury vacuum", grade: 0 }, { k: "C", text: "4 inches of mercury vacuum", grade: 0 }], feedback: { correct: "Correct — 25 mm Hg absolute for low-pressure disposal.", incorrect: "Low-pressure disposal requires evacuation to 25 mm Hg absolute." } },
    ],
  };
}

/** a2 ran out of time: Type 2 / Type 3 never reached, tail of Core unanswered. */
function buildOutcomesSectioned(
  aid: string,
  sid: string,
  count: number,
  ratio: number,
): Outcome[] {
  if (aid === "a2" && (sid === "t2" || sid === "t3"))
    return new Array(count).fill("blank") as Outcome[];
  const blanks = new Set<number>();
  if (aid === "a2" && sid === "core") {
    const tail = Math.max(1, Math.floor(count * 0.1));
    for (let i = count - tail; i < count; i++) blanks.add(i);
  }
  const active: number[] = [];
  for (let i = 0; i < count; i++) if (!blanks.has(i)) active.push(i);
  const K = Math.round(ratio * active.length);
  const ordered = active.slice().sort((a, b) => hash(a) - hash(b));
  const correct = new Set(ordered.slice(0, K));
  const out: Outcome[] = new Array(count);
  for (let i = 0; i < count; i++)
    out[i] = blanks.has(i) ? "blank" : correct.has(i) ? "correct" : "wrong";
  return out;
}

export function buildSectionedModel(
  user: AttemptUser,
  quizName: string,
): SectionedModel {
  const bank = sectionedBank();
  const counts: Record<string, number> = { core: 16, t1: 10, t2: 12, t3: 8 };
  const ratios: Record<string, Record<string, number>> = {
    a1: { core: 0.31, t1: 0.9, t2: 0.92, t3: 0.88 },
    a2: { core: 0.88, t1: 0.44, t2: 0, t3: 0 },
    a3: { core: 0.94, t1: 0.95, t2: 0.92, t3: 0.9 },
  };
  const secMeta = [
    { id: "core", name: "Core", pass: 70, required: true },
    { id: "t1", name: "Type 1", pass: 70, required: false },
    { id: "t2", name: "Type 2", pass: 70, required: false },
    { id: "t3", name: "Type 3", pass: 70, required: false },
  ];

  // Expand the bank to the configured counts, renumbering per section.
  const expanded: Record<string, BankQuestion[]> = {};
  secMeta.forEach((s) => {
    const tpl = bank[s.id];
    const arr: BankQuestion[] = [];
    for (let i = 0; i < counts[s.id]; i++)
      arr.push({ ...tpl[i % tpl.length], n: i + 1 });
    expanded[s.id] = arr;
  });

  const attMeta: AttemptMeta[] = [
    { id: "a1", label: "Attempt 1", date: "May 28", duration: "1h 28m", via: "Submitted manually", isAuto: false },
    { id: "a2", label: "Attempt 2", date: "Jun 3", duration: "2h 00m", via: "Auto-submitted — timer", isAuto: true },
    { id: "a3", label: "Attempt 3", date: "Jun 12", duration: "1h 18m", via: "Submitted manually", isAuto: false },
  ];

  const built: Record<string, SectionedAttempt> = {};
  attMeta.forEach((a) => {
    const sections: SectionVM[] = secMeta.map((s) => {
      const outcomes = buildOutcomesSectioned(a.id, s.id, counts[s.id], ratios[a.id][s.id]);
      const questions = expanded[s.id].map((q, i) => {
        const bq = buildQ(q, makeResp(q, outcomes[i]));
        bq.anchorId = `q_${a.id}_${s.id}_${i + 1}`;
        return bq;
      });
      let pts = 0;
      let w = 0;
      let answered = 0;
      questions.forEach((q) => {
        pts += q.points;
        w += q.weight;
        if (!q.blank) answered++;
      });
      const pct = Math.max(0, (pts / w) * 100);
      return {
        id: s.id,
        name: s.name,
        required: s.required,
        pass: s.pass,
        pct,
        passed: pct >= s.pass,
        answered,
        total: questions.length,
        questions,
        anchorId: `sec_${a.id}_${s.id}`,
      };
    });
    const qualifying = sections.filter((s) => s.required).every((s) => s.passed);
    const status: AttemptStatus = a.isAuto
      ? "Auto-submitted"
      : !qualifying
      ? "Nullified"
      : "Passed";
    let pts = 0;
    let w = 0;
    sections.forEach((s) =>
      s.questions.forEach((q) => {
        pts += q.points;
        w += q.weight;
      }),
    );
    const overall = Math.max(0, (pts / w) * 100);
    built[a.id] = { ...a, sections, qualifying, status, overall };
  });

  const qualIds = attMeta.filter((a) => built[a.id].qualifying).map((a) => a.id);
  const highest: Record<string, number> = {};
  secMeta.forEach((s) => {
    let best = 0;
    qualIds.forEach((id) => {
      const sec = built[id].sections.find((x) => x.id === s.id)!;
      if (sec.passed) best = Math.max(best, sec.pct);
    });
    highest[s.id] = best;
  });

  return {
    kind: "sectioned",
    user,
    quizName,
    built,
    attMeta,
    secMeta,
    highest,
    totalQ: counts.core + counts.t1 + counts.t2 + counts.t3,
    defaultSel: "a2",
  };
}

/* ─────────────────────────────── flat bank ──────────────────────────────── */

function flatBank(): BankQuestion[] {
  return [
    { type: "tf", weight: 1, correctValue: true, text: "A heat pump can provide both heating and cooling by reversing the direction of refrigerant flow with a reversing valve.", feedback: { correct: "Correct. A reversing valve lets a heat pump move heat in either direction.", incorrect: "A heat pump reverses refrigerant flow to switch between heating and cooling." } },
    { type: "mcq", multi: false, weight: 1, text: "In cooling mode, which component absorbs heat from the conditioned space?", options: [{ k: "A", text: "Condenser coil", grade: 0 }, { k: "B", text: "Evaporator coil", grade: 100 }, { k: "C", text: "Compressor", grade: 0 }, { k: "D", text: "Metering device", grade: 0 }], feedback: { correct: "Correct. The evaporator absorbs heat from indoor air as refrigerant evaporates.", incorrect: "The evaporator coil absorbs heat from the conditioned space." } },
    { type: "mcq", multi: true, weight: 2, text: "Select all processes that are sensible-heat changes (temperature change with no change of state).", options: [{ k: "A", text: "Supply air warming from 55°F to 60°F", grade: 50 }, { k: "B", text: "Ice melting to water at 32°F", grade: -25 }, { k: "C", text: "Refrigerant vapor cooling in the suction line", grade: 50 }, { k: "D", text: "Water boiling to steam at 212°F", grade: -25 }], feedback: { correct: "Correct — A and C change temperature only; B and D are latent (phase-change) processes.", partial: "A and C are sensible changes; B and D involve a change of state and should not be selected.", incorrect: "Sensible heat changes temperature without changing state — A and C qualify." } },
    { type: "match", weight: 2, mode: "partial", text: "Match each component to its primary function in the refrigeration cycle.", pairs: [{ prompt: "Compressor", answer: "Raises pressure" }, { prompt: "Condenser", answer: "Rejects heat" }, { prompt: "Evaporator", answer: "Absorbs heat" }, { prompt: "Metering device", answer: "Drops pressure" }], feedback: { correct: "Correct. Each component maps to its role in the cycle.", partial: "Some matches are off — review the order of the refrigeration cycle.", incorrect: "Review the cycle: compress → reject heat → meter → absorb heat." } },
    { type: "tf", weight: 1, correctValue: false, text: "Superheat is measured at the condenser outlet and indicates how much liquid refrigerant remains in the line.", feedback: { correct: "Correct — superheat is measured on the suction line (evaporator outlet), not the condenser.", incorrect: "False. Superheat is measured at the evaporator outlet / suction line; subcooling is measured at the condenser." } },
    { type: "mcq", multi: false, weight: 2, text: "A blower motor draws excessive current and trips on overload. Which is the most likely cause?", options: [{ k: "A", text: "A clogged air filter / restricted airflow", grade: 0 }, { k: "B", text: "Seized bearings or a failing motor", grade: 100 }, { k: "C", text: "Thermostat set too low", grade: 0 }, { k: "D", text: "Refrigerant overcharge", grade: 0 }], feedback: { correct: "Correct. Mechanical resistance (seized bearings) raises current draw and trips the overload.", incorrect: "High current draw with overload trips points to a mechanical/motor fault, not airflow or thermostat." } },
    { type: "mcq", multi: true, weight: 1, text: "Which readings indicate a properly operating system? Select all that apply.", options: [{ k: "A", text: "Stable suction superheat within spec", grade: 100 }, { k: "B", text: "Liquid line subcooling far above spec", grade: -50 }, { k: "C", text: "Temperature split across the evaporator within range", grade: 0 }, { k: "D", text: "Compressor short-cycling every 30 seconds", grade: -50 }], feedback: { correct: "Correct. Superheat in spec is a healthy sign; short-cycling and excessive subcooling are faults.", partial: "Superheat in spec is good, but short-cycling and high subcooling are faults — don’t select them.", incorrect: "A healthy system shows superheat in spec; short-cycling and excessive subcooling indicate problems." } },
    { type: "tf", weight: 1, correctValue: true, text: "A capacitor stores and releases electrical energy and is commonly used to start and run single-phase motors.", feedback: { correct: "Correct. Start/run capacitors provide the phase shift single-phase motors need.", incorrect: "True — capacitors store energy and provide the phase shift for single-phase motor start/run." } },
  ];
}

function buildOutcomesFlat(
  aid: string,
  count: number,
  ratio: number,
  isAuto: boolean,
): Outcome[] {
  const blanks = new Set<number>();
  if (isAuto) {
    const tail = Math.max(1, Math.floor(count * 0.28));
    for (let i = count - tail; i < count; i++) blanks.add(i);
  }
  const active: number[] = [];
  for (let i = 0; i < count; i++) if (!blanks.has(i)) active.push(i);
  const K = Math.round(ratio * active.length);
  const ordered = active
    .slice()
    .sort((a, b) => hash(a + aid.length * 7) - hash(b + aid.length * 7));
  const correct = new Set(ordered.slice(0, K));
  const out: Outcome[] = new Array(count);
  for (let i = 0; i < count; i++)
    out[i] = blanks.has(i) ? "blank" : correct.has(i) ? "correct" : "wrong";
  return out;
}

export function buildFlatModel(user: AttemptUser, quizName: string): FlatModel {
  const PASS = 70;
  const bank = flatBank();
  const count = bank.length;
  const attMeta: (AttemptMeta & { ratio: number })[] = [
    { id: "a1", label: "Attempt 1", date: "Jun 1", duration: "31m", via: "Submitted manually", isAuto: false, ratio: 0.52 },
    { id: "a2", label: "Attempt 2", date: "Jun 5", duration: "45m", via: "Auto-submitted — timer", isAuto: true, ratio: 0.6 },
    { id: "a3", label: "Attempt 3", date: "Jun 9", duration: "33m", via: "Submitted manually", isAuto: false, ratio: 0.93 },
  ];

  const built: Record<string, FlatAttempt> = {};
  attMeta.forEach((a) => {
    const outcomes = buildOutcomesFlat(a.id, count, a.ratio, a.isAuto);
    const questions = bank.map((q, i) => {
      const bq = buildQ({ ...q, n: i + 1 }, makeResp(q, outcomes[i]));
      bq.anchorId = `q_${a.id}_${i + 1}`;
      return bq;
    });
    let pts = 0;
    let w = 0;
    let answered = 0;
    questions.forEach((q) => {
      pts += q.points;
      w += q.weight;
      if (!q.blank) answered++;
    });
    const overall = Math.max(0, (pts / w) * 100);
    const passed = overall >= PASS;
    const status: AttemptStatus = a.isAuto ? "Auto-submitted" : passed ? "Passed" : "Failed";
    built[a.id] = {
      id: a.id,
      label: a.label,
      date: a.date,
      duration: a.duration,
      via: a.via,
      isAuto: a.isAuto,
      questions,
      overall,
      passed,
      status,
      answered,
      total: count,
      pts: Math.round(pts * 100) / 100,
      w,
    };
  });

  const highest = Math.max(...attMeta.map((a) => built[a.id].overall));
  return {
    kind: "flat",
    user,
    quizName,
    built,
    attMeta: attMeta.map(({ ratio: _ratio, ...m }) => m),
    pass: PASS,
    highest,
    complete: highest >= PASS,
    totalQ: count,
    defaultSel: "a3",
  };
}

/* ──────────────────────────── entry / selection ─────────────────────────── */

/** Initials from a display name: "Marcus Delgado" → "MD". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (a + b).toUpperCase();
}

/** A quiz is sectioned (certification-style) if it's a banded final exam. */
export function isSectionedQuiz(quizName: string): boolean {
  return /EPA|Final Exam/i.test(quizName);
}

export function statusColor(s: AttemptStatus): string {
  return s === "Passed"
    ? P.pass
    : s === "Nullified"
    ? P.nullified
    : s === "Auto-submitted"
    ? P.amber
    : P.fail;
}

/** Background + foreground swatch for a question-index cell. */
export function cellColors(cat: QuestionVM["cat"]): [string, string] {
  const pal: Record<string, [string, string]> = {
    pass: ["rgba(95,208,163,.14)", "#5fd0a3"],
    partial: ["rgba(230,160,60,.14)", "#e6a03c"],
    wrong: ["rgba(233,138,118,.14)", "#e98a76"],
    blank: ["rgba(255,255,255,.035)", "#5a5a5e"],
  };
  return pal[cat] || pal.blank;
}

/** Build the right model for an attempt's quiz, seeded with the learner. */
export function buildAttemptModel(
  user: AttemptUser,
  quizName: string,
): AttemptDetailModel {
  return isSectionedQuiz(quizName)
    ? buildSectionedModel(user, quizName)
    : buildFlatModel(user, quizName);
}
