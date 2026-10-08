import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DropdownCaretIcon,
  } from "./icons";
import { useTouchedKeys } from "./fieldFlags";
import { TemplatePickerModal } from "./TemplatePickerModal";
import { RadioCard } from "./NewCompanyWizard";
import { ConfirmModal } from "./AwardTableParts";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import { draftKey, useLeaveGuard } from "./LeaveGuard";
import { type Certification } from "../data/certifications";
import { appToday } from "../data/companies";
import {
  MERIT_TIERS,
  MERIT_INTENT,
  fmtHolders,
  issueAwardId,
  completedUsersCount,
  type Award,
  type AwardDesignTemplate,
  type AwardStatus,
  type MeritTier,
} from "../data/awards";

type Props = {
  /** The Certification this Award belongs to. An Award has no life of its own:
   *  it is reached from its Certification's row menu and can never be moved to
   *  another one, so the Certification is context here, not a field. */
  certification: Certification;
  /** That Certification's existing Award, when it already has one. */
  editingAward?: Award;
  allAwards: Award[];
  templates: AwardDesignTemplate[];
  onClose: () => void;
  onSave: (award: Award) => void;
  /** Removes the Award from its Certification. Absent while adding one. */
  onDelete?: () => void;
};

type Data = {
  certificationId: string;
  meritTier: MeritTier;
  cardTemplateId?: string;
  certificateTemplateId?: string;
  status: AwardStatus;
};

function initialData(p: Props): Data {
  if (p.editingAward) {
    const a = p.editingAward;
    return {
      certificationId: p.certification.id,
      meritTier: a.meritTier,
      cardTemplateId: a.cardTemplateId,
      certificateTemplateId: a.certificateTemplateId,
      status: a.status,
    };
  }
  return { certificationId: p.certification.id, meritTier: "Bronze", status: "Active" };
}

/**
 * Add / Manage Award — ONE page, belonging to one Certification.
 *
 * An Award carries four decisions and no authored content, which never needed a
 * two-step wizard: the step rail, the edge-line gate and the Next button are
 * gone, and the fields are a flat stack in the order the two steps used to run
 * ([[wizard-flat-layout]]). The shell is the Skill wizard's: breadcrumb head,
 * one primary footer button that names what it is waiting for.
 *
 * There is no Linked Certification field. Awards lost their own page, and the
 * only way in is a Certification's row menu, so the Certification is the page's
 * context — in the breadcrumb and the subtitle — rather than something to pick.
 * The rest are shared design-system components: the Single-Select menu
 * (591:1382 / 668:943), the segmented Single-Select (359:2373 / 639:895) and
 * the note card (1121:1671).
 */
