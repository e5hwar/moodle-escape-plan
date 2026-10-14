import { UserAvatar } from "./UserAvatar";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  APPLE_REFUND_NOTE,
  EPA_CANCEL_BLOCK,
  buildUserProfile,
  canCancelEpaOrder,
  cancelEpaOrder,
  purchaseRecordUrl,
  useEpaCancels,
  useRefunds,
  ZIP_LOCATIONS,
  type AwardRecord,
  type EpaCardOrder,
  type MeritTier,
  type NateDetail,
  type Purchase,
  type PurchaseKind,
  type SkillBadge,
} from "../data/userProfile";
import {
  cancelSubscriptionBlock,
  cancelSubscription,
  offersCancelSubscription,
  subscriptionText,
  updateUserContact,
  useUser,
  type User,
} from "../data/users";
import {
  approveIdRecord,
  idRecordForUser,
  replaceIdRecord,
  useIdDecisions,
} from "../data/manageIds";
import { useCompletions } from "../data/completions";
import { useScholarships } from "../data/scholarships";
import type { ConfirmField } from "./ConfirmCard";
import { loginAs } from "./loginAs";
import { leave, useTouchedKeys } from "./fieldFlags";
import { ConfirmCard } from "./ConfirmCard";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
import type { SortDir } from "./AwardTableParts";
import { NO_CHANGES_TIP, PrmModal } from "./PrmModal";
import { RowKebab, RowMenu, type RowMenuItem } from "./RowMenu";
import { IdModal, UploadIdModal } from "./IdModal";
import { LimitError } from "./CharCount";
import { LimitedInput } from "./LimitedInput";
import { NAME_MAX, isOver } from "../data/fieldLimits";
import {
  DownloadIcon,
  IdCardIcon,
  MenuCardOffIcon,
  MenuEnterIcon,
  MenuRefundIcon,
  RowEditIcon,
  RowKebabIcon,
  SortIcon,
  } from "./icons";
import { TableCols } from "./TableCols";
import { PhoneField } from "./PhoneField";
import { useToast } from "./useToast";
import { TableEmpty } from "./TableEmpty";
import { makeZip, type ZipEntry } from "../zip";

/* Award-tier colors survive only in the generated SVG downloads — on the page
   itself the tier renders as plain table text like every other column. */
const TIER_HEX: Record<MeritTier, string> = {
  Bronze: "#cd7f32",
  Silver: "#c4c7cc",
  Gold: "#e9b949",
  Platinum: "#7fd7d2",
};

function formatDate(iso?: string): string {
  if (!iso) return "";
  // Parse YYYY-MM-DD as local time so the date doesn't shift a day in TZs behind UTC.
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/* ── Download helpers — generate the Award Card / Certificate as an SVG file ── */
function downloadFile(filename: string, content: string | Blob, type: string) {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!),
  );
}

function awardCardSvg(userName: string, award: AwardRecord): string {
  const tier = TIER_HEX[award.meritTier];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
  <rect width="600" height="380" rx="20" fill="#161618"/>
  <rect x="8" y="8" width="584" height="364" rx="14" fill="none" stroke="${tier}" stroke-width="2"/>
  <text x="40" y="64" fill="${tier}" font-family="Arial" font-size="14" letter-spacing="3" font-weight="700">SKILLCAT AWARD · ${award.meritTier.toUpperCase()}</text>
  <text x="40" y="150" fill="#ffffff" font-family="Arial" font-size="34" font-weight="800">${escapeXml(award.certification)}</text>
  <text x="40" y="195" fill="#9a9aa0" font-family="Arial" font-size="18">Awarded to</text>
  <text x="40" y="230" fill="#e7e7e8" font-family="Arial" font-size="26" font-weight="700">${escapeXml(userName)}</text>
  <text x="40" y="320" fill="#9a9aa0" font-family="Arial" font-size="14">Award No. ${escapeXml(award.awardNumber)}</text>
  <text x="40" y="344" fill="#9a9aa0" font-family="Arial" font-size="14">Issued ${escapeXml(formatDate(award.dateAwarded))}</text>
  <circle cx="520" cy="300" r="46" fill="none" stroke="${tier}" stroke-width="3"/>
  <text x="520" y="307" fill="${tier}" font-family="Arial" font-size="22" font-weight="800" text-anchor="middle">${award.meritTier[0]}</text>
</svg>`;
}

function awardCertSvg(userName: string, award: AwardRecord): string {
  const tier = TIER_HEX[award.meritTier];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#0b0b0c"/>
  <rect x="24" y="24" width="752" height="552" fill="#141416" stroke="${tier}" stroke-width="3"/>
  <text x="400" y="120" fill="${tier}" font-family="Georgia" font-size="20" letter-spacing="4" font-weight="700" text-anchor="middle">CERTIFICATE OF COMPLETION</text>
  <text x="400" y="200" fill="#9a9aa0" font-family="Georgia" font-size="18" text-anchor="middle">This certifies that</text>
  <text x="400" y="260" fill="#ffffff" font-family="Georgia" font-size="40" font-weight="800" text-anchor="middle">${escapeXml(userName)}</text>
  <text x="400" y="320" fill="#9a9aa0" font-family="Georgia" font-size="18" text-anchor="middle">has successfully completed</text>
  <text x="400" y="372" fill="#e7e7e8" font-family="Georgia" font-size="30" font-weight="700" text-anchor="middle">${escapeXml(award.certification)}</text>
  <text x="400" y="470" fill="${tier}" font-family="Georgia" font-size="16" text-anchor="middle">${award.meritTier} Merit</text>
  <text x="400" y="520" fill="#9a9aa0" font-family="Arial" font-size="14" text-anchor="middle">Award No. ${escapeXml(award.awardNumber)} · Issued ${escapeXml(formatDate(award.dateAwarded))}</text>
</svg>`;
}


type ModalKind = "edit-user" | "edit-nate" | "cancel-sub" | "upload-id" | null;

