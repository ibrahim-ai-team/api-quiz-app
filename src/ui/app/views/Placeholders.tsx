/** Interim views for routes built later: Question (T-12), Results (T-15). */
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

export interface QuizPlaceholderProps {
  /** Questions in the started quiz, if any (T-09; T-12 builds the view). */
  readonly questionCount?: number | undefined;
}

export function QuizPlaceholder({ questionCount }: QuizPlaceholderProps) {
  return (
    <Placeholder
      heading={
        questionCount === undefined
          ? strings.placeholder.quizHeading
          : strings.question.heading(1, questionCount)
      }
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
