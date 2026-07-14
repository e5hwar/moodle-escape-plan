import {
  formResponses,
  type FeedbackForm,
} from "../data/feedbackForms";
import { type Question } from "../data/questionBank";
import { ChevronLeftIcon } from "./icons";
import { FeedbackFormResponses } from "./FeedbackFormResponses";

type Props = {
  form: FeedbackForm;
  bank: Question[];
  onBack: () => void;
};

export function FeedbackFormResponsesPage({ form, bank, onBack }: Props) {
  const responses = formResponses[form.id] ?? [];

  return (
    <div className="main">
      <div className="workspace">
        <div className="tasks fb-page">
          <header className="tasks-header">
            <div>
              <button className="attempts-back" onClick={onBack}>
                <ChevronLeftIcon />
                Feedback Forms
              </button>
              <h1 className="tasks-title">Responses</h1>
              <div className="tasks-subtitle">
                <span>{form.name || "Untitled form"}</span>
                <span className="tasks-subtitle-dot" />
                <span>{form.id}</span>
                <span className="tasks-subtitle-dot" />
                <span>{form.responseCount.toLocaleString()} responses</span>
              </div>
            </div>
          </header>

          <div className="tasks-row">
            <div className="tasks-content">
              <div className="fb-resp-page-scroll">
                <FeedbackFormResponses form={form} bank={bank} responses={responses} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
