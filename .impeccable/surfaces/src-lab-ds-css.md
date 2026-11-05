---
version: 1
slug: "src-lab-ds-css"
primary_target: "src/lab-ds.css"
related_targets: ["src/designSystem.ts","src/components/DemoControls.tsx"]
---

# Lab design system — surface brief

Scope: the third, experimental look for the whole SkillCat Admin prototype, switched on by Demo Controls › Design System. Every screen keeps its React tree, copy, data, behaviour and shortcuts; only `src/lab-ds.css` (scoped to `html[data-ds="lab"]`) changes the look. The two existing looks (Play Area in `src/index.css`, SkillCat in `src/skillcat-ds.css`) are not edited. Visitor mode: Operate.

Audience and job: SkillCat's internal staff on one screen, scanning 50-row lists, running wizards and confirming actions; some in short bursts, some in long operations sessions. Binding: dark ground, orange #f05523 accent, Fira Sans + IBM Plex Mono.

Chosen direction: Reference Card (the IMPECCABLE'S PICK card; the roll's assigned Signal Panel was passed over by the user on 2026-11-05). Memorable moment: the ruled reading grid, column rules plus a heavier rule every fifth row, in tabular mono.

## Direction contract

THESIS: SkillCat Admin as the trade's pocket reference table: a ruled reading grid that makes fifty rows findable in a second. It refuses the category default of soft washes, floating cards and tinted pills on a near-black void; structure is drawn with rules, not fills.

OWN-WORLD: cool graphite ground #0e1013, surfaces one step lighter #121519, panels #15191e; hairline rules #22262b and heavier guide rules #343a42; ink #e6e8eb, secondary #8f959d, tertiary #5c636b. Orange #f05523 only on the primary action, the sort arrow and the date-scoped column marker beside it, and the focused control's rule; the current nav item is a hairline ring with its icon in first ink, never a fill (corrected 2026-11-05 to match the user-picked sketch). State colours are ink and outline, never fill: green, amber, red and blue text inside hairline outlines. Radius 3 everywhere. IBM Plex Mono with tabular figures for every value, date, count, placeholder, keycap and summary line; Fira Sans Medium 13.5 for names, SemiBold 11.5 tracked for column heads, Bold 20 for page titles, SemiBold 13 labels. Density: data rows 32, table heads 28, text controls 36, chips 26, buttons 30, menu items 32, modal inset 20. Vertical column rules in every data table and a heavier rule under every fifth row.

STORY: an admin opens a list, runs down the ruled grid to the row, reads values that line up in mono, and acts from the row. Wizards, menus and modals are the same card, ruled and quiet, so nothing is relearned between screens.

FIRST VIEWPORT: the Tasks list at 1440×900. The 100px graphite rail at the left with the current item ringed by a hairline, its icon in first ink. Title Bold 20 with the mono summary 4 below it; Skills, Question Bank and the orange Create Task at the right, 30 tall. A 36 search with mono placeholder and keycaps, 26 chips under it. The table 24 below: 28 head with tracked SemiBold labels and the orange sort arrow, 32 rows with column rules and the guide rule under rows 5, 10, 15; names Medium, dates tabular mono, the kebab in the last column; the pager in mono at the foot. Signature interaction: the grid is live. The hovered row takes a 4.5% wash instantly; menus and modals open with a 120ms opacity and 2px rise, ease-out; keyboard actions and row hovers never animate; the Design System toggle crossfades 160ms only when Lab is one side of the switch.

FORM: Reference Card, candidate 1 on my ordered list, built as the pick card. seed:c07a983dd5d0c0da

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

Unresolved: the system's name ("Lab" is the working key and label; a proposal goes to the user at checkpoint 2). DESIGN.md: the user asked that it not be written or replaced without asking; the system is recorded in `specs/lab-ds.md`, and DESIGN.md is offered, not written. No rasters ship with this look.
