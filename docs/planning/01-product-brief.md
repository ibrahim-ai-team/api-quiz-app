# Product Brief: ApiQuiz (slug `api-quiz`, repository `api-quiz-app`)

- **Delegations:** QUIZ-DISC-D01 (product-owner, initial brief); QUIZ-DISC-D06 (product-owner, AC amendments and sponsor decisions, phase BACKLOG_READY)
- **Status:** Sponsor decisions D1-D4 recorded 2026-10-21. Acceptance criteria amended and accepted by the PO (see "Change log 2026-10-21"). All other content proceeds on documented assumptions; the sponsor has not approved the brief line by line.
- **Date:** 2026-10-21
- **Evidence state:** Nothing is implemented, built, tested, reviewed, merged or deployed. This is a product specification only.

## 1. Problem, users, goals, success criteria

### Problem
Developers getting ready for backend, full-stack or API-focused interviews need a fast and low-friction way to check and improve what they know about API concepts (REST, HTTP, status codes, auth, versioning, GraphQL basics). Generic quiz sites rarely focus on APIs. Their explanations are often shallow or wrong, and many don't work well on a phone during short study breaks.

### Personas (assumed)
| ID | Persona | Need |
| --- | --- | --- |
| P1 | **Job-seeking developer** (junior to mid-level, 0-5 yrs) | Practise likely interview questions by topic and learn from explanations |
| P2 | **Experienced engineer refreshing knowledge** | Quick mixed quiz to find weak spots before an interview |
| P3 | **Mobile learner** (any of the above, on a phone) | Short sessions on a small screen, one hand, unreliable network |
| P4 | **Content maintainer** (project team / sponsor) | Add or correct questions safely without changing code |

### Goals
- G1: A candidate can start a quiz in 2 interactions or fewer from the landing page, with no sign-up.
- G2: Every question teaches something. Each answer shows correct or incorrect plus an explanation.
- G3: Works well on desktop and mobile (responsive) and meets WCAG 2.2 AA.
- G4: The content is accurate and reviewed. A wrong answer key is treated as a defect.

### Measurable success criteria (MVP release)
| ID | Criterion | How verified |
| --- | --- | --- |
| SC-1 | 100% of MVP stories' acceptance criteria pass automated or recorded manual tests | QA test report |
| SC-2 | Future content target: at least 60 questions across at least 8 topics, all marked `reviewed` (US-8.1). The current MVP release gate is defined separately in `docs/ops/release-content-policy.md` | Schema validation script in CI |
| SC-3 | No horizontal scrolling and all features usable at 320px, 375px, 768px, 1280px and 1920px widths, and at 640x360 landscape | Automated viewport tests and screenshots |
| SC-4 | 0 critical or serious axe-core violations on all screens. Full keyboard-only completion of a quiz. Lighthouse Accessibility at least 95 | Automated a11y tests and manual keyboard check |
| SC-5 | Lighthouse Performance at least 90 (mobile profile) and first load JS at most 200 KB gzipped | Lighthouse CI / build report |
| SC-6 | After the first load, a full quiz works with no network calls (no backend). User-followed source and report links are the only exceptions | E2E test with network offline after load |

Usage metrics (completion rate, return visits) are deliberately **not** in the MVP. Collecting them needs analytics, and analytics raises a privacy and consent decision (see section 6).

## 2. Facts, assumptions, open questions, out of scope

### Confirmed facts (sponsor statements only)
- F1: Web-based application.
- F2: Quiz format.
- F3: Subject is API interview questions.
- F4: Language is English.
- F5: Responsive design that works seamlessly on desktop and mobile.
- F6 (D1, 2026-10-21): The app is named **ApiQuiz**; the repository is `api-quiz-app`.
- F7 (D2, 2026-10-21): The repository is **public** and the app is hosted on **GitHub Pages**.
- F8 (D3, 2026-10-21): The MVP has **no accounts, no backend, browser-only storage** (A1-A3 are now confirmed).
- F9 (D4, 2026-10-21): The **sponsor's PR review is the human accuracy check** for question content.

Sponsor's verbatim reply (2026-10-21): "ApiQuiz, repo publique, MVP sans compte, ma relecture suffit".

