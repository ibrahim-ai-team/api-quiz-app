/**
 * App shell (T-08, issue #28; views.md §0): skip link, header with the brand,
 * `<main>` focus target, hash routes, bank loading state and error boundary.
 * T-12 adds the quiz session reducer, the Question view and Exit; T-15 the
 * Results route; T-38 Review answers and Retry missed (US-5); T-42 the best
 * score per topic and Mixed (US-6.1, US-5.5, views.md §9.3).
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { LoadBankResult } from "../../content/loader";
import {
  countsTowardBest,
  createQuiz,
  randomSeed,
  score,
  updateBest,
  type Quiz,
  type QuizScope,
  type SavedBest,
} from "../../domain";
import {
  createProgressStore,
  decodeBest,
  encodeBest,
  KEYS,
  pruneUnknownTopics,
  type ProgressStore,
} from "../../storage";
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
import {
  buildRetryQuiz,
  retryAvailability,
  sessionReducer,
  type SessionState,
} from "./session";
import { Landing } from "../views/Landing/Landing";
import { Question } from "../views/Question/Question";
import { Results } from "../views/Results/Results";
import { useHashRoute } from "./useHashRoute";
import { AppError } from "./views/AppError";
import { NotFound } from "./views/NotFound";

export interface AppProps {
  /** Started at module top level in main.tsx; resolves, never rejects. */
  readonly bankPromise: Promise<LoadBankResult>;
  /** Starts a new bank request for Retry (FR-25). */
  readonly reloadBank: () => Promise<LoadBankResult>;
  /**
   * Progress storage; created once with `createProgressStore()` when
   * omitted. Injectable for tests.
   */
  readonly store?: ProgressStore;
}

type ViewId =
  | "landing"
  | "topic"
  | "topicNotFound"
  | "quiz"
  | "quizFinished"
  | "noQuiz"
  | "results"
  | "resultsUnfinished"
  | "noResults"
  | "notFound";

const LANDING_HREF = routeHref({ name: "landing" });
const QUIZ_HREF = routeHref({ name: "quiz" });
const RESULTS_HREF = routeHref({ name: "results" });

/** Decorative code mark before the app name; hidden from assistive tech. */
const BRAND_MARK = (
  <span className={styles.brandMark} aria-hidden="true">
    {"</>"}
  </span>
);

/**
 * Views that only redirect (replacing the history entry, before paint):
 * `#/quiz` with no quiz goes to Landing and a finished quiz to `#/results`
 * ("See results", and Forward after Back); `#/results` with no quiz goes to
 * Landing (refresh, views.md §4) and with an unfinished quiz to `#/quiz`.
 */
const REDIRECTS: Partial<Record<ViewId, string>> = {
  noQuiz: LANDING_HREF,
  quizFinished: RESULTS_HREF,
  noResults: LANDING_HREF,
  resultsUnfinished: QUIZ_HREF,
};

function viewFor(route: Route, bank: BankState, session: SessionState): ViewId {
  if (route.name === "quiz") {
    if (session === null) return "noQuiz";
    return session.phase === "finished" ? "quizFinished" : "quiz";
  }
  if (route.name === "results") {
    if (session === null) return "noResults";
    return session.phase === "finished" ? "results" : "resultsUnfinished";
  }
  if (route.name !== "topic") return route.name;
  return bank.status === "ready" && !isPlayableTopic(bank.bank, route.topicId)
    ? "topicNotFound"
    : "topic";
}

/**
 * Saved best scores, or null when nothing valid is stored or storage is not
 * persistent (then no best-score UI exists, views.md §9.1 U2). Never throws.
 */
function readBest(store: ProgressStore): SavedBest | null {
  if (!store.persistent) return null;
  const decoded = decodeBest(store.get(KEYS.best));
  return decoded.ok ? decoded.value : null;
}

function focusHeading(main: HTMLElement | null): void {
  main?.querySelector<HTMLElement>("h1")?.focus();
}

/** Route of a full URL from a `hashchange` event; never throws. */
function routeOfUrl(url: string): Route {
  const hash = url.indexOf("#");
  return parseRoute(hash === -1 ? "" : url.slice(hash));
}

