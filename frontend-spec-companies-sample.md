X. Companies (Internal GUI)

X.1 Overview
This is where SkillCat Admins, Sales and CS manage B2B Companies. From here they can create a company, change its subscription, change the Account Holder, manage billing and cancel the subscription.

All subscription and billing rules are defined in 22. B2B Subscriptions & Billing. This section only describes how the screens behave. Where a rule comes from Section 22, the section number is given instead of repeating the rule.

Anything that can be seen in the prototype (layout, labels, columns, menu items) is the spec and is not repeated here. A row is added below only when something changes on the screen or a decision is made.

How to Read the Tables -
	ID	A fixed reference for tickets and test cases. IDs are never reused or renumbered.
	Scenario	What the user is doing, or what state the company is in.
	Reach	How to get to this scenario. If a company in a certain state is needed, the state is named. The prototype has at least one company in every state.
	See	What is shown on the screen in this scenario.
	Then	What the user can do next and where it leads (another ID, a toast or a screen).

Rules that apply to every page (leave guard, double confirm, character limits, tables, filters, toasts) are defined in 0. Frontend Conventions and are not repeated here.


X.2 List View

Entry Points -
	E1	Sidebar › Companies. The page opens clean: no search, no filters, Date Range set to Last 30 Days, sorted by Last Access (most recent first), page 1.
	E2	Users › row ⋯ › View Company. The page opens with the company name already in the search box and the header already collapsed.
	E3	Coming back from Create Company, Edit Company or Manage Subscription. The page opens clean and shows that flow's toast. Nothing on this page is remembered between visits.

Header and Shortcuts
	ID	Scenario	Reach	See	Then
	CO-L-01	Page opens	E1	Subtitle shows "N Companies". If any company is Past Due, it also shows " · M Subscriptions Past Due". Both numbers count all companies, not just the filtered rows.	
	CO-L-02	Create with the keyboard	Press C. Focus must be outside a text field and the preview panel must be closed.	Create Company opens	CO-C-01
	CO-L-03	Search with the keyboard	Press ⌘K	The search box is focused and any text in it is selected	CO-L-10

Search
Search only runs when the user presses Enter or clicks the "Search for…" row. It does not filter as the user types. The search box can also be used to set the Tier, Status, Industries and Partnership filters by typing the filter name followed by a colon.
	ID	Scenario	Reach	See	Then
	CO-L-10	User types	Type any text	A panel opens with a "Search for '<text>'" row already highlighted	Enter or click → CO-L-11. Esc closes the panel and keeps the text.
	CO-L-11	Search runs	Enter from CO-L-10	Rows are filtered to companies where the Name, Account Holder email, Industry, Partnership or Tier contains the text. The page goes back to 1. A ✕ appears in the box.	✕ → CO-L-12
	CO-L-12	Search cleared	Click ✕	The text and the search are removed. Filters are not changed.	
	CO-L-13	Filter set by typing	Type "Tier:", "Status:", "Industries:" or "Partnership:" (any case)	The panel lists the values for that filter, with "N companies" next to each. Up to 6 are shown. Values already applied are not shown. Typing after the colon narrows the list.	Enter or click → CO-L-14
	CO-L-14	Value picked	From CO-L-13	The value is added to that filter pill. The box is cleared and the panel stays open so another value can be picked.	Esc closes the panel
	CO-L-15	All values already applied	CO-L-13 when every value is already in the filter	"All <plural> are already applied."	
	CO-L-16	No value matches	CO-L-13 with text that matches nothing	"No <plural> match '<text>'."	
	CO-L-17	No results	Any search or filter that returns no rows	Empty table with "Showing 0 - 0 of 0". Empty-state copy as defined in 0.	

Filters
Notes -
	* Tier, Billing Cycle and Payment Method only apply to companies on a Subscription. Free Trial and Free Access companies have no plan, so they never match these filters.
	* Date Range works differently from the other pills. It does not filter the rows. It only decides which seat changes are counted in the Seat Changes column.
	ID	Scenario	Reach	See	Then
	CO-L-20	Pill set	Open a pill, pick values, click Apply	The pill shows the value (1 value), "N Selected" (some values) or "All" (every value)	⊗ on the pill clears it
	CO-L-21	Plan filter on a company with no plan	Tier, Billing Cycle or Payment Method is set	Free Trial, Trial Expired, Free Access and Free Access Ended companies are never shown	
	CO-L-22	"None" picked	Pick "None" in Industries or Partnership	Shows companies with nothing set in that field	
	CO-L-23	More Filters	Open More Filters	Five sub-menus: Sign-Up Method, Billing Cycle, Payment Method, Assigned CSM, Assigned Sales Rep. Each has its own Apply. The pill shows "N Active", where N is the number of values picked across all five.	
	CO-L-24	Clear Filters	Any pill or More Filters value is set	"Clear Filters" appears. Clicking it resets every pill and every More Filters value. Date Range is not reset.	
	CO-L-25	Date Range	Open Date Range	Defaults to Last 30 Days and cannot be removed. Changing it only recalculates the Seat Changes column.	

