import { useMemo, useState } from "react";
import {
  type FeedbackForm,
  type FormResponse,
  type Question,
  type ResponseAnswer,
} from "../data/feedbackForms";
import { SearchIcon, SmallXIcon, AddIcon } from "./icons";
import { Dropdown } from "./Dropdown";

type View = "summary" | "individual" | "cohort";

type Props = {
  form: FeedbackForm;
  responses: FormResponse[];
};

export function FeedbackFormResponses({ form, responses }: Props) {
  const [view, setView] = useState<View>("summary");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

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
            <div className="fb-stat-label">Responses (current version)</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-num">
              {form.responseCount.toLocaleString()}
            </div>
            <div className="fb-stat-label">All-time responses</div>
          </div>
          <div className="fb-stat">
            <div className="fb-stat-num">{form.questions.length}</div>
            <div className="fb-stat-label">Questions</div>
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
          {form.questions.map((q, i) => (
            <QuestionSummary
              key={q.id}
              index={i}
              question={q}
              responses={responses}
            />
          ))}
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
                    <div className="fb-resp-name">{r.userName}</div>
                    <div className="fb-resp-email">{r.userEmail}</div>
                  </div>
                  <div className="fb-resp-trigger">
                    <span className={`fb-trigger-kind fb-trigger-kind--${r.triggerKind}`}>
                      {r.triggerKind === "task" ? "Task" : "Cert"}
                    </span>
                    <span>{r.triggerName}</span>
                  </div>
                  <div className="fb-resp-version">v{r.formVersion}</div>
                  <div className="fb-resp-date">{r.submittedAt}</div>
                  <div className="fb-resp-id">{r.id}</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {view === "cohort" && (
        <CohortBuilder form={form} responses={responses} />
      )}

      {active && (
        <IndividualResponseDrawer
          response={active}
          form={form}
          onClose={() => setActiveId(null)}
        />
      )}
    </div>
  );
}

