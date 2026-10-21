/**
 * Question view (T-12, issue #32; US-1.3, US-1.4, US-2; views.md §2) and
 * feedback (T-13, issue #33; US-3; views.md §3).
 * Fixture bank: topic-a 12, topic-b 5, topic-c 3 (code snippet, XSS payload,
 * true/false), topic-d 0. Question order is random per run (randomSeed), so
 * tests read `data-question-id` instead of assuming an order (standard 12).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { REPORT_BASE_URL } from "../../src/ui/report/reportLink.ts";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import { expectNoCspViolations, trackCspViolations } from "./helpers/csp.ts";
import { FIXTURES_DIR, useFixtureBank } from "./helpers/fixture-bank.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";
import { goOfflineAfterLoad, trackRequests } from "./helpers/network.ts";

interface FixtureBank {
  contentVersion: string;
  topics: { id: string; name: string }[];
  questions: { id: string; topic: string; sourceUrl: string }[];
}
const FIXTURE = JSON.parse(
  readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8"),
) as FixtureBank;
const TOPIC_OF = new Map(FIXTURE.questions.map((q) => [q.id, q.topic]));
const TOPIC_NAME = new Map(FIXTURE.topics.map((t) => [t.id, t.name]));
const CODE_ID = "fixture-c-code-snippet";
const XSS_ID = "fixture-c-xss-payload";
const TRUE_FALSE_ID = "fixture-c-true-false";

const view = (page: Page) => page.locator("[data-question-id]");
const h1 = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });
const options = (page: Page) =>
  page.getByRole("group", { name: strings.question.optionsLegend });
const submit = (page: Page) =>
  page.getByRole("button", { name: strings.question.submit });
const next = (page: Page) =>
  page.getByRole("button", {
    name: new RegExp(
      `^(${strings.feedback.next}|${strings.feedback.seeResults})$`,
    ),
  });
const exit = (page: Page) =>
  page.getByRole("button", { name: strings.question.exit });

async function startQuiz(page: Page, topic: RegExp, n: number): Promise<void> {
  await page.goto("./");
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    "ready",
  );
  await page.getByRole("radio", { name: topic }).check();
  await page.getByRole("button", { name: strings.landing.start }).click();
  await expect(h1(page, strings.question.heading(1, n))).toBeFocused();
}

async function answerAndNext(page: Page): Promise<void> {
  await options(page).getByRole("radio").first().check();
  await submit(page).click();
  await next(page).click();
}

/** Answers every question, checking progress, focus and topic; returns IDs. */
async function walkQuiz(page: Page, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let k = 1; k <= n; k += 1) {
    await expect(h1(page, strings.question.heading(k, n))).toBeFocused();
    const id = (await view(page).getAttribute("data-question-id")) ?? "";
    ids.push(id);
    const topicName = TOPIC_NAME.get(TOPIC_OF.get(id) ?? "") ?? "(unknown)";
    await expect(view(page)).toContainText(strings.question.topic(topicName));
    await answerAndNext(page);
  }
  await expect(h1(page, strings.placeholder.resultsHeading)).toBeFocused();
  return ids;
}

/** Starts a topic-c quiz and advances until question `id` is shown. */
async function openTopicCQuestion(page: Page, id: string): Promise<void> {
  await startQuiz(page, /^Fixture topic C/, 3);
  for (let k = 1; k <= 3; k += 1) {
    await expect(h1(page, strings.question.heading(k, 3))).toBeVisible();
    if ((await view(page).getAttribute("data-question-id")) === id) return;
    await answerAndNext(page);
  }
  throw new Error(`question ${id} not found in the topic-c quiz`);
}

