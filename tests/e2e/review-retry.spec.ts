/**
 * Review answers and Retry missed (T-39, issue #102; US-5.1 to US-5.4;
 * views.md §8, copy.md results.retry* / review.*). Covers the feature
 * delivered by T-38 (PR #115) end to end on the production preview.
 *
 * Fixture bank: topic-a 12, topic-b 5, topic-c 3, topic-d 0. Question order
 * is random per run, so answers are chosen from the fixture's `correct` IDs
 * by `data-question-id` (standard 12), never by position. The exact option
 * shuffle of a retry is asserted in unit tests only (standard 12); here the
 * retry is checked to offer the same option set.
 * Only clicks and `check()` drive the quiz; the keyboard test uses Enter and
 * Space on a focused button, which behave the same in every engine.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import { useFixtureBank } from "./helpers/fixture-bank.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";
import {
  FIXTURE,
  TOPIC_NAME,
  answerByMouse,
  breakdownHeading,
  button,
  currentQuestion,
  h1,
  nextButton,
  openLanding,
  optionsGroup,
  playQuizByMouse,
  startQuizByMouse,
  type FixtureQuestion,
} from "./helpers/quiz.ts";

const TOPIC_B = TOPIC_NAME.get("topic-b") ?? "";
const TOPIC_C = TOPIC_NAME.get("topic-c") ?? "";

/**
 * Fixture prompt and explanation text (plain text in the fixture), for the
 * Review content checks (US-5.1).
 */
const FIXTURE_TEXT = new Map(
  (
    FIXTURE.questions as unknown as {
      id: string;
      prompt: string;
      explanation: string;
    }[]
  ).map((q) => [q.id, q]),
);

/**
 * Asserts the exact buttons in `main`, in order. Used where no Retry button
 * may exist: unlike a count of a pattern, it also fails if the button comes
 * back under changed copy (T-39-TL01 note 1).
 */
async function expectMainButtons(
  page: Page,
  names: readonly string[],
): Promise<void> {
  await expect(page.locator("main button")).toHaveText([...names]);
}
/** Retry results with 0 missed (US-5.3 on a retry, views.md §8.4). */
const RETRY_RESULTS_NO_RETRY = [
  strings.review.toggle,
  strings.results.startFull,
  strings.results.chooseAnother,
] as const;
const reviewToggle = (page: Page): Locator =>
  button(page, strings.review.toggle);

/** The list the Review toggle controls (found through `aria-controls`). */
async function reviewList(page: Page): Promise<Locator> {
  const id = await reviewToggle(page).getAttribute("aria-controls");
  expect(id, "Review toggle aria-controls").toBeTruthy();
  return page.locator(`[id="${id ?? ""}"]`);
}

/** Expands Review with the mouse; focus stays on the toggle (§8.2). */
async function openReview(page: Page): Promise<Locator> {
  const toggle = reviewToggle(page);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toBeFocused();
  const list = await reviewList(page);
  await expect(list).toBeVisible();
  return list;
}

const optionText = (q: FixtureQuestion, id: string): string =>
  q.options.find((o) => o.id === id)?.text ?? "";
const wrongOptionId = (q: FixtureQuestion): string =>
  q.options.find((o) => o.id !== q.correct)?.id ?? "";

/** Option values currently offered in the question view, sorted. */
async function offeredOptionIds(page: Page): Promise<string[]> {
  const values = await optionsGroup(page)
    .locator('input[type="radio"]')
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
  return values.sort();
}

/**
 * Plays a retry quiz of `n` questions with the mouse; question k (1-based)
 * is answered correctly when `correctAt(k)` is true. Asserts the retry
 * label, the retry title and the option set on every question. Ends on the
 * retry results with their h1 focused. Returns the played questions.
 */
