X. Companies (Internal GUI)

How to read this section
Each screen lists where you can arrive from, then every scenario it can be in. A scenario row has four parts:
	ID	Stable reference for tickets and test cases (CO = Companies, then screen letter, then number).
	Reach	The exact steps or preconditions that put the screen in this scenario. If it needs a company in a particular state, the state is named; the prototype seed has at least one company in every state.
	See	What the screen shows in that scenario. Visual detail lives in the prototype and Figma; this column names the elements and copy that change.
	Then	What the user can do from here and what each action leads to (next scenario ID, toast, or screen).
Backend rules are referenced by section number (22.x) rather than restated.


X.1 List View

Entry points
	E1	Sidebar › Companies. Default state: no search, no filters, Date Range = Last 30 Days, sorted by Last Access (most recent first), page 1.
	E2	Users › row ⋯ › View Company. Arrives with the search box committed to the company name and the header already collapsed.
	E3	Returning from any Company flow (Create, Edit, Manage Subscription). Arrives at the default state (nothing is remembered), with the flow's toast showing.

Header
	ID	Scenario	Reach	See	Then
	CO-L-01	No companies past due	Every company is in a state other than Past Due	Subtitle "N Companies"	-
	CO-L-02	Companies past due	At least one Past Due company	Subtitle "N Companies · M Subscriptions Past Due" (singular forms at 1). Count is of all companies, not the filtered rows.	-
	CO-L-03	Create shortcut	Press C with focus outside any field and the preview panel closed	Create Company wizard opens (CO-C-01)	-
	CO-L-04	Search shortcut	Press ⌘K	Search box focused, existing text selected	Type → CO-L-10

Search
	ID	Scenario	Reach	See	Then
	CO-L-10	Free text typed	Type anything without a prefix	Panel opens with a highlighted "Search for '<text>'" row	Enter or click the row → CO-L-11. Esc closes the panel, text stays.
	CO-L-11	Search committed	From CO-L-10 press Enter	Rows filtered to Name, Account Holder email, Industry, Partnership or Tier containing the text. Page resets to 1. ✕ appears in the box.	✕ → CO-L-12
	CO-L-12	Search cleared	Click ✕	Text and committed search removed. Filters untouched.	-
	CO-L-13	Facet prefix	Type "Tier:", "Status:", "Industries:" or "Partnership:" (any case)	Panel lists that facet's values with "N companies" beside each, max 6, excluding values already applied. Typing after the prefix narrows the list.	Enter or click a value → CO-L-14
	CO-L-14	Facet value picked	From CO-L-13	Value is added to the matching filter pill. Box clears, panel stays open for another pick.	Esc closes the panel
	CO-L-15	Facet exhausted	CO-L-13 with every value already applied	"All <plural> are already applied."	-
	CO-L-16	Facet no match	CO-L-13 with text matching nothing	"No <plural> match '<text>'."	-
	CO-L-17	No results	Any search or filter combination with zero rows	Empty table, "Showing 0 - 0 of 0". (Empty-state copy per 0. Conventions.)	Clear Filters / ✕

Filters
	ID	Scenario	Reach	See	Then
	CO-L-20	Pill untouched	Default	Pill shows its name only	Open → list of values with ALL / NONE, Apply
	CO-L-21	One value	Pick one value, Apply	Pill shows the value	⊗ clears the pill
	CO-L-22	Several values	Pick 2+ but not all	Pill shows "N Selected"	
	CO-L-23	Every value	ALL	Pill shows "All"	
	CO-L-24	Tier on an unbilled company	Tier filter set; company is Free Trial, Trial Expired, Free Access or Free Access Ended	Those companies never match (no plan)	
	CO-L-25	Industries / Partnership "None"	Pick "None"	Matches companies with no values in that field	
	CO-L-26	More Filters	Open More Filters	Submenus: Sign-Up Method, Billing Cycle, Payment Method, Assigned CSM, Assigned Sales Rep. Each applies on its own Apply. Pill shows "N Active" = total values across all five.	
	CO-L-27	Clear Filters	Any pill or More Filters value set	"Clear Filters" appears. Click resets every pill and More Filters value. Date Range is not reset.	
	CO-L-28	Date Range	Open the Date Range pill	Default Last 30 Days; cannot be removed. Changing it only recalculates the Seat Changes column. Rows are not filtered.	

