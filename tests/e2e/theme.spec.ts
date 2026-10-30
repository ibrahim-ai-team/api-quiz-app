/**
 * Theme switch mid-quiz keeps state (T-US13-2, issue #18; US-13.2).
 *
 * The OS colour scheme is switched with `page.emulateMedia({ colorScheme })`
 * while the app is open, light → dark → light and dark → light → dark, on
 * three states: the question view with an answer selected but not submitted,
 * the feedback view, and Results with Review expanded. After every switch the
 * test checks that the body background actually changed (computed style, so a
 * switch that styles nothing cannot pass) and that the quiz state did not:
 * selection, question ID and number, URL, feedback panel, focus on Next,
 * Review expanded, and the final score.
 *
 * Fixture bank: topic-b has 5 questions. Questions 1 to 3 are answered
 * correctly and 4 and 5 wrongly, so every test ends on 3 / 5 (60%). Answers
 * are chosen by `data-question-id` (standard 12), never by position.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { useFixtureBank } from "./helpers/fixture-bank.ts";
import {
  answerByMouse,
  button,
  currentQuestion,
  h1,
  nextButton,
  openLanding,
  optionIdFor,
  optionsGroup,
  playQuizByMouse,
  radioByValue,
  startQuizByMouse,
  verdictPanel,
} from "./helpers/quiz.ts";

type Scheme = "light" | "dark";

const N = 5;
const correctAt = (k: number): boolean => k <= 3;

/** `--color-bg` per theme (tokens.css), as computed by the browser. */
const BODY_BG: Record<Scheme, string> = {
  light: "rgb(255, 255, 255)",
  dark: "rgb(17, 24, 39)",
};

const other = (s: Scheme): Scheme => (s === "light" ? "dark" : "light");

const bodyBackground = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/**
 * Switches the emulated OS scheme and waits until the media query and the
 * body background both reflect it.
 */
async function switchTheme(page: Page, scheme: Scheme): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-color-scheme: dark)").matches,
    ),
    `prefers-color-scheme is ${scheme}`,
  ).toBe(scheme === "dark");
  await expect
    .poll(() => bodyBackground(page), {
      message: `body background (${scheme})`,
    })
    .toBe(BODY_BG[scheme]);
}

/**
 * Runs `start → other → start`, calling `check` after each of the two
 * switches. The body background must differ before and after each switch.
 */
async function switchThereAndBack(
  page: Page,
  start: Scheme,
  check: () => Promise<void>,
): Promise<void> {
  for (const scheme of [other(start), start]) {
    const before = await bodyBackground(page);
    await switchTheme(page, scheme);
    expect(await bodyBackground(page), "body background changed").not.toBe(
      before,
    );
    await check();
  }
}

/** Plays questions `from`..N with the mouse and ends on Results. */
async function finishQuiz(page: Page, from: number): Promise<void> {
  for (let k = from; k <= N; k += 1) {
    await expect(h1(page, strings.question.heading(k, N))).toBeFocused();
    await answerByMouse(page, correctAt(k));
    await nextButton(page).click();
  }
  await expect(h1(page, strings.results.heading)).toBeFocused();
  await expect(page).toHaveURL(/#\/results$/);
}

async function expectScore3of5(page: Page): Promise<void> {
  await expect(
    page.locator("main p", { hasText: strings.results.score(3, N) }),
  ).toContainText(strings.results.percent(60));
}

const checkedRadios = (page: Page): Locator =>
  optionsGroup(page).locator('input[type="radio"]:checked');

for (const start of ["light", "dark"] as const) {
  const order = `${start} → ${other(start)} → ${start}`;

  test.describe(`T-US13-2 theme switch mid-quiz keeps state (${order})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: start });
      await useFixtureBank(page);
      await openLanding(page);
      await expect.poll(() => bodyBackground(page)).toBe(BODY_BG[start]);
      await startQuizByMouse(page, /^Fixture topic B/, N);
    });

    test(`T-US13-2 question view with an answer selected, not submitted (${order})`, async ({
      page,
    }) => {
      const q = await currentQuestion(page);
      const chosen = optionIdFor(q, correctAt(1));
      await radioByValue(page, chosen).check();
      await expect(radioByValue(page, chosen)).toBeChecked();
      const url = page.url();

      await switchThereAndBack(page, start, async () => {
        await expect(radioByValue(page, chosen)).toBeChecked();
        await expect(checkedRadios(page)).toHaveCount(1);
        expect((await currentQuestion(page)).id).toBe(q.id);
        await expect(h1(page, strings.question.heading(1, N))).toBeVisible();
        expect(page.url()).toBe(url);
        // Still unsubmitted: no verdict panel.
        await expect(verdictPanel(page, true)).toHaveCount(0);
        await expect(verdictPanel(page, false)).toHaveCount(0);
      });

      await button(page, strings.question.submit).click();
      await expect(verdictPanel(page, correctAt(1))).toBeVisible();
      await expect(nextButton(page)).toBeFocused();
      await nextButton(page).click();
      await finishQuiz(page, 2);
      await expectScore3of5(page);
    });

    test(`T-US13-2 feedback view: panel kept and focus stays on Next (${order})`, async ({
      page,
    }) => {
      const q = await answerByMouse(page, correctAt(1));
      const chosen = optionIdFor(q, correctAt(1));
      const url = page.url();

      await switchThereAndBack(page, start, async () => {
        await expect(verdictPanel(page, correctAt(1))).toBeVisible();
        await expect(nextButton(page)).toBeFocused();
        await expect(nextButton(page)).toHaveText(strings.feedback.next);
        await expect(radioByValue(page, chosen)).toBeChecked();
        await expect(checkedRadios(page)).toHaveCount(1);
        expect((await currentQuestion(page)).id).toBe(q.id);
        await expect(h1(page, strings.question.heading(1, N))).toBeVisible();
        expect(page.url()).toBe(url);
      });

      await nextButton(page).click();
      await finishQuiz(page, 2);
      await expectScore3of5(page);
    });

    test(`T-US13-2 Results with Review expanded: Review stays open, score unchanged (${order})`, async ({
      page,
    }) => {
      await playQuizByMouse(page, N, correctAt);
      await expectScore3of5(page);
      const toggle = button(page, strings.review.toggle);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(toggle).toBeFocused();
      const listId = (await toggle.getAttribute("aria-controls")) ?? "";
      expect(listId, "Review toggle aria-controls").not.toBe("");
      const items = page.locator(`[id="${listId}"] > li`);
      await expect(items).toHaveCount(N);
      const url = page.url();

      await switchThereAndBack(page, start, async () => {
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(toggle).toBeFocused();
        await expect(items).toHaveCount(N);
        await expect(items.first()).toBeVisible();
        await expect(h1(page, strings.results.heading)).toBeVisible();
        await expectScore3of5(page);
        expect(page.url()).toBe(url);
      });
    });
  });
}
