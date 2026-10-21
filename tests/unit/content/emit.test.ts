/**
 * Bank emission (T-06, US-7.4): drafts excluded in production and included in
 * dev, stable contentVersion, emitted shape equals the E2E fixture shape.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildBank,
  canonicalJson,
  computeContentVersion,
  CONTENT_VERSION_LENGTH,
  serializeBank,
} from "../../../scripts/content/emit.ts";
import type { Question } from "../../../scripts/content/schema.ts";
import { isBank } from "../../../src/content/types.ts";
import { generateBank } from "./helpers.ts";

const FIXTURE_BANK = path.resolve(
  import.meta.dirname,
  "../../e2e/fixtures/bank.json",
);

function sample() {
  return generateBank({ perTopic: [2, 1, 0], mediumOrHard: 1, drafts: 2 });
}

describe("buildBank", () => {
  it("excludes every draft in production mode (US-7.4)", () => {
    const { topics, questions } = sample();
    const bank = buildBank(topics, questions, "production");
    expect(bank.questions).toHaveLength(3);
    expect(bank.questions.every((q) => q.reviewStatus === "reviewed")).toBe(
      true,
    );
    expect(bank.questions.map((q) => q.id)).not.toContain("topic-1-draft-0");
  });

  it("includes drafts in development mode", () => {
    const { topics, questions } = sample();
    const bank = buildBank(topics, questions, "development");
    expect(bank.questions).toHaveLength(5);
    expect(
      bank.questions.filter((q) => q.reviewStatus === "draft"),
    ).toHaveLength(2);
  });

  it("keeps all topics in curated order, including topics with 0 questions", () => {
    const { topics, questions } = sample();
    const bank = buildBank(topics, questions, "production");
    expect(bank.topics.map((t) => t.id)).toEqual([
      "topic-1",
      "topic-2",
      "topic-3",
    ]);
  });

  it("produces an all-draft bank as 0 questions in production", () => {
    const { topics, questions } = generateBank({
      perTopic: [0, 0],
      mediumOrHard: 0,
      drafts: 3,
    });
    const bank = buildBank(topics, questions, "production");
    expect(bank.questions).toEqual([]);
    expect(isBank(bank)).toBe(true);
  });

  it("emits the E2E fixture shape and passes the runtime guard", () => {
    const { topics, questions } = sample();
    const bank = JSON.parse(
      serializeBank(buildBank(topics, questions, "development")),
    ) as Record<string, unknown>;
    const fixture = JSON.parse(readFileSync(FIXTURE_BANK, "utf8")) as Record<
      string,
      unknown
    >;
    expect(Object.keys(bank).sort()).toEqual(Object.keys(fixture).sort());
    expect(isBank(bank)).toBe(true);
    expect(isBank(fixture)).toBe(true);
  });

  it("does not emit reviewedBy when it is absent", () => {
    const { topics, questions } = sample();
    const bank = buildBank(topics, questions, "development");
    const draft = bank.questions.find((q) => q.reviewStatus === "draft");
    expect(draft).toBeDefined();
    expect(draft !== undefined && "reviewedBy" in draft).toBe(false);
  });
});

describe("contentVersion", () => {
  it("is a short lowercase hex SHA-256 prefix", () => {
    const { topics, questions } = sample();
    const { contentVersion } = buildBank(topics, questions, "production");
    expect(contentVersion).toMatch(
      new RegExp(`^[0-9a-f]{${String(CONTENT_VERSION_LENGTH)}}$`),
    );
  });

  it("is stable for unchanged content", () => {
    const a = sample();
    const b = sample();
    expect(buildBank(a.topics, a.questions, "production").contentVersion).toBe(
      buildBank(b.topics, b.questions, "production").contentVersion,
    );
  });

  it("does not depend on object key order", () => {
    const { topics, questions } = sample();
    const reordered = questions.map(
      (q) =>
        Object.fromEntries(Object.entries(q).reverse()) as unknown as Question,
    );
    expect(buildBank(topics, reordered, "production").contentVersion).toBe(
      buildBank(topics, questions, "production").contentVersion,
    );
  });

  it("changes when an emitted question changes", () => {
    const { topics, questions } = sample();
    const before = buildBank(topics, questions, "production").contentVersion;
    const changed = questions.map((q, i) =>
      i === 0 ? { ...q, prompt: `${q.prompt} (edited)` } : q,
    );
    expect(buildBank(topics, changed, "production").contentVersion).not.toBe(
      before,
    );
  });

  it("changes when a topic is renamed", () => {
    const { topics, questions } = sample();
    const before = buildBank(topics, questions, "production").contentVersion;
    const renamed = topics.map((t, i) => (i === 0 ? { ...t, name: "X" } : t));
    expect(buildBank(renamed, questions, "production").contentVersion).not.toBe(
      before,
    );
  });

  it("ignores drafts in production (editing a draft keeps the version)", () => {
    const { topics, questions } = sample();
    const before = buildBank(topics, questions, "production").contentVersion;
    const editedDraft = questions.map((q) =>
      q.reviewStatus === "draft" ? { ...q, prompt: "Edited draft" } : q,
    );
    expect(buildBank(topics, editedDraft, "production").contentVersion).toBe(
      before,
    );
  });

  it("hashes the emitted topics and questions only", () => {
    expect(computeContentVersion([], [])).toBe(computeContentVersion([], []));
    expect(canonicalJson({ b: 1, a: [2, { d: undefined, c: "x" }] })).toBe(
      '{"a":[2,{"c":"x"}],"b":1}',
    );
  });
});
