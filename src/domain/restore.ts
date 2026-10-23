/**
 * Saving and restoring an in-progress quiz (T-41; US-6, US-6.8, FR-20;
 * tech-lead proposal S3-TL01, decision A4).
 *
 * Pure and total: never throws, no storage, DOM or React. `src/storage`
 * encodes/decodes `SavedSession` JSON and calls `isConsistentSavedSession`;
 * this module only maps between a `QuizSession` and its saved form.
 *
 * Restore rules:
 * - Every saved question ID must exist in the bank, and each saved option
 *   order must be a permutation of exactly that question's current option
 *   IDs. A topic scope must name a bank topic that every question still
 *   belongs to. Otherwise the result is `stale`.
 * - Same `contentVersion`: the saved question and option order must also be
 *   exactly what `createQuiz` / `createRetryQuiz` give for the saved seed, so
 *   a tampered or reordered session is `stale`.
 * - Different `contentVersion` (decision A4): restored when the rules in the
 *   first point hold; `correct` flags and the correct option are recomputed
 *   from the current bank. The restored quiz keeps the saved
 *   `contentVersion` (the bank it was built from), so saving it again and
 *   restoring takes this same path instead of failing the seed check.
 *   `contentChanged` tells the caller this happened.
 * - Question/option text, explanations and sources always come from the
 *   current bank.
 *
 * Phase: `answers.length === index` restores `answering` (no selection; a
 * pending selection is not saved), `answers.length === index + 1` restores
 * `feedback` on that locked answer. A finished session saves as all answers
 * with the last index and therefore restores as `feedback` on the last
 * question; callers should clear the saved session when a quiz finishes.
 */
import type { Bank, BankQuestion } from "../content/types";
import { createQuiz } from "./createQuiz";
import { createRetryQuiz } from "./retryQuiz";
import type {
  Answer,
  CreateQuizResult,
  CreateRetryQuizResult,
  Quiz,
  QuizQuestion,
  QuizSession,
  RestoreQuizResult,
  SavedSession,
} from "./types";

export const SAVED_SESSION_SCHEMA_VERSION = 1;

/** Seeds are unsigned 32-bit integers (`normaliseSeed`). */
const MAX_SEED = 0xffffffff;

const STALE: RestoreQuizResult = Object.freeze({
  ok: false,
  reason: "stale",
});

function hasDistinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

/**
 * Internal consistency of a saved session, independent of any bank: at least
 * 1 question, an unsigned 32-bit integer seed, distinct question IDs, one option order (>= 2 distinct IDs)
 * per question, `0 <= index < N`, `answers.length` is `index` or `index + 1`,
 * and `answers[i]` names `questionIds[i]` and one of its options.
 */
export function isConsistentSavedSession(saved: SavedSession): boolean {
  const { questionIds, optionOrder, answers, index, seed } = saved;
  const n = questionIds.length;
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) return false;
  if (n === 0 || optionOrder.length !== n || !hasDistinct(questionIds)) {
    return false;
  }
  if (!Number.isInteger(index) || index < 0 || index >= n) return false;
  if (answers.length !== index && answers.length !== index + 1) return false;
  if (!optionOrder.every((ids) => ids.length >= 2 && hasDistinct(ids))) {
    return false;
  }
  return answers.every(
    (answer, i) =>
      answer.q === questionIds[i] &&
      optionOrder[i]?.includes(answer.o) === true,
  );
}

/**
 * The saved form of `session` (inverse of `restoreQuiz`). `savedAt` is epoch
 * milliseconds, injected so the domain stays pure. Correct flags, the
 * selection and all text are dropped.
 */
