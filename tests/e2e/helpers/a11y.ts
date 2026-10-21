/**
 * Accessibility helper (SC-4, NFR-2; test strategy sections 2 and 6).
 * axe via @axe-core/playwright is the automated check that counts toward SC-4.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

export const AXE_WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/**
 * Runs axe with the WCAG 2.2 AA tags and fails when any serious or critical
 * violation is found, listing rule, impact, help URL and target selectors.
 * The full axe result is attached to the test report.
 */
export async function expectNoAxeSeriousOrCritical(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(AXE_WCAG_TAGS)
    .analyze();

  await test.info().attach("axe-results.json", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });

  const blocking = results.violations
    .filter((v) => v.impact != null && BLOCKING_IMPACTS.has(v.impact))
    .map((v) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      targets: v.nodes.map((n) => n.target.join(" ")),
    }));

  expect(
    blocking,
    `axe serious/critical violations:\n${JSON.stringify(blocking, null, 2)}`,
  ).toEqual([]);
}