test.describe("T-12 Question view", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US1-3 T-US2-1 T-EC-US2-c topic quiz: 1 of 10, title, topic line, only topic-a questions", async ({
    page,
  }) => {
    await startQuiz(page, /^Fixture topic A/, 10);
    await expect(page).toHaveTitle(
      strings.title.question(1, 10, "Fixture topic A"),
    );
    // On the quiz route the brand is plain text and Exit is explicit.
    await expect(page.getByRole("banner").getByRole("link")).toHaveCount(0);
    await expect(exit(page)).toBeVisible();
    const ids = await walkQuiz(page, 10);
    expect(new Set(ids).size).toBe(10);
    expect(ids.map((id) => TOPIC_OF.get(id))).toEqual(
      Array<string>(10).fill("topic-a"),
    );
  });

  test("T-US1-3 topic with fewer than 10 questions: 1 of 5, only topic-b questions", async ({
    page,
  }) => {
    await startQuiz(page, /^Fixture topic B/, 5);
    const ids = await walkQuiz(page, 5);
    expect(new Set(ids).size).toBe(5);
    expect(new Set(ids.map((id) => TOPIC_OF.get(id)))).toEqual(
      new Set(["topic-b"]),
    );
  });

  test("T-US1-4 Mixed quiz: 10 distinct questions from at least 3 topics", async ({
    page,
  }) => {
    await startQuiz(page, /^Mixed/, 10);
    await expect(page).toHaveTitle(
      strings.title.question(1, 10, strings.landing.mixedLabel),
    );
    const ids = await walkQuiz(page, 10);
    expect(new Set(ids).size).toBe(10);
    const topics = new Set(ids.map((id) => TOPIC_OF.get(id)));
    expect(topics.has(undefined)).toBe(false);
    expect(topics.size).toBeGreaterThanOrEqual(3);
  });

  test("T-US2-3 T-US2-4 T-US2-9 Submit unavailable with hint, answer locked, axe in each state, no horizontal scroll", async ({
    page,
  }) => {
    await startQuiz(page, /^Fixture topic A/, 10);
    await expect(submit(page)).toHaveAttribute("aria-disabled", "true");
    await expect(submit(page)).toHaveAccessibleDescription(
      strings.question.submitHint,
    );
    // Playwright's click refuses aria-disabled elements: use the keyboard.
    await submit(page).focus();
    await page.keyboard.press("Enter");
    await expect(next(page)).toHaveCount(0);
    await expectNoAxeSeriousOrCritical(page, submit(page));
    await expectNoHorizontalScroll(page);

    const radios = options(page).getByRole("radio");
    await radios.nth(1).check();
    await expect(submit(page)).not.toHaveAttribute("aria-disabled");
    await expect(page.getByText(strings.question.submitHint)).toHaveCount(0);
    await expectNoAxeSeriousOrCritical(page, radios.nth(1));

    await submit(page).click();
    await expect(next(page)).toBeFocused();
    await expect(submit(page)).toHaveCount(0);
    for (const radio of await radios.all()) await expect(radio).toBeDisabled();
    await radios.nth(0).click({ force: true });
    await expect(radios.nth(1)).toBeChecked();
    await expect(radios.nth(0)).not.toBeChecked();
    await expectNoAxeSeriousOrCritical(page, next(page));
    await expectNoHorizontalScroll(page);
  });

  test("T-US2-5 double Submit then a fast double Next records 1 answer and advances exactly 1", async ({
    page,
  }) => {
    await startQuiz(page, /^Fixture topic A/, 10);
    await options(page).getByRole("radio").first().check();
    await submit(page).dblclick();
    await expect(next(page)).toBeFocused();
    await expect(h1(page, strings.question.heading(1, 10))).toBeVisible();
    await next(page).dblclick();
    // The second click lands on whatever question 2 shows under the pointer
    // (its Submit or an option row), so focus is not asserted here; the
    // criterion is progress: exactly 1 step and question 2 still unanswered.
    await expect(h1(page, strings.question.heading(2, 10))).toBeVisible();
    await expect(submit(page)).toBeVisible();
    await expect(next(page)).toHaveCount(0);
    await expect(h1(page, strings.question.heading(3, 10))).toHaveCount(0);
  });

  test("T-US2-9 keyboard only: arrows select, Enter submits, Next focuses the new h1; Exit is before the h1", async ({
    page,
  }) => {
    await startQuiz(page, /^Fixture topic A/, 10);
    const radios = options(page).getByRole("radio");
    await page.keyboard.press("Tab");
    await expect(radios.nth(0)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(radios.nth(1)).toBeChecked();
    await page.keyboard.press("ArrowUp");
    await expect(radios.nth(0)).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(submit(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(next(page)).toBeFocused();
    await page.keyboard.press("Enter");
    const heading = h1(page, strings.question.heading(2, 10));
    await expect(heading).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(exit(page)).toBeFocused();
  });

  test("T-US2-6 code box scrolls inside itself at 320 px, is reachable by Tab, no page horizontal scroll, axe", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openTopicCQuestion(page, CODE_ID);
    const box = page.getByRole("region", {
      name: strings.question.codeLabel(1, 1),
    });
    const metrics = await box.evaluate((el) => ({
      tag: el.tagName,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      font: getComputedStyle(el).fontFamily,
    }));
    expect(metrics.tag).toBe("PRE");
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.font).toMatch(/mono/i);
    await page.getByRole("heading", { level: 1 }).focus();
    await page.keyboard.press("Tab");
    await expect(box).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(() => box.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    await expectNoHorizontalScroll(page);
    await expectNoAxeSeriousOrCritical(page, box);
  });

  test("T-US2-7 script, img onerror and javascript: payloads render as literal text: no dialog, no CSP violation, no probe request", async ({
    page,
    context,
  }) => {
    const csp = await trackCspViolations(page);
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    const requests = trackRequests(context);
    await openTopicCQuestion(page, XSS_ID);
    await expect(view(page)).toContainText(
      "<script>alert('xss-prompt')</script>",
    );
    await expect(view(page)).toContainText(
      "[click](javascript:alert('xss-link'))",
    );
    await expect(view(page)).toContainText(
      `<img src="xss-probe-prompt.png" onerror="alert('xss-img')">`,
    );
    for (const name of [
      "<script>alert('xss-option-script')</script>",
      "javascript:alert('xss-option-link')",
    ]) {
      await expect(options(page).getByRole("radio", { name })).toBeVisible();
    }
    const payloadOption = options(page).getByRole("radio", {
      name: `<img src="xss-probe-option.png" onerror="alert('xss-option')">`,
    });
    await expect(payloadOption).toBeVisible();
    await expect(
      page.locator(
        "main script, main img, main iframe, a[href^='javascript:']",
      ),
    ).toHaveCount(0);
    await payloadOption.check();
    await submit(page).click();
    await expect(next(page)).toBeFocused();
    // The explanation payload (T-13) is literal text as well.
    const panel = page.getByRole("region", { name: strings.feedback.correct });
    await expect(panel).toContainText(
      "<script>alert('xss-explanation')</script>",
    );
    await expect(panel).toContainText(
      `<img src="xss-probe-explanation.png" onerror="alert(1)">`,
    );
    await expect(
      page.locator(
        "main script, main img, main iframe, a[href^='javascript:']",
      ),
    ).toHaveCount(0);
    for (const href of await page
      .locator("main a")
      .evaluateAll((links) => links.map((a) => a.getAttribute("href") ?? ""))) {
      expect(href).toMatch(/^https:\/\//);
    }
    await expectNoCspViolations(page, csp);
    expect(dialogs, "dialogs opened").toEqual([]);
    expect(errors, "console errors and page errors").toEqual([]);
    expect(requests.urls.filter((url) => url.includes("xss-probe"))).toEqual(
      [],
    );
  });

  test("T-EC-US2-a a long option wraps at 320 px: no page horizontal scroll, last radio reachable by keyboard", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openTopicCQuestion(page, CODE_ID);
    const longOption = options(page).getByRole("radio", {
      name: /^PUT, a deliberately long option/,
    });
    await expect(longOption).toBeVisible();
    await expectNoHorizontalScroll(page);
    // h1 -> code box -> radio group (one tab stop); ArrowDown steps to the
    // last radio. WebKit does not wrap at the ends, so no ArrowUp wrap.
    const radios = options(page).getByRole("radio");
    await page.getByRole("heading", { level: 1 }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(radios.first()).toBeFocused();
    const count = await radios.count();
    for (let i = 1; i < count; i += 1) {
      await page.keyboard.press("ArrowDown");
    }
    await expect(radios.last()).toBeFocused();
    await expect(radios.last()).toBeChecked();
    await expect(radios.last()).toBeInViewport();
    await expectNoHorizontalScroll(page);
  });

  test("T-EC-US2-b rotation from 375x812 to 812x375 after selecting keeps the selection and the question", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await startQuiz(page, /^Fixture topic A/, 10);
    const id = await view(page).getAttribute("data-question-id");
    const radio = options(page).getByRole("radio").nth(1);
    await radio.check();
    await page.setViewportSize({ width: 812, height: 375 });
    await expect(radio).toBeChecked();
    await expect(view(page)).toHaveAttribute("data-question-id", id ?? "");
    await expect(h1(page, strings.question.heading(1, 10))).toBeVisible();
    await expect(submit(page)).not.toHaveAttribute("aria-disabled");
    await expectNoHorizontalScroll(page);
  });

  test("T-US2-2 true/false options are shown as True, False", async ({
    page,
  }) => {
    await openTopicCQuestion(page, TRUE_FALSE_ID);
    const names = await options(page)
      .getByRole("radio")
      .evaluateAll((radios) =>
        radios.map((r) => r.closest("label")?.textContent ?? ""),
      );
    expect(names).toEqual(["True", "False"]);
  });

  test("T-US2-8 browser Back mid-quiz returns to Landing with its h1 focused; Forward does not show a stale quiz", async ({
    page,
  }) => {
    await startQuiz(page, /^Fixture topic A/, 10);
    await answerAndNext(page);
    await expect(h1(page, strings.question.heading(2, 10))).toBeFocused();
    await page.goBack();
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(page).toHaveTitle(strings.title.landing);
    await expect(view(page)).toHaveCount(0);
    await page.goForward();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(view(page)).toHaveCount(0);
  });

  test("T-US2-8 Exit quiz returns to Landing with its h1 focused and clears the quiz", async ({
    page,
  }) => {
    await startQuiz(page, /^Mixed/, 10);
    await options(page).getByRole("radio").first().check();
    await exit(page).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(exit(page)).toHaveCount(0);
    // Back lands on #/quiz, which has no quiz any more: replaced by Landing.
    await page.goBack();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(view(page)).toHaveCount(0);
  });

  test("T-NFR7-1 answering questions after going offline makes 0 requests", async ({
    page,
    context,
  }) => {
    await startQuiz(page, /^Fixture topic B/, 5);
    await goOfflineAfterLoad(page, context, async (p) => {
      await answerAndNext(p);
      await answerAndNext(p);
    });
    await expect(h1(page, strings.question.heading(3, 5))).toBeFocused();
  });
});

