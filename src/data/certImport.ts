/* ── Certification CSV Upload ──
   The Question Bank's bulk-upload flow (questionImport.ts), for a
   Certification's structure. One row per Task, naming the Course it sits in
   and, optionally, the Lesson inside that Course. The file is parsed and
   CHECKED in full before anything is imported: either every row passes (and
   the Success screen previews what the file builds) or the Errors screen names
   the column to fix on each failing row.

   A row whose Task Name is already in the Task library REUSES that Task, the
   way "Add Existing Task" does — a Task is never duplicated. Any other row is a
   new Task of its type, the way "Create New" makes one. Nothing here touches
   wizard state: `analyzeCertImport` is pure, and the wizard turns the checked
   structure into its own tree nodes. */

import { parseCsv } from "./questionImport";
import { tasks as taskLibrary, type Task, type TaskType } from "./tasks";

/* Header row, in order. Columns are matched by NAME (case-insensitive), not by
   position, so a spreadsheet that reorders or adds columns still imports.
   Course and Lesson details may repeat on every row of their Course/Lesson or
   sit on just one of them — but two rows may not disagree. */
export const CERT_IMPORT_COLUMNS: string[] = [
  "Course (EN)",
  "Course (ES)",
  "Course Description (EN)",
  "Course Description (ES)",
  "Lesson (EN)",
  "Lesson (ES)",
  "Lesson Description (EN)",
  "Lesson Description (ES)",
  "Task Name",
  "Task Type",
];

/** One CSV line — cells holding a comma or a quote are quoted. */
const csvLine = (cells: string[]) =>
  cells.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",");

const REFRIGERANT_BASICS = [
  "Refrigerant Basics",
  "Fundamentos de Refrigerantes",
  "Handling, recovery, and charging for new technicians.",
  "Manejo, recuperación y carga para técnicos nuevos.",
];
const CORE_CONCEPTS = [
  "Core Concepts",
  "Conceptos Básicos",
  "How refrigerants behave in a sealed system.",
  "Cómo se comportan los refrigerantes en un sistema sellado.",
];
const RECOVERY = ["Recovery in Practice", "Recuperación en la Práctica", "", ""];
const SAFETY = [
  "Safety & Compliance",
  "Seguridad y Cumplimiento",
  "Site safety every technician needs before field work.",
  "La seguridad que todo técnico necesita antes del trabajo de campo.",
];
const NO_LESSON = ["", "", "", ""];

/* The downloadable template. It shows every shape a row can take:
   - Tasks inside a Lesson — the four Lesson columns filled.
   - A Task directly under its Course — the Lesson columns left blank.
   - Library Tasks ("Recovery Machine Setup", "OSHA 10 Safety Course"…) are
     reused as they are; the rest ("Pressure-Temperature Chart"…) are new.
   Starts with a byte-order mark so Excel opens the Spanish accents as UTF-8 —
   `parseCsv` strips it again on the way back in. */
export const CERT_TEMPLATE =
  "﻿" +
  [
    csvLine(CERT_IMPORT_COLUMNS),
    csvLine([...REFRIGERANT_BASICS, ...CORE_CONCEPTS, "EPA 608 Core – Refrigerant Recovery", "xAPI"]),
    csvLine([...REFRIGERANT_BASICS, ...CORE_CONCEPTS, "Pressure-Temperature Chart", "Resource"]),
    csvLine([...REFRIGERANT_BASICS, ...RECOVERY, "Recovery Machine Setup", "Hands-On Task"]),
    csvLine([...REFRIGERANT_BASICS, ...RECOVERY, "Leak Detection Test", "Hands-On Task"]),
    csvLine([...REFRIGERANT_BASICS, ...NO_LESSON, "Refrigerant Basics Quiz", "Quiz"]),
    csvLine([...SAFETY, ...NO_LESSON, "OSHA 10 Safety Course", "xAPI"]),
    csvLine([...SAFETY, ...NO_LESSON, "Government ID Upload", "Hands-On Task"]),
    csvLine([...SAFETY, ...NO_LESSON, "Safety & Compliance Final Exam", "Quiz"]),
    "",
  ].join("\n");

