/**
 * Scoring a quiz (T-14; US-4.1, US-4.2, US-4.3, US-4.5; FR-10).
 *
 * Pure and total: never throws, no React, DOM or storage.
 *
 * Contract for an unfinished session: the score covers the answered
 * questions only (`total === answers.length`). For a `finished` session
 * that is every question, so `total === quiz.questions.length`. An empty
 * session scores 0 of 0, 0%, band `zero`. Callers that need a final result
 * check `session.phase === "finished"` first (the Results view does).
 *
 * It relies on the `QuizSession` invariant kept by `answer.ts`:
 * `answers[i]` belongs to `quiz.questions[i]`.
 */
import type { QuizSession } from "./types";

/**
 * Band message key (copy:results.band.*, US-4.2): 0%, 1-49%, 50-79%,
 * 80-99%, 100%.
 */
export type ScoreBand = "zero" | "low" | "mid" | "high" | "perfect";

export interface TopicScore {
  readonly topicId: string;
  readonly correct: number;
  readonly total: number;
}

export interface Score {
  /** Correct answers (X in "X / N"). */
  readonly correct: number;
  /** Answered questions (N in "X / N"). */
  readonly total: number;
  /** Whole-number percentage, half-up (2/3 = 67%), see `percentHalfUp`. */
  readonly percent: number;
  readonly band: ScoreBand;
  /**
   * Per-topic breakdown (US-4.3). Empty when the answered questions cover
   * fewer than 2 topics, so a single-topic quiz never shows one.
   */
  readonly byTopic: readonly TopicScore[];
}

/**
 * `correct / total` as a whole-number percentage, rounded half-up (FR-10).
 * Integer arithmetic, so .5 cases such as 1/8 = 12.5% -> 13% are exact.
 * Clamped to 1..99 unless the score is exactly 0 or `total`, so a displayed
 * 0% or 100% always matches the zero or perfect band (this can only differ
 * from plain rounding when total > 100). `total <= 0` gives 0.
 */
export function percentHalfUp(correct: number, total: number): number {
  if (total <= 0 || correct <= 0) return 0;
  if (correct >= total) return 100;
  const rounded = Math.floor((200 * correct + total) / (2 * total));
  return Math.min(Math.max(rounded, 1), 99);
}

/** Band for a percentage from `percentHalfUp` (US-4.2). */
export function bandFor(percent: number): ScoreBand {
  if (percent <= 0) return "zero";
  if (percent >= 100) return "perfect";
  if (percent >= 80) return "high";
  if (percent >= 50) return "mid";
  return "low";
}

/**
 * Scores `session`. `topicOrder` (for example the curated bank topic IDs)
 * orders the breakdown; topics not listed follow in order of first
 * appearance in the quiz.
 */
export function score(
  session: QuizSession,
  topicOrder: readonly string[] = [],
): Score {
  const { answers, quiz } = session;
  const byId = new Map<string, { correct: number; total: number }>();
  let correct = 0;
  answers.forEach((answer, i) => {
    if (answer.correct) correct += 1;
    const topicId = quiz.questions[i]?.topicId;
    if (topicId === undefined) return;
    const entry = byId.get(topicId) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (answer.correct) entry.correct += 1;
    byId.set(topicId, entry);
  });

  const total = answers.length;
  const percent = percentHalfUp(correct, total);
  const rank = (id: string) => {
    const index = topicOrder.indexOf(id);
    return index === -1 ? topicOrder.length : index;
  };
  // Map keeps first-appearance order; the sort is stable.
  const byTopic =
    byId.size < 2
      ? []
      : [...byId]
          .map(([topicId, t]) => ({ topicId, ...t }))
          .sort((a, b) => rank(a.topicId) - rank(b.topicId));
  return { correct, total, percent, band: bandFor(percent), byTopic };
}
