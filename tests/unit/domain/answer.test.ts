/**
 * Answering a quiz (T-11). Test IDs follow docs/qa/ac-test-matrix.md:
 * T-US2-4 (submit locks the answer), T-US2-5 (double Submit, or Submit then
 * Next rapidly, records 1 answer and advances exactly 1; F-4, F-8 domain
 * part). Also covers US-2.3 (no submit without a selection) and US-3.4
 * (finish after the last question).
 */
import { describe, expect, it } from "vitest";
import {
  currentAnswer,
  currentQuestion,
  isLastQuestion,
  next,
  progress,
  quizReducer,
  selectOption,
  startSession,
  submitAnswer,
} from "../../../src/domain/answer.ts";
import { createQuiz } from "../../../src/domain/createQuiz.ts";
import * as domain from "../../../src/domain/index.ts";
import type {
  Quiz,
  QuizAction,
  QuizQuestion,
  QuizSession,
} from "../../../src/domain/types.ts";
import { makeBank } from "./helpers.ts";

function question(id: string, correctOptionId = "b"): QuizQuestion {
  return {
    id,
    topicId: "http",
    type: "single-choice",
    difficulty: "easy",
    prompt: `Prompt ${id}`,
    options: [
      { id: "a", text: "A" },
      { id: "b", text: "B" },
      { id: "c", text: "C" },
    ],
    correctOptionId,
    explanation: `Explanation for ${id}.`,
    sourceUrl: `https://example.org/${id}`,
  };
}