const cue = strings.common.newTabCue;
const status = (page: Page) => page.getByRole("status");
const optionRow = (page: Page, name: string) =>
  options(page).getByRole("radio", { name, exact: true });

/** Opens the code-snippet question (correct: GET) and submits `choice`. */
async function submitCodeQuestion(page: Page, choice: string): Promise<void> {
  await openTopicCQuestion(page, CODE_ID);
  await expect(status(page)).toHaveText("");
  await optionRow(page, choice).check();
  await submit(page).click();
}

async function borderStyle(page: Page, name: string): Promise<string> {
  return optionRow(page, name).evaluate(
    (radio) => getComputedStyle(radio.closest("label") ?? radio).borderTopStyle,
  );
}

test.describe("T-13 Feedback", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US3-1 T-US3-3 correct answer: Correct verdict, both tags on the row, live region, focus to Next, axe", async ({
    page,
  }) => {
    await submitCodeQuestion(page, "GET");
    await expect(status(page)).toHaveText(strings.feedback.liveCorrect("GET"));
    await expect(next(page)).toBeFocused();
    await expect(next(page)).toBeInViewport();
    const panel = page.getByRole("region", { name: strings.feedback.correct });
    await expect(
      panel.getByRole("heading", { level: 2, name: strings.feedback.correct }),
    ).toBeVisible();
    await expect(panel).not.toContainText("Correct answer:");
    const both = `GET ${strings.feedback.tagCorrect} ${strings.feedback.tagChosen}`;
    await expect(optionRow(page, both)).toBeChecked();
    expect(await borderStyle(page, both)).toBe("solid");
    await expectNoAxeSeriousOrCritical(page, next(page));
    await expectNoHorizontalScroll(page);
  });

  test("T-US3-1 T-US3-3 incorrect answer: Incorrect verdict, correct answer, tags and border styles, live region, focus to Next, axe", async ({
    page,
  }) => {
    await submitCodeQuestion(page, "POST");
    await expect(status(page)).toHaveText(
      strings.feedback.liveIncorrect("GET"),
    );
    await expect(next(page)).toBeFocused();
    await expect(next(page)).toBeInViewport();
    const panel = page.getByRole("region", {
      name: strings.feedback.incorrect,
    });
    await expect(panel).toContainText(strings.feedback.correctAnswer("GET"));
    await expect(
      panel.getByRole("heading", {
        level: 3,
        name: strings.feedback.explanationHeading,
      }),
    ).toBeVisible();
    await expect(panel).toContainText("Fixture explanation:");
    // Not colour alone: text tags, plus solid vs dashed borders.
    const correctName = `GET ${strings.feedback.tagCorrect}`;
    const chosenName = `POST ${strings.feedback.tagChosen}`;
    await expect(optionRow(page, chosenName)).toBeChecked();
    expect(await borderStyle(page, correctName)).toBe("solid");
    expect(await borderStyle(page, chosenName)).toBe("dashed");
    await expectNoAxeSeriousOrCritical(page, next(page));
    await expectNoHorizontalScroll(page);

    // Next clears the live region.
    await next(page).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    // Cleared on Next (or gone, when Next was See results).
    await expect(page.locator("main [role='status']:not(:empty)")).toHaveCount(
      0,
    );
  });

  test("T-US3-2 T-US3-5 source and report links: https, new tab, cue in the name, report carries only id and contentVersion", async ({
    page,
  }) => {
    await submitCodeQuestion(page, "GET");
    const sourceUrl =
      FIXTURE.questions.find((q) => q.id === CODE_ID)?.sourceUrl ?? "";
    const source = page.getByRole("link", {
      name: `${new URL(sourceUrl).hostname} ${cue}`,
      exact: true,
    });
    await expect(source).toHaveAttribute("href", sourceUrl);
    await expect(source).toHaveAttribute("target", "_blank");
    await expect(source).toHaveAttribute("rel", "noopener noreferrer");
    await expect(source).toContainText(cue);

    const report = page.getByRole("link", {
      name: `${strings.feedback.report} ${cue}`,
      exact: true,
    });
    await expect(report).toHaveAttribute("target", "_blank");
    await expect(report).toHaveAttribute("rel", "noopener noreferrer");
    const url = new URL((await report.getAttribute("href")) ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(REPORT_BASE_URL);
    expect([...url.searchParams.entries()]).toEqual([
      ["template", "question-report.yml"],
      ["title", `[Question] ${CODE_ID}`],
      ["question-id", CODE_ID],
      ["content-version", FIXTURE.contentVersion],
    ]);
  });
});

test.describe("T-US13-1 Question view in the dark colour scheme", () => {
  test.use({ colorScheme: "dark" });

  test("T-US13-1 unselected, selected and feedback states pass axe in dark mode", async ({
    page,
  }) => {
    await useFixtureBank(page);
    await startQuiz(page, /^Fixture topic A/, 10);
    await expectNoAxeSeriousOrCritical(page, submit(page));
    await options(page).getByRole("radio").first().check();
    await expectNoAxeSeriousOrCritical(page, submit(page));
    await submit(page).click();
    await expectNoAxeSeriousOrCritical(page, next(page));
  });
});
