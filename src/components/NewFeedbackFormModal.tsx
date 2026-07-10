import { useState } from "react";
import {
  activeLinks,
  type FeedbackForm,
} from "../data/feedbackForms";
import { SmallXIcon, SearchIcon } from "./icons";

// Naming happens in the wizard's Details step — the modal only chooses a
// starting point (blank vs. a copy of an existing form).
type Mode = "choose" | "duplicate";

type Props = {
  existingForms: FeedbackForm[];
  onClose: () => void;
  onCreate: (form: FeedbackForm) => void;
};

function nextId(taken: FeedbackForm[]): string {
  let id: string;
  do {
    const n = Math.floor(Math.random() * 9000) + 1000;
    id = `FB-${String(n).padStart(4, "0")}`;
  } while (taken.some((f) => f.id === id));
  return id;
}

export function NewFeedbackFormModal({
  existingForms,
  onClose,
  onCreate,
}: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  function createFromScratch() {
    const form: FeedbackForm = {
      id: nextId(existingForms),
      // Left blank on purpose — the wizard's Details step is where it's named.
      name: "",
      status: "draft",
      questions: [],
      triggers: [],
      createdBy: "You",
      createdAt: today,
      updatedAt: today,
      responseCount: 0,
    };
    onCreate(form);
  }

  function createFromDuplicate() {
    const src = existingForms.find((f) => f.id === sourceId);
    if (!src) return;
    const form: FeedbackForm = {
      id: nextId(existingForms),
      name: `${src.name} (copy)`,
      status: "draft",
      // Links the SAME Question Bank questions, same order, same mandatory
      // flags. The two forms' lists are fully independent after this copy.
      questions: activeLinks(src).map((l) => ({
        questionId: l.questionId,
        mandatory: l.mandatory,
        status: "active" as const,
        linkedAt: today,
      })),
      triggers: [], // triggers do NOT carry over per spec
      createdBy: "You",
      createdAt: today,
      updatedAt: today,
      responseCount: 0,
    };
    onCreate(form);
  }

  const q = query.trim().toLowerCase();
  const filteredSources = existingForms.filter((f) => {
    if (!q) return true;
    return (
      f.name.toLowerCase().includes(q) ||
      f.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fb-modal-scrim" onClick={onClose}>
      <div
        className="fb-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fb-modal-head">
          <div>
            <div className="sp-panel-eyebrow">NEW FEEDBACK FORM</div>
            <h2 className="sp-panel-title">Create a Feedback Form</h2>
            <p className="sp-panel-sub">
              Pick a starting point. You'll name the form, link questions, and
              map triggers in the next steps.
            </p>
          </div>
          <button
            className="sp-panel-close"
            aria-label="Close"
            onClick={onClose}
          >
            <SmallXIcon />
          </button>
        </div>

        {mode === "choose" && (
          <div className="fb-modal-body">
            <div className="fb-mode-grid">
              <button className="fb-mode-card" onClick={createFromScratch}>
                <div className="fb-mode-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
                    <path d="M14 3v5h5" />
                    <path d="M9 15h6M12 12v6" />
                  </svg>
                </div>
                <div className="fb-mode-title">Start from scratch</div>
                <div className="fb-mode-desc">
                  Build a new form, question by question.
                </div>
              </button>
              <button
                className="fb-mode-card"
                onClick={() => setMode("duplicate")}
              >
                <div className="fb-mode-icon">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </div>
                <div className="fb-mode-title">Duplicate an existing form</div>
                <div className="fb-mode-desc">
                  Links the same Question Bank questions, in the same order,
                  with the same mandatory flags. Triggers don't carry over.
                </div>
              </button>
            </div>
          </div>
        )}

        {mode === "duplicate" && (
          <div className="fb-modal-body">
            <section className="sp-section">
              <label className="form-label">
                Pick a form to duplicate <span className="req">*</span>
              </label>
              <div className="search-wrap fb-dup-search">
                <span className="search-icon">
                  <SearchIcon />
                </span>
                <input
                  className="search-input"
                  placeholder="Search by name or ID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="fb-dup-list">
                {filteredSources.length === 0 ? (
                  <div className="fb-empty">No matching forms.</div>
                ) : (
                  filteredSources.map((f) => (
                    <button
                      key={f.id}
                      className={`fb-dup-item ${
                        sourceId === f.id ? "is-selected" : ""
                      }`}
                      onClick={() => setSourceId(f.id)}
                    >
                      <div className="fb-dup-radio">
                        {sourceId === f.id && (
                          <span className="fb-dup-radio-dot" />
                        )}
                      </div>
                      <div className="fb-dup-meta">
                        <div className="fb-dup-name">{f.name}</div>
                        <div className="fb-dup-sub">
                          {f.id} · {activeLinks(f).length} question
                          {activeLinks(f).length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <span className={`fb-status fb-status--${f.status}`}>
                        {f.status === "draft"
                          ? "Draft"
                          : f.status === "active"
                          ? "Active"
                          : "Archived"}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <p className="form-help">
                Creates an independent copy named “{
                  existingForms.find((f) => f.id === sourceId)?.name ?? "…"
                } (copy)”. Rename it in the next step. The two forms' question
                lists are independent, but both link the same Question Bank
                questions.
              </p>
            </section>
          </div>
        )}

        <div className="fb-modal-footer">
          {mode !== "choose" && (
            <button className="btn-save-draft" onClick={() => setMode("choose")}>
              Back
            </button>
          )}
          <div className="fb-modal-footer-right">
            <button className="btn-save-draft" onClick={onClose}>
              Cancel
            </button>
            {mode === "duplicate" && (
              <button
                className="btn-publish"
                disabled={sourceId === null}
                onClick={createFromDuplicate}
              >
                Duplicate & edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
