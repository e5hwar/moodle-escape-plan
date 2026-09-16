/* ── Question Bank bulk upload (Figma 1116:1321 / 1195:1690 / 1196:1806) ──
   One row per question. The file is parsed and CHECKED in full before anything
   is imported: either every row passes (and the Success screen previews what
   the file adds) or the Errors screen names the column to fix on each failing
   row. Nothing here touches page state — `analyzeImport` is pure, and
   `questionsFromImport` just builds the Question objects the page appends. */

import {
  supportsGrading,
  type Category,
  type MatchPair,
  type Question,
  type QuestionOption,
  type QuestionType,
} from "./questionBank";

/* Only the three types the design names are importable: the others carry
   authored answer data (scales, file rules) that a flat row can't express. */
const IMPORTABLE = ["Multiple Choice", "True/False", "Match the Following"] as const;

/** How many Option / Grade / Match column groups the template carries. */
const SLOTS = 4;

/* Header row, in order. Columns are matched by NAME (case-insensitive), not by
   position, so a spreadsheet that reorders or adds columns still imports. */
export const IMPORT_COLUMNS: string[] = [
  "Category",
  "Sub-Category",
  "Question Type",
  "Question (EN)",
  "Question (ES)",
  "Correct Answer",
  ...Array.from({ length: SLOTS }, (_, i) => [
    `Option ${i + 1}`,
    `Grade ${i + 1} %`,
    `Match ${i + 1}`,
  ]).flat(),
];

/* The downloadable template. One example per supported type:
   - Multiple Choice — "Option n" + "Grade n %" (positive grades total 100).
   - True/False      — "Correct Answer" alone.
   - Match the Following — "Option n" is the prompt, "Match n" its answer. */
export const BULK_TEMPLATE = [
  IMPORT_COLUMNS.join(","),
  [
    "EPA 608",
    "Universal",
    "Multiple Choice",
    "Which of these refrigerants is an HCFC?",
    "¿Cuál de estos refrigerantes es un HCFC?",
    "",
    "R-22", "100", "",
    "R-410A", "-25", "",
    "R-134a", "-25", "",
    "R-717", "-25", "",
  ].join(","),
  [
    "EPA 608",
    "Core",
    "True/False",
    "Knowingly venting refrigerant into the atmosphere is illegal.",
    "Ventilar refrigerante a la atmósfera a sabiendas es ilegal.",
    "True",
    "", "", "",
    "", "", "",
    "", "", "",
    "", "", "",
  ].join(","),
  [
    "HVAC Basics",
    "Tools",
    "Match the Following",
    "Match each tool to what it measures.",
    "",
    "",
    "Manifold gauge", "", "System pressures",
    "Micron gauge", "", "Vacuum level",
    "Clamp meter", "", "Current draw",
    "", "", "",
  ].join(","),
  "",
].join("\n");

/** A row that passed every check — everything needed to build a Question. */
export type ImportedQuestion = {
  row: number;
  category: string;
  sub: string;
  type: QuestionType;
  text: string;
  hasSpanish: boolean;
  options?: QuestionOption[];
  pairs?: MatchPair[];
  tfAnswer?: boolean;
};

/** A failing row. `column` is the red fragment, `detail` the note after it. */
export type ImportIssue = {
  row: number;
  category: string;
  sub: string;
  text: string;
  type: string;
  column: string;
  detail?: string;
};

export type ImportReport = {
  fileName: string;
  /** Data rows in the file (the header doesn't count). */
  total: number;
  rows: ImportedQuestion[];
  issues: ImportIssue[];
  counts: { mcq: number; tf: number; match: number };
  /** Category labels the import would create. */
  newCategories: string[];
  /** "Category > Sub" paths the import would create. */
  newSubcategories: string[];
  missingSpanish: number;
  /** Set when the file can't be read at all — no header, no rows. */
  fatal?: string;
};

/* ─── CSV ─────────────────────────────────────────────────────────────────── */

/** Split CSV text into rows of cells, honouring "quoted, fields" and "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  // A trailing newline would otherwise emit one empty row.
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  rows.push(row);
  // Drop rows that are entirely empty (blank lines, or a trailing newline).
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/* ─── Validation ──────────────────────────────────────────────────────────── */

const norm = (s: string) => s.trim().toLowerCase();

/** "Multiple Choice" / "mcq" / "MCQs" all name the same importable type. */
const TYPE_ALIASES: Record<string, (typeof IMPORTABLE)[number]> = {
  "multiple choice": "Multiple Choice",
  "multiple select": "Multiple Choice",
  mcq: "Multiple Choice",
  mcqs: "Multiple Choice",
  "true/false": "True/False",
  "true / false": "True/False",
  "t/f": "True/False",
  truefalse: "True/False",
  "match the following": "Match the Following",
  match: "Match the Following",
};

