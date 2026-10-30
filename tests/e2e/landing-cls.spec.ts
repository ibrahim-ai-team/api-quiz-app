/**
 * Landing layout stability (T-34, issue #81; T-18 baseline section 4). The
 * topic area used to grow when the bank arrived after first paint and push
 * "About the questions" down (Lighthouse CLS 0.161). The bank response is
 * delayed with `page.route`, so the late-bank path runs every time instead of
 * depending on a timing race. CLS is the sum of every `layout-shift` entry
 * without recent input, which is stricter than the session-window CLS that
 * Lighthouse reports.
 *
 * T-35 (issue #84): the reserve is sized from the generated
 * `src/content/generated/landing-reserve.json`, so the served bank is built
 * at run time (inside each test, after the webServer build has written the
 * file) from the fixture topics and questions, with as many eligible topics
 * as the generated file and the same topic names, so names wrap like the
 * real list.
 *
 * T-45: the shift observer, the slow bank and the reserve-shaped bank live in
 * `helpers/cls.ts`, shared with the US-6 checks in `progress.spec.ts`.
 */
import { expect, test, type Page } from "@playwright/test";
import { strings } from "../../src/ui/strings.ts";
import {
  CLS_LIMIT,
  bankLikeGenerated,
  observeLayoutShifts,
  readGeneratedReserve,
  readShifts,
  serveSlowBank,
  type ShiftReport,
} from "./helpers/cls.ts";

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadLandingLate(
  page: Page,
  delayMs: number,
  hash = "",
  whileLoading?: () => Promise<void>,
): Promise<ShiftReport> {
  const reserve = readGeneratedReserve();
  await observeLayoutShifts(page);
  await serveSlowBank(page, bankLikeGenerated(reserve), delayMs);
  await page.goto(`./${hash}`);
  if (delayMs > 300) {
    // The page is painted while the bank is still loading, and the loading
    // text still appears after 300 ms in its role="status" region.
    await expect(page.locator("main")).toHaveAttribute(
      "data-bank-status",
      "loading",
    );
    await expect(page.getByRole("status")).toHaveText(strings.loading.text);
    await whileLoading?.();
  }
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    "ready",
    { timeout: delayMs + 10_000 },
  );
  const group = page.getByRole("group", { name: strings.landing.topicsLegend });
  await expect(group).toBeVisible();
  // Same rows as the reserve: one per generated topic, Mixed when > 1.
  await expect(group.getByRole("radio")).toHaveCount(
    reserve.eligibleTopicCount + (reserve.eligibleTopicCount > 1 ? 1 : 0),
  );
  const report = await readShifts(page);
  // Without the API the observer records nothing, and CLS 0 would be vacuous.
  expect(report.supported, "layout-shift entries are supported").toBe(true);
  // Recorded for the report (T-34 evidence), whether the assertion passes.
  test.info().annotations.push({
    type: "CLS",
    description: String(report.cls),
  });
  return report;
}

test.describe("T-34 Landing CLS: the topic area does not move later content", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "layout-shift (Layout Instability API) is Chromium-only",
  );

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

  test(`T-34-CLS deep link to the second topic, bank after 1500 ms: CLS < ${String(CLS_LIMIT)}`, async ({
    page,
  }) => {
    const { topicIds, topicNames } = readGeneratedReserve();
    const id = topicIds[1];
    const name = topicNames[1];
    test.skip(id === undefined, "the generated bank has one topic");
    const report = await loadLandingLate(page, 1500, `#/topic/${id ?? ""}`);
    await expect(
      page.getByRole("radio", {
        name: new RegExp(`^${escapeRegExp(name ?? "")}, `),
      }),
    ).toBeChecked();
    expect(
      report.cls,
      `layout shifts: ${JSON.stringify(report.shifts)}`,
    ).toBeLessThan(CLS_LIMIT);
  });

  // L1 (T-35): an unknown topic keeps the reserve and shows the same list
  // with nothing selected. Once the bank is ready, the h1 and intro swap to
  // "Topic not found" (views.md §7b); that text change has its own height
  // and is out of scope (issue #84), so this test does not assert the raw
  // CLS (it is recorded as an annotation). It asserts that the topic area
  // keeps its height: the distance from the intro paragraph to "About the
  // questions" is the same while loading and after the list arrives.
  test("T-35-CLS unknown deep link #/topic/no-such-topic, bank after 1500 ms: the topic area keeps its height", async ({
    page,
  }) => {
    const topicAreaHeight = () =>
      page.evaluate((aboutText) => {
        const intro = document.querySelector("main h1 + p");
        const about = [...document.querySelectorAll("main h2")].find(
          (h2) => h2.textContent === aboutText,
        );
        if (intro === null || about === undefined) return null;
        return (
          about.getBoundingClientRect().top -
          intro.getBoundingClientRect().bottom
        );
      }, strings.landing.aboutHeading);
    const loading: { height: number | null } = { height: null };
    const report = await loadLandingLate(
      page,
      1500,
      "#/topic/no-such-topic",
      async () => {
        loading.height = await topicAreaHeight();
      },
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: strings.notFound.topicHeading,
      }),
    ).toBeVisible();
    for (const radio of await page.getByRole("radio").all()) {
      await expect(radio).not.toBeChecked();
    }
    const readyHeight = await topicAreaHeight();
    const loadingHeight = loading.height;
    test.info().annotations.push({
      type: "topic area height (loading, ready)",
      description: `${String(loadingHeight)}, ${String(readyHeight)}`,
    });
    expect(loadingHeight, "topic area measured while loading").not.toBeNull();
    expect(readyHeight, "topic area measured when ready").not.toBeNull();
    expect(
      Math.abs((readyHeight ?? 0) - (loadingHeight ?? 0)),
      `topic area height while loading ${String(loadingHeight)} px, ready ${String(readyHeight)} px; shifts: ${JSON.stringify(report.shifts)}`,
    ).toBeLessThan(1);
  });
});
