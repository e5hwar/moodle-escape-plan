import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  categories as seedCategories,
  flattenCategories,
  supportsGrading,
  type Question,
  type QuestionType,
} from "../data/questionBank";
import { QuestionHistoryModal } from "./QuestionHistoryModal";
import {
  ChevronLeftIcon,
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  BulletListIcon,
  NumberListIcon,
  IndentRightIcon,
  IndentLeftIcon,
  LinkSmallIcon,
  ImageIcon,
  VideoIcon,
  AudioIcon,
  SmallXIcon,
  DragHandleIcon,
} from "./icons";

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.4v.01M11 12h1v4h1" />
  </svg>
);

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
);

/* ─────────────────  Types  ───────────────── */

type QType = "mcq" | "true-false" | "match" | "short" | "file" | "scale";
type McqMode = "single" | "multiple";
type MatchGrading = "all-or-nothing" | "partial";

type Choice = { id: string; text: string; textEs: string; grade: number };
type Pair = { id: string; left: string; right: string; leftEs: string; rightEs: string };

type QuestionDraft = {
  type: QType;
  mcqMode: McqMode;
  catKey: string; // flattened key: "cat" or "cat/sub" ("" = Uncategorized)
  status: "Draft" | "Active" | "Archived";
  text: string;
  textEs: string;
  // MCQ
  choices: Choice[];
  otherOption: boolean;
  // True/False
  tfAnswer: boolean;
  // Match the Following
  pairs: Pair[];
  matchGrading: MatchGrading;
  // Linear scale
  scaleMin: number;
  scaleMax: number;
  scaleMinLabel: string;
  scaleMinLabelEs: string;
  scaleMaxLabel: string;
  scaleMaxLabelEs: string;
  // File upload — "default" keeps the system-wide limit
  maxFiles: string;
  maxSizeMb: string;
  // Grading & settings
  grading: boolean;
  randomise: boolean;
  fbCorrect: string;
  fbCorrectEs: string;
  fbPartial: string;
  fbPartialEs: string;
  fbIncorrect: string;
  fbIncorrectEs: string;
};

const MAX_OPTIONS = 10;

const TYPE_LABELS: Record<QType, string> = {
  mcq: "Multiple choice",
  "true-false": "True or False",
  match: "Match the following",
  short: "Short answer",
  file: "File upload",
  scale: "Linear scale",
};

const TYPE_ORDER: QType[] = ["mcq", "true-false", "match", "short", "file", "scale"];

function typeSupportsGrading(t: QType): boolean {
  return t === "mcq" || t === "true-false" || t === "match";
}

/* Moodle's fixed grade dropdown — a percentage share of the question's mark. */
const GRADE_STEPS = [
  100, 90, 83.33333, 80, 75, 70, 66.66667, 60, 50, 40, 33.33333, 30, 25, 20,
  16.66667, 14.28571, 12.5, 11.11111, 10, 5,
];

function fmtPct(v: number): string {
  if (v === 0) return "None";
  const rounded = Math.round(Math.abs(v) * 1000) / 1000;
  return `${v > 0 ? "+" : "−"}${rounded}%`;
}

const GRADE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "None" },
  ...GRADE_STEPS.map((v) => ({ value: v, label: fmtPct(v) })),
  ...GRADE_STEPS.map((v) => ({ value: -v, label: fmtPct(-v) })),
];

/* Equal share for k correct options in a multiple-answers question. */
function equalShare(k: number): number {
  if (k <= 1) return 100;
  const exact = GRADE_STEPS.find((s) => Math.abs(s * k - 100) < 0.01);
  return exact ?? Math.round((100 / k) * 100000) / 100000;
}

/* ─────────────────  Initial state  ───────────────── */

let seq = 0;
const uid = (p: string) => `${p}-${seq++}`;

function blankChoice(grade = 0): Choice {
  return { id: uid("c"), text: "", textEs: "", grade };
}
function blankPair(): Pair {
  return { id: uid("p"), left: "", right: "", leftEs: "", rightEs: "" };
}

function editorType(t: QuestionType): QType {
  switch (t) {
    case "True/False":
      return "true-false";
    case "Match the following":
      return "match";
    case "Short answer":
      return "short";
    case "File upload":
      return "file";
    case "Linear scale":
      return "scale";
    default:
      return "mcq";
  }
}

function catKeyFromPath(path?: string[]): string {
  if (!path || path.length === 0) return "";
  const cat = seedCategories.find((c) => c.label === path[0]);
  if (!cat) return "";
  if (path[1]) {
    const sub = cat.subcategories?.find((s) => s.label === path[1]);
    return sub ? `${cat.key}/${sub.key}` : cat.key;
  }
  return cat.key;
}

