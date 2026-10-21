/**
 * App shell, hash router, loading and error states (T-08, issue #28; US-12,
 * US-10.6, FR-25). Runs against the production preview with the fixture bank
 * (standard 12). Test names start with their acceptance-criterion IDs.
 */
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import {
  BANK_URL_GLOB,
  FIXTURES_DIR,
  useFixtureBank,
} from "./helpers/fixture-bank.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";

const FIXTURE_BANK = path.join(FIXTURES_DIR, "bank.json");

function h1(page: Page, name: string) {
  return page.getByRole("heading", { level: 1, name });
}

async function expectBankStatus(page: Page, status: string): Promise<void> {
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    status,
  );
}

/**
 * Bank route whose answer is decided per request: "fail" answers HTTP 500,
 * "ok" serves the fixture, "hold" keeps the request pending until released.
 */
async function controllableBank(page: Page) {
  let mode: "fail" | "ok" | "hold" = "ok";
  const held: Route[] = [];
  let hits = 0;
  const serve = (route: Route) =>
    route.fulfill({ path: FIXTURE_BANK, contentType: "application/json" });
  await page.route(BANK_URL_GLOB, async (route) => {
    hits += 1;
    if (mode === "fail") {
      await route.fulfill({ status: 500, body: "server error" });
    } else if (mode === "hold") {
      held.push(route);
    } else {
      await serve(route);
    }
  });
  return {
    set: (next: typeof mode) => {
      mode = next;
    },
    hits: () => hits,
    releaseHeld: async () => {
      for (const route of held.splice(0)) await serve(route);
    },
  };
}

test.describe("T-08 app shell and routes", () => {
  test("T-US12-2 landing renders with the fixture bank, 0 serious/critical axe issues, no horizontal scroll", async ({
    page,
  }) => {
    const bank = await useFixtureBank(page);
    await page.goto("./");
    await expectBankStatus(page, "ready");
    expect(bank.hits()).toBeGreaterThanOrEqual(1);
    await expect(page).toHaveTitle(strings.title.landing);
    await expect(page.getByRole("banner")).toContainText(strings.appName);
    // First Landing load does not move focus (views.md §0).
    await expect(h1(page, strings.landing.heading)).not.toBeFocused();
    await expectNoAxeSeriousOrCritical(page, h1(page, strings.landing.heading));
    await expectNoHorizontalScroll(page);
  });

  test("T-US12-2 unknown URL shows the 404 view with a link home", async ({
    page,
  }) => {
    await useFixtureBank(page);
    await page.goto("./#/no-such-page");
    const heading = h1(page, strings.notFound.heading);
    await expect(heading).toBeFocused();
    await expect(page).toHaveTitle(strings.title.notFound);
    await expectNoAxeSeriousOrCritical(page, heading);
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: strings.common.home }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(page).toHaveTitle(strings.title.landing);
  });

  test("T-US12-2 unknown topic deep link shows Topic not found without echoing the slug", async ({
    page,
  }) => {
    await useFixtureBank(page);
    await page.goto("./#/topic/no-such-topic");
    await expectBankStatus(page, "ready");
    const heading = h1(page, strings.notFound.topicHeading);
    await expect(heading).toBeFocused();
    await expect(page).toHaveTitle(strings.title.topicNotFound);
    await expect(page.locator("main")).not.toContainText("no-such-topic");
    // Landing variant (views.md §7b): the topic list follows the heading.
    await expect(
      page.getByRole("group", { name: strings.landing.topicsLegend }),
    ).toBeVisible();
    await expectNoAxeSeriousOrCritical(page, heading);
    await expectNoHorizontalScroll(page);
  });

  test("T-US12-3 #/quiz without a quiz in memory redirects to Landing (views.md §2), and an unknown hash survives a refresh as 404", async ({
    page,
  }) => {
    await useFixtureBank(page);
    await page.goto("./#/quiz");
    await expect(page).toHaveURL(/#\/$/);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(page).toHaveTitle(strings.title.landing);

    await page.goto("./#/definitely/not/a/route");
    await page.reload();
    await expect(h1(page, strings.notFound.heading)).toBeVisible();
  });

  test("T-US12-3 static 404.html offers a link home and has no script", async ({
    page,
  }) => {
    await useFixtureBank(page);
    await page.goto("./404.html");
    const heading = h1(page, "Page not found");
    await expect(heading).toBeVisible();
    await expect(page).toHaveTitle(strings.title.notFound);
    await expect(
      page.getByRole("link", { name: strings.common.home }),
    ).toHaveAttribute("href", "/api-quiz-app/");
    await expect(page.locator("script")).toHaveCount(0);
    await expectNoAxeSeriousOrCritical(page, heading);
    await page.getByRole("link", { name: strings.common.home }).click();
    await expect(h1(page, strings.landing.heading)).toBeVisible();
  });

  test("T-US10-6 route changes update the title and move focus to the h1", async ({
    page,
  }) => {
    await useFixtureBank(page);
    await page.goto("./");
    await expectBankStatus(page, "ready");
    await page.evaluate(() => {
      window.location.hash = "#/results";
    });
    await expect(h1(page, strings.placeholder.resultsHeading)).toBeFocused();
    await expect(page).toHaveTitle(strings.title.resultsPlaceholder);
    await page.goBack();
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(page).toHaveTitle(strings.title.landing);
  });

  test("T-US10-6 skip link is the first tab stop and moves focus to main", async ({
    page,
  }) => {
    await useFixtureBank(page);
    await page.goto("./#/results");
    await expect(h1(page, strings.placeholder.resultsHeading)).toBeFocused();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: strings.shell.skipLink });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await expect(page).toHaveURL(/#\/results$/);
  });
});