Table rows
	ID	Scenario	Reach	See	Then
	CO-L-30	Active	Company on a paid subscription, invoices paid	Green "Active" pill. Tier, Seats, Seat Changes, Cycle, Payment, Price filled.	Row ⋯ → CO-M-02
	CO-L-31	Past Due	Subscription with an unpaid invoice	Red "Past Due". Hover: "N days past due. Company loses access on <date>" (date = missed payment + 60 days).	Row ⋯ → CO-M-02
	CO-L-32	Pending Payment Setup	Created via Subscription + Automatic (CO-C-30) and Stripe Checkout not yet completed	Red "Pending Payment Setup". Hover bar has no Manage Subscription.	Row ⋯ → CO-M-01
	CO-L-33	Free Trial	Created via Free Trial, end date in future	Yellow "Free Trial Ends <date>". Plan columns "—". Trial End Date filled.	Row ⋯ → CO-M-02 minus Billing Emails, Invoices, Cancel
	CO-L-34	Trial Expired	Free Trial end date passed	Grey "Trial Ended". Plan columns "—".	As CO-L-33
	CO-L-35	Free Access	Complimentary access, end date in future	"Free Access" pill. Plan columns "—".	Row ⋯ → CO-M-02 minus Billing Emails, Cancel
	CO-L-36	Free Access Ended	Free Access end date passed	Grey "Free Access Ended".	As CO-L-35
	CO-L-37	Cancellation scheduled	Cancel Subscription confirmed (CO-X-05), effective date in future	Grey "Cancels <date>". Hover: "Reason: <reason>". Canceled On "—". Plan columns still filled.	Row ⋯ → CO-M-02 minus Billing Emails, Cancel
	CO-L-38	Canceled	Effective date passed	Grey "Canceled". Canceled On filled.	As CO-L-37
	CO-L-39	Seat Changes	Company with seat events inside the Date Range	"+N" if net added, "−N" if net removed, "—" if net zero or none. Header ⓘ: "Counted within the selected date range".	
	CO-L-40	Several industries	Company with 2+ Industries (or Partnerships)	First value + "+N". Hover lists all. No hover with one value.	
	CO-L-41	Account Holder hover	Hover the Account Holder cell	Card with name, email, phone (phone row omitted if none), open-profile link	Link opens the profile in a new tab
	CO-L-42	Row click	Click anywhere on a row except an action	Preview panel (CO-P-01)	
	CO-L-43	Sort	Click a column header	First click ascending, second flips. Status sorts by state name, so "Cancels" and "Canceled" sit together. Tier: Essentials < Growth < Professional < none. Page resets to 1.	
	CO-L-44	Edit Columns	Header › Edit Columns	Company and Status fixed. A column switched on is appended; dragging reorders; switching off keeps its slot. Not remembered between visits.	
	CO-L-45	Paging	More than 50 rows	Prev disabled on page 1, Next on last. Any search, sort, filter or date change returns to page 1 and scrolls to the top row.	

Row menu (⋯)
	ID	Scenario	Reach	See	Then
	CO-M-01	Pending Payment Setup menu	⋯ on CO-L-32	Edit Company Details · Copy Payment Link · Delete Company (red)	Copy → toast "Payment Link Copied" (2.5s). Delete → CO-M-04
	CO-M-02	Standard menu	⋯ on any other row	Edit Company Details · Manage Subscription · Change Account Holder · Manage Billing Emails · View All Employees · View Invoices · View Company Dashboard · Cancel Subscription (red). Items hidden per state: see CO-M-03.	
	CO-M-03	Hidden items	By state	Manage Billing Emails hidden for Free Trial, Trial Expired, Free Access, Free Access Ended, Canceled. View Invoices hidden for Free Trial, Trial Expired. Cancel Subscription shown only for Active and Past Due.	
	CO-M-04	Delete Company	Delete Company on CO-M-01	Confirm, then "Are you sure?" with "Yes, Delete Company". Go Back / ✕ / Esc on the second close both.	Confirm removes the row. No toast.
	CO-M-05	Menu placement	⋯ on a row near the bottom of the viewport	Menu opens upward	Outside click, scroll or Esc closes it
	CO-M-06	View All Employees	Any standard menu	Users page filtered to this company	
	CO-M-07	View Company Dashboard	Any standard menu	Impersonated B2B Dashboard in a new tab	

Preview panel
	ID	Scenario	Reach	See	Then
	CO-P-01	Open	CO-L-42	Meta: id, Tier or "No plan", first Industry "+N", status pill, "Created <date>". Actions: Edit, View Employees (+ Copy Payment Link for Pending). Stats: Seats in Use "Of <total>", Seats Free with "To assign" / "All taken", Last Login. Overview card + review cards from the wizard.	Esc or ✕ → closes (160ms). ⋯ inside the panel runs the item after closing it.
	CO-P-02	Esc with menu open	Open ⋯ inside the panel, press Esc	Menu closes first; a second Esc closes the panel	
	CO-P-03	Shortcut while open	Press C with the panel open	Nothing	


X.2 Create Company

