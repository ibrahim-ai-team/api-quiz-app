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
import { afterEach, describe, expect, it, vi } from "vitest";
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
  mode: "normal",
  contentVersion: "v-test",
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
  return (
    <Question
      session={session}
      topics={TOPICS}
      contentVersion="v-test"
      dispatch={dispatch}
    />
  );
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

  it("omits the topic line and title segment for an unknown topic id (SEC-R07 N-3)", () => {
    const { container } = renderQuestion({
      scope: { kind: "topic", topicId: "topic-x" },
      mode: "normal",
      contentVersion: "v-test",
      seed: 1,
      questions: [{ ...SECOND, topicId: "topic-x" }],
    });
    expect(container.textContent).not.toContain("Topic:");
    expect(document.title).toBe(
      `${strings.question.heading(1, 1)} - ${strings.appName}`,
    );
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
      screen.getByRole<HTMLInputElement>("radio", {
        name: `POST ${strings.feedback.tagChosen}`,
      }).checked,
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

describe("T-US2-5 double click on Next (TL N2)", () => {
  it("a click with detail 2 right after Submit leaves index 0 in feedback", () => {
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    fireEvent.click(submitButton());
    fireEvent.click(
      screen.getByRole("button", { name: strings.feedback.next }),
      {
        detail: 2,
      },
    );
    expect(latest?.index).toBe(0);
    expect(latest?.phase).toBe("feedback");
    expect(latest?.answers).toHaveLength(1);
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

const cue = strings.common.newTabCue;

function submitOption(name: string) {
  fireEvent.click(screen.getByRole("radio", { name }));
  fireEvent.click(submitButton());
}

describe("T-US3-1 verdict and non-colour option marking", () => {
  it("incorrect: Incorrect h2 names the panel, correct answer line, both rows tagged", () => {
    renderQuestion();
    submitOption("POST");
    const panel = screen.getByRole("region", {
      name: strings.feedback.incorrect,
    });
    expect(panel.tagName).toBe("SECTION");
    expect(within(panel).getByRole("heading", { level: 2 }).textContent).toBe(
      strings.feedback.incorrect,
    );
    expect(panel.textContent).toContain(
      strings.feedback.correctAnswer("Use GET"),
    );
    expect(panel.querySelector("p code")?.textContent).toBe("GET");
    // Tags are text (icons are decorative) and part of each radio's name.
    screen.getByRole("radio", {
      name: `Use GET ${strings.feedback.tagCorrect}`,
    });
    screen.getByRole("radio", { name: `POST ${strings.feedback.tagChosen}` });
    screen.getByRole("radio", { name: "PUT" });
    for (const svg of panel.querySelectorAll("svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("correct: Correct h2, no correct answer line, the chosen row shows both tags", () => {
    renderQuestion();
    submitOption("Use GET");
    const panel = screen.getByRole("region", {
      name: strings.feedback.correct,
    });
    expect(panel.textContent).not.toContain("Correct answer:");
    screen.getByRole("radio", {
      name: `Use GET ${strings.feedback.tagCorrect} ${strings.feedback.tagChosen}`,
    });
    screen.getByRole("radio", { name: "POST" });
  });

  it("renders the explanation as rich text with its own code label", () => {
    const explained = {
      ...SECOND,
      explanation: "Because:\n\n```\nPUT /x\n```\n\n<b>literal</b>",
    };
    renderQuestion({ ...QUIZ, questions: [explained] });
    submitOption("One");
    const panel = screen.getByRole("region", {
      name: strings.feedback.correct,
    });
    within(panel).getByRole("heading", {
      level: 3,
      name: strings.feedback.explanationHeading,
    });
    const code = within(panel).getByRole("region", {
      name: strings.feedback.explanationCodeLabel(1, 1),
    });
    expect(code.textContent).toBe("PUT /x");
    expect(strings.feedback.explanationCodeLabel(1, 1)).not.toBe(
      strings.question.codeLabel(1, 1),
    );
    expect(panel.textContent).toContain("<b>literal</b>");
    expect(panel.querySelector("b")).toBe(null);
  });
});

describe("T-US3-3 live region and focus", () => {
  it("is mounted empty, announces the verdict on Submit, focuses Next, clears on Next", () => {
    renderQuestion();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    submitOption("POST");
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe(strings.feedback.liveIncorrect("Use GET"));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: strings.feedback.next }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: strings.feedback.next }),
      { detail: 1 },
    );
    expect(status.textContent).toBe("");
    submitOption("One");
    expect(status.textContent).toBe(strings.feedback.liveCorrect("One"));
  });
});

describe("T-US3-2 T-US3-5 source and report links", () => {
  it("links the https source by hostname and the report with only id and version", () => {
    renderQuestion();
    submitOption("POST");
    const source = screen.getByRole("link", {
      name: `example.com ${cue}`,
    });
    expect(source.getAttribute("href")).toBe("https://example.com/");
    expect(source.getAttribute("target")).toBe("_blank");
    expect(source.getAttribute("rel")).toBe("noopener noreferrer");
    expect(source.closest("p")?.textContent).toContain(
      strings.feedback.sourcePrefix,
    );
    const report = screen.getByRole("link", {
      name: `${strings.feedback.report} ${cue}`,
    });
    expect(report.getAttribute("rel")).toBe("noopener noreferrer");
    const params = [
      ...new URL(report.getAttribute("href") ?? "").searchParams.entries(),
    ];
    expect(params).toEqual([
      ["template", "question-report.yml"],
      ["title", "[Question] q-1"],
      ["question-id", "q-1"],
      ["content-version", "v-test"],
    ]);
  });

  it("shows a non-https source as plain text, not a link", () => {
    const http = { ...SECOND, sourceUrl: "javascript:alert(1)" };
    const { container } = renderQuestion({ ...QUIZ, questions: [http] });
    submitOption("One");
    expect(container.textContent).toContain(
      strings.feedback.sourceUnlinked("javascript:alert(1)"),
    );
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("a[href^='javascript']")).toBe(null);
  });
});

describe("T-US2-5 the 2nd click of a double Submit keeps focus on Next", () => {
  it("cancels mousedown and click defaults only while continuing the Submit sequence", () => {
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    fireEvent.click(submitButton(), { detail: 1 });
    const panel = screen.getByRole("region", {
      name: strings.feedback.incorrect,
    });
    const report = screen.getByRole("link", {
      name: `${strings.feedback.report} ${cue}`,
    });
    // fireEvent returns false when the default was prevented.
    expect(fireEvent.mouseDown(panel, { detail: 2 })).toBe(false);
    expect(fireEvent.click(report, { detail: 2 })).toBe(false);
    // A new click sequence is untouched.
    expect(fireEvent.mouseDown(panel, { detail: 1 })).toBe(true);
    expect(fireEvent.mouseDown(panel, { detail: 2 })).toBe(true);
    expect(fireEvent.click(report, { detail: 1 })).toBe(true);
  });
});

describe("T-US2-5 the Submit sequence ends on keyboard use and on a new question (TL N1, SEC I-2)", () => {
  it("a keyboard Submit (detail 0) starts no sequence", () => {
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    fireEvent.click(submitButton(), { detail: 0 });
    const panel = screen.getByRole("region", {
      name: strings.feedback.incorrect,
    });
    expect(fireEvent.mouseDown(panel, { detail: 2 })).toBe(true);
  });

  it("a key press ends the sequence", () => {
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    fireEvent.click(submitButton(), { detail: 1 });
    const panel = screen.getByRole("region", {
      name: strings.feedback.incorrect,
    });
    fireEvent.keyDown(panel, { key: "Tab" });
    expect(fireEvent.mouseDown(panel, { detail: 2 })).toBe(true);
  });

  it("a new question ends the sequence", () => {
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    fireEvent.click(submitButton(), { detail: 1 });
    fireEvent.click(
      screen.getByRole("button", { name: strings.feedback.next }),
      { detail: 1 },
    );
    // A detail-2 press right after Next is now cancelled by the entry guard
    // (TL F2), not by the Submit sequence; a fresh press ends both.
    expect(fireEvent.mouseDown(h1(), { detail: 2 })).toBe(false);
    expect(fireEvent.mouseDown(h1(), { detail: 1 })).toBe(true);
    expect(fireEvent.mouseDown(h1(), { detail: 2 })).toBe(true);
  });
});

describe("TL F2 the 2nd click of a double click that opened the question checks nothing", () => {
  const radio = (name: string) =>
    screen.getByRole<HTMLInputElement>("radio", { name });

  it("on mount, detail-2 mousedown and click are cancelled and select nothing", () => {
    renderQuestion();
    expect(fireEvent.mouseDown(radio("POST"), { detail: 2 })).toBe(false);
    expect(fireEvent.click(radio("POST"), { detail: 2 })).toBe(false);
    expect(radio("POST").checked).toBe(false);
    expect(
      submitButton().getAttribute("aria-disabled"),
      "nothing selected",
    ).toBe("true");
  });

  it("a fresh click ends the entry sequence", () => {
    renderQuestion();
    fireEvent.mouseDown(radio("POST"), { detail: 1 });
    fireEvent.click(radio("POST"), { detail: 2 });
    expect(radio("POST").checked).toBe(true);
  });

  it("a key press ends the entry sequence", () => {
    renderQuestion();
    fireEvent.keyDown(h1(), { key: "Tab" });
    fireEvent.click(radio("POST"), { detail: 2 });
    expect(radio("POST").checked).toBe(true);
  });

  it("a new question starts a new entry sequence (double click on Next)", () => {
    renderQuestion();
    fireEvent.click(radio("POST"), { detail: 1 });
    fireEvent.click(submitButton(), { detail: 1 });
    fireEvent.click(
      screen.getByRole("button", { name: strings.feedback.next }),
      { detail: 1 },
    );
    expect(h1().textContent).toBe(strings.question.heading(2, 2));
    fireEvent.click(radio("Two"), { detail: 2 });
    expect(radio("Two").checked).toBe(false);
  });
});

describe("T-US3-3 scroll rule on Submit (views.md §3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function reducedMotion(matches: boolean) {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: matches && query === "(prefers-reduced-motion: reduce)",
          media: query,
        }) as MediaQueryList,
    );
  }

  it("panel and Next fit: scrollIntoView end, auto under reduced motion, then focus without scrolling", () => {
    reducedMotion(true);
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      800,
    );
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    focus.mockClear();
    fireEvent.click(submitButton());
    const next = screen.getByRole("button", { name: strings.feedback.next });
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toBe(next);
    expect(scroll).toHaveBeenCalledWith({ block: "end", behavior: "auto" });
    expect(focus.mock.contexts.at(-1)).toBe(next);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    expect(scroll.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      focus.mock.invocationCallOrder.at(-1) ?? 0,
    );
    expect(document.activeElement).toBe(next);
  });

  it("uses smooth scrolling without reduced motion", () => {
    reducedMotion(false);
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      800,
    );
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    fireEvent.click(submitButton());
    expect(scroll).toHaveBeenCalledWith({ block: "end", behavior: "smooth" });
  });

  it("panel and Next do not fit: a plain focus, no scrollIntoView", () => {
    reducedMotion(true);
    vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(
      300,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 1000,
    } as DOMRect);
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    renderQuestion();
    fireEvent.click(screen.getByRole("radio", { name: "POST" }));
    focus.mockClear();
    fireEvent.click(submitButton());
    expect(scroll).not.toHaveBeenCalled();
    expect(focus).toHaveBeenLastCalledWith();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: strings.feedback.next }),
    );
  });
});
