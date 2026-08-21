import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { ChevronDownIcon } from "./icons";

/**
 * Single-select menu — Figma 591:1382 "Dropdown Menu - Single-Select".
 *
 * A styled stand-in for a native `<select>`: the current value reads SemiBold in
 * the list, there is no check glyph, and the hovered row fills #2c2c2f. The
 * panel goes through the overlay `Dropdown` with `constrainHeight`, so opening
 * one near the bottom of a scrolling form never grows the page.
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
        width={width || 220}
        panelClass="ss-menu"
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
              <span className="field-chevron"><ChevronDownIcon /></span>
            </button>
          )
        }
      >
        {({ close }) => (
          <SelectMenu
            value={value}
            options={options}
            onChange={onChange}
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
}: {
  value: T | "";
  options: readonly T[];
  onChange: (v: T) => void;
  close: () => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  // Keyboard/hover cursor. It stays at -1 until the pointer or a key moves it:
  // the menu's rest state (Figma 591:1382) fills no row and marks the current
  // value with weight alone.
  const [active, setActive] = useState(-1);

  // React only honours `autoFocus` on form elements, so the list takes focus
  // itself — otherwise the keys go to the trigger and the menu is mouse-only.
  // It waits a frame because the overlay panel's first paint is the hidden one
  // the Dropdown measures, and `focus()` on a hidden element does nothing.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      listRef.current?.focus({ preventScroll: true });
      const i = options.indexOf(value as T);
      if (i >= 0) rowAt(listRef.current, i)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function move(step: number) {
    setActive((i) => {
      // The first arrow press starts from whatever the field shows.
      const from = i < 0 ? options.indexOf(value as T) : i;
      const next = (from + step + options.length) % options.length;
      rowAt(listRef.current, next)?.scrollIntoView({ block: "nearest" });
      return next;
    });
  }

  return (
    <div
      className="dropdown-list"
      role="listbox"
      ref={listRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          move(e.key === "ArrowDown" ? 1 : -1);
        } else if (e.key === "Home" || e.key === "End") {
          e.preventDefault();
          const next = e.key === "Home" ? 0 : options.length - 1;
          setActive(next);
          rowAt(listRef.current, next)?.scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (active >= 0) onChange(options[active]);
          close();
        } else if (e.key === "Escape" || e.key === "Tab") {
          e.preventDefault();
          close();
        }
      }}
    >
      {options.map((opt, i) => (
        <button
          type="button"
          key={opt}
          role="option"
          aria-selected={opt === value}
          className={`dropdown-item${opt === value ? " is-current" : ""}${
            i === active ? " is-active" : ""
          }`}
          onMouseEnter={() => setActive(i)}
          onClick={() => {
            onChange(opt);
            close();
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function rowAt(list: HTMLDivElement | null, i: number) {
  return list?.querySelectorAll<HTMLElement>(".dropdown-item")[i];
}
