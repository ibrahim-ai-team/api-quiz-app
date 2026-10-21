/**
 * Landing view (T-09, issue #29; US-1, US-12.2). Fixture bank (enlarged in
 * T-12): topic-a 12, topic-b 5, topic-c 3, topic-d 0 questions, so Mixed
 * shows 20. Quiz content checks live in question.spec.ts.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { REPORT_BASE_URL } from "../../src/ui/report/reportLink.ts";
import { strings } from "../../src/ui/strings.ts";
import { expectNoAxeSeriousOrCritical } from "./helpers/a11y.ts";
import {
  BANK_URL_GLOB,
  FIXTURES_DIR,
  useFixtureBank,
} from "./helpers/fixture-bank.ts";
import { expectNoHorizontalScroll } from "./helpers/layout.ts";

const radio = (page: Page, name: RegExp) => page.getByRole("radio", { name });
const start = (page: Page) =>
  page.getByRole("button", { name: strings.landing.start });
const questionHeading = (page: Page, n: number) =>
  page.getByRole("heading", {
    level: 1,
    name: strings.question.heading(1, n),
  });

async function openLanding(page: Page, hash = ""): Promise<void> {
  await page.goto(`./${hash}`);
  await expect(page.locator("main")).toHaveAttribute(
    "data-bank-status",
    "ready",
  );
}

test.describe("T-09 Landing", () => {
  test.beforeEach(async ({ page }) => {
    await useFixtureBank(page);
  });

  test("T-US1-1 topics in curated order with counts, plus Mixed with the total", async ({
    page,
  }) => {
    await openLanding(page);
    const group = page.getByRole("group", {
      name: strings.landing.topicsLegend,
    });
    await expect(group.getByRole("radio")).toHaveCount(4);
    for (const [index, name] of [
      "Fixture topic A, 12 questions",
      "Fixture topic B, 5 questions",
      "Fixture topic C, 3 questions",
      "Mixed, 20 questions",
    ].entries()) {
      await expect(group.getByRole("radio").nth(index)).toHaveAccessibleName(
        name,
      );
    }
  });

  test("T-US1-2 empty topic hidden; Mixed hidden when only 1 topic is shown", async ({
    page,
  }) => {
    await openLanding(page);
    await expect(page.locator("main")).not.toContainText("Fixture topic D");

    const fixture = JSON.parse(
      readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8"),
    ) as { questions: { topic: string }[] };
    const singleTopic = {
      ...fixture,
      questions: fixture.questions.filter((q) => q.topic === "topic-a"),
    };
    await page.unrouteAll();
    await page.route(BANK_URL_GLOB, (route) =>
      route.fulfill({ json: singleTopic }),
    );
    await page.reload();
    await expect(page.getByRole("radio")).toHaveCount(1);
    await expect(radio(page, /^Fixture topic A/)).toBeVisible();
    await expect(page.getByRole("radio", { name: /^Mixed/ })).toHaveCount(0);
  });

  for (const [label, n] of [
    [/^Fixture topic A/, 10],
    [/^Fixture topic B/, 5],
    [/^Mixed/, 10],
  ] as const) {
    test(`T-US1-3/4/7 ${label.source.slice(1)}: select + Start (2 interactions) opens question 1 of ${String(n)}`, async ({
      page,
    }) => {
      await openLanding(page);
      await radio(page, label).click(); // interaction 1
      await start(page).click(); // interaction 2
      await expect(page).toHaveURL(/#\/quiz$/);
      await expect(questionHeading(page, n)).toBeFocused();
    });
  }

  test("T-US1-6 double activation of Start creates exactly 1 quiz", async ({
    page,
  }) => {
    await openLanding(page);
    await radio(page, /^Mixed/).click();
    const historyBefore = await page.evaluate(() => history.length);
    await start(page).dblclick();
    await expect(questionHeading(page, 10)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    expect(await page.evaluate(() => history.length)).toBe(historyBefore + 1);
  });

  test("T-US1-7 keyboard only: Space selects, Enter starts (2 activations)", async ({
    page,
  }) => {
    await openLanding(page);
    const first = radio(page, /^Fixture topic A/);
    await first.focus();
    await page.keyboard.press("ArrowDown");
    await expect(radio(page, /^Fixture topic B/)).toBeChecked();
    await page.keyboard.press("ArrowUp");
    await expect(first).toBeChecked();
    // Tab moves are not counted (F-5): Space and Enter are the 2 activations.
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await expect(start(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(questionHeading(page, 10)).toBeFocused();
  });

  test("T-US12-1 About the questions has a general Report a problem link: new tab, cue, template only", async ({
    page,
  }) => {
    await openLanding(page);
    const report = page.getByRole("link", {
      name: `${strings.landing.report} ${strings.common.newTabCue}`,
      exact: true,
    });
    await expect(report).toBeVisible();
    await expect(report).toHaveAttribute("target", "_blank");
    await expect(report).toHaveAttribute("rel", "noopener noreferrer");
    const url = new URL((await report.getAttribute("href")) ?? "");
    expect(`${url.origin}${url.pathname}`).toBe(REPORT_BASE_URL);
    expect([...url.searchParams.entries()]).toEqual([
      ["template", "question-report.yml"],
    ]);
    await expectNoAxeSeriousOrCritical(page, report);
    await expectNoHorizontalScroll(page);
  });

  test("T-US1-8 topic deep link preselects and does not auto-start, also after a reload", async ({
    page,
  }) => {
    await openLanding(page, "#/topic/topic-b");
    for (let pass = 0; pass < 2; pass += 1) {
      await expect(radio(page, /^Fixture topic B/)).toBeChecked();
      await expect(start(page)).not.toHaveAttribute("aria-disabled");
      await expect(
        page.getByRole("heading", { level: 1, name: strings.landing.heading }),
      ).toBeVisible();
      await expect(page).toHaveURL(/#\/topic\/topic-b$/);
      if (pass === 0) await page.reload();
    }
  });

  test("T-US1-9 Landing: 0 serious/critical axe, title, no horizontal scroll, Start unavailable until selection", async ({
    page,
  }) => {
    await openLanding(page);
    await expect(page).toHaveTitle(strings.title.landing);
    await expect(start(page)).toHaveAttribute("aria-disabled", "true");
    await expect(start(page)).toHaveAccessibleDescription(
      strings.landing.startHint,
    );
    // Activating the unavailable button does nothing (Playwright's click
    // refuses aria-disabled elements, so use the keyboard).
    await start(page).focus();
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/#\/quiz$/);
    await expectNoAxeSeriousOrCritical(page, start(page));
    await expectNoHorizontalScroll(page);
    await radio(page, /^Mixed/).click();
    await expectNoAxeSeriousOrCritical(page, radio(page, /^Mixed/));
  });

  test("T-US12-2 unknown topic: Topic not found heading, list without preselection, slug not echoed", async ({
    page,
  }) => {
    await openLanding(page, "#/topic/%3Cb%3Eevil-slug%3C%2Fb%3E");
    const heading = page.getByRole("heading", {
      level: 1,
      name: strings.notFound.topicHeading,
    });
    await expect(heading).toBeFocused();
    await expect(page.getByRole("radio")).toHaveCount(4);
    for (const r of await page.getByRole("radio").all()) {
      await expect(r).not.toBeChecked();
    }
    await expect(page.locator("body")).not.toContainText("evil-slug");
    expect(await page.content()).not.toContain("evil-slug");
    expect(await page.title()).not.toContain("evil-slug");
    await expectNoAxeSeriousOrCritical(page, heading);
  });
});
