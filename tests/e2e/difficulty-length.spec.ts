/**
 * Difficulty filter and quiz length (T-50, issue #139; US-11, GitHub #16;
 * views.md §10, copy.md landing.difficulty* / landing.length* /
 * landing.shortHint / landing.noneHint / results.filteredNote).
 *
 * Written against the design before the UI (T-49, #138) and on the T-48
 * interface (#137). Sponsor decisions applied: a filtered or short quiz does
 * not count toward the best score (Results shows results.filteredNote); the
 * settings live for the page load only (reset on reload); no deep-link
 * parameters; no hint with default settings; the resume card is unchanged
 * (resume.summaryDifficulty is cut); "Start a full quiz" uses the defaults
 * (All, 10); Try again keeps difficulty and question count.
 *
 * Fixture bank (tests/e2e/fixtures/bank.json), by difficulty:
 * - topic-a 12: 5 easy, 4 medium, 3 hard (fixture-a-q05, -q08, -q11)
 * - topic-b 5: 1 easy, 1 medium, 3 hard
 * - topic-c 3: 1 easy, 1 medium, 1 hard (fixture-c-true-false)
 * - topic-d 0 (not shown); Mixed 20: 7 easy, 6 medium, 7 hard
 * The 0-match state (US-11.2) uses a routed copy of the bank without
 * topic-c's hard question; no fixture file is changed.
 *
 * The CLS < 0.01 check of #139 is the existing landing-cls.spec.ts, run
 * unchanged once T-49 lands (the reserve includes both groups, §10.3).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import {
  BANK_URL_GLOB,
  FIXTURES_DIR,
  useFixtureBank,
} from "./helpers/fixture-bank.ts";
import {
  bestValue,
  KEYS,
  readSession,
  readStorage,
  resumeCard,
  seedStorageBeforeLoad,
  topicRadio,
} from "./helpers/progress.ts";
import {
  answerByMouse,
  button,
  currentQuestion,
  h1,
  nextButton,
  openLanding,
  playQuizByMouse,
  TOPIC_NAME,
  type FixtureQuestion,
} from "./helpers/quiz.ts";

type Difficulty = "easy" | "medium" | "hard";

const L = strings.landing;
/** Hint copy from src/ui/strings.ts, keyed by difficulty (the word form). */
const shortHint = (n: number, difficulty?: Difficulty): string =>
  L.shortHint(
    n,
    difficulty === undefined ? undefined : L.difficultyWord[difficulty],
  );
const noneHint = (difficulty: Difficulty): string =>
  L.noneHint(L.difficultyWord[difficulty]);
const FILTERED_NOTE = strings.results.filteredNote;

interface BankQuestion {
  id: string;
  topic: string;
  difficulty: Difficulty;
}
interface Bank {
  topics: { id: string; name: string }[];
  questions: BankQuestion[];
}

const BANK = JSON.parse(
  readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8"),
) as Bank;
const DIFFICULTY = new Map(BANK.questions.map((q) => [q.id, q.difficulty]));

function count(topic: string | null, difficulty?: Difficulty): number {
  return BANK.questions.filter(
    (q) =>
      (topic === null || q.topic === topic) &&
      (difficulty === undefined || q.difficulty === difficulty),
  ).length;
}

// Fixture-derived expectations (fail loudly if the fixture ever changes).
const A_HARD = count("topic-a", "hard"); // 3
const A_EASY = count("topic-a", "easy"); // 5
const A_ALL = count("topic-a"); // 12
const B_HARD = count("topic-b", "hard"); // 3
const C_HARD = count("topic-c", "hard"); // 1
const MIXED_HARD = count(null, "hard"); // 7
const HARD_IDS_A = BANK.questions
  .filter((q) => q.topic === "topic-a" && q.difficulty === "hard")
  .map((q) => q.id)
  .sort();
const C_HARD_ID = "fixture-c-true-false";

const TOPIC_A = TOPIC_NAME.get("topic-a") ?? "";
const TOPIC_B = TOPIC_NAME.get("topic-b") ?? "";
const TOPIC_C = TOPIC_NAME.get("topic-c") ?? "";
const MIXED = strings.landing.mixedLabel;

const difficultyGroup = (page: Page): Locator =>
  page.getByRole("group", { name: L.difficultyLegend, exact: true });
const lengthGroup = (page: Page): Locator =>
  page.getByRole("group", { name: L.lengthLegend, exact: true });
const difficultyRadio = (page: Page, d: Difficulty | "all"): Locator =>
  difficultyGroup(page).getByRole("radio", {
    name: d === "all" ? L.difficultyAll : L.difficulty[d],
    exact: true,
  });
const lengthRadio = (page: Page, n: 5 | 10 | 20): Locator =>
  lengthGroup(page).getByRole("radio", { name: String(n), exact: true });
