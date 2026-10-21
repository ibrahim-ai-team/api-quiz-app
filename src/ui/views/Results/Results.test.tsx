// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BankTopic } from "../../../content/types";
import type {
  Answer,
  QuizQuestion,
  QuizScope,
  QuizSession,
} from "../../../domain";
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
    quiz: { scope, seed: 1, questions },
    index: Math.max(0, questions.length - 1),
    selected: null,
    answers,
    phase: "finished",
  };
}

const TOPIC_A: QuizScope = { kind: "topic", topicId: "topic-a" };

function renderResults(session: QuizSession) {
  const onTryAgain = vi.fn();
  const onChooseAnother = vi.fn();
  render(
    <Results
      session={session}
      topics={TOPICS}
      onTryAgain={onTryAgain}
      onChooseAnother={onChooseAnother}
    />,
  );
  return { onTryAgain, onChooseAnother };
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
    expect(screen.queryByRole("heading", { level: 2 })).toBe(null);
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
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
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
    expect(screen.queryByRole("heading", { level: 2 })).toBe(null);
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
