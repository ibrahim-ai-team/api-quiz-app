// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadBankResult } from "../../content/loader";
import { landingReserve } from "../../content/landingReserve";
import {
  createProgressStore,
  decodeBest,
  KEYS,
  MemoryStore,
  type ProgressStore,
  type WriteResult,
} from "../../storage";
import { strings } from "../strings";
import { App } from "./App";
import { LOADING_DELAY_MS, STILL_LOADING_MS } from "../components/BankStatus";
import { deferred, FAILED, OK, TEST_BANK } from "./testBank";

function setHash(hash: string): void {
  window.history.replaceState(null, "", `/${hash}`);
}

/** Navigates like a link click: new hash plus the hashchange event. */
function navigate(hash: string): void {
  act(() => {
    const oldURL = window.location.href;
    setHash(hash);
    window.dispatchEvent(
      new HashChangeEvent("hashchange", {
        oldURL,
        newURL: window.location.href,
      }),
    );
  });
}

/** Selects the only topic in TEST_BANK and starts a 1-question quiz. */
async function startQuiz(): Promise<void> {
  fireEvent.click(screen.getByRole("radio"));
  fireEvent.click(screen.getByRole("button", { name: strings.landing.start }));
  await waitFor(() => {
    expect(window.location.hash).toBe("#/quiz");
    expect(h1().textContent).toBe(strings.question.heading(1, 1));
  });
}

/** Waits until Landing is shown at `#/` with its h1 focused. */
async function expectLandingFocused(): Promise<void> {
  await waitFor(() => {
    expect(window.location.hash).toBe("#/");
    expect(h1().textContent).toContain(strings.landing.heading);
    expect(document.activeElement).toBe(h1());
  });
}

/** Answers the 1-question quiz correctly and presses See results. */
function finishQuiz(): void {
  fireEvent.click(screen.getByRole("radio", { name: "True" }));
  fireEvent.click(
    screen.getByRole("button", { name: strings.question.submit }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: strings.feedback.seeResults }),
  );
}

/** Waits until Results is shown at `#/results` with its h1 focused. */
async function expectResultsFocused(): Promise<void> {
  await waitFor(() => {
    expect(window.location.hash).toBe("#/results");
    expect(h1().textContent).toBe(strings.results.heading);
    expect(document.activeElement).toBe(h1());
  });
}

