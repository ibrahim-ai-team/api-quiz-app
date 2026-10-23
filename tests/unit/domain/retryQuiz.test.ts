/**
 * missedQuestionIds and createRetryQuiz (T-37; US-5.4, US-5.6, decision A1).
 */
import { describe, expect, it } from "vitest";
import type { Bank } from "../../../src/content/types.ts";
import { createQuiz } from "../../../src/domain/createQuiz.ts";
import * as domain from "../../../src/domain/index.ts";
import {
  createRetryQuiz,
  missedQuestionIds,
} from "../../../src/domain/retryQuiz.ts";
import { createSeededRng, shuffle } from "../../../src/domain/rng.ts";
import type {
  Answer,
  CreateQuizResult,
  CreateRetryQuizResult,
  Quiz,
  QuizScope,
} from "../../../src/domain/types.ts";
import { makeBank, SEEDS, singleChoice, trueFalse } from "./helpers.ts";

function quizOf(result: CreateQuizResult | CreateRetryQuizResult): Quiz {
  if (!result.ok) throw new Error(`expected a quiz, got ${result.error}`);
  return result.quiz;
}

const ids = (quiz: Quiz): string[] => quiz.questions.map((q) => q.id);
const optionIds = (quiz: Quiz): string[][] =>
  quiz.questions.map((q) => q.options.map((o) => o.id));

const MIXED: QuizScope = { kind: "mixed" };
const TOPIC_T: QuizScope = { kind: "topic", topicId: "t" };

const bank: Bank = {
  schemaVersion: 1,
  contentVersion: "cv-1",
  topics: [
    { id: "t", name: "T" },
    { id: "u", name: "U" },
  ],
  questions: [
    singleChoice("sc-1", "t"),
    trueFalse("tf-1", "t", "false-first"),
    singleChoice("sc-2", "u"),
    singleChoice("sc-3", "t"),
    trueFalse("tf-2", "u"),
  ],
};

function answer(questionId: string, correct: boolean): Answer {
  return { questionId, optionId: correct ? "c" : "a", correct };
}

/** Answers every question of `quiz`, missing those in `missed`. */
function answersFor(quiz: Quiz, missed: ReadonlySet<string>): Answer[] {
  return quiz.questions.map((q) => answer(q.id, !missed.has(q.id)));
}

describe("missedQuestionIds", () => {
  it("returns incorrect answers in quiz order", () => {
    const answers = [
      answer("q3", false),
      answer("q1", true),
      answer("q5", false),
      answer("q2", false),
    ];
    expect(missedQuestionIds({ answers })).toEqual(["q3", "q5", "q2"]);
  });

  it("is empty for no answers or all correct", () => {
    expect(missedQuestionIds({ answers: [] })).toEqual([]);
    expect(missedQuestionIds({ answers: [answer("q1", true)] })).toEqual([]);
  });

  it("works on a QuizSession and reports a repeated ID once", () => {
    const quiz = quizOf(createQuiz(bank, MIXED, 3, 5));
    const session = {
      ...domain.startSession(quiz),
      answers: [answer("x", false), answer("x", false)],
    };
    expect(missedQuestionIds(session)).toEqual(["x"]);
  });
});

