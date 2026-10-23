/**
 * Results view (T-15, issue #35; views.md §4; US-4, FR-10, FR-11, FR-27).
 *
 * h1, scope line, "X / N" plus the percentage in one paragraph, the band
 * message, the per-topic breakdown (h2 plus a list, only for more than 1
 * topic) and Try again / Choose another topic. Entry focus on the h1 comes
 * from the app's route focus rule; there is no live region (views.md §4).
 *
 * T-38 (US-5; views.md §8): the Review disclosure sits before the buttons;
 * "Retry N missed" sits between the primary button and Choose another
 * topic, counted against the current bank (§8.5). A retry quiz's results
 * use the retry h1/title and "Start a full quiz" as the primary button.
 */
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import type { BankTopic } from "../../../content/types";
import { score, type QuizSession } from "../../../domain";
import { useDocumentTitle } from "../../app/useDocumentTitle";
import { useEntryClickGuard } from "../../components/useEntryClickGuard";
import common from "../../components/common.module.css";
import { strings } from "../../strings";
import type { RetryAvailability } from "../../app/session";
import { Review } from "../Review/Review";
import styles from "./Results.module.css";

export interface ResultsProps {
  /** A finished session (the app only renders this view for one). */
  readonly session: QuizSession;
  /** Bank topics in curated order; names and breakdown order come from here. */
  readonly topics: readonly BankTopic[];
  /**
   * Try again; on a retry quiz's results this is "Start a full quiz" (a
   * fresh draw of the original scope, views.md §8.4).
   */
  readonly onTryAgain: () => void;
  readonly onChooseAnother: () => void;
  /** Missed questions and how many are still in the current bank (§8.5). */
  readonly retry: RetryAvailability;
  /** Starts the retry quiz; `false` if it could not start (§8.5 fallback). */
  readonly onRetryMissed: () => boolean;
  /**
   * Shows `copy:results.retryNote` under a retry quiz's h1. Off until best
   * scores exist (US-6, T-42 turns it on); the note would otherwise refer to
   * something the app does not have yet (sponsor default, PR #111).
   */
  readonly showRetryBestScoreNote?: boolean;
}

export function Results({
  session,
  topics,
  onTryAgain,
  onChooseAnother,
  retry,
  onRetryMissed,
  showRetryBestScoreNote = false,
}: ResultsProps) {
  const { scope, mode } = session.quiz;
  const isRetry = mode === "retry-missed";
  const retryNoteId = useId();
  const noneRef = useRef<HTMLParagraphElement>(null);
  // §8.5 fallback: starting failed although the count said otherwise.
  const [retryFailed, setRetryFailed] = useState(false);
  useEffect(() => {
    if (retryFailed) noneRef.current?.focus();
  }, [retryFailed]);
  const nameOf = (id: string) =>
    topics.find((topic) => topic.id === id)?.name ?? null;
  const scopeName =
    scope.kind === "mixed" ? strings.landing.mixedLabel : nameOf(scope.topicId);
  useDocumentTitle(
    isRetry
      ? strings.title.resultsRetry(scopeName)
      : strings.title.results(scopeName),
  );

  const result = score(
    session,
    topics.map((topic) => topic.id),
  );
  // The 2nd click of a double click on "See results" lands on this view
  // (TL F1): the guard keeps it from moving focus off the h1, and the
  // handlers ignore it too. Keyboard activation has detail 0.
  useEntryClickGuard();
  const singleClick = (action: () => void) => (event: MouseEvent) => {
    if (event.detail > 1) return;
    action();
  };
  // An unknown topic id is never echoed (SEC-R07 N-3): its row is omitted.
  const rows = result.byTopic.flatMap((t) => {
    const name = nameOf(t.topicId);
    return name === null ? [] : [{ ...t, name }];
  });

  const showRetryButton = retry.available > 0 && !retryFailed;
  const removed = retry.missed - retry.available;
  const showPartial = showRetryButton && removed > 0;
  const showNone = retry.missed > 0 && !showRetryButton;

  return (
    <>
      <h1 tabIndex={-1} className={common.heading}>
        {isRetry ? strings.results.retryHeading : strings.results.heading}
      </h1>
      {isRetry && showRetryBestScoreNote && (
        <p className={common.text}>{strings.results.retryNote}</p>
      )}
      {scopeName !== null && <p className={styles.scope}>{scopeName}</p>}
      <p className={styles.score}>
        <span>{strings.results.score(result.correct, result.total)}</span>{" "}
        <span>{strings.results.percent(result.percent)}</span>
      </p>
      <p className={common.text}>{strings.results.band[result.band]}</p>
      {rows.length > 1 && (
        <>
          <h2 className={styles.breakdownHeading}>
            {strings.results.breakdownHeading}
          </h2>
          <ul className={styles.breakdown}>
            {rows.map((row) => (
              <li key={row.topicId}>
                {strings.results.breakdownItem(
                  row.name,
                  row.correct,
                  row.total,
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <Review session={session} topics={topics} />
      <div className={common.actions}>
        <button
          type="button"
          className={common.buttonPrimary}
          onClick={singleClick(onTryAgain)}
        >
          {isRetry ? strings.results.startFull : strings.results.tryAgain}
        </button>
        {showRetryButton && (
          <button
            type="button"
            className={common.buttonSecondary}
            aria-describedby={showPartial ? retryNoteId : undefined}
            onClick={singleClick(() => {
              if (!onRetryMissed()) setRetryFailed(true);
            })}
          >
            {strings.results.retryMissed(retry.available)}
          </button>
        )}
        <button
          type="button"
          className={common.buttonSecondary}
          onClick={singleClick(onChooseAnother)}
        >
          {strings.results.chooseAnother}
        </button>
      </div>
      {showPartial && (
        <p id={retryNoteId} className={styles.retryNote}>
          {strings.results.retryPartial(removed)}
        </p>
      )}
      {showNone && (
        // Static text, no live region; focused only by the failure fallback.
        <p
          ref={noneRef}
          tabIndex={retryFailed ? -1 : undefined}
          className={styles.retryNote}
        >
          {strings.results.retryNone(retry.missed)}
        </p>
      )}
    </>
  );
}
