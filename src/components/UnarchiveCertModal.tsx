import { useEffect } from "react";
import { PrmModal } from "./PrmModal";
import type { Certification } from "../data/certifications";

/** A saved Replacement Alert with any text in either language (it is rich
 *  text, so tags alone don't count). */
export function hasAlert(cert: Certification): boolean {
  const a = cert.replacementAlert;
  const text = (html: string) => html.replace(/<[^>]*>/g, "").trim() !== "";
  return !!a && (text(a.en) || text(a.es));
}

/** Unarchive — the Archive & Replace page's way back from Archived (its
 *  footer's secondary button, archived mode only). The first card says what
 *  happens; its CTA stacks the shared "Are you sure?" confirm (PrmModal
 *  `doubleConfirm`), whose CTA runs it. Not destructive, so the orange
 *  primary. */
export function UnarchiveCertModal({
  cert,
  onCancel,
  onConfirm,
}: {
  cert: Certification;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // PrmModal has no key handling of its own, so the owner closes on Escape
  // (the stacked confirm handles its own Escape, closing both).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const restored = cert.visibilityBeforeArchive ?? "Visible";
  const replacements = cert.replacementIds?.length ?? 0;
  const alert = hasAlert(cert);
  return (
    <PrmModal
      title={`Unarchive “${cert.name}”`}
      confirmLabel="Unarchive Certification"
      doubleConfirm={
        <>
          <strong>{cert.name}</strong> will be unarchived and return to {restored}.
        </>
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      <p className="prm-content">
        {restored === "Visible"
          ? "The Certification returns to Visible, the visibility it had before it was archived, and reappears in the catalog, its Industries and search."
          : "The Certification returns to Hidden, the visibility it had before it was archived, so it stays out of the catalog, its Industries and search until it is made visible."}
      </p>
      <p className="prm-content">
        {[
          alert && "Its Replacement Alert stops showing to enrolled learners.",
          replacements > 0 &&
            `Learners are no longer pointed to its ${
              replacements === 1 ? "replacement Certification" : `${replacements} replacement Certifications`
            }.`,
          alert || replacements > 0
            ? "The replacement settings are cleared."
            : "It has no replacement or Replacement Alert, so nothing else changes.",
        ]
          .filter(Boolean)
          .join(" ")}
      </p>
    </PrmModal>
  );
}