export function toSavedSession(
  session: QuizSession,
  savedAt: number,
): SavedSession {
  const { quiz } = session;
  return {
    schemaVersion: SAVED_SESSION_SCHEMA_VERSION,
    contentVersion: quiz.contentVersion,
    mode: quiz.mode,
    scope:
      quiz.scope.kind === "topic"
        ? { kind: "topic", topicId: quiz.scope.topicId }
        : { kind: "mixed" },
    seed: quiz.seed,
    questionIds: quiz.questions.map((q) => q.id),
    optionOrder: quiz.questions.map((q) => q.options.map((o) => o.id)),
    answers: session.answers.map((a) => ({ q: a.questionId, o: a.optionId })),
    index: session.index,
    savedAt,
  };
}

function sameOrder(quiz: Quiz, saved: SavedSession): boolean {
  if (quiz.questions.length !== saved.questionIds.length) return false;
  return quiz.questions.every((question, i) => {
    const order = saved.optionOrder[i] ?? [];
    return (
      question.id === saved.questionIds[i] &&
      question.options.length === order.length &&
      question.options.every((option, j) => option.id === order[j])
    );
  });
}

/** True when the saved order is what the quiz builders give for its seed. */
function reproducesFromSeed(bank: Bank, saved: SavedSession): boolean {
  const rebuilt: CreateQuizResult | CreateRetryQuizResult =
    saved.mode === "normal"
      ? createQuiz(bank, saved.scope, saved.seed, saved.questionIds.length)
      : createRetryQuiz(bank, saved.questionIds, saved.seed, saved.scope);
  return rebuilt.ok && sameOrder(rebuilt.quiz, saved);
}

function toRestoredQuestion(
  question: BankQuestion,
  order: readonly string[],
): QuizQuestion | undefined {
  if (order.length !== question.options.length) return undefined;
  const options = [];
  for (const id of order) {
    const option = question.options.find((o) => o.id === id);
    if (option === undefined) return undefined;
    options.push({ id: option.id, text: option.text });
  }
  return {
    id: question.id,
    topicId: question.topic,
    type: question.type,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options,
    correctOptionId: question.correct,
    explanation: question.explanation,
    sourceUrl: question.sourceUrl,
  };
}

/**
 * Rebuilds the saved `QuizSession` against the current `bank` (assumed to
 * have passed `isBank`), or returns `stale`. See the module comment for the
 * rules. Never throws and never returns a partially restored session.
 */
export function restoreQuiz(
  bank: Bank,
  saved: SavedSession,
): RestoreQuizResult {
  if (!isConsistentSavedSession(saved)) return STALE;
  const { scope } = saved;
  if (
    scope.kind === "topic" &&
    !bank.topics.some((topic) => topic.id === scope.topicId)
  ) {
    return STALE;
  }

  const byId = new Map<string, BankQuestion>();
  for (const question of bank.questions) byId.set(question.id, question);

  const questions: QuizQuestion[] = [];
  for (const [i, id] of saved.questionIds.entries()) {
    const bankQuestion = byId.get(id);
    const order = saved.optionOrder[i];
    if (bankQuestion === undefined || order === undefined) return STALE;
    if (scope.kind === "topic" && bankQuestion.topic !== scope.topicId) {
      return STALE;
    }
    const question = toRestoredQuestion(bankQuestion, order);
    if (question === undefined) return STALE;
    questions.push(question);
  }

  const contentChanged = saved.contentVersion !== bank.contentVersion;
  if (!contentChanged && !reproducesFromSeed(bank, saved)) return STALE;

  const answers: Answer[] = saved.answers.map((answer, i) => ({
    questionId: answer.q,
    optionId: answer.o,
    correct: answer.o === questions[i]?.correctOptionId,
  }));
  const locked = answers[saved.index];

  const session: QuizSession = {
    quiz: {
      scope:
        scope.kind === "topic"
          ? { kind: "topic", topicId: scope.topicId }
          : { kind: "mixed" },
      mode: saved.mode,
      contentVersion: saved.contentVersion,
      seed: saved.seed,
      questions,
    },
    index: saved.index,
    selected: locked === undefined ? null : locked.optionId,
    answers,
    phase: locked === undefined ? "answering" : "feedback",
  };
  return { ok: true, session, contentChanged };
}
