export type ScholarshipUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
};

export type Scholarship = {
  id: string;
  user: ScholarshipUser;
  assignedOn: string; // ISO date
  expiresOn: string; // ISO date
  assignedBy: string;
};

/** A bank of users that can be selected when adding a new scholarship.
 *  Only a subset of these will have a scholarship by default. */
export const userBank: ScholarshipUser[] = [
  { id: "U-10044", name: "Marcus Holloway", email: "marcus.holloway@gmail.com", phone: "+1 (415) 555-0142" },
  { id: "U-10089", name: "Priya Venkatesan", email: "priya.v@outlook.com", phone: "+1 (213) 555-0181" },
  { id: "U-10132", name: "Diego Ramirez", phone: "+1 (832) 555-0117" },
  { id: "U-10157", name: "Ayesha Khan", email: "ayesha.khan@yahoo.com" },
  { id: "U-10203", name: "Jordan Whitfield", email: "j.whitfield@gmail.com", phone: "+1 (404) 555-0103" },
  { id: "U-10248", name: "Sophia Andersson", email: "sophia.a@protonmail.com", phone: "+1 (646) 555-0134" },
  { id: "U-10291", name: "Tyrese Booker", email: "ty.booker@gmail.com" },
  { id: "U-10330", name: "Lena Petrov", email: "lena.petrov@outlook.com", phone: "+1 (305) 555-0177" },
  { id: "U-10376", name: "Carlos Mendoza", phone: "+1 (915) 555-0142" },
  { id: "U-10412", name: "Hana Yamamoto", email: "hana.y@gmail.com", phone: "+1 (206) 555-0156" },
  { id: "U-10458", name: "Brandon O'Connor", email: "boconnor@gmail.com" },
  { id: "U-10491", name: "Naomi Sato", email: "naomi.sato@gmail.com", phone: "+1 (503) 555-0189" },
  { id: "U-10537", name: "Ezekiel Adeoye", email: "z.adeoye@outlook.com" },
  { id: "U-10584", name: "Mira Singh", email: "mira.singh@yahoo.com", phone: "+1 (718) 555-0162" },
  { id: "U-10618", name: "Felix Becker", phone: "+1 (267) 555-0148" },
];

export const scholarships: Scholarship[] = [
  {
    id: "SC-1024",
    user: userBank[0],
    assignedOn: "2026-02-12",
    expiresOn: "2026-08-12",
    assignedBy: "Akash Patel",
  },
  {
    id: "SC-1019",
    user: userBank[1],
    assignedOn: "2026-01-30",
    expiresOn: "2026-07-30",
    assignedBy: "Maya Chen",
  },
  {
    id: "SC-1011",
    user: userBank[2],
    assignedOn: "2025-12-04",
    expiresOn: "2026-06-04",
    assignedBy: "Akash Patel",
  },
  {
    id: "SC-1007",
    user: userBank[3],
    assignedOn: "2025-11-18",
    expiresOn: "2026-05-18",
    assignedBy: "Maya Chen",
  },
  {
    id: "SC-1003",
    user: userBank[4],
    assignedOn: "2025-10-22",
    expiresOn: "2026-04-22",
    assignedBy: "Diego Ramos",
  },
  {
    id: "SC-0998",
    user: userBank[5],
    assignedOn: "2025-09-08",
    expiresOn: "2026-03-08",
    assignedBy: "Akash Patel",
  },
  {
    id: "SC-0991",
    user: userBank[6],
    assignedOn: "2026-03-04",
    expiresOn: "2026-09-04",
    assignedBy: "Maya Chen",
  },
  {
    id: "SC-0985",
    user: userBank[7],
    assignedOn: "2026-04-19",
    expiresOn: "2026-10-19",
    assignedBy: "Priya Iyer",
  },
];
