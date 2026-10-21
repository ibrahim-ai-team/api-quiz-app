/**
 * Flow suite (T-16, issue #36): journey J1 end to end with the mouse and
 * keyboard-only (US-10.2), focus order and no keyboard trap, axe on every
 * state in light and dark (US-10.1, US-13.1), offline through a full quiz
 * (SC-6, NFR-7) and deep-link refresh (US-12.3).
 *
 * Cross-engine keyboard rules:
 * - Radios are moved with ArrowDown/ArrowUp only between existing neighbours
 *   (WebKit does not wrap at the ends) and selected with Space.
 * - Link Tab stops are asserted on Chromium only: Safari/WebKit skips links
 *   in the Tab order by default (see helpers/focus.ts `linksAreTabStops`).
 *
 * No fixed sleeps: every wait is on focus, text, URL or `data-bank-status`.
 * Every test starts from a fresh context, so the specs are independent.
 */
import { expect, test, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import { expectNoCspViolations, trackCspViolations } from "./helpers/csp.ts";
import { useFixtureBank as serveFixtureBank } from "./helpers/fixture-bank.ts";
import {
  expectTabCycle,
  expectVisibleFocusIndicator,
  focusInfo,
  linksAreTabStops,
  tabUntil,
} from "./helpers/focus.ts";
import {
  expectAllSameOrigin,
  goOfflineAfterLoad,
  trackRequests,
} from "./helpers/network.ts";
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
  playQuizByMouse,
  startQuizByMouse,
  verdictPanel,
} from "./helpers/quiz.ts";
import { ALL_STATES } from "./helpers/states.ts";

const cue = strings.common.newTabCue;
const SKIP = `link "${strings.shell.skipLink}"`;
const BRAND = `link "${strings.appName}"`;
const EXIT = `button "${strings.question.exit}"`;
const SOURCE = `link "www.rfc-editor.org ${cue}"`;
const QUESTION_REPORT = `link "${strings.feedback.report} ${cue}"`;

/** The `name` shared by the radios on screen (one Tab stop per group). */
async function radioGroupStop(page: Page): Promise<string> {
  const name = await page
    .locator("main input[type='radio']")
    .first()
    .getAttribute("name");
  return `radio-group "${name ?? ""}"`;
}

/**
 * Keyboard-only answer, starting with the question h1 focused: Tab into the
 * radio group, arrows (never past an end) to the wanted option, Space to
 * select, Tab to Submit and `activate` it. On Chromium also checks tech-lead
 * input L5: Shift+Tab from Next reaches the report link, then the source
 * link. Ends with Next focused and activated with `activate`.
 */
async function answerByKeyboard(
  page: Page,
  browserName: string,
  k: number,
  n: number,
  correct: boolean,
  activate: "Enter" | "Space",
): Promise<void> {
  await expect(h1(page, strings.question.heading(k, n))).toBeFocused();
  const q = await currentQuestion(page);
  if (q.id === CODE_QUESTION_ID) {
    // The code box is the first stop after the h1 (views.md §2).
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("region", {
        name: strings.question.codeLabel(1, 1),
        exact: true,
      }),
    ).toBeFocused();
    await expectVisibleFocusIndicator(page);
  }
  await tabUntil(page, "Tab", /^radio-group "/, 3);
  await expectVisibleFocusIndicator(page);

  const values = await optionsGroup(page)
    .getByRole("radio")
    .evaluateAll((radios) => radios.map((r) => (r as HTMLInputElement).value));
  const focused = await page.evaluate(
    () => (document.activeElement as HTMLInputElement).value,
  );
  const target = optionIdFor(q, correct);
  const from = values.indexOf(focused);
  const to = values.indexOf(target);
  const arrow = to > from ? "ArrowDown" : "ArrowUp";
  for (let i = 0; i < Math.abs(to - from); i += 1) {
    await page.keyboard.press(arrow);
  }
  const radio = optionsGroup(page).locator(`input[value="${target}"]`);
  await expect(radio).toBeFocused();
  await page.keyboard.press("Space");
  await expect(radio).toBeChecked();

  await page.keyboard.press("Tab");
  const submit = button(page, strings.question.submit);
  await expect(submit).toBeFocused();
  await expectVisibleFocusIndicator(page);
  await page.keyboard.press(activate);

  const next = nextButton(page);
  await expect(next).toBeFocused();
  await expect(verdictPanel(page, correct)).toBeVisible();
  await expectVisibleFocusIndicator(page);
  if (linksAreTabStops(browserName)) {
    await page.keyboard.press("Shift+Tab");
    expect((await focusInfo(page)).descriptor).toBe(QUESTION_REPORT);
    await expectVisibleFocusIndicator(page);
    await page.keyboard.press("Shift+Tab");
    expect((await focusInfo(page)).descriptor).toBe(SOURCE);
    await expectVisibleFocusIndicator(page);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
  }
  await expect(next).toHaveText(
    k < n ? strings.feedback.next : strings.feedback.seeResults,
  );
  await page.keyboard.press(activate);
}

