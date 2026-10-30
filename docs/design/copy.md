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
| `results.retryNote` | This was a retry of your missed questions, so it does not count toward your best score. | US-5.5; directly under the h1; rendered only when storage is persistent (views.md §9.1 U2) |
| `results.startFull` | Start a full quiz | Primary on retry results: fresh draw of the original scope with the default settings (All, 10; views.md §10.5) |
| `landing.bestScore` *fn* | Best score: {pct}% | US-6.1, views.md §9.3; own line in the topic row; appended to the row's accessible name after a comma; not rendered when there is no best score |
| `landing.replaceMessage` | This will discard your unfinished quiz. | US-6.4, §9.6; focused when the confirmation opens under Start |
| `landing.replaceConfirm` | Start new quiz | Primary confirm button of the replace confirmation |
| `common.cancel` | Cancel | Secondary button of both inline confirmations (§9.6) |
| `resume.heading` | Unfinished quiz | h2 of the resume card (§9.4) |
| `resume.summary` *fn* | {scope} quiz: {answered} of 1 question answered. / {scope} quiz: {answered} of {n} questions answered. | Plural by n; `{scope}` = topic name or `landing.mixedLabel`; `{answered}` = locked answers |
| `resume.summaryRetry` *fn* | {scope} retry of missed questions: {answered} of 1 question answered. / {scope} retry of missed questions: {answered} of {n} questions answered. | As above, for a saved retry-missed quiz |
| `resume.resume` | Resume quiz | Primary; US-6.2 "Resume" (DQ-US6-6) |
| `resume.discard` | Discard quiz | Secondary; US-6.2 "Discard" (DQ-US6-6) |
| `resume.discarded` | Unfinished quiz discarded. | Replaces the card after Discard; focused (`tabindex="-1"`) |
| `progress.sessionRemoved` | Your unfinished quiz could not be restored, so it was removed. | US-6.3 load notice (`role="status"`, §9.5); corrupt, unknown version or stale saved quiz |
| `progress.bestRemoved` | Your saved best scores could not be read, so they were removed. | US-6.3 load notice; follows `progress.sessionRemoved` in the same paragraph when both apply |
| `progress.heading` | Your progress | h2 of the section after "About the questions" (§9.6) |
| `progress.description` | Best scores and your unfinished quiz are saved only in this browser on this device. | US-6.8 transparency; body text |
| `progress.reset` | Reset progress | US-6.6 trigger (secondary) |
| `progress.resetMessage` | This will delete your best scores and any unfinished quiz from this browser. This cannot be undone. | Focused when the reset confirmation opens |
| `progress.resetConfirm` | Yes, reset progress | Primary confirm button; distinct from the trigger's name |
| `progress.resetDone` | Your progress has been reset. | Replaces the confirmation; focused |
| `progress.resetFailed` | Your progress could not be reset. Try again. | `clearAppKeys` returned `ok: false`; focused |
| `landing.difficultyLegend` | Difficulty | US-11, views.md §10.3; legend of the difficulty radio group |
| `landing.difficultyAll` | All | Default difficulty radio |
| `landing.difficulty.easy` | Easy | Radio label |
| `landing.difficulty.medium` | Medium | Radio label |
| `landing.difficulty.hard` | Hard | Radio label |
| `landing.difficultyWord.easy` | easy | Lower-case form used inside sentences (`landing.shortHint`, `landing.noneHint`) |
| `landing.difficultyWord.medium` | medium | As above |
| `landing.difficultyWord.hard` | hard | As above |
| `landing.lengthLegend` | Number of questions | Legend of the length radio group; the radio labels are the numerals 5, 10, 20 (no key) |
| `landing.shortHint` *fn* | Only 1 {difficulty} question is available, so this quiz will have 1. / Only {n} {difficulty} questions are available, so this quiz will have {n}. | US-11.1, §10.4; plural by n; `{difficulty}` = `landing.difficultyWord.*`, omitted with All ("Only 8 questions are available, so this quiz will have 8."); Start's `aria-describedby`; not shown with default settings |
| `landing.noneHint` *fn* | There are no {difficulty} questions for this choice. Choose another difficulty or topic. | US-11.2, §10.4; Start is `aria-disabled`; `{difficulty}` = `landing.difficultyWord.*` (never All: every shown scope has at least 1 question) |
| `results.filteredNote` | This quiz used a difficulty filter or fewer than 10 questions, so it does not count toward your best score. | §10.6, DQ-US11-1; normal quiz that is not full (All and at least min(10, available) questions); directly under the h1, like `results.retryNote`; rendered only when storage is persistent |
| `boot.heading` | ApiQuiz could not start | views.md §6.1; **static markup in `index.html`, not in `strings.ts`** (the script did not run); h1 |
| `boot.body` | Part of the app did not load. Check your connection, then retry. | §6.1; static markup in `index.html` |
| `boot.retry` | Retry | §6.1; static markup in `index.html`; link with `href=""` (full reload without the hash, lands on Home) |

Style: sentence case, no exclamation marks, no promises about interview outcomes. Use "..." (three dots), not a typographic ellipsis, so the source file stays plain ASCII; either reads the same to a screen reader.
