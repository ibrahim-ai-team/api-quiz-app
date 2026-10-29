/**
 * Question view (T-12, issue #32; views.md §2; US-2, FR-5, FR-26, FR-27).
 *
 * "Question k of N" is the h1, then the topic line, the prompt (rich text)
 * and the options as a native radio group in a fieldset. Submit is
 * `aria-disabled` with a hint until an option is selected. After Submit the
 * fieldset is disabled (answer locked), the options are marked, the feedback
 * panel appears below them (T-13, views.md §3) and Next or See results
 * replaces Submit. Exit is in the app header.
 *
 * Focus (views.md §0, §3): Submit announces the verdict in the always-mounted
 * polite status region, then focuses Next; Next clears it and focuses the
 * new h1. Entry focus on the h1 comes from the app's route focus rule.
 * T-43 (US-6.2, views.md §9.4, F3): a quiz resumed in `feedback` mounts with
 * the panel and Next but an empty status region; only a Submit seen inside
 * the view announces the verdict.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { BankTopic } from "../../../content/types";
import {
  currentAnswer,
  currentQuestion,
  isLastQuestion,
  progress,
  type QuizAction,
  type QuizSession,
} from "../../../domain";
import { useDocumentTitle } from "../../app/useDocumentTitle";
import { useEntryClickGuard } from "../../components/useEntryClickGuard";
import common from "../../components/common.module.css";
import { CheckIcon, CrossIcon, Feedback } from "./Feedback";
import { strings } from "../../strings";
import { renderInlineText, renderRichText } from "../../text/renderRichText";
import styles from "./Question.module.css";

export interface QuestionProps {
  readonly session: QuizSession;
  /** Bank topics; display names always come from here. */
  readonly topics: readonly BankTopic[];
  /** Bank `contentVersion`, for the report link only (US-3.5). */
  readonly contentVersion: string;
  readonly dispatch: (action: QuizAction) => void;
}

/** Display name of a bank topic, or null for an unknown id (SEC-R07 N-3). */
function topicName(topics: readonly BankTopic[], id: string): string | null {
  return topics.find((topic) => topic.id === id)?.name ?? null;
}

/**
 * views.md §3 scroll rule: when the panel plus Next fit in the viewport,
 * scroll them into view and focus Next without a second scroll; otherwise a
 * plain focus scrolls Next into view (the panel is above it in reading order).
 */
