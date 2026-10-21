/**
 * All user-visible UI copy lives here (implementation standard 8, A12).
 * Keys follow docs/design/copy.md; `copy:<key>` names the source row.
 */

const APP_NAME = "ApiQuiz";

/** copy:question.codeLabel; numbered only when count > 1 (docs/design/copy.md). */
function codeLabel(index: number, count: number): string {
  return count > 1
    ? `Code example ${String(index)} of ${String(count)}`
    : "Code example";
}

/** copy title rule (FR-27): parts joined with " - ", app name last. */
function pageTitle(...parts: readonly string[]): string {
  return [...parts, APP_NAME].join(" - ");
}

export const strings = {
  /** copy:app.name */
  appName: APP_NAME,
  pageTitle,
  /** Default label for `renderRichText` code boxes (copy:question.codeLabel). */
  codeLabel,
  common: {
    /** Visible and part of the link's accessible name. */
    newTabCue: "(opens in new tab)",
    retry: "Retry",
    home: "Go to the home page",
  },
  shell: {
    /** Delegation T-08-D01 asks for a skip link (deviates from design A-D3). */
    skipLink: "Skip to main content",
  },
  title: {
    landing: pageTitle("Choose a topic"),
    dataError: pageTitle("Questions could not be loaded"),
    appError: pageTitle("Something went wrong"),
    notFound: pageTitle("Page not found"),
    topicNotFound: pageTitle("Topic not found"),
    /**
     * copy:title.question; `topic` is "Mixed" for a Mixed quiz. A `null`
     * topic (unknown id, SEC-R07 N-3) omits that segment.
     */
    question: (k: number, n: number, topic: string | null): string => {
      const heading = `Question ${String(k)} of ${String(n)}`;
      return topic === null ? pageTitle(heading) : pageTitle(heading, topic);
    },
    /** Placeholder until T-15 sets copy:title.results. */
    resultsPlaceholder: pageTitle("Results"),
  },
  landing: {
    heading: "Practise API interview questions",
    description:
      "Answer short quizzes on HTTP, REST, authentication and other API topics, and learn from an explanation after every question.",
    topicsLegend: "Choose a topic",
    /** copy:landing.topicCount */
    topicCount: (n: number): string =>
      n === 1 ? "1 question" : `${String(n)} questions`,
    mixedLabel: "Mixed",
    mixedDescription: "Questions from several topics",
    start: "Start quiz",
    startHint: "Choose a topic to start.",
    /** Not in copy.md (T-09-D01): production bank with 0 questions. */
    noTopics: "No questions are available yet.",
    /** Not in copy.md (T-09-D01): createQuiz returned an error. */
    startError: "The quiz could not be started. Try again.",
    aboutHeading: "About the questions",
    accuracyNote:
      "Every question is written for ApiQuiz and checked against a primary source, such as an RFC or an official specification. Each answer links to its source.",
    /** Followed by copy:common.newTabCue (US-12.1). */
    report: "Report a problem",
  },
  question: {
    /** copy:question.heading */
    heading: (k: number, n: number): string =>
      `Question ${String(k)} of ${String(n)}`,
    /** copy:question.topic */
    topic: (topic: string): string => `Topic: ${topic}`,
    optionsLegend: "Choose one answer",
    /** copy:question.codeLabel, passed explicitly for the prompt (T-12). */
    codeLabel,
    submit: "Submit",
    submitHint: "Choose an answer to submit.",
    exit: "Exit quiz",
  },
  feedback: {
    correct: "Correct",
    incorrect: "Incorrect",
    /** Only shown when the answer was wrong. */
    correctAnswer: (option: string): string => `Correct answer: ${option}`,
    tagCorrect: "Correct answer",
    tagChosen: "Your answer",
    explanationHeading: "Explanation",
    /**
     * copy:feedback.explanationCodeLabel (added by T-13): distinct from the
     * prompt's label so two code regions never share a name (landmark-unique).
     */
    explanationCodeLabel: (index: number, count: number): string =>
      count > 1
        ? `Explanation code example ${String(index)} of ${String(count)}`
        : "Explanation code example",
    sourcePrefix: "Source:",
    /** Non-https source, plain text. */
    sourceUnlinked: (url: string): string => `Source: ${url}`,
    report: "Report a problem with this question",
    next: "Next",
    seeResults: "See results",
    liveCorrect: (option: string): string => `Correct: ${option}.`,
    liveIncorrect: (option: string): string =>
      `Incorrect. Correct answer: ${option}.`,
  },
  loading: {
    text: "Loading questions...",
    still: "Still loading. Your connection may be slow.",
  },
  error: {
    dataHeading: "Questions could not be loaded",
    dataBody: "Check your connection, then try again.",
    appHeading: "Something went wrong",
    appBody:
      "The page could not be displayed. Try again, or go back to the home page.",
  },
  notFound: {
    heading: "Page not found",
    body: "There is no page at this address.",
    topicHeading: "Topic not found",
    topicBody:
      "That topic does not exist or has been renamed. Choose a topic from the list below.",
  },
  /** Interim view; replaced by T-15 (Results). */
  placeholder: {
    resultsHeading: "Your results",
    body: "This view is not available yet.",
  },
} as const;
