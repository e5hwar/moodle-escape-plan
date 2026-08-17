import { useState } from "react";
import { Dropdown } from "./Dropdown";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/* Two-letter weekday heads, per Figma 552:1520. */
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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
/* Trigger value — full month name (Figma 552:1175 "October 12, 2026"). */
function fmtLong(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
/* Shortcut parenthetical — short month (Figma 552:1507 "(Oct 7, 2026)"). */
function fmtShort(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

/** A one-click duration in the picker's Shortcuts panel. `value` is "YYYY-MM-DD". */
export type DateShortcut = { label: string; value: string };

/** Calendar-dropdown date picker. Value/onChange use plain "YYYY-MM-DD" strings,
 *  the same format a native <input type="date"> produces. */
export function DateField({
  value,
  onChange,
  placeholder = "Select date",
  hasError = false,
  min,
  max,
  shortcuts,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasError?: boolean;
  /** Earliest selectable date, "YYYY-MM-DD". Days before it are dimmed. */
  min?: string;
  /** Latest selectable date, "YYYY-MM-DD". Days after it are dimmed. */
  max?: string;
  /** Optional right-hand Shortcuts panel (Figma 552:1520). */
  shortcuts?: DateShortcut[];
}) {
  const selected = value ? parseISO(value) : null;
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date());
  const hasShortcuts = !!shortcuts?.length;

  return (
    <Dropdown
      /* The panel sizes to its content: the calendar column is exactly 305px
         (280px grid + 12px padding + the divider) and the Shortcuts column
         keeps its 12px padding around whatever dates it resolves to — Figma
         552:1520's 491px total is that sum for its own mock dates. */
      width="auto"
      overlay
      panelClass="dropdown--cal"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          className={`date-field-trigger${open ? " is-open" : ""}${hasError ? " has-error" : ""}`}
          onClick={() => {
            setViewMonth(selected ?? new Date());
            toggle();
          }}
        >
          <span className="date-field-box">
            <CalendarIcon />
            <span className={selected ? "" : "date-field-placeholder"}>
              {selected ? fmtLong(selected) : placeholder}
            </span>
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <div className="date-picker">
          <CalendarBody
            viewMonth={viewMonth}
            setViewMonth={setViewMonth}
            selected={selected}
            min={min}
            max={max}
            divided={hasShortcuts}
            onPick={(d) => {
              onChange(toISO(d));
              close();
            }}
          />
          {hasShortcuts && (
            <div className="date-shortcuts">
              <div className="date-shortcuts-title">Shortcuts</div>
              <div className="date-shortcuts-list">
                {shortcuts!.map((s) => {
                  const d = parseISO(s.value);
                  return (
                    <button
                      key={s.label}
                      type="button"
                      className="date-shortcut"
                      onClick={() => {
                        onChange(s.value);
                        close();
                      }}
                    >
                      <span className="date-shortcut-label">{s.label}</span>
                      {d && (
                        <span className="date-shortcut-date">({fmtShort(d)})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Dropdown>
  );
}

function CalendarBody({
  viewMonth,
  setViewMonth,
  selected,
  min,
  max,
  divided,
  onPick,
}: {
  viewMonth: Date;
  setViewMonth: (d: Date) => void;
  selected: Date | null;
  min?: string;
  max?: string;
  /** Draw the hairline that separates the calendar from the Shortcuts panel. */
  divided?: boolean;
  onPick: (d: Date) => void;
}) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const outOfRange = (d: Date) => {
    const iso = toISO(d);
    return (!!min && iso < min) || (!!max && iso > max);
  };

  // Paging stops at the month holding the bound, so the arrows never walk into
  // a month with nothing selectable in it.
  const prevDisabled = !!min && toISO(new Date(year, month, 0)) < min;
  const nextDisabled = !!max && toISO(new Date(year, month + 1, 1)) > max;

  return (
    <div className={`date-cal${divided ? " date-cal--divided" : ""}`}>
      <div className="date-cal-head">
        <button
          type="button"
          className="date-cal-nav"
          aria-label="Previous month"
          disabled={prevDisabled}
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
        >
          <ChevronLeftIcon />
        </button>
        <span className="date-cal-title">{MONTHS[month]} {year}</span>
        <button
          type="button"
          className="date-cal-nav"
          aria-label="Next month"
          disabled={nextDisabled}
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
              className={`date-cal-day${selected && isSameDay(d, selected) ? " is-selected" : ""}`}
              disabled={outOfRange(d)}
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
