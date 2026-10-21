/**
 * Reflow, text-resize, text-spacing, clipping, overlap and target-size checks
 * (T-16, issue #36; US-9.1, US-9.2, US-9.4; WCAG 1.4.4, 1.4.10, 1.4.12).
 * Bounding-box checks replace pixel comparisons (test strategy section 9).
 */
import { expect, type Page } from "@playwright/test";

/**
 * The WCAG 1.4.12 text-spacing overrides (the values of the W3C/Dylan Barrell
 * bookmarklet): line height 1.5, paragraph spacing 2em, letter spacing
 * 0.12em, word spacing 0.16em.
 */
export const TEXT_SPACING_CSS = `
* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }
`;

/**
 * 200% text resize plus the 1.4.12 overrides, kept across reloads.
 *
 * Text size: on Chromium the browser's default font size is doubled through
 * the DevTools protocol (`Page.setFontSizes`, 16 to 32 px), which is what a
 * user's text-size setting does: rem, em and em-based media queries all
 * follow it. Other engines have no such switch, so there `html` gets
 * `font-size: 200%` (rem units follow; em media queries do not).
 *
 * The CSP forbids inline `<style>` (style-src 'self'), so the overrides are a
 * constructed stylesheet (CSSOM, not blocked by CSP), adopted on every load.
 */
export async function applyTextResizeAndSpacing(
  page: Page,
  browserName: string,
): Promise<void> {
  let rootCss = "";
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Page.enable");
    await cdp.send("Page.setFontSizes", {
      fontSizes: { standard: 32, fixed: 26 },
    });
  } else {
    rootCss = "html { font-size: 200% !important; }";
  }
  await page.addInitScript((css: string) => {
    const adopt = () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", adopt, { once: true });
    } else {
      adopt();
    }
  }, `${rootCss}\n${TEXT_SPACING_CSS}`);
}

/** Fails unless the overrides are in effect on the body text. */
export async function expectTextResizeAndSpacingApplied(
  page: Page,
): Promise<void> {
  const applied = await page.evaluate(() => {
    const p = document.querySelector("main p") ?? document.body;
    const s = getComputedStyle(p);
    const fontSize = Number.parseFloat(s.fontSize);
    return {
      fontSize,
      letterSpacingEm: Number.parseFloat(s.letterSpacing) / fontSize,
      lineHeight: Number.parseFloat(s.lineHeight) / fontSize,
    };
  });
  expect(applied.fontSize, "body text at 200%").toBeGreaterThanOrEqual(32);
  expect(applied.letterSpacingEm).toBeCloseTo(0.12, 2);
  expect(applied.lineHeight).toBeCloseTo(1.5, 2);
}

/** Content elements whose boxes must not overlap or be clipped. */
const CONTENT_SELECTOR = [
  "header a",
  "header button",
  "main h1",
  "main h2",
  "main h3",
  "main p",
  "main li",
  "main legend",
  "main label",
  "main button",
  "main a",
  "main pre",
].join(", ");

/**
 * US-9.1 "no content clipped or overlapped", as bounding boxes:
 * - every visible content element lies inside the page horizontally;
 * - no two visible content elements overlap, ignoring ancestor/descendant
 *   pairs (a link inside a paragraph);
 * - no element that hides overflow has more content than its box shows
 *   (code boxes scroll by design and are excluded; visually hidden elements,
 *   the skip link and the live region, are ignored).
 */
export async function expectNoClippingOrOverlap(page: Page): Promise<void> {
  const problems = await page.evaluate((selector: string) => {
    const vw = document.documentElement.clientWidth;
    const name = (el: Element) => {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      return `<${el.tagName.toLowerCase()}> "${text.slice(0, 40)}"`;
    };
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return (
        r.width > 1 &&
        r.height > 1 &&
        s.visibility !== "hidden" &&
        s.clipPath !== "inset(50%)"
      );
    };
    const out: string[] = [];
    const items = Array.from(document.querySelectorAll(selector)).filter(shown);
    for (const el of items) {
      const r = el.getBoundingClientRect();
      if (r.left < -0.5 || r.right > vw + 0.5) {
        out.push(
          `${name(el)} outside the page: left=${String(Math.round(r.left))} right=${String(Math.round(r.right))} width=${String(vw)}`,
        );
      }
    }
    for (let i = 0; i < items.length; i += 1) {
      const a = items[i];
      if (a === undefined) continue;
      const ra = a.getBoundingClientRect();
      for (let j = i + 1; j < items.length; j += 1) {
        const b = items[j];
        if (b === undefined || a.contains(b) || b.contains(a)) continue;
        const rb = b.getBoundingClientRect();
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 1 && h > 1) {
          out.push(
            `${name(a)} overlaps ${name(b)} by ${String(Math.round(w))}x${String(Math.round(h))}`,
          );
        }
      }
    }
    for (const el of Array.from(document.querySelectorAll("body *"))) {
      if (!shown(el) || el.tagName === "PRE") continue;
      const s = getComputedStyle(el);
      const hidesX = s.overflowX === "hidden" || s.overflowX === "clip";
      const hidesY = s.overflowY === "hidden" || s.overflowY === "clip";
      if (
        (hidesX && el.scrollWidth > el.clientWidth + 1) ||
        (hidesY && el.scrollHeight > el.clientHeight + 1)
      ) {
        out.push(
          `${name(el)} clips its content: scroll ${String(el.scrollWidth)}x${String(el.scrollHeight)} > client ${String(el.clientWidth)}x${String(el.clientHeight)}`,
        );
      }
    }
    return out;
  }, CONTENT_SELECTOR);
  expect(problems, "clipped or overlapping content").toEqual([]);
}

export interface TargetSize {
  target: string;
  width: number;
  height: number;
}

/**
 * Measures every visible pointer target: buttons, links shown as standalone
 * controls and option rows (the whole `label` is the tap target, views.md).
 * Visually hidden elements (the unfocused skip link) are not targets.
 */
export async function measureTargets(page: Page): Promise<TargetSize[]> {
  return page.evaluate(() => {
    const targets = Array.from(
      document.querySelectorAll(
        "button, a[href], label:has(input[type='radio'])",
      ),
    );
    return targets
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 1 &&
          r.height > 1 &&
          getComputedStyle(el).clipPath !== "inset(50%)"
        );
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const text = el.textContent.replace(/\s+/g, " ").trim();
        return {
          target: `<${el.tagName.toLowerCase()}> "${text.slice(0, 40)}"`,
          width: Math.round(r.width * 100) / 100,
          height: Math.round(r.height * 100) / 100,
        };
      });
  });
}

/** US-9.2: every target is at least `min` x `min` CSS px. */
export async function expectTargetsAtLeast(
  page: Page,
  min = 44,
): Promise<void> {
  const targets = await measureTargets(page);
  expect(targets.length, "targets measured").toBeGreaterThan(0);
  const small = targets.filter((t) => t.width < min || t.height < min);
  expect(small, `targets smaller than ${String(min)}x${String(min)}`).toEqual(
    [],
  );
}
