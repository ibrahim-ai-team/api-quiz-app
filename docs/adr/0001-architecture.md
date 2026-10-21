# ADR-0001: Static client-only SPA, single repository, GitHub Pages

- **Status:** Accepted (sponsor @IbrhimGhorafi, via plan approval and decisions D1-D4 on 2026-10-21)
- **Date:** 2026-10-21 (proposed and accepted); last amended 2026-10-21 (see Amendments)
- **Decision owners:** software-architect (proposal), human owner/sponsor (approval)
- **File path note:** issue #20 / task T-21 named `docs/adr/0001-static-spa-github-pages.md`. That path is superseded by this existing file, `docs/adr/0001-architecture.md`; no second ADR file is created.
- **Detail:** full option analysis, gap resolutions (G2, G8, G13), interfaces and threat model are in `docs/planning/03-architecture-adr.md`; tech-lead adjustments are in `docs/planning/04-tech-lead-review.md` section 1.

## Context

ApiQuiz is an anonymous, English-only API-interview quiz with built-in, human-reviewed content and local-only progress. Drivers: no backend or accounts (D3); first-load JS at most 200 KB gzip and Lighthouse mobile Performance at least 90 (SC-5, NFR-1); full quiz works offline after first load with 0 requests (SC-6, NFR-7); WCAG 2.2 AA, 320-1920 px (SC-3, SC-4, NFR-2, NFR-3); strict CSP, no third-party runtime origins, no markup from data (NFR-5, FR-7); content validated at build, release fails on bad content (US-7, FR-21, FR-22); stateful flow (resume, retry, review); free hosting and low operating burden for a small agent team.

## Options considered

| Option | Outcome | Reason |
| --- | --- | --- |
| **A. Static SPA (Vite + TypeScript + React), content built in, static host** | **Chosen** | Meets D3 and SC-6 without a service worker (all code and data in memory after first load); estimated 80-100 KB gzip JS; strong a11y/test tooling; $0 hosting; very low operations |
| B. Full-stack SSR framework (e.g. Next.js) + API + DB | Rejected | Breaks D3; adds server, DB, secrets, patching and possible cost; SSR navigations fail SC-6 without a service worker |
| C. Static MPA with minimal JS (Astro static or vanilla TS) | Rejected | Every navigation is a network request, so SC-6 fails without a service worker; hand-built DOM state for resume/retry/live regions raises defect risk |

Preact (`preact/compat`) remains a fallback within A if the budget check (V-3) shows risk.

## Decision

- **Topology:** one repository, `api-quiz-app` (`architecture.style: single-repo`), coordination docs in `docs/`. Public, hosted on GitHub Pages (D1, D2).
- **Stack:** TypeScript `strict`, React 19, Vite, CSS Modules with CSS custom-property tokens, system fonts, no router or state library (built-in hash router, `useReducer` over a pure domain module). Zod at build/CI time only. ESLint (`typescript-eslint`, `jsx-a11y`, `react-hooks`, `react/no-danger: error`) and Prettier. npm with committed lockfile and `npm ci`. Exact versions: see Amendment A2.
- **Modules:** `src/domain/` (pure TS, seeded RNG, scoring), `src/storage/` (`ProgressStore` with `LocalStorageStore` and `MemoryStore`; the only `localStorage` user), `src/content/` (loader and types), `src/ui/` (views, safe text renderer, strings), `content/` (source data), `scripts/` (validation and build), `tests/`. Boundaries enforced by ESLint `no-restricted-imports`.
- **Routing:** hash routes (`#/`, `#/topic/<slug>`, `#/quiz`, `#/results`, `#/review`, `#/about`, in-app 404) plus a static no-JS `404.html`. Vite `base` is `/api-quiz-app/`.
- **Data loading (TL adjustment 3, replaces the original `<link rel="preload">`):**
  - `scripts/build-content.ts` validates content, drops drafts in production builds, generates `contentVersion` (short SHA-256 of eligible content) and writes `src/content/generated/bank.json` (gitignored).
  - The loader imports it with `import bankUrl from './generated/bank.json?url'`, so Vite emits a content-hashed same-origin asset with no custom plugin. The data is not compiled into the JS bundle; it has its own 60 KB gzip budget.
  - The `fetch(bankUrl)` starts at the top level of the entry module, before React renders; the landing shell renders while data arrives. The loader returns ok/error and never throws (FR-25 Retry).
  - `<link rel="preload">` is optional and is added only if Lighthouse CI shows a measurable LCP gain.
- **Offline:** no service worker in MVP. One JS entry (no lazy route chunks), data loaded at startup, no web fonts or remote images, inline SVG icons. Revisit for R3 (installable PWA).
- **Storage:** `localStorage` keys `apiquiz:v1:*`, treated as untrusted input (type guards, size cap, discard on failure, FR-20).
- **Hosting and deploy:** GitHub Pages via GitHub Actions from `main` only, after the human owner merges (deploy workflow is task T-20). CSP via build-time `<meta>` (Amendment A3).

### Test tooling (TL adjustments 2, 4, 5, 6)

