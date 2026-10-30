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
  LocalStorageStore,
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

  // Memory-only storage: no resume slot, so the bank status is the only
  // status region (the slot's own region is tested in the T-43 block).
  const noProgress = () => new MemoryStore();

  it("shows nothing before 300 ms, then the loading text in a status region", () => {
    renderApp(deferred<LoadBankResult>().promise, undefined, noProgress());
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
    renderApp(bank.promise, undefined, noProgress());
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
      noProgress(),
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
    expect(main().textContent).not.toContain("Best score:");
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
    expect(main().textContent.match(/Best score:/g)).toHaveLength(1);
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    expect(Object.keys(storedScores() ?? {})).toEqual(["topic-a"]);
  });

  it("corrupt stored best scores are treated as empty and replaced on finish", async () => {
    createProgressStore().set(KEYS.best, "{not json");
    renderApp(Promise.resolve(OK));
    await flush();
    expect(main().textContent).not.toContain("Best score:");
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
    expect(main().textContent).not.toContain("Best score:");
  });

  it("T-42 layout reserve: the loading reserve already has the best-score line", () => {
    const firstId = landingReserve.topicIds[0] ?? "";
    storeBest({ [firstId]: { percent: 75, correct: 3, total: 4, at } });
    renderApp(deferred<LoadBankResult>().promise);
    const reserve = main().querySelector('[aria-hidden="true"]');
    expect(reserve?.textContent).toContain(strings.landing.bestScore(75));
  });
});

