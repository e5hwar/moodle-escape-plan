import { useMemo, useRef, useState } from "react";
import {
  categories as seedCategories,
  flattenCategories,
  supportsGrading,
  type Question,
  type QuestionStatus,
  type QuestionType,
} from "../data/questionBank";
import { QuestionHistoryModal } from "./QuestionHistoryModal";
import {
  SmallXIcon,
  MoveIcon,
  InfoIcon12,
  PlusThinIcon,
  ChevronRightIcon,
} from "./icons";
import { RichTextField } from "./RichTextField";
import { SelectField } from "./SelectField";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";

/* ─────────────────  Types  ───────────────── */

type QType = "mcq" | "true-false" | "match" | "short" | "file" | "scale";
type MatchGrading = "all-or-nothing" | "partial";

type Choice = { id: string; text: string; textEs: string; grade: number };
type Pair = { id: string; left: string; right: string; leftEs: string; rightEs: string };

type QuestionDraft = {
  type: QType;
  catKey: string; // flattened key: "cat" or "cat/sub" ("" = Uncategorized)
  status: QuestionStatus;
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

/** Two complete pairs plus one answer to match against — see MatchSection. */
const MIN_PAIRS = 3;

/* Per-option labels down the left of each MCQ row (Figma 414:427). */
const OPTION_LETTERS = "ABCDEFGHIJ".split("");

/* Title Case throughout, per the Question Type menu's spec — the label is a
   proper name for the type, so it reads the same in the dropdown, in the page
   title and in the grading rail's explanation. */
const TYPE_LABELS: Record<QType, string> = {
  mcq: "Multiple Choice",
  "true-false": "True/False",
  match: "Match the Following",
  short: "Short Answer",
  file: "File Upload",
  scale: "Linear Scale",
};

const TYPE_ORDER: QType[] = ["mcq", "true-false", "match", "short", "scale", "file"];
const TYPE_BY_LABEL = new Map(TYPE_ORDER.map((t) => [TYPE_LABELS[t], t]));

/* The editor's page title names the type it is on (Figma 739:1504 — "New
   Multiple-Choice Question"), so it changes with the Question Type dropdown. */
const TYPE_TITLES: Record<QType, string> = {
  mcq: "Multiple-Choice",
  "true-false": "True/False",
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
   grade as "None" (814:1723, 2026-09-10 — it read "0%" before); only the
   negative steps carry a sign. */
function fmtPct(v: number): string {
  if (v === 0) return "None";
  const rounded = Math.round(Math.abs(v) * 1000) / 1000;
  return `${v > 0 ? "" : "−"}${rounded}%`;
}

const GRADE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: fmtPct(0) },
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
  // A fresh question only pre-fills the category when one was handed in (the
  // rail's scoped create). Started from "All Categories" or the landing, the
  // field stays empty on its placeholder — guessing a category for the author
  // is worse than asking.
  const defaultCatKey = initialCategoryPath?.length
    ? catKeyFromPath(initialCategoryPath)
    : "";
  const baseType = initialType ? editorType(initialType) : "mcq";
  const base: QuestionDraft = {
    type: baseType,
    catKey: defaultCatKey,
    status: "Active",
    text: "",
    textEs: "",
    /* Every option starts on "None" — the author sets the correct one, and a
       pre-filled 100% on A reads as an answer nobody chose. */
    choices: [blankChoice(), blankChoice(), blankChoice(), blankChoice()],
    otherOption: false,
    tfAnswer: true,
    pairs: [blankPair(), blankPair(), blankPair(), blankPair()],
    matchGrading: "all-or-nothing",
    scaleMin: 1,
    scaleMax: 10,
    scaleMinLabel: "",
    scaleMinLabelEs: "",
    scaleMaxLabel: "",
    scaleMaxLabelEs: "",
    maxFiles: "1",
    maxSizeMb: "5",
    grading: true,
    randomise: baseType === "mcq",
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
    maxFiles: editing.fileRules ? String(editing.fileRules.maxFiles) : "1",
    maxSizeMb: editing.fileRules ? String(editing.fileRules.maxSizeMb) : "5",
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

/** Mandatory-field keys, shared by the collector, the blocked-button tooltip
 *  and the sections that flag their own field. */
const REQUIRED_FIELD_KEYS = {
  category: "category",
  text: "text",
  options: "options",
  answer: "answer",
  pairs: "pairs",
  scaleLabels: "scaleLabels",
} as const;

/** Reader-facing name of each gap, for the tooltip that says why Create
 *  Question is unavailable. Keep in step with REQUIRED_FIELD_KEYS. */
const REQUIRED_FIELD_LABELS: Record<string, string> = {
  category: "Category",
  text: "Question",
  options: "Options — at least two need text",
  answer: "Correct Answer — grade one option above 0%",
  pairs: "Questions & Answers — at least two questions and three answers",
  scaleLabels: "Scale labels — label both ends or neither",
};

/** Stable empty set, so the "nothing missing" memo doesn't churn its consumers. */
const EMPTY_KEYS: ReadonlySet<string> = new Set<string>();

/* Every mandatory field on the screen — the ones drawn with a red asterisk —
   plus the two rules an asterisk can't state on its own: a graded MCQ needs an
   option marked correct, and a labelled scale is labelled at both ends or not
   at all. Only the current type's fields are collected; the draft carries every
   type's state, and switching type must not leave a gap behind on a field the
   author can no longer see. Returned in reading order, so the tooltip lists
   them top-down. */
function collectMissing(d: QuestionDraft): string[] {
  const K = REQUIRED_FIELD_KEYS;
  const grading = d.grading && typeSupportsGrading(d.type);
  const gaps: string[] = [];
  if (d.catKey === "") gaps.push(K.category);
  if (!d.text.trim()) gaps.push(K.text);
  if (d.type === "mcq") {
    const filled = d.choices.filter((c) => c.text.trim() !== "");
    // One gap at a time: an option list too short to answer is the thing to
    // fix, not the answer it can't have yet.
    if (filled.length < 2) gaps.push(K.options);
    else if (grading && !filled.some((c) => c.grade > 0)) gaps.push(K.answer);
  }
  if (d.type === "match") {
    /* Figma 1198:1934's subtext is the rule: two complete pairs to match, and
       a third answer so there is at least one wrong one to match against. A
       blank question is a deliberate distractor — its answer still counts. */
    const complete = d.pairs.filter(
      (p) => p.left.trim() !== "" && p.right.trim() !== "",
    );
    const answers = d.pairs.filter((p) => p.right.trim() !== "");
    if (complete.length < 2 || answers.length < 3) gaps.push(K.pairs);
  }
  if (d.type === "scale") {
    // Both labels are optional together; one alone leaves the other end of the
    // scale unexplained.
    if ((d.scaleMinLabel.trim() !== "") !== (d.scaleMaxLabel.trim() !== "")) {
      gaps.push(K.scaleLabels);
    }
  }
  return gaps;
}

/* ─────────────────  Editor  ───────────────── */

type Props = {
  onClose: () => void;
  // Called with the built question when "Create Question" is clicked
  // (creation only — edits still just close, as before).
  onCreate?: (q: Question) => void;
  initialCategoryPath?: string[];
  /** Type picked in the Create Question menu — the editor opens on it. */
  initialType?: QuestionType;
  editingQuestion?: Question;
  /* Set when the editor was opened on a PAST version from Version History.
     `editingQuestion` already carries that version's content; this locks the
     form, so the screen is a viewer with a dead Save Changes button. */
  atVersion?: number;
  /** What the back crumb says — where `onClose` actually goes. */
  backLabel?: string;
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
  if (d.type === "file") {
    // Every File Upload question carries its own limits now — there is no
    // system-wide fallback to defer to.
    q.fileRules = {
      maxFiles: Number(d.maxFiles) || 1,
      maxSizeMb: Number(d.maxSizeMb) || 5,
    };
  }
  // A type with no partial-credit row can't carry partial feedback, whatever
  // the draft still holds from a type the author moved away from.
  const partial = d.type === "true-false" ? "" : d.fbPartial;
  if (grading && (d.fbCorrect || partial || d.fbIncorrect)) {
    q.feedback = {
      correct: d.fbCorrect || undefined,
      partial: partial || undefined,
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
  atVersion,
  backLabel = "Question Bank",
}: Props) {
  const isEditing = !!editingQuestion;
  /* A past version is a record, not a draft: every control is disabled and the
     primary action stays dead, so nothing here can be saved over the
     question's current content. */
  const readOnly = atVersion !== undefined;
  const [data, setData] = useState<QuestionDraft>(() =>
    buildInitial(initialCategoryPath, editingQuestion, initialType),
  );
  const [showHistory, setShowHistory] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const update = (patch: Partial<QuestionDraft>) => setData((d) => ({ ...d, ...patch }));

  /* A-Z by category, then by sub-category inside it. Sorting on the flattened
     "Parent > Sub" label does both at once and keeps a parent immediately
     above its own sub-categories (">" sorts after the end of the parent's
     name). `flattenCategories` keeps the Question Bank index's own order, so
     the sort lives here rather than in the shared helper. */
  const catOptions = useMemo(
    () =>
      [...flattenCategories(seedCategories)].sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    [],
  );
  /* The gate on creating: every mandatory field, re-derived each render, so
     filling the last one enables the button on the keystroke rather than on the
     next attempt. An edit runs the same check — a saved question can still have
     its question text emptied. */
  const gaps = useMemo(() => collectMissing(data), [data]);
  const canSave = gaps.length === 0 && !readOnly;

  /* Set on a blocked click: the gaps that attempt found, so the fields
     themselves turn red rather than only the tooltip naming them. Filtered
     against the live gaps, so an error clears on the keystroke that fixes it
     instead of waiting for another attempt. */
  const [missingKeys, setMissingKeys] = useState<ReadonlySet<string>>(EMPTY_KEYS);
  const missing = useMemo(() => {
    if (missingKeys.size === 0) return EMPTY_KEYS;
    const still = new Set(gaps);
    return new Set([...missingKeys].filter((k) => still.has(k)));
  }, [missingKeys, gaps]);

  /* What the unavailable button says on hover — dim alone doesn't tell the
     author what is left (the Task wizard's `blockedTip`). */
  const blockedTip = canSave
    ? undefined
    : readOnly
      ? `v${atVersion} is a past version — open for reference only. Edit the current version to make changes.`
      : [
          `Finish these to ${isEditing ? "save" : "create"} this question:`,
          ...gaps.map((k) => `• ${REQUIRED_FIELD_LABELS[k] ?? k}`),
        ].join("\n");

  /* The footer's primary action, shared by the button and its ⌘+Enter
     shortcut — the shortcut carries the same gate a click does. The button
     stays clickable (aria-disabled, not disabled) so a blocked attempt has
     somewhere to go: flag every gap in place. */
  const save = () => {
    if (!canSave) {
      setMissingKeys(new Set(gaps));
      return;
    }
    if (!isEditing && onCreate) onCreate(questionFromDraft(data, esComplete));
    onClose();
  };
  /* Opened as a sub-wizard over the Quiz step, this editor IS the `.qz-qwiz`
     layer, so it keeps the shortcut the Task wizard behind it gives up. */
  useWizardEnterShortcut(save, undefined, true, () =>
    Boolean(rootRef.current?.closest(".qz-qwiz")),
  );

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

  /* Figma 739:1504 titles the screen by type and carries no subtext — on an
     edit either. The versioning sentence that used to sit here (and the
     footer's "last saved · vN") is what View history is for. */
  const title = readOnly
    ? `${TYPE_TITLES[data.type]} Question · v${atVersion}`
    : `${isEditing ? "Edit" : "New"} ${TYPE_TITLES[data.type]} Question`;

  /* The Task wizard's two-column shell (.wizard-body: main pane + rail),
     mirrored — the question itself runs in the main pane on the LEFT with the
     wizard's own title/subtext header, and the settings rail sits on the
     right. The rail is not a step list, so it keeps its own controls and drops
     the card background for the wizard's plain bordered column. */
  return (
    <div className="wizard qed" ref={rootRef}>
      <div className="wizard-body">
        <div className="wizard-main">
          <div className="wizard-content">
            {/* Shared crumb row (.rvc-pagehead) — the editor is reached from
                the Question Bank, and "Question Bank" is also the way back out,
                so it stays a button; the question itself is the current crumb. */}
            <div className="rvc-pagehead qed-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <button
                  className="rvc-crumb"
                  onClick={onClose}
                  title={`Back to ${backLabel}`}
                >
                  {backLabel}
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">{title}</span>
              </nav>
              <h1 className="wizard-title qed-title-solo">{title}</h1>
            </div>

            {/* A disabled <fieldset> is what makes the past-version view
                read-only: the attribute propagates to every input, textarea
                and button inside it, so no control needs to know. The crumb
                and the footer sit outside it and stay live. */}
            <Lock on={readOnly}>
              <QuestionTextSection data={data} update={update} missing={missing} />

              {data.type === "mcq" && (
                <McqSection data={data} update={update} grading={grading} missing={missing} />
              )}
              {data.type === "true-false" && (
                <TrueFalseSection data={data} update={update} grading={grading} />
              )}
              {data.type === "match" && (
                <MatchSection data={data} update={update} missing={missing} />
              )}
              {data.type === "scale" && (
                <ScaleLabelsSection data={data} update={update} missing={missing} />
              )}

              {grading && <FeedbackSection data={data} update={update} />}
            </Lock>
          </div>
        </div>

        <aside className="qed-side">
          <Lock on={readOnly}>
            <SetupSection
              data={data}
              update={update}
              isEditing={isEditing}
              catOptions={catOptions}
              missing={missing}
              gradable={gradable}
              usedInQuizzes={usedInQuizzes}
            />

            {/* The switches follow the fields — they read as more of the same
                plain rail rows — and the type's own block closes the rail. Only
                Match shows both, so this order is only visible there. */}
            <OptionTogglesSection data={data} update={update} grading={grading} />

            {data.type === "match" && grading && (
              <MatchScoringSection data={data} update={update} />
            )}
            {data.type === "file" && <FileRulesSection data={data} update={update} />}
            {data.type === "scale" && <ScaleRangeSection data={data} update={update} />}
          </Lock>
        </aside>
      </div>

      {/* Footer (Figma 73:515) */}
      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          {isEditing && !readOnly && (
            <button className="btn-save-draft" onClick={() => setShowHistory(true)}>
              View history
            </button>
          )}
          <button
            className={`btn-publish${canSave ? "" : " is-disabled"}`}
            aria-disabled={!canSave}
            data-tip={blockedTip}
            onClick={save}
          >
            {isEditing ? "Save Changes" : "Create Question"}
            <WizardKeyHint />
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

/* Read-only wrapper for the past-version view. The fieldset only exists when
   the lock is on, so the ordinary editor's DOM — and every `>` selector that
   walks it — is untouched; `display: contents` keeps the locked one out of the
   box tree, and the CSS re-says the few child-combinator rules it does sit
   inside (see `.qed-lock` in index.css). */
function Lock({ on, children }: { on: boolean; children: React.ReactNode }) {
  if (!on) return <>{children}</>;
  return (
    <fieldset className="qed-lock" disabled>
      {children}
    </fieldset>
  );
}

/* ─────────────────  Sections  ───────────────── */

function SetupSection({
  data,
  update,
  isEditing,
  catOptions,
  missing,
  gradable,
  usedInQuizzes,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  isEditing: boolean;
  catOptions: { key: string; label: string }[];
  missing: ReadonlySet<string>;
  gradable: boolean;
  usedInQuizzes: number;
}) {
  /* Figma 955:976 reads "<name> · <qualifier>", so a category option is
     "<sub-category> · <category>" — a sub-category name is not unique on its
     own ("Heat Pumps" sits under two parents), the pair is. A top-level
     category has no qualifier and stands alone. */
  const catLabelOf = (key: string) => {
    const label = catOptions.find((o) => o.key === key)?.label;
    if (!label) return "";
    const [parent, sub] = label.split(" > ");
    return sub ? `${sub} · ${parent}` : parent;
  };
  const catSubOf = (label: string) => label.split(" · ")[0];
  const catParentOf = (label: string) => {
    const parent = label.split(" · ")[1];
    return parent ? `· ${parent}` : null;
  };

  const changeType = (t: QType) => {
    const gradable = typeSupportsGrading(t);
    const wasRandomisable = data.type === "mcq" || data.type === "match";
    const isRandomisable = t === "mcq" || t === "match";
    update({
      type: t,
      grading: gradable && !data.otherOption,
      // Keep the user's choice while moving between randomisable types;
      // otherwise fall back to that type's default (on for MCQ, off for Match,
      // whose answers already shuffle).
      randomise: isRandomisable ? (wasRandomisable ? data.randomise : t === "mcq") : false,
      otherOption: t === "mcq" ? data.otherOption : false,
    });
  };

  return (
    <>
      {/* The three fields every type has, in the order they're decided:
          the type first (it's what the rest of the screen is), then where the
          question files, then whether it scores. Grading sits in this same
          stack rather than down with the option switches — it is a field of
          the question, not a behaviour of its options. */}
      <div className="wizard-fields">
        <div className="form-group">
          <label className="form-label">
            Question Type <span className="req">*</span>
          </label>
          {/* Same single-select as Category, without the search header — six
              fixed types is a glance, not a lookup. */}
          <SelectField
            value={TYPE_LABELS[data.type]}
            disabled={isEditing}
            options={TYPE_ORDER.map((t) => TYPE_LABELS[t])}
            onChange={(label) => {
              const t = TYPE_BY_LABEL.get(label);
              if (t) changeType(t);
            }}
            className="select-field--full"
          />
          {isEditing && (
            <p className="form-help">Type can't change on a saved question.</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Category <span className="req">*</span>
          </label>
          {/* Searchable single-select (Figma 668:943) — the Question Bank runs
              to dozens of category / sub-category rows, so the picker filters. */}
          <SelectField
            value={catLabelOf(data.catKey)}
            options={catOptions.map((o) => catLabelOf(o.key))}
            onChange={(label) =>
              update({ catKey: catOptions.find((o) => catLabelOf(o.key) === label)?.key ?? "" })
            }
            optionPrimary={catSubOf}
            optionSecondary={catParentOf}
            placeholder="Select a Category…"
            searchPlaceholder="Search Categories…"
            className={`select-field--full${
              missing.has("category") ? " has-error" : ""
            }`}
          />
          {missing.has("category") ? (
            <p className="form-error-text">
              Pick a Category to create this question.
            </p>
          ) : (
            <p className="form-help">Where it goes in the Question Bank</p>
          )}
        </div>

        <GradingToggle
          data={data}
          update={update}
          gradable={gradable}
          usedInQuizzes={usedInQuizzes}
        />
      </div>
    </>
  );
}

function QuestionTextSection({
  data,
  update,
  missing,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  missing: ReadonlySet<string>;
}) {
  const flagged = missing.has("text");
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">
          Question <span className="req">*</span>
        </label>
        {/* Spanish is optional throughout — only the English row is required,
            and an untranslated question still saves. */}
        <RichTextField
          en={data.text}
          es={data.textEs}
          onChangeEn={(v) => update({ text: v })}
          onChangeEs={(v) => update({ textEs: v })}
          placeholderEn="Question Text…"
          placeholderEs="Texto de la pregunta…"
          error={flagged}
        />
        {flagged && (
          <p className="form-error-text">Write the question to create it.</p>
        )}
      </div>
    </div>
  );
}

/* Drag-to-reorder for the Options table (Figma 814:1679 draws a grip on every
   row). HTML5 drag, the same mechanic the Spotlights queue and the Edit Columns
   menu use — but the drag SOURCE is the grip, not the row: a draggable row
   swallows the caret and text selection inside the option's own inputs. The
   row is still the drop target, and the whole row is used as the drag image so
   what follows the cursor is the option, not the 16px handle. `dragRef`
   mirrors the dragged id so a drop landing in the same render tick reads it. */
function useRowDrag<T extends { id: string }>(
  rows: T[],
  onReorder: (next: T[]) => void,
) {
  const dragRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const end = () => {
    dragRef.current = null;
    setDragId(null);
    setOverId(null);
  };

  const drop = (targetId: string) => {
    const from = dragRef.current;
    if (from && from !== targetId) {
      const next = [...rows];
      const fromIdx = next.findIndex((r) => r.id === from);
      const toIdx = next.findIndex((r) => r.id === targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        onReorder(next);
      }
    }
    end();
  };

  return {
    /* Spread on the row — the drop target. */
    rowProps: (id: string) => ({
      onDragEnter: () => {
        if (dragRef.current) setOverId(id);
      },
      onDragOver: (e: React.DragEvent) => {
        // Without this the drop never fires: the default is "no drop here".
        if (dragRef.current) e.preventDefault();
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        drop(id);
      },
      className: `${dragId === id ? " is-dragging" : ""}${
        overId === id && dragId !== id ? " is-drop-target" : ""
      }`,
    }),
    /* Spread on the grip — the drag source. */
    gripProps: (id: string) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent<HTMLElement>) => {
        // Firefox refuses to start a drag with no payload.
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        const row = e.currentTarget.closest(".qed-tbl-row");
        if (row) e.dataTransfer.setDragImage(row, 24, row.clientHeight / 2);
        dragRef.current = id;
        setDragId(id);
      },
      onDragEnd: end,
      title: "Drag to reorder",
    }),
  };
}

function McqSection({
  data,
  update,
  grading,
  missing,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  grading: boolean;
  missing: ReadonlySet<string>;
}) {
  const choices = data.choices;

  const setChoice = (id: string, patch: Partial<Choice>) =>
    update({ choices: choices.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const addChoice = () => {
    if (choices.length >= MAX_OPTIONS) return;
    update({ choices: [...choices, blankChoice()] });
  };

  const removeChoice = (id: string) => {
    if (choices.length <= 2) return;
    update({ choices: choices.filter((c) => c.id !== id) });
  };

  /* Two is the floor — a one-option question has nothing to choose between.
     The ✕ on the last two rows says so rather than sitting dim and silent
     (`aria-disabled`, not `disabled`: a disabled button swallows the hover the
     tooltip listens for). */
  const atFloor = choices.length <= 2;
  const floorTip = "A question needs at least two options.";

  /* The grade travels with the option it belongs to — the letters are just
     positional labels, so moving an option re-letters the list around it. */
  const drag = useRowDrag(choices, (next) => update({ choices: next }));

  /* Figma 814:1679 "Create Question - MCQ" — one boxed table: an
     OPTION / GRADE header, a row per option (drag handle, letter, dual-language
     field, grade, remove), then a footer row holding the add CTA. */
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">
          Options <span className="req">*</span>
        </label>

        <div
          className={`qed-tbl${
            missing.has("options") || missing.has("answer") ? " has-error" : ""
          }`}
        >
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
                  <InfoIcon12 />
                </span>
              </span>
            )}
          </div>

          {choices.map((c, i) => {
            const { className: dragClass, ...rowDrag } = drag.rowProps(c.id);
            return (
            <div className={`qed-tbl-row${dragClass}`} key={c.id} {...rowDrag}>
              <span className="qed-tbl-ord">
                <span className="qed-tbl-grip" {...drag.gripProps(c.id)}>
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
                aria-disabled={atFloor}
                data-tip={atFloor ? floorTip : undefined}
                onClick={() => removeChoice(c.id)}
              >
                <SmallXIcon />
              </button>
            </div>
            );
          })}

          {!grading && data.otherOption && (
            /* Figma 1094:1183 — the "Other" row is a 44px caption line, not an
               option: "Other" over the 955:976 name-plus-qualifier pattern. No
               letter, no grade and no remove ✕ — the rail's toggle is what
               takes it away. The node's drag handle is dropped (Other is not in
               `choices`, so it has nothing to be reordered against); the row
               keeps its 20px gutter so "Other" stays in the letters' column. */
            <div className="qed-tbl-row qed-tbl-row--other">
              <span className="qed-tbl-other">
                <span className="qed-tbl-other-name">Other</span>
                <span className="qed-tbl-other-desc">
                  · Allows the user to type in their own answer
                </span>
              </span>
            </div>
          )}

          {/* Figma 1091:1178 (2026-09-10) — the footer's Primary CTA became a
              plain orange text link with a 16px plus. */}
          <div className="qed-tbl-foot">
            <button
              className="qed-tbl-add"
              onClick={addChoice}
              disabled={choices.length >= MAX_OPTIONS}
            >
              <PlusThinIcon />
              Add Option
            </button>
          </div>
        </div>

        {missing.has("options") ? (
          <p className="form-error-text">
            Fill in at least two options to create this question.
          </p>
        ) : missing.has("answer") ? (
          <p className="form-error-text">
            Grade one option above 0% so the question has a correct answer.
          </p>
        ) : (
          /* The two-option floor holds whether or not the question is graded,
             so it leads the subtext either way. */
          <p className="form-help">
            {grading
              ? "Minimum of 2 options are required. The total of all percentages must be 100%"
              : "Minimum of 2 options are required. Ungraded — responses are collected, not scored."}
          </p>
        )}
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
        <label className="form-label">
          Correct Answer <span className="req">*</span>
        </label>
        {/* Radio cards (Figma 134:1790 / 136:294), title only — the subtext
            under the group already says how the two values are scored, so a
            per-card note and a "Best score 100%" pill were saying it twice
            more. */}
        <div className="radio-card-group">
          {[true, false].map((val) => (
            <RadioCard
              key={String(val)}
              selected={grading && data.tfAnswer === val}
              disabled={!grading}
              onSelect={() => grading && update({ tfAnswer: val })}
              title={val ? "True" : "False"}
            />
          ))}
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
  missing,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  missing: ReadonlySet<string>;
}) {
  const pairs = data.pairs;
  const flagged = missing.has("pairs");
  const setPair = (id: string, patch: Partial<Pair>) =>
    update({ pairs: pairs.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const addPair = () => {
    if (pairs.length >= MAX_OPTIONS) return;
    update({ pairs: [...pairs, blankPair()] });
  };
  const removePair = (id: string) => {
    if (pairs.length <= MIN_PAIRS) return;
    update({ pairs: pairs.filter((p) => p.id !== id) });
  };

  const drag = useRowDrag(pairs, (next) => update({ pairs: next }));

  /* Three rows is the floor, not two: the field's own rule needs two complete
     pairs AND a third answer, so a two-row match could never be saved. The ✕
     says so rather than sitting dim (`aria-disabled`, not `disabled` — a
     disabled button swallows the hover the tooltip listens for). */
  const atFloor = pairs.length <= MIN_PAIRS;
  const floorTip = "A match needs at least three rows.";

  /* Figma 1198:1934 — the same boxed table as the MCQ options: a
     QUESTION / ANSWER header, a row per pair (grip, number, the two
     dual-language fields, remove) and the add CTA on the footer row. The
     arrow that used to sit between the two sides is gone with the loose-row
     layout, and so is the per-row "Distractor" pill — the subtext under the
     card explains distractors in words now. */
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">
          Questions &amp; Answers <span className="req">*</span>
        </label>

        <div className={`qed-tbl qed-tbl--pairs${flagged ? " has-error" : ""}`}>
          <div className="qed-tbl-hd">
            <span className="qed-tbl-ord" aria-hidden />
            <span className="qed-tbl-hd-opt">QUESTION</span>
            <span className="qed-tbl-hd-opt">ANSWER</span>
            <span className="qed-tbl-hd-x" aria-hidden />
          </div>

          {pairs.map((p, i) => {
            const { className: dragClass, ...rowDrag } = drag.rowProps(p.id);
            return (
              <div className={`qed-tbl-row${dragClass}`} key={p.id} {...rowDrag}>
                <span className="qed-tbl-ord">
                  <span className="qed-tbl-grip" {...drag.gripProps(p.id)}>
                    <MoveIcon />
                  </span>
                  <span className="qed-tbl-letter" aria-hidden>
                    {i + 1}
                  </span>
                </span>
                {/* The question carries the formatting — it can need a
                    fraction, a unit or an inline image, the same as the
                    question text above. The answer is a short label the
                    learner matches against, so it stays a plain input. */}
                <div className="qed-tbl-field">
                  <RichTextField
                    en={p.left}
                    es={p.leftEs}
                    onChangeEn={(v) => setPair(p.id, { left: v })}
                    onChangeEs={(v) => setPair(p.id, { leftEs: v })}
                    placeholderEn={`Question ${i + 1}…`}
                    placeholderEs={`Pregunta ${i + 1}…`}
                  />
                </div>
                <div className="qed-tbl-field">
                  <LangField
                    en={p.right}
                    es={p.rightEs}
                    onEn={(v) => setPair(p.id, { right: v })}
                    onEs={(v) => setPair(p.id, { rightEs: v })}
                    placeholder={`Answer ${i + 1}…`}
                    esPlaceholder={`Respuesta ${i + 1}…`}
                  />
                </div>
                <button
                  className="qed-tbl-x"
                  aria-label="Remove pair"
                  aria-disabled={atFloor}
                  data-tip={atFloor ? floorTip : undefined}
                  onClick={() => removePair(p.id)}
                >
                  <SmallXIcon />
                </button>
              </div>
            );
          })}

          <div className="qed-tbl-foot">
            <button
              className="qed-tbl-add"
              onClick={addPair}
              disabled={pairs.length >= MAX_OPTIONS}
            >
              <PlusThinIcon />
              Add Question-Answer Pair
            </button>
          </div>
        </div>

        {flagged ? (
          <p className="form-error-text">
            Add at least two questions and three answers to create this question.
          </p>
        ) : (
          <p className="form-help">
            You must provide at least two questions and three answers. You can
            provide extra wrong answers by giving an answer with a blank
            question. Entries where both the question and the answer are blank
            will be ignored.
          </p>
        )}
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
  /* Scoring reads as an ordinary field in the rail (same label as Category /
     Question Type), not as a section heading over the cards. */
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Scoring</label>
        <div className="radio-card-group">
          <RadioCard
            selected={data.matchGrading === "all-or-nothing"}
            onSelect={() => update({ matchGrading: "all-or-nothing" })}
            title="All or Nothing"
            desc="Every pair must be correct to score. A single wrong match gives 0% for the whole question."
          />
          <RadioCard
            selected={data.matchGrading === "partial"}
            onSelect={() => update({ matchGrading: "partial" })}
            title="Partial Credit"
            desc="Each correct match earns a proportional share of the mark."
          />
        </div>
      </div>
    </div>
  );
}

/** How many files a learner may attach: 1–10, plain numbers. */
const FILE_COUNT_STEPS = Array.from({ length: 10 }, (_, i) => String(i + 1));

/** How large each file may be. A size ladder, NOT the count's 1–10 — a 10 MB
 *  ceiling would reject most of what a learner photographs or scans. */
const FILE_SIZE_STEPS = ["5", "10", "25", "50", "100"];

/** Anything the list doesn't cover — a draft from an older shape of this field
 *  — reads as that field's own default. The list is the whole vocabulary;
 *  nothing else gets to appear in it. */
const limitValue = (steps: readonly string[], v: string, fallback: string) =>
  steps.includes(v) ? v : fallback;

/** The size field shows its unit — "5 MB", not "5" — while the draft keeps the
 *  plain number, so `fileRules.maxSizeMb` stays numeric. */
const sizeLabel = (v: string) => `${v} MB`;

function FileRulesSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  /* Two ordinary rail fields now — the same searchless SelectField as Question
     Type, at full width — so they don't need a heading over them: the wizards'
     rule is a flat label / control / subtext stack. The old "System default"
     row is gone with it; every question carries its own limits. */
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Maximum Files Allowed</label>
        <SelectField
          value={limitValue(FILE_COUNT_STEPS, data.maxFiles, "1")}
          options={FILE_COUNT_STEPS}
          onChange={(v) => update({ maxFiles: v })}
          className="select-field--full"
        />
        <p className="form-help">Default: 1</p>
      </div>
      <div className="form-group">
        <label className="form-label">Maximum File Size</label>
        <SelectField
          value={sizeLabel(limitValue(FILE_SIZE_STEPS, data.maxSizeMb, "5"))}
          options={FILE_SIZE_STEPS.map(sizeLabel)}
          onChange={(v) => update({ maxSizeMb: String(parseInt(v, 10)) })}
          className="select-field--full"
        />
        <p className="form-help">Default: 5MB</p>
      </div>
    </div>
  );
}

function ScaleRangeSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  /* The shared dropdown (Figma 591:1382), same control as Category and
     Question Type above it. Both ends take `select-field--full` and an even
     share of the row (`.qed-inline-fields`), so the pair fills the rail like
     the single fields above rather than shrinking to its widest option — which
     left slack on the right and made "1" narrower than "10". `menuWidth` is
     dropped with it: each menu now opens at its own trigger's width, the
     component's default and what Category and Question Type do. */
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Scale Range</label>
        <div className="qed-inline-fields">
          <SelectField
            value={String(data.scaleMin)}
            options={["0", "1"]}
            onChange={(v) => update({ scaleMin: Number(v) })}
            className="select-field--full"
          />
          <span className="qed-range-to">to</span>
          <SelectField
            value={String(data.scaleMax)}
            options={Array.from({ length: 9 }, (_, i) => String(i + 2))}
            onChange={(v) => update({ scaleMax: Number(v) })}
            className="select-field--full"
          />
        </div>
        <p className="form-help">Maximum and minimum value a user can pick</p>
      </div>
    </div>
  );
}

