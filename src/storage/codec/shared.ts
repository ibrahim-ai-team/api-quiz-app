/**
 * Shared guards for the storage codecs (T-41; ADR-0001: stored data is
 * untrusted input; FR-20, US-6.8, V-6).
 *
 * Decoders take the raw stored string (or null), never throw, and never
 * return the parsed object itself: every accepted value is rebuilt from
 * checked fields, so extra keys and `__proto__` tricks cannot leak through.
 */
import { MAX_VALUE_LENGTH } from "../ProgressStore";

/**
 * - `absent`: nothing stored (null).
 * - `too-large`: longer than `MAX_VALUE_LENGTH`; not parsed.
 * - `corrupt`: not JSON, wrong shape or types, out of bounds, inconsistent.
 * - `unknown-version`: well-formed object with a `schemaVersion` integer this
 *   build does not know (for example written by a newer build).
 */
export type DecodeFailureReason =
  "absent" | "too-large" | "corrupt" | "unknown-version";

export type DecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: DecodeFailureReason };

/** Longest accepted ID (question, option, topic) or `contentVersion`. */
export const MAX_ID_LENGTH = 128;

/** Largest accepted epoch-millisecond timestamp (the ECMAScript Date range). */
export const MAX_TIMESTAMP = 8.64e15;

export type UnknownRecord = Readonly<Record<string, unknown>>;

export function failure(reason: DecodeFailureReason): {
  readonly ok: false;
  readonly reason: DecodeFailureReason;
} {
  return { ok: false, reason };
}

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Own data property only: never reads through the prototype chain. */
export function own(record: UnknownRecord, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

export function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_ID_LENGTH
  );
}

export function isIntIn(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

export function isTimestamp(value: unknown): value is number {
  return isIntIn(value, 0, MAX_TIMESTAMP);
}

/**
 * Size check, JSON parse and `schemaVersion` check shared by every decoder.
 * Returns the parsed top-level record on success.
 */
export function parseVersioned(
  raw: string | null,
  schemaVersion: number,
): DecodeResult<UnknownRecord> {
  if (raw === null) return failure("absent");
  if (typeof raw !== "string") return failure("corrupt");
  if (raw.length > MAX_VALUE_LENGTH) return failure("too-large");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure("corrupt");
  }
  if (!isRecord(parsed)) return failure("corrupt");
  const version = own(parsed, "schemaVersion");
  if (version === schemaVersion) return { ok: true, value: parsed };
  return isIntIn(version, 0, Number.MAX_SAFE_INTEGER)
    ? failure("unknown-version")
    : failure("corrupt");
}
