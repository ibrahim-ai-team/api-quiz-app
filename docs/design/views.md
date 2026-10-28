# View specifications (T-04)

Strings are referenced as `copy:key` and defined in `copy.md`. Tokens are in `tokens.md`. Route names are proposals for T-08 (hash router): `#/`, `#/topic/<slug>`, `#/quiz`, `#/results`, anything else = 404.

## 0. Shared shell (T-08)

- Landmarks: `header` (brand; Exit button on the quiz route), `main` (one `h1` per view), no global footer (US-6 "Reset progress" is a Landing section, §9). `<html lang="en">`.
- Column: `main` and the header inner area are `max-width: var(--content-max)`, centred, with inline padding as set per breakpoint. **At 768 px and 1280 px the content column is the same 45rem (720 px) wide:** at 768 it fills the viewport minus padding, and at 1280 there is about 280 px of empty margin on each side. That is why the wireframes below show one "768 / 1280" drawing; the only difference between those widths is the side margin and the inline padding.
- Brand (PR #86, HDR-F01): code mark + "ApiQuiz" (`copy:app.name`), with the tagline `copy:app.tagline` underneath. It is a link to `#/` on every view except the quiz route, where it is plain text (`--color-text`) so that tapping it cannot exit the quiz by accident (Exit is explicit).
  - Mark: the decorative glyph `</>` in a square of `--brand-mark-size` (component-local, `2.5rem` at every width), `--radius-md`, `--color-primary` background, `--color-on-primary` glyph in `--font-mono` `--font-size-sm`, `aria-hidden="true"`. Its `letter-spacing: -0.08em` is a component-local value for this decorative glyph only.
  - Name: `--font-size-lg`, bold, `--line-height-heading`. The link is `inline-flex`, `min-height: var(--target-min)`, gap `--space-2` between mark and name, colour `--color-primary` (hover `--color-primary-hover`).
  - Accessible name: exactly the app name ("ApiQuiz"). The mark is `aria-hidden` and the tagline stays outside the link, so neither is part of the name.
  - No underline (HDR-D2 decision): the brand link is the only link without an underline. It is a standalone link in the header, not a link inside text, so it does not rely on colour to be told apart from surrounding text. It keeps the focus ring and the hover colour.
  - Tagline: `--font-size-sm`, `--color-text-muted`, `--line-height-heading`; it starts under the name (inline-start offset = mark size + `--space-2`), wraps freely and is never truncated. On the quiz route below 40em it is not rendered (`display: none`), so the narrow header keeps room for Exit.
  - Spacing (HDR-D1): header inner `padding-block: var(--space-2)`, and `row-gap: var(--space-2)` between the brand link and the tagline. Both are larger than the focus ring's reach (width + offset = 5px), so the whole ring is drawn inside the header and does not cross the tagline. The header inner wraps (`flex-wrap: wrap`, gap `--space-2` / `--space-4`); Exit keeps its label on one line (`white-space: nowrap`) and moves to its own line, end-aligned, when it does not fit.
  - No header-specific breakpoints: only the breakpoints in `tokens.md` §7 are used.
- Buttons: primary (filled `--color-primary`) and secondary (bg with a 2px primary border and primary text). Both use `min-height: var(--target-min)`. Below 40em: full width, stacked, primary first, gap `--space-2`. At 40em and above: inline and left-aligned. Standalone links (source, report, home) use `display: inline-flex; min-height: var(--target-min)`. Links are always underlined, except the header brand link (see Brand above).
- **No sticky or fixed elements anywhere** (US-9.5, 2.4.11). The page scrolls vertically only and never horizontally (US-9.1).
- **Focus rule (US-10.6, G4):** on every route change, move focus to the view's `h1` (`tabindex="-1"`). Initial page load of Landing: do not move focus. Initial load of any other route: focus the `h1`. Exceptions inside the quiz route: Submit focuses Next, and Next focuses the new `h1`.
- **Title rule (FR-27):** `document.title = [...parts, 'ApiQuiz'].join(' - ')`. It is set on every view change. Feedback is not a view change, so the title stays the same.
- Rotation, resize and theme change never reset state (US-9.3, US-13.2); state lives in the reducer and not in layout.
- **640x360 landscape:** `sm` + `short` layout. Everything is reachable by vertical scrolling, and the header scrolls away with the page.
- **400% zoom at 1280:** identical to the 320 layout. Code boxes scroll inside themselves; no other content scrolls horizontally.

## 1. Landing (T-09; US-1, US-12.1; US-6 in §9)

Hierarchy: h1, description, [resume slot: load notice, resume card, §9], topic group (fieldset), Start + hint [+ replace confirmation, §9], "About the questions" (h2, accuracy note, report link) [, "Your progress" (h2, Reset progress), §9].

```
320                                   768 / 1280 (45rem column, centred)
+--------------------------------+    +---------------------------------------------+
| ApiQuiz                        |    | ApiQuiz                                     |
+--------------------------------+    +---------------------------------------------+
| Practise API interview         |    | Practise API interview questions       (h1) |
| questions                (h1)  |    | Answer short quizzes on HTTP, REST, ...     |
| Answer short quizzes on ...    |    | [resume banner slot - US-6, not Sprint 1]   |
| [resume slot - US-6]           |    | Choose a topic                     (legend) |
| Choose a topic       (legend)  |    | +-----------------------------------------+ |
| +----------------------------+ |    | | ( ) HTTP fundamentals      8 questions  | |
| | ( ) HTTP fundamentals      | |    | | (o) Status codes          12 questions  | |
| |     8 questions            | |    | | ...                                     | |
| | (o) Status codes  selected | |    | | ( ) Mixed                 64 questions  | |
| |     12 questions           | |    | |     Questions from several topics       | |
| | ...                        | |    | +-----------------------------------------+ |
| | ( ) Mixed                  | |    | [ Start quiz ]  Choose a topic to start.    |
| |     Questions from several | |    | About the questions                    (h2) |
| |     topics. 64 questions   | |    | Every question is written for ...           |
| +----------------------------+ |    | Report a problem (opens in new tab) [->]    |
| [         Start quiz         ] |    +---------------------------------------------+
| Choose a topic to start.       |
| About the questions      (h2)  |
| Every question is written ...  |
| Report a problem (opens in     |
| new tab) [->]                  |
+--------------------------------+
```

- Topic group: `fieldset` + `legend` (`copy:landing.topicsLegend`) with native radios. Each row is a full-width `label` (`--option-min`, the whole row can be tapped). Its accessible name is the name plus the count, for example "Status codes, 12 questions". Topics appear in the curated order and only when they have at least 1 eligible question. Mixed comes last, shows the total, and is hidden when only 1 topic is shown (US-1.1, 1.2). Row states: default (2px border), hover (surface), selected (2px primary border, selected-bg, native checked radio), focus (ring on the row). Best-score text per row for US-6.1: §9.3.
- Start (primary, `copy:landing.start`): `aria-disabled="true"` with `aria-describedby` pointing at the visible hint until a topic is selected. Activating it while unavailable does nothing. After the first activation it becomes `aria-disabled` while the quiz is created (US-1.6). Deep link `#/topic/<slug>`: the topic is preselected, Start is available, and the quiz does not auto-start (US-1.8). Interactions: select + Start = 2 (US-1.7).
- States: **loading** (topic group replaced by §5 Loading; h1, description and About stay visible, because the shell renders before data, per the TL review; the topic area keeps the height of the loaded group, so About does not move when the topics arrive, see §5 and T-34); **data error** (§6 in the same place); **topic not found** (§7b).
- Focus order: brand, topic radios (one tab stop, arrow keys move between them), Start, report link. Entry focus: none on first load; `h1` after Exit, "Choose another topic" or the 404 home link.
- Title: `copy:title.landing`. Live region: none (Start's hint is a description, not an announcement).
- 640x360 and 400%: the list scrolls with the page. Start sits below the list and is reached by scrolling or Tab; it is never sticky.

## 2. Question (T-12; US-2)

Hierarchy: h1 "Question k of N", topic line, prompt (`renderRichText`), code boxes, fieldset with options, Submit + hint. Exit is in the header.

```
320                                   768 / 1280
+--------------------------------+    +---------------------------------------------+
| ApiQuiz           [Exit quiz]  |    | ApiQuiz                         [Exit quiz] |
+--------------------------------+    +---------------------------------------------+
| Question 3 of 10         (h1)  |    | Question 3 of 10                       (h1) |
| Topic: HTTP methods            |    | Topic: HTTP methods                         |
| Which request is idempotent    |    | Which request is idempotent but not safe?   |
| but not safe?                  |    | +-----------------------------------------+ |
| +----------------------------+ |    | | PUT /items/42 HTTP/1.1                  | |
| | PUT /items/42 HTTP/1.1     | |    | | Content-Type: application/json          | |
| | Content-Type: applicatio-->| |    | +-----------------------------------------+ |
| +----------------------------+ |    | Choose one answer                  (legend) |
| Choose one answer    (legend)  |    | [ ( ) GET                                 ] |
| [ ( ) GET                    ] |    | [ (o) PUT                                 ] |
| [ (o) PUT                    ] |    | [ ( ) POST                                ] |
| [ ( ) POST                   ] |    | [ Submit ]                                  |
| [          Submit            ] |    +---------------------------------------------+
+--------------------------------+
```

- Progress text "Question 3 of 10" is the `h1` (`copy:question.heading`), so it is announced when focus arrives (US-2.1, BA US-10). No progress bar in Sprint 1; if one is added it must be `aria-hidden`.
- Group: `fieldset` with `legend` `copy:question.optionsLegend`. The prompt is **not** placed in the legend, because prompts can contain block code, which is not valid inside a legend (see open question DQ-2). Options are native radios in full-width label rows, styled like Landing rows. True/false shows "True, False" in that order.
- Code box (US-2.6, T-10): `<pre tabindex="0" role="region" aria-label="copy:question.codeLabel">`, `white-space: pre`, `overflow-x: auto`, `max-width: 100%`, background surface, 1px border, `--font-mono`. Only the box scrolls, never the page. It gets the standard focus ring, which needs the parent padding of at least `--space-1` (the column already provides it).
- Submit (primary, `copy:question.submit`): before a selection it has `aria-disabled="true"`, the unavailable style (surface background, muted text, dashed border), and `aria-describedby` pointing at the visible hint `copy:question.submitHint`. Activating it while unavailable does nothing. Once an option is selected: normal primary style, and the hint is removed. On Submit the answer is locked (`fieldset disabled`, labels kept at full text contrast), Submit is removed, and Feedback is shown (§3). A double activation is ignored (US-2.5).
- Exit quiz (secondary, `copy:question.exit`): returns to Landing and focuses its `h1`. Browser Back does the same (US-2.8). No confirmation (see DQ-1). With persistent storage the quiz stays saved and Landing shows the resume card (§9.4, FR-26).
- Focus order: Exit, code box(es), radio group, Submit. Entry focus: `h1` (from Start, Try again or Next).
- Title: `copy:title.question` (for example "Question 3 of 10 - HTTP methods - ApiQuiz"); a retry quiz uses `copy:title.questionRetry` (§8). Live region: the feedback status region (§3) is mounted empty here.
- Retry quiz (US-5, §8): a line `copy:question.retryLabel` sits between the `h1` and the topic line on every question; otherwise the view is unchanged.
- States: unselected, selected, submitting (instant, no spinner), locked. If `#/quiz` is opened with no quiz in memory (for example after a refresh), redirect to `#/` and focus `h1`; a saved quiz is offered there by the resume card (§9.4), never auto-resumed.
- 640x360: about 4 rows fit on screen. Submit is reached by scrolling or Tab. 400%: code box scrolls inside itself; long options wrap.

## 3. Feedback (T-13; US-3) - same route, rendered in place below the options

```
320                                   768 / 1280: same order in the 45rem column,
| Choose one answer              |    buttons inline at auto width
| [ ( ) GET                    ] |
| [ ( ) PUT [v] Correct answer ] |  <- 3px solid success border, success-bg
| [ (o) POST [x] Your answer   ] |  <- 3px dashed danger border, danger-bg
| +----------------------------+ |
| | [x] Incorrect          (h2)| |  <- panel: 4px left border (danger/success), tinted bg
| | Correct answer: PUT        | |
| | Explanation            (h3)| |
| | PUT replaces the resource; | |
| | repeating it ...           | |
| | Source: www.rfc-editor.org | |
| | (opens in new tab) [->]    | |
| | Report a problem with this | |
| | question (opens in new     | |
| | tab) [->]                  | |
| +----------------------------+ |
| [            Next            ] |  <- focus target after Submit
```

- Markers (US-3.1): the correct option gets a check icon, the visible tag `copy:feedback.tagCorrect` and a solid 3px success border. A wrong choice gets a cross icon, the tag `copy:feedback.tagChosen` and a dashed 3px danger border. When the choice is correct, the row shows both tags. Unchosen wrong options keep the default style. Meaning is carried by the icon, the tag text and the border style, so it survives forced colours.
- Panel: `section` labelled by its `h2` (`copy:feedback.correct` / `.incorrect`) with an icon. "Correct answer: X" is shown only when the answer was wrong. Explanation goes through `renderRichText`.
- Source (US-3.2): `copy:feedback.sourcePrefix` plus a link whose text is the URL's hostname plus the visible cue `copy:common.newTabCue` and an external-link icon. It uses `target="_blank" rel="noopener noreferrer"`. The cue text is part of the accessible name. A non-https URL is shown as plain text (`copy:feedback.sourceUnlinked`) and is not a link.
- Report (US-3.5): `copy:feedback.report` plus the same cue. The URL is built by `reportLink.ts` (question ID and `contentVersion` only).
- Next (primary): `copy:feedback.next`, or `copy:feedback.seeResults` on the last question. One activation advances exactly 1 question.
- **Live region (US-3.3, G4):** a `role="status"` (polite) visually hidden region that is already mounted while empty. On Submit, set its text to `copy:feedback.liveCorrect` or `.liveIncorrect`, then focus Next. Only the short verdict is announced; the explanation is not, so nothing is read twice. Clear the region on Next.
- Scroll on Submit: if the panel plus Next fit in the viewport, scroll them into view (`block: 'end'`, motion per `tokens.md` §5), then `next.focus({ preventScroll: true })`. If not, use a plain `next.focus()`, which scrolls Next into view; the verdict is still announced, and the panel is above Next in reading order.
- Focus order after Submit: Next is focused. Shift+Tab reaches the report link, then the source link. The locked options are read in reading order and are not tab stops.
- 640x360: the panel is taller than the viewport, so the second branch applies. Next is focused and visible, and nothing overlays it. 400%: same as 320.

## 4. Results (T-15; US-4; US-5 in §8)

```
320                                   768 / 1280
| Your results             (h1)  |    | Your results                           (h1) |
| Mixed                          |    | Mixed                                       |
| 7 / 10                  (3xl)  |    | 7 / 10   70%                         (3xl) |
| 70%                            |    | Good progress. A bit more practice ...      |
| Good progress. A bit more      |    | Score by topic                         (h2) |
| practice will make it solid.   |    |  - HTTP methods: 2 / 3                      |
| Score by topic           (h2)  |    |  - Status codes: 3 / 4                      |
|  - HTTP methods: 2 / 3         |    | [v Review answers ]              (h2, §8)   |
|  - Status codes: 3 / 4         |    | [ Try again ] [ Retry 3 missed questions ]  |
| [v Review answers ] (h2, §8)   |    | [ Choose another topic ]                    |
| [          Try again         ] |
| [  Retry 3 missed questions  ] |
| [    Choose another topic    ] |
```

US-5 (§8) adds the Review disclosure above the buttons and "Retry N missed" between Try again and Choose another topic. At `sm` and above the buttons stay inline and wrap when they do not fit.

- Score: `copy:results.score` ("X / N") and `copy:results.percent` (whole number, half-up; computed in T-14) in one `<p>`, bold `--font-size-3xl`. Band message `copy:results.band.*` (US-4.2). The scope line shows the topic name or "Mixed".
- Breakdown (US-4.3): `h2` plus a `ul`, only when the quiz covered more than 1 topic. A list rather than a table, because it reflows at 320 without horizontal scroll.
- Try again (primary): a fresh draw with the same scope, focus on the Question `h1`. Choose another topic (secondary): goes to Landing and focuses its `h1`; proposal: the topic just played is preselected (DQ-5).
- Entry focus: `h1` (US-4.5). Title `copy:title.results`. Live region: none (focusing the heading is enough).
- Edge states: N = 1, 0% and 100% use the same layout with their band messages. Refreshing `#/results` without results in memory redirects to `#/` (unchanged by US-6: the saved quiz is cleared on finish, §9.4).
- 640x360 and 400%: single column; the buttons are reached by scrolling.

## 5. Loading / Still loading (T-08; US-12.4)

```
all widths (inside the Landing topic area)
| Practise API interview questions (h1)|
| [spinner] Loading questions...       |   role="status"; appears after 300 ms
| -- after 10 s --                     |
| [icon] Still loading. Your connection|   same region updated; spinner stops
| may be slow.        [ Retry ]        |
```

- Shown only if data takes more than 300 ms (J1), so there is no flash on fast loads. The text `copy:loading.text` is inside `role="status"`, so it is announced politely once. After 10 s the same region shows `copy:loading.still`, and a Retry button (secondary) appears after it. Focus does not move. Retry restarts the fetch, or reloads the page if a code chunk failed.
- Reserved space (T-34, CLS): while loading, the Landing topic area is as tall as the loaded topic group (topic rows, Mixed, Start and its hint). The status line sits at the top of that space, and the rest is blank until the topics arrive. The space comes from an invisible, `aria-hidden` copy of the group with disabled controls: it is not announced, not focusable and never painted. Its row count (`RESERVE_TOPICS`) must match the shipped topic count; a unit test enforces this. The data error state (§6) does not reserve space.
- Title: the Landing title. Reduced motion: static icon. 640x360 and 400%: the status sits at the top of the reserved space; a taller status grows the space and never overlaps About.

## 6. Data error and app error (T-08; US-12.5, NFR-9)

```
Data error (in the Landing topic area)        App error (full view, error boundary)
| [!] Questions could not be loaded (h2)|     | Something went wrong            (h1) |
| Check your connection, then try again.|     | The page could not be displayed. ... |
| [ Retry ]                             |     | [ Retry ] [ Go to the home page ]    |
```

- Data error: `role="alert"` container (announced once, assertive, because the main task is blocked), `h2` `copy:error.dataHeading`, body text, Retry (primary). The icon plus the text carry the meaning, with no reliance on colour (text colour on bg, `--color-danger` icon). Focus does not move on first load. After a failed Retry, focus stays on Retry and the alert content is replaced, so it is announced again. Title `copy:title.dataError`.
- App error (chunk failure or unexpected error): its own view, `h1` focused, Retry reloads the page, home link goes to `#/`. Title `copy:title.appError`.

## 7. 404 and Topic not found (T-08, T-09; US-12.2)

```
7a 404 (all widths)                      7b Topic not found (Landing variant)
| ApiQuiz                         |     | Topic not found                (h1) |
| Page not found            (h1)  |     | That topic does not exist or ...    |
| There is no page at this        |     | Choose a topic (legend)  [topic list]|
| address.                        |     | [ Start quiz ] ...                  |
| Go to the home page             |
```

- 7a: `h1` focused on entry (US-10.6). The home link uses `--target-min`. Title `copy:title.notFound`.
- 7b: `#/topic/<unknown>` renders Landing with the `h1` replaced by `copy:notFound.topicHeading` plus `copy:notFound.topicBody`, followed by the normal topic group with nothing preselected. Focus `h1`. Title `copy:title.topicNotFound`. The unknown slug is **not** echoed back to the page (this avoids injection and confusing text).

## 8. Review answers and Retry missed (US-5, GitHub #11; design US-5-DS01)

Proposed design guidance, not user-tested. Extends §4 Results and §2 Question; no new route, colour, token or dependency.

### 8.1 Decisions

- **R1 Review is an in-page disclosure on Results, not a `#/review` route.** It keeps the score, the review and "Retry missed" on one view; it adds no route, redirect state, title or history entry, so Back, refresh (`#/results` redirect) and the session-clearing rules in §0/§4 stay unchanged. Collapsed by default, so the Results entry experience (US-4.5) is unchanged. Reversible: the item component (§8.3) can move to a route later without changes.
- **R2 Order:** h1, [retry note], scope, score, band, breakdown, **Review (h2 disclosure)**, then the buttons. The review sits before the buttons so that, after reading it, the next actions follow in reading and Tab order (no duplicate buttons at the end of the list).
- **R3 All questions, quiz order, no "missed only" filter** (US-5.1 says "each question"). Each item heading carries the verdict, so screen-reader users can skim by heading (H key) and sighted users by icon + verdict text. A filter is open question DQ-US5-1.
- **R4 Missed = answered incorrectly.** Every question in a finished quiz has an answer (there is no skip), so there is no "not answered" state.

### 8.2 Review disclosure

```
320 (collapsed)                       320 (expanded)
| [v] Review answers       (h2)  |    | [^] Review answers               (h2) |
| [          Try again         ] |    | 1. [v] Question 1: Correct       (h3) |
                                      |    Topic: HTTP methods                |
                                      |    Which request is idempotent ...    |
                                      |    +--------------------------------+ |
                                      |    | PUT /items/42 HTTP/1.1       ->| |
                                      |    +--------------------------------+ |
                                      |    +- solid success ---------------+ |
                                      |    | [v] Your answer: PUT           | |
                                      |    +--------------------------------+ |
                                      |    +- solid success ---------------+ |
                                      |    | [v] Correct answer: PUT        | |
                                      |    +--------------------------------+ |
                                      |    Explanation                  (h4) |
                                      |    PUT replaces the resource; ...     |
                                      |    Source: www.rfc-editor.org         |
                                      |    (opens in new tab) [->]            |
                                      | 2. [x] Question 2: Incorrect     (h3) |
                                      |    ...                                |
                                      |    +- dashed danger ---------------+ |
                                      |    | [x] Your answer: POST          | |
                                      |    +--------------------------------+ |
                                      |    +- solid success ---------------+ |
                                      |    | [v] Correct answer: PUT        | |
                                      |    +--------------------------------+ |
                                      | [          Try again             ] |
```

768 / 1280: same order in the 45rem column; the toggle is auto width (`min-width: 10rem`), like other buttons at `sm`.

- Markup: `<h2><button type="button" aria-expanded="false|true" aria-controls="{listId}">` with label `copy:review.toggle` and a chevron icon (inline SVG, `aria-hidden`, points down when collapsed, up when expanded; no rotation animation). Secondary button style, `min-height: var(--target-min)`. The controlled element is an `ol` (no `role="region"`, so the page gets no extra landmark); when collapsed it is not rendered (or `hidden`), so its content is neither read nor focusable.
- Keyboard: Tab reaches the toggle; Enter and Space toggle it. **Focus stays on the toggle** on expand and collapse (disclosure pattern); content appears after it in reading order. No live region: the `aria-expanded` change is announced by the button itself.
- State: component state, collapsed each time a Results view is shown (a new quiz's results start collapsed). Survives resize, rotation and theme change (§0). Not persisted.
- Tab order when expanded: toggle, then per item: prompt code box(es), explanation code box(es), source link; then the Results buttons. No keyboard traps; no element inside the list is focused by script.

### 8.3 Review item (per question)

- `li` in the `ol` (the list numbers are decorative: `list-style: none`, the number is in the heading). Spacing: `--space-5` between items, `--space-3` inside; `border-inline-start: 4px solid` `--color-success` (correct) or `--color-danger` (incorrect), `padding-inline-start: var(--space-3)`, no tinted item background. The border is decoration; meaning is in the heading.
- `h3` `copy:review.itemHeading` ("Question 2: Incorrect", verdict from `copy:feedback.correct` / `.incorrect`) with the check or cross icon before it; wraps like the feedback verdict (`overflow-wrap: anywhere`, `hyphens: auto`, icon on the first line).
- Topic line `copy:question.topic` (omitted for an unknown topic id, as in §2), prompt via `renderRichText` with code boxes as in §2, labelled `copy:review.promptCodeLabel` (question number included, so code regions on the page never share a name: axe `landmark-unique`).
- Answer lines: two `<p>` boxes styled like the §3 option markers (`--radius-md`, `--border-width-state`), always both shown so US-5.1 is met literally:
  - `copy:review.yourAnswer` ("Your answer: POST"): correct = check icon, solid `--color-success` border, `--color-success-bg`; incorrect = cross icon, **dashed** `--color-danger` border, `--color-danger-bg`.
  - `copy:feedback.correctAnswer` ("Correct answer: PUT"): check icon, solid success border, success-bg.
  - The text label carries the meaning; icon and border style back it up in forced colours (`border-color: CanvasText`, tokens.md §6). Option text goes through `renderInlineText`, `overflow-wrap: anywhere`. Contrast pairs #4, #5, #17, #19 (tokens.md §1) already cover this.
  - Other options are not listed.
- `h4` `copy:feedback.explanationHeading`, explanation via `renderRichText` with `copy:review.explanationCodeLabel`.
- Source: identical to §3 (`copy:feedback.sourcePrefix` + hostname link + `copy:common.newTabCue` + external-link icon, `target="_blank" rel="noopener noreferrer"`; non-https = `copy:feedback.sourceUnlinked`, plain text). Reuse the `ExternalLink` component and `safeHttpsUrl`.
- No report link in the review (keeps tab stops down; it is still on the feedback panel). Reversible.
- Review shows the questions as they were played (session snapshot), even if the bank has since changed.

### 8.4 Retry missed

- Button (secondary) `copy:results.retryMissed` ("Retry 3 missed questions"; "Retry 1 missed question"), placed after the primary button and before Choose another topic. The count is the number of missed questions **still in the current bank** (§8.5). **Not rendered at all when 0 missed** (US-5.3); no placeholder, no disabled state.
- Activation (single-click guard as for Try again): starts a quiz of exactly those questions, in their original relative order (assumption A-US5-1), single-choice options reshuffled, true/false kept "True, False" (§2). Like Try again it replaces `#/results` with `#/quiz` (Back leaves for Landing) and focuses the Question `h1`.
- Retry quiz on the Question view: `h1` `copy:question.heading` as usual ("Question 1 of 3"), then the line `copy:question.retryLabel` ("Retry: missed questions", `--font-size-sm`, `--color-text-muted`, same style as the topic line), then the topic line. Title `copy:title.questionRetry`. The h1 itself is not changed, so each question is not announced with extra words; the user has just activated "Retry ... missed".
- Retry Results (US-5.5): `h1` `copy:results.retryHeading` ("Retry results"), focused on entry, so the first thing announced says it is a retry. Directly below it: `copy:results.retryNote` (body text, `--color-text`). Scope line = the original quiz's scope. Title `copy:title.resultsRetry`. The score is not saved as best score (US-6 must check the quiz kind).
- Retry Results buttons: primary `copy:results.startFull` ("Start a full quiz": fresh draw of the original scope, like Try again), secondary `copy:results.retryMissed` with the retry's own misses (US-5.4, repeatable), secondary Choose another topic. "Try again" is not used here because it would be ambiguous (repeat the retry set, or a full quiz?).
- N = 1 (US-5.4): "Question 1 of 1", Next reads "See results", results "1 / 1 100%" or "0 / 1 0%", "Retry 1 missed question" when wrong, no breakdown (1 topic).

### 8.5 Questions removed by a new deploy (US-5.6)

- Availability is computed when Results renders, against the current bank, with the same function used on activation (so the label and the started quiz cannot differ). In Sprint 1 the bank does not change while a session is in memory, so this state is reachable only after US-6 persistence or in tests.
- Some removed: the button count shows the remaining number, and `copy:results.retryPartial` is shown as a `<p>` right after the button group, referenced by the button's `aria-describedby`.
- None remain: no button; `copy:results.retryNone` is shown as a `<p>` in its place (after the button group). Static text, no live region, focus unaffected (it is present on entry and read in order).
- Fallback: if starting the retry still fails, stay on Results, render the `retryNone` text in place of the button with `tabindex="-1"` and focus it, so focus is never lost.

### 8.6 Accessibility and responsive checks (proposed, not verified)

- Headings: h1 > h2 (Score by topic, Review answers) > h3 (each item) > h4 (Explanation). One `h1`. No new landmarks.
- 320 / 400% zoom: single column; only code boxes scroll horizontally; answer boxes and URLs wrap. 640x360: the list scrolls with the page; nothing is sticky. Targets at least `--target-min`; gap `--space-2` between buttons.
- Reduced motion: no animation on expand. Forced colours: icons, text labels and solid/dashed borders remain.
- Not colour-only (1.4.1): verdict text in each heading, "Your answer" / "Correct answer" labels, icons, border style.

## 9. Best score, resume and reset progress (US-6, GitHub #12; design US6-UX-D01)

Proposed design guidance, not user-tested. Extends §1 Landing (and touches §2, §4); no new route, colour, token or dependency. Covers US-6.1 to US-6.8 for T-42 (#105), T-43 (#106) and T-44 (#107). Storage facts used here come from `src/storage` (`ProgressStore.persistent`, `clearAppKeys`, keys `apiquiz:v1:best` and `apiquiz:v1:session`) and `src/domain/restore.ts` (`restoreQuiz`: `ok`, or `stale`).

### 9.1 Decisions

- **U1 Everything lives on Landing.** Best scores sit in the topic rows, the resume card and the load notice sit in the §1 resume slot (between the description and the topic group), the replace confirmation sits under Start, and "Reset progress" is a new `h2` section "Your progress" after "About the questions" (FR-17 allows "footer or About section"; there is still no global footer, §0). No new route, title or history entry.
- **U2 Progress features exist only when storage is persistent** (`store.persistent === true`, US-6.5). When it is false, none of the elements in this section is rendered: no best-score text, no resume card, no load notice, no replace confirmation (there can be no saved quiz), no "Your progress" section, and `copy:results.retryNote` is not shown (`showRetryBestScoreNote = store.persistent`). Landing then looks exactly as it does today. A failed write later in the session (quota, error) is silent: no message, no focus change, the quiz goes on (US-6.5). After any failed **session** write, the app makes a best-effort `store.remove(KEYS.session)` (result ignored, no UI), so an older saved position is never offered later.
- **U3 The resume card is shown whenever a restorable quiz is saved**, both after a reload (US-6.2) and right after Exit or browser Back in the same page load (FR-26: leaving keeps the quiz saved). This replaces the Sprint 1 behaviour in DQ-1 (Exit lost the quiz) when storage is persistent; in memory-only mode Exit still discards the quiz, as before.
- **U4 Restorable = decodes and `restoreQuiz` returns `ok`**, checked once the bank is ready. Anything else is removed from storage and reported by the load notice (§9.5). A content-version change that still restores (`contentChanged: true`) is resumed without any message.
- **U5 Discard is immediate, with no confirmation.** It is an explicit choice on a card whose only purpose is that choice; a second step adds a tap for little benefit. Reversible; see DQ-US6-1.
- **U6 Replace confirmation is inline under the single Start button.** Landing has one Start button for every topic and for Mixed, so one placement covers both scopes and deep links (`#/topic/<slug>`). Results actions (Try again, Retry missed, Start a full quiz) never need it: a saved quiz is cleared when a quiz finishes, so no resumable quiz can exist while Results is shown (a second tab is covered by U9).
- **U7 One confirmation pattern** for both replace and reset (§9.6): a message, a primary confirm button, a secondary Cancel; focus moves to the message; Escape and Cancel close it and return focus to the trigger.
- **U8 Best score shows the percentage only** (US-6.1), and only for scopes that have one. No "no best score yet" placeholder (DQ-US6-2).
- **U9 Two tabs: no UI** (US-6.7). Landing reads storage each time it is shown, so it reflects the last write. Resume uses the session decoded when Landing rendered; it is not re-read on activation, and the next save in this tab simply wins.

### 9.2 Landing layout with progress features

Order: h1, description, **[load notice] [resume card or discard text]**, topic group (rows with **best score**), Start + hint + **[replace confirmation]**, About the questions, **Your progress (h2, text, Reset progress + [reset confirmation or result text])**.

```
320                                   768 / 1280 (45rem column, centred)
+--------------------------------+    +---------------------------------------------+
| Practise API interview         |    | Practise API interview questions       (h1) |
| questions                (h1)  |    | Answer short quizzes on HTTP, REST, ...     |
| Answer short quizzes on ...    |    | (i) Your unfinished quiz could not be ...   |
| (i) Your unfinished quiz could |    | +-- 2px primary border -------------------+ |
| not be restored, so it was     |    | | Unfinished quiz                    (h2) | |
| removed.        (load notice)  |    | | Status codes quiz: 3 of 10 questions    | |
| +-- 2px primary border ------+ |    | | answered.                               | |
| | Unfinished quiz      (h2)  | |    | | [ Resume quiz ] [ Discard quiz ]        | |
| | Status codes quiz: 3 of 10 | |    | +-----------------------------------------+ |
| | questions answered.        | |    | Choose a topic                     (legend) |
| | [      Resume quiz       ] | |    | +-----------------------------------------+ |
| | [      Discard quiz      ] | |    | | ( ) HTTP fundamentals      8 questions  | |
| +----------------------------+ |    | |                      Best score: 75%    | |
| Choose a topic       (legend)  |    | | (o) Status codes          12 questions  | |
| +----------------------------+ |    | | ( ) Mixed                 64 questions  | |
| | ( ) HTTP fundamentals      | |    | |     Questions from several topics       | |
| |     8 questions            | |    | |                      Best score: 60%    | |
| |     Best score: 75%        | |    | +-----------------------------------------+ |
| | (o) Status codes           | |    | [ Start quiz ]                              |
| |     12 questions           | |    | This will discard your unfinished quiz.     |
| | ( ) Mixed                  | |    | [ Start new quiz ] [ Cancel ]               |
| |     Questions from several | |    | About the questions                    (h2) |
| |     topics. 64 questions   | |    | ...                                         |
| |     Best score: 60%        | |    | Your progress                          (h2) |
| +----------------------------+ |    | Best scores and your unfinished quiz are    |
| [         Start quiz         ] |    | saved only in this browser on this device.  |
| This will discard your         |    | [ Reset progress ]                          |
| unfinished quiz.               |    +---------------------------------------------+
| [       Start new quiz       ] |
| [           Cancel           ] |
| About the questions      (h2)  |
| ...                            |
| Your progress            (h2)  |
| Best scores and your           |
| unfinished quiz are saved only |
| in this browser on this        |
| device.                        |
| [       Reset progress       ] |
+--------------------------------+
```

The drawing shows every optional element at once; in practice the load notice and the replace confirmation are rare. Status codes has no best score, so its row shows none.

- Loading (§5) and data error (§6): no best scores, no card, no notice and no "Your progress" section are shown until the bank is ready, because restoring needs the bank. On a data error the saved quiz is **kept untouched** (it is not corrupt; the bank just did not load). "Your progress" appears with the topic group.
- No topics (`landing.noTopics`): the card and notice are not shown (nothing can be restored) and the saved quiz and best scores are **kept untouched**, as on a data error (the bank is the problem, not the saved data). "Your progress" is still shown so the user can reset. The resume-slot reserve (below) stays at its height, empty, so nothing below it moves.
- Topic not found (§7b) and deep links: same elements, same places; the preselected topic does not change the card.
- **CLS (T-34; T-43 check "no CLS regression on the T-34 reserve", CLS < 0.01 per load).** Storage reads are synchronous and decoding needs no bank, so the App reads and decodes `apiquiz:v1:best` and `apiquiz:v1:session` once at startup, before the first render, and sizes everything from that result. Restoring (`restoreQuiz`) is the only step that waits for the bank. The same technique as §5 is used: an invisible, `aria-hidden`, non-focusable copy of the final markup holds the space, and the visible content is placed in the same grid cell when it is known.
  - **Best-score lines:** the loading reserve (§5, `reserveChoices`) gives a row a stand-in `copy:landing.bestScore` line when the decoded best value has a score for that row's topic ID (`landing-reserve.json` `topicIds`, same build as the bank) or for `mixed` (only when the reserve has a Mixed row). The loaded rows then show the same lines, so row heights match. `pruneUnknownTopics` cannot drop a score the reserve counted, because the reserve and the bank come from the same content build.
  - **Resume slot, session decodes:** the slot renders at first paint with an invisible copy of the card, filled with the real summary text (topic name from the reserve's `topicNames` by ID, or `landing.mixedLabel`; `{answered}` and `{n}` from the decoded session). When the bank is ready: if `restoreQuiz` is `ok`, the visible card takes the copy's place (same markup, same height). If it is `stale`, the load notice is shown in the same cell and the invisible card copy stays behind it for the rest of this Landing render, so the slot keeps the card's height. The notice always fits inside that height: it is at most two sentences (about 125 characters) with no buttons, while the card has a heading, a summary line, two buttons of at least `--target-min` each (stacked below 40em), padding and a border. At 320 px (and at 400% zoom, which uses the same layout) that is about 6rem of notice against about 15rem of card; text-spacing overrides grow the card's text as well. The unused space under the notice is blank and is gone when Landing is shown again.
  - **Resume slot, decode fails** (corrupt or unknown `schemaVersion`, for either key): the result is known at startup, so the slot renders at first paint with an invisible copy of the notice text; the same text is then set in the `role="status"` element after mount (so it is announced, §9.5), replacing the copy with no size change. If the best value fails but the session decodes, the slot holds both the notice copy and the card copy.
  - **Nothing saved, storage not persistent, or a value read as absent** (F8 in §9.5): no slot reserve and no best lines, exactly as today.
  - **Data error (§6):** the slot reserve is dropped together with the topic reserve, as §5 already does for that state.

### 9.3 Best score in topic rows (US-6.1; T-42)

- Text `copy:landing.bestScore` ("Best score: 75%") as its own line inside the row's text block, after the count (and after the Mixed description): `--font-size-sm`, `--color-text-muted`, like the count. Below 40em it starts under the name; at `sm` and above it is end-aligned under the right-aligned count. It wraps and is never truncated. No icon, no colour, no bar.
- Accessible name: today's `aria-label` "{name}, {count}" gains ", {bestScore}" when there is one, for example "Status codes, 12 questions, Best score: 75%". Mixed keeps its description in `aria-describedby`.
- Source: the decoded `apiquiz:v1:best` value after `pruneUnknownTopics` (a removed topic's score is dropped silently, no notice). Key `mixed` feeds the Mixed row; Mixed is hidden when only one topic is shown (§1), and so is its best score.
- Written only when a quiz finishes (on the transition to Results) **and** `quiz.mode === "normal" && quiz.contentVersion === bank.contentVersion` (SEC-R13). So a retry-missed quiz never updates it (US-5.5), and neither does a resumed quiz that was built on an older bank (`restoreQuiz` keeps the saved `contentVersion`), even if it is a normal quiz. Higher percentage replaces the stored one; equal or lower keeps it. A failed write is silent (U2). Results itself does not show the best score or a "new best" message in US-6 (DQ-US6-4).
- Row states, focus and hit area are unchanged (§1).

### 9.4 Resume card (US-6.2; T-43)

- Markup: `<section aria-labelledby="{headingId}">` (named region), `h2` `copy:resume.heading`, then `<p>` `copy:resume.summary` (normal quiz) or `copy:resume.summaryRetry` (retry-missed quiz). `{scope}` is the topic display name or `copy:landing.mixedLabel`; `{answered}` is the number of locked answers (`answers.length`, which includes a locked answer on the current question); `{n}` the quiz length. Then a button group: `copy:resume.resume` (primary) and `copy:resume.discard` (secondary), following the §0 button rules (stacked full width below 40em, inline at `sm`).
- Style: `--border-width` solid `--color-primary`, `--radius-md`, padding `--space-4`, background `--color-bg`; gap `--space-3` inside; `--space-5` above the legend. Contrast pairs #1, #10, #14 and #23 already cover it.
- **Resume:** restores the session (same question index, question order, option order and locked answers, US-6.2), navigates to `#/quiz` and focuses the Question `h1` (§0 focus rule). If the restored phase is `feedback` (the current question was already submitted), the Question view shows the locked options and the feedback panel with Next, exactly as after Submit, but **focus goes to the `h1`**, not Next, and the live region stays empty (the verdict is in the panel; nothing is re-announced). The selection of an unsubmitted question is not restored (J3). *Implementation note (T-43):* today the Question view sets the feedback live text whenever the phase is `feedback`; it must set it only on an answering-to-feedback transition seen inside the view (Submit), not when the view mounts in `feedback`. That change is in `src/ui/views/Question/**`, which must be in T-43's allowed paths. Title follows §2 (`copy:title.question` or `copy:title.questionRetry`). Single-activation guard as for Start.
- **Discard:** removes `apiquiz:v1:session` (best scores untouched). The card is replaced in the same place by `<p tabindex="-1">` `copy:resume.discarded`, which is focused, so the result is read and focus is not lost; Tab then goes on to the topic group. No live region. The text stays until Landing is left. If the remove fails, the card is still removed (the in-memory snapshot is dropped) and the same text is shown; the next load re-validates.
- After Resume, the session keeps being saved after every Submit and every Next (FR-15). When the quiz finishes, the saved session is removed (`store.remove(KEYS.session)`) independently of the best-score write: a failed or skipped best write never keeps the finished quiz saved. A failed session write is followed by a best-effort remove (U2).
- States: shown (normal / retry), discarded text, absent (nothing saved, nothing restorable, storage not persistent, bank not ready).

### 9.5 Load notice: saved data removed (US-6.3; T-43, T-42)

- A `role="status"` element (polite) at the top of the resume slot. It is mounted, empty, whenever Landing renders with persistent storage, so text added later is announced. It is filled once per page load, right after mount for data that fails to decode (known at startup) and when the bank is ready for a `stale` quiz, if any of these was removed (space for it is reserved from the first paint, §9.2):
  - saved quiz that fails to decode, has an unknown `schemaVersion`, or is `stale` for the current bank: `copy:progress.sessionRemoved`;
  - best scores that fail to decode or have an unknown `schemaVersion`: `copy:progress.bestRemoved`. Valid best scores are kept when only the quiz is bad (US-6.3); a bad best value never affects a valid saved quiz.
  - Both: both sentences, quiz first, in one `<p>`.
- Look: a `<p>` with an inline info icon (`aria-hidden`, `currentColor`) before the text, `--color-text` on `--color-bg`, `border-inline-start: 4px solid var(--color-border)`, `padding-inline-start: var(--space-3)`. No close button: it is text, not a dialog, and it does not block anything. It is cleared when Landing is left and not shown again (the bad data is gone).
- Focus does not move. The app never crashes on bad data: every decode path returns a result (`DecodeResult`, `RestoreQuizResult`), and an unexpected throw in this path is treated like corrupt data.
- Missing keys (first visit, or after reset) are not "removed data": no notice.
- Oversized values (over `MAX_VALUE_LENGTH`) read as absent (`get` returns `null`): no notice, no card, and they are not removed; they are overwritten by the next save or cleared by Reset progress.

### 9.6 Inline confirmation pattern (replace and reset)

```
320                                   768 / 1280
| [         Start quiz         ] |    | [ Start quiz ]                              |
| This will discard your         |    | This will discard your unfinished quiz.     |
| unfinished quiz.     (focused) |    | [ Start new quiz ] [ Cancel ]               |
| [       Start new quiz       ] |
| [           Cancel           ] |
```

- Markup: right after the trigger (and its hint), a `<div role="group" aria-labelledby="{msgId}">` holding `<p id="{msgId}" tabindex="-1">` (the message), then the primary confirm button and the secondary `copy:common.cancel`, following the §0 button rules. No border or background: it reads as the next step of the trigger, separated by `--space-3`. The message uses `--color-text` (not danger colour) and has no icon.
- Open: activating the trigger shows the group and focuses the message (read in full; Tab reaches confirm, then Cancel). The trigger gets `aria-expanded="true"` and `aria-controls` the group while it is open (`false` when closed). Activating the trigger again while open keeps it open and refocuses the message.
- Cancel, or Escape while focus is inside the group: closes it and focuses the trigger.
- Confirm: performs the action (below).
- No live region: focus on the message does the announcing. Not a modal: the rest of the page stays usable; nothing is trapped.

**Replace confirmation (US-6.4; T-43).** Trigger: Start, when a resume card is shown (a restorable quiz exists). Without one, Start behaves as in §1. Message `copy:landing.replaceMessage`; confirm `copy:landing.replaceConfirm`. Confirm: start the quiz for the **currently selected** scope (topic or Mixed; changing the radio while the group is open is allowed and keeps it open), first `store.remove(KEYS.session)` (result ignored), then start the new quiz, which is saved from its first Submit as usual (FR-15), go to `#/quiz` and focus its `h1` (§0). Start's single-activation guard applies to the confirm button. Removing first means that leaving the new quiz before its first Submit does not bring back the old card. If creating the quiz fails, close the group and show `landing.startError` as today; the old quiz is already removed (the user confirmed discarding it), so the card is not shown again. Selecting nothing is impossible here: the group only opens from an available Start.

**Reset progress (US-6.6; T-44).**

- Section: `<section aria-labelledby>` with `h2` `copy:progress.heading`, `<p>` `copy:progress.description` (body text), and a secondary button `copy:progress.reset`. Placed after "About the questions", as the last thing in `main`. Rendered only when storage is persistent (U2); shown whether or not anything is saved, so it is predictable.
- Trigger: Reset progress. Message `copy:progress.resetMessage`; confirm `copy:progress.resetConfirm` (primary).
- Confirm: `clearAppKeys()` (removes only keys starting with `apiquiz:`, US-6.6). Then, in the same render: best-score lines disappear, the resume card (or its discarded text) and the load notice disappear, and the group is replaced by `<p tabindex="-1">` `copy:progress.resetDone`, which is focused. The Reset progress button stays (focus can go back to it with Shift+Tab).
- Failure (`ok: false`): the group is replaced by `<p tabindex="-1">` `copy:progress.resetFailed`, focused; the page shows what is still stored (re-read).
- The result text stays until Landing is left or Reset progress is activated again.

### 9.7 Keyboard and focus summary

| Action | Focus goes to | Announced by |
| --- | --- | --- |
| Landing first load (with card or notice) | nowhere (§0) | load notice via `role="status"`; card read in order |
| Exit / Back from a quiz | Landing `h1` (§0) | card follows the description in reading order |
| Resume quiz | Question `h1` | `h1` ("Question 4 of 10") |
| Discard quiz | discarded text (`tabindex="-1"`) | focused text |
| Start with a saved quiz | replace message | focused message, then group label |
| Start new quiz (confirm) | Question `h1` | `h1` |
| Cancel / Escape | the trigger (Start or Reset progress) | trigger |
| Reset progress (open) | reset message | focused message |
| Yes, reset progress | result text | focused text |

Tab order on Landing: brand (and skip link), Resume quiz, Discard quiz, topic radios (one stop), Start, [confirm, Cancel], report link, Reset progress, [confirm, Cancel]. All controls are native buttons (Enter and Space). Focused text targets show no ring (tokens.md §4: script-focused non-interactive elements).

### 9.8 Copy summary

New keys (defined in `copy.md`): `landing.bestScore`, `landing.replaceMessage`, `landing.replaceConfirm`, `common.cancel`, `resume.heading`, `resume.summary`, `resume.summaryRetry`, `resume.resume`, `resume.discard`, `resume.discarded`, `progress.sessionRemoved`, `progress.bestRemoved`, `progress.heading`, `progress.description`, `progress.reset`, `progress.resetMessage`, `progress.resetConfirm`, `progress.resetDone`, `progress.resetFailed`. Existing `results.retryNote` is now rendered (U2).

### 9.9 Accessibility and responsive checks (proposed, not verified)

- Headings: h1 > h2 (Unfinished quiz, About the questions, Your progress). The card and the progress section are named `section`s (regions with distinct names); no other new landmarks.
- Not colour-only (1.4.1): best score, card, notice and confirmations are all text; the card border and notice edge are decoration. Forced colours: borders become `CanvasText` (tokens.md §6); the info icon uses `currentColor`.
- Targets: every new button is at least `--target-min`, with `--space-2` between buttons (2.5.8). Accessible names match visible labels (2.5.3): "Resume quiz", "Discard quiz", "Start new quiz", "Cancel", "Reset progress", "Yes, reset progress".
- Focus is never lost when an element is removed (2.4.3): discard, reset and failures all focus replacement text. Nothing sticky or fixed; nothing obscures focus (2.4.11).
- Status messages (4.1.3): the load notice uses `role="status"`; other results are announced by moving focus to them, so nothing is announced twice.
- 320 and 400% zoom: single column, card and confirmation buttons full width and stacked, all text wraps, no horizontal scroll. 640x360: the card is roughly one screen tall at most; everything is reached by vertical scrolling. 768 / 1280: buttons inline at auto width in the 45rem column.
- Reduced motion: nothing animates (no slide or fade on card, notice or confirmation).
- Privacy (US-6.8): nothing on these screens shows or stores personal information; the stored shape is fixed by the T-41 codecs.
- To verify in T-43 / T-45 (E2E) and the manual pass: axe on Landing with a card, a notice, both confirmations open, and in private mode; CLS < 0.01 per load with a restorable saved quiz, a stale one, a corrupt one, and best scores (§9.2).

### 9.10 Open questions for the sponsor / PO (US-6)

- **DQ-US6-1** Discard has no confirmation (U5). Accidental taps lose an unfinished quiz. Proposed: no confirmation. Alternative: reuse the §9.6 pattern.
- **DQ-US6-2** Rows without a best score show nothing (U8). Alternative: "No best score yet". Proposed: nothing, to keep rows short.
- **DQ-US6-3** In memory-only mode (US-6.5) the features are silently hidden. Should Landing say "Progress cannot be saved in this browser"? Proposed: no; the AC only asks to hide them.
- **DQ-US6-4** Should Results say "New best score" or show the previous best? Not in US-6 AC. Proposed: not in US-6 (a later story).
- **DQ-US6-5** Placement of Reset progress: a "Your progress" section at the end of Landing (U1) rather than inside "About the questions" or a footer. Please confirm.
- **DQ-US6-6** Button labels are "Resume quiz" and "Discard quiz", not the bare "Resume" / "Discard" quoted in US-6.2, so each name makes sense on its own. Please confirm; tests should match the copy keys.
- **DQ-US6-7** Card wording does not show when the quiz was saved (`savedAt` exists). Proposed: leave it out; there is no expiry (Q5).
