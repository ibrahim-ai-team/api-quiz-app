/**
 * Keyboard focus helpers (T-16, issue #36; US-10.2, US-9.5; WCAG 2.4.3,
 * 2.4.7, 2.4.11, 2.1.2). Everything waits on focus state; nothing sleeps.
 */
import { expect, type Page } from "@playwright/test";

/**
 * Engines whose default Tab order includes links. Safari/WebKit skips links
 * unless "Press Tab to highlight each item" is on, and Playwright's WebKit
 * follows that default, so link stops are asserted on Chromium only
 * (tech-lead input L5 on #36). Elsewhere links are filtered out of both the
 * expected and the observed order, so the rest of the order is still checked.
 */
export function linksAreTabStops(browserName: string): boolean {
  return browserName === "chromium";
}

interface FocusInfo {
  /** Stable description: `role "name"`; radios by group, `body` for none. */
  descriptor: string;
  /** Non-zero outline or box-shadow on the element (or its option row). */
  indicator: boolean;
  /** Computed styles used for the indicator decision, for diagnosis. */
  styles: string;
}

/**
 * Describes `document.activeElement`. Radios in one group share a single
 * Tab stop, so they are described by the group `name`. The option rows draw
 * the focus ring on the whole `label` (views.md §1 and §2; the radio's own
 * outline is removed there), so the label's style counts for a radio.
 */
export async function focusInfo(page: Page): Promise<FocusInfo> {
  return page.evaluate((): FocusInfo => {
    const el = document.activeElement;
    if (el === null || el === document.body) {
      return { descriptor: "body", indicator: false, styles: "" };
    }
    const text = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
    let descriptor: string;
    if (el instanceof HTMLInputElement && el.type === "radio") {
      descriptor = `radio-group "${el.name}"`;
    } else {
      const role =
        el.getAttribute("role") ??
        (
          { A: "link", BUTTON: "button", PRE: "region" } as Record<
            string,
            string
          >
        )[el.tagName] ??
        el.tagName.toLowerCase();
      descriptor = `${role} "${text(el.getAttribute("aria-label") ?? el.textContent)}"`;
    }
    const ring = (node: Element) => {
      const s = getComputedStyle(node);
      const outline =
        s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth) > 0;
      const shadow = s.boxShadow !== "none" && s.boxShadow !== "";
      return {
        visible: outline || shadow,
        styles: `outline ${s.outlineStyle} ${s.outlineWidth}; box-shadow ${s.boxShadow}`,
      };
    };
    const own = ring(el);
    const row =
      el instanceof HTMLInputElement && el.type === "radio"
        ? el.closest("label")
        : null;
    const rowRing = row === null ? null : ring(row);
    return {
      descriptor,
      indicator: own.visible || (rowRing?.visible ?? false),
      styles: `self: ${own.styles}${rowRing === null ? "" : `; row: ${rowRing.styles}`}`,
    };
  });
}

/**
 * Fails unless the focused element (for a radio, its option row) has a
 * visible focus indicator: a non-zero outline or a box-shadow (2.4.7).
 */
export async function expectVisibleFocusIndicator(page: Page): Promise<void> {
  const info = await focusInfo(page);
  expect(info.descriptor, "an element must have focus").not.toBe("body");
  expect(
    info.indicator,
    `no visible focus indicator on ${info.descriptor} (${info.styles})`,
  ).toBe(true);
}

/**
 * Fails unless the focused control is inside the viewport and its centre is
 * not covered by another element, such as a sticky header (2.4.11, US-9.5).
 * For a radio the option row is checked, since the input itself is small.
 */
export async function expectFocusNotObscured(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const active = document.activeElement;
          if (active === null || active === document.body) return "no focus";
          const target =
            active instanceof HTMLInputElement && active.type === "radio"
              ? (active.closest("label") ?? active)
              : active;
          const r = target.getBoundingClientRect();
          const vw = document.documentElement.clientWidth;
          const vh = document.documentElement.clientHeight;
          if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) {
            return `outside the viewport: top=${String(Math.round(r.top))} bottom=${String(Math.round(r.bottom))} viewport=${String(vh)}`;
          }
          // Centre of the visible part of the element.
          const x = (Math.max(r.left, 0) + Math.min(r.right, vw)) / 2;
          const y = (Math.max(r.top, 0) + Math.min(r.bottom, vh)) / 2;
          const hit = document.elementFromPoint(x, y);
          if (hit !== null && (target.contains(hit) || hit.contains(target))) {
            return "ok";
          }
          return `covered by <${hit?.tagName.toLowerCase() ?? "nothing"}${hit?.getAttribute("class") ? ` class="${hit.getAttribute("class") ?? ""}"` : ""}>`;
        }),
      { message: "focused element visible and not obscured" },
    )
    .toBe("ok");
}

