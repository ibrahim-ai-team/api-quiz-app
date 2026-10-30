/**
 * Best score, resume, corrupt data, reset and two tabs (T-45, issue #108;
 * US-6.1 to US-6.8, US-5.5; views.md §9, copy.md landing.bestScore /
 * resume.* / progress.*). Covers T-42 (best score), T-43 (resume, notice,
 * replace) and T-44 (reset) end to end on the production preview.
 *
 * Fixture bank: topic-a 12, topic-b 5, topic-c 3, topic-d 0. Question order
 * is random per run, so answers are chosen from the fixture's `correct` IDs
 * by `data-question-id` (standard 12), never by position. Saved data is
 * read and written in the page with `localStorage` (helpers/progress.ts);
 * corrupt values are written and then the page is reloaded, so the app's
 * startup decode sees them. Storage failures are injected with init scripts
 * that patch `Storage` before any app script runs.
 *
 * CLS (Chromium only, Layout Instability API) reuses the T-34 method
 * (helpers/cls.ts): saved data is seeded with `page.addInitScript` and the
 * bank is delayed so the loading state is painted first.
 */
import { expect, test, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import {
  CLS_LIMIT,
  bankLikeGenerated,
  observeLayoutShifts,
  readGeneratedReserve,
  readShifts,
  serveSlowBank,
} from "./helpers/cls.ts";
import { useFixtureBank } from "./helpers/fixture-bank.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";
import {
  FIXTURE,
  TOPIC_NAME,
  answerByMouse,
  button,
  currentQuestion,
  h1,
  nextButton,
  openLanding,
  optionsGroup,
  playQuizByMouse,
  questionView,
  radioByValue,
  startQuizByMouse,
  verdictPanel,
} from "./helpers/quiz.ts";
import { expectNoClippingOrOverlap } from "./helpers/reflow.ts";
import {
  APP_KEY_PREFIX,
  KEYS,
  MAX_VALUE_LENGTH,
  bestValue,
  expectNoBestScores,
  expectNoLoadNotice,
  installFailingAppWrites,
  leaveQuizInProgress,
  loadNotice,
  makeStorageUnavailable,
  progressSection,
  readSession,
  readStorage,
  replaceGroup,
  resetButton,
  resetGroup,
  resumeCard,
  seedStorageBeforeLoad,
  setFailAppWrites,
  topicRadio,
  writeStorage,
  type StoredSession,
  type UnavailableMode,
} from "./helpers/progress.ts";

const TOPIC_A = TOPIC_NAME.get("topic-a") ?? "";
const TOPIC_B = TOPIC_NAME.get("topic-b") ?? "";
const TOPIC_C = TOPIC_NAME.get("topic-c") ?? "";
const MIXED = strings.landing.mixedLabel;
const MIXED_COUNT = FIXTURE.questions.length;

/** Option IDs in the order the options are shown. */
async function shownOptionOrder(page: Page): Promise<string[]> {
  return optionsGroup(page)
    .locator('input[type="radio"]')
    .evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value));
}

/** Asserts the shown question is saved question `index` (0-based) of `saved`. */
async function expectSavedQuestion(
  page: Page,
  saved: StoredSession,
  index: number,
): Promise<void> {
  const n = saved.questionIds.length;
  await expect(h1(page, strings.question.heading(index + 1, n))).toBeVisible();
  await expect(questionView(page)).toHaveAttribute(
    "data-question-id",
    saved.questionIds[index] ?? "",
  );
  expect(
    await shownOptionOrder(page),
    `option order of question ${String(index + 1)}`,
  ).toEqual(saved.optionOrder[index]);
}

/** Plays a retry quiz of `n` questions (Results h1 is the retry heading). */
async function playRetry(
  page: Page,
  n: number,
  correct: boolean,
): Promise<void> {
  for (let k = 1; k <= n; k += 1) {
    await expect(h1(page, strings.question.heading(k, n))).toBeFocused();
    await answerByMouse(page, correct);
    await nextButton(page).click();
  }
  await expect(h1(page, strings.results.retryHeading)).toBeFocused();
}

/** Results -> Landing with "Choose another topic" (views.md §4). */
async function backToLanding(page: Page): Promise<void> {
  await button(page, strings.results.chooseAnother).click();
  await expect(h1(page, strings.landing.heading)).toBeFocused();
}

