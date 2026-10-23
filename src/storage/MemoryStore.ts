import {
  APP_KEY_PREFIX,
  OK,
  fail,
  isOversized,
  type ProgressStore,
  type WriteResult,
} from "./ProgressStore";

/**
 * In-memory store: used when `localStorage` is unavailable (US-6.5) and in
 * tests. Applies the same size cap as `LocalStorageStore`.
 */
export class MemoryStore implements ProgressStore {
  readonly persistent = false;
  readonly #data = new Map<string, string>();

  get(key: string): string | null {
    const value = this.#data.get(key);
    return value === undefined || isOversized(value) ? null : value;
  }

  set(key: string, value: string): WriteResult {
    if (isOversized(value)) return fail("too-large");
    this.#data.set(key, value);
    return OK;
  }

  remove(key: string): WriteResult {
    this.#data.delete(key);
    return OK;
  }

  clearAppKeys(): WriteResult {
    for (const key of [...this.#data.keys()]) {
      if (key.startsWith(APP_KEY_PREFIX)) this.#data.delete(key);
    }
    return OK;
  }
}