### Assumptions (routine, reversible; PO-proposed, not sponsor-confirmed unless marked)
| ID | Assumption | Rationale / trade-off |
| --- | --- | --- |
| A1 | **No user accounts in MVP.** The app is anonymous. **Confirmed by D3.** | Auth adds a backend, personal data, GDPR duties and security surface for little MVP value. Trade-off: progress cannot sync across devices. |
| A2 | **No backend in MVP.** The app is a static single-page app with the question bank shipped as versioned JSON from the repo. **Confirmed by D3.** | Simplest and cheapest, runs on free static hosting, no server to secure. Trade-off: questions update only by redeploying, and there are no server-side stats or anti-cheat. Neither matters for self-practice. |
| A3 | **Persistence is local only** (browser `localStorage`): best score per topic and for Mixed, and an in-progress quiz can be resumed. No personal data is stored. **Confirmed by D3.** | Gives "progress" value with zero privacy exposure. Trade-off: data is lost if storage is cleared and is tied to one device. |
| A4 | The MVP uses only single-answer multiple-choice questions (3-4 options) and true/false (exactly 2 options). | Easy to score objectively and accessible. Multi-select and free text come later. |
| A5 | Topics for MVP: HTTP fundamentals, HTTP methods & idempotency, status codes, REST design, authentication & authorization (API keys, OAuth 2.0, JWT), API versioning, pagination/filtering/rate limiting, GraphQL basics. Optional: caching, error handling, security (OWASP API Top 10 basics). | Covers common API interview themes. |
| A6 | Difficulty levels are tagged per question (`easy`/`medium`/`hard`). The MVP filters by topic. Filtering by difficulty is P2. | Keeps the first UI simple. |
| A7 | Default quiz length is 10 questions, drawn randomly from the chosen topic or from "Mixed". | Fits a short mobile session. |
| A8 | The quiz is untimed in MVP. | Less pressure and simpler accessibility (WCAG 2.2.1 Timing Adjustable). |
| A9 | Supported browsers: latest 2 versions of Chrome, Edge, Firefox and Safari, including iOS Safari and Android Chrome. | Standard target for a modern single-page app. |
| A10 | The question content is written by the team and reviewed for accuracy against primary sources (RFC 9110/9111, RFC 6749/6750, RFC 7519, OWASP API Security Top 10, graphql.org spec). Each question records a source reference. No third-party question banks are copied. | Accuracy and no copyright risk. |
| A11 | No analytics, cookies or third-party trackers in MVP, so no consent banner is needed. | Avoids privacy and compliance decisions. |
| A12 | UI is English only, with no i18n framework in MVP. Strings stay in one place so translation is possible later. | Sponsor specified English. |
| A13 | Problem reports use a **prefilled GitHub new-issue link** to the public `api-quiz-app` repository (follows from D2). The app sends nothing automatically; it only opens a link carrying the question ID and content version. | Zero cost, no backend, no email alias. Trade-off: reporters need a GitHub account and their issue and username are public; the issue form warns them not to include personal data. This is the reporter's own voluntary action, so no app-side personal data processing is introduced. |
| A14 | Multi-tab handling in MVP is "last write wins" plus saved-data validation; the "changed in another tab" prompt is deferred to R2. | Over-built for a P1 story; validation already prevents crashes. |

### Open questions (non-blocking; defaults apply unless the sponsor says otherwise)
- ~~Q1: Who signs off on content accuracy?~~ **Resolved by D4:** non-author review against the cited source, plus the sponsor's PR review as the human check.
- ~~Q2: Hosting target and repo visibility.~~ **Resolved by D2:** public repo, GitHub Pages.
- Q3: Is the audience junior-only or does it include senior level? The default covers all levels through difficulty tags.
- Q4: Is branding or visual identity required? The default is a neutral, accessible design system.
- Q5 (BA OQ-3): Does a saved in-progress quiz expire? Default: no time expiry; it is invalidated only by schema or question/option ID changes.