export function NewAwardWizard(props: Props) {
  const { onClose, certification: cert } = props;
  const isEditing = !!props.editingAward;
  const [data, setData] = useState<Data>(() => initialData(props));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = (patch: Partial<Data>) => setData((d) => ({ ...d, ...patch }));

  /* The page as it opened — an existing Award prefills it, so an untouched
     Manage Award is clean too. Anything changed makes leaving stop to ask (the
     shared LeaveGuard); Save and Delete commit, so they leave directly. */
  const pristine = useRef(data);
  const dirty = draftKey(data) !== draftKey(pristine.current);
  const guard = useLeaveGuard(dirty, { noun: "Award", creating: !isEditing });
  const requestClose = () => guard(onClose);

  // Every Award should display a Card on the Portfolio; require at least one
  // appearance.
  const appearanceValid = !!data.cardTemplateId || !!data.certificateTemplateId;
  // Editing with nothing changed: nothing to save, so Save Changes stays dimmed.
  const unchanged = isEditing && !dirty;
  const canSave = appearanceValid && !unchanged;
  // Either design picker says so once it has been opened and closed empty, or
  // after a blocked save (fieldFlags.tsx) — one appearance satisfies both.
  const { touched, touch } = useTouchedKeys();
  const [attempted, setAttempted] = useState(false);
  const cardMissing = !appearanceValid && (attempted || touched.has("card"));
  const certificateMissing = !appearanceValid && (attempted || touched.has("certificate"));

  /* ⌘/Ctrl+Enter is the footer's only button, and waits on the same fields. */
  useWizardEnterShortcut(() => {
    if (canSave && !confirmDelete) handleSave();
    else if (!confirmDelete) setAttempted(true);
  });

  function handleSave() {
    // The app's one clock, in the Awards' "Mon DD, YYYY" stamp.
    const now = appToday().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    const base = props.editingAward;
    /* Active issues retroactively to everyone who already completed the
       Certification (the Status help text's promise), so the holder count is
       at least that; Archived issues to no one new. */
    const holders =
      data.status === "Active"
        ? Math.max(base?.holders ?? 0, completedUsersCount(data.certificationId))
        : base?.holders ?? 0;
    props.onSave({
      id: base?.id ?? issueAwardId(props.allAwards),
      certificationId: data.certificationId,
      meritTier: data.meritTier,
      cardTemplateId: data.cardTemplateId,
      certificateTemplateId: data.certificateTemplateId,
      status: data.status,
      createdBy: base?.createdBy ?? "SkillCat",
      holders,
      dateCreated: base?.dateCreated ?? now,
      dateModified: now,
    });
    onClose();
  }

  /* The row menu's own two labels (Figma 1226:1425), so the page the entry
     opens is headed by the words that opened it. */
  const title = isEditing ? "Manage Award" : "Add Award";

  /* What the dimmed button is waiting for. The step rail used to report this,
     and a one-page form has no rail — so the button says it on hover. */
  const blockedTip = canSave
    ? undefined
    : appearanceValid
    ? "No changes to save"
    : "An Award needs at least one appearance to save: a Card or a Certificate design.";

  return (
    <div className="wizard">
      <div className="wizard-body">
        <div className="wizard-main">
          <div className="wizard-content">
            <div className="wizard-paneout">
              <div className="wizard-pane">
                {/* Shared breadcrumb strip (.rvc-crumbs, Figma 1417:1395). Certifications is the way
                    back out; there is no page for one Certification, so it gets
                    no crumb — every crumb is clickable. */}
                <nav className="rvc-crumbs" aria-label="Breadcrumb">
                  <button className="rvc-crumb" onClick={requestClose} title="Back to Certifications">
                    Certifications
                  </button>
                </nav>
                <div className="rvc-pagehead">
                  <h1 className="tasks-title">{title}</h1>
                </div>
                <p className="tasks-subtitle wizard-desc">
                  Completing {cert.name} issues this Award. Set its Merit Tier and
                  choose how it appears in the user’s Portfolio.
                </p>

                <MeritTierField data={data} update={update} />
                {/* Status only exists once the Award does. A brand-new Award is
                    Active by definition — you are creating it in order to issue
                    it — so offering "Archived" here would only be a way to make
                    an Award that does nothing. Archiving is a later decision,
                    taken on Manage Award. */}
                {isEditing && <StatusField data={data} update={update} />}

                {/* Both carry the `*`: an Award needs at least one appearance,
                    so neither is individually optional — which one you drop is
                    the choice. The blocked Create button spells the rule out. */}
                <TemplateField
                  label="Card Design"
                  required
                  error={cardMissing}
                  onLeave={() => touch("card")}
                  templates={props.templates}
                  selectedId={data.cardTemplateId}
                  onSelect={(id) => update({ cardTemplateId: id })}
                  emptyLabel="No Card"
                  pickerTitle="Select Card Design"
                  pickerDescription="Pick the Design Template for this Award’s Card on the user’s Portfolio."
                  awards={props.allAwards}
                  help="Compact visual shown on the user’s Portfolio. Recommended for every Award."
                />
                <TemplateField
                  label="Certificate Design"
                  required
                  error={certificateMissing}
                  onLeave={() => touch("certificate")}
                  templates={props.templates}
                  selectedId={data.certificateTemplateId}
                  onSelect={(id) => update({ certificateTemplateId: id })}
                  emptyLabel="No Certificate"
                  pickerTitle="Select Certificate Design"
                  pickerDescription="Pick the Design Template for this Award’s Certificate."
                  awards={props.allAwards}
                  help="Detailed document for printing, PDF export, and formal verification — Trade School diplomas, for example."
                />

              </div>
            </div>
          </div>
        </div>

        <AwardPreview
          card={props.templates.find((t) => t.id === data.cardTemplateId)}
          certificate={props.templates.find((t) => t.id === data.certificateTemplateId)}
        />
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={requestClose}>Cancel</button>
          {/* Deleting the Award is the only way to give the Certification its
              "Add Award" entry back, and the Awards table that used to carry
              the action is gone — so it sits here, on the footer's left, far
              from Save: the destructive CTA (Figma 495:2247), double-confirmed. */}
          {isEditing && props.onDelete && (
            <button
              className="btn-publish btn-publish--danger"
              onClick={() => setConfirmDelete(true)}
            >
              Delete Award
            </button>
          )}
        </div>
        <div className="wizard-actions">
          {/* `aria-disabled` rather than `disabled`, the same way the Skill and
              Task wizards gate saving: a disabled button fires no mouse events,
              so it could neither show the tooltip naming what is missing nor
              answer a click by pointing at it. */}
          <button
            className={`btn-publish${canSave ? "" : " is-disabled"}`}
            aria-disabled={!canSave}
            data-tip={blockedTip}
            onClick={() => { if (canSave) handleSave(); else if (!appearanceValid) setAttempted(true); }}
          >
            {isEditing ? "Save Changes" : "Create Award"}
            <WizardKeyHint />
          </button>
        </div>
      </footer>

      {confirmDelete && props.editingAward && (
        <ConfirmModal
          title="Delete this Award?"
          confirmLabel="Delete Award"
          danger
          doubleConfirm={
            <>
              The Award for <strong>{cert.name}</strong> will be permanently deleted, and{" "}
              {fmtHolders(props.editingAward.holders)} user
              {props.editingAward.holders === 1 ? "’s" : "s’"} Cards and Certificates will stop
              being valid. This can’t be undone.
            </>
          }
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            props.onDelete?.();
          }}
        >
          <p>
            Delete the Award for <strong>{cert.name}</strong> ({props.editingAward.id})? This
            permanently removes it from the{" "}
            <strong>{fmtHolders(props.editingAward.holders)}</strong> user
            {props.editingAward.holders === 1 ? "" : "s"} who earned it — their Card and
            Certificate, and the public verification page, will no longer be valid. This can’t be
            undone.
          </p>
        </ConfirmModal>
      )}
    </div>
  );
}