Entry points
	E1	Header › Create Company, or C (CO-L-03).
Steps: 1 Company Details · 2 Admin Account · 3 Plan · Review. Rail and wheel-scroll past the edge move between steps freely.

	ID	Scenario	Reach	See	Then
	CO-C-01	Fresh wizard	E1	Step 1. Defaults: Country United States, Tax Status Taxable, CSM Unassigned, Sales Rep = logged-in user.	
	CO-C-02	Required missing on Continue	Step 1 with Name or Zipcode empty	Continue disabled; tooltip names the first failing field. ⌘↵ does nothing.	
	CO-C-03	Error timing	Blur an empty required field, or come back to a step you left incomplete	Red message in the label row	
	CO-C-04	Step left incomplete	Move to step 2 with step 1 invalid	Red marker on step 1 in the rail	
	CO-C-05	US zip auto-fill	Type 5 digits in Zipcode with any country	Country set to US, State and City filled; all remain editable	
	CO-C-06	Non-US zip	Country Canada, UK, etc.	Zipcode validated per country format	
	CO-C-07	No postal codes	Country without postal codes (e.g. UAE)	Zipcode not required	
	CO-C-08	Name over 128	Type past 128 in Company Name	Red count, Continue blocked (0. Character limits)	
	CO-C-09	Product Config link	Industries / Partnership › Product Config	Leave guard (CO-C-50) then Product Config	
	CO-C-10	Admin Account	Step 2	Name and Email required; Phone optional, formats as (XXX) XXX-XXXX	
	CO-C-11	Invalid email	Email without a valid format	Error (backend rule; prototype only checks non-empty)	
	CO-C-20	Plan defaults	Step 3	Subscription · Growth · Monthly · USD · Automatic · 1 seat · Price = Default Rate (22.3)	
	CO-C-21	Price re-fills	Change Tier, Cycle, Currency or Plan	Price resets to the Default Rate for the new combination	
	CO-C-22	Custom price	Open the Price menu	Lists saved prices for this Cycle with a rate in this Currency; search by amount or name	Create New Price → CO-C-23
	CO-C-23	Create New Price	From CO-C-22	Name optional; Cycle defaults to current; USD and CAD rows; Create enabled once any row > 0; last row can't be removed; Add Currency disabled when none left.	Create → price selected; Cycle switches if the price is on the other Cycle.
	CO-C-24	Unsaved custom price	Type an amount that matches no saved price	Continue blocked: "Save the custom price before creating the subscription."	
	CO-C-25	Seats 0 or blank	Clear the stepper	Continue blocked	
	CO-C-26	Preview rail	Any valid subscription	"Today" = rate × seats prorated to the next 1st; "<1st of next month> Onwards" = full cycle amount (22.5). No rate → Per Seat "—", no timeline.	
	CO-C-27	Free Trial	Plan = Free Trial	No further fields; trial length from Admin Settings (4.4)	
	CO-C-28	Free Access	Plan = Complimentary Free Access	Access End Date required, must be in the future	
	CO-C-30	Review	Review Details	Read-only cards per step with pencils. Nothing saved yet.	Pencil → that step with values kept. Back → step 3. Create Company → CO-C-31..34
	CO-C-31	Create: Subscription + Automatic	From CO-C-30	Payment link copied, toast "Payment Link Copied". "Company Created" screen with the Stripe link (22.7). Company is Pending Payment Setup.	Done → list, no toast
	CO-C-32	Create: Subscription + Invoice	From CO-C-30	List, toast "Company Added". Company is Active.	
	CO-C-33	Create: Free Trial	From CO-C-30	List, toast "Company Added". Company is Free Trial.	
	CO-C-34	Create: Free Access	From CO-C-30	List, toast "Company Added". Company is Free Access.	
	CO-C-50	Leave with changes	Cancel, sidebar, browser Back, or CO-C-09 after any field changed	"Discard this Company?" / "This Company hasn't been created yet — everything you've filled in will be lost." Discard (red) · Keep Editing	Discard → list
	CO-C-51	Leave without changes	Same exits with every field at its opening value (whitespace counts as empty)	No prompt	
	CO-C-52	Leave from Company Created	Any exit on CO-C-31's screen	No prompt	


X.3 Edit Company Details

Entry points
	E1	Row hover › Edit, row ⋯ › Edit Company Details, preview panel › Edit.

	ID	Scenario	Reach	See	Then
	CO-E-01	Open	E1	Step 1 only, no rail, no Back. Save Changes disabled, tooltip "No changes to save".	
	CO-E-02	Changed	Edit any field	Save Changes enabled if the step is valid	Save → list, toast "Company Updated"
	CO-E-03	Changed then restored	Edit then put the value back	Save disabled again	
	CO-E-04	Saved	CO-E-02 Save	Only Name, Tax Status, CSM, Sales Rep, Industries, Partnership, Address written. Plan, status and Account Holder untouched.	
	CO-E-05	Leave with changes	Any exit after CO-E-02	"Discard unsaved changes?" Discard · Keep Editing	


