/**
 * App shell (T-08, issue #28; views.md §0): skip link, header with the brand,
 * `<main>` focus target, hash routes, bank loading state and error boundary.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { LoadBankResult } from "../../content/loader";
import {
  createQuiz,
  randomSeed,
  type Quiz,
  type QuizScope,
} from "../../domain";
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
import { Landing } from "../views/Landing/Landing";
import { useHashRoute } from "./useHashRoute";
import { AppError } from "./views/AppError";
import { NotFound } from "./views/NotFound";
import { QuizPlaceholder, ResultsPlaceholder } from "./views/Placeholders";

export interface AppProps {
  /** Started at module top level in main.tsx; resolves, never rejects. */
  readonly bankPromise: Promise<LoadBankResult>;
  /** Starts a new bank request for Retry (FR-25). */
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
  // Latest loader in a ref, so a new function identity never refetches.
  const reloadRef = useRef(reloadBank);
  useLayoutEffect(() => {
    reloadRef.current = reloadBank;
  }, [reloadBank]);

  // Consume the startup request (attempt 0) or start a Retry request.
  const loadingAttempt = bank.status === "loading" ? bank.attempt : null;
  useEffect(() => {
    if (loadingAttempt === null) return;
    let active = true;
    const request = loadingAttempt === 0 ? bankPromise : reloadRef.current();
    void request.then((result) => {
      if (active)
        dispatch({ type: "settled", attempt: loadingAttempt, result });
    });
    return () => {
      active = false;
    };
  }, [loadingAttempt, bankPromise]);

  // Minimal started-quiz holder (T-09); T-12 replaces it with the quiz
  // session reducer (standard 8). Landing guards double activation.
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const startQuiz = useCallback(
    (scope: QuizScope): boolean => {
      if (bank.status !== "ready") return false;
      const result = createQuiz(bank.bank, scope, randomSeed());
      if (!result.ok) return false;
      setQuiz(result.quiz);
      window.location.hash = routeHref({ name: "quiz" });
      return true;
    },
    [bank],
  );

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
    case "topicNotFound":
      // Keyed by route, so a new deep link resets the preselection.
      content = (
        <Landing
          key={routeKey(route)}
          bank={bank}
          onRetry={retry}
          topicId={route.name === "topic" ? route.topicId : null}
          topicNotFound={view === "topicNotFound"}
          onStart={startQuiz}
        />
      );
      break;
    case "quiz":
      content = <QuizPlaceholder questionCount={quiz?.questions.length} />;
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
          onReset={() => {
            focusHeading(mainRef.current);
          }}
        >
          {content}
        </ErrorBoundary>
      </main>
    </>
  );
}
