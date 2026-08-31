import { useMemo, useState } from "react";
import {
  categories as seedCategories,
  flattenCategories,
  supportsGrading,
  type Question,
  type QuestionType,
} from "../data/questionBank";
import { QuestionHistoryModal } from "./QuestionHistoryModal";
import { ArrowRightIcon, SmallXIcon, MoveIcon, InfoIcon, PlusThinIcon } from "./icons";
import { SectionHeading } from "./SectionHeading";
import { RichTextField } from "./RichTextField";

/* ─────────────────  Types  ───────────────── */

type QType = "mcq" | "true-false" | "match" | "short" | "file" | "scale";
type MatchGrading = "all-or-nothing" | "partial";

type Choice = { id: string; text: string; textEs: string; grade: number };
type Pair = { id: string; left: string; right: string; leftEs: string; rightEs: string };

type QuestionDraft = {
  type: QType;
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

/* The editor's page title names the type it is on (Figma 739:1504 — "New
   Multiple-Choice Question"), so it changes with the Question Type dropdown. */
const TYPE_TITLES: Record<QType, string> = {
  mcq: "Multiple-Choice",
  "true-false": "True or False",
  match: "Match the Following",
  short: "Short Answer",
  file: "File Upload",
  scale: "Linear Scale",
};

/* An MCQ is a "multiple select" as soon as more than one option carries a
   positive grade — the per-option percentages are what say how many answers a
   learner may pick, so there is no separate single/multiple switch. */
function multiAnswer(choices: Choice[]): boolean {
  return choices.filter((c) => c.grade > 0).length > 1;
}

function typeSupportsGrading(t: QType): boolean {
  return t === "mcq" || t === "true-false" || t === "match";
}

/* Moodle's fixed grade dropdown — a percentage share of the question's mark. */
const GRADE_STEPS = [
  100, 90, 83.33333, 80, 75, 70, 66.66667, 60, 50, 40, 33.33333, 30, 25, 20,
  16.66667, 14.28571, 12.5, 11.11111, 10, 5,
];

/* Figma 814:1705 writes a positive share as a bare percentage ("100%") and no
   grade as "0%"; only the negative steps carry a sign. */
function fmtPct(v: number): string {
  if (v === 0) return "0%";
  const rounded = Math.round(Math.abs(v) * 1000) / 1000;
  return `${v > 0 ? "" : "−"}${rounded}%`;
}

const GRADE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "0%" },
  ...GRADE_STEPS.map((v) => ({ value: v, label: fmtPct(v) })),
  ...GRADE_STEPS.map((v) => ({ value: -v, label: fmtPct(-v) })),
];

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