describe("T-43 resume, discard, load notice and replace (US-6.2 to US-6.4, views.md §9)", () => {
  const base = TEST_BANK.questions[0];
  if (base === undefined) throw new Error("no test question");
  /** Three true/false questions in Topic A (True is correct). */
  const BANK3 = {
    ...TEST_BANK,
    questions: [
      { ...base, id: "q-1" },
      { ...base, id: "q-2" },
      { ...base, id: "q-3" },
    ],
  };
  const OK3: LoadBankResult = { ok: true, bank: BANK3 };
  const at = 1761200000000;
  const resumeButton = () =>
    screen.getByRole("button", { name: strings.resume.resume });
  const discardButton = () =>
    screen.getByRole("button", { name: strings.resume.discard });
  const startButton = () =>
    screen.getByRole("button", { name: strings.landing.start });
  const stored = (key: string) => createProgressStore().get(key);

  /** The load notice region of the resume slot (not the bank status). */
  function slotStatus(): HTMLElement {
    const region = screen
      .getAllByRole("status")
      .find((el) => el.closest('[aria-hidden="true"]') === null);
    if (region === undefined) throw new Error("no status region");
    return region;
  }

  /** Radio labels in display order, e.g. ["True", "False"]. */
  function optionOrder(): string[] {
    return screen
      .getAllByRole("radio")
      .map((radio) => radio.closest("label")?.textContent ?? "");
  }

  /** Simulates a reload: a new App over the same storage at `#/`. */
  async function reload(result: LoadBankResult = OK3): Promise<void> {
    cleanup();
    setHash("");
    renderApp(Promise.resolve(result));
    await flush();
  }

  /** Starts a 3-question quiz on BANK3. */
  async function start3(): Promise<void> {
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    fireEvent.click(startButton());
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.question.heading(1, 3));
    });
  }

  function submit(correct: boolean): void {
    fireEvent.click(
      screen.getByRole("radio", { name: correct ? "True" : "False" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.submit }),
    );
  }

  /** A saved session for TEST_BANK's q-1 with no answer yet. */
  function savedSession(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      schemaVersion: 1,
      contentVersion: "test-v1",
      mode: "normal",
      scope: { kind: "topic", topicId: "topic-a" },
      seed: 1,
      questionIds: ["q-1"],
      optionOrder: [["true", "false"]],
      answers: [],
      index: 0,
      savedAt: at,
      ...overrides,
    });
  }
  const validBest = JSON.stringify({
    schemaVersion: 1,
    scores: { "topic-a": { percent: 50, correct: 1, total: 2, at } },
  });

  it("FR-15 saves after Submit and Next, not on a selection; clears on finish", async () => {
    renderApp(Promise.resolve(OK3));
    await flush();
    await start3();
    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    expect(stored(KEYS.session)).toBe(null);
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.submit }),
    );
    expect(JSON.parse(stored(KEYS.session) ?? "null")).toMatchObject({
      index: 0,
      answers: [{ o: "true" }],
    });
    fireEvent.click(
      screen.getByRole("button", { name: strings.feedback.next }),
    );
    expect(JSON.parse(stored(KEYS.session) ?? "null")).toMatchObject({
      index: 1,
      answers: [{ o: "true" }],
    });
    answer(true, false);
    answer(true, true);
    await expectResultsFocused();
    expect(stored(KEYS.session)).toBe(null);
    expect(stored(KEYS.best)).not.toBe(null);
  });

  it("T-US6-2 after a reload, Resume restores the index, question order, option order and answers", async () => {
    renderApp(Promise.resolve(OK3));
    await flush();
    await start3();
    const ids: (string | null)[] = [];
    const orders: string[][] = [];
    ids.push(currentQuestionId());
    orders.push(optionOrder());
    answer(false, false);
    ids.push(currentQuestionId());
    orders.push(optionOrder());

    await reload();
    expect(document.activeElement).not.toBe(h1());
    const card = screen.getByRole("region", { name: strings.resume.heading });
    expect(card.textContent).toContain(strings.resume.summary("Topic A", 1, 3));
    // Card before the topic group in reading and Tab order.
    expect(
      card.compareDocumentPosition(screen.getByRole("group")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(startButton().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(resumeButton());
    await waitFor(() => {
      expect(window.location.hash).toBe("#/quiz");
      expect(h1().textContent).toBe(strings.question.heading(2, 3));
      expect(document.activeElement).toBe(h1());
    });
    expect(currentQuestionId()).toBe(ids[1]);
    expect(optionOrder()).toEqual(orders[1]);
    // A locked answer exists only for question 1; question 2 is open.
    expect(screen.queryByRole("radio", { checked: true })).toBe(null);
    expect(JSON.parse(stored(KEYS.session) ?? "null")).toMatchObject({
      index: 1,
      answers: [{ q: ids[0], o: "false" }],
    });
  });

  it("T-US6-2 Resume in feedback shows the locked answer and Next, focuses the h1, empty status (F3)", async () => {
    renderApp(Promise.resolve(OK3));
    await flush();
    await start3();
    submit(false);
    await reload();
    fireEvent.click(resumeButton());
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.question.heading(1, 3));
      expect(document.activeElement).toBe(h1());
    });
    expect(screen.getByText(strings.feedback.incorrect)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: strings.feedback.next }),
    ).toBeTruthy();
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: /^False/ }).checked,
    ).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("");
    // Saving goes on: Next moves the saved index.
    fireEvent.click(
      screen.getByRole("button", { name: strings.feedback.next }),
    );
    expect(JSON.parse(stored(KEYS.session) ?? "null")).toMatchObject({
      index: 1,
    });
  });

  it("U3 the card is shown right after Exit and after Back; nothing is saved before the first Submit", async () => {
    renderApp(Promise.resolve(OK3));
    await flush();
    await start3();
    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.exit }),
    );
    await expectLandingFocused();
    expect(screen.queryByRole("region", { name: strings.resume.heading })).toBe(
      null,
    );
    await start3();
    submit(true);
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.exit }),
    );
    await expectLandingFocused();
    expect(
      screen.getByRole("region", { name: strings.resume.heading }).textContent,
    ).toContain(strings.resume.summary("Topic A", 1, 3));
    fireEvent.click(resumeButton());
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.question.heading(1, 3));
    });
    navigate("#/");
    expect(document.activeElement).toBe(h1());
    expect(
      screen.getByRole("region", { name: strings.resume.heading }),
    ).toBeTruthy();
  });

  it("Discard removes the saved quiz, keeps best scores and focuses the result text", async () => {
    createProgressStore().set(KEYS.best, validBest);
    createProgressStore().set(KEYS.session, savedSession());
    renderApp(Promise.resolve(OK));
    await flush();
    fireEvent.click(discardButton());
    const text = screen.getByText(strings.resume.discarded);
    expect(document.activeElement).toBe(text);
    expect(text.getAttribute("tabindex")).toBe("-1");
    expect(screen.queryByRole("region", { name: strings.resume.heading })).toBe(
      null,
    );
    expect(stored(KEYS.session)).toBe(null);
    expect(stored(KEYS.best)).toBe(validBest);
    // No card: Start starts directly, without aria-expanded.
    expect(startButton().hasAttribute("aria-expanded")).toBe(false);
  });

  it.each([
    ["corrupt", "{not json"],
    ["unknown version", savedSession({ schemaVersion: 2 })],
  ])(
    "T-US6-3 a %s saved quiz is removed with a status notice; best scores are kept",
    async (_label, raw) => {
      createProgressStore().set(KEYS.best, validBest);
      createProgressStore().set(KEYS.session, raw);
      renderApp(Promise.resolve(OK));
      await waitFor(() => {
        expect(slotStatus().textContent).toBe(strings.progress.sessionRemoved);
        expect(stored(KEYS.session)).toBe(null);
      });
      expect(stored(KEYS.best)).toBe(validBest);
      expect(document.activeElement).toBe(document.body);
      expect(
        screen.queryByRole("region", { name: strings.resume.heading }),
      ).toBe(null);
      // Cleared when Landing is left and not shown again.
      await startQuiz();
      navigate("#/");
      expect(slotStatus().textContent).toBe("");
    },
  );

  it("T-US6-3 a stale saved quiz (unknown question) is removed with the notice once the bank is ready", async () => {
    createProgressStore().set(
      KEYS.session,
      savedSession({ questionIds: ["gone"], optionOrder: [["a", "b"]] }),
    );
    const bank = deferred<LoadBankResult>();
    renderApp(bank.promise);
    await flush();
    expect(slotStatus().textContent).toBe("");
    expect(stored(KEYS.session)).not.toBe(null);
    bank.resolve(OK);
    await waitFor(() => {
      expect(slotStatus().textContent).toBe(strings.progress.sessionRemoved);
      expect(stored(KEYS.session)).toBe(null);
    });
  });

  it("T-US6-3 undecodable best scores: removed, notice; a valid saved quiz still gets its card", async () => {
    createProgressStore().set(KEYS.best, "[]");
    createProgressStore().set(KEYS.session, savedSession());
    renderApp(Promise.resolve(OK));
    await waitFor(() => {
      expect(slotStatus().textContent).toBe(strings.progress.bestRemoved);
      expect(stored(KEYS.best)).toBe(null);
    });
    expect(stored(KEYS.session)).not.toBe(null);
    expect(
      screen.getByRole("region", { name: strings.resume.heading }),
    ).toBeTruthy();
  });

  it("T-US6-3 stale quiz and undecodable best: both sentences, quiz first, in one paragraph", async () => {
    createProgressStore().set(KEYS.best, "{");
    createProgressStore().set(
      KEYS.session,
      savedSession({ scope: { kind: "topic", topicId: "gone" } }),
    );
    renderApp(Promise.resolve(OK));
    await waitFor(() => {
      expect(slotStatus().textContent).toBe(
        `${strings.progress.sessionRemoved} ${strings.progress.bestRemoved}`,
      );
    });
    expect(slotStatus().querySelectorAll("p")).toHaveLength(1);
  });

  it("a data error keeps the saved quiz untouched and shows no card or notice", async () => {
    createProgressStore().set(KEYS.session, savedSession());
    renderApp(Promise.resolve(FAILED));
    await flush();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(main().getAttribute("data-bank-status")).toBe("error");
    expect(stored(KEYS.session)).toBe(savedSession());
    expect(screen.queryByText(strings.resume.heading)).toBe(null);
    expect(main().textContent).not.toContain(strings.progress.sessionRemoved);
  });

  it("T-US6-4 Start with a saved quiz opens the replace confirmation; Escape and Cancel return to Start", async () => {
    createProgressStore().set(KEYS.session, savedSession());
    renderApp(Promise.resolve(OK));
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    const startEl = startButton();
    fireEvent.click(startEl);
    const group = screen.getByRole("group", {
      name: strings.landing.replaceMessage,
    });
    expect(window.location.hash).toBe("");
    expect(document.activeElement).toBe(
      screen.getByText(strings.landing.replaceMessage),
    );
    expect(startEl.getAttribute("aria-expanded")).toBe("true");
    expect(startEl.getAttribute("aria-controls")).toBe(group.id);
    fireEvent.keyDown(
      within(group).getByRole("button", {
        name: strings.landing.replaceConfirm,
      }),
      { key: "Escape" },
    );
    expect(
      screen.queryByRole("group", { name: strings.landing.replaceMessage }),
    ).toBe(null);
    expect(document.activeElement).toBe(startEl);
    expect(startEl.getAttribute("aria-expanded")).toBe("false");
    expect(startEl.hasAttribute("aria-controls")).toBe(false);
    fireEvent.click(startEl);
    fireEvent.click(
      screen.getByRole("button", { name: strings.common.cancel }),
    );
    expect(document.activeElement).toBe(startEl);
    expect(stored(KEYS.session)).toBe(savedSession());
  });

  it("T-US6-4 F4 Start new quiz removes the saved quiz first, then starts; leaving before Submit shows no card", async () => {
    const inner = createProgressStore();
    const calls: string[] = [];
    const store: ProgressStore = {
      persistent: true,
      get: (key) => inner.get(key),
      set: (key, value) => {
        calls.push(`set ${key}`);
        return inner.set(key, value);
      },
      remove: (key) => {
        calls.push(`remove ${key}`);
        return inner.remove(key);
      },
      clearAppKeys: () => inner.clearAppKeys(),
    };
    inner.set(KEYS.session, savedSession());
    renderApp(Promise.resolve(OK), undefined, store);
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    fireEvent.click(startButton());
    expect(calls).toEqual([]);
    fireEvent.click(
      screen.getByRole("button", { name: strings.landing.replaceConfirm }),
    );
    await waitFor(() => {
      expect(window.location.hash).toBe("#/quiz");
      expect(h1().textContent).toBe(strings.question.heading(1, 1));
      expect(document.activeElement).toBe(h1());
    });
    expect(calls).toEqual([`remove ${KEYS.session}`]);
    expect(inner.get(KEYS.session)).toBe(null);
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.exit }),
    );
    await expectLandingFocused();
    expect(screen.queryByRole("region", { name: strings.resume.heading })).toBe(
      null,
    );
  });

  it("F5 a failed session write is followed by a best-effort remove, with no UI", async () => {
    const inner = new MemoryStore();
    const removed: string[] = [];
    const store: ProgressStore = {
      persistent: true,
      get: (key) => inner.get(key),
      set: (key, value) =>
        key === KEYS.session
          ? { ok: false, reason: "quota" }
          : inner.set(key, value),
      remove: (key) => {
        removed.push(key);
        return inner.remove(key);
      },
      clearAppKeys: () => inner.clearAppKeys(),
    };
    renderApp(Promise.resolve(OK3), undefined, store);
    await flush();
    await start3();
    submit(true);
    expect(removed).toEqual([KEYS.session]);
    expect(screen.queryByRole("alert")).toBe(null);
    expect(screen.getByText(strings.feedback.correct)).toBeTruthy();
  });

  it("US-6.5 memory-only storage: no slot, Exit discards the quiz, Start never asks", async () => {
    const store = new MemoryStore();
    renderApp(Promise.resolve(OK3), undefined, store);
    await flush();
    expect(screen.queryByRole("status")).toBe(null);
    await start3();
    submit(true);
    expect(store.get(KEYS.session)).toBe(null);
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.exit }),
    );
    await expectLandingFocused();
    expect(screen.queryByText(strings.resume.heading)).toBe(null);
    expect(startButton().hasAttribute("aria-expanded")).toBe(false);
    await start3();
  });

  it("SEC-R15 N1 a quiz resumed across a content change never updates the best score", async () => {
    createProgressStore().set(
      KEYS.session,
      savedSession({ contentVersion: "older-v0" }),
    );
    renderApp(Promise.resolve(OK));
    await flush();
    fireEvent.click(resumeButton());
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.question.heading(1, 1));
    });
    finishQuiz();
    await expectResultsFocused();
    expect(stored(KEYS.best)).toBe(null);
    expect(stored(KEYS.session)).toBe(null);
  });

  it("T-43-TL01 L3 pressing Start again while the confirmation is open refocuses the message", async () => {
    createProgressStore().set(KEYS.session, savedSession());
    renderApp(Promise.resolve(OK));
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    fireEvent.click(startButton());
    const message = screen.getByText(strings.landing.replaceMessage);
    startButton().focus();
    fireEvent.click(startButton());
    expect(document.activeElement).toBe(message);
    expect(startButton().getAttribute("aria-expanded")).toBe("true");
  });

  it("T-43-TL01 L3 a stale quiz found on a later re-read is removed silently", async () => {
    renderApp(Promise.resolve(OK3));
    await flush();
    await start3();
    submit(true);
    // Another tab (or a new deploy) leaves a quiz this bank cannot restore.
    const stale = savedSession({
      questionIds: ["gone"],
      optionOrder: [["a", "b"]],
    });
    createProgressStore().set(KEYS.session, stale);
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.exit }),
    );
    await expectLandingFocused();
    await waitFor(() => {
      expect(stored(KEYS.session)).toBe(null);
    });
    expect(screen.queryByRole("region", { name: strings.resume.heading })).toBe(
      null,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(slotStatus().textContent).toBe("");
  });

  it("T-43-TL01 L1 leaving Landing and coming back while the bank loads keeps the reserve and the notice", async () => {
    const reserveTopicId = landingReserve.topicIds[0] ?? "";
    const reserveTopicName = landingReserve.topicNames[0] ?? "";
    // In the reserve (card copy), but not in OK's bank: stale when ready.
    createProgressStore().set(
      KEYS.session,
      savedSession({ scope: { kind: "topic", topicId: reserveTopicId } }),
    );
    const bank = deferred<LoadBankResult>();
    renderApp(bank.promise);
    const summary = strings.resume.summary(reserveTopicName, 0, 1);
    const reserve = () =>
      [...main().querySelectorAll('[aria-hidden="true"]')]
        .map((el) => el.textContent)
        .join("|");
    expect(reserve()).toContain(summary);
    navigate("#/zzz");
    expect(h1().textContent).toBe(strings.notFound.heading);
    navigate("#/");
    expect(main().getAttribute("data-bank-status")).toBe("loading");
    expect(reserve()).toContain(summary);
    bank.resolve(OK);
    await waitFor(() => {
      expect(slotStatus().textContent).toBe(strings.progress.sessionRemoved);
      expect(stored(KEYS.session)).toBe(null);
    });
    expect(reserve()).toContain(summary);
  });

  it("T-43-TL01 L1 a valid quiz still gets its card after leaving Landing while the bank loads", async () => {
    createProgressStore().set(KEYS.session, savedSession());
    const bank = deferred<LoadBankResult>();
    renderApp(bank.promise);
    navigate("#/zzz");
    navigate("#/");
    // Slot (with its reserve) still mounted while loading.
    expect(screen.getAllByRole("status")).toHaveLength(2);
    bank.resolve(OK);
    await flush();
    expect(
      screen.getByRole("region", { name: strings.resume.heading }),
    ).toBeTruthy();
  });

  describe("CLS reserve (views.md §9.2, TL N1, N2)", () => {
    const reserveTopicId = landingReserve.topicIds[0] ?? "";
    const reserveTopicName = landingReserve.topicNames[0] ?? "";

    function reserveText(): string {
      return [...main().querySelectorAll('[aria-hidden="true"]')]
        .map((el) => el.textContent)
        .join("|");
    }

    it("a decodable saved quiz reserves an invisible card with its real summary while loading", () => {
      createProgressStore().set(
        KEYS.session,
        savedSession({
          scope: { kind: "topic", topicId: reserveTopicId },
          questionIds: ["a", "b"],
          optionOrder: [
            ["x", "y"],
            ["x", "y"],
          ],
          answers: [{ q: "a", o: "x" }],
          index: 1,
        }),
      );
      renderApp(deferred<LoadBankResult>().promise);
      expect(reserveText()).toContain(
        strings.resume.summary(reserveTopicName, 1, 2),
      );
      expect(slotStatus().textContent).toBe("");
      expect(
        screen.queryByRole("button", { name: strings.resume.resume }),
      ).toBe(null);
    });

    it("a stale quiz keeps the card copy behind the notice for this render", async () => {
      createProgressStore().set(
        KEYS.session,
        savedSession({
          scope: { kind: "topic", topicId: reserveTopicId },
          mode: "retry-missed",
        }),
      );
      renderApp(Promise.resolve(OK));
      await waitFor(() => {
        expect(slotStatus().textContent).toBe(strings.progress.sessionRemoved);
      });
      expect(reserveText()).toContain(
        strings.resume.summaryRetry(reserveTopicName, 0, 1),
      );
    });

    it("TL N2 a topic the reserve does not list reserves the notice instead of a card", () => {
      createProgressStore().set(KEYS.best, "{");
      createProgressStore().set(
        KEYS.session,
        savedSession({ scope: { kind: "topic", topicId: "not-in-reserve" } }),
      );
      renderApp(deferred<LoadBankResult>().promise);
      const text = reserveText();
      expect(text).toContain(
        `${strings.progress.sessionRemoved} ${strings.progress.bestRemoved}`,
      );
      expect(text).not.toContain(strings.resume.heading);
    });

    it("a corrupt value reserves the notice copy; the notice fills the status after mount", async () => {
      createProgressStore().set(KEYS.session, "nope");
      renderApp(deferred<LoadBankResult>().promise);
      expect(reserveText()).toContain(strings.progress.sessionRemoved);
      expect(slotStatus().textContent).toBe("");
      await waitFor(() => {
        expect(slotStatus().textContent).toBe(strings.progress.sessionRemoved);
      });
    });

    it("nothing saved: no reserve and no slot while loading (one status region); the slot mounts when ready", async () => {
      const bank = deferred<LoadBankResult>();
      renderApp(bank.promise);
      expect(reserveText()).not.toContain(strings.resume.heading);
      expect(screen.getAllByRole("status")).toHaveLength(1);
      bank.resolve(OK);
      await flush();
      expect(slotStatus().textContent).toBe("");
    });
  });
});

