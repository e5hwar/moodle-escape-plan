import { useEffect, useState } from "react";
import { Dropdown } from "./Dropdown";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownSquareIcon,
  RangeArrowIcon,
} from "./icons";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/* Single-letter weekday heads, per Figma 606:1688 (the shared DateField keeps
   its own two-letter heads from 552:1520). */
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_MS = 24 * 60 * 60 * 1000;

// Local (not UTC) YYYY-MM-DD parse/format — same trap DateField documents: a
// plain `new Date("2026-03-01")` parses as UTC midnight and can render as the
// previous day in negative UTC-offset timezones.
function parseISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
/* Pill value — short month ("Jul 7, 2026"), per Figma 673:1428. */
function fmtShort(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}
/* Start/End inputs — MM/DD/YYYY, per Figma 610:2138. */
function fmtInput(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}
function parseInput(text: string): Date | null {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  // new Date() normalises overflow (02/31 → Mar 3) — reject those.
  return d.getMonth() === Number(m[1]) - 1 && d.getDate() === Number(m[2]) ? d : null;
}

export type DateRangeState = {
  /** Active preset key, or null for a hand-picked range. */
  preset: string | null;
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD"
};

type Preset = {
  key: string;
  /** Panel list label (Figma 606:1933 — sentence case). */
  label: string;
  /** Pill value label (Figma 673:1416 — title case). */
  pillLabel: string;
  range: (today: Date) => { start: Date; end: Date };
};

function monthLabel(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/* The presets rail (Figma 606:1933): rolling windows plus the current and
   previous calendar months, all resolved against the real current date. */
function buildPresets(today: Date): Preset[] {
  const thisMonth = startOfMonth(today);
  const prevMonth = addMonths(thisMonth, -1);
  const daysBack = (n: number) => (t: Date) => ({
    start: new Date(t.getFullYear(), t.getMonth(), t.getDate() - (n - 1)),
    end: t,
  });
  return [
    { key: "last7", label: "Last 7 days", pillLabel: "Last 7 Days", range: daysBack(7) },
    { key: "last30", label: "Last 30 days", pillLabel: "Last 30 Days", range: daysBack(30) },
    { key: "last90", label: "Last 90 days", pillLabel: "Last 90 Days", range: daysBack(90) },
    {
      key: "last12m",
      label: "Last 12 months",
      pillLabel: "Last 12 Months",
      range: (t) => ({ start: new Date(t.getFullYear() - 1, t.getMonth(), t.getDate()), end: t }),
    },
    {
      key: "thisMonth",
      label: monthLabel(thisMonth),
      pillLabel: monthLabel(thisMonth),
      range: (t) => ({ start: startOfMonth(t), end: t }),
    },
    {
      key: "prevMonth",
      label: monthLabel(prevMonth),
      pillLabel: monthLabel(prevMonth),
      range: () => ({
        start: prevMonth,
        end: new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0),
      }),
    },
    /* "All Time" sits last in the rail, below the calendar-month entries
       (Figma 606:1688), and is title-cased in both the list and the pill — the
       one preset whose label reads as a proper name rather than a sentence.

       It is a bounded window, not an open one: every control here — the two
       calendars, the Start/End inputs, Apply's "is there a range?" guard —
       assumes both ends exist, and 20 years back reaches past any record the
       admin holds. */
    {
      key: "all",
      label: "All Time",
      pillLabel: "All Time",
      range: (t) => ({ start: new Date(t.getFullYear() - 20, 0, 1), end: t }),
    },
  ];
}

function resolvePreset(key: string): DateRangeState {
  const today = startOfToday();
  const p = buildPresets(today).find((x) => x.key === key)!;
  const r = p.range(today);
  return { preset: key, start: toISO(r.start), end: toISO(r.end) };
}

/** The filter's default value — Last 30 Days. */
export function defaultDateRange(): DateRangeState {
  return resolvePreset("last30");
}

/** The everything-window default, for lists that must open showing their whole
 *  backlog (the review queues). */
