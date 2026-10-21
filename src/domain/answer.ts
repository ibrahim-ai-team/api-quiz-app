/**
 * Answering a quiz: select, submit and next (T-11; US-2.4, US-2.5, US-3.4,
 * FR-6, FR-9).
 *
 * Pure and immutable: every function returns a new `QuizSession` or, when the
 * call is not allowed in the current state, the same `state` object
 * unchanged (a no-op). Nothing throws. A no-op returning the identical object
 * lets React's `useReducer` skip a re-render.
 *
 * The phase machine is `answering --submit--> feedback --next--> answering`
 * (or `finished` after the last question). Because `submit` only works while
 * answering and `next` only works in feedback, a double Submit records
 * exactly 1 answer and "Submit then Next rapidly" or a double Next advances
 * exactly 1 question (US-2.5).
 */
import type {
  Answer,
  Quiz,
  QuizAction,
  QuizQuestion,
  QuizSession,
} from "./types";

/**
 * Starts a session on the first question. An empty quiz (which `createQuiz`
 * never returns) starts `finished` so callers never see a missing question.
 */
export function startSession(quiz: Quiz): QuizSession {
  return {
    quiz,
    index: 0,
    selected: null,
    answers: [],
    phase: quiz.questions.length === 0 ? "finished" : "answering",
  };
}

/** The current question, or `undefined` for an empty quiz. */
export function currentQuestion(state: QuizSession): QuizQuestion | undefined {
  return state.quiz.questions[state.index];
}

/** True when the current question is the last one ("See results", US-3.4). */
export function isLastQuestion(state: QuizSession): boolean {
  return state.index === state.quiz.questions.length - 1;
}

/** "Question `current` of `total`" (FR-5); `current` is 1-based. */
export function progress(state: QuizSession): {
  readonly current: number;
  readonly total: number;
} {
  return { current: state.index + 1, total: state.quiz.questions.length };
}

/** The locked answer for the current question, if it has been submitted. */
export function currentAnswer(state: QuizSession): Answer | undefined {
  const question = currentQuestion(state);
  if (question === undefined) return undefined;
  const answer = state.answers[state.index];
  return answer?.questionId === question.id ? answer : undefined;
}

function hasOption(question: QuizQuestion, optionId: string): boolean {
  return question.options.some((option) => option.id === optionId);
}

/**
 * Selects `optionId` for the current question. Ignored unless answering, and
 * ignored for an option ID the current question does not have. Selecting
 * the already selected option is a no-op.
 */
export function selectOption(
  state: QuizSession,
  optionId: string,
): QuizSession {
  if (state.phase !== "answering" || state.selected === optionId) return state;
  const question = currentQuestion(state);
  if (question === undefined || !hasOption(question, optionId)) return state;
  return { ...state, selected: optionId };
}

/**
 * Submits and locks the selected option (US-2.4): records exactly 1 `Answer`
 * for the current question and moves to `feedback`. A no-op when nothing is
 * selected (US-2.3), when not answering (already submitted, or finished), or
 * when the state is inconsistent (the current question already has an
 * answer, or the selection is not one of its options).
 */
export function submitAnswer(state: QuizSession): QuizSession {
  if (state.phase !== "answering" || state.selected === null) return state;
  const question = currentQuestion(state);
  if (
    question === undefined ||
    state.answers.length !== state.index ||
    !hasOption(question, state.selected)
  ) {
    return state;
  }
  const answer: Answer = {
    questionId: question.id,
    optionId: state.selected,
    correct: state.selected === question.correctOptionId,
  };
  return { ...state, answers: [...state.answers, answer], phase: "feedback" };
}

/**
 * Leaves feedback (US-3.4): advances exactly 1 question with no selection,
 * or moves to `finished` after the last question (the index stays on it).
 * A no-op in any other phase.
 */
export function next(state: QuizSession): QuizSession {
  if (state.phase !== "feedback") return state;
  if (isLastQuestion(state)) return { ...state, phase: "finished" };
  return {
    ...state,
    index: state.index + 1,
    selected: null,
    phase: "answering",
  };
}

/**
 * Reducer for the quiz flow's `useReducer` (standard 8), built only from the
 * functions above. An unknown action returns `state` unchanged.
 */
export function quizReducer(
  state: QuizSession,
  action: QuizAction,
): QuizSession {
  switch (action.type) {
    case "select":
      return selectOption(state, action.optionId);
    case "submit":
      return submitAnswer(state);
    case "next":
      return next(state);
    default:
      return state;
  }
}
