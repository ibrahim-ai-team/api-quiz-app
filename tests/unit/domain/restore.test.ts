/**
 * toSavedSession / restoreQuiz (T-41; US-6, FR-20, decision A4). Restores the
 * exact session (question order, option order, locked answers, index) or
 * returns `stale`; a contentVersion change restores only when every ID and
 * option set still matches, recomputing `correct` from the current bank.
 */
import { describe, expect, it } from "vitest";
import type { Bank, BankQuestion } from "../../../src/content/types.ts";
import * as domain from "../../../src/domain/index.ts";
import {
  createQuiz,
  createRetryQuiz,
  createSeededRng,
  isConsistentSavedSession,
  missedQuestionIds,
  next,
  restoreQuiz,
  selectOption,
  startSession,
  submitAnswer,
  toSavedSession,
  type Quiz,
  type QuizScope,
  type QuizSession,
  type RestoreQuizResult,
  type SavedSession,
} from "../../../src/domain/index.ts";
import { SEEDS, singleChoice, trueFalse } from "./helpers.ts";

const SAVED_AT = 1_761_200_000_000;
const MIXED: QuizScope = { kind: "mixed" };
const TOPIC_T: QuizScope = { kind: "topic", topicId: "t" };

const bank: Bank = {
  schemaVersion: 1,
  contentVersion: "cv-1",
  topics: [
    { id: "t", name: "T" },
    { id: "u", name: "U" },
    { id: "v", name: "V" },
  ],
  questions: [
    singleChoice("t-1", "t"),
    singleChoice("t-2", "t"),
    trueFalse("t-3", "t", "false-first"),
    singleChoice("t-4", "t"),
    singleChoice("u-1", "u"),
    trueFalse("u-2", "u"),
    singleChoice("v-1", "v"),
    singleChoice("v-2", "v"),
  ],
};

function quizOf(
  result: ReturnType<typeof createQuiz> | ReturnType<typeof createRetryQuiz>,
): Quiz {
  if (!result.ok) throw new Error(result.error);
  return result.quiz;
}

/**
 * Answers `count` questions with options picked by `seed`; when `pending` is
 * true the last answered question is left in feedback.
 */
function play(
  quiz: Quiz,
  count: number,
  seed: number,
  pending = false,
): QuizSession {
  const rng = createSeededRng(seed);
  let session = startSession(quiz);
  for (let i = 0; i < count; i += 1) {
    const question = session.quiz.questions[session.index];
    if (question === undefined) break;
    const option =
      question.options[Math.floor(rng.next() * question.options.length)];
    if (option === undefined) break;
    session = submitAnswer(selectOption(session, option.id));
    if (!(pending && i === count - 1)) session = next(session);
  }
  return session;
}

function restored(result: RestoreQuizResult): QuizSession {
  if (!result.ok) throw new Error(`expected restore, got ${result.reason}`);
  return result.session;
}

function roundTrip(session: QuizSession, against: Bank = bank) {
  return restoreQuiz(against, toSavedSession(session, SAVED_AT));
}

describe("toSavedSession", () => {
  it("stores only IDs, order, answers, index, versions and the timestamp", () => {
    const quiz = quizOf(createQuiz(bank, TOPIC_T, 7, 3));
    const session = play(quiz, 2, 1, true);
    const saved = toSavedSession(session, SAVED_AT);
    expect(Object.keys(saved).sort()).toEqual(
      [
        "answers",
        "contentVersion",
        "index",
        "mode",
        "optionOrder",
        "questionIds",
        "savedAt",
        "schemaVersion",
        "scope",
        "seed",
      ].sort(),
    );
    expect(saved.questionIds).toEqual(quiz.questions.map((q) => q.id));
    expect(saved.optionOrder).toEqual(
      quiz.questions.map((q) => q.options.map((o) => o.id)),
    );
    expect(saved.answers).toEqual(
      session.answers.map((a) => ({ q: a.questionId, o: a.optionId })),
    );
    expect(saved.index).toBe(1);
    expect(JSON.stringify(saved)).not.toContain("correct");
    expect(JSON.stringify(saved)).not.toContain("Prompt");
    expect(isConsistentSavedSession(saved)).toBe(true);
  });

  it("is exported from the domain index", () => {
    expect(domain.restoreQuiz).toBe(restoreQuiz);
    expect(domain.toSavedSession).toBe(toSavedSession);
    expect(domain.SAVED_SESSION_SCHEMA_VERSION).toBe(1);
  });
});