const start = (page: Page): Locator => button(page, strings.landing.start);
const topic = (page: Page, name: RegExp): Locator =>
  page
    .getByRole("group", { name: strings.landing.topicsLegend })
    .getByRole("radio", { name });

/** Defaults are checked (F1, F6): All and 10. */
async function expectDefaultSettings(page: Page): Promise<void> {
  await expect(difficultyRadio(page, "all")).toBeChecked();
  await expect(lengthRadio(page, 10)).toBeChecked();
  for (const d of ["easy", "medium", "hard"] as const) {
    await expect(difficultyRadio(page, d)).not.toBeChecked();
  }
  await expect(lengthRadio(page, 5)).not.toBeChecked();
  await expect(lengthRadio(page, 20)).not.toBeChecked();
}

/** No shortfall or none hint anywhere on Landing. */
async function expectNoSettingsHint(page: Page): Promise<void> {
  const main = page.locator("main");
  await expect(main).not.toContainText(/are available, so this quiz will have/);
  await expect(main).not.toContainText(/questions for this choice/);
}

/** Selects topic, difficulty and length with the mouse (no Start). */
async function choose(
  page: Page,
  topicName: RegExp,
  d: Difficulty | "all",
  n: 5 | 10 | 20,
): Promise<void> {
  await topic(page, topicName).click();
  await difficultyRadio(page, d).click();
  await lengthRadio(page, n).click();
  await expect(difficultyRadio(page, d)).toBeChecked();
  await expect(lengthRadio(page, n)).toBeChecked();
}

async function startAndExpect(page: Page, total: number): Promise<void> {
  await start(page).click();
  await expect(h1(page, strings.question.heading(1, total))).toBeFocused();
}

function expectAllOf(played: FixtureQuestion[], d: Difficulty): void {
  for (const q of played) {
    expect(DIFFICULTY.get(q.id), `difficulty of ${q.id}`).toBe(d);
  }
}

/** Serves the fixture bank without topic-c's hard question (0-match bank). */
async function useBankWithoutTopicCHard(page: Page): Promise<void> {
  const raw = JSON.parse(
    readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8"),
  ) as { questions: { id: string }[] };
  const body = JSON.stringify({
    ...raw,
    questions: raw.questions.filter((q) => q.id !== C_HARD_ID),
  });
  await page.route(BANK_URL_GLOB, async (route) => {
    await route.fulfill({ body, contentType: "application/json" });
  });
}

async function backToLanding(page: Page): Promise<void> {
  await button(page, strings.results.chooseAnother).click();
  await expect(h1(page, strings.landing.heading)).toBeFocused();
}

async function reloadLanding(page: Page): Promise<void> {
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    "ready",
  );
}

test("fixture difficulty distribution matches the spec's expectations", () => {
  expect([A_ALL, A_EASY, A_HARD, B_HARD, C_HARD, MIXED_HARD]).toEqual([
    12, 5, 3, 3, 1, 7,
  ]);
  expect(HARD_IDS_A).toEqual([
    "fixture-a-q05",
    "fixture-a-q08",
    "fixture-a-q11",
  ]);
  expect(DIFFICULTY.get(C_HARD_ID)).toBe("hard");
  expect(count("topic-c")).toBe(3);
});

