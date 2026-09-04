import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { DropdownCaretIcon } from "./icons";
import { DropdownSearch } from "./SearchPanelParts";

/**
 * Single-select menu — Figma 591:1382 "Dropdown Menu - Single-Select".
 *
 * A styled stand-in for a native `<select>`: the current value reads SemiBold in
 * the list, there is no check glyph, and the hovered row fills #2c2c2f. The
 * panel goes through the overlay `Dropdown` with `constrainHeight`, so opening
 * one near the bottom of a scrolling form never grows the page.
 *
 * `searchPlaceholder` upgrades the panel to Figma 668:943 "Dropdown Menu - With
 * Search": the MultiSelect's search header on top, filtering the list as you
 * type. `optionDetail` adds that node's right-aligned muted detail per row
 * (e.g. an employee's Admin/Manager role); return null for a plain row.
 *
 * `renderTrigger` exists for the composite address box, whose rows are their own
 * chrome; every other caller gets the default `.select-field` control.
 */
export function SelectField<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  className,
  disabled = false,
  renderTrigger,
  searchPlaceholder,
  optionDetail,
  popupMenu = false,
  maxVisibleOptions,
  menuWidth,
  panelClass,
  onOpenChange,
}: {
  value: T | "";
  options: readonly T[];
  onChange: (v: T) => void;
  /** Shown greyed when `value` is empty; without one an empty value shows blank. */
  placeholder?: string;
  /** Extra classes on the default trigger. */
  className?: string;
  disabled?: boolean;
  renderTrigger?: (args: {
    open: boolean;
    toggle: () => void;
    label: ReactNode;
    isPlaceholder: boolean;
  }) => ReactNode;
  /** When set, the panel opens with a search header that filters the options. */
  searchPlaceholder?: string;
  /** Right-aligned muted text on an option's row (Figma 668:943). */
  optionDetail?: (option: T) => ReactNode;
  /** Set when the field sits on a modal/popup — the panel takes the
   *  popup-context surface (Figma 668:972) so it separates from the card. */
  popupMenu?: boolean;
  /** Caps the list at this many rows, so a long option set (countries, states)
   *  scrolls inside a menu the size of a short one instead of filling the
   *  screen. The search header, when there is one, sits above the cap. */
  maxVisibleOptions?: number;
  /** Opens the panel at this width instead of the trigger's. For a control too
   *  narrow to host a search header (the phone dial-code picker) — the menu
   *  still aligns to the trigger's left edge. */
  menuWidth?: number;
  /** Extra class on the panel, for a menu with its own row layout. */
  panelClass?: string;
  /** Notified as the panel opens and closes, for a caller that styles the
   *  surrounding control while its menu is up. */
  onOpenChange?: (open: boolean) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  // The menu matches the trigger, not the wrapper — a shrink-to-fit control
  // (the Edit Company modal) is narrower than the block it sits in.
  useLayoutEffect(() => {
    const el = wrapRef.current?.querySelector("button");
    if (!el) return;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isPlaceholder = value === "";
  const label = isPlaceholder ? placeholder ?? "" : value;

  return (
    <div className="selectfield" ref={wrapRef}>
      <Dropdown
        overlay
        constrainHeight
        onOpenChange={onOpenChange}
        width={menuWidth ?? (width || 220)}
        panelClass={`ss-menu${popupMenu ? " ss-menu--popup" : ""}${
          panelClass ? ` ${panelClass}` : ""
        }`}
        trigger={({ open, toggle }) =>
          renderTrigger ? (
            renderTrigger({ open, toggle, label, isPlaceholder })
          ) : (
            <button
              type="button"
              className={`select-field${isPlaceholder ? " is-placeholder" : ""}${
                open ? " is-open" : ""
              }${className ? ` ${className}` : ""}`}
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={toggle}
            >
              <span className="select-field-value">{label}</span>
              {/* A native select is as wide as its widest option and never
                  resizes as the value changes. A button is only as wide as its
                  label, so this zero-height stack reinstates that width. */}
              <span className="select-field-sizer" aria-hidden="true">
                {placeholder && <span>{placeholder}</span>}
                {options.map((o) => (
                  <span key={o}>{o}</span>
                ))}
              </span>
              <span className="field-chevron"><DropdownCaretIcon /></span>
            </button>
          )
        }
      >
        {({ close }) => (
          <SelectMenu
            value={value}
            options={options}
            onChange={onChange}
            searchPlaceholder={searchPlaceholder}
            optionDetail={optionDetail}
            maxVisibleOptions={maxVisibleOptions}
            // Hand the keyboard back to the trigger, the way a native select does.
            close={() => {
              close();
              wrapRef.current?.querySelector("button")?.focus();
            }}
          />
        )}
      </Dropdown>
    </div>
  );
}

function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  close,
  searchPlaceholder,
  optionDetail,
  maxVisibleOptions,
}: {
  value: T | "";
  options: readonly T[];
  onChange: (v: T) => void;
  close: () => void;
  searchPlaceholder?: string;
  optionDetail?: (option: T) => ReactNode;
  maxVisibleOptions?: number;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  // Keyboard/hover cursor. It stays at -1 until the pointer or a key moves it:
  // the menu's rest state (Figma 591:1382) fills no row and marks the current
  // value with weight alone.
  const [active, setActive] = useState(-1);

  const shown = searchPlaceholder
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  // React only honours `autoFocus` on form elements, so the menu takes focus
  // itself — the search box when there is one, the list otherwise (a plain
  // list is not focusable-by-default, and without this the keys stay on the
  // trigger and the menu is mouse-only). It waits a frame because the overlay
  // panel's first paint is the hidden one the Dropdown measures, and `focus()`
  // on a hidden element does nothing.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (searchRef.current) searchRef.current.focus({ preventScroll: true });
      else listRef.current?.focus({ preventScroll: true });
      const i = shown.indexOf(value as T);
      if (i >= 0) rowAt(listRef.current, i)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function move(step: number) {
    if (!shown.length) return;
    setActive((i) => {
      // The first arrow press starts from whatever the field shows.
      const from = i < 0 ? shown.indexOf(value as T) : i;
      const next = (from + step + shown.length) % shown.length;
      rowAt(listRef.current, next)?.scrollIntoView({ block: "nearest" });
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Home" || e.key === "End") {
      // Home/End move the caret while typing in the search box.
      if (searchPlaceholder) return;
      e.preventDefault();
      const next = e.key === "Home" ? 0 : shown.length - 1;
      setActive(next);
      rowAt(listRef.current, next)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" || (e.key === " " && !searchPlaceholder)) {
      e.preventDefault();
      if (active >= 0 && shown[active] != null) {
        onChange(shown[active]);
        close();
      } else if (!searchPlaceholder) {
        close();
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close();
    }
  }

  // The cap is measured off a real row rather than assumed, because row height
  // varies by menu (the countries menu's rows are an 8px inset where the others
  // are 6px). N rows land exactly on the Nth row's edge, so the cut-off row
  // that would follow reads as "there is more below".
  const [maxHeight, setMaxHeight] = useState<number | undefined>();
  useLayoutEffect(() => {
    if (!maxVisibleOptions) return;
    const list = listRef.current;
    const rowEls = list?.querySelectorAll<HTMLElement>(".dropdown-item");
    if (!list || !rowEls?.length) return;
    // The SHORTEST row, not the first: in a narrow menu a long label wraps to
    // two or three lines, and measuring whichever row happens to lead would
    // scale the cap by that row's wrapping rather than by the row count.
    const unit = Math.min(...[...rowEls].map((r) => r.offsetHeight));
    const cs = getComputedStyle(list);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    setMaxHeight(unit * maxVisibleOptions + pad);
  }, [maxVisibleOptions]);

  const list = (
    <div
      className="dropdown-list"
      role="listbox"
      style={maxHeight ? { maxHeight } : undefined}
      ref={listRef}
      tabIndex={searchPlaceholder ? undefined : -1}
      onKeyDown={searchPlaceholder ? undefined : onKeyDown}
    >
      {shown.map((opt, i) => {
        const detail = optionDetail?.(opt);
        return (
          <button
            type="button"
            key={opt}
            role="option"
            aria-selected={opt === value}
            className={`dropdown-item${opt === value ? " is-current" : ""}${
              i === active ? " is-active" : ""
            }`}
            onMouseEnter={() => setActive(i)}
            // Picking with the mouse must not blur the search box mid-close.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(opt);
              close();
            }}
          >
            {detail != null ? (
              <>
                <span className="dropdown-item-name">{opt}</span>
                <span className="dropdown-item-detail">{detail}</span>
              </>
            ) : (
              opt
            )}
          </button>
        );
      })}
      {shown.length === 0 && (
        <div className="ms-menu-empty">
          {query.trim() ? `No matches for “${query.trim()}”` : "No matches"}
        </div>
      )}
    </div>
  );

  if (!searchPlaceholder) return list;

  return (
    <>
      <DropdownSearch
        inputRef={searchRef}
        placeholder={searchPlaceholder}
        value={query}
        onChange={(v: string) => {
          setQuery(v);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      {list}
    </>
  );
}

function rowAt(list: HTMLDivElement | null, i: number) {
  return list?.querySelectorAll<HTMLElement>(".dropdown-item")[i];
}