/** A row that passed every check — one Task placed in the tree. */
export type ImportedCertTask = {
  row: number;
  /** The library's own spelling when the Task is reused. */
  name: string;
  type: TaskType;
  /** Set when the name is already in the Task library: the row reuses that
   *  Task instead of creating one. */
  libraryTask?: Task;
};

export type ImportedCertLesson = {
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  tasks: ImportedCertTask[];
};

export type ImportedCertCourse = {
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  /** Lessons and Tasks placed directly on the Course, in the order the file
   *  first names them. */
  children: (
    | { kind: "task"; task: ImportedCertTask }
    | { kind: "lesson"; lesson: ImportedCertLesson }
  )[];
};

/** A failing row. `column` is the red fragment, `detail` the note after it. */
export type CertImportIssue = {
  row: number;
  course: string;
  lesson: string;
  task: string;
  type: string;
  column: string;
  detail?: string;
};

export type CertImportReport = {
  fileName: string;
  /** Data rows in the file (the header doesn't count). */
  total: number;
  /** Every row that passed, in file order. */
  rows: ImportedCertTask[];
  /** The passing rows as the Course → Lesson → Task tree they build. */
  courses: ImportedCertCourse[];
  issues: CertImportIssue[];
  /** Set when the file can't be read at all — no header, no rows. */
  fatal?: string;
};

/* ─── Validation ──────────────────────────────────────────────────────────── */

/** Case, runs of spaces, and the dash style ("–" vs "-") never make two names
 *  different — a hand-typed "EPA 608 Core - Refrigerant Recovery" is still the
 *  library's Task. */
const norm = (s: string) =>
  s.trim().replace(/\s+/g, " ").replace(/[‐-―−]/g, "-").toLowerCase();

/** "xAPI" / "xAPI Module" / "Hands-On" all name the same Task type. */
const TYPE_ALIASES: Record<string, TaskType> = {
  xapi: "xAPI",
  "xapi module": "xAPI",
  scorm: "xAPI",
  quiz: "Quiz",
  "hands-on task": "Hands-On Task",
  "hands-on": "Hands-On Task",
  "hands on task": "Hands-On Task",
  "hands on": "Hands-On Task",
  resource: "Resource",
  file: "Resource",
};

/** How each type reads in a sentence: "an xAPI Module", "2 Quizzes". */
const TYPE_NOUN: Record<TaskType, { one: string; many: string; a: string }> = {
  xAPI: { one: "xAPI Module", many: "xAPI Modules", a: "an" },
  Quiz: { one: "Quiz", many: "Quizzes", a: "a" },
  "Hands-On Task": { one: "Hands-On Task", many: "Hands-On Tasks", a: "a" },
  Resource: { one: "Resource", many: "Resources", a: "a" },
};

const LIBRARY = new Map(taskLibrary.map((t) => [norm(t.name), t]));

type NodeFields = { nameEn: string; nameEs: string; descEn: string; descEs: string };
type Detail = "nameEs" | "descEn" | "descEs";

const COURSE_DETAILS: [Detail, string][] = [
  ["nameEs", "Course (ES)"],
  ["descEn", "Course Description (EN)"],
  ["descEs", "Course Description (ES)"],
];
const LESSON_DETAILS: [Detail, string][] = [
  ["nameEs", "Lesson (ES)"],
  ["descEn", "Lesson Description (EN)"],
  ["descEs", "Lesson Description (ES)"],
];

/** A Course or Lesson as the file has built it so far, with the row each of
 *  its details was first given on. */
type Entry<N> = { node: N & NodeFields; from: Partial<Record<Detail, number>> };

/** The first detail this row gives differently from an earlier row — its
 *  column name and that row. A blank cell never disagrees. */
function clash(
  entry: Entry<unknown> | undefined,
  row: NodeFields,
  details: [Detail, string][],
): { column: string; row: number } | undefined {
  if (!entry) return undefined;
  for (const [key, column] of details) {
    const had = entry.node[key];
    if (had !== "" && row[key] !== "" && norm(had) !== norm(row[key])) {
      return { column, row: entry.from[key]! };
    }
  }
  return undefined;
}

