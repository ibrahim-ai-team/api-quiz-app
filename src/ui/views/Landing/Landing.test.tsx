// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { landingReserve } from "../../../content/landingReserve";
import type { Bank, BankQuestion } from "../../../content/types";
import { startSession, type QuizScope } from "../../../domain";
import type { BankState } from "../../app/bankState";
import { strings } from "../../strings";
import {
  DEFAULT_SETTINGS,
  Landing,
  type LandingProps,
  type QuizSettings,
} from "./Landing";
import type { LandingProgress } from "./progress";

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

/** Topic radios only (the US-11 settings groups have radios too). */
const radios = () => {
  const group = screen.queryByRole("group", {
    name: strings.landing.topicsLegend,
  });
  return group === null ? [] : within(group).queryAllByRole("radio");
};
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
    // US-11: Difficulty and Number of questions are one Tab stop each.
    await user.tab();
    await user.tab();
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

describe("T-US12-1 description, accuracy note and report link (T-46, views.md §1)", () => {
  it("shows the description under the h1 and the accuracy note and report link in About the questions", () => {
    renderLanding();
    const h1 = screen.getByRole("heading", {
      level: 1,
      name: strings.landing.heading,
    });
    const description = screen.getByText(strings.landing.description);
    expect(h1.nextElementSibling).toBe(description);

    const about = screen.getByRole("heading", {
      level: 2,
      name: strings.landing.aboutHeading,
    });
    const note = screen.getByText(strings.landing.accuracyNote);
    expect(about.nextElementSibling).toBe(note);
    const report = screen.getByRole("link", {
      name: `${strings.landing.report} ${strings.common.newTabCue}`,
    });
    // The report link follows the note, still inside About the questions.
    expect(note.nextElementSibling?.contains(report)).toBe(true);
  });

  it("keeps the accuracy note and report link but swaps the description in the topic-not-found variant", () => {
    renderLanding({ topicId: "no-such-slug", topicNotFound: true });
    expect(screen.queryByText(strings.landing.description)).toBeNull();
    expect(screen.getByText(strings.landing.accuracyNote)).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: `${strings.landing.report} ${strings.common.newTabCue}`,
      }),
    ).toBeTruthy();
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
  it("reserves the loaded group with the generated topic names while loading (T-35)", () => {
    renderLanding({
      bank: { status: "loading", attempt: 0, userRetry: false },
    });
    const reserve = document.querySelector('[aria-hidden="true"]');
    expect(reserve).not.toBeNull();
    // aria-label is "<name>, <count>"; a name may itself contain ", ".
    const names = [
      ...(reserve?.querySelectorAll("input[aria-label]") ?? []),
    ].map((input) => {
      const label = input.getAttribute("aria-label") ?? "";
      return label.slice(0, label.lastIndexOf(", "));
    });
    expect(names).toEqual([
      ...landingReserve.topicNames,
      ...(landingReserve.eligibleTopicCount > 1
        ? [strings.landing.mixedLabel]
        : []),
    ]);
    // Placeholder rows are not in the accessibility tree.
    expect(radios()).toHaveLength(0);
  });

  it("reserves the Start hint only when the loaded group will show it (T-35)", () => {
    const loading: BankState = {
      status: "loading",
      attempt: 0,
      userRetry: false,
    };
    const hint = () =>
      document
        .querySelector('[aria-hidden="true"]')
        ?.textContent.includes(strings.landing.startHint);
    renderLanding({ bank: loading, topicId: "no-such-topic" });
    expect(hint()).toBe(true);
    cleanup();
    renderLanding({ bank: loading, topicId: landingReserve.topicIds[0] ?? "" });
    expect(hint()).toBe(false);
  });

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

describe("T-US6-1 best score in topic rows (T-42, views.md §9.3)", () => {
  const at = 1761200000000;
  const best = {
    "topic-a": { percent: 50, correct: 1, total: 2, at },
    mixed: { percent: 67, correct: 2, total: 3, at },
  };

  it("shows each topic's and Mixed's own best as a line and in the accessible name", () => {
    renderLanding({ bestScores: best });
    expect(
      screen.getByRole("radio", {
        name: `Topic A, ${strings.landing.topicCount(2)}, ${strings.landing.bestScore(50)}`,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", {
        name: `${strings.landing.mixedLabel}, ${strings.landing.topicCount(3)}, ${strings.landing.bestScore(67)}`,
      }),
    ).toBeTruthy();
    // A row with no best score shows nothing (DQ-US6-2).
    const topicB = screen.getByRole("radio", {
      name: `Topic B, ${strings.landing.topicCount(1)}`,
    });
    expect(topicB.closest("label")?.textContent).not.toContain("Best score");
    const mixedRow = screen
      .getByRole("radio", {
        name: new RegExp(`^${strings.landing.mixedLabel}`),
      })
      .closest("label");
    expect(mixedRow?.textContent).toContain(strings.landing.bestScore(67));
    // Mixed keeps its description in aria-describedby.
    expect(
      screen
        .getByRole("radio", {
          name: new RegExp(`^${strings.landing.mixedLabel}`),
        })
        .getAttribute("aria-describedby"),
    ).not.toBeNull();
  });

  it("shows no best-score text without best scores (null: storage not persistent)", () => {
    renderLanding({ bestScores: null });
    expect(document.body.textContent).not.toContain("Best score");
    expect(
      screen.getByRole("radio", {
        name: `Topic A, ${strings.landing.topicCount(2)}`,
      }),
    ).toBeTruthy();
  });

  it("ignores inherited keys such as toString", () => {
    renderLanding({
      bank: ready({
        ...BANK,
        topics: [{ id: "toString", name: "Odd" }],
        questions: [question("q-1", "toString")],
      }),
      bestScores: {},
    });
    expect(document.body.textContent).not.toContain("Best score");
  });

  it("reserves the best-score line of a stored topic while loading (no shift)", () => {
    const firstId = landingReserve.topicIds[0] ?? "";
    renderLanding({
      bank: { status: "loading", attempt: 0, userRetry: false },
      bestScores: { [firstId]: { percent: 75, correct: 3, total: 4, at } },
    });
    const reserve = document.querySelector('[aria-hidden="true"]');
    const rows = reserve?.querySelectorAll("label") ?? [];
    expect(rows[0]?.textContent).toContain(strings.landing.bestScore(75));
    expect(reserve?.textContent.match(/Best score/g)).toHaveLength(1);
  });
});

describe("T-43 replace confirmation when starting fails (views.md §9.6; T-43-TL01 L3)", () => {
  it("closes the group, shows the start error, focuses Start, and the card stays gone", () => {
    const resumable = startSession({
      scope: { kind: "topic", topicId: "topic-a" },
      mode: "normal",
      contentVersion: "landing-test",
      seed: 1,
      questions: [],
    });
    function Harness() {
      // Like the app: the saved quiz is removed first, then starting fails.
      const [saved, setSaved] = useState<typeof resumable | null>(resumable);
      const progress: LandingProgress = {
        resumable: saved,
        notice: { session: false, best: false },
        reserve: null,
        onResume: () => false,
        onDiscard: () => undefined,
        onReplaceStart: () => {
          setSaved(null);
          return false;
        },
        onReset: () => true,
      };
      return (
        <Landing
          bank={ready()}
          onRetry={() => undefined}
          topicId={null}
          topicNotFound={false}
          onStart={() => true}
          progress={progress}
        />
      );
    }
    render(<Harness />);
    expect(
      screen.getByRole("region", { name: strings.resume.heading }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    fireEvent.click(startButton());
    fireEvent.click(
      screen.getByRole("button", { name: strings.landing.replaceConfirm }),
    );
    expect(screen.getByRole("alert").textContent).toBe(
      strings.landing.startError,
    );
    expect(document.activeElement).toBe(startButton());
    expect(
      screen.queryByRole("group", { name: strings.landing.replaceMessage }),
    ).toBe(null);
    expect(screen.queryByRole("region", { name: strings.resume.heading })).toBe(
      null,
    );
    // No card any more: Start is a plain Start again.
    expect(startButton().hasAttribute("aria-expanded")).toBe(false);
  });
});

describe("T-44 Your progress and Reset progress (US-6.6, views.md §9.6)", () => {
  function progressProps(onReset: () => boolean): LandingProgress {
    return {
      resumable: null,
      notice: { session: false, best: false },
      reserve: null,
      onResume: () => false,
      onDiscard: () => undefined,
      onReplaceStart: () => true,
      onReset,
    };
  }
  const resetButton = () =>
    screen.getByRole("button", { name: strings.progress.reset });
  const section = () =>
    screen.queryByRole("region", { name: strings.progress.heading });

  it("is the last section, after About the questions, with heading, text and Reset", () => {
    renderLanding({ progress: progressProps(() => true) });
    const region = section();
    expect(region).toBeTruthy();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings.slice(-2)).toEqual([
      strings.landing.aboutHeading,
      strings.progress.heading,
    ]);
    expect(region?.textContent).toContain(strings.progress.description);
    expect(resetButton().getAttribute("aria-expanded")).toBe("false");
    expect(resetButton().hasAttribute("aria-controls")).toBe(false);
  });

  it("US-6.5 is not rendered without persistent storage (progress null)", () => {
    renderLanding();
    expect(section()).toBe(null);
    expect(screen.queryByText(strings.progress.reset)).toBe(null);
  });

  it("is not rendered while the bank loads or failed (§9.2)", () => {
    renderLanding({
      bank: { status: "loading", attempt: 0, userRetry: false },
      progress: progressProps(() => true),
    });
    expect(screen.queryByText(strings.progress.heading)).toBe(null);
  });

  it("is still shown when no topic is playable (§9.2 No topics)", () => {
    renderLanding({
      bank: ready({ ...BANK, questions: [] }),
      progress: progressProps(() => true),
    });
    expect(section()).toBeTruthy();
  });

  it("opens the confirmation and focuses its message; Cancel returns focus to Reset", () => {
    const onReset = vi.fn(() => true);
    renderLanding({ progress: progressProps(onReset) });
    fireEvent.click(resetButton());
    const group = screen.getByRole("group", {
      name: strings.progress.resetMessage,
    });
    expect(document.activeElement?.textContent).toBe(
      strings.progress.resetMessage,
    );
    expect(resetButton().getAttribute("aria-expanded")).toBe("true");
    expect(resetButton().getAttribute("aria-controls")).toBe(group.id);
    fireEvent.click(
      within(group).getByRole("button", { name: strings.common.cancel }),
    );
    expect(document.activeElement).toBe(resetButton());
    expect(
      screen.queryByRole("group", { name: strings.progress.resetMessage }),
    ).toBe(null);
    expect(resetButton().getAttribute("aria-expanded")).toBe("false");
    expect(resetButton().hasAttribute("aria-controls")).toBe(false);
    expect(onReset).not.toHaveBeenCalled();
  });

  it("Escape inside the group closes it and returns focus to Reset", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn(() => true);
    renderLanding({ progress: progressProps(onReset) });
    await user.click(resetButton());
    await user.tab();
    expect(document.activeElement?.textContent).toBe(
      strings.progress.resetConfirm,
    );
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(resetButton());
    expect(onReset).not.toHaveBeenCalled();
  });

  it("confirm resets once and focuses the result text, which Reset replaces again", () => {
    const onReset = vi.fn(() => true);
    renderLanding({ progress: progressProps(onReset) });
    fireEvent.click(resetButton());
    fireEvent.click(
      screen.getByRole("button", { name: strings.progress.resetConfirm }),
    );
    expect(onReset).toHaveBeenCalledTimes(1);
    const done = screen.getByText(strings.progress.resetDone);
    expect(document.activeElement).toBe(done);
    expect(done.getAttribute("tabindex")).toBe("-1");
    expect(
      screen.queryByRole("group", { name: strings.progress.resetMessage }),
    ).toBe(null);
    // The trigger stays; pressing it again replaces the result text.
    fireEvent.click(resetButton());
    expect(screen.queryByText(strings.progress.resetDone)).toBe(null);
    expect(document.activeElement?.textContent).toBe(
      strings.progress.resetMessage,
    );
  });

  it("a failed reset focuses progress.resetFailed", () => {
    renderLanding({ progress: progressProps(() => false) });
    fireEvent.click(resetButton());
    fireEvent.click(
      screen.getByRole("button", { name: strings.progress.resetConfirm }),
    );
    expect(document.activeElement?.textContent).toBe(
      strings.progress.resetFailed,
    );
    expect(screen.queryByText(strings.progress.resetDone)).toBe(null);
  });
});

describe("T-49 difficulty and length groups (US-11, views.md §10)", () => {
  function q(
    id: string,
    topic: string,
    difficulty: BankQuestion["difficulty"],
  ) {
    return { ...question(id, topic), difficulty };
  }
  /** Topic B: 1 easy, 1 hard; Topic A: 2 easy, 0 hard. Mixed: 1 hard. */
  const BANK_D: Bank = {
    ...BANK,
    questions: [
      q("q-1", "topic-a", "easy"),
      q("q-2", "topic-b", "easy"),
      q("q-3", "topic-a", "easy"),
      q("q-4", "topic-b", "hard"),
    ],
  };
  const group = (name: string) => screen.getByRole("group", { name });
  const difficultyRadio = (name: string) =>
    within(group(strings.landing.difficultyLegend)).getByRole("radio", {
      name,
    });
  const lengthRadio = (n: number) =>
    within(group(strings.landing.lengthLegend)).getByRole("radio", {
      name: String(n),
    });
  const description = () =>
    document.getElementById(
      startButton().getAttribute("aria-describedby") ?? "",
    )?.textContent ?? "";

  /** Landing whose settings live in a parent, like App. */
  function renderWithSettings(props: Partial<LandingProps> = {}) {
    const onStart = vi.fn<(scope: QuizScope) => boolean>(() => true);
    function Harness() {
      const [settings, setSettings] = useState<QuizSettings>(DEFAULT_SETTINGS);
      return (
        <Landing
          bank={ready(BANK_D)}
          onRetry={() => undefined}
          topicId={null}
          topicNotFound={false}
          onStart={onStart}
          settings={settings}
          onSettingsChange={setSettings}
          {...props}
        />
      );
    }
    render(<Harness />);
    return { onStart };
  }

  it("renders both groups after the topics, before Start, with the defaults checked", () => {
    renderWithSettings();
    const difficulty = group(strings.landing.difficultyLegend);
    const length = group(strings.landing.lengthLegend);
    expect(
      within(difficulty)
        .getAllByRole("radio")
        .map((r) => r.closest("label")?.textContent),
    ).toEqual(["All", "Easy", "Medium", "Hard"]);
    expect(
      within(length)
        .getAllByRole("radio")
        .map((r) => r.closest("label")?.textContent),
    ).toEqual(["5", "10", "20"]);
    expect((difficultyRadio("All") as HTMLInputElement).checked).toBe(true);
    expect((lengthRadio(10) as HTMLInputElement).checked).toBe(true);
    const topics = group(strings.landing.topicsLegend);
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(topics, difficulty)).toBe(true);
    expect(follows(difficulty, length)).toBe(true);
    expect(follows(length, startButton())).toBe(true);
  });

  it("row counts follow the difficulty; rows stay, Mixed keeps its place", () => {
    renderWithSettings();
    fireEvent.click(difficultyRadio("Hard"));
    expect(radios().map((r) => r.getAttribute("aria-label"))).toEqual([
      `Topic B, ${strings.landing.topicCount(1)}`,
      `Topic A, ${strings.landing.topicCount(0)}`,
      `${strings.landing.mixedLabel}, ${strings.landing.topicCount(1)}`,
    ]);
  });

  it("no hint at the defaults even when the topic has fewer than 10", () => {
    renderWithSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    expect(startButton().hasAttribute("aria-describedby")).toBe(false);
    expect(document.body.textContent).not.toContain("are available");
  });

  it("T-US11-1 a changed setting states the real number as Start's description", () => {
    const { onStart } = renderWithSettings();
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    fireEvent.click(lengthRadio(5));
    expect(description()).toBe(strings.landing.shortHint(2));
    fireEvent.click(screen.getByRole("radio", { name: /^Topic B/ }));
    fireEvent.click(difficultyRadio("Hard"));
    expect(description()).toBe(strings.landing.shortHint(1, "hard"));
    expect(startButton().getAttribute("aria-disabled")).toBe(null);
    fireEvent.click(startButton());
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("T-US11-2 0 matches: aria-disabled Start with noneHint; activating it does nothing, no replace confirmation", () => {
    const resumable = startSession({
      scope: { kind: "topic", topicId: "topic-a" },
      mode: "normal",
      contentVersion: "landing-test",
      seed: 1,
      questions: [],
    });
    const onReplaceStart = vi.fn(() => true);
    const { onStart } = renderWithSettings({
      progress: {
        resumable,
        notice: { session: false, best: false },
        reserve: null,
        onResume: () => false,
        onDiscard: () => undefined,
        onReplaceStart,
        onReset: () => true,
      },
    });
    fireEvent.click(screen.getByRole("radio", { name: /^Topic A/ }));
    fireEvent.click(difficultyRadio("Hard"));
    const none = strings.landing.noneHint("hard");
    expect(screen.getByText(none)).toBeTruthy();
    expect(startButton().getAttribute("aria-disabled")).toBe("true");
    expect(description()).toBe(none);
    fireEvent.click(startButton());
    fireEvent.keyDown(startButton(), { key: "Enter" });
    expect(onStart).not.toHaveBeenCalled();
    expect(onReplaceStart).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("group", { name: strings.landing.replaceMessage }),
    ).toBe(null);
    expect(startButton().getAttribute("aria-expanded")).toBe("false");
    // Another difficulty recovers.
    fireEvent.click(difficultyRadio("Easy"));
    expect(startButton().getAttribute("aria-disabled")).toBe(null);
  });

  it("the loading reserve contains both groups, disabled, with the defaults checked", () => {
    renderLanding({
      bank: { status: "loading", attempt: 0, userRetry: false },
      settings: { difficulty: "hard", length: 5 },
    });
    const reserve = document.querySelector('[aria-hidden="true"]');
    const legends = [...(reserve?.querySelectorAll("legend") ?? [])].map(
      (legend) => legend.textContent,
    );
    expect(legends).toEqual([
      strings.landing.topicsLegend,
      strings.landing.difficultyLegend,
      strings.landing.lengthLegend,
    ]);
    const settingsInputs = [
      ...(reserve?.querySelectorAll<HTMLInputElement>(
        "input:not([aria-label])",
      ) ?? []),
    ];
    expect(settingsInputs).toHaveLength(7);
    expect(settingsInputs.every((input) => input.matches(":disabled"))).toBe(
      true,
    );
    expect(
      settingsInputs
        .filter((input) => input.checked)
        .map((input) => input.closest("label")?.textContent),
    ).toEqual(["All", "10"]);
  });
});
