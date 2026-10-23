/**
 * Landing loading reserve data (T-35, issue #84; replaces the T-34
 * `RESERVE_TOPICS` tripwire). `npm run content:build` writes
 * `landing-reserve.json` next to the bank; the Landing reserve is only
 * shift-free when it lists exactly the topics the loaded group shows.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildBank,
  buildLandingReserve,
  LANDING_RESERVE_FILE,
  serializeLandingReserve,
} from "../../../scripts/content/emit.ts";
import {
  loadContentSources,
  validateContent,
} from "../../../scripts/content/validate.ts";
import {
  isBank,
  type Bank,
  type BankQuestion,
} from "../../../src/content/types.ts";
import { landingReserve } from "../../../src/content/landingReserve.ts";
import { eligibleTopics } from "../../../src/domain/index.ts";

const REPO = path.resolve(import.meta.dirname, "../../..");
const GENERATED = path.join(REPO, "src/content/generated");

function question(id: string, topic: string): BankQuestion {
  return {
    id,
    topic,
    difficulty: "easy",
    type: "true-false",
    prompt: `Prompt ${id}`,
    options: [
      { id: "true", text: "True" },
      { id: "false", text: "False" },
    ],
    correct: "true",
    explanation: "Explanation.",
    sourceUrl: "https://example.com/",
    reviewStatus: "reviewed",
  };
}

function eligibleNames(data: Bank): string[] {
  return eligibleTopics(data).map((topic) => topic.name);
}

describe("buildLandingReserve (T-35)", () => {
  it("lists the topics with questions in curated order and skips empty ones", () => {
    const data: Bank = {
      schemaVersion: 1,
      contentVersion: "t",
      topics: [
        { id: "b", name: "Topic B" },
        { id: "empty", name: "Empty topic" },
        { id: "a", name: "Topic A" },
      ],
      questions: [
        question("q1", "a"),
        question("q2", "b"),
        question("q3", "a"),
      ],
    };
    const reserve = buildLandingReserve(data);
    expect(reserve).toEqual({
      eligibleTopicCount: 2,
      topicNames: ["Topic B", "Topic A"],
      topicIds: ["b", "a"],
    });
    expect(reserve.topicNames).toEqual(eligibleNames(data));
    expect(reserve.topicIds).toEqual(eligibleTopics(data).map((t) => t.id));
  });

  it("is empty for a bank without questions", () => {
    const empty: Bank = {
      schemaVersion: 1,
      contentVersion: "t",
      topics: [{ id: "a", name: "Topic A" }],
      questions: [],
    };
    expect(buildLandingReserve(empty)).toEqual({
      eligibleTopicCount: 0,
      topicNames: [],
      topicIds: [],
    });
  });

  it("matches eligibleTopics for the production bank built from content/", async () => {
    const sources = await loadContentSources(path.join(REPO, "content"));
    const result = validateContent(sources, { release: false });
    expect(result.errors).toEqual([]);
    const built = buildBank(result.topics, result.questions, "production");
    const reserve = buildLandingReserve(built);
    expect(reserve.topicNames).toEqual(eligibleNames(built));
    expect(reserve.topicIds).toEqual(eligibleTopics(built).map((t) => t.id));
    expect(reserve.eligibleTopicCount).toBe(eligibleTopics(built).length);
  });
});

describe("generated landing-reserve.json (T-35)", () => {
  // Written by `npm run content:build`, which `npm test` runs first.
  const generatedBank = JSON.parse(
    readFileSync(path.join(GENERATED, "bank.json"), "utf8"),
  ) as unknown;
  const generatedReserveText = readFileSync(
    path.join(GENERATED, LANDING_RESERVE_FILE),
    "utf8",
  );

  it("matches the generated bank from the same build run", () => {
    expect(isBank(generatedBank)).toBe(true);
    if (!isBank(generatedBank)) return;
    const expected = buildLandingReserve(generatedBank);
    expect(generatedReserveText).toBe(serializeLandingReserve(expected));
    expect(expected.topicNames).toEqual(eligibleNames(generatedBank));
  });

  it("is the module the Landing view imports", () => {
    expect(landingReserve).toEqual(JSON.parse(generatedReserveText));
    expect(landingReserve.eligibleTopicCount).toBe(
      landingReserve.topicNames.length,
    );
    expect(landingReserve.topicIds).toHaveLength(
      landingReserve.eligibleTopicCount,
    );
  });
});
