/**
 * T-US7-5: `--release` fails below the US-8.1 thresholds (60 reviewed, 8
 * topics, 5 per topic, 20% medium or hard); dev mode only warns. Banks are
 * generated in memory; drafts are never counted.
 */
import { describe, expect, it } from "vitest";
import { releaseThresholdProblems } from "../../../scripts/content/rules.ts";
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

const EIGHT_BY_60 = [8, 8, 8, 8, 7, 7, 7, 7]; // 60 reviewed over 8 topics

describe("release thresholds at and just below each boundary", () => {
  it("passes exactly at every threshold (60 total, 8 topics, 12/60 = 20%)", () => {
    expect(fields({ perTopic: EIGHT_BY_60, mediumOrHard: 12 })).toEqual([]);
  });

  it("59 reviewed questions fails reviewed.total", () => {
    expect(
      fields({ perTopic: [8, 8, 8, 8, 7, 7, 7, 6], mediumOrHard: 12 }),
    ).toEqual(["reviewed.total"]);
  });

  it("drafts do not count toward the total", () => {
    expect(
      fields({
        perTopic: [8, 8, 8, 8, 7, 7, 7, 6],
        mediumOrHard: 12,
        drafts: 5,
      }),
    ).toEqual(["reviewed.total"]);
  });

  it("7 topics fails reviewed.topics", () => {
    expect(
      fields({ perTopic: [9, 9, 9, 9, 8, 8, 8], mediumOrHard: 12 }),
    ).toEqual(["reviewed.topics"]);
  });

  it("4 in one topic fails reviewed.perTopic for that topic; 5 passes", () => {
    expect(
      fields({ perTopic: [9, 9, 9, 9, 9, 6, 5, 4], mediumOrHard: 12 }),
    ).toEqual(["reviewed.perTopic.topic-8"]);
    expect(
      fields({ perTopic: [9, 9, 9, 9, 9, 5, 5, 5], mediumOrHard: 12 }),
    ).toEqual([]);
  });

  it("19% medium or hard fails reviewed.difficulty; 20% passes", () => {
    const hundred = [13, 13, 13, 13, 12, 12, 12, 12];
    expect(fields({ perTopic: hundred, mediumOrHard: 19 })).toEqual([
      "reviewed.difficulty",
    ]);
    expect(fields({ perTopic: hundred, mediumOrHard: 20 })).toEqual([]);
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
    perTopic: [8, 8, 8, 8, 7, 7, 7, 6],
    mediumOrHard: 11,
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

  it("release: a bank meeting every threshold has no errors", () => {
    const result = validateBank(
      { perTopic: EIGHT_BY_60, mediumOrHard: 12 },
      true,
    );
    expect(result.errors).toEqual([]);
    expect(result.questions).toHaveLength(60);
  });
});