describe("restoreQuiz round trip (same contentVersion)", () => {
  it("restores every answering and feedback state exactly, for many seeds", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      for (const scope of [MIXED, TOPIC_T]) {
        const quiz = quizOf(createQuiz(bank, scope, seed, 4));
        for (let count = 0; count < quiz.questions.length; count += 1) {
          for (const pending of [false, true]) {
            if (pending && count === 0) continue;
            const session = play(quiz, count, seed, pending);
            const result = roundTrip(session);
            expect(result).toEqual({
              ok: true,
              session,
              contentChanged: false,
            });
          }
        }
      }
    }
  });

  it("drops a pending (unsubmitted) selection", () => {
    const quiz = quizOf(createQuiz(bank, MIXED, 3, 4));
    const session = selectOption(
      startSession(quiz),
      quiz.questions[0]?.options[0]?.id ?? "",
    );
    expect(session.selected).not.toBeNull();
    expect(restored(roundTrip(session))).toEqual({
      ...session,
      selected: null,
    });
  });

  it("restores a finished session as feedback on the last question", () => {
    const quiz = quizOf(createQuiz(bank, TOPIC_T, 5, 4));
    const finished = play(quiz, 4, 5);
    expect(finished.phase).toBe("finished");
    const session = restored(roundTrip(finished));
    expect(session.phase).toBe("feedback");
    expect(session.answers).toEqual(finished.answers);
    expect(next(session)).toEqual(finished);
  });

  it("round-trips retry-missed sessions, including a retry of a retry", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const first = play(quizOf(createQuiz(bank, MIXED, seed, 6)), 6, seed);
      const missed = missedQuestionIds(first);
      if (missed.length === 0) continue;
      const retry = quizOf(createRetryQuiz(bank, missed, seed + 1, MIXED));
      for (let count = 0; count < retry.questions.length; count += 1) {
        const session = play(retry, count, seed, count > 0);
        expect(roundTrip(session)).toEqual({
          ok: true,
          session,
          contentChanged: false,
        });
      }
      const retryDone = play(retry, retry.questions.length, seed + 2);
      const missedAgain = missedQuestionIds(retryDone);
      if (missedAgain.length === 0) continue;
      const again = quizOf(
        createRetryQuiz(bank, missedAgain, seed + 3, retry.scope),
      );
      const session = play(again, 0, seed);
      expect(restored(roundTrip(session)).quiz).toEqual(again);
    }
  });

  it("recomputes correct flags from the bank instead of trusting them", () => {
    const quiz = quizOf(createQuiz(bank, TOPIC_T, 9, 3));
    const session = play(quiz, 2, 9);
    const forged: QuizSession = {
      ...session,
      answers: session.answers.map((a) => ({ ...a, correct: !a.correct })),
    };
    expect(restored(roundTrip(forged)).answers).toEqual(session.answers);
  });
});

describe("restoreQuiz stale and inconsistent sessions", () => {
  const quiz = quizOf(createQuiz(bank, TOPIC_T, 11, 3));
  const base = toSavedSession(play(quiz, 1, 11, true), SAVED_AT);
  const withQuestions = (questions: BankQuestion[]): Bank => ({
    ...bank,
    questions,
  });
  const firstId = base.questionIds[0] ?? "";
  const lastId = base.questionIds[2] ?? "";

  const cases: [string, SavedSession, Bank][] = [
    [
      "a saved question is gone",
      base,
      withQuestions(bank.questions.filter((q) => q.id !== lastId)),
    ],
    [
      "an option was removed",
      base,
      withQuestions(
        bank.questions.map((q) =>
          q.id === lastId ? { ...q, options: q.options.slice(1) } : q,
        ),
      ),
    ],
    [
      "an option was added",
      base,
      withQuestions(
        bank.questions.map((q) =>
          q.id === firstId
            ? { ...q, options: [...q.options, { id: "z", text: "Z" }] }
            : q,
        ),
      ),
    ],
    [
      "the scope topic is gone",
      base,
      { ...bank, topics: bank.topics.filter((t) => t.id !== "t") },
    ],
    [
      "a question moved to another topic",
      base,
      withQuestions(
        bank.questions.map((q) => (q.id === lastId ? { ...q, topic: "u" } : q)),
      ),
    ],
    [
      "the questions were reordered",
      {
        ...base,
        index: 0,
        answers: [],
        questionIds: [...base.questionIds].reverse(),
        optionOrder: [...base.optionOrder].reverse(),
      },
      bank,
    ],
    [
      "an option order was changed",
      {
        ...base,
        optionOrder: base.optionOrder.map((order, i) =>
          i === 0 ? [...order].reverse() : order,
        ),
      },
      bank,
    ],
    ["the seed was changed", { ...base, seed: base.seed + 1 }, bank],
    ["the mode was changed", { ...base, mode: "retry-missed" }, bank],
    ["the index is out of range", { ...base, index: 3 }, bank],
    ["the index is negative", { ...base, index: -1 }, bank],
    ["the index is fractional", { ...base, index: 0.5 }, bank],
    ["answers lag the index", { ...base, index: 2 }, bank],
    [
      "answers run ahead of the index",
      {
        ...base,
        index: 0,
        answers: [...base.answers, { q: base.questionIds[1] ?? "", o: "a" }],
      },
      bank,
    ],
    [
      "an answer names another question",
      { ...base, answers: [{ q: lastId, o: "a" }] },
      bank,
    ],
    [
      "an answer names an unknown option",
      { ...base, answers: [{ q: firstId, o: "zz" }] },
      bank,
    ],
    [
      "question IDs are duplicated",
      { ...base, questionIds: [firstId, firstId, lastId] },
      bank,
    ],
    [
      "option IDs are duplicated",
      {
        ...base,
        optionOrder: base.optionOrder.map((o) => [o[0] ?? "", o[0] ?? ""]),
      },
      bank,
    ],
    [
      "there are no questions",
      { ...base, questionIds: [], optionOrder: [], answers: [], index: 0 },
      bank,
    ],
    ["the seed is not uint32", { ...base, seed: -1 }, bank],
  ];

  it.each(cases)("is stale when %s", (_name, saved, against) => {
    expect(restoreQuiz(against, saved)).toEqual({ ok: false, reason: "stale" });
  });

  it("returns stale without throwing for a different-version reorder that drops IDs", () => {
    const other = { ...bank, contentVersion: "cv-2", questions: [] };
    expect(restoreQuiz(other, base)).toEqual({ ok: false, reason: "stale" });
  });
});