Rows by Status
Each company has one status. The status decides the pill, which plan columns are filled, which buttons show on hover and which items show in the ⋯ menu.

The plan columns (Tier, Seats, Seat Changes, Billing Cycle, Payment Method, Price) are filled only for companies on a Subscription. These are the four statuses Active, Pending Payment Setup, Past Due and Canceled. For every other status these columns show "—".
	ID	Scenario	Reach	See	Then
	CO-L-30	Active	Paid subscription with all invoices paid	Green "Active" pill. Plan columns filled.	⋯ → CO-M-02
	CO-L-31	Past Due	Subscription with an unpaid invoice	Red "Past Due" pill. Hover shows "N days past due. Company loses access on <date>". The date is 60 days after the missed payment.	⋯ → CO-M-02
	CO-L-32	Pending Payment Setup	Company created with Subscription + Automatic (CO-C-31) and the Stripe Checkout has not been completed	Red "Pending Payment Setup" pill. The hover bar does not show Manage Subscription.	⋯ → CO-M-01
	CO-L-33	Free Trial	Company created with Free Trial and the end date has not passed	Yellow "Free Trial Ends <date>" pill. Plan columns show "—". Trial End Date column is filled.	⋯ → CO-M-02 (some items hidden, see CO-M-03)
	CO-L-34	Trial Expired	Free Trial end date has passed	Grey "Trial Ended" pill. Plan columns show "—".	Same as CO-L-33
	CO-L-35	Free Access	Company given Complimentary Free Access and the end date has not passed	"Free Access" pill. Plan columns show "—".	⋯ → CO-M-02 (some items hidden, see CO-M-03)
	CO-L-36	Free Access Ended	Free Access end date has passed	Grey "Free Access Ended" pill.	Same as CO-L-35
	CO-L-37	Cancellation scheduled	Cancel Subscription was confirmed (CO-X-07) and the end of the billing cycle has not been reached	Grey "Cancels <date>" pill. Hover shows "Reason: <reason>". Canceled On column shows "—". Plan columns are still filled.	⋯ → CO-M-02 (some items hidden, see CO-M-03)
	CO-L-38	Canceled	The end of the billing cycle has passed	Grey "Canceled" pill. Canceled On column is filled.	Same as CO-L-37

Other Columns
	ID	Scenario	Reach	See	Then
	CO-L-40	Seat Changes	Company has seat changes inside the Date Range	"+N" if seats were added overall, "−N" if removed overall, "—" if the total is zero or there are no changes. The header ⓘ says "Counted within the selected date range".	
	CO-L-41	More than one Industry	Company has 2 or more Industries (same for Partnerships)	First value followed by "+N". Hover shows the full list. No hover when there is only one value.	
	CO-L-42	Account Holder hover	Hover over the Account Holder cell	Card with name, email and phone. The phone row is not shown if there is no phone. Has an open-profile link.	Link opens the profile in a new tab
	CO-L-43	Sort	Click a column header	First click sorts ascending, second click flips it. Status sorts by the status name, so "Cancels <date>" and "Canceled" are next to each other. Tier sorts Essentials, Growth, Professional, then no tier. The page goes back to 1.	
	CO-L-44	Edit Columns	Header › Edit Columns	Company and Status cannot be turned off. A column turned on is added at the end. Dragging changes the order. Turning a column off keeps its place for when it is turned back on.	
	CO-L-45	Paging	More than 50 companies	Prev is disabled on page 1 and Next on the last page. Any change to search, sort, filters or Date Range goes back to page 1.	
	CO-L-46	Row click	Click anywhere on a row except the action buttons	Preview panel opens	CO-P-01

