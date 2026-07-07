import { useState } from "react";
import { Dropdown } from "./Dropdown";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// Local (not UTC) YYYY-MM-DD parse/format — a plain `new Date("2026-03-01")`
// parses as UTC midnight, which can render as the previous day in negative
// UTC-offset timezones.
function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDisplay(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Calendar-dropdown date picker. Value/onChange use plain "YYYY-MM-DD" strings,
 *  the same format a native <input type="date"> produces. */
export function DateField({
  value,
  onChange,
  placeholder = "Select date",
  hasError = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
}) {
  const selected = value ? parseISO(value) : null;
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date());

  return (
    <Dropdown
      width={280}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          className={`date-field-trigger${open ? " is-open" : ""}${hasError ? " has-error" : ""}`}
          onClick={() => {
            setViewMonth(selected ?? new Date());
            toggle();
          }}
        >
          <CalendarIcon />
          <span className={selected ? "" : "date-field-placeholder"}>
            {selected ? fmtDisplay(selected) : placeholder}
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <CalendarBody
          viewMonth={viewMonth}
          setViewMonth={setViewMonth}
          selected={selected}
          onPick={(d) => {
            onChange(toISO(d));
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

function CalendarBody({
  viewMonth,
  setViewMonth,
  selected,
  onPick,
}: {
  viewMonth: Date;
  setViewMonth: (d: Date) => void;
  selected: Date | null;
  onPick: (d: Date) => void;
}) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div className="date-cal">
      <div className="date-cal-head">
        <button
          type="button"
          className="date-cal-nav"
          aria-label="Previous month"
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
        >
          <ChevronLeftIcon />
        </button>
        <span className="date-cal-title">{MONTHS[month]} {year}</span>
        <button
          type="button"
          className="date-cal-nav"
          aria-label="Next month"
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <div className="date-cal-weekdays">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="date-cal-grid">
        {cells.map((d, i) =>
          d ? (
            <button
              type="button"
              key={i}
              className={`date-cal-day${selected && isSameDay(d, selected) ? " is-selected" : ""}${isSameDay(d, today) ? " is-today" : ""}`}
              onClick={() => onPick(d)}
            >
              {d.getDate()}
            </button>
          ) : (
            <span key={i} className="date-cal-day date-cal-day--empty" />
          ),
        )}
      </div>
    </div>
  );
}
