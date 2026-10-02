import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DropdownCaretIcon, AlertCircleFilledIcon, CrumbChevronIcon } from "./icons";
import { NoteCard } from "./NoteCard";
import { leave, useTouchedKeys } from "./fieldFlags";
import { MultiSelectTags } from "./MultiSelectTags";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import { ImagePicker } from "./ImageUploadField";
import { SelectTasksModal } from "./SelectTasksModal";
import { SelectSkillsModal } from "./SelectSkillsModal";
import { RichTextField } from "./RichTextField";
import { CharCount, LimitError } from "./CharCount";
import { DESCRIPTION_MAX, NAME_MAX, isOver, limitClass, limitLabel } from "../data/fieldLimits";
import { draftKey, useLeaveGuard } from "./LeaveGuard";
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
  /** Skills has no sidebar entry — it hangs off Tasks — so the trail starts there. */
  onBackToTasks: () => void;
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
  /* The form as it opened — blank, or the record being edited. Leaving asks
     (the shared LeaveGuard) only once the form differs from that, so an
     untouched page closes straight away. Save leaves directly: nothing is
     being thrown away. */
  const pristine = useRef(data);
  const dirty = draftKey(data) !== draftKey(pristine.current);
  const guard = useLeaveGuard(dirty, { noun, creating: !isEditing });
  const requestClose = () => guard(onClose);

  const nameValid = data.nameEn.trim().length > 0;
  const criteriaValid = isMastery ? data.skillIds.length > 0 : data.taskIds.length > 0;
  // Soft character limits (data/fieldLimits.ts) block the save while over.
  const nameOver = isOver(NAME_MAX, data.nameEn, data.nameEs);
  const descOver = isOver(DESCRIPTION_MAX, data.descEn, data.descEs);
  const fieldsValid = nameValid && criteriaValid && !nameOver && !descOver;
  /* Editing with nothing changed: there is nothing to save, so Save Changes
     stays dimmed (and ⌘↵ does nothing) until a field actually differs. */
  const unchanged = isEditing && !dirty;
  const canSave = fieldsValid && !unchanged;
  /* Set by a blocked Create / Save (click or ⌘↵). From then on each empty
     mandatory field carries the label-row error until it is filled — never
     while the form is first being filled in. */
  const [attempted, setAttempted] = useState(false);
  // ...or the field was clicked into and out of while empty (fieldFlags.tsx).
  const { touched, touch } = useTouchedKeys();
  const nameMissing = !nameValid && (attempted || touched.has("name"));
  const criteriaMissing = !criteriaValid && (attempted || touched.has("criteria"));

  /* ⌘/Ctrl+Enter is the footer's only button, and waits on the same fields. */
  useWizardEnterShortcut(() => {
    if (canSave) handleSave();
    else if (!fieldsValid) setAttempted(true);
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
    : fieldsValid
    ? "No changes to save"
    : [
        "Fill in every required field to save:",
        ...[
          !nameValid && "• Name",
          !criteriaValid && (isMastery ? "• Linked Skills" : "• Awarding Tasks"),
          nameOver && `• ${limitLabel("Name", NAME_MAX)}`,
          descOver && `• ${limitLabel("Description", DESCRIPTION_MAX)}`,
        ].filter(Boolean),
      ].join("\n");

  return (
    <div className="wizard">
      <div className="wizard-body">
        <div className="wizard-main">
          <div className="wizard-content">
            <div className="wizard-paneout">
              <div className="wizard-pane">
                {/* Shared breadcrumb strip (.rvc-crumbs, Figma 1417:1395): the
                    full trail above this page — Skills hangs off Tasks — and
                    every step navigates. It never names the page itself. */}
                <nav className="rvc-crumbs" aria-label="Breadcrumb">
                  <button className="rvc-crumb" onClick={() => guard(props.onBackToTasks)} title="Back to Tasks">
                    Tasks
                  </button>
                  <CrumbChevronIcon />
                  <button className="rvc-crumb" onClick={requestClose} title="Back to Skills">
                    Skills
                  </button>
                </nav>
                <div className="rvc-pagehead">
                  <h1 className="tasks-title">{title}</h1>
                </div>
                <p className="tasks-subtitle wizard-desc">{COPY[props.kind].pageSub}</p>

                <DetailsStep data={data} update={update} isMastery={isMastery} nameMissing={nameMissing} touch={touch} />

                {isMastery ? (
                  <LinkedSkillsStep data={data} update={update} allSkills={props.allSkills} missing={criteriaMissing} touch={touch} />
                ) : (
                  <CriteriaStep data={data} update={update} missing={criteriaMissing} touch={touch} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={requestClose}>Cancel</button>
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
            onClick={() => { if (canSave) handleSave(); else if (!fieldsValid) setAttempted(true); }}
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
  touch,
  data,
  update,
  isMastery,
  nameMissing = false,
}: {
  touch: (key: string) => void;
  data: Data;
  update: (p: Partial<Data>) => void;
  isMastery: boolean;
  /** A blocked save found the name empty. */
  nameMissing?: boolean;
}) {
  const noun = isMastery ? "Mastery Skill" : "Skill";
  const copy = COPY[isMastery ? "mastery" : "skill"];

  return (
    <>
      <div className="form-group" onBlur={leave(() => touch("name"))}>
        <label className="form-label">
          Name<span className="req">*</span>
          {nameMissing && <span className="form-label-error">Name cannot be left empty</span>}
          <LimitError max={NAME_MAX} values={[data.nameEn, data.nameEs]} />
        </label>
        <LangField
          en={data.nameEn}
          es={data.nameEs}
          onChangeEn={(v) => update({ nameEn: v })}
          onChangeEs={(v) => update({ nameEs: v })}
          placeholderEn="Name..."
          placeholderEs="Nombre..."
          error={nameMissing}
          maxLength={NAME_MAX}
        />
        <p className="form-help">{copy.name}</p>
      </div>

      <div className="form-group">
        <label className="form-label">
          Description
          <LimitError max={DESCRIPTION_MAX} values={[data.descEn, data.descEs]} />
        </label>
        <RichTextField
          en={data.descEn}
          es={data.descEs}
          onChangeEn={(v) => update({ descEn: v })}
          onChangeEs={(v) => update({ descEs: v })}
          placeholderEn="Description..."
          placeholderEs="Descripción..."
          maxLength={DESCRIPTION_MAX}
        />
        <p className="form-help">{copy.desc}</p>
      </div>

      <div className="form-group">
        <label className="form-label">{noun} Icon<span className="req">*</span></label>
        <ImagePicker />
        <p className="form-help">{copy.icon}</p>
      </div>
    </>
  );
}

/* ─────────────── Skill awarding criteria ─────────────── */

function CriteriaStep({
  touch,
  data,
  update,
  missing = false,
}: {
  touch: (key: string) => void;
  data: Data;
  update: (p: Partial<Data>) => void;
  /** A blocked save found no Task chosen. */
  missing?: boolean;
}) {
  const selected = data.taskIds;

  return (
    <>
      <div className="form-group" onBlur={leave(() => touch("criteria"))}>
        <label className="form-label">
          Awarding Tasks<span className="req">*</span>
          {missing && <span className="form-label-error">Awarding Tasks cannot be left empty</span>}
        </label>
        <TaskPicker selected={selected} onChange={(ids) => update({ taskIds: ids })} error={missing} onLeave={() => touch("criteria")} />
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
  error = false,
  onLeave,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
  /** The dropdown shell's red edge (Figma 1376:1618) — same trigger, same flag. */
  error?: boolean;
  /** The picker was opened and closed (fieldFlags.tsx). The trigger is a div,
   *  not a focusable control, so "clicked into and out of" is the modal's
   *  open-and-close rather than a blur. */
  onLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pool = tasks;
  const chosen = selected
    .map((id) => pool.find((t) => t.id === id))
    .filter((t): t is Task => !!t);

  return (
    <>
      <div className="multiselect">
        <div className={`multiselect-field${error ? " has-error" : ""}`} onClick={() => setOpen(true)}>
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
          onCancel={() => { setOpen(false); onLeave?.(); }}
          onConfirm={(ids) => {
            onChange(ids);
            setOpen(false);
            onLeave?.();
          }}
        />,
        document.body,
      )}
    </>
  );
}

/* ─────────────── Mastery linked Skills ─────────────── */

/* Linked Skills opens the Select Skills table modal from the same dropdown
   field (Figma 101:272) the Awarding Tasks picker uses — choosing the Skills
   that make up a job wants each Skill's Tasks, Certifications and Industries
   in view, which a one-line menu row can't carry. */
function LinkedSkillsStep({
  touch,
  data,
  update,
  allSkills,
  missing = false,
}: {
  touch: (key: string) => void;
  data: Data;
  update: (p: Partial<Data>) => void;
  allSkills: Skill[];
  /** A blocked save found no Skill chosen. */
  missing?: boolean;
}) {
  const selected = data.skillIds;

  const [open, setOpen] = useState(false);

  const chosen = selected
    .map((id) => allSkills.find((s) => s.id === id))
    .filter((s): s is Skill => !!s);
  const archivedChosen = chosen.filter((s) => s.status === "Archived");

  return (
    <>
      <div className="form-group" onBlur={leave(() => touch("criteria"))}>
        <label className="form-label">
          Linked Skills<span className="req">*</span>
          {missing && <span className="form-label-error">Linked Skills cannot be left empty</span>}
        </label>
        <div className="multiselect">
          <div className={`multiselect-field${missing ? " has-error" : ""}`} onClick={() => setOpen(true)}>
            {chosen.length === 0 ? (
              <span className="multiselect-placeholder">Select Skills</span>
            ) : (
              <MultiSelectTags
                tags={chosen.map((s) => ({
                  key: s.id,
                  label: s.name,
                  onRemove: () => update({ skillIds: selected.filter((x) => x !== s.id) }),
                }))}
              />
            )}
            <span className="field-chevron"><DropdownCaretIcon /></span>
          </div>
        </div>
        {/* Portalled for the same reason as Select Tasks: the wizard container
            is transformed, which would trap the fixed overlay. */}
        {open && createPortal(
          <SelectSkillsModal
            skills={allSkills}
            value={selected}
            onCancel={() => { setOpen(false); touch("criteria"); }}
            onConfirm={(ids) => {
              update({ skillIds: ids });
              setOpen(false);
              touch("criteria");
            }}
          />,
          document.body,
        )}
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
    <NoteCard
      icon={<AlertCircleFilledIcon />}
      title="Applies to Existing Users"
      body={`Anyone who already meets the criteria gets this ${noun} when you save, without a notification or email.`}
    />
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
  error = false,
  maxLength,
}: {
  en: string;
  es: string;
  onChangeEn: (v: string) => void;
  onChangeEs: (v: string) => void;
  placeholderEn?: string;
  placeholderEs?: string;
  /** Mandatory and empty after a blocked save — reddens the shell; the
   *  message lives in the caller's label row. */
  error?: boolean;
  /** A SOFT limit per language: each row shows the characters left and the
   *  shell flags amber past the suggested length, red past the limit — the
   *  caller's label row names the tier (`LimitError`) and the save gate
   *  blocks on the red one. */
  maxLength?: number;
}) {
  const flag = error ? "has-error" : maxLength !== undefined ? limitClass(maxLength, en, es) : "";
  const over = flag === "has-error";
  return (
    <div className={`lang-field ${flag}`}>
      <div className="lang-field-row">
        <span className="lang-tag">EN</span>
        <input className="lang-field-input" value={en} placeholder={placeholderEn} aria-invalid={error || over || undefined} onChange={(e) => onChangeEn(e.target.value)} />
        {maxLength !== undefined && <CharCount value={en} max={maxLength} />}
      </div>
      <div className="lang-field-divider" />
      <div className="lang-field-row">
        <span className="lang-tag">ES</span>
        <input className="lang-field-input" value={es} placeholder={placeholderEs} onChange={(e) => onChangeEs(e.target.value)} />
        {maxLength !== undefined && <CharCount value={es} max={maxLength} />}
      </div>
    </div>
  );
}

