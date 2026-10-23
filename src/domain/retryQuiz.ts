/**
 * Retry missed questions (T-37; US-5.4, US-5.6; tech-lead proposal S3-TL01).
 *
 * Pure and deterministic like `createQuiz`: the same bank, missed IDs, seed
 * and scope always give a deep-equal quiz. Never throws.
 */
import type { Bank, BankQuestion } from "../content/types";
import { toQuizQuestion } from "./createQuiz";
import { createSeededRng } from "./rng";
import type { Answer, CreateRetryQuizResult, QuizScope } from "./types";

/**
 * IDs of the incorrectly answered questions, in quiz order. Takes anything
 * with `answers` (a `QuizSession`), relying on its invariant that
 * `answers[i]` belongs to `quiz.questions[i]`. Unanswered questions of an
 * unfinished session are not "missed". Duplicate IDs are reported once.
 */
export function missedQuestionIds(session: {
  readonly answers: readonly Answer[];
}): string[] {
  const missed: string[] = [];
  const seen = new Set<string>();
  for (const answer of session.answers) {
    if (answer.correct || seen.has(answer.questionId)) continue;
    seen.add(answer.questionId);
    missed.push(answer.questionId);
  }
  return missed;
}

/**
 * Builds a `retry-missed` quiz from `missedIds`.
 *
 * - Each ID is looked up in the current `bank`; IDs no longer in the bank
 *   are dropped (US-5.6), and repeated IDs are kept once.
 * - Questions keep the order of `missedIds`, the original quiz order
 *   (decision A1); only options are reshuffled.
 * - Single-choice options are shuffled with `createSeededRng(seed)` exactly
 *   as `createQuiz` does; true/false keeps the fixed "True, False" order.
 * - `scope` is the original quiz's scope, kept for titles and scope names.
 *
 * Returns `none-remaining` when no ID is left. Works for 1 question, and on
 * a retry quiz's own missed IDs (US-5.4). `quiz.seed` is the normalised
 * seed, so `createRetryQuiz(bank, missedIds, quiz.seed, scope)` reproduces
 * the quiz.
 */
export function createRetryQuiz(
  bank: Bank,
  missedIds: readonly string[],
  seed: number,
  scope: QuizScope,
): CreateRetryQuizResult {
  const byId = new Map<string, BankQuestion>();
  for (const question of bank.questions) byId.set(question.id, question);

  const picked: BankQuestion[] = [];
  const pickedIds = new Set<string>();
  for (const id of missedIds) {
    const question = byId.get(id);
    if (question === undefined || pickedIds.has(id)) continue;
    pickedIds.add(id);
    picked.push(question);
  }
  if (picked.length === 0) return { ok: false, error: "none-remaining" };

  const rng = createSeededRng(seed);
  return {
    ok: true,
    quiz: {
      scope:
        scope.kind === "topic"
          ? { kind: "topic", topicId: scope.topicId }
          : { kind: "mixed" },
      mode: "retry-missed",
      contentVersion: bank.contentVersion,
      seed: rng.seed,
      questions: picked.map((question) => toQuizQuestion(question, rng)),
    },
  };
}
