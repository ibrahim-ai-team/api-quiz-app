/**
 * Results view (T-15, issue #35; US-4; views.md §4) and its routes.
 * Fixture bank: topic-a 12, topic-b 5, topic-c 3, topic-d 0. Question order
 * is random per run, so the answers are chosen from the fixture's `correct`
 * IDs by `data-question-id` (standard 12), never by position.
 * Only clicks and `check()` are used: no browser-specific keyboard behaviour.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import { FIXTURES_DIR, useFixtureBank } from "./helpers/fixture-bank.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";

interface FixtureBank {
  topics: { id: string; name: string }[];
  questions: {
    id: string;
    topic: string;
    correct: string;
    options: { id: string }[];
  }[];
}
const FIXTURE = JSON.parse(
  readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8"),
) as FixtureBank;
const QUESTION = new Map(FIXTURE.questions.map((q) => [q.id, q]));
const TOPIC_NAME = new Map(FIXTURE.topics.map((t) => [t.id, t.name]));

const h1 = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });
const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const breakdownHeading = (page: Page) =>
  page.getByRole("heading", {
    level: 2,
    name: strings.results.breakdownHeading,
  });

async function startQuiz(page: Page, topic: RegExp, n: number): Promise<void> {
  await page.goto("./");
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    "ready",
  );
  await page.getByRole("radio", { name: topic }).check();
  await button(page, strings.landing.start).click();
  await expect(h1(page, strings.question.heading(1, n))).toBeFocused();
}

interface Played {
  readonly id: string;
  readonly topic: string;
  readonly correct: boolean;
}

/**
 * Answers all `n` questions; question k (1-based) is answered correctly when
 * `correctAt(k)` is true. Ends on the results view.
 */
