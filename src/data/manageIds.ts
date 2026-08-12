import { users } from "./users";

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
};

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
};

const seedRows: SeedRow[] = [
  { userId: "U-10248", idType: "US Driver's License", status: "in-review", uploadedAt: "Nov 5th, 2025, 2:30 PM" },
  { userId: "U-10089", idType: "US Passport", status: "approved", uploadedAt: "Nov 5th, 2025, 2:30 PM" },
  { userId: "U-10203", idType: "US Driver's License", status: "in-review", uploadedAt: "Oct 22nd, 2025, 11:15 AM" },
  { userId: "U-10412", idType: "US Driver's License", status: "approved", uploadedAt: "Sep 15th, 2025, 12:40 PM" },
  { userId: "U-10731", idType: "US Passport", status: "in-review", uploadedAt: "Nov 10th, 2025, 2:30 PM" },
  { userId: "U-10692", idType: "US Driver's License", status: "approved", uploadedAt: "Aug 2nd, 2025, 9:05 AM" },
  { userId: "U-10948", idType: "US Driver's License", status: "reupload-requested", uploadedAt: "Oct 30th, 2025, 4:20 PM" },
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
  };
});
