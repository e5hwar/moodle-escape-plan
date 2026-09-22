import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type FeedbackForm,
  type FormTrigger,
} from "../data/feedbackForms";
import { tasks as taskLibrary } from "../data/tasks";
import { SmallXIcon, TreeAddIcon } from "./icons";
import { SelectRequirementModal, type RequirementPick } from "./SelectRequirementModal";

type Props = {
  form: FeedbackForm;
  allForms: FeedbackForm[];
  onSave: (triggers: FormTrigger[]) => void;
};

const TODAY = "2026-07-09";

/* The row's suffix names what the trigger IS (Figma 1236:1161: "· Quiz Task",
 * "· Certification"). A Task's own type already ends in "Task" for Hands-On,
 * so only the others take the noun. */
function taskKindLabel(type: string) {
  return type.endsWith("Task") ? type : `${type} Task`;
}

export function FeedbackFormTriggers({ form, allForms, onSave }: Props) {
  const [picking, setPicking] = useState<"task" | "cert" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const addWrapRef = useRef<HTMLDivElement>(null);

  const isDisabled = form.status === "disabled";

  const mappedSet = useMemo(
    () => new Set(form.triggers.map((t) => t.refId)),
    [form.triggers],
  );

  // Live view of the at-most-one-form rule: refName → the OTHER form holding
  // it. Disabled forms still occupy their mappings (preserved, just not
  // firing). Names, not ids: the picker's rows are the real Task and
  // Certification records, and it locks rows by name.
  const takenNames = useMemo(() => {
    const names = new Set<string>();
    for (const f of allForms) {
      for (const t of f.triggers) names.add(t.refName);
    }
    return [...names];
  }, [allForms]);

  /* Name → what to print after the "·". A trigger only stores its id and name,
     so the kind label is derived from the live catalogs; an entry that no
     longer resolves falls back to the trigger's own kind. */
  const taskTypeByName = useMemo(
    () => new Map(taskLibrary.map((t) => [t.name, t.type as string])),
    [],
  );
  function kindLabel(t: FormTrigger) {
    if (t.kind === "certification") return "Certification";
    const type = taskTypeByName.get(t.refName);
    return type ? taskKindLabel(type) : "Task";
  }

  function addPicks(picks: RequirementPick[]) {
    const next = [...form.triggers];
    for (const p of picks) {
      const refId = p.kind === "task" ? p.task.id : p.cert.id;
      const refName = p.kind === "task" ? p.task.name : p.cert.name;
      // Spec: a single Task or Certification is mapped to AT MOST one form.
      if (mappedSet.has(refId) || next.some((t) => t.refName === refName)) continue;
      next.push({
        id: `tr-${Math.random().toString(36).slice(2, 8)}`,
        kind: p.kind === "task" ? "task" : "certification",
        refId,
        refName,
        mappedAt: TODAY,
      });
    }
    onSave(next);
  }

  /* One is the floor — a form with no trigger never fires, so it is not a form
     ([[feedback-forms-architecture]]). The ✕ on a lone trigger says so rather
     than sitting dim and silent (`aria-disabled`, not `disabled`: a disabled
     button swallows the hover the tooltip listens for). */
  const atFloor = form.triggers.length <= 1;
  const floorTip =
    "A form needs at least one trigger — map another one before removing this.";

  function removeTrigger(id: string) {
    if (atFloor) return;
    onSave(form.triggers.filter((t) => t.id !== id));
  }

  // Same dismissal rules as the Questions table's Add menu.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMenuOpen(false);
      }
    }
    function onDown(e: MouseEvent) {
      if (!addWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuOpen]);

  function open(kind: "task" | "cert") {
    setMenuOpen(false);
    setPicking(kind);
  }

  return (
    <>
      {/* Figma 1236:1161 — the Questions table's twin: one `.qz` card whose
          header names the column, one row per mapped item ("Name · Quiz Task")
          and an in-table "+ Add Trigger" last row. The old kind chip, the
          `refId · mapped <date>` subline and the separate picker panel are
          gone; picking now happens in the shared table-picker modal. */}
      <div className="qz">
        <div className="qz-hd">
          <span className="qz-hd-q">TASKS &amp; CERTIFICATIONS</span>
        </div>

        {isDisabled && (
          <div className="fb-archived-note">
            This form is disabled — trigger mappings are preserved but{" "}
            <strong>inactive</strong>. Enable the form to resume firing them.
          </div>
        )}

        {form.triggers.length === 0 && (
          <div className="qz-empty">
            No triggers yet — Add Trigger below maps this form to a Task or
            Certification.
          </div>
        )}

        {form.triggers.map((t) => (
          <div key={t.id} className={`qz-row${isDisabled ? " qz-row--inactive" : ""}`}>
            <div className="qz-q fb-trigger-cell">
              <span className="fb-trigger-name">{t.refName}</span>
              <span className="fb-trigger-kindtext">· {kindLabel(t)}</span>
            </div>
            {isDisabled ? (
              <span className="fb-link-chip">Inactive</span>
            ) : (
              <button
                className="qz-x"
                aria-label="Remove trigger"
                aria-disabled={atFloor}
                data-tip={atFloor ? floorTip : "Remove trigger"}
                onClick={() => removeTrigger(t.id)}
              >
                <SmallXIcon />
              </button>
            )}
          </div>
        ))}

        {!isDisabled && (
          <div className="qz-addrow qz-addrow--last" ref={addWrapRef}>
            <button
              className="qz-addrow-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <TreeAddIcon />
              Add Trigger
            </button>
            {menuOpen && (
              <div className="u-menu qz-menu" role="menu">
                <button
                  className="u-menu-item qz-menu-item"
                  role="menuitem"
                  onClick={() => open("task")}
                >
                  <span className="qz-menu-label">Add Tasks</span>
                </button>
                <button
                  className="u-menu-item qz-menu-item"
                  role="menuitem"
                  onClick={() => open("cert")}
                >
                  <span className="qz-menu-label">Add Certifications</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Portalled to <body>, like the Questions picker: the wizard pane is
          animated with a transform, which would otherwise turn the overlay's
          position:fixed into a local box. */}
      {picking &&
        createPortal(
          <SelectRequirementModal
            only={picking}
            /* Same size as Select Questions: these two catalogs are long, and
               the form's other picker already fills the screen. */
            full
            title={picking === "task" ? "Add Tasks" : "Add Certifications"}
            description={
              picking === "task"
                ? "Completing one of these Tasks shows this form."
                : "Completing one of these Certifications shows this form."
            }
            confirmNoun={picking === "task" ? "Task" : "Certification"}
            existingNames={takenNames}
            lockedTip="Already mapped to a Feedback Form — a Task or Certification can only show one."
            onCancel={() => setPicking(null)}
            onConfirm={(picks) => {
              addPicks(picks);
              setPicking(null);
            }}
          />,
          document.body,
        )}
    </>
  );
}
