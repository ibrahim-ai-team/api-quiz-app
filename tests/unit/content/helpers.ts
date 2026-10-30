import { readFileSync } from "node:fs";
import path from "node:path";
import type { Question } from "../../../scripts/content/schema.ts";
import {
  validateContent,
  type ContentIssue,
  type SourceFile,
  type ValidationResult,
} from "../../../scripts/content/validate.ts";

const FIXTURES = path.join(import.meta.dirname, "fixtures");

export const QUESTION_FILE = "content/questions/http-fundamentals.json";

export function fixtureText(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf8");
}

/** A fixture file presented to the validator under a virtual content path. */
export function vfx(name: string, virtualPath = QUESTION_FILE): SourceFile {
  return { path: virtualPath, text: fixtureText(`vfx/${name}`) };
}

/** The single question of `vfx/valid-minimal.json`, for in-test mutations. */
export function validQuestion(): Record<string, unknown> {
  const file = JSON.parse(fixtureText("vfx/valid-minimal.json")) as {
    questions: Record<string, unknown>[];
  };
  const question = file.questions[0];
  if (question === undefined) throw new Error("valid-minimal has no question");
  return question;
}

export function questionFile(
  questions: readonly unknown[],
  virtualPath = QUESTION_FILE,
): SourceFile {
  return {
    path: virtualPath,
    text: JSON.stringify({ schemaVersion: 1, questions }),
  };
}

/** Validates question files against the fixture topics and retired IDs. */
export function validateFiles(
  questionFiles: readonly SourceFile[],
  overrides: { topics?: SourceFile; retiredIds?: SourceFile } = {},
): ValidationResult {
  return validateContent(
    {
      topics: overrides.topics ?? {
        path: "content/topics.json",
        text: fixtureText("topics.json"),
      },
      retiredIds: overrides.retiredIds ?? {
        path: "content/retired-ids.json",
        text: fixtureText("retired-ids.json"),
      },
      questionFiles,
    },
    { release: false },
  );
}

/**
 * The one comparator for location lists (T-32 N3): plain UTF-16 code-unit
 * order, so actual and expected lists always sort the same way.
 */
export function compareLocations(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** `(file) questionId field` triples, sorted, for exact comparison. */
export function locations(issues: readonly ContentIssue[]): string[] {
  return issues
    .map((i) => `${i.file} ${i.questionId} ${i.field}`)
    .sort(compareLocations);
}

export interface BankSpec {
  /** Reviewed question count per topic; topic ids are `topic-1`.. */
  perTopic: readonly number[];
  /** How many of all reviewed questions are medium or hard. */
  mediumOrHard: number;
  /** Extra draft questions in the first topic (never counted). */
  drafts?: number;
}

/** Generates schema-valid in-memory questions for threshold tests. */
export function generateBank(spec: BankSpec): {
  topics: { id: string; name: string }[];
  questions: Question[];
} {
  const topics = spec.perTopic.map((_, i) => ({
    id: `topic-${String(i + 1)}`,
    name: `Topic ${String(i + 1)}`,
  }));
  const questions: Question[] = [];
  let hardLeft = spec.mediumOrHard;
  const make = (topic: string, n: number, draft: boolean): Question => {
    const difficulty = !draft && hardLeft > 0 ? "medium" : "easy";
    if (difficulty === "medium") hardLeft -= 1;
    return {
      id: `${topic}-${draft ? "draft" : "q"}-${String(n)}`,
      topic,
      difficulty,
      type: "true-false",
      prompt: "Generated prompt",
      options: [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
      ],
      correct: "true",
      explanation: "Generated explanation for tests.",
      sourceUrl: "https://www.rfc-editor.org/rfc/rfc9110.html",
      ...(draft
        ? { reviewStatus: "draft" as const }
        : { reviewStatus: "reviewed" as const, reviewedBy: "qa-agent" }),
    };
  };
  topics.forEach((topic, t) => {
    const count = spec.perTopic[t] ?? 0;
    for (let n = 0; n < count; n += 1) questions.push(make(topic.id, n, false));
  });
  const first = topics[0];
  if (first !== undefined) {
    for (let n = 0; n < (spec.drafts ?? 0); n += 1) {
      questions.push(make(first.id, n, true));
    }
  }
  return { topics, questions };
}
