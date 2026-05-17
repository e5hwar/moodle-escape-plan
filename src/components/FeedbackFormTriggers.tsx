import { useMemo, useState } from "react";
import {
  AVAILABLE_TRIGGERS,
  type FeedbackForm,
  type FormTrigger,
  type TriggerKind,
  type TriggerOption,
} from "../data/feedbackForms";
import { SearchIcon, SmallXIcon, CheckIcon } from "./icons";

type Props = {
  form: FeedbackForm;
  onSave: (triggers: FormTrigger[]) => void;
};

type KindFilter = "all" | TriggerKind;

const KIND_LABEL: Record<KindFilter, string> = {
  all: "All",
  task: "Tasks",
  certification: "Certifications",
};

export function FeedbackFormTriggers({ form, onSave }: Props) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const today = new Date().toISOString().slice(0, 10);

  const mappedSet = useMemo(
    () => new Set(form.triggers.map((t) => t.refId)),
    [form.triggers],
  );

  function addTrigger(opt: TriggerOption) {
    if (mappedSet.has(opt.refId)) return;
    // Spec: a single Task or Certification can be mapped to AT MOST one form.
    // We surface this in the picker (existing mapping is shown).
    const next: FormTrigger = {
      id: `tr-${Math.random().toString(36).slice(2, 8)}`,
      kind: opt.kind,
      refId: opt.refId,
      refName: opt.refName,
      mappedAt: today,
    };
    onSave([...form.triggers, next]);
  }

  function removeTrigger(id: string) {
    onSave(form.triggers.filter((t) => t.id !== id));
  }

  const q = query.trim().toLowerCase();
  const candidates = AVAILABLE_TRIGGERS.filter((t) => {
    if (kindFilter !== "all" && t.kind !== kindFilter) return false;
    if (q && !(
      t.refName.toLowerCase().includes(q) ||
      t.refId.toLowerCase().includes(q) ||
      (t.industry ?? "").toLowerCase().includes(q)
    )) return false;
    return true;
  });

  if (form.status === "draft") {
    return (
      <div className="fb-triggers-empty">
        <div className="fb-empty-title">Activate the form to add triggers</div>
        <div className="fb-empty-sub">
          A form must be in <strong>Active</strong> status before it can be
          mapped to Tasks or Certifications.
        </div>
      </div>
    );
  }

  return (
    <div className="fb-triggers">
      <div className="fb-triggers-head">
        <div>
          <h3 className="fb-section-title">Mapped triggers</h3>
          <p className="fb-section-sub">
            This form is shown when a user completes any of these Tasks or
            Certifications. A user is asked at most once across all triggers.
          </p>
        </div>
        {form.status === "active" && (
          <button
            className="btn-publish"
            onClick={() => setPicking((v) => !v)}
          >
            {picking ? "Close picker" : "+ Add trigger"}
          </button>
        )}
      </div>

      {form.triggers.length === 0 ? (
        <div className="fb-empty fb-empty--centered">
          <div className="fb-empty-title">No triggers mapped yet</div>
          <div className="fb-empty-sub">
            Map this form to one or more Tasks or Certifications so that it
            fires on completion.
          </div>
        </div>
      ) : (
        <div className="fb-trigger-list">
          {form.triggers.map((t) => (
            <div key={t.id} className="fb-trigger-row">
              <span className={`fb-trigger-kind fb-trigger-kind--${t.kind}`}>
                {t.kind === "task" ? "Task" : "Certification"}
              </span>
              <div className="fb-trigger-meta">
                <div className="fb-trigger-name">{t.refName}</div>
                <div className="fb-trigger-sub">
                  {t.refId} · mapped {t.mappedAt}
                </div>
              </div>
              <button
                className="fb-q-mini-btn fb-q-mini-btn--danger"
                onClick={() => removeTrigger(t.id)}
                title="Remove trigger"
              >
                <SmallXIcon />
              </button>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <div className="fb-trigger-picker">
          <div className="fb-trigger-picker-head">
            <div className="search-wrap">
              <span className="search-icon">
                <SearchIcon />
              </span>
              <input
                className="search-input"
                placeholder="Search Tasks or Certifications…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="sp-tabs">
              {(["all", "certification", "task"] as KindFilter[]).map((k) => (
                <button
                  key={k}
                  className={`sp-tab ${kindFilter === k ? "is-active" : ""}`}
                  onClick={() => setKindFilter(k)}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="fb-trigger-picker-list">
            {candidates.length === 0 ? (
              <div className="fb-empty">No matching items.</div>
            ) : (
              candidates.map((c) => {
                const isMapped = mappedSet.has(c.refId);
                const otherMapping =
                  c.mappedToFormId && c.mappedToFormId !== form.id
                    ? c.mappedToFormId
                    : null;
                return (
                  <button
                    key={c.id}
                    className={`fb-trigger-pick ${
                      isMapped ? "is-added" : ""
                    } ${otherMapping ? "is-conflict" : ""}`}
                    disabled={isMapped || !!otherMapping}
                    onClick={() => addTrigger(c)}
                  >
                    <span className={`fb-trigger-kind fb-trigger-kind--${c.kind}`}>
                      {c.kind === "task" ? "Task" : "Cert"}
                    </span>
                    <div className="fb-trigger-meta">
                      <div className="fb-trigger-name">{c.refName}</div>
                      <div className="fb-trigger-sub">
                        {c.refId}
                        {c.industry ? ` · ${c.industry}` : ""}
                        {otherMapping
                          ? ` · already mapped to ${otherMapping}`
                          : ""}
                      </div>
                    </div>
                    <span className="fb-trigger-pick-cta">
                      {isMapped ? (
                        <>
                          <CheckIcon /> Added
                        </>
                      ) : otherMapping ? (
                        "Unavailable"
                      ) : (
                        "+ Add"
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
