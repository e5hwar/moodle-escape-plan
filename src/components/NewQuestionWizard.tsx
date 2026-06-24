import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  categories as seedCategories,
  type Question,
  type QuestionType,
} from "../data/questionBank";
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

/* ─────────────────  Types  ───────────────── */

type QType = "true-false" | "mcq" | "match";

// Every authored text field is bilingual — English with an optional Spanish translation.
type Bi = { en: string; es: string };
const emptyBi = (): Bi => ({ en: "", es: "" });
const isBlankBi = (b: Bi) => b.en.trim() === "" && b.es.trim() === "";

type Choice = { id: string; text: Bi; grade: number };
type Pair = { id: string; left: Bi; right: Bi };
type MatchGrading = "all-or-nothing" | "partial";

type QuestionDraft = {
  type: QType;
  categoryKey: string;
  subKey: string;
  name: string; // internal label — not learner-facing, so single language
  text: Bi;
  // MCQ
  choices: Choice[];
  // True/False
  tfAnswer: boolean;
  // Match the Following
  pairs: Pair[];
  matchGrading: MatchGrading;
  // Shared
  randomise: boolean;
  feedbackCorrect: Bi;
  feedbackPartial: Bi;
  feedbackIncorrect: Bi;
  status: "Active" | "Draft";
};

const MAX_OPTIONS = 10;

const TYPE_META: Record<
  QType,
  { label: string; badge: string; desc: string }
> = {
  "true-false": {
    label: "True / False",
    badge: "TRUE / FALSE",
    desc: "A statement the learner marks True or False.",
  },
  mcq: {
    label: "Multiple Choice",
    badge: "MULTIPLE CHOICE",
    desc: "One or more correct options. Single vs. multiple answer is determined by the per-option grades.",
  },
  match: {
    label: "Match the Following",
    badge: "MATCH",
    desc: "Learners pair each prompt with its correct answer.",
  },
};

/* Moodle's fixed grade dropdown — a percentage share of the question's mark. */
const GRADE_STEPS = [
  100, 90, 83.33333, 80, 75, 70, 66.66667, 60, 50, 40, 33.33333, 30, 25, 20,
  16.66667, 14.28571, 12.5, 11.11111, 10, 5,
];

function fmtPct(v: number): string {
  if (v === 0) return "None";
  const rounded = Math.round(v * 1000) / 1000;
  return `${rounded}%`;
}

const GRADE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "None" },
  ...GRADE_STEPS.map((v) => ({ value: v, label: fmtPct(v) })),
  ...GRADE_STEPS.map((v) => ({ value: -v, label: fmtPct(-v) })),
];

function gradeLabel(v: number): string {
  const found = GRADE_OPTIONS.find((o) => Math.abs(o.value - v) < 0.001);
  return found ? found.label : fmtPct(v);
}

/* ─────────────────  Initial state  ───────────────── */

function resolveInitialCategory(path?: string[]): {
  categoryKey: string;
  subKey: string;
} {
  if (!path || path.length === 0) return { categoryKey: "", subKey: "" };
  const cat = seedCategories.find((c) => c.label === path[0]);
  if (!cat) return { categoryKey: "", subKey: "" };
  if (path[1]) {
    const sub = cat.subcategories?.find((s) => s.label === path[1]);
    return { categoryKey: cat.key, subKey: sub?.key ?? "" };
  }
  return { categoryKey: cat.key, subKey: "" };
}

let seq = 0;
const uid = (p: string) => `${p}-${seq++}`;

function blankChoice(grade = 0): Choice {
  return { id: uid("c"), text: emptyBi(), grade };
}
function blankPair(): Pair {
  return { id: uid("p"), left: emptyBi(), right: emptyBi() };
}

function editorTypeFromStored(t: QuestionType): QType {
  if (t === "True/False") return "true-false";
  if (t === "Match the following") return "match";
  return "mcq";
}

function buildInitial(
  initialCategoryPath?: string[],
  editing?: Question,
): QuestionDraft {
  // When editing, derive the category from the stored question's path.
  const { categoryKey, subKey } = resolveInitialCategory(
    editing ? editing.categoryPath : initialCategoryPath,
  );
  return {
    type: editing ? editorTypeFromStored(editing.type) : "mcq",
    categoryKey,
    subKey,
    name: editing ? editing.id : "",
    // Stored questions only carry the English question text; options, grades,
    // and feedback aren't persisted in the mock data so they start blank.
    text: editing ? { en: editing.text, es: "" } : emptyBi(),
    choices: [blankChoice(100), blankChoice(), blankChoice(), blankChoice()],
    tfAnswer: true,
    pairs: [blankPair(), blankPair(), blankPair()],
    matchGrading: "all-or-nothing",
    randomise: true,
    feedbackCorrect: emptyBi(),
    feedbackPartial: emptyBi(),
    feedbackIncorrect: emptyBi(),
    status: editing ? (editing.status === "Active" ? "Active" : "Draft") : "Active",
  };
}

