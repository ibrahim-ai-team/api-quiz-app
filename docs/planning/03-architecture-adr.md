# Architecture and ADR-0001: ApiQuiz (`api-quiz`)

- **Delegation:** QUIZ-ARCH-D03 (software-architect), phase ARCHITECTURE (bootstrap Gate 2)
- **Inputs:** `01-product-brief.md` (QUIZ-DISC-D01) and `02-requirements-analysis.md` (QUIZ-DISC-D02). IDs FR-n, NFR-n, SC-n, US-n, A-n, G-n and D-n refer to those files.
- **Status:** Proposed. Not sponsor-approved. Date: 2026-10-21.
- **Labels:** *Fact* = stated in inputs or a documented platform property. *Assumption* = architect default, reversible. *Decision needed* = sponsor.
- **Not verified here:** none of the stack has been installed, built or measured. Bundle sizes are estimates that the CI budget check (V-3) must confirm.

## 1. Drivers (from the inputs)

| Driver | Source |
| --- | --- |
| No backend, no accounts, local-only storage | A1-A3, D3 |
| First-load JS at most 200 KB gzipped; Lighthouse mobile Performance at least 90 | SC-5, NFR-1 |
| Full quiz works offline after the first load, with 0 requests | SC-6, NFR-7 |
| WCAG 2.2 AA, focus management, live regions, responsive 320-1920 px | SC-3, SC-4, NFR-2, NFR-3 |
| Strict CSP, no third-party runtime origins, no `innerHTML` from data | NFR-5, FR-7 |
| Validated content files; release build fails on bad or insufficient content | US-7, FR-21, FR-22 |
| Stateful flow: resume, retry missed, review, multi-tab detection | FR-13 to FR-20 |
| Free hosting, low operating burden, a small team of agents | Brief section 6, skill policy |

## 2. Options compared

| Criterion | **A: Static SPA (Vite + TS + React), JSON content built in, static host** | **B: Full-stack SSR framework (e.g. Next.js) + API + DB** | **C: Static MPA, minimal JS (Astro static or hand-written HTML + vanilla TS)** |
| --- | --- | --- | --- |
| No backend in MVP (D3) | Meets | Violates: adds a server, a DB, secrets, and patching | Meets |
| Offline after load (SC-6) | Meets without a service worker: all code and data are in memory after the first load | Fails without a service worker; SSR navigations go to the network | **Fails without a service worker:** every page navigation is a network request |
| JS budget (200 KB) | Estimated 60-110 KB gzipped (React+DOM about 60 KB, app about 20 KB, plus the data asset counted separately) | Framework runtime plus hydration; reachable but tighter | Smallest (under 30 KB) |
| Stateful flow and a11y focus control | Strong: components and a reducer, plus mature testing and a11y lint tooling | Strong, but SSR/hydration adds edge cases | Weak: hand-built DOM state for resume, retry and live regions means more defect risk; across pages, state needs storage |
| Hosting cost | Free static hosting | Needs a server/serverless and a DB. Free tiers exist but have limits, cold starts and vendor lock-in. **Possible cost** | Free static hosting |
| Operational burden | Very low (static files only) | High (runtime, DB backups, migrations, secrets, uptime) | Very low |
| Security surface | Client only; CSP and a safe renderer | Server, DB, auth-ready surface, SSRF and injection classes | Client only |
| Evolution to accounts or backend | Add `api-quiz-back` later; the pure domain module and storage adapter are reused | Already there, but built before it is needed | Large rewrite once the app needs richer state or sync |
| Team (agent) familiarity | Highest (TS, React, Vitest, Playwright are mainstream) | High | Medium (Astro) or custom code |

**Rejected:** B, because it breaks D3, adds cost and operations, and does not meet SC-6 without a service worker. C, because it does not meet SC-6 without a service worker, and the stateful flow costs more as hand-built code. Preact (through `preact/compat`) stays a **fallback within A** if V-3 shows the budget is at risk. It removes about 50 KB without changing the architecture.

## 3. Recommendation (Option A)

