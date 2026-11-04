# SkillCat Design System — density exceptions and open decisions

Source: Figma "SkillCat-UI" › App & Web v1.0 Design System (file `EEki6uMz0Q3KkQv8vhKkvD`).
Implemented as `src/skillcat-ds.css`, switched on by Demo Controls › Design System.

The DS's own rule (Foundations › Density): **Compact for the LMS and Dashboard web; everything else Comfortable.** So the default here is Compact everywhere, and this file lists every place that is *not* Compact, plus the calls I made where the DS leaves it open. Cross-check against the Figma file.

## Comfortable used instead of Compact

| Where | Size used | Why |
| --- | --- | --- |
| — | — | None. The list-page search was Large 54 until 2026-11-03; it is now Default (Compact 40) like every other search. |

## Page head + search (Eshwar, 2026-11-03)

- **Title + summary stacked.** The DS has no page-header component — only the text styles: headlineMedium (Bold 24 / 29) for the title and Unified/Page/Subtitle (Regular 16 / 24, text/secondary) for the summary. The style's description says the summary sits *beside* the title; Eshwar wants it **below**, so it sits 4 under the title (judgment call: the DS gives no gap for this). The header buttons sit at the right, level with the bottom of the summary.
- **No divider under the title row.** The DS has no page-head divider (its only dividers are Menu / Divider and table row lines); the 50% line came from Eric's screen and is gone from every list head, the header-held heads (Skills, Question Bank, Users, Companies…, Exam Reviews, Hands-On, Spotlight) and the line above the Certifications setup banner.
- **One search everywhere: Input / Search · State Default · Content Empty · Size Default · Style Filled (19133:188239).** Compact 40, 15% grey fill on a #404040 edge, 16 icon, mono 14 placeholder #8A8A8A; hover #7A7A7A edge and focus #FCFCFC edge keep the fill. Applies to the list-page search (was Large 54), every `.usearch` / `.search-input` search (modal pickers, menus, secondary bars — were Outline), Spotlight's search (was 54) and Manage Completions' two-half shell. The landing pages' 20px search text from the Play Area no longer leaks through.

Everything else is Compact — including the wizard form controls. **Validated against the DS on 2026-11-02 (Eshwar flagged the small field labels):** Eric's wizard frames came through at the library's *default* density (labels 12, inputs 44, values mono 14, messages 12, radios 20, segmented 44/36), which is Comfortable, not the LMS mode. The Foundations › Density table sets Compact at: field label **16**, input text **16**, input / select / search **40**, button label 14, chip label 14, checkbox / radio **16**, switch 41 × 24, menu item 36, status label 28 (Small 20), table row 48. The stylesheet now follows that table: wizard labels Bold 16 / 20, controls 40 with mono 16 / 24, messages 14 / 20, bilingual rows 40, steppers / selects / time field 40, segmented control 40 with 32 options and Bold 14 labels, radios 16, the rail's step titles 16, the eyebrow labelLarge 16, the date picker fields 40 / 16, row-menu reason lines 14. The earlier "Comfortable as drawn" note is withdrawn.

**Field composite, checked against the DS Field component (17012:470) and the LMS "Time + unit" example (18261:43337) on 2026-11-02:** label Fira Sans Bold 16 / 20 #A8A8A8 with 8 above the control; control 40 tall, #404040 1px border, radius 8, value / placeholder IBM Plex Mono 16 / 24, placeholder #8A8A8A, text 12 from the edge; the unit addon is a hairline divider, the unit in white mono and a 16 chevron inside the same shell; Field / Message (help text) Fira Sans Regular 14 at line-height 1.3, grey, 8 below the control. All of that is what the stylesheet draws. The one copy fix was the placeholder: "Enter Approx. Time..." was coming out as "Enter approx. Time..." because the sentence-case helper read the abbreviation's period as the end of a sentence; it now knows the common abbreviations (approx., e.g., min., max., st., …), keeps brand and proper-noun capitals mid-sentence (Stripe, Apple, Google Play, Android, English / Spanish, days, months, United States) and writes a trailing "..." as the DS's "…" — so it reads "Enter approx. time…" like the DS example.

## Table size Small on every 40px table (Eshwar, 2026-11-03)