/* ─────────────────  Wizard shell  ───────────────── */

type Props = {
  onClose: () => void;
  initialCategoryPath?: string[];
  editingQuestion?: Question;
};

export function NewQuestionWizard({
  onClose,
  initialCategoryPath,
  editingQuestion,
}: Props) {
  const isEditing = !!editingQuestion;
  const [data, setData] = useState<QuestionDraft>(() =>
    buildInitial(initialCategoryPath, editingQuestion),
  );
  const update = (patch: Partial<QuestionDraft>) =>
    setData((d) => ({ ...d, ...patch }));

  const isMcq = data.type === "mcq";
  const isMatch = data.type === "match";

  // Highest attainable mark — sum of positive option grades (capped at 100 in Moodle).
  const positiveTotal = useMemo(() => {
    if (!isMcq) return 0;
    return data.choices
      .filter((c) => c.grade > 0)
      .reduce((n, c) => n + c.grade, 0);
  }, [isMcq, data.choices]);

  return (
    <div className="wizard">
      <div className="wizard-content qe-single-page">
        <div className="qe-topbar">
          <div className="wizard-breadcrumb">
            <button className="wizard-back-btn" onClick={onClose}>
              <ChevronLeftIcon />
              BACK
            </button>
            <span className="sep">/</span>
            <span className="wizard-current">
              {isEditing ? `EDIT QUESTION · ${editingQuestion!.id}` : "NEW QUESTION"}
            </span>
          </div>
        </div>

        <div className="qe-form">
          {isEditing && (
            <div className="qe-edit-banner">
              <span className="qe-edit-banner-icon"><InfoIcon /></span>
              <div className="qe-edit-banner-text">
                Saving changes creates a <strong>new version</strong> of this
                question (current is v{editingQuestion!.version}). Quizzes using it
                move to the new version; past attempts keep the version they were
                taken with.
              </div>
            </div>
          )}

          <TypeAndCategorySection data={data} update={update} />
          <div className="form-divider" />

          <Section
            title="Question text"
            desc="What the learner sees. Supports rich text and embedded images, audio, and video."
          >
            <BiRichText
              value={data.text}
              onChange={(v) => update({ text: v })}
              placeholder="Type the question…"
            />
          </Section>
          <div className="form-divider" />

          {data.type === "true-false" ? (
            <TrueFalseSection data={data} update={update} />
          ) : isMatch ? (
            <MatchSection data={data} update={update} />
          ) : (
            <ChoicesSection
              data={data}
              update={update}
              positiveTotal={positiveTotal}
            />
          )}

          <div className="form-divider" />
          <FeedbackSection data={data} update={update} />

          <div className="form-divider" />
          <SettingsSection data={data} update={update} />
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="wizard-actions">
          <button className="btn-save-draft" onClick={onClose}>
            Save as draft
          </button>
          <button className="btn-publish" onClick={onClose}>
            {isEditing ? "Save changes" : "Save question"}
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────  Sections  ───────────────── */

function TypeAndCategorySection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  const cat = seedCategories.find((c) => c.key === data.categoryKey);
  const types: QType[] = ["true-false", "mcq", "match"];

  return (
    <Section
      title="Question type"
      desc="Pick how this question is answered and graded. This can't be changed after answers are added on a live question."
    >
      <div className="qe-type-grid">
        {types.map((t) => (
          <RadioCard
            key={t}
            selected={data.type === t}
            onSelect={() => update({ type: t })}
            title={TYPE_META[t].label}
            desc={TYPE_META[t].desc}
          />
        ))}
      </div>

      <div className="qe-category-row">
        <div className="qe-field">
          <label className="form-sub-label">Category</label>
          <SelectBox
            value={data.categoryKey}
            onChange={(v) => update({ categoryKey: v, subKey: "" })}
            options={[
              { value: "", label: "Uncategorized" },
              ...seedCategories.map((c) => ({ value: c.key, label: c.label })),
            ]}
          />
        </div>
        <div className="qe-field">
          <label className="form-sub-label">Subcategory</label>
          <SelectBox
            value={data.subKey}
            onChange={(v) => update({ subKey: v })}
            disabled={!cat?.subcategories?.length}
            options={[
              { value: "", label: cat?.subcategories?.length ? "None" : "—" },
              ...(cat?.subcategories ?? []).map((s) => ({
                value: s.key,
                label: s.label,
              })),
            ]}
          />
        </div>
        <div className="qe-field qe-field--name">
          <label className="form-sub-label">
            Question name <span className="qe-optional">optional</span>
          </label>
          <input
            className="qe-text-input"
            value={data.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Internal label, e.g. EPA-608 leak rate"
          />
        </div>
      </div>
    </Section>
  );
}

function TrueFalseSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  return (
    <Section
      title="Correct answer"
      desc="Pick the correct value. The correct option is graded 100%; the other is 0%."
    >
      <div className="qe-tf-group">
        <button
          className={`qe-tf-card ${data.tfAnswer ? "selected" : ""}`}
          onClick={() => update({ tfAnswer: true })}
        >
          <span className="radio-dot" />
          <span className="qe-tf-label">True</span>
          {data.tfAnswer && <span className="qe-grade-tag">100%</span>}
        </button>
        <button
          className={`qe-tf-card ${!data.tfAnswer ? "selected" : ""}`}
          onClick={() => update({ tfAnswer: false })}
        >
          <span className="radio-dot" />
          <span className="qe-tf-label">False</span>
          {!data.tfAnswer && <span className="qe-grade-tag">100%</span>}
        </button>
      </div>
    </Section>
  );
}

function ChoicesSection({
  data,
  update,
  positiveTotal,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
  positiveTotal: number;
}) {
  const choices = data.choices;

  const setChoice = (id: string, patch: Partial<Choice>) =>
    update({
      choices: choices.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  const addChoice = () => {
    if (choices.length >= MAX_OPTIONS) return;
    update({ choices: [...choices, blankChoice()] });
  };
  const removeChoice = (id: string) => {
    if (choices.length <= 2) return;
    update({ choices: choices.filter((c) => c.id !== id) });
  };

  const totalOff =
    positiveTotal !== 0 && Math.abs(positiveTotal - 100) > 0.01;

  return (
    <Section
      title="Answer options"
      desc="Grade each option. One correct option at 100% makes a single-answer question; several positive options that add up to 100% make a multiple-answer question. Wrong options can carry a negative grade so picking them costs marks."
    >
      <div className="qe-options">
        {choices.map((c, i) => (
          <div className="qe-option-row" key={c.id}>
            <span className="qe-option-handle" aria-hidden>
              <DragHandleIcon />
            </span>
            <span className="qe-option-letter">
              {String.fromCharCode(65 + i)}
            </span>
            <div className="qe-option-main">
              <BiRichText
                value={c.text}
                onChange={(v) => setChoice(c.id, { text: v })}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                compact
              />
            </div>
            <div className="qe-option-grade">
              <label className="qe-grade-caption">Grade</label>
              <GradeSelect
                value={c.grade}
                onChange={(v) => setChoice(c.id, { grade: v })}
              />
            </div>
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
      </div>

      <div className="qe-options-foot">
        <button
          className="qe-add-btn"
          onClick={addChoice}
          disabled={choices.length >= MAX_OPTIONS}
        >
          + Add option
        </button>
        <div className="qe-options-meta">
          {choices.length}/{MAX_OPTIONS} options
          {positiveTotal !== 0 && (
            <span className={`qe-total ${totalOff ? "is-warn" : ""}`}>
              · correct total {fmtPct(positiveTotal)}
            </span>
          )}
        </div>
      </div>

      {totalOff && (
        <p className="form-help error">
          Correct options add up to {fmtPct(positiveTotal)}. For full marks they
          should total 100%.
        </p>
      )}
    </Section>
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
    <>
      <Section
        title="Pairs"
        desc="Each row pairs a prompt with its answer. Leave the prompt blank to add an extra wrong answer (distractor) that belongs to no prompt."
      >
        <div className="qe-pair-head">
          <span>Prompt</span>
          <span>Matches with</span>
        </div>
        <div className="qe-options">
          {pairs.map((p, i) => {
            const isDistractor = isBlankBi(p.left) && !isBlankBi(p.right);
            return (
              <div className="qe-pair-row" key={p.id}>
                <span className="qe-option-letter">{i + 1}</span>
                <div className="qe-pair-fields">
                  <div className="qe-pair-field">
                    <BiRichText
                      value={p.left}
                      onChange={(v) => setPair(p.id, { left: v })}
                      placeholder="Prompt (blank = distractor)"
                      compact
                    />
                    {isDistractor && (
                      <span className="qe-distractor-tag">Distractor</span>
                    )}
                  </div>
                  <span className="qe-pair-arrow">→</span>
                  <div className="qe-pair-field">
                    <BiRichText
                      value={p.right}
                      onChange={(v) => setPair(p.id, { right: v })}
                      placeholder="Answer"
                      compact
                    />
                  </div>
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
        <div className="qe-options-foot">
          <button
            className="qe-add-btn"
            onClick={addPair}
            disabled={pairs.length >= MAX_OPTIONS}
          >
            + Add pair
          </button>
          <div className="qe-options-meta">
            {pairs.length}/{MAX_OPTIONS} rows
          </div>
        </div>
      </Section>

      <div className="form-divider" />

      <Section
        title="Grading"
        desc="How partial answers are scored."
      >
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
      </Section>
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
  return (
    <Section
      title="Combined feedback"
      desc="Shown to the learner after submission, depending on the Quiz's review settings."
    >
      <div className="qe-feedback-field">
        <label className="form-sub-label qe-fb-label qe-fb-correct">
          For any correct response
        </label>
        <BiRichText
          value={data.feedbackCorrect}
          onChange={(v) => update({ feedbackCorrect: v })}
          placeholder="e.g. Correct — R-410A is an HFC blend."
          compact
        />
      </div>
      <div className="qe-feedback-field">
        <label className="form-sub-label qe-fb-label qe-fb-partial">
          For any partially correct response
        </label>
        <BiRichText
          value={data.feedbackPartial}
          onChange={(v) => update({ feedbackPartial: v })}
          placeholder="e.g. You got some of these right — review the rest."
          compact
        />
      </div>
      <div className="qe-feedback-field">
        <label className="form-sub-label qe-fb-label qe-fb-incorrect">
          For any incorrect response
        </label>
        <BiRichText
          value={data.feedbackIncorrect}
          onChange={(v) => update({ feedbackIncorrect: v })}
          placeholder="e.g. Not quite — revisit the refrigerant classes."
          compact
        />
      </div>
    </Section>
  );
}

function SettingsSection({
  data,
  update,
}: {
  data: QuestionDraft;
  update: (p: Partial<QuestionDraft>) => void;
}) {
  const canRandomise = data.type === "mcq" || data.type === "match";

  return (
    <Section title="Settings" desc="Per-question options.">
      {canRandomise && (
        <Toggle
          checked={data.randomise}
          onChange={(v) => update({ randomise: v })}
          label="Shuffle options"
          sub="Each attempt shows the options in a different random order. Independent of question-order shuffling on the Quiz."
        />
      )}
      <Toggle
        checked={data.status === "Active"}
        onChange={(v) => update({ status: v ? "Active" : "Draft" })}
        label="Active"
        sub="Active questions can be added to Quizzes. Drafts are saved but not selectable yet."
      />
    </Section>
  );
}

/* ─────────────────  Primitives  ───────────────── */

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section">
      <h2 className="form-section-title">{title}</h2>
      {desc && <p className="form-section-desc">{desc}</p>}
      {children}
    </section>
  );
}

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

function Toggle({
  checked,
  onChange,
  label,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
}) {
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <div className="toggle-label">{label}</div>
        {sub && <div className="toggle-sub">{sub}</div>}
      </div>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
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
      <select
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
  return (
    <div
      className={`qe-select qe-grade-select ${
        value > 0 ? "is-pos" : value < 0 ? "is-neg" : ""
      }`}
    >
      <select
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {GRADE_OPTIONS.map((o) => (
          <option key={o.label} value={String(o.value)}>
            {gradeLabel(o.value)}
          </option>
        ))}
      </select>
      <span className="qe-select-caret">▾</span>
    </div>
  );
}

/* Bilingual rich text — toolbar appears on the focused language. Mirrors the Task wizard's RTE. */
function BiRichText({
  value,
  onChange,
  placeholder,
  compact,
}: {
  value: Bi;
  onChange: (v: Bi) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [focus, setFocus] = useState<null | "en" | "es">(null);
  return (
    <div className={`rte-field ${compact ? "rte-field--compact" : ""}`}>
      {focus === "en" && <RteToolbar />}
      <AutoTextarea
        className="rte-area"
        value={value.en}
        placeholder={placeholder}
        onChange={(v) => onChange({ ...value, en: v })}
        onFocus={() => setFocus("en")}
        onBlur={() => setFocus(null)}
      />
      <div className="rte-field-divider" />
      {focus === "es" && <RteToolbar />}
      <div className="rte-lang-row">
        <AutoTextarea
          className="rte-area"
          value={value.es}
          placeholder="Español (opcional)"
          onChange={(v) => onChange({ ...value, es: v })}
          onFocus={() => setFocus("es")}
          onBlur={() => setFocus(null)}
        />
        <span className="lang-tag floating">ESPAÑOL</span>
      </div>
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
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
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
      rows={1}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