/* ─────────────── Merit Tier ─────────────── */

/* Radio cards, one per tier — what each tier is FOR is the card's own
   description, so the set reads at a glance with no tooltip to hover. The
   cards stay plain: the tier colours belong to the Portfolio and the table
   pill. */
function MeritTierField({
  data,
  update,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">
        Merit Tier<span className="req">*</span>
      </label>
      <div className="radio-card-group">
        {MERIT_TIERS.map((tier) => (
          <RadioCard
            key={tier}
            selected={data.meritTier === tier}
            onSelect={() => update({ meritTier: tier })}
            title={tier}
            desc={MERIT_INTENT[tier]}
          />
        ))}
      </div>
      <p className="form-help">
        Tiers are fixed and control where the Award sits in the user’s Portfolio — Platinum at the
        top, Bronze at the bottom.
      </p>
    </div>
  );
}

/* ─────────────── Status ─────────────── */

function StatusField({
  data,
  update,
}: {
  data: Data;
  update: (p: Partial<Data>) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">Status</label>
      <div className="seg-control">
        <button
          type="button"
          className={`seg-btn accent ${data.status === "Active" ? "active" : ""}`}
          onClick={() => update({ status: "Active" })}
        >
          Active
        </button>
        <button
          type="button"
          className={`seg-btn accent ${data.status === "Archived" ? "active" : ""}`}
          onClick={() => update({ status: "Archived" })}
        >
          Archived
        </button>
      </div>
      {/* The two statuses do genuinely different things, so the subtext reports
          the chosen one rather than describing both at once. */}
      <p className="form-help">
        {data.status === "Active"
          ? "Issued to anyone who completes the Certification. Users who already completed it receive it retroactively when you save."
          : "Stops being issued to new users. Existing holders keep it."}
      </p>
    </div>
  );
}

