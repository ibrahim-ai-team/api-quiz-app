/**
 * Quiz-driving helpers for the flow and responsive suites (T-16, issue #36).
 * Fixture bank: topic-a 12, topic-b 5, topic-c 3, topic-d 0. Question order
 * is random per run, so answers are chosen from the fixture's `correct` IDs
 * by `data-question-id` (standard 12), never by position.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { strings } from "../../../src/ui/strings.ts";
import { FIXTURES_DIR } from "./fixture-bank.ts";

export interface FixtureQuestion {
  id: string;
  topic: string;
  correct: string;
  options: { id: string; text: string }[];
}

interface FixtureBank {
  contentVersion: string;
  topics: { id: string; name: string }[];
  questions: FixtureQuestion[];
}

export const FIXTURE = JSON.parse(
  readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8"),
) as FixtureBank;
const QUESTION = new Map(FIXTURE.questions.map((q) => [q.id, q]));
export const TOPIC_NAME = new Map(FIXTURE.topics.map((t) => [t.id, t.name]));

export const CODE_QUESTION_ID = "fixture-c-code-snippet";

export const h1 = (page: Page, name: string): Locator =>
  page.getByRole("heading", { level: 1, name, exact: true });
export const anyH1 = (page: Page): Locator =>
  page.getByRole("heading", { level: 1 });
export const button = (page: Page, name: string): Locator =>
  page.getByRole("button", { name, exact: true });
export const questionView = (page: Page): Locator =>
  page.locator("[data-question-id]");
export const optionsGroup = (page: Page): Locator =>
  page.getByRole("group", { name: strings.question.optionsLegend });
/** Next, or See results on the last question. */
export const nextButton = (page: Page): Locator =>
  page.getByRole("button", {
    name: new RegExp(
      `^(${strings.feedback.next}|${strings.feedback.seeResults})$`,
    ),
  });
export const breakdownHeading = (page: Page): Locator =>
  page.getByRole("heading", {
    level: 2,
    name: strings.results.breakdownHeading,
  });

export async function expectBankStatus(
  page: Page,
  status: "loading" | "ready" | "error",
): Promise<void> {
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    status,
  );
}

/** Opens Landing (optionally at a hash route) and waits for the bank. */
export async function openLanding(page: Page, hash = ""): Promise<void> {
  await page.goto(`./${hash}`);
  await expectBankStatus(page, "ready");
}

/** Selects a topic with the mouse, presses Start and waits for question 1. */
export async function startQuizByMouse(
  page: Page,
  topic: RegExp,
  n: number,
): Promise<void> {
  await page.getByRole("radio", { name: topic }).click();
  await button(page, strings.landing.start).click();
  await expect(h1(page, strings.question.heading(1, n))).toBeFocused();
}

/** The fixture question shown in the question view. */
export async function currentQuestion(page: Page): Promise<FixtureQuestion> {
  const id = (await questionView(page).getAttribute("data-question-id")) ?? "";
  const q = QUESTION.get(id);
  if (q === undefined) throw new Error(`unknown question id "${id}"`);
  return q;
}

/** The option ID to choose for a correct or an incorrect answer. */
export function optionIdFor(q: FixtureQuestion, correct: boolean): string {
  const option = correct
    ? q.options.find((o) => o.id === q.correct)
    : q.options.find((o) => o.id !== q.correct);
  if (option === undefined) throw new Error(`no option for ${q.id}`);
  return option.id;
}

export const radioByValue = (page: Page, optionId: string): Locator =>
  optionsGroup(page).locator(`input[type="radio"][value="${optionId}"]`);

/**
 * Answers the current question with the mouse and submits it. Asserts the
 * verdict panel and that focus moved to Next. Returns the question.
 */
export async function answerByMouse(
  page: Page,
  correct: boolean,
): Promise<FixtureQuestion> {
  const q = await currentQuestion(page);
  await radioByValue(page, optionIdFor(q, correct)).check();
  await button(page, strings.question.submit).click();
  await expect(verdictPanel(page, correct)).toBeVisible();
  await expect(nextButton(page)).toBeFocused();
  return q;
}

export const verdictPanel = (page: Page, correct: boolean): Locator =>
  page.getByRole("region", {
    name: correct ? strings.feedback.correct : strings.feedback.incorrect,
    exact: true,
  });

/**
 * Plays all `n` questions with the mouse; question k (1-based) is answered
 * correctly when `correctAt(k)` is true. Ends on Results with its h1 focused.
 */
export async function playQuizByMouse(
  page: Page,
  n: number,
  correctAt: (k: number) => boolean,
): Promise<FixtureQuestion[]> {
  const played: FixtureQuestion[] = [];
  for (let k = 1; k <= n; k += 1) {
    await expect(h1(page, strings.question.heading(k, n))).toBeFocused();
    played.push(await answerByMouse(page, correctAt(k)));
    await expect(nextButton(page)).toHaveText(
      k < n ? strings.feedback.next : strings.feedback.seeResults,
    );
    await nextButton(page).click();
  }
  await expect(h1(page, strings.results.heading)).toBeFocused();
  await expect(page).toHaveURL(/#\/results$/);
  return played;
}

/**
 * Starts a topic-c quiz and advances with the mouse until `id` is shown.
 * Returns the 1-based position k of that question in the quiz (of 3).
 */
export async function openTopicCQuestion(
  page: Page,
  id: string,
): Promise<number> {
  await startQuizByMouse(page, /^Fixture topic C/, 3);
  for (let k = 1; k <= 3; k += 1) {
    await expect(h1(page, strings.question.heading(k, 3))).toBeFocused();
    if ((await currentQuestion(page)).id === id) return k;
    await answerByMouse(page, true);
    await nextButton(page).click();
  }
  throw new Error(`question ${id} not found in the topic-c quiz`);
}