function ScaleLabelsSection({
  data,
  update,
  missing,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  missing: ReadonlySet<string>;
}) {
  /* Both labels are optional together — the gap is the half-labelled scale, so
     the flag lands on the end that is still blank. */
  const flagged = missing.has("scaleLabels");
  const minBlank = flagged && data.scaleMinLabel.trim() === "";
  const maxBlank = flagged && data.scaleMaxLabel.trim() === "";
  const pairTip = "Label both ends of the scale, or neither.";
  return (
    <div className="wizard-fields">
      <div className="form-group">
        <label className="form-label">Label for {data.scaleMin}</label>
        <LangField
          en={data.scaleMinLabel}
          es={data.scaleMinLabelEs}
          onEn={(v) => update({ scaleMinLabel: v })}
          onEs={(v) => update({ scaleMinLabelEs: v })}
          placeholder="e.g. Extremely disappointed"
          esPlaceholder="p. ej. Muy decepcionado"
          error={minBlank}
        />
        {minBlank ? (
          <p className="form-error-text">{pairTip}</p>
        ) : (
          <p className="form-help">Optional — shown at the low end of the scale.</p>
        )}
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
          error={maxBlank}
        />
        {maxBlank ? (
          <p className="form-error-text">{pairTip}</p>
        ) : (
          <p className="form-help">Optional — shown at the high end of the scale.</p>
        )}
      </div>
    </div>
  );
}

