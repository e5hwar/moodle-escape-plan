import { useMemo, useState } from "react";
import {
  type FeedbackForm,
  type FormQuestionLink,
} from "../data/feedbackForms";
import {
  shortQuestionType,
  type Question,
  type QuestionType,
} from "../data/questionBank";
import { SearchIcon, SmallXIcon, CheckIcon, AddIcon } from "./icons";

type Props = {
  form: FeedbackForm;
  bank: Question[];
  onUpdate: (links: FormQuestionLink[]) => void;
  onCreateQuestion: () => void;
};

const TODAY = "2026-07-09";

export function FeedbackFormEditor({ form, bank, onUpdate, onCreateQuestion }: Props) {
  const [picking, setPicking] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const actives = form.questions.filter((l) => l.status === "active");
  const inactives = form.questions.filter((l) => l.status === "inactive");

  // Keep the array normalized as [active links in display order, inactive links].
  function commit(nextActives: FormQuestionLink[], nextInactives: FormQuestionLink[]) {
    onUpdate([...nextActives, ...nextInactives]);
  }

  function moveActive(questionId: string, dir: -1 | 1) {
    const idx = actives.findIndex((l) => l.questionId === questionId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= actives.length) return;
    const next = [...actives];
    [next[idx], next[target]] = [next[target], next[idx]];
    commit(next, inactives);
  }

  function setMandatory(questionId: string, mandatory: boolean) {
    onUpdate(
      form.questions.map((l) =>
        l.questionId === questionId ? { ...l, mandatory } : l,
      ),
    );
  }

  function removeLink(questionId: string) {
    if (form.status === "draft") {
      // Draft forms were never shown to users — no responses to preserve.
      onUpdate(form.questions.filter((l) => l.questionId !== questionId));
      return;
    }
    const l = actives.find((x) => x.questionId === questionId);
    if (!l) return;
    commit(
      actives.filter((x) => x.questionId !== questionId),
      [...inactives, { ...l, status: "inactive", deactivatedAt: TODAY }],
    );
  }

  function reactivateLink(questionId: string) {
    const l = inactives.find((x) => x.questionId === questionId);
    if (!l) return;
    commit(
      [...actives, { ...l, status: "active", deactivatedAt: undefined }],
      inactives.filter((x) => x.questionId !== questionId),
    );
  }

  function linkQuestion(q: Question) {
    if (form.questions.some((l) => l.questionId === q.id)) return;
    commit(
      [...actives, { questionId: q.id, mandatory: false, status: "active", linkedAt: TODAY }],
      inactives,
    );
  }

  return (
    <div className="fb-editor">
      <div className="fb-link-banner">
        <strong>Questions live in the Question Bank.</strong> This form links
        them — editing a question in the bank updates every quiz and form that
        uses it. Grading data on linked questions is ignored here; responses
        are collected without scoring.
      </div>

      <div className="fb-editor-toolbar">
        <div className="fb-editor-toolbar-left">
          <span className="fb-editor-count">
            {actives.length} active question{actives.length === 1 ? "" : "s"}
            {inactives.length > 0 && (
              <span className="fb-faint"> · {inactives.length} inactive</span>
            )}
          </span>
        </div>
        <div className="fb-editor-toolbar-right">
          <button className="btn-publish" onClick={() => setPicking(true)}>
            <AddIcon /> Link questions
          </button>
        </div>
      </div>

      {actives.length === 0 ? (
        <div className="fb-empty fb-empty--centered">
          <div className="fb-empty-title">No questions linked yet</div>
          <div className="fb-empty-sub">
            Link questions from the Question Bank, order them, and mark the
            ones a user must answer if they choose to submit.
          </div>
          <button className="btn-publish" onClick={() => setPicking(true)}>
            + Link questions
          </button>
        </div>
      ) : (
        <div className="fb-link-list">
          {actives.map((l, i) => (
            <LinkRow
              key={l.questionId}
              link={l}
              question={byId.get(l.questionId)}
              index={i}
              expanded={expandedId === l.questionId}
              onToggleExpand={() =>
                setExpandedId(expandedId === l.questionId ? null : l.questionId)
              }
              onMoveUp={i > 0 ? () => moveActive(l.questionId, -1) : undefined}
              onMoveDown={
                i < actives.length - 1
                  ? () => moveActive(l.questionId, +1)
                  : undefined
              }
              onSetMandatory={(v) => setMandatory(l.questionId, v)}
              onRemove={() => removeLink(l.questionId)}
              removeTitle={
                form.status === "draft"
                  ? "Unlink from this draft"
                  : "Mark Inactive — stops appearing in future prompts; collected responses are preserved"
              }
            />
          ))}
        </div>
      )}

      {inactives.length > 0 && (
        <div className="fb-inactive-section">
          <div className="fb-inactive-head">
            <h3 className="fb-section-title">Inactive questions</h3>
            <p className="fb-section-sub">
              No longer shown to users. The questions and all responses already
              collected against them remain attached to this form.
            </p>
          </div>
          <div className="fb-link-list">
            {inactives.map((l) => (
              <LinkRow
                key={l.questionId}
                link={l}
                question={byId.get(l.questionId)}
                inactive
                expanded={expandedId === l.questionId}
                onToggleExpand={() =>
                  setExpandedId(expandedId === l.questionId ? null : l.questionId)
                }
                onReactivate={() => reactivateLink(l.questionId)}
              />
            ))}
          </div>
        </div>
      )}

      {picking && (
        <QuestionPickerModal
          form={form}
          bank={bank}
          onLink={linkQuestion}
          onCreateQuestion={onCreateQuestion}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

function LinkRow({
  link,
  question,
  index,
  inactive,
  expanded,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onSetMandatory,
  onRemove,
  removeTitle,
  onReactivate,
}: {
  link: FormQuestionLink;
  question?: Question;
  index?: number;
  inactive?: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onSetMandatory?: (v: boolean) => void;
  onRemove?: () => void;
  removeTitle?: string;
  onReactivate?: () => void;
}) {
  if (!question) {
    return (
      <div className="fb-link-row is-missing">
        <div className="fb-link-main">
          <div className="fb-link-text fb-faint">
            {link.questionId} — question not found in the Question Bank
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`fb-link-row ${inactive ? "is-inactive" : ""}`}>
      <div className="fb-link-head" onClick={onToggleExpand}>
        {!inactive && <span className="fb-q-num">{(index ?? 0) + 1}</span>}
        <div className="fb-link-main">
          <div className="fb-link-text">{question.text}</div>
          <div className="fb-link-meta">
            <span className="fb-link-id">{question.id}</span>
            <span className="fb-link-chip">{shortQuestionType(question.type)}</span>
            <span className="fb-link-chip">
              {question.categoryPath[question.categoryPath.length - 1]}
            </span>
            <span className="fb-link-id">v{question.version}</span>
            {question.gradingEnabled && (
              <span
                className="fb-link-chip fb-link-chip--graded"
                title="This question carries grading data — it is ignored in Feedback Forms"
              >
                Graded · ignored here
              </span>
            )}
            {question.hasSpanish && <span className="fb-link-chip">EN·ES</span>}
            {inactive && link.deactivatedAt && (
              <span className="fb-link-id">inactive since {link.deactivatedAt}</span>
            )}
          </div>
        </div>
        <div className="fb-link-actions" onClick={(e) => e.stopPropagation()}>
          {!inactive && onSetMandatory && (
            <label className="fb-q-toggle" title="If the user chooses to submit, they must answer this question. Dismissing the whole form is always allowed.">
              <input
                type="checkbox"
                checked={link.mandatory}
                onChange={(e) => onSetMandatory(e.target.checked)}
              />
              <span>Mandatory</span>
            </label>
          )}
          {!inactive && (
            <>
              <button
                className="fb-q-mini-btn"
                disabled={!onMoveUp}
                onClick={onMoveUp}
                title="Move up"
              >
                ▲
              </button>
              <button
                className="fb-q-mini-btn"
                disabled={!onMoveDown}
                onClick={onMoveDown}
                title="Move down"
              >
                ▼
              </button>
              <button
                className="fb-q-mini-btn fb-q-mini-btn--danger"
                onClick={onRemove}
                title={removeTitle}
              >
                <SmallXIcon />
              </button>
            </>
          )}
          {inactive && (
            <button className="btn-save-draft fb-reactivate-btn" onClick={onReactivate}>
              Reactivate
            </button>
          )}
        </div>
      </div>
      {expanded && <LinkDetail question={question} />}
    </div>
  );
}

function LinkDetail({ question }: { question: Question }) {
  return (
    <div className="fb-link-detail">
      {(question.type === "Multiple choice" || question.type === "Multiple select") && (
        <ul className="fb-link-options">
          {(question.options ?? []).map((o, i) => (
            <li key={i}>{o.text}</li>
          ))}
          {question.otherOption && <li className="fb-faint">Other (free text)</li>}
        </ul>
      )}
      {question.type === "True/False" && (
        <div className="fb-link-detail-line">True / False</div>
      )}
      {question.type === "Match the following" && (
        <ul className="fb-link-options">
          {(question.pairs ?? [])
            .filter((p) => p.left)
            .map((p, i) => (
              <li key={i}>
                {p.left} <span className="fb-faint">↔</span> {p.right}
              </li>
            ))}
        </ul>
      )}
      {question.type === "Linear scale" && (
        <div className="fb-link-detail-line">
          Scale {question.scale?.min ?? 1}–{question.scale?.max ?? 5}
          {(question.scale?.minLabel || question.scale?.maxLabel) &&
            ` · "${question.scale.minLabel ?? "—"}" → "${question.scale.maxLabel ?? "—"}"`}
        </div>
      )}
      {question.type === "Short answer" && (
        <div className="fb-link-detail-line">Short-answer text</div>
      )}
      {question.type === "File upload" && (
        <div className="fb-link-detail-line">
          Up to {question.fileRules?.maxFiles ?? 1} file
          {(question.fileRules?.maxFiles ?? 1) === 1 ? "" : "s"}, max{" "}
          {question.fileRules?.maxSizeMb ?? 10} MB each
        </div>
      )}
    </div>
  );
}

// ---------------------- Question Bank picker ----------------------

type TypeFilter = "all" | QuestionType;

const PICKER_TYPES: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "Multiple choice", label: "Multiple choice" },
  { key: "Multiple select", label: "Multiple select" },
  { key: "True/False", label: "True/False" },
  { key: "Match the following", label: "Match the following" },
  { key: "Short answer", label: "Short answer" },
  { key: "File upload", label: "File upload" },
  { key: "Linear scale", label: "Linear scale" },
];

function QuestionPickerModal({
  form,
  bank,
  onLink,
  onCreateQuestion,
  onClose,
}: {
  form: FeedbackForm;
  bank: Question[];
  onLink: (q: Question) => void;
  onCreateQuestion: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const linkedIds = new Set(form.questions.map((l) => l.questionId));
  const q = query.trim().toLowerCase();

  const candidates = bank.filter((question) => {
    if (question.status !== "Active") return false;
    if (typeFilter !== "all" && question.type !== typeFilter) return false;
    if (
      q &&
      !(
        question.text.toLowerCase().includes(q) ||
        question.id.toLowerCase().includes(q) ||
        question.categoryPath.join(" > ").toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  return (
    <div className="fb-modal-scrim" onClick={onClose}>
      <div
        className="fb-modal fb-modal--picker"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fb-modal-head">
          <div>
            <div className="sp-panel-eyebrow">QUESTION BANK</div>
            <h2 className="sp-panel-title">Link questions</h2>
            <p className="sp-panel-sub">
              Any Active question can be linked, graded or ungraded — grading
              data is ignored in Feedback Forms.
            </p>
          </div>
          <button className="sp-panel-close" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>

        <div className="fb-picker-controls">
          <div className="search-wrap fb-picker-search">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              className="search-input"
              placeholder="Search by text, ID, or category…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <select
            className="fb-q-scale-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            {PICKER_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="fb-picker-list">
          {candidates.length === 0 ? (
            <div className="fb-empty">No matching questions.</div>
          ) : (
            candidates.map((question) => {
              const isLinked = linkedIds.has(question.id);
              return (
                <button
                  key={question.id}
                  className={`fb-picker-row ${isLinked ? "is-linked" : ""}`}
                  disabled={isLinked}
                  onClick={() => onLink(question)}
                >
                  <div className="fb-link-main">
                    <div className="fb-link-text">{question.text}</div>
                    <div className="fb-link-meta">
                      <span className="fb-link-id">{question.id}</span>
                      <span className="fb-link-chip">
                        {shortQuestionType(question.type)}
                      </span>
                      <span className="fb-link-chip">
                        {question.categoryPath.join(" > ")}
                      </span>
                      {question.gradingEnabled && (
                        <span className="fb-link-chip fb-link-chip--graded">
                          Graded · ignored here
                        </span>
                      )}
                      {(question.quizzes.length > 0 || question.forms.length > 0) && (
                        <span
                          className="fb-link-id"
                          title={[...question.quizzes, ...question.forms].join(", ")}
                        >
                          used in {question.quizzes.length + question.forms.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="fb-trigger-pick-cta">
                    {isLinked ? (
                      <>
                        <CheckIcon /> Linked
                      </>
                    ) : (
                      "+ Link"
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="fb-modal-footer">
          <button className="btn-save-draft" onClick={onCreateQuestion}>
            + New question in the bank
          </button>
          <div className="fb-modal-footer-right">
            <button className="btn-publish" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
