import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import {
  buildUserProfile,
  PROFILE_TODAY,
  ZIP_LOCATIONS,
  type AwardRecord,
  type EpaCardOrder,
  type EpaStatus,
  type MeritTier,
  type NateDetail,
  type Purchase,
  type PurchaseKind,
  type SkillBadge,
} from "../data/userProfile";
import type { User } from "../data/users";
import { idRecordForUser, nowIdStamp, type IdRecord, type IdStatus } from "../data/manageIds";
import { loginAs } from "./loginAs";
import { ConfirmCard } from "./ConfirmCard";
import { Dropdown } from "./Dropdown";
import { PillTrigger, SectionedMultiSelect, summarize } from "./Filters";
import { FILTER_TIPS } from "../data/filterTips";
import type { SortDir } from "./AwardTableParts";
import { PrmModal } from "./PrmModal";
import { PrmCheck } from "./ProctoringConsole";
import { IdModal } from "./IdModal";
import {
  ChevronRightIcon,
  DownloadIcon,
  IdCardIcon,
  MenuCancelSubIcon,
  MenuEnterIcon,
  MenuInvoiceIcon,
  RowEditIcon,
  RowKebabIcon,
  SortIcon,
} from "./icons";

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

function initialsOf(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

/* ── Download helpers — generate the Award Card / Certificate as an SVG file ── */
function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
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


type ModalKind = "edit-user" | "edit-nate" | "cancel-sub" | "cancel-epa" | null;

// A physical-card order can be canceled while it's recent (within 30 days of
// ordering) and hasn't shipped yet; canceled/refunded orders are already final.
const EPA_CANCEL_WINDOW_DAYS = 30;
function isEpaOrderCancelable(order: EpaCardOrder): boolean {
  if (["Shipped", "Delivered", "Canceled", "Refunded"].includes(order.status)) return false;
  const ageDays =
    (PROFILE_TODAY.getTime() - new Date(`${order.orderedOn}T00:00:00`).getTime()) / 86400000;
  return ageDays <= EPA_CANCEL_WINDOW_DAYS;
}

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

/* The Manage Users table's verified check (u-verified). */
const VerifiedIcon = () => (
  <svg className="u-verified-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.4 12.4l2.4 2.4 4.8-5.2" />
  </svg>
);

const Verified = () => (
  <span className="u-verified" title="Verified">
    <VerifiedIcon />
  </span>
);

/* Companies-pill tone (Figma 109:1237) per physical-card status. */
const EPA_TONE: Record<EpaStatus, string> = {
  "Order received": "yellow",
  Accepted: "yellow",
  "In production": "yellow",
  Shipped: "purple",
  Delivered: "green",
  "Action needed": "red",
  Canceled: "grey",
  Refunded: "secondary",
};

export function UserProfilePage({ user: seedUser }: { user: User }) {
  const base = useMemo(() => buildUserProfile(seedUser), [seedUser]);

  // Admin edits are session-local overrides on top of the seeded record.
  const [identity, setIdentity] = useState({
    name: seedUser.name,
    email: seedUser.email,
    phone: seedUser.phone,
    emailVerified: seedUser.emailVerified,
    phoneVerified: seedUser.phoneVerified,
  });
  const [nate, setNate] = useState<NateDetail | undefined>(base.nate);
  const [subCanceled, setSubCanceled] = useState(false);
  const [epaCanceled, setEpaCanceled] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [downloadAllOpen, setDownloadAllOpen] = useState(false);
  /* This user's ID document, for the header's "View ID". Approve/Replace edit
     it in place the same way the Manage IDs table does. */
  const [idOpen, setIdOpen] = useState(false);
  // Page-level 3-dot menu, anchored to the header kebab.
  const [pageMenu, setPageMenu] = useState<DOMRect | null>(null);
  const [idRecord, setIdRecord] = useState<IdRecord>(() => idRecordForUser(seedUser));

  useEscape(modal !== null || downloadAllOpen, () => {
    setModal(null);
    setDownloadAllOpen(false);
  });

  const user: User = { ...seedUser, ...identity };
  const epaCard: EpaCardOrder | undefined =
    epaCanceled && base.epaCard ? { ...base.epaCard, status: "Canceled" } : base.epaCard;
  const p = { ...base, nate, epaCard };

  const canCancelEpa = !epaCanceled && !!base.epaCard && isEpaOrderCancelable(base.epaCard);
  const epaPurchase = base.purchases.find((pu) => pu.kind === "EPA Card");

  // Cancellation applies only to subscriptions we bill directly (Stripe) or
  // that expose a cancel API (Google); Apple subs are managed by Apple.
  const canCancelSub =
    !subCanceled &&
    user.subscriptionStatus === "Subscriber" &&
    (p.subscription.platform === "Stripe" || p.subscription.platform === "Google");

  function saveIdentity(v: { name: string; email: string; phone: string }) {
    setIdentity((prev) => ({
      name: v.name,
      email: v.email,
      phone: v.phone,
      // Changing a contact field invalidates its verified status.
      emailVerified: prev.emailVerified && v.email === prev.email,
      phoneVerified: prev.phoneVerified && v.phone === prev.phone,
    }));
    setModal(null);
  }

  /* Same two transitions the Manage IDs table applies: a replacement re-takes
     the upload stamp (and the approval stamp, or drops it — it described the
     document that was just replaced); an approval only records the decision. */
  function replaceId(status: IdStatus) {
    const now = nowIdStamp();
    setIdRecord((r) => ({
      ...r,
      status,
      uploadedAt: now,
      approvedAt: status === "approved" ? now : undefined,
    }));
  }

  /* Approving leaves the popup open on the document it just decided — the
     Approve button drops out of the footer, same as on the Manage IDs table. */
  function approveId() {
    setIdRecord((r) => ({ ...r, status: "approved", approvedAt: nowIdStamp() }));
  }

  /* The Public Portfolio Link field points at the standalone portfolio page, in
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
          {/* ── header — breadcrumb over the identity row, actions on the right ── */}
          <header className="tasks-header">
            <div className="rvc-pagehead">
              <nav className="rvc-crumbs" aria-label="Breadcrumb">
                <span className="rvc-crumb">Home</span>
                <ChevronRightIcon />
                <button className="rvc-crumb" onClick={backToUsers} title="Back to Manage Users">
                  Manage Users
                </button>
                <ChevronRightIcon />
                <span className="rvc-crumb rvc-crumb--current">Full Profile</span>
              </nav>
              <div className="prof-headrow">
                <span className="mc-avatar prof-avatar">{initialsOf(user.name)}</span>
                <div className="rvc-pagehead-id">
                  <h1 className="tasks-title">{user.name}</h1>
                  <div className="tasks-subtitle">
                    <span className="prof-contact">
                      {user.email}
                      {user.emailVerified && <Verified />}
                    </span>
                    <span className="tasks-subtitle-dot" />
                    <span className="prof-contact">
                      {user.phone}
                      {user.phoneVerified && <Verified />}
                    </span>
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
              <ConfirmCard
                title="Profile"
                fillBlanks
                rows={[
                  ["Language", p.fields.language],
                  ["Goal", p.fields.goal, true],
                  ["Industry Preference", p.fields.industryPreference],
                  ["Current Company", p.fields.currentCompany],
                  [
                    "Zip Code",
                    ZIP_LOCATIONS[p.fields.zipCode]
                      ? `${p.fields.zipCode} · ${ZIP_LOCATIONS[p.fields.zipCode].city}, ${ZIP_LOCATIONS[p.fields.zipCode].state}, ${ZIP_LOCATIONS[p.fields.zipCode].country}`
                      : p.fields.zipCode,
                    true,
                  ],
                  ["Attribution", p.fields.attribution],
                  ["Notification Preference", p.fields.notificationPreference],
                  ["Role", user.role],
                  ["Joined SkillCat", formatDate(user.joinedOn)],
                  ["Last Access", formatDate(user.lastAccess)],
                  [
                    "Public Portfolio Link",
                    <a
                      className="rvc-headlink"
                      href={portfolioHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.portfolioUrl}
                    </a>,
                    true,
                  ],
                ]}
              />

              {/* Skills */}
              <ConfirmCard title={`Skills · ${p.skills.length}`} tableBody>
                <SkillsTable skills={p.skills} />
              </ConfirmCard>

              {/* Awards */}
              <ConfirmCard
                title={`Awards · ${p.awards.length}`}
                /* Figma 1278:1574 — the card head's own 24px "Button dialog",
                   the same component Merge's Swap Roles uses. */
                trailing={
                  p.awards.length > 0 && (
                    <button className="btn-dialog" onClick={() => setDownloadAllOpen(true)}>
                      <DownloadIcon /> Download All
                    </button>
                  )
                }
                tableBody
              >
                <AwardsTable userName={user.name} awards={p.awards} />
              </ConfirmCard>

              {/* Subscription */}
              <ConfirmCard
                title="Subscription"
                trailing={
                  canCancelSub && (
                    <button className="btn-save-draft mc-btn-sm" onClick={() => setModal("cancel-sub")}>
                      Cancel Subscription
                    </button>
                  )
                }
                fillBlanks
                rows={[
                  [
                    "Status",
                    subCanceled ? (
                      <span className="co-status-pill co-status-pill--grey">Canceled</span>
                    ) : (
                      p.subscription.status
                    ),
                  ],
                  ["Platform", p.subscription.platform],
                  ["Started", formatDate(p.subscription.startedOn)],
                  [subCanceled ? "Access Until" : "Renews", formatDate(p.subscription.renewsOn)],
                  ["Offer Code", p.subscription.offerCode ?? "None"],
                ]}
              />

              {/* Purchases / bills */}
              <PurchasesSection
                purchases={p.purchases}
                epaCancelable={canCancelEpa}
                epaCanceled={epaCanceled}
                onCancelEpa={() => setModal("cancel-epa")}
              />

              {/* EPA Card */}
              <ConfirmCard
                title="EPA Card Order"
                trailing={
                  canCancelEpa && (
                    <button className="btn-save-draft mc-btn-sm" onClick={() => setModal("cancel-epa")}>
                      Cancel Order
                    </button>
                  )
                }
                rows={
                  p.epaCard
                    ? [
                        ["Card", p.epaCard.certification],
                        [
                          "Status",
                          <span className={`co-status-pill co-status-pill--${EPA_TONE[p.epaCard.status]}`}>
                            {p.epaCard.status}
                          </span>,
                        ],
                        ["Ordered", formatDate(p.epaCard.orderedOn)],
                        ["Recipient", p.epaCard.recipient],
                        ["Shipping Address", p.epaCard.shippingAddress, true],
                        p.epaCard.tracking
                          ? [
                              "Tracking",
                              <a href={p.epaCard.tracking.url} target="_blank" rel="noreferrer" className="rvc-headlink">
                                {p.epaCard.tracking.carrier} · {p.epaCard.tracking.number} (shipped {formatDate(p.epaCard.tracking.shippedOn)})
                              </a>,
                              true,
                            ]
                          : ["Tracking", undefined, true],
                      ]
                    : undefined
                }
              >
                {!p.epaCard && <p className="form-help">No EPA card ordered.</p>}
              </ConfirmCard>

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
            {
              /* The Manage IDs popup, opened on this user's own document —
                 same modal, same Replace / Approve flows. */
              label: "View ID",
              icon: <IdCardIcon />,
              onPick: () => setIdOpen(true),
            },
            {
              label: "Edit User Details",
              icon: <RowEditIcon />,
              onPick: () => setModal("edit-user"),
            },
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
          }}
        />
      )}
      {modal === "cancel-epa" && base.epaCard && (
        <PrmModal
          title="Cancel EPA Card Order?"
          cancelLabel="Keep Order"
          confirmLabel="Cancel Order"
          onCancel={() => setModal(null)}
          onConfirm={() => {
            setEpaCanceled(true);
            setModal(null);
          }}
        >
          <p className="prm-text">
            This cancels the <strong>{base.epaCard.certification} Physical Card</strong> ordered on{" "}
            <strong>{formatDate(base.epaCard.orderedOn)}</strong>. The card will not be produced or
            shipped.
          </p>
          {epaPurchase && (
            <p className="prm-text">
              The <strong>{money(epaPurchase.amount)}</strong> charge ({epaPurchase.receiptId}) is
              refunded to the original {epaPurchase.platform} payment method.
            </p>
          )}
        </PrmModal>
      )}
      {modal === "cancel-sub" && (
        <CancelSubscriptionModal
          user={user}
          platform={p.subscription.platform!}
          renewsOn={p.subscription.renewsOn}
          onClose={() => setModal(null)}
          onConfirm={() => {
            setSubCanceled(true);
            setModal(null);
          }}
        />
      )}
      {downloadAllOpen && (
        <DownloadAllAwardsModal
          userName={user.name}
          awards={p.awards}
          onClose={() => setDownloadAllOpen(false)}
        />
      )}
      {idOpen && (
        <IdModal
          /* The identity fields come off the (possibly edited) profile so the
             popup never shows a name the page has already renamed. */
          record={{ ...idRecord, name: user.name, email: user.email, phone: user.phone }}
          onClose={() => setIdOpen(false)}
          onReplace={replaceId}
          onApprove={() => approveId()}
        />
      )}
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
      <table className="table sch-table sch-table--tight">
        {/* Every column sized, the Skill one included — see SKILL_COLS. */}
        <colgroup>
          <col style={{ width: SKILL_COLS.skill }} />
          <col style={{ width: SKILL_COLS.type }} />
          <col style={{ width: SKILL_COLS.date }} />
        </colgroup>
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="sch-empty">No skills earned yet.</td>
            </tr>
          )}
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

