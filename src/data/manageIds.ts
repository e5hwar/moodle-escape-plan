import { originalName, type User } from "./users";
import { sharedStore, todayDate } from "./sharedStore";
import { proofReceived } from "./nameChangeRequests";

/** "not-started": the user has never uploaded an ID — there is nothing to
 *  view, so View ID is not offered. */
export type IdStatus = "approved" | "in-review" | "reupload-requested" | "not-started";

export type IdRecord = {
  /** The user's id — the popup's name links to `?profile=<id>`. */
  id: string;
  /** The user's CURRENT name and contacts, read off the Users roster when the
   *  record is built — never stored here. */
  name: string;
  email: string;
  phone: string;
  /** The name printed on the document itself — what it was issued in, which
   *  a later rename on the account doesn't change. */
  docName: string;
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

/* ── The document on file, per user ──
   Who the person is (name, email, phone) always comes from the Users roster —
   `idRecordForUser` is handed the live user. Only the document is kept: the
   seeded review queue below, a deterministic one for everyone else, and this
   session's decisions over both (approve, replace), shared across tabs so the
   Full Profile and Manage IDs agree. */
type IdDoc = {
  idType: string;
  status: IdStatus;
  /** Display stamp for when the current ID was uploaded. */
  uploadedAt: string;
  approvedAt?: string;
  reuploadRequestedAt?: string;
  /** The document's own name; defaults to the account's original name. */
  docName?: string;
};

const SEED: Record<string, IdDoc> = {
  "U-10248": { idType: "US Driver's License", status: "in-review", uploadedAt: "Nov 5th, 2025, 2:30 PM" },
  "U-10089": { idType: "US Passport", status: "approved", uploadedAt: "Nov 5th, 2025, 2:30 PM", approvedAt: "Nov 7th, 2025, 9:12 AM" },
  "U-10203": { idType: "US Driver's License", status: "in-review", uploadedAt: "Oct 22nd, 2025, 11:15 AM" },
  "U-10412": { idType: "US Driver's License", status: "approved", uploadedAt: "Sep 15th, 2025, 12:40 PM", approvedAt: "Sep 16th, 2025, 3:55 PM" },
  /* Already asked to reupload once, and now back in review on the new
     document — the "sometimes" case for a pending ID. */
  "U-10731": { idType: "US Passport", status: "in-review", uploadedAt: "Nov 10th, 2025, 2:30 PM", reuploadRequestedAt: "Nov 8th, 2025, 10:05 AM" },
  "U-10692": { idType: "US Driver's License", status: "approved", uploadedAt: "Aug 2nd, 2025, 9:05 AM", approvedAt: "Aug 4th, 2025, 1:20 PM" },
  /* The rejected upload is gone — a re-upload request leaves nothing to view
     until the new document arrives. */
  "U-10948": { idType: "US Driver's License", status: "reupload-requested", uploadedAt: "Oct 30th, 2025, 4:20 PM", reuploadRequestedAt: "Nov 1st, 2025, 8:45 AM" },
  /* Everyone with a Name Change Request has an approved ID — only a reviewed
     ID can stand behind a request (nameChangeRequests.ts). */
  "U-10291": { idType: "US Driver's License", status: "approved", uploadedAt: "Jul 14th, 2025, 10:20 AM", approvedAt: "Jul 15th, 2025, 2:05 PM" },
  "U-10491": { idType: "US Passport", status: "approved", uploadedAt: "Jun 3rd, 2025, 4:40 PM", approvedAt: "Jun 5th, 2025, 11:30 AM" },
  "U-10618": { idType: "US Driver's License", status: "approved", uploadedAt: "Mar 21st, 2025, 9:15 AM", approvedAt: "Mar 22nd, 2025, 1:45 PM" },
  "U-10903": { idType: "US Driver's License", status: "approved", uploadedAt: "Feb 9th, 2025, 3:10 PM", approvedAt: "Feb 11th, 2025, 10:00 AM" },
  "U-10655": { idType: "US Driver's License", status: "approved", uploadedAt: "Jan 27th, 2025, 12:25 PM", approvedAt: "Jan 28th, 2025, 4:50 PM" },
};

/** The ids of the seeded review queue — the Manage IDs table's rows. */
export const SEEDED_ID_USERS = Object.keys(SEED).filter((id) =>
  ["U-10248", "U-10089", "U-10203", "U-10412", "U-10731", "U-10692", "U-10948"].includes(id),
);

/** This session's decisions, by user id. */
const idStore = sharedStore<Record<string, IdDoc>>("ids", {});
export const useIdDecisions = idStore.use;

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
  const d = todayDate();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return formatIdStamp(d);
}

