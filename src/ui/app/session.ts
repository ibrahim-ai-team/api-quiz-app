/**
 * App-level quiz session state (T-12; standard 8, T-09-R01 N3).
 *
 * `null` means no quiz is in progress. The reducer only wraps the pure domain
 * functions: `started` takes a quiz that the Start handler already created
 * with `createQuiz(bank, scope, randomSeed())`, so randomness stays out of the
 * reducer (standard 7); select, submit and next go to `quizReducer`.
 * T-43 adds `restored` (Resume, US-6.2) and the saved-session helpers that
 * read, validate and write `apiquiz:v1:session` (views.md §9.2, §9.4, §9.5).
 */
import type { Bank } from "../../content/types";
import {
  createRetryQuiz,
  eligibleTopics,
  missedQuestionIds,
  quizReducer,
  restoreQuiz,
  startSession,
  toSavedSession,
  type CreateRetryQuizResult,
  type Quiz,
  type QuizAction,
  type QuizSession,
  type RestoreQuizResult,
  type SavedBest,
  type SavedSession,
} from "../../domain";
import {
  decodeBest,
  decodeSession,
  encodeSession,
  KEYS,
  type DecodeResult,
  type ProgressStore,
} from "../../storage";

export type SessionState = QuizSession | null;

export type SessionAction =
  | { readonly type: "started"; readonly quiz: Quiz }
  /** Resume (US-6.2): a session rebuilt by `restoreQuiz`, used as is. */
  | { readonly type: "restored"; readonly session: QuizSession }
  | { readonly type: "exited" }
  | QuizAction;

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "started":
      return startSession(action.quiz);
    case "restored":
      return action.session;
    case "exited":
      return null;
    default:
      // No quiz: select/submit/next are ignored (same object, no re-render).
      return state === null ? state : quizReducer(state, action);
  }
}

/**
 * Retry missed (US-5.4, US-5.6; views.md §8.4, §8.5): a `retry-missed` quiz
 * of `session`'s incorrectly answered questions that are still in `bank`,
 * keeping the original scope. The Results label and the started quiz both
 * come from this function, so they cannot differ.
 */
export function buildRetryQuiz(
  bank: Bank,
  session: QuizSession,
  seed: number,
): CreateRetryQuizResult {
  return createRetryQuiz(
    bank,
    missedQuestionIds(session),
    seed,
    session.quiz.scope,
  );
}

/** Missed questions of a run, and how many are still in the current bank. */
export interface RetryAvailability {
  readonly missed: number;
  readonly available: number;
}

/**
 * Computed when Results renders (views.md §8.5), with the same function as
 * the Retry handler. The seed only shuffles options, so any value works.
 */
export function retryAvailability(
  bank: Bank,
  session: QuizSession,
): RetryAvailability {
  const missed = missedQuestionIds(session).length;
  if (missed === 0) return { missed, available: 0 };
  const result = buildRetryQuiz(bank, session, 0);
  return { missed, available: result.ok ? result.quiz.questions.length : 0 };
}

/*
 * Saved progress (T-43; US-6.2, US-6.3, US-6.5; views.md §9.2, §9.4, §9.5).
 * Storage is only touched through the injected `ProgressStore` (ADR-0001).
 */

/**
 * Decode failures that mean "unusable saved data": removed and reported by
 * the load notice. `absent` and `too-large` (read as absent by the store,
 * F8) are neither removed nor reported.
 */
function isUnusable<T>(result: DecodeResult<T>): boolean {
  return (
    !result.ok &&
    (result.reason === "corrupt" || result.reason === "unknown-version")
  );
}

/** What the app knows about saved progress before its first render. */
export interface StartupProgress {
  /** Decoded best scores, or null (none, unusable, or not persistent). */
  readonly best: SavedBest | null;
  /** The stored best value failed to decode: remove it and say so. */
  readonly bestRemoved: boolean;
  /** Decoded saved quiz, not yet checked against the bank. */
  readonly saved: SavedSession | null;
  /** The stored quiz failed to decode: remove it and say so. */
  readonly sessionRemoved: boolean;
}

const NOTHING_SAVED: StartupProgress = Object.freeze({
  best: null,
  bestRemoved: false,
  saved: null,
  sessionRemoved: false,
});

/**
 * Synchronous startup decode of both keys (views.md §9.2 CLS: everything is
 * sized from this before the first render). Never throws; nothing is read
 * when storage is not persistent (U2). Does not write: the caller removes
 * the unusable keys after mount.
 */
export function readStartupProgress(store: ProgressStore): StartupProgress {
  if (!store.persistent) return NOTHING_SAVED;
  const best = decodeBest(store.get(KEYS.best));
  const session = decodeSession(store.get(KEYS.session));
  return {
    best: best.ok ? best.value : null,
    bestRemoved: isUnusable(best),
    saved: session.ok ? session.value : null,
    sessionRemoved: isUnusable(session),
  };
}

/** The saved quiz as stored now (Landing re-reads it when shown, U9). */
export function readSavedSession(store: ProgressStore): SavedSession | null {
  if (!store.persistent) return null;
  const decoded = decodeSession(store.get(KEYS.session));
  return decoded.ok ? decoded.value : null;
}

/**
 * `restoreQuiz` against the ready bank, or null when no restore is tried:
 * a bank with no playable topic keeps the saved quiz untouched (views.md
 * §9.2 "No topics"). An unexpected throw counts as stale (§9.5).
 */
export function checkSavedSession(
  bank: Bank,
  saved: SavedSession,
): RestoreQuizResult | null {
  if (eligibleTopics(bank).length === 0) return null;
  try {
    return restoreQuiz(bank, saved);
  } catch {
    return { ok: false, reason: "stale" };
  }
}

/**
 * FR-15: called after every Submit and Next. A quiz with no locked answer is
 * not saved (it is saved from its first Submit, views.md §9.6); a finished
 * quiz is removed (SEC-R13 finding 3). A failed write is followed by a
 * best-effort remove, so an older position is never offered (U2, F5).
 */
export function persistSession(
  store: ProgressStore,
  session: QuizSession,
  now: number,
): void {
  if (!store.persistent) return;
  if (session.phase === "finished") {
    store.remove(KEYS.session);
    return;
  }
  if (session.answers.length === 0) return;
  const written = store.set(
    KEYS.session,
    encodeSession(toSavedSession(session, now)),
  );
  if (!written.ok) store.remove(KEYS.session);
}
