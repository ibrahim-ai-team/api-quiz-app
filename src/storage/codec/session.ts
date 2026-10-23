/**
 * Codec for the in-progress quiz under `apiquiz:v1:session` (T-41; US-6,
 * US-6.8; tech-lead proposal S3-TL01).
 *
 * JSON (field order fixed): `{"schemaVersion":1,"contentVersion":"…",
 * "mode":"normal"|"retry-missed","scope":{"kind":"topic","topicId":"…"}|
 * {"kind":"mixed"},"seed":<uint32>,"questionIds":[…],"optionOrder":[[…]],
 * "answers":[{"q":"…","o":"…"}],"index":<int>,"savedAt":<epoch ms>}`.
 * No text and no `correct` flags are stored.
 *
 * `decodeSession` checks types and bounds, then the bank-independent
 * consistency rules of `isConsistentSavedSession`; whether the session still
 * fits the current bank is decided by `restoreQuiz` in `src/domain`.
 */
import {
  isConsistentSavedSession,
  SAVED_SESSION_SCHEMA_VERSION,
  type QuizMode,
  type QuizScope,
  type SavedAnswer,
  type SavedSession,
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
} from "./shared";

/** At most this many questions in a saved session. */
export const MAX_SESSION_QUESTIONS = 200;

/** At most this many options per saved question. */
export const MAX_SESSION_OPTIONS = 16;

const MAX_SEED = 0xffffffff;

function toMode(value: unknown): QuizMode | undefined {
  return value === "normal" || value === "retry-missed" ? value : undefined;
}

function toScope(value: unknown): QuizScope | undefined {
  if (!isRecord(value)) return undefined;
  const kind = own(value, "kind");
  if (kind === "mixed") return { kind: "mixed" };
  const topicId = own(value, "topicId");
  if (kind === "topic" && isId(topicId)) return { kind: "topic", topicId };
  return undefined;
}

function toIdList(value: unknown, max: number): string[] | undefined {
  if (!Array.isArray(value) || value.length > max) return undefined;
  const ids: string[] = [];
  for (const item of value as readonly unknown[]) {
    if (!isId(item)) return undefined;
    ids.push(item);
  }
  return ids;
}

function toOptionOrder(value: unknown): string[][] | undefined {
  if (!Array.isArray(value) || value.length > MAX_SESSION_QUESTIONS) {
    return undefined;
  }
  const orders: string[][] = [];
  for (const item of value as readonly unknown[]) {
    const ids = toIdList(item, MAX_SESSION_OPTIONS);
    if (ids === undefined) return undefined;
    orders.push(ids);
  }
  return orders;
}

function toAnswers(value: unknown): SavedAnswer[] | undefined {
  if (!Array.isArray(value) || value.length > MAX_SESSION_QUESTIONS) {
    return undefined;
  }
  const answers: SavedAnswer[] = [];
  for (const item of value as readonly unknown[]) {
    if (!isRecord(item)) return undefined;
    const q = own(item, "q");
    const o = own(item, "o");
    if (!isId(q) || !isId(o)) return undefined;
    answers.push({ q, o });
  }
  return answers;
}

/** Decodes the raw stored value. Never throws. */
export function decodeSession(raw: string | null): DecodeResult<SavedSession> {
  const parsed = parseVersioned(raw, SAVED_SESSION_SCHEMA_VERSION);
  if (!parsed.ok) return parsed;
  const record = parsed.value;
  const contentVersion = own(record, "contentVersion");
  const mode = toMode(own(record, "mode"));
  const scope = toScope(own(record, "scope"));
  const seed = own(record, "seed");
  const questionIds = toIdList(
    own(record, "questionIds"),
    MAX_SESSION_QUESTIONS,
  );
  const optionOrder = toOptionOrder(own(record, "optionOrder"));
  const answers = toAnswers(own(record, "answers"));
  const index = own(record, "index");
  const savedAt = own(record, "savedAt");
  if (
    !isId(contentVersion) ||
    mode === undefined ||
    scope === undefined ||
    !isIntIn(seed, 0, MAX_SEED) ||
    questionIds === undefined ||
    optionOrder === undefined ||
    answers === undefined ||
    !isIntIn(index, 0, MAX_SESSION_QUESTIONS) ||
    !isTimestamp(savedAt)
  ) {
    return failure("corrupt");
  }
  const value: SavedSession = {
    schemaVersion: SAVED_SESSION_SCHEMA_VERSION,
    contentVersion,
    mode,
    scope,
    seed,
    questionIds,
    optionOrder,
    answers,
    index,
    savedAt,
  };
  return isConsistentSavedSession(value)
    ? { ok: true, value }
    : failure("corrupt");
}

/** Encodes a saved session (build it with `toSavedSession`). */
export function encodeSession(saved: SavedSession): string {
  return JSON.stringify({
    schemaVersion: SAVED_SESSION_SCHEMA_VERSION,
    contentVersion: saved.contentVersion,
    mode: saved.mode,
    scope:
      saved.scope.kind === "topic"
        ? { kind: "topic", topicId: saved.scope.topicId }
        : { kind: "mixed" },
    seed: saved.seed,
    questionIds: saved.questionIds,
    optionOrder: saved.optionOrder,
    answers: saved.answers.map((a) => ({ q: a.q, o: a.o })),
    index: saved.index,
    savedAt: saved.savedAt,
  });
}