/** Grades read as "100", "100%", "-25", " −25 " (the en-dash minus included). */
function grade(raw: string): number | null {
  const v = raw.trim().replace(/%$/, "").replace(/[−–—]/g, "-").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function truthy(raw: string): boolean | null {
  const v = norm(raw);
  if (["true", "t", "yes", "y", "1"].includes(v)) return true;
  if (["false", "f", "no", "n", "0"].includes(v)) return false;
  return null;
}

/**
 * Parse + check a whole file. Every row is reported either as an importable
 * question or as ONE issue (the first thing wrong with it — the Errors table
 * shows a single issue per row, and a row is re-checked after it's fixed).
 */
export function analyzeImport(
  fileName: string,
  text: string,
  cats: Category[],
): ImportReport {
  const empty: ImportReport = {
    fileName,
    total: 0,
    rows: [],
    issues: [],
    counts: { mcq: 0, tf: 0, match: 0 },
    newCategories: [],
    newSubcategories: [],
    missingSpanish: 0,
  };

  const table = parseCsv(text);
  if (table.length < 2) {
    return {
      ...empty,
      fatal:
        table.length === 0
          ? "This file is empty."
          : "This file has a header but no question rows.",
    };
  }

  // Column name → index. Unknown columns are ignored, missing ones read blank.
  const head = new Map<string, number>();
  table[0].forEach((h, i) => head.set(norm(h), i));
  const at = (cells: string[], column: string) => {
    const i = head.get(norm(column));
    return i === undefined ? "" : (cells[i] ?? "").trim();
  };
  if (!head.has(norm("Question (EN)")) || !head.has(norm("Question Type"))) {
    return {
      ...empty,
      fatal:
        "The header row doesn't match the template — “Question (EN)” and “Question Type” are required. Download the template and try again.",
    };
  }

  const rows: ImportedQuestion[] = [];
  const issues: ImportIssue[] = [];
  const counts = { mcq: 0, tf: 0, match: 0 };
  let missingSpanish = 0;
  // Row number of the first time each question text was seen, for duplicates.
  const seen = new Map<string, number>();

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const rowNo = r + 1; // 1-based, as the spreadsheet numbers it (header = 1)
    const category = at(cells, "Category");
    const sub = at(cells, "Sub-Category");
    const typeRaw = at(cells, "Question Type");
    const textEn = at(cells, "Question (EN)");
    const textEs = at(cells, "Question (ES)");
    const base = { row: rowNo, category, sub, text: textEn, type: typeRaw };
    const fail = (column: string, detail?: string) => {
      issues.push({ ...base, column, detail });
    };

    const type = TYPE_ALIASES[norm(typeRaw)];
    if (!type) {
      fail(
        typeRaw === "" ? "Missing Question Type" : "Invalid Question Type",
        "Only MCQs, Match the Following, and True/False are supported",
      );
      continue;
    }
    if (textEn === "") {
      fail("Missing Question Text");
      continue;
    }
    if (category === "") {
      fail("Category", "Every row needs a Category");
      continue;
    }
    const dupOf = seen.get(norm(textEn));
    if (dupOf !== undefined) {
      fail("Question (EN)", `Duplicate of row ${dupOf}`);
      continue;
    }

    // Option / Grade / Match slots, read once for whichever type needs them.
    const slots = Array.from({ length: SLOTS }, (_, i) => ({
      option: at(cells, `Option ${i + 1}`),
      grade: at(cells, `Grade ${i + 1} %`),
      match: at(cells, `Match ${i + 1}`),
    }));

    const row: ImportedQuestion = {
      row: rowNo,
      category,
      sub,
      type: "Multiple choice",
      text: textEn,
      hasSpanish: textEs !== "",
    };

    if (type === "True/False") {
      const answer = truthy(at(cells, "Correct Answer"));
      if (answer === null) {
        fail("Correct Answer", "True/False rows need either True or False");
        continue;
      }
      row.type = "True/False";
      row.tfAnswer = answer;
      counts.tf++;
    } else if (type === "Match the Following") {
      const half = slots.findIndex(
        (s) => (s.option === "") !== (s.match === ""),
      );
      if (half !== -1) {
        fail(
          `${slots[half].option === "" ? "Option" : "Match"} ${half + 1}`,
          `Pair ${half + 1} is missing one side`,
        );
        continue;
      }
      const pairs = slots
        .filter((s) => s.option !== "")
        .map<MatchPair>((s) => ({ left: s.option, right: s.match }));
      if (pairs.length < 2) {
        fail("Option 1–4", "Match the Following needs at least 2 pairs");
        continue;
      }
      row.type = "Match the following";
      row.pairs = pairs;
      counts.match++;
    } else {
      const filled = slots.filter((s) => s.option !== "");
      if (filled.length < 2) {
        fail("Option 1–4", "Multiple Choice needs at least 2 options");
        continue;
      }
      const bad = filled.findIndex((s) => grade(s.grade) === null);
      if (bad !== -1) {
        fail(
          `Grade ${slots.indexOf(filled[bad]) + 1} %`,
          "Every option needs a grade, as a number",
        );
        continue;
      }
      const options = filled.map<QuestionOption>((s) => ({
        text: s.option,
        grade: grade(s.grade)!,
      }));
      const positive = options
        .filter((o) => o.grade > 0)
        .reduce((sum, o) => sum + o.grade, 0);
      if (Math.round(positive) !== 100) {
        fail(
          "Grade 1–4 %",
          `Positive grades total ${Math.round(positive)}%. They must total 100%`,
        );
        continue;
      }
      // One correct option is a single-answer MCQ; several make it a select.
      row.type =
        options.filter((o) => o.grade > 0).length > 1
          ? "Multiple select"
          : "Multiple choice";
      row.options = options;
      counts.mcq++;
    }

    seen.set(norm(textEn), rowNo);
    if (!row.hasSpanish) missingSpanish++;
    rows.push(row);
  }

  // What the import would create. Compared by label, the way the tree matches
  // questions to categories everywhere else on the page.
  const haveCats = new Set(cats.map((c) => norm(c.label)));
  const haveSubs = new Set(
    cats.flatMap((c) =>
      (c.subcategories ?? []).map((s) => norm(`${c.label} > ${s.label}`)),
    ),
  );
  const newCategories: string[] = [];
  const newSubcategories: string[] = [];
  for (const row of rows) {
    if (!haveCats.has(norm(row.category))) {
      haveCats.add(norm(row.category));
      newCategories.push(row.category);
    }
    if (row.sub !== "") {
      const path = `${row.category} > ${row.sub}`;
      if (!haveSubs.has(norm(path))) {
        haveSubs.add(norm(path));
        newSubcategories.push(path);
      }
    }
  }

  return {
    fileName,
    total: table.length - 1,
    rows,
    issues,
    counts,
    newCategories,
    newSubcategories,
    missingSpanish,
  };
}

