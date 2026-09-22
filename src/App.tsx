import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./components/Sidebar";
import { HoverTooltip } from "./components/HoverTooltip";
import { CopyCells } from "./components/CopyCells";
import { TasksPage } from "./components/TasksPage";
import { type TaskTypeKey } from "./components/Footer";
import { NewTaskWizard, taskTypeKey } from "./components/NewTaskWizard";
import { AttemptsPage } from "./components/AttemptsPage";
import { AttemptViewerPage } from "./components/AttemptViewerPage";
import { type Attempt, type AttemptStatus } from "./data/attempts";
import { QuizPurchasersPage } from "./components/QuizPurchasersPage";
import { tasks, type Task, type TaskType } from "./data/tasks";
import { CertificationsPage } from "./components/CertificationsPage";
import { CertPurchasersPage } from "./components/CertPurchasersPage";
import { NewCertificationWizard, ArchiveCertificationPage } from "./components/NewCertificationWizard";
import { SkillsPage } from "./components/SkillsPage";
import { NewAwardWizard } from "./components/NewAwardWizard";
import { AwardRecipientsPage } from "./components/AwardRecipientsPage";
import { type Certification } from "./data/certifications";
import {
  awards as seedAwards,
  designTemplates,
  certForAward,
  type Award,
} from "./data/awards";
import { ContentLinksPage } from "./components/ContentLinksPage";
import { nodes as contentNodes, type ContentNode, type Level } from "./data/contentLinks";
import { QuestionBankPage } from "./components/QuestionBankPage";
import { NewQuestionWizard } from "./components/NewQuestionWizard";
import { questions as seedQuestions, versionText, type Question, type QuestionType } from "./data/questionBank";
import { SpotlightsPage } from "./components/SpotlightsPage";
import { ProctoringPage } from "./components/ProctoringPage";
import { ManageIdsPage } from "./components/ManageIdsPage";
import { ScholarshipsPage } from "./components/ScholarshipsPage";
import { FeedbackFormsPage } from "./components/FeedbackFormsPage";
import { FeedbackFormWizard } from "./components/FeedbackFormWizard";
import { IndustriesPage } from "./components/IndustriesPage";
import { CompaniesPage } from "./components/CompaniesPage";
import { NewCompanyWizard } from "./components/NewCompanyWizard";
import { UsersPage } from "./components/UsersPage";
import { ReviewHandsOnPage } from "./components/ReviewHandsOnPage";
import { NameChangeRequestsPage } from "./components/NameChangeRequestsPage";
import { PendingIdReuploadsPage } from "./components/PendingIdReuploadsPage";
import { OfferCodesPage } from "./components/OfferCodesPage";
import { ContentOverridesPage } from "./components/ContentOverridesPage";
import { buildData, attemptsForTask } from "./data/certLookup";
import { ProductConfigPage } from "./components/ProductConfigPage";
import { MergeAccountsPage } from "./components/MergeAccountsPage";
import { TransferSubscriptionPage } from "./components/TransferSubscriptionPage";
import { UserProfilePage } from "./components/UserProfilePage";
import { PortfolioPage } from "./components/PortfolioPage";
import { StripeInvoicesPage } from "./components/StripeInvoicesPage";
import { users as allUsers, type User } from "./data/users";
import { submissionForLearner, type TaskSubmission } from "./data/reviewSubmissions";
import {
  activeLinks,
  feedbackForms as seedForms,
  formResponses,
  inactiveLinks,
  type FeedbackForm,
} from "./data/feedbackForms";
import { buildRows, exportFormCsv } from "./components/FeedbackFormResponses";
import { companies as seedCompanies, findCompanyUserProfile, type Company } from "./data/companies";

