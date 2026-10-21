import { describe, expect, it } from "vitest";
import { createQuiz } from "../../domain";
import { sessionReducer } from "./session";
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
