# X. Companies

Prototype Link: [Companies](PROTOTYPE_URL/companies)

## X.1 How It Works (Read First)

### Overview

Companies is where SkillCat staff (Admins, Sales and Customer Success) manage B2B customers. A **company** is a business that buys SkillCat seats for its employees. From this page staff can find a company, see its subscription health, create a new company, change its details, plan or Account Holder, and cancel its subscription.

The page exists only in internal admin mode. Company admins manage their own account from their Company Dashboard, not from here.

Subscription pricing and billing policy is owned by the B2B Subscriptions & Billing section. This section repeats a billing rule only where it changes what the admin sees or can do.

### Terms

- **Account Holder:** the person who owns the company's account. Their email is the Stripe billing email, and they are the company's first Admin.
- **Plan:** how the company gets access. There are three: Subscription (paid), Free Trial and Complimentary Free Access.
- **Tier:** which paid plan a Subscription is on: Essentials, Growth or Professional, cheapest first. Only a Subscription has a tier.
- **Seat:** one paid licence that can be assigned to one employee.
- **Billing cycle:** Monthly or Annual. Every company is billed on the 1st. A monthly cycle ends on the next 1st of the month. An annual cycle ends on the 1st of its renewal month.
- **Per-seat price:** what one seat costs per cycle, in the company's billing currency. An annual price is a yearly amount.
- **Saved price:** a per-seat price that exists in the Stripe price catalogue. A subscription can only use a saved price.
- **Payment link:** a Stripe link the Account Holder opens to add a payment method. It stays valid for 24 hours.
- **Grace period:** how long a Past Due company keeps access. It runs 60 days from the unpaid invoice's due date.

### Page Model

Every company has exactly one **status**. The status decides which columns have values, which actions are offered and which plan changes are allowed. Status names are the same everywhere they appear: the status pill, the Status filter and the search suggestions.

| Status | What it means | Billed | Has access |
|---|---|---|---|
| Active | Paid subscription in good standing. | Yes | Yes |
| Pending Payment Setup | Created on automatic payment. The plan is fully set up, but the Account Holder has not yet added a payment method through the payment link. Nothing has been charged. Becomes Active when the payment method is added. | Yes | No |
| Past Due | The latest invoice is unpaid past its due date. Becomes Active when it is paid. | Yes | Until the grace period ends |
| Free Trial | A trial with no plan and no payment method. Trial length is set in Product Config (default 14 days). | No | Yes |
| Trial Expired | A trial that ended without converting. | No | No |
| Free Access | Complimentary access with the same features as the Professional tier, up to a set end date. | No | Yes |
| Free Access Ended | Free Access whose end date has passed. This status is derived from the end date: no one sets it by hand. | No | No |
| Canceled | A subscription that was cancelled. Before its effective date the status reads "Cancels" with the date, and the company keeps access. On and after that date it reads Canceled. | Yes | Until the effective date |

**Billed statuses** are Active, Pending Payment Setup, Past Due and Canceled. Only these have a Tier, Seats, Seat Changes, Billing Cycle, Payment Method and Price. For every other status those values are empty. A Canceled company counts as billed because it was billed up to its effective date.

### Where This Is Used

- **Users page:** the "View User's Company" action on a B2B user opens Companies already searched to that user's company. "View All Employees" on a company opens Users filtered to that company.
- **Product Config › B2B Management:** owns the Industries, Partnerships and Cancellation Reasons lists, and the Free Trial length. Links on the company forms and the Cancel Subscription dialog go there.
- **Company Dashboard:** what the company's own Admins and Managers use. Its last visit drives the Last Access column. Companies can switch themselves from Invoice to automatic payment there.
- **Stripe:** owns payment methods, invoices, billing email recipients and the price catalogue.

## X.2 Companies List

Prototype Link: [Companies](PROTOTYPE_URL/companies)

### Overview

The list of every company, with its status and plan. Staff use it to find a company, spot accounts that need attention (Past Due, trials ending), and open actions on a company. The table follows the shared table pattern (see Shared Patterns, Data Tables), including Edit Columns, sorting and paging. Company and Status are fixed columns. Every other column is optional.

### Data Needed