### Out of scope for MVP
User accounts and login; backend/API server and database; leaderboards and social sharing; admin or content-management UI; analytics and tracking; payments and monetisation; timed or exam mode; free-text, code-writing or AI-graded answers; languages other than English; native mobile apps; offline PWA install (only "works offline after load" is in scope); certificates; custom domain or any paid hosting (needs separate sponsor cost approval); multi-tab "changed in another tab" prompt (R2).

## 3. MVP scope and later releases

### MVP (Release 1)
Landing page with topic list -> start quiz (topic or Mixed, up to 10 questions) -> answer one question per screen -> immediate feedback with explanation, source and "Report a problem" link -> results summary with score and per-question review -> retry, or retry missed questions only. Best score per topic and for Mixed, and resume of an in-progress quiz, are stored locally. Responsive, WCAG 2.2 AA, public repository, static hosting on GitHub Pages, at least 60 reviewed questions.

D2 approves the hosting target. Each production deployment still follows the release go/no-go and the human-merge policy; a custom domain or paid plan still needs separate sponsor approval.

### Later-release ideas (unprioritised, for reference)
- R2: Difficulty filter and choice of quiz length; "study mode" (browse questions with answers); dark mode; bookmark questions; share a result as a link (no PII); multi-tab "this quiz was changed in another tab" prompt.
- R3: Installable offline PWA; timed interview simulation mode; multi-select and code-reading questions; spaced repetition of missed questions.
- R4 (needs sponsor decisions): accounts with cross-device progress, a backend and CMS for content, privacy-respecting analytics, community-submitted questions with a moderation workflow, more languages.

## 4. Prioritised backlog

Priority: P0 = MVP must, P1 = MVP should, P2 = could (stretch/next), P3 = later. Size: original PO story points 1/2/3/5.

**Estimates note (QUIZ-DISC-D06):** the Size column below keeps the original PO estimates unchanged. Delivery planning uses the tech-lead breakdown in `05-backlog-sprint-plan.md` section 1.3 (for example US-1 = 7, US-2 = 6, US-7 = 5), which is the source of truth for sprint capacity. US-6 is expected to grow after the accepted amendments and US-8 must be split; both re-estimates belong to `tech-lead` / `project-manager`, so the PO does not change them here.

### Epics
- **E1: Quiz practice flow:** US-1 to US-6, US-11
- **E2: Question bank content and quality:** US-7, US-8
- **E3: Responsive, accessible, deployable experience:** US-9, US-10, US-12, US-13

### Summary (in recommended delivery order)
| ID | Title | Epic | Pri | Size | Depends on |
| --- | --- | --- | --- | --- | --- |
| US-7 | Question bank schema and validation | E2 | P0 | 2 | none |
| US-1 | Choose a topic and start a quiz | E1 | P0 | 2 | US-7 |
| US-2 | Answer a question | E1 | P0 | 3 | US-1 |
| US-3 | Immediate feedback with explanation | E1 | P0 | 2 | US-2 |
| US-4 | Results summary and score | E1 | P0 | 2 | US-3 |
| US-9 | Responsive layout for mobile and desktop | E3 | P0 | 3 | US-1 to US-4 (runs in parallel) |
| US-10 | Accessibility to WCAG 2.2 AA | E3 | P0 | 3 | US-1 to US-4 (runs in parallel) |
| US-8 | Initial reviewed question bank (at least 60 questions) | E2 | P0 | 5 | US-7 |
| US-5 | Review answers and retry missed questions | E1 | P1 | 2 | US-4 |
| US-6 | Local best score and resume quiz | E1 | P1 | 2 | US-4 |
| US-12 | Landing/about page, error and empty states | E3 | P1 | 1 | US-1 |
| US-11 | Difficulty filter and quiz length option | E1 | P2 | 2 | US-1, US-8 |
| US-13 | Dark mode / system colour scheme | E3 | P3 | 1 | US-9, US-10 |

MVP commitment in original PO estimates is P0 + P1 = 29 points (superseded for planning by file 05). US-9 and US-10 are cross-cutting: their criteria also apply to every UI story's Definition of Done.

### Stories

Each criterion is numbered `US-n.k`; QA maps it to test ID `T-US<n>-<k>` (T-19).

