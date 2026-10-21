# Requirements Analysis: ApiQuiz (`api-quiz`)

- **Delegation:** QUIZ-DISC-D02 (business-analyst), phase SPECIFICATION (Gate 1)
- **Input:** `01-product-brief.md` (QUIZ-DISC-D01). This document adds to the brief and does not replace it. Story IDs (US-n), assumptions (A-n) and success criteria (SC-n) refer to the brief.
- **Status:** Draft, not sponsor-approved. Date: 2026-10-21.
- **Labels used:** *Fact* = sponsor statement (F1-F5). *Assumption* = brief assumption or a BA default marked **[BA-default]**. *Proposal* = proposed amendment that the PO needs to accept.

## 1. User journeys

**J1: First-time quiz on mobile (P1/P3; US-1, 2, 3, 4, 9, 10, 12)**
1. The user opens the shared URL on a phone (375px, portrait, possibly a slow 3G connection). A loading indicator appears if loading takes longer than about 300 ms.
2. The landing page shows a one-sentence description, a note on accuracy and sources, a list of topics with question counts, and "Mixed".
3. The user taps a topic, then "Start" (2 interactions, G1). "Question 1 of N" appears with the topic and shuffled options.
4. The user taps an option and taps Submit. Feedback (Correct/Incorrect, the correct option, the explanation and a source link) appears below the options. The view scrolls the feedback into view, and the Next button can be reached with the thumb.
5. The user repeats this until "See results". The results screen shows X / N, the percentage and a message, followed by Try again / Choose another topic / Review.
- Alternates: the device is rotated mid-question (state is kept, US-9). The user taps the source link (it opens in a new tab and the quiz state is not lost). The network drops after load (the quiz continues, SC-6).

**J2: Desktop review and retry (P2; US-1, 4, 5, 6)**
1. On a 1280px screen the user, keyboard-first, starts "Mixed" and finishes 10 questions with 6/10.
2. The user opens Review. Each item shows the prompt, the user's answer, the correct answer, the explanation and the source.
3. The user presses "Retry missed", which starts a 4-question quiz made only of the missed questions, with options reshuffled. The user finishes 3/4.
4. The user returns to the landing page. "Mixed" shows a best score of 60%. The retry-missed run does not count toward the best score **[BA-default, see G7]**.

**J3: Resume an interrupted quiz (P3; US-6)**
1. On question 4 of 10 the phone locks, or the tab is closed or reloaded. Progress was already saved after each submitted answer and on every navigation.
2. The user reopens the app. The landing page shows the banner "You have an unfinished <Topic> quiz (3 of 10 answered). Resume / Discard".
3. Resume opens question 4 with the **same question order and the same option order**. Answers already submitted stay locked. If question 4 had an option selected but not submitted, the selection is not restored **[BA-default]**.
4. Alternates: the user chooses Discard (the saved quiz is deleted). The user starts a different quiz instead (this replaces the saved quiz, see FR-19). The saved data is invalid or stale (it is discarded with a non-blocking notice, see section 3).

**J4: Content maintainer adds a question (P4; US-7, 8)**
1. The maintainer creates a feature branch and adds an entry to the question data file: a new stable `id`, a `topic` from the controlled topic list, the options with stable option IDs, `correct`, the explanation, an https `sourceUrl`, and `reviewStatus: draft`.
2. The maintainer runs the local validation script. Any failure names the question ID and the field.
3. The maintainer opens a PR and CI runs the schema validation.
4. A reviewer who is not the author checks the answer key against the cited source and then sets `reviewed` and `reviewedBy`, either in the PR or in a follow-up commit.
5. The human repository owner merges. The deploy publishes the new content. Saved resumes that reference changed questions are invalidated safely (FR-20).
- Alternates: a correction to an existing question keeps its `id`. If the meaning of the answer changes, a new `id` is created and the old one is removed. A question is removed after a confirmed wrong-key report (US-8).

## 2. Functional requirements

