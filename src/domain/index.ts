/** Public API of the pure quiz domain (T-07). */
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
export type {
  CreateQuizError,
  CreateQuizResult,
  EligibleTopic,
  Quiz,
  QuizOption,
  QuizQuestion,
  QuizScope,
} from "./types";
