import { NewTaskWizard } from "./NewTaskWizard";
import { formatTaskDuration } from "../data/tasks";
import type { TaskTypeKey } from "./Footer";
import type { CertTask, TaskKind } from "./NewCertificationWizard";

// The cert tree's CertTask.kind is a TaskKind, keyed off Footer's TaskTypeKey.
const TYPE_KEY_TO_KIND: Record<TaskTypeKey, TaskKind> = {
  xapi: "xapi",
  quiz: "quiz",
  "hands-on": "hands-on",
  file: "file",
};

type Props = {
  taskType: TaskTypeKey;
  onClose: () => void;
  onAdd: (task: CertTask) => void;
};

/* Creating a Task from inside the Certification builder: the real Task
   creation UI (its nav + content), full width. It used to sit beside a third
   column that echoed the Certification's Course tree with the new Task
   highlighted — removed on request; the wizard's own close returns to the
   builder, where the Task lands at the spot it was added from. */
export function CertSplitTaskWizard({ taskType, onClose, onAdd }: Props) {
  const kind = TYPE_KEY_TO_KIND[taskType];

  return (
    <div className="cert-split">
      <NewTaskWizard
        taskType={taskType}
        onClose={onClose}
        primaryLabel="Add to Certification"
        onPrimary={(taskName, requiresSubscription, timeToComplete) =>
          onAdd({
            id: `t-${Date.now()}`,
            name: taskName,
            kind,
            // The wizard's Time to Complete; left blank, the row shows no length.
            duration: formatTaskDuration(timeToComplete) || undefined,
            requiresSubscription,
          })
        }
      />
    </div>
  );
}
