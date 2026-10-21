/** 404 and Topic not found (T-08; views.md §7; US-12.2, FR-24). */
import { strings } from "../../strings";
import { routeHref } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";
import styles from "./views.module.css";

const HOME = routeHref({ name: "landing" });

export function NotFound() {
  useDocumentTitle(strings.title.notFound);
  return (
    <>
      <h1 tabIndex={-1} className={styles.heading}>
        {strings.notFound.heading}
      </h1>
      <p className={styles.text}>{strings.notFound.body}</p>
      <a className={styles.standaloneLink} href={HOME}>
        {strings.common.home}
      </a>
    </>
  );
}

/**
 * Unknown topic deep link. The slug is never echoed (views.md §7b). T-09
 * renders the topic list below this heading; until then a home link is shown.
 */
export function TopicNotFound() {
  useDocumentTitle(strings.title.topicNotFound);
  return (
    <>
      <h1 tabIndex={-1} className={styles.heading}>
        {strings.notFound.topicHeading}
      </h1>
      <p className={styles.text}>{strings.notFound.topicBody}</p>
      <a className={styles.standaloneLink} href={HOME}>
        {strings.common.home}
      </a>
    </>
  );
}