describe("restoreQuiz after a contentVersion change (decision A4)", () => {
  const quiz = quizOf(createQuiz(bank, MIXED, 21, 5));
  const session = play(quiz, 3, 21, true);
  const saved = toSavedSession(session, SAVED_AT);
  const answeredIds = new Set(saved.answers.map((a) => a.q));

  /** Edited content: text changes and a new correct option, same IDs. */
  const edited: Bank = {
    ...bank,
    contentVersion: "cv-2",
    questions: [
      ...bank.questions.map((q) =>
        answeredIds.has(q.id)
          ? {
              ...q,
              prompt: `${q.prompt} (edited)`,
              correct: q.options[0]?.id ?? q.correct,
              options: [...q.options].reverse(),
            }
          : q,
      ),
      singleChoice("w-new", "v"),
    ],
  };

  it("restores the saved order with current text and recomputed correct", () => {
    const result = restoreQuiz(edited, saved);
    expect(result.ok && result.contentChanged).toBe(true);
    const restoredSession = restored(result);
    expect(restoredSession.quiz.questions.map((q) => q.id)).toEqual(
      saved.questionIds,
    );
    expect(
      restoredSession.quiz.questions.map((q) => q.options.map((o) => o.id)),
    ).toEqual(saved.optionOrder);
    expect(restoredSession.index).toBe(saved.index);
    expect(restoredSession.phase).toBe("feedback");
    expect(restoredSession.quiz.contentVersion).toBe("cv-1");
    for (const [i, answer] of restoredSession.answers.entries()) {
      const bankQuestion = edited.questions.find(
        (q) => q.id === answer.questionId,
      );
      expect(answer.optionId).toBe(saved.answers[i]?.o);
      expect(answer.correct).toBe(answer.optionId === bankQuestion?.correct);
      expect(restoredSession.quiz.questions[i]?.prompt).toContain("(edited)");
      expect(restoredSession.quiz.questions[i]?.correctOptionId).toBe(
        bankQuestion?.correct,
      );
    }
  });

  it("can be saved and restored again against the new bank", () => {
    const again = restoreQuiz(
      edited,
      toSavedSession(restored(restoreQuiz(edited, saved)), SAVED_AT + 1),
    );
    expect(again.ok && again.contentChanged).toBe(true);
  });

  it("accepts any order of the same option set, but not a different set", () => {
    const reordered: SavedSession = {
      ...saved,
      optionOrder: saved.optionOrder.map((o) => [...o].reverse()),
    };
    expect(restoreQuiz(edited, reordered).ok).toBe(true);
    expect(restoreQuiz(bank, reordered)).toEqual({
      ok: false,
      reason: "stale",
    });

    const changedSet: Bank = {
      ...edited,
      questions: edited.questions.map((q) =>
        q.id === saved.questionIds[4]
          ? {
              ...q,
              options: q.options.map((o, i) =>
                i === 0 ? { ...o, id: "renamed" } : o,
              ),
            }
          : q,
      ),
    };
    expect(restoreQuiz(changedSet, saved)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("is stale when any saved question was removed", () => {
    const removed: Bank = {
      ...edited,
      questions: edited.questions.filter((q) => q.id !== saved.questionIds[4]),
    };
    expect(restoreQuiz(removed, saved)).toEqual({ ok: false, reason: "stale" });
  });
});
