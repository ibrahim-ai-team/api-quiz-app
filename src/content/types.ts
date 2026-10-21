/**
 * Emitted question bank types and runtime type guard (T-06, US-7.4, US-7.6;
 * tech-lead standard 3).
 *
 * The bank is built by `scripts/build-content.ts` from `content/**` and
 * fetched at runtime as a same-origin JSON asset. Fetched data is untrusted
 * input: it enters as `unknown` and must pass `isBank` before use.
 *
 * Plain TypeScript on purpose: `src/` must not import Zod or anything from
 * `scripts/` (ESLint `no-restricted-imports`). `scripts/build-content.ts`
 * checks at compile time that the schema types stay assignable to these.
 * This file has no imports so Node can also load it (type stripping) when the
 * build script self-checks the emitted bank.
 */

export const BANK_SCHEMA_VERSION = 1;

export const BANK_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const BANK_QUESTION_TYPES = ["single-choice", "true-false"] as const;
export const BANK_REVIEW_STATUSES = ["draft", "reviewed"] as const;

export type Difficulty = (typeof BANK_DIFFICULTIES)[number];
export type QuestionType = (typeof BANK_QUESTION_TYPES)[number];
export type ReviewStatus = (typeof BANK_REVIEW_STATUSES)[number];

export interface BankOption {
  readonly id: string;
  readonly text: string;
}

export interface BankQuestion {
  readonly id: string;
  readonly topic: string;
  readonly difficulty: Difficulty;
  readonly type: QuestionType;
  readonly prompt: string;
  readonly options: readonly BankOption[];
  /** ID of the single correct option. */
  readonly correct: string;
  readonly explanation: string;
  /** https-only (enforced by the content validator at build time). */
  readonly sourceUrl: string;
  /** Always "reviewed" in production builds; dev builds include drafts. */
  readonly reviewStatus: ReviewStatus;
  readonly reviewedBy?: string;
}

export interface BankTopic {
  readonly id: string;
  readonly name: string;
}

/** The emitted data asset: `assets/bank-<hash>.json`. */
export interface Bank {
  readonly schemaVersion: typeof BANK_SCHEMA_VERSION;
  /** Build-generated short SHA-256 of the emitted topics and questions. */
  readonly contentVersion: string;
  /** All curated topics in display order, including topics with 0 questions. */
  readonly topics: readonly BankTopic[];
  readonly questions: readonly BankQuestion[];
}

type UnknownRecord = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

function isOption(value: unknown): value is BankOption {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.text)
  );
}

function isTopic(value: unknown): value is BankTopic {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name)
  );
}

function isQuestion(
  value: unknown,
  topicIds: ReadonlySet<string>,
): value is BankQuestion {
  if (!isRecord(value)) return false;
  const { options, correct, reviewedBy } = value;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.topic) &&
    topicIds.has(value.topic) &&
    isOneOf(BANK_DIFFICULTIES, value.difficulty) &&
    isOneOf(BANK_QUESTION_TYPES, value.type) &&
    isNonEmptyString(value.prompt) &&
    Array.isArray(options) &&
    options.length >= 2 &&
    options.every(isOption) &&
    isNonEmptyString(correct) &&
    options.some((option) => option.id === correct) &&
    isNonEmptyString(value.explanation) &&
    isNonEmptyString(value.sourceUrl) &&
    value.sourceUrl.startsWith("https://") &&
    isOneOf(BANK_REVIEW_STATUSES, value.reviewStatus) &&
    (reviewedBy === undefined || typeof reviewedBy === "string")
  );
}

/**
 * Structural guard for a fetched bank. Checks every field the UI relies on,
 * plus cheap integrity rules (known topic, `correct` names an option, unique
 * question IDs, https source). Unknown extra keys are tolerated. Never throws.
 */
export function isBank(value: unknown): value is Bank {
  if (!isRecord(value)) return false;
  const { topics, questions } = value;
  if (
    value.schemaVersion !== BANK_SCHEMA_VERSION ||
    !isNonEmptyString(value.contentVersion) ||
    !Array.isArray(topics) ||
    !Array.isArray(questions) ||
    !topics.every(isTopic)
  ) {
    return false;
  }
  const topicIds = new Set(topics.map((topic) => topic.id));
  if (topicIds.size !== topics.length) return false;
  const questionIds = new Set<string>();
  for (const question of questions) {
    if (!isQuestion(question, topicIds) || questionIds.has(question.id)) {
      return false;
    }
    questionIds.add(question.id);
  }
  return true;
}
