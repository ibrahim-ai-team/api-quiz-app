# Tech Lead review: ApiQuiz (QUIZ-ARCH-D04)

Recorded by the coordinator from the tech-lead's returned report (tech-lead is read-only). Inputs: files 01–03. Nothing installed, built or measured; bundle figures are reasoned estimates to be confirmed by the CI budget check (ADR V-3).

## 1. Buildability verdict

**Yes, with 6 adjustments.** All tools are mainstream, free and run on GitHub Actions.

- JS budget (200 KB gzip) is realistic: React 19 runtime ≈ 60–65 KB gzip, app code ≈ 15–35 KB; Zod is build-time only and the question data is a separate JSON asset. Expected total ≈ 80–100 KB. Preact is a fallback, not needed now. Measure gzip over every emitted JS file.
- Main risk is Lighthouse mobile Performance ≥ 90 (LCP under throttling). Mitigation: start the data `fetch` at the top of the entry module, render the landing shell before data arrives, optionally put the static heading in `index.html`.

Adjustments:

1. Inject the CSP meta at build time only (`transformIndexHtml`, `apply: 'build'`); run E2E against `vite preview` so the CSP is tested.
2. With `base: '/api-quiz-app/'`, Lighthouse CI and Playwright use `npm run preview` at `http://localhost:4173/api-quiz-app/`, not `staticDistDir`.
3. Hashed data asset without a custom plugin: `scripts/build-content.ts` writes `src/content/generated/bank.json` (gitignored); the loader imports it with `?url` and fetches it.
4. Playwright on PRs: Chromium at all 6 widths plus a WebKit iPhone project; Firefox and the full device set on `main` and as a release gate (placement change, not a weaker check).
5. Lighthouse CI: 3 runs, assert the median; hard thresholds once real UI exists (after US-1).
6. Drop `vitest-axe` (jsdom cannot evaluate contrast/layout); `@axe-core/playwright` is the check counting toward SC-4.

Also: run scripts with Node's built-in type stripping (`erasableSyntaxOnly`), fall back to `tsx`; pin Node in `.nvmrc` and `engines`.

## 2. Provisioning strings for `api-quiz-app`

- **stack:** TypeScript (strict), React 19, Vite, CSS Modules with CSS custom-property design tokens, built-in hash router, Zod for build-time content validation only; static SPA deployed to GitHub Pages; Node.js active LTS for build and CI only
- **testing:** Vitest unit tests (domain engine, safe text renderer, storage guards) and Vitest + Testing Library component tests; content schema validation script in CI; Playwright E2E against the production build (Chromium + WebKit mobile on PRs, Firefox and full device set before release) with @axe-core/playwright, viewport, offline and same-origin request checks; Lighthouse CI (mobile) and gzip size budgets in CI
- **setup:** Install the Node.js version in `.nvmrc`, run `npm ci`, then `npm run dev`; `npm run check` runs lint, typecheck, content validation and unit tests, and `npm run e2e` runs Playwright against `npm run build && npm run preview`.

## 3. Implementation standards

1. Layout: `src/domain/` pure TS (no React/DOM/storage); `src/storage/` only code touching `localStorage`; `src/content/` loader and types (`generated/` gitignored); `src/ui/` with `app/`, `views/<View>/`, `components/`, `text/renderRichText.tsx`, `strings.ts`, `styles/tokens.css`; `content/` source data; `scripts/` build tools; tests in `tests/unit/**`, co-located `*.test.tsx`, `tests/e2e/**` with `fixtures/`.
2. Import boundaries enforced with ESLint `no-restricted-imports` (`domain` imports nothing from `ui`/`storage`/`react`; `ui` uses only the `ProgressStore` interface).
3. TS: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`; no `any` or `!` without a comment; fetched/stored data enters as `unknown` and passes a type guard.
4. ESLint flat config (`typescript-eslint` strict-type-checked, `jsx-a11y` strict, `react-hooks`, `react/no-danger: error`), Prettier defaults, `--max-warnings 0`.
5. Text-only rendering through `renderRichText`; no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`; data links only when `https:`, with `rel="noopener noreferrer"` and a visible cue.
6. No inline scripts/styles in `index.html`; no third-party origins, fonts or CDNs.
7. Determinism: injected seeded `Rng` and clock; no `Math.random` outside `rng.ts`.
8. One `useReducer` per quiz flow over pure domain functions; strings in `src/ui/strings.ts`.
9. Accessibility in every UI task's DoD: `fieldset`/`legend` + native radios, visible focus, focus moves per G4, ≥ 44 px targets, `prefers-reduced-motion`, `forced-colors`, per-view document title.
10. Errors: top-level error boundary; storage returns status values and never throws; no `console.log` in `src/`; nothing user-related logged.
11. Tests per story: unit test per domain rule, component test per interactive state, ≥ 1 Playwright test per acceptance criterion named `T-US<n>-<k>` with no-horizontal-scroll and axe helpers; domain line coverage ≥ 90%.
12. E2E serves `tests/e2e/fixtures/bank.json` via `page.route`; only unit tests assert seeded order.
13. `content:validate` on every PR; `--release` adds US-8 thresholds; production builds exclude drafts.
14. One task per branch/PR, Conventional Commits, ≈ 400 changed lines max (lockfile excluded); PR states task/story/AC IDs, commands and results, bundle size before/after.
15. New runtime dependency needs tech-lead approval and a size note; versions pinned by lockfile; CI actions pinned by SHA.

