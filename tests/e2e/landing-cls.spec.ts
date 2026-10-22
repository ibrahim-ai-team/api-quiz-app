/**
 * Landing layout stability (T-34, issue #81; T-18 baseline section 4). The
 * topic area used to grow when the bank arrived after first paint and push
 * "About the questions" down (Lighthouse CLS 0.161). The bank response is
 * delayed with `page.route`, so the late-bank path runs every time instead of
 * depending on a timing race. CLS is the sum of every `layout-shift` entry
 * without recent input, which is stricter than the session-window CLS that
 * Lighthouse reports.
 */
import { expect, test, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import { BANK_URL_GLOB, FIXTURES_DIR } from "./helpers/fixture-bank.ts";
import path from "node:path";

const CLS_LIMIT = 0.01;

interface ShiftReport {
  cls: number;
  shifts: { value: number; sources: string[] }[];
}

declare global {
  interface Window {
    __shifts?: ShiftReport["shifts"];
  }
}

/** Serves the fixture bank after `delayMs`, so it lands after first paint. */
async function serveSlowFixtureBank(
  page: Page,
  delayMs: number,
): Promise<void> {
  const file = path.join(FIXTURES_DIR, "bank.json");
  await page.route(BANK_URL_GLOB, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ path: file, contentType: "application/json" });
  });
}

/** Records layout shifts from navigation start (buffered observer). */
async function observeLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__shifts = [];
    const describe = (node: Node | null): string => {
      if (!(node instanceof Element)) return String(node?.nodeName);
      const text = node.textContent.trim().slice(0, 40);
      return `${node.tagName.toLowerCase()} "${text}"`;
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: { node: Node | null }[];
      })[]) {
        if (entry.hadRecentInput) continue;
        window.__shifts?.push({
          value: entry.value,
          sources: (entry.sources ?? []).map((s) => describe(s.node)),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function readShifts(page: Page): Promise<ShiftReport> {
  // Two frames after the last render, so a pending shift is reported.
  return page.evaluate(
    () =>
      new Promise<ShiftReport>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const shifts = window.__shifts ?? [];
              resolve({
                cls: shifts.reduce((sum, s) => sum + s.value, 0),
                shifts,
              });
            }, 100);
          });
        });
      }),
  );
}

async function loadLandingLate(
  page: Page,
  delayMs: number,
  hash = "",
): Promise<ShiftReport> {
  await observeLayoutShifts(page);
  await serveSlowFixtureBank(page, delayMs);
  await page.goto(`./${hash}`);
  if (delayMs > 300) {
    // The page is painted while the bank is still loading, and the loading
    // text still appears after 300 ms in its role="status" region.
    await expect(page.locator("main")).toHaveAttribute(
      "data-bank-status",
      "loading",
    );
    await expect(page.getByRole("status")).toHaveText(strings.loading.text);
  }
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    "ready",
    { timeout: delayMs + 10_000 },
  );
  await expect(
    page.getByRole("group", { name: strings.landing.topicsLegend }),
  ).toBeVisible();
  const report = await readShifts(page);
  // Recorded for the report (T-34 evidence), whether the assertion passes.
  test.info().annotations.push({
    type: "CLS",
    description: String(report.cls),
  });
  return report;
}

test.describe("T-34 Landing CLS: the topic area does not move later content", () => {
  for (const delayMs of [1500, 150]) {
    test(`T-34-CLS bank answered after ${String(delayMs)} ms: CLS < ${String(CLS_LIMIT)}`, async ({
      page,
    }) => {
      const report = await loadLandingLate(page, delayMs);
      expect(
        report.cls,
        `layout shifts: ${JSON.stringify(report.shifts)}`,
      ).toBeLessThan(CLS_LIMIT);
    });
  }

  test(`T-34-CLS deep link #/topic/topic-b, bank after 1500 ms: CLS < ${String(CLS_LIMIT)}`, async ({
    page,
  }) => {
    const report = await loadLandingLate(page, 1500, "#/topic/topic-b");
    await expect(
      page.getByRole("radio", { name: /^Fixture topic B/ }),
    ).toBeChecked();
    expect(
      report.cls,
      `layout shifts: ${JSON.stringify(report.shifts)}`,
    ).toBeLessThan(CLS_LIMIT);
  });
});
