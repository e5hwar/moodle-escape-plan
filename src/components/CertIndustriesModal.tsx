import { useMemo, useState } from "react";
import { PrmModal } from "./PrmModal";
import { MultiSelect } from "./NewCompanyWizard";
import { industryTagOptions, useLiveIndustries } from "../data/industries";

/* Industries are tagged once the Certification exists, not while it's being
   built — so the last thing the create flow does is hand the new Cert to this
   modal. It is also how the Setup card on the Certifications page adds (or
   changes) an existing Certification's Industries, which is why it lives in
   its own file rather than inside the wizard (Claude Design "Certification
   Post-Creation Setup", 2026-10-01). Options are the live Industries and
   Sub-Industries, shown as "Industry › Sub-Industry" labels; `value` holds
   their tag keys (`Certification.industries`). */

export function CertIndustriesModal({
  certName,
  value,
  onChange,
  onDone,
  onCancel,
  mode = "created",
}: {
  certName: string;
  /** Tag keys. */
  value: string[];
  onChange: (v: string[]) => void;
  onDone: () => void;
  /** Dismissing without saving ("Skip for now" / "Cancel"). Saves nothing:
   *  the create flow still creates the Certification, untagged. */
  onCancel: () => void;
  /** `created`: the wizard just made the Certification — the copy says so.
   *  `manage`: an existing Certification, opened from its Setup card. */
  mode?: "created" | "manage";
}) {
  const managing = mode === "manage";
  // Whether the Certification already had Industries when the modal opened —
  // the title holds for the whole visit rather than flipping on the first pick.
  const [had] = useState(value.length > 0);
  const inds = useLiveIndustries();
  const options = useMemo(() => industryTagOptions(inds), [inds]);
  const labelOf = (key: string) => options.find((o) => o.key === key)?.label;
  const keyOf = (label: string) => options.find((o) => o.label === label)?.key;
  return (
    <PrmModal
      title={managing && had ? "Manage Industries" : "Add Industries"}
      description={
        managing ? (
          <>
            Tag <strong>{certName}</strong> with the Industries and Sub-Industries learners
            browse it under.
          </>
        ) : (
          <>
            <strong>{certName}</strong> has been created. Tag it with the Industries and
            Sub-Industries learners browse it under.
          </>
        )
      }
      confirmLabel={managing ? "Save Industries" : value.length > 0 ? "Add Industries" : "Done"}
      cancelLabel={managing ? "Cancel" : "Skip for now"}
      onCancel={onCancel}
      onConfirm={onDone}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">Industries</span>
          <MultiSelect
            popupMenu
            options={options.map((o) => o.label)}
            value={value.map(labelOf).filter((l): l is string => !!l)}
            onChange={(labels) => onChange(labels.map(keyOf).filter((k): k is string => !!k))}
            placeholder="Select Industries"
            searchPlaceholder="Search Industries..."
          />
          <p className="form-help">
            Used for catalog browsing and content discovery. A Certification can belong to multiple
            Industries and Sub-Industries, and can be re-tagged any time from the Industries page.
          </p>
        </div>
      </div>
    </PrmModal>
  );
}
