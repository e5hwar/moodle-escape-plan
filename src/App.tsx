import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sidebar } from "./components/Sidebar";
import { HoverTooltip } from "./components/HoverTooltip";
import { CopyCells } from "./components/CopyCells";
import { PageEnd } from "./components/PageEnd";
import { TasksPage, type TasksListState } from "./components/TasksPage";
import { type TaskTypeKey } from "./components/Footer";
import { NewTaskWizard, taskTypeKey } from "./components/NewTaskWizard";
import { AttemptsPage } from "./components/AttemptsPage";
import { AttemptViewerPage } from "./components/AttemptViewerPage";
import { type Attempt, type AttemptStatus } from "./data/attempts";
import { QuizPurchasersPage } from "./components/QuizPurchasersPage";
import { tasks, setLiveTasks, type Task, type TaskType } from "./data/tasks";
import { CertificationsPage } from "./components/CertificationsPage";
import { CertPurchasersPage } from "./components/CertPurchasersPage";
import { NewCertificationWizard, ArchiveCertificationPage } from "./components/NewCertificationWizard";
import { SkillsPage } from "./components/SkillsPage";
import { skills as seedSkills, masterySkills as seedMastery, type MasterySkill, type Skill } from "./data/skills";
import { NewAwardWizard } from "./components/NewAwardWizard";
import { nextFormId } from "./data/feedbackForms";
import type { SetupBannerState, SetupSteps } from "./components/CertificationsPage";
import { certifications as seedCerts, isSkillCatCert, setLiveCerts, certReferences, type Certification } from "./data/certifications";
import {
  certIndustryText,
  industries as seedIndustries,
  setLiveIndustries,
  syncIndustryOrder,
  type Industry,
} from "./data/industries";
import { type CertImportReport } from "./data/certImport";
import {
  awards as seedAwards,
  designTemplates as seedTemplates,
  certForAward,
  appearanceSummary,
  type Award,
  type AwardDesignTemplate,
} from "./data/awards";
import { setB2BConfig } from "./data/productConfig";
import { ContentLinksPage } from "./components/ContentLinksPage";
import {
  authoredLinks,
  certNode,
  links as seedLinks,
  type ContentNode,
  type Link,
} from "./data/contentLinks";
import { QuestionBankPage, type QbViewState } from "./components/QuestionBankPage";
import { NewQuestionWizard } from "./components/NewQuestionWizard";
import {
  categories as seedQuestionCategories,
  questions as seedQuestions,
  setLiveCategories,
  type Category as QuestionCategory,
  type Question,
  type QuestionType,
} from "./data/questionBank";
import { SpotlightsPage } from "./components/SpotlightsPage";
import { setLiveSpotlights, spotlights as seedSpotlights, type Spotlight } from "./data/spotlights";
import { ProctoringPage } from "./components/ProctoringPage";
import { ManageIdsPage } from "./components/ManageIdsPage";
import { ScholarshipsPage } from "./components/ScholarshipsPage";
import { FeedbackFormsPage } from "./components/FeedbackFormsPage";
import { FeedbackFormWizard } from "./components/FeedbackFormWizard";
import { IndustriesPage } from "./components/IndustriesPage";
import { CompaniesPage } from "./components/CompaniesPage";
import { NewCompanyWizard } from "./components/NewCompanyWizard";
import { UsersPage, type UsersListState } from "./components/UsersPage";
import { ReviewHandsOnPage } from "./components/ReviewHandsOnPage";
import { NameChangeRequestsPage } from "./components/NameChangeRequestsPage";
import { PendingIdReuploadsPage, type PendingIdListState } from "./components/PendingIdReuploadsPage";
import { ContentOverridesPage } from "./components/ContentOverridesPage";
import { buildData, attemptsForTask, fmtDT, liveCells } from "./data/certLookup";
import { getSubmissions, hasProctoringFootage } from "./data/proctoring";
import {
  DEFAULT_PRODUCT_SETTINGS,
  ProductConfigPage,
  type B2BListKey,
  type B2BValueUsage,
  type ProductSettings,
} from "./components/ProductConfigPage";
import { MergeAccountsPage } from "./components/MergeAccountsPage";
import { TransferSubscriptionPage } from "./components/TransferSubscriptionPage";
import { UserProfilePage } from "./components/UserProfilePage";
import { PlaceholderPage } from "./components/PlaceholderPage";
import { findUser } from "./data/users";
import { submissionForLearner, type TaskSubmission } from "./data/reviewSubmissions";
import {
  activeLinks,
  feedbackForms as seedForms,
  formResponses,
  inactiveLinks,
  type FeedbackForm,
} from "./data/feedbackForms";
import { buildRows, exportFormCsv } from "./data/feedbackExport";
import { LeaveGuardHost, confirmLeave, hasUnsavedChanges } from "./components/LeaveGuard";
import { companies as seedCompanies, setLiveCompanies, todayStamp, type Company } from "./data/companies";
import { AUDIENCE_ALL_USERS, audienceOf } from "./data/filters";
import type { CompaniesListState } from "./components/CompaniesPage";

// Map a certification onto its content-graph node. The graph is keyed by
// Certification id (node id === cert id), so seeded, session-created and
// pending Certifications are all linkable, and a rename keeps the links.
function certToFocusNode(cert: Certification): ContentNode {
  return certNode(cert);
}

/** The next "C-nnnn" after the highest one in the list. */
/* Certification ids are never re-issued, even after a delete: the next id
   is one past the HIGH-WATER MARK — the largest id ever in the list or ever
   issued — not just the current list's largest. The mark is also kept in
   localStorage, so a reload (which resets the list to the seed) can't hand
   a new Certification an id an earlier session used; per-id flags such as
   "Mark as Done" would otherwise carry over. */
const CERT_ID_HIGH_WATER_KEY = "cert-id-high-water";
function readCertIdHighWater(): number {
  try {
    return Number(window.localStorage.getItem(CERT_ID_HIGH_WATER_KEY)) || 0;
  } catch {
    return 0;
  }
}
function maxCertIdNumber(certs: Certification[], floor = 0): number {
  return certs.reduce((m, c) => Math.max(m, Number(c.id.replace(/\D/g, "")) || 0), floor);
}
function nextCertId(certs: Certification[], highWater: number): { id: string; n: number } {
  const n = maxCertIdNumber(certs, highWater) + 1;
  return { id: `C-${String(n).padStart(4, "0")}`, n };
}

type View =
  /** `restore`: coming back from Quiz Attempts or Who Paid — the list reopens
   *  exactly as it was left. */
  | { name: "tasks"; certificationFilter?: string; restore?: boolean }
  | { name: "certs" }
  | { name: "new-task"; taskType: TaskTypeKey }
  | { name: "edit-task"; task: Task }
  | {
      name: "attempts";
      /** The Quiz, by id — a renamed Quiz keeps its attempts. */
      taskId: string;
      /** Deep link from Manage Completions: one learner's attempts. */
      nameFilter?: string;
      statusFilter?: AttemptStatus;
      extraAttempts?: Attempt[];
    }
  | { name: "attempt-viewer"; attempt: Attempt; taskId: string }
  | { name: "quiz-purchasers"; task: Task }
  /* `imported` is a checked CSV Upload: the wizard opens with the file's
     Courses, Lessons, and Tasks already built. */
  | { name: "new-cert"; imported?: CertImportReport; restored?: Certification }
  | { name: "edit-cert"; cert: Certification }
  | { name: "archive-cert"; cert: Certification }
  | { name: "cert-purchasers"; cert: Certification }
  | { name: "content-links"; cert?: Certification }
  | { name: "skills" }
  /* Awards have no page of their own: one belongs to one Certification and is
     opened from that row's menu, so the Certification IS the route. Product
     Config's Award Templates tab sends you here too, on the Certification
     whose Award still holds a template you tried to delete. */
  | { name: "cert-award"; cert: Certification }
  /* `historyForId` opens the bank straight on one question's Version History
     page — how a version opened in the editor gets back where it came from. */
  /* `openPath` opens the table on a just-created question's category;
     `restore` puts back the exact view Create Question was pressed on. */
  | { name: "question-bank"; historyForId?: string; openPath?: string[]; restore?: QbViewState }
  | {
      name: "new-question";
      categoryPath?: string[];
      initialType?: QuestionType;
      forFormId?: string;
      /** Launched from a form still being CREATED: the crumb names it "New
       *  Feedback Form" and the way back reopens it in create mode (with the
       *  Certification it was started from, if any). */
      forFormCreating?: boolean;
      forFormCertId?: string;
      /** The bank's view when Create Question was pressed — Cancel returns to it. */
      returnTo?: QbViewState;
    }
  | { name: "edit-question"; question: Question; returnTo?: QbViewState }
  | { name: "spotlight" }
  /* `originQueue`: the Pending ID Re-Uploads rows the console was opened on,
     in that page's order — its queue while it works them. */
  | { name: "proctoring"; openSubmissionId?: string; originQueue?: string[] }
  | { name: "manage-ids" }
  | { name: "scholarship" }
  | { name: "feedback" }
  /* `forCertId`: the form was started from a Certification's Setup card
     ("Add Feedback Form"), with that Certification already its trigger — so
     Back returns to the Certifications table, not the Feedback Forms list. */
  | { name: "feedback-detail"; formId: string; creating?: boolean; forCertId?: string }
  | { name: "industries" }
  /** `restore`: coming back from Create / Edit Company Details / Manage
   *  Subscription — the list reopens exactly as it was left. */
  | { name: "companies"; query?: string; restore?: boolean }
  | { name: "new-company" }
  | { name: "edit-company"; company: Company }
  | { name: "manage-subscription"; company: Company }
  /** `restore`: coming back from a page Users opened (Scholarships, Name
   *  Changes, Manage Completions, Merge, Transfer) — the list reopens as left. */
  | { name: "users"; companyFilter?: string; restore?: boolean }
  /* `taskFilter` deep-links the page with one Task pre-selected — a Hands-On
     Task's "View All Attempts" lands here (its attempts ARE submissions),
     where a Quiz/xAPI lands on Quiz Attempts. */
  | {
      name: "review-hands-on";
      taskFilter?: string;
      /** Deep link from Manage Completions: one learner on one Task. */
      userFilter?: string;
      extraSubmissions?: TaskSubmission[];
    }
  | { name: "name-change-requests" }
  /* `restore`: back from the console — put the filters it was opened from back. */
  | { name: "pending-id-reuploads"; restore?: boolean }
  /* Manage Completions is not a nav landing page — it is only reached scoped,
     from a row's "Manage User Progress" action. `origin` is the page that
     opened it: it lights that sidebar entry and is the crumb back. */
  | {
      name: "content-overrides";
      userId?: string;
      certId?: string;
      taskId?: string;
      origin: "tasks" | "certs" | "users" | "companies";
    }
  | {
      name: "product-config";
      tab?: "general" | "display" | "award-templates" | "b2c" | "b2b" | "legal" | "permissions";
    }
  | { name: "merge-accounts" }
  | { name: "transfer-subscription" };

