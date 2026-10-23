/**
 * Review answers disclosure (T-38, US-5.1, US-5.2; views.md §8.2, §8.3).
 *
 * An `h2` holding a disclosure button (`aria-expanded`, `aria-controls`)
 * and, only while expanded, an `ol` with one item per question in quiz
 * order. Focus stays on the toggle; nothing inside the list is focused by
 * script and there is no live region. The state lives in this component,
 * so every Results view starts collapsed. Items show the session snapshot,
 * not the current bank. Meaning never relies on colour: verdict text in
 * each heading, "Your answer" / "Correct answer" labels, icons and
 * solid/dashed borders.
 */
import { useId, useState } from "react";
import type { BankTopic } from "../../../content/types";
import type { Answer, QuizQuestion, QuizSession } from "../../../domain";
import { ExternalLink } from "../../components/ExternalLink";
import { safeHttpsUrl } from "../../components/safeUrl";
import { strings } from "../../strings";
import { renderInlineText, renderRichText } from "../../text/renderRichText";
import { CheckIcon, CrossIcon } from "../Question/Feedback";
import styles from "./Review.module.css";

export interface ReviewProps {
  /** A finished session: `answers[i]` belongs to `quiz.questions[i]`. */
  readonly session: QuizSession;
  /** Bank topics; display names come from here (unknown ids are omitted). */
  readonly topics: readonly BankTopic[];
}

export function Review({ session, topics }: ReviewProps) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const { questions } = session.quiz;
  return (
    <>
      <h2 className={styles.heading}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => {
            setExpanded((open) => !open);
          }}
        >
          <ChevronIcon up={expanded} />
          {strings.review.toggle}
        </button>
      </h2>
      {expanded && (
        <ol id={listId} className={styles.list}>
          {questions.map((question, i) => {
            const answer = session.answers[i];
            return answer === undefined ? null : (
              <ReviewItem
                key={question.id}
                number={i + 1}
                question={question}
                answer={answer}
                topics={topics}
              />
            );
          })}
        </ol>
      )}
    </>
  );
}

interface ReviewItemProps {
  readonly number: number;
  readonly question: QuizQuestion;
  readonly answer: Answer;
  readonly topics: readonly BankTopic[];
}

function ReviewItem({ number, question, answer, topics }: ReviewItemProps) {
  const topic = topics.find((t) => t.id === question.topicId)?.name ?? null;
  const textOf = (id: string) =>
    question.options.find((option) => option.id === id)?.text ?? "";
  const source = safeHttpsUrl(question.sourceUrl);
  const verdict = answer.correct
    ? strings.feedback.correct
    : strings.feedback.incorrect;
  return (
    <li
      className={[
        styles.item,
        answer.correct ? styles.itemCorrect : styles.itemIncorrect,
      ].join(" ")}
      data-question-id={question.id}
    >
      <h3 className={styles.itemHeading}>
        {answer.correct ? <CheckIcon /> : <CrossIcon />}
        {strings.review.itemHeading(number, verdict)}
      </h3>
      {topic !== null && (
        <p className={styles.topic}>{strings.question.topic(topic)}</p>
      )}
      <div className={styles.prompt}>
        {renderRichText(question.prompt, {
          codeLabel: (i, count) =>
            strings.review.promptCodeLabel(number, i, count),
        })}
      </div>
      <p
        className={[
          styles.answer,
          answer.correct ? styles.answerCorrect : styles.answerWrong,
        ].join(" ")}
      >
        {answer.correct ? <CheckIcon /> : <CrossIcon />}
        <span className={styles.answerText}>
          {renderInlineText(strings.review.yourAnswer(textOf(answer.optionId)))}
        </span>
      </p>
      <p className={[styles.answer, styles.answerCorrect].join(" ")}>
        <CheckIcon />
        <span className={styles.answerText}>
          {renderInlineText(
            strings.feedback.correctAnswer(textOf(question.correctOptionId)),
          )}
        </span>
      </p>
      <h4 className={styles.explanationHeading}>
        {strings.feedback.explanationHeading}
      </h4>
      <div className={styles.explanation}>
        {renderRichText(question.explanation, {
          codeLabel: (i, count) =>
            strings.review.explanationCodeLabel(number, i, count),
        })}
      </div>
      <p className={styles.text}>
        {source === null ? (
          // A non-https source is plain text, never a link (US-3.2).
          strings.feedback.sourceUnlinked(question.sourceUrl)
        ) : (
          <>
            {strings.feedback.sourcePrefix}{" "}
            <ExternalLink href={source.href}>{source.hostname}</ExternalLink>
          </>
        )}
      </p>
    </li>
  );
}

/** Decorative chevron: down when collapsed, up when expanded (no animation). */
function ChevronIcon({ up }: { readonly up: boolean }) {
  return (
    <svg
      className={styles.chevron}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
