export type IdStatus = "approved" | "in-review" | "reupload-requested";

export type IdRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  idType: string;
  status: IdStatus;
  /** Display stamp for when the current ID was uploaded. */
  uploadedAt: string;
};

export const idRecords: IdRecord[] = [
  {
    id: "U-4821",
    name: "Jessica Tan",
    email: "jtan@skillcatapp.com",
    phone: "+1 (415) 555-0148",
    idType: "US Driver's License",
    status: "in-review",
    uploadedAt: "Nov 5th, 2025, 2:30 PM",
  },
  {
    id: "U-4822",
    name: "Eshwar D",
    email: "eshwar@skillcatapp.com",
    phone: "+1 (408) 555-0192",
    idType: "US Passport",
    status: "approved",
    uploadedAt: "Nov 5th, 2025, 2:30 PM",
  },
  {
    id: "U-4823",
    name: "Michael Lee",
    email: "mlee@skillcatapp.com",
    phone: "+1 (650) 555-0110",
    idType: "US Driver's License",
    status: "in-review",
    uploadedAt: "Oct 22nd, 2025, 11:15 AM",
  },
  {
    id: "U-4824",
    name: "Amanda Rodriguez",
    email: "arodriguez@skillcatapp.com",
    phone: "+1 (312) 555-0173",
    idType: "US Driver's License",
    status: "approved",
    uploadedAt: "Sep 15th, 2025, 12:40 PM",
  },
  {
    id: "U-4825",
    name: "James Smith",
    email: "jsmith@skillcatapp.com",
    phone: "+1 (206) 555-0125",
    idType: "US Passport",
    status: "in-review",
    uploadedAt: "Nov 10th, 2025, 2:30 PM",
  },
  {
    id: "U-4826",
    name: "Priya Nair",
    email: "pnair@skillcatapp.com",
    phone: "+1 (917) 555-0188",
    idType: "US Driver's License",
    status: "approved",
    uploadedAt: "Aug 2nd, 2025, 9:05 AM",
  },
  {
    id: "U-4827",
    name: "David Okafor",
    email: "dokafor@skillcatapp.com",
    phone: "+1 (713) 555-0156",
    idType: "US Driver's License",
    status: "reupload-requested",
    uploadedAt: "Oct 30th, 2025, 4:20 PM",
  },
];
