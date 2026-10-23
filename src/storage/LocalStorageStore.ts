import {
  APP_KEY_PREFIX,
  OK,
  fail,
  isOversized,
  type ProgressStore,
  type WriteResult,
} from "./ProgressStore";

/**
 * Reads `globalThis.localStorage` inside a try/catch: the getter itself throws
 * (SecurityError) when storage is disabled, and it is undefined outside
 * browsers. Returns null in both cases.
 */
export function resolveDefaultStorage(): Storage | null {
  try {
    const storage: unknown = globalThis.localStorage;
    return typeof storage === "object" && storage !== null
      ? (storage as Storage)
      : null;
  } catch {
    return null;
  }
}

/** True for quota errors across engines (name, legacy code 22, Firefox). */
export function isQuotaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

/** `ProgressStore` backed by a Web `Storage`; every call is guarded. */
export class LocalStorageStore implements ProgressStore {
  readonly persistent = true;
  readonly #injected: Storage | undefined;

  /** @param storage injectable for tests; defaults to `globalThis.localStorage`, resolved lazily per call. */
  constructor(storage?: Storage) {
    this.#injected = storage;
  }

  #storage(): Storage | null {
    return this.#injected ?? resolveDefaultStorage();
  }

  get(key: string): string | null {
    try {
      const raw: unknown = this.#storage()?.getItem(key) ?? null;
      // Untrusted: anything but a string within the cap counts as absent.
      if (typeof raw !== "string" || isOversized(raw)) return null;
      return raw;
    } catch {
      return null;
    }
  }

  set(key: string, value: string): WriteResult {
    if (isOversized(value)) return fail("too-large");
    const storage = this.#storage();
    if (storage === null) return fail("unavailable");
    try {
      storage.setItem(key, value);
      return OK;
    } catch (error) {
      return fail(isQuotaError(error) ? "quota" : "error");
    }
  }

  remove(key: string): WriteResult {
    const storage = this.#storage();
    if (storage === null) return fail("unavailable");
    try {
      storage.removeItem(key);
      return OK;
    } catch {
      return fail("error");
    }
  }

  clearAppKeys(): WriteResult {
    const storage = this.#storage();
    if (storage === null) return fail("unavailable");
    try {
      // Collect first: removing while indexing shifts `key(i)`.
      const appKeys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (typeof key === "string" && key.startsWith(APP_KEY_PREFIX)) {
          appKeys.push(key);
        }
      }
      for (const key of appKeys) storage.removeItem(key);
      return OK;
    } catch {
      return fail("error");
    }
  }
}
