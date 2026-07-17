import { useEffect, useMemo, useState } from "react";
import {
  buildUserProfile,
  PROFILE_TODAY,
  ZIP_LOCATIONS,
  type AwardRecord,
  type EpaCardOrder,
  type MeritTier,
  type NateDetail,
  type Purchase,
  type PurchaseKind,
} from "../data/userProfile";
import type { User } from "../data/users";

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

  function openPortfolio() {
    window.open(
      `${window.location.origin}${window.location.pathname}?portfolio=${user.id}`,
      "_blank",
      "noopener",
    );
  }

  return (
    <div className="prof">
      <div className="prof-topbar">
        <span className="prof-topbar-brand">SkillCat Admin</span>
        <span className="prof-topbar-sep">/</span>
        <span className="prof-topbar-label">Full Profile</span>
        <button className="prof-loginas" onClick={() => loginAs(user)}>
          <PowerIcon /> Login As
        </button>
      </div>

      <div className="prof-body">
        {/* Identity header */}
        <section className="prof-hero">
          <div className="prof-avatar">{initialsOf(user.name)}</div>
          <div className="prof-hero-text">
            <div className="prof-name-row">
              <h1 className="prof-name">{user.name}</h1>
              <button className="prof-btn prof-btn--sm" onClick={() => setModal("edit-user")}>
                <PencilIcon /> Edit
              </button>
            </div>
            <div className="prof-hero-meta">
              <span className={`u-pill u-type--${user.userType.toLowerCase()}`}>{user.userType}</span>
              <span className="prof-contact">
                {user.email}
                {user.emailVerified && <VerifiedBadge />}
              </span>
              <span className="prof-dot" />
              <span className="prof-contact">
                {user.phone}
                {user.phoneVerified && <VerifiedBadge />}
              </span>
              <span className="prof-dot" />
              <span className="prof-muted">{user.id}</span>
            </div>
          </div>
        </section>

        {/* Profile fields */}
        <Card title="Profile">
          <div className="prof-fields">
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
        </Card>

        {/* Skills */}
        <Card title="Skills" count={p.skills.length}>
          <div className="prof-badges">
            {p.skills.map((s) => (
              <span key={s.name} className={`prof-badge ${s.mastery ? "prof-badge--mastery" : ""}`}>
                <MedalIcon />
                {s.name}
                {s.mastery && <span className="prof-badge-tag">Mastery</span>}
              </span>
            ))}
          </div>
        </Card>

        {/* Portfolio */}
        <Card title="Portfolio">
          <div className="prof-portfolio">
            <div>
              <div className="prof-portfolio-label">Public portfolio link</div>
              <a className="prof-portfolio-url" href={p.portfolioUrl} target="_blank" rel="noreferrer">
                {p.portfolioUrl}
              </a>
            </div>
            <button className="prof-btn" onClick={openPortfolio}>
              <ExternalLinkIcon /> Open in new tab
            </button>
          </div>
        </Card>

        {/* Awards */}
        <Card title="Awards" count={p.awards.length}>
          <table className="prof-table">
            <thead>
              <tr>
                <th>Certification</th>
                <th>Merit Tier</th>
                <th>Award Number</th>
                <th>Date Awarded</th>
                <th>Appearances</th>
                <th className="prof-table-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {p.awards.map((a) => (
                <tr key={a.id}>
                  <td className="prof-td-strong">{a.certification}</td>
                  <td>
                    <span className="prof-tier" style={{ color: TIER_HEX[a.meritTier], borderColor: TIER_HEX[a.meritTier] }}>
                      {a.meritTier}
                    </span>
                  </td>
                  <td className="prof-muted">{a.awardNumber}</td>
                  <td>{formatDate(a.dateAwarded)}</td>
                  <td className="prof-muted">{a.hasCertificate ? "Card · Certificate" : "Card only"}</td>
                  <td className="prof-table-actions">
                    <button
                      className="prof-btn prof-btn--sm"
                      onClick={() => downloadFile(`${a.awardNumber}-card.svg`, awardCardSvg(user.name, a), "image/svg+xml")}
                    >
                      <DownloadIcon /> Card
                    </button>
                    <button
                      className="prof-btn prof-btn--sm"
                      disabled={!a.hasCertificate}
                      title={a.hasCertificate ? "Download Certificate" : "This Award has no Certificate"}
                      onClick={() => downloadFile(`${a.awardNumber}-certificate.svg`, awardCertSvg(user.name, a), "image/svg+xml")}
                    >
                      <DownloadIcon /> Certificate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Subscription */}
        <Card
          title="Subscription"
          action={
            canCancelSub && (
              <button
                className="prof-btn prof-btn--sm prof-btn--danger"
                onClick={() => setModal("cancel-sub")}
              >
                Cancel Subscription
              </button>
            )
          }
        >
          <div className="prof-fields">
            <Field
              label="Status"
              value={
                subCanceled ? (
                  <span className="prof-status prof-status--bad">Canceled</span>
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
        </Card>

        {/* Purchases / bills */}
        <PurchasesCard
          purchases={p.purchases}
          epaCancelable={canCancelEpa}
          epaCanceled={epaCanceled}
          onCancelEpa={() => setModal("cancel-epa")}
        />

        {/* EPA Card */}
        <Card
          title="EPA Card Order"
          action={
            canCancelEpa && (
              <button
                className="prof-btn prof-btn--sm prof-btn--danger"
                onClick={() => setModal("cancel-epa")}
              >
                Cancel Order
              </button>
            )
          }
        >
          {p.epaCard ? (
            <div className="prof-fields">
              <Field label="Card" value={p.epaCard.certification} />
              <Field
                label="Status"
                value={<span className={`epa-status epa-status--${p.epaCard.status.toLowerCase().replace(/\s+/g, "-")}`}>{p.epaCard.status}</span>}
              />
              <Field label="Ordered" value={formatDate(p.epaCard.orderedOn)} />
              <Field label="Recipient" value={p.epaCard.recipient} />
              <Field label="Shipping Address" value={p.epaCard.shippingAddress} wide />
              {p.epaCard.tracking && (
                <Field
                  label="Tracking"
                  wide
                  value={
                    <a href={p.epaCard.tracking.url} target="_blank" rel="noreferrer" className="prof-link">
                      {p.epaCard.tracking.carrier} · {p.epaCard.tracking.number} (shipped {formatDate(p.epaCard.tracking.shippedOn)})
                    </a>
                  }
                />
              )}
            </div>
          ) : (
            <div className="prof-empty">No EPA card ordered.</div>
          )}
        </Card>

        {/* NATE details */}
        <Card
          title="NATE Details"
          action={
            <button className="prof-btn prof-btn--sm" onClick={() => setModal("edit-nate")}>
              <PencilIcon /> {p.nate ? "Edit" : "Add"}
            </button>
          }
        >
          {p.nate ? (
            <div className="prof-fields">
              <Field label="First Name" value={p.nate.firstName} />
              <Field label="Last Name" value={p.nate.lastName} />
              <Field label="Email" value={p.nate.email} />
              <Field label="NATE Connect ID" value={p.nate.connectId} />
            </div>
          ) : (
            <div className="prof-empty">No NATE registration on record.</div>
          )}
        </Card>

        <div className="prof-foot">SkillCat Admin · Full Profile · {user.id}</div>
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
        <CancelEpaOrderModal
          order={base.epaCard}
          purchase={epaPurchase}
          onClose={() => setModal(null)}
          onConfirm={() => {
            setEpaCanceled(true);
            setModal(null);
          }}
        />
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
    </div>
  );
}