async function playQuiz(
  page: Page,
  n: number,
  correctAt: (k: number) => boolean,
): Promise<Played[]> {
  const played: Played[] = [];
  for (let k = 1; k <= n; k += 1) {
    await expect(h1(page, strings.question.heading(k, n))).toBeFocused();
    const id =
      (await page
        .locator("[data-question-id]")
        .getAttribute("data-question-id")) ?? "";
    const q = QUESTION.get(id);
    if (q === undefined) throw new Error(`unknown question ${id}`);
    const correct = correctAt(k);
    const optionId = correct
      ? q.correct
      : (q.options.find((o) => o.id !== q.correct)?.id ?? "");
    await page.locator(`input[type="radio"][value="${optionId}"]`).check();
    await button(page, strings.question.submit).click();
    await button(
      page,
      k === n ? strings.feedback.seeResults : strings.feedback.next,
    ).click();
    played.push({ id, topic: q.topic, correct });
  }
  await expect(h1(page, strings.results.heading)).toBeFocused();
  await expect(page).toHaveURL(/#\/results$/);
  return played;
}

/** Plays a topic-b quiz (N = 5) with questions 1-3 correct: 3 / 5, 60%. */
async function playTopicB(page: Page): Promise<void> {
  await startQuiz(page, /^Fixture topic B/, 5);
  await playQuiz(page, 5, (k) => k <= 3);
}

/** Plays a Mixed quiz (N = 10) with question 1 wrong: 9 / 10, 90%. */
async function playMixed(page: Page): Promise<Played[]> {
  await startQuiz(page, /^Mixed/, 10);
  return playQuiz(page, 10, (k) => k !== 1);
}

/** Expected breakdown rows in curated topic order. */
function expectedBreakdown(played: readonly Played[]): string[] {
  return FIXTURE.topics.flatMap((topic) => {
    const inTopic = played.filter((p) => p.topic === topic.id);
    if (inTopic.length === 0) return [];
    const x = inTopic.filter((p) => p.correct).length;
    return [strings.results.breakdownItem(topic.name, x, inTopic.length)];
  });
}

test.describe("T-15 Results view", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US4-1 T-US4-2 T-US4-3 T-US4-5 topic quiz: X / N, percentage, band, scope, title, no breakdown, no Exit", async ({
    page,
  }) => {
    await playTopicB(page);
    const main = page.locator("main");
    await expect(main).toContainText(TOPIC_NAME.get("topic-b") ?? "");
    await expect(
      main.locator("p", { hasText: strings.results.score(3, 5) }),
    ).toContainText(strings.results.percent(60));
    await expect(main).toContainText(strings.results.band.mid);
    await expect(page).toHaveTitle(
      strings.title.results(TOPIC_NAME.get("topic-b") ?? ""),
    );
    await expect(breakdownHeading(page)).toHaveCount(0);
    await expect(main.getByRole("list")).toHaveCount(0);
    // T-12-R01 N5: Exit is not shown on results; the brand is a link again.
    await expect(button(page, strings.question.exit)).toHaveCount(0);
    await expect(
      page.getByRole("banner").getByRole("link", { name: strings.appName }),
    ).toBeVisible();
  });

  test("T-US4-3 Mixed quiz: per-topic breakdown in curated order", async ({
    page,
  }) => {
    const played = await playMixed(page);
    const main = page.locator("main");
    await expect(main).toContainText(strings.landing.mixedLabel);
    await expect(main).toContainText(strings.results.score(9, 10));
    await expect(main).toContainText(strings.results.percent(90));
    await expect(main).toContainText(strings.results.band.high);
    await expect(breakdownHeading(page)).toBeVisible();
    const rows = expectedBreakdown(played);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    await expect(main.getByRole("listitem")).toHaveText(rows);
  });

  test("T-US4-4 Try again: a fresh quiz for the same scope at Question 1 of N, session reset; Back goes to Landing", async ({
    page,
  }) => {
    await playTopicB(page);
    await button(page, strings.results.tryAgain).click();
    await expect(h1(page, strings.question.heading(1, 5))).toBeFocused();
    await expect(page).toHaveURL(/#\/quiz$/);
    // Reset: no answer selected, Submit unavailable, same topic, Exit back.
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await expect(button(page, strings.question.submit)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    const id = await page
      .locator("[data-question-id]")
      .getAttribute("data-question-id");
    expect(QUESTION.get(id ?? "")?.topic).toBe("topic-b");
    await expect(button(page, strings.question.exit)).toBeVisible();
    // Try again replaced the results entry, so Back leaves for Landing.
    await page.goBack();
    await expect(h1(page, strings.landing.heading)).toBeFocused();
  });

  test("T-US4-4 Choose another topic returns to Landing with its h1 focused; Back does not show stale results", async ({
    page,
  }) => {
    await playTopicB(page);
    await button(page, strings.results.chooseAnother).click();
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page).toHaveTitle(strings.title.landing);
    await page.goBack();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
  });

  test("T-US4-5 browser Back from results goes to Landing and clears the session; Forward redirects home", async ({
    page,
  }) => {
    await playTopicB(page);
    await page.goBack();
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    // The entry before the quiz: Landing as first loaded ("./", no hash).
    await expect(page).toHaveURL(/\/api-quiz-app\/(#\/)?$/);
    await page.goForward();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
  });

  test("T-US4-5 refreshing #/results redirects to Landing with its h1 focused", async ({
    page,
  }) => {
    await playTopicB(page);
    await page.reload();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await page.goto("./#/results");
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
  });

  test("T-US9-1 T-US10-1 results with breakdown at 320 px: no page horizontal scroll, axe", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await playMixed(page);
    await expectNoHorizontalScroll(page);
    await expectNoAxeSeriousOrCritical(page, breakdownHeading(page));
  });
});

test.describe("T-15 Results view in dark mode", () => {
  test.use({ colorScheme: "dark" });

  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US13-1 topic and Mixed results pass axe in dark mode", async ({
    page,
  }) => {
    await playTopicB(page);
    await expectNoAxeSeriousOrCritical(page, h1(page, strings.results.heading));
    await playMixed(page);
    await expectNoAxeSeriousOrCritical(page, breakdownHeading(page));
  });
});
