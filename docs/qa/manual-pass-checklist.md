# Manual Pass Checklist: ApiQuiz (screen reader, iOS Safari, double tap, Exit/Back)

- **Delegation:** T-16-D01 (qa-automation), task T-16, issue #36, Sprint 2. Date: 2026-10-21.
- **Why manual:** Playwright cannot hear what NVDA or VoiceOver says, and WebKit emulation is not Safari on a real iPhone (test strategy section 9). The automated parts of the same criteria are in `tests/e2e/flow.spec.ts`, `tests/e2e/responsive.spec.ts`, `question.spec.ts` and `results.spec.ts`.
- **Inputs on #36:** tech-lead T-13-R01 M2 (live-region verdict can be dropped when focus moves at the same time), T-14-15-R02 L1 (`MouseEvent.detail > 1` on a fast second tap in iOS Safari).
- **Status:** NOT RUN. Nothing below has been executed yet. Who runs it: the sponsor or QA, after US-4 and before each release (strategy section 11).

## How to record a run

Fill in the run header once per session, then each row's **Result** (PASS / FAIL / BLOCKED / N/A) and **Notes**. For a FAIL, write what you heard or saw, and file a defect (strategy section 10) with the item ID. Attach a screen recording when you can.

| Field | Value |
| --- | --- |
| Tester |  |
| Date |  |
| Build / commit SHA, or live URL |  |
| Device, OS and version |  |
| Browser and version |  |
| Screen reader and version (if used) |  |

Test data: any real-content build works. Pick a topic quiz and a Mixed quiz. "Correct" and "Incorrect" below mean you choose the right answer or a wrong one, on purpose.

## A. US-10.3 screen reader pass (and M2)

Run section A once in **each** of these four set-ups and record each one separately (copy the table):

1. NVDA + Chrome (Windows)
2. NVDA + Firefox (Windows)
3. VoiceOver + Safari (macOS)
4. VoiceOver + Safari (iOS, real device; swipe and double-tap to activate)

| ID | Steps | Expected result | Result | Notes |
| --- | --- | --- | --- | --- |
| SR-1 | Open the app. Move to the topic list with Tab (NVDA) or the rotor/swipe (VoiceOver). | The group is announced with its name "Choose a topic". Each topic is announced as a radio button with its name and count (for example "HTTP methods, 12 questions"), and "1 of N" or similar position info. |  |  |
| SR-2 | Select a topic and activate "Start quiz". | Focus moves to the heading and "Question 1 of N" is announced. |  |  |
| SR-3 | Move into the answers. | The group "Choose one answer" is announced as a radio group; each option is announced as a radio button with its text and checked state. |  |  |
| SR-4 | Without selecting, move to "Submit". | Announced as a button that is unavailable/dimmed, with the hint "Choose an answer to submit." Activating it does nothing. |  |  |
| SR-5 (M2) | Choose a **correct** answer and activate Submit. Do not move for 3 seconds. | You hear the verdict "Correct: <option>." **and** focus lands on "Next" (announced as a button). Record whether the verdict was announced **before, after, or not at all**, and whether it was cut off by the focus announcement. |  |  |
| SR-6 (M2) | On the next question choose an **incorrect** answer and Submit. | You hear "Incorrect. Correct answer: <option>." and focus is on "Next". Same recording as SR-5. Repeat SR-5/SR-6 three times in total; note any run where the verdict is dropped. |  |  |
| SR-7 | With focus on Next, move backwards (Shift+Tab, or swipe left). | You reach "Report a problem with this question (opens in new tab)", then the source link "<hostname> (opens in new tab)". The new-tab cue is read as part of each link name. The locked options are read as text in reading order, not as stops you can change. |  |  |
| SR-8 | Activate "Next". | Focus moves to the new heading and "Question 2 of N" is announced. The previous verdict is not read again. |  |  |
| SR-9 | Finish the quiz and activate "See results". | Focus moves to "Your results" and the heading is announced. Score "X / N", the percentage and the message can be read. For Mixed, "Score by topic" and its list items can be read. |  |  |
| SR-10 | Read a question that contains a code example (if the content has one). | The code box is announced as a region named "Code example" and can be reached and scrolled with the keyboard/gestures. |  |  |

**If SR-5 or SR-6 fails in any set-up** (the verdict is not announced or is cut off): log a defect for T-17 or a follow-up (owner: frontend-developer). The proposed fix from T-13-R01 M2 is to focus Next first and set the live text about one animation frame or 150 ms later. Do not use `aria-describedby` on Next. This reverses the order written in views.md §3, so it needs the designer's agreement first.

## B. US-9.6 real-device iOS Safari pass

Device: a real iPhone with current iOS Safari (not a simulator). Portrait first, unless the step says otherwise.

