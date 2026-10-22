/**
 * Responsive suite (T-16, issue #36; US-9.1 to US-9.5, SC-3, NFR-3).
 *
 * - The per-state sweep runs in every project, so the PR set covers Chromium
 *   at 320x800, 375x812, 768x1024, 1280x800, 1920x1080 and 640x360, plus the
 *   WebKit iPhone project (the viewport comes from the project).
 * - Tests that set their own viewport (rotation, 400% reflow, 640x360 focus)
 *   would repeat identical work in each Chromium width project, so they run
 *   once per engine: see `ownViewportProjects`. This is scoping, not a skip of
 *   a failing check.
 *
 * No fixed sleeps: every wait is on focus, text, URL or `data-bank-status`.
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { useFixtureBank } from "./helpers/fixture-bank.ts";
import {
  expectFocusNotObscured,
  expectVisibleFocusIndicator,
  focusInfo,
  stickyOrFixedElements,
  tabUntil,
} from "./helpers/focus.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";
import {
  CODE_QUESTION_ID,
  answerByMouse,
  button,
  currentQuestion,
  h1,
  nextButton,
  openLanding,
  openTopicCQuestion,
  optionIdFor,
  optionsGroup,
  questionView,
  radioByValue,
  startQuizByMouse,
} from "./helpers/quiz.ts";
import {
  applyTextResizeAndSpacing,
  expectNoClippingOrOverlap,
  expectTargetsAtLeast,
  expectTextResizeAndSpacingApplied,
} from "./helpers/reflow.ts";
import { ALL_STATES } from "./helpers/states.ts";

/** One project per engine for tests that set their own viewport. */
const OWN_VIEWPORT_PROJECTS = new Set([
  "chromium-1280",
  "firefox-1280",
  "webkit-iphone",
]);
function ownViewportProjects(testInfo: TestInfo): void {
  // Guard (T-16-R01 L1): if the projects are renamed in playwright.config.ts,
  // these tests would silently skip everywhere. Fail instead.
  const configured = testInfo.config.projects.map((p) => p.name);
  expect(
    configured.some((name) => OWN_VIEWPORT_PROJECTS.has(name)),
    `none of ${[...OWN_VIEWPORT_PROJECTS].join(", ")} is a configured project (${configured.join(", ")})`,
  ).toBe(true);
  test.skip(
    !OWN_VIEWPORT_PROJECTS.has(testInfo.project.name),
    "sets its own viewport; runs once per engine (chromium-1280, firefox-1280, webkit-iphone)",
  );
}

/** Layout checks for the state on screen (US-9.1). */
async function expectLayoutSound(page: Page): Promise<void> {
  await expectNoHorizontalScroll(page);
  await expectNoClippingOrOverlap(page);
}

test.describe("T-16 responsive sweep: every state at the project viewport", () => {
  for (const state of ALL_STATES) {
    test(`T-US9-1 T-US9-2 ${state.name}: no horizontal scroll, nothing clipped or overlapped, targets at least 44x44`, async ({
      page,
    }) => {
      const ready = await state.reach(page);
      await expect(ready).toBeVisible();
      await expectLayoutSound(page);
      await expectTargetsAtLeast(page, 44);
    });
  }
});

