/**
 * Scoring (T-14). Test IDs follow docs/qa/ac-test-matrix.md: T-US4-1
 * (X / N and half-up percentage, 2/3 = 67%), T-US4-2 (band edges 0, 1, 49,
 * 50, 79, 80, 99, 100), T-US4-3 (breakdown only for > 1 topic), T-US4-5
 * (N = 1, 0% and 100%).
 */
import { describe, expect, it } from "vitest";
import * as domain from "../../../src/domain/index.ts";
import { bandFor, percentHalfUp, score } from "../../../src/domain/score.ts";
import type {
  Answer,
  QuizQuestion,
  QuizSession,
} from "../../../src/domain/types.ts";

function question(id: string, topicId: string): QuizQuestion {
  return {
    id,
    topicId,
    type: "single-choice",
    difficulty: "easy",
    prompt: `Prompt ${id}`,
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
    correctOptionId: "a",
    explanation: "Explanation text.",
    sourceUrl: "https://example.org/",
  };
}

/**
 * A finished session; `results[i]` is whether question i was answered
 * correctly and `topics[i]` its topic (default "t1").
 */
function finished(
  results: readonly boolean[],
  topics: readonly string[] = [],
): QuizSession {
  const questions = results.map((_, i) =>
    question(`q-${String(i)}`, topics[i] ?? "t1"),
  );
  const answers: Answer[] = results.map((correct, i) => ({
    questionId: `q-${String(i)}`,
    optionId: correct ? "a" : "b",
    correct,
  }));
  return {
    quiz: {
      scope: { kind: "mixed" },
      mode: "normal",
      contentVersion: "test",
      seed: 1,
      questions,
    },
    index: Math.max(0, questions.length - 1),
    selected: null,
    answers,
    phase: "finished",
  };
}

/** `x` correct out of `n`, correct ones first. */
function xOfN(x: number, n: number): QuizSession {
  return finished(Array.from({ length: n }, (_, i) => i < x));
}

describe("T-US4-1 score: X / N and half-up percentage", () => {
  it.each([
    [2, 3, 67],
    [1, 3, 33],
    [1, 6, 17],
    [5, 6, 83],
    [1, 8, 13],
    [3, 8, 38],
    [1, 2, 50],
    [7, 10, 70],
  ])("%i of %i is %i%%", (x, n, pct) => {
    const result = score(xOfN(x, n));
    expect(result.correct).toBe(x);
    expect(result.total).toBe(n);
    expect(result.percent).toBe(pct);
  });

  it("rounds .5 up without floating-point error", () => {
    // 12.5, 37.5, 62.5, 87.5 and 49.5 are all exact halves.
    expect([1, 3, 5, 7].map((x) => percentHalfUp(x, 8))).toEqual([
      13, 38, 63, 88,
    ]);
    expect(percentHalfUp(99, 200)).toBe(50);
    expect(percentHalfUp(1, 200)).toBe(1);
  });

  it("keeps 0% and 100% for exactly zero and all correct only", () => {
    // Plain rounding would show 100% for 199/200 and 0% for 1/201.
    expect(percentHalfUp(199, 200)).toBe(99);
    expect(percentHalfUp(1, 201)).toBe(1);
    expect(percentHalfUp(0, 0)).toBe(0);
  });
});

describe("T-US4-2 score: band edges", () => {
  it.each([
    [0, "zero"],
    [1, "low"],
    [49, "low"],
    [50, "mid"],
    [79, "mid"],
    [80, "high"],
    [99, "high"],
    [100, "perfect"],
  ] as const)("%i of 100 is %i%% in band %s", (x, band) => {
    const result = score(xOfN(x, 100));
    expect(result.percent).toBe(x);
    expect(result.band).toBe(band);
    expect(bandFor(x)).toBe(band);
  });

  it("uses the rounded percentage at the edges (49.5% is mid)", () => {
    expect(score(xOfN(99, 200)).band).toBe("mid");
    expect(score(xOfN(199, 200)).band).toBe("high");
  });
});

describe("T-US4-5 score: N = 1, 0% and 100%", () => {
  it.each([
    [true, 1, 100, "perfect"],
    [false, 0, 0, "zero"],
  ] as const)("N = 1, correct %s", (correct, x, pct, band) => {
    expect(score(finished([correct]))).toEqual({
      correct: x,
      total: 1,
      percent: pct,
      band,
      byTopic: [],
    });
  });

  it("scores 0% and 100% for N = 10", () => {
    expect(score(xOfN(0, 10))).toMatchObject({ percent: 0, band: "zero" });
    expect(score(xOfN(10, 10))).toMatchObject({
      percent: 100,
      band: "perfect",
    });
  });
});

describe("T-US4-3 score: per-topic breakdown", () => {
  it("is empty for a single-topic quiz", () => {
    expect(score(xOfN(3, 5)).byTopic).toEqual([]);
  });

  it("counts per topic in first-appearance order by default", () => {
    const session = finished(
      [true, false, true, true, false],
      ["t2", "t1", "t2", "t1", "t3"],
    );
    expect(score(session).byTopic).toEqual([
      { topicId: "t2", correct: 2, total: 2 },
      { topicId: "t1", correct: 1, total: 2 },
      { topicId: "t3", correct: 0, total: 1 },
    ]);
  });

  it("follows topicOrder; unlisted topics keep first-appearance order last", () => {
    const session = finished(
      [true, false, true, true],
      ["t2", "t9", "t1", "t3"],
    );
    expect(
      score(session, ["t1", "t2", "t3"]).byTopic.map((t) => t.topicId),
    ).toEqual(["t1", "t2", "t3", "t9"]);
  });

  it("topic totals add up to the overall score", () => {
    const session = finished(
      [true, false, true, false, true, true],
      ["a", "b", "c", "a", "b", "c"],
    );
    const result = score(session);
    const sum = (key: "correct" | "total") =>
      result.byTopic.reduce((acc, t) => acc + t[key], 0);
    expect([sum("correct"), sum("total")]).toEqual([4, 6]);
    expect(result).toMatchObject({ correct: 4, total: 6, percent: 67 });
  });
});

describe("score: unfinished session contract", () => {
  it("covers the answered questions only", () => {
    const done = finished([true, false, true], ["t1", "t2", "t1"]);
    const partial: QuizSession = {
      ...done,
      index: 2,
      answers: done.answers.slice(0, 2),
      phase: "answering",
    };
    expect(score(partial)).toEqual({
      correct: 1,
      total: 2,
      percent: 50,
      band: "mid",
      byTopic: [
        { topicId: "t1", correct: 1, total: 1 },
        { topicId: "t2", correct: 0, total: 1 },
      ],
    });
  });

  it("scores an empty session as 0 of 0 without throwing", () => {
    expect(score(finished([]))).toEqual({
      correct: 0,
      total: 0,
      percent: 0,
      band: "zero",
      byTopic: [],
    });
  });

  it("is pure: the session is not changed", () => {
    const session = finished([true, false], ["t1", "t2"]);
    const copy = structuredClone(session);
    score(session, ["t2", "t1"]);
    expect(session).toEqual(copy);
  });

  it("is exported from the domain index", () => {
    expect(domain.score).toBe(score);
    expect(domain.percentHalfUp).toBe(percentHalfUp);
    expect(domain.bandFor).toBe(bandFor);
  });
});
