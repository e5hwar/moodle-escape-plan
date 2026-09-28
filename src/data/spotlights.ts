/* Deactivating a Spotlight is not a status of its own: it stays `approved` and
   its end date is stamped with the current date, so it reads as Ended. */
export type SpotlightStatus = "pending" | "approved" | "rejected";

/* Copy limits, per language. The list table's Title & Description column is
   sized to them: a full title on one line, a full description in two. */
export const SPOTLIGHT_TITLE_MAX = 20;
export const SPOTLIGHT_DESCRIPTION_MAX = 60;

export type Spotlight = {
  id: string;
  headingEn: string;
  headingEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  ctaTextEn?: string;
  ctaTextEs?: string;
  ctaUrl?: string;
  backgroundColor?: string; // when no image
  imageHint?: string; // textual hint about background image
  endDate: string; // ISO date
  submittedBy: string;
  submittedAt: string;
  approvedBy?: string;
  status: SpotlightStatus;
};

export const spotlights: Spotlight[] = [
  {
    id: "SP-0014",
    headingEn: "Plumbing Certs Live!",
    headingEs: "Nuevos certificados",
    descriptionEn: "Three new plumbing certifications. Get journeyman-ready.",
    descriptionEs: "Tres certificaciones nuevas de plomería. Avanza más rápido.",
    ctaTextEn: "Explore Plumbing",
    ctaTextEs: "Explorar Plomería",
    ctaUrl: "skillcat://industry/plumbing",
    imageHint: "plumbing-wrench.jpg",
    endDate: "2026-08-15",
    submittedBy: "Maya Chen",
    submittedAt: "2026-05-12",
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0013",
    headingEn: "Career Goals Survey",
    headingEs: "Encuesta de metas",
    descriptionEn: "Help us tailor your learning path. It takes two minutes.",
    ctaTextEn: "Start Survey",
    ctaTextEs: "Empezar Encuesta",
    ctaUrl: "https://surveys.skillcat.com/career-goals-2026",
    endDate: "2026-06-30",
    submittedBy: "Priya Iyer",
    submittedAt: "2026-05-09",
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0012",
    headingEn: "EPA 608 Exam Slots",
    descriptionEn: "Book your proctored exam by Friday. Slots refill weekly.",
    ctaTextEn: "Book a Slot",
    ctaUrl: "https://calendly.com/skillcat-proctoring",
    endDate: "2026-05-22",
    submittedBy: "Diego Ramos",
    submittedAt: "2026-05-08",
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0011",
    headingEn: "Trade Talk Podcast",
    descriptionEn: "Episode 14: a master electrician on starting out.",
    ctaTextEn: "Listen Now",
    ctaUrl: "https://open.spotify.com/show/trade-talk",
    endDate: "2026-07-01",
    submittedBy: "Maya Chen",
    submittedAt: "2026-05-06",
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0010",
    headingEn: "HVAC Field Day",
    descriptionEn: "Free hands-on event in Austin on June 4. Tools provided.",
    ctaTextEn: "RSVP",
    ctaUrl: "https://events.skillcat.com/austin-field-day",
    endDate: "2026-06-04",
    submittedBy: "Priya Iyer",
    submittedAt: "2026-05-11",
    status: "pending",
  },
  {
    id: "SP-0009",
    headingEn: "Refer a Friend",
    descriptionEn: "You and a friend each get one month of SkillCat Pro free.",
    ctaTextEn: "Get My Link",
    ctaUrl: "skillcat://settings/refer",
    endDate: "2026-06-15",
    submittedBy: "Diego Ramos",
    submittedAt: "2026-05-13",
    status: "pending",
  },
  {
    id: "SP-0008",
    headingEn: "Solar Pilot Program",
    descriptionEn: "We're testing a Solar Installer cert. Apply by Sunday.",
    ctaTextEn: "Apply",
    ctaUrl: "https://forms.skillcat.com/solar-pilot",
    endDate: "2026-05-18",
    submittedBy: "Maya Chen",
    submittedAt: "2026-05-14",
    status: "pending",
  },
  {
    id: "SP-0007",
    headingEn: "Spring Challenge",
    headingEs: "Desafío de Primavera",
    descriptionEn: "Finish 5 hands-on tasks in April to win a pro-grade tool kit",
    ctaTextEn: "See Winners",
    ctaUrl: "https://events.skillcat.com/spring-challenge",
    imageHint: "spring-toolkit.jpg",
    endDate: "2026-04-30",
    submittedBy: "Priya Iyer",
    submittedAt: "2026-04-01",
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0006",
    headingEn: "Study Groups Beta",
    descriptionEn: "Paused while we rework peer study groups for everyone.",
    ctaTextEn: "Learn More",
    ctaUrl: "skillcat://feature/study-groups",
    /* Deactivated before its original 20th July end date, so it carries the
       date it was pulled — today — and reads as Ended. */
    endDate: "2026-05-15",
    submittedBy: "Diego Ramos",
    submittedAt: "2026-04-22",
    approvedBy: "Akash Patel",
    status: "approved",
  },
];