**US-1: Choose a topic and start a quiz (P0, 2)**
As a job-seeking developer, I want to pick an API topic or a mixed quiz and start immediately, so that I can practise what I need without signing up.
- US-1.1: Given the landing page has loaded, When I view it, Then I see, in the curated topic order, every topic that has at least 1 production-eligible (`reviewed`) question, each showing its eligible question count, plus a "Mixed" option showing the total eligible count.
- US-1.2 (edge): Given a topic has 0 eligible questions (for example only drafts), When the landing page loads, Then that topic is not shown. Given only 1 topic is shown, Then "Mixed" is hidden.
- US-1.3: Given I select a topic, When I press "Start", Then question 1 of N appears, where N = min(10, topic eligible count), and only questions from that topic are included.
- US-1.4: Given I select "Mixed", When I start, Then N = min(10, total eligible count) distinct questions are drawn from at least min(3, number of shown topics) different topics.
- US-1.5: Given a quiz starts, When questions and options are drawn, Then the question order and single-choice option order are produced by the injected seeded shuffle and fixed at quiz start. Unit tests assert the exact order for a known seed (this replaces "the order differs between two quizzes").
- US-1.6 (edge): Given I activate "Start" twice rapidly, When the quiz starts, Then exactly 1 quiz is created.
- US-1.7: Given the landing page, When I start a quiz, Then the first question is reached in at most 2 interactions (G1).
- US-1.8: Given a deep link to a valid topic, When it opens, Then that topic is preselected and the quiz does not auto-start.
- US-1.9 (DoD): The landing view has 0 serious or critical axe violations, is fully keyboard operable, and sets a per-view document title.

**US-2: Answer a question (P0, 3)**
As a candidate, I want to read a question and choose one answer, so that I can test my knowledge.
- US-2.1: Given a question is shown, When I view it, Then I see the question text, its topic, progress ("3 of 10"), and the options as a labelled single-select radio group.
- US-2.2: Given a single-choice question, When the quiz starts, Then its options are shuffled once and keep that order for the life of the quiz, including after resume. Given a true/false question, Then the options always appear as "True, False" (not shuffled).
- US-2.3: Given no option is selected, When I reach "Submit", Then it is unavailable (`aria-disabled`, still discoverable by assistive technology) and a hint tells me to choose an answer.
- US-2.4: Given I select an option, When I press "Submit", Then my answer is locked and cannot be changed.
- US-2.5 (edge): Given I press "Submit" twice, or "Submit" then "Next" rapidly, Then exactly 1 answer is recorded and the quiz advances exactly 1 question.
- US-2.6: Given a question contains a code or HTTP snippet, When it renders, Then the snippet is shown in a monospace block that wraps or scrolls inside its own focusable, labelled box without making the page scroll horizontally.
- US-2.7 (security): Given content containing `<script>`, `<img onerror>` or a `javascript:` URL, When it renders, Then it appears as literal text and never executes.
- US-2.8: Given I am mid-quiz, When I press browser Back or "Exit quiz", Then I return to the landing page and no submitted answer is un-submitted.
- US-2.9 (DoD): The question view has 0 serious or critical axe violations; selection and submit work keyboard-only.

**US-3: Immediate feedback with explanation (P0, 2)**
As a candidate, I want to know right away whether I was correct and why, so that I learn from every question.
- US-3.1: Given I submitted an answer, When feedback appears, Then it says "Correct" or "Incorrect" in text, marks the correct option and, when I was wrong, also marks my choice, using shape or icon plus text, not colour alone.
- US-3.2: Given feedback is shown, Then the explanation and the source link are shown. The source link opens in a new tab (`rel="noopener noreferrer"`) with a visible and announced "opens in new tab" cue, and quiz state is preserved. A non-https source URL is not rendered as a link.
- US-3.3: Given I submitted an answer, When feedback appears, Then a polite live region announces the verdict and the correct option, and focus then moves to "Next".
- US-3.4: Given feedback is shown, When I press "Next", Then the next question appears. On the last question the button reads "See results".
- US-3.5: Given feedback is shown, Then a "Report a problem with this question" link opens, in a new tab with a cue, the prefilled GitHub new-issue page of the public `api-quiz-app` repository using the `question-report` issue form, titled "[Question] <question id>", carrying only the question ID and `contentVersion` (built with `URLSearchParams` from a configurable base URL). No answers, scores, device or personal data are included, and the app sends nothing automatically.
- US-3.6: Given the repository, Then a `question-report` issue form exists that asks what is wrong, states that issues and GitHub usernames are public, and asks reporters not to include personal data. (Required before US-3 is released; it is a repository file, not app code.)

