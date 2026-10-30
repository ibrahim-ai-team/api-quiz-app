/**
 * Saved-progress props of Landing (T-43; US-6.2 to US-6.4; views.md §9).
 * Landing receives these only when storage is persistent (U2); `null`
 * renders Landing exactly as without progress features.
 */
import type { QuizScope, QuizSession, SavedSession } from "../../../domain";

/** Startup decode used to size the resume slot (views.md §9.2 CLS). */
export interface LandingReserveProgress {
  /** Decoded saved quiz (not yet checked against the bank), or null. */
  readonly saved: SavedSession | null;
  /** The saved quiz failed to decode (corrupt or unknown version). */
  readonly sessionFailed: boolean;
  /** The best scores failed to decode (corrupt or unknown version). */
  readonly bestFailed: boolean;
}

export interface LandingProgress {
  /** Restorable quiz (bank ready, `restoreQuiz` ok), or null. */
  readonly resumable: QuizSession | null;
  /** Which load-notice sentences to show (§9.5). */
  readonly notice: { readonly session: boolean; readonly best: boolean };
  /** Startup reserve; null once Landing has been left (no reserve then). */
  readonly reserve: LandingReserveProgress | null;
  /** Restores the quiz and opens `#/quiz`; false when it could not. */
  readonly onResume: () => boolean;
  /** Removes the saved quiz (best scores untouched). */
  readonly onDiscard: () => void;
  /** Removes the saved quiz first, then starts `scope` (F4); like onStart. */
  readonly onReplaceStart: (scope: QuizScope) => boolean;
  /**
   * Reset progress (US-6.6, T-44): clears only `apiquiz:` keys and the
   * App's progress state; false when the store reported `ok: false`.
   */
  readonly onReset: () => boolean;
}
