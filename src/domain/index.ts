/** Public API of the pure quiz domain (T-07, T-11). */
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
export type {
  Answer,
  CreateQuizError,
  CreateQuizResult,
  EligibleTopic,
  Quiz,
  QuizAction,
  QuizOption,
  QuizPhase,
  QuizQuestion,
  QuizScope,
  QuizSession,
} from "./types";
