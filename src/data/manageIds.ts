import { users, type User } from "./users";

export type IdStatus = "approved" | "in-review" | "reupload-requested";

export type IdRecord = {
  /** The user's id — the popup's name links to `?profile=<id>`. */
  id: string;
  name: string;
  email: string;
  phone: string;
  idType: string;
  status: IdStatus;
  /** Display stamp for when the current ID was uploaded. */
  uploadedAt: string;
  /** Set once the ID has been approved. */
  approvedAt?: string;
  /** Set when a reupload was asked for. Present on an ID that is still waiting
   *  for the new document AND on one already re-uploaded and back in review —
   *  which is why it is independent of `status`. */
  reuploadRequestedAt?: string;
};

/** The popup's hover card lists the stamps this record actually has, in this
 *  order (Figma 679:2039). Approved IDs show upload + approval; a pending one
 *  shows the upload, plus the request stamp when it was asked for once already;
 *  a reupload-requested one shows the upload and the request. */
export function idTimelineOf(record: IdRecord): {
  uploadedAt: string;
  reuploadRequestedAt?: string;
  approvedAt?: string;
} {
  return {
    uploadedAt: record.uploadedAt,
    reuploadRequestedAt: record.reuploadRequestedAt,
    approvedAt: record.approvedAt,
  };
}

/* ── Deterministic ID document details ──
   Same FNV-1a approach data/proctoring.ts uses, so the popup can render the
   shared ZoomableIdCard instead of this page's old hand-rolled mock card. */
function phash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ID_REGIONS = [
  "California",
  "Texas",
  "Florida",
  "New York",
  "Pennsylvania",
  "Georgia",
  "Arizona",
  "Illinois",
  "Washington",
  "Ohio",
];

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

/** The ID-card fields for a record — keyed on its user id, so a candidate's
 *  document reads the same every render. Mirrors proctoring's `idDocOf`. */
export function idDocOf(record: IdRecord): {
  idNumber: string;
  dob: string;
  expires: string;
  region: string;
  photoSeed: string;
} {
  const k = phash(record.id);
  const isPassport = record.idType.toLowerCase().includes("passport");
  const birthYear = 1968 + (k % 32);
  const birthMonth = 1 + ((k >>> 5) % 12);
  const birthDay = 1 + ((k >>> 9) % 28);
  const expYear = 2027 + ((k >>> 13) % 6);
  return {
    idNumber: isPassport
      ? `P${pad(k % 100000000, 8)}`
      : `${String.fromCharCode(68 + (k % 3))}${pad(k % 10000, 4)}-${pad((k >>> 7) % 10000, 4)}-${pad((k >>> 15) % 10000, 4)}`,
    dob: `${birthYear}-${pad(birthMonth, 2)}-${pad(birthDay, 2)}`,
    // Licences renew on the holder's birthday.
    expires: `${expYear}-${pad(birthMonth, 2)}-${pad(birthDay, 2)}`,
    region: isPassport ? "United States" : ID_REGIONS[k % ID_REGIONS.length],
    photoSeed: `mid-${record.id}`,
  };
}

/** Free-text match across the fields the search bar advertises — the document
 *  type is deliberately not one of them: it is neither a column nor a scope. */
export function matchesIdQuery(r: IdRecord, q: string): boolean {
  const s = q.toLowerCase();
  return (
    r.name.toLowerCase().includes(s) ||
    r.email.toLowerCase().includes(s) ||
    r.phone.toLowerCase().includes(s)
  );
}

/* ── Seed ──
   Rows carry only the document; who the person is comes from data/users.ts, the
   same way proctoring submissions resolve their candidate. That keeps the name,
   email and phone shown here in step with the Users table, and makes the popup's
   "open profile" link land on a real profile. */
type SeedRow = {
  userId: string;
  idType: string;
  status: IdStatus;
  /** Display stamp for when the current ID was uploaded. */
  uploadedAt: string;
  approvedAt?: string;
  reuploadRequestedAt?: string;
};