export function allTimeDateRange(): DateRangeState {
  return resolvePreset("all");
}

/** Whether a date string (any Date.parse-able format) falls inside the range,
 *  end date inclusive. */
export function dateRangeIncludes(range: DateRangeState, date: string): boolean {
  if (!range.start || !range.end) return true;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return false;
  const s = parseISO(range.start)!.getTime();
  const e = parseISO(range.end)!.getTime() + DAY_MS - 1;
  return t >= s && t <= e;
}

/** The Date Range filter pill + its dual-calendar dropdown (Figma 673:1409 /
 *  673:1421 pill states, 606:1688 panel). Always applied — there is no empty
 *  state and no ⊗: the range cannot be removed, only changed (the panel's
 *  Clear resets it to the Last 30 Days default). */
export function DateRangePill({
  value,
  onChange,
  defaultValue,
}: {
  value: DateRangeState;
  onChange: (v: DateRangeState) => void;
  /** What the panel's Clear resets to. Defaults to Last 30 Days — pass the
   *  page's own default when it opens on a different window. */
  defaultValue?: DateRangeState;
}) {
  const preset = value.preset
    ? buildPresets(startOfToday()).find((p) => p.key === value.preset)
    : null;
  const start = parseISO(value.start);
  const end = parseISO(value.end);

  return (
    <Dropdown
      width="auto"
      align="right"
      panelClass="dropdown--cal drp-panel"
      trigger={({ open, toggle }) => (
        // No ⊗ (Figma 673:1409) — the range always has a value and cannot be
        // removed; the panel's Clear resets it to the default instead.
        <span className={`filter-applied drp-pill ${open ? "open" : ""}`}>
          <button className="filter-applied-main" onClick={toggle}>
            <span className="label">Date Range</span>
            <span className="sep" />
            <span className="value">
              {preset ? (
                preset.pillLabel
              ) : (
                <span className="drp-pill-range">
                  {start ? fmtShort(start) : "—"}
                  <RangeArrowIcon />
                  {end ? fmtShort(end) : "—"}
                </span>
              )}
            </span>
            <span className="caret">
              <ChevronDownSquareIcon />
            </span>
          </button>
        </span>
      )}
    >
      {({ close }) => (
        <DateRangePanel
          applied={value}
          fallback={defaultValue}
          onApply={(v) => {
            onChange(v);
            close();
          }}
        />
      )}
    </Dropdown>
  );
}

/* ─────────────── Panel ─────────────── */

type MyMenu = { cal: 0 | 1; kind: "month" | "year" };

