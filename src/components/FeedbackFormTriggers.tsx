import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  type FeedbackForm,
  type FormTrigger,
} from "../data/feedbackForms";
import { tasks as taskLibrary } from "../data/tasks";
import { certById } from "../data/certifications";
import { todayStamp } from "../data/companies";
import { InfoIcon14, RowCloseIcon, TreeAddIcon } from "./icons";
import { NoteCard } from "./NoteCard";
import { SelectRequirementModal, type RequirementPick } from "./SelectRequirementModal";

type Props = {
  form: FeedbackForm;
  allForms: FeedbackForm[];
  onSave: (triggers: FormTrigger[]) => void;
  /** The field is flagged — the card takes the error outline (1570:3366). */
  invalid?: boolean;
  /** Reports the picker opening / closing, so the page's other shortcuts
   *  (the Questions field's Q) stand down under it. */
  onPickingChange?: (open: boolean) => void;
};

/* The row's suffix names what the trigger IS (Figma 1236:1161: "· Quiz Task",
 * "· Certification"). A Task's own type already ends in "Task" for Hands-On,
 * so only the others take the noun. */
function taskKindLabel(type: string) {
  return type.endsWith("Task") ? type : `${type} Task`;
}

export function FeedbackFormTriggers({ form, allForms, onSave, invalid = false, onPickingChange }: Props) {
  const [picking, setPickingState] = useState(false);
  const setPicking = (open: boolean) => {
    setPickingState(open);
    onPickingChange?.(open);
  };

  const isDisabled = form.status === "disabled";

  /* The live record a trigger points at, by id — the name it shows and the
     name the picker knows its row by. A trigger whose record is gone keeps
     the name it was mapped under. */
  const taskById = useMemo(() => new Map(taskLibrary.map((t) => [t.id, t])), []);
  const liveName = (t: FormTrigger) =>
    (t.kind === "certification" ? certById(t.refId)?.name : taskById.get(t.refId)?.name) ??
    t.refName;

  // Live view of the at-most-one-form rule, keyed by the mapped record's ID:
  // refId → the form holding it. This form counts as its STAGED copy (the
  // edits not saved yet), every other form as saved. Inactive forms still
  // occupy their mappings (preserved, just not firing); a deleted form is
  // gone from every list, so it frees them. The picker names the holder on
  // each locked row, so it never reads as "preselected".
  const holderById = useMemo(() => {
    const holders = new Map<string, FeedbackForm>();
    for (const f of [...allForms.filter((x) => x.id !== form.id), form]) {
      if (f.status === "deleted") continue;
      for (const t of f.triggers) holders.set(`${t.kind}:${t.refId}`, f);
    }
    return holders;
  }, [allForms, form]);
  /* The picker locks its rows by name, so each held id is handed over as its
     live record's CURRENT name — a rename never frees a mapping. */
  const holderByName = useMemo(() => {
    const byName = new Map<string, FeedbackForm>();
    for (const f of [...allForms.filter((x) => x.id !== form.id), form]) {
      if (f.status === "deleted") continue;
      for (const t of f.triggers) {
        const holder = holderById.get(`${t.kind}:${t.refId}`);
        if (holder) byName.set(liveName(t), holder);
      }
    }
    return byName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allForms, form, holderById]);
  const takenNames = useMemo(() => [...holderByName.keys()], [holderByName]);
  const holderName = (name: string) => {
    const f = holderByName.get(name);
    return f ? f.name || "Untitled form" : undefined;
  };

  /* What to print after the "·". A trigger only stores its id and name, so
     the kind label is derived from the live catalogs; an entry that no
     longer resolves falls back to the trigger's own kind. */
  function kindLabel(t: FormTrigger) {
    if (t.kind === "certification") return "Certification";
    const type = taskById.get(t.refId)?.type as string | undefined;
    return type ? taskKindLabel(type) : "Task";
  }

  function addPicks(picks: RequirementPick[]) {
    const next = [...form.triggers];
    const today = todayStamp();
    for (const p of picks) {
      const kind = p.kind === "task" ? "task" : "certification";
      const refId = p.kind === "task" ? p.task.id : p.cert.id;
      const refName = p.kind === "task" ? p.task.name : p.cert.name;
      // Spec: a single Task or Certification is mapped to AT MOST one form —
      // compared by id, so two records sharing a name never collide.
      if (holderById.has(`${kind}:${refId}`) || next.some((t) => t.kind === kind && t.refId === refId)) continue;
      next.push({
        id: `tr-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        refId,
        refName,
        mappedAt: today,
      });
    }
    onSave(next);
  }

  /* One is the floor — a form with no trigger never fires. The last one can
     still be removed (Figma list item 36): the wizard flags the field at once
     ("A form needs at least one trigger") and the card goes red. */
  function removeTrigger(id: string) {
    onSave(form.triggers.filter((t) => t.id !== id));
  }

  return (
    <>
      {/* An inactive form keeps its mappings but they don't fire — the shared
          callout above the table rather than a line inside it. */}
      {isDisabled && (
        <NoteCard
          className="fb-inactive-note"
          mutedIcon
          icon={<InfoIcon14 />}
          title="This form is inactive"
          body="Its trigger mappings are preserved but don't fire. Activate the form to resume firing them."
        />
      )}
      {/* Figma 1236:1161 — the Questions table's twin: one `.qz` card whose
          header names the column, one row per mapped item ("Name · Quiz Task")
          and an in-table "+ Add Trigger" last row. The old kind chip, the
          `refId · mapped <date>` subline and the separate picker panel are
          gone; picking now happens in the shared table-picker modal. */}
      <div className={`qz${invalid ? " has-error" : ""}`}>
        <div className="qz-hd">
          <span className="qz-hd-q">TASKS &amp; CERTIFICATIONS</span>
        </div>

        {form.triggers.length === 0 && (
          <div className="qz-empty">
            No Triggers Added Yet
          </div>
        )}

        {form.triggers.map((t) => (
          <div key={t.id} className={`qz-row${isDisabled ? " qz-row--inactive" : ""}`}>
            <div className="qz-q fb-trigger-cell">
              <span className="fb-trigger-name">{liveName(t)}</span>
              <span className="fb-trigger-kindtext">· {kindLabel(t)}</span>
            </div>
            {/* An inactive form's triggers stay editable — the note above
                says they don't fire; mapping them now is set-up for when the
                form is activated again. */}
            <button
              className="qz-x"
              aria-label="Remove trigger"
              data-tip="Remove trigger"
              onClick={() => removeTrigger(t.id)}
            >
              <RowCloseIcon />
            </button>
          </div>
        ))}

        <div className="qz-addrow qz-addrow--last">
          {/* Straight into the tabbed picker (Tasks · Certifications, like
              Create Spotlight's Deep Link modal) — one trip can map both
              kinds, so there is no "Add Tasks / Add Certifications" menu. */}
          <button
            className="qz-addrow-btn"
            onClick={() => setPicking(true)}
            aria-haspopup="dialog"
          >
            <TreeAddIcon />
            Add Trigger
          </button>
        </div>
      </div>

      {/* Portalled to <body>, like the Questions picker: the wizard pane is
          animated with a transform, which would otherwise turn the overlay's
          position:fixed into a local box. */}
      {picking &&
        createPortal(
          <SelectRequirementModal
            /* Both tabs, one staged selection: Tasks and Certifications can
               be mapped in the same trip. */
            title="Add Triggers"
            description="Completing any of these Tasks or Certifications shows this form."
            confirmNoun="Trigger"
            /* Only SkillCat-made content every learner can reach (no
               Audience/B2B tag) — a form must be showable to everyone who
               completes its trigger. Certifications lead. */
            allUsersOnly
            certFirst
            existingNames={takenNames}
            lockedFlag={(name) =>
              holderByName.get(name)?.id === form.id
                ? "Already a trigger"
                : `Mapped to ${holderName(name)}`
            }
            lockedTip={(name) =>
              holderByName.get(name)?.id === form.id
                ? "Already a trigger on this form."
                : `Already mapped to “${holderName(name)}” — a Task or Certification can show only one Feedback Form.`
            }
            onCancel={() => setPicking(false)}
            onConfirm={(picks) => {
              addPicks(picks);
              setPicking(false);
            }}
          />,
          document.body,
        )}
    </>
  );
}