/** Details an earlier row left blank are taken from the first row that
 *  gives them. */
function fill(entry: Entry<unknown>, row: NodeFields, details: [Detail, string][], rowNo: number) {
  for (const [key] of details) {
    if (entry.node[key] === "" && row[key] !== "") {
      entry.node[key] = row[key];
      entry.from[key] = rowNo;
    }
  }
}

/**
 * Parse + check a whole file. Every row is reported either as a placed Task or
 * as ONE issue (the first thing wrong with it — the Errors table shows a single
 * issue per row, and a row is re-checked after it's fixed).
 */
export function analyzeCertImport(fileName: string, text: string): CertImportReport {
  const empty: CertImportReport = { fileName, total: 0, rows: [], courses: [], issues: [] };

  const table = parseCsv(text);
  if (table.length < 2) {
    return {
      ...empty,
      fatal: table.length === 0 ? "This file is empty." : "This file has a header but no Task rows.",
    };
  }

  // Column name → index. Unknown columns are ignored, missing ones read blank.
  const head = new Map<string, number>();
  table[0].forEach((h, i) => head.set(norm(h), i));
  const at = (cells: string[], column: string) => {
    const i = head.get(norm(column));
    return i === undefined ? "" : (cells[i] ?? "").trim();
  };
  if (["Course (EN)", "Task Name", "Task Type"].some((c) => !head.has(norm(c)))) {
    return {
      ...empty,
      fatal:
        "The header row doesn't match the template — “Course (EN)”, “Task Name”, and “Task Type” are required. Download the template and try again.",
    };
  }

  const rows: ImportedCertTask[] = [];
  const issues: CertImportIssue[] = [];
  const courses: ImportedCertCourse[] = [];
  const courseAt = new Map<string, Entry<ImportedCertCourse>>();
  // Keyed by Course + Lesson: two Courses can each have a "Core Concepts".
  const lessonAt = new Map<string, Entry<ImportedCertLesson>>();
  // Row number of the first time each Task was placed, for duplicates.
  const taskAt = new Map<string, number>();

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const rowNo = r + 1; // 1-based, as the spreadsheet numbers it (header = 1)
    const course: NodeFields = {
      nameEn: at(cells, "Course (EN)"),
      nameEs: at(cells, "Course (ES)"),
      descEn: at(cells, "Course Description (EN)"),
      descEs: at(cells, "Course Description (ES)"),
    };
    const lesson: NodeFields = {
      nameEn: at(cells, "Lesson (EN)"),
      nameEs: at(cells, "Lesson (ES)"),
      descEn: at(cells, "Lesson Description (EN)"),
      descEs: at(cells, "Lesson Description (ES)"),
    };
    const name = at(cells, "Task Name");
    const typeRaw = at(cells, "Task Type");
    const fail = (column: string, detail?: string) => {
      issues.push({
        row: rowNo,
        course: course.nameEn,
        lesson: lesson.nameEn,
        task: name,
        type: typeRaw,
        column,
        detail,
      });
    };

    if (course.nameEn === "") {
      fail("Course (EN)", "Every row needs a Course");
      continue;
    }
    if (name === "") {
      fail("Missing Task Name");
      continue;
    }
    const type = TYPE_ALIASES[norm(typeRaw)];
    if (!type) {
      fail(
        typeRaw === "" ? "Missing Task Type" : "Invalid Task Type",
        "Only xAPI, Quiz, Hands-On Task, and Resource are supported",
      );
      continue;
    }
    if (lesson.nameEn === "" && (lesson.nameEs || lesson.descEn || lesson.descEs)) {
      fail("Lesson (EN)", "Needed when other Lesson columns are filled");
      continue;
    }
    const dupOf = taskAt.get(norm(name));
    if (dupOf !== undefined) {
      fail("Task Name", `Duplicate of row ${dupOf}. A Task appears once per Certification`);
      continue;
    }
    const libraryTask = LIBRARY.get(norm(name));
    if (libraryTask && libraryTask.type !== type) {
      const noun = TYPE_NOUN[libraryTask.type];
      fail("Task Type", `“${libraryTask.name}” is ${noun.a} ${noun.one} in the Task library`);
      continue;
    }
    const courseKey = norm(course.nameEn);
    const lessonKey = `${courseKey}\n${norm(lesson.nameEn)}`;
    const differs =
      clash(courseAt.get(courseKey), course, COURSE_DETAILS) ??
      (lesson.nameEn ? clash(lessonAt.get(lessonKey), lesson, LESSON_DETAILS) : undefined);
    if (differs) {
      fail(differs.column, `Differs from row ${differs.row} for the same ${differs.column.split(" ")[0]}`);
      continue;
    }

    // Passed — place the Task, creating its Course/Lesson on first mention.
    let courseEntry = courseAt.get(courseKey);
    if (!courseEntry) {
      courseEntry = {
        node: { nameEn: course.nameEn, nameEs: "", descEn: "", descEs: "", children: [] },
        from: {},
      };
      courseAt.set(courseKey, courseEntry);
      courses.push(courseEntry.node);
    }
    fill(courseEntry, course, COURSE_DETAILS, rowNo);

    const task: ImportedCertTask = {
      row: rowNo,
      name: libraryTask?.name ?? name,
      type,
      ...(libraryTask ? { libraryTask } : {}),
    };
    if (lesson.nameEn) {
      let lessonEntry = lessonAt.get(lessonKey);
      if (!lessonEntry) {
        lessonEntry = {
          node: { nameEn: lesson.nameEn, nameEs: "", descEn: "", descEs: "", tasks: [] },
          from: {},
        };
        lessonAt.set(lessonKey, lessonEntry);
        courseEntry.node.children.push({ kind: "lesson", lesson: lessonEntry.node });
      }
      fill(lessonEntry, lesson, LESSON_DETAILS, rowNo);
      lessonEntry.node.tasks.push(task);
    } else {
      courseEntry.node.children.push({ kind: "task", task });
    }

    taskAt.set(norm(name), rowNo);
    rows.push(task);
  }

  return { fileName, total: table.length - 1, rows, courses, issues };
}

