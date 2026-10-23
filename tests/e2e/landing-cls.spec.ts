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
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { Bank, BankQuestion } from "../../src/content/types.ts";
import { strings } from "../../src/ui/strings.ts";
import { BANK_URL_GLOB, FIXTURES_DIR } from "./helpers/fixture-bank.ts";

const CLS_LIMIT = 0.01;

interface ShiftReport {
  /** The engine supports the Layout Instability API (`layout-shift`). */
  supported: boolean;
  cls: number;
  shifts: { value: number; sources: string[] }[];
}

declare global {
  interface Window {
    __shifts?: ShiftReport["shifts"];
    __layoutShiftSupported?: boolean;
  }
}

const GENERATED_RESERVE = path.resolve(
  import.meta.dirname,
  "../../src/content/generated/landing-reserve.json",
);

interface GeneratedReserve {
  eligibleTopicCount: number;
  topicNames: string[];
  topicIds: string[];
}

/** Reads the file the build wrote; called inside a test, never at import. */
function readGeneratedReserve(): GeneratedReserve {
  const data = JSON.parse(
    readFileSync(GENERATED_RESERVE, "utf8"),
  ) as GeneratedReserve;
  expect(data.eligibleTopicCount, "generated eligibleTopicCount").toBe(
    data.topicNames.length,
  );
  expect(data.topicIds).toHaveLength(data.eligibleTopicCount);
  expect(data.eligibleTopicCount).toBeGreaterThan(0);
  return data;
}

/**
 * The fixture bank reshaped to the generated reserve: generated topic `i`
 * (its id and name) gets the questions of eligible fixture topic `i % 3`,
 * with new question ids for repeats. The fixture's empty topics are kept, so
 * the bank still has a hidden topic.
 */
function bankLikeGenerated(reserve: GeneratedReserve): Bank {
  const fixture = JSON.parse(
    readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8"),
  ) as Bank;
  const withQuestions = new Set(fixture.questions.map((q) => q.topic));
  const sources = fixture.topics.filter((t) => withQuestions.has(t.id));
  const empty = fixture.topics.filter((t) => !withQuestions.has(t.id));
  const topics: Bank["topics"][number][] = [];
  const questions: BankQuestion[] = [];
  reserve.topicIds.forEach((id, index) => {
    const source = sources[index % sources.length];
    const name = reserve.topicNames[index];
    if (source === undefined || name === undefined) {
      throw new Error("fixture or generated reserve is empty");
    }
    topics.push({ id, name });
    for (const q of fixture.questions) {
      if (q.topic !== source.id) continue;
      questions.push({ ...q, id: `${q.id}-${String(index)}`, topic: id });
    }
  });
  return {
    ...fixture,
    contentVersion: `${fixture.contentVersion}-reserve-${String(reserve.eligibleTopicCount)}`,
    topics: [...topics, ...empty],
    questions,
  };
}

/** Serves `bank` after `delayMs`, so it lands after first paint. */
async function serveSlowBank(
  page: Page,
  bank: Bank,
  delayMs: number,
): Promise<void> {
  const body = JSON.stringify(bank);
  await page.route(BANK_URL_GLOB, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ body, contentType: "application/json" });
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Records layout shifts from navigation start (buffered observer). */
async function observeLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__shifts = [];
    window.__layoutShiftSupported =
      PerformanceObserver.supportedEntryTypes.includes("layout-shift");
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
                supported: window.__layoutShiftSupported === true,
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
