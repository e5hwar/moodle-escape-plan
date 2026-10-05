import { subscriptionText, type User } from "../data/users";
import type { StatusPillTone } from "../data/companies";

/* A user's Subscription as a status pill (Table Pills, Figma 109:1237) — the
   Companies status column's tones, mapped by the user 2026-10-04: Subscriber
   green "Monthly · Apple" (billing cycle · platform), Free Trial yellow with
   its end date (B2B's "Free Trial Ends …"), Scholarship the B2B Free Access
   grey-white, Company Plan purple (109:1238), Cancelled grey like B2B's
   Canceled — "Cancels …" while the paid period runs — and Starter grey like
   B2B's Trial Ended. The wording is `subscriptionText`, shared with the
   modals that show it as plain text.

   Full-page tables only (Users, Who Paid); the cell needs `.col-status`,
   which re-enables the pill chrome past the plain-text column rule. */
function subscriptionPill(user: User): { tone: StatusPillTone; label: string } {
  const label = subscriptionText(user);
  switch (user.subscriptionStatus) {
    case "Subscriber":
      return { tone: user.cancelsOn ? "grey" : "green", label };
    case "Free Trial":
      return { tone: "yellow", label };
    case "Scholarship":
      return { tone: "secondary", label };
    case "Company Plan":
      return { tone: "purple", label };
    case "Cancelled":
    case "Starter":
      return { tone: "grey", label };
  }
}

export function SubscriptionPill({ user }: { user: User }) {
  const { tone, label } = subscriptionPill(user);
  return <span className={`co-status-pill co-status-pill--${tone}`}>{label}</span>;
}
