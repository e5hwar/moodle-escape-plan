import { useState } from "react";
import { PrmModal } from "./PrmModal";
import { MultiSelect } from "./NewCompanyWizard";
import { industries } from "../data/industries";

/* Industries are tagged once the Certification exists, not while it's being
   built — so the last thing the create flow does is hand the new Cert to this
   modal. It is also how the Setup card on the Certifications page adds (or
   changes) an existing Certification's Industries, which is why it lives in
   its own file rather than inside the wizard (Claude Design "Certification
   Post-Creation Setup", 2026-10-01). Options are the same "Industry ›
   Sub-Industry" paths the cert records and the Certifications filters use. */
export const INDUSTRY_OPTIONS: string[] = [...industries]
  .sort((a, b) => a.displayPosition - b.displayPosition)
  .flatMap((ind) => [
    ind.name,
    ...[...ind.subIndustries]
      .sort((a, b) => a.displayPosition - b.displayPosition)
      .map((sub) => `${ind.name} › ${sub.name}`),
  ]);

export function CertIndustriesModal({
  certName,
  value,
  onChange,
  onDone,
  onCancel,
  mode = "created",
}: {
  certName: string;
  value: string[];
  onChange: (v: string[]) => void;
  onDone: () => void;
  /** Dismissing without saving — defaults to `onDone` (the create flow's
   *  "Skip for now" lands on the table either way). */
  onCancel?: () => void;
  /** `created`: the wizard just made the Certification — the copy says so.
   *  `manage`: an existing Certification, opened from its Setup card. */
  mode?: "created" | "manage";
}) {
  const managing = mode === "manage";
  // Whether the Certification already had Industries when the modal opened —
  // the title holds for the whole visit rather than flipping on the first pick.
  const [had] = useState(value.length > 0);
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
      onCancel={onCancel ?? onDone}
      onConfirm={onDone}
    >
      <div className="prm-stack">
        <div className="prm-field">
          <span className="prm-label">Industries</span>
          <MultiSelect
            popupMenu
            options={INDUSTRY_OPTIONS}
            value={value}
            onChange={onChange}
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