async function playRetryByMouse(
  page: Page,
  n: number,
  scope: string,
  correctAt: (k: number) => boolean,
): Promise<FixtureQuestion[]> {
  const played: FixtureQuestion[] = [];
  for (let k = 1; k <= n; k += 1) {
    await expect(h1(page, strings.question.heading(k, n))).toBeFocused();
    await expect(page).toHaveURL(/#\/quiz$/);
    await expect(page.locator("main")).toContainText(
      strings.question.retryLabel,
    );
    await expect(page).toHaveTitle(strings.title.questionRetry(k, n, scope));
    const q = await currentQuestion(page);
    // US-5.2: options may be reshuffled, but the option set is unchanged.
    expect(await offeredOptionIds(page)).toEqual(
      q.options.map((o) => o.id).sort(),
    );
    played.push(await answerByMouse(page, correctAt(k)));
    await expect(nextButton(page)).toHaveText(
      k < n ? strings.feedback.next : strings.feedback.seeResults,
    );
    await nextButton(page).click();
  }
  await expect(h1(page, strings.results.retryHeading)).toBeFocused();
  await expect(page).toHaveURL(/#\/results$/);
  await expect(page).toHaveTitle(strings.title.resultsRetry(scope));
  return played;
}

const ids = (qs: readonly FixtureQuestion[]): string[] => qs.map((q) => q.id);

/** Score paragraph ("X / N" and the percentage share one `<p>`). */
async function expectScore(
  page: Page,
  x: number,
  n: number,
  pct: number,
): Promise<void> {
  await expect(
    page.locator("main p", { hasText: strings.results.score(x, n) }),
  ).toContainText(strings.results.percent(pct));
}

test.describe("T-39 Review answers (US-5.1)", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
    await openLanding(page);
  });

  test("T-US5-1 Review lists every question in quiz order with verdict, your answer, correct answer, explanation and source", async ({
    page,
  }) => {
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    const played = await playQuizByMouse(page, 5, (k) => k <= 3);

    // Collapsed on entry (§8.2): the list is not rendered, h1 keeps focus.
    const toggle = reviewToggle(page);
    await expect(
      page.getByRole("heading", { level: 2, name: strings.review.toggle }),
    ).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("main li[data-question-id]")).toHaveCount(0);

    const list = await openReview(page);
    const items = list.locator(":scope > li");
    await expect(items).toHaveCount(5);
    // All questions, in quiz order (§8.1 R3).
    expect(
      await items.evaluateAll((lis) =>
        lis.map((li) => li.getAttribute("data-question-id")),
      ),
    ).toEqual(ids(played));

    for (const [i, q] of played.entries()) {
      const k = i + 1;
      const correct = k <= 3;
      const item = items.nth(i);
      await expect(item.getByRole("heading", { level: 3 })).toHaveText(
        strings.review.itemHeading(
          k,
          correct ? strings.feedback.correct : strings.feedback.incorrect,
        ),
      );
      await expect(item).toContainText(strings.question.topic(TOPIC_B));
      const chosen = correct ? q.correct : wrongOptionId(q);
      await expect(item).toContainText(
        strings.review.yourAnswer(optionText(q, chosen)),
      );
      await expect(item).toContainText(
        strings.feedback.correctAnswer(optionText(q, q.correct)),
      );
      await expect(
        item.getByRole("heading", {
          level: 4,
          name: strings.feedback.explanationHeading,
        }),
      ).toBeVisible();
      const text = FIXTURE_TEXT.get(q.id);
      expect(text, `fixture text for ${q.id}`).toBeDefined();
      await expect(item).toContainText(text?.prompt ?? "");
      await expect(item).toContainText(text?.explanation ?? "");
      await expect(item).toContainText(strings.feedback.sourcePrefix);
      const source = item.getByRole("link");
      await expect(source).toHaveCount(1);
      // Every topic-b fixture source is https://www.rfc-editor.org/...
      await expect(source).toHaveText(/www\.rfc-editor\.org/);
      await expect(source).toHaveAttribute(
        "href",
        /^https:\/\/www\.rfc-editor\.org\//,
      );
      await expect(source).toHaveAttribute("target", "_blank");
      await expect(source).toHaveAttribute("rel", "noopener noreferrer");
    }

    // Collapse again: the list is removed, focus stays on the toggle.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(page.locator("main li[data-question-id]")).toHaveCount(0);
  });

  test("T-US5-1 Review toggles with Enter and Space and keeps focus on the toggle", async ({
    page,
  }) => {
    await startQuizByMouse(page, /^Fixture topic C/, 3);
    await playQuizByMouse(page, 3, (k) => k === 2);
    const toggle = reviewToggle(page);
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();
    await expect((await reviewList(page)).locator(":scope > li")).toHaveCount(
      3,
    );
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(page.locator("main li[data-question-id]")).toHaveCount(0);
  });
});

