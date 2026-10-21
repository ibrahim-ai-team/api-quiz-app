/**
 * Landing placeholder (T-08). T-09 replaces it with the real Landing view
 * (topic list, Start); the shell already shows the loading and data-error
 * states in the topic area (views.md §1, §5, §6).
 */
import { strings } from "../../strings";
import type { BankState } from "../bankState";
import { useDocumentTitle } from "../useDocumentTitle";
import { BankStatus } from "./BankStatus";
import styles from "./views.module.css";

export interface LandingPlaceholderProps {
  readonly bank: BankState;
  readonly onRetry: () => void;
}

export function LandingPlaceholder({ bank, onRetry }: LandingPlaceholderProps) {
  useDocumentTitle(
    bank.status === "error" ? strings.title.dataError : strings.title.landing,
  );
  return (
    <>
      <h1 tabIndex={-1} className={styles.heading}>
        {strings.landing.heading}
      </h1>
      <p className={styles.text}>{strings.landing.description}</p>
      {bank.status !== "ready" && <BankStatus state={bank} onRetry={onRetry} />}
    </>
  );
}