Row Menu (⋯)
	ID	Scenario	Reach	See	Then
	CO-M-01	Pending Payment Setup company	⋯ on CO-L-32	Only three items: Edit Company Details, Copy Payment Link, Delete Company (red)	Copy → toast "Payment Link Copied". Delete → CO-M-04
	CO-M-02	Any other company	⋯ on CO-L-30 to CO-L-38	Edit Company Details, Manage Subscription, Change Account Holder, Manage Billing Emails, View All Employees, View Invoices, View Company Dashboard, Cancel Subscription (red). Some items are hidden depending on status (CO-M-03).	
	CO-M-03	Items hidden by status	Depends on the status	Manage Billing Emails is hidden for Free Trial, Trial Expired, Free Access, Free Access Ended and Canceled. View Invoices is hidden for Free Trial and Trial Expired. Cancel Subscription is only shown for Active and Past Due.	
	CO-M-04	Delete Company	Delete Company on CO-M-01	A confirm, then "Are you sure?" with "Yes, Delete Company". Go Back, ✕ and Esc on the second confirm close both.	Confirm removes the company. No toast.
	CO-M-05	View All Employees	Any CO-M-02	Opens the Users page filtered to this company	
	CO-M-06	View Company Dashboard	Any CO-M-02	Opens the company's B2B Dashboard in a new tab (impersonation)	
	CO-M-07	Menu near the bottom of the screen	⋯ on a row near the bottom	The menu opens upwards. Clicking outside, scrolling or Esc closes it.	

Preview Panel
	ID	Scenario	Reach	See	Then
	CO-P-01	Panel open	CO-L-46	Top line: company id, Tier or "No plan", first Industry with "+N", status pill, "Created <date>". Buttons: Edit, View Employees, and Copy Payment Link for a Pending Payment Setup company. Stats: Seats in Use "Of <total>", Seats Free with "To assign" or "All taken", Last Login. Below that the Overview card and the same cards shown on the wizard's Review screen.	Esc or ✕ closes the panel. ⋯ inside the panel closes the panel first, then runs the item.
	CO-P-02	Esc while the menu is open	Open ⋯ inside the panel, press Esc	The menu closes. Pressing Esc again closes the panel.	
	CO-P-03	C while the panel is open	Press C	Nothing happens	


X.3 Create Company

Entry Points -
	E1	Header › Create Company, or press C (CO-L-02).

Notes -
	* There are three steps (Company Details, Admin Account, Plan) and then a Review screen.
	* The user can move between steps freely using the rail or by scrolling past the end of a step. Only the Continue and Create buttons are blocked when a step is incomplete.
	* Nothing is saved until the user clicks Create Company on the Review screen.
	* What happens after Create depends on the plan and payment method. Only a new Automatic subscription shows a screen afterwards (it shows the Stripe link). Every other option goes back to the list with a toast.

Step 1 - Company Details
	ID	Scenario	Reach	See	Then
	CO-C-01	Step opens	E1	Defaults: Country = United States, Tax Status = Taxable, Assigned CSM = Unassigned, Assigned Sales Rep = the logged-in user	
	CO-C-02	Required field empty	Company Name or Zipcode is empty	Continue is disabled and its tooltip names the first missing field. ⌘↵ does nothing. The error message shows in the label row once the field loses focus or the user leaves the step.	
	CO-C-03	Zipcode rules	Any country	Zipcode is required unless the country has no postal codes (Example: UAE). The format is checked per country. Example: US is 5 or 9 digits, Canada is "A1A 1A1", UK is "SW1A 1AA".	
	CO-C-04	US zip auto-fill	Type 5 digits in Zipcode	Country is set to United States, and State and City are filled in. The user can still change all three.	
	CO-C-05	Step left incomplete	Move to another step with a required field empty	A red marker shows on that step in the rail	
	CO-C-06	Product Config link	Industries or Partnership › Product Config	If anything has been changed, the leave guard shows (CO-C-50)	Product Config

Step 2 - Admin Account
	ID	Scenario	Reach	See	Then
	CO-C-10	Required field empty or invalid	Name or Email is empty, or Email is not a valid email	Continue is disabled, same as CO-C-02	
	CO-C-11	Phone	Type a phone number	Optional. Shown as (XXX) XXX-XXXX. Stored with the country dial code.	

