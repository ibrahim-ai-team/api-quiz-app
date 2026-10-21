# api-quiz-app

Part of **ApiQuiz** (project `idea-01`). ApiQuiz web application: quiz UI, question bank content and its validation, CI and coordination docs.

## Project repositories

| Repository | Purpose |
|---|---|
| [`api-quiz-app`](https://github.com/ibrahim-ai-team/api-quiz-app) | ApiQuiz web application: quiz UI, question bank content and its validation, CI and coordination docs |

Planning and status live in [`api-quiz-app`](https://github.com/ibrahim-ai-team/api-quiz-app) and the GitHub Project "ApiQuiz (idea-01)". Issues carry the label `project:idea-01`.

## Development

Stack: TypeScript (strict), React 19, Vite, CSS Modules with CSS custom-property design tokens, built-in hash router, Zod for build-time content validation only; static SPA deployed to GitHub Pages; Node.js active LTS for build and CI only.

Install the Node.js version in `.nvmrc`, run `npm ci`, then `npm run dev`; `npm run check` runs lint, typecheck, content validation and unit tests, and `npm run e2e` runs Playwright against `npm run build && npm run preview`.

## Testing

Vitest unit tests (domain engine, safe text renderer, storage guards) and Vitest + Testing Library component tests; content schema validation script in CI; Playwright E2E against the production build (Chromium + WebKit mobile on PRs, Firefox and full device set before release) with @axe-core/playwright, viewport, offline and same-origin request checks; Lighthouse CI (mobile) and gzip size budgets in CI
