/**
 * Loading, Still loading and Data error states (T-08; views.md §5, §6;
 * US-12.4, US-12.5, FR-25). One component instance covers all three, so the
 * Retry button stays the same DOM node across a retry and keeps focus.
 */
import { useEffect, useId, useState } from "react";
import { strings } from "../strings";
import type { BankState } from "../app/bankState";
import styles from "./common.module.css";

/** No indicator for fast loads (J1). */
export const LOADING_DELAY_MS = 300;
/** "Still loading" plus Retry (US-12.4). */
export const STILL_LOADING_MS = 10_000;

type Phase = "hidden" | "visible" | "still";

export interface BankStatusProps {
  readonly state: Exclude<BankState, { status: "ready" }>;
  readonly onRetry: () => void;
}

export function BankStatus({ state, onRetry }: BankStatusProps) {
  const statusId = useId();
  const loading = state.status === "loading";
  const { attempt } = state;
  const userRetry = loading && state.userRetry;

  // Timer results are tagged with their attempt; a new attempt falls back to
  // the initial phase without a synchronous state update in an effect.
  const [timer, setTimer] = useState<{ attempt: number; phase: Phase }>({
    attempt: -1,
    phase: "hidden",
  });
  const initialPhase: Phase = userRetry ? "visible" : "hidden";
  const phase = timer.attempt === attempt ? timer.phase : initialPhase;

  useEffect(() => {
    if (!loading) return;
    const timers = [
      window.setTimeout(() => {
        setTimer((t) =>
          t.attempt === attempt && t.phase === "still"
            ? t
            : { attempt, phase: "visible" },
        );
      }, LOADING_DELAY_MS),
      window.setTimeout(() => {
        setTimer({ attempt, phase: "still" });
      }, STILL_LOADING_MS),
    ];
    return () => {
      timers.forEach((id) => {
        window.clearTimeout(id);
      });
    };
  }, [loading, attempt]);

  const isError = state.status === "error";
  const still = loading && phase === "still";
  const retryAvailable = isError || still;
  const showRetry = retryAvailable || userRetry;

  return (
    <div className={styles.bankStatus}>
      {isError && (
        // Re-keyed per attempt so a failed Retry is announced again.
        <div key={attempt} role="alert" className={styles.alert}>
          <h2 className={styles.alertHeading}>
            <ErrorIcon />
            {strings.error.dataHeading}
          </h2>
          <p className={styles.text}>{strings.error.dataBody}</p>
        </div>
      )}
      <div id={statusId} role="status" className={styles.statusLine}>
        {loading && phase !== "hidden" && (
          <>
            {still ? <ClockIcon /> : <Spinner />}
            <span>{still ? strings.loading.still : strings.loading.text}</span>
          </>
        )}
      </div>
      {showRetry && (
        <button
          type="button"
          className={isError ? styles.buttonPrimary : styles.buttonSecondary}
          aria-disabled={retryAvailable ? undefined : true}
          aria-describedby={loading ? statusId : undefined}
          onClick={retryAvailable ? onRetry : undefined}
        >
          {strings.common.retry}
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className={styles.spinner}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="42 15"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className={styles.icon}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 7v5l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ErrorIcon() {
  return (
    <svg
      className={styles.errorIcon}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 6.5v7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.25" r="1.5" fill="currentColor" />
    </svg>
  );
}
