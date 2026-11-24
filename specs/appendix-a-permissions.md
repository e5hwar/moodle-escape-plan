# Appendix A Permissions

*SkillCat Admins* get permissions through roles. Roles are created and assigned on the *Permissions* tab of *Product Config*.

- Without a section's *View* permission, the section is missing from the sidebar and its pages do not open. Menu items elsewhere that lead to it are disabled.
- Without an action's permission, its button, menu item or field is disabled. A disabled action is never offered as a quick action.

## A.1 Tasks

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Tasks | See the Tasks list and Task details. | *Tasks* appears in the sidebar, and the *Tasks* list and *Preview Panel* open. |
| Create & Edit Tasks | Create xAPI, Quiz, Hands-On and Resource Tasks, and edit them. | Covers every step of the *Create/Edit* page except a *Quiz*'s *Paywall* and *Proctoring*, which have their own permissions below. Unlocking locked *Completion Criteria* also has its own permission. |
| Set Quiz Paywall | Turn a Quiz's paywall on or off and set its Price IDs. | Applies when creating and when editing. Without this permission, the *Paywall* fields on the *Create/Edit* page are disabled: the *SkillCat Admin* can create only free *Quizzes*, and cannot change the *Paywall* or *Price IDs* of an existing *Quiz*. |
| Set Quiz Proctoring | Turn Proctoring on or off for a Quiz. | Applies when creating and when editing. Without this permission, *Proctoring* is disabled: the *SkillCat Admin* can create a *Quiz* only with *No: Proctoring Not Required*, and cannot change *Proctoring* on an existing *Quiz*. |
| Unlock Task Completion Criteria | Change completion criteria after users have completed the Task. | Unlocks locked *Completion Criteria* on the *Create/Edit* page, including a *Quiz*'s *Quiz Passing Percentage* and *Section Pass Marks* and a *Hands-On Task*'s *Passing Grade*. |
| Hide & Show Tasks | Make Tasks hidden or visible to users. | *Make Hidden* and *Make Visible* in the row menu, and *Hidden* on the *Create/Edit* page. |
| Delete Tasks | Delete Tasks. | *Delete Task* in the row menu. |
| View Quiz Attempts & Purchases | See a Quiz's attempts and who paid for it. | Opens the *Quiz Attempts* page and the *Who Paid* page. Also needed for *View All Attempts* on *Manage Completions*. |
| Delete Quiz Attempts | Delete a user's Quiz attempt. | *Delete Attempt* on the *Quiz Attempts* page. (Deleting resets the *Cooldown Between Attempts*, renumbers the user's later attempts and recomputes their completion.) |
| Grant & Revoke Quiz Attempts | Give users extra Quiz attempts, or revoke purchased ones. | *Grant Additional Attempts* on the *Who Paid* page, the *Quiz Attempts* page and *Manage Completions*, and *Revoke Access* on the *Who Paid* page. |

## A.2 Hands-On Task Submissions

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Hands-On Submissions | See Hands-On Task submissions. | *Hands-On Tasks* appears in the sidebar with its pending count. Submissions open in the *Review Console* read-only. |
| Review Hands-On Submissions | Score Hands-On Task submissions. | Without this permission, the scoring controls and *Submit* in the *Review Console* are disabled. |

## A.3 Certifications

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Certifications | See the Certifications list, Certification details and who paid. | *Certifications* appears in the sidebar, and the *Certifications* list, *Preview Panel* and *Who Paid* page open. |
| Create & Edit Certifications | Create Certifications, from scratch or from a file, and edit them. | Covers *From Scratch*, *Upload Backup* and *CSV Upload*, *Backup Certification*, and every step of the *Create/Edit* page except the *Paywall* and *Deep Link*, which have their own permissions below. Also covers *Mark as Done* on a *Certification*'s setup status. Unlocking locked *Completion Criteria* has its own permission. |
| Set Certification Paywall | Choose whether a Certification is free or paid, and set its Product IDs. | Applies when creating and when editing. Without this permission, the *Paywall* step is disabled: the *SkillCat Admin* can create only *Free* *Certifications*, and cannot change the *Paywall* of an existing *Certification*. |
| Edit Deep Links | Change a Certification's Deep Link slug. | Applies when creating and when editing. Without this permission, *Deep Link* is disabled: a new *Certification* keeps the slug made from its name, and the slug of an existing *Certification* cannot be changed. (A changed slug stops the old link working at once.) |
| Unlock Certification Completion Criteria | Change completion criteria after users have completed the Certification. | Unlocks locked *Condition Sets* on the *Create/Edit* page. |
| Hide & Show Certifications | Make Certifications hidden or visible to users. | *Make Hidden* and *Make Visible* in the row menu. |
| Archive & Replace Certifications | Archive Certifications, set their replacements, and unarchive them. | *Archive & Replace*, *Manage Archive & Replace Settings* and *Unarchive*. |
| Delete Certifications | Delete Certifications. | *Delete Certification* in the row menu. |
| Grant & Revoke Certification Access | Give users free access to a Certification, or revoke a Consumable one. | *Grant Access* and *Revoke Access* on the *Who Paid* page. |
| Create & Edit Content Links | Add, edit and remove a Certification's Content Links. | *Manage Content Links* in the row menu, including from a *Certification*'s setup status. |
| Create & Edit Awards | Add an Award to a Certification, edit it, and archive it. | *Add Award* and *Manage Award*, including *Status*. (Saving an *Award* as *Active* issues it at once to every user who already completed the *Certification*.) Setting *Status* to *Archived* stops issuing the *Award* to new users, and users who hold it keep it. |
| Delete Awards | Delete Awards. | *Delete Award* on the *Manage Award* page. |
| Create & Edit Award Templates | Create, edit and delete Card and Certificate templates. | The *Award Templates* tab of *Product Config*. |

