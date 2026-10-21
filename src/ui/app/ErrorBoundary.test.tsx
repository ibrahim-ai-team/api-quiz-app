// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { strings } from "../strings";
import { ErrorBoundary } from "./ErrorBoundary";
import { AppError } from "./views/AppError";

function Thrower({ fail }: { readonly fail: boolean }) {
  if (fail) throw new Error("boom");
  return <h1 tabIndex={-1}>Fine</h1>;
}

function renderBoundary(resetKey: string, fail: boolean, reload = vi.fn()) {
  const tree = (key: string, shouldFail: boolean) => (
    <ErrorBoundary
      resetKey={key}
      fallback={(reset) => <AppError onReset={reset} reload={reload} />}
    >
      <Thrower fail={shouldFail} />
    </ErrorBoundary>
  );
  const view = render(tree(resetKey, fail));
  return {
    reload,
    rerender: (key: string, shouldFail: boolean) => {
      view.rerender(tree(key, shouldFail));
    },
  };
}

beforeEach(() => {
  // React reports caught render errors on console.error; keep output clean.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  window.history.replaceState(null, "", "/#/quiz");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("T-US12-5 error boundary (standard 10)", () => {
  it("shows the app error view with focused h1, title, Retry and home link", () => {
    const { reload } = renderBoundary("quiz", true);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: strings.error.appHeading,
    });
    expect(document.activeElement).toBe(heading);
    expect(document.title).toBe(strings.title.appError);
    expect(screen.getByText(strings.error.appBody)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: strings.common.retry }));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(
      screen
        .getByRole("link", { name: strings.common.home })
        .getAttribute("href"),
    ).toBe("#/");
  });

  it("recovers when the route key changes", () => {
    const { rerender } = renderBoundary("quiz", true);
    rerender("landing", false);
    expect(screen.getByRole("heading", { name: "Fine" })).toBeTruthy();
  });

  it("home link resets the boundary when already at home", () => {
    window.history.replaceState(null, "", "/#/");
    const { rerender } = renderBoundary("landing", true);
    // The child no longer fails; clicking home must re-render it in place.
    rerender("landing", false);
    expect(
      screen.getByRole("heading", { name: strings.error.appHeading }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: strings.common.home }));
    expect(screen.getByRole("heading", { name: "Fine" })).toBeTruthy();
  });
});
