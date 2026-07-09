import { useMemo, useState } from "react";
import {
  type FeedbackForm,
  type FormQuestionLink,
  type FormResponse,
  type ResponseAnswer,
} from "../data/feedbackForms";
import { type Question } from "../data/questionBank";
import { SearchIcon, SmallXIcon, AddIcon } from "./icons";
import { Dropdown } from "./Dropdown";

type View = "summary" | "individual" | "cohort";

/* A question row = the form's link + the live Question Bank record.
   Inactive links are kept — their responses stay visible to Admins. */
type QRow = {
  link: FormQuestionLink;
  question: Question;
  label: string; // "Q1", "Q2", … actives numbered first
};

type Props = {
  form: FeedbackForm;
  bank: Question[];
  responses: FormResponse[];
};

function buildRows(form: FeedbackForm, bank: Question[]): QRow[] {
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

export function FeedbackFormResponses({ form, bank, responses }: Props) {
  const [view, setView] = useState<View>("summary");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(form, bank), [form, bank]);
  const activeRows = rows.filter((r) => r.link.status === "active");
  const inactiveRows = rows.filter((r) => r.link.status === "inactive");

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      responses.filter((r) => {
        if (!q) return true;
        return (
          r.userName.toLowerCase().includes(q) ||
          r.userEmail.toLowerCase().includes(q) ||
          r.triggerName.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q)
        );
      }),
    [responses, q],
  );

  const active = activeId
    ? responses.find((r) => r.id === activeId)
    : null;

  if (responses.length === 0) {
    return (
      <div className="fb-empty fb-empty--centered">
        <div className="fb-empty-title">No responses yet</div>
        <div className="fb-empty-sub">
          Once users complete a trigger, their feedback will show up here.
        </div>
      </div>
    );
  }

  return (
    <div className="fb-responses">
      <div className="fb-responses-head">
        <div className="fb-responses-stats">
          <div className="fb-stat">
            <div className="fb-stat-num">{responses.length}</div>
            <div className="fb-stat-label">Recent responses shown</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-num">
              {form.responseCount.toLocaleString()}
            </div>
            <div className="fb-stat-label">All-time responses</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-num">{activeRows.length}</div>
            <div className="fb-stat-label">Active questions</div>
          </div>
        </div>
        <div className="fb-responses-tabs">
          <button
            className={`sp-tab ${view === "summary" ? "is-active" : ""}`}
            onClick={() => setView("summary")}
          >
            Summary
          </button>
          <button
            className={`sp-tab ${view === "individual" ? "is-active" : ""}`}
            onClick={() => setView("individual")}
          >
            Individual responses
            <span className="sp-tab-count">{responses.length}</span>
          </button>
          <button
            className={`sp-tab ${view === "cohort" ? "is-active" : ""}`}
            onClick={() => setView("cohort")}
          >
            Cohort builder
          </button>
        </div>
      </div>

      {view === "summary" && (
        <div className="fb-summary">
          {activeRows.map((row) => (
            <QuestionSummary key={row.question.id} row={row} responses={responses} />
          ))}
          {inactiveRows.length > 0 && (
            <>
              <div className="fb-inactive-head fb-summary-divider">
                <h3 className="fb-section-title">Inactive questions</h3>
                <p className="fb-section-sub">
                  No longer shown to users. Responses collected while they were
                  active are preserved indefinitely.
                </p>
              </div>
              {inactiveRows.map((row) => (
                <QuestionSummary
                  key={row.question.id}
                  row={row}
                  responses={responses}
                />
              ))}
            </>
          )}
        </div>
      )}

      {view === "individual" && (
        <div className="fb-individual">
          <div className="search-wrap fb-resp-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              placeholder="Search by name, email, trigger, or response ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="fb-resp-list">
            {filtered.length === 0 ? (
              <div className="fb-empty">No responses match.</div>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  className="fb-resp-row"
                  onClick={() => setActiveId(r.id)}
                >
                  <div className="fb-resp-user">
                    <div className={`fb-resp-name ${r.anonymized ? "fb-anon" : ""}`}>
                      {r.userName}
                    </div>
                    <div className="fb-resp-email">
                      {r.anonymized ? `de-identified · ${r.userId}` : r.userEmail}
                    </div>
                  </div>
                  <div className="fb-resp-trigger">
                    <span className={`fb-trigger-kind fb-trigger-kind--${r.triggerKind}`}>
                      {r.triggerKind === "task" ? "Task" : "Cert"}
                    </span>
                    <span>{r.triggerName}</span>
                  </div>
                  <div className="fb-resp-date">{r.submittedAt}</div>
                  <div className="fb-resp-id">{r.id}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {view === "cohort" && (
        <CohortBuilder rows={rows} responses={responses} formId={form.id} />
      )}

      <div className="fb-retention-note">
        Responses are never deleted — archiving the form preserves them. When a
        user deletes their account, their responses are kept for aggregate
        integrity but de-identified.
      </div>

      {active && (
        <IndividualResponseDrawer
          response={active}
          rows={rows}
          onClose={() => setActiveId(null)}
        />
      )}
    </div>
  );
}

function QuestionSummary({
  row,
  responses,
}: {
  row: QRow;
  responses: FormResponse[];
}) {
  const { question, link, label } = row;
  const answers = responses
    .map((r) => r.answers.find((a) => a.questionId === question.id))
    .filter((a): a is ResponseAnswer => !!a);

  return (
    <div className={`fb-summary-card ${link.status === "inactive" ? "is-inactive" : ""}`}>
      <div className="fb-summary-card-head">
        <span className="fb-q-num">{label.slice(1)}</span>
        <div className="fb-summary-q">
          <div className="fb-summary-q-text">{question.text}</div>
          <div className="fb-summary-q-meta">
            <span>{question.type}</span>
            <span className="tasks-subtitle-dot" />
            <span className="fb-link-id">{question.id}</span>
            {link.mandatory && link.status === "active" && (
              <>
                <span className="tasks-subtitle-dot" />
                <span className="fb-req-pill">Mandatory</span>
              </>
            )}
            {link.status === "inactive" && (
              <>
                <span className="tasks-subtitle-dot" />
                <span className="fb-inactive-pill">Inactive</span>
              </>
            )}
            {question.gradingEnabled && (
              <>
                <span className="tasks-subtitle-dot" />
                <span title="Grading data is ignored in Feedback Forms">
                  graded · ignored here
                </span>
              </>
            )}
            <span className="tasks-subtitle-dot" />
            <span>{answers.length} answers</span>
          </div>
        </div>
      </div>

      <div className="fb-summary-card-body">
        {(question.type === "Multiple choice" ||
          question.type === "Multiple select") && (
          <ChoiceSummary question={question} answers={answers} />
        )}
        {question.type === "True/False" && <TfSummary answers={answers} />}
        {question.type === "Linear scale" && (
          <ScaleSummary question={question} answers={answers} />
        )}
        {question.type === "Short answer" && <ShortSummary answers={answers} />}
        {question.type === "File upload" && <FileSummary answers={answers} />}
        {question.type === "Match the following" && (
          <MatchSummary question={question} answers={answers} />
        )}
      </div>
    </div>
  );
}

function ChoiceSummary({
  question,
  answers,
}: {
  question: Question;
  answers: ResponseAnswer[];
}) {
  const options = question.options ?? [];
  const total = answers.length;
  const counts = new Map<number, number>();
  let otherCount = 0;
  for (const a of answers) {
    if (a.otherText) otherCount += 1;
    for (const idx of a.optionIndexes ?? []) {
      counts.set(idx, (counts.get(idx) ?? 0) + 1);
    }
  }
  const otherTexts = answers.map((a) => a.otherText).filter(Boolean) as string[];

  return (
    <div className="fb-choice-summary">
      {options.map((o, idx) => {
        const c = counts.get(idx) ?? 0;
        const pct = total === 0 ? 0 : (c / total) * 100;
        return (
          <div key={idx} className="fb-bar-row">
            <div className="fb-bar-label">{o.text}</div>
            <div className="fb-bar-track">
              <div className="fb-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="fb-bar-value">
              {c} <span className="fb-faint">({pct.toFixed(0)}%)</span>
            </div>
          </div>
        );
      })}
      {question.otherOption && (
        <div className="fb-bar-row">
          <div className="fb-bar-label">Other</div>
          <div className="fb-bar-track">
            <div
              className="fb-bar-fill fb-bar-fill--other"
              style={{
                width: `${total === 0 ? 0 : (otherCount / total) * 100}%`,
              }}
            />
          </div>
          <div className="fb-bar-value">
            {otherCount}{" "}
            <span className="fb-faint">
              ({total === 0 ? 0 : ((otherCount / total) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      )}
      {otherTexts.length > 0 && (
        <details className="fb-other-list">
          <summary>Show {otherTexts.length} "Other" responses</summary>
          <ul>
            {otherTexts.slice(0, 8).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
            {otherTexts.length > 8 && (
              <li className="fb-faint">+{otherTexts.length - 8} more</li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}

function TfSummary({ answers }: { answers: ResponseAnswer[] }) {
  const total = answers.length;
  const trueCount = answers.filter((a) => a.tfValue === true).length;
  const falseCount = answers.filter((a) => a.tfValue === false).length;
  return (
    <div className="fb-choice-summary">
      {[
        { label: "True", c: trueCount },
        { label: "False", c: falseCount },
      ].map(({ label, c }) => (
        <div key={label} className="fb-bar-row">
          <div className="fb-bar-label">{label}</div>
          <div className="fb-bar-track">
            <div
              className="fb-bar-fill"
              style={{ width: `${total === 0 ? 0 : (c / total) * 100}%` }}
            />
          </div>
          <div className="fb-bar-value">
            {c}{" "}
            <span className="fb-faint">
              ({total === 0 ? 0 : ((c / total) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchSummary({
  question,
  answers,
}: {
  question: Question;
  answers: ResponseAnswer[];
}) {
  const pairs = (question.pairs ?? []).filter((p) => p.left);
  const total = answers.length;
  return (
    <div className="fb-choice-summary">
      {pairs.map((p) => {
        const c = answers.filter((a) =>
          a.matches?.some((m) => m.left === p.left && m.right === p.right),
        ).length;
        const pct = total === 0 ? 0 : (c / total) * 100;
        return (
          <div key={p.left} className="fb-bar-row">
            <div className="fb-bar-label">
              {p.left} <span className="fb-faint">↔</span> {p.right}
            </div>
            <div className="fb-bar-track">
              <div className="fb-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="fb-bar-value">
              {c} <span className="fb-faint">({pct.toFixed(0)}%)</span>
            </div>
          </div>
        );
      })}
      <div className="fb-faint fb-match-note">
        Share of respondents who paired each item this way. Grading is ignored —
        this is not a score.
      </div>
    </div>
  );
}

function ScaleSummary({
  question,
  answers,
}: {
  question: Question;
  answers: ResponseAnswer[];
}) {
  const min = question.scale?.min ?? 1;
  const max = question.scale?.max ?? 5;
  const points: number[] = [];
  for (let i = min; i <= max; i++) points.push(i);
  const counts = new Map<number, number>();
  let sum = 0;
  let n = 0;
  for (const a of answers) {
    if (typeof a.scaleValue !== "number") continue;
    counts.set(a.scaleValue, (counts.get(a.scaleValue) ?? 0) + 1);
    sum += a.scaleValue;
    n += 1;
  }
  const avg = n === 0 ? 0 : sum / n;
  const maxCount = Math.max(1, ...Array.from(counts.values()));

  return (
    <div className="fb-scale-summary">
      <div className="fb-scale-stats">
        <div className="fb-scale-stat">
          <div className="fb-scale-stat-num">{avg.toFixed(1)}</div>
          <div className="fb-scale-stat-label">Average</div>
        </div>
        <div className="fb-scale-stat">
          <div className="fb-scale-stat-num">{n}</div>
          <div className="fb-scale-stat-label">Responses</div>
        </div>
      </div>
      <div className="fb-scale-histogram">
        {points.map((p) => {
          const c = counts.get(p) ?? 0;
          const h = (c / maxCount) * 100;
          return (
            <div key={p} className="fb-hist-col">
              <div className="fb-hist-bar-wrap">
                <div
                  className="fb-hist-bar"
                  style={{ height: `${h}%` }}
                  title={`${c} responses`}
                />
              </div>
              <div className="fb-hist-num">{p}</div>
              <div className="fb-hist-count">{c}</div>
            </div>
          );
        })}
      </div>
      {(question.scale?.minLabel || question.scale?.maxLabel) && (
        <div className="fb-scale-labels-row">
          <span>{question.scale?.minLabel}</span>
          <span>{question.scale?.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function ShortSummary({ answers }: { answers: ResponseAnswer[] }) {
  const texts = answers
    .map((a) => a.text)
    .filter((t): t is string => !!t && t.length > 0);

  if (texts.length === 0) {
    return <div className="fb-faint">No text responses yet.</div>;
  }

  return (
    <div className="fb-short-summary">
      <div className="fb-short-summary-meta">
        {texts.length} response{texts.length === 1 ? "" : "s"} ·{" "}
        {Math.round(
          texts.reduce((acc, t) => acc + t.length, 0) / texts.length,
        )}{" "}
        chars avg
      </div>
      <ul className="fb-short-list">
        {texts.slice(0, 6).map((t, i) => (
          <li key={i}>"{t}"</li>
        ))}
        {texts.length > 6 && (
          <li className="fb-faint">+{texts.length - 6} more — open Individual responses to view all</li>
        )}
      </ul>
    </div>
  );
}

function FileSummary({ answers }: { answers: ResponseAnswer[] }) {
  const withFiles = answers.filter((a) => (a.files?.length ?? 0) > 0);
  const totalFiles = withFiles.reduce(
    (acc, a) => acc + (a.files?.length ?? 0),
    0,
  );
  return (
    <div className="fb-file-summary">
      <div className="fb-file-summary-stat">
        <strong>{withFiles.length}</strong>
        <span className="fb-faint">
          {" "}of {answers.length} responses included files
        </span>
      </div>
      <div className="fb-file-summary-stat">
        <strong>{totalFiles}</strong>
        <span className="fb-faint"> files uploaded total</span>
      </div>
    </div>
  );
}

function IndividualResponseDrawer({
  response,
  rows,
  onClose,
}: {
  response: FormResponse;
  rows: QRow[];
  onClose: () => void;
}) {
  return (
    <div className="fb-drawer-scrim" onClick={onClose}>
      <aside
        className="fb-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="fb-drawer-head">
          <div>
            <div className="sp-panel-eyebrow">RESPONSE</div>
            <h2 className={`sp-panel-title ${response.anonymized ? "fb-anon" : ""}`}>
              {response.userName}
            </h2>
            <p className="sp-panel-sub">
              {response.anonymized
                ? `${response.userId} · account deleted — response de-identified`
                : `${response.userEmail} · ${response.id}`}{" "}
              · submitted {response.submittedAt}
            </p>
            <div className="fb-drawer-tags">
              <span className={`fb-trigger-kind fb-trigger-kind--${response.triggerKind}`}>
                {response.triggerKind === "task" ? "Task" : "Cert"}
              </span>
              <span>{response.triggerName}</span>
            </div>
          </div>
          <button
            className="sp-panel-close"
            aria-label="Close"
            onClick={onClose}
          >
            <SmallXIcon />
          </button>
        </div>
        <div className="fb-drawer-body">
          {rows.map((row) => {
            const a = response.answers.find(
              (x) => x.questionId === row.question.id,
            );
            // Every question the user answered stays visible — including ones
            // marked Inactive since. Unanswered inactive questions are noise.
            if (row.link.status === "inactive" && !a) return null;
            return (
              <div key={row.question.id} className="fb-drawer-q">
                <div className="fb-drawer-q-num">{row.label.slice(1)}</div>
                <div className="fb-drawer-q-text">
                  {row.question.text}
                  {row.link.status === "inactive" && (
                    <span
                      className="fb-inactive-pill"
                      title={
                        row.link.deactivatedAt
                          ? `Marked Inactive on ${row.link.deactivatedAt}`
                          : undefined
                      }
                    >
                      Inactive
                    </span>
                  )}
                  {a && a.questionVersion !== row.question.version && (
                    <span
                      className="fb-link-id fb-answered-version"
                      title="The question was edited after this answer — the response references the version the user actually saw"
                    >
                      answered v{a.questionVersion} · now v{row.question.version}
                    </span>
                  )}
                </div>
                <div className="fb-drawer-q-answer">
                  <AnswerView question={row.question} answer={a} />
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function AnswerView({
  question,
  answer,
}: {
  question: Question;
  answer?: ResponseAnswer;
}) {
  if (!answer) return <span className="fb-faint">— not answered —</span>;
  switch (question.type) {
    case "Multiple choice":
    case "Multiple select": {
      const labels: string[] = [];
      for (const idx of answer.optionIndexes ?? []) {
        const opt = question.options?.[idx];
        if (opt) labels.push(opt.text);
      }
      if (answer.otherText) labels.push(`Other: "${answer.otherText}"`);
      if (labels.length === 0)
        return <span className="fb-faint">— not answered —</span>;
      return (
        <ul className="fb-drawer-answer-list">
          {labels.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      );
    }
    case "True/False":
      return answer.tfValue === undefined ? (
        <span className="fb-faint">— not answered —</span>
      ) : (
        <span>{answer.tfValue ? "True" : "False"}</span>
      );
    case "Match the following":
      if (!answer.matches || answer.matches.length === 0)
        return <span className="fb-faint">— not answered —</span>;
      return (
        <ul className="fb-drawer-answer-list">
          {answer.matches.map((m, i) => (
            <li key={i}>
              {m.left} <span className="fb-faint">→</span> {m.right}
            </li>
          ))}
        </ul>
      );
    case "Linear scale":
      return (
        <span className="fb-drawer-scale">
          {answer.scaleValue ?? "—"}{" "}
          <span className="fb-faint">
            (of {question.scale?.min ?? 1}–{question.scale?.max ?? 5})
          </span>
        </span>
      );
    case "Short answer":
      return answer.text ? (
        <span>"{answer.text}"</span>
      ) : (
        <span className="fb-faint">— not answered —</span>
      );
    case "File upload":
      if (!answer.files || answer.files.length === 0)
        return <span className="fb-faint">— no files —</span>;
      return (
        <ul className="fb-drawer-answer-list">
          {answer.files.map((f, i) => (
            <li key={i}>
              {f.name} <span className="fb-faint">({f.sizeMb} MB)</span>
            </li>
          ))}
        </ul>
      );
  }
}

// ---------------------- Cohort builder ----------------------

type CohortFilter =
  | { id: string; dim: "trigger"; value: string }
  | { id: string; dim: "choice"; questionId: string; optionIndex: number }
  | { id: string; dim: "tf"; questionId: string; value: boolean }
  | { id: string; dim: "scale"; questionId: string; op: "gte" | "lte"; value: number }
  | { id: string; dim: "text"; questionId: string; value: string }
  | { id: string; dim: "file"; questionId: string };

function fid() {
  return `cf-${Math.random().toString(36).slice(2, 8)}`;
}

function matchesFilter(r: FormResponse, f: CohortFilter): boolean {
  switch (f.dim) {
    case "trigger":
      return r.triggerName === f.value;
    case "choice": {
      const a = r.answers.find((x) => x.questionId === f.questionId);
      return !!a?.optionIndexes?.includes(f.optionIndex);
    }
    case "tf": {
      const a = r.answers.find((x) => x.questionId === f.questionId);
      return a?.tfValue === f.value;
    }
    case "scale": {
      const a = r.answers.find((x) => x.questionId === f.questionId);
      if (typeof a?.scaleValue !== "number") return false;
      return f.op === "gte" ? a.scaleValue >= f.value : a.scaleValue <= f.value;
    }
    case "text": {
      const v = f.value.trim().toLowerCase();
      if (!v) return true;
      const a = r.answers.find((x) => x.questionId === f.questionId);
      return !!a?.text?.toLowerCase().includes(v);
    }
    case "file": {
      const a = r.answers.find((x) => x.questionId === f.questionId);
      return (a?.files?.length ?? 0) > 0;
    }
  }
}

function shortQ(row: QRow): string {
  const text = row.question.text;
  return `${row.label} · ${text.length > 40 ? text.slice(0, 40) + "…" : text}`;
}

function CohortBuilder({
  rows,
  responses,
  formId,
}: {
  rows: QRow[];
  responses: FormResponse[];
  formId: string;
}) {
  const [filters, setFilters] = useState<CohortFilter[]>([]);
  const [breakdownId, setBreakdownId] = useState<string>(
    rows[0]?.question.id ?? "",
  );

  const triggers = useMemo(
    () => Array.from(new Set(responses.map((r) => r.triggerName))).sort(),
    [responses],
  );

  const cohort = useMemo(
    () => responses.filter((r) => filters.every((f) => matchesFilter(r, f))),
    [responses, filters],
  );

  const pct =
    responses.length === 0
      ? 0
      : Math.round((cohort.length / responses.length) * 100);

  const breakdownRow = rows.find((row) => row.question.id === breakdownId);

  function addFilter(dim: string) {
    let next: CohortFilter | null = null;
    if (dim === "trigger") {
      next = { id: fid(), dim: "trigger", value: triggers[0] ?? "" };
    } else {
      const row = rows.find((x) => x.question.id === dim) ?? rows[0];
      if (!row) return;
      const q = row.question;
      if (q.type === "Multiple choice" || q.type === "Multiple select") {
        next = { id: fid(), dim: "choice", questionId: q.id, optionIndex: 0 };
      } else if (q.type === "True/False") {
        next = { id: fid(), dim: "tf", questionId: q.id, value: true };
      } else if (q.type === "Linear scale") {
        next = {
          id: fid(),
          dim: "scale",
          questionId: q.id,
          op: "gte",
          value: q.scale?.min ?? 1,
        };
      } else if (q.type === "File upload") {
        next = { id: fid(), dim: "file", questionId: q.id };
      } else {
        next = { id: fid(), dim: "text", questionId: q.id, value: "" };
      }
    }
    if (next) setFilters((prev) => [...prev, next as CohortFilter]);
  }

  function updateFilter(id: string, patch: Partial<CohortFilter>) {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? ({ ...f, ...patch } as CohortFilter) : f)),
    );
  }

  function removeFilter(id: string) {
    setFilters((prev) => prev.filter((f) => f.id !== id));
  }

  function exportCohort() {
    const headers = [
      "Response ID",
      "User",
      "Email",
      "Trigger",
      "Submitted",
      ...rows.map((row) =>
        row.link.status === "inactive" ? `${row.label} (inactive)` : row.label,
      ),
    ];
    const csvRows = cohort.map((r) => [
      r.id,
      r.userName,
      r.userEmail,
      r.triggerName,
      r.submittedAt,
      ...rows.map((row) =>
        csvAnswer(
          row.question,
          r.answers.find((a) => a.questionId === row.question.id),
        ),
      ),
    ]);
    const csv = [headers, ...csvRows]
      .map((cols) => cols.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formId}-cohort.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fb-cohort">
      <div>
        <h3 className="fb-section-title">Build a cohort on the fly</h3>
        <p className="fb-section-sub">
          Stack filters to slice the response set. Every filter narrows the
          cohort further.
        </p>
      </div>

      <div className="fb-cohort-filters">
        {filters.map((f, i) => (
          <div key={f.id} className="fb-cohort-filter">
            {i > 0 && <span className="fb-cohort-and">and</span>}
            <FilterRow
              filter={f}
              rows={rows}
              triggers={triggers}
              onChange={(patch) => updateFilter(f.id, patch)}
            />
            <button
              className="fb-cohort-remove"
              aria-label="Remove filter"
              onClick={() => removeFilter(f.id)}
            >
              <SmallXIcon />
            </button>
          </div>
        ))}

        <Dropdown
          width={260}
          trigger={({ toggle }) => (
            <button className="fb-cohort-add" onClick={toggle}>
              <AddIcon /> Add filter
            </button>
          )}
        >
          {({ close }) => (
            <div className="fb-cohort-menu">
              <button
                className="fb-cohort-menu-item"
                onClick={() => {
                  addFilter("trigger");
                  close();
                }}
              >
                Trigger
              </button>
              <div className="fb-cohort-menu-sep" />
              {rows
                .filter((row) => row.question.type !== "Match the following")
                .map((row) => (
                  <button
                    key={row.question.id}
                    className="fb-cohort-menu-item"
                    onClick={() => {
                      addFilter(row.question.id);
                      close();
                    }}
                  >
                    {shortQ(row)}
                  </button>
                ))}
            </div>
          )}
        </Dropdown>
      </div>

      <div className="fb-cohort-result">
        <div className="fb-stat">
          <div className="fb-stat-num">{cohort.length.toLocaleString()}</div>
          <div className="fb-stat-label">
            Cohort size · {pct}% of {responses.length.toLocaleString()}
          </div>
        </div>
        <button
          className="btn-save-draft"
          onClick={exportCohort}
          disabled={cohort.length === 0}
        >
          Export cohort
        </button>
      </div>

      <div className="fb-cohort-breakdown">
        <div className="fb-cohort-breakdown-head">
          <span className="fb-cohort-breakdown-label">Breakdown</span>
          <select
            className="fb-q-scale-select"
            value={breakdownId}
            onChange={(e) => setBreakdownId(e.target.value)}
          >
            {rows.map((row) => (
              <option key={row.question.id} value={row.question.id}>
                {shortQ(row)}
              </option>
            ))}
          </select>
          <span className="fb-faint">— this cohort</span>
        </div>
        {cohort.length === 0 ? (
          <div className="fb-empty">No responses match these filters.</div>
        ) : breakdownRow ? (
          <QuestionSummary row={breakdownRow} responses={cohort} />
        ) : null}
      </div>
    </div>
  );
}

function FilterRow({
  filter,
  rows,
  triggers,
  onChange,
}: {
  filter: CohortFilter;
  rows: QRow[];
  triggers: string[];
  onChange: (patch: Partial<CohortFilter>) => void;
}) {
  if (filter.dim === "trigger") {
    return (
      <>
        <span className="fb-cohort-dim">Trigger is</span>
        <select
          className="fb-q-scale-select"
          value={filter.value}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          {triggers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </>
    );
  }

  const row = rows.find((x) => x.question.id === filter.questionId);
  const q = row?.question;
  const dimLabel = row?.label ?? "Question";

  if (filter.dim === "choice") {
    return (
      <>
        <span className="fb-cohort-dim">{dimLabel} includes</span>
        <select
          className="fb-q-scale-select"
          value={filter.optionIndex}
          onChange={(e) => onChange({ optionIndex: Number(e.target.value) })}
        >
          {(q?.options ?? []).map((o, idx) => (
            <option key={idx} value={idx}>
              {o.text}
            </option>
          ))}
        </select>
      </>
    );
  }
  if (filter.dim === "tf") {
    return (
      <>
        <span className="fb-cohort-dim">{dimLabel} is</span>
        <select
          className="fb-q-scale-select"
          value={filter.value ? "true" : "false"}
          onChange={(e) => onChange({ value: e.target.value === "true" })}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      </>
    );
  }
  if (filter.dim === "scale") {
    return (
      <>
        <span className="fb-cohort-dim">{dimLabel} score is</span>
        <select
          className="fb-q-scale-select"
          value={filter.op}
          onChange={(e) => onChange({ op: e.target.value as "gte" | "lte" })}
        >
          <option value="gte">≥</option>
          <option value="lte">≤</option>
        </select>
        <select
          className="fb-q-scale-select"
          value={filter.value}
          onChange={(e) => onChange({ value: Number(e.target.value) })}
        >
          {scalePoints(q).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </>
    );
  }
  if (filter.dim === "file") {
    return <span className="fb-cohort-dim">{dimLabel} included a file</span>;
  }
  return (
    <>
      <span className="fb-cohort-dim">{dimLabel} text contains</span>
      <input
        className="fb-cohort-input"
        placeholder="keyword…"
        value={filter.value}
        onChange={(e) => onChange({ value: e.target.value })}
      />
    </>
  );
}

function scalePoints(q?: Question): number[] {
  const min = q?.scale?.min ?? 1;
  const max = q?.scale?.max ?? 5;
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

function csvAnswer(q: Question, a?: ResponseAnswer): string {
  if (!a) return "";
  switch (q.type) {
    case "Multiple choice":
    case "Multiple select": {
      const labels = (a.optionIndexes ?? [])
        .map((idx) => q.options?.[idx]?.text)
        .filter(Boolean) as string[];
      if (a.otherText) labels.push(`Other: ${a.otherText}`);
      return labels.join("; ");
    }
    case "True/False":
      return a.tfValue === undefined ? "" : a.tfValue ? "True" : "False";
    case "Match the following":
      return (a.matches ?? []).map((m) => `${m.left} -> ${m.right}`).join("; ");
    case "Linear scale":
      return a.scaleValue != null ? String(a.scaleValue) : "";
    case "Short answer":
      return a.text ?? "";
    case "File upload":
      return (a.files ?? []).map((f) => f.name).join("; ");
  }
}

function csvCell(value: string): string {
  const v = value ?? "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