| Column | Source / rule |
|---|---|
| Company | Company record. |
| Status | Derived as described in X.1. A Free Access company past its end date shows Free Access Ended, and a cancellation shows Cancels or Canceled based on today's date. |
| Account Holder | The Account Holder's email. |
| Tier | Plan record. Empty for non-billed statuses. |
| Seats | Total paid seats. Empty for non-billed statuses. |
| Seat Changes | Net seats added or removed **inside the selected Date Range**, from the company's seat change history. No movement in the range shows empty. Empty for non-billed statuses. |
| Sign-Up Method | Self (the company signed itself up) or Internal (SkillCat staff created it). |
| Billing Cycle, Payment Method | Plan record. Empty for non-billed statuses. Past Due still shows its payment method, since that is the method that failed. |
| Industries, Partnership | Company record. Both can hold several values. The cell shows the first value plus a count of the rest. Hovering lists all of them. |
| Created On | Date the company was created. |
| Canceled On | Date a cancellation took effect. Empty while a cancellation is still scheduled. |
| Trial End Date | Only for Free Trial companies. |
| Price | Per-seat price with its currency, per billing cycle. Empty for non-billed statuses. |
| Assigned Sales Rep, Assigned CSM | Company record. Empty when no one is assigned. |
| Last Access | The last time any Admin or Manager at the company opened the Company Dashboard. Shows "Never" if no one has. A Pending Payment Setup company cannot reach the dashboard yet, so it reports the day it was created. |
| Header counts | Total number of companies, plus the number of Past Due companies. Both count every company, not just the filtered rows. The Past Due count is hidden when it is zero. |
| Filter values | Tier and Status: fixed lists. Industries and Partnership: every value any company carries, plus "None". More Filters: Sign-Up Method, Billing Cycle, Payment Method, Assigned CSM and Assigned Sales Rep, each from its fixed list or the list of internal staff in that role. |

### Important Behaviors

#### Opening the page

- From the sidebar, the page opens with no search and no filters, Date Range set to Last 30 Days, and rows sorted by Last Access with the most recent first. Companies that have never opened the dashboard sort last.
- From the Users page ("View User's Company"), the page opens with that company's name already searched, scrolled straight to the table.
- After Create Company, Edit Company Details or Manage Subscription finishes, the page opens in its default state and confirms the result with a toast. Search, filters, sort, columns and page are not remembered between visits.

#### Search

Follows the shared search bar pattern (see Shared Patterns, Search). Company-specific rules:

- Free text matches company name, Account Holder email, Industries, Partnership and Tier.
- Search runs when the admin presses Enter. It does not filter while typing.
- While typing, the panel suggests matching Tier, Status, Industries and Partnership values (up to 6). Picking one adds it to that filter instead of searching.
- Typing a filter name followed by a colon ("Tier:", "Status:", "Industries:", "Partnership:", any case) lists that filter's values with how many companies have each. Values already applied are left out. Picking a value adds it to the filter and clears the box, so another value can be picked.
- For Industries and Partnership, a company is counted under every value it has. These counts can add up to more than the total number of companies.
- Clearing the search does not clear filters.

#### Filters

Follows the shared filter pill pattern (see Shared Patterns, Filters). Company-specific rules:

- Industries and Partnership match a company that has **any** of the picked values. "None" matches companies with no value set.
- Tier, Billing Cycle and Payment Method only match billed companies. Picking any value in them hides every Free Trial, Trial Expired, Free Access and Free Access Ended company.
- Status matches the derived status. For example, a Free Access company past its end date matches Free Access Ended, not Free Access. "Canceled" includes cancellations that are still scheduled.
- **Date Range does not filter rows.** It only sets the window the Seat Changes column counts. It always has a value and cannot be removed. Clear Filters leaves it alone.
- Changing the search, a filter, the sort or the Date Range returns the table to page 1.

#### Sorting

- Tier sorts by plan level (Essentials, Growth, Professional), with companies that have no tier last.
- Seats and Seat Changes sort companies with no seat count below every real value, including zero and negative changes.
- Industries and Partnership sort on the first value shown. Blank values sort last, and so do unassigned Sales Rep and CSM values.
- Account Holder cannot be sorted.

#### Hover details

- Hovering the Account Holder email shows that person's name, email and phone. From there their full profile opens in a new tab.
- Hovering a Past Due status shows how many days it is past due and the date the company loses access.
- Hovering a Canceled or Cancels status shows the cancellation reason(s).

#### Row actions

