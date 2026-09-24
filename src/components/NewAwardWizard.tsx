import { useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  DropdownCaretIcon,
  InfoIcon14,
} from "./icons";
import { SelectField } from "./SelectField";
import { SectionHeading } from "./SectionHeading";
import { ConfirmModal } from "./AwardTableParts";
import { WizardKeyHint, useWizardEnterShortcut } from "./wizardKeys";
import { type Certification } from "../data/certifications";
import {
  MERIT_TIERS,
  MERIT_HEX,
  MERIT_INTENT,
  fmtHolders,
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
  /** Opens the per-Award recipients report. Absent while adding one. */
  onViewRecipients?: () => void;
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

  // Every Award should display a Card on the Portfolio; require at least one
  // appearance.
  const appearanceValid = !!data.cardTemplateId || !!data.certificateTemplateId;
  const canSave = appearanceValid;

  /* ⌘/Ctrl+Enter is the footer's only button, and waits on the same fields. */
  useWizardEnterShortcut(() => {
    if (canSave && !confirmDelete) handleSave();
  });

  function handleSave() {
    const now = "Apr 28, 2026";
    const base = props.editingAward;
    props.onSave({
      id: base?.id ?? `AW-${props.allAwards.length + 101}`,
      certificationId: data.certificationId,
      meritTier: data.meritTier,
      cardTemplateId: data.cardTemplateId,
      certificateTemplateId: data.certificateTemplateId,
      status: data.status,
      createdBy: base?.createdBy ?? "SkillCat",
      holders: base?.holders ?? 0,
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
    : "An Award needs at least one appearance to save: a Card or a Certificate design.";

  return (
    <div className="wizard">
      <div className="wizard-body">
        <div className="wizard-main">
          <div className="wizard-content">
            <div className="wizard-paneout">
              <div className="wizard-pane">
                {/* Shared crumb row (.rvc-pagehead). The Certification is the
                    middle crumb rather than a field — it is what the Award
                    belongs to, and Certifications is the way back out. There is
                    no page for one Certification, so that crumb is a plain
                    span. */}
                <div className="rvc-pagehead">
                  <nav className="rvc-crumbs" aria-label="Breadcrumb">
                    <button className="rvc-crumb" onClick={onClose} title="Back to Certifications">
                      Certifications
                    </button>
                    <ChevronRightIcon />
                    <span className="rvc-crumb">{cert.name}</span>
                    <ChevronRightIcon />
                    <span className="rvc-crumb rvc-crumb--current">{title}</span>
                  </nav>
                  <h1 className="wizard-title">{title}</h1>
                </div>
                <p className="wizard-desc">
                  Completing <strong>{cert.name}</strong> issues this Award. Set its Merit Tier and
                  choose how it appears in the user’s Portfolio.
                  {isEditing && props.editingAward && props.onViewRecipients && (
                    <>
                      {" "}Held by {fmtHolders(props.editingAward.holders)} user
                      {props.editingAward.holders === 1 ? "" : "s"} —{" "}
                      <a
                        href="#"
                        className="text-link"
                        onClick={(e) => {
                          e.preventDefault();
                          props.onViewRecipients?.();
                        }}
                      >
                        View Recipients <ArrowUpRightIcon />
                      </a>
                      .
                    </>
                  )}
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
                  templates={props.templates}
                  selectedId={data.cardTemplateId}
                  onSelect={(id) => update({ cardTemplateId: id })}
                  emptyLabel="No Card"
                  help="Compact visual shown on the user’s Portfolio. Recommended for every Award."
                />
                <TemplateField
                  label="Certificate Design"
                  required
                  templates={props.templates}
                  selectedId={data.certificateTemplateId}
                  onSelect={(id) => update({ certificateTemplateId: id })}
                  emptyLabel="No Certificate"
                  help="Detailed document for printing, PDF export, and formal verification — Trade School diplomas, for example."
                />

              </div>
            </div>
          </div>
        </div>

        <AwardPreview
          cert={cert}
          tier={data.meritTier}
          card={props.templates.find((t) => t.id === data.cardTemplateId)}
          certificate={props.templates.find((t) => t.id === data.certificateTemplateId)}
          awardId={props.editingAward?.id}
        />
      </div>

      <footer className="wizard-footer">
        <div className="wizard-footer-left">
          <button className="wizard-cancel" onClick={onClose}>Cancel</button>
          {/* Deleting the Award is the only way to give the Certification its
              "Add Award" entry back, and the Awards table that used to carry
              the action is gone — so it sits here, quiet and far from the
              primary button, in the `.wizard-cancel` type at danger red. */}
          {isEditing && props.onDelete && (
            <button
              className="wizard-cancel wizard-cancel--danger"
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
            onClick={() => { if (canSave) handleSave(); }}
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

/* The segmented Single-Select (Figma 359:2373), accent-active per 639:895 — the
   four tiers are a fixed, ordered set, which is what the control is for. The
   segments are plain text: the tier colours belong to the Portfolio and the
   table pill, and repeating them here only competed with the active segment.

   What each tier is FOR hangs off the SUBTEXT, in one tooltip covering all
   four — the same 14px info glyph the Skills and Spotlights subtexts carry.
   Per-segment tooltips were tried first and dropped: an option in a segmented
   control has no hover state of its own to hang an explanation on, and reading
   the set meant hovering it a piece at a time. */
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
        Merit Tier <span className="req">*</span>
      </label>
      <div className="seg-control">
        {MERIT_TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            className={`seg-btn accent ${data.meritTier === tier ? "active" : ""}`}
            onClick={() => update({ meritTier: tier })}
          >
            {tier}
          </button>
        ))}
      </div>
      <p className="form-help">
        Tiers are fixed and control where the Award sits in the user’s Portfolio — Platinum at the
        top, Bronze at the bottom.
        {/* One tooltip for the whole set, listed in the control's own order.
            A plain `title` is auto-adopted by the app-wide tooltip. */}
        <span
          className="form-help-info"
          tabIndex={0}
          aria-label="What each tier is for"
          /* A colon, not a dash — each intent line already has an em dash
             inside it ("Standard Certifications — Electrical Troubleshooting"). */
          title={MERIT_TIERS.map((t) => `${t}: ${MERIT_INTENT[t]}`).join("\n")}
        >
          <InfoIcon14 />
        </span>
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

/* An appearance is a Design Template, picked from the searchable Single-Select.
   The row leads with the template's artwork the way the Countries menu
   (938:961) leads with a flag, and the collapsed control repeats it — a visual
   choice has to stay visible once it is made. "None" is the first option rather
   than a clear button, because no appearance is a real answer for the
   Certificate. */
function TemplateField({
  label,
  help,
  required = false,
  emptyLabel,
  templates,
  selectedId,
  onSelect,
}: {
  label: string;
  help: string;
  required?: boolean;
  /** The "no template" row's label, e.g. "No Certificate". */
  emptyLabel: string;
  templates: AwardDesignTemplate[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}) {
  const byName = useMemo(
    () => new Map(templates.map((t) => [t.name, t])),
    [templates],
  );
  const options = useMemo(
    () => [emptyLabel, ...templates.map((t) => t.name)],
    [templates, emptyLabel],
  );

  const selected = selectedId ? templates.find((t) => t.id === selectedId) : undefined;
  const value = selected?.name ?? emptyLabel;

  const swatch = (t?: AwardDesignTemplate) => (
    <span
      className={`aw-tpl-thumb${t ? "" : " aw-tpl-thumb--none"}`}
      style={t ? { background: t.swatch } : undefined}
      aria-hidden
    />
  );

  return (
    <div className="form-group">
      <label className="form-label">
        {label} {required && <span className="req">*</span>}
      </label>
      <SelectField
        value={value}
        options={options}
        onChange={(name) => onSelect(byName.get(name)?.id)}
        searchPlaceholder="Search Design Templates..."
        panelClass="ss-menu--tpl"
        optionPrimary={(name) => (
          <>
            {swatch(byName.get(name))}
            <span className="aw-tpl-name">{name}</span>
          </>
        )}
        optionDetail={(name) => byName.get(name)?.background}
        optionSearchText={(name) => byName.get(name)?.background ?? ""}
        maxVisibleOptions={6}
        renderTrigger={({ open, toggle }) => (
          <button
            type="button"
            className={`select-field select-field--full aw-tpl-field${open ? " is-open" : ""}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={toggle}
          >
            {swatch(selected)}
            <span className="select-field-value">{value}</span>
            <span className="field-chevron"><DropdownCaretIcon /></span>
          </button>
        )}
      />
      {/* Templates themselves are managed on Product Config › Award Templates —
          this field only picks one. */}
      <p className="form-help">{help}</p>
    </div>
  );
}

/* ─────────────── Preview rail ─────────────── */

/* A live stand-in for what the Award will look like, in the same right-hand
   rail the company wizard puts its billing preview in (`.cw-impact`, 380px).
   It redraws whenever a Design Template changes, because a template is
   artwork and a dropdown row showing its name can only say so much.
 *
 * The field POSITIONS are invented: a template carries positioned dynamic
 * fields, and that editor isn't built (see NewDesignTemplateWizard's
 * positioning step), so this lays the same five fields out in a fixed
 * arrangement over the template's artwork and says so underneath. The values
 * are sample data — the real ones are minted per user on issuance.
 */
function AwardPreview({
  cert,
  tier,
  card,
  certificate,
  awardId,
}: {
  cert: Certification;
  tier: MeritTier;
  card?: AwardDesignTemplate;
  certificate?: AwardDesignTemplate;
  /** Real Award id when managing one; the sample number is built from it. */
  awardId?: string;
}) {
  const number = `${awardId ?? "AW-000"}-0001`;

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
            <div className="aw-preview-slot">
              <SectionHeading label="Card" />
              <div className="aw-card" style={{ background: card.swatch }}>
                <span
                  className="aw-tier-pill aw-card-tier"
                  style={{ "--tier": MERIT_HEX[tier] } as React.CSSProperties}
                >
                  <span className="aw-tier-pill-dot" />
                  {tier}
                </span>
                <div className="aw-card-body">
                  <div className="aw-card-cert">{cert.name}</div>
                  <div className="aw-card-holder">{SAMPLE_HOLDER}</div>
                </div>
                <div className="aw-card-foot">
                  <div>
                    <div className="aw-card-num">{number}</div>
                    <div className="aw-card-date">Issued {SAMPLE_DATE}</div>
                  </div>
                  <QrGlyph />
                </div>
              </div>
              <p className="aw-preview-cap">{card.name}</p>
            </div>
          )}

          {certificate && (
            <div className="aw-preview-slot">
              <SectionHeading label="Certificate" />
              <div className="aw-cert" style={{ background: certificate.swatch }}>
                <div className="aw-cert-kicker">Certificate of Completion</div>
                <div className="aw-cert-holder">{SAMPLE_HOLDER}</div>
                <div className="aw-cert-line">has completed</div>
                <div className="aw-cert-name">{cert.name}</div>
                <div className="aw-cert-foot">
                  <div>
                    <div className="aw-card-num">{number}</div>
                    <div className="aw-card-date">{SAMPLE_DATE}</div>
                  </div>
                  <QrGlyph />
                </div>
              </div>
              <p className="aw-preview-cap">{certificate.name}</p>
            </div>
          )}
        </>
      )}

      <p className="aw-preview-note">
        Sample data. The holder’s name, date, Unique Award Number and QR code are minted per user
        on issuance, and where they sit on the artwork is set on the Design Template.
      </p>
    </aside>
  );
}

const SAMPLE_HOLDER = "Maria Delgado";
const SAMPLE_DATE = "Apr 28, 2026";

/* A stand-in for the per-user QR code — a fixed pattern, not a real code. */
function QrGlyph() {
  return (
    <svg className="aw-qr" viewBox="0 0 21 21" shapeRendering="crispEdges" aria-hidden>
      <rect width="21" height="21" fill="#fff" />
      <g fill="#000">
        {/* Three finder squares. */}
        {[[0, 0], [14, 0], [0, 14]].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="7" height="7" />
            <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
            <rect x={x + 2} y={y + 2} width="3" height="3" />
          </g>
        ))}
        {/* Filler modules — a fixed pseudo-random mask, so the glyph never
            re-shuffles between renders. */}
        {QR_MODULES.map(([x, y]) => (
          <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </g>
    </svg>
  );
}

const QR_MODULES: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      const inFinder =
        (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
      if (inFinder) continue;
      // Deterministic hash — looks like data, is not.
      if (((x * 7 + y * 13 + x * y * 3) % 5) < 2) out.push([x, y]);
    }
  }
  return out;
})();
