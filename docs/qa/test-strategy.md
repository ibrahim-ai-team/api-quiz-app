# Test Strategy: ApiQuiz (`api-quiz-app`)

- **Delegation:** T-19-D01 (qa-automation), task T-19, Sprint 1. Date: 2026-10-21.
- **Inputs:** `docs/planning/01`..`05`. IDs US-n.k, FR-n, NFR-n, SC-n, V-n, T-n refer to those files. The brief (file 01) is the source of truth for acceptance-criteria text.
- **Companion:** `docs/qa/ac-test-matrix.md` maps each criterion to a test ID `T-US<n>-<k>`.
- **Evidence state:** Written as a plan in Sprint 1. Observed run status per criterion now lives in `docs/qa/ac-test-matrix.md` (header and section 7); a check counts as passed only with the observed output recorded there.
- **Manual passes:** `docs/qa/manual-pass-checklist.md` (T-16) holds the screen-reader, real-device iOS Safari, double-tap and Exit/Back checks of section 9.

## 1. Scope and risk ranking

The product is a static, client-only SPA (ADR-0001): Vite + TS + React, a hashed same-origin JSON question bank, hash routing, `localStorage` behind `ProgressStore`, and GitHub Pages hosting. There is no server, so there is no API or contract test level. "Integration" here means the content pipeline and the built app.

| Rank | Risk | Why it matters | Main defence (cheapest effective level first) |
| --- | --- | --- | --- |
| 1 | Wrong or malformed content ships (wrong key, draft leaks, bad URL) | G4: a wrong answer key is a defect; it breaks trust | Content validator unit tests with one failing fixture per rule; `content:validate` on every PR; `--release` thresholds; sponsor PR review (manual) |
| 2 | XSS through content or `sourceUrl` (T1, T2) | Script would run in the site origin | Renderer unit tests (V-1); `react/no-danger` lint; render-time https guard; CSP checked on `vite preview`; E2E with payload fixture |
| 3 | Quiz-flow logic errors (draw size, Mixed spread, double Start/Submit, lock) | Core journey J1 | Pure domain unit tests with a seeded RNG; component tests per interactive state; E2E per AC |
| 4 | Accessibility regressions (WCAG 2.2 AA, SC-4) | MVP goal G3 | axe on every view/state in E2E; keyboard-only E2E; manual NVDA/VoiceOver pass |
| 5 | Responsive breakage (SC-3) | Persona P3 is on mobile | No-horizontal-scroll helper at 6 viewports; reflow/zoom checks; manual iOS Safari pass |
| 6 | Budget or offline regressions (SC-5, SC-6) | Mobile performance and offline after load | gzip size check in CI; Lighthouse CI median of 3; offline-after-load E2E with a 0-request assertion |
| 7 | Untrusted `localStorage` (T5, US-6) | Crash on bad saved data | Storage guard fuzz tests (V-6), Sprint 3 with US-6 |

## 2. Test levels

| Level | Tool | Covers | Location / owner |
| --- | --- | --- | --- |
| Unit (domain) | Vitest | `rng`, `createQuiz` (N, Mixed spread, distinctness, seeded order, true/false fixed), `answer` (lock, single record, next +1), `score`, retry, best score, saved-state validation. **Only unit tests assert seeded order** (standard 12). Domain line coverage at least 90% | `tests/unit/domain/**`; T-07, T-11, T-14 |
| Unit (content) | Vitest + validator | One failing fixture per FR-21/FR-22 rule: the error names the question ID and field; retired-ID reuse; https only; draft exclusion; `contentVersion` stability; thresholds in `--release`; loader returns ok/error and never throws | `tests/unit/content/**`; T-05, T-06 |
| Unit (renderer) | Vitest + Testing Library | `renderRichText`: paragraphs, inline code, fenced blocks; `<script>`, `<img onerror>`, `javascript:` render as literal text (V-1); code box focusable and labelled | `src/ui/text/*.test.tsx`; T-10 |
| Component | Vitest + jsdom + Testing Library + `user-event` | Each interactive state: radio group semantics (`fieldset`/`legend`), `aria-disabled` Submit and hint, double activation, focus moves (G4), per-view title, router states. **No `vitest-axe`** (TL adjustment 6): jsdom cannot evaluate contrast or layout | Co-located `*.test.tsx`; T-08, T-09, T-12 |
| Content CI | `scripts/validate-content.ts` | Real `content/**` on every PR; `--release` adds US-8 thresholds | T-05, T-02 |
| E2E | Playwright against `npm run build && npm run preview` at `http://localhost:4173/api-quiz-app/` | User-visible behaviour of every UI criterion, named `T-US<n>-<k>`: journeys, viewports, keyboard-only, axe, offline, same-origin requests, CSP (only present in the build output), deep links and refresh, data failure | `tests/e2e/**`; harness T-03, specs in story tasks, flow and responsive suites T-16 |
| Accessibility automation | `@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` | 0 serious or critical issues on every view and state; emulated `prefers-reduced-motion` and `forced-colors` | E2E helper (T-03) |
| Performance and size | size-budget check; Lighthouse CI (`@lhci/cli`, mobile, 3 runs, median asserted) | JS at most 200 KB gzip over all emitted JS; data asset at most 60 KB gzip; Performance at least 90, Accessibility at least 95 | T-02, T-06, T-18 |
| Manual | Recorded checklist | Screen reader, real-device iOS Safari, content accuracy, repository settings (section 9) | QA, per release |