- Clicking a row opens the Company Preview Panel (X.3).
- The row's quick action is View Company Dashboard. Pending Payment Setup rows have no quick action, only the menu.
- The row menu's items depend on status. See X.4.
- Pressing C opens Create Company. It does nothing while the cursor is in a text field or the preview panel is open.

### States

- **Loading:** the table shows the shared skeleton state until the company list arrives. (not reflected in prototype. needs to be updated)
- **No companies at all:** the table shows an empty state with Create Company as the recovery action. (not reflected in prototype. needs to be updated)
- **No results:** the shared empty table state, with a Clear Filters action when filters are applied and a clear-search action when a search is applied. (not reflected in prototype. needs to be updated)
- **Load error:** the table shows an error state with a retry action. (not reflected in prototype. needs to be updated)

### Edge Cases

- A company with several Industries matches an Industries filter on any one of them, and counts once in the result total.
- A Seat Changes value can be negative (the company gave up seats). A company's seat changes in any range all go the same way.
- A cancellation whose effective date passes while the page is open shows the new status on the next load. It does not update live.
- A Free Trial whose status pill carries a date always shows the full date including the year.

### Acceptance Criteria

- The header counts all companies and all Past Due companies, whatever the search or filters.
- Opening the page from the sidebar shows every company, sorted by most recent Last Access, with never-accessed companies last.
- Opening from a user's "View User's Company" shows that company already searched.
- Typing in search does not change the rows until Enter is pressed.
- Typing "status:" lists every status not already applied, each with its company count.
- Picking a Tier, Billing Cycle or Payment Method value never shows a Free Trial, Trial Expired, Free Access or Free Access Ended company.
- Picking "None" in Industries shows only companies with no industry.
- Changing the Date Range changes Seat Changes values but never the number of rows.
- Clear Filters resets every filter except Date Range and leaves the search as it was.
- Tier, Seats, Seat Changes, Billing Cycle, Payment Method and Price are empty for every non-billed status.
- Canceled On is empty for a cancellation that has not taken effect yet.
- Pressing C with focus outside a text field and the preview panel closed opens Create Company.

## X.3 Company Preview Panel

Prototype Link: [Companies](PROTOTYPE_URL/companies) › click any row

### Overview

A read-only summary of one company that opens from its row. It lets staff check a company without leaving the list. It follows the shared row preview panel pattern (see Shared Patterns, Row Preview Panel).

### Data Needed

- Seats in use (seats assigned to employees), out of total seats.
- Free seats: total minus in use, never below zero.
- Days since the company's last dashboard visit (same source as the Last Access column), or "Never".
- Overview: status, sign-up method, created date, dashboard last access.
- The same Company Details, Account Holder and Subscription summaries shown on Create Company's Review step (X.5). Blank fields show as empty rather than being hidden. Subscription fields that do not apply to the plan are left out.

### Important Behaviors

- The panel's menu offers the same actions as the row menu (X.4). Picking an action that opens a dialog or another page closes the panel first.
- The panel follows the company through updates: if an action changes the company, the panel shows the new values.
- Pressing Escape closes an open menu first, then the panel.

### Acceptance Criteria

- Clicking a row opens the panel for that company. Clicking a row's menu or quick action does not.
- Free seats never shows a negative number.
- Picking Manage Subscription from the panel's menu closes the panel and opens Manage Subscription.

## X.4 Company Actions

Prototype Link: [Companies](PROTOTYPE_URL/companies) › row menu

### Overview

The actions staff can take on a company, from the row menu or the preview panel's menu. Which actions appear depends on the company's status, so staff are only offered actions that make sense for it.

### Data Needed

- Company status (X.1).
- The company's employees and their roles (Admin, Manager, Employee), for Change Account Holder.
- The company's outstanding balance, for Cancel Subscription.
- The company's Stripe customer record, for billing emails and invoices.
- Cancellation reasons, from Product Config › B2B Management.

### Important Behaviors

#### Which actions each status gets

| Action | Shown for |
|---|---|
| Edit Company Details | Every status |
| Copy Payment Link | Pending Payment Setup only |
| Delete Company | Pending Payment Setup only |
| Manage Subscription | Every status except Pending Payment Setup |
| Change Account Holder | Every status except Pending Payment Setup |
| Manage Billing Emails | Active and Past Due only. Other statuses are not invoiced and will not be again. |
| View Invoices | Every status except Pending Payment Setup, Free Trial and Trial Expired. Free Access and Canceled companies keep their past invoices. |
| View All Employees | Every status except Pending Payment Setup |
| View Company Dashboard | Every status except Pending Payment Setup |
| Cancel Subscription | Active and Past Due only |