function buildInitial(
  initialCategoryPath?: string[],
  editing?: Question,
  initialType?: QuestionType,
): QuestionDraft {
  // Category is required, so a fresh question starts on the first real
  // category rather than "Uncategorized" — unless one was handed in already.
  const defaultCatKey =
    initialCategoryPath?.length
      ? catKeyFromPath(initialCategoryPath)
      : (flattenCategories(seedCategories)[0]?.key ?? "");
  const base: QuestionDraft = {
    type: initialType ? editorType(initialType) : "mcq",
    catKey: defaultCatKey,
    status: "Active",
    text: "",
    textEs: "",
    choices: [blankChoice(100), blankChoice(0), blankChoice(0), blankChoice(0)],
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
  /** Type picked in the Create Question menu — the editor opens on it. */
  initialType?: QuestionType;
  editingQuestion?: Question;
};

let createdSeq = 0;

function questionFromDraft(d: QuestionDraft, hasSpanish: boolean): Question {
  const type: QuestionType =
    d.type === "mcq"
      ? multiAnswer(d.choices)
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

export function NewQuestionWizard({
  onClose,
  onCreate,
  initialCategoryPath,
  initialType,
  editingQuestion,
}: Props) {
  const isEditing = !!editingQuestion;
  const [data, setData] = useState<QuestionDraft>(() =>
    buildInitial(initialCategoryPath, editingQuestion, initialType),
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
  /* Figma 739:1504 titles the screen by type and drops the subtext on a new
     question — the versioning sentence is the only thing left to say, and it
     only applies to an edit. */
  const title = `${isEditing ? "Edit" : "New"} ${TYPE_TITLES[data.type]} Question`;
  const desc = isEditing
    ? `Saving creates v${version + 1} in ${catLabel}. Quizzes and feedback forms using this question move to the new version; past attempts keep v${version}.`
    : "";

  /* The Task wizard's two-column shell (.wizard-body: main pane + rail),
     mirrored — the question itself runs in the main pane on the LEFT with the
     wizard's own title/subtext header, and the settings rail sits on the
     right. The rail is not a step list, so it keeps its own controls and drops
     the card background for the wizard's plain bordered column. */
  return (
    <div className="wizard qed">
      <div className="wizard-body">
        <div className="wizard-main">
          <div className="wizard-content">
            <h1 className={`wizard-title${desc ? "" : " qed-title-solo"}`}>{title}</h1>
            {desc && <p className="wizard-desc">{desc}</p>}

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

      {/* Footer (Figma 73:515) */}
      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>
            Cancel
          </button>
          {isEditing && (
            <span className="wizard-saved">{`last saved · v${version}`}</span>
          )}
        </div>
        <div className="wizard-actions">
          {isEditing && (
            <button className="btn-save-draft" onClick={() => setShowHistory(true)}>
              View history
            </button>
          )}
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

      {showHistory && (
        <QuestionHistoryModal
          question={editingQuestion!}
          onClose={() => setShowHistory(false)}
        />
      )}
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

  /* Archived / Active, in the Figma order. "Draft" is not one of the design's
     segments — it only appears when a question already saved as a draft is
     being edited, so its state stays representable. */
  const statuses: QuestionDraft["status"][] =
    data.status === "Draft" ? ["Draft", "Archived", "Active"] : ["Archived", "Active"];

  return (
    <>
      <div className="wizard-fields">
        <div className="form-group">
          <label className="form-label">
            Question Status <span className="req">*</span>
          </label>
          {/* Single-Select (Figma 359:2373), accent-active variant */}
          <div className="seg-control">
            {statuses.map((st) => (
              <button
                key={st}
                className={`seg-btn ${data.status === st ? "active accent" : ""}`}
                onClick={() => update({ status: st })}
              >
                {st}
              </button>
            ))}
          </div>
          <p className="form-help">Archived questions are not shown to users</p>
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
          <p className="form-help">Where it goes in the Question Bank</p>
        </div>

        <div className="form-group">
          <label className="form-label">
            Question Type <span className="req">*</span>
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
        <RichTextField
          en={data.text}
          es={data.textEs}
          onChangeEn={(v) => update({ text: v })}
          onChangeEs={(v) => update({ textEs: v })}
          placeholderEn="Write the question…"
          placeholderEs="Escribe la pregunta…"
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

  /* Figma 814:1679 "Create Question - MCQ" — one boxed table: an
     OPTION / GRADE header, a row per option (drag handle, letter, dual-language
     field, grade, remove), then a footer row holding the add CTA. */
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">
          Options <span className="req">*</span>
        </label>

        <div className="qed-tbl">
          <div className="qed-tbl-hd">
            <span className="qed-tbl-ord" aria-hidden />
            <span className="qed-tbl-hd-opt">OPTION</span>
            {grading && (
              <span className="qed-tbl-hd-grade">
                GRADE
                <span
                  className="qed-tbl-info"
                  title="Share of the question's mark this option earns."
                >
                  <InfoIcon />
                </span>
              </span>
            )}
          </div>

          {choices.map((c, i) => (
            <div className="qed-tbl-row" key={c.id}>
              <span className="qed-tbl-ord">
                <span className="qed-tbl-grip" aria-hidden>
                  <MoveIcon />
                </span>
                {/* Figma 814:1695 labels each option A, B, C… — the grade
                    dropdown is what marks an option correct, so there is no
                    separate radio/checkbox. */}
                <span className="qed-tbl-letter" aria-hidden>
                  {OPTION_LETTERS[i] ?? i + 1}
                </span>
              </span>
              <div className="qed-tbl-field">
                <RichTextField
                  en={c.text}
                  es={c.textEs}
                  onChangeEn={(v) => setChoice(c.id, { text: v })}
                  onChangeEs={(v) => setChoice(c.id, { textEs: v })}
                  placeholderEn={`Option ${OPTION_LETTERS[i] ?? i + 1}…`}
                  placeholderEs={`Opción ${OPTION_LETTERS[i] ?? i + 1}…`}
                />
              </div>
              {grading && (
                <GradeSelect value={c.grade} onChange={(v) => setChoice(c.id, { grade: v })} />
              )}
              <button
                className="qed-tbl-x"
                aria-label="Remove option"
                disabled={choices.length <= 2}
                onClick={() => removeChoice(c.id)}
              >
                <SmallXIcon />
              </button>
            </div>
          ))}

          {!grading && data.otherOption && (
            <div className="qed-tbl-row">
              <span className="qed-tbl-ord">
                <span className="qed-tbl-grip" aria-hidden>
                  <MoveIcon />
                </span>
                <span className="qed-tbl-letter" aria-hidden>
                  {OPTION_LETTERS[choices.length] ?? choices.length + 1}
                </span>
              </span>
              <span className="qed-tbl-static">
                Other — learner types a free-text answer
              </span>
              <button
                className="qed-tbl-x"
                aria-label="Remove Other option"
                onClick={() => update({ otherOption: false })}
              >
                <SmallXIcon />
              </button>
            </div>
          )}

          <div className="qed-tbl-foot">
            <button
              className="cta-primary"
              onClick={addChoice}
              disabled={choices.length >= MAX_OPTIONS}
            >
              {choices.length < TARGET_OPTIONS
                ? `Add ${TARGET_OPTIONS - choices.length} More`
                : "Add option"}
            </button>
          </div>
        </div>

        <p className="form-help">
          {grading
            ? "The total of all percentages must be 100%"
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
        : "Required for use in Quizzes";

  const canRandomise = data.type === "mcq" || data.type === "match";

  /* Figma 739:1504 runs the three switches as a plain stack at the foot of the
     rail — no section heading over them. */
  return (
    <div className="wizard-fields">
      {canRandomise && (
        <ToggleRow
          checked={data.randomise}
          onChange={(v) => update({ randomise: v })}
          label="Randomize Options"
          sub="New order on every attempt"
        />
      )}
      <ToggleRow
        checked={grading}
        disabled={gradingDisabled}
        onChange={(v) => update({ grading: v })}
        label="Grading"
        sub={gradingSub}
      />
      {data.type === "mcq" && (
        <ToggleRow
          checked={data.otherOption}
          disabled={grading}
          onChange={(v) => update({ otherOption: v })}
          label="“Other” Free-Text Option"
          sub="Only when grading is off"
          info="A learner who picks it types their own answer, so the question can't be auto-graded."
        />
      )}
    </div>
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
    data.type === "true-false" || (data.type === "mcq" && !multiAnswer(data.choices));
  /* Figma 814:1770 — the same boxed table as the options, with a fixed label
     column instead of the handle, and one closing subtext under the card. */
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Combined Feedback</label>
        <div className="qed-tbl">
          <FeedbackRow
            label="For Correct Response"
            en={data.fbCorrect}
            es={data.fbCorrectEs}
            onEn={(v) => update({ fbCorrect: v })}
            onEs={(v) => update({ fbCorrectEs: v })}
            placeholder="Shown for a correct response…"
            esPlaceholder="Se muestra en una respuesta correcta…"
          />
          <FeedbackRow
            label="For Partially Correct Response"
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
            label="For Incorrect Response"
            en={data.fbIncorrect}
            es={data.fbIncorrectEs}
            onEn={(v) => update({ fbIncorrect: v })}
            onEs={(v) => update({ fbIncorrectEs: v })}
            placeholder="Shown for an incorrect response…"
            esPlaceholder="Se muestra en una respuesta incorrecta…"
          />
        </div>
        <p className="form-help">
          Combined feedback shown to the user when reviewing their Quiz Attempt
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
    <div className="qed-tbl-row">
      <span className="qed-fb-label">{label}</span>
      <div className="qed-tbl-field">
        <RichTextField
          en={en}
          es={es}
          onChangeEn={onEn}
          onChangeEs={onEs}
          placeholderEn={placeholder}
          placeholderEs={esPlaceholder}
          disabled={disabled}
        />
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
  info,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
  /** Tooltip on an info glyph beside the note (Figma 814:1829). */
  info?: string;
  disabled?: boolean;
}) {
  return (
    /* Figma 739:1821/739:1827 — the switch leads, with the title over its note
       beside it. (The stacked `.toggle-field` variant is what the rest of the
       app uses; this screen's rail is the switch-first row.) */
    <div className={`toggle-row inline qed-toggle ${disabled ? "disabled" : ""}`}>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="toggle-knob" />
      </button>
      <div className="toggle-text">
        <span className="toggle-label">{label}</span>
        {sub && (
          <p className="toggle-sub">
            {sub}
            {info && (
              <span className="qed-tbl-info" title={info}>
                <InfoIcon />
              </span>
            )}
          </p>
        )}
      </div>
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
      className="form-select qed-grade"
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