async function reloadLanding(page: Page): Promise<void> {
  await page.reload();
  // Landing: `#/`, or no hash when the page was opened at the base URL.
  await expect(page).toHaveURL(/\/api-quiz-app\/(#\/)?$/);
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    "ready",
  );
}

test.describe("T-45 US-6 saved progress", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US6-2 reload then Resume restores the exact question index, question order, option order and locked answers", async ({
    page,
  }) => {
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await answerByMouse(page, true);
    await nextButton(page).click();
    await expect(h1(page, strings.question.heading(2, 5))).toBeFocused();
    const q2 = await currentQuestion(page);
    const q2Order = await shownOptionOrder(page);
    const wrong = q2.options.find((o) => o.id !== q2.correct)?.id ?? "";
    await radioByValue(page, wrong).check();
    await button(page, strings.question.submit).click();
    await expect(verdictPanel(page, false)).toBeVisible();

    // Saved after Submit (FR-15): index 1 with its locked answer.
    const saved = await readSession(page);
    expect(saved).not.toBeNull();
    if (saved === null) return;
    expect(saved.index).toBe(1);
    expect(saved.answers).toHaveLength(2);
    expect(saved.answers[1]).toEqual({ q: q2.id, o: wrong });
    expect(saved.optionOrder[1]).toEqual(q2Order);

    // Reload in the feedback phase.
    await reloadLanding(page);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    const card = resumeCard(page);
    await expect(card).toContainText(strings.resume.summary(TOPIC_B, 2, 5));
    await expect(
      card.getByRole("button", { name: strings.resume.resume }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: strings.resume.discard }),
    ).toBeVisible();
    await card.getByRole("button", { name: strings.resume.resume }).click();

    // views.md §9.4: feedback restored, locked, focus on the h1 (not Next).
    await expect(h1(page, strings.question.heading(2, 5))).toBeFocused();
    await expect(page).toHaveURL(/#\/quiz$/);
    await expect(page).toHaveTitle(strings.title.question(2, 5, TOPIC_B));
    await expectSavedQuestion(page, saved, 1);
    await expect(radioByValue(page, wrong)).toBeChecked();
    for (const id of q2Order)
      await expect(radioByValue(page, id)).toBeDisabled();
    await expect(verdictPanel(page, false)).toBeVisible();
    await expect(nextButton(page)).toBeVisible();
    await expect(nextButton(page)).not.toBeFocused();

    // Next, then reload in the answering phase of question 3.
    await nextButton(page).click();
    await expect(h1(page, strings.question.heading(3, 5))).toBeFocused();
    await expectSavedQuestion(page, saved, 2);
    await reloadLanding(page);
    await expect(resumeCard(page)).toContainText(
      strings.resume.summary(TOPIC_B, 2, 5),
    );
    await resumeCard(page)
      .getByRole("button", { name: strings.resume.resume })
      .click();
    await expect(h1(page, strings.question.heading(3, 5))).toBeFocused();
    await expectSavedQuestion(page, saved, 2);
    // The selection of an unsubmitted question is not restored (J3).
    for (const id of saved.optionOrder[2] ?? []) {
      await expect(radioByValue(page, id)).not.toBeChecked();
      await expect(radioByValue(page, id)).toBeEnabled();
    }

    // The rest of the quiz follows the saved order exactly.
    for (let i = 2; i < 5; i += 1) {
      await expectSavedQuestion(page, saved, i);
      await answerByMouse(page, true);
      await nextButton(page).click();
    }
    await expect(h1(page, strings.results.heading)).toBeFocused();
    await expect(page.locator("main")).toContainText(
      strings.results.score(4, 5),
    );
    // A finished quiz is no longer saved (§9.4); a resumed normal quiz on
    // the same content counts toward the best score (§9.3).
    expect(await readSession(page)).toBeNull();
    await backToLanding(page);
    await expect(resumeCard(page)).toHaveCount(0);
    await expect(topicRadio(page, TOPIC_B, 5, 80)).toBeVisible();
  });

  test("T-US6-2 Exit keeps the quiz saved (U3); Discard removes only the quiz and focuses its result text", async ({
    page,
  }) => {
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic C/, 3);
    await playQuizByMouse(page, 3, (k) => k !== 2);
    await backToLanding(page);
    await expect(topicRadio(page, TOPIC_C, 3, 67)).toBeVisible();
    const best = (await readStorage(page))[KEYS.best];

    await leaveQuizInProgress(page, /^Fixture topic B/, 5, 1);
    await expect(resumeCard(page)).toContainText(
      strings.resume.summary(TOPIC_B, 1, 5),
    );
    await resumeCard(page)
      .getByRole("button", { name: strings.resume.discard })
      .click();
    const discarded = page.getByText(strings.resume.discarded, { exact: true });
    await expect(discarded).toBeFocused();
    await expect(resumeCard(page)).toHaveCount(0);
    const stored = await readStorage(page);
    expect(stored[KEYS.session]).toBeUndefined();
    expect(stored[KEYS.best]).toBe(best);
    await expect(topicRadio(page, TOPIC_C, 3, 67)).toBeVisible();

    await reloadLanding(page);
    await expect(resumeCard(page)).toHaveCount(0);
    await expectNoLoadNotice(page);
  });

  test("T-US6-1 T-US5-5 best score per topic and for Mixed; lower scores and retries never replace it; it survives a reload", async ({
    page,
  }) => {
    await openLanding(page);
    await expectNoBestScores(page);

    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, (k) => k <= 3);
    await backToLanding(page);
    await expect(topicRadio(page, TOPIC_B, 5, 60)).toBeVisible();
    await expect(topicRadio(page, TOPIC_A, 12, null)).toBeVisible();
    await expect(topicRadio(page, TOPIC_C, 3, null)).toBeVisible();
    await expect(topicRadio(page, MIXED, MIXED_COUNT, null)).toBeVisible();
    // The visible text matches the accessible name (2.5.3).
    await expect(
      page.locator("label").filter({ has: topicRadio(page, TOPIC_B, 5, 60) }),
    ).toContainText(strings.landing.bestScore(60));

    // 2 / 5 (lower), then Retry 3 missed all correct (100%, retry-missed).
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, (k) => k <= 2);
    await button(page, strings.results.retryMissed(3)).click();
    await playRetry(page, 3, true);
    await expect(page.locator("main")).toContainText(strings.results.retryNote);
    await backToLanding(page);
    await expect(topicRadio(page, TOPIC_B, 5, 60)).toBeVisible();

    // Mixed has its own best score; topic rows are unchanged by it.
    await startQuizByMouse(page, /^Mixed/, 10);
    await playQuizByMouse(page, 10, (k) => k % 3 !== 0);
    await backToLanding(page);
    await expect(topicRadio(page, MIXED, MIXED_COUNT, 70)).toBeVisible();
    await expect(topicRadio(page, TOPIC_B, 5, 60)).toBeVisible();
    await expect(topicRadio(page, TOPIC_A, 12, null)).toBeVisible();

    // A higher score replaces it (Try again from Results).
    await startQuizByMouse(page, /^Fixture topic C/, 3);
    await playQuizByMouse(page, 3, () => false);
    await button(page, strings.results.tryAgain).click();
    await expect(h1(page, strings.question.heading(1, 3))).toBeFocused();
    await playQuizByMouse(page, 3, () => true);
    await backToLanding(page);
    await expect(topicRadio(page, TOPIC_C, 3, 100)).toBeVisible();

    await reloadLanding(page);
    await expect(topicRadio(page, TOPIC_B, 5, 60)).toBeVisible();
    await expect(topicRadio(page, TOPIC_C, 3, 100)).toBeVisible();
    await expect(topicRadio(page, MIXED, MIXED_COUNT, 70)).toBeVisible();
    await expect(topicRadio(page, TOPIC_A, 12, null)).toBeVisible();
  });

  test("T-US6-4 Start with a saved quiz asks first; Cancel and Escape keep it; confirm replaces it with the selected scope", async ({
    page,
  }) => {
    await openLanding(page);
    await leaveQuizInProgress(page, /^Fixture topic B/, 5, 1);
    const start = button(page, strings.landing.start);
    await expect(start).toHaveAttribute("aria-expanded", "false");

    // Open, then Cancel: focus back on Start, the card stays.
    await page.getByRole("radio", { name: /^Fixture topic C/ }).click();
    await start.click();
    const group = replaceGroup(page);
    await expect(group).toBeVisible();
    const message = group.getByText(strings.landing.replaceMessage, {
      exact: true,
    });
    await expect(message).toBeFocused();
    await expect(start).toHaveAttribute("aria-expanded", "true");
    await expect(start).toHaveAttribute(
      "aria-controls",
      (await group.getAttribute("id")) ?? "",
    );
    await group.getByRole("button", { name: strings.common.cancel }).click();
    await expect(group).toHaveCount(0);
    await expect(start).toBeFocused();
    await expect(start).toHaveAttribute("aria-expanded", "false");
    await expect(resumeCard(page)).toBeVisible();

    // Open, then Escape (focus inside the group).
    await start.click();
    await expect(message).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(group).toHaveCount(0);
    await expect(start).toBeFocused();
    expect((await readSession(page))?.scope).toEqual({
      kind: "topic",
      topicId: "topic-b",
    });

    // Open, change the topic while open (stays open), then confirm.
    await start.click();
    await expect(message).toBeFocused();
    await page.getByRole("radio", { name: /^Mixed/ }).click();
    await expect(group).toBeVisible();
    await group
      .getByRole("button", { name: strings.landing.replaceConfirm })
      .click();
    await expect(h1(page, strings.question.heading(1, 10))).toBeFocused();
    await expect(page).toHaveTitle(strings.title.question(1, 10, MIXED));
    // The old quiz is removed before the new one is saved (§9.6).
    expect(await readSession(page)).toBeNull();
    await button(page, strings.question.exit).click();
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(resumeCard(page)).toHaveCount(0);

    // Without a saved quiz, Start starts at once (no confirmation).
    await startQuizByMouse(page, /^Fixture topic C/, 3);
    await answerByMouse(page, true);
    expect((await readSession(page))?.scope).toEqual({
      kind: "topic",
      topicId: "topic-c",
    });
  });

  test("T-US6-6 Reset progress: Cancel and Escape keep everything; confirm clears only apiquiz: keys", async ({
    page,
  }) => {
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic C/, 3);
    await playQuizByMouse(page, 3, () => true);
    await backToLanding(page);
    await leaveQuizInProgress(page, /^Fixture topic B/, 5, 2);
    const foreign = {
      "other-app:settings": '{"theme":"dark"}',
      apiquiz: "no colon, not ours",
      "APIQUIZ:v1:best": "upper case, not ours",
      "x-apiquiz:v1:session": "prefix elsewhere, not ours",
      "my apiquiz:note": "contains the prefix, not ours",
    };
    await writeStorage(page, { ...foreign, "apiquiz:v2:future": "{}" });

    const section = progressSection(page);
    await expect(section).toContainText(strings.progress.description);
    const reset = resetButton(page);
    await expect(reset).toHaveAttribute("aria-expanded", "false");
    await reset.click();
    const group = resetGroup(page);
    const message = group.getByText(strings.progress.resetMessage, {
      exact: true,
    });
    await expect(message).toBeFocused();
    await expect(reset).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(group).toHaveCount(0);
    await expect(reset).toBeFocused();
    await reset.click();
    await expect(message).toBeFocused();
    await group.getByRole("button", { name: strings.common.cancel }).click();
    await expect(group).toHaveCount(0);
    await expect(reset).toBeFocused();
    await expect(resumeCard(page)).toBeVisible();
    await expect(topicRadio(page, TOPIC_C, 3, 100)).toBeVisible();

    await reset.click();
    await group
      .getByRole("button", { name: strings.progress.resetConfirm })
      .click();
    await expect(
      page.getByText(strings.progress.resetDone, { exact: true }),
    ).toBeFocused();
    await expect(resumeCard(page)).toHaveCount(0);
    await expectNoBestScores(page);
    await expect(reset).toBeVisible();

    const stored = await readStorage(page);
    expect(
      Object.keys(stored).filter((k) => k.startsWith(APP_KEY_PREFIX)),
    ).toEqual([]);
    expect(stored).toEqual(foreign);

    await reloadLanding(page);
    await expect(resumeCard(page)).toHaveCount(0);
    await expectNoBestScores(page);
    await expectNoLoadNotice(page);
    await expect(resetButton(page)).toBeVisible();
    expect(await readStorage(page)).toEqual(foreign);
  });

  test("T-US6-8 stored data: only the two app keys, within 51,200 code units, holding only IDs, scores, versions and timestamps", async ({
    page,
  }) => {
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, (k) => k % 2 === 0);
    await backToLanding(page);
    // The longest quiz the fixture allows (Mixed, 10), left in progress.
    await leaveQuizInProgress(page, /^Mixed/, 10, 9, (k) => k % 2 === 1);

    const stored = await readStorage(page);
    expect(Object.keys(stored).sort()).toEqual(
      [KEYS.best, KEYS.session].sort(),
    );
    for (const [key, value] of Object.entries(stored)) {
      expect(value.length, `${key} length`).toBeLessThanOrEqual(
        MAX_VALUE_LENGTH,
      );
    }
    // US-6.8 "at most 50 KB" for the stored data as a whole.
    const total = Object.values(stored).reduce((n, v) => n + v.length, 0);
    expect(total, "combined length of both values").toBeLessThanOrEqual(
      MAX_VALUE_LENGTH,
    );

    // Allowed string values: bank IDs, the content version and enum words.
    const allowed = new Set<string>([
      FIXTURE.contentVersion,
      "normal",
      "retry-missed",
      "topic",
      "mixed",
      ...FIXTURE.topics.map((t) => t.id),
      ...FIXTURE.questions.flatMap((q) => [
        q.id,
        ...q.options.map((o) => o.id),
      ]),
    ]);
    const found: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "string") found.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (typeof value === "object" && value !== null) {
        for (const v of Object.values(value)) walk(v);
      } else {
        expect(typeof value, "only numbers besides strings").toBe("number");
      }
    };
    const session = JSON.parse(stored[KEYS.session] ?? "") as Record<
      string,
      unknown
    >;
    const best = JSON.parse(stored[KEYS.best] ?? "") as {
      schemaVersion: unknown;
      scores: Record<string, Record<string, unknown>>;
    };
    expect(Object.keys(session)).toEqual([
      "schemaVersion",
      "contentVersion",
      "mode",
      "scope",
      "seed",
      "questionIds",
      "optionOrder",
      "answers",
      "index",
      "savedAt",
    ]);
    expect(Object.keys(best)).toEqual(["schemaVersion", "scores"]);
    expect(Object.keys(best.scores)).toEqual(["topic-b"]);
    expect(best.scores["topic-b"]).toMatchObject({
      percent: 40,
      correct: 2,
      total: 5,
    });
    expect(Object.keys(best.scores["topic-b"] ?? {}).sort()).toEqual([
      "at",
      "correct",
      "percent",
      "total",
    ]);
    walk(session);
    walk(best);
    expect(found.filter((s) => !allowed.has(s))).toEqual([]);
    // No question, option or explanation text anywhere.
    const raw = Object.values(stored).join("\n");
    for (const q of FIXTURE.questions) {
      for (const o of q.options) expect(raw).not.toContain(o.text);
    }
    const texts = FIXTURE.questions as unknown as {
      prompt: string;
      explanation: string;
    }[];
    for (const { prompt, explanation } of texts) {
      expect(raw).not.toContain(prompt);
      expect(raw).not.toContain(explanation);
    }
  });
});

