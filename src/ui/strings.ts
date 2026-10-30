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
  /** copy:app.tagline */
  appTagline: "API Interview Practice",
  pageTitle,
  /** Default label for `renderRichText` code boxes (copy:question.codeLabel). */
  codeLabel,
  common: {
    /** Visible and part of the link's accessible name. */
    newTabCue: "(opens in new tab)",
    retry: "Retry",
    home: "Go to the home page",
    /** copy:common.cancel: secondary button of the inline confirmations (§9.6). */
    cancel: "Cancel",
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
    /**
     * copy:title.results; `scope` is the topic name or "Mixed". A `null`
     * scope (unknown topic id) omits that segment, as for the question title.
     */
    results: (scope: string | null): string =>
      scope === null ? pageTitle("Results") : pageTitle("Results", scope),
    /**
     * copy:title.questionRetry (US-5, views.md §8.4); `scope` is the original
     * topic name or "Mixed"; `null` (unknown id) omits that segment.
     */
    questionRetry: (k: number, n: number, scope: string | null): string => {
      const heading = `Question ${String(k)} of ${String(n)}`;
      return scope === null
        ? pageTitle(heading, "Retry")
        : pageTitle(heading, "Retry", scope);
    },
    /** copy:title.resultsRetry (US-5.5); `null` scope omits that segment. */
    resultsRetry: (scope: string | null): string =>
      scope === null
        ? pageTitle("Retry results")
        : pageTitle("Retry results", scope),
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
    /** copy:landing.bestScore (US-6.1, views.md §9.3). */
    bestScore: (pct: number): string => `Best score: ${String(pct)}%`,
    /** copy:landing.difficultyLegend (US-11, views.md §10.3). */
    difficultyLegend: "Difficulty",
    /** copy:landing.difficultyAll: the default difficulty radio. */
    difficultyAll: "All",
    /** copy:landing.difficulty.*: radio labels. */
    difficulty: { easy: "Easy", medium: "Medium", hard: "Hard" },
    /** copy:landing.difficultyWord.*: lower-case form inside sentences. */
    difficultyWord: { easy: "easy", medium: "medium", hard: "hard" },
    /** copy:landing.lengthLegend; the radio labels are the numerals. */
    lengthLegend: "Number of questions",
    /**
     * copy:landing.shortHint (US-11.1, §10.4); plural by n. `difficulty` is a
     * `difficultyWord` value, omitted with All.
     */
    shortHint: (n: number, difficulty?: string): string => {
      const word = difficulty === undefined ? "" : `${difficulty} `;
      return n === 1
        ? `Only 1 ${word}question is available, so this quiz will have 1.`
        : `Only ${String(n)} ${word}questions are available, so this quiz will have ${String(n)}.`;
    },
    /** copy:landing.noneHint (US-11.2, §10.4); a `difficultyWord` value. */
    noneHint: (difficulty: string): string =>
      `There are no ${difficulty} questions for this choice. Choose another difficulty or topic.`,
    start: "Start quiz",
    startHint: "Choose a topic to start.",
    /** copy:landing.replaceMessage (US-6.4, views.md §9.6). */
    replaceMessage: "This will discard your unfinished quiz.",
    /** copy:landing.replaceConfirm */
    replaceConfirm: "Start new quiz",
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
  /** Resume card (US-6.2, views.md §9.4). */
  resume: {
    heading: "Unfinished quiz",
    /** copy:resume.summary; `scope` = topic name or "Mixed", plural by n. */
    summary: (scope: string, answered: number, n: number): string =>
      n === 1
        ? `${scope} quiz: ${String(answered)} of 1 question answered.`
        : `${scope} quiz: ${String(answered)} of ${String(n)} questions answered.`,
    /** copy:resume.summaryRetry: a saved retry-missed quiz. */
    summaryRetry: (scope: string, answered: number, n: number): string =>
      n === 1
        ? `${scope} retry of missed questions: ${String(answered)} of 1 question answered.`
        : `${scope} retry of missed questions: ${String(answered)} of ${String(n)} questions answered.`,
    resume: "Resume quiz",
    discard: "Discard quiz",
    discarded: "Unfinished quiz discarded.",
  },
  /** Load notice (US-6.3, §9.5) and Reset progress (US-6.6, §9.6). */
  progress: {
    sessionRemoved:
      "Your unfinished quiz could not be restored, so it was removed.",
    bestRemoved:
      "Your saved best scores could not be read, so they were removed.",
    /** copy:progress.heading: h2 of "Your progress" (US-6.6, views.md §9.6). */
    heading: "Your progress",
    /** copy:progress.description (US-6.8 transparency). */
    description:
      "Best scores and your unfinished quiz are saved only in this browser on this device.",
    /** copy:progress.reset: trigger of the reset confirmation. */
    reset: "Reset progress",
    /** copy:progress.resetMessage: focused when the confirmation opens. */
    resetMessage:
      "This will delete your best scores and any unfinished quiz from this browser. This cannot be undone.",
    /** copy:progress.resetConfirm */
    resetConfirm: "Yes, reset progress",
    /** copy:progress.resetDone: replaces the confirmation; focused. */
    resetDone: "Your progress has been reset.",
    /** copy:progress.resetFailed: `clearAppKeys` returned `ok: false`; focused. */
    resetFailed: "Your progress could not be reset. Try again.",
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
    /** copy:question.retryLabel: line under the h1 of a retry quiz (US-5). */
    retryLabel: "Retry: missed questions",
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
  results: {
    heading: "Your results",
    /** copy:results.score (US-4.1) */
    score: (x: number, n: number): string => `${String(x)} / ${String(n)}`,
    /** copy:results.percent; the value is rounded half-up by T-14. */
    percent: (pct: number): string => `${String(pct)}%`,
    /** copy:results.band.* (US-4.2), keyed by the domain `ScoreBand`. */
    band: {
      zero: "No correct answers this time. Read the explanations and try again.",
      low: "A start. Review the explanations and try again to build on it.",
      mid: "Good progress. A bit more practice will make it solid.",
      high: "Strong result. You are close to mastering this.",
      perfect: "Perfect score. Every answer was correct.",
    },
    breakdownHeading: "Score by topic",
    /** copy:results.breakdownItem */
    breakdownItem: (topic: string, x: number, n: number): string =>
      `${topic}: ${String(x)} / ${String(n)}`,
    tryAgain: "Try again",
    chooseAnother: "Choose another topic",
    /** copy:results.retryMissed; n = missed questions still in the bank. */
    retryMissed: (n: number): string =>
      n === 1
        ? "Retry 1 missed question"
        : `Retry ${String(n)} missed questions`,
    /** copy:results.retryPartial (US-5.6); n = missed questions removed. */
    retryPartial: (n: number): string =>
      n === 1
        ? "1 missed question is no longer available and will be left out."
        : `${String(n)} missed questions are no longer available and will be left out.`,
    /** copy:results.retryNone (US-5.6); singular when 1 question was missed. */
    retryNone: (missed: number): string =>
      missed === 1
        ? "The question you missed is no longer available, so there is nothing to retry."
        : "The questions you missed are no longer available, so there is nothing to retry.",
    /** copy:results.retryHeading: h1 of a retry quiz's results (US-5.5). */
    retryHeading: "Retry results",
    /**
     * copy:results.retryNote (US-5.5). Rendered only when storage is
     * persistent (T-42, views.md §9.1 U2): `ResultsProps.showRetryBestScoreNote`.
     */
    retryNote:
      "This was a retry of your missed questions, so it does not count toward your best score.",
    /**
     * copy:results.filteredNote (US-11, views.md §10.6). Rendered only when
     * storage is persistent: `ResultsProps.showFilteredNote`.
     */
    filteredNote:
      "This quiz used a difficulty filter or fewer than 10 questions, so it does not count toward your best score.",
    /** copy:results.startFull: primary on retry results (US-5.5). */
    startFull: "Start a full quiz",
  },
  review: {
    /** copy:review.toggle: h2 disclosure button, same label open and closed. */
    toggle: "Review answers",
    /** copy:review.itemHeading; `verdict` = feedback.correct / .incorrect. */
    itemHeading: (k: number, verdict: string): string =>
      `Question ${String(k)}: ${verdict}`,
    /** copy:review.yourAnswer */
    yourAnswer: (option: string): string => `Your answer: ${option}`,
    /** copy:review.promptCodeLabel; numbered only when count > 1. */
    promptCodeLabel: (k: number, index: number, count: number): string =>
      count > 1
        ? `Question ${String(k)} code example ${String(index)} of ${String(count)}`
        : `Question ${String(k)} code example`,
    /** copy:review.explanationCodeLabel; numbered only when count > 1. */
    explanationCodeLabel: (k: number, index: number, count: number): string =>
      count > 1
        ? `Question ${String(k)} explanation code example ${String(index)} of ${String(count)}`
        : `Question ${String(k)} explanation code example`,
  },
} as const;