const seedRows: SeedRow[] = [
  { userId: "U-10248", idType: "US Driver's License", status: "in-review", uploadedAt: "Nov 5th, 2025, 2:30 PM" },
  { userId: "U-10089", idType: "US Passport", status: "approved", uploadedAt: "Nov 5th, 2025, 2:30 PM", approvedAt: "Nov 7th, 2025, 9:12 AM" },
  { userId: "U-10203", idType: "US Driver's License", status: "in-review", uploadedAt: "Oct 22nd, 2025, 11:15 AM" },
  { userId: "U-10412", idType: "US Driver's License", status: "approved", uploadedAt: "Sep 15th, 2025, 12:40 PM", approvedAt: "Sep 16th, 2025, 3:55 PM" },
  /* Already asked to reupload once, and now back in review on the new
     document — the "sometimes" case for a pending ID. */
  { userId: "U-10731", idType: "US Passport", status: "in-review", uploadedAt: "Nov 10th, 2025, 2:30 PM", reuploadRequestedAt: "Nov 8th, 2025, 10:05 AM" },
  { userId: "U-10692", idType: "US Driver's License", status: "approved", uploadedAt: "Aug 2nd, 2025, 9:05 AM", approvedAt: "Aug 4th, 2025, 1:20 PM" },
  { userId: "U-10948", idType: "US Driver's License", status: "reupload-requested", uploadedAt: "Oct 30th, 2025, 4:20 PM", reuploadRequestedAt: "Nov 1st, 2025, 8:45 AM" },
];

export const idRecords: IdRecord[] = seedRows.map((row) => {
  const u = users.find((x) => x.id === row.userId);
  if (!u) throw new Error(`Unknown user id ${row.userId}`);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    idType: row.idType,
    status: row.status,
    uploadedAt: row.uploadedAt,
    approvedAt: row.approvedAt,
    reuploadRequestedAt: row.reuploadRequestedAt,
  };
});

/* ── A record for any user (the Full Profile's "View ID") ──
   Manage IDs only seeds the seven documents that are in the review queue, but
   every user has an ID on file. Anyone outside the seed gets a deterministic
   record built the same way the rest of the generated data is, so a profile's
   ID reads the same on every render. */
const ID_TODAY = new Date("2026-06-17");

/** The display format every ID stamp uses — "Nov 5th, 2025, 2:30 PM". */
export function formatIdStamp(d: Date): string {
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
      ? "nd"
      : day % 10 === 3 && day !== 13
      ? "rd"
      : "th";
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${month} ${day}${suffix}, ${d.getFullYear()}, ${time}`;
}

/** Stamp for an action taken right now — a reviewer's approval or replacement. */
export function nowIdStamp(): string {
  return formatIdStamp(new Date());
}

function stampDaysAgo(days: number, hour: number, minute: number): string {
  const d = new Date(ID_TODAY);
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return formatIdStamp(d);
}

const GENERATED_STATUSES: IdStatus[] = [
  "approved",
  "approved",
  "in-review",
  "approved",
  "reupload-requested",
];

export function idRecordForUser(user: User): IdRecord {
  const seeded = idRecords.find((r) => r.id === user.id);
  if (seeded) return seeded;

  const k = phash(`id-${user.id}`);
  const status = GENERATED_STATUSES[k % GENERATED_STATUSES.length];
  // Uploaded somewhere in the last ~14 months, decided a day or three later.
  const uploadedDaysAgo = 30 + (k % 400);
  const uploadedAt = stampDaysAgo(uploadedDaysAgo, 8 + ((k >>> 3) % 10), ((k >>> 7) % 12) * 5);

  const record: IdRecord = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    idType: (k >>> 11) % 4 === 0 ? "US Passport" : "US Driver's License",
    status,
    uploadedAt,
  };

  if (status === "approved") {
    record.approvedAt = stampDaysAgo(
      uploadedDaysAgo - (1 + ((k >>> 13) % 3)),
      9 + ((k >>> 17) % 8),
      ((k >>> 19) % 12) * 5,
    );
  }
  if (status === "reupload-requested") {
    // Asked for after the upload that was rejected.
    record.reuploadRequestedAt = stampDaysAgo(
      uploadedDaysAgo - (1 + ((k >>> 13) % 4)),
      9 + ((k >>> 17) % 8),
      ((k >>> 19) % 12) * 5,
    );
  }
  // A pending ID has sometimes already been through one reupload round: the
  // request came first, and this upload is the answer to it.
  if (status === "in-review" && (k >>> 23) % 2 === 0) {
    record.reuploadRequestedAt = stampDaysAgo(
      uploadedDaysAgo + 1 + ((k >>> 13) % 5),
      9 + ((k >>> 17) % 8),
      ((k >>> 19) % 12) * 5,
    );
  }
  return record;
}
