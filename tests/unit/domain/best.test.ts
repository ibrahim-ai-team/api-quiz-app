/**
 * Best score (T-42; US-6.1, US-5.5, SEC-R13): updateBest, bestFor,
 * bestKeyFor and countsTowardBest.
 */
import { describe, expect, it } from "vitest";
import {
  bestFor,
  bestKeyFor,
  countsTowardBest,
  isFullQuiz,
  MIXED_BEST_KEY,
  updateBest,
} from "../../../src/domain/best.ts";
import { createQuiz } from "../../../src/domain/createQuiz.ts";
import type { Difficulty } from "../../../src/content/types.ts";
import { makeBank } from "./helpers.ts";
import * as domain from "../../../src/domain/index.ts";
import {
  bandFor,
  percentHalfUp,
  type Score,
} from "../../../src/domain/score.ts";
import type {
  BestScore,
  Quiz,
  QuizScope,
  SavedBest,
} from "../../../src/domain/types.ts";
import * as storage from "../../../src/storage/index.ts";

const TOPIC_A: QuizScope = { kind: "topic", topicId: "topic-a" };
const MIXED: QuizScope = { kind: "mixed" };

function scoreOf(correct: number, total: number): Score {
  const percent = percentHalfUp(correct, total);
  return { correct, total, percent, band: bandFor(percent), byTopic: [] };
}

function entry(correct: number, total: number, at: number): BestScore {
  return { percent: percentHalfUp(correct, total), correct, total, at };
}

function saved(scores: Record<string, BestScore>): SavedBest {
  return { schemaVersion: 1, scores };
}

function quiz(mode: Quiz["mode"], contentVersion: string): Quiz {
  return { scope: TOPIC_A, mode, contentVersion, seed: 1, questions: [] };
}

describe("bestKeyFor", () => {
  it("uses the topic ID for a topic and 'mixed' for Mixed", () => {
    expect(bestKeyFor(TOPIC_A)).toBe("topic-a");
    expect(bestKeyFor(MIXED)).toBe("mixed");
    expect(MIXED_BEST_KEY).toBe("mixed");
  });

  it("is the same constant the storage codec uses (storage re-exports it)", () => {
    expect(storage.MIXED_BEST_KEY).toBe(domain.MIXED_BEST_KEY);
  });
});

describe("updateBest (US-6.1)", () => {
  it("creates the first score from null", () => {
    const result = updateBest(null, TOPIC_A, scoreOf(2, 3), 1000);
    expect(result.schemaVersion).toBe(1);
    expect({ ...result.scores }).toEqual({ "topic-a": entry(2, 3, 1000) });
    expect(Object.getPrototypeOf(result.scores)).toBe(null);
  });

  it("keys Mixed under 'mixed', separate from topics", () => {
    const best = saved({ "topic-a": entry(1, 2, 1) });
    const result = updateBest(best, MIXED, scoreOf(3, 4), 2);
    expect({ ...result.scores }).toEqual({
      "topic-a": entry(1, 2, 1),
      mixed: entry(3, 4, 2),
    });
  });

  it("replaces only with a strictly higher percentage", () => {
    const best = saved({ "topic-a": entry(1, 2, 1) }); // 50%
    expect(
      updateBest(best, TOPIC_A, scoreOf(3, 4), 5).scores["topic-a"],
    ).toEqual(entry(3, 4, 5));
    // Equal percentage (2/4 = 50%) keeps the stored score and its date.
    expect(
      updateBest(best, TOPIC_A, scoreOf(2, 4), 5).scores["topic-a"],
    ).toEqual(entry(1, 2, 1));
    // Lower keeps it.
    expect(
      updateBest(best, TOPIC_A, scoreOf(0, 4), 5).scores["topic-a"],
    ).toEqual(entry(1, 2, 1));
  });

  it("records 0% as a first score, but never a score of 0 questions", () => {
    expect(
      updateBest(null, TOPIC_A, scoreOf(0, 3), 1).scores["topic-a"],
    ).toEqual(entry(0, 3, 1));
    expect(
      Object.keys(updateBest(null, TOPIC_A, scoreOf(0, 0), 1).scores),
    ).toEqual([]);
  });

  it("never changes its input", () => {
    const scores = { "topic-a": entry(1, 2, 1) };
    const best = saved(scores);
    const result = updateBest(best, TOPIC_A, scoreOf(2, 2), 9);
    expect(result).not.toBe(best);
    expect(best.scores).toEqual({ "topic-a": entry(1, 2, 1) });
  });

  it("round-trips through the storage codec", () => {
    const result = updateBest(null, MIXED, scoreOf(7, 10), 1761200000000);
    const decoded = storage.decodeBest(storage.encodeBest(result));
    expect(decoded.ok && { ...decoded.value.scores }).toEqual({
      mixed: entry(7, 10, 1761200000000),
    });
  });
});