function revealFeedback(panel: HTMLElement | null, next: HTMLElement | null) {
  if (next === null) return;
  const top = panel?.getBoundingClientRect().top ?? 0;
  // Layout viewport height, without a horizontal scrollbar (TL N3).
  const fits =
    next.getBoundingClientRect().bottom - top <=
    document.documentElement.clientHeight;
  if (!fits) {
    next.focus();
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  next.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  next.focus({ preventScroll: true });
}

export function Question({
  session,
  topics,
  contentVersion,
  dispatch,
}: QuestionProps) {
  const id = useId();
  const question = currentQuestion(session);
  const { current, total } = progress(session);
  const { phase, selected, quiz } = session;
  const questionId = question?.id ?? "";

  const scopeName =
    quiz.scope.kind === "mixed"
      ? strings.landing.mixedLabel
      : topicName(topics, quiz.scope.topicId);
  const isRetry = quiz.mode === "retry-missed";
  useDocumentTitle(
    isRetry
      ? strings.title.questionRetry(current, total, scopeName)
      : strings.title.question(current, total, scopeName),
  );

  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  // The 2nd click of a double Submit lands on the panel that took Submit's
  // place: its mousedown would move focus off Next, and its click could
  // follow a link. Cancel both defaults, but only for clicks continuing the
  // pointer sequence that hit Submit (Next keeps its own `detail` guard).
  // Any key press or new question ends the sequence (TL N1, SEC I-2).
  const submitSequence = useRef(false);
  // TL F2: the 2nd click of a double click on Start, Try again or Next must
  // not check a radio or move focus on the new question (armed per question).
  useEntryClickGuard(questionId);
  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    const guard = (event: MouseEvent) => {
      if (event.detail <= 1) {
        if (event.type === "mousedown") submitSequence.current = false;
      } else if (submitSequence.current) {
        event.preventDefault();
      }
    };
    const endSequence = () => {
      submitSequence.current = false;
    };
    view.addEventListener("mousedown", guard);
    view.addEventListener("click", guard);
    view.addEventListener("keydown", endSequence);
    return () => {
      view.removeEventListener("mousedown", guard);
      view.removeEventListener("click", guard);
      view.removeEventListener("keydown", endSequence);
    };
  }, []);
  // The question that was already locked when the view mounted (Resume into
  // feedback): its verdict is in the panel and is not announced again (F3).
  const [mountedLocked] = useState(() =>
    phase === "answering" ? null : questionId,
  );
  const shown = useRef({ questionId, phase });
  useEffect(() => {
    const previous = shown.current;
    shown.current = { questionId, phase };
    if (previous.questionId !== questionId) {
      submitSequence.current = false;
      headingRef.current?.focus();
    } else if (previous.phase === "answering" && phase === "feedback") {
      // The verdict is already in the status region (same commit).
      revealFeedback(panelRef.current, nextRef.current);
    }
  }, [questionId, phase]);

  if (question === undefined) return null;

  const questionTopic = topicName(topics, question.topicId);
  const locked = phase !== "answering";
  const canSubmit = !locked && selected !== null;
  const hintId = `${id}-hint`;
  const answer = locked ? currentAnswer(session) : undefined;
  const correctText =
    question.options.find((option) => option.id === question.correctOptionId)
      ?.text ?? "";
  // Only the short verdict is announced, so nothing is read twice (§3).
  const liveText =
    answer === undefined || questionId === mountedLocked
      ? ""
      : answer.correct
        ? strings.feedback.liveCorrect(correctText)
        : strings.feedback.liveIncorrect(correctText);

  const submit = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!canSubmit) return;
    // detail 0 = keyboard or programmatic activation: no pointer sequence.
    if (event.detail > 0) submitSequence.current = true;
    dispatch({ type: "submit" });
  };
  const goNext = (event: ReactMouseEvent<HTMLButtonElement>) => {
    // The second click of a double click on Submit can land on Next (the
    // view guard above cancels only defaults): ignore it so 1 activation
    // advances 1 (US-2.5).
    if (event.detail > 1) return;
    dispatch({ type: "next" });
  };

  return (
    <div ref={viewRef} className={styles.view} data-question-id={question.id}>
      <h1 ref={headingRef} tabIndex={-1} className={common.heading}>
        {strings.question.heading(current, total)}
      </h1>
      {/* Retry quiz (US-5, views.md §8.4): the h1 itself is unchanged. */}
      {isRetry && (
        <p className={styles.retryLabel}>{strings.question.retryLabel}</p>
      )}
      {/* An unknown topic id omits the line instead of showing "Topic: ". */}
      {questionTopic !== null && (
        <p className={styles.topic}>{strings.question.topic(questionTopic)}</p>
      )}
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
        {question.options.map((option) => {
          const isCorrect =
            answer !== undefined && option.id === question.correctOptionId;
          const isChosen = answer?.optionId === option.id;
          const marker = isCorrect
            ? styles.optionCorrect
            : isChosen
              ? styles.optionWrong
              : undefined;
          return (
            <label
              key={option.id}
              className={[styles.option, marker].filter(Boolean).join(" ")}
            >
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
                {/* Text tags plus icons (US-3.1): part of the radio's name. */}
                {isCorrect && (
                  <>
                    {" "}
                    <span className={styles.tag}>
                      <CheckIcon />
                      {strings.feedback.tagCorrect}
                    </span>
                  </>
                )}
                {isChosen && (
                  <>
                    {" "}
                    <span className={styles.tag}>
                      {!isCorrect && <CrossIcon />}
                      {strings.feedback.tagChosen}
                    </span>
                  </>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
      {answer !== undefined && (
        // Keyed by question, so a focused explanation code box is never reused.
        <Feedback
          key={`feedback-${question.id}`}
          ref={panelRef}
          question={question}
          answer={answer}
          correctText={correctText}
          contentVersion={contentVersion}
        />
      )}
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
      {/* Mounted empty from the start (G4); text set on Submit, cleared on
          Next; empty after Resume into feedback (F3). */}
      <div role="status" className={common.visuallyHidden}>
        {renderInlineText(liveText)}
      </div>
    </div>
  );
}
