import { useState } from "react";
import { SelectField } from "./SelectField";
import { DropdownCaretIcon } from "./icons";

/** The units every Time to Complete offers, Task and Certification alike —
 *  stored as the lowercase key, shown as the label. */
export type TimeUnit = "minutes" | "hours" | "days" | "weeks" | "months";
export const TIME_UNIT_LABEL: Record<TimeUnit, string> = {
  minutes: "Minutes",
  hours: "Hours",
  days: "Days",
  weeks: "Weeks",
  months: "Months",
};
export const TIME_UNIT_OPTIONS = Object.values(TIME_UNIT_LABEL);
export const TIME_UNIT_BY_LABEL = Object.fromEntries(
  (Object.keys(TIME_UNIT_LABEL) as TimeUnit[]).map((u) => [TIME_UNIT_LABEL[u], u]),
) as Record<string, TimeUnit>;

/* Time to Complete — Figma 1550:2700 "Text + Dropdown - Time to Complete".
 * ONE 45px shell (1px #404040, r8) split by a hairline: the number on the left
 * (digits only), the unit on the right as a 146px dropdown cell with its caret
 * pushed to the far edge — the Currency + Seat Price construction. The shell is
 * the field: focus in either half, or the unit menu open, whitens the whole
 * outer edge (1550:2709) and never a half on its own. Shared by the Task and
 * Certification wizards; each passes its own unit labels and default. */
export function TimeField<U extends string>({
  value,
  unit,
  units,
  onValueChange,
  onUnitChange,
}: {
  value: string;
  /** The unit's display label ("Minutes"). */
  unit: U;
  units: readonly U[];
  onValueChange: (v: string) => void;
  onUnitChange: (u: U) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`time-field${open ? " is-open" : ""}`}>
      <input
        className="time-field-value"
        type="text"
        inputMode="numeric"
        placeholder="Enter Approx. Time..."
        aria-label="Time to Complete"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^\d+$/.test(v)) onValueChange(v);
        }}
      />
      <SelectField
        value={unit}
        options={units}
        onChange={onUnitChange}
        onOpenChange={setOpen}
        renderTrigger={({ open: isOpen, toggle, label }) => (
          <button
            type="button"
            className="time-field-unit"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label="Time unit"
            onClick={toggle}
          >
            <span>{label}</span>
            <span className="time-field-caret">
              <DropdownCaretIcon />
            </span>
          </button>
        )}
      />
    </div>
  );
}
