/**
 * Landing view (T-09, issue #29; views.md §1, §7b; US-1, US-12.1, US-12.2).
 * Topic radio group in curated order with counts, Mixed last, and Start.
 * Displayed names come from the bank topic objects; `topicId` from the route
 * is only compared against bank ids and never rendered (security I-3).
 */
import { useId, useRef, useState } from "react";
import { eligibleTopics, type QuizScope } from "../../../domain";
import type { BankState } from "../../app/bankState";
import { useDocumentTitle } from "../../app/useDocumentTitle";
import { BankStatus } from "../../components/BankStatus";
import common from "../../components/common.module.css";
import { strings } from "../../strings";
import styles from "./Landing.module.css";

export interface LandingProps {
  readonly bank: BankState;
  readonly onRetry: () => void;
  /** Topic id from a `#/topic/:id` deep link; only compared, never shown. */
  readonly topicId: string | null;
  /** The deep-linked topic is unknown or empty (views.md §7b). */
  readonly topicNotFound: boolean;
  /** Creates the quiz and navigates; returns false when it failed. */
  readonly onStart: (scope: QuizScope) => boolean;
}

interface Choice {
  readonly key: string;
  readonly scope: QuizScope;
  readonly name: string;
  readonly count: number;
  readonly description?: string;
}

function sameScope(a: QuizScope | null, b: QuizScope): boolean {
  if (a?.kind !== b.kind) return false;
  return a.kind === "mixed" || (b.kind === "topic" && a.topicId === b.topicId);
}

export function Landing({
  bank,
  onRetry,
  topicId,
  topicNotFound,
  onStart,
}: LandingProps) {
  const id = useId();
  const [selected, setSelected] = useState<QuizScope | null>(
    topicId === null || topicNotFound ? null : { kind: "topic", topicId },
  );
  // Ref guard: a second activation before the re-render is ignored (US-1.6).
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  useDocumentTitle(
    bank.status === "error"
      ? strings.title.dataError
      : topicNotFound
        ? strings.title.topicNotFound
        : strings.title.landing,
  );

  const choices: Choice[] = [];
  if (bank.status === "ready") {
    const topics = eligibleTopics(bank.bank);
    for (const topic of topics) {
      choices.push({
        key: `t-${topic.id}`,
        scope: { kind: "topic", topicId: topic.id },
        name: topic.name,
        count: topic.count,
      });
    }
    // Mixed is hidden when only 1 topic is shown (US-1.2).
    if (topics.length > 1) {
      choices.push({
        key: "mixed",
        scope: { kind: "mixed" },
        name: strings.landing.mixedLabel,
        count: topics.reduce((sum, topic) => sum + topic.count, 0),
        description: strings.landing.mixedDescription,
      });
    }
  }
  // A deep link to an unknown topic never matches, so nothing is selected.
  const selection =
    choices.find((choice) => sameScope(selected, choice.scope))?.scope ?? null;
  const unavailable = selection === null || starting;

  const start = () => {
    if (selection === null || startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setFailed(false);
    let ok = false;
    try {
      ok = onStart(selection);
    } finally {
      // A false result or a throw resets the guard; a throw is rethrown.
      if (!ok) {
        startingRef.current = false;
        setStarting(false);
        setFailed(true);
      }
    }
  };

  const hintId = `${id}-hint`;
  let topicArea;
  if (bank.status !== "ready") {
    topicArea = <BankStatus state={bank} onRetry={onRetry} />;
  } else if (choices.length === 0) {
    topicArea = <p className={common.text}>{strings.landing.noTopics}</p>;
  } else {
    topicArea = (
      <>
        <fieldset className={styles.group}>
          <legend className={styles.legend}>
            {strings.landing.topicsLegend}
          </legend>
          {choices.map((choice, index) => {
            const count = strings.landing.topicCount(choice.count);
            const descId = `${id}-desc-${String(index)}`;
            const hasDescription = choice.description !== undefined;
            return (
              <label key={choice.key} className={styles.option}>
                <input
                  type="radio"
                  name={`${id}-topic`}
                  className={styles.radio}
                  checked={sameScope(selection, choice.scope)}
                  onChange={() => {
                    setSelected(choice.scope);
                    setFailed(false);
                  }}
                  // One name in every engine: "Status codes, 12 questions".
                  aria-label={`${choice.name}, ${count}`}
                  aria-describedby={hasDescription ? descId : undefined}
                />
                <span className={styles.optionText}>
                  <span className={styles.optionLabel}>
                    <span className={styles.optionName}>{choice.name}</span>
                    <span className={styles.optionCount}>{count}</span>
                  </span>
                  {hasDescription && (
                    <span id={descId} className={styles.optionDescription}>
                      {choice.description}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
        <div className={styles.start}>
          <button
            type="button"
            className={common.buttonPrimary}
            aria-disabled={unavailable ? true : undefined}
            aria-describedby={selection === null ? hintId : undefined}
            onClick={start}
          >
            {strings.landing.start}
          </button>
          {selection === null && (
            <p id={hintId} className={styles.hint}>
              {strings.landing.startHint}
            </p>
          )}
        </div>
        {failed && (
          <p role="alert" className={common.text}>
            {strings.landing.startError}
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <h1 tabIndex={-1} className={common.heading}>
        {topicNotFound
          ? strings.notFound.topicHeading
          : strings.landing.heading}
      </h1>
      <p className={common.text}>
        {topicNotFound
          ? strings.notFound.topicBody
          : strings.landing.description}
      </p>
      {topicArea}
      <h2 className={styles.aboutHeading}>{strings.landing.aboutHeading}</h2>
      <p className={common.text}>{strings.landing.accuracyNote}</p>
    </>
  );
}
