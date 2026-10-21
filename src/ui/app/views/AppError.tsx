/**
 * App error view, the error boundary fallback (T-08; views.md §6; standard
 * 10, US-12.5). Retry reloads the page; the home link goes to `#/`.
 */
import { useEffect, useRef, type MouseEvent } from "react";
import { strings } from "../../strings";
import { routeHref } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";
import { ErrorIcon } from "./BankStatus";
import styles from "./views.module.css";

const HOME = routeHref({ name: "landing" });

export interface AppErrorProps {
  /** Clears the boundary; used when the home link would not change the hash. */
  readonly onReset: () => void;
  /** Injectable for tests; defaults to a full page reload. */
  readonly reload?: () => void;
}

function reloadPage(): void {
  window.location.reload();
}

export function AppError({ onReset, reload = reloadPage }: AppErrorProps) {
  useDocumentTitle(strings.title.appError);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
    const atHome = ["", "#", HOME].includes(window.location.hash);
    if (atHome) {
      event.preventDefault();
      onReset();
    }
  };

  return (
    <>
      <h1 ref={heading} tabIndex={-1} className={styles.heading}>
        <ErrorIcon />
        {strings.error.appHeading}
      </h1>
      <p className={styles.text}>{strings.error.appBody}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.buttonPrimary} onClick={reload}>
          {strings.common.retry}
        </button>
        <a className={styles.standaloneLink} href={HOME} onClick={goHome}>
          {strings.common.home}
        </a>
      </div>
    </>
  );
}