function AwardsTable({ userName, awards }: { userName: string; awards: AwardRecord[] }) {
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
      <table className="table sch-table sch-table--tight">
        <colgroup>
          <col style={{ width: AWARD_COLS.certification }} />
          <col style={{ width: AWARD_COLS.tier }} />
          <col style={{ width: AWARD_COLS.number }} />
          <col style={{ width: AWARD_COLS.date }} />
          <col style={{ width: AWARD_COLS.actions }} />
        </colgroup>
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="sch-empty">No awards yet.</td>
            </tr>
          )}
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
              onPick: () =>
                downloadFile(
                  `${menu.award.awardNumber}-card.svg`,
                  awardCardSvg(userName, menu.award),
                  "image/svg+xml",
                ),
            },
            {
              /* Disabled-with-a-reason rather than hidden: an Award that never
                 had a Certificate should say so, which is what the dropped
                 "Appearances" column used to carry. */
              label: "Download Certificate",
              icon: <DownloadIcon />,
              disabled: !menu.award.hasCertificate,
              title: menu.award.hasCertificate ? undefined : "This Award has no Certificate",
              onPick: () =>
                downloadFile(
                  `${menu.award.awardNumber}-certificate.svg`,
                  awardCertSvg(userName, menu.award),
                  "image/svg+xml",
                ),
            },
          ]}
        />
      )}
    </div>
  );
}

