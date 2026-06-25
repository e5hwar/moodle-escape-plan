import { useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeftIcon } from "./icons";
import {
  buildAttemptModel,
  cellColors,
  fmtPct,
  initialsOf,
  MONO,
  PALETTE as C,
  statusColor,
  type AttemptDetailModel,
  type FlatModel,
  type OptionVM,
  type QuestionVM,
  type SectionedModel,
  type SectionVM,
} from "../data/attemptDetail";
import { type Attempt } from "../data/attempts";

/* The "View Attempt" page. A self-contained dark report that mirrors the
   learner-facing attempt review: a header summary, the list of attempts, and a
   detailed per-question breakdown for the selected attempt. Two shapes are
   supported — sectioned (certification exams) and flat (single quizzes). */

export function AttemptViewerPage({
  attempt,
  onBack,
}: {
  attempt: Attempt;
  onBack: () => void;
}) {
  const model = useMemo<AttemptDetailModel>(
    () =>
      buildAttemptModel(
        {
          name: attempt.name,
          email: attempt.email,
          initials: initialsOf(attempt.name),
        },
        attempt.quizName,
      ),
    [attempt],
  );

  const [sel, setSel] = useState(model.defaultSel);
  const [showScoring, setShowScoring] = useState(false);
  const [showFeedback, setShowFeedback] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll a section/question anchor to just below the sticky top bar. We drive
  // the report container directly rather than scrollIntoView so the landing
  // clears the fixed bar by a consistent margin.
  function scrollTo(id: string) {
    const sc = scrollRef.current;
    const el = document.getElementById(id);
    if (!sc || !el) return;
    const top =
      el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (TOPBAR_H + 10);
    sc.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  return (
    <div ref={scrollRef} style={page.scroll}>
      <div style={page.topbar}>
        <button style={page.back} onClick={onBack}>
          <ChevronLeftIcon />
          Attempts
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <Toggle label="Scoring math" on={showScoring} onClick={() => setShowScoring((v) => !v)} />
          <Toggle label="Feedback" on={showFeedback} onClick={() => setShowFeedback((v) => !v)} />
        </div>
      </div>

      <div style={page.shell}>
        <div style={page.container}>
          <Header model={model} />
          {model.kind === "sectioned" ? (
            <SectionedSummary model={model} />
          ) : (
            <FlatSummary model={model} />
          )}
          <AttemptsTable model={model} sel={sel} onSelect={setSel} />
          {model.kind === "sectioned" ? (
            <SectionedDetail
              model={model}
              sel={sel}
              showScoring={showScoring}
              showFeedback={showFeedback}
              onScrollTo={scrollTo}
            />
          ) : (
            <FlatDetail
              model={model}
              sel={sel}
              showScoring={showScoring}
              showFeedback={showFeedback}
              onScrollTo={scrollTo}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────── header ───────────────────────────────── */

function Header({ model }: { model: AttemptDetailModel }) {
  const { user, quizName } = model;
  const complete =
    model.kind === "sectioned"
      ? model.secMeta.every((s) => model.highest[s.id] > 0)
      : model.complete;
  const detail =
    model.kind === "sectioned"
      ? `${model.secMeta.filter((s) => model.highest[s.id] > 0).length} / ${model.secMeta.length} sections passed`
      : model.complete
      ? `Highest grade ${fmtPct(model.highest)} ≥ ${model.pass}%`
      : `Best so far ${fmtPct(model.highest)} — needs ${model.pass}%`;

  return (
    <div style={page.headRow}>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div style={page.avatar}>{user.initials}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-.01em" }}>{user.name}</div>
          <div style={{ color: C.dim, fontSize: 12.5, marginTop: 1 }}>
            {user.email} · {quizName}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: complete ? C.pass : C.dim,
            }}
          />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {complete ? "Complete" : "Incomplete"}
          </span>
        </div>
        <div style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>{detail}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── summary strips ───────────────────────────── */

function SectionedSummary({ model }: { model: SectionedModel }) {
  return (
    <div style={page.chipsRow}>
      <span style={page.kicker}>Recorded highest</span>
      {model.secMeta.map((s) => (
        <span key={s.id} style={page.chip}>
          <span style={{ color: C.muted }}>{s.name}</span>
          <span style={{ fontFamily: MONO, color: "#c7ccd6" }}>{fmtPct(model.highest[s.id])}</span>
        </span>
      ))}
    </div>
  );
}

function FlatSummary({ model }: { model: FlatModel }) {
  return (
    <div style={page.flatStrip}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={page.kicker}>Highest grade</span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 22,
            fontWeight: 600,
            color: model.complete ? C.pass : C.fail,
          }}
        >
          {fmtPct(model.highest)}
        </span>
      </div>
      <span style={page.vrule} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontSize: 12, color: C.dim }}>Passing grade</span>
        <span style={{ fontFamily: MONO, fontSize: 14, color: "#aab1c2" }}>{model.pass}%</span>
      </div>
      <span style={page.vrule} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontSize: 12, color: C.dim }}>Scoring</span>
        <span style={{ fontSize: 13, color: "#aab1c2" }}>Highest grade across attempts</span>
      </div>
    </div>
  );
}