describe("bestFor", () => {
  it("returns the score for the scope, own keys only", () => {
    const best = updateBest(null, TOPIC_A, scoreOf(1, 1), 1);
    expect(bestFor(best.scores, TOPIC_A)).toEqual(entry(1, 1, 1));
    expect(bestFor(best.scores, MIXED)).toBeUndefined();
    expect(
      bestFor(best.scores, { kind: "topic", topicId: "toString" }),
    ).toBeUndefined();
  });
});

describe("countsTowardBest (US-5.5, SEC-R13)", () => {
  it("counts only a normal quiz built from the loaded bank's contentVersion", () => {
    expect(countsTowardBest(quiz("normal", "v2"), "v2")).toBe(true);
    expect(countsTowardBest(quiz("retry-missed", "v2"), "v2")).toBe(false);
    expect(countsTowardBest(quiz("normal", "v1"), "v2")).toBe(false);
    expect(countsTowardBest(quiz("retry-missed", "v1"), "v2")).toBe(false);
  });
});

describe("isFullQuiz (T-48; US-11 F5)", () => {
  // Topic "eight" has 8 questions, all easy (makeBank); the bank has 26.
  const bank = makeBank({ eight: 8, big: 12, other: 6 });
  const EIGHT: QuizScope = { kind: "topic", topicId: "eight" };

  function built(
    scope: QuizScope,
    length: number,
    difficulty?: Difficulty,
  ): Quiz {
    const result = createQuiz(bank, scope, 7, length, difficulty);
    if (!result.ok) throw new Error(result.error);
    return result.quiz;
  }

  it.each<[string, QuizScope, number, Difficulty | undefined, boolean]>([
    ["8-question topic, All, length 10", EIGHT, 10, undefined, true],
    ["8-question topic, All, length 20", EIGHT, 20, undefined, true],
    ["8-question topic, All, length 5", EIGHT, 5, undefined, false],
    ["8-question topic, Easy, length 10", EIGHT, 10, "easy", false],
    ["Mixed, All, length 20", MIXED, 20, undefined, true],
    ["Mixed, All, length 10", MIXED, 10, undefined, true],
    ["Mixed, All, length 5", MIXED, 5, undefined, false],
    ["Mixed, Easy, length 20", MIXED, 20, "easy", false],
  ])("%s: %s", (_name, scope, length, difficulty, expected) => {
    expect(isFullQuiz(built(scope, length, difficulty), bank)).toBe(expected);
  });

  it("is false for any difficulty filter, even at full length", () => {
    const full = built(EIGHT, 10);
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      expect(isFullQuiz({ ...full, difficulty }, bank)).toBe(false);
    }
  });

  it("compares with min(10, questions in the scope) of the given bank", () => {
    const nine = built({ kind: "topic", topicId: "big" }, 9);
    expect(isFullQuiz(nine, bank)).toBe(false);
    expect(isFullQuiz(built({ kind: "topic", topicId: "big" }, 10), bank)).toBe(
      true,
    );
    // An unknown topic has 0 available questions.
    expect(isFullQuiz(quiz("normal", "test"), bank)).toBe(true);
  });

  it("is exported from the domain API, and countsTowardBest ignores difficulty", () => {
    expect(domain.isFullQuiz).toBe(isFullQuiz);
    expect(domain.availableCount).toBeTypeOf("function");
    expect(
      countsTowardBest({ ...quiz("normal", "cv"), difficulty: "hard" }, "cv"),
    ).toBe(true);
  });
});