| ID | Requirement | Traces to |
| --- | --- | --- |
| FR-1 | The landing page lists each topic that has at least 1 *production-eligible* (reviewed) question, in a fixed curated order, with its count, plus "Mixed" showing the total count. | US-1, US-7 |
| FR-2 | Starting a topic quiz draws N = min(10, count) distinct questions from that topic in random order. | US-1 |
| FR-3 | Starting "Mixed" draws 10 distinct questions from at least 3 topics. If fewer than 10 eligible questions exist overall, N = count. | US-1 |
| FR-4 | Randomisation uses an injectable seeded RNG so that tests are deterministic. The generated question order and per-question option order are fixed when the quiz starts and stored with the quiz. | US-1, US-2, US-6 |
| FR-5 | The question view shows the topic, "k of N", the prompt, and options as a single-select group. Single-choice options are shuffled. True/false keeps the fixed order "True, False" **[BA-default]**. | US-2 |
| FR-6 | Submit can only be used once an option is selected. After submit the answer is locked. | US-2 |
| FR-7 | Prompts and explanations support a restricted formatting subset (paragraphs, inline code, fenced code blocks). This content is rendered as text, never as raw HTML. | US-2, US-3, NFR-5 |
| FR-8 | Feedback shows the text "Correct" or "Incorrect", marks the correct option, marks the user's choice when it is wrong, and shows the explanation and source link (new tab, `rel="noopener noreferrer"`, visible "opens in new tab" cue). | US-3 |
| FR-9 | The Next control advances to the next question. On the last question it reads "See results". | US-3 |
| FR-10 | Results show "X / N", a whole-number percentage (half-up rounding, e.g. 2/3 = 67%) and a band message (0%, 1-49%, 50-79%, 80-99%, 100%). A per-topic breakdown is shown only for quizzes that cover more than 1 topic. | US-4 |
| FR-11 | "Try again" starts a new quiz with the same scope (a fresh draw and shuffle). "Choose another topic" returns to the landing page. | US-4 |
| FR-12 | Review lists every question with the user's answer, the correct answer, the explanation and the source. | US-5 |
| FR-13 | "Retry missed" appears only when at least 1 answer was wrong. It starts a quiz made of exactly the missed questions, with options reshuffled. It can be repeated on its own results. | US-5 |
| FR-14 | A best percentage is stored for each topic and for "Mixed" when a normal (not retry-missed) quiz is completed, and it is shown on the landing page. | US-6 |
| FR-15 | The in-progress quiz (scope, question IDs, option order, submitted answers as option IDs, current index, content version, schema version, timestamp) is saved after each submit and each Next. | US-6 |
| FR-16 | On load, if a valid saved quiz exists, Resume / Discard is offered. Resume restores the exact question and option order. | US-6 |
| FR-17 | "Reset progress" (in the footer or About section) asks for confirmation and then clears all app-owned storage keys only. | US-6 |
| FR-18 | If storage is unavailable, throws errors or is full, the app works in memory only and hides best-score, resume and reset. A storage write error never interrupts the quiz. | US-6 |
| FR-19 | Only 1 in-progress quiz exists at a time. Starting a new quiz while a resumable one exists replaces it after an inline confirmation ("This will discard your unfinished quiz") **[BA-default]**. | US-6 |
| FR-20 | A saved quiz is discarded with a non-blocking notice if it fails to parse, has an unknown schema version, or references a question or option ID that no longer exists. Best scores are kept if they still parse. | US-6, US-7 |
| FR-21 | The question schema enforces the US-7 fields plus: stable option `id`s, `correct` referencing an option `id`, true/false = exactly 2 options, single-choice = 3-4 options, `topic` from a controlled topics list, `sourceUrl` must be https, `reviewedBy` required when `reviewed`, and a top-level `schemaVersion` and `contentVersion`. | US-7 |
| FR-22 | CI fails, naming the question ID, on any schema error, duplicate question or option ID, duplicate option text (trimmed, case-insensitive), or a missing or ambiguous correct answer. CI also fails if the counts after draft exclusion are below US-8 thresholds (release builds only). | US-7, US-8 |
| FR-23 | Each question in feedback and review has a "Report a problem with this question" link (see G1). The landing page links to the general report channel. | US-12, US-8 |
| FR-24 | Unknown routes show a 404 view with a link home. A deep link to an unknown topic shows "Topic not found" plus the topic list. A deep link to a valid topic preselects it but does not auto-start. | US-12 |
| FR-25 | If loading the question data or app chunks fails, a readable error with "Retry" is shown. Retry reloads without a full page refresh where possible. | US-12 |
| FR-26 | The browser Back button during a quiz returns to the landing page with the quiz saved (resumable). It never un-submits an answer. An explicit "Exit quiz" control does the same. | US-2, US-6 |
| FR-27 | The document title updates per view (e.g. "Question 3 of 10 - HTTP methods - ApiQuiz"). | US-10 |