test.describe("T-50 US-11 difficulty filter and quiz length", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US11-1 topic-a + Hard + 5: shortfall hint before Start, then only the known hard prompts; axe clean", async ({
    page,
  }) => {
    await openLanding(page);
    await expect(difficultyGroup(page)).toBeVisible();
    await expect(lengthGroup(page)).toBeVisible();
    await expectDefaultSettings(page);

    await choose(page, /^Fixture topic A/, "hard", 5);
    const hint = shortHint(A_HARD, "hard");
    await expect(page.getByText(hint, { exact: true })).toBeVisible();
    await expect(start(page)).not.toHaveAttribute("aria-disabled", "true");
    await expect(start(page)).toHaveAccessibleDescription(hint);
    await expectNoAxeSeriousOrCritical(page, page.getByText(hint));

    await startAndExpect(page, A_HARD);
    const played = await playQuizByMouse(page, A_HARD, () => true);
    expect(played.map((q) => q.id).sort()).toEqual(HARD_IDS_A);
  });

  test("T-US11-1 row counts follow the difficulty; no hint with default settings; All + short length states the real number", async ({
    page,
  }) => {
    await openLanding(page);
    await difficultyRadio(page, "hard").click();
    await expect(topicRadio(page, TOPIC_A, A_HARD, null)).toBeVisible();
    await expect(topicRadio(page, TOPIC_B, B_HARD, null)).toBeVisible();
    await expect(topicRadio(page, TOPIC_C, C_HARD, null)).toBeVisible();
    await expect(topicRadio(page, MIXED, MIXED_HARD, null)).toBeVisible();

    // Mixed + Hard + 20 starts with the 7 hard questions, said first.
    await choose(page, /^Mixed/, "hard", 20);
    await expect(start(page)).toHaveAccessibleDescription(
      shortHint(MIXED_HARD, "hard"),
    );

    // Back to the defaults: topic-c has 3 < 10 questions, but no hint.
    await difficultyRadio(page, "all").click();
    await lengthRadio(page, 10).click();
    await topic(page, /^Fixture topic C/).click();
    await expect(topicRadio(page, TOPIC_C, 3, null)).toBeVisible();
    await expectNoSettingsHint(page);
    await expect(start(page)).toHaveAccessibleDescription("");

    // A changed length states the real number (with All: no difficulty word).
    await lengthRadio(page, 5).click();
    await expect(start(page)).toHaveAccessibleDescription(shortHint(3));

    // Enough questions: no hint (topic-a Easy + 5 = 5 easy questions).
    await choose(page, /^Fixture topic A/, "easy", 5);
    await expectNoSettingsHint(page);
  });

  test("T-US11-1 keyboard path: topic, Hard, 5, Start (3 Tab stops plus arrows)", async ({
    page,
  }) => {
    await openLanding(page);
    const first = topic(page, /^Fixture topic A/);
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();

    await page.keyboard.press("Tab");
    await expect(difficultyRadio(page, "all")).toBeFocused();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowRight");
    await expect(difficultyRadio(page, "hard")).toBeFocused();
    await expect(difficultyRadio(page, "hard")).toBeChecked();

    await page.keyboard.press("Tab");
    await expect(lengthRadio(page, 10)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(lengthRadio(page, 5)).toBeFocused();
    await expect(lengthRadio(page, 5)).toBeChecked();

    await page.keyboard.press("Tab");
    await expect(start(page)).toBeFocused();
    await expect(start(page)).toHaveAccessibleDescription(
      shortHint(A_HARD, "hard"),
    );
    await page.keyboard.press("Enter");
    await expect(h1(page, strings.question.heading(1, A_HARD))).toBeFocused();
    expect(DIFFICULTY.get((await currentQuestion(page)).id)).toBe("hard");
  });

  test("T-US11-3 a filtered quiz shows the Results note and does not change the best score; a short All quiz neither", async ({
    page,
  }) => {
    const seeded = bestValue({ "topic-a": { correct: 6, total: 12 } });
    await seedStorageBeforeLoad(page, { [KEYS.best]: seeded });
    await openLanding(page);
    await expect(topicRadio(page, TOPIC_A, A_ALL, 50)).toBeVisible();

    // Hard + 5: 3 hard questions, all correct (100%).
    await choose(page, /^Fixture topic A/, "hard", 5);
    await startAndExpect(page, A_HARD);
    await playQuizByMouse(page, A_HARD, () => true);
    await expect(page.getByText(FILTERED_NOTE, { exact: true })).toBeVisible();
    expect((await readStorage(page))[KEYS.best]).toBe(seeded);

    // Settings kept within the page load (F6); the best score is unchanged.
    await backToLanding(page);
    await expect(difficultyRadio(page, "hard")).toBeChecked();
    await expect(lengthRadio(page, 5)).toBeChecked();
    await expect(topicRadio(page, TOPIC_A, A_HARD, 50)).toBeVisible();

    // All + 5 (fewer than a default quiz): also does not count.
    await choose(page, /^Fixture topic A/, "all", 5);
    await startAndExpect(page, 5);
    await playQuizByMouse(page, 5, () => true);
    await expect(page.getByText(FILTERED_NOTE, { exact: true })).toBeVisible();
    expect((await readStorage(page))[KEYS.best]).toBe(seeded);
    await backToLanding(page);
    await expect(topicRadio(page, TOPIC_A, A_ALL, 50)).toBeVisible();

    // A default quiz (All, 10) still counts and shows no note.
    await choose(page, /^Fixture topic A/, "all", 10);
    await startAndExpect(page, 10);
    await playQuizByMouse(page, 10, () => true);
    await expect(page.locator("main")).not.toContainText(FILTERED_NOTE);
    await backToLanding(page);
    await expect(topicRadio(page, TOPIC_A, A_ALL, 100)).toBeVisible();
  });

  test("T-US11-3 reload resets the settings; Resume continues the filtered quiz with an unchanged card; it still does not count", async ({
    page,
  }) => {
    await openLanding(page);
    await choose(page, /^Fixture topic A/, "hard", 5);
    await startAndExpect(page, A_HARD);
    const q1 = await answerByMouse(page, true);
    expect(DIFFICULTY.get(q1.id)).toBe("hard");
    await nextButton(page).click();
    await expect(h1(page, strings.question.heading(2, A_HARD))).toBeFocused();
    // T-48 interface (#137): the saved session carries the difficulty.
    const saved = await readSession(page);
    expect(saved).toMatchObject({ difficulty: "hard" });

    await reloadLanding(page);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    // F6: the page-load settings are back to the defaults.
    await expectDefaultSettings(page);
    await expectNoSettingsHint(page);
    // resume.summaryDifficulty is cut: the card reads as before US-11.
    const card = resumeCard(page);
    await expect(card).toContainText(
      strings.resume.summary(TOPIC_A, 1, A_HARD),
    );
    await card.getByRole("button", { name: strings.resume.resume }).click();
    await expect(h1(page, strings.question.heading(2, A_HARD))).toBeFocused();

    const rest: string[] = [q1.id];
    for (let k = 2; k <= A_HARD; k += 1) {
      await expect(h1(page, strings.question.heading(k, A_HARD))).toBeFocused();
      rest.push((await answerByMouse(page, true)).id);
      await nextButton(page).click();
    }
    await expect(h1(page, strings.results.heading)).toBeFocused();
    expect(rest.sort()).toEqual(HARD_IDS_A);
    await expect(page.getByText(FILTERED_NOTE, { exact: true })).toBeVisible();
    expect((await readStorage(page))[KEYS.best]).toBeUndefined();
  });

  test("T-US11-3 Try again keeps difficulty and question count", async ({
    page,
  }) => {
    await openLanding(page);
    // topic-a Easy + 5: exactly 5 easy questions, so the length is not capped.
    await choose(page, /^Fixture topic A/, "easy", 5);
    await expectNoSettingsHint(page);
    await startAndExpect(page, 5);
    expectAllOf(await playQuizByMouse(page, 5, () => true), "easy");
    await button(page, strings.results.tryAgain).click();
    await expect(h1(page, strings.question.heading(1, 5))).toBeFocused();
    expectAllOf(await playQuizByMouse(page, 5, () => true), "easy");
    await expect(page.getByText(FILTERED_NOTE, { exact: true })).toBeVisible();
  });

  test("T-US11-3 Start a full quiz on retry results uses the defaults (All, 10)", async ({
    page,
  }) => {
    await openLanding(page);
    await choose(page, /^Fixture topic A/, "hard", 5);
    await startAndExpect(page, A_HARD);
    await playQuizByMouse(page, A_HARD, () => false);
    await button(page, strings.results.retryMissed(A_HARD)).click();
    for (let k = 1; k <= A_HARD; k += 1) {
      await expect(h1(page, strings.question.heading(k, A_HARD))).toBeFocused();
      await answerByMouse(page, true);
      await nextButton(page).click();
    }
    await expect(h1(page, strings.results.retryHeading)).toBeFocused();
    await button(page, strings.results.startFull).click();
    // 10 questions: only possible with All (topic-a has 3 hard) and length 10.
    await expect(h1(page, strings.question.heading(1, 10))).toBeFocused();
  });

  test("T-US11 deep link has no settings: #/topic/topic-a shows the defaults and no hint", async ({
    page,
  }) => {
    await openLanding(page, "#/topic/topic-a");
    await expect(topic(page, /^Fixture topic A/)).toBeChecked();
    await expectDefaultSettings(page);
    await expectNoSettingsHint(page);
  });
});

