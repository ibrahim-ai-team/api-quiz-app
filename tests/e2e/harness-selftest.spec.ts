/**
 * Harness self-test (T-03): each helper must FAIL on a deliberately injected
 * defect, so a helper that silently passes is caught in CI (same idea as
 * `csp:selftest` and `size:selftest`). Defects are injected at runtime through
 * DOM APIs only; no application code is changed.
 */
import { expect, test } from "@playwright/test";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import { expectNoCspViolations, trackCspViolations } from "./helpers/csp.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";
import { expectAllSameOrigin, goOfflineAfterLoad } from "./helpers/network.ts";

test.describe("T-03 harness self-test: helpers fail on injected defects", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("expectNoHorizontalScroll fails on a 2000px-wide body", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.body.style.minWidth = "2000px";
    });
    await expect(expectNoHorizontalScroll(page)).rejects.toThrow(
      /horizontal scroll/,
    );
  });

  test("expectNoAxeSeriousOrCritical fails on a button without a name", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.querySelector("main")?.append(document.createElement("button"));
    });
    await expect(expectNoAxeSeriousOrCritical(page)).rejects.toThrow(
      /button-name/,
    );
  });

  test("expectAllSameOrigin fails on a third-party request", ({ baseURL }) => {
    const base = baseURL ?? "";
    expect(() => {
      expectAllSameOrigin(
        { urls: [new URL("assets/app.js", base).href, "https://cdn.test/x"] },
        base,
      );
    }).toThrow(/other than/);
    expect(() => {
      expectAllSameOrigin({ urls: [] }, base);
    }).toThrow(/no requests/);
  });

  test("expectNoCspViolations fails on an inline script", async ({ page }) => {
    const csp = await trackCspViolations(page);
    await page.reload();
    await page.evaluate(() => {
      const script = document.createElement("script");
      script.textContent = "void 0;";
      document.body.append(script);
    });
    await expect(expectNoCspViolations(page, csp)).rejects.toThrow(
      /securitypolicyviolation|CSP console errors/,
    );
  });

  test("goOfflineAfterLoad fails when the interaction makes a request", async ({
    page,
    context,
  }) => {
    await expect(
      goOfflineAfterLoad(page, context, async (p) => {
        await p.evaluate(() => {
          void fetch("./selftest-offline.json").catch(() => undefined);
        });
      }),
    ).rejects.toThrow(/requests made after setOffline/);
  });
});
