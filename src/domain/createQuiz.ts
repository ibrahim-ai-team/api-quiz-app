/**
 * Quiz creation (T-07; US-1.3, US-1.4, US-1.5, US-2.2; FR-2..FR-5).
 *
 * Pure and deterministic: the same bank, scope, seed and length always give
 * a deep-equal quiz. All randomness comes from a mulberry32 `Rng` built from
 * the seed, and `quiz.seed` reproduces the quiz.
 * Never throws; invalid requests return an error result.
 *
 * The bank is assumed to have passed `isBank` (every question names a known
 * topic, IDs are unique). A production bank holds only `reviewed` questions,
 * so every question in it is eligible.
 */
import type { Bank, BankOption, BankQuestion } from "../content/types";
import { createSeededRng, shuffle, type Rng } from "./rng";
import type {
  CreateQuizResult,
  EligibleTopic,
  QuizOption,
  QuizQuestion,
  QuizScope,
} from "./types";

/**
 * Default number of questions per quiz (FR-2, FR-3); callers may pass another
 * positive integer.
 */
export const DEFAULT_QUIZ_LENGTH = 10;

/** Mixed quizzes span at least this many topics where possible (US-1.4). */
export const MIXED_MIN_TOPICS = 3;

/** Fixed display order of true/false options: "True, False" (US-2.2). */
const TRUE_FALSE_ORDER: readonly string[] = ["true", "false"];

/**
 * Topics in curated bank order that have at least 1 question, with their
 * question counts. Topics with 0 questions are omitted (US-1.2).
 */
export function eligibleTopics(bank: Bank): EligibleTopic[] {
  const counts = new Map<string, number>();
  for (const question of bank.questions) {
    counts.set(question.topic, (counts.get(question.topic) ?? 0) + 1);
  }
  const result: EligibleTopic[] = [];
  for (const topic of bank.topics) {
    const count = counts.get(topic.id) ?? 0;
    if (count > 0) result.push({ id: topic.id, name: topic.name, count });
  }
  return result;
}

function toQuizOption(option: BankOption): QuizOption {
  return { id: option.id, text: option.text };
}

function trueFalseRank(option: BankOption): number {
  const rank = TRUE_FALSE_ORDER.indexOf(option.id);
  return rank === -1 ? TRUE_FALSE_ORDER.length : rank;
}

/**
 * Single-choice options are shuffled once with `rng`. True/false options are
 * never shuffled and are put in the canonical "true", "false" order without
 * consuming randomness.
 */
function toQuizQuestion(question: BankQuestion, rng: Rng): QuizQuestion {
  const options =
    question.type === "true-false"
      ? question.options
          .slice()
          .sort((a, b) => trueFalseRank(a) - trueFalseRank(b))
      : shuffle(question.options, rng);
  return {
    id: question.id,
    topicId: question.topic,
    type: question.type,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options: options.map(toQuizOption),
    correctOptionId: question.correct,
    explanation: question.explanation,
    sourceUrl: question.sourceUrl,
  };
}

/**
 * Mixed draw of `n` distinct questions spanning at least
 * min(MIXED_MIN_TOPICS, shown topics, n) topics: one random question from
 * each of k randomly chosen topics, then the rest from the remaining pool.
 * The caller shuffles the final list.
 *
 * By design the spread topics are chosen with equal weight, not in
 * proportion to their size, so small topics are over-represented compared
 * with a uniform draw from the whole pool. This is what guarantees the
 * topic spread (US-1.4).
 */
function drawMixed(
  questions: readonly BankQuestion[],
  topicIds: readonly string[],
  n: number,
  rng: Rng,
): BankQuestion[] {
  const k = Math.min(MIXED_MIN_TOPICS, topicIds.length, n);
  const spreadTopics = shuffle(topicIds, rng).slice(0, k);
  const picked: BankQuestion[] = [];
  const pickedIds = new Set<string>();
  for (const topicId of spreadTopics) {
    const inTopic = questions.filter((q) => q.topic === topicId);
    const [choice] = shuffle(inTopic, rng);
    // Every shown topic has >= 1 question, so `choice` is always defined.
    if (choice !== undefined) {
      picked.push(choice);
      pickedIds.add(choice.id);
    }
  }
  const rest = shuffle(
    questions.filter((q) => !pickedIds.has(q.id)),
    rng,
  ).slice(0, n - picked.length);
  return [...picked, ...rest];
}

function normaliseLength(length: number): number {
  return Number.isInteger(length) && length > 0 ? length : DEFAULT_QUIZ_LENGTH;
}

/**
 * Creates a quiz for `scope`.
 *
 * - Topic: N = min(length, topic count) distinct questions from that topic.
 * - Mixed: N = min(length, total count) distinct questions from at least
 *   min(3, shown topics) topics when N allows it (otherwise N topics).
 *
 * Question order and single-choice option order come from a seeded `Rng`
 * built with `createSeededRng(seed)` and are fixed in the returned quiz.
 * `quiz.seed` is the normalised (unsigned 32-bit) seed, so
 * `createQuiz(bank, scope, quiz.seed, length)` reproduces the quiz. A `length` that is not a positive integer falls
 * back to `DEFAULT_QUIZ_LENGTH`.
 */
export function createQuiz(
  bank: Bank,
  scope: QuizScope,
  seed: number,
  length: number = DEFAULT_QUIZ_LENGTH,
): CreateQuizResult {
  const rng = createSeededRng(seed);
  const cap = normaliseLength(length);
  const shown = eligibleTopics(bank);
  const shownIds = new Set(shown.map((topic) => topic.id));
  const pool = bank.questions.filter((q) => shownIds.has(q.topic));

  let drawn: BankQuestion[];
  if (scope.kind === "topic") {
    if (!bank.topics.some((topic) => topic.id === scope.topicId)) {
      return { ok: false, error: "unknown-topic" };
    }
    const inTopic = pool.filter((q) => q.topic === scope.topicId);
    if (inTopic.length === 0) return { ok: false, error: "empty-topic" };
    drawn = shuffle(inTopic, rng).slice(0, Math.min(cap, inTopic.length));
  } else {
    if (pool.length === 0) return { ok: false, error: "empty-bank" };
    const n = Math.min(cap, pool.length);
    drawn = shuffle(
      drawMixed(
        pool,
        shown.map((topic) => topic.id),
        n,
        rng,
      ),
      rng,
    );
  }

  return {
    ok: true,
    quiz: {
      scope:
        scope.kind === "topic"
          ? { kind: "topic", topicId: scope.topicId }
          : { kind: "mixed" },
      seed: rng.seed,
      questions: drawn.map((question) => toQuizQuestion(question, rng)),
    },
  };
}
