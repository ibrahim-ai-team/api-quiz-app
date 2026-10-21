/**
 * Results view (T-15, issue #35; views.md §4; US-4, FR-10, FR-11, FR-27).
 *
 * h1, scope line, "X / N" plus the percentage in one paragraph, the band
 * message, the per-topic breakdown (h2 plus a list, only for more than 1
 * topic) and Try again / Choose another topic. Entry focus on the h1 comes
 * from the app's route focus rule; there is no live region (views.md §4).
 * The US-5 Review / Retry missed slot is not built here.
 */
import type { MouseEvent } from "react";
import type { BankTopic } from "../../../content/types";
import { score, type QuizSession } from "../../../domain";
import { useDocumentTitle } from "../../app/useDocumentTitle";
import { useEntryClickGuard } from "../../components/useEntryClickGuard";
import common from "../../components/common.module.css";
import { strings } from "../../strings";
import styles from "./Results.module.css";

export interface ResultsProps {
  /** A finished session (the app only renders this view for one). */
  readonly session: QuizSession;
  /** Bank topics in curated order; names and breakdown order come from here. */
  readonly topics: readonly BankTopic[];
  readonly onTryAgain: () => void;
  readonly onChooseAnother: () => void;
}

export function Results({
  session,
  topics,
  onTryAgain,
  onChooseAnother,
}: ResultsProps) {
  const { scope } = session.quiz;
  const nameOf = (id: string) =>
    topics.find((topic) => topic.id === id)?.name ?? null;
  const scopeName =
    scope.kind === "mixed" ? strings.landing.mixedLabel : nameOf(scope.topicId);
  useDocumentTitle(strings.title.results(scopeName));

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

  return (
    <>
      <h1 tabIndex={-1} className={common.heading}>
        {strings.results.heading}
      </h1>
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
      <div className={common.actions}>
        <button
          type="button"
          className={common.buttonPrimary}
          onClick={singleClick(onTryAgain)}
        >
          {strings.results.tryAgain}
        </button>
        <button
          type="button"
          className={common.buttonSecondary}
          onClick={singleClick(onChooseAnother)}
        >
          {strings.results.chooseAnother}
        </button>
      </div>
    </>
  );
}
