import { StepperMinusIcon, StepperPlusIcon } from "./icons";

/* ─────────────── Stepper (Figma 618:1264) ───────────────
 * The shared +/− number field: a 45px shell with the value between two square
 * buttons. Introduced on the New Company wizard's Seats field and reused by
 * the Grant Free Attempts modal, so it lives here rather than in a wizard.
 *
 * `value` is a string, not a number — the input has to be able to hold an
 * empty/partial value while it is being typed into. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  disabled = false,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  /** Upper bound, when the field has one — the + button stops there. */
  max?: number;
  disabled?: boolean;
  /** Labels the value input when the field's own label isn't adjacent. */
  ariaLabel?: string;
}) {
  const n = parseInt(value, 10);
  const current = Number.isFinite(n) ? n : min;
  const clamp = (v: number) =>
    Math.max(min, max === undefined ? v : Math.min(max, v));
  const step = (d: number) => onChange(String(clamp(current + d)));

  return (
    <div className={`stepper${disabled ? " is-disabled" : ""}`}>
      <button
        type="button"
        className="stepper-btn"
        aria-label="Decrease"
        disabled={disabled || current <= min}
        onClick={() => step(-1)}
      >
        <StepperMinusIcon />
      </button>
      <input
        className="stepper-value"
        type="number"
        min={min}
        max={max}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="stepper-btn"
        aria-label="Increase"
        disabled={disabled || (max !== undefined && current >= max)}
        onClick={() => step(1)}
      >
        <StepperPlusIcon />
      </button>
    </div>
  );
}
