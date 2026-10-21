/**
 * createQuiz and eligibleTopics (T-07). Test IDs follow docs/qa/ac-test-matrix.md:
 * T-US1-3 (topic N and membership), T-US1-4 (Mixed N, distinct, topic
 * spread), T-US1-5 (exact seeded order), T-US2-2 (option shuffle rules).
 */
import { describe, expect, it } from "vitest";
import { isBank, type Bank } from "../../../src/content/types.ts";
import {
  createQuiz,
  DEFAULT_QUIZ_LENGTH,
  eligibleTopics,
} from "../../../src/domain/createQuiz.ts";
import type {
  CreateQuizResult,
  Quiz,
  QuizScope,
} from "../../../src/domain/types.ts";
import { makeBank, SEEDS, singleChoice, trueFalse } from "./helpers.ts";

function quizOf(result: CreateQuizResult): Quiz {
  if (!result.ok) throw new Error(`expected a quiz, got ${result.error}`);
  return result.quiz;
}

function create(
  bank: Bank,
  scope: QuizScope,
  seed: number,
  length?: number,
): Quiz {
  return quizOf(createQuiz(bank, scope, seed, length));
}

const topic = (topicId: string): QuizScope => ({ kind: "topic", topicId });
const MIXED: QuizScope = { kind: "mixed" };

function ids(quiz: Quiz): string[] {
  return quiz.questions.map((q) => q.id);
}

function distinctTopics(quiz: Quiz): number {
  return new Set(quiz.questions.map((q) => q.topicId)).size;
}

describe("eligibleTopics", () => {
  it("eligibleTopics: curated order with counts", () => {
    const bank = makeBank({ "topic-a": 12, "topic-b": 5, "topic-c": 3 });
    expect(eligibleTopics(bank)).toEqual([
      { id: "topic-a", name: "Topic topic-a", count: 12 },
      { id: "topic-b", name: "Topic topic-b", count: 5 },
      { id: "topic-c", name: "Topic topic-c", count: 3 },
    ]);
  });

  it("eligibleTopics: hides empty topics", () => {
    const bank = makeBank({ z: 2, empty: 0, a: 1 });
    expect(eligibleTopics(bank).map((t) => t.id)).toEqual(["z", "a"]);
    expect(eligibleTopics(makeBank({}))).toEqual([]);
  });
});

describe("createQuiz: topic quiz (T-US1-3)", () => {
  it.each([
    [3, 3],
    [10, 10],
    [12, 10],
  ])("T-US1-3 topic with %i questions gives N = %i", (count, expected) => {
    const bank = makeBank({ target: count, other: 15 });
    for (const seed of SEEDS.slice(0, 50)) {
      const quiz = create(bank, topic("target"), seed);
      expect(quiz.questions).toHaveLength(expected);
      expect(quiz.questions.every((q) => q.topicId === "target")).toBe(true);
      expect(new Set(ids(quiz)).size).toBe(expected);
    }
  });

  it("T-US1-3 respects the length parameter", () => {
    const bank = makeBank({ target: 12 });
    expect(create(bank, topic("target"), 1, 5).questions).toHaveLength(5);
    expect(create(bank, topic("target"), 1, 20).questions).toHaveLength(12);
    expect(create(bank, topic("target"), 1, 1).questions).toHaveLength(1);
  });

  it("falls back to the default length for a non-positive or fractional length", () => {
    const bank = makeBank({ target: 12 });
    for (const length of [0, -3, 2.5, Number.NaN]) {
      expect(create(bank, topic("target"), 1, length).questions).toHaveLength(
        DEFAULT_QUIZ_LENGTH,
      );
    }
  });

  it("T-US1-3 draws without duplicates over many seeds", () => {
    const bank = makeBank({ target: 25, other: 4 });
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const quiz = create(bank, topic("target"), seed);
      expect(new Set(ids(quiz)).size).toBe(10);
      for (const id of ids(quiz)) seen.add(id);
    }
    // Draws without replacement from the whole topic, not just its first 10.
    expect(seen.size).toBe(25);
  });

  it("keeps the scope and the normalised seed on the quiz", () => {
    const quiz = create(makeBank({ t: 3 }), topic("t"), -1);
    expect(quiz.scope).toEqual({ kind: "topic", topicId: "t" });
    expect(quiz.seed).toBe(2 ** 32 - 1);
  });
});

