/**
 * Bank emission (T-06, US-7.4). Pure functions used by
 * `scripts/build-content.ts` and unit tests.
 *
 * - Production mode keeps only `reviewStatus: "reviewed"` questions; dev mode
 *   keeps drafts too so authors can preview them with `npm run dev`.
 * - Every curated topic is kept, in `content/topics.json` order, even with 0
 *   emitted questions; the UI hides empty topics (US-1.2).
 * - `contentVersion` is a short SHA-256 over a canonical (sorted-key) JSON of
 *   the emitted schemaVersion, topics and questions, so it only changes when
 *   emitted content changes.
 */
import { createHash } from "node:crypto";
import type {
  Bank,
  BankQuestion,
  BankTopic,
  LandingReserve,
} from "../../src/content/types.ts";
import { CONTENT_SCHEMA_VERSION, type Question, type Topic } from "./schema.ts";

export type BuildMode = "development" | "production";

/** Hex characters kept from the SHA-256 digest (64 bits). */
export const CONTENT_VERSION_LENGTH = 16;

/**
 * Copies a validated question into the emitted shape with a fixed key order.
 * The explicit field list is also a compile-time check: a field added to the
 * schema `Question` but not to `BankQuestion` fails here (see also the
 * assignability checks in scripts/build-content.ts).
 */
export function toBankQuestion(question: Question): BankQuestion {
  const base = {
    id: question.id,
    topic: question.topic,
    difficulty: question.difficulty,
    type: question.type,
    prompt: question.prompt,
    options: question.options.map((option) => ({
      id: option.id,
      text: option.text,
    })),
    correct: question.correct,
    explanation: question.explanation,
    sourceUrl: question.sourceUrl,
    reviewStatus: question.reviewStatus,
  };
  return question.reviewedBy === undefined
    ? base
    : { ...base, reviewedBy: question.reviewedBy };
}

export function toBankTopic(topic: Topic): BankTopic {
  return { id: topic.id, name: topic.name };
}

/** JSON with object keys sorted recursively; arrays keep their order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeContentVersion(
  topics: readonly BankTopic[],
  questions: readonly BankQuestion[],
): string {
  const canonical = canonicalJson({
    schemaVersion: CONTENT_SCHEMA_VERSION,
    topics,
    questions,
  });
  return createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex")
    .slice(0, CONTENT_VERSION_LENGTH);
}

/** Builds the emitted bank from validated (error-free) content. */
export function buildBank(
  topics: readonly Topic[],
  questions: readonly Question[],
  mode: BuildMode,
): Bank {
  const emittedTopics = topics.map(toBankTopic);
  const emittedQuestions = questions
    .filter((q) => mode === "development" || q.reviewStatus === "reviewed")
    .map(toBankQuestion);
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    contentVersion: computeContentVersion(emittedTopics, emittedQuestions),
    topics: emittedTopics,
    questions: emittedQuestions,
  };
}

/** File contents of the emitted bank (compact JSON plus a newline). */
export function serializeBank(bank: Bank): string {
  return `${JSON.stringify(bank)}\n`;
}

/**
 * Landing loading reserve (T-35): the Landing view imports it as a module so
 * the reserve holds as many rows, with the same names, as the loaded group.
 */
export function buildLandingReserve(bank: Bank): LandingReserve {
  const withQuestions = new Set(bank.questions.map((q) => q.topic));
  const eligible = bank.topics.filter((topic) => withQuestions.has(topic.id));
  return {
    eligibleTopicCount: eligible.length,
    topicNames: eligible.map((topic) => topic.name),
    topicIds: eligible.map((topic) => topic.id),
  };
}

/** File name of the reserve data, written next to the bank. */
export const LANDING_RESERVE_FILE = "landing-reserve.json";

/** File contents of the reserve data (compact JSON plus a newline). */
export function serializeLandingReserve(reserve: LandingReserve): string {
  return `${JSON.stringify(reserve)}\n`;
}
