import { forwardRef } from "react";
import { CharCount } from "./CharCount";
import { isOver, limitClass } from "../data/fieldLimits";

/* A single-language `.form-input` with a SOFT character limit — the plain
   sibling of a `.lang-field` row's counter (Figma 1369:1696). The input keeps
   every prop it was given; the wrapper adds the characters-left count at its
   right edge and flags the shell amber past the suggested length (1430:1474)
   and red past `max`. The caller names the tier in its label row
   (`LimitError`) and blocks its save on `isOver`, exactly as for a
   dual-language field. An admin-only field (never shown to learners, so
   never truncated) passes `warn={false}`: red past `max`, no amber tier. */
export const LimitedInput = forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { value: string; max: number; warn?: boolean }
>(function LimitedInput({ max, warn = true, className = "form-input", value, ...rest }, ref) {
  const flag = className.includes("has-error")
    ? ""
    : warn
      ? limitClass(max, value)
      : isOver(max, value)
        ? "has-error"
        : "";
  return (
    <div className="limit-input">
      <input
        ref={ref}
        {...rest}
        value={value}
        className={`${className}${flag ? ` ${flag}` : ""}`}
        aria-invalid={rest["aria-invalid"] ?? (flag === "has-error" || undefined)}
      />
      <CharCount value={value} max={max} warn={warn} />
    </div>
  );
});

export default LimitedInput;