function Card({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="prof-card">
      <div className="prof-card-head">
        <h2 className="prof-card-title">{title}</h2>
        {count !== undefined && <span className="prof-card-count">{count}</span>}
        {action && <span className="prof-card-action">{action}</span>}
      </div>
      {children}
    </section>
  );
}

/* ── Edit modals — session-local admin edits over the seeded record ── */

function Modal({
  title,
  sub,
  onClose,
  footer,
  children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="pm-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pm-head">
          <h2 className="pm-title">{title}</h2>
          {sub && <div className="pm-sub">{sub}</div>}
        </div>
        <div className="pm-body">{children}</div>
        <div className="pm-foot">{footer}</div>
      </div>
    </div>
  );
}

function ModalField({
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
    <div className="pm-field">
      <label className="form-label">{label}</label>
      <input
        className="form-input"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <div className="pm-error">{error}</div>}
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
    <Modal
      title="Edit User"
      sub="Changing the email or phone resets its verified status."
      onClose={onClose}
      footer={
        <>
          <button className="prof-btn" onClick={onClose}>Cancel</button>
          <button className="prof-btn prof-btn--primary" onClick={submit}>Save Changes</button>
        </>
      }
    >
      <ModalField
        label="Name"
        value={form.name}
        autoFocus
        onChange={(v) => setForm((f) => ({ ...f, name: v }))}
        error={submitted ? errors.name : undefined}
      />
      <ModalField
        label="Email"
        value={form.email}
        onChange={(v) => setForm((f) => ({ ...f, email: v }))}
        error={submitted ? errors.email : undefined}
      />
      <ModalField
        label="Phone"
        value={form.phone}
        onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
        error={submitted ? errors.phone : undefined}
      />
    </Modal>
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
    <Modal
      title={initial ? "Edit NATE Details" : "Add NATE Details"}
      sub="These are the details the user registered with on the NATE form — they can differ from the SkillCat profile."
      onClose={onClose}
      footer={
        <>
          <button className="prof-btn" onClick={onClose}>Cancel</button>
          <button className="prof-btn prof-btn--primary" onClick={submit}>
            {initial ? "Save Changes" : "Add Details"}
          </button>
        </>
      }
    >
      <div className="pm-row2">
        <ModalField
          label="First Name"
          value={form.firstName}
          autoFocus
          onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
          error={submitted ? errors.firstName : undefined}
        />
        <ModalField
          label="Last Name"
          value={form.lastName}
          onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
          error={submitted ? errors.lastName : undefined}
        />
      </div>
      <ModalField
        label="Email"
        value={form.email}
        onChange={(v) => setForm((f) => ({ ...f, email: v }))}
        error={submitted ? errors.email : undefined}
      />
      <ModalField
        label="NATE Connect ID"
        value={form.connectId}
        placeholder="e.g. 483920"
        onChange={(v) => setForm((f) => ({ ...f, connectId: v }))}
        error={submitted ? errors.connectId : undefined}
      />
    </Modal>
  );
}