Step 3 - Plan
Notes -
	* The price is never typed in. The user picks it from the saved prices for the selected cycle and currency.
	* The price fills in automatically with the Default Rate whenever Tier, Cycle, Currency or Plan is changed.
	* A custom rate must first be saved as a price using Create New Price (22.3 Custom Rates).
	ID	Scenario	Reach	See	Then
	CO-C-20	Step opens	Step 3	Defaults: Subscription, Growth, Monthly, USD, Automatic, 1 seat. Price = the Default Rate for this combination.	
	CO-C-21	Tier, Cycle, Currency or Plan changed	Change any of them	Price resets to the Default Rate for the new combination	
	CO-C-22	Pick a saved price	Open the Price field	Lists the saved prices for this Cycle that have a rate in this Currency. Can be searched by amount or name.	Create New Price → CO-C-23
	CO-C-23	Create New Price	From CO-C-22	Name is optional. Cycle defaults to the current one. Starts with a USD row and a CAD row. Create is enabled once any row is above 0. The last row cannot be removed. Add Currency is disabled once every currency is listed.	Create → the new price is selected. If it is on the other Cycle, the Cycle switches to match.
	CO-C-24	Price not saved	The amount does not match any saved price	Continue is blocked with "Save the custom price before creating the subscription."	
	CO-C-25	Seats empty or 0	Clear the stepper or enter 0	Continue is blocked. There is no maximum.	
	CO-C-26	Cost preview	Any valid subscription	"Today" shows rate × seats, prorated up to the next 1st of the month. Below it, "<1st of next month> Onwards" shows the full cycle amount (22.5). If there is no rate, Per Seat shows "—" and there is no timeline.	
	CO-C-27	Free Trial	Plan = Free Trial	No other fields. The trial length comes from Admin Settings (4.4).	
	CO-C-28	Free Access	Plan = Complimentary Free Access	Access End Date is required and must be after today	

Review and Create
	ID	Scenario	Reach	See	Then
	CO-C-30	Review screen	Click Review Details	Read-only cards for each step, each with a pencil. Nothing is saved yet.	Pencil → that step, with all values kept. Back → Step 3. Create Company → one of CO-C-31 to CO-C-34
	CO-C-31	Create with Subscription + Automatic	Create on CO-C-30	The payment link is copied and the toast "Payment Link Copied" shows. A "Company Created" screen shows the Stripe Checkout link (22.7). The company is Pending Payment Setup (CO-L-32).	Done → list. No toast.
	CO-C-32	Create with Subscription + Invoice	Create on CO-C-30	Back to the list with the toast "Company Added". The company is Active (CO-L-30).	
	CO-C-33	Create with Free Trial	Create on CO-C-30	Back to the list with the toast "Company Added". The company is Free Trial (CO-L-33).	
	CO-C-34	Create with Free Access	Create on CO-C-30	Back to the list with the toast "Company Added". The company is Free Access (CO-L-35).	

Leaving the Wizard
	ID	Scenario	Reach	See	Then
	CO-C-50	Leave with changes	Cancel, the sidebar, browser Back or CO-C-06 after any field was changed	"Discard this Company?" / "This Company hasn't been created yet — everything you've filled in will be lost." Buttons: Discard (red), Keep Editing.	Discard → list
	CO-C-51	Leave without changes	Same exits, but every field still has its starting value (spaces count as empty)	No prompt	
	CO-C-52	Leave from Company Created	Any exit on the CO-C-31 screen	No prompt	


X.4 Edit Company Details

Entry Points -
	E1	Row hover › Edit, row ⋯ › Edit Company Details, or Edit in the preview panel.

Notes -
	* This is Step 1 of the wizard on its own.
	* Save only changes Name, Tax Status, CSM, Sales Rep, Industries, Partnership and Address. The plan, status and Account Holder are never changed from here.
	ID	Scenario	Reach	See	Then
	CO-E-01	Page opens	E1	No rail and no Back button. Save Changes is disabled with the tooltip "No changes to save".	
	CO-E-02	A field is changed	Edit any field	Save Changes is enabled as long as the step is valid. If the value is put back, Save is disabled again.	Save → list with the toast "Company Updated"
	CO-E-03	Leave with changes	Any exit after CO-E-02	"Discard unsaved changes?" Buttons: Discard, Keep Editing.	


X.5 Manage Subscription

Entry Points -
	E1	Row hover › Manage Subscription (not shown for Pending Payment Setup), or row ⋯ › Manage Subscription.

Notes -
	* This is Step 3 of the wizard on its own, filled in with the company's current plan.
	* Some options are locked depending on the company's current state:
	* A company cannot be put back on a Free Trial.
	* A company cannot be given Free Access while it has an active subscription or a cancellation that has not taken effect yet (22.2 Complimentary Access).
	* Payment cannot be switched to Automatic from here. The company does this from its own Dashboard (22.7 Method Switching).
	* The seat count cannot be changed from here. Companies add and remove seats from their Dashboard (22.4 Seats).
	* For Active and Past Due companies, a preview shows whether the change applies today or at the end of the cycle. This follows 22.6 Plan Changes.

