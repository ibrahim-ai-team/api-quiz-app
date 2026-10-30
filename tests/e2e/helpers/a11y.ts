/**
 * Accessibility helper (SC-4, NFR-2; test strategy sections 2 and 6).
 * axe via @axe-core/playwright is the automated check that counts toward SC-4.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

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
 *
 * `ready` is required: it must identify an element of the state under test,
 * and it is awaited as visible before scanning, so axe never scans a page
 * that is still loading or rendering. Running CSS transitions are awaited too.
 *
 * `options.disableRules` (optional) turns off named axe rules for one scan.
 * Every caller that passes it must document why at the call site (for
 * example a confirmed axe false positive); the default scans every rule.
 */
export interface AxeScanOptions {
  disableRules?: readonly string[];
}

export async function expectNoAxeSeriousOrCritical(
  page: Page,
  ready: Locator,
  options: AxeScanOptions = {},
): Promise<void> {
  await expect(ready, "axe readiness locator").toBeVisible();
  // A colour transition in flight (for example Start becoming available)
  // would be sampled half-way by color-contrast; wait for transitions only,
  // since infinite animations such as the spinner never finish.
  await page
    .waitForFunction(
      () =>
        document.getAnimations().every((a) => !(a instanceof CSSTransition)),
      undefined,
      { timeout: 5_000 },
    )
    .catch(() => {
      throw new Error("CSS transitions still running before axe scan");
    });
  let builder = new AxeBuilder({ page }).withTags(AXE_WCAG_TAGS);
  const disabled = options.disableRules ?? [];
  if (disabled.length > 0) builder = builder.disableRules([...disabled]);
  const results = await builder.analyze();

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
