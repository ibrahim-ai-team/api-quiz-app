// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BankTopic } from "../../../content/types";
import type {
  Answer,
  QuizQuestion,
  QuizScope,
  QuizSession,
} from "../../../domain";
import type { RetryAvailability } from "../../app/session";
import { strings } from "../../strings";
import { Results } from "./Results";

const TOPICS: BankTopic[] = [
  { id: "topic-a", name: "Topic A" },
  { id: "topic-b", name: "Topic B" },
  { id: "topic-c", name: "Topic C" },
];

function question(id: string, topicId: string): QuizQuestion {
  return {
    id,
    topicId,
    type: "true-false",
    difficulty: "easy",
    prompt: `Prompt ${id}`,
    options: [
      { id: "true", text: "True" },
      { id: "false", text: "False" },
    ],
    correctOptionId: "true",
    explanation: "Explanation text.",
    sourceUrl: "https://example.org/",
  };
}

/** Finished session: one `[topicId, correct]` pair per question. */
function finished(
  scope: QuizScope,
  items: readonly (readonly [string, boolean])[],
): QuizSession {
  const questions = items.map(([topicId], i) =>
    question(`q-${String(i)}`, topicId),
  );
  const answers: Answer[] = items.map(([, correct], i) => ({
    questionId: `q-${String(i)}`,
    optionId: correct ? "true" : "false",
    correct,
  }));
  return {
    quiz: {
      scope,
      mode: "normal",
      contentVersion: "v-test",
      seed: 1,
      questions,
    },
    index: Math.max(0, questions.length - 1),
    selected: null,
    answers,
    phase: "finished",
  };
}

const TOPIC_A: QuizScope = { kind: "topic", topicId: "topic-a" };

function renderResults(
  session: QuizSession,
  options: {
    readonly retry?: RetryAvailability;
    readonly retryStarts?: boolean;
    readonly showRetryBestScoreNote?: boolean;
    readonly showFilteredNote?: boolean;
  } = {},
) {
  const onTryAgain = vi.fn();
  const onChooseAnother = vi.fn();
  const onRetryMissed = vi.fn(() => options.retryStarts ?? true);
  // Default: every missed question is still in the bank.
  const missed = session.answers.filter((a) => !a.correct).length;
  render(
    <Results
      session={session}
      topics={TOPICS}
      onTryAgain={onTryAgain}
      onChooseAnother={onChooseAnother}
      retry={options.retry ?? { missed, available: missed }}
      onRetryMissed={onRetryMissed}
      showRetryBestScoreNote={options.showRetryBestScoreNote ?? false}
      showFilteredNote={options.showFilteredNote ?? false}
    />,
  );
  return { onTryAgain, onChooseAnother, onRetryMissed };
}

/** Breakdown h2 (the Review toggle is an h2 too since T-38). */
function breakdownHeading(): HTMLElement | null {
  return screen.queryByRole("heading", {
    level: 2,
    name: strings.results.breakdownHeading,
  });
}

afterEach(() => {
  cleanup();
  document.title = "";
});

