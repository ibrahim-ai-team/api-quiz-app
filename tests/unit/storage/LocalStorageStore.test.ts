/**
 * Storage adapter (T-40, US-6). Covers US-6.5 (throwing storage, no crash),
 * US-6.6 (reset clears only `apiquiz:` keys) and US-6.8 (50 KB cap), plus the
 * V-6 "discard without crashing" property at the raw-string level.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_KEY_PREFIX,
  KEYS,
  LocalStorageStore,
  MAX_VALUE_LENGTH,
  MemoryStore,
  type ProgressStore,
} from "../../../src/storage/index.ts";
import { isQuotaError } from "../../../src/storage/LocalStorageStore.ts";
import {
  FakeStorage,
  QuotaStorage,
  ThrowingStorage,
  quotaError,
} from "./fakes.ts";

const atCap = "x".repeat(MAX_VALUE_LENGTH);
const overCap = "x".repeat(MAX_VALUE_LENGTH + 1);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("constants", () => {
  it("uses versioned apiquiz keys and a 50 KB cap", () => {
    expect(KEYS).toEqual({
      best: "apiquiz:v1:best",
      session: "apiquiz:v1:session",
    });
    expect(APP_KEY_PREFIX).toBe("apiquiz:");
    expect(MAX_VALUE_LENGTH).toBe(51_200);
  });
});

// Shared behaviour for both implementations.
describe.each<[string, () => ProgressStore, boolean]>([
  ["LocalStorageStore", () => new LocalStorageStore(new FakeStorage()), true],
  ["MemoryStore", () => new MemoryStore(), false],
])("%s", (_name, make, persistent) => {
  it("round-trips, overwrites and removes values", () => {
    const store = make();
    expect(store.persistent).toBe(persistent);
    expect(store.get(KEYS.best)).toBeNull();
    expect(store.set(KEYS.best, "a")).toEqual({ ok: true });
    expect(store.set(KEYS.best, "b")).toEqual({ ok: true });
    expect(store.get(KEYS.best)).toBe("b");
    expect(store.remove(KEYS.best)).toEqual({ ok: true });
    expect(store.get(KEYS.best)).toBeNull();
  });

  it("accepts a value at the cap and refuses one over it (US-6.8)", () => {
    const store = make();
    expect(store.set(KEYS.session, atCap)).toEqual({ ok: true });
    expect(store.get(KEYS.session)).toBe(atCap);
    expect(store.set(KEYS.session, overCap)).toEqual({
      ok: false,
      reason: "too-large",
    });
    // The refused write leaves the previous value intact.
    expect(store.get(KEYS.session)).toBe(atCap);
  });

  it("clearAppKeys removes only apiquiz: keys", () => {
    const store = make();
    store.set(KEYS.best, "1");
    store.set(KEYS.session, "2");
    store.set("apiquiz:v9:future", "3");
    store.set("other-app:best", "keep");
    store.set("apiquizzer", "keep"); // no colon: not ours
    expect(store.clearAppKeys()).toEqual({ ok: true });
    expect(store.get(KEYS.best)).toBeNull();
    expect(store.get(KEYS.session)).toBeNull();
    expect(store.get("apiquiz:v9:future")).toBeNull();
    expect(store.get("other-app:best")).toBe("keep");
    expect(store.get("apiquizzer")).toBe("keep");
  });
});

describe("LocalStorageStore with a working Storage", () => {
  it("treats oversized raw values as absent on read without touching them", () => {
    const fake = new FakeStorage();
    fake.data.set(KEYS.session, overCap);
    const store = new LocalStorageStore(fake);
    expect(store.get(KEYS.session)).toBeNull();
    expect(fake.data.get(KEYS.session)).toBe(overCap);
  });

  it("treats non-string raw values as absent (untrusted Storage)", () => {
    const fake = new FakeStorage();
    vi.spyOn(fake, "getItem").mockReturnValue(42 as unknown as string);
    expect(new LocalStorageStore(fake).get(KEYS.best)).toBeNull();
  });

  it("refuses oversized writes before calling setItem", () => {
    const fake = new FakeStorage();
    const setItem = vi.spyOn(fake, "setItem");
    new LocalStorageStore(fake).set(KEYS.best, overCap);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("clears many app keys interleaved with foreign keys", () => {
    const fake = new FakeStorage();
    for (let i = 0; i < 10; i++) {
      fake.setItem(`apiquiz:k${String(i)}`, "v");
      fake.setItem(`foreign:k${String(i)}`, "v");
    }
    expect(new LocalStorageStore(fake).clearAppKeys()).toEqual({ ok: true });
    expect([...fake.data.keys()].every((k) => k.startsWith("foreign:"))).toBe(
      true,
    );
    expect(fake.length).toBe(10);
  });
});

describe("LocalStorageStore with a throwing Storage", () => {
  it("swallows errors on every method", () => {
    const store = new LocalStorageStore(new ThrowingStorage());
    expect(store.get(KEYS.best)).toBeNull();
    expect(store.set(KEYS.best, "1")).toEqual({ ok: false, reason: "error" });
    expect(store.remove(KEYS.best)).toEqual({ ok: false, reason: "error" });
    expect(store.clearAppKeys()).toEqual({ ok: false, reason: "error" });
  });

  it("reports quota errors on write as quota", () => {
    const store = new LocalStorageStore(new QuotaStorage());
    expect(store.set(KEYS.best, "1")).toEqual({ ok: false, reason: "quota" });
  });

  it("recognises engine-specific quota errors", () => {
    expect(isQuotaError(quotaError())).toBe(true);
    expect(isQuotaError({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error("boom"))).toBe(false);
    expect(isQuotaError("QuotaExceededError")).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });

  it("maps a non-quota setItem error to error", () => {
    const store = new LocalStorageStore(new QuotaStorage(new TypeError("x")));
    expect(store.set(KEYS.best, "1")).toEqual({ ok: false, reason: "error" });
  });
});

describe("LocalStorageStore default storage (lazy globalThis.localStorage)", () => {
  it("reports unavailable when localStorage is missing", () => {
    vi.stubGlobal("localStorage", undefined);
    const store = new LocalStorageStore();
    expect(store.get(KEYS.best)).toBeNull();
    expect(store.set(KEYS.best, "1")).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(store.remove(KEYS.best)).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(store.clearAppKeys()).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reports unavailable when the localStorage getter throws", () => {
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
      const store = new LocalStorageStore();
      expect(store.get(KEYS.best)).toBeNull();
      expect(store.set(KEYS.best, "1")).toEqual({
        ok: false,
        reason: "unavailable",
      });
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("resolves the global lazily, at call time", () => {
    const fake = new FakeStorage();
    vi.stubGlobal("localStorage", undefined);
    const store = new LocalStorageStore();
    vi.stubGlobal("localStorage", fake);
    expect(store.set(KEYS.best, "1")).toEqual({ ok: true });
    expect(fake.getItem(KEYS.best)).toBe("1");
  });
});
