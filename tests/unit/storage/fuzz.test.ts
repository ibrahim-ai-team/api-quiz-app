/**
 * V-6 (adapter level, T-40): arbitrary raw values and arbitrary storage
 * failures never make the adapter throw. Codec-level fuzzing (corrupt JSON,
 * wrong types, schemaVersion, stale IDs) belongs to T-41/T-42.
 */
import { describe, expect, it } from "vitest";
import { createSeededRng } from "../../../src/domain/index.ts";
import {
  KEYS,
  LocalStorageStore,
  MAX_VALUE_LENGTH,
} from "../../../src/storage/index.ts";
import { FakeStorage } from "./fakes.ts";

const failures: unknown[] = [
  new DOMException("full", "QuotaExceededError"),
  new DOMException("denied", "SecurityError"),
  new TypeError("x"),
  "string thrown",
  null,
  undefined,
  { name: 1 },
];

/** Storage whose calls randomly throw arbitrary values or return junk. */
class ChaosStorage extends FakeStorage {
  readonly next: () => number;
  constructor(next: () => number) {
    super();
    this.next = next;
  }
  #maybeThrow(): void {
    if (this.next() < 0.3) {
      throw failures[Math.floor(this.next() * failures.length)];
    }
  }
  override getItem(key: string): string | null {
    this.#maybeThrow();
    const junk: unknown[] = [
      undefined,
      0,
      {},
      "x".repeat(MAX_VALUE_LENGTH + 1),
    ];
    if (this.next() < 0.2) {
      return junk[Math.floor(this.next() * junk.length)] as string;
    }
    return super.getItem(key);
  }
  override setItem(key: string, value: string): void {
    this.#maybeThrow();
    super.setItem(key, value);
  }
  override removeItem(key: string): void {
    this.#maybeThrow();
    super.removeItem(key);
  }
  override key(index: number): string | null {
    this.#maybeThrow();
    return super.key(index);
  }
}

describe("storage adapter fuzz (V-6)", () => {
  it("never throws and only returns null or capped strings", () => {
    const rng = createSeededRng(40);
    const next = (): number => rng.next();
    const store = new LocalStorageStore(new ChaosStorage(next));
    const keys = [KEYS.best, KEYS.session, "apiquiz:x", "foreign"];
    for (let i = 0; i < 2000; i++) {
      const key = keys[Math.floor(next() * keys.length)] ?? KEYS.best;
      const op = Math.floor(next() * 4);
      expect(() => {
        if (op === 0) {
          const length = Math.floor(next() * (MAX_VALUE_LENGTH + 10));
          const result = store.set(key, "y".repeat(length));
          if (length > MAX_VALUE_LENGTH) {
            expect(result).toEqual({ ok: false, reason: "too-large" });
          }
        } else if (op === 1) {
          const value = store.get(key);
          if (value !== null) {
            expect(typeof value).toBe("string");
            expect(value.length).toBeLessThanOrEqual(MAX_VALUE_LENGTH);
          }
        } else if (op === 2) {
          store.remove(key);
        } else {
          store.clearAppKeys();
        }
      }).not.toThrow();
    }
  });
});
