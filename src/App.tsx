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
import { QuestionBankPage } from "./components/QuestionBankPage";
import { NewQuestionWizard } from "./components/NewQuestionWizard";
import { type Question } from "./data/questionBank";
import { SpotlightsPage } from "./components/SpotlightsPage";
import { ProctoringPage } from "./components/ProctoringPage";
import { ManageIdsPage } from "./components/ManageIdsPage";
import { ScholarshipsPage } from "./components/ScholarshipsPage";
import { TrialExtensionPage } from "./components/TrialExtensionPage";
import { FeedbackFormsPage } from "./components/FeedbackFormsPage";
import { FeedbackFormDetail } from "./components/FeedbackFormDetail";
import { FeedbackFormVersions } from "./components/FeedbackFormVersions";
import { IndustriesPage } from "./components/IndustriesPage";
import { CompaniesPage } from "./components/CompaniesPage";
import { NewCompanyWizard } from "./components/NewCompanyWizard";
import { UsersPage } from "./components/UsersPage";
import { ReviewHandsOnPage } from "./components/ReviewHandsOnPage";
import { NameChangeRequestsPage } from "./components/NameChangeRequestsPage";
import { OfferCodesPage } from "./components/OfferCodesPage";
import { ContentOverridesPage } from "./components/ContentOverridesPage";
import { ProductConfigPage } from "./components/ProductConfigPage";
import { MergeAccountsPage } from "./components/MergeAccountsPage";
import { TransferSubscriptionPage } from "./components/TransferSubscriptionPage";
import { UserProfilePage } from "./components/UserProfilePage";
import { PortfolioPage } from "./components/PortfolioPage";
import { users as allUsers } from "./data/users";
import {
  feedbackForms as seedForms,
  type FeedbackForm,
} from "./data/feedbackForms";
import { companies as seedCompanies, type Company } from "./data/companies";

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
  | { name: "content-links" }
  | { name: "skills" }
  | { name: "awards" }
  | { name: "question-bank" }
  | { name: "new-question"; categoryPath?: string[] }
  | { name: "edit-question"; question: Question }
  | { name: "spotlight" }
  | { name: "proctoring" }
  | { name: "manage-ids" }
  | { name: "scholarship" }
  | { name: "trial-extension" }
  | { name: "feedback" }
  | { name: "feedback-detail"; formId: string }
  | { name: "feedback-versions"; formId: string }
  | { name: "industries" }
  | { name: "companies"; query?: string }
  | { name: "new-company" }
  | { name: "edit-company"; company: Company }
  | { name: "users" }
  | { name: "offer-codes" }
  | { name: "review-hands-on" }
  | { name: "name-change-requests" }
  | { name: "content-overrides" }
  | { name: "product-config" }
  | { name: "merge-accounts" }
  | { name: "transfer-subscription" };

