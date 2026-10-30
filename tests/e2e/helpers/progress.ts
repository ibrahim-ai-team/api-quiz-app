/**
 * Saved-progress helpers for the US-6 E2E suite (T-45, issue #108; views.md
 * §9). Storage is read and written through `page.evaluate` on the app's own
 * origin, so the tests see exactly what the app stored. Only the key
 * constants come from `src/storage` (the stored shape is checked here, not
 * re-implemented).
 */
import { expect, type Locator, type Page } from "@playwright/test";
import {
  APP_KEY_PREFIX,
  KEYS,
  MAX_VALUE_LENGTH,
} from "../../../src/storage/ProgressStore.ts";
import { strings } from "../../../src/ui/strings.ts";
import {
  answerByMouse,
  button,
  h1,
  nextButton,
  startQuizByMouse,
} from "./quiz.ts";

export { APP_KEY_PREFIX, KEYS, MAX_VALUE_LENGTH };

/** `apiquiz:v1:session` as written by the T-41 codec. */
export interface StoredSession {
  schemaVersion: number;
  contentVersion: string;
  mode: "normal" | "retry-missed";
  scope: { kind: "topic"; topicId: string } | { kind: "mixed" };
  seed: number;
  questionIds: string[];
  optionOrder: string[][];
  answers: { q: string; o: string }[];
  index: number;
  savedAt: number;
}

/** Every `localStorage` entry of the page's origin. */
export async function readStorage(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null) out[key] = localStorage.getItem(key) ?? "";
    }
    return out;
  });
}

/** Sets (string) or removes (null) `localStorage` entries. */
export async function writeStorage(
  page: Page,
  entries: Record<string, string | null>,
): Promise<void> {
  await page.evaluate((all) => {
    for (const [key, value] of Object.entries(all)) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  }, entries);
}

/** The stored session, parsed, or null when the key is absent. */
export async function readSession(page: Page): Promise<StoredSession | null> {
  const raw = (await readStorage(page))[KEYS.session];
  return raw === undefined ? null : (JSON.parse(raw) as StoredSession);
}

/**
 * Seeds `localStorage` before the app's first script runs (views.md §9.2: the
 * startup decode happens before the first render). Runs once per tab: the
 * guard lives in `sessionStorage`, so a reload does not seed again.
 */
export async function seedStorageBeforeLoad(
  page: Page,
  entries: Record<string, string>,
): Promise<void> {
  await page.addInitScript((all: Record<string, string>) => {
    if (location.protocol !== "http:" && location.protocol !== "https:") {
      return;
    }
    const guard = "e2e-seeded";
    if (sessionStorage.getItem(guard) !== null) return;
    sessionStorage.setItem(guard, "1");
    for (const [key, value] of Object.entries(all)) {
      localStorage.setItem(key, value);
    }
  }, entries);
}

declare global {
  interface Window {
    /** Set by tests: app writes (`apiquiz:v1:*`) throw a quota error. */
    __e2eFailAppWrites?: boolean;
  }
}

/**
 * Write errors after a successful start-up probe (US-6.5, views.md §9.1 U2):
 * while `window.__e2eFailAppWrites` is true, `setItem` of an `apiquiz:v1:`
 * key throws `QuotaExceededError`. The probe key `apiquiz:probe` still works,
 * so the app starts with persistent storage. Installed on every load, off.
 */
export async function installFailingAppWrites(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__e2eFailAppWrites = false;
    const original = Object.getOwnPropertyDescriptor(
      Storage.prototype,
      "setItem",
    )?.value as (this: Storage, key: string, value: string) => void;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (window.__e2eFailAppWrites === true && key.startsWith("apiquiz:v1:")) {
        throw new DOMException("quota exceeded (E2E)", "QuotaExceededError");
      }
      original.call(this, key, value);
    };
  });
}

export async function setFailAppWrites(page: Page, on: boolean): Promise<void> {
  await page.evaluate((value) => {
    window.__e2eFailAppWrites = value;
  }, on);
}

/** How storage is made unusable for the US-6.5 memory-only mode. */
export type UnavailableMode = "getter-throws" | "setitem-throws";

/**
 * Makes `localStorage` unusable before any app script runs, the way private
 * modes and blocked site data do:
 * - `getter-throws`: reading `window.localStorage` throws `SecurityError`
 *   (storage disabled);
 * - `setitem-throws`: every `setItem` throws `QuotaExceededError` (full
 *   quota, or a zero quota as in old Safari private mode).
 */
