/* ── Filter pill hover lines ──────────────────────────────────────────────────
   Every filter pill in the app says what it does on hover, as a native `title`
   the shared tooltip adopts (see [[tooltip-and-hover-convention]]).

   The convention is the Skills page's, which had these first: say what the
   filter does TO THE LIST, not what the label already says. "Show Skills
   awarded by the chosen Tasks", not "Filter by Task". A pill inside a picker
   modal narrows a list you are choosing from rather than the page, so those
   read "Narrow the list to…".

   The copy lives here, in one file, so the whole set can be read in one pass
   and stays in one voice — the pills themselves are spread over twenty
   components. Keyed by surface, because the same label means different things
   on different pages: "Industry" filters Certifications on one page and
   companies on another. ── */

/** Shared by every page whose rows have a creator — the pill is one component
 *  (`CreatedByPill`), so this is its default rather than a per-page line. */
export const CREATED_BY_TIP =
  "Show only what the chosen creators made — SkillCat in house, or a B2B customer.";

/* NOTE — "More Filters" deliberately has NO hover line (user, 2026-09-14).
   It is not a filter, it is a door: the pill says nothing about the list until
   you open it and pick something, and the filters behind it carry their own
   lines on their own rows. A tip listing its contents was tried and removed. */

export const FILTER_TIPS = {
  /** Tasks list (Filters.tsx). */
  tasks: {
    type: "Show only Quizzes, only Hands-On Tasks, only xAPI Tasks or only Resources.",
    certifications: "Show Tasks used in the chosen Certifications.",
  },

  /** Certifications list (CertFilters.tsx). */
  certifications: {
    industry: "Show Certifications that sit in the chosen Industries and Sub-Industries.",
    careerStage: "Show Certifications aimed at the chosen career stages.",
    type: "Show only Certifications of the chosen type.",
  },

  /** Companies list (CompanyFilters.tsx). */
  companies: {
    tier: "Show only companies on the chosen plan tiers.",
    status: "Show only companies whose subscription is in the chosen state.",
    industry: "Show only companies working in the chosen Industries.",
    partnership: "Show only companies that came in through the chosen partnerships.",
    dateRange: "Show only companies created inside the chosen dates.",
  },

  /** Users list and everything built on UsersFilters. */
  users: {
    type: "Show only B2C users, only B2B users, or both.",
    subscription: "Show only users on the chosen subscriptions.",
    company: "Show only users who belong to the chosen companies.",
  },

  /** Hands-On Task Submissions — the table row and the review queue's copy. */
  handsOn: {
    status: "Show only submissions in the chosen review states.",
    task: "Show only submissions made for the chosen Tasks.",
    parentCertification:
      "Show submissions whose Task counts towards the chosen Certifications.",
    userType: "Show only submissions from B2C users, or only from B2B users.",
    userCompany: "Show only submissions from users at the chosen companies.",
  },

  /** Question Bank. */
  questionBank: {
    type: "Show only questions of the chosen types.",
    status: "Show only Active or only Archived questions.",
  },

  /** Skills — the page that set the convention. */
  skills: {
    type: "Show only Skills, only Mastery Skills, or both grouped together.",
    certification: "Show Skills whose Tasks count towards the chosen Certifications.",
    task: "Show Skills awarded by the chosen Tasks.",
    industry: "Show Skills whose Certifications sit in the chosen Industries.",
    status: "Show only Active or only Archived Skills.",
  },

  /** Awards. */
  awards: {
    meritTier: "Show only Awards at the chosen merit tiers.",
    status: "Show only Active or only Archived Awards.",
  },

  /** Quiz Attempts. */
  quizAttempts: {
    quiz: "Show only attempts at the chosen Quizzes.",
    certification: "Show attempts at Quizzes that sit inside the chosen Certifications.",
    status: "Show only attempts in the chosen states.",
  },

  /** Who Paid — the Certification page and the Quiz page. */
  whoPaid: {
    certification: "Show only purchases of the chosen Certifications.",
    quiz: "Show only purchases of the chosen Quizzes.",
    access: "Show only what was paid for, or only what was granted free.",
  },

  /** Offer Codes. */
  offerCodes: {
    plan: "Show only codes for the monthly plan, or only for the annual one.",
    regions: "Show only codes that can be used in the chosen countries or regions.",
  },

  /** Scholarships. */
  scholarships: {
    assignedBy: "Show only scholarships the chosen admins assigned.",
  },

  /** Feedback Forms and one form's responses. */
  feedbackForms: {
    status: "Show only Active or only Disabled forms.",
    dateRange: "Count each form’s responses over the chosen dates only.",
    responsesDateRange: "Show only responses submitted inside the chosen dates.",
    createdBy: "Show only forms the chosen creators made.",
    trigger: "Show only responses collected by the chosen triggers.",
  },

  /** Exam Reviews (the proctoring console) and the ID re-upload queue. */
  examReviews: {
    reviewType: "Show only Proctoring runs, only ID Reviews or only ID Re-uploads.",
    quiz: "Show only reviews for attempts at the chosen Quizzes.",
    reuploadQuiz: "Show only re-uploads from attempts at the chosen Quizzes.",
    dateRange: "Show only reviews submitted inside the chosen dates.",
  },

  /** The "Add Certifications" picker on an Industry. */
  industries: {
    careerStage: "Narrow the list to Certifications aimed at the chosen career stage.",
    industryTag:
      "Narrow the list to Certifications already tagged to an Industry, or to untagged ones.",
    time: "Narrow the list to Certifications of the chosen length.",
  },

  /* ── Picker modals: these narrow the list you are choosing FROM. ── */

  /** Select Users, and Grant Free Attempts' copy of it. */
  userPicker: {
    type: "Narrow the list to B2C users, or to B2B users.",
    subscription: "Narrow the list to users on the chosen subscriptions.",
    role: "Narrow the list to users in the chosen roles.",
    company: "Narrow the list to users at the chosen companies.",
  },

  /** Select Tasks, and the Certification wizard's Add Existing Tasks. */
  taskPicker: {
    type: "Narrow the list to the chosen Task types.",
    visibility: "Narrow the list to Tasks learners can see, or to hidden ones.",
    certifications: "Narrow the list to Tasks used in the chosen Certifications.",
    industry: "Narrow the list to Tasks whose Certifications sit in the chosen Industries.",
  },

  /** Select Certifications. */
  certificationPicker: {
    industry: "Narrow the list to Certifications in the chosen Industries.",
    level: "Narrow the list to Certifications at the chosen levels.",
  },

  /** Select Questions (the Quiz wizard's question picker). */
  questionPicker: {
    type: "Narrow the list to questions of the chosen types.",
    category: "Narrow the list to questions in the chosen categories.",
  },
} as const;
