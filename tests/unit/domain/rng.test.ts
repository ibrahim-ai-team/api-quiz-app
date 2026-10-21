/** Seeded RNG and shuffle (T-07; FR-4, US-1.5, standard 7). */
import { describe, expect, it } from "vitest";
import {
  createSeededRng,
  normaliseSeed,
  randomSeed,
  shuffle,
  type Rng,
} from "../../../src/domain/rng.ts";

function take(rng: Rng, count: number): number[] {
  return Array.from({ length: count }, () => rng.next());
}

describe("createSeededRng", () => {
  it("T-US1-5 same seed gives the same sequence", () => {
    expect(take(createSeededRng(42), 50)).toEqual(
      take(createSeededRng(42), 50),
    );
  });

  it("T-US1-5 known seed gives a known sequence (mulberry32)", () => {
    const values = take(createSeededRng(1), 3).map((v) =>
      Math.floor(v * 2 ** 32),
    );
    expect(values).toEqual(EXPECTED_SEED_1);
  });

  it("different seeds give different sequences", () => {
    expect(take(createSeededRng(1), 10)).not.toEqual(
      take(createSeededRng(2), 10),
    );
  });

  it("values are in [0, 1) across many draws and seeds", () => {
    for (const seed of [0, 1, 42, 2 ** 32 - 1, -1, 123456789]) {
      const rng = createSeededRng(seed);
      for (let i = 0; i < 2000; i += 1) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it("values are roughly uniform (10 buckets, 10 000 draws)", () => {
    const rng = createSeededRng(7);
    const buckets = new Array<number>(10).fill(0);
    for (let i = 0; i < 10_000; i += 1) {
      const bucket = Math.floor(rng.next() * 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it("normalises the seed to an unsigned 32-bit integer", () => {
    expect(createSeededRng(42).seed).toBe(42);
    expect(createSeededRng(-1).seed).toBe(2 ** 32 - 1);
    expect(createSeededRng(2 ** 32 + 5).seed).toBe(5);
    expect(createSeededRng(3.9).seed).toBe(3);
    expect(normaliseSeed(Number.NaN)).toBe(0);
    expect(take(createSeededRng(-1), 5)).toEqual(
      take(createSeededRng(2 ** 32 - 1), 5),
    );
  });
});

describe("randomSeed", () => {
  it("returns unsigned 32-bit integers", () => {
    for (let i = 0; i < 100; i += 1) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });
});

describe("shuffle", () => {
  const items = Object.freeze(["a", "b", "c", "d", "e", "f", "g"]);

  it("returns a permutation and does not mutate the input", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const result = shuffle(items, createSeededRng(seed));
      expect(result).not.toBe(items);
      expect([...result].sort()).toEqual([...items]);
    }
    expect(items).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });

  it("T-US1-5 is reproducible for a seed", () => {
    expect(shuffle(items, createSeededRng(42))).toEqual(
      shuffle(items, createSeededRng(42)),
    );
    expect(shuffle(items, createSeededRng(42))).toEqual(EXPECTED_SHUFFLE_42);
  });

  it("produces several distinct orders across seeds", () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 50; seed += 1) {
      orders.add(shuffle(items, createSeededRng(seed)).join(""));
    }
    expect(orders.size).toBeGreaterThanOrEqual(2);
  });

  it("handles empty and single-item arrays without consuming randomness", () => {
    let calls = 0;
    const counting: Rng = {
      next: () => {
        calls += 1;
        return 0.5;
      },
    };
    expect(shuffle([], counting)).toEqual([]);
    expect(shuffle(["x"], counting)).toEqual(["x"]);
    expect(calls).toBe(0);
    expect(shuffle(["x", "y", "z"], counting)).toHaveLength(3);
    expect(calls).toBe(2);
  });

  it("clamps an out-of-range injected Rng instead of losing items", () => {
    const tooHigh: Rng = { next: () => 1 };
    const negative: Rng = { next: () => -0.5 };
    expect([...shuffle(items, tooHigh)].sort()).toEqual([...items]);
    expect([...shuffle(items, negative)].sort()).toEqual([...items]);
  });
});

/** mulberry32 reference outputs for seed 1, scaled to uint32. */
const EXPECTED_SEED_1 = [2693262067, 11749833, 2265367787];
const EXPECTED_SHUFFLE_42 = ["d", "b", "a", "f", "g", "c", "e"];