**US-4: Results summary and score (P0, 2)**
As a candidate, I want a score at the end, so that I know how ready I am.
- US-4.1: Given I finished the last question, When results appear, Then I see my score as "X / N" and a whole-number percentage with half-up rounding (2/3 = 67%).
- US-4.2: Given results are shown, Then a band message matching the score is shown for 0%, 1-49%, 50-79%, 80-99% and 100%.
- US-4.3: Given the quiz covered more than 1 topic, Then a per-topic breakdown is shown; for a single-topic quiz it is not.
- US-4.4: Given results are shown, When I press "Try again", Then a fresh draw with the same scope starts; When I press "Choose another topic", Then I return to topic selection.
- US-4.5 (edge): Given N = 1, a 0% or a 100% score, When results appear, Then the score and message display correctly, and focus moves to the results heading.

**US-5: Review answers and retry missed questions (P1, 2)**
As a candidate, I want to review what I got wrong and retry only those questions, so that I focus on my weak spots.
- US-5.1: Given results are shown, When I open "Review", Then each question lists my answer, the correct answer, the explanation and the source.
- US-5.2: Given I missed at least 1 question, When I press "Retry missed", Then a quiz starts containing exactly the missed questions, with single-choice options reshuffled.
- US-5.3: Given I missed 0 questions, When results are shown, Then "Retry missed" is not offered.
- US-5.4: Given a retry-missed quiz, Then it works for N = 1 and "Retry missed" can be repeated on its own results.
- US-5.5: Given I complete a retry-missed quiz, Then my stored best score is not updated.
- US-5.6 (edge): Given a missed question was removed by a new deploy, When I retry, Then it is dropped; if none remain, a notice is shown instead of an empty quiz.

**US-6: Local best score and resume quiz (P1, 2)**
As a returning learner on the same device, I want my best score per topic remembered and an unfinished quiz resumable, so that short mobile sessions are not lost.
- US-6.1: Given I completed a normal (not retry-missed) topic quiz or Mixed quiz, When I return to the landing page, Then that topic, or Mixed, shows my best percentage. Mixed has its own best score.
- US-6.2: Given I leave mid-quiz and reload within the same browser, When the landing page loads, Then I am offered "Resume" or "Discard". Resume restores the exact question index, question order, option order and locked answers.
- US-6.3 (edge): Given saved data is corrupt, has an unknown schema version, or references a question or option ID that no longer exists, When the app loads, Then it is discarded with a non-blocking notice and the app never crashes. Valid best scores are kept.
- US-6.4: Given a resumable quiz exists, When I start a new quiz, Then an inline confirmation ("This will discard your unfinished quiz") is shown, and confirming replaces the saved quiz.
- US-6.5: Given `localStorage` is unavailable, full or throws, When I use the app, Then quizzes still work in memory and the progress features (best score, resume, reset) are hidden. A storage write error mid-quiz never interrupts the quiz.
- US-6.6: Given I press "Reset progress" and confirm, When the action completes, Then only the app's own (`apiquiz:`) storage keys are cleared.
- US-6.7 (edge): Given the app is open in 2 tabs, Then the last write wins and the other tab's saved data is still validated per US-6.3. No "changed in another tab" prompt is shown in MVP (deferred to R2).
- US-6.8 (privacy): Stored data contains only question and option IDs, scores, versions and timestamps, at most 50 KB, and no personal information.

