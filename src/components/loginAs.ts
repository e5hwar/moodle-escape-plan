import type { User } from "../data/users";

/* "Login As" — the admin impersonation session, from the Manage Users row menu
   and the Full Profile header. The learner app lives outside this prototype,
   so the action opens a PLACEHOLDER tab naming the user whose session it
   stands for (App.tsx renders it off `?loginAsUser=`), the same way the
   company-side "Open Company Dashboard" opens its `?loginAs=` stand-in. */
export function loginAs(user: User) {
  window.open(
    `${window.location.origin}${window.location.pathname}?loginAsUser=${encodeURIComponent(user.id)}`,
    "_blank",
    "noopener",
  );
}
