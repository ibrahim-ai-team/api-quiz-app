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

/** A started quiz. Question and option order are fixed at creation (FR-4). */
export interface Quiz {
  readonly scope: QuizScope;
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

/** The state of one quiz run. Always replaced, never mutated. */
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
