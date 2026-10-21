/**
 * Seeded randomness for the quiz domain (T-07, FR-4, US-1.5; tech-lead
 * standard 7).
 *
 * All domain randomness flows through an injected `Rng` so that a quiz is
 * reproducible from its seed and unit tests can assert exact orders. This is
 * the only module allowed to call `Math.random` (ESLint
 * `no-restricted-properties`), and only to pick a fresh seed in `randomSeed`.
 * Not cryptographically secure; it only orders quiz questions.
 */

/** A source of floats uniformly distributed in [0, 1). */
export interface Rng {
  next(): number;
}

/** An `Rng` that remembers the seed it was created from. */
export interface SeededRng extends Rng {
  /** Unsigned 32-bit seed (the input seed normalised with `>>> 0`). */
  readonly seed: number;
}

const UINT32_RANGE = 2 ** 32;

/**
 * Normalises any number to an unsigned 32-bit integer seed. Fractions are
 * truncated, values wrap modulo 2^32, and NaN/Infinity become 0.
 */
export function normaliseSeed(seed: number): number {
  return seed >>> 0;
}

/**
 * mulberry32 (Tommy Ettinger, public domain): a small, fast 32-bit PRNG with
 * a full 2^32 period, adequate for shuffling. The same seed always yields the
 * same sequence on every JavaScript engine because it uses only 32-bit
 * integer operations (`Math.imul`, shifts, xor).
 */
export function createSeededRng(seed: number): SeededRng {
  const normalised = normaliseSeed(seed);
  let state = normalised;
  return {
    seed: normalised,
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
    },
  };
}

/** A fresh unsigned 32-bit seed. The only use of `Math.random` in `src/`. */
export function randomSeed(): number {
  return Math.floor(Math.random() * UINT32_RANGE) >>> 0;
}

/** Integer in [0, maxExclusive) from `rng`; `maxExclusive` must be >= 1. */
function nextIndex(rng: Rng, maxExclusive: number): number {
  const index = Math.floor(rng.next() * maxExclusive);
  // Guards against a misbehaving injected Rng returning 1 or more.
  return Math.min(Math.max(index, 0), maxExclusive - 1);
}

/**
 * Fisher–Yates (Durstenfeld) shuffle. Pure: returns a new array and leaves
 * `items` untouched. Consumes exactly `items.length - 1` values from `rng`
 * (none for 0 or 1 items).
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = nextIndex(rng, i + 1);
    // Safe: 0 <= j <= i < result.length, so both elements exist.
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}