/** Lets resolved loader promises reach the reducer. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderApp(
  bankPromise: Promise<LoadBankResult>,
  reloadBank: () => Promise<LoadBankResult> = () => Promise.resolve(OK),
  store?: ProgressStore,
) {
  const reload = vi.fn(reloadBank);
  const view = render(
    <App
      bankPromise={bankPromise}
      reloadBank={reload}
      {...(store === undefined ? {} : { store })}
    />,
  );
  return { ...view, reload };
}

function main(): HTMLElement {
  return screen.getByRole("main");
}

function h1(): HTMLElement {
  return screen.getByRole("heading", { level: 1 });
}

beforeEach(() => {
  setHash("");
  document.title = "";
  // jsdom has Web Storage, so the default store is persistent: clear it.
  createProgressStore().clearAppKeys();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("T-US12-4 loading indicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows nothing before 300 ms, then the loading text in a status region", () => {
    renderApp(deferred<LoadBankResult>().promise);
    const status = screen.getByRole("status");
    expect(main().getAttribute("data-bank-status")).toBe("loading");
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY_MS - 1);
    });
    expect(status.textContent).toBe("");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status.textContent).toContain(strings.loading.text);
    expect(screen.queryByRole("button", { name: strings.common.retry })).toBe(
      null,
    );
  });

  it("never shows the indicator when data arrives within 300 ms", async () => {
    const bank = deferred<LoadBankResult>();
    renderApp(bank.promise);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    bank.resolve(OK);
    await flush();
    act(() => {
      vi.advanceTimersByTime(STILL_LOADING_MS);
    });
    expect(screen.queryByRole("status")).toBe(null);
    expect(main().getAttribute("data-bank-status")).toBe("ready");
  });

  it("shows Still loading with Retry at 10 s; Retry calls the loader again", async () => {
    const retryBank = deferred<LoadBankResult>();
    const { reload } = renderApp(
      deferred<LoadBankResult>().promise,
      () => retryBank.promise,
    );
    act(() => {
      vi.advanceTimersByTime(STILL_LOADING_MS - 1);
    });
    expect(screen.getByRole("status").textContent).toContain(
      strings.loading.text,
    );
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status").textContent).toContain(
      strings.loading.still,
    );
    const retry = screen.getByRole("button", { name: strings.common.retry });
    retry.focus();
    fireEvent.click(retry);
    expect(reload).toHaveBeenCalledTimes(1);
    // Same button keeps focus; unavailable until the new attempt settles or 10 s pass.
    expect(document.activeElement).toBe(retry);
    expect(retry.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain(
      strings.loading.text,
    );
    fireEvent.click(retry);
    expect(reload).toHaveBeenCalledTimes(1);
    retryBank.resolve(OK);
    await flush();
    expect(main().getAttribute("data-bank-status")).toBe("ready");
    expect(document.activeElement).toBe(h1());
  });
});

describe("T-US12-5 data error with Retry (FR-25)", () => {
  it("shows a readable alert and Retry; Retry reloads and reaches ready", async () => {
    const retryBank = deferred<LoadBankResult>();
    const { reload } = renderApp(
      Promise.resolve(FAILED),
      () => retryBank.promise,
    );
    await flush();
    expect(main().getAttribute("data-bank-status")).toBe("error");
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", {
        level: 2,
        name: strings.error.dataHeading,
      }),
    ).toBeTruthy();
    expect(alert.textContent).toContain(strings.error.dataBody);
    expect(document.title).toBe(strings.title.dataError);
    // Focus does not move on first load.
    expect(document.activeElement).toBe(document.body);

    const retry = screen.getByRole("button", { name: strings.common.retry });
    fireEvent.click(retry);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(main().getAttribute("data-bank-status")).toBe("loading");
    retryBank.resolve(OK);
    await flush();
    expect(main().getAttribute("data-bank-status")).toBe("ready");
    expect(main().getAttribute("data-content-version")).toBe(
      TEST_BANK.contentVersion,
    );
    expect(screen.queryByRole("alert")).toBe(null);
    expect(document.title).toBe(strings.title.landing);
    expect(document.activeElement).toBe(h1());
  });

  it("keeps focus on Retry and re-announces the alert after a failed Retry", async () => {
    const { reload } = renderApp(Promise.resolve(FAILED), () =>
      Promise.resolve(FAILED),
    );
    await flush();
    const firstAlert = screen.getByRole("alert");
    const retry = screen.getByRole("button", { name: strings.common.retry });
    retry.focus();
    fireEvent.click(retry);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(main().getAttribute("data-bank-status")).toBe("error");
    expect(document.activeElement).toBe(retry);
    expect(screen.getByRole("alert")).not.toBe(firstAlert);
  });
});

describe("T-US12-2 404 and topic not found", () => {
  it("renders the 404 view with a home link, title and focused h1", async () => {
    setHash("#/no-such-page");
    renderApp(Promise.resolve(OK));
    await flush();
    expect(h1().textContent).toContain(strings.notFound.heading);
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe(strings.title.notFound);
    expect(
      screen
        .getByRole("link", { name: strings.common.home })
        .getAttribute("href"),
    ).toBe("#/");
  });

  it.each(["#/topic/unknown", "#/topic/topic-d"])(
    "shows Topic not found for %s once data is ready, without echoing the slug",
    async (hash) => {
      setHash(hash);
      renderApp(Promise.resolve(OK));
      await flush();
      expect(h1().textContent).toContain(strings.notFound.topicHeading);
      expect(document.activeElement).toBe(h1());
      expect(document.title).toBe(strings.title.topicNotFound);
      expect(main().textContent).not.toContain(hash.slice("#/topic/".length));
      // views.md §7b: the Landing topic list follows, nothing preselected.
      const radio = screen.getByRole<HTMLInputElement>("radio");
      expect(radio.checked).toBe(false);
    },
  );

  it("renders Landing with the topic preselected for a valid deep link", async () => {
    setHash("#/topic/topic-a");
    renderApp(Promise.resolve(OK));
    await flush();
    expect(h1().textContent).toContain(strings.landing.heading);
    expect(document.title).toBe(strings.title.landing);
    expect(screen.getByRole<HTMLInputElement>("radio").checked).toBe(true);
    expect(window.location.hash).toBe("#/topic/topic-a");
  });
});

describe("T-US1-8 deep-link preselection follows the route (T-09-R01 L2)", () => {
  it("resets the selection when the topic route changes and on #/", async () => {
    const bank = {
      ...TEST_BANK,
      topics: [...TEST_BANK.topics, { id: "topic-b", name: "Topic B" }],
      questions: TEST_BANK.questions.flatMap((q) => [
        q,
        { ...q, id: "q-2", topic: "topic-b" },
      ]),
    };
    setHash("#/topic/topic-a");
    renderApp(Promise.resolve({ ok: true, bank }));
    await flush();
    const radio = (name: RegExp) =>
      screen.getByRole<HTMLInputElement>("radio", { name });
    expect(radio(/^Topic A/).checked).toBe(true);
    fireEvent.click(radio(/^Mixed/));
    expect(radio(/^Mixed/).checked).toBe(true);
    // Landing is keyed by route: a remount while loading would also restart
    // the BankStatus timers (accepted, T-09-R01 L2).
    navigate("#/topic/topic-b");
    expect(radio(/^Topic B/).checked).toBe(true);
    expect(radio(/^Mixed/).checked).toBe(false);
    navigate("#/");
    expect(
      screen.getAllByRole<HTMLInputElement>("radio").some((r) => r.checked),
    ).toBe(false);
  });
});

describe("T-US1-3/6 Start creates one quiz and opens #/quiz", () => {
  it("creates the quiz once on a double click and shows question 1 of N", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    const hashChanges = vi.fn();
    window.addEventListener("hashchange", hashChanges);
    try {
      fireEvent.click(screen.getByRole("radio"));
      const start = screen.getByRole("button", { name: strings.landing.start });
      fireEvent.click(start);
      fireEvent.click(start);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(window.location.hash).toBe("#/quiz");
      expect(hashChanges).toHaveBeenCalledTimes(1);
      expect(h1().textContent).toBe(strings.question.heading(1, 1));
      expect(document.activeElement).toBe(h1());
    } finally {
      window.removeEventListener("hashchange", hashChanges);
    }
  });
});

describe("T-12 quiz session in the app (T-09-R01 N3)", () => {
  it("#/quiz with no quiz in memory replaces the entry with Landing and focuses its h1", async () => {
    setHash("#/quiz");
    const before = window.history.length;
    renderApp(Promise.resolve(OK));
    await flush();
    await expectLandingFocused();
    expect(window.history.length).toBe(before);
    expect(screen.queryByRole("button", { name: strings.question.exit })).toBe(
      null,
    );
  });

  it("T-US2-1/4 answers the question, locks it and See results opens #/results", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    expect(document.title).toBe(
      strings.title.question(1, 1, TEST_BANK.topics[0]?.name ?? ""),
    );
    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.submit }),
    );
    const next = screen.getByRole("button", {
      name: strings.feedback.seeResults,
    });
    expect(document.activeElement).toBe(next);
    // Locked through `fieldset disabled` (views.md §2); the feedback tags
    // (T-13) are now part of the radio's name.
    expect(
      screen.getByRole("radio", { name: /^True\b/ }).matches(":disabled"),
    ).toBe(true);
    fireEvent.click(next);
    await expectResultsFocused();
  });

  it("T-US2-8 Exit clears the quiz and returns to Landing; #/quiz then redirects", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.exit }),
    );
    await expectLandingFocused();
    navigate("#/quiz");
    await expectLandingFocused();
  });

  it("T-US2-8 Back to Landing clears the quiz, so Forward cannot show it again", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    navigate("#/");
    expect(document.activeElement).toBe(h1());
    expect(h1().textContent).toContain(strings.landing.heading);
    navigate("#/quiz");
    await expectLandingFocused();
  });
});

describe("T-15 results route (US-4, views.md §4)", () => {
  const topicName = TEST_BANK.topics[0]?.name ?? "";

  it("T-US4-1/5 See results replaces #/quiz with #/results: score, band, title, no Exit", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    const before = window.history.length;
    finishQuiz();
    await expectResultsFocused();
    expect(window.history.length).toBe(before);
    expect(document.title).toBe(strings.title.results(topicName));
    expect(main().textContent).toContain(strings.results.score(1, 1));
    expect(main().textContent).toContain(strings.results.percent(100));
    expect(main().textContent).toContain(strings.results.band.perfect);
    // T-12-R01 N5: no Exit on results; the brand is a link again.
    expect(screen.queryByRole("button", { name: strings.question.exit })).toBe(
      null,
    );
    expect(
      within(screen.getByRole("banner")).getByRole("link", {
        name: strings.appName,
      }),
    ).toBeTruthy();
  });

  it("T-US4-4 Try again starts a fresh quiz for the same scope at #/quiz, replacing the entry", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    const before = window.history.length;
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.tryAgain }),
    );
    await waitFor(() => {
      expect(window.location.hash).toBe("#/quiz");
      expect(h1().textContent).toBe(strings.question.heading(1, 1));
      expect(document.activeElement).toBe(h1());
    });
    expect(window.history.length).toBe(before);
    expect(document.title).toBe(strings.title.question(1, 1, topicName));
    // A new session: nothing selected, Submit available again.
    expect(
      screen.getAllByRole<HTMLInputElement>("radio").some((r) => r.checked),
    ).toBe(false);
    expect(
      screen.getByRole("button", { name: strings.question.submit }),
    ).toBeTruthy();
  });

  it("T-US4-4 Choose another topic clears the session and focuses the Landing h1", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.chooseAnother }),
    );
    await expectLandingFocused();
    navigate("#/results");
    await expectLandingFocused();
  });

  it("Back from results to Landing clears the session; Forward redirects home", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    navigate("#/");
    await expectLandingFocused();
    navigate("#/results");
    await expectLandingFocused();
  });

  it("#/results with no quiz in memory (refresh) replaces the entry with Landing", async () => {
    setHash("#/results");
    const before = window.history.length;
    renderApp(Promise.resolve(OK));
    await flush();
    await expectLandingFocused();
    expect(window.history.length).toBe(before);
  });

  it("#/quiz with a finished quiz redirects to #/results", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    navigate("#/quiz");
    await expectResultsFocused();
  });

  it("#/results with an unfinished quiz redirects to #/quiz and keeps it", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    navigate("#/results");
    await waitFor(() => {
      expect(window.location.hash).toBe("#/quiz");
      expect(h1().textContent).toBe(strings.question.heading(1, 1));
    });
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "True" }).checked,
    ).toBe(true);
  });
});

/** Answers the current question (True = correct in the test banks). */
function answer(correct: boolean, last: boolean): void {
  fireEvent.click(
    screen.getByRole("radio", { name: correct ? "True" : "False" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: strings.question.submit }),
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: last ? strings.feedback.seeResults : strings.feedback.next,
    }),
  );
}

