/**
 * Vitest setup (T-13, TL L3): jsdom implements neither
 * `Element.prototype.scrollIntoView` nor `window.matchMedia`. Inert stubs let
 * UI code call them unguarded; tests spy on or replace them as needed.
 * Runs in every test file, so it does nothing in the node environment.
 */
if (typeof window !== "undefined") {
  if (typeof Element.prototype.scrollIntoView !== "function") {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: function scrollIntoView(): void {
        // No layout in jsdom: nothing to scroll.
      },
    });
  }
  // jsdom exposes the key with an undefined value, so test the type.
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string): MediaQueryList => {
        // Partial: only the non-deprecated members (no addListener).
        const list: Pick<
          MediaQueryList,
          | "matches"
          | "media"
          | "onchange"
          | "addEventListener"
          | "removeEventListener"
          | "dispatchEvent"
        > = {
          matches: false,
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        };
        return list as MediaQueryList;
      },
    });
  }
}