// --- URL routing for top-level nav pages -----------------------------------
// The app is a single-state view switcher; we give each left-nav destination
// its own URL (e.g. /moodle-escape-plan/spotlight) by syncing the History API
// with the `view` state. Only the nav landing pages are routed — wizards and
// detail sub-views keep their parent page's URL.
const BASE = import.meta.env.BASE_URL; // "/moodle-escape-plan/"

// view.name  ->  URL slug
const VIEW_SLUGS: Record<string, string> = {
  tasks: "tasks",
  "question-bank": "question-bank",
  certs: "certifications",
  industries: "industries",
  skills: "skills",
  feedback: "feedback",
  "review-hands-on": "review-hands-on",
  proctoring: "proctoring-review",
  "name-change-requests": "name-change-requests",
  "pending-id-reuploads": "pending-id-reuploads",
  "merge-accounts": "merge-accounts",
  "transfer-subscription": "transfer-subscription",
  users: "users",
  scholarship: "scholarship",
  companies: "companies",
  spotlight: "spotlight",
  "product-config": "product-config",
};

// URL slug -> view
const SLUG_TO_VIEW: Record<string, View> = {
  ...Object.fromEntries(
    Object.entries(VIEW_SLUGS).map(([name, slug]) => [slug, { name } as View]),
  ),
  // Permissions lost its own page — the old URL lands on its Product Config tab.
  permissions: { name: "product-config", tab: "permissions" },
};

// Sidebar navKey -> view (mirrors the sidebar item navKeys)
const NAV_KEY_TO_VIEW: Record<string, View> = {
  certs: { name: "certs" },
  tasks: { name: "tasks" },
  skills: { name: "skills" },
  "question-bank": { name: "question-bank" },
  spotlight: { name: "spotlight" },
  "proctoring-review": { name: "proctoring" },
  scholarship: { name: "scholarship" },
  feedback: { name: "feedback" },
  industries: { name: "industries" },
  "manage-companies": { name: "companies" },
  "manage-users": { name: "users" },
  "review-hands-on": { name: "review-hands-on" },
  "name-change-requests": { name: "name-change-requests" },
  "product-config": { name: "product-config" },
  "merge-accounts": { name: "merge-accounts" },
  "transfer-subscription": { name: "transfer-subscription" },
};

/* Manage Completions' four entry points: which sidebar entry stays lit, what
   the crumb reads, and where it goes back to. */
const CONTENT_OVERRIDES_NAV: Record<"tasks" | "certs" | "users" | "companies", string> = {
  tasks: "tasks",
  certs: "certs",
  users: "manage-users",
  companies: "manage-companies",
};
const CONTENT_OVERRIDES_BACK: Record<
  "tasks" | "certs" | "users" | "companies",
  { label: string; view: View }
> = {
  tasks: { label: "Tasks", view: { name: "tasks" } },
  certs: { label: "Certifications", view: { name: "certs" } },
  users: { label: "Users", view: { name: "users", restore: true } },
  companies: { label: "Companies", view: { name: "companies" } },
};

function currentSlug(): string {
  let p = window.location.pathname;
  if (p.startsWith(BASE)) p = p.slice(BASE.length);
  return p.replace(/^\/+|\/+$/g, "");
}

function viewFromUrl(): View {
  return SLUG_TO_VIEW[currentSlug()] ?? { name: "tasks" };
}

function urlForView(view: View): string {
  const slug = VIEW_SLUGS[view.name];
  return slug ? BASE + slug : BASE;
}

export default function App() {
  // Standalone, full-tab pages opened from the Users table ("open in new tab").
  // These render without the admin shell (no sidebar).
  const params = new URLSearchParams(window.location.search);
  const profileId = params.get("profile");
  const portfolioId = params.get("portfolio");
  const stripeCustomerId = params.get("stripeInvoices");
  const loginAsCompany = params.get("loginAs");
  const loginAsUserId = params.get("loginAsUser");
  const editTaskId = params.get("editTask");
  /* The Hands-On review screen's task link (a reviewer wants the brief, not the
     editor): its own tab, holding a placeholder until the real read-only brief
     exists. */
  const taskBriefId = params.get("taskBrief");
  /* The Certification builder's Add Existing Tasks "Preview ›": its own tab,
     holding a placeholder until a learner-facing Task preview exists. */
  const taskPreviewId = params.get("taskPreview");
  if (taskPreviewId) {
    const t = tasks.find((x) => x.id === taskPreviewId);
    return t ? <PlaceholderPage name="Task Preview" /> : <StandaloneNotFound />;
  }
  if (taskBriefId) {
    const t = tasks.find((x) => x.id === taskBriefId);
    return t ? <PlaceholderPage name="Task Brief" /> : <StandaloneNotFound />;
  }
  // Task editor in its own tab — opened from the Hands-On review screen.
  if (editTaskId) {
    const t = tasks.find((x) => x.id === editTaskId);
    return t ? (
      <NewTaskWizard
        taskType={taskTypeKey(t.type)}
        editingTask={t}
        onClose={() => window.close()}
      />
    ) : (
      <StandaloneNotFound />
    );
  }
  if (profileId) {
    // The live roster — company employees included (users.ts getUsers).
    const u = findUser(profileId);
    // The Full Profile keeps the admin shell: it is a real admin screen, so the
    // left rail stays with it even in its own tab.
    return (
      <StandaloneShell active="manage-users">
        {u ? <UserProfilePage user={u} /> : <StandaloneNotFound />}
      </StandaloneShell>
    );
  }
  if (portfolioId) {
    const u = findUser(portfolioId);
    return u ? <PlaceholderPage name="Public Portfolio" /> : <StandaloneNotFound />;
  }
  if (stripeCustomerId) {
    return <PlaceholderPage name="Stripe Invoices" />;
  }
  if (loginAsCompany) {
    return <PlaceholderPage name="Login As (Company Library)" />;
  }
  if (loginAsUserId) {
    const u = findUser(loginAsUserId);
    return u ? <PlaceholderPage name="Login As (Learner)" /> : <StandaloneNotFound />;
  }
  /* Own-tab placeholders with nothing to look up: the company's B2B dashboard
     (Companies › View Company Dashboard) and a learner's attempt page (Quiz
     Attempts › View Attempt). */
  if (params.has("companyDashboard")) {
    return <PlaceholderPage name="Company Dashboard" />;
  }
  if (params.has("viewAttempt")) {
    return <PlaceholderPage name="View Attempt" />;
  }

  return <AdminApp />;
}

/* A standalone (own-tab) screen that still wears the admin shell — left rail
 * included. Sidebar clicks leave the standalone URL behind and load the real
 * page, since nothing but this one screen lives in this tab. */
function StandaloneShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <HoverTooltip />
      <CopyCells />
      <PageEnd />
      <LeaveGuardHost />
      <Sidebar
        active={active}
        onNavigate={(key) => {
          const view = NAV_KEY_TO_VIEW[key];
          if (view) confirmLeave(() => (window.location.href = urlForView(view)));
        }}
      />
      {children}
    </div>
  );
}

/* A "View All Attempts" deep link from Manage Completions, resolved into a
 * normal View so the new tab renders the REAL page inside the admin shell —
 * sidebar, breadcrumb, the same table — rather than a bare standalone screen.
 *
 * Both destinations rebuild the same deterministic Certification Lookup data
 * set (buildData() is a pure, seeded function of fixed inputs, so it matches
 * what the originating tab saw) and hand the page the rows it would otherwise
 * lack: the Attempts and Hands-On datasets are unrelated to that model, so a
 * real pairing can be missing from either. */
function deepLinkView(params: URLSearchParams): View | null {
  const attemptsUid = params.get("attemptsUid");
  const attemptsTaskId = params.get("attemptsTaskId");
  const handsOnUid = params.get("handsOnUid");
  const handsOnTaskId = params.get("handsOnTaskId");
  const uid = attemptsUid ?? handsOnUid;
  const taskId = attemptsTaskId ?? handsOnTaskId;
  if (!uid || !taskId) return null;

  const data = buildData();
  const employee = data.employeesById[uid];
  const task = data.tasksById[taskId];
  if (!employee || !task) return null;
  // As Manage Completions last left it (completions.ts), not the bare seed.
  const cell = liveCells(data)[uid + "_" + taskId];

  if (handsOnUid && handsOnTaskId) {
    const libraryTask = tasks.find((t) => t.name === task.name);
    const user = findUser(uid);
    return {
      name: "review-hands-on",
      taskFilter: task.name,
      userFilter: employee.name,
      extraSubmissions: [
        submissionForLearner({
          userId: employee.id,
          userName: employee.name,
          email: user?.email ?? employee.contact,
          phone: user?.phone ?? employee.contact,
          userType: employee.isB2B ? "B2B" : "B2C",
          companyName: user?.companyName,
          taskName: task.name,
          taskId: libraryTask?.id ?? task.id,
          certifications: libraryTask?.usedIn ?? [task.certName],
          createdBy: libraryTask?.createdBy ?? "SkillCat",
          attempts: cell?.attempts ?? 1,
          reviewPending: cell?.status === "review",
          complete: cell?.status === "complete",
        }),
      ],
    };
  }

  const generated = attemptsForTask(uid, employee.name, employee.contact, task, cell);
  return {
    name: "attempts",
    taskId: task.id,
    nameFilter: employee.name,
    statusFilter: (params.get("attemptsStatus") as AttemptStatus | null) ?? undefined,
    extraAttempts: [...generated, ...rejectedReviewAttempts(uid, task, generated.length)],
  };
}

/** The learner's attempts Exam Reviews rejected on this Quiz, as Attempts
 *  rows — what the console's "Caught Cheating in Past Quizzes" card opens
 *  (filtered to Rejected). The generated history above only knows Passed and
 *  Failed, so without these that link landed on an empty list. Numbered after
 *  the generated attempts. */
function rejectedReviewAttempts(
  uid: string,
  task: { id: string; name: string },
  after: number,
): Attempt[] {
  return getSubmissions()
    .filter(
      (s) => s.userId === uid && s.status === "rejected" && s.taskId === task.id,
    )
    .map((s, i) => {
      const done = Date.parse(s.submittedAt.replace(/(\d+)(st|nd|rd|th)/, "$1"));
      return {
        id: `${uid}_${task.id}_${s.id}`,
        taskId: task.id,
        userId: uid,
        name: s.candidateName,
        email: s.candidateEmail,
        phone: s.candidatePhone,
        quizName: task.name,
        attemptNumber: after + i + 1,
        status: "Rejected" as const,
        startedAt: fmtDT(done - 45 * 60_000),
        completedAt: fmtDT(done),
        // Exam Reviews grades out of 10; Attempts reads a percentage.
        grade: Math.round(parseFloat(s.grade) * 10),
        review: hasProctoringFootage(s) ? ("proctored" as const) : ("id-only" as const),
        reviewedAt: fmtDT(done + 24 * 3_600_000),
        rejectionReason: s.rejectionReasons?.join(", "),
      };
    });
}

/** Opens one employee's attempts on a task in a new tab — the Quiz Attempts
 *  page for a Quiz, the Hands-On submissions page for a Hands-On Task. Both
 *  land filtered to that Task and that learner. */
function openAttemptsForUser(uid: string, taskId: string) {
  const handsOn = certTaskType(taskId) === "Hands-On Task";
  const query = handsOn
    ? `handsOnUid=${encodeURIComponent(uid)}&handsOnTaskId=${encodeURIComponent(taskId)}`
    : `attemptsUid=${encodeURIComponent(uid)}&attemptsTaskId=${encodeURIComponent(taskId)}`;
  window.open(`${window.location.origin}${window.location.pathname}?${query}`, "_blank", "noopener");
}

/** The certification model's type for a task id — the opener needs it to pick
 *  a destination, and rebuilding the (pure, seeded) model is cheap enough for
 *  a click handler. */
function certTaskType(taskId: string): TaskType | null {
  return buildData().tasksById[taskId]?.type ?? null;
}

/** Opens the "Login As" Library placeholder for a company in a new tab. */
function openLoginAsLibrary(company: string) {
  window.open(
    `${window.location.origin}${window.location.pathname}?loginAs=${encodeURIComponent(company)}`,
    "_blank",
    "noopener",
  );
}

/* An id that resolves to nothing — a stale or hand-edited link. */
function StandaloneNotFound() {
  return <PlaceholderPage name="Not Found Page" />;
}

