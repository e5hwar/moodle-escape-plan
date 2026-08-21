import { Dropdown } from "./Dropdown";
import { PackageIcon, QuizIcon, HandsOnIcon, FileIcon, AddIcon } from "./icons";

export type TaskTypeKey =
  | "xapi"
  | "quiz"
  | "hands-on"
  | "file";

export const TASK_TYPE_OPTIONS: { key: TaskTypeKey; label: string; icon: () => JSX.Element }[] = [
  { key: "xapi", label: "xAPI / SCORM", icon: PackageIcon },
  { key: "quiz", label: "Quiz", icon: QuizIcon },
  { key: "hands-on", label: "Hands-On Task", icon: HandsOnIcon },
  { key: "file", label: "Resource", icon: FileIcon },
];

type Props = { onNewTask: (type: TaskTypeKey) => void };

export function Footer({ onNewTask }: Props) {
  return (
    <footer className="footer">
      <Dropdown
        align="right"
        direction="up"
        width={220}
        trigger={({ toggle }) => (
          <button className="new-task" onClick={toggle}>
            <AddIcon />
            Create Task
            <span className="cta-kbd">C</span>
          </button>
        )}
      >
        {({ close }) => (
          <div className="menu">
            {TASK_TYPE_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className="menu-item"
                onClick={() => {
                  onNewTask(key);
                  close();
                }}
              >
                <span className="menu-item-icon">
                  <Icon />
                </span>
                {label}
              </button>
            ))}
          </div>
        )}
      </Dropdown>
    </footer>
  );
}