/* ─────────────── Card / Certificate appearance ─────────────── */

/* An appearance is a Design Template, picked in the template picker (Figma
   682:2321, run single-pick like Find a Deep Link). The field is a plain
   Single-Select shell — name and caret, no artwork; the picker's rows and the
   preview rail show the picture. "No Card" / "No Certificate" is a row in the
   picker rather than a clear button, because no appearance is a real answer
   for the Certificate. */
function TemplateField({
  label,
  help,
  required = false,
  emptyLabel,
  pickerTitle,
  pickerDescription,
  templates,
  awards,
  selectedId,
  onSelect,
  error = false,
  onLeave,
}: {
  label: string;
  help: string;
  required?: boolean;
  /** No appearance chosen yet, and this picker has been opened and closed
   *  (or a save was blocked): the field's red edge (Figma 1376:1618). */
  error?: boolean;
  /** The picker was opened and closed (fieldFlags.tsx). */
  onLeave?: () => void;
  /** The "no template" row's label, e.g. "No Certificate". */
  emptyLabel: string;
  pickerTitle: string;
  pickerDescription: string;
  templates: AwardDesignTemplate[];
  awards: Award[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = selectedId ? templates.find((t) => t.id === selectedId) : undefined;
  const value = selected?.name ?? emptyLabel;

  const close = () => {
    setOpen(false);
    onLeave?.();
  };

  return (
    <div className="form-group">
      <label className="form-label">
        {label}{required && <span className="req">*</span>}
        {error && (
          <span className="form-label-error">Choose a Card or a Certificate design</span>
        )}
      </label>
      <button
        type="button"
        className={`select-field select-field--full${open ? " is-open" : ""}${error ? " has-error" : ""}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span className="select-field-value">{value}</span>
        <span className="field-chevron"><DropdownCaretIcon /></span>
      </button>
      {/* Templates themselves are managed on Product Config › Award Templates —
          this field only picks one. */}
      <p className="form-help">{help}</p>
      {/* Portalled: `.wizard-pane` carries a transform, which would turn the
          overlay's `position: fixed` into a box inside the pane. */}
      {open && createPortal(
        <TemplatePickerModal
          title={pickerTitle}
          description={pickerDescription}
          emptyLabel={emptyLabel}
          templates={templates}
          awards={awards}
          selectedId={selectedId}
          onCancel={close}
          onPick={(id) => {
            onSelect(id);
            close();
          }}
        />,
        document.body,
      )}
    </div>
  );
}

/* ─────────────── Preview rail ─────────────── */

/* What the Award will look like, in the same right-hand rail the company
   wizard puts its billing preview in (`.cw-impact`), at Manage Subscription's
   480px. The artwork itself is a placeholder (user, 2026-10-07): a plain
   black box at the Card's 8:5 / the Certificate's landscape shape, whatever
   template is picked — the real render needs the template's positioned
   dynamic fields, which aren't built. */
function AwardPreview({
  card,
  certificate,
}: {
  card?: AwardDesignTemplate;
  certificate?: AwardDesignTemplate;
}) {
  return (
    <aside className="aw-preview">
      <h2 className="aw-preview-title">Preview</h2>

      {!card && !certificate ? (
        <div className="aw-preview-empty">
          Pick a Card or Certificate design and it appears here.
        </div>
      ) : (
        <>
          {card && (
            /* Laid out like a form field (user, 2026-10-07 — Figma list
               item 75): label, the artwork where the control would be, and
               the picked template's name as the subtext. */
            <div className="form-group aw-preview-slot">
              <div className="form-label">Card</div>
              <div className="art-ph aw-art aw-art--card">
                The Card must show here with the Viewer's data used for the dynamic fields
              </div>
              <p className="form-help">{card.name}</p>
            </div>
          )}

          {certificate && (
            <div className="form-group aw-preview-slot">
              <div className="form-label">Certificate</div>
              <div className="art-ph aw-art aw-art--cert">
                The Certificate must show here with the Viewer's data used for the dynamic fields
              </div>
              <p className="form-help">{certificate.name}</p>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
