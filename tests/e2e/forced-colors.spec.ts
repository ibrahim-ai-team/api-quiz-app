/**
 * Forced colours regression (T-US13-3, issue #18; US-13, US-10.4).
 *
 * `page.emulateMedia({ forcedColors: "active" })` with the light and the dark
 * OS scheme. On the main states: axe 0 serious/critical, and on the feedback
 * view the correct and the wrong answer rows keep distinguishable border
 * styles (solid vs dashed) and visible text tags, so the meaning never
 * depends on colour alone (US-10.4, WCAG 1.4.1).
 *
 * Chromium only: Playwright implements forced-colors emulation in Chromium;
 * WebKit and Firefox ignore it, so a run there would test nothing.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import {
  answerByMouse,
  button,
  currentQuestion,
  nextButton,
  optionIdFor,
  optionsGroup,
  radioByValue,
  verdictPanel,
} from "./helpers/quiz.ts";
import { STATES, type AppState } from "./helpers/states.ts";

/**
 * `color-contrast` is disabled in forced colours only, because of a confirmed
 * axe false positive: on the primary buttons (`._buttonPrimary_*`, for
 * example Submit and Next) axe reads `-webkit-text-fill-color` and reports
 * #111827 text on #000000, while the computed colour Chromium paints in
 * forced colours is white on black. Contrast itself stays covered by the
 * light and dark axe scans without forced colours (flow.spec.ts T-US10-1 /
 * T-US13-1), where the rule is on. Every other rule still runs here.
 */
const FORCED_COLORS_AXE = { disableRules: ["color-contrast"] } as const;

/** Results with Review expanded (Review rows use solid/dashed borders too). */
const resultsReview: AppState = {
  name: "results-review-expanded",
  reach: async (page) => {
    await STATES.resultsTopic.reach(page);
    const toggle = button(page, strings.review.toggle);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const listId = (await toggle.getAttribute("aria-controls")) ?? "";
    const list = page.locator(`[id="${listId}"]`);
    await expect(list).toBeVisible();
    return list;
  },
};

const MAIN_STATES: readonly AppState[] = [
  STATES.landing,
  STATES.question,
  STATES.feedbackCorrect,
  STATES.feedbackIncorrect,
  STATES.resultsTopic,
  STATES.resultsMixed,
  resultsReview,
];

/** The answer row (`label`) that holds the radio with `optionId`. */
const optionRow = (page: Page, optionId: string): Locator =>
  optionsGroup(page)
    .locator("label")
    .filter({
      // Relative to each label: the radio is inside its own row.
      has: page.locator(`input[type="radio"][value="${optionId}"]`),
    });

const borderStyle = (row: Locator): Promise<string> =>
  row.evaluate((el) => getComputedStyle(el).borderTopStyle);

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`T-US13-3 forced colours (${colorScheme})`, () => {
    test.use({ colorScheme });

    test.beforeEach(async ({ page, browserName }) => {
      test.skip(
        browserName !== "chromium",
        "forced-colors emulation is implemented in Chromium only; WebKit and Firefox ignore it",
      );
      await page.emulateMedia({ forcedColors: "active" });
    });

    for (const state of MAIN_STATES) {
      test(`T-US13-3 T-US10-1 ${state.name} in forced colours (${colorScheme}): 0 serious or critical axe violations`, async ({
        page,
      }) => {
        const ready = await state.reach(page);
        expect(
          await page.evaluate(() => [
            matchMedia("(forced-colors: active)").matches,
            matchMedia("(prefers-color-scheme: dark)").matches,
          ]),
        ).toEqual([true, colorScheme === "dark"]);
        await expectNoAxeSeriousOrCritical(page, ready, FORCED_COLORS_AXE);
      });
    }

    test(`T-US13-3 T-US10-4 wrong answer in forced colours (${colorScheme}): correct row solid, chosen row dashed, both text tags visible`, async ({
      page,
    }) => {
      await STATES.question.reach(page);
      expect(
        await page.evaluate(
          () => matchMedia("(forced-colors: active)").matches,
        ),
      ).toBe(true);
      const q = await answerByMouse(page, false);
      await expect(verdictPanel(page, false)).toBeVisible();
      await expect(nextButton(page)).toBeFocused();

      expect((await currentQuestion(page)).id).toBe(q.id);
      const chosenId = optionIdFor(q, false);
      const correctRow = optionRow(page, q.correct);
      const wrongRow = optionRow(page, chosenId);
      await expect(correctRow).toHaveCount(1);
      await expect(wrongRow).toHaveCount(1);
      await expect(radioByValue(page, chosenId)).toBeChecked();

      expect(await borderStyle(correctRow)).toBe("solid");
      expect(await borderStyle(wrongRow)).toBe("dashed");

      await expect(
        correctRow.getByText(strings.feedback.tagCorrect, { exact: true }),
      ).toBeVisible();
      await expect(
        wrongRow.getByText(strings.feedback.tagChosen, { exact: true }),
      ).toBeVisible();
      // The wrong row carries no "Correct answer" tag and vice versa.
      await expect(
        wrongRow.getByText(strings.feedback.tagCorrect, { exact: true }),
      ).toHaveCount(0);
      await expect(
        correctRow.getByText(strings.feedback.tagChosen, { exact: true }),
      ).toHaveCount(0);
    });

    test(`T-US13-3 T-US10-4 correct answer in forced colours (${colorScheme}): the chosen correct row is solid with both tags visible`, async ({
      page,
    }) => {
      await STATES.question.reach(page);
      const q = await answerByMouse(page, true);
      const row = optionRow(page, q.correct);
      await expect(row).toHaveCount(1);
      expect(await borderStyle(row)).toBe("solid");
      await expect(
        row.getByText(strings.feedback.tagCorrect, { exact: true }),
      ).toBeVisible();
      await expect(
        row.getByText(strings.feedback.tagChosen, { exact: true }),
      ).toBeVisible();
      await expect(
        optionsGroup(page).locator("label").filter({
          hasText: strings.feedback.tagChosen,
        }),
      ).toHaveCount(1);
    });
  });
}
