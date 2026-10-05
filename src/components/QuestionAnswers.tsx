import type { Question } from "../data/questionBank";
import { CheckIcon } from "./icons";

/** A question's prompt and whatever answer data its type carries — options
 *  with the correct ones ticked, True/False, match pairs, the scale, the file
 *  rules. The admin's read-only look, shared by Select Questions' preview and
 *  the Question Bank's row preview panel. `hideText` drops the prompt where the
 *  surface already titles itself with it. */
export function QuestionAnswers({ question, hideText = false }: { question: Question; hideText?: boolean }) {
  return (
    <div className="qpv">
      {!hideText && <p className="qpv-text">{question.text}</p>}
      {question.options && question.options.length > 0 && (
        <ul className="qpv-list">
          {question.options.map((o, i) => (
            <li key={i} className={`qpv-opt${o.grade > 0 ? " is-correct" : ""}`}>
              <span className="qpv-opt-mark">{o.grade > 0 ? <CheckIcon /> : null}</span>
              <span>{o.text}</span>
            </li>
          ))}
        </ul>
      )}
      {question.type === "True/False" && (
        <ul className="qpv-list">
          {[true, false].map((v) => (
            <li
              key={String(v)}
              className={`qpv-opt${question.tfAnswer === v ? " is-correct" : ""}`}
            >
              <span className="qpv-opt-mark">
                {question.tfAnswer === v ? <CheckIcon /> : null}
              </span>
              <span>{v ? "True" : "False"}</span>
            </li>
          ))}
        </ul>
      )}
      {question.pairs && question.pairs.length > 0 && (
        <ul className="qpv-list">
          {question.pairs.map((p, i) => (
            <li key={i} className="qpv-pair">
              <span className="qpv-pair-left">{p.left || "—"}</span>
              <span className="qpv-pair-right">{p.right}</span>
            </li>
          ))}
        </ul>
      )}
      {question.scale && (
        <p className="qpv-note">
          Scale {question.scale.min}–{question.scale.max}
          {question.scale.minLabel || question.scale.maxLabel
            ? ` (${question.scale.minLabel ?? ""} … ${question.scale.maxLabel ?? ""})`
            : ""}
        </p>
      )}
      {question.fileRules && (
        <p className="qpv-note">
          Up to {question.fileRules.maxFiles} file
          {question.fileRules.maxFiles === 1 ? "" : "s"}, {question.fileRules.maxSizeMb} MB each
        </p>
      )}
      {question.type === "Short answer" && (
        <p className="qpv-note">Free-text answer — graded by a reviewer.</p>
      )}
    </div>
  );
}