## 3. Non-functional requirements

| ID | Requirement (measurable) | Traces to |
| --- | --- | --- |
| NFR-1 | Performance: Lighthouse mobile Performance at least 90. First-load JS at most 200 KB gzipped. Answer submit to visible feedback takes at most 100 ms on a mid-range mobile profile. | SC-5; US-2, US-3 |
| NFR-2 | Accessibility: WCAG 2.2 AA. 0 critical or serious axe-core violations. Full quiz can be completed with keyboard only. `lang="en"`. | SC-4; US-10 |
| NFR-3 | Responsive: no horizontal scroll at 320/375/768/1280/1920 px. Reflow at 400% zoom at a 1280px width (WCAG 1.4.10). Touch targets at least 44x44 px. | SC-3; US-9 |
| NFR-4 | Privacy: no PII, cookies, analytics or third-party requests. Storage holds only question and option IDs, scores, timestamps and versions. Storage use is at most 50 KB. | A3, A11; US-6 |
| NFR-5 | Security: HTTPS only, strict CSP (no `unsafe-inline` scripts, no third-party origins), no runtime third-party scripts, content rendered without `innerHTML` from data. | US-7, FR-7 |
| NFR-6 | Maintainability: questions are in validated data files. The validation script runs both locally and in CI. UI strings are in a single module (A12). | US-7; P4 |
| NFR-7 | Offline after load: once the first load completes, a full quiz, results, review and retry make 0 network requests. Source and report links are the only exceptions, because the user follows them. | SC-6; US-1 to US-5 |
| NFR-8 | Compatibility: latest 2 versions of Chrome, Edge, Firefox and Safari, plus iOS Safari and Android Chrome, including private/incognito modes. | A9; US-6, US-9 |
| NFR-9 | Robustness: no uncaught exception reaches the user. Any unexpected error shows a recoverable error view with "Back to home". | US-12 |
| NFR-10 | Content quality: 100% of shipped questions are `reviewed` by a reviewer who is not the author, and each has a primary-source URL. | SC-2; US-8 |

## 4. Edge cases and error states per story

- **US-1:** a topic with 0 eligible questions is hidden (all drafts counts as 0). If the total bank has fewer than 3 topics, "Mixed" relaxes the at-least-3-topics rule rather than failing. If only 1 topic exists, "Mixed" is hidden. A topic with fewer than 10 questions gives N = count, and the label shows "5 questions". Double-tapping Start must not create 2 quizzes. For a deep link to an unknown or renamed topic slug, see FR-24. A seeded RNG can by chance produce the same order twice for small topics, so tests assert this with a seed and not by probability.
- **US-2:** a very long prompt or option wraps, and the options remain reachable. A code block scrolls inside its own box (`tabindex="0"` so keyboard users can scroll it, with a label). Double-submit or a rapid Submit then Next only advances 1 question. Rotation or resize after selecting but before Submit keeps the selection (in-memory state). Disabled Submit: use `aria-disabled` plus a hint so that the button stays discoverable **[BA-default]**.
- **US-3:** a broken or unreachable source URL is out of the app's control, and CI may optionally run a link check (warning only). Offline, the source link fails in the new tab only, and the quiz is unaffected. Screen reader: a polite live region (`role="status"`) announces "Correct." or "Incorrect. Correct answer: <option>." and focus moves to the Next button. The explanation is reachable by reading order. The full explanation is not announced twice (see G4).
- **US-4:** 0% and 100% band messages. N = 1 (e.g. Retry missed with 1 question). Refreshing on the results screen: results are part of saved state until the user leaves the results screen, or show an "unavailable" note **[BA-default: keep last results in session state]**.
- **US-5:** all answers correct means Retry missed is hidden. All answers wrong means Retry missed contains all N. A retry-missed quiz is not counted for best score (G7). A missed question removed by a new deploy is dropped from the retry, and if none remain, a notice is shown.
- **US-6:** storage is unavailable (Safari private on older versions, or disabled by policy), `setItem` throws `QuotaExceededError`, or access throws `SecurityError` (iframes or blocked cookies). All of these result in in-memory mode (FR-18). Corrupted JSON or a wrong shape is discarded (FR-20). Schema version change: if there is a migration it runs, otherwise saved data is discarded. Content version change with question IDs still present: resume is allowed. A missing question or option ID: discard. Two tabs: last write wins. The other tab detects the change through the `storage` event and, on its next action, shows "This quiz was changed in another tab" and offers to reload **[BA-default]**. A clock change has no effect (timestamps are informational). The user clearing site data mid-quiz: the quiz continues in memory.
- **US-7:** invalid JSON, a missing field, an unknown topic, `correct` not among the option IDs, duplicate IDs across files, a non-https or empty `sourceUrl`, an explanation under 20 chars, `reviewed` without `reviewedBy`. All of these fail CI and name the ID.
- **US-8:** draft exclusion pushes a topic below 5 or the bank below 60: the release build fails with a count report, and dev builds only warn. An ambiguous question is reported after release: handle it as a defect (US-8).
- **US-9:** rotation mid-feedback keeps the feedback visible. The on-screen keyboard is not applicable (no text input). Viewport 320 px at 200% text: no clipping. Landscape on a short phone (height about 360 px): Next reachable by scrolling, with no fixed footer covering content (2.4.11).
- **US-10:** keyboard-only (Tab to the group, arrow keys to choose, Enter/Space to submit), focus after Next goes to the question heading, focus after Exit or 404 goes to the main heading. Reduced motion. Forced-colours / Windows High Contrast mode: the selected, correct and wrong states use shape or icon plus text, not colour alone. A screen reader announces the progress "Question 3 of 10".
- **US-12:** slow network: indicator, and after 10 s an extra message "Still loading..." with Retry. Offline on first visit: the browser's own error page, which the app cannot handle, is acceptable for MVP (no PWA). A chunk or data load failure after a deploy (stale cached index): show an error with Retry that reloads the page. A report link while offline fails outside the app.
- **US-11 (P2):** fewer questions than the requested length gives "Only 3 hard questions available, starting 3", or 0 available gives a disabled Start with an explanation.
- **US-13 (P3):** a theme change mid-quiz keeps state, and both themes pass the contrast checks.

