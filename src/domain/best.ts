/**
 * Best score per topic and Mixed (T-42; US-6.1, US-5.5; views.md §9.3;
 * tech-lead review US6-UX-TL01). Pure: no React, DOM or storage. The storage
 * codec (`src/storage/codec/best.ts`) re-exports `MIXED_BEST_KEY` from here,
 * so the domain never imports storage.
 */
import type { Bank } from "../content/types";
import { availableCount, DEFAULT_QUIZ_LENGTH } from "./createQuiz";
import type { Score } from "./score";
import type { BestScore, Quiz, QuizScope, SavedBest } from "./types";

/** Key of the Mixed best score in `SavedBest.scores`. */
export const MIXED_BEST_KEY = "mixed";

/** `SavedBest.schemaVersion` written by `updateBest`. */
const BEST_SCHEMA_VERSION = 1;

/** The `SavedBest.scores` key for `scope`: its topic ID, or `"mixed"`. */
export function bestKeyFor(scope: QuizScope): string {
  return scope.kind === "topic" ? scope.topicId : MIXED_BEST_KEY;
}

/** The best score stored for `scope`, if any (own keys only). */
export function bestFor(
  scores: Readonly<Record<string, BestScore>>,
  scope: QuizScope,
): BestScore | undefined {
  const key = bestKeyFor(scope);
  return Object.hasOwn(scores, key) ? scores[key] : undefined;
}

/**
 * Whether a finished quiz may update the best score (US-5.5, SEC-R13): only
 * a normal quiz built from the bank that is loaded now. A retry-missed quiz,
 * or a quiz restored from a save made with another `contentVersion`, never
 * counts.
 */
export function countsTowardBest(
  quiz: Quiz,
  bankContentVersion: string,
): boolean {
  return quiz.mode === "normal" && quiz.contentVersion === bankContentVersion;
}

/**
 * Whether `quiz` is unfiltered and full length (US-11 F5; views.md §10.1):
 * no difficulty filter, and at least as many questions as a default quiz of
 * its scope would have, min(DEFAULT_QUIZ_LENGTH, questions in the scope).
 * The caller combines it with `countsTowardBest` before updating the best
 * score.
 */
export function isFullQuiz(quiz: Quiz, bank: Bank): boolean {
  return (
    quiz.difficulty === undefined &&
    quiz.questions.length >=
      Math.min(DEFAULT_QUIZ_LENGTH, availableCount(bank, quiz.scope))
  );
}

/**
 * Returns best scores with `score` recorded for `scope`, achieved at `at`
 * (epoch milliseconds). A strictly higher percentage replaces the stored
 * one; an equal or lower one keeps it. A score of 0 questions is never
 * recorded. Never changes `best`; the returned `scores` is a null-prototype
 * object, like decoded values.
 */
export function updateBest(
  best: SavedBest | null,
  scope: QuizScope,
  score: Score,
  at: number,
): SavedBest {
  const scores = Object.create(null) as Record<string, BestScore>;
  if (best !== null) {
    for (const [key, value] of Object.entries(best.scores)) {
      scores[key] = value;
    }
  }
  const key = bestKeyFor(scope);
  const previous = Object.hasOwn(scores, key) ? scores[key] : undefined;
  if (
    score.total > 0 &&
    (previous === undefined || score.percent > previous.percent)
  ) {
    scores[key] = {
      percent: score.percent,
      correct: score.correct,
      total: score.total,
      at,
    };
  }
  return { schemaVersion: BEST_SCHEMA_VERSION, scores };
}