function CancelEpaOrderModal({
  order,
  purchase,
  onClose,
  onConfirm,
}: {
  order: EpaCardOrder;
  purchase?: Purchase;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title="Cancel EPA Card Order?"
      onClose={onClose}
      footer={
        <>
          <button className="prof-btn" onClick={onClose}>Keep Order</button>
          <button className="prof-btn prof-btn--danger" onClick={onConfirm}>
            Cancel Order
          </button>
        </>
      }
    >
      <p className="pm-text">
        This cancels the <strong>{order.certification} Physical Card</strong> ordered on{" "}
        <strong>{formatDate(order.orderedOn)}</strong>. The card will not be produced or shipped.
      </p>
      {purchase && (
        <p className="pm-text">
          The <strong>{money(purchase.amount)}</strong> charge ({purchase.receiptId}) is refunded to
          the original {purchase.platform} payment method.
        </p>
      )}
    </Modal>
  );
}

function CancelSubscriptionModal({
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
  return (
    <Modal
      title="Cancel Subscription?"
      onClose={onClose}
      footer={
        <>
          <button className="prof-btn" onClick={onClose}>Keep Subscription</button>
          <button className="prof-btn prof-btn--danger" onClick={onConfirm}>
            Cancel Subscription
          </button>
        </>
      }
    >
      <p className="pm-text">
        This cancels <strong>{user.name}</strong>&rsquo;s {platform} subscription at the end of the
        current billing period. No further charges will be made.
      </p>
      {renewsOn && (
        <p className="pm-text">
          They keep full access until <strong>{formatDate(renewsOn)}</strong>. No refund is issued
          for the current period.
        </p>
      )}
    </Modal>
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

function PurchasesCard({
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

  // Tag each purchase with its stable index, then filter to the active tab.
  const rows = useMemo(
    () =>
      purchases
        .map((pu, idx) => ({ ...pu, idx, refunded: refunded[idx] || pu.refunded }))
        .filter((pu) => pu.kind === active),
    [purchases, active, refunded],
  );

  function refund(pu: Purchase & { idx: number }) {
    if (!window.confirm(`Refund ${money(pu.amount)} for "${pu.item}"?\nReceipt ${pu.receiptId} · ${pu.platform}`)) return;
    setRefunded((r) => ({ ...r, [pu.idx]: true }));
  }

  return (
    <section className="prof-card">
      <div className="prof-card-head">
        <h2 className="prof-card-title">Purchases & Bills</h2>
        <span className="prof-card-count">{purchases.length}</span>
      </div>

      <div className="prof-tabs" role="tablist">
        {PURCHASE_TABS.map((t) => {
          const n = purchases.filter((pu) => pu.kind === t.kind).length;
          return (
            <button
              key={t.kind}
              role="tab"
              aria-selected={active === t.kind}
              className={`prof-tab ${active === t.kind ? "prof-tab--active" : ""}`}
              onClick={() => setActive(t.kind)}
            >
              {t.label}
              <span className="prof-tab-count">{n}</span>
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="prof-empty">No {active.toLowerCase()} purchases on record.</div>
      ) : (
        <table className="prof-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Item</th>
              {active === "Certification" && <th>Type</th>}
              {(active === "Certification" || active === "Quiz Attempt") && <th>Status</th>}
              <th>Platform</th>
              <th>Receipt</th>
              <th className="prof-table-num">Amount</th>
              {(active === "Certification" || active === "Quiz Attempt" || active === "EPA Card") && (
                <th className="prof-table-actions">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((pu) => (
              <tr key={pu.idx}>
                <td>{formatDate(pu.date)}</td>
                <td className="prof-td-strong">{pu.item}</td>
                {active === "Certification" && (
                  <td>
                    <span className={`prof-flag ${pu.consumable ? "prof-flag--warn" : "prof-flag--ok"}`}>
                      {pu.consumable ? "Consumable" : "Non-Consumable"}
                    </span>
                  </td>
                )}
                {active === "Certification" && (
                  <td>{certStatusCell(pu)}</td>
                )}
                {active === "Quiz Attempt" && (
                  <td>{attemptStatusCell(pu)}</td>
                )}
                <td className="prof-muted">{pu.platform}</td>
                <td className="prof-muted">{pu.receiptId}</td>
                <td className="prof-table-num">{money(pu.amount)}</td>
                {(active === "Certification" || active === "Quiz Attempt") && (
                  <td className="prof-table-actions">
                    {pu.refunded ? (
                      <span className="prof-status prof-status--muted">Refunded</span>
                    ) : (
                      <button
                        className="prof-btn prof-btn--sm"
                        disabled={!isRefundable(pu)}
                        title={
                          isRefundable(pu)
                            ? "Issue a refund"
                            : `${pu.platform} purchases are not refundable here`
                        }
                        onClick={() => refund(pu)}
                      >
                        Refund
                      </button>
                    )}
                  </td>
                )}
                {active === "EPA Card" && (
                  <td className="prof-table-actions">
                    {epaCanceled ? (
                      <span className="prof-status prof-status--muted">Canceled · Refunded</span>
                    ) : (
                      <button
                        className="prof-btn prof-btn--sm"
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
          </tbody>
        </table>
      )}
    </section>
  );
}

function certStatusCell(pu: Purchase) {
  if (!pu.consumable) return <span className="prof-status prof-status--ok">Lifetime access</span>;
  const when = pu.expiresOn ? formatDate(pu.expiresOn) : "";
  if (pu.certAccess === "Active")
    return <span className="prof-status prof-status--ok">Active{when && ` · expires ${when}`}</span>;
  if (pu.certAccess === "Expired")
    return <span className="prof-status prof-status--warn">Expired{when && ` · ${when}`}</span>;
  if (pu.certAccess === "Revoked")
    return <span className="prof-status prof-status--bad">Revoked{when && ` · ${when}`}</span>;
  return <span className="prof-muted">—</span>;
}

function attemptStatusCell(pu: Purchase) {
  switch (pu.attemptState) {
    case "Available":
      return <span className="prof-status prof-status--ok">Available</span>;
    case "In Progress":
      return <span className="prof-status prof-status--warn">In Progress</span>;
    case "Completed":
      return <span className="prof-status prof-status--muted">Used · Completed</span>;
    default:
      return <span className="prof-muted">—</span>;
  }
}

function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`prof-field ${wide ? "prof-field--wide" : ""}`}>
      <div className="prof-field-label">{label}</div>
      <div className="prof-field-value">{value}</div>
    </div>
  );
}

/* ── icons ── */
const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4.5l5 5L8 21l-5 1 1-5L14.5 4.5z" />
  </svg>
);
const PowerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v9M6.4 7a8 8 0 1011.2 0" />
  </svg>
);
const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
  </svg>
);
const MedalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a5 5 0 00-2.2 9.5L8.3 21 12 18.8 15.7 21l-1.5-9.5A5 5 0 0012 2z" />
  </svg>
);
const VerifiedBadge = () => (
  <svg className="prof-verified" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Verified">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.4 12.4l2.4 2.4 4.8-5.2" />
  </svg>
);