Rule: test each criterion at the lowest level that proves it, and add one E2E test per user-visible criterion (standard 11). Pure-data criteria (US-7) and seeded order (US-1.5) are proved by unit or CI tests, not Playwright (see matrix flag F-0).

## 3. Environments, browsers and viewports

- **Build under test:** a production build served by `vite preview` with `base: '/api-quiz-app/'`. Never use the dev server for E2E, because the CSP is injected at build time only (TL adjustment 1).
- **Node:** the version in `.nvmrc`; `npm ci` with the committed lockfile.
- **PR projects:** Chromium at 320x800, 375x812, 768x1024, 1280x800, 1920x1080 and 640x360 landscape, plus a WebKit iPhone-class device project.
- **`main` and release projects:** the PR set, plus Firefox (desktop widths) and the full device set (Pixel-class Android, iPhone-class landscape). This changes where the checks run; it does not weaken them (TL adjustment 4).
- **Not covered by emulation:** real iOS Safari, real Android Chrome, and private-mode storage behaviour. These get manual passes (section 9).

## 4. Test data and isolation

- **E2E fixture bank:** `tests/e2e/fixtures/bank.json` is served with `page.route` on the hashed data URL (standard 12). Tests never depend on the real content, which in Sprint 1 is about 6 draft seeds that a production build would exclude. Planned fixture contents:
  - `topic-a`: 12 eligible questions, so N is capped at 10.
  - `topic-b`: 5 eligible questions, so N = 5 and the label reads "5 questions".
  - `topic-c`: 3 questions: 1 true/false, 1 with a fenced HTTP snippet longer than 320 px, and 1 with `<script>`, `<img onerror>` and `javascript:` payloads in the prompt, explanation and an option.
  - `topic-d`: listed in `topics.json`, but with 0 eligible questions.
- **Variants:** `bank-single-topic.json` (Mixed hidden), `bank-invalid.json` (wrong shape), and a route that aborts or returns 500 (FR-25).
- **Drift guard:** every fixture except the deliberately invalid ones must pass the same schema validator in CI. Otherwise a fixture could test a shape that production never emits.
- **Content-validator fixtures:** `tests/unit/content/fixtures/` holds one minimal valid file plus one invalid file per rule. Each test asserts the failing question ID and field name.
- **Seeded RNG:** unit tests inject `Rng` with fixed seeds and assert exact orders. E2E cannot fix the seed in a production build, so E2E assertions do not depend on order: they check counts, membership, distinctness, topic spread and the "True, False" order.
- **Isolation:** each test uses a fresh browser context, so `localStorage` starts empty. There is no shared state and no order dependence between tests. Tests inject a clock where time matters. Tests do not use `Math.random`.

## 5. CI quality gates

| Gate | PR | `main` | Release |
| --- | --- | --- | --- |
| Lint (`--max-warnings 0`, `react/no-danger`, `jsx-a11y`, import boundaries), typecheck | Block | Block | Block |
| Unit and component tests; domain coverage at least 90% | Block | Block | Block |
| `content:validate` | Block (dev thresholds warn only) | Block | Block, with `--release` |
| Build plus JS budget of 200 KB gzip (a 250 KB fixture must fail) and data budget of 60 KB gzip | Block | Block | Block |
| `npm audit --audit-level=high`, dependency review | Block | Block | Block |
| E2E Chromium (6 viewports) and WebKit mobile, with axe and offline checks | Block (once T-03 lands) | Block | Block |
| E2E Firefox and full device set | Not run | Block | Block |
| Lighthouse CI, median of 3 (Performance at least 90, Accessibility at least 95) | Block once T-18 lands (Sprint 2); NOT RUN before that | Block | Block |
| Manual passes: NVDA/VoiceOver, iOS Safari, keyboard | Not run | Not run | Recorded evidence required |

The rulesets that enforce "Block" are not verified here. They need to be checked in the repository settings (V-5).

## 6. Accessibility and responsive approach

