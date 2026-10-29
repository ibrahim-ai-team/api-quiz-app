import { describe, expect, it } from "vitest";
import { countsTowardBest, createQuiz, toSavedSession } from "../../domain";
import { KEYS, MemoryStore, type ProgressStore } from "../../storage";
import {
  buildRetryQuiz,
  checkSavedSession,
  persistSession,
  readSavedSession,
  readStartupProgress,
  retryAvailability,
  sessionReducer,
} from "./session";
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

describe("saved progress helpers (T-43; US-6.2, US-6.3, views.md §9)", () => {
  function playedOnce() {
    let state = sessionReducer(null, { type: "started", quiz });
    state = sessionReducer(state, { type: "select", optionId: "false" });
    state = sessionReducer(state, { type: "submit" });
    if (state === null) throw new Error("no session");
    return state;
  }

  it("restored puts the given session in place as is", () => {
    const session = playedOnce();
    expect(sessionReducer(null, { type: "restored", session })).toBe(session);
  });

  it("readStartupProgress flags only corrupt and unknown-version values", () => {
    const store = new MemoryStore();
    const persistent: ProgressStore = {
      persistent: true,
      get: (key) => store.get(key),
      set: (key, value) => store.set(key, value),
      remove: (key) => store.remove(key),
      clearAppKeys: () => store.clearAppKeys(),
    };
    expect(readStartupProgress(persistent)).toEqual({
      best: null,
      bestRemoved: false,
      saved: null,
      sessionRemoved: false,
    });
    store.set(KEYS.best, '{"schemaVersion":9,"scores":{}}');
    store.set(KEYS.session, "{");
    expect(readStartupProgress(persistent)).toMatchObject({
      bestRemoved: true,
      sessionRemoved: true,
    });
    // Reading never writes.
    expect(store.get(KEYS.session)).toBe("{");
    // Not persistent: nothing is read (US-6.5).
    expect(readStartupProgress(store)).toMatchObject({
      sessionRemoved: false,
      bestRemoved: false,
    });
  });

  it("persistSession saves from the first Submit, removes when finished", () => {
    const store = new MemoryStore();
    const writes: string[] = [];
    const tracking: ProgressStore = {
      persistent: true,
      get: (key) => store.get(key),
      set: (key, value) => {
        writes.push(key);
        return store.set(key, value);
      },
      remove: (key) => store.remove(key),
      clearAppKeys: () => store.clearAppKeys(),
    };
    const started = sessionReducer(null, { type: "started", quiz });
    if (started === null) throw new Error("no session");
    persistSession(tracking, started, 1);
    expect(writes).toEqual([]);
    const answered = playedOnce();
    persistSession(tracking, answered, 1);
    expect(readSavedSession(tracking)).toMatchObject({
      index: 0,
      answers: [{ q: "q-1", o: "false" }],
    });
    const finished = sessionReducer(answered, { type: "next" });
    if (finished === null) throw new Error("no session");
    persistSession(tracking, finished, 2);
    expect(store.get(KEYS.session)).toBe(null);
  });

  it("checkSavedSession restores, reports stale, and skips a bank with no playable topic", () => {
    const saved = toSavedSession(playedOnce(), 1);
    const ok = checkSavedSession(TEST_BANK, saved);
    expect(ok?.ok).toBe(true);
    expect(
      checkSavedSession(TEST_BANK, { ...saved, questionIds: ["gone"] }),
    ).toEqual({ ok: false, reason: "stale" });
    expect(checkSavedSession({ ...TEST_BANK, questions: [] }, saved)).toBe(
      null,
    );
  });

  it("SEC-R15 N1 a restore across a content change never counts toward the best score", () => {
    const saved = {
      ...toSavedSession(playedOnce(), 1),
      contentVersion: "older-v0",
    };
    const restored = checkSavedSession(TEST_BANK, saved);
    if (restored?.ok !== true) throw new Error("not restored");
    expect(restored.contentChanged).toBe(true);
    expect(
      countsTowardBest(restored.session.quiz, TEST_BANK.contentVersion),
    ).toBe(false);
  });
});