test.describe("T-16 responsive: rotation, reflow, text spacing, short landscape", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    ownViewportProjects(testInfo);
    await useFixtureBank(page);
  });

  test("T-US9-3 rotating 375x812 <-> 812x375 mid-quiz keeps the index, the selection and the locked answer", async ({
    page,
  }) => {
    const portrait = { width: 375, height: 812 };
    const landscape = { width: 812, height: 375 };
    await page.setViewportSize(portrait);
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await answerByMouse(page, true);
    await nextButton(page).click();
    await expect(h1(page, strings.question.heading(2, 5))).toBeFocused();

    // Selected, not submitted.
    const q = await currentQuestion(page);
    const wrong = radioByValue(page, optionIdFor(q, false));
    await wrong.check();
    for (const size of [landscape, portrait]) {
      await page.setViewportSize(size);
      await expect(h1(page, strings.question.heading(2, 5))).toBeVisible();
      await expect(questionView(page)).toHaveAttribute(
        "data-question-id",
        q.id,
      );
      await expect(wrong).toBeChecked();
      await expect(button(page, strings.question.submit)).not.toHaveAttribute(
        "aria-disabled",
      );
      await expectLayoutSound(page);
    }

    // Locked (submitted), with Next focused.
    await button(page, strings.question.submit).click();
    await expect(nextButton(page)).toBeFocused();
    for (const size of [landscape, portrait]) {
      await page.setViewportSize(size);
      await expect(h1(page, strings.question.heading(2, 5))).toBeVisible();
      await expect(questionView(page)).toHaveAttribute(
        "data-question-id",
        q.id,
      );
      await expect(wrong).toBeChecked();
      for (const radio of await optionsGroup(page).getByRole("radio").all()) {
        await expect(radio).toBeDisabled();
      }
      await expect(
        page.getByRole("region", { name: strings.feedback.incorrect }),
      ).toBeVisible();
      await expect(nextButton(page)).toBeFocused();
      await expectLayoutSound(page);
    }

    // The quiz continues from the same place.
    await nextButton(page).click();
    await expect(h1(page, strings.question.heading(3, 5))).toBeFocused();
  });

  test("T-US9-4 400% reflow (320x256 CSS px, 1280x1024 at 400%): a whole topic-c quiz is usable with no horizontal scroll and nothing clipped", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 256 });
    await openLanding(page);
    await expectLayoutSound(page);
    await startQuizByMouse(page, /^Fixture topic C/, 3);
    for (let k = 1; k <= 3; k += 1) {
      await expect(h1(page, strings.question.heading(k, 3))).toBeFocused();
      await expectLayoutSound(page);
      await answerByMouse(page, k !== 2);
      await expect(nextButton(page)).toBeInViewport();
      await expectLayoutSound(page);
      await nextButton(page).click();
    }
    await expect(h1(page, strings.results.heading)).toBeFocused();
    await expectLayoutSound(page);
    for (const name of [
      strings.results.tryAgain,
      strings.results.chooseAnother,
    ]) {
      await button(page, name).scrollIntoViewIfNeeded();
      await expect(button(page, name)).toBeInViewport();
    }
    await button(page, strings.results.chooseAnother).click();
    await expect(h1(page, strings.landing.heading)).toBeFocused();
  });

  test("T-US9-5 640x360: no sticky or fixed element; every focus stop and Next are visible and not obscured", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 360 });
    await openLanding(page);
    expect(await stickyOrFixedElements(page)).toEqual([]);
    // k: position of the code question in this run (order is random).
    const k = await openTopicCQuestion(page, CODE_QUESTION_ID);
    expect(await stickyOrFixedElements(page)).toEqual([]);

    // Question: Exit (before the h1), code box, radio group, Submit.
    await page.keyboard.press("Shift+Tab");
    await expect(button(page, strings.question.exit)).toBeFocused();
    await expectFocusNotObscured(page);
    await h1(page, strings.question.heading(k, 3)).focus();
    await tabUntil(page, "Tab", /^region "/);
    await expectVisibleFocusIndicator(page);
    await expectFocusNotObscured(page);
    await tabUntil(page, "Tab", /^radio-group "/);
    await expectVisibleFocusIndicator(page);
    await expectFocusNotObscured(page);
    await page.keyboard.press("Space");
    await expect(optionsGroup(page).getByRole("radio").first()).toBeChecked();
    await tabUntil(page, "Tab", `button "${strings.question.submit}"`);
    await expectVisibleFocusIndicator(page);
    await expectFocusNotObscured(page);
    await page.keyboard.press("Enter");

    // Feedback: the panel is taller than the viewport, Next is focused.
    await expect(nextButton(page)).toBeFocused();
    await expect(nextButton(page)).toBeInViewport({ ratio: 1 });
    await expectVisibleFocusIndicator(page);
    await expectFocusNotObscured(page);
    expect(await stickyOrFixedElements(page)).toEqual([]);
    // Back to the links and down again: each stop stays visible.
    for (const key of ["Shift+Tab", "Shift+Tab", "Tab", "Tab"] as const) {
      await page.keyboard.press(key);
      if ((await focusInfo(page)).descriptor === "body") continue;
      await expectFocusNotObscured(page);
    }
    await expect(nextButton(page)).toBeFocused();
    await expectFocusNotObscured(page);
    await page.keyboard.press("Enter");
    await expect(
      h1(
        page,
        k < 3 ? strings.question.heading(k + 1, 3) : strings.results.heading,
      ),
    ).toBeFocused();
  });
});

/**
 * 200% text plus text spacing, at explicit viewports. 320x800 and 375x812
 * carry `knownDefect: "D-T16-01"`: the feedback option tags ("Correct
 * answer" / "Your answer") use `white-space: nowrap` and push the page to
 * scrollWidth 426 px. Those cases are marked `test.fail`, so they report as
 * expected failures now, and T-17's fix shows up as an unexpected pass: the
 * signal to remove `knownDefect`. Recorded in docs/qa/ac-test-matrix.md
 * (section 7, D-T16-01) and the manual checklist (section E).
 */
const TEXT_SPACING_VIEWPORTS: readonly {
  width: number;
  height: number;
  knownDefect?: string;
}[] = [
  { width: 320, height: 800, knownDefect: "D-T16-01" },
  { width: 375, height: 812, knownDefect: "D-T16-01" },
  { width: 1280, height: 800 },
  { width: 768, height: 1024 },
  { width: 640, height: 360 },
];

test.describe("T-16 responsive: 200% text and WCAG 1.4.12 text spacing", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    ownViewportProjects(testInfo);
    await useFixtureBank(page);
  });

  for (const viewport of TEXT_SPACING_VIEWPORTS) {
    const size = `${String(viewport.width)}x${String(viewport.height)}`;
    test(`T-US9-4 ${size} 200% text plus text-spacing overrides: a topic-b quiz is completed, nothing clipped or overlapped, controls reachable`, async ({
      page,
      browserName,
    }) => {
      test.fail(viewport.knownDefect !== undefined, "D-T16-01, fixed by T-17");
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await applyTextResizeAndSpacing(page, browserName);
      await openLanding(page);
      await expectTextResizeAndSpacingApplied(page);
      await expectLayoutSound(page);
      await startQuizByMouse(page, /^Fixture topic B/, 5);
      for (let k = 1; k <= 5; k += 1) {
        await expect(h1(page, strings.question.heading(k, 5))).toBeFocused();
        await expectLayoutSound(page);
        await answerByMouse(page, k % 2 === 0);
        await expect(nextButton(page)).toBeInViewport();
        await expectLayoutSound(page);
        await nextButton(page).click();
      }
      await expect(h1(page, strings.results.heading)).toBeFocused();
      await expectLayoutSound(page);
      await button(page, strings.results.tryAgain).click();
      await expect(h1(page, strings.question.heading(1, 5))).toBeFocused();
    });
  }
});