- **`architecture.style`: `single-repo`** gives one repository, **`api-quiz-app`**, with coordination docs in `docs/` (per `docs/project-provisioning.md`). The name assumes D1 = `api-quiz`.
- **Stack (version lines; exact versions come from the current LTS/stable release at implementation time and are pinned in the lockfile):**
  - Node.js active LTS (build and CI only), npm with a committed `package-lock.json`, and `npm ci` in CI.
  - TypeScript current stable, with `strict` on. Vite current major as the build and dev server. React current major (19.x line at the time of writing) with `react-dom`.
  - No router library. A small built-in hash router (see G13). No state library: `useReducer` plus a pure domain module.
  - Styling: plain CSS (CSS Modules through Vite) with design tokens as CSS custom properties. System font stack, so no font requests. No CSS-in-JS runtime.
  - Content validation: Zod (current major), used **only at build/CI time** in `scripts/validate-content.ts`. It is not shipped to the browser. At runtime, small hand-written type guards check data read from `localStorage`.
  - Lint: ESLint with `typescript-eslint`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react-hooks`, and `react/no-danger` set to error. Prettier.
- **Module boundaries (inside one repo):**
  - `src/domain/`: pure TypeScript with no React or DOM. Covers quiz creation using the injected seeded RNG (FR-4), scoring and rounding (FR-10), retry-missed, best-score rules (FR-14), and saved-state validation and migration (FR-20).
  - `src/storage/`: a `ProgressStore` interface with `LocalStorageStore` and `MemoryStore` (FR-18). It is the only module that touches `localStorage` and the `storage` event. This is the seam for later cross-device sync.
  - `src/content/`: runtime loader and types for the emitted question bank.
  - `src/ui/`: views (Landing, Question, Feedback, Results, Review, About, NotFound, Error), the safe text renderer, and `strings.ts` (A12).
  - `content/`: source data (`topics.json`, `questions/<topic>.json`, `retired-ids.json`).
  - `scripts/`: content validation and build-time emission.
  - `tests/e2e/`: Playwright tests.
- **Hosting (assumption, tied to D2): GitHub Pages**, deployed by GitHub Actions (`actions/upload-pages-artifact` plus `actions/deploy-pages`) from `main` only, after the human owner merges. It is free for **public** repositories and adds no new external service. Known limits: no custom response headers, so CSP is set by `<meta>` (see section 6). The project site shares the origin `<owner>.github.io` with the owner's other Pages sites (see T5).
  - Alternative: Cloudflare Pages or Netlify free tier. These support real CSP and `frame-ancestors` headers through a `_headers` file, but they are a **new external service** (sponsor decision, no cost on the free tier).
  - A custom domain is optional, carries an **annual registrar cost**, and needs sponsor approval.
- **Offline approach: no service worker in MVP.** SC-6 only requires the app to work offline *after* the first load, and the brief puts installable PWA out of scope. To meet SC-6, the app avoids lazy route chunks (one JS entry), loads the data asset at startup, uses no web fonts and no remote images, and inlines icons as SVG components.
  - A service worker would add a cache-invalidation and stale-version problem (users can be stuck on an old bundle) and a more complex update flow, with no MVP acceptance criterion that needs it.
  - Revisit for R3 (installable PWA) with a Workbox-style precache and an explicit "update available" prompt.

### Test tooling

| Layer | Tool | Covers |
| --- | --- | --- |
| Unit | Vitest | Domain engine (seeded RNG, scoring, rounding, retry, best score, FR-20 discard rules), safe renderer, storage guards |
| Component | Vitest + jsdom + Testing Library (`@testing-library/react`, `user-event`) + `vitest-axe` | Radio group semantics, `aria-disabled` Submit, live region text, focus moves (G4) |
| Content | `scripts/validate-content.ts` (Zod plus custom rules) run in CI and locally | FR-21, FR-22; release mode enforces US-8 thresholds |
| E2E | Playwright (Chromium, Firefox, WebKit) plus device projects (e.g. Pixel-class Android, iPhone-class iOS emulation) and explicit widths 320/375/768/1280/1920 and 640x360 landscape | J1-J4, no horizontal scroll (`scrollWidth <= clientWidth`), rotation keeps state, deep-link refresh on hash routes, **`context.setOffline(true)` after load for SC-6**, a 0-request assertion through request listeners, chunk/data failure via `page.route` |
| Accessibility automation | `@axe-core/playwright` on every view and state (feedback, results, review, 404, error), WCAG 2.2 AA tags; emulated `prefers-reduced-motion` and `forced-colors` | SC-4 automated part. Manual NVDA/VoiceOver and keyboard passes are still required (axe does not cover them) |
| Performance and budget | Lighthouse CI (`@lhci/cli`, mobile preset) on the built site; a gzip budget check (e.g. `size-limit` or a script) that fails above 200 KB JS and above the data budget | SC-5, NFR-1 |

Real-device iOS Safari testing is not covered by Playwright WebKit. Plan one manual pass per release (owner: QA).

## 4. Gap resolutions

**G8: built-in vs fetched question data. Decision:** the content is built in at build time, as a **separate, content-hashed static JSON asset** (`questions.<hash>.json`). The app requests it once at startup (`<link rel="preload">` plus `fetch`) and keeps it in memory.
- The build runs validation, drops `draft` questions in production builds (US-7), and emits only eligible questions.
- It is not compiled into the JS bundle, so the 200 KB JS budget measures code only. Data has its own budget: **at most 60 KB gzipped** at MVP size (estimate: 60 questions is about 15-30 KB gzipped).
- Same-origin and hashed, so it is safe for CSP `connect-src 'self'` and long caching.
- It loads during the first load, so SC-6 holds. FR-25 then has a real failure mode (data request fails), so US-12's "data fails to load" criterion stays testable.
- Rejected: inlining the data in JS (larger parse cost, mixes the budgets), and fetching data at runtime from another origin or an API (breaks D3 and the CSP).

**G13: routing and 404 on static hosting. Decision:** hash routing: `#/`, `#/topic/<slug>`, `#/quiz`, `#/results`, `#/review`, `#/about`, and any other hash route shows the in-app 404 (FR-24).
- Deep-link refresh works on any static host with no server rewrite, because the path is always `/<base>/index.html`.
- A static `404.html` (no JS, same styling, "Back to home" link) handles non-hash path typos. GitHub Pages serves it automatically.
- Trade-off: URLs are less clean. Accepted, because SEO only matters for the landing page.
- Revisit if the app moves to a host with rewrites. History routing needs only a router swap there.
- Vite `base` must match the Pages project path (`/api-quiz-app/`), or `/` with a custom domain.
- E2E test: refresh on `#/topic/http-methods`, then on `#/nope` (404 view), then a non-hash path (static 404).