test.describe("T-45 US-6.3 corrupt or stale saved data is removed with a non-blocking notice", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  const validBest = bestValue({ "topic-b": { correct: 3, total: 5 } });
  const STALE_QUESTION = "fixture-question-removed-by-deploy";
  const STALE_OPTION = "fixture-option-removed-by-deploy";

  /** Session variants that must be removed, built from a real saved quiz. */
  const badSessions: { name: string; make: (s: StoredSession) => string }[] = [
    {
      name: "corrupt JSON",
      make: () => '{"schemaVersion":1,"contentVersion":',
    },
    {
      name: "unknown schema version",
      make: (s) => JSON.stringify({ ...s, schemaVersion: 99 }),
    },
    {
      name: "stale question ID",
      make: (s) =>
        JSON.stringify({
          ...s,
          questionIds: [STALE_QUESTION, ...s.questionIds.slice(1)],
          answers: s.answers.map((a, i) =>
            i === 0 ? { ...a, q: STALE_QUESTION } : a,
          ),
        }),
    },
    {
      name: "stale option ID",
      make: (s) => {
        const first = s.optionOrder[0] ?? [];
        const chosen = s.answers[0]?.o;
        // Replace an option that was not chosen, so the session stays
        // internally consistent and only the bank check rejects it.
        const victim = first.find((o) => o !== chosen) ?? "";
        return JSON.stringify({
          ...s,
          optionOrder: [
            first.map((o) => (o === victim ? STALE_OPTION : o)),
            ...s.optionOrder.slice(1),
          ],
        });
      },
    },
  ];

  for (const bad of badSessions) {
    test(`T-US6-3 saved quiz with ${bad.name}: removed, notice shown, valid best scores kept, app usable`, async ({
      page,
    }) => {
      await openLanding(page);
      const saved = await leaveQuizInProgress(page, /^Fixture topic B/, 5, 1);
      await writeStorage(page, {
        [KEYS.session]: bad.make(saved),
        [KEYS.best]: validBest,
      });
      await reloadLanding(page);

      await expect(loadNotice(page)).toHaveText(
        strings.progress.sessionRemoved,
      );
      await expect(resumeCard(page)).toHaveCount(0);
      await expect(topicRadio(page, TOPIC_B, 5, 60)).toBeVisible();
      // Non-blocking: focus stays where the shell put it (Landing h1 after a
      // reload on #/), never on the notice.
      await expect(loadNotice(page)).not.toBeFocused();
      const stored = await readStorage(page);
      expect(stored[KEYS.session]).toBeUndefined();
      expect(stored[KEYS.best]).toBe(validBest);

      // The app works: Start goes straight to a new quiz (nothing to replace).
      await startQuizByMouse(page, /^Fixture topic C/, 3);
      await button(page, strings.question.exit).click();
      await expect(h1(page, strings.landing.heading)).toBeFocused();
      // The notice is cleared once Landing has been left (§9.5).
      await expectNoLoadNotice(page);
    });
  }

  test("T-US6-3 corrupt best scores with a valid saved quiz: best scores removed with their notice, the quiz is still offered", async ({
    page,
  }) => {
    await openLanding(page);
    await leaveQuizInProgress(page, /^Fixture topic B/, 5, 1);
    await writeStorage(page, {
      [KEYS.best]: '{"schemaVersion":1,"scores":[1,2]}',
    });
    await reloadLanding(page);
    await expect(loadNotice(page)).toHaveText(strings.progress.bestRemoved);
    await expect(resumeCard(page)).toContainText(
      strings.resume.summary(TOPIC_B, 1, 5),
    );
    await expectNoBestScores(page);
    const stored = await readStorage(page);
    expect(stored[KEYS.best]).toBeUndefined();
    expect(stored[KEYS.session]).toBeDefined();
  });

  test("T-US6-3 both values bad (unknown best version, corrupt quiz): both sentences, quiz first, in one notice", async ({
    page,
  }) => {
    await openLanding(page);
    await writeStorage(page, {
      [KEYS.session]: "not json at all",
      [KEYS.best]: bestValue({ "topic-b": { correct: 3, total: 5 } }, 2),
    });
    await reloadLanding(page);
    await expect(loadNotice(page)).toHaveText(
      `${strings.progress.sessionRemoved} ${strings.progress.bestRemoved}`,
    );
    await expect(loadNotice(page).getByRole("paragraph")).toHaveCount(1);
    await expectNoBestScores(page);
    expect(await readStorage(page)).toEqual({});
  });

  test("T-US6-8 oversized saved value (over 51,200 code units) reads as absent: no notice, no card, not removed", async ({
    page,
  }) => {
    await openLanding(page);
    const saved = await leaveQuizInProgress(page, /^Fixture topic B/, 5, 1);
    const padded = JSON.stringify({
      ...saved,
      pad: "x".repeat(MAX_VALUE_LENGTH),
    });
    await writeStorage(page, { [KEYS.session]: padded });
    await reloadLanding(page);
    await expect(resumeCard(page)).toHaveCount(0);
    await expectNoLoadNotice(page);
    expect((await readStorage(page))[KEYS.session]).toBe(padded);
  });
});