| ID | Steps | Expected result | Result | Notes |
| --- | --- | --- | --- | --- |
| IOS-1 | Open the live URL. | Landing loads; no horizontal scrolling when you drag sideways; text is readable without zooming. |  |  |
| IOS-2 | Tap a topic row anywhere on the row (not only on the circle). | The row is selected. Rows and buttons are easy to hit (at least about a fingertip, 44 px). |  |  |
| IOS-3 | Tap "Start quiz", answer a few questions with taps, including one with a code example if present. | Each step works with a single tap; the code box scrolls sideways on its own, the page does not. Feedback appears under the options and Next is reachable with the thumb. |  |  |
| IOS-4 | Mid-question, select an answer, then rotate to landscape and back. Then submit, rotate again. | The same question, the same selection and later the same locked answer and feedback are kept. No horizontal page scroll in either orientation. |  |  |
| IOS-5 | In feedback, tap the source link, then return to the app tab. | The source opens in a new tab; the quiz is still on the same question with the feedback shown. |  |  |
| IOS-6 | Settings > Accessibility > Display & Text Size > Larger Text: set a large size (about 200%). Return to Safari and reload. Answer one question. | All text is visible, nothing overlaps or is cut off, and every control can still be reached. Note: automated tests found a defect at this size on narrow screens (D-T16-01, see section E). |  |  |
| IOS-7 | Pinch-zoom to the maximum on a question. | Content can be zoomed; nothing is disabled. |  |  |
| IOS-8 | Turn on dark mode (Control Centre). | The app switches to the dark theme; text stays readable; the quiz state is kept (US-13.2). |  |  |
| IOS-9 | After the app has loaded, turn on Airplane mode and finish the quiz. | The quiz continues to results with no error (SC-6). |  |  |

## C. Double tap (T-14-15-R02 L1)

Device: the real iPhone from section B, iOS Safari. "Double tap" means two quick taps in the same spot, about as fast as you can (under 300 ms). Do each item three times.

| ID | Steps | Expected result | Result | Notes |
| --- | --- | --- | --- | --- |
| DT-1 | Select a topic, then double-tap "Start quiz". | Exactly one quiz starts at "Question 1 of N". No option is selected on question 1 by the second tap, and Submit is still unavailable. |  |  |
| DT-2 | On the last question, submit, then double-tap "See results". | The results view shows once with the score; the second tap does not activate "Try again" or "Choose another topic" (which sit under the finger). |  |  |
| DT-3 | On results, double-tap "Try again". | One new quiz at "Question 1 of N" for the same topic; nothing is selected on question 1. |  |  |
| DT-4 | Double-tap a topic row, then double-tap "Submit" and "Next" on a question. | Only one answer is recorded, and Next moves forward exactly one question. |  |  |

**If DT-1, DT-2 or DT-3 fails:** log a defect for T-17 or a follow-up (frontend-developer): add a short time-window fallback to `useEntryClickGuard` that ignores a pointer sequence starting within about 300 ms of the guard arming.

## D. Exit and Back behaviour (US-2.8, US-10.6)

Run on one desktop browser with the keyboard and on the iPhone with taps.

| ID | Steps | Expected result | Result | Notes |
| --- | --- | --- | --- | --- |
| EB-1 | Start a quiz, answer question 1, go to question 2, activate "Exit quiz". | Landing shows with focus on its heading (screen reader: the heading is announced). No confirmation dialog (design DQ-1). |  |  |
| EB-2 | Repeat EB-1 but use the browser Back button (iOS: swipe from the left edge). | Same as EB-1: Landing with the heading focused. |  |  |
| EB-3 | After EB-1 or EB-2, press browser Forward. | Landing stays; the old quiz does not reappear. |  |  |
| EB-4 | On results, press browser Back. | Landing with the heading focused; Forward does not show stale results. |  |  |
| EB-5 | On results, activate "Choose another topic", then press Back. | Landing stays (results are not shown again). |  |  |
| EB-6 | During a quiz, tap the "ApiQuiz" brand text in the header. | Nothing happens: the brand is plain text on the quiz route, so a tap cannot exit the quiz by accident. |  |  |
| EB-7 | Reload the page during a quiz, and again on results. | Both go to Landing with the heading focused (no saved resume before US-6). |  |  |

## E. Known automated findings to look at during this pass

| ID | Finding | Where |
| --- | --- | --- |
| D-T16-01 | With 200% text and WCAG 1.4.12 text spacing at 320 and 375 px wide, the feedback option tags ("Correct answer", "Your answer") do not wrap and make the page scroll sideways (scrollWidth 426 px). | T-16 QA report; owner T-17 (frontend-developer) |
