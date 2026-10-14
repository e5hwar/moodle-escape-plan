# SkillCat Admin — Frontend Spec

Status: under review (first full draft 2026-10-09; Sections 0 to 13 revised 2026-10-14 after review; appendices removed; consistency sweep in progress).

Prototype: https://e5hwar.github.io/moodle-escape-plan/ — each section links to its page. Backend rules are defined in the Platform Spec; this document cites it as (§n) and repeats a rule only where it changes what the SkillCat Admin sees or can do. Field, option and setting names are written in *italics*.

Permissions: SkillCat Admins have different permissions by role. The roles are defined in the Platform Spec (§25). Where an action is limited to some roles this document says "subject to Permissions".

Contents

- 0 Shared Patterns
- 1 Tasks
- 2 Hands-On Task Submissions
- 3 Certifications
- 4 Industries
- 5 Skills
- 6 Feedback Forms
- 7 Question Bank
- 8 Manage Completions
- 9 Companies
- 10 Exam Reviews
- 11 Spotlight
- 12 Users
- 13 Product Config

---

# 0 Shared Patterns

Behaviour every page follows.

## 0.1 Data Tables

- Every table has one or more fixed columns, in a fixed order. Every other column can be switched on and off in Edit Columns and dragged into a new order. A column switched on lands last, whatever its default position (Example: On Tasks, hide Type, which is second by default, then add it back. It is now the last column).
- Clicking a header sorts ascending. Clicking again flips it. Blank values sort below every real value in both directions.
- 50 rows per page. Changing the search, the sort, a filter or the date range returns to page 1 and the top of the table.
- A list page remembers its search, filters, sort, date range, visible columns, column order and page number for the session. Coming back by any route (the sidebar, the browser's Back, after an edit, after Create) restores them. A page the session has no memory of opens in its default state.
- Empty cells read "—". A truncated cell shows its full value on hover. Email and phone cells copy on click.
- Every quick action is also a menu item. An action that is disabled in the menu is never offered as a quick action.
- Clicking a row opens the Preview Panel on Tasks, Certifications, Skills and Question Bank. On the Hands-On Task Submissions and Exam Reviews pages, a row click opens the Review Console instead (0.10 Review Consoles).

## 0.2 Search Bar

- Typed text searches when the SkillCat Admin presses Enter, not while typing. Esc puts back the last searched text.
- Typing a filter name followed by a colon ("Type:", "Status:", "Certification:") turns the Search Bar into a list of that filter's values. Picking a value applies it to the matching Filter Pill and empties the Search Bar. Values already applied are not offered.
- Typed text that matches filter values shows those values as suggestions.
- ✕ clears the text and the applied search, never the Filter Pills. With a filter prefix ("Type:") in the Search Bar and nothing typed after it, Backspace removes the prefix.
- ⌘K on Mac, Ctrl+K on Windows, focuses the Search Bar. ↑ ↓ move through the options, Enter picks one.
- Phone numbers match on digits, so formatting does not matter.

## 0.3 Filter Pills

- A Filter Pill shows its single value, "All" when every value is chosen, or "N Selected".
- The More Filters pill reads "N Active" when any filter inside it is set. Each filter inside it has its own Apply.
- Clear Filters appears whenever any filter is set, including a page's default filter (Example: Question Bank opens with Status set to Active, so Clear Filters shows on arrival).
- The Date Range always has a value, cannot be removed, and is not reset by Clear Filters.
- A Filter Pill lists its complete source (Example: *Certification* on Tasks lists every Certification, not only the ones the current rows use). Picking a filter value that matches no rows shows *No Results Found*.

## 0.4 Row Menus and Unavailable Actions

- An action that exists but cannot be used right now stays in the menu disabled, with a one-line reason under it (Example: A question linked to a Quiz or Feedback Form cannot be archived. A Skill linked to a Mastery Skill cannot be deleted. A Task used in an Access Restriction cannot be hidden.)
- Companies is the exception: Its menu changes by Status, and unavailable actions are removed, not disabled (9.2 Company Actions, Companies).
- Menus close on an outside click, on scroll, and on Esc.

## 0.5 Preview Panel

- The Preview Panel's ⋮ holds the same items as the row menu. A menu item that opens a modal keeps the Preview Panel open behind it. One that goes to another page closes it. Copy and new-tab actions leave it open.

## 0.6 Confirmations

- Every destructive action (delete, archive, revoke, cancel, remove from a list) confirms twice. The second step names the consequence. Backing out of the second step closes both modals and discards anything entered in the first.
- A modal closes on ✕ or a click outside it. Esc always closes the topmost modal only.

## 0.7 Save Changes and Unsaved Changes

- On every edit page and in every edit modal, Save Changes is disabled until a value differs from what was loaded. Putting a value back to what it originally was disables it again. Hovering the disabled button says there is nothing to save.
- Pages that gather several changes before saving (Industries reorders, Manage Completions, Product Config) use the Changes Footer. It counts the changes. Its Hover Card lists each one with an ✕ that drops just that change. *Discard* clears them all. *Review & Save* lists every change in a confirmation before applying them together. While something cannot be saved yet, *Review & Save* is disabled and hovering it names what to fix.
- Leaving with unsaved changes asks whether to keep editing or discard. An untouched form leaves silently. The question is asked whichever way the SkillCat Admin leaves: the sidebar, the browser's Back, or an in-page link.

## 0.8 Create/Edit Pages (Multi-Step)

- Any step can be opened in any order from the left rail. A step left incomplete is flagged in the left rail once the SkillCat Admin moves past it.
- The Continue button is never disabled. While anything blocks creating, the Create (or Publish) button looks disabled but can still be clicked. Hovering it lists each missing field as "Field - Step". Clicking it flags every missing field, in the form and in the left rail, and jumps to the first.
- ⌘Enter on Mac (Ctrl+Enter on Windows) presses the Continue button. On the last step it presses the Create button. ⌘⇧Enter (Ctrl+Shift+Enter) presses the Create button from any step. Both are ignored while a modal is open.
- A scroll that reaches the top or bottom edge of a step stops there. A fresh scroll started at the edge fills an edge line, and the step changes when the line is full. Stopping before that cancels it.
- In Edit mode the final button is Save Changes (0.7 Save Changes and Unsaved Changes).
- A field's validation message appears in its label row after the SkillCat Admin leaves the field or moves past the step.

## 0.9 Select Modals

- Applies to Select Tasks, Select Certifications, Select Questions, Select Users and Select Skills.
- What a Select Modal lists is set by the page that opens it, and stated in that page's section.
- On a Create/Edit page, a row that is already added is shown greyed out with a pill saying where it already is, not hidden (Example: *Already in Feedback Form* on Select Tasks, *Added to Quiz* on Select Questions), and the item being edited is never listed.
- Filters a Select Modal opens with are ordinary filters the SkillCat Admin can clear (Example: *Task Type* set to Hands-On and Quiz on a Skill's Select Tasks modal).

## 0.10 Review Consoles

Hands-On Task Submissions and Exam Reviews share this shape.

- Review Run Cards:
  - A Review Run Card is one set of filters with its pending count.
  - Recents are filter sets the SkillCat Admin has opened. A Recent is recorded when a row or a Review Run Card is opened, and Recents are shown newest first.
  - Suggested cards are the page's fixed set (listed on each page) minus any already in Recents.
  - The strip holds seven cards. Recents take their slots first and Suggested cards fill what is left.
  - A Recent drops out once its queue is empty. The strip is hidden when nothing is pending.
- Clicking a row opens the Review Console on that row. Clicking a Review Run Card applies its filters, sorts oldest first, and opens the Review Console on the longest-waiting row.
- The Review Console's queue is the table as filtered and sorted when it opened.
- Each submission has its own URL, so a review can be reopened or shared.
- *Skip to Next* and *Submit & Next* move to the very next row of the queue, whatever its status. The "· n Pending" on *Skip to Next* counts only the rows after the current one that still await review. On the queue's last row *Skip to Next* is hidden, and the footer's Back is the way out. On Pending ID Re-Uploads, where every row awaits the user, the count is not shown.
- Taking an action (grading a Hands-On submission, or Approve / Reject / Request Re-Upload in Exam Reviews) moves to the next row. On the last row it returns to the page the Review Console was opened from. Each count updates with it: The sidebar badge (everything pending), the Review Run Card (pending in its filters), and *Skip to Next* (pending after the current row).
- Keyboard: N skips. Esc never leaves the Review Console.
- Leaving the Review Console returns to the page it was opened from, with that page's list restored.

## 0.11 Field Rules

- Each text field has a character limit, set per field. At the limit the counter turns red and saving is blocked.
- A field shown to users in the app also has a lower warning threshold, set per field. At the warning the counter turns amber and nothing is blocked. (This is used to let the SkillCat Admin know that their text will be truncated where users see it.)
- Bilingual fields come in EN and ES pairs. Where the field is required, EN is the required half. A blank ES falls back to EN for Spanish users.
- Rich text fields show their toolbar only while focused.
- An upload field takes one file (Example: the Certification image, a Skill image, a Tab Icon) or several (Example: Reference Files on a Hands-On Task). A bilingual upload has one drop zone per language.
- A required field with a sensible default starts on it (Example: *Completion Criteria*). *Requires Subscription* is the exception: It starts unselected so the SkillCat Admin makes the choice.
- A URL field shows a *Test It Out* link once it has a value. The link opens the URL in a new tab.
- Every date the SkillCat Admin sees is written *Oct 29, 2026*. A timestamp is written *Oct 29, 2026, 3:15 PM*. This holds for pills, columns, cards, confirms and the Review Consoles.
- A dropdown with a search box opens with the cursor in the search box. A modal, or a Create/Edit page step, whose first control is a text field opens with the cursor in it. The SkillCat Admin can start typing straight away, without clicking into the field first.

## 0.12 Toasts

- Every completed action shows a Toast named after the result (Example: Task Created). A copy action toasts only when the copy succeeded.

## 0.13 Login As

- Opens the user's app or the Company Dashboard in a new tab, as that account sees it, with a persistent banner naming the account. The SkillCat Admin's own tab is untouched. Several Login As tabs can be open at once, and closing the tab is the exit. The viewed account's own session and timestamps are unaffected (§24.1).

## 0.14 Keyboard Shortcuts

- A button that shows a key hint responds to that key. Single-key shortcuts are ignored while typing in a field, while ⌘ / Ctrl / Alt / Shift is held, and while a modal, menu or Preview Panel is open.
- A full-screen viewer (media, ID image) takes over the keyboard while open.

---

# 1 Tasks

Prototype Link: [Tasks](https://e5hwar.github.io/moodle-escape-plan/tasks)

## 1.1 Tasks List

### Overview

Every Task of every type, including Company/Tenant-Created ones. Follows 0.1 to 0.5. Fixed column: Name.

### Important Behaviors

- Default state: Sorted by *Date Modified*, newest first, with *Created By* set to SkillCat, so Company/Tenant-Created Tasks are hidden until that filter changes.
- *Edit Task* is disabled on a Company/Tenant-Created Task.
- The ID Upload Task's menu holds *Edit Task* only, always disabled.
- *Make Hidden*, *Make Visible* and *Delete Task* list the Certifications the Task is in before confirming.
- Tasks used in an Access Restriction, as the condition or as the restricted Task, have *Make Hidden* and *Delete Task* disabled (§2.3.3).
- A Task linked to one or more Skills has *Make Hidden* and *Delete Task* disabled, with the reason naming them (5 Skills).
- *View All Attempts* on a Quiz opens the Quiz Attempts page for that Quiz. On a Hands-On Task it opens the Hands-On Task Submissions page filtered to that Task, with the *Status* filter cleared so every submission shows.

## 1.2 Create and Edit (All Task Types)

### Overview

Follows 0.8 Create/Edit Pages and 0.11 Field Rules.

### Important Behaviors

- *Hidden* is disabled for a Task used in an Access Restriction.
- A Task whose name contains "Final Exam" with *Requires Subscription* set to *No: Can Access on Free Trial* asks for confirmation before it is created.
- On edit, when the Task sits in one or more Certifications, *Save Changes* first asks for confirmation and lists each Certification by name.
- A Quiz's structure (*Single Block* or *Sections*, and adding or removing Sections) and its grading level (*Quiz-level* or *Section-level*, with the *Must Pass* flags) are locked on every edit (§2.3.7.3). Section names and their order stay editable.
- The completion criteria, and with them a Quiz's pass marks and a Hands-On Task's *Passing Grade*, are locked once any user has completed the Task. Unlocking them to edit warns how many users' completion will be recomputed (§2.3.7.3).

## 1.3 xAPI Task

Nothing beyond 1.2.

## 1.4 Quiz Task

### Important Behaviors

#### Questions

- Each block or Section needs at least one question or random pool.
- Only questions with grading on can be used, in the Select Questions modal, in random pools and when created with *Create New Question*.
- A question can appear once in a Quiz. In the Select Questions modal, a question already in the list, in a pool or in another Section is greyed out with an *Added to Quiz* pill (0.9 Select Modals, Shared Patterns).
- *Create New Question* opens the Question Editor. The question is added to the Question Bank and to this list.
- Publishing checks every pool and question: A pool cannot draw more than its source holds, a draw must be at least 1, and points must be at least 1.

#### Grading & Completion

- *Quiz Passing Percentage* and each *Section Pass Mark* default to 70.

#### Attempt Limits

- *Cooldown Between Attempts* is *Uniform* (one value) or *Variable* (a value before specific attempts). In *Variable* mode the uniform value is still required and applies to every attempt without its own value. *Add* creates a row for the lowest attempt that has no value yet, and each row's attempt dropdown offers only attempts not already set. A row with blank minutes blocks publishing, and no row may go beyond *Maximum Attempts*.
- *Auto-Unlock Additional Attempts* needs at least one trigger Task and at least one attempt to unlock. The trigger dropdown lists every Task with completion tracking except this Quiz, hidden Tasks and Company/Tenant-Created Tasks. The ID Upload Task is included.

#### Post-Submission Review

- *Per-Section Results* is available only on a sectioned Quiz. *Result* is unavailable under Section-level grading. *Whether Correct* requires *Attempt*. *Per-Question Feedback* requires *Attempt* and *Whether Correct*.

#### Payments & Integrations

- Price IDs are entered per channel (Apple, Google, Stripe), either as one price for every attempt or as one price per attempt number, the last one covering every later attempt. A paid Quiz needs a Price ID for every enabled channel.

## 1.5 Hands-On Task

### Important Behaviors

#### Submission Fields

- *Character Limit for Supporting Text* defaults to 1000. 0 hides the text field for users.
- *Media Files* defaults to 3, range 0 to 10. At 0 the *Media File Types Allowed* toggles are disabled and the submission is text only. Setting it back above 0 restores the previous toggles.
- *Media File Types Allowed*: With *Media Files* above 0, at least one type must be on.

#### Completion

- *Maximum Attempts*: Unlimited (default) or 1 to 10.
- *Passing Grade from Reviewer* (default) shows *Passing Grade*, 1 to 10, default 5. *Submission Made* has no review and no score.

#### Discovery & Audience

- *Audience* reads *B2B Companies Only* whenever any Trade or Partnership is set, and is locked while one is.
- While the Task is linked to one or more Skills, *Trade*, *Partnership* and *Audience* are locked, and the lock names the Skills. The SkillCat Admin removes the Task from those Skills first (5 Skills).

## 1.6 Resource Task

- A Resource is a file or a link, and one of them is required to publish.

## 1.7 ID Upload Task

- One exists, created by SkillCat. It cannot be created, edited, hidden or deleted from SkillCat Admin (1.1 Tasks List).

## 1.8 Who Paid (Quiz) and Additional Attempts

Prototype Link: Tasks › ⋮ on a paid Quiz › View Who Paid

Fixed column: Name.

### Important Behaviors

- One row per purchased attempt. *Purchaser* reads *Self* when the user bought it, otherwise the company that bought it for them. *Refunded* shows the refund date. A refund revokes an unused attempt, and a used one keeps its result (§3.3, §4.3.6).
- *Grant Additional Attempts* picks users in the Select Users modal, then asks how many attempts to grant. Granted attempts appear as rows with *Access* reading *Free*.
- *Revoke Access* is disabled on a started or completed attempt.

### Acceptance Criteria

- Granting two additional attempts to a user adds two granted rows, and the user's remaining attempts rise by two.

## 1.9 Quiz Attempts

Prototype Link: Tasks › ⋮ on a Quiz › View All Attempts

Every column is fixed.

### Important Behaviors

- *Status*:
  - *Passed* / *Failed*: By the Quiz's own pass mark and grading model.
  - *In Progress*: While the attempt is open.
  - *In Review*: A proctored attempt awaiting Exam Reviews.
- The *Attempt #* Filter Pill is the exception to 0.3 Filter Pills: It offers only the attempt numbers reached on this Quiz.
- *Additional Attempts* in the header appears only on a free Quiz with a limited number of attempts, and opens *Grant Additional Attempts* (1.8 Who Paid and Additional Attempts). On a paid Quiz, attempts are granted from its Who Paid page.
- *Delete Attempt* is allowed on any attempt. The confirmation says that the cooldown resets with it. Deleting renumbers the user's later attempts, and deleting a passing attempt recomputes the user's completion from what remains. On a paid Quiz the purchase is kept: Its row on the Who Paid page goes back to *Not Started* and the user can attempt again without paying (1.8 Who Paid and Additional Attempts).

### Acceptance Criteria

- Deleting attempt 2 of 3 renumbers the third to 2.

---

# 2 Hands-On Task Submissions

Prototype Link: [Hands-On Tasks](https://e5hwar.github.io/moodle-escape-plan/review-hands-on)

## 2.1 Queue

### Overview

Every submission users have made on Hands-On Tasks, and the Review Console that scores them. Follows 0.10. Fixed column: Task.

### Important Behaviors

- *Status*:
  - *Review Pending*: awaiting a score.
  - *Completed*: scored at or above the Task's *Passing Grade*.
  - *Rejected*: scored below the Task's *Passing Grade*.
  - *No Action Required*: nothing for an SkillCat Admin to do. The Task is Company/Tenant-Created (its company scores it on the Company Dashboard), or its Completion Criteria is *Submission Made* (completes on submit, no score) (§5.3.4, §5.3.5).
- Pending count: the number of *Review Pending* rows. The sidebar badge, the Review Run Cards and the Skip count all use this definition over their own set.
- Default state: *Status* set to *Review Pending* and *Created By* to SkillCat, sorted *Submitted On* oldest first. *No Action Required* rows appear once those filters change.
- Review Run Cards (0.10 Review Consoles, Shared Patterns): the suggested set is All Tasks, the three Certifications with the most pending, and the three Tasks with the most pending. A Recent is keyed on the active Company, Task or Certification filter, in that order of precedence; with no filter nothing is recorded. Company cards exist only as Recents.
- A Review Run Card applies *Review Pending* + SkillCat + its own filter (0.10).

### Acceptance Criteria

- A Task with *Submission Made* as its Completion Criteria has its submissions shown as *No Action Required*, and they open read-only.
- Opening a row under a Task filter records a Task Recent; the Review Run Card disappears when that Task's queue empties.
- The sidebar badge equals the number of *Review Pending* rows and falls by one per submitted review.

## 2.2 Review Console

### Important Behaviors

- Gradable only when all three hold: the current attempt, a SkillCat-created Task, and *Review Pending*.
- Read-only cases show a card in place of the scoring controls:
  - A scored attempt, whether the current one after review or any past attempt: the card shows its score and feedback.
  - A Company/Tenant-Created Task: the card names the company that grades it.
  - A Task with *Submission Made* as its Completion Criteria: the card says no grading is needed.
- A user may edit a submission until it is scored, so the Review Console loads the latest media and notes when opened and again at Submit. If the submission changed since it was opened, Submit is refused with a notice to reload (§5.3.3).
- A user cannot start a new attempt while one awaits review, so a Task never has two unreviewed rows for one user (§5.3.3).
- Opening a past attempt makes the Review Console read-only; Esc or *Back To Current Attempt* returns.
- Score buttons below the Task's *Passing Grade* are shown as rejecting, at or above it as passing, and the legend states both ranges (no rejecting range when the *Passing Grade* is 1). Pressing the chosen score again clears it.
- Feedback is optional. Submit is disabled until a score is chosen, and while feedback is over its character limit; its hover says which.
- Keyboard: 1 to 9 set the score, 0 sets 10. ← → step through media without wrapping. Esc leaves a past attempt or a field, never the Review Console.
- The submit confirm names the outcome (passed at n/10, or rejected and returned to the user to resubmit) and that a submitted review cannot be changed.
- After submitting, the Review Console steps to the next row of the queue (0.10); on the last row it returns to the table. Reviewed rows leave a *Review Pending* table; skipped rows stay.
- Each submission has its own URL, so a review can be reopened or shared.
- Hovering the user's name shows the user details card. The icon beside the Task title opens the Task's Pre-Submission Screen (what a user sees before attempting it) in a new tab.

### Edge Cases

- A submission with no media (none uploaded, or the Task allows none) shows the notes in full width; one with no notes shows the media alone. Unknown or corrupt media shows a placeholder with Download still available.
- Two SkillCat Admins review the same submission at the same time: the one who submits second sees an error, and the page reloads with the result the first one submitted.
- Hiding a Task has no effect on its submissions. Deleting a Task removes its pending rows; scored ones stay on the user's record.
- User merged into another account mid-queue: the row shows the surviving account on next load. User deleted: the row drops out and the Review Console advances.
- A Task switched from *Submission Made* to *Passing Grade from Reviewer*: earlier submissions stay *Completed* with no score; new ones enter the queue.

### Acceptance Criteria

- On a Task with *Passing Grade* 7, pressing 6 shows a rejecting colour and the confirm says Rejected; pressing 7 shows passing.
- An already-scored row opens read-only with its score and feedback and no Submit.
- A past attempt opens read-only and Esc returns to the current one.
- Submitting on the last row returns to the table; the Skip button is not shown on the last row.
- After one review is submitted, the sidebar badge, the matching Review Run Card's count and the Skip count each drop by one.

---

# 3 Certifications

Prototype Link: [Certifications](https://e5hwar.github.io/moodle-escape-plan/certifications)

## 3.1 Certifications List

### Overview

Every Certification, including Company/Tenant-Created ones. Follows 0.1 to 0.5. Fixed column: Name.

### Important Behaviors

- Default state: sorted newest first with *Created By* set to SkillCat.
- *Edit Certification* is disabled on a Company/Tenant-Created Certification, as on Tasks (1.1).
- Only SkillCat-created Certifications can have Industries, Content Links, an Award and a Feedback Form. On a Company/Tenant-Created Certification, *Add Award* and *Manage Content Links* are disabled, Industries cannot be tagged, and it is never offered as a Feedback Form trigger.
- Setup status: a SkillCat-created, All Users Certification shows *Setup incomplete* for 30 days from its creation, until four steps are done: Industries tagged, Content Links added, an Active Award, and an Active Feedback Form triggered by it. A banner counts incomplete Certifications, a *Setup* filter finds them, and the Preview Panel shows the steps with *Continue Setup* on each. SkillCat-created B2B-only Certifications and Company/Tenant-Created ones never show it.
  - Content Links counts only links this Certification added. A link another Certification made to this one (Example: EPA 608 Universal lists this Certification as its Recommended Next) does not count.
  - Award counts only an Active Award.
  - Feedback counts only an Active form. *Add* opens the Feedback Form Editor pre-triggered and creates nothing until the SkillCat Admin saves a form with a name and a question.
  - *Mark as Done* closes the status for that Certification.
- Menu items that depend on the row:
  - *View Who Paid*: paid Certifications only.
  - *Add Award* while the Certification has no Award, *Manage Award* once it has one. *Delete Award* is inside the Manage Award page.
  - *Archive & Replace* on active rows; *Manage Archive & Replace Settings* on archived rows.
- Archived and Hidden are independent: an archived Certification can still be hidden or shown, and shows both pills when it is both. *Archived* and *Visibility* are separate filters.
- *Make Hidden* asks for confirmation. A hidden Certification stays in pickers and in Content Links.
- *Delete Certification* confirms twice. When another Certification still references it (in its Condition Sets, or through imported Courses), Delete is refused with a modal listing them. Deleting removes its Content Links in both directions, its Award, its Feedback Form trigger and its setup status.
- *Backup Certification* downloads the record; *Upload Backup* (3.3) restores it as a new Certification.
- *View All Tasks* opens the Tasks page filtered to the Certification, with *Created By* cleared so every Task in it shows whoever made it.
- C opens the Create menu.

### Acceptance Criteria

- A SkillCat-created All Users Certification created today shows *Setup incomplete* until all four steps are done, and stops showing it after 30 days. A B2B-only or Company/Tenant-Created one never shows it.
- A Content Link added from another Certification pointing here does not complete this Certification's Content Links step.
- Deleting a Certification referenced in another's Condition Set is refused with the referencing Certification named.
- Deleting a Certification removes its Award and its Feedback trigger.

## 3.2 Create and Edit

### Overview

Create offers *From Scratch*, *Upload Backup* and *CSV Upload* (3.3). Follows 0.8 and 0.11.

### Important Behaviors

- *Short Description* has a character limit and a warning threshold, since it is cut short where it is shown.
- *Deep Link* slug is derived from the name and can be edited. It must be unique across Certifications and must not be one of the app's reserved paths; an invalid or taken slug blocks publishing. A restored backup gets a fresh unique slug (§19.3.5).
- *Import Courses* copies every Course of each chosen Certification (its Tasks are reused) and adds that Certification itself as an item in the Condition Set. (Example: importing EPA 609 and Brazing Fundamentals adds two Certification items to the set, so both must be completed for the set to be satisfied.) The picker offers every Certification except this one, including archived and hidden ones. In Edit mode with locked criteria, the Condition Sets are left untouched.
- *Add Existing Tasks* picks from the Tasks library; a Task used elsewhere shows where, and *Preview* on a row opens that Task's Preview Panel over the modal. *Create Task* opens the Task Create page full width; the Task is added to the library and to this Certification.
- *Access Restriction* on a Task has two options: available only after all, or after any, of the chosen Tasks complete. The choices are the other Tasks in this Certification. The ID Upload Task is always listed first; it can be chosen only once it has been added to this Certification, and until then it is greyed out with the reason beside it. Choosing it makes a Quiz require ID verification. A Task used in an Access Restriction cannot later be hidden or deleted (1.1).
- Every delete of a Course, Lesson or Task confirms twice.
- Publishing needs every Course to hold at least one Lesson or Task, and every Lesson to hold at least one Task. The Create button's hover names each empty one. The last Course can be deleted; publishing is then blocked.
- Completion: up to four Condition Sets, a limit of this interface rather than the backend. A Certification completes when every item in any one set is complete. Items are Tasks of this Certification or other Certifications, never itself (§7.3.7.1).
- Once any user has completed the Certification the criteria are locked; editing warns how many users will be recomputed (§7.3.7.3).
- Paywall: Free, or paid as *Non-Consumable* or *Consumable*, with Price IDs per channel.
- *Audience* reads *B2B Companies Only* whenever any Trade or Partnership tag is set, and is locked while one is.
- Once a Certification is created, the list opens with the Industries modal for it; *Skip for now* saves no Industries. A B2B-only Certification gets no modal.

### Acceptance Criteria

- Importing a Certification adds it as a Condition Set item without removing the items already there.
- The Add Requirement picker never offers the Certification being edited.
- An empty Course or Lesson blocks publishing and is named in the Create button's hover.
- A slug already used by another Certification blocks publishing.

## 3.3 Upload Backup and CSV Upload

- Both will be defined once the final backup and CSV file formats are known.

## 3.4 Who Paid (Certification) and Grant Access

Prototype Link: Certifications › ⋮ on a paid Certification › View Who Paid

Fixed column: Name.

### Important Behaviors

- One row per buyer. For Consumable Certifications, a row carries *Access Ended* once the access was revoked.
- *Grant Access* gives a user free access to the Certification, as a permanent entitlement equal to a purchase.
- *Revoke Access* applies to Consumable Certifications and confirms twice. On a Non-Consumable purchase it is disabled, since that access ends only by refund (§7.3.3).
- A user whose access was revoked can be granted free access to the Certification again, or buy it again themselves.

### Acceptance Criteria

- Granting access to a Free Trial user lets them open every Task of the Certification; revoking a Consumable sets *Access Ended* and the user can be granted free access again.

## 3.5 Content Links

Prototype Link: Certifications › ⋮ › Manage Content Links

### Important Behaviors

- At most 10 Content Links per Certification; the add control is disabled at 10. A blank strength is invalid.
- Targets are SkillCat-created Certifications; hidden ones are allowed, Company/Tenant-Created ones are not.
- The top section lists the links this Certification added. Edits take effect on Save, and the Save/Discard bar stays while searching.
- A pinned footer lists the Certifications that link to this one. They are not editable here.
- Company/Tenant-Created Certifications have no Content Links page.

### Acceptance Criteria

- Renaming a linked Certification keeps the link; deleting it removes the link from the other end.

## 3.6 Award

Prototype Link: Certifications › ⋮ › Add Award

### Important Behaviors

- Each Certification has at most one Award. The menu reads *Add Award* until one exists and *Manage Award* after. *Delete Award* is in the Manage Award page and confirms twice.
- Saving an Active Award issues it at once to every user who already completed the Certification (§12.3.4).

### Acceptance Criteria

- Creating an Award on a Certification with completed users shows a holder count equal to those users at once.
- Marking a user's Certification incomplete leaves their Award in place (§12.3.5).

## 3.7 Archive & Replace

Prototype Link: Certifications › ⋮ › Archive & Replace

### Important Behaviors

- The page takes optional replacement Certifications and an optional replacement alert for users, then archives with a two-step confirm (§7.3.8).
- An archived Certification stays in SkillCat Admin pickers and can still be hidden or shown (3.1). Its menu reads *Manage Archive & Replace Settings*, which reopens this page prefilled.
- *Unarchive* is a secondary action in the page footer: an explanation, then a confirm. It clears only the archived state; Hidden or Visible stays as it was, and the replacement alert stops.

### Acceptance Criteria

- An archived Certification that is then hidden is still hidden after Unarchive.

---

# 4 Industries

Prototype Link: [Industries](https://e5hwar.github.io/moodle-escape-plan/industries) (Certifications › Industries)

### Important Behaviors

- The untagged banner lists All-User SkillCat-created Certifications with no Industry or Sub-Industry tag. *Assign Industries* on it opens a modal listing those Certifications, each with its own Industries multi-select (an Industry, or Industry › Sub-Industry). A row left empty stays untagged.
- ✕ on the banner hides it for the Certifications listed. The banner comes back if one of those Certifications later has no tag again.
- A Certification's ⋮ on an Industry or Sub-Industry hub has one item, *Remove*, which confirms twice.
- Only drag-reorders go through the Changes Footer (0.7 Save Changes and Unsaved Changes, Shared Patterns). Adding, removing, renaming, hiding and deleting apply at once.
- A hidden Industry or Sub-Industry shows no position number; the visible ones count on without it, since users never see the hidden one.
- The Search Bar finds Certifications, not Industries. Each result is one row per place the Certification is tagged (Industry, or Industry › Sub-Industry), and opening a row opens that hub.
- Shortcuts: C creates an Industry, or a Sub-Industry inside a hub; A opens *Assign Industries* from the banner; ↑ ↓ and Enter walk the launcher. All are ignored while a dialog, including *Review & Save*, is open.

### Acceptance Criteria

- Industry names are unique; Sub-Industry names are unique within their Industry. A duplicate or blank name cannot be saved.
- *Remove* on a hub drops the Certification's tag for that Industry or Sub-Industry only; its other tags stay.
- Deleting an Industry leaves its Certifications in place, untagged, and the untagged banner counts the All-User ones.
- Reorders are not applied until *Review & Save* confirms them.

---

# 5 Skills

Prototype Link: [Skills](https://e5hwar.github.io/moodle-escape-plan/skills) (Tasks › Skills)

### Overview

Skills and Mastery Skills in one list, with one Create/Edit page each. Follows 0.1 to 0.5. Fixed column: Name.

### Important Behaviors

- The Tasks picker offers SkillCat-created All-User Tasks of every type and opens with *Task Type* pre-set to Hands-On and Quiz, a filter the SkillCat Admin can clear.
- A Hands-On Task linked to a Skill cannot become B2B-only: its *Trade*, *Partnership* and *Audience* are locked while the link exists (1.5).
- The *Industries* and *Linked Certifications* columns are not set on the Skill. A Skill's come through its linked Tasks (the Certifications those Tasks sit in, and those Certifications' Industries); a Mastery Skill's come through its Skills.
- A Skill linked to any Mastery Skill (archived or not) cannot be archived or deleted: *Archive* and *Delete* are disabled. The SkillCat Admin removes the Skill from each Mastery Skill's criteria first. (The backend asks only for a warning on archive, §11.3.4; this interface blocks it.)
- The Mastery Skill Create/Edit page flags any linked Skill that is archived, since the Mastery Skill cannot be earned while one remains (§11.3.4).
- An archived Skill or Mastery Skill can be made Active again from its menu.
- Name EN is required, Name ES optional; the image is required. A Skill needs at least one Task and a Mastery Skill at least one Skill to be created.

### Acceptance Criteria

- Creating a Skill on a Task that users have completed shows those users as holders at once.
- A Skill linked to an archived Mastery Skill still shows *Archive* and *Delete* disabled.
- The Tasks picker lists Resource and xAPI Tasks once the *Task Type* pre-set is cleared, and never lists a B2B-only Task.

---

# 6 Feedback Forms

Prototype Link: [Feedback Forms](https://e5hwar.github.io/moodle-escape-plan/feedback) (Certifications › Feedback)

### Overview

Follows 0.1 to 0.5. Fixed column: Name.

### Important Behaviors

- A form is *Active* or *Archived*. New forms start Active. *Archive Form* stops it showing to users; its triggers and questions can still be edited while it is Archived, and *Unarchive Form* brings it back.
- *Delete Form* is offered only while the form has no responses.
- *Duplicate Form* makes an independent form linked to the same questions; afterwards the two share nothing but the questions themselves (§13.2).
- Removing a question from a form that has responses makes that question Inactive and keeps its responses; the *Inactive Questions* field lists them. On a form with no responses at all, the question is simply removed.
- A Task or Certification can trigger at most one form, so the Add Trigger modal greys out items already used by another form (0.9 Pickers, Shared Patterns).
- Any SkillCat-created Task or Certification can be a trigger. Company/Tenant-Created content cannot.
- *Export Responses* downloads a CSV of the form's responses.
- C creates a form; Q on the Create/Edit page opens the add-question menu (0.14 Keyboard Shortcuts, Shared Patterns).
- A form needs a name, at least one question and at least one trigger to be created.

### Acceptance Criteria

- A Certification already used as a trigger is greyed out in another form's Add Trigger modal.
- Archiving a form keeps its triggers editable and the form hidden from users.

---

# 7 Question Bank

Prototype Link: [Question Bank](https://e5hwar.github.io/moodle-escape-plan/question-bank) (Tasks › Question Bank)

## 7.1 Browsing

### Overview

Two screens: the Category View (a Recent row, then an A–Z index of Categories with their Active question counts) and the questions table, opened for one Category or for All Questions. The table follows 0.1 to 0.5. Fixed column: Question.

### Important Behaviors

- The questions table opens with *Status* set to Active, so Clear Filters is visible on arrival (0.3 Filter Pills, Shared Patterns). Clearing it reveals Archived questions.
- In the All Questions table, the *Category* Filter Pill lists Categories as well as Sub-Categories. That way a Category with no Sub-Categories can still be filtered.
- A Category or Sub-Category can be deleted only while it holds no questions.
- The row menu shows *Archive* (or *Unarchive*) on a question that has been answered at least once, and *Delete* on one that never has. Whichever is shown is disabled while the question is linked to any Quiz or Feedback Form, including Inactive question links on a form.
- *Version History* appears in the row menu only once a question has more than one version.
- The *Attempts* column counts attempts across every version of the question; Version History breaks the total down per version.

## 7.2 Question Editor

### Important Behaviors

- Multiple Choice needs at least two options. When graded, each option carries a percentage and the percentages must total 100%; whether the user may pick one or several answers is inferred from how many options carry a positive grade.
- Multiple Choice, ungraded, shows two controls instead: *Multiple Answers* sets whether the user may pick several options rather than one, and *"Other" Free-Text Option* adds a last option where the user types their own answer.
- True/False, ungraded, has no *Correct Answer* field.
- Match the Following: a right-hand item with no left item is a distractor and is allowed; a left item with no right item blocks saving.
- Linear Scale: the low end is 0 or 1 and the high end 2 to 10.
- Question text EN and a Category (or Sub-Category) are required.

### Acceptance Criteria

- Saving a graded Multiple Choice whose percentages total 90% is blocked.
- Turning grading off on a Multiple Choice reveals *Multiple Answers* and *"Other" Free-Text Option*.
- A question created inside a Quiz appears in the bank under its Category.

## 7.3 Versions

### Important Behaviors

- Saving an edit creates a new version and keeps the previous one as it was (text, options, grades, settings). Attempts and responses stay tied to the version they answered (§14.3.4).
- Version History lists every version with its attempt count; opening one shows that version read-only. Versions cannot be deleted (§14.3.4 allows deleting an unused version; this interface does not).
- Editing a question's text and then opening Version History shows the old text on the previous version and 0 attempts on the new one.

## 7.4 CSV Import

### Important Behaviors

- Columns and allowed values follow §15.3.2; the template downloaded from the first screen matches them. Columns are matched by name, so their order in the file does not matter.
- Three screens: pick a file (with the template download), then either the Errors screen or the Success screen.
- Errors screen: one row per failing row, naming the column to fix and the reason. Nothing imports until every row passes, so its only action is *Re-Upload*. A file that cannot be read at all (wrong header, empty) lands here with that reason in place of the table. After 50 error rows the list stops and a note says to fix the rest in the spreadsheet.
- Rejection reasons: missing or invalid *Type*; missing *Question (EN)*; missing *Category*; *Question (EN)* duplicating an earlier row (the row number is given); a True/False row whose *Correct Answer* is neither True nor False; a Match the Following row with fewer than 2 pairs or a pair missing one side; a Multiple Choice row with fewer than 2 options or no correct option.
- Success screen: what the file adds (question count by type, and which Categories and Sub-Categories will be created), a note when rows have no Spanish text, then *Import N Questions*. Categories named in the file match existing ones regardless of case and take the existing spelling; unknown ones are created.
- Imported questions are Active, graded, and otherwise identical to questions created in the editor (§15.1).

---

# 8 Manage Completions

Prototype Link: Tasks › ⋮ › Manage User Progress (also Certifications › ⋮ › Manage User Progress and Users › ⋮ › Manage Training Progress)

### Overview

One page for one user at a time, paired with one Certification or one Task. Every entry point pre-selects one half of that pair (the Task, the Certification, or the user); the other half is picked on the page.

### Important Behaviors

- User + Certification shows a Progress Card for the Certification (its completion state, with *Mark as Complete* / *Mark as Incomplete*) and a table of the Certification's Tasks with the user's progress on each: status, grade, attempts and time, with a flag on any completion a SkillCat Admin set by hand.
- User + Task shows a Progress Card for that Task (status, grade, attempts and time) with *Mark as Complete* / *Mark as Incomplete*, *View All Attempts* and, on a Quiz with limited attempts, *Grant Additional Attempts*.
- Changes are held until *Review & Save*: the footer counts them, its Hover Card lists them and can drop any one, and *Review & Save* lists every change for confirmation before applying them together. Held changes stay listed when the SkillCat Admin switches to another Certification or Task.
- *Mark as Complete* on a Task asks for a grade when the Task is a Quiz (one grade per Section on a Section-level Quiz), a Hands-On Task with *Passing Grade from Reviewer*, or an xAPI Task with *Score Capture* on. The grade is optional; left blank, the user's existing best grade is kept.
- Marking the Certification complete or incomplete acts on the Certification alone: complete says nothing about its Tasks, and incomplete leaves its Tasks as they are. A Certification marked incomplete stays incomplete until the user meets its criteria again after the override, even though its Tasks are already complete.
- A Quiz whose attempts are all used without a pass is shown blocked (*Attempts Exhausted*); *Grant Additional Attempts* clears it. The action is offered only on Quizzes with limited attempts and opens the same flow as 1.8 Who Paid (Quiz) and Additional Attempts.
- *View All Attempts* opens the Quiz Attempts page or the Hands-On Task Submissions page in a new tab, filtered to the user and the Task.

### Acceptance Criteria

- Marking a Quiz complete with the grade left blank keeps the user's previous best grade.
- Marking an earned Certification incomplete shows it incomplete afterwards, with its Tasks still complete and the Award still on the profile.
- A change held on Certification A is still listed in the footer after switching to Certification B.

---

# 9 Companies

Prototype Link: [Companies](https://e5hwar.github.io/moodle-escape-plan/companies)

## 9.1 Companies List

### Overview

Every company with its Status and Plan. Follows 0.1 to 0.3. There is no Preview Panel. Fixed column: Company.

### Statuses

Every company has exactly one Status. The table below explains each; the Status decides which columns have values, which actions are offered (9.2) and which plans can be chosen (9.4).

| Status | What it means |
|---|---|
| Active | Paid Subscription with no unpaid invoice. |
| Pending Payment Setup | Created on Automatic-Payment; the Account Holder has not yet completed checkout. Nothing charged. Stays in this Status indefinitely until checkout completes, then becomes Active. |
| Past Due | The latest invoice is unpaid past its due date. Becomes Active when paid; becomes Inactive when the grace period ends. |
| Cancelled | Cancellation requested. Before the effective date the Status reads *Cancels* with the date (Example: *Cancels · 31 Oct 2026*) and the company keeps full access. On and after it, Cancelled. |
| Free Trial | A Free Trial with no payment method. Its length comes from Product Config. |
| Trial Expired | A Free Trial that ended without converting. |
| Free Access | Complimentary Access up to an end date, with the features defined in the B2B Spec (§22.2). |
| Free Access Ended | Free Access whose end date has passed. |

Billed Statuses are Active, Pending Payment Setup, Past Due and Cancelled. Only these have a *Tier*, *Seats*, *Seat Changes*, *Billing Cycle*, *Payment Method* and *Price*. For every other Status, those columns are empty.

### Important Behaviors

- *Seat Changes*: net seats added minus removed inside the selected Date Range. No movement shows empty. Seat Changes is the only thing the Date Range affects; it never filters rows.
- *Last Access*: the last time any Admin or Manager at the company opened the Company Dashboard.
- *Cancelled On*: the date a cancellation took effect; empty while still scheduled. *Trial End Date*: Free Trial companies only.
- The count above the table is the total number of companies and the number Past Due across the whole platform. It does not change as filters or search narrow the table. The Past Due count is hidden at zero.
- *Trade*, *Partnership*, *Assigned CSM* and *Sales Rep* Filter Pills add a *None* value for companies with no value.
- Default state: no search or filters, Date Range at Last 30 Days, sorted by Last Access with the most recent first and never-accessed companies last. Companies created this session are pinned at the top, newest first, whatever the sort; search and filters still apply to them.
- *View User's Company* on the Users page opens this list already searched to that company.
- Search text matches the Company Name only.
- *Trade* and *Partnership* filters match a company that has any of the picked values.
- *Status* matches the Status as it stands today: a Free Access company past its end date matches Free Access Ended, not Free Access. *Cancelled* includes scheduled cancellations.
- *Tier* sorts by level (Essentials, Growth, Professional). *Trade*, *Partnership*, *Sales Rep* and *CSM* sort alphabetically.
- Hovering a Status: Past Due shows days past due and the date the company loses access; Cancelled or Cancels shows the cancellation reasons, if any.
- The row quick action is *View Company Dashboard*; Pending Payment Setup rows have none. The row menu depends on Status (9.2).
- A value removed from a Product Config list disappears from every company, filter and picker at once (13 Product Config).

### Acceptance Criteria

- The totals above the table stay the same when search or filters are applied.
- Opening from the sidebar sorts by most recent Last Access with never-accessed companies last, and a company created this session sits at the top.
- Picking a Tier, Billing Cycle or Payment Method value never shows a Free Trial or Free Access company. Picking *None* in Trade shows only companies with no Trade.
- Changing the Date Range changes Seat Changes values and never the number of rows; Clear Filters leaves the Date Range as it was.
- Tier, Seats, Seat Changes, Billing Cycle, Payment Method and Price are empty for every non-billed Status; Cancelled On is empty for a cancellation that has not taken effect.

## 9.2 Company Actions

### Overview

The row menu changes by Status; unavailable actions are absent, not disabled (0.4 Row Menus and Unavailable Actions, Shared Patterns).

### Important Behaviors

| Action | Shown for |
|---|---|
| Edit Company Details | Every Status |
| Copy Stripe Checkout Link | Pending Payment Setup only |
| Delete Company | Pending Payment Setup only |
| Manage Subscription | Every Status except Pending Payment Setup and a scheduled cancellation (*Cancels*) |
| Change Account Holder | Every Status except Pending Payment Setup |
| Manage Billing Emails | Active and Past Due only |
| View Invoices | Any company that has ever had a Subscription, whatever its Status today |
| View All Employees | Every Status except Pending Payment Setup |
| View Company Dashboard | Every Status except Pending Payment Setup |
| Cancel Subscription | Active and Past Due only |

- *Edit Company Details* opens the Company Details fields of 9.3. Nothing else about the company changes.
- *Change Account Holder* has two outcomes. *Change the Account Holder* moves ownership to another employee, and the current Account Holder stays in the company as an Admin. *Remove from Company & Replace* moves ownership and removes the old Account Holder from the company.
  - The new Account Holder must already be an active employee of the company; Admins and Managers are marked with their role, and someone not yet in the company has to be added first. When the company has no other active employee, the Change Account Holder modal shows a message saying so instead of the employee list.
  - The newly set Account Holder becomes the billing email on Stripe (the Stripe Customer is updated).
- *Manage Billing Emails* and *View Invoices* both open the respective page on Stripe in a new tab.
  - Sample link (billing emails):
  - Sample link (invoices):
- *View All Employees* opens the Users page filtered to the company.
- *View Company Dashboard* opens the Company Dashboard in a new tab as the Account Holder sees it (0.13 Login As, Shared Patterns). Company/Tenant-Created content is edited only this way.
- *Copy Stripe Checkout Link* copies the company's current Stripe Checkout Link. If the earlier link has expired, a new one is generated and that is what gets copied. The company stays Pending Payment Setup for as long as it takes.
- *Delete Company* is only for a company that was created as Pending Payment Setup and still has no employees beyond the invited Account Holder. A company that reached Pending Payment Setup by converting from another plan never gets Delete. Deleting permanently removes the company and the Account Holder's invitation; the shared Stripe Checkout Link stops working.
- *Cancel Subscription*:
  - The dialog explains the consequence: the company keeps full access to the end of the current billing cycle and is not billed after it. Active and Past Due companies get the same dialog.
  - *Cancellation Reason* is optional; more than one may be picked, from the Product Config list. With none picked, nothing shows on the Status hover.
  - *Outstanding Balance* appears only when the company owes something: any unpaid invoice plus prorated charges for seats added this cycle. Seats removed during the cycle give no credit. Cancelling ends the subscription, not the debt: the balance is billed at the end of the period. (This is handled by Stripe when the subscription is cancelled.)
  - After confirming, the Status reads *Cancels* with the date, the reasons show on hover, and *Cancel Subscription*, *Manage Billing Emails* and *Manage Subscription* leave the menu. On the effective date the Status becomes Cancelled and *Cancelled On* fills in.

### Acceptance Criteria

- Change Account Holder never offers a deactivated employee or anyone outside the company.
- With *Change the Account Holder*, the old Account Holder is still in the company as an Admin. With *Remove from Company & Replace*, the old Account Holder is removed from the company.
- Copying the Stripe Checkout Link after it has expired yields a new link that works; the company is still Pending Payment Setup.
- Cancelling an Active company sets *Cancels* with the next cycle-end date and the company keeps access until then; backing out of the second confirmation leaves the subscription unchanged.
- Cancelling a Past Due company that added seats this cycle shows an Outstanding Balance equal to the unpaid invoice plus the prorated seat charges.
- A Free Access company that subscribed in the past still has View Invoices; one granted Free Access from the start does not.

## 9.3 Create Company

### Overview

Follows 0.8 Create/Edit Pages, Shared Patterns. Nothing is saved until the SkillCat Admin confirms on the Review Page.

### Important Behaviors

#### Company Details

- Required: *Company Name*, *Country*, and a postal code in the country's format unless the country has none. A complete postal code for a supported country fills in state and city; both stay editable. The state list follows the country (US and Canada; free text elsewhere).
- *Assigned Sales Rep* defaults to the SkillCat Admin creating the company. *CSM* starts unassigned.

#### Admin Account

- Required: the Account Holder's name and email. The Account Holder's email becomes the billing email in Stripe and the company's first Admin account (§22.7).

#### Plan

- Defaults: Subscription, on Growth, Monthly, USD, the default price from Product Config for that combination, 1 seat, Automatic-Payment.
- *Per-Seat Price* is picked from the Product Prices on Stripe for the selected cycle (Monthly or Annual) with a rate in the selected currency; it is required for a Subscription. Changing tier, cycle or currency resets it to the default price from Product Config. If that default is not available in the selected currency, the field is left blank.
- *Seats*: at least 1 for a Subscription.
- Free Access needs an *Access End Date* in the future.
- Preview: for a Subscription, the prorated charge today (fetched from Stripe) for the rest of the current month, then the full charge from the next 1st onward.
- *Create New Price* creates a price in the Stripe catalogue, available to every company afterwards (§22.3). The SkillCat Admin picks the cycle and enters a rate for one or more currencies; the currency list comes from Stripe and offers USD, CAD and, when the company is on another currency, that one too. Rates are never automatically converted between currencies. At least one currency needs a rate above 0, two decimals at most. Name is optional and internal only. A new price is selected as soon as it is created; if it was created on the other cycle, the form switches to that cycle.

#### Review Page and finish

- Creating an Automatic-Payment Subscription sets the Status to Pending Payment Setup and shows a confirmation page with the Stripe Checkout Link, already copied. The subscription and the Company Dashboard turn on when checkout completes.
- Creating a Manual-Invoicing Subscription sets the Status to Active straight away; invoices go to the Account Holder.
- Creating a Free Trial sets the Status to Free Trial. Creating Free Access sets the Status to Free Access.
- *Sign-Up Method* is Internal.

### Edge Cases

- Picking a currency with no default price leaves the Per-Seat Price empty until a price is picked or created.
- If the clipboard copy is blocked, the Stripe Checkout Link is still shown and can be copied by hand.
- If creation fails, the SkillCat Admin stays on the Review Page with entries kept and an error explaining the company was not created.

### Acceptance Criteria

- Switching tier from Growth to Professional resets the Per-Seat Price to the Professional default for the selected cycle and currency.
- A price created on Annual while Monthly is selected switches the form to Annual with the new price selected.
- Creating an Automatic-Payment Subscription shows the Stripe Checkout Link page and the company is Pending Payment Setup with no subscription yet. Creating a Manual-Invoicing Subscription yields an Active company immediately.
- Creating a Free Trial yields a trial ending the configured number of days (from Product Config) from today; changing the configured length afterwards does not move it.
- Creating Free Access yields a company that becomes Free Access Ended the day after its end date, with no manual step.

## 9.4 Manage Subscription

### Overview

Same fields as the Plan step of 9.3, plus a preview of what changes and what is charged.

### Important Behaviors

- Which plans can be chosen, by current Status:

| Current Status | Subscription | Free Trial | Free Access |
|---|---|---|---|
| Free Trial | Yes | — | Yes |
| Trial Expired | Yes | No | Yes |
| Free Access, Free Access Ended | Yes | No | Yes |
| Active, Past Due | Yes | No | No: the subscription must be cancelled first (§22.2) |
| Cancelled, in effect | Yes | No | Yes |

- A Free Trial is only available to a company that has never had a Subscription or Free Access. A company that has had either cannot be put on a Free Trial.
- *Seats* are read-only for a company already on a Subscription; they are added and removed from the Company's Dashboard. A company converting from a Free Trial or Free Access sets its seats here.
- *Currency* is read-only after creation (a Stripe limitation).
- *Payment Method*: Automatic-Payment can be switched to Manual-Invoicing here, effective immediately. A Manual-Invoicing subscription cannot be switched to Automatic-Payment here; the company does that from its Dashboard (§22.7).
- The preview shows every plan field, changed fields with old and new values, and the recurring total, and states whether the change applies today or at the end of the cycle and what is charged today (§22.6).
- Converting a Free Trial or Free Access company to an Automatic-Payment Subscription sets the Status to Pending Payment Setup and hands over a Stripe Checkout Link, as in 9.3. Converting to a Manual-Invoicing Subscription sets the Status to Active immediately.
- Saving on a company whose cancellation has taken effect reactivates it. With Automatic-Payment it goes through Pending Payment Setup and a fresh Stripe Checkout Link; with Manual-Invoicing it goes straight to Active; Free Access is also available.
- Saving opens a confirmation listing only the fields that change, old and new, with one line underneath: the amount charged immediately and the proration it comes from, or a plain statement that nothing is charged today.
- A Past Due company stays Past Due after a plan change.

### Acceptance Criteria

- An Active company cannot choose Free Trial or Free Access; a Trial Expired company can choose Subscription or Free Access, not Free Trial.
- Seats are read-only for an Active, Past Due or Cancelled company and editable for a Free Access company converting to a Subscription.
- A Manual-Invoicing subscription cannot be switched to Automatic-Payment; an Automatic-Payment one can be switched to Manual-Invoicing with nothing charged.
- Upgrading Growth to Professional on a monthly plan charges today the increase prorated for the share of the month left; downgrading charges nothing today and takes effect at the end of the cycle.
- Converting a Free Trial to an Automatic-Payment Subscription yields Pending Payment Setup and a Stripe Checkout Link, not an Active company; reactivating an ended Cancelled company with Automatic-Payment does the same.
- Saving a Past Due company leaves it Past Due.

---

# 10 Exam Reviews

Prototype Link: [Exam Reviews](https://e5hwar.github.io/moodle-escape-plan/proctoring-review)

## 10.1 Queue

### Overview

Follows 0.10 Review Consoles, Shared Patterns. No Edit Columns: every column is fixed.

### Important Behaviors

- Default state: No filters, *Submission Date* at All Time, sorted oldest first.
- The *Quiz* Filter Pill lists every Quiz that has Proctoring on, or has the ID Upload Task as an Access Restriction in any Certification. The list comes from those Task and Certification settings; there is no separate list of exams to maintain.
- Review Run Cards (0.10 Review Consoles, Shared Patterns): The suggested set is All, then one card per Review Type (Proctored Exams, ID Reviews, ID Re-Uploads).
- When a user re-uploads their ID, their submission returns to the Exam Reviews queue as an ID Re-Upload row, whether it started as a Proctored Exam or an ID Review.
- Taking an action moves the row out of the queue. Approving an attempt marks the user's ID as verified. The user's other pending rows then show the ID as verified too. Requesting an ID Re-Upload removes that verified marking from the user's other pending rows.

### Acceptance Criteria

- Turning Proctoring on for a Quiz adds it to the *Quiz* filter; adding the ID Upload Task as an Access Restriction to a Quiz in a Certification does the same.
- Requesting an ID Re-Upload removes the row from this table and adds it to Pending ID Re-Uploads.

## 10.2 Review Console

### Important Behaviors

- The Name Mismatch Card appears when the account name and the name read from the ID differ. A correction typed in the card is saved on *Approve* only. Renaming the user from the Hover Card (shown when hovering the user's name) updates the profile name immediately; if the new name matches the name read from the ID, the Name Mismatch Card goes away.
- The Past-Rejections Card (headed *Caught Cheating in Past Quizzes*, with the Integrity Note as its subtext and a link to that Quiz's rejected attempts) shows only when the user has a past rejection.
- *Reject* (Proctored Exams only) asks for one or more reasons, lets the reviewer tick frames as evidence, and takes an internal Integrity Note. The reasons and the ticked images are stored with the rejection and shown to the user on their rejection page; the attempt stays Rejected and the user does not regain it (§17.3.5).
- Keyboard: A approves, R rejects, I requests an ID Re-Upload, N skips. Esc closes the topmost overlay only; in the full-screen frame viewer it closes only the viewer.
- The footer follows the Hands-On Review Console: Back on the left; Skip to Next and the action buttons on the right.
- A user can have two rows open at once (Example: An EPA 608 Universal Proctored Exam and an EPA 609 ID Review). Approving or rejecting one row changes only that row; the other stays in the queue.

### Acceptance Criteria

- An ID Review shows no Reject and the R key does nothing on it.
- Approving a Proctored Exam whose name was corrected in the Name Mismatch Card saves the new name; skipping does not.

## 10.3 Pending ID Re-Uploads

Prototype Link: [Pending ID Re-Uploads](https://e5hwar.github.io/moodle-escape-plan/pending-id-reuploads)

### Important Behaviors

- Lists rows awaiting a new ID from the user, sorted by request date oldest first.
- Opening a row opens the Review Console on this page's queue: Skip to Next steps through these rows with no pending count, and Back and every action return here. *Approve* remains available on these rows.
- When the user uploads a new ID, the row leaves this page and returns to the Exam Reviews queue as an ID Re-Upload row.

---

# 11 Spotlight

Prototype Link: [Spotlight](https://e5hwar.github.io/moodle-escape-plan/spotlight)

### Overview

Follows 0.1 to 0.5. Fixed column: Title.

### Important Behaviors

- The sidebar badge counts In-Review Spotlights.
- *Status*:
  - *In-Review*: Created or Re-Enabled and not yet approved.
  - *Active*: Approved and live through its end date.
  - *Ended*: Past its end date, or disabled. An In-Review Spotlight whose end date passes becomes Ended; it must be Re-Enabled with a new end date before it can be approved.
  - *Rejected*: Rejected by an Approver.
- Only Active rows carry a queue position number; In-Review rows sit in the order unnumbered. The Show Past Spotlights section lists Ended and Rejected ones.
- *Heading* is limited to 20 characters and *Description* to 60, so they fit the Home block.
- On the Details step of the Create/Edit page, the *Button Destination* can be any URL or a Deep Link picked from the Find a Deep Link modal, which lists live Certifications by their slug and the app's system pages. The destination is not validated; its *Test It Out* link follows 0.11 Field Rules, Shared Patterns.
- The *End Date* must be today or later, and at most six months after the Spotlight's creation date. Editing does not extend that cap.
- The Approve confirm states the position the Spotlight will take among the Active ones.
- *Enable* on an Ended or Rejected Spotlight reopens the Create/Edit page, requires a new end date and a queue position, and resets the six-month cap from today.
- *Disable* ends the Spotlight today.
- Dragging rows holds a new order until *Save*; *Discard* drops it. Submitting the Create/Edit page while a reorder is unsaved does not save the reorder.

### Acceptance Criteria

- A Spotlight whose end date is today still shows Active; tomorrow it is Ended.
- An In-Review Spotlight past its end date shows Ended and has no Approve until it is Re-Enabled.
- Active rows are numbered 1 to n with no gaps; approving a new one at position 2 shifts the old 2 to 3.
- Editing an Active Spotlight cannot push its end date beyond six months from its creation date.

---

# 12 Users

Prototype Link: [Users](https://e5hwar.github.io/moodle-escape-plan/users)

## 12.1 Users List

### Overview

Follows 0.1 to 0.5. Fixed column: Name. Clicking a row opens the Preview Panel with the Full Profile's cards, read-only.

### Important Behaviors

- *Subscription* Status pill on the Users List:
  - *Starter*: No pill; the cell shows a dash. The *Subscription* filter value for these users is *None*.
  - *Free Trial Ends <date>*: A B2C user on the Free Trial.
  - *Subscriber*: With the billing cycle and platform (Example: *Monthly · Stripe*).
  - *Cancels <date>*: A Subscriber who cancelled; access runs to that date. The filter value is *Cancelled*.
  - *Scholarship*: A B2C user on a Scholarship. It reads *Scholarship Ends <date>* only when the end date is within the next 7 days. The filter value is *Scholarship* either way.
  - *Company Plan*: Every employee of a B2B company.
- Row hover shortcuts: *View Profile* (opens in a new tab) and *Login As*, plus the ⋮ menu. B2B users' menus add *View User's Company* and *View All Company Employees*.
- *Cancel Subscription* is a red item in the row menu, offered to any user with a B2C Subscription who is not already cancelling, company employees included. For a Subscription billed on Apple it stays in the menu disabled, since Apple Subscriptions are cancelled by the user in the App Store. Free Trial, Scholarship, Starter and Company-Plan-only users never see it.
- Cancelling keeps the user's access until the renewal date and shows the same *Cancels <date>* on the Users List and on Full Profile. *Cancel Subscription* is not offered again afterwards.
- *Edit User Details* (a modal) saves name and contact details. It never closes a pending name change request. Name changes made anywhere propagate to every screen, to issued Awards and the public portfolio.

### Acceptance Criteria

- Every company employee shows the *Company Plan* pill; one who also holds a B2C Subscription is offered *Cancel Subscription* like any other Subscriber.
- Cancelling a Stripe Subscriber shows *Cancels <date>* on the Users List and on Full Profile, with *Cancel Subscription* gone from both.
- A user renamed from Edit User Details shows the new name on their profile, on Name Change Requests and on the ID record.

## 12.2 Full Profile

Prototype Link: Users › ⋮ › View Profile (opens in a new tab)

### Important Behaviors

- The header menu reads *Upload ID* while the user has not uploaded an ID to the ID Upload Task, and *View ID* once one exists. *Cancel Subscription* sits in the same menu, under the 12.1 rule.
- *Upload ID* opens the Upload ID modal: a drop zone (PNG, JPG, HEIC or HEIF, up to 100 MB), then the preview with *Upload Without Approval* or *Upload & Approve*.
- The Subscription card shows the Status as plain text, the Currency and the dates; Starter reads *No Subscription*. Company Plan users have no *Billed To* line.
- The ID modal shows the document, the user's profile name, the ID status and a timeline of uploads and decisions. *Approve* is available on an In Review ID and on a Re-Upload Requested ID, which still shows its document. When replacing an In Review or Re-Upload Requested ID, the choices are *Upload Without Approval* or *Upload & Approve*. When replacing an Approved ID, the only choice is *Upload & Approve*: the ID Upload Task stays Completed, so no Certification whose criteria include it falls back to incomplete.
- Purchases & Bills lists Subscription renewals, Certifications, Quiz attempts and Physical Products, with a *Purchase Type* filter. A purchase bought by the user's company carries a *Company Paid* flag beside its name. A refunded purchase stays in the table, greyed, with a *Refunded* pill.
  - Each row's ⋮ holds *Refund* only, and it stays after a refund. *Refund* opens the purchase's record on Stripe or Google in a new tab; for a purchase made on Apple it is disabled, since the user must request the refund from the App Store. Physical Products always offer *Refund*.
  - With no purchases at all, the table is replaced by a plain line and the filter is hidden. A filter that matches nothing keeps the table with *No Results Found*. Awards use the same empty-state rule.
- EPA Card Orders is a table of every order: Certification (with the *Company Paid* flag where the company bought it), Shipping Address, Status as plain text, Ordered On and a ⋮. Statuses are those defined in §26.1.8: Order Received, Accepted, Action Needed, In Production, Shipped, Delivered and Cancelled. Cancelled rows are greyed and have no ⋮.
  - *Cancel Order* is a red item offered while the order is Order Received, Accepted or Action Needed. From In Production onward it stays in the menu disabled, since printing has started.
  - Cancelling confirms twice. The confirmation says that cancelling does not refund the user and that the refund is done from Purchases & Bills; a Toast follows. Every order, cancelled or not, has its Physical Products purchase there.

### Acceptance Criteria

- A user with no ID shows *Upload ID*; after a SkillCat Admin uploads one it appears as In Review and the item reads *View ID*.
- Replacing an Approved ID offers only *Upload & Approve* and leaves dependent Certifications complete.
- Marking a Certification incomplete on Manage Completions leaves the Award in this profile.
- Refunding a purchase greys its row with the *Refunded* pill and keeps *Refund* in its menu.
- Cancelling an EPA card order greys the row, removes its ⋮, and leaves its purchase refundable from Purchases & Bills.

## 12.3 Name Change Requests

Prototype Link: [Name Change Requests](https://e5hwar.github.io/moodle-escape-plan/name-change-requests)

### Important Behaviors

- A banner headed *Name Changes Pending Review* on the Users List, a title note of the same wording and the sidebar badge all count pending requests. On the Users List, N opens this page and is disabled when none is pending; S opens Scholarships.
- The queue opens on the oldest pending request.
- The review modal's subtitle reads *Current Name: <name>*; hovering the name shows the Hover Card with the user's details and a link to the profile. The requested name sits beside the user's stored ID so the SkillCat Admin can compare the two.
- Under *Requested Name*, a line reads *ID reads <Name found on ID> · Use This*. *Use This* fills the field with the name found on the ID; the change still waits for *Approve*.
- Actions: *Approve*, *Reject*, *Request ID Proof* and *Skip*.
  - *Request ID Proof* sets the request as *Awaiting ID Proof*, shown with a grey flag and filterable by *Status*. A new ID upload from the user returns it to pending.
  - Shortcuts: I, R and A. While the full-screen ID viewer is open, R rotates the image instead.
- The banner, title note and badge count pending requests only.

### Acceptance Criteria

- Approving a Name Change Request changes the user's name on the Users List, Full Profile and the request list.
- *Use This* fills the Requested Name with the name found on the ID and changes nothing until Approve.
- Request ID Proof moves the request out of the pending count and marks it *Awaiting ID Proof*; a new ID upload brings it back as pending.

## 12.4 Scholarships

Prototype Link: [Scholarships](https://e5hwar.github.io/moodle-escape-plan/scholarship)

### Important Behaviors

- Available for B2C Users only. The Select Users modal excludes Subscribers and users with an active Scholarship. A Scholarship has an expiry date set by the SkillCat Admin.
- A Scholarship is *Active* or *Ended*. An active Scholarship shows the *Scholarship* Status pill on the Users List (12.1); when it ends, the user returns to Starter and the cell shows a dash.
- *Revoke* sets the expiry to today, so a revoked Scholarship is simply Ended. An Ended Scholarship is restored by *Edit* with a new date, unless the user has meanwhile become a Subscriber.

### Acceptance Criteria

- Creating a Scholarship shows the *Scholarship* Status pill on the Users List; revoking turns the cell to a dash at once.
- Re-dating an Ended Scholarship restores it; doing so for a user who is now a Subscriber is refused.

## 12.5 Merge Accounts

Prototype Link: [Merge Accounts](https://e5hwar.github.io/moodle-escape-plan/merge-accounts)

### Important Behaviors

- The Select Users modal picks both accounts in one pass: the first tick is the Kept Account and the second the Account removed when merging. *Swap Roles* on the Accounts step (shortcut S) reverses them at any time before confirming.
- An Account part of a B2B Company must be the Kept Account; picking it as the Account removed when merging is refused with a prompt to swap.
- All learning data moves to the Kept Account: completions, attempts, submissions, Skills, Awards and Path entries (§24.1). Every purchase from both accounts is kept, so if both accounts bought the same Certification or attempt, both purchases stay. Permanent entitlements from both accounts are kept.
- B2C Plans: If only one account has a B2C Plan, it carries to the Kept Account and the Review step shows it. If both have an active renewing B2C Plan, the merge is blocked until one is cancelled; a plan whose cancellation is already scheduled does not block. A Kept Account on a Scholarship merged with a Subscriber ends the Scholarship and takes the plan (shown struck through on the Review step).
- The Conflicts step is a placeholder for data that cannot be merged automatically; the two conflicts the prototype shows are examples, not a product rule.
- Confirming merges permanently: The Account removed when merging disappears from the Users List and its open name change requests are closed.

### Acceptance Criteria

- Picking an Account part of a B2B Company as the Account removed when merging is refused with a prompt to swap.
- Two accounts each with a renewing Stripe plan cannot be merged; cancelling one first allows it.
- After merging, the Kept Account lists both accounts' purchases in full.

## 12.6 Transfer Subscription

Prototype Link: [Transfer Subscription](https://e5hwar.github.io/moodle-escape-plan/transfer-subscription)

### Important Behaviors

- Available for B2C Users only: the Select Users modal lists B2C accounts alone, with no User Type or Role filter and no Role column, and its subtext says so.
- Moves a B2C Plan (Apple, Google or Stripe) or a Scholarship from the Source Account (the account the subscription is transferred out of) to the Destination Account.
- The transfer is blocked while both accounts have an active renewing B2C Plan; a plan whose cancellation is already scheduled does not block, as on Merge.
- After the transfer, the Source Account returns to Starter. Both accounts update at once.

### Acceptance Criteria

- Two accounts each with a renewing plan cannot be transferred between; cancelling the Destination Account's plan first allows it.
- The Select Users modal on this page never lists a B2B account.

---

# 13 Product Config

Prototype Link: [Product Config](https://e5hwar.github.io/moodle-escape-plan/product-config)

### Overview

Platform-wide settings in tabs (General Settings, Display Settings, Award Templates, B2C Management, B2B Management, Legal). Changes on every tab go through one Changes Footer (0.7 Save Changes and Unsaved Changes, Shared Patterns), each change named by its tab and field.

### Important Behaviors

- General Settings:
  - *Force App Update* keeps a log of versions with the Active one. *Force New Version* needs a version higher than the Active one and not already in the log. Only the Active version can be removed; removing it makes the previous version Active again, and the confirmation names that version (or says no version will be forced).
  - *Webcam Capture Frequency* (seconds) applies to Proctored Quiz attempts started after the change.
  - *App Deep Links* lists the system pages that can be linked to; the list is read-only here.
- Display Settings:
  - App Tabs and Dashboard Tabs can be edited. *Tab Name* EN, *URL* and *Icon* are required; the tab name in Spanish is optional.
  - Every Support Page needs a URL.
- Award Templates: *Used By* reads the number of Awards using the template. *Delete* is disabled while any Award uses the template. Templates save on their own, not through the Changes Footer.
- B2C Management: Every Paywall Price ID and the EPA Card Product ID are required. For the EPA Card, the default price of that Stripe Product is used at checkout. *Free Trial Duration* changes apply to Free Trials that start afterwards.
- B2B Management:
  - Every per-seat Price ID and the EPA Card Product ID are required (B2B and B2C have separate Stripe accounts, so the EPA Card has a different Product ID on each). The per-seat default rates set here are what the Plan step of Create Company starts on (9.3 Create Company, Companies).
  - *Partnerships*, *Trade* and *Cancellation Reasons* are lists. Adding a value offers it in every picker and filter at once. Removing a value shows how many companies, Tasks and Certifications carry it and confirms twice; on confirm it is removed from every company, Task and Certification that carried it, and from every filter and dropdown.
- Legal: *Terms of Service* and *Privacy Policy* are rich text, in EN and ES. EN is required; ES is optional.
- *Webcam Capture Frequency*, both *Free Trial Duration* fields and *Initial Tasks Count* take whole numbers of at least 1. Any required field left blank keeps *Review & Save* disabled, and hovering it names the field.

### Acceptance Criteria

- Adding a Partnership here offers it on the Company Create/Edit page, the Certification Create/Edit page's Audience step and the Companies filter without a reload; removing it clears it from every company that had it.
- Changing the B2B Free Trial Duration changes the end date of Free Trials created afterwards and not of existing ones.
- Forcing a version lower than the Active one, or one already in the log, is refused. Only the Active version offers Remove.
- A template used by an Award has *Delete* disabled.
- Dropping one change from the Changes Footer's Hover Card leaves the other changes held.

---