test.describe("T-45 US-6.5 storage unavailable or failing", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  for (const mode of ["getter-throws", "setitem-throws"] as UnavailableMode[]) {
    test(`T-US6-5 localStorage unavailable (${mode}): progress features hidden, quizzes still complete in memory`, async ({
      page,
    }) => {
      await makeStorageUnavailable(page, mode);
      await openLanding(page);
      // The injection is in effect.
      const usable = await page.evaluate(() => {
        try {
          localStorage.setItem("e2e-check", "1");
          localStorage.removeItem("e2e-check");
          return true;
        } catch {
          return false;
        }
      });
      expect(usable, "localStorage must be unusable").toBe(false);

      await expect(progressSection(page)).toHaveCount(0);
      await expect(resetButton(page)).toHaveCount(0);
      await expectNoBestScores(page);

      // A quiz, then Retry missed: both complete; no retry note (U2).
      await startQuizByMouse(page, /^Fixture topic C/, 3);
      await playQuizByMouse(page, 3, (k) => k !== 1);
      await button(page, strings.results.retryMissed(1)).click();
      await playRetry(page, 1, true);
      await expect(page.locator("main")).not.toContainText(
        strings.results.retryNote,
      );
      await backToLanding(page);
      await expectNoBestScores(page);

      // Exit discards the quiz in memory-only mode (U3): no card, no confirm.
      await startQuizByMouse(page, /^Fixture topic B/, 5);
      await answerByMouse(page, true);
      await button(page, strings.question.exit).click();
      await expect(h1(page, strings.landing.heading)).toBeFocused();
      await expect(resumeCard(page)).toHaveCount(0);
      await startQuizByMouse(page, /^Fixture topic B/, 5);
      await expect(replaceGroup(page)).toHaveCount(0);

      await reloadLanding(page);
      await expect(resumeCard(page)).toHaveCount(0);
      await expectNoLoadNotice(page);
      await expect(progressSection(page)).toHaveCount(0);
    });
  }

  test("T-US6-5 a write that throws mid-quiz never interrupts it; the older saved position is removed, best score write fails silently", async ({
    page,
  }) => {
    await installFailingAppWrites(page);
    await openLanding(page);
    // The probe works, so progress features are shown (persistent storage).
    await expect(progressSection(page)).toBeVisible();

    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await answerByMouse(page, true);
    expect((await readSession(page))?.answers).toHaveLength(1);

    await setFailAppWrites(page, true);
    await nextButton(page).click();
    await expect(h1(page, strings.question.heading(2, 5))).toBeFocused();
    // U2: after a failed session write the stale position is removed.
    expect(await readSession(page)).toBeNull();
    for (let k = 2; k <= 5; k += 1) {
      await expect(h1(page, strings.question.heading(k, 5))).toBeFocused();
      await answerByMouse(page, true);
      await nextButton(page).click();
    }
    await expect(h1(page, strings.results.heading)).toBeFocused();
    await expect(page.locator("main")).toContainText(
      strings.results.score(5, 5),
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await backToLanding(page);
    await expectNoBestScores(page);
    expect(await readStorage(page)).toEqual({});

    // After a reload (writes work again) nothing old is offered.
    await reloadLanding(page);
    await expect(resumeCard(page)).toHaveCount(0);
    await expectNoLoadNotice(page);
  });
});

