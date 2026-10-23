import { describe, expect, it } from "vitest";
import { strings } from "../../strings";
import { reserveChoices, reserveHasSelection } from "./reserve";

describe("reserveChoices (T-35 Landing loading reserve)", () => {
  it("has one row per eligible topic with its real name, then Mixed", () => {
    const rows = reserveChoices({
      eligibleTopicCount: 3,
      topicNames: ["A", "HTTP methods and idempotency", "C"],
      topicIds: ["a", "b", "c"],
    });
    expect(rows.map((row) => row.name)).toEqual([
      "A",
      "HTTP methods and idempotency",
      "C",
      strings.landing.mixedLabel,
    ]);
    expect(rows.at(-1)?.description).toBe(strings.landing.mixedDescription);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it("omits Mixed when only one topic is eligible (US-1.2)", () => {
    const rows = reserveChoices({
      eligibleTopicCount: 1,
      topicNames: ["Only topic"],
      topicIds: ["only"],
    });
    expect(rows.map((row) => row.name)).toEqual(["Only topic"]);
    expect(rows.some((row) => row.scope.kind === "mixed")).toBe(false);
  });
});

describe("reserveHasSelection (T-35: the reserve shows the Start hint like the loaded group)", () => {
  const reserve = {
    eligibleTopicCount: 2,
    topicNames: ["A", "B"],
    topicIds: ["a", "b"],
  };

  it("is false with no deep link", () => {
    expect(reserveHasSelection(reserve, null)).toBe(false);
  });

  it("is true for a deep link to a listed topic", () => {
    expect(reserveHasSelection(reserve, { kind: "topic", topicId: "b" })).toBe(
      true,
    );
  });

  it("is false for an unknown or empty topic", () => {
    expect(
      reserveHasSelection(reserve, { kind: "topic", topicId: "no-such" }),
    ).toBe(false);
  });

  it("is true for Mixed only when Mixed is shown", () => {
    expect(reserveHasSelection(reserve, { kind: "mixed" })).toBe(true);
    expect(
      reserveHasSelection(
        { eligibleTopicCount: 1, topicNames: ["A"], topicIds: ["a"] },
        { kind: "mixed" },
      ),
    ).toBe(false);
  });
});