function buildInitial(initialCategoryPath?: string[], editing?: Question): QuestionDraft {
  const base: QuestionDraft = {
    type: "mcq",
    mcqMode: "single",
    catKey: catKeyFromPath(initialCategoryPath),
    status: "Draft",
    text: "",
    textEs: "",
    choices: [blankChoice(100), blankChoice(-25), blankChoice(-25)],
    otherOption: false,
    tfAnswer: true,
    pairs: [blankPair(), blankPair(), blankPair()],
    matchGrading: "all-or-nothing",
    scaleMin: 1,
    scaleMax: 10,
    scaleMinLabel: "",
    scaleMinLabelEs: "",
    scaleMaxLabel: "",
    scaleMaxLabelEs: "",
    maxFiles: "default",
    maxSizeMb: "default",
    grading: true,
    randomise: true,
    fbCorrect: "",
    fbCorrectEs: "",
    fbPartial: "",
    fbPartialEs: "",
    fbIncorrect: "",
    fbIncorrectEs: "",
  };
  if (!editing) return base;

  const t = editorType(editing.type);
  const es = editing.hasSpanish;
  return {
    ...base,
    type: t,
    mcqMode: editing.type === "Multiple select" ? "multiple" : "single",
    catKey: catKeyFromPath(editing.categoryPath),
    status: editing.status,
    text: editing.text,
    textEs: es ? `[ES] ${editing.text}` : "",
    choices: editing.options?.length
      ? editing.options.map((o) => ({
          id: uid("c"),
          text: o.text,
          textEs: es ? `[ES] ${o.text}` : "",
          grade: o.grade,
        }))
      : base.choices,
    otherOption: !!editing.otherOption,
    tfAnswer: editing.tfAnswer ?? true,
    pairs: editing.pairs?.length
      ? editing.pairs.map((p) => ({
          id: uid("p"),
          left: p.left,
          right: p.right,
          leftEs: es && p.left ? `[ES] ${p.left}` : "",
          rightEs: es ? `[ES] ${p.right}` : "",
        }))
      : base.pairs,
    matchGrading: editing.matchGrading ?? "all-or-nothing",
    scaleMin: editing.scale?.min ?? 1,
    scaleMax: editing.scale?.max ?? 10,
    scaleMinLabel: editing.scale?.minLabel ?? "",
    scaleMinLabelEs: es && editing.scale?.minLabel ? `[ES] ${editing.scale.minLabel}` : "",
    scaleMaxLabel: editing.scale?.maxLabel ?? "",
    scaleMaxLabelEs: es && editing.scale?.maxLabel ? `[ES] ${editing.scale.maxLabel}` : "",
    maxFiles: editing.fileRules ? String(editing.fileRules.maxFiles) : "default",
    maxSizeMb: editing.fileRules ? String(editing.fileRules.maxSizeMb) : "default",
    grading: editing.gradingEnabled && supportsGrading(editing.type),
    randomise: editing.randomise,
    fbCorrect: editing.feedback?.correct ?? "",
    fbCorrectEs: es && editing.feedback?.correct ? `[ES] ${editing.feedback.correct}` : "",
    fbPartial: editing.feedback?.partial ?? "",
    fbPartialEs: es && editing.feedback?.partial ? `[ES] ${editing.feedback.partial}` : "",
    fbIncorrect: editing.feedback?.incorrect ?? "",
    fbIncorrectEs: es && editing.feedback?.incorrect ? `[ES] ${editing.feedback.incorrect}` : "",
  };
}

/* ─────────────────  Translation entries  ───────────────── */

type TransEntry = { id: string; label: string; en: string; es: string };

function translationEntries(d: QuestionDraft): TransEntry[] {
  const out: TransEntry[] = [];
  out.push({ id: "text", label: "Question text", en: d.text, es: d.textEs });
  if (d.type === "mcq") {
    d.choices.forEach((c, i) =>
      out.push({
        id: `choice/${c.id}`,
        label: `Option ${String.fromCharCode(65 + i)}`,
        en: c.text,
        es: c.textEs,
      }),
    );
  }
  if (d.type === "match") {
    d.pairs.forEach((p, i) => {
      out.push({ id: `pair-left/${p.id}`, label: `Prompt ${i + 1}`, en: p.left, es: p.leftEs });
      out.push({ id: `pair-right/${p.id}`, label: `Answer ${i + 1}`, en: p.right, es: p.rightEs });
    });
  }
  if (d.type === "scale") {
    out.push({ id: "scale-min", label: `Label for ${d.scaleMin}`, en: d.scaleMinLabel, es: d.scaleMinLabelEs });
    out.push({ id: "scale-max", label: `Label for ${d.scaleMax}`, en: d.scaleMaxLabel, es: d.scaleMaxLabelEs });
  }
  if (d.grading && typeSupportsGrading(d.type)) {
    out.push({ id: "fb-correct", label: "Feedback — correct", en: d.fbCorrect, es: d.fbCorrectEs });
    out.push({ id: "fb-partial", label: "Feedback — partially correct", en: d.fbPartial, es: d.fbPartialEs });
    out.push({ id: "fb-incorrect", label: "Feedback — incorrect", en: d.fbIncorrect, es: d.fbIncorrectEs });
  }
  return out.filter((e) => e.en.trim() !== "" || e.es.trim() !== "");
}

/* ─────────────────  Editor  ───────────────── */

type Props = {
  onClose: () => void;
  // Called with the built question when "Create question" is clicked
  // (creation only — edits still just close, as before).
  onCreate?: (q: Question) => void;
  initialCategoryPath?: string[];
  editingQuestion?: Question;
};

let createdSeq = 0;

