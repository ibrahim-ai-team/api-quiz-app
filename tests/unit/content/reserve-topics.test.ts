/**
 * Tripwire for the Landing loading reserve (T-34-R01 M2). The reserve holds
 * `RESERVE_TOPICS` topic rows plus Mixed; it is only shift-free when that
 * equals the number of eligible topics in the production bank. This builds
 * the production bank from `content/` exactly like `npm run content:build`
 * and fails when a content batch changes the count: update `reserve.ts`.
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBank } from "../../../scripts/content/emit.ts";
import {
  loadContentSources,
  validateContent,
} from "../../../scripts/content/validate.ts";
import { eligibleTopics } from "../../../src/domain/index.ts";
import { RESERVE_TOPICS } from "../../../src/ui/views/Landing/reserve.ts";

const CONTENT_ROOT = path.resolve(import.meta.dirname, "../../../content");

describe("Landing loading reserve (T-34)", () => {
  it("RESERVE_TOPICS equals the eligible topics in the production bank", async () => {
    const sources = await loadContentSources(CONTENT_ROOT);
    const result = validateContent(sources, { release: false });
    expect(result.errors).toEqual([]);
    const bank = buildBank(result.topics, result.questions, "production");
    expect(
      eligibleTopics(bank).length,
      "update RESERVE_TOPICS in src/ui/views/Landing/reserve.ts",
    ).toBe(RESERVE_TOPICS);
  });
});