/* ─── Summary copy (Success screen) ───────────────────────────────────────── */

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "2 xAPI Modules · 2 Quizzes · 3 Hands-On Tasks" — zeros are left out. */
export function taskTypeBreakdown(rows: ImportedCertTask[]): string {
  return (Object.keys(TYPE_NOUN) as TaskType[])
    .map((type) => {
      const n = rows.filter((r) => r.type === type).length;
      return n ? plural(n, TYPE_NOUN[type].one, TYPE_NOUN[type].many) : "";
    })
    .filter(Boolean)
    .join(" · ");
}

/** "2 Courses & 3 Lessons will be created". */
export function structureLine(courses: ImportedCertCourse[]): string {
  const lessons = courses.reduce(
    (n, c) => n + c.children.filter((ch) => ch.kind === "lesson").length,
    0,
  );
  const parts = [plural(courses.length, "Course")];
  if (lessons) parts.push(plural(lessons, "Lesson"));
  return `${parts.join(" & ")} will be created`;
}

/** "3 new Tasks will be created · 5 reused from the library". */
export function libraryLine(rows: ImportedCertTask[]): string {
  const reused = rows.filter((r) => r.libraryTask).length;
  const created = rows.length - reused;
  if (created === 0) return "Every Task is already in the library and is reused";
  const line = `${plural(created, "new Task")} will be created`;
  return reused ? `${line} · ${reused} reused from the library` : line;
}

/** Courses and Lessons that have no Spanish name — they import English-only. */
export function missingSpanish(courses: ImportedCertCourse[]): { courses: number; lessons: number } {
  let lessons = 0;
  for (const c of courses) {
    for (const ch of c.children) if (ch.kind === "lesson" && !ch.lesson.nameEs) lessons++;
  }
  return { courses: courses.filter((c) => !c.nameEs).length, lessons };
}