**G2: schema essentials** (source files are under `content/`; the emitted bundle has the same shape minus drafts):
- `schemaVersion`: integer in every source file and in the emitted bundle. Bump it only for a breaking shape change. Saved state stores it, and an unknown version leads to migrate-or-discard (FR-20).
- `contentVersion`: **generated at build time** as a short SHA-256 of the canonical eligible content, so maintainers do not bump it by hand. It is shown in About and used in report links. A change with the IDs still present keeps resume available (BA US-6 edge case).
- Question `id`: an opaque, stable slug matching `^[a-z0-9]+(-[a-z0-9]+)*$` (e.g. `http-methods-007`). It never changes when the wording is fixed. A change of meaning gets a new ID. **Removed IDs are added to `retired-ids.json`, and CI fails if one is reused**, because a reused ID could silently attach an old saved answer to a new question.
- Option `id`: stable within a question (`a`-`d`), with `correct` referencing it (FR-21). If an option's meaning changes, the question gets a new ID.
- `topic` references the `topics.json` slugs, which give the curated order (FR-1). `sourceUrl` must be `https:`. The CI rule is also checked again at render time.
- Storage keys are namespaced `apiquiz:v1:progress` and `apiquiz:v1:session`. Reset only removes the `apiquiz:` keys (FR-17).

## 5. Interfaces (internal contracts)

- `createQuiz(bank, scope, rng): QuizState`, `submitAnswer(state, optionId)`, `next(state)`, `score(state)`, `retryMissed(state, rng)`. These are pure and deterministic given `rng`.
- `ProgressStore { loadSession(); saveSession(s); loadBest(); saveBest(scope, pct); clear(); subscribe(onExternalChange) }`. Every method catches storage exceptions and returns a status, never throws (FR-18).
- `renderRichText(text): ReactNode`. Parses paragraphs, `` `inline code` `` and fenced blocks only, into React text nodes. Any other markup is shown literally (FR-7).
- External contracts: none at runtime. Outbound links only: `sourceUrl` and the G1 report link.

