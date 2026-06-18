import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TasksPage } from "./components/TasksPage";
import { type TaskTypeKey } from "./components/Footer";
import { NewTaskWizard } from "./components/NewTaskWizard";
import { CertificationsPage } from "./components/CertificationsPage";
import { NewCertificationWizard } from "./components/NewCertificationWizard";
import { ContentLinksPage } from "./components/ContentLinksPage";
import { QuestionBankPage } from "./components/QuestionBankPage";
import { SpotlightsPage } from "./components/SpotlightsPage";
import { ProctoringPage } from "./components/ProctoringPage";
import { ScholarshipsPage } from "./components/ScholarshipsPage";
import { TrialExtensionPage } from "./components/TrialExtensionPage";
import { FeedbackFormsPage } from "./components/FeedbackFormsPage";
import { FeedbackFormDetail } from "./components/FeedbackFormDetail";
import { FeedbackFormVersions } from "./components/FeedbackFormVersions";
import { IndustriesPage } from "./components/IndustriesPage";
import { CompaniesPage } from "./components/CompaniesPage";
import { UsersPage } from "./components/UsersPage";
import { ReviewHandsOnPage } from "./components/ReviewHandsOnPage";
import { NameChangeRequestsPage } from "./components/NameChangeRequestsPage";
import { OfferCodesPage } from "./components/OfferCodesPage";
import { UserProfilePage } from "./components/UserProfilePage";
import { PortfolioPage } from "./components/PortfolioPage";
import { users as allUsers } from "./data/users";
import {
  feedbackForms as seedForms,
  type FeedbackForm,
} from "./data/feedbackForms";

type View =
  | { name: "tasks" }
  | { name: "certs" }
  | { name: "new-task"; taskType: TaskTypeKey }
  | { name: "new-cert" }
  | { name: "content-links" }
  | { name: "question-bank" }
  | { name: "spotlight" }
  | { name: "proctoring" }
  | { name: "scholarship" }
  | { name: "trial-extension" }
  | { name: "feedback" }
  | { name: "feedback-detail"; formId: string }
  | { name: "feedback-versions"; formId: string }
  | { name: "industries" }
  | { name: "companies"; query?: string }
  | { name: "users" }
  | { name: "offer-codes" }
  | { name: "review-hands-on" }
  | { name: "name-change-requests" };

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

  const sidebarActive =
    view.name === "certs" || view.name === "new-cert"
      ? "certs"
      : view.name === "content-links"
      ? "content-links"
      : view.name === "question-bank"
      ? "question-bank"
      : view.name === "spotlight"
      ? "spotlight"
      : view.name === "proctoring"
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
      : view.name === "companies"
      ? "manage-companies"
      : view.name === "users"
      ? "manage-users"
      : view.name === "offer-codes"
      ? "offer-codes"
      : view.name === "review-hands-on"
      ? "review-hands-on"
      : view.name === "name-change-requests"
      ? "name-change-requests"
      : "tasks";

  function navigate(key: string) {
    if (key === "certs") setView({ name: "certs" });
    else if (key === "tasks") setView({ name: "tasks" });
    else if (key === "content-links") setView({ name: "content-links" });
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
            <TasksPage onNewTask={(t) => setView({ name: "new-task", taskType: t })} />
          </div>
        </div>
      ) : view.name === "certs" ? (
        <CertificationsPage onNewCert={() => setView({ name: "new-cert" })} />
      ) : view.name === "content-links" ? (
        <ContentLinksPage />
      ) : view.name === "question-bank" ? (
        <QuestionBankPage />
      ) : view.name === "spotlight" ? (
        <SpotlightsPage />
      ) : view.name === "proctoring" ? (
        <ProctoringPage />
      ) : view.name === "scholarship" ? (
        <ScholarshipsPage />
      ) : view.name === "trial-extension" ? (
        <TrialExtensionPage />
      ) : view.name === "industries" ? (
        <IndustriesPage />
      ) : view.name === "companies" ? (
        <CompaniesPage initialQuery={view.query} />
      ) : view.name === "users" ? (
        <UsersPage onViewCompany={(name) => setView({ name: "companies", query: name })} />
      ) : view.name === "offer-codes" ? (
        <OfferCodesPage />
      ) : view.name === "review-hands-on" ? (
        <ReviewHandsOnPage />
      ) : view.name === "name-change-requests" ? (
        <NameChangeRequestsPage />
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
      ) : (
        <NewCertificationWizard onClose={() => setView({ name: "certs" })} />
      )}
    </div>
  );
}