function QuestionSummary({
  index,
  question,
  responses,
}: {
  index: number;
  question: Question;
  responses: FormResponse[];
}) {
  const answers = responses
    .map((r) => r.answers.find((a) => a.questionId === question.id))
    .filter((a): a is ResponseAnswer => !!a);

  return (
    <div className="fb-summary-card">
      <div className="fb-summary-card-head">
        <span className="fb-q-num">{index + 1}</span>
        <div className="fb-summary-q">
          <div className="fb-summary-q-text">{question.textEn || "Untitled question"}</div>
          <div className="fb-summary-q-meta">
            <span>{labelForType(question.type)}</span>
            {question.required && (
              <>
                <span className="tasks-subtitle-dot" />
                <span className="fb-req-pill">Required</span>
              </>
            )}
            <span className="tasks-subtitle-dot" />
            <span>{answers.length} answers</span>
          </div>
        </div>
      </div>

      <div className="fb-summary-card-body">
        {(question.type === "single-select" || question.type === "multi-select") && (
          <ChoiceSummary question={question} answers={answers} />
        )}
        {question.type === "linear-scale" && (
          <ScaleSummary question={question} answers={answers} />
        )}
        {question.type === "short-answer" && <ShortSummary answers={answers} />}
        {question.type === "file-upload" && <FileSummary answers={answers} />}
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
  const total = answers.length;
  const counts = new Map<string, number>();
  let otherCount = 0;
  for (const a of answers) {
    if (a.otherText) otherCount += 1;
    for (const id of a.selectedOptionIds ?? []) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const otherTexts = answers.map((a) => a.otherText).filter(Boolean) as string[];

  return (
    <div className="fb-choice-summary">
      {(question.options ?? []).map((o) => {
        const c = counts.get(o.id) ?? 0;
        const pct = total === 0 ? 0 : (c / total) * 100;
        return (
          <div key={o.id} className="fb-bar-row">
            <div className="fb-bar-label">{o.textEn}</div>
            <div className="fb-bar-track">
              <div
                className="fb-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="fb-bar-value">
              {c} <span className="fb-faint">({pct.toFixed(0)}%)</span>
            </div>
          </div>
        );
      })}
      {question.allowOther && (
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

function ScaleSummary({
  question,
  answers,
}: {
  question: Question;
  answers: ResponseAnswer[];
}) {
  const min = question.scaleMin ?? 1;
  const max = question.scaleMax ?? 5;
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
      {(question.scaleLabelMin || question.scaleLabelMax) && (
        <div className="fb-scale-labels-row">
          <span>{question.scaleLabelMin}</span>
          <span>{question.scaleLabelMax}</span>
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
  form,
  onClose,
}: {
  response: FormResponse;
  form: FeedbackForm;
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
            <h2 className="sp-panel-title">{response.userName}</h2>
            <p className="sp-panel-sub">
              {response.userEmail} · {response.id} · submitted{" "}
              {response.submittedAt}
            </p>
            <div className="fb-drawer-tags">
              <span className={`fb-trigger-kind fb-trigger-kind--${response.triggerKind}`}>
                {response.triggerKind === "task" ? "Task" : "Cert"}
              </span>
              <span>{response.triggerName}</span>
              <span className="fb-drawer-version">
                Submitted against v{response.formVersion}
              </span>
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
          {form.questions.map((q, i) => {
            const a = response.answers.find((x) => x.questionId === q.id);
            return (
              <div key={q.id} className="fb-drawer-q">
                <div className="fb-drawer-q-num">{i + 1}</div>
                <div className="fb-drawer-q-text">{q.textEn}</div>
                <div className="fb-drawer-q-answer">
                  <AnswerView question={q} answer={a} />
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
    case "single-select":
    case "multi-select": {
      const labels: string[] = [];
      for (const id of answer.selectedOptionIds ?? []) {
        const opt = question.options?.find((o) => o.id === id);
        if (opt) labels.push(opt.textEn);
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
    case "linear-scale":
      return (
        <span className="fb-drawer-scale">
          {answer.scaleValue ?? "—"}{" "}
          <span className="fb-faint">
            (of {question.scaleMin ?? 1}–{question.scaleMax ?? 5})
          </span>
        </span>
      );
    case "short-answer":
      return answer.text ? (
        <span>"{answer.text}"</span>
      ) : (
        <span className="fb-faint">— not answered —</span>
      );
    case "file-upload":
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
  | { id: string; dim: "version"; value: number }
  | { id: string; dim: "choice"; questionId: string; optionId: string }
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
    case "version":
      return r.formVersion === f.value;
    case "choice": {
      const a = r.answers.find((x) => x.questionId === f.questionId);
      return !!a?.selectedOptionIds?.includes(f.optionId);
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

function shortQ(q: Question, i: number): string {
  const text = q.textEn || "Untitled question";
  return `Q${i + 1} · ${text.length > 40 ? text.slice(0, 40) + "…" : text}`;
}

function CohortBuilder({
  form,
  responses,
}: {
  form: FeedbackForm;
  responses: FormResponse[];
}) {
  const [filters, setFilters] = useState<CohortFilter[]>([]);
  const [breakdownId, setBreakdownId] = useState<string>(
    form.questions[0]?.id ?? "",
  );

  const triggers = useMemo(
    () => Array.from(new Set(responses.map((r) => r.triggerName))).sort(),
    [responses],
  );
  const versions = useMemo(
    () =>
      Array.from(new Set(responses.map((r) => r.formVersion))).sort(
        (a, b) => b - a,
      ),
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

  const breakdownQ = form.questions.find((q) => q.id === breakdownId);

  function addFilter(dim: string) {
    const firstQ = form.questions[0];
    let next: CohortFilter | null = null;
    if (dim === "trigger") {
      next = { id: fid(), dim: "trigger", value: triggers[0] ?? "" };
    } else if (dim === "version") {
      next = { id: fid(), dim: "version", value: versions[0] ?? form.version };
    } else {
      const q = form.questions.find((x) => x.id === dim) ?? firstQ;
      if (!q) return;
      if (q.type === "single-select" || q.type === "multi-select") {
        next = {
          id: fid(),
          dim: "choice",
          questionId: q.id,
          optionId: q.options?.[0]?.id ?? "",
        };
      } else if (q.type === "linear-scale") {
        next = {
          id: fid(),
          dim: "scale",
          questionId: q.id,
          op: "gte",
          value: q.scaleMin ?? 1,
        };
      } else if (q.type === "file-upload") {
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
      "Version",
      "Submitted",
      ...form.questions.map((_q, i) => `Q${i + 1}`),
    ];
    const rows = cohort.map((r) => [
      r.id,
      r.userName,
      r.userEmail,
      r.triggerName,
      `v${r.formVersion}`,
      r.submittedAt,
      ...form.questions.map((q) => csvAnswer(q, r.answers.find((a) => a.questionId === q.id))),
    ]);
    const csv = [headers, ...rows]
      .map((cols) => cols.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.id}-cohort.csv`;
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
              form={form}
              triggers={triggers}
              versions={versions}
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
              <button
                className="fb-cohort-menu-item"
                onClick={() => {
                  addFilter("version");
                  close();
                }}
              >
                Version
              </button>
              <div className="fb-cohort-menu-sep" />
              {form.questions.map((q, i) => (
                <button
                  key={q.id}
                  className="fb-cohort-menu-item"
                  onClick={() => {
                    addFilter(q.id);
                    close();
                  }}
                >
                  {shortQ(q, i)}
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
            {form.questions.map((q, i) => (
              <option key={q.id} value={q.id}>
                {shortQ(q, i)}
              </option>
            ))}
          </select>
          <span className="fb-faint">— this cohort</span>
        </div>
        {cohort.length === 0 ? (
          <div className="fb-empty">No responses match these filters.</div>
        ) : breakdownQ ? (
          <QuestionSummary
            index={form.questions.indexOf(breakdownQ)}
            question={breakdownQ}
            responses={cohort}
          />
        ) : null}
      </div>
    </div>
  );
}

function FilterRow({
  filter,
  form,
  triggers,
  versions,
  onChange,
}: {
  filter: CohortFilter;
  form: FeedbackForm;
  triggers: string[];
  versions: number[];
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
  if (filter.dim === "version") {
    return (
      <>
        <span className="fb-cohort-dim">Version is</span>
        <select
          className="fb-q-scale-select"
          value={filter.value}
          onChange={(e) => onChange({ value: Number(e.target.value) })}
        >
          {versions.map((v) => (
            <option key={v} value={v}>
              v{v}
            </option>
          ))}
        </select>
      </>
    );
  }

  const q = form.questions.find((x) => x.id === filter.questionId);
  const qIndex = form.questions.findIndex((x) => x.id === filter.questionId);
  const dimLabel = q ? `Q${qIndex + 1}` : "Question";

  if (filter.dim === "choice") {
    return (
      <>
        <span className="fb-cohort-dim">{dimLabel} includes</span>
        <select
          className="fb-q-scale-select"
          value={filter.optionId}
          onChange={(e) => onChange({ optionId: e.target.value })}
        >
          {(q?.options ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.textEn}
            </option>
          ))}
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
  const min = q?.scaleMin ?? 1;
  const max = q?.scaleMax ?? 5;
  const out: number[] = [];
  for (let i = min; i <= max; i++) out.push(i);
  return out;
}

function csvAnswer(q: Question, a?: ResponseAnswer): string {
  if (!a) return "";
  switch (q.type) {
    case "single-select":
    case "multi-select": {
      const labels = (a.selectedOptionIds ?? [])
        .map((id) => q.options?.find((o) => o.id === id)?.textEn)
        .filter(Boolean) as string[];
      if (a.otherText) labels.push(`Other: ${a.otherText}`);
      return labels.join("; ");
    }
    case "linear-scale":
      return a.scaleValue != null ? String(a.scaleValue) : "";
    case "short-answer":
      return a.text ?? "";
    case "file-upload":
      return (a.files ?? []).map((f) => f.name).join("; ");
  }
}

function csvCell(value: string): string {
  const v = value ?? "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function labelForType(t: Question["type"]): string {
  switch (t) {
    case "single-select":
      return "Single select";
    case "multi-select":
      return "Multi select";
    case "short-answer":
      return "Short answer";
    case "file-upload":
      return "File upload";
    case "linear-scale":
      return "Linear scale";
  }
}