A Pending Payment Setup company has no subscription, invoices or employees yet. It only gets the three actions that apply: fix its details, send the payment link again, or delete it.

#### Edit Company Details

Opens the Edit Company Details page (X.6).

#### Manage Subscription

Opens the Manage Subscription page (X.7).

#### Change Account Holder

- The admin chooses one of two outcomes:
  - **Change the Account Holder:** ownership moves to another employee. The current holder stays in the company as an Admin.
  - **Remove from Company & Replace:** the current holder is removed from the company entirely, and the new holder takes over.
- The new holder must already be an employee of this company. The current holder is not offered. Admins and Managers are marked with their role. Employees can be found by name or email.
- Someone who is not yet in the company has to be added to it before they can become the Account Holder.
- Save is disabled until an employee is picked.
- After saving, the Account Holder column and preview panel show the new holder, and a toast confirms it.

#### Manage Billing Emails

Billing email recipients live in Stripe. The dialog lists the steps to add or remove recipients in Stripe, and opens the company's Stripe customer record (found by the Account Holder's email) in a new tab.

#### View Invoices

Invoices live in Stripe. The dialog opens the company's invoices in Stripe in a new tab.

#### View All Employees

Opens the Users page filtered to this company. While filtered to one company, Users lists Admins first, then Managers, then Employees.

#### View Company Dashboard

Opens the company's Company Dashboard in a new tab.

#### Copy Payment Link

Copies the company's payment link and confirms with a toast. If the earlier link has expired (after 24 hours), a new valid link is generated and copied. (not reflected in prototype. needs to be updated)

#### Delete Company

- Only for Pending Payment Setup, because nothing has been billed and there is nothing to unwind.
- Deleting permanently removes the company and the Account Holder's invitation. The payment link already shared stops working.
- Uses the shared double confirmation for destructive actions (see Shared Patterns, Confirmations).

#### Cancel Subscription

