import { useMemo, useState } from "react";
import {
  mediaUrl,
  pastReviewOf,
  pastVersionOf,
  type PastReview,
  type TaskSubmission,
} from "../data/reviewSubmissions";
import { ChevronLeftIcon, LockIcon } from "./icons";
import { RteToolbar } from "./RteToolbar";
import { AutoTextarea } from "./AutoTextarea";

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PlayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const AudioWaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h0" />
  </svg>
);

export function ReviewSubmissionDetail({
  submission,
  onBack,
  onSubmit,
}: {
  submission: TaskSubmission;
  onBack: () => void;
  onSubmit: (result: { score: number; feedback: string; checklist: string }) => void;
}) {
  const [activeVersion, setActiveVersion] = useState(0);
  const [activeMedia, setActiveMedia] = useState(0);
  const [checklist, setChecklist] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");

  const view = useMemo(
    () => (activeVersion === 0 ? submission : pastVersionOf(submission, activeVersion)),
    [submission, activeVersion],
  );
  const pastReview = useMemo(
    () => (activeVersion === 0 ? null : pastReviewOf(submission, activeVersion)),
    [submission, activeVersion],
  );

  const media = view.media[activeMedia] ?? view.media[0];
  const isReject = score !== null && score <= 4;
  const isPass = score !== null && score >= 5;

  function selectVersion(idx: number) {
    if (idx === activeVersion) return;
    setActiveVersion(idx);
    setActiveMedia(0);
  }

  const ownedByCompany = submission.createdBy !== "SkillCat";

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks rh-detail">
          {/* Breadcrumb */}
          <div className="rh-crumbs">
            <button className="rh-crumb-back" onClick={onBack}>
              <ChevronLeftIcon />
            </button>
            <button className="rh-crumb-link" onClick={onBack}>
              Hands-On Task Submissions
            </button>
            <span className="rh-crumb-sep">›</span>
            <span className="rh-crumb-link">{submission.userName}</span>
            <span className="rh-crumb-sep">›</span>
            <span className="rh-crumb-current">{submission.taskName}</span>
          </div>

          {/* Title row */}
          <div className="rh-title-row">
            <div>
              <h1 className="rh-title">{submission.taskName}</h1>
              <div className="rh-title-sub">{submission.durationLabel}</div>
              {ownedByCompany && (
                <div className="rh-owner-banner" role="note">
                  <span className="rh-owner-banner-icon">
                    <LockIcon />
                  </span>
                  <span className="rh-owner-banner-text">
                    Reviewed by <strong>{submission.createdBy}</strong>. SkillCat does not review
                    submissions for company-created tasks.
                  </span>
                </div>
              )}
            </div>
            <div className="rh-versions">
              {submission.versions.map((v, i) => (
                <button
                  key={v}
                  className={`rh-version ${i === activeVersion ? "is-active" : ""}`}
                  onClick={() => selectVersion(i)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Dates for the currently-viewed attempt: when it was submitted, the
              company deadline (B2B only), and — for graded past versions — when
              it was graded. */}
          <div className="rh-meta">
            <span className="rh-meta-item">
              <span className="rh-meta-label">Submitted</span>
              <span className="rh-meta-value">{formatDate(view.submittedOn)}</span>
            </span>
            {view.dueDate && (
              <span className="rh-meta-item">
                <span className="rh-meta-label">Due Date</span>
                <span className="rh-meta-value">{formatDate(view.dueDate)}</span>
              </span>
            )}
            {pastReview && (
              <span className="rh-meta-item">
                <span className="rh-meta-label">Graded</span>
                <span className="rh-meta-value">{formatDate(pastReview.reviewedOn)}</span>
              </span>
            )}
          </div>

          {/* Split body — collapses to a single column when there's no review panel
              (i.e. company-owned task viewed at its latest, not-yet-reviewed version). */}
          <div className={`rh-split ${ownedByCompany && !pastReview ? "rh-split--single" : ""}`}>
            {/* LEFT — the user's submission */}
            <div className="rh-col rh-col--submission">
              <div className="rh-section-eyebrow">
                Submission
                {pastReview && <span className="rh-past-tag">{submission.versions[activeVersion]}</span>}
              </div>

              <div className="rh-media-stage">
                {media.kind === "video" ? (
                  <div className="rh-media-video">
                    <img src={mediaUrl(media.seed, 1000, 640)} alt="" />
                    <button className="rh-media-play" aria-label="Play video">
                      <PlayIcon />
                    </button>
                    <span className="rh-media-duration">{media.duration}</span>
                  </div>
                ) : (
                  <img className="rh-media-img" src={mediaUrl(media.seed, 1000, 640)} alt="" />
                )}
              </div>

              <div className="rh-thumbs">
                {view.media.map((m, i) => (
                  <button
                    key={i}
                    className={`rh-thumb ${i === activeMedia ? "is-active" : ""}`}
                    onClick={() => setActiveMedia(i)}
                  >
                    <img src={mediaUrl(m.seed, 200, 200)} alt="" />
                    {m.kind === "video" && (
                      <span className="rh-thumb-play">
                        <PlayIcon />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="rh-desc">{view.description}</div>

              <div className="rh-audio">
                <button className="rh-audio-play" aria-label="Play voice note">
                  <PlayIcon />
                </button>
                <div className="rh-audio-wave">
                  <AudioWaveIcon />
                  <span className="rh-audio-label">{view.audioLabel}</span>
                </div>
                <span className="rh-audio-time">{view.audioDuration}</span>
              </div>
            </div>

            {/* RIGHT — reviewer's evaluation, or the past review when an older version
                is selected. Hidden entirely on the latest version of a company-owned task,
                since the header banner already explains there's no SkillCat review here. */}
            {(pastReview || !ownedByCompany) && (
            <div className="rh-col rh-col--review">
              {pastReview ? (
                <PastReviewCard
                  submission={submission}
                  review={pastReview}
                  versionLabel={submission.versions[activeVersion]}
                  onReturnToLatest={() => selectVersion(0)}
                />
              ) : (
                <div className="rh-review-card">
                  <div className="rh-review-head">
                    <h2 className="rh-review-title">Review</h2>
                    <p className="rh-review-sub">Score the submission and leave feedback for the learner.</p>
                  </div>

                  {/* Reviewer's checklist */}
                  <div className="rh-field">
                    <div className="rh-field-label">Reviewer's Checklist</div>
                    <ReviewerChecklistField value={checklist} onChange={setChecklist} />
                  </div>

                  {/* Score */}
                  <div className="rh-field">
                    <div className="rh-field-label">Score</div>
                    <div className="rh-score-row">
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                        const selected = score === n;
                        const band = n <= 4 ? "reject" : "pass";
                        return (
                          <button
                            key={n}
                            className={`rh-score ${selected ? `is-selected rh-score--${band}` : ""}`}
                            onClick={() => setScore(n)}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div className="rh-score-legend">
                      <span className={`rh-legend rh-legend--reject ${isReject ? "is-on" : ""}`}>1–4: Rejected</span>
                      <span className={`rh-legend rh-legend--pass ${isPass ? "is-on" : ""}`}>5–10: Pass</span>
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="rh-field">
                    <div className="rh-field-label">Feedback Notes</div>
                    <textarea
                      className="rh-feedback"
                      placeholder="Explain the score and give the learner specific, actionable feedback…"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={5}
                    />
                  </div>

                  <div className="rh-review-foot">
                    <button className="btn-save-draft" onClick={onBack}>
                      Cancel
                    </button>
                    <button
                      className="btn-publish rh-submit"
                      disabled={score === null}
                      onClick={() => score !== null && onSubmit({ score, feedback, checklist })}
                    >
                      {isReject ? "Reject Submission" : isPass ? "Pass Submission" : "Submit Review"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PastReviewCard({
  submission,
  review,
  versionLabel,
  onReturnToLatest,
}: {
  submission: TaskSubmission;
  review: PastReview;
  versionLabel: string;
  onReturnToLatest: () => void;
}) {
  const band = review.score <= 4 ? "reject" : "pass";
  const verdict = review.score <= 4 ? "Rejected" : "Passed";
  return (
    <div className="rh-review-card rh-review-card--past">
      <div className="rh-review-head">
        <div className="rh-past-head-row">
          <h2 className="rh-review-title">Past Review · {versionLabel}</h2>
          <span className={`rh-past-verdict rh-past-verdict--${band}`}>{verdict}</span>
        </div>
        <p className="rh-review-sub">
          Reviewed by {review.reviewer} on {formatDate(review.reviewedOn)}.
        </p>
      </div>

      <div className="rh-field">
        <div className="rh-field-label">Reviewer's Checklist</div>
        <div className="rh-checklist-readonly">
          <ul className="rh-checklist-list">
            {submission.criteria
              .filter((c) => review.passedCriteria.includes(c.id))
              .map((c) => (
                <li key={c.id}>{c.label}</li>
              ))}
          </ul>
        </div>
      </div>

      <div className="rh-field">
        <div className="rh-field-label">Score</div>
        <div className="rh-past-score-row">
          <span className={`rh-past-score rh-past-score--${band}`}>{review.score}</span>
          <span className="rh-past-score-out">/ 10</span>
        </div>
      </div>

      <div className="rh-field">
        <div className="rh-field-label">Feedback Notes</div>
        <div className="rh-past-feedback">{review.feedback}</div>
      </div>

      <div className="rh-review-foot">
        <button className="btn-save-draft" onClick={onReturnToLatest}>
          Back to latest version
        </button>
      </div>
    </div>
  );
}

function ReviewerChecklistField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Single-language field (Figma 620:1352): the bottom toolbar is revealed by
  // the shared `.rte-field:not(:focus-within)` rule while the caret is inside.
  return (
    <div className="rte-field">
      <AutoTextarea
        className="rte-area"
        value={value}
        onChange={onChange}
        placeholder="Note what you checked while reviewing this submission…"
      />
      <RteToolbar />
    </div>
  );
}