function questionFromDraft(d: QuestionDraft, hasSpanish: boolean): Question {
  const type: QuestionType =
    d.type === "mcq"
      ? d.mcqMode === "multiple"
        ? "Multiple select"
        : "Multiple choice"
      : d.type === "true-false"
        ? "True/False"
        : d.type === "match"
          ? "Match the following"
          : d.type === "short"
            ? "Short answer"
            : d.type === "file"
              ? "File upload"
              : "Linear scale";
  const catOption = flattenCategories(seedCategories).find((o) => o.key === d.catKey);
  const grading = d.grading && typeSupportsGrading(d.type);
  const q: Question = {
    id: `Q-${10480 + createdSeq++}`,
    type,
    text: d.text.trim() || "Untitled question",
    status: d.status,
    categoryPath: catOption ? catOption.label.split(" > ") : [],
    quizzes: [],
    forms: [],
    version: 1,
    gradingEnabled: grading,
    randomise: d.randomise && (d.type === "mcq" || d.type === "match"),
    hasSpanish,
  };
  if (d.type === "mcq") {
    q.options = d.choices
      .filter((c) => c.text.trim() !== "")
      .map((c) => ({ text: c.text, grade: grading ? c.grade : 0 }));
    if (!grading && d.otherOption) q.otherOption = true;
  }
  if (d.type === "true-false") q.tfAnswer = d.tfAnswer;
  if (d.type === "match") {
    q.pairs = d.pairs
      .filter((p) => p.left.trim() !== "" || p.right.trim() !== "")
      .map((p) => ({ left: p.left, right: p.right }));
    q.matchGrading = d.matchGrading;
  }
  if (d.type === "scale") {
    q.scale = {
      min: d.scaleMin,
      max: d.scaleMax,
      minLabel: d.scaleMinLabel || undefined,
      maxLabel: d.scaleMaxLabel || undefined,
    };
  }
  if (d.type === "file" && (d.maxFiles !== "default" || d.maxSizeMb !== "default")) {
    // "default" keeps the system-wide limit (5 files / 50 MB)
    q.fileRules = {
      maxFiles: d.maxFiles === "default" ? 5 : Number(d.maxFiles) || 5,
      maxSizeMb: d.maxSizeMb === "default" ? 50 : Number(d.maxSizeMb) || 50,
    };
  }
  if (grading && (d.fbCorrect || d.fbPartial || d.fbIncorrect)) {
    q.feedback = {
      correct: d.fbCorrect || undefined,
      partial: d.fbPartial || undefined,
      incorrect: d.fbIncorrect || undefined,
    };
  }
  return q;
}

export function NewQuestionWizard({ onClose, onCreate, initialCategoryPath, editingQuestion }: Props) {
  const isEditing = !!editingQuestion;
  const [data, setData] = useState<QuestionDraft>(() =>
    buildInitial(initialCategoryPath, editingQuestion),
  );
  const [showHistory, setShowHistory] = useState(false);
  const update = (patch: Partial<QuestionDraft>) => setData((d) => ({ ...d, ...patch }));

  const catOptions = useMemo(() => flattenCategories(seedCategories), []);
  const catLabel =
    catOptions.find((o) => o.key === data.catKey)?.label.replace(" > ", " / ") ??
    "Uncategorized";
  const crumbs = catLabel === "Uncategorized" ? [] : catLabel.split(" / ");

  const gradable = typeSupportsGrading(data.type);
  const grading = data.grading && gradable;
  const usedInQuizzes = editingQuestion?.quizzes.length ?? 0;

  // Translation completeness across every user-facing text field.
  const transEntries = useMemo(() => translationEntries(data), [data]);
  const filled = transEntries.filter((e) => e.en.trim() !== "");
  const esDone = filled.filter((e) => e.es.trim() !== "").length;
  const esState: "missing" | "partial" | "complete" =
    filled.length === 0 || esDone === 0
      ? "missing"
      : esDone < filled.length
        ? "partial"
        : "complete";

  const version = editingQuestion?.version ?? 0;

  return (
    <div className="qed">
      <header className="qed-topbar">
        <div className="qed-topbar-left">
          <button className="qed-back" aria-label="Back to Question Bank" onClick={onClose}>
            <ChevronLeftIcon />
          </button>
          <nav className="qed-crumbs" aria-label="Breadcrumb">
            <button className="qed-crumb-link" onClick={onClose}>Question Bank</button>
            {crumbs.map((c) => (
              <span key={c} className="qed-crumb">
                <span className="qed-crumb-sep">›</span>
                {c}
              </span>
            ))}
          </nav>
          <h1 className="qed-title">{isEditing ? "Edit question" : "New question"}</h1>
          <span className="qed-vchip">
            {isEditing ? `v${version} · v${version + 1} on save` : "new · v1 on save"}
          </span>
          <button className="qed-history-link" onClick={() => setShowHistory(true)}>
            View history
          </button>
        </div>
        <div className="qed-topbar-actions">
          <button className="btn-save-draft" onClick={onClose}>Cancel</button>
          <button
            className="btn-publish"
            onClick={() => {
              if (!isEditing && onCreate) {
                onCreate(questionFromDraft(data, esState === "complete" && filled.length > 0));
              }
              onClose();
            }}
          >
            {isEditing ? "Save changes" : "Create question"}
          </button>
        </div>
      </header>

      <div className="qed-scroll">
        <div className="qed-inner">
          <div className="qed-banner">
            <span className="qed-banner-icon"><InfoIcon /></span>
            <div className="qed-banner-text">
              {isEditing ? (
                <>
                  Saving creates <strong>v{version + 1}</strong> in {catLabel}. Quizzes and
                  feedback forms using this question move to the new version; past attempts
                  keep v{version}.
                </>
              ) : (
                <>
                  This question will be created as <strong>v1</strong> in {catLabel}.
                </>
              )}
            </div>
          </div>

          <div className="qed-cols">
            <div className="qed-main">
              <QuestionTextCard data={data} update={update} />
              {data.type === "mcq" && (
                <McqCard data={data} update={update} grading={grading} />
              )}
              {data.type === "true-false" && (
                <TrueFalseCard data={data} update={update} grading={grading} />
              )}
              {data.type === "match" && (
                <MatchCard data={data} update={update} grading={grading} />
              )}
              {data.type === "short" && <ShortAnswerCard />}
              {data.type === "file" && <FileUploadCard data={data} update={update} />}
              {data.type === "scale" && <ScaleCard data={data} update={update} />}
              {grading && <FeedbackCard data={data} update={update} />}
            </div>

            <aside className="qed-side">
              <SettingsCard
                data={data}
                update={update}
                isEditing={isEditing}
                catOptions={catOptions}
              />
              <GradingCard
                data={data}
                update={update}
                gradable={gradable}
                usedInQuizzes={usedInQuizzes}
              />
              <div className="qed-card">
                <div className="qed-card-title">Translations</div>
                <div className="qed-trans-row">
                  <span className="qed-lang-tag">EN</span>
                  <span className="qed-trans-name">English</span>
                  <span className={`qed-trans-status ${data.text.trim() ? "is-complete" : ""}`}>
                    {data.text.trim() ? "✓ Complete" : "In progress"}
                  </span>
                </div>
                <div className="qed-trans-row">
                  <span className="qed-lang-tag">ES</span>
                  <span className="qed-trans-name">Español</span>
                  {esState === "complete" ? (
                    <span className="qed-trans-status is-complete">✓ Complete</span>
                  ) : (
                    <span className="qed-trans-status is-missing">
                      ⚠ {esState === "partial" ? `${esDone}/${filled.length} translated` : "Missing"}
                    </span>
                  )}
                </div>
                <div className="qed-trans-note">
                  Fill the <strong>ES</strong> row on each field to translate this question.
                </div>
              </div>
              <div className="qed-save-note">
                {isEditing ? `last saved · v${version}` : "not saved yet"}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {showHistory &&
        (isEditing ? (
          <QuestionHistoryModal
            question={editingQuestion!}
            onClose={() => setShowHistory(false)}
          />
        ) : (
          <EmptyHistoryModal onClose={() => setShowHistory(false)} />
        ))}
    </div>
  );
}

