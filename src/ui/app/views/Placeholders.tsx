/** Interim views for routes built later: Question (T-12), Results (T-15). */
import { strings } from "../../strings";
import { useDocumentTitle } from "../useDocumentTitle";
import styles from "./views.module.css";

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

export function QuizPlaceholder() {
  return (
    <Placeholder
      heading={strings.placeholder.quizHeading}
      title={strings.title.quizPlaceholder}
    />
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
