import { useMemo, useState } from "react";
import {
  categories as seedCategories,
  flattenCategories,
  supportsGrading,
  type Question,
  type QuestionType,
} from "../data/questionBank";
import { QuestionHistoryModal } from "./QuestionHistoryModal";
import { ArrowRightIcon, ChevronRightIcon, SmallXIcon, DragHandleIcon, PlusThinIcon } from "./icons";
import { SectionHeading } from "./SectionHeading";
import { RteToolbar } from "./RteToolbar";
import { AutoTextarea } from "./AutoTextarea";

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

/* Per-option labels down the left of each MCQ row (Figma 414:427). */
const OPTION_LETTERS = "ABCDEFGHIJ".split("");

/* Options a question is expected to have. Below this the add card counts down
   to it ("Add 1 More" at 4, Figma 416:578); past it it's a plain "Add option"
   up to MAX_OPTIONS. */
const TARGET_OPTIONS = 5;

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
  // Category is required, so a fresh question starts on the first real
  // category rather than "Uncategorized" — unless one was handed in already.
  const defaultCatKey =
    initialCategoryPath?.length
      ? catKeyFromPath(initialCategoryPath)
      : (flattenCategories(seedCategories)[0]?.key ?? "");
  const base: QuestionDraft = {
    type: "mcq",
    mcqMode: "single",
    catKey: defaultCatKey,
    status: "Active",
    text: "",
    textEs: "",
    choices: [blankChoice(100), blankChoice(-25), blankChoice(-25), blankChoice(-25)],
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

  const gradable = typeSupportsGrading(data.type);
  const grading = data.grading && gradable;
  const usedInQuizzes = editingQuestion?.quizzes.length ?? 0;

  // Translation completeness across every user-facing text field — no longer
  // surfaced in the editor, still decides whether the saved question is marked
  // as having Spanish.
  const transEntries = useMemo(() => translationEntries(data), [data]);
  const filled = transEntries.filter((e) => e.en.trim() !== "");
  const esDone = filled.filter((e) => e.es.trim() !== "").length;
  const esComplete = filled.length > 0 && esDone === filled.length;

  const version = editingQuestion?.version ?? 0;
  const title = isEditing ? "Edit Question" : "New Question";

  return (
    <div className="qed">
      <div className="qed-content">
        {/* Page header (Figma 46:314) under a breadcrumb (275:2108). */}
        <div className="qed-pagehead">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <button className="breadcrumb-item" onClick={onClose}>
              Question Bank
            </button>
            <span className="breadcrumb-sep">
              <ChevronRightIcon />
            </span>
            <span className="breadcrumb-current">{title}</span>
          </nav>
          <div>
            <h1 className="tasks-title">{title}</h1>
            {isEditing && (
              <p className="tasks-subtitle">
                {`Saving creates v${version + 1} in ${catLabel}. Quizzes and feedback forms using this question move to the new version; past attempts keep v${version}.`}
              </p>
            )}
          </div>
        </div>

        {/* Content on the left, settings on the right. */}
        <div className="qed-split">
          <div className="qed-main">
            <QuestionTextSection data={data} update={update} />

            {data.type === "mcq" && <McqSection data={data} update={update} grading={grading} />}
            {data.type === "true-false" && (
              <TrueFalseSection data={data} update={update} grading={grading} />
            )}
            {data.type === "match" && <MatchSection data={data} update={update} />}
            {data.type === "short" && <ShortAnswerSection />}
            {data.type === "file" && <FileResponseSection />}
            {data.type === "scale" && <ScaleLabelsSection data={data} update={update} />}

            {grading && <FeedbackSection data={data} update={update} />}
          </div>

          <aside className="qed-side">
            <SetupSection
              data={data}
              update={update}
              isEditing={isEditing}
              catOptions={catOptions}
            />

            {data.type === "match" && grading && (
              <MatchScoringSection data={data} update={update} />
            )}
            {data.type === "file" && <FileRulesSection data={data} update={update} />}
            {data.type === "scale" && <ScaleRangeSection data={data} update={update} />}

            <GradingSection
              data={data}
              update={update}
              gradable={gradable}
              usedInQuizzes={usedInQuizzes}
            />
          </aside>
        </div>
      </div>

      {/* Footer (Figma 73:515) */}
      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>
            Cancel
          </button>
          <span className="wizard-saved">
            {isEditing ? `last saved · v${version}` : "not saved yet"}
          </span>
        </div>
        <div className="wizard-actions">
          <button className="btn-save-draft" onClick={() => setShowHistory(true)}>
            View history
          </button>
          <button
            className="btn-publish"
            onClick={() => {
              if (!isEditing && onCreate) {
                onCreate(questionFromDraft(data, esComplete));
              }
              onClose();
            }}
          >
            {isEditing ? "Save changes" : "Create question"}
          </button>
        </div>
      </footer>

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

/* ─────────────────  Sections  ───────────────── */

function SetupSection({
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
    <>
      <SectionHeading label="Question setup" />
      <div className="wizard-fields">
        <div className="form-group">
          <label className="form-label">Status</label>
          <Select
            value={data.status}
            onChange={(v) => update({ status: v as QuestionDraft["status"] })}
            options={[
              { value: "Draft", label: "Draft" },
              { value: "Active", label: "Active" },
              ...(isEditing ? [{ value: "Archived", label: "Archived" }] : []),
            ]}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Category <span className="req">*</span>
          </label>
          <Select
            value={data.catKey}
            onChange={(v) => update({ catKey: v })}
            options={catOptions.map((o) => ({
              value: o.key,
              label: o.label.replace(" > ", " / "),
            }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Question type <span className="req">*</span>
          </label>
          <Select
            value={data.type}
            disabled={isEditing}
            onChange={(v) => changeType(v as QType)}
            options={TYPE_ORDER.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
          />
          {isEditing && (
            <p className="form-help">Type can't change on a saved question.</p>
          )}
        </div>

        {data.type === "mcq" && (
          <div className="form-group">
            <label className="form-label">Answers</label>
            {/* Single-Select (Figma 359:2373) */}
            <div className="seg-control">
              <button
                className={`seg-btn ${data.mcqMode === "single" ? "active" : ""}`}
                onClick={toSingle}
              >
                Single answer
              </button>
              <button
                className={`seg-btn ${data.mcqMode === "multiple" ? "active" : ""}`}
                onClick={toMultiple}
              >
                Multiple answers
              </button>
            </div>
            <p className="form-help">How many options a learner can pick.</p>
          </div>
        )}
      </div>
    </>
  );
}

function QuestionTextSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">
          Question <span className="req">*</span>
        </label>
        {/* Rich Text Input - Dual Language, 2 lines (Figma 405:238) */}
        <RichTextField
          en={data.text}
          es={data.textEs}
          onEn={(v) => update({ text: v })}
          onEs={(v) => update({ textEs: v })}
          placeholder="Write the question…"
          esPlaceholder="Escribe la pregunta…"
        />
      </div>
    </div>
  );
}

function McqSection({
  data,
  update,
  grading,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  grading: boolean;
}) {
  const choices = data.choices;

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

  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">
          Options <span className="req">*</span>
        </label>

          <div className="qed-rows">
            {choices.map((c, i) => (
              <div className="qed-row" key={c.id}>
                <span className="qed-row-grip" aria-hidden>
                  <DragHandleIcon />
                </span>
                {/* Figma 414:427 labels each option A, B, C… — the score
                    dropdown is what marks an option correct, so there is no
                    separate radio/checkbox. */}
                <span className="qed-row-letter" aria-hidden>
                  {OPTION_LETTERS[i] ?? i + 1}
                </span>
                <RichTextField
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
                  className="qed-row-remove"
                  aria-label="Remove option"
                  disabled={choices.length <= 2}
                  onClick={() => removeChoice(c.id)}
                >
                  <SmallXIcon />
                </button>
              </div>
            ))}

            {!grading && data.otherOption && (
              <div className="qed-row qed-row--other">
                <span className="qed-row-grip" aria-hidden>
                  <DragHandleIcon />
                </span>
                <span className="qed-row-static">
                  Other — learner types a free-text answer
                </span>
                <button
                  className="qed-row-remove"
                  aria-label="Remove Other option"
                  onClick={() => update({ otherOption: false })}
                >
                  <SmallXIcon />
                </button>
              </div>
            )}
          </div>

          {/* Figma 416:578 puts the add row directly under the options, with
              the rule text closing the section beneath it. */}
          <div className="qed-row-adds">
            <AddCard
              label={
                choices.length < TARGET_OPTIONS
                  ? `Add ${TARGET_OPTIONS - choices.length} More`
                  : "Add option"
              }
              onClick={addChoice}
              disabled={choices.length >= MAX_OPTIONS}
            />
          </div>

          <p className="form-help">
            {grading
              ? "The total of all percentages must be 100%."
              : "Ungraded — responses are collected, not scored."}
          </p>
      </div>
    </div>
  );
}

function TrueFalseSection({
  data,
  update,
  grading,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  grading: boolean;
}) {
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <div className="form-label-row">
          <label className="form-label">
            Correct answer <span className="req">*</span>
          </label>
          {grading && (
            <span className="co-status-pill co-status-pill--green">Best score 100%</span>
          )}
        </div>
        {/* Radio cards (Figma 134:1790 / 136:294) */}
        <div className="radio-card-group">
          {[true, false].map((val) => {
            const selected = grading && data.tfAnswer === val;
            return (
              <RadioCard
                key={String(val)}
                selected={selected}
                disabled={!grading}
                onSelect={() => grading && update({ tfAnswer: val })}
                title={val ? "True" : "False"}
                desc={selected ? "Correct — graded +100%" : undefined}
              />
            );
          })}
        </div>
        <p className="form-help">
          {grading
            ? "The correct value is graded +100%, the other 0%."
            : "Ungraded — responses are collected, not scored."}
        </p>
      </div>
    </div>
  );
}

function MatchSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
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
    <div className="wizard-fields">
      <div className="form-group">
        <div className="form-label-row">
          <label className="form-label">
            Prompts and answers <span className="req">*</span>
          </label>
          <span className="co-status-pill co-status-pill--secondary">
            {pairs.length}/{MAX_OPTIONS} rows
          </span>
        </div>

          <div className="qed-rows">
            {pairs.map((p, idx) => {
              const isDistractor = p.left.trim() === "" && p.right.trim() !== "";
              return (
                <div className="qed-row" key={p.id}>
                  <span className="qed-row-num">{idx + 1}</span>
                  <div className="qed-pair-side">
                    <LangField
                      en={p.left}
                      es={p.leftEs}
                      onEn={(v) => setPair(p.id, { left: v })}
                      onEs={(v) => setPair(p.id, { leftEs: v })}
                      placeholder="Prompt (blank = distractor)"
                      esPlaceholder="Enunciado…"
                    />
                    {isDistractor && (
                      <span className="co-status-pill co-status-pill--secondary qed-distractor">
                        Distractor
                      </span>
                    )}
                  </div>
                  <span className="qed-pair-arrow" aria-hidden>
                    <ArrowRightIcon />
                  </span>
                  <div className="qed-pair-side">
                    <LangField
                      en={p.right}
                      es={p.rightEs}
                      onEn={(v) => setPair(p.id, { right: v })}
                      onEs={(v) => setPair(p.id, { rightEs: v })}
                      placeholder="Answer"
                      esPlaceholder="Respuesta…"
                    />
                  </div>
                  <button
                    className="qed-row-remove"
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

          <p className="form-help">
            Each prompt matches one answer. A blank prompt leaves its answer in
            play as an extra wrong option (distractor).
          </p>

          <div className="qed-row-adds">
            <AddCard
              label="Add pair"
              onClick={addPair}
              disabled={pairs.length >= MAX_OPTIONS}
            />
          </div>
      </div>
    </div>
  );
}

function MatchScoringSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  return (
    <>
      <SectionHeading label="Scoring" />
      <div className="wizard-fields">
        <div className="form-group">
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
      </div>
    </>
  );
}

function ShortAnswerSection() {
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Learner's answer</label>
        <input
          className="form-input"
          disabled
          placeholder="Learner types a plain-text answer…"
        />
        <p className="form-help">
          Ungraded — plain text only, with a fixed limit of 512 characters.
        </p>
      </div>
    </div>
  );
}

function FileResponseSection() {
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Learner's answer</label>
        <input
          className="form-input"
          disabled
          placeholder="Learner uploads one or more files…"
        />
        <p className="form-help">
          Ungraded — file limits are set on the right.
        </p>
      </div>
    </div>
  );
}

function FileRulesSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  return (
    <>
      <SectionHeading label="File limits" />
      <div className="wizard-fields">
        <div className="form-group">
          <label className="form-label">Maximum files</label>
          <Select
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
          <p className="form-help">
            Leave the system-wide default or set a per-question limit.
          </p>
        </div>
        <div className="form-group">
          <label className="form-label">Max size per file</label>
          <Select
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
    </>
  );
}

function ScaleRangeSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  return (
    <>
      <SectionHeading label="Scale" />
      <div className="wizard-fields">
        <div className="form-group">
          <label className="form-label">Scale range</label>
          <div className="qed-inline-fields">
            <Select
              value={String(data.scaleMin)}
              onChange={(v) => update({ scaleMin: Number(v) })}
              options={[0, 1].map((n) => ({ value: String(n), label: String(n) }))}
              width="narrow"
            />
            <span className="qed-range-to">to</span>
            <Select
              value={String(data.scaleMax)}
              onChange={(v) => update({ scaleMax: Number(v) })}
              options={Array.from({ length: 9 }, (_, i) => i + 2).map((n) => ({
                value: String(n),
                label: String(n),
              }))}
              width="narrow"
            />
          </div>
          <p className="form-help">
            Ungraded — the learner picks a value on the scale.
          </p>
        </div>
      </div>
    </>
  );
}

function ScaleLabelsSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Scale</label>
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
        <p className="form-help">Set the range on the right.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Label for {data.scaleMin}</label>
        <LangField
          en={data.scaleMinLabel}
          es={data.scaleMinLabelEs}
          onEn={(v) => update({ scaleMinLabel: v })}
          onEs={(v) => update({ scaleMinLabelEs: v })}
          placeholder="e.g. Extremely disappointed"
          esPlaceholder="p. ej. Muy decepcionado"
        />
        <p className="form-help">Optional — shown at the low end of the scale.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Label for {data.scaleMax}</label>
        <LangField
          en={data.scaleMaxLabel}
          es={data.scaleMaxLabelEs}
          onEn={(v) => update({ scaleMaxLabel: v })}
          onEs={(v) => update({ scaleMaxLabelEs: v })}
          placeholder="e.g. Extremely satisfied"
          esPlaceholder="p. ej. Muy satisfecho"
        />
        <p className="form-help">Optional — shown at the high end of the scale.</p>
      </div>
    </div>
  );
}

