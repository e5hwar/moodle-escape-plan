import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import type { TaskTypeKey } from "./Footer";
import {
  CheckBoldIcon,
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
  UploadIcon,
  DocumentIcon,
  SmallXIcon,
  DragHandleIcon,
  GearIcon,
} from "./icons";

const TYPE_LABEL: Record<TaskTypeKey, string> = {
  xapi: "xAPI",
  quiz: "Quiz",
  "hands-on": "Hands-On Task",
  "id-upload": "ID Upload",
  file: "File",
  "deep-link": "Deep Link",
  url: "URL",
};

/* ─────────────────────  Types  ───────────────────── */

type CompletionMode = "none" | "on-view" | "manual" | "xapi";
type Visibility = "visible" | "hidden";
type TimeUnit = "minutes" | "hours" | "days" | "weeks";
type Presentation = "fixed" | "random" | "subset";
type MaxScoreMode = "auto" | "manual";
type AttemptsMode = "unlimited" | "limit";
type ReviewMode = "score" | "markers" | "answers" | "none";
type Paywall = "free" | "paid";
type PricingMode = "same" | "per-attempt";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  ext: string;
};

type QuizQuestion = {
  id: string;
  text: string;
  type: "Multiple choice" | "True/False";
  points: string;
};

type QuizSection = {
  id: string;
  name: string;
  nameEs: string;
  questions: QuizQuestion[];
};

type AttemptPrice = {
  id: string;
  label: string;
  sub: string;
  price: string;
};

type WizardData = {
  // Common
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  timeValue: string;
  timeUnit: TimeUnit;
  visibility: Visibility | null;
  tags: string[];

  // xAPI
  packageEn: UploadedFile[];
  packageEs: UploadedFile[];
  completion: CompletionMode | null;

  // Quiz – Questions
  presentation: Presentation;
  subsetCount: string;
  unevenPoints: boolean;
  questionSections: QuizSection[];

  // Quiz – Behavior
  scoreMethod: string;
  passMark: string;
  maxScoreMode: MaxScoreMode;
  maxScoreManual: string;
  attemptsMode: AttemptsMode;
  attemptLimit: string;
  cooldownValue: string;
  cooldownUnit: TimeUnit;
  timeLimitValue: string;
  timeLimitUnit: TimeUnit;
  grantOnReject: boolean;
  grantOnNearMiss: boolean;
  grantOnTechFail: boolean;
  proctoring: boolean;
  proctoringRecord: boolean;
  resources: UploadedFile[];
  reviewMode: ReviewMode;

  // Quiz – Access
  paywall: Paywall;
  pricingMode: PricingMode;
  samePrice: string;
  attemptPrices: AttemptPrice[];
};

/* ─────────────────  Constants & defaults  ───────────────── */

const DEFAULT_COMPLETION: CompletionMode = "xapi";
const DEFAULT_VISIBILITY: Visibility = "visible";

const COMPLETION_LABELS: Record<CompletionMode, string> = {
  none: "No completion tracking",
  "on-view": "Completion upon viewing",
  manual: "User manually marks completion",
  xapi: "xAPI Completion Statement",
};

const VISIBILITY_LABELS: Record<Visibility, string> = {
  visible: "Visible",
  hidden: "Hidden",
};

const SAMPLE_SECTIONS: QuizSection[] = [
  {
    id: "s1",
    name: "Refrigerant Identification",
    nameEs: "Identificación de Refrigerantes",
    questions: [
      { id: "q1", text: "What is the boiling point of R-134a at standard atmospheric pressure?", type: "Multiple choice", points: "1.00" },
      { id: "q2", text: "R-22 is being phased out under EPA Section 608 regulations.", type: "True/False", points: "1.00" },
      { id: "q3", text: "Which of the following is classified as a hydrofluoroolefin (HFO) refrigerant?", type: "Multiple choice", points: "1.00" },
      { id: "q4", text: "R-410A is a blend of which two component refrigerants?", type: "Multiple choice", points: "1.00" },
      { id: "q5", text: "ASHRAE classifies refrigerants by safety based on toxicity and flammability.", type: "True/False", points: "1.00" },
    ],
  },
  {
    id: "s2",
    name: "Recovery Procedures",
    nameEs: "Procedimientos de Recuperación",
    questions: [
      { id: "q6", text: "What must be done before disconnecting refrigerant lines from a system?", type: "Multiple choice", points: "1.00" },
      { id: "q7", text: "When recovering from a high-pressure appliance, the recovery vacuum must reach what level?", type: "Multiple choice", points: "1.00" },
      { id: "q8", text: "Recovery cylinders must be evacuated before initial use.", type: "True/False", points: "1.00" },
      { id: "q9", text: "Which type of recovery is required for systems with non-condensable gas contamination?", type: "Multiple choice", points: "1.00" },
    ],
  },
  {
    id: "s3",
    name: "EPA Section 608 Regulations",
    nameEs: "Reglamentos de la Sección 608 de EPA",
    questions: [
      { id: "q10", text: "Section 608 of the Clean Air Act prohibits which of the following actions?", type: "Multiple choice", points: "1.00" },
      { id: "q11", text: "Technicians servicing appliances containing regulated refrigerants must be EPA-certified.", type: "True/False", points: "1.00" },
      { id: "q12", text: "What is the maximum allowable leak rate for commercial refrigeration equipment?", type: "Multiple choice", points: "1.00" },
    ],
  },
];

