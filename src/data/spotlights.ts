import { useSyncExternalStore } from "react";
import { appToday, isoDate } from "./companies";

/* Deactivating a Spotlight is not a status of its own: it stays `approved`,
   its end date is stamped with the current date and it is flagged `disabled`,
   so it reads as Ended at once (an end date of today alone would still read
   Active, since a Spotlight runs through its end date). */
export type SpotlightStatus = "pending" | "approved" | "rejected";

/* The page's one clock — the app's real current day (`appToday`). Status, the
   Disable stamp, a new Spotlight's submitted / created dates, the end-date
   window and the picker's shortcuts all count from it. */
export function spotlightToday(): string {
  return isoDate(appToday());
}

/** `iso` plus `days` calendar days, as ISO. */
export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

/** `iso` plus `months`, clamped to the target month's last day (Aug 31 + 1
 *  month is Sep 30, not Oct 1). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, last));
  return isoDate(target);
}

/** Whole days from today to `iso` — 0 on the day itself, negative once past. */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const t = appToday();
  return Math.round((new Date(y, m - 1, d).getTime() - t.getTime()) / 86400000);
}

/* A Spotlight may run at most 6 months, counted from the day it was created —
   not from the day of each edit. */
export const SPOTLIGHT_MAX_MONTHS = 6;
export function maxEndDate(createdAt: string): string {
  return addMonthsIso(createdAt, SPOTLIGHT_MAX_MONTHS);
}

/* Seed dates are offsets from today, so the demo queue keeps its mix of
   Active, In-Review and Ended rows whatever day the prototype is opened. */
const rel = (days: number) => addDaysIso(spotlightToday(), days);

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
  imageHint?: string; // the background image's file name
  /** The uploaded background itself, when it was picked in this session (an
   *  object URL). Seed Spotlights only carry `imageHint`, and show the
   *  default artwork. */
  imageUrl?: string;
  endDate: string; // ISO date
  submittedBy: string;
  submittedAt: string;
  /** ISO day the Spotlight was created — the 6-month end-date cap counts from
   *  it. Restamped when an archived Spotlight is Enabled, which starts a new
   *  run. */
  createdAt: string;
  /** Pulled down early with Disable — reads as Ended whatever its end date. */
  disabled?: boolean;
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
    ctaUrl: "https://skillcat.app/PlumbingApprenticeYear1",
    imageHint: "plumbing-wrench.jpg",
    endDate: rel(92),
    submittedBy: "Maya Chen",
    submittedAt: rel(-3),
    createdAt: rel(-3),
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
    endDate: rel(46),
    submittedBy: "Priya Iyer",
    submittedAt: rel(-6),
    createdAt: rel(-6),
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0012",
    headingEn: "EPA 608 Exam Slots",
    descriptionEn: "Book your proctored exam by Friday. Slots refill weekly.",
    ctaTextEn: "Book a Slot",
    ctaUrl: "https://calendly.com/skillcat-proctoring",
    endDate: rel(7),
    submittedBy: "Diego Ramos",
    submittedAt: rel(-7),
    createdAt: rel(-7),
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0011",
    headingEn: "Trade Talk Podcast",
    descriptionEn: "Episode 14: a master electrician on starting out.",
    ctaTextEn: "Listen Now",
    ctaUrl: "https://open.spotify.com/show/trade-talk",
    endDate: rel(47),
    submittedBy: "Maya Chen",
    submittedAt: rel(-9),
    createdAt: rel(-9),
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0010",
    headingEn: "HVAC Field Day",
    descriptionEn: "Free hands-on event in Austin on June 4. Tools provided.",
    ctaTextEn: "RSVP",
    ctaUrl: "https://events.skillcat.com/austin-field-day",
    endDate: rel(20),
    submittedBy: "Priya Iyer",
    submittedAt: rel(-4),
    createdAt: rel(-4),
    status: "pending",
  },
  {
    id: "SP-0009",
    headingEn: "Refer a Friend",
    descriptionEn: "You and a friend each get one month of SkillCat Pro free.",
    ctaTextEn: "Get My Link",
    ctaUrl: "https://skillcat.app/refer",
    endDate: rel(31),
    submittedBy: "Diego Ramos",
    submittedAt: rel(-2),
    createdAt: rel(-2),
    status: "pending",
  },
  {
    id: "SP-0008",
    headingEn: "Solar Pilot Program",
    descriptionEn: "We're testing a Solar Installer cert. Apply by Sunday.",
    ctaTextEn: "Apply",
    ctaUrl: "https://forms.skillcat.com/solar-pilot",
    endDate: rel(3),
    submittedBy: "Maya Chen",
    submittedAt: rel(-1),
    createdAt: rel(-1),
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
    endDate: rel(-15),
    submittedBy: "Priya Iyer",
    submittedAt: rel(-44),
    createdAt: rel(-44),
    approvedBy: "Akash Patel",
    status: "approved",
  },
  {
    id: "SP-0006",
    headingEn: "Study Groups Beta",
    descriptionEn: "Paused while we rework peer study groups for everyone.",
    ctaTextEn: "Learn More",
    ctaUrl: "https://skillcat.app/study-groups",
    /* Disabled before its original end date, so it carries the date it was
       pulled — today — and reads as Ended. */
    endDate: rel(0),
    disabled: true,
    submittedBy: "Diego Ramos",
    submittedAt: rel(-23),
    createdAt: rel(-23),
    approvedBy: "Akash Patel",
    status: "approved",
  },
];

/** Waiting on a decision — the rows the Spotlight page pills "In-Review": still
 *  pending, and not yet past their end date (one that ran out has Ended). */
export function isInReview(s: Spotlight): boolean {
  return s.status === "pending" && !s.disabled && daysUntil(s.endDate) >= 0;
}

/* The saved Spotlights, live. App owns them (state) and mirrors them here, so
   the sidebar's In-Review badge follows approvals made on the page. */
let liveSpotlights: Spotlight[] = spotlights;
const liveListeners = new Set<() => void>();
export function setLiveSpotlights(next: Spotlight[]) {
  liveSpotlights = next;
  liveListeners.forEach((l) => l());
}
export function useLiveSpotlights(): Spotlight[] {
  return useSyncExternalStore(
    (l) => {
      liveListeners.add(l);
      return () => liveListeners.delete(l);
    },
    () => liveSpotlights,
  );
}
