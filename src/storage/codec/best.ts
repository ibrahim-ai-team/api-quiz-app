/**
 * Codec for best scores under `apiquiz:v1:best` (T-41; US-6.1, US-6.8;
 * tech-lead proposal S3-TL01).
 *
 * JSON: `{"schemaVersion":1,"scores":{"<topicId>|mixed":{"percent":67,
 * "correct":2,"total":3,"at":1761200000000}}}`; `at` is epoch milliseconds.
 *
 * Decoding is all-or-nothing: one invalid entry makes the whole value
 * `corrupt` (FR-20: discard), except that the keys `__proto__`,
 * `constructor` and `prototype` are ignored. Decoded `scores` is a
 * null-prototype object.
 */
import type { Bank } from "../../content/types";
import {
  MIXED_BEST_KEY,
  percentHalfUp,
  type BestScore,
  type SavedBest,
} from "../../domain";
import {
  failure,
  isId,
  isIntIn,
  isRecord,
  isTimestamp,
  own,
  parseVersioned,
  type DecodeResult,
  type UnknownRecord,
} from "./shared";

export const BEST_SCHEMA_VERSION = 1;

/** Key for the mixed-scope best score; defined in the domain (T-42). */
export { MIXED_BEST_KEY };

/** At most this many score entries (topics + mixed). */
export const MAX_BEST_ENTRIES = 256;

/** Largest accepted `total` (questions in one quiz). */
export const MAX_BEST_TOTAL = 1000;

const IGNORED_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function emptyScores(): Record<string, BestScore> {
  return Object.create(null) as Record<string, BestScore>;
}

function toBestScore(value: unknown): BestScore | undefined {
  if (!isRecord(value)) return undefined;
  const percent = own(value, "percent");
  const correct = own(value, "correct");
  const total = own(value, "total");
  const at = own(value, "at");
  if (
    !isIntIn(total, 1, MAX_BEST_TOTAL) ||
    !isIntIn(correct, 0, total) ||
    !isIntIn(percent, 0, 100) ||
    percent !== percentHalfUp(correct, total) ||
    !isTimestamp(at)
  ) {
    return undefined;
  }
  return { percent, correct, total, at };
}

function toScores(value: unknown): Record<string, BestScore> | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length > MAX_BEST_ENTRIES) return undefined;
  const scores = emptyScores();
  const record: UnknownRecord = value;
  for (const key of keys) {
    if (IGNORED_KEYS.has(key)) continue;
    if (!isId(key)) return undefined;
    const score = toBestScore(record[key]);
    if (score === undefined) return undefined;
    scores[key] = score;
  }
  return scores;
}

/** Decodes the raw stored value. Never throws. */
export function decodeBest(raw: string | null): DecodeResult<SavedBest> {
  const parsed = parseVersioned(raw, BEST_SCHEMA_VERSION);
  if (!parsed.ok) return parsed;
  const scores = toScores(own(parsed.value, "scores"));
  if (scores === undefined) return failure("corrupt");
  return { ok: true, value: { schemaVersion: BEST_SCHEMA_VERSION, scores } };
}

/** Encodes best scores; ignored keys are dropped. */
export function encodeBest(best: SavedBest): string {
  const scores: Record<string, BestScore> = {};
  for (const [key, s] of Object.entries(best.scores)) {
    if (IGNORED_KEYS.has(key)) continue;
    scores[key] = {
      percent: s.percent,
      correct: s.correct,
      total: s.total,
      at: s.at,
    };
  }
  return JSON.stringify({ schemaVersion: BEST_SCHEMA_VERSION, scores });
}

/**
 * Drops scores whose key is neither a topic of `bank` nor `"mixed"` (a topic
 * was removed or renamed). Returns a new value; `best` is not changed.
 */
export function pruneUnknownTopics(best: SavedBest, bank: Bank): SavedBest {
  const known = new Set(bank.topics.map((topic) => topic.id));
  known.add(MIXED_BEST_KEY);
  const scores = emptyScores();
  for (const [key, score] of Object.entries(best.scores)) {
    if (known.has(key) && !IGNORED_KEYS.has(key)) scores[key] = score;
  }
  return { schemaVersion: BEST_SCHEMA_VERSION, scores };
}
