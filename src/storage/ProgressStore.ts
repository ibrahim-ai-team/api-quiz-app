/**
 * Progress storage adapter contract (ADR-0001: `src/storage` is the only
 * `localStorage` user; keys `apiquiz:v1:*`; stored data is untrusted input).
 *
 * Every method is total: implementations never throw. Callers (T-41/T-42
 * codecs) still validate the returned strings with type guards before use.
 */

/** Prefix shared by every key this app owns. `clearAppKeys` removes only these. */
export const APP_KEY_PREFIX = "apiquiz:";

/** Versioned storage keys. Bump `v1` when a codec changes incompatibly. */
export const KEYS = {
  best: "apiquiz:v1:best",
  session: "apiquiz:v1:session",
} as const;

/** Key written and removed by `createProgressStore` to detect usable storage. */
export const PROBE_KEY = "apiquiz:probe";

/**
 * Maximum stored value length (US-6.8): 50 KB, measured as 51_200 UTF-16 code
 * units (`string.length`), which is what browsers count against the quota.
 * Larger values are refused on write ("too-large") and treated as absent on
 * read, without being parsed.
 */
export const MAX_VALUE_LENGTH = 51_200;

export type WriteFailureReason =
  "unavailable" | "quota" | "too-large" | "error";

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: WriteFailureReason };

export interface ProgressStore {
  /** Raw stored value, or null when absent, unreadable or oversized. */
  get(key: string): string | null;
  /** Stores `value`; never throws. */
  set(key: string, value: string): WriteResult;
  /** Removes `key`; never throws. */
  remove(key: string): WriteResult;
  /** Removes only keys starting with `APP_KEY_PREFIX` (US-6.6); never throws. */
  clearAppKeys(): WriteResult;
  /** False when progress cannot survive a reload (US-6.5). */
  readonly persistent: boolean;
}

export const OK: WriteResult = Object.freeze({ ok: true });

export function fail(reason: WriteFailureReason): WriteResult {
  return { ok: false, reason };
}

export function isOversized(value: string): boolean {
  return value.length > MAX_VALUE_LENGTH;
}