test.describe("T-39 Retry missed (US-5.2 to US-5.4)", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
    await openLanding(page);
  });

  test("T-US5-2 Retry 2 missed questions: exactly the missed questions, original order, retry label and title; Back goes to Landing", async ({
    page,
  }) => {
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    const played = await playQuizByMouse(page, 5, (k) => k <= 3);
    const missed = played.slice(3);

    // Order (§8.4): Try again, Retry 2 missed questions, Choose another topic.
    const actions = page.locator("main button").filter({
      hasNotText: strings.review.toggle,
    });
    await expect(actions).toHaveText([
      strings.results.tryAgain,
      strings.results.retryMissed(2),
      strings.results.chooseAnother,
    ]);

    await button(page, strings.results.retryMissed(2)).click();
    const retried = await playRetryByMouse(page, 2, TOPIC_B, () => true);
    expect(ids(retried)).toEqual(ids(missed));

    // Retry results: scope of the original quiz, own score, no breakdown.
    await expect(page.locator("main")).toContainText(TOPIC_B);
    await expectScore(page, 2, 2, 100);
    await expect(breakdownHeading(page)).toHaveCount(0);
    // 0 missed in the retry: no Retry button (US-5.3 on retry results), and
    // "Start a full quiz" replaces Try again.
    await expectMainButtons(page, RETRY_RESULTS_NO_RETRY);
    // Review on the retry results lists only the retried questions.
    const list = await openReview(page);
    await expect(list.locator(":scope > li")).toHaveCount(2);

    // Like Try again, the retry replaced #/results: Back leaves for Landing.
    await page.goBack();
    await expect(h1(page, strings.landing.heading)).toBeFocused();
  });

  test("T-US5-2 Start a full quiz on retry results gives a fresh full quiz of the original scope", async ({
    page,
  }) => {
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, (k) => k !== 2);
    await button(page, strings.results.retryMissed(1)).click();
    await playRetryByMouse(page, 1, TOPIC_B, () => true);
    await button(page, strings.results.startFull).click();
    await expect(h1(page, strings.question.heading(1, 5))).toBeFocused();
    await expect(page).toHaveTitle(strings.title.question(1, 5, TOPIC_B));
    await expect(page.locator("main")).not.toContainText(
      strings.question.retryLabel,
    );
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    expect((await currentQuestion(page)).topic).toBe("topic-b");
  });

  test("T-US5-4 N = 1: Question 1 of 1, See results, 0 / 1 then repeat the retry on its own results until 1 / 1", async ({
    page,
  }) => {
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    const played = await playQuizByMouse(page, 5, (k) => k !== 5);
    const missedId = played[4]?.id;

    await button(page, strings.results.retryMissed(1)).click();
    const first = await playRetryByMouse(page, 1, TOPIC_B, () => false);
    expect(ids(first)).toEqual([missedId]);
    await expectScore(page, 0, 1, 0);
    await expect(page.locator("main")).toContainText(strings.results.band.zero);
    await expect(breakdownHeading(page)).toHaveCount(0);

    // Repeat on its own results (US-5.4).
    await expectMainButtons(page, [
      strings.review.toggle,
      strings.results.startFull,
      strings.results.retryMissed(1),
      strings.results.chooseAnother,
    ]);
    await button(page, strings.results.retryMissed(1)).click();
    const second = await playRetryByMouse(page, 1, TOPIC_B, () => true);
    expect(ids(second)).toEqual([missedId]);
    await expectScore(page, 1, 1, 100);
    await expect(page.locator("main")).toContainText(
      strings.results.band.perfect,
    );
    await expectMainButtons(page, RETRY_RESULTS_NO_RETRY);
  });

  test("T-US5-4 Mixed: Retry 3 missed, then repeat the retry with its own 1 miss", async ({
    page,
  }) => {
    await startQuizByMouse(page, /^Mixed/, 10);
    const wrong = new Set([2, 5, 8]);
    const played = await playQuizByMouse(page, 10, (k) => !wrong.has(k));
    const missed = played.filter((_, i) => wrong.has(i + 1));

    await button(page, strings.results.retryMissed(3)).click();
    const mixed = strings.landing.mixedLabel;
    const first = await playRetryByMouse(page, 3, mixed, (k) => k !== 1);
    expect(ids(first)).toEqual(ids(missed));
    await expect(page.locator("main")).toContainText(mixed);
    await expectScore(page, 2, 3, 67);

    await button(page, strings.results.retryMissed(1)).click();
    const second = await playRetryByMouse(page, 1, mixed, () => true);
    expect(ids(second)).toEqual([missed[0]?.id]);
    await expectScore(page, 1, 1, 100);
    await expectMainButtons(page, RETRY_RESULTS_NO_RETRY);
  });

  test("T-US5-3 0 missed: no Retry missed button and no retry notice", async ({
    page,
  }) => {
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, () => true);
    await expectScore(page, 5, 5, 100);
    await expectMainButtons(page, [
      strings.review.toggle,
      strings.results.tryAgain,
      strings.results.chooseAnother,
    ]);
    // No retry notice either (§8.5 texts, built from the copy).
    const main = page.locator("main");
    await expect(main).not.toContainText(strings.results.retryNone(1));
    await expect(main).not.toContainText(strings.results.retryNone(2));
    await expect(main).not.toContainText(strings.results.retryPartial(1));
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`T-39 Review axe (${colorScheme})`, () => {
    test.use({ colorScheme });

    test.beforeEach(async ({ page }) => {
      await useFixtureBank(page);
      await openLanding(page);
      // The emulated scheme is really applied (as in flow.spec.ts).
      expect(
        await page.evaluate(
          () => matchMedia("(prefers-color-scheme: dark)").matches,
        ),
      ).toBe(colorScheme === "dark");
    });

    test(`T-US10-1 T-US13-1 expanded Review on topic-C results and on the retry results: axe 0 serious/critical (${colorScheme})`, async ({
      page,
    }) => {
      // Topic C: code snippet, XSS payload and true/false; all wrong, so
      // every item shows the dashed "Your answer" box.
      await startQuizByMouse(page, /^Fixture topic C/, 3);
      await playQuizByMouse(page, 3, () => false);
      const list = await openReview(page);
      const last = list.getByRole("heading", {
        level: 3,
        name: strings.review.itemHeading(3, strings.feedback.incorrect),
      });
      await expectNoAxeSeriousOrCritical(page, last);

      await button(page, strings.results.retryMissed(3)).click();
      await playRetryByMouse(page, 3, TOPIC_C, (k) => k === 2);
      const retryList = await openReview(page);
      await expectNoAxeSeriousOrCritical(
        page,
        retryList.getByRole("heading", {
          level: 3,
          name: strings.review.itemHeading(3, strings.feedback.incorrect),
        }),
      );
    });

    test(`T-US10-1 T-US13-1 expanded Review on Mixed results with breakdown: axe 0 serious/critical (${colorScheme})`, async ({
      page,
    }) => {
      await startQuizByMouse(page, /^Mixed/, 10);
      await playQuizByMouse(page, 10, (k) => k % 3 !== 0);
      await expect(breakdownHeading(page)).toBeVisible();
      const list = await openReview(page);
      await expect(list.locator(":scope > li")).toHaveCount(10);
      await expectNoAxeSeriousOrCritical(
        page,
        list.getByRole("heading", {
          level: 3,
          name: strings.review.itemHeading(10, strings.feedback.correct),
        }),
      );
    });
  });
}

test.describe("T-39 Review reflow", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US9-1 expanded Review at 320 px (code box, long option): no page horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic C/, 3);
    await playQuizByMouse(page, 3, () => false);
    await openReview(page);
    await expectNoHorizontalScroll(page);
  });
});
