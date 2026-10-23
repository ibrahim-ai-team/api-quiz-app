// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BankTopic } from "../../../content/types";
import type { QuizQuestion, QuizSession } from "../../../domain";
import { strings } from "../../strings";
import { Review } from "./Review";

const TOPICS: BankTopic[] = [{ id: "http", name: "HTTP methods" }];

const Q1: QuizQuestion = {
  id: "q-put",
  topicId: "http",
  type: "single-choice",
  difficulty: "easy",
  prompt: "Which request is idempotent?\n\n```\nPUT /items/42 HTTP/1.1\n```",
  options: [
    { id: "a", text: "`POST`" },
    { id: "b", text: "`PUT`" },
    { id: "c", text: "`PATCH`" },
  ],
  correctOptionId: "b",
  explanation:
    "PUT replaces the resource.\n\n```\nPUT /a\n```\n\n```\nPUT /a\n```",
  sourceUrl: "https://www.rfc-editor.org/rfc/rfc9110#name-put",
};

const Q2: QuizQuestion = {
  id: "q-get",
  topicId: "gone-topic",
  type: "true-false",
  difficulty: "easy",
  prompt: "GET is safe.\n\n```\nGET /a\n```\n\n```\nGET /b\n```",
  options: [
    { id: "true", text: "True" },
    { id: "false", text: "False" },
  ],
  correctOptionId: "true",
  explanation: "GET is safe.",
  sourceUrl: "http://example.org/insecure",
};

const SESSION: QuizSession = {
  quiz: {
    scope: { kind: "mixed" },
    mode: "normal",
    contentVersion: "v",
    seed: 1,
    questions: [Q1, Q2],
  },
  index: 1,
  selected: null,
  answers: [
    { questionId: "q-put", optionId: "b", correct: true },
    { questionId: "q-get", optionId: "false", correct: false },
  ],
  phase: "finished",
};

function renderReview(session: QuizSession = SESSION) {
  render(<Review session={session} topics={TOPICS} />);
  return screen.getByRole("button", { name: strings.review.toggle });
}

afterEach(cleanup);