- **Automated:** an axe scan in every E2E state (landing, question unselected, selected, submitted, 404, error, and later feedback, results and review). Keyboard-only E2E per story: Tab order, arrow keys within the radio group, Enter/Space to activate, and a check that focus moves to the expected element. A no-horizontal-scroll helper (`scrollWidth <= clientWidth` on `documentElement`) runs at each viewport. Target sizes of at least 44x44 come from bounding boxes. Reflow is tested at 320 CSS px (equivalent to 400% at 1280). 200% text is tested with root font-size scaling, and text spacing with injected WCAG 1.4.12 CSS. `forced-colors` and `reduced-motion` are emulated.
- **Manual, recorded with browser, AT and version:** NVDA + Firefox or Chrome on Windows, and VoiceOver + iOS Safari on a real device. Each covers radio-group announcement, the live-region verdict (US-3.3), and focus moving to the question heading on Next. Contrast is spot-checked in forced-colours mode. The manual pass runs after US-4 (closes US-9.6 and US-10.3) and before each release.

## 7. Performance and size budgets

JS at most 200 KB gzip (T-02), data at most 60 KB gzip (T-06), and Lighthouse mobile Performance at least 90 and Accessibility at least 95 as the median of 3 runs (T-18). Each PR reports bundle size before and after (standard 14). NFR-1 "submit to visible feedback at most 100 ms" has no defined device profile yet, so it is proposed as a performance-engineer measurement in T-18 and is not a gate (matrix flag F-9).

## 8. Security verification (ADR section 6)

| ID | Check | Level | Task | Sprint |
| --- | --- | --- | --- | --- |
| V-1 | `react/no-danger` lint fixture fails; `<script>` and `<img onerror>` render literally | Lint + unit + E2E (T-US2-7) | T-01, T-10 | 1 |
| V-2 | Content rules for https only, retired IDs and duplicates; runtime href guard | Unit + CI | T-05; guard in T-13 | 1 / 2 |
| V-3 | gzip budget fails the build above its limit | CI (250 KB fixture must fail) | T-02, T-06 | 1 |
| V-4 | No console CSP violations; all requests same-origin; 0 requests after `setOffline(true)` | E2E helpers on every spec | T-03 | 1 |
| V-5 | SHA-pinned actions, least-privilege permissions, deploy only from `main`, Dependabot and dependency review on | Manual review of workflows and repository settings (observed, not assumed) | T-02 review, T-20 | 1 / 2 |
| V-6 | Storage fuzz tests: corrupt, wrong-type, oversized, unknown-schema and stale-ID data are discarded and the app does not crash | Unit | US-6 tasks | 3 |
| V-7 | HTTPS enforced and CSP meta present on the live site | Scripted fetch plus manual check after the first deploy | T-20 | 2+ |

`code-review-security` remains the independent reviewer. These tests support that review; they do not replace it.

## 9. Not automated, and why

| Item | Why | Substitute |
| --- | --- | --- |
| Screen-reader output (US-10.3, part of US-3.3) | Playwright cannot observe what NVDA or VoiceOver speaks | Live-region text and role asserted automatically; manual pass recorded |
| Real-device iOS Safari (US-9.6) | WebKit emulation is not Safari on iOS | Manual pass after US-4 and per release |
| Content accuracy, non-author review, sponsor review (US-8.2 to US-8.5) | Human judgement; CI cannot prove who reviewed | `reviewedBy` presence and a warning when it equals the author; PR review record |
| Repository settings (V-5) and the live site (V-7) | Outside the test runner; a setting does not prove itself | Recorded observation with a timestamp |
| Visual clipping and overlap (US-9.1, partly) | Pixel-perfect assertions are brittle | Scroll-width and bounding-box checks plus screenshots attached for review |

## 10. Defect handling

- **Severity:** S1 blocks the journey or is a security issue, privacy issue or wrong answer key (US-8.4). S2 breaks an acceptance criterion with a workaround. S3 is minor. S4 is cosmetic.
- **Report format:** ID, AC or test ID, build/commit, browser and viewport, steps, expected, actual, and evidence (Playwright trace, screenshot, log).
- **Rules:** S1 and S2 block story exit. Each fix adds or updates a regression test with the same `T-US` ID, and QA re-tests it.
- **Flaky tests:** CI uses `retries: 1` with a trace on the first retry. A pass that needs the retry counts as **flaky**: QA reports it and logs a defect. Quarantine needs a tech-lead-approved issue with an owner and a due date. Security, axe and offline gates are never quarantined. A gate is never weakened to get a green result.

## 11. Entry and exit criteria

- **Story QA entry:** the PR CI run is observed and green for lint, unit and build; every AC has a matrix row; the fixture bank holds the required data.
- **Story exit:** every `T-US<n>-<k>` for the story passes in observed CI output, with the commit SHA recorded. Manual rows are recorded with evidence or explicitly listed as pending. There are no open S1 or S2 defects. Remaining gaps are listed in the QA report.
- **Release exit:** the story exits above for all MVP stories (SC-1), plus `--release` validation, the full browser matrix, Lighthouse CI, the manual NVDA/VoiceOver and iOS Safari passes, and V-5 and V-7 observed.
