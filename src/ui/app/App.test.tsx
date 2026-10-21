// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadBankResult } from "../../content/loader";
import { strings } from "../strings";
import { App } from "./App";
import { LOADING_DELAY_MS, STILL_LOADING_MS } from "../components/BankStatus";
import { deferred, FAILED, OK, TEST_BANK } from "./testBank";

function setHash(hash: string): void {
  window.history.replaceState(null, "", `/${hash}`);
}

/** Navigates like a link click: new hash plus the hashchange event. */
function navigate(hash: string): void {
  act(() => {
    setHash(hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}

/** Lets resolved loader promises reach the reducer. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderApp(
  bankPromise: Promise<LoadBankResult>,
  reloadBank: () => Promise<LoadBankResult> = () => Promise.resolve(OK),
) {
  const reload = vi.fn(reloadBank);
  const view = render(<App bankPromise={bankPromise} reloadBank={reload} />);
  return { ...view, reload };
}

function main(): HTMLElement {
  return screen.getByRole("main");
}

function h1(): HTMLElement {
  return screen.getByRole("heading", { level: 1 });
}

beforeEach(() => {
  setHash("");
  document.title = "";
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("T-US12-4 loading indicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("shows nothing before 300 ms, then the loading text in a status region", () => {
    renderApp(deferred<LoadBankResult>().promise);
    const status = screen.getByRole("status");
    expect(main().getAttribute("data-bank-status")).toBe("loading");
    act(() => {
      vi.advanceTimersByTime(LOADING_DELAY_MS - 1);
    });
    expect(status.textContent).toBe("");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(status.textContent).toContain(strings.loading.text);
    expect(screen.queryByRole("button", { name: strings.common.retry })).toBe(
      null,
    );
  });

  it("never shows the indicator when data arrives within 300 ms", async () => {
    const bank = deferred<LoadBankResult>();
    renderApp(bank.promise);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    bank.resolve(OK);
    await flush();
    act(() => {
      vi.advanceTimersByTime(STILL_LOADING_MS);
    });
    expect(screen.queryByRole("status")).toBe(null);
    expect(main().getAttribute("data-bank-status")).toBe("ready");
  });

  it("shows Still loading with Retry at 10 s; Retry calls the loader again", async () => {
    const retryBank = deferred<LoadBankResult>();
    const { reload } = renderApp(
      deferred<LoadBankResult>().promise,
      () => retryBank.promise,
    );
    act(() => {
      vi.advanceTimersByTime(STILL_LOADING_MS - 1);
    });
    expect(screen.getByRole("status").textContent).toContain(
      strings.loading.text,
    );
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status").textContent).toContain(
      strings.loading.still,
    );
    const retry = screen.getByRole("button", { name: strings.common.retry });
    retry.focus();
    fireEvent.click(retry);
    expect(reload).toHaveBeenCalledTimes(1);
    // Same button keeps focus; unavailable until the new attempt settles or 10 s pass.
    expect(document.activeElement).toBe(retry);
    expect(retry.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("status").textContent).toContain(
      strings.loading.text,
    );
    fireEvent.click(retry);
    expect(reload).toHaveBeenCalledTimes(1);
    retryBank.resolve(OK);
    await flush();
    expect(main().getAttribute("data-bank-status")).toBe("ready");
    expect(document.activeElement).toBe(h1());
  });
});

describe("T-US12-5 data error with Retry (FR-25)", () => {
  it("shows a readable alert and Retry; Retry reloads and reaches ready", async () => {
    const retryBank = deferred<LoadBankResult>();
    const { reload } = renderApp(
      Promise.resolve(FAILED),
      () => retryBank.promise,
    );
    await flush();
    expect(main().getAttribute("data-bank-status")).toBe("error");
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", {
        level: 2,
        name: strings.error.dataHeading,
      }),
    ).toBeTruthy();
    expect(alert.textContent).toContain(strings.error.dataBody);
    expect(document.title).toBe(strings.title.dataError);
    // Focus does not move on first load.
    expect(document.activeElement).toBe(document.body);

    const retry = screen.getByRole("button", { name: strings.common.retry });
    fireEvent.click(retry);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(main().getAttribute("data-bank-status")).toBe("loading");
    retryBank.resolve(OK);
    await flush();
    expect(main().getAttribute("data-bank-status")).toBe("ready");
    expect(main().getAttribute("data-content-version")).toBe(
      TEST_BANK.contentVersion,
    );
    expect(screen.queryByRole("alert")).toBe(null);
    expect(document.title).toBe(strings.title.landing);
    expect(document.activeElement).toBe(h1());
  });

  it("keeps focus on Retry and re-announces the alert after a failed Retry", async () => {
    const { reload } = renderApp(Promise.resolve(FAILED), () =>
      Promise.resolve(FAILED),
    );
    await flush();
    const firstAlert = screen.getByRole("alert");
    const retry = screen.getByRole("button", { name: strings.common.retry });
    retry.focus();
    fireEvent.click(retry);
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(main().getAttribute("data-bank-status")).toBe("error");
    expect(document.activeElement).toBe(retry);
    expect(screen.getByRole("alert")).not.toBe(firstAlert);
  });
});

describe("T-US12-2 404 and topic not found", () => {
  it("renders the 404 view with a home link, title and focused h1", async () => {
    setHash("#/no-such-page");
    renderApp(Promise.resolve(OK));
    await flush();
    expect(h1().textContent).toContain(strings.notFound.heading);
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe(strings.title.notFound);
    expect(
      screen
        .getByRole("link", { name: strings.common.home })
        .getAttribute("href"),
    ).toBe("#/");
  });

  it.each(["#/topic/unknown", "#/topic/topic-d"])(
    "shows Topic not found for %s once data is ready, without echoing the slug",
    async (hash) => {
      setHash(hash);
      renderApp(Promise.resolve(OK));
      await flush();
      expect(h1().textContent).toContain(strings.notFound.topicHeading);
      expect(document.activeElement).toBe(h1());
      expect(document.title).toBe(strings.title.topicNotFound);
      expect(main().textContent).not.toContain(hash.slice("#/topic/".length));
      // views.md §7b: the Landing topic list follows, nothing preselected.
      const radio = screen.getByRole<HTMLInputElement>("radio");
      expect(radio.checked).toBe(false);
    },
  );

  it("renders Landing with the topic preselected for a valid deep link", async () => {
    setHash("#/topic/topic-a");
    renderApp(Promise.resolve(OK));
    await flush();
    expect(h1().textContent).toContain(strings.landing.heading);
    expect(document.title).toBe(strings.title.landing);
    expect(screen.getByRole<HTMLInputElement>("radio").checked).toBe(true);
    expect(window.location.hash).toBe("#/topic/topic-a");
  });
});

describe("T-US1-3/6 Start creates one quiz and opens #/quiz", () => {
  it("creates the quiz once on a double click and shows question 1 of N", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    const hashChanges = vi.fn();
    window.addEventListener("hashchange", hashChanges);
    try {
      fireEvent.click(screen.getByRole("radio"));
      const start = screen.getByRole("button", { name: strings.landing.start });
      fireEvent.click(start);
      fireEvent.click(start);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(window.location.hash).toBe("#/quiz");
      expect(hashChanges).toHaveBeenCalledTimes(1);
      expect(h1().textContent).toBe(strings.question.heading(1, 1));
      expect(document.activeElement).toBe(h1());
    } finally {
      window.removeEventListener("hashchange", hashChanges);
    }
  });
});

describe("T-US10-6 per-view title and focus", () => {
  it.each([
    ["", strings.landing.heading, strings.title.landing],
    ["#/quiz", strings.placeholder.quizHeading, strings.title.quizPlaceholder],
    [
      "#/results",
      strings.placeholder.resultsHeading,
      strings.title.resultsPlaceholder,
    ],
    ["#/x", strings.notFound.heading, strings.title.notFound],
  ])("sets the title for %j", async (hash, heading, title) => {
    setHash(hash);
    renderApp(Promise.resolve(OK));
    await flush();
    expect(h1().textContent).toContain(heading);
    expect(document.title).toBe(title);
  });

  it("does not move focus on the first Landing load; moves it to h1 on every route change", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    expect(document.activeElement).toBe(document.body);

    navigate("#/quiz");
    expect(h1().textContent).toContain(strings.placeholder.quizHeading);
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe(strings.title.quizPlaceholder);

    navigate("#/nope");
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe(strings.title.notFound);

    navigate("#/");
    expect(h1().textContent).toContain(strings.landing.heading);
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe(strings.title.landing);
  });

  it("makes the h1 and main script-focusable only", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    expect(h1().getAttribute("tabindex")).toBe("-1");
    expect(main().getAttribute("id")).toBe("main");
    expect(main().getAttribute("tabindex")).toBe("-1");
  });
});

describe("shell", () => {
  it("links the brand home except on the quiz route", async () => {
    renderApp(Promise.resolve(OK));
    await flush();
    const banner = screen.getByRole("banner");
    expect(
      within(banner)
        .getByRole("link", { name: strings.appName })
        .getAttribute("href"),
    ).toBe("#/");
    navigate("#/quiz");
    expect(within(banner).queryByRole("link")).toBe(null);
    expect(banner.textContent).toContain(strings.appName);
  });

  it("skip link focuses main without changing the route", async () => {
    setHash("#/results");
    renderApp(Promise.resolve(OK));
    await flush();
    fireEvent.click(screen.getByRole("link", { name: strings.shell.skipLink }));
    expect(document.activeElement).toBe(main());
    expect(window.location.hash).toBe("#/results");
  });
});

/**
 * Makes the next `document.title` assignment throw once, so the view's
 * title effect fails inside the error boundary (a real render-phase error
 * path without test-only code in the app). Returns a restore function.
 */
function failNextTitleWrite(): () => void {
  const proto = Object.getOwnPropertyDescriptor(Document.prototype, "title");
  let failed = false;
  Object.defineProperty(document, "title", {
    configurable: true,
    get: () => proto?.get?.call(document) as string,
    set: (value: string) => {
      if (!failed) {
        failed = true;
        throw new Error("forced title failure");
      }
      proto?.set?.call(document, value);
    },
  });
  return () => {
    Reflect.deleteProperty(document, "title");
  };
}

describe("T-US12-5 error boundary inside the app (T-08-R01 L1)", () => {
  it("focuses the landing h1 after the boundary is reset from the home link at #/", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const restore = failNextTitleWrite();
    try {
      setHash("#/");
      renderApp(Promise.resolve(OK));
      await flush();
      const errorHeading = h1();
      expect(errorHeading.textContent).toContain(strings.error.appHeading);
      expect(document.activeElement).toBe(errorHeading);

      fireEvent.click(screen.getByRole("link", { name: strings.common.home }));
      expect(h1().textContent).toContain(strings.landing.heading);
      expect(document.activeElement).toBe(h1());
      expect(document.title).toBe(strings.title.landing);
      expect(window.location.hash).toBe("#/");
    } finally {
      restore();
      vi.restoreAllMocks();
    }
  });
});

describe("reloadBank prop (T-08-R01 L4)", () => {
  it("does not refetch when the loader identity changes; Retry uses the latest loader", async () => {
    const first = vi.fn(() => Promise.resolve(OK));
    const second = vi.fn(() => Promise.resolve(OK));
    const failed = Promise.resolve(FAILED);
    const view = render(<App bankPromise={failed} reloadBank={first} />);
    await flush();
    view.rerender(<App bankPromise={failed} reloadBank={second} />);
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: strings.common.retry }));
    await flush();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(main().getAttribute("data-bank-status")).toBe("ready");
  });
});
