import { useState } from "react";
import { Dropdown } from "./Dropdown";
import { CalendarIcon, ChevronDownSquareIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

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
/* Short month — the trigger's selected value (Figma 900:3576 "Sep 17, 2026",
   which re-specced it down from the full month name 552:1175 used) and the
   shortcut parenthetical (552:1507 "(Oct 7, 2026)") both read this way. */
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
  /* Which of the two caption dropdowns is open, if either (Figma 606:1746 —
     the same month/year control the date-range filter carries). */
  const [myMenu, setMyMenu] = useState<"month" | "year" | null>(null);
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
            setMyMenu(null);
            toggle();
          }}
        >
          {/* One layout for both states (654:926 / 900:3576): the value takes
              the width and the calendar glyph is pinned to the right edge.
              Only the text and its colour change when a date is picked. */}
          <span className="date-field-box">
            <span className={`date-field-text${selected ? "" : " date-field-placeholder"}`}>
              {selected ? fmtShort(selected) : placeholder}
            </span>
            <CalendarIcon />
          </span>
          {/* Sizing ghost, stacked under the visible layer in the same grid
              cell: the control is always at least as wide as its empty state,
              so picking a date can never shrink it — Figma draws the two states
              the same width. Hidden from paint and from the a11y tree, but it
              still contributes its width. */}
          <span className="date-field-box date-field-ghost" aria-hidden>
            <span className="date-field-text date-field-placeholder">{placeholder}</span>
            <CalendarIcon />
          </span>
        </button>
      )}
    >
      {({ close }) => (
        <div className="date-picker" onClick={() => setMyMenu(null)}>
          <CalendarBody
            myMenu={myMenu}
            setMyMenu={setMyMenu}
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
  myMenu,
  setMyMenu,
  onPick,
}: {
  viewMonth: Date;
  setViewMonth: (d: Date) => void;
  selected: Date | null;
  min?: string;
  max?: string;
  /** Draw the hairline that separates the calendar from the Shortcuts panel. */
  divided?: boolean;
  /** The open caption dropdown, if any. */
  myMenu: "month" | "year" | null;
  setMyMenu: (m: "month" | "year" | null) => void;
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

  /* The caption dropdowns offer only months and years the bounds leave
     something to pick in — the same rule the arrows page by, so jumping by
     caption can never land somewhere the arrows refuse to go. A month
     qualifies when it overlaps [min, max] at all. */
  const monthInRange = (y: number, m: number) =>
    (!min || toISO(new Date(y, m + 1, 0)) >= min) &&
    (!max || toISO(new Date(y, m, 1)) <= max);

  const minYear = min ? Number(min.slice(0, 4)) : year - 5;
  const maxYear = max ? Number(max.slice(0, 4)) : year + 5;
  const years: number[] = [];
  for (let y = Math.min(minYear, year); y <= Math.max(maxYear, year); y++) years.push(y);

  /* Switching year keeps the month where it can, and slides to the nearest
     month that still has selectable days when it can't — picking 2027 while
     the window closes in June must not strand the view on an empty December. */
  function goToYear(y: number) {
    let m = month;
    if (!monthInRange(y, m)) {
      const fallback = [...Array(12).keys()].find((i) => monthInRange(y, i));
      if (fallback === undefined) return;
      m = fallback;
    }
    setViewMonth(new Date(y, m, 1));
    setMyMenu(null);
  }

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
        {/* Figma 606:1746 — month and year are each their own dropdown; the
            arrows still page one month at a time either side of them. Shares
            the date-range picker's `.drp-my*` control so the two calendars
            stay one control, not two lookalikes. */}
        <div className="drp-my">
          <button
            type="button"
            className="drp-my-btn"
            aria-expanded={myMenu === "month"}
            onClick={(e) => {
              e.stopPropagation();
              setMyMenu(myMenu === "month" ? null : "month");
            }}
          >
            {MONTHS[month]}
            <ChevronDownSquareIcon />
          </button>
          <button
            type="button"
            className="drp-my-btn"
            aria-expanded={myMenu === "year"}
            onClick={(e) => {
              e.stopPropagation();
              setMyMenu(myMenu === "year" ? null : "year");
            }}
          >
            {year}
            <ChevronDownSquareIcon />
          </button>
          {myMenu && (
            <div className="drp-my-menu" onClick={(e) => e.stopPropagation()}>
              {myMenu === "month"
                ? MONTHS.map((name, i) => (
                    <button
                      type="button"
                      key={name}
                      className={`drp-my-item${i === month ? " is-active" : ""}`}
                      disabled={!monthInRange(year, i)}
                      onClick={() => {
                        setViewMonth(new Date(year, i, 1));
                        setMyMenu(null);
                      }}
                    >
                      {name}
                    </button>
                  ))
                : years.map((y) => (
                    <button
                      type="button"
                      key={y}
                      className={`drp-my-item${y === year ? " is-active" : ""}`}
                      onClick={() => goToYear(y)}
                    >
                      {y}
                    </button>
                  ))}
            </div>
          )}
        </div>
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
