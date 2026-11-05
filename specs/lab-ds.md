# Lab design system — "Reference Card"

The third look for the prototype, switched on by Demo Controls › Design System › Lab Design System. Implemented as `src/lab-ds.css`, loaded after `index.css` and `skillcat-ds.css`, every rule scoped to `html[data-ds="lab"]`. The React tree, copy, data, behaviour and shortcuts are the Play Area's; only the look changes. Flipping back to SkillCat or the Play Area is untouched: neither `src/index.css` nor `src/skillcat-ds.css` was edited.

Chosen on 2026-11-05 from three directions (Signal Panel, Reference Card, Section Board) after `/impeccable init` wrote `PRODUCT.md`; the direction contract lives in `.impeccable/surfaces/src-lab-ds-css.md`.

## The idea

The admin as the trade's pocket reference table: the laminated pressure-temperature card and the manufacturer spec sheet, built so one value among hundreds is found in a second. Structure is drawn with rules, not fills. State is ink and outline, never a tinted pill. Orange is spent on three things only: the primary action, the sort arrow and the focused control's rule. Everything measured (dates, counts, ids, prices, phones, emails, placeholders, keycaps, the summary line) is set in tabular IBM Plex Mono; everything named is Fira Sans.

Binding brand (confirmed 2026-11-05): dark ground, orange `#f05523`, Fira Sans + IBM Plex Mono. Open: the exact greys, scale, weights, density.

## Tokens

| Role | Value |
| --- | --- |
| Canvas | `#0e1013` (cool graphite) |
| Rail | `#0b0d10` |
| Surface (fields, search, seg-controls, radio cards) | `#121519` |
| Panel (menus, modals, tooltips, toasts, hover bar) | `#15191e` on a `#2a2f36` edge |
| Hairline rule | `#22262b` (every row and column rule, field and card edges); soft `#1a1e23` (rail dividers only) |
| Guide rule | `#343a42` (table head line, every fifth row, chip and button rules); strong `#4a515a` |
| Ink | `#e6e8eb` first · `#c3c8ce` second (table cells) · `#8f959d` third (labels, summaries) · `#7d848c` fourth (placeholders, section labels, hidden rows) · `#5c636b` fifth (kebabs, inactive steps) · `#3f454d` sixth (disabled) |
| Accent | `#f05523`, hover `#f5683b`; press keeps the fill and scales to 98%. Text on it is the canvas ink `#0e1013` (5.5:1); white was 3.5:1 |
| State inks | green `#2fbf71`, red `#ff5a63`, amber `#ffc524`, blue `#5b95ff`, purple `#9d88ff`. Solid fills on buttons only: go `#1f9d5b` (hover `#25ad66`) with canvas ink, destructive `#d7282f` (hover `#e8343c`) with white, both 5.5:1 |
| Washes | hover 4.5% white, soft 6% (panel rows, keycaps, disabled), selected 7%, press 10% |
| Radius | 3 everywhere, dialogs included |
| Shadows | panels `0 12px 32px rgba(0,0,0,.5)`, dialogs `0 24px 64px rgba(0,0,0,.6)` |
| Motion | 120ms panels, 160ms dialogs, `cubic-bezier(.23,1,.32,1)` |

Type: page title Bold 20/24 (tracking -0.01em), summary mono 12.5/16, section and dialog titles SemiBold 18/22, labels SemiBold 13/18, names Medium 13.5, cells 13, mono values 12.5, column heads SemiBold 11.5 tracked 0.03em, section labels SemiBold 11 tracked 0.06em, help 12.5/16.

Density: data rows 32, table heads 28, text controls 36, buttons 30, chips 26, menu rows 30, seg-control options 28, status labels 22 (small 18), dialog inset 20, wizard content 28 / 32, 24 between fields.

## The signature