function currentQuestionId(): string | null {
  return (
    main()
      .querySelector("[data-question-id]")
      ?.getAttribute("data-question-id") ?? null
  );
}

async function expectRetryQuestion(k: number, n: number): Promise<void> {
  await waitFor(() => {
    expect(window.location.hash).toBe("#/quiz");
    expect(h1().textContent).toBe(strings.question.heading(k, n));
    expect(document.activeElement).toBe(h1());
  });
  expect(screen.getByText(strings.question.retryLabel)).toBeTruthy();
}

describe("T-38 Review answers and Retry missed in the app (US-5, views.md §8)", () => {
  const topicName = TEST_BANK.topics[0]?.name ?? "";

  it("T-US5-1 the Review disclosure starts collapsed on every Results view", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    const toggle = screen.getByRole("button", { name: strings.review.toggle });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.tryAgain }),
    );
    await waitFor(() => {
      expect(window.location.hash).toBe("#/quiz");
    });
    finishQuiz();
    await expectResultsFocused();
    expect(
      screen
        .getByRole("button", { name: strings.review.toggle })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("T-US5-3 no Retry button after a perfect run", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    expect(screen.queryByRole("button", { name: /^Retry/ })).toBe(null);
  });

  it("T-US5-4/5 N = 1: retry replaces #/results, labels the quiz, retry results repeat, Start a full quiz", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    answer(false, true);
    await expectResultsFocused();
    const before = window.history.length;
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.retryMissed(1) }),
    );
    await expectRetryQuestion(1, 1);
    expect(window.history.length).toBe(before);
    expect(document.title).toBe(strings.title.questionRetry(1, 1, topicName));
    expect(screen.queryByRole("radio", { checked: true })).toBe(null);

    // Missed again: retry results with the retry's own misses (repeatable).
    answer(false, true);
    await waitFor(() => {
      expect(window.location.hash).toBe("#/results");
      expect(h1().textContent).toBe(strings.results.retryHeading);
      expect(document.activeElement).toBe(h1());
    });
    expect(document.title).toBe(strings.title.resultsRetry(topicName));
    expect(main().textContent).toContain(strings.results.score(0, 1));
    // Persistent storage (jsdom): the note is shown (T-42, views.md §9.1 U2).
    expect(screen.getByText(strings.results.retryNote)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: strings.results.tryAgain }),
    ).toBe(null);
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.retryMissed(1) }),
    );
    await expectRetryQuestion(1, 1);
    expect(window.history.length).toBe(before);

    // Correct this time: nothing left to retry; Start a full quiz.
    answer(true, true);
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.results.retryHeading);
    });
    expect(screen.queryByRole("button", { name: /^Retry/ })).toBe(null);
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.startFull }),
    );
    await waitFor(() => {
      expect(window.location.hash).toBe("#/quiz");
      expect(h1().textContent).toBe(strings.question.heading(1, 1));
      expect(document.activeElement).toBe(h1());
    });
    expect(screen.queryByText(strings.question.retryLabel)).toBe(null);
    expect(document.title).toBe(strings.title.question(1, 1, topicName));
    expect(window.history.length).toBe(before);
    finishQuiz();
    await expectResultsFocused();
  });

  it("T-US5-4 the retry quiz holds exactly the missed questions in their original order", async () => {
    const base = TEST_BANK.questions[0];
    if (base === undefined) throw new Error("no test question");
    const bank = {
      ...TEST_BANK,
      questions: [1, 2, 3, 4].map((n) => ({
        ...base,
        id: `q-${String(n)}`,
        prompt: `Prompt ${String(n)}`,
      })),
    };
    renderApp(Promise.resolve({ ok: true, bank }));
    await flush();
    fireEvent.click(screen.getByRole("radio"));
    fireEvent.click(
      screen.getByRole("button", { name: strings.landing.start }),
    );
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.question.heading(1, 4));
    });
    const played: (string | null)[] = [];
    for (let i = 0; i < 4; i += 1) {
      played.push(currentQuestionId());
      answer(i % 2 === 1, i === 3);
    }
    await expectResultsFocused();
    const missed = [played[0], played[2]];
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.retryMissed(2) }),
    );
    await expectRetryQuestion(1, 2);
    const retried = [currentQuestionId()];
    answer(true, false);
    await expectRetryQuestion(2, 2);
    retried.push(currentQuestionId());
    expect(retried).toEqual(missed);
  });

  it("Choose another topic from retry results clears the session", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    answer(false, true);
    await expectResultsFocused();
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.retryMissed(1) }),
    );
    await expectRetryQuestion(1, 1);
    answer(true, true);
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.results.retryHeading);
    });
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.chooseAnother }),
    );
    await expectLandingFocused();
    navigate("#/results");
    await expectLandingFocused();
  });
});