/* Grading is the third field in the Setup stack, so it is its own component —
   it renders a bare ToggleRow into that stack rather than a `.wizard-fields`
   block of its own. */
function GradingToggle({
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
  const sub = !gradable
    ? "Grading not supported"
    : lockedByQuizzes
      ? `Used in ${usedInQuizzes} quiz${usedInQuizzes === 1 ? "" : "zes"} — remove it from them first`
      : lockedByOther
        ? "Remove the “Other” option to enable"
        : "Required for use in Quizzes";

  return (
    <ToggleRow
      checked={grading}
      disabled={!gradable || lockedByQuizzes || lockedByOther}
      onChange={(v) => update({ grading: v })}
      label="Grading"
      sub={sub}
    />
  );
}

/* What's left at the foot of the rail once Grading has moved up: the switches
   that change how the type's own options behave. Figma 739:1504 runs them as a
   plain stack, no section heading. A type with neither renders nothing at all
   — an empty `.wizard-fields` would still take its margin. */
function OptionTogglesSection({
  data,
  update,
  grading,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  grading: boolean;
}) {
  const canRandomise = data.type === "mcq" || data.type === "match";
  const canOther = data.type === "mcq";
  if (!canRandomise && !canOther) return null;

  return (
    <div className="wizard-fields">
      {canRandomise && (
        <ToggleRow
          checked={data.randomise}
          onChange={(v) => update({ randomise: v })}
          label="Randomize Options"
          sub="New order on every attempt"
          info={
            data.type === "match"
              ? "Answers on the right are always shuffled. Enabling this shuffles the order in which options on the left appear too."
              : undefined
          }
        />
      )}
      {canOther && (
        <ToggleRow
          checked={data.otherOption}
          disabled={grading}
          onChange={(v) => update({ otherOption: v })}
          label="“Other” Free-Text Option"
          sub="User can enter an answer of their own"
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
  /* Partial credit needs more than one correct answer to divide, so the row is
     dead on a True/False question — it drops out rather than sitting there
     explaining itself. A single-answer MCQ keeps the disabled row: grading a
     second option above 0 brings it back, so the state is live there. */
  const noPartial = data.type === "true-false";
  const singleAnswer = data.type === "mcq" && !multiAnswer(data.choices);
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
          {!noPartial && (
            <FeedbackRow
              label="For Partially Correct Response"
              en={singleAnswer ? "" : data.fbPartial}
              es={singleAnswer ? "" : data.fbPartialEs}
              onEn={(v) => update({ fbPartial: v })}
              onEs={(v) => update({ fbPartialEs: v })}
              disabled={singleAnswer}
              placeholder={
                singleAnswer
                  ? "Only available for questions with MCQs with multiple correct answers"
                  : "Shown for a partially correct response…"
              }
              esPlaceholder="Se muestra en una respuesta parcialmente correcta…"
            />
          )}
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
      {/* The label dims with the field it names, so a row that can't be filled
          in reads as one control rather than a live label over a dead box. */}
      <span className={`qed-fb-label${disabled ? " is-disabled" : ""}`}>{label}</span>
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
                <InfoIcon12 />
              </span>
            )}
          </p>
        )}
      </div>
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
  /* A grade the steps don't cover (an imported question, say) joins the list
     rather than being silently rounded to one that is. */
  const opts = GRADE_OPTIONS.some((o) => Math.abs(o.value - value) < 0.001)
    ? GRADE_OPTIONS
    : [{ value, label: label(value) }, ...GRADE_OPTIONS];
  const byLabel = new Map(opts.map((o) => [o.label, o.value]));
  /* The shared single-select, like Category and Question Type. It works in
     display strings, so the percentage round-trips through its label — every
     one of them is distinct. Capped at 6 rows: the full list is 31 long and
     would otherwise fill the pane. */
  return (
    <SelectField
      value={label(value)}
      options={opts.map((o) => o.label)}
      onChange={(l) => {
        const v = byLabel.get(l);
        if (v !== undefined) onChange(v);
      }}
      /* Figma 1090:1153 "Dropdown Menu - Grade": a plain list, no search
         header, 8px inset and 35px rows at 16px, opening at the field's own
         92px. Capped at 6 rows so the 41 steps don't fill the pane. */
      maxVisibleOptions={6}
      panelClass="qed-grade-menu"
      className="qed-grade"
    />
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
  error,
}: {
  en: string;
  es: string;
  onEn: (v: string) => void;
  onEs: (v: string) => void;
  placeholder?: string;
  esPlaceholder?: string;
  disabled?: boolean;
  /** Mandatory and still empty after a blocked save — reddens the shell. */
  error?: boolean;
}) {
  return (
    <div
      className={`lang-field ${disabled ? "is-disabled" : ""}${
        error ? " has-error" : ""
      }`}
    >
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

