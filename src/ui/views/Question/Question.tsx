/**
 * Question view (T-12, issue #32; views.md §2; US-2, FR-5, FR-26, FR-27).
 *
 * "Question k of N" is the h1, then the topic line, the prompt (rich text)
 * and the options as a native radio group in a fieldset. Submit is
 * `aria-disabled` with a hint until an option is selected. After Submit the
 * fieldset is disabled (answer locked) and Next or See results replaces it;
 * the feedback panel and live region are T-13. Exit is in the app header.
 *
 * Focus (views.md §0): Submit focuses Next, and Next focuses the new h1.
 * Entry focus on the h1 comes from the app's route focus rule.
 */
import { useEffect, useId, useRef, type MouseEvent } from "react";
import type { BankTopic } from "../../../content/types";
import {
  currentQuestion,
  isLastQuestion,
  progress,
  type QuizAction,
  type QuizSession,
} from "../../../domain";
import { useDocumentTitle } from "../../app/useDocumentTitle";
import common from "../../components/common.module.css";
import { strings } from "../../strings";
import { renderInlineText, renderRichText } from "../../text/renderRichText";
import styles from "./Question.module.css";

export interface QuestionProps {
  readonly session: QuizSession;
  /** Bank topics; display names always come from here. */
  readonly topics: readonly BankTopic[];
  readonly dispatch: (action: QuizAction) => void;
}

function topicName(topics: readonly BankTopic[], id: string): string {
  return topics.find((topic) => topic.id === id)?.name ?? "";
}

export function Question({ session, topics, dispatch }: QuestionProps) {
  const id = useId();
  const question = currentQuestion(session);
  const { current, total } = progress(session);
  const { phase, selected, quiz } = session;
  const questionId = question?.id ?? "";

  const scopeName =
    quiz.scope.kind === "mixed"
      ? strings.landing.mixedLabel
      : topicName(topics, quiz.scope.topicId);
  useDocumentTitle(strings.title.question(current, total, scopeName));

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const shown = useRef({ questionId, phase });
  useEffect(() => {
    const previous = shown.current;
    shown.current = { questionId, phase };
    if (previous.questionId !== questionId) {
      headingRef.current?.focus();
    } else if (previous.phase === "answering" && phase === "feedback") {
      nextRef.current?.focus();
    }
  }, [questionId, phase]);

  if (question === undefined) return null;

  const locked = phase !== "answering";
  const canSubmit = !locked && selected !== null;
  const hintId = `${id}-hint`;

  const submit = () => {
    if (canSubmit) dispatch({ type: "submit" });
  };
  const goNext = (event: MouseEvent<HTMLButtonElement>) => {
    // The second click of a double click on Submit lands on Next, which
    // takes Submit's place: ignore it so 1 activation advances 1 (US-2.5).
    if (event.detail > 1) return;
    dispatch({ type: "next" });
  };

  return (
    <div className={styles.view} data-question-id={question.id}>
      <h1 ref={headingRef} tabIndex={-1} className={common.heading}>
        {strings.question.heading(current, total)}
      </h1>
      <p className={styles.topic}>
        {strings.question.topic(topicName(topics, question.topicId))}
      </p>
      {/* Keyed by question, so a focused code box is never reused. */}
      <div key={`prompt-${question.id}`} className={styles.prompt}>
        {renderRichText(question.prompt, {
          codeLabel: strings.question.codeLabel,
        })}
      </div>
      <fieldset
        key={`options-${question.id}`}
        className={styles.group}
        disabled={locked}
      >
        <legend className={styles.legend}>
          {strings.question.optionsLegend}
        </legend>
        {question.options.map((option) => (
          <label key={option.id} className={styles.option}>
            <input
              type="radio"
              name={`${id}-${question.id}`}
              value={option.id}
              className={styles.radio}
              checked={selected === option.id}
              onChange={() => {
                dispatch({ type: "select", optionId: option.id });
              }}
            />
            <span className={styles.optionText}>
              {renderInlineText(option.text)}
            </span>
          </label>
        ))}
      </fieldset>
      <div className={styles.actions}>
        {locked ? (
          // Keyed: Next is never the reused Submit element.
          <button
            key="next"
            ref={nextRef}
            type="button"
            className={common.buttonPrimary}
            onClick={goNext}
          >
            {isLastQuestion(session)
              ? strings.feedback.seeResults
              : strings.feedback.next}
          </button>
        ) : (
          <>
            <button
              key="submit"
              type="button"
              className={common.buttonPrimary}
              aria-disabled={canSubmit ? undefined : true}
              aria-describedby={canSubmit ? undefined : hintId}
              onClick={submit}
            >
              {strings.question.submit}
            </button>
            {!canSubmit && (
              <p id={hintId} className={styles.hint}>
                {strings.question.submitHint}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
