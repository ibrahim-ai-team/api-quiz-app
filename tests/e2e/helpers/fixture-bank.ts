/**
 * Fixture bank route (tech-lead standard 12, test strategy section 4).
 * E2E never depends on the real content: the hashed data asset emitted by
 * T-06 (`assets/bank-<hash>.json`) is answered from `tests/e2e/fixtures/`.
 * Until T-06 lands the shell requests no bank, so the route is registered
 * harmlessly and `hits()` stays 0.
 */
import path from "node:path";
import type { Page } from "@playwright/test";

export const FIXTURES_DIR = path.join(import.meta.dirname, "..", "fixtures");

/** Glob matching the emitted data asset at any path under the base URL. */
export const BANK_URL_GLOB = "**/bank*.json";

export interface FixtureBankRoute {
  /** Number of bank requests answered from the fixture so far. */
  hits: () => number;
}

export async function useFixtureBank(
  page: Page,
  fixture = "bank.json",
): Promise<FixtureBankRoute> {
  let hits = 0;
  const file = path.join(FIXTURES_DIR, fixture);
  await page.route(BANK_URL_GLOB, async (route) => {
    hits += 1;
    await route.fulfill({ path: file, contentType: "application/json" });
  });
  return { hits: () => hits };
}