describe("T-15 Results view", () => {
  it("T-US4-1 T-US4-2 topic quiz: heading, scope, X / N with %, band, title, no breakdown", () => {
    renderResults(
      finished(TOPIC_A, [
        ["topic-a", true],
        ["topic-a", true],
        ["topic-a", false],
      ]),
    );
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe(strings.results.heading);
    expect(h1.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByText("Topic A")).toBeTruthy();
    // Score and percentage share one paragraph (views.md §4).
    const scoreLine = screen
      .getByText(strings.results.score(2, 3))
      .closest("p");
    expect(scoreLine?.textContent).toContain(strings.results.percent(67));
    expect(screen.getByText(strings.results.band.mid)).toBeTruthy();
    expect(document.title).toBe(strings.title.results("Topic A"));
    expect(breakdownHeading()).toBe(null);
    expect(screen.queryByRole("list")).toBe(null);
  });

  it("T-US4-3 Mixed quiz: breakdown as an h2 plus list in curated topic order", () => {
    renderResults(
      finished({ kind: "mixed" }, [
        ["topic-c", false],
        ["topic-a", true],
        ["topic-c", true],
        ["topic-a", true],
      ]),
    );
    expect(screen.getByText(strings.landing.mixedLabel)).toBeTruthy();
    expect(document.title).toBe(
      strings.title.results(strings.landing.mixedLabel),
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: strings.results.breakdownHeading,
      }),
    ).toBeTruthy();
    const items = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items).toEqual([
      strings.results.breakdownItem("Topic A", 2, 2),
      strings.results.breakdownItem("Topic C", 1, 2),
    ]);
    expect(screen.getByText(strings.results.score(3, 4))).toBeTruthy();
    expect(screen.getByText(strings.results.percent(75))).toBeTruthy();
  });

  it.each([
    [true, 1, 100, strings.results.band.perfect],
    [false, 0, 0, strings.results.band.zero],
  ] as const)(
    "T-US4-5 N = 1 (correct: %s) shows %i / 1, %i%% and its band",
    (correct, x, pct, band) => {
      renderResults(finished(TOPIC_A, [["topic-a", correct]]));
      expect(screen.getByText(strings.results.score(x, 1))).toBeTruthy();
      expect(screen.getByText(strings.results.percent(pct))).toBeTruthy();
      expect(screen.getByText(band)).toBeTruthy();
    },
  );

  it("T-US4-4 Try again comes before Choose another topic; each calls its handler once", () => {
    const { onTryAgain, onChooseAnother } = renderResults(
      finished(TOPIC_A, [["topic-a", true]]),
    );
    // T-38: the Review toggle precedes the buttons (views.md §8.1 R2).
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      strings.review.toggle,
      strings.results.tryAgain,
      strings.results.chooseAnother,
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.tryAgain }),
    );
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onChooseAnother).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.chooseAnother }),
    );
    expect(onChooseAnother).toHaveBeenCalledTimes(1);
  });

  it("TL F1 ignores the 2nd click of a double click (detail 2); keyboard (detail 0) still works", () => {
    const { onTryAgain, onChooseAnother } = renderResults(
      finished(TOPIC_A, [["topic-a", true]]),
    );
    const tryAgain = screen.getByRole("button", {
      name: strings.results.tryAgain,
    });
    const chooseAnother = screen.getByRole("button", {
      name: strings.results.chooseAnother,
    });
    fireEvent.click(tryAgain, { detail: 2 });
    fireEvent.click(chooseAnother, { detail: 2 });
    expect(onTryAgain).not.toHaveBeenCalled();
    expect(onChooseAnother).not.toHaveBeenCalled();
    fireEvent.click(tryAgain, { detail: 0 });
    fireEvent.click(chooseAnother, { detail: 0 });
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(onChooseAnother).toHaveBeenCalledTimes(1);
  });

  it("TL N6 shows no breakdown when only 1 named topic row remains", () => {
    renderResults(
      finished({ kind: "mixed" }, [
        ["topic-a", true],
        ["gone", false],
      ]),
    );
    expect(breakdownHeading()).toBe(null);
    expect(screen.queryByRole("list")).toBe(null);
  });

  it("omits an unknown topic: no scope line, plain title, no breakdown row (SEC-R07 N-3)", () => {
    renderResults(
      finished({ kind: "topic", topicId: "gone" }, [["gone", true]]),
    );
    expect(document.title).toBe(strings.title.results(null));
    expect(screen.queryByText(/gone/)).toBe(null);
    expect(screen.getByText(strings.results.score(1, 1))).toBeTruthy();
  });
});

function retrySession(
  session: QuizSession,
  mode: QuizSession["quiz"]["mode"] = "retry-missed",
): QuizSession {
  return { ...session, quiz: { ...session.quiz, mode } };
}