- Cancelling always takes effect at the **end of the current billing cycle** (the next billing date), never immediately. The company is not billed again after that date.
- For an Active company, the dialog says the company keeps full access until that date.
- For a Past Due company, the dialog says how many days past due it is, and that access is cut off at the end of the grace period if the invoice stays unpaid. That can be before the cancellation date.
- **Cancellation Reason** is optional. The admin can pick more than one. The list is managed in Product Config › B2B Management.
- **Outstanding Balance** appears only when the company owes something. It is the sum of:
  - the unpaid invoice, for a Past Due company (one cycle's charge), and
  - prorated charges for seats added during the current cycle.
  Seats removed during the cycle give no credit. Cancelling ends the subscription, not the debt: the balance is still billed at the end of the period.
- Continuing asks for a second confirmation, which repeats the end date and, if seats were added this cycle, the pending seat charge.
- After confirming: the status reads "Cancels" with the effective date, the reason(s) show when hovering the status, and a toast confirms it. On the effective date the status becomes Canceled and Canceled On fills in.

### Edge Cases

- **Change Account Holder with no other employees:** there is no one to pick and Save stays disabled. The admin has to add an employee first.
- **Two employees with the same name:** the picker shows each with their email so they can be told apart.
- **Cancel with no balance:** the Outstanding Balance section does not appear at all.
- **Cancel a company that is already scheduled to cancel:** not possible. Cancel Subscription is only offered for Active and Past Due.

### Validation Rules

- Change Account Holder needs a new holder picked before Save works.
- Cancel Subscription has no required fields.

### Acceptance Criteria

- A Pending Payment Setup company's menu shows only Edit Company Details, Copy Payment Link and Delete Company.
- A Free Trial company's menu has no Manage Billing Emails, View Invoices or Cancel Subscription.
- A Canceled company's menu has View Invoices but no Manage Billing Emails or Cancel Subscription.
- Change Account Holder never offers the current holder or anyone outside the company.
- With "Change the Account Holder", the old holder is still in the company as an Admin after saving. With "Remove from Company & Replace", the old holder is no longer in the company.
- Cancelling an Active company sets its status to "Cancels" with the date of the next billing cycle end. The company keeps access until then.
- Cancelling a Past Due company that had seats added this cycle shows an Outstanding Balance equal to the unpaid invoice plus the prorated seat charges.
- Deleting a Pending Payment Setup company removes it from the list and needs two confirmations.
- View All Employees lands on Users showing only that company's employees.

## X.5 Create Company

Prototype Link: [Companies](PROTOTYPE_URL/companies) › Create Company

### Overview

A three-step wizard that sets up a new company: its details, its Account Holder, and its plan. A Review step follows, and nothing is saved until the admin confirms there. It follows the shared wizard pattern (see Shared Patterns, Wizards), including the step list, step errors, keyboard shortcuts and the unsaved-changes prompt.

### Data Needed

- **Company Details:** company name, address (country, two address lines, city, zipcode, state), tax status, industries, partnerships, Assigned CSM, Assigned Sales Rep.
- **Admin Account:** Account Holder name, email, phone.
- **Plan:** plan type. For a Subscription: tier, billing cycle, currency, per-seat price, seats and payment method. For Free Access: end date.
- **Lists:** Industries and Partnerships from Product Config › B2B Management. CSMs and Sales Reps are the internal staff in those roles. Countries and states come from the standard country list. Tax statuses are Taxable, Tax Exempt and Reverse Charge, as Stripe defines them.
- **Prices:** the Stripe saved price catalogue, and the default per-seat rate for each tier, cycle and currency (owned by B2B Subscriptions & Billing). Default rates exist for USD and CAD. An annual price is ten months' worth of the monthly price.
- **Free Trial length:** from Product Config › B2B Management (default 14 days).

### Important Behaviors

#### Company Details

- The company name is the name shown on Stripe receipts.
- Country defaults to United States. Entering a complete US zipcode fills in the state and city. Both stay editable.
- Tax Status defaults to Taxable.
- Assigned Sales Rep defaults to the staff member creating the company. Assigned CSM starts unassigned. Both can be left unassigned.
- The Industries and Partnership links go to Product Config. They trigger the unsaved-changes prompt like any other way of leaving.

#### Admin Account

- The Account Holder's email becomes the Stripe billing email and the company's first Admin account.

#### Plan

- **Subscription** is selected by default, with the Growth tier, Monthly cycle, USD, the default price for that tier, 1 seat and automatic payment.
- **Free Trial** needs no payment method. It lasts the configured trial length.
- **Complimentary Free Access** needs an end date. Shortcuts offer 1 week, 1 month, 3 months, 6 months and 1 year from today.
- **Per-seat price:**
  - The price is picked from saved prices. Only prices on the selected billing cycle that have a rate in the selected currency are offered.
  - Changing tier, cycle or currency resets the price to that tier's default rate. For a currency with no default rate, the price is cleared and has to be picked.
  - A price that does not match a saved price blocks saving until it is saved as a new price.
  - "Add New Price" opens Create New Price (see below). The new price is selected straight away. If it was created on the other billing cycle, the form switches to that cycle.
- **Payment method:**
  - **Automatic:** the company pays by card or bank on file, collected through the payment link.
  - **Invoice:** the company is emailed an invoice and has 30 days to pay.
- **Preview:** a summary of the plan being set up and what will be charged:
  - **Subscription:** a prorated charge today for the rest of the current month, then the full charge from the next 1st onward. For an annual plan, today's charge is the prorated monthly equivalent, and the yearly charge starts on the 1st. With no price picked yet, the preview lists the plan but shows no charges.
  - **Free Trial:** nothing charged, and the date the trial ends.
  - **Free Access:** nothing charged, and the end date once one is picked.

#### Create New Price

- Creates a price in the Stripe catalogue. Once created, it can be picked for any company, not just this one.
- Name is optional and internal only. Customers never see it.
- The admin picks the billing cycle and enters a per-seat rate for one or more currencies. USD and CAD rows are there to start with. Others can be added, and any row except the last one can be removed.
- Rates are not converted between currencies, and they do not update if exchange rates change.

#### Review and finish

- Review shows every entered value, grouped by step. Blank optional fields show as empty, so gaps are visible. Each group can jump back to its step.
- Confirming on Review creates the company:
  - **Subscription with automatic payment:** status becomes Pending Payment Setup. A confirmation page shows the payment link, which is already copied to the clipboard. The Stripe subscription and the Company Dashboard turn on once the Account Holder adds a payment method. Done returns to the list with a toast.
  - **Subscription with Invoice:** status becomes Active. Returns to the list with a toast.
  - **Free Trial:** status becomes Free Trial. Returns to the list with a toast.
  - **Free Access:** status becomes Free Access. Returns to the list with a toast.
- The new company's Created On is the day it was created. Its Sign-Up Method is Internal.

### States

- **Copy blocked:** if the browser refuses the automatic copy, the payment link is still shown and can be copied by hand.
- **Create fails:** the admin stays on Review with their entries kept, and an error explains that the company was not created. (not reflected in prototype. needs to be updated)

### Edge Cases

- A country that does not use postal codes makes the zipcode optional.
- Picking a currency with no published default rate leaves the price empty until a saved price is picked. The price hint still quotes the USD default.
- Two saved prices with the same rate and name appear once in the price list.
- Moving from step to step is never blocked. A step left with a required field missing is flagged in the step list, and its Continue stays disabled.

### Validation Rules

| Field | Rule |
|---|---|
| Company Name | Required. 128 characters at most. |
| Address | Country required. Zipcode required unless the country does not use postal codes, and must match that country's format. Every other address field is optional. |
| Tax Status | Required (always has a value). |
| Account Holder | Required. 128 characters at most. |
| Email | Required. Must be a valid email address. (not reflected in prototype. needs to be updated) |
| Phone | Optional. |
| Per-Seat Price | Required for a Subscription. Must be a saved price on the selected cycle and currency. |
| Seats | Required for a Subscription. At least 1. |
| Access End Date | Required for Free Access. |
| Create New Price | At least one currency with a rate above 0, two decimal places at most. Name 128 characters at most. |

While a step has a problem, its Continue (or Review Details) button is disabled. Hovering it names the first problem, in page order.

### Acceptance Criteria

- Nothing is saved before Create Company is confirmed on Review. Cancelling at any earlier point leaves no company behind.
- Leaving with unsaved entries asks for confirmation. Leaving an untouched wizard does not.
- Entering a valid 5-digit US zipcode fills in state and city.
- Switching the tier from Growth to Professional resets the per-seat price to the Professional default for the selected cycle and currency.
- A per-seat price that is not a saved price disables Review Details.
- A price created on the Annual cycle while Monthly is selected switches the form to Annual, with the new price selected.
- Creating an automatic-payment subscription shows the payment link page and the company's status is Pending Payment Setup.
- Creating with Invoice, Free Trial or Free Access returns to the list with a toast, and the company has the matching status.
- Free Access cannot be created without an end date.

## X.6 Edit Company Details

Prototype Link: [Companies](PROTOTYPE_URL/companies) › row menu › Edit Company Details

### Overview

A single page for changing a company's identity and grouping details. It uses the same fields and rules as Create Company's Company Details step (X.5).

### Data Needed

The company's current details, as listed for the Company Details step in X.5. A company whose CSM or Sales Rep came from an earlier assignment shows that person, not Unassigned.

### Important Behaviors

- Saving changes only the company details. The plan, billing, status and Account Holder are not touched. Those change through Manage Subscription and Change Account Holder.
- Save Changes stays disabled until something differs from what was loaded. Putting a value back to its original disables it again (see Shared Patterns, Save Changes).
- Saving returns to the list with a toast.

### Validation Rules

Same as the Company Details fields in X.5.

### Acceptance Criteria

- Opening the page and saving nothing is not possible: Save Changes is disabled until a field changes.
- Saving a new company name updates the list and the preview panel, and leaves status, plan and Account Holder unchanged.
- Leaving with unsaved changes asks for confirmation.

## X.7 Manage Subscription

Prototype Link: [Companies](PROTOTYPE_URL/companies) › row menu › Manage Subscription

### Overview

A single page for changing a company's plan. It has the same fields as Create Company's Plan step (X.5), plus a preview that shows what will change and what will be charged. It is how staff upgrade or downgrade a tier, change price or billing cycle, change the payment method, extend Free Access, or convert a trial or Free Access company to a paid subscription.

### Data Needed

- The company's current plan, status, tier, cycle, currency, per-seat price, seats, payment method, next billing date and Free Access end date.
- The saved price catalogue and default rates, as in X.5.
- Currency conversion rates, so totals in different currencies can be compared.

### Important Behaviors

#### Which plans can be chosen

| Current status | Subscription | Free Trial | Free Access |
|---|---|---|---|
| Free Trial | Yes | Yes (no change) | Yes |
| Trial Expired | Yes | No | Yes |
| Free Access, Free Access Ended | Yes | No | Yes |
| Active, Past Due | Yes | No | No: the subscription must be cancelled first |
| Canceled, still scheduled | Yes | No | No: the subscription is still running |
| Canceled, in effect | Yes | No | Yes |

A trial is only for companies before their first sale. Nothing moves a company back onto a trial. When a plan is unavailable, the page explains why.

#### Field locks

- **Seats** cannot be changed for a company already on a Subscription (Active, Past Due, Canceled). Seat counts change through seat management, not here. A company converting from a trial or Free Access sets its seats here.
- **Payment method:** an Invoice subscription cannot be switched to automatic payment from here. The company switches itself from its Company Dashboard. Staff can still switch a subscription from automatic to Invoice.

#### Preview

- Before anything changes, the preview shows the plan as it stands today.
- Once something changes, the preview shows every plan field. Fields that changed show old and new values. Fields that did not change show their current value. The recurring total is always shown.
- A timeline shows what is charged today and what is charged from the next cycle onward.

#### When a change applies (Active and Past Due subscriptions)

| Change | When it applies | Charged today |
|---|---|---|
| Raises the recurring total (tier upgrade, price increase) | Today | Prorated difference |
| Monthly to Annual, same or higher tier | Today | Prorated difference, if the total goes up |
| Annual to Monthly with a tier upgrade | Today | Prorated difference, if the total goes up |
| Currency change that does not lower the total | Today | Nothing (amounts are converted, not increased) |
| Lowers the recurring total (tier downgrade, price decrease) | At the end of the current cycle | Nothing. No refund. |
| Annual to Monthly without a tier upgrade, or Monthly to Annual with a downgrade | At the end of the current cycle | Nothing |
| Payment method only (automatic to Invoice) | Today | Nothing |

- **Prorated difference** = the increase in the monthly-equivalent recurring total × the share of the current cycle still left. Totals in different currencies are compared after conversion, so a higher number in a weaker currency is not treated as an increase.
- A scheduled change keeps the company on its current plan until the cycle ends.

#### Other plan changes

- **Free Access to Free Access:** only the end date can change. The preview says whether access is being extended or shortened. Nothing is charged.
- **Trial or Free Access to Subscription:** the preview shows the plan change and the new subscription's charges, the same way as creating one (X.5).
- **Converting to a Subscription with automatic payment** from a status with no payment method on file (Free Trial, Trial Expired, Free Access, Free Access Ended) sets the status to Pending Payment Setup, and hands over a payment link as Create Company does. (not reflected in prototype. needs to be updated)
- **A Canceled company saved on a Subscription** is reactivated, and its status becomes Active.

#### Saving

- Save Changes stays disabled until a plan field differs from what was loaded. Fields that only belong to a plan the admin looked at and then left do not count as a change.
- Saving opens a confirmation that repeats the preview's rows and states the effect: charged today, scheduled for cycle end, or nothing charged.
- Saving a Past Due company keeps it Past Due, because a plan change does not settle the unpaid invoice.
- After saving, the page returns to the list with a toast.

### Edge Cases

- Changing only the currency on a subscription converts the amounts and charges nothing today.
- A change that leaves the recurring total within about 1% of the current total counts as no change in price, so it applies today with nothing charged.
- Creating a new price here works as in X.5, and the price is available to every company.
- Leaving with unsaved changes asks for confirmation.

### Validation Rules

- Same as the Plan step in X.5: a saved per-seat price and at least 1 seat for a Subscription, and an end date for Free Access.
- At least one plan field must have changed.

### Acceptance Criteria

- An Active company cannot choose Free Trial or Free Access, and the page says why.
- A Trial Expired company can choose Subscription or Free Access, but not Free Trial.
- Seats cannot be edited for an Active, Past Due or Canceled company, but can be for a Free Access company converting to a Subscription.
- An Invoice subscription cannot be switched to automatic payment. An automatic one can be switched to Invoice, and the preview shows nothing charged.
- Upgrading Growth to Professional on a monthly plan shows a charge today equal to the monthly increase × the share of the month left.
- Downgrading a tier shows no charge today and says the change starts at the end of the cycle.
- Extending a Free Access end date shows the old and new dates and charges nothing.
- Saving a Past Due company leaves it Past Due.
- Save Changes is disabled on an untouched form, and again after every change has been undone.
