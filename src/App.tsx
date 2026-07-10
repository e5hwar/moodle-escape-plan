import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TasksPage } from "./components/TasksPage";
import { type TaskTypeKey } from "./components/Footer";
import { NewTaskWizard, taskTypeKey } from "./components/NewTaskWizard";
import { AttemptsPage } from "./components/AttemptsPage";
import { AttemptViewerPage } from "./components/AttemptViewerPage";
import { type Attempt } from "./data/attempts";
import { QuizPurchasersPage } from "./components/QuizPurchasersPage";
import { type Task } from "./data/tasks";
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
import { IndustriesPage } from "./components/IndustriesPage";
import { CompaniesPage } from "./components/CompaniesPage";
import { NewCompanyWizard } from "./components/NewCompanyWizard";
import { UsersPage } from "./components/UsersPage";
import { ReviewHandsOnPage } from "./components/ReviewHandsOnPage";
import { NameChangeRequestsPage } from "./components/NameChangeRequestsPage";
import { OfferCodesPage } from "./components/OfferCodesPage";
import { ContentOverridesPage } from "./components/ContentOverridesPage";
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
import { companies as seedCompanies, type Company } from "./data/companies";

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
  | { name: "industries" }
  | { name: "companies"; query?: string }
  | { name: "new-company" }
  | { name: "manage-subscription"; company: Company }
  | { name: "users"; companyFilter?: string }
  | { name: "offer-codes" }
  | { name: "review-hands-on" }
  | { name: "name-change-requests" }
  | { name: "content-overrides" }
  | { name: "product-config"; tab?: "general" | "display" | "b2c" | "b2b" | "legal" }
  | { name: "merge-accounts" }
  | { name: "transfer-subscription" }
  | { name: "permissions" };

export default function App() {
  // Standalone, full-tab pages opened from the Users table ("open in new tab").
  // These render without the admin shell (no sidebar).
  const params = new URLSearchParams(window.location.search);
  const profileId = params.get("profile");
  const portfolioId = params.get("portfolio");
  const stripeCustomerId = params.get("stripeInvoices");
  if (profileId) {
    const u = allUsers.find((x) => x.id === profileId);
    return u ? <UserProfilePage user={u} /> : <StandaloneNotFound id={profileId} />;
  }
  if (portfolioId) {
    const u = allUsers.find((x) => x.id === portfolioId);
    return u ? <PortfolioPage user={u} /> : <StandaloneNotFound id={portfolioId} />;
  }
  if (stripeCustomerId) {
    return <StripeInvoicesPage customerId={stripeCustomerId} />;
  }

  return <AdminApp />;
}

function StandaloneNotFound({ id }: { id: string }) {
  return (
    <div style={{ padding: 48, color: "#9a9aa0", fontFamily: "var(--font-sans)" }}>
      No user found for “{id}”.
    </div>
  );
}

