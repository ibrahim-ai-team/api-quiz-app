// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Bank, BankQuestion } from "../../../content/types";
import type { QuizScope } from "../../../domain";
import type { BankState } from "../../app/bankState";
import { strings } from "../../strings";
import { Landing, type LandingProps } from "./Landing";

function question(id: string, topic: string): BankQuestion {
  return {
    id,
    topic,
    difficulty: "easy",
    type: "true-false",
    prompt: `Prompt ${id}`,
    options: [
      { id: "true", text: "True" },
      { id: "false", text: "False" },
    ],
    correct: "true",
    explanation: "Explanation.",
    sourceUrl: "https://example.com/",
    reviewStatus: "reviewed",
  };
}

/** Curated order b, d (empty), a; counts b 1, a 2, Mixed 3. */
const BANK: Bank = {
  schemaVersion: 1,
  contentVersion: "landing-test",
  topics: [
    { id: "topic-b", name: "Topic B" },
    { id: "topic-d", name: "Topic D" },
    { id: "topic-a", name: "Topic A" },
  ],
  questions: [
    question("q-1", "topic-a"),
    question("q-2", "topic-b"),
    question("q-3", "topic-a"),
  ],
};

const ready = (bank: Bank = BANK): BankState => ({
  status: "ready",
  attempt: 0,
  bank,
});

function renderLanding(props: Partial<LandingProps> = {}) {
  const onStart = vi.fn<(scope: QuizScope) => boolean>(() => true);
  render(
    <Landing
      bank={ready()}
      onRetry={() => undefined}
      topicId={null}
      topicNotFound={false}
      onStart={onStart}
      {...props}
    />,
  );
  return { onStart };
}

const radios = () => screen.queryAllByRole("radio");
const startButton = () =>
  screen.getByRole("button", { name: strings.landing.start });

afterEach(cleanup);

describe("T-US1-1 topics in curated order with counts, plus Mixed", () => {
  it("lists eligible topics in bank order with counts and Mixed with the total", () => {
    renderLanding();
    const group = screen.getByRole("group", {
      name: strings.landing.topicsLegend,
    });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-label")),
    ).toEqual([
      "Topic B, 1 question",
      "Topic A, 2 questions",
      "Mixed, 3 questions",
    ]);
    expect(
      screen
        .getByRole("radio", { name: "Mixed, 3 questions" })
        .getAttribute("aria-describedby"),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", {
        description: strings.landing.mixedDescription,
      }),
    ).toBeTruthy();
    expect(document.title).toBe(strings.title.landing);
  });
});

describe("T-US1-2 empty topics hidden; Mixed hidden with one topic", () => {
  it("hides a topic with 0 questions", () => {
    renderLanding();
    expect(screen.queryByText("Topic D")).toBe(null);
  });

  it("hides Mixed when only 1 topic is shown", () => {
    renderLanding({
      bank: ready({ ...BANK, questions: BANK.questions.slice(0, 1) }),
    });
    expect(radios()).toHaveLength(1);
    expect(screen.queryByText(strings.landing.mixedLabel)).toBe(null);
  });

  it("shows a message and no Start when the bank has no questions", () => {
    renderLanding({ bank: ready({ ...BANK, questions: [] }) });
    expect(screen.getByText(strings.landing.noTopics)).toBeTruthy();
    expect(screen.queryByRole("button")).toBe(null);
  });
});