## 5. Gaps and contradictions (with recommended resolution)

| ID | Gap / contradiction | Recommended resolution |
| --- | --- | --- |
| G1 | **US-12 open question: where to report a wrong question.** | **Default: a prefilled GitHub "new issue" link** (`/issues/new?template=question-report.yml&title=[Question] <id>`), whose body contains only the question ID, content version and an optional free-text field. The app sends nothing automatically. The link is shown per question (FR-23) and on the landing page. **Privacy:** the reporter needs a GitHub account, and the issue plus their username are public. The issue form warns the user not to include personal data. The app adds no answers or device data. This depends on D2 (public repo). **Fallback if the repo is private:** a `mailto:` to a dedicated project alias with a prefilled subject and body. This exposes the reporter's email to maintainers and publishes the alias address (spam risk). It needs a sponsor-provided alias, so it is not a new decision unless D2 = private. |
| G2 | US-7 has no option IDs. Storing answers or option order by index breaks when content is edited. | Add stable option `id`s; `correct` references an option ID (FR-21). |
| G3 | A4 says "4 options", but US-7 says "2-4 options". | Single-choice has 3-4 options and true/false has exactly 2 (FR-21). |
| G4 | US-10 asks for a live-region announcement and also focus movement. Doing both risks a double or noisy announcement, and focus after Submit is unspecified. | On Submit: a short live-region verdict, then focus moves to Next. On Next: focus moves to the question heading (FR-8, section 4). |
| G5 | US-9 tests 200% zoom, but WCAG 1.4.10 reflow means 400% at 1280px (equivalent to 320 CSS px). | Tighten US-9 (see section 6). |
| G6 | US-6 does not cover multiple tabs, starting a new quiz while one is saved, stale content after a deploy, or schema versioning. | FR-15, FR-19, FR-20 and the US-6 edge cases. |
| G7 | It is unclear whether "Mixed" and Retry-missed runs count toward best score. | Mixed has its own best score. Retry-missed runs are excluded (FR-14). |
| G8 | US-12 "data fails to load" conflicts with bundled JSON (A2), where data cannot fail separately. | Keep the criterion and scope it to "data or code chunk fails to load" (FR-25). The architect decides whether data is bundled or fetched. SC-6 requires full data at first load. |
| G9 | Quiz navigation is undefined for browser Back, refresh on results, and exiting a quiz. | FR-26, plus the US-4 edge case. |
| G10 | Content formatting is undefined: snippets are mentioned (US-2), but there is no markup rule, which is an XSS risk. | Restricted formatting subset rendered safely (FR-7, NFR-5). |
| G11 | US-8 "second agent or person" allows an AI to review AI-written content. This is weak assurance for G4 (accuracy). | At least 1 human approval on content PRs (the owner's merge review can count), plus recording `reviewedBy`. This links to D4. CI cannot prove reviewer is not the author. Optionally compare `reviewedBy` with the commit author (warning only). |
| G12 | Reset progress has no location in the UI, and the deep-link behaviour of topic URLs is undefined. | Footer or About section (FR-17). Topic deep link preselects the topic (FR-24). |
| G13 | Static hosting (e.g. GitHub Pages) does not serve SPA routes natively, which affects the US-12 404 view. | Architect chooses hash routing or a `404.html` fallback. Add an E2E test for a deep link refresh. |

## 6. Proposed acceptance-criteria amendments (for PO; file 01 not edited)

- **US-1:** (a) Counts and visibility use production-eligible (reviewed) questions only. (b) "Mixed" shows the total count, needs at least 2 topics to be shown, and N = min(10, total). (c) Order randomness is asserted with a seeded RNG. Replace "the order differs" with "the order is generated by the seeded shuffle". (d) Double activation of Start creates exactly 1 quiz.
- **US-2:** (a) True/false options are not shuffled. (b) Option order is fixed for the life of the quiz, including after resume. (c) The disabled Submit is still announced (`aria-disabled`) with a hint. (d) A double Submit records exactly 1 answer.
- **US-3:** (a) The live region announces the verdict and the correct option, and focus moves to Next. (b) The source link opens in a new tab with a visible and announced cue, and quiz state is preserved. (c) A "Report a problem" link carrying the question ID is present.
- **US-4:** (a) Half-up rounding with an example: 2/3 = 67%. (b) The topic breakdown appears only for multi-topic quizzes. (c) Defined band messages for 0% and 100%.
- **US-5:** (a) Retry missed reshuffles options and does not update best score. (b) Retry missed can be repeated on its results. (c) Retry missed works for N = 1.
- **US-6:** (a) Resume restores the exact question index, question order, option order and locked answers. (b) Corrupt, unknown-schema or stale-ID saved data is discarded with a non-blocking notice and never crashes. (c) Starting a new quiz while one is resumable needs an inline confirmation. (d) A storage write error mid-quiz does not interrupt the quiz. (e) Reset clears only app-owned keys. (f) "Mixed" has its own best score.
- **US-7:** (a) Option IDs, with `correct` referencing an ID. (b) True/false has exactly 2 options and single-choice has 3-4. (c) https `sourceUrl`. (d) `reviewedBy` is required only when `reviewed`. (e) `schemaVersion` and `contentVersion` present. (f) Topic comes from a controlled list. (g) Release builds fail if post-exclusion counts are below US-8 thresholds.
- **US-8:** at least 1 human approval on each content PR (G11).
- **US-9:** replace "200% zoom" with "reflow at 320 CSS px equivalent (400% at 1280px) without loss of content, and 200% text resize". Add "a short landscape viewport (about 640x360) keeps Next reachable, and no sticky element obscures the focus".
- **US-10:** (a) Forced-colours mode keeps the selected, correct and wrong states distinguishable. (b) The document title updates per view. (c) Focus after Exit, 404 and results goes to the main heading. (d) A scrollable code block can be reached with the keyboard.
- **US-12:** (a) The report channel is the G1 default. (b) A deep link to an unknown topic shows "Topic not found" with the topic list. (c) A deep link refresh works on the chosen static host. (d) A slow load shows an indicator, and after 10 s a "Still loading" message with Retry. (e) A chunk load failure after a deploy offers a Retry that reloads.

## 7. Open questions (defaults apply unless the sponsor objects)

- OQ-1 (links to D2): if the repo is private, the report channel falls back to `mailto` and a project email alias must be provided. **Default:** public repo plus a GitHub issue form.
- OQ-2 (links to D4): human approval on content PRs. **Default:** the repository owner's PR review counts as the human check.
- OQ-3: does resume expire? **Default:** no time expiry; it is invalidated only by schema or ID changes (FR-20).
