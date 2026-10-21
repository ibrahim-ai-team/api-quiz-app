/**
 * Runtime bank guard (T-06, standard 3): fetched data enters as `unknown`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isBank } from "../../../src/content/types.ts";

type Json = Record<string, unknown>;

const FIXTURE = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, "../../e2e/fixtures/bank.json"),
    "utf8",
  ),
) as Json;

function bank(): Json {
  return structuredClone(FIXTURE);
}

function firstQuestion(b: Json): Json {
  const question = (b.questions as Json[])[0];
  if (question === undefined) throw new Error("fixture has no questions");
  return question;
}

function withQuestion(change: (q: Json) => void): Json {
  const b = bank();
  change(firstQuestion(b));
  return b;
}

describe("isBank", () => {
  it("accepts the E2E fixture bank", () => {
    expect(isBank(FIXTURE)).toBe(true);
  });

  it("accepts an empty question list and extra unknown keys", () => {
    expect(isBank({ ...bank(), questions: [] })).toBe(true);
    expect(isBank({ ...bank(), generatedBy: "future" })).toBe(true);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "bank"],
    ["an array", []],
    ["wrong schemaVersion", { ...bank(), schemaVersion: 2 }],
    ["empty contentVersion", { ...bank(), contentVersion: "" }],
    ["numeric contentVersion", { ...bank(), contentVersion: 1 }],
    ["topics not an array", { ...bank(), topics: {} }],
    ["questions missing", { ...bank(), questions: undefined }],
    ["topic without name", { ...bank(), topics: [{ id: "topic-a" }] }],
    [
      "duplicate topic id",
      {
        ...bank(),
        topics: [...(FIXTURE.topics as Json[]), { id: "topic-a", name: "X" }],
      },
    ],
  ])("rejects %s", (_label, value) => {
    expect(isBank(value)).toBe(false);
  });

  it.each<[string, (q: Json) => void]>([
    ["unknown topic", (q) => (q.topic = "nope")],
    ["bad difficulty", (q) => (q.difficulty = "trivial")],
    ["bad type", (q) => (q.type = "multi")],
    ["empty prompt", (q) => (q.prompt = "")],
    ["options not an array", (q) => (q.options = "a,b")],
    ["one option", (q) => (q.options = [{ id: "a", text: "A" }])],
    ["option without text", (q) => (q.options = [{ id: "a" }, { id: "b" }])],
    ["correct not an option", (q) => (q.correct = "z")],
    [
      "duplicate option ids",
      (q) =>
        (q.options = [
          { id: "a", text: "Fixture option A" },
          { id: "b", text: "Fixture option B" },
          { id: "b", text: "Fixture option C" },
        ]),
    ],
    ["missing explanation", (q) => delete q.explanation],
    ["http sourceUrl", (q) => (q.sourceUrl = "http://example.com")],
    ["javascript sourceUrl", (q) => (q.sourceUrl = "javascript:alert(1)")],
    ["bad reviewStatus", (q) => (q.reviewStatus = "approved")],
    ["non-string reviewedBy", (q) => (q.reviewedBy = 7)],
  ])("rejects a question with %s", (_label, change) => {
    expect(isBank(withQuestion(change))).toBe(false);
  });

  it("rejects duplicate question ids", () => {
    const b = bank();
    const questions = b.questions as Json[];
    b.questions = [...questions, firstQuestion(b)];
    expect(isBank(b)).toBe(false);
  });
});