// Map a certification onto a content-graph focus node. If the certification
// already exists in the mock graph (matched by name) we use that node — so its
// seeded prerequisite / recommended / related links show up. Otherwise we
// synthesize a node from the certification so the Content Links page still
// opens focused on it, with empty columns ready to populate.
function certToFocusNode(cert: Certification): ContentNode {
  const match = contentNodes.find((n) => n.name === cert.name);
  if (match) return match;
  const level: Level =
    cert.careerStage === "Master"
      ? "Advanced"
      : cert.careerStage === "Journeyman"
      ? "Intermediate"
      : "Beginner";
  return {
    id: cert.id,
    name: cert.name,
    kind: "Certification",
    level,
    tasksCount: cert.tasks,
    industry: cert.industry,
  };
}

type View =
  | { name: "tasks"; certificationFilter?: string }
  | { name: "certs" }
  | { name: "new-task"; taskType: TaskTypeKey }
  | { name: "edit-task"; task: Task }
  | {
      name: "attempts";
      quizName: string;
      /** Deep link from Manage Completions: one learner's attempts. */
      nameFilter?: string;
      statusFilter?: AttemptStatus;
      extraAttempts?: Attempt[];
    }
  | { name: "attempt-viewer"; attempt: Attempt; quizName: string }
  | { name: "quiz-purchasers"; task: Task }
  | { name: "new-cert" }
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
  | { name: "award-recipients"; award: Award; cert: Certification }
  /* `historyForId` opens the bank straight on one question's Version History
     page — how a version opened in the editor gets back where it came from. */
  | { name: "question-bank"; historyForId?: string }
  | { name: "new-question"; categoryPath?: string[]; initialType?: QuestionType; forFormId?: string }
  /* `atVersion` means the editor was opened from Version History, on that
     version — so Cancel goes back there. An OLDER version than the question's
     current one also locks the editor: it loads that version's content and
     becomes a viewer rather than an edit. */
  | { name: "edit-question"; question: Question; atVersion?: number }
  | { name: "spotlight" }
  | { name: "proctoring"; openSubmissionId?: string }
  | { name: "manage-ids" }
  | { name: "scholarship" }
  | { name: "feedback" }
  | { name: "feedback-detail"; formId: string; creating?: boolean }
  | { name: "industries" }
  | { name: "companies"; query?: string }
  | { name: "new-company" }
  | { name: "edit-company"; company: Company }
  | { name: "manage-subscription"; company: Company }
  | { name: "users"; companyFilter?: string }
  | { name: "offer-codes" }
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
  | { name: "pending-id-reuploads" }
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
  "offer-codes": "offer-codes",
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
  "offer-codes": { name: "offer-codes" },
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
  users: { label: "Manage Users", view: { name: "users" } },
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
  if (taskBriefId) {
    const t = tasks.find((x) => x.id === taskBriefId);
    return <TaskBriefPlaceholder name={t?.name ?? taskBriefId} />;
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
      <StandaloneNotFound id={editTaskId} />
    );
  }
  if (profileId) {
    // Company employees live outside the Manage Users roster but their profile
    // links resolve too — see findCompanyUserProfile.
    const u = allUsers.find((x) => x.id === profileId) ?? findCompanyUserProfile(profileId);
    // The Full Profile keeps the admin shell: it is a real admin screen, so the
    // left rail stays with it even in its own tab.
    return (
      <StandaloneShell active="manage-users">
        {u ? <UserProfilePage user={u} /> : <StandaloneNotFound id={profileId} />}
      </StandaloneShell>
    );
  }
  if (portfolioId) {
    const u = allUsers.find((x) => x.id === portfolioId);
    return u ? <PortfolioPage user={u} /> : <StandaloneNotFound id={portfolioId} />;
  }
  if (stripeCustomerId) {
    return <StripeInvoicesPage customerId={stripeCustomerId} />;
  }
  if (loginAsCompany) {
    return <LoginAsLibraryPage company={loginAsCompany} />;
  }
  if (loginAsUserId) {
    const u = allUsers.find((x) => x.id === loginAsUserId) ?? findCompanyUserProfile(loginAsUserId);
    return u ? <LoginAsUserPage user={u} /> : <StandaloneNotFound id={loginAsUserId} />;
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
      <Sidebar
        active={active}
        onNavigate={(key) => {
          const view = NAV_KEY_TO_VIEW[key];
          if (view) window.location.href = urlForView(view);
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
  const cell = data.cells[uid + "_" + taskId];

  if (handsOnUid && handsOnTaskId) {
    const libraryTask = tasks.find((t) => t.name === task.name);
    const user = allUsers.find((u) => u.id === uid);
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

  return {
    name: "attempts",
    quizName: task.name,
    nameFilter: employee.name,
    statusFilter: (params.get("attemptsStatus") as AttemptStatus | null) ?? undefined,
    extraAttempts: attemptsForTask(uid, employee.name, employee.contact, task, cell),
  };
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

/* Placeholder shown when an admin clicks "Open Company Dashboard" on a
 * company-owned Task/Certification. Opened in a new tab via ?loginAs=. */
function LoginAsLibraryPage({ company }: { company: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 48,
        textAlign: "center",
        fontFamily: "var(--font-sans)",
        color: "#e7e7e8",
        background: "#151517",
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 1, textTransform: "uppercase", color: "#8a8a90" }}>
        Login As
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>{company}</h1>
      <p style={{ fontSize: 15, color: "#a8a8a8", maxWidth: 460, margin: 0 }}>
        This is the Login As view for the <strong>Library</strong> page of {company}.
      </p>
    </div>
  );
}

/* Placeholder shown when an admin clicks "Login As" on a user — the row menu
 * on Manage Users and the button on the Full Profile. The learner app isn't
 * part of this prototype, so the new tab names the session it stands for.
 * Opened via ?loginAsUser=; see components/loginAs.ts. */
function LoginAsUserPage({ user }: { user: User }) {
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0c", fontFamily: "var(--font-sans)" }}>
      <div
        style={{
          background: "#7a3a18",
          color: "#ffd9c2",
          padding: "10px 20px",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        ⚠ Admin impersonation session — you are viewing SkillCat as this user. Your own session is
        unaffected.
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            margin: "0 auto 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 800,
            color: "#fff",
            background: "radial-gradient(70% 70% at 50% 40%, #e97237, #8a3114)",
          }}
        >
          {initials}
        </div>
        <h1 style={{ fontSize: 24, margin: "0 0 6px", color: "#e7e7e8" }}>{user.name}</h1>
        <p style={{ color: "#9a9aa0", margin: 0 }}>{user.email}</p>
        <p style={{ color: "#7a7a7a", fontSize: 14, margin: "4px 0 0" }}>
          {user.id}
          {user.companyName ? ` · ${user.companyName}` : ""}
        </p>
        <p style={{ color: "#9a9aa0", lineHeight: 1.6, marginTop: 24 }}>
          This is a placeholder for the learner session an admin lands in. The SkillCat app isn't
          wired into this prototype yet.
        </p>
      </div>
    </div>
  );
}

/** Opens the "Login As" Library placeholder for a company in a new tab. */
function openLoginAsLibrary(company: string) {
  window.open(
    `${window.location.origin}${window.location.pathname}?loginAs=${encodeURIComponent(company)}`,
    "_blank",
    "noopener",
  );
}

/* Placeholder for the Task brief a reviewer opens from the review screen —
   Instructions, Materials Required and the uploaded Reference Files. */
function TaskBriefPlaceholder({ name }: { name: string }) {
  return (
    <div style={{ padding: 48, fontFamily: "var(--font-sans)" }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: "#fff" }}>{name}</h1>
      <p style={{ marginTop: 12, fontSize: 16, color: "#a8a8a8" }}>
        Instructions, Materials Required and Reference Files for this Task will appear here.
      </p>
    </div>
  );
}

