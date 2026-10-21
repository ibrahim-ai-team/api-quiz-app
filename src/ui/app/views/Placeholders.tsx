/**
 * Interim view for a route built later: Results (T-15). It is also shown on
 * `#/quiz` once the last question is answered, until T-15 replaces it.
 */
import { strings } from "../../strings";
import { useDocumentTitle } from "../useDocumentTitle";
import styles from "../../components/common.module.css";

interface PlaceholderProps {
  readonly heading: string;
  readonly title: string;
}

function Placeholder({ heading, title }: PlaceholderProps) {
  useDocumentTitle(title);
  return (
    <>
      <h1 tabIndex={-1} className={styles.heading}>
        {heading}
      </h1>
      <p className={styles.text}>{strings.placeholder.body}</p>
    </>
  );
}

export function ResultsPlaceholder() {
  return (
    <Placeholder
      heading={strings.placeholder.resultsHeading}
      title={strings.title.resultsPlaceholder}
    />
  );
}
