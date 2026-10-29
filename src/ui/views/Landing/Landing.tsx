/**
 * Landing view (T-09, issue #29; views.md §1, §7b; US-1, US-12.1, US-12.2).
 * Topic radio group in curated order with counts, Mixed last, and Start.
 * T-13 adds the general "Report a problem" link to "About the questions".
 * T-42 adds the best score line to each row (US-6.1, views.md §9.3).
 * T-43 adds the resume slot (load notice and resume card, §9.4, §9.5) and
 * the inline replace confirmation under Start (US-6.4, §9.6).
 * Displayed names come from the bank topic objects; `topicId` from the route
 * is only compared against bank ids and never rendered (security I-3).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { landingReserve } from "../../../content/landingReserve";
import {
  bestFor,
  eligibleTopics,
  type BestScore,
  type QuizScope,
} from "../../../domain";
import type { BankState } from "../../app/bankState";
import { useDocumentTitle } from "../../app/useDocumentTitle";
import { BankStatus } from "../../components/BankStatus";
import { ExternalLink } from "../../components/ExternalLink";
import common from "../../components/common.module.css";
import { generalReportHref } from "../../report/reportLink";
import { strings } from "../../strings";
import styles from "./Landing.module.css";
import type { LandingProgress } from "./progress";
import { reserveChoices, reserveHasSelection, type Choice } from "./reserve";
import { ResumeSlot } from "./ResumeSlot";

export interface LandingProps {
  readonly bank: BankState;
  readonly onRetry: () => void;
  /** Topic id from a `#/topic/:id` deep link; only compared, never shown. */
  readonly topicId: string | null;
  /** The deep-linked topic is unknown or empty (views.md §7b). */
  readonly topicNotFound: boolean;
  /** Creates the quiz and navigates; returns false when it failed. */
  readonly onStart: (scope: QuizScope) => boolean;
  /**
   * Best scores keyed by topic ID or `"mixed"` (US-6.1, views.md §9.3),
   * already pruned to the bank's topics. `null` hides every best-score line
   * (storage not persistent, U2). Also used by the loading reserve.
   */
  readonly bestScores?: Readonly<Record<string, BestScore>> | null;
  /**
   * Saved quiz and load notice (US-6.2 to US-6.4, views.md §9.4 to §9.6).
   * `null` (storage not persistent, U2) renders no resume slot and no
   * replace confirmation.
   */
  readonly progress?: LandingProgress | null;
}

/** Stand-in rows for the loading reserve (T-34, T-35): real names and count. */
const RESERVE_CHOICES: readonly Choice[] = reserveChoices(landingReserve);