- Every `.table` uses **Table size Small** (19236:4922): header and rows 40. That matches the Play Area's 40px tables, and covers list pages, picker modals and card tables alike. Cells, the 12 padding, the 24 between columns and the hover bar are as in Default. The DS shows Small "inside a card or dialog", but Eshwar's ruling is that Small is a size like Default and Tall, usable on any table.
- Not Small, because they aren't like the Tasks table:
  - Spotlight (`.sp-table`, 48 head, 64 rows).
  - The two artwork tables, Award Templates and the Card / Certificate Design picker. They keep Default's 48 head, and their 144×76 tiles set the row height.

## Primary columns follow the Play Area (Eshwar, 2026-11-04)

- The DS primary-text cell (#FCFCFC, Medium) goes on every column the Play Area emphasises, not only Name: Hands-On's Task column and the Question Bank's Question column. Question stays Regular, as it is in the Play Area.

## Hidden / archived rows use the DS disabled row (Eshwar, 2026-11-04)

- Rows the Play Area dims follow the Table / Row Disabled look (18832:2230): every cell's text is #7A7A7A, including the name, data, mono values and dates. These are hidden Tasks and Certifications, archived Certifications, Skills and Questions, disabled Feedback Forms and the dimmed picker rows. In the Play Area the name is #7a7a7a and the other cells are #404040.
- Status labels and the Hidden / Disabled flags keep their own colours.
- **Deviation:** the kebab stays live and white. The DS greys it on a disabled row, but Unhide and Restore live in that menu.

## Status labels: two sizes, mapped from the Play Area (Eshwar, 2026-11-03)

- The DS has **Default** (Compact 28, SemiBold 14, 8 inset, 14 icon) and **Small** (20, SemiBold 12 on 15.6, 6 inset, 12 icon), both radius 8 with the tone colour on its 10% tint (17086:18962 / 17013:311). Each pill takes the size that matches its size in the Play Area. The DS line "Small … for tags inside table cells" is **not** used to pick the size.
  - Default: the regular `.co-status-pill` (Play Area 29/14). This covers status columns, Skills' Type, subscription and builder tags.
  - Small: the Play Area's small pills (22/12), which are `.co-status-pill--sm` (Exam Reviews' Verified / Re-Uploaded ID), the name flags (`.pr-name-flag`: Hidden / Refunded / Disabled) and the payment badge.
