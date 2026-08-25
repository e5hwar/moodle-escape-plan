import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { HoverTooltip } from "./components/HoverTooltip";
import { TasksPage } from "./components/TasksPage";
import { type TaskTypeKey } from "./components/Footer";
import { NewTaskWizard, taskTypeKey } from "./components/NewTaskWizard";
import { AttemptsPage } from "./components/AttemptsPage";
import { AttemptViewerPage } from "./components/AttemptViewerPage";
import { type Attempt, type AttemptStatus } from "./data/attempts";
import { QuizPurchasersPage } from "./components/QuizPurchasersPage";
import { tasks, type Task } from "./data/tasks";
import { CertificationsPage } from "./components/CertificationsPage";
import { CertPurchasersPage } from "./components/CertPurchasersPage";
import { NewCertificationWizard } from "./components/NewCertificationWizard";
import { NewCertificationStart } from "./components/NewCertificationStart";
import { SkillsPage } from "./components/SkillsPage";
import { AwardsPage } from "./components/AwardsPage";
import { type Certification } from "./data/certifications";
import { ContentLinksPage } from "./components/ContentLinksPage";
import { nodes as contentNodes, type ContentNode, type Level } from "./data/contentLinks";
import { QuestionBankPage } from "./components/QuestionBankPage";
import { NewQuestionWizard } from "./components/NewQuestionWizard";
import { questions as seedQuestions, type Question } from "./data/questionBank";
import { SpotlightsPage } from "./components/SpotlightsPage";
import { ProctoringPage } from "./components/ProctoringPage";
import { ManageIdsPage } from "./components/ManageIdsPage";
import { ScholarshipsPage } from "./components/ScholarshipsPage";
import { FeedbackFormsPage } from "./components/FeedbackFormsPage";
import { FeedbackFormWizard } from "./components/FeedbackFormWizard";
import { FeedbackFormResponsesPage } from "./components/FeedbackFormResponsesPage";
import { IndustriesPage } from "./components/IndustriesPage";
import { CompaniesPage } from "./components/CompaniesPage";
import { NewCompanyWizard } from "./components/NewCompanyWizard";
import { UsersPage } from "./components/UsersPage";
import { ReviewHandsOnPage } from "./components/ReviewHandsOnPage";
import { NameChangeRequestsPage } from "./components/NameChangeRequestsPage";
import { OfferCodesPage } from "./components/OfferCodesPage";
import { ContentOverridesPage } from "./components/ContentOverridesPage";
import { buildData, attemptsForTask } from "./data/certLookup";
import { ProductConfigPage } from "./components/ProductConfigPage";
import { PermissionsPage } from "./components/PermissionsPage";
import { MergeAccountsPage } from "./components/MergeAccountsPage";
import { TransferSubscriptionPage } from "./components/TransferSubscriptionPage";
import { UserProfilePage } from "./components/UserProfilePage";
import { PortfolioPage } from "./components/PortfolioPage";
import { StripeInvoicesPage } from "./components/StripeInvoicesPage";
import { users as allUsers } from "./data/users";
import {
  activeLinks,
  feedbackForms as seedForms,
  inactiveLinks,
  type FeedbackForm,
} from "./data/feedbackForms";
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
  | { name: "tasks" }
  | { name: "certs" }
  | { name: "new-task"; taskType: TaskTypeKey }
  | { name: "edit-task"; task: Task }
  | { name: "attempts"; quizName: string }
  | { name: "attempt-viewer"; attempt: Attempt; quizName: string }
  | { name: "quiz-purchasers"; task: Task }
  | { name: "new-cert-start" }
  | { name: "new-cert" }
  | { name: "edit-cert"; cert: Certification }
  | { name: "cert-purchasers"; cert: Certification }
  | { name: "content-links"; cert?: Certification }
  | { name: "skills" }
  | { name: "awards" }
  | { name: "question-bank" }
  | { name: "new-question"; categoryPath?: string[]; forFormId?: string }
  | { name: "edit-question"; question: Question }
  | { name: "spotlight" }
  | { name: "proctoring" }
  | { name: "manage-ids" }
  | { name: "scholarship" }
  | { name: "feedback" }
  | { name: "feedback-detail"; formId: string }
  | { name: "feedback-responses"; formId: string }
  | { name: "industries" }
  | { name: "companies"; query?: string }
  | { name: "new-company" }
  | { name: "edit-company"; company: Company }
  | { name: "manage-subscription"; company: Company }
  | { name: "users"; companyFilter?: string }
  | { name: "offer-codes" }
  | { name: "review-hands-on" }
  | { name: "name-change-requests" }
  | { name: "content-overrides"; userId?: string }
  | { name: "product-config"; tab?: "general" | "display" | "b2c" | "b2b" | "legal" }
  | { name: "merge-accounts" }
  | { name: "transfer-subscription" }
  | { name: "permissions" };

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
  awards: "awards",
  feedback: "feedback",
  "content-overrides": "certification-lookup",
  "review-hands-on": "review-hands-on",
  proctoring: "proctoring-review",
  "name-change-requests": "name-change-requests",
  "merge-accounts": "merge-accounts",
  "transfer-subscription": "transfer-subscription",
  users: "users",
  scholarship: "scholarship",
  "offer-codes": "offer-codes",
  companies: "companies",
  spotlight: "spotlight",
  "product-config": "product-config",
  permissions: "permissions",
};