/* ─── Summary copy (Success screen) ───────────────────────────────────────── */

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "200 MCQs · 12 True/False · 2 Match the Following" — zeros are left out. */
export function typeBreakdown(counts: ImportReport["counts"]): string {
  const parts: string[] = [];
  if (counts.mcq) parts.push(plural(counts.mcq, "MCQ"));
  if (counts.tf) parts.push(`${counts.tf} True/False`);
  if (counts.match) parts.push(`${counts.match} Match the Following`);
  return parts.join(" · ");
}

/** "1 Category & 3 Sub-Categories will be created". */
export function categoryLine(report: ImportReport): string {
  const { newCategories: cats, newSubcategories: subs } = report;
  if (cats.length === 0 && subs.length === 0) {
    return "Every row lands in a category that already exists";
  }
  const parts: string[] = [];
  if (cats.length) parts.push(plural(cats.length, "Category", "Categories"));
  if (subs.length) parts.push(plural(subs.length, "Sub-Category", "Sub-Categories"));
  return `${parts.join(" & ")} will be created`;
}

/* ─── Import ──────────────────────────────────────────────────────────────── */

/**
 * Build the Question objects for a checked file. Ids continue the bank's own
 * "Q-3xxxxx" import series, skipping anything already taken.
 */
export function questionsFromImport(
  rows: ImportedQuestion[],
  takenIds: Set<string>,
): Question[] {
  let n = 0;
  const nextId = () => {
    let id = "";
    do {
      id = `Q-3${String(10000 + n++).slice(-5)}`;
    } while (takenIds.has(id));
    takenIds.add(id);
    return id;
  };

  return rows.map((row) => ({
    id: nextId(),
    type: row.type,
    text: row.text,
    status: "Active" as const,
    categoryPath: row.sub ? [row.category, row.sub] : [row.category],
    quizzes: [],
    forms: [],
    version: 1,
    gradingEnabled: supportsGrading(row.type),
    randomise: row.type !== "True/False",
    hasSpanish: row.hasSpanish,
    ...(row.options ? { options: row.options } : {}),
    ...(row.pairs ? { pairs: row.pairs, matchGrading: "partial" as const } : {}),
    ...(row.tfAnswer === undefined ? {} : { tfAnswer: row.tfAnswer }),
  }));
}
