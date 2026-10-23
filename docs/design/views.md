# View specifications (T-04)

Strings are referenced as `copy:key` and defined in `copy.md`. Tokens are in `tokens.md`. Route names are proposals for T-08 (hash router): `#/`, `#/topic/<slug>`, `#/quiz`, `#/results`, anything else = 404.

## 0. Shared shell (T-08)

- Landmarks: `header` (brand; Exit button on the quiz route), `main` (one `h1` per view), no global footer in Sprint 1 (US-6 "Reset progress" will decide where it goes). `<html lang="en">`.
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

## 1. Landing (T-09; US-1, US-12.1; resume slot for US-6)

Hierarchy: h1, description, [resume banner slot], topic group (fieldset), Start + hint, "About the questions" (h2, accuracy note, report link).

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

- Topic group: `fieldset` + `legend` (`copy:landing.topicsLegend`) with native radios. Each row is a full-width `label` (`--option-min`, the whole row can be tapped). Its accessible name is the name plus the count, for example "Status codes, 12 questions". Topics appear in the curated order and only when they have at least 1 eligible question. Mixed comes last, shows the total, and is hidden when only 1 topic is shown (US-1.1, 1.2). Row states: default (2px border), hover (surface), selected (2px primary border, selected-bg, native checked radio), focus (ring on the row). Space for a best-score text slot is reserved per row for US-6.1.
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
- Exit quiz (secondary, `copy:question.exit`): returns to Landing and focuses its `h1`. Browser Back does the same (US-2.8). No confirmation (see DQ-1).
- Focus order: Exit, code box(es), radio group, Submit. Entry focus: `h1` (from Start, Try again or Next).
- Title: `copy:title.question` (for example "Question 3 of 10 - HTTP methods - ApiQuiz"). Live region: the feedback status region (§3) is mounted empty here.
- States: unselected, selected, submitting (instant, no spinner), locked. If `#/quiz` is opened with no quiz in memory (refresh before US-6), redirect to `#/` and focus `h1`.
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

## 4. Results (T-15; US-4; US-5 slot)

```
320                                   768 / 1280
| Your results             (h1)  |    | Your results                           (h1) |
| Mixed                          |    | Mixed                                       |
| 7 / 10                  (3xl)  |    | 7 / 10   70%                         (3xl) |
| 70%                            |    | Good progress. A bit more practice ...      |
| Good progress. A bit more      |    | Score by topic                         (h2) |
| practice will make it solid.   |    |  - HTTP methods: 2 / 3                      |
| Score by topic           (h2)  |    |  - Status codes: 3 / 4                      |
|  - HTTP methods: 2 / 3         |    | [ Try again ] [ Choose another topic ]      |
|  - Status codes: 3 / 4         |    | [Review / Retry missed slot - US-5]         |
| [          Try again         ] |
| [    Choose another topic    ] |
| [Review / Retry missed - US-5] |
```

- Score: `copy:results.score` ("X / N") and `copy:results.percent` (whole number, half-up; computed in T-14) in one `<p>`, bold `--font-size-3xl`. Band message `copy:results.band.*` (US-4.2). The scope line shows the topic name or "Mixed".
- Breakdown (US-4.3): `h2` plus a `ul`, only when the quiz covered more than 1 topic. A list rather than a table, because it reflows at 320 without horizontal scroll.
- Try again (primary): a fresh draw with the same scope, focus on the Question `h1`. Choose another topic (secondary): goes to Landing and focuses its `h1`; proposal: the topic just played is preselected (DQ-5).
- Entry focus: `h1` (US-4.5). Title `copy:title.results`. Live region: none (focusing the heading is enough).
- Edge states: N = 1, 0% and 100% use the same layout with their band messages. Refreshing `#/results` without results in memory redirects to `#/` (the US-6 save may change this later).
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
