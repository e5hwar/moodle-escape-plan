import {
  KeyArrowDownIcon,
  KeyArrowUpIcon,
  KeyCommandIcon,
  KeyEnterIcon,
  SearchIcon,
  SearchClearIcon,
} from "./icons";

// Shared dropdown footer + "search for" action used by the Tasks / Users / Review
// search combobox panels. Matches the Figma "Expanded Search" components.

/** Keyboard hints footer — shown when the search box is empty (Figma 21:15979).
 *  The ↵ is the wizard footer's 14px `KeyEnterIcon` drawn at 12px, which is
 *  exactly the node's 12px `enter` export (the 1.1667 stroke scales to 1). */
export function SearchHints() {
  return (
    <div className="usearch-foot">
      <span className="usearch-hint">
        <span className="usearch-keycap">
          <KeyEnterIcon />
        </span>
        <span className="usearch-hint-label">To select</span>
      </span>
      <span className="usearch-hint">
        <span className="usearch-keycap usearch-keycap--text">ESC</span>
        <span className="usearch-hint-label">To close</span>
      </span>
      <span className="usearch-hint">
        <span className="usearch-keycap-group">
          <span className="usearch-keycap">
            <KeyArrowUpIcon />
          </span>
          <span className="usearch-keycap">
            <KeyArrowDownIcon />
          </span>
        </span>
        <span className="usearch-hint-label">To navigate</span>
      </span>
    </div>
  );
}

/** "Search for "<query>" in <scope>" action row — shown when text is entered. */
export function SearchForRow({
  query,
  scope,
  active,
  onHover,
  onClick,
}: {
  query: string;
  scope: string;
  active?: boolean;
  onHover?: () => void;
  onClick: () => void;
}) {
  // Default-selected when no explicit active state is provided, so Enter runs the search.
  const on = active === undefined ? true : active;
  return (
    <button
      className={`usearch-searchfor ${on ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <span className="usearch-searchfor-icon">
        <SearchIcon />
      </span>
      <span className="usearch-searchfor-text">
        Search for <span className="q">“{query}”</span> in {scope}
      </span>
    </button>
  );
}

/** A pending filter token inside the bar — Figma 772:1120 "Search Bar -
 *  Default - Filter Applied": "Label: value" in white 14px Medium on a #404040
 *  hairline, then a 12px ✕ that drops just this token (the bar's own ✕ still
 *  clears everything). `label` is shown as given, colon included. The ✕ keeps
 *  focus in the field, so the panel stays open while tokens are pruned. */
export function SearchScopeChip({
  label,
  name,
  onRemove,
}: {
  label: string;
  name: string;
  onRemove: () => void;
}) {
  const what = label.replace(/:\s*$/, "");
  return (
    <span className="usearch-scope">
      <span className="usearch-scope-label">{label}</span>
      <span className="usearch-scope-name">{name}</span>
      <button
        type="button"
        className="usearch-scope-x"
        aria-label={`Remove ${what} filter ${name}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRemove}
      >
        <SearchClearIcon />
      </button>
    </span>
  );
}

/** The search bar's trailing slot (Figma 902:3585 "Text Entered" / 772:1110
 *  "Filter Applied"). The bar shows the ⌘K badge only while it is empty; the
 *  moment there is something to clear — typed text OR an applied filter chip —
 *  the badge gives way to a ✕ that clears it. The big `.usearch-*` combobox
 *  bars already worked this way; this is the same control for the plain
 *  `.search-wrap` bars every list page carries.
 *
 *  `shortcut={false}` is for a secondary bar that must not advertise ⌘K
 *  because the page's main search owns it (the Question Bank's category rail):
 *  empty, it shows nothing. */
export function SearchTrailing({
  active,
  onClear,
  shortcut = true,
}: {
  /** There is something to clear — text typed, or a filter applied. */
  active: boolean;
  onClear: () => void;
  shortcut?: boolean;
}) {
  if (!active) {
    if (!shortcut) return null;
    return (
      <span className="search-kbd">
        <span className="kbd-cmd"><KeyCommandIcon /></span>
        <span className="kbd-letter">K</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="search-clear"
      aria-label="Clear search"
      title="Clear search"
      /* Keep the input focused — clearing should not close a panel that is
         open because the field has focus. */
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClear}
    >
      <SearchClearIcon />
    </button>
  );
}

/** The search header inside a dropdown panel (Figma 934:1117): a search glyph,
 *  the query, and — once anything is typed — an X that clears it. Shared by the
 *  SelectField / filter / picker menus so the searched state looks and behaves
 *  the same in all of them.
 *
 *  `onChange` is called with "" when the X is hit, so the owner's own filtering
 *  resets through the one path it already has. The mousedown is prevented so
 *  clearing never blurs the field and closes the menu underneath. */
export function DropdownSearch({
  value,
  onChange,
  placeholder,
  inputRef,
  onKeyDown,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="dropdown-search">
      <span className="dropdown-search-icon">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {value !== "" && (
        <button
          type="button"
          className="dropdown-search-clear"
          aria-label="Clear search"
          title="Clear search"
          onMouseDown={(e) => {
            e.preventDefault();
            onChange("");
            inputRef?.current?.focus();
          }}
        >
          <SearchClearIcon />
        </button>
      )}
    </div>
  );
}
