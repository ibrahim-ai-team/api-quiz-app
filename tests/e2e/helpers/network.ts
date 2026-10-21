/**
 * Network helpers (V-4, NFR-4, NFR-7, SC-6; ADR-0001 section 6).
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";

/** URL schemes that never reach the network; not counted as requests. */
const NON_NETWORK_SCHEMES = new Set(["data:", "blob:", "about:"]);

export interface RequestLog {
  /** Every request URL seen since tracking started, in order. */
  readonly urls: string[];
}

function isNetworkUrl(url: string): boolean {
  return !NON_NETWORK_SCHEMES.has(new URL(url).protocol);
}

/**
 * Records every network request made in the browser context from now on
 * (all pages, popups and workers), including requests answered by
 * `page.route` and requests that fail while offline. Call it before
 * `page.goto` to capture the initial load.
 *
 * Requests blocked by the CSP never fire a request event, so they cannot be
 * seen here; `expectNoCspViolations` (helpers/csp.ts) covers them.
 */
export function trackRequests(context: BrowserContext): RequestLog {
  const log: RequestLog = { urls: [] };
  context.on("request", (request) => {
    const url = request.url();
    if (isNetworkUrl(url)) log.urls.push(url);
  });
  return log;
}

/** Fails unless every recorded request has the origin of `baseURL`. */
export function expectAllSameOrigin(log: RequestLog, baseURL: string): void {
  const origin = new URL(baseURL).origin;
  expect(log.urls.length, "no requests were recorded").toBeGreaterThan(0);
  const foreign = log.urls.filter((url) => new URL(url).origin !== origin);
  expect(foreign, `requests to origins other than ${origin}`).toEqual([]);
}

/**
 * Offline after load (SC-6, NFR-7, V-4). Waits until the loaded page is idle,
 * calls `context.setOffline(true)`, runs a reload-free `interact` step and
 * asserts that 0 network requests were made after the offline point.
 */
export async function goOfflineAfterLoad(
  page: Page,
  context: BrowserContext,
  interact: (page: Page) => Promise<void>,
): Promise<void> {
  await page.waitForLoadState("networkidle");
  const urlBefore = page.url();

  const afterOffline: string[] = [];
  const record = (request: { url: () => string }) => {
    const url = request.url();
    if (isNetworkUrl(url)) afterOffline.push(url);
  };
  context.on("request", record);
  try {
    await context.setOffline(true);
    expect(
      await page.evaluate(() => navigator.onLine),
      "navigator.onLine after setOffline(true)",
    ).toBe(false);

    await interact(page);
    // Let any request triggered by the interaction be issued and observed.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(resolve, 250);
            });
          });
        }),
    );
  } finally {
    context.off("request", record);
  }

  expect(page.url(), "interaction must not navigate away").toBe(urlBefore);
  expect(afterOffline, "requests made after setOffline(true)").toEqual([]);
}