function GradingSection({
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
    <>
      <SectionHeading label="Grading" />
      <div className="qed-toggles">
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
    </>
  );
}

function FeedbackSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  const singleAnswer =
    data.type === "true-false" || (data.type === "mcq" && data.mcqMode === "single");
  /* Figma 416:832 — one "Combined Feedback" heading over three bordered rows,
     each a 62px label column beside the field, then a single closing subtext. */
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Combined Feedback</label>
        <div className="qed-rows">
          <FeedbackRow
            label="Correct Response"
            en={data.fbCorrect}
            es={data.fbCorrectEs}
            onEn={(v) => update({ fbCorrect: v })}
            onEs={(v) => update({ fbCorrectEs: v })}
            placeholder="Shown for a correct response…"
            esPlaceholder="Se muestra en una respuesta correcta…"
          />
          <FeedbackRow
            label="Partially Correct Response"
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
          <FeedbackRow
            label="Incorrect Response"
            en={data.fbIncorrect}
            es={data.fbIncorrectEs}
            onEn={(v) => update({ fbIncorrect: v })}
            onEs={(v) => update({ fbIncorrectEs: v })}
            placeholder="Shown for an incorrect response…"
            esPlaceholder="Se muestra en una respuesta incorrecta…"
          />
        </div>
        <p className="form-help">
          Combined feedback shown to the user when reviewing their Quiz Attempt.
        </p>
      </div>
    </div>
  );
}

