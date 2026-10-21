/**
 * CSP violation listener (V-4, NFR-5; ADR-0001 amendment A3). The CSP meta
 * exists only in the build output, which is why E2E runs against preview.
 */
import { expect, type Page } from "@playwright/test";

const STORE = "__apiquizCspViolations";
const CSP_CONSOLE_PATTERN = /Content[- ]Security[- ]Policy/i;

interface CspViolationRecord {
  directive: string;
  blockedURI: string;
  sourceFile: string;
}

export interface CspTracker {
  /** Console errors that mention the Content Security Policy. */
  readonly consoleErrors: string[];
}

/**
 * Registers a `securitypolicyviolation` listener before any page script runs
 * and collects console errors matching /Content[- ]Security[- ]Policy/i.
 * Call it before `page.goto`.
 */
export async function trackCspViolations(page: Page): Promise<CspTracker> {
  const tracker: CspTracker = { consoleErrors: [] };
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      CSP_CONSOLE_PATTERN.test(message.text())
    ) {
      tracker.consoleErrors.push(message.text());
    }
  });
  await page.addInitScript((store: string) => {
    const records: unknown[] = [];
    Object.defineProperty(window, store, { value: records });
    document.addEventListener("securitypolicyviolation", (event) => {
      records.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
      });
    });
  }, STORE);
  return tracker;
}

/** Fails when any CSP violation event or CSP console error was observed. */
export async function expectNoCspViolations(
  page: Page,
  tracker: CspTracker,
): Promise<void> {
  const events = await page.evaluate(
    (store: string) =>
      (window as unknown as Record<string, CspViolationRecord[] | undefined>)[
        store
      ] ?? null,
    STORE,
  );
  expect(events, "CSP listener was not installed before load").not.toBeNull();
  expect(events, "securitypolicyviolation events").toEqual([]);
  expect(tracker.consoleErrors, "CSP console errors").toEqual([]);
}
