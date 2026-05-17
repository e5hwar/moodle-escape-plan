import { useEffect, useState } from "react";
import {
  type FeedbackForm,
  type Question,
  type QuestionOption,
  type ResponseType,
} from "../data/feedbackForms";
import { SmallXIcon, ImageIcon, DragHandleIcon } from "./icons";

type Props = {
  form: FeedbackForm;
  onSave: (questions: Question[]) => void;
};

const RESPONSE_TYPE_LABEL: Record<ResponseType, string> = {
  "single-select": "Multiple choice — single select",
  "multi-select": "Multiple choice — multi select",
  "short-answer": "Short answer",
  "file-upload": "File upload",
  "linear-scale": "Linear scale",
};

const TYPE_OPTIONS: ResponseType[] = [
  "single-select",
  "multi-select",
  "short-answer",
  "file-upload",
  "linear-scale",
];

function newId(prefix = "q"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function newQuestion(type: ResponseType = "single-select"): Question {
  const base: Question = {
    id: newId("q"),
    textEn: "",
    type,
    required: false,
  };
  return applyTypeDefaults(base, type);
}

function applyTypeDefaults(q: Question, type: ResponseType): Question {
  const cleared: Question = {
    id: q.id,
    textEn: q.textEn,
    textEs: q.textEs,
    mediaHint: q.mediaHint,
    type,
    required: q.required,
  };
  switch (type) {
    case "single-select":
    case "multi-select":
      return {
        ...cleared,
        options:
          q.options && q.options.length > 0
            ? q.options
            : [
                { id: newId("o"), textEn: "Option 1" },
                { id: newId("o"), textEn: "Option 2" },
              ],
        allowOther: q.allowOther ?? false,
      };
    case "short-answer":
      return { ...cleared, charLimit: 512 };
    case "file-upload":
      return {
        ...cleared,
        maxFiles: q.maxFiles ?? 1,
        maxFileSizeMb: q.maxFileSizeMb ?? 10,
      };
    case "linear-scale":
      return {
        ...cleared,
        scaleMin: q.scaleMin ?? 1,
        scaleMax: q.scaleMax ?? 5,
        scaleLabelMin: q.scaleLabelMin ?? "",
        scaleLabelMax: q.scaleLabelMax ?? "",
      };
  }
}

export function FeedbackFormEditor({ form, onSave }: Props) {
  const [questions, setQuestions] = useState<Question[]>(form.questions);
  const [activeId, setActiveId] = useState<string | null>(
    form.questions[0]?.id ?? null,
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setQuestions(form.questions);
    setDirty(false);
  }, [form.id]);

  function update(next: Question[]) {
    setQuestions(next);
    setDirty(true);
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    update(
      questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  }

  function addQuestion(after?: string) {
    const q = newQuestion();
    if (!after) {
      update([...questions, q]);
    } else {
      const idx = questions.findIndex((x) => x.id === after);
      const next = [...questions];
      next.splice(idx + 1, 0, q);
      update(next);
    }
    setActiveId(q.id);
  }

  function duplicateQuestion(id: string) {
    const idx = questions.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const src = questions[idx];
    const clone: Question = {
      ...src,
      id: newId("q"),
      options: src.options?.map((o) => ({ ...o, id: newId("o") })),
    };
    const next = [...questions];
    next.splice(idx + 1, 0, clone);
    update(next);
    setActiveId(clone.id);
  }

  function removeQuestion(id: string) {
    update(questions.filter((q) => q.id !== id));
    if (activeId === id) {
      setActiveId(questions[0]?.id ?? null);
    }
  }

  function moveQuestion(id: string, dir: -1 | 1) {
    const idx = questions.findIndex((q) => q.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    update(next);
  }

  function changeType(id: string, type: ResponseType) {
    update(
      questions.map((q) => (q.id === id ? applyTypeDefaults(q, type) : q)),
    );
  }

  function handleSave() {
    onSave(questions);
    setDirty(false);
  }

  if (questions.length === 0) {
    return (
      <div className="fb-editor">
        <div className="fb-empty fb-empty--centered">
          <div className="fb-empty-title">No questions yet</div>
          <div className="fb-empty-sub">
            Add your first question. You can change the response type at any
            time.
          </div>
          <button className="btn-publish" onClick={() => addQuestion()}>
            + Add question
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fb-editor">
      <div className="fb-editor-toolbar">
        <div className="fb-editor-toolbar-left">
          <span className="fb-editor-count">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </span>
          {dirty && (
            <span className="fb-editor-dirty">Unsaved changes</span>
          )}
        </div>
        <div className="fb-editor-toolbar-right">
          <button
            className="btn-save-draft"
            disabled={!dirty}
            onClick={() => {
              setQuestions(form.questions);
              setDirty(false);
            }}
          >
            Discard
          </button>
          <button
            className="btn-publish"
            disabled={!dirty}
            onClick={handleSave}
          >
            {form.status === "active" ? "Save (new version)" : "Save"}
          </button>
        </div>
      </div>

      <div className="fb-editor-list">
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            active={activeId === q.id}
            onActivate={() => setActiveId(q.id)}
            onChange={(patch) => updateQuestion(q.id, patch)}
            onChangeType={(t) => changeType(q.id, t)}
            onDelete={() => removeQuestion(q.id)}
            onDuplicate={() => duplicateQuestion(q.id)}
            onMoveUp={() => moveQuestion(q.id, -1)}
            onMoveDown={() => moveQuestion(q.id, +1)}
            canMoveUp={i > 0}
            canMoveDown={i < questions.length - 1}
          />
        ))}
        <button
          className="fb-add-question"
          onClick={() => addQuestion(questions[questions.length - 1]?.id)}
        >
          + Add question
        </button>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  active,
  onActivate,
  onChange,
  onChangeType,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  question: Question;
  index: number;
  active: boolean;
  onActivate: () => void;
  onChange: (patch: Partial<Question>) => void;
  onChangeType: (t: ResponseType) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div
      className={`fb-q-card ${active ? "is-active" : ""}`}
      onClick={onActivate}
    >
      <div className="fb-q-card-head">
        <span className="fb-q-num">{index + 1}</span>
        <span className="fb-q-drag" title="Reorder">
          <DragHandleIcon />
        </span>
        <select
          className="fb-q-type"
          value={question.type}
          onChange={(e) => onChangeType(e.target.value as ResponseType)}
          onClick={(e) => e.stopPropagation()}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {RESPONSE_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <div className="fb-q-head-actions">
          <button
            className="fb-q-mini-btn"
            disabled={!canMoveUp}
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp();
            }}
            title="Move up"
          >
            ▲
          </button>
          <button
            className="fb-q-mini-btn"
            disabled={!canMoveDown}
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown();
            }}
            title="Move down"
          >
            ▼
          </button>
          <button
            className="fb-q-mini-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title="Duplicate"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </button>
          <button
            className="fb-q-mini-btn fb-q-mini-btn--danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            <SmallXIcon />
          </button>
        </div>
      </div>

      <div className="fb-q-body">
        <textarea
          className="fb-q-text"
          placeholder="Question text (supports media)"
          value={question.textEn}
          onChange={(e) => onChange({ textEn: e.target.value })}
          rows={2}
        />
        <textarea
          className="fb-q-text fb-q-text--es"
          placeholder="Versión en español (optional)"
          value={question.textEs ?? ""}
          onChange={(e) => onChange({ textEs: e.target.value })}
          rows={2}
        />
        <button
          className="fb-q-media-btn"
          onClick={(e) => {
            e.stopPropagation();
            onChange({ mediaHint: question.mediaHint ? undefined : "media-attached.png" });
          }}
        >
          <ImageIcon />
          <span>{question.mediaHint ? "Remove media" : "Attach image / video"}</span>
        </button>

        <div className="fb-q-response">
          {question.type === "single-select" && (
            <ChoiceEditor question={question} onChange={onChange} kind="radio" />
          )}
          {question.type === "multi-select" && (
            <ChoiceEditor question={question} onChange={onChange} kind="check" />
          )}
          {question.type === "short-answer" && <ShortPreview />}
          {question.type === "file-upload" && (
            <FileEditor question={question} onChange={onChange} />
          )}
          {question.type === "linear-scale" && (
            <ScaleEditor question={question} onChange={onChange} />
          )}
        </div>
      </div>

      <div className="fb-q-card-foot">
        <label className="fb-q-toggle">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onChange({ required: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
          />
          <span>Required</span>
        </label>
      </div>
    </div>
  );
}