function FeedbackRow({
  label,
  en,
  es,
  onEn,
  onEs,
  placeholder,
  esPlaceholder,
  disabled,
}: {
  label: string;
  en: string;
  es: string;
  onEn: (v: string) => void;
  onEs: (v: string) => void;
  placeholder?: string;
  esPlaceholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="qed-row">
      <span className="qed-fb-label">{label}</span>
      <RichTextField
        en={en}
        es={es}
        onEn={onEn}
        onEs={onEs}
        placeholder={placeholder}
        esPlaceholder={esPlaceholder}
        disabled={disabled}
      />
    </div>
  );
}

/* ─────────────────  Modals  ───────────────── */

function EmptyHistoryModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head qh-head">
          <h3 className="pm-title">Version history</h3>
          <button className="ind-icon-btn" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>
        <div className="pm-body">
          <p className="pm-text">
            No versions yet — this question becomes <strong>v1</strong> when it's created.
          </p>
        </div>
        <div className="pm-foot">
          <button className="btn-save-draft" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────  Primitives  ───────────────── */

/* "Add X" card — the design system's add affordance (Figma 341:2764). */
function AddCard({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  /* The question editor's own variant (Figma 416:813 "Task Card") — dashed and
     neutral. The plain .add-card the certification tree uses is a different
     component (341:2764) and keeps its solid orange treatment. */
  return (
    <button className="add-card add-card--dashed" onClick={onClick} disabled={disabled}>
      <span className="add-card-icon">
        <PlusThinIcon />
      </span>
      <span className="add-card-label">{label}</span>
    </button>
  );
}

function RadioCard({
  selected,
  onSelect,
  title,
  desc,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  desc?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`radio-card ${selected ? "selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
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
    /* Figma 373:233 / 362:2440 — label, then the switch beside the state it's
       in, then the note. */
    <div className={`toggle-field ${disabled ? "is-disabled" : ""}`}>
      <span className="form-label">{label}</span>
      <div className="toggle-switch-row">
        <button
          type="button"
          className={`toggle ${checked ? "on" : ""}`}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          aria-pressed={checked}
        >
          <span className="toggle-knob" />
        </button>
        <span className="toggle-state">{checked ? "Yes" : "No"}</span>
      </div>
      {sub && <p className="toggle-sub">{sub}</p>}
    </div>
  );
}

/* Dropdown input (Figma 101:272 / 101:281). */
function Select({
  value,
  onChange,
  options,
  disabled,
  width = "field",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  width?: "field" | "narrow";
}) {
  return (
    <select
      className={`form-select ${width === "narrow" ? "qed-select-narrow" : "qed-select"}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
    <select
      className={`form-select qed-grade ${value > 0 ? "is-pos" : value < 0 ? "is-neg" : ""}`}
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {opts.map((o) => (
        <option key={o.label} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* Plain Text Input - Dual Language (Figma 49:348) — one bordered box holding an
   EN row over an ES row. Used for options, match pairs, scale labels and
   feedback; the question text itself uses the rich-text variant. */
function LangField({
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
    <div className={`lang-field ${disabled ? "is-disabled" : ""}`}>
      <label className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input
          className="lang-field-input"
          value={en}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onEn(e.target.value)}
        />
      </label>
      <div className="lang-field-divider" />
      <label className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input
          className="lang-field-input"
          value={es}
          disabled={disabled}
          placeholder={esPlaceholder ?? "Traducción en español…"}
          onChange={(e) => onEs(e.target.value)}
        />
      </label>
    </div>
  );
}

/* Dual-language rich text field — Question, Options, and Feedback all share
   this (Figma 405:238 "2 Lines"). The toolbar is always visible: Figma
   416:578 draws it on every field, including the option rows. */
function RichTextField({
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
    <div className={`rte-field ${disabled ? "is-disabled" : ""}`}>
      <RteToolbar />
      <div className="rte-lang-row">
        <span className="lang-tag">EN</span>
        <AutoTextarea
          className="rte-area"
          value={en}
          placeholder={placeholder}
          onChange={onEn}
          disabled={disabled}
        />
      </div>
      <div className="rte-field-divider" />
      <div className="rte-lang-row">
        <span className="lang-tag">ES</span>
        <AutoTextarea
          className="rte-area"
          value={es}
          placeholder={esPlaceholder ?? "Traducción en español…"}
          onChange={onEs}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