/** Plays a whole topic-c quiz (3 questions) by keyboard; 2 / 3 correct. */
async function playTopicCByKeyboard(
  page: Page,
  browserName: string,
): Promise<void> {
  for (let k = 1; k <= 3; k += 1) {
    await answerByKeyboard(
      page,
      browserName,
      k,
      3,
      k !== 2,
      k % 2 === 1 ? "Enter" : "Space",
    );
  }
  await expect(h1(page, strings.results.heading)).toBeFocused();
  await expect(page).toHaveURL(/#\/results$/);
  await expect(page.locator("main")).toContainText(strings.results.score(2, 3));
  await expect(page.locator("main")).toContainText(strings.results.percent(67));
}

test.describe("T-16 journey J1", () => {
  test.beforeEach(async ({ page }) => {
    await serveFixtureBank(page);
  });

  test("T-J1 T-US10-2 mouse: landing, topic, mixed answers with feedback, results, Try again, Choose another topic; same-origin, no CSP violation, no page error", async ({
    page,
    context,
    baseURL,
  }) => {
    const csp = await trackCspViolations(page);
    const requests = trackRequests(context);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openLanding(page);
    await expect(page).toHaveTitle(strings.title.landing);
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, (k) => k % 2 === 1);
    const main = page.locator("main");
    await expect(main).toContainText(strings.results.score(3, 5));
    await expect(main).toContainText(strings.results.percent(60));
    await expect(main).toContainText(strings.results.band.mid);

    await button(page, strings.results.tryAgain).click();
    await expect(h1(page, strings.question.heading(1, 5))).toBeFocused();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    await playQuizByMouse(page, 5, () => false);
    await expect(main).toContainText(strings.results.score(0, 5));
    await expect(main).toContainText(strings.results.band.zero);

    await button(page, strings.results.chooseAnother).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();

    await expectNoCspViolations(page, csp);
    expectAllSameOrigin(requests, baseURL ?? "");
    expect(pageErrors, "uncaught page errors").toEqual([]);
  });

  test("T-J1 T-US10-2 keyboard only: Tab/Shift+Tab, Space selects, Enter/Space activate; visible focus at every stop; Try again and Choose another topic", async ({
    page,
    browserName,
  }) => {
    await openLanding(page);
    // First load of Landing does not move focus: Tab starts at the top.
    if (linksAreTabStops(browserName)) {
      await page.keyboard.press("Tab");
      expect((await focusInfo(page)).descriptor).toBe(SKIP);
      await expectVisibleFocusIndicator(page);
      await page.keyboard.press("Tab");
      expect((await focusInfo(page)).descriptor).toBe(BRAND);
      await expectVisibleFocusIndicator(page);
    }
    await tabUntil(page, "Tab", /^radio-group "/, 3);
    await expectVisibleFocusIndicator(page);
    const topicA = page.getByRole("radio", { name: /^Fixture topic A/ });
    const topicC = page.getByRole("radio", { name: /^Fixture topic C/ });
    await expect(topicA).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(topicC).toBeFocused();
    await page.keyboard.press("Space");
    await expect(topicC).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(button(page, strings.landing.start)).toBeFocused();
    await expectVisibleFocusIndicator(page);
    await page.keyboard.press("Enter");

    await playTopicCByKeyboard(page, browserName);

    // Results: Tab order Try again, Choose another topic; Shift+Tab back.
    await page.keyboard.press("Tab");
    await expect(button(page, strings.results.tryAgain)).toBeFocused();
    await expectVisibleFocusIndicator(page);
    await page.keyboard.press("Tab");
    await expect(button(page, strings.results.chooseAnother)).toBeFocused();
    await expectVisibleFocusIndicator(page);
    await page.keyboard.press("Shift+Tab");
    await expect(button(page, strings.results.tryAgain)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(h1(page, strings.question.heading(1, 3))).toBeFocused();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);

    await playTopicCByKeyboard(page, browserName);
    await tabUntil(page, "Tab", `button "${strings.results.chooseAnother}"`, 3);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
  });

  test("T-J1 alternate: the source link opens a new tab and the quiz state is kept", async ({
    page,
    context,
  }) => {
    // The new tab must not reach the real site: answer it locally.
    await context.route("https://www.rfc-editor.org/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/plain", body: "stub" }),
    );
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await answerByMouse(page, true);
    const q = await currentQuestion(page);
    const popupPromise = context.waitForEvent("page");
    await page.getByRole("link", { name: /^www\.rfc-editor\.org/ }).click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/^https:\/\/www\.rfc-editor\.org\//);
    await popup.close();
    await expect(page).toHaveURL(/#\/quiz$/);
    await expect(h1(page, strings.question.heading(1, 5))).toBeVisible();
    await expect(page.locator("[data-question-id]")).toHaveAttribute(
      "data-question-id",
      q.id,
    );
    await expect(verdictPanel(page, true)).toBeVisible();
    await nextButton(page).click();
    await expect(h1(page, strings.question.heading(2, 5))).toBeFocused();
  });
});

