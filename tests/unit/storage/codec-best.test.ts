/**
 * Best-score codec (T-41; US-6.1, US-6.8, FR-20). Untrusted input: decode
 * never throws and returns a tagged result; `__proto__` keys are ignored.
 */
import { describe, expect, it } from "vitest";
import type { Bank } from "../../../src/content/types.ts";
import type { SavedBest } from "../../../src/domain/index.ts";
import {
  decodeBest,
  encodeBest,
  MAX_BEST_ENTRIES,
  MAX_VALUE_LENGTH,
  pruneUnknownTopics,
} from "../../../src/storage/index.ts";

const AT = 1_761_200_000_000;

function best(scores: Record<string, unknown>, schemaVersion: unknown = 1) {
  return JSON.stringify({ schemaVersion, scores });
}

const valid: SavedBest = {
  schemaVersion: 1,
  scores: {
    "http-fundamentals": { percent: 67, correct: 2, total: 3, at: AT },
    mixed: { percent: 100, correct: 10, total: 10, at: AT + 1 },
  },
};

describe("encodeBest / decodeBest", () => {
  it("round-trips", () => {
    const raw = encodeBest(valid);
    expect(raw).toBe(
      '{"schemaVersion":1,"scores":{"http-fundamentals":{"percent":67,"correct":2,"total":3,"at":1761200000000},"mixed":{"percent":100,"correct":10,"total":10,"at":1761200000001}}}',
    );
    expect(decodeBest(raw)).toEqual({ ok: true, value: valid });
  });

  it("accepts an empty score map", () => {
    expect(decodeBest(best({}))).toEqual({
      ok: true,
      value: { schemaVersion: 1, scores: {} },
    });
  });

  it("tags absent, oversized, corrupt and unknown-version values", () => {
    expect(decodeBest(null)).toEqual({ ok: false, reason: "absent" });
    expect(decodeBest(" ".repeat(MAX_VALUE_LENGTH + 1))).toEqual({
      ok: false,
      reason: "too-large",
    });
    for (const raw of ["", "{", "null", "[]", '"x"', "1", "{}"]) {
      expect(decodeBest(raw)).toEqual({ ok: false, reason: "corrupt" });
    }
    expect(decodeBest(best({}, 2))).toEqual({
      ok: false,
      reason: "unknown-version",
    });
    for (const version of ["1", 1.5, -1, null, true]) {
      expect(decodeBest(best({}, version))).toEqual({
        ok: false,
        reason: "corrupt",
      });
    }
  });

  const entry = { percent: 50, correct: 1, total: 2, at: AT };
  it.each<[string, unknown]>([
    ["percent not matching correct/total", { ...entry, percent: 51 }],
    ["percent above 100", { ...entry, percent: 101 }],
    ["fractional percent", { ...entry, percent: 50.5 }],
    ["correct above total", { ...entry, correct: 3 }],
    ["negative correct", { ...entry, correct: -1, percent: 0 }],
    ["zero total", { percent: 0, correct: 0, total: 0, at: AT }],
    ["string number", { ...entry, total: "2" }],
    ["ISO timestamp", { ...entry, at: "2026-10-23T00:00:00Z" }],
    ["negative timestamp", { ...entry, at: -1 }],
    ["missing field", { percent: 50, correct: 1, total: 2 }],
    ["array entry", [50, 1, 2, AT]],
    ["null entry", null],
  ])("rejects the whole value for %s", (_name, bad) => {
    expect(decodeBest(best({ t: entry, u: bad }))).toEqual({
      ok: false,
      reason: "corrupt",
    });
  });

  it("rejects infinite numbers from JSON overflow", () => {
    const raw = best({ t: entry }).replace(String(AT), "1e400");
    expect(decodeBest(raw)).toEqual({ ok: false, reason: "corrupt" });
  });

  it("rejects too many entries and over-long keys", () => {
    const many: Record<string, unknown> = {};
    for (let i = 0; i <= MAX_BEST_ENTRIES; i += 1)
      many[`t${String(i)}`] = entry;
    expect(decodeBest(best(many)).ok).toBe(false);
    expect(decodeBest(best({ ["k".repeat(129)]: entry })).ok).toBe(false);
    expect(decodeBest(best({ "": entry })).ok).toBe(false);
  });

  it("ignores __proto__, constructor and prototype keys without polluting", () => {
    const raw =
      '{"schemaVersion":1,"__proto__":{"polluted":1},"scores":{"__proto__":{"polluted":2},' +
      '"constructor":{"x":1},"prototype":5,"t":{"percent":50,"correct":1,"total":2,"at":1}}}';
    const result = decodeBest(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.scores)).toEqual(["t"]);
    expect(Object.getPrototypeOf(result.value.scores)).toBeNull();
    expect(Object.hasOwn(result.value.scores, "constructor")).toBe(false);
    expect((result.value.scores as Record<string, unknown>).polluted).toBe(
      undefined,
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(encodeBest(result.value)).not.toContain("__proto__");
  });

  it("does not return the parsed object (extra keys are dropped)", () => {
    const raw = best({ t: { ...entry, extra: "x" } }).replace(
      '"scores"',
      '"other":1,"scores"',
    );
    expect(decodeBest(raw)).toEqual({
      ok: true,
      value: { schemaVersion: 1, scores: { t: entry } },
    });
  });
});

describe("pruneUnknownTopics", () => {
  const bank: Bank = {
    schemaVersion: 1,
    contentVersion: "cv",
    topics: [{ id: "http-fundamentals", name: "HTTP" }],
    questions: [],
  };

  it("keeps bank topics and mixed, drops the rest, does not mutate", () => {
    const input: SavedBest = {
      schemaVersion: 1,
      scores: {
        ...valid.scores,
        "retired-topic": { percent: 0, correct: 0, total: 1, at: AT },
      },
    };
    const pruned = pruneUnknownTopics(input, bank);
    expect(Object.keys(pruned.scores).sort()).toEqual([
      "http-fundamentals",
      "mixed",
    ]);
    expect(Object.keys(input.scores)).toHaveLength(3);
  });
});
