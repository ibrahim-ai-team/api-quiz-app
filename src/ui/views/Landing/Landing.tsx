/**
 * Landing view (T-09, issue #29; views.md §1, §7b; US-1, US-12.1, US-12.2).
 * Topic radio group in curated order with counts, Mixed last, and Start.
 * T-13 adds the general "Report a problem" link to "About the questions".
 * T-42 adds the best score line to each row (US-6.1, views.md §9.3).
 * T-43 adds the resume slot (load notice and resume card, §9.4, §9.5) and
 * the inline replace confirmation under Start (US-6.4, §9.6). T-44 adds the
 * "Your progress" section with Reset progress (US-6.6, §9.6). T-49 adds the
 * Difficulty and Number of questions groups, filtered row counts and the
 * shortfall / none hints under Start (US-11, views.md §10.2 to §10.4).
 * Displayed names come from the bank topic objects; `topicId` from the route
 * is only compared against bank ids and never rendered (security I-3).
 */
import { useEffect, useId, useRef, useState } from "react";
import { landingReserve } from "../../../content/landingReserve";
import { BANK_DIFFICULTIES, type Difficulty } from "../../../content/types";
import {
  availableCount,
  bestFor,
  DEFAULT_QUIZ_LENGTH,
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
import { InlineConfirm } from "./InlineConfirm";
import type { LandingProgress } from "./progress";
import { ProgressSection } from "./ProgressSection";
import { reserveChoices, reserveHasSelection, type Choice } from "./reserve";
import { ResumeSlot } from "./ResumeSlot";

/** Difficulty radio value: a bank difficulty, or All (no filter). */
export type DifficultyChoice = Difficulty | "all";

/** Lengths offered by the Number of questions group (views.md §10.1 F1). */
export const QUIZ_LENGTHS = [5, 10, 20] as const;
export type QuizLength = (typeof QUIZ_LENGTHS)[number];

/**
 * Quiz settings of the page load (US-11, views.md §10.1 F6): held by App,
 * since Landing remounts on every route change; never stored.
 */
export interface QuizSettings {
  readonly difficulty: DifficultyChoice;
  readonly length: QuizLength;
}

/** The defaults reproduce the quiz from before US-11 (All, 10). */
export const DEFAULT_SETTINGS: QuizSettings = {
  difficulty: "all",
  length: DEFAULT_QUIZ_LENGTH,
};

/** The domain filter of a choice: `undefined` means All. */
export function difficultyFilter(
  choice: DifficultyChoice,
): Difficulty | undefined {
  return choice === "all" ? undefined : choice;
}

const DIFFICULTY_CHOICES: readonly DifficultyChoice[] = [
  "all",
  ...BANK_DIFFICULTIES,
];

function difficultyLabel(choice: DifficultyChoice): string {
  return choice === "all"
    ? strings.landing.difficultyAll
    : strings.landing.difficulty[choice];
}

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
   * replace confirmation, and no "Your progress" section (T-44).
   */
  readonly progress?: LandingProgress | null;
  /**
   * Difficulty and length of the page load (US-11, §10.1 F6); the quiz
   * started by `onStart` / `onReplaceStart` uses them (App holds both).
   */
  readonly settings?: QuizSettings;
  readonly onSettingsChange?: (settings: QuizSettings) => void;
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
  settings = DEFAULT_SETTINGS,
  onSettingsChange,
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
  // Bumped by each Reset progress attempt: remounts the resume slot, so its
  // discarded text goes with the cleared progress (§9.6).
  const [resets, setResets] = useState(0);
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

  const filter = difficultyFilter(settings.difficulty);
  const choices: Choice[] = [];
  if (bank.status === "ready") {
    // Rows and Mixed visibility come from the unfiltered bank; the counts
    // follow the difficulty, and a row may read "0 questions" (§10.1 F2).
    const topics = eligibleTopics(bank.bank);
    for (const topic of topics) {
      const scope: QuizScope = { kind: "topic", topicId: topic.id };
      choices.push({
        key: `t-${topic.id}`,
        scope,
        name: topic.name,
        count: availableCount(bank.bank, scope, filter),
      });
    }
    // Mixed is hidden when only 1 topic is shown (US-1.2).
    if (topics.length > 1) {
      choices.push({
        key: "mixed",
        scope: { kind: "mixed" },
        name: strings.landing.mixedLabel,
        count: availableCount(bank.bank, { kind: "mixed" }, filter),
        description: strings.landing.mixedDescription,
      });
    }
  }
  // A deep link to an unknown topic never matches, so nothing is selected.
  const selectedChoice =
    choices.find((choice) => sameScope(selected, choice.scope)) ?? null;
  const selection = selectedChoice?.scope ?? null;
  // US-11.2: no question matches the difficulty, so Start does nothing.
  const noneMatch = selectedChoice !== null && selectedChoice.count === 0;
  const unavailable = selection === null || noneMatch || starting;
  // The hint under Start, first matching row of §10.4. The shortfall is
  // stated only when a setting differs from the defaults (DQ-US11-5).
  const word =
    filter === undefined ? undefined : strings.landing.difficultyWord[filter];
  const isDefault =
    settings.difficulty === DEFAULT_SETTINGS.difficulty &&
    settings.length === DEFAULT_SETTINGS.length;
  let hint: string | null = null;
  if (selectedChoice === null) {
    hint = strings.landing.startHint;
  } else if (noneMatch) {
    // Never All: every shown row has at least 1 question unfiltered.
    hint = strings.landing.noneHint(word ?? "");
  } else if (!isDefault && selectedChoice.count < settings.length) {
    hint = strings.landing.shortHint(selectedChoice.count, word);
  }
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
    if (selection === null || noneMatch || startingRef.current) return;
    if (cardShown) {
      setConfirming(true);
      setConfirmFocus((n) => n + 1);
      return;
    }
    launch(selection, onStart);
  };
  const confirmReplace = () => {
    if (
      selection === null ||
      noneMatch ||
      startingRef.current ||
      progress === null
    ) {
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
  const resetProgress = (): boolean => {
    if (progress === null) return false;
    setConfirming(false);
    setResets((n) => n + 1);
    return progress.onReset();
  };

  /**
   * One settings group (§10.3): native radios in chip labels. The reserve
   * copy shows the defaults, disabled, with no handlers.
   */
  const settingsGroup = <T extends string | number>(
    prefix: string,
    legend: string,
    values: readonly T[],
    current: T,
    label: (value: T) => string,
    onPick: (value: T) => void,
    placeholder: boolean,
  ) => (
    <fieldset
      className={[styles.group, styles.settings].join(" ")}
      disabled={placeholder || undefined}
    >
      <legend className={styles.legend}>{legend}</legend>
      {values.map((value) => (
        <label key={String(value)} className={styles.chip}>
          <input
            type="radio"
            name={prefix}
            className={styles.radio}
            checked={value === current}
            onChange={() => {
              if (placeholder) return;
              onPick(value);
              setFailed(false);
            }}
          />
          <span>{label(value)}</span>
        </label>
      ))}
    </fieldset>
  );

  /**
   * The topic group, the two settings groups (US-11, §10.2) and Start.
   * `placeholder` renders the same markup with stand-in rows and the default
   * settings for the loading reserve: no handlers, no ids shared with the
   * live group, and every control disabled.
   */
  const topicGroup = (list: readonly Choice[], placeholder: boolean) => {
    const prefix = placeholder ? `${id}-reserve` : id;
    // The reserve shows the defaults, so only the "choose a topic" hint can
    // appear in it (§10.3: the shortfall hint is not reserved).
    const shown = placeholder ? DEFAULT_SETTINGS : settings;
    const hintText = placeholder
      ? reserveHasSelection(landingReserve, selected)
        ? null
        : strings.landing.startHint
      : hint;
    const showHint = hintText !== null;
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
        {settingsGroup(
          `${prefix}-difficulty`,
          strings.landing.difficultyLegend,
          DIFFICULTY_CHOICES,
          shown.difficulty,
          difficultyLabel,
          (difficulty) => onSettingsChange?.({ ...settings, difficulty }),
          placeholder,
        )}
        {settingsGroup(
          `${prefix}-length`,
          strings.landing.lengthLegend,
          QUIZ_LENGTHS,
          shown.length,
          String,
          (length) => onSettingsChange?.({ ...settings, length }),
          placeholder,
        )}
        <div className={styles.start}>
          <button
            ref={placeholder ? undefined : startRef}
            type="button"
            className={common.buttonPrimary}
            disabled={placeholder || undefined}
            aria-disabled={unavailable ? true : undefined}
            aria-describedby={showHint ? `${prefix}-hint` : undefined}
            // Only while a card exists (§9.6): Start then opens the group;
            // aria-controls only while the group is open (T-44-TL01 F2).
            aria-expanded={!placeholder && cardShown ? showConfirm : undefined}
            aria-controls={
              !placeholder && showConfirm ? `${prefix}-replace` : undefined
            }
            onClick={placeholder ? undefined : start}
          >
            {strings.landing.start}
          </button>
          {showHint && (
            <p id={`${prefix}-hint`} className={styles.hint}>
              {hintText}
            </p>
          )}
          {!placeholder && showConfirm && (
            <InlineConfirm
              id={`${prefix}-replace`}
              message={strings.landing.replaceMessage}
              confirmLabel={strings.landing.replaceConfirm}
              onConfirm={confirmReplace}
              onCancel={cancelReplace}
              busy={starting}
              messageRef={messageRef}
            />
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
            key={resets}
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
      {/* Last in main; with the topic group, never while loading (§9.2). */}
      {progress !== null && bank.status === "ready" && (
        <ProgressSection onReset={resetProgress} />
      )}
    </>
  );
}
