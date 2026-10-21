/**
 * Feedback panel (T-13, issue #33; views.md §3; US-3.1, US-3.2, US-3.5).
 * A `section` named by its verdict `h2`, then "Correct answer: X" (wrong
 * answers only), the explanation, the source link and the report link.
 * Meaning never relies on colour: icon plus text verdict, and the panel's
 * left border is decoration only.
 */
import { useId, type Ref } from "react";
import type { Answer, QuizQuestion } from "../../../domain";
import { ExternalLink, safeHttpsUrl } from "../../components/ExternalLink";
import { questionReportHref } from "../../report/reportLink";
import { strings } from "../../strings";
import { renderInlineText, renderRichText } from "../../text/renderRichText";
import styles from "./Question.module.css";

export interface FeedbackProps {
  readonly question: QuizQuestion;
  readonly answer: Answer;
  /** Text of the correct option (rich inline text). */
  readonly correctText: string;
  readonly contentVersion: string;
  readonly ref?: Ref<HTMLElement>;
}

export function Feedback({
  question,
  answer,
  correctText,
  contentVersion,
  ref,
}: FeedbackProps) {
  const headingId = useId();
  const source = safeHttpsUrl(question.sourceUrl);
  return (
    <section
      ref={ref}
      aria-labelledby={headingId}
      className={[
        styles.panel,
        answer.correct ? styles.panelCorrect : styles.panelIncorrect,
      ].join(" ")}
    >
      <h2 id={headingId} className={styles.verdict}>
        {answer.correct ? <CheckIcon /> : <CrossIcon />}
        {answer.correct ? strings.feedback.correct : strings.feedback.incorrect}
      </h2>
      {!answer.correct && (
        <p className={styles.panelText}>
          {renderInlineText(strings.feedback.correctAnswer(correctText))}
        </p>
      )}
      <h3 className={styles.panelHeading}>
        {strings.feedback.explanationHeading}
      </h3>
      <div className={styles.explanation}>
        {renderRichText(question.explanation, {
          codeLabel: strings.feedback.explanationCodeLabel,
        })}
      </div>
      <p className={styles.panelText}>
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
      <p className={styles.panelText}>
        <ExternalLink href={questionReportHref(question.id, contentVersion)}>
          {strings.feedback.report}
        </ExternalLink>
      </p>
    </section>
  );
}

/** Inline SVG icons (tokens.md §6): decorative, the text carries meaning. */
export function CheckIcon() {
  return (
    <svg
      className={styles.iconCorrect}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 12.5l4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg
      className={styles.iconWrong}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