export default function App() {
  // Standalone, full-tab pages opened from the Users table ("open in new tab").
  // These render without the admin shell (no sidebar).
  const params = new URLSearchParams(window.location.search);
  const profileId = params.get("profile");
  const portfolioId = params.get("portfolio");
  if (profileId) {
    const u = allUsers.find((x) => x.id === profileId);
    return u ? <UserProfilePage user={u} /> : <StandaloneNotFound id={profileId} />;
  }
  if (portfolioId) {
    const u = allUsers.find((x) => x.id === portfolioId);
    return u ? <PortfolioPage user={u} /> : <StandaloneNotFound id={portfolioId} />;
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
  const [companies, setCompanies] = useState<Company[]>(seedCompanies);

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
    view.name === "certs" || view.name === "new-cert-start" || view.name === "new-cert" || view.name === "edit-cert" || view.name === "cert-purchasers"
      ? "certs"
      : view.name === "content-links"
      ? "content-links"
      : view.name === "skills"
      ? "skills"
      : view.name === "awards"
      ? "awards"
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
      : view.name === "trial-extension"
      ? "trial-extension"
      : view.name === "feedback" ||
        view.name === "feedback-detail" ||
        view.name === "feedback-versions"
      ? "feedback"
      : view.name === "industries"
      ? "industries"
      : view.name === "companies" || view.name === "new-company" || view.name === "edit-company"
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
      : "tasks";

  function navigate(key: string) {
    if (key === "certs") setView({ name: "certs" });
    else if (key === "tasks") setView({ name: "tasks" });
    else if (key === "content-links") setView({ name: "content-links" });
    else if (key === "skills") setView({ name: "skills" });
    else if (key === "awards") setView({ name: "awards" });
    else if (key === "question-bank") setView({ name: "question-bank" });
    else if (key === "spotlight") setView({ name: "spotlight" });
    else if (key === "proctoring-review") setView({ name: "proctoring" });
    else if (key === "scholarship") setView({ name: "scholarship" });
    else if (key === "trial-extension") setView({ name: "trial-extension" });
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

  const activeForm =
    view.name === "feedback-detail" || view.name === "feedback-versions"
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
        />
      ) : view.name === "cert-purchasers" ? (
        <CertPurchasersPage cert={view.cert} onBack={() => setView({ name: "certs" })} />
      ) : view.name === "content-links" ? (
        <ContentLinksPage />
      ) : view.name === "skills" ? (
        <SkillsPage />
      ) : view.name === "awards" ? (
        <AwardsPage />
      ) : view.name === "question-bank" ? (
        <QuestionBankPage
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
          onClose={() => setView({ name: "question-bank" })}
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
      ) : view.name === "trial-extension" ? (
        <TrialExtensionPage />
      ) : view.name === "industries" ? (
        <IndustriesPage />
      ) : view.name === "companies" ? (
        <CompaniesPage
          companies={companies}
          initialQuery={view.query}
          onNewCompany={() => setView({ name: "new-company" })}
          onEditCompany={(company) => setView({ name: "edit-company", company })}
          onUpdateCompany={updateCompany}
        />
      ) : view.name === "new-company" ? (
        <NewCompanyWizard
          onClose={() => setView({ name: "companies" })}
          onCreate={addCompany}
        />
      ) : view.name === "edit-company" ? (
        <NewCompanyWizard
          editCompany={view.company}
          onClose={() => setView({ name: "companies" })}
          onSave={updateCompany}
        />
      ) : view.name === "users" ? (
        <UsersPage onViewCompany={(name) => setView({ name: "companies", query: name })} />
      ) : view.name === "offer-codes" ? (
        <OfferCodesPage />
      ) : view.name === "review-hands-on" ? (
        <ReviewHandsOnPage />
      ) : view.name === "name-change-requests" ? (
        <NameChangeRequestsPage />
      ) : view.name === "content-overrides" ? (
        <ContentOverridesPage />
      ) : view.name === "product-config" ? (
        <ProductConfigPage />
      ) : view.name === "merge-accounts" ? (
        <MergeAccountsPage />
      ) : view.name === "transfer-subscription" ? (
        <TransferSubscriptionPage />
      ) : view.name === "feedback" ? (
        <FeedbackFormsPage
          forms={forms}
          onOpen={(id) => setView({ name: "feedback-detail", formId: id })}
          onCreate={(form) => upsertForm(form)}
        />
      ) : view.name === "feedback-detail" && activeForm ? (
        <FeedbackFormDetail
          form={activeForm}
          onBack={() => setView({ name: "feedback" })}
          onUpdate={upsertForm}
          onOpenVersions={() =>
            setView({ name: "feedback-versions", formId: activeForm.id })
          }
        />
      ) : view.name === "feedback-versions" && activeForm ? (
        <FeedbackFormVersions
          form={activeForm}
          onBack={() =>
            setView({ name: "feedback-detail", formId: activeForm.id })
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
