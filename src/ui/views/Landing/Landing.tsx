/**
 * Landing view (T-09, issue #29; views.md §1, §7b; US-1, US-12.1, US-12.2).
 * Topic radio group in curated order with counts, Mixed last, and Start.
 * T-13 adds the general "Report a problem" link to "About the questions".
 * Displayed names come from the bank topic objects; `topicId` from the route
 * is only compared against bank ids and never rendered (security I-3).
 */
import { useId, useRef, useState } from "react";
import { eligibleTopics, type QuizScope } from "../../../domain";
import type { BankState } from "../../app/bankState";
import { useDocumentTitle } from "../../app/useDocumentTitle";
import { BankStatus } from "../../components/BankStatus";
import { ExternalLink } from "../../components/ExternalLink";
import common from "../../components/common.module.css";
import { generalReportHref } from "../../report/reportLink";
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

/**
 * Stand-in rows for the loading reserve (T-34): the shipped bank shows 3
 * topics plus Mixed. Names are one non-breaking space, so each row is one
 * line, like a short topic name. Update the count when the shipped topic
 * count changes; a mismatch moves later content by the difference only.
 */
const RESERVE_TOPICS = 3;
const RESERVE_CHOICES: readonly Choice[] = [
  ...Array.from({ length: RESERVE_TOPICS }, (_, index) => ({
    key: `reserve-${String(index)}`,
    scope: { kind: "topic", topicId: `reserve-${String(index)}` } as const,
    name: "\u00a0",
    count: 8,
  })),
  {
    key: "reserve-mixed",
    scope: { kind: "mixed" },
    name: strings.landing.mixedLabel,
    count: RESERVE_TOPICS * 8,
    description: strings.landing.mixedDescription,
  },
];

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

  /**
   * The topic group and Start. `placeholder` renders the same markup with
   * stand-in rows for the loading reserve: no handlers, no ids shared with the
   * live group, and every control disabled.
   */
  const topicGroup = (list: readonly Choice[], placeholder: boolean) => {
    const prefix = placeholder ? `${id}-reserve` : id;
    const showHint = placeholder ? selected === null : selection === null;
    return (
      <>
        <fieldset className={styles.group} disabled={placeholder || undefined}>
          <legend className={styles.legend}>
            {strings.landing.topicsLegend}
          </legend>
          {list.map((choice, index) => {
            const count = strings.landing.topicCount(choice.count);
            const descId = `${prefix}-desc-${String(index)}`;
            const hasDescription = choice.description !== undefined;
            return (
              <label key={choice.key} className={styles.option}>
                <input
                  type="radio"
                  name={`${prefix}-topic`}
                  className={styles.radio}
                  checked={!placeholder && sameScope(selection, choice.scope)}
                  onChange={() => {
                    if (placeholder) return;
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
            disabled={placeholder || undefined}
            aria-disabled={unavailable ? true : undefined}
            aria-describedby={showHint ? `${prefix}-hint` : undefined}
            onClick={placeholder ? undefined : start}
          >
            {strings.landing.start}
          </button>
          {showHint && (
            <p id={`${prefix}-hint`} className={styles.hint}>
              {strings.landing.startHint}
            </p>
          )}
        </div>
      </>
    );
  };

  let topicArea;
  if (bank.status !== "ready") {
    // CLS (T-34): while the bank loads, an invisible copy of the topic group
    // reserves its height, so "About the questions" does not move when the
    // real group replaces it. The status region sits on top in the same grid
    // cell, so the loading text still appears after 300 ms in role="status".
    // The wrapper stays for the error state too: BankStatus keeps its place
    // in the tree, so Retry stays the same DOM node and keeps focus.
    topicArea = (
      <div className={styles.reserve}>
        <BankStatus state={bank} onRetry={onRetry} />
        {bank.status === "loading" && (
          <div className={styles.reserveGroup} aria-hidden="true">
            {topicGroup(RESERVE_CHOICES, true)}
          </div>
        )}
      </div>
    );
  } else if (choices.length === 0) {
    topicArea = <p className={common.text}>{strings.landing.noTopics}</p>;
  } else {
    topicArea = (
      <>
        {topicGroup(choices, false)}
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
      {/* General report (US-12.1): same form, no question ID (T-13). */}
      <p className={common.text}>
        <ExternalLink href={generalReportHref()}>
          {strings.landing.report}
        </ExternalLink>
      </p>
    </>
  );
}
