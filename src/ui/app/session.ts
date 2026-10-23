/**
 * App-level quiz session state (T-12; standard 8, T-09-R01 N3).
 *
 * `null` means no quiz is in progress. The reducer only wraps the pure domain
 * functions: `started` takes a quiz that the Start handler already created
 * with `createQuiz(bank, scope, randomSeed())`, so randomness stays out of the
 * reducer (standard 7); select, submit and next go to `quizReducer`.
 */
import type { Bank } from "../../content/types";
import {
  createRetryQuiz,
  missedQuestionIds,
  quizReducer,
  startSession,
  type CreateRetryQuizResult,
  type Quiz,
  type QuizAction,
  type QuizSession,
} from "../../domain";

export type SessionState = QuizSession | null;

export type SessionAction =
  | { readonly type: "started"; readonly quiz: Quiz }
  | { readonly type: "exited" }
  | QuizAction;

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "started":
      return startSession(action.quiz);
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
