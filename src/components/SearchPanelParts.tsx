import {
  KeyArrowDownIcon,
  KeyArrowUpIcon,
  KeyCommandIcon,
  KeyEnterIcon,
  SearchIcon,
  SearchClearIcon,
} from "./icons";

// Shared parts of the search combobox panels (Tasks, Users, Review, Question,
// Companies, Manage IDs, Proctoring, Content Links, Manage Completions):
// footer, suggestion rows, no-results block. Figma "Search" section 772:1109.

/** Keyboard hints footer — the foot of every open panel (Figma 21:15979 /
 *  1542:2150); the "Search for …" row it used to give way to is gone.
 *  The ↵ is the wizard footer's 14px `KeyEnterIcon` drawn at 12px, which is
 *  exactly the node's 12px `enter` export (the 1.1667 stroke scales to 1). */
export function SearchHints() {
  return (
    <div className="usearch-foot">
      <span className="usearch-hint">
        <span className="cta-kbd cta-kbd--hint">
          <KeyEnterIcon />
        </span>
        <span className="usearch-hint-label">To select</span>
      </span>
      <span className="usearch-hint">
        <span className="cta-kbd cta-kbd--hint">ESC</span>
        <span className="usearch-hint-label">To close</span>
      </span>
      <span className="usearch-hint">
        <span className="cta-kbd-group">
          <span className="cta-kbd cta-kbd--hint">
            <KeyArrowUpIcon />
          </span>
          <span className="cta-kbd cta-kbd--hint">
            <KeyArrowDownIcon />
          </span>
        </span>
        <span className="usearch-hint-label">To navigate</span>
      </span>
    </div>
  );
}

/** A search panel whose typed text matched nothing — Figma 1565:3111. The
 *  panel holds only this: a centred 16px Medium title over a 14px #a8a8a8 line,
 *  in a fixed 127px block — the height of the panel with its heading, one
 *  result, the 8px gap and the key-hints footer — so going from one result to
 *  none doesn't resize it. The head, hints and "Search for" row are hidden by
 *  CSS whenever this is in the panel. Filter-mode and "Showing Results for"
 *  panels alike (list items 13 and 14). */
export function SearchNoResults() {
  return (
    <div className="usearch-noresults" role="status">
      <div className="usearch-noresults-title">No Results Found :(</div>
      <div className="usearch-noresults-sub">Check for spelling mistakes or try a different search term</div>
    </div>
  );
}

/** One value a typed query could filter by, offered under "Suggested filters":
 *  laid out like the filter rows — the filter's chip ("Certification:") and the
 *  value on the left, what it is in #a8a8a8 on the right (user, 2026-10-06).
 *  `chip` defaults to "<kind>:". */
export type FilterSuggestion = { kind: string; name: string; chip?: string };

/** Typed text → the filter values it matches, scope by scope in the bar's own
 *  order (user rule, 2026-10-06: type "HVAC" and every filter is searched —
 *  an Industry or a Certification named HVAC shows up; with no match anywhere
 *  the panel goes away and Enter just searches the text). Values already
 *  applied or pending are left out. */
export function suggestFilters(
  query: string,
  groups: { kind: string; chip?: string; values: readonly string[]; exclude?: readonly string[] }[],
  max = 6,
): FilterSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: FilterSuggestion[] = [];
  for (const g of groups) {
    for (const name of g.values) {
      if (g.exclude?.includes(name)) continue;
      if (!name.toLowerCase().includes(q)) continue;
      out.push({ kind: g.kind, name, chip: g.chip });
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** A suggested filter row: the filter rows' 35px layout (21:15956) — chip,
 *  value, and the kind right-aligned at 14px #a8a8a8. */
export function SuggestionRow({
  suggestion,
  active,
  onHover,
  onClick,
}: {
  suggestion: FilterSuggestion;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      className={`usearch-row ${active ? "active" : ""}`}
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <span className="usearch-chip">{suggestion.chip ?? `${suggestion.kind}:`}</span>
      <span className="usearch-row-ex">{suggestion.name}</span>
      <span className="usearch-row-desc">{suggestion.kind}</span>
    </button>
  );
}

/** One arrow-key step through a panel's rows (2026-10-06). The search bar is
 *  the resting stop (-1): ↓ past the last row returns to the bar — Enter there
 *  searches exactly what was typed — and ↑ from the bar wraps to the last row.
 *  The "Search for …" row is never a stop; it is a mouse target only. */
export function stepActive(a: number, count: number, dir: 1 | -1): number {
  if (count <= 0) return -1;
  if (dir === 1) return a >= count - 1 ? -1 : a + 1;
  return a <= -1 ? count - 1 : a - 1;
}

/** A result panel's header (Figma 1542:2130 / 1542:2188): the blank-state
 *  label in white, or — once something is typed — "Showing Results for “q”"
 *  in #a8a8a8 with the query in orange. */
export function ResultsHead({ query, label }: { query: string; label: string }) {
  const q = query.trim();
  return q ? (
    <div className="usearch-head is-results">
      Showing Results for “<span className="usearch-head-q">{q}</span>”
    </div>
  ) : (
    <div className="usearch-head">{label}</div>
  );
}

/** A result's name with the typed text set in Medium (1542:2195 / 1542:2278);
 *  the first case-insensitive match only. */
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="usearch-match">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
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
