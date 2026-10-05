17. Exam Reviews (Proctoring Dashboard)

17.2 User Interface and User Flow

This section describes how the Exam Reviews screens behave. The rules for when an entry is created, what each decision records and how long the Proctoring Report is kept are defined in 17.3 Backend and are not repeated here. Everything that can be seen in the prototype (layout, labels, columns) is the spec. The points below are the ones that cannot be seen by clicking around.

The page is called "Exam Reviews" in the UI. The backend section still calls it the Proctoring Dashboard. They are the same thing.

UI Screens Required -
	1. Exam Reviews (list of entries waiting for review, with Review Runs)
	2. Review Console (one entry at a time, with Approve / Reject / Request ID Re-Upload)
	3. Pending ID Re-Uploads (users who were asked for a new ID and haven't sent one yet)


17.2.1 Exam Reviews (List)

What Is Listed -
	* Only entries that are waiting for a decision (In-Review as defined in 17.3.2).
	* Entries in the ID Reupload Requested state are not listed here. They are on the Pending ID Re-Uploads screen until the user sends a new ID.
	* Once the user sends a new ID, the entry comes back to this list with a "New ID" flag next to the name. Hovering the flag shows "Re-Uploaded on <date>".
	* Approved and rejected entries never appear here.

Review Type -
Every entry is one of three types. The type decides what the reviewer sees in the console.
	1. Proctored Exams - ID and webcam footage are reviewed together (17.3.3.1).
	2. ID Reviews - Only the ID is reviewed (17.3.3.2).
	3. ID Re-Uploads - An entry that was sent back for a new ID and the user has now re-uploaded. Whether footage is shown depends on the exam, not on the type: a re-upload for a Proctored Exam still shows the footage.

Header -
	* One button: "Pending ID Re-Uploads". It has no count on it.
	* The sidebar shows the number of entries waiting for review, capped at 99+.

Review Runs -
A Review Run is a saved filter that opens the console on the oldest entry matching it, so the reviewer can work through a set of entries in order without going back to the table.
	* The strip only shows when there is at least one entry waiting.
	* A run is one of: All Reviews, a set of Review Types, or a set of Quizzes.
	* Suggested runs are shown in a fixed order: All Reviews, Proctored Exams, ID Reviews, ID Re-Uploads. A suggestion is dropped if it has no entries waiting or if the same run is already in Recents.
	* Recent runs are shown first, newest first, up to 5. The strip shows at most 7 cards in total, so with 5 Recents only 2 Suggestions fit.
	* A run is added to Recents when its card is clicked, and also when the reviewer opens any row from the table. In that case the run is built from the current Quiz filter (if any), else the Review Type filter (if any), else All Reviews. The date filter and search text are ignored.
	* A Recent with nothing waiting is hidden and frees its slot.
	* Recents are kept for the browser session only.
	* The number on a card is the number of entries waiting in that run. It ignores the page's current filters, date and search. Over 99 shows "99+".
	* A run with more than one value shows the first value and "+N". Hovering shows the full list.
	* Clicking a card: the filters are set to exactly that run, Submission Date goes to All Time, search is cleared, sort goes to Submitted On (oldest first), and the console opens on the oldest entry in the run. If the run has no entries, nothing happens.
	* The mouse wheel scrolls the strip sideways. At either end the wheel scrolls the page instead.

Search -
	* Search runs when the user presses Enter or clicks the "Search for … in Submissions" row. It does not filter as the user types.
	* Matches a substring of the user's name, email, phone or the Quiz name.
	* Typing "Quiz:" (any case) switches the panel to a list of Quizzes (up to 6, each with its number of entries waiting). Picking one adds it as a chip in the bar. Pressing Enter after that commits the chips to the Quiz filter together with any text.
	* Esc or clicking outside the bar reverts: the text goes back to the last committed search and any un-committed chips are dropped.
	* Backspace on an empty box removes the last chip.
	* The ✕ clears the text and the committed search. It does not clear the Quiz filter.
	* ⌘K focuses the search bar.

Filters -
	* Review Type (Proctored Exams, ID Reviews, ID Re-Uploads). Nothing selected means all.
	* Quiz, searchable. Only Quizzes with at least one entry waiting are listed, A to Z.
	* Submission Date defaults to All Time, not Last 30 Days, so the oldest backlog is never hidden by default. The end date is inclusive.
	* Clear Filters shows when any Review Type or Quiz is picked or the date is not All Time. It resets those three. It does not clear the search.

Table -
	* Columns are fixed. There is no Edit Columns.
	* Default sort is Submitted On, oldest first. This is the same order the console moves through.
	* Clicking the sorted column flips the direction. Clicking another column sorts it ascending.
	* Clicking the text in the Email or Phone cell copies it ("Copied" shows for 3 seconds). Clicking the blank part of the cell opens the row.
	* Clicking the row, the chevron, or the "Review Exam" hover button opens the console on that entry. The current filters and sort become the console's queue.
	* 50 rows per page. Any change to search, filters or sort goes back to page 1.
	* Empty table: with a search, "No submissions match "<text>"." Otherwise "No submissions match these filters."


17.2.2 Review Console

How the Console Works -
	* The console shows one entry. The queue behind it is the table's filtered and sorted list, across all pages.
	* The reviewer moves through the queue with Skip or the ← → keys. Skip moves to the next entry without deciding the current one. There is no Previous button; ← does that.
	* After a decision, the console moves to the next entry in the queue. If there is no next, it moves to the previous one. If there is neither, the console closes and the table is shown. There is no toast.
	* A decided entry leaves the queue, because the table only lists entries waiting for a decision.
	* Everything in the console resets when the entry changes, except the Flagged Images filter which is kept.

Breadcrumb -
	* "Exam Reviews" closes the console and shows the table.
	* If the console was opened from Pending ID Re-Uploads, the breadcrumb is "Exam Reviews › Pending ID Re-Uploads". "Pending ID Re-Uploads" and Esc go back to that page. This only holds until the reviewer moves to another entry, makes a decision or starts a run; after that the console belongs to the Exam Reviews table again.

Header -
	* Clicking the user's name opens their profile in a new tab. Hovering shows the user details card. The pencil on the card renames the user straight away (this does not need an Approve).
	* The Quiz name and submission time line is a link ("View Quiz Attempt") that opens the attempt in a new tab.

Integrity Note (17.3.7) -
	* A red "Caught Cheating in Past Quizzes" banner is shown at the top when the user has at least one rejected attempt on any Quiz. A rejection made earlier in the same session counts.
	* If the user has an Integrity Note, it is shown in the banner as "Proctor's Note: <note>". A note is never shown without the banner.
	* Clicking the banner opens the user's rejected attempts in a new tab.

ID Verification -
	* Badge next to the section title: "Re-Uploaded ID" for an ID Re-Upload entry, "Verified" when the ID was approved in an earlier review (17.3.3.1 Previously Verified ID), otherwise none. The two never show together, because requesting a re-upload clears the earlier approval.
	* When the ID is already verified, the section shows "Approved On <date>" instead of the AI results.
	* Otherwise it shows "AI Confidence N%" and "Identified Document" (17.3.6). The ⓘ reads "Generated by AI to speed up review. It can make mistakes. The final decision is yours".
	* Hovering the ID magnifies it. Clicking opens it full screen. While it is full screen, the console's keyboard shortcuts are off.
	* Name Mismatch: when the name the AI reads from the ID is different from the user's SkillCat name, a card "Names Don't Match - Set The Name To Keep" is shown with a field "Name on SkillCat Profile", filled with the current SkillCat name. "ID reads <name> · Use This" copies the ID name into the field. The field is saved only when the reviewer clicks Approve. Skipping, rejecting or leaving the console drops it. If the field is over 128 characters, Approve is disabled. If the field is empty, Approve works and the name is not changed.

Proctoring Footage -
	* Shown only for Proctored Exams. Not shown for ID Reviews.
	* "Flagged Images (N)" is shown only when the AI flagged at least one image (17.3.6). Clicking it toggles between flagged images only and all images. Flagged images carry a tag with the reason.
	* Clicking an image opens it full screen. The checkbox in the corner selects the image as evidence without opening it. Selected images are only used if the attempt is rejected.
	* Full-screen viewer keys: ← → move, R rotates, + and − zoom, 0 fits, Esc closes.

Actions -
Every action opens a confirm pop-up. Cancel, ✕, clicking outside or Esc closes it with nothing changed.
	1. Approve [A] -
	* For Proctored Exams the pop-up is "Approve Attempt?" and reminds the reviewer that both the ID and the footage must have been checked.
	* For ID Reviews the pop-up is "Approve ID?".
	* On confirm, the decision is recorded as defined in 17.3.3, the name from the Name Mismatch card is saved if it was changed, and the console moves on.
	2. Reject [R] -
	* Only available for Proctored Exams. ID Reviews cannot be rejected; the reviewer requests a new ID instead.
	* Pop-up "Reject Attempt?". Description: "<name>'s attempt for the <Quiz> Quiz will be rejected and they will have to retake the quiz."
	* Reasons are checkboxes and more than one can be ticked: "Eyes were not focused on the camera", "Camera was not clear", "Camera was not recording", "Other". Ticking Other shows a text field (128 characters). The reasons and the selected images are shared with the user (17.3.3.1 Rejection Page).
	* "Evidence: N Images Selected" opens the selected images in a viewer. It is disabled when none are selected. Images are not required to reject.
	* "Reviewer's Notes (Internal-Only)" is the Integrity Note (17.3.7). Optional, 512 characters. The user never sees it.
	* The Reject button is enabled only when at least one reason is ticked, Other (if ticked) has text within the limit, and the note is within the limit.
	* Closing the pop-up without confirming loses the ticked reasons and the note. The selected images stay selected.
	3. Request ID Re-Upload [I] -
	* Pop-up "Request Reupload", button "Send Request". The text mentions footage for Proctored Exams and only the ID for ID Reviews.
	* Disabled when a new ID has already been requested for this entry. The button's tooltip says so.
	* On confirm the entry moves to Pending ID Re-Uploads and the earlier ID approval (if any) is cleared (17.3.3 Request ID Reupload).

Keyboard -
	* ← → move through the queue. A, R, I open the three actions. Esc leaves the console.
	* While a text field has focus, Esc only leaves the field and the other keys are ignored.
	* While a pop-up is open, only Esc works and it closes the pop-up.
	* While an image is full screen, the console ignores all keys until it is closed.


17.2.3 Pending ID Re-Uploads

What Is Listed -
	* Entries in the ID Reupload Requested state (17.3.2) where the user has not sent a new ID yet.
	* The subtitle under the title says this: "No action needed here. These are users who were asked to re-upload their ID and haven't sent one back yet. They will be added to the Review Queue as soon as an ID is added".
	* When the user re-uploads, the entry leaves this list and goes back to Exam Reviews as an ID Re-Upload with the "New ID" flag.

Header -
	* Breadcrumb "Exam Reviews" goes back to the list.

Search and Filters -
	* Same search as Exam Reviews.
	* Quiz filter lists only the Quizzes on this page.
	* Two date pills: Re-Upload Request Date and Submission Date. Both default to All Time.
	* Clear Filters resets the Quiz filter and both dates. It does not clear the search.

Table -
	* Columns: User's Name, Email, Phone, Quiz, Re-Upload Requested On, Submitted On. All sortable. Email and Phone are copyable.
	* Default sort is Re-Upload Requested On, oldest first.
	* Clicking a row opens the Review Console on that entry, with the "Exam Reviews › Pending ID Re-Uploads" breadcrumb. In that console Request ID Re-Upload is disabled (already requested) and Skip and ← → do nothing, because the entry is not part of the Exam Reviews queue. Approve and Reject work as normal; after either one the console goes to the Exam Reviews table.
	* 50 rows per page.
	* Empty table: with a search, "No users match "<text>"." Otherwise "No ID re-uploads are outstanding."


17.2.4 What the Prototype Does Not Cover
	* Decisions, renames and Recent runs are kept in memory only and are lost on reload.
	* The Pending ID Re-Uploads list is fixed. A re-upload requested in the console during the session does not appear on it.
	* The sidebar count is fixed at the seed value and does not go down after a decision.
	* On Reject, the prototype keeps only the reasons. The selected images and the Reviewer's Note are not stored. The backend stores all three (17.3.3.1, 17.3.7).
	* On Approve for an ID Review, the prototype does not record that the ID is now verified. The backend marks the ID Upload Task as Completed (17.3.3.2).
	* The "Verified" badge in the prototype only shows for Proctored Exams. It should show for any entry whose ID was approved earlier.
	* Pressing Esc inside the evidence viewer in the Reject pop-up closes the viewer and the pop-up together. Only the viewer should close.
	* IDs, webcam images, AI confidence, detected names and flagged images are generated from the seed. The images are placeholders.
	* Date filters use the real clock; there is no fixed "today" on these pages.