const DEFAULT_ATTEMPT_PRICES: AttemptPrice[] = [
  { id: "ap1", label: "Attempt 1", sub: "First time the learner takes this Quiz", price: "0.00" },
  { id: "ap2", label: "Attempt 2", sub: "First retake", price: "15.00" },
  { id: "ap3", label: "Attempt 3 and beyond", sub: "Up to the maximum of 3 attempts (set in Behavior)", price: "25.00" },
];

const INITIAL_DATA: WizardData = {
  nameEn: "",
  nameEs: "",
  descEn: "",
  descEs: "",
  timeValue: "",
  timeUnit: "minutes",
  visibility: DEFAULT_VISIBILITY,
  tags: [],

  packageEn: [],
  packageEs: [],
  completion: DEFAULT_COMPLETION,

  presentation: "fixed",
  subsetCount: "10",
  unevenPoints: false,
  questionSections: SAMPLE_SECTIONS,

  scoreMethod: "highest",
  passMark: "70",
  maxScoreMode: "auto",
  maxScoreManual: "10.00",
  attemptsMode: "unlimited",
  attemptLimit: "3",
  cooldownValue: "24",
  cooldownUnit: "hours",
  timeLimitValue: "30",
  timeLimitUnit: "minutes",
  grantOnReject: false,
  grantOnNearMiss: false,
  grantOnTechFail: false,
  proctoring: false,
  proctoringRecord: false,
  resources: [],
  reviewMode: "markers",

  paywall: "free",
  pricingMode: "same",
  samePrice: "0.00",
  attemptPrices: DEFAULT_ATTEMPT_PRICES,
};

type StepDef = { id: string; label: string; sub: string; desc: string };

const XAPI_STEPS: StepDef[] = [
  { id: "details", label: "Details", sub: "Package, name, time", desc: "Upload the xAPI/SCORM package per language, name the Task, and estimate the duration." },
  { id: "completion", label: "Completion", sub: "How completion is determined", desc: "Decide what marks this Task as complete for a learner." },
  { id: "visibility", label: "Visibility", sub: "Visibility and tags", desc: "Who can find and take this Task, and how it's tagged for discovery." },
];

const QUIZ_STEPS: StepDef[] = [
  { id: "details", label: "Details", sub: "Name, description, time", desc: "Name, describe, and estimate the duration of this Quiz." },
  { id: "questions", label: "Questions", sub: "Question bank and presentation", desc: "Add Questions from the Question Bank and configure how learners experience them. Sections are quiz-level groupings — each Quiz has its own Section names, even if Questions are shared across Quizzes." },
  { id: "behavior", label: "Behavior", sub: "Scoring, attempts, integrity", desc: "Scoring, attempts, integrity, and what learners see after submitting." },
  { id: "access", label: "Access", sub: "Visibility, paywall, tags", desc: "Who can find and take this Quiz, and how it's priced." },
];

function stepsForType(type: TaskTypeKey): StepDef[] {
  if (type === "quiz") return QUIZ_STEPS;
  return XAPI_STEPS;
}

function stepSummary(stepId: string, data: WizardData): string | null {
  if (stepId === "completion") {
    if (!data.completion) return null;
    const label = COMPLETION_LABELS[data.completion];
    return data.completion === DEFAULT_COMPLETION ? `Default: ${label}` : label;
  }
  if (stepId === "visibility" || stepId === "access") {
    if (!data.visibility) return null;
    const label = VISIBILITY_LABELS[data.visibility];
    return data.visibility === DEFAULT_VISIBILITY ? `Default: ${label}` : label;
  }
  return null;
}

/* ─────────────────────  Wizard shell  ───────────────────── */

type Props = {
  taskType: TaskTypeKey;
  onClose: () => void;
};