/* ───────────────────────────── attempts table ───────────────────────────── */

function AttemptsTable({
  model,
  sel,
  onSelect,
}: {
  model: AttemptDetailModel;
  sel: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <div style={{ ...page.kicker, marginBottom: 10 }}>Attempts · 3 of 5 used</div>
      <div style={page.tableWrap}>
        <div style={{ ...page.attGrid, ...page.attHead }}>
          <span>Attempt</span>
          <span>Date</span>
          <span>Duration</span>
          <span>Submission</span>
          <span style={{ textAlign: "right" }}>Score</span>
          <span style={{ textAlign: "right" }}>Status</span>
          <span />
        </div>
        {model.attMeta.map((a) => {
          const v = model.built[a.id];
          const selected = a.id === sel;
          const isSect = model.kind === "sectioned";
          const scoreColor = isSect ? "#aab1c2" : statusColor(v.status);
          return (
            <button
              key={a.id}
              className="av-row"
              onClick={() => onSelect(a.id)}
              style={{
                ...page.attGrid,
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12.5,
                padding: "12px 18px",
                border: "none",
                borderTop: "1px solid #1c2029",
                background: selected
                  ? isSect
                    ? "rgba(121,166,255,.05)"
                    : "rgba(125,147,194,.06)"
                  : "transparent",
                boxShadow: selected ? `inset 2px 0 0 ${C.accent}` : "none",
              }}
            >
              <span style={{ fontWeight: 600, color: "#dfe3ec" }}>{a.label}</span>
              <span style={{ color: C.muted }}>{a.date}, 26</span>
              <span style={{ color: C.muted }}>
                {a.duration}
                {!isSect && a.isAuto ? " · limit" : ""}
              </span>
              <span style={{ color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.via}
              </span>
              <span style={{ fontFamily: MONO, color: scoreColor, textAlign: "right" }}>
                {fmtPct(v.overall)}
              </span>
              <span style={{ fontWeight: 600, color: statusColor(v.status), textAlign: "right" }}>
                {v.status}
              </span>
              <span
                style={{
                  textAlign: "center",
                  color: selected ? C.accent : "#333a47",
                  transform: selected ? "rotate(90deg)" : "none",
                  transition: "transform .15s",
                  fontSize: 16,
                }}
              >
                ›
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ──────────────────────────── shared sub-parts ──────────────────────────── */

function Banner({ color, text }: { color: string; text: string }) {
  return (
    <div
      style={{
        fontSize: 12.5,
        lineHeight: 1.55,
        color: C.muted,
        padding: "2px 0 2px 13px",
        borderLeft: `2px solid ${color}`,
      }}
    >
      {text}
    </div>
  );
}

function QuestionIndexHeader({ totalQ }: { totalQ: number }) {
  const legend: [string, string][] = [
    ["Correct", "rgba(127,174,147,.45)"],
    ["Partial", "rgba(194,168,120,.45)"],
    ["Wrong", "rgba(201,139,139,.45)"],
    ["Blank", "rgba(255,255,255,.06)"],
  ];
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={page.kicker}>Question index</span>
        <span style={{ fontSize: 11, color: "#454b57", fontFamily: MONO }}>{totalQ} questions</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, fontSize: 10.5, color: C.dim }}>
        {legend.map(([label, bg]) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: bg }} />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}

function QCell({ q, onClick }: { q: QuestionVM; onClick: () => void }) {
  const [bg, fg] = cellColors(q.cat);
  return (
    <button
      className="av-cell"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 25,
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: MONO,
        fontSize: 11,
        fontWeight: 500,
        background: bg,
        border: "none",
        color: fg,
        padding: 0,
      }}
    >
      {q.n}
    </button>
  );
}

function OptionRow({ opt }: { opt: OptionVM }) {
  const mk: CSSProperties = {
    width: 15,
    height: 15,
    flex: "0 0 auto",
    borderRadius: opt.multi ? 4 : "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 9,
    fontWeight: 700,
  };
  const marker: CSSProperties = opt.selected
    ? { ...mk, background: "#2c333f", color: "#dfe3ec", border: "1px solid #3a4254" }
    : {
        ...mk,
        border: `1px solid ${opt.correct ? "rgba(127,174,147,.5)" : "#2a313d"}`,
        color: "transparent",
      };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "6px 0" }}>
      <div style={marker}>{opt.selected ? "✓" : ""}</div>
      <span style={{ flex: 1, fontSize: 13, color: "#c7ccd6", minWidth: 0 }}>{opt.text}</span>
      {opt.tag && (
        <span style={{ fontSize: 11, fontWeight: 500, color: opt.tagColor!, whiteSpace: "nowrap" }}>
          {opt.tag}
        </span>
      )}
      <span style={{ fontFamily: MONO, fontSize: 12, color: opt.gradeColor, minWidth: 40, textAlign: "right" }}>
        {opt.gradeText}
      </span>
    </div>
  );
}