describe("T-38 Retry missed on Results (US-5.3 to US-5.6, views.md §8.4, §8.5)", () => {
  const twoMissed = () =>
    finished(TOPIC_A, [
      ["topic-a", false],
      ["topic-a", true],
      ["topic-a", false],
    ]);

  it("T-US5-3 no Retry button and no notice when nothing was missed", () => {
    renderResults(finished(TOPIC_A, [["topic-a", true]]));
    expect(screen.queryByRole("button", { name: /^Retry/ })).toBe(null);
    expect(screen.queryByText(strings.results.retryNone(1))).toBe(null);
  });

  it("T-US5-4 places Retry N between Try again and Choose another topic; one call per click", () => {
    const { onRetryMissed, onTryAgain } = renderResults(twoMissed());
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      strings.review.toggle,
      strings.results.tryAgain,
      strings.results.retryMissed(2),
      strings.results.chooseAnother,
    ]);
    expect(strings.results.retryMissed(2)).toBe("Retry 2 missed questions");
    const retry = screen.getByRole("button", {
      name: strings.results.retryMissed(2),
    });
    expect(retry.getAttribute("aria-describedby")).toBe(null);
    fireEvent.click(retry, { detail: 2 });
    expect(onRetryMissed).not.toHaveBeenCalled();
    fireEvent.click(retry, { detail: 1 });
    expect(onRetryMissed).toHaveBeenCalledTimes(1);
    expect(onTryAgain).not.toHaveBeenCalled();
  });

  it("T-US5-4 N = 1: singular label", () => {
    renderResults(finished(TOPIC_A, [["topic-a", false]]));
    expect(
      screen.getByRole("button", { name: "Retry 1 missed question" }),
    ).toBeTruthy();
  });

  it("T-US5-6 some removed: reduced count plus the partial note as its description", () => {
    renderResults(
      finished(TOPIC_A, [
        ["topic-a", false],
        ["topic-a", false],
        ["topic-a", false],
      ]),
      { retry: { missed: 3, available: 1 } },
    );
    const retry = screen.getByRole("button", {
      name: strings.results.retryMissed(1),
    });
    const note = screen.getByText(strings.results.retryPartial(2));
    expect(note.tagName).toBe("P");
    expect(retry.getAttribute("aria-describedby")).toBe(note.id);
    expect(strings.results.retryPartial(1)).toBe(
      "1 missed question is no longer available and will be left out.",
    );
  });

  it.each([
    [1, "The question you missed is no longer available"],
    [2, "The questions you missed are no longer available"],
  ] as const)(
    "T-US5-6 none remain (%i missed): static notice instead of the button",
    (missed, start) => {
      renderResults(
        finished(
          TOPIC_A,
          Array.from({ length: missed }, () => ["topic-a", false] as const),
        ),
        { retry: { missed, available: 0 } },
      );
      expect(screen.queryByRole("button", { name: /^Retry/ })).toBe(null);
      const notice = screen.getByText(strings.results.retryNone(missed));
      expect(notice.textContent.startsWith(start)).toBe(true);
      expect(notice.getAttribute("tabindex")).toBe(null);
      expect(notice.closest("[role=status],[aria-live]")).toBe(null);
      expect(document.activeElement).not.toBe(notice);
    },
  );

  it("T-US5-6 fallback: a failed start replaces the button with the focused notice", async () => {
    const { onRetryMissed } = renderResults(twoMissed(), {
      retryStarts: false,
    });
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.retryMissed(2) }),
    );
    expect(onRetryMissed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /^Retry/ })).toBe(null);
    const notice = screen.getByText(strings.results.retryNone(2));
    expect(notice.getAttribute("tabindex")).toBe("-1");
    await waitFor(() => {
      expect(document.activeElement).toBe(notice);
    });
  });

  it("T-US5-5 retry results: retry h1 and title, Start a full quiz, own misses, no note by default", () => {
    const { onTryAgain } = renderResults(retrySession(twoMissed()));
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toBe(strings.results.retryHeading);
    expect(document.title).toBe(strings.title.resultsRetry("Topic A"));
    expect(document.title).toBe("Retry results - Topic A - ApiQuiz");
    expect(screen.getByText("Topic A")).toBeTruthy();
    expect(screen.queryByText(strings.results.retryNote)).toBe(null);
    expect(
      screen.queryByRole("button", { name: strings.results.tryAgain }),
    ).toBe(null);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      strings.review.toggle,
      strings.results.startFull,
      strings.results.retryMissed(2),
      strings.results.chooseAnother,
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: strings.results.startFull }),
    );
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  it("T-42 hook: showRetryBestScoreNote renders the note under a retry h1 only", () => {
    renderResults(retrySession(twoMissed()), { showRetryBestScoreNote: true });
    const note = screen.getByText(strings.results.retryNote);
    expect(note.previousElementSibling).toBe(
      screen.getByRole("heading", { level: 1 }),
    );
    cleanup();
    renderResults(twoMissed(), { showRetryBestScoreNote: true });
    expect(screen.queryByText(strings.results.retryNote)).toBe(null);
  });

  it("T-49 showFilteredNote renders results.filteredNote under a normal quiz's h1 only (US-11, §10.6)", () => {
    renderResults(twoMissed());
    expect(screen.queryByText(strings.results.filteredNote)).toBe(null);
    cleanup();
    renderResults(twoMissed(), { showFilteredNote: true });
    const note = screen.getByText(strings.results.filteredNote);
    expect(note.previousElementSibling).toBe(
      screen.getByRole("heading", { level: 1 }),
    );
    cleanup();
    renderResults(retrySession(twoMissed()), { showFilteredNote: true });
    expect(screen.queryByText(strings.results.filteredNote)).toBe(null);
  });

  it("retry results with an unknown scope topic omit the title segment", () => {
    renderResults(
      retrySession(
        finished({ kind: "topic", topicId: "gone" }, [["gone", false]]),
      ),
    );
    expect(document.title).toBe("Retry results - ApiQuiz");
  });
});

describe("T-38 Review disclosure on Results (US-5.1, views.md §8.1, §8.2)", () => {
  it("sits after the breakdown and before the buttons, collapsed on entry", () => {
    renderResults(
      finished({ kind: "mixed" }, [
        ["topic-a", true],
        ["topic-c", false],
      ]),
    );
    const h2s = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(h2s).toEqual([
      strings.results.breakdownHeading,
      strings.review.toggle,
    ]);
    const toggle = screen.getByRole("button", { name: strings.review.toggle });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const primary = screen.getByRole("button", {
      name: strings.results.tryAgain,
    });
    expect(
      toggle.compareDocumentPosition(primary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