test.describe("T-45 US-6.7 two tabs: last write wins, no prompt", () => {
  test("T-US6-7 two pages in one context: each save overwrites the other's, Landing shows the last write, bad data from the other tab is still validated", async ({
    context,
  }) => {
    const a = await context.newPage();
    const b = await context.newPage();
    const dialogs: string[] = [];
    await useFixtureBank(a);
    await useFixtureBank(b);
    for (const p of [a, b]) {
      p.on("dialog", (d) => {
        dialogs.push(d.message());
        void d.dismiss();
      });
    }

    await openLanding(a);
    await startQuizByMouse(a, /^Fixture topic B/, 5);
    await answerByMouse(a, true);
    expect((await readSession(a))?.scope).toEqual({
      kind: "topic",
      topicId: "topic-b",
    });

    // Tab B sees A's quiz, replaces it with its own and saves.
    await openLanding(b);
    await expect(resumeCard(b)).toContainText(
      strings.resume.summary(TOPIC_B, 1, 5),
    );
    await b.getByRole("radio", { name: /^Fixture topic C/ }).click();
    await button(b, strings.landing.start).click();
    await replaceGroup(b)
      .getByRole("button", { name: strings.landing.replaceConfirm })
      .click();
    await expect(h1(b, strings.question.heading(1, 3))).toBeFocused();
    await answerByMouse(b, true);
    // Polled: a write in one tab reaches the other through shared storage.
    await expect
      .poll(async () => (await readSession(a))?.scope)
      .toEqual({ kind: "topic", topicId: "topic-c" });

    // Tab A goes on: its next save wins, without any prompt.
    await nextButton(a).click();
    await expect(h1(a, strings.question.heading(2, 5))).toBeFocused();
    await answerByMouse(a, false);
    await expect
      .poll(async () => {
        const afterA = await readSession(b);
        return { scope: afterA?.scope, answered: afterA?.answers.length };
      })
      .toEqual({ scope: { kind: "topic", topicId: "topic-b" }, answered: 2 });

    // Tab B goes on undisturbed and finishes: its quiz is removed, its best
    // score written.
    await nextButton(b).click();
    await expect(h1(b, strings.question.heading(2, 3))).toBeFocused();
    await answerByMouse(b, true);
    await nextButton(b).click();
    await answerByMouse(b, true);
    await nextButton(b).click();
    await expect(h1(b, strings.results.heading)).toBeFocused();
    await expect.poll(() => readSession(a)).toBeNull();

    // Tab A's next save writes its quiz again (last write wins).
    await nextButton(a).click();
    await expect(h1(a, strings.question.heading(3, 5))).toBeFocused();
    await answerByMouse(a, true);
    expect((await readSession(a))?.answers).toHaveLength(3);

    // Landing in tab B reflects the last write (U9): A's quiz, B's best.
    await backToLanding(b);
    await expect(resumeCard(b)).toContainText(
      strings.resume.summary(TOPIC_B, 3, 5),
    );
    await expect(topicRadio(b, TOPIC_C, 3, 100)).toBeVisible();

    // Data written by the other tab is still validated (US-6.3).
    await writeStorage(b, { [KEYS.session]: "{corrupt" });
    await button(a, strings.question.exit).click();
    await expect(h1(a, strings.landing.heading)).toBeFocused();
    await reloadLanding(a);
    await expect(loadNotice(a)).toHaveText(strings.progress.sessionRemoved);
    await expect(resumeCard(a)).toHaveCount(0);
    await expect(topicRadio(a, TOPIC_C, 3, 100)).toBeVisible();

    // No "changed in another tab" prompt of any kind (US-6.7, R2).
    expect(dialogs).toEqual([]);
    for (const p of [a, b]) {
      await expect(p.getByRole("dialog")).toHaveCount(0);
      await expect(p.getByRole("alertdialog")).toHaveCount(0);
      await expect(p.locator("body")).not.toContainText(/another tab/i);
    }
  });
});