describe("T-US1-6/7 Start", () => {
  it("is aria-disabled with the hint until a topic is selected, then starts in 2 interactions", async () => {
    const user = userEvent.setup();
    const { onStart } = renderLanding();
    expect(startButton().getAttribute("aria-disabled")).toBe("true");
    expect(
      screen.getByRole("button", { description: strings.landing.startHint }),
    ).toBe(startButton());
    await user.click(startButton());
    expect(onStart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: /^Topic A/ }));
    expect(startButton().getAttribute("aria-disabled")).toBe(null);
    expect(screen.queryByText(strings.landing.startHint)).toBe(null);
    await user.click(startButton());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({ kind: "topic", topicId: "topic-a" });
  });

  it("calls onStart once on a double click and stays unavailable", async () => {
    const user = userEvent.setup();
    const { onStart } = renderLanding();
    await user.click(screen.getByRole("radio", { name: /^Mixed/ }));
    await user.dblClick(startButton());
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith({ kind: "mixed" });
    expect(startButton().getAttribute("aria-disabled")).toBe("true");
  });

  it("shows an inline error and allows a new attempt when the start fails", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn(() => false);
    renderLanding({ onStart });
    await user.click(screen.getByRole("radio", { name: /^Topic B/ }));
    await user.click(startButton());
    expect(screen.getByRole("alert").textContent).toBe(
      strings.landing.startError,
    );
    await user.click(startButton());
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it("resets the guard and shows the alert when onStart throws, then rethrows", () => {
    const error = new Error("boom");
    const onStart = vi
      .fn<(scope: QuizScope) => boolean>()
      .mockImplementationOnce(() => {
        throw error;
      })
      .mockReturnValue(true);
    renderLanding({ onStart });
    fireEvent.click(screen.getByRole("radio", { name: /^Topic B/ }));
    // React reports a handler error to window "error"; capture it there.
    let reported: unknown = null;
    const onError = (event: ErrorEvent) => {
      reported = event.error;
      event.preventDefault();
    };
    window.addEventListener("error", onError);
    try {
      fireEvent.click(startButton());
    } finally {
      window.removeEventListener("error", onError);
    }
    expect(reported).toBe(error);
    expect(screen.getByRole("alert").textContent).toBe(
      strings.landing.startError,
    );
    expect(startButton().getAttribute("aria-disabled")).toBe(null);
    fireEvent.click(startButton());
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  // Arrow keys between radios are native; covered in E2E (jsdom lacks CSS.escape).
  it("is keyboard operable: Space selects, Tab reaches Start, Enter starts", async () => {
    const user = userEvent.setup();
    const { onStart } = renderLanding();
    await user.tab();
    expect(document.activeElement).toBe(radios()[0]);
    await user.keyboard(" ");
    expect((radios()[0] as HTMLInputElement).checked).toBe(true);
    await user.tab();
    expect(document.activeElement).toBe(startButton());
    await user.keyboard("{Enter}");
    expect(onStart).toHaveBeenCalledWith({ kind: "topic", topicId: "topic-b" });
  });
});

describe("T-US1-8 deep link preselects without auto-start", () => {
  it("preselects a valid topic and does not start", () => {
    const { onStart } = renderLanding({ topicId: "topic-b" });
    const radio = screen.getByRole<HTMLInputElement>("radio", {
      name: /^Topic B/,
    });
    expect(radio.checked).toBe(true);
    expect(startButton().getAttribute("aria-disabled")).toBe(null);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("preselects once the bank is ready", () => {
    const loading: BankState = {
      status: "loading",
      attempt: 0,
      userRetry: false,
    };
    const props = {
      onRetry: () => undefined,
      topicId: "topic-a",
      topicNotFound: false,
      onStart: () => true,
    };
    const view = render(<Landing bank={loading} {...props} />);
    expect(radios()).toHaveLength(0);
    expect(screen.getByRole("status")).toBeTruthy();
    view.rerender(<Landing bank={ready()} {...props} />);
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: /^Topic A/ }).checked,
    ).toBe(true);
  });
});

describe("T-US12-2 topic not found variant (views.md §7b)", () => {
  it("replaces the h1, shows the list with nothing selected and does not echo the slug", () => {
    renderLanding({ topicId: "no-such-slug", topicNotFound: true });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      strings.notFound.topicHeading,
    );
    expect(screen.getByText(strings.notFound.topicBody)).toBeTruthy();
    expect(radios()).toHaveLength(3);
    expect(radios().some((r) => (r as HTMLInputElement).checked)).toBe(false);
    expect(document.body.textContent).not.toContain("no-such-slug");
    expect(document.title).toBe(strings.title.topicNotFound);
  });
});

describe("states and structure", () => {
  it("shows the data error in the topic area with the data error title", () => {
    renderLanding({
      bank: {
        status: "error",
        attempt: 0,
        error: { kind: "network", message: "offline" },
      },
    });
    expect(screen.getByRole("alert").textContent).toContain(
      strings.error.dataHeading,
    );
    expect(document.title).toBe(strings.title.dataError);
    expect(
      screen.getByRole("heading", { level: 1 }).getAttribute("tabindex"),
    ).toBe("-1");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: strings.landing.aboutHeading,
      }),
    ).toBeTruthy();
    // US-12.1: the general report link is there even when the bank failed.
    const report = screen.getByRole("link", {
      name: `${strings.landing.report} ${strings.common.newTabCue}`,
    });
    expect(report.getAttribute("target")).toBe("_blank");
    expect(report.getAttribute("rel")).toBe("noopener noreferrer");
    expect([
      ...new URL(report.getAttribute("href") ?? "").searchParams.keys(),
    ]).toEqual(["template"]);
  });
});