function ChoiceEditor({
  question,
  onChange,
  kind,
}: {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
  kind: "radio" | "check";
}) {
  const options = question.options ?? [];

  function updateOption(id: string, patch: Partial<QuestionOption>) {
    onChange({
      options: options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  }

  function addOption() {
    onChange({
      options: [
        ...options,
        { id: newId("o"), textEn: `Option ${options.length + 1}` },
      ],
    });
  }

  function removeOption(id: string) {
    onChange({ options: options.filter((o) => o.id !== id) });
  }

  return (
    <div className="fb-q-options">
      {options.map((o) => (
        <div key={o.id} className="fb-q-option">
          <span className={`fb-q-option-icon fb-q-option-icon--${kind}`} />
          <input
            className="fb-q-option-input"
            placeholder="Option text"
            value={o.textEn}
            onChange={(e) => updateOption(o.id, { textEn: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="fb-q-mini-btn fb-q-option-img"
            title="Attach image"
            onClick={(e) => {
              e.stopPropagation();
              updateOption(o.id, {
                imageHint: o.imageHint ? undefined : "option-img.png",
              });
            }}
          >
            <ImageIcon />
          </button>
          <button
            className="fb-q-mini-btn"
            title="Remove option"
            onClick={(e) => {
              e.stopPropagation();
              removeOption(o.id);
            }}
          >
            <SmallXIcon />
          </button>
        </div>
      ))}
      {question.allowOther && (
        <div className="fb-q-option fb-q-option--other">
          <span className={`fb-q-option-icon fb-q-option-icon--${kind}`} />
          <span className="fb-q-option-other">Other…</span>
          <button
            className="fb-q-mini-btn"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ allowOther: false });
            }}
            title="Remove 'Other'"
          >
            <SmallXIcon />
          </button>
        </div>
      )}
      <div className="fb-q-options-actions">
        <button
          className="fb-q-add-option"
          onClick={(e) => {
            e.stopPropagation();
            addOption();
          }}
        >
          + Add option
        </button>
        {!question.allowOther && (
          <button
            className="fb-q-add-other"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ allowOther: true });
            }}
          >
            + Add "Other"
          </button>
        )}
      </div>
    </div>
  );
}

