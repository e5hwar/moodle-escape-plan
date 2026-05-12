import { Dropdown } from "./Dropdown";
import {
  PackageIcon,
  QuizIcon,
  HandsOnIcon,
  IdCardIcon,
  FileIcon,
  LinkIcon,
  GlobeIcon,
} from "./icons";

export type TaskTypeKey =
  | "xapi"
  | "quiz"
  | "hands-on"
  | "id-upload"
  | "file"
  | "deep-link"
  | "url";

const TYPE_OPTIONS: { key: TaskTypeKey; label: string; icon: () => JSX.Element }[] = [
  { key: "xapi", label: "xAPI / SCORM", icon: PackageIcon },
  { key: "quiz", label: "Quiz", icon: QuizIcon },
  { key: "hands-on", label: "Hands-On Task", icon: HandsOnIcon },
  { key: "id-upload", label: "ID Upload", icon: IdCardIcon },
  { key: "file", label: "File", icon: FileIcon },
  { key: "deep-link", label: "Deep Link", icon: LinkIcon },
  { key: "url", label: "URL", icon: GlobeIcon },
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
            New Task
            <span className="cta-kbd">C</span>
          </button>
        )}
      >
        {({ close }) => (
          <div className="menu">
            {TYPE_OPTIONS.map(({ key, label, icon: Icon }) => (
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