describe("T-42 best score per topic and Mixed (US-6.1, US-5.5, views.md §9.3)", () => {
  const topicName = TEST_BANK.topics[0]?.name ?? "";
  const at = 1761200000000;

  function storeBest(scores: Record<string, unknown>): void {
    createProgressStore().set(
      KEYS.best,
      JSON.stringify({ schemaVersion: 1, scores }),
    );
  }

  function storedScores(): Record<string, unknown> | null {
    const decoded = decodeBest(createProgressStore().get(KEYS.best));
    return decoded.ok ? { ...decoded.value.scores } : null;
  }

  function topicRadio(best: number | null): HTMLElement {
    const base = `${topicName}, ${strings.landing.topicCount(1)}`;
    return screen.getByRole("radio", {
      name:
        best === null ? base : `${base}, ${strings.landing.bestScore(best)}`,
    });
  }

  /** A persistent store over memory that counts best-score writes. */
  function countingStore(result?: WriteResult): {
    store: ProgressStore;
    writes: () => number;
  } {
    const inner = new MemoryStore();
    const set = vi.fn(
      (key: string, value: string) => result ?? inner.set(key, value),
    );
    const store: ProgressStore = {
      persistent: true,
      get: (key) => inner.get(key),
      set,
      remove: (key) => inner.remove(key),
      clearAppKeys: () => inner.clearAppKeys(),
    };
    return {
      store,
      writes: () => set.mock.calls.filter(([key]) => key === KEYS.best).length,
    };
  }

  async function backToLanding(): Promise<void> {
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.chooseAnother }),
    );
    await expectLandingFocused();
  }

  it("T-US6-1 a finished normal quiz writes the best score, shown in the row and its name", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    expect(main().textContent).not.toContain("Best score");
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    const stored = storedScores();
    expect(Object.keys(stored ?? {})).toEqual(["topic-a"]);
    expect(stored?.["topic-a"]).toMatchObject({
      percent: 100,
      correct: 1,
      total: 1,
    });
    await backToLanding();
    const radio = topicRadio(100);
    expect(radio.closest("label")?.textContent).toContain(
      strings.landing.bestScore(100),
    );
  });

  it("T-US6-1 a lower or equal score keeps the stored best; a higher one replaces it", async () => {
    storeBest({ "topic-a": { percent: 100, correct: 1, total: 1, at } });
    renderApp(Promise.resolve(OK));
    await flush();
    expect(topicRadio(100)).toBeTruthy();
    await startQuiz();
    answer(false, true);
    await expectResultsFocused();
    expect(storedScores()?.["topic-a"]).toEqual({
      percent: 100,
      correct: 1,
      total: 1,
      at,
    });
    cleanup();
    createProgressStore().clearAppKeys();
    setHash("");
    storeBest({ "topic-a": { percent: 0, correct: 0, total: 1, at } });
    renderApp(Promise.resolve(OK));
    await flush();
    expect(topicRadio(0)).toBeTruthy();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    await backToLanding();
    expect(topicRadio(100)).toBeTruthy();
  });

  it("T-US5-5 a retry-missed quiz never updates the best score", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    await startQuiz();
    answer(false, true);
    await expectResultsFocused();
    expect(storedScores()?.["topic-a"]).toMatchObject({ percent: 0 });
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.retryMissed(1) }),
    );
    await expectRetryQuestion(1, 1);
    answer(true, true);
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.results.retryHeading);
    });
    expect(screen.getByText(strings.results.retryNote)).toBeTruthy();
    expect(storedScores()?.["topic-a"]).toMatchObject({ percent: 0 });
    await backToLanding();
    expect(topicRadio(0)).toBeTruthy();
  });

  it("Mixed has its own best score, separate from the topics", async () => {
    const base = TEST_BANK.questions[0];
    if (base === undefined) throw new Error("no test question");
    const bank = {
      ...TEST_BANK,
      topics: [
        { id: "topic-a", name: "Topic A" },
        { id: "topic-b", name: "Topic B" },
      ],
      questions: [
        { ...base, id: "q-a" },
        { ...base, id: "q-b", topic: "topic-b" },
      ],
    };
    storeBest({ "topic-a": { percent: 0, correct: 0, total: 1, at } });
    renderApp(Promise.resolve({ ok: true, bank }));
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: /^Mixed/ }));
    fireEvent.click(
      screen.getByRole("button", { name: strings.landing.start }),
    );
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.question.heading(1, 2));
    });
    answer(true, false);
    answer(true, true);
    await expectResultsFocused();
    await backToLanding();
    expect(
      screen.getByRole("radio", {
        name: `${strings.landing.mixedLabel}, ${strings.landing.topicCount(2)}, ${strings.landing.bestScore(100)}`,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", {
        name: `Topic A, ${strings.landing.topicCount(1)}, ${strings.landing.bestScore(0)}`,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", {
        name: `Topic B, ${strings.landing.topicCount(1)}`,
      }),
    ).toBeTruthy();
  });

  it("SEC-R13 prunes scores of topics the bank no longer has (also on write)", async () => {
    storeBest({
      "topic-a": { percent: 0, correct: 0, total: 1, at },
      gone: { percent: 90, correct: 9, total: 10, at },
    });
    renderApp(Promise.resolve(OK));
    await flush();
    expect(main().textContent.match(/Best score/g)).toHaveLength(1);
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    expect(Object.keys(storedScores() ?? {})).toEqual(["topic-a"]);
  });

  it("corrupt stored best scores are treated as empty and replaced on finish", async () => {
    createProgressStore().set(KEYS.best, "{not json");
    renderApp(Promise.resolve(OK));
    await flush();
    expect(main().textContent).not.toContain("Best score");
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    expect(storedScores()?.["topic-a"]).toMatchObject({ percent: 100 });
  });

  it("writes once per finished quiz, even when Results re-renders", async () => {
    const { store, writes } = countingStore();
    renderApp(Promise.resolve(OK), undefined, store);
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    fireEvent.click(
      screen.getByRole("button", { name: strings.review.toggle }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: strings.review.toggle }),
    );
    expect(writes()).toBe(1);
    // Try again is a new quiz: one more write.
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.tryAgain }),
    );
    await waitFor(() => {
      expect(window.location.hash).toBe("#/quiz");
    });
    finishQuiz();
    await expectResultsFocused();
    expect(writes()).toBe(2);
  });

  it("a failed write is silent: Results shows, Landing shows no best score", async () => {
    const { store, writes } = countingStore({ ok: false, reason: "quota" });
    renderApp(Promise.resolve(OK), undefined, store);
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    expect(writes()).toBe(1);
    expect(screen.queryByRole("alert")).toBe(null);
    await backToLanding();
    expect(topicRadio(null)).toBeTruthy();
  });

  it("US-6.5 storage not persistent: no best-score text, no retry note, nothing written", async () => {
    const store = new MemoryStore();
    renderApp(Promise.resolve(OK), undefined, store);
    await flush();
    await startQuiz();
    answer(false, true);
    await expectResultsFocused();
    expect(store.get(KEYS.best)).toBe(null);
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.retryMissed(1) }),
    );
    await expectRetryQuestion(1, 1);
    answer(true, true);
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.results.retryHeading);
    });
    expect(screen.queryByText(strings.results.retryNote)).toBe(null);
    await backToLanding();
    expect(main().textContent).not.toContain("Best score");
  });

  it("T-42 layout reserve: the loading reserve already has the best-score line", () => {
    const firstId = landingReserve.topicIds[0] ?? "";
    storeBest({ [firstId]: { percent: 75, correct: 3, total: 4, at } });
    renderApp(deferred<LoadBankResult>().promise);
    const reserve = main().querySelector('[aria-hidden="true"]');
    expect(reserve?.textContent).toContain(strings.landing.bestScore(75));
  });
});