## 6. Threat-model checkpoint

**Scope:** static client-only app, no auth, no PII, no server. Many STRIDE classes are N/A: spoofing and privilege escalation have no identities or privileges to target, and repudiation has no transactions. **Verdict: low inherent risk, no blocking threats.** Gate 2 can pass, provided the mitigations below become acceptance checks.

**Assets:** (1) integrity of the question bank and answer keys (G4, US-8). (2) Integrity of the deployed bundle (supply chain, CI, Pages deploy). (3) Users' browsers (XSS would run in the site origin). (4) Local progress data (low value, no PII). (5) Project reputation (spam issues, wrong content).

**Trust boundaries:** contributor -> repo (PR review, human merge). Dependency registry -> build. CI -> Pages deploy. Static host -> browser. `localStorage` -> app (untrusted input). App -> external links (source, GitHub issue).

| ID | Abuse case | Sev. | Mitigation (testable) | Residual |
| --- | --- | --- | --- | --- |
| T1 | Content injection/XSS via question text, explanation or option (malicious or accidental HTML/script in a content PR) | High impact, low likelihood | Text-only renderer (no `dangerouslySetInnerHTML`, ESLint `react/no-danger` error). React escapes text. CSP blocks inline and third-party scripts. Content validation rejects `<script`/`javascript:`-like patterns (warning) | Low |
| T2 | `javascript:` or `data:` URL in `sourceUrl` | Medium | CI checks `https:` only. Render-time guard: non-https links are not rendered as `href`. Optional domain allowlist warning | Low |
| T3 | Supply chain: a compromised npm package or GitHub Action injects code into the bundle | High impact | Minimal dependencies. Lockfile plus `npm ci`. Dependabot (npm and Actions). Dependency-review on PRs. `npm audit --audit-level=high` in CI. Third-party Actions pinned by commit SHA. `GITHUB_TOKEN` defaults to `contents: read`, and only the deploy job has `pages: write` and `id-token: write`. A `github-pages` environment limited to `main` | Medium-low (cannot be eliminated) |
| T4 | Wrong or malicious answer key merged (integrity, reputation) | Medium | US-8 review rule, at least 1 human approval (G11), human-only merge, `reviewedBy` recorded, defect process | Low-medium (human process) |
| T5 | `localStorage` tampering or corruption, including by other `<owner>.github.io` project sites that **share the same origin** | Low (no secrets, self-impact) | Treat storage as untrusted. Type guards, size cap (NFR-4: 50 KB), IDs resolved against the bank, never rendered as markup, discard on failure (FR-20). Namespaced keys | Low. Removed fully with a custom domain or a separate host origin |
| T6 | Report-link abuse: spam issues, or users pasting personal data into public issues | Low | The link carries only the question ID and `contentVersion` (built with `URLSearchParams`, no user input). The issue form warns about PII. Labels and moderation by the owner. GitHub's own spam controls | Low. Accepted as normal for public repos |
| T7 | Clickjacking/framing: Pages cannot send `frame-ancestors` or `X-Frame-Options`, and `<meta>` CSP ignores `frame-ancestors` | Low (no valuable state-changing actions) | Accept for MVP on GitHub Pages. Use a header-capable host if it becomes relevant | Low (documented) |
| T8 | DoS or availability of the static host | Low | Out of the app's control. Static CDN. N/A for MVP SLOs | Accepted |
| T9 | Privacy leak via third-party requests (fonts, CDNs, analytics) | Medium (NFR-4) | CSP `default-src 'none'` with only `'self'` sources. E2E asserts that all requests are same-origin | Low |

**CSP (`<meta http-equiv>` in `index.html`; target to verify against the Vite output):** `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests`. Optionally add `require-trusted-types-for 'script'` (only Chromium enforces it). The Vite production build emits external module scripts. If any inline script or style is generated (e.g. the module preload polyfill), turn it off rather than add `'unsafe-inline'`. HTTPS: Pages "Enforce HTTPS" must be on (verify; a setting does not prove itself).

