/**
 * Landing loading reserve data (T-35, issue #84). `npm run content:build`
 * writes `generated/landing-reserve.json` in the same run as the bank, so the
 * eligible topic count and names always match the bank that ships. It is
 * imported as a module (compiled into the JS bundle): no inline script, no
 * DOM read, no extra request, and the CSP is unchanged.
 */
import data from "./generated/landing-reserve.json";

export interface LandingReserve {
  /** Topics with at least one question in the emitted bank. */
  readonly eligibleTopicCount: number;
  /** Their names, in curated order. */
  readonly topicNames: readonly string[];
  /** Their ids, same order; only compared with a deep link, never shown. */
  readonly topicIds: readonly string[];
}

export const landingReserve: LandingReserve = data;