/* PrmModal (unlike the old pm- shell) has no key handling of its own, so the
   modal owner closes whatever is open on Escape. */
function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

export function UserProfilePage({ user: seedUser }: { user: User }) {
  /* The live record (users.ts): this tab and the Users page read and write the
     same one, so an edit, a cancellation or a merge here shows there and back. */
  const user: User = useUser(seedUser.id) ?? seedUser;
  // Manual awards (Manage Completions) and scholarships feed the profile too.
  const completions = useCompletions();
  const scholarships = useScholarships();
  // Refunds revoke Awards, and cancelled card orders change their rows, so
  // both feed the profile build too.
  const refunds = useRefunds();
  const epaCancels = useEpaCancels();
  const base = useMemo(() => buildUserProfile(user), [user, completions, scholarships, refunds, epaCancels]);

  const [nate, setNate] = useState<NateDetail | undefined>(base.nate);
  const [modal, setModal] = useState<ModalKind>(null);
  /** The page's success toast — "Profile Updated" after an edit (the user,
   *  2026-10-04), and every other change this page applies. */
  const [toast, toastNode] = useToast();
  /* This user's ID document, for the header's "View ID". Approve/Replace edit
     it in place the same way the Manage IDs table does. */
  const [idOpen, setIdOpen] = useState(false);
  // Page-level 3-dot menu, anchored to the header kebab.
  const [pageMenu, setPageMenu] = useState<DOMRect | null>(null);
  // The shared ID record (manageIds.ts) — approving or replacing it here is
  // what Manage IDs sees too.
  const idDecisions = useIdDecisions();
  const idRecord = idRecordForUser(user, idDecisions);
  const hasId = idRecord.status !== "not-started";

  // The Upload ID dialog owns Escape itself (UploadIdModal).
  useEscape(modal !== null && modal !== "upload-id", () => setModal(null));

  const p = { ...base, nate };

  /* Cancel Subscription lives in the page's ⋮ menu, on the Users row menu's
     rule: anyone on a B2C Subscription not already cancelling sees it; an
     Apple subscription keeps it disabled with the reason (users.ts). */
  const offersCancelSub = offersCancelSubscription(user);
  const cancelSubBlock = cancelSubscriptionBlock(user);

  /* Edit User writes to the shared roster — the Users table, the EPA card's
     recipient and everything else that names this user follow. */
  function saveIdentity(v: { name: string; email: string; phone: string }) {
    updateUserContact(user.id, v);
    setModal(null);
    toast("Profile Updated");
  }

  /* Same two transitions the Manage IDs table applies (manageIds.ts): a
     replacement re-takes the upload stamp; an approval only records the
     decision. */
  function replaceId(status: "approved" | "in-review") {
    replaceIdRecord(idRecord, status);
    toast(status === "approved" ? "ID Replaced & Approved" : "ID Replaced");
  }

  /* Approving leaves the popup open on the document it just decided — the
     Approve button drops out of the footer, same as on the Manage IDs table. */
  function approveId() {
    approveIdRecord(idRecord);
    toast("ID Approved");
  }

  /* The Subscription card says what the Users column says — as plain text,
     not the pill (the user, 2026-10-13) — then the rows that plan has. A
     Starter has none: the card reads "No Subscription" like an empty EPA
     card. */
  const sub = p.subscription;
  const subRows: ConfirmField[] = [["Status", subscriptionText(user)]];
  switch (sub.status) {
    case "Subscriber":
      subRows.push(
        ["Currency", sub.currency],
        ["Started", formatDate(sub.startedOn)],
        sub.cancelsOn ? ["Access Until", formatDate(sub.cancelsOn)] : ["Renews", formatDate(sub.renewsOn)],
        ["Offer Code", sub.offerCode ?? "None"],
      );
      break;
    case "Free Trial":
      subRows.push(["Started", formatDate(sub.startedOn)], ["Trial Ends", formatDate(sub.endsOn)]);
      break;
    case "Scholarship":
      subRows.push(["Started", formatDate(sub.startedOn)], ["Ends", formatDate(sub.endsOn)]);
      break;
    case "Company Plan":
      subRows.push(["Company", user.companyName]);
      break;
    case "Cancelled":
      subRows.push(["Ended", formatDate(sub.endsOn)], ["Offer Code", sub.offerCode ?? "None"]);
      break;
    case "Starter":
      break;
  }

  /* The Portfolio Link field points at the standalone portfolio page, in
     its own tab — the same place the Portfolio card's "Open in New Tab" button
     went before that card became this field. */
  const portfolioHref = `${window.location.origin}${window.location.pathname}?portfolio=${user.id}`;

  /* The profile always opens in its own tab from Manage Users, so the crumb
     back is the same path with the ?profile= query dropped. */
  function backToUsers() {
    window.location.href = window.location.pathname;
  }

  return (
    <div className="main prof">
      <div className="workspace">
        <div className="tasks pr-page">
          {/* ── breadcrumb strip (Figma 1417:1395), then the header — identity row, actions on the right ── */}
          <nav className="rvc-crumbs" aria-label="Breadcrumb">
            <button className="rvc-crumb" onClick={backToUsers} title="Back to Users">
              Users
            </button>
          </nav>
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <div className="prof-headrow">
                <UserAvatar size={48} />
                <div className="rvc-pagehead-id">
                  <h1 className="tasks-title">{user.name}</h1>
                  <div className="tasks-subtitle">
                    {/* Only one of email/phone is required — show whichever are on file. */}
                    {user.email && (
                      <span className="prof-contact">
                        {user.email}
                      </span>
                    )}
                    {user.email && user.phone && <span className="tasks-subtitle-dot" />}
                    {user.phone && (
                      <span className="prof-contact">
                        {user.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {/* View ID and Edit moved behind the 3-dot menu, the same page-level
                kebab Manage Users carries (677:1956) — Login As is the only
                action the header still spells out. */}
            <div className="tasks-header-actions">
              <button className="cta-primary" onClick={() => loginAs(user)}>
                <MenuEnterIcon /> Login As
              </button>
              <button
                className="cta-quiet cta-quiet--icon"
                aria-label="More actions"
                onClick={(e) => setPageMenu(e.currentTarget.getBoundingClientRect())}
              >
                <RowKebabIcon />
              </button>
            </div>
          </header>

          {/* Every section on this page is one Review Details card (Figma
              1046:1147) — a titled hairline head over a tinted r12 card, the
              head carrying that section's own action where it has one. */}
          <div className="prof-scroll">
            <div className="confirm-cards prof-cards">
              {/* Profile fields. No pencil of its own: editing this user is the
                  header 3-dot menu's "Edit User Details". */}
              {/* Four equal columns, in the user's order (2026-10-04): Language
                  · Industry · Goal · Notification / Attribution · Zip ·
                  Joined · Last Access / Portfolio Link, which spans its whole row
                  so a narrow card never cuts the link short. */}
              <ConfirmCard
                title="Profile"
                fillBlanks
                columns={4}
                rows={[
                  ["Language Preference", p.fields.language],
                  ["Industry Preference", p.fields.industryPreference],
                  ["Goal", p.fields.goal],
                  ["Notification Preference", p.fields.notificationPreference],
                  ["Attribution", p.fields.attribution],
                  [
                    "Zip Code",
                    ZIP_LOCATIONS[p.fields.zipCode]
                      ? `${p.fields.zipCode} · ${ZIP_LOCATIONS[p.fields.zipCode].city}, ${ZIP_LOCATIONS[p.fields.zipCode].state}, ${ZIP_LOCATIONS[p.fields.zipCode].country}`
                      : p.fields.zipCode,
                  ],
                  ["Joined SkillCat", formatDate(user.joinedOn)],
                  ["Last Access", formatDate(user.lastAccess)],
                  [
                    "Portfolio Link",
                    <a
                      className="rvc-headlink"
                      href={portfolioHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.portfolioUrl}
                    </a>,
                    "row",
                  ],
                ]}
              />

              {/* Skills — no card at all for a user with none (user,
                  2026-10-06), rather than an empty table. */}
              {p.skills.length > 0 && (
                <ConfirmCard title={`Skills · ${p.skills.length}`} tableBody>
                  <SkillsTable skills={p.skills} />
                </ConfirmCard>
              )}

              {/* Awards — a plain line when there are none, like an empty EPA
                  card (the user, 2026-10-13). */}
              {p.awards.length > 0 ? (
                <ConfirmCard
                  title={`Awards · ${p.awards.length}`}
                  /* Figma 1278:1574 — the card head's own 24px "Button dialog",
                     the same component Merge's Swap Roles uses. */
                  trailing={
                    <button className="btn-dialog" onClick={() => {
                        downloadAllAwards(user.name, p.awards);
                        toast("Awards Downloaded");
                      }}
                    >
                      <DownloadIcon /> Download All
                    </button>
                  }
                  tableBody
                >
                  <AwardsTable userName={user.name} awards={p.awards} onToast={toast} />
                </ConfirmCard>
              ) : (
                <ConfirmCard title="Awards">
                  <p className="form-help">No Awards earned.</p>
                </ConfirmCard>
              )}

              {/* Subscription — Cancel Subscription is the page menu's, not the
                  card's (the user, 2026-10-13). */}
              <ConfirmCard
                title="Subscription"
                fillBlanks
                rows={sub.status === "Starter" ? undefined : subRows}
              >
                {sub.status === "Starter" && <p className="form-help">No Subscription</p>}
              </ConfirmCard>

              {/* Purchases / bills */}
              <PurchasesSection purchases={p.purchases} />

              {/* EPA Card Orders — every order, as a table (Figma 1668:1554). */}
              <EpaOrdersSection orders={p.epaOrders} onToast={toast} />

              {/* NATE details */}
              <ConfirmCard
                title="NATE Details"
                /* The bare pencil, as on the Profile card — it opens the same
                   modal whether there is a registration to edit or one to add. */
                onEdit={() => setModal("edit-nate")}
                rows={
                  p.nate
                    ? [
                        ["First Name", p.nate.firstName],
                        ["Last Name", p.nate.lastName],
                        ["Email", p.nate.email],
                        ["NATE Connect ID", p.nate.connectId],
                      ]
                    : undefined
                }
              >
                {!p.nate && <p className="form-help">No NATE registration on record.</p>}
                </ConfirmCard>
            </div>
          </div>
        </div>
      </div>

      {pageMenu && (
        <RowMenu
          rect={pageMenu}
          onClose={() => setPageMenu(null)}
          items={[
            /* The Manage IDs popup, opened on this user's own document — same
               modal, same Replace / Approve flows. A user with nothing
               uploaded to the ID Upload Task gets "Upload ID" instead, which
               opens the upload dialog (467:673) on its own. */
            hasId
              ? { label: "View ID", icon: <IdCardIcon />, onPick: () => setIdOpen(true) }
              : { label: "Upload ID", icon: <IdCardIcon />, onPick: () => setModal("upload-id") },
            {
              label: "Edit User Details",
              icon: <RowEditIcon />,
              onPick: () => setModal("edit-user"),
            },
            /* Red (673:1437); an Apple subscription keeps the row, disabled,
               with the reason under the label. */
            ...(offersCancelSub
              ? [
                  {
                    label: "Cancel Subscription",
                    icon: <MenuCardOffIcon />,
                    danger: true,
                    disabled: !!cancelSubBlock,
                    sub: cancelSubBlock,
                    onPick: () => setModal("cancel-sub"),
                  },
                ]
              : []),
          ]}
        />
      )}

      {modal === "edit-user" && (
        <EditUserModal
          initial={{ name: user.name, email: user.email, phone: user.phone }}
          onClose={() => setModal(null)}
          onSave={saveIdentity}
        />
      )}
      {modal === "edit-nate" && (
        <EditNateModal
          initial={p.nate}
          onClose={() => setModal(null)}
          onSave={(v) => {
            setNate(v);
            setModal(null);
            toast("Profile Updated");
          }}
        />
      )}
      {modal === "upload-id" && (
        <UploadIdModal
          record={idRecord}
          onClose={() => setModal(null)}
          onDecide={(status) => {
            replaceIdRecord(idRecord, status);
            setModal(null);
            toast(status === "approved" ? "ID Uploaded & Approved" : "ID Uploaded");
          }}
        />
      )}
      {modal === "cancel-sub" && (
        <CancelSubscriptionModal
          user={user}
          onClose={() => setModal(null)}
          onConfirm={() => {
            cancelSubscription(user.id);
            setModal(null);
            toast("Subscription Cancelled");
          }}
        />
      )}
      {idOpen && (
        <IdModal
          /* The record carries the live user's name for the header and the
             document's own name for the card (manageIds.ts). */
          record={idRecord}
          onClose={() => setIdOpen(false)}
          onReplace={replaceId}
          onApprove={() => approveId()}
        />
      )}
      {toastNode}
    </div>
  );
}

/* ── Skills table — the same card table as Awards (Figma 1278:1571) ──
 * Skill as the node's primary (white Medium) column, then its type, then when
 * the learner earned it. Both of the latter sort; Date Awarded is the default,
 * newest first, the way the node sorts its own date column.
 */
/* Definite widths on EVERY column, the name one included: a fixed-layout table
   hands its slack to an unsized column alone, so leaving the first on `auto`
   made it swallow the whole card and bunched the rest against the right edge.
   Sized all through, the slack spreads in proportion and the columns stay
   evenly spaced at any card width. Same arithmetic as the list pages
   (Name Change Requests, Scholarships): the sum is the table's floor. */
const SKILL_COLS = { skill: 360, type: 180, date: 180 };
const SKILL_TABLE_MIN = SKILL_COLS.skill + SKILL_COLS.type + SKILL_COLS.date;

function SkillsTable({ skills }: { skills: SkillBadge[] }) {
  const [sort, setSort] = useState<{ key: "type" | "date"; dir: SortDir }>({
    key: "date",
    dir: "desc",
  });

  function toggle(key: "type" | "date") {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const rows = useMemo(() => {
    const out = [...skills];
    out.sort((a, b) => {
      // Mastery ranks after a plain Skill, so ascending reads Skill → Mastery.
      const d =
        sort.key === "type"
          ? Number(a.mastery) - Number(b.mastery)
          : a.dateAwarded.localeCompare(b.dateAwarded);
      return sort.dir === "asc" ? d : -d;
    });
    return out;
  }, [skills, sort]);

  const th = (key: "type" | "date", label: string) => {
    const active = sort.key === key;
    return (
      <th onClick={() => toggle(key)}>
        <span className="th-content">
          {label}
          <SortIcon active={active} dir={active ? sort.dir : undefined} />
        </span>
      </th>
    );
  };

  return (
    <div
      className="confirm-card-xscroll"
      style={{ "--table-min": `${SKILL_TABLE_MIN}px` } as CSSProperties}
    >
      <table className="table sch-table">
        {/* Every column sized, the Skill one included — see SKILL_COLS. */}
        <TableCols data={[SKILL_COLS.skill, SKILL_COLS.type, SKILL_COLS.date]} />
        <thead>
          <tr>
            <th className="no-sort">Skill</th>
            {th("type", "Type")}
            {th("date", "Date Awarded")}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.name}>
              <td className="col-name">{s.name}</td>
              <td>{s.mastery ? "Mastery Skill" : "Skill"}</td>
              <td className="col-date">{formatDate(s.dateAwarded)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Awards table — Figma 1278:1571 "Profile - Table" ──
 * The node's table is the shared .table atom (40px rows, 12px insets, #404040
 * header rule) with four columns and a row kebab: Certification fills, Merit
 * Tier 90, Award Number 112, Date Awarded 120, then the 40px actions gutter.
 * Merit Tier and Date Awarded carry sort affordances; Date Awarded is the
 * node's sorted column, descending. The "Appearances" column the old table
 * printed is gone with the node — what it told you (whether this Award has a
 * Certificate as well as a Card) is now the state of the Download Certificate
 * item in the row's menu.
 */
const TIER_RANK: Record<MeritTier, number> = { Bronze: 0, Silver: 1, Gold: 2, Platinum: 3 };

/* The node spaces its columns with a 24px flex gap and gives each text box its
   full width (Merit Tier 90, Award Number 112, Date Awarded 120); a table pays
   that gap out of cell padding instead — 12px a side — so each column is the
   node's text width PLUS 24, which puts every text box back on the node's own
   x. The Certification column is sized too (402 = the node's own name width, so
   the sum is exactly the node's 836px table); see SKILL_COLS for why none of
   them may be left on `auto`. */
const AWARD_COLS = { certification: 402, tier: 114, number: 136, date: 144, actions: 40 };
const AWARD_TABLE_MIN = Object.values(AWARD_COLS).reduce((a, b) => a + b, 0);

function AwardsTable({
  userName,
  awards,
  onToast,
}: {
  userName: string;
  awards: AwardRecord[];
  onToast: (label: string) => void;
}) {
  const [sort, setSort] = useState<{ key: "tier" | "date"; dir: SortDir }>({
    key: "date",
    dir: "desc",
  });
  const [menu, setMenu] = useState<{ award: AwardRecord; rect: DOMRect } | null>(null);

  function toggle(key: "tier" | "date") {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const rows = useMemo(() => {
    const out = [...awards];
    out.sort((a, b) => {
      const d =
        sort.key === "tier"
          ? TIER_RANK[a.meritTier] - TIER_RANK[b.meritTier]
          : a.dateAwarded.localeCompare(b.dateAwarded);
      return sort.dir === "asc" ? d : -d;
    });
    return out;
  }, [awards, sort]);

  const th = (key: "tier" | "date", label: string) => {
    const active = sort.key === key;
    return (
      <th onClick={() => toggle(key)}>
        <span className="th-content">
          {label}
          <SortIcon active={active} dir={active ? sort.dir : undefined} />
        </span>
      </th>
    );
  };

  return (
    <div
      className="confirm-card-xscroll"
      style={{ "--table-min": `${AWARD_TABLE_MIN}px` } as CSSProperties}
    >
      <table className="table sch-table">
        <TableCols
          data={[AWARD_COLS.certification, AWARD_COLS.tier, AWARD_COLS.number, AWARD_COLS.date]}
          trail={[AWARD_COLS.actions]}
        />
        <thead>
          <tr>
            <th className="no-sort">Certification</th>
            {th("tier", "Merit Tier")}
            <th className="no-sort">Award Number</th>
            {th("date", "Date Awarded")}
            <th className="col-actions no-sort" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className={menu?.award.id === a.id ? "menu-open" : undefined}>
              <td className="col-name">{a.certification}</td>
              <td>{a.meritTier}</td>
              <td>{a.awardNumber}</td>
              <td className="col-date">{formatDate(a.dateAwarded)}</td>
              <RowKebab onOpen={(rect) => setMenu({ award: a, rect })} />
            </tr>
          ))}
        </tbody>
      </table>

      {menu && (
        <RowMenu
          rect={menu.rect}
          onClose={() => setMenu(null)}
          items={[
            {
              label: "Download Card",
              icon: <DownloadIcon />,
              onPick: () => {
                downloadFile(
                  `${menu.award.awardNumber}-card.svg`,
                  awardCardSvg(userName, menu.award),
                  "image/svg+xml",
                );
                onToast("Card Downloaded");
              },
            },
            {
              /* Disabled-with-a-reason rather than hidden: an Award that never
                 had a Certificate should say so, which is what the dropped
                 "Appearances" column used to carry. */
              label: "Download Certificate",
              icon: <DownloadIcon />,
              disabled: !menu.award.hasCertificate,
              title: menu.award.hasCertificate ? undefined : "This Award has no Certificate",
              onPick: () => {
                downloadFile(
                  `${menu.award.awardNumber}-certificate.svg`,
                  awardCertSvg(userName, menu.award),
                  "image/svg+xml",
                );
                onToast("Certificate Downloaded");
              },
            },
          ]}
        />
      )}
    </div>
  );
}


/* ── Download All Awards — one ZIP of every Card and Certificate, no picker
   (the user, 2026-10-04). Same files the row actions download one by one. ── */
function downloadAllAwards(userName: string, awards: AwardRecord[]) {
  const files: ZipEntry[] = [];
  for (const a of awards) {
    files.push({ name: `${a.awardNumber}-card.svg`, content: awardCardSvg(userName, a) });
    if (a.hasCertificate) {
      files.push({ name: `${a.awardNumber}-certificate.svg`, content: awardCertSvg(userName, a) });
    }
  }
  const slug = userName.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "user";
  downloadFile(`${slug}-awards.zip`, makeZip(files), "application/zip");
}

/* ── Edit modals — session-local admin edits over the seeded record ── */

function PrmField({
  label,
  value,
  onChange,
  error,
  placeholder,
  autoFocus,
  required = true,
  onLeave,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  /** Focus left the field (fieldFlags.tsx `leave`) — the modal marks it touched. */
  onLeave?: () => void;
  /** Soft character limit (names only — emails / phones / IDs pass none):
   *  counter + label-row message; the modal's Save blocks on `isOver`. */
  max?: number;
}) {
  const inputProps = {
    className: `form-input${error ? " has-error" : ""}`,
    value,
    placeholder,
    autoFocus,
    "aria-invalid": error ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
  } as const;
  return (
    <div className="prm-field" onBlur={onLeave ? leave(onLeave) : undefined}>
      <label className="prm-label">
        {label}
        {required &&<span className="prm-req">*</span>}
        {error && <span className="form-label-error">{error}</span>}
        {max !== undefined && <LimitError max={max} values={[value]} />}
      </label>
      {max !== undefined ? <LimitedInput {...inputProps} max={max} /> : <input {...inputProps} />}
    </div>
  );
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/* Also opened by the Manage Users row's pencil and its "Edit User Details"
   menu item, so both surfaces edit a user through this one modal. */
export function EditUserModal({
  initial,
  onClose,
  onSave,
}: {
  initial: { name: string; email: string; phone: string };
  onClose: () => void;
  onSave: (v: { name: string; email: string; phone: string }) => void;
}) {
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const { touched, touch } = useTouchedKeys();

  // Only one of email/phone is required; flag both when both are empty.
  const noContact = !form.email.trim() && !form.phone.trim();
  const errors = {
    name: form.name.trim() ? "" : "Name is required.",
    email: noContact
      ? "Enter an email or a phone number."
      : form.email.trim() && !EMAIL_RE.test(form.email.trim())
      ? "Enter a valid email address."
      : "",
    phone: noContact ? "Enter an email or a phone number." : "",
  };
  const invalid = Boolean(errors.name || errors.email || errors.phone) || isOver(NAME_MAX, form.name);
  // Save stays disabled until a field actually differs (whitespace-only edits don't count).
  const dirty =
    form.name.trim() !== initial.name.trim() ||
    form.email.trim() !== initial.email.trim() ||
    form.phone.trim() !== initial.phone.trim();

  function submit() {
    if (!dirty) return;
    setSubmitted(true);
    if (invalid) return;
    onSave({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
  }

  return (
    <PrmModal
      title="Edit User"
      description="An email or a phone number is required. Changing either resets its verified status."
      confirmLabel="Save Changes"
      confirmDisabled={!dirty}
      confirmTip={NO_CHANGES_TIP}
      onCancel={onClose}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <PrmField
          label="Name"
          value={form.name}
          max={NAME_MAX}
          autoFocus
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          error={submitted || touched.has("name") ? errors.name : undefined}
          onLeave={() => touch("name")}
        />
        <PrmField
          label="Email"
          value={form.email}
          required={false}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          error={submitted || touched.has("email") ? errors.email : undefined}
          onLeave={() => touch("email")}
        />
        {/* The B2B Company Create phone field: dial-code picker + number. */}
        <div className="prm-field" onBlur={leave(() => touch("phone"))}>
          <label className="prm-label">
            Phone Number
            {(submitted || touched.has("phone")) && errors.phone && (
              <span className="form-label-error">{errors.phone}</span>
            )}
          </label>
          <PhoneField
            phone={form.phone}
            setPhone={(v) => setForm((f) => ({ ...f, phone: v }))}
            invalid={(submitted || touched.has("phone")) && !!errors.phone}
          />
        </div>
      </div>
    </PrmModal>
  );
}

function EditNateModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: NateDetail;
  onClose: () => void;
  onSave: (v: NateDetail) => void;
}) {
  const [form, setForm] = useState<NateDetail>(
    initial ?? { connectId: "", firstName: "", lastName: "", email: "" },
  );
  const [submitted, setSubmitted] = useState(false);
  const { touched, touch } = useTouchedKeys();

  const errors = {
    firstName: form.firstName.trim() ? "" : "First name is required.",
    lastName: form.lastName.trim() ? "" : "Last name is required.",
    email: !form.email.trim()
      ? "Email is required."
      : EMAIL_RE.test(form.email.trim())
      ? ""
      : "Enter a valid email address.",
    connectId: !form.connectId.trim()
      ? "NATE Connect ID is required."
      : /^\d+$/.test(form.connectId.trim())
      ? ""
      : "Connect ID must be numeric.",
  };
  const invalid =
    Boolean(errors.firstName || errors.lastName || errors.email || errors.connectId) ||
    isOver(NAME_MAX, form.firstName, form.lastName);
  // Editing: Save stays disabled until a field actually differs. Adding has nothing to compare against.
  const dirty =
    !initial ||
    (["connectId", "firstName", "lastName", "email"] as const).some(
      (k) => form[k].trim() !== initial[k].trim(),
    );

  function submit() {
    if (!dirty) return;
    setSubmitted(true);
    if (invalid) return;
    onSave({
      connectId: form.connectId.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
    });
  }

  return (
    <PrmModal
      title={initial ? "Edit NATE Details" : "Add NATE Details"}
      description="These are the details the user registered with on the NATE form — they can differ from the SkillCat profile."
      confirmLabel={initial ? "Save Changes" : "Add Details"}
      confirmDisabled={!dirty}
      confirmTip={NO_CHANGES_TIP}
      onCancel={onClose}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="form-row-2">
          <PrmField
            label="First Name"
            value={form.firstName}
            max={NAME_MAX}
            autoFocus
            onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
            error={submitted || touched.has("firstName") ? errors.firstName : undefined}
            onLeave={() => touch("firstName")}
          />
          <PrmField
            label="Last Name"
            value={form.lastName}
            max={NAME_MAX}
            onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
            error={submitted || touched.has("lastName") ? errors.lastName : undefined}
            onLeave={() => touch("lastName")}
          />
        </div>
        <PrmField
          label="Email"
          value={form.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          error={submitted || touched.has("email") ? errors.email : undefined}
          onLeave={() => touch("email")}
        />
        <PrmField
          label="NATE Connect ID"
          value={form.connectId}
          placeholder="e.g. 483920"
          onChange={(v) => setForm((f) => ({ ...f, connectId: v }))}
          error={submitted || touched.has("connectId") ? errors.connectId : undefined}
          onLeave={() => touch("connectId")}
        />
      </div>
    </PrmModal>
  );
}

/* Also used by Manage Users' row-menu Cancel Subscription action. */
/* The one Cancel Subscription confirm — the Full Profile's Subscription card
   and the Users row menu both open it. */
export function CancelSubscriptionModal({
  user,
  onClose,
  onConfirm,
}: {
  user: User;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscape(true, onClose);
  const platform = user.platform ?? "Stripe";
  const renewsOn = user.renewsOn;
  return (
    <PrmModal
      title="Cancel Subscription?"
      cancelLabel="Keep Subscription"
      confirmLabel="Cancel Subscription"
      onCancel={onClose}
      onConfirm={onConfirm}
    >
      <p className="prm-content">
        This cancels <strong>{user.name}</strong>&rsquo;s {platform} subscription at the end of the
        current billing period. No further charges will be made.
      </p>
      {renewsOn && (
        <p className="prm-content">
          They keep full access until <strong>{formatDate(renewsOn)}</strong>. No refund is issued
          for the current period.
        </p>
      )}
    </PrmModal>
  );
}

/* ── Purchases & Bills — one list of every purchase, narrowed by the Purchase
 * Type filter pill (Figma 1288:2876): Subscription renewals, Certifications,
 * Quiz attempts and Physical Products. No Status column (the user,
 * 2026-10-13): a refunded charge is the row itself, greyed, with a "Refunded"
 * pill after the item name (1290:2943). Every row's ⋮ (1666:1457) is Refund
 * alone — it opens the charge's record on Stripe or Google in a new tab, where
 * the refund is issued, and stays after one; an Apple purchase keeps it
 * disabled with the reason. ── */
const PURCHASE_TYPES: { label: string; kind: PurchaseKind }[] = [
  { label: "Subscription", kind: "Subscription" },
  { label: "Certifications", kind: "Certification" },
  { label: "Quiz Attempts", kind: "Quiz Attempt" },
  { label: "Physical Products", kind: "EPA Card" },
];
const PURCHASE_TYPE_LABELS = PURCHASE_TYPES.map((t) => t.label);
const KIND_LABEL: Record<PurchaseKind, string> = Object.fromEntries(
  PURCHASE_TYPES.map((t) => [t.kind, t.label]),
) as Record<PurchaseKind, string>;

/* Definite widths on EVERY column, the first one included: a fixed-layout table
   hands its slack to the auto column alone, so an unsized first column swallowed
   the whole card and left the rest bunched at the right. With all of them sized,
   the slack spreads in proportion and the columns stay evenly spaced. */
const PURCHASE_COLS = {
  date: 130,
  item: 320,
  type: 160,
  platform: 120,
  receipt: 160,
  amount: 100,
  actions: 40,
};
const PURCHASE_TABLE_MIN = Object.values(PURCHASE_COLS).reduce((a, b) => a + b, 0);

function PurchasesSection({ purchases }: { purchases: Purchase[] }) {
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [rowMenu, setRowMenu] = useState<{ idx: number; rect: DOMRect } | null>(null);

  // Tag each purchase with its stable index, narrow to the picked types, and
  // show the newest first — with every kind in one list, date is the only order
  // that means anything.
  const rows = useMemo(
    () =>
      purchases
        .map((pu, idx) => ({ ...pu, idx }))
        .filter((pu) => typeFilter.length === 0 || typeFilter.includes(KIND_LABEL[pu.kind]))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [purchases, typeFilter],
  );

  /* Refund only. Stripe and Google charges open their record in a new tab;
     an Apple charge has no page of ours, so the item stays, disabled, with
     the reason. Physical Products are always Stripe, so always refundable. */
  function menuItems(pu: Purchase): RowMenuItem[] {
    const url = purchaseRecordUrl(pu);
    return [
      {
        label: "Refund",
        icon: <MenuRefundIcon />,
        disabled: !url,
        sub: url ? undefined : APPLE_REFUND_NOTE,
        onPick: () => {
          if (url) window.open(url, "_blank", "noopener");
        },
      },
    ];
  }

  /* The shared filter pill (Figma 1288:2876 "Filters - Unapplied"). It rides in
     the card HEAD beside the title (1290:2991), which is the same slot the
     Awards card gives its Download All button — not a row of its own above the
     table. */
  const typePill = (
    /* No `.filters` wrapper: that is the list pages' filter ROW, and its own
       padding and margin were inflating this head to 79px. The head is already
       the flex row the pill needs. */
    <div className="prof-filters">
      {/* `overlay`: the card is `overflow: hidden` (it clips its own r12), so a
          panel laid out inside it would be cut off — portal it to the body.
          `align="right"`: the panel hangs from the pill's right edge, which is
          the card's right edge — left-aligned it would run off the card. */}
      <Dropdown
        width={220}
        overlay
        align="right"
        constrainHeight
        trigger={({ open, toggle }) => (
          <PillTrigger
            label="Purchase Type"
            tip={FILTER_TIPS.profile.purchaseType}
            value={summarize(typeFilter, PURCHASE_TYPE_LABELS)}
            open={open}
            toggle={toggle}
            onClear={() => setTypeFilter([])}
          />
        )}
      >
        {({ close }) => (
          <SectionedMultiSelect
            sections={[{ items: PURCHASE_TYPE_LABELS }]}
            value={typeFilter}
            onApply={(v) => {
              setTypeFilter(v);
              close();
            }}
          />
        )}
      </Dropdown>
    </div>
  );

  /* Nothing bought at all: a plain line in place of the table, and no filter
     to narrow nothing with (the user, 2026-10-13). A filter that matches
     nothing keeps the table, with No Results Found. */
  if (purchases.length === 0) {
    return (
      <ConfirmCard title="Purchases & Bills">
        <p className="form-help">No purchases made.</p>
      </ConfirmCard>
    );
  }

  return (
    /* `tableBody`: the node (1290:2943) has no rule under this head either —
       the pill moved into the head, so the table is the whole body and its own
       top border is the line between them. */
    <ConfirmCard
      title={`Purchases & Bills · ${purchases.length}`}
      trailing={typePill}
      tableBody
    >
      {/* Same as the Awards card: the table fills the card and only scrolls
          sideways below its own column-width sum. */}
      <div
        className="confirm-card-xscroll"
        style={{ "--table-min": `${PURCHASE_TABLE_MIN}px` } as CSSProperties}
      >
        {/* Same chrome as the Awards table (1278:1571). */}
        <table className="table sch-table">
          {/* The shared width rule: data columns share the slack, the 3-dot
              gutter stays fixed. */}
          <TableCols
            data={[
              PURCHASE_COLS.date,
              PURCHASE_COLS.item,
              PURCHASE_COLS.type,
              PURCHASE_COLS.platform,
              PURCHASE_COLS.receipt,
              PURCHASE_COLS.amount,
            ]}
            trail={[PURCHASE_COLS.actions]}
          />
          <thead>
            <tr>
              <th className="no-sort">Date</th>
              <th className="no-sort">Item</th>
              <th className="no-sort">Purchase Type</th>
              <th className="no-sort">Platform</th>
              <th className="no-sort">Receipt</th>
              <th className="no-sort">Amount</th>
              <th className="no-sort col-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((pu) => (
              /* A refunded charge wears the shared `.task-dim` (name #7a7a7a,
                 every other cell #404040) — every cell carries a class, which
                 that rule keys on. */
              <tr key={pu.key || pu.idx} className={pu.refunded ? "task-dim" : undefined}>
                <td className="col-date">{formatDate(pu.date)}</td>
                {/* The flags stay whole; the item name truncates before them. */}
                <td className={`col-name${pu.companyPaid || pu.refunded ? " has-flag" : ""}`} data-tip={pu.item}>
                  <span className="tsk-name">{pu.item}</span>
                  {pu.companyPaid && <span className="pr-name-flag">Company Paid</span>}
                  {pu.refunded && <span className="pr-name-flag pr-name-flag--grey">Refunded</span>}
                </td>
                <td className="pr-col">{KIND_LABEL[pu.kind]}</td>
                <td className="pr-col">{pu.platform}</td>
                <td className="pr-col">{pu.receiptId}</td>
                <td className="pr-col">{money(pu.amount)}</td>
                <RowKebab onOpen={(rect) => setRowMenu({ idx: pu.idx, rect })} />
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <TableEmpty />}
      </div>

      {rowMenu &&
        (() => {
          const pu = rows.find((r) => r.idx === rowMenu.idx);
          return pu ? (
            <RowMenu rect={rowMenu.rect} items={menuItems(pu)} onClose={() => setRowMenu(null)} />
          ) : null;
        })()}
    </ConfirmCard>
  );
}

/* ── EPA Card Orders — every physical-card order as a table (Figma 1668:1554):
 * Certification (with the Company Paid flag), Shipping Address, Status as plain
 * text, Ordered On, ⋮. A cancelled order is greyed and has no ⋮. The row menu
 * (1668:1642) is a red Cancel Order while the order is received or accepted;
 * from In production on it stays, disabled, with the reason. Cancelling never
 * refunds: the charge is refunded from Purchases & Bills. ── */
/* The node's columns (1668:1554 metadata: 322 / 301 / 108 / 90 of text plus
   the 24px insets), the kebab gutter fixed. */
const EPA_COLS = {
  cert: 346,
  address: 325,
  status: 132,
  ordered: 114,
  actions: 40,
};
const EPA_TABLE_MIN = Object.values(EPA_COLS).reduce((a, b) => a + b, 0);

function EpaOrdersSection({
  orders,
  onToast,
}: {
  orders: EpaCardOrder[];
  onToast: (label: string) => void;
}) {
  const [rowMenu, setRowMenu] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [cancelling, setCancelling] = useState<EpaCardOrder | null>(null);

  const rows = useMemo(() => [...orders].sort((a, b) => b.orderedOn.localeCompare(a.orderedOn)), [orders]);

  function menuItems(o: EpaCardOrder): RowMenuItem[] {
    const can = canCancelEpaOrder(o);
    return [
      {
        label: "Cancel Order",
        // The crossed card — the same glyph Cancel Subscription carries
        // (1668:1642 draws Cancel Order with it).
        icon: <MenuCardOffIcon />,
        danger: true,
        disabled: !can,
        sub: can ? undefined : EPA_CANCEL_BLOCK,
        onPick: () => setCancelling(o),
      },
    ];
  }

  if (orders.length === 0) {
    return (
      <ConfirmCard title="EPA Card Orders">
        <p className="form-help">No EPA card ordered.</p>
      </ConfirmCard>
    );
  }

  return (
    /* No count in the title — 1668:1554 reads "EPA Card Orders" alone. */
    <ConfirmCard title="EPA Card Orders" tableBody>
      <div
        className="confirm-card-xscroll"
        style={{ "--table-min": `${EPA_TABLE_MIN}px` } as CSSProperties}
      >
        <table className="table sch-table">
          <TableCols
            data={[EPA_COLS.cert, EPA_COLS.address, EPA_COLS.status, EPA_COLS.ordered]}
            trail={[EPA_COLS.actions]}
          />
          <thead>
            <tr>
              <th className="no-sort">Certification</th>
              <th className="no-sort">Shipping Address</th>
              <th className="no-sort">Status</th>
              <th className="no-sort">Ordered On</th>
              <th className="no-sort col-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const cancelled = o.status === "Cancelled";
              return (
                <tr key={o.id} className={cancelled ? "task-dim" : undefined}>
                  <td className={`col-name${o.companyPaid ? " has-flag" : ""}`} data-tip={o.certification}>
                    <span className="tsk-name">{o.certification}</span>
                    {o.companyPaid && <span className="pr-name-flag">Company Paid</span>}
                  </td>
                  {/* The address wraps onto a second line rather than
                      truncating (1668:1554's canceled row). */}
                  <td className="pr-col pr-col--wrap">{o.shippingAddress}</td>
                  <td className="pr-col">{o.status}</td>
                  <td className="col-date">{formatDate(o.orderedOn)}</td>
                  {cancelled ? (
                    <td className="col-actions" />
                  ) : (
                    <RowKebab onOpen={(rect) => setRowMenu({ id: o.id, rect })} />
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rowMenu &&
        (() => {
          const o = rows.find((r) => r.id === rowMenu.id);
          return o ? (
            <RowMenu rect={rowMenu.rect} items={menuItems(o)} onClose={() => setRowMenu(null)} />
          ) : null;
        })()}

      {/* The stacked double confirm every destructive action gets. Its copy
          says what cancelling does NOT do: refund. */}
      {cancelling && (
        <PrmModal
          title="Cancel EPA Card Order?"
          cancelLabel="Keep Order"
          confirmLabel="Cancel Order"
          danger
          doubleConfirm={
            <>
              The <strong>{cancelling.certification}</strong> card ordered on{" "}
              <strong>{formatDate(cancelling.orderedOn)}</strong> will not be produced or shipped.
              The user is not refunded by this — issue the refund from Purchases &amp; Bills.
            </>
          }
          onCancel={() => setCancelling(null)}
          onConfirm={() => {
            cancelEpaOrder(cancelling.id);
            setCancelling(null);
            onToast("Order Cancelled");
          }}
        >
          <p className="prm-content">
            This cancels the <strong>{cancelling.certification} Physical Card</strong> ordered on{" "}
            <strong>{formatDate(cancelling.orderedOn)}</strong>. The card will not be produced or
            shipped.
          </p>
          <p className="prm-content">
            Cancelling does not refund the user. The charge stays in Purchases &amp; Bills, where the
            refund is issued.
          </p>
        </PrmModal>
      )}
    </ConfirmCard>
  );
}