function ShortPreview() {
  return (
    <div className="fb-q-short-preview">
      <span className="fb-q-short-line">Short-answer text · max 512 characters</span>
    </div>
  );
}

function FileEditor({
  question,
  onChange,
}: {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}) {
  return (
    <div className="fb-q-file">
      <div className="fb-q-file-row">
        <label className="form-sub-label">Max files</label>
        <input
          className="form-input fb-q-file-input"
          type="number"
          min={1}
          max={10}
          value={question.maxFiles ?? 1}
          onChange={(e) =>
            onChange({ maxFiles: Math.max(1, Number(e.target.value) || 1) })
          }
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="fb-q-file-row">
        <label className="form-sub-label">Max size per file (MB)</label>
        <input
          className="form-input fb-q-file-input"
          type="number"
          min={1}
          max={500}
          value={question.maxFileSizeMb ?? 10}
          onChange={(e) =>
            onChange({
              maxFileSizeMb: Math.max(1, Number(e.target.value) || 10),
            })
          }
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

function ScaleEditor({
  question,
  onChange,
}: {
  question: Question;
  onChange: (patch: Partial<Question>) => void;
}) {
  const min = question.scaleMin ?? 1;
  const max = question.scaleMax ?? 5;
  const points: number[] = [];
  for (let i = min; i <= max && points.length < 11; i++) points.push(i);

  return (
    <div className="fb-q-scale">
      <div className="fb-q-scale-bounds">
        <div className="fb-q-scale-bound">
          <label className="form-sub-label">From</label>
          <select
            className="fb-q-scale-select"
            value={min}
            onChange={(e) => onChange({ scaleMin: Number(e.target.value) })}
            onClick={(e) => e.stopPropagation()}
          >
            {[0, 1].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="fb-q-scale-bound">
          <label className="form-sub-label">To</label>
          <select
            className="fb-q-scale-select"
            value={max}
            onChange={(e) => onChange({ scaleMax: Number(e.target.value) })}
            onClick={(e) => e.stopPropagation()}
          >
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="fb-q-scale-labels">
        <div className="fb-q-scale-label">
          <span className="fb-q-scale-point">{min}</span>
          <input
            className="form-input"
            placeholder="Lower label (optional)"
            value={question.scaleLabelMin ?? ""}
            onChange={(e) => onChange({ scaleLabelMin: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="fb-q-scale-label">
          <span className="fb-q-scale-point">{max}</span>
          <input
            className="form-input"
            placeholder="Upper label (optional)"
            value={question.scaleLabelMax ?? ""}
            onChange={(e) => onChange({ scaleLabelMax: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
      <div className="fb-q-scale-preview">
        {points.map((p) => (
          <div key={p} className="fb-q-scale-tick">
            <span className="fb-q-scale-tick-dot" />
            <span className="fb-q-scale-tick-num">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
