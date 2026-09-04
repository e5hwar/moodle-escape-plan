import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SmallXIcon, DropdownCaretIcon } from "./icons";
import { MultiSelect } from "./NewCompanyWizard";
import { ImagePicker } from "./ImageUploadField";
import { SelectTasksModal } from "./SelectTasksModal";
import { RichTextField } from "./RichTextField";
import { WizardStepRail, useWizardStepStatuses } from "./WizardStepRail";
import { useEdgeLineGate, WizardGateEdges } from "./wizardGate";
import { tasks, type Task } from "../data/tasks";
import {
  type AwardRule,
  type MasterySkill,
  type Skill,
  type SkillStatus,
} from "../data/skills";

/* ─────────────── Shared badge (complete + auto-greyed states) ─────────────── */

export function SkillBadge({
  emoji,
  size = 40,
  incomplete = false,
  mastery = false,
}: {
  emoji: string;
  size?: number;
  incomplete?: boolean;
  mastery?: boolean;
}) {
  return (
    <span
      className={`sk-badge ${mastery ? "sk-badge--mastery" : ""} ${incomplete ? "sk-badge--incomplete" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

/* ─────────────── Wizard ─────────────── */

type Kind = "skill" | "mastery";

type Props = {
  kind: Kind;
  editingSkill?: Skill;
  editingMastery?: MasterySkill;
  allSkills: Skill[];
  allMastery: MasterySkill[];
  onClose: () => void;
  onSaveSkill: (skill: Skill) => void;
  onSaveMastery: (mastery: MasterySkill) => void;
};

type Data = {
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  image: string;
  status: SkillStatus;
  // Skill criteria
  taskIds: string[];
  rule: AwardRule;
  // Mastery criteria
  skillIds: string[];
};

function initialData(p: Props): Data {
  if (p.kind === "skill" && p.editingSkill) {
    const s = p.editingSkill;
    return {
      nameEn: s.name, nameEs: s.nameEs ?? "",
      descEn: s.description ?? "", descEs: s.descriptionEs ?? "",
      image: s.image, status: s.status,
      taskIds: [...s.taskIds], rule: s.rule, skillIds: [],
    };
  }
  if (p.kind === "mastery" && p.editingMastery) {
    const m = p.editingMastery;
    return {
      nameEn: m.name, nameEs: m.nameEs ?? "",
      descEn: m.description ?? "", descEs: m.descriptionEs ?? "",
      image: m.image, status: m.status,
      taskIds: [], rule: "all", skillIds: [...m.skillIds],
    };
  }
  return {
    nameEn: "", nameEs: "", descEn: "", descEs: "",
    image: p.kind === "mastery" ? "🏅" : "🔥",
    status: "Active", taskIds: [], rule: "all", skillIds: [],
  };
}

export function NewSkillWizard(props: Props) {
  const { kind, onClose } = props;
  const isMastery = kind === "mastery";
  const isEditing = !!(props.editingSkill || props.editingMastery);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Data>(() => initialData(props));
  const update = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  const STEPS = isMastery
    ? [
        { label: "Details", sub: "Name, description, image", desc: "Name, describe, and illustrate this Mastery Skill." },
        { label: "Linked Skills", sub: "Skills that compose it", desc: "Choose the Skills that make up this Mastery Skill. It is awarded automatically once a user holds all of them." },
      ]
    : [
        { label: "Details", sub: "Name, description, image", desc: "Name, describe, and illustrate this Skill." },
        { label: "Awarding criteria", sub: "Tasks that award it", desc: "Choose the Task or Tasks whose completion awards this Skill." },
      ];

  const nameValid = data.nameEn.trim().length > 0;
  const criteriaValid = isMastery ? data.skillIds.length > 0 : data.taskIds.length > 0;
  // Wheel-past-the-edge step navigation, shared with every other wizard.
  const lastStep = STEPS.length - 1;
  const gate = useEdgeLineGate({ step, setStep, lastStep });
  // Rail glyphs: a step passed with its mandatory field still empty shows the
  // red alert circle rather than a check.
  const stepStatuses = useWizardStepStatuses({
    step,
    count: STEPS.length,
    incomplete: (i) => (i === 0 ? !nameValid : !criteriaValid),
  });

  function handleSave() {
    const now = "Apr 28, 2026";
    if (isMastery) {
      const base = props.editingMastery;
      props.onSaveMastery({
        id: base?.id ?? `MS-${String(props.allMastery.length + 1).padStart(2, "0")}`,
        name: data.nameEn.trim(),
        nameEs: data.nameEs.trim() || undefined,
        description: data.descEn.trim() || undefined,
        descriptionEs: data.descEs.trim() || undefined,
        status: data.status,
        image: data.image,
        skillIds: data.skillIds,
        createdBy: base?.createdBy ?? "SkillCat",
        holders: base?.holders ?? 0,
        dateCreated: base?.dateCreated ?? now,
        dateModified: now,
      });
    } else {
      const base = props.editingSkill;
      props.onSaveSkill({
        id: base?.id ?? `SK-${props.allSkills.length + 113}`,
        name: data.nameEn.trim(),
        nameEs: data.nameEs.trim() || undefined,
        description: data.descEn.trim() || undefined,
        descriptionEs: data.descEs.trim() || undefined,
        status: data.status,
        image: data.image,
        taskIds: data.taskIds,
        rule: data.taskIds.length > 1 ? data.rule : "all",
        createdBy: base?.createdBy ?? "SkillCat",
        holders: base?.holders ?? 0,
        dateCreated: base?.dateCreated ?? now,
        dateModified: now,
      });
    }
    onClose();
  }

  return (
    <div className="wizard">
      <div className="wizard-body">
        <aside className="wizard-nav">
          <div className="wizard-brand">
            <span className="wizard-brand-eyebrow">
              {isEditing ? "Editing" : "Creating"}
            </span>
            <span className="wizard-brand-name">
              {isEditing
                ? props.editingSkill?.name ?? props.editingMastery?.name
                : isMastery
                  ? "New Mastery Skill"
                  : "New Skill"}
            </span>
          </div>

          <ol className="wizard-steps">
            {STEPS.map((s, i) => {
              const status = stepStatuses[i];
              return (
                <li
                  key={s.label}
                  className={`wizard-step ${status}`}
                  onClick={() => gate.goStep(i)}
                >
                  <WizardStepRail status={status} num={i + 1} />
                  <div className="wizard-step-text">
                    <div className="wizard-step-title">{s.label}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="wizard-main">
          <WizardGateEdges
            gate={gate}
            step={step}
            lastStep={lastStep}
            labels={STEPS.map((s) => s.label)}
          />
          <div className="wizard-content" ref={gate.scrollRef}>
            <div className="wizard-paneout" ref={gate.paneOutRef}>
              <div className="wizard-pane" key={step}>
              <h1 className="wizard-title">{STEPS[step].label}</h1>
              <p className="wizard-desc">{STEPS[step].desc}</p>

              {step === 0 && (
                <DetailsStep data={data} update={update} isMastery={isMastery} />
              )}
              {step === 1 && !isMastery && <CriteriaStep data={data} update={update} />}
              {step === 1 && isMastery && (
                <LinkedSkillsStep data={data} update={update} allSkills={props.allSkills} />
              )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          {isEditing && (
            <span className="wizard-saved">Last saved 2 minutes ago</span>
          )}
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn-save-draft wizard-gate-btn" onClick={() => gate.goStep(step - 1)}>
              <span className="wizard-gate-fill" ref={gate.backFillRef} />
              <span className="wizard-gate-btn-inner">Back</span>
            </button>
          )}
          {step === 0 ? (
            <button className="btn-publish wizard-gate-btn" onClick={() => gate.goStep(1)}>
              <span className="wizard-gate-fill" ref={gate.nextFillRef} />
              <span className="wizard-gate-btn-inner">Next: {STEPS[1].label}</span>
            </button>
          ) : (
            <button className="btn-publish" disabled={!nameValid || !criteriaValid} onClick={handleSave}>
              {isEditing ? "Save changes" : "Publish"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── Step 1 — Details ─────────────── */

function DetailsStep({
  data,
  update,
  isMastery,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
  isMastery: boolean;
}) {
  const noun = isMastery ? "Mastery Skill" : "Skill";

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
          placeholderEn={`${noun} name`}
          placeholderEs={isMastery ? "Nombre de la habilidad de maestría" : "Nombre de la habilidad"}
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

      <div className="form-group">
        <label className="form-label">{noun} Icon <span className="req">*</span></label>
        <ImagePicker />
        <p className="form-help">
          This is how the {noun} appears to users when previewing Certifications and on their Portfolio
        </p>
      </div>
    </>
  );
}

/* Matches MultiSelect's own cap so the two fields wrap identically. */
const PILL_LIMIT = 2;

/* ─────────────── Step 2 — Skill awarding criteria ─────────────── */

function CriteriaStep({ data, update }: { data: Data; update: (p: Partial<Data>) => void }) {
  const selected = data.taskIds;
  const multi = selected.length > 1;

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Awarding Tasks <span className="req">*</span>
        </label>
        <TaskPicker selected={selected} onChange={(ids) => update({ taskIds: ids })} />
        <p className="form-help">
          Awarding is based on binary Task completion only — a Task counts once it is marked complete per its completion criteria. The same Task can award multiple Skills.
        </p>
      </div>

      {multi && (
        <div className="form-group">
          <label className="form-label">Awarded when the learner completes…</label>
          <div className="seg-control">
            <button
              type="button"
              className={`seg-btn ${data.rule === "all" ? "active" : ""}`}
              onClick={() => update({ rule: "all" })}
            >
              All of the Tasks
            </button>
            <button
              type="button"
              className={`seg-btn ${data.rule === "any" ? "active" : ""}`}
              onClick={() => update({ rule: "any" })}
            >
              Any one Task
            </button>
          </div>
          <p className="form-help">
            {data.rule === "all"
              ? "The learner must complete every selected Task to earn this Skill."
              : "Completing any one of the selected Tasks earns this Skill."}
          </p>
        </div>
      )}

      <RetroNote noun="Skill" />
    </>
  );
}

/* The same design-system dropdown field as everywhere else (Figma 101:272), but
   clicking it opens the Select Tasks table modal (682:2321) instead of a menu —
   picking an awarding Task wants the Task's type, Certifications and edit date
   in view, which a one-line menu row can't carry. The trigger markup mirrors
   `MultiSelect`'s so the two fields read as one control. */
function TaskPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const pool = tasks;
  const chosen = selected
    .map((id) => pool.find((t) => t.id === id))
    .filter((t): t is Task => !!t);

  return (
    <>
      <div className="multiselect">
        <div className="multiselect-field" onClick={() => setOpen(true)}>
          {chosen.length === 0 ? (
            <span className="multiselect-placeholder">Select Tasks</span>
          ) : (
            <div className="multiselect-tags">
              {chosen.slice(0, PILL_LIMIT).map((t) => (
                <span key={t.id} className="multiselect-tag">
                  {t.name}
                  <button
                    className="multiselect-tag-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(selected.filter((x) => x !== t.id));
                    }}
                    aria-label={`Remove ${t.name}`}
                  >
                    <SmallXIcon />
                  </button>
                </span>
              ))}
              {chosen.length > PILL_LIMIT && (
                <span className="multiselect-tag multiselect-tag-more">
                  +{chosen.length - PILL_LIMIT}
                </span>
              )}
            </div>
          )}
          <span className="field-chevron"><DropdownCaretIcon /></span>
        </div>
      </div>

      {/* Portalled to <body>: the wizard's step container is transformed, which
          would otherwise turn the overlay's position:fixed into a local box and
          centre the card on the pane instead of the window. */}
      {open && createPortal(
        <SelectTasksModal
          value={selected}
          onCancel={() => setOpen(false)}
          onConfirm={(ids) => {
            onChange(ids);
            setOpen(false);
          }}
        />,
        document.body,
      )}
    </>
  );
}

/* ─────────────── Step 2 — Mastery linked Skills ─────────────── */

/* Linked Skills uses the plain dropdown field (Figma 101:272 + 591:1322) — a
   Skill has no table's worth of metadata to weigh up, so the menu is enough. */
function LinkedSkillsStep({
  data,
  update,
  allSkills,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
  allSkills: Skill[];
}) {
  const selected = data.skillIds;

  const byName = useMemo(
    () => new Map(allSkills.map((s) => [s.name, s.id])),
    [allSkills],
  );

  const chosen = selected
    .map((id) => allSkills.find((s) => s.id === id))
    .filter((s): s is Skill => !!s);
  const archivedChosen = chosen.filter((s) => s.status === "Archived");

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Linked Skills <span className="req">*</span>
        </label>
        <MultiSelect
          options={allSkills.map((s) => s.name)}
          value={chosen.map((s) => s.name)}
          onChange={(names) =>
            update({
              skillIds: names
                .map((n) => byName.get(n))
                .filter((id): id is string => !!id),
            })
          }
          placeholder="Select Skills"
          searchPlaceholder="Search Skills…"
        />
        <p className="form-help">
          The Mastery Skill is awarded automatically the moment a user holds <strong>all</strong> linked Skills.
        </p>
      </div>

      {archivedChosen.length > 0 && (
        <div className="form-warning">
          <span className="form-warning-icon"><WarnIcon /></span>
          <div>
            <strong>This Mastery Skill includes {archivedChosen.length} archived Skill{archivedChosen.length === 1 ? "" : "s"}.</strong>{" "}
            New users can’t earn an archived Skill, so they won’t be able to earn this Mastery Skill. Existing holders are unaffected.
          </div>
        </div>
      )}

      <RetroNote noun="Mastery Skill" />
    </>
  );
}

/* ─────────────── Shared ─────────────── */

function RetroNote({ noun }: { noun: string }) {
  return (
    <div className="sk-retro-note">
      <span className="sk-retro-icon"><InfoIcon /></span>
      <div>
        <strong>Retroactive on save.</strong> Every user who already meets the criteria receives this {noun} immediately.
        Retroactive awards do <strong>not</strong> fire Rudderstack events (push notifications, email campaigns) — those only
        trigger when a user earns it through real-time Task completion. Updating criteria later never revokes a {noun} already earned.
      </div>
    </div>
  );
}

const WarnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.3 3.86 1.82 18a1.5 1.5 0 0 0 1.28 2.25h16.8A1.5 1.5 0 0 0 21.18 18L12.7 3.86a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.4v.01M11 12h1v4h1" />
  </svg>
);

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
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input className="lang-field-input" value={en} placeholder={placeholderEn} onChange={(e) => onChangeEn(e.target.value)} />
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input className="lang-field-input" value={es} placeholder={placeholderEs} onChange={(e) => onChangeEs(e.target.value)} />
      </div>
    </div>
  );
}