/** Every element with position sticky or fixed that is rendered (US-9.5). */
export async function stickyOrFixedElements(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((el) => {
        const { position, display } = getComputedStyle(el);
        return (
          display !== "none" && (position === "sticky" || position === "fixed")
        );
      })
      .map(
        (el) => `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}`,
      ),
  );
}

/**
 * Presses `key` until focus reaches an element whose descriptor matches, at
 * most `maxPresses` times. Fails (keyboard trap or missing stop) otherwise.
 */
export async function tabUntil(
  page: Page,
  key: "Tab" | "Shift+Tab",
  descriptor: string | RegExp,
  maxPresses = 12,
): Promise<void> {
  const seen: string[] = [];
  for (let i = 0; i < maxPresses; i += 1) {
    await page.keyboard.press(key);
    const { descriptor: now } = await focusInfo(page);
    seen.push(now);
    const hit =
      typeof descriptor === "string"
        ? now === descriptor
        : descriptor.test(now);
    if (hit) return;
  }
  throw new Error(
    `${key} did not reach ${String(descriptor)} in ${String(maxPresses)} presses; saw: ${seen.join(" -> ")}`,
  );
}

/** Id of the temporary focus sentinels that `expectTabCycle` adds. */
const SENTINEL = "e2e-focus-sentinel";

/**
 * Logical order and no keyboard trap (2.4.3, 2.1.2), without relying on the
 * browser wrapping focus from the last stop back to the first: Firefox lets
 * focus leave the document instead, so a "go round twice" walk never returns.
 *
 * Two temporary focusable sentinels are added as the first and last children
 * of <body> (outside the app root). Focus starts on one sentinel and `key` is
 * pressed until focus reaches the other one, recording each stop; at every
 * stop the focus indicator must be visible and not obscured. Then:
 * - the recorded stops equal `expected` in order (reversed for Shift+Tab):
 *   nothing missing, nothing extra, logical order;
 * - reaching the far sentinel within a bounded number of presses proves
 *   focus can move through and past every stop (no keyboard trap).
 * Link stops are compared only where `linksAreTabStops` is true.
 */
export async function expectTabCycle(
  page: Page,
  browserName: string,
  expected: readonly string[],
  key: "Tab" | "Shift+Tab" = "Tab",
): Promise<void> {
  const keepLinks = linksAreTabStops(browserName);
  const relevant = (d: string) => keepLinks || !d.startsWith('link "');
  const order = expected.filter(relevant);
  const want = key === "Tab" ? order : [...order].reverse();
  const forward = key === "Tab";
  await page.evaluate(
    ({ id, forward: fwd }) => {
      for (const pos of ["start", "end"]) {
        document.getElementById(`${id}-${pos}`)?.remove();
        const el = document.createElement("div");
        el.id = `${id}-${pos}`;
        el.tabIndex = 0;
        el.setAttribute("aria-label", `${id}-${pos}`);
        el.style.cssText =
          "position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden";
        if (pos === "start") document.body.prepend(el);
        else document.body.append(el);
      }
      document.getElementById(`${id}-${fwd ? "start" : "end"}`)?.focus();
    },
    { id: SENTINEL, forward },
  );
  const target = `${SENTINEL}-${forward ? "end" : "start"}`;
  const stops: string[] = [];
  let reached = false;
  try {
    // Every stop once, plus slack for link stops that are filtered out.
    for (let i = 0; i < expected.length * 2 + 6; i += 1) {
      await page.keyboard.press(key);
      const activeId = await page.evaluate(
        () => document.activeElement?.id ?? "",
      );
      if (activeId === target) {
        reached = true;
        break;
      }
      const info = await focusInfo(page);
      if (info.descriptor === "body") continue;
      expect(
        info.indicator,
        `no visible focus indicator on ${info.descriptor} (${info.styles})`,
      ).toBe(true);
      await expectFocusNotObscured(page);
      if (relevant(info.descriptor)) stops.push(info.descriptor);
    }
  } finally {
    await page.evaluate((id) => {
      document.getElementById(`${id}-start`)?.remove();
      document.getElementById(`${id}-end`)?.remove();
    }, SENTINEL);
  }
  const trail = `${key} trail: ${stops.join(" -> ")}`;
  expect(
    reached,
    `${trail}\nfocus never reached the end of the page (keyboard trap?)`,
  ).toBe(true);
  expect(stops, trail).toEqual(want);
}
