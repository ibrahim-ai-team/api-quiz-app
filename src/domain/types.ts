/**
 * Quiz domain types (T-07; FR-2..FR-5). Pure TypeScript: derived from the
 * content types in `src/content/types.ts`, no React, DOM or storage.
 * T-11 adds answer state to this file (serial after T-07).
 */
import type { Difficulty, QuestionType } from "../content/types";

/** What the user chose to practise. */
export type QuizScope =
  | { readonly kind: "topic"; readonly topicId: string }
  | { readonly kind: "mixed" };

export interface QuizOption {
  readonly id: string;
  readonly text: string;
}

/** A bank question as presented in one quiz: options in display order. */
export interface QuizQuestion {
  readonly id: string;
  readonly topicId: string;
  readonly type: QuestionType;
  readonly difficulty: Difficulty;
  readonly prompt: string;
  /** Display order, fixed at quiz start (US-2.2). */
  readonly options: readonly QuizOption[];
  readonly correctOptionId: string;
  readonly explanation: string;
  readonly sourceUrl: string;
}

/**
 * How a quiz was built (US-5): `normal` from `createQuiz`, `retry-missed`
 * from `createRetryQuiz` (only the questions missed in an earlier run).
 */
export type QuizMode = "normal" | "retry-missed";

/** A started quiz. Question and option order are fixed at creation (FR-4). */
export interface Quiz {
  /**
   * The scope the user originally chose. A retry quiz keeps the scope of
   * the quiz it retries, so titles and scope names are unchanged.
   */
  readonly scope: QuizScope;
  readonly mode: QuizMode;
  /**
   * `contentVersion` of the bank the quiz was built from. After a restore it
   * is the SAVED value, i.e. untrusted storage data (SEC-R13 finding 2): it
   * may be compared with `bank.contentVersion`, but report links, titles and
   * any other output must use `bank.contentVersion`, never this field.
   */
  readonly contentVersion: string;
  /** Unsigned 32-bit seed that reproduces this quiz from the same bank. */
  readonly seed: number;
  readonly questions: readonly QuizQuestion[];
}

/** A topic that can be offered on the landing page (US-1.1, US-1.2). */
export interface EligibleTopic {
  readonly id: string;
  readonly name: string;
  /** Number of eligible questions; always >= 1. */
  readonly count: number;
}

export type CreateQuizError = "unknown-topic" | "empty-topic" | "empty-bank";

export type CreateQuizResult =
  | { readonly ok: true; readonly quiz: Quiz }
  | { readonly ok: false; readonly error: CreateQuizError };

/** `none-remaining`: no missed question still exists in the bank (US-5.6). */
export type CreateRetryQuizError = "none-remaining";

export type CreateRetryQuizResult =
  | { readonly ok: true; readonly quiz: Quiz }
  | { readonly ok: false; readonly error: CreateRetryQuizError };

/*
 * Answer state (T-11; US-2.4, US-2.5, US-3.4, FR-6, FR-9). Consumed by the
 * quiz-flow reducer (standard 8), scoring (T-14), review/retry (US-5) and
 * resume (US-6).
 */

/** One submitted, locked answer. */
export interface Answer {
  readonly questionId: string;
  readonly optionId: string;
  /** `optionId === question.correctOptionId` at submit time. */
  readonly correct: boolean;
}

/**
 * - `answering`: the current question is open; an option may be selected.
 * - `feedback`: the current question was submitted and its answer is locked.
 * - `finished`: every question has been answered (results, US-4).
 */
export type QuizPhase = "answering" | "feedback" | "finished";

/**
 * The state of one quiz run. Always replaced, never mutated.
 *
 * Invariants maintained by `src/domain/answer.ts`, with
 * N = `quiz.questions.length`:
 * - `answering`: `answers.length === index`.
 * - `feedback`: `answers.length === index + 1` and
 *   `selected === answers[index].optionId`.
 * - `finished`: `answers.length === N` and `index === max(0, N - 1)`.
 */
export interface QuizSession {
  readonly quiz: Quiz;
  /**
   * Index of the current question, 0-based. When `phase` is `finished` it
   * stays on the last question (or 0 for an empty quiz).
   */
  readonly index: number;
  /**
   * Option chosen for the current question. While answering it may change;
   * in `feedback` it equals the locked answer's option. Reset on `next`.
   */
  readonly selected: string | null;
  /**
   * Submitted answers in question order: `answers[i]` belongs to
   * `quiz.questions[i]`, so `answers.length` is the number answered.
   */
  readonly answers: readonly Answer[];
  readonly phase: QuizPhase;
}

/** Actions for the UI's `useReducer` (standard 8). */
export type QuizAction =
  | { readonly type: "select"; readonly optionId: string }
  | { readonly type: "submit" }
  | { readonly type: "next" };

/*
 * Saved progress (T-41; US-6, US-6.8; tech-lead proposal S3-TL01). Plain data
 * that `src/storage` encodes as JSON. Only IDs, scores, versions and
 * timestamps are stored: no question text, no `correct` flags (they are
 * recomputed from the current bank on restore). Timestamps are epoch
 * milliseconds (integers), not ISO strings: smaller and trivially validated.
 */

/** One locked answer as saved: question ID `q`, chosen option ID `o`. */
export interface SavedAnswer {
  readonly q: string;
  readonly o: string;
}

/**
 * An in-progress quiz as saved under `apiquiz:v1:session`. Built by
 * `toSavedSession` and rebuilt by `restoreQuiz` (`src/domain/restore.ts`).
 * `optionOrder[i]` is the display order of the options of `questionIds[i]`;
 * `answers[i]` belongs to `questionIds[i]`.
 */
export interface SavedSession {
  readonly schemaVersion: 1;
  readonly contentVersion: string;
  readonly mode: QuizMode;
  readonly scope: QuizScope;
  readonly seed: number;
  readonly questionIds: readonly string[];
  readonly optionOrder: readonly (readonly string[])[];
  readonly answers: readonly SavedAnswer[];
  /** Current question index, 0-based. */
  readonly index: number;
  /** Epoch milliseconds when the session was saved. */
  readonly savedAt: number;
}

/** One best score (US-6.1): `percent` is `percentHalfUp(correct, total)`. */
export interface BestScore {
  readonly percent: number;
  readonly correct: number;
  readonly total: number;
  /** Epoch milliseconds when the score was achieved. */
  readonly at: number;
}

/**
 * Best scores keyed by topic ID or `"mixed"`, as saved under
 * `apiquiz:v1:best`. Decoded values are null-prototype objects; look keys up
 * with `Object.hasOwn`.
 */
export interface SavedBest {
  readonly schemaVersion: 1;
  readonly scores: Readonly<Record<string, BestScore>>;
}

/**
 * `stale`: the saved session no longer matches the bank (a question, option
 * or topic is gone, an option set changed, or, for the same
 * `contentVersion`, the order does not reproduce from the seed), or its
 * index/answers are inconsistent. The caller discards it (FR-20).
 */
export type RestoreQuizResult =
  | {
      readonly ok: true;
      readonly session: QuizSession;
      /** True when the saved `contentVersion` differs from the bank's (A4). */
      readonly contentChanged: boolean;
    }
  | { readonly ok: false; readonly reason: "stale" };