describe("createRetryQuiz", () => {
  it("keeps the missed questions in their original quiz order (A1)", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const quiz = quizOf(createQuiz(bank, MIXED, seed, 5));
      const missed = ids(quiz).filter((_, i) => i % 2 === 0);
      const retry = quizOf(createRetryQuiz(bank, missed, seed + 1, MIXED));
      expect(ids(retry)).toEqual(missed);
    }
  });

  it("sets mode retry-missed, the bank contentVersion and the original scope", () => {
    const retry = quizOf(createRetryQuiz(bank, ["sc-1"], -1, TOPIC_T));
    expect(retry.mode).toBe("retry-missed");
    expect(retry.contentVersion).toBe("cv-1");
    expect(retry.scope).toEqual(TOPIC_T);
    expect(retry.seed).toBe(2 ** 32 - 1);
    const other = { ...bank, contentVersion: "cv-2" };
    expect(
      quizOf(createRetryQuiz(other, ["sc-1"], 1, MIXED)).contentVersion,
    ).toBe("cv-2");
  });

  it("is deterministic for the same inputs and reproducible from quiz.seed", () => {
    const missed = ["sc-3", "tf-1", "sc-1", "sc-2"];
    for (const seed of SEEDS) {
      const a = quizOf(createRetryQuiz(bank, missed, seed, MIXED));
      expect(createRetryQuiz(bank, missed, seed, MIXED)).toEqual({
        ok: true,
        quiz: a,
      });
      expect(quizOf(createRetryQuiz(bank, missed, a.seed, MIXED))).toEqual(a);
    }
  });

  it("shuffles single-choice options with the seeded RNG as createQuiz does", () => {
    const missed = ["sc-3", "tf-1", "sc-1"];
    const seed = 12345;
    const retry = quizOf(createRetryQuiz(bank, missed, seed, MIXED));
    // Expected: one shuffle per single-choice question in order; true/false
    // consumes no randomness.
    const rng = createSeededRng(seed);
    const options = ["a", "b", "c", "d"];
    const sc3 = shuffle(options, rng);
    const sc1 = shuffle(options, rng);
    expect(optionIds(retry)).toEqual([sc3, ["true", "false"], sc1]);
    // Option text travels with its ID and the correct ID is unchanged.
    for (const q of retry.questions) {
      for (const o of q.options) {
        if (q.type === "single-choice") {
          expect(o.text).toBe(`${q.id} ${o.id.toUpperCase()}`);
        }
      }
    }
    expect(retry.questions.map((q) => q.correctOptionId)).toEqual([
      "c",
      "false",
      "c",
    ]);
  });

  it("reshuffles options relative to the original quiz; true/false stays fixed", () => {
    const quiz = quizOf(createQuiz(bank, MIXED, 1, 5));
    const missed = ids(quiz);
    const original = new Map(
      quiz.questions.map((q) => [q.id, q.options.map((o) => o.id).join("")]),
    );
    let differs = 0;
    for (const seed of SEEDS.slice(0, 20)) {
      const retry = quizOf(createRetryQuiz(bank, missed, seed, MIXED));
      for (const q of retry.questions) {
        const order = q.options.map((o) => o.id).join("");
        if (q.type === "true-false") {
          expect(order).toBe("truefalse");
        } else if (order !== original.get(q.id)) {
          differs += 1;
        }
      }
    }
    expect(differs).toBeGreaterThan(0);
    // A concrete seed where at least one single-choice order changes.
    const retry = quizOf(createRetryQuiz(bank, missed, 2, MIXED));
    expect(
      retry.questions.some(
        (q) =>
          q.type === "single-choice" &&
          q.options.map((o) => o.id).join("") !== original.get(q.id),
      ),
    ).toBe(true);
  });

  it("drops IDs no longer in the current bank (US-5.6) and repeated IDs", () => {
    const retry = quizOf(
      createRetryQuiz(
        bank,
        ["gone-1", "sc-2", "sc-2", "gone-2", "tf-2"],
        9,
        MIXED,
      ),
    );
    expect(ids(retry)).toEqual(["sc-2", "tf-2"]);
  });

  it("returns none-remaining when nothing is left", () => {
    expect(createRetryQuiz(bank, [], 1, MIXED)).toEqual({
      ok: false,
      error: "none-remaining",
    });
    expect(createRetryQuiz(bank, ["gone"], 1, TOPIC_T)).toEqual({
      ok: false,
      error: "none-remaining",
    });
    const emptied = { ...makeBank({ t: 2 }), questions: [] };
    expect(createRetryQuiz(emptied, ["t-1"], 1, TOPIC_T).ok).toBe(false);
  });

  it("works for a single missed question (N = 1)", () => {
    const retry = quizOf(createRetryQuiz(bank, ["sc-1"], 4, TOPIC_T));
    expect(ids(retry)).toEqual(["sc-1"]);
    expect(domain.progress(domain.startSession(retry))).toEqual({
      current: 1,
      total: 1,
    });
  });

  it("can retry a retry quiz's own missed questions (US-5.4)", () => {
    const quiz = quizOf(createQuiz(bank, MIXED, 77, 5));
    const first = missedQuestionIds({
      answers: answersFor(quiz, new Set(["sc-1", "tf-1", "sc-2"])),
    });
    const retry1 = quizOf(createRetryQuiz(bank, first, 78, quiz.scope));
    expect(ids(retry1)).toEqual(first);

    const second = missedQuestionIds({
      answers: answersFor(retry1, new Set(["sc-2", "sc-1"])),
    });
    const retry2 = quizOf(createRetryQuiz(bank, second, 79, retry1.scope));
    expect(ids(retry2)).toEqual(first.filter((id) => second.includes(id)));
    expect(retry2.mode).toBe("retry-missed");
    expect(retry2.scope).toEqual(quiz.scope);

    const none = missedQuestionIds({ answers: answersFor(retry2, new Set()) });
    expect(createRetryQuiz(bank, none, 80, retry2.scope)).toEqual({
      ok: false,
      error: "none-remaining",
    });
  });

  it("is exported from the domain index", () => {
    expect(domain.createRetryQuiz).toBe(createRetryQuiz);
    expect(domain.missedQuestionIds).toBe(missedQuestionIds);
  });
});