## 4. Sprint 1 candidate task breakdown

| ID | Story | Owner | Allowed paths | Deps | Size | Acceptance checks |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Bootstrap | devops-platform | `package.json`, `package-lock.json`, `.nvmrc`, `tsconfig*.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `index.html`, `src/main.tsx`, `src/ui/app/App.tsx`, `src/ui/strings.ts`, `README.md` | — | 3 | `npm ci`, `npm run check`, `npm run build` pass; `dangerouslySetInnerHTML` fixture fails lint; boundary rule rejects `react` in `src/domain`; `base` is `/api-quiz-app/`; built `index.html` has CSP meta and no inline script; dev server works |
| T-02 | Bootstrap CI | devops-platform | `.github/workflows/ci.yml`, `.github/dependabot.yml`, size-budget config | T-01 | 2 | PRs run lint, typecheck, unit, `content:validate`, build, ≤ 200 KB gzip JS budget (250 KB fixture fails); SHA-pinned actions; `contents: read`; dependency review; `npm audit --audit-level=high` |
| T-03 | Bootstrap E2E | qa-automation | `playwright.config.ts`, `tests/e2e/**`, `ci.yml` (serial after T-02) | T-02 | 3 | E2E against preview with base path; helpers for no-horizontal-scroll, axe serious/critical, offline-after-load with 0 requests, same-origin requests; shell smoke test passes in CI; fixture bank via `page.route` |
| T-04 | Design | ui-ux-designer | `docs/design/**` | — | 3 | Specs for Landing, Question, Feedback, Results, error/loading: tokens with contrast ratios, ≥ 44 px targets, layouts at 320/768/1280, focus order (G4), non-colour state markers |
| T-05 | US-7 | backend-developer | `content/**`, `scripts/content/**`, `scripts/validate-content.ts`, `tests/unit/content/**` | T-01 | 3 | Failing fixture per FR-21/FR-22 rule, retired-ID reuse and https-only, errors name ID and field; `--release` enforces US-8 thresholds; ≈ 6 draft seed questions across 3 topics |
| T-06 | US-7 | backend-developer | `scripts/build-content.ts`, `src/content/**`, `package.json` scripts (serial after T-01) | T-05 | 2 | Production build has no drafts; stable `contentVersion`; data ≤ 60 KB gzip; loader returns ok/error, never throws |
| T-07 | US-1 | frontend-developer | `src/domain/rng.ts`, `types.ts`, `createQuiz.ts`, `tests/unit/domain/createQuiz.test.ts` | T-06 (types) | 2 | FR-2/3/4: N = min(10, count); Mixed spans ≥ 3 topics where possible; no duplicates; seeded order; true/false not shuffled (FR-5) |
| T-08 | US-1 | frontend-developer | `src/ui/app/**`, `src/ui/styles/tokens.css` | T-01, T-04, T-06 | 3 | Hash routes incl. 404 view; loading indicator after 300 ms; data-failure Retry (FR-25); per-view title; router/reducer component tests |
| T-09 | US-1 | frontend-developer | `src/ui/views/Landing/**` | T-07, T-08 | 2 | Topics in curated order with counts plus Mixed; empty topics hidden; double activation creates 1 quiz; ≤ 2 interactions to first question (E2E `T-US1-*`); topic deep link |
| T-10 | US-2 | frontend-developer | `src/ui/text/renderRichText.tsx`, `src/ui/text/*.test.tsx` | T-01 | 2 | Paragraphs, inline code, fenced blocks; `<script>`, `<img onerror>`, `javascript:` render literally (V-1); focusable labelled code scroll box |
| T-11 | US-2 | frontend-developer | `src/domain/answer.ts`, its test, `types.ts` (serial after T-07) | T-07 | 1 | Submit locks; double submit records 1 answer; `next` advances exactly 1 |
| T-12 | US-2 | frontend-developer | `src/ui/views/Question/**` | T-08, T-10, T-11 | 3 | Radio group with `fieldset`/`legend`; "k of N" and topic; Submit `aria-disabled` with hint until selection; locked after submit; no page horizontal scroll; Back/Exit to Landing (FR-26) |
| T-13 | US-3 | frontend-developer | `Question/Feedback*.tsx`, `components/ExternalLink.tsx`, `report/reportLink.ts` (serial after T-12) | T-12 | 3 | Text verdict; non-colour marking; polite live region then focus to Next (G4); https guard; report link via `URLSearchParams` (ID + `contentVersion`); "See results" on last |
| T-14 | US-4 | frontend-developer | `src/domain/score.ts`, its test | T-11 | 1 | X/N, half-up rounding, band messages, per-topic breakdown when > 1 topic; 0%, 100%, N = 1 |
| T-15 | US-4 | frontend-developer | `src/ui/views/Results/**` | T-13, T-14 | 2 | Score, %, message, breakdown; "Try again" fresh draw; "Choose another topic"; focus to heading |
| T-16 | US-9/US-10 | qa-automation | `tests/e2e/flow.spec.ts`, `tests/e2e/responsive.spec.ts` | T-03, T-15 | 3 | J1 end to end incl. keyboard-only; no horizontal scroll at 320/375/768/1280/1920 and 640×360; rotation keeps state; 400% reflow; axe on every state; offline after load; deep-link refresh |
| T-17 | US-9 | frontend-developer | `src/ui/**/*.module.css`, `src/ui/styles/**` | T-16 | 2 | All T-16 responsive/contrast failures fixed; ≥ 44 px; reduced motion and forced colours; T-16 passes |
| T-18 | SC-5 | performance-engineer | `lighthouserc.json`, `ci.yml` (serial) | T-03, T-09 | 2 | LHCI mobile, 3 runs against preview; median Performance ≥ 90, Accessibility ≥ 95 from US-1 on; baseline report attached |

Parallel-safe: T-04 with T-01/T-02; T-05/T-06 with T-07, T-10, T-11 after T-01 (T-07 may start against a stub content-type interface). Serial chains: `ci.yml` T-02 → T-03 → T-18; `types.ts` T-07 → T-11; Question view T-12 → T-13.

Points: Bootstrap 11, US-7 5, US-1 7, US-2 6, US-3 3, US-4 3, US-9/10 slice 5, SC-5 2; total 42 over 18 tasks.

## 5. Disagreements and recommended resolutions

1. **Sprint 1 over capacity** (`standards/sprint-sizing.md`: first pilot sprint ≤ 3 stories). Commit Bootstrap (T-01–T-04) + US-7 + US-1 + US-2; US-3 stretch; US-4, US-9 (T-16/T-17) and T-18 to Sprint 2. Owner: project-manager.
2. **US-9/US-10 double counting**: every UI task meets the a11y/responsive DoD with its own tests; US-9/US-10 close with T-16/T-17 plus the manual NVDA/VoiceOver and iOS Safari pass after US-4.
3. **Multi-tab "changed in another tab" prompt (US-6)** over-built for P1: last-write-wins plus FR-20 validation; defer to R2. Owner: product-owner.
4. **US-1 "order differs"** not reliably testable: assert seeded shuffle in unit tests only (BA amendment US-1(c)).
5. **ADR test table**: update per adjustments 4 and 6 (architect).
6. **ADR data preload**: replace with `?url` import + early `fetch` (adjustment 3).
7. **ADR CSP in dev**: add to V-4 "CSP present in build output only; E2E runs against preview".
8. **D2 open**: no Pages deploy workflow or remote repository until the sponsor confirms; a deploy task (devops-platform, 2 points, `.github/workflows/deploy.yml`) is added after D2.