test.describe("T-16 focus order and no keyboard trap (US-10.2)", () => {
  test.beforeEach(async ({ page }) => {
    await serveFixtureBank(page);
  });

  test("T-US10-2 landing: logical Tab and Shift+Tab order, visible focus, no trap", async ({
    page,
    browserName,
  }) => {
    await openLanding(page);
    const order = [
      SKIP,
      BRAND,
      await radioGroupStop(page),
      `button "${strings.landing.start}"`,
      `link "${strings.landing.report} ${cue}"`,
    ];
    await expectTabCycle(page, browserName, order, "Tab");
    await expectTabCycle(page, browserName, order, "Shift+Tab");
  });

  test("T-US10-2 question and feedback with code boxes: logical Tab and Shift+Tab order, visible focus, no trap", async ({
    page,
    browserName,
  }) => {
    await openLanding(page);
    await openTopicCQuestion(page, CODE_QUESTION_ID);
    // Exit (header), code box, radio group, Submit (views.md §2).
    const question = [
      SKIP,
      EXIT,
      `region "${strings.question.codeLabel(1, 1)}"`,
      await radioGroupStop(page),
      `button "${strings.question.submit}"`,
    ];
    await expectTabCycle(page, browserName, question, "Tab");
    await expectTabCycle(page, browserName, question, "Shift+Tab");

    // Feedback: locked radios are not stops; Next is last (views.md §3).
    await answerByMouse(page, false);
    const nextLabel = (await nextButton(page).textContent()) ?? "";
    const feedback = [
      SKIP,
      EXIT,
      `region "${strings.question.codeLabel(1, 1)}"`,
      `region "${strings.feedback.explanationCodeLabel(1, 1)}"`,
      SOURCE,
      QUESTION_REPORT,
      `button "${nextLabel}"`,
    ];
    await expectTabCycle(page, browserName, feedback, "Tab");
    await expectTabCycle(page, browserName, feedback, "Shift+Tab");
  });

  test("T-US10-2 results and 404: logical Tab and Shift+Tab order, visible focus, no trap", async ({
    page,
    browserName,
  }) => {
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, () => true);
    const results = [
      SKIP,
      BRAND,
      `button "${strings.results.tryAgain}"`,
      `button "${strings.results.chooseAnother}"`,
    ];
    await expectTabCycle(page, browserName, results, "Tab");
    await expectTabCycle(page, browserName, results, "Shift+Tab");

    await page.goto("./#/no-such-page");
    await expect(h1(page, strings.notFound.heading)).toBeFocused();
    const notFound = [SKIP, BRAND, `link "${strings.common.home}"`];
    await expectTabCycle(page, browserName, notFound, "Tab");
    await expectTabCycle(page, browserName, notFound, "Shift+Tab");
  });
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`T-16 axe on every state, ${colorScheme} (US-10.1, US-13.1)`, () => {
    test.use({ colorScheme });

    for (const state of ALL_STATES) {
      test(`T-US10-1 ${colorScheme === "dark" ? "T-US13-1 " : ""}${state.name} (${colorScheme}): 0 serious or critical axe violations`, async ({
        page,
      }) => {
        const ready = await state.reach(page);
        expect(
          await page.evaluate(
            () => matchMedia("(prefers-color-scheme: dark)").matches,
          ),
        ).toBe(colorScheme === "dark");
        await expectNoAxeSeriousOrCritical(page, ready);
      });
    }
  });
}

