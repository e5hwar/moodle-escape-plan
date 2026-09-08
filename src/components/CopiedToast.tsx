import { useEffect } from "react";
import { CheckIcon } from "./icons";

/* "Payment Link Copied!" toast (Figma 1046:1141). Raised by the Company
 * Created screen and by the Companies table's "Copy Payment Link", so the two
 * acknowledge a copy the same way.
 *
 * It sits 40px in from the bottom-right. Inside a wizard body (`.pl-body`) the
 * stylesheet switches it to absolute, so that 40px is measured from where the
 * footer begins rather than from the window's edge. */
export function CopiedToast({
  label = "Payment Link Copied!",
  onDone,
  ms = 2500,
}: {
  label?: string;
  /** Called when the toast has had its time and should be unmounted. */
  onDone: () => void;
  ms?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, ms);
    return () => clearTimeout(t);
  }, [onDone, ms]);

  return (
    <div className="pl-copied-toast" role="status">
      {label}
      <span className="pl-copied-toast-icon"><CheckIcon /></span>
    </div>
  );
}