describe("T-US10-6 per-view title and focus", () => {
  it.each([
    ["", strings.landing.heading, strings.title.landing],
    ["#/x", strings.notFound.heading, strings.title.notFound],
  ])("sets the title for %j", async (hash, heading, title) => {
    setHash(hash);
    renderApp(Promise.resolve(OK));
    await flush();
    expect(h1().textContent).toContain(heading);
    expect(document.title).toBe(title);
  });

  it("does not move focus on the first Landing load; moves it to h1 on every route change", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    expect(document.activeElement).toBe(document.body);

    navigate("#/nope");
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe(strings.title.notFound);

    navigate("#/");
    expect(h1().textContent).toContain(strings.landing.heading);
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe(strings.title.landing);
  });

  it("makes the h1 and main script-focusable only", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    expect(h1().getAttribute("tabindex")).toBe("-1");
    expect(main().getAttribute("id")).toBe("main");
    expect(main().getAttribute("tabindex")).toBe("-1");
  });
});

describe("shell", () => {
  it("links the brand home except on the quiz route", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    const banner = screen.getByRole("banner");
    const link = within(banner).getByRole("link", { name: strings.appName });
    expect(link.getAttribute("href")).toBe("#/");
    // A string `name` in getByRole matches the whole accessible name, so it
    // is exactly the app name: the mark is aria-hidden and the tagline is
    // outside the link (views.md §0).
    const mark = link.querySelector("span");
    expect(mark?.getAttribute("aria-hidden")).toBe("true");
    const tagline = within(banner).getByText(strings.appTagline);
    expect(link.contains(tagline)).toBe(false);
    expect(link.textContent).not.toContain(strings.appTagline);
    await startQuiz();
    expect(window.location.hash).toBe("#/quiz");
    expect(within(banner).queryByRole("link")).toBe(null);
    expect(banner.textContent).toContain(strings.appName);
  });

  it("skip link focuses main without changing the route", async () => {
    setHash("#/x");
    renderApp(Promise.resolve(OK));
    await flush();
    fireEvent.click(screen.getByRole("link", { name: strings.shell.skipLink }));
    expect(document.activeElement).toBe(main());
    expect(window.location.hash).toBe("#/x");
  });
});

