# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SkillCat's internal staff only (confirmed 2026-11-05): the content team (Tasks, Certifications, Industries, Skills, Question Bank, Feedback Forms), support and operations (Users, Companies, Manage Completions, Exam Reviews, Hands-On Task Submissions) and the people who own Spotlight and Product Config. Roles and permissions come from the backend.

Everyone works on a single laptop screen or one monitor. Some sessions are short bursts to do one task (find a user, fix a completion, grant an attempt, review one submission); operations work can run into long sessions inside the lists and the review consoles.

## Product Purpose

SkillCat Admin is the back office for the SkillCat app, a skilled-trades training and certification platform (HVAC and related certifications such as EPA 608 appear throughout the seeded data). The repository name, "Moodle Escape", is the goal: replace the Moodle admin with one purpose-built tool where staff manage content, customers and system settings. Success is staff finishing each job faster and with fewer mistakes than in Moodle, with every destructive action made safe.

## Positioning

An admin built around SkillCat's own model rather than a generic LMS: Tasks with Quiz / Hands-On / xAPI types, Certifications with completion criteria and awards, proctored Exam Reviews and Hands-On review consoles, company rosters and seat plans, Spotlights, scholarships and paywall configuration, all sharing one set of patterns (session-remembered lists, filter-prefix search, double-confirmed destructive actions, the staged Changes Footer). A generic LMS admin cannot offer those flows without customisation.

## Operating Context

- Desktop web, mouse and keyboard, one screen. Shortcuts are part of the work: ⌘K focuses search, C creates, ⌘↵ continues a wizard step, ⌘⇧↵ creates from any step.
- Work happens in data tables (50 rows a page, Edit Columns, filter pills, Date Range), multi-step create / edit wizards with a left rail, row preview panels, modals that confirm twice, and queue-driven, keyboard-first review consoles.
- The prototype is the visual spec for the frontend spec (specs/frontend-spec.md) and is what engineering builds from, alongside Figma.

## Capabilities and Constraints

- Front-end prototype only: React 18 + Vite, seeded data in the browser, no backend. Published to GitHub Pages (e5hwar.github.io/moodle-escape-plan) and Vercel.
- One React tree draws every look. The Demo Controls panel sets a `data-ds` attribute on `<html>`; `src/index.css` is the Play Area base, `src/skillcat-ds.css` re-skins it as the SkillCat Design System (the default), and the experimental Lab look is being added as `src/lab-ds.css`. Switching keeps the screen, its scroll position and anything typed. Copy is identical in every look: no rewording, re-casing or "..." → "…".
- Terminology to preserve: Task, Certification, Industry, Skill, Mastery Skill, Question Bank, Sub-Category, Hands-On Task, Exam Review, Spotlight, Product Config, Company, Scholarship, Award.
- Conventions already fixed by the spec: 128 / 512 character limits, "—" for empty cells, status pills, toasts worded "Noun Verbed", Save Changes disabled until something changed, every Delete / Archive / Revoke confirms twice.

## Brand Commitments

Confirmed binding for every look on 2026-11-05:

- Dark theme. The exact background colours may change from look to look.
- SkillCat orange `#f05523` is the accent for primary actions and selection.
- Type families: Fira Sans for UI and IBM Plex Mono for values and data. Scale, weights and rhythm are open.
- Name: SkillCat Admin (the browser title reads "SkillCat LMS").

## Evidence on Hand

- A full seeded dataset in `src` (tasks, certifications, users, companies, questions, spotlights, submissions).
- Figma: SkillCat-UI design system `EEki6uMz0Q3KkQv8vhKkvD`; Eric's LMS screens `DJoYweP5YPusfzCFDByOFp`; the Play Area's component frames referenced by node id in `specs/` and the stylesheet comments.
- `specs/frontend-spec.md` (behaviour), `specs/skillcat-ds-exceptions.md` (how the SkillCat pass recorded its decisions).
- No marketing claims, testimonials, metrics or pricing live in this repository; none should be invented.

## Product Principles

1. Scanability over expression: staff read these lists all day, so density and contrast serve reading first.
2. One pattern everywhere: one search, one table, one confirm, one toast. A control that looks different in two places is wrong in one of them.
3. Safe by default: destructive actions confirm twice, Save is disabled until something changed, leaving with unsaved changes asks.
4. Keyboard-first for repeated work, with shortcuts shown rather than hidden.
5. The prototype is the spec: what it draws is what ships.

## Accessibility & Inclusion

No product-specific standard has been established. Internal desktop tool: keep full keyboard operability and readable contrast on dark grounds.
