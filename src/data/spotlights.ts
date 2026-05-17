export type SpotlightStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "deactivated";

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
    headingEn: "New! Plumbing Certifications on SkillCat",
    headingEs: "¡Nuevo! Certificaciones de plomería en SkillCat",
    descriptionEn:
      "Three new plumbing certifications just launched. Get journeyman-ready faster with hands-on tasks and field exercises.",
    descriptionEs:
      "Tres nuevas certificaciones de plomería disponibles. Avanza más rápido con tareas prácticas.",
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
    headingEn: "Take our 2-minute Career Goals survey",
    headingEs: "Encuesta de objetivos profesionales (2 min)",
    descriptionEn:
      "Help us tailor your learning path. The results shape what content we build next.",
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
    headingEn: "EPA 608 Universal — proctored slots open this weekend",
    descriptionEn:
      "Schedule your final exam proctoring session before Friday. Slots are limited and refill weekly.",
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
    headingEn: "Listen: The Trade Talk Podcast — Episode 14",
    descriptionEn:
      "A master electrician on what apprentices wish they'd been told earlier.",
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
    headingEn: "HVAC Field Day — Austin, June 4",
    descriptionEn:
      "Free hands-on event with the SkillCat instructor team. Tools and refreshments provided.",
    ctaTextEn: "RSVP",
    ctaUrl: "https://events.skillcat.com/austin-field-day",
    endDate: "2026-06-04",
    submittedBy: "Priya Iyer",
    submittedAt: "2026-05-11",
    status: "pending",
  },
  {
    id: "SP-0009",
    headingEn: "Refer a friend, get a free month of Pro",
    descriptionEn:
      "Limited-time referral bonus. Both you and your friend get one month of SkillCat Pro free.",
    ctaTextEn: "Get My Link",
    ctaUrl: "skillcat://settings/refer",
    endDate: "2026-06-15",
    submittedBy: "Diego Ramos",
    submittedAt: "2026-05-13",
    status: "pending",
  },
  {
    id: "SP-0008",
    headingEn: "Solar Installer pilot — apply by Sunday",
    descriptionEn:
      "We're piloting a Solar Installer certification with 30 testers. Tell us why you're a fit.",
    ctaTextEn: "Apply",
    ctaUrl: "https://forms.skillcat.com/solar-pilot",
    endDate: "2026-05-18",
    submittedBy: "Maya Chen",
    submittedAt: "2026-05-14",
    status: "pending",
  },
];
