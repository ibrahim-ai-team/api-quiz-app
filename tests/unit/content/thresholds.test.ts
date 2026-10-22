/**
 * T-US7-5: release mode enforces the documented MVP policy (24 reviewed
 * questions, 3 topics, 5 per topic, 20% medium/hard); drafts never count.
 * US-8.1's separate future target remains 60 questions across 8 topics.
 */
import { describe, expect, it } from "vitest";
import {
  FUTURE_RELEASE_TARGET,
  MVP_RELEASE_THRESHOLDS,
  releaseThresholdProblems,
} from "../../../scripts/content/rules.ts";
import {
  BANK_LEVEL,
  validateContent,
} from "../../../scripts/content/validate.ts";
import { generateBank, type BankSpec } from "./helpers.ts";

/** Runs the full validator over a generated bank, one file per topic. */
function validateBank(spec: BankSpec, release: boolean) {
  const { topics, questions } = generateBank(spec);
  return validateContent(
    {
      topics: {
        path: "content/topics.json",
        text: JSON.stringify({ schemaVersion: 1, topics }),
      },
      retiredIds: {
        path: "content/retired-ids.json",
        text: JSON.stringify({ schemaVersion: 1, retiredIds: [] }),
      },
      questionFiles: topics.map((topic) => ({
        path: `content/questions/${topic.id}.json`,
        text: JSON.stringify({
          schemaVersion: 1,
          questions: questions.filter((q) => q.topic === topic.id),
        }),
      })),
    },
    { release },
  );
}

function fields(spec: BankSpec): string[] {
  const { topics, questions } = generateBank(spec);
  return releaseThresholdProblems(questions, topics).map((p) => p.field);
}

const THREE_BY_24 = [8, 8, 8]; // 24 reviewed questions across 3 topics

describe("centralized release policy", () => {
  it("uses the MVP release thresholds while retaining the US-8.1 future target", () => {
    expect(MVP_RELEASE_THRESHOLDS).toEqual({
      minReviewedQuestions: 24,
      minTopics: 3,
      minPerTopic: 5,
      minMediumOrHardPercent: 20,
    });
    expect(FUTURE_RELEASE_TARGET).toEqual({
      minReviewedQuestions: 60,
      minTopics: 8,
      minPerTopic: 5,
      minMediumOrHardPercent: 20,
    });
  });
});

describe("MVP release thresholds at and just below each boundary", () => {
  it("passes exactly at every MVP threshold (24 total, 3 topics, 5/24 medium or hard)", () => {
    expect(fields({ perTopic: THREE_BY_24, mediumOrHard: 5 })).toEqual([]);
  });

  it("23 reviewed questions fails reviewed.total", () => {
    expect(
      fields({ perTopic: [8, 8, 7], mediumOrHard: 5 }),
    ).toEqual(["reviewed.total"]);
  });

  it("drafts do not count toward the reviewed total", () => {
    expect(
      fields({ perTopic: [8, 8, 7], mediumOrHard: 5, drafts: 5 }),
    ).toEqual(["reviewed.total"]);
  });

  it("2 topics fails reviewed.topics", () => {
    expect(
      fields({ perTopic: [12, 12], mediumOrHard: 5 }),
    ).toEqual(["reviewed.topics"]);
  });

  it("4 in one covered topic fails; 5 per topic passes", () => {
    expect(
      fields({ perTopic: [15, 5, 4], mediumOrHard: 5 }),
    ).toEqual(["reviewed.perTopic.topic-3"]);
    expect(fields({ perTopic: [14, 5, 5], mediumOrHard: 5 })).toEqual([]);
  });

  it("less than 20% medium or hard fails; exactly 20% passes", () => {
    expect(
      fields({ perTopic: THREE_BY_24, mediumOrHard: 4 }),
    ).toEqual(["reviewed.difficulty"]);
    expect(fields({ perTopic: THREE_BY_24, mediumOrHard: 5 })).toEqual([]);
  });

  it("an empty bank fails every bank-wide threshold", () => {
    expect(fields({ perTopic: [], mediumOrHard: 0 })).toEqual([
      "reviewed.total",
      "reviewed.topics",
      "reviewed.difficulty",
    ]);
  });
});

describe("dev mode warns, release mode fails", () => {
  const below: BankSpec = {
    perTopic: [8, 8, 7],
    mediumOrHard: 4,
  };

  it("dev: shortfalls are warnings and there are no errors", () => {
    const result = validateBank(below, false);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((w) => w.field)).toEqual([
      "reviewed.total",
      "reviewed.difficulty",
    ]);
    expect(result.warnings.every((w) => w.questionId === BANK_LEVEL)).toBe(
      true,
    );
  });

  it("release: the same shortfalls are errors", () => {
    const result = validateBank(below, true);
    expect(result.warnings).toEqual([]);
    expect(
      result.errors.map((e) => `${e.file} ${e.questionId} ${e.field}`),
    ).toEqual([
      "content/questions (bank) reviewed.total",
      "content/questions (bank) reviewed.difficulty",
    ]);
  });

  it("release: a bank meeting every MVP threshold has no errors", () => {
    const result = validateBank(
      { perTopic: THREE_BY_24, mediumOrHard: 5 },
      true,
    );
    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(24);
  });
});
