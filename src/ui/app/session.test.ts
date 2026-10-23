import { describe, expect, it } from "vitest";
import { createQuiz } from "../../domain";
import { buildRetryQuiz, retryAvailability, sessionReducer } from "./session";
import { TEST_BANK } from "./testBank";

const created = createQuiz(TEST_BANK, { kind: "mixed" }, 1);
if (!created.ok) throw new Error("test quiz could not be created");
const quiz = created.quiz;

describe("sessionReducer (T-12, standard 8)", () => {
  it("starts a session on question 1 and clears it on exit", () => {
    const started = sessionReducer(null, { type: "started", quiz });
    expect(started).toMatchObject({ quiz, index: 0, phase: "answering" });
    expect(sessionReducer(started, { type: "exited" })).toBe(null);
  });

  it("delegates select, submit and next to the domain reducer", () => {
    let state = sessionReducer(null, { type: "started", quiz });
    state = sessionReducer(state, { type: "select", optionId: "true" });
    state = sessionReducer(state, { type: "submit" });
    expect(state?.phase).toBe("feedback");
    expect(state?.answers).toEqual([
      { questionId: "q-1", optionId: "true", correct: true },
    ]);
    const again = sessionReducer(state, { type: "submit" });
    expect(again).toBe(state);
    expect(sessionReducer(state, { type: "next" })?.phase).toBe("finished");
  });

  it("ignores quiz actions when no quiz is in progress", () => {
    expect(sessionReducer(null, { type: "submit" })).toBe(null);
    expect(sessionReducer(null, { type: "next" })).toBe(null);
  });

  it("replaces a running session when a new quiz starts", () => {
    let state = sessionReducer(null, { type: "started", quiz });
    state = sessionReducer(state, { type: "select", optionId: "true" });
    state = sessionReducer(state, { type: "started", quiz });
    expect(state?.selected).toBe(null);
    expect(state?.answers).toEqual([]);
  });
});

describe("retry helpers (T-38; US-5.4, US-5.6, views.md §8.5)", () => {
  const base = TEST_BANK.questions[0];
  if (base === undefined) throw new Error("no test question");
  const bank = {
    ...TEST_BANK,
    questions: ["q-1", "q-2", "q-3"].map((id) => ({ ...base, id })),
  };
  const made = createQuiz(bank, { kind: "topic", topicId: "topic-a" }, 7);
  if (!made.ok) throw new Error("test quiz could not be created");
  const topicQuiz = made.quiz;
  const order = topicQuiz.questions.map((q) => q.id);

  function finishedWith(correct: readonly boolean[]) {
    let state = sessionReducer(null, { type: "started", quiz: topicQuiz });
    for (const ok of correct) {
      state = sessionReducer(state, {
        type: "select",
        optionId: ok ? "true" : "false",
      });
      state = sessionReducer(state, { type: "submit" });
      state = sessionReducer(state, { type: "next" });
    }
    if (state?.phase !== "finished") throw new Error("not finished");
    return state;
  }

  it("counts 0 missed after a perfect run", () => {
    expect(retryAvailability(bank, finishedWith([true, true, true]))).toEqual({
      missed: 0,
      available: 0,
    });
  });

  it("builds a retry-missed quiz of exactly the missed questions, in quiz order", () => {
    const session = finishedWith([false, true, false]);
    expect(retryAvailability(bank, session)).toEqual({
      missed: 2,
      available: 2,
    });
    const retry = buildRetryQuiz(bank, session, 3);
    if (!retry.ok) throw new Error("retry failed");
    expect(retry.quiz.mode).toBe("retry-missed");
    expect(retry.quiz.scope).toEqual(topicQuiz.scope);
    expect(retry.quiz.questions.map((q) => q.id)).toEqual([order[0], order[2]]);
  });

  it("counts against the current bank: some removed, then none remaining", () => {
    const session = finishedWith([false, false, true]);
    const fewer = {
      ...bank,
      questions: bank.questions.filter((q) => q.id !== order[0]),
    };
    expect(retryAvailability(fewer, session)).toEqual({
      missed: 2,
      available: 1,
    });
    const none = {
      ...bank,
      questions: bank.questions.filter(
        (q) => q.id !== order[0] && q.id !== order[1],
      ),
    };
    expect(retryAvailability(none, session)).toEqual({
      missed: 2,
      available: 0,
    });
    expect(buildRetryQuiz(none, session, 1)).toEqual({
      ok: false,
      error: "none-remaining",
    });
  });
});