describe("createQuiz: Mixed (T-US1-4)", () => {
  it.each([
    ["1 shown topic", { a: 12 }, 10, 1],
    ["2 shown topics (relaxed spread)", { a: 9, b: 1 }, 10, 2],
    ["3 shown topics", { a: 12, b: 1, c: 1 }, 10, 3],
    ["5 shown topics", { a: 20, b: 1, c: 1, d: 1, e: 1 }, 10, 3],
    ["total under 10", { a: 2, b: 2, c: 2 }, 6, 3],
    ["hidden empty topics", { a: 30, empty: 0, b: 1, c: 1 }, 10, 3],
  ] as const)(
    "T-US1-4 %s: N distinct questions from >= min(3, shown) topics over many seeds",
    (_label, counts, expectedN, minTopics) => {
      const bank = makeBank(counts);
      for (const seed of SEEDS) {
        const quiz = create(bank, MIXED, seed);
        expect(quiz.questions).toHaveLength(expectedN);
        expect(new Set(ids(quiz)).size).toBe(expectedN);
        expect(distinctTopics(quiz)).toBeGreaterThanOrEqual(minTopics);
      }
    },
  );

  it("T-US1-4 N < 3 edge: spans N topics when N is below min(3, shown)", () => {
    const bank = makeBank({ a: 20, b: 1, c: 1, d: 1 });
    for (const seed of SEEDS) {
      expect(distinctTopics(create(bank, MIXED, seed, 1))).toBe(1);
      const two = create(bank, MIXED, seed, 2);
      expect(two.questions).toHaveLength(2);
      expect(distinctTopics(two)).toBe(2);
    }
  });

  it("T-US1-4 spreads across topics even when one topic dominates", () => {
    // Without the spread guarantee, 10 of 102 random picks would usually all be "big".
    const bank = makeBank({ big: 100, s1: 1, s2: 1 });
    for (const seed of SEEDS) {
      expect(distinctTopics(create(bank, MIXED, seed))).toBe(3);
    }
  });

  it("T-US1-4 varies which topics are used for the spread", () => {
    const bank = makeBank({ big: 50, s1: 1, s2: 1, s3: 1, s4: 1 });
    const used = new Set<string>();
    for (const seed of SEEDS) {
      for (const q of create(bank, MIXED, seed).questions) used.add(q.topicId);
    }
    expect(used).toEqual(new Set(["big", "s1", "s2", "s3", "s4"]));
  });

  it("keeps the mixed scope on the quiz", () => {
    expect(create(makeBank({ a: 3 }), MIXED, 1).scope).toEqual({
      kind: "mixed",
    });
  });
});

describe("createQuiz: seeded order (T-US1-5)", () => {
  const bank = makeBank({ a: 6, b: 4, c: 3 });

  it("T-US1-5 same bank, scope and seed give a deep-equal quiz", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(create(bank, MIXED, seed)).toEqual(create(bank, MIXED, seed));
      expect(create(bank, topic("a"), seed)).toEqual(
        create(bank, topic("a"), seed),
      );
    }
  });

  it("T-US1-5 exact topic order for seed 42", () => {
    const quiz = create(bank, topic("a"), 42);
    expect(ids(quiz)).toEqual(EXPECTED_TOPIC_A_SEED_42);
    expect(
      quiz.questions.map((q) => q.options.map((o) => o.id).join("")),
    ).toEqual(EXPECTED_TOPIC_A_SEED_42_OPTIONS);
  });

  it("T-US1-5 exact Mixed order for seed 1", () => {
    expect(ids(create(bank, MIXED, 1))).toEqual(EXPECTED_MIXED_SEED_1);
  });

  it("T-US1-5 different seeds give at least 2 distinct orders over 50 seeds", () => {
    const topicOrders = new Set<string>();
    const mixedOrders = new Set<string>();
    for (const seed of SEEDS.slice(0, 50)) {
      topicOrders.add(ids(create(bank, topic("a"), seed)).join(","));
      mixedOrders.add(ids(create(bank, MIXED, seed)).join(","));
    }
    expect(topicOrders.size).toBeGreaterThanOrEqual(2);
    expect(mixedOrders.size).toBeGreaterThanOrEqual(2);
  });

  it("T-US1-5 createQuiz(bank, scope, quiz.seed) reproduces the quiz", () => {
    const bank5 = makeBank({ a: 8, b: 5, c: 2, d: 1 });
    for (const seed of [...SEEDS.slice(0, 50), -1, 2 ** 32 + 7, 3.9]) {
      for (const scope of [MIXED, topic("a")]) {
        const quiz = create(bank5, scope, seed);
        expect(create(bank5, scope, quiz.seed)).toEqual(quiz);
        expect(create(bank5, scope, quiz.seed, 4)).toEqual(
          create(bank5, scope, seed, 4),
        );
      }
    }
  });

  it("does not mutate the bank", () => {
    const frozen = makeBank({ a: 5, b: 5 });
    const snapshot = structuredClone(frozen);
    create(frozen, MIXED, 3);
    create(frozen, topic("a"), 3);
    expect(frozen).toEqual(snapshot);
  });
});