/**
 * Landing with every optional progress element: a valid saved quiz (card)
 * and corrupt best scores (notice). Returns once both are shown.
 */
async function landingWithCardAndNotice(page: Page): Promise<void> {
  await openLanding(page);
  await leaveQuizInProgress(page, /^Fixture topic B/, 5, 1);
  await writeStorage(page, { [KEYS.best]: "corrupt" });
  await reloadLanding(page);
  await expect(resumeCard(page)).toBeVisible();
  await expect(loadNotice(page)).toHaveText(strings.progress.bestRemoved);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`T-45 US-6 Landing axe (${colorScheme})`, () => {
    test.use({ colorScheme });

    test.beforeEach(async ({ page }) => {
      await useFixtureBank(page);
    });

    test(`T-US10-1 T-US13-1 Landing with the resume card, the load notice, and each confirmation open: axe 0 serious/critical (${colorScheme})`, async ({
      page,
    }) => {
      await landingWithCardAndNotice(page);
      expect(
        await page.evaluate(
          () => matchMedia("(prefers-color-scheme: dark)").matches,
        ),
      ).toBe(colorScheme === "dark");
      await expectNoAxeSeriousOrCritical(page, resumeCard(page));

      await page.getByRole("radio", { name: /^Fixture topic C/ }).click();
      await button(page, strings.landing.start).click();
      await expect(replaceGroup(page)).toBeVisible();
      await expectNoAxeSeriousOrCritical(
        page,
        replaceGroup(page).getByRole("button", {
          name: strings.landing.replaceConfirm,
        }),
      );
      await page.keyboard.press("Escape");
      await expect(replaceGroup(page)).toHaveCount(0);

      await resetButton(page).click();
      await expect(resetGroup(page)).toBeVisible();
      await expectNoAxeSeriousOrCritical(
        page,
        resetGroup(page).getByRole("button", {
          name: strings.progress.resetConfirm,
        }),
      );

      // The result text and the discarded text (focused, tabindex -1).
      await resetGroup(page)
        .getByRole("button", { name: strings.progress.resetConfirm })
        .click();
      const done = page.getByText(strings.progress.resetDone, { exact: true });
      await expect(done).toBeFocused();
      await expectNoAxeSeriousOrCritical(page, done);
    });
  });
}