export function App({ bankPromise, reloadBank, store: storeProp }: AppProps) {
  const route = useHashRoute();
  // One store per app (TL01). Best scores are decoded synchronously at
  // startup, so the loading reserve already has their lines (no shift).
  const [store] = useState(() => storeProp ?? createProgressStore());
  const [best, setBest] = useState(() => readBest(store));
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
  // Start pushes `#/quiz`. Try again replaces `#/results` with it, so Back
  // from the new quiz leaves for Landing as usual (US-2.8) instead of
  // reaching a results entry for a quiz that is no longer in memory.
  const beginQuiz = useCallback(
    (scope: QuizScope, replace: boolean): boolean => {
      if (bank.status !== "ready") return false;
      const result = createQuiz(bank.bank, scope, randomSeed());
      if (!result.ok) return false;
      dispatchSession({ type: "started", quiz: result.quiz });
      if (replace) window.location.replace(QUIZ_HREF);
      else window.location.hash = QUIZ_HREF;
      return true;
    },
    [bank],
  );
  const startQuiz = useCallback(
    (scope: QuizScope) => beginQuiz(scope, false),
    [beginQuiz],
  );
  // Exit and browser Back both leave the quiz for Landing (US-2.8, views.md
  // §2) and both clear the session, so `#/quiz` never shows a stale quiz.
  // Leaving the results for Landing (Choose another topic, Back, the brand
  // link) clears it too; quiz -> results keeps it.
  const exitQuiz = () => {
    dispatchSession({ type: "exited" });
    window.location.hash = LANDING_HREF;
  };
  // Try again (US-4.4, FR-11): a fresh draw for the finished quiz's scope.
  // `started` replaces the session synchronously (T-11-R01 input on #35).
  // Only from a finished quiz (SEC N-1).
  const tryAgain = () => {
    if (session?.phase !== "finished") return;
    // Cannot fail with a ready, unchanged bank (the scope came from it); if
    // it ever does, leave for Landing rather than keep stale results.
    if (!beginQuiz(session.quiz.scope, true)) exitQuiz();
  };
  // Retry missed (US-5.4, views.md §8.4): like Try again, but a quiz of the
  // finished run's missed questions still in the bank, original order,
  // seeded option shuffle; replaces `#/results` with `#/quiz`. Returns
  // false (Results then shows the "nothing to retry" notice) if none remain.
  const retryMissed = (): boolean => {
    if (session?.phase !== "finished" || bank.status !== "ready") return false;
    const result = buildRetryQuiz(bank.bank, session, randomSeed());
    if (!result.ok) return false;
    dispatchSession({ type: "started", quiz: result.quiz });
    window.location.replace(QUIZ_HREF);
    return true;
  };
  useEffect(() => {
    const onHashChange = (event: HashChangeEvent) => {
      const from = routeOfUrl(event.oldURL).name;
      const to = routeOfUrl(event.newURL).name;
      if (
        (from === "quiz" || from === "results") &&
        (to === "landing" || to === "topic")
      ) {
        dispatchSession({ type: "exited" });
      }
      // Landing reflects the last write, also from another tab (U9).
      if (to === "landing" || to === "topic") setBest(readBest(store));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [store]);

  // Best score (US-6.1, US-5.5, SEC-R13): written once per finished quiz,
  // only for a normal quiz built from the loaded bank. The ref is keyed on
  // the quiz object, so re-renders of Results never write twice. A failed
  // read counts as no best scores; a failed write is silent (U2). Every way
  // back to Landing is a hashchange, which re-reads storage (see above).
  const recordedQuiz = useRef<Quiz | null>(null);
  useEffect(() => {
    if (session?.phase !== "finished" || bank.status !== "ready") return;
    if (recordedQuiz.current === session.quiz) return;
    recordedQuiz.current = session.quiz;
    if (!store.persistent) return;
    if (!countsTowardBest(session.quiz, bank.bank.contentVersion)) return;
    const current = readBest(store);
    const next = updateBest(
      current === null ? null : pruneUnknownTopics(current, bank.bank),
      session.quiz.scope,
      score(session),
      Date.now(),
    );
    // Result ignored: Landing re-reads storage when it is shown again.
    store.set(KEYS.best, encodeBest(next));
  }, [session, bank, store]);

  // Rows show only scores of topics the bank still has (SEC-R13 finding 4).
  // While loading, the reserve uses the decoded value as is.
  const bestScores = useMemo(() => {
    if (best === null) return null;
    return bank.status === "ready"
      ? pruneUnknownTopics(best, bank.bank).scores
      : best.scores;
  }, [best, bank]);

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

  // Redirect views (see REDIRECTS), for example `#/quiz` with no quiz in
  // memory (refresh, or after Exit/Back) goes to Landing, whose h1 is then
  // focused (views.md §2). Layout effect: the replace happens before paint,
  // so nothing flashes (TL N3).
  useLayoutEffect(() => {
    const target = REDIRECTS[view];
    if (target !== undefined) window.location.replace(target);
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
          bestScores={bestScores}
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
            contentVersion={bank.bank.contentVersion}
            dispatch={dispatchSession}
          />
        ) : null;
      break;
    case "results":
      // Same guarantee as "quiz": a session implies a ready bank.
      content =
        session !== null && bank.status === "ready" ? (
          <Results
            session={session}
            topics={bank.bank.topics}
            onTryAgain={tryAgain}
            onChooseAnother={exitQuiz}
            retry={retryAvailability(bank.bank, session)}
            onRetryMissed={retryMissed}
            showRetryBestScoreNote={store.persistent}
          />
        ) : null;
      break;
    case "noQuiz":
    case "quizFinished":
    case "noResults":
    case "resultsUnfinished":
      content = null;
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
          <div className={styles.brandBlock}>
            {route.name === "quiz" ? (
              // Plain text on the quiz route: Exit is explicit (views.md §0).
              <span className={styles.brand}>
                {BRAND_MARK}
                {strings.appName}
              </span>
            ) : (
              <a className={styles.brandLink} href={LANDING_HREF}>
                {BRAND_MARK}
                {strings.appName}
              </a>
            )}
            {/* Outside the link, so its accessible name stays the app name. */}
            {/* Quiz route: hidden below 40em to keep room for Exit. */}
            <span
              className={
                route.name === "quiz"
                  ? [styles.brandTagline, styles.brandTaglineQuiz].join(" ")
                  : styles.brandTagline
              }
            >
              {strings.appTagline}
            </span>
          </div>
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