function StandaloneNotFound({ id }: { id: string }) {
  return (
    <div style={{ padding: 48, color: "#9a9aa0", fontFamily: "var(--font-sans)" }}>
      No user found for “{id}”.
    </div>
  );
}

function AdminApp() {
  /* A "View All Attempts" link lands here, not on a standalone screen — the
     tab looks exactly as if the page had been navigated to. */
  const [view, setView] = useState<View>(
    () => deepLinkView(new URLSearchParams(window.location.search)) ?? viewFromUrl(),
  );
  const [forms, setForms] = useState<FeedbackForm[]>(seedForms);
  // Question Bank + questions created from the Feedback Form flow.
  const [bank, setBank] = useState<Question[]>(seedQuestions);
  /* Awards used to live on the Awards page's own state. That page is gone, so
     the list sits here: the Certifications table reads it to label each row's
     menu, and the Award form writes back into it. */
  const [awards, setAwards] = useState<Award[]>(seedAwards);
  const [companies, setCompanies] = useState<Company[]>(seedCompanies);
  /* A one-line success handed back by a flow that finished and navigated away
     — raised as a toast on the page it returns to. */
  const [flash, setFlash] = useState<string | null>(null);
  // Tasks published from the wizard this session. They sit on top of the seed
  // list; TasksPage re-seeds from this every time it mounts.
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);

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

  // Keep the address bar in sync with the initial view, and follow the
  // browser's back/forward buttons by re-reading the URL into view state.
  useEffect(() => {
    const canonical = urlForView(viewFromUrl());
    if (window.location.pathname !== canonical) {
      window.history.replaceState({}, "", canonical);
    }
    function onPopState() {
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
      view.name === "cert-award" || view.name === "award-recipients"
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
      : view.name === "offer-codes"
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

  function addCompany(company: Omit<Company, "id">) {
    const id = `CO-${String(companies.length + 1).padStart(3, "0")}`;
    setCompanies((prev) => [{ id, ...company }, ...prev]);
  }

  function updateCompany(company: Company) {
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? company : c)));
  }

  function deleteCompany(company: Company) {
    setCompanies((prev) => prev.filter((c) => c.id !== company.id));
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

  // "New questions can be created in the Question Bank as part of this flow,
  // then linked" — the wizard hands back the question; we add it to the bank
  // and link it to the form that launched the flow.
  function handleQuestionCreated(q: Question, forFormId?: string) {
    const form = forFormId ? forms.find((f) => f.id === forFormId) : undefined;
    // A question linked straight into a form goes in front of users
    // immediately. It arrives Active either way — the wizard writes no other
    // status — so only the form link has to be applied here.
    setBank((prev) => [
      { ...q, forms: form ? [form.name] : q.forms },
      ...prev,
    ]);
    if (form) {
      upsertForm({
        ...form,
        questions: [
          ...activeLinks(form),
          { questionId: q.id, mandatory: false, status: "active", linkedAt: "2026-07-09" },
          ...inactiveLinks(form),
        ],
        updatedAt: "2026-07-09",
      });
    }
  }

  const activeForm =
    view.name === "feedback-detail" ? forms.find((f) => f.id === view.formId) : null;

  return (
    <div className="app">
      <HoverTooltip />
      <CopyCells />
      <Sidebar active={sidebarActive} onNavigate={navigate} />
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
                  : setView({ name: "attempts", quizName: task.name })
              }
              onViewPayers={(task) => setView({ name: "quiz-purchasers", task })}
              onManageProgress={(task) =>
                setView({ name: "content-overrides", taskId: task.id, origin: "tasks" })
              }
              onOpenQuestionBank={() => navigate("question-bank")}
              onOpenSkills={() => navigate("skills")}
              extraTasks={createdTasks}
            />
          </div>
        </div>
      ) : view.name === "attempts" ? (
        <AttemptsPage
          quizName={view.quizName}
          initialNameFilter={view.nameFilter}
          initialStatusFilter={view.statusFilter}
          extraAttempts={view.extraAttempts}
          onBack={() => setView({ name: "tasks" })}
        />
      ) : view.name === "attempt-viewer" ? (
        <AttemptViewerPage
          attempt={view.attempt}
          onBack={() => setView({ name: "attempts", quizName: view.quizName })}
        />
      ) : view.name === "quiz-purchasers" ? (
        <QuizPurchasersPage task={view.task} onBack={() => setView({ name: "tasks" })} />
      ) : view.name === "certs" ? (
        <CertificationsPage
          onNewCert={() => setView({ name: "new-cert" })}
          onEditCert={(cert) => setView({ name: "edit-cert", cert })}
          onOpenCompanyDashboard={openLoginAsLibrary}
          onViewPayers={(cert) => setView({ name: "cert-purchasers", cert })}
          onViewAllTasks={(cert) => setView({ name: "tasks", certificationFilter: cert.name })}
          onManageContentLinks={(cert) => setView({ name: "content-links", cert })}
          onManageProgress={(cert) =>
            setView({ name: "content-overrides", certId: cert.id, origin: "certs" })
          }
          onArchiveCert={(cert) => setView({ name: "archive-cert", cert })}
          onManageAward={(cert) => setView({ name: "cert-award", cert })}
          awardForCert={(cert) => awards.find((a) => a.certificationId === cert.id)}
          onOpenIndustries={() => navigate("industries")}
          onOpenFeedback={() => navigate("feedback")}
        />
      ) : view.name === "cert-purchasers" ? (
        <CertPurchasersPage cert={view.cert} onBack={() => setView({ name: "certs" })} />
      ) : view.name === "content-links" ? (
        <ContentLinksPage
          initialFocus={view.cert ? certToFocusNode(view.cert) : undefined}
          onBack={view.cert ? () => setView({ name: "certs" }) : undefined}
          backLabel="Certifications"
        />
      ) : view.name === "skills" ? (
        <SkillsPage />
      ) : view.name === "cert-award" ? (
        (() => {
          const existing = awards.find((a) => a.certificationId === view.cert.id);
          return (
            <NewAwardWizard
              key={view.cert.id}
              certification={view.cert}
              editingAward={existing}
              allAwards={awards}
              templates={designTemplates}
              onClose={() => navigate("certs")}
              onSave={(a) =>
                setAwards((prev) => {
                  const i = prev.findIndex((x) => x.id === a.id);
                  if (i < 0) return [a, ...prev];
                  const next = [...prev];
                  next[i] = a;
                  return next;
                })
              }
              onDelete={
                existing
                  ? () => {
                      setAwards((prev) => prev.filter((x) => x.id !== existing.id));
                      navigate("certs");
                    }
                  : undefined
              }
              onViewRecipients={
                existing
                  ? () => setView({ name: "award-recipients", award: existing, cert: view.cert })
                  : undefined
              }
            />
          );
        })()
      ) : view.name === "award-recipients" ? (
        <AwardRecipientsPage
          award={view.award}
          onBack={() => setView({ name: "cert-award", cert: view.cert })}
        />
      ) : view.name === "question-bank" ? (
        <QuestionBankPage
          key={bank.length}
          initialQuestions={bank}
          onNewQuestion={(categoryPath, initialType) =>
            setView({ name: "new-question", categoryPath, initialType })
          }
          onEditQuestion={(question, atVersion) =>
            setView({ name: "edit-question", question, atVersion })
          }
          initialHistoryId={view.historyForId}
          onBackToTasks={() => navigate("tasks")}
        />
      ) : view.name === "new-question" ? (
        <NewQuestionWizard
          initialCategoryPath={view.categoryPath}
          initialType={view.initialType}
          onCreate={(q) => handleQuestionCreated(q, view.forFormId)}
          onClose={() =>
            view.forFormId
              ? setView({ name: "feedback-detail", formId: view.forFormId })
              : setView({ name: "question-bank" })
          }
        />
      ) : view.name === "edit-question" ? (
        (() => {
          /* Anything but the question's own current version is a record: the
             editor loads that version's text and locks. Opened from Version
             History at all — current version included — Cancel and the crumb
             go back there rather than to the bank's list. */
          const past =
            view.atVersion !== undefined && view.atVersion !== view.question.version;
          return (
            <NewQuestionWizard
              key={`${view.question.id}-${view.atVersion ?? "current"}`}
              editingQuestion={
                past
                  ? {
                      ...view.question,
                      version: view.atVersion!,
                      text: versionText(view.question, view.atVersion!),
                    }
                  : view.question
              }
              atVersion={past ? view.atVersion : undefined}
              backLabel={view.atVersion !== undefined ? "Version History" : undefined}
              onClose={() =>
                setView(
                  view.atVersion !== undefined
                    ? { name: "question-bank", historyForId: view.question.id }
                    : { name: "question-bank" },
                )
              }
            />
          );
        })()
      ) : view.name === "spotlight" ? (
        <SpotlightsPage />
      ) : view.name === "proctoring" ? (
        <ProctoringPage
          key={view.openSubmissionId ?? "queue"}
          onPendingIdReuploads={() => setView({ name: "pending-id-reuploads" })}
          initialSubmissionId={view.openSubmissionId}
          onExitToOrigin={() => goToView({ name: "pending-id-reuploads" })}
          originLabel="Pending ID Re-Uploads"
        />
      ) : /* Currently unreachable: the Proctoring header's "View All IDs" button was
             removed 2026-08-25 and this view has no nav key. Kept wired so restoring
             an entry point is a one-liner. */
      view.name === "manage-ids" ? (
        <ManageIdsPage onBack={() => setView({ name: "proctoring" })} />
      ) : view.name === "scholarship" ? (
        <ScholarshipsPage onBack={() => navigate("manage-users")} />
      ) : view.name === "industries" ? (
        <IndustriesPage />
      ) : view.name === "companies" ? (
        <CompaniesPage
          companies={companies}
          onDeleteCompany={deleteCompany}
          initialQuery={view.query}
          onNewCompany={() => setView({ name: "new-company" })}
          onEditCompany={(company) => setView({ name: "edit-company", company })}
          onManageSubscription={(company) => setView({ name: "manage-subscription", company })}
          onUpdateCompany={updateCompany}
          onViewEmployees={(company) => setView({ name: "users", companyFilter: company.name })}
          onNavigateToProductConfig={() => setView({ name: "product-config", tab: "b2b" })}
        />
      ) : view.name === "new-company" ? (
        <NewCompanyWizard
          onClose={() => setView({ name: "companies" })}
          onCreate={addCompany}
          onNavigateToProductConfig={() => setView({ name: "product-config", tab: "b2b" })}
        />
      ) : view.name === "edit-company" ? (
        <NewCompanyWizard
          editCompany={view.company}
          detailsOnly
          onClose={() => setView({ name: "companies" })}
          onSave={updateCompany}
          onNavigateToProductConfig={() => setView({ name: "product-config", tab: "b2b" })}
        />
      ) : view.name === "manage-subscription" ? (
        <NewCompanyWizard
          editCompany={view.company}
          subscriptionOnly
          onClose={() => setView({ name: "companies" })}
          onSave={updateCompany}
        />
      ) : view.name === "users" ? (
        <UsersPage
          onViewCompany={(name) => setView({ name: "companies", query: name })}
          onManageCompletions={(userId) =>
            setView({ name: "content-overrides", userId, origin: "users" })
          }
          onOpenOfferCodes={() => navigate("offer-codes")}
          onOpenScholarships={() => navigate("scholarship")}
          onOpenNameChanges={() => navigate("name-change-requests")}
          onOpenMergeAccounts={() => navigate("merge-accounts")}
          onOpenTransferSubscription={() => navigate("transfer-subscription")}
          initialCompanyFilter={view.companyFilter}
          flash={flash}
          onFlashDone={() => setFlash(null)}
        />
      ) : view.name === "offer-codes" ? (
        <OfferCodesPage onBack={() => navigate("manage-users")} />
      ) : view.name === "review-hands-on" ? (
        <ReviewHandsOnPage
          initialTaskFilter={view.taskFilter}
          initialQuery={view.userFilter}
          extraSubmissions={view.extraSubmissions}
        />
      ) : view.name === "pending-id-reuploads" ? (
        <PendingIdReuploadsPage
          onBack={() => setView({ name: "proctoring" })}
          onReview={(id) => goToView({ name: "proctoring", openSubmissionId: id })}
        />
      ) : view.name === "name-change-requests" ? (
        <NameChangeRequestsPage onBack={() => navigate("manage-users")} />
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
          onEditAward={(award) => {
            const cert = certForAward(award);
            if (cert) setView({ name: "cert-award", cert });
          }}
        />
      ) : view.name === "merge-accounts" ? (
        <MergeAccountsPage
          onClose={() => navigate("manage-users")}
          /* A finished merge has no screen of its own: it lands back on Manage
             Users and says what happened there. */
          onMerged={(message) => {
            setFlash(message);
            navigate("manage-users");
          }}
        />
      ) : view.name === "transfer-subscription" ? (
        <TransferSubscriptionPage
          onClose={() => navigate("manage-users")}
          /* Like a finished merge: no screen of its own, it lands back on
             Manage Users and says what happened there. */
          onTransferred={(message) => {
            setFlash(message);
            navigate("manage-users");
          }}
        />
      ) : view.name === "feedback" ? (
        <FeedbackFormsPage
          forms={forms}
          onOpen={(id, creating) => setView({ name: "feedback-detail", formId: id, creating })}
          /* The responses viewer is shelved for now — the menu action just
             downloads the form's responses as CSV. */
          onExportResponses={(id) => {
            const form = forms.find((f) => f.id === id);
            if (!form) return;
            exportFormCsv(form, buildRows(form, bank), formResponses[form.id] ?? []);
          }}
          onCreate={(form) => upsertForm(form)}
          onUpdate={(form) => upsertForm(form)}
          /* Deleting is a tombstone, not a purge: the record stays so its
             responses keep resolving, and the list hides Deleted forms. */
          onDelete={(id) =>
            setForms((prev) =>
              prev.map((f) => (f.id === id ? { ...f, status: "deleted" as const } : f)),
            )
          }
          onBackToCerts={() => navigate("certs")}
        />
      ) : view.name === "feedback-detail" && activeForm ? (
        <FeedbackFormWizard
          form={activeForm}
          creating={view.creating}
          allForms={forms}
          bank={bank}
          onBack={() => setView({ name: "feedback" })}
          /* A never-finished new form is purged outright, not tombstoned: it
             has no responses to keep resolving. */
          onDiscard={() => {
            const id = activeForm.id;
            setForms((prev) => prev.filter((f) => f.id !== id));
            setView({ name: "feedback" });
          }}
          onUpdate={upsertForm}
          onCreateQuestion={() =>
            setView({
              name: "new-question",
              categoryPath: ["Learner Feedback"],
              forFormId: activeForm.id,
            })
          }
        />
      ) : view.name === "new-task" ? (
        <NewTaskWizard
          taskType={view.taskType}
          onClose={() => setView({ name: "tasks" })}
          onCreate={(task) => {
            addTask(task);
            setView({ name: "tasks" });
          }}
        />
      ) : view.name === "edit-task" ? (
        <NewTaskWizard
          taskType={taskTypeKey(view.task.type)}
          editingTask={view.task}
          onClose={() => setView({ name: "tasks" })}
        />
      ) : view.name === "edit-cert" ? (
        <NewCertificationWizard
          editingCert={view.cert}
          onClose={() => setView({ name: "certs" })}
        />
      ) : view.name === "archive-cert" ? (
        <ArchiveCertificationPage
          cert={view.cert}
          onClose={() => setView({ name: "certs" })}
          onArchive={() => setView({ name: "certs" })}
        />
      ) : (
        <NewCertificationWizard onClose={() => setView({ name: "certs" })} />
      )}
    </div>
  );
}