export function NewTaskWizard({ taskType, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);

  const update = (patch: Partial<WizardData>) =>
    setData((d) => ({ ...d, ...patch }));

  const isXapi = taskType === "xapi";
  const isQuiz = taskType === "quiz";
  const steps = stepsForType(taskType);

  return (
    <div className="wizard">
      <div className="wizard-body">
        <aside className="wizard-nav">
          <div className="wizard-breadcrumb">
            <button className="wizard-back-btn" onClick={onClose}>
              <ChevronLeftIcon />
              BACK
            </button>
            <span className="sep">/</span>
            <span className="wizard-current">NEW TASK</span>
          </div>

          {!isXapi && (
            <div className={`wizard-type-badge ${taskType}`}>{TYPE_LABEL[taskType]}</div>
          )}

          <ol className="wizard-steps">
            {steps.map((s, i) => {
              const status =
                i === step ? "active" : i < step ? "done" : "upcoming";
              const summary = stepSummary(s.id, data);
              const subText =
                status === "active" ? s.desc : summary ?? s.sub;
              return (
                <li
                  key={s.id}
                  className={`wizard-step ${status}`}
                  onClick={() => setStep(i)}
                >
                  <div className="wizard-step-rail">
                    <span className="wizard-step-num">
                      {status === "done" ? <CheckBoldIcon /> : i + 1}
                    </span>
                  </div>
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                    <div className="wizard-step-sub">{subText}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="wizard-content">
          {isXapi ? (
            step === 0 ? <XapiDetailsStep data={data} update={update} /> :
            step === 1 ? <XapiCompletionStep data={data} update={update} /> :
            <XapiVisibilityStep data={data} update={update} />
          ) : isQuiz ? (
            step === 0 ? <QuizDetailsStep data={data} update={update} /> :
            step === 1 ? <QuizQuestionsStep data={data} update={update} /> :
            step === 2 ? <QuizBehaviorStep data={data} update={update} /> :
            <QuizAccessStep data={data} update={update} />
          ) : (
            <PlaceholderStep type={TYPE_LABEL[taskType]} />
          )}
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
            Publish
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────  xAPI step components  ───────────────── */

function PlaceholderStep({ type }: { type: string }) {
  return (
    <>
      <h1 className="wizard-title">{type}</h1>
      <p className="wizard-desc">
        The {type} wizard isn't built out yet. The xAPI and Quiz wizards are
        the references — the same shell will host the {type} steps next.
      </p>
    </>
  );
}

type StepProps = {
  data: WizardData;
  update: (p: Partial<WizardData>) => void;
};

function XapiDetailsStep({ data, update }: StepProps) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          xAPI Package <span className="req">*</span>
        </label>
        <PackageField
          enFiles={data.packageEn}
          esFiles={data.packageEs}
          setEnFiles={(files) => update({ packageEn: files })}
          setEsFiles={(files) => update({ packageEs: files })}
        />
      </div>

      <NameAndDescription data={data} update={update} />

      <TimeToCompleteField data={data} update={update} />
    </>
  );
}

function XapiCompletionStep({ data, update }: StepProps) {
  const options: { key: CompletionMode; title: string; desc: string }[] = [
    { key: "none", title: "No completion tracking", desc: "Task is reference content only — never marked complete." },
    { key: "on-view", title: "Completion upon viewing", desc: "Marks complete as soon as the learner opens the package." },
    { key: "manual", title: "User manually marks completion", desc: "Learner clicks \"Mark complete\" after finishing the content." },
    { key: "xapi", title: "xAPI completion statement", desc: "The package fires a completion statement to the LRS. Recommended for xAPI content." },
  ];

  return (
    <div className="form-group">
      <label className="form-label">
        How completion is determined <span className="req">*</span>
      </label>
      <div className="radio-card-group">
        {options.map((o) => (
          <RadioCard
            key={o.key}
            selected={data.completion === o.key}
            onSelect={() => update({ completion: o.key })}
            title={o.title}
            desc={o.desc}
          />
        ))}
      </div>
    </div>
  );
}

function XapiVisibilityStep({ data, update }: StepProps) {
  return (
    <>
      <VisibilitySection data={data} update={update} />
      <div className="form-divider" />
      <TagsSection data={data} update={update} />
    </>
  );
}

/* ─────────────────  Quiz step components  ───────────────── */

function QuizDetailsStep({ data, update }: StepProps) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Quiz name <span className="req">*</span>
        </label>
        <LangField
          en={data.nameEn}
          es={data.nameEs}
          onChangeEn={(v) => update({ nameEn: v })}
          onChangeEs={(v) => update({ nameEs: v })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
        />
      </div>

      <TimeToCompleteField data={data} update={update} />
    </>
  );
}

function QuizQuestionsStep({ data, update }: StepProps) {
  const totalQuestions = data.questionSections.reduce(
    (sum, s) => sum + s.questions.length,
    0,
  );

  const presOptions: {
    key: Presentation;
    render: () => React.ReactNode;
    desc: string;
  }[] = [
    {
      key: "fixed",
      render: () => "Show all questions in fixed order",
      desc: "All learners see the same exam in the same sequence. Useful for proctored exams.",
    },
    {
      key: "random",
      render: () => "Show all questions, randomized",
      desc: "All learners see the same questions, scrambled differently per attempt.",
    },
    {
      key: "subset",
      render: () => (
        <>
          Show a random subset of{" "}
          <input
            type="text"
            inputMode="numeric"
            className="inline-num"
            value={data.subsetCount}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d+$/.test(v)) update({ subsetCount: v });
            }}
          />{" "}
          questions
        </>
      ),
      desc: "Each learner gets a different draw from the question bag.",
    },
  ];

  return (
    <>
      <Section title="Presentation" desc="How Questions are shown to learners during the attempt.">
        <div className="radio-card-group">
          {presOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`radio-card ${data.presentation === o.key ? "selected" : ""}`}
              onClick={() => update({ presentation: o.key })}
            >
              <span className="radio-dot" />
              <div className="radio-card-text">
                <div className="radio-card-title">{o.render()}</div>
                <div className="radio-card-desc">{o.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <div className="form-divider" />

      <Section
        title="Question bag"
        desc="All Questions available to this Quiz. Sections group Questions by topic. Use the Question Bank to manage Questions globally."
      >
        <div className="qbag">
          <div className="qbag-toolbar">
            <button className="btn-secondary">+ Add Questions</button>
            <button className="btn-secondary">+ Add Section</button>
            <span className="qbag-toolbar-spacer" />
            <Toggle
              checked={data.unevenPoints}
              onChange={(v) => update({ unevenPoints: v })}
              inline
              label="Uneven points"
            />
          </div>

          <div className="qbag-summary">
            <div className="qbag-summary-title">
              Questions <span className="muted">(Total: {totalQuestions})</span>
            </div>
            <div className="qbag-summary-sub">
              {data.subsetCount || totalQuestions} shown per attempt · drawn from
              EPA 608 question bank
            </div>
          </div>

          <div className="qbag-list-header">
            <span className="qbag-num-col">#</span>
            <span>QUESTION</span>
            <span className="qbag-points-col">POINTS</span>
          </div>

          {data.questionSections.map((section, idx) => (
            <div key={section.id} className="qbag-section">
              <div className="qbag-section-header">
                <div className="qbag-section-titles">
                  <div className="qbag-section-title">
                    Section {idx + 1}: <strong>{section.name}</strong>
                  </div>
                  <div className="qbag-section-sub">{section.nameEs}</div>
                </div>
                <div className="qbag-section-meta">
                  {section.questions.length} questions
                </div>
                <button className="qbag-section-menu" aria-label="Section menu">
                  <span className="dots">⋯</span>
                </button>
              </div>

              {section.questions.map((q) => (
                <div key={q.id} className="qbag-question">
                  <button className="qbag-drag" aria-label="Drag">
                    <DragHandleIcon />
                  </button>
                  <button className="qbag-gear" aria-label="Settings">
                    <GearIcon />
                  </button>
                  <div className="qbag-q-text">
                    {q.text}
                    <span className="qbag-q-type"> · {q.type}</span>
                  </div>
                  <input
                    className="qbag-points-input"
                    value={q.points}
                    onChange={(e) => {
                      const next = data.questionSections.map((s) =>
                        s.id === section.id
                          ? {
                              ...s,
                              questions: s.questions.map((qq) =>
                                qq.id === q.id
                                  ? { ...qq, points: e.target.value }
                                  : qq,
                              ),
                            }
                          : s,
                      );
                      update({ questionSections: next });
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function QuizBehaviorStep({ data, update }: StepProps) {
  return (
    <>
      <Section title="Scoring & passing">
        <div className="form-sub-group">
          <label className="form-sub-label">Score calculation method</label>
          <select
            className="form-select wide"
            value={data.scoreMethod}
            onChange={(e) => update({ scoreMethod: e.target.value })}
          >
            <option value="highest">Highest grade across attempts</option>
            <option value="latest">Latest attempt</option>
            <option value="average">Average of attempts</option>
            <option value="first">First attempt only</option>
          </select>
        </div>

        <div className="form-sub-group">
          <label className="form-sub-label">Pass mark</label>
          <div className="time-row">
            <input
              type="text"
              inputMode="numeric"
              className="form-input no-spinner small"
              value={data.passMark}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d+$/.test(v)) update({ passMark: v });
              }}
            />
            <span className="form-suffix">% to pass</span>
          </div>
        </div>

        <div className="form-sub-group">
          <label className="form-sub-label">Maximum score</label>
          <div className="radio-card-group">
            <RadioCard
              selected={data.maxScoreMode === "auto"}
              onSelect={() => update({ maxScoreMode: "auto" })}
              title={
                <>
                  Auto · {computeAutoMax(data)} points
                </>
              }
              desc="Sum of points for all selected questions. Updates as you add or remove questions."
            />
            <RadioCard
              selected={data.maxScoreMode === "manual"}
              onSelect={() => update({ maxScoreMode: "manual" })}
              title="Set manually"
              desc="Override the auto-calculated maximum."
            />
          </div>
        </div>
      </Section>

      <div className="form-divider" />

      <Section title="Attempts">
        <div className="form-sub-group">
          <label className="form-sub-label">Attempts allowed</label>
          <div className="radio-card-group">
            <RadioCard
              selected={data.attemptsMode === "unlimited"}
              onSelect={() => update({ attemptsMode: "unlimited" })}
              title="Unlimited attempts"
            />
            <button
              type="button"
              className={`radio-card ${data.attemptsMode === "limit" ? "selected" : ""}`}
              onClick={() => update({ attemptsMode: "limit" })}
            >
              <span className="radio-dot" />
              <div className="radio-card-text">
                <div className="radio-card-title">
                  Limit to{" "}
                  <input
                    type="text"
                    inputMode="numeric"
                    className="inline-num"
                    value={data.attemptLimit}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v)) update({ attemptLimit: v });
                    }}
                  />{" "}
                  attempts
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="form-sub-group">
          <label className="form-sub-label">Cooldown between attempts</label>
          <NumberWithUnit
            value={data.cooldownValue}
            unit={data.cooldownUnit}
            onChangeValue={(v) => update({ cooldownValue: v })}
            onChangeUnit={(u) => update({ cooldownUnit: u })}
          />
        </div>

        <div className="form-sub-group">
          <label className="form-sub-label">Time limit per attempt</label>
          <NumberWithUnit
            value={data.timeLimitValue}
            unit={data.timeLimitUnit}
            onChangeValue={(v) => update({ timeLimitValue: v })}
            onChangeUnit={(u) => update({ timeLimitUnit: u })}
          />
        </div>

        <div className="form-sub-group">
          <label className="form-sub-label">Grant extra attempts automatically when…</label>
          <Toggle
            checked={data.grantOnReject}
            onChange={(v) => update({ grantOnReject: v })}
            label="Proctoring rejected the attempt"
          />
          <Toggle
            checked={data.grantOnNearMiss}
            onChange={(v) => update({ grantOnNearMiss: v })}
            label="Failed by less than 5%"
            sub="Learners just shy of the pass mark get one extra try."
          />
          <Toggle
            checked={data.grantOnTechFail}
            onChange={(v) => update({ grantOnTechFail: v })}
            label="Technical failure during attempt"
            sub="Network drops, browser crash, etc."
          />
        </div>
      </Section>

      <div className="form-divider" />

      <Section title="Integrity">
        <Toggle
          checked={data.proctoring}
          onChange={(v) => update({ proctoring: v })}
          label="Proctoring"
          sub="Capture webcam and screen during attempts. Recordings reviewed manually after submission."
        />
        {data.proctoring && (
          <div className="toggle-sub-row">
            <Toggle
              checked={data.proctoringRecord}
              onChange={(v) => update({ proctoringRecord: v })}
              label="Record screen and camera"
            />
          </div>
        )}
      </Section>

      <div className="form-divider" />

      <Section title="Resources">
        <ResourceList
          files={data.resources}
          setFiles={(f) => update({ resources: f })}
        />
      </Section>

      <div className="form-divider" />

      <Section title="Post-completion review">
        <div className="radio-card-group">
          <RadioCard
            selected={data.reviewMode === "score"}
            onSelect={() => update({ reviewMode: "score" })}
            title="Score only"
            desc="Pass/fail and final score. No question-level details."
          />
          <RadioCard
            selected={data.reviewMode === "markers"}
            onSelect={() => update({ reviewMode: "markers" })}
            title="Score + correct/incorrect markers"
            desc="Score plus a marker per question showing what was right or wrong. Doesn't reveal correct answers."
          />
          <RadioCard
            selected={data.reviewMode === "answers"}
            onSelect={() => update({ reviewMode: "answers" })}
            title="Score + correct answers"
            desc="Full review including the correct answer for each question."
          />
          <RadioCard
            selected={data.reviewMode === "none"}
            onSelect={() => update({ reviewMode: "none" })}
            title="No review"
            desc="Only the submitted confirmation. Score shown later from learner dashboard."
          />
        </div>
      </Section>
    </>
  );
}

function QuizAccessStep({ data, update }: StepProps) {
  return (
    <>
      <VisibilitySection
        data={data}
        update={update}
        forType="Quiz"
      />

      <div className="form-divider" />

      <Section title="Paywall">
        <TabSwitch
          value={data.paywall}
          onChange={(v) => update({ paywall: v as Paywall })}
          options={[
            { value: "free", label: "Free" },
            { value: "paid", label: "Paid" },
          ]}
        />

        {data.paywall === "paid" && (
          <>
            <div className="form-sub-group" style={{ marginTop: 24 }}>
              <label className="form-sub-label">Pricing model</label>
              <div className="radio-card-group">
                <RadioCard
                  selected={data.pricingMode === "same"}
                  onSelect={() => update({ pricingMode: "same" })}
                  title="Same price for every attempt"
                  desc="One price applies to all attempts a learner takes."
                />
                <RadioCard
                  selected={data.pricingMode === "per-attempt"}
                  onSelect={() => update({ pricingMode: "per-attempt" })}
                  title="Different price per attempt"
                  desc="Set individual prices for the first attempt, second, etc. Common pattern: first attempt free, retakes cost."
                />
              </div>
            </div>

            {data.pricingMode === "same" ? (
              <div className="form-sub-group">
                <label className="form-sub-label">Price per attempt</label>
                <PriceInput
                  value={data.samePrice}
                  onChange={(v) => update({ samePrice: v })}
                />
              </div>
            ) : (
              <div className="form-sub-group">
                <label className="form-sub-label">Per-attempt pricing</label>
                <div className="price-rows">
                  {data.attemptPrices.map((row) => (
                    <div key={row.id} className="price-row">
                      <div className="price-row-text">
                        <div className="price-row-title">{row.label}</div>
                        <div className="price-row-sub">{row.sub}</div>
                      </div>
                      <PriceInput
                        value={row.price}
                        onChange={(v) =>
                          update({
                            attemptPrices: data.attemptPrices.map((r) =>
                              r.id === row.id ? { ...r, price: v } : r,
                            ),
                          })
                        }
                      />
                      <button
                        className="price-row-x"
                        aria-label="Remove tier"
                        onClick={() =>
                          update({
                            attemptPrices: data.attemptPrices.filter(
                              (r) => r.id !== row.id,
                            ),
                          })
                        }
                      >
                        <SmallXIcon />
                      </button>
                    </div>
                  ))}
                  <button
                    className="price-add"
                    onClick={() =>
                      update({
                        attemptPrices: [
                          ...data.attemptPrices,
                          {
                            id: `ap${Date.now()}`,
                            label: `Attempt ${data.attemptPrices.length + 1}`,
                            sub: "",
                            price: "0.00",
                          },
                        ],
                      })
                    }
                  >
                    + Add another attempt range
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      <div className="form-divider" />

      <TagsSection data={data} update={update} />
    </>
  );
}

/* ─────────────────  Shared sub-blocks  ───────────────── */

function NameAndDescription({ data, update }: StepProps) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Name <span className="req">*</span>
        </label>
        <LangField
          en={data.nameEn}
          es={data.nameEs}
          onChangeEn={(v) => update({ nameEn: v })}
          onChangeEs={(v) => update({ nameEs: v })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
        />
      </div>
    </>
  );
}

function TimeToCompleteField({ data, update }: StepProps) {
  return (
    <div className="form-group">
      <label className="form-label">Time to Complete</label>
      <div className="time-row">
        <input
          className="form-input no-spinner small"
          type="text"
          inputMode="numeric"
          value={data.timeValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^\d+$/.test(v)) update({ timeValue: v });
          }}
        />
        <select
          className="form-select"
          value={data.timeUnit}
          onChange={(e) => update({ timeUnit: e.target.value as TimeUnit })}
        >
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
          <option value="weeks">weeks</option>
        </select>
      </div>
    </div>
  );
}

function VisibilitySection({
  data,
  update,
  forType = "Task",
}: StepProps & { forType?: string }) {
  return (
    <Section title="Visibility">
      <div className="radio-card-group">
        <RadioCard
          selected={data.visibility === "visible"}
          onSelect={() => update({ visibility: "visible" })}
          title="Visible"
          desc={`Learners can find and start this ${forType}.`}
        />
        <RadioCard
          selected={data.visibility === "hidden"}
          onSelect={() => update({ visibility: "hidden" })}
          title="Hidden"
          desc={`${forType} exists but is not discoverable to learners. Saving as draft always sets to Hidden.`}
        />
      </div>
    </Section>
  );
}

function TagsSection({ data, update }: StepProps) {
  return (
    <div className="form-group">
      <label className="form-label">Tags</label>
      <div className="tag-edit-row">
        {data.tags.map((t) => (
          <span key={t} className="tag-edit">
            {t}
            <button
              className="tag-edit-x"
              onClick={() =>
                update({ tags: data.tags.filter((x) => x !== t) })
              }
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
        <button className="tag-add">+ Add tag</button>
      </div>
      <p className="form-help">
        Trade and Partnership tags are derived from company profile.
      </p>
    </div>
  );
}

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
  inline,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
  inline?: boolean;
}) {
  return (
    <div className={`toggle-row ${inline ? "inline" : ""}`}>
      {inline && <span className="toggle-inline-label">{label}</span>}
      {!inline && (
        <div className="toggle-text">
          <div className="toggle-label">{label}</div>
          {sub && <div className="toggle-sub">{sub}</div>}
        </div>
      )}
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

function TabSwitch({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="tab-switch">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`tab-switch-tab ${value === o.value ? "active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function NumberWithUnit({
  value,
  unit,
  onChangeValue,
  onChangeUnit,
}: {
  value: string;
  unit: TimeUnit;
  onChangeValue: (v: string) => void;
  onChangeUnit: (u: TimeUnit) => void;
}) {
  return (
    <div className="time-row">
      <input
        type="text"
        inputMode="numeric"
        className="form-input no-spinner small"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^\d+$/.test(v)) onChangeValue(v);
        }}
      />
      <select
        className="form-select"
        value={unit}
        onChange={(e) => onChangeUnit(e.target.value as TimeUnit)}
      >
        <option value="minutes">minutes</option>
        <option value="hours">hours</option>
        <option value="days">days</option>
        <option value="weeks">weeks</option>
      </select>
    </div>
  );
}

function PriceInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="price-input">
      <span className="price-input-prefix">$</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) onChange(v);
        }}
      />
    </div>
  );
}

function ResourceList({
  files,
  setFiles,
}: {
  files: UploadedFile[];
  setFiles: (f: UploadedFile[]) => void;
}) {
  return (
    <div className="resource-list">
      {files.map((f, i) => (
        <div key={f.id} className="resource-row">
          <span className="resource-icon">
            <DocumentIcon />
          </span>
          <span className="resource-name">{f.name}</span>
          <span className="resource-size">{formatSize(f.size)}</span>
          <button
            className="resource-remove"
            onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
            aria-label="Remove resource"
          >
            <SmallXIcon />
          </button>
        </div>
      ))}
      <FilePicker onPick={(picked) => setFiles([...files, ...picked])}>
        {(open) => (
          <button className="resource-add" onClick={open}>
            + Add resource
          </button>
        )}
      </FilePicker>
    </div>
  );
}

/* ─────────────────  Field components  ───────────────── */

function PackageField({
  enFiles,
  esFiles,
  setEnFiles,
  setEsFiles,
}: {
  enFiles: UploadedFile[];
  esFiles: UploadedFile[];
  setEnFiles: (f: UploadedFile[]) => void;
  setEsFiles: (f: UploadedFile[]) => void;
}) {
  return (
    <div className="upload-container">
      {enFiles.length === 0 ? (
        <BigDropZone onAdd={(files) => setEnFiles(files)} />
      ) : (
        <>
          <FileList
            files={enFiles}
            onRemove={(idx) =>
              setEnFiles(enFiles.filter((_, i) => i !== idx))
            }
          />
          <SlimDrop
            onAdd={(files) => setEnFiles([...enFiles, ...files])}
          />
        </>
      )}

      <div className="upload-lang-divider">
        <span className="lang-tag">ESPAÑOL</span>
      </div>

      {esFiles.length > 0 && (
        <FileList
          files={esFiles}
          onRemove={(idx) =>
            setEsFiles(esFiles.filter((_, i) => i !== idx))
          }
        />
      )}
      <SlimDrop onAdd={(files) => setEsFiles([...esFiles, ...files])} />
    </div>
  );
}

function FileList({
  files,
  onRemove,
}: {
  files: UploadedFile[];
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="file-list">
      {files.map((f, i) => (
        <div key={f.id} className="file-row">
          <span className="file-icon">
            <DocumentIcon />
          </span>
          <div className="file-meta">
            <div className="file-name">{f.name}</div>
            <div className="file-sub">
              {formatSize(f.size)} · {f.ext}
            </div>
          </div>
          <button
            className="file-remove"
            onClick={() => onRemove(i)}
            aria-label="Remove file"
          >
            <SmallXIcon />
          </button>
        </div>
      ))}
    </div>
  );
}

function BigDropZone({ onAdd }: { onAdd: (files: UploadedFile[]) => void }) {
  return (
    <FilePicker onPick={onAdd}>
      {(open) => (
        <button className="drop-big" onClick={open} type="button">
          <span className="drop-big-icon">
            <UploadIcon />
          </span>
          <div className="drop-big-title">Drop files or click to upload</div>
          <div className="drop-big-hint">ZIP · 250 MB MAX</div>
        </button>
      )}
    </FilePicker>
  );
}

function SlimDrop({ onAdd }: { onAdd: (files: UploadedFile[]) => void }) {
  return (
    <FilePicker onPick={onAdd}>
      {(open) => (
        <button className="drop-slim" onClick={open} type="button">
          <UploadIcon />
          DROP MORE OR CLICK TO ADD
        </button>
      )}
    </FilePicker>
  );
}

function FilePicker({
  onPick,
  children,
}: {
  onPick: (files: UploadedFile[]) => void;
  children: (open: () => void) => JSX.Element;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const list = Array.from(e.target.files ?? []);
          if (list.length === 0) return;
          onPick(
            list.map((f) => ({
              id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
              name: f.name,
              size: f.size,
              ext: f.name.split(".").pop()?.toUpperCase() ?? "FILE",
            })),
          );
          e.target.value = "";
        }}
      />
      {children(() => ref.current?.click())}
    </>
  );
}

function LangField({
  en,
  es,
  onChangeEn,
  onChangeEs,
  placeholderEn,
  placeholderEs,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
}) {
  return (
    <div className="lang-field">
      <input
        className="lang-field-input"
        value={en}
        onChange={(e) => onChangeEn(e.target.value)}
        placeholder={placeholderEn}
      />
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <input
          className="lang-field-input"
          value={es}
          onChange={(e) => onChangeEs(e.target.value)}
          placeholder={placeholderEs}
        />
        <span className="lang-tag">ESPAÑOL</span>
      </div>
    </div>
  );
}

function RichTextField({
  en,
  es,
  onChangeEn,
  onChangeEs,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
}) {
  const [focus, setFocus] = useState<"en" | "es">("en");

  return (
    <div className="rte-field">
      {focus === "en" && <RteToolbar />}
      <AutoTextarea
        className="rte-area"
        value={en}
        onChange={onChangeEn}
        onFocus={() => setFocus("en")}
      />
      <div className="rte-field-divider" />
      {focus === "es" && <RteToolbar />}
      <div className="rte-lang-row">
        <AutoTextarea
          className="rte-area"
          value={es}
          onChange={onChangeEs}
          onFocus={() => setFocus("es")}
        />
        <span className="lang-tag floating">ESPAÑOL</span>
      </div>
    </div>
  );
}

function RteToolbar() {
  return (
    <div className="rte-toolbar">
      <button className="rte-btn"><BoldIcon /></button>
      <button className="rte-btn"><ItalicIcon /></button>
      <button className="rte-btn"><UnderlineIcon /></button>
      <span className="rte-sep" />
      <button className="rte-btn"><BulletListIcon /></button>
      <button className="rte-btn"><NumberListIcon /></button>
      <button className="rte-btn"><IndentRightIcon /></button>
      <button className="rte-btn"><IndentLeftIcon /></button>
      <span className="rte-sep" />
      <button className="rte-btn"><LinkSmallIcon /></button>
      <button className="rte-btn"><ImageIcon /></button>
      <button className="rte-btn"><VideoIcon /></button>
      <button className="rte-btn"><AudioIcon /></button>
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
  onFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  onFocus?: () => void;
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
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function computeAutoMax(data: WizardData): string {
  const total = data.questionSections.reduce(
    (sum, s) =>
      sum + s.questions.reduce((qsum, q) => qsum + (parseFloat(q.points) || 0), 0),
    0,
  );
  return total.toFixed(2);
}