**US-7: Question bank schema and validation (P0, 2)**
As a content maintainer, I want questions stored in a validated data file, so that I can add or fix questions without code changes and bad data cannot ship.
- US-7.1: Given the question schema, When a question is defined, Then it has: unique stable slug `id`, `topic` from the controlled topics list, `difficulty`, `type` (single-choice or true/false), `prompt`, `options` each with a stable option `id`, `correct` referencing exactly 1 option `id`, `explanation` (at least 20 chars), https `sourceUrl`, `reviewStatus` (`draft`/`reviewed`) and `reviewedBy` (required when `reviewed`). Content files carry `schemaVersion`.
- US-7.2: Given a true/false question, Then it has exactly 2 options; given a single-choice question, Then it has 3-4 options.
- US-7.3: Given the CI validation runs, When any question breaks the schema, has a duplicate question or option ID, duplicate option text, a missing or ambiguous correct answer, a non-https `sourceUrl`, or reuses a retired ID, Then the build fails and names the question ID and field.
- US-7.4: Given a question has `reviewStatus: draft`, When a production build runs, Then that question is excluded, and the emitted data asset carries a build-generated `contentVersion` and is at most 60 KB gzipped.
- US-7.5: Given a release validation run, When post-exclusion counts are below the US-8 thresholds, Then it fails; dev builds only warn.
- US-7.6: Given the runtime loader, When the data is missing or invalid, Then it returns an error result and never throws.

**US-8: Initial reviewed question bank (P0, 5)**
As a candidate, I want a solid set of accurate questions, so that practice reflects real interviews.
- US-8.1: Given the MVP release, When the bank is counted, Then it has at least 60 `reviewed` questions over at least 8 topics (A5), with at least 5 per topic and at least 20% of them `medium` or `hard`.
- US-8.2 (quality rule): Given any question, When it is reviewed, Then a reviewer who is not the author (agent or person) has checked the answer key and explanation against the cited primary source, and it is marked `reviewed` with `reviewedBy` recorded.
- US-8.3 (human check, D4): Given a content PR, When it is ready to merge, Then the sponsor's PR review is recorded as the human accuracy check before the owner merges. Agents never approve on the sponsor's behalf.
- US-8.4: Questions that are ambiguous, opinion-based or have more than one defensible answer are rewritten or removed. Given a reported wrong answer key, When it is confirmed, Then it is treated as a defect and fixed before the next release.
- US-8.5: Content is original. It is not copied from third-party question banks.
- Note: US-8 must be split into per-topic authoring and review batches before it is Ready (file 05); small batches keep the sponsor's review load reasonable.

**US-9: Responsive layout for mobile and desktop (P0, 3)**
As a mobile learner, I want the quiz to work well on any screen size, so that I can practise on my phone or laptop.
- US-9.1: Given viewport widths 320, 375, 768, 1280 and 1920px and a 640x360 landscape viewport, When any screen renders, Then there is no horizontal page scroll and no content is clipped or overlapped.
- US-9.2: Given a touch device, When I tap answer options and buttons, Then the targets are at least 44x44 CSS px (above the WCAG 2.2 2.5.8 minimum of 24px).
- US-9.3: Given portrait or landscape orientation, When I rotate the device mid-quiz, Then the layout adapts and quiz state is kept.
- US-9.4: Given content reflow at 320 CSS px equivalent (400% zoom at 1280px) and 200% text resize with text spacing overrides, When I use the app, Then all content and functions remain available.
- US-9.5: Given a short landscape viewport (about 640x360), Then "Next" stays reachable and no sticky element obscures the focused element.
- US-9.6: A manual iOS Safari real-device pass is recorded after US-4.

**US-10: Accessibility to WCAG 2.2 AA (P0, 3)**
As a user with a disability, I want the quiz to be fully accessible, so that I can practise like anyone else.
- US-10.1: Given any screen and state, When automated axe-core checks run in CI, Then there are 0 critical or serious violations.
- US-10.2: Given keyboard-only use, When I complete a whole quiz, Then every control, including scrollable code blocks, can be reached in a logical order, the focus indicator is visible and not obscured (2.4.11), and there are no keyboard traps.
- US-10.3: Given a screen reader (tested with NVDA or VoiceOver), When I answer, Then options are announced as a labelled radio group, the verdict is announced through a live region (US-3.3), and focus moves to the new question heading on "Next" (manual pass recorded).
- US-10.4: Given text and UI components, When contrast is measured, Then text is at least 4.5:1 (3:1 for large text and UI parts), and meaning is never shown by colour alone, including in forced-colours mode.
- US-10.5: Given the OS setting "reduce motion", When transitions would play, Then they are disabled.
- US-10.6: Given any view change, Then the document title updates, and focus after Exit, 404 and results goes to the main heading.