function DateRangePanel({
  applied,
  fallback,
  onApply,
}: {
  applied: DateRangeState;
  fallback?: DateRangeState;
  onApply: (v: DateRangeState) => void;
}) {
  const today = startOfToday();
  const todayISO = toISO(today);
  const presets = buildPresets(today);

  // Draft — nothing reaches the page until Apply.
  const [draft, setDraft] = useState<DateRangeState>(applied);
  // Left calendar's month; the right calendar always shows the next one.
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(parseISO(applied.start) ?? today),
  );
  const [hoverISO, setHoverISO] = useState("");
  const [myMenu, setMyMenu] = useState<MyMenu | null>(null);

  // Mid-selection (start picked, end pending) the hovered day previews the
  // range — the state Figma 606:1688 mocks with its empty End input.
  const previewEndISO =
    draft.end || (draft.start && hoverISO >= draft.start ? hoverISO : "");

  function pickPreset(p: Preset) {
    const r = p.range(today);
    setDraft({ preset: p.key, start: toISO(r.start), end: toISO(r.end) });
    setViewMonth(startOfMonth(r.start));
  }

  function pickDay(d: Date) {
    const iso = toISO(d);
    setDraft((prev) =>
      !prev.start || prev.end || iso < prev.start
        ? { preset: null, start: iso, end: "" }
        : { preset: null, start: prev.start, end: iso },
    );
  }

  // Month/year menu picks re-anchor the left month, capped so the right
  // calendar never pages past the current month.
  function setViewFromCal(cal: 0 | 1, first: Date) {
    const left = cal === 0 ? first : addMonths(first, -1);
    const cap = startOfMonth(today);
    setViewMonth(left > cap ? cap : left);
    setMyMenu(null);
  }

  const nextDisabled = viewMonth >= startOfMonth(today);

  return (
    <div className="drp" onClick={() => setMyMenu(null)}>
      <div className="drp-body">
        <div className="drp-presets">
          <div className="drp-presets-title">Presets</div>
          <div className="drp-presets-list">
            {presets.map((p) => (
              <button
                key={p.key}
                className={`drp-preset${draft.preset === p.key ? " is-active" : ""}`}
                onClick={() => pickPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {[0, 1].map((cal) => {
          const month = cal === 0 ? viewMonth : addMonths(viewMonth, 1);
          return (
            <div key={cal} className={`drp-col${cal === 1 ? " drp-col--end" : ""}`}>
              <RangeInput
                label={cal === 0 ? "Start" : "End"}
                which={cal === 0 ? "start" : "end"}
                draft={draft}
                setDraft={setDraft}
                todayISO={todayISO}
                onShowMonth={(d) => setViewMonth(startOfMonth(d))}
              />
              <RangeCalendar
                cal={cal as 0 | 1}
                month={month}
                todayISO={todayISO}
                startISO={draft.start}
                endISO={previewEndISO}
                onPick={pickDay}
                onHover={setHoverISO}
                onPrev={cal === 0 ? () => setViewMonth(addMonths(viewMonth, -1)) : undefined}
                onNext={
                  cal === 1 && !nextDisabled
                    ? () => setViewMonth(addMonths(viewMonth, 1))
                    : undefined
                }
                myMenu={myMenu}
                setMyMenu={setMyMenu}
                onPickMonth={(m) =>
                  setViewFromCal(cal as 0 | 1, new Date(month.getFullYear(), m, 1))
                }
                onPickYear={(y) =>
                  setViewFromCal(cal as 0 | 1, new Date(y, month.getMonth(), 1))
                }
                yearMax={today.getFullYear()}
              />
            </div>
          );
        })}
      </div>

      <div className="dropdown-footer drp-footer">
        <button
          className="drp-btn-clear"
          onClick={() => {
            const v = fallback ?? defaultDateRange();
            setDraft(v);
            setViewMonth(startOfMonth(parseISO(v.start)!));
          }}
        >
          Clear
        </button>
        <button
          className="btn-apply"
          disabled={
            !draft.start ||
            !draft.end ||
            // Nothing moved — same days, same preset (or same lack of one).
            (draft.start === applied.start &&
              draft.end === applied.end &&
              (draft.preset ?? "") === (applied.preset ?? ""))
          }
          onClick={() => onApply(draft)}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

/* Start/End text inputs — free-typed MM/DD/YYYY, committed on blur (Enter
   blurs). An unparsable or out-of-bounds entry reverts to the draft value. */
function RangeInput({
  label,
  which,
  draft,
  setDraft,
  todayISO,
  onShowMonth,
}: {
  label: string;
  which: "start" | "end";
  draft: DateRangeState;
  setDraft: React.Dispatch<React.SetStateAction<DateRangeState>>;
  todayISO: string;
  onShowMonth: (d: Date) => void;
}) {
  const iso = draft[which];
  const [text, setText] = useState(() => (iso ? fmtInput(parseISO(iso)!) : ""));
  useEffect(() => setText(iso ? fmtInput(parseISO(iso)!) : ""), [iso]);

  function commit() {
    const d = parseInput(text);
    const dISO = d ? toISO(d) : "";
    const valid =
      d &&
      dISO <= todayISO &&
      (which === "start" || !draft.start || dISO >= draft.start);
    if (!valid) {
      setText(iso ? fmtInput(parseISO(iso)!) : "");
      return;
    }
    setDraft((prev) =>
      which === "start"
        ? {
            preset: null,
            start: dISO,
            end: prev.end && prev.end >= dISO ? prev.end : "",
          }
        : { preset: null, start: prev.start || dISO, end: dISO },
    );
    onShowMonth(d!);
  }

  return (
    <label className="drp-field">
      <span className="drp-field-label">{label}</span>
      <input
        className="drp-input"
        value={text}
        placeholder="MM/DD/YYYY"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

function RangeCalendar({
  cal,
  month,
  todayISO,
  startISO,
  endISO,
  onPick,
  onHover,
  onPrev,
  onNext,
  myMenu,
  setMyMenu,
  onPickMonth,
  onPickYear,
  yearMax,
}: {
  cal: 0 | 1;
  month: Date; // first of the displayed month
  todayISO: string;
  startISO: string;
  /** End of the painted range — the committed end or the hover preview. */
  endISO: string;
  onPick: (d: Date) => void;
  onHover: (iso: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  myMenu: MyMenu | null;
  setMyMenu: (m: MyMenu | null) => void;
  onPickMonth: (m: number) => void;
  onPickYear: (y: number) => void;
  yearMax: number;
}) {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDow = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));

  const menuOpen = (kind: "month" | "year") =>
    myMenu?.cal === cal && myMenu.kind === kind;
  const years: number[] = [];
  for (let y = yearMax - 5; y <= yearMax; y++) years.push(y);

  return (
    <div className="drp-cal">
      <div className="drp-monthrow">
        <button
          type="button"
          className={`drp-nav${onPrev ? "" : " drp-nav--hidden"}`}
          aria-label="Previous month"
          disabled={!onPrev}
          onClick={onPrev}
        >
          <ChevronLeftIcon />
        </button>
        <div className="drp-my">
          <button
            type="button"
            className="drp-my-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMyMenu(menuOpen("month") ? null : { cal, kind: "month" });
            }}
          >
            {MONTHS[m]}
            <ChevronDownSquareIcon />
          </button>
          <button
            type="button"
            className="drp-my-btn"
            onClick={(e) => {
              e.stopPropagation();
              setMyMenu(menuOpen("year") ? null : { cal, kind: "year" });
            }}
          >
            {year}
            <ChevronDownSquareIcon />
          </button>
          {(menuOpen("month") || menuOpen("year")) && (
            <div className="drp-my-menu" onClick={(e) => e.stopPropagation()}>
              {menuOpen("month")
                ? MONTHS.map((name, i) => (
                    <button
                      key={name}
                      className={`drp-my-item${i === m ? " is-active" : ""}`}
                      onClick={() => onPickMonth(i)}
                    >
                      {name}
                    </button>
                  ))
                : years.map((y) => (
                    <button
                      key={y}
                      className={`drp-my-item${y === year ? " is-active" : ""}`}
                      onClick={() => onPickYear(y)}
                    >
                      {y}
                    </button>
                  ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className={`drp-nav${onNext ? "" : " drp-nav--hidden"}`}
          aria-label="Next month"
          disabled={!onNext}
          onClick={onNext}
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
        <div className="drp-grid" onMouseLeave={() => onHover("")}>
          {cells.map((d, i) => {
            if (!d) return <span key={i} className="drp-day drp-day--empty" />;
            const iso = toISO(d);
            const inRange =
              !!startISO && !!endISO && iso >= startISO && iso <= endISO;
            const isStart = iso === startISO;
            const isEnd = !!endISO && iso === endISO;
            const cls = ["drp-day"];
            if (inRange) cls.push("in-range");
            if (isStart) cls.push("is-start");
            if (isEnd) cls.push("is-end");
            if (isStart && !endISO) cls.push("is-solo");
            return (
              <button
                type="button"
                key={i}
                className={cls.join(" ")}
                disabled={iso > todayISO}
                onClick={() => onPick(d)}
                onMouseEnter={() => onHover(iso)}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