/* The row menu behind a card table's kebab — the shared `.u-menu` chrome,
   fixed-positioned and right-anchored to the glyph, closing on outside click /
   scroll / Escape like every other row menu. */
type RowMenuItem = {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  /** Why it is disabled — the shared tooltip adopts it. */
  title?: string;
  onPick: () => void;
};

function RowMenu({
  rect, items, onClose,
}: {
  rect: DOMRect;
  items: RowMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    let top = rect.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 6);
    setPos({ top });
  }, [rect]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onScroll() { onClose(); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="u-menu"
      style={{
        top: pos ? pos.top : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        visibility: pos ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it) => (
        <button
          key={it.label}
          className="u-menu-item"
          disabled={it.disabled}
          title={it.title}
          onClick={() => {
            it.onPick();
            onClose();
          }}
        >
          {it.icon && <span className="u-menu-item-icon">{it.icon}</span>}
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* The kebab at the end of every row: the node's resting glyph, swapped on hover
   for the shared `.row-action-bar` pill (Figma 386:269) exactly as every list
   table does it — one cell here, since the menu holds the actions. Without the
   bar the bare glyph kept the button's own hover wash, which read as a grey box
   dropped on the row. */
function RowKebab({ onOpen }: { onOpen: (rect: DOMRect) => void }) {
  const open = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onOpen(e.currentTarget.getBoundingClientRect());
  };
  return (
    <td className="col-actions">
      <button className="row-action-btn lone-dots" aria-label="More" onClick={open}>
        <RowKebabIcon />
      </button>
      <div className="row-action-bar">
        <button className="row-action-btn" aria-label="More" onClick={open}>
          <RowKebabIcon />
        </button>
      </div>
    </td>
  );
}

/* ── Download All Awards — every Card/Certificate as a check row, all selected ── */
function DownloadAllAwardsModal({
  userName,
  awards,
  onClose,
}: {
  userName: string;
  awards: AwardRecord[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    awards.forEach((a) => {
      init[`${a.id}-card`] = true;
      if (a.hasCertificate) init[`${a.id}-cert`] = true;
    });
    return init;
  });

  function toggle(key: string) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function unselectAll(kind: "card" | "cert") {
    setSelected((prev) => {
      const next = { ...prev };
      awards.forEach((a) => {
        const key = `${a.id}-${kind}`;
        if (key in next) next[key] = false;
      });
      return next;
    });
  }

  const count = Object.values(selected).filter(Boolean).length;

  function downloadSelected() {
    awards.forEach((a) => {
      if (selected[`${a.id}-card`]) {
        downloadFile(`${a.awardNumber}-card.svg`, awardCardSvg(userName, a), "image/svg+xml");
      }
      if (a.hasCertificate && selected[`${a.id}-cert`]) {
        downloadFile(`${a.awardNumber}-certificate.svg`, awardCertSvg(userName, a), "image/svg+xml");
      }
    });
    onClose();
  }

  return (
    <PrmModal
      title="Download All Awards"
      description={`Choose which Cards and Certificates to download for ${userName}.`}
      confirmLabel={
        <>
          <DownloadIcon /> Download{count > 0 ? ` (${count})` : ""}
        </>
      }
      confirmDisabled={count === 0}
      onCancel={onClose}
      onConfirm={downloadSelected}
    >
      <div className="prm-field">
        <div className="prm-checklist">
          {awards.map((a) => (
            <div key={a.id}>
              <CheckRow
                on={!!selected[`${a.id}-card`]}
                label={`${a.certification} — Card`}
                onToggle={() => toggle(`${a.id}-card`)}
              />
              {a.hasCertificate && (
                <CheckRow
                  on={!!selected[`${a.id}-cert`]}
                  label={`${a.certification} — Certificate`}
                  onToggle={() => toggle(`${a.id}-cert`)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="prof-unselect-row">
          <button className="filter-clear-link" onClick={() => unselectAll("card")}>
            Unselect all Cards
          </button>
          <button className="filter-clear-link" onClick={() => unselectAll("cert")}>
            Unselect all Certificates
          </button>
        </div>
      </div>
    </PrmModal>
  );
}

function CheckRow({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button className="prm-check-row" onClick={onToggle} role="checkbox" aria-checked={on}>
      <PrmCheck on={on} />
      <span className="prm-check-label">{label}</span>
    </button>
  );
}

/* ── Edit modals — session-local admin edits over the seeded record ── */

function PrmField({
  label,
  value,
  onChange,
  error,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="prm-field">
      <label className="prm-label">
        {label}
        <span className="prm-req">*</span>
      </label>
      <input
        className={`form-input ${error ? "has-error" : ""}`}
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="form-error-text">{error}</p>}
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

  const errors = {
    name: form.name.trim() ? "" : "Name is required.",
    email: !form.email.trim()
      ? "Email is required."
      : EMAIL_RE.test(form.email.trim())
      ? ""
      : "Enter a valid email address.",
    phone: form.phone.trim() ? "" : "Phone is required.",
  };
  const invalid = Boolean(errors.name || errors.email || errors.phone);

  function submit() {
    setSubmitted(true);
    if (invalid) return;
    onSave({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
  }

  return (
    <PrmModal
      title="Edit User"
      description="Changing the email or phone resets its verified status."
      confirmLabel="Save Changes"
      onCancel={onClose}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <PrmField
          label="Name"
          value={form.name}
          autoFocus
          onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          error={submitted ? errors.name : undefined}
        />
        <PrmField
          label="Email"
          value={form.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          error={submitted ? errors.email : undefined}
        />
        <PrmField
          label="Phone"
          value={form.phone}
          onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          error={submitted ? errors.phone : undefined}
        />
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
  const invalid = Boolean(errors.firstName || errors.lastName || errors.email || errors.connectId);

  function submit() {
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
      onCancel={onClose}
      onConfirm={submit}
    >
      <div className="prm-stack">
        <div className="form-row-2">
          <PrmField
            label="First Name"
            value={form.firstName}
            autoFocus
            onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
            error={submitted ? errors.firstName : undefined}
          />
          <PrmField
            label="Last Name"
            value={form.lastName}
            onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
            error={submitted ? errors.lastName : undefined}
          />
        </div>
        <PrmField
          label="Email"
          value={form.email}
          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          error={submitted ? errors.email : undefined}
        />
        <PrmField
          label="NATE Connect ID"
          value={form.connectId}
          placeholder="e.g. 483920"
          onChange={(v) => setForm((f) => ({ ...f, connectId: v }))}
          error={submitted ? errors.connectId : undefined}
        />
      </div>
    </PrmModal>
  );
}

/* Also used by Manage Users' row-menu Cancel Subscription action. */
export function CancelSubscriptionModal({
  user,
  platform,
  renewsOn,
  onClose,
  onConfirm,
}: {
  user: User;
  platform: string;
  renewsOn?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  useEscape(true, onClose);
  return (
    <PrmModal
      title="Cancel Subscription?"
      cancelLabel="Keep Subscription"
      confirmLabel="Cancel Subscription"
      onCancel={onClose}
      onConfirm={onConfirm}
    >
      <p className="prm-text">
        This cancels <strong>{user.name}</strong>&rsquo;s {platform} subscription at the end of the
        current billing period. No further charges will be made.
      </p>
      {renewsOn && (
        <p className="prm-text">
          They keep full access until <strong>{formatDate(renewsOn)}</strong>. No refund is issued
          for the current period.
        </p>
      )}
    </PrmModal>
  );
}

/* ── Purchases & Bills — one list of every purchase, narrowed by the Purchase
 * Type filter pill (Figma 1288:2876). It was four tabs until 2026-09-22; a tab
 * bar forces a choice and hides the rest, where the pill starts unapplied and
 * shows everything. That means one column set for all four kinds: the kind
 * itself is now a column, and Status — which only a Certification or a Quiz
 * Attempt carries — prints an em-dash for the others. ── */
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

// Refunds are issued by us only for purchases we process directly (Stripe/Google);
// Apple in-app purchases are refunded by Apple. Limited to certs & quiz attempts.
const REFUNDABLE_PLATFORMS = ["Stripe", "Google"];
function isRefundable(pu: Purchase): boolean {
  return (
    (pu.kind === "Certification" || pu.kind === "Quiz Attempt") &&
    REFUNDABLE_PLATFORMS.includes(pu.platform) &&
    !pu.refunded
  );
}

/* Definite widths on EVERY column, the first one included: a fixed-layout table
   hands its slack to the auto column alone, so an unsized first column swallowed
   the whole card and left the rest bunched at the right. With all of them sized,
   the slack spreads in proportion and the columns stay evenly spaced. */
const PURCHASE_COLS = {
  date: 130,
  item: 280,
  type: 160,
  status: 210,
  platform: 120,
  receipt: 160,
  amount: 100,
  actions: 40,
};
const PURCHASE_TABLE_MIN = Object.values(PURCHASE_COLS).reduce((a, b) => a + b, 0);

function PurchasesSection({
  purchases,
  epaCancelable,
  epaCanceled,
  onCancelEpa,
}: {
  purchases: Purchase[];
  epaCancelable: boolean;
  epaCanceled: boolean;
  onCancelEpa: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  // Track refunds applied in this session. Keyed by the purchase's index in the
  // original array — receiptIds aren't unique across purchases, so they can't key this.
  const [refunded, setRefunded] = useState<Record<number, boolean>>({});
  const [refundTarget, setRefundTarget] = useState<(Purchase & { idx: number }) | null>(null);
  const [rowMenu, setRowMenu] = useState<{ idx: number; rect: DOMRect } | null>(null);

  useEscape(refundTarget !== null, () => setRefundTarget(null));

  // Tag each purchase with its stable index, narrow to the picked types, and
  // show the newest first — with every kind in one list, date is the only order
  // that means anything.
  const rows = useMemo(
    () =>
      purchases
        .map((pu, idx) => ({ ...pu, idx, refunded: refunded[idx] || pu.refunded }))
        .filter((pu) => typeFilter.length === 0 || typeFilter.includes(KIND_LABEL[pu.kind]))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [purchases, typeFilter, refunded],
  );

  /* Status carries what the old per-tab action cell used to say in words — a
     refunded charge, a canceled order — now that the action itself is a menu
     item behind the row kebab. */
  function statusCell(pu: Purchase) {
    if (pu.kind === "EPA Card") return epaCanceled ? "Canceled · Refunded" : "—";
    if (pu.refunded) return "Refunded";
    if (pu.kind === "Certification") return certStatusPill(pu);
    if (pu.kind === "Quiz Attempt") return attemptStatusPill(pu);
    return "—";
  }

  /* A Subscription charge has nothing to do to it, so its row has no kebab. */
  function menuItems(pu: Purchase & { idx: number }): RowMenuItem[] {
    if (pu.kind === "Certification" || pu.kind === "Quiz Attempt") {
      if (pu.refunded) return [];
      return [
        {
          label: "Refund",
          icon: <MenuInvoiceIcon />,
          disabled: !isRefundable(pu),
          title: isRefundable(pu)
            ? undefined
            : `${pu.platform} purchases are not refundable here`,
          onPick: () => setRefundTarget(pu),
        },
      ];
    }
    if (pu.kind === "EPA Card") {
      if (epaCanceled) return [];
      return [
        {
          label: "Cancel Order",
          icon: <MenuCancelSubIcon />,
          disabled: !epaCancelable,
          title: epaCancelable
            ? undefined
            : `Orders can only be canceled within ${EPA_CANCEL_WINDOW_DAYS} days of ordering, before they ship`,
          onPick: onCancelEpa,
        },
      ];
    }
    return [];
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
        {/* Same chrome as the Awards table (1278:1571): the card tables take the
            base 12px cell inset, not the .sch-table shell's roomier 16px. */}
        <table className="table sch-table sch-table--tight">
          <colgroup>
            <col style={{ width: PURCHASE_COLS.date }} />
            <col style={{ width: PURCHASE_COLS.item }} />
            <col style={{ width: PURCHASE_COLS.type }} />
            <col style={{ width: PURCHASE_COLS.status }} />
            <col style={{ width: PURCHASE_COLS.platform }} />
            <col style={{ width: PURCHASE_COLS.receipt }} />
            <col style={{ width: PURCHASE_COLS.amount }} />
            <col style={{ width: PURCHASE_COLS.actions }} />
          </colgroup>
          <thead>
            <tr>
              <th className="no-sort">Date</th>
              <th className="no-sort">Item</th>
              <th className="no-sort">Purchase Type</th>
              <th className="no-sort">Status</th>
              <th className="no-sort">Platform</th>
              <th className="no-sort">Receipt</th>
              <th className="no-sort">Amount</th>
              <th className="no-sort col-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((pu) => (
              <tr key={pu.idx}>
                <td className="col-date">{formatDate(pu.date)}</td>
                <td className="col-name">{pu.item}</td>
                <td>{KIND_LABEL[pu.kind]}</td>
                <td className="col-status">{statusCell(pu)}</td>
                <td>{pu.platform}</td>
                <td>{pu.receiptId}</td>
                <td>{money(pu.amount)}</td>
                {menuItems(pu).length > 0 ? (
                  <RowKebab onOpen={(rect) => setRowMenu({ idx: pu.idx, rect })} />
                ) : (
                  <td className="col-actions" />
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="sch-empty">
                  {typeFilter.length > 0
                    ? "No purchases of this type on record."
                    : "No purchases on record."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rowMenu &&
        (() => {
          const pu = rows.find((r) => r.idx === rowMenu.idx);
          return pu ? (
            <RowMenu rect={rowMenu.rect} items={menuItems(pu)} onClose={() => setRowMenu(null)} />
          ) : null;
        })()}

      {refundTarget && (
        <PrmModal
          title="Refund Purchase?"
          cancelLabel="Keep Charge"
          confirmLabel={`Refund ${money(refundTarget.amount)}`}
          onCancel={() => setRefundTarget(null)}
          onConfirm={() => {
            setRefunded((r) => ({ ...r, [refundTarget.idx]: true }));
            setRefundTarget(null);
          }}
        >
          <p className="prm-text">
            This refunds <strong>{money(refundTarget.amount)}</strong> for{" "}
            <strong>{refundTarget.item}</strong>.
          </p>
          <p className="prm-text">
            The {refundTarget.receiptId} charge is returned to the original {refundTarget.platform}{" "}
            payment method.
          </p>
        </PrmModal>
      )}
    </ConfirmCard>
  );
}

/* Status cells use the shared table pill set (Figma 109:1237) — the td's
   .col-status class is what re-enables their chrome past the plain-text rule. */
function certStatusPill(pu: Purchase) {
  if (!pu.consumable)
    return <span className="co-status-pill co-status-pill--green">Lifetime Access</span>;
  const when = pu.expiresOn ? formatDate(pu.expiresOn) : "";
  if (pu.certAccess === "Active")
    return (
      <span className="co-status-pill co-status-pill--green">
        {when ? `Active · Expires ${when}` : "Active"}
      </span>
    );
  if (pu.certAccess === "Expired")
    return (
      <span className="co-status-pill co-status-pill--yellow">
        {when ? `Expired · ${when}` : "Expired"}
      </span>
    );
  if (pu.certAccess === "Revoked")
    return (
      <span className="co-status-pill co-status-pill--red">
        {when ? `Revoked · ${when}` : "Revoked"}
      </span>
    );
  return null;
}

function attemptStatusPill(pu: Purchase) {
  switch (pu.attemptState) {
    case "Available":
      return <span className="co-status-pill co-status-pill--green">Available</span>;
    case "In Progress":
      return <span className="co-status-pill co-status-pill--yellow">In Progress</span>;
    case "Completed":
      return <span className="co-status-pill co-status-pill--grey">Used · Completed</span>;
    default:
      return null;
  }
}
