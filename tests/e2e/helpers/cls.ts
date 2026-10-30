/**
 * Layout-shift helpers (T-34, issue #81; moved here from landing-cls.spec.ts
 * by T-45, issue #108, so the US-6 CLS checks use the same method). The bank
 * response is delayed with `page.route`, so the late-bank path runs every
 * time instead of depending on a timing race. CLS is the sum of every
 * `layout-shift` entry without recent input, which is stricter than the
 * session-window CLS that Lighthouse reports. Chromium only (Layout
 * Instability API).
 *
 * T-35 (issue #84): the reserve is sized from the generated
 * `src/content/generated/landing-reserve.json`, so the served bank is built
 * at run time (inside each test, after the webServer build has written the
 * file) from the fixture topics and questions, with as many eligible topics
 * as the generated file and the same topic names, so names wrap like the
 * real list.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import type { Bank, BankQuestion } from "../../../src/content/types.ts";
import { BANK_URL_GLOB, FIXTURES_DIR } from "./fixture-bank.ts";

export const CLS_LIMIT = 0.01;

export interface ShiftReport {
  /** The engine supports the Layout Instability API (`layout-shift`). */
  supported: boolean;
  cls: number;
  shifts: { value: number; sources: string[] }[];
}

declare global {
  interface Window {
    __shifts?: ShiftReport["shifts"];
    __layoutShiftSupported?: boolean;
  }
}

const GENERATED_RESERVE = path.resolve(
  import.meta.dirname,
  "../../../src/content/generated/landing-reserve.json",
);

export interface GeneratedReserve {
  eligibleTopicCount: number;
  topicNames: string[];
  topicIds: string[];
}

/** Reads the file the build wrote; called inside a test, never at import. */
export function readGeneratedReserve(): GeneratedReserve {
  const data = JSON.parse(
    readFileSync(GENERATED_RESERVE, "utf8"),
  ) as GeneratedReserve;
  expect(data.eligibleTopicCount, "generated eligibleTopicCount").toBe(
    data.topicNames.length,
  );
  expect(data.topicIds).toHaveLength(data.eligibleTopicCount);
  expect(data.eligibleTopicCount).toBeGreaterThan(0);
  return data;
}

/**
 * The fixture bank reshaped to the generated reserve: generated topic `i`
 * (its id and name) gets the questions of eligible fixture topic `i % 3`,
 * with new question ids for repeats. The fixture's empty topics are kept, so
 * the bank still has a hidden topic.
 */
export function bankLikeGenerated(reserve: GeneratedReserve): Bank {
  const fixture = JSON.parse(
    readFileSync(path.join(FIXTURES_DIR, "bank.json"), "utf8"),
  ) as Bank;
  const withQuestions = new Set(fixture.questions.map((q) => q.topic));
  const sources = fixture.topics.filter((t) => withQuestions.has(t.id));
  const empty = fixture.topics.filter((t) => !withQuestions.has(t.id));
  const topics: Bank["topics"][number][] = [];
  const questions: BankQuestion[] = [];
  reserve.topicIds.forEach((id, index) => {
    const source = sources[index % sources.length];
    const name = reserve.topicNames[index];
    if (source === undefined || name === undefined) {
      throw new Error("fixture or generated reserve is empty");
    }
    topics.push({ id, name });
    for (const q of fixture.questions) {
      if (q.topic !== source.id) continue;
      questions.push({ ...q, id: `${q.id}-${String(index)}`, topic: id });
    }
  });
  return {
    ...fixture,
    contentVersion: `${fixture.contentVersion}-reserve-${String(reserve.eligibleTopicCount)}`,
    topics: [...topics, ...empty],
    questions,
  };
}

/** Serves `bank` after `delayMs`, so it lands after first paint. */
export async function serveSlowBank(
  page: Page,
  bank: Bank,
  delayMs: number,
): Promise<void> {
  const body = JSON.stringify(bank);
  await page.route(BANK_URL_GLOB, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ body, contentType: "application/json" });
  });
}

/** Records layout shifts from navigation start (buffered observer). */
export async function observeLayoutShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__shifts = [];
    window.__layoutShiftSupported =
      PerformanceObserver.supportedEntryTypes.includes("layout-shift");
    const describe = (node: Node | null): string => {
      if (!(node instanceof Element)) return String(node?.nodeName);
      const text = node.textContent.trim().slice(0, 40);
      return `${node.tagName.toLowerCase()} "${text}"`;
    };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: { node: Node | null }[];
      })[]) {
        if (entry.hadRecentInput) continue;
        window.__shifts?.push({
          value: entry.value,
          sources: (entry.sources ?? []).map((s) => describe(s.node)),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

export async function readShifts(page: Page): Promise<ShiftReport> {
  // Two frames after the last render, so a pending shift is reported.
  return page.evaluate(
    () =>
      new Promise<ShiftReport>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const shifts = window.__shifts ?? [];
              resolve({
                supported: window.__layoutShiftSupported === true,
                cls: shifts.reduce((sum, s) => sum + s.value, 0),
                shifts,
              });
            }, 100);
          });
        });
      }),
  );
}
