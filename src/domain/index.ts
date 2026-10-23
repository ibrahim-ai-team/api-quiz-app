/** Public API of the pure quiz domain (T-07, T-11, T-37, T-41). */
export {
  createSeededRng,
  normaliseSeed,
  randomSeed,
  shuffle,
  type Rng,
} from "./rng";
export {
  createQuiz,
  DEFAULT_QUIZ_LENGTH,
  eligibleTopics,
  MIXED_MIN_TOPICS,
} from "./createQuiz";
export { createRetryQuiz, missedQuestionIds } from "./retryQuiz";
export {
  currentAnswer,
  currentQuestion,
  isLastQuestion,
  next,
  progress,
  quizReducer,
  selectOption,
  startSession,
  submitAnswer,
} from "./answer";
export {
  isConsistentSavedSession,
  restoreQuiz,
  SAVED_SESSION_SCHEMA_VERSION,
  toSavedSession,
} from "./restore";
export {
  bandFor,
  percentHalfUp,
  score,
  type Score,
  type ScoreBand,
  type TopicScore,
} from "./score";
export type {
  Answer,
  BestScore,
  CreateQuizError,
  CreateQuizResult,
  CreateRetryQuizError,
  CreateRetryQuizResult,
  EligibleTopic,
  Quiz,
  QuizAction,
  QuizMode,
  QuizOption,
  QuizPhase,
  QuizQuestion,
  QuizScope,
  QuizSession,
  RestoreQuizResult,
  SavedAnswer,
  SavedBest,
  SavedSession,
} from "./types";