## A.4 Industries

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| Create & Edit Industries | Create, rename, hide, reorder and delete Industries and Sub-Industries. | *Industries* opens from the *Certifications* page for anyone with *View Certifications*. Without this permission it opens read-only. |
| Tag Certifications with Industries | Add Certifications to Industries and remove them. | *Assign Industries* on the untagged banner, the *Industries* modal that opens after a *Certification* is created, and *Remove* on an *Industry* or *Sub-Industry* hub. Without this permission, the *Industries* modal does not open after a *Certification* is created. |

## A.5 Skills

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Skills | See Skills and Mastery Skills. | *Skills* opens from the *Tasks* page. |
| Create & Edit Skills | Create and edit Skills and Mastery Skills. | Covers both *Create/Edit* pages, including the *Tasks* linked to a *Skill* and the *Skills* linked to a *Mastery Skill*. |
| Archive & Delete Skills | Archive, reactivate and delete Skills and Mastery Skills. | *Archive*, making an *Archived* *Skill* *Active* again, and *Delete* in the row menu. |

## A.6 Feedback Forms

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Feedback Forms | See Feedback Forms and export their responses. | *Feedback* opens from the *Certifications* page. Includes *Export Responses*. |
| Create & Edit Feedback Forms | Create, duplicate, edit and delete Feedback Forms. | Covers the *Feedback Form Editor*, *Duplicate Form* and *Delete Form*, and *Add* on the *Feedback* step of a *Certification*'s setup status. |
| Archive Feedback Forms | Archive and unarchive Feedback Forms. | *Archive Form* and *Unarchive Form* in the row menu. |

## A.7 Question Bank

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Question Bank | See questions, Categories and version history. | *Question Bank* opens from the *Tasks* page. Includes *Version History*. |
| Create & Edit Questions | Create, edit and import questions, and manage Categories. | Covers the *Question Editor*, *Create New Question* inside a *Quiz*, *CSV Import*, and creating, renaming and deleting *Categories* and *Sub-Categories*. Without this permission, *Create New Question* on a *Quiz* is disabled: the *SkillCat Admin* can add only questions already in the *Question Bank*. |
| Archive & Delete Questions | Archive, unarchive and delete questions. | *Archive*, *Unarchive* and *Delete* in the row menu. |

## A.8 Manage Completions

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View User Progress | See a user's progress on a Certification or Task. | *Manage User Progress* on *Tasks* and *Certifications*, and *Manage Training Progress* on *Users*, open *Manage Completions* read-only. |
| Change User Progress | Mark Tasks and Certifications complete or incomplete for a user. | *Mark as Complete* and *Mark as Incomplete*, with grades, on *Manage Completions*. *Grant Additional Attempts* on the same page needs *Grant & Revoke Quiz Attempts*. |

## A.9 Users

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Users | See users, their profiles, purchases and Scholarships. | *Users* appears in the sidebar. Covers the *Users* list, the *Full Profile* (including email, phone, *Purchases & Bills* and *EPA Card Orders*) and the *Scholarships* page. *View All Employees* on *Companies* also needs it. |
| Login As Users | Open the app as a user sees it. | *Login As* on the *Users* list and *Full Profile*. |
| Edit User Details | Edit a user's contact details. | *Edit User Details*. The name fields are disabled unless the role also has *Review Exams, IDs & Name Changes*. |
| Grant & Revoke Scholarships | Grant Scholarships, change their end date and revoke them. | Every action on the *Scholarships* page. |
| Cancel Subscriptions & Refund | Cancel B2C Subscriptions and EPA Card Orders, and refund purchases. | *Cancel Subscription* on the *Users* list and *Full Profile*, *Refund* in *Purchases & Bills*, and *Cancel Order* in *EPA Card Orders*. |
| Transfer Subscriptions | Move a B2C Plan or Scholarship to another account. | *Transfer Subscription*. |
| Merge Accounts | Merge two user accounts into one. | *Merge Accounts*. (Merging cannot be undone.) |