X.4 Manage Subscription

Entry points
	E1	Row hover › Manage Subscription (not on Pending Payment Setup), row ⋯ › Manage Subscription.

	ID	Scenario	Reach	See	Then
	CO-S-01	Open	E1	Plan step only, titled "Manage Subscription", prefilled from the company. Save Changes disabled.	
	CO-S-02	Free Trial locked	Company is not currently on a Free Trial, or its trial expired	Free Trial option disabled	
	CO-S-03	Free Access locked	Company is Active, Past Due or Cancellation scheduled (22.2)	Free Access option disabled	
	CO-S-04	Automatic locked	Company pays by Invoice	Automatic disabled: "Companies can switch to automatic payment via the Billing Tab of their Dashboard." (22.7)	
	CO-S-05	Seats locked	Company is on any Subscription state	Seats disabled: "Seat count is set when the company is created and can't be changed here." (22.4)	
	CO-S-06	Seats editable	Company is Free Trial, Trial Expired, Free Access or Free Access Ended, Plan switched to Subscription	Seats enabled	
	CO-S-10	Change applies today	Active/Past Due; only Payment changed, or Cycle → Annual without Tier downgrade, or Cycle → Monthly with Tier upgrade, or the total does not go down	Preview: changed rows labelled (Tier upgrade, Monthly → Annual, Currency X → Y, Price increase, Seats added, Payment method update), "Applies Today", charge = (new monthly − old monthly, floor 0) × fraction of cycle left (22.6)	
	CO-S-11	Change at cycle end	Active/Past Due; any other change	Preview rows + "At Cycle End", no proration	
	CO-S-12	Free Access date change	Free Access company, new end date	Preview shows old → new date, "extended" / "shortened"	
	CO-S-20	Save	Save Changes	Confirm modal: changed rows + one sentence on timing	Confirm → list, toast "Subscription Updated"
	CO-S-21	Status after save	From CO-S-20	Past Due and Pending kept. Free Trial → Free Trial. Free Access → Free Access. Any Subscription → Active (a scheduled cancellation is undone).	
	CO-S-22	Leave with changes	Any exit after a change	"Discard unsaved changes?"	


X.5 Pop-ups

Change Account Holder
	ID	Scenario	Reach	See	Then
	CO-X-01	Open	Row ⋯ › Change Account Holder	"Current: <name>" (hover → details card). Options: Change the Account Holder (default) · Remove from Company & Replace. New Account Holder select lists the company's employees minus the current holder, Admin/Manager tagged, search by name or email, "name (email)" only when names clash. Save Changes disabled.	
	CO-X-02	Employee picked	Select one	Save Changes enabled	Save → holder's name, email and phone replaced; with Remove & Replace the old holder is also removed from the company. No toast.

Manage Billing Emails / View Invoices
	ID	Scenario	Reach	See	Then
	CO-X-03	Open	Row ⋯ › either item	Steps to follow on Stripe; "Open Stripe" opens a new tab, modal stays open (22.7)	Cancel / ✕ / Esc close

Cancel Subscription
	ID	Scenario	Reach	See	Then
	CO-X-04	Open, Active	Row ⋯ › Cancel Subscription on an Active company	"…keeps full access until the end of the current billing cycle (<date>)". Reason multi-select, required (22.8). Outstanding Balance card only if seats were added this cycle and not yet invoiced.	Continue → CO-X-06
	CO-X-05	Open, Past Due	Same on a Past Due company	"…is N days past due… Access is cut off on <date> if the outstanding invoice goes unpaid." Outstanding Balance = overdue invoice + pending seats.	Continue → CO-X-06
	CO-X-06	Are you sure?	Continue	"Yes, Cancel Subscription". Copy adds ", apart from ~$X in pending seat charges" when there are any. Go Back / ✕ / outside / Esc close both modals.	Confirm → CO-X-07
	CO-X-07	Canceled	Confirm	List, toast "Subscription Canceled". Row becomes CO-L-37 with the next renewal as the date (22.8).	


X.6 Prototype limits
	* "Today" is fixed at 24 Jun 2026; every date-based scenario above counts from it.
	* Statuses, cycles, seats used, Last Access, employees and Stripe links are generated from the company id.
	* Company ids are "CO-<count+1>". Trial length, the CAD rate and the saved-price list are hard-coded.
	* Changes live in memory; reload resets. The list page remembers nothing between visits.
	* View Company Dashboard opens a placeholder tab.
