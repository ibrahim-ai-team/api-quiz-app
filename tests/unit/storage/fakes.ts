/** Fake `Storage` implementations for the storage adapter tests (T-40). */

/** Map-backed Storage that behaves like a working browser localStorage. */
export class FakeStorage implements Storage {
  readonly data = new Map<string, string>();
  [name: string]: unknown;

  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** Every method and `length` throw (disabled storage / SecurityError). */
export class ThrowingStorage extends FakeStorage {
  override get length(): number {
    throw new DOMException("denied", "SecurityError");
  }
  override getItem(): string | null {
    throw new DOMException("denied", "SecurityError");
  }
  override key(): string | null {
    throw new DOMException("denied", "SecurityError");
  }
  override removeItem(): void {
    throw new DOMException("denied", "SecurityError");
  }
  override setItem(): void {
    throw new DOMException("denied", "SecurityError");
  }
}

/** Reads and removes work; every write throws a quota error. */
export class QuotaStorage extends FakeStorage {
  readonly #error: unknown;
  constructor(error: unknown = quotaError()) {
    super();
    this.#error = error;
  }
  override setItem(): void {
    throw this.#error;
  }
}

export function quotaError(): DOMException {
  return new DOMException("full", "QuotaExceededError");
}
