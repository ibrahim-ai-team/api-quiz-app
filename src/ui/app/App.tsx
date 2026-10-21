/**
 * App shell (T-08, issue #28; views.md §0): skip link, header with the brand,
 * `<main>` focus target, hash routes, bank loading state and error boundary.
 * T-12 adds the quiz session reducer, the Question view and Exit.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { LoadBankResult } from "../../content/loader";
import { createQuiz, randomSeed, type QuizScope } from "../../domain";
import { strings } from "../strings";
import common from "../components/common.module.css";
import styles from "./App.module.css";
import {
  bankReducer,
  initialBankState,
  isPlayableTopic,
  type BankState,
} from "./bankState";
import { ErrorBoundary } from "./ErrorBoundary";
import { parseRoute, routeHref, routeKey, type Route } from "./router";
import { sessionReducer, type SessionState } from "./session";
import { Landing } from "../views/Landing/Landing";
import { Question } from "../views/Question/Question";
import { useHashRoute } from "./useHashRoute";
import { AppError } from "./views/AppError";
import { NotFound } from "./views/NotFound";
import { ResultsPlaceholder } from "./views/Placeholders";

export interface AppProps {
  /** Started at module top level in main.tsx; resolves, never rejects. */
  readonly bankPromise: Promise<LoadBankResult>;
  /** Starts a new bank request for Retry (FR-25). */
  readonly reloadBank: () => Promise<LoadBankResult>;
}

type ViewId =
  | "landing"
  | "topic"
  | "topicNotFound"
  | "quiz"
  | "quizFinished"
  | "noQuiz"
  | "results"
  | "notFound";

const LANDING_HREF = routeHref({ name: "landing" });

function viewFor(route: Route, bank: BankState, session: SessionState): ViewId {
  if (route.name === "quiz") {
    if (session === null) return "noQuiz";
    return session.phase === "finished" ? "quizFinished" : "quiz";
  }
  if (route.name !== "topic") return route.name;
  return bank.status === "ready" && !isPlayableTopic(bank.bank, route.topicId)
    ? "topicNotFound"
    : "topic";
}

function focusHeading(main: HTMLElement | null): void {
  main?.querySelector<HTMLElement>("h1")?.focus();
}

/** Route of a full URL from a `hashchange` event; never throws. */
function routeOfUrl(url: string): Route {
  const hash = url.indexOf("#");
  return parseRoute(hash === -1 ? "" : url.slice(hash));
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

  // Quiz session (standard 8, T-09-R01 N3). `scope` is Landing's
  // bank-derived selection (SEC-R06 N-2); Landing guards double activation.
  const [session, dispatchSession] = useReducer(sessionReducer, null);
  const startQuiz = useCallback(
    (scope: QuizScope): boolean => {
      if (bank.status !== "ready") return false;
      const result = createQuiz(bank.bank, scope, randomSeed());
      if (!result.ok) return false;
      dispatchSession({ type: "started", quiz: result.quiz });
      window.location.hash = routeHref({ name: "quiz" });
      return true;
    },
    [bank],
  );

  // Exit and browser Back both leave the quiz for Landing (US-2.8, views.md
  // §2) and both clear the session, so `#/quiz` never shows a stale quiz.
  const exitQuiz = () => {
    dispatchSession({ type: "exited" });
    window.location.hash = LANDING_HREF;
  };
  useEffect(() => {
    const onHashChange = (event: HashChangeEvent) => {
      const to = routeOfUrl(event.newURL).name;
      if (
        routeOfUrl(event.oldURL).name === "quiz" &&
        (to === "landing" || to === "topic")
      ) {
        dispatchSession({ type: "exited" });
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

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
  const view = viewFor(route, bank, session);
  const viewKey = `${routeKey(route)}|${view}`;
  const shownViewKey = useRef<string | null>(null);
  useEffect(() => {
    const previous = shownViewKey.current;
    shownViewKey.current = viewKey;
    if (previous === viewKey) return;
    if (previous === null && view === "landing") return;
    focusHeading(mainRef.current);
  }, [viewKey, view]);

  // `#/quiz` with no quiz in memory (refresh, or after Exit/Back): replace
  // the entry with Landing, whose h1 is then focused (views.md §2). Layout
  // effect: the replace happens before paint, so nothing flashes (TL N3).
  useLayoutEffect(() => {
    if (view === "noQuiz") window.location.replace(LANDING_HREF);
  }, [view]);

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
      // `session` and a ready bank always exist here: a session is only
      // created from a ready bank, which never leaves "ready".
      content =
        session !== null && bank.status === "ready" ? (
          <Question
            session={session}
            topics={bank.bank.topics}
            dispatch={dispatchSession}
          />
        ) : null;
      break;
    case "noQuiz":
      content = null;
      break;
    case "quizFinished":
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
            <a className={styles.brandLink} href={LANDING_HREF}>
              {strings.appName}
            </a>
          )}
          {route.name === "quiz" && session !== null && (
            <button
              type="button"
              className={[common.buttonSecondary, styles.exit].join(" ")}
              onClick={exitQuiz}
            >
              {strings.question.exit}
            </button>
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
