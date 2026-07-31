import { useEffect, useState } from "react";
import {
  shortQuestionType,
  versionHistory,
  type Question,
  type QuestionVersion,
} from "../data/questionBank";
import { SmallXIcon } from "./icons";

/* Version history for a question. Past attempts and responses stay pinned to
   the version they answered; only versions with zero pinned attempts can be
   deleted. Restoring an old version creates a NEW version with its content. */
export function QuestionHistoryModal({
  question,
  onClose,
  onRestore,
}: {
  question: Question;
  onClose: () => void;
  // Present on the list page (restore = new version); absent in the editor.
  onRestore?: (fromVersion: number) => void;
}) {
  const [versions, setVersions] = useState<QuestionVersion[]>(() =>
    versionHistory(question),
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal qh-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head qh-head">
          <div>
            <h3 className="pm-title">Version history</h3>
            <div className="qh-sub">
              {question.id} · {shortQuestionType(question.type)} —{" "}
              <span className="qh-sub-text">{question.text}</span>
            </div>
          </div>
          <button className="ind-icon-btn" aria-label="Close" onClick={onClose}>
            <SmallXIcon />
          </button>
        </div>

        <div className="qh-list">
          {versions.map((v) => {
            const isCurrent = v.version === question.version;
            const deletable = !isCurrent && v.attempts === 0;
            return (
              <div key={v.version} className={`qh-row ${isCurrent ? "is-current" : ""}`}>
                <div className="qh-vcol">
                  <span className="qh-vtag">v{v.version}</span>
                  {isCurrent && <span className="qh-current-pill">Current</span>}
                </div>
                <div className="qh-info">
                  <div className="qh-note">{v.note}</div>
                  <div className="qh-meta">
                    {v.date} · {v.author}
                  </div>
                  <div className={`qh-usage ${v.attempts === 0 ? "is-unused" : ""}`}>
                    {v.attempts === 0
                      ? isCurrent
                        ? "No attempts yet"
                        : "Never answered — can be deleted"
                      : `Pinned to ${v.attempts.toLocaleString()} past attempt${v.attempts === 1 ? "" : "s"}/response${v.attempts === 1 ? "" : "s"}`}
                  </div>
                </div>
                <div className="qh-actions">
                  {!isCurrent && onRestore && (
                    <button
                      className="qh-action-btn"
                      title={`Create a new version with v${v.version}'s content`}
                      onClick={() => {
                        onRestore(v.version);
                        onClose();
                      }}
                    >
                      Restore
                    </button>
                  )}
                  {deletable && (
                    <button
                      className="qh-action-btn qh-action-btn--danger"
                      onClick={() =>
                        setVersions((prev) => prev.filter((x) => x.version !== v.version))
                      }
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {versions.length === 0 && (
            <div className="qh-empty">No versions yet — this question hasn't been saved.</div>
          )}
        </div>

        <div className="qh-foot-note">
          Past quiz attempts and form responses permanently reference the version
          they answered. Versions that were never answered can be deleted; used
          versions are retained.
        </div>
      </div>
    </div>
  );
}
