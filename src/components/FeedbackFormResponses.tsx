import { useMemo, useState } from "react";
import {
  type FeedbackForm,
  type FormQuestionLink,
  type FormResponse,
  type ResponseAnswer,
} from "../data/feedbackForms";
import { type Question, type QuestionType } from "../data/questionBank";
import { InfoTipIcon, SearchIcon } from "./icons";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import {
  DateRangePill,
  dateRangeIncludes,
  defaultDateRange,
  type DateRangeState,
} from "./DateRangeFilter";

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

/* Viewer headers name the question's shape in full — the Bank's short codes
   (T/F, Scale, Short) read as jargon here. */
const TYPE_LABEL: Record<QuestionType, string> = {
  "Multiple choice": "Multiple Choice",
  "Multiple select": "Multiple Select",
  "True/False": "True/False",
  "Match the following": "Match the Following",
  "Short answer": "Short Answer",
  "File upload": "File Upload",
  "Linear scale": "Linear Scale",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

function fmtFull(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/* "Marcus Okafor" → "M. Okafor" — the compact byline on summary quotes. */
function shortName(r: FormResponse): string {
  if (r.anonymized) return "Deleted user";
  const parts = r.userName.trim().split(/\s+/);
  if (parts.length < 2) return r.userName;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

/* ─────────────── Plain-text answers (detail pane + CSV export) ─────────────── */

export function answerText(q: Question, a?: ResponseAnswer): string {
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

export function exportResponseCsv(rows: QRow[], r: FormResponse) {
  const lines = [["Question", "Answer"].map(csvCell).join(",")];
  for (const row of rows) {
    const a = r.answers.find((x) => x.questionId === row.question.id);
    if (row.link.status === "inactive" && !a) continue;
    lines.push([`${row.label} ${row.question.text}`, answerText(row.question, a)].map(csvCell).join(","));
  }
  download(`${r.id}.csv`, lines.join("\n"));
}

/* ═══════════════════════════ Overview tab ═══════════════════════════ */

/* Prompted / dismissed / median aren't in the response records — they live in
   the (mocked) prompt log. Derived deterministically so the tiles stay stable. */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type Props = {
  form: FeedbackForm;
  bank: Question[];
  responses: FormResponse[];
};

export function FormOverview({ form, bank, responses }: Props) {
  const rows = useMemo(() => buildRows(form, bank), [form, bank]);
  const [triggerSel, setTriggerSel] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeState>(() => defaultDateRange());
  const [showInactive, setShowInactive] = useState(true);

  const triggerOptions = useMemo(
    () => [...new Set([...form.triggers.map((t) => t.refName), ...responses.map((r) => r.triggerName)])],
    [form.triggers, responses],
  );

  /* The trigger filter scopes everything below the stat tiles; the Date Range
     scopes the question summaries (the chart plots its own window). */
  const byTrigger = useMemo(
    () => responses.filter((r) => triggerSel.length === 0 || triggerSel.includes(r.triggerName)),
    [responses, triggerSel],
  );
  const filtered = useMemo(
    () => byTrigger.filter((r) => dateRangeIncludes(dateRange, r.submittedAt)),
    [byTrigger, dateRange],
  );

  const submitted = form.responseCount;
  const prompted = submitted === 0 ? 0 : Math.round(submitted / 0.261);
  const stats = [
    { label: "Prompted", value: prompted.toLocaleString(), note: "Users shown the form" },
    { label: "Submitted", value: submitted.toLocaleString(), note: "One per user, ever" },
    {
      label: "Submission Rate",
      value: prompted === 0 ? "" : `${((submitted / prompted) * 100).toFixed(1)}%`,
      note: "Submitted ÷ prompted",
    },
    { label: "Dismissed", value: (prompted - submitted).toLocaleString(), note: "Re-eligible on next trigger" },
    {
      label: "Median Time",
      value: submitted === 0 ? "" : `${40 + (hashCode(form.id) % 25)}s`,
      note: "Open to submit",
    },
  ];

  const activeRows = rows.filter((r) => r.link.status === "active");
  const inactiveRows = rows.filter((r) => r.link.status === "inactive");

  return (
    <div className="fb-viewer">
      <div className="fb-ov-stats">
        {stats.map((s) => (
          <div key={s.label} className="fb-ov-stat">
            <div className="fb-ov-stat-label">{s.label}</div>
            <div className="fb-ov-stat-num">{s.value}</div>
            <div className="fb-ov-stat-note">{s.note}</div>
          </div>
        ))}
      </div>

      <TrendCard range={dateRange} responses={byTrigger} />

      <div className="fb-q-toolbar">
        <span className="fb-q-toolbar-title">Questions</span>
        <Dropdown
          width={260}
          trigger={({ open, toggle }) => (
            <PillTrigger
              label="Trigger"
              value={summarize(triggerSel, triggerOptions)}
              open={open}
              toggle={toggle}
              onClear={() => setTriggerSel([])}
            />
          )}
        >
          {({ close }) => (
            <SectionedMultiSelect
              sections={[{ items: triggerOptions }]}
              value={triggerSel}
              onApply={(v) => {
                setTriggerSel(v);
                close();
              }}
            />
          )}
        </Dropdown>
        <DateRangePill value={dateRange} onChange={setDateRange} />
        <label className="fb-inactive-check">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show Inactive Questions
        </label>
      </div>

      {responses.length === 0 ? (
        <div className="fb-empty fb-empty--centered">
          <div className="fb-empty-title">No responses yet</div>
          <div className="fb-empty-sub">
            Once users complete a trigger, their feedback will show up here.
          </div>
        </div>
      ) : (
        <div className="fb-summary">
          {activeRows.map((row) => (
            <QuestionSummary key={row.question.id} row={row} responses={filtered} />
          ))}
          {showInactive &&
            inactiveRows.map((row) => (
              <QuestionSummary key={row.question.id} row={row} responses={filtered} />
            ))}
        </div>
      )}

      <div className="fb-retention-note">
        Responses are never deleted — disabling the form preserves them. When a
        user deletes their account, their responses are kept for aggregate
        integrity but de-identified.
      </div>
    </div>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/* Submissions Over Time — weekly buckets across the selected Date Range (wide
   ranges coarsen so the card never exceeds 12 columns). */
function TrendCard({ range, responses }: { range: DateRangeState; responses: FormResponse[] }) {
  const { buckets, label } = useMemo(() => {
    const s = Date.parse(range.start);
    const e = Date.parse(range.end) + DAY_MS - 1;
    const weeks = Math.max(1, Math.ceil((e - s) / WEEK_MS));
    const size = weeks <= 12 ? WEEK_MS : Math.ceil((e - s) / 12);
    const n = Math.ceil((e - s) / size);
    const counts = new Array<number>(n).fill(0);
    for (const r of responses) {
      const t = Date.parse(r.submittedAt);
      if (Number.isNaN(t) || t < s || t > e) continue;
      counts[Math.min(n - 1, Math.floor((t - s) / size))] += 1;
    }
    return {
      buckets: counts.map((c, i) => ({
        n: c,
        from: fmtDay(new Date(s + i * size).toISOString().slice(0, 10)),
      })),
      label: `${weeks <= 12 ? "Weekly" : `${Math.round(size / DAY_MS)}-day periods`} · ${fmtDay(range.start)} – ${fmtDay(range.end)}`,
    };
  }, [range, responses]);

  const max = Math.max(1, ...buckets.map((b) => b.n));
  return (
    <div className="fb-trend">
      <div className="fb-trend-head">
        <span className="fb-trend-title">Submissions Over Time</span>
        <span className="fb-trend-range">{label}</span>
      </div>
      <div className="fb-trend-grid" style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)` }}>
        {buckets.map((b, i) => (
          <div
            key={i}
            className="fb-trend-bar"
            title={`Week of ${b.from}: ${b.n}`}
            style={{ height: `${Math.max(2, Math.round((b.n / max) * 100))}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* Answers joined to the response that carried them — the summaries that show
   bylines/dates (Short Answer) read the pair, the rest read the answer alone. */
type Entry = { r: FormResponse; a: ResponseAnswer };

function QuestionSummary({ row, responses }: { row: QRow; responses: FormResponse[] }) {
  const { question, link, label } = row;
  const entries: Entry[] = [];
  for (const r of responses) {
    const a = r.answers.find((x) => x.questionId === question.id);
    if (a) entries.push({ r, a });
  }
  const answers = entries.map((e) => e.a);
  const inactive = link.status === "inactive";

  return (
    <div className={`fb-summary-card ${inactive ? "is-inactive" : ""}`}>
      <div className="fb-summary-card-head">
        <div className="fb-summary-q">
          <div className="fb-summary-q-tags">
            <span className="fb-q-kicker">{label}</span>
            <span className="fb-type-pill">{TYPE_LABEL[question.type]}</span>
            {link.mandatory && !inactive && <span className="fb-req-pill">Mandatory</span>}
            {inactive && (
              <span className="fb-inactive-pill">
                Inactive{link.deactivatedAt ? ` since ${fmtDay(link.deactivatedAt)}` : ""}
              </span>
            )}
          </div>
          <div className="fb-summary-q-text">{question.text}</div>
          <div className="fb-summary-q-meta">
            <span className="fb-mono">{answers.length}</span>
            <span>answers</span>
            <span className="tasks-subtitle-dot" />
            <span className="fb-link-id">{question.id}</span>
            {question.gradingEnabled && (
              <>
                <span className="tasks-subtitle-dot" />
                <span>Graded in the Question Bank — grading ignored in Feedback Forms</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="fb-summary-card-body">
        {(question.type === "Multiple choice" || question.type === "Multiple select") && (
          <ChoiceSummary question={question} answers={answers} />
        )}
        {question.type === "True/False" && <TfSummary answers={answers} />}
        {question.type === "Linear scale" && (
          <ScaleSummary question={question} answers={answers} />
        )}
        {question.type === "Short answer" && <ShortSummary entries={entries} />}
        {question.type === "File upload" && <FileSummary answers={answers} />}
        {question.type === "Match the following" && (
          <MatchSummary question={question} answers={answers} />
        )}
      </div>
    </div>
  );
}

function ChoiceSummary({ question, answers }: { question: Question; answers: ResponseAnswer[] }) {
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
              style={{ width: `${total === 0 ? 0 : (otherCount / total) * 100}%` }}
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

/* True/False — the design's single split bar rather than two stacked rows. */
function TfSummary({ answers }: { answers: ResponseAnswer[] }) {
  const total = answers.filter((a) => a.tfValue !== undefined).length;
  const trueCount = answers.filter((a) => a.tfValue === true).length;
  const falseCount = total - trueCount;
  const pct = total === 0 ? 0 : Math.round((trueCount / total) * 100);
  return (
    <div className="fb-tf-summary">
      <div className="fb-tf-bar">
        <div className="fb-tf-true" style={{ width: `${pct}%` }} />
        <div className="fb-tf-false" />
      </div>
      <div className="fb-tf-legend">
        <span>
          True — <span className="fb-mono">{trueCount} ({pct}%)</span>
        </span>
        <span className="fb-faint">
          False — <span className="fb-mono">{falseCount} ({total === 0 ? 0 : 100 - pct}%)</span>
        </span>
      </div>
    </div>
  );
}

function MatchSummary({ question, answers }: { question: Question; answers: ResponseAnswer[] }) {
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

function ScaleSummary({ question, answers }: { question: Question; answers: ResponseAnswer[] }) {
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
              <div className="fb-hist-pct">
                {n === 0 ? 0 : Math.round((c / n) * 100)}%
              </div>
              <div className="fb-hist-bar-wrap">
                <div className="fb-hist-bar" style={{ height: `${h}%` }} title={`${c} responses`} />
              </div>
              <div className="fb-hist-num">{p}</div>
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

/* Short answers — latest first with date + byline, per the design. */
function ShortSummary({ entries }: { entries: Entry[] }) {
  const texts = entries
    .filter((e) => !!e.a.text)
    .sort((x, y) => y.r.submittedAt.localeCompare(x.r.submittedAt));

  if (texts.length === 0) {
    return <div className="fb-faint">No text responses yet.</div>;
  }

  const head = texts.slice(0, 3);
  const rest = texts.slice(3);
  const line = (e: Entry, i: number) => (
    <div key={i} className="fb-short-row">
      <span className="fb-short-date">{fmtDay(e.r.submittedAt)}</span>
      <span className="fb-short-text">"{e.a.text}"</span>
      <span className="fb-short-who">{shortName(e.r)}</span>
    </div>
  );

  return (
    <div className="fb-short-summary">
      <div className="fb-short-summary-meta">Latest first</div>
      <div className="fb-short-rows">{head.map(line)}</div>
      {rest.length > 0 && (
        <details className="fb-other-list">
          <summary>View All {texts.length} Answers</summary>
          <div className="fb-short-rows">{rest.map(line)}</div>
        </details>
      )}
    </div>
  );
}

/* File uploads — a chip per file, name + size, like the design. */
function FileSummary({ answers }: { answers: ResponseAnswer[] }) {
  const files = answers.flatMap((a) => a.files ?? []);
  const totalMb = Math.round(files.reduce((acc, f) => acc + f.sizeMb, 0));
  const shown = files.slice(0, 6);
  return (
    <div className="fb-file-summary-v2">
      <div className="fb-short-summary-meta">
        <span className="fb-mono">{files.length}</span> uploads ·{" "}
        <span className="fb-mono">{totalMb} MB</span> total
      </div>
      <div className="fb-file-chips">
        {shown.map((f, i) => (
          <span key={i} className="fb-file-chip">
            {f.name} <span className="fb-file-chip-size">{f.sizeMb} MB</span>
          </span>
        ))}
        {files.length > shown.length && (
          <span className="fb-faint">+ {files.length - shown.length} more</span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ Responses tab ═══════════════════════════ */

export function FormResponsesSplit({ form, bank, responses }: Props) {
  const rows = useMemo(() => buildRows(form, bank), [form, bank]);
  const [query, setQuery] = useState("");
  const [selId, setSelId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...responses].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [responses],
  );
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      sorted.filter(
        (r) =>
          !q ||
          r.userName.toLowerCase().includes(q) ||
          r.userEmail.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q),
      ),
    [sorted, q],
  );

  const sel = filtered.find((r) => r.id === selId) ?? filtered[0] ?? null;

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
    <div className="fb-split">
      <div className="fb-split-left">
        <div className="fb-split-search">
          <div className="search-wrap fb-resp-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              placeholder="Search by Name or Email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="fb-split-counts">
            <span>
              <span className="fb-mono">{filtered.length.toLocaleString()}</span> Responses
            </span>
            <span>Newest First</span>
          </div>
        </div>
        <div className="fb-split-list">
          {filtered.length === 0 ? (
            <div className="fb-empty">No responses match.</div>
          ) : (
            filtered.map((r) => (
              <button
                key={r.id}
                className={`fb-resp-item ${sel?.id === r.id ? "is-active" : ""}`}
                onClick={() => setSelId(r.id)}
              >
                <div className="fb-resp-item-top">
                  <span className={`fb-resp-item-name ${r.anonymized ? "fb-anon" : ""}`}>
                    {r.anonymized ? `Deleted User · ${r.userId}` : r.userName}
                  </span>
                  <span className="fb-resp-item-date">{fmtDay(r.submittedAt)}</span>
                </div>
                <div className="fb-resp-item-trigger">{r.triggerName}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="fb-split-detail">
        {sel && (
          <>
            <div className="fb-detail-head">
              <div>
                <div className={`fb-detail-name ${sel.anonymized ? "fb-anon" : ""}`}>
                  {sel.anonymized ? `Deleted User · ${sel.userId}` : sel.userName}
                </div>
                <div className="fb-detail-meta">
                  {sel.anonymized ? "De-identified" : sel.userEmail} · Submitted{" "}
                  {fmtFull(sel.submittedAt)} · Trigger:{" "}
                  <span className={`fb-trigger-kind fb-trigger-kind--${sel.triggerKind}`}>
                    {sel.triggerKind === "task" ? "Task" : "Cert"}
                  </span>{" "}
                  {sel.triggerName}
                </div>
                {sel.anonymized && (
                  <div className="fb-detail-note">
                    <InfoTipIcon />
                    Account deleted — response retained against an anonymized
                    reference; PII stripped.
                  </div>
                )}
              </div>
              <button className="btn-secondary" onClick={() => exportResponseCsv(rows, sel)}>
                Export Response
              </button>
            </div>

            <div className="fb-detail-answers">
              {rows.map((row) => {
                const a = sel.answers.find((x) => x.questionId === row.question.id);
                // Every question the user answered stays visible — including
                // ones marked Inactive since. Unanswered inactive rows are noise.
                if (row.link.status === "inactive" && !a) return null;
                const kicker = [
                  row.label,
                  TYPE_LABEL[row.question.type],
                  row.link.mandatory && row.link.status === "active" ? "Mandatory" : null,
                  row.link.status === "inactive"
                    ? `Inactive${row.link.deactivatedAt ? ` since ${fmtDay(row.link.deactivatedAt)}` : ""}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={row.question.id} className="fb-detail-qa">
                    <div className="fb-detail-kicker">
                      {kicker}
                      {a && a.questionVersion !== row.question.version && (
                        <span
                          className="fb-answered-version"
                          title="The question was edited after this answer — the response references the version the user actually saw"
                        >
                          answered v{a.questionVersion} · now v{row.question.version}
                        </span>
                      )}
                    </div>
                    <div className="fb-detail-q">{row.question.text}</div>
                    <div className={`fb-detail-answer ${a ? "" : "is-empty"}`}>
                      {a ? answerText(row.question, a) || <em>— not answered —</em> : "Not answered"}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="fb-split-footnote">
              A response is a fixed record of the question versions the user was
              shown. Questions since marked Inactive still appear here.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
