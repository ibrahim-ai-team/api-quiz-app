/**
 * App-level quiz session state (T-12; standard 8, T-09-R01 N3).
 *
 * `null` means no quiz is in progress. The reducer only wraps the pure domain
 * functions: `started` takes a quiz that the Start handler already created
 * with `createQuiz(bank, scope, randomSeed())`, so randomness stays out of the
 * reducer (standard 7); select, submit and next go to `quizReducer`.
 */
import {
  quizReducer,
  startSession,
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