function AdminApp() {
  const [view, setView] = useState<View>({ name: "tasks" });
  const [forms, setForms] = useState<FeedbackForm[]>(seedForms);
  // Question Bank + questions created from the Feedback Form flow.
  const [bank, setBank] = useState<Question[]>(seedQuestions);
  const [companies, setCompanies] = useState<Company[]>(seedCompanies);

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
      : view.name === "awards"
      ? "awards"
      : view.name === "new-question" && view.forFormId
      ? "feedback"
      : view.name === "question-bank" ||
        view.name === "new-question" ||
        view.name === "edit-question"
      ? "question-bank"
      : view.name === "spotlight"
      ? "spotlight"
      : view.name === "proctoring" || view.name === "manage-ids"
      ? "proctoring-review"
      : view.name === "scholarship"
      ? "scholarship"
      : view.name === "feedback" || view.name === "feedback-detail"
      ? "feedback"
      : view.name === "industries"
      ? "industries"
      : view.name === "companies" || view.name === "new-company" || view.name === "manage-subscription"
      ? "manage-companies"
      : view.name === "users"
      ? "manage-users"
      : view.name === "offer-codes"
      ? "offer-codes"
      : view.name === "review-hands-on"
      ? "review-hands-on"
      : view.name === "name-change-requests"
      ? "name-change-requests"
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
    if (key === "certs") setView({ name: "certs" });
    else if (key === "tasks") setView({ name: "tasks" });
    else if (key === "skills") setView({ name: "skills" });
    else if (key === "awards") setView({ name: "awards" });
    else if (key === "question-bank") setView({ name: "question-bank" });
    else if (key === "spotlight") setView({ name: "spotlight" });
    else if (key === "proctoring-review") setView({ name: "proctoring" });
    else if (key === "scholarship") setView({ name: "scholarship" });
    else if (key === "feedback") setView({ name: "feedback" });
    else if (key === "industries") setView({ name: "industries" });
    else if (key === "manage-companies") setView({ name: "companies" });
    else if (key === "manage-users") setView({ name: "users" });
    else if (key === "offer-codes") setView({ name: "offer-codes" });
    else if (key === "review-hands-on") setView({ name: "review-hands-on" });
    else if (key === "name-change-requests") setView({ name: "name-change-requests" });
    else if (key === "content-overrides") setView({ name: "content-overrides" });
    else if (key === "product-config") setView({ name: "product-config" });
    else if (key === "merge-accounts") setView({ name: "merge-accounts" });
    else if (key === "transfer-subscription") setView({ name: "transfer-subscription" });
    else if (key === "permissions") setView({ name: "permissions" });
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
    view.name === "feedback-detail"
      ? forms.find((f) => f.id === view.formId)
      : null;

  return (
    <div className="app">
      <Sidebar active={sidebarActive} onNavigate={navigate} />
      {view.name === "tasks" ? (
        <div className="main">
          <div className="workspace">
            <TasksPage
              onNewTask={(t) => setView({ name: "new-task", taskType: t })}
              onEditTask={(task) => setView({ name: "edit-task", task })}
              onViewAttempts={(task) => setView({ name: "attempts", quizName: task.name })}
              onViewPayers={(task) => setView({ name: "quiz-purchasers", task })}
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
          onViewPayers={(cert) => setView({ name: "cert-purchasers", cert })}
          onManageContentLinks={(cert) => setView({ name: "content-links", cert })}
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
        <AwardsPage />
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
        <ProctoringPage onManageIds={() => setView({ name: "manage-ids" })} />
      ) : view.name === "manage-ids" ? (
        <ManageIdsPage onBack={() => setView({ name: "proctoring" })} />
      ) : view.name === "scholarship" ? (
        <ScholarshipsPage />
      ) : view.name === "industries" ? (
        <IndustriesPage />
      ) : view.name === "companies" ? (
        <CompaniesPage
          companies={companies}
          initialQuery={view.query}
          onNewCompany={() => setView({ name: "new-company" })}
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
          initialCompanyFilter={view.companyFilter}
        />
      ) : view.name === "offer-codes" ? (
        <OfferCodesPage />
      ) : view.name === "review-hands-on" ? (
        <ReviewHandsOnPage />
      ) : view.name === "name-change-requests" ? (
        <NameChangeRequestsPage />
      ) : view.name === "content-overrides" ? (
        <ContentOverridesPage />
      ) : view.name === "product-config" ? (
        <ProductConfigPage initialTab={view.tab} />
      ) : view.name === "merge-accounts" ? (
        <MergeAccountsPage />
      ) : view.name === "transfer-subscription" ? (
        <TransferSubscriptionPage />
      ) : view.name === "permissions" ? (
        <PermissionsPage />
      ) : view.name === "feedback" ? (
        <FeedbackFormsPage
          forms={forms}
          onOpen={(id) => setView({ name: "feedback-detail", formId: id })}
          onCreate={(form) => upsertForm(form)}
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