## A.10 Exam Reviews, IDs & Name Changes

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Exam Reviews, IDs & Name Changes | See exam reviews, users' IDs and name change requests. | *Exam Reviews* appears in the sidebar with its pending count. Covers the *Exam Reviews* queue, *Pending ID Re-Uploads* and the *Review Console* read-only, *Integrity Notes* and the *Past-Rejections Card*, *View ID* with its timeline, *Manage IDs*, and *Name Change Requests*. *Name Change Requests* opens from the *Users* page, so it also needs *View Users*. |
| Review Exams, IDs & Name Changes | Approve or reject exams, IDs and name changes. | In *Exam Reviews*: *Approve*, *Reject*, *Request ID Re-Upload*, and corrections in the *Name Mismatch Card*. In the *ID* modal: *Approve* and *Upload & Approve*. On *Name Change Requests*: *Approve*, *Reject* and *Request ID Proof*. Also covers renaming a user from the *Hover Card* and the name fields in *Edit User Details*. |
| Upload IDs | Upload a user's ID for review. | *Upload ID* on the *Full Profile*, and *Upload Without Approval* when replacing an *In Review* or *Re-Upload Requested* *ID*. *Upload & Approve* needs *Review Exams, IDs & Name Changes*, and so does replacing an *Approved* *ID*, since *Upload & Approve* is its only option. |
| Write Integrity Notes | Add internal Integrity Notes about a user. | The note field in the *Reject* modal. The note is optional, so a *SkillCat Admin* who can review but not write notes can still reject. |

## A.11 Companies

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Companies | See companies, their invoices and billing emails. | *Companies* appears in the sidebar. Also covers *View Invoices* and *Manage Billing Emails*. |
| View Company Dashboards | Open a company's Dashboard as its Account Holder. | *View Company Dashboard*. |
| Create & Edit Companies | Create companies, edit their details, and delete unpaid new ones. | *Create Company*, including its *Plan* step, *Copy Stripe Checkout Link*, *Edit Company Details* including *Assigned Sales Rep* and *CSM*, and *Delete Company*. |
| Manage Company Subscriptions | Change a company's Plan. | *Manage Subscription*: *Tier*, *Billing Cycle*, *Per-Seat Price*, *Seats* when converting, *Payment Method*, *Free Trial* and *Free Access*. |
| Cancel Company Subscriptions | Cancel a company's Subscription. | *Cancel Subscription* in the row menu. |
| Change Account Holders | Move a company's ownership to another employee. | *Change Account Holder*, with either outcome. |
| Create Stripe Prices | Add new per-seat prices to the Stripe catalogue. | *Create New Price* on the *Plan* step of *Create Company* and on *Manage Subscription*. |

## A.12 Spotlight

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Spotlights | See Spotlights and their queue. | *Spotlight* appears in the sidebar with its *In-Review* count. |
| Create & Edit Spotlights | Create and edit Spotlights, and re-enable ended ones. | Covers the *Create/Edit* page, and *Enable* on an *Ended* or *Rejected* *Spotlight*. |
| Approve Spotlights | Approve, reject, reorder and disable Spotlights. | *Approve*, *Reject*, reordering the *Active* queue, and *Disable*. |

## A.13 Product Config

| Name | Subtext (Displayed in the UI) | Details |
|---|---|---|
| View Product Config | See every Product Config setting. | *Product Config* appears in the sidebar and every tab opens. Fields the role cannot change are disabled. |
| Manage Roles & Admins | Create roles and give SkillCat Admins access. | The *Permissions* tab: creating and editing roles, inviting, deactivating and reactivating *SkillCat Admin* accounts, and giving them roles. |
| Force App Update | Add app versions and set the minimum version. | *Force App Update* on *General Settings*. |
| Edit What's New Pages | Set the pages users see after updating the app. | *What's New Page* on *General Settings*. |
| Edit Proctoring Settings | Set how often webcam frames are captured. | *Webcam Capture Frequency* on *General Settings*. |
| Edit Display Settings | Edit app and Dashboard tabs and Support Pages. | Everything on *Display Settings*. |
| Edit B2C Settings | Edit B2C Product IDs and the Free Trial length. | Everything on *B2C Management*. |
| Edit B2B Pricing | Edit B2B Price IDs, default seat rates and the Free Trial length. | The per-seat *Price IDs* and default rates, the *EPA Card Product ID* and *Free Trial Duration* on *B2B Management*. |
| Edit B2B Lists | Edit Partnerships, Trades and Cancellation Reasons. | The three lists on *B2B Management*. (Removing a value removes it from every company, *Task* and *Certification* that carries it.) |
| Edit Legal | Edit the Terms of Service and Privacy Policy. | Everything on *Legal*. |
