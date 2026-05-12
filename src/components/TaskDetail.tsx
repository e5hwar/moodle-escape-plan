import type { Task } from "../data/tasks";

type Props = {
  task: Task;
  onClose: () => void;
};

export function TaskDetail({ task, onClose }: Props) {
  return (
    <aside className="detail">
      <button className="detail-close" onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <button className="detail-back" onClick={onClose}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        All Tasks
      </button>

      <div className="detail-eyebrow">
        {task.type} · {task.id}
      </div>
      <h2 className="detail-title">{task.name}</h2>

      {task.description && <p className="detail-desc">{task.description}</p>}

      <dl className="detail-meta">
        <dt>Type</dt>
        <dd>{task.type}</dd>

        <dt>Used in</dt>
        <dd>
          {task.usedIn.length === 0 ? (
            "—"
          ) : (
            <>
              {task.usedIn.slice(0, 2).join(", ")}
              {task.usedIn.length > 2 && (
                <span className="used-extra">+{task.usedIn.length - 2}</span>
              )}
            </>
          )}
        </dd>

        <dt>Created by</dt>
        <dd>{task.createdBy}</dd>

        {task.updated && (
          <>
            <dt>Updated</dt>
            <dd>{task.updated}</dd>
          </>
        )}

        {task.visibility && (
          <>
            <dt>Visibility</dt>
            <dd>{task.visibility}</dd>
          </>
        )}

        {task.tags && task.tags.length > 0 && (
          <>
            <dt>Tags</dt>
            <dd>
              <span className="tag-row">
                {task.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </span>
            </dd>
          </>
        )}

        {task.timeToComplete && (
          <>
            <dt>Time to complete</dt>
            <dd>{task.timeToComplete}</dd>
          </>
        )}

        {task.submissions && (
          <>
            <dt>Submissions</dt>
            <dd>{task.submissions}</dd>
          </>
        )}
      </dl>

      {task.requirements && (
        <>
          <h3 className="detail-section-label">Submission requirements</h3>
          <div className="detail-requirements">{task.requirements}</div>
        </>
      )}

      {task.skills && task.skills.length > 0 && (
        <>
          <h3 className="detail-section-label">Skills awarded</h3>
          {task.skills.map((s) => (
            <div key={s.name} className="skill-chip">
              <span className="skill-chip-icon">{s.icon}</span>
              {s.name}
            </div>
          ))}
        </>
      )}

      <div className="detail-actions">
        <button className="btn-primary">Edit task</button>
        <button className="btn-ghost">
          Open full preview
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7" />
            <path d="M8 7h9v9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