| Layer | Tool | Runs on | Covers |
| --- | --- | --- | --- |
| Unit | Vitest | Every PR | Domain rules (seeded order, scoring, retry, best score, FR-20), safe renderer, storage guards |
| Component | Vitest + jsdom + Testing Library (`@testing-library/react`, `user-event`); **no `vitest-axe`** | Every PR | Radio semantics, `aria-disabled` Submit, live-region text, focus moves (G4) |
| Content | `scripts/validate-content.ts` (Zod + custom rules); `--release` adds US-8 thresholds | Every PR | FR-21, FR-22, retired-ID reuse, https-only |
| E2E (PR set) | Playwright, **Chromium at all 6 widths (320/375/768/1280/1920 and 640x360 landscape) + one WebKit iPhone project** | Every PR | Journeys, no horizontal scroll, rotation, deep-link refresh, offline after load with 0 requests, same-origin requests, data/chunk failure |
| E2E (full set) | Playwright, **Firefox + the full device set** (adds Android/iOS device projects) | `main` and as a release gate | Same specs; a placement change, not a weaker check |
| Accessibility | `@axe-core/playwright`, WCAG 2.2 AA tags, every view and state; reduced-motion and forced-colors emulation | With each E2E set | **The automated check that counts toward SC-4.** jsdom cannot evaluate contrast/layout, so `vitest-axe` is dropped. Manual NVDA/VoiceOver and keyboard passes still required |
| Performance and budget | Lighthouse CI mobile, 3 runs, median asserted (hard thresholds once real UI exists, after US-1); gzip budget over every emitted JS file (200 KB) and data (60 KB) | Every PR | SC-5, NFR-1, V-3 |

E2E and Lighthouse CI run against `npm run build && npm run preview` at `http://localhost:4173/api-quiz-app/` (not `staticDistDir`), so the base path and the build-only CSP are exercised. Real-device iOS Safari: one manual pass per release (QA).

## Consequences

**Positive:** zero runtime infrastructure, no secrets, $0 hosting on a public repo; SC-6 met by design; small, testable pure domain core; mainstream tooling; host can change cheaply.

**Negative / trade-offs:** content changes need a redeploy (A2); hash URLs; no header-level security on Pages (T7) and a shared `<owner>.github.io` origin (T5); no cross-device sync; React uses about 60 KB of the budget (Preact fallback); CSP is absent in `vite dev`, so CSP defects surface only in build/preview runs; Firefox and full-device regressions are caught on `main`, not on the PR.

**Evolution:** accounts/backend (R4) add `api-quiz-back` (style becomes `frontend-backend`), reusing the domain module, the question JSON schema and a remote `ProgressStore`. A PWA (R3) adds a service worker without restructuring.

**Revisit triggers:** JS budget exceeded even with Preact; need for header-level CSP or `frame-ancestors`; sponsor approves a backend or accounts; repository becomes private (Pages then needs a paid plan).

## Threat-model summary

Low inherent risk, no blocking threats (no auth, no PII, no server). Threats T1-T9 and their mitigations are in `docs/planning/03-architecture-adr.md` section 6. Verification tasks (review owner: `code-review-security`):

- **V-1:** ESLint `react/no-danger` is an error; unit test shows `<script>` and `<img onerror>` in content render literally.
- **V-2:** content CI rule tests (https-only, retired-ID reuse, duplicates) plus a runtime href guard test.
- **V-3:** JS and data gzip budget check fails the build above the limits.
- **V-4:** **CSP present in build output only; E2E runs against `vite preview`.** E2E asserts no console CSP violations, all requests same-origin, and 0 requests after `context.setOffline(true)`.
- **V-5:** workflow review: SHA-pinned actions, least-privilege `GITHUB_TOKEN`, deploy only from `main`; Dependabot and dependency review enabled (verify in repo settings, do not assume).
- **V-6:** storage fuzz tests (corrupt JSON, wrong types, oversized values, unknown `schemaVersion`, stale IDs) discard without crashing.
- **V-7:** after first deploy, verify on the live site that Pages "Enforce HTTPS" is on and the CSP meta is present.

## Amendments

| ID | Date | Amendment | Source |
| --- | --- | --- | --- |
| A1 | 2026-10-21 | Sponsor decisions: **D1** product name ApiQuiz, repository `api-quiz-app`. **D2** public repository, hosted on GitHub Pages (no paid plan needed). **D3** no accounts and no backend in MVP. **D4** the sponsor's PR review is the human content check (US-8, T4). Status moved from Proposed to Accepted. | Sponsor, 2026-10-21 |
| A2 | 2026-10-21 | T-01 implementation facts (PR #50, **not yet merged**): Vite 8.3.4, React 19.3.1, TypeScript 6.0.3, ESLint 9.39.5 (held at 9.x by the peer ranges of `typescript-eslint` and the `react`/`jsx-a11y` plugins). Node pinned `>=22.18 <23` with `engine-strict`, because only Node 22 could be verified; Node 24 (current active LTS) to be evaluated in T-02 CI. Scripts use Node's built-in type stripping (`erasableSyntaxOnly`), `tsx` as fallback; Node pinned in `.nvmrc` and `engines`. | T-01 / PR #50; TL "Also" |
| A3 | 2026-10-21 | CSP is injected as a `<meta http-equiv>` at build time only (`transformIndexHtml`, `apply: 'build'`): `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'`. `upgrade-insecure-requests` is omitted (changed from the original proposal) because preview and E2E run over http; HTTPS is enforced by GitHub Pages and verified by V-7. No inline scripts/styles; disable generated inlines rather than add `'unsafe-inline'`. | TL adjustment 1, section 5 item 7; T-01 |
| A4 | 2026-10-21 | Data loading changed from `<link rel="preload">` + `fetch` to `?url` import + early top-level `fetch`; preload optional only if Lighthouse shows an LCP gain. | TL adjustment 3, section 5 item 6 |
| A5 | 2026-10-21 | Test tooling: Playwright placement split (PR set vs `main`/release set); `vitest-axe` removed, `@axe-core/playwright` counts for SC-4; E2E/LHCI against `vite preview` with base path; LHCI 3 runs, median. | TL adjustments 2, 4, 5, 6, section 5 item 5 |
