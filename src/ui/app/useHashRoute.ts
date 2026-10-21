import { useMemo, useSyncExternalStore } from "react";
import { parseRoute, type Route } from "./router";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
  };
}

function getHash(): string {
  return window.location.hash;
}

/** Current route from `location.hash`; re-renders on `hashchange`. */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, getHash);
  return useMemo(() => parseRoute(hash), [hash]);
}