function AdminApp() {
  /* A "View All Attempts" link lands here, not on a standalone screen — the
     tab looks exactly as if the page had been navigated to. */
  const [view, setView] = useState<View>(
    () => deepLinkView(new URLSearchParams(window.location.search)) ?? viewFromUrl(),
  );
  const [forms, setForms] = useState<FeedbackForm[]>(seedForms);
  /* The Feedback Form open in the editor, STAGED: every edit lands here, and
     only the editor's Save Changes / Create commits it to `forms`. Held at
     this level so it survives the editor's detour to Create New Question. */
  const [formDraft, setFormDraft] = useState<FeedbackForm | null>(null);
  /* The Certifications list. It lived on the Certifications page until the
     post-creation setup landed (2026-10-01): the wizard's Create now appends
     to it, and the Content Links / Award / Feedback Form flows each read it to
     say which Certifications still have setup left. */
  const [certs, setCerts] = useState<Certification[]>(seedCerts);
  // The largest Certification id number ever issued (see nextCertId).
  const certIdHighWater = useRef<number>(0);
  if (certIdHighWater.current === 0) {
    certIdHighWater.current = maxCertIdNumber(seedCerts, readCertIdHighWater());
  }
  // Every id that was ever in the list counts, so deleting the newest
  // Certification can't free its id for the next one.
  useEffect(() => {
    certIdHighWater.current = maxCertIdNumber(certs, certIdHighWater.current);
  }, [certs]);
  function issueCertId(): string {
    const { id, n } = nextCertId(certs, certIdHighWater.current);
    certIdHighWater.current = n;
    try {
      window.localStorage.setItem(CERT_ID_HIGH_WATER_KEY, String(n));
    } catch {
      /* storage unavailable — the ref still holds the mark for the session */
    }
    return id;
  }
  /* The Industries (names, icons, visibility, order). Tag MEMBERSHIP lives on
     each Certification (`industries`); the Industries page edits both lists. */
  const [industryList, setIndustryList] = useState<Industry[]>(seedIndustries);
  // Mirrored for pickers, filters and builders that aren't handed the lists.
  useLayoutEffect(() => setLiveCerts(certs), [certs]);
  /* The saved Spotlights — here, not on the page, so approvals, edits and
     saved reorders survive navigating away. Mirrored for the sidebar badge. */
  const [spotlights, setSpotlights] = useState<Spotlight[]>(seedSpotlights);
  useLayoutEffect(() => setLiveSpotlights(spotlights), [spotlights]);
  useLayoutEffect(() => setLiveIndustries(industryList), [industryList]);
  /* Keep each Industry's display order in step with the tags: a Certification
     tagged anywhere (the Certifications page, the wizard) is appended to that
     scope's order, an untagged or deleted one drops out of it. */
  useLayoutEffect(() => setIndustryList((prev) => syncIndustryOrder(prev, certs)), [certs]);
  /* Skills and Mastery Skills live here, as Certifications do, so a record
     created, edited, archived or deleted survives leaving the Skills page. */
  const [skills, setSkills] = useState<Skill[]>(seedSkills);
  const [mastery, setMastery] = useState<MasterySkill[]>(seedMastery);
  /* The Content Links graph as last saved — the Content Links page edits a
     working copy and hands it back on Save, so a Certification's "Content
     Links" setup step can flip to done. */
  const [contentLinks, setContentLinks] = useState<Link[]>(seedLinks);
  // Set while the Content Links page is open from a Certification, once a save
  // there gave that Certification its first link(s) — the return toast's cue.
  const linksAddedRef = useRef(false);
  // Leaving Content Links any other way (the sidebar) drops the cue, so a
  // later visit's Back can't raise a stale "Content Links Added".
  useEffect(() => {
    if (view.name !== "content-links") linksAddedRef.current = false;
  }, [view.name]);
  /* The setup banner's session state: "Set up later" hides it until the next
     create. Held here because the page unmounts on every trip through a
     flow. */
  const [setupBanner, setSetupBanner] = useState<SetupBannerState>({ dismissed: false });
  // Question Bank + questions created from the Feedback Form flow. The bank
  // page unmounts on every trip into the editor or another page, so its
  // questions and category tree live here — archive, delete, category edits
  // and CSV imports all write straight into these.
  const [bank, setBank] = useState<Question[]>(seedQuestions);
  const [qbCategories, setQbCategories] = useState<QuestionCategory[]>(seedQuestionCategories);
  // Mirrored for the question editor's Category picker, wherever it opens.
  useEffect(() => setLiveCategories(qbCategories), [qbCategories]);
  /* Awards used to live on the Awards page's own state. That page is gone, so
     the list sits here: the Certifications table reads it to label each row's
     menu, and the Award form writes back into it. */
  const [awards, setAwards] = useState<Award[]>(seedAwards);
  /* Product Config's SAVED settings and the Award Design Templates live here,
     so they outlast a visit to another page. Templates feed the Award
     wizard's pickers; the B2B lists and trial length are also published to
     the shared store the Company / Certification / Task wizards read. */
  const [productSettings, setProductSettings] = useState<ProductSettings>(DEFAULT_PRODUCT_SETTINGS);
  const [awardTemplates, setAwardTemplates] = useState<AwardDesignTemplate[]>(seedTemplates);
  const [companies, setCompanies] = useState<Company[]>(seedCompanies);
  // Mirrored for the pages that read companies without being handed them (the
  // Users page's Company filter, employee profile links).
  useEffect(() => setLiveCompanies(companies), [companies]);
  /* The Companies list as it was last left. The page unmounts while a company
     flow is open, so this is what brings back its search, filters, sort,
     columns, date range, page and scroll on return. */
  const companiesListRef = useRef<CompaniesListState | null>(null);
  /* The Users list as it was last left — brought back when returning from a
     page it opened. Saved through a stable callback (see UsersPage). */
  const usersListRef = useRef<UsersListState | null>(null);
  const saveUsersList = useCallback((state: UsersListState) => {
    usersListRef.current = state;
  }, []);
  const backToUsers = () => goToView({ name: "users", restore: true });
  /* A one-line success handed back by a flow that finished and navigated away
     — raised as a toast on the page it returns to. */
  const [flash, setFlash] = useState<string | null>(null);
  // Tasks published from the wizard this session. They sit on top of the seed
  // list; TasksPage re-seeds from this every time it mounts.
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);

  /* Saved edits to seed Tasks, by id — TasksPage lays them over its list on
     mount. An edit to a Task created this session replaces it in place. */
  const [taskEdits, setTaskEdits] = useState<Record<string, Task>>({});
  function saveTask(task: Task) {
    if (createdTasks.some((t) => t.id === task.id)) {
      setCreatedTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    } else {
      setTaskEdits((prev) => ({ ...prev, [task.id]: task }));
    }
  }

  /* Hidden and deleted are App state too, beside the edits: TasksPage
     re-seeds from here every time it mounts, so a hide or a delete outlasts
     a trip to another page. Hiding is an edit — it stamps Date Modified and
     drops the seed's free-text `updated` line. */
  const [deletedTaskIds, setDeletedTaskIds] = useState<ReadonlySet<string>>(() => new Set());
  function setTaskHidden(task: Task, hidden: boolean) {
    const dateModified = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
    saveTask({ ...task, hidden, dateModified, updated: undefined });
  }
  function deleteTask(task: Task) {
    setDeletedTaskIds((prev) => new Set(prev).add(task.id));
  }

  /* The working Task list every page reads — published to data/tasks so the
     pages that aren't handed it (Quiz Attempts, Who Paid, Manage User
     Progress, the wizard's pickers) see the same Tasks. */
  const liveTasks = useMemo(
    () =>
      [...createdTasks, ...tasks.map((t) => taskEdits[t.id] ?? t)].filter(
        (t) => !deletedTaskIds.has(t.id),
      ),
    [createdTasks, taskEdits, deletedTaskIds],
  );
  useLayoutEffect(() => setLiveTasks(liveTasks), [liveTasks]);
  /* The Tasks list as it was last left — brought back by Back from Quiz
     Attempts and Who Paid. */
  const tasksListRef = useRef<TasksListState | null>(null);
  /* Pending ID Re-Uploads' filters + sort, kept while its row is open in the
     Exam Reviews console so the way back lands on the same list. */
  const pendingIdListRef = useRef<PendingIdListState | null>(null);

  function addTask(task: Omit<Task, "id">) {
    setCreatedTasks((prev) => [
      { id: `T-${9000 + prev.length + 1}`, ...task },
      ...prev,
    ]);
  }

  // Each question's `forms` usage list is derived from live form state, so
  // linking/unlinking/duplicating keeps the bank's "used in" view honest.
  // Inactive links count — the question stays attached to the form.
  useEffect(() => {
    setBank((prev) =>
      prev.map((q) => {
        const names = forms
          .filter((f) => f.questions.some((l) => l.questionId === q.id))
          .map((f) => f.name);
        const same =
          names.length === q.forms.length &&
          names.every((n, i) => q.forms[i] === n);
        return same ? q : { ...q, forms: names };
      }),
    );
  }, [forms]);

  /* The address the open page sits at — wizards don't own a URL of their own,
     so this, not urlForView, is what a guarded Back has to put back. */
  const urlRef = useRef(window.location.pathname + window.location.search);
  useEffect(() => {
    urlRef.current = window.location.pathname + window.location.search;
  });

  // Keep the address bar in sync with the initial view, and follow the
  // browser's back/forward buttons by re-reading the URL into view state.
  useEffect(() => {
    const canonical = urlForView(viewFromUrl());
    if (window.location.pathname !== canonical) {
      window.history.replaceState({}, "", canonical);
    }
    function onPopState() {
      /* Back/Forward off a page with unsaved changes: the URL has already
         moved, so put the page's own URL back while the discard confirm asks,
         and only follow the button once it's confirmed. */
      if (hasUnsavedChanges()) {
        const target = window.location.pathname + window.location.search;
        window.history.pushState({}, "", urlRef.current);
        confirmLeave(() => {
          window.history.pushState({}, "", target);
          setView(viewFromUrl());
        });
        return;
      }
      setView(viewFromUrl());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // ⌘K / Ctrl+K focuses the current page's search bar (the inputs that show the
  // ⌘K hint), ready to type. Picks the first visible matching input.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        // An open modal owns the shortcut: the page's own bar is still
        // "visible" behind the overlay, so without this ⌘K would reach past a
        // picker (Grant Free Attempts) to the bar underneath it. A modal with
        // no search bar simply swallows the shortcut.
        // The TOPMOST one: a picker opened from inside another modal (Grant
        // Free Attempts → Select Users) is last in DOM order and is the one
        // wearing the shortcut.
        const modal = Array.from(
          document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
        )
          .filter((el) => el.offsetParent !== null)
          .pop();
        const target = Array.from(
          (modal ?? document).querySelectorAll<HTMLInputElement>(
            ".usearch-input, .search-input, .qb-search-input",
          ),
        ).find((el) => el.offsetParent !== null);
        if (target) {
          e.preventDefault();
          target.focus();
          target.select();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sidebarActive =
    view.name === "certs" || view.name === "new-cert" || view.name === "edit-cert" || view.name === "archive-cert" || view.name === "cert-purchasers" || view.name === "content-links"
      ? "certs"
      : view.name === "skills"
      ? "skills"
      : // Industries and Feedback are reached from the Certifications header
        // (their sidebar entries are gone), and an Award from a Certification
        // row's menu — so Certifications stays lit for all of them.
      view.name === "cert-award"
      ? "certs"
      : view.name === "new-question" && view.forFormId
      ? "certs"
      : view.name === "question-bank" ||
        view.name === "new-question" ||
        view.name === "edit-question"
      ? "question-bank"
      : view.name === "spotlight"
      ? "spotlight"
      : view.name === "proctoring" ||
        view.name === "manage-ids" ||
        view.name === "pending-id-reuploads"
      ? "proctoring-review"
      : /* Name Changes hangs off Manage Users now, not Exam Reviews. */
        view.name === "scholarship" || view.name === "name-change-requests"
      ? "manage-users"
      : view.name === "feedback" || view.name === "feedback-detail"
      ? "certs"
      : view.name === "industries"
      ? "certs"
      : view.name === "companies" || view.name === "new-company" || view.name === "edit-company" || view.name === "manage-subscription"
      ? "manage-companies"
      : view.name === "users"
      ? "manage-users"
      : view.name === "review-hands-on"
      ? "review-hands-on"
      : // Manage Completions has no sidebar entry of its own — the page it was
        // opened from stays lit.
      view.name === "content-overrides"
      ? CONTENT_OVERRIDES_NAV[view.origin]
      : view.name === "product-config"
      ? "product-config"
      : view.name === "merge-accounts"
      ? "merge-accounts"
      : view.name === "transfer-subscription"
      ? "transfer-subscription"
      : "tasks";

  function navigate(key: string) {
    const next = NAV_KEY_TO_VIEW[key];
    if (!next) return;
    setView(next);
    window.history.pushState({}, "", urlForView(next));
  }

  /* Same as `navigate`, for a view carrying state a nav key can't express (the
     Exam Reviews console opened on a specific submission). Both routed pages,
     so the URL has to follow — otherwise closing the console strands the Exam
     Reviews table under the URL of the page it was opened from. */
  function goToView(next: View) {
    setView(next);
    window.history.pushState({}, "", urlForView(next));
  }

  /* Every company created this session, newest first — they lead the
     Companies list on every visit, whatever the sort. Ids count up from the
     highest in use: a count of rows would hand out an id that's already taken
     once anything has been deleted (or past CO-090). */
  const [createdCompanyIds, setCreatedCompanyIds] = useState<string[]>([]);
  function addCompany(company: Omit<Company, "id">) {
    const top = Math.max(0, ...companies.map((c) => parseInt(c.id.replace(/\D/g, ""), 10) || 0));
    const id = `CO-${String(top + 1).padStart(3, "0")}`;
    setCreatedCompanyIds((prev) => [id, ...prev]);
    setCompanies((prev) => [{ id, ...company }, ...prev]);
  }

  function updateCompany(company: Company) {
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? company : c)));
  }

  function deleteCompany(company: Company) {
    setCompanies((prev) => prev.filter((c) => c.id !== company.id));
  }

  /* Product Config's B2B lists, and what carries each value: Partnerships and
     Trades sit on companies (partnership / industry) and on Tasks and
     Certifications as tags; Cancellation Reasons on companies only (the
     comma-joined `cancellationReason`). */
  const reasonsOf = (c: Company) => (c.cancellationReason ? c.cancellationReason.split(", ") : []);
  const companyValues = (c: Company, list: B2BListKey) =>
    list === "partnerships" ? c.partnership : list === "trades" ? c.industry : reasonsOf(c);
  function b2bValueUsage(list: B2BListKey, value: string): B2BValueUsage {
    const tagged = list !== "cancelReasons";
    return {
      companies: companies.filter((c) => companyValues(c, list).includes(value)).length,
      tasks: tagged ? liveTasks.filter((t) => t.tags?.includes(value)).length : 0,
      certifications: tagged ? certs.filter((c) => c.tags?.includes(value)).length : 0,
    };
  }
  /* A confirmed removal: off the SAVED list (published to every picker and
     filter) and off every record that carries it. */
  function removeB2BValue(list: B2BListKey, value: string) {
    const nextSettings = {
      ...productSettings,
      [list]: productSettings[list].filter((v) => v !== value),
    };
    setProductSettings(nextSettings);
    setB2BConfig({ [list]: nextSettings[list] });
    const drop = (vs: string[]) => vs.filter((v) => v !== value);
    setCompanies((prev) =>
      prev.map((c) => {
        if (!companyValues(c, list).includes(value)) return c;
        if (list === "partnerships") return { ...c, partnership: drop(c.partnership) };
        if (list === "trades") return { ...c, industry: drop(c.industry) };
        return { ...c, cancellationReason: drop(reasonsOf(c)).join(", ") || undefined };
      }),
    );
    if (list === "cancelReasons") return;
    liveTasks.filter((t) => t.tags?.includes(value)).forEach((t) => saveTask({ ...t, tags: drop(t.tags ?? []) }));
    setCerts((prev) => prev.map((c) => (c.tags?.includes(value) ? { ...c, tags: drop(c.tags) } : c)));
  }

  function upsertForm(form: FeedbackForm) {
    setForms((prev) => {
      const idx = prev.findIndex((f) => f.id === form.id);
      if (idx < 0) return [form, ...prev];
      const next = [...prev];
      next[idx] = form;
      return next;
    });
  }

  /* The four post-creation setup steps (Claude Design "Certification
     Post-Creation Setup"), each derived from the data that flow writes rather
     than tracked on its own: an Industry path on the record, a Content Link
     this Certification AUTHORED (added on its own Content Links page — links
     other Certifications made that point at it don't count), an Award for it,
     a Feedback Form triggered by it. The Certifications page turns this into
     the banner count, the row pills and the Setup card. */
  function setupStepsFor(cert: Certification): SetupSteps {
    const nodeId = certToFocusNode(cert).id;
    const byKind = { prerequisite: 0, recommended: 0, related: 0 };
    for (const l of authoredLinks(nodeId, contentLinks)) byKind[l.kind] += 1;
    const linkDetail = (Object.keys(byKind) as (keyof typeof byKind)[])
      .filter((k) => byKind[k] > 0)
      .map((k) => `${byKind[k]} ${k}`)
      .join(" · ");
    // An Archived Award isn't issued to anyone new, so it doesn't count as set up.
    const award = awards.find((a) => a.certificationId === cert.id && a.status === "Active");
    const form = feedbackFormFor(cert);
    return {
      // Only SkillCat-created Certifications carry Industry tags, so a
      // company-created one has no Industries step at all.
      industries: isSkillCatCert(cert)
        ? { done: cert.industries.length > 0, detail: certIndustryText(cert.industries) }
        : { done: false, na: true },
      // Content Links are SkillCat-catalog only, so a company-created
      // Certification has no Content Links step (nor the menu entry).
      links: isSkillCatCert(cert)
        ? { done: linkDetail.length > 0, detail: linkDetail }
        : { done: false, na: true },
      award: award
        ? {
            done: true,
            detail: `${appearanceSummary(award)} · ${award.meritTier}`,
          }
        : { done: false },
      // A Certification the trigger picker won't offer (B2B Companies Only,
      // or company-made) can't have a Feedback Form, so the step isn't
      // offered for it at all.
      feedback: !canHaveFeedbackForm(cert)
        ? { done: false, na: true }
        : form
          ? {
              done: true,
              detail: `${form.name.trim() || "Untitled form"} · ${activeLinks(form).length} ${
                activeLinks(form).length === 1 ? "question" : "questions"
              }`,
            }
          : { done: false },
    };
  }

  /* The trigger picker's rule (SelectRequirementModal `allUsersOnly`): only a
     SkillCat-made, All Users Certification can fire a Feedback Form. */
  function canHaveFeedbackForm(cert: Certification): boolean {
    return isSkillCatCert(cert) && audienceOf(cert.tags) === AUDIENCE_ALL_USERS;
  }

  /* The ACTIVE Feedback Form this Certification fires — matched by id, never
     by name. A deactivated form doesn't fire, so it doesn't count as set up. */
  function feedbackFormFor(cert: Certification): FeedbackForm | undefined {
    return forms.find(
      (f) =>
        f.status === "active" &&
        f.triggers.some((t) => t.kind === "certification" && t.refId === cert.id),
    );
  }

  /* Open a saved form in the editor on a staged copy of it. `forCertId`: opened
     from that Certification's Setup card, so leaving returns there. */
  function openFeedbackForm(id: string, forCertId?: string) {
    const form = forms.find((f) => f.id === id);
    if (!form) return;
    setFormDraft(form);
    setView({ name: "feedback-detail", formId: id, forCertId });
  }

  /* Delete a Certification and everything tied to it, as its confirm says:
     the record, every Content Link touching its graph node (either end), its
     Award, and the Feedback Form triggers that fire on it (the forms stay).
     Other Certifications stop naming it as a replacement. The page clears
     its own "Mark as Done" flag. A Certification other Certifications build
     on (Condition Sets, imported Courses — certReferences) is never deleted,
     whatever path asks; the Certifications page explains why first. */
  function deleteCertEverywhere(cert: Certification) {
    if (certReferences(cert.id, certs).length > 0) return;
    const nodeId = certToFocusNode(cert).id;
    setCerts((prev) =>
      prev
        .filter((c) => c.id !== cert.id)
        .map((c) =>
          c.replacementIds?.includes(cert.id)
            ? {
                ...c,
                replacementIds: c.replacementIds.filter((r) => r !== cert.id).length
                  ? c.replacementIds.filter((r) => r !== cert.id)
                  : undefined,
              }
            : c,
        ),
    );
    setContentLinks((prev) => prev.filter((l) => l.from !== nodeId && l.to !== nodeId));
    setAwards((prev) => prev.filter((a) => a.certificationId !== cert.id));
    setForms((prev) =>
      prev.map((f) =>
        f.triggers.some((t) => t.kind === "certification" && t.refId === cert.id)
          ? {
              ...f,
              triggers: f.triggers.filter(
                (t) => !(t.kind === "certification" && t.refId === cert.id),
              ),
            }
          : f,
      ),
    );
  }

  /** Links this Certification authored — the setup step's own count. */
  function linkCount(nodeId: string, links: Link[]): number {
    return authoredLinks(nodeId, links).length;
  }

  /* "Add Feedback Form" from a Certification's Setup card: a new form,
     prefilled to fire on that Certification, opened in the one-page editor.
     It is only STAGED — nothing is created or mapped until the editor's
     Create (which wants a name and a question first); leaving drops it. */
  function addFeedbackFormFor(cert: Certification) {
    if (!canHaveFeedbackForm(cert)) return;
    /* A deactivated form still holds its mappings (one form per
       Certification), so when one already fires on this Certification "Add"
       opens it — to activate it from the list, or re-map — rather than
       starting a second form the trigger lock would refuse. */
    const holder = forms.find(
      (f) =>
        f.status !== "deleted" &&
        f.triggers.some((t) => t.kind === "certification" && t.refId === cert.id),
    );
    if (holder) {
      openFeedbackForm(holder.id, cert.id);
      return;
    }
    const today = todayStamp();
    const form: FeedbackForm = {
      id: nextFormId(forms),
      name: "",
      status: "active",
      questions: [],
      triggers: [
        {
          id: `tr-${Math.random().toString(36).slice(2, 8)}`,
          kind: "certification",
          refId: cert.id,
          refName: cert.name,
          mappedAt: today,
        },
      ],
      createdBy: "You",
      createdAt: today,
      updatedAt: today,
      responseCount: 0,
    };
    setFormDraft(form);
    setView({ name: "feedback-detail", formId: form.id, creating: true, forCertId: cert.id });
  }

  // "New questions can be created in the Question Bank as part of this flow,
  // then linked" — the wizard hands back the question; we add it to the bank
  // and link it to the form that launched the flow.
  /* Set by a create, read by the editor's onClose right after it: the bank
     comes back on the new question's category / sub-category (user,
     2026-10-03) instead of where the editor was opened from. Cancel leaves it
     null, so it returns to the bank's landing as before. */
  const createdPathRef = useRef<string[] | null>(null);

  /* A question made inside a Quiz's Questions step (Create New Question): the
     Quiz has already taken it as a static row; it just needs filing. No flash —
     the admin is still mid-wizard. */
  const fileQuizQuestion = (q: Question) => setBank((prev) => [q, ...prev]);

  function handleQuestionCreated(q: Question, forFormId?: string) {
    // The form being edited is a staged copy: the new question joins THAT,
    // and reaches users only when the form's Save Changes / Create commits it.
    const form = forFormId && formDraft?.id === forFormId ? formDraft : undefined;
    // It arrives Active either way — the wizard writes no other status — so
    // only the form link has to be applied here.
    setBank((prev) => [
      { ...q, forms: form?.name.trim() ? [form.name] : q.forms },
      ...prev,
    ]);
    if (form) {
      setFormDraft({
        ...form,
        questions: [
          ...activeLinks(form),
          { questionId: q.id, mandatory: false, status: "active", linkedAt: todayStamp() },
          ...inactiveLinks(form),
        ],
      });
    }
    // Raised on whichever page the editor hands back to — the bank or the form.
    setFlash("Question Created");
    // The bank reopens on the category it was filed under (onClose reads it).
    createdPathRef.current = q.categoryPath;
  }

  /* The editor works on the staged copy; `savedForm` is the stored record
     (absent for a new form) that "No changes to save" is measured against. */
  const savedForm =
    view.name === "feedback-detail" ? forms.find((f) => f.id === view.formId) : undefined;
  const activeForm =
    view.name === "feedback-detail"
      ? formDraft?.id === view.formId
        ? formDraft
        : savedForm ?? null
      : null;

  return (
    <div className="app">
      <HoverTooltip />
      <CopyCells />
      <PageEnd />
      <LeaveGuardHost />
      {/* The sidebar is a way out of every wizard — it asks first when the open
          page has unsaved changes, like the page's own Cancel does. */}
      <Sidebar active={sidebarActive} onNavigate={(key) => confirmLeave(() => navigate(key))} />
      {view.name === "tasks" ? (
        <div className="main">
          <div className="workspace">
            <TasksPage
              initialCertificationFilter={view.certificationFilter}
              onNewTask={(t) => setView({ name: "new-task", taskType: t })}
              onEditTask={(task) => setView({ name: "edit-task", task })}
              onOpenCompanyDashboard={openLoginAsLibrary}
              onViewAttempts={(task) =>
                /* A Hands-On Task has no Quiz Attempts row — its attempts are
                   the review submissions, so send it to Hands-On scoped to
                   that Task instead. */
                task.type === "Hands-On Task"
                  ? setView({ name: "review-hands-on", taskFilter: task.name })
                  : setView({ name: "attempts", taskId: task.id })
              }
              onViewPayers={(task) => setView({ name: "quiz-purchasers", task })}
              onManageProgress={(task) =>
                setView({ name: "content-overrides", taskId: task.id, origin: "tasks" })
              }
              onOpenQuestionBank={() => navigate("question-bank")}
              onOpenSkills={() => navigate("skills")}
              tasks={liveTasks}
              onSetHidden={setTaskHidden}
              onDeleteTask={deleteTask}
              restore={view.restore ? tasksListRef.current : null}
              onSaveState={(state) => {
                tasksListRef.current = state;
              }}
              flash={flash}
              onFlashDone={() => setFlash(null)}
            />
          </div>
        </div>
      ) : view.name === "attempts" ? (
        <AttemptsPage
          taskId={view.taskId}
          initialNameFilter={view.nameFilter}
          initialStatusFilter={view.statusFilter}
          extraAttempts={view.extraAttempts}
          onBack={() => setView({ name: "tasks", restore: true })}
        />
      ) : view.name === "attempt-viewer" ? (
        <AttemptViewerPage
          attempt={view.attempt}
          onBack={() => setView({ name: "attempts", taskId: view.taskId })}
        />
      ) : view.name === "quiz-purchasers" ? (
        <QuizPurchasersPage task={view.task} onBack={() => setView({ name: "tasks", restore: true })} />
      ) : view.name === "certs" ? (
        <CertificationsPage
          certs={certs}
          contentLinks={contentLinks}
          setCerts={setCerts}
          setupStepsFor={setupStepsFor}
          setupBanner={setupBanner}
          setSetupBanner={setSetupBanner}
          flash={flash}
          onFlashDone={() => setFlash(null)}
          onAddFeedbackForm={addFeedbackFormFor}
          onNewCert={() => setView({ name: "new-cert" })}
          onImportCert={(imported) => setView({ name: "new-cert", imported })}
          onRestoreCert={(restored) => setView({ name: "new-cert", restored })}
          onEditCert={(cert) => setView({ name: "edit-cert", cert })}
          onOpenCompanyDashboard={openLoginAsLibrary}
          onViewPayers={(cert) => setView({ name: "cert-purchasers", cert })}
          onViewAllTasks={(cert) => setView({ name: "tasks", certificationFilter: cert.name })}
          onManageContentLinks={(cert) => setView({ name: "content-links", cert })}
          onManageProgress={(cert) =>
            setView({ name: "content-overrides", certId: cert.id, origin: "certs" })
          }
          onArchiveCert={(cert) => setView({ name: "archive-cert", cert })}
          onDeleteCert={deleteCertEverywhere}
          onManageAward={(cert) => setView({ name: "cert-award", cert })}
          awardForCert={(cert) => awards.find((a) => a.certificationId === cert.id)}
          onOpenIndustries={() => navigate("industries")}
          /* With a Certification (its done Setup step): that Certification's
             own form. Without (the header button): the Feedback Forms list. */
          onOpenFeedback={(cert) => {
            const form = cert ? feedbackFormFor(cert) : undefined;
            if (form && cert) openFeedbackForm(form.id, cert.id);
            else navigate("feedback");
          }}
        />
      ) : view.name === "cert-purchasers" ? (
        <CertPurchasersPage cert={view.cert} onBack={() => setView({ name: "certs" })} />
      ) : view.name === "content-links" ? (
        <ContentLinksPage
          initialFocus={view.cert ? certToFocusNode(view.cert) : undefined}
          links={contentLinks}
          onSaveLinks={(next) => {
            // The return toast says "Content Links Added" only when this
            // Certification went from no links to some — a re-ordered strength
            // is a save, not a setup step done.
            if (view.cert) {
              const nodeId = certToFocusNode(view.cert).id;
              if (linkCount(nodeId, contentLinks) === 0 && linkCount(nodeId, next) > 0) {
                linksAddedRef.current = true;
              }
            }
            setContentLinks(next);
          }}
          onBack={
            view.cert
              ? () => {
                  if (linksAddedRef.current) setFlash("Content Links Added");
                  linksAddedRef.current = false;
                  setView({ name: "certs" });
                }
              : undefined
          }
          backLabel="Certifications"
        />
      ) : view.name === "skills" ? (
        <SkillsPage
          skills={skills}
          setSkills={setSkills}
          mastery={mastery}
          setMastery={setMastery}
          onBackToTasks={() => navigate("tasks")}
        />
      ) : view.name === "cert-award" ? (
        (() => {
          const existing = awards.find((a) => a.certificationId === view.cert.id);
          return (
            <NewAwardWizard
              key={view.cert.id}
              certification={view.cert}
              editingAward={existing}
              allAwards={awards}
              templates={awardTemplates}
              onClose={() => navigate("certs")}
              onSave={(a) => {
                // A first Award is a setup step done — the Certifications
                // table says so on return.
                setFlash(existing ? "Award Updated" : "Award Added");
                setAwards((prev) => {
                  const i = prev.findIndex((x) => x.id === a.id);
                  if (i < 0) return [a, ...prev];
                  const next = [...prev];
                  next[i] = a;
                  return next;
                });
              }}
              onDelete={
                existing
                  ? () => {
                      setAwards((prev) => prev.filter((x) => x.id !== existing.id));
                      setFlash("Award Deleted");
                      navigate("certs");
                    }
                  : undefined
              }
            />
          );
        })()
      ) : view.name === "question-bank" ? (
        <QuestionBankPage
          questions={bank}
          setQuestions={setBank}
          categories={qbCategories}
          setCategories={setQbCategories}
          onNewQuestion={(categoryPath, initialType, returnTo) =>
            setView({ name: "new-question", categoryPath, initialType, returnTo })
          }
          onEditQuestion={(question, returnTo) =>
            setView({ name: "edit-question", question, returnTo })
          }
          initialHistoryId={view.historyForId}
          onBackToTasks={() => navigate("tasks")}
          initialPath={view.openPath}
          restore={view.restore}
          flash={flash}
          onFlashDone={() => setFlash(null)}
        />
      ) : view.name === "new-question" ? (
        <NewQuestionWizard
          initialCategoryPath={view.categoryPath}
          initialType={view.initialType}
          onCreate={(q) => handleQuestionCreated(q, view.forFormId)}
          onClose={() =>
            view.forFormId
              ? setView({
                  name: "feedback-detail",
                  formId: view.forFormId,
                  creating: view.forFormCreating,
                  forCertId: view.forFormCertId,
                })
              : (() => {
                  // Created → the new question's category; Cancel → wherever
                  // Create Question was pressed.
                  const openPath = createdPathRef.current ?? undefined;
                  createdPathRef.current = null;
                  setView(
                    openPath
                      ? { name: "question-bank", openPath }
                      : { name: "question-bank", restore: view.returnTo },
                  );
                })()
          }
          crumbs={
            view.forFormId
              ? [
                  { label: "Certifications", onClick: () => navigate("certs") },
                  { label: "Feedback Forms", onClick: () => setView({ name: "feedback" }) },
                  {
                    label: view.forFormCreating ? "New Feedback Form" : "Edit Feedback Form",
                    onClick: () =>
                      setView({
                        name: "feedback-detail",
                        formId: view.forFormId!,
                        creating: view.forFormCreating,
                        forCertId: view.forFormCertId,
                      }),
                  },
                ]
              : [
                  { label: "Tasks", onClick: () => navigate("tasks") },
                  {
                    label: "Question Bank",
                    onClick: () => setView({ name: "question-bank", restore: view.returnTo }),
                  },
                ]
          }
        />
      ) : view.name === "edit-question" ? (
        (() => {
          /* Past versions open in the Version History page's preview panel,
             never here — the editor only ever edits the current question. */
          return (
            <NewQuestionWizard
              key={view.question.id}
              editingQuestion={view.question}
              onSave={(q) => {
                setBank((prev) => prev.map((x) => (x.id === q.id ? q : x)));
                setFlash("Question Updated");
              }}
              /* Every way out puts the bank back as it was when Edit was
                 pressed (`returnTo`). */
              crumbs={[
                { label: "Tasks", onClick: () => navigate("tasks") },
                {
                  label: "Question Bank",
                  onClick: () => setView({ name: "question-bank", restore: view.returnTo }),
                },
              ]}
              onClose={() => setView({ name: "question-bank", restore: view.returnTo })}
            />
          );
        })()
      ) : view.name === "spotlight" ? (
        <SpotlightsPage spotlights={spotlights} setSpotlights={setSpotlights} />
      ) : view.name === "proctoring" ? (
        <ProctoringPage
          key={view.openSubmissionId ?? "queue"}
          onPendingIdReuploads={() => setView({ name: "pending-id-reuploads" })}
          initialSubmissionId={view.openSubmissionId}
          originQueueIds={view.originQueue}
          onExitToOrigin={(toast) => {
            if (toast) setFlash(toast);
            goToView({ name: "pending-id-reuploads", restore: true });
          }}
          originLabel="Pending ID Re-Uploads"
        />
      ) : /* Currently unreachable: the Proctoring header's "View All IDs" button was
             removed 2026-08-25 and this view has no nav key. Kept wired so restoring
             an entry point is a one-liner. */
      view.name === "manage-ids" ? (
        <ManageIdsPage onBack={() => setView({ name: "proctoring" })} />
      ) : view.name === "scholarship" ? (
        <ScholarshipsPage onBack={backToUsers} />
      ) : view.name === "industries" ? (
        <IndustriesPage
          industries={industryList}
          setIndustries={setIndustryList}
          certs={certs}
          setCerts={setCerts}
          onBackToCerts={() => navigate("certs")}
        />
      ) : view.name === "companies" ? (
        <CompaniesPage
          companies={companies}
          flash={flash}
          onFlashDone={() => setFlash(null)}
          onDeleteCompany={deleteCompany}
          initialQuery={view.query}
          pinnedIds={createdCompanyIds}
          restore={view.restore ? companiesListRef.current : null}
          onSaveState={(state) => { companiesListRef.current = state; }}
          onNewCompany={() => setView({ name: "new-company" })}
          onEditCompany={(company) => setView({ name: "edit-company", company })}
          onManageSubscription={(company) => setView({ name: "manage-subscription", company })}
          onUpdateCompany={updateCompany}
          onViewEmployees={(company) => setView({ name: "users", companyFilter: company.name })}
          onNavigateToProductConfig={() => setView({ name: "product-config", tab: "b2b" })}
        />
      ) : view.name === "new-company" ? (
        <NewCompanyWizard
          onClose={() => setView({ name: "companies", restore: true })}
          onCreate={addCompany}
          /* A finished create opens the list fresh — default sort, no search
             or filters — with the new company pinned at the top. Cancel
             (onClose) still goes back to the list as it was. */
          onCreated={(message) => {
            setFlash(message);
            setView({ name: "companies" });
          }}
          onNavigateToProductConfig={() => setView({ name: "product-config", tab: "b2b" })}
        />
      ) : view.name === "edit-company" ? (
        <NewCompanyWizard
          editCompany={view.company}
          detailsOnly
          onClose={() => setView({ name: "companies", restore: true })}
          onSave={updateCompany}
          onCreated={(message) => {
            setFlash(message);
            setView({ name: "companies", restore: true });
          }}
          onNavigateToProductConfig={() => setView({ name: "product-config", tab: "b2b" })}
        />
      ) : view.name === "manage-subscription" ? (
        <NewCompanyWizard
          editCompany={view.company}
          subscriptionOnly
          onClose={() => setView({ name: "companies", restore: true })}
          onSave={updateCompany}
          onCreated={(message) => {
            setFlash(message);
            setView({ name: "companies", restore: true });
          }}
        />
      ) : view.name === "users" ? (
        <UsersPage
          onViewCompany={(name) => setView({ name: "companies", query: name })}
          onManageCompletions={(userId) =>
            setView({ name: "content-overrides", userId, origin: "users" })
          }
          onOpenScholarships={() => navigate("scholarship")}
          onOpenNameChanges={() => navigate("name-change-requests")}
          onOpenMergeAccounts={() => navigate("merge-accounts")}
          onOpenTransferSubscription={() => navigate("transfer-subscription")}
          initialCompanyFilter={view.companyFilter}
          restore={view.restore ? usersListRef.current : null}
          onSaveState={saveUsersList}
          flash={flash}
          onFlashDone={() => setFlash(null)}
        />
      ) : view.name === "review-hands-on" ? (
        <ReviewHandsOnPage
          initialTaskFilter={view.taskFilter}
          initialQuery={view.userFilter}
          extraSubmissions={view.extraSubmissions}
        />
      ) : view.name === "pending-id-reuploads" ? (
        <PendingIdReuploadsPage
          onBack={() => setView({ name: "proctoring" })}
          onReview={(id, queueIds, state) => {
            pendingIdListRef.current = state;
            goToView({ name: "proctoring", openSubmissionId: id, originQueue: queueIds });
          }}
          restore={view.restore ? pendingIdListRef.current : null}
          flash={flash}
          onFlashDone={() => setFlash(null)}
        />
      ) : view.name === "name-change-requests" ? (
        <NameChangeRequestsPage onBack={backToUsers} />
      ) : view.name === "content-overrides" ? (
        <ContentOverridesPage
          onViewAttempts={openAttemptsForUser}
          initialUserId={view.userId}
          initialCertId={view.certId}
          initialTaskId={view.taskId}
          backLabel={CONTENT_OVERRIDES_BACK[view.origin].label}
          onBack={() => setView(CONTENT_OVERRIDES_BACK[view.origin].view)}
        />
      ) : view.name === "product-config" ? (
        <ProductConfigPage
          initialTab={view.tab}
          navKey={view}
          saved={productSettings}
          onSave={(next) => {
            setProductSettings(next);
            setB2BConfig({
              partnerships: next.partnerships,
              trades: next.trades,
              cancelReasons: next.cancelReasons,
              trialDays: parseInt(next.b2bTrialDays, 10),
            });
          }}
          templates={awardTemplates}
          setTemplates={setAwardTemplates}
          usageOf={b2bValueUsage}
          onRemoveValue={removeB2BValue}
          onEditAward={(award) => {
            const cert = certForAward(award);
            if (cert) setView({ name: "cert-award", cert });
          }}
        />
      ) : view.name === "merge-accounts" ? (
        <MergeAccountsPage
          onClose={backToUsers}
          /* A finished merge has no screen of its own: it lands back on Manage
             Users and says what happened there. */
          onMerged={(message) => {
            setFlash(message);
            backToUsers();
          }}
        />
      ) : view.name === "transfer-subscription" ? (
        <TransferSubscriptionPage
          onClose={backToUsers}
          /* Like a finished merge: no screen of its own, it lands back on
             Manage Users and says what happened there. */
          onTransferred={(message) => {
            setFlash(message);
            backToUsers();
          }}
        />
      ) : view.name === "feedback" ? (
        <FeedbackFormsPage
          forms={forms}
          onOpen={(id) => openFeedbackForm(id)}
          /* The responses viewer is shelved for now — the menu action just
             downloads the form's responses as CSV. */
          onExportResponses={(id) => {
            const form = forms.find((f) => f.id === id);
            if (!form) return;
            exportFormCsv(form, buildRows(form, bank), formResponses[form.id] ?? []);
          }}
          /* A new form (blank, or a Duplicate's copy) opens STAGED — it joins
             the list only on the editor's Create. */
          onCreate={(form) => {
            setFormDraft(form);
            setView({ name: "feedback-detail", formId: form.id, creating: true });
          }}
          onUpdate={(form) => upsertForm(form)}
          /* Deleting is a tombstone, not a purge: the record stays so its
             responses keep resolving, and the list hides Deleted forms. */
          onDelete={(id) =>
            setForms((prev) =>
              prev.map((f) => (f.id === id ? { ...f, status: "deleted" as const } : f)),
            )
          }
          onBackToCerts={() => navigate("certs")}
          flash={flash}
          onFlashDone={() => setFlash(null)}
        />
      ) : view.name === "feedback-detail" && activeForm ? (
        <FeedbackFormWizard
          form={activeForm}
          creating={view.creating}
          allForms={forms}
          bank={bank}
          saved={savedForm}
          onBack={(finished) => {
            /* Create / Save Changes commit the staged copy, stamped with the
               real day so it sorts to the top of Last Modified. Cancel and
               the crumbs just drop it — a new form never reaches the list. */
            if (finished) upsertForm({ ...activeForm, updatedAt: todayStamp() });
            setFormDraft(null);
            // Only Create / Save Changes say so — Cancel and the crumbs don't.
            if (finished) setFlash(view.creating ? "Feedback Form Created" : "Feedback Form Updated");
            // Opened from a Certification's Setup card: Back is the table it
            // came from.
            if (view.forCertId) navigate("certs");
            else setView({ name: "feedback" });
          }}
          onBackToCerts={() => navigate("certs")}
          // Nothing was stored, so a discard only drops the staged copy.
          onDiscard={() => setFormDraft(null)}
          onUpdate={setFormDraft}
          onCreateQuestion={() =>
            // No category pre-picked: the admin chooses where it lives (user,
            // 2026-10-03 — was "Learner Feedback").
            setView({
              name: "new-question",
              forFormId: activeForm.id,
              forFormCreating: view.creating,
              forFormCertId: view.forCertId,
            })
          }
          flash={flash}
          onFlashDone={() => setFlash(null)}
        />
      ) : view.name === "new-task" ? (
        <NewTaskWizard
          taskType={view.taskType}
          onClose={() => setView({ name: "tasks" })}
          onCreate={(task) => {
            addTask(task);
            setFlash("Task Created");
            setView({ name: "tasks" });
          }}
          onQuestionCreated={fileQuizQuestion}
        />
      ) : view.name === "edit-task" ? (
        <NewTaskWizard
          taskType={taskTypeKey(view.task.type)}
          editingTask={view.task}
          onClose={() => setView({ name: "tasks" })}
          onSave={(task) => {
            saveTask(task);
            setFlash("Task Updated");
            setView({ name: "tasks" });
          }}
          onQuestionCreated={fileQuizQuestion}
        />
      ) : view.name === "edit-cert" ? (
        <NewCertificationWizard
          editingCert={view.cert}
          onClose={() => setView({ name: "certs" })}
          onSave={(cert) => {
            setCerts((prev) => prev.map((c) => (c.id === cert.id ? cert : c)));
            setFlash("Certification Updated");
          }}
          onTasksCreated={(list) => list.forEach(addTask)}
          onQuestionCreated={fileQuizQuestion}
        />
      ) : view.name === "archive-cert" ? (
        <ArchiveCertificationPage
          cert={certs.find((c) => c.id === view.cert.id) ?? view.cert}
          onClose={() => setView({ name: "certs" })}
          onUnarchive={() => {
            // Back to the visibility it had before it was archived (Visible
            // when that was never recorded). The replacement settings only
            // mean anything while archived, so they are cleared with it.
            const id = view.cert.id;
            setCerts((prev) =>
              prev.map((c) =>
                c.id === id
                  ? {
                      ...c,
                      visibility: c.visibilityBeforeArchive ?? "Visible",
                      visibilityBeforeArchive: undefined,
                      replacementIds: undefined,
                      replacementAlert: undefined,
                    }
                  : c,
              ),
            );
            setFlash("Certification Unarchived");
            setView({ name: "certs" });
          }}
          onArchive={({ replacementIds, replacementAlert }) => {
            const id = view.cert.id;
            const current = certs.find((c) => c.id === id) ?? view.cert;
            const wasArchived = current.visibility === "Archived";
            // The replacements and alert are stored on the record (absent when
            // empty). A first archive also remembers the visibility it had,
            // which Unarchive restores; re-saving an archived one keeps it.
            setCerts((prev) =>
              prev.map((c) => {
                if (c.id !== id) return c;
                const prevVis = c.visibility ?? "Visible";
                return {
                  ...c,
                  visibility: "Archived" as const,
                  visibilityBeforeArchive:
                    prevVis === "Archived" ? c.visibilityBeforeArchive : prevVis,
                  replacementIds: replacementIds.length > 0 ? replacementIds : undefined,
                  replacementAlert,
                };
              }),
            );
            setFlash(wasArchived ? "Certification Updated" : "Certification Archived");
            setView({ name: "certs" });
          }}
        />
      ) : (
        <NewCertificationWizard
          imported={view.name === "new-cert" ? view.imported : undefined}
          restored={view.name === "new-cert" ? view.restored : undefined}
          onCreate={(record) => {
            // Never an id a deleted (or earlier-session) Certification had.
            const id = issueCertId();
            setCerts((prev) => [{ id, ...record }, ...prev]);
            setFlash("Certification Created");
            // A fresh Certification re-opens a banner put off with "Set up later".
            setSetupBanner((prev) => ({ ...prev, dismissed: false }));
          }}
          // Tasks made inside the builder join the Task library with it.
          onTasksCreated={(list) => list.forEach(addTask)}
          onClose={() => setView({ name: "certs" })}
          onQuestionCreated={fileQuizQuestion}
        />
      )}
    </div>
  );
}
