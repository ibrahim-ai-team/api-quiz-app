/**
 * Every user-visible state of the app, reachable from a fresh page (T-16,
 * issue #36). Shared by the responsive sweep and the axe sweep so both cover
 * exactly the same list. Each `reach` registers its own bank route, drives the
 * app into the state, waits on state (focus, text, `data-bank-status`) and
 * returns a locator of the state, used as the axe readiness locator.
 */
import { expect, type Locator, type Page, type Route } from "@playwright/test";
import { strings } from "../../../src/ui/strings.ts";
// Aliased: the react-hooks lint rule treats any `use*` call as a React hook.
import {
  BANK_URL_GLOB,
  useFixtureBank as serveFixtureBank,
} from "./fixture-bank.ts";
import {
  CODE_QUESTION_ID,
  answerByMouse,
  breakdownHeading,
  button,
  expectBankStatus,
  h1,
  nextButton,
  openLanding,
  openTopicCQuestion,
  playQuizByMouse,
  startQuizByMouse,
} from "./quiz.ts";

export interface AppState {
  /** Short name used in test titles. */
  name: string;
  reach: (page: Page) => Promise<Locator>;
}

const landing: AppState = {
  name: "landing",
  reach: async (page) => {
    await serveFixtureBank(page);
    await openLanding(page);
    return h1(page, strings.landing.heading);
  },
};

const topicNotFound: AppState = {
  name: "topic-not-found",
  reach: async (page) => {
    await serveFixtureBank(page);
    await openLanding(page, "#/topic/no-such-topic");
    const heading = h1(page, strings.notFound.topicHeading);
    await expect(heading).toBeFocused();
    return heading;
  },
};

/** The code-snippet question: the widest content in the fixture. */
const question: AppState = {
  name: "question",
  reach: async (page) => {
    await serveFixtureBank(page);
    await openLanding(page);
    await openTopicCQuestion(page, CODE_QUESTION_ID);
    return button(page, strings.question.submit);
  },
};

function feedback(correct: boolean): AppState {
  return {
    name: correct ? "feedback-correct" : "feedback-incorrect",
    reach: async (page) => {
      await serveFixtureBank(page);
      await openLanding(page);
      await openTopicCQuestion(page, CODE_QUESTION_ID);
      await answerByMouse(page, correct);
      return nextButton(page);
    },
  };
}

const resultsTopic: AppState = {
  name: "results-topic",
  reach: async (page) => {
    await serveFixtureBank(page);
    await openLanding(page);
    await startQuizByMouse(page, /^Fixture topic B/, 5);
    await playQuizByMouse(page, 5, (k) => k % 2 === 1);
    return h1(page, strings.results.heading);
  },
};

const resultsMixed: AppState = {
  name: "results-mixed",
  reach: async (page) => {
    await serveFixtureBank(page);
    await openLanding(page);
    await startQuizByMouse(page, /^Mixed/, 10);
    await playQuizByMouse(page, 10, (k) => k % 3 !== 0);
    await expect(breakdownHeading(page)).toBeVisible();
    return breakdownHeading(page);
  },
};

const notFound: AppState = {
  name: "404",
  reach: async (page) => {
    await serveFixtureBank(page);
    await page.goto("./#/no-such-page");
    const heading = h1(page, strings.notFound.heading);
    await expect(heading).toBeFocused();
    return heading;
  },
};

/**
 * Loading, in its fullest form: "Still loading" plus Retry after 10 s. The
 * clock is installed so no real time passes; the bank request stays pending
 * until the page closes.
 */
const loading: AppState = {
  name: "loading",
  reach: async (page) => {
    await page.clock.install();
    const held: Route[] = [];
    await page.route(BANK_URL_GLOB, (route) => {
      held.push(route);
    });
    await page.goto("./");
    await expectBankStatus(page, "loading");
    await page.clock.runFor(10_000);
    await expect(page.getByRole("status")).toHaveText(strings.loading.still);
    const retry = page.getByRole("button", { name: strings.common.retry });
    await expect(retry).toBeVisible();
    return retry;
  },
};

const dataError: AppState = {
  name: "error",
  reach: async (page) => {
    await page.route(BANK_URL_GLOB, (route) =>
      route.fulfill({ status: 500, body: "server error" }),
    );
    await page.goto("./");
    await expectBankStatus(page, "error");
    await expect(page.getByRole("alert")).toContainText(
      strings.error.dataHeading,
    );
    return page.getByRole("button", { name: strings.common.retry });
  },
};

/**
 * The app error view (error boundary), forced without changing app code as in
 * shell.spec.ts: the next `document.title` write (the 404 view's title
 * effect) throws once.
 */
const appError: AppState = {
  name: "app-error",
  reach: async (page) => {
    await serveFixtureBank(page);
    await openLanding(page);
    await page.evaluate(() => {
      const proto = Object.getOwnPropertyDescriptor(
        Document.prototype,
        "title",
      );
      let failed = false;
      Object.defineProperty(document, "title", {
        configurable: true,
        get: () => proto?.get?.call(document) as string,
        set: (value: string) => {
          if (!failed) {
            failed = true;
            throw new Error("forced view error");
          }
          proto?.set?.call(document, value);
        },
      });
      window.location.hash = "#/no-such-page";
    });
    const heading = h1(page, strings.error.appHeading);
    await expect(heading).toBeFocused();
    return heading;
  },
};

export const STATES = {
  landing,
  topicNotFound,
  question,
  feedbackCorrect: feedback(true),
  feedbackIncorrect: feedback(false),
  resultsTopic,
  resultsMixed,
  notFound,
  loading,
  dataError,
  appError,
} as const;

/** All states, in journey order. */
export const ALL_STATES: readonly AppState[] = Object.values(STATES);
