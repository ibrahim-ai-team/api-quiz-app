/** 404 view (T-08; views.md §7a; US-12.2). Topic not found is in Landing. */
import { strings } from "../../strings";
import { routeHref } from "../router";
import { useDocumentTitle } from "../useDocumentTitle";
import styles from "../../components/common.module.css";

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
