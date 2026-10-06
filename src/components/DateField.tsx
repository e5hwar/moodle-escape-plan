import { useState } from "react";
import { Dropdown } from "./Dropdown";
import { CalendarIcon, ChevronDownSquareIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/* Single-letter weekday heads — the range picker's (Figma 1554:2735). */
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
/* Short month — the trigger's selected value (Figma 900:3576 "Sep 17, 2026",
   which re-specced it down from the full month name 552:1175 used). */
function fmtShort(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

/** A one-click duration on the picker's left rail. `value` is "YYYY-MM-DD". */
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
  /** Optional shortcut rail on the panel's left (Figma 1554:2735). */
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
      /* Figma 1554:2735 "Single Date Selection": the date-range picker's panel
         minus its Start/End inputs and footer — the same shell, shortcut rail
         and 32px calendar (`.drp-*`), so there is one calendar style in the
         app. Sizes to its content: the rail hugs its labels, the calendar
         column is 248px (224px grid + 12px insets). */
      width="auto"
      overlay
      panelClass="dropdown--cal drp-panel"
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
        <div className="drp" onClick={() => setMyMenu(null)}>
          <div className="drp-body">
            {/* The shortcuts rail (the range picker's presets, untitled): the
                one matching the picked date is the SemiBold orange row. */}
            {hasShortcuts && (
              <div className="drp-presets">
                <div className="drp-presets-list">
                  {shortcuts!.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      className={`drp-preset${s.value === value ? " is-active" : ""}`}
                      onClick={() => {
                        onChange(s.value);
                        close();
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="drp-col">
              <CalendarBody
                myMenu={myMenu}
                setMyMenu={setMyMenu}
                viewMonth={viewMonth}
                setViewMonth={setViewMonth}
                selected={selected}
                min={min}
                max={max}
                onPick={(d) => {
                  onChange(toISO(d));
                  close();
                }}
              />
            </div>
          </div>
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
  myMenu,
  setMyMenu,
  onPick,
}: {
  viewMonth: Date;
  setViewMonth: (d: Date) => void;
  selected: Date | null;
  min?: string;
  max?: string;
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
    <div className="drp-cal">
      <div className="drp-monthrow">
        <button
          type="button"
          className="drp-nav"
          aria-label="Previous month"
          disabled={prevDisabled}
          onClick={() => setViewMonth(new Date(year, month - 1, 1))}
        >
          <ChevronLeftIcon />
        </button>
        {/* Month and year are each their own dropdown (the range picker's
            `.drp-my` control); their lists are the Reduced Size menu 640:1005. */}
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
              <div className="dropdown-list">
                {myMenu === "month"
                  ? MONTHS.map((name, i) => (
                      <button
                        type="button"
                        key={name}
                        className={`dropdown-item${i === month ? " is-current" : ""}`}
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
                        className={`dropdown-item${y === year ? " is-current" : ""}`}
                        disabled={![...Array(12).keys()].some((i) => monthInRange(y, i))}
                        onClick={() => goToYear(y)}
                      >
                        {y}
                      </button>
                    ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="drp-nav"
          aria-label="Next month"
          disabled={nextDisabled}
          onClick={() => setViewMonth(new Date(year, month + 1, 1))}
        >
          <ChevronRightIcon />
        </button>
      </div>
      <div className="drp-days">
        <div className="drp-weekdays">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="drp-grid">
          {cells.map((d, i) =>
            d ? (
              <button
                type="button"
                key={i}
                className={`drp-day${selected && isSameDay(d, selected) ? " is-selected" : ""}`}
                disabled={outOfRange(d)}
                onClick={() => onPick(d)}
              >
                {d.getDate()}
              </button>
            ) : (
              <span key={i} className="drp-day drp-day--empty" />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