/* ─────────────────  Main-column cards  ───────────────── */

function QuestionTextCard({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="qed-card">
      <div className="qed-card-title">Question text</div>
      {/* Rich text is authored per language — English on top, Spanish below. */}
      <div className="rte-field">
        <RteToolbar />
        <div className="rte-lang-row">
          <AutoTextarea
            className="rte-area"
            value={data.text}
            placeholder="Write the question…"
            onChange={(v) => update({ text: v })}
          />
          <span className="lang-tag floating">EN</span>
        </div>
        <div className="rte-field-divider" />
        <div className="rte-lang-row">
          <AutoTextarea
            className="rte-area"
            value={data.textEs}
            placeholder="Escribe la pregunta…"
            onChange={(v) => update({ textEs: v })}
          />
          <span className="lang-tag floating">ES</span>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" hidden multiple onChange={() => {/* noop in mock */}} />
      <button className="qed-attach-link" onClick={() => fileRef.current?.click()}>
        + Attach media
      </button>
    </section>
  );
}

function McqCard({
  data,
  update,
  grading,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  grading: boolean;
}) {
  const choices = data.choices;
  const single = data.mcqMode === "single";

  const setChoice = (id: string, patch: Partial<Choice>) =>
    update({ choices: choices.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const addChoice = () => {
    if (choices.length >= MAX_OPTIONS) return;
    update({ choices: [...choices, blankChoice(grading ? -25 : 0)] });
  };

  const removeChoice = (id: string) => {
    if (choices.length <= 2) return;
    update({ choices: choices.filter((c) => c.id !== id) });
  };

  // Marking correct drives the grades: single answer → +100% and the rest go
  // negative; multiple answers → the checked options share 100% equally.
  const markCorrect = (id: string) => {
    if (!grading) return;
    if (single) {
      update({
        choices: choices.map((c) =>
          c.id === id ? { ...c, grade: 100 } : c.grade > 0 ? { ...c, grade: -25 } : c,
        ),
      });
    } else {
      const nowCorrect = new Set(choices.filter((c) => c.grade > 0).map((c) => c.id));
      if (nowCorrect.has(id)) nowCorrect.delete(id);
      else nowCorrect.add(id);
      const share = equalShare(nowCorrect.size);
      update({
        choices: choices.map((c) =>
          nowCorrect.has(c.id)
            ? { ...c, grade: share }
            : { ...c, grade: c.grade > 0 ? -25 : c.grade },
        ),
      });
    }
  };

  const positiveTotal = single
    ? Math.max(0, ...choices.map((c) => c.grade))
    : choices.filter((c) => c.grade > 0).reduce((n, c) => n + c.grade, 0);
  const bestOk = Math.abs(positiveTotal - 100) < 0.01;

  return (
    <section className="qed-card">
      <div className="qed-card-head">
        <div className="qed-card-title-row">
          <span className="qed-card-title">Answer options</span>
          <span className="qed-card-sub">
            {grading
              ? single
                ? "single answer · grade per option, −100% to 100%"
                : "multiple answers · correct options share the mark"
              : "ungraded · responses are collected, not scored"}
          </span>
        </div>
        {grading && (
          <span className={`qed-best-tag ${bestOk ? "is-ok" : "is-warn"}`}>
            {bestOk ? "✓ best score = 100%" : `best score = ${Math.round(positiveTotal * 100) / 100}%`}
          </span>
        )}
      </div>

      <div className="qed-opts">
        {choices.map((c) => (
          <div className="qed-opt-row" key={c.id}>
            <span className="qe-option-handle" aria-hidden>
              <DragHandleIcon />
            </span>
            {grading && (
              <button
                className={`qed-correct ${single ? "is-radio" : "is-check"} ${c.grade > 0 ? "is-on" : ""}`}
                aria-label={c.grade > 0 ? "Correct answer" : "Mark as correct"}
                onClick={() => markCorrect(c.id)}
              >
                {!single && c.grade > 0 && <CheckMark />}
              </button>
            )}
            <BiField
              en={c.text}
              es={c.textEs}
              onEn={(v) => setChoice(c.id, { text: v })}
              onEs={(v) => setChoice(c.id, { textEs: v })}
              placeholder="Option text…"
              esPlaceholder="Texto de la opción…"
            />
            {grading && (
              <GradeSelect value={c.grade} onChange={(v) => setChoice(c.id, { grade: v })} />
            )}
            <button
              className="qe-icon-btn"
              aria-label="Remove option"
              disabled={choices.length <= 2}
              onClick={() => removeChoice(c.id)}
            >
              <SmallXIcon />
            </button>
          </div>
        ))}

        {!grading && data.otherOption && (
          <div className="qed-opt-row qed-opt-row--other">
            <span className="qe-option-handle" aria-hidden>
              <DragHandleIcon />
            </span>
            <span className="qed-other-text">Other — learner types a free-text answer</span>
            <button
              className="qe-icon-btn"
              aria-label="Remove Other option"
              onClick={() => update({ otherOption: false })}
            >
              <SmallXIcon />
            </button>
          </div>
        )}
      </div>

      <div className="qed-opts-foot">
        <button className="qe-add-btn" onClick={addChoice} disabled={choices.length >= MAX_OPTIONS}>
          + Add option
        </button>
        <button
          className="qe-add-btn"
          disabled={grading || data.otherOption}
          onClick={() => update({ otherOption: true })}
        >
          + Add “Other” option
        </button>
        {grading && (
          <span className="qed-lock-note">
            <LockIcon /> “Other” is unavailable while grading is on
          </span>
        )}
      </div>

      {grading && !bestOk && (
        <p className="form-help error">
          {single
            ? "One option should be graded +100% so a right answer earns full marks."
            : `Correct options add up to ${fmtPct(positiveTotal)}. For full marks they should total 100%.`}
        </p>
      )}
    </section>
  );
}

function TrueFalseCard({
  data,
  update,
  grading,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  grading: boolean;
}) {
  return (
    <section className="qed-card">
      <div className="qed-card-head">
        <div className="qed-card-title-row">
          <span className="qed-card-title">Answer options</span>
          <span className="qed-card-sub">
            {grading
              ? "the correct value is graded +100%, the other 0%"
              : "ungraded · responses are collected, not scored"}
          </span>
        </div>
        {grading && <span className="qed-best-tag is-ok">✓ best score = 100%</span>}
      </div>
      <div className="qe-tf-group">
        {[true, false].map((val) => {
          const selected = grading && data.tfAnswer === val;
          return (
            <button
              key={String(val)}
              className={`qe-tf-card ${selected ? "selected" : ""} ${!grading ? "is-static" : ""}`}
              onClick={() => grading && update({ tfAnswer: val })}
            >
              {grading && <span className="radio-dot" />}
              <span className="qe-tf-label">{val ? "True" : "False"}</span>
              {selected && <span className="qe-grade-tag">+100%</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MatchCard({
  data,
  update,
  grading,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  grading: boolean;
}) {
  const pairs = data.pairs;
  const setPair = (id: string, patch: Partial<Pair>) =>
    update({ pairs: pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const addPair = () => {
    if (pairs.length >= MAX_OPTIONS) return;
    update({ pairs: [...pairs, blankPair()] });
  };
  const removePair = (id: string) => {
    if (pairs.length <= 2) return;
    update({ pairs: pairs.filter((p) => p.id !== id) });
  };

  return (
    <section className="qed-card">
      <div className="qed-card-head">
        <div className="qed-card-title-row">
          <span className="qed-card-title">Pairs</span>
          <span className="qed-card-sub">
            blank prompt = extra wrong answer (distractor)
          </span>
        </div>
      </div>

      <div className="qe-pair-head">
        <span>Prompt</span>
        <span>Matches with</span>
      </div>
      <div className="qed-opts">
        {pairs.map((p, idx) => {
          const isDistractor = p.left.trim() === "" && p.right.trim() !== "";
          return (
            <div className="qed-opt-row" key={p.id}>
              <span className="qe-option-letter">{idx + 1}</span>
              <div className="qed-pair-field">
                <BiField
                  en={p.left}
                  es={p.leftEs}
                  onEn={(v) => setPair(p.id, { left: v })}
                  onEs={(v) => setPair(p.id, { leftEs: v })}
                  placeholder="Prompt (blank = distractor)"
                  esPlaceholder="Enunciado…"
                />
                {isDistractor && <span className="qe-distractor-tag">Distractor</span>}
              </div>
              <span className="qe-pair-arrow">→</span>
              <div className="qed-pair-field">
                <BiField
                  en={p.right}
                  es={p.rightEs}
                  onEn={(v) => setPair(p.id, { right: v })}
                  onEs={(v) => setPair(p.id, { rightEs: v })}
                  placeholder="Answer"
                  esPlaceholder="Respuesta…"
                />
              </div>
              <button
                className="qe-icon-btn"
                aria-label="Remove pair"
                disabled={pairs.length <= 2}
                onClick={() => removePair(p.id)}
              >
                <SmallXIcon />
              </button>
            </div>
          );
        })}
      </div>
      <div className="qed-opts-foot">
        <button className="qe-add-btn" onClick={addPair} disabled={pairs.length >= MAX_OPTIONS}>
          + Add pair
        </button>
        <span className="qe-options-meta">{pairs.length}/{MAX_OPTIONS} rows</span>
      </div>

      {grading && (
        <div className="qed-match-grading">
          <div className="qed-card-subtitle">Scoring</div>
          <div className="radio-card-group">
            <RadioCard
              selected={data.matchGrading === "all-or-nothing"}
              onSelect={() => update({ matchGrading: "all-or-nothing" })}
              title="All-or-Nothing"
              desc="Every pair must be correct to score. A single wrong match gives 0% for the whole question."
            />
            <RadioCard
              selected={data.matchGrading === "partial"}
              onSelect={() => update({ matchGrading: "partial" })}
              title="Partial credit"
              desc="Each correct match earns a proportional share of the mark."
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ShortAnswerCard() {
  return (
    <section className="qed-card">
      <div className="qed-card-head">
        <div className="qed-card-title-row">
          <span className="qed-card-title">Response</span>
          <span className="qed-card-sub">ungraded · responses are collected, not scored</span>
        </div>
      </div>
      <input
        className="qe-text-input"
        disabled
        placeholder="Learner types a plain-text answer…"
      />
      <p className="qed-field-note">Plain text only · fixed limit of 512 characters.</p>
    </section>
  );
}

function FileUploadCard({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  return (
    <section className="qed-card">
      <div className="qed-card-head">
        <div className="qed-card-title-row">
          <span className="qed-card-title">Response</span>
          <span className="qed-card-sub">ungraded · learner uploads one or more files</span>
        </div>
      </div>
      <div className="qed-field-row">
        <div className="qed-field">
          <label className="form-sub-label">Maximum files</label>
          <SelectBox
            value={data.maxFiles}
            onChange={(v) => update({ maxFiles: v })}
            options={[
              { value: "default", label: "System default (5)" },
              ...Array.from({ length: 10 }, (_, i) => ({
                value: String(i + 1),
                label: String(i + 1),
              })),
            ]}
          />
        </div>
        <div className="qed-field">
          <label className="form-sub-label">Max size per file</label>
          <SelectBox
            value={data.maxSizeMb}
            onChange={(v) => update({ maxSizeMb: v })}
            options={[
              { value: "default", label: "System default (50 MB)" },
              ...[5, 10, 25, 50, 100].map((n) => ({
                value: String(n),
                label: `${n} MB`,
              })),
            ]}
          />
        </div>
      </div>
      <p className="qed-field-note">
        Leave the system-wide defaults or set per-question limits.
      </p>
    </section>
  );
}

function ScaleCard({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  return (
    <section className="qed-card">
      <div className="qed-card-head">
        <div className="qed-card-title-row">
          <span className="qed-card-title">Response</span>
          <span className="qed-card-sub">ungraded · learner picks a value on the scale</span>
        </div>
      </div>
      <div className="qed-field-row">
        <div className="qed-field qed-field--narrow">
          <label className="form-sub-label">From</label>
          <SelectBox
            value={String(data.scaleMin)}
            onChange={(v) => update({ scaleMin: Number(v) })}
            options={[0, 1].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </div>
        <div className="qed-field qed-field--narrow">
          <label className="form-sub-label">To</label>
          <SelectBox
            value={String(data.scaleMax)}
            onChange={(v) => update({ scaleMax: Number(v) })}
            options={Array.from({ length: 9 }, (_, i) => i + 2).map((n) => ({
              value: String(n),
              label: String(n),
            }))}
          />
        </div>
      </div>
      <div className="qed-field-row">
        <div className="qed-field">
          <label className="form-sub-label">
            Label for {data.scaleMin} <span className="qe-optional">optional</span>
          </label>
          <BiField
            en={data.scaleMinLabel}
            es={data.scaleMinLabelEs}
            onEn={(v) => update({ scaleMinLabel: v })}
            onEs={(v) => update({ scaleMinLabelEs: v })}
            placeholder="e.g. Extremely disappointed"
            esPlaceholder="p. ej. Muy decepcionado"
          />
        </div>
        <div className="qed-field">
          <label className="form-sub-label">
            Label for {data.scaleMax} <span className="qe-optional">optional</span>
          </label>
          <BiField
            en={data.scaleMaxLabel}
            es={data.scaleMaxLabelEs}
            onEn={(v) => update({ scaleMaxLabel: v })}
            onEs={(v) => update({ scaleMaxLabelEs: v })}
            placeholder="e.g. Extremely satisfied"
            esPlaceholder="p. ej. Muy satisfecho"
          />
        </div>
      </div>
      <div className="qed-scale-preview">
        {Array.from(
          { length: data.scaleMax - data.scaleMin + 1 },
          (_, i) => data.scaleMin + i,
        ).map((n) => (
          <span key={n} className="qed-scale-dot">
            {n}
          </span>
        ))}
      </div>
    </section>
  );
}

function FeedbackCard({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  const singleAnswer =
    data.type === "true-false" || (data.type === "mcq" && data.mcqMode === "single");
  return (
    <section className="qed-card">
      <div className="qed-card-head">
        <div className="qed-card-title-row">
          <span className="qed-card-title">Feedback</span>
          <span className="qed-card-sub">
            shown after submission when the quiz's review settings allow it
          </span>
        </div>
      </div>
      <div className="qed-fb-grid">
        <label className="qe-fb-label qe-fb-correct qed-fb-name">Correct</label>
        <BiField
          en={data.fbCorrect}
          es={data.fbCorrectEs}
          onEn={(v) => update({ fbCorrect: v })}
          onEs={(v) => update({ fbCorrectEs: v })}
          placeholder="Shown for a correct response…"
          esPlaceholder="Se muestra en una respuesta correcta…"
        />
        <label className="qe-fb-label qe-fb-partial qed-fb-name">Partially correct</label>
        <BiField
          en={singleAnswer ? "" : data.fbPartial}
          es={singleAnswer ? "" : data.fbPartialEs}
          onEn={(v) => update({ fbPartial: v })}
          onEs={(v) => update({ fbPartialEs: v })}
          disabled={singleAnswer}
          placeholder={
            singleAnswer
              ? "Not used for single-answer questions"
              : "Shown for a partially correct response…"
          }
          esPlaceholder="Se muestra en una respuesta parcialmente correcta…"
        />
        <label className="qe-fb-label qe-fb-incorrect qed-fb-name">Incorrect</label>
        <BiField
          en={data.fbIncorrect}
          es={data.fbIncorrectEs}
          onEn={(v) => update({ fbIncorrect: v })}
          onEs={(v) => update({ fbIncorrectEs: v })}
          placeholder="Shown for an incorrect response…"
          esPlaceholder="Se muestra en una respuesta incorrecta…"
        />
      </div>
    </section>
  );
}

/* ─────────────────  Sidebar cards  ───────────────── */

function SettingsCard({
  data,
  update,
  isEditing,
  catOptions,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  isEditing: boolean;
  catOptions: { key: string; label: string }[];
}) {
  const changeType = (t: QType) => {
    const gradable = typeSupportsGrading(t);
    const wasRandomisable = data.type === "mcq" || data.type === "match";
    const isRandomisable = t === "mcq" || t === "match";
    update({
      type: t,
      grading: gradable && !data.otherOption,
      // Keep the user's choice while moving between randomisable types;
      // restore the default (on) when coming back from one that isn't.
      randomise: isRandomisable ? (wasRandomisable ? data.randomise : true) : false,
      otherOption: t === "mcq" ? data.otherOption : false,
    });
  };

  const toSingle = () => {
    // Keep the first correct option at +100%; the rest turn into wrong answers.
    let kept = false;
    update({
      mcqMode: "single",
      choices: data.choices.map((c) => {
        if (c.grade > 0 && !kept) {
          kept = true;
          return { ...c, grade: 100 };
        }
        return c.grade > 0 ? { ...c, grade: -25 } : c;
      }),
    });
  };

  const toMultiple = () => {
    const correct = data.choices.filter((c) => c.grade > 0);
    const share = equalShare(Math.max(1, correct.length));
    update({
      mcqMode: "multiple",
      choices: data.choices.map((c) => (c.grade > 0 ? { ...c, grade: share } : c)),
    });
  };

  return (
    <div className="qed-card">
      <div className="qed-card-title">Question settings</div>
      <div className="qed-side-field">
        <label className="form-sub-label">Status</label>
        <SelectBox
          value={data.status}
          onChange={(v) => update({ status: v as QuestionDraft["status"] })}
          options={[
            { value: "Draft", label: "● Draft" },
            { value: "Active", label: "● Active" },
            ...(isEditing ? [{ value: "Archived", label: "● Archived" }] : []),
          ]}
        />
      </div>
      <div className="qed-side-field">
        <label className="form-sub-label">Category</label>
        <SelectBox
          value={data.catKey}
          onChange={(v) => update({ catKey: v })}
          options={[
            { value: "", label: "Uncategorized" },
            ...catOptions.map((o) => ({
              value: o.key,
              label: o.label.replace(" > ", " / "),
            })),
          ]}
        />
      </div>
      <div className="qed-side-field">
        <label className="form-sub-label">Type</label>
        <SelectBox
          value={data.type}
          disabled={isEditing}
          onChange={(v) => changeType(v as QType)}
          options={TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
        />
        {isEditing && (
          <span className="qed-field-hint">Type can't change on a saved question.</span>
        )}
      </div>
      {data.type === "mcq" && (
        <div className="tab-switch qed-mode-switch">
          <button
            className={`tab-switch-tab ${data.mcqMode === "single" ? "active" : ""}`}
            onClick={toSingle}
          >
            Single answer
          </button>
          <button
            className={`tab-switch-tab ${data.mcqMode === "multiple" ? "active" : ""}`}
            onClick={toMultiple}
          >
            Multiple answers
          </button>
        </div>
      )}
    </div>
  );
}

function GradingCard({
  data,
  update,
  gradable,
  usedInQuizzes,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  gradable: boolean;
  usedInQuizzes: number;
}) {
  const grading = data.grading && gradable;
  // Grading can't be disabled while the question is in a quiz, and can't be
  // enabled while the free-text "Other" option is on.
  const lockedByQuizzes = grading && usedInQuizzes > 0;
  const lockedByOther = !grading && data.otherOption;
  const gradingDisabled = !gradable || lockedByQuizzes || lockedByOther;
  const gradingSub = !gradable
    ? `${TYPE_LABELS[data.type]} questions can't be auto-graded`
    : lockedByQuizzes
      ? `Used in ${usedInQuizzes} quiz${usedInQuizzes === 1 ? "" : "zes"} — remove it from them first`
      : lockedByOther
        ? "Remove the “Other” option to enable grading"
        : "Required for use in quizzes";

  const canRandomise = data.type === "mcq" || data.type === "match";

  return (
    <div className="qed-card">
      <ToggleRow
        checked={grading}
        disabled={gradingDisabled}
        onChange={(v) => update({ grading: v })}
        label="Grading"
        sub={gradingSub}
      />
      {canRandomise && (
        <ToggleRow
          checked={data.randomise}
          onChange={(v) => update({ randomise: v })}
          label="Randomise options"
          sub="New order on every attempt or prompt"
        />
      )}
      {data.type === "mcq" && (
        <ToggleRow
          checked={data.otherOption}
          disabled={grading}
          onChange={(v) => update({ otherOption: v })}
          label="“Other” free-text option"
          sub="Only when grading is off"
        />
      )}
    </div>
  );
}

/* ─────────────────  Modals  ───────────────── */

function EmptyHistoryModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="ind-modal-overlay" onClick={onClose}>
      <div className="ind-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ind-modal-head">
          <h3 className="ind-modal-title">Version history</h3>
          <button className="ind-modal-close" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>
        <div className="ind-modal-body">
          <p className="ind-modal-text">
            No versions yet — this question becomes <strong>v1</strong> when it's created.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────  Primitives  ───────────────── */

const CheckMark = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

function RadioCard({
  selected,
  onSelect,
  title,
  desc,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  desc?: string;
}) {
  return (
    <button
      type="button"
      className={`radio-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
    >
      <span className="radio-dot" />
      <div className="radio-card-text">
        <div className="radio-card-title">{title}</div>
        {desc && <div className="radio-card-desc">{desc}</div>}
      </div>
    </button>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  sub,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`toggle-row ${disabled ? "qed-toggle-disabled" : ""}`}>
      <div className="toggle-text">
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className={`qe-select ${disabled ? "is-disabled" : ""}`}>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="qe-select-caret">▾</span>
    </div>
  );
}

function GradeSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const label = (v: number) => {
    const found = GRADE_OPTIONS.find((o) => Math.abs(o.value - v) < 0.001);
    return found ? found.label : fmtPct(v);
  };
  const opts = GRADE_OPTIONS.some((o) => Math.abs(o.value - value) < 0.001)
    ? GRADE_OPTIONS
    : [{ value, label: label(value) }, ...GRADE_OPTIONS];
  return (
    <div
      className={`qe-select qe-grade-select ${value > 0 ? "is-pos" : value < 0 ? "is-neg" : ""}`}
    >
      <select value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
        {opts.map((o) => (
          <option key={o.label} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="qe-select-caret">▾</span>
    </div>
  );
}

/* Bilingual plain-text field — English row over a Spanish row, sharing one
   bordered box. Used for every user-facing field except the rich question text
   (options, match pairs, scale labels, feedback). */
function BiField({
  en,
  es,
  onEn,
  onEs,
  placeholder,
  esPlaceholder,
  disabled,
}: {
  en: string;
  es: string;
  onEn: (v: string) => void;
  onEs: (v: string) => void;
  placeholder?: string;
  esPlaceholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`qed-bi ${disabled ? "is-disabled" : ""}`}>
      <label className="qed-bi-row">
        <span className="qed-bi-tag">EN</span>
        <input
          className="qed-bi-input"
          value={en}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onEn(e.target.value)}
        />
      </label>
      <div className="qed-bi-divider" />
      <label className="qed-bi-row">
        <span className="qed-bi-tag">ES</span>
        <input
          className="qed-bi-input"
          value={es}
          disabled={disabled}
          placeholder={esPlaceholder ?? "Traducción en español…"}
          onChange={(e) => onEs(e.target.value)}
        />
      </label>
    </div>
  );
}

function RteToolbar() {
  return (
    <div className="rte-toolbar">
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <BoldIcon />
      </button>
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <ItalicIcon />
      </button>
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <UnderlineIcon />
      </button>
      <span className="rte-sep" />
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <BulletListIcon />
      </button>
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <NumberListIcon />
      </button>
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <IndentRightIcon />
      </button>
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <IndentLeftIcon />
      </button>
      <span className="rte-sep" />
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <LinkSmallIcon />
      </button>
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <ImageIcon />
      </button>
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <VideoIcon />
      </button>
      <button className="rte-btn" tabIndex={-1} onMouseDown={(e) => e.preventDefault()}>
        <AudioIcon />
      </button>
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      rows={2}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
