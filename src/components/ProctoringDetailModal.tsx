import { useEffect } from "react";
import type { Submission, WebcamFrame } from "../data/proctoring";
import { ChevronLeftIcon, SmallXIcon } from "./icons";

const ChevronRightIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const SectionCaretIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const CheckMarkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

const RejectXIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const RequestIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 8l9 6 9-6" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);

type Props = {
  submission: Submission;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
};

export function ProctoringDetailModal({
  submission,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev?.();
      else if (e.key === "ArrowRight" && hasNext) onNext?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const flaggedFrames = submission.frames.filter((f) => !!f.flag);
  const confidenceClass =
    submission.idConfidence >= 90
      ? "is-strong"
      : submission.idConfidence >= 75
      ? "is-ok"
      : "is-weak";

  return (
    <div className="pr-modal-overlay" onClick={onClose}>
      <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pr-modal-head">
          <div className="pr-modal-nav">
            <button
              className="pr-nav-btn"
              disabled={!hasPrev}
              onClick={onPrev}
              aria-label="Previous submission"
              title="Previous"
            >
              <ChevronLeftIcon />
            </button>
            <button
              className="pr-nav-btn"
              disabled={!hasNext}
              onClick={onNext}
              aria-label="Next submission"
              title="Next"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="pr-modal-title-block">
            <div className="pr-modal-name-row">
              <span className="pr-modal-name">{submission.candidateName}</span>
              <button className="pr-modal-edit" aria-label="Edit candidate">
                <EditIcon />
              </button>
            </div>
            <div className="pr-modal-meta">
              <span>{submission.examShort}</span>
              <span className="pr-meta-dot" />
              <span>{submission.submittedAt}</span>
              <span className="pr-meta-dot" />
              <span>Grade {submission.grade}</span>
            </div>
          </div>

          <div className="pr-modal-actions">
            <button className="pr-action-btn pr-action-btn--accept">
              <CheckMarkIcon />
              <span>ACCEPT</span>
            </button>
            <button className="pr-action-btn pr-action-btn--reject">
              <RejectXIcon />
              <span>REJECT</span>
            </button>
            <button className="pr-action-btn pr-action-btn--request">
              <RequestIcon />
              <span>REQUEST ID</span>
            </button>
          </div>

          <button
            className="pr-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <SmallXIcon />
          </button>
        </div>

        {/* Body */}
        <div className="pr-modal-body">
          {/* ID Verification */}
          <section className="pr-section">
            <div className="pr-section-head">
              <span className="pr-section-caret">
                <SectionCaretIcon />
              </span>
              <span className="pr-section-title">ID Verification</span>
              <span className="pr-meta-dot" />
              <span className={`pr-section-stat ${confidenceClass}`}>
                {submission.idConfidence}% Confidence
              </span>
              <span className="pr-meta-dot" />
              <span className="pr-section-meta">{submission.idType}</span>
            </div>
            <div className="pr-id-row">
              <MockIdCard candidateName={submission.candidateName} idType={submission.idType} />
            </div>
          </section>

          {/* Complete webcam footage */}
          <section className="pr-section">
            <div className="pr-section-head">
              <span className="pr-section-caret">
                <SectionCaretIcon />
              </span>
              <span className="pr-section-title">Complete Webcam Footage</span>
              <span className="pr-meta-dot" />
              <span
                className={`pr-section-stat ${
                  submission.webcamFlaggedCount > 0 ? "is-bad" : "is-strong"
                }`}
              >
                {submission.webcamFlaggedCount}/{submission.webcamTotal} Images Flagged
              </span>
            </div>
            <div className="pr-frame-grid">
              {submission.frames.map((f, i) => (
                <FrameCell key={`all-${i}`} frame={f} />
              ))}
            </div>
          </section>

          {/* Flagged images */}
          <section className="pr-section">
            <div className="pr-section-head">
              <span className="pr-section-caret">
                <SectionCaretIcon />
              </span>
              <span className="pr-section-title">Flagged Images</span>
              <span className="pr-meta-dot" />
              <span className="pr-section-meta">
                {flaggedFrames.length} {flaggedFrames.length === 1 ? "frame" : "frames"}
              </span>
            </div>
            {flaggedFrames.length === 0 ? (
              <div className="pr-empty">
                No flagged frames. The candidate maintained good camera presence
                throughout the exam.
              </div>
            ) : (
              <div className="pr-frame-grid">
                {flaggedFrames.map((f, i) => (
                  <FrameCell key={`flag-${i}`} frame={f} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function FrameCell({ frame }: { frame: WebcamFrame }) {
  const flagged = !!frame.flag;
  return (
    <div className={`pr-frame ${flagged ? "is-flagged" : ""} pr-frame--${frame.tone}`}>
      <div className="pr-frame-img" aria-hidden>
        <FrameAvatar tone={frame.tone} flagged={flagged} />
      </div>
      {flagged && (
        <span className="pr-frame-tag">{frame.flag}</span>
      )}
    </div>
  );
}

function FrameAvatar({ tone, flagged }: { tone: "neutral" | "side" | "dark"; flagged: boolean }) {
  // Stylized SVG silhouette to suggest a webcam thumbnail without external assets
  if (tone === "dark") {
    return (
      <svg viewBox="0 0 148 148" preserveAspectRatio="xMidYMid slice" className="pr-frame-svg">
        <defs>
          <linearGradient id="bg-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c1c20" />
            <stop offset="100%" stopColor="#0a0a0c" />
          </linearGradient>
        </defs>
        <rect width="148" height="148" fill="url(#bg-dark)" />
        <text
          x="74"
          y="80"
          textAnchor="middle"
          fill="#3a3a3f"
          fontFamily="Fira Sans, sans-serif"
          fontWeight="600"
          fontSize="11"
          letterSpacing="0.08em"
        >
          NO FACE
        </text>
      </svg>
    );
  }
  const sideShift = tone === "side" ? 14 : 0;
  return (
    <svg viewBox="0 0 148 148" preserveAspectRatio="xMidYMid slice" className="pr-frame-svg">
      <defs>
        <linearGradient id={`bg-${tone}-${flagged ? "f" : "n"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2622" />
          <stop offset="100%" stopColor="#1a1614" />
        </linearGradient>
        <radialGradient id={`face-${tone}-${flagged ? "f" : "n"}`} cx="50%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#d6a984" />
          <stop offset="100%" stopColor="#6b4f3d" />
        </radialGradient>
      </defs>
      <rect width="148" height="148" fill={`url(#bg-${tone}-${flagged ? "f" : "n"})`} />
      {/* shoulders */}
      <path
        d={`M${10 + sideShift} 148 Q${74 + sideShift} 100 ${138 + sideShift} 148 Z`}
        fill="#1a1612"
      />
      {/* head */}
      <ellipse
        cx={74 + sideShift}
        cy={68}
        rx={32}
        ry={38}
        fill={`url(#face-${tone}-${flagged ? "f" : "n"})`}
      />
      {/* hair */}
      <path
        d={`M${42 + sideShift} 50 Q${74 + sideShift} 24 ${106 + sideShift} 50 L${104 + sideShift} 64 Q${74 + sideShift} 44 ${44 + sideShift} 64 Z`}
        fill="#1f1611"
      />
      {/* glasses */}
      {tone !== "side" && (
        <g stroke="#0a0807" strokeWidth="2" fill="none" opacity="0.85">
          <circle cx={62} cy={72} r="6" />
          <circle cx={86} cy={72} r="6" />
          <path d="M68 72 H80" />
        </g>
      )}
      {/* headphone */}
      <path
        d={`M${42 + sideShift} 60 Q${74 + sideShift} 36 ${106 + sideShift} 60`}
        stroke="#0a0a0c"
        strokeWidth="4"
        fill="none"
      />
      <rect x={36 + sideShift} y={62} width="10" height="14" rx="3" fill="#0a0a0c" />
      <rect x={102 + sideShift} y={62} width="10" height="14" rx="3" fill="#0a0a0c" />
    </svg>
  );
}

function MockIdCard({ candidateName, idType }: { candidateName: string; idType: string }) {
  const upperName = candidateName.toUpperCase();
  const isPassport = idType.toLowerCase().includes("passport");
  return (
    <div className={`pr-id-card ${isPassport ? "pr-id-card--passport" : ""}`}>
      <div className="pr-id-card-inner">
        <div className="pr-id-card-header">
          <span className="pr-id-card-title">
            {isPassport ? "PASSPORT" : "DRIVER'S LICENSE"}
          </span>
          <span className="pr-id-card-star">★</span>
        </div>
        <div className="pr-id-card-row">
          <div className="pr-id-card-photo" aria-hidden>
            <FrameAvatar tone="neutral" flagged={false} />
          </div>
          <div className="pr-id-card-fields">
            <div className="pr-id-field pr-id-field--name">{upperName}</div>
            <div className="pr-id-field">123 ANYWHERE ST</div>
            <div className="pr-id-field">CITY, STATE 12345</div>
            <div className="pr-id-field pr-id-field--mono">D123-456-789-000</div>
            <div className="pr-id-field-row">
              <span>DOB 04/15/1993</span>
              <span>ISS 09/12/2022</span>
            </div>
            <div className="pr-id-field-row">
              <span>SEX M</span>
              <span>EYES BRO</span>
              <span>HGT 6-01</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
