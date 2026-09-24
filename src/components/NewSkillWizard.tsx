import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { DropdownCaretIcon, ChevronRightIcon, AlertCircleFilledIcon } from "./icons";
import { MultiSelectTags } from "./MultiSelectTags";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import { MultiSelect } from "./NewCompanyWizard";
import { ImagePicker } from "./ImageUploadField";
import { SelectTasksModal } from "./SelectTasksModal";
import { RichTextField } from "./RichTextField";
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

/* Every user-facing line that differs between the two records. A Skill is one
 * step of a job, earned off Tasks; a Mastery Skill is the job itself, earned
 * off Skills — so these are genuinely different sentences rather than one
 * sentence with the noun swapped, and a lookup beats interpolation. */
const COPY: Record<Kind, { pageSub: string; name: string; desc: string; icon: string }> = {
  skill: {
    pageSub: "Name this Skill, then choose the Tasks that award it",
    name: "Start with a verb, like “Brazing a Copper Joint.” It should make sense as “Can you ___?” from a supervisor.",
    desc: "What the user can do once they’ve earned this Skill.",
    icon: "Shown on the user’s Portfolio and when previewing Certifications. A greyed-out version is generated automatically for Skills the user hasn’t earned yet.",
  },
  mastery: {
    pageSub: "Name this Mastery Skill, then choose the Skills that make it up.",
    name: "Name a real job, not a topic. Example: “Install a Mini-Split System”",
    desc: "The job a user can do once they’ve earned this Mastery Skill. Shown on their Portfolio.",
    icon: "Shown on the user’s Portfolio and when previewing Certifications. A greyed-out version is generated automatically for users who haven’t earned it yet.",
  },
};

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
  const { onClose } = props;
  const isEditing = !!(props.editingSkill || props.editingMastery);
  /* One page, one form, both kinds: `kind` comes from which Create button was
     pressed on the Skills page (or which record is being edited) and decides
     which criteria field is on screen and which save the footer fires. It is
     not a field here — a Skill and a Mastery Skill are different records, so
     switching mid-form would be a conversion, not an edit. */
  const isMastery = props.kind === "mastery";
  const noun = isMastery ? "Mastery Skill" : "Skill";
  const [data, setData] = useState<Data>(() => initialData(props));
  const update = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  const nameValid = data.nameEn.trim().length > 0;
  const criteriaValid = isMastery ? data.skillIds.length > 0 : data.taskIds.length > 0;
  const canSave = nameValid && criteriaValid;

  /* ⌘/Ctrl+Enter is the footer's only button, and waits on the same fields. */
  useWizardEnterShortcut(() => {
    if (canSave) handleSave();
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
        // The control is always on screen now, so the picked rule is always a
        // deliberate choice — no need to normalise a single-Task Skill to
        // "all", which used to silently undo the choice on the next edit.
        rule: data.rule,
        createdBy: base?.createdBy ?? "SkillCat",
        holders: base?.holders ?? 0,
        dateCreated: base?.dateCreated ?? now,
        dateModified: now,
      });
    }
    onClose();
  }

  /* What the dimmed Save is waiting for. The step rail used to report this, and
     a one-page form has no rail — so the button says it on hover instead. */
  const title = isEditing ? `Edit ${noun}` : `New ${noun}`;
  const blockedTip = canSave
    ? undefined
    : [
        "Fill in every required field to save:",
        ...[
          !nameValid && "• Name",
          !criteriaValid && (isMastery ? "• Linked Skills" : "• Awarding Tasks"),
        ].filter(Boolean),
      ].join("\n");

  return (
    <div className="wizard">
      <div className="wizard-body">
        <div className="wizard-main">
          <div className="wizard-content">
            <div className="wizard-paneout">
              <div className="wizard-pane">
                {/* Shared crumb row (.rvc-pagehead): the wizard is reached
                    from Skills, and "Skills" is also the way back out, so it
                    stays a button; the record itself is the current crumb. */}
                <div className="rvc-pagehead">
                  <nav className="rvc-crumbs" aria-label="Breadcrumb">
                    <button className="rvc-crumb" onClick={onClose} title="Back to Skills">
                      Skills
                    </button>
                    <ChevronRightIcon />
                    <span className="rvc-crumb rvc-crumb--current">{title}</span>
                  </nav>
                  <h1 className="wizard-title">{title}</h1>
                </div>
                <p className="wizard-desc">{COPY[props.kind].pageSub}</p>

                <DetailsStep data={data} update={update} isMastery={isMastery} />

                {isMastery ? (
                  <LinkedSkillsStep data={data} update={update} allSkills={props.allSkills} />
                ) : (
                  <CriteriaStep data={data} update={update} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
        </div>
        <div className="wizard-actions">
          {/* `aria-disabled` rather than `disabled`, the same way the Task
              wizard gates publishing: a disabled button fires no mouse events,
              so it could neither show the tooltip naming what is missing nor
              answer a click by pointing at it. */}
          <button
            className={`btn-publish${canSave ? "" : " is-disabled"}`}
            aria-disabled={!canSave}
            data-tip={blockedTip}
            onClick={() => { if (canSave) handleSave(); }}
          >
            {isEditing ? "Save Changes" : `Create ${noun}`}
            <WizardKeyHint />
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────── Details fields ─────────────── */

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
  const copy = COPY[isMastery ? "mastery" : "skill"];

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
          placeholderEn="Name..."
          placeholderEs="Nombre..."
        />
        <p className="form-help">{copy.name}</p>
      </div>

      <div className="form-group">
        <label className="form-label">Description</label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
          placeholderEn="Description..."
          placeholderEs="Descripción..."
        />
        <p className="form-help">{copy.desc}</p>
      </div>

      <div className="form-group">
        <label className="form-label">{noun} Icon <span className="req">*</span></label>
        <ImagePicker />
        <p className="form-help">{copy.icon}</p>
      </div>
    </>
  );
}

/* ─────────────── Skill awarding criteria ─────────────── */

function CriteriaStep({ data, update }: { data: Data; update: (p: Partial<Data>) => void }) {
  const selected = data.taskIds;

  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Awarding Tasks <span className="req">*</span>
        </label>
        <TaskPicker selected={selected} onChange={(ids) => update({ taskIds: ids })} />
        <p className="form-help">
          Choose the Tasks that award this Skill. A Task counts as soon as it’s marked complete,
          whatever its completion criteria. The same Task can award more than one Skill.
        </p>
      </div>

      {/* The award rule is its own field, not a control that appears once a
          second Task is picked — the form keeps the same shape from the start,
          and "All selected Tasks" is the default either way. With one Task
          picked the two options mean the same thing, which is harmless. */}
      <div className="form-group">
        <label className="form-label">Award This Skill After</label>
        {/* Both segments take the accent-active variant (Figma 639:895): either
            rule is a real choice, so neither should read as the quieter one. */}
        <div className="seg-control">
          <button
            type="button"
            className={`seg-btn accent ${data.rule === "any" ? "active" : ""}`}
            onClick={() => update({ rule: "any" })}
          >
            Any One Task is Complete
          </button>
          <button
            type="button"
            className={`seg-btn accent ${data.rule === "all" ? "active" : ""}`}
            onClick={() => update({ rule: "all" })}
          >
            All Selected Tasks are Complete
          </button>
        </div>
      </div>

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
            <MultiSelectTags
              tags={chosen.map((t) => ({
                key: t.id,
                label: t.name,
                onRemove: () => onChange(selected.filter((x) => x !== t.id)),
              }))}
            />
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

/* ─────────────── Mastery linked Skills ─────────────── */

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
          searchPlaceholder="Search Skills..."
        />
        <p className="form-help">
          Choose the Skills that make up this job. Holding all of them should mean the user can do
          it. Awarded automatically once a user holds every one.
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

/* Figma 1121:1671 "Skills - Creation": the retroactive-award note is a DS
   callout card — 16px filled alert circle, SemiBold title, muted 14px body. */
function RetroNote({ noun }: { noun: string }) {
  return (
    <div className="note-card">
      <span className="note-card-icon"><AlertCircleFilledIcon /></span>
      <div className="note-card-text">
        <p className="note-card-title">Applies to Existing Users</p>
        <p className="note-card-body">
          Anyone who already meets the criteria gets this {noun} when you save, without a notification or email.
        </p>
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

