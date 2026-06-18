export type IdDocType = "Driver License" | "Passport" | "State ID";

export type NameChangeRequest = {
  id: string;
  userId: string;
  currentName: string;
  requestedName: string;
  /** ISO date the request was submitted. */
  submittedOn: string;
  reason: string;
  /* ── ID document (shown on the mock ID card) ── */
  idType: IdDocType;
  idNumber: string;
  dob: string; // ISO date
  region: string; // issuing state / country
  expires: string; // ISO date
  /** picsum seed used for the ID portrait photo. */
  photoSeed: string;
};

const RAW: Omit<NameChangeRequest, "id">[] = [
  {
    userId: "U-10089",
    currentName: "Priya Venkatesan",
    requestedName: "Priya Iyer",
    submittedOn: "2026-06-14",
    reason: "Marriage",
    idType: "Driver License",
    idNumber: "D1294-8830-4471",
    dob: "1994-03-22",
    region: "California",
    expires: "2029-03-22",
    photoSeed: "ncr-priya",
  },
  {
    userId: "U-10291",
    currentName: "Tyrese Booker",
    requestedName: "Ty Booker",
    submittedOn: "2026-06-12",
    reason: "Preferred name",
    idType: "State ID",
    idNumber: "GA-553-901-228",
    dob: "1990-11-08",
    region: "Georgia",
    expires: "2028-11-08",
    photoSeed: "ncr-tyrese",
  },
  {
    userId: "U-10491",
    currentName: "Naomi Sato",
    requestedName: "Naomi Tanaka",
    submittedOn: "2026-06-11",
    reason: "Marriage",
    idType: "Passport",
    idNumber: "P5582137",
    dob: "1996-07-19",
    region: "Oregon",
    expires: "2031-07-19",
    photoSeed: "ncr-naomi",
  },
  {
    userId: "U-10618",
    currentName: "Felix Becker",
    requestedName: "Felix Beck",
    submittedOn: "2026-06-09",
    reason: "Legal name change",
    idType: "Driver License",
    idNumber: "PA-882-104-557",
    dob: "1988-01-30",
    region: "Pennsylvania",
    expires: "2027-01-30",
    photoSeed: "ncr-felix",
  },
  {
    userId: "U-10903",
    currentName: "Chloe Bennett",
    requestedName: "Chloe Bennett-Reyes",
    submittedOn: "2026-06-08",
    reason: "Marriage",
    idType: "Driver License",
    idNumber: "TX-471-228-019",
    dob: "1999-05-14",
    region: "Texas",
    expires: "2030-05-14",
    photoSeed: "ncr-chloe",
  },
  {
    userId: "U-10330",
    currentName: "Lena Petrov",
    requestedName: "Yelena Petrova",
    submittedOn: "2026-06-06",
    reason: "Correcting legal name",
    idType: "Passport",
    idNumber: "P4419082",
    dob: "1992-09-02",
    region: "Florida",
    expires: "2032-09-02",
    photoSeed: "ncr-lena",
  },
  {
    userId: "U-10655",
    currentName: "Olivia Tran",
    requestedName: "Olivia Nguyen",
    submittedOn: "2026-06-03",
    reason: "Marriage",
    idType: "State ID",
    idNumber: "CA-902-554-118",
    dob: "1997-12-11",
    region: "California",
    expires: "2029-12-11",
    photoSeed: "ncr-olivia",
  },
  {
    userId: "U-11224",
    currentName: "Theo Martin",
    requestedName: "Theodore Martin",
    submittedOn: "2026-05-30",
    reason: "Preferred legal name",
    idType: "Driver License",
    idNumber: "OR-118-770-345",
    dob: "1991-04-26",
    region: "Oregon",
    expires: "2028-04-26",
    photoSeed: "ncr-theo",
  },
  {
    userId: "U-10044",
    currentName: "Marcus Holloway",
    requestedName: "Marc Holloway",
    submittedOn: "2026-05-28",
    reason: "Preferred name",
    idType: "Driver License",
    idNumber: "CA-330-918-662",
    dob: "1989-08-17",
    region: "California",
    expires: "2027-08-17",
    photoSeed: "ncr-marcus",
  },
  {
    userId: "U-10987",
    currentName: "Emma Schneider",
    requestedName: "Emma Schneider-Klein",
    submittedOn: "2026-05-25",
    reason: "Marriage",
    idType: "State ID",
    idNumber: "CO-447-209-883",
    dob: "1995-02-09",
    region: "Colorado",
    expires: "2030-02-09",
    photoSeed: "ncr-emma",
  },
];

export const nameChangeRequests: NameChangeRequest[] = RAW.map((r, i) => ({
  id: `NCR-${1840 - i * 6}`,
  ...r,
}));

/** picsum portrait URL for the ID photo. */
export function idPhotoUrl(seed: string, w = 300, h = 380): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}
