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
  | { name: "industries" };

export default function App() {
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
