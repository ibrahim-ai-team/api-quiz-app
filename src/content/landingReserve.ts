/**
 * Landing loading reserve data (T-35, issue #84). `npm run content:build`
 * writes `generated/landing-reserve.json` in the same run as the bank, so the
 * eligible topic count and names always match the bank that ships. It is
 * imported as a module (compiled into the JS bundle): no inline script, no
 * DOM read, no extra request, and the CSP is unchanged.
 */
import data from "./generated/landing-reserve.json";
import type { LandingReserve } from "./types.ts";

export type { LandingReserve };

export const landingReserve: LandingReserve = data;