**Verification tasks (to become acceptance checks or tasks):**
- V-1: ESLint `react/no-danger` error, plus a unit test showing that `<img onerror>` and `<script>` in content render literally.
- V-2: Content CI rule tests (https-only, retired-ID reuse, duplicates), plus a runtime href guard test.
- V-3: Bundle and data gzip budget check fails the build above the limits.
- V-4: E2E: no console CSP violations, all requests same-origin, 0 requests after `setOffline(true)`.
- V-5: Workflow review: SHA-pinned actions, least-privilege permissions, deploy only from `main`. Dependabot and dependency-review are enabled (verify in repo settings; do not assume).
- V-6: Storage fuzz tests: corrupt JSON, wrong types, oversized values, unknown `schemaVersion` and stale IDs all discard without crashing.
- V-7: After first deploy, verify that HTTPS enforcement and the CSP meta are present on the live site.
- Review owner: `code-review-security`.

## 7. ADR-0001: Static client-only SPA, single repository, GitHub Pages

- **Status:** Proposed. **Date:** 2026-10-21. **Decision owners:** software-architect (proposal), human owner/sponsor (approval through D2/D3).
- **Context:** The MVP is an anonymous, English-only API-interview quiz with built-in reviewed content, local-only progress, strict performance, accessibility, offline-after-load and privacy NFRs, a small agent team, and free hosting. Sections 1-2 give the details.
- **Decision drivers:** D3 (no backend), SC-5, SC-6, NFR-2, NFR-5, cost, operating burden, evolution path.
- **Options considered:** A, static SPA (Vite + TS + React) on static hosting. B, SSR full-stack with API + DB. C, static MPA with minimal JS. Section 2 compares them.
- **Decision:** Option A. One repository, `api-quiz-app` (`architecture.style: single-repo`). Hash routing plus a static `404.html`. Content validated at build time and emitted as one hashed same-origin JSON asset loaded at startup. No service worker in MVP. `localStorage` behind a `ProgressStore` adapter with an in-memory fallback. GitHub Pages deployed from `main` by Actions. CSP via `<meta>`.
- **Positive consequences:** Zero runtime infrastructure, no secrets, and zero hosting cost on a public repo. SC-6 is met by design. A small, testable pure domain core. Mainstream tooling with strong a11y and testing support. The host can change with little effort.
- **Negative consequences / trade-offs:** Content changes need a redeploy (accepted, A2). Hash URLs. No header-level security on Pages (T7) and a shared `github.io` origin (T5). Progress does not sync across devices. React costs about 60 KB of the budget (Preact fallback).
- **Security, operations, cost:** Section 6. Operations = CI minutes only. Cost: $0 if the repo is public. See the decisions below for private.
- **Evolution path:** Accounts or a backend (R4) add `api-quiz-back`, and the style becomes `frontend-backend` (`api-quiz-management`, `api-quiz-front`, `api-quiz-back`). The domain module and the question JSON schema are reused as the API contract. `ProgressStore` gets a remote implementation. A PWA (R3) adds a service worker without restructuring.
- **Revisit triggers:** the JS budget is exceeded even with Preact, D2 = private, a need for header-level CSP, or the sponsor approving a backend.

## 8. Decisions

**Material, for the sponsor (both already part of D2 in the brief; no new decisions):**
1. **D2 visibility affects cost.** GitHub Pages for a **private** repo needs a paid GitHub plan (Pro/Team or higher), and so does CodeQL code scanning (GitHub Advanced Security) on private repos. With a public repo, both are free. Free alternatives if the repo stays private: Cloudflare Pages or Netlify free tier (a new external service that needs approval), and dependency-review/Dependabot alerts only.
2. **Optional custom domain:** annual registrar cost. It removes the shared-origin residual risk (T5). Default: none.

**Routine (architect defaults, reversible):** React over Preact (Preact is the fallback). Hash routing. No service worker. Data as a hashed JSON asset with a 60 KB gzip budget. Zod only at build time. Retired-ID registry. Build-generated `contentVersion`. CSP via meta.
