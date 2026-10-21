/**
 * App shell (T-08, issue #28; views.md §0): skip link, header with the brand,
 * `<main>` focus target, hash routes, bank loading state and error boundary.
 */
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { LoadBankResult } from "../../content/loader";
import { strings } from "../strings";
import styles from "./App.module.css";
import {
  bankReducer,
  initialBankState,
  isPlayableTopic,
  type BankState,
} from "./bankState";
import { ErrorBoundary } from "./ErrorBoundary";
import { routeHref, routeKey, type Route } from "./router";
import { useHashRoute } from "./useHashRoute";
import { AppError } from "./views/AppError";
import { LandingPlaceholder } from "./views/LandingPlaceholder";
import { NotFound, TopicNotFound } from "./views/NotFound";
import { QuizPlaceholder, ResultsPlaceholder } from "./views/Placeholders";

export interface AppProps {
  /** Started at module top level in main.tsx; resolves, never rejects. */
  readonly bankPromise: Promise<LoadBankResult>;
  /** Starts a new bank request for Retry (FR-25). Keep the identity stable. */
  readonly reloadBank: () => Promise<LoadBankResult>;
}

type ViewId =
  "landing" | "topic" | "topicNotFound" | "quiz" | "results" | "notFound";

function viewFor(route: Route, bank: BankState): ViewId {
  if (route.name !== "topic") return route.name;
  return bank.status === "ready" && !isPlayableTopic(bank.bank, route.topicId)
    ? "topicNotFound"
    : "topic";
}

function focusHeading(main: HTMLElement | null): void {
  main?.querySelector<HTMLElement>("h1")?.focus();
}

export function App({ bankPromise, reloadBank }: AppProps) {
  const route = useHashRoute();
  const [bank, dispatch] = useReducer(bankReducer, initialBankState);
  const mainRef = useRef<HTMLElement>(null);
  const focusAfterRetry = useRef(false);

  // Consume the startup request (attempt 0) or start a Retry request.
  const loadingAttempt = bank.status === "loading" ? bank.attempt : null;
  useEffect(() => {
    if (loadingAttempt === null) return;
    let active = true;
    const request = loadingAttempt === 0 ? bankPromise : reloadBank();
    void request.then((result) => {
      if (active)
        dispatch({ type: "settled", attempt: loadingAttempt, result });
    });
    return () => {
      active = false;
    };
  }, [loadingAttempt, bankPromise, reloadBank]);

  const retry = useCallback(() => {
    focusAfterRetry.current = true;
    dispatch({ type: "retry" });
  }, []);

  // A successful Retry removes the focused Retry button: focus the h1.
  useEffect(() => {
    if (!focusAfterRetry.current || bank.status === "loading") return;
    focusAfterRetry.current = false;
    if (bank.status === "ready") focusHeading(mainRef.current);
  }, [bank.status]);

  // Focus rule (US-10.6, G4): every view change focuses the view's h1; the
  // first load focuses it too, except on Landing.
  const view = viewFor(route, bank);
  const viewKey = `${routeKey(route)}|${view}`;
  const shownViewKey = useRef<string | null>(null);
  useEffect(() => {
    const previous = shownViewKey.current;
    shownViewKey.current = viewKey;
    if (previous === viewKey) return;
    if (previous === null && view === "landing") return;
    focusHeading(mainRef.current);
  }, [viewKey, view]);

  const skipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
    // `#main` would be read as a route; move focus instead.
    event.preventDefault();
    mainRef.current?.focus();
  };

  let content: ReactNode;
  switch (view) {
    case "landing":
    case "topic":
      content = <LandingPlaceholder bank={bank} onRetry={retry} />;
      break;
    case "topicNotFound":
      content = <TopicNotFound />;
      break;
    case "quiz":
      content = <QuizPlaceholder />;
      break;
    case "results":
      content = <ResultsPlaceholder />;
      break;
    case "notFound":
      content = <NotFound />;
      break;
  }

  return (
    <>
      <a className={styles.skipLink} href="#main" onClick={skipToMain}>
        {strings.shell.skipLink}
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {route.name === "quiz" ? (
            // Plain text on the quiz route: Exit is explicit (views.md §0).
            <span className={styles.brand}>{strings.appName}</span>
          ) : (
            <a
              className={styles.brandLink}
              href={routeHref({ name: "landing" })}
            >
              {strings.appName}
            </a>
          )}
        </div>
      </header>
      {/* data-bank-status / data-content-version: non-visual E2E readiness
          signal (decision T-33 L6: kept). */}
      <main
        ref={mainRef}
        id="main"
        tabIndex={-1}
        className={styles.main}
        data-bank-status={bank.status}
        data-content-version={
          bank.status === "ready" ? bank.bank.contentVersion : undefined
        }
      >
        <ErrorBoundary
          resetKey={routeKey(route)}
          fallback={(reset) => <AppError onReset={reset} />}
        >
          {content}
        </ErrorBoundary>
      </main>
    </>
  );
}
