# UI copy (T-04) - keys for `src/ui/strings.ts`

English only (A12). `{name}` = parameter. Keys marked *fn* become functions in `strings.ts`, for example `question.heading(k, n)`. Topic display names come from the controlled topic list in content (T-05), not from this file. The report issue title `[Question] <id>` belongs to `reportLink.ts` configuration, not to UI copy.

| Key | String | Notes |
| --- | --- | --- |
| `app.name` | ApiQuiz | Brand in header and title suffix |
| `app.tagline` | API Interview Practice | Header, under the brand and outside the link (not part of its accessible name); hidden on the quiz route below 40em (views.md §0) |
| `common.newTabCue` | (opens in new tab) | Visible and part of the link's accessible name |
| `common.retry` | Retry | |
| `common.home` | Go to the home page | |
| `title.landing` | Choose a topic - ApiQuiz | Every title is built as parts joined with " - " |
| `title.question` *fn* | Question {k} of {n} - {topic} - ApiQuiz | FR-27; `{topic}` = "Mixed" for Mixed |
| `title.results` *fn* | Results - {scope} - ApiQuiz | |
| `title.dataError` | Questions could not be loaded - ApiQuiz | |
| `title.appError` | Something went wrong - ApiQuiz | |
| `title.notFound` | Page not found - ApiQuiz | |
| `title.topicNotFound` | Topic not found - ApiQuiz | |
| `landing.heading` | Practise API interview questions | h1 |
| `landing.description` | Answer short quizzes on HTTP, REST, authentication and other API topics, and learn from an explanation after every question. | US-12.1 one sentence |
| `landing.topicsLegend` | Choose a topic | legend |
| `landing.topicCount` *fn* | 1 question / {n} questions | Plural by n |
| `landing.mixedLabel` | Mixed | |
| `landing.mixedDescription` | Questions from several topics | |
| `landing.start` | Start quiz | |
| `landing.startHint` | Choose a topic to start. | aria-describedby while unavailable |
| `landing.aboutHeading` | About the questions | h2 |
| `landing.accuracyNote` | Every question is written for ApiQuiz and checked against a primary source, such as an RFC or an official specification. Each answer links to its source. | US-12.1 accuracy note |
| `landing.report` | Report a problem | Followed by `common.newTabCue` |
| `loading.text` | Loading questions... | role="status" |
| `loading.still` | Still loading. Your connection may be slow. | After 10 s, followed by Retry |
| `error.dataHeading` | Questions could not be loaded | |
| `error.dataBody` | Check your connection, then try again. | |
| `error.appHeading` | Something went wrong | |
| `error.appBody` | The page could not be displayed. Try again, or go back to the home page. | |
| `notFound.heading` | Page not found | |
| `notFound.body` | There is no page at this address. | |
| `notFound.topicHeading` | Topic not found | |
| `notFound.topicBody` | That topic does not exist or has been renamed. Choose a topic from the list below. | Slug is not echoed |
| `question.heading` *fn* | Question {k} of {n} | h1, focus target |
| `question.topic` *fn* | Topic: {topic} | |
| `question.optionsLegend` | Choose one answer | legend |
| `question.codeLabel` *fn* | Code example / Code example {i} of {count} | Numbered only when count > 1 |
| `question.submit` | Submit | |
| `question.submitHint` | Choose an answer to submit. | |
| `question.exit` | Exit quiz | |
| `feedback.correct` | Correct | h2 |
| `feedback.incorrect` | Incorrect | h2 |
| `feedback.correctAnswer` *fn* | Correct answer: {option} | Only when the answer was wrong |
| `feedback.tagCorrect` | Correct answer | Option tag |
| `feedback.tagChosen` | Your answer | Option tag |
| `feedback.explanationHeading` | Explanation | h3 |
| `feedback.explanationCodeLabel` *fn* | Explanation code example / Explanation code example {i} of {count} | Code boxes in the explanation; numbered only when count > 1. Distinct from `question.codeLabel` so 2 regions never share a name (axe `landmark-unique`). Added by T-13, designer to confirm |
| `feedback.sourcePrefix` | Source: | Followed by the link (hostname plus cue) |
| `feedback.sourceUnlinked` *fn* | Source: {url} | Non-https, plain text |
| `feedback.report` | Report a problem with this question | Followed by the cue (US-3.5) |
| `feedback.next` | Next | |
| `feedback.seeResults` | See results | Last question (US-3.4) |
| `feedback.liveCorrect` *fn* | Correct: {option}. | Live region; verdict plus option (US-3.3) |
| `feedback.liveIncorrect` *fn* | Incorrect. Correct answer: {option}. | Live region |
| `results.heading` | Your results | h1, focus target |
| `results.score` *fn* | {x} / {n} | US-4.1 |
| `results.percent` *fn* | {pct}% | Half-up, computed in T-14 |
| `results.band.zero` | No correct answers this time. Read the explanations and try again. | 0% |
| `results.band.low` | A start. Review the explanations and try again to build on it. | 1-49% |
| `results.band.mid` | Good progress. A bit more practice will make it solid. | 50-79% |
| `results.band.high` | Strong result. You are close to mastering this. | 80-99% |
| `results.band.perfect` | Perfect score. Every answer was correct. | 100% |
| `results.breakdownHeading` | Score by topic | h2, only for multi-topic quizzes |
| `results.breakdownItem` *fn* | {topic}: {x} / {n} | |
| `results.tryAgain` | Try again | |
| `results.chooseAnother` | Choose another topic | |
| `title.questionRetry` *fn* | Question {k} of {n} - Retry - {scope} - ApiQuiz | US-5, views.md §8.4; `{scope}` = original topic or "Mixed"; omitted when unknown, as for `title.question` |
| `title.resultsRetry` *fn* | Retry results - {scope} - ApiQuiz | US-5.5 |
| `question.retryLabel` | Retry: missed questions | Line under the h1 on every question of a retry quiz |
| `review.toggle` | Review answers | h2 disclosure button (`aria-expanded`); same label open and closed |
| `review.itemHeading` *fn* | Question {k}: {verdict} | h3; `{verdict}` = `feedback.correct` / `feedback.incorrect` |
| `review.yourAnswer` *fn* | Your answer: {option} | The correct-answer line reuses `feedback.correctAnswer` |
| `review.promptCodeLabel` *fn* | Question {k} code example / Question {k} code example {i} of {count} | Numbered only when count > 1; unique per page (axe `landmark-unique`) |
| `review.explanationCodeLabel` *fn* | Question {k} explanation code example / Question {k} explanation code example {i} of {count} | As above |
| `results.retryMissed` *fn* | Retry 1 missed question / Retry {n} missed questions | Plural by n; n = missed questions still in the bank; not rendered when 0 (US-5.3) |
| `results.retryPartial` *fn* | 1 missed question is no longer available and will be left out. / {n} missed questions are no longer available and will be left out. | US-5.6; `aria-describedby` of the Retry button |
| `results.retryNone` *fn* | The question you missed is no longer available, so there is nothing to retry. / The questions you missed are no longer available, so there is nothing to retry. | US-5.6; singular when 1 missed; replaces the button |
| `results.retryHeading` | Retry results | h1 of a retry quiz's results, focus target |
| `results.retryNote` | This was a retry of your missed questions, so it does not count toward your best score. | US-5.5; directly under the h1 |
| `results.startFull` | Start a full quiz | Primary on retry results: fresh draw of the original scope |

Style: sentence case, no exclamation marks, no promises about interview outcomes. Use "..." (three dots), not a typographic ellipsis, so the source file stays plain ASCII; either reads the same to a screen reader.