**US-11: Difficulty filter and quiz length option (P2, 2)**
As an experienced engineer, I want to filter by difficulty and choose 5, 10 or 20 questions, so that sessions match my level and time.
- US-11.1: Given I select difficulty "hard" and length 5, When I start, Then up to 5 questions, all hard, are shown. If fewer exist, I am told how many are available.
- US-11.2 (edge): Given 0 questions match, Then "Start" is disabled with an explanation.

**US-12: Landing/about page, error and empty states (P1, 1)**
As a first-time visitor, I want to understand what the app is and never hit a dead end, so that I trust it.
- US-12.1: Given the landing page, When it loads, Then a one-sentence description, a "content accuracy and sources" note and a general "Report a problem" link (the public repository's `question-report` new-issue page, see US-3.5/US-3.6) are visible.
- US-12.2: Given an unknown URL, When I visit it, Then a 404 view offers a link back home. Given a deep link to an unknown topic, Then "Topic not found" is shown with the topic list.
- US-12.3: Given a deep link, When I refresh the page on GitHub Pages, Then the same view loads.
- US-12.4: Given a slow load, Then a loading indicator is shown, and after 10 s a "Still loading" message with "Retry".
- US-12.5: Given the question data or an app chunk fails to load, When the app starts, Then a readable error with a "Retry" button is shown.

**US-13: Dark mode / system colour scheme (P3, 1)**
As a user, I want the app to follow my system light or dark setting, so that it is comfortable to read.
- US-13.1: Given my OS prefers dark mode, When the app loads, Then the dark theme applies and still meets the US-10 contrast criteria.
- US-13.2: Given a theme change mid-quiz, Then quiz state is kept.

### Definition of Ready (product side), Sprint 1 stories
| Story | Value and scope clear | AC final and PO-accepted | Priority | Product dependencies | Product-side result |
| --- | --- | --- | --- | --- | --- |
| US-7 | Yes | Yes (no flagged items) | P0 | none | Met; full DoR waits for T-19 QA mapping |
| US-1 | Yes | Yes (US-1(b), (c) accepted) | P0 | US-7 | Met; full DoR waits for T-19 QA mapping (and T-04 design for T-08) |
| US-2 | Yes | Yes (US-2(a) accepted) | P0 | US-1 | Met; full DoR waits for T-19 QA mapping |

### Traceability
Each acceptance criterion `US-n.k` maps to a test ID `T-US<n>-<k>` (for example T-US9-1). The QA test plan (T-19, `docs/qa/ac-test-matrix.md`) holds the mapping. SC-1 to SC-6 map to the following stories: SC-2 to US-7/US-8; SC-3 to US-9; SC-4 to US-10; SC-5 and SC-6 to architecture and NFRs (owned by software-architect and performance-engineer). Detailed FR/NFR IDs are in `02-requirements-analysis.md`.

### Non-functional requirements (summary)
NFR-1 performance (SC-5); NFR-2 accessibility WCAG 2.2 AA (US-10); NFR-3 responsive, including 400% reflow at 1280px and 640x360 landscape (US-9); NFR-4 privacy: no PII, cookies or trackers, and report links carry only question ID and content version (A11, A13); NFR-5 security: static hosting with HTTPS, a strict Content-Security-Policy, and no third-party scripts at runtime; NFR-6 maintainability: content in validated data files (US-7).

## 5. App name
- **Decided (D1, 2026-10-21): "ApiQuiz"**, slug `api-quiz`, repository `api-quiz-app`.
- Before any public launch, check the name for availability and trademark conflicts. This brief does not do that check, and the PO makes no legal clearance claim.

## 6. Material sponsor decisions
1. **D1: App name. DECIDED 2026-10-21:** ApiQuiz, repository `api-quiz-app`.
2. **D2: Hosting and repository visibility. DECIDED 2026-10-21:** public repository and GitHub Pages hosting ($0). Consequence: the report channel is a prefilled GitHub new-issue link (A13). Still needs separate sponsor approval: any paid plan or custom domain; production deployments follow the release go/no-go and human merge.
3. **D3: MVP architecture boundary. DECIDED 2026-10-21:** no accounts, no backend, browser-only storage (A1-A3 confirmed).
4. **D4: Content sign-off. DECIDED 2026-10-21:** the sponsor's PR review is the human accuracy check on content PRs, on top of non-author review against cited primary sources (US-8.2, US-8.3).

Everything else in this brief proceeds on the documented assumptions unless the sponsor objects.

## Change log 2026-10-21

Delegation QUIZ-DISC-D06 (product-owner). Story IDs and priorities are unchanged. Original PO size estimates are unchanged (see the estimates note in section 4).

### Sponsor decisions recorded
- D1-D4 marked DECIDED in section 6; added confirmed facts F6-F9; A1-A3 marked confirmed; Q1 and Q2 resolved; section 5 name decided.

### PO decisions on flagged amendments (file 05 section 1.1)
| Amendment | Decision | Reason | Now in |
| --- | --- | --- | --- |
| US-1 (b) Mixed shows total, hidden with only 1 topic, at least min(3, topics) topics, N = min(10, total) | Accept | Removes an impossible state (Mixed with fewer than 3 topics) without changing the user goal. | US-1.1, US-1.2, US-1.4 |
| US-1 (c) Seeded shuffle replaces "order differs" | Accept | "Order differs" is not deterministically testable; the seeded order still gives users varied quizzes. | US-1.5 |
| US-2 (a) True/false not shuffled | Accept | "True, False" is the expected convention and avoids confusion; no learning value is lost. | US-2.2 |
| US-3 (c) / US-12 (a) Report link | Accept, as a prefilled GitHub new-issue link (D2 public repo) | Free, no backend or email alias; the link carries only question ID and content version, and the issue form warns against personal data. | US-3.5, US-3.6, US-12.1, A13 |
| US-5 (a) Retry-missed excluded from best score | Accept | Retrying only missed questions would inflate the best score and mislead users about readiness. | US-5.2, US-5.5 |
| US-6 (c) Replace confirmation when starting a new quiz | Accept | Prevents silent loss of an unfinished quiz at low cost. | US-6.4 |
| US-6 (f) Separate Mixed best score | Accept | Mixed is a distinct scope users will compare over time; merging it into topics would be wrong. | US-6.1 |
| US-6 / TL 3 Multi-tab prompt deferred to R2 | Accept | Over-built for a P1 story; last-write-wins plus validation already prevents crashes. | US-6.7, A14, R2 |
| US-8 Human approval on content PRs | Accept, as the sponsor's PR review (D4) | AI-only review is weak assurance for accuracy; the sponsor chose to be the human check. | US-8.3 |
| US-9 400% reflow at 1280px plus 200% text, 640x360 landscape | Accept | Required for WCAG 1.4.10 conformance, which is an MVP goal (G3). | US-9.1, US-9.4, US-9.5, SC-3 |

### Non-flagged amendments
- Accepted as PO all amendments that file 05 section 1.1 dispositioned "Accepted" without a PO flag (BA file 02 section 6: US-1 (a), (d); US-2 (b)-(d); US-3 (a), (b); US-4 (a)-(c); US-5 (b), (c); US-6 (a), (b), (d), (e); US-7 (a)-(g); US-10 (a)-(d); US-12 (b)-(e)), plus the US-1 deep-link, US-2 security/Back and US-5 stale-question criteria from the file 05 backlog JSON. Reason: they make the AC testable, robust or accessible with no scope change. They are now written into the stories above.

### Other changes
- Acceptance criteria numbered `US-n.k` so T-19 can map them to `T-US<n>-<k>`.
- A4 corrected to 3-4 options for single-choice (BA G3). SC-3 adds 640x360; SC-6 notes the user-followed link exception.
- Added A13 (report channel), A14 (multi-tab), Q5 (resume expiry default), product-side Definition of Ready table, estimates note.
- Follow-up for project-manager / tech-lead (not a PO decision): US-3.6 needs an owner for the `question-report` issue form file; US-6 re-estimate and US-8 split remain pending.
