import type { FeedbackForm, FormQuestionLink, FormResponse, ResponseAnswer } from "./feedbackForms";
import type { Question } from "./questionBank";

/* A Feedback Form's CSV export — the Feedback Forms row menu's "Export
   Responses". (The in-app Responses viewer this used to sit beside was removed
   2026-10-06; nothing in the UI reached it any more.) */

/* A question row = the form's link + the live Question Bank record.
   Inactive links are kept — their responses stay visible to Admins. */
export type QRow = {
  link: FormQuestionLink;
  question: Question;
  label: string; // "Q1", "Q2", … actives numbered first
};

export function buildRows(form: FeedbackForm, bank: Question[]): QRow[] {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const actives = form.questions.filter((l) => l.status === "active");
  const inactives = form.questions.filter((l) => l.status === "inactive");
  const rows: QRow[] = [];
  [...actives, ...inactives].forEach((l, i) => {
    const q = byId.get(l.questionId);
    if (q) rows.push({ link: l, question: q, label: `Q${i + 1}` });
  });
  return rows;
}

/* An answer as plain text, for the CSV. */
function answerText(q: Question, a?: ResponseAnswer): string {
  if (!a) return "";
  switch (q.type) {
    case "Multiple choice":
    case "Multiple select": {
      const labels: string[] = [];
      for (const idx of a.optionIndexes ?? []) {
        const opt = q.options?.[idx];
        if (opt) labels.push(opt.text);
      }
      if (a.otherText) labels.push(`Other: "${a.otherText}"`);
      return labels.join(" · ");
    }
    case "True/False":
      return a.tfValue === undefined ? "" : a.tfValue ? "True" : "False";
    case "Match the following":
      return (a.matches ?? []).map((m) => `${m.left} → ${m.right}`).join(" · ");
    case "Linear scale":
      return a.scaleValue === undefined ? "" : String(a.scaleValue);
    case "Short answer":
      return a.text ? `"${a.text}"` : "";
    case "File upload":
      return (a.files ?? []).map((f) => `${f.name} (${f.sizeMb} MB)`).join(" · ");
  }
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFormCsv(form: FeedbackForm, rows: QRow[], responses: FormResponse[]) {
  const head = [
    "Response ID", "Name", "Email", "Trigger", "Submitted",
    ...rows.map((r) => `${r.label} ${r.question.text}`),
  ];
  const lines = [head.map(csvCell).join(",")];
  for (const r of responses) {
    lines.push(
      [
        r.id,
        r.userName,
        r.anonymized ? `de-identified · ${r.userId}` : r.userEmail,
        r.triggerName,
        r.submittedAt,
        ...rows.map((row) =>
          answerText(row.question, r.answers.find((a) => a.questionId === row.question.id)),
        ),
      ].map(csvCell).join(","),
    );
  }
  download(`${form.id}-responses.csv`, lines.join("\n"));
}