describe("T-44 reset progress and memory-only mode (US-6.5, US-6.6, views.md §9.1 U2, §9.6)", () => {
  const at = 1761200000000;
  const BEST = JSON.stringify({
    schemaVersion: 1,
    scores: { "topic-a": { percent: 50, correct: 1, total: 2, at } },
  });
  const SESSION = JSON.stringify({
    schemaVersion: 1,
    contentVersion: "test-v1",
    mode: "normal",
    scope: { kind: "topic", topicId: "topic-a" },
    seed: 1,
    questionIds: ["q-1"],
    optionOrder: [["true", "false"]],
    answers: [],
    index: 0,
    savedAt: at,
  });
  const resetButton = () =>
    screen.getByRole("button", { name: strings.progress.reset });
  const progressRegion = () =>
    screen.queryByRole("region", { name: strings.progress.heading });
  const resumeCard = () =>
    screen.queryByRole("region", { name: strings.resume.heading });

  /** A Web Storage stand-in over a Map (other sites' keys live here too). */
  function stubStorage(entries: Record<string, string>): Storage {
    const data = new Map(Object.entries(entries));
    return {
      get length() {
        return data.size;
      },
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
      },
      clear: () => {
        data.clear();
      },
    };
  }

  function confirmReset(): void {
    fireEvent.click(resetButton());
    expect(document.activeElement?.textContent).toBe(
      strings.progress.resetMessage,
    );
    fireEvent.click(
      screen.getByRole("button", { name: strings.progress.resetConfirm }),
    );
  }

  it("US-6.5 memory-only: no best score, card, notice or Your progress; a quiz completes in memory", async () => {
    const store = new MemoryStore();
    // Even data in the memory store is never offered (U2).
    store.set(KEYS.best, BEST);
    store.set(KEYS.session, SESSION);
    store.set(KEYS.session.replace("session", "x"), "{");
    renderApp(Promise.resolve(OK), undefined, store);
    await flush();
    expect(main().textContent).not.toContain(strings.landing.bestScore(50));
    expect(resumeCard()).toBe(null);
    expect(screen.queryByRole("status")).toBe(null);
    expect(progressRegion()).toBe(null);
    expect(screen.queryByText(strings.progress.reset)).toBe(null);
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    expect(screen.queryByText(strings.results.retryNote)).toBe(null);
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.chooseAnother }),
    );
    await expectLandingFocused();
    expect(progressRegion()).toBe(null);
    expect(main().textContent).not.toContain(strings.landing.bestScore(50));
  });

  it("US-6.5 a store whose writes all fail never interrupts the quiz", async () => {
    const inner = new MemoryStore();
    const store: ProgressStore = {
      persistent: true,
      get: (key) => inner.get(key),
      set: () => ({ ok: false, reason: "error" }),
      remove: () => ({ ok: false, reason: "error" }),
      clearAppKeys: () => ({ ok: false, reason: "error" }),
    };
    renderApp(Promise.resolve(OK), undefined, store);
    await flush();
    await startQuiz();
    finishQuiz();
    await expectResultsFocused();
    expect(screen.queryByRole("alert")).toBe(null);
  });

  it("T-US6-6 Reset clears only apiquiz: keys; best line, card and section result update in the same render", async () => {
    const storage = stubStorage({
      [KEYS.best]: BEST,
      [KEYS.session]: SESSION,
      "apiquiz:other": "x",
      "other-app:best": "keep",
      apiquizz: "keep too",
    });
    renderApp(Promise.resolve(OK), undefined, new LocalStorageStore(storage));
    await flush();
    expect(main().textContent).toContain(strings.landing.bestScore(50));
    expect(resumeCard()).toBeTruthy();
    expect(progressRegion()?.textContent).toContain(
      strings.progress.description,
    );
    confirmReset();
    const keys = Array.from({ length: storage.length }, (_, i) =>
      storage.key(i),
    );
    expect(keys).toEqual(["other-app:best", "apiquizz"]);
    expect(storage.getItem("other-app:best")).toBe("keep");
    expect(main().textContent).not.toContain(strings.landing.bestScore(50));
    expect(resumeCard()).toBe(null);
    const done = screen.getByText(strings.progress.resetDone);
    expect(document.activeElement).toBe(done);
    expect(resetButton()).toBeTruthy();
    // Start no longer asks: nothing is saved any more.
    expect(
      screen
        .getByRole("button", { name: strings.landing.start })
        .hasAttribute("aria-expanded"),
    ).toBe(false);
  });

  it("T-US6-6 Reset also removes the load notice and the discarded text", async () => {
    const store = createProgressStore();
    store.set(KEYS.best, "{not json");
    store.set(KEYS.session, SESSION);
    renderApp(Promise.resolve(OK));
    await flush();
    await waitFor(() => {
      expect(main().textContent).toContain(strings.progress.bestRemoved);
    });
    fireEvent.click(
      screen.getByRole("button", { name: strings.resume.discard }),
    );
    expect(screen.getByText(strings.resume.discarded)).toBeTruthy();
    confirmReset();
    expect(main().textContent).not.toContain(strings.progress.bestRemoved);
    expect(screen.queryByText(strings.resume.discarded)).toBe(null);
    expect(document.activeElement?.textContent).toBe(
      strings.progress.resetDone,
    );
    // No invisible reserve keeps the old slot height behind.
    expect(main().querySelector('[class*="slotReserve"]')).toBe(null);
  });

  it("T-US6-6 ok: false shows progress.resetFailed and keeps what is still stored", async () => {
    const inner = new MemoryStore();
    inner.set(KEYS.best, BEST);
    inner.set(KEYS.session, SESSION);
    const store: ProgressStore = {
      persistent: true,
      get: (key) => inner.get(key),
      set: (key, value) => inner.set(key, value),
      remove: (key) => inner.remove(key),
      clearAppKeys: () => ({ ok: false, reason: "error" }),
    };
    renderApp(Promise.resolve(OK), undefined, store);
    await flush();
    confirmReset();
    expect(document.activeElement?.textContent).toBe(
      strings.progress.resetFailed,
    );
    expect(main().textContent).toContain(strings.landing.bestScore(50));
    expect(resumeCard()).toBeTruthy();
    expect(screen.queryByText(strings.progress.resetDone)).toBe(null);
  });

  it("T-44-TL01 F1 ok: false re-reads storage: a key removed before the failure is gone, the rest stays", async () => {
    const inner = new MemoryStore();
    inner.set(KEYS.best, BEST);
    inner.set(KEYS.session, SESSION);
    const store: ProgressStore = {
      persistent: true,
      get: (key) => inner.get(key),
      set: (key, value) => inner.set(key, value),
      remove: (key) => inner.remove(key),
      // Fails part-way: the best scores were already removed.
      clearAppKeys: () => {
        inner.remove(KEYS.best);
        return { ok: false, reason: "error" };
      },
    };
    renderApp(Promise.resolve(OK), undefined, store);
    await flush();
    expect(main().textContent).toContain(strings.landing.bestScore(50));
    confirmReset();
    expect(document.activeElement?.textContent).toBe(
      strings.progress.resetFailed,
    );
    expect(main().textContent).not.toContain(strings.landing.bestScore(50));
    expect(resumeCard()).toBeTruthy();
  });

  it("SEC-R17 N1 Reset ends a quiz still held in memory: going back to #/quiz never saves it again", async () => {
    const BANK3 = {
      ...TEST_BANK,
      questions: ["q-1", "q-2", "q-3"].map((qid) => ({
        ...TEST_BANK.questions[0],
        id: qid,
      })),
    } as typeof TEST_BANK;
    renderApp(Promise.resolve({ ok: true, bank: BANK3 }));
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    fireEvent.click(
      screen.getByRole("button", { name: strings.landing.start }),
    );
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.question.heading(1, 3));
    });
    fireEvent.click(screen.getByRole("radio", { name: "True" }));
    fireEvent.click(
      screen.getByRole("button", { name: strings.question.submit }),
    );
    expect(createProgressStore().get(KEYS.session)).not.toBe(null);
    // Unknown route, then the brand link: the quiz stays in memory.
    navigate("#/x");
    await waitFor(() => {
      expect(h1().textContent).toBe(strings.notFound.heading);
    });
    navigate("#/");
    await expectLandingFocused();
    confirmReset();
    expect(createProgressStore().get(KEYS.session)).toBe(null);
    // Like browser Back to #/quiz: no quiz in memory, so Landing again.
    navigate("#/quiz");
    await expectLandingFocused();
    expect(
      screen.queryByRole("button", { name: strings.question.submit }),
    ).toBe(null);
    expect(createProgressStore().get(KEYS.session)).toBe(null);
  });

  it("Cancel and Escape close the confirmation, return focus to Reset and keep the data", async () => {
    createProgressStore().set(KEYS.best, BEST);
    renderApp(Promise.resolve(OK));
    await flush();
    fireEvent.click(resetButton());
    fireEvent.click(
      screen.getByRole("button", { name: strings.common.cancel }),
    );
    expect(document.activeElement).toBe(resetButton());
    fireEvent.click(resetButton());
    fireEvent.keyDown(
      screen.getByRole("button", { name: strings.progress.resetConfirm }),
      { key: "Escape" },
    );
    expect(document.activeElement).toBe(resetButton());
    expect(
      screen.queryByRole("group", { name: strings.progress.resetMessage }),
    ).toBe(null);
    expect(createProgressStore().get(KEYS.best)).toBe(BEST);
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