/* Not every user has uploaded an ID — "not-started" ones have nothing on file. */
const GENERATED_STATUSES: IdStatus[] = [
  "approved",
  "approved",
  "in-review",
  "approved",
  "reupload-requested",
  "not-started",
  "approved",
  "not-started",
];

function generatedDoc(userId: string): IdDoc {
  const k = phash(`id-${userId}`);
  const status = GENERATED_STATUSES[k % GENERATED_STATUSES.length];
  // Uploaded somewhere in the last ~14 months, decided a day or three later.
  const uploadedDaysAgo = 30 + (k % 400);
  const doc: IdDoc = {
    idType: (k >>> 11) % 4 === 0 ? "US Passport" : "US Driver's License",
    status,
    uploadedAt: stampDaysAgo(uploadedDaysAgo, 8 + ((k >>> 3) % 10), ((k >>> 7) % 12) * 5),
  };
  if (status === "approved") {
    doc.approvedAt = stampDaysAgo(uploadedDaysAgo - (1 + ((k >>> 13) % 3)), 9 + ((k >>> 17) % 8), ((k >>> 19) % 12) * 5);
  }
  if (status === "reupload-requested") {
    // Asked for after the upload that was rejected.
    doc.reuploadRequestedAt = stampDaysAgo(uploadedDaysAgo - (1 + ((k >>> 13) % 4)), 9 + ((k >>> 17) % 8), ((k >>> 19) % 12) * 5);
  }
  // A pending ID has sometimes already been through one reupload round: the
  // request came first, and this upload is the answer to it.
  if (status === "in-review" && (k >>> 23) % 2 === 0) {
    doc.reuploadRequestedAt = stampDaysAgo(uploadedDaysAgo + 1 + ((k >>> 13) % 5), 9 + ((k >>> 17) % 8), ((k >>> 19) % 12) * 5);
  }
  return doc;
}

/** The user's ID record: the document on file (seeded, generated, or as this
 *  session left it) with the user's current identity from the roster. */
export function idRecordForUser(user: User, decisions = idStore.get()): IdRecord {
  const doc = decisions[user.id] ?? SEED[user.id] ?? generatedDoc(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    docName: doc.docName ?? originalName(user.id) ?? user.name,
    idType: doc.idType,
    status: doc.status,
    uploadedAt: doc.uploadedAt,
    approvedAt: doc.approvedAt,
    reuploadRequestedAt: doc.reuploadRequestedAt,
  };
}

/** Whether there is a document to look at — nothing before the first upload,
 *  and nothing while a re-upload is awaited (the rejected one is gone). */
export function hasIdDocument(r: Pick<IdRecord, "status">): boolean {
  return r.status === "approved" || r.status === "in-review";
}

function save(r: IdRecord, patch: Partial<IdDoc>) {
  const doc: IdDoc = {
    idType: r.idType,
    status: r.status,
    uploadedAt: r.uploadedAt,
    approvedAt: r.approvedAt,
    reuploadRequestedAt: r.reuploadRequestedAt,
    docName: r.docName,
    ...patch,
  };
  idStore.set((prev) => ({ ...prev, [r.id]: doc }));
}

/** Approving records the decision only; the upload stamp stays. */
export function approveIdRecord(r: IdRecord): void {
  save(r, { status: "approved", approvedAt: nowIdStamp() });
}

/** A replacement re-takes the upload stamp, and the approval stamp too — or
 *  drops it: it described the document just replaced. The new document is in
 *  the account's current name. */
export function replaceIdRecord(r: IdRecord, status: "approved" | "in-review"): void {
  const now = nowIdStamp();
  save(r, { status, uploadedAt: now, approvedAt: status === "approved" ? now : undefined, docName: r.name });
  // A fresh document is the proof a Name Change Request may be waiting on.
  proofReceived(r.id);
}