Locked Options
	ID	Scenario	Reach	See	Then
	CO-S-01	Page opens	E1	Titled "Manage Subscription". Save Changes is disabled.	
	CO-S-02	Free Trial locked	The company is not on a Free Trial now, or its trial has expired	The Free Trial option is disabled	
	CO-S-03	Free Access locked	The company is Active, Past Due or has a cancellation scheduled	The Free Access option is disabled	
	CO-S-04	Automatic payment locked	The company pays by Invoice	Automatic is disabled with the text "Companies can switch to automatic payment via the Billing Tab of their Dashboard."	
	CO-S-05	Seats locked	The company is on any Subscription status	Seats is disabled with the text "Seat count is set when the company is created and can't be changed here."	
	CO-S-06	Seats open	The company is Free Trial, Trial Expired, Free Access or Free Access Ended, and Plan is switched to Subscription	Seats can be edited	

Preview and Save
	ID	Scenario	Reach	See	Then
	CO-S-10	Change applies today	Active or Past Due, and one of: only Payment changed; Cycle changed to Annual without a Tier downgrade; Cycle changed to Monthly with a Tier upgrade; or the total does not go down	Each changed row is labelled (Example: "Tier upgrade", "Monthly → Annual", "Currency USD → CAD", "Price increase", "Seats added", "Payment method update"). Shows "Applies Today". The charge today = (new monthly amount − old monthly amount, never below 0) × the part of the cycle that is left.	
	CO-S-11	Change applies at cycle end	Active or Past Due, any other change	The changed rows with "At Cycle End". No proration.	
	CO-S-12	Free Access end date changed	Free Access company, new end date	Shows the old date → new date, with "extended" or "shortened"	
	CO-S-20	Save	Click Save Changes	A confirm listing the changed rows and one line saying when the change applies	Confirm → list with the toast "Subscription Updated" → CO-S-21
	CO-S-21	Status after save	From CO-S-20	Past Due and Pending Payment Setup stay as they are. Free Trial → Free Trial. Free Access → Free Access. Any Subscription → Active. This also removes a scheduled cancellation.	
	CO-S-22	Leave with changes	Any exit after a change	"Discard unsaved changes?"	


X.6 Pop-ups

Change Account Holder
	ID	Scenario	Reach	See	Then
	CO-X-01	Pop-up opens	Row ⋯ › Change Account Holder	Shows "Current: <name>" (hover shows the details card). Two options: "Change the Account Holder" (default) and "Remove from Company & Replace". The New Account Holder list shows the company's employees except the current holder. Admins and Managers have a role tag. Can be searched by name or email. Names are shown as "name (email)" only when two employees have the same name. Save Changes is disabled.	
	CO-X-02	Employee picked	Pick an employee	Save Changes is enabled	Save → the name, email and phone are replaced. With "Remove from Company & Replace", the old holder is also removed from the company. No toast.

Manage Billing Emails and View Invoices
	ID	Scenario	Reach	See	Then
	CO-X-03	Pop-up opens	Row ⋯ › either item	Shows the steps to follow on Stripe. "Open Stripe" opens Stripe in a new tab and the pop-up stays open (22.7, 22.11).	Cancel, ✕ or Esc closes it

Cancel Subscription
Notes -
	* Cancellation always takes effect at the end of the current billing cycle, never immediately (22.8).
	* The first screen explains what the company keeps until then and shows any money still owed. The second screen is the confirmation.
	ID	Scenario	Reach	See	Then
	CO-X-04	Active company	Row ⋯ › Cancel Subscription on CO-L-30	Text: "…keeps full access until the end of the current billing cycle (<date>)". A reason must be picked (22.8). The Outstanding Balance card is shown only if seats were added this cycle and have not been invoiced yet.	Continue → CO-X-06
	CO-X-05	Past Due company	Same on CO-L-31	Text: "…is N days past due… Access is cut off on <date> if the outstanding invoice goes unpaid." The Outstanding Balance = the unpaid invoice + any seats not yet invoiced.	Continue → CO-X-06
	CO-X-06	Are you sure?	Click Continue	Button "Yes, Cancel Subscription". If there are seats not yet invoiced, the text adds ", apart from ~$X in pending seat charges". Go Back, ✕, clicking outside and Esc close both pop-ups.	Confirm → CO-X-07
	CO-X-07	Canceled	Click Confirm	Back to the list with the toast "Subscription Canceled". The row changes to CO-L-37, with the date set to the next renewal.	


X.7 What the Prototype Does Not Cover
	* "Today" in the prototype is fixed at 24 Jun 2026. Every date-based scenario above counts from that date.
	* Statuses, billing cycles, seats used, Last Access, employees and Stripe links are generated from the company id. None of it is real data.
	* Company ids are "CO-<count + 1>". The trial length, the CAD exchange rate and the saved price list are hard-coded. The real values come from 4.4 and 22.3.
	* Changes are kept in memory only and are lost on reload.
	* View Company Dashboard opens a placeholder page.
