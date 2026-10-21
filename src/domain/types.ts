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