export async function makeStorageUnavailable(
  page: Page,
  mode: UnavailableMode,
): Promise<void> {
  await page.addInitScript((m: UnavailableMode) => {
    if (m === "setitem-throws") {
      Storage.prototype.setItem = function setItem() {
        throw new DOMException("quota exceeded (E2E)", "QuotaExceededError");
      };
      return;
    }
    const deny = {
      configurable: true,
      get() {
        throw new DOMException("storage disabled (E2E)", "SecurityError");
      },
    };
    Object.defineProperty(window, "localStorage", deny);
  }, mode);
}

/** The resume card: a region named by its h2 (views.md §9.4). */
export const resumeCard = (page: Page): Locator =>
  page.getByRole("region", { name: strings.resume.heading, exact: true });

/**
 * The visible load notice. The status region is the one that holds a
 * progress sentence; the invisible reserve copy is `aria-hidden`, so role
 * queries never match it.
 */
export const loadNotice = (page: Page): Locator =>
  page
    .getByRole("status")
    .filter({ hasText: strings.progress.sessionRemoved })
    .or(
      page
        .getByRole("status")
        .filter({ hasText: strings.progress.bestRemoved }),
    );

/** Any progress sentence in any status region (for absence checks). */
export async function expectNoLoadNotice(page: Page): Promise<void> {
  for (const status of await page.getByRole("status").all()) {
    await expect(status).not.toContainText(strings.progress.sessionRemoved);
    await expect(status).not.toContainText(strings.progress.bestRemoved);
  }
}

export const progressSection = (page: Page): Locator =>
  page.getByRole("region", { name: strings.progress.heading, exact: true });

export const resetButton = (page: Page): Locator =>
  button(page, strings.progress.reset);

export const replaceGroup = (page: Page): Locator =>
  page.getByRole("group", { name: strings.landing.replaceMessage });

export const resetGroup = (page: Page): Locator =>
  page.getByRole("group", { name: strings.progress.resetMessage });

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The topic (or Mixed) radio, matched by its full accessible name (§9.3):
 * "{name}, {count}" plus ", Best score: N%" when `best` is a number. With
 * `best: null` the name must end at the count (no best score).
 */
export function topicRadio(
  page: Page,
  name: string,
  count: number,
  best: number | null,
): Locator {
  const base = `${name}, ${strings.landing.topicCount(count)}`;
  const full =
    best === null ? base : `${base}, ${strings.landing.bestScore(best)}`;
  return page.getByRole("radio", {
    name: new RegExp(`^${escapeRegExp(full)}$`),
  });
}

/** No row on Landing shows a best score (name or visible text). */
export async function expectNoBestScores(page: Page): Promise<void> {
  const group = page.getByRole("group", { name: strings.landing.topicsLegend });
  await expect(group).toBeVisible();
  await expect(group.getByRole("radio", { name: /Best score/ })).toHaveCount(0);
  await expect(group).not.toContainText("Best score");
}

/**
 * Starts a quiz, answers the first `answered` questions (correct when
 * `correctAt(k)`, `answered < n`), moves on to the next question with Next,
 * then Exits. Landing then offers the quiz (U3). Returns the session as
 * stored before Exit.
 */
export async function leaveQuizInProgress(
  page: Page,
  topic: RegExp,
  n: number,
  answered: number,
  correctAt: (k: number) => boolean = () => true,
): Promise<StoredSession> {
  await startQuizByMouse(page, topic, n);
  for (let k = 1; k <= answered; k += 1) {
    await answerByMouse(page, correctAt(k));
    await nextButton(page).click();
    await expect(h1(page, strings.question.heading(k + 1, n))).toBeFocused();
  }
  const saved = await readSession(page);
  expect(saved, "session saved after the first Submit").not.toBeNull();
  await button(page, strings.question.exit).click();
  await expect(h1(page, strings.landing.heading)).toBeFocused();
  await expect(resumeCard(page)).toBeVisible();
  if (saved === null) throw new Error("no saved session");
  return saved;
}

/** A best-score value as the T-41 codec writes it. */
export function bestValue(
  scores: Record<string, { correct: number; total: number }>,
  schemaVersion = 1,
): string {
  const out: Record<string, unknown> = {};
  for (const [key, { correct, total }] of Object.entries(scores)) {
    out[key] = {
      percent: Math.floor((correct * 100) / total + 0.5),
      correct,
      total,
      at: 1_761_200_000_000,
    };
  }
  return JSON.stringify({ schemaVersion, scores: out });
}