function QuestionBlock({
  q,
  showScoring,
  showFeedback,
}: {
  q: QuestionVM;
  showScoring: boolean;
  showFeedback: boolean;
}) {
  return (
    <div id={q.anchorId} style={{ scrollMarginTop: 52 }}>
      <div style={{ padding: "13px 0 15px", borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 7 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, color: C.muted, minWidth: 0 }}>
            <span style={{ fontFamily: MONO, color: C.dim }}>{q.nLabel}</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.typeMeta}</span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: q.awardColor, whiteSpace: "nowrap" }}>
            {q.awardText}
          </span>
        </div>
        <div style={{ fontSize: 13.5, color: "#dfe3ec", lineHeight: 1.5, marginBottom: 11 }}>{q.text}</div>

        {q.kind === "choice" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {q.options.map((opt, i) => (
              <OptionRow key={i} opt={opt} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {q.matchRows.map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 0" }}>
                <span style={{ fontSize: 13, color: "#c7ccd6", fontWeight: 500 }}>{row.prompt}</span>
                <span style={{ color: "#4a5160" }}>→</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{row.userAnswer}</span>
                {row.showCorrect && (
                  <span style={{ fontSize: 12, color: C.dim }}>
                    correct: <span style={{ color: "#5ec99a" }}>{row.correctAnswer}</span>
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: row.color }}>
                  {row.markLabel}
                </span>
              </div>
            ))}
          </div>
        )}

        {showScoring && (
          <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 11.5, color: C.dim, lineHeight: 1.5 }}>
            {q.mathLine}
          </div>
        )}
        {showFeedback && (
          <div style={{ marginTop: 9, fontSize: 12.5, lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700, color: q.feedbackColor, fontSize: 12.5 }}>{q.feedbackLabel}</span>
            <span style={{ color: C.muted }}> {q.feedbackText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────── flat (single quiz) ─────────────────────────── */

function FlatDetail({
  model,
  sel,
  showScoring,
  showFeedback,
  onScrollTo,
}: {
  model: FlatModel;
  sel: string;
  showScoring: boolean;
  showFeedback: boolean;
  onScrollTo: (id: string) => void;
}) {
  const v = model.built[sel];
  let bColor: string;
  let bText: string;
  if (v.isAuto) {
    bColor = C.amber;
    bText = `Auto-submitted when the 45-minute time limit elapsed. Questions the user never reached were graded 0. Overall ${fmtPct(v.overall)} — below the ${model.pass}% passing grade.`;
  } else if (v.passed) {
    bColor = C.pass;
    bText = `Passed — overall ${fmtPct(v.overall)} meets the ${model.pass}% passing grade. This is the highest grade across attempts, so the Quiz is marked Complete.`;
  } else {
    bColor = C.fail;
    bText = `Below passing — overall ${fmtPct(v.overall)} is under the ${model.pass}% threshold. The user may reattempt (2 of 5 remaining).`;
  }

  return (
    <div style={page.detailCard}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "18px 22px 16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{v.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(v.status) }}>{v.status}</span>
          </div>
          <div style={{ color: C.dim, fontSize: 12.5, marginTop: 5 }}>
            {v.date}, 2026  ·  {v.duration}
            {v.isAuto ? " (limit reached)" : ""}  ·  {v.via}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...page.kicker }}>Overall score</div>
          <div style={{ fontFamily: MONO, fontSize: 27, fontWeight: 600, marginTop: 2, color: statusColor(v.status) }}>
            {fmtPct(v.overall)}
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
            {v.pts} / {v.w} pts · {v.answered}/{v.total} answered
          </div>
        </div>
      </div>
      <div style={{ padding: "0 22px 16px" }}>
        <Banner color={bColor} text={bText} />
      </div>

      <div style={page.splitGrid}>
        <aside style={page.aside}>
          <QuestionIndexHeader totalQ={model.totalQ} />
          <div style={page.cellGrid}>
            {v.questions.map((q) => (
              <QCell key={q.anchorId} q={q} onClick={() => onScrollTo(q.anchorId)} />
            ))}
          </div>
        </aside>
        <div style={{ padding: "6px 22px 24px", minWidth: 0 }}>
          {v.questions.map((q) => (
            <QuestionBlock key={q.anchorId} q={q} showScoring={showScoring} showFeedback={showFeedback} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── sectioned (cert exam) ──────────────────────── */

function sectionStatus(s: SectionVM, qualifying: boolean): { color: string; text: string } {
  const color = s.passed ? (qualifying ? C.pass : C.nullified) : C.fail;
  const text = !s.passed ? "Failed" : qualifying ? "Passed" : "Nullified";
  return { color, text };
}

function SectionedDetail({
  model,
  sel,
  showScoring,
  showFeedback,
  onScrollTo,
}: {
  model: SectionedModel;
  sel: string;
  showScoring: boolean;
  showFeedback: boolean;
  onScrollTo: (id: string) => void;
}) {
  const v = model.built[sel];

  let bColor = C.pass;
  let bText =
    "All sections passed — Core, Type 1, Type 2 and Type 3 completions are recorded from this attempt.";
  if (v.status === "Nullified") {
    bColor = C.nullified;
    bText =
      "Core (Required to Pass) was failed in this attempt, so every section pass earned here is nullified — no section completion is recorded.";
  } else if (v.status === "Auto-submitted") {
    bColor = C.amber;
    bText =
      "Auto-submitted at the 120-min limit; the end of Core and all of Type 2 / Type 3 were never reached and scored 0. Core still passed, so this attempt qualifies and records Core completion.";
  }

  return (
    <div style={page.detailCard}>
      <div style={{ padding: "18px 22px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{v.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: statusColor(v.status) }}>{v.status}</span>
          {v.qualifying ? (
            <span style={{ fontSize: 11.5, color: C.dim }}>· qualifying attempt</span>
          ) : (
            <span style={{ fontSize: 11.5, color: C.nullified }}>· non-qualifying</span>
          )}
        </div>
        <div style={{ color: C.dim, fontSize: 12.5, marginTop: 5 }}>
          {v.date}, 2026  ·  {v.duration}  ·  {v.via}
        </div>
        <div style={{ marginTop: 12 }}>
          <Banner color={bColor} text={bText} />
        </div>
      </div>

      {/* Per-section score cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#1c2029", borderTop: "1px solid #1c2029" }}>
        {v.sections.map((s) => {
          const st = sectionStatus(s, v.qualifying);
          const recCol = !s.passed ? C.fail : v.qualifying ? C.pass : C.nullified;
          const recText = !s.passed ? "Failed" : v.qualifying ? "Recorded" : "Nullified";
          return (
            <button
              key={s.id}
              className="av-secjump"
              onClick={() => onScrollTo(s.anchorId)}
              style={{ textAlign: "left", cursor: "pointer", border: "none", fontFamily: "inherit", background: "#0f1115", padding: "13px 15px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#dfe3ec" }}>{s.name}</span>
                {s.required && (
                  <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".04em", color: C.accent, fontWeight: 700 }}>
                    req
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 9 }}>
                <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: "#dfe3ec" }}>{fmtPct(s.pct)}</span>
                <span style={{ color: "#454b57", fontSize: 11 }}>/ pass {s.pass}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "#1c2029", position: "relative", marginBottom: 9 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(s.pct, 100)}%`,
                    background: st.color,
                    borderRadius: 2,
                    opacity: 0.6,
                  }}
                />
                <div style={{ position: "absolute", left: `${s.pass}%`, top: -2, bottom: -2, width: 1, background: "rgba(255,255,255,.2)" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: recCol }}>{recText}</span>
            </button>
          );
        })}
      </div>

      {/* Index sidebar + grouped questions */}
      <div style={page.splitGrid}>
        <aside style={page.aside}>
          <QuestionIndexHeader totalQ={model.totalQ} />
          {v.sections.map((s) => {
            const st = sectionStatus(s, v.qualifying);
            return (
              <div key={s.id} style={{ marginBottom: 18 }}>
                <button
                  className="av-secjump"
                  onClick={() => onScrollTo(s.anchorId)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "0 0 9px" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#cfd4dd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {s.name}
                    </span>
                    {s.required && (
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, flex: "0 0 auto" }} />
                    )}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: st.color, flex: "0 0 auto" }}>{st.text}</span>
                </button>
                <div style={page.cellGrid}>
                  {s.questions.map((q) => (
                    <QCell key={q.anchorId} q={q} onClick={() => onScrollTo(q.anchorId)} />
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        <div style={{ padding: "6px 22px 24px", minWidth: 0 }}>
          {v.sections.map((s) => {
            const st = sectionStatus(s, v.qualifying);
            return (
              <div key={s.id} id={s.anchorId} style={{ scrollMarginTop: 8 }}>
                <div style={page.groupHeader}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#dfe3ec" }}>{s.name}</span>
                  {s.required && (
                    <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".04em", color: C.accent, fontWeight: 700 }}>
                      required to pass
                    </span>
                  )}
                  <span style={{ flex: 1, height: 1, background: "#1c2029", minWidth: 20 }} />
                  <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>
                    {fmtPct(s.pct)} · {s.answered}/{s.total} answered
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>{st.text}</span>
                </div>
                {s.questions.map((q) => (
                  <QuestionBlock key={q.anchorId} q={q} showScoring={showScoring} showFeedback={showFeedback} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────── toggle ───────────────────────────────── */

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 11px",
        borderRadius: 8,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 500,
        color: on ? "#dfe3ec" : C.muted,
        background: on ? "rgba(125,147,194,.12)" : "transparent",
        border: `1px solid ${on ? "rgba(125,147,194,.4)" : "#1c2029"}`,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: on ? C.accent : "#333a47",
        }}
      />
      {label}
    </button>
  );
}

/* ───────────────────────────────── styles ───────────────────────────────── */

/** Height of the sticky top bar; sticky panels and scroll offsets hang off it. */
const TOPBAR_H = 54;

const page: Record<string, CSSProperties> = {
  scroll: {
    flex: 1,
    height: "100vh",
    overflowY: "auto",
    background: "#0c0e12",
    color: "#dfe3ec",
    fontFamily: "'Public Sans', system-ui, sans-serif",
    fontSize: 14,
    lineHeight: 1.5,
    WebkitFontSmoothing: "antialiased",
  },
  topbar: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 26px",
    background: "rgba(12,14,18,.86)",
    backdropFilter: "blur(8px)",
    borderBottom: "1px solid #1c2029",
  },
  back: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 10px 6px 6px",
    borderRadius: 8,
    border: "1px solid #1c2029",
    background: "transparent",
    color: "#aab1c2",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
  shell: { minHeight: "100%" },
  container: { maxWidth: 1080, margin: "0 auto", padding: "30px 26px 120px" },
  headRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
    marginBottom: 7,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: 14,
    color: "#aab1c2",
    background: "#1b1f29",
    border: "1px solid #262b37",
  },
  kicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".07em",
    color: "#454b57",
    fontWeight: 600,
  },
  chipsRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    margin: "14px 0 26px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "4px 10px",
    borderRadius: 8,
    background: "#13161d",
    border: "1px solid #1c2029",
    fontSize: 12,
  },
  flatStrip: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    margin: "16px 0 26px",
    padding: "13px 16px",
    background: "#0f1115",
    border: "1px solid #1c2029",
    borderRadius: 12,
  },
  vrule: { width: 1, height: 24, background: "#1c2029" },
  tableWrap: { border: "1px solid #1c2029", borderRadius: 13, overflow: "hidden", background: "#0f1115" },
  attGrid: {
    display: "grid",
    gridTemplateColumns: "84px 88px 116px 1fr 70px 96px 18px",
    alignItems: "center",
    gap: 12,
  },
  attHead: {
    padding: "10px 18px",
    fontSize: 10.5,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    color: "#454b57",
    fontWeight: 600,
    borderBottom: "1px solid #1c2029",
  },
  detailCard: {
    marginTop: 26,
    border: "1px solid #1c2029",
    borderRadius: 15,
    background: "#0f1115",
    overflow: "hidden",
  },
  splitGrid: { display: "grid", gridTemplateColumns: "224px 1fr", borderTop: "1px solid #1c2029" },
  aside: {
    position: "sticky",
    top: TOPBAR_H,
    alignSelf: "start",
    maxHeight: `calc(100vh - ${TOPBAR_H}px)`,
    overflowY: "auto",
    borderRight: "1px solid #1c2029",
    padding: "16px 14px 24px",
  },
  cellGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(26px,1fr))",
    gap: 5,
  },
  groupHeader: {
    position: "sticky",
    top: TOPBAR_H,
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    padding: "16px 0 8px",
    background: "#0f1115",
  },
};