Every `.table` is a ruled reading grid: a 1px `#22262b` column rule between cells, the same hairline under every row and a `#343a42` guide rule under every fifth row (the P-T card's reading guide). The finish review found the first cut a step too faint (`#1a1e23`) to read as rules at arm's length; the contract value is what ships. Hover is an instant 4.5% wash; the sticky action column drops the Play Area's gradient shadow strip because the column rule now marks the edge.

## Judgment calls

- **Collapsing landing header switched off** (Tasks, Certifications, Companies, Users): the head is one pinned band, title left and buttons right, as the SkillCat look does. A reference card does not grow and shrink. Same CSS approach (a three-column grid on the element that already holds title, summary, buttons, search and chips as siblings); no markup change.
- **Selection is ink, not orange.** Checked checkboxes, the chosen seg-control option, the selected radio card's dot, the active tab's underline and an applied filter's value are first ink. Orange is reserved for the primary action, the sort arrow (and the date-scoped column marker beside it) and focus, so a screen's one orange element is always the thing to press.
- **The current nav item is a hairline ring**, its icon or label in first ink, no fill (the sketch the user picked showed a white icon and no wash; the first cut's 7% wash was a fill the thesis refuses).
- **Focus is an orange rule.** Text fields, searches, selects, the time field and composite shells draw a 1px orange edge while focused or open (the Play Area draws white). Keyboard focus on buttons and links is a 1px orange outline offset 2.
- **Status labels are outlines.** The tone colour on the text and on a 45% hairline of itself (`color-mix`), no fill. Hidden / Refunded / Disabled name flags and the payment badges follow.
- **Required marker is red**, not orange, so a field's asterisk is not mistaken for the page's action.
- **Hidden and archived rows** read in the fourth ink across every cell; the kebab stays live (Unhide / Restore live in it).
- **The fifth ink (`#5c636b`, 3.1:1) is for glyphs only**: kebabs, sort carets, grips. Text that must be read (inactive wizard steps, empty values, the Play Area's `--text-faint` uses) sits on the fourth ink (5.0:1); the sixth ink is disabled controls only.
- **Control edges stay hairlines** (`#22262b` on fields and searches, `#343a42` on chips and the toggle track), below the 3:1 non-text bar on purpose: the card's whole language is faint rules on a filled surface, and focus, hover and the filled surface step carry the control's shape. Recorded as a known deviation from WCAG 1.4.11.
- **Dialog CTAs stay solid**: orange primary, solid red destructive, solid green go. Buttons are actions; the ink-and-outline rule is for state, not for the thing to press.
- **Dark ink on orange and green buttons** (audit, 2026-11-05): white on `#f05523` or `#1f9d5b` is 3.5:1, under AA for 13px labels. The fills keep the exact brand orange and the label goes to the canvas ink (5.5:1); the keycap inside takes a 22% white ground. Red keeps white (5.5:1). The alternative, a darker orange with white, would have moved the primary off the brand hex.
- **Counts in the sidebar** are mono numbers in a small ruled box, not a pill.
- **Mono columns**: `col-date`, `col-edited`, `col-u-date`, `col-rh-date`, `col-created`, `col-canceled`, `col-trial-end`, `col-signup`, `col-id`, `col-rh-taskid`, `col-num`, `col-attempts`, `col-attempt`, `col-rh-attempt`, `col-qp-attempt`, `col-qp-score`, `col-grade`, `col-price`, `col-seats`, `col-version`, `col-duration`, `col-phone`, `col-u-phone`, `col-rh-phone`, `col-email`, `col-u-email`, `col-rh-email`, `col-u-zip`, `col-cycle`, `col-cp-progress`, `col-cp-completion`.
- **Uppercase stays where the Play Area uppercases by CSS** (sidebar section labels, menu section labels, ALL / NONE, search-panel heads, keycaps, the wizard eyebrow): the rendered text matches the Play Area's exactly, as the copy rule requires.
- **Motion**: menus, the search panel and dialogs arrive in 120 to 160ms from 98.5% and 2px below their resting place on a strong ease-out, via `@starting-style`; exits are unmounts and stay instant. Buttons and fields change colour over 120ms and press to 98%. Anything a key can drive is instant: table rows, menu rows, search suggestions, calendar days and presets, sidebar items, wizard steps, steppers and pager buttons have `transition: none`. Under `prefers-reduced-motion: reduce` the two duration tokens drop to 0ms and the entrance blocks are gated off, so every state change is still visible, just instant. The toggle knob moves by `transform`, not `left`.

## Screen sweep (2026-11-05)

Every routed page, the Quiz wizard's eight steps, the Certification wizard's six, the Company wizard, the question editor, Edit Company, Content Links, Manage Completions, the Full Profile, both review consoles, the row preview panel, the date range picker, the Demo Controls panel, the Import CSV modal and the Spotlight, Skill and Feedback Form editors were captured at 1440×900 in Lab and compared with the Play Area. Calls made on the way:

- **List banners** (Certifications setup, Users name changes): the banner takes the head grid's third row under the title, as in the SkillCat look, and the one-line note is hidden. The Play Area draws that banner's box on a `::before` and fades its parts with scroll-driven animations; with the collapse off those stay at their end state, so Lab pins every part visible and draws the box on the element. It is a Lab note card with an amber hairline, the count in amber mono, a ruled Secondary button and a quiet close. Note: `:has()` takes its most specific argument's specificity, so the banner variants of the head rules repeat the `> .toolbar + .filters` clause to outrank the plain ones.
- **Note cards** everywhere are the surface on a hairline; a tone (`accent`, `warn`, `danger`, `ok`) colours the hairline at 35% and the icon, never the fill. Manage Completions' progress card keeps its gradient (it is data).
- **Card tables** on forms (Quiz Questions and Sections, the question editor's Options, Completion Criteria, Content Links, Product Config's lists): ruled boxes on radius 3, the head row in tracked 11.5 on a guide rule, rows on soft hairlines, 13 text, strong names Medium 13.5, inputs 32 tall in mono. The SkillCat look left these as the Play Area draws them; Lab does not, because a 12px-radius grey card inside this look reads as foreign.
- **Add rows and add links** ("+ Add Questions", "+ Add Resource", "+ Add Requirement", "+ Add New Version"...): first ink with a 14 plus and an underline on hover. Orange stays on the page's primary action.
- **Review-run strip** (Hands-On, Exam Reviews, Question Bank sub-cards): 64 ruled cards, the count in mono Bold 24 on a hairline; selected = a second-ink rule on the 7% wash.
- **Spotlight's own table**: the same head and rules as every data table; Approve solid green, Reject a ruled red Secondary; 92px rows set by the backdrops.
- **Question Bank landing**: recent-search pills as Lab chips, the category index at 14 with mono counts and tracked letters.
- **Row preview panel**: record column on the canvas, preview column on the surface step, title Bold 20, accordions with 14 SemiBold titles and 13 label / value rows on a 160 label column.
- **Date range picker**: presets as 13 rows with the chosen one in first ink, Start / End as 36 mono fields, 28 day cells; the chosen span is an 8% ink wash with its ends filled in ink.
- **Review consoles**: the rail column on the surface step, score keys as 32 ruled mono cells (pass solid green, fail solid red), the active thumbnail ringed in ink, the attempts panel as a Lab panel, checklist 13.5.
- **Toggles** are ink when on (white track, dark knob), like every other selection in this look; disabled toggles drop to the rule grey.
- **Search suggestions panel**: 30px rows at 13.5, a 36 hint footer on a hairline.
- **Cascading More Filters menu** (missed in the first sweep, caught by Eshwar 2026-11-05): the section rows are menu rows (30 tall, 13), the flyout is a Lab panel 4px beside its parent on radius 3, the count a ruled mono box, the chevron 14.
- **Upload zones**: a dashed guide box on radius 3; dragging over lifts the rule to first ink. File rows and cards are the surface on a hairline.
- **Multi-select tags**: 22 tall on radius 2, 12.5 Medium, a 7% wash inside a hairline.
- **Date-scoped column marker** (the orange calendar before "Seat Changes", "Responses"): stays orange at 12px. It signals a column whose numbers move with the Date Range, the same job as the sort arrow, so it is one of orange's reserved jobs rather than decoration.
- **Inline links** (`.text-link`): second ink with a hairline underline, first ink on hover.
- **Demo Controls panel**: a Lab panel so the switch itself sits in the look. Not part of the product.
- **Mono columns** gained the Exam Reviews table's own classes (`pr-col-email`, `pr-col-phone`, `pr-col-date`).
- **The switch itself**: `designSystem.ts` runs a switch into or out of Lab inside a View Transition (160ms crossfade, no movement, `prefers-reduced-motion` respected) and marks `<html data-ds-switching>` for its duration so the transition's CSS is scoped. A switch between the other two looks stays instant, as before.

## Break-ui (2026-11-05)

Worst-case values were injected into the live DOM (the brief allows no fixture toggle in app code) on the Tasks list, New Quiz Task step 1 and the Delete confirm, at 1440 and 1280: a 128-character task name, a one-letter name, a hidden row with a long name and its flag, a seven-certification list, a five-digit time, an over-limit bilingual name, a three-line Delete title, and the empty search result. Nothing broke: names truncate before their flag, the kebab stays reachable, the counter goes red at -14, the modal title wraps to three lines with the close in place, the empty state reads at 16 / 13. No fixes were needed.

## Finish review (2026-11-05)

Run by the shipped finish reviewer on the review captures in `.impeccable/review/`. Disposition: fix, six material items. Three were stale captures in my packet (both list banners and the console's thumbnail ring had been fixed before the review); three were real and are applied: row and column hairlines raised from `#1a1e23` to the contract's `#22262b`; the current nav item changed from a 7% wash to a hairline ring; dialog radius 4 → 3 (the Demo Controls panel too). The console's Learner's Notes body went from 14 to 13.5 / 18 to sit on the look's prose size. Out of scope by the brief's own rules and named as such: the wizard's "CREATING" eyebrow (shared markup, Play Area copy) and the Delete confirm's orange first step (the product's PrmModal default).

## Technical audit (2026-11-05)

Run as an isolated pass over `src/lab-ds.css` plus rendered contrast on sixteen routed pages, after the sweep. Scores before fixes: accessibility 3, motion 2, theming 3, leakage 4 (zero unscoped selectors), responsive 3. Fixed: the primary and go button labels (3.5:1 → 5.5:1, dark ink on the fills), text set in the fifth ink (inactive wizard steps, empty values, `--text-faint`) moved to the fourth, keyboard-driven rows made instant, reduced motion honoured through the duration tokens, the toggle knob moved by transform, the literal greens / reds / washes turned into tokens (`--lab-go`, `--lab-go-hover`, `--lab-red-hover`, `--lab-wash-soft`, `--lab-on-accent`, `--lab-on-go`), the applied chip's clear and the rail's collapse control brought to 24px targets. Left as is, by decision: hairline control edges under 3:1 (above), the universal `:has()` head rules (fine at this scale), and Users' horizontal scroll at 1280, which the Play Area has identically (its column minimums, not the look).

## Status

- 2026-11-05: tokens and shared components built and approved at checkpoint 2; every screen swept; break-ui clean; finish review (six fixes, all scored resolved, disposition ship) and technical audit applied; SkillCat and Play Area captures byte-identical before and after. Waiting on checkpoint 3: the name, the diff, DESIGN.md (offered, not written) and whether `PRODUCT.md` and `.impeccable/` stay in the repo.