describe("createQuiz: options (T-US2-2)", () => {
  const bank: Bank = {
    schemaVersion: 1,
    contentVersion: "test",
    topics: [
      { id: "t", name: "T" },
      { id: "u", name: "U" },
    ],
    questions: [
      singleChoice("sc-1", "t"),
      singleChoice("sc-2", "t"),
      trueFalse("tf-1", "t"),
      trueFalse("tf-2", "t", "false-first"),
      trueFalse("tf-3", "u"),
      singleChoice("sc-3", "u"),
    ],
  };

  it("T-US2-2 true/false options are always True, False across many seeds", () => {
    for (const seed of SEEDS) {
      for (const scope of [topic("t"), MIXED]) {
        for (const q of create(bank, scope, seed).questions) {
          if (q.type !== "true-false") continue;
          expect(q.options).toEqual([
            { id: "true", text: "True" },
            { id: "false", text: "False" },
          ]);
          expect(q.correctOptionId).toBe("false");
        }
      }
    }
  });

  it("T-US2-2 single-choice options are a permutation and the correct ID stays valid", () => {
    const orders = new Set<string>();
    for (const seed of SEEDS) {
      for (const q of create(bank, MIXED, seed).questions) {
        if (q.type !== "single-choice") continue;
        const optionIds = q.options.map((o) => o.id);
        expect([...optionIds].sort()).toEqual(["a", "b", "c", "d"]);
        expect(optionIds).toContain(q.correctOptionId);
        expect(q.correctOptionId).toBe("c");
        // Option text travels with its ID.
        for (const option of q.options) {
          expect(option.text).toBe(`${q.id} ${option.id.toUpperCase()}`);
        }
        orders.add(optionIds.join(""));
      }
    }
    expect(orders.size).toBeGreaterThanOrEqual(2);
  });

  it("T-US2-2 copies the remaining question fields from the bank", () => {
    const quiz = create(bank, topic("u"), 5);
    const sc = quiz.questions.find((q) => q.id === "sc-3");
    expect(sc).toMatchObject({
      id: "sc-3",
      topicId: "u",
      type: "single-choice",
      difficulty: "easy",
      prompt: "Prompt sc-3",
      correctOptionId: "c",
      explanation: "Explanation for sc-3.",
      sourceUrl: "https://example.org/sc-3",
    });
    expect(Object.keys(sc ?? {}).sort()).toEqual(
      [
        "correctOptionId",
        "difficulty",
        "explanation",
        "id",
        "options",
        "prompt",
        "sourceUrl",
        "topicId",
        "type",
      ].sort(),
    );
  });
});

describe("createQuiz: true/false fallback order", () => {
  it("T-US2-2 keeps a stable, unshuffled order for unexpected true/false option IDs", () => {
    // isBank accepts any unique option IDs; the content validator would reject these.
    const odd: Bank = {
      schemaVersion: 1,
      contentVersion: "test",
      topics: [{ id: "t", name: "T" }],
      questions: [
        {
          ...trueFalse("tf-odd", "t"),
          options: [
            { id: "no", text: "No" },
            { id: "false", text: "False" },
            { id: "yes", text: "Yes" },
            { id: "true", text: "True" },
          ],
          correct: "yes",
        },
      ],
    };
    expect(isBank(odd)).toBe(true);
    for (const seed of SEEDS.slice(0, 50)) {
      const [q] = create(odd, topic("t"), seed).questions;
      // Known IDs first ("true", "false"), unknown IDs after in bank order.
      expect(q?.options.map((o) => o.id)).toEqual([
        "true",
        "false",
        "no",
        "yes",
      ]);
      expect(q?.correctOptionId).toBe("yes");
    }
  });
});

describe("createQuiz: errors (never throws)", () => {
  it("returns unknown-topic for a topic not in the bank", () => {
    expect(createQuiz(makeBank({ a: 3 }), topic("nope"), 1)).toEqual({
      ok: false,
      error: "unknown-topic",
    });
  });

  it("returns empty-topic for a curated topic with 0 questions", () => {
    expect(createQuiz(makeBank({ a: 3, b: 0 }), topic("b"), 1)).toEqual({
      ok: false,
      error: "empty-topic",
    });
  });

  it("returns empty-bank for Mixed with no questions", () => {
    expect(createQuiz(makeBank({}), MIXED, 1)).toEqual({
      ok: false,
      error: "empty-bank",
    });
    expect(createQuiz(makeBank({ a: 0 }), MIXED, 1)).toEqual({
      ok: false,
      error: "empty-bank",
    });
  });
});

/** Bank { a: 6, b: 4, c: 3 }, topic "a", seed 42 (mulberry32). */
const EXPECTED_TOPIC_A_SEED_42 = ["a-2", "a-1", "a-5", "a-6", "a-3", "a-4"];
/** Option ID order per question above, joined. */
const EXPECTED_TOPIC_A_SEED_42_OPTIONS = [
  "dbac",
  "cabd",
  "bacd",
  "dcba",
  "bdac",
  "cbad",
];
/** Bank { a: 6, b: 4, c: 3 }, Mixed, seed 1 (mulberry32). */
const EXPECTED_MIXED_SEED_1 = [
  "a-1",
  "b-3",
  "b-1",
  "a-3",
  "b-4",
  "b-2",
  "a-6",
  "c-2",
  "c-1",
  "a-5",
];