test.describe("T-50 US-11.2 no matching question (routed bank without topic-c's hard question)", () => {
  test.beforeEach(async ({ page }) => {
    await useBankWithoutTopicCHard(page);
  });

  test("T-US11-2 topic-c + Hard: Start unavailable with the explanation, activation does nothing; axe clean; another difficulty recovers", async ({
    page,
  }) => {
    await openLanding(page);
    await choose(page, /^Fixture topic C/, "hard", 5);
    await expect(topicRadio(page, TOPIC_C, 0, null)).toBeChecked();
    const none = noneHint("hard");
    await expect(page.getByText(none, { exact: true })).toBeVisible();
    await expect(start(page)).toHaveAttribute("aria-disabled", "true");
    await expect(start(page)).toHaveAccessibleDescription(none);

    // Playwright's click refuses aria-disabled elements: use the keyboard.
    await start(page).focus();
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/#\/quiz$/);
    await expect(h1(page, strings.landing.heading)).toBeVisible();
    await expectNoAxeSeriousOrCritical(page, page.getByText(none));

    // Easy has 1 question: Start is available again with the shortfall hint.
    await difficultyRadio(page, "easy").click();
    await expect(start(page)).not.toHaveAttribute("aria-disabled", "true");
    await expect(start(page)).toHaveAccessibleDescription(shortHint(1, "easy"));
    await startAndExpect(page, 1);
  });
});