describe("T-38 Review disclosure (US-5.1, views.md §8.2)", () => {
  it("is an h2 holding a collapsed button that controls a list rendered only when expanded", () => {
    const toggle = renderReview();
    const h2 = screen.getByRole("heading", { level: 2 });
    expect(h2.textContent).toBe(strings.review.toggle);
    expect(toggle.parentElement).toBe(h2);
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const listId = toggle.getAttribute("aria-controls") ?? "";
    expect(listId).not.toBe("");
    expect(document.getElementById(listId)).toBe(null);
    expect(screen.queryByRole("heading", { level: 3 })).toBe(null);
    // The chevron is decorative.
    expect(toggle.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("toggles on activation and keeps focus on the toggle (no script focus inside)", () => {
    const toggle = renderReview();
    toggle.focus();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const list = document.getElementById(
      toggle.getAttribute("aria-controls") ?? "",
    );
    expect(list?.tagName).toBe("OL");
    expect(list?.getAttribute("role")).toBe(null);
    expect(document.activeElement).toBe(toggle);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list")).toBe(null);
    expect(document.activeElement).toBe(toggle);
  });

  it("starts collapsed again on a new mount (each Results view)", () => {
    const toggle = renderReview();
    fireEvent.click(toggle);
    cleanup();
    expect(renderReview().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("T-38 Review items (US-5.1, US-5.2, views.md §8.3)", () => {
  function expand() {
    fireEvent.click(renderReview());
    return screen.getAllByRole("listitem");
  }

  it("lists every question in quiz order with a verdict h3 that is not colour-only", () => {
    const items = expand();
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.getAttribute("data-question-id"))).toEqual([
      "q-put",
      "q-get",
    ]);
    const h3s = screen.getAllByRole("heading", { level: 3 });
    expect(h3s.map((h) => h.textContent)).toEqual([
      strings.review.itemHeading(1, strings.feedback.correct),
      strings.review.itemHeading(2, strings.feedback.incorrect),
    ]);
    expect(h3s[0]?.textContent).toBe("Question 1: Correct");
    for (const h of h3s)
      expect(h.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows topic, prompt, your answer, correct answer, explanation h4 and the source link", () => {
    const [first] = expand();
    if (first === undefined) throw new Error("no item");
    const item = within(first);
    expect(item.getByText(strings.question.topic("HTTP methods"))).toBeTruthy();
    expect(item.getByText("Which request is idempotent?")).toBeTruthy();
    const yours = first.querySelectorAll("p")[2];
    expect(yours?.textContent).toBe(strings.review.yourAnswer("PUT"));
    // Inline code in the option text goes through the safe renderer.
    expect(yours?.querySelector("code")?.textContent).toBe("PUT");
    expect(
      item.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          el.textContent === strings.feedback.correctAnswer("PUT"),
      ),
    ).toBeTruthy();
    expect(
      item.getByRole("heading", {
        level: 4,
        name: strings.feedback.explanationHeading,
      }),
    ).toBeTruthy();
    expect(item.getByText("PUT replaces the resource.")).toBeTruthy();
    const link = item.getByRole("link", {
      name: `www.rfc-editor.org ${strings.common.newTabCue}`,
    });
    expect(link.getAttribute("href")).toBe(
      "https://www.rfc-editor.org/rfc/rfc9110#name-put",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    // No report link in the review (views.md §8.3).
    expect(item.queryByText(strings.feedback.report)).toBe(null);
  });

  it("marks a wrong answer with text, cross icon and the dashed-style class; correct answer stays separate", () => {
    const [first, second] = expand();
    if (first === undefined || second === undefined) throw new Error("no item");
    const answerBoxes = (li: HTMLElement) =>
      Array.from(li.querySelectorAll("p")).filter((p) =>
        p.querySelector("svg"),
      );
    const [wrongYours, wrongCorrect] = answerBoxes(second);
    expect(wrongYours?.textContent).toBe(strings.review.yourAnswer("False"));
    expect(wrongCorrect?.textContent).toBe(
      strings.feedback.correctAnswer("True"),
    );
    const [rightYours, rightCorrect] = answerBoxes(first);
    // Wrong and right answer boxes differ by class (dashed vs solid), and
    // both answer lines carry their meaning in text.
    expect(wrongYours?.className).not.toBe(rightYours?.className);
    expect(rightYours?.className).toBe(rightCorrect?.className);
    expect(wrongCorrect?.className).toBe(rightCorrect?.className);
    // The cross and check icons have different paths.
    expect(wrongYours?.querySelector("path")?.getAttribute("d")).not.toBe(
      rightYours?.querySelector("path")?.getAttribute("d"),
    );
  });

  it("omits the topic line for an unknown topic and shows a non-https source as plain text", () => {
    const [, second] = expand();
    if (second === undefined) throw new Error("no item");
    expect(second.textContent).not.toContain("gone-topic");
    expect(second.textContent).not.toContain("Topic:");
    expect(within(second).queryByRole("link")).toBe(null);
    expect(
      within(second).getByText(
        strings.feedback.sourceUnlinked("http://example.org/insecure"),
      ),
    ).toBeTruthy();
  });

  it("gives every code region on the page a unique, numbered name", () => {
    expand();
    const names = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label"));
    expect(names).toEqual([
      strings.review.promptCodeLabel(1, 1, 1),
      strings.review.explanationCodeLabel(1, 1, 2),
      strings.review.explanationCodeLabel(1, 2, 2),
      strings.review.promptCodeLabel(2, 1, 2),
      strings.review.promptCodeLabel(2, 2, 2),
    ]);
    expect(names[0]).toBe("Question 1 code example");
    expect(names[2]).toBe("Question 1 explanation code example 2 of 2");
    expect(new Set(names).size).toBe(names.length);
  });
});
