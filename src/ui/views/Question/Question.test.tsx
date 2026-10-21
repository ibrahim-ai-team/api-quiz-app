// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { BankTopic } from "../../../content/types";
import {
  quizReducer,
  startSession,
  type Quiz,
  type QuizAction,
  type QuizQuestion,
  type QuizSession,
} from "../../../domain";
import { strings } from "../../strings";
import { Question } from "./Question";

const TOPICS: BankTopic[] = [
  { id: "topic-a", name: "Topic A" },
  { id: "topic-b", name: "Topic B" },
];

function question(
  id: string,
  topicId: string,
  prompt: string,
  texts: string[],
): QuizQuestion {
  const options = texts.map((text, i) => ({ id: "abcd"[i] ?? "a", text }));
  return {
    id,
    topicId,
    type: "single-choice",
    difficulty: "easy",
    prompt,
    options,
    correctOptionId: "a",
    explanation: "Explanation text.",
    sourceUrl: "https://example.com/",
  };
}

const SECOND = question("q-2", "topic-b", "Second prompt", [
  "One",
  "Two",
  "Three",
]);

const QUIZ: Quiz = {
  scope: { kind: "mixed" },
  seed: 1,
  questions: [
    question("q-1", "topic-a", "Which method?\n\n```\nGET /x HTTP/1.1\n```", [
      "Use `GET`",
      "POST",
      "PUT",
    ]),
    SECOND,
  ],
};

let latest: QuizSession | null = null;

/** Domain reducer that also records the latest state for assertions. */
function recording(state: QuizSession, action: QuizAction): QuizSession {
  latest = quizReducer(state, action);
  return latest;
}

function start(quiz: Quiz): QuizSession {
  latest = startSession(quiz);
  return latest;
}

function Harness({ quiz }: { readonly quiz: Quiz }) {
  const [session, dispatch] = useReducer(recording, quiz, start);
  return <Question session={session} topics={TOPICS} dispatch={dispatch} />;
}

function renderQuestion(quiz: Quiz = QUIZ) {
  return render(<Harness quiz={quiz} />);
}

const submitButton = () =>
  screen.getByRole("button", { name: strings.question.submit });
const h1 = () => screen.getByRole("heading", { level: 1 });

afterEach(() => {
  cleanup();
  latest = null;
});

describe("T-US2-1 question, topic, progress and radio group", () => {
  it("shows k of N as the h1, the topic, the prompt and a labelled radio group", () => {
    const { container } = renderQuestion();
    expect(h1().textContent).toBe(strings.question.heading(1, 2));
    expect(h1().getAttribute("tabindex")).toBe("-1");
    expect(screen.getByText(strings.question.topic("Topic A"))).toBeTruthy();
    const group = screen.getByRole("group", {
      name: strings.question.optionsLegend,
    });
    expect(group.tagName).toBe("FIELDSET");
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(
      container
        .querySelector("[data-question-id]")
        ?.getAttribute("data-question-id"),
    ).toBe("q-1");
    expect(document.title).toBe(strings.title.question(1, 2, "Mixed"));
  });

  it("renders the prompt code box with the question code label and options inline only", () => {
    const { container } = renderQuestion();
    const code = screen.getByRole("region", {
      name: strings.question.codeLabel(1, 1),
    });
    expect(code.tagName).toBe("PRE");
    expect(code.getAttribute("tabindex")).toBe("0");
    const label = screen
      .getByRole("radio", { name: "Use GET" })
      .closest("label");
    expect(label?.querySelector("code")?.textContent).toBe("GET");
    expect(container.querySelectorAll("label p, label pre")).toHaveLength(0);
  });

  it("uses the topic name in the title of a topic quiz", () => {
    renderQuestion({ ...QUIZ, scope: { kind: "topic", topicId: "topic-a" } });
    expect(document.title).toBe(strings.title.question(1, 2, "Topic A"));
  });
});

describe("T-US2-3 Submit is unavailable until an option is selected", () => {
  it("is aria-disabled (not disabled), described by the hint, and does nothing", () => {
    renderQuestion();
    const submit = submitButton();
    expect(submit.getAttribute("aria-disabled")).toBe("true");
    expect(submit.hasAttribute("disabled")).toBe(false);
    const hintId = submit.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(hintId)?.textContent).toBe(
      strings.question.submitHint,
    );
    fireEvent.click(submit);
    expect(latest?.answers).toEqual([]);
    expect(latest?.phase).toBe("answering");
  });

  it("becomes available and drops the hint once an option is selected", () => {
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    expect(submitButton().hasAttribute("aria-disabled")).toBe(false);
    expect(submitButton().hasAttribute("aria-describedby")).toBe(false);
    expect(screen.queryByText(strings.question.submitHint)).toBe(null);
  });
});

describe("T-US2-4/5 locked after Submit, one answer, one step", () => {
  it("locks the fieldset, focuses Next and ignores a second Submit", () => {
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    const submit = submitButton();
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(latest?.answers).toHaveLength(1);
    expect(latest?.index).toBe(0);
    const group = screen.getByRole("group", {
      name: strings.question.optionsLegend,
    });
    expect((group as HTMLFieldSetElement).disabled).toBe(true);
    const next = screen.getByRole("button", { name: strings.feedback.next });
    expect(document.activeElement).toBe(next);
    expect(
      screen.queryByRole("button", { name: strings.question.submit }),
    ).toBe(null);
    fireEvent.click(screen.getByRole("radio", { name: "PUT" }));
    expect(latest?.selected).toBe("b");
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "POST" }).checked,
    ).toBe(true);
  });

  it("Next advances exactly 1 question, focuses the new h1, and ignores the second click of a double click", () => {
    const { container } = renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    fireEvent.click(submitButton());
    const next = screen.getByRole("button", { name: strings.feedback.next });
    fireEvent.click(next, { detail: 1 });
    expect(h1().textContent).toBe(strings.question.heading(2, 2));
    expect(document.activeElement).toBe(h1());
    expect(
      container
        .querySelector("[data-question-id]")
        ?.getAttribute("data-question-id"),
    ).toBe("q-2");
    expect(screen.getByText(strings.question.topic("Topic B"))).toBeTruthy();
    expect(
      screen.getAllByRole<HTMLInputElement>("radio").some((r) => r.checked),
    ).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: "One" }));
    fireEvent.click(submitButton());
    const seeResults = screen.getByRole("button", {
      name: strings.feedback.seeResults,
    });
    fireEvent.click(seeResults, { detail: 2 });
    expect(latest?.phase).toBe("feedback");
    fireEvent.click(seeResults, { detail: 1 });
    expect(latest?.phase).toBe("finished");
  });
});

// Arrow keys between radios are native; covered in E2E (jsdom lacks CSS.escape).
describe("T-US2-9 keyboard operation", () => {
  it("Space selects the focused radio; Enter on Submit locks and focuses Next", async () => {
    const user = userEvent.setup();
    renderQuestion({ ...QUIZ, questions: [SECOND] });
    act(() => {
      h1().focus();
    });
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "One" }),
    );
    await user.keyboard(" ");
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: "One" }).checked,
    ).toBe(true);
    await user.tab();
    expect(document.activeElement).toBe(submitButton());
    await user.keyboard("{Enter}");
    expect(latest?.answers).toEqual([
      { questionId: "q-2", optionId: "a", correct: true },
    ]);
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: strings.feedback.seeResults }),
    );
  });
});