function quizOf(count: number): Quiz {
  return {
    scope: { kind: "topic", topicId: "http" },
    seed: 42,
    questions: Array.from({ length: count }, (_, i) =>
      question(`q${String(i + 1)}`),
    ),
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Select then submit `optionId` on the current question. */
function answer(state: QuizSession, optionId: string): QuizSession {
  return submitAnswer(selectOption(state, optionId));
}

describe("startSession and selectors", () => {
  it("starts answering question 1 with nothing selected or answered", () => {
    const quiz = quizOf(3);
    const state = startSession(quiz);
    expect(state).toEqual({
      quiz,
      index: 0,
      selected: null,
      answers: [],
      phase: "answering",
    });
    expect(state.quiz).toBe(quiz);
    expect(currentQuestion(state)?.id).toBe("q1");
    expect(currentAnswer(state)).toBeUndefined();
    expect(progress(state)).toEqual({ current: 1, total: 3 });
    expect(isLastQuestion(state)).toBe(false);
  });

  it("an empty quiz starts finished and every call is a safe no-op", () => {
    const state = startSession(quizOf(0));
    expect(state.phase).toBe("finished");
    expect(currentQuestion(state)).toBeUndefined();
    expect(currentAnswer(state)).toBeUndefined();
    expect(progress(state)).toEqual({ current: 1, total: 0 });
    expect(selectOption(state, "a")).toBe(state);
    expect(submitAnswer(state)).toBe(state);
    expect(next(state)).toBe(state);
  });

  it("works on a quiz built by createQuiz", () => {
    const result = createQuiz(makeBank({ t: 3 }), { kind: "mixed" }, 7, 3);
    if (!result.ok) throw new Error(result.error);
    let state = startSession(result.quiz);
    for (const q of result.quiz.questions) {
      state = next(answer(state, q.correctOptionId));
    }
    expect(state.phase).toBe("finished");
    expect(state.answers.map((a) => a.correct)).toEqual([true, true, true]);
  });
});

describe("selectOption", () => {
  it("selects and changes the selection while answering", () => {
    const s1 = selectOption(startSession(quizOf(2)), "a");
    expect(s1.selected).toBe("a");
    const s2 = selectOption(s1, "c");
    expect(s2.selected).toBe("c");
    expect(s2.answers).toEqual([]);
    expect(s2.phase).toBe("answering");
  });

  it("ignores an unknown option ID", () => {
    const state = selectOption(startSession(quizOf(2)), "a");
    expect(selectOption(state, "zzz")).toBe(state);
    expect(selectOption(state, "")).toBe(state);
  });

  it("re-selecting the selected option returns the same state", () => {
    const state = selectOption(startSession(quizOf(2)), "a");
    expect(selectOption(state, "a")).toBe(state);
  });
});

describe("submitAnswer", () => {
  it("T-US2-4: submit locks the answer and moves to feedback", () => {
    const state = answer(startSession(quizOf(2)), "a");
    expect(state.phase).toBe("feedback");
    expect(state.selected).toBe("a");
    expect(state.answers).toEqual([
      { questionId: "q1", optionId: "a", correct: false },
    ]);
    expect(currentAnswer(state)).toEqual(state.answers[0]);
  });

  it("T-US2-4: selecting another option after submit is ignored", () => {
    const state = answer(startSession(quizOf(2)), "a");
    const after = selectOption(state, "b");
    expect(after).toBe(state);
    expect(after.selected).toBe("a");
    expect(after.answers).toEqual([
      { questionId: "q1", optionId: "a", correct: false },
    ]);
  });

  it("T-US2-5: a double submit records exactly 1 answer", () => {
    const once = answer(startSession(quizOf(2)), "b");
    const twice = submitAnswer(once);
    expect(twice).toBe(once);
    expect(twice.answers).toHaveLength(1);
  });

  it("T-US2-4: submit with no selection is a no-op (US-2.3)", () => {
    const state = startSession(quizOf(2));
    expect(submitAnswer(state)).toBe(state);
  });

  it("records correct and incorrect against correctOptionId", () => {
    const quiz: Quiz = {
      ...quizOf(0),
      questions: [question("q1", "c"), question("q2", "a")],
    };
    const done = next(answer(next(answer(startSession(quiz), "c")), "b"));
    expect(done.answers).toEqual([
      { questionId: "q1", optionId: "c", correct: true },
      { questionId: "q2", optionId: "b", correct: false },
    ]);
  });

  it("is a no-op on an inconsistent state", () => {
    const base = startSession(quizOf(2));
    // Selection that is not an option of the current question.
    const badSelection: QuizSession = { ...base, selected: "zzz" };
    expect(submitAnswer(badSelection)).toBe(badSelection);
    // Current question already has an answer.
    const alreadyAnswered: QuizSession = {
      ...base,
      selected: "a",
      answers: [{ questionId: "q1", optionId: "b", correct: true }],
    };
    expect(submitAnswer(alreadyAnswered)).toBe(alreadyAnswered);
    // Index past the end.
    const outOfRange: QuizSession = { ...base, index: 5, selected: "a" };
    expect(submitAnswer(outOfRange)).toBe(outOfRange);
    expect(selectOption({ ...base, index: 5 }, "a").selected).toBeNull();
    expect(currentAnswer({ ...alreadyAnswered, index: 1 })).toBeUndefined();
  });
});

describe("next", () => {
  it("T-US2-5: next is a no-op unless feedback is shown", () => {
    const answering = startSession(quizOf(3));
    expect(next(answering)).toBe(answering);
    const selected = selectOption(answering, "a");
    expect(next(selected)).toBe(selected);
  });

  it("T-US2-5: next advances exactly 1 question and clears the selection", () => {
    const state = next(answer(startSession(quizOf(3)), "a"));
    expect(state.index).toBe(1);
    expect(state.phase).toBe("answering");
    expect(state.selected).toBeNull();
    expect(state.answers).toHaveLength(1);
    expect(currentQuestion(state)?.id).toBe("q2");
    expect(currentAnswer(state)).toBeUndefined();
    expect(progress(state)).toEqual({ current: 2, total: 3 });
  });

  it("T-US2-5: a double next advances exactly 1", () => {
    const once = next(answer(startSession(quizOf(3)), "a"));
    const twice = next(once);
    expect(twice).toBe(once);
    expect(twice.index).toBe(1);
  });

  it("T-US2-5: submit, submit, next, next advances 1 and records 1", () => {
    const start = selectOption(startSession(quizOf(3)), "b");
    const state = next(next(submitAnswer(submitAnswer(start))));
    expect(state.index).toBe(1);
    expect(state.answers).toEqual([
      { questionId: "q1", optionId: "b", correct: true },
    ]);
    expect(progress(state)).toEqual({ current: 2, total: 3 });
  });

  it("finishes after the last question and stays finished (US-3.4)", () => {
    let state = startSession(quizOf(2));
    state = next(answer(state, "b"));
    state = answer(state, "a");
    expect(isLastQuestion(state)).toBe(true);
    const finished = next(state);
    expect(finished.phase).toBe("finished");
    expect(finished.index).toBe(1);
    expect(finished.answers).toHaveLength(2);
    expect(currentAnswer(finished)?.questionId).toBe("q2");
    expect(next(finished)).toBe(finished);
    expect(submitAnswer(finished)).toBe(finished);
    expect(selectOption(finished, "c")).toBe(finished);
  });

  it("N = 1: submit then next finishes", () => {
    const state = next(answer(startSession(quizOf(1)), "b"));
    expect(state.phase).toBe("finished");
    expect(state.answers).toEqual([
      { questionId: "q1", optionId: "b", correct: true },
    ]);
  });
});

describe("purity", () => {
  it("never mutates a deep-frozen input state", () => {
    const quiz = deepFreeze(quizOf(2));
    const start = deepFreeze(startSession(quiz));
    const snapshot = structuredClone(start);
    const selected = deepFreeze(selectOption(start, "a"));
    const submitted = deepFreeze(submitAnswer(selected));
    const advanced = next(submitted);
    expect(start).toEqual(snapshot);
    expect(selected.phase).toBe("answering");
    expect(submitted.phase).toBe("feedback");
    expect(advanced.index).toBe(1);
    expect(advanced.quiz).toBe(quiz);
    expect(submitted.answers).not.toBe(selected.answers);
    expect(selected.answers).toEqual([]);
  });
});

describe("quizReducer", () => {
  it("matches the functions for every action (standard 8)", () => {
    const actions: QuizAction[] = [
      { type: "submit" },
      { type: "next" },
      { type: "select", optionId: "zzz" },
      { type: "select", optionId: "a" },
      { type: "select", optionId: "b" },
      { type: "submit" },
      { type: "submit" },
      { type: "select", optionId: "c" },
      { type: "next" },
      { type: "next" },
      { type: "select", optionId: "c" },
      { type: "submit" },
      { type: "next" },
      { type: "next" },
    ];
    let viaReducer = startSession(quizOf(2));
    let viaFunctions = viaReducer;
    for (const action of actions) {
      viaReducer = quizReducer(viaReducer, action);
      if (action.type === "select") {
        viaFunctions = selectOption(viaFunctions, action.optionId);
      } else if (action.type === "submit") {
        viaFunctions = submitAnswer(viaFunctions);
      } else {
        viaFunctions = next(viaFunctions);
      }
      expect(viaReducer).toEqual(viaFunctions);
    }
    expect(viaReducer.phase).toBe("finished");
    expect(viaReducer.answers).toEqual([
      { questionId: "q1", optionId: "b", correct: true },
      { questionId: "q2", optionId: "c", correct: false },
    ]);
  });

  it("returns the same state for an unknown action", () => {
    const state = startSession(quizOf(1));
    const unknown = { type: "reset" } as unknown as QuizAction;
    expect(quizReducer(state, unknown)).toBe(state);
  });

  it("is exported from the domain index", () => {
    expect(domain.quizReducer).toBe(quizReducer);
    expect(domain.startSession).toBe(startSession);
    expect(domain.currentAnswer).toBe(currentAnswer);
  });
});