test.describe("T-08 error boundary in the production build", () => {
  test("T-US12-5 a forced view error shows the app error view and logs nothing to the console (standard 10, SEC-R05 L-1)", async ({
    page,
  }) => {
    await useFixtureBank(page);
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("./");
    await expectBankStatus(page, "ready");
    // Force an error inside a routed view: the next document.title write
    // (the 404 view's title effect) throws once. No app code is changed.
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
    await expect(page).toHaveTitle(strings.title.appError);

    // Home link recovers and focuses the landing h1 (T-08-R01 L1).
    await page.getByRole("link", { name: strings.common.home }).click();
    await expect(h1(page, strings.landing.heading)).toBeFocused();

    expect(consoleMessages, "console errors/warnings").toEqual([]);
    expect(pageErrors, "uncaught page errors").toEqual([]);
  });
});

test.describe("T-08 loading and data error states", () => {
  test("T-US12-5 data failure shows a readable error with Retry; Retry loads the fixed data (FR-25)", async ({
    page,
  }) => {
    const bank = await controllableBank(page);
    bank.set("fail");
    await page.goto("./");
    await expectBankStatus(page, "error");
    const alert = page.getByRole("alert");
    await expect(
      alert.getByRole("heading", { level: 2, name: strings.error.dataHeading }),
    ).toBeVisible();
    await expect(alert).toContainText(strings.error.dataBody);
    await expect(page).toHaveTitle(strings.title.dataError);
    const retry = page.getByRole("button", { name: strings.common.retry });
    await expectNoAxeSeriousOrCritical(page, retry);
    await expectNoHorizontalScroll(page);

    // A failed Retry keeps focus on Retry.
    await retry.click();
    await expectBankStatus(page, "error");
    await expect(retry).toBeFocused();

    bank.set("ok");
    await retry.click();
    await expectBankStatus(page, "ready");
    await expect(page.locator("main")).toHaveAttribute(
      "data-content-version",
      "e2e-fixture-1",
    );
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    await expect(page).toHaveTitle(strings.title.landing);
    expect(bank.hits()).toBe(3);
  });

  test("T-US12-4 slow data: loading text after 300 ms, Still loading with Retry at 10 s, Retry loads", async ({
    page,
  }) => {
    await page.clock.install();
    const bank = await controllableBank(page);
    bank.set("hold");
    await page.goto("./");
    await expectBankStatus(page, "loading");
    const status = page.getByRole("status");
    await expect(status).toBeEmpty();
    await page.clock.runFor(300);
    await expect(status).toHaveText(strings.loading.text);
    await expect(
      page.getByRole("button", { name: strings.common.retry }),
    ).toHaveCount(0);
    await page.clock.runFor(10_000 - 300);
    await expect(status).toHaveText(strings.loading.still);
    const retry = page.getByRole("button", { name: strings.common.retry });
    await expectNoAxeSeriousOrCritical(page, retry);

    bank.set("ok");
    await retry.click();
    await expectBankStatus(page, "ready");
    await expect(h1(page, strings.landing.heading)).toBeFocused();
    // The first, abandoned request is answered late and must be ignored.
    await bank.releaseHeld();
    await expectBankStatus(page, "ready");
  });
});

test.describe("T-US13-1 dark colour scheme", () => {
  test.use({ colorScheme: "dark" });

  test("T-US13-1 landing, 404 and data error pass axe in dark mode", async ({
    page,
  }) => {
    const bank = await controllableBank(page);
    await page.goto("./");
    await expectNoAxeSeriousOrCritical(page, h1(page, strings.landing.heading));
    await page.goto("./#/nope");
    await expectNoAxeSeriousOrCritical(
      page,
      h1(page, strings.notFound.heading),
    );
    bank.set("fail");
    // A new document on Landing (the error view lives in the topic area).
    await page.goto("./");
    await expectBankStatus(page, "error");
    await expectNoAxeSeriousOrCritical(
      page,
      page.getByRole("button", { name: strings.common.retry }),
    );
  });
});
