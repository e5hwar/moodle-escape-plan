import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { TasksPage } from "./components/TasksPage";
import { Footer, type TaskTypeKey } from "./components/Footer";
import { NewTaskWizard } from "./components/NewTaskWizard";
import { CertificationsPage } from "./components/CertificationsPage";
import { NewCertificationWizard } from "./components/NewCertificationWizard";

type View =
  | { name: "tasks" }
  | { name: "certs" }
  | { name: "new-task"; taskType: TaskTypeKey }
  | { name: "new-cert" };

export default function App() {
  const [view, setView] = useState<View>({ name: "tasks" });

  const sidebarActive =
    view.name === "certs" || view.name === "new-cert" ? "certs" : "tasks";

  function navigate(key: string) {
    if (key === "certs") setView({ name: "certs" });
    else if (key === "tasks") setView({ name: "tasks" });
  }

  return (
    <div className="app">
      <Sidebar active={sidebarActive} onNavigate={navigate} />
      {view.name === "tasks" ? (
        <div className="main">
          <div className="workspace">
            <TasksPage />
          </div>
          <Footer onNewTask={(t) => setView({ name: "new-task", taskType: t })} />
        </div>
      ) : view.name === "certs" ? (
        <CertificationsPage onNewCert={() => setView({ name: "new-cert" })} />
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
