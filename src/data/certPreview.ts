/**
 * Certification preview structure — the Courses / Lessons / Tasks shown on the
 * Certifications page preview panel (Content tab).
 *
 * Certifications don't persist their structure in the app data, so this builds
 * a plausible one the same way the edit wizard and Certification Lookup do:
 * real Tasks associated via `usedIn` first, padded deterministically from the
 * task pool up to the cert's declared task count, then chunked into Courses
 * with a leading Lesson each. Seeded by the cert id — stable across renders
 * and identical on every load.
 */

import { tasks as appTasks, type Task, type TaskType } from "./tasks";
import type { Certification } from "./certifications";

export type CertPreviewTask = {
  id: string;
  name: string;
  type: TaskType;
  duration: string;
  finalExam?: boolean;
};

export type CertPreviewLesson = {
  name: string;
  tasks: CertPreviewTask[];
};

export type CertPreviewChild =
  | { kind: "task"; task: CertPreviewTask }
  | { kind: "lesson"; lesson: CertPreviewLesson };

export type CertPreviewCourse = {
  name: string;
  children: CertPreviewChild[];
};

export type CertPreviewStructure = {
  courses: CertPreviewCourse[];
  courseCount: number;
  lessonCount: number;
  taskCount: number;
};

/** `usedIn` labels in tasks.ts use short aliases; map them to cert ids. */
const USEDIN_TO_CERT: Record<string, string> = {
  "EPA 608 Type I": "C-0420",
  "EPA 608 Type II": "C-0419",
  "EPA 608 Type III": "C-0418",
  "EPA 608 Universal": "C-0421",
  "NATE RTW": "C-0410",
  "Safety Bundle": "C-0405",
  "HVAC Field Skills": "C-0398",
  "OSHA 10": "C-0341",
};

const DURATION_BY_TYPE: Record<TaskType, string> = {
  xAPI: "10 min",
  Quiz: "15 min",
  "Hands-On Task": "30 min",
  Resource: "5 min",
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const toPreviewTask = (t: Task): CertPreviewTask => ({
  id: t.id,
  name: t.name,
  type: t.type,
  duration: t.timeToComplete ?? DURATION_BY_TYPE[t.type],
  finalExam: t.finalExam,
});

/** Real tasks associated with the cert via `usedIn`, padded deterministically
 * from the pool to the cert's declared task count, real final exam last. */
function tasksFor(cert: Certification): CertPreviewTask[] {
  const seed = hash(cert.id);
  const matched = appTasks.filter(
    (t) => !t.draft && t.usedIn.some((u) => USEDIN_TO_CERT[u] === cert.id),
  );
  const pool = appTasks.filter((t) => !t.draft && !t.finalExam);
  const target = cert.tasks;

  const list: Task[] = [];
  const seen = new Set<string>();
  for (const t of matched) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      list.push(t);
    }
  }
  for (let i = 0; list.length < target && i < pool.length * 3; i++) {
    const c = pool[(seed + i * 3) % pool.length];
    if (!seen.has(c.id)) {
      seen.add(c.id);
      list.push(c);
    }
  }
  let result = (list.length > target ? list.slice(0, target) : list).map(toPreviewTask);

  const fin = result.find((t) => t.finalExam);
  if (fin) result = [...result.filter((t) => t.id !== fin.id), fin];
  return result;
}

// Course/Lesson names cycle through trade-neutral curriculum labels.
const COURSE_NAMES = ["Fundamentals", "Applied Skills", "Certification Prep"];
const LESSON_NAMES = ["Core Concepts", "Working Practice", "Exam Readiness"];

export function buildCertPreview(cert: Certification): CertPreviewStructure {
  const tasks = tasksFor(cert);
  const n = tasks.length;

  // ~6 tasks per Course, at most 3 Courses. Each Course leads with a Lesson
  // holding up to 3 tasks; the rest sit directly on the Course.
  const courseCount = Math.max(1, Math.min(3, Math.ceil(n / 6)));
  const per = Math.ceil(n / courseCount);

  let lessonCount = 0;
  const courses: CertPreviewCourse[] = [];
  for (let ci = 0; ci < courseCount; ci++) {
    const slice = tasks.slice(ci * per, (ci + 1) * per);
    if (slice.length === 0) continue;
    const children: CertPreviewChild[] = [];
    // Single-task Courses (or the final-exam tail) keep the task loose.
    const lessonTasks = slice.length > 2 ? slice.slice(0, Math.min(3, slice.length - 1)) : [];
    if (lessonTasks.length > 0) {
      lessonCount++;
      children.push({ kind: "lesson", lesson: { name: LESSON_NAMES[ci % LESSON_NAMES.length], tasks: lessonTasks } });
    }
    for (const t of slice.slice(lessonTasks.length)) children.push({ kind: "task", task: t });
    courses.push({ name: `${COURSE_NAMES[ci % COURSE_NAMES.length]}`, children });
  }

  return { courses, courseCount: courses.length, lessonCount, taskCount: n };
}
