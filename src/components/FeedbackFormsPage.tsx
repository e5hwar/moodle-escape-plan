import { useMemo, useState } from "react";
import {
  feedbackForms as seedForms,
  type FeedbackForm,
  type FormStatus,
} from "../data/feedbackForms";
import { SearchIcon, EnterKeyIcon } from "./icons";
import { NewFeedbackFormModal } from "./NewFeedbackFormModal";

type FilterKey = "all" | FormStatus;

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "All",
  active: "Active",
  draft: "Drafts",
  archived: "Archived",
};

const STATUS_LABEL: Record<FormStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type Props = {
  forms: FeedbackForm[];
  onOpen: (id: string) => void;
  onCreate: (form: FeedbackForm) => void;
};

export function FeedbackFormsPage({ forms, onOpen, onCreate }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => {
    const c = { all: forms.length, active: 0, draft: 0, archived: 0 };
    forms.forEach((f) => (c[f.status] += 1));
    return c;
  }, [forms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return forms.filter((f) => {
      if (filter !== "all" && f.status !== filter) return false;
      if (q && !(
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.createdBy.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [forms, query, filter]);

  function handleCreated(form: FeedbackForm) {
    onCreate(form);
    setCreating(false);
    onOpen(form.id);
  }

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks fb-page">
          <header className="tasks-header">
            <div>
              <h1 className="tasks-title">Feedback Forms</h1>
              <div className="tasks-subtitle">
                <span>{counts.active} active</span>
                <span className="tasks-subtitle-dot" />
                <span>{counts.draft} drafts</span>
                <span className="tasks-subtitle-dot" />
                <span>shown on Task and Certification completion</span>
              </div>
            </div>
            <div className="tasks-header-actions">
              <button className="new-task" onClick={() => setCreating(true)}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create Form
                <span className="cta-kbd">
                  <EnterKeyIcon />
                </span>
              </button>
            </div>
          </header>

          <div className="sp-controls">
            <div className="search-wrap sp-search">
              <span className="search-icon">
                <SearchIcon />
              </span>
              <input
                className="search-input"
                placeholder="Search forms by name, ID, or creator…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="search-kbd">
                <span className="kbd-cmd">⌘</span>
                <span className="kbd-letter">K</span>
              </span>
            </div>
            <div className="sp-tabs">
              {(["all", "active", "draft", "archived"] as FilterKey[]).map(
                (k) => (
                  <button
                    key={k}
                    className={`sp-tab ${filter === k ? "is-active" : ""}`}
                    onClick={() => setFilter(k)}
                  >
                    {FILTER_LABEL[k]}
                    {k !== "all" && (
                      <span className="sp-tab-count">{counts[k]}</span>
                    )}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="tasks-scroll fb-list-scroll">
            <div className="fb-list">
              <div className="fb-list-head">
                <div className="fb-col-name">NAME</div>
                <div className="fb-col-status">STATUS</div>
                <div className="fb-col-version">VERSION</div>
                <div className="fb-col-triggers">TRIGGERS</div>
                <div className="fb-col-responses">RESPONSES</div>
                <div className="fb-col-updated">LAST UPDATED</div>
                <div className="fb-col-by">CREATED BY</div>
              </div>
              {filtered.length === 0 ? (
                <div className="fb-empty">
                  No Feedback Forms match. Try a different filter or search term.
                </div>
              ) : (
                filtered.map((f) => (
                  <button
                    key={f.id}
                    className="fb-row"
                    onClick={() => onOpen(f.id)}
                  >
                    <div className="fb-col-name">
                      <div className="fb-row-id">{f.id}</div>
                      <div className="fb-row-name">{f.name}</div>
                    </div>
                    <div className="fb-col-status">
                      <span className={`fb-status fb-status--${f.status}`}>
                        {STATUS_LABEL[f.status]}
                      </span>
                    </div>
                    <div className="fb-col-version">
                      <span className="fb-version-pill">v{f.version}</span>
                    </div>
                    <div className="fb-col-triggers">
                      {f.triggers.length === 0 ? (
                        <span className="fb-faint">—</span>
                      ) : (
                        <>
                          <span className="fb-trigger-first">
                            {f.triggers[0].refName}
                          </span>
                          {f.triggers.length > 1 && (
                            <span className="used-extra">
                              +{f.triggers.length - 1}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="fb-col-responses">
                      {f.responseCount.toLocaleString()}
                    </div>
                    <div className="fb-col-updated">
                      {formatDate(f.updatedAt)}
                    </div>
                    <div className="fb-col-by">{f.createdBy}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {creating && (
        <NewFeedbackFormModal
          existingForms={forms.filter((f) => f.status !== "archived")}
          onClose={() => setCreating(false)}
          onCreate={handleCreated}
        />
      )}
    </div>
  );
}

export { seedForms };
