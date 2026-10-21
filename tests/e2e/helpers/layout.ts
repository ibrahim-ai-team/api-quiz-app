/**
 * Responsive helper (SC-3, NFR-3, US-9; test strategy section 6).
 */
import { expect, type Page } from "@playwright/test";

interface ScrollMetrics {
  scrollWidth: number;
  clientWidth: number;
  /** Up to 5 elements whose right edge passes the viewport, for diagnosis. */
  overflowing: string[];
}

/**
 * Fails when the page scrolls horizontally:
 * `document.scrollingElement.scrollWidth <= clientWidth` must hold.
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const metrics = await page.evaluate((): ScrollMetrics => {
    const root = document.scrollingElement ?? document.documentElement;
    const limit = root.clientWidth;
    const overflowing: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (overflowing.length >= 5) break;
      const rect = el.getBoundingClientRect();
      if (rect.right > limit + 0.5) {
        const id = el.id === "" ? "" : `#${el.id}`;
        overflowing.push(
          `${el.tagName.toLowerCase()}${id} right=${String(Math.round(rect.right))}`,
        );
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: limit,
      overflowing,
    };
  });

  expect(
    metrics.scrollWidth,
    `horizontal scroll: scrollWidth ${String(metrics.scrollWidth)} > clientWidth ${String(metrics.clientWidth)}; overflowing: ${metrics.overflowing.join(", ") || "(none found)"}`,
  ).toBeLessThanOrEqual(metrics.clientWidth);
}
