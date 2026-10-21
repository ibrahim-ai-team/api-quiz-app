/**
 * Shell smoke test (T-03, issue #23). Runs every harness helper against the
 * production build at the base path, with the fixture bank route registered.
 * Test names start with the matrix IDs they cover (docs/qa/ac-test-matrix.md).
 */
import { expect, test } from "@playwright/test";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import { expectNoCspViolations, trackCspViolations } from "./helpers/csp.ts";
import { useFixtureBank } from "./helpers/fixture-bank.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";
import {
  expectAllSameOrigin,
  goOfflineAfterLoad,
  trackRequests,
} from "./helpers/network.ts";

const BASE_PATH = "/api-quiz-app/";

test.describe("T-03 shell smoke", () => {
  test("T-03-smoke shell renders at the base path from the production build", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const bank = await useFixtureBank(page);

    const response = await page.goto("./");
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(BASE_PATH);

    await expect(
      page.getByRole("heading", { level: 1, name: "ApiQuiz" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("ApiQuiz");
    // The CSP meta exists only in the build output, so this proves that the
    // run is against `vite preview`, not the dev server (V-4).
    await expect(
      page.locator('meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveCount(1);
    expect(pageErrors, "uncaught page errors").toEqual([]);
    // The shell does not load a bank yet, so the route must be harmless.
    // T-06 MUST change this to `toBeGreaterThanOrEqual(1)` and assert that
    // the rendered landing shows fixture-sourced content (fixture topic names).
    expect(bank.hits()).toBe(0);
  });

  test("T-NFR2-1 shell has lang=en and 0 serious/critical axe issues", async ({
    page,
  }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expectNoAxeSeriousOrCritical(
      page,
      page.getByRole("heading", { level: 1, name: "ApiQuiz" }),
    );
  });

  test("T-NFR3-1 shell has no horizontal scroll", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("T-NFR4-1 shell makes only same-origin requests and sets no cookies", async ({
    page,
    context,
    baseURL,
  }) => {
    await useFixtureBank(page);
    const requests = trackRequests(context);
    await page.goto("./");
    await page.waitForLoadState("networkidle");
    expectAllSameOrigin(requests, baseURL ?? "");
    expect(await context.cookies()).toEqual([]);
  });

  test("T-NFR5-1 shell raises no CSP violations", async ({ page }) => {
    const csp = await trackCspViolations(page);
    await page.goto("./");
    await page.waitForLoadState("networkidle");
    await expectNoCspViolations(page, csp);
  });

  test("T-NFR7-1 shell makes 0 requests after going offline", async ({
    page,
    context,
  }) => {
    await useFixtureBank(page);
    await page.goto("./");
    await goOfflineAfterLoad(page, context, async (p) => {
      // Reload-free interaction: keyboard focus movement and a click.
      await p.keyboard.press("Tab");
      await p.locator("main").click();
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "ApiQuiz" }),
    ).toBeVisible();
  });
});
