import { LocalStorageStore, resolveDefaultStorage } from "./LocalStorageStore";
import { MemoryStore } from "./MemoryStore";
import { PROBE_KEY, type ProgressStore } from "./ProgressStore";

/**
 * Returns a persistent `LocalStorageStore` when a probe write/remove of
 * `apiquiz:probe` succeeds; otherwise (private mode, disabled storage, full
 * quota, no `localStorage`) a `MemoryStore` with `persistent: false`, so the
 * UI can hide progress features (US-6.5). Never throws.
 */
export function createProgressStore(storage?: Storage): ProgressStore {
  try {
    const target = storage ?? resolveDefaultStorage();
    if (target === null) return new MemoryStore();
    target.setItem(PROBE_KEY, "1");
    target.removeItem(PROBE_KEY);
    return new LocalStorageStore(target);
  } catch {
    return new MemoryStore();
  }
}