- Name cells that the Play Area makes `display: flex` (hidden / flagged names, Skills' icon rows) were adding 1px to their row (49 / 41). They are now drawn 1 short so every row stays 40.

## Copy under the SkillCat look — same as the Play Area (ruling 2026-11-03)

**Superseded:** the sentence-case pass below and in the screen notes is withdrawn. Eshwar: all text in the SkillCat look must read exactly as in his DS (the Play Area) — capitals, the "..." after placeholders, button names. `dsText()` now returns every string unchanged, the `text-transform: none` overrides that un-uppercased the Play Area's eyebrows (sidebar sections, menu section labels, ALL / NONE, search-panel heads, Recent searches label, card-table heads, review console stat labels / hints) are gone, and the SkillCat-only date-range button reads "Custom Range". Wherever this file says "sentence case", "Enter approx. time…" or a lower-case label, read the Play Area's wording instead. The `useDsText()` / `DsText` / `SelectField dsCase` plumbing stays as a pass-through, so a deliberate per-look wording change has one place to go. The breadcrumbs over list titles show in this look too (Eshwar, 2026-11-03), with the title the crumb's 4px below it as in the Play Area. Same day: the Spotlight Actions column widens to the side-by-side Approve / Reject pair (217) so the 3-dot menu stays visible; Exam Reviews / Hands-On / Spotlight titles (wrapped in a bare `<div>`) get the Tasks title row; the review console head keeps the Play Area's 0 side inset in the split layout so it lines up with Learner's Notes. The row hover bar (Review Task / Review Exam / View Request and the icon cells, also in the picker modals) keeps the shared bar component's cells — the DS 28px Ghost icon button applies only to the resting kebab / chevron.

## Eric's Tasks list — what changed on 2026-11-02

- Title row (superseded 2026-11-03 — summary now below the title, no divider; see "Page head + search"): Bold 24 title and the grey 16 summary on one line, header buttons on the right, a 50% divider under the row; the 56px collapsing landing header is switched off under the SkillCat look (the head stays pinned at one size).
- Copy is sentence case: a small `sentenceCase()` helper (src/designSystem.ts) lowercases Title-Case words after the first on chip labels, column headers, row-menu items, the header buttons, the summary line and the search placeholder. Acronyms and brand words (HVAC, SkillCat, xAPI, ID) keep their case. Only the Tasks page and the shared pieces are wired so far; other pages pick it up as they are done.
- The rail has no logo: the expand control is in the top row and an Account icon sits at the bottom (DS Sidebar, collapsed). Nothing is behind the Account icon yet.
- Row menu: DS Menu at 320 wide, 16px rows with 16 icons, disabled rows grey with the reason line beneath, Delete in red under a divider.

## Decisions the DS leaves open (worth confirming)

| Where | What I did | Why / the alternative |
| --- | --- | --- |
| Page search bar | Input / Search **Compact Medium, 32 tall**, 320 wide, at the left of the chip row (decided 2026-11-02) | The DS puts the page search inside the filter row next to the chips. Done with CSS only: the element holding `.toolbar` + `.filters` becomes a two-column grid, so no page markup changed. The suggestions panel keeps a 560 minimum width. |
| Filter chips | **Table select** type (28 tall, full radius, dashed → solid) | Matches our "+ Task Type" / "⊗ Created By · SkillCat" pattern exactly. The DS also has a plain 32-tall Chip Medium for filter rows; we don't use that shape. |
| Sidebar width | **240 / 64** (DS Sidebar) | Ours is 270 / 100. The DS component is pinned Compact and draws 240 expanded, 64 collapsed. |
| Sidebar counts (Hands-On, Exam Reviews…) | plain grey count text at the row's right | DS Menu / Item "count" option; our pill badge has no DS equivalent. |
| Status pills in table cells | Status Label **Small** (20 tall, SemiBold 12) | DS: "Small … for tags inside table cells". Standalone status labels elsewhere should be Default (Compact 28, SemiBold 14) — not done yet. |
| Table row height | **48** | DS rows are 48 in both densities; ours were 40. Tables inside dialogs/cards should use the DS "Small" table (40) — not done yet. |
| Page title | displayLarge Compact: Bold 32 / 34 | Ours was SemiBold 32 / 1.2. Weight changed to match. |
| Dialog description | IBM Plex Mono Medium 14 grey | The DS sets dialog body copy in mono; our confirms were Fira Sans 16 white. |

## Eric's screens (LMS Design, `DJoYweP5YPusfzCFDByOFp`) — corrections from Eshwar's Figma comments

The 23 screens on "LMS Design - new Components" are a rough layout brief, not the spec (Eshwar, 2026-11-03): anything taken from them is fine only where it doesn't go against the Design System file, which wins whenever the two differ (that's why the wizard controls are Compact, not the sizes Eric's frames carry). Their sentence-case copy stands because the DS components write copy the same way ("Enter approx. time…", "Request change", "Menu item"). Built as drawn otherwise, except where a comment says otherwise:

| Screen | Comment (2026-11-02) | What to build |
| --- | --- | --- |
| Companies, date range (1:3401) | "The shortcuts should be shown first. This shows only when custom range is clicked, like on the B2B Dashboard." | The Date Range chip opens on the preset shortcuts (Last 7 days, Last 30 days, …). The dual-month calendar with Start / End fields appears only after "Custom range" is picked — not as the first view. |
| Product config (1:3731) | "These should use the card table component" — on Force app update | The Force app update versions table (and the other `.qsec` tables on Product Config) is the DS Table **Small · 40, inside a card** — a bordered card with the small 40px rows — not a bare page table. |

## Screen-by-screen notes (all 23 screens, 2026-11-02)

| Eric's screen | What's built | Judgment calls / leftovers |
| --- | --- | --- |
| Tasks, row menu · Create task menu · Delete task | Title row, 54 filled search, chips, table, DS row menu with reasons, DS create menu with keycaps, dialog with Secondary Cancel + Destructive Delete | Cell values ("Hands-On Task") are data and stay Title Case. |
| Create task, steps 1–5 | Rail (CREATING, name 24, mono step numbers, grey check on done steps), 40-inset form, Compact fields (see above), bilingual boxes with counters, time field, segmented control, Choice cards, steppers, toggle card table, upload zones, #1B1B1B footer with ghost close | The footer keeps our Back / Create task / Continue set; Eric hides Back on step 1 — ours hides it too. Help texts built from expressions keep their case. |
| Skills · Question bank | Header-held title row, search 54, chips / Recent-searches chips, Categories index (mono letters, 30px rows; names Regular 14 and the column count / width / 40–48 gap from the Play Area's `indexLayout` — Eric's SemiBold names and fixed 24 gap were dropped 2026-11-04, Eshwar: "horribly spaced", "the text is regular in mine"), Skill / Mastery skill as Status Label Small | Breadcrumbs over list titles are hidden in this look (Eric draws none). |
| Certifications · Certification menu · Create certification menu · Edit certification, audience | Setup banner as DS Banner (count 32, Secondary CTA, ghost close) in the head grid; menus; wizard rules cover the Audience step's select + checkbox menu | Our seed shows no incomplete setups today, so the banner only appears when there are some. |
| Exam reviews list · Hands-on submissions list | Title row, search, chips, chevron rows. The run cards (`.rr-card`) keep the Play Area look — count 32 with its hairline divider, 70 tall, title 16 / sub 14 — in this look too (Eshwar 2026-11-04). Eric's "Stat card (pattern)" (1:2860) is a hand-drawn frame, not a SkillCat UI component, so there was nothing in the library to follow; the earlier 64-tall / count-24 restyle was removed. | Card labels ("All Reviews", "Review Type") come from data. |
| Exam review · Hands-on review | Head (crumb 12, name 24, line 16), section heads 20, DS frames with red flagged edge, surface rail, score boxes as 40px chips, console footer (#1B1B1B, Link Back, Secondary Skip, Destructive / Positive) | — |
| Users · Companies, date range | Users banner static (morph off); summary lines sentence-cased through `dsText()` like every other label ("460 users · 65 subscribers") — no CSS `text-transform`, which would also drop a line's first capital (fixed 2026-11-03); Date range opens on the preset shortcuts (apply on pick) with "Custom range" revealing the two-month calendar — Eshwar's comment, not Eric's screen | The calendar's footer keeps Clear + Apply (Eric shows Cancel + Apply); Clear has a job here. |
| Spotlight · Create spotlight · Product config | 64px rows with 96×44 backdrops, Positive / Destructive Approve + Reject; preview rail title; tabs; every boxed table on Product Config is the DS card table (Eshwar's comment) | Tab labels and the subscription / status pills are data and keep their case. |

## Compact-everywhere pass (2026-11-03)

Swept every list page, every create / edit flow (each wizard step), every row-menu modal, Product config's tabs, the preview panels, both review consoles and the Full profile with an in-browser check for overlapping boxes, double borders, controls that aren't 40, values not in mono 16, Title Case copy and record names that came out lowercased.

**Overlaps / broken controls fixed**
- Every `SelectField` (Tax status, the Address Country / State rows, Phone code, Time unit, seat price…): the select rule boxed SelectField's *wrapper* instead of its button, so each select drew two borders, and inside the Address card the Country / State rows grew to 64 and overlapped the lines below. The shell is now the `.select-field` button; the wrapper draws nothing. Address rows are 40 each, hairline included.
- Manage completions' two-half search: each half drew its own 40 box inside the shell. One shell now, halves bare.
- Price ID matrix (paid Quiz, "Different price per attempt"): the label column kept the old 45 rows while the inputs went to 40, so Apple / Google / Stripe drifted off their inputs. Labels are 40 now and level.

**Controls brought down to Compact 40 / mono 16** (they were still the Play Area's 45, in Fira Sans): multi-select (Trade, Partnership, Industries… — chips inside are 24, label 14), deep link field, date field, rich-text body (mono 16 / 24; the toolbar stays Fira), seat-price field, the certification builder's course / lesson / task rows, and the dashed "Add course" / "Add condition set" buttons (Bold 14 / 20, radius 8).

**DS components that had no rules before:** Toast (17013:360 — 360 wide, min 48, Success tint, Bold 14 / 20 at the Compact chip size) and Tooltip (18839:2937 — Menu surface #1D1D1D, 1px #404040, 8 / 12 inset, Regular 14 / 20, max 240).

**Copy** — sentence case now reaches the strings the first pass missed: ~200 literal copy props (modal titles, CTAs, search placeholders, radio-card titles), the row menus on Companies / Feedback / Skills / Users / Awards / Who paid, the empty-state overlays on Merge / Transfer, Name change review, the Skill / Spotlight / Award wizards' lines, locked-field notes, price-ID headers, Tax status options. "Universal" joined the proper-noun list (EPA 608 Universal in example copy).

**Data that was being lowercased — reverted** (the first copy pass ran these through the sentence-case helper): Spotlight titles and descriptions (preview card and queue), learner's notes on the Hands-on review, preview-panel titles and subtitles (certification / task / skill names and descriptions), names inside the Name change confirm sentences, and Question bank category names in the Categories index (now Title Case like the quick pills — data, per the rule above).

**Checked and left as is:** radio cards are 46 (12 + 20 + 12 + edges — the DS Choice / Description card), toasts sit outside the 40 rule, the Manage completions ghost dot overhangs its slot by design.

## Alignment sweep (2026-11-03, later)

Every list page, row-menu screen, wizard step, modal, console, preview panel, Attempts, Who Paid and the Full profile, compared box by box against the Play Area: alignment inside the parent, stacked left edges that split, sibling gaps, overlaps, controls running past their parent, clipped text.

**Fixed**
- Page head on every page whose header holds only the title + summary (Content Links, Industries, Feedback, Scholarships, Pending ID re-uploads, Attempts, Who paid, Manage IDs, Question versions…): a list-head rule was also landing on the title block itself, so the title was right-aligned over the summary and the gap to the search doubled (48). Title and summary are left-aligned again, 24 to the search.
- Setup / Industries banners: the ✕ sat 4 over "Continue Setup" / "Assign Industries" (the Play Area pulls it back 28 out of a 40 gap; this banner's gap is 24). Now 12 after the button.
- Hands-on review: the ten Score buttons were a fixed 40 and ran 21 past the rail at 1440 ("10" over the edge). They are up to 40 and give way to fit (38 at 1440).
- Exam review: the name sat 8 right of the "Exam Reviews" crumb and 32 below it. The head is 32 inset like the crumb and the sections, and the name is the crumb's 4 below it.

- Question editor (and the Task wizard's field stacks): fields sat 56 apart — the look's 24 field margin landed on top of the stack's 32 gap. Every wizard field is now 24 from the next, as in the Skill / Certification / Company wizards; sections stay 40 apart (Eshwar, 2026-11-04). Product config keeps its 32.

- Field label → control is 8 everywhere, as Field (17062:672 / 17012:470) draws it. The look's label rules restated the base 8 bottom margin and so beat every container that zeroes it because a flex gap spaces the field: the Hands-on / Exam review Score and Feedback labels sat 16 over their controls, and label rows with a pill and toggle fields picked up a stray 8 (Eshwar, 2026-11-04).

- Card tables are NOT restyled in this look (Eshwar, 2026-11-04: "Have it use that itself"). Product Config's lists (Force App Update, What's New Page, App Deep Links, Tabs, Support Pages, option lists) and the wizard `.qsec` tables (Quiz Sections, Media File Types…) had a DS card override — 1px #404040 border, r8, filled 40 header, bold names; it is deleted, so they draw the Play Area's Card Table base (710:1083) exactly like Completion Criteria.

**Checked and left as is** (deliberate DS sizes, not drift): the dual-language upload's English / Español labels sit at the start (Field label) rather than centred; wizard content is 40 inset while the footer ✕ sits at 24 + its 32 box; the Question bank Categories head is a left label with the add button at the far right; Product config's ✕ is a 28 ghost box.

## Fixes (Eshwar, 2026-11-04)

- Banner button (every tinted NoteCard: Users › Review Names, Certifications › Continue Setup, Merge / Transfer › Swap Roles): per Banner / Trailing=Button (19004:4287) it uses the see-through on-tint fill (white 8%) with a white 16% edge so it picks up the banner tone. It is not the page Secondary on opaque #0d0d0d. The banner title is SemiBold (600), not Bold.
- Per-Seat Price: the currency cell stretches to the full 38px, so USD sits on the same line as the amount.
- Certification builder (Add Tasks): the flush content area keeps 0 padding. The DS wizard 40px gutter no longer insets it.
- Merge / Transfer comparison tables: cells keep 10px above and below with top alignment, so text no longer sits on a row's top line.
- Picker tables in modals (`.stm-table--preview`: Find a Deep Link, Add Existing Tasks): the sticky action column, header included, uses the modal surface rather than the page's #0d0d0d. Its hover and ticked washes are laid on the modal surface too.
- Product Config: the tab bar has no bottom margin. The body's 32px padding is the only gap, as in the Play Area (it was 56).

## Not restyled yet (still the Play Area look under the SkillCat switch)

Banners other than the Certifications setup banner and the Users name-change banner, `NoteCard` / `TableCard` / `ListCard` surfaces, skeleton ghosts, and page-specific `.xx-*` surfaces that have no DS counterpart. Their sizes don't clash with the Compact controls (the sweep found no overlaps), but their fills and type are still the Play Area's.