test.describe("T-45 US-6 Landing reflow", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US9-1 at 320 px with the card, the notice and both confirmations open: no horizontal scroll, nothing clipped or overlapping", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await landingWithCardAndNotice(page);
    await page.getByRole("radio", { name: /^Fixture topic C/ }).click();
    await button(page, strings.landing.start).click();
    await expect(replaceGroup(page)).toBeVisible();
    await resetButton(page).click();
    await expect(resetGroup(page)).toBeVisible();
    await expect(replaceGroup(page)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoClippingOrOverlap(page);
  });
});

test.describe("T-45 US-6 Landing CLS with saved data (T-34 method)", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "layout-shift (Layout Instability API) is Chromium-only",
  );

  const DELAY_MS = 1500;

  /**
   * A saved quiz on the reserve-shaped bank: the first two questions of the
   * first generated topic, one answered. Its contentVersion is older than the
   * served bank, so `restoreQuiz` checks IDs and option sets only (decision
   * A4) and restores it (`contentChanged`).
   */
  function savedFor(questionId0?: string): { session: string; topic: string } {
    const reserve = readGeneratedReserve();
    const bank = bankLikeGenerated(reserve);
    const topic = reserve.topicIds[0] ?? "";
    const qs = bank.questions.filter((q) => q.topic === topic).slice(0, 2);
    const ids = qs.map((q) => q.id);
    if (questionId0 !== undefined) ids[0] = questionId0;
    const order = qs.map((q) => q.options.map((o) => o.id));
    const session: StoredSession = {
      schemaVersion: 1,
      contentVersion: "older-content",
      mode: "normal",
      scope: { kind: "topic", topicId: topic },
      seed: 12345,
      questionIds: ids,
      optionOrder: order,
      answers: [{ q: ids[0] ?? "", o: order[0]?.[0] ?? "" }],
      index: 1,
      savedAt: 1_761_200_000_000,
    };
    return { session: JSON.stringify(session), topic };
  }

  async function loadLate(
    page: Page,
    seed: Record<string, string>,
  ): Promise<void> {
    const reserve = readGeneratedReserve();
    await observeLayoutShifts(page);
    await seedStorageBeforeLoad(page, seed);
    await serveSlowBank(page, bankLikeGenerated(reserve), DELAY_MS);
    await page.goto("./");
    await expect(page.locator("main")).toHaveAttribute(
      "data-bank-status",
      "loading",
    );
    await expect(
      page.getByRole("status").filter({ hasText: strings.loading.text }),
    ).toHaveText(strings.loading.text);
    await expect(page.locator("main")).toHaveAttribute(
      "data-bank-status",
      "ready",
      {
        timeout: DELAY_MS + 10_000,
      },
    );
    await expect(
      page.getByRole("group", { name: strings.landing.topicsLegend }),
    ).toBeVisible();
  }

  async function expectCls(page: Page): Promise<void> {
    const report = await readShifts(page);
    expect(report.supported, "layout-shift entries are supported").toBe(true);
    test
      .info()
      .annotations.push({ type: "CLS", description: String(report.cls) });
    expect(
      report.cls,
      `layout shifts: ${JSON.stringify(report.shifts)}`,
    ).toBeLessThan(CLS_LIMIT);
  }

  test(`T-US6-CLS restorable saved quiz, bank after ${String(DELAY_MS)} ms: CLS < ${String(CLS_LIMIT)}`, async ({
    page,
  }) => {
    const { session } = savedFor();
    await loadLate(page, { [KEYS.session]: session });
    const name = readGeneratedReserve().topicNames[0] ?? "";
    await expect(resumeCard(page)).toContainText(
      strings.resume.summary(name, 1, 2),
    );
    await expectNoLoadNotice(page);
    await expectCls(page);
  });

  test(`T-US6-CLS stale saved quiz (unknown question ID), bank after ${String(DELAY_MS)} ms: CLS < ${String(CLS_LIMIT)}`, async ({
    page,
  }) => {
    const { session } = savedFor("question-removed-by-deploy");
    await loadLate(page, { [KEYS.session]: session });
    await expect(loadNotice(page)).toHaveText(strings.progress.sessionRemoved);
    await expect(resumeCard(page)).toHaveCount(0);
    await expectCls(page);
  });

  test(`T-US6-CLS corrupt saved quiz and corrupt best scores, bank after ${String(DELAY_MS)} ms: CLS < ${String(CLS_LIMIT)}`, async ({
    page,
  }) => {
    await loadLate(page, { [KEYS.session]: "{corrupt", [KEYS.best]: "[]" });
    await expect(loadNotice(page)).toHaveText(
      `${strings.progress.sessionRemoved} ${strings.progress.bestRemoved}`,
    );
    await expectCls(page);
  });

  test(`T-US6-CLS best scores for a topic and Mixed plus a restorable quiz, bank after ${String(DELAY_MS)} ms: CLS < ${String(CLS_LIMIT)}`, async ({
    page,
  }) => {
    const reserve = readGeneratedReserve();
    const { session, topic } = savedFor();
    const scores: Record<string, { correct: number; total: number }> = {
      [topic]: { correct: 3, total: 4 },
    };
    if (reserve.eligibleTopicCount > 1) scores.mixed = { correct: 1, total: 2 };
    await loadLate(page, {
      [KEYS.session]: session,
      [KEYS.best]: bestValue(scores),
    });
    await expect(
      page.getByRole("radio", {
        name: new RegExp(`, ${strings.landing.bestScore(75)}$`),
      }),
    ).toBeVisible();
    if (reserve.eligibleTopicCount > 1) {
      await expect(
        page.getByRole("radio", {
          name: new RegExp(`^${MIXED}, .*, ${strings.landing.bestScore(50)}$`),
        }),
      ).toBeVisible();
    }
    await expect(resumeCard(page)).toBeVisible();
    await expectCls(page);
  });
});