test.describe("T-16 offline and deep links", () => {
  test.beforeEach(async ({ page }) => {
    await serveFixtureBank(page);
  });

  test("T-NFR7-1 SC-6 offline after load: a full quiz to results and back to Landing makes 0 requests", async ({
    page,
    context,
  }) => {
    // Start on "#/" so the run ends on the same URL (Choose another topic).
    await openLanding(page, "#/");
    await goOfflineAfterLoad(page, context, async (p) => {
      await startQuizByMouse(p, /^Fixture topic B/, 5);
      await playQuizByMouse(p, 5, (k) => k <= 2);
      await expect(p.locator("main")).toContainText(
        strings.results.score(2, 5),
      );
      await button(p, strings.results.tryAgain).click();
      await expect(h1(p, strings.question.heading(1, 5))).toBeFocused();
      await playQuizByMouse(p, 5, () => true);
      await button(p, strings.results.chooseAnother).click();
      await expect(h1(p, strings.landing.heading)).toBeFocused();
    });
    await expect(page).toHaveURL(/#\/$/);
  });

  test("T-US12-3 refresh on #/topic/topic-b keeps the preselection; refresh on an unknown topic keeps Topic not found", async ({
    page,
  }) => {
    await openLanding(page, "#/topic/topic-b");
    const topicB = page.getByRole("radio", { name: /^Fixture topic B/ });
    await expect(topicB).toBeChecked();
    await page.reload();
    await expect(page).toHaveURL(/#\/topic\/topic-b$/);
    await expect(page.locator("main")).toHaveAttribute(
      "data-bank-status",
      "ready",
    );
    await expect(topicB).toBeChecked();
    await expect(h1(page, strings.landing.heading)).toBeVisible();
    await expect(page).toHaveTitle(strings.title.landing);

    await openLanding(page, "#/topic/no-such-topic");
    await page.reload();
    await expect(page).toHaveURL(/#\/topic\/no-such-topic$/);
    await expect(h1(page, strings.notFound.topicHeading)).toBeFocused();
    await expect(page).toHaveTitle(strings.title.topicNotFound);
  });

  test("T-US12-3 refresh mid-quiz on #/quiz and on #/results redirects to Landing with its h1 focused (views.md §2, §4)", async ({
    page,
  }) => {
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await answerByMouse(page, true);
    await expect(page).toHaveURL(/#\/quiz$/);
    await page.reload();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(page.locator("[data-question-id]")).toHaveCount(0);

    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, () => true);
    await page.reload();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(h1(page, strings.results.heading)).toHaveCount(0);
  });
});
