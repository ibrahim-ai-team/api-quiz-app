/** Probe and fallback (T-40, US-6.5): unusable storage yields a MemoryStore. */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KEYS,
  LocalStorageStore,
  MemoryStore,
  PROBE_KEY,
  createProgressStore,
} from "../../../src/storage/index.ts";
import { FakeStorage, QuotaStorage, ThrowingStorage } from "./fakes.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createProgressStore", () => {
  it("returns a persistent LocalStorageStore when the probe succeeds", () => {
    const fake = new FakeStorage();
    const setItem = vi.spyOn(fake, "setItem");
    const store = createProgressStore(fake);
    expect(store).toBeInstanceOf(LocalStorageStore);
    expect(store.persistent).toBe(true);
    expect(setItem).toHaveBeenCalledWith(PROBE_KEY, "1");
    expect(fake.data.has(PROBE_KEY)).toBe(false);
    store.set(KEYS.best, "1");
    expect(fake.getItem(KEYS.best)).toBe("1");
  });

  it.each([
    ["throws on access", () => new ThrowingStorage()],
    ["throws QuotaExceededError on setItem", () => new QuotaStorage()],
  ])("falls back to MemoryStore when storage %s", (_label, make) => {
    const store = createProgressStore(make());
    expect(store).toBeInstanceOf(MemoryStore);
    expect(store.persistent).toBe(false);
    // The fallback still works in memory for this page load.
    expect(store.set(KEYS.best, "1")).toEqual({ ok: true });
    expect(store.get(KEYS.best)).toBe("1");
  });

  it("falls back when removeItem throws during the probe", () => {
    const fake = new FakeStorage();
    vi.spyOn(fake, "removeItem").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(createProgressStore(fake).persistent).toBe(false);
  });

  it("falls back when the global localStorage is missing", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(createProgressStore()).toBeInstanceOf(MemoryStore);
  });

  it("falls back when the global localStorage getter throws", () => {
    const original = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    );
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("denied", "SecurityError");
      },
    });
    try {
      expect(createProgressStore().persistent).toBe(false);
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("uses the global localStorage when it works", () => {
    const fake = new FakeStorage();
    vi.stubGlobal("localStorage", fake);
    const store = createProgressStore();
    expect(store.persistent).toBe(true);
    store.set(KEYS.session, "s");
    expect(fake.getItem(KEYS.session)).toBe("s");
  });
});
