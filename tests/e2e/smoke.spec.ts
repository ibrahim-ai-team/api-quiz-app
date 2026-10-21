/**
 * Shell smoke test (T-03, issue #23). Runs every harness helper against the
 * production build at the base path, with the fixture bank route registered.
 * Test names start with the matrix IDs they cover (docs/qa/ac-test-matrix.md).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import { expectNoCspViolations, trackCspViolations } from "./helpers/csp.ts";
import {
  FIXTURES_DIR,
  useFixtureBank,
  type FixtureBankRoute,
} from "./helpers/fixture-bank.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";
import {
  expectAllSameOrigin,
  goOfflineAfterLoad,
  trackRequests,
} from "./helpers/network.ts";

const BASE_PATH = "/api-quiz-app/";

const fixtureContentVersion = (
  JSON.parse(readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8")) as {
    contentVersion: string;
  }
).contentVersion;

/**
 * Explicit readiness (replaces `networkidle`): the shell sets
 * `data-bank-status` on <main> once the startup bank request has settled
 * (T-06). It is a non-visual, CSP-safe signal, kept by T-08 (decision T-33
 * L6) next to the visible loading, error and Retry states (shell.spec.ts). "ready" also proves the asset was fetched and
 * passed the runtime guard (it is not a data: URL blocked by connect-src).
 */
async function expectBankReady(page: Page): Promise<void> {
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    "ready",
  );
}

/** Tests that deliberately load the real emitted asset (no fixture route). */
const REAL_ASSET_TESTS = new Set(["T-NFR5-1"]);

test.describe("T-03 shell smoke", () => {
  // E2E never depends on real content (standard 12): every test except those
  // in REAL_ASSET_TESTS gets the fixture bank route before navigation.
  let bank: FixtureBankRoute | null = null;
  test.beforeEach(async ({ page }, testInfo) => {
    const id = testInfo.title.split(" ")[0] ?? "";
    bank = REAL_ASSET_TESTS.has(id) ? null : await useFixtureBank(page);
  });

  test("T-03-smoke shell renders at the base path from the production build", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto("./");
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(BASE_PATH);

    await expect(
      page.getByRole("heading", { level: 1, name: strings.landing.heading }),
    ).toBeVisible();
    await expect(page).toHaveTitle(strings.title.landing);
    // The CSP meta exists only in the build output, so this proves that the
    // run is against `vite preview`, not the dev server (V-4).
    await expect(
      page.locator('meta[http-equiv="Content-Security-Policy"]'),
    ).toHaveCount(1);
    // The page loaded the fixture bank, not the real content (standard 12):
    // the request was answered by the route and the app adopted the fixture's
    // contentVersion, and its topic names are shown (T-09).
    await expectBankReady(page);
    await expect(page.locator("main")).toContainText("Fixture topic A");
    await expect(page.locator("main")).toHaveAttribute(
      "data-content-version",
      fixtureContentVersion,
    );
    expect(bank?.hits()).toBeGreaterThanOrEqual(1);
    expect(pageErrors, "uncaught page errors").toEqual([]);
  });

  test("T-NFR2-1 shell has lang=en and 0 serious/critical axe issues", async ({
    page,
  }) => {
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expectNoAxeSeriousOrCritical(
      page,
      page.getByRole("heading", { level: 1, name: strings.landing.heading }),
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
    const requests = trackRequests(context);
    await page.goto("./");
    await expectBankReady(page);
    expectAllSameOrigin(requests, baseURL ?? "");
    expect(await context.cookies()).toEqual([]);
  });

  test("T-NFR5-1 shell raises no CSP violations", async ({ page }) => {
    const csp = await trackCspViolations(page);
    // No fixture route: the real emitted asset must load under the CSP.
    await page.goto("./");
    await expectBankReady(page);
    await expectNoCspViolations(page, csp);
  });

  test("T-NFR7-1 shell makes 0 requests after going offline", async ({
    page,
    context,
  }) => {
    await page.goto("./");
    await expectBankReady(page);
    await goOfflineAfterLoad(page, context, async (p) => {
      // Reload-free interaction: keyboard focus movement and a click.
      await p.keyboard.press("Tab");
      await p.locator("main").click();
    });
    await expect(
      page.getByRole("heading", { level: 1, name: strings.landing.heading }),
    ).toBeVisible();
  });
});
