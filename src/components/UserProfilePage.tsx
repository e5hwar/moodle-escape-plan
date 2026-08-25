import { useEffect, useMemo, useState } from "react";
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
} from "../data/userProfile";
import type { User } from "../data/users";
import { idRecordForUser, nowIdStamp, type IdRecord, type IdStatus } from "../data/manageIds";
import { SectionHeading } from "./SectionHeading";
import { PrmModal } from "./PrmModal";
import { PrmCheck } from "./ProctoringConsole";
import { IdModal } from "./IdModal";
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  DownloadIcon,
  IdCardIcon,
  MenuEnterIcon,
  PencilIcon,
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
  if (!iso) return "—";
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

function loginAs(user: User) {
  const win = window.open("", "_blank", "noopener");
  if (!win) return;
  win.document.title = `Session — ${user.name}`;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"/>
<title>Logged in as ${escapeXml(user.name)}</title>
<style>:root{color-scheme:dark}body{margin:0;background:#0b0b0c;color:#e7e7e8;font-family:"Fira Sans",-apple-system,system-ui,sans-serif}
.bar{background:#7a3a18;color:#ffd9c2;padding:10px 20px;font-size:14px;font-weight:600;display:flex;gap:10px;align-items:center}
.wrap{max-width:640px;margin:0 auto;padding:60px 24px;text-align:center}
.av{width:80px;height:80px;border-radius:50%;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;background:radial-gradient(70% 70% at 50% 40%,#e97237,#8a3114)}
h1{font-size:24px;margin:0 0 6px}p{color:#9a9aa0}</style></head>
<body><div class="bar">⚠ Admin impersonation session — you are viewing SkillCat as this user. Your own session is unaffected.</div>
<div class="wrap"><div class="av">${escapeXml(initialsOf(user.name))}</div>
<h1>${escapeXml(user.name)}</h1><p>${escapeXml(user.email)}</p>
<p style="margin-top:24px">This is a simulated learner session opened from the admin Full Profile.</p></div></body></html>`);
  win.document.close();
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

  function openPortfolio() {
    window.open(
      `${window.location.origin}${window.location.pathname}?portfolio=${user.id}`,
      "_blank",
      "noopener",
    );
  }

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
                    <span className={`u-pill u-type--${user.userType.toLowerCase()}`}>{user.userType}</span>
                    <span className="prof-contact">
                      {user.email}
                      {user.emailVerified && <Verified />}
                    </span>
                    <span className="tasks-subtitle-dot" />
                    <span className="prof-contact">
                      {user.phone}
                      {user.phoneVerified && <Verified />}
                    </span>
                    <span className="tasks-subtitle-dot" />
                    <span>{user.id}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="tasks-header-actions">
              {/* The Manage IDs popup, opened on this user's own document —
                  same modal, same Replace / Approve flows. */}
              <button className="cta-quiet" onClick={() => setIdOpen(true)}>
                <IdCardIcon /> View ID
              </button>
              <button className="cta-quiet" onClick={() => setModal("edit-user")}>
                <PencilIcon /> Edit
              </button>
              <button className="cta-primary" onClick={() => loginAs(user)}>
                <MenuEnterIcon /> Login As
              </button>
            </div>
          </header>

          <div className="prof-scroll">
            {/* Profile fields */}
            <SectionHeading label="Profile" />
            <div className="co-detail-grid prof-grid">
              <Field label="Language" value={p.fields.language} />
              <Field label="Goal" value={p.fields.goal} />
              <Field label="Industry Preference" value={p.fields.industryPreference} />
              <Field label="Current Company" value={p.fields.currentCompany ?? "—"} />
              <Field
                label="Zip Code"
                value={
                  ZIP_LOCATIONS[p.fields.zipCode]
                    ? `${p.fields.zipCode} · ${ZIP_LOCATIONS[p.fields.zipCode].city}, ${ZIP_LOCATIONS[p.fields.zipCode].state}, ${ZIP_LOCATIONS[p.fields.zipCode].country}`
                    : p.fields.zipCode
                }
              />
              <Field label="Attribution" value={p.fields.attribution} />
              <Field label="Notification Preference" value={p.fields.notificationPreference} />
              <Field label="Role" value={user.role} />
              <Field label="Joined SkillCat" value={formatDate(user.joinedOn)} />
              <Field label="Last Access" value={formatDate(user.lastAccess)} />
              <Field label="Profile Photo" value="Initials avatar (no photo uploaded)" />
            </div>

            {/* Skills */}
            <SectionHeading label={`Skills · ${p.skills.length}`} />
            <div className="prof-badges">
              {p.skills.map((s) =>
                s.mastery ? (
                  <span key={s.name} className="co-status-pill co-status-pill--yellow">
                    {s.name} · Mastery
                  </span>
                ) : (
                  <span key={s.name} className="co-pill-muted">{s.name}</span>
                ),
              )}
            </div>

            {/* Portfolio */}
            <SectionHeading label="Portfolio" />
            <div className="prof-portfolio">
              <div className="co-dt-item">
                <div className="co-dt-label">Public portfolio link</div>
                <div className="co-dt-value">
                  <a className="rvc-headlink" href={p.portfolioUrl} target="_blank" rel="noreferrer">
                    {p.portfolioUrl}
                  </a>
                </div>
              </div>
              <button className="btn-save-draft" onClick={openPortfolio}>
                <ArrowUpRightIcon /> Open in New Tab
              </button>
            </div>

            {/* Awards */}
            <SectionHeading
              label={`Awards · ${p.awards.length}`}
              trailing={
                p.awards.length > 0 && (
                  <button className="btn-save-draft mc-btn-sm" onClick={() => setDownloadAllOpen(true)}>
                    <DownloadIcon /> Download All
                  </button>
                )
              }
            />
            <table className="table sch-table" style={{ width: 1140 }}>
              <colgroup>
                <col />
                <col style={{ width: 130 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 250 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Certification</th>
                  <th>Merit Tier</th>
                  <th>Award Number</th>
                  <th>Date Awarded</th>
                  <th>Appearances</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {p.awards.map((a) => (
                  <tr key={a.id}>
                    <td className="col-name">{a.certification}</td>
                    <td>{a.meritTier}</td>
                    <td>{a.awardNumber}</td>
                    <td className="col-date">{formatDate(a.dateAwarded)}</td>
                    <td>{a.hasCertificate ? "Card · Certificate" : "Card only"}</td>
                    <td>
                      <button
                        className="btn-save-draft mc-btn-sm"
                        onClick={() => downloadFile(`${a.awardNumber}-card.svg`, awardCardSvg(user.name, a), "image/svg+xml")}
                      >
                        <DownloadIcon /> Card
                      </button>
                      <button
                        className="btn-save-draft mc-btn-sm"
                        disabled={!a.hasCertificate}
                        title={a.hasCertificate ? "Download Certificate" : "This Award has no Certificate"}
                        onClick={() => downloadFile(`${a.awardNumber}-certificate.svg`, awardCertSvg(user.name, a), "image/svg+xml")}
                      >
                        <DownloadIcon /> Certificate
                      </button>
                    </td>
                  </tr>
                ))}
                {p.awards.length === 0 && (
                  <tr>
                    <td colSpan={6} className="sch-empty">No awards yet.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Subscription */}
            <SectionHeading
              label="Subscription"
              trailing={
                canCancelSub && (
                  <button className="btn-save-draft mc-btn-sm" onClick={() => setModal("cancel-sub")}>
                    Cancel Subscription
                  </button>
                )
              }
            />
            <div className="co-detail-grid prof-grid">
              <Field
                label="Status"
                value={
                  subCanceled ? (
                    <span className="co-status-pill co-status-pill--grey">Canceled</span>
                  ) : (
                    p.subscription.status
                  )
                }
              />
              <Field label="Platform" value={p.subscription.platform ?? "—"} />
              <Field label="Started" value={formatDate(p.subscription.startedOn)} />
              <Field
                label={subCanceled ? "Access Until" : "Renews"}
                value={formatDate(p.subscription.renewsOn)}
              />
              <Field label="Offer Code" value={p.subscription.offerCode ?? "None"} />
            </div>

            {/* Purchases / bills */}
            <PurchasesSection
              purchases={p.purchases}
              epaCancelable={canCancelEpa}
              epaCanceled={epaCanceled}
              onCancelEpa={() => setModal("cancel-epa")}
            />

            {/* EPA Card */}
            <SectionHeading
              label="EPA Card Order"
              trailing={
                canCancelEpa && (
                  <button className="btn-save-draft mc-btn-sm" onClick={() => setModal("cancel-epa")}>
                    Cancel Order
                  </button>
                )
              }
            />
            {p.epaCard ? (
              <div className="co-detail-grid prof-grid">
                <Field label="Card" value={p.epaCard.certification} />
                <Field
                  label="Status"
                  value={
                    <span className={`co-status-pill co-status-pill--${EPA_TONE[p.epaCard.status]}`}>
                      {p.epaCard.status}
                    </span>
                  }
                />
                <Field label="Ordered" value={formatDate(p.epaCard.orderedOn)} />
                <Field label="Recipient" value={p.epaCard.recipient} />
                <Field label="Shipping Address" value={p.epaCard.shippingAddress} wide />
                {p.epaCard.tracking && (
                  <Field
                    label="Tracking"
                    wide
                    value={
                      <a href={p.epaCard.tracking.url} target="_blank" rel="noreferrer" className="rvc-headlink">
                        {p.epaCard.tracking.carrier} · {p.epaCard.tracking.number} (shipped {formatDate(p.epaCard.tracking.shippedOn)})
                      </a>
                    }
                  />
                )}
              </div>
            ) : (
              <p className="form-help">No EPA card ordered.</p>
            )}

            {/* NATE details */}
            <SectionHeading
              label="NATE Details"
              trailing={
                <button className="btn-save-draft mc-btn-sm" onClick={() => setModal("edit-nate")}>
                  <PencilIcon /> {p.nate ? "Edit" : "Add"}
                </button>
              }
            />
            {p.nate ? (
              <div className="co-detail-grid prof-grid">
                <Field label="First Name" value={p.nate.firstName} />
                <Field label="Last Name" value={p.nate.lastName} />
                <Field label="Email" value={p.nate.email} />
                <Field label="NATE Connect ID" value={p.nate.connectId} />
              </div>
            ) : (
              <p className="form-help">No NATE registration on record.</p>
            )}
          </div>
        </div>
      </div>

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

/* Label-over-value cell — the cert preview panel's detail item, laid out on
   the page-wide .prof-grid. */
function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className="co-dt-item" style={wide ? { gridColumn: "1 / -1" } : undefined}>
      <div className="co-dt-label">{label}</div>
      <div className="co-dt-value">{value}</div>
    </div>
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
      wide
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

function EditUserModal({
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
      wide
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
      wide
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

/* ── Purchases & Bills — tabbed by category, with refunds for certs & attempts ── */
const PURCHASE_TABS: { label: string; kind: PurchaseKind }[] = [
  { label: "Subscription", kind: "Subscription" },
  { label: "Certifications", kind: "Certification" },
  { label: "Quiz Attempts", kind: "Quiz Attempt" },
  { label: "Physical Products", kind: "EPA Card" },
];

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

/* Definite table widths per tab — the shared .table is fixed-layout, and the
   Item column absorbs whatever these totals leave over. */
const TAB_WIDTH: Record<PurchaseKind, number> = {
  Subscription: 940,
  Certification: 1420,
  "Quiz Attempt": 1230,
  "EPA Card": 1090,
};

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
  const [active, setActive] = useState<PurchaseKind>("Subscription");
  // Track refunds applied in this session. Keyed by the purchase's index in the
  // original array — receiptIds aren't unique across purchases, so they can't key this.
  const [refunded, setRefunded] = useState<Record<number, boolean>>({});
  const [refundTarget, setRefundTarget] = useState<(Purchase & { idx: number }) | null>(null);

  useEscape(refundTarget !== null, () => setRefundTarget(null));

  // Tag each purchase with its stable index, then filter to the active tab.
  const rows = useMemo(
    () =>
      purchases
        .map((pu, idx) => ({ ...pu, idx, refunded: refunded[idx] || pu.refunded }))
        .filter((pu) => pu.kind === active),
    [purchases, active, refunded],
  );

  const withActions = active !== "Subscription";
  const withType = active === "Certification";
  const withStatus = active === "Certification" || active === "Quiz Attempt";

  return (
    <>
      <SectionHeading label={`Purchases & Bills · ${purchases.length}`} />

      <div className="tabbar prof-tabs" role="tablist">
        {PURCHASE_TABS.map((t) => (
          <button
            key={t.kind}
            role="tab"
            aria-selected={active === t.kind}
            className={`tab ${active === t.kind ? "is-active" : ""}`}
            onClick={() => setActive(t.kind)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <table className="table sch-table" style={{ width: TAB_WIDTH[active] }}>
        <colgroup>
          <col style={{ width: 150 }} />
          <col />
          {withType && <col style={{ width: 170 }} />}
          {withStatus && <col style={{ width: 230 }} />}
          <col style={{ width: 130 }} />
          <col style={{ width: 170 }} />
          <col style={{ width: 120 }} />
          {withActions && <col style={{ width: 170 }} />}
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            <th>Item</th>
            {withType && <th>Type</th>}
            {withStatus && <th>Status</th>}
            <th>Platform</th>
            <th>Receipt</th>
            <th>Amount</th>
            {withActions && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((pu) => (
            <tr key={pu.idx}>
              <td className="col-date">{formatDate(pu.date)}</td>
              <td className="col-name">{pu.item}</td>
              {withType && <td>{pu.consumable ? "Consumable" : "Non-Consumable"}</td>}
              {active === "Certification" && <td className="col-status">{certStatusPill(pu)}</td>}
              {active === "Quiz Attempt" && <td className="col-status">{attemptStatusPill(pu)}</td>}
              <td>{pu.platform}</td>
              <td>{pu.receiptId}</td>
              <td>{money(pu.amount)}</td>
              {(active === "Certification" || active === "Quiz Attempt") && (
                <td>
                  {pu.refunded ? (
                    <span>Refunded</span>
                  ) : (
                    <button
                      className="btn-save-draft mc-btn-sm"
                      disabled={!isRefundable(pu)}
                      title={
                        isRefundable(pu)
                          ? "Issue a refund"
                          : `${pu.platform} purchases are not refundable here`
                      }
                      onClick={() => setRefundTarget(pu)}
                    >
                      Refund
                    </button>
                  )}
                </td>
              )}
              {active === "EPA Card" && (
                <td>
                  {epaCanceled ? (
                    <span>Canceled · Refunded</span>
                  ) : (
                    <button
                      className="btn-save-draft mc-btn-sm"
                      disabled={!epaCancelable}
                      title={
                        epaCancelable
                          ? "Cancel this order and refund the charge"
                          : `Orders can only be canceled within ${EPA_CANCEL_WINDOW_DAYS} days of ordering, before they ship`
                      }
                      onClick={onCancelEpa}
                    >
                      Cancel Order
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={5 + (withType ? 1 : 0) + (withStatus ? 1 : 0) + (withActions ? 1 : 0)}
                className="sch-empty"
              >
                No {active.toLowerCase()} purchases on record.
              </td>
            </tr>
          )}
        </tbody>
      </table>

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
    </>
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
  return <span>—</span>;
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
      return <span>—</span>;
  }
}