/** The startup decode found a saved quiz or unusable data (§9.2). */
function hasStartupData(progress: LandingProgress): boolean {
  const { reserve } = progress;
  return (
    reserve !== null &&
    (reserve.saved !== null || reserve.sessionFailed || reserve.bestFailed)
  );
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
  bestScores = null,
  progress = null,
}: LandingProps) {
  const id = useId();
  const [selected, setSelected] = useState<QuizScope | null>(
    topicId === null || topicNotFound ? null : { kind: "topic", topicId },
  );
  // Ref guard: a second activation before the re-render is ignored (US-1.6).
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  // Replace confirmation (§9.6): open state, and a counter that asks the
  // effect below to focus the message (also when Start is pressed again).
  const [confirming, setConfirming] = useState(false);
  const [confirmFocus, setConfirmFocus] = useState(0);
  const startRef = useRef<HTMLButtonElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (confirmFocus > 0) messageRef.current?.focus();
  }, [confirmFocus]);

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
  // A resume card is shown: Start asks before replacing it (US-6.4).
  const cardShown =
    progress !== null && bank.status === "ready" && progress.resumable !== null;
  const showConfirm = cardShown && confirming;

  const launch = (scope: QuizScope, begin: (scope: QuizScope) => boolean) => {
    startingRef.current = true;
    setStarting(true);
    setFailed(false);
    let ok = false;
    try {
      ok = begin(scope);
    } finally {
      // A false result or a throw resets the guard; a throw is rethrown.
      if (!ok) {
        startingRef.current = false;
        setStarting(false);
        setFailed(true);
        setConfirming(false);
      }
    }
  };

  const start = () => {
    if (selection === null || startingRef.current) return;
    if (cardShown) {
      setConfirming(true);
      setConfirmFocus((n) => n + 1);
      return;
    }
    launch(selection, onStart);
  };
  const confirmReplace = () => {
    if (selection === null || startingRef.current || progress === null) {
      return;
    }
    // Focus would be lost with the group if starting fails: back to Start.
    launch(selection, (scope) => {
      const ok = progress.onReplaceStart(scope);
      if (!ok) startRef.current?.focus();
      return ok;
    });
  };
  const cancelReplace = () => {
    setConfirming(false);
    startRef.current?.focus();
  };
  const onConfirmKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cancelReplace();
  };

  /**
   * The topic group and Start. `placeholder` renders the same markup with
   * stand-in rows for the loading reserve: no handlers, no ids shared with the
   * live group, and every control disabled.
   */
  const topicGroup = (list: readonly Choice[], placeholder: boolean) => {
    const prefix = placeholder ? `${id}-reserve` : id;
    const showHint = placeholder
      ? !reserveHasSelection(landingReserve, selected)
      : selection === null;
    return (
      <>
        <fieldset className={styles.group} disabled={placeholder || undefined}>
          <legend className={styles.legend}>
            {strings.landing.topicsLegend}
          </legend>
          {list.map((choice, index) => {
            const count = strings.landing.topicCount(choice.count);
            const best =
              bestScores === null
                ? undefined
                : bestFor(bestScores, choice.scope);
            const bestText =
              best === undefined
                ? null
                : strings.landing.bestScore(best.percent);
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
                  // One name in every engine: "Status codes, 12 questions",
                  // plus ", Best score: 75%" when there is one (§9.3).
                  aria-label={
                    bestText === null
                      ? `${choice.name}, ${count}`
                      : `${choice.name}, ${count}, ${bestText}`
                  }
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
                  {bestText !== null && (
                    <span className={styles.optionBest}>{bestText}</span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
        <div className={styles.start}>
          <button
            ref={placeholder ? undefined : startRef}
            type="button"
            className={common.buttonPrimary}
            disabled={placeholder || undefined}
            aria-disabled={unavailable ? true : undefined}
            aria-describedby={showHint ? `${prefix}-hint` : undefined}
            // Only while a card exists (§9.6): Start then opens the group.
            aria-expanded={!placeholder && cardShown ? showConfirm : undefined}
            aria-controls={
              !placeholder && cardShown ? `${prefix}-replace` : undefined
            }
            onClick={placeholder ? undefined : start}
          >
            {strings.landing.start}
          </button>
          {showHint && (
            <p id={`${prefix}-hint`} className={styles.hint}>
              {strings.landing.startHint}
            </p>
          )}
          {!placeholder && showConfirm && (
            // Not a modal: Escape or Cancel closes it and returns to Start.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape handler for the controls inside the group (§9.6)
            <div
              id={`${prefix}-replace`}
              role="group"
              aria-labelledby={`${prefix}-replace-msg`}
              className={styles.confirm}
              onKeyDown={onConfirmKeyDown}
            >
              <p
                id={`${prefix}-replace-msg`}
                ref={messageRef}
                tabIndex={-1}
                className={styles.confirmMessage}
              >
                {strings.landing.replaceMessage}
              </p>
              <div className={common.actions}>
                <button
                  type="button"
                  className={common.buttonPrimary}
                  aria-disabled={starting ? true : undefined}
                  onClick={confirmReplace}
                >
                  {strings.landing.replaceConfirm}
                </button>
                <button
                  type="button"
                  className={common.buttonSecondary}
                  onClick={cancelReplace}
                >
                  {strings.common.cancel}
                </button>
              </div>
            </div>
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
      {/* While the bank loads, the slot exists only when the startup decode
          found something to reserve or report; with nothing saved no notice
          can appear before the bank is ready (one status region, §5). */}
      {progress !== null &&
        (bank.status === "ready" ||
          (bank.status === "loading" && hasStartupData(progress))) && (
          <ResumeSlot
            progress={progress}
            topics={bank.status === "ready" ? bank.bank.topics : null}
            noTopics={bank.status === "ready" && choices.length === 0}
          />
        )}
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