/**
 * Makes the next `document.title` assignment throw once, so the view's
 * title effect fails inside the error boundary (a real render-phase error
 * path without test-only code in the app). Returns a restore function.
 */
function failNextTitleWrite(): () => void {
  const proto = Object.getOwnPropertyDescriptor(Document.prototype, "title");
  let failed = false;
  Object.defineProperty(document, "title", {
    configurable: true,
    get: () => proto?.get?.call(document) as string,
    set: (value: string) => {
      if (!failed) {
        failed = true;
        throw new Error("forced title failure");
      }
      proto?.set?.call(document, value);
    },
  });
  return () => {
    Reflect.deleteProperty(document, "title");
  };
}

describe("T-US12-5 error boundary inside the app (T-08-R01 L1)", () => {
  it("focuses the landing h1 after the boundary is reset from the home link at #/", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restore = failNextTitleWrite();
    try {
      setHash("#/");
      renderApp(Promise.resolve(OK));
      await flush();
      const errorHeading = h1();
      expect(errorHeading.textContent).toContain(strings.error.appHeading);
      expect(document.activeElement).toBe(errorHeading);

      fireEvent.click(screen.getByRole("link", { name: strings.common.home }));
      expect(h1().textContent).toContain(strings.landing.heading);
      expect(document.activeElement).toBe(h1());
      expect(document.title).toBe(strings.title.landing);
      expect(window.location.hash).toBe("#/");
    } finally {
      restore();
      vi.restoreAllMocks();
    }
  });
});

describe("reloadBank prop (T-08-R01 L4)", () => {
  it("does not refetch when the loader identity changes; Retry uses the latest loader", async () => {
    const first = vi.fn(() => Promise.resolve(OK));
    const second = vi.fn(() => Promise.resolve(OK));
    const failed = Promise.resolve(FAILED);
    const view = render(<App bankPromise={failed} reloadBank={first} />);
    await flush();
    view.rerender(<App bankPromise={failed} reloadBank={second} />);
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: strings.common.retry }));
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(main().getAttribute("data-bank-status")).toBe("ready");
  });
});