// URL slug -> view
const SLUG_TO_VIEW: Record<string, View> = Object.fromEntries(
  Object.entries(VIEW_SLUGS).map(([name, slug]) => [slug, { name } as View]),
);

// Sidebar navKey -> view (mirrors the sidebar item navKeys)
const NAV_KEY_TO_VIEW: Record<string, View> = {
  certs: { name: "certs" },
  tasks: { name: "tasks" },
  skills: { name: "skills" },
  awards: { name: "awards" },
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
  "content-overrides": { name: "content-overrides" },
  "product-config": { name: "product-config" },
  "merge-accounts": { name: "merge-accounts" },
  "transfer-subscription": { name: "transfer-subscription" },
  permissions: { name: "permissions" },
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
  const attemptsUid = params.get("attemptsUid");
  const attemptsTaskId = params.get("attemptsTaskId");
  /** Optional: lands the Attempts page with its Status filter already applied. */
  const attemptsStatus = params.get("attemptsStatus") as AttemptStatus | null;
  const editTaskId = params.get("editTask");
  if (attemptsUid && attemptsTaskId) {
    return (
      <StandaloneAttemptsPage
        uid={attemptsUid}
        taskId={attemptsTaskId}
        status={attemptsStatus ?? undefined}
      />
    );
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
    return u ? <UserProfilePage user={u} /> : <StandaloneNotFound id={profileId} />;
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

  return <AdminApp />;
}

/* Standalone Attempts page, opened in a new tab from Manage Completions
 * (Certification Lookup) via ?attemptsUid=&attemptsTaskId=. Rebuilds the same
 * deterministic Certification Lookup data set (buildData() is a pure, seeded
 * function of fixed inputs, so it's identical to what the originating tab
 * saw) and synthesizes that employee's real attempt history for the task, so
 * the page always has rows to show whenever they've actually attempted it —
 * instead of relying on the unrelated Attempts mock dataset. Keeps its own
 * tiny attempts ⇄ attempt-viewer state since there's no Tasks page to return
 * to in this tab. */
function StandaloneAttemptsPage({
  uid,
  taskId,
  status,
}: {
  uid: string;
  taskId: string;
  status?: AttemptStatus;
}) {
  const [viewer, setViewer] = useState<Attempt | null>(null);

  const data = useMemo(() => buildData(), []);
  const employee = data.employeesById[uid];
  const task = data.tasksById[taskId];
  if (!employee || !task) return <StandaloneNotFound id={uid} />;
  const cell = data.cells[uid + "_" + taskId];
  const history = attemptsForTask(uid, employee.name, employee.contact, task, cell);

  if (viewer) {
    return <AttemptViewerPage attempt={viewer} onBack={() => setViewer(null)} />;
  }
  return (
    <AttemptsPage
      quizName={task.name}
      initialNameFilter={employee.name}
      initialStatusFilter={status}
      extraAttempts={history}
      onViewAttempt={setViewer}
    />
  );
}

/** Opens the Attempts page for one employee's task attempts in a new tab. */
function openAttemptsForUser(uid: string, taskId: string) {
  window.open(
    `${window.location.origin}${window.location.pathname}?attemptsUid=${encodeURIComponent(uid)}&attemptsTaskId=${encodeURIComponent(taskId)}`,
    "_blank",
    "noopener",
  );
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

/** Opens the "Login As" Library placeholder for a company in a new tab. */
function openLoginAsLibrary(company: string) {
  window.open(
    `${window.location.origin}${window.location.pathname}?loginAs=${encodeURIComponent(company)}`,
    "_blank",
    "noopener",
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
  const [view, setView] = useState<View>(viewFromUrl);
  const [forms, setForms] = useState<FeedbackForm[]>(seedForms);
  // Question Bank + questions created from the Feedback Form flow.
  const [bank, setBank] = useState<Question[]>(seedQuestions);
  const [companies, setCompanies] = useState<Company[]>(seedCompanies);
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
        const target = Array.from(
          document.querySelectorAll<HTMLInputElement>(
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
    view.name === "certs" || view.name === "new-cert-start" || view.name === "new-cert" || view.name === "edit-cert" || view.name === "cert-purchasers" || view.name === "content-links"
      ? "certs"
      : view.name === "skills"
      ? "skills"
      : // Industries, Awards, and Feedback are reached from the Certifications
        // header (their sidebar entries are gone), so Certifications stays lit.
      view.name === "awards"
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
        view.name === "name-change-requests"
      ? "proctoring-review"
      : view.name === "scholarship"
      ? "manage-users"
      : view.name === "feedback" || view.name === "feedback-detail" || view.name === "feedback-responses"
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
      : view.name === "content-overrides"
      ? "content-overrides"
      : view.name === "product-config"
      ? "product-config"
      : view.name === "merge-accounts"
      ? "merge-accounts"
      : view.name === "transfer-subscription"
      ? "transfer-subscription"
      : view.name === "permissions"
      ? "permissions"
      : "tasks";

  function navigate(key: string) {
    const next = NAV_KEY_TO_VIEW[key];
    if (!next) return;
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
    // immediately — it can't sit in the bank as a Draft.
    setBank((prev) => [
      { ...q, status: form ? "Active" : q.status, forms: form ? [form.name] : q.forms },
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
    view.name === "feedback-detail" || view.name === "feedback-responses"
      ? forms.find((f) => f.id === view.formId)
      : null;

  return (
    <div className="app">
      <HoverTooltip />
      <Sidebar active={sidebarActive} onNavigate={navigate} />
      {view.name === "tasks" ? (
        <div className="main">
          <div className="workspace">
            <TasksPage
              onNewTask={(t) => setView({ name: "new-task", taskType: t })}
              onEditTask={(task) => setView({ name: "edit-task", task })}
              onOpenCompanyDashboard={openLoginAsLibrary}
              onViewAttempts={(task) => setView({ name: "attempts", quizName: task.name })}
              onViewPayers={(task) => setView({ name: "quiz-purchasers", task })}
              onOpenQuestionBank={() => navigate("question-bank")}
              onOpenSkills={() => navigate("skills")}
              extraTasks={createdTasks}
            />
          </div>
        </div>
      ) : view.name === "attempts" ? (
        <AttemptsPage
          quizName={view.quizName}
          onBack={() => setView({ name: "tasks" })}
          onViewAttempt={(attempt) =>
            setView({ name: "attempt-viewer", attempt, quizName: view.quizName })
          }
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
          onNewCert={() => setView({ name: "new-cert-start" })}
          onEditCert={(cert) => setView({ name: "edit-cert", cert })}
          onOpenCompanyDashboard={openLoginAsLibrary}
          onViewPayers={(cert) => setView({ name: "cert-purchasers", cert })}
          onManageContentLinks={(cert) => setView({ name: "content-links", cert })}
          onOpenIndustries={() => navigate("industries")}
          onOpenAwards={() => navigate("awards")}
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
      ) : view.name === "awards" ? (
        <AwardsPage onBackToCerts={() => navigate("certs")} />
      ) : view.name === "question-bank" ? (
        <QuestionBankPage
          key={bank.length}
          initialQuestions={bank}
          onNewQuestion={(categoryPath) =>
            setView({ name: "new-question", categoryPath })
          }
          onEditQuestion={(question) =>
            setView({ name: "edit-question", question })
          }
        />
      ) : view.name === "new-question" ? (
        <NewQuestionWizard
          initialCategoryPath={view.categoryPath}
          onCreate={(q) => handleQuestionCreated(q, view.forFormId)}
          onClose={() =>
            view.forFormId
              ? setView({ name: "feedback-detail", formId: view.forFormId })
              : setView({ name: "question-bank" })
          }
        />
      ) : view.name === "edit-question" ? (
        <NewQuestionWizard
          editingQuestion={view.question}
          onClose={() => setView({ name: "question-bank" })}
        />
      ) : view.name === "spotlight" ? (
        <SpotlightsPage />
      ) : view.name === "proctoring" ? (
        <ProctoringPage onNameChanges={() => setView({ name: "name-change-requests" })} />
      ) : /* Currently unreachable: the Proctoring header's "View All IDs" button was
             removed 2026-08-25 and this view has no nav key. Kept wired so restoring
             an entry point is a one-liner. */
      view.name === "manage-ids" ? (
        <ManageIdsPage onBack={() => setView({ name: "proctoring" })} />
      ) : view.name === "scholarship" ? (
        <ScholarshipsPage onBack={() => navigate("manage-users")} />
      ) : view.name === "industries" ? (
        <IndustriesPage onBackToCerts={() => navigate("certs")} />
      ) : view.name === "companies" ? (
        <CompaniesPage
          companies={companies}
          initialQuery={view.query}
          onNewCompany={() => setView({ name: "new-company" })}
          onEditCompany={(company) => setView({ name: "edit-company", company })}
          onManageSubscription={(company) => setView({ name: "manage-subscription", company })}
          onUpdateCompany={updateCompany}
          onViewEmployees={(company) => setView({ name: "users", companyFilter: company.name })}
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
          onManageCompletions={(userId) => setView({ name: "content-overrides", userId })}
          onOpenOfferCodes={() => navigate("offer-codes")}
          onOpenScholarships={() => navigate("scholarship")}
          onOpenMergeAccounts={() => navigate("merge-accounts")}
          onOpenTransferSubscription={() => navigate("transfer-subscription")}
          initialCompanyFilter={view.companyFilter}
        />
      ) : view.name === "offer-codes" ? (
        <OfferCodesPage onBack={() => navigate("manage-users")} />
      ) : view.name === "review-hands-on" ? (
        <ReviewHandsOnPage />
      ) : view.name === "name-change-requests" ? (
        <NameChangeRequestsPage onBack={() => setView({ name: "proctoring" })} />
      ) : view.name === "content-overrides" ? (
        <ContentOverridesPage onViewAttempts={openAttemptsForUser} initialUserId={view.userId} />
      ) : view.name === "product-config" ? (
        <ProductConfigPage initialTab={view.tab} />
      ) : view.name === "merge-accounts" ? (
        <MergeAccountsPage onClose={() => navigate("manage-users")} />
      ) : view.name === "transfer-subscription" ? (
        <TransferSubscriptionPage onClose={() => navigate("manage-users")} />
      ) : view.name === "permissions" ? (
        <PermissionsPage />
      ) : view.name === "feedback" ? (
        <FeedbackFormsPage
          forms={forms}
          onOpen={(id) => setView({ name: "feedback-detail", formId: id })}
          onViewResponses={(id) => setView({ name: "feedback-responses", formId: id })}
          onCreate={(form) => upsertForm(form)}
          onBackToCerts={() => navigate("certs")}
        />
      ) : view.name === "feedback-responses" && activeForm ? (
        <FeedbackFormResponsesPage
          form={activeForm}
          bank={bank}
          onBack={() => setView({ name: "feedback" })}
        />
      ) : view.name === "feedback-detail" && activeForm ? (
        <FeedbackFormWizard
          form={activeForm}
          allForms={forms}
          bank={bank}
          onBack={() => setView({ name: "feedback" })}
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
      ) : view.name === "new-cert-start" ? (
        <NewCertificationStart
          onFromScratch={() => setView({ name: "new-cert" })}
          onClose={() => setView({ name: "certs" })}
        />
      ) : view.name === "edit-cert" ? (
        <NewCertificationWizard
          editingCert={view.cert}
          onClose={() => setView({ name: "certs" })}
        />
      ) : (
        <NewCertificationWizard onClose={() => setView({ name: "certs" })} />
      )}
    </div>
  );
}
